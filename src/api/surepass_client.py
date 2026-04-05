"""
surepass_client.py
==================
Core API dispatcher for SureFlow.

Three run modes:
  DEFAULT      — skip if JSON exists, call API only for new identifiers
  --force      — call API for everything, overwrite existing JSONs
  --rebuild-csv — load existing JSONs only, no API calls at all
"""

import json
import os
import time
import atexit
import yaml
import httpx
from datetime import datetime
from pathlib import Path
from providers.base_provider import BaseProvider
from providers.mock_provider import MockProvider
from src.utils.logger import get_logger
from src.utils.identifiers import normalize_identifier

log = get_logger(__name__)

ROOT          = Path(__file__).resolve().parents[2]
CONFIG_PATH   = ROOT / "config.yaml"
RESPONSES_DIR = ROOT / "responses"

# Shared client — connection pooling across all real API calls
_http_client = httpx.Client(timeout=30)
atexit.register(_http_client.close)


class RealProvider(BaseProvider):
    """Wraps the existing HTTP call logic behind the provider interface."""

    def __init__(self, url: str, method: str, headers: dict):
        self.url = url
        self.method = method.upper()
        self.headers = headers

    def call(self, identifier, workflow, payload) -> dict:
        response = (
            _http_client.post(self.url, json=payload, headers=self.headers)
            if self.method == "POST"
            else _http_client.get(self.url, params=payload, headers=self.headers)
        )

        try:
            body = response.json()
        except Exception:
            body = {"raw": response.text}

        return {
            "status_code": response.status_code,
            "body": body,
            "headers": dict(response.headers),
        }


# ─────────────────────────────────────────────────────────────
# CONFIG LOADER
# ─────────────────────────────────────────────────────────────

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"config.yaml not found at {CONFIG_PATH}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    log.info("config.yaml loaded successfully")
    return config


# ─────────────────────────────────────────────────────────────
# PAYLOAD BUILDER
# ─────────────────────────────────────────────────────────────

def build_payload(template: dict, identifier: str) -> dict:
    """
    Recursively build payload from template.
    Replaces "{input}" with identifier anywhere in the structure.
    """
    if isinstance(template, dict):
        return {k: build_payload(v, identifier) for k, v in template.items()}
    elif isinstance(template, list):
        return [build_payload(item, identifier) for item in template]
    elif isinstance(template, str):
        return template.replace("{input}", identifier)
    else:
        return template


# ─────────────────────────────────────────────────────────────
# PROVIDER FACTORY
# ─────────────────────────────────────────────────────────────

def get_provider(api_cfg: dict, token: str) -> BaseProvider:
    demo_mode = os.getenv("DEMO_MODE", "false").strip().lower() == "true"
    if demo_mode:
        return MockProvider()

    headers = {"Authorization": token, "Content-Type": "application/json"}
    return RealProvider(
        url=api_cfg["url"],
        method=api_cfg.get("method", "POST"),
        headers=headers,
    )


# ─────────────────────────────────────────────────────────────
# JSON SAVER
# ─────────────────────────────────────────────────────────────

def get_response_path(api_name: str, identifier: str) -> Path:
    folder = RESPONSES_DIR / api_name
    folder.mkdir(parents=True, exist_ok=True)
    safe_id = str(identifier).strip().replace("/", "_").replace("\\", "_")
    return folder / f"{safe_id}.json"


def save_response(api_name: str, identifier: str, status_code: int, response_data: dict) -> Path:
    file_path = get_response_path(api_name, identifier)
    payload = {
        "_meta": {
            "status_code": status_code,
            "identifier":  identifier,
            "timestamp":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "api":         api_name,
        },
        "data": response_data,
    }
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    log.debug(f"Saved → {file_path.relative_to(ROOT)}")
    return file_path


def load_existing(file_path: Path, identifier: str) -> dict:
    """Load an existing JSON file and return a result dict."""
    with open(file_path, "r", encoding="utf-8") as f:
        existing = json.load(f)
    return {
        "identifier":    identifier,
        "status_code":   existing.get("_meta", {}).get("status_code"),
        "response":      existing.get("data"),
        "response_path": str(file_path),
        "outcome":       "already_exists",
        "error":         None,
    }


# ─────────────────────────────────────────────────────────────
# SINGLE API CALL WITH RETRY
# ─────────────────────────────────────────────────────────────

def call_api(identifier: str, api_name: str, api_cfg: dict, token: str, retry_cfg: dict) -> dict:
    url           = api_cfg["url"]
    save_codes    = api_cfg.get("save_codes", [200])
    retry_codes   = api_cfg.get("retry_codes", [500, 502, 503])
    success_codes = api_cfg.get("success_codes", [200])
    payload       = build_payload(api_cfg["payload_template"], identifier)
    provider      = get_provider(api_cfg, token)
    max_attempts  = retry_cfg.get("max_attempts", 3)
    backoff_base  = retry_cfg.get("backoff_base_seconds", 2)
    last_error    = None

    for attempt in range(1, max_attempts + 1):
        try:
            log.debug(f"  [{identifier}] attempt {attempt}/{max_attempts} → {url}")
            provider_response = provider.call(identifier, api_name, payload)
            status = provider_response.get("status_code")
            body = provider_response.get("body") or {}
            headers = provider_response.get("headers") or {}
            log.debug(f"  [{identifier}] HTTP {status}")

            if status in success_codes:
                path = save_response(api_name, identifier, status, body)
                log.info(f"  ✅  [{identifier}] success (HTTP {status})")
                return {"identifier": identifier, "status_code": status, "response": body,
                        "response_path": str(path), "outcome": "success", "error": None}

            elif status == 422:
                path = save_response(api_name, identifier, status, body)
                log.warning(f"  ⚠️   [{identifier}] HTTP 422 — saved, flagged unverified")
                return {"identifier": identifier, "status_code": 422, "response": body,
                        "response_path": str(path), "outcome": "saved_422",
                        "error": body.get("message", "422 unverified")}

            elif status in (401, 403):
                log.error(f"  🔒  [{identifier}] HTTP {status} — token invalid")
                return {"identifier": identifier, "status_code": status, "response": body,
                        "response_path": None, "outcome": "failed",
                        "error": f"Auth error HTTP {status} — check token in config.yaml"}

            elif status == 429:
                retry_after = int(headers.get("Retry-After", backoff_base * attempt))
                log.warning(f"  ⏳  [{identifier}] HTTP 429 — waiting {retry_after}s")
                time.sleep(retry_after)
                last_error = "Rate limited (429)"
                continue

            elif status in retry_codes:
                wait = backoff_base ** attempt
                log.warning(f"  🔁  [{identifier}] HTTP {status} — retry in {wait}s ({attempt}/{max_attempts})")
                time.sleep(wait)
                last_error = f"Server error HTTP {status}"
                continue

            elif status in save_codes:
                path = save_response(api_name, identifier, status, body)
                log.info(f"  💾  [{identifier}] saved response (HTTP {status})")
                return {"identifier": identifier, "status_code": status, "response": body,
                        "response_path": str(path), "outcome": "success", "error": None}

            else:
                log.error(f"  ❌  [{identifier}] HTTP {status} — not retrying")
                return {"identifier": identifier, "status_code": status, "response": body,
                        "response_path": None, "outcome": "failed", "error": f"HTTP {status}"}

        except httpx.TimeoutException:
            wait = backoff_base ** attempt
            log.warning(f"  ⏱️   [{identifier}] Timeout — retry in {wait}s ({attempt}/{max_attempts})")
            time.sleep(wait)
            last_error = "Request timed out"

        except httpx.RequestError as e:
            log.error(f"  ❌  [{identifier}] Network error: {e}")
            return {"identifier": identifier, "status_code": None, "response": None,
                    "response_path": None, "outcome": "failed", "error": f"Network error: {e}"}

    log.error(f"  💀  [{identifier}] dead letter — all {max_attempts} attempts failed")
    return {"identifier": identifier, "status_code": None, "response": None,
            "response_path": None, "outcome": "dead_letter",
            "error": last_error or "Max retries exhausted"}


# ─────────────────────────────────────────────────────────────
# WORKFLOW RUNNER
# ─────────────────────────────────────────────────────────────

def run_workflow(
    df,
    column_map: dict,
    workflow_name: str,
    config: dict | None = None,
    force: bool = False,
    rebuild_csv: bool = False,
) -> list[dict]:
    """
    Run a workflow against every row in a DataFrame.

    Modes
    -----
    force=False, rebuild_csv=False  → DEFAULT
        Skip rows where JSON already exists. Call API for new rows only.

    force=True                      → FORCE
        Call API for every row. Overwrite existing JSONs.

    rebuild_csv=True                → REBUILD CSV
        Load existing JSONs only. No API calls at all.
        Rows with no existing JSON are skipped.
    """
    if config is None:
        config = load_config()

    if workflow_name not in config["workflows"]:
        raise ValueError(
            f"Workflow '{workflow_name}' not found in config.yaml.\n"
            f"Available: {list(config['workflows'].keys())}"
        )

    workflow    = config["workflows"][workflow_name]
    input_field = workflow["input_field"]
    api_name    = workflow["api"]
    api_cfg     = config["apis"][api_name]
    token       = config["tokens"][workflow["token"]]
    retry_cfg   = config.get("retry", {})
    folder_name = api_cfg["url"].rstrip("/").split("/")[-1]
    col_name    = column_map.get(input_field)

    if col_name is None:
        raise ValueError(
            f"Workflow '{workflow_name}' needs column '{input_field}' "
            f"but it was not detected in your file.\n"
            f"Detected columns: {column_map}"
        )

    # Log which mode we're running in
    if rebuild_csv:
        log.info("Mode : REBUILD CSV — loading existing JSONs, no API calls")
    elif force:
        log.info("Mode : FORCE — re-hitting API for all rows, overwriting existing JSONs")
    else:
        log.info("Mode : DEFAULT — skipping existing, calling API for new rows only")

    total   = len(df)
    results = []

    log.info(f"Starting workflow '{workflow_name}' — {total} rows — column '{col_name}'")
    log.info(f"API endpoint : {api_cfg['url']}")
    log.info(f"Saving to    : responses/{folder_name}/")
    log.info("-" * 60)

    for i, row in df.iterrows():
        raw_value = row[col_name]

        # Skip empty values
        if not raw_value or str(raw_value).strip().lower() in ("nan", "none", ""):
            log.warning(f"  Row {i+1}/{total} — empty value, skipping")
            results.append({"identifier": None, "status_code": None, "response": None,
                            "response_path": None, "outcome": "skipped", "error": "Empty value"})
            continue

        identifier    = normalize_identifier(input_field, raw_value)
        existing_file = get_response_path(folder_name, identifier)

        # ── REBUILD CSV mode — load existing, skip missing ────
        if rebuild_csv:
            if existing_file.exists():
                log.info(f"  📂  Row {i+1}/{total} — [{identifier}] loaded from existing JSON")
                results.append(load_existing(existing_file, identifier))
            else:
                log.warning(f"  ➖  Row {i+1}/{total} — [{identifier}] no JSON found, skipping")
                results.append({"identifier": identifier, "status_code": None, "response": None,
                                "response_path": None, "outcome": "skipped",
                                "error": "No existing JSON — run without --rebuild-csv to fetch"})
            continue

        # ── FORCE mode — always hit API ───────────────────────
        if force:
            log.info(f"  Row {i+1}/{total} — [{identifier}] (force)")
            result = call_api(identifier, folder_name, api_cfg, token, retry_cfg)
            results.append(result)
            continue

        # ── DEFAULT mode — skip if exists ─────────────────────
        if existing_file.exists():
            log.info(f"  ⏭️   Row {i+1}/{total} — [{identifier}] already exists, skipping")
            results.append(load_existing(existing_file, identifier))
            continue

        log.info(f"  Row {i+1}/{total} — [{identifier}]")
        result = call_api(identifier, folder_name, api_cfg, token, retry_cfg)
        results.append(result)

    # Summary
    success  = sum(1 for r in results if r["outcome"] == "success")
    s422     = sum(1 for r in results if r["outcome"] == "saved_422")
    exists   = sum(1 for r in results if r["outcome"] == "already_exists")
    failed   = sum(1 for r in results if r["outcome"] == "failed")
    dead     = sum(1 for r in results if r["outcome"] == "dead_letter")
    skipped  = sum(1 for r in results if r["outcome"] == "skipped")

    log.info("=" * 60)
    log.info(f"Workflow '{workflow_name}' complete")
    log.info(f"  ✅  Success        : {success}")
    log.info(f"  ⚠️   Saved 422      : {s422}")
    log.info(f"  ⏭️   Already exists : {exists}")
    log.info(f"  ❌  Failed         : {failed}")
    log.info(f"  💀  Dead letter    : {dead}")
    log.info(f"  ➖  Skipped        : {skipped}")
    log.info("=" * 60)

    return results
