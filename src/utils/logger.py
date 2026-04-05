"""
Centralised logger — import and use anywhere in the project.

Usage:
    from src.utils.logger import get_logger
    log = get_logger(__name__)
    log.info("Hello")
"""

import logging
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
try:
    LOG_DIR.mkdir(exist_ok=True)
except OSError:
    pass


def get_logger(name: str = "phase1") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)

        fmt = logging.Formatter(
            "[%(asctime)s] %(levelname)-8s %(name)s — %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        # Console handler
        ch = logging.StreamHandler()
        ch.setFormatter(fmt)
        logger.addHandler(ch)

        try:
            fh = logging.FileHandler(LOG_DIR / "app.log", encoding="utf-8")
            fh.setFormatter(fmt)
            logger.addHandler(fh)
        except OSError:
            # Fall back to console-only logging when the filesystem is read-only.
            pass

    return logger
