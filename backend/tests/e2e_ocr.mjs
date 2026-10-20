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
check('work rows read from the rows used on paper', full.work_rows?.length === 2 && full.work_rows[0]?.company === 'USTP ICT OFFICE',
  JSON.stringify(full.work_rows));
check('ticked skills read', JSON.stringify(full.other_skills_checked) === JSON.stringify(['Computer Literate', 'Photography']),
  JSON.stringify(full.other_skills_checked));

console.log('Not a form');
r = await scan(token, '../../frontend/assets/images/icon.png');
check('non-form image: nothing filled in', r.data?.success === false && (r.data?.review_flags || []).length === 0,
  JSON.stringify({ success: r.data?.success, status: r.data?.ocr_status }));

console.log('A damaged image gets a clear answer');
{
  const damaged = `data:image/jpeg;base64,${fs.readFileSync(path.join(SAMPLES, 'nsrp-page-1-sample.jpg')).subarray(0, 40000).toString('base64')}`;
  const up = await call('POST', '/nsrp/upload', token, { image_base64: damaged });
  const ex = await call('POST', '/nsrp/extract', token, { upload_id: up.data?.upload_id });
  check('damaged image: "could not be opened", nothing filled in',
    ex.data?.ocr_status === 'unreadable_image' && ex.data?.success === false && /could not be opened/.test(ex.data?.notice || ''),
    JSON.stringify({ status: ex.data?.ocr_status, notice: ex.data?.notice }));
}

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

console.log('Several scans at the same time wait their turn (no failures)');
{
  const four = await Promise.all([0, 1, 2, 3].map(() => scan(token, 'nsrp-page-2-sample.jpg')));
  check('4 simultaneous scans all read page 2', four.every((x) => x.status === 200 && x.data?.page_type === 'page2'),
    JSON.stringify(four.map((x) => [x.status, x.data?.page_type])));
}

console.log('Reading rules (no image needed)');
const { parseNsrpText } = createRequire(import.meta.url)('../services/nsrpOcr.js');
const rules = (regions) => parseNsrpText('', { __page_type: 'page1', ...regions }).nsrp_full_data;
check('passport expiry in a future year is kept as written', rules({ passport_expiry: '03/15/2031' }).passport_expiry === '03/15/2031');
check('date of birth in the future is not accepted', parseNsrpText('', { __page_type: 'page1', date_of_birth: '03/15/2031' }).date_of_birth === '');
check('date of birth with slashes read as 1/7 is recovered', parseNsrpText('', { __page_type: 'page1', date_of_birth: '127282006' }).date_of_birth === '2006-12-28');
check('"NA" with a stray mark counts as blank', rules({ household_id: '3 NA' }).household_id === '');
check('a real ID number is never taken for NA', rules({ household_id: '1234-5678-9012' }).household_id === '1234-5678-9012');
check('a month read above 12 (leading 0 misread) is repaired', parseNsrpText('', { __page_type: 'page1', date_of_birth: '26/23/2003' }).date_of_birth === '2003-06-23');
check('Gmail address: underscore read for a dot is fixed', rules({ email_address: 'juan_cruz@gmail.com' }).email_address === 'juan.cruz@gmail.com');
check('other providers keep underscores and their own names', rules({ email_address: 'juan_cruz@yahoo.com' }).email_address === 'juan_cruz@yahoo.com'
  && rules({ email_address: 'maria@email.com' }).email_address === 'maria@email.com');
check('salary with a space after the comma is joined', rules({ expected_salary: '12, 000 -15,000' }).expected_salary === '12,000 - 15,000');
check('text answers come back in block letters', rules({ house_street: 'Purok 5' }).house_street === 'PUROK 5');
const unsure = { __confidence: { city: 40, language_other_name: 40, barangay: 40 } };
const listedRegions = { __page_type: 'page1', ...unsure, city: 'GINAOOG CY', language_other_name: 'CERVANO', barangay: 'MARKET VILAGE X' };
const listedParsed = parseNsrpText('', listedRegions);
check('an unsure place reading near one official name is corrected', listedParsed.city === 'GINGOOG CITY', listedParsed.city);
check('an unsure language reading near a listed language is corrected', listedParsed.nsrp_full_data.languages?.other?.name === 'CEBUANO');
check('a name not near any listed name is kept as read', listedParsed.nsrp_full_data.barangay === 'MARKET VILAGE X');
const { reviewFlags } = createRequire(import.meta.url)('../services/nsrpOcr.js');
check('every corrected name is flagged for checking', reviewFlags(listedParsed, listedRegions).some((f) => f.key === 'city' && /GINAOOG CY/.test(f.reason)));
const sure = parseNsrpText('', { __page_type: 'page1', __confidence: { barangay: 90 }, barangay: 'BOBUNTUGAN' });
check('a confident reading keeps the spelling written (BOBUNTUGAN)', sure.nsrp_full_data.barangay === 'BOBUNTUGAN');
const page2 = { __page_type: 'page2', __confidence: { tertiary_school: 40, work_1_position: 40, work_1_company: 40 },
  tertiary_school: 'GINGOOG CITY COWEGES', work_1_position: 'ELECTR CIAN', work_1_company: 'JOLLIBEE', work_1_dates: '09/2662 to 06/2026' };
const page2Parsed = parseNsrpText('', page2);
check('an unsure common form word is corrected (COWEGES)', page2Parsed.nsrp_full_data.education.tertiary.school === 'GINGOOG CITY COLLEGES');
check('a word split in two is joined (ELECTR CIAN)', page2Parsed.nsrp_full_data.work_rows[0]?.position === 'ELECTRICIAN');
check('a brand name not near a form word is kept (JOLLIBEE)', page2Parsed.nsrp_full_data.work_rows[0]?.company === 'JOLLIBEE');
const page2Flags = reviewFlags(page2Parsed, page2);
check('corrected words and impossible years are flagged', page2Flags.some((f) => /COWEGES/.test(f.reason))
  && page2Flags.some((f) => /impossible/.test(f.reason)));
check('a zero inside a place name is read as O', rules({ house_street: 'L0T 5' }).house_street === 'LOT 5');
const shortId = parseNsrpText('', { __page_type: 'page1', gsis_sss_no: '08-216453-9' });
check('an ID number with too few digits is flagged', reviewFlags(shortId, { __page_type: 'page1', gsis_sss_no: '08-216453-9' }).some((f) => f.key === 'gsis_sss_no'));

const skipped = { __page_type: 'page2', __confidence: { work_2_company: 40 }, work_2_company: 'JOLIBE', work_2_dates: '01/2020 to 02/2021' };
const skippedFlags = reviewFlags(parseNsrpText('', skipped), skipped).map((f) => f.key);
check('a hint on paper row 2 points to form row 1 when paper row 1 is empty', skippedFlags.includes('work_rows.0.company'), skippedFlags.join(','));

const glued = { __page_type: 'page2', __confidence: { secondary_school: 40, training_1_institution: 40 },
  secondary_school: 'GINGOOG CITYCOMPREHENSIVE', training_1_institution: 'TESDA REGIONX', training_1_certificate: 'NC Li' };
const gluedRows = parseNsrpText('', glued).nsrp_full_data;
check('two listed words read without a space are split', gluedRows.education.secondary.school === 'GINGOOG CITY COMPREHENSIVE');
check('REGION and its roman numeral are split (REGIONX)', gluedRows.training_rows[0]?.institution === 'TESDA REGION X');
check('an NC level with a lowercase letter is read (NC Li -> NC II)', gluedRows.training_rows[0]?.certificate === 'NC II');
check('a street word and its number are split (PUROK5)', rules({ house_street: 'PUROK5' }).house_street === 'PUROK 5');

const marksOnly = { __page_type: 'page1', village: '—', passport_expiry: '1 N4', household_id: "'", landline_number: 'ABCDE' };
const markFlags = reviewFlags(parseNsrpText('', marksOnly), marksOnly).map((f) => f.key);
check('a dash, stray mark or misread NA in an empty box gets no hint', !markFlags.includes('village') && !markFlags.includes('passport_expiry')
  && !markFlags.includes('household_id'), markFlags.join(','));
check('unreadable real writing still gets a hint', markFlags.includes('landline_number'), markFlags.join(','));

console.log('Second reader (PaddleOCR helper; optional)');
const { readBoxes, mergeHelperReadings } = createRequire(import.meta.url)('../services/ocrHelper.js');
const merged = { __confidence: { first_name: 40, surname: 95, household_id: 60, cell_phone_number: 30 },
  first_name: 'KENNEW', surname: 'NA', household_id: '', cell_phone_number: 'Aas 1066 3' };
mergeHelperReadings(merged, ['first_name', 'surname', 'cell_phone_number'], ['KENNETH', 'PACQUIAO', 'O9912870663']);
check('the second reading replaces Tesseract\'s and is marked unsure when they differ', merged.first_name === 'KENNETH' && merged.__confidence.first_name === 50);
check('a box Tesseract read as NA stays NA', merged.surname === 'NA');
check('letters in a digits-only box are read as digits', merged.cell_phone_number === '09912870663');
const shaped = { __confidence: { tertiary_year: 69 }, tertiary_year: '2021' };
mergeHelperReadings(shaped, ['tertiary_year'], ['202']);
check('a year with four digits is kept over a reading that has three', shaped.tertiary_year === '2021' && shaped.__confidence.tertiary_year === 50);
const savedUrl = process.env.OCR_HELPER_URL;
delete process.env.OCR_HELPER_URL;
check('with no helper set, Tesseract readings are kept (no request)', (await readBoxes([Buffer.from('x')])) === null);
process.env.OCR_HELPER_URL = 'http://127.0.0.1:9';
check('with the helper down, Tesseract readings are kept', (await readBoxes([Buffer.from('x')])) === null);
const http = await import('http');
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const { images } = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ texts: images.map((_, i) => `READ ${i}`) }));
  });
});
await new Promise((ok) => fake.listen(0, '127.0.0.1', ok));
process.env.OCR_HELPER_URL = `http://127.0.0.1:${fake.address().port}`;
const fakeTexts = await readBoxes([Buffer.from('a'), Buffer.from('b')]);
check('the helper is asked for all boxes in one request, in order', JSON.stringify(fakeTexts) === '["READ 0","READ 1"]');
fake.close();
if (savedUrl) process.env.OCR_HELPER_URL = savedUrl; else delete process.env.OCR_HELPER_URL;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
