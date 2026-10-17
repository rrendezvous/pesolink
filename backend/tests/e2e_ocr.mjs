// End-to-end API test: NSRP OCR (objective b, assistive only). Uses the fictional sample form in
// samples/nsrp-ocr with a fresh test-only seeker account (never the seeded demo accounts).
// Checks: the form is located and read, a sideways photo is turned and read, review hints are returned
// as a list (hints only), and a non-form image fills nothing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const BASE = process.env.BASE || 'http://localhost:8001/api';
const SAMPLES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'samples', 'nsrp-ocr');
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
}
async function call(method, p, token, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
async function scan(token, file) {
  const image = `data:image/jpeg;base64,${fs.readFileSync(path.join(SAMPLES, file)).toString('base64')}`;
  const up = await call('POST', '/nsrp/upload', token, { image_base64: image });
  return call('POST', '/nsrp/extract', token, { upload_id: up.data?.upload_id });
}

const email = `ocr.e2e.${Date.now()}@example.com`;
const reg = await call('POST', '/auth/register', null, { email, password: 'Test@123', role: 'job_seeker', profile: { first_name: 'Test', last_name: 'Ocr' } });
const token = reg.data?.token;
check('test-only seeker registered', reg.status === 201 && !!token, JSON.stringify(reg.data));

console.log('Page 1 (typed sample)');
let r = await scan(token, 'nsrp-page-1-sample.jpg');
let d = r.data?.extracted_data || {};
check('page 1 recognised', r.data?.page_type === 'page1', r.data?.page_type);
check('form located on the image', !!r.data?.ocr_regions?.__alignment, JSON.stringify(r.data?.ocr_regions?.__alignment));
check('surname read', d.last_name === 'SANTOS', d.last_name);
check('date of birth read (mm/dd/yyyy on paper)', d.date_of_birth === '2000-05-14', d.date_of_birth);
check('cellphone read', d.nsrp_full_data?.cell_phone_number === '09171234567', d.nsrp_full_data?.cell_phone_number);
check('review hints returned as a list', Array.isArray(r.data?.review_flags), JSON.stringify(r.data?.review_flags));
check('each hint names a field, a label and a reason',
  (r.data?.review_flags || []).every((f) => f.key && f.label && f.reason), JSON.stringify(r.data?.review_flags));
check('no "whole page" hint when the form was located', !(r.data?.review_flags || []).some((f) => f.key === '__page'));

console.log('Page 1 photographed sideways');
r = await scan(token, 'nsrp-page-1-sample-sideways.jpg');
d = r.data?.extracted_data || {};
check('sideways page recognised after turning', r.data?.page_type === 'page1' && r.data?.ocr_regions?.__alignment?.turned > 0,
  JSON.stringify(r.data?.ocr_regions?.__alignment));
check('sideways page: surname read', d.last_name === 'SANTOS', d.last_name);
check('sideways page: date of birth read', d.date_of_birth === '2000-05-14', d.date_of_birth);

console.log('Page 2 (typed sample)');
r = await scan(token, 'nsrp-page-2-sample.jpg');
const full = r.data?.extracted_data?.nsrp_full_data || {};
check('page 2 recognised', r.data?.page_type === 'page2', r.data?.page_type);
check('work rows read from the rows used on paper', full.work_rows?.length === 2 && full.work_rows[0]?.company === 'USTP ICT Office',
  JSON.stringify(full.work_rows));
check('ticked skills read', JSON.stringify(full.other_skills_checked) === JSON.stringify(['Computer Literate', 'Photography']),
  JSON.stringify(full.other_skills_checked));

console.log('Not a form');
r = await scan(token, '../../frontend/assets/images/icon.png');
check('non-form image: nothing filled in', r.data?.success === false && (r.data?.review_flags || []).length === 0,
  JSON.stringify({ success: r.data?.success, status: r.data?.ocr_status }));

console.log('Uploads that are too large get a clear answer (no endless loading)');
const huge = await fetch(`${BASE}/nsrp/upload`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ image_base64: 'A'.repeat(16 * 1024 * 1024) }),
});
const hugeBody = await huge.json().catch(() => ({}));
check('16 MB upload refused with 413 and a message', huge.status === 413 && /too large/i.test(hugeBody.error || ''),
  `${huge.status} ${JSON.stringify(hugeBody)}`);
r = await call('GET', '/job-seeker/profile', token);
check('server still answers after a too-large upload', r.status === 200, String(r.status));

console.log('Reading rules (no image needed)');
const { parseNsrpText } = createRequire(import.meta.url)('../services/nsrpOcr.js');
const rules = (regions) => parseNsrpText('', { __page_type: 'page1', ...regions }).nsrp_full_data;
check('passport expiry in a future year is kept as written', rules({ passport_expiry: '03/15/2031' }).passport_expiry === '03/15/2031');
check('date of birth in the future is not accepted', parseNsrpText('', { __page_type: 'page1', date_of_birth: '03/15/2031' }).date_of_birth === '');
check('date of birth with slashes read as 1/7 is recovered', parseNsrpText('', { __page_type: 'page1', date_of_birth: '127282006' }).date_of_birth === '2006-12-28');
check('"NA" with a stray mark counts as blank', rules({ household_id: '3 NA' }).household_id === '');
check('a real ID number is never taken for NA', rules({ household_id: '1234-5678-9012' }).household_id === '1234-5678-9012');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
