import { useEffect, useMemo, useState } from "react";

const Icon = ({ name, size = 16 }) => {
  const paths = {
    play: <polygon points="5 3 19 12 5 21 5 3" />,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    flask: <><path d="M10 2v7.31L4.62 16.5A2 2 0 0 0 6.34 20h11.32a2 2 0 0 0 1.72-3.5L14 9.3V2" /><line x1="8.5" y1="2" x2="15.5" y2="2" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

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
        <button type="button" className="btn btn--secondary" onClick={() => syncRows([...rows, { key: "", value: "", type: "string" }])}>
          <Icon name="plus" size={11} /> Add payload field
        </button>
      </div>
    </div>
  );
};

const QuickAddWorkflow = ({ tokens, identifierTypes, selectedIdentifier, onSaved, onClose }) => {
  const [form, setForm] = useState({
    name: "",
    label: "",
    api_url: "",
    method: "POST",
    token: Object.keys(tokens)[0] || "primary",
    input_field: selectedIdentifier || identifierTypes[0] || "",
    payload_obj: { id_number: "{input}" },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.api_url.trim() || !form.input_field.trim()) {
      setError("Name, API URL, and identifier group are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const apiName = form.name.trim().toLowerCase().replace(/\s/g, "_") + "_api";
      const apiRes = await fetch("/api/config/apis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: apiName,
          url: form.api_url.trim(),
          method: form.method,
          payload_template: form.payload_obj,
          success_codes: [200, 201],
          save_codes: [200, 201, 422],
          retry_codes: [500, 502, 503],
        }),
      });
      if (!apiRes.ok) throw new Error(`API save failed: ${apiRes.status}`);

      const wfName = form.name.trim().toLowerCase().replace(/\s/g, "_");
      const wfRes = await fetch("/api/config/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wfName,
          label: form.label || form.name,
          input_field: form.input_field,
          api: apiName,
          token: form.token,
        }),
      });
      if (!wfRes.ok) throw new Error(`Workflow save failed: ${wfRes.status}`);
      onSaved(wfName, {
        label: form.label || form.name,
        input_field: form.input_field,
        api: apiName,
        token: form.token,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 12, border: "1px solid var(--border-accent)", background: "var(--bg-elevated)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Add subcategory workflow</div>
      <input className="input" value={form.name} onChange={e => set("name", e.target.value.toLowerCase().replace(/\s/g, "_"))} placeholder="workflow id" />
      <input className="input" value={form.label} onChange={e => set("label", e.target.value)} placeholder="display label" />
      <select className="select" value={form.method} onChange={e => set("method", e.target.value)}>
        <option value="POST">POST</option>
        <option value="GET">GET</option>
        <option value="PUT">PUT</option>
        <option value="PATCH">PATCH</option>
      </select>
      <select className="select" value={form.input_field} onChange={e => set("input_field", e.target.value)}>
        {identifierTypes.map(type => <option key={type} value={type}>{type}</option>)}
      </select>
      <input className="input" value={form.api_url} onChange={e => set("api_url", e.target.value)} placeholder="https://..." />
      <PayloadConfigurator value={form.payload_obj} onChange={obj => set("payload_obj", obj)} />
      <select className="select" value={form.token} onChange={e => set("token", e.target.value)}>
        {Object.keys(tokens).length === 0 ? <option value="primary">primary</option> : Object.keys(tokens).map(token => <option key={token} value={token}>{token}</option>)}
      </select>
      {error && <div style={{ color: "var(--text-error)", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save & Use"}</button>
      </div>
    </div>
  );
};

export default function ManualLab() {
  const savedPrefs = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sureflow-manual-lab") || "{}");
    } catch {
      return {};
    }
  }, []);
  const [config, setConfig] = useState({ workflows: {}, tokens: {} });
  const [workflowFamilies, setWorkflowFamilies] = useState([]);
  const [identifierType, setIdentifierType] = useState(savedPrefs.identifierType || "");
  const [workflow, setWorkflow] = useState(savedPrefs.workflow || "");
  const [values, setValues] = useState("");
  const [outputFormat, setOutputFormat] = useState(savedPrefs.outputFormat || "json");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(cfg => {
        setConfig(cfg);
        const groups = Object.entries(cfg.workflows || {}).reduce((acc, [name, wf]) => {
          const key = wf.input_field || "uncategorized";
          if (!acc[key]) acc[key] = [];
          acc[key].push({ name, ...wf });
          return acc;
        }, {});
        const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
        setWorkflowFamilies(entries);
        if (entries.length > 0 && !savedPrefs.identifierType) {
          setIdentifierType(entries[0][0]);
          setWorkflow(entries[0][1][0]?.name || "");
        }
      })
      .catch(() => setError("Could not load workflows."));
  }, [savedPrefs.identifierType]);

  const workflows = useMemo(
    () => workflowFamilies.find(([group]) => group === identifierType)?.[1] || [],
    [workflowFamilies, identifierType],
  );

  useEffect(() => {
    if (workflows.length > 0 && !workflows.some(w => w.name === workflow)) {
      setWorkflow(workflows[0].name);
    }
  }, [workflows, workflow]);

  useEffect(() => {
    localStorage.setItem("sureflow-manual-lab", JSON.stringify({
      identifierType,
      workflow,
      outputFormat,
    }));
  }, [identifierType, workflow, outputFormat]);

  const handleRun = async () => {
    const parsedValues = values.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean);
    if (!workflow || parsedValues.length === 0) {
      setError("Choose a workflow and enter at least one value.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/manual-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_name: workflow,
          values: parsedValues,
          output_format: outputFormat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err.message || "Manual run failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = outputFormat === "csv" ? result.csv : JSON.stringify(result.results, null, 2);
    await navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow}_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWorkflowCreated = (wfName, workflowConfig) => {
    const nextConfig = {
      ...config,
      workflows: {
        ...(config.workflows || {}),
        [wfName]: workflowConfig,
      },
    };
    setConfig(nextConfig);
    const groups = Object.entries(nextConfig.workflows || {}).reduce((acc, [name, wf]) => {
      const key = wf.input_field || "uncategorized";
      if (!acc[key]) acc[key] = [];
      acc[key].push({ name, ...wf });
      return acc;
    }, {});
    const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    setWorkflowFamilies(entries);
    setIdentifierType(workflowConfig.input_field);
    setWorkflow(wfName);
    setShowQuickAdd(false);
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Manual Lab</h1>
        <p className="page-subtitle">Run one or a few identifiers manually and inspect JSON or CSV output before a full batch.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
        <div className="workflow-panel">
          <div className="workflow-panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="flask" size={15} />
            Single or Sample Batch Run
          </div>

          <div className="form-group">
            <label className="label">Identifier group</label>
            <select className="select" value={identifierType} onChange={e => setIdentifierType(e.target.value)}>
              {workflowFamilies.map(([group]) => <option key={group} value={group}>{group}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Subcategory workflow</label>
            <select className="select" value={workflow} onChange={e => setWorkflow(e.target.value)}>
              {workflows.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
            <div style={{ marginTop: 8 }}>
              <button className="btn btn--secondary" onClick={() => setShowQuickAdd(p => !p)}>
                <Icon name="plus" size={13} /> Add new subcategory
              </button>
            </div>
            {showQuickAdd && (
              <QuickAddWorkflow
                tokens={config.tokens || {}}
                identifierTypes={workflowFamilies.map(([group]) => group)}
                selectedIdentifier={identifierType}
                onSaved={handleWorkflowCreated}
                onClose={() => setShowQuickAdd(false)}
              />
            )}
          </div>

          <div className="form-group">
            <label className="label">Values</label>
            <textarea
              className="input"
              value={values}
              onChange={e => setValues(e.target.value)}
              rows={10}
              placeholder={"Paste one value per line\nExample:\nAABCS1234A\n00012345"}
              style={{ resize: "vertical", minHeight: 220, fontFamily: "var(--font-mono)" }}
            />
          </div>

          <div className="form-group">
            <label className="label">Output</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["json", "csv"].map(format => (
                <button
                  key={format}
                  className="btn btn--secondary"
                  onClick={() => setOutputFormat(format)}
                  style={{
                    borderColor: outputFormat === format ? "var(--border-accent)" : undefined,
                    color: outputFormat === format ? "var(--text-accent)" : undefined,
                  }}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {error && <div style={{ color: "var(--text-error)", fontSize: 12 }}>{error}</div>}

          <button className="btn btn--primary-lg" onClick={handleRun} disabled={loading}>
            {loading ? "Running..." : <><Icon name="play" size={14} /> Run sample</>}
          </button>
        </div>

        <div className="workflow-panel">
          <div className="workflow-panel-title">Output Preview</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button className="btn btn--secondary" onClick={handleCopy} disabled={!result}>
              <Icon name="copy" size={13} /> Copy
            </button>
            <button className="btn btn--secondary" onClick={handleDownload} disabled={!result?.csv}>
              <Icon name="download" size={13} /> Download CSV
            </button>
          </div>
          <pre style={{
            margin: 0,
            minHeight: 420,
            overflow: "auto",
            padding: 14,
            borderRadius: 10,
            background: "var(--bg-terminal)",
            border: "1px solid var(--border-subtle)",
            fontSize: 11.5,
            lineHeight: 1.6,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {result
              ? (outputFormat === "csv" ? result.csv : JSON.stringify(result.results, null, 2))
              : "Run a sample to preview the output here."}
          </pre>
        </div>
      </div>

      {workflowFamilies.length > 0 && (
        <div style={{ marginTop: 20 }} className="workflow-panel">
          <div className="workflow-panel-title">Subcategory Catalog</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workflowFamilies.map(([group, items]) => (
              <div key={group}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>{group}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {items.map(item => (
                    <span key={item.name} style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", padding: "4px 8px", borderRadius: 6, background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
