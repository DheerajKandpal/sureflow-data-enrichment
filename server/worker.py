"""
worker.py
=========
SureFlow pipeline — background thread runner.

Thread-safety guarantees:
  - CONFIG_LOCK (RLock) wraps every config.yaml read inside _run_job,
    preventing reads of a partially-written file.
  - _db_lock serialises all writes to jobs.db (job state DB).
    SQLite WAL mode is enabled so reads never block.
  - Each job has its own queue, pause event, and stop event —
    no shared mutable state between job threads.
  - job_id is passed to map_to_csv so output filenames are
    always unique even if two jobs finish in the same second.
  - Shared httpx client in surepass_client.py handles connection
    pooling transparently.

On startup:
  - Loads all previous jobs from jobs.db into memory.
  - Any job that was 'running' when the server died is marked
    'paused' so the user can resume it from where it stopped.
"""

import uuid
import json
import os
import threading
import queue
import time
from datetime import datetime
from pathlib import Path
from src.utils.logger import get_logger
from src.db.database import JOBS_DB_PATH
from src.db.storage import ensure_jobs_table, load_jobs, mark_interrupted_jobs, upsert_job
from src.utils.identifiers import get_identifier_pattern, matches_identifier

log = get_logger(__name__)

ROOT    = Path(__file__).resolve().parents[1]
JOBS_DB = JOBS_DB_PATH

JOBS: dict[str, dict]          = {}
JOB_QUEUES: dict[str, queue.Queue]           = {}
PAUSE_EVENTS: dict[str, threading.Event]     = {}
STOP_EVENTS: dict[str, threading.Event]      = {}

# Serialises all writes to jobs.db
_db_lock = threading.Lock()

# How often (rows) to flush job progress to DB during a run
_DB_FLUSH_EVERY = 10


# ─────────────────────────────────────────────────────────────
# IDENTIFIER FORMAT PATTERNS
# Applied per-row before making an API call.
# Values are pre-cleaned: uppercased, spaces and dashes removed.
# ─────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────
# JOB STATE DB COLUMNS
# ─────────────────────────────────────────────────────────────

_JOB_COLUMNS = [
    "job_id", "status", "progress", "total", "success", "saved_422",
    "failed", "skipped", "invalid_format", "already_exists",
    "output_csv", "workflow", "filename", "started_at", "finished_at",
    "error", "paused_at_row", "resume_at", "pause_reason", "column_map_json",
]

_INT_FIELDS = {
    "progress", "total", "success", "saved_422", "failed",
    "skipped", "invalid_format", "already_exists", "paused_at_row",
}


# ─────────────────────────────────────────────────────────────
# Job state DB helpers
# ─────────────────────────────────────────────────────────────


def _init_db():
    with _db_lock:
        ensure_jobs_table(_JOB_COLUMNS, _INT_FIELDS)


def _upsert_job(job: dict):
    with _db_lock:
        try:
            upsert_job(job, _JOB_COLUMNS)
        except Exception as e:
            log.error(f"jobs.db upsert error: {e}")


def _load_jobs_from_db() -> list[dict]:
    with _db_lock:
        try:
            return load_jobs(_JOB_COLUMNS, _INT_FIELDS)
        except Exception as e:
            log.error(f"jobs.db load error: {e}")
            return []


def _mark_interrupted_jobs():
    """
    On startup: any job that was running/processing/pending when the
    server died gets marked paused so the user can resume it.
    """
    with _db_lock:
        try:
            mark_interrupted_jobs()
        except Exception as e:
            log.error(f"jobs.db mark-interrupted error: {e}")


def _save(job_id: str):
    job = JOBS.get(job_id)
    if job:
        _upsert_job(job)


# ─────────────────────────────────────────────────────────────
# BOOT — load existing jobs into memory on import
# ─────────────────────────────────────────────────────────────

def _boot():
    _init_db()
    _mark_interrupted_jobs()
    count = 0
    for job in _load_jobs_from_db():
        jid = job["job_id"]
        JOBS[jid] = job
        JOB_QUEUES[jid]   = queue.Queue()
        PAUSE_EVENTS[jid] = threading.Event()
        PAUSE_EVENTS[jid].set()
        STOP_EVENTS[jid]  = threading.Event()
        count += 1
    log.info(f"Loaded {count} job(s) from jobs.db on startup.")


_boot()


# ─────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────

def create_job() -> str:
    job_id = str(uuid.uuid4())
    job = {
        "job_id":         job_id,
        "status":         "pending",
        "progress":       0,
        "total":          0,
        "success":        0,
        "saved_422":      0,
        "failed":         0,
        "skipped":        0,
        "invalid_format": 0,
        "already_exists": 0,
        "output_csv":     None,
        "workflow":       None,
        "filename":       None,
        "started_at":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "finished_at":    None,
        "error":          None,
        "paused_at_row":  None,
        "resume_at":      None,
        "pause_reason":   None,
        "column_map_json": None,
    }
    JOBS[job_id] = job
    JOB_QUEUES[job_id]   = queue.Queue()
    PAUSE_EVENTS[job_id] = threading.Event()
    PAUSE_EVENTS[job_id].set()
    STOP_EVENTS[job_id]  = threading.Event()
    _upsert_job(job)
    return job_id


def get_job(job_id: str) -> dict | None:
    return JOBS.get(job_id)


def get_all_jobs() -> list[dict]:
    return list(reversed(list(JOBS.values())))


def _push_log(job_id: str, message: str):
    if job_id in JOB_QUEUES:
        JOB_QUEUES[job_id].put(message)


def pause_job(job_id: str, reason: str = "manual") -> bool:
    job = JOBS.get(job_id)
    if not job or job["status"] != "running":
        return False
    PAUSE_EVENTS[job_id].clear()
    job["status"]        = "paused"
    job["pause_reason"]  = reason
    job["paused_at_row"] = job["progress"]
    _push_log(job_id, f"⏸ Job paused at row {job['progress']} (reason: {reason})")
    _save(job_id)
    return True


def resume_job(job_id: str, start_from_row: int | None = None, delay_minutes: int = 0) -> bool:
    job = JOBS.get(job_id)
    if not job or job["status"] not in ("paused", "scheduled"):
        return False

    if start_from_row is not None:
        job["paused_at_row"] = start_from_row

    if delay_minutes > 0:
        resume_time      = datetime.now().timestamp() + delay_minutes * 60
        job["status"]    = "scheduled"
        job["resume_at"] = datetime.fromtimestamp(resume_time).strftime("%Y-%m-%d %H:%M:%S")
        _push_log(job_id, f"⏰ Scheduled resume in {delay_minutes} min (row {job['paused_at_row']})")
        _save(job_id)

        def _delayed_resume():
            time.sleep(delay_minutes * 60)
            if JOBS.get(job_id, {}).get("status") == "scheduled":
                _do_resume(job_id)

        threading.Thread(target=_delayed_resume, daemon=True).start()
    else:
        _do_resume(job_id)
    return True


def _do_resume(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        return
    job["status"]    = "running"
    job["resume_at"] = None
    _push_log(job_id, f"▶ Resuming from row {job.get('paused_at_row') or 0}")
    _save(job_id)
    PAUSE_EVENTS[job_id].set()


def cancel_schedule(job_id: str) -> bool:
    job = JOBS.get(job_id)
    if not job or job["status"] != "scheduled":
        return False
    job["status"]    = "paused"
    job["resume_at"] = None
    _push_log(job_id, "⏹ Schedule cancelled — job remains paused")
    _save(job_id)
    return True


def run_job_async(
    job_id: str,
    file_path: str,
    workflow_name: str,
    column_map: dict,
    force: bool = False,
    rebuild_csv: bool = False,
    start_from_row: int = 0,
    delay_minutes: int = 0,
):
    job = JOBS.get(job_id)
    if job is not None:
        job["column_map_json"] = json.dumps(column_map or {})
        _save(job_id)

    if delay_minutes > 0:
        job = JOBS[job_id]
        resume_time      = datetime.now().timestamp() + delay_minutes * 60
        job["status"]    = "scheduled"
        job["resume_at"] = datetime.fromtimestamp(resume_time).strftime("%Y-%m-%d %H:%M:%S")
        _push_log(job_id, f"⏰ Job scheduled to start in {delay_minutes} min")
        _save(job_id)

        def _delayed_start():
            time.sleep(delay_minutes * 60)
            if JOBS.get(job_id, {}).get("status") == "scheduled":
                job["status"] = "pending"
                _start_thread(job_id, file_path, workflow_name, column_map, force, rebuild_csv, start_from_row)

        threading.Thread(target=_delayed_start, daemon=True).start()
    else:
        _start_thread(job_id, file_path, workflow_name, column_map, force, rebuild_csv, start_from_row)


def _start_thread(job_id, file_path, workflow_name, column_map, force, rebuild_csv, start_from_row):
    threading.Thread(
        target=_run_job,
        args=(job_id, file_path, workflow_name, column_map, force, rebuild_csv, start_from_row),
        daemon=True,
    ).start()


# ─────────────────────────────────────────────────────────────
# CORE JOB RUNNER
# ─────────────────────────────────────────────────────────────

def _run_job(
    job_id: str,
    file_path: str,
    workflow_name: str,
    column_map: dict,
    force: bool,
    rebuild_csv: bool,
    start_from_row: int = 0,
):
    job       = JOBS[job_id]
    pause_evt = PAUSE_EVENTS[job_id]
    stop_evt  = STOP_EVENTS[job_id]

    job["status"]   = "running"
    job["workflow"] = workflow_name
    job["filename"] = Path(file_path).name
    _save(job_id)

    try:
        import pandas as pd
        from src.api.surepass_client import load_config, call_api, get_response_path, load_existing
        from src.db.database import map_to_csv, init_db, log_results_to_db
        from server.config_lock import CONFIG_LOCK

        # Load config once per job under the lock — not per-row
        with CONFIG_LOCK:
            config = load_config()

        workflow    = config["workflows"][workflow_name]
        input_field = workflow["input_field"]
        api_name    = workflow["api"]
        api_cfg     = config["apis"][api_name]
        token_name  = workflow["token"]
        token       = config["tokens"][token_name]
        if token_name == "primary":
            env_primary = os.getenv("SUREPASS_PRIMARY_TOKEN", "").strip()
            if env_primary:
                token = f"Bearer {env_primary}"
        elif token_name == "secondary":
            env_secondary = os.getenv("SUREPASS_SECONDARY_TOKEN", "").strip()
            if env_secondary:
                token = f"Bearer {env_secondary}"
        retry_cfg   = config.get("retry", {})
        folder_name = api_cfg["url"].rstrip("/").split("/")[-1]
        col_name    = column_map.get(input_field)
        fmt_pattern = get_identifier_pattern(input_field, config=config)

        consec_limit   = retry_cfg.get("consecutive_500_limit", 5)
        consec_pause_m = retry_cfg.get("consecutive_500_pause_minutes", 10)
        consec_count   = 0

        if col_name is None:
            raise ValueError(f"Column '{input_field}' not found in column_map.")

        suffix = Path(file_path).suffix.lower()
        df     = pd.read_excel(file_path, dtype=str) if suffix in (".xlsx", ".xls") \
                 else pd.read_csv(file_path, dtype=str)

        total        = len(df)
        job["total"] = total
        results      = []

        _push_log(job_id, f"Starting '{workflow_name}' — {total} rows (from row {start_from_row + 1})")
        if fmt_pattern:
            _push_log(job_id, f"🔍 Format validation active for '{input_field}'")

        for idx, (_, row) in enumerate(df.iterrows()):

            # Periodic DB flush
            if idx % _DB_FLUSH_EVERY == 0:
                _save(job_id)

            # Skip rows before start_from_row
            if idx < start_from_row:
                identifier = str(row.get(col_name, "")).strip().upper().replace(" ", "").replace("-", "")
                existing   = get_response_path(folder_name, identifier)
                results.append(
                    load_existing(existing, identifier) if existing.exists() else {
                        "identifier": identifier, "status_code": None,
                        "response": None, "response_path": None,
                        "outcome": "skipped", "error": "Before start row",
                    }
                )
                continue

            # Check stop
            if stop_evt.is_set():
                _push_log(job_id, f"🛑 Stopped at row {idx + 1}")
                job["status"]        = "paused"
                job["paused_at_row"] = idx
                _save(job_id)
                break

            # Check pause — blocks here until resumed
            if not pause_evt.is_set():
                _push_log(job_id, f"⏸ Paused at row {idx + 1} — waiting for resume…")
                _save(job_id)
                pause_evt.wait()
                if stop_evt.is_set():
                    break
                _push_log(job_id, f"▶ Resumed at row {idx + 1}")

            raw_value = row.get(col_name)

            if not raw_value or str(raw_value).strip().lower() in ("nan", "none", ""):
                _push_log(job_id, f"Row {idx+1}/{total} — empty, skipped")
                results.append({
                    "identifier": None, "status_code": None,
                    "response": None, "response_path": None,
                    "outcome": "skipped", "error": "Empty value",
                })
                job["skipped"]  += 1
                job["progress"]  = idx + 1
                continue

            identifier, is_valid_identifier = matches_identifier(input_field, raw_value, config=config)
            existing_file = get_response_path(folder_name, identifier)

            # ── Format validation ─────────────────────────────────────────
            if fmt_pattern and not is_valid_identifier:
                _push_log(job_id, f"Row {idx+1}/{total} — [{identifier}] ⚠️ invalid format, skipped")
                results.append({
                    "identifier":    identifier,
                    "status_code":   None,
                    "response":      None,
                    "response_path": None,
                    "outcome":       "invalid_format",
                    "error":         f"Does not match expected format for {input_field}",
                })
                job["invalid_format"] += 1
                job["progress"]        = idx + 1
                continue
            # ─────────────────────────────────────────────────────────────

            if rebuild_csv:
                if existing_file.exists():
                    _push_log(job_id, f"Row {idx+1}/{total} — [{identifier}] loaded from JSON")
                    result = load_existing(existing_file, identifier)
                    job["already_exists"] += 1
                else:
                    result = {
                        "identifier": identifier, "status_code": None,
                        "response": None, "response_path": None,
                        "outcome": "skipped", "error": "No existing JSON",
                    }
                    job["skipped"] += 1
                results.append(result)
                job["progress"] = idx + 1
                continue

            if not force and existing_file.exists():
                _push_log(job_id, f"Row {idx+1}/{total} — [{identifier}] already exists, skipped")
                results.append(load_existing(existing_file, identifier))
                job["already_exists"] += 1
                job["progress"]        = idx + 1
                continue

            # ── API call ──────────────────────────────────────────────────
            _push_log(job_id, f"Row {idx+1}/{total} — [{identifier}] calling API...")
            result      = call_api(identifier, folder_name, api_cfg, token, retry_cfg)
            results.append(result)

            outcome     = result["outcome"]
            status_code = result.get("status_code")
            error_str   = str(result.get("error", "")).lower()

            if outcome == "success":
                job["success"] += 1
                consec_count    = 0
                _push_log(job_id, f"Row {idx+1}/{total} — [{identifier}] ✅ success")

            elif outcome == "saved_422":
                job["saved_422"] += 1
                consec_count      = 0
                _push_log(job_id, f"Row {idx+1}/{total} — [{identifier}] ⚠️ 422 saved")

            else:
                job["failed"] += 1
                is_network = any(k in error_str for k in
                                 ("getaddrinfo", "network", "timeout", "connection", "errno"))
                is_500     = status_code == 500 or "500" in error_str

                if is_500 or is_network:
                    consec_count += 1
                    err_type = "network error" if is_network else "HTTP 500"
                    _push_log(job_id,
                        f"Row {idx+1}/{total} — [{identifier}] ❌ {err_type} "
                        f"({consec_count}/{consec_limit} consecutive)")

                    if consec_count >= consec_limit:
                        _push_log(job_id,
                            f"🚨 {consec_limit} consecutive failures — "
                            f"auto-pausing for {consec_pause_m} min")
                        job["status"]        = "paused"
                        job["pause_reason"]  = "auto_500"
                        job["paused_at_row"] = idx + 1
                        PAUSE_EVENTS[job_id].clear()
                        resume_time      = datetime.now().timestamp() + consec_pause_m * 60
                        job["resume_at"] = datetime.fromtimestamp(resume_time).strftime(
                            "%Y-%m-%d %H:%M:%S")
                        _save(job_id)

                        def _auto_resume(jid=job_id, mins=consec_pause_m):
                            time.sleep(mins * 60)
                            j = JOBS.get(jid, {})
                            if j.get("status") == "paused" and j.get("pause_reason") == "auto_500":
                                _push_log(jid, f"⏰ Auto-resuming after {mins} min cooldown")
                                j["status"]       = "running"
                                j["pause_reason"] = None
                                j["resume_at"]    = None
                                PAUSE_EVENTS[jid].set()
                                _save(jid)

                        threading.Thread(target=_auto_resume, daemon=True).start()
                        consec_count = 0
                        pause_evt.wait()
                        _push_log(job_id, f"▶ Resuming after auto-pause at row {idx+2}")
                else:
                    consec_count = 0
                    _push_log(job_id,
                        f"Row {idx+1}/{total} — [{identifier}] ❌ {result.get('error')}")

            job["progress"] = idx + 1

        # ── Finish ────────────────────────────────────────────────────────
        if job["status"] not in ("paused",):
            _push_log(job_id, "Writing output CSV...")
            output_path       = map_to_csv(results, workflow_name, config, job_id=job_id)
            job["output_csv"] = output_path.name
            init_db()
            log_results_to_db(results, workflow_name, batch_id=job_id)
            job["status"]      = "done"
            job["finished_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            inv = job["invalid_format"]
            _push_log(job_id,
                f"✅ DONE — CSV: {output_path.name}"
                f"{f' · {inv} invalid format rows skipped' if inv else ''}")
            _push_log(job_id, "__DONE__")
        else:
            _push_log(job_id, "__DONE__")

        _save(job_id)

    except Exception as e:
        job["status"]      = "failed"
        job["error"]       = str(e)
        job["finished_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        _push_log(job_id, f"ERROR: {e}")
        _push_log(job_id, "__DONE__")
        _save(job_id)
        log.error(f"Job {job_id} failed: {e}")
