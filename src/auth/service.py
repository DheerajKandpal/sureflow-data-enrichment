import base64
import csv
import hashlib
import hmac
import json
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path

import yaml

from src.db.storage import get_connection, using_postgres

ROOT = Path(__file__).resolve().parents[2]
AUTH_SETTINGS_PATH = ROOT / "auth_settings.yaml"
AUTH_COOKIE_NAME = "sureflow_session"
GOOGLE_STATE_COOKIE_NAME = "sureflow_google_state"
SESSION_HOURS = 12
REMEMBER_ME_DAYS = 30
PASSWORD_ITERATIONS = 240000
ROLE_ORDER = {
    "viewer": 1,
    "operator": 2,
    "admin": 3,
    "owner": 4,
}

PERMISSIONS = {
    "dashboard.view": ("View dashboard", "See workspace and summary pages."),
    "jobs.view": ("View jobs", "View job monitor, history, and results."),
    "jobs.run": ("Run jobs", "Upload files and start batch jobs."),
    "jobs.manage": ("Manage jobs", "Pause, resume, and reschedule jobs."),
    "results.download": ("Download results", "Download generated CSV outputs."),
    "manual_lab.run": ("Use manual lab", "Run single-input and sample API tests."),
    "config.manage": ("Manage config", "Create tokens, APIs, workflows, and identifier settings."),
    "control.view": ("View control tower", "Open the owner control page."),
    "users.manage": ("Manage users", "Create users, reset passwords, and assign roles."),
    "audit.view": ("View audit logs", "Inspect activity history and security events."),
    "api.permissions.manage": ("Manage API policies", "Grant, revoke, or restrict API execution access."),
}

ROLE_PERMISSIONS = {
    "viewer": {
        "dashboard.view",
        "jobs.view",
    },
    "operator": {
        "dashboard.view",
        "jobs.view",
        "jobs.run",
        "jobs.manage",
        "results.download",
        "manual_lab.run",
    },
    "admin": {
        "dashboard.view",
        "jobs.view",
        "jobs.run",
        "jobs.manage",
        "results.download",
        "manual_lab.run",
        "config.manage",
        "audit.view",
    },
    "owner": set(PERMISSIONS.keys()),
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_text() -> str:
    return utc_now().isoformat()


def _placeholder() -> str:
    return "%s" if using_postgres() else "?"


def _fetchone(conn, sql: str, params: tuple = ()):
    cur = conn.execute(sql, params)
    return cur.fetchone()


def _fetchall(conn, sql: str, params: tuple = ()):
    cur = conn.execute(sql, params)
    return cur.fetchall()


def _execute(conn, sql: str, params: tuple = ()):
    conn.execute(sql, params)


def _default_auth_settings() -> dict:
    return {
        "master_account": {
            "username": "master-owner",
            "full_name": "SureFlow Master",
            "password": "CHANGE_ME_NOW",
        },
        "user_defaults": {
            "primary_login": "email",
            "username_optional": True,
            "store_users_in_file": True,
            "self_signup_enabled": False,
            "access_request_enabled": True,
        },
        "managed_users": [],
    }


def load_auth_settings() -> dict:
    if not AUTH_SETTINGS_PATH.exists():
        settings = _default_auth_settings()
        save_auth_settings(settings)
        return settings
    with open(AUTH_SETTINGS_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    settings = _default_auth_settings()
    for key, value in data.items():
        if isinstance(value, dict) and isinstance(settings.get(key), dict):
            settings[key].update(value)
        else:
            settings[key] = value
    settings.setdefault("managed_users", [])
    return settings


def save_auth_settings(settings: dict):
    with open(AUTH_SETTINGS_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(settings, f, sort_keys=False, allow_unicode=True)


def _table_columns(conn, table_name: str) -> set[str]:
    if using_postgres():
        rows = _fetchall(
            conn,
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table_name,),
        )
        return {row["column_name"] for row in rows}
    rows = _fetchall(conn, f"PRAGMA table_info({table_name})")
    return {row["name"] for row in rows}


def _hash_password(password: str, salt: bytes | None = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"{PASSWORD_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        iterations_text, salt_text, digest_text = password_hash.split("$", 2)
        iterations = int(iterations_text)
        salt = base64.b64decode(salt_text.encode())
        expected = base64.b64decode(digest_text.encode())
    except Exception:
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def ensure_auth_tables():
    with get_connection() as conn:
        if using_postgres():
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    last_login_at TIMESTAMP
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    last_seen_at TIMESTAMP NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    revoked_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS permissions (
                    code TEXT PRIMARY KEY,
                    label TEXT NOT NULL,
                    description TEXT NOT NULL
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS role_permissions (
                    role TEXT NOT NULL,
                    permission_code TEXT NOT NULL,
                    PRIMARY KEY (role, permission_code)
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS user_permissions (
                    user_id TEXT NOT NULL,
                    permission_code TEXT NOT NULL,
                    allowed INTEGER NOT NULL,
                    PRIMARY KEY (user_id, permission_code)
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS api_policies (
                    api_name TEXT PRIMARY KEY,
                    access_level TEXT NOT NULL DEFAULT 'operator',
                    enabled INTEGER NOT NULL DEFAULT 1,
                    updated_at TIMESTAMP NOT NULL
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS user_api_access (
                    user_id TEXT NOT NULL,
                    api_name TEXT NOT NULL,
                    allowed INTEGER NOT NULL,
                    PRIMARY KEY (user_id, api_name)
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id BIGSERIAL PRIMARY KEY,
                    created_at TIMESTAMP NOT NULL,
                    user_id TEXT,
                    username TEXT,
                    session_id TEXT,
                    action TEXT NOT NULL,
                    target_type TEXT,
                    target_id TEXT,
                    status TEXT NOT NULL,
                    path TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    details_json TEXT
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS access_requests (
                    request_id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    requested_username TEXT,
                    full_name TEXT NOT NULL,
                    company_name TEXT,
                    note TEXT,
                    status TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    resolved_by_user_id TEXT,
                    resolution_note TEXT
                )
                """,
            )
        else:
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_login_at TEXT
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    revoked_at TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS permissions (
                    code TEXT PRIMARY KEY,
                    label TEXT NOT NULL,
                    description TEXT NOT NULL
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS role_permissions (
                    role TEXT NOT NULL,
                    permission_code TEXT NOT NULL,
                    PRIMARY KEY (role, permission_code)
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS user_permissions (
                    user_id TEXT NOT NULL,
                    permission_code TEXT NOT NULL,
                    allowed INTEGER NOT NULL,
                    PRIMARY KEY (user_id, permission_code)
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS api_policies (
                    api_name TEXT PRIMARY KEY,
                    access_level TEXT NOT NULL DEFAULT 'operator',
                    enabled INTEGER NOT NULL DEFAULT 1,
                    updated_at TEXT NOT NULL
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS user_api_access (
                    user_id TEXT NOT NULL,
                    api_name TEXT NOT NULL,
                    allowed INTEGER NOT NULL,
                    PRIMARY KEY (user_id, api_name)
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    user_id TEXT,
                    username TEXT,
                    session_id TEXT,
                    action TEXT NOT NULL,
                    target_type TEXT,
                    target_id TEXT,
                    status TEXT NOT NULL,
                    path TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    details_json TEXT
                )
                """,
            )
            _execute(
                conn,
                """
                CREATE TABLE IF NOT EXISTS access_requests (
                    request_id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    requested_username TEXT,
                    full_name TEXT NOT NULL,
                    company_name TEXT,
                    note TEXT,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    resolved_by_user_id TEXT,
                    resolution_note TEXT
                )
                """,
            )
        user_columns = _table_columns(conn, "users")
        if "email" not in user_columns:
            _execute(conn, "ALTER TABLE users ADD COLUMN email TEXT")
        if "auth_source" not in user_columns:
            _execute(conn, "ALTER TABLE users ADD COLUMN auth_source TEXT DEFAULT 'local'")
        if "google_sub" not in user_columns:
            _execute(conn, "ALTER TABLE users ADD COLUMN google_sub TEXT")
        if using_postgres():
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)")
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs (action, created_at DESC)")
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_username_created ON audit_logs (username, created_at DESC)")
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)")
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_access_requests_status_created ON access_requests (status, created_at DESC)")
        else:
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)")
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs (action, created_at DESC)")
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_username_created ON audit_logs (username, created_at DESC)")
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)")
            _execute(conn, "CREATE INDEX IF NOT EXISTS idx_access_requests_status_created ON access_requests (status, created_at DESC)")

        for code, (label, description) in PERMISSIONS.items():
            _execute(
                conn,
                f"INSERT {'OR IGNORE' if not using_postgres() else ''} INTO permissions (code, label, description) "
                f"VALUES ({_placeholder()}, {_placeholder()}, {_placeholder()})"
                if not using_postgres()
                else "INSERT INTO permissions (code, label, description) VALUES (%s, %s, %s) ON CONFLICT (code) DO NOTHING",
                (code, label, description),
            )

        for role, permission_codes in ROLE_PERMISSIONS.items():
            for code in permission_codes:
                _execute(
                    conn,
                    f"INSERT {'OR IGNORE' if not using_postgres() else ''} INTO role_permissions (role, permission_code) "
                    f"VALUES ({_placeholder()}, {_placeholder()})"
                    if not using_postgres()
                    else "INSERT INTO role_permissions (role, permission_code) VALUES (%s, %s) ON CONFLICT (role, permission_code) DO NOTHING",
                    (role, code),
                )


def sync_api_policies(config: dict):
    now = utc_now_text()
    with get_connection() as conn:
        for api_name in (config.get("apis") or {}).keys():
            if using_postgres():
                _execute(
                    conn,
                    """
                    INSERT INTO api_policies (api_name, access_level, enabled, updated_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (api_name) DO NOTHING
                    """,
                    (api_name, "operator", 1, now),
                )
            else:
                _execute(
                    conn,
                    "INSERT OR IGNORE INTO api_policies (api_name, access_level, enabled, updated_at) VALUES (?, ?, ?, ?)",
                    (api_name, "operator", 1, now),
                )


def user_count() -> int:
    with get_connection() as conn:
        row = _fetchone(conn, "SELECT COUNT(*) AS n FROM users")
    if not row:
        return 0
    return int(row["n"] if isinstance(row, dict) else row[0])


def bootstrap_owner(username: str, password: str, full_name: str):
    if user_count() > 0:
        raise ValueError("Users already exist.")
    create_user(username=username, password=password, full_name=full_name, role="owner")


def bootstrap_owner_from_env():
    username = os.getenv("SUREFLOW_OWNER_USERNAME", "").strip()
    password = os.getenv("SUREFLOW_OWNER_PASSWORD", "").strip()
    full_name = os.getenv("SUREFLOW_OWNER_NAME", "").strip() or "SureFlow Owner"
    if username and password and user_count() == 0:
        create_user(username=username, password=password, full_name=full_name, role="owner")


def sync_master_access_from_env():
    username = os.getenv("SUREFLOW_MASTER_USERNAME", "").strip()
    password = os.getenv("SUREFLOW_MASTER_PASSWORD", "").strip()
    full_name = os.getenv("SUREFLOW_MASTER_NAME", "").strip() or "SureFlow Master"
    if not username or not password:
        return None
    user = get_user_by_username(username)
    if user:
        update_user(user["user_id"], full_name=full_name, role="owner", is_active=True, password=password)
        user = get_user_by_username(username)
    else:
        user = create_user(username=username, password=password, full_name=full_name, role="owner")
    with get_connection() as conn:
        _execute(
            conn,
            f"UPDATE users SET auth_source = {_placeholder()} WHERE user_id = {_placeholder()}",
            ("master", user["user_id"]),
        )
    sync_users_to_auth_settings()
    return get_user_by_id(user["user_id"])


def sync_master_access_from_file():
    settings = load_auth_settings()
    master = settings.get("master_account") or {}
    username = (master.get("username") or "").strip()
    password = (master.get("password") or "").strip()
    full_name = (master.get("full_name") or "").strip() or "SureFlow Master"
    if not username or not password or password == "CHANGE_ME_NOW":
        return None
    user = get_user_by_username(username)
    if user:
        update_user(user["user_id"], full_name=full_name, role="owner", is_active=True, password=password, auth_source="master")
    else:
        user = create_user(username=username, password=password, full_name=full_name, role="owner", auth_source="master")
    sync_users_to_auth_settings()
    return get_user_by_username(username)


def _user_from_row(row) -> dict | None:
    if not row:
        return None
    user = dict(row)
    user["is_active"] = bool(user.get("is_active", 0))
    user["permissions"] = resolve_permissions(user["user_id"], user["role"])
    return user


def get_user_by_username(username: str) -> dict | None:
    with get_connection() as conn:
        row = _fetchone(
            conn,
            f"SELECT * FROM users WHERE lower(username) = lower({_placeholder()}) OR lower(COALESCE(email, '')) = lower({_placeholder()})",
            (username, username),
        )
    return _user_from_row(row)


def get_user_by_id(user_id: str) -> dict | None:
    with get_connection() as conn:
        row = _fetchone(conn, f"SELECT * FROM users WHERE user_id = {_placeholder()}", (user_id,))
    return _user_from_row(row)


def _normalize_username(username: str | None, email: str | None = None) -> str:
    chosen = (username or "").strip()
    if chosen:
        return chosen
    email_value = (email or "").strip().lower()
    if email_value:
        return email_value
    raise ValueError("Username or email is required.")


def sync_users_to_auth_settings():
    settings = load_auth_settings()
    users = list_users()
    settings["managed_users"] = [
        {
            "username": user.get("username"),
            "email": user.get("email"),
            "full_name": user.get("full_name"),
            "role": user.get("role"),
            "is_active": bool(user.get("is_active")),
            "auth_source": user.get("auth_source") or "local",
        }
        for user in users
    ]
    save_auth_settings(settings)


def access_request_enabled() -> bool:
    settings = load_auth_settings()
    return bool(settings.get("user_defaults", {}).get("access_request_enabled", True))


def create_user(username: str, password: str, full_name: str, role: str = "operator", email: str | None = None, auth_source: str = "local", google_sub: str | None = None) -> dict:
    if role not in ROLE_ORDER:
        raise ValueError("Invalid role.")
    user_id = uuid.uuid4().hex
    now = utc_now_text()
    normalized_email = (email or "").strip().lower() or None
    normalized_username = _normalize_username(username, normalized_email)
    with get_connection() as conn:
        _execute(
            conn,
            f"""
            INSERT INTO users
            (user_id, username, full_name, password_hash, role, is_active, created_at, updated_at, email, auth_source, google_sub)
            VALUES ({_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()})
            """,
            (
                user_id,
                normalized_username,
                full_name.strip() or normalized_username,
                _hash_password(password),
                role,
                1,
                now,
                now,
                normalized_email,
                auth_source,
                google_sub,
            ),
        )
    user = get_user_by_id(user_id)
    sync_users_to_auth_settings()
    return user


def update_user(user_id: str, *, full_name: str | None = None, role: str | None = None, is_active: bool | None = None, password: str | None = None, email: str | None = None, auth_source: str | None = None, google_sub: str | None = None) -> dict:
    updates = []
    params = []
    if full_name is not None:
        updates.append(f"full_name = {_placeholder()}")
        params.append(full_name.strip())
    if role is not None:
        if role not in ROLE_ORDER:
            raise ValueError("Invalid role.")
        updates.append(f"role = {_placeholder()}")
        params.append(role)
    if is_active is not None:
        updates.append(f"is_active = {_placeholder()}")
        params.append(1 if is_active else 0)
    if password:
        updates.append(f"password_hash = {_placeholder()}")
        params.append(_hash_password(password))
    if email is not None:
        updates.append(f"email = {_placeholder()}")
        params.append(email.strip().lower() or None)
    if auth_source is not None:
        updates.append(f"auth_source = {_placeholder()}")
        params.append(auth_source)
    if google_sub is not None:
        updates.append(f"google_sub = {_placeholder()}")
        params.append(google_sub)
    updates.append(f"updated_at = {_placeholder()}")
    params.append(utc_now_text())
    params.append(user_id)
    with get_connection() as conn:
        _execute(conn, f"UPDATE users SET {', '.join(updates)} WHERE user_id = {_placeholder()}", tuple(params))
        if is_active is False:
            _execute(conn, f"UPDATE sessions SET revoked_at = {_placeholder()} WHERE user_id = {_placeholder()} AND revoked_at IS NULL", (utc_now_text(), user_id))
    user = get_user_by_id(user_id)
    sync_users_to_auth_settings()
    return user


def resolve_permissions(user_id: str, role: str) -> list[str]:
    permissions = set(ROLE_PERMISSIONS.get(role, set()))
    with get_connection() as conn:
        rows = _fetchall(conn, f"SELECT permission_code, allowed FROM user_permissions WHERE user_id = {_placeholder()}", (user_id,))
    for row in rows:
        code = row["permission_code"]
        if row["allowed"]:
            permissions.add(code)
        else:
            permissions.discard(code)
    return sorted(permissions)


def create_session(user: dict, ip_address: str | None, user_agent: str | None, remember_me: bool = False) -> dict:
    session_id = secrets.token_urlsafe(32)
    now = utc_now()
    expires = now + timedelta(days=REMEMBER_ME_DAYS if remember_me else 0, hours=SESSION_HOURS if not remember_me else 0)
    with get_connection() as conn:
        _execute(
            conn,
            f"""
            INSERT INTO sessions
            (session_id, user_id, created_at, expires_at, last_seen_at, ip_address, user_agent, revoked_at)
            VALUES ({_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, NULL)
            """,
            (session_id, user["user_id"], now.isoformat(), expires.isoformat(), now.isoformat(), ip_address, user_agent),
        )
        _execute(
            conn,
            f"UPDATE users SET last_login_at = {_placeholder()}, updated_at = {_placeholder()} WHERE user_id = {_placeholder()}",
            (now.isoformat(), now.isoformat(), user["user_id"]),
        )
    return {
        "session_id": session_id,
        "expires_at": expires.isoformat(),
    }


def authenticate(username: str, password: str, ip_address: str | None, user_agent: str | None, remember_me: bool = False) -> tuple[dict | None, dict | None]:
    user = get_user_by_username(username.strip())
    if not user or not user.get("is_active") or not verify_password(password, user["password_hash"]):
        return None, None
    session = create_session(user, ip_address, user_agent, remember_me=remember_me)
    return get_user_by_id(user["user_id"]), session


def authenticate_google_user(email: str, full_name: str, google_sub: str, ip_address: str | None, user_agent: str | None) -> tuple[dict | None, dict | None]:
    user = get_user_by_username(email.strip())
    if not user:
        return None, None
    if not user.get("is_active"):
        return None, None
    update_user(
        user["user_id"],
        full_name=full_name or user["full_name"],
        email=email,
        auth_source="google",
        google_sub=google_sub,
    )
    refreshed = get_user_by_id(user["user_id"])
    session = create_session(refreshed, ip_address, user_agent, remember_me=True)
    return refreshed, session


def create_access_request(email: str, full_name: str, requested_username: str | None = None, company_name: str | None = None, note: str | None = None) -> dict:
    request_id = uuid.uuid4().hex
    now = utc_now_text()
    normalized_email = email.strip().lower()
    with get_connection() as conn:
        existing = _fetchone(
            conn,
            f"SELECT * FROM access_requests WHERE lower(email) = lower({_placeholder()}) AND status = {_placeholder()} ORDER BY created_at DESC",
            (normalized_email, "pending"),
        )
        if existing:
            return dict(existing)
        _execute(
            conn,
            f"""
            INSERT INTO access_requests
            (request_id, email, requested_username, full_name, company_name, note, status, created_at, updated_at, resolved_by_user_id, resolution_note)
            VALUES ({_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()})
            """,
            (
                request_id,
                normalized_email,
                (requested_username or "").strip() or None,
                full_name.strip(),
                (company_name or "").strip() or None,
                (note or "").strip() or None,
                "pending",
                now,
                now,
                None,
                None,
            ),
        )
    return get_access_request(request_id)


def get_access_request(request_id: str) -> dict | None:
    with get_connection() as conn:
        row = _fetchone(conn, f"SELECT * FROM access_requests WHERE request_id = {_placeholder()}", (request_id,))
    return dict(row) if row else None


def list_access_requests(status: str | None = None) -> list[dict]:
    with get_connection() as conn:
        if status:
            rows = _fetchall(
                conn,
                f"SELECT * FROM access_requests WHERE status = {_placeholder()} ORDER BY created_at DESC",
                (status,),
            )
        else:
            rows = _fetchall(conn, "SELECT * FROM access_requests ORDER BY created_at DESC")
    return [dict(row) for row in rows]


def resolve_access_request(request_id: str, *, status: str, resolved_by_user_id: str, resolution_note: str | None = None) -> dict:
    if status not in {"approved", "rejected"}:
        raise ValueError("Invalid request status.")
    with get_connection() as conn:
        _execute(
            conn,
            f"""
            UPDATE access_requests
            SET status = {_placeholder()},
                updated_at = {_placeholder()},
                resolved_by_user_id = {_placeholder()},
                resolution_note = {_placeholder()}
            WHERE request_id = {_placeholder()}
            """,
            (status, utc_now_text(), resolved_by_user_id, (resolution_note or "").strip() or None, request_id),
        )
    return get_access_request(request_id)


def get_session_user(session_id: str | None) -> dict | None:
    if not session_id:
        return None
    now = utc_now_text()
    with get_connection() as conn:
        row = _fetchone(
            conn,
            f"""
            SELECT u.*, s.session_id, s.expires_at, s.last_seen_at
            FROM sessions s
            JOIN users u ON u.user_id = s.user_id
            WHERE s.session_id = {_placeholder()}
              AND s.revoked_at IS NULL
              AND s.expires_at > {_placeholder()}
              AND u.is_active = 1
            """,
            (session_id, now),
        )
        if row:
            _execute(conn, f"UPDATE sessions SET last_seen_at = {_placeholder()} WHERE session_id = {_placeholder()}", (utc_now_text(), session_id))
    user = _user_from_row(row)
    if user:
        user["session_id"] = row["session_id"]
        user["expires_at"] = row["expires_at"]
    return user


def revoke_session(session_id: str | None):
    if not session_id:
        return
    with get_connection() as conn:
        _execute(conn, f"UPDATE sessions SET revoked_at = {_placeholder()} WHERE session_id = {_placeholder()} AND revoked_at IS NULL", (utc_now_text(), session_id))


def log_audit(*, action: str, status: str, path: str | None = None, user: dict | None = None, session_id: str | None = None, target_type: str | None = None, target_id: str | None = None, ip_address: str | None = None, user_agent: str | None = None, details: dict | None = None):
    with get_connection() as conn:
        _execute(
            conn,
            f"""
            INSERT INTO audit_logs
            (created_at, user_id, username, session_id, action, target_type, target_id, status, path, ip_address, user_agent, details_json)
            VALUES ({_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()}, {_placeholder()})
            """,
            (
                utc_now_text(),
                user.get("user_id") if user else None,
                user.get("username") if user else None,
                session_id or (user.get("session_id") if user else None),
                action,
                target_type,
                target_id,
                status,
                path,
                ip_address,
                user_agent,
                json.dumps(details or {}, ensure_ascii=False),
            ),
        )


def list_users() -> list[dict]:
    with get_connection() as conn:
        rows = _fetchall(conn, "SELECT * FROM users ORDER BY created_at ASC")
    users = []
    for row in rows:
        user = _user_from_row(row)
        user.pop("password_hash", None)
        user["api_overrides"] = get_user_api_overrides(user["user_id"])
        users.append(user)
    return users


def list_recent_audits(limit: int = 200) -> list[dict]:
    with get_connection() as conn:
        rows = _fetchall(conn, f"SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT {_placeholder()}", (limit,))
    logs = []
    for row in rows:
        item = dict(row)
        try:
            item["details"] = json.loads(item.get("details_json") or "{}")
        except Exception:
            item["details"] = {}
        item.pop("details_json", None)
        logs.append(item)
    return logs


def _period_to_dates(period: str | None, date_from: str | None, date_to: str | None) -> tuple[str | None, str | None]:
    now = utc_now()
    start = date_from
    end = date_to
    if start and len(start) == 10:
        start = f"{start}T00:00:00+00:00"
    if end and len(end) == 10:
        end = f"{end}T23:59:59.999999+00:00"
    if not period or period == "custom":
        return start, end
    if period == "today":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_dt.isoformat(), None
    if period == "7d":
        return (now - timedelta(days=7)).isoformat(), None
    if period == "30d":
        return (now - timedelta(days=30)).isoformat(), None
    if period == "month":
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return start_dt.isoformat(), None
    return start, end


def query_audit_logs(*, period: str | None = None, date_from: str | None = None, date_to: str | None = None, action: str | None = None, username: str | None = None, status: str | None = None, limit: int = 200) -> list[dict]:
    start, end = _period_to_dates(period, date_from, date_to)
    clauses = []
    params: list[str | int] = []
    if start:
        clauses.append(f"created_at >= {_placeholder()}")
        params.append(start)
    if end:
        clauses.append(f"created_at <= {_placeholder()}")
        params.append(end)
    if action:
        clauses.append(f"action = {_placeholder()}")
        params.append(action)
    if username:
        clauses.append(f"lower(COALESCE(username, '')) = lower({_placeholder()})")
        params.append(username)
    if status:
        clauses.append(f"status = {_placeholder()}")
        params.append(status)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with get_connection() as conn:
        rows = _fetchall(
            conn,
            f"SELECT * FROM audit_logs {where_sql} ORDER BY created_at DESC LIMIT {_placeholder()}",
            tuple([*params, limit]),
        )
    logs = []
    for row in rows:
        item = dict(row)
        try:
            item["details"] = json.loads(item.get("details_json") or "{}")
        except Exception:
            item["details"] = {}
        item.pop("details_json", None)
        logs.append(item)
    return logs


def audit_logs_to_csv(logs: list[dict]) -> str:
    buffer = StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=["created_at", "username", "action", "status", "path", "target_type", "target_id", "ip_address", "user_agent", "details"],
    )
    writer.writeheader()
    for log in logs:
        writer.writerow({
            "created_at": log.get("created_at"),
            "username": log.get("username") or "",
            "action": log.get("action") or "",
            "status": log.get("status") or "",
            "path": log.get("path") or "",
            "target_type": log.get("target_type") or "",
            "target_id": log.get("target_id") or "",
            "ip_address": log.get("ip_address") or "",
            "user_agent": log.get("user_agent") or "",
            "details": json.dumps(log.get("details") or {}, ensure_ascii=False),
        })
    return buffer.getvalue()


def list_api_policies() -> list[dict]:
    with get_connection() as conn:
        rows = _fetchall(conn, "SELECT * FROM api_policies ORDER BY api_name ASC")
    return [dict(row) for row in rows]


def update_api_policy(api_name: str, access_level: str, enabled: bool) -> dict:
    if access_level not in ROLE_ORDER:
        raise ValueError("Invalid access level.")
    with get_connection() as conn:
        _execute(
            conn,
            f"UPDATE api_policies SET access_level = {_placeholder()}, enabled = {_placeholder()}, updated_at = {_placeholder()} WHERE api_name = {_placeholder()}",
            (access_level, 1 if enabled else 0, utc_now_text(), api_name),
        )
    with get_connection() as conn:
        row = _fetchone(conn, f"SELECT * FROM api_policies WHERE api_name = {_placeholder()}", (api_name,))
    return dict(row) if row else {"api_name": api_name, "access_level": access_level, "enabled": enabled}


def get_api_policy(api_name: str) -> dict:
    with get_connection() as conn:
        row = _fetchone(conn, f"SELECT * FROM api_policies WHERE api_name = {_placeholder()}", (api_name,))
    if row:
        return dict(row)
    return {"api_name": api_name, "access_level": "operator", "enabled": 1}


def get_user_api_overrides(user_id: str) -> dict:
    with get_connection() as conn:
        rows = _fetchall(conn, f"SELECT api_name, allowed FROM user_api_access WHERE user_id = {_placeholder()}", (user_id,))
    return {row["api_name"]: bool(row["allowed"]) for row in rows}


def set_user_api_access(user_id: str, api_name: str, allowed: bool | None):
    with get_connection() as conn:
        if allowed is None:
            _execute(conn, f"DELETE FROM user_api_access WHERE user_id = {_placeholder()} AND api_name = {_placeholder()}", (user_id, api_name))
        elif using_postgres():
            _execute(
                conn,
                """
                INSERT INTO user_api_access (user_id, api_name, allowed)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, api_name) DO UPDATE SET allowed = EXCLUDED.allowed
                """,
                (user_id, api_name, 1 if allowed else 0),
            )
        else:
            _execute(
                conn,
                "INSERT OR REPLACE INTO user_api_access (user_id, api_name, allowed) VALUES (?, ?, ?)",
                (user_id, api_name, 1 if allowed else 0),
            )


def can_access_api(user: dict, api_name: str) -> bool:
    if not user:
        return False
    if user.get("role") == "owner":
        return True
    policy = get_api_policy(api_name)
    if not policy.get("enabled", 1):
        return False
    overrides = get_user_api_overrides(user["user_id"])
    if api_name in overrides:
        return overrides[api_name]
    return ROLE_ORDER.get(user.get("role", "viewer"), 0) >= ROLE_ORDER.get(policy.get("access_level", "operator"), 2)


def can_manage_permission(user: dict, permission_code: str) -> bool:
    return permission_code in set(user.get("permissions", []))


def get_admin_overview(config: dict) -> dict:
    users = list_users()
    audits = list_recent_audits(250)
    policies = list_api_policies()
    requests = list_access_requests()
    active_sessions = 0
    now = utc_now_text()
    with get_connection() as conn:
        row = _fetchone(
            conn,
            f"SELECT COUNT(*) AS n FROM sessions WHERE revoked_at IS NULL AND expires_at > {_placeholder()}",
            (now,),
        )
    if row:
        active_sessions = int(row["n"] if isinstance(row, dict) else row[0])
    return {
        "users": users,
        "access_requests": requests,
        "audit_logs": audits,
        "api_policies": policies,
        "auth": {
            "master_access_enabled": master_access_enabled(),
            "master_username": get_master_username(),
            "google_auth_enabled": google_auth_enabled(),
            "access_request_enabled": access_request_enabled(),
        },
        "stats": {
            "user_count": len(users),
            "pending_access_requests": len([request for request in requests if request.get("status") == "pending"]),
            "active_sessions": active_sessions,
            "api_count": len(config.get("apis", {})),
            "workflow_count": len(config.get("workflows", {})),
        },
    }


def master_access_enabled() -> bool:
    settings = load_auth_settings()
    master = settings.get("master_account") or {}
    file_ready = bool((master.get("username") or "").strip() and (master.get("password") or "").strip() and master.get("password") != "CHANGE_ME_NOW")
    env_ready = bool(os.getenv("SUREFLOW_MASTER_USERNAME", "").strip() and os.getenv("SUREFLOW_MASTER_PASSWORD", "").strip())
    return file_ready or env_ready


def google_auth_enabled() -> bool:
    return all(
        os.getenv(key, "").strip()
        for key in (
            "SUREFLOW_GOOGLE_CLIENT_ID",
            "SUREFLOW_GOOGLE_CLIENT_SECRET",
            "SUREFLOW_GOOGLE_REDIRECT_URI",
        )
    )


def get_google_auth_config() -> dict:
    return {
        "client_id": os.getenv("SUREFLOW_GOOGLE_CLIENT_ID", "").strip(),
        "client_secret": os.getenv("SUREFLOW_GOOGLE_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.getenv("SUREFLOW_GOOGLE_REDIRECT_URI", "").strip(),
        "hosted_domain": os.getenv("SUREFLOW_GOOGLE_HOSTED_DOMAIN", "").strip(),
    }


def get_master_username() -> str | None:
    settings = load_auth_settings()
    username = (settings.get("master_account", {}).get("username") or "").strip()
    if username:
        return username
    return os.getenv("SUREFLOW_MASTER_USERNAME", "").strip() or None
