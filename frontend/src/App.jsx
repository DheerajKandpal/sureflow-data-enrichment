import { useEffect, useState, useCallback } from "react";
import {
  BrowserRouter, Routes, Route, NavLink, useLocation, Navigate,
} from "react-router-dom";
import Upload from "./pages/Upload";
import Monitor from "./pages/Monitor";
import Results from "./pages/Results";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Dashboard from "./pages/Dashboard";
import ManualLab from "./pages/ManualLab";
import Login from "./pages/Login";
import ControlTower from "./pages/ControlTower";
import "./App.css";

const hasPermission = (user, code) => !!user && (user.role === "owner" || (user.permissions || []).includes(code));

const getDefaultRoute = (user) => {
  if (hasPermission(user, "jobs.run")) return "/";
  if (hasPermission(user, "dashboard.view")) return "/dashboard";
  if (hasPermission(user, "jobs.view")) return "/history";
  if (hasPermission(user, "control.view")) return "/control";
  return "/";
};

const Icon = ({ name, size = 18 }) => {
  const paths = {
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    history: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M4.93 4.93a10 10 0 0 0 0 14.14" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></>,
    results: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    lab: <><path d="M10 2v7.31L4.62 16.5A2 2 0 0 0 6.34 20h11.32a2 2 0 0 0 1.72-3.5L14 9.3V2" /><line x1="8.5" y1="2" x2="15.5" y2="2" /></>,
    logo: <><path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9" /><path d="M2 17l10 5 10-5" strokeWidth="2" fill="none" stroke="currentColor" /><path d="M2 12l10 5 10-5" strokeWidth="2" fill="none" stroke="currentColor" opacity="0.6" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

const NavItem = ({ to, icon, label, exact = false, badge = null }) => (
  <NavLink to={to} end={exact} className={({ isActive }) => `sidebar-nav-item${isActive ? " sidebar-nav-item--active" : ""}`}>
    <span className="sidebar-nav-icon"><Icon name={icon} size={16} /></span>
    <span className="sidebar-nav-label">{label}</span>
    {badge != null && badge > 0 && (
      <span style={{ marginLeft: "auto", background: "var(--accent)", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", borderRadius: 99, padding: "1px 6px", minWidth: 16, textAlign: "center", animation: "pulseDot 1.4s ease-in-out infinite", lineHeight: "14px" }}>
        {badge}
      </span>
    )}
  </NavLink>
);

const PageTransition = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState("idle");

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      const exitTimer = setTimeout(() => setStage("exit"), 0);
      const t = setTimeout(() => {
        setDisplayLocation(location);
        setStage("enter");
        requestAnimationFrame(() => setTimeout(() => setStage("idle"), 320));
      }, 120);
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(t);
      };
    }
  }, [location, displayLocation]);

  return <div className={`page-transition page-transition--${stage}`} key={displayLocation.pathname}>{children}</div>;
};

const crumbMap = {
  "": "Upload",
  monitor: "Monitor",
  results: "Results",
  history: "History",
  settings: "Settings",
  dashboard: "Dashboard",
  lab: "Manual Lab",
  control: "Control Tower",
};

const Breadcrumb = ({ location }) => {
  const parts = location.pathname.split("/").filter(Boolean);
  const section = crumbMap[parts[0] ?? ""] ?? parts[0];
  const id = parts[1];
  return (
    <div className="breadcrumb">
      <span className="breadcrumb-root">SureFlow</span>
      <span className="breadcrumb-sep">/</span>
      <span className="breadcrumb-current">{section}</span>
      {id && id !== "latest" && <><span className="breadcrumb-sep">/</span><span className="breadcrumb-id">{id}</span></>}
    </div>
  );
};

function Guard({ user, permission, children }) {
  if (!hasPermission(user, permission)) {
    return <Navigate to={getDefaultRoute(user)} replace />;
  }
  return children;
}

function Sidebar({ runningCount, user }) {
  const location = useLocation();
  const isMonitor = location.pathname.startsWith("/monitor");
  const isResults = location.pathname.startsWith("/results");

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark"><Icon name="logo" size={22} /></div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">SureFlow</span>
          <span className="sidebar-logo-tagline">Secure Control Plane</span>
        </div>
      </div>

      <div className="sidebar-divider" />

      <nav className="sidebar-nav">
        <span className="sidebar-nav-section">WORKSPACE</span>
        {hasPermission(user, "jobs.run") && <NavItem to="/" icon="upload" label="Upload" exact />}
        {hasPermission(user, "jobs.view") && (
          <NavItem to={isMonitor ? location.pathname : "/monitor/latest"} icon="monitor" label="Monitor" badge={runningCount} />
        )}
        {hasPermission(user, "jobs.view") && (
          <NavItem to={isResults ? location.pathname : "/results/latest"} icon="results" label="Results" />
        )}
        {hasPermission(user, "manual_lab.run") && <NavItem to="/lab" icon="lab" label="Manual Lab" />}
        {hasPermission(user, "dashboard.view") && <NavItem to="/dashboard" icon="dashboard" label="Dashboard" />}
        {hasPermission(user, "jobs.view") && <NavItem to="/history" icon="history" label="History" />}

        {(hasPermission(user, "config.manage") || hasPermission(user, "control.view")) && (
          <>
            <span className="sidebar-nav-section" style={{ marginTop: 20 }}>CONTROL</span>
            {hasPermission(user, "config.manage") && <NavItem to="/settings" icon="settings" label="Settings" />}
            {hasPermission(user, "control.view") && <NavItem to="/control" icon="shield" label="Control Tower" />}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-status">
          <span className="sidebar-footer-dot" />
          <span className="sidebar-footer-text">{user.role}</span>
        </div>
        <span className="sidebar-footer-version">v2.1 secure</span>
      </div>
    </aside>
  );
}

function AuthenticatedShell({ user, onLogout }) {
  const location = useLocation();
  const [runningCount, setRunningCount] = useState(0);

  const pollRunning = useCallback(async () => {
    if (!hasPermission(user, "jobs.view")) return;
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) return;
      const jobs = await res.json();
      setRunningCount(jobs.filter((j) => j.status === "running" || j.status === "processing").length);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    const initialPoll = setTimeout(() => pollRunning(), 0);
    const id = setInterval(pollRunning, 5000);
    return () => {
      clearTimeout(initialPoll);
      clearInterval(id);
    };
  }, [pollRunning]);

  useEffect(() => {
    fetch("/api/activity/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location.pathname, title: crumbMap[location.pathname.split("/").filter(Boolean)[0] ?? ""] || "SureFlow" }),
    }).catch(() => {});
  }, [location]);

  return (
    <div className="app-shell">
      <Sidebar runningCount={runningCount} user={user} />
      <main className="app-main">
        <div className="app-topbar">
          <Breadcrumb location={location} />
          <div className="app-topbar-right">
            {runningCount > 0 && (
              <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-warning)", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, padding: "3px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warning, #f59e0b)", display: "inline-block", animation: "pulseDot 1.4s ease-in-out infinite" }} />
                {runningCount} job{runningCount !== 1 ? "s" : ""} running
              </div>
            )}
            <div className="topbar-badge">
              <span className="topbar-badge-dot" />
              Session protected
            </div>
            <div className="topbar-user-card">
              <div>
                <div className="topbar-user-name">{user.full_name}</div>
                <div className="topbar-user-role">{user.role}</div>
              </div>
              <button className="btn btn--secondary topbar-logout-btn" onClick={onLogout}>
                <Icon name="logout" size={14} />
                Logout
              </button>
            </div>
          </div>
        </div>
        <div className="app-content">
          <PageTransition>
            <Routes location={location}>
              <Route path="/" element={<Guard user={user} permission="jobs.run"><Upload /></Guard>} />
              <Route path="/monitor/:job_id" element={<Guard user={user} permission="jobs.view"><Monitor /></Guard>} />
              <Route path="/results/:job_id" element={<Guard user={user} permission="jobs.view"><Results /></Guard>} />
              <Route path="/lab" element={<Guard user={user} permission="manual_lab.run"><ManualLab /></Guard>} />
              <Route path="/history" element={<Guard user={user} permission="jobs.view"><History /></Guard>} />
              <Route path="/settings" element={<Guard user={user} permission="config.manage"><Settings /></Guard>} />
              <Route path="/dashboard" element={<Guard user={user} permission="dashboard.view"><Dashboard /></Guard>} />
              <Route path="/control" element={<Guard user={user} permission="control.view"><ControlTower /></Guard>} />
              <Route path="*" element={<Navigate to={getDefaultRoute(user)} replace />} />
            </Routes>
          </PageTransition>
        </div>
      </main>
    </div>
  );
}

function AppRoot() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [user, setUser] = useState(null);

  const refreshSession = useCallback(async () => {
    setBootstrapping(true);
    try {
      const bootstrapRes = await fetch("/api/auth/bootstrap-status");
      const bootstrapData = await bootstrapRes.json().catch(() => ({ needs_bootstrap: false }));
      setNeedsBootstrap(Boolean(bootstrapData.needs_bootstrap));

      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        setUser(null);
        return;
      }
      const meData = await meRes.json();
      setUser(meData.user);
    } finally {
      setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setNeedsBootstrap(false);
  }, []);

  if (bootstrapping) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(135deg, #08101b 0%, #0a1322 36%, #060a12 100%)", color: "var(--text-secondary)" }}>
        Loading secure workspace...
      </div>
    );
  }

  return user
    ? <AuthenticatedShell user={user} onLogout={logout} />
    : <Login needsBootstrap={needsBootstrap} onAuthenticated={(nextUser) => setUser(nextUser)} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<AppRoot />} />
      </Routes>
    </BrowserRouter>
  );
}
