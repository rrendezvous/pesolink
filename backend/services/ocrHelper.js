'use strict';

// Second reader for handwritten answers: the PaddleOCR helper (ocr-helper/server.py), reached over HTTP.
// Tesseract reads every box first. Boxes with writing are also sent to the helper (except those Tesseract read as
// "NA"), and the helper's reading is used instead, because it reads handwriting much better. When the two readings differ the
// box is marked unsure, so the review screen asks the person to check it. If OCR_HELPER_URL is not set, or the
// helper is down or slow, Tesseract's readings are kept unchanged.

// Read when used (not at load), so the setting in .env applies however the module was loaded.
const helperUrl = () => (process.env.OCR_HELPER_URL || '').replace(/\/+$/, '');
const helperTimeoutMs = () => Number(process.env.OCR_HELPER_TIMEOUT_MS || 30000);
const SURE = 90;
const UNSURE = 50;

// Boxes that only hold digits: letters that look like digits are read as digits (the helper has no character list).
const DIGIT_BOXES = /^(tin|gsis_sss_no|pagibig_no|philhealth_no|cell_phone_number|landline_number|household_id|date_of_birth|passport_expiry|.*_year|.*_last_attended)$/;
const DIGIT_LOOKALIKES = { O: '0', o: '0', C: '0', c: '0', D: '0', U: '0', u: '0', I: '1', l: '1', '|': '1', i: '1', Z: '2', z: '2',
  A: '4', S: '5', s: '5', G: '6', b: '6', T: '7', B: '8', g: '9', q: '9' };
const asDigits = (t) => t.replace(/[OoCcDUuIl|iZzASsGbTBgq]/g, (ch) => DIGIT_LOOKALIKES[ch]);
const isBlankOrNa = (t) => /^(|N\W?A\W?)$/i.test(String(t || '').replace(/\s+/g, ''));
// Tesseract reads a written "NA" reliably; such boxes are not sent to the helper.
const isNa = (t) => /^N\W?A\W?$/i.test(String(t || '').replace(/\s+/g, ''));
// Boxes with a known number of digits. When Tesseract's reading has the right number and the helper's does not,
// Tesseract's reading is kept (still marked unsure).
const DIGIT_COUNTS = {
  cell_phone_number: [11], date_of_birth: [8], tin: [9, 12], gsis_sss_no: [10, 11], philhealth_no: [12], pagibig_no: [12],
};
const digitCounts = (name) => DIGIT_COUNTS[name] || (/_(year|last_attended)$/.test(name) ? [4] : null);
const fitsShape = (name, t) => digitCounts(name).includes(String(t || '').replace(/\D/g, '').length);
const letters = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Trims a binary PGM (P5) box image to its dark pixels plus a margin, so requests stay small (the boxes are
// mostly white space). Anything that is not a P5 image is sent unchanged.
function trimPgm(buf, margin = 24) {
  const head = buf.toString('latin1', 0, 40).match(/^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/);
  if (!head) return buf;
  const [, w, h] = head.map(Number);
  const px = buf.subarray(head[0].length);
  if (px.length < w * h) return buf;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (px[y * w + x] < 196) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return buf;
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin);
  x1 = Math.min(w - 1, x1 + margin); y1 = Math.min(h - 1, y1 + margin);
  const W = x1 - x0 + 1; const H = y1 - y0 + 1;
  const out = Buffer.alloc(W * H);
  for (let y = 0; y < H; y += 1) px.copy(out, y * W, (y + y0) * w + x0, (y + y0) * w + x0 + W);
  return Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`, 'ascii'), out]);
}

function helperEnabled() {
  return Boolean(helperUrl());
}

// Sends the box images (PGM buffers) in one request. Returns an array of texts (same order), or null when the
// helper is off, down, slow or answers with something unexpected.
async function readBoxes(images) {
  const url = helperUrl();
  if (!url || !images.length) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), helperTimeoutMs());
  try {
    const res = await fetch(`${url}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: images.map((b) => trimPgm(b).toString('base64')) }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.texts) && body.texts.length === images.length ? body.texts.map((t) => String(t ?? '')) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Puts the helper's readings into regions (and regions.__confidence). names[i] is the box read as texts[i].
function mergeHelperReadings(regions, names, texts) {
  const confidence = regions.__confidence || (regions.__confidence = {});
  names.forEach((name, i) => {
    const tesseract = regions[name];
    if (isNa(tesseract)) return;
    let text = String(texts[i] || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (isBlankOrNa(text)) text = 'NA';
    if (DIGIT_BOXES.test(name) && text !== 'NA') text = asDigits(text);
    if (digitCounts(name) && fitsShape(name, tesseract) && !fitsShape(name, text)) {
      confidence[name] = Math.min(confidence[name] ?? UNSURE, UNSURE);
      return;
    }
    regions[name] = text;
    confidence[name] = letters(text) === letters(tesseract) ? Math.max(SURE, confidence[name] || 0) : UNSURE;
  });
  regions.__second_reader = 'paddleocr';
}

// Started with the backend (server.js): when OCR_HELPER_URL is not set and the helper has been set up
// (npm run ocr:setup), it is started on this machine (127.0.0.1 only) and used. OCR_HELPER_AUTO=off turns this off;
// a server that runs the helper as its own service sets OCR_HELPER_URL instead.
function startLocalHelper() {
  if (process.env.OCR_HELPER_URL || process.env.OCR_HELPER_AUTO === 'off') return null;
  const { venvPython, HELPER_DIR } = require('../scripts/ocr-helper');
  const fs = require('fs');
  if (!fs.existsSync(venvPython())) {
    console.log('[OCR] Second reader (PaddleOCR) not set up: scans use Tesseract only. To add it once: npm run ocr:setup');
    return null;
  }
  const port = process.env.OCR_HELPER_PORT || '8765';
  process.env.OCR_HELPER_URL = `http://127.0.0.1:${port}`;
  const { spawn } = require('child_process');
  const child = spawn(venvPython(), [require('path').join(HELPER_DIR, 'server.py')], {
    cwd: HELPER_DIR, env: { ...process.env, OCR_HELPER_PORT: port }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { const line = String(d).trim(); if (line) console.log(`[OCR helper] ${line}`); });
  child.stderr.on('data', () => {}); // model download and library notices
  // If another backend on this computer already runs the helper, this copy stops at once and that one is used.
  child.on('exit', (code) => { if (code) console.log('[OCR helper] stopped (another copy may already be running); scans still work'); });
  const stop = () => { try { child.kill(); } catch (_) { /* already stopped */ } };
  process.on('exit', stop);
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
  console.log(`[OCR] Second reader (PaddleOCR) starting on 127.0.0.1:${port}; scans use Tesseract only until it is ready`);
  return child;
}

module.exports = { helperEnabled, readBoxes, mergeHelperReadings, isNa, startLocalHelper };
