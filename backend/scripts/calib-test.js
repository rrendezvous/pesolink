const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');

const NSRP_REGION_MAP = {
  surname:            [0.050, 0.170, 0.200, 0.028],
  first_name:         [0.260, 0.170, 0.240, 0.028],
  middle_name:        [0.510, 0.170, 0.240, 0.028],
  suffix:             [0.760, 0.170, 0.200, 0.028],
  date_of_birth:      [0.275, 0.210, 0.120, 0.028],
  place_of_birth:     [0.670, 0.210, 0.280, 0.028],
  religion:           [0.120, 0.245, 0.140, 0.028],
  house_street:       [0.720, 0.240, 0.260, 0.020],
  village:            [0.720, 0.258, 0.260, 0.020],
  barangay:           [0.720, 0.276, 0.260, 0.020],
  city:               [0.720, 0.293, 0.260, 0.020],
  province:           [0.720, 0.310, 0.260, 0.020],
  tin:                [0.210, 0.325, 0.220, 0.020],
  gsis_sss_no:        [0.210, 0.342, 0.220, 0.020],
  pagibig_no:         [0.210, 0.359, 0.220, 0.020],
  philhealth_no:      [0.210, 0.375, 0.220, 0.020],
  height:             [0.730, 0.325, 0.250, 0.026],
  email_address:      [0.730, 0.342, 0.250, 0.026],
  landline_number:    [0.730, 0.359, 0.250, 0.026],
  cell_phone_number:  [0.730, 0.375, 0.250, 0.026],
  disability_other:   [0.570, 0.392, 0.400, 0.026],
  preferred_occupation_1:   [0.080, 0.660, 0.210, 0.028],
  preferred_occupation_2:   [0.080, 0.690, 0.210, 0.028],
  preferred_occupation_3:   [0.080, 0.710, 0.210, 0.028],
  preferred_occupation_4:   [0.080, 0.740, 0.210, 0.028],
  preferred_local_locations:    [0.340, 0.690, 0.240, 0.075],
  preferred_overseas_locations: [0.620, 0.690, 0.360, 0.075],
  expected_salary:    [0.280, 0.770, 0.140, 0.022],
  passport_number:    [0.600, 0.770, 0.110, 0.022],
  passport_expiry:    [0.850, 0.770, 0.130, 0.022],
};

(async () => {
  const worker = await Tesseract.createWorker('eng', 1, {
    langPath: path.resolve(__dirname, '..'),
    cachePath: path.resolve(__dirname, '..', '.tesseract-cache')
  });
  const buf = fs.readFileSync('../../figma-reference/NSRP_Form_1_ssamplepg1.jpg');
  for (const [name, region] of Object.entries(NSRP_REGION_MAP)) {
    const rect = {
      left: Math.round(1240 * region[0]),
      top: Math.round(1755 * region[1]),
      width: Math.round(1240 * region[2]),
      height: Math.round(1755 * region[3])
    };
    const res = await worker.recognize(buf, { rectangle: rect });
    console.log(name.padEnd(30), ':', res.data.text.trim().replace(/\n/g, ' '));
  }
  await worker.terminate();
})();
