import { useEffect, useMemo, useState } from "react";

const ROLES = ["viewer", "operator", "admin", "owner"];
const ACCESS_LEVELS = ["viewer", "operator", "admin", "owner"];

const card = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 20,
  boxShadow: "var(--shadow-card)",
};

export default function ControlTower() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", full_name: "", email: "", password: "", role: "operator" });
  const [approvalDrafts, setApprovalDrafts] = useState({});
  const [activityFilters, setActivityFilters] = useState({
    period: "7d",
    date_from: "",
    date_to: "",
    action: "",
    username: "",
    status: "",
    limit: 300,
  });
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/overview");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not load owner control data.");
      setOverview(data);
      setActivityLogs(data.audit_logs || []);
    } catch (err) {
      setError(err.message || "Could not load owner control data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => overview?.stats || {}, [overview]);
  const pendingRequests = useMemo(
    () => (overview?.access_requests || []).filter((request) => request.status === "pending"),
    [overview],
  );
  const actionOptions = useMemo(
    () => [...new Set((overview?.audit_logs || []).map((log) => log.action).filter(Boolean))].sort(),
    [overview],
  );
  const userOptions = useMemo(
    () => [...new Set((overview?.audit_logs || []).map((log) => log.username).filter(Boolean))].sort(),
    [overview],
  );

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not create user.");
      setNewUser({ username: "", full_name: "", email: "", password: "", role: "operator" });
      await refresh();
    } catch (err) {
      setError(err.message || "Could not create user.");
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async (user) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${user.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          password: user.pendingPassword || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not update user.");
      await refresh();
    } catch (err) {
      setError(err.message || "Could not update user.");
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async (policy) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/apis/${policy.api_name}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_level: policy.access_level, enabled: policy.enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not update API policy.");
      await refresh();
    } catch (err) {
      setError(err.message || "Could not update API policy.");
    } finally {
      setSaving(false);
    }
  };

  const resolveRequest = async (request, action) => {
    const draft = approvalDrafts[request.request_id] || {
      role: "operator",
      username: request.requested_username || request.email,
      password: "",
      resolution_note: "",
    };
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/access-requests/${request.request_id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          role: draft.role,
          username: draft.username,
          password: draft.password,
          resolution_note: draft.resolution_note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Could not ${action} access request.`);
      setApprovalDrafts((current) => {
        const next = { ...current };
        delete next[request.request_id];
        return next;
      });
      await refresh();
    } catch (err) {
      setError(err.message || `Could not ${action} access request.`);
    } finally {
      setSaving(false);
    }
  };

  const queryActivity = async () => {
    setActivityLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/activity/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityFilters),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not filter activity logs.");
      setActivityLogs(data.logs || []);
    } catch (err) {
      setError(err.message || "Could not filter activity logs.");
    } finally {
      setActivityLoading(false);
    }
  };

  const exportActivity = () => {
    const params = new URLSearchParams();
    Object.entries(activityFilters).forEach(([key, value]) => {
      if (value !== "" && value != null) params.set(key, String(value));
    });
    window.open(`/api/admin/activity/export?${params.toString()}`, "_blank");
  };

  if (loading) {
    return <div style={{ padding: 32, color: "var(--text-secondary)" }}>Loading owner control tower...</div>;
  }

  if (error && !overview) {
    return <div style={{ padding: 32, color: "var(--text-error)" }}>{error}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Owner Control Tower
          </div>
          <h1 style={{ fontSize: 34, lineHeight: 1.04, marginBottom: 8 }}>Approval queue, user access, API control, and audit history.</h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: 820 }}>
            This is the bottleneck panel. Nobody should get in, run APIs, or widen access without passing through these controls.
          </p>
        </div>
        <button className="btn btn--secondary" onClick={refresh}>Refresh</button>
      </header>

      {error && (
        <div style={{ ...card, borderColor: "rgba(229,83,75,0.2)", background: "rgba(229,83,75,0.06)", color: "var(--text-error)" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14 }}>
        {[
          ["Pending requests", stats.pending_access_requests || 0],
          ["Users", stats.user_count || 0],
          ["Active sessions", stats.active_sessions || 0],
          ["APIs governed", stats.api_count || 0],
          ["Workflows live", stats.workflow_count || 0],
        ].map(([label, value]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 18, alignItems: "start" }}>
        <section style={card}>
          <SectionTitle title="Access approvals" subtitle="Unknown visitors can only request access. The owner must explicitly approve or reject them." />
          <div style={{ display: "grid", gap: 14 }}>
            {pendingRequests.length === 0 && (
              <div style={{ border: "1px dashed var(--border)", borderRadius: 16, padding: 18, color: "var(--text-secondary)" }}>
                No pending access requests right now.
              </div>
            )}
            {pendingRequests.map((request) => (
              <AccessRequestCard
                key={request.request_id}
                request={request}
                draft={approvalDrafts[request.request_id] || {
                  role: "operator",
                  username: request.requested_username || request.email,
                  password: "",
                  resolution_note: "",
                }}
                onChange={(nextDraft) => setApprovalDrafts((current) => ({ ...current, [request.request_id]: nextDraft }))}
                onResolve={resolveRequest}
                busy={saving}
              />
            ))}
          </div>
        </section>

        <section style={card}>
          <SectionTitle title="Entry model" subtitle="Keep one master owner, require approval for everyone else, and keep signup disabled." />
          <div style={{ display: "grid", gap: 12 }}>
            <StatusLine label="Master access" value={overview?.auth?.master_access_enabled ? "Enabled" : "Not configured"} accent={overview?.auth?.master_access_enabled ? "success" : "neutral"} />
            <StatusLine label="Master username" value={overview?.auth?.master_username || "Not set"} accent="neutral" />
            <StatusLine label="Google sign-in" value={overview?.auth?.google_auth_enabled ? "Configured" : "Off"} accent={overview?.auth?.google_auth_enabled ? "success" : "neutral"} />
            <StatusLine label="Access requests" value={overview?.auth?.access_request_enabled ? "Enabled" : "Disabled"} accent={overview?.auth?.access_request_enabled ? "success" : "neutral"} />
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 18, alignItems: "start" }}>
        <section style={card}>
          <SectionTitle title="Users" subtitle="Approved identities only. Email is the main login; username stays optional." />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(overview?.users || []).map((user) => (
              <UserCard key={`${user.user_id}-${user.updated_at || ""}-${user.is_active}`} initialUser={user} onSave={saveUser} busy={saving} />
            ))}
          </div>
        </section>

        <section style={card}>
          <SectionTitle title="Create user" subtitle="Direct owner-created accounts for high-control deployments. No public signup." />
          <form onSubmit={createUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input className="input" value={newUser.email} onChange={(e) => setNewUser((current) => ({ ...current, email: e.target.value }))} placeholder="email (primary login)" />
            <input className="input" value={newUser.username} onChange={(e) => setNewUser((current) => ({ ...current, username: e.target.value }))} placeholder="username (optional)" />
            <input className="input" value={newUser.full_name} onChange={(e) => setNewUser((current) => ({ ...current, full_name: e.target.value }))} placeholder="full name" />
            <input className="input" type="password" value={newUser.password} onChange={(e) => setNewUser((current) => ({ ...current, password: e.target.value }))} placeholder="temporary password" />
            <select className="select" value={newUser.role} onChange={(e) => setNewUser((current) => ({ ...current, role: e.target.value }))}>
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <button className="btn btn--primary" disabled={saving}>{saving ? "Saving..." : "Create user"}</button>
          </form>
        </section>
      </div>

      <section style={card}>
        <SectionTitle title="API execution policies" subtitle="Restrict risky APIs by minimum role and disable any endpoint without deleting it." />
        <div style={{ display: "grid", gap: 12 }}>
          {(overview?.api_policies || []).map((policy) => (
            <ApiPolicyRow key={`${policy.api_name}-${policy.updated_at || ""}-${policy.enabled}`} initialPolicy={policy} onSave={savePolicy} busy={saving} />
          ))}
        </div>
      </section>

      <section style={card}>
        <SectionTitle title="Recent activity" subtitle="This is your audit lane: authentication, approvals, page opens, API runs, and config changes." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr)) auto auto", gap: 10, marginBottom: 16, alignItems: "end" }}>
          <FilterField label="Period">
            <select className="select" value={activityFilters.period} onChange={(e) => setActivityFilters((current) => ({ ...current, period: e.target.value }))}>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="month">This month</option>
              <option value="custom">Custom</option>
            </select>
          </FilterField>
          <FilterField label="From">
            <input className="input" type="date" value={activityFilters.date_from} onChange={(e) => setActivityFilters((current) => ({ ...current, date_from: e.target.value }))} disabled={activityFilters.period !== "custom"} />
          </FilterField>
          <FilterField label="To">
            <input className="input" type="date" value={activityFilters.date_to} onChange={(e) => setActivityFilters((current) => ({ ...current, date_to: e.target.value }))} disabled={activityFilters.period !== "custom"} />
          </FilterField>
          <FilterField label="Action">
            <select className="select" value={activityFilters.action} onChange={(e) => setActivityFilters((current) => ({ ...current, action: e.target.value }))}>
              <option value="">All actions</option>
              {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </FilterField>
          <FilterField label="User">
            <select className="select" value={activityFilters.username} onChange={(e) => setActivityFilters((current) => ({ ...current, username: e.target.value }))}>
              <option value="">All users</option>
              {userOptions.map((username) => <option key={username} value={username}>{username}</option>)}
            </select>
          </FilterField>
          <FilterField label="Status">
            <select className="select" value={activityFilters.status} onChange={(e) => setActivityFilters((current) => ({ ...current, status: e.target.value }))}>
              <option value="">All</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
            </select>
          </FilterField>
          <button className="btn btn--secondary" onClick={queryActivity} disabled={activityLoading}>{activityLoading ? "Filtering..." : "Apply"}</button>
          <button className="btn btn--primary" onClick={exportActivity}>Export CSV</button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {activityLogs.length === 0 && (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 16, padding: 18, color: "var(--text-secondary)" }}>
              No activity matches the selected filter.
            </div>
          )}
          {activityLogs.map((log) => <ActivityLogCard key={log.id} log={log} />)}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>{label}</label>
      {children}
    </div>
  );
}

function ActivityLogCard({ log }) {
  const badgeClass = log.status === "failed" ? "badge--error" : "badge--success";
  const detailEntries = Object.entries(log.details || {});
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 16, background: "rgba(255,255,255,0.015)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "180px minmax(220px, 1fr) 170px 110px", gap: 14, alignItems: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: 11, whiteSpace: "nowrap" }}>
          {new Date(log.created_at).toLocaleString()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--text-primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {log.username || "anonymous"}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 11.5, fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {log.path || log.target_id || "Activity recorded"}
          </div>
        </div>
        <div style={{ color: "var(--text-accent)", fontFamily: "var(--font-mono)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {log.action}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span className={`badge ${badgeClass}`}>{log.status}</span>
        </div>
      </div>
      {detailEntries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {detailEntries.map(([key, value]) => (
            <div key={key} style={{ borderRadius: 999, border: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.02)", padding: "5px 10px", maxWidth: "100%" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{key}</span>
              <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontSize: 12, wordBreak: "break-word" }}>{formatDetailValue(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDetailValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function StatusLine({ label, value, accent }) {
  const color = accent === "success" ? "var(--text-success)" : "var(--text-secondary)";
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{label}</div>
      <div style={{ color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function AccessRequestCard({ request, draft, onChange, onResolve, busy }) {
  return (
    <div style={{ border: "1px solid rgba(79,140,255,0.18)", borderRadius: 18, padding: 16, background: "rgba(79,140,255,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{request.full_name}</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>{request.email}</div>
        </div>
        <span className="badge badge--warning">pending approval</span>
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 12 }}>
        {request.company_name ? `${request.company_name} • ` : ""}Requested {new Date(request.created_at).toLocaleString()}
        {request.note ? <div style={{ marginTop: 6 }}>{request.note}</div> : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 150px 170px", gap: 10 }}>
        <input className="input" value={draft.username} onChange={(e) => onChange({ ...draft, username: e.target.value })} placeholder="approved username" />
        <select className="select" value={draft.role} onChange={(e) => onChange({ ...draft, role: e.target.value })}>
          {ROLES.filter((role) => role !== "owner").map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <input className="input" type="password" value={draft.password} onChange={(e) => onChange({ ...draft, password: e.target.value })} placeholder="temporary password" />
        <input className="input" value={draft.resolution_note} onChange={(e) => onChange({ ...draft, resolution_note: e.target.value })} placeholder="owner note" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
        <button className="btn btn--secondary" onClick={() => onResolve(request, "reject")} disabled={busy}>Reject</button>
        <button className="btn btn--primary" onClick={() => onResolve(request, "approve")} disabled={busy}>Approve and create user</button>
      </div>
    </div>
  );
}

function UserCard({ initialUser, onSave, busy }) {
  const [user, setUser] = useState({ ...initialUser, pendingPassword: "" });
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 16, background: "rgba(255,255,255,0.015)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{user.full_name}</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>{user.email || user.username}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`badge ${user.is_active ? "badge--success" : "badge--error"}`}>{user.is_active ? "active" : "disabled"}</span>
          <span className="badge badge--neutral">{user.role}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 150px 170px 120px", gap: 10 }}>
        <input className="input" value={user.full_name} onChange={(e) => setUser((current) => ({ ...current, full_name: e.target.value }))} />
        <input className="input" value={user.email || ""} onChange={(e) => setUser((current) => ({ ...current, email: e.target.value }))} placeholder="email / Google identity" />
        <select className="select" value={user.role} onChange={(e) => setUser((current) => ({ ...current, role: e.target.value }))} disabled={initialUser.role === "owner"}>
          {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <input className="input" type="password" value={user.pendingPassword} onChange={(e) => setUser((current) => ({ ...current, pendingPassword: e.target.value }))} placeholder="reset password" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
          <input type="checkbox" checked={user.is_active} onChange={(e) => setUser((current) => ({ ...current, is_active: e.target.checked }))} disabled={initialUser.role === "owner"} />
          Active
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 11.5, fontFamily: "var(--font-mono)" }}>
          Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}{user.email ? ` • ${user.email}` : ""}
        </div>
        <button className="btn btn--secondary" onClick={() => onSave(user)} disabled={busy}>Save</button>
      </div>
    </div>
  );
}

function ApiPolicyRow({ initialPolicy, onSave, busy }) {
  const [policy, setPolicy] = useState({ ...initialPolicy, enabled: Boolean(initialPolicy.enabled) });
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 16, display: "grid", gridTemplateColumns: "1.3fr 180px 110px 90px", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{policy.api_name}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
          Minimum role gate for execution access
        </div>
      </div>
      <select className="select" value={policy.access_level} onChange={(e) => setPolicy((current) => ({ ...current, access_level: e.target.value }))}>
        {ACCESS_LEVELS.map((role) => <option key={role} value={role}>{role}</option>)}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
        <input type="checkbox" checked={policy.enabled} onChange={(e) => setPolicy((current) => ({ ...current, enabled: e.target.checked }))} />
        Enabled
      </label>
      <button className="btn btn--secondary" onClick={() => onSave(policy)} disabled={busy}>Save</button>
    </div>
  );
}
