// End-to-end API test: objective (a) what-if scenarios (job edits, hiring, closing, deactivation,
// closing dates, skill comparison edge cases, employer account management).
// Run against a freshly seeded demo DB:  node tests/e2e_objective_a.mjs
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
const hasNotif = async (t, title, relatedId) => (await notifs(t)).some((n) => n.title === title && (relatedId === undefined || n.related_id === relatedId));
const skillIds = async (t) => (await call('GET', '/skills', t)).data.skills;

const admin = await login('admin@peso.gov.ph', 'Admin@123', 'admin');
const juan = await login('juan.cruz@example.com', 'Test@123', 'job_seeker');
const maria = await login('maria.santos@example.com', 'Test@123', 'job_seeker');
const pedro = await login('pedro.reyes@example.com', 'Test@123', 'job_seeker');
const ana = await login('ana.bautista@example.com', 'Test@123', 'job_seeker');
const tech = await login('hr@techcorp.ph', 'Test@123', 'employer');
const north = await login('hr@northstar.ph', 'Test@123', 'employer');

const seekers = (await call('GET', '/admin/job-seekers', admin)).data.job_seekers;
const seekerId = (email) => seekers.find((s) => s.email === email).id;
const allJobs = [...(await call('GET', '/employer/jobs', tech)).data.jobs, ...(await call('GET', '/employer/jobs', north)).data.jobs];
const jobByTitle = (t) => allJobs.find((j) => j.job_title === t);
const cook = jobByTitle('Food Kiosk Cook');
const juniorDev = jobByTitle('Junior Software Developer');
const cookOwner = (await call('GET', '/employer/jobs', north)).data.jobs.some((j) => j.id === cook.id) ? north : tech;
const skills = await skillIds(ana);
const sid = (name) => skills.find((s) => s.skill_name === name).id;

console.log('Setup: Maria adds cook skills, PESO re-verifies, Ana and Maria apply to Food Kiosk Cook');
const mariaSkills = (await call('GET', '/job-seeker/profile', maria)).data.skills.map((s) => s.id);
let r = await call('POST', '/job-seeker/skills', maria, {
  skills: [...mariaSkills, sid('Cooking'), sid('Food and Beverage Service'), sid('Teamwork')].map((id) => ({ skill_id: id, proficiency_level: 'intermediate' })),
});
check('Maria skill change sends NSRP back to PESO', r.data.nsrp_status_changed_to === 'submitted');
check('PESO re-verifies Maria', (await call('PUT', `/admin/job-seekers/${seekerId('maria.santos@example.com')}/nsrp-status`, admin, { nsrp_status: 'verified' })).status === 200);
const anaApp = (await call('POST', '/applications', ana, { job_post_id: cook.id })).data.application_id;
const mariaApp = (await call('POST', '/applications', maria, { job_post_id: cook.id })).data.application_id;
check('both applied', anaApp && mariaApp);

console.log('Employer edits the job post (vacancies 2 -> 1)');
r = await call('PUT', `/employer/jobs/${cook.id}`, cookOwner, { vacancies: 1 });
check('edit 200', r.status === 200);
check('active applicants told the job post was updated', await hasNotif(ana, 'Job Post Updated', cook.id) && await hasNotif(maria, 'Job Post Updated', cook.id));

console.log('Many applicants, one hired');
check('hire Ana', (await call('PUT', `/employer/applications/${anaApp}/status`, cookOwner, { status: 'hired' })).status === 200);
check('employer told all vacancies are filled', await hasNotif(cookOwner, 'All Vacancies Filled', cook.id));
r = await call('GET', `/applications/${mariaApp}`, maria);
check('Maria is NOT auto-rejected (still For Review)', r.data.application.application_status === 'for_review', r.data.application.application_status);
check('Maria got no rejection notice', !(await notifs(maria)).some((n) => n.related_id === mariaApp && /no longer being considered|rejected/i.test(n.message)));

console.log('Employer closes the job post');
r = await call('PUT', `/employer/jobs/${cook.id}/close`, cookOwner);
check('close 200, 1 application closed', r.status === 200 && r.data.closed_applications === 1, JSON.stringify(r.data));
r = await call('GET', `/applications/${mariaApp}`, maria);
check('Maria -> Closed with history row', r.data.application.application_status === 'closed' && r.data.history.some((h) => h.new_status === 'closed' && h.status_type === 'application'));
check('Maria told it is not a rejection', (await notifs(maria)).some((n) => n.title === 'Application Closed' && /not a rejection/.test(n.message)));
check('Ana stays Hired', (await call('GET', `/applications/${anaApp}`, ana)).data.application.application_status === 'hired');
r = await call('GET', `/jobs/${cook.id}`, ana);
check('closed job not accepting applications', r.data.job.accepting_applications === false);
check('closed job hidden from browse', !(await call('GET', '/jobs', ana)).data.jobs.some((j) => j.id === cook.id));

console.log('Closing date passed');
const cashier = jobByTitle('Store Cashier');
const cashierOwner = (await call('GET', '/employer/jobs', north)).data.jobs.some((j) => j.id === cashier.id) ? north : tech;
const yesterday = new Date(Date.now() - 86400000 + 8 * 3600000).toISOString().slice(0, 10);
check('set closing date to yesterday', (await call('PUT', `/employer/jobs/${cashier.id}`, cashierOwner, { closing_date: yesterday })).status === 200);
check('expired job hidden from browse', !(await call('GET', '/jobs', ana)).data.jobs.some((j) => j.id === cashier.id));
r = await call('POST', '/applications', ana, { job_post_id: cashier.id });
check('apply to expired job -> JOB_CLOSED', r.status === 404 && r.data.code === 'JOB_CLOSED', JSON.stringify(r.data));

console.log('Skill comparison edge cases');
check('Pedro removes all skills', (await call('POST', '/job-seeker/skills', pedro, { skills: [] })).status === 200);
r = await call('GET', `/jobs/${juniorDev.id}/match`, pedro);
check('no saved skills -> skills_confirmed false', r.data.skills_confirmed === false && r.data.total_required === 4, JSON.stringify(r.data));
r = await call('GET', `/jobs/${juniorDev.id}/match`, juan);
check('Juan sees 4/4 matched', r.data.skills_confirmed === true && r.data.matched_count === 4);

console.log('Admin deactivates a job seeker with an in-progress application');
check('PESO verifies Juan', (await call('PUT', `/admin/job-seekers/${seekerId('juan.cruz@example.com')}/nsrp-status`, admin, { nsrp_status: 'verified' })).status === 200);
const juanApp = (await call('POST', '/applications', juan, { job_post_id: juniorDev.id })).data.application_id;
check('Juan applied', !!juanApp);
check('deactivate Juan', (await call('PUT', `/admin/job-seekers/${seekerId('juan.cruz@example.com')}/deactivate`, admin, { reason: 'Test' })).status === 200);
check('Juan session refused', (await call('GET', '/job-seeker/profile', juan)).status === 403);
r = await call('GET', `/admin/applications/${juanApp}`, admin);
check('Juan application closed', r.data.application.application_status === 'closed');
check('employer told the applicant record was closed', await hasNotif(tech, 'Applicant Record Closed', juanApp));
check('reactivate Juan', (await call('PUT', `/admin/job-seekers/${seekerId('juan.cruz@example.com')}/reactivate`, admin)).status === 200);
check('Juan can use the app again', (await call('GET', '/job-seeker/profile', juan)).status === 200);

console.log('Employer account management');
const employers = (await call('GET', '/admin/employers', admin)).data.employers;
const northEmp = employers.find((e) => e.email === 'hr@northstar.ph');
const blue = employers.find((e) => e.email === 'hr@bluemountain.ph');
r = await call('PUT', `/admin/employers/${northEmp.id}`, admin, { contact_person: 'Updated Contact', company_size: 'medium' });
check('admin updates employer details', r.status === 200 && r.data.employer.contact_person === 'Updated Contact');
check('employer notified of update', await hasNotif(north, 'Company Details Updated'));
check('blank company name rejected', (await call('PUT', `/admin/employers/${northEmp.id}`, admin, { company_name: ' ' })).status === 400);
check('bad company size rejected', (await call('PUT', `/admin/employers/${northEmp.id}`, admin, { company_size: 'huge' })).status === 400);

const northActive = (await call('GET', '/employer/jobs', north)).data.jobs.filter((j) => j.status === 'active');
const riderApp = await (async () => {
  const rider = northActive.find((j) => j.job_title === 'Delivery Rider');
  if (!rider) return null;
  // give Ana the rider skills so she can apply, then re-verify
  const anaSkills = (await call('GET', '/job-seeker/profile', ana)).data.skills.map((s) => s.id);
  await call('POST', '/job-seeker/skills', ana, { skills: [...anaSkills, sid('Motorcycle Delivery'), sid('Driving'), sid('Customer Service')].map((id) => ({ skill_id: id })) });
  await call('PUT', `/admin/job-seekers/${seekerId('ana.bautista@example.com')}/nsrp-status`, admin, { nsrp_status: 'verified' });
  return (await call('POST', '/applications', ana, { job_post_id: rider.id })).data.application_id;
})();
check('Ana applied to Delivery Rider', !!riderApp);
r = await call('PUT', `/admin/employers/${northEmp.id}/deactivate`, admin, { reason: 'Invalid business permit' });
check('deactivate employer closes its active posts', r.status === 200 && r.data.closed_job_posts === northActive.length, JSON.stringify(r.data));
check('deactivated employer cannot sign in', (await call('POST', '/auth/login', null, { email: 'hr@northstar.ph', password: 'Test@123', role: 'employer' })).status !== 200);
check('its jobs are gone from browse', !(await call('GET', '/jobs', ana)).data.jobs.some((j) => northActive.some((n) => n.id === j.id)));
check('Ana rider application closed', (await call('GET', `/applications/${riderApp}`, ana)).data.application.application_status === 'closed');
check('reactivate employer', (await call('PUT', `/admin/employers/${northEmp.id}/reactivate`, admin)).status === 200);
const north2 = await login('hr@northstar.ph', 'Test@123', 'employer');
check('reactivated employer signs in; posts stay closed', (await call('GET', '/employer/jobs', north2)).data.jobs.every((j) => j.status === 'closed'));
check('cannot reactivate a pending employer', (await call('PUT', `/admin/employers/${blue.id}/reactivate`, admin)).status === 400);
check('approve pending employer', (await call('PUT', `/admin/employers/${blue.id}/approve`, admin)).status === 200);

console.log('Admin monitoring and NSRP form images');
r = await call('GET', '/admin/applications', admin);
check('applications carry employer_id and job_post_id for grouping', r.data.applications.every((a) => a.employer_id && a.job_post_id));
r = await call('GET', `/admin/job-seekers/${seekerId('ana.bautista@example.com')}/profile`, admin);
check('profile reports uploaded form count', typeof r.data.uploaded_form_count === 'number');
r = await call('GET', `/admin/job-seekers/${seekerId('ana.bautista@example.com')}/nsrp-forms`, admin);
check('nsrp-forms endpoint returns a list', r.status === 200 && Array.isArray(r.data.forms));
check('non-admin cannot read nsrp-forms', (await call('GET', `/admin/job-seekers/${seekerId('ana.bautista@example.com')}/nsrp-forms`, ana)).status === 403);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
