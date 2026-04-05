"""
test_provider.py
─────────────────
Quick smoke-test for the provider layer — runs without pytest.
Exercises all response paths: success, invalid, server error, empty.

Usage:
    python test_provider.py
    DEMO_MODE=false python test_provider.py  # test RealProvider stub
"""

from dotenv import load_dotenv
load_dotenv()

from providers.factory import get_provider

provider = get_provider()
print(f"\nProvider: {type(provider).__name__}\n{'─' * 50}")

test_records = [
    {"identifier": "AABCP1234C", "workflow": "pan_verify",  "payload": {}},  # 200
    {"identifier": "MH12AB1234", "workflow": "rc_verify",   "payload": {}},  # 200
    {"identifier": "INVALID99",  "workflow": "pan_verify",  "payload": {}},  # 422
    {"identifier": "TIMEOUT00",  "workflow": "rc_verify",   "payload": {}},  # 500
    {"identifier": "",           "workflow": "pan_verify",  "payload": {}},  # 400
]

for record in test_records:
    response = provider.enrich(record)
    ident    = record["identifier"] or "(empty)"
    status   = response.get("status")
    code     = response.get("status_code")
    message  = response.get("message")
    print(f"  [{code}] {ident:<18}  status={status:<8}  {message}")

print()