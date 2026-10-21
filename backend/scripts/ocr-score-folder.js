'use strict';

// Scores the OCR on a folder of NSRP Form 1 page images whose correct answers are known, in two phases:
//   extract: reads ONLY the page images (opening any *-expected.json is refused) and saves, per page, the
//            raw text of every field box, the extracted values and the alignment details.
//   score:   afterwards, compares the saved extracted values with the answer keys.
// The folder holds manifest.json ([{ person, variant, page1, page2 }]) and <person>-expected.json
// ({ page1: {...}, page2: {...} }, same keys as scripts/ocr-accuracy.js). A field counts as correct only
// when it matches exactly (case and punctuation count; repeated spaces are ignored).
//   node scripts/ocr-score-folder.js <folder> <results-dir> [extract|score|both] [--variant typed] [--limit 5]
const fs = require('fs');
const path = require('path');
const { pick, norm } = require('./ocr-accuracy');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const [dir, outDir, phase = 'both'] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const onlyVariant = opt('--variant');
const limit = Number(opt('--limit')) || Infinity;
if (!dir || !outDir) {
  console.error('Usage: node scripts/ocr-score-folder.js <folder> <results-dir> [extract|score|both]');
  process.exit(1);
}

// Fields read from tick marks, and summary fields the app derives from other fields.
const CHECKBOX_KEYS = new Set([
  'gender', 'civil_status', 'employment_status', 'full.employment_type', 'full.looking_for_work',
  'full.willing_to_work_immediately', 'full.four_ps_beneficiary', 'full.preferred_work_location', 'full.disability',
  'lang.english', 'lang.filipino', 'lang.other', 'skills.checked',
]);
const isDerived = (key) => ['address', 'contact_number', 'preferred_occupation', 'education_level', 'course'].includes(key)
  || key.startsWith('count.');
const isBlank = (v) => (Array.isArray(v) ? v.length === 0 : norm(v) === '');

function category(key, want) {
  if (CHECKBOX_KEYS.has(key)) return 'checkbox';
  if (isDerived(key)) return 'derived';
  return isBlank(want) ? 'blank' : 'text';
}

// Which review-flag keys cover a scoring key (table rows are assumed filled from the first row down).
function flagKeysFor(key) {
  const [kind, a, b] = key.split('.');
  if (kind === 'full') return [a];
  if (kind === 'list') return [`${a}.`];
  if (kind === 'edu') return [`education.${a}.${b === 'year_graduated' ? 'year_graduated' : b}`];
  if (kind === 'training' || kind === 'work') return [`${kind}_rows.paper_row_${Number(a) + 1}.${b}`];
  if (kind === 'lang') return [`languages.${a}`];
  if (key === 'skills.checked') return ['other_skills_checked'];
  if (key === 'full.preferred_work_location') return ['preferred_work_location'];
  return [key];
}

function same(got, want) {
  if (Array.isArray(want)) {
    const list = (got || []).map(norm).filter(Boolean);
    return list.length === want.length && want.every((w) => list.includes(norm(w)));
  }
  return norm(got) === norm(want);
}

const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  .filter((m) => !onlyVariant || m.variant === onlyVariant).slice(0, limit);
const extractDir = path.join(outDir, 'extract');

async function extract() {
  // Guard: the extraction phase must never see an answer key.
  const realRead = fs.readFileSync;
  fs.readFileSync = function guardedRead(file, ...rest) {
    if (/-expected\.json$/i.test(String(file))) throw new Error(`Answer key opened during extraction: ${file}`);
    return realRead.call(fs, file, ...rest);
  };
  const Tesseract = require('tesseract.js');
  const { recognizeNsrpImage, parseNsrpText, reviewFlags } = require('../services/nsrpOcr');
  const { normalizeNsrpProfile } = require('../services/nsrpForm');
  fs.mkdirSync(extractDir, { recursive: true });
  for (const m of manifest) {
    for (const file of [m.page1, m.page2]) {
      const t0 = Date.now();
      const ocr = await recognizeNsrpImage(Tesseract, realRead.call(fs, path.join(dir, file)), {});
      const rawParsed = parseNsrpText(ocr.rawText, ocr.regions);
      const flags = reviewFlags(rawParsed, ocr.regions);
      const parsed = normalizeNsrpProfile(rawParsed);
      const { __checkboxes: boxes, __alignment: alignment, __page_type: pageType, ...regionText } = ocr.regions || {};
      fs.writeFileSync(path.join(extractDir, `${file}.json`), JSON.stringify({
        file, pageType, alignment: alignment || null, seconds: (Date.now() - t0) / 1000,
        regionText, checkboxDensities: boxes?.__densities || {}, rawText: ocr.rawText, parsed, flags,
      }, null, 1));
      console.log(`extracted ${file} (${((Date.now() - t0) / 1000).toFixed(1)} s, ${alignment ? `aligned, ${alignment.matches} labels` : 'NOT aligned'})`);
    }
  }
  fs.readFileSync = realRead;
}

function score() {
  const groups = ['text', 'blank', 'checkbox', 'derived'];
  const table = {}; const byField = {}; const samples = [];
  for (const m of manifest) {
    const expected = JSON.parse(fs.readFileSync(path.join(dir, `${m.person}-expected.json`), 'utf8'));
    const rows = [];
    for (const [file, want] of [[m.page1, expected.page1], [m.page2, expected.page2]]) {
      const saved = JSON.parse(fs.readFileSync(path.join(extractDir, `${file}.json`), 'utf8'));
      const flagKeys = (saved.flags || []).map((f) => f.key);
      const pageFlag = flagKeys.includes('__page');
      for (const [key, w] of Object.entries(want)) {
        const got = pick(saved.parsed, key);
        const ok = same(got, w);
        const flagged = pageFlag || flagKeysFor(key).some((fk) => flagKeys.some((k) => k === fk || (fk.endsWith('.') && k.startsWith(fk))));
        rows.push({ key, cat: category(key, w), want: w, got, flagged, result: ok ? 'ok' : isBlank(got) ? 'missing' : isBlank(w) ? 'made-up' : 'wrong' });
      }
    }
    const t = (table[m.variant] ||= Object.fromEntries(groups.map((g) => [g, { ok: 0, total: 0 }])));
    for (const r of rows) {
      t[r.cat].total += 1; if (r.result === 'ok') t[r.cat].ok += 1;
      const f = (byField[r.key] ||= { ok: 0, total: 0, cat: r.cat });
      f.total += 1; if (r.result === 'ok') f.ok += 1;
    }
    samples.push({ ...m, misses: rows.filter((r) => r.result !== 'ok'), all: rows });
  }
  const pct = (g) => (g.total ? `${g.ok}/${g.total} = ${(100 * g.ok / g.total).toFixed(1)}%` : '-');
  const lines = [`Exact-match results for ${dir}`, '', `| Variant | ${groups.map((g) => ({ text: 'Written text', blank: 'Blank kept blank', checkbox: 'Tick boxes', derived: 'Derived summary' })[g]).join(' | ')} |`, `| --- |${groups.map(() => ' --- |').join('')}`];
  const all = Object.fromEntries(groups.map((g) => [g, { ok: 0, total: 0 }]));
  for (const [variant, t] of Object.entries(table)) {
    lines.push(`| ${variant} | ${groups.map((g) => pct(t[g])).join(' | ')} |`);
    for (const g of groups) { all[g].ok += t[g].ok; all[g].total += t[g].total; }
  }
  lines.push(`| ALL | ${groups.map((g) => pct(all[g])).join(' | ')} |`, '');
  // Review flags (aids only): share of wrong fields that were flagged, and share of flags on correct fields.
  const scored = samples.flatMap((s) => s.all).filter((r) => r.cat !== 'derived');
  const wrong = scored.filter((r) => r.result !== 'ok'); const flaggedRows = scored.filter((r) => r.flagged);
  lines.push(`Review flags: ${wrong.filter((r) => r.flagged).length}/${wrong.length} wrong fields were flagged; `
    + `${flaggedRows.filter((r) => r.result === 'ok').length}/${flaggedRows.length} flags were on fields that were actually correct.`, '', 'Weakest written-text fields:');
  Object.entries(byField).filter(([, f]) => f.cat === 'text').sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total).slice(0, 15)
    .forEach(([k, f]) => lines.push(`  ${String(f.ok).padStart(3)}/${f.total}  ${k}`));
  const report = lines.join('\n');
  console.log(report);
  fs.writeFileSync(path.join(outDir, 'score.md'), `${report}\n`);
  fs.writeFileSync(path.join(outDir, 'score.json'), JSON.stringify({ table, byField, samples: samples.map(({ all: _all, ...rest }) => rest) }, null, 1));
}

(async () => {
  if (phase === 'extract' || phase === 'both') await extract();
  if (phase === 'score' || phase === 'both') score();
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
