/**
 * patch_backend.cjs — node patch_backend.cjs
 * Adds sample_rows to the /api/upload response
 */
const fs = require('fs');
const path = require('path');

const mainPy = path.join(__dirname, '..', 'server', 'main.py');
let content = fs.readFileSync(mainPy, 'utf8');

if (content.includes('sample_rows')) {
  console.log('Already patched — sample_rows present ✓');
  process.exit(0);
}

// Find the return block in the upload endpoint and add sample_rows
const oldReturn = [
  '    return {',
  '        "filename":   file.filename,',
  '        "rows":       len(df),',
  '        "columns":    columns,',
  '        "detected":   detected,',
  '        "workflows":  workflows,',
  '    }',
].join('\n');

const newReturn = [
  '    sample_rows = df.head(3).fillna("").values.tolist()',
  '    return {',
  '        "filename":   file.filename,',
  '        "rows":       len(df),',
  '        "columns":    columns,',
  '        "detected":   detected,',
  '        "workflows":  workflows,',
  '        "sample_rows": sample_rows,',
  '    }',
].join('\n');

if (content.includes(oldReturn)) {
  content = content.replace(oldReturn, newReturn);
  fs.writeFileSync(mainPy, content);
  console.log('Backend patched — sample_rows added ✓');
} else {
  console.log('Pattern not found. Trying flexible match...');

  // Try to find just the return block by regex
  const match = content.match(/( {4}return \{[^}]+"workflows":\s*workflows,\n {4}\})/);
  if (match) {
    const replacement = '    sample_rows = df.head(3).fillna("").values.tolist()\n' +
      match[1].replace('"workflows":  workflows,', '"workflows":  workflows,\n        "sample_rows": sample_rows,');
    content = content.replace(match[1], replacement);
    fs.writeFileSync(mainPy, content);
    console.log('Backend patched via regex ✓');
  } else {
    console.log('Could not find return block. Please add manually:');
    console.log('');
    console.log('In server/main.py, find the upload return and add:');
    console.log('    sample_rows = df.head(3).fillna("").values.tolist()');
    console.log('    ...and add "sample_rows": sample_rows, to the return dict');
  }
}
