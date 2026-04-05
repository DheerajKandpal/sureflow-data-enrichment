import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const Icon = ({ name, size = 16 }) => {
  const paths = {
    arrow:    <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
    check:    <polyline points="20 6 9 17 4 12" />,
    x:        <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    clock:    <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    cpu:      <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></>,
    file:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    pause:    <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    play:     <polygon points="5 3 19 12 5 21 5 3" />,
    skip:     <><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></>,
    save:     <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>,
    timer:    <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    alert:    <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    copy:     <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    trash:    <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
    search:   <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    pin:      <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
    refresh:  <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
    zap:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    ban:      <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>,
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
  if (diff <= 0) return "any moment…";
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60), s = diff % 60;
  return `${m}m ${s}s`;
};

const calcETA = (job) => {
  if (!job?.started_at || !job?.total || !job?.progress) return null;
  const elapsed = (Date.now() - new Date(job.started_at).getTime()) / 1000;
  const rate    = job.progress / elapsed;
  if (rate <= 0) return null;
  const remaining = (job.total - job.progress) / rate;
  if (remaining < 60) return `~${Math.round(remaining)}s left`;
  const m = Math.floor(remaining / 60), s = Math.round(remaining % 60);
  return `~${m}m ${s}s left`;
};

const classifyLog = (line) => {
  const l = line.toLowerCase();
  if (l.includes("⏸") || l.includes("paused")) return "warning";
  if (l.includes("▶") || l.includes("resum"))  return "info";
  if (l.includes("🚨") || l.includes("auto-paus")) return "warning";
  if (l.includes("⏰") || l.includes("scheduled")) return "info";
  if (l.includes("error") || l.includes("fail") || l.includes("exception") || l.includes("❌")) return "error";
  if (l.includes("warn") || l.includes("⚠️"))  return "warning";
  if (l.includes("success") || l.includes("✅") || l.includes("done") || l.includes("complete")) return "success";
  if (line === "__DONE__") return "done";
  return "info";
};

const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });

/* ─── Toast ──────────────────────────────────────────────────────────────── */
const Toast = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map((t) => (
      <div key={t.id} className={`toast toast--${t.type}${t.dismissing ? " toast--dismissing" : ""}`}>
        <div className="toast-icon">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "i"}</div>
        <span className="toast-message">{t.message}</span>
      </div>
    ))}
  </div>
);

/* ─── Metric Card ─────────────────────────────────────────────────────────── */
const MetricCard = ({ label, value, variant, icon, sub, index }) => (
  <div className="metric-card" style={{ animationDelay: `${index * 60}ms`, animation: "cardIn 300ms var(--ease-out) both" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div className="metric-label">{label}</div>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: `var(--${variant}-dim, var(--accent-dim))`,
        border: `1px solid rgba(var(--${variant}-rgb, 59,130,246), 0.2)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: `var(--text-${variant === "default" ? "primary" : variant})`,
        opacity: 0.9,
      }}>
        <Icon name={icon} size={13} />
      </div>
    </div>
    <div className={`metric-value metric-value--${variant}`}>{fmt(value)}</div>
    {sub && <div className="metric-sub">{sub}</div>}
  </div>
);

/* ─── Log Line ────────────────────────────────────────────────────────────── */
const LogLine = ({ line, time, index, highlight }) => {
  const type    = classifyLog(line);
  const display = line === "__DONE__" ? "── Job complete ──" : line;

  const renderText = () => {
    if (!highlight || !display.toLowerCase().includes(highlight.toLowerCase())) return display;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = display.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} style={{ background: "rgba(251,191,36,0.35)", color: "inherit", borderRadius: 2 }}>{part}</mark>
        : part
    );
  };

  return (
    <div className={`log-line log-line--${type}`} style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}>
      <span className="log-line-time">{time}</span>
      <span className="log-line-text">{renderText()}</span>
    </div>
  );
};

/* ─── Resume Panel ───────────────────────────────────────────────────────── */
const ResumePanel = ({ job, onResume, onCancel, cancelLabel = "Cancel" }) => {
  const [startRow,  setStartRow]  = useState(job.paused_at_row ?? 0);
  const [delayMins, setDelayMins] = useState(0);
  const [custom,    setCustom]    = useState(false);
  const [resuming,  setResuming]  = useState(false);

  const delayOptions = [
    { label: "Now",    value: 0   },
    { label: "5 min",  value: 5   },
    { label: "15 min", value: 15  },
    { label: "30 min", value: 30  },
    { label: "1 hr",   value: 60  },
    { label: "2 hr",   value: 120 },
    { label: "Custom", value: -1  },
  ];

  const handleResume = async () => {
    setResuming(true);
    await onResume({ start_from_row: Number(startRow), delay_minutes: Number(delayMins) });
    setResuming(false);
  };

  const isPaused500 = job.pause_reason === "auto_500";

  return (
    <div style={{
      background: "var(--bg-card)",
      border: `1px solid ${isPaused500 ? "rgba(245,158,11,0.3)" : "var(--border-accent)"}`,
      borderRadius: "var(--radius-card)",
      padding: "20px 24px",
      animation: "fadeSlideUp 300ms var(--ease-out) both",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: isPaused500 ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: isPaused500 ? "var(--text-warning)" : "var(--text-accent)",
        }}>
          <Icon name={isPaused500 ? "alert" : "pause"} size={15} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {isPaused500 ? "Auto-paused — too many consecutive failures" : "Job paused"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Stopped at row {job.paused_at_row ?? "—"} of {job.total}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 6, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Start from row
          </label>
          <input type="number" className="input" min={0} max={job.total}
            value={startRow} onChange={e => setStartRow(e.target.value)}
            style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
            0 = beginning · {job.paused_at_row} = where paused
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 6, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Resume delay
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {delayOptions.map(opt => (
              <button key={opt.value}
                onClick={() => { if (opt.value === -1) { setCustom(true); } else { setDelayMins(opt.value); setCustom(false); } }}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11.5,
                  fontFamily: "var(--font-mono)", cursor: "pointer",
                  border: `1px solid ${(!custom && delayMins === opt.value) || (custom && opt.value === -1) ? "var(--border-accent)" : "var(--border)"}`,
                  background: (!custom && delayMins === opt.value) || (custom && opt.value === -1) ? "var(--accent-dim)" : "var(--bg-input)",
                  color: (!custom && delayMins === opt.value) || (custom && opt.value === -1) ? "var(--text-accent)" : "var(--text-muted)",
                  transition: "all 150ms",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          {custom && (
            <input type="number" className="input" min={1} placeholder="Minutes"
              value={delayMins === 0 ? "" : delayMins}
              onChange={e => setDelayMins(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 8 }} autoFocus />
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        {/* ── Cancel button — always shown when onCancel is provided ── */}
        {onCancel && (
          <button
            className="btn btn--secondary"
            onClick={onCancel}
            style={{ gap: 6, color: "var(--text-error)", borderColor: "rgba(239,68,68,0.3)" }}
          >
            <Icon name="ban" size={13} />
            {cancelLabel}
          </button>
        )}
        <button className="btn btn--primary" onClick={handleResume} disabled={resuming} style={{ gap: 6 }}>
          {resuming
            ? <div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} />
            : <Icon name={delayMins > 0 ? "timer" : "play"} size={14} />}
          {delayMins > 0 ? `Schedule resume in ${delayMins} min` : "Resume now"}
        </button>
      </div>
    </div>
  );
};

/* ─── Scheduled Countdown Banner ─────────────────────────────────────────── */
const ScheduledBanner = ({ job, onCancelSchedule, onResumeNow }) => {
  const [countdown, setCountdown] = useState(calcCountdown(job.resume_at));
  useEffect(() => {
    const id = setInterval(() => setCountdown(calcCountdown(job.resume_at)), 1000);
    return () => clearInterval(id);
  }, [job.resume_at]);

  return (
    <div style={{
      background: "rgba(167,139,250,0.08)",
      border: "1px solid rgba(167,139,250,0.25)",
      borderRadius: "var(--radius-card)",
      padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 14,
      animation: "fadeSlideUp 300ms var(--ease-out) both",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: "rgba(167,139,250,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#a78bfa",
      }}>
        <Icon name="timer" size={17} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", marginBottom: 3 }}>
          Scheduled resume
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Resuming in{" "}
          <strong style={{ color: "var(--text-primary)", fontSize: 13 }}>{countdown}</strong>
          {job.resume_at && (
            <span style={{ marginLeft: 8, opacity: 0.6 }}>· at {job.resume_at}</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button className="btn btn--primary btn--sm" onClick={onResumeNow} style={{ gap: 5 }}>
          <Icon name="play" size={12} />
          Resume now
        </button>
        <button
          className="btn btn--secondary btn--sm"
          onClick={onCancelSchedule}
          style={{ gap: 5, color: "var(--text-error)", borderColor: "rgba(239,68,68,0.3)" }}>
          <Icon name="ban" size={12} />
          Cancel
        </button>
      </div>
    </div>
  );
};

/* ─── Main Monitor Page ───────────────────────────────────────────────────── */
export default function Monitor() {
  const { job_id } = useParams();
  const navigate   = useNavigate();

  const [job,             setJob]             = useState(null);
  const [logs,            setLogs]            = useState([]);
  const [done,            setDone]            = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [elapsed_,        setElapsed]         = useState("0s");
  const [toasts,          setToasts]          = useState([]);
  const [pausing,         setPausing]         = useState(false);
  const [showResumePanel, setShowResumePanel] = useState(false);
  const [logSearch,       setLogSearch]       = useState("");
  const [autoScroll,      setAutoScroll]      = useState(true);
  const [copied,          setCopied]          = useState(false);
  const [eta,             setEta]             = useState(null);

  const wsRef           = useRef(null);
  const termRef         = useRef(null);
  const pollRef         = useRef(null);
  const userClosedPanel = useRef(false);
  const jobRef          = useRef(null);

  /* ── Toast ─────────────────────────────────────────────────────────── */
  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => {
      setToasts(p => p.map(t => t.id === id ? { ...t, dismissing: true } : t));
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 300);
    }, 3200);
  }, []);

  const scrollTerm = useCallback(() => {
    if (autoScroll && termRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [autoScroll]);

  /* ── Fetch job ─────────────────────────────────────────────────────── */
  const fetchJob = useCallback(async () => {
    if (!job_id || job_id === "latest") return;
    try {
      const res  = await fetch(`/api/jobs/${job_id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();

      const wasRunning = jobRef.current?.status === "running";
      const nowPaused  = data.status === "paused";
      if (wasRunning && nowPaused) {
        userClosedPanel.current = false;
        setShowResumePanel(true);
      }

      jobRef.current = data;
      setJob(data);
      setLoading(false);

      if (["done", "completed", "complete", "failed"].includes(data.status)) {
        setDone(true);
        clearInterval(pollRef.current);
      }
    } catch {
      setLoading(false);
    }
  }, [job_id]);

  /* ── WebSocket + polling ────────────────────────────────────────────── */
  useEffect(() => {
    if (!job_id || job_id === "latest") { setLoading(false); return; }
    fetchJob();
    pollRef.current = setInterval(fetchJob, 2000);
    const wsProto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProto}://${location.host}/ws/jobs/${job_id}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const line = e.data;
      setLogs(p => [...p, { line, time: timestamp(), id: Date.now() + Math.random() }]);
      setTimeout(scrollTerm, 30);
      if (line === "__DONE__") { clearInterval(pollRef.current); fetchJob(); ws.close(); }
    };
    ws.onerror = () => addToast("WebSocket error. Using polling.", "error");
    return () => { clearInterval(pollRef.current); ws.close(); };
  }, [job_id, fetchJob, scrollTerm, addToast]);

  /* ── Elapsed + ETA ticker ───────────────────────────────────────────── */
  useEffect(() => {
    if (!job?.started_at || done) return;
    const id = setInterval(() => {
      setElapsed(calcElapsed(job.started_at));
      setEta(calcETA(jobRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [job?.started_at, done]);

  /* ── Copy ───────────────────────────────────────────────────────────── */
  const handleCopy = () => {
    navigator.clipboard.writeText(job_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Download logs ──────────────────────────────────────────────────── */
  const handleDownloadLogs = () => {
    const text = logs.map(e => `[${e.time}] ${e.line}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `sureflow-job-${job_id.slice(0, 8)}.log`;
    a.click(); URL.revokeObjectURL(url);
  };

  /* ── Pause ──────────────────────────────────────────────────────────── */
  const handlePause = async () => {
    setPausing(true);
    try {
      const res = await fetch(`/api/jobs/${job_id}/pause`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      userClosedPanel.current = false;
      addToast("Job paused.", "info");
      fetchJob();
      setShowResumePanel(true);
    } catch (err) { addToast(`Failed to pause: ${err.message}`, "error"); }
    finally { setPausing(false); }
  };

  /* ── Resume ─────────────────────────────────────────────────────────── */
  const handleResume = useCallback(async ({ start_from_row, delay_minutes }) => {
    try {
      const res = await fetch(`/api/jobs/${job_id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_from_row, delay_minutes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowResumePanel(false);
      userClosedPanel.current = false;
      setDone(false);
      if (delay_minutes > 0) {
        addToast(`Job scheduled to resume in ${delay_minutes} min`, "info");
      } else {
        addToast("Job resumed!", "success");
        // Close existing WS before opening a new one
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        const wsProto2 = location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${wsProto2}://${location.host}/ws/jobs/${job_id}`);
        wsRef.current = ws;
        ws.onmessage = (e) => {
          const line = e.data;
          setLogs(p => [...p, { line, time: timestamp(), id: Date.now() + Math.random() }]);
          setTimeout(scrollTerm, 30);
          if (line === "__DONE__") { fetchJob(); ws.close(); }
        };
        pollRef.current = setInterval(fetchJob, 2000);
      }
      fetchJob();
    } catch (err) { addToast(`Failed to resume: ${err.message}`, "error"); }
  }, [job_id, fetchJob, scrollTerm, addToast]);

  /* ── Close resume panel (keep job paused) ───────────────────────────── */
  const handleCancelPanel = useCallback(() => {
    userClosedPanel.current = true;
    setShowResumePanel(false);
  }, []);

  /* ── Cancel schedule (goes back to paused, shows resume panel) ──────── */
  const handleCancelSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${job_id}/cancel-schedule`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast("Schedule cancelled — job is paused.", "info");
      userClosedPanel.current = false;
      setShowResumePanel(true);
      fetchJob();
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  }, [job_id, fetchJob, addToast]);

  /* ── Resume now (from scheduled banner) ────────────────────────────── */
  const handleResumeNow = useCallback(async () => {
    await handleResume({ start_from_row: jobRef.current?.paused_at_row ?? 0, delay_minutes: 0 });
  }, [handleResume]);

  /* ── Retry failed job ───────────────────────────────────────────────── */
  const handleRetry = async () => {
    if (!job) return;
    const retryColumnMap = job.column_map || {};
    if (!Object.keys(retryColumnMap).length) {
      addToast("Retry mapping missing for this job. Please start again from Upload.", "error");
      return;
    }
    try {
      const res = await fetch("/api/jobs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename:   job.filename,
          workflow:   job.workflow,
          column_map: retryColumnMap,
          force:      false,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { job_id: newId } = await res.json();
      addToast("Retry job started!", "success");
      setTimeout(() => navigate(`/monitor/${newId}`), 500);
    } catch (err) { addToast(`Failed to retry: ${err.message}`, "error"); }
  };

  /* ── Derived state ──────────────────────────────────────────────────── */
  const processed     = (job?.success ?? 0) + (job?.failed ?? 0) + (job?.already_exists ?? 0);
  const progress      = job ? Math.round((processed / Math.max(job.total, 1)) * 100) : 0;
  const isRunning     = job?.status === "running" || job?.status === "processing";
  const isPaused      = job?.status === "paused";
  const isScheduled   = job?.status === "scheduled";
  const isFailed      = job?.status === "failed";
  const statusVariant = isFailed ? "error" : done ? "success" : isPaused ? "warning" : isScheduled ? "info" : "warning";
  const statusLabel   = isFailed ? "Failed" : done ? "Completed" : isPaused ? "Paused" : isScheduled ? "Scheduled" : isRunning ? "Running" : "Queued";
  const filteredLogs  = logSearch ? logs.filter(e => e.line.toLowerCase().includes(logSearch.toLowerCase())) : logs;

  /* ── Empty / loading states ─────────────────────────────────────────── */
  if (job_id === "latest" || (!loading && !job)) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Icon name="cpu" size={48} /></div>
        <div className="empty-state-title">No job selected</div>
        <div className="empty-state-sub">Start a batch job from the Upload page, or pick one from History.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn--primary" onClick={() => navigate("/")}>Go to Upload</button>
          <button className="btn btn--secondary" onClick={() => navigate("/history")}>View History</button>
        </div>
      </div>
    );
  }
  if (loading) return <div className="loading-state"><div className="spinner spinner--lg" />Loading job…</div>;

  /* ────────────────────────────────────────────────────────────────────────
     RENDER
     All sections live inside one flex-column wrapper with a uniform 16px gap.
     No individual marginTop needed — the gap handles all spacing.
  ──────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="monitor-header">
          <div className="monitor-job-id">
            <div>
              <div className="job-id-label">Job ID</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span className="job-id-value">{job_id}</span>
                <button onClick={handleCopy} title="Copy Job ID" style={{
                  background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
                  borderRadius: 5, color: copied ? "var(--text-success)" : "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: 4, fontSize: 11, transition: "color 150ms",
                }}>
                  <Icon name={copied ? "check" : "copy"} size={12} />
                  {copied ? "Copied!" : "Copy"}
                </button>
                {job?.filename && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    · {job.filename}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="monitor-status-row">
            {job?.started_at && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                <Icon name="clock" size={13} />
                {done ? calcElapsed(job.started_at) : elapsed_}
              </div>
            )}
            {isRunning && eta && (
              <div style={{ fontSize: 11.5, color: "var(--text-accent)", fontFamily: "var(--font-mono)", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 5, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="zap" size={10} />{eta}
              </div>
            )}
            <span className={`badge badge--${statusVariant}${isRunning ? " badge--pulse" : ""}`}>
              <span className="badge-dot" />{statusLabel}
            </span>
            {job?.workflow && (
              <span className="badge badge--neutral">
                <Icon name="cpu" size={10} />{job.workflow}
              </span>
            )}
            {isRunning && (
              <button className="btn btn--secondary btn--sm" onClick={handlePause} disabled={pausing}
                style={{ gap: 5, borderColor: "rgba(245,158,11,0.3)", color: "var(--text-warning)" }}>
                {pausing ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <Icon name="pause" size={13} />}
                Pause
              </button>
            )}
            {isPaused && !showResumePanel && (
              <button className="btn btn--primary btn--sm"
                onClick={() => { userClosedPanel.current = false; setShowResumePanel(true); }}
                style={{ gap: 5 }}>
                <Icon name="play" size={13} />Resume
              </button>
            )}
          </div>
        </div>

        {/* ── Scheduled banner ───────────────────────────────────────── */}
        {isScheduled && job.resume_at && (
          <ScheduledBanner
            job={job}
            onCancelSchedule={handleCancelSchedule}
            onResumeNow={handleResumeNow}
          />
        )}

        {/* ── Auto-500 banner ────────────────────────────────────────── */}
        {isPaused && job.pause_reason === "auto_500" && !showResumePanel && (
          <div style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: "var(--radius-card)",
            padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 12,
            animation: "fadeSlideUp 300ms var(--ease-out) both",
          }}>
            <Icon name="alert" size={18} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-warning)" }}>
                Auto-paused — too many consecutive failures
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {job.resume_at ? `Auto-resuming at ${job.resume_at}` : "Waiting to resume"}
              </div>
            </div>
            <button className="btn btn--secondary btn--sm"
              onClick={() => { userClosedPanel.current = false; setShowResumePanel(true); }}>
              Override
            </button>
          </div>
        )}

        {/* ── Resume panel ───────────────────────────────────────────── */}
        {/*
            Paused job  → Cancel button closes the panel (job stays paused)
            Scheduled job → Cancel button cancels the schedule (back to paused)
        */}
        {(isPaused || isScheduled) && showResumePanel && (
          <ResumePanel
            job={job}
            onResume={handleResume}
            onCancel={isScheduled ? handleCancelSchedule : handleCancelPanel}
            cancelLabel={isScheduled ? "Cancel schedule" : "Close"}
          />
        )}

        {/* ── Progress card ──────────────────────────────────────────── */}
        <div className="monitor-progress-card">
          <div className="progress-label">
            <span className="progress-label-text">
              {fmt(processed)} / {fmt(job?.total)} records processed
            </span>
            <span className="progress-label-pct">{progress}%</span>
          </div>
          <div className="progress-wrap progress-wrap--lg">
            <div className={`progress-bar${isRunning ? " progress-bar--shimmer" : ""} ${done && !isFailed ? "progress-bar--success" : ""} ${isPaused ? "progress-bar--warning" : ""}`}
              style={{ width: `${progress}%` }} />
          </div>
          {isRunning && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 8 }}>
              Processing records… pipeline is active
            </div>
          )}
          {isPaused && (
            <div style={{ fontSize: 11.5, color: "var(--text-warning)", fontFamily: "var(--font-mono)", marginTop: 8 }}>
              ⏸ Paused at row {job.paused_at_row} — click Resume to continue
            </div>
          )}
          {isScheduled && (
            <div style={{ fontSize: 11.5, color: "#a78bfa", fontFamily: "var(--font-mono)", marginTop: 8 }}>
              ⏰ Scheduled — will resume automatically
            </div>
          )}
        </div>

        {/* ── Metric cards ───────────────────────────────────────────── */}
        <div className="metric-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          <MetricCard label="Success"        value={job?.success}          variant="success" icon="check" sub="verified records"  index={0} />
          <MetricCard label="422 Saved"      value={job?.saved_422}        variant="warning" icon="save"  sub="flagged & saved"   index={1} />
          <MetricCard label="Failed"         value={job?.failed}           variant="error"   icon="x"     sub="processing errors" index={2} />
          <MetricCard label="Invalid Format" value={job?.invalid_format}   variant="error"   icon="ban"   sub="bad format, skipped" index={3} />
          <MetricCard label="Skipped"        value={job?.already_exists}   variant="default" icon="skip"  sub="already exists"    index={4} />
        </div>

        {/* ── Terminal ───────────────────────────────────────────────── */}
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dots">
              <div className="terminal-dot terminal-dot--red" />
              <div className="terminal-dot terminal-dot--yellow" />
              <div className="terminal-dot terminal-dot--green" />
            </div>
            <span className="terminal-title">pipeline.log — {job_id.slice(0, 8)}…</span>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>

              {/* Search */}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", display: "flex" }}>
                  <Icon name="search" size={11} />
                </span>
                <input
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  placeholder="Search logs…"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text-primary)",
                    fontSize: 11,
                    padding: "4px 8px 4px 24px",
                    width: logSearch ? 140 : 100,
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                    transition: "width 200ms, border-color 150ms",
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--border-accent)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
                {logSearch && (
                  <button onClick={() => setLogSearch("")}
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 0 }}>
                    <Icon name="x" size={10} />
                  </button>
                )}
              </div>

              {/* Line count */}
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {logSearch ? `${filteredLogs.length}/${logs.length}` : `${logs.length} lines`}
              </span>

              {/* Auto-scroll toggle */}
              <button title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
                onClick={() => setAutoScroll(p => !p)}
                style={{
                  background: autoScroll ? "var(--accent-dim)" : "var(--bg-elevated)",
                  border: `1px solid ${autoScroll ? "var(--border-accent)" : "var(--border)"}`,
                  borderRadius: 5, cursor: "pointer", padding: "4px 6px",
                  color: autoScroll ? "var(--text-accent)" : "var(--text-muted)",
                  display: "flex", alignItems: "center",
                  transition: "all 150ms",
                }}>
                <Icon name="pin" size={11} />
              </button>

              {/* Download logs */}
              <button title="Download logs" onClick={handleDownloadLogs}
                style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 5, cursor: "pointer", padding: "4px 6px",
                  color: "var(--text-muted)", display: "flex", alignItems: "center",
                  transition: "all 150ms",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--text-accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}>
                <Icon name="download" size={11} />
              </button>

              {/* Clear logs */}
              <button title="Clear logs" onClick={() => setLogs([])}
                style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 5, cursor: "pointer", padding: "4px 6px",
                  color: "var(--text-muted)", display: "flex", alignItems: "center",
                  transition: "all 150ms",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "var(--text-error)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}>
                <Icon name="trash" size={11} />
              </button>

              {/* LIVE indicator */}
              {isRunning && (
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-success)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block", animation: "pulseDot 1.4s ease-in-out infinite" }} />
                  LIVE
                </span>
              )}
            </div>
          </div>

          <div className="terminal-body" ref={termRef}>
            {filteredLogs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {logSearch ? `No logs matching "${logSearch}"` : isRunning ? "Waiting for log output…" : "No log output."}
              </div>
            ) : (
              filteredLogs.map((entry, i) => (
                <LogLine key={entry.id} line={entry.line} time={entry.time} index={i} highlight={logSearch} />
              ))
            )}
            {isRunning && !logSearch && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>▋</span>
                <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
              </div>
            )}
          </div>
        </div>

        {/* ── View Results (on completion) ────────────────────────────── */}
        {done && !isFailed && (
          <div className="view-results-btn-wrap">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button className="btn btn--primary"
                style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600 }}
                onClick={() => navigate(`/results/${job_id}`)}>
                View Results <Icon name="arrow" size={15} />
              </button>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {fmt(job?.success)} records · {job?.output_csv || `${job_id}_output.csv`}
              </div>
            </div>
          </div>
        )}

        {/* ── Failed state ────────────────────────────────────────────── */}
        {isFailed && (
          <div style={{
            background: "var(--error-dim)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "var(--radius-card)",
            padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 12,
            animation: "fadeSlideUp 300ms var(--ease-out) both",
          }}>
            <Icon name="alert" size={18} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-error)", marginBottom: 2 }}>Job failed</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{job?.error || "Check the log output above for details."}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button className="btn btn--secondary btn--sm" onClick={handleRetry} style={{ gap: 5 }}>
                <Icon name="refresh" size={12} />Retry
              </button>
              <button className="btn btn--secondary btn--sm" onClick={() => navigate("/")}>New Job</button>
            </div>
          </div>
        )}

      </div>{/* ── end flex column wrapper ── */}

      <Toast toasts={toasts} />
    </>
  );
}