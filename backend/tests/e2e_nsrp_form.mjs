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
check('Ana education table present', full(p.profile).education?.secondary?.school === 'Tagoloan National High School');
check('summary filled from table', /Tagoloan National High School/.test(full(p.profile).secondary_background || ''));
check('address built from House No./Street + Barangay', p.profile.address === 'Purok 1, Poblacion', p.profile.address);
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
  },
};
let r = await call('POST', '/job-seeker/profile', ana, body);
check('save 200', r.status === 200, JSON.stringify(r.data));
check('tertiary summary derived', /USTP, BS Hospitality Management/.test(full(r.data.profile).tertiary_background || ''), full(r.data.profile).tertiary_background);
check('undergraduate highest level', r.data.profile.education_level === 'Tertiary (undergraduate)' && r.data.profile.course === 'BS Hospitality Management', `${r.data.profile.education_level} / ${r.data.profile.course}`);
check('changing education sends verified profile back to PESO', r.data.nsrp_status_changed_to === 'submitted');

console.log('Live-in civil status (NSRP Form 1 option)');
p = (await call('GET', '/job-seeker/profile', pedro)).data.profile;
r = await call('POST', '/job-seeker/profile', pedro, { ...p, civil_status: 'live-in', nsrp_full_data: full(p) });
check('live-in saves', r.status === 200 && r.data.profile.civil_status === 'live-in', JSON.stringify(r.data?.profile?.civil_status));

console.log('Certification and PESO assessment');
check('submit without certification refused', (await call('POST', '/job-seeker/profile/submit-nsrp', pedro, {})).data?.code === 'CERTIFICATION_REQUIRED');
check('submit with certification', (await call('POST', '/job-seeker/profile/submit-nsrp', pedro, { certified: true })).status === 200);
const seekers = (await call('GET', '/admin/job-seekers', admin)).data.job_seekers;
const pedroId = seekers.find((s) => s.email === 'pedro.reyes@example.com').id;
r = await call('PUT', `/admin/job-seekers/${pedroId}/nsrp-status`, admin, {
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
check('existing education levels kept, new level added', full(anaAfter).education?.secondary?.school === 'Tagoloan National High School' && full(anaAfter).education?.graduate?.school === 'Xavier University' && full(anaAfter).education?.elementary?.school === 'Tagoloan Central School');
check('other NSRP data kept', full(anaAfter).house_street === 'Purok 1' && (full(anaAfter).work_rows || []).length > 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
