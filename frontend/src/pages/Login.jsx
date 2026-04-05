import { useEffect, useMemo, useState } from "react";

const shellStyle = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(420px, 0.8fr)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(79,140,255,0.16), transparent 28%), radial-gradient(circle at 100% 100%, rgba(14,164,114,0.14), transparent 24%), linear-gradient(135deg, #07111d 0%, #091321 34%, #050911 100%)",
};

const panelStyle = {
  width: "100%",
  maxWidth: 520,
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(14,19,32,0.95), rgba(9,13,23,0.98))",
  boxShadow: "0 28px 90px rgba(0,0,0,0.48)",
  overflow: "hidden",
};

const inputStyle = {
  width: "100%",
  background: "rgba(7, 12, 22, 0.92)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 14,
  padding: "13px 14px",
  fontSize: 14,
};

const tabStyle = (active) => ({
  flex: 1,
  padding: "11px 14px",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 700,
  background: active ? "rgba(79,140,255,0.14)" : "transparent",
  color: active ? "var(--text-accent)" : "var(--text-secondary)",
  border: active ? "1px solid rgba(79,140,255,0.18)" : "1px solid transparent",
});

export default function Login({ needsBootstrap, onAuthenticated }) {
  const [mode, setMode] = useState(needsBootstrap ? "bootstrap" : "login");
  const [signin, setSignin] = useState({ username: "", password: "", remember_me: true });
  const [bootstrap, setBootstrap] = useState({ username: "", password: "", full_name: "" });
  const [requestForm, setRequestForm] = useState({ email: "", requested_username: "", full_name: "", company_name: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [providers, setProviders] = useState({
    google_auth_enabled: false,
    master_access_enabled: false,
    master_username: null,
    access_request_enabled: true,
  });

  const title = useMemo(() => {
    if (mode === "bootstrap") return "Create the owner account";
    if (mode === "request") return "Request workspace access";
    return "Sign in to SureFlow";
  }, [mode]);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => res.ok ? res.json() : Promise.reject(res.status))
      .then((data) => setProviders(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (!authError) return;
    const messages = {
      google_not_configured: "Google sign-in is not configured yet.",
      invalid_google_state: "Google sign-in could not be verified. Please try again.",
      google_exchange_failed: "Google did not complete the sign-in exchange.",
      google_profile_invalid: "Google returned an incomplete profile.",
      google_domain_restricted: "This Google account is outside the allowed workspace domain.",
      google_user_not_allowed: "This Google account is not approved in SureFlow yet.",
      access_denied: "Google sign-in was canceled.",
    };
    setError(messages[authError] || "Authentication failed.");
    params.delete("auth_error");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const submitSignin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "bootstrap" ? "/api/auth/bootstrap" : "/api/auth/login";
      const payload = mode === "bootstrap"
        ? {
            username: bootstrap.username.trim(),
            password: bootstrap.password,
            full_name: bootstrap.full_name.trim() || bootstrap.username.trim(),
          }
        : {
            username: signin.username.trim(),
            password: signin.password,
            remember_me: signin.remember_me,
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Authentication failed.");
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setRequestLoading(true);
    setError("");
    setRequestMessage("");
    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not submit access request.");
      setRequestMessage("Access request submitted. An owner must approve it before you can enter.");
      setRequestForm({ email: "", requested_username: "", full_name: "", company_name: "", note: "" });
    } catch (err) {
      setError(err.message || "Could not submit access request.");
    } finally {
      setRequestLoading(false);
    }
  };

  const googleSignIn = () => {
    window.location.href = "/api/auth/google/start";
  };

  return (
    <div style={shellStyle}>
      <div style={{ padding: "72px 76px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 16 }}>
            Approval-only workspace
          </div>
          <h1 style={{ fontSize: 62, lineHeight: 0.98, letterSpacing: "-0.045em", marginBottom: 18 }}>
            Entry is gated until permission is granted.
          </h1>
          <p style={{ fontSize: 18, color: "var(--text-secondary)", maxWidth: 620 }}>
            SureFlow is now built like a controlled operations room. Approved users can enter and work. Everyone else stays outside the bottleneck until the owner approves access.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18, maxWidth: 860 }}>
          {[
            ["Bottleneck access", "Unknown visitors can request access, but they cannot open the workspace until approved."],
            ["Owner control", "The master owner approves users, manages APIs, and sees the audit trail."],
            ["Safer rollout", "No public signup, no silent account creation, and no uncontrolled entry path."],
          ].map(([label, copy]) => (
            <div key={label} style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 20, background: "rgba(9,14,24,0.58)" }}>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-accent)", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 14.5 }}>{copy}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={panelStyle}>
          <div style={{ padding: "28px 30px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {needsBootstrap ? (
                <button type="button" style={tabStyle(true)}>Bootstrap Owner</button>
              ) : (
                <>
                  <button type="button" style={tabStyle(mode !== "request")} onClick={() => { setMode("login"); setError(""); setRequestMessage(""); }}>Sign In</button>
                  <button type="button" style={tabStyle(mode === "request")} onClick={() => { setMode("request"); setError(""); setRequestMessage(""); }}>Request Access</button>
                </>
              )}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
            <div style={{ color: "var(--text-secondary)", marginTop: 10, fontSize: 14.5 }}>
              {mode === "bootstrap" && "First-run setup creates the initial owner account."}
              {mode === "login" && "Approved users sign in here using email or username."}
              {mode === "request" && "Submit your details for owner review. Access is not granted automatically."}
            </div>
          </div>

          <div style={{ padding: 30 }}>
            {mode === "request" ? (
              <form onSubmit={submitRequest} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Email">
                  <input style={inputStyle} value={requestForm.email} onChange={(e) => setRequestForm((v) => ({ ...v, email: e.target.value }))} placeholder="name@company.com" />
                </Field>
                <Field label="Full name">
                  <input style={inputStyle} value={requestForm.full_name} onChange={(e) => setRequestForm((v) => ({ ...v, full_name: e.target.value }))} placeholder="Your full name" />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Requested username">
                    <input style={inputStyle} value={requestForm.requested_username} onChange={(e) => setRequestForm((v) => ({ ...v, requested_username: e.target.value }))} placeholder="optional username" />
                  </Field>
                  <Field label="Company">
                    <input style={inputStyle} value={requestForm.company_name} onChange={(e) => setRequestForm((v) => ({ ...v, company_name: e.target.value }))} placeholder="Company name" />
                  </Field>
                </div>
                <Field label="Why do you need access?">
                  <textarea style={{ ...inputStyle, minHeight: 92, resize: "vertical" }} value={requestForm.note} onChange={(e) => setRequestForm((v) => ({ ...v, note: e.target.value }))} placeholder="Short note for the owner panel" />
                </Field>
                <ActionMessage error={error} success={requestMessage} />
                <button type="submit" className="btn btn--primary" disabled={requestLoading}>
                  {requestLoading ? "Submitting..." : "Submit Access Request"}
                </button>
              </form>
            ) : (
              <form onSubmit={submitSignin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label={mode === "bootstrap" ? "Master username" : "Email or username"}>
                  <input
                    style={inputStyle}
                    value={mode === "bootstrap" ? bootstrap.username : signin.username}
                    onChange={(e) => mode === "bootstrap"
                      ? setBootstrap((v) => ({ ...v, username: e.target.value }))
                      : setSignin((v) => ({ ...v, username: e.target.value }))}
                    placeholder={mode === "bootstrap" ? "master-owner" : "name@company.com or username"}
                  />
                </Field>
                {mode === "bootstrap" && (
                  <Field label="Full name">
                    <input style={inputStyle} value={bootstrap.full_name} onChange={(e) => setBootstrap((v) => ({ ...v, full_name: e.target.value }))} placeholder="Owner full name" />
                  </Field>
                )}
                <Field label="Password">
                  <input type="password" style={inputStyle} value={mode === "bootstrap" ? bootstrap.password : signin.password} onChange={(e) => mode === "bootstrap"
                    ? setBootstrap((v) => ({ ...v, password: e.target.value }))
                    : setSignin((v) => ({ ...v, password: e.target.value }))} placeholder="At least 8 characters" />
                </Field>
                {mode === "login" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)", fontSize: 13 }}>
                    <input type="checkbox" checked={signin.remember_me} onChange={(e) => setSignin((v) => ({ ...v, remember_me: e.target.checked }))} />
                    Keep this session signed in
                  </label>
                )}
                <ActionMessage error={error} success={requestMessage} />
                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading ? "Please wait..." : mode === "bootstrap" ? "Create Owner and Enter" : "Sign In"}
                </button>
                {mode === "login" && providers.google_auth_enabled && (
                  <button type="button" className="btn btn--secondary" onClick={googleSignIn}>Sign In With Google</button>
                )}
                {mode === "login" && providers.master_access_enabled && (
                  <div style={{ borderRadius: 14, border: "1px solid rgba(79,140,255,0.18)", background: "rgba(79,140,255,0.08)", color: "var(--text-secondary)", padding: "12px 14px", fontSize: 13.5 }}>
                    <div style={{ color: "var(--text-accent)", fontWeight: 700, marginBottom: 4 }}>Master access available</div>
                    <div>The protected owner account is available as <strong>{providers.master_username}</strong>.</div>
                  </div>
                )}
                {mode === "login" && providers.access_request_enabled && (
                  <button type="button" onClick={() => { setMode("request"); setError(""); setRequestMessage(""); }} style={{ background: "transparent", color: "var(--text-accent)", fontSize: 13, padding: "4px 0" }}>
                    Need approval first? Request access
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

function ActionMessage({ error, success }) {
  if (error) {
    return (
      <div style={{ borderRadius: 14, border: "1px solid rgba(229,83,75,0.24)", background: "rgba(229,83,75,0.09)", color: "var(--text-error)", padding: "12px 14px", fontSize: 13.5 }}>
        {error}
      </div>
    );
  }
  if (success) {
    return (
      <div style={{ borderRadius: 14, border: "1px solid rgba(14,164,114,0.24)", background: "rgba(14,164,114,0.09)", color: "var(--text-success)", padding: "12px 14px", fontSize: 13.5 }}>
        {success}
      </div>
    );
  }
  return null;
}
