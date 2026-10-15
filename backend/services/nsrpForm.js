'use strict';

// ============================================================
// NSRP Form 1 (DOLE, January 2017) structure
// The app stores the form's tables as structured rows in nsrp_full_data and keeps the older
// summary text fields (elementary_background, trainings, work_experience, ...) filled from them,
// so the required-items check, employer/admin views, and older profiles keep working.
// Summary text is only rebuilt when the structured rows have content, so profiles encoded
// before this structure keep their free-text answers.
// ============================================================

const EDUCATION_LEVELS = [
  { key: 'elementary', label: 'Elementary', legacy: 'elementary_background' },
  { key: 'secondary', label: 'Secondary', legacy: 'secondary_background' },
  { key: 'tertiary', label: 'Tertiary', legacy: 'tertiary_background' },
  { key: 'graduate', label: 'Graduate Studies', legacy: 'graduate_studies_background' },
];

const LANGUAGES = [
  { key: 'english', label: 'English' },
  { key: 'filipino', label: 'Filipino' },
  { key: 'other', label: 'Others' },
];
const LANGUAGE_SKILLS = ['read', 'write', 'speak', 'understand'];

const text = (v) => String(v ?? '').trim();
const filled = (obj) => Object.values(obj || {}).some((v) => (typeof v === 'boolean' ? v : text(v) !== ''));
const rowsOf = (rows) => (Array.isArray(rows) ? rows.filter(filled) : []);
const join = (parts, sep = ', ') => parts.map(text).filter(Boolean).join(sep);

function educationLine(level, row) {
  return join([
    row.school,
    row.course,
    text(row.year_graduated) && `Graduated ${text(row.year_graduated)}`,
    text(row.level_reached) && `Level reached: ${text(row.level_reached)}`,
    text(row.year_last_attended) && `Last attended ${text(row.year_last_attended)}`,
    text(row.awards) && `Awards: ${text(row.awards)}`,
  ]);
}

// NSRP Form 1 asks for answers in block letters. These free-text answers are saved in capitals (Ñ and
// other letters keep their marks: JavaScript's toUpperCase turns ñ into Ñ). Everything else is kept as
// typed: email, phone and ID numbers, height/weight, dates, salary and other numbers, fixed choices and
// checkboxes, skills picked from the catalog, and anything outside the NSRP form (job posts, employer
// company profiles, cover letters, admin notes). Existing records change only on the job seeker's next save.
const BLOCK_LETTER_BASE = ['first_name', 'middle_name', 'last_name', 'city', 'province'];
const BLOCK_LETTER_FULL = [
  'suffix', 'place_of_birth', 'religion', 'house_street', 'village', 'barangay',
  'disability_other', 'employment_type_other', 'terminated_abroad_country', 'available_when',
  'preferred_occupations', 'preferred_local_locations', 'preferred_overseas_locations', 'other_skills_other',
];
const BLOCK_LETTER_LISTS = ['preferred_occupation_list', 'local_location_list', 'overseas_location_list'];
const BLOCK_LETTER_ROWS = {
  training_rows: ['course', 'institution', 'certificate'],
  eligibility_rows: ['eligibility'],
  license_rows: ['license'],
  work_rows: ['company', 'address', 'position'],
};
const BLOCK_LETTER_EDUCATION = ['school', 'course', 'level_reached', 'awards'];

const caps = (v) => (typeof v === 'string' ? v.toUpperCase() : v);
// The app writes the "Others, specify" answer as the LAST item of a checklist summary
// (disability: "Visual, <text>"; Section VIII: "Auto Mechanic\nOthers: <text>"). Only that item is
// capitalized, never the same letters inside other items (e.g. "car" must not change "Carpentry Work").
function capsLastItem(summary, original, sep, label = '') {
  if (typeof summary !== 'string' || typeof original !== 'string' || !original.trim()) return summary;
  const item = `${label}${original.trim()}`;
  const upperItem = `${label}${original.trim().toUpperCase()}`;
  if (summary.toLowerCase() === item.toLowerCase()) return upperItem;
  const tail = `${sep}${item}`;
  if (summary.toLowerCase().endsWith(tail.toLowerCase())) return `${summary.slice(0, summary.length - tail.length)}${sep}${upperItem}`;
  return summary;
}

function toBlockLetters(profile) {
  const base = { ...profile };
  for (const k of BLOCK_LETTER_BASE) base[k] = caps(base[k]);
  if (!base.nsrp_full_data || typeof base.nsrp_full_data !== 'object') return base;
  const full = { ...base.nsrp_full_data };
  full.disability = capsLastItem(full.disability, full.disability_other, ', ');
  full.other_skills_acquired = capsLastItem(full.other_skills_acquired, full.other_skills_other, '\n', 'Others: ');
  for (const k of BLOCK_LETTER_FULL) full[k] = caps(full[k]);
  for (const k of BLOCK_LETTER_LISTS) if (Array.isArray(full[k])) full[k] = full[k].map(caps);
  for (const [k, fields] of Object.entries(BLOCK_LETTER_ROWS)) {
    if (Array.isArray(full[k])) {
      full[k] = full[k].map((row) => {
        if (!row || typeof row !== 'object') return row;
        const next = { ...row };
        for (const f of fields) next[f] = caps(next[f]);
        return next;
      });
    }
  }
  if (full.education && typeof full.education === 'object') {
    full.education = Object.fromEntries(Object.entries(full.education).map(([level, row]) => {
      if (!row || typeof row !== 'object') return [level, row];
      const next = { ...row };
      for (const f of BLOCK_LETTER_EDUCATION) next[f] = caps(next[f]);
      return [level, next];
    }));
  }
  if (full.languages && typeof full.languages === 'object' && full.languages.other && typeof full.languages.other === 'object') {
    full.languages = { ...full.languages, other: { ...full.languages.other, name: caps(full.languages.other.name) } };
  }
  base.nsrp_full_data = full;
  return base;
}

// Fills summary fields from the structured form rows. `profile` has the base columns plus nsrp_full_data.
function normalizeNsrpProfile(profile) {
  const full = { ...(profile.nsrp_full_data || {}) };
  const base = { ...profile };

  // I. Personal information: the summary address and contact number follow the form's own fields.
  // (Checklist summaries such as disability and other skills are written by the app with the checklist.)
  const street = join([full.house_street, full.village, full.barangay]);
  if (street) base.address = street;
  const phone = text(full.cell_phone_number) || text(full.landline_number);
  if (phone) base.contact_number = phone;

  // II. Job preference
  if (Array.isArray(full.preferred_occupation_list) && full.preferred_occupation_list.some(text)) {
    const list = full.preferred_occupation_list.map(text).filter(Boolean);
    full.preferred_occupations = list.join('\n');
    base.preferred_occupation = list[0];
  }
  if (Array.isArray(full.local_location_list) && full.local_location_list.some(text)) {
    full.preferred_local_locations = full.local_location_list.map(text).filter(Boolean).join('\n');
  }
  if (Array.isArray(full.overseas_location_list) && full.overseas_location_list.some(text)) {
    full.preferred_overseas_locations = full.overseas_location_list.map(text).filter(Boolean).join('\n');
  }

  // III. Language / dialect proficiency
  if (full.languages && typeof full.languages === 'object') {
    const lines = LANGUAGES.map(({ key, label }) => {
      const row = full.languages[key] || {};
      const skills = LANGUAGE_SKILLS.filter((s) => row[s]);
      const name = key === 'other' ? text(row.name) : label;
      return name && skills.length ? `${name}: ${skills.join(', ')}` : '';
    }).filter(Boolean);
    if (lines.length) {
      full.language_dialect = lines.map((l) => l.split(':')[0]).join(', ');
      full.language_proficiency = lines.join('\n');
    }
  }

  // IV. Educational background
  if (full.education && typeof full.education === 'object') {
    let highest = null;
    for (const level of EDUCATION_LEVELS) {
      const row = full.education[level.key] || {};
      if (filled(row)) {
        full[level.legacy] = educationLine(level.label, row);
        highest = { level, row };
      }
    }
    if (highest) {
      const undergrad = text(highest.row.level_reached) && !text(highest.row.year_graduated);
      base.education_level = `${highest.level.label}${undergrad ? ' (undergraduate)' : ' graduate'}`;
      if (text(highest.row.course)) base.course = text(highest.row.course);
    }
  }

  // V-VII. Training, eligibility / license, work experience
  const training = rowsOf(full.training_rows);
  if (training.length) {
    // "NC II" reads as "Certificate: NC II"; a cell that already says "Certificate ..." is kept as written.
    const certificate = (value) => (/certificate/i.test(text(value)) ? text(value) : text(value) && `Certificate: ${text(value)}`);
    full.trainings = training.map((r) => join([r.course, r.duration, r.institution, certificate(r.certificate)])).join('\n');
  }
  const eligibility = rowsOf(full.eligibility_rows);
  const licenses = rowsOf(full.license_rows);
  if (eligibility.length || licenses.length) {
    full.eligibility_license = [
      ...eligibility.map((r) => join([r.eligibility, text(r.rating) && `Rating ${text(r.rating)}`, text(r.exam_date) && `Exam ${text(r.exam_date)}`])),
      ...licenses.map((r) => join([r.license, text(r.valid_until) && `Valid until ${text(r.valid_until)}`])),
    ].join('\n');
  }
  const work = rowsOf(full.work_rows);
  if (work.length) {
    full.work_experience = work.map((r) => join([r.company, r.address, r.position, r.dates, r.status])).join('\n');
  }

  base.nsrp_full_data = full;
  return base;
}

// Date of birth is entered as YYYY-MM-DD and must be a real calendar date (MySQL rejects 2000-13-40).
// Returns an error message, or null when the value is blank or valid.
function dateOfBirthError(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    return 'Date of birth must be a real date (mm/dd/yyyy on the NSRP form; sent as YYYY-MM-DD)';
  }
  // No minimum age is applied; only a date after today is refused (server's local date).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (v > today) return 'Date of birth cannot be in the future';
  return null;
}

// Base columns the app fills from other NSRP fields; left out of the change fingerprint so that
// re-deriving them never counts as the job seeker changing their profile.
const DERIVED_COLUMNS = ['address', 'contact_number', 'education_level', 'course', 'preferred_occupation'];

module.exports = {
  normalizeNsrpProfile, toBlockLetters, EDUCATION_LEVELS, LANGUAGES, LANGUAGE_SKILLS, DERIVED_COLUMNS, dateOfBirthError,
};
