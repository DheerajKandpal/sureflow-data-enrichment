/**
 * fix.js — Run with: node fix.js
 * Fixes Results.jsx (blue screen) and History.jsx (card navigation)
 */
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, 'src', 'pages');

// ── Fix Results.jsx ──────────────────────────────────────────────────────────
const resultsPath = path.join(base, 'Results.jsx');
let results = fs.readFileSync(resultsPath, 'utf8');

if (results.includes('Object.keys(d.rows[0])')) {
  console.log('Results.jsx: row normalization already present ✓');
} else {
  // Find and replace the raw setData(d) call with safe normalization
  const before = results.length;
  results = results.replace(
    /\.then\(\(d\) => \{\s*setData\(d\);\s*setLoading\(false\);\s*\}\)/,
    [
      '.then((d) => {',
      '        try {',
      '          const columns = d.columns || (d.rows && d.rows[0] ? Object.keys(d.rows[0]) : []);',
      '          const rows = Array.isArray(d.rows)',
      '            ? d.rows.map((row) => Array.isArray(row) ? row : columns.map((col) => row[col] != null ? String(row[col]) : ""))',
      '            : [];',
      '          setData({ ...d, columns, rows });',
      '        } catch (e) {',
      '          console.error("Results normalization error:", e);',
      '          setData({ columns: [], rows: [], total: 0, filename: (d && d.filename) || "" });',
      '        }',
      '        setLoading(false);',
      '      })',
    ].join('\n')
  );

  if (results.length !== before) {
    fs.writeFileSync(resultsPath, results);
    console.log('Results.jsx: fixed row normalization ✓');
  } else {
    console.log('Results.jsx: WARNING - pattern not found, checking file...');
    const idx = results.indexOf('.then((d) =>');
    if (idx > -1) {
      console.log('Found .then((d) => at char', idx);
      console.log(results.slice(idx, idx + 150));
    }
  }
}

// ── Fix History.jsx card navigation ─────────────────────────────────────────
const historyPath = path.join(base, 'History.jsx');
let history = fs.readFileSync(historyPath, 'utf8');

let historyChanged = false;

if (history.includes('job.job_id || job.id')) {
  console.log('History.jsx: navigation already fixed ✓');
} else {
  history = history
    .replace(
      'navigate(`/results/${job.job_id}`)',
      'navigate(`/results/${job.job_id || job.id}`)'
    )
    .replace(
      'navigate(`/monitor/${job.job_id}`)',
      'navigate(`/monitor/${job.job_id || job.id}`)'
    );
  historyChanged = true;
}

// Also make Results page not crash on empty/null data
if (!history.includes('job.job_id || job.id')) {
  console.log('History.jsx: WARNING - navigation fix may not have applied');
} else {
  if (historyChanged) {
    fs.writeFileSync(historyPath, history);
    console.log('History.jsx: navigation fixed ✓');
  }
}

// ── Fix Monitor.jsx — ensure job status "completed" is handled ───────────────
const monitorPath = path.join(base, 'Monitor.jsx');
let monitor = fs.readFileSync(monitorPath, 'utf8');

if (monitor.includes('"completed", "done"')) {
  console.log('Monitor.jsx: status check already correct ✓');
} else {
  // Make sure both "done" and "completed" trigger the done state
  monitor = monitor.replace(
    'data.status === "done" || data.status === "completed" || data.status === "failed"',
    'data.status === "done" || data.status === "completed" || data.status === "complete" || data.status === "failed"'
  );
  fs.writeFileSync(monitorPath, monitor);
  console.log('Monitor.jsx: status variants fixed ✓');
}

console.log('\nAll fixes applied. Now run: npm run build');