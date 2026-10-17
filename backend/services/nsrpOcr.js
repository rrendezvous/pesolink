'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { fitPageTransform, sampleRegion, mapFraction } = require('./nsrpAlign');

const OCR_TIMEOUT_MS = 180000;
const OCR_LANG_PATH = path.resolve(__dirname, '..');
const OCR_CACHE_PATH = path.resolve(__dirname, '..', '.tesseract-cache');

const SURNAME_LABEL_BASELINE_Y = 0.200;
const FILTERED_TESSERACT_NATIVE_WARNINGS = [
  /Error in boxClipToRectangle: box outside rectangle/,
  /Error in pixScanForForeground: invalid box/,
];
let stderrFilterDepth = 0;
let originalStderrWrite = null;

function startTesseractWarningFilter() {
  if (!process?.stderr?.write) return () => {};
  if (stderrFilterDepth === 0) {
    originalStderrWrite = process.stderr.write;
    process.stderr.write = function filteredTesseractStderr(chunk, ...args) {
      const message = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
      if (FILTERED_TESSERACT_NATIVE_WARNINGS.some((pattern) => pattern.test(message))) {
        const callback = args.find((arg) => typeof arg === 'function');
        if (callback) callback();
        return true;
      }
      return originalStderrWrite.call(this, chunk, ...args);
    };
  }
  stderrFilterDepth += 1;
  return () => {
    stderrFilterDepth = Math.max(0, stderrFilterDepth - 1);
    if (stderrFilterDepth === 0 && originalStderrWrite) {
      process.stderr.write = originalStderrWrite;
      originalStderrWrite = null;
    }
  };
}

const PAGE1_REGION_SPECS = {
  surname: { region: [0.050, 0.170, 0.200, 0.028], mode: 'image' },
  first_name: { region: [0.260, 0.170, 0.240, 0.028], mode: 'image', psm: 'SINGLE_BLOCK' },
  middle_name: { region: [0.510, 0.170, 0.240, 0.028], mode: 'image' },
  suffix: { region: [0.760, 0.170, 0.200, 0.028], mode: 'image' },

  date_of_birth: { region: [0.270, 0.208, 0.205, 0.027], mode: 'image' },
  place_of_birth: { region: [0.700, 0.208, 0.280, 0.027], mode: 'image' },
  religion: { region: [0.140, 0.242, 0.120, 0.027], mode: 'image' },

  house_street: { region: [0.700, 0.246, 0.220, 0.018], mode: 'image' },
  village: { region: [0.700, 0.252, 0.220, 0.024], mode: 'image' },
  barangay: { region: [0.700, 0.268, 0.220, 0.018], mode: 'image' },
  city: { region: [0.700, 0.286, 0.220, 0.024], mode: 'image' },
  province: { region: [0.700, 0.303, 0.220, 0.024], mode: 'image' },

  tin: { region: [0.145, 0.322, 0.330, 0.024], mode: 'binary', psm: 'SINGLE_LINE', scale: 7, expand: 0.001 },
  gsis_sss_no: { region: [0.205, 0.339, 0.270, 0.024], mode: 'binary', psm: 'SINGLE_LINE', scale: 7, expand: 0.001 },
  pagibig_no: { region: [0.205, 0.355, 0.270, 0.024], mode: 'binary', psm: 'SINGLE_LINE', scale: 7, expand: 0.001 },
  philhealth_no: { region: [0.205, 0.372, 0.270, 0.024], mode: 'binary', psm: 'SINGLE_LINE', scale: 7, expand: 0.001 },

  height: { region: [0.730, 0.322, 0.250, 0.024], mode: 'image' },
  email_address: { region: [0.720, 0.337, 0.260, 0.028], mode: 'image' },
  landline_number: { region: [0.730, 0.355, 0.250, 0.024], mode: 'image' },
  cell_phone_number: { region: [0.730, 0.372, 0.250, 0.024], mode: 'image' },

  disability_other: { region: [0.610, 0.392, 0.250, 0.026], mode: 'image', psm: 'SINGLE_LINE' },

  preferred_occupation_1: { region: [0.085, 0.658, 0.220, 0.027], mode: 'image', psm: 'SINGLE_LINE' },
  preferred_occupation_2: { region: [0.085, 0.685, 0.220, 0.027], mode: 'image', psm: 'SINGLE_LINE' },
  preferred_occupation_3: { region: [0.085, 0.712, 0.220, 0.027], mode: 'image', psm: 'SINGLE_LINE' },
  preferred_occupation_4: { region: [0.085, 0.738, 0.220, 0.027], mode: 'image', psm: 'SINGLE_LINE' },

  preferred_local_location_1: { region: [0.345, 0.685, 0.235, 0.027], mode: 'image', psm: 'SINGLE_LINE' },
  preferred_local_location_2: { region: [0.345, 0.712, 0.235, 0.027], mode: 'image', psm: 'SINGLE_LINE' },
  preferred_local_location_3: { region: [0.345, 0.738, 0.235, 0.027], mode: 'image', psm: 'SINGLE_LINE' },
  preferred_overseas_location_1: { region: [0.625, 0.685, 0.250, 0.027], mode: 'image', psm: 'SINGLE_LINE' },
  preferred_overseas_location_2: { region: [0.625, 0.712, 0.250, 0.027], mode: 'image', psm: 'SINGLE_LINE' },
  preferred_overseas_location_3: { region: [0.625, 0.738, 0.250, 0.027], mode: 'image', psm: 'SINGLE_LINE' },

  expected_salary: { region: [0.270, 0.765, 0.170, 0.024], mode: 'image', psm: 'SINGLE_LINE' },
  passport_number: { region: [0.585, 0.765, 0.110, 0.024], mode: 'image', psm: 'SINGLE_LINE' },
  passport_expiry: { region: [0.835, 0.765, 0.130, 0.024], mode: 'image', psm: 'SINGLE_LINE' },

  // Answers written on the lines after the Yes/No questions
  looking_duration: { region: [0.875, 0.565, 0.120, 0.022], mode: 'image', psm: 'SINGLE_LINE' },
  available_when: { region: [0.540, 0.586, 0.300, 0.022], mode: 'image', psm: 'SINGLE_LINE' },
  household_id: { region: [0.555, 0.608, 0.220, 0.022], mode: 'image', psm: 'SINGLE_LINE' },

  language_english: { region: [0.050, 0.828, 0.900, 0.025], mode: 'image' },
  language_filipino: { region: [0.050, 0.855, 0.900, 0.020], mode: 'image' },
};

const PAGE2_REGION_SPECS = {
  elementary_school: { region: [0.160, 0.080, 0.260, 0.018], mode: 'image' },
  elementary_course: { region: [0.430, 0.080, 0.170, 0.018], mode: 'image' },
  elementary_year: { region: [0.605, 0.080, 0.080, 0.018], mode: 'image' },
  elementary_level: { region: [0.690, 0.080, 0.100, 0.018], mode: 'image' },
  elementary_last_attended: { region: [0.790, 0.080, 0.080, 0.018], mode: 'image' },
  elementary_awards: { region: [0.870, 0.080, 0.070, 0.018], mode: 'image' },

  secondary_school: { region: [0.160, 0.110, 0.260, 0.018], mode: 'image' },
  secondary_course: { region: [0.430, 0.110, 0.170, 0.018], mode: 'image' },
  secondary_year: { region: [0.605, 0.110, 0.080, 0.018], mode: 'image' },
  secondary_level: { region: [0.690, 0.110, 0.100, 0.018], mode: 'image' },
  secondary_last_attended: { region: [0.790, 0.110, 0.080, 0.018], mode: 'image' },
  secondary_awards: { region: [0.870, 0.110, 0.070, 0.018], mode: 'image' },

  tertiary_school: { region: [0.160, 0.135, 0.260, 0.018], mode: 'image' },
  tertiary_course: { region: [0.430, 0.135, 0.170, 0.018], mode: 'image' },
  tertiary_year: { region: [0.605, 0.135, 0.080, 0.018], mode: 'image' },
  tertiary_level: { region: [0.690, 0.135, 0.100, 0.018], mode: 'image' },
  tertiary_last_attended: { region: [0.790, 0.135, 0.080, 0.018], mode: 'image' },
  tertiary_awards: { region: [0.870, 0.135, 0.070, 0.018], mode: 'image' },

  graduate_school: { region: [0.160, 0.166, 0.260, 0.018], mode: 'image' },
  graduate_course: { region: [0.430, 0.166, 0.170, 0.018], mode: 'image' },
  graduate_year: { region: [0.605, 0.166, 0.080, 0.018], mode: 'image' },
  graduate_level: { region: [0.690, 0.166, 0.100, 0.018], mode: 'image' },
  graduate_last_attended: { region: [0.790, 0.166, 0.080, 0.018], mode: 'image' },
  graduate_awards: { region: [0.870, 0.166, 0.070, 0.018], mode: 'image' },

  training_1_course: { region: [0.070, 0.230, 0.335, 0.018], mode: 'image' },
  training_1_duration: { region: [0.405, 0.230, 0.142, 0.018], mode: 'image' },
  training_1_institution: { region: [0.550, 0.230, 0.215, 0.018], mode: 'image' },
  training_1_certificate: { region: [0.770, 0.230, 0.170, 0.018], mode: 'image' },

  work_1_company: { region: [0.080, 0.419, 0.145, 0.018], mode: 'image', psm: 'SINGLE_LINE' },
  work_1_address: { region: [0.230, 0.419, 0.170, 0.018], mode: 'image', psm: 'SINGLE_LINE' },
  work_1_position: { region: [0.410, 0.419, 0.165, 0.018], mode: 'image', psm: 'SINGLE_LINE' },
  work_1_dates: { region: [0.590, 0.419, 0.170, 0.018], mode: 'image', psm: 'SINGLE_LINE' },
  work_1_status: { region: [0.775, 0.419, 0.160, 0.018], mode: 'image', psm: 'SINGLE_LINE' },

  work_2_company: { region: [0.080, 0.434, 0.145, 0.018], mode: 'image', psm: 'SINGLE_LINE' },
  work_2_address: { region: [0.230, 0.434, 0.170, 0.018], mode: 'image', psm: 'SINGLE_LINE' },
  work_2_position: { region: [0.410, 0.434, 0.165, 0.018], mode: 'image', psm: 'SINGLE_LINE' },
  work_2_dates: { region: [0.590, 0.434, 0.170, 0.018], mode: 'image', psm: 'SINGLE_LINE' },
  work_2_status: { region: [0.775, 0.434, 0.160, 0.018], mode: 'image', psm: 'SINGLE_LINE' },

  other_skills_other_text: { region: [0.710, 0.600, 0.205, 0.024], mode: 'image' },
};

const REGION_SPECS = {
  page1: PAGE1_REGION_SPECS,
  page2: PAGE2_REGION_SPECS,
};

// Answer cells of the blank NSRP Form 1, in pixels of the form at 150 dpi (1240 x 1754), taken from its
// ruled lines: [left, top, right, bottom, layout]. Used when the form was located on the image; the printed
// form is erased from each cell first, so a cell may be generous.
const cellSpecs = (cells) => Object.fromEntries(Object.entries(cells).map(([name, [x0, y0, x1, y1, psm]]) => [
  name, { region: [x0 / 1240, y0 / 1754, (x1 - x0) / 1240, (y1 - y0) / 1754], ...(psm ? { psm } : {}) },
]));
const LINE = 'SINGLE_LINE';
const BLOCK = 'SINGLE_BLOCK';
// Characters each kind of field can contain. Reading a date as digits only, for example, keeps the reader
// from turning a written 0 into an O or a 6 into a G.
const DIGITS = '0123456789';
const FIELD_CHARS = {
  date_of_birth: `${DIGITS}/-`,
  passport_expiry: `${DIGITS}/-NA`,
  cell_phone_number: `${DIGITS}-+`,
  landline_number: `${DIGITS}-()NA`,
  email_address: `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ${DIGITS}@._-+`,
  tin: `${DIGITS}-NA`,
  gsis_sss_no: `${DIGITS}-NA`,
  pagibig_no: `${DIGITS}-NA`,
  philhealth_no: `${DIGITS}-NA`,
  household_id: `${DIGITS}-NA`,
  height: `${DIGITS}.'"CMFTcmftNA `,
};
for (const lv of ['elementary', 'secondary', 'tertiary', 'graduate']) {
  FIELD_CHARS[`${lv}_year`] = `${DIGITS}NA/`;
  FIELD_CHARS[`${lv}_last_attended`] = `${DIGITS}NA/`;
}
const ALIGNED_REGION_SPECS = {
  page1: cellSpecs({
    surname: [62, 290, 330, 346, BLOCK], first_name: [330, 290, 620, 346, BLOCK],
    middle_name: [620, 290, 900, 346, BLOCK], suffix: [900, 290, 1180, 346, BLOCK],
    date_of_birth: [340, 374, 656, 400, LINE], place_of_birth: [858, 374, 1181, 400, LINE],
    religion: [160, 432, 349, 476, BLOCK],
    house_street: [859, 432, 1181, 455, LINE], village: [859, 455, 1181, 477, LINE],
    barangay: [859, 478, 1181, 506, LINE], city: [859, 507, 1181, 535, LINE], province: [859, 536, 1181, 564, LINE],
    tin: [252, 565, 656, 593, LINE], gsis_sss_no: [252, 594, 656, 622, LINE],
    pagibig_no: [252, 623, 656, 651, LINE], philhealth_no: [252, 652, 656, 680, LINE],
    height: [918, 565, 1181, 593, LINE], email_address: [918, 594, 1181, 622, LINE],
    landline_number: [918, 623, 1181, 651, LINE], cell_phone_number: [918, 652, 1181, 680, LINE],
    disability_other: [575, 705, 1181, 748, BLOCK],
    terminated_abroad_country: [985, 872, 1182, 906, LINE], employment_type_other: [985, 920, 1182, 956, LINE],
    looking_duration: [945, 982, 1182, 1022, LINE], available_when: [665, 1012, 1182, 1053, LINE],
    household_id: [695, 1056, 1182, 1090, LINE],
    preferred_occupation_1: [105, 1160, 384, 1203, LINE], preferred_occupation_2: [105, 1205, 384, 1249, LINE],
    preferred_occupation_3: [105, 1250, 384, 1296, LINE], preferred_occupation_4: [105, 1297, 384, 1342, LINE],
    preferred_local_location_1: [430, 1205, 722, 1249, LINE], preferred_local_location_2: [430, 1250, 722, 1296, LINE],
    preferred_local_location_3: [430, 1297, 722, 1342, LINE],
    preferred_overseas_location_1: [779, 1205, 1181, 1249, LINE], preferred_overseas_location_2: [779, 1250, 1181, 1296, LINE],
    preferred_overseas_location_3: [779, 1297, 1181, 1342, LINE],
    expected_salary: [321, 1344, 542, 1391, LINE], passport_number: [703, 1344, 861, 1391, LINE],
    passport_expiry: [1022, 1344, 1181, 1391, LINE],
    language_other_name: [128, 1553, 279, 1597, LINE],
  }),
  page2: cellSpecs({
    ...Object.fromEntries([['elementary', 131, 179], ['secondary', 179, 226], ['tertiary', 226, 272], ['graduate', 272, 329]]
      .flatMap(([lv, y0, y1]) => [
        [`${lv}_school`, [199, y0, 535, y1, BLOCK]], [`${lv}_course`, [536, y0, 750, y1, BLOCK]],
        [`${lv}_year`, [751, y0, 853, y1, LINE]], [`${lv}_level`, [854, y0, 985, y1, BLOCK]],
        [`${lv}_last_attended`, [986, y0, 1079, y1, LINE]], [`${lv}_awards`, [1080, y0, 1182, y1, BLOCK]],
      ])),
    ...Object.fromEntries([[1, 403, 431], [2, 432, 460], [3, 461, 489]].flatMap(([n, y0, y1]) => [
      [`training_${n}_course`, [105, y0, 507, y1, LINE]], [`training_${n}_duration`, [508, y0, 685, y1, LINE]],
      [`training_${n}_institution`, [686, y0, 957, y1, LINE]], [`training_${n}_certificate`, [958, y0, 1182, y1, LINE]],
    ])),
    ...Object.fromEntries([[1, 548, 576], [2, 577, 605]].flatMap(([n, y0, y1]) => [
      [`eligibility_${n}_name`, [105, y0, 345, y1, LINE]], [`eligibility_${n}_rating`, [346, y0, 442, y1, LINE]],
      [`eligibility_${n}_exam_date`, [443, y0, 667, y1, LINE]],
      [`license_${n}_name`, [715, y0, 985, y1, LINE]], [`license_${n}_valid_until`, [986, y0, 1182, y1, LINE]],
    ])),
    ...Object.fromEntries([[1, 705, 733], [2, 734, 762], [3, 763, 791], [4, 792, 820], [5, 821, 849]].flatMap(([n, y0, y1]) => [
      [`work_${n}_company`, [58, y0, 282, y1, LINE]], [`work_${n}_address`, [283, y0, 507, y1, LINE]],
      [`work_${n}_position`, [508, y0, 732, y1, LINE]], [`work_${n}_dates`, [733, y0, 957, y1, LINE]],
      [`work_${n}_status`, [958, y0, 1182, y1, LINE]],
    ])),
    other_skills_other_text: [880, 1045, 1182, 1083, LINE],
  }),
};

const PAGE1_CHECKBOX_GROUPS = [
  {
    field: 'disability',
    multi: true,
    threshold: 0.12,
    values: [
      { value: 'visual', x: 0.2211, y: 0.3967 },
      { value: 'speech', x: 0.3537, y: 0.3967 },
      { value: 'others', x: 0.4807, y: 0.3967 },
      { value: 'hearing', x: 0.2211, y: 0.4155 },
      { value: 'physical', x: 0.3537, y: 0.4136 },
    ],
  },
  {
    field: 'gender',
    values: [
      { value: 'male', x: 0.299, y: 0.235 },
      { value: 'female', x: 0.423, y: 0.235 },
    ],
  },
  {
    field: 'civil_status',
    values: [
      { value: 'single', x: 0.182, y: 0.281 },
      { value: 'married', x: 0.182, y: 0.298 },
      { value: 'widowed', x: 0.182, y: 0.314 },
      { value: 'separated', x: 0.339, y: 0.281 },
      { value: 'live-in', x: 0.339, y: 0.298 },
    ],
  },
  {
    field: 'employment_status',
    values: [
      { value: 'employed', x: 0.198, y: 0.437 },
      { value: 'unemployed', x: 0.411, y: 0.437 },
    ],
  },
  {
    field: 'employment_type',
    values: [
      { value: 'wage employed', x: 0.223, y: 0.469 },
      { value: 'self employed', x: 0.223, y: 0.497 },
      { value: 'new entrant/fresh graduate', x: 0.438, y: 0.469 },
      { value: 'finished contract', x: 0.438, y: 0.497 },
      { value: 'resigned', x: 0.438, y: 0.519 },
      { value: 'retired', x: 0.438, y: 0.547 },
      { value: 'terminated/laidoff(local)', x: 0.678, y: 0.469 },
      { value: 'terminated/laidoff(abroad)', x: 0.678, y: 0.497 },
      { value: 'others', x: 0.678, y: 0.532 },
    ],
  },
  {
    field: 'looking_for_work',
    values: [
      { value: 'yes', x: 0.323, y: 0.566 },
      { value: 'no', x: 0.383, y: 0.566 },
    ],
  },
  {
    field: 'willing_to_work_immediately',
    values: [
      { value: 'yes', x: 0.323, y: 0.582 },
      { value: 'no', x: 0.383, y: 0.582 },
    ],
  },
  {
    field: 'four_ps_beneficiary',
    values: [
      { value: 'yes', x: 0.269, y: 0.609 },
      { value: 'no', x: 0.326, y: 0.609 },
    ],
  },
  {
    field: 'work_location',
    values: [
      { value: 'local', x: 0.326, y: 0.669 },
      { value: 'overseas', x: 0.599, y: 0.669 },
    ],
  },
];

// III. Language / dialect proficiency: tick marks in the Read / Write / Speak / Understand cells.
// Cell edges of the language grid in blank-form pixels (150 dpi), from the form's ruled lines.
const LANGUAGE_CELL_X = { read: [280, 533], write: [534, 778], speak: [779, 985], understand: [986, 1182] };
const LANGUAGE_CELL_Y = { language_english: [1468, 1514], language_filipino: [1515, 1551], language_other: [1552, 1598] };
const LANGUAGE_COLUMNS = [
  { value: 'read', x: 0.274 },
  { value: 'write', x: 0.482 },
  { value: 'speak', x: 0.691 },
  { value: 'understand', x: 0.865 },
];
PAGE1_CHECKBOX_GROUPS.push(
  ...[['language_english', 0.846], ['language_filipino', 0.872], ['language_other', 0.894]].map(([field, y]) => ({
    field,
    multi: true,
    threshold: 0.06,
    values: LANGUAGE_COLUMNS.map((c) => ({ value: c.value, x: c.x, y, cell: [LANGUAGE_CELL_X[c.value][0], LANGUAGE_CELL_Y[field][0], LANGUAGE_CELL_X[c.value][1], LANGUAGE_CELL_Y[field][1]] })),
  })),
);

const PAGE2_CHECKBOX_GROUPS = [
  {
    field: 'other_skills_acquired',
    multi: true,
    values: [
      { value: 'Auto Mechanic', x: 0.063, y: 0.510 },
      { value: 'Beautician', x: 0.063, y: 0.526 },
      { value: 'Carpentry Work', x: 0.063, y: 0.542 },
      { value: 'Computer Literate', x: 0.063, y: 0.558 },
      { value: 'Domestic Chores', x: 0.063, y: 0.575 },
      { value: 'Driver', x: 0.063, y: 0.592 },
      { value: 'Electrician', x: 0.395, y: 0.510 },
      { value: 'Embroidery', x: 0.395, y: 0.526 },
      { value: 'Gardening', x: 0.395, y: 0.542 },
      { value: 'Masonry', x: 0.395, y: 0.558 },
      { value: 'Painter/Artist', x: 0.395, y: 0.575 },
      { value: 'Painting Jobs', x: 0.395, y: 0.592 },
      { value: 'Photography', x: 0.697, y: 0.510 },
      { value: 'Plumbing', x: 0.697, y: 0.526 },
      { value: 'Sewing Dresses', x: 0.697, y: 0.542 },
      { value: 'Stenography', x: 0.697, y: 0.558 },
      { value: 'Tailoring', x: 0.697, y: 0.575 },
      { value: 'Others', x: 0.697, y: 0.592 },
    ],
  },
];

const CHECKBOX_GROUPS = {
  page1: PAGE1_CHECKBOX_GROUPS,
  page2: PAGE2_CHECKBOX_GROUPS,
};

const EMPTY_FULL_DATA = {
  suffix: '', place_of_birth: '', religion: '', height: '', weight: '',
  tin: '', gsis_sss_no: '', pagibig_no: '', philhealth_no: '',
  email_address: '', landline_number: '', cell_phone_number: '',
  house_street: '', village: '', barangay: '',
  disability: '', disability_other: '', employment_type: '',
  looking_for_work: '', looking_duration: '', willing_to_work_immediately: '',
  available_when: '', four_ps_beneficiary: '', household_id: '',
  language_dialect: '', language_proficiency: '', other_skills: '',
  other_skills_acquired: '', trainings: '', eligibility_license: '',
  work_experience: '', elementary_background: '', secondary_background: '',
  tertiary_background: '', graduate_studies_background: '',
  preferred_occupations: '', preferred_work_location: '',
  preferred_local_locations: '', preferred_overseas_locations: '',
  expected_salary: '', availability: '', passport_number: '', passport_expiry: '',
};

function emptyEditable() {
  return {
    first_name: '', middle_name: '', last_name: '',
    date_of_birth: '', gender: '', civil_status: '',
    contact_number: '', address: '', city: '', province: '',
    education_level: '', course: '', years_of_experience: 0,
    employment_status: '', preferred_occupation: '',
    nsrp_full_data: { ...EMPTY_FULL_DATA },
  };
}

function assertLocalOcrLanguageData() {
  const trainedData = path.join(OCR_LANG_PATH, 'eng.traineddata');
  if (!fs.existsSync(trainedData)) {
    throw new Error(`Missing OCR language data: ${trainedData}`);
  }
  fs.mkdirSync(OCR_CACHE_PATH, { recursive: true });
}

function getPsm(Tesseract, name) {
  return Tesseract.PSM[name] || Tesseract.PSM.SINGLE_LINE;
}

function getTsvPageBox(tsv) {
  const rows = String(tsv || '').split(/\r?\n/).filter(Boolean);
  for (const row of rows.slice(1)) {
    const cols = row.split('\t');
    if (cols[0] === '1') {
      const width = parseInt(cols[8], 10);
      const height = parseInt(cols[9], 10);
      if (width > 0 && height > 0) return { width, height };
    }
  }
  return null;
}

function computeAnchorDy(tsv, pageBox) {
  if (!tsv || !pageBox || pageBox.height <= 0) return 0;
  const rows = String(tsv).split(/\r?\n/);
  for (const row of rows) {
    const cols = row.split('\t');
    if (cols.length < 12 || parseInt(cols[0], 10) !== 5) continue;
    const wordText = (cols[11] || '').trim().toUpperCase();
    if (wordText !== 'SURNAME' && !/^S[UVLI][RN][NM]?[AE]?[NM]?[AE]?$/.test(wordText)) continue;
    const conf = parseFloat(cols[10]);
    if (conf < 30) continue;
    const wordTop = parseInt(cols[7], 10);
    const actualY = wordTop / pageBox.height;
    const dy = actualY - SURNAME_LABEL_BASELINE_Y;
    if (dy < -0.15 || dy > 0.15) continue;
    return dy;
  }
  return 0;
}

function applyDy(region, dy) {
  const [x, y, w, h] = region;
  return [x, Math.min(0.99, Math.max(0, y + dy)), w, h];
}

function toRectangle(pageBox, region) {
  const [x, y, width, height] = region;
  const left = Math.max(0, Math.min(pageBox.width - 1, Math.round(pageBox.width * x)));
  const top = Math.max(0, Math.min(pageBox.height - 1, Math.round(pageBox.height * y)));
  const maxWidth = Math.max(1, pageBox.width - left);
  const maxHeight = Math.max(1, pageBox.height - top);
  return {
    left,
    top,
    width: Math.max(1, Math.min(maxWidth, Math.round(pageBox.width * width))),
    height: Math.max(1, Math.min(maxHeight, Math.round(pageBox.height * height))),
  };
}

function normalizeRegionText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[|_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngToBinary(buffer) {
  const { width, height, grey } = decodePngToGrey(buffer);
  const black = new Uint8Array(width * height);
  for (let i = 0; i < grey.length; i += 1) black[i] = grey[i] < 160 ? 1 : 0;
  return { width, height, black };
}

function decodePngToGrey(buffer) {
  const signature = buffer.subarray(0, 8);
  if (!signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error('Invalid PNG signature');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
  if (!width || !height || !channels || ![1, 8].includes(bitDepth)) {
    throw new Error(`Unsupported PNG format colorType=${colorType} bitDepth=${bitDepth}`);
  }
  const bitsPerPixel = channels * bitDepth;
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const rows = [];
  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[input];
    input += 1;
    const row = Buffer.from(inflated.subarray(input, input + rowBytes));
    input += rowBytes;
    const prev = rows[y - 1];
    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = prev ? prev[x] : 0;
      const upLeft = prev && x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
      if (filter === 1) row[x] = (row[x] + left) & 0xff;
      else if (filter === 2) row[x] = (row[x] + up) & 0xff;
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) row[x] = (row[x] + paethPredictor(left, up, upLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
    }
    rows.push(row);
  }

  const grey = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = rows[y];
    for (let x = 0; x < width; x += 1) {
      let value = 255;
      if (colorType === 0 && bitDepth === 1) {
        value = ((row[Math.floor(x / 8)] >> (7 - (x % 8))) & 1) ? 255 : 0;
      } else if (colorType === 0) {
        value = row[x];
      } else if (colorType === 2) {
        const i = x * 3;
        value = Math.round((row[i] + row[i + 1] + row[i + 2]) / 3);
      } else if (colorType === 4) {
        const i = x * 2;
        value = row[i + 1] === 0 ? 255 : row[i];
      } else if (colorType === 6) {
        const i = x * 4;
        value = row[i + 3] === 0 ? 255 : Math.round((row[i] + row[i + 1] + row[i + 2]) / 3);
      }
      grey[y * width + x] = value;
    }
  }
  return { width, height, grey };
}

function decodeTesseractBinaryImage(dataUrl) {
  if (!dataUrl) return null;
  const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  return decodePngToBinary(Buffer.from(base64, 'base64'));
}

function cropBinary(binaryImage, region, expand = 0.003) {
  const left = Math.max(0, Math.floor(binaryImage.width * Math.max(0, region[0] - expand)));
  const top = Math.max(0, Math.floor(binaryImage.height * Math.max(0, region[1] - expand)));
  const right = Math.min(binaryImage.width, Math.ceil(binaryImage.width * Math.min(1, region[0] + region[2] + expand)));
  const bottom = Math.min(binaryImage.height, Math.ceil(binaryImage.height * Math.min(1, region[1] + region[3] + expand)));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const black = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const src = (top + y) * binaryImage.width + left;
    black.set(binaryImage.black.subarray(src, src + width), y * width);
  }
  return { width, height, black };
}

function removeTableLines(crop) {
  const black = new Uint8Array(crop.black);
  for (let y = 0; y < crop.height; y += 1) {
    let count = 0;
    for (let x = 0; x < crop.width; x += 1) count += black[y * crop.width + x];
    if (count / crop.width > 0.34) {
      for (let x = 0; x < crop.width; x += 1) black[y * crop.width + x] = 0;
    }
  }
  for (let x = 0; x < crop.width; x += 1) {
    let count = 0;
    for (let y = 0; y < crop.height; y += 1) count += black[y * crop.width + x];
    if (count / crop.height > 0.34) {
      for (let y = 0; y < crop.height; y += 1) black[y * crop.width + x] = 0;
    }
  }
  return { ...crop, black };
}

function prepareOcrCrop(binaryImage, region, options = {}) {
  return removeTableLines(cropBinary(binaryImage, region, options.expand ?? 0.003));
}

function countBlackPixels(crop) {
  let black = 0;
  for (let i = 0; i < crop.black.length; i += 1) black += crop.black[i];
  return black;
}

function isBlankOcrCrop(crop, minBlackPixels = 10) {
  return countBlackPixels(crop) < minBlackPixels;
}

function cropToPbm(crop, scale = 6, padding = 22) {
  const width = crop.width * scale + padding * 2;
  const height = crop.height * scale + padding * 2;
  const lines = ['P1', `${width} ${height}`];
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const sx = Math.floor((x - padding) / scale);
      const sy = Math.floor((y - padding) / scale);
      const isBlack = sx >= 0 && sx < crop.width && sy >= 0 && sy < crop.height
        ? crop.black[sy * crop.width + sx] === 1
        : false;
      row.push(isBlack ? '1' : '0');
    }
    lines.push(row.join(' '));
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'ascii');
}

function regionToPbm(binaryImage, region, options = {}) {
  const crop = prepareOcrCrop(binaryImage, region, options);
  return cropToPbm(crop, options.scale ?? 6, options.padding ?? 22);
}

function checkboxDensity(binaryImage, cxFrac, cyFrac, sizeFrac = 0.018) {
  const cx = Math.round(binaryImage.width * cxFrac);
  const cy = Math.round(binaryImage.height * cyFrac);
  const half = Math.max(5, Math.round(Math.min(binaryImage.width, binaryImage.height) * sizeFrac * 0.5));
  const inset = Math.max(2, Math.round(half * 0.28));
  let total = 0;
  let black = 0;
  for (let y = cy - half + inset; y <= cy + half - inset; y += 1) {
    for (let x = cx - half + inset; x <= cx + half - inset; x += 1) {
      if (x < 0 || y < 0 || x >= binaryImage.width || y >= binaryImage.height) continue;
      total += 1;
      black += binaryImage.black[y * binaryImage.width + x];
    }
  }
  return total ? black / total : 0;
}

function detectNsrpCheckboxes(binaryImage, dy = 0, groups = PAGE1_CHECKBOX_GROUPS) {
  const results = {};
  const densities = {};
  if (!binaryImage) return results;

  for (const group of groups) {
    const measured = group.values.map((item) => ({
      ...item,
      density: checkboxDensity(binaryImage, item.x, Math.min(0.99, Math.max(0, item.y + dy))),
    })).sort((a, b) => b.density - a.density);

    densities[group.field] = measured.map(({ value, density }) => ({ value, density: Number(density.toFixed(4)) }));
    if (group.multi) {
      const picked = measured
        .filter((item) => item.density >= (group.threshold ?? 0.180))
        .map((item) => item.value);
      if (picked.length > 0) results[group.field] = picked;
    } else {
      const best = measured[0];
      const second = measured[1];
      const margin = second ? best.density - second.density : best.density;
      if (best && best.density >= 0.045 && margin >= 0.018) {
        results[group.field] = best.value;
      }
    }
  }

  results.__densities = densities;
  return results;
}

async function recognizeImageRegion(worker, Tesseract, imageBuffer, pageBox, region, psmName) {
  const requestOptions = {
    rectangle: toRectangle(pageBox, region),
    user_defined_dpi: '300',
  };
  if (psmName) requestOptions.tessedit_pageseg_mode = getPsm(Tesseract, psmName);
  const result = await worker.recognize(
    imageBuffer,
    requestOptions,
    { text: true },
  );
  return normalizeRegionText(result.data?.text || '');
}

async function recognizeBinaryRegion(worker, Tesseract, binaryImage, region, spec, debugCropsDir, name, preparedCrop = null) {
  const crop = preparedCrop || prepareOcrCrop(binaryImage, region, spec);
  if (isBlankOcrCrop(crop, spec.minBlackPixels ?? 10)) return '';
  const pbm = cropToPbm(crop, spec.scale ?? 6, spec.padding ?? 22);
  if (debugCropsDir) {
    fs.mkdirSync(debugCropsDir, { recursive: true });
    fs.writeFileSync(path.join(debugCropsDir, `${name}.pbm`), pbm);
  }
  const result = await worker.recognize(
    pbm,
    {
      tessedit_pageseg_mode: getPsm(Tesseract, spec.psm || 'SINGLE_LINE'),
      user_defined_dpi: '300',
    },
    { text: true },
  );
  return normalizeRegionText(result.data?.text || '');
}

// Printed labels of NSRP Form 1 page 1. A photo that shows none of the page-2 headings and fewer than
// two of these is not an NSRP page, so no field positions are read from it (they would only be noise).
const PAGE1_MARKERS = [
  'personal information', 'surname', 'first name', 'middle name', 'date of birth', 'place of birth',
  'civil status', 'present address', 'philhealth', 'pag-ibig', 'employment status', 'job preference',
  'preferred occupation', 'dialect proficiency', 'registration form', '4ps',
];

function detectNsrpPageType(rawText) {
  const text = String(rawText || '').toLowerCase();
  if (text.includes('educational background') || text.includes('technical/vocational') || text.includes('other skills acquired')) {
    return 'page2';
  }
  return PAGE1_MARKERS.filter((marker) => text.includes(marker)).length >= 2 ? 'page1' : 'unknown';
}

async function recognizeNsrpRegions(worker, Tesseract, imageBuffer, pageBox, binaryImage, dy = 0, options = {}, pageType = 'page1') {
  const regions = {};
  const specs = REGION_SPECS[pageType] || PAGE1_REGION_SPECS;
  for (const [name, spec] of Object.entries(specs)) {
    const region = applyDy(spec.region, dy);
    try {
      const preparedCrop = binaryImage ? prepareOcrCrop(binaryImage, region, spec) : null;
      if (preparedCrop && isBlankOcrCrop(preparedCrop, spec.minBlackPixels ?? 10)) {
        regions[name] = '';
        continue;
      }
      if (options.debugCropsDir && preparedCrop && spec.mode !== 'binary') {
        fs.mkdirSync(options.debugCropsDir, { recursive: true });
        fs.writeFileSync(
          path.join(options.debugCropsDir, `${name}.pbm`),
          cropToPbm(preparedCrop, spec.scale ?? 6, spec.padding ?? 22),
        );
      }
      let value = '';
      if (spec.mode === 'binary' && binaryImage) {
        value = await recognizeBinaryRegion(worker, Tesseract, binaryImage, region, spec, options.debugCropsDir, name, preparedCrop);
        if (!value || value.length < 2) {
          value = await recognizeImageRegion(worker, Tesseract, imageBuffer, pageBox, region, spec.psm);
        }
      } else {
        value = await recognizeImageRegion(worker, Tesseract, imageBuffer, pageBox, region, spec.psm);
      }
      regions[name] = value;
    } catch (err) {
      regions[name] = '';
      if (options.logWarnings) console.warn(`[NSRP OCR region ${name}]`, err.message || err);
    }
  }
  return regions;
}

// Photos whose short side is above this are averaged down before reading, to a short side of about
// TARGET_SHORT_SIDE (the form's width at roughly 200 dpi).
const LARGE_PHOTO_SHORT_SIDE = 2000;
const TARGET_SHORT_SIDE = 1650;

// Averages each f x f block of pixels into one.
function averageDown(image, f) {
  const width = Math.floor(image.width / f); const height = Math.floor(image.height / f);
  const grey = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let dy = 0; dy < f; dy += 1) {
        const row = (y * f + dy) * image.width + x * f;
        for (let dx = 0; dx < f; dx += 1) sum += image.grey[row + dx];
      }
      grey[y * width + x] = Math.round(sum / (f * f));
    }
  }
  return { width, height, grey };
}

// A smaller, smoothed copy of a photo: block-averaged to about the size of the form at 150 dpi, then lightly
// blurred. A photo of a screen carries the screen's fine pixel grid, which becomes a field of black dots when the
// page is turned black-and-white; averaging removes the grid but keeps the letters.
function smoothedCopy(image, targetWidth = 1240) {
  const f = Math.max(1, Math.round(image.width / targetWidth));
  const width = Math.floor(image.width / f); const height = Math.floor(image.height / f);
  const small = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let dy = 0; dy < f; dy += 1) {
        const row = (y * f + dy) * image.width + x * f;
        for (let dx = 0; dx < f; dx += 1) sum += image.grey[row + dx];
      }
      small[y * width + x] = Math.round(sum / (f * f));
    }
  }
  const grey = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0; let n = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += small[yy * width + xx]; n += 1;
        }
      }
      grey[y * width + x] = Math.round(sum / n);
    }
  }
  return { width, height, grey };
}

// Turns a grey image clockwise by a quarter turn, `turns` times.
function rotateGrey(image, turns) {
  let { width, height, grey } = image;
  for (let t = 0; t < turns; t += 1) {
    const next = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) next[x * height + (height - 1 - y)] = grey[y * width + x];
    }
    grey = next;
    [width, height] = [height, width];
  }
  return { width, height, grey };
}

function greyToPgm(image) {
  return Buffer.concat([Buffer.from(`P5\n${image.width} ${image.height}\n255\n`, 'ascii'), Buffer.from(image.grey)]);
}

// Ink vs paper inside one small area: paper is the bright end of the area, ink is clearly darker than it.
// Measuring per area (not one level for the page) keeps shadows and uneven light from turning into ink.
function inkMask(grey, withPaper = false) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < grey.length; i += 1) hist[grey[i]] += 1;
  let seen = 0; let paper = 255;
  for (let v = 255; v >= 0; v -= 1) { seen += hist[v]; if (seen >= grey.length * 0.2) { paper = v; break; } }
  const cut = paper - Math.max(40, paper * 0.22);
  const black = new Uint8Array(grey.length);
  for (let i = 0; i < grey.length; i += 1) black[i] = grey[i] < cut ? 1 : 0;
  return withPaper ? { black, paper } : black;
}

// Grey crop for Tesseract: paper stretched to white, the writing kept with its soft edges (pure black-and-white
// loses detail in small letters); everything that is not next to kept writing (erased form, stray ink, paper
// texture, faint line ghosts) is set to white.
function cleanedGreyPgm(sample, ink, kept, formCovered, paper) {
  const { width, height } = sample;
  const near = new Uint8Array(width * height);
  const reach = ALIGNED_SCALE;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!kept[y * width + x]) continue;
      for (let yy = Math.max(0, y - reach); yy <= Math.min(height - 1, y + reach); yy += 1) {
        near.fill(1, yy * width + Math.max(0, x - reach), yy * width + Math.min(width - 1, x + reach) + 1);
      }
    }
  }
  const pad = 30;
  const W = width + pad * 2; const H = height + pad * 2;
  const out = Buffer.alloc(W * H, 255);
  // Darkest writing becomes black, paper becomes white.
  let darkest = 255;
  for (let i = 0; i < kept.length; i += 1) if (kept[i] && sample.grey[i] < darkest) darkest = sample.grey[i];
  const range = Math.max(30, paper - darkest);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (!near[i] || (formCovered[i] && !kept[i]) || (ink[i] && !kept[i])) continue;
      out[(y + pad) * W + x + pad] = Math.max(0, Math.min(255, Math.round(((sample.grey[i] - darkest) / range) * 255)));
    }
  }
  return Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`, 'ascii'), out]);
}

const ALIGNED_SCALE = 3; // crops are read at about 3x the 150 dpi form size

// The blank form's printed ink (labels, lines, boxes) at 150 dpi, widened by a couple of pixels so a
// slightly-off alignment still covers it. Erasing it from a crop leaves only what the person wrote.
const blankFormInk = {};
function getBlankFormInk(pageType, grow = 1) {
  const cacheKey = `${pageType}:${grow}`;
  if (blankFormInk[cacheKey] !== undefined) return blankFormInk[cacheKey];
  const file = path.join(__dirname, '..', 'assets', `nsrp-blank-${pageType === 'page2' ? 'p2' : 'p1'}.png`);
  let mask = null;
  try {
    const page = decodePngToBinary(fs.readFileSync(file));
    const wide = new Uint8Array(page.black.length);
    for (let y = 0; y < page.height; y += 1) {
      for (let x = 0; x < page.width; x += 1) {
        if (!page.black[y * page.width + x]) continue;
        for (let dy = -grow; dy <= grow; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= page.height) continue;
          const row = yy * page.width;
          for (let dx = -grow; dx <= grow; dx += 1) {
            const xx = x + dx;
            if (xx >= 0 && xx < page.width) wide[row + xx] = 1;
          }
        }
      }
    }
    mask = { width: page.width, height: page.height, black: wide, exact: page.black };
  } catch (err) {
    mask = null;
  }
  blankFormInk[cacheKey] = mask;
  return mask;
}

// Where a pen stroke crosses an erased printed line (ink right before and right after a short erased run, in
// the same column for a horizontal line or the same row for a vertical one), the stroke is put back, so
// writing that sits on or crosses a line is not cut in two. Long runs (the lines themselves) are never restored.
function restoreCrossings(written, ink, covered, width, height) {
  const maxRun = 8 * ALIGNED_SCALE;
  const reach = 3 * ALIGNED_SCALE;
  const out = new Uint8Array(written);
  const scan = (count, length, at) => {
    for (let a = 0; a < count; a += 1) {
      let b = 0;
      while (b < length) {
        if (!covered[at(a, b)]) { b += 1; continue; }
        const start = b;
        while (b < length && covered[at(a, b)]) b += 1;
        const end = b - 1;
        if (end - start + 1 > maxRun || start < reach || end + reach >= length) continue;
        // A pen stroke continues well past the line on both sides; the blurred edge of a printed line does not.
        let before = true; let after = true;
        for (let k = 1; k <= reach; k += 1) {
          before = before && !!ink[at(a, start - k)];
          after = after && !!ink[at(a, end + k)];
        }
        if (before && after) {
          for (let k = start; k <= end; k += 1) if (ink[at(a, k)]) out[at(a, k)] = 1;
        }
      }
    }
  };
  scan(width, height, (x, y) => y * width + x); // columns: crossings of horizontal lines
  scan(height, width, (y, x) => y * width + x); // rows: crossings of vertical lines
  return out;
}

function printedFormCover(width, height, region, pad, mask, scale = ALIGNED_SCALE) {
  const covered = new Uint8Array(width * height);
  if (!mask) return covered;
  const x0 = (region[0] - pad) * mask.width;
  const y0 = (region[1] - pad) * mask.height;
  for (let v = 0; v < height; v += 1) {
    const ty = Math.floor(y0 + v / scale);
    if (ty < 0 || ty >= mask.height) continue;
    for (let u = 0; u < width; u += 1) {
      const tx = Math.floor(x0 + u / scale);
      if (tx >= 0 && tx < mask.width && mask.black[ty * mask.width + tx]) covered[v * width + u] = 1;
    }
  }
  return covered;
}

// Removes ink that does not belong to this cell: specks (photo noise), and pieces of writing whose centre lies
// above or below the cell (writing from the row above or below that spilled over the line). Writing from this
// cell that spills over its own lines is kept whole. cellTop/cellBottom are the cell's lines in crop pixels.
function dropStrayInk(crop, cellTop = 0, cellBottom = crop.height, minPixels = 12) {
  const { width, height } = crop;
  const black = new Uint8Array(crop.black);
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let start = 0; start < black.length; start += 1) {
    if (!black[start] || seen[start]) continue;
    const pixels = [];
    let minY = height; let maxY = -1; let sumY = 0; let minX = width; let maxX = -1;
    stack.push(start); seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      pixels.push(i);
      const x = i % width; const y = (i - x) / width;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx; const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const j = yy * width + xx;
          if (black[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
      }
    }
    const centre = sumY / pixels.length;
    const outside = centre < cellTop || centre > cellBottom;
    const cutOff = (minY === 0 || maxY === height - 1) && maxY - minY + 1 < (cellBottom - cellTop) * 0.35;
    // Leftover printed line: thin and straight, taller than the cell (vertical) or much wider than tall (horizontal).
    const thin = 3 * ALIGNED_SCALE;
    const cellHeight = cellBottom - cellTop;
    const lineLeft = (maxX - minX + 1 <= thin && maxY - minY + 1 > cellHeight * 1.2)
      || (maxY - minY + 1 <= thin && maxX - minX + 1 > cellHeight * 3);
    if (pixels.length < minPixels || outside || cutOff || lineLeft) for (const i of pixels) black[i] = 0;
  }
  return { ...crop, black };
}

// Phone photos bend slightly, so the page-wide fit can be a pixel or two off at a given cell. Nudge the
// cell (up to SHIFT form pixels each way) to where the printed lines around it match the blank form best.
const SHIFT = 6;
function localShift(greyImage, transform, region, mask) {
  if (!mask) return [0, 0];
  const m = SHIFT + 6;
  const x0 = Math.round(region[0] * mask.width) - m; const y0 = Math.round(region[1] * mask.height) - m;
  const w = Math.round(region[2] * mask.width) + m * 2; const h = Math.round(region[3] * mask.height) + m * 2;
  const area = [x0 / mask.width, y0 / mask.height, w / mask.width, h / mask.height];
  const sample = sampleRegion(greyImage, transform, area, 0, 1);
  const ink = inkMask(sample.grey);
  const points = [];
  for (let y = SHIFT; y < h - SHIFT; y += 1) {
    const ty = y0 + y;
    if (ty < 0 || ty >= mask.height) continue;
    for (let x = SHIFT; x < w - SHIFT; x += 1) {
      const tx = x0 + x;
      if (tx >= 0 && tx < mask.width && mask.exact[ty * mask.width + tx]) points.push([x, y]);
    }
  }
  if (points.length < 20) return [0, 0];
  const score = (dx, dy) => {
    let hit = 0;
    for (const [x, y] of points) hit += ink[(y + dy) * sample.width + x + dx] || 0;
    return hit;
  };
  let best = [0, 0]; let bestScore = score(0, 0);
  for (let dy = -SHIFT; dy <= SHIFT; dy += 1) {
    for (let dx = -SHIFT; dx <= SHIFT; dx += 1) {
      const sc = score(dx, dy);
      if (sc > bestScore * 1.05) { bestScore = sc; best = [dx, dy]; }
    }
  }
  return best;
}

// The kept writing as a grey image with strokes one pixel thicker (helps faint or thin pen strokes).
function thickerPgm(crop) {
  const { width, height, black } = crop;
  const pad = 30;
  const W = width + pad * 2; const H = height + pad * 2;
  const out = Buffer.alloc(W * H, 255);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!black[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) out[(y + dy + pad) * W + x + dx + pad] = 0;
      }
    }
  }
  return Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`, 'ascii'), out]);
}

// Average of Tesseract's own word confidences (0-100) in one box; used only to flag fields for review.
function meanWordConfidence(tsv) {
  const confs = String(tsv || '').split(/\r?\n/).map((row) => row.split('\t'))
    .filter((c) => c[0] === '5' && (c[11] || '').trim()).map((c) => parseFloat(c[10])).filter((v) => v >= 0);
  return confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0;
}

async function recognizeAlignedRegions(worker, Tesseract, greyImage, transform, specs, pageType, options = {}) {
  const regions = {};
  const confidence = {};
  regions.__confidence = confidence;
  // Clean scans line up to about a pixel; photos less exactly, so erase a wider margin around printed lines.
  const formInk = getBlankFormInk(pageType, transform.meanError > 1.5 ? 2 : 1);
  for (const [name, spec] of Object.entries(specs)) {
    try {
      const pad = spec.expand ?? 0.003;
      const [dx, dy] = localShift(greyImage, transform, spec.region, formInk);
      // Writing often spills over the cell's lines, so read with room above and below (45% of the cell).
      const extra = spec.region[3] * 0.45;
      const area = [spec.region[0], spec.region[1] - extra, spec.region[2], spec.region[3] + extra * 2];
      const shifted = [area[0] + dx / 1240, area[1] + dy / 1754, area[2], area[3]];
      const sample = sampleRegion(greyImage, transform, shifted, pad, ALIGNED_SCALE);
      const { black: ink, paper } = inkMask(sample.grey, true);
      const formCovered = printedFormCover(sample.width, sample.height, area, pad, formInk);
      const written = restoreCrossings(ink.map((v, i) => (v && !formCovered[i] ? 1 : 0)), ink, formCovered, sample.width, sample.height);
      const cellTop = (pad + extra) * 1754 * ALIGNED_SCALE;
      const cellBottom = cellTop + spec.region[3] * 1754 * ALIGNED_SCALE;
      const crop = dropStrayInk({ width: sample.width, height: sample.height, black: written }, cellTop, cellBottom);
      if (isBlankOcrCrop(crop, (spec.minBlackPixels ?? 10) * ALIGNED_SCALE * ALIGNED_SCALE)) {
        regions[name] = '';
        continue;
      }
      const pgm = cleanedGreyPgm(sample, ink, crop.black, formCovered, paper);
      if (options.debugCropsDir) {
        fs.mkdirSync(options.debugCropsDir, { recursive: true });
        fs.writeFileSync(path.join(options.debugCropsDir, `${name}.pgm`), pgm);
        fs.writeFileSync(path.join(options.debugCropsDir, `${name}.raw.pgm`), greyToPgm(sample));
        // Debug view: black = kept writing, dark grey = erased as printed form, light grey = removed as stray ink.
        const view = new Uint8Array(sample.width * sample.height).fill(255);
        for (let i = 0; i < view.length; i += 1) {
          if (crop.black[i]) view[i] = 0;
          else if (ink[i] && formCovered[i]) view[i] = 90;
          else if (ink[i]) view[i] = 190;
        }
        fs.writeFileSync(path.join(options.debugCropsDir, `${name}.steps.pgm`), greyToPgm({ width: sample.width, height: sample.height, grey: view }));
      }
      const params = { tessedit_pageseg_mode: spec.psm ? getPsm(Tesseract, spec.psm) : Tesseract.PSM.AUTO, user_defined_dpi: '300' };
      if (FIELD_CHARS[name]) params.tessedit_char_whitelist = FIELD_CHARS[name];
      const read = async (image) => {
        const result = await worker.recognize(image, params, { text: true, tsv: true });
        // Email addresses may contain "_", which the general clean-up would turn into a space.
        const text = name === 'email_address'
          ? String(result.data?.text || '').replace(/\s+/g, ' ').trim()
          : normalizeRegionText(result.data?.text || '');
        return { text, conf: text ? meanWordConfidence(result.data?.tsv) : 0 };
      };
      let best = await read(pgm);
      // Unsure reading: read the same writing again, crisp black-and-white and with slightly thicker strokes,
      // and keep whichever reading Tesseract is most sure of. The field only counts as sure when all readings
      // agree; if they differ, the lowest confidence is kept so the field stays flagged for review.
      if (best.text && best.conf < LOW_CONFIDENCE) {
        const readings = [best];
        for (const again of [cropToPbm(crop, 1, 30), thickerPgm(crop)]) {
          const other = await read(again);
          if (other.text) readings.push(other);
          if (other.text && other.conf > best.conf) best = other;
        }
        const same = (a, b) => a.replace(/\s+/g, '').toUpperCase() === b.replace(/\s+/g, '').toUpperCase();
        if (!readings.every((x) => same(x.text, best.text))) best = { ...best, conf: Math.min(...readings.map((x) => x.conf)) };
      }
      regions[name] = best.text;
      if (best.text) confidence[name] = best.conf;
    } catch (err) {
      regions[name] = '';
      if (options.logWarnings) console.warn(`[NSRP OCR region ${name}]`, err.message || err);
    }
  }
  return regions;
}

// Share of ink inside each checkbox: the box is located through the page fit, nudged onto the printed box,
// and only pixels where the blank form has no ink are counted (so the printed border never counts as a tick).
const BOX_HALF = 11; // half the measured square, in blank-form pixels
function detectAlignedCheckboxes(greyImage, transform, groups, pageType) {
  const formInk = getBlankFormInk(pageType, transform.meanError > 1.5 ? 2 : 1);
  const results = {};
  const densities = {};
  const density = (fx, fy) => {
    const region = [fx - BOX_HALF / 1240, fy - BOX_HALF / 1754, (BOX_HALF * 2) / 1240, (BOX_HALF * 2) / 1754];
    const [dx, dy] = localShift(greyImage, transform, region, formInk);
    const shifted = [region[0] + dx / 1240, region[1] + dy / 1754, region[2], region[3]];
    const scale = 2;
    // Paper level from a wider area, so a heavy tick cannot make the ink look like paper.
    const wide = sampleRegion(greyImage, transform, [shifted[0] - region[2], shifted[1] - region[3], region[2] * 3, region[3] * 3], 0, 1);
    const { paper } = inkMask(wide.grey, true);
    const cut = paper - Math.max(55, paper * 0.3);
    const sample = sampleRegion(greyImage, transform, shifted, 0, scale);
    const covered = printedFormCover(sample.width, sample.height, region, 0, formInk, scale);
    let total = 0; let black = 0;
    for (let i = 0; i < sample.grey.length; i += 1) {
      if (covered[i]) continue;
      total += 1;
      if (sample.grey[i] < cut) black += 1;
    }
    return total ? black / total : 0;
  };
  // A tick written anywhere inside a cell (no printed box): count the pen ink left in the cell after erasing the
  // printed form and specks. About CELL_TICK_PIXELS such pixels (at 3x) is a tick; scaled so the usual tick
  // threshold applies (leftover photo blobs in empty cells stay well below it).
  const CELL_TICK_PIXELS = 150;
  const cellTick = ([x0, y0, x1, y1]) => {
    const inset = 3;
    const region = [(x0 + inset) / 1240, (y0 + inset) / 1754, (x1 - x0 - inset * 2) / 1240, (y1 - y0 - inset * 2) / 1754];
    const [dx, dy] = localShift(greyImage, transform, region, formInk);
    const shifted = [region[0] + dx / 1240, region[1] + dy / 1754, region[2], region[3]];
    const sample = sampleRegion(greyImage, transform, shifted, 0, ALIGNED_SCALE);
    const ink = inkMask(sample.grey);
    const covered = printedFormCover(sample.width, sample.height, region, 0, formInk);
    // Photo grain makes many small specks; a pen tick is one connected stroke, so only strokes of 150+ pixels count.
    const written = dropStrayInk({ width: sample.width, height: sample.height, black: ink.map((v, i) => (v && !covered[i] ? 1 : 0)) }, 0, sample.height, 150);
    let count = 0;
    for (let i = 0; i < written.black.length; i += 1) count += written.black[i];
    return (count / CELL_TICK_PIXELS) * ALIGNED_TICK_MIN;
  };
  for (const group of groups) {
    const measured = group.values.map((item) => ({ ...item, density: item.cell ? cellTick(item.cell) : density(item.x, item.y) }))
      .sort((a, b) => b.density - a.density);
    densities[group.field] = measured.map(({ value, density: d }) => ({ value, density: Number(d.toFixed(4)) }));
    if (group.multi) {
      const picked = measured.filter((item) => item.density >= ALIGNED_TICK_MIN).map((item) => item.value);
      // (Language cells use the whole-cell measure above, scaled to the same threshold.)
      if (picked.length > 0) results[group.field] = picked;
    } else {
      const best = measured[0];
      const second = measured[1];
      const margin = second ? best.density - second.density : best.density;
      if (best && best.density >= ALIGNED_TICK_MIN && margin >= ALIGNED_TICK_MIN / 2) results[group.field] = best.value;
    }
  }
  results.__densities = densities;
  return results;
}
const ALIGNED_TICK_MIN = 0.04;

async function recognizeNsrpImage(Tesseract, imageBuffer, options = {}) {
  assertLocalOcrLanguageData();

  let worker = null;
  let timeoutId = null;
  let timedOut = false;
  const stopNativeWarningFilter = options.filterNativeWarnings === false
    ? () => {}
    : startTesseractWarningFilter();
  const timeoutMs = options.timeoutMs || OCR_TIMEOUT_MS;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      if (worker) worker.terminate().catch(() => {});
      reject(new Error('OCR timed out'));
    }, timeoutMs);
  });

  const job = (async () => {
    worker = await Tesseract.createWorker('eng', 1, {
      langPath: OCR_LANG_PATH,
      cachePath: OCR_CACHE_PATH,
      cacheMethod: 'write',
      gzip: false,
      logger: () => {},
      errorHandler: (err) => {
        if (options.logWarnings) console.warn('[NSRP OCR worker]', err);
      },
    });
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      user_defined_dpi: '300',
    });

    // Phone photos are often 12 megapixels or more: reading them at full size is slow, and a photo of a screen
    // carries the screen's pixel grid. Large photos are first decoded only (no reading) and averaged down to
    // about the form's size at 150-200 dpi; scans and images of normal size are read as they are.
    let readBuffer = imageBuffer;
    if (options.shrinkLarge !== false) {
      try {
        const decoded = await worker.recognize(imageBuffer, {}, { imageGrey: true, text: false, blocks: false, hocr: false, tsv: false });
        const grey = decodePngToGrey(Buffer.from(String(decoded.data?.imageGrey || '').replace(/^data:image\/png;base64,/, ''), 'base64'));
        if (Math.min(grey.width, grey.height) > LARGE_PHOTO_SHORT_SIDE) {
          const short = Math.min(grey.width, grey.height);
          readBuffer = greyToPgm(averageDown(grey, Math.max(2, Math.round(short / TARGET_SHORT_SIDE))));
        }
      } catch (err) {
        if (options.logWarnings) console.warn('[NSRP OCR shrink]', err.message || err);
      }
    }

    const full = await worker.recognize(
      readBuffer,
      { tessedit_pageseg_mode: Tesseract.PSM.AUTO, user_defined_dpi: '300' },
      { text: true, tsv: true, imageBinary: true, imageGrey: true },
    );

    const rawText = full.data?.text || '';
    const tsv = full.data?.tsv || '';
    const pageBox = getTsvPageBox(tsv);
    const pageType = detectNsrpPageType(rawText);
    const dy = pageType === 'page1' && pageBox ? computeAnchorDy(tsv, pageBox) : 0;
    let binaryImage = null;
    try {
      binaryImage = decodeTesseractBinaryImage(full.data?.imageBinary || '');
    } catch (err) {
      if (options.logWarnings) console.warn('[NSRP OCR binary decode]', err.message || err);
    }

    // Preferred path: locate the printed form on the image and read every field box straightened.
    let greyImage = null;
    if (options.align !== false) {
      try {
        greyImage = decodePngToGrey(Buffer.from(String(full.data?.imageGrey || '').replace(/^data:image\/png;base64,/, ''), 'base64'));
      } catch (err) {
        if (options.logWarnings) console.warn('[NSRP OCR grey decode]', err.message || err);
      }
    }
    let located = greyImage && pageType !== 'unknown'
      ? { pageType, rawText, transform: fitPageTransform(tsv, pageType), image: greyImage, turned: 0 }
      : null;
    if (greyImage && !located?.transform) {
      // Not found yet: try a smoothed copy (photos of a screen), then the photo turned 90, 180 and 270 degrees
      // (a phone photo can arrive sideways or upside down).
      // When the upright photo was already recognised as page 1 or 2, it is not sideways: only the smoothed
      // copy is tried. Turned copies are made one at a time, only when needed.
      const tries = [{ make: () => smoothedCopy(greyImage), turns: 0 },
        ...(pageType === 'unknown' ? [1, 2, 3].map((turns) => ({ make: () => rotateGrey(greyImage, turns), turns })) : [])];
      for (const { make, turns } of tries) {
        const image = make();
        const again = await worker.recognize(
          greyToPgm(image),
          { tessedit_pageseg_mode: Tesseract.PSM.AUTO, user_defined_dpi: '300' },
          { text: true, tsv: true },
        );
        const turnedType = detectNsrpPageType(again.data?.text || '');
        if (turnedType === 'unknown') continue;
        const turnedFit = fitPageTransform(again.data?.tsv || '', turnedType);
        if (turnedFit) {
          located = { pageType: turnedType, rawText: again.data?.text || '', transform: turnedFit, image, turned: turns * 90 };
          break;
        }
      }
    }
    if (located?.transform) {
      const { transform, image } = located;
      const regions = await recognizeAlignedRegions(worker, Tesseract, image, transform, ALIGNED_REGION_SPECS[located.pageType], located.pageType, options);
      regions.__page_type = located.pageType;
      regions.__checkboxes = detectAlignedCheckboxes(image, transform, CHECKBOX_GROUPS[located.pageType], located.pageType);
      regions.__alignment = { matches: transform.matches, meanError: transform.meanError, turned: located.turned };
      return { rawText: located.rawText, regions, pageBox, dy: 0, pageType: located.pageType };
    }

    if (pageType === 'unknown') {
      return { rawText, regions: { __page_type: 'unknown' }, pageBox, dy: 0, pageType };
    }

    const effectivePageBox = pageBox || (binaryImage ? { width: binaryImage.width, height: binaryImage.height } : null);
    const regions = effectivePageBox
      ? await recognizeNsrpRegions(worker, Tesseract, imageBuffer, effectivePageBox, binaryImage, dy, options, pageType)
      : {};
    const checkboxes = detectNsrpCheckboxes(binaryImage, dy, CHECKBOX_GROUPS[pageType] || PAGE1_CHECKBOX_GROUPS);
    regions.__page_type = pageType;
    regions.__checkboxes = checkboxes;

    return { rawText, regions, pageBox: effectivePageBox, dy, pageType };
  })();

  try {
    return await Promise.race([job, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (worker && !timedOut) await worker.terminate().catch(() => {});
    stopNativeWarningFilter();
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function basicClean(value) {
  return String(value || '')
    .replace(/\r/g, ' ')
    .replace(/[|_]{2,}/g, ' ')
    .replace(/[`~^]/g, ' ')
    .replace(/^(?:[Xx?]+\s+|\?+)/, '')
    .replace(/^[|:;.,)\]-]+|[|:;,(\[]+$|(?<![A-Za-zÑñ])\.+$|(?<=\b[A-Za-zÑñ]{5,})\.+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEmptyToken(value) {
  return /^(na|n\/a|none|null|nil|-+|n a)$/i.test(String(value || '').trim());
}

function cleanRegionText(raw, stripLabels = []) {
  let v = basicClean(raw)
    .replace(/\b(mm\/dd\/yyyy|mm\/dd\/yy|ex\.?\s*jr\.?|etc\.?)\b/ig, '')
    .trim();
  for (const lbl of stripLabels) {
    v = v.replace(new RegExp(`\\b${escapeRegExp(lbl)}\\b`, 'ig'), '');
  }
  v = basicClean(v);
  if (isEmptyToken(v)) return '';
  return v;
}

const LABEL_JUNK = /\b(surname|first\s*name|middle\s*name|suffix|date\s*of\s*birth|place\s*of\s*birth|religion|civil\s*status|sex|height|tin|gsis|pag.?ibig|philhealth|cellphone|landline|email|disability|employment|status|type|wage|entrant|graduate|contract|resigned|retired|terminated|laidoff|salary|passport|expiry|beneficiary|household|education|elementary|secondary|tertiary|occupation|location|language|dialect|proficiency|eligibility|experience|training|company|single|married|widowed|separated|live.?in|employed|unemployed|visual|hearing|speech|physical|republic|philippines|department|labor|peso|looking|willing|immediately|4ps|prefer|expect|manager|officer|city\/municipality|municipality|barangay|village|province|house|street)\b/i;

function normalizeKnownRunTogether(value) {
  return String(value || '').toUpperCase();
}

function stripOcrNoise(value) {
  return String(value || '')
    .replace(/[^\w@.+,\-/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateName(value) {
  if (!value || value.length < 1) return '';
  const normalized = normalizeKnownRunTogether(value);
  const v = normalized
    .replace(/[^A-ZÑa-zñ\s.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (v.length > 60) return '';
  if (LABEL_JUNK.test(v)) return '';
  if (/\d/.test(v)) return '';
  if (v.replace(/[^A-ZÑ]/gi, '').length < 1) return '';
  return v;
}

function validateLocation(value) {
  if (!value) return '';
  const normalized = normalizeKnownRunTogether(stripOcrNoise(value));
  const v = normalized
    .toUpperCase()
    .replace(/[^A-ZÑ0-9\s.,'-]/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
  if (!v || v.length > 80) return '';
  if (v.replace(/[^A-ZÑ]/g, '').length < 3) return '';
  return v;
}

function mmddyyyyCandidates(digits, maxYear = new Date().getFullYear()) {
  if (digits.length < 8 || digits.length > 10) return [];
  const found = new Set();
  for (const sep1 of [0, 1]) {
    for (const sep2 of [0, 1]) {
      if (2 + sep1 + 2 + sep2 + 4 !== digits.length) continue;
      if (sep1 && !/[17]/.test(digits[2])) continue;
      const dStart = 2 + sep1;
      if (sep2 && !/[17]/.test(digits[dStart + 2])) continue;
      const mm = +digits.slice(0, 2); const dd = +digits.slice(dStart, dStart + 2); const yyyy = +digits.slice(-4);
      const date = new Date(Date.UTC(yyyy, mm - 1, dd));
      if (yyyy >= 1900 && yyyy <= maxYear && date.getUTCMonth() === mm - 1 && date.getUTCDate() === dd) {
        found.add(`${digits.slice(0, 2)}/${digits.slice(dStart, dStart + 2)}/${digits.slice(-4)}`);
      }
    }
  }
  return [...found];
}

// maxYear: the latest year accepted (this year for a birth date; later for expiry dates such as a passport's).
function validateDate(value, maxYear = new Date().getFullYear()) {
  if (!value) return '';
  // The form asks for mm/dd/yyyy. Slashes are often lost or read as 1 or 7 ("127282006" for 12/28/2006),
  // so when no slashes were read, every way of placing them is tried and the date is used only when exactly
  // one placement gives a real date.
  const hasSlashes = /\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(String(value));
  let raw = String(value);
  if (!hasSlashes) {
    const one = mmddyyyyCandidates(String(value).replace(/[^\d]/g, ''), maxYear);
    if (one.length === 1) raw = one[0];
  }
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slashMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (slashMatch) {
    let [, mm] = slashMatch;
    const [, , dd, yyyy] = slashMatch;
    // A month cannot be above 12: a leading 0 that touched the cell's line is often read as 2, 3, 6, 8 or 9.
    if (mm.length === 2 && +mm > 12 && /[23689]/.test(mm[0]) && +mm[1] >= 1) mm = `0${mm[1]}`;
    const y = parseInt(yyyy, 10);
    const m = parseInt(mm, 10);
    const d = parseInt(dd, 10);
    if (y >= 1900 && y <= maxYear && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }
  return '';
}

function validatePhone(value) {
  if (!value) return '';
  const cleaned = String(value).replace(/[^\d+]/g, '');
  if (/^09\d{9}$/.test(cleaned)) return cleaned;
  if (/^\+?639\d{9}$/.test(cleaned)) return cleaned;
  if (/^\d{7,10}$/.test(cleaned) && !/^(\d)\1+$/.test(cleaned)) return cleaned;
  return '';
}

// Landline numbers keep the dashes the person wrote ("088-190-9378").
function validateLandline(value) {
  const v = String(value || '').replace(/\s+/g, '').replace(/[^\d()+-]/g, '');
  const digits = v.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 12 && !/^(\d)\1+$/.test(digits) ? v : '';
}

function validateEmail(value) {
  if (!value) return '';
  const joined = String(value).replace(/\s*([.,@])\s*/g, (_, ch) => (ch === ',' ? '.' : ch)).replace(/\s+/g, '');
  const fixed = joined.replace(/@([a-z0-9-]+?)\.?(com|net|org|ph|edu|gov)(\.ph)?$/i, (_, host, end, ph) => `@${commonMailHost(host)}.${end}${ph || ''}`);
  const m = fixed.replace(/^([^@]*)(@gmail\.com)$/i, (_, local, host) => `${local.replace(/_/g, '.')}${host}`)
    .match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : '';
}

// One misread letter in a widely used mail provider's name ("qmail", "amail" for gmail) is corrected; any
// other host is kept as read.
const MAIL_HOSTS = ['gmail', 'yahoo', 'outlook', 'hotmail', 'ymail', 'icloud'];
// Real providers kept exactly as read, so they are never "corrected" into a similar name (email.com -> gmail.com).
const OTHER_MAIL_HOSTS = ['email', 'mail', 'gmx', 'aol', 'live', 'msn', 'proton', 'protonmail', 'zoho', 'yandex', 'example'];
function commonMailHost(host) {
  const h = String(host).toLowerCase();
  if (MAIL_HOSTS.includes(h) || OTHER_MAIL_HOSTS.includes(h)) return h;
  const near = MAIL_HOSTS.find((name) => name.length === h.length && [...name].filter((ch, i) => ch !== h[i]).length === 1);
  return near || h;
}

// "163CM" -> "163 CM", "2MONTHS" -> "2 MONTHS": a number and its unit are separate words.
function spaceNumberUnit(value) {
  return String(value || '').replace(/(\d)([A-Za-z]{2,})/g, '$1 $2');
}

// Training durations and work dates are written mm/yyyy (or mm/dd/yyyy) "to" mm/yyyy. A slash read as 1 or 7,
// or lost ("0572009", "122005"), is put back when the month is a real month.
function fixDateRange(value) {
  return String(value || '').replace(/\b(\d{6,7})\b/g, (whole) => {
    const m = whole.length === 7 ? whole.match(/^(\d{2})[17](\d{4})$/) : whole.match(/^(\d{2})(\d{4})$/);
    return m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1900 ? `${m[1]}/${m[2]}` : whole;
  });
}

// TESDA levels are NC I to NC IV; a II is often read as H, l or 1.
function fixNcLevel(value) {
  return String(value || '').replace(/\bNC\s*([IlL1|HT]{1,3}|[IlL1|]?V)\b/g, (_, lvl) => {
    if (/V$/.test(lvl)) return lvl.length === 2 ? 'NC IV' : 'NC V';
    const count = [...lvl].reduce((n, ch) => n + (ch === 'H' ? 2 : 1), 0);
    return count >= 1 && count <= 3 ? `NC ${'I'.repeat(count)}` : `NC ${lvl}`;
  });
}

function validateHeight(value) {
  if (!value || !/\d/.test(value)) return '';
  const cleaned = spaceNumberUnit(String(value).toUpperCase().replace(/[^0-9A-Z\s'".FTCM]/g, ' ')).replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 && cleaned.length < 25 ? cleaned : '';
}

function validateIdNumber(value) {
  if (!value) return '';
  const v = basicClean(value);
  if (!v || isEmptyToken(v)) return '';
  if (LABEL_JUNK.test(v) || v.length > 35) return '';
  if (!/\d/.test(v)) return '';
  if (/[A-Za-z]{3,}/.test(v)) return '';
  return v;
}

function validateSalary(value) {
  if (!value || !/\d/.test(value)) return '';
  let v = String(value).toUpperCase().replace(/\s+/g, ' ').trim();
  const m = v.match(/(?:PHP|P)?\s*\d{1,3}(?:,\d{3})?(?:\s*-\s*\d{1,3}(?:,\d{3})?)/i);
  if (m) {
    // Keep what follows the range too ("/ MONTH", "PER MONTH").
    const rest = v.slice(m.index + m[0].length).replace(/^[^A-Z/]+/, '').trim();
    v = m[0].replace(/^P\s+/i, 'PHP ').replace(/^PHP\s*/i, 'PHP ');
    return `${v.replace(/\s*-\s*/g, ' - ')}${rest ? ` ${rest}` : ''}`;
  }
  return basicClean(v);
}

function pickPhoneFromText(text) {
  const m = String(text || '').match(/(\+?63\s?9\d{2}\s?\d{3}\s?\d{4})|(09\d{9})/);
  return m ? m[0].replace(/\s+/g, '') : '';
}

function pickEmailFromText(text) {
  const m = String(text || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i);
  return m ? m[0].toLowerCase() : '';
}

function cleanOccupation(raw) {
  const v = cleanRegionText(raw, ['Preferred', 'Occupation']);
  if (!v || LABEL_JUNK.test(v) || /[|_]{2,}/.test(v)) return '';
  return normalizeKnownRunTogether(v)
    .replace(/[^A-ZÑ0-9\s/'-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function cleanFreeText(raw) {
  let v = stripOcrNoise(cleanRegionText(raw));
  v = v
    .replace(/\b(\d{2}\/\d{4})\s+10\s+(\d{2}\/\d{4})\b/g, '$1 to $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (isEmptyToken(v)) return '';
  return v;
}

function joinParts(parts) {
  return parts.map(cleanFreeText).filter(Boolean).join(' | ');
}

function educationLine(label, school, course, year, level, lastAttended, awards) {
  const pieces = [];
  const cleanSchool = cleanFreeText(school);
  const cleanCourse = cleanFreeText(course);
  const cleanYear = cleanFreeText(year);
  const cleanLevel = cleanFreeText(level);
  const cleanLast = cleanFreeText(lastAttended);
  const cleanAwards = cleanFreeText(awards);

  if (cleanSchool) pieces.push(`School: ${cleanSchool}`);
  if (cleanCourse) pieces.push(`Course: ${cleanCourse}`);
  if (cleanYear) pieces.push(`Year graduated: ${cleanYear}`);
  if (cleanLevel) pieces.push(`Level: ${cleanLevel}`);
  if (cleanLast) pieces.push(`Year last attended: ${cleanLast}`);
  if (cleanAwards) pieces.push(`Awards: ${cleanAwards}`);
  return pieces.length ? `${label}: ${pieces.join(' | ')}` : '';
}

// "NA" (not applicable) counts as blank, also with a stray mark next to it ("3 NA", "NA ."): NA must be its own
// word and what is left besides it at most 2 characters, so a real value is never taken for NA.
const notNaText = (v) => {
  const text = String(v || '').trim();
  if (/^n\.?\s*\/?\s*a\.?$/i.test(text)) return '';
  const words = text.split(/\s+/);
  const isNa = (w) => /^n\.?\/?a\.?$/i.test(w);
  const rest = words.filter((w) => !isNa(w)).join('');
  return words.some(isNa) && rest.length <= 2 ? '' : (v || '');
};

function parsePage2Text(rawText, ocrRegions = {}) {
  const checkboxes = ocrRegions.__checkboxes || {};
  const rv = (key) => ocrRegions[key] || '';

  const elementary = educationLine(
    'Elementary',
    rv('elementary_school'),
    rv('elementary_course'),
    rv('elementary_year'),
    rv('elementary_level'),
    rv('elementary_last_attended'),
    rv('elementary_awards'),
  );
  const secondary = educationLine(
    'Secondary',
    rv('secondary_school'),
    rv('secondary_course'),
    rv('secondary_year'),
    rv('secondary_level'),
    rv('secondary_last_attended'),
    rv('secondary_awards'),
  );
  const tertiary = educationLine(
    'Tertiary',
    rv('tertiary_school'),
    rv('tertiary_course'),
    rv('tertiary_year'),
    rv('tertiary_level'),
    rv('tertiary_last_attended'),
    rv('tertiary_awards'),
  );
  const graduate = educationLine(
    'Graduate Studies',
    rv('graduate_school'),
    rv('graduate_course'),
    rv('graduate_year'),
    rv('graduate_level'),
    rv('graduate_last_attended'),
    rv('graduate_awards'),
  );

  const TRAINING_ROWS = [1, 2, 3];
  const WORK_ROWS = [1, 2, 3, 4, 5];
  const training = TRAINING_ROWS.map((n) => joinParts([
    rv(`training_${n}_course`), rv(`training_${n}_duration`), rv(`training_${n}_institution`), rv(`training_${n}_certificate`),
  ])).filter(Boolean).join('\n');
  const workRows = WORK_ROWS.map((n) => joinParts([
    rv(`work_${n}_company`), rv(`work_${n}_address`), rv(`work_${n}_position`), rv(`work_${n}_dates`), rv(`work_${n}_status`),
  ])).filter(Boolean);

  const checkedSkills = Array.isArray(checkboxes.other_skills_acquired)
    ? checkboxes.other_skills_acquired.filter((skill) => skill !== 'Others')
    : [];
  const otherSkillText = cleanFreeText(rv('other_skills_other_text'));
  if (otherSkillText) checkedSkills.push(`Others: ${otherSkillText}`);

  // Structured rows matching the NSRP Form 1 tables ("NA" cells count as blank).
  const cell = (key) => {
    const v = cleanFreeText(rv(key));
    return /^n\.?\/?a\.?$/i.test(v) ? '' : v;
  };
  const eduRow = (prefix) => ({
    school: cell(`${prefix}_school`),
    course: cell(`${prefix}_course`),
    year_graduated: cell(`${prefix}_year`),
    level_reached: cell(`${prefix}_level`),
    year_last_attended: cell(`${prefix}_last_attended`),
    awards: cell(`${prefix}_awards`),
  });
  const filledRow = (row) => Object.values(row).some(Boolean);
  const dateCell = (key) => fixDateRange(cell(key));
  const workRow = (n) => ({
    company: cell(`work_${n}_company`),
    address: cell(`work_${n}_address`),
    position: cell(`work_${n}_position`),
    dates: dateCell(`work_${n}_dates`),
    status: cell(`work_${n}_status`),
  });

  const nsrpFullData = {
    ...EMPTY_FULL_DATA,
    education: {
      elementary: eduRow('elementary'),
      secondary: eduRow('secondary'),
      tertiary: eduRow('tertiary'),
      graduate: eduRow('graduate'),
    },
    training_rows: TRAINING_ROWS.map((n) => ({
      course: cell(`training_${n}_course`),
      duration: dateCell(`training_${n}_duration`),
      institution: cell(`training_${n}_institution`),
      certificate: fixNcLevel(cell(`training_${n}_certificate`)),
    })).filter(filledRow),
    eligibility_rows: [1, 2].map((n) => ({
      eligibility: cell(`eligibility_${n}_name`), rating: cell(`eligibility_${n}_rating`), exam_date: cell(`eligibility_${n}_exam_date`),
    })).filter(filledRow),
    license_rows: [1, 2].map((n) => ({ license: cell(`license_${n}_name`), valid_until: cell(`license_${n}_valid_until`) })).filter(filledRow),
    work_rows: WORK_ROWS.map(workRow).filter(filledRow),
    other_skills_checked: checkedSkills.filter((skill) => !skill.startsWith('Others:')),
    other_skills_other: otherSkillText,
    trainings: training,
    eligibility_license: '',
    work_experience: workRows.join('\n'),
    elementary_background: elementary,
    secondary_background: secondary,
    tertiary_background: tertiary,
    graduate_studies_background: graduate,
    other_skills_acquired: checkedSkills.join('\n'),
  };

  return {
    ...emptyEditable(),
    nsrp_full_data: nsrpFullData,
  };
}

function parseNsrpText(rawText, ocrRegions = {}) {
  const pageType = ocrRegions.__page_type || detectNsrpPageType(rawText);
  if (pageType === 'page2') {
    return parsePage2Text(rawText, ocrRegions);
  }
  if (pageType === 'unknown') return emptyEditable();

  const text = String(rawText || '').replace(/\r/g, '');
  const checkboxes = ocrRegions.__checkboxes || {};
  const rv = (key, stripLabels = []) => cleanRegionText(ocrRegions[key] || '', stripLabels);

  const lastName = validateName(rv('surname', ['Surname', 'Last Name']));
  const firstName = validateName(rv('first_name', ['First Name', 'Given Name']));
  const middleName = validateName(rv('middle_name', ['Middle Name']));

  const rawSuffix = rv('suffix', ['Suffix']);
  let suffix = '';
  const suffixText = rawSuffix.replace(/\s+/g, '').replace(/^[Il1|]{1,3}$/, (m) => 'I'.repeat(m.length));
  if (suffixText && /^(jr\.?|sr\.?|i{1,3}v?|vi{0,3}|[IV]+)$/i.test(suffixText)) {
    suffix = suffixText.toUpperCase();
  }

  const dobRead = validateDate(rv('date_of_birth', ['Date of Birth', 'mm/dd/yyyy']));
  const dateOfBirth = dobRead && dobRead <= new Date().toISOString().slice(0, 10) ? dobRead : '';
  const placeOfBirth = validateLocation(rv('place_of_birth', ['Place of Birth']));
  const religion = validateName(rv('religion', ['Religion']));
  const height = validateHeight(rv('height', ['Height']));

  const tin = validateIdNumber(rv('tin', ['TIN']));
  const gsisNo = validateIdNumber(rv('gsis_sss_no', ['GSIS', 'SSS', 'ID', 'No.']));
  const pagibigNo = validateIdNumber(rv('pagibig_no', ['PAG-IBIG', 'No.']));
  const philhealthNo = validateIdNumber(rv('philhealth_no', ['PhilHealth', 'No.']));

  const emailAddr = validateEmail(rv('email_address', ['Email Address'])) || validateEmail(pickEmailFromText(text));
  const landline = validateLandline(rv('landline_number', ['Landline', 'Number']));
  const cellRead = rv('cell_phone_number', ['Cellphone', 'Cell Phone', 'Number']);
  const cellDigits = String(cellRead || '').replace(/[^\d+]/g, '');
  const cellphone = validatePhone(cellRead) || (/^\+?\d{7,13}$/.test(cellDigits) ? cellDigits : '') || validatePhone(pickPhoneFromText(text));

  const houseStreet = notNaText(normalizeKnownRunTogether(stripOcrNoise(rv('house_street', ['House', 'No.'])))
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase());

  const village = validateLocation(rv('village'));
  const barangay = validateLocation(rv('barangay'));
  const city = validateLocation(rv('city', ['Municipality']));
  const province = validateLocation(rv('province'));
  const address = [houseStreet, village, barangay, city, province].filter(Boolean).join(', ');

  const disabilityOther = notNaText(validateLocation(rv('disability_other', ['Others', 'specify'])));
  // "NONE" written on the Others line means no disability, same as leaving it blank.
  const disabilityOtherText = /^none\.?$/i.test(disabilityOther) ? '' : disabilityOther;
  const DISABILITY_LABELS = { visual: 'Visual', hearing: 'Hearing', speech: 'Speech', physical: 'Physical' };
  const disabilityTicks = Array.isArray(checkboxes.disability) ? checkboxes.disability : [];
  const disabilities = ['visual', 'hearing', 'speech', 'physical', 'others']
    .filter((d) => disabilityTicks.includes(d) || (d === 'others' && disabilityOtherText));
  const disabilitySummary = [
    ...disabilities.filter((d) => d !== 'others').map((d) => DISABILITY_LABELS[d]),
    ...(disabilityOtherText ? [disabilityOtherText] : []),
  ].join(', ');
  const terminatedCountry = notNaText(validateLocation(rv('terminated_abroad_country', ['specify', 'country'])));
  const employmentTypeOther = notNaText(cleanFreeText(rv('employment_type_other', ['Others', 'specify'])));
  const languageOtherName = notNaText(validateName(rv('language_other_name', ['Others'])));

  const gender = checkboxes.gender || '';
  const civilStatus = checkboxes.civil_status || '';
  const empStatus = checkboxes.employment_status || '';
  const empType = checkboxes.employment_type || '';
  const lookingWork = checkboxes.looking_for_work || '';
  const willingNow = checkboxes.willing_to_work_immediately || '';
  const fourPs = checkboxes.four_ps_beneficiary || '';
  const notNa = notNaText;
  const lookingDuration = notNa(spaceNumberUnit(cleanFreeText(rv('looking_duration', ['How long']))));
  const availableWhen = notNa(cleanFreeText(rv('available_when', ['If no', 'when'])));
  const householdId = notNa(validateIdNumber(rv('household_id', ['Household', 'ID', 'No.'])) || '');
  const workLocation = checkboxes.work_location || '';

  const occList = [
    cleanOccupation(rv('preferred_occupation_1')),
    cleanOccupation(rv('preferred_occupation_2')),
    cleanOccupation(rv('preferred_occupation_3')),
    cleanOccupation(rv('preferred_occupation_4')),
  ].filter(Boolean);

  const localLocations = [
    validateLocation(rv('preferred_local_location_1')),
    validateLocation(rv('preferred_local_location_2')),
    validateLocation(rv('preferred_local_location_3')),
  ].filter(Boolean);

  const overseasLocations = [
    validateLocation(rv('preferred_overseas_location_1')),
    validateLocation(rv('preferred_overseas_location_2')),
    validateLocation(rv('preferred_overseas_location_3')),
  ].filter(Boolean);

  const expectedSalary = validateSalary(rv('expected_salary', ['Expected Salary', 'Range']));
  const passportNumber = validateIdNumber(rv('passport_number', ['Passport', 'No.']));
  const passportExpiryIso = validateDate(rv('passport_expiry', ['Expiry', 'date']), new Date().getFullYear() + 20);
  const passportExpiry = passportExpiryIso ? passportExpiryIso.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1') : '';
  // Language grid: use the tick marks detected in each Read / Write / Speak / Understand cell
  // (the row labels are printed on every form, so they say nothing about what was ticked).
  const SKILL_ORDER = ['read', 'write', 'speak', 'understand'];
  const languageTicks = (field) => {
    const ticked = Array.isArray(checkboxes[field]) ? checkboxes[field] : [];
    return Object.fromEntries(SKILL_ORDER.map((skill) => [skill, ticked.includes(skill)]));
  };
  const languageGrid = {
    english: languageTicks('language_english'),
    filipino: languageTicks('language_filipino'),
    other: { ...languageTicks('language_other'), ...(languageOtherName ? { name: languageOtherName } : {}) },
  };
  const titleCase = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
  const languageRows = [['English', languageGrid.english], ['Filipino', languageGrid.filipino], ['Others', languageGrid.other]]
    .map(([name, ticks]) => {
      const skills = SKILL_ORDER.filter((skill) => ticks[skill]).map(titleCase);
      return skills.length ? `${name}: ${skills.join(', ')}` : '';
    })
    .filter(Boolean);

  const nsrpFullData = {
    ...EMPTY_FULL_DATA,
    suffix,
    place_of_birth: placeOfBirth,
    religion,
    height,
    tin,
    gsis_sss_no: gsisNo,
    pagibig_no: pagibigNo,
    philhealth_no: philhealthNo,
    email_address: emailAddr,
    landline_number: landline,
    cell_phone_number: cellphone,
    house_street: houseStreet,
    village,
    barangay,
    disability_other: disabilityOtherText,
    disability: disabilitySummary,
    ...(disabilities.length ? { disabilities } : {}),
    employment_type: empType,
    // Kept even when the matching tick was missed, so nothing written is lost (the app shows these lines
    // when the person picks that employment type).
    terminated_abroad_country: terminatedCountry,
    employment_type_other: employmentTypeOther,
    looking_for_work: lookingWork,
    willing_to_work_immediately: willingNow,
    four_ps_beneficiary: fourPs,
    looking_duration: lookingDuration,
    available_when: availableWhen,
    household_id: householdId,
    preferred_occupations: occList.join('\n'),
    preferred_work_location: workLocation,
    preferred_local_locations: localLocations.join('\n'),
    preferred_overseas_locations: overseasLocations.join('\n'),
    expected_salary: expectedSalary,
    passport_number: passportNumber,
    passport_expiry: passportExpiry,
    language_dialect: languageRows.map((line) => line.split(':')[0]).join(', '),
    language_proficiency: languageRows.join('\n'),
    // Structured lists matching the NSRP Form 1 rows
    preferred_occupation_list: occList,
    local_location_list: localLocations,
    overseas_location_list: overseasLocations,
    ...(languageRows.length || languageOtherName ? { languages: languageGrid } : {}),
  };

  return {
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    date_of_birth: dateOfBirth,
    gender,
    civil_status: civilStatus,
    contact_number: cellphone,
    address,
    city,
    province,
    education_level: '',
    course: '',
    years_of_experience: 0,
    employment_status: empStatus,
    preferred_occupation: occList[0] || '',
    nsrp_full_data: nsrpFullData,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Review flags: fields the person should look at closely before saving. They are hints only; a field without
// a flag can still be wrong, so the review screen asks the person to check every field against the paper.
// Each flag: { key, label, reason } where key is the field in the NSRP form (dots for nested values).
const LOW_CONFIDENCE = 70;
const REGION_FIELDS = {
  surname: ['last_name', 'Surname'], first_name: ['first_name', 'First Name'], middle_name: ['middle_name', 'Middle Name'],
  suffix: ['suffix', 'Suffix'], date_of_birth: ['date_of_birth', 'Date of Birth'], place_of_birth: ['place_of_birth', 'Place of Birth'],
  religion: ['religion', 'Religion'], house_street: ['house_street', 'House No. / Street'], village: ['village', 'Village'],
  barangay: ['barangay', 'Barangay'], city: ['city', 'Municipality/City'], province: ['province', 'Province'],
  tin: ['tin', 'TIN'], gsis_sss_no: ['gsis_sss_no', 'GSIS/SSS ID No.'], pagibig_no: ['pagibig_no', 'PAG-IBIG No.'],
  philhealth_no: ['philhealth_no', 'PhilHealth No.'], height: ['height', 'Height'], email_address: ['email_address', 'Email Address'],
  landline_number: ['landline_number', 'Landline Number'], cell_phone_number: ['cell_phone_number', 'Cellphone Number'],
  disability_other: ['disability_other', 'Disability - Others, specify'],
  terminated_abroad_country: ['terminated_abroad_country', 'Terminated/Laidoff (abroad) - country'],
  employment_type_other: ['employment_type_other', 'Employment type - Others, specify'],
  looking_duration: ['looking_duration', 'How long have you been looking for work?'], available_when: ['available_when', 'If no, when?'],
  household_id: ['household_id', 'Household ID No.'], expected_salary: ['expected_salary', 'Expected Salary'],
  passport_number: ['passport_number', 'Passport No.'], passport_expiry: ['passport_expiry', 'Passport Expiry Date'],
  language_other_name: ['languages.other.name', 'Other language (name)'],
  other_skills_other_text: ['other_skills_other', 'Other skills - Others'],
};
for (let n = 1; n <= 4; n += 1) REGION_FIELDS[`preferred_occupation_${n}`] = [`preferred_occupation_list.${n - 1}`, `Preferred Occupation ${n}`];
for (let n = 1; n <= 3; n += 1) {
  REGION_FIELDS[`preferred_local_location_${n}`] = [`local_location_list.${n - 1}`, `Local work location ${n}`];
  REGION_FIELDS[`preferred_overseas_location_${n}`] = [`overseas_location_list.${n - 1}`, `Overseas work location ${n}`];
}
const EDU_LABELS = { elementary: 'Elementary', secondary: 'Secondary', tertiary: 'Tertiary', graduate: 'Graduate Studies' };
const EDU_COLS = { school: ['school', 'School'], course: ['course', 'Course'], year: ['year_graduated', 'Year Graduated'], level: ['level_reached', 'What level?'], last_attended: ['year_last_attended', 'Year last attended'], awards: ['awards', 'Awards'] };
for (const [lv, lvLabel] of Object.entries(EDU_LABELS)) {
  for (const [col, [field, colLabel]] of Object.entries(EDU_COLS)) REGION_FIELDS[`${lv}_${col}`] = [`education.${lv}.${field}`, `${lvLabel} - ${colLabel}`];
}
const ROW_TABLES = [
  ['training', 3, 'training_rows', 'Training row', { course: 'Course', duration: 'Duration', institution: 'Institution', certificate: 'Certificate' }],
  ['eligibility', 2, 'eligibility_rows', 'Eligibility row', { name: 'Eligibility', rating: 'Rating', exam_date: 'Date of Examination' }],
  ['license', 2, 'license_rows', 'License row', { name: 'License', valid_until: 'Valid Until' }],
  ['work', 5, 'work_rows', 'Work experience row', { company: 'Company', address: 'Address', position: 'Position', dates: 'Inclusive Dates', status: 'Status' }],
];
for (const [prefix, count, table, rowLabel, cols] of ROW_TABLES) {
  for (let n = 1; n <= count; n += 1) {
    for (const [col, colLabel] of Object.entries(cols)) REGION_FIELDS[`${prefix}_${n}_${col}`] = [`${table}.paper_row_${n}.${col}`, `${rowLabel} ${n} - ${colLabel}`];
  }
}
const TICK_FIELDS = {
  gender: ['gender', 'Sex', true], civil_status: ['civil_status', 'Civil Status', true],
  employment_status: ['employment_status', 'Employment Status', true], employment_type: ['employment_type', 'Employment Type', false],
  looking_for_work: ['looking_for_work', 'Actively looking for work?', true],
  willing_to_work_immediately: ['willing_to_work_immediately', 'Willing to work immediately?', true],
  four_ps_beneficiary: ['four_ps_beneficiary', '4Ps beneficiary?', true], work_location: ['preferred_work_location', 'Preferred Work Location', false],
  disability: ['disabilities', 'Disability'], language_english: ['languages.english', 'English (language ticks)'],
  language_filipino: ['languages.filipino', 'Filipino (language ticks)'], language_other: ['languages.other', 'Other language (ticks)'],
  other_skills_acquired: ['other_skills_checked', 'Other skills (Section VIII ticks)'],
};

function valueAt(parsed, key) {
  const full = parsed?.nsrp_full_data || {};
  const parts = key.split('.');
  let v = parts[0] in (parsed || {}) && parts.length === 1 ? parsed[parts[0]] : full;
  for (const part of (parts.length === 1 && parts[0] in (parsed || {}) ? [] : parts)) v = v?.[part];
  return v;
}

function reviewFlags(parsed, regions = {}) {
  const flags = [];
  const pageType = regions.__page_type;
  if (pageType === 'unknown') return flags;
  if (!regions.__alignment) {
    flags.push({ key: '__page', label: 'Whole page', reason: 'The form could not be lined up exactly on this photo. Check every field.' });
  }
  const confidence = regions.__confidence || {};
  for (const [name, [key, label]] of Object.entries(REGION_FIELDS)) {
    if (!(name in regions)) continue;
    const raw = String(regions[name] || '').trim();
    if (!raw) continue;
    const value = key.includes('paper_row_') || /_list\.\d+$/.test(key) ? null : valueAt(parsed, key);
    const letters = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (value !== null && !String(value ?? '').trim() && letters !== 'NA' && letters !== 'NONE') {
      flags.push({ key, label, reason: 'Something is written here but could not be read.' });
    } else if (confidence[name] !== undefined && confidence[name] < LOW_CONFIDENCE) {
      flags.push({ key, label, reason: 'Hard to read. Compare with your paper form.' });
    }
  }
  // The month was read as more than 12 and repaired: always ask the person to check the date.
  const dobMonth = String(regions.date_of_birth || '').match(/^\D*(\d{2})\D/);
  if (dobMonth && +dobMonth[1] > 12 && !flags.some((f) => f.key === 'date_of_birth')) {
    flags.push({ key: 'date_of_birth', label: 'Date of Birth', reason: 'The month was unclear. Check the date.' });
  }
  const cell = String(valueAt(parsed, 'cell_phone_number') || '');
  if (cell && !/^(09\d{9}|\+?639\d{9})$/.test(cell) && !flags.some((f) => f.key === 'cell_phone_number')) {
    flags.push({ key: 'cell_phone_number', label: 'Cellphone Number', reason: 'Not a complete 11-digit mobile number.' });
  }
  const densities = regions.__checkboxes?.__densities || {};
  for (const [group, [key, label, required]] of Object.entries(TICK_FIELDS)) {
    const list = densities[group];
    if (!list || !list.length) continue;
    const [best, second] = list;
    const multi = required === undefined;
    if (multi) {
      if (list.some((d) => d.density >= ALIGNED_TICK_MIN * 0.5 && d.density < ALIGNED_TICK_MIN * 1.5)) {
        flags.push({ key, label, reason: 'A tick mark is faint or unclear.' });
      }
    } else if (second && second.density >= ALIGNED_TICK_MIN) {
      flags.push({ key, label, reason: 'More than one box looks ticked.' });
    } else if (required && best.density < ALIGNED_TICK_MIN) {
      flags.push({ key, label, reason: 'No tick was found.' });
    } else if (best.density >= ALIGNED_TICK_MIN * 0.5 && best.density < ALIGNED_TICK_MIN * 1.5) {
      flags.push({ key, label, reason: 'The tick mark is faint or unclear.' });
    }
  }
  const seen = new Set();
  return flags.filter((f) => !seen.has(f.key) && seen.add(f.key));
}

function countExtractedFields(parsed) {
  if (!parsed) return 0;
  const topKeys = [
    'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender',
    'civil_status', 'contact_number', 'address', 'city', 'province',
    'employment_status', 'preferred_occupation',
  ];
  const fullKeys = [
    'suffix', 'place_of_birth', 'religion', 'height', 'tin', 'gsis_sss_no',
    'pagibig_no', 'philhealth_no', 'email_address', 'landline_number',
    'cell_phone_number', 'house_street', 'village', 'barangay',
    'disability_other', 'employment_type', 'looking_for_work',
    'willing_to_work_immediately', 'four_ps_beneficiary',
    'preferred_occupations', 'preferred_work_location',
    'preferred_local_locations', 'preferred_overseas_locations',
    'expected_salary', 'passport_number', 'passport_expiry',
    'language_dialect', 'language_proficiency', 'trainings',
    'eligibility_license', 'work_experience', 'elementary_background',
    'secondary_background', 'tertiary_background',
    'graduate_studies_background', 'other_skills_acquired',
  ];
  let count = 0;
  for (const key of topKeys) {
    if (String(parsed[key] || '').trim()) count += 1;
  }
  for (const key of fullKeys) {
    if (String(parsed.nsrp_full_data?.[key] || '').trim()) count += 1;
  }
  // The summary keys above fold whole tables into one value (page 2 showed "6 fields" for 30+ filled cells),
  // so prefer a count of the form fields the job seeker actually reviews: each filled cell, list item and tick.
  const visible = countVisibleFormFields(parsed);
  return visible > 0 ? visible : count;
}

function countVisibleFormFields(parsed) {
  const full = parsed.nsrp_full_data || {};
  const filled = (v) => String(v ?? '').trim().length > 0;
  const cells = (v) => {
    if (Array.isArray(v)) return v.reduce((n, item) => n + cells(item), 0);
    if (v && typeof v === 'object') return Object.values(v).reduce((n, item) => n + cells(item), 0);
    return v === true || (typeof v === 'string' && filled(v)) ? 1 : 0;
  };
  let count = ['first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender', 'civil_status', 'city', 'province', 'employment_status']
    .filter((key) => filled(parsed[key])).length;
  count += [
    'suffix', 'place_of_birth', 'religion', 'height', 'tin', 'gsis_sss_no', 'pagibig_no', 'philhealth_no',
    'email_address', 'landline_number', 'cell_phone_number', 'house_street', 'village', 'barangay',
    'disability_other', 'employment_type', 'terminated_abroad_country', 'employment_type_other',
    'looking_for_work', 'looking_duration', 'willing_to_work_immediately', 'available_when',
    'four_ps_beneficiary', 'household_id', 'preferred_work_location', 'expected_salary',
    'passport_number', 'passport_expiry', 'other_skills_other',
  ].filter((key) => filled(full[key])).length;
  for (const key of [
    'disabilities', 'preferred_occupation_list', 'local_location_list', 'overseas_location_list', 'languages',
    'education', 'training_rows', 'eligibility_rows', 'license_rows', 'work_rows', 'other_skills_checked',
  ]) count += cells(full[key]);
  return count;
}

function makeTempCropDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nsrp-ocr-crops-'));
}

module.exports = {
  OCR_TIMEOUT_MS,
  REGION_SPECS,
  CHECKBOX_GROUPS,
  emptyEditable,
  recognizeNsrpImage,
  parseNsrpText,
  countExtractedFields,
  reviewFlags,
  makeTempCropDir,
};
