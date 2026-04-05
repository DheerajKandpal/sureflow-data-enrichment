import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const Icon = ({ name, size = 16 }) => {
  const paths = {
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    file:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    arrow:    <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
    rows:     <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    check:    <polyline points="20 6 9 17 4 12" />,
    x:        <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    filter:   <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    search:   <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    monitor:  <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    columns:  <><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    eyeoff:   <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>,
    expand:   <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>,
    copy:     <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
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

const statusClass = (val) => {
  const code = parseInt(val, 10);
  if (code === 200) return "status-200";
  if (code === 422) return "status-422";
  if (!isNaN(code)) return "status-err";
  return "";
};

const statusBg = (val) => {
  const code = parseInt(val, 10);
  if (code === 200) return "rgba(16,185,129,0.06)";
  if (code === 422) return "rgba(245,158,11,0.06)";
  if (!isNaN(code)) return "rgba(239,68,68,0.06)";
  return "transparent";
};

const getStatusCategory = (val) => {
  const code = parseInt(val, 10);
  if (code === 200) return "200";
  if (code === 422) return "422";
  if (!isNaN(code)) return "error";
  return "unknown";
};

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

/* ─── Cell Expand Modal ───────────────────────────────────────────────────── */
const CellModal = ({ value, colName, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(value ?? "")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Close on backdrop click or Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, animation: "fadeIn 150ms ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-accent)",
          borderRadius: "var(--radius-card)",
          padding: "20px 24px",
          maxWidth: 600, width: "100%",
          maxHeight: "70vh", display: "flex", flexDirection: "column",
          animation: "fadeSlideUp 200ms var(--ease-out) both",
          boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-accent)", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 6, padding: "2px 10px" }}>
            {colName}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleCopy}
              style={{ gap: 5, color: copied ? "var(--text-success)" : undefined }}
            >
              <Icon name={copied ? "check" : "copy"} size={12} />
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              className="btn btn--secondary btn--sm"
              onClick={onClose}
              style={{ padding: "4px 8px" }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        </div>

        {/* Value */}
        <div style={{
          flex: 1, overflowY: "auto",
          fontFamily: "var(--font-mono)", fontSize: 12.5,
          color: "var(--text-primary)", lineHeight: 1.7,
          background: "var(--bg-terminal)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8, padding: "14px 16px",
          whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>
          {String(value ?? "—")}
        </div>
      </div>
    </div>
  );
};

/* ─── Column Visibility Dropdown ─────────────────────────────────────────── */
const ColumnToggle = ({ columns, visible, onToggle, onReset }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hiddenCount = columns.length - visible.size;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn btn--secondary btn--sm"
        onClick={() => setOpen(p => !p)}
        style={{
          gap: 6,
          borderColor: hiddenCount > 0 ? "var(--border-accent)" : undefined,
          color: hiddenCount > 0 ? "var(--text-accent)" : undefined,
        }}
      >
        <Icon name="columns" size={13} />
        Columns
        {hiddenCount > 0 && (
          <span style={{
            background: "var(--accent)", color: "#fff",
            borderRadius: 99, fontSize: 10, fontWeight: 700,
            padding: "1px 6px", marginLeft: 2,
          }}>
            {hiddenCount} hidden
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)", padding: "10px 0",
          minWidth: 200, maxHeight: 320, overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "fadeSlideUp 180ms var(--ease-out) both",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 8px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {visible.size} / {columns.length} visible
            </span>
            <button
              onClick={onReset}
              style={{ fontSize: 11, color: "var(--text-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Show all
            </button>
          </div>

          {/* Column list */}
          {columns.map((col) => {
            const isVisible = visible.has(col);
            return (
              <div
                key={col}
                onClick={() => onToggle(col)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 14px", cursor: "pointer",
                  transition: "background 120ms ease",
                  background: "transparent",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--accent-dim)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${isVisible ? "var(--accent)" : "var(--border)"}`,
                  background: isVisible ? "var(--accent)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 120ms ease",
                }}>
                  {isVisible && <Icon name="check" size={9} />}
                </div>
                <span style={{
                  fontSize: 12, fontFamily: "var(--font-mono)",
                  color: isVisible ? "var(--text-primary)" : "var(--text-muted)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {col}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── Main Results Page ───────────────────────────────────────────────────── */
export default function Results() {
  const { job_id } = useParams();
  const navigate   = useNavigate();

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState("all"); // "all" | "200" | "422" | "error"
  const [downloading, setDownloading] = useState(false);
  const [toasts,      setToasts]      = useState([]);
  const [expandCell,  setExpandCell]  = useState(null); // { value, colName }
  const [visibleCols, setVisibleCols] = useState(null); // Set of visible column names

  /* ── Toast ─────────────────────────────────────────────────────────── */
  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => {
      setToasts((p) => p.map((t) => t.id === id ? { ...t, dismissing: true } : t));
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 300);
    }, 3200);
  }, []);

  /* ── Fetch results ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!job_id || job_id === "latest") { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/results/${job_id}?limit=5000&offset=0`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(`/api/jobs/${job_id}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([d, job]) => {
        if (job?.output_csv && !d.filename) d.filename = job.output_csv;
        const columns = d.columns || (d.rows?.[0] ? Object.keys(d.rows[0]) : []);
        const rows    = Array.isArray(d.rows)
          ? d.rows.map((row) => Array.isArray(row) ? row : columns.map((col) => row[col] != null ? String(row[col]) : ""))
          : [];
        const normalized = { ...d, columns, rows };
        setData(normalized);
        // Initialize all columns as visible
        setVisibleCols(new Set(columns));
        setLoading(false);
      })
      .catch((err) => {
        addToast(`Failed to load results: ${err.message}`, "error");
        setLoading(false);
      });
  }, [job_id, addToast]);

  /* ── Column visibility handlers ─────────────────────────────────────── */
  const handleToggleCol = useCallback((col) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) { next.delete(col); } else { next.add(col); }
      return next;
    });
  }, []);

  const handleResetCols = useCallback(() => {
    setVisibleCols(new Set(data?.columns ?? []));
  }, [data?.columns]);

  /* ── Derived: status column index ───────────────────────────────────── */
  const statusColIdx = data?.columns?.findIndex(
    (c) => c.toLowerCase() === "status_code" || c.toLowerCase().includes("status") || c.toLowerCase() === "code"
  ) ?? -1;

  /* ── Status counts ──────────────────────────────────────────────────── */
  const counts = {
    total: data?.rows?.length ?? 0,
    "200":  data?.rows?.filter((r) => statusColIdx >= 0 && parseInt(r[statusColIdx], 10) === 200).length ?? 0,
    "422":  data?.rows?.filter((r) => statusColIdx >= 0 && parseInt(r[statusColIdx], 10) === 422).length ?? 0,
    error:  data?.rows?.filter((r) => {
      if (statusColIdx < 0) return false;
      const c = parseInt(r[statusColIdx], 10);
      return !isNaN(c) && c !== 200 && c !== 422;
    }).length ?? 0,
  };

  /* ── Filtered rows ──────────────────────────────────────────────────── */
  const filteredRows = data?.rows?.filter((row) => {
    // Status filter
    if (statusFilter !== "all" && statusColIdx >= 0) {
      if (getStatusCategory(row[statusColIdx]) !== statusFilter) return false;
    }
    // Text search
    if (search.trim()) {
      return row.some((cell) => String(cell ?? "").toLowerCase().includes(search.toLowerCase()));
    }
    return true;
  }) ?? [];

  /* ── Visible column indices ─────────────────────────────────────────── */
  const visibleColIndices = data?.columns
    ?.map((col, i) => ({ col, i }))
    .filter(({ col }) => visibleCols?.has(col)) ?? [];

  /* ── Download ───────────────────────────────────────────────────────── */
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      let filename = data?.filename;
      if (!filename) {
        try {
          const jobRes  = await fetch(`/api/jobs/${job_id}`);
          const jobData = await jobRes.json();
          filename = jobData?.output_csv;
          if (filename) setData((prev) => ({ ...prev, filename }));
        } catch {
          // Keep download flow resilient if the job lookup fails.
        }
      }
      if (!filename) { addToast("Output file not found.", "error"); setDownloading(false); return; }
      const res = await fetch(`/api/download/${filename}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      addToast(`Downloaded ${filename}`, "success");
    } catch (err) { addToast(`Download failed: ${err.message}`, "error"); }
    finally { setDownloading(false); }
  };

  /* ── Empty / loading states ─────────────────────────────────────────── */
  if (job_id === "latest" || (!loading && !data)) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Icon name="file" size={48} /></div>
        <div className="empty-state-title">No results to display</div>
        <div className="empty-state-sub">Complete a batch job to view results here.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn--primary" onClick={() => navigate("/")}>Start a job</button>
          <button className="btn btn--secondary" onClick={() => navigate("/history")}>View history</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner spinner--lg" />
        Loading results for {job_id}…
      </div>
    );
  }

  /* ── Filter tabs config ─────────────────────────────────────────────── */
  const filterTabs = [
    { key: "all",   label: "All",    count: counts.total,    color: "var(--text-primary)" },
    { key: "200",   label: "200 OK", count: counts["200"],   color: "var(--text-success)" },
    { key: "422",   label: "422",    count: counts["422"],   color: "var(--text-warning)" },
    { key: "error", label: "Error",  count: counts.error,    color: "var(--text-error)"   },
  ];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Page header ────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => navigate(`/monitor/${job_id}`)}
                style={{ padding: "4px 8px", gap: 5 }}
              >
                <Icon name="arrow" size={13} />
                Monitor
              </button>
              <span style={{ color: "var(--border)", fontSize: 12 }}>·</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                {job_id}
              </span>
            </div>
            <h1 className="page-title">Results</h1>
            {data?.filename && (
              <p className="page-subtitle">
                <span style={{ fontFamily: "var(--font-mono)" }}>{data.filename}</span>
              </p>
            )}
          </div>

          <button
            className="btn btn--primary"
            onClick={handleDownload}
            disabled={downloading}
            style={{ padding: "10px 20px", fontSize: 13.5, fontWeight: 600, gap: 8 }}
          >
            {downloading
              ? <><div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} />Downloading…</>
              : <><Icon name="download" size={15} />Download CSV</>}
          </button>
        </div>

        {/* ── Summary bar ────────────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}>
          {/* Total */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)", padding: "16px 20px",
          }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>Total rows</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>{fmt(counts.total)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{fmt(data?.columns?.length)} columns</div>
          </div>
          {/* 200 */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "var(--radius-card)", padding: "16px 20px",
          }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>Success (200)</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-success)", letterSpacing: "-0.03em", lineHeight: 1 }}>{fmt(counts["200"])}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              {counts.total > 0 ? Math.round((counts["200"] / counts.total) * 100) : 0}% of total
            </div>
          </div>
          {/* 422 */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "var(--radius-card)", padding: "16px 20px",
          }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>Flagged (422)</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-warning)", letterSpacing: "-0.03em", lineHeight: 1 }}>{fmt(counts["422"])}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              {counts.total > 0 ? Math.round((counts["422"] / counts.total) * 100) : 0}% of total
            </div>
          </div>
          {/* Error */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "var(--radius-card)", padding: "16px 20px",
          }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>Errors</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-error)", letterSpacing: "-0.03em", lineHeight: 1 }}>{fmt(counts.error)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              {counts.total > 0 ? Math.round((counts.error / counts.total) * 100) : 0}% of total
            </div>
          </div>
        </div>

        {/* ── Table card ─────────────────────────────────────────────── */}
        <div className="table-wrap">

          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)",
            gap: 12, flexWrap: "wrap",
          }}>
            {/* Left: filter tabs */}
            <div style={{ display: "flex", gap: 4 }}>
              {filterTabs.map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                      fontSize: 12, fontFamily: "var(--font-mono)",
                      border: `1px solid ${active ? "var(--border-accent)" : "var(--border)"}`,
                      background: active ? "var(--accent-dim)" : "var(--bg-input)",
                      color: active ? "var(--text-accent)" : "var(--text-muted)",
                      transition: "all 150ms",
                    }}
                  >
                    {tab.key !== "all" && (
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: tab.color, display: "inline-block", flexShrink: 0,
                      }} />
                    )}
                    {tab.label}
                    <span style={{
                      fontSize: 10.5, fontWeight: 700,
                      color: active ? "var(--text-accent)" : "var(--text-muted)",
                      background: active ? "rgba(59,130,246,0.15)" : "var(--bg-elevated)",
                      borderRadius: 99, padding: "1px 6px",
                    }}>
                      {fmt(tab.count)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right: search + column toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-muted)", pointerEvents: "none",
                }}>
                  <Icon name="search" size={12} />
                </span>
                <input
                  className="input"
                  placeholder="Search rows…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: 12.5, height: 32, width: 200 }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 0 }}
                  >
                    <Icon name="x" size={11} />
                  </button>
                )}
              </div>

              {/* Row count */}
              <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt(filteredRows.length)}</span>
                {" "}/ {fmt(counts.total)} rows
              </span>

              {/* Column visibility */}
              {visibleCols && (
                <ColumnToggle
                  columns={data?.columns ?? []}
                  visible={visibleCols}
                  onToggle={handleToggleCol}
                  onReset={handleResetCols}
                />
              )}
            </div>
          </div>

          {/* Table */}
          <div className="table-scroll">
            {data?.columns?.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 48, textAlign: "center" }}>#</th>
                    {visibleColIndices.map(({ col }) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColIndices.length + 1}
                        style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}
                      >
                        {statusFilter !== "all"
                          ? `No rows with status ${statusFilter === "error" ? "error" : statusFilter}.`
                          : "No rows match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, ri) => {
                      const statusVal = statusColIdx >= 0 ? row[statusColIdx] : null;
                      return (
                        <tr
                          key={ri}
                          style={{
                            animationDelay: `${Math.min(ri * 18, 400)}ms`,
                            background: statusVal ? statusBg(statusVal) : undefined,
                          }}
                        >
                          {/* Row number */}
                          <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 11, fontWeight: 400, width: 48 }}>
                            {ri + 1}
                          </td>

                          {/* Visible cells only */}
                          {visibleColIndices.map(({ col, i: ci }) => {
                            const cell      = row[ci];
                            const isFirst   = ci === 0;
                            const isStatus  = ci === statusColIdx;
                            const cellStr   = String(cell ?? "");
                            const isTruncated = cellStr.length > 40;

                            return (
                              <td
                                key={ci}
                                className={isStatus ? statusClass(cell) : undefined}
                                style={{
                                  fontWeight: isFirst ? 600 : undefined,
                                  color: isFirst
                                    ? "var(--text-accent)"
                                    : isStatus ? undefined : "var(--text-secondary)",
                                  maxWidth: 220,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  cursor: isTruncated ? "pointer" : "default",
                                  position: "relative",
                                }}
                                title={isTruncated ? "Click to expand" : cellStr}
                                onClick={isTruncated ? () => setExpandCell({ value: cellStr, colName: col }) : undefined}
                              >
                                {isStatus ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block", flexShrink: 0 }} />
                                    {cell ?? "—"}
                                  </span>
                                ) : (
                                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {cellStr || "—"}
                                    </span>
                                    {isTruncated && (
                                      <span style={{ color: "var(--text-muted)", flexShrink: 0, opacity: 0.6 }}>
                                        <Icon name="expand" size={10} />
                                      </span>
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: "60px 20px" }}>
                <div className="empty-state-icon"><Icon name="rows" size={40} /></div>
                <div className="empty-state-title">No data available</div>
                <div className="empty-state-sub">The result set is empty or could not be loaded.</div>
              </div>
            )}
          </div>

          {/* Table footer */}
          {filteredRows.length > 0 && (
            <div className="table-footer">
              <span className="table-footer-label">
                {fmt(filteredRows.length)} row{filteredRows.length !== 1 ? "s" : ""}
                {statusFilter !== "all" ? ` · filtered by ${statusFilter}` : search ? " matched" : " total"}
                {visibleCols && visibleCols.size < (data?.columns?.length ?? 0) && (
                  <span style={{ marginLeft: 8, color: "var(--text-accent)" }}>
                    · {visibleCols.size} of {data?.columns?.length} columns shown
                  </span>
                )}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-success)" }}>● {fmt(counts["200"])} ok</span>
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-warning)" }}>● {fmt(counts["422"])} 422</span>
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-error)"   }}>● {fmt(counts.error)} err</span>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={handleDownload}
                  disabled={downloading}
                  style={{ gap: 5 }}
                >
                  <Icon name="download" size={12} />Export
                </button>
              </div>
            </div>
          )}
        </div>

      </div>{/* end flex column wrapper */}

      {/* ── Cell expand modal ──────────────────────────────────────────── */}
      {expandCell && (
        <CellModal
          value={expandCell.value}
          colName={expandCell.colName}
          onClose={() => setExpandCell(null)}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
