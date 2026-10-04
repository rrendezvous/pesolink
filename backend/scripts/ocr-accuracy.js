'use strict';

// OCR accuracy check against the two sample NSRP pages in samples/nsrp-ocr.
// The expected values are what is printed on the sample forms. Prints each field as OK / WRONG / MISSING.
//   node scripts/ocr-accuracy.js
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const { recognizeNsrpImage, parseNsrpText } = require('../services/nsrpOcr');
const { normalizeNsrpProfile } = require('../services/nsrpForm');

const SAMPLES = path.join(__dirname, '..', '..', 'samples', 'nsrp-ocr');

// Every field of the sample form. "NA" on the paper form must come back blank ('').
const EXPECTED_PAGE1 = {
  // I. Personal information
  last_name: 'SANTOS', first_name: 'JUAN', middle_name: 'DELA CRUZ', 'full.suffix': '',
  date_of_birth: '2000-05-14', 'full.place_of_birth': 'CAGAYAN DE ORO CITY',
  gender: 'male', 'full.religion': '', civil_status: 'single',
  'full.house_street': '123 RIZAL STREET', 'full.village': 'GREEN VILLAGE', 'full.barangay': 'BARANGAY 1',
  city: 'CAGAYAN DE ORO CITY', province: 'MISAMIS ORIENTAL',
  'full.tin': '', 'full.gsis_sss_no': '', 'full.pagibig_no': '', 'full.philhealth_no': '',
  'full.height': '170 CM', 'full.email_address': 'juan.santos@example.com',
  'full.landline_number': '', 'full.cell_phone_number': '09171234567',
  employment_status: 'unemployed', 'full.employment_type': 'new entrant/fresh graduate',
  'full.looking_for_work': 'no', 'full.looking_duration': '1 MONTH',
  'full.willing_to_work_immediately': 'yes', 'full.available_when': '',
  'full.four_ps_beneficiary': 'no', 'full.household_id': '',
  // II. Job preference
  'list.preferred_occupation_list': ['SOFTWARE DEVELOPER', 'IT SUPPORT SPECIALIST', 'DATA ENCODER', 'ADMIN ASSISTANT'],
  'full.preferred_work_location': 'local',
  'list.local_location_list': ['CAGAYAN DE ORO CITY', 'MISAMIS ORIENTAL', 'ILIGAN CITY'],
  'list.overseas_location_list': [],
  'full.expected_salary': 'PHP 18,000 - 25,000', 'full.passport_number': '', 'full.passport_expiry': '',
  // III. Language / dialect proficiency (all four ticked for English and Filipino; Others empty)
  'lang.english': 'read,write,speak,understand', 'lang.filipino': 'read,write,speak,understand', 'lang.other': '',
};
const EXPECTED_PAGE2 = {
  // IV. Educational background
  'edu.elementary.school': 'East City Central School', 'edu.elementary.course': 'Elementary', 'edu.elementary.year_graduated': '2012',
  'edu.elementary.level_reached': '', 'edu.elementary.year_last_attended': '', 'edu.elementary.awards': '',
  'edu.secondary.school': 'Misamis Oriental Gen. Comprehensive HS', 'edu.secondary.course': 'Junior/Senior High', 'edu.secondary.year_graduated': '2018',
  'edu.secondary.level_reached': '', 'edu.secondary.year_last_attended': '', 'edu.secondary.awards': '',
  'edu.tertiary.school': 'USTP', 'edu.tertiary.course': 'BS Information Technology', 'edu.tertiary.year_graduated': '2026',
  'edu.tertiary.level_reached': '', 'edu.tertiary.year_last_attended': '', 'edu.tertiary.awards': '',
  'edu.graduate.school': '', 'edu.graduate.course': '', 'edu.graduate.year_graduated': '',
  // V. Training
  'training.0.course': 'Web Development Basics', 'training.0.duration': '01/2025 to 03/2025',
  'training.0.institution': 'USTP Extension', 'training.0.certificate': 'Certificate',
  'training.1.course': '', 'training.2.course': '',
  // VI. Eligibility / license (all NA)
  'full.eligibility_license': '',
  // VII. Work experience
  'work.0.company': 'USTP ICT Office', 'work.0.address': 'Cagayan de Oro', 'work.0.position': 'IT Intern',
  'work.0.dates': '06/2025 to 08/2025', 'work.0.status': 'Internship',
  'work.1.company': 'Freelance Client', 'work.1.address': 'Cagayan de Oro', 'work.1.position': 'Data Encoder',
  'work.1.dates': '01/2024 to 05/2024', 'work.1.status': 'Part-time',
  'work.2.company': '',
  // VIII. Other skills
  'skills.checked': ['Computer Literate', 'Photography'], 'skills.other': 'BASIC WEB DESIGN',
};

const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function pick(parsed, key) {
  const full = parsed.nsrp_full_data || {};
  const [kind, a, b] = key.split('.');
  if (kind === 'full') return full[a];
  if (kind === 'list') return (full[a] || []).filter(Boolean);
  if (kind === 'lang') {
    const row = full.languages?.[a] || {};
    return ['read', 'write', 'speak', 'understand'].filter((sk) => row[sk]).join(',');
  }
  if (kind === 'edu') return full.education?.[a]?.[b];
  if (kind === 'training') return full.training_rows?.[Number(a)]?.[b];
  if (kind === 'work') return full.work_rows?.[Number(a)]?.[b];
  if (key === 'skills.checked') return full.other_skills_checked || [];
  if (key === 'skills.other') return full.other_skills_other;
  return parsed[key];
}

async function run(file, expected) {
  const ocr = await recognizeNsrpImage(Tesseract, fs.readFileSync(path.join(SAMPLES, file)), {});
  const parsed = normalizeNsrpProfile(parseNsrpText(ocr.rawText, ocr.regions));
  let ok = 0;
  console.log(`\n== ${file} (page type: ${ocr.pageType || ocr.regions.__page_type})`);
  for (const [key, want] of Object.entries(expected)) {
    const got = pick(parsed, key);
    const good = Array.isArray(want)
      ? want.every((w) => (got || []).some((g) => norm(g) === norm(w))) && (got || []).length === want.length
      : norm(got) === norm(want);
    if (good) ok++;
    console.log(`  ${good ? 'OK     ' : (got && String(got).length ? 'WRONG  ' : 'MISSING')} ${key}: ${JSON.stringify(got)}${good ? '' : `  (expected ${JSON.stringify(want)})`}`);
  }
  console.log(`  -> ${ok}/${Object.keys(expected).length} fields correct`);
  return [ok, Object.keys(expected).length];
}

(async () => {
  const [a, n1] = await run('nsrp-page-1-sample.jpg', EXPECTED_PAGE1);
  const [b, n2] = await run('nsrp-page-2-sample.jpg', EXPECTED_PAGE2);
  console.log(`\nTOTAL ${a + b}/${n1 + n2} fields correct on the two sample pages`);
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
