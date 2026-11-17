// Fills the OCR scoring tab (Team Guide 10.4): one row per answer-key field, from the stored extracted values.
// Rules fixed before scoring: Exact = same characters; Normalized = differs only in letter case or extra spaces.
const fs = require('fs'); const path = require('path');
const [BACKEND, S, KEY, ONLY] = process.argv.slice(2);
const { pick } = require(path.join(BACKEND, 'scripts/ocr-accuracy'));
const { normalizeNsrpProfile } = require(path.join(BACKEND, 'services/nsrpForm'));
const rec = {};
for (const l of fs.readFileSync(path.join(S, 'scans.jsonl'), 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); rec[r.id] = r; }
// [form, page, capture no., record] (capture 1 = first capture of the page; HW-08 page 1 has two extra captures)
const CAPTURES = [];
const FIRST = { 'HW-01': [10, 11], 'HW-02': [14, 15], 'HW-03': [12, 13], 'HW-04': [16, 17], 'HW-05': [18, 19], 'HW-06': [20, 21],
  'HW-07': [22, 23], 'HW-08': [24, 27], 'HW-09': [28, 29], 'HW-10': [30, 31], 'HW-11': [32, 33], 'HW-12': [34, 35],
  'HW-13': [36, 37], 'HW-14': [38, 39], 'HW-15': [40, 41], 'HW-16': [42, 43], 'HW-17': [44, 45], 'HW-18': [46, 47] };
for (const [f, [a, b]] of Object.entries(FIRST)) CAPTURES.push([f, '1', 1, a], [f, '2', 1, b]);
CAPTURES.push(['HW-08', '1', 2, 25], ['HW-08', '1', 3, 26]);

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const key = parseCsv(fs.readFileSync(KEY, 'utf8').replace(/^\uFEFF/, '')).slice(1).filter((r) => r.length >= 5)
  .map(([form, page, field, type, answer]) => ({ form, page, field, type, answer }));

// pick() from ocr-accuracy.js has no case for eligibility/license table rows, so read them here.
const get = (parsed, field) => {
  const [kind, n, col] = field.split('.');
  if (kind === 'eligibility') return parsed.nsrp_full_data?.eligibility_rows?.[Number(n)]?.[col];
  if (kind === 'license') return parsed.nsrp_full_data?.license_rows?.[Number(n)]?.[col];
  return pick(parsed, field);
};
const show = (v) => (Array.isArray(v) ? v.filter(Boolean).join('; ') : v == null ? '' : String(v));
// Normalized = same after ignoring letter case and EXTRA spaces (spaces the app added); a missing space stays Wrong.
const loose = (s) => s.replace(/\s+/g, '').toUpperCase();
const onlyExtraSpaces = (got, want) => loose(got) === loose(want) && got.replace(/\S/g, '').length >= want.replace(/\S/g, '').length;
const DIS = { visual: 'visual', hearing: 'hearing', speech: 'speech', physical: 'physical' };

const out = [];
for (const [form, page, cap, id] of CAPTURES) {
  if (ONLY && form !== ONLY) continue;
  const d = rec[id].data;
  if (d.page_type !== `page${page}`) throw new Error(`record ${id} is ${d.page_type}`);
  const parsed = normalizeNsrpProfile(d.parsed); const full = parsed.nsrp_full_data || {};
  for (const k of key.filter((r) => r.form === form && r.page === page)) {
    let type; let stored; let outcome;
    const notScorable = k.type.endsWith(' (not scorable)'); if (notScorable) k.type = k.type.replace(' (not scorable)', '');
    if (k.type === 'checkbox') {
      type = 'checkbox'; let ticked;
      if (k.field.startsWith('lang.')) { const [, lang, box] = k.field.split('.'); ticked = !!full.languages?.[lang]?.[box]; }
      else if (k.field.startsWith('skill.')) { const name = k.field.slice(6).toUpperCase(); ticked = (full.other_skills_checked || []).some((s) => String(s).toUpperCase() === name); }
      else if (k.field.startsWith('disability.')) { ticked = String(full.disability || '').toLowerCase().includes(DIS[k.field.split('.')[1]]); }
      else throw new Error(`unknown checkbox ${k.field}`);
      stored = ticked ? 'ticked' : 'not ticked'; const want = k.answer === 'ticked';
      outcome = ticked === want ? 'Correct' : want ? 'Missed tick' : 'False tick';
    } else if (k.type.startsWith('choice')) {
      type = 'checkbox'; const base = k.field.replace(' (tick the box for)', '');
      stored = show(pick(parsed, base));
      // Expected: one box, nothing ticked (''), or two boxes ticked by the writer ('a; b'); the app keeps one answer per group.
      const want = k.answer.toLowerCase().split(';').map((x) => x.trim()).filter(Boolean); const got = stored.toLowerCase();
      if (want.length === 0) outcome = got === '' ? 'Correct' : 'False tick';
      else if (want.length === 1) outcome = got === want[0] ? 'Correct' : got === '' ? 'Missed tick' : 'False tick';
      else outcome = got === '' || want.includes(got) ? 'Missed tick' : 'False tick';
    } else if (k.type === 'count') {
      type = 'count'; stored = show(get(parsed, k.field)); outcome = stored === k.answer ? 'Exact' : 'Wrong';
    } else {
      stored = show(get(parsed, k.field)); type = k.type;
      if (k.type === 'blank') outcome = stored.trim() === '' ? 'Blank kept' : 'False fill';
      else outcome = stored === k.answer ? 'Exact' : stored.trim() === '' ? 'Missed' : onlyExtraSpaces(stored, k.answer) ? 'Normalized' : 'Wrong';
    }
    if (notScorable) outcome = 'Not scorable';
    out.push([form, page, cap, id, 'genuine handwriting', 'final', k.field, type, k.answer, stored, outcome, '', '', '']);
  }
}
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const header = ['Form', 'Page', 'Capture no.', 'Upload record ID', 'Category', 'Sample use', 'Field', 'Type', 'Answer key', 'Stored extracted value', 'Outcome', 'Error reason', 'Checked by', 'Corrected?'];
const name = ONLY ? `OCR-scoring-${ONLY}.csv` : 'OCR-scoring-tab.csv';
fs.writeFileSync(path.join(S, 'final', name), '\uFEFF' + [header, ...out].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n');
// Summary (capture 1 only, like the OCR results tab)
const c1 = out.filter((r) => r[2] === 1 && r[10] !== 'Not scorable'); const n = (t, o) => c1.filter((r) => r[7] === t && (!o || r[10] === o)).length;
const pct = (a, b) => `${a}/${b} = ${(100 * a / b).toFixed(1)}%`;
console.log(`rows: ${out.length} (capture 1: ${c1.length}; key rows ${ONLY ? key.filter((r) => r.form === ONLY).length : key.length})`);
console.log('Written exact:', pct(n('written', 'Exact'), n('written')), '| exact+normalized:', pct(n('written', 'Exact') + n('written', 'Normalized'), n('written')), '| wrong', n('written', 'Wrong'), '| missed', n('written', 'Missed'));
console.log('Blank kept:', pct(n('blank', 'Blank kept'), n('blank')), '| false fill', n('blank', 'False fill'));
console.log('Checkbox correct:', pct(n('checkbox', 'Correct'), n('checkbox')), '| missed tick', n('checkbox', 'Missed tick'), '| false tick', n('checkbox', 'False tick'));
console.log('Row counts exact (separate):', pct(n('count', 'Exact'), n('count')));
if (ONLY) for (const r of out.filter((r) => !['Exact', 'Blank kept', 'Correct'].includes(r[10]))) console.log(' ', r[10].padEnd(11), r[6].padEnd(44), JSON.stringify(r[8]), '->', JSON.stringify(r[9]));
