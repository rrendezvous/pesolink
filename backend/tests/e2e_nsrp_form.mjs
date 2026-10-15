// End-to-end API test: NSRP Form 1 structure (objective b) - structured rows, derived summaries,
// Live-in civil status, certification, PESO assessment. Run against a freshly seeded demo DB.
const BASE = process.env.BASE || 'http://localhost:8001/api';
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
}
async function call(method, path, token, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

// PESO decides on the profile it opened: read the review token the admin screen gets, then send it back.
async function decide(adminToken, seekerId, body) {
  const opened = await call('GET', `/admin/job-seekers/${seekerId}/profile`, adminToken);
  return call('PUT', `/admin/job-seekers/${seekerId}/nsrp-status`, adminToken, { ...body, review_token: opened.data?.review_token });
}
async function login(email, password, role) {
  const r = await call('POST', '/auth/login', null, { email, password, role });
  if (r.status !== 200) throw new Error(`login ${email} ${r.status}`);
  return r.data.token;
}
const full = (p) => (typeof p.nsrp_full_data === 'string' ? JSON.parse(p.nsrp_full_data) : p.nsrp_full_data || {});

const admin = await login('admin@peso.gov.ph', 'Admin@123', 'admin');
const ana = await login('ana.bautista@example.com', 'Test@123', 'job_seeker');
const pedro = await login('pedro.reyes@example.com', 'Test@123', 'job_seeker');

console.log('Seeded profiles carry the form structure and derived summaries');
let p = (await call('GET', '/job-seeker/profile', ana)).data;
check('Ana education table present', full(p.profile).education?.secondary?.school === 'TAGOLOAN NATIONAL HIGH SCHOOL');
check('summary filled from table', /TAGOLOAN NATIONAL HIGH SCHOOL/.test(full(p.profile).secondary_background || ''));
check('address built from House No./Street + Barangay', p.profile.address === 'PUROK 1, POBLACION', p.profile.address);
check('education level derived (highest level)', /Secondary/.test(p.profile.education_level || ''), p.profile.education_level);
check('19/19 required items', p.referral_requirements.isComplete === true, JSON.stringify(p.referral_requirements.missing_fields));

console.log('Saving structured rows');
const anaProfile = p.profile;
const body = {
  ...anaProfile,
  date_of_birth: anaProfile.date_of_birth,
  nsrp_full_data: {
    ...full(anaProfile),
    education: { ...full(anaProfile).education, tertiary: { school: 'USTP', course: 'BS Hospitality Management', level_reached: '2nd year', year_last_attended: '2022' } },
    training_rows: [
      { course: 'Cookery', duration: '2019', institution: 'TESDA', certificate: 'Certificate' },
      { course: 'Bread and Pastry', duration: '2020', institution: 'TESDA', certificate: 'NC II' },
    ],
  },
};
let r = await call('POST', '/job-seeker/profile', ana, body);
check('save 200', r.status === 200, JSON.stringify(r.data));
check('tertiary summary derived', /USTP, BS HOSPITALITY MANAGEMENT/.test(full(r.data.profile).tertiary_background || ''), full(r.data.profile).tertiary_background);
check('undergraduate highest level', r.data.profile.education_level === 'Tertiary (undergraduate)' && r.data.profile.course === 'BS HOSPITALITY MANAGEMENT', `${r.data.profile.education_level} / ${r.data.profile.course}`);
check('changing education sends verified profile back to PESO', r.data.nsrp_status_changed_to === 'submitted');
const trainings = full(r.data.profile).trainings || '';
check('training summary does not repeat "Certificate"', !/Certificate: Certificate/.test(trainings) && /TESDA, Certificate/.test(trainings), trainings);
check('training summary labels other certificates', /Certificate: NC II/.test(trainings), trainings);

console.log('Live-in civil status (NSRP Form 1 option)');
p = (await call('GET', '/job-seeker/profile', pedro)).data.profile;
r = await call('POST', '/job-seeker/profile', pedro, { ...p, civil_status: 'live-in', nsrp_full_data: full(p) });
check('live-in saves', r.status === 200 && r.data.profile.civil_status === 'live-in', JSON.stringify(r.data?.profile?.civil_status));

console.log('Certification and PESO assessment');
check('submit without certification refused', (await call('POST', '/job-seeker/profile/submit-nsrp', pedro, {})).data?.code === 'CERTIFICATION_REQUIRED');
check('submit with certification', (await call('POST', '/job-seeker/profile/submit-nsrp', pedro, { certified: true })).status === 200);
const seekers = (await call('GET', '/admin/job-seekers', admin)).data.job_seekers;
const pedroId = seekers.find((s) => s.email === 'pedro.reyes@example.com').id;
r = await decide(admin, pedroId, {
  nsrp_status: 'verified', peso_assessment: { programs: ['TUPAD', 'JobStart', 'Bogus'], other: 'Livelihood' },
});
check('verify with assessment 200', r.status === 200, JSON.stringify(r.data));
p = (await call('GET', `/admin/job-seekers/${pedroId}/profile`, admin)).data.profile;
check('certification time recorded', !!p.nsrp_certified_at);
check('assessment saved (unknown programs dropped)', JSON.stringify(p.peso_assessment?.programs) === '["TUPAD","JobStart"]' && p.peso_assessment?.other === 'Livelihood' && p.peso_assessment?.assessed_by === 'admin@peso.gov.ph', JSON.stringify(p.peso_assessment));

console.log('OCR confirm merges instead of overwriting');
const anaBefore = (await call('GET', '/job-seeker/profile', ana)).data.profile;
r = await call('POST', '/nsrp/confirm', ana, {
  confirmed_data: {
    first_name: '', last_name: '', date_of_birth: '', city: '',
    nsrp_full_data: { education: { graduate: { school: 'Xavier University', course: 'MA Education', level_reached: '1st year' }, elementary: {} } },
  },
});
check('confirm 200', r.status === 200, JSON.stringify(r.data));
const anaAfter = (await call('GET', '/job-seeker/profile', ana)).data.profile;
check('page-1 fields kept (name, birth date, city)', anaAfter.first_name === anaBefore.first_name && anaAfter.date_of_birth === anaBefore.date_of_birth && anaAfter.city === anaBefore.city);
check('existing education levels kept, new level added', full(anaAfter).education?.secondary?.school === 'TAGOLOAN NATIONAL HIGH SCHOOL' && full(anaAfter).education?.graduate?.school === 'XAVIER UNIVERSITY' && full(anaAfter).education?.elementary?.school === 'TAGOLOAN CENTRAL SCHOOL');
check('other NSRP data kept', full(anaAfter).house_street === 'PUROK 1' && (full(anaAfter).work_rows || []).length > 0);

console.log('Date of birth: real date, not in the future (no minimum age)');
{
  const now = new Date();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const saveDob = (dob) => call('POST', '/job-seeker/profile', ana, { ...body, date_of_birth: dob });
  const confirmDob = (dob) => call('POST', '/nsrp/confirm', ana, { confirmed_data: { date_of_birth: dob, nsrp_full_data: {} } });
  r = await saveDob('2001-02-30');
  check('profile save: unreal date refused with a clear message', r.status === 400 && /real date/.test(r.data?.error || ''), JSON.stringify(r.data));
  r = await saveDob(tomorrow);
  check('profile save: future date refused', r.status === 400 && /cannot be in the future/.test(r.data?.error || ''), JSON.stringify(r.data));
  r = await confirmDob(tomorrow);
  check('OCR confirm: future date refused', r.status === 400 && /cannot be in the future/.test(r.data?.error || ''), JSON.stringify(r.data));
  r = await confirmDob('2001-13-01');
  check('OCR confirm: unreal date refused', r.status === 400 && /real date/.test(r.data?.error || ''), JSON.stringify(r.data));
  r = await saveDob(ymd(now));
  check('profile save: today accepted (no minimum age)', r.status === 200 && r.data.profile.date_of_birth === ymd(now), JSON.stringify(r.data.profile?.date_of_birth));
  // Incomplete dates are refused (never kept as the older date, never saved as blank).
  for (const partial of ['08/2', '08/22/19', '2000-5-1']) {
    const before = (await call('GET', '/job-seeker/profile', ana)).data.profile.date_of_birth;
    r = await saveDob(partial);
    const after = (await call('GET', '/job-seeker/profile', ana)).data.profile.date_of_birth;
    check(`profile save: incomplete "${partial}" refused, saved date unchanged`, r.status === 400 && /real date/.test(r.data?.error || '') && after === before, JSON.stringify(r.data));
    r = await confirmDob(partial);
    check(`OCR confirm: incomplete "${partial}" refused`, r.status === 400 && /real date/.test(r.data?.error || ''), JSON.stringify(r.data));
  }
  // Leap days.
  for (const [dob, ok] of [['2000-02-29', true], ['2001-02-29', false], ['1900-02-29', false], ['2024-02-29', true]]) {
    r = await saveDob(dob);
    check(`leap day ${dob} ${ok ? 'accepted' : 'refused'}`, ok ? (r.status === 200 && r.data.profile.date_of_birth === dob) : r.status === 400, JSON.stringify(r.data?.error || r.data?.profile?.date_of_birth));
  }
  // Clearing the field: saved as blank and shown as a missing required item (not the old value).
  r = await saveDob('');
  check('cleared date of birth saved as blank', r.status === 200 && !r.data.profile.date_of_birth, JSON.stringify(r.data.profile?.date_of_birth));
  check('cleared date of birth listed as a missing required item',
    (r.data.referral_requirements?.missing_fields || []).some((f) => /date of birth/i.test(f)), JSON.stringify(r.data.referral_requirements?.missing_fields));
  r = await saveDob(anaBefore.date_of_birth);
  check('original date of birth restored', r.status === 200 && r.data.profile.date_of_birth === anaBefore.date_of_birth);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
