// ============================================================
// Skills master list for rule-based skill matching
// Covers common PESO Misamis Oriental job categories, plus every item in the NSRP Form 1
// "Other Skills Acquired Without Formal Training" checklist (marked "NSRP VIII").
// Still to be confirmed with PESO Misamis Oriental before it is treated as final.
// Non-destructive sync (keeps existing skill IDs, updates categories):
//   node seed-skills.js
// ============================================================

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
  ['Computer Literacy', 'Office / Administrative'],
  ['Data Encoding', 'Office / Administrative'],
  ['Bookkeeping', 'Office / Administrative'],
  ['Records Management', 'Office / Administrative'],
  ['Clerical Work', 'Office / Administrative'],
  ['Stenography', 'Office / Administrative'], // NSRP VIII

  // Construction / Skilled Trades
  ['Carpentry', 'Construction / Trades'],
  ['Masonry', 'Construction / Trades'],
  ['Welding', 'Construction / Trades'],
  ['Electrical Wiring', 'Construction / Trades'],
  ['Plumbing', 'Construction / Trades'],
  ['Painting', 'Construction / Trades'],
  ['Heavy Equipment Operation', 'Construction / Trades'],
  ['Automotive Servicing', 'Construction / Trades'], // NSRP VIII: Auto Mechanic

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
  ['Gardening', 'Agriculture / Fishery'], // NSRP VIII

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
  ['Driving', 'Transportation / Logistics'],
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
  ['Dressmaking', 'Garments'], // NSRP VIII: Sewing Dresses
  ['Tailoring', 'Garments'], // NSRP VIII
  ['Embroidery', 'Garments'], // NSRP VIII
  ['Beauty Care', 'Personal Services'], // NSRP VIII: Beautician
  ['Domestic Work', 'Personal Services'], // NSRP VIII: Domestic Chores
  ['Photography', 'Creative / Media'], // NSRP VIII

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

module.exports = { SKILLS, syncSkills };

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
