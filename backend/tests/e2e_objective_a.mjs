// End-to-end API test: objective (a) what-if scenarios (job edits, hiring, closing, deactivation,
// closing dates, skill comparison edge cases, employer account management).
// Run against a freshly seeded demo DB:  node tests/e2e_objective_a.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

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

console.log('Skills list: NSRP Section VIII-related group (category only; names unchanged)');
const { SKILLS: SEED_SKILLS, NSRP_SECTION_VIII_CATEGORY } = await import('../seed-skills.js').then((m) => m.default || m);
const nsrpNames = [
  'Automotive Servicing', 'Beauty Care', 'Carpentry', 'Computer Literacy', 'Domestic Work', 'Driving',
  'Electrical Wiring', 'Embroidery', 'Gardening', 'Masonry', 'Painting', 'Photography', 'Plumbing',
  'Dressmaking', 'Stenography', 'Tailoring',
];
check('every seeded skill name exists exactly once',
  SEED_SKILLS.every(([n]) => skills.filter((s) => s.skill_name === n).length === 1));
check('the 16 Section VIII-related skills share the NSRP category',
  nsrpNames.every((n) => skills.find((s) => s.skill_name === n)?.category === NSRP_SECTION_VIII_CATEGORY),
  JSON.stringify(skills.filter((s) => nsrpNames.includes(s.skill_name)).map((s) => [s.skill_name, s.category])));
check('no other skill is in the NSRP category',
  skills.filter((s) => s.category === NSRP_SECTION_VIII_CATEGORY).length === nsrpNames.length);

console.log('Setup: Maria adds cook skills, PESO re-verifies, Ana and Maria apply to Food Kiosk Cook');
const mariaSkills = (await call('GET', '/job-seeker/profile', maria)).data.skills.map((s) => s.id);
let r = await call('POST', '/job-seeker/skills', maria, {
  skills: [...mariaSkills, sid('Cooking'), sid('Food and Beverage Service'), sid('Teamwork')].map((id) => ({ skill_id: id, proficiency_level: 'intermediate' })),
});
check('Maria skill change sends NSRP back to PESO', r.data.nsrp_status_changed_to === 'submitted');
check('PESO re-verifies Maria', (await decide(admin, seekerId('maria.santos@example.com'), { nsrp_status: 'verified' })).status === 200);
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
check('Maria told the vacancies are filled (status unchanged)', await hasNotif(maria, 'Vacancies Filled', mariaApp));
check('the hired applicant gets no vacancies-filled notice', !(await hasNotif(ana, 'Vacancies Filled', anaApp)));

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
check('closing it again is refused (no duplicate alerts)', (await call('PUT', `/employer/jobs/${cook.id}/close`, cookOwner)).status === 400);
check('admin closing an already-closed post is refused', (await call('PUT', `/admin/jobs/${cook.id}/close`, admin, {})).status === 400);
check('a closed post cannot be reopened by editing its status',
  (await call('PUT', `/employer/jobs/${cook.id}`, cookOwner, { status: 'active' })).status === 400);

console.log('Closing date passed');
const cashier = jobByTitle('Store Cashier');
const cashierOwner = (await call('GET', '/employer/jobs', north)).data.jobs.some((j) => j.id === cashier.id) ? north : tech;
const yesterday = new Date(Date.now() - 86400000 + 8 * 3600000).toISOString().slice(0, 10);
const activeBefore = (await call('GET', '/admin/stats', admin)).data.active_jobs;
check('set closing date to yesterday', (await call('PUT', `/employer/jobs/${cashier.id}`, cashierOwner, { closing_date: yesterday })).status === 200);
check('admin active-jobs count leaves out the expired job', (await call('GET', '/admin/stats', admin)).data.active_jobs === activeBefore - 1);
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
check('PESO verifies Juan', (await decide(admin, seekerId('juan.cruz@example.com'), { nsrp_status: 'verified' })).status === 200);
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
r = await call('PUT', `/admin/employers/${northEmp.id}`, admin, { contact_person: 'Updated Contact', company_size: 'medium' });
check('admin updates employer details', r.status === 200 && r.data.employer.contact_person === 'Updated Contact');
check('employer notified of update', await hasNotif(north, 'Company Details Updated'));
check('blank company name rejected', (await call('PUT', `/admin/employers/${northEmp.id}`, admin, { company_name: ' ' })).status === 400);
check('bad company size rejected', (await call('PUT', `/admin/employers/${northEmp.id}`, admin, { company_size: 'huge' })).status === 400);

console.log('Email format checks');
check('admin cannot create an employer with an invalid email',
  (await call('POST', '/admin/employers', admin, { email: 'abc', password: 'Test@123', company_name: 'Bad Email Co' })).status === 400);
check('job seeker cannot register with an invalid email',
  (await call('POST', '/auth/register', null, { email: 'abc', password: 'Test@123', role: 'job_seeker' })).status === 400);
check('job seeker can still register with a valid email',
  (await call('POST', '/auth/register', null, { email: `  Valid.Seeker.${Date.now()}@Example.com `, password: 'Test@123', role: 'job_seeker' })).status === 201);
check('job post with an invalid application email rejected',
  (await call('POST', '/employer/jobs', tech, { job_title: 'Email Check', job_description: 'Test', application_email: 'not-an-email' })).status === 400);
{
  const devJob = jobByTitle('Junior Software Developer');
  const before = (await call('GET', '/employer/jobs', tech)).data.jobs.find((j) => j.id === devJob.id).application_email;
  await call('PUT', `/employer/jobs/${devJob.id}`, tech, { application_email: '  hr.jobs@techcorp.ph  ' });
  const saved = (await call('GET', '/employer/jobs', tech)).data.jobs.find((j) => j.id === devJob.id).application_email;
  check('application email saved without surrounding spaces', saved === 'hr.jobs@techcorp.ph', JSON.stringify(saved));
  await call('PUT', `/employer/jobs/${devJob.id}`, tech, { application_email: before || '' });
}

check('register with a non-text password refused (not a server error)',
  (await call('POST', '/auth/register', null, { email: `num.pass.${Date.now()}@example.com`, password: 123456, role: 'job_seeker' })).status === 400);
check('employer company name of only spaces refused',
  (await call('POST', '/employer/profile', tech, { company_name: '   ' })).status === 400);
check('admin cannot add a skill with a blank name', (await call('POST', '/skills', admin, { skill_name: '   ' })).status === 400);

console.log('Job post field checks');
{
  const post = (body) => call('POST', '/employer/jobs', tech, { job_title: 'Field Check', job_description: 'Test', ...body });
  check('new job post with a past closing date rejected', (await post({ closing_date: '2020-01-01' })).status === 400);
  check('job title of only spaces rejected', (await post({ job_title: '   ' })).status === 400);
  check('salary min higher than max rejected', (await post({ salary_min: 30000, salary_max: 10000 })).status === 400);
  check('negative vacancies rejected', (await post({ vacancies: -3 })).status === 400);
  check('unknown job type rejected (not a server error)', (await post({ job_type: 'bogus' })).status === 400);
  const longTitle = await post({ job_title: 'A'.repeat(256) });
  check('job title over 255 characters rejected with a clear message (not a server error)',
    longTitle.status === 400 && /255 characters/.test(longTitle.data?.error || ''), JSON.stringify(longTitle.data));
  const devJob = jobByTitle('Junior Software Developer');
  const longEdit = await call('PUT', `/employer/jobs/${devJob.id}`, tech, { job_title: 'B'.repeat(256) });
  check('edit: job title over 255 characters rejected', longEdit.status === 400 && /255 characters/.test(longEdit.data?.error || ''));
  check('edit: salary max below the saved min rejected',
    (await call('PUT', `/employer/jobs/${devJob.id}`, tech, { salary_min: 50000, salary_max: 1000 })).status === 400);
  check('edit: unknown status rejected (not a server error)',
    (await call('PUT', `/employer/jobs/${devJob.id}`, tech, { status: 'bogus' })).status === 400);
}

const northActive = (await call('GET', '/employer/jobs', north)).data.jobs.filter((j) => j.status === 'active');
const riderApp = await (async () => {
  const rider = northActive.find((j) => j.job_title === 'Delivery Rider');
  if (!rider) return null;
  // give Ana the rider skills so she can apply, then re-verify
  const anaSkills = (await call('GET', '/job-seeker/profile', ana)).data.skills.map((s) => s.id);
  await call('POST', '/job-seeker/skills', ana, { skills: [...anaSkills, sid('Motorcycle Delivery'), sid('Driving'), sid('Customer Service')].map((id) => ({ skill_id: id })) });
  await decide(admin, seekerId('ana.bautista@example.com'), { nsrp_status: 'verified' });
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
check('demo has no employer waiting for approval', (await call('GET', '/admin/employers/pending', admin)).data.employers.length === 0);
{
  // Safety net for older records: a pending employer (self-registered before PESO stopped that) is created
  // directly in the reset demo/test database, then handled through the approval screen's API.
  const require = createRequire(import.meta.url);
  const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  require('dotenv').config({ path: path.join(backendDir, '.env') });
  const dbName = process.env.DEMO_DB || 'peso_link_demo';
  if (dbName === 'peso_link_misor') throw new Error('Refusing to run on the real database (peso_link_misor).');
  const mysql = require('mysql2/promise');
  const bcrypt = require('bcryptjs');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: dbName,
  });
  const [u] = await conn.query("INSERT INTO users (email, password_hash, role, account_status) VALUES ('older.pending@example.com', ?, 'employer', 'pending')", [await bcrypt.hash('Test@123', 10)]);
  const [e] = await conn.query("INSERT INTO employers (user_id, company_name, approval_status) VALUES (?, 'Older Pending Co.', 'pending')", [u.insertId]);
  await conn.end();
  check('older pending employer cannot sign in', (await call('POST', '/auth/login', null, { email: 'older.pending@example.com', password: 'Test@123', role: 'employer' })).status === 403);
  check('admin sees it waiting for approval', (await call('GET', '/admin/employers/pending', admin)).data.employers.some((x) => x.id === e.insertId));
  check('cannot reactivate a pending employer', (await call('PUT', `/admin/employers/${e.insertId}/reactivate`, admin)).status === 400);
  check('approve pending employer', (await call('PUT', `/admin/employers/${e.insertId}/approve`, admin)).status === 200);
  check('approved employer signs in', (await call('POST', '/auth/login', null, { email: 'older.pending@example.com', password: 'Test@123', role: 'employer' })).status === 200);
}

console.log('Admin monitoring and NSRP form images');
r = await call('GET', '/admin/applications', admin);
check('applications carry employer_id and job_post_id for grouping', r.data.applications.every((a) => a.employer_id && a.job_post_id));
r = await call('GET', `/admin/job-seekers/${seekerId('ana.bautista@example.com')}/profile`, admin);
check('profile reports uploaded form count', typeof r.data.uploaded_form_count === 'number');
r = await call('GET', `/admin/job-seekers/${seekerId('ana.bautista@example.com')}/nsrp-forms`, admin);
check('nsrp-forms endpoint returns a list', r.status === 200 && Array.isArray(r.data.forms));
check('non-admin cannot read nsrp-forms', (await call('GET', `/admin/job-seekers/${seekerId('ana.bautista@example.com')}/nsrp-forms`, ana)).status === 403);
{
  // Every upload can be seen: 4 at a time, newest first, then the older ones with ?offset=.
  const tinyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  for (let i = 0; i < 5; i += 1) await call('POST', '/nsrp/upload', ana, { image_base64: tinyImage });
  const anaId = seekerId('ana.bautista@example.com');
  const total = (await call('GET', `/admin/job-seekers/${anaId}/profile`, admin)).data.uploaded_form_count;
  const first = (await call('GET', `/admin/job-seekers/${anaId}/nsrp-forms`, admin)).data.forms;
  const rest = (await call('GET', `/admin/job-seekers/${anaId}/nsrp-forms?offset=4`, admin)).data.forms;
  const ids = new Set([...first, ...rest].map((f) => f.id));
  check('uploaded forms load 4 at a time and the older ones are reachable',
    total >= 5 && first.length === 4 && first.length + rest.length === total && ids.size === total, `${total} ${first.length} ${rest.length}`);
}

console.log('"Job Post Updated" only when the posting really changes');
{
  // Maria's IT Support Staff application is still in progress here (TechCorp is never deactivated).
  const itJob = jobByTitle('IT Support Staff');
  const mariaIt = (await call('GET', '/applications/my-applications', maria)).data.applications.find((a) => a.job_post_id === itJob.id);
  const updateAlerts = async () => (await notifs(maria)).filter((n) => n.title === 'Job Post Updated' && n.related_id === itJob.id).length;
  const current = (await call('GET', `/jobs/${itJob.id}`, tech)).data.job;
  const skillIdsNow = current.required_skills.map((s) => s.id);
  // The same body the job form sends when nothing was edited.
  const sameForm = {
    job_title: current.job_title, job_description: current.job_description, job_type: current.job_type,
    salary_min: current.salary_min != null ? parseFloat(current.salary_min) : null,
    salary_max: current.salary_max != null ? parseFloat(current.salary_max) : null,
    location: current.location || '', vacancies: current.vacancies, requirements: current.requirements || '',
    application_email: current.application_email || '', closing_date: current.closing_date || null,
    required_skills: skillIdsNow.map((id) => ({ skill_id: id, required_level: 'beginner' })),
  };
  check('Maria still has an in-progress IT Support application', mariaIt && ['for_review', 'for_interview'].includes(mariaIt.application_status), JSON.stringify(mariaIt));
  let before = await updateAlerts();
  check('identical save is accepted', (await call('PUT', `/employer/jobs/${itJob.id}`, tech, sameForm)).status === 200);
  check('identical save (same skills) sends no "Job Post Updated"', (await updateAlerts()) === before);
  await call('PUT', `/employer/jobs/${itJob.id}`, tech, { ...sameForm, required_skills: [...sameForm.required_skills].reverse() });
  await call('PUT', `/employer/jobs/${itJob.id}`, tech, {});
  check('same skills in another order, or an empty save, send no alert', (await updateAlerts()) === before);
  await call('PUT', `/employer/jobs/${itJob.id}`, tech, { ...sameForm, salary_max: (sameForm.salary_max || 0) + 1000 });
  check('a salary change notifies the in-progress applicant', (await updateAlerts()) === before + 1);
  before += 1;
  const extraSkill = skills.find((s) => !skillIdsNow.includes(s.id));
  await call('PUT', `/employer/jobs/${itJob.id}`, tech, { ...sameForm, salary_max: (sameForm.salary_max || 0) + 1000,
    required_skills: [...sameForm.required_skills, { skill_id: extraSkill.id, required_level: 'beginner' }] });
  check('a required-skills change notifies the in-progress applicant', (await updateAlerts()) === before + 1);
  before += 1;
  r = await call('PUT', `/employer/jobs/${itJob.id}`, tech, { status: 'closed' });
  check('closing by edit: applicant told "Application Closed", no "Job Post Updated"',
    r.status === 200 && await hasNotif(maria, 'Application Closed', mariaIt.id) && (await updateAlerts()) === before);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
