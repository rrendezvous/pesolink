// Writes a corrected copy of the answer key (the original is never changed) and a list of changed key rows.
const fs = require('fs');
const [KEY, CORR, OUT, LIST] = process.argv.slice(2);
const parse = (t) => { const rows = []; let row = []; let c = ''; let q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(c); c = ''; }
    else if (ch === '\n') { row.push(c.replace(/\r$/, '')); rows.push(row); row = []; c = ''; } else c += ch; }
  if (c || row.length) { row.push(c); rows.push(row); } return rows; };
const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const [head, ...rows] = parse(fs.readFileSync(KEY, 'utf8').replace(/^\uFEFF/, '')).filter((r) => r.length >= 5);
const log = [['Form', 'Page', 'Field', 'Original key', 'Corrected key', 'Change']];
for (const [form, page, field, value] of JSON.parse(fs.readFileSync(CORR, 'utf8')).changes) {
  let r = rows.find((x) => x[0] === form && x[1] === page && x[2] === field);
  const old = r ? r[4] : '(no row)';
  if (!r) { // a new row in the key (e.g. a table row the writer added); insert after the last row of that form and page
    const last = rows.map((x, i) => (x[0] === form && x[1] === page ? i : -1)).filter((i) => i >= 0).pop();
    r = [form, page, field, '', '']; rows.splice(last + 1, 0, r);
  }
  if (value === 'NOT_SCORABLE') r[3] = `${r[3].replace(/ \(not scorable\)$/, '')} (not scorable)`;
  else {
    r[4] = value;
    if (r[3] === 'written' || r[3] === 'blank' || r[3] === '') r[3] = value === '' ? 'blank' : 'written';
  }
  if (value !== "NOT_SCORABLE" && old === value) continue; // a shifted table row can keep the same value
  log.push([form, page, field, old, value === 'NOT_SCORABLE' ? '(not scorable)' : value || '(blank)', value === 'NOT_SCORABLE' ? 'excluded' : old === '(no row)' ? 'row added' : 'value changed']);
}
fs.writeFileSync(OUT, '\uFEFF' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n');
fs.writeFileSync(LIST, '\uFEFF' + log.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n');
const c = (k) => log.slice(1).filter((r) => r[5] === k).length;
console.log(`key rows: ${rows.length}; changed: ${c('value changed')}, added: ${c('row added')}, excluded: ${c('excluded')}`);
