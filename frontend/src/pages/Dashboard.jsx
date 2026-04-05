import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const Icon = ({ name, size = 16 }) => {
  const paths = {
    pause:   <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    play:    <polygon points="5 3 19 12 5 21 5 3" />,
    arrow:   <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
    refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
    cpu:     <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></>,
    file:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    check:   <polyline points="20 6 9 17 4 12" />,
    x:       <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    clock:   <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    zap:     <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    upload:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    timer:   <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    ban:     <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>,
    alert:   <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    search:  <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    copy:    <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
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

const calcElapsed = (startedAt) => {
  if (!startedAt) return "—";
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
};

const calcCountdown = (resumeAt) => {
  if (!resumeAt) return null;
  const diff = Math.max(0, Math.floor((new Date(resumeAt).getTime() - Date.now()) / 1000));
  if (diff <= 0) return "now";
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60), s = diff % 60;
  return `${m}m ${s}s`;
};

const progressPct = (job) => {
  const total = job.total ?? 0;
  if (!total) return 0;
  const done = (job.success ?? 0) + (job.failed ?? 0) + (job.already_exists ?? 0);
  return Math.min(100, Math.round((done / total) * 100));
};

const STATUS_META = {
  running:    { label: "Running",   color: "var(--text-warning)", dim: "rgba(245,158,11,0.12)",  pulse: true  },
  processing: { label: "Running",   color: "var(--text-warning)", dim: "rgba(245,158,11,0.12)",  pulse: true  },
  paused:     { label: "Paused",    color: "var(--text-accent)",  dim: "rgba(59,130,246,0.12)",  pulse: false },
  scheduled:  { label: "Scheduled", color: "#a78bfa",             dim: "rgba(167,139,250,0.12)", pulse: false },
  done:       { label: "Done",      color: "var(--text-success)", dim: "rgba(16,185,129,0.12)",  pulse: false },
  completed:  { label: "Done",      color: "var(--text-success)", dim: "rgba(16,185,129,0.12)",  pulse: false },
  failed:     { label: "Failed",    color: "var(--text-error)",   dim: "rgba(239,68,68,0.12)",   pulse: false },
  pending:    { label: "Pending",   color: "var(--text-muted)",   dim: "var(--bg-elevated)",     pulse: false },
};

const isActive   = (s) => ["running", "processing", "paused", "scheduled"].includes(s);
const isComplete = (s) => s === "done" || s === "completed";

/* ─── Toast ──────────────────────────────────────────────────────────────── */
const Toast = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map(t => (
      <div key={t.id} className={`toast toast--${t.type}${t.dismissing ? " toast--dismissing" : ""}`}>
        <div className="toast-icon">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "i"}</div>
        <span className="toast-message">{t.message}</span>
      </div>
    ))}
  </div>
);

/* ─── Summary Card ───────────────────────────────────────────────────────── */
const SummaryCard = ({ label, value, color, borderColor, icon, index, sub }) => (
  <div className="metric-card" style={{
    animationDelay: `${index * 50}ms`,
    animation: "cardIn 280ms var(--ease-out) both",
    borderColor,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div className="metric-label">{label}</div>
      <div style={{ color, opacity: 0.8 }}><Icon name={icon} size={14} /></div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color, letterSpacing: "-0.03em", lineHeight: 1 }}>
      {fmt(value)}
    </div>
    {sub && <div className="metric-sub" style={{ marginTop: 4 }}>{sub}</div>}
  </div>
);

/* ─── Live Elapsed Cell ──────────────────────────────────────────────────── */
const ElapsedCell = ({ startedAt, active }) => {
  const [text, setText] = useState(calcElapsed(startedAt));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setText(calcElapsed(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt, active]);
  return (
    <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
      <Icon name="clock" size={11} />{text}
    </div>
  );
};

/* ─── Countdown Cell ─────────────────────────────────────────────────────── */
const CountdownCell = ({ resumeAt }) => {
  const [text, setText] = useState(calcCountdown(resumeAt));
  useEffect(() => {
    const id = setInterval(() => setText(calcCountdown(resumeAt)), 1000);
    return () => clearInterval(id);
  }, [resumeAt]);
  return (
    <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "var(--font-mono)" }}>
      ⏰ {text}
    </span>
  );
};

/* ─── Job Row ────────────────────────────────────────────────────────────── */
const JobRow = ({ job, onPause, onResume, onCancelSchedule, onNavigate, pausing, cancelling }) => {
  const [copied, setCopied] = useState(false);
  const meta   = STATUS_META[job.status] || STATUS_META.pending;
  const pct    = progressPct(job);
  const isRun  = job.status === "running" || job.status === "processing";
  const isPause = job.status === "paused";
  const isSched = job.status === "scheduled";
  const isDone  = isComplete(job.status);
  const isFail  = job.status === "failed";
  const active  = isActive(job.status);

  const handleCopyId = () => {
    navigator.clipboard.writeText(job.job_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <tr
      style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 150ms" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Status */}
      <td style={{ padding: "12px 14px", width: 120 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: meta.dim, borderRadius: 6, padding: "3px 10px",
        }}>
          {meta.pulse && (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, display: "inline-block", animation: "pulseDot 1.4s ease-in-out infinite", flexShrink: 0 }} />
          )}
          {isSched && <Icon name="timer" size={11} />}
          <span style={{ fontSize: 11.5, fontWeight: 600, color: meta.color, fontFamily: "var(--font-mono)" }}>
            {meta.label}
          </span>
        </div>
      </td>

      {/* File + workflow + job ID */}
      <td style={{ padding: "12px 14px", minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {job.filename || "—"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
          <Icon name="cpu" size={10} />{job.workflow || "—"}
        </div>
        {/* Job ID with copy */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            borderRadius: 4, padding: "1px 6px", letterSpacing: "0.02em",
          }}>
            {job.job_id?.slice(0, 8)}…
          </span>
          <button
            onClick={handleCopyId}
            title="Copy full job ID"
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "1px 4px",
              color: copied ? "var(--text-success)" : "var(--text-muted)",
              display: "flex", alignItems: "center", borderRadius: 4,
              transition: "color 150ms",
            }}
          >
            <Icon name={copied ? "check" : "copy"} size={10} />
          </button>
        </div>
      </td>

      {/* Progress */}
      <td style={{ padding: "12px 14px", width: 190 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          <span>{fmt(job.progress ?? 0)} / {fmt(job.total ?? 0)}</span>
          <span style={{ color: isDone ? "var(--text-success)" : "var(--text-accent)" }}>{pct}%</span>
        </div>
        <div className="progress-wrap" style={{ height: 5 }}>
          <div
            className={`progress-bar${isRun ? " progress-bar--shimmer" : ""}${isDone ? " progress-bar--success" : ""}${isPause ? " progress-bar--warning" : ""}`}
            style={{ width: `${pct}%`, height: 5 }}
          />
        </div>
        {isSched && job.resume_at && (
          <div style={{ marginTop: 5 }}>
            <CountdownCell resumeAt={job.resume_at} />
          </div>
        )}
        {isFail && job.error && (
          <div style={{ fontSize: 10, color: "var(--text-error)", fontFamily: "var(--font-mono)", marginTop: 4, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.error}
          </div>
        )}
      </td>

      {/* Stats */}
      <td style={{ padding: "12px 14px", width: 160 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { v: job.success,        c: "var(--text-success)", l: "ok"   },
            { v: job.saved_422,      c: "var(--text-warning)", l: "422"  },
            { v: job.failed,         c: "var(--text-error)",   l: "err"  },
            { v: job.already_exists, c: "var(--text-muted)",   l: "skip" },
          ].map(({ v, c, l }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: c }}>{fmt(v)}</div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
            </div>
          ))}
        </div>
      </td>

      {/* Elapsed — live ticker for active jobs */}
      <td style={{ padding: "12px 14px", width: 90 }}>
        <ElapsedCell startedAt={job.started_at} active={active} />
      </td>

      {/* Actions */}
      <td style={{ padding: "12px 14px", width: 210 }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
          {isRun && (
            <button className="btn btn--secondary btn--sm"
              onClick={() => onPause(job.job_id)}
              disabled={pausing === job.job_id}
              style={{ gap: 4, color: "var(--text-warning)", borderColor: "rgba(245,158,11,0.3)", padding: "4px 10px", fontSize: 11.5 }}>
              {pausing === job.job_id
                ? <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                : <Icon name="pause" size={11} />}
              Pause
            </button>
          )}
          {isPause && (
            <button className="btn btn--primary btn--sm"
              onClick={() => onResume(job.job_id)}
              style={{ gap: 4, padding: "4px 10px", fontSize: 11.5 }}>
              <Icon name="play" size={11} />Resume
            </button>
          )}
          {isSched && (
            <>
              <button className="btn btn--secondary btn--sm"
                onClick={() => onCancelSchedule(job.job_id)}
                disabled={cancelling === job.job_id}
                style={{ gap: 4, padding: "4px 10px", fontSize: 11.5, color: "var(--text-error)", borderColor: "rgba(239,68,68,0.3)" }}>
                {cancelling === job.job_id
                  ? <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                  : <Icon name="ban" size={11} />}
                Cancel
              </button>
              <button className="btn btn--primary btn--sm"
                onClick={() => onResume(job.job_id)}
                style={{ gap: 4, padding: "4px 10px", fontSize: 11.5 }}>
                <Icon name="play" size={11} />Now
              </button>
            </>
          )}
          <button className="btn btn--secondary btn--sm"
            onClick={() => onNavigate(job)}
            style={{ gap: 4, padding: "4px 10px", fontSize: 11.5 }}>
            {isDone ? "Results" : "Monitor"}
            <Icon name="arrow" size={11} />
          </button>
        </div>
      </td>
    </tr>
  );
};

/* ─── Main Dashboard ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();

  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [pausing,    setPausing]    = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [toasts,     setToasts]     = useState([]);
  const [filter,     setFilter]     = useState("active");
  const [search,     setSearch]     = useState("");
  const pollRef = useRef(null);

  /* ── Toast ─────────────────────────────────────────────────────────── */
  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => {
      setToasts(p => p.map(t => t.id === id ? { ...t, dismissing: true } : t));
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 300);
    }, 3200);
  }, []);

  /* ── Fetch ──────────────────────────────────────────────────────────── */
  const fetchJobs = useCallback(async () => {
    try {
      const res  = await fetch("/api/jobs");
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data);
      setLoading(false);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchJobs();
    pollRef.current = setInterval(fetchJobs, 2000);
    return () => clearInterval(pollRef.current);
  }, [fetchJobs]);

  /* ── Pause ──────────────────────────────────────────────────────────── */
  const handlePause = async (job_id) => {
    setPausing(job_id);
    try {
      const res = await fetch(`/api/jobs/${job_id}/pause`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast("Job paused.", "info");
      fetchJobs();
    } catch (err) { addToast(`Failed to pause: ${err.message}`, "error"); }
    finally { setPausing(null); }
  };

  /* ── Resume (immediate) ─────────────────────────────────────────────── */
  const handleResume = async (job_id) => {
    try {
      const res = await fetch(`/api/jobs/${job_id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delay_minutes: 0 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast("Job resumed.", "success");
      fetchJobs();
    } catch (err) { addToast(`Failed to resume: ${err.message}`, "error"); }
  };

  /* ── Cancel Schedule ────────────────────────────────────────────────── */
  const handleCancelSchedule = async (job_id) => {
    setCancelling(job_id);
    try {
      const res = await fetch(`/api/jobs/${job_id}/cancel-schedule`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast("Schedule cancelled — job is paused.", "info");
      fetchJobs();
    } catch (err) { addToast(`Failed to cancel: ${err.message}`, "error"); }
    finally { setCancelling(null); }
  };

  /* ── Bulk actions ───────────────────────────────────────────────────── */
  const handlePauseAll = async () => {
    const running = jobs.filter(j => j.status === "running" || j.status === "processing");
    if (!running.length) return;
    await Promise.all(running.map(j => fetch(`/api/jobs/${j.job_id}/pause`, { method: "POST" }).catch(() => {})));
    addToast(`Paused ${running.length} job${running.length !== 1 ? "s" : ""}.`, "info");
    fetchJobs();
  };

  const handleResumeAll = async () => {
    const paused = jobs.filter(j => j.status === "paused");
    if (!paused.length) return;
    await Promise.all(paused.map(j => fetch(`/api/jobs/${j.job_id}/resume`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delay_minutes: 0 }),
    }).catch(() => {})));
    addToast(`Resumed ${paused.length} job${paused.length !== 1 ? "s" : ""}.`, "success");
    fetchJobs();
  };

  const handleCancelAllSchedules = async () => {
    const scheduled = jobs.filter(j => j.status === "scheduled");
    if (!scheduled.length) return;
    await Promise.all(scheduled.map(j => fetch(`/api/jobs/${j.job_id}/cancel-schedule`, { method: "POST" }).catch(() => {})));
    addToast(`Cancelled ${scheduled.length} scheduled job${scheduled.length !== 1 ? "s" : ""}.`, "info");
    fetchJobs();
  };

  /* ── Navigate ───────────────────────────────────────────────────────── */
  const handleNavigate = (job) => {
    if (isComplete(job.status)) navigate(`/results/${job.job_id}`);
    else navigate(`/monitor/${job.job_id}`);
  };

  /* ── Derived counts (always from full jobs list) ────────────────────── */
  const runningJobs   = jobs.filter(j => j.status === "running" || j.status === "processing");
  const pausedJobs    = jobs.filter(j => j.status === "paused");
  const scheduledJobs = jobs.filter(j => j.status === "scheduled");
  const completedJobs = jobs.filter(j => isComplete(j.status));
  const failedJobs    = jobs.filter(j => j.status === "failed");
  const activeJobs    = jobs.filter(j => isActive(j.status));

  /* ── Filter + search ────────────────────────────────────────────────── */
  const filterFn = {
    active:    (j) => isActive(j.status),
    running:   (j) => j.status === "running" || j.status === "processing",
    paused:    (j) => j.status === "paused",
    scheduled: (j) => j.status === "scheduled",
    completed: (j) => isComplete(j.status),
    failed:    (j) => j.status === "failed",
    all:       ()  => true,
  };

  const displayJobs = jobs
    .filter(filterFn[filter] ?? (() => true))
    .filter(j => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (j.filename  ?? "").toLowerCase().includes(q) ||
        (j.workflow  ?? "").toLowerCase().includes(q) ||
        (j.job_id    ?? "").toLowerCase().includes(q)
      );
    });

  /* ── Summary cards — reflect filtered set when a specific filter active */
  const cardSource = filter === "all" ? jobs : displayJobs;
  const cardCounts = {
    running:   cardSource.filter(j => j.status === "running" || j.status === "processing").length,
    paused:    cardSource.filter(j => j.status === "paused").length,
    scheduled: cardSource.filter(j => j.status === "scheduled").length,
    completed: cardSource.filter(j => isComplete(j.status)).length,
    failed:    cardSource.filter(j => j.status === "failed").length,
  };

  const filterTabs = [
    { key: "active",    label: "Active",    count: activeJobs.length    },
    { key: "running",   label: "Running",   count: runningJobs.length   },
    { key: "paused",    label: "Paused",    count: pausedJobs.length    },
    { key: "scheduled", label: "Scheduled", count: scheduledJobs.length },
    { key: "completed", label: "Completed", count: completedJobs.length },
    { key: "failed",    label: "Failed",    count: failedJobs.length    },
    { key: "all",       label: "All",       count: jobs.length          },
  ];

  if (loading) {
    return <div className="loading-state"><div className="spinner spinner--lg" />Loading dashboard…</div>;
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Live view of all jobs — auto-refreshes every 2s</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {scheduledJobs.length > 0 && (
              <button className="btn btn--secondary btn--sm" onClick={handleCancelAllSchedules}
                style={{ gap: 5, color: "var(--text-error)", borderColor: "rgba(239,68,68,0.3)" }}>
                <Icon name="ban" size={13} />Cancel All Schedules ({scheduledJobs.length})
              </button>
            )}
            {pausedJobs.length > 0 && (
              <button className="btn btn--primary btn--sm" onClick={handleResumeAll} style={{ gap: 5 }}>
                <Icon name="play" size={13} />Resume All ({pausedJobs.length})
              </button>
            )}
            {runningJobs.length > 0 && (
              <button className="btn btn--secondary btn--sm" onClick={handlePauseAll}
                style={{ gap: 5, color: "var(--text-warning)", borderColor: "rgba(245,158,11,0.3)" }}>
                <Icon name="pause" size={13} />Pause All ({runningJobs.length})
              </button>
            )}
            <button className="btn btn--secondary btn--sm" onClick={() => navigate("/")} style={{ gap: 5 }}>
              <Icon name="upload" size={13} />New Job
            </button>
          </div>
        </div>

        {/* ── Summary cards — 5 cards now including Failed ─────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <SummaryCard label="Running"   value={cardCounts.running}   color="var(--text-warning)" borderColor="rgba(245,158,11,0.2)"  icon="zap"   index={0} sub="active now" />
          <SummaryCard label="Paused"    value={cardCounts.paused}    color="var(--text-accent)"  borderColor="rgba(59,130,246,0.2)"  icon="pause" index={1} sub="waiting"    />
          <SummaryCard label="Scheduled" value={cardCounts.scheduled} color="#a78bfa"             borderColor="rgba(167,139,250,0.2)" icon="timer" index={2} sub="queued"     />
          <SummaryCard label="Completed" value={cardCounts.completed} color="var(--text-success)" borderColor="rgba(16,185,129,0.2)"  icon="check" index={3} sub="done"       />
          <SummaryCard label="Failed"    value={cardCounts.failed}    color="var(--text-error)"   borderColor="rgba(239,68,68,0.2)"   icon="alert" index={4} sub="errors"     />
        </div>

        {/* ── Filter tabs + search ─────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {filterTabs.map(tab => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                style={{
                  padding: "4px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                  fontFamily: "var(--font-body)", fontWeight: filter === tab.key ? 600 : 400,
                  background: filter === tab.key ? "var(--accent-dim)" : "transparent",
                  border: `1px solid ${filter === tab.key ? "var(--border-accent)" : "transparent"}`,
                  color: filter === tab.key ? "var(--text-accent)" : "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: 6, transition: "all 150ms",
                }}>
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    background: filter === tab.key ? "var(--accent)" : "var(--bg-elevated)",
                    color: filter === tab.key ? "#fff" : "var(--text-muted)",
                    borderRadius: 99, fontSize: 10, fontFamily: "var(--font-mono)",
                    fontWeight: 700, padding: "1px 6px",
                  }}>{tab.count}</span>
                )}
              </button>
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
              placeholder="Search filename, workflow, job ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 12.5, height: 32, width: 280 }}
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

        {/* ── Jobs table ───────────────────────────────────────────────── */}
        {displayJobs.length === 0 ? (
          <div className="empty-state" style={{ padding: "60px 0" }}>
            <div className="empty-state-icon"><Icon name="cpu" size={48} /></div>
            <div className="empty-state-title">
              {search ? `No results for "${search}"` : filter === "active" ? "No active jobs" : `No ${filter} jobs`}
            </div>
            <div className="empty-state-sub">
              {search ? "Try a different search term." : filter === "active" ? "Start a batch job from the Upload page." : "Try a different filter above."}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {search && (
                <button className="btn btn--secondary btn--sm" onClick={() => setSearch("")}>Clear search</button>
              )}
              {filter !== "all" && !search && (
                <button className="btn btn--secondary btn--sm" onClick={() => setFilter("all")}>Show all</button>
              )}
              {filter === "active" && !search && (
                <button className="btn btn--primary" onClick={() => navigate("/")}>
                  <Icon name="upload" size={14} /> Upload a file
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)", overflow: "hidden",
            animation: "fadeSlideUp 300ms var(--ease-out) both",
          }}>
            {/* Horizontal scroll wrapper */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Status", "File / Workflow / ID", "Progress", "Results", "Elapsed", "Actions"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "left",
                        fontSize: 10.5, fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)", textTransform: "uppercase",
                        letterSpacing: "0.07em", fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayJobs.map(job => (
                    <JobRow
                      key={job.job_id}
                      job={job}
                      onPause={handlePause}
                      onResume={handleResume}
                      onCancelSchedule={handleCancelSchedule}
                      onNavigate={handleNavigate}
                      pausing={pausing}
                      cancelling={cancelling}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div style={{
              padding: "10px 14px", borderTop: "1px solid var(--border-subtle)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {displayJobs.length} job{displayJobs.length !== 1 ? "s" : ""} shown
                {search && (
                  <span style={{ marginLeft: 8, color: "var(--text-accent)" }}>· filtered by "{search}"</span>
                )}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block", animation: "pulseDot 2s ease-in-out infinite" }} />
                auto-refresh ↺ 2s
              </span>
            </div>
          </div>
        )}

      </div>

      <Toast toasts={toasts} />
    </>
  );
}