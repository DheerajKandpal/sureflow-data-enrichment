"""
column_detector.py
==================
Reads an Excel or CSV file and identifies which column contains
which type of identifier (RC, PAN, GST, Chassis, etc.)

Uses regex pattern matching against actual cell values — not just
column header names — so it works even when headers are vague like
"ref_1", "id_col", or "unknown_field".

Usage:
    from src.utils.column_detector import detect_columns
    result = detect_columns("inputs/my_batch.xlsx")
    print(result)
    # {
    #   "rc_number":  "Vehicle Reg No",
    #   "pan_number": "PAN",
    #   "gst_number": None,
    #   ...
    # }
"""

import re
import pandas as pd
from pathlib import Path
from src.utils.logger import get_logger

log = get_logger(__name__)

# ─────────────────────────────────────────────────────────────
# REGEX PATTERNS
# Each pattern is tested against the actual VALUES in each column
# (first 20 non-null rows), not the header name.
# ─────────────────────────────────────────────────────────────
PATTERNS = {
    "rc_number": re.compile(
        r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$",
        re.IGNORECASE
    ),
    "pan_number": re.compile(
        r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
        re.IGNORECASE
    ),
    "gst_number": re.compile(
        r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$",
        re.IGNORECASE
    ),
    "chassis_number": re.compile(
        r"^[A-HJ-NPR-Z0-9]{17}$",
        re.IGNORECASE
    ),
    "aadhaar_number": re.compile(
        r"^[2-9]{1}[0-9]{11}$"
    ),
    "cin_number": re.compile(
        r"^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$",
        re.IGNORECASE
    ),
    "din_number": re.compile(
        r"^[0-9]{8}$"
    ),
}

# Also check column HEADER names as a secondary signal
# (used to break ties when multiple columns match the same pattern)
HEADER_HINTS = {
    "rc_number":      ["rc", "reg", "registration", "vehicle", "veh"],
    "pan_number":     ["pan", "permanent account"],
    "gst_number":     ["gst", "gstin", "gstn"],
    "chassis_number": ["chassis", "vin", "frame"],
    "aadhaar_number": ["aadhaar", "aadhar", "uid", "uidai"],
    "cin_number":     ["cin", "company identification"],
    "din_number":     ["din", "director"],
}


def _clean_value(val) -> str:
    """Strip spaces and convert to string for matching."""
    if pd.isna(val):
        return ""
    return str(val).strip().replace(" ", "").replace("-", "").upper()


def _score_column(series: pd.Series, pattern: re.Pattern) -> float:
    """
    Returns match rate (0.0 to 1.0) of a pattern against
    the first 20 non-null values in a column.
    """
    sample = series.dropna().head(20)
    if len(sample) == 0:
        return 0.0
    matches = sum(1 for v in sample if pattern.match(_clean_value(v)))
    return matches / len(sample)


def _header_hint_score(header: str, identifier_type: str) -> float:
    """Returns 0.3 bonus if the column header contains a known hint word."""
    header_lower = header.lower()
    hints = HEADER_HINTS.get(identifier_type, [])
    return 0.3 if any(h in header_lower for h in hints) else 0.0


def detect_columns(file_path: str | Path, threshold: float = 0.6) -> dict:
    """
    Main function — detects identifier columns in an Excel or CSV file.

    Parameters
    ----------
    file_path : str or Path
        Path to the input .xlsx, .xls, or .csv file.
    threshold : float
        Minimum combined score (pattern match rate + header hint)
        required to assign a column. Default 0.6 = 60% of sampled
        values must match the pattern.

    Returns
    -------
    dict
        Keys are identifier types (e.g. "rc_number", "pan_number").
        Values are the matched column header name, or None if not found.

    Example
    -------
    {
        "rc_number":      "Vehicle Reg No",
        "pan_number":     "PAN",
        "gst_number":     None,
        "chassis_number": None,
        "aadhaar_number": None,
        "cin_number":     None,
        "din_number":     None,
    }
    """
    file_path = Path(file_path)
    log.info(f"Reading file: {file_path.name}")

    # ── Load file ─────────────────────────────────────────────
    if not file_path.exists():
        raise FileNotFoundError(f"Input file not found: {file_path}")

    suffix = file_path.suffix.lower()
    if suffix in (".xlsx", ".xls"):
        df = pd.read_excel(file_path, dtype=str)
    elif suffix == ".csv":
        df = pd.read_csv(file_path, dtype=str)
    else:
        raise ValueError(f"Unsupported file type: {suffix}  (use .xlsx, .xls, or .csv)")

    log.info(f"Loaded {len(df)} rows × {len(df.columns)} columns")
    log.debug(f"Column headers found: {list(df.columns)}")

    # ── Score every column against every pattern ──────────────
    # scores[identifier_type][column_header] = combined_score
    scores: dict[str, dict[str, float]] = {k: {} for k in PATTERNS}

    for col in df.columns:
        for id_type, pattern in PATTERNS.items():
            pattern_score = _score_column(df[col], pattern)
            header_score  = _header_hint_score(col, id_type)
            combined      = pattern_score + header_score
            scores[id_type][col] = combined
            if combined > 0:
                log.debug(f"  [{id_type}] col='{col}' pattern={pattern_score:.2f} header={header_score:.2f} total={combined:.2f}")

    # ── Pick best column per identifier type ──────────────────
    result: dict[str, str | None] = {}
    assigned_columns: set[str] = set()  # prevent same column being assigned twice

    for id_type in PATTERNS:
        col_scores = scores[id_type]
        # Sort by score descending, skip already-assigned columns
        candidates = sorted(
            ((col, sc) for col, sc in col_scores.items() if col not in assigned_columns),
            key=lambda x: x[1],
            reverse=True,
        )

        if candidates and candidates[0][1] >= threshold:
            best_col, best_score = candidates[0]
            result[id_type] = best_col
            assigned_columns.add(best_col)
            log.info(f"  ✅  {id_type:20s} → '{best_col}'  (score: {best_score:.2f})")
        else:
            result[id_type] = None
            log.info(f"  ➖  {id_type:20s} → not found")

    detected_count = sum(1 for v in result.values() if v is not None)
    log.info(f"Detection complete — {detected_count}/{len(PATTERNS)} identifier types found")

    return result


def load_dataframe(file_path: str | Path) -> pd.DataFrame:
    """
    Helper — loads an Excel or CSV file into a DataFrame.
    Called by the dispatcher after column detection.
    """
    file_path = Path(file_path)
    suffix = file_path.suffix.lower()
    if suffix in (".xlsx", ".xls"):
        return pd.read_excel(file_path, dtype=str)
    elif suffix == ".csv":
        return pd.read_csv(file_path, dtype=str)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")


# ── Quick test — run this file directly to test detection ─────
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m src.utils.column_detector <path_to_file>")
        sys.exit(1)

    path = sys.argv[1]
    print(f"\nDetecting columns in: {path}\n")
    detected = detect_columns(path)
    print("\nResult:")
    for id_type, col in detected.items():
        status = f"→  '{col}'" if col else "→  NOT FOUND"
        print(f"  {id_type:20s} {status}")