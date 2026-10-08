// ============================================================
// Seed Demo Data for IT323 Demonstration
// ============================================================
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { syncSkills } = require('./seed-skills');
const { nsrpFingerprint } = require('./services/nsrpReview');
const { normalizeNsrpProfile } = require('./services/nsrpForm');

// Fill in the NSRP extended fields that are not stored as job_seekers columns.
function nsrpData(overrides) {
  return {
    suffix: '', place_of_birth: '', religion: '', height: '',
    tin: '', gsis_sss_no: '', pagibig_no: '', philhealth_no: '',
    email_address: '', landline_number: '', cell_phone_number: '',
    house_street: '', village: '', barangay: '',
    disability: 'none', disabilities: [], disability_other: '', employment_type: '',
    looking_for_work: 'yes', looking_duration: '', willing_to_work_immediately: 'yes',
    available_when: '', four_ps_beneficiary: 'no', household_id: '',
    language_dialect: '', language_proficiency: '', other_skills: '',
    other_skills_acquired: '', trainings: '', eligibility_license: '',
    work_experience: '', elementary_background: '', secondary_background: '',
    tertiary_background: '', graduate_studies_background: '',
    preferred_occupations: '', preferred_work_location: '',
    preferred_local_locations: '', preferred_overseas_locations: '',
    expected_salary: '', availability: '', passport_number: '', passport_expiry: '',
    ...overrides,
  };
}

async function run() {
  console.log('[Seed] Starting...');

  // Schema is applied via init-db.js (mysql CLI). Seed handles data only.

  // 2. Helper to hash passwords
  const hash = (pw) => bcrypt.hash(pw, 10);

  // 3. Admin
  const adminHash = await hash('Admin@123');
  const [adminUser] = await db.query(
    "INSERT INTO users (email, password_hash, role, account_status) VALUES (?, ?, 'admin', 'active')",
    ['admin@peso.gov.ph', adminHash]
  );
  await db.query(
    'INSERT INTO peso_admins (user_id, full_name, position, contact_number) VALUES (?, ?, ?, ?)',
    [adminUser.insertId, 'PESO-Link MisOr Administrator', 'PESO Officer-in-Charge', '088-857-1234']
  );
  console.log('[Seed] Admin created: admin@peso.gov.ph / Admin@123');

  // 4. Skills master list
  await syncSkills(db);
  console.log('[Seed] Skills seeded.');

  const [skillRows] = await db.query('SELECT id, skill_name FROM skills');
  const skillByName = {};
  skillRows.forEach((s) => (skillByName[s.skill_name] = s.id));

  // 5. Job seekers
  // NSRP Form 1 data for the demo job seekers (structured like the official form; the summary
  // text fields are filled from these rows by normalizeNsrpProfile, as when saving in the app).
  const lang = (r, w, sp, u) => ({ read: r, write: w, speak: sp, understand: u });
  const seekerData = [
    {
      email: 'juan.cruz@example.com',
      password: 'Test@123',
      first_name: 'Juan', middle_name: 'Dela', last_name: 'Cruz',
      date_of_birth: '1998-05-15', gender: 'male', civil_status: 'single',
      city: 'Cagayan de Oro City', province: 'Misamis Oriental',
      years_of_experience: 2, employment_status: 'unemployed',
      nsrp_full_data: nsrpData({
        place_of_birth: 'Cagayan de Oro City', religion: 'Roman Catholic', height: '170 cm',
        cell_phone_number: '09171234567', email_address: 'juan.cruz@example.com',
        house_street: 'Purok 3', barangay: 'San Isidro',
        tin: '123-456-789-000', philhealth_no: '12-345678901-2',
        employment_type: 'new entrant/fresh graduate', looking_duration: '3 months',
        preferred_occupation_list: ['Software Developer', 'IT Support', 'Web Developer', ''],
        preferred_work_location: 'local',
        local_location_list: ['Cagayan de Oro City', 'Opol', ''],
        expected_salary: 'PHP 18,000 - 25,000',
        languages: { english: lang(true, true, true, true), filipino: lang(true, true, true, true), other: { name: 'Cebuano', ...lang(true, true, true, true) } },
        education: {
          elementary: { school: 'Carmen Central School', year_graduated: '2010' },
          secondary: { school: 'Cagayan de Oro National High School', year_graduated: '2016' },
          tertiary: { school: 'USTP Cagayan de Oro', course: 'BS Information Technology', year_graduated: '2020' },
        },
        training_rows: [{ course: 'Web Development Bootcamp', duration: '01/2021 to 02/2021', institution: 'DICT Region X', certificate: 'Certificate of Completion' }],
        work_rows: [{ company: 'Freelance Client', address: 'Cagayan de Oro City', position: 'Web Developer', dates: '06/2020 to 12/2022', status: 'Part-time' }],
        other_skills_checked: ['Computer Literate'], other_skills_acquired: 'Computer Literate',
      }),
      skills: ['Web Development', 'JavaScript', 'Python', 'Database Management', 'English Proficiency'],
      // Submitted NSRP profile waiting for PESO verification - use admin to demo verifying it.
      nsrp: { status: 'submitted' },
    },
    {
      email: 'maria.santos@example.com',
      password: 'Test@123',
      first_name: 'Maria', middle_name: 'Lopez', last_name: 'Santos',
      date_of_birth: '1999-08-22', gender: 'female', civil_status: 'single',
      city: 'Cagayan de Oro City', province: 'Misamis Oriental',
      years_of_experience: 1, employment_status: 'employed',
      nsrp_full_data: nsrpData({
        place_of_birth: 'Cagayan de Oro City', religion: 'Roman Catholic', height: '157 cm',
        cell_phone_number: '09181234568', email_address: 'maria.santos@example.com',
        house_street: 'Zone 4', barangay: 'Macabalan', gsis_sss_no: '34-5678901-2',
        employment_type: 'wage employed', looking_duration: '2 months',
        preferred_occupation_list: ['Office Staff', 'Admin Assistant', 'Bookkeeper', ''],
        preferred_work_location: 'local',
        local_location_list: ['Cagayan de Oro City', 'Opol', ''],
        expected_salary: 'PHP 15,000 - 18,000',
        languages: { english: lang(true, true, true, true), filipino: lang(true, true, true, true), other: { name: 'Cebuano', ...lang(true, true, true, true) } },
        education: {
          secondary: { school: 'Macabalan National High School', year_graduated: '2017' },
          tertiary: { school: 'Xavier University', course: 'BS Business Administration', year_graduated: '2021' },
        },
        work_rows: [{ company: 'Macabalan Trading', address: 'Cagayan de Oro City', position: 'Office Assistant', dates: '07/2021 to present', status: 'Part-time' }],
        other_skills_checked: ['Computer Literate', 'Stenography'], other_skills_acquired: 'Computer Literate\nStenography',
      }),
      skills: ['Microsoft Office', 'Customer Service', 'Bookkeeping', 'Communication', 'English Proficiency', 'Computer Literacy'],
      nsrp: { status: 'verified', notes: 'NSRP details checked against the submitted form.' },
    },
    {
      email: 'pedro.reyes@example.com',
      password: 'Test@123',
      first_name: 'Pedro', middle_name: 'Garcia', last_name: 'Reyes',
      date_of_birth: '1995-03-10', gender: 'male', civil_status: 'married',
      city: 'Gingoog City', province: 'Misamis Oriental',
      years_of_experience: 5, employment_status: 'unemployed',
      nsrp_full_data: nsrpData({
        place_of_birth: 'Gingoog City', religion: 'Roman Catholic', height: '168 cm',
        cell_phone_number: '09191234569',
        house_street: 'Sitio Bagong Silang', barangay: 'Lunao',
        employment_type: 'terminated/laidoff(local)', looking_duration: '6 months',
        four_ps_beneficiary: 'yes', household_id: '104305001-0001',
        preferred_occupation_list: ['Electrician', 'Construction Worker', '', ''],
        preferred_work_location: 'local',
        local_location_list: ['Gingoog City', 'Cagayan de Oro City', ''],
        languages: { filipino: lang(true, true, true, true), other: { name: 'Cebuano', ...lang(true, true, true, true) } },
        education: {
          elementary: { school: 'Lunao Elementary School', year_graduated: '2008' },
          secondary: { school: 'Gingoog City Comprehensive National High School', year_graduated: '2012' },
        },
        training_rows: [{ course: 'Electrical Installation and Maintenance', duration: '2014', institution: 'TESDA Gingoog', certificate: 'NC II' }],
        license_rows: [{ license: 'TESDA EIM NC II', valid_until: '2027' }],
        work_rows: [{ company: 'Gingoog Builders', address: 'Gingoog City', position: 'Electrician Helper', dates: '01/2016 to 03/2023', status: 'Contractual' }],
        other_skills_checked: ['Electrician', 'Carpentry Work', 'Masonry'], other_skills_acquired: 'Electrician\nCarpentry Work\nMasonry',
      }),
      skills: ['Electrical Wiring', 'Carpentry', 'Welding', 'Cebuano Proficiency'],
      nsrp: { status: 'needs_revision', notes: 'Please add your SSS number and the dates of your TESDA training.' },
    },
    {
      // PESO-verified NSRP profile with no applications yet - use this account to demo one-tap applying.
      email: 'ana.bautista@example.com',
      password: 'Test@123',
      first_name: 'Ana', middle_name: 'Ramos', last_name: 'Bautista',
      date_of_birth: '2001-11-03', gender: 'female', civil_status: 'single',
      city: 'Tagoloan', province: 'Misamis Oriental',
      years_of_experience: 1, employment_status: 'unemployed',
      nsrp_full_data: nsrpData({
        place_of_birth: 'Tagoloan, Misamis Oriental', religion: 'Roman Catholic', height: '155 cm',
        cell_phone_number: '09201234570',
        house_street: 'Purok 1', barangay: 'Poblacion',
        employment_type: 'new entrant/fresh graduate', looking_duration: '1 month',
        preferred_occupation_list: ['Cook', 'Kitchen Helper', 'Baker', ''],
        preferred_work_location: 'local',
        local_location_list: ['Tagoloan', 'Cagayan de Oro City', 'Villanueva'],
        languages: { english: lang(true, false, false, true), filipino: lang(true, true, true, true), other: { name: 'Cebuano', ...lang(true, true, true, true) } },
        education: {
          elementary: { school: 'Tagoloan Central School', year_graduated: '2013' },
          secondary: { school: 'Tagoloan National High School', course: 'SHS TVL - Cookery', year_graduated: '2019' },
        },
        training_rows: [{ course: 'Cookery', duration: '06/2019 to 08/2019', institution: 'TESDA Misamis Oriental', certificate: 'NC II' }],
        work_rows: [{ company: 'Tagoloan Eatery', address: 'Tagoloan', position: 'Kitchen Helper (OJT)', dates: '03/2019 to 05/2019', status: 'OJT' }],
        other_skills_checked: ['Domestic Chores'], other_skills_acquired: 'Domestic Chores',
      }),
      skills: ['Cooking', 'Baking', 'Food and Beverage Service', 'Cebuano Proficiency', 'Teamwork'],
      nsrp: { status: 'verified' },
    },
  ];

  for (const seeker of seekerData) {
    const s = { ...seeker, ...normalizeNsrpProfile(seeker) };
    const pwHash = await hash(s.password);
    const [userRes] = await db.query(
      "INSERT INTO users (email, password_hash, role, account_status) VALUES (?, ?, 'job_seeker', 'active')",
      [s.email, pwHash]
    );
    const [jsRes] = await db.query(
      `INSERT INTO job_seekers
        (user_id, first_name, middle_name, last_name, date_of_birth, gender, civil_status,
         contact_number, address, city, province, education_level, course,
         years_of_experience, employment_status, preferred_occupation, nsrp_full_data, profile_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        userRes.insertId, s.first_name, s.middle_name, s.last_name, s.date_of_birth,
        s.gender, s.civil_status, s.contact_number, s.address, s.city, s.province,
        s.education_level, s.course, s.years_of_experience, s.employment_status,
        s.preferred_occupation, JSON.stringify(s.nsrp_full_data),
      ]
    );
    for (const skillName of s.skills) {
      const sid = skillByName[skillName];
      if (sid) {
        await db.query(
          'INSERT INTO job_seeker_skills (job_seeker_id, skill_id, proficiency_level) VALUES (?, ?, ?)',
          [jsRes.insertId, sid, 'intermediate']
        );
      }
    }

    // One-time PESO verification of the NSRP profile
    const reviewed = ['verified', 'needs_revision'].includes(s.nsrp.status);
    await db.query(
      `UPDATE job_seekers
       SET nsrp_status = ?, nsrp_review_notes = ?, nsrp_submitted_at = NOW(), nsrp_certified_at = NOW(),
           nsrp_reviewed_by = ?, nsrp_reviewed_at = ?, nsrp_reviewed_hash = ?
       WHERE id = ?`,
      [
        s.nsrp.status, s.nsrp.notes || null,
        reviewed ? adminUser.insertId : null, reviewed ? new Date() : null,
        s.nsrp.status === 'verified' ? await nsrpFingerprint(db, jsRes.insertId) : null,
        jsRes.insertId,
      ]
    );
  }
  console.log('[Seed] Job seekers created.');

  // 6. Employers (1 approved, 1 pending)
  const employerData = [
    {
      email: 'hr@techcorp.ph',
      password: 'Test@123',
      company_name: 'TechCorp Solutions Inc.',
      company_address: 'Centrio Business Park, Cagayan de Oro City',
      contact_person: 'Anna Villanueva', contact_number: '088-857-2000',
      business_type: 'Information Technology', company_size: 'medium',
      approval_status: 'approved',
      user_status: 'active',
    },
    {
      email: 'hr@northstar.ph',
      password: 'Test@123',
      company_name: 'Northstar Trading Corp.',
      company_address: 'Limketkai Center, Cagayan de Oro City',
      contact_person: 'Roberto Lim', contact_number: '088-857-3000',
      business_type: 'Retail / Trading', company_size: 'medium',
      approval_status: 'approved',
      user_status: 'active',
    },
    {
      email: 'hr@bluemountain.ph',
      password: 'Test@123',
      company_name: 'Blue Mountain Resort',
      company_address: 'Initao, Misamis Oriental',
      contact_person: 'Jenny Co', contact_number: '088-857-4000',
      business_type: 'Hospitality', company_size: 'small',
      approval_status: 'pending',
      user_status: 'pending',
    },
  ];

  const employerIds = {};
  const employerUserIds = {};
  for (const e of employerData) {
    const pwHash = await hash(e.password);
    const [userRes] = await db.query(
      "INSERT INTO users (email, password_hash, role, account_status) VALUES (?, ?, 'employer', ?)",
      [e.email, pwHash, e.user_status]
    );
    const [empRes] = await db.query(
      `INSERT INTO employers
        (user_id, company_name, company_address, contact_person, contact_number,
         business_type, company_size, approval_status, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userRes.insertId, e.company_name, e.company_address, e.contact_person,
        e.contact_number, e.business_type, e.company_size, e.approval_status,
        e.approval_status === 'approved' ? adminUser.insertId : null,
        e.approval_status === 'approved' ? new Date() : null,
      ]
    );
    employerIds[e.company_name] = empRes.insertId;
    employerUserIds[e.company_name] = userRes.insertId;
  }
  console.log('[Seed] Employers created.');

  // 7. Job posts (approved employers only)
  const jobs = [
    {
      employer: 'TechCorp Solutions Inc.',
      job_title: 'Junior Software Developer',
      job_description:
        'Join our growing dev team to build web applications and internal tools. Mentorship provided for fresh graduates.',
      job_type: 'full-time',
      salary_min: 20000, salary_max: 30000,
      location: 'Cagayan de Oro City',
      vacancies: 3,
      requirements: 'BS IT/CS graduate. Basic JavaScript and Python required.',
      application_email: 'careers@techcorp.ph',
      skills: ['Web Development', 'JavaScript', 'Python', 'Database Management'],
    },
    {
      employer: 'TechCorp Solutions Inc.',
      job_title: 'IT Support Staff',
      job_description: 'Provide technical support to in-house staff. Maintain workstations and basic networking.',
      job_type: 'full-time',
      salary_min: 15000, salary_max: 20000,
      location: 'Cagayan de Oro City',
      vacancies: 2,
      requirements: 'Vocational/College IT background. Familiar with troubleshooting.',
      application_email: 'careers@techcorp.ph',
      skills: ['Computer Literacy', 'Networking', 'Customer Service', 'Communication'],
    },
    {
      employer: 'Northstar Trading Corp.',
      job_title: 'Store Cashier',
      job_description: 'Handle point-of-sale transactions and customer assistance in our Limketkai branch.',
      job_type: 'full-time',
      salary_min: 12000, salary_max: 15000,
      location: 'Cagayan de Oro City',
      vacancies: 5,
      requirements: 'At least Senior High graduate. With customer service experience preferred.',
      skills: ['Cashiering', 'Customer Service', 'Communication', 'Cebuano Proficiency'],
    },
    {
      employer: 'Northstar Trading Corp.',
      job_title: 'Warehouse Inventory Clerk',
      job_description: 'Maintain accurate stock records, conduct physical counts, and assist warehouse operations.',
      job_type: 'full-time',
      salary_min: 14000, salary_max: 17000,
      location: 'Cagayan de Oro City',
      vacancies: 2,
      requirements: 'High school/vocational graduate. Attention to detail required.',
      skills: ['Inventory Management', 'Microsoft Office', 'Teamwork'],
    },
    {
      employer: 'Northstar Trading Corp.',
      job_title: 'Delivery Rider',
      job_description: 'Deliver customer orders from our Tagoloan hub to nearby municipalities. Company motorcycle provided.',
      job_type: 'full-time',
      salary_min: 13000, salary_max: 16000,
      location: 'Tagoloan, Misamis Oriental',
      vacancies: 4,
      requirements: "Valid driver's license with motorcycle restriction code. Familiar with Misamis Oriental routes.",
      skills: ['Motorcycle Delivery', 'Driving', 'Customer Service'],
    },
    {
      employer: 'Northstar Trading Corp.',
      job_title: 'Food Kiosk Cook',
      job_description: 'Prepare and serve meals at our El Salvador City food kiosk. Maintain kitchen cleanliness and food safety.',
      job_type: 'part-time',
      salary_min: 9000, salary_max: 12000,
      location: 'El Salvador City, Misamis Oriental',
      vacancies: 2,
      requirements: 'TESDA Cookery NC II preferred. Bring a valid ID when invited for interview.',
      skills: ['Cooking', 'Food and Beverage Service', 'Teamwork'],
    },
  ];

  const jobIds = [];
  for (const j of jobs) {
    const empId = employerIds[j.employer];
    const [jobRes] = await db.query(
      `INSERT INTO job_posts
        (employer_id, job_title, job_description, job_type, salary_min, salary_max,
         location, vacancies, requirements, application_email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        empId, j.job_title, j.job_description, j.job_type, j.salary_min,
        j.salary_max, j.location, j.vacancies, j.requirements, j.application_email || null,
      ]
    );
    jobIds.push(jobRes.insertId);

    for (const skillName of j.skills) {
      const sid = skillByName[skillName];
      if (sid) {
        await db.query(
          'INSERT INTO job_required_skills (job_post_id, skill_id, required_level) VALUES (?, ?, ?)',
          [jobRes.insertId, sid, 'beginner']
        );
      }
    }
  }
  console.log('[Seed] Job posts created.');

  // 8. Sample PESO-referred application (Maria's NSRP profile is PESO-verified)
  const [seekers] = await db.query('SELECT id, user_id, first_name, last_name FROM job_seekers ORDER BY id');
  const [maApp] = await db.query(
    `INSERT INTO job_applications
       (job_post_id, job_seeker_id, cover_letter, application_status, referral_status,
        referral_notes, referral_reviewed_by, referral_reviewed_at)
     VALUES (?, ?, ?, 'for_review', 'peso_referred', 'NSRP profile verified by PESO', ?, NOW())`,
    [jobIds[1], seekers[1].id, 'I would love to bring my organized work approach to your IT support team.', adminUser.insertId]
  );
  await db.query(
    `INSERT INTO application_status_history (application_id, status_type, old_status, new_status, changed_by, notes)
     VALUES (?, 'referral', NULL, 'peso_referred', ?, 'Applied with PESO referral - NSRP profile verified by PESO')`,
    [maApp.insertId, seekers[1].user_id]
  );

  console.log('[Seed] Sample applications created.');

  // 9. Sample notifications
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, is_read)
     VALUES (?, 'Welcome to PESO-Link MisOr', 'Your account is now active. Explore job opportunities!', 'system', FALSE)`,
    [seekers[0].user_id]
  );
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, is_read)
     VALUES (?, 'NSRP Profile PESO-Verified', 'PESO Misamis Oriental verified your NSRP profile. You can now apply to jobs with PESO referral.', 'nsrp_review', FALSE)`,
    [seekers[1].user_id]
  );

  console.log('[Seed] Notifications created.');
  console.log('\n========== SEED COMPLETE ==========');
  console.log('Admin:        admin@peso.gov.ph / Admin@123');
  console.log('Job Seeker 1: juan.cruz@example.com / Test@123 (NSRP submitted, waiting for PESO)');
  console.log('Job Seeker 2: maria.santos@example.com / Test@123 (PESO-verified, applied to IT Support)');
  console.log('Job Seeker 3: pedro.reyes@example.com / Test@123 (NSRP needs revision)');
  console.log('Job Seeker 4: ana.bautista@example.com / Test@123 (PESO-verified, no applications yet)');
  console.log('Employer 1:   hr@techcorp.ph / Test@123 (approved)');
  console.log('Employer 2:   hr@northstar.ph / Test@123 (approved)');
  console.log('Employer 3:   hr@bluemountain.ph / Test@123 (pending approval)');
  console.log('====================================\n');

  process.exit(0);
}

run().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
