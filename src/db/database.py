"""
database.py
===========
CSV mapper for SureFlow Phase 1.

Mapping logic:
  - If output_mapping is defined in config.yaml for this workflow
    → use only those columns with your custom names
  - If NO output_mapping is defined
    → auto-flatten all keys from data.data into CSV columns

Output CSV columns:
  - <identifier_name>  : smart name based on workflow e.g. rc_number, pan_number
  - status_code        : HTTP status from Surepass
  - Then all data columns

Columns NOT included in output (internal use only):
  - outcome, error, response_path  (these go to SQLite only)
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from src.db.storage import JOBS_DB_PATH, init_results_db, log_job_runs
from src.utils.logger import get_logger

log = get_logger(__name__)

ROOT        = Path(__file__).resolve().parents[2]
OUTPUTS_DIR = ROOT / "outputs"

# Keys inside data.data that are internal — skip during auto-flatten
SKIP_KEYS = {
    "success", "message", "message_code", "status_code",
    "response_metadata", "client_id", "less_info", "masked_name",
}

# Smart identifier column name per workflow
IDENTIFIER_COLUMN_NAMES = {
    "rc_details":        "rc_number",
    "rc_full":           "rc_number",
    "rc_financer":       "rc_number",
    "pan_details":       "pan_number",
    "pan_comprehensive": "pan_number",
    "pan_advanced":      "pan_number",
    "pan_verify":        "pan_number",
    "pan_lite":          "pan_number",
    "gst_details":       "gst_number",
    "gst_verification":  "gst_number",
    "gst_full_details":  "gst_number",
    "chassis_details":   "chassis_number",
    "chassis_to_rc":     "chassis_number",
    "aadhaar_details":   "aadhaar_number",
    "aadhaar_verify":    "aadhaar_number",
    "cin_details":       "cin_number",
    "din_details":       "din_number",
    "dl_verify":         "driving_licence",
    "dl_details":        "driving_licence",
    "passport_verify":   "passport_number",
    "voter_id_verify":   "voter_id",
    "voter_id_details":  "voter_id",
    "bank_account_verify": "bank_account",
    "mobile_to_pan":     "mobile_number",
    "mobile_to_pan_v2":  "mobile_number",
}


# ─────────────────────────────────────────────────────────────
# RESPONSE EXTRACTOR
# ─────────────────────────────────────────────────────────────

def get_data_block(response: dict) -> dict:
    """
    Navigate to the actual data block inside the response.

    Surepass response structure:
        response
        └── data          (outer wrapper)
            └── data      (actual fields)

    Returns the inner data.data dict.
    """
    if not response:
        return {}
    outer = response.get("data", {})
    if isinstance(outer, dict):
        inner = outer.get("data", {})
        if isinstance(inner, dict) and inner:
            return inner
        return outer
    return {}


def extract_path(data: dict, dot_path: str, default: str = "") -> str:
    """Extract a value from a nested dict using a dot-path string."""
    if not data or not dot_path:
        return default
    try:
        parts = dot_path.replace("]", "").replace("[", ".").split(".")
        current = data
        for part in parts:
            if part == "":
                continue
            if isinstance(current, list):
                current = current[int(part)]
            elif isinstance(current, dict):
                current = current.get(part)
            else:
                return default
            if current is None:
                return default
        return str(current) if current is not None else default
    except (KeyError, IndexError, ValueError, TypeError):
        return default


def flatten_data_block(data_block: dict) -> dict:
    """
    Flatten all keys from the data block into a flat dict.
    Skips internal keys and nested dicts.
    """
    flat = {}
    for key, value in data_block.items():
        if key in SKIP_KEYS:
            continue
        if isinstance(value, dict):
            continue
        flat[key] = "" if value is None else str(value)
    return flat


# ─────────────────────────────────────────────────────────────
# COLUMN BUILDER
# ─────────────────────────────────────────────────────────────

def build_columns(
    results: list[dict],
    mapping: list[dict],
    id_col_name: str,
) -> list[str]:
    """
    Build the full list of CSV column headers.

    Fixed columns: [id_col_name, status_code]
    Then either mapped columns or auto-flattened keys.
    """
    fixed = [id_col_name, "status_code"]

    if mapping:
        return fixed + [m["dest"] for m in mapping]

    # Auto-flatten: collect all keys across all responses
    all_keys: list[str] = []
    seen: set[str] = set()
    for result in results:
        if result.get("outcome") in ("success", "saved_422", "already_exists"):
            block = get_data_block(result.get("response") or {})
            flat  = flatten_data_block(block)
            for key in flat:
                if key not in seen:
                    all_keys.append(key)
                    seen.add(key)

    return fixed + all_keys


# ─────────────────────────────────────────────────────────────
# MAIN MAPPER
# ─────────────────────────────────────────────────────────────

def map_to_csv(
    results: list[dict],
    workflow_name: str,
    config: dict | None = None,
    output_filename: str | None = None,
    job_id: str | None = None,
) -> Path:
    """
    Map workflow results to a clean CSV file.

    Parameters
    ----------
    results          : list of result dicts from run_workflow()
    workflow_name    : e.g. "rc_details"
    config           : optional pre-loaded config dict
    output_filename  : optional custom filename

    Returns
    -------
    Path to the written CSV file.
    """
    if config is None:
        raise ValueError("config must be provided to map_to_csv")

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    # Smart identifier column name
    id_col_name = IDENTIFIER_COLUMN_NAMES.get(workflow_name, "identifier")

    # Get custom mapping if defined — empty list = auto-flatten
    mapping = config.get("output_mapping", {}).get(workflow_name, [])

    if mapping:
        log.info(f"Mapping mode : CUSTOM — {len(mapping)} columns defined in config.yaml")
    else:
        log.info("Mapping mode : AUTO-FLATTEN — all data.data keys will be extracted")

    # Build column list
    all_columns = build_columns(results, mapping, id_col_name)
    log.info(f"Output columns : {len(all_columns)} total")

    # Output filename — use job_id prefix when available for uniqueness
    if output_filename is None:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        prefix = job_id[:8] if job_id else timestamp
        output_filename = f"{workflow_name}_{prefix}.csv"

    output_path = OUTPUTS_DIR / output_filename

    written = 0
    no_data = 0

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=all_columns, extrasaction="ignore")
        writer.writeheader()

        for result in results:
            outcome  = result.get("outcome", "")
            response = result.get("response") or {}

            # Fixed columns
            row = {
                id_col_name:   result.get("identifier") or "",
                "status_code": result.get("status_code") or "",
            }

            # Data columns
            if outcome in ("success", "saved_422", "already_exists") and response:
                if mapping:
                    # Custom mapping — extract specific dot-paths
                    for m in mapping:
                        row[m["dest"]] = extract_path(response, m["source"])
                else:
                    # Auto-flatten — dump all data.data keys
                    block = get_data_block(response)
                    flat  = flatten_data_block(block)
                    row.update(flat)
            else:
                no_data += 1

            writer.writerow(row)
            written += 1

    log.info(f"CSV written → {output_path.relative_to(ROOT)}")
    log.info(f"  Total rows : {written}")
    log.info(f"  With data  : {written - no_data}")
    log.info(f"  No data    : {no_data}")

    return output_path


# ─────────────────────────────────────────────────────────────
# Job result tracking
# ─────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create the database structures used for workflow result tracking."""
    init_results_db()
    log.info("Result storage ready.")


def log_results_to_db(
    results: list[dict],
    workflow_name: str,
    batch_id: str | None = None,
) -> None:
    """Insert workflow results into the configured database."""
    init_db()

    if batch_id is None:
        batch_id = datetime.now().strftime("batch_%Y%m%d_%H%M%S")

    rows = [
        (
            batch_id,
            r.get("identifier"),
            workflow_name,
            r.get("status_code"),
            r.get("outcome"),
            r.get("response_path"),
            r.get("error"),
        )
        for r in results
    ]

    log_job_runs(rows)
    log.info(f"Logged {len(rows)} rows to database (batch: {batch_id})")


if __name__ == "__main__":
    init_db()
    print("✅ Database initialised")
