"""
providers/mock_provider.py
──────────────────────────
Demo provider — simulates realistic API behaviour with zero external calls.
Active by default when DEMO_MODE=true (the project default).

Simulation rules:
    • Empty identifier          → 400 Bad Request
    • Contains "INVALID" or ends with "99"  → 422 Unprocessable Entity
    • Contains "ERROR"  or ends with "00"   → 500 Server Error
    • Anything else             → 200 Success
"""

from typing import Dict

from .base import BaseProvider
from utils.logger import get_logger

logger = get_logger(__name__)


class MockProvider(BaseProvider):
    """
    Offline mock provider for local development and CI.
    Produces deterministic, realistic responses without any network calls.
    """

    def enrich(self, record: Dict) -> Dict:
        identifier = record.get("identifier")
        workflow   = record.get("workflow", "")
        payload    = record.get("payload", {})

        normalized = str(identifier or "").strip().upper()

        logger.info(
            "Enriching | identifier=%-20s workflow=%s",
            normalized or "<empty>",
            workflow,
        )

        # ── Validation ────────────────────────────────────────────────────────
        if not normalized:
            logger.warning("Rejected — empty identifier")
            return self._build_response(
                400, "error",
                "Identifier is required",
                error="empty_identifier",
            )

        if "INVALID" in normalized or normalized.endswith("99"):
            logger.warning("Rejected — invalid identifier format: %s", normalized)
            return self._build_response(
                422, "error",
                "Invalid identifier format",
                error="invalid_identifier",
                data={
                    "identifier":   normalized,
                    "workflow":     workflow,
                    "payload_echo": payload,
                },
            )

        if "ERROR" in normalized or normalized.endswith("00"):
            logger.error("Mock server error triggered for identifier: %s", normalized)
            return self._build_response(
                500, "error",
                "Mock internal server error",
                error="mock_server_error",
            )

        # ── Success ───────────────────────────────────────────────────────────
        result = self._build_response(
            200, "success",
            "Record verified successfully",
            data={
                "identifier": normalized,
                "workflow":   workflow,
                "status":     "verified",
                "provider":   "mock",
                "payload_echo": payload,
            },
        )
        logger.info("Success  | identifier=%s", normalized)
        return result