// End-to-end checks: NSRP answers saved in block letters (NSRP Form 1 instruction; to be confirmed with PESO).
// Run against a freshly reset demo/test database (npm run test:e2e does this).
// To test the first save of records verified BEFORE this change, a profile is put back into its old form
// (mixed-case answers, verified under the old version-2 fingerprint) directly in the reset database.
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
require('dotenv').config({ path: path.join(backendDir, '.env') });
const mysql = require('mysql2/promise');
const { nsrpFingerprint } = require('../services/nsrpReview');

const BASE = process.env.BASE || 'http://localhost:8001/api';
const DB_NAME = process.env.DEMO_DB || 'peso_link_demo';
if (DB_NAME === 'peso_link_misor') {
  console.error('Refusing to run on the real database (peso_link_misor).');
  process.exit(1);
}
let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); }
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
const login = async (email, password, role) => (await call('POST', '/auth/login', null, { email, password, role })).data.token;
const full = (p) => (typeof p.nsrp_full_data === 'string' ? JSON.parse(p.nsrp_full_data) : (p.nsrp_full_data || {}));

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: DB_NAME,
  dateStrings: ['DATE'], // same as the server's pool (db.js), so fingerprints are computed the same way
});
const seekerId = async (email) => (await conn.query(
  'SELECT js.id FROM job_seekers js JOIN users u ON u.id = js.user_id WHERE u.email = ?', [email]))[0][0].id;

// Put a verified profile back into its pre-change form: mixed-case answers + an old fingerprint (version 2 or 1).
async function makeLegacyVerified(email, version = 2) {
  const id = await seekerId(email);
  const [[row]] = await conn.query('SELECT * FROM job_seekers WHERE id = ?', [id]);
  const f = typeof row.nsrp_full_data === 'string' ? JSON.parse(row.nsrp_full_data) : (row.nsrp_full_data || {});
  const title = (s) => String(s || '').toLowerCase().replace(/(^|[\s,.(/-])([a-zñ])/g, (m, a, b) => a + b.toUpperCase());
  f.religion = title(f.religion);
  f.place_of_birth = title(f.place_of_birth);
  f.height = '157 cm';
  if (f.education?.secondary?.school) f.education.secondary.school = title(f.education.secondary.school);
  await conn.query(
    "UPDATE job_seekers SET first_name = ?, last_name = ?, city = ?, nsrp_full_data = ?, nsrp_status = 'verified' WHERE id = ?",
    [title(row.first_name), title(row.last_name), title(row.city), JSON.stringify(f), id],
  );
  const oldHash = await nsrpFingerprint(conn, id, version);
  await conn.query('UPDATE job_seekers SET nsrp_reviewed_hash = ? WHERE id = ?', [oldHash, id]);
  const [[legacy]] = await conn.query('SELECT first_name, city, nsrp_reviewed_hash FROM job_seekers WHERE id = ?', [id]);
  return { id, legacy };
}
const storedHash = async (id) => (await conn.query('SELECT nsrp_reviewed_hash FROM job_seekers WHERE id = ?', [id]))[0][0].nsrp_reviewed_hash;

// What the app's profile form sends: the saved profile as loaded, with any changes.
async function saveAsLoaded(token, changes = {}, fullChanges = {}) {
  const { profile } = (await call('GET', '/job-seeker/profile', token)).data;
  return call('POST', '/job-seeker/profile', token, {
    ...profile, years_of_experience: String(profile.years_of_experience), ...changes,
    nsrp_full_data: { ...full(profile), ...fullChanges },
  });
}

const maria = await login('maria.santos@example.com', 'Test@123', 'job_seeker');
const ana = await login('ana.bautista@example.com', 'Test@123', 'job_seeker');

console.log('Registration names');
{
  const email = `caps.${Date.now()}@example.com`;
  const r = await call('POST', '/auth/register', null, { email, password: 'Test@123', role: 'job_seeker', profile: { first_name: 'José Niño', last_name: 'dela Peña', contact_number: '09170000009' } });
  const t = r.data?.token;
  const p = (await call('GET', '/job-seeker/profile', t)).data.profile;
  check('registration names saved in capitals, Ñ and accents kept', p.first_name === 'JOSÉ NIÑO' && p.last_name === 'DELA PEÑA', `${p.first_name} ${p.last_name}`);
  check('registration email kept as typed (sign-in with it works)', r.status === 201 && !!(await login(email, 'Test@123', 'job_seeker')));
}

console.log('Only the listed NSRP answers are capitalized');
{
  const r = await saveAsLoaded(maria, { middle_name: 'lópez' }, {
    religion: 'iglesia ni cristo', height: '157 cm', email_address: 'maria.santos@example.com',
    other_skills_other: 'Pagluto ng kakanin',
    work_rows: [{ company: 'Macabalan Trading', address: 'Cagayan de Oro City', position: 'Office Assistant', dates: '07/2021 to present', status: 'Part-time' }],
  });
  const p = r.data.profile;
  const f = full(p);
  check('converted: names, religion, work company/address/position, Section VIII "Others"',
    p.middle_name === 'LÓPEZ' && f.religion === 'IGLESIA NI CRISTO' && f.work_rows[0].company === 'MACABALAN TRADING'
    && f.work_rows[0].address === 'CAGAYAN DE ORO CITY' && f.work_rows[0].position === 'OFFICE ASSISTANT' && f.other_skills_other === 'PAGLUTO NG KAKANIN',
    JSON.stringify({ m: p.middle_name, r: f.religion, w: f.work_rows?.[0], o: f.other_skills_other }));
  check('kept as typed: height, email, work dates and status',
    f.height === '157 cm' && f.email_address === 'maria.santos@example.com' && f.work_rows[0].dates === '07/2021 to present' && f.work_rows[0].status === 'Part-time');
  check('a real change still sends the verified profile back to PESO', r.data.nsrp_status_changed_to === 'submitted', JSON.stringify(r.data.nsrp_status_changed_to));
}

console.log('(a) First save of a profile verified before the change: case only -> stays PESO-Verified');
{
  const { id, legacy } = await makeLegacyVerified('ana.bautista@example.com');
  check('legacy record prepared (mixed case, old fingerprint)', legacy.first_name === 'Ana' && legacy.city === 'Tagoloan');
  const r = await saveAsLoaded(ana);
  check('(a) profile save, case-only: stays PESO-Verified', r.status === 200 && !r.data.nsrp_status_changed_to && r.data.profile.nsrp_status === 'verified', JSON.stringify({ c: r.data.nsrp_status_changed_to, s: r.data.profile?.nsrp_status }));
  check('(a) saved in capitals on that save', r.data.profile.first_name === 'ANA' && full(r.data.profile).religion === String(full(r.data.profile).religion).toUpperCase());
  check('(a) stored fingerprint upgraded to the new format', (await storedHash(id)) !== legacy.nsrp_reviewed_hash && (await storedHash(id)) === await nsrpFingerprint(conn, id, 3));
  const again = await saveAsLoaded(ana);
  check('(a) next unchanged save: still PESO-Verified', !again.data.nsrp_status_changed_to && again.data.profile.nsrp_status === 'verified');
}
{
  const { id } = await makeLegacyVerified('ana.bautista@example.com');
  const { profile } = (await call('GET', '/job-seeker/profile', ana)).data;
  const r = await call('POST', '/nsrp/confirm', ana, {
    confirmed_data: { first_name: 'ana', last_name: 'bautista', city: String(profile.city).toLowerCase(), nsrp_full_data: { religion: String(full(profile).religion).toLowerCase() } },
  });
  check('(a) OCR confirm, case-only: stays PESO-Verified', r.status === 200 && !r.data.nsrp_status_changed_to, JSON.stringify(r.data));
  const p = (await call('GET', '/job-seeker/profile', ana)).data.profile;
  check('(a) OCR confirm saved in capitals', p.first_name === 'ANA' && p.last_name === 'BAUTISTA' && p.nsrp_status === 'verified');
  check('(a) OCR confirm upgraded the stored fingerprint', (await storedHash(id)) === await nsrpFingerprint(conn, id, 3));
}

console.log('(b) A real change still sends a legacy verified profile back to PESO');
{
  await makeLegacyVerified('ana.bautista@example.com');
  const r = await saveAsLoaded(ana, {}, { religion: 'Seventh-day Adventist' });
  check('(b) real field change: back to PESO (Submitted)', r.data.nsrp_status_changed_to === 'submitted', JSON.stringify(r.data.nsrp_status_changed_to));
}
{
  await makeLegacyVerified('ana.bautista@example.com');
  const r = await saveAsLoaded(ana, {}, { height: '157 CM' });
  check('(b) letter-case change in a field kept as typed (height) is a real change', r.data.nsrp_status_changed_to === 'submitted', JSON.stringify(r.data.nsrp_status_changed_to));
}
{
  const { id } = await makeLegacyVerified('ana.bautista@example.com');
  const skills = (await call('GET', '/job-seeker/profile', ana)).data.skills;
  const r = await call('POST', '/job-seeker/skills', ana, { skills: skills.slice(1).map((s) => ({ skill_id: s.id, proficiency_level: s.proficiency_level })) });
  check('(b) skill change: back to PESO (Submitted)', r.data.nsrp_status_changed_to === 'submitted', JSON.stringify(r.data.nsrp_status_changed_to));
  check('(b) fingerprint not upgraded on a real change', (await storedHash(id)) !== await nsrpFingerprint(conn, id, 3));
}
{
  // A legacy profile saved with no change at all through the skills path (no snapshot): unchanged, stays verified.
  const { id } = await makeLegacyVerified('ana.bautista@example.com');
  const skills = (await call('GET', '/job-seeker/profile', ana)).data.skills;
  const r = await call('POST', '/job-seeker/skills', ana, { skills: skills.map((s) => ({ skill_id: s.id, proficiency_level: s.proficiency_level })) });
  check('unchanged skills save on a legacy profile: stays PESO-Verified', !r.data.nsrp_status_changed_to, JSON.stringify(r.data.nsrp_status_changed_to));
  check('...and its fingerprint is upgraded', (await storedHash(id)) === await nsrpFingerprint(conn, id, 3));
}

console.log('Profiles verified under the original (version-1) fingerprint');
{
  const { id, legacy } = await makeLegacyVerified('ana.bautista@example.com', 1);
  check('v1 legacy record prepared (hash is v1, not v2)',
    legacy.nsrp_reviewed_hash === await nsrpFingerprint(conn, id, 1) && legacy.nsrp_reviewed_hash !== await nsrpFingerprint(conn, id, 2));
  const r = await saveAsLoaded(ana);
  check('(a) v1, profile save, case-only: stays PESO-Verified', r.status === 200 && !r.data.nsrp_status_changed_to && r.data.profile.nsrp_status === 'verified', JSON.stringify(r.data.nsrp_status_changed_to));
  check('(a) v1, profile save: saved in capitals and hash upgraded to v3',
    r.data.profile.first_name === 'ANA' && (await storedHash(id)) === await nsrpFingerprint(conn, id, 3));
}
{
  const { id } = await makeLegacyVerified('ana.bautista@example.com', 1);
  const { profile } = (await call('GET', '/job-seeker/profile', ana)).data;
  const r = await call('POST', '/nsrp/confirm', ana, {
    confirmed_data: { first_name: 'ana', last_name: 'bautista', city: String(profile.city).toLowerCase(), nsrp_full_data: { religion: String(full(profile).religion).toLowerCase() } },
  });
  const p = (await call('GET', '/job-seeker/profile', ana)).data.profile;
  check('(a) v1, OCR confirm, case-only: stays PESO-Verified', r.status === 200 && !r.data.nsrp_status_changed_to && p.nsrp_status === 'verified', JSON.stringify(r.data));
  check('(a) v1, OCR confirm: saved in capitals and hash upgraded to v3',
    p.first_name === 'ANA' && p.last_name === 'BAUTISTA' && (await storedHash(id)) === await nsrpFingerprint(conn, id, 3));
}
{
  const { id } = await makeLegacyVerified('ana.bautista@example.com', 1);
  const r = await saveAsLoaded(ana, {}, { religion: 'Born Again Christian' });
  check('(b) v1, real field change: back to PESO (Submitted)', r.data.nsrp_status_changed_to === 'submitted', JSON.stringify(r.data.nsrp_status_changed_to));
  check('(b) v1, real field change: hash not upgraded', (await storedHash(id)) !== await nsrpFingerprint(conn, id, 3));
}
{
  const { id } = await makeLegacyVerified('ana.bautista@example.com', 1);
  const r = await call('POST', '/nsrp/confirm', ana, { confirmed_data: { first_name: 'ana', nsrp_full_data: { religion: 'Muslim' } } });
  check('(b) v1, OCR confirm with a real change: back to PESO (Submitted)', r.data.nsrp_status_changed_to === 'submitted', JSON.stringify(r.data));
  check('(b) v1, OCR confirm real change: hash not upgraded', (await storedHash(id)) !== await nsrpFingerprint(conn, id, 3));
}

await conn.end();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
