"""
providers/base.py
─────────────────
Abstract base class for all SureFlow data enrichment providers.

Every provider — mock or real — must implement the enrich() method.
The contract guarantees a consistent flat response schema so consumers
never need to special-case provider types.

Response schema (guaranteed by all providers):
    {
        "status":      "success" | "error",
        "status_code": int,          # mirrors HTTP semantics (200, 400, 422, 500…)
        "message":     str,          # human-readable outcome description
        "error":       str | None,   # machine-readable error code, None on success
        "data":        dict | None,  # enriched payload, None on error
    }
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional


class BaseProvider(ABC):
    """
    Abstract provider interface.

    Subclass this and implement `enrich()` to plug in any data source
    — mock, REST API, database, or message queue consumer.
    """

    @abstractmethod
    def enrich(self, record: Dict) -> Dict:
        """
        Enrich a single record and return a standardised response dict.

        Args:
            record: Input dict with at minimum:
                        - "identifier" (str): the primary lookup key
                        - "workflow"   (str): the API/workflow name
                        - "payload"    (dict): optional additional data

        Returns:
            A dict conforming to the SureFlow response schema (see module docstring).
        """

    # ── Shared helper ─────────────────────────────────────────────────────────

    def _build_response(
        self,
        status_code: int,
        status: str,
        message: str,
        error: Optional[str] = None,
        data: Optional[Dict] = None,
    ) -> Dict:
        """
        Build a standardised response dict.  Call this from subclass enrich()
        rather than constructing the dict manually.
        """
        return {
            "status":      status,
            "status_code": status_code,
            "message":     message,
            "error":       error,
            "data":        data,
        }