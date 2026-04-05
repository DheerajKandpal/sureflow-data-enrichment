"""
run_demo.py — SureFlow Demo Pipeline
══════════════════════════════════════════════════════════════════════════════
Reads  : inputs/sample.csv
Enriches via : providers.factory.get_provider()  (MockProvider by default)
Writes : outputs/demo_output_<YYYYMMDD_HHMMSS>.csv
Prints : live per-row status + summary table

Usage:
    python run_demo.py               # DEMO_MODE=true  → MockProvider (default)
    DEMO_MODE=false python run_demo.py  # DEMO_MODE=false → RealProvider stub
══════════════════════════════════════════════════════════════════════════════
"""

# ── dotenv MUST load before any provider imports ──────────────────────────────
from dotenv import load_dotenv
load_dotenv()

import csv
import json
import sys
from datetime import datetime
from pathlib import Path

from providers.factory import get_provider
from utils.logger import get_logger

logger = get_logger("run_demo")

# ── Path config ───────────────────────────────────────────────────────────────
INPUT_FILE = Path("inputs/sample.csv")
OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

OUTPUT_COLUMNS = [
    "identifier",
    "workflow",
    "status",
    "status_code",
    "message",
    "error",
    "data_json",
    "processed_at",
]

# ── ANSI colours (graceful no-op on Windows) ──────────────────────────────────
_IS_TTY = sys.stdout.isatty()
GREEN   = "\033[92m" if _IS_TTY else ""
RED     = "\033[91m" if _IS_TTY else ""
YELLOW  = "\033[93m" if _IS_TTY else ""
CYAN    = "\033[96m" if _IS_TTY else ""
BOLD    = "\033[1m"  if _IS_TTY else ""
RESET   = "\033[0m"  if _IS_TTY else ""


# ─────────────────────────────────────────────────────────────────────────────
def _colour_for(status: str, code: int) -> str:
    if status == "success":
        return GREEN
    if code == 422:
        return YELLOW
    return RED


def _print_header(provider_name: str, record_count: int) -> None:
    print(f"\n{BOLD}{CYAN}{'═' * 62}{RESET}")
    print(f"{BOLD}{CYAN}  SureFlow Demo Pipeline{RESET}")
    print(f"{BOLD}{CYAN}{'═' * 62}{RESET}")
    print(f"  Provider  : {BOLD}{provider_name}{RESET}")
    print(f"  Records   : {record_count}")
    print(f"{CYAN}{'─' * 62}{RESET}")
    print(f"  {'IDENTIFIER':<20} {'STATUS':<10} {'CODE':<6} MESSAGE")
    print(f"{CYAN}{'─' * 62}{RESET}")


def _print_row(row: dict) -> None:
    colour = _colour_for(row["status"], row["status_code"])
    ident  = row["identifier"] or "(empty)"
    print(
        f"  {colour}{ident:<20} {row['status']:<10}"
        f" {row['status_code']!s:<6}{RESET} {row['message']}"
    )


def _print_summary(provider_name: str, results: list[dict], out_path: Path) -> None:
    total     = len(results)
    successes = sum(1 for r in results if r["status"] == "success")
    failures  = total - successes

    print(f"\n{BOLD}{CYAN}{'═' * 62}{RESET}")
    print(f"{BOLD}{CYAN}  Summary{RESET}")
    print(f"{CYAN}{'─' * 62}{RESET}")
    print(f"  {'Provider':<22} {provider_name}")
    print(f"  {'Total records':<22} {total}")
    print(f"  {GREEN}{'✓ Success':<22} {successes}{RESET}")
    print(f"  {RED}{'✗ Failed':<22} {failures}{RESET}")
    print(f"  {'Output CSV':<22} {out_path}")
    print(f"{BOLD}{CYAN}{'═' * 62}{RESET}\n")


# ─────────────────────────────────────────────────────────────────────────────
def run() -> None:
    logger.info("SureFlow Demo Pipeline starting")

    if not INPUT_FILE.exists():
        logger.error("Input file not found: %s", INPUT_FILE)
        print(f"{RED}ERROR: {INPUT_FILE} not found. Run from the phase1-project/ directory.{RESET}")
        sys.exit(1)

    provider      = get_provider()
    provider_name = type(provider).__name__
    logger.info("Provider resolved: %s", provider_name)

    # ── Read input ────────────────────────────────────────────────────────────
    with INPUT_FILE.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    logger.info("Records loaded: %d", len(rows))
    _print_header(provider_name, len(rows))

    results: list[dict] = []

    # ── Process records ───────────────────────────────────────────────────────
    for row in rows:
        identifier   = row.get("identifier", "").strip()
        workflow     = row.get("workflow", "").strip()
        payload_note = row.get("payload_note", "").strip()

        record = {
            "identifier": identifier,
            "workflow":   workflow,
            "payload":    {"note": payload_note},
        }

        response = provider.enrich(record)

        status      = response.get("status", "error")
        status_code = response.get("status_code", 0)
        message     = response.get("message", "")
        error       = response.get("error") or ""
        data        = response.get("data")

        output_row = {
            "identifier":   identifier or "",
            "workflow":     workflow,
            "status":       status,
            "status_code":  status_code,
            "message":      message,
            "error":        error,
            "data_json":    json.dumps(data, ensure_ascii=False) if data else "",
            "processed_at": datetime.now().isoformat(timespec="seconds"),
        }
        results.append(output_row)
        _print_row(output_row)

    # ── Write output CSV ──────────────────────────────────────────────────────
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path  = OUTPUT_DIR / f"demo_output_{timestamp}.csv"

    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(results)

    logger.info("Output written → %s", out_path)

    successes = sum(1 for r in results if r["status"] == "success")
    failures  = len(results) - successes
    logger.info("Pipeline complete — success: %d | failed: %d", successes, failures)

    _print_summary(provider_name, results, out_path)


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run()
