"""
server/main.py
==============
SureFlow FastAPI server.

Thread-safety improvements:
  - CONFIG_LOCK (RLock) wraps every config.yaml read and write.
    This prevents a race where two simultaneous requests both read
    the old config, modify it independently, and one overwrites
    the other's change (read-modify-write race).
  - IDENTIFIER_PATTERNS imported from worker.py so the validate-column
    endpoint uses the same patterns as the job runner.
"""

import re
import asyncio
import atexit
import csv
import yaml
import os
import json
import uuid
import secrets
from io import StringIO
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel
import httpx

from server.config_lock import CONFIG_LOCK
from src.db.storage import using_postgres
from src.auth.service import (
    AUTH_COOKIE_NAME,
    GOOGLE_STATE_COOKIE_NAME,
    authenticate_google_user,
    bootstrap_owner,
    bootstrap_owner_from_env,
    can_access_api,
    can_manage_permission,
    create_user,
    create_access_request,
    ensure_auth_tables,
    access_request_enabled,
    audit_logs_to_csv,
    get_google_auth_config,
    get_admin_overview,
    get_master_username,
    get_session_user,
    get_user_by_id,
    google_auth_enabled,
    load_auth_settings,
    list_api_policies,
    log_audit,
    query_audit_logs,
    resolve_access_request,
    master_access_enabled,
    revoke_session,
    set_user_api_access,
    sync_master_access_from_file,
    sync_master_access_from_env,
    sync_api_policies,
    update_api_policy,
    update_user,
    user_count,
    authenticate,
)
from src.utils.identifiers import get_identifier_pattern, matches_identifier

_WORKER_IMPORT_ERROR = None

try:
    from server.worker import (
        create_job, get_job, get_all_jobs,
        run_job_async, JOB_QUEUES,
        pause_job, resume_job, cancel_schedule,
    )
except Exception as exc:
    _WORKER_IMPORT_ERROR = exc
    JOB_QUEUES = {}

    def _worker_unavailable(*args, **kwargs):
        raise RuntimeError(f"Worker subsystem unavailable: {_WORKER_IMPORT_ERROR}")

    create_job = _worker_unavailable
    get_job = _worker_unavailable
    get_all_jobs = _worker_unavailable
    run_job_async = _worker_unavailable
    pause_job = _worker_unavailable
    resume_job = _worker_unavailable
    cancel_schedule = _worker_unavailable

ROOT          = Path(__file__).resolve().parents[1]
INPUTS_DIR    = ROOT / "inputs"
OUTPUTS_DIR   = ROOT / "outputs"
CONFIG_PATH   = ROOT / "config.yaml"
FRONTEND_DIST = ROOT / "frontend" / "dist"

INPUTS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)

# ── Load .env only (never persist secrets to config.yaml) ──────────────────
def _load_env():
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env", override=False)


_load_env()

app = FastAPI(title="SureFlow", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_KEY = os.getenv("SUREFLOW_ADMIN_KEY", "").strip()
COOKIE_SECURE = os.getenv("SUREFLOW_COOKIE_SECURE", "").strip().lower() in {"1", "true", "yes"}


def _request_meta(request: Request) -> tuple[Optional[str], Optional[str]]:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return ip_address, user_agent


def _service_owner() -> dict:
    return {
        "user_id": "service-owner",
        "username": "service-owner",
        "full_name": "Service Owner",
        "role": "owner",
        "permissions": [],
        "is_active": True,
    }


def _get_request_user(request: Request) -> Optional[dict]:
    user = getattr(request.state, "user", None)
    if user:
        return user
    if ADMIN_KEY and request.headers.get("x-admin-key") == ADMIN_KEY:
        return _service_owner()
    return None


def _require_auth(request: Request) -> dict:
    user = _get_request_user(request)
    if not user:
        raise HTTPException(401, "Authentication required.")
    return user


def _require_permission(request: Request, permission_code: str) -> dict:
    user = _require_auth(request)
    if user.get("role") == "owner" or can_manage_permission(user, permission_code):
        return user
    raise HTTPException(403, "You do not have permission for this action.")


def _require_owner(request: Request) -> dict:
    user = _require_auth(request)
    if user.get("role") == "owner":
        return user
    raise HTTPException(403, "Owner access required.")


def _require_api_access(request: Request, api_name: str) -> dict:
    user = _require_auth(request)
    if not can_access_api(user, api_name):
        raise HTTPException(403, f"API access is restricted for '{api_name}'.")
    return user


def _set_session_cookie(response: Response, session_id: str, max_age: int):
    response.set_cookie(
        AUTH_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=max_age,
        path="/",
    )


def _clear_session_cookie(response: Response):
    response.delete_cookie(AUTH_COOKIE_NAME, path="/", samesite="lax")


@app.middleware("http")
async def attach_authenticated_user(request: Request, call_next):
    request.state.user = None
    request.state.session_id = None
    session_id = request.cookies.get(AUTH_COOKIE_NAME)
    if session_id:
        user = get_session_user(session_id)
        if user:
            request.state.user = user
            request.state.session_id = session_id
    return await call_next(request)


def _mask_config(config: dict) -> dict:
    masked = dict(config)
    tokens = masked.get("tokens", {})
    if isinstance(tokens, dict):
        masked["tokens"] = {k: "Bearer ****" for k in tokens}
    return masked


def _read_csv_page(csv_path: Path, offset: int, limit: int) -> tuple[list[str], list[dict], int]:
    """
    Read only the requested CSV window while still returning total row count.
    Avoids loading the entire file into memory.
    """
    columns: list[str] = []
    rows: list[dict] = []
    total = 0
    end = offset + limit

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        columns = list(reader.fieldnames or [])
        for idx, row in enumerate(reader):
            if idx >= offset and idx < end:
                rows.append(row)
            total = idx + 1

    return columns, rows, total


@app.on_event("startup")
async def startup_security():
    ensure_auth_tables()
    bootstrap_owner_from_env()
    sync_master_access_from_file()
    sync_master_access_from_env()
    sync_api_policies(load_config())


# ─────────────────────────────────────────────────────────────
# CONFIG HELPERS — all use CONFIG_LOCK
# ─────────────────────────────────────────────────────────────

def load_config() -> dict:
    """Thread-safe config read."""
    with CONFIG_LOCK:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}


def save_config(config: dict):
    """Thread-safe config write."""
    with CONFIG_LOCK:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


def update_config(updater):
    """
    Thread-safe read-modify-write in a single lock acquisition.
    Prevents the race where two simultaneous requests both read the old
    config and one overwrites the other's change.

    Usage:
        def add_my_token(cfg):
            cfg.setdefault("tokens", {})["mytoken"] = "Bearer abc"
        update_config(add_my_token)
    """
    with CONFIG_LOCK:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}
        updater(config)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        return config


# ─────────────────────────────────────────────────────────────
# COLUMN DETECTOR
# ─────────────────────────────────────────────────────────────

def detect_columns_from_config(df, config: dict) -> dict:
    patterns_cfg = config.get("identifier_patterns", {})
    results = {}
    for id_type, cfg in patterns_cfg.items():
        pattern    = re.compile(cfg["regex"], re.IGNORECASE)
        hint_words = cfg.get("hint_words", [])
        workflow   = cfg.get("maps_to_workflow")
        best_col, best_score = None, 0.0
        for col in df.columns:
            sample = df[col].dropna().head(20)
            if not len(sample):
                continue
            match_rate   = sum(1 for v in sample if pattern.match(matches_identifier(id_type, v)[0])) / len(sample)
            header_bonus = 0.3 if any(h in col.lower() for h in hint_words) else 0.0
            score        = match_rate + header_bonus
            if score > best_score:
                best_score, best_col = score, col
        if best_col and best_score >= 0.6:
            results[id_type] = {
                "column":   best_col,
                "workflow": workflow,
                "score":    round(best_score, 2),
            }
    return results


# ─────────────────────────────────────────────────────────────
# AUTHENTICATION & OWNER CONTROL
# ─────────────────────────────────────────────────────────────

class BootstrapOwnerRequest(BaseModel):
    username: str
    password: str
    full_name: str


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class CreateUserRequest(BaseModel):
    username: Optional[str] = None
    password: str
    full_name: str
    email: str
    role: str = "operator"


class AccessRequestCreateRequest(BaseModel):
    email: str
    full_name: str
    requested_username: Optional[str] = None
    company_name: Optional[str] = None
    note: Optional[str] = None


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UpdateApiPolicyRequest(BaseModel):
    access_level: str
    enabled: bool = True


class UpdateUserApiAccessRequest(BaseModel):
    allowed: Optional[bool] = None


class ResolveAccessRequestBody(BaseModel):
    action: str
    role: str = "operator"
    password: Optional[str] = None
    username: Optional[str] = None
    resolution_note: Optional[str] = None


class ActivityQueryRequest(BaseModel):
    period: Optional[str] = "7d"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    action: Optional[str] = None
    username: Optional[str] = None
    status: Optional[str] = None
    limit: int = 300


class PageViewRequest(BaseModel):
    path: str
    title: Optional[str] = None


def _sanitize_user(user: dict) -> dict:
    safe = dict(user)
    safe.pop("password_hash", None)
    return safe


@app.get("/api/auth/bootstrap-status")
async def auth_bootstrap_status():
    return {"needs_bootstrap": user_count() == 0}


@app.get("/api/auth/providers")
async def auth_providers():
    return {
        "master_access_enabled": master_access_enabled(),
        "master_username": get_master_username(),
        "google_auth_enabled": google_auth_enabled(),
        "access_request_enabled": access_request_enabled(),
    }


@app.get("/api/auth/settings")
async def auth_settings(request: Request):
    _require_owner(request)
    return load_auth_settings()


@app.post("/api/auth/request-access")
async def auth_request_access(req: AccessRequestCreateRequest, request: Request):
    if not access_request_enabled():
        raise HTTPException(403, "Access requests are disabled.")
    access_request = create_access_request(
        req.email,
        req.full_name,
        requested_username=req.requested_username,
        company_name=req.company_name,
        note=req.note,
    )
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="auth.request_access",
        status="success",
        path=request.url.path,
        ip_address=ip_address,
        user_agent=user_agent,
        target_type="access_request",
        target_id=access_request["request_id"],
        details={"email": req.email.strip().lower(), "company_name": req.company_name},
    )
    return {"status": access_request["status"], "request_id": access_request["request_id"]}


@app.post("/api/auth/bootstrap")
async def auth_bootstrap(req: BootstrapOwnerRequest, request: Request):
    if len(req.password or "") < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")
    if user_count() > 0:
        raise HTTPException(409, "SureFlow has already been initialized.")
    try:
        bootstrap_owner(req.username.strip(), req.password, req.full_name.strip() or req.username.strip())
    except Exception as exc:
        raise HTTPException(400, str(exc))
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="auth.bootstrap",
        status="success",
        path=request.url.path,
        user=None,
        ip_address=ip_address,
        user_agent=user_agent,
        details={"username": req.username.strip()},
    )
    user, session = authenticate(req.username.strip(), req.password, ip_address, user_agent, remember_me=True)
    response = JSONResponse({"user": _sanitize_user(user)})
    _set_session_cookie(response, session["session_id"], 60 * 60 * 24 * 30)
    return response


@app.post("/api/auth/login")
async def auth_login(req: LoginRequest, request: Request):
    ip_address, user_agent = _request_meta(request)
    user, session = authenticate(req.username.strip(), req.password, ip_address, user_agent, remember_me=req.remember_me)
    if not user or not session:
        log_audit(
            action="auth.login",
            status="failed",
            path=request.url.path,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"username": req.username.strip()},
        )
        raise HTTPException(401, "Invalid username or password.")
    log_audit(
        action="auth.login",
        status="success",
        path=request.url.path,
        user=user,
        session_id=session["session_id"],
        ip_address=ip_address,
        user_agent=user_agent,
    )
    max_age = 60 * 60 * 24 * 30 if req.remember_me else 60 * 60 * 12
    response = JSONResponse({"user": _sanitize_user(user)})
    _set_session_cookie(response, session["session_id"], max_age)
    return response


@app.get("/api/auth/google/start")
async def auth_google_start():
    if not google_auth_enabled():
        raise HTTPException(404, "Google sign-in is not configured.")
    cfg = get_google_auth_config()
    state = secrets.token_urlsafe(24)
    query = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "include_granted_scopes": "true",
        "prompt": "select_account",
        "state": state,
    }
    if cfg["hosted_domain"]:
        query["hd"] = cfg["hosted_domain"]
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(query)
    response = RedirectResponse(url=url, status_code=302)
    response.set_cookie(
        GOOGLE_STATE_COOKIE_NAME,
        state,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=600,
        path="/",
    )
    return response


@app.get("/api/auth/google/callback")
async def auth_google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        return RedirectResponse(url=f"/?auth_error={error}", status_code=302)
    if not google_auth_enabled():
        return RedirectResponse(url="/?auth_error=google_not_configured", status_code=302)
    if not code or not state or state != request.cookies.get(GOOGLE_STATE_COOKIE_NAME):
        return RedirectResponse(url="/?auth_error=invalid_google_state", status_code=302)

    cfg = get_google_auth_config()
    ip_address, user_agent = _request_meta(request)
    async with httpx.AsyncClient(timeout=20) as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": cfg["redirect_uri"],
            },
        )
        token_data = token_res.json() if token_res.headers.get("content-type", "").startswith("application/json") else {}
        if token_res.status_code >= 400 or "access_token" not in token_data:
            log_audit(
                action="auth.google",
                status="failed",
                path=request.url.path,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"step": "token_exchange", "response": token_data},
            )
            return RedirectResponse(url="/?auth_error=google_exchange_failed", status_code=302)

        userinfo_res = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        userinfo = userinfo_res.json() if userinfo_res.headers.get("content-type", "").startswith("application/json") else {}
        email = (userinfo.get("email") or "").strip()
        google_sub = (userinfo.get("sub") or "").strip()
        if userinfo_res.status_code >= 400 or not email or not google_sub or not userinfo.get("email_verified"):
            log_audit(
                action="auth.google",
                status="failed",
                path=request.url.path,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"step": "userinfo", "response": userinfo},
            )
            return RedirectResponse(url="/?auth_error=google_profile_invalid", status_code=302)

    hosted_domain = cfg["hosted_domain"]
    if hosted_domain and not email.lower().endswith("@" + hosted_domain.lower()):
        log_audit(
            action="auth.google",
            status="failed",
            path=request.url.path,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"email": email, "reason": "hosted_domain_mismatch"},
        )
        return RedirectResponse(url="/?auth_error=google_domain_restricted", status_code=302)

    user, session = authenticate_google_user(email, (userinfo.get("name") or email), google_sub, ip_address, user_agent)
    if not user or not session:
        log_audit(
            action="auth.google",
            status="failed",
            path=request.url.path,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"email": email, "reason": "user_not_provisioned"},
        )
        return RedirectResponse(url="/?auth_error=google_user_not_allowed", status_code=302)

    log_audit(
        action="auth.google",
        status="success",
        path=request.url.path,
        user=user,
        session_id=session["session_id"],
        ip_address=ip_address,
        user_agent=user_agent,
        details={"email": email},
    )
    response = RedirectResponse(url="/", status_code=302)
    _set_session_cookie(response, session["session_id"], 60 * 60 * 24 * 30)
    response.delete_cookie(GOOGLE_STATE_COOKIE_NAME, path="/", samesite="lax")
    return response


@app.post("/api/auth/logout")
async def auth_logout(request: Request):
    user = _get_request_user(request)
    session_id = request.cookies.get(AUTH_COOKIE_NAME)
    if session_id:
        revoke_session(session_id)
    if user:
        ip_address, user_agent = _request_meta(request)
        log_audit(
            action="auth.logout",
            status="success",
            path=request.url.path,
            user=user,
            session_id=session_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    response = JSONResponse({"status": "ok"})
    _clear_session_cookie(response)
    return response


@app.get("/api/auth/me")
async def auth_me(request: Request):
    user = _require_auth(request)
    return {
        "user": _sanitize_user(user),
        "api_policies": list_api_policies(),
    }


@app.post("/api/activity/page-view")
async def log_page_view(req: PageViewRequest, request: Request):
    user = _require_auth(request)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="ui.page_view",
        status="success",
        path=req.path,
        user=user,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"title": req.title or ""},
    )
    return {"status": "logged"}


@app.get("/api/admin/overview")
async def admin_overview(request: Request):
    _require_owner(request)
    return get_admin_overview(load_config())


@app.post("/api/admin/users")
async def admin_create_user(req: CreateUserRequest, request: Request):
    owner = _require_owner(request)
    if len(req.password or "") < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")
    try:
        user = create_user(req.username.strip(), req.password, req.full_name.strip() or req.username.strip(), req.role, email=req.email)
    except Exception as exc:
        raise HTTPException(400, f"Could not create user: {exc}")
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="admin.user_create",
        status="success",
        path=request.url.path,
        user=owner,
        target_type="user",
        target_id=user["user_id"],
        ip_address=ip_address,
        user_agent=user_agent,
        details={"username": user["username"], "role": user["role"], "email": user.get("email")},
    )
    return {"user": _sanitize_user(user)}


@app.patch("/api/admin/users/{user_id}")
async def admin_update_user(user_id: str, req: UpdateUserRequest, request: Request):
    owner = _require_owner(request)
    if owner.get("user_id") == user_id and req.role and req.role != "owner":
        raise HTTPException(400, "The owner account cannot be downgraded from here.")
    try:
        user = update_user(user_id, full_name=req.full_name, email=req.email, role=req.role, is_active=req.is_active, password=req.password)
    except Exception as exc:
        raise HTTPException(400, str(exc))
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="admin.user_update",
        status="success",
        path=request.url.path,
        user=owner,
        target_type="user",
        target_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details={
            "full_name": req.full_name,
            "email": req.email,
            "role": req.role,
            "is_active": req.is_active,
            "password_reset": bool(req.password),
        },
    )
    return {"user": _sanitize_user(user)}


@app.patch("/api/admin/apis/{api_name}")
async def admin_update_api_policy(api_name: str, req: UpdateApiPolicyRequest, request: Request):
    owner = _require_owner(request)
    try:
        policy = update_api_policy(api_name, req.access_level, req.enabled)
    except Exception as exc:
        raise HTTPException(400, str(exc))
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="admin.api_policy_update",
        status="success",
        path=request.url.path,
        user=owner,
        target_type="api",
        target_id=api_name,
        ip_address=ip_address,
        user_agent=user_agent,
        details={"access_level": req.access_level, "enabled": req.enabled},
    )
    return {"policy": policy}


@app.put("/api/admin/users/{user_id}/api-access/{api_name}")
async def admin_update_user_api_access(user_id: str, api_name: str, req: UpdateUserApiAccessRequest, request: Request):
    owner = _require_owner(request)
    set_user_api_access(user_id, api_name, req.allowed)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="admin.user_api_access_update",
        status="success",
        path=request.url.path,
        user=owner,
        target_type="api-access",
        target_id=f"{user_id}:{api_name}",
        ip_address=ip_address,
        user_agent=user_agent,
        details={"allowed": req.allowed},
    )
    return {"status": "saved"}


@app.post("/api/admin/access-requests/{request_id}/resolve")
async def admin_resolve_access_request(request_id: str, req: ResolveAccessRequestBody, request: Request):
    owner = _require_owner(request)
    current = next((item for item in get_admin_overview(load_config())["access_requests"] if item["request_id"] == request_id), None)
    if not current:
        raise HTTPException(404, "Access request not found.")
    if current.get("status") != "pending":
        raise HTTPException(400, "Access request has already been resolved.")

    created_user = None
    if req.action == "approve":
        password = (req.password or "").strip()
        if len(password) < 8:
            raise HTTPException(400, "Approved accounts need a password of at least 8 characters.")
        try:
            created_user = create_user(
                username=req.username or current.get("requested_username") or current.get("email"),
                password=password,
                full_name=current.get("full_name") or current.get("email"),
                role=req.role,
                email=current.get("email"),
            )
        except Exception as exc:
            raise HTTPException(400, f"Could not create approved user: {exc}")
        result = resolve_access_request(
            request_id,
            status="approved",
            resolved_by_user_id=owner["user_id"],
            resolution_note=req.resolution_note,
        )
    elif req.action == "reject":
        result = resolve_access_request(
            request_id,
            status="rejected",
            resolved_by_user_id=owner["user_id"],
            resolution_note=req.resolution_note,
        )
    else:
        raise HTTPException(400, "Action must be 'approve' or 'reject'.")

    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="admin.access_request_resolve",
        status="success",
        path=request.url.path,
        user=owner,
        target_type="access_request",
        target_id=request_id,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"action": req.action, "role": req.role, "created_user": created_user["user_id"] if created_user else None},
    )
    return {"request": result, "user": _sanitize_user(created_user) if created_user else None}


@app.post("/api/admin/activity/query")
async def admin_query_activity(req: ActivityQueryRequest, request: Request):
    _require_owner(request)
    limit = max(1, min(req.limit, 2000))
    logs = query_audit_logs(
        period=req.period,
        date_from=req.date_from,
        date_to=req.date_to,
        action=req.action,
        username=req.username,
        status=req.status,
        limit=limit,
    )
    return {"logs": logs}


@app.get("/api/admin/activity/export")
async def admin_export_activity(
    request: Request,
    period: str = "30d",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    action: Optional[str] = None,
    username: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 5000,
):
    _require_owner(request)
    bounded_limit = max(1, min(limit, 20000))
    logs = query_audit_logs(
        period=period,
        date_from=date_from,
        date_to=date_to,
        action=action,
        username=username,
        status=status,
        limit=bounded_limit,
    )
    csv_text = audit_logs_to_csv(logs)
    filename = f"sureflow-activity-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────────────────────────────────────────────
# UPLOAD
# ─────────────────────────────────────────────────────────────

MAX_UPLOAD_MB = int(os.getenv("SUREFLOW_MAX_UPLOAD_MB", "200"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_PREVIEW_VALUES = 200

@app.post("/api/upload")
async def upload_file(request: Request, file: UploadFile = File(...), mode: str = "auto"):
    user = _require_permission(request, "jobs.run")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".xlsx", ".xls", ".csv"):
        raise HTTPException(400, "Only .xlsx, .xls, and .csv files are supported.")

    # Read into memory first to check size
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File too large. Maximum size is {MAX_UPLOAD_MB} MB.")

    # Safe filename — strip any path components
    safe_name = Path(file.filename).name
    stored_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"
    dest = INPUTS_DIR / stored_name
    with open(dest, "wb") as f:
        f.write(content)

    import pandas as pd
    try:
        df = pd.read_excel(dest, dtype=str) if suffix in (".xlsx", ".xls") else pd.read_csv(dest, dtype=str)
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, f"Could not read file: {e}")

    config    = load_config()
    detected  = detect_columns_from_config(df, config) if mode == "auto" else {}
    workflows = list(config.get("workflows", {}).keys())
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="upload.file",
        status="success",
        path=request.url.path,
        user=user,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"filename": stored_name, "rows": len(df), "columns": len(df.columns), "mode": mode},
    )

    return {
        "filename":  stored_name,
        "rows":      len(df),
        "columns":   list(df.columns),
        "detected":  detected,
        "workflows": workflows,
        "mode":      mode,
    }


# ─────────────────────────────────────────────────────────────
# COLUMN FORMAT VALIDATION
# ─────────────────────────────────────────────────────────────

class ValidateColumnRequest(BaseModel):
    filename:        str
    column:          str
    identifier_type: Optional[str] = None
    workflow_name:   Optional[str] = None
    sample_limit:    int = 5
    scan_limit:      int = 2000


@app.post("/api/validate-column")
async def validate_column(req: ValidateColumnRequest, request: Request):
    user = _require_permission(request, "jobs.run")
    """
    Scan a column in an uploaded file and validate every value
    against the known identifier pattern for that type.
    Returns counts + sample invalid rows for the Upload page quality report.
    """
    file_path = INPUTS_DIR / req.filename
    if not file_path.exists():
        raise HTTPException(404, f"File not found: {req.filename}")

    config = load_config()
    identifier_type = req.identifier_type
    if req.workflow_name:
        workflow = config.get("workflows", {}).get(req.workflow_name)
        if not workflow:
            raise HTTPException(404, f"Workflow not found: {req.workflow_name}")
        identifier_type = workflow.get("input_field")

    if not identifier_type:
        raise HTTPException(400, "identifier_type or workflow_name is required")

    pattern = get_identifier_pattern(identifier_type, config=config)
    if not pattern:
        response = {
            "identifier_type": identifier_type,
            "column":          req.column,
            "total":           0,
            "valid":           0,
            "invalid":         0,
            "empty":           0,
            "valid_pct":       100,
            "has_pattern":     False,
            "invalid_samples": [],
        }
        ip_address, user_agent = _request_meta(request)
        log_audit(
            action="upload.validate_column",
            status="success",
            path=request.url.path,
            user=user,
            session_id=request.cookies.get(AUTH_COOKIE_NAME),
            ip_address=ip_address,
            user_agent=user_agent,
            details={"column": req.column, "identifier_type": identifier_type, "workflow_name": req.workflow_name, "has_pattern": False},
        )
        return response

    import pandas as pd
    suffix = file_path.suffix.lower()
    df     = pd.read_excel(file_path, dtype=str) if suffix in (".xlsx", ".xls") else pd.read_csv(file_path, dtype=str)

    if req.column not in df.columns:
        raise HTTPException(400, f"Column '{req.column}' not found in file.")

    total   = 0
    valid   = 0
    invalid = 0
    empty   = 0
    invalid_samples = []

    for idx, raw in enumerate(df[req.column]):
        if req.scan_limit > 0 and total >= req.scan_limit:
            break
        total  += 1
        raw_str = str(raw).strip()
        if not raw_str or raw_str.lower() in ("nan", "none", ""):
            empty += 1
            continue
        cleaned, matched = matches_identifier(identifier_type, raw_str)
        if matched:
            valid += 1
        else:
            invalid += 1
            if len(invalid_samples) < req.sample_limit:
                invalid_samples.append({
                    "row":     idx + 2,  # 1-based + header
                    "raw":     raw_str,
                    "cleaned": cleaned,
                })

    non_empty = total - empty
    valid_pct = round((valid / non_empty * 100), 1) if non_empty > 0 else 0.0

    response = {
        "identifier_type": identifier_type,
        "column":          req.column,
        "total":           total,
        "valid":           valid,
        "invalid":         invalid,
        "empty":           empty,
        "valid_pct":       valid_pct,
        "has_pattern":     True,
        "invalid_samples": invalid_samples,
        "scanned_rows":    total,
    }
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="upload.validate_column",
        status="success",
        path=request.url.path,
        user=user,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={
            "column": req.column,
            "identifier_type": identifier_type,
            "workflow_name": req.workflow_name,
            "valid_pct": valid_pct,
            "invalid": invalid,
        },
    )
    return response


# ─────────────────────────────────────────────────────────────
# JOB MANAGEMENT
# ─────────────────────────────────────────────────────────────

class RunJobRequest(BaseModel):
    filename:       str
    workflow:       str
    column_map:     dict
    force:          bool = False
    rebuild_csv:    bool = False
    start_from_row: int  = 0
    delay_minutes:  int  = 0


class ManualRunRequest(BaseModel):
    workflow_name: str
    values: list[str]
    output_format: str = "json"
    force: bool = False


@app.post("/api/manual-run")
async def manual_run(req: ManualRunRequest, request: Request):
    user = _require_permission(request, "manual_lab.run")
    if len(req.values) == 0:
        raise HTTPException(400, "At least one value is required.")
    if len(req.values) > MAX_PREVIEW_VALUES:
        raise HTTPException(400, f"Manual run supports at most {MAX_PREVIEW_VALUES} values at once.")

    from src.api.surepass_client import call_api
    from src.db.database import build_columns, extract_path, flatten_data_block, get_data_block

    config = load_config()
    workflow = config.get("workflows", {}).get(req.workflow_name)
    if not workflow:
        raise HTTPException(404, f"Workflow not found: {req.workflow_name}")
    _require_api_access(request, workflow["api"])

    input_field = workflow["input_field"]
    api_name = workflow["api"]
    api_cfg = config["apis"][api_name]
    token_name = workflow["token"]
    token = config["tokens"][token_name]
    if token_name == "primary":
        env_primary = os.getenv("SUREPASS_PRIMARY_TOKEN", "").strip()
        if env_primary:
            token = f"Bearer {env_primary}"
    elif token_name == "secondary":
        env_secondary = os.getenv("SUREPASS_SECONDARY_TOKEN", "").strip()
        if env_secondary:
            token = f"Bearer {env_secondary}"

    retry_cfg = config.get("retry", {})
    folder_name = api_cfg["url"].rstrip("/").split("/")[-1]
    results = []

    for raw_value in req.values:
        normalized, matched = matches_identifier(input_field, raw_value)
        if not normalized:
            results.append({
                "identifier": None,
                "status_code": None,
                "response": None,
                "response_path": None,
                "outcome": "skipped",
                "error": "Empty value",
                "normalized": "",
                "valid_format": False,
            })
            continue
        if not matched:
            results.append({
                "identifier": normalized,
                "status_code": None,
                "response": None,
                "response_path": None,
                "outcome": "invalid_format",
                "error": f"Does not match expected format for {input_field}",
                "normalized": normalized,
                "valid_format": False,
            })
            continue

        result = call_api(normalized, folder_name, api_cfg, token, retry_cfg)
        result["normalized"] = normalized
        result["valid_format"] = True
        results.append(result)

    if req.output_format == "csv":
        mapping = config.get("output_mapping", {}).get(req.workflow_name, [])
        columns = build_columns(results, mapping, input_field)
        buffer = StringIO()
        writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for result in results:
            row = {
                input_field: result.get("identifier") or "",
                "status_code": result.get("status_code") or "",
            }
            if result.get("response"):
                if mapping:
                    for m in mapping:
                        row[m["dest"]] = extract_path(result["response"], m["source"])
                else:
                    row.update(flatten_data_block(get_data_block(result["response"])))
            writer.writerow(row)
        response = {
            "workflow_name": req.workflow_name,
            "input_field": input_field,
            "results": results,
            "csv": buffer.getvalue(),
        }
        ip_address, user_agent = _request_meta(request)
        log_audit(
            action="manual_lab.run",
            status="success",
            path=request.url.path,
            user=user,
            session_id=request.cookies.get(AUTH_COOKIE_NAME),
            ip_address=ip_address,
            user_agent=user_agent,
            details={"workflow_name": req.workflow_name, "values": len(req.values), "output_format": req.output_format},
        )
        return response

    response = {
        "workflow_name": req.workflow_name,
        "input_field": input_field,
        "results": results,
    }
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="manual_lab.run",
        status="success",
        path=request.url.path,
        user=user,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"workflow_name": req.workflow_name, "values": len(req.values), "output_format": req.output_format},
    )
    return response


@app.post("/api/jobs/run")
async def run_job(req: RunJobRequest, request: Request):
    user = _require_permission(request, "jobs.run")
    file_path = INPUTS_DIR / req.filename
    if not file_path.exists():
        raise HTTPException(404, f"File not found: {req.filename}")
    config = load_config()
    if req.workflow not in config.get("workflows", {}):
        raise HTTPException(400, f"Workflow '{req.workflow}' not found in config.yaml")
    _require_api_access(request, config["workflows"][req.workflow]["api"])
    job_id = create_job()
    run_job_async(
        job_id=job_id,
        file_path=str(file_path),
        workflow_name=req.workflow,
        column_map=req.column_map,
        force=req.force,
        rebuild_csv=req.rebuild_csv,
        start_from_row=req.start_from_row,
        delay_minutes=req.delay_minutes,
    )
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="jobs.run",
        status="success",
        path=request.url.path,
        user=user,
        target_type="job",
        target_id=job_id,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"workflow": req.workflow, "filename": req.filename, "delay_minutes": req.delay_minutes},
    )
    return {"job_id": job_id}


@app.get("/api/jobs")
async def list_jobs(request: Request):
    _require_permission(request, "jobs.view")
    jobs = []
    for job in get_all_jobs():
        j = dict(job)
        raw = j.get("column_map_json")
        if raw:
            try:
                j["column_map"] = json.loads(raw)
            except Exception:
                j["column_map"] = {}
        jobs.append(j)
    return jobs


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str, request: Request):
    _require_permission(request, "jobs.view")
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    resp = dict(job)
    raw = resp.get("column_map_json")
    if raw:
        try:
            resp["column_map"] = json.loads(raw)
        except Exception:
            resp["column_map"] = {}
    return resp


# ─────────────────────────────────────────────────────────────
# PAUSE / RESUME / CANCEL SCHEDULE
# ─────────────────────────────────────────────────────────────

@app.post("/api/jobs/{job_id}/pause")
async def pause_job_route(job_id: str, request: Request):
    user = _require_permission(request, "jobs.manage")
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    ok = pause_job(job_id, reason="manual")
    if not ok:
        raise HTTPException(400, f"Cannot pause job with status '{job['status']}'")
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="jobs.pause",
        status="success",
        path=request.url.path,
        user=user,
        target_type="job",
        target_id=job_id,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "paused", "paused_at_row": job["paused_at_row"]}


class ResumeRequest(BaseModel):
    start_from_row: Optional[int] = None
    delay_minutes:  int = 0


@app.post("/api/jobs/{job_id}/resume")
async def resume_job_route(job_id: str, req: ResumeRequest, request: Request):
    user = _require_permission(request, "jobs.manage")
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    ok = resume_job(job_id, start_from_row=req.start_from_row, delay_minutes=req.delay_minutes)
    if not ok:
        raise HTTPException(400, f"Cannot resume job with status '{job['status']}'")
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="jobs.resume",
        status="success",
        path=request.url.path,
        user=user,
        target_type="job",
        target_id=job_id,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"start_from_row": req.start_from_row, "delay_minutes": req.delay_minutes},
    )
    return {"status": job["status"], "resume_at": job.get("resume_at")}


@app.post("/api/jobs/{job_id}/cancel-schedule")
async def cancel_schedule_route(job_id: str, request: Request):
    user = _require_permission(request, "jobs.manage")
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    ok = cancel_schedule(job_id)
    if not ok:
        raise HTTPException(400, f"Job is not scheduled (status: '{job['status']}')")
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="jobs.cancel_schedule",
        status="success",
        path=request.url.path,
        user=user,
        target_type="job",
        target_id=job_id,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "paused"}


# ─────────────────────────────────────────────────────────────
# WEBSOCKET
# ─────────────────────────────────────────────────────────────

@app.websocket("/ws/jobs/{job_id}")
async def job_websocket(websocket: WebSocket, job_id: str):
    session_id = websocket.cookies.get(AUTH_COOKIE_NAME)
    user = get_session_user(session_id)
    if not user or not (user.get("role") == "owner" or can_manage_permission(user, "jobs.view")):
        await websocket.close(code=4401)
        return
    await websocket.accept()
    q = JOB_QUEUES.get(job_id)
    if not q:
        await websocket.send_text("Job not found")
        await websocket.close()
        return
    try:
        while True:
            try:
                msg = q.get_nowait()
                await websocket.send_text(msg)
                if msg == "__DONE__":
                    break
            except Exception:
                await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        pass


# ─────────────────────────────────────────────────────────────
# RESULTS & DOWNLOAD
# ─────────────────────────────────────────────────────────────

@app.get("/api/results/{job_id}")
async def get_results(job_id: str, request: Request, limit: int = 2000, offset: int = 0):
    _require_permission(request, "jobs.view")
    if limit < 1 or limit > 10000:
        raise HTTPException(400, "limit must be between 1 and 10000")
    if offset < 0:
        raise HTTPException(400, "offset must be >= 0")

    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] != "done":
        raise HTTPException(400, "Job not complete yet")
    csv_file = OUTPUTS_DIR / job["output_csv"]
    if not csv_file.exists():
        raise HTTPException(404, "Output CSV not found")
    columns, paged, total = _read_csv_page(csv_file, offset=offset, limit=limit)
    return {
        "columns":  columns,
        "rows":     paged,
        "total":    total,
        "limit":    limit,
        "offset":   offset,
        "filename": job["output_csv"],
    }


@app.get("/api/download/{filename}")
async def download_csv(filename: str, request: Request):
    user = _require_permission(request, "results.download")
    # Sanitize — prevent path traversal
    safe_name = Path(filename).name
    file_path = (OUTPUTS_DIR / safe_name).resolve()
    if not str(file_path).startswith(str(OUTPUTS_DIR.resolve())):
        raise HTTPException(400, "Invalid filename")
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="results.download",
        status="success",
        path=request.url.path,
        user=user,
        target_type="file",
        target_id=safe_name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return FileResponse(path=str(file_path), filename=safe_name, media_type="text/csv")


# ─────────────────────────────────────────────────────────────
# CONFIG MANAGEMENT — all use update_config() for atomic R-M-W
# ─────────────────────────────────────────────────────────────

@app.get("/api/config")
async def get_config(request: Request):
    user = _require_auth(request)
    config = _mask_config(load_config())
    if user.get("role") != "owner":
        workflows = {}
        for name, workflow in (config.get("workflows") or {}).items():
            if can_access_api(user, workflow.get("api")):
                workflows[name] = workflow
        config["workflows"] = workflows
        allowed_api_names = {workflow.get("api") for workflow in workflows.values()}
        config["apis"] = {
            name: value
            for name, value in (config.get("apis") or {}).items()
            if name in allowed_api_names or can_manage_permission(user, "config.manage")
        }
    return config


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "database": "postgres" if using_postgres() else "sqlite",
    }


@app.get("/api/config/full")
async def get_full_config(request: Request):
    _require_permission(request, "config.manage")
    # Keep this route for backward compatibility but never expose raw token values.
    return _mask_config(load_config())


class SaveConfigRequest(BaseModel):
    config: dict


@app.post("/api/config/save")
async def save_config_route(req: SaveConfigRequest, request: Request):
    user = _require_permission(request, "config.manage")
    save_config(req.config)
    sync_api_policies(req.config)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.save",
        status="success",
        path=request.url.path,
        user=user,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "saved"}


class TokenRequest(BaseModel):
    name:  str
    value: str


@app.post("/api/config/tokens")
async def add_token(req: TokenRequest, request: Request):
    user = _require_permission(request, "config.manage")
    def _add(cfg):
        cfg.setdefault("tokens", {})[req.name] = f"Bearer {req.value}"
    update_config(_add)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.token_add",
        status="success",
        path=request.url.path,
        user=user,
        target_type="token",
        target_id=req.name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "saved"}


@app.delete("/api/config/tokens/{name}")
async def delete_token(name: str, request: Request):
    user = _require_permission(request, "config.manage")
    def _del(cfg):
        cfg.get("tokens", {}).pop(name, None)
    update_config(_del)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.token_delete",
        status="success",
        path=request.url.path,
        user=user,
        target_type="token",
        target_id=name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "deleted"}


class ApiRequest(BaseModel):
    name:             str
    url:              str
    method:           str  = "POST"
    payload_template: dict
    success_codes:    list = [200]
    save_codes:       list = [200, 422]
    retry_codes:      list = [500, 502, 503]


@app.post("/api/config/apis")
async def add_api(req: ApiRequest, request: Request):
    user = _require_permission(request, "config.manage")
    def _add(cfg):
        cfg.setdefault("apis", {})[req.name] = {
            "url":              req.url,
            "method":           req.method,
            "payload_template": req.payload_template,
            "success_codes":    req.success_codes,
            "save_codes":       req.save_codes,
            "retry_codes":      req.retry_codes,
        }
    cfg = update_config(_add)
    sync_api_policies(cfg)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.api_add",
        status="success",
        path=request.url.path,
        user=user,
        target_type="api",
        target_id=req.name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"method": req.method, "url": req.url},
    )
    return {"status": "saved"}


@app.delete("/api/config/apis/{name}")
async def delete_api(name: str, request: Request):
    user = _require_permission(request, "config.manage")
    def _del(cfg):
        cfg.get("apis", {}).pop(name, None)
    update_config(_del)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.api_delete",
        status="success",
        path=request.url.path,
        user=user,
        target_type="api",
        target_id=name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "deleted"}


class WorkflowRequest(BaseModel):
    name:        str
    label:       str
    input_field: str
    api:         str
    token:       str


class IdentifierPatternRequest(BaseModel):
    name: str
    regex: str
    hint_words: list[str] = []
    maps_to_workflow: Optional[str] = None


@app.post("/api/config/workflows")
async def add_workflow(req: WorkflowRequest, request: Request):
    user = _require_permission(request, "config.manage")
    def _add(cfg):
        cfg.setdefault("workflows", {})[req.name] = {
            "label":       req.label,
            "input_field": req.input_field,
            "api":         req.api,
            "token":       req.token,
        }
    update_config(_add)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.workflow_add",
        status="success",
        path=request.url.path,
        user=user,
        target_type="workflow",
        target_id=req.name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
        details={"input_field": req.input_field, "api": req.api},
    )
    return {"status": "saved"}


@app.delete("/api/config/workflows/{name}")
async def delete_workflow(name: str, request: Request):
    user = _require_permission(request, "config.manage")
    def _del(cfg):
        cfg.get("workflows", {}).pop(name, None)
    update_config(_del)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.workflow_delete",
        status="success",
        path=request.url.path,
        user=user,
        target_type="workflow",
        target_id=name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "deleted"}


@app.post("/api/config/identifier-patterns")
async def add_identifier_pattern(req: IdentifierPatternRequest, request: Request):
    user = _require_permission(request, "config.manage")
    def _add(cfg):
        cfg.setdefault("identifier_patterns", {})[req.name] = {
            "regex": req.regex,
            "hint_words": req.hint_words,
            "maps_to_workflow": req.maps_to_workflow,
        }
    update_config(_add)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.identifier_add",
        status="success",
        path=request.url.path,
        user=user,
        target_type="identifier",
        target_id=req.name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "saved"}


@app.delete("/api/config/identifier-patterns/{name}")
async def delete_identifier_pattern(name: str, request: Request):
    user = _require_permission(request, "config.manage")
    def _del(cfg):
        cfg.get("identifier_patterns", {}).pop(name, None)
    update_config(_del)
    ip_address, user_agent = _request_meta(request)
    log_audit(
        action="config.identifier_delete",
        status="success",
        path=request.url.path,
        user=user,
        target_type="identifier",
        target_id=name,
        session_id=request.cookies.get(AUTH_COOKIE_NAME),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return {"status": "deleted"}


# ─────────────────────────────────────────────────────────────
# SERVE REACT FRONTEND — must be last
# ─────────────────────────────────────────────────────────────

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Never serve index.html for API routes — let FastAPI return its own 404
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(404, "Not found")
        return FileResponse(str(FRONTEND_DIST / "index.html"))
