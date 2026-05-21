// ============================================================
// Seed Demo Data for IT323 Demonstration
// ============================================================
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('./db');

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
    [adminUser.insertId, 'PESO MisOr Administrator', 'PESO Officer-in-Charge', '088-857-1234']
  );
  console.log('[Seed] Admin created: admin@peso.gov.ph / Admin@123');

  // 4. Skills master list
  const skills = [
    ['Customer Service', 'Soft Skills'],
    ['Communication', 'Soft Skills'],
    ['Teamwork', 'Soft Skills'],
    ['Microsoft Office', 'Computer'],
    ['Computer Literacy', 'Computer'],
    ['Web Development', 'IT'],
    ['JavaScript', 'IT'],
    ['Python', 'IT'],
    ['Database Management', 'IT'],
    ['Networking', 'IT'],
    ['Carpentry', 'Trade'],
    ['Welding', 'Trade'],
    ['Electrical Wiring', 'Trade'],
    ['Plumbing', 'Trade'],
    ['Driving', 'Trade'],
    ['Cooking', 'Food Service'],
    ['Baking', 'Food Service'],
    ['Sales', 'Business'],
    ['Bookkeeping', 'Business'],
    ['English Proficiency', 'Language'],
    ['Tagalog Proficiency', 'Language'],
    ['Cebuano Proficiency', 'Language'],
    ['Cashiering', 'Retail'],
    ['Inventory Management', 'Retail'],
    ['Caregiving', 'Healthcare'],
  ];
  for (const [name, cat] of skills) {
    await db.query('INSERT IGNORE INTO skills (skill_name, category) VALUES (?, ?)', [name, cat]);
  }
  console.log('[Seed] Skills seeded.');

  const [skillRows] = await db.query('SELECT id, skill_name FROM skills');
  const skillByName = {};
  skillRows.forEach((s) => (skillByName[s.skill_name] = s.id));

  // 5. Job seekers
  const seekerData = [
    {
      email: 'juan.cruz@example.com',
      password: 'Test@123',
      first_name: 'Juan', middle_name: 'Dela', last_name: 'Cruz',
      date_of_birth: '1998-05-15', gender: 'male', civil_status: 'single',
      contact_number: '09171234567', address: 'Purok 3, Brgy. San Isidro',
      city: 'Cagayan de Oro', province: 'Misamis Oriental',
      education_level: 'College Graduate', course: 'BS Information Technology',
      years_of_experience: 2, employment_status: 'unemployed',
      preferred_occupation: 'Software Developer',
      skills: ['Web Development', 'JavaScript', 'Python', 'Database Management', 'English Proficiency'],
    },
    {
      email: 'maria.santos@example.com',
      password: 'Test@123',
      first_name: 'Maria', middle_name: 'Lopez', last_name: 'Santos',
      date_of_birth: '2000-08-22', gender: 'female', civil_status: 'single',
      contact_number: '09181234568', address: 'Zone 4, Brgy. Macabalan',
      city: 'Cagayan de Oro', province: 'Misamis Oriental',
      education_level: 'College Graduate', course: 'BS Business Administration',
      years_of_experience: 1, employment_status: 'underemployed',
      preferred_occupation: 'Office Staff',
      skills: ['Microsoft Office', 'Customer Service', 'Bookkeeping', 'Communication', 'English Proficiency'],
    },
    {
      email: 'pedro.reyes@example.com',
      password: 'Test@123',
      first_name: 'Pedro', middle_name: 'Garcia', last_name: 'Reyes',
      date_of_birth: '1995-03-10', gender: 'male', civil_status: 'married',
      contact_number: '09191234569', address: 'Sitio Bagong Silang',
      city: 'Gingoog', province: 'Misamis Oriental',
      education_level: 'TESDA NC II', course: 'Electrical Installation',
      years_of_experience: 5, employment_status: 'unemployed',
      preferred_occupation: 'Electrician',
      skills: ['Electrical Wiring', 'Carpentry', 'Welding', 'Cebuano Proficiency'],
    },
  ];

  for (const s of seekerData) {
    const pwHash = await hash(s.password);
    const [userRes] = await db.query(
      "INSERT INTO users (email, password_hash, role, account_status) VALUES (?, ?, 'job_seeker', 'active')",
      [s.email, pwHash]
    );
    const [jsRes] = await db.query(
      `INSERT INTO job_seekers
        (user_id, first_name, middle_name, last_name, date_of_birth, gender, civil_status,
         contact_number, address, city, province, education_level, course,
         years_of_experience, employment_status, preferred_occupation, profile_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        userRes.insertId, s.first_name, s.middle_name, s.last_name, s.date_of_birth,
        s.gender, s.civil_status, s.contact_number, s.address, s.city, s.province,
        s.education_level, s.course, s.years_of_experience, s.employment_status,
        s.preferred_occupation,
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
  ];

  const jobIds = [];
  for (const j of jobs) {
    const empId = employerIds[j.employer];
    const [jobRes] = await db.query(
      `INSERT INTO job_posts
        (employer_id, job_title, job_description, job_type, salary_min, salary_max,
         location, vacancies, requirements, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        empId, j.job_title, j.job_description, j.job_type, j.salary_min,
        j.salary_max, j.location, j.vacancies, j.requirements,
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

  // 8. Sample applications
  const [seekers] = await db.query('SELECT id, user_id, first_name, last_name FROM job_seekers');
  // Juan applies for Junior Dev
  await db.query(
    `INSERT INTO job_applications (job_post_id, job_seeker_id, cover_letter, application_status)
     VALUES (?, ?, ?, 'pending')`,
    [jobIds[0], seekers[0].id, 'I am a passionate IT graduate eager to learn and contribute.']
  );
  // Maria applies for IT Support (for_review)
  const [maApp] = await db.query(
    `INSERT INTO job_applications (job_post_id, job_seeker_id, cover_letter, application_status)
     VALUES (?, ?, ?, 'for_review')`,
    [jobIds[1], seekers[1].id, 'I would love to bring my organized work approach to your IT support team.']
  );
  await db.query(
    `INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, notes)
     VALUES (?, 'pending', 'for_review', ?, 'Promising candidate, scheduled for review')`,
    [maApp.insertId, adminUser.insertId]
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
     VALUES (?, 'Application Status Updated', 'Your application for "IT Support Staff" is now for review.', 'application_status', FALSE)`,
    [seekers[1].user_id]
  );

  console.log('[Seed] Notifications created.');
  console.log('\n========== SEED COMPLETE ==========');
  console.log('Admin:        admin@peso.gov.ph / Admin@123');
  console.log('Job Seeker 1: juan.cruz@example.com / Test@123');
  console.log('Job Seeker 2: maria.santos@example.com / Test@123');
  console.log('Job Seeker 3: pedro.reyes@example.com / Test@123');
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
