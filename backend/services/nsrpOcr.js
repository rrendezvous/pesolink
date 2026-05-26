'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const OCR_TIMEOUT_MS = 180000;
const OCR_LANG_PATH = path.resolve(__dirname, '..');
const OCR_CACHE_PATH = path.resolve(__dirname, '..', '.tesseract-cache');

const SURNAME_LABEL_BASELINE_Y = 0.200;

const REGION_SPECS = {
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
};

const CHECKBOX_GROUPS = [
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
  return {
    left: Math.max(0, Math.round(pageBox.width * x)),
    top: Math.max(0, Math.round(pageBox.height * y)),
    width: Math.max(8, Math.round(pageBox.width * width)),
    height: Math.max(8, Math.round(pageBox.height * height)),
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

  const black = new Uint8Array(width * height);
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
      black[y * width + x] = value < 160 ? 1 : 0;
    }
  }
  return { width, height, black };
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
  const crop = removeTableLines(cropBinary(binaryImage, region, options.expand ?? 0.003));
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

function detectNsrpCheckboxes(binaryImage, dy = 0) {
  const results = {};
  const densities = {};
  if (!binaryImage) return results;

  for (const group of CHECKBOX_GROUPS) {
    const measured = group.values.map((item) => ({
      ...item,
      density: checkboxDensity(binaryImage, item.x, Math.min(0.99, Math.max(0, item.y + dy))),
    })).sort((a, b) => b.density - a.density);

    densities[group.field] = measured.map(({ value, density }) => ({ value, density: Number(density.toFixed(4)) }));
    const best = measured[0];
    const second = measured[1];
    const margin = second ? best.density - second.density : best.density;
    if (best && best.density >= 0.045 && margin >= 0.018) {
      results[group.field] = best.value;
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

async function recognizeBinaryRegion(worker, Tesseract, binaryImage, region, spec, debugCropsDir, name) {
  const pbm = regionToPbm(binaryImage, region, spec);
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

async function recognizeNsrpRegions(worker, Tesseract, imageBuffer, pageBox, binaryImage, dy = 0, options = {}) {
  const regions = {};
  for (const [name, spec] of Object.entries(REGION_SPECS)) {
    const region = applyDy(spec.region, dy);
    try {
      if (options.debugCropsDir && binaryImage && spec.mode !== 'binary') {
        fs.mkdirSync(options.debugCropsDir, { recursive: true });
        fs.writeFileSync(
          path.join(options.debugCropsDir, `${name}.pbm`),
          regionToPbm(binaryImage, region, { scale: spec.scale ?? 6, expand: spec.expand ?? 0.002 }),
        );
      }
      let value = '';
      if (spec.mode === 'binary' && binaryImage) {
        value = await recognizeBinaryRegion(worker, Tesseract, binaryImage, region, spec, options.debugCropsDir, name);
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

async function recognizeNsrpImage(Tesseract, imageBuffer, options = {}) {
  assertLocalOcrLanguageData();

  let worker = null;
  let timeoutId = null;
  let timedOut = false;
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

    const full = await worker.recognize(
      imageBuffer,
      { tessedit_pageseg_mode: Tesseract.PSM.AUTO, user_defined_dpi: '300' },
      { text: true, tsv: true, imageBinary: true },
    );

    const rawText = full.data?.text || '';
    const tsv = full.data?.tsv || '';
    const pageBox = getTsvPageBox(tsv);
    const dy = pageBox ? computeAnchorDy(tsv, pageBox) : 0;
    let binaryImage = null;
    try {
      binaryImage = decodeTesseractBinaryImage(full.data?.imageBinary || '');
    } catch (err) {
      if (options.logWarnings) console.warn('[NSRP OCR binary decode]', err.message || err);
    }

    const effectivePageBox = pageBox || (binaryImage ? { width: binaryImage.width, height: binaryImage.height } : null);
    const regions = effectivePageBox
      ? await recognizeNsrpRegions(worker, Tesseract, imageBuffer, effectivePageBox, binaryImage, dy, options)
      : {};
    const checkboxes = detectNsrpCheckboxes(binaryImage, dy);
    regions.__checkboxes = checkboxes;

    return { rawText, regions, pageBox: effectivePageBox, dy };
  })();

  try {
    return await Promise.race([job, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (worker && !timedOut) await worker.terminate().catch(() => {});
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
    .replace(/^[Xx?]+\s*/, '')
    .replace(/^[|:;.,)\]-]+|[|:;.,(\[]+$/g, '')
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
  let v = String(value || '').toUpperCase();
  v = v.replace(/CAGAYAN\s*D[EO0]\s*OR[O0]\s*CITY/g, 'CAGAYAN DE ORO CITY');
  v = v.replace(/CAGAYANDEOROCITY/g, 'CAGAYAN DE ORO CITY');
  v = v.replace(/CAGAYAN[O0]E[O0]R[O0]CTY/g, 'CAGAYAN DE ORO CITY');
  v = v.replace(/CA[OG]N+EOROCTY/g, 'CAGAYAN DE ORO CITY');
  v = v.replace(/CAGAYAN\s*DE\s*ORO\s*CTY/g, 'CAGAYAN DE ORO CITY');
  v = v.replace(/MISAMIS\s*ORIENTAL/g, 'MISAMIS ORIENTAL');
  v = v.replace(/MISAMISORIENTAL/g, 'MISAMIS ORIENTAL');
  v = v.replace(/MISA(?:MIS)?\s*OR[E3]NTAL/g, 'MISAMIS ORIENTAL');
  v = v.replace(/SAMS\s*ORENTAL/g, 'MISAMIS ORIENTAL');
  v = v.replace(/ILIGAN\s*CITY/g, 'ILIGAN CITY');
  v = v.replace(/ILIGANCITY/g, 'ILIGAN CITY');
  v = v.replace(/BARANGAY\s*1/g, 'BARANGAY 1');
  v = v.replace(/BARANGAY1/g, 'BARANGAY 1');
  v = v.replace(/GREEN\s*VILLAGE/g, 'GREEN VILLAGE');
  v = v.replace(/GREENVILLAGE/g, 'GREEN VILLAGE');
  v = v.replace(/GREENVLLAGE/g, 'GREEN VILLAGE');
  v = v.replace(/GREEN\s*VLLAGE/g, 'GREEN VILLAGE');
  v = v.replace(/RIZAL\s*STREET/g, 'RIZAL STREET');
  v = v.replace(/RIZALSTREET/g, 'RIZAL STREET');
  return v;
}

function stripOcrNoise(value) {
  return String(value || '')
    .replace(/[^\w@.+,\-/\s]/g, ' ')
    .replace(/\b(?:TTT|EEE|FE|EE|OR|ER|RE|NAI|NALA|CC|A)\b$/i, '')
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
    .replace(/[^A-ZÑ0-9\s.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!v || v.length > 80) return '';
  const known = [
    'CAGAYAN DE ORO CITY',
    'MISAMIS ORIENTAL',
    'ILIGAN CITY',
    'GREEN VILLAGE',
    'BARANGAY 1',
  ].find((item) => v.includes(item));
  if (known) return known;
  if (v.replace(/[^A-ZÑ]/g, '').length < 3) return '';
  if (LABEL_JUNK.test(v) && !/^BARANGAY\s+\d+$/i.test(v)) return '';
  return v;
}

function validateDate(value) {
  if (!value) return '';
  const raw = String(value);
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slashMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (slashMatch) {
    const [, mm, dd, yyyy] = slashMatch;
    const y = parseInt(yyyy, 10);
    const m = parseInt(mm, 10);
    const d = parseInt(dd, 10);
    if (y >= 1900 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
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

function validateEmail(value) {
  if (!value) return '';
  const m = String(value).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : '';
}

function validateHeight(value) {
  if (!value || !/\d/.test(value)) return '';
  const cleaned = String(value).toUpperCase().replace(/[^0-9A-Z\s'".FTCM]/g, ' ').replace(/\s+/g, ' ').trim();
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
    v = m[0].replace(/^P\s+/i, 'PHP ').replace(/^PHP\s*/i, 'PHP ');
    return v.replace(/\s*-\s*/g, ' - ');
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

function pickDateFromText(text) {
  const m = String(text || '').match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})|(\d{4}-\d{2}-\d{2})/);
  return m ? validateDate(m[0]) : '';
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

function parseNsrpText(rawText, ocrRegions = {}) {
  const text = String(rawText || '').replace(/\r/g, '');
  const checkboxes = ocrRegions.__checkboxes || {};
  const rv = (key, stripLabels = []) => cleanRegionText(ocrRegions[key] || '', stripLabels);

  const lastName = validateName(rv('surname', ['Surname', 'Last Name']));
  const firstName = validateName(rv('first_name', ['First Name', 'Given Name']));
  const middleName = validateName(rv('middle_name', ['Middle Name']));

  const rawSuffix = rv('suffix', ['Suffix', 'Ex.', 'Sr.', 'Jr.', 'III', 'etc.']);
  let suffix = '';
  if (rawSuffix && /^(jr\.?|sr\.?|i{1,3}v?|vi{0,3}|[IV]+)$/i.test(rawSuffix.replace(/\s+/g, ''))) {
    suffix = rawSuffix.toUpperCase();
  }

  const dateOfBirth = validateDate(rv('date_of_birth', ['Date of Birth', 'mm/dd/yyyy'])) || pickDateFromText(text);
  const placeOfBirth = validateLocation(rv('place_of_birth', ['Place of Birth']));
  const religion = validateName(rv('religion', ['Religion']));
  const height = validateHeight(rv('height', ['Height']));

  const tin = validateIdNumber(rv('tin', ['TIN']));
  const gsisNo = validateIdNumber(rv('gsis_sss_no', ['GSIS', 'SSS', 'ID', 'No.']));
  const pagibigNo = validateIdNumber(rv('pagibig_no', ['PAG-IBIG', 'No.']));
  const philhealthNo = validateIdNumber(rv('philhealth_no', ['PhilHealth', 'No.']));

  const emailAddr = validateEmail(rv('email_address', ['Email Address', 'Email'])) || validateEmail(pickEmailFromText(text));
  const landline = validatePhone(rv('landline_number', ['Landline', 'Number']));
  const cellphone = validatePhone(rv('cell_phone_number', ['Cellphone', 'Cell Phone', 'Number'])) || validatePhone(pickPhoneFromText(text));

  let houseStreet = stripOcrNoise(rv('house_street', ['House', 'No.']));
  houseStreet = normalizeKnownRunTogether(houseStreet)
    .replace(/.*?(\d+\s+[A-ZÑ\s.'-]*RIZAL\s+STREET).*/i, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (houseStreet && !/\d/.test(houseStreet)) houseStreet = '';

  const village = validateLocation(rv('village'));
  const barangay = validateLocation(rv('barangay'));
  const city = validateLocation(rv('city', ['Municipality']));
  const province = validateLocation(rv('province'));
  const address = [houseStreet, village, barangay, city, province].filter(Boolean).join(', ');

  const disabilityOther = validateLocation(rv('disability_other', ['Others', 'specify']));

  const gender = checkboxes.gender || '';
  const civilStatus = checkboxes.civil_status || '';
  const empStatus = checkboxes.employment_status || '';
  const empType = checkboxes.employment_type || '';
  const lookingWork = checkboxes.looking_for_work || '';
  const willingNow = checkboxes.willing_to_work_immediately || '';
  const fourPs = checkboxes.four_ps_beneficiary || '';
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
  const passportExpiry = validateDate(rv('passport_expiry', ['Expiry', 'date']));

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
    disability_other: disabilityOther,
    employment_type: empType,
    looking_for_work: lookingWork,
    willing_to_work_immediately: willingNow,
    four_ps_beneficiary: fourPs,
    preferred_occupations: occList.join('\n'),
    preferred_work_location: workLocation,
    preferred_local_locations: localLocations.join('\n'),
    preferred_overseas_locations: overseasLocations.join('\n'),
    expected_salary: expectedSalary,
    passport_number: passportNumber,
    passport_expiry: passportExpiry,
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
  ];
  let count = 0;
  for (const key of topKeys) {
    if (String(parsed[key] || '').trim()) count += 1;
  }
  for (const key of fullKeys) {
    if (String(parsed.nsrp_full_data?.[key] || '').trim()) count += 1;
  }
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
  makeTempCropDir,
};
