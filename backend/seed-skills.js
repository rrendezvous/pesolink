// ============================================================
// Skills master list for rule-based skill matching
// Skills corresponding to the NSRP Form 1 (January 2017) Section VIII "Other Skills Acquired Without
// Formal Training" checklist share one category (NSRP_SECTION_VIII_CATEGORY); some names are adapted
// (marked "NSRP VIII: <form wording>"). Painter/Artist has no entry. The other skills were defined during
// development. The whole list is still to be confirmed with PESO Misamis Oriental.
// Non-destructive sync (keeps existing skill IDs, updates categories):
//   node seed-skills.js
// ============================================================

const NSRP_SECTION_VIII_CATEGORY = 'NSRP Section VIII-related skills';

const SKILLS = [
  // Information Technology
  ['Web Development', 'Information Technology'],
  ['JavaScript', 'Information Technology'],
  ['Python', 'Information Technology'],
  ['Database Management', 'Information Technology'],
  ['Networking', 'Information Technology'],
  ['Computer Hardware Servicing', 'Information Technology'],
  ['Computer Troubleshooting', 'Information Technology'],
  ['Graphic Design', 'Information Technology'],

  // Office / Administrative
  ['Microsoft Office', 'Office / Administrative'],
  ['Computer Literacy', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Computer Literate
  ['Data Encoding', 'Office / Administrative'],
  ['Bookkeeping', 'Office / Administrative'],
  ['Records Management', 'Office / Administrative'],
  ['Clerical Work', 'Office / Administrative'],
  ['Stenography', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII

  // Construction / Skilled Trades
  ['Carpentry', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Carpentry Work
  ['Masonry', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII
  ['Welding', 'Construction / Trades'],
  ['Electrical Wiring', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Electrician
  ['Plumbing', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII
  ['Painting', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Painting Jobs
  ['Heavy Equipment Operation', 'Construction / Trades'],
  ['Automotive Servicing', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Auto Mechanic

  // Manufacturing / Production
  ['Machine Operation', 'Manufacturing'],
  ['Quality Control', 'Manufacturing'],
  ['Food Processing', 'Manufacturing'],
  ['Packing and Labeling', 'Manufacturing'],

  // Agriculture / Fishery
  ['Crop Production', 'Agriculture / Fishery'],
  ['Livestock Raising', 'Agriculture / Fishery'],
  ['Aquaculture', 'Agriculture / Fishery'],
  ['Farm Machinery Operation', 'Agriculture / Fishery'],
  ['Gardening', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII

  // Hospitality / Tourism
  ['Cooking', 'Hospitality / Tourism'],
  ['Baking', 'Hospitality / Tourism'],
  ['Food and Beverage Service', 'Hospitality / Tourism'],
  ['Housekeeping', 'Hospitality / Tourism'],
  ['Front Desk Operations', 'Hospitality / Tourism'],
  ['Tour Guiding', 'Hospitality / Tourism'],

  // Healthcare
  ['Caregiving', 'Healthcare'],
  ['First Aid', 'Healthcare'],
  ['Patient Care', 'Healthcare'],
  ['Medical Records', 'Healthcare'],

  // Education / Training
  ['Tutoring', 'Education'],
  ['Lesson Planning', 'Education'],
  ['Classroom Management', 'Education'],
  ['Childcare', 'Education'],

  // Transportation / Logistics
  ['Driving', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Driver
  ['Motorcycle Delivery', 'Transportation / Logistics'],
  ['Forklift Operation', 'Transportation / Logistics'],
  ['Warehouse Operations', 'Transportation / Logistics'],
  ['Inventory Management', 'Transportation / Logistics'],

  // Retail / Sales
  ['Sales', 'Retail / Sales'],
  ['Cashiering', 'Retail / Sales'],
  ['Merchandising', 'Retail / Sales'],
  ['Customer Service', 'Retail / Sales'],

  // Garments / Personal Services / Creative
  ['Dressmaking', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Sewing Dresses
  ['Tailoring', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII
  ['Embroidery', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII
  ['Beauty Care', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Beautician
  ['Domestic Work', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII: Domestic Chores
  ['Photography', NSRP_SECTION_VIII_CATEGORY], // NSRP VIII

  // Language
  ['English Proficiency', 'Language'],
  ['Tagalog Proficiency', 'Language'],
  ['Cebuano Proficiency', 'Language'],

  // Soft Skills
  ['Communication', 'Soft Skills'],
  ['Teamwork', 'Soft Skills'],
  ['Problem Solving', 'Soft Skills'],
];

async function syncSkills(db) {
  for (const [name, category] of SKILLS) {
    await db.query(
      `INSERT INTO skills (skill_name, category) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE category = VALUES(category)`,
      [name, category]
    );
  }
}

module.exports = { SKILLS, NSRP_SECTION_VIII_CATEGORY, syncSkills };

if (require.main === module) {
  const db = require('./db');
  syncSkills(db)
    .then(() => {
      console.log(`[Skills] Synced ${SKILLS.length} skills.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Skills] Sync failed:', err.message);
      process.exit(1);
    });
}
