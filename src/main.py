"""
main.py
=======
SureFlow — CLI entry point.

USAGE:

  # Default — skip existing JSONs, call API for new rows only
  py -m src.main --file inputs/batch.xlsx

  # Rebuild CSV from existing JSONs — no API calls
  py -m src.main --file inputs/batch.xlsx --rebuild-csv

  # Force re-hit API for all rows — overwrites existing JSONs
  py -m src.main --file inputs/batch.xlsx --force

  # Run a specific workflow
  py -m src.main --file inputs/batch.xlsx --workflow rc_details

  # Run multiple workflows
  py -m src.main --file inputs/batch.xlsx --workflow rc_details pan_details

  # Dry run — detect columns only, no API calls
  py -m src.main --file inputs/batch.xlsx --dry-run

  # Custom output filename (single workflow only)
  py -m src.main --file inputs/batch.xlsx --output my_results.csv
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.utils.logger import get_logger
from src.utils.column_detector import load_dataframe
from src.api.surepass_client import run_workflow, load_config
from src.db.database import map_to_csv, log_results_to_db, init_db

log = get_logger("sureflow")


# ─────────────────────────────────────────────────────────────
# ARGUMENT PARSER
# ─────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        prog="sureflow",
        description="SureFlow — Surepass batch processing pipeline",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "--file", "-f",
        required=True,
        help="Path to input Excel or CSV file\nExample: inputs/batch.xlsx"
    )
    parser.add_argument(
        "--workflow", "-w",
        nargs="*",
        default=None,
        help=(
            "Workflow name(s) to run. If omitted, auto-detects from file.\n"
            "Examples:\n"
            "  --workflow rc_details\n"
            "  --workflow rc_details pan_details"
        )
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Custom output CSV filename (single workflow only)"
    )
    parser.add_argument(
        "--no-db",
        action="store_true",
        help="Skip logging results to SQLite"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Detect columns only — no API calls, no files written"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-hit API for every row even if JSON already exists"
    )
    parser.add_argument(
        "--rebuild-csv",
        action="store_true",
        help="Rebuild CSV from existing JSONs only — no API calls at all"
    )
    return parser.parse_args()


# ─────────────────────────────────────────────────────────────
# AUTO-DETECTOR
# ─────────────────────────────────────────────────────────────

def auto_detect_workflows(df, config: dict) -> dict:
    """
    Detect identifier columns using patterns from config.yaml.
    Returns dict of detected identifier types with column + workflow info.
    """
    patterns_cfg = config.get("identifier_patterns", {})
    results = {}

    for id_type, cfg in patterns_cfg.items():
        regex      = re.compile(cfg["regex"], re.IGNORECASE)
        hint_words = cfg.get("hint_words", [])
        workflow   = cfg.get("maps_to_workflow")

        best_col   = None
        best_score = 0.0

        for col in df.columns:
            sample = df[col].dropna().head(20)
            if len(sample) == 0:
                continue

            def clean(v):
                return str(v).strip().replace(" ", "").replace("-", "").upper()

            match_rate   = sum(1 for v in sample if regex.match(clean(v))) / len(sample)
            header_bonus = 0.3 if any(h in col.lower() for h in hint_words) else 0.0
            score        = match_rate + header_bonus

            if score > best_score:
                best_score = score
                best_col   = col

        if best_col and best_score >= 0.6:
            results[id_type] = {"column": best_col, "workflow": workflow, "score": best_score}
            log.info(f"  ✅  {id_type:20s} → '{best_col}'  (score: {best_score:.2f}) → workflow: {workflow}")
        else:
            log.info(f"  ➖  {id_type:20s} → not found")

    return results


# ─────────────────────────────────────────────────────────────
# SINGLE WORKFLOW RUNNER
# ─────────────────────────────────────────────────────────────

def run_single_workflow(
    df,
    column_map: dict,
    workflow_name: str,
    config: dict,
    output_filename: str | None,
    no_db: bool,
    force: bool,
    rebuild_csv: bool,
) -> bool:
    """Run one workflow and write its CSV. Returns True on success."""
    log.info(f"\n{'='*60}")
    log.info(f"  Running workflow: {workflow_name}")
    log.info(f"{'='*60}")

    try:
        results = run_workflow(
            df=df,
            column_map=column_map,
            workflow_name=workflow_name,
            config=config,
            force=force,
            rebuild_csv=rebuild_csv,
        )
    except ValueError as e:
        log.error(str(e))
        return False
    except Exception as e:
        log.error(f"Workflow '{workflow_name}' failed: {e}")
        return False

    try:
        output_path = map_to_csv(
            results=results,
            workflow_name=workflow_name,
            config=config,
            output_filename=output_filename,
        )
        log.info(f"  📄  Output CSV → {output_path.name}")
    except Exception as e:
        log.error(f"CSV mapping failed: {e}")
        return False

    if not no_db:
        try:
            init_db()
            log_results_to_db(results, workflow_name=workflow_name)
        except Exception as e:
            log.warning(f"SQLite logging failed (non-fatal): {e}")

    return True


# ─────────────────────────────────────────────────────────────
# PIPELINE
# ─────────────────────────────────────────────────────────────

def run_pipeline(args) -> int:
    log.info("=" * 60)
    log.info("  SureFlow — starting")
    log.info("=" * 60)

    # Validate conflicting flags
    if args.force and args.rebuild_csv:
        log.error("Cannot use --force and --rebuild-csv together. Pick one.")
        return 1

    # Show active mode
    if getattr(args, 'rebuild_csv', False):
        log.info("  Mode : REBUILD CSV — no API calls, building from existing JSONs")
    elif getattr(args, 'force', False):
        log.info("  Mode : FORCE — re-hitting API for all rows")
    else:
        log.info("  Mode : DEFAULT — skipping existing, calling API for new rows only")

    # ── Step 1 — Load config ──────────────────────────────────
    log.info("Step 1 — Loading config.yaml")
    try:
        config = load_config()
    except FileNotFoundError as e:
        log.error(str(e))
        return 1

    # ── Step 2 — Read input file ──────────────────────────────
    log.info(f"Step 2 — Reading input file: {args.file}")
    file_path = Path(args.file)

    if not file_path.exists():
        log.error(f"Input file not found: {file_path}")
        return 1

    try:
        df = load_dataframe(file_path)
        log.info(f"  Loaded {len(df)} rows × {len(df.columns)} columns")
    except Exception as e:
        log.error(f"Failed to read file: {e}")
        return 1

    # ── Step 3 — Detect columns ───────────────────────────────
    log.info("Step 3 — Detecting identifier columns")
    detected = auto_detect_workflows(df, config)

    if not detected:
        log.error("No identifier columns detected in this file.")
        return 1

    # ── Dry run — stop here ───────────────────────────────────
    if args.dry_run:
        log.info("\n--dry-run flag set — stopping before API calls.")
        log.info("Detected:")
        for id_type, info in detected.items():
            log.info(f"  {id_type:20s} → '{info['column']}' → workflow: {info['workflow']}")
        return 0

    # ── Step 4 — Determine workflows to run ───────────────────
    if args.workflow:
        workflows_to_run = args.workflow
        log.info(f"Step 4 — Running {len(workflows_to_run)} specified workflow(s): {workflows_to_run}")
        column_map = {id_type: info["column"] for id_type, info in detected.items()}
        for id_type in config.get("identifier_patterns", {}):
            if id_type not in column_map:
                column_map[id_type] = None
    else:
        workflows_to_run = []
        column_map = {}
        for id_type, info in detected.items():
            wf = info.get("workflow")
            if wf and wf in config.get("workflows", {}):
                workflows_to_run.append(wf)
                column_map[id_type] = info["column"]

        if not workflows_to_run:
            log.error("No matching workflows found for detected columns.")
            return 1

        log.info(f"Step 4 — Auto-detected {len(workflows_to_run)} workflow(s): {workflows_to_run}")

    # ── Step 5 — Run each workflow ────────────────────────────
    log.info("Step 5 — Running workflows")
    success_count = 0
    fail_count    = 0

    for workflow_name in workflows_to_run:
        out_filename = args.output if len(workflows_to_run) == 1 else None
        ok = run_single_workflow(
            df=df,
            column_map=column_map,
            workflow_name=workflow_name,
            config=config,
            output_filename=out_filename,
            no_db=args.no_db,
            force=args.force,
            rebuild_csv=args.rebuild_csv,
        )
        if ok:
            success_count += 1
        else:
            fail_count += 1

    # ── Final summary ─────────────────────────────────────────
    log.info("\n" + "=" * 60)
    log.info("  ALL DONE")
    log.info("=" * 60)
    log.info(f"  Workflows run       : {len(workflows_to_run)}")
    log.info(f"  ✅  Succeeded       : {success_count}")
    log.info(f"  ❌  Failed          : {fail_count}")
    log.info(f"  📁  Output folder   : outputs/")
    log.info("=" * 60)

    return 0 if fail_count == 0 else 1


# ─────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = parse_args()
    sys.exit(run_pipeline(args))