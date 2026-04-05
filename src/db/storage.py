import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from src.utils.logger import get_logger

log = get_logger(__name__)

ROOT = Path(__file__).resolve().parents[2]
JOBS_DB_PATH = ROOT / "data" / "jobs.db"


def _load_env_if_present():
    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env", override=False)
    except Exception:
        pass


def get_database_url() -> str:
    _load_env_if_present()
    return os.getenv("DATABASE_URL", "").strip()


def using_postgres() -> bool:
    url = get_database_url().lower()
    return url.startswith("postgres://") or url.startswith("postgresql://")


def _connect_sqlite() -> sqlite3.Connection:
    JOBS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(JOBS_DB_PATH), timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def _connect_postgres():
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise RuntimeError(
            "DATABASE_URL is set for PostgreSQL, but 'psycopg' is not installed. "
            "Run 'poetry install' after pulling the latest dependencies."
        ) from exc

    return psycopg.connect(
        get_database_url(),
        row_factory=dict_row,
        connect_timeout=10,
        application_name="sureflow",
    )


@contextmanager
def get_connection():
    conn = _connect_postgres() if using_postgres() else _connect_sqlite()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _fetchall(conn, sql: str, params: tuple = ()):
    cur = conn.execute(sql, params)
    return cur.fetchall()


def _execute(conn, sql: str, params: tuple = ()):
    conn.execute(sql, params)


def _executemany(conn, sql: str, rows: list[tuple]):
    conn.executemany(sql, rows)


def _param_placeholder() -> str:
    return "%s" if using_postgres() else "?"


def _table_columns(conn, table_name: str) -> list[str]:
    if using_postgres():
        rows = _fetchall(
            conn,
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table_name,),
        )
        return [row["column_name"] for row in rows]

    rows = _fetchall(conn, f"PRAGMA table_info({table_name})")
    return [row["name"] for row in rows]


def ensure_jobs_table(job_columns: list[str], int_fields: set[str]):
    with get_connection() as conn:
        expected = set(job_columns)
        existing = set(_table_columns(conn, "jobs"))

        if existing and ("job_id" not in existing or not expected.issubset(existing)):
            legacy_name = f"jobs_legacy_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            _execute(conn, f"ALTER TABLE jobs RENAME TO {legacy_name}")

        col_defs = ", ".join(
            f"{col} INTEGER" if col in int_fields else f"{col} TEXT"
            for col in job_columns
        )
        _execute(conn, f"CREATE TABLE IF NOT EXISTS jobs ({col_defs}, PRIMARY KEY (job_id))")

        existing = set(_table_columns(conn, "jobs"))
        for col in job_columns:
            if col in existing:
                continue
            typ = "INTEGER" if col in int_fields else "TEXT"
            default_clause = " DEFAULT 0" if typ == "INTEGER" else ""
            _execute(conn, f"ALTER TABLE jobs ADD COLUMN {col} {typ}{default_clause}")


def upsert_job(job: dict, job_columns: list[str]):
    placeholders = ", ".join(_param_placeholder() for _ in job_columns)
    cols = ", ".join(job_columns)
    values = tuple(job.get(col) for col in job_columns)

    with get_connection() as conn:
        if using_postgres():
            updates = ", ".join(f"{col} = EXCLUDED.{col}" for col in job_columns if col != "job_id")
            _execute(
                conn,
                f"INSERT INTO jobs ({cols}) VALUES ({placeholders}) "
                f"ON CONFLICT (job_id) DO UPDATE SET {updates}",
                values,
            )
        else:
            _execute(conn, f"INSERT OR REPLACE INTO jobs ({cols}) VALUES ({placeholders})", values)


def load_jobs(job_columns: list[str], int_fields: set[str]) -> list[dict]:
    with get_connection() as conn:
        rows = _fetchall(conn, "SELECT * FROM jobs ORDER BY started_at ASC")

    result = []
    for row in rows:
        job = dict(row)
        for field in int_fields:
            job[field] = int(job[field]) if job.get(field) is not None else 0
        result.append(job)
    return result


def mark_interrupted_jobs():
    with get_connection() as conn:
        placeholder = _param_placeholder()
        _execute(
            conn,
            f"UPDATE jobs SET status = {placeholder}, pause_reason = {placeholder} "
            f"WHERE status IN ({placeholder}, {placeholder}, {placeholder})",
            ("paused", "server_restart", "running", "processing", "pending"),
        )


def init_results_db():
    with get_connection() as conn:
        if using_postgres():
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS job_runs (
                    id BIGSERIAL PRIMARY KEY,
                    batch_id TEXT,
                    identifier TEXT,
                    workflow TEXT,
                    status_code INTEGER,
                    outcome TEXT,
                    response_path TEXT,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
            )
        else:
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS job_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id TEXT,
                    identifier TEXT,
                    workflow TEXT,
                    status_code INTEGER,
                    outcome TEXT,
                    response_path TEXT,
                    error TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                )
                """,
            )


def log_job_runs(rows: list[tuple]):
    if not rows:
        return

    placeholder = _param_placeholder()
    values = ", ".join(placeholder for _ in range(7))
    sql = (
        "INSERT INTO job_runs "
        "(batch_id, identifier, workflow, status_code, outcome, response_path, error) "
        f"VALUES ({values})"
    )

    with get_connection() as conn:
        _executemany(conn, sql, rows)
