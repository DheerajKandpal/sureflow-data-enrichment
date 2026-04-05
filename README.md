# SureFlow — Batch Identity Verification Pipeline

> **A production-grade data engineering pipeline that batch-processes identity verification records through a pluggable provider layer — fully runnable offline in demo mode.**

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Demo Mode](https://img.shields.io/badge/Demo-No%20Credentials%20Required-brightgreen)](#demo-mode)

---

## Problem Statement

Organisations that process large volumes of identity documents (PAN cards, RC numbers, GST certificates) need a reliable, observable, and scalable batch pipeline that can:

- Ingest records from CSV files
- Verify each record against an external KYC provider API
- Handle failures gracefully (validation errors, rate limits, server errors)
- Produce clean, auditable output CSVs with per-record outcomes
- **Work offline during development and CI without any real API credentials**

SureFlow solves all of this with a pluggable provider architecture and a built-in demo mode.

---

## Features

| Feature | Detail |
|---------|--------|
| 🔌 **Pluggable provider layer** | Swap Mock ↔ Real provider with a single env variable |
| 📊 **CSV batch processing** | Reads any CSV, enriches each row, writes a timestamped output |
| 🟢 **Zero-credential demo** | Fully functional offline. No API keys needed for `DEMO_MODE=true` |
| 📋 **Structured logging** | Every record logged to `stdout` + `logs/app.log` |
| 🛡️ **Consistent response schema** | All providers emit identical `{status, status_code, message, error, data}` |
| 🌐 **FastAPI REST backend** | Full API server with job management and async worker |
| 🔐 **Auth & RBAC** | Role-based access control, optional Google Sign-In |
| 💾 **SQLite / PostgreSQL** | Single-file DB for dev, PostgreSQL-ready for production |

---

## Architecture

```
phase1-project/
├── providers/                   # 🔌 Provider layer (core abstraction)
│   ├── base.py                  #    BaseProvider — abstract contract + _build_response()
│   ├── mock_provider.py         #    MockProvider  — offline demo, no credentials
│   ├── real_provider.py         #    RealProvider  — stub, ready for live API integration
│   ├── factory.py               #    get_provider() — DEMO_MODE switch
│   └── __init__.py
│
├── utils/
│   └── logger.py                # 📋 Centralised logging (stdout + file)
│
├── server/
│   ├── main.py                  # 🌐 FastAPI application + REST endpoints
│   └── worker.py                # ⚙️  Async batch worker
│
├── src/
│   ├── api/surepass_client.py   #    External API HTTP client
│   ├── db/                      #    Database helpers (SQLite / PostgreSQL)
│   ├── models/                  #    Pydantic data models
│   └── utils/                   #    Shared helpers
│
├── inputs/
│   └── sample.csv               # 📥 Sample test records (5 cases)
│
├── outputs/                     # 📤 Generated output CSVs (gitignored)
├── logs/                        # 📋 app.log (gitignored)
│
├── run_demo.py                  # 🚀 Demo pipeline runner — START HERE
├── test_provider.py             # 🧪 Quick smoke test
├── .env.example                 # 🔑 Environment template (safe to commit)
└── requirements.txt
```

### Provider Flow

```
run_demo.py
    └── get_provider()           # reads DEMO_MODE from .env
            ├── DEMO_MODE=true  → MockProvider  (offline, deterministic)
            └── DEMO_MODE=false → RealProvider  (live API, needs token)
                    └── enrich(record) → { status, status_code, message, error, data }
```

### Standardised Response Schema

Every provider — regardless of type — returns:

```json
{
    "status":      "success | error",
    "status_code": 200,
    "message":     "Record verified successfully",
    "error":       null,
    "data": {
        "identifier": "AABCP1234C",
        "workflow":   "pan_verify",
        "status":     "verified",
        "provider":   "mock"
    }
}
```

---

## Quick Start

### 1 — Clone and install

```bash
git clone https://github.com/your-username/sureflow.git
cd sureflow/phase1-project

pip install -r requirements.txt
```

### 2 — Configure environment

```bash
cp .env.example .env
# DEMO_MODE=true is already set — no further changes needed for the demo
```

### 3 — Run the demo pipeline

```bash
python run_demo.py
```

**Expected output:**
```
══════════════════════════════════════════════════════════════
  SureFlow Demo Pipeline
══════════════════════════════════════════════════════════════
  Provider  : MockProvider
  Records   : 5
────────────────────────────────────────────────────────────
  IDENTIFIER           STATUS     CODE   MESSAGE
────────────────────────────────────────────────────────────
  AABCP1234C           success    200    Record verified successfully
  MH12AB1234           success    200    Record verified successfully
  INVALID99            error      422    Invalid identifier format
  TIMEOUT00            error      500    Mock internal server error
  (empty)              error      400    Identifier is required

══════════════════════════════════════════════════════════════
  Summary
────────────────────────────────────────────────────────────
  Provider               MockProvider
  Total records          5
  ✓ Success              2
  ✗ Failed               3
  Output CSV             outputs/demo_output_20260405_194500.csv
══════════════════════════════════════════════════════════════
```

---

## Demo Mode

SureFlow ships with `DEMO_MODE=true` by default.

| Mode | Provider | Credentials needed | Behaviour |
|------|----------|--------------------|-----------|
| `DEMO_MODE=true` | `MockProvider` | ❌ None | Deterministic offline responses |
| `DEMO_MODE=false` | `RealProvider` | ✅ Surepass token | Live API (stub until token supplied) |

### Mock simulation rules

| Input Pattern | HTTP Code | Outcome |
|--------------|-----------|---------|
| Contains `INVALID` or ends with `99` | 422 | Invalid identifier |
| Contains `ERROR` or ends with `00` | 500 | Server error |
| Empty string | 400 | Missing identifier |
| Anything else | 200 | ✅ Verified successfully |

---

## Sample Input / Output

### `inputs/sample.csv`

| identifier | workflow | payload_note |
|-----------|---------|--------------|
| AABCP1234C | pan_verify | Standard PAN card |
| MH12AB1234 | rc_verify | Vehicle RC number |
| INVALID99 | pan_verify | Triggers 422 |
| TIMEOUT00 | rc_verify | Triggers 500 |
| _(empty)_ | pan_verify | Triggers 400 |

### `outputs/demo_output_*.csv`

| identifier | workflow | status | status_code | message | error | data_json |
|-----------|---------|--------|-------------|---------|-------|-----------|
| AABCP1234C | pan_verify | success | 200 | Record verified… | | `{"identifier":"AABCP1234C"...}` |
| MH12AB1234 | rc_verify | success | 200 | Record verified… | | `{"identifier":"MH12AB1234"...}` |
| INVALID99 | pan_verify | error | 422 | Invalid identifier format | invalid_identifier | |
| TIMEOUT00 | rc_verify | error | 500 | Mock internal server error | mock_server_error | |
| | pan_verify | error | 400 | Identifier is required | empty_identifier | |

---

## Running the Full Server

```bash
# Start the FastAPI backend
uvicorn server.main:app --reload --host 127.0.0.1 --port 8000

# Health check
curl http://127.0.0.1:8000/api/health
```

---

## Connecting a Real Provider

1. Set `DEMO_MODE=false` in `.env`
2. Set `SUREPASS_PRIMARY_TOKEN=<your_jwt>` in `.env`
3. Open `providers/real_provider.py` and replace the stub body with the commented-out `httpx` call

No other file changes required — the provider interface is the only contract.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.11 |
| API Framework | FastAPI + Uvicorn |
| Data Processing | pandas, csv (stdlib) |
| HTTP Client | httpx |
| Validation | pydantic v2 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Logging | Python stdlib `logging` |
| Environment | python-dotenv |

---

## Security Notes

- `.env` is **gitignored** — never committed
- `.env.example` is the safe, token-free template for onboarding
- `inputs/` is **gitignored** except `inputs/sample.csv` — real client data never enters the repo
- `outputs/` and `logs/` are gitignored — only artefacts, never source data
- All tokens are read from environment variables at runtime — zero hardcoded secrets

---

## Repo Size Considerations

| Path | Status | Reason |
|------|--------|--------|
| `inputs/*.csv` (except sample) | ✅ Gitignored | Multi-MB real client data |
| `outputs/` | ✅ Gitignored | Generated; reproducible |
| `logs/` | ✅ Gitignored | Ephemeral |
| `node_modules/` | ✅ Gitignored | Regenerable via npm |
| `venv/`, `.venv/` | ✅ Gitignored | Regenerable via pip |
| `*.db` | ✅ Gitignored | Local state |
| `inputs/sample.csv` | ✅ Committed | 5 rows, <1 KB |

Expected committed repo size: **< 500 KB**

---

## Sensitive Data Exposure Risks — Mitigated

| Risk | Mitigation |
|------|-----------|
| API token in `.env` | `.env` gitignored; `.env.example` has placeholder only |
| Real client PAN/RC data in `inputs/` | `inputs/*` gitignored; only `sample.csv` committed |
| Surepass JWT in code | Never hardcoded; always `os.getenv()` |
| Response data in `outputs/` | `outputs/` gitignored |

---

*Built as a production-ready data engineering portfolio project demonstrating clean architecture, modular design, and real-world pipeline thinking.*
