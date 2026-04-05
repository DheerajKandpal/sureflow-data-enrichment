"""
providers/real_provider.py
──────────────────────────
Production provider stub — ready for live HTTP API integration.

To connect to a real external API:
    1. Set DEMO_MODE=false in .env
    2. Set SUREPASS_PRIMARY_TOKEN=<your_token> in .env
    3. Replace the stub body in enrich() with actual httpx/requests calls

The response schema is identical to MockProvider so the rest of the
pipeline never needs to know which provider is active.
"""

import os
from typing import Dict

from .base import BaseProvider
from utils.logger import get_logger

logger = get_logger(__name__)


class RealProvider(BaseProvider):
    """
    Live production provider.
    Connects to an external verification API when credentials are supplied.

    Currently a structured stub — swap in real HTTP calls when ready.
    All outbound calls should use the token from env, never hardcode credentials.
    """

    def enrich(self, record: Dict) -> Dict:
        identifier = record.get("identifier")
        workflow   = record.get("workflow", "")
        payload    = record.get("payload", {})

        normalized = str(identifier or "").strip().upper()

        logger.info(
            "RealProvider enriching | identifier=%-20s workflow=%s",
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

        # ── TODO: Replace stub below with real API call ───────────────────────
        #
        # import httpx
        # token = os.getenv("SUREPASS_PRIMARY_TOKEN")
        # url   = f"https://kyc-api.surepass.io/api/v1/{workflow}"
        # resp  = httpx.post(url,
        #             headers={"Authorization": f"Bearer {token}"},
        #             json={"id_number": normalized, **payload},
        #             timeout=30)
        # body  = resp.json()
        # if resp.status_code == 200 and body.get("success"):
        #     return self._build_response(200, "success", "Verified", data=body["data"])
        # return self._build_response(resp.status_code, "error",
        #                             body.get("message", "API error"),
        #                             error=body.get("message_code"))
        # ─────────────────────────────────────────────────────────────────────

        result = self._build_response(
            200, "success",
            "Record verified successfully (stub)",
            data={
                "identifier": normalized,
                "workflow":   workflow,
                "status":     "verified",
                "provider":   "real",
                "payload_echo": payload,
            },
        )
        logger.info("Success  | identifier=%s", normalized)
        return result
