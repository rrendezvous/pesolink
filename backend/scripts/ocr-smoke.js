'use strict';

const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const {
  recognizeNsrpImage,
  parseNsrpText,
  countExtractedFields,
  makeTempCropDir,
} = require('../services/nsrpOcr');

const imageArg = process.argv.find((arg, index) => index >= 2 && !arg.startsWith('--'));
const saveDebugCrops = process.argv.includes('--debug-crops');

if (!imageArg || !fs.existsSync(imageArg)) {
  console.error('Usage: node scripts/ocr-smoke.js <nsrp-image.jpg> [--debug-crops]');
  process.exit(1);
}

(async () => {
  const imagePath = path.resolve(imageArg);
  const imageBuffer = fs.readFileSync(imagePath);
  const debugCropsDir = saveDebugCrops ? makeTempCropDir() : null;

  console.log(`[smoke] image: ${imagePath}`);
  console.log(`[smoke] bytes: ${imageBuffer.length}`);
  if (debugCropsDir) console.log(`[smoke] debug crops: ${debugCropsDir}`);

  const ocr = await recognizeNsrpImage(Tesseract, imageBuffer, {
    debugCropsDir,
    logWarnings: true,
  });
  const parsed = parseNsrpText(ocr.rawText, ocr.regions);
  const fieldCount = countExtractedFields(parsed);

  console.log(`[smoke] page_box: ${ocr.pageBox ? `${ocr.pageBox.width}x${ocr.pageBox.height}` : 'unknown'}`);
  console.log(`[smoke] anchor_dy: ${Number(ocr.dy || 0).toFixed(4)}`);
  console.log(`[smoke] raw_text length: ${String(ocr.rawText || '').trim().length}`);
  console.log('[smoke] checkboxes:');
  console.log(JSON.stringify(ocr.regions.__checkboxes || {}, null, 2));
  console.log('[smoke] ocr_regions:');
  console.log(JSON.stringify(ocr.regions, null, 2));
  console.log(`[smoke] field_count: ${fieldCount}`);
  console.log('[smoke] extracted_data:');
  console.log(JSON.stringify(parsed, null, 2));
})().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
