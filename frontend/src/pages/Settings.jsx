import { useState, useEffect, useCallback, useMemo } from "react";

/* ─── API Template Catalogue ─────────────────────────────────────────────── */
const API_CATALOGUE = [
  /* ── PAN ── */
  {
    category: "PAN",
    templates: [
      { name: "PAN Lite",                id: "pan_lite",                payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Comprehensive",       id: "pan_comprehensive",       payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Comprehensive V2",    id: "pan_comprehensive_v2",    payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Comprehensive Plus",  id: "pan_comprehensive_plus",  payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Advanced",            id: "pan_advanced",            payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Advanced V2",         id: "pan_advanced_v2",         payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Advanced V3",         id: "pan_advanced_v3",         payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN With Details V2",     id: "pan_with_details_v2",     payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN With Details V3",     id: "pan_with_details_v3",     payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN To Aadhaar",          id: "pan_to_aadhaar",          payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN To Father Name",      id: "pan_to_father_name",      payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN KRA",                 id: "pan_kra",                 payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Account Linkage",     id: "pan_account_linkage",     payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Masked Aadhaar",      id: "pan_masked_aadhaar",      payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN Verify",              id: "pan_verify",              payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN To Email Mobile",     id: "pan_to_email_mobile",     payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "PAN To CIN",              id: "pan_to_cin",              payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
  /* ── Mobile → PAN ── */
  {
    category: "Mobile → PAN",
    templates: [
      { name: "Mobile To PAN",           id: "mobile_to_pan",           payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Mobile To PAN V2",        id: "mobile_to_pan_v2",        payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Mobile To PAN Advance",   id: "mobile_to_pan_advance",   payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Mobile To Prefill",       id: "mobile_to_prefill",       payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Mobile To Prefill V2",    id: "mobile_to_prefill_v2",    payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Mobile To Prefill V3",    id: "mobile_to_prefill_v3",    payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
  /* ── RC / Vehicle ── */
  {
    category: "RC / Vehicle",
    templates: [
      { name: "RC Details",              id: "rc_details",              payload: [{ key: "id_number", value: "{input}", type: "string" }, { key: "cache_age", value: "7", type: "number" }] },
      { name: "RC Full",                 id: "rc_full",                 payload: [{ key: "id_number", value: "{input}", type: "string" }, { key: "cache_age", value: "7", type: "number" }, { key: "backend_string", value: "caryanam_ulip_with_reprint", type: "string" }] },
      { name: "Chassis To RC",           id: "chassis_to_rc",           payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "RC Financer",             id: "rc_financer",             payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
  /* ── GST ── */
  {
    category: "GST",
    templates: [
      { name: "GST Verification",        id: "gst_verification",        payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "GST Full Details",        id: "gst_full_details",        payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "GST Filing",              id: "gst_filing",              payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "GST To PAN",              id: "gst_to_pan",              payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
  /* ── Aadhaar ── */
  {
    category: "Aadhaar",
    templates: [
      { name: "Aadhaar Verify",          id: "aadhaar_verify",          payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Aadhaar To Name",         id: "aadhaar_to_name",         payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Aadhaar Demographic",     id: "aadhaar_demographic",     payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
  /* ── Corporate ── */
  {
    category: "Corporate",
    templates: [
      { name: "CIN Details",             id: "cin_details",             payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "DIN Details",             id: "din_details",             payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Company Search",          id: "company_search",          payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "MCA Details",             id: "mca_details",             payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
  /* ── Driving Licence ── */
  {
    category: "Driving Licence",
    templates: [
      { name: "DL Verify",               id: "dl_verify",               payload: [{ key: "id_number", value: "{input}", type: "string" }, { key: "dob", value: "", type: "string" }] },
      { name: "DL Details",              id: "dl_details",              payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
  /* ── Passport ── */
  {
    category: "Passport",
    templates: [
      { name: "Passport Verify",         id: "passport_verify",         payload: [{ key: "id_number", value: "{input}", type: "string" }, { key: "dob", value: "", type: "string" }, { key: "name", value: "", type: "string" }] },
    ],
  },
  /* ── Bank / Financial ── */
  {
    category: "Bank / Financial",
    templates: [
      { name: "Bank Account Verify",     id: "bank_account_verify",     payload: [{ key: "id_number", value: "{input}", type: "string" }, { key: "ifsc", value: "", type: "string" }] },
      { name: "IFSC Details",            id: "ifsc_details",            payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "UPI Verify",              id: "upi_verify",              payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
  /* ── Voter ID ── */
  {
    category: "Voter ID",
    templates: [
      { name: "Voter ID Verify",         id: "voter_id_verify",         payload: [{ key: "id_number", value: "{input}", type: "string" }] },
      { name: "Voter ID Details",        id: "voter_id_details",        payload: [{ key: "id_number", value: "{input}", type: "string" }] },
    ],
  },
];

const CATEGORY_COLORS = {
  "PAN":              { bg: "rgba(59,130,246,0.1)",   border: "rgba(59,130,246,0.25)",   text: "var(--text-accent)"  },
  "Mobile → PAN":     { bg: "rgba(16,185,129,0.1)",   border: "rgba(16,185,129,0.25)",   text: "var(--text-success)" },
  "RC / Vehicle":     { bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.25)",   text: "var(--text-warning)" },
  "GST":              { bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.25)",  text: "#a78bfa"             },
  "Aadhaar":          { bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.25)",    text: "var(--text-error)"   },
  "Corporate":        { bg: "rgba(6,182,212,0.1)",    border: "rgba(6,182,212,0.25)",    text: "var(--info)"         },
  "Driving Licence":  { bg: "rgba(251,191,36,0.1)",   border: "rgba(251,191,36,0.25)",   text: "#fbbf24"             },
  "Passport":         { bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.25)",   text: "#34d399"             },
  "Bank / Financial": { bg: "rgba(99,102,241,0.1)",   border: "rgba(99,102,241,0.25)",   text: "#818cf8"             },
  "Voter ID":         { bg: "rgba(236,72,153,0.1)",   border: "rgba(236,72,153,0.25)",   text: "#f472b6"             },
};

/* ─── Payload helpers ────────────────────────────────────────────────────── */
const payloadRowsToObject = (rows) => {
  const obj = {};
  rows.forEach(({ key, value, type }) => {
    if (!key.trim()) return;
    if (type === "number") obj[key] = isNaN(Number(value)) ? value : Number(value);
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

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const Icon = ({ name, size = 16 }) => {
  const paths = {
    key:      <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>,
    cpu:      <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></>,
    globe:    <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
    library:  <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff:   <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>,
    trash:    <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
    plus:     <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    edit:     <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    check:    <polyline points="20 6 9 17 4 12" />,
    x:        <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    chevron:  <polyline points="6 9 12 15 18 9" />,
    save:     <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>,
    arrow:    <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
    search:   <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    copy:     <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    code:     <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
    list:     <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    zap:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
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
      <div key={t.id} className={`toast toast--${t.type}${t.dismissing ? " toast--dismissing" : ""}`}>
        <div className="toast-icon">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "i"}</div>
        <span className="toast-message">{t.message}</span>
      </div>
    ))}
  </div>
);

/* ─── Collapsible Section ────────────────────────────────────────────────── */
const Section = ({ icon, title, badge, defaultOpen = false, children, index }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="settings-section" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="settings-section-header" onClick={() => setOpen((o) => !o)}>
        <div className="settings-section-title">
          <div className="settings-section-icon"><Icon name={icon} size={14} /></div>
          {title}
          {badge != null && (
            <span className="badge badge--neutral" style={{ fontSize: 10, padding: "1px 7px" }}>{badge}</span>
          )}
        </div>
        <span className={`settings-chevron${open ? " settings-chevron--open" : ""}`}>
          <Icon name="chevron" size={15} />
        </span>
      </div>
      {open && <div className="settings-section-body">{children}</div>}
    </div>
  );
};

/* ─── Modal ──────────────────────────────────────────────────────────────── */
const Modal = ({ title, onClose, children, wide = false }) => (
  <div
    style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, animation: "fadeIn 150ms ease",
    }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-card)", width: "100%", maxWidth: wide ? 780 : 560,
      maxHeight: "90vh", display: "flex", flexDirection: "column",
      boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      animation: "fadeSlideUp 220ms var(--ease-out)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
        <button className="btn btn--icon" onClick={onClose}><Icon name="x" size={14} /></button>
      </div>
      <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>{children}</div>
    </div>
  </div>
);

/* ─── Payload Configurator ───────────────────────────────────────────────── */
const PayloadConfigurator = ({ value, onChange }) => {
  const [mode,   setMode]   = useState("visual"); // "visual" | "json"
  const [rows,   setRows]   = useState(() => objectToPayloadRows(value));
  const [raw,    setRaw]    = useState(() => JSON.stringify(value || { id_number: "{input}" }, null, 2));
  const [jsonErr, setJsonErr] = useState("");

  /* sync rows → parent */
  const syncFromRows = (newRows) => {
    setRows(newRows);
    const obj = payloadRowsToObject(newRows);
    setRaw(JSON.stringify(obj, null, 2));
    onChange(obj);
    setJsonErr("");
  };

  /* sync raw JSON → parent */
  const syncFromRaw = (text) => {
    setRaw(text);
    try {
      const obj = JSON.parse(text);
      setRows(objectToPayloadRows(obj));
      onChange(obj);
      setJsonErr("");
    } catch {
      setJsonErr("Invalid JSON");
    }
  };

  const addRow = () => syncFromRows([...rows, { key: "", value: "", type: "string" }]);

  const updateRow = (i, field, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    syncFromRows(next);
  };

  const removeRow = (i) => syncFromRows(rows.filter((_, idx) => idx !== i));

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label className="label" style={{ marginBottom: 0 }}>Payload Template</label>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ key: "visual", icon: "list", label: "Visual" }, { key: "json", icon: "code", label: "JSON" }].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "3px 10px", borderRadius: 6, fontSize: 11.5, cursor: "pointer",
                fontFamily: "var(--font-mono)",
                border: `1px solid ${mode === m.key ? "var(--border-accent)" : "var(--border)"}`,
                background: mode === m.key ? "var(--accent-dim)" : "var(--bg-input)",
                color: mode === m.key ? "var(--text-accent)" : "var(--text-muted)",
                transition: "all 150ms",
              }}>
              <Icon name={m.icon} size={11} />{m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "visual" ? (
        <div style={{
          background: "var(--bg-input)", border: "1px solid var(--border)",
          borderRadius: 8, overflow: "hidden",
        }}>
          {/* Header row */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 80px 32px",
            gap: 0, padding: "6px 10px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
          }}>
            {["Key", "Value", "Type", ""].map(h => (
              <div key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 80px 32px",
              gap: 6, padding: "7px 10px",
              borderBottom: i < rows.length - 1 ? "1px solid var(--border-subtle)" : "none",
              alignItems: "center",
            }}>
              <input
                className="input" style={{ fontSize: 12, padding: "5px 8px", fontFamily: "var(--font-mono)" }}
                placeholder="field_name" value={row.key}
                onChange={e => updateRow(i, "key", e.target.value)}
              />
              <input
                className="input" style={{ fontSize: 12, padding: "5px 8px", fontFamily: "var(--font-mono)" }}
                placeholder="value or {input}" value={row.value}
                onChange={e => updateRow(i, "value", e.target.value)}
              />
              <select className="select" style={{ fontSize: 11, padding: "5px 6px" }}
                value={row.type} onChange={e => updateRow(i, "type", e.target.value)}>
                <option value="string">str</option>
                <option value="number">num</option>
                <option value="boolean">bool</option>
              </select>
              <button onClick={() => removeRow(i)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, borderRadius: 4, transition: "color 150ms" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--text-error)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}

          {/* Add row */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-subtle)" }}>
            <button onClick={addRow}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "1px dashed var(--border)",
                borderRadius: 6, padding: "4px 12px", cursor: "pointer",
                fontSize: 11.5, color: "var(--text-muted)", transition: "all 150ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--text-accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}>
              <Icon name="plus" size={11} /> Add field
            </button>
          </div>
        </div>
      ) : (
        <div>
          <textarea
            className="input"
            rows={6}
            style={{ fontFamily: "var(--font-mono)", fontSize: 12, resize: "vertical", borderColor: jsonErr ? "rgba(239,68,68,0.5)" : undefined }}
            value={raw}
            onChange={e => syncFromRaw(e.target.value)}
          />
          {jsonErr && <div style={{ fontSize: 11, color: "var(--text-error)", marginTop: 3 }}>{jsonErr}</div>}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 5, fontFamily: "var(--font-mono)" }}>
        Use <span style={{ color: "var(--text-accent)" }}>{"{input}"}</span> as placeholder for the identifier value
      </div>
    </div>
  );
};

/* ─── Token Row ──────────────────────────────────────────────────────────── */
const TokenRow = ({ name, value, onDelete, onEdit }) => {
  const [visible, setVisible] = useState(false);
  const masked = "•".repeat(Math.min(value?.length ?? 12, 24));
  return (
    <div className="token-row">
      <div className="token-name">{name}</div>
      <div className="token-value" title={visible ? value : undefined}>{visible ? value : masked}</div>
      <div className="token-actions">
        <button className="btn btn--icon" onClick={() => setVisible(v => !v)} title={visible ? "Hide" : "Show"}>
          <Icon name={visible ? "eyeOff" : "eye"} size={13} />
        </button>
        <button className="btn btn--icon" onClick={() => onEdit(name, value)} title="Edit"
          style={{ color: "var(--text-accent)", borderColor: "var(--border-accent)" }}>
          <Icon name="edit" size={13} />
        </button>
        <button className="btn btn--icon" onClick={() => onDelete(name)} title="Delete"
          style={{ color: "var(--text-error)", borderColor: "rgba(239,68,68,0.2)" }}>
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
};

/* ─── Workflow Card ──────────────────────────────────────────────────────── */
const WorkflowCard = ({ name, wf, onEdit, onDelete, onDuplicate }) => (
  <div style={{
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "14px 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    transition: "border-color 200ms ease",
  }}
    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-accent)"}
    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
  >
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-accent)" }}>{name}</span>
        <span className="badge badge--neutral" style={{ fontSize: 10 }}>{wf.token || "primary"}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{wf.label || name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {[{ label: `input: ${wf.input_field}` }, null, { label: `api: ${wf.api}` }].map((item, i) =>
          item === null
            ? <Icon key={i} name="arrow" size={11} />
            : <span key={i} style={{
                fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)",
                background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                borderRadius: 5, padding: "2px 8px",
              }}>{item.label}</span>
        )}
      </div>
    </div>
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button className="btn btn--icon" onClick={() => onDuplicate(name, wf)} title="Duplicate"
        style={{ color: "var(--text-muted)" }}>
        <Icon name="copy" size={13} />
      </button>
      <button className="btn btn--icon" onClick={() => onEdit(name, wf)} title="Edit"
        style={{ color: "var(--text-accent)", borderColor: "var(--border-accent)" }}>
        <Icon name="edit" size={13} />
      </button>
      <button className="btn btn--icon" onClick={() => onDelete(name)} title="Delete"
        style={{ color: "var(--text-error)", borderColor: "rgba(239,68,68,0.2)" }}>
        <Icon name="trash" size={13} />
      </button>
    </div>
  </div>
);

/* ─── Workflow Form ──────────────────────────────────────────────────────── */
const WorkflowForm = ({ initial, apis, tokens, identifierTypes, onSave, onClose }) => {
  const isEdit = !!(initial && initial.name);
  const [form, setForm] = useState({
    name:        initial?.name        || "",
    label:       initial?.label       || "",
    input_field: initial?.input_field || "",
    api:         initial?.api         || Object.keys(apis)[0] || "",
    token:       initial?.token       || Object.keys(tokens)[0] || "primary",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.input_field.trim() || !form.api.trim()) return;
    setSaving(true);
    await onSave(form, isEdit);
    setSaving(false);
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label className="label">Workflow ID *</label>
          <input className="input" placeholder="e.g. pan_comprehensive"
            value={form.name}
            onChange={e => set("name", e.target.value.toLowerCase().replace(/\s/g, "_"))}
            disabled={isEdit} style={{ opacity: isEdit ? 0.6 : 1 }} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3, fontFamily: "var(--font-mono)" }}>No spaces, lowercase</div>
        </div>
        <div>
          <label className="label">Display Label</label>
          <input className="input" placeholder="e.g. PAN Comprehensive"
            value={form.label} onChange={e => set("label", e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="label">Input Field (identifier type) *</label>
        <select className="select" value={form.input_field} onChange={e => set("input_field", e.target.value)}>
          <option value="">— Select identifier type —</option>
          {identifierTypes.map(id => <option key={id} value={id}>{id}</option>)}
          {form.input_field && !identifierTypes.includes(form.input_field) && (
            <option value={form.input_field}>{form.input_field} (custom)</option>
          )}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label className="label">API *</label>
          <select className="select" value={form.api} onChange={e => set("api", e.target.value)}>
            <option value="">— Select API —</option>
            {Object.keys(apis).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Token</label>
          <select className="select" value={form.token} onChange={e => set("token", e.target.value)}>
            {Object.keys(tokens).length === 0
              ? <option value="primary">primary</option>
              : Object.keys(tokens).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* YAML preview */}
      <div style={{
        background: "var(--bg-terminal)", border: "1px solid var(--border-subtle)",
        borderRadius: 8, padding: "12px 14px", marginBottom: 16,
        fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.9,
      }}>
        <div style={{ color: "var(--text-muted)", marginBottom: 4, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Preview — config.yaml</div>
        <div><span style={{ color: "var(--text-accent)", fontWeight: 700 }}>{form.name || "workflow_id"}</span><span style={{ color: "var(--text-muted)" }}>:</span></div>
        <div style={{ paddingLeft: 14 }}><span style={{ color: "#60a5fa" }}>label</span><span style={{ color: "var(--text-muted)" }}>: </span><span style={{ color: "#34d399" }}>"{form.label || form.name || "…"}"</span></div>
        <div style={{ paddingLeft: 14 }}><span style={{ color: "#60a5fa" }}>input_field</span><span style={{ color: "var(--text-muted)" }}>: </span><span style={{ color: "#fbbf24" }}>{form.input_field || "…"}</span></div>
        <div style={{ paddingLeft: 14 }}><span style={{ color: "#60a5fa" }}>api</span><span style={{ color: "var(--text-muted)" }}>: </span><span style={{ color: "#fbbf24" }}>{form.api || "…"}</span></div>
        <div style={{ paddingLeft: 14 }}><span style={{ color: "#60a5fa" }}>token</span><span style={{ color: "var(--text-muted)" }}>: </span><span style={{ color: "#fbbf24" }}>{form.token}</span></div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" onClick={handleSave}
          disabled={saving || !form.name.trim() || !form.input_field.trim() || !form.api.trim()}
          style={{ gap: 6 }}>
          {saving ? <div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} /> : <Icon name="save" size={13} />}
          {isEdit ? "Save Changes" : "Create Workflow"}
        </button>
      </div>
    </>
  );
};

const IdentifierPatternCard = ({ name, pattern, onEdit, onDelete }) => (
  <div style={{
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "14px 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  }}>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-accent)" }}>{name}</span>
        {pattern.maps_to_workflow && <span className="badge badge--neutral" style={{ fontSize: 10 }}>{pattern.maps_to_workflow}</span>}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)", wordBreak: "break-all", marginBottom: 6 }}>
        {pattern.regex}
      </div>
      {!!(pattern.hint_words || []).length && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {(pattern.hint_words || []).map(word => (
            <span key={word} style={{ fontSize: 10, fontFamily: "var(--font-mono)", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "1px 6px", color: "var(--text-muted)" }}>{word}</span>
          ))}
        </div>
      )}
    </div>
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button className="btn btn--icon" onClick={() => onEdit(name, pattern)} style={{ color: "var(--text-accent)", borderColor: "var(--border-accent)" }}>
        <Icon name="edit" size={13} />
      </button>
      <button className="btn btn--icon" onClick={() => onDelete(name)} style={{ color: "var(--text-error)", borderColor: "rgba(239,68,68,0.2)" }}>
        <Icon name="trash" size={13} />
      </button>
    </div>
  </div>
);

const IdentifierPatternForm = ({ initial, workflows, onSave, onClose }) => {
  const isEdit = !!(initial && initial.name);
  const [form, setForm] = useState({
    name: initial?.name || "",
    regex: initial?.regex || "",
    hint_words: (initial?.hint_words || []).join(", "),
    maps_to_workflow: initial?.maps_to_workflow || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.regex.trim()) return;
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      regex: form.regex.trim(),
      hint_words: form.hint_words.split(",").map(s => s.trim()).filter(Boolean),
      maps_to_workflow: form.maps_to_workflow || null,
    }, isEdit);
    setSaving(false);
  };

  return (
    <>
      <div className="form-group">
        <label className="label">Identifier key *</label>
        <input className="input" value={form.name} onChange={e => set("name", e.target.value.toLowerCase().replace(/\s/g, "_"))} disabled={isEdit} style={{ opacity: isEdit ? 0.6 : 1 }} />
      </div>
      <div className="form-group">
        <label className="label">Regex *</label>
        <input className="input" value={form.regex} onChange={e => set("regex", e.target.value)} />
      </div>
      <div className="form-group">
        <label className="label">Hint words</label>
        <input className="input" value={form.hint_words} onChange={e => set("hint_words", e.target.value)} placeholder="comma,separated,hints" />
      </div>
      <div className="form-group">
        <label className="label">Default workflow</label>
        <select className="select" value={form.maps_to_workflow} onChange={e => set("maps_to_workflow", e.target.value)}>
          <option value="">— None —</option>
          {Object.keys(workflows).map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving || !form.name.trim() || !form.regex.trim()} style={{ gap: 6 }}>
          {saving ? <div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} /> : <Icon name="save" size={13} />}
          {isEdit ? "Save Changes" : "Create Identifier"}
        </button>
      </div>
    </>
  );
};

/* ─── API Endpoint Card ──────────────────────────────────────────────────── */
const ApiCard = ({ name, ep, onEdit, onDelete }) => {
  const url       = typeof ep === "string" ? ep : (ep.url || "—");
  const method    = ep.method || "POST";
  const saveCodes = Array.isArray(ep.save_codes) ? ep.save_codes.join(", ") : "—";
  const payloadKeys = ep.payload_template ? Object.keys(ep.payload_template) : [];

  return (
    <div style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px 16px",
      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
      transition: "border-color 200ms ease",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-accent)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-accent)" }}>{name}</span>
          <span className="badge badge--neutral" style={{ fontSize: 10 }}>{method}</span>
          {saveCodes !== "—" && (
            <span className="badge badge--neutral" style={{ fontSize: 10, color: "var(--text-success)" }}>save: {saveCodes}</span>
          )}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)", wordBreak: "break-all", lineHeight: 1.5, marginBottom: payloadKeys.length ? 6 : 0 }}>
          {url}
        </div>
        {payloadKeys.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {payloadKeys.map(k => (
              <span key={k} style={{
                fontSize: 10, fontFamily: "var(--font-mono)",
                background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                borderRadius: 4, padding: "1px 6px", color: "var(--text-muted)",
              }}>{k}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button className="btn btn--icon" onClick={() => onEdit(name, ep)} title="Edit"
          style={{ color: "var(--text-accent)", borderColor: "var(--border-accent)" }}>
          <Icon name="edit" size={13} />
        </button>
        <button className="btn btn--icon" onClick={() => onDelete(name)} title="Delete"
          style={{ color: "var(--text-error)", borderColor: "rgba(239,68,68,0.2)" }}>
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
};

/* ─── API Endpoint Form ──────────────────────────────────────────────────── */
const ApiForm = ({ initial, onSave, onClose }) => {
  const isEdit = !!(initial && initial.name);
  const [form, setForm] = useState({
    name:          initial?.name            || "",
    url:           initial?.url             || "",
    method:        initial?.method          || "POST",
    payload_obj:   initial?.payload_template || { id_number: "{input}" },
    success_codes: (initial?.success_codes  || [200, 201]).join(", "),
    save_codes:    (initial?.save_codes     || [200, 201, 422]).join(", "),
    retry_codes:   (initial?.retry_codes    || [500, 502, 503]).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const parseCodes = (str) =>
    str.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    await onSave({
      name:             form.name.trim(),
      url:              form.url.trim(),
      method:           form.method,
      payload_template: form.payload_obj,
      success_codes:    parseCodes(form.success_codes),
      save_codes:       parseCodes(form.save_codes),
      retry_codes:      parseCodes(form.retry_codes),
    }, isEdit);
    setSaving(false);
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label className="label">API Name *</label>
          <input className="input" placeholder="e.g. pan_comprehensive"
            value={form.name}
            onChange={e => set("name", e.target.value.toLowerCase().replace(/\s/g, "_"))}
            disabled={isEdit} style={{ opacity: isEdit ? 0.6 : 1 }} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3, fontFamily: "var(--font-mono)" }}>No spaces, lowercase</div>
        </div>
        <div>
          <label className="label">Method</label>
          <select className="select" value={form.method} onChange={e => set("method", e.target.value)}>
            <option>POST</option><option>GET</option><option>PUT</option><option>PATCH</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="label">URL *</label>
        <input className="input" placeholder="https://kyc-api.surepass.io/api/v1/pan/pan"
          value={form.url} onChange={e => set("url", e.target.value)} />
      </div>

      {/* Payload Configurator */}
      <div style={{ marginBottom: 14 }}>
        <PayloadConfigurator
          value={form.payload_obj}
          onChange={obj => set("payload_obj", obj)}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label className="label">Success codes</label>
          <input className="input" placeholder="200, 201" value={form.success_codes}
            onChange={e => set("success_codes", e.target.value)} style={{ fontSize: 12 }} />
        </div>
        <div>
          <label className="label">Save codes</label>
          <input className="input" placeholder="200, 201, 422" value={form.save_codes}
            onChange={e => set("save_codes", e.target.value)} style={{ fontSize: 12 }} />
        </div>
        <div>
          <label className="label">Retry codes</label>
          <input className="input" placeholder="500, 502, 503" value={form.retry_codes}
            onChange={e => set("retry_codes", e.target.value)} style={{ fontSize: 12 }} />
        </div>
      </div>

      {/* YAML preview */}
      <div style={{
        background: "var(--bg-terminal)", border: "1px solid var(--border-subtle)",
        borderRadius: 8, padding: "12px 14px", marginBottom: 16,
        fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.9,
      }}>
        <div style={{ color: "var(--text-muted)", marginBottom: 4, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Preview — config.yaml</div>
        <div><span style={{ color: "var(--text-accent)", fontWeight: 700 }}>{form.name || "api_name"}</span><span style={{ color: "var(--text-muted)" }}>:</span></div>
        <div style={{ paddingLeft: 14 }}><span style={{ color: "#60a5fa" }}>url</span><span style={{ color: "var(--text-muted)" }}>: </span><span style={{ color: "#34d399" }}>"{form.url || "…"}"</span></div>
        <div style={{ paddingLeft: 14 }}><span style={{ color: "#60a5fa" }}>method</span><span style={{ color: "var(--text-muted)" }}>: </span><span style={{ color: "#fbbf24" }}>{form.method}</span></div>
        <div style={{ paddingLeft: 14 }}><span style={{ color: "#60a5fa" }}>payload</span><span style={{ color: "var(--text-muted)" }}>: </span><span style={{ color: "#9ca3af" }}>{JSON.stringify(form.payload_obj)}</span></div>
        <div style={{ paddingLeft: 14 }}><span style={{ color: "#60a5fa" }}>save_codes</span><span style={{ color: "var(--text-muted)" }}>: </span><span style={{ color: "#fbbf24" }}>[{form.save_codes}]</span></div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" onClick={handleSave}
          disabled={saving || !form.name.trim() || !form.url.trim()}
          style={{ gap: 6 }}>
          {saving ? <div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} /> : <Icon name="save" size={13} />}
          {isEdit ? "Save Changes" : "Create API"}
        </button>
      </div>
    </>
  );
};

/* ─── API Library Browser ────────────────────────────────────────────────── */
const ApiLibrary = ({ existingApis, onImport }) => {
  const [catFilter,  setCatFilter]  = useState("All");
  const [libSearch,  setLibSearch]  = useState("");

  const categories = ["All", ...API_CATALOGUE.map(c => c.category)];

  const filtered = useMemo(() => {
    return API_CATALOGUE
      .map(cat => ({
        ...cat,
        templates: cat.templates.filter(t => {
          const matchCat  = catFilter === "All" || cat.category === catFilter;
          const matchSearch = !libSearch.trim() || t.name.toLowerCase().includes(libSearch.toLowerCase());
          return matchCat && matchSearch;
        }),
      }))
      .filter(cat => cat.templates.length > 0);
  }, [catFilter, libSearch]);

  const totalCount = API_CATALOGUE.reduce((sum, c) => sum + c.templates.length, 0);

  return (
    <div>
      {/* Search + category filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", display: "flex" }}>
            <Icon name="search" size={12} />
          </span>
          <input className="input" placeholder="Search templates…" value={libSearch}
            onChange={e => setLibSearch(e.target.value)}
            style={{ paddingLeft: 30, fontSize: 12.5, height: 32 }} />
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              style={{
                padding: "3px 10px", borderRadius: 99, fontSize: 11.5, cursor: "pointer",
                fontFamily: "var(--font-mono)",
                border: `1px solid ${catFilter === cat ? "var(--border-accent)" : "var(--border)"}`,
                background: catFilter === cat ? "var(--accent-dim)" : "var(--bg-input)",
                color: catFilter === cat ? "var(--text-accent)" : "var(--text-muted)",
                transition: "all 150ms",
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
        {totalCount} templates · click <strong style={{ color: "var(--text-accent)" }}>Use Template</strong> to open the API form pre-filled
      </div>

      {/* Template groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 420, overflowY: "auto" }}>
        {filtered.map(cat => {
          const colors = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS["PAN"];
          return (
            <div key={cat.category}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: colors.bg, border: `1px solid ${colors.border}`,
                borderRadius: 99, padding: "2px 10px", marginBottom: 8,
                fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: colors.text,
              }}>
                {cat.category}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                {cat.templates.map(tmpl => {
                  const alreadyImported = existingApis[tmpl.id] != null;
                  return (
                    <div key={tmpl.id} style={{
                      background: "var(--bg-elevated)", border: `1px solid ${alreadyImported ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                      borderRadius: 8, padding: "10px 12px",
                      display: "flex", flexDirection: "column", gap: 8,
                      transition: "border-color 150ms ease",
                    }}
                      onMouseEnter={e => { if (!alreadyImported) e.currentTarget.style.borderColor = "var(--border-accent)"; }}
                      onMouseLeave={e => { if (!alreadyImported) e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
                          {tmpl.name}
                        </div>
                        {alreadyImported && (
                          <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--text-success)", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>
                            imported
                          </span>
                        )}
                      </div>
                      {/* Payload fields preview */}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {tmpl.payload.map(f => (
                          <span key={f.key} style={{
                            fontSize: 10, fontFamily: "var(--font-mono)",
                            background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                            borderRadius: 4, padding: "1px 5px", color: "var(--text-muted)",
                          }}>{f.key}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => onImport(tmpl)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          background: alreadyImported ? "var(--bg-input)" : "var(--accent-dim)",
                          border: `1px solid ${alreadyImported ? "var(--border)" : "var(--border-accent)"}`,
                          borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                          fontSize: 11.5, color: alreadyImported ? "var(--text-muted)" : "var(--text-accent)",
                          fontFamily: "var(--font-mono)", transition: "all 150ms",
                        }}>
                        <Icon name={alreadyImported ? "edit" : "zap"} size={11} />
                        {alreadyImported ? "Edit" : "Use Template"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
            No templates match your search.
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Settings ──────────────────────────────────────────────────────── */
export default function Settings() {
  const [config,         setConfig]         = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [toasts,         setToasts]         = useState([]);
  const [newTokenName,   setNewTokenName]   = useState("");
  const [newTokenValue,  setNewTokenValue]  = useState("");
  const [addingToken,    setAddingToken]    = useState(false);
  const [editingToken,   setEditingToken]   = useState(null);
  const [identifierModal,setIdentifierModal]= useState(null);
  const [workflowModal,  setWorkflowModal]  = useState(null);
  const [apiModal,       setApiModal]       = useState(null);
  const [wfSearch,       setWfSearch]       = useState("");
  const [apiSearch,      setApiSearch]      = useState("");

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => {
      setToasts(p => p.map(t => t.id === id ? { ...t, dismissing: true } : t));
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 300);
    }, 3500);
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setConfig(d); setLoading(false); })
      .catch(() => { setConfig({ tokens: {}, workflows: {}, apis: {} }); setLoading(false); });
  }, []);

  /* ── Token handlers ── */
  const handleAddToken = async () => {
    const name = newTokenName.trim(), value = newTokenValue.trim();
    if (!name || !value) { addToast("Both fields required.", "error"); return; }
    setAddingToken(true);
    try {
      const res = await fetch("/api/config/tokens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfig(p => ({ ...p, tokens: { ...(p.tokens || {}), [name]: value } }));
      setNewTokenName(""); setNewTokenValue("");
      addToast(`Token "${name}" saved.`, "success");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
    finally { setAddingToken(false); }
  };

  const handleEditToken = async () => {
    if (!editingToken) return;
    const { name, value } = editingToken;
    if (!value.trim()) { addToast("Value cannot be empty.", "error"); return; }
    try {
      await fetch(`/api/config/tokens/${encodeURIComponent(name)}`, { method: "DELETE" });
      const res = await fetch("/api/config/tokens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfig(p => ({ ...p, tokens: { ...(p.tokens || {}), [name]: value } }));
      setEditingToken(null);
      addToast(`Token "${name}" updated.`, "success");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  };

  const handleDeleteToken = async (name) => {
    if (!confirm(`Delete token "${name}"?`)) return;
    try {
      await fetch(`/api/config/tokens/${encodeURIComponent(name)}`, { method: "DELETE" });
      setConfig(p => { const t = { ...(p.tokens || {}) }; delete t[name]; return { ...p, tokens: t }; });
      addToast(`Token "${name}" deleted.`, "info");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  };

  /* ── Workflow handlers ── */
  const handleSaveWorkflow = async (form, isEdit) => {
    try {
      const res = await fetch("/api/config/workflows", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, label: form.label || form.name, input_field: form.input_field, api: form.api, token: form.token }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfig(p => ({
        ...p,
        workflows: { ...(p.workflows || {}), [form.name]: { label: form.label || form.name, input_field: form.input_field, api: form.api, token: form.token } },
      }));
      setWorkflowModal(null);
      addToast(`Workflow "${form.name}" ${isEdit ? "updated" : "created"}.`, "success");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  };

  const handleDeleteWorkflow = async (name) => {
    if (!confirm(`Delete workflow "${name}"?`)) return;
    try {
      await fetch(`/api/config/workflows/${encodeURIComponent(name)}`, { method: "DELETE" });
      setConfig(p => { const w = { ...(p.workflows || {}) }; delete w[name]; return { ...p, workflows: w }; });
      addToast(`Workflow "${name}" deleted.`, "info");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  };

  const handleDuplicateWorkflow = (name, wf) => {
    setWorkflowModal({ ...wf, name: `${name}_copy`, label: `${wf.label || name} (Copy)` });
    addToast(`Duplicating "${name}" — edit the ID and save.`, "info");
  };

  const handleSaveIdentifier = async (form, isEdit) => {
    try {
      const res = await fetch("/api/config/identifier-patterns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfig(p => ({
        ...p,
        identifier_patterns: {
          ...(p.identifier_patterns || {}),
          [form.name]: { regex: form.regex, hint_words: form.hint_words, maps_to_workflow: form.maps_to_workflow },
        },
      }));
      setIdentifierModal(null);
      addToast(`Identifier "${form.name}" ${isEdit ? "updated" : "created"}.`, "success");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  };

  const handleDeleteIdentifier = async (name) => {
    if (!confirm(`Delete identifier "${name}"?`)) return;
    try {
      await fetch(`/api/config/identifier-patterns/${encodeURIComponent(name)}`, { method: "DELETE" });
      setConfig(p => {
        const next = { ...(p.identifier_patterns || {}) };
        delete next[name];
        return { ...p, identifier_patterns: next };
      });
      addToast(`Identifier "${name}" deleted.`, "info");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  };

  /* ── API handlers ── */
  const handleSaveApi = async (form, isEdit) => {
    try {
      if (isEdit) await fetch(`/api/config/apis/${encodeURIComponent(form.name)}`, { method: "DELETE" });
      const res = await fetch("/api/config/apis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfig(p => ({ ...p, apis: { ...(p.apis || {}), [form.name]: form } }));
      setApiModal(null);
      addToast(`API "${form.name}" ${isEdit ? "updated" : "created"}.`, "success");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  };

  const handleDeleteApi = async (name) => {
    if (!confirm(`Delete API "${name}"?\n\nThis may break workflows that use it.`)) return;
    try {
      await fetch(`/api/config/apis/${encodeURIComponent(name)}`, { method: "DELETE" });
      setConfig(p => { const a = { ...(p.apis || {}) }; delete a[name]; return { ...p, apis: a }; });
      addToast(`API "${name}" deleted.`, "info");
    } catch (err) { addToast(`Failed: ${err.message}`, "error"); }
  };

  /* ── Library import — opens API form pre-filled ── */
  const handleLibraryImport = (tmpl) => {
    const payloadObj = payloadRowsToObject(tmpl.payload);
    const existing   = config?.apis?.[tmpl.id];
    setApiModal({
      name:             tmpl.id,
      url:              existing?.url              || "",
      method:           existing?.method           || "POST",
      payload_template: existing?.payload_template || payloadObj,
      success_codes:    existing?.success_codes    || [200, 201],
      save_codes:       existing?.save_codes       || [200, 201, 422],
      retry_codes:      existing?.retry_codes      || [500, 502, 503],
    });
  };

  const tokens    = config?.tokens    || {};
  const identifierPatterns = config?.identifier_patterns || {};
  const workflows = config?.workflows || {};
  const apis      = config?.apis      || {};
  const identifierTypes = Object.keys(identifierPatterns);

  /* ── Filtered lists ── */
  const filteredWorkflows = Object.entries(workflows).filter(([name, wf]) => {
    if (!wfSearch.trim()) return true;
    const q = wfSearch.toLowerCase();
    return name.toLowerCase().includes(q) || (wf.label || "").toLowerCase().includes(q) || (wf.api || "").toLowerCase().includes(q);
  });

  const filteredApis = Object.entries(apis).filter(([name, ep]) => {
    if (!apiSearch.trim()) return true;
    const q = apiSearch.toLowerCase();
    return name.toLowerCase().includes(q) || (ep.url || "").toLowerCase().includes(q);
  });

  if (loading) return <div className="loading-state"><div className="spinner spinner--lg" />Loading…</div>;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage API tokens, workflows, and endpoint configuration.</p>
      </div>

      <div className="settings-sections">

        {/* ── Tokens ── */}
        <Section icon="key" title="API Tokens" badge={Object.keys(tokens).length} defaultOpen index={0}>
          {Object.keys(tokens).length === 0
            ? <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>No tokens configured.</div>
            : Object.entries(tokens).map(([name, value]) => (
              <TokenRow key={name} name={name} value={value}
                onDelete={handleDeleteToken}
                onEdit={(n) => setEditingToken({ name: n, value: "" })} />
            ))}
          <div className="token-add-form">
            <div style={{ flex: "0 0 150px" }}>
              <input className="input" placeholder="Token name" value={newTokenName}
                onChange={e => setNewTokenName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddToken()} style={{ fontSize: 12.5 }} />
            </div>
            <div style={{ flex: 1 }}>
              <input className="input" placeholder="Token value" type="password" value={newTokenValue}
                onChange={e => setNewTokenValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddToken()} style={{ fontSize: 12.5 }} />
            </div>
            <button className="btn btn--primary" onClick={handleAddToken}
              disabled={addingToken || !newTokenName.trim() || !newTokenValue.trim()}
              style={{ flexShrink: 0, gap: 6, padding: "8px 14px" }}>
              {addingToken ? <div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} /> : <Icon name="plus" size={14} />}
              Add
            </button>
          </div>
        </Section>

        {/* ── API Library ── */}
        <Section icon="library" title="API Library" badge={`${API_CATALOGUE.reduce((s, c) => s + c.templates.length, 0)} templates`} defaultOpen={false} index={1}>
          <ApiLibrary existingApis={apis} onImport={handleLibraryImport} />
        </Section>

        {/* ── Identifier Types ── */}
        <Section icon="list" title="Identifier Types" badge={Object.keys(identifierPatterns).length} defaultOpen={false} index={2}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button className="btn btn--primary btn--sm" onClick={() => setIdentifierModal({})} style={{ gap: 6 }}>
              <Icon name="plus" size={13} />New Identifier
            </button>
          </div>
          {Object.keys(identifierPatterns).length === 0
            ? <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>No identifier types configured.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(identifierPatterns).map(([name, pattern]) => (
                  <IdentifierPatternCard
                    key={name}
                    name={name}
                    pattern={pattern}
                    onEdit={(n, p) => setIdentifierModal({ name: n, ...p })}
                    onDelete={handleDeleteIdentifier}
                  />
                ))}
              </div>
          }
          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
            <span style={{ color: "var(--text-accent)", fontWeight: 600 }}>Why this matters: </span>
            Identifier types define the regex, detection hints, and default workflow mapping used by Upload and validation.
          </div>
        </Section>

        {/* ── Workflows ── */}
        <Section icon="cpu" title="Workflows" badge={Object.keys(workflows).length} defaultOpen={false} index={3}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn--primary btn--sm" onClick={() => setWorkflowModal({})} style={{ gap: 6 }}>
              <Icon name="plus" size={13} />New Workflow
            </button>
            {Object.keys(workflows).length > 3 && (
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", display: "flex" }}>
                  <Icon name="search" size={12} />
                </span>
                <input className="input" placeholder="Search workflows…" value={wfSearch}
                  onChange={e => setWfSearch(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: 12.5, height: 32, width: 220 }} />
              </div>
            )}
          </div>

          {filteredWorkflows.length === 0
            ? <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                {wfSearch ? `No workflows match "${wfSearch}".` : "No workflows. Create one above."}
              </div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredWorkflows.map(([name, wf]) => (
                  <WorkflowCard key={name} name={name} wf={wf}
                    onEdit={(n, w) => setWorkflowModal({ name: n, ...w })}
                    onDelete={handleDeleteWorkflow}
                    onDuplicate={handleDuplicateWorkflow} />
                ))}
              </div>
          }

          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
            <span style={{ color: "var(--text-accent)", fontWeight: 600 }}>Tip: </span>
            The <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>input_field</code> must
            match an identifier pattern in config.yaml. Use the <strong style={{ color: "var(--text-secondary)" }}>duplicate</strong> button to create workflow variants quickly.
          </div>
        </Section>

        {/* ── API Endpoints ── */}
        <Section icon="globe" title="API Endpoints" badge={Object.keys(apis).length} defaultOpen={false} index={4}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--primary btn--sm" onClick={() => setApiModal({})} style={{ gap: 6 }}>
                <Icon name="plus" size={13} />New API Endpoint
              </button>
            </div>
            {Object.keys(apis).length > 3 && (
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", display: "flex" }}>
                  <Icon name="search" size={12} />
                </span>
                <input className="input" placeholder="Search APIs…" value={apiSearch}
                  onChange={e => setApiSearch(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: 12.5, height: 32, width: 220 }} />
              </div>
            )}
          </div>

          {filteredApis.length === 0
            ? <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                {apiSearch ? `No APIs match "${apiSearch}".` : "No API endpoints configured. Use the Library above to import templates."}
              </div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredApis.map(([name, ep]) => (
                  <ApiCard key={name} name={name} ep={ep}
                    onEdit={(n, e) => setApiModal({ name: n, ...e })}
                    onDelete={handleDeleteApi} />
                ))}
              </div>
          }

          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
            <span style={{ color: "var(--text-accent)", fontWeight: 600 }}>Note: </span>
            Use the <strong style={{ color: "var(--text-secondary)" }}>API Library</strong> section above to import pre-built templates — just add the URL and save. Deleting an endpoint will break workflows that reference it.
          </div>
        </Section>

        {/* ── Version card ── */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)", padding: "18px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          animation: "cardIn 280ms var(--ease-out) both", animationDelay: "280ms",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 40,
              background: "linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%)",
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9" />
                <path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" opacity="0.6" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>SureFlow KYC Pipeline</div>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>v2.0 · Batch processing engine</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="badge badge--accent">v2.0</span>
            <span className="badge badge--success"><span className="badge-dot" />Healthy</span>
          </div>
        </div>

      </div>

      {/* ── Edit Token Modal ── */}
      {editingToken && (
        <Modal title={`Edit Token: ${editingToken.name}`} onClose={() => setEditingToken(null)}>
          <div className="form-group">
            <label className="label">Token Name</label>
            <input className="input" value={editingToken.name} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label className="label">New Value</label>
            <input className="input" type="password" placeholder="Enter new token value"
              value={editingToken.value}
              onChange={e => setEditingToken(p => ({ ...p, value: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleEditToken()} autoFocus />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn btn--secondary" onClick={() => setEditingToken(null)}>Cancel</button>
            <button className="btn btn--primary" onClick={handleEditToken} style={{ gap: 6 }}>
              <Icon name="save" size={13} />Save
            </button>
          </div>
        </Modal>
      )}

      {identifierModal !== null && (
        <Modal title={identifierModal.name ? `Edit Identifier: ${identifierModal.name}` : "New Identifier"} onClose={() => setIdentifierModal(null)}>
          <IdentifierPatternForm
            initial={identifierModal.name ? identifierModal : null}
            workflows={workflows}
            onSave={handleSaveIdentifier}
            onClose={() => setIdentifierModal(null)}
          />
        </Modal>
      )}

      {/* ── Workflow Builder Modal ── */}
      {workflowModal !== null && (
        <Modal title={workflowModal.name ? `Edit Workflow: ${workflowModal.name}` : "New Workflow"} onClose={() => setWorkflowModal(null)}>
          <WorkflowForm
            initial={workflowModal.name ? workflowModal : null}
            apis={apis} tokens={tokens}
            identifierTypes={identifierTypes}
            onSave={handleSaveWorkflow}
            onClose={() => setWorkflowModal(null)}
          />
        </Modal>
      )}

      {/* ── API Endpoint Modal (wide for payload configurator) ── */}
      {apiModal !== null && (
        <Modal title={apiModal.name ? `Edit API: ${apiModal.name}` : "New API Endpoint"} onClose={() => setApiModal(null)} wide>
          <ApiForm
            initial={apiModal.name ? apiModal : null}
            onSave={handleSaveApi}
            onClose={() => setApiModal(null)}
          />
        </Modal>
      )}

      <Toast toasts={toasts} />
    </>
  );
}
