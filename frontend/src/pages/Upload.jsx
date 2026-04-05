import { useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const Icon = ({ name, size = 20 }) => {
  const paths = {
    folder:  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
    upload:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    file:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    check:   <polyline points="20 6 9 17 4 12" />,
    arrow:   <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
    zap:     <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    x:       <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    plus:    <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    save:    <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>,
    chevron: <polyline points="6 9 12 15 18 9" />,
    timer:   <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    skip:    <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>,
    refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
    force:   <><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></>,
    info:    <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
    columns: <><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></>,
    alert:   <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    shield:  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

/* ─── Toast ──────────────────────────────────────────────────────────────── */
const Toast = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map((t) => (
      <div key={t.id} className={`toast toast--${t.type} ${t.dismissing ? "toast--dismissing" : ""}`}>
        <div className="toast-icon">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "i"}</div>
        <span className="toast-message">{t.message}</span>
      </div>
    ))}
  </div>
);

const payloadRowsToObject = (rows) => {
  const obj = {};
  rows.forEach(({ key, value, type }) => {
    if (!key.trim()) return;
    if (type === "number") obj[key] = Number.isNaN(Number(value)) ? value : Number(value);
    else if (type === "boolean") obj[key] = value === "true";
    else obj[key] = value;
  });
  return obj;
};

const objectToPayloadRows = (obj) => {
  if (!obj || typeof obj !== "object") return [{ key: "id_number", value: "{input}", type: "string" }];
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: String(value),
    type: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string",
  }));
};

const PayloadConfigurator = ({ value, onChange }) => {
  const [rows, setRows] = useState(() => objectToPayloadRows(value));

  const syncRows = (nextRows) => {
    setRows(nextRows);
    onChange(payloadRowsToObject(nextRows));
  };

  const updateRow = (index, field, nextValue) => {
    syncRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: nextValue } : row));
  };

  return (
    <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 88px 32px", gap: 6, padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
        {["Key", "Value", "Type", ""].map(label => (
          <div key={label} style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>{label}</div>
        ))}
      </div>
      {rows.map((row, index) => (
        <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 88px 32px", gap: 6, padding: "8px 10px", borderBottom: index < rows.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
          <input className="input" style={{ fontSize: 12, padding: "5px 8px", fontFamily: "var(--font-mono)" }} value={row.key} onChange={e => updateRow(index, "key", e.target.value)} placeholder="field_name" />
          <input className="input" style={{ fontSize: 12, padding: "5px 8px", fontFamily: "var(--font-mono)" }} value={row.value} onChange={e => updateRow(index, "value", e.target.value)} placeholder='{input} or fixed value' />
          <select className="select" style={{ fontSize: 11, padding: "5px 6px" }} value={row.type} onChange={e => updateRow(index, "type", e.target.value)}>
            <option value="string">str</option>
            <option value="number">num</option>
            <option value="boolean">bool</option>
          </select>
          <button onClick={() => syncRows(rows.filter((_, rowIndex) => rowIndex !== index))} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
      <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-subtle)" }}>
        <button
          type="button"
          onClick={() => syncRows([...rows, { key: "", value: "", type: "string" }])}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11.5, color: "var(--text-muted)" }}
        >
          <Icon name="plus" size={11} /> Add payload field
        </button>
      </div>
      <div style={{ padding: "0 10px 10px", fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Use <span style={{ color: "var(--text-accent)" }}>{"{input}"}</span> wherever the selected identifier value should go.
      </div>
    </div>
  );
};

/* ─── Quick Add Workflow Form ────────────────────────────────────────────── */
const QuickAddWorkflow = ({ tokens, identifierKey, identifierTypes = [], onSaved, onClose }) => {
  const [form, setForm] = useState({
    name:        "",
    label:       "",
    api_url:     "",
    method:      "POST",
    token:       Object.keys(tokens)[0] || "primary",
    input_field: identifierKey || "",
    payload_obj: { id_number: "{input}" },
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.api_url.trim()) {
      setError("Name and API URL are required.");
      return;
    }
    setSaving(true); setError("");
    try {
      const apiName = form.name.trim().toLowerCase().replace(/\s/g, "_") + "_api";
      const apiRes  = await fetch("/api/config/apis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: apiName, url: form.api_url.trim(), method: form.method,
          payload_template: form.payload_obj,
          success_codes: [200, 201], save_codes: [200, 201, 422], retry_codes: [500, 502, 503],
        }),
      });
      if (!apiRes.ok) throw new Error(`API save failed: ${apiRes.status}`);

      const wfName = form.name.trim().toLowerCase().replace(/\s/g, "_");
      const wfRes  = await fetch("/api/config/workflows", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wfName, label: form.label || form.name,
          input_field: form.input_field || identifierKey,
          api: apiName, token: form.token,
        }),
      });
      if (!wfRes.ok) throw new Error(`Workflow save failed: ${wfRes.status}`);
      onSaved(wfName, {
        label: form.label || form.name,
        input_field: form.input_field || identifierKey,
        api: apiName,
        token: form.token,
      });
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border-accent)",
      borderRadius: 10, padding: 14, marginTop: 10,
      display: "flex", flexDirection: "column", gap: 10,
      animation: "fadeSlideUp 200ms var(--ease-out)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        Quick Add Workflow
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Workflow name *</div>
          <input className="input" style={{ fontSize: 12 }} placeholder="e.g. rc_status"
            value={form.name} onChange={e => set("name", e.target.value.toLowerCase().replace(/\s/g, "_"))} />
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Display label</div>
          <input className="input" style={{ fontSize: 12 }} placeholder="e.g. RC Status Check"
            value={form.label} onChange={e => set("label", e.target.value)} />
        </div>
      </div>

        <div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>API URL *</div>
          <input className="input" style={{ fontSize: 12 }} placeholder="https://kyc-api.surepass.io/api/v1/..."
            value={form.api_url} onChange={e => set("api_url", e.target.value)} />
        </div>

      <div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Method</div>
        <select className="select" style={{ fontSize: 12 }} value={form.method} onChange={e => set("method", e.target.value)}>
          <option value="POST">POST</option>
          <option value="GET">GET</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>

      <div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Token</div>
        <select className="select" style={{ fontSize: 12 }} value={form.token} onChange={e => set("token", e.target.value)}>
          {Object.keys(tokens).length === 0
            ? <option value="primary">primary</option>
            : Object.keys(tokens).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 3 }}>Identifier group</div>
        <select className="select" style={{ fontSize: 12 }} value={form.input_field} onChange={e => set("input_field", e.target.value)}>
          {identifierTypes.map(type => <option key={type} value={type}>{type}</option>)}
          {form.input_field && !identifierTypes.includes(form.input_field) && (
            <option value={form.input_field}>{form.input_field} (custom)</option>
          )}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 6 }}>Payload template</div>
        <PayloadConfigurator value={form.payload_obj} onChange={obj => set("payload_obj", obj)} />
      </div>

      {error && (
        <div style={{ fontSize: 11.5, color: "var(--text-error)", background: "rgba(239,68,68,0.08)", borderRadius: 6, padding: "6px 10px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn--secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" style={{ fontSize: 12, padding: "6px 12px", gap: 5 }}
          onClick={handleSave} disabled={saving}>
          {saving
            ? <div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)", width: 12, height: 12 }} />
            : <Icon name="save" size={12} />}
          Save & Add
        </button>
      </div>
    </div>
  );
};

/* ─── Quality Report ─────────────────────────────────────────────────────── */
const QualityReport = ({ report }) => {
  const [expanded, setExpanded] = useState(false);

  if (!report) return (
    <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 5 }}>
      <Icon name="info" size={12} /> Quality check not run yet
    </div>
  );

  if (report.loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
      <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
      Validating format…
    </div>
  );

  if (report.manual) return (
    <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 5 }}>
      <Icon name="info" size={12} /> Manual mode — choose a workflow for this column
    </div>
  );

  if (!report.has_pattern) return (
    <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 5 }}>
      <Icon name="info" size={12} /> No format pattern defined for this type
    </div>
  );

  const pct      = report.valid_pct;
  const isGood   = pct >= 90;
  const isWarn   = pct >= 70 && pct < 90;
  const isBad    = pct < 70;
  const barColor = isGood ? "var(--success)" : isWarn ? "var(--warning)" : "var(--error)";
  const textColor = isGood ? "var(--text-success)" : isWarn ? "var(--text-warning)" : "var(--text-error)";

  return (
    <div style={{
      marginTop: 12,
      background: isBad ? "rgba(239,68,68,0.05)" : isWarn ? "rgba(245,158,11,0.05)" : "rgba(16,185,129,0.05)",
      border: `1px solid ${isBad ? "rgba(239,68,68,0.2)" : isWarn ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
      borderRadius: 8, padding: "10px 12px",
      animation: "fadeSlideUp 200ms var(--ease-out) both",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name={isGood ? "shield" : "alert"} size={13} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: textColor }}>
            Format Quality
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: textColor }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99, transition: "width 600ms var(--ease-out)" }} />
      </div>

      {/* Counts */}
      <div style={{ display: "flex", gap: 14, marginBottom: report.invalid > 0 ? 8 : 0 }}>
        {[
          { label: "valid",   value: report.valid,   color: "var(--text-success)" },
          { label: "invalid", value: report.invalid, color: "var(--text-error)"   },
          { label: "empty",   value: report.empty,   color: "var(--text-muted)"   },
          { label: "total",   value: report.total,   color: "var(--text-primary)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>{value}</div>
            <div style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Invalid samples */}
      {report.invalid > 0 && (
        <>
          <button
            onClick={() => setExpanded(p => !p)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
              padding: 0, marginBottom: expanded ? 8 : 0,
            }}
          >
            <span style={{ transform: expanded ? "rotate(180deg)" : "none", display: "inline-flex", transition: "transform 200ms" }}>
              <Icon name="chevron" size={11} />
            </span>
            {expanded ? "Hide" : "Show"} {report.invalid_samples.length} sample invalid values
            {report.invalid > report.invalid_samples.length && ` (of ${report.invalid} total)`}
          </button>

          {expanded && (
            <div style={{
              background: "var(--bg-terminal)", border: "1px solid var(--border-subtle)",
              borderRadius: 6, overflow: "hidden",
              animation: "fadeSlideUp 150ms var(--ease-out) both",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Row", "Raw value", "Cleaned"].map(h => (
                      <th key={h} style={{ padding: "5px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 500, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.invalid_samples.map((s, i) => (
                    <tr key={i} style={{ borderBottom: i < report.invalid_samples.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                      <td style={{ padding: "5px 10px", color: "var(--text-muted)" }}>{s.row}</td>
                      <td style={{ padding: "5px 10px", color: "var(--text-error)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.raw}</td>
                      <td style={{ padding: "5px 10px", color: "var(--text-warning)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.cleaned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {isBad && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-error)", fontFamily: "var(--font-mono)" }}>
          ⚠️ Less than 70% valid — most rows will be skipped as invalid format
        </div>
      )}
    </div>
  );
};

/* ─── Detection Card ─────────────────────────────────────────────────────── */
const DetectionCard = ({ item, index, allWorkflows, configWorkflows, selectedWorkflows, onAddWorkflow, onRemoveWorkflow, onSkipToggle, skipped, tokens, apis, qualityReport, onWorkflowCreated, onRunValidation, identifierTypes }) => {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [dropdownVal,  setDropdownVal]  = useState("");

  const available = allWorkflows.filter(w => {
    if (selectedWorkflows.includes(w)) return false;
    if (item.manual) return true;
    return configWorkflows[w]?.input_field === item.identifierKey;
  });

  const handleDropdownAdd = (wf) => {
    if (!wf) return;
    onAddWorkflow(item.identifierKey, wf);
    setDropdownVal("");
  };

  const handleQuickSaved = (wfName, workflowConfig) => {
    onWorkflowCreated?.(wfName, workflowConfig);
    onAddWorkflow(item.identifierKey, wfName);
    setShowQuickAdd(false);
  };

  return (
    <div className="detection-card" style={{
      animationDelay: `${index * 60}ms`,
      opacity: skipped ? 0.45 : 1,
      transition: "opacity 200ms ease",
      position: "relative",
    }}>

      {/* ── Skipped overlay label ── */}
      {skipped && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 10, pointerEvents: "none",
        }}>
          <span style={{
            fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
            color: "var(--text-muted)", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px",
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Skipped
          </span>
        </div>
      )}

      {/* Header */}
      <div className="detection-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span className="detection-col-name">{item.column}</span>
          <span className="detection-identifier">{item.manual ? "MANUAL SELECT" : item.identifier}</span>
        </div>
        {/* Skip toggle */}
        <button
          onClick={() => onSkipToggle(item.identifierKey)}
          title={skipped ? "Include this column" : "Skip this column"}
          style={{
            background: skipped ? "rgba(239,68,68,0.12)" : "var(--bg-input)",
            border: `1px solid ${skipped ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
            borderRadius: 6, cursor: "pointer", padding: "3px 8px",
            color: skipped ? "var(--text-error)" : "var(--text-muted)",
            fontSize: 11, fontFamily: "var(--font-mono)",
            display: "flex", alignItems: "center", gap: 4,
            transition: "all 150ms ease", flexShrink: 0,
          }}
          onMouseEnter={e => { if (!skipped) { e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; e.currentTarget.style.color = "var(--text-error)"; } }}
          onMouseLeave={e => { if (!skipped) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; } }}
        >
          <Icon name={skipped ? "check" : "skip"} size={11} />
          {skipped ? "Include" : "Skip"}
        </button>
      </div>

      {/* Confidence bar */}
      {item.manual ? (
        <div style={{
          marginTop: 8,
          padding: "8px 10px",
          background: "var(--bg-input)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          fontSize: 11.5,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}>
          No identifier match found automatically. You can still map this column to any workflow.
        </div>
      ) : (
        <div className="detection-confidence-row" style={{ marginTop: 8 }}>
          <div className="detection-confidence-bar">
            <div className="detection-confidence-fill" style={{ width: `${item.confidence * 100}%` }} />
          </div>
          <span className="detection-confidence-pct">{Math.round(item.confidence * 100)}%</span>
        </div>
      )}

      {/* Quality report */}
      <QualityReport report={qualityReport} />
      {!skipped && (
        <button
          className="btn btn--secondary"
          style={{ marginTop: 10, width: "100%", justifyContent: "center", gap: 6, fontSize: 12 }}
          onClick={() => onRunValidation(item)}
          disabled={qualityReport?.loading}
        >
          {qualityReport?.loading ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="shield" size={12} />}
          Check legitimacy
        </button>
      )}

      {/* CSV column → identifier mapping */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginTop: 10,
        padding: "6px 10px", background: "var(--bg-input)",
        border: "1px solid var(--border-subtle)", borderRadius: 6,
        fontSize: 11.5, fontFamily: "var(--font-mono)",
      }}>
        <span style={{ color: "var(--text-muted)" }}>CSV column:</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{item.column}</span>
        <span style={{ color: "var(--border)", margin: "0 2px" }}>→</span>
        <span style={{ color: "var(--text-accent)" }}>{item.manual ? "workflow input field" : item.identifierKey}</span>
      </div>

      {/* Workflow queue — hidden when skipped */}
      {!skipped && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7, fontFamily: "var(--font-mono)" }}>
            Workflows to run
          </div>

          {/* Chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 28 }}>
            {selectedWorkflows.length === 0 && (
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontStyle: "italic", lineHeight: "28px" }}>
                No workflows selected
              </span>
            )}
            {selectedWorkflows.map(wf => (
              <div key={wf} style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "var(--accent-dim)", border: "1px solid var(--border-accent)",
                borderRadius: 6, padding: "3px 8px 3px 10px",
                fontSize: 12, color: "var(--text-accent)", fontFamily: "var(--font-mono)",
              }}>
                {wf}
                <button onClick={() => onRemoveWorkflow(item.identifierKey, wf)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex", alignItems: "center" }}
                  title="Remove">
                  <Icon name="x" size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* Add from dropdown */}
          {available.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <select className="select" style={{ fontSize: 12, flex: 1 }}
                value={dropdownVal} onChange={e => handleDropdownAdd(e.target.value)}>
                <option value="">+ Add workflow…</option>
                {available.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          )}

          {/* Quick add new workflow */}
          {!showQuickAdd ? (
            <button
              onClick={() => setShowQuickAdd(true)}
              style={{
                marginTop: 8, background: "none", border: "1px dashed var(--border)",
                borderRadius: 6, color: "var(--text-muted)", fontSize: 11.5,
                padding: "5px 10px", cursor: "pointer", width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--text-accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <Icon name="plus" size={11} /> New workflow
            </button>
          ) : (
            <QuickAddWorkflow
              apis={apis} tokens={tokens}
              identifierKey={item.identifierKey}
              identifierTypes={identifierTypes}
              onSaved={handleQuickSaved}
              onClose={() => setShowQuickAdd(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Toggle Switch ──────────────────────────────────────────────────────── */
const Toggle = ({ value, onChange, label, sub }) => (
  <div
    onClick={() => onChange(!value)}
    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 10 }}
  >
    <div>
      <div style={{ fontSize: 12.5, color: value ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 500, transition: "color 150ms" }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>}
    </div>
    <div style={{
      width: 36, height: 20, borderRadius: 99, flexShrink: 0,
      background: value ? "var(--accent)" : "var(--bg-elevated)",
      border: `1px solid ${value ? "var(--accent)" : "var(--border)"}`,
      position: "relative", transition: "all 200ms ease",
    }}>
      <div style={{
        position: "absolute", top: 2, left: value ? 18 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: value ? "#fff" : "var(--text-muted)",
        transition: "left 200ms ease, background 200ms ease",
      }} />
    </div>
  </div>
);

/* ─── Main Upload Page ───────────────────────────────────────────────────── */
export default function Upload() {
  const navigate    = useNavigate();
  const fileInputRef = useRef(null);

  const [dragActive,       setDragActive]       = useState(false);
  const [uploadMode,       setUploadMode]       = useState("manual");
  const [uploading,        setUploading]         = useState(false);
  const [running,          setRunning]           = useState(false);
  const [fileInfo,         setFileInfo]          = useState(null);
  const [detected,         setDetected]          = useState([]);
  const [availableColumns, setAvailableColumns]  = useState([]);
  const [manualColumn,     setManualColumn]      = useState("");
  const [allWorkflows,     setAllWorkflows]      = useState([]);
  const [configWorkflows,  setConfigWorkflows]   = useState({});
  const [columnMap,        setColumnMap]         = useState({});
  const [columnWorkflows,  setColumnWorkflows]   = useState({});
  const [skippedColumns,   setSkippedColumns]    = useState(new Set());
  const [configTokens,     setConfigTokens]      = useState({});
  const [configApis,       setConfigApis]        = useState({});
  const [toasts,           setToasts]            = useState([]);
  const [qualityReports,   setQualityReports]    = useState({}); // { identifierKey: report | null }

  /* ── Run options ────────────────────────────────────────────────────── */
  const [force,        setForce]        = useState(false);
  const [rebuildCsv,   setRebuildCsv]   = useState(false);
  const [delayMins,    setDelayMins]    = useState(0);
  const [customDelay,  setCustomDelay]  = useState(false);
  const [showOptions,  setShowOptions]  = useState(false);

  const delayOptions = [
    { label: "Now",    value: 0   },
    { label: "5 min",  value: 5   },
    { label: "15 min", value: 15  },
    { label: "30 min", value: 30  },
    { label: "1 hr",   value: 60  },
    { label: "2 hr",   value: 120 },
    { label: "Custom", value: -1  },
  ];

  const identifierTypes = useMemo(
    () => Array.from(new Set(Object.values(configWorkflows || {}).map(w => w.input_field).filter(Boolean))).sort(),
    [configWorkflows],
  );

  const workflowGroups = useMemo(() => {
    const groups = {};
    Object.entries(configWorkflows || {}).forEach(([name, workflow]) => {
      const key = workflow.input_field || "uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push({ name, ...workflow });
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [configWorkflows]);

  /* ── Toast ─────────────────────────────────────────────────────────── */
  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => {
      setToasts(p => p.map(t => t.id === id ? { ...t, dismissing: true } : t));
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 300);
    }, 3200);
  }, []);

  /* ── Drag handlers ──────────────────────────────────────────────────── */
  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []); // eslint-disable-line

  /* ── File processing ────────────────────────────────────────────────── */
  const processFile = async (file) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      addToast("Only CSV or Excel files are supported.", "error");
      return;
    }
    setUploading(true);
    setFileInfo(null); setDetected([]); setColumnMap({});
    setAvailableColumns([]); setManualColumn("");
    setColumnWorkflows({}); setSkippedColumns(new Set()); setQualityReports({});

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/upload?mode=${encodeURIComponent(uploadMode)}`, { method: "POST", body: formData });
      if (!res.ok) {
        let message = `Upload failed: ${res.status}`;
        try {
          const detail = await res.json();
          if (detail?.detail) message = detail.detail;
        } catch {
          // fall back to status-based message above
        }
        throw new Error(message);
      }
      const data = await res.json();

      setFileInfo({ filename: data.filename, rows: data.rows, columns: data.columns });
      setAvailableColumns(data.columns || []);
      setAllWorkflows(data.workflows || []);

      const detectedRaw = data.detected || {};
      const detectedArr = Array.isArray(detectedRaw)
        ? detectedRaw
        : Object.entries(detectedRaw).map(([identifierKey, info]) => ({
            column:        info.column,
            identifier:    identifierKey.toUpperCase().replace(/_/g, " "),
            identifierKey,
            workflow:      info.workflow || data.workflows?.[0] || "",
            confidence:    Math.min(info.score ?? 0.8, 1.0),
          }));

      const uploadItems = uploadMode === "auto" ? detectedArr : [];

      setDetected(uploadItems);

      const map = {};
      uploadItems.forEach(d => { map[d.identifierKey] = d.column; });
      setColumnMap(map);

      const wfMap = {};
      uploadItems.forEach(d => { wfMap[d.identifierKey] = d.workflow ? [d.workflow] : []; });
      setColumnWorkflows(wfMap);

      // ── Kick off format validation for each detected column ──
      setQualityReports({});

      try {
        const cfgRes = await fetch("/api/config");
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          setConfigTokens(cfg.tokens || {});
          setConfigApis(cfg.apis || {});
          setConfigWorkflows(cfg.workflows || {});
        }
      } catch { /* non-critical */ }

      if (uploadMode === "manual") {
        addToast("File uploaded. Choose the columns you want to process, then run legitimacy checks only where needed.", "info");
      } else if (detectedArr.length === 0) {
        addToast("No identifier columns were auto-detected. Switch to manual mode to choose columns yourself.", "info");
      }

      addToast(`Uploaded ${data.filename} — ${data.rows?.toLocaleString()} rows.`, "success");
    } catch (err) {
      addToast(err.message || "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  /* ── Workflow queue management ──────────────────────────────────────── */
  const handleAddWorkflow = useCallback((identifierKey, wfName) => {
    setColumnWorkflows(p => {
      const existing = p[identifierKey] || [];
      if (existing.includes(wfName)) return p;
      return { ...p, [identifierKey]: [...existing, wfName] };
    });
    setAllWorkflows(p => p.includes(wfName) ? p : [...p, wfName]);
  }, []);

  const handleRemoveWorkflow = useCallback((identifierKey, wfName) => {
    setColumnWorkflows(p => ({
      ...p,
      [identifierKey]: (p[identifierKey] || []).filter(w => w !== wfName),
    }));
  }, []);

  const handleWorkflowCreated = useCallback((wfName, workflowConfig) => {
    if (!workflowConfig) return;
    setConfigWorkflows(p => ({ ...p, [wfName]: workflowConfig }));
  }, []);

  const handleAddManualColumn = useCallback(() => {
    if (!manualColumn) return;
    setDetected(p => {
      if (p.some(item => item.column === manualColumn)) return p;
      const nextItem = {
        column: manualColumn,
        identifier: "MANUAL SELECT",
        identifierKey: `manual_${Date.now()}_${p.length}`,
        workflow: "",
        confidence: 0,
        manual: true,
      };
      setColumnMap(map => ({ ...map, [nextItem.identifierKey]: manualColumn }));
      setColumnWorkflows(map => ({ ...map, [nextItem.identifierKey]: [] }));
      return [...p, nextItem];
    });
    setManualColumn("");
  }, [manualColumn]);

  const handleRunValidation = useCallback(async (item) => {
    const workflowName = (columnWorkflows[item.identifierKey] || [])[0];
    if (item.manual && !workflowName) {
      addToast("Choose a workflow first so SureFlow knows what kind of data to validate.", "error");
      return;
    }

    setQualityReports(p => ({
      ...p,
      [item.identifierKey]: { loading: true },
    }));

    try {
      const body = {
        filename: fileInfo.filename,
        column: item.column,
        sample_limit: 8,
        scan_limit: 2000,
      };
      if (item.manual) body.workflow_name = workflowName;
      else body.identifier_type = item.identifierKey;

      const res = await fetch("/api/validate-column", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const report = await res.json();
      setQualityReports(p => ({ ...p, [item.identifierKey]: report }));
    } catch (err) {
      setQualityReports(p => ({
        ...p,
        [item.identifierKey]: { has_pattern: false, error: String(err) },
      }));
    }
  }, [addToast, columnWorkflows, fileInfo]);

  /* ── Skip column toggle ─────────────────────────────────────────────── */
  const handleSkipToggle = useCallback((identifierKey) => {
    setSkippedColumns(p => {
      const next = new Set(p);
      if (next.has(identifierKey)) next.delete(identifierKey);
      else next.add(identifierKey);
      return next;
    });
  }, []);

  /* ── Derived counts ─────────────────────────────────────────────────── */
  const activeColumns = detected.filter(d => !skippedColumns.has(d.identifierKey));
  const selectedManualColumns = useMemo(
    () => new Set(detected.filter(d => d.manual).map(d => d.column)),
    [detected],
  );
  const totalJobs     = activeColumns.reduce((sum, d) => sum + (columnWorkflows[d.identifierKey]?.length ?? 0), 0);

  /* ── Validation ─────────────────────────────────────────────────────── */
  const validationMsg = (() => {
    if (!fileInfo)           return "Upload a file to get started.";
    if (detected.length === 0) return uploadMode === "manual"
      ? "Choose one or more columns to process."
      : "No columns are available from this file.";
    if (activeColumns.length === 0) return "All columns are skipped — include at least one.";
    if (totalJobs === 0)     return "Select at least one workflow on an active column.";
    return null;
  })();

  const canRun = !validationMsg && !running && !uploading;

  /* ── Run batch ──────────────────────────────────────────────────────── */
  const handleRun = async () => {
    if (!canRun) return;
    setRunning(true);

    const jobs = [];
    for (const item of activeColumns) {
      for (const wf of (columnWorkflows[item.identifierKey] || [])) {
        const inputField = item.manual
          ? configWorkflows[wf]?.input_field
          : item.identifierKey;
        if (!inputField) {
          throw new Error(`Workflow '${wf}' is missing its input field mapping.`);
        }
        jobs.push({ item, workflow: wf, inputField });
      }
    }

    try {
      const results = await Promise.all(
        jobs.map(({ item, workflow, inputField }) =>
          fetch("/api/jobs/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename:       fileInfo.filename,
              workflow,
              column_map:     { [inputField]: columnMap[item.identifierKey] },
              force:          force,
              rebuild_csv:    rebuildCsv,
              delay_minutes:  Number(delayMins),
            }),
          }).then(r => r.ok ? r.json() : Promise.reject(r.status))
        )
      );

      const jobIds = results.map(r => r.job_id).filter(Boolean);

      if (delayMins > 0) {
        addToast(`${jobIds.length} job${jobIds.length !== 1 ? "s" : ""} scheduled in ${delayMins} min!`, "success");
        setTimeout(() => navigate(`/monitor/${jobIds[0]}`), 600);
      } else {
        addToast(`${jobIds.length} job${jobIds.length !== 1 ? "s" : ""} started!`, "success");
        if (jobIds.length > 0) setTimeout(() => navigate(`/monitor/${jobIds[0]}`), 600);
      }
    } catch (err) {
      addToast(`Failed to start jobs: ${err}`, "error");
      setRunning(false);
    }
  };

  const hasFile = !!fileInfo;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Batch Upload</h1>
        <p className="page-subtitle">Upload a CSV or Excel file and configure your KYC processing pipeline.</p>
      </div>

      <div className="upload-layout">

        {/* ── Left column ─────────────────────────────────────────────── */}
        <div>
          <div style={{
            marginBottom: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 10,
            padding: "12px 14px",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
              Upload mode
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { key: "manual", label: "Manual first", sub: "Best for huge files and many columns" },
                { key: "auto", label: "Automatic", sub: "Try to detect likely columns on upload" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setUploadMode(option.key)}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: `1px solid ${uploadMode === option.key ? "var(--border-accent)" : "var(--border-subtle)"}`,
                    background: uploadMode === option.key ? "var(--accent-dim)" : "var(--bg-input)",
                    color: uploadMode === option.key ? "var(--text-accent)" : "var(--text-primary)",
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{option.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{option.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`dropzone${dragActive ? " dropzone--active" : ""}`}
            onDragEnter={handleDrag} onDragOver={handleDrag}
            onDragLeave={handleDrag} onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{ cursor: uploading ? "wait" : "pointer" }}
          >
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls"
              style={{ display: "none" }} onChange={handleFileInput} />

            {uploading ? (
              <>
                <div className="spinner spinner--lg" />
                <div className="dropzone-title">Processing file…</div>
                <div className="dropzone-sub">Detecting columns and workflows</div>
              </>
            ) : hasFile ? (
              <>
                <div className="dropzone-icon" style={{ color: "var(--success)" }}>
                  <Icon name="check" size={40} />
                </div>
                <div className="dropzone-title" style={{ color: "var(--text-success)" }}>File ready</div>
                <div className="dropzone-sub">Click to replace or drag a new file</div>
              </>
            ) : (
              <>
                <div className="dropzone-icon"><Icon name="folder" size={48} /></div>
                <div className="dropzone-title">Drop your file here</div>
                <div className="dropzone-sub">Supports .csv, .xlsx, .xls</div>
                <div className="dropzone-or">— or click to browse —</div>
              </>
            )}
          </div>

          {/* File info bar */}
          {hasFile && (
            <div className="file-info-bar">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="file" size={14} />
                <span className="file-info-name">{fileInfo.filename}</span>
              </div>
              <span className="file-info-rows">
                {fileInfo.rows?.toLocaleString()} rows · {fileInfo.columns?.length} columns
              </span>
            </div>
          )}

          {/* Detection cards */}
          {hasFile && uploadMode === "manual" && (
            <div style={{ marginTop: 24 }}>
              <div className="section-header">
                <div>
                  <div className="section-title">Manual Column Selection</div>
                  <div className="section-sub">
                    Pick only the columns you want to process, then run legitimacy checks on demand
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <select className="select" style={{ flex: 1 }} value={manualColumn} onChange={e => setManualColumn(e.target.value)}>
                  <option value="">Select a file column…</option>
                  {availableColumns
                    .filter(column => !selectedManualColumns.has(column))
                    .map(column => <option key={column} value={column}>{column}</option>)}
                </select>
                <button className="btn btn--primary" onClick={handleAddManualColumn} disabled={!manualColumn}>
                  <Icon name="plus" size={13} /> Add
                </button>
              </div>
            </div>
          )}

          {detected.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="section-header">
                <div>
                  <div className="section-title">Column Detection</div>
                  <div className="section-sub">
                    {detected.filter(d => !d.manual).length > 0
                      ? `${detected.filter(d => !d.manual).length} identifier${detected.filter(d => !d.manual).length !== 1 ? "s" : ""} found`
                      : `${detected.length} column${detected.length !== 1 ? "s" : ""} ready for manual selection`}
                    {skippedColumns.size > 0 && ` · ${skippedColumns.size} skipped`}
                    {totalJobs > 0 && ` · ${totalJobs} workflow${totalJobs !== 1 ? "s" : ""} queued`}
                  </div>
                </div>
                <span className="badge badge--success">
                  <span className="badge-dot" />{detected.some(d => d.manual) ? "Manual fallback" : "Auto-detected"}
                </span>
              </div>

              <div className="detection-grid">
                {detected.map((item, i) => (
                  <DetectionCard
                    key={item.column}
                    item={item}
                    index={i}
                    allWorkflows={allWorkflows}
                    configWorkflows={configWorkflows}
                    selectedWorkflows={columnWorkflows[item.identifierKey] || []}
                    onAddWorkflow={handleAddWorkflow}
                    onRemoveWorkflow={handleRemoveWorkflow}
                    onSkipToggle={handleSkipToggle}
                    skipped={skippedColumns.has(item.identifierKey)}
                    tokens={configTokens}
                    apis={configApis}
                    qualityReport={qualityReports[item.identifierKey]}
                    onWorkflowCreated={handleWorkflowCreated}
                    onRunValidation={handleRunValidation}
                    identifierTypes={identifierTypes}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel ─────────────────────────────────────────────── */}
        <div>
          <div className="workflow-panel">
            <div className="workflow-panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="zap" size={15} />
              Pipeline Configuration
            </div>

            {hasFile && (
              <>
                {/* File info */}
                <div className="form-group">
                  <label className="label">File</label>
                  <div style={{
                    background: "var(--bg-input)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-btn)", padding: "8px 12px",
                    fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)",
                  }}>
                    {fileInfo.filename}
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "Rows",        value: fileInfo.rows?.toLocaleString() },
                    { label: "Columns",     value: fileInfo.columns?.length },
                    { label: "Active",      value: activeColumns.length },
                    { label: "Jobs queued", value: totalJobs },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                      borderRadius: 8, padding: "10px 12px",
                    }}>
                      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: label === "Jobs queued" && totalJobs > 0 ? "var(--text-accent)" : "var(--text-primary)" }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Job queue summary — shows CSV column → workflow mapping */}
                {totalJobs > 0 && (
                  <div style={{
                    background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                    borderRadius: 8, padding: "12px", marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                      Job queue
                    </div>
                    {activeColumns.map((item) => {
                      const wfs = columnWorkflows[item.identifierKey] || [];
                      if (wfs.length === 0) return null;
                      const csvCol = columnMap[item.identifierKey] || item.identifierKey;
                      return (
                        <div key={item.identifierKey} style={{ marginBottom: 8 }}>
                          {/* CSV col → identifier mapping */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                              {csvCol}
                            </span>
                            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>
                            <span style={{ fontSize: 10, color: "var(--text-accent)", fontFamily: "var(--font-mono)", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 4, padding: "1px 6px" }}>
                              {item.manual ? "manual" : item.identifierKey}
                            </span>
                          </div>
                          {/* Workflow chips */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 8 }}>
                            {wfs.map((wf, idx) => (
                              <div key={wf} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                {idx > 0 && <span style={{ color: "var(--text-muted)", fontSize: 10 }}>→</span>}
                                <span style={{
                                  fontSize: 11, fontFamily: "var(--font-mono)",
                                  background: "var(--accent-dim)", color: "var(--text-accent)",
                                  border: "1px solid var(--border-accent)",
                                  borderRadius: 4, padding: "1px 7px",
                                }}>{item.manual && configWorkflows[wf]?.input_field ? `${wf} (${configWorkflows[wf].input_field})` : wf}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Advanced options toggle ── */}
                <button
                  onClick={() => setShowOptions(p => !p)}
                  style={{
                    width: "100%", background: "none",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8, padding: "8px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    color: "var(--text-muted)", fontSize: 12,
                    fontFamily: "var(--font-mono)", marginBottom: 12,
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--text-accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="chevron" size={13} />
                    Advanced options
                    {(force || rebuildCsv || delayMins > 0) && (
                      <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "1px 5px" }}>
                        {[force, rebuildCsv, delayMins > 0].filter(Boolean).length} active
                      </span>
                    )}
                  </span>
                  <span style={{ transform: showOptions ? "rotate(180deg)" : "none", display: "flex", transition: "transform 200ms" }}>
                    <Icon name="chevron" size={13} />
                  </span>
                </button>

                {/* Advanced options panel */}
                {showOptions && (
                  <div style={{
                    background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                    borderRadius: 10, padding: "14px 16px", marginBottom: 16,
                    display: "flex", flexDirection: "column", gap: 14,
                    animation: "fadeSlideUp 200ms var(--ease-out) both",
                  }}>

                    {/* Force re-process */}
                    <Toggle
                      value={force}
                      onChange={setForce}
                      label="Force re-process"
                      sub="Re-call API even if response already exists"
                    />

                    {/* Rebuild CSV only */}
                    <div style={{ height: 1, background: "var(--border-subtle)" }} />
                    <Toggle
                      value={rebuildCsv}
                      onChange={setRebuildCsv}
                      label="Rebuild CSV only"
                      sub="Re-generate output from existing JSON responses"
                    />

                    {/* Delay / Schedule */}
                    <div style={{ height: 1, background: "var(--border-subtle)" }} />
                    <div>
                      <div style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500, marginBottom: 2 }}>
                        Schedule delay
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                        Start jobs after a delay
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {delayOptions.map(opt => (
                          <button key={opt.value}
                            onClick={() => {
                              if (opt.value === -1) { setCustomDelay(true); }
                              else { setDelayMins(opt.value); setCustomDelay(false); }
                            }}
                            style={{
                              padding: "4px 10px", borderRadius: 6, fontSize: 11.5,
                              fontFamily: "var(--font-mono)", cursor: "pointer",
                              border: `1px solid ${(!customDelay && delayMins === opt.value) || (customDelay && opt.value === -1) ? "var(--border-accent)" : "var(--border)"}`,
                              background: (!customDelay && delayMins === opt.value) || (customDelay && opt.value === -1) ? "var(--accent-dim)" : "var(--bg-elevated)",
                              color: (!customDelay && delayMins === opt.value) || (customDelay && opt.value === -1) ? "var(--text-accent)" : "var(--text-muted)",
                              transition: "all 150ms",
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {customDelay && (
                        <input type="number" className="input" min={1} placeholder="Minutes"
                          value={delayMins === 0 ? "" : delayMins}
                          onChange={e => setDelayMins(e.target.value)}
                          style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 8 }} autoFocus />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="divider" style={{ margin: "16px 0" }} />

            {/* ── Validation message ── */}
            {validationMsg && hasFile && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 8, padding: "8px 12px", marginBottom: 12,
                fontSize: 12, color: "var(--text-warning)", fontFamily: "var(--font-mono)",
                animation: "fadeSlideUp 200ms var(--ease-out) both",
              }}>
                <Icon name="info" size={13} />
                {validationMsg}
              </div>
            )}

            {/* ── Run button ── */}
            <button className="btn btn--primary-lg" onClick={handleRun} disabled={!canRun}>
              {running ? (
                <>
                  <div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} />
                  Starting {totalJobs} job{totalJobs !== 1 ? "s" : ""}…
                </>
              ) : delayMins > 0 ? (
                <>
                  <Icon name="timer" size={16} />
                  Schedule {totalJobs > 0 ? `${totalJobs} Job${totalJobs !== 1 ? "s" : ""}` : "Batch"} in {delayMins} min
                </>
              ) : (
                <>
                  Run {totalJobs > 0 ? `${totalJobs} Job${totalJobs !== 1 ? "s" : ""}` : "Batch"}
                  <Icon name="arrow" size={16} />
                </>
              )}
            </button>

            {!hasFile && (
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", marginTop: 10, fontFamily: "var(--font-mono)" }}>
                Upload a file to enable
              </p>
            )}
          </div>

          {/* Tip card */}
          <div style={{
            marginTop: 12, background: "var(--accent-dim)",
            border: "1px solid var(--border-accent)",
            borderRadius: "var(--radius-card)", padding: "14px 16px",
          }}>
            <div style={{ fontSize: 11.5, color: "var(--text-accent)", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="zap" size={13} /> How it works
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
              Each detected or manually selected column can run <strong style={{ color: "var(--text-secondary)" }}>multiple workflows</strong> independently.
              Use <strong style={{ color: "var(--text-secondary)" }}>Skip</strong> to exclude wrongly detected columns.
              Open <strong style={{ color: "var(--text-secondary)" }}>Advanced options</strong> to force re-process, rebuild CSV, or schedule a delayed start.
            </p>
          </div>

          {workflowGroups.length > 0 && (
            <div style={{
              marginTop: 12,
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-card)",
              padding: "14px 16px",
            }}>
              <div style={{ fontSize: 11.5, color: "var(--text-accent)", fontWeight: 600, marginBottom: 10 }}>
                Workflow Subcategories
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {workflowGroups.map(([group, workflowsInGroup]) => (
                  <div key={group}>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontFamily: "var(--font-mono)" }}>
                      {group}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {workflowsInGroup.map(workflow => (
                        <span key={workflow.name} style={{
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 6,
                          padding: "3px 8px",
                          color: "var(--text-primary)",
                        }}>
                          {workflow.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      <Toast toasts={toasts} />
    </>
  );
}
