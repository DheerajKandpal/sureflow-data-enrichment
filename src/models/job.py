"""
Job data model for SureFlow batch processing.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class JobResult:
    """Represents the result of a single API call for one identifier."""
    identifier:    Optional[str]
    status_code:   Optional[int]
    outcome:       str   # success | saved_422 | already_exists | skipped | failed | dead_letter | invalid_format
    response:      Optional[dict] = None
    response_path: Optional[str]  = None
    error:         Optional[str]  = None
