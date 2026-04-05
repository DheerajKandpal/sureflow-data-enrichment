/**
 * fix_download.cjs — node fix_download.cjs
 * Fixes the Download CSV button by fetching job info to get output_csv filename
 */
const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'src', 'pages', 'Results.jsx');
let content = fs.readFileSync(resultsPath, 'utf8');

// ── Fix 1: After loading results data, also fetch job to get output_csv ──────
const oldFetch = `    setLoading(true);
    fetch(\`/api/results/\${job_id}\`)
      .then((r) => {
        if (!r.ok) throw new Error(\`HTTP \${r.status}\`);
        return r.json();
      })`;

const newFetch = `    setLoading(true);
    // Fetch both results data AND job info (for output_csv filename)
    Promise.all([
      fetch(\`/api/results/\${job_id}\`).then((r) => {
        if (!r.ok) throw new Error(\`HTTP \${r.status}\`);
        return r.json();
      }),
      fetch(\`/api/jobs/\${job_id}\`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([d, job]) => {
        // Merge output_csv filename from job into results data
        if (job && job.output_csv && !d.filename) {
          d.filename = job.output_csv;
        }
        return d;
      })`;

if (content.includes(oldFetch)) {
  content = content.replace(oldFetch, newFetch);
  console.log('Fix 1 applied: parallel fetch for job filename ✓');
} else {
  console.log('Fix 1: pattern not found, trying alternate...');
  // Try simpler approach - just patch the download handler
}

// ── Fix 2: Make download handler also try job_id as fallback filename ─────────
const oldDownload = `  const handleDownload = async () => {
    if (!data?.filename || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(\`/api/download/\${data.filename}\`);`;

const newDownload = `  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      // Try data.filename first, fall back to fetching job info
      let filename = data?.filename;
      if (!filename) {
        try {
          const jobRes = await fetch(\`/api/jobs/\${job_id}\`);
          const jobData = await jobRes.json();
          filename = jobData?.output_csv;
          // Update state so future clicks work instantly
          if (filename) setData((prev) => ({ ...prev, filename }));
        } catch (_) {}
      }
      if (!filename) {
        addToast('Output file not found for this job.', 'error');
        setDownloading(false);
        return;
      }
      const res = await fetch(\`/api/download/\${filename}\`);`;

if (content.includes(oldDownload)) {
  content = content.replace(oldDownload, newDownload);
  console.log('Fix 2 applied: download fallback to job.output_csv ✓');
} else {
  console.log('Fix 2: pattern not found - may already be fixed');
}

fs.writeFileSync(resultsPath, content);
console.log('\nDone. Now run: npm run build');
