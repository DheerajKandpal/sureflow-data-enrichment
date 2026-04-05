"""
utils/logger.py
───────────────
Centralised logging factory for SureFlow.

Usage:
    from utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info("Processing record: %s", identifier)

Configuration:
    Set LOG_LEVEL in .env (DEBUG | INFO | WARNING | ERROR).
    Logs are written to both stdout and logs/app.log.
"""

import logging
import os
from pathlib import Path

_configured: set[str] = set()


def get_logger(name: str) -> logging.Logger:
    """
    Return a named logger with stream + rotating file handlers.
    Safe to call multiple times — handlers are only attached once per name.
    """
    logger = logging.getLogger(name)

    if name in _configured:
        return logger

    _configured.add(name)

    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    numeric_level = getattr(logging, log_level_str, logging.INFO)
    logger.setLevel(numeric_level)

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)-28s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # ── stdout handler ────────────────────────────────────────────────────────
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(fmt)
    logger.addHandler(stream_handler)

    # ── file handler (logs/app.log) ───────────────────────────────────────────
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    file_handler = logging.FileHandler(log_dir / "app.log", encoding="utf-8")
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    # Prevent messages bubbling up to the root logger (avoids duplicates)
    logger.propagate = False

    return logger
