import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const Icon = ({ name, size = 16 }) => {
  const paths = {
    history:  <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>,
    file:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    cpu:      <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></>,
    arrow:    <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
    refresh:  <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
    upload:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    check:    <polyline points="20 6 9 17 4 12" />,
    x:        <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    clock:    <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    filter:   <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    search:   <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    pause:    <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    timer:    <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    rows:     <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n) => (n ?? 0).toLocaleString();

const relativeTime = (iso) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const statusMeta = (status) => {
  switch (status) {
    case "completed":
    case "done":
      return { label: "Completed", variant: "success", pulse: false };
    case "running":
    case "processing":
      return { label: "Running",   variant: "warning", pulse: true  };
    case "paused":
      return { label: "Paused",    variant: "warning", pulse: false };
    case "scheduled":
      return { label: "Scheduled", variant: "info",    pulse: false };
    case "failed":
      return { label: "Failed",    variant: "error",   pulse: false };
    case "queued":
    case "pending":
      return { label: "Queued",    variant: "neutral", pulse: false };
    default:
      return { label: status ?? "Unknown", variant: "neutral", pulse: false };
  }
};

const isComplete  = (s) => s === "completed" || s === "done";
const isActive    = (s) => s === "running" || s === "processing" || s === "paused" || s === "scheduled";

const progressPct = (job) => {
  const total = job.total ?? 0;
  if (!total) return 0;
  const done = (job.success ?? 0) + (job.failed ?? 0) + (job.already_exists ?? 0);
  return Math.min(100, Math.round((done / total) * 100));
};

const navigateTo = (job) => {
  if (isComplete(job.status)) return "results";
  return "monitor";
};

/* ─── Summary Stat Card ───────────────────────────────────────────────────── */
const StatCard = ({ label, value, color, borderColor, sub }) => (
  <div style={{
    background: "var(--bg-card)",
    border: `1px solid ${borderColor}`,
    borderRadius: "var(--radius-card)",
    padding: "16px 20px",
  }}>
    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
      {fmt(value)}
    </div>
    {sub != null && (
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
        {sub}
      </div>
    )}
  </div>
);

/* ─── History Card ────────────────────────────────────────────────────────── */
const HistoryCard = ({ job, index, onClick }) => {
  const { label, variant, pulse } = statusMeta(job.status);
  const pct      = progressPct(job);
  const complete = isComplete(job.status);
  const dest     = navigateTo(job);

  return (
    <div
      className="history-card"
      style={{ animationDelay: `${index * 55}ms` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Top row */}
      <div className="history-card-top">
        <div style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
          <div className="history-card-filename" style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <Icon name="file" size={13} />
            <span className="truncate">{job.filename ?? "Unnamed file"}</span>
          </div>
          <div className="history-card-workflow" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name="cpu" size={11} />
            <span>{job.workflow ?? "—"}</span>
          </div>
        </div>
        <span className={`badge badge--${variant}${pulse ? " badge--pulse" : ""}`}>
          <span className="badge-dot" />{label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="history-card-progress">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {fmt(job.total ?? 0)} rows
          </span>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: complete ? "var(--text-success)" : "var(--text-accent)" }}>
            {pct}%
          </span>
        </div>
        <div className="progress-wrap">
          <div
            className={`progress-bar${complete ? " progress-bar--success" : ""}${job.status === "paused" ? " progress-bar--warning" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      {(job.success != null || job.failed != null) && (
        <div style={{
          display: "flex", gap: 14, marginBottom: 10,
          paddingTop: 8, borderTop: "1px solid var(--border-subtle)",
        }}>
          {[
            { label: "ok",   value: job.success,        color: "var(--text-success)" },
            { label: "422",  value: job.saved_422,       color: "var(--text-warning)" },
            { label: "err",  value: job.failed,          color: "var(--text-error)"   },
            { label: "skip", value: job.already_exists,  color: "var(--text-muted)"   },
          ].map(({ label: l, value, color }) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>
                {fmt(value)}
              </span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {l}
              </span>
            </div>
          ))}

          {/* Paused at info */}
          {job.status === "paused" && job.paused_at_row != null && (
            <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-end" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-warning)", display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="pause" size={10} /> row {job.paused_at_row}
              </span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                paused at
              </span>
            </div>
          )}

          {/* Scheduled resume info */}
          {job.status === "scheduled" && job.resume_at && (
            <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-end" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#a78bfa", display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="timer" size={10} /> {job.resume_at.split(" ")[1] ?? job.resume_at}
              </span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                resumes at
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="history-card-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }}>
          <Icon name="clock" size={11} />
          <span className="history-card-time">{relativeTime(job.started_at)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-accent)", fontWeight: 500 }}>
          {dest === "results" ? "View Results" : "View Monitor"}
          <Icon name="arrow" size={12} />
        </div>
      </div>
    </div>
  );
};

/* ─── Filter Tab ──────────────────────────────────────────────────────────── */
const FilterTab = ({ label, active, onClick, count }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? "var(--accent-dim)" : "transparent",
      border: `1px solid ${active ? "var(--border-accent)" : "transparent"}`,
      borderRadius: "var(--radius-pill)",
      color: active ? "var(--text-accent)" : "var(--text-muted)",
      fontSize: 12, fontWeight: active ? 600 : 400,
      padding: "4px 12px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      transition: "all var(--t-fast) ease",
      fontFamily: "var(--font-body)",
    }}
  >
    {label}
    {count != null && (
      <span style={{
        background: active ? "var(--accent)" : "var(--bg-elevated)",
        color: active ? "#fff" : "var(--text-muted)",
        borderRadius: "var(--radius-pill)",
        fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
        padding: "1px 6px", minWidth: 18, textAlign: "center",
      }}>
        {count}
      </span>
    )}
  </button>
);

/* ─── Main History Page ───────────────────────────────────────────────────── */
export default function History() {
  const navigate = useNavigate();

  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState("all");
  const [search,     setSearch]     = useState("");

  /* ── Fetch jobs ─────────────────────────────────────────────────────── */
  const fetchJobs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res  = await fetch("/api/jobs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sorted = [...data].sort((a, b) =>
        new Date(b.started_at ?? 0) - new Date(a.started_at ?? 0)
      );
      setJobs(sorted);
    } catch {
      // silently fail — page will show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  /* ── Navigate on card click ─────────────────────────────────────────── */
  const handleCardClick = (job) => {
    const id = job.job_id || job.id;
    if (isComplete(job.status)) {
      navigate(`/results/${id}`);
    } else {
      navigate(`/monitor/${id}`);
    }
  };

  /* ── Filter + search logic ──────────────────────────────────────────── */
  const filterFns = {
    all:       () => true,
    running:   (j) => j.status === "running" || j.status === "processing",
    active:    (j) => isActive(j.status),
    paused:    (j) => j.status === "paused" || j.status === "scheduled",
    completed: (j) => isComplete(j.status),
    failed:    (j) => j.status === "failed",
  };

  const counts = {
    all:       jobs.length,
    running:   jobs.filter(filterFns.running).length,
    paused:    jobs.filter(filterFns.paused).length,
    completed: jobs.filter(filterFns.completed).length,
    failed:    jobs.filter(filterFns.failed).length,
  };

  const filteredJobs = jobs
    .filter(filterFns[filter] ?? (() => true))
    .filter((j) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (j.filename  ?? "").toLowerCase().includes(q) ||
        (j.workflow  ?? "").toLowerCase().includes(q) ||
        (j.job_id    ?? "").toLowerCase().includes(q)
      );
    });

  /* ── Summary stats ──────────────────────────────────────────────────── */
  const summaryStats = [
    { label: "Total jobs",  value: jobs.length,         color: "var(--text-primary)",  borderColor: "var(--border)" },
    { label: "Completed",   value: counts.completed,    color: "var(--text-success)",  borderColor: "rgba(16,185,129,0.2)" },
    { label: "Active",      value: counts.running + counts.paused, color: "var(--text-warning)", borderColor: "rgba(245,158,11,0.2)",
      sub: `${counts.running} running · ${counts.paused} paused` },
    { label: "Failed",      value: counts.failed,       color: "var(--text-error)",    borderColor: "rgba(239,68,68,0.2)" },
  ];

  /* ── Loading ────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner spinner--lg" />
        Loading job history…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">
            {jobs.length} batch job{jobs.length !== 1 ? "s" : ""} · click a card to view details
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
            style={{ gap: 6 }}
          >
            <span style={{ display: "inline-flex", animation: refreshing ? "spin 600ms linear infinite" : "none" }}>
              <Icon name="refresh" size={13} />
            </span>
            Refresh
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => navigate("/")} style={{ gap: 6 }}>
            <Icon name="upload" size={13} />
            New Job
          </button>
        </div>
      </div>

      {/* ── Summary stat cards ───────────────────────────────────────── */}
      {jobs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {summaryStats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      {/* ── Filter tabs + search ─────────────────────────────────────── */}
      {jobs.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "all",       label: "All"       },
              { key: "running",   label: "Running"   },
              { key: "paused",    label: "Paused"    },
              { key: "completed", label: "Completed" },
              { key: "failed",    label: "Failed"    },
            ].map(({ key, label }) => (
              <FilterTab
                key={key}
                label={label}
                active={filter === key}
                onClick={() => setFilter(key)}
                count={counts[key]}
              />
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)", pointerEvents: "none", display: "flex",
            }}>
              <Icon name="search" size={12} />
            </span>
            <input
              className="input"
              placeholder="Search by filename or workflow…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 12.5, height: 32, width: 260 }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", display: "flex", padding: 0,
                }}
              >
                <Icon name="x" size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Cards grid / empty states ────────────────────────────────── */}
      {jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="history" size={52} /></div>
          <div className="empty-state-title">No jobs yet</div>
          <div className="empty-state-sub">Upload a CSV and run your first batch job to see it here.</div>
          <button className="btn btn--primary" style={{ marginTop: 4 }} onClick={() => navigate("/")}>
            <Icon name="upload" size={14} /> Upload a file
          </button>
        </div>

      ) : filteredJobs.length === 0 ? (
        <div className="empty-state" style={{ padding: "60px 0" }}>
          <div className="empty-state-icon"><Icon name="filter" size={40} /></div>
          <div className="empty-state-title">
            {search ? `No results for "${search}"` : `No ${filter} jobs`}
          </div>
          <div className="empty-state-sub">
            {search ? "Try a different search term." : "Try a different filter above."}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {search && (
              <button className="btn btn--secondary btn--sm" onClick={() => setSearch("")}>
                Clear search
              </button>
            )}
            {filter !== "all" && (
              <button className="btn btn--secondary btn--sm" onClick={() => setFilter("all")}>
                Show all
              </button>
            )}
          </div>
        </div>

      ) : (
        <>
          {/* Result count when searching/filtering */}
          {(search || filter !== "all") && (
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              Showing{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{filteredJobs.length}</span>
              {" "}of{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{jobs.length}</span>
              {" "}jobs
            </div>
          )}
          <div className="history-grid">
            {filteredJobs.map((job, i) => (
              <HistoryCard
                key={job.job_id}
                job={job}
                index={i}
                onClick={() => handleCardClick(job)}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
}