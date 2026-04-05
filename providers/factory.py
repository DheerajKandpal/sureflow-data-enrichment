import os
from .mock_provider import MockProvider
from .real_provider import RealProvider


def get_provider():
    demo_mode = os.getenv("DEMO_MODE", "true").lower() == "true"

    if demo_mode:
        return MockProvider()
    return RealProvider()