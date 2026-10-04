// End-to-end API test: one-time PESO NSRP verification + one-tap PESO-referred applying.
// Run against a freshly seeded demo DB (MIN_SKILL_MATCHES default 3).
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
  if (r.status !== 200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.token;
}
const notifs = async (t) => (await call('GET', '/notifications', t)).data.notifications;
const profileOf = async (t) => (await call('GET', '/job-seeker/profile', t)).data;
// What the app's profile form sends: every field, with blank strings for untouched NSRP items.
async function saveProfile(t, changes = {}, fullChanges = {}) {
  const { profile } = await profileOf(t);
  const full = typeof profile.nsrp_full_data === 'string' ? JSON.parse(profile.nsrp_full_data) : (profile.nsrp_full_data || {});
  const body = {
    first_name: profile.first_name, middle_name: profile.middle_name, last_name: profile.last_name,
    date_of_birth: profile.date_of_birth, gender: profile.gender, civil_status: profile.civil_status,
    contact_number: profile.contact_number, address: profile.address, city: profile.city, province: profile.province,
    education_level: profile.education_level, course: profile.course,
    years_of_experience: String(profile.years_of_experience), employment_status: profile.employment_status,
    preferred_occupation: profile.preferred_occupation,
    nsrp_full_data: { suffix: '', height: '', weight: '', landline_number: '', ...full, ...fullChanges },
    ...changes,
  };
  return call('POST', '/job-seeker/profile', t, body);
}

const admin = await login('admin@peso.gov.ph', 'Admin@123', 'admin');
const juan = await login('juan.cruz@example.com', 'Test@123', 'job_seeker');
const maria = await login('maria.santos@example.com', 'Test@123', 'job_seeker');
const pedro = await login('pedro.reyes@example.com', 'Test@123', 'job_seeker');
const ana = await login('ana.bautista@example.com', 'Test@123', 'job_seeker');
const tech = await login('hr@techcorp.ph', 'Test@123', 'employer');
const north = await login('hr@northstar.ph', 'Test@123', 'employer');

const seekers = (await call('GET', '/admin/job-seekers', admin)).data.job_seekers;
const idOf = (email) => seekers.find((s) => s.email === email).id;
const techJobs = (await call('GET', '/employer/jobs', tech)).data.jobs;
const northJobs = (await call('GET', '/employer/jobs', north)).data.jobs;
const juniorDev = techJobs.find((j) => j.job_title === 'Junior Software Developer');
const itSupport = techJobs.find((j) => j.job_title === 'IT Support Staff');
const cook = northJobs.find((j) => j.job_title === 'Food Kiosk Cook');
const rider = northJobs.find((j) => j.job_title === 'Delivery Rider');

console.log('Seed state');
let r = await call('GET', '/admin/stats', admin);
check('stats: 1 NSRP waiting, 2 verified, 1 referred application',
  r.data.pending_nsrp_reviews === 1 && r.data.verified_nsrp_profiles === 2 && r.data.peso_referred_applications === 1, JSON.stringify(r.data));
check('admin queue lists waiting profile first', seekers[0].email === 'juan.cruz@example.com', seekers[0].email);
check('seed statuses', ['submitted', 'verified', 'needs_revision', 'verified'].join() === ['juan.cruz@example.com', 'maria.santos@example.com', 'pedro.reyes@example.com', 'ana.bautista@example.com'].map((e) => seekers.find((s) => s.email === e).nsrp_status).join());
check('employer sees Maria (PESO-referred)', itSupport.applicant_count === 1);
check('old per-job decision route removed', (await call('PUT', '/admin/applications/1/referral-status', admin, { referral_status: 'for_review' })).status === 404);

console.log('Verified seeker applies with one tap');
r = await call('GET', `/jobs/${cook.id}`, ana);
check('job shows my NSRP status', r.data.job.my_nsrp_status === 'verified');
r = await call('GET', `/jobs/${cook.id}/match`, ana);
check('match: needs 3, Ana meets it', r.data.required_matches === 3 && r.data.meets_minimum === true && r.data.matched_count === 3, JSON.stringify(r.data));
r = await call('POST', '/applications', ana, { job_post_id: cook.id, cover_letter: 'NC II holder' });
check('apply 201', r.status === 201, JSON.stringify(r.data));
const anaApp = r.data.application_id;
r = await call('GET', `/applications/${anaApp}`, ana);
check('record is PESO-Referred / For Review', r.data.application.referral_status === 'peso_referred' && r.data.application.application_status === 'for_review');
check('history: sent as PESO-Referred', r.data.history.length === 1 && r.data.history[0].new_status === 'peso_referred' && r.data.history[0].status_type === 'referral');
check('referral note mentions PESO verification', /verified by PESO/.test(r.data.application.referral_notes || ''), r.data.application.referral_notes);
check('duplicate apply 409', (await call('POST', '/applications', ana, { job_post_id: cook.id })).status === 409);
check('employer notified right away', (await notifs(north)).some((n) => n.type === 'peso_referral' && n.related_id === anaApp));
r = await call('GET', `/employer/jobs/${cook.id}/applicants`, north);
check('employer sees Ana in applicants', r.data.applicants.some((a) => a.application_id === anaApp));
check('employer can open the record', (await call('GET', `/applications/${anaApp}`, north)).status === 200);
check('employer can set For Interview', (await call('PUT', `/employer/applications/${anaApp}/status`, north, { status: 'for_interview' })).status === 200);

console.log('Temporary skill minimum');
r = await call('GET', `/jobs/${rider.id}/match`, ana);
check('match: rider needs 3, Ana has 0', r.data.required_matches === 3 && r.data.meets_minimum === false);
r = await call('POST', '/applications', ana, { job_post_id: rider.id });
check('apply blocked 400 SKILL_MINIMUM', r.status === 400 && r.data.code === 'SKILL_MINIMUM' && r.data.required_matches === 3, JSON.stringify(r.data));

console.log('Not verified yet');
r = await call('POST', '/applications', juan, { job_post_id: juniorDev.id });
check('submitted seeker blocked 400 NSRP_NOT_VERIFIED', r.status === 400 && r.data.code === 'NSRP_NOT_VERIFIED', JSON.stringify(r.data));
check('submit again while waiting 409', (await call('POST', '/job-seeker/profile/submit-nsrp', juan, { certified: true })).status === 409);
check('needs-revision seeker blocked', (await call('POST', '/applications', pedro, { job_post_id: rider.id })).data?.code === 'NSRP_NOT_VERIFIED');
const pedroId = idOf('pedro.reyes@example.com');
check('admin cannot verify a needs-revision profile', (await call('PUT', `/admin/job-seekers/${pedroId}/nsrp-status`, admin, { nsrp_status: 'verified' })).status === 400);

console.log('PESO verifies Juan once');
const juanId = idOf('juan.cruz@example.com');
r = await call('PUT', `/admin/job-seekers/${juanId}/nsrp-status`, admin, { nsrp_status: 'for_review' });
check('open -> For Review', r.status === 200 && r.data.nsrp_status === 'for_review');
check('seeker notified For Review', (await notifs(juan)).some((n) => n.title === 'NSRP Profile For Review'));
r = await call('PUT', `/admin/job-seekers/${juanId}/nsrp-status`, admin, { nsrp_status: 'for_review' });
check('second open is a no-op', r.status === 200 && r.data.nsrp_status === 'for_review');
check('return without note 400', (await call('PUT', `/admin/job-seekers/${juanId}/nsrp-status`, admin, { nsrp_status: 'needs_revision' })).status === 400);
r = await call('PUT', `/admin/job-seekers/${juanId}/nsrp-status`, admin, { nsrp_status: 'verified', notes: 'Checked against the paper form.' });
check('verify 200', r.status === 200, JSON.stringify(r.data));
check('seeker notified verified', (await notifs(juan)).some((n) => n.title === 'NSRP Profile PESO-Verified'));
check('cannot decide again once verified', (await call('PUT', `/admin/job-seekers/${juanId}/nsrp-status`, admin, { nsrp_status: 'verified' })).status === 400);
r = await call('POST', '/applications', juan, { job_post_id: juniorDev.id });
check('Juan applies to Junior Dev', r.status === 201, JSON.stringify(r.data));
const juanApp = r.data.application_id;
r = await call('POST', '/applications', juan, { job_post_id: itSupport.id });
check('...and to IT Support without PESO re-checking (if skills match)', r.status === 201 || r.data?.code === 'SKILL_MINIMUM', JSON.stringify(r.data));

console.log('Changes send a verified profile back to PESO');
r = await saveProfile(juan);
check('saving with no changes keeps PESO-Verified', r.status === 200 && !r.data.nsrp_status_changed_to && r.data.profile.nsrp_status === 'verified', JSON.stringify({ c: r.data.nsrp_status_changed_to, s: r.data.profile?.nsrp_status }));
r = await saveProfile(juan, {}, { religion: 'Iglesia ni Cristo' });
check('changing a field -> Submitted', r.data.nsrp_status_changed_to === 'submitted' && r.data.profile.nsrp_status === 'submitted', JSON.stringify(r.data.nsrp_status_changed_to));
check('seeker told it went back to PESO', (await notifs(juan)).some((n) => n.title === 'NSRP Profile Sent Back to PESO'));
check('admins told to re-check', (await notifs(admin)).some((n) => n.title === 'NSRP Profile Updated' && n.related_id === juanId));
check('cannot apply while re-checking', (await call('POST', '/applications', juan, { job_post_id: rider.id })).data?.code === 'NSRP_NOT_VERIFIED');
r = await call('GET', `/employer/jobs/${juniorDev.id}/applicants`, tech);
check('existing application stays with employer', r.data.applicants.some((a) => a.application_id === juanApp));
r = await call('PUT', `/admin/job-seekers/${juanId}/nsrp-status`, admin, { nsrp_status: 'verified' });
check('PESO re-verifies', r.status === 200);

const anaSkills = (await profileOf(ana)).skills;
r = await call('POST', '/job-seeker/skills', ana, { skills: anaSkills.slice(1).map((s) => ({ skill_id: s.id, proficiency_level: 'intermediate' })) });
check('removing a skill -> Submitted', r.data.nsrp_status_changed_to === 'submitted', JSON.stringify(r.data.nsrp_status_changed_to));

console.log('Returned profile, resubmit, incomplete');
r = await saveProfile(pedro, {}, { gsis_sss_no: '07-1234567-8' });
check('editing a needs-revision profile keeps it Needs Revision', r.data.profile.nsrp_status === 'needs_revision');
check('submit without certification 400', (await call('POST', '/job-seeker/profile/submit-nsrp', pedro)).data?.code === 'CERTIFICATION_REQUIRED');
r = await call('POST', '/job-seeker/profile/submit-nsrp', pedro, { certified: true });
check('Pedro resubmits', r.status === 200 && r.data.nsrp_status === 'submitted');
check('admins told of resubmission', (await notifs(admin)).some((n) => n.title === 'NSRP Profile Resubmitted'));
r = await saveProfile(pedro, { city: '' });
check('waiting profile made incomplete -> Not Submitted', r.data.nsrp_status_changed_to === 'not_submitted', JSON.stringify(r.data.nsrp_status_changed_to));
r = await call('POST', '/job-seeker/profile/submit-nsrp', pedro, { certified: true });
check('incomplete submit 400 with missing fields', r.status === 400 && r.data.missing_fields.includes('City/Municipality'), JSON.stringify(r.data));

console.log('Final');
r = await call('GET', '/admin/stats', admin);
check('stats updated', r.data.pending_nsrp_reviews === 1 && r.data.verified_nsrp_profiles === 2, JSON.stringify(r.data));
r = await call('GET', '/applications/my-applications', juan);
check('Juan sees his applications', r.data.applications.length >= 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
