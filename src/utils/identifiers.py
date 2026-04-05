import re


LLP_PATTERN = re.compile(r"^[A-Z]{3}[0-9]{4}$")
CIN_PATTERN = re.compile(r"^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$")

DEFAULT_IDENTIFIER_PATTERNS: dict[str, re.Pattern] = {
    "pan_number": re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"),
    "rc_number": re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"),
    "gst_number": re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"),
    "chassis_number": re.compile(r"^[A-HJ-NPR-Z0-9]{17}$"),
    "aadhaar_number": re.compile(r"^[2-9]{1}[0-9]{11}$"),
    "cin_number": re.compile(rf"^(?:{CIN_PATTERN.pattern[1:-1]}|{LLP_PATTERN.pattern[1:-1]})$"),
    "din_number": re.compile(r"^[0-9]{8}$"),
    "mobile_number": re.compile(r"^[6-9][0-9]{9}$"),
    "driving_licence": re.compile(r"^[A-Z]{2}[0-9]{13}$"),
    "passport_number": re.compile(r"^[A-Z]{1}[0-9]{7}$"),
    "voter_id": re.compile(r"^[A-Z]{3}[0-9]{7}$"),
    "bank_account": re.compile(r"^[0-9]{9,18}$"),
}


def get_identifier_pattern(identifier_type: str, config: dict | None = None) -> re.Pattern | None:
    if config:
        cfg = (config.get("identifier_patterns") or {}).get(identifier_type)
        if cfg and cfg.get("regex"):
            try:
                return re.compile(cfg["regex"], re.IGNORECASE)
            except re.error:
                return None
    return DEFAULT_IDENTIFIER_PATTERNS.get(identifier_type)


IDENTIFIER_PATTERNS = DEFAULT_IDENTIFIER_PATTERNS


def normalize_identifier(identifier_type: str, raw_value) -> str:
    value = "" if raw_value is None else str(raw_value).strip().upper()
    value = value.replace(" ", "").replace("-", "")

    if identifier_type == "din_number" and value.isdigit():
        return value.zfill(8)

    return value


def matches_identifier(identifier_type: str, raw_value, config: dict | None = None) -> tuple[str, bool]:
    normalized = normalize_identifier(identifier_type, raw_value)
    pattern = get_identifier_pattern(identifier_type, config=config)
    if not pattern:
        return normalized, False
    return normalized, bool(pattern.match(normalized))
