'use strict';

// Finds where NSRP Form 1 sits in a photo or scan. The printed labels that appear once on the blank form
// (nsrpFormLabels.json: word, centre x/y as a fraction of the page, width) are matched with the words
// Tesseract found on the whole image, and a page transform (shift, scale, tilt, skew) is fitted to the
// matches, ignoring words that disagree. Field boxes are then measured on the blank form and mapped
// through this transform, so a moved, tilted or zoomed photo is read in the right places.
const LABELS = require('./nsrpFormLabels.json');

// Template coordinates are in pixels of the blank form rendered at 150 dpi (1240 x 1754).
const TEMPLATE_W = 1240;
const TEMPLATE_H = 1754;

const wordKey = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function parseTsvWords(tsv) {
  const words = [];
  for (const row of String(tsv || '').split(/\r?\n/)) {
    const c = row.split('\t');
    if (c.length < 12 || c[0] !== '5') continue;
    const conf = parseFloat(c[10]);
    const key = wordKey(c[11]);
    if (!key || conf < 40) continue;
    const left = +c[6]; const top = +c[7]; const width = +c[8]; const height = +c[9];
    words.push({ key, cx: left + width / 2, cy: top + height / 2, width, height, conf });
  }
  return words;
}

// Least squares for x' = a*x + b*y + c and y' = d*x + e*y + f.
function solveAffine(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  let sxx = 0; let sxy = 0; let syy = 0; let sx = 0; let sy = 0;
  let sxu = 0; let syu = 0; let su = 0; let sxv = 0; let syv = 0; let sv = 0;
  for (const p of pairs) {
    sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y; sx += p.x; sy += p.y;
    sxu += p.x * p.u; syu += p.y * p.u; su += p.u; sxv += p.x * p.v; syv += p.y * p.v; sv += p.v;
  }
  const m = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const solve3 = (r) => {
    const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
      - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
    const d = det(m);
    if (Math.abs(d) < 1e-9) return null;
    return [0, 1, 2].map((k) => det(m.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)))) / d);
  };
  const ux = solve3([sxu, syu, su]);
  const vy = solve3([sxv, syv, sv]);
  if (!ux || !vy) return null;
  return { a: ux[0], b: ux[1], c: ux[2], d: vy[0], e: vy[1], f: vy[2] };
}

// Perspective fit (a phone held at a slight angle makes the far side of the page smaller):
// x' = (a*x + b*y + c) / (g*x + h*y + 1), y' = (d*x + e*y + f) / (g*x + h*y + 1). Coordinates are divided
// by 1000 while solving to keep the numbers well-behaved.
function solveHomography(pairs) {
  if (pairs.length < 8) return null;
  const n = 8;
  const A = Array.from({ length: n }, () => new Float64Array(n + 1));
  const add = (row, rhs) => {
    for (let i = 0; i < n; i += 1) {
      if (!row[i]) continue;
      for (let j = 0; j < n; j += 1) A[i][j] += row[i] * row[j];
      A[i][n] += row[i] * rhs;
    }
  };
  for (const p of pairs) {
    const X = p.x / 1000; const Y = p.y / 1000; const U = p.u / 1000; const V = p.v / 1000;
    add([X, Y, 1, 0, 0, 0, -U * X, -U * Y], U);
    add([0, 0, 0, X, Y, 1, -V * X, -V * Y], V);
  }
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    if (Math.abs(A[pivot][col]) < 1e-12) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const k = A[row][col] / A[col][col];
      for (let j = col; j <= n; j += 1) A[row][j] -= k * A[col][j];
    }
  }
  const h = A.map((row, i) => row[n] / row[i]);
  return { a: h[0], b: h[1], c: h[2] * 1000, d: h[3], e: h[4], f: h[5] * 1000, g: h[6] / 1000, h: h[7] / 1000 };
}

const apply = (t, x, y) => {
  const w = (t.g || 0) * x + (t.h || 0) * y + 1;
  return { x: (t.a * x + t.b * y + t.c) / w, y: (t.d * x + t.e * y + t.f) / w };
};

// Returns a transform from template pixels to image pixels, or null when too few labels were found.
function fitPageTransform(tsv, pageType) {
  const template = LABELS[pageType];
  if (!template) return null;
  const byKey = new Map(template.map(([key, x, y]) => [key, { x: x * TEMPLATE_W, y: y * TEMPLATE_H }]));
  const seen = new Map();
  for (const w of parseTsvWords(tsv)) {
    if (!byKey.has(w.key)) continue;
    seen.set(w.key, seen.has(w.key) ? null : w); // a word read twice on the photo is ambiguous
  }
  let pairs = [];
  for (const [key, w] of seen) {
    if (!w) continue;
    const t = byKey.get(key);
    pairs.push({ key, x: t.x, y: t.y, u: w.cx, v: w.cy });
  }
  if (pairs.length < 8) return null;

  // Robust fit: start from the median scale/shift, then refit while dropping matches that disagree.
  let t = solveAffine(pairs);
  for (let round = 0; round < 6 && t; round += 1) {
    const err = pairs.map((p) => { const q = apply(t, p.x, p.y); return Math.hypot(q.x - p.u, q.y - p.v); });
    const sorted = [...err].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const limit = Math.max(6, median * 3);
    const kept = pairs.filter((_, i) => err[i] <= limit);
    if (kept.length === pairs.length || kept.length < 8) break;
    pairs = kept;
    t = solveAffine(pairs);
  }
  if (!t) return null;
  const scale = Math.sqrt(Math.abs(t.a * t.e - t.b * t.d));
  if (!(scale > 0.3 && scale < 5)) return null;
  const meanErrorOf = (fit) => pairs.reduce((sum, p) => {
    const q = apply(fit, p.x, p.y);
    return sum + Math.hypot(q.x - p.u, q.y - p.v);
  }, 0) / pairs.length;
  let meanError = meanErrorOf(t);
  // Use the perspective fit when it explains the labels better (it needs labels spread over the page).
  const persp = pairs.length >= 16 ? solveHomography(pairs) : null;
  if (persp && Number.isFinite(persp.a)) {
    const perspError = meanErrorOf(persp);
    if (perspError < meanError) { t = persp; meanError = perspError; }
  }
  return { ...t, scale, matches: pairs.length, meanError: Number(meanError.toFixed(2)) };
}

// Cuts a field box (fractions of the blank form) out of an image, straightened through the transform.
// image: { width, height, grey: Uint8Array } (0 = black). outScale: output pixels per blank-form pixel
// (default: the photo's own resolution).
function sampleRegion(image, t, region, pad = 0.003, outScale = null) {
  const [rx, ry, rw, rh] = region;
  const x0 = (rx - pad) * TEMPLATE_W; const y0 = (ry - pad) * TEMPLATE_H;
  const tw = (rw + pad * 2) * TEMPLATE_W; const th = (rh + pad * 2) * TEMPLATE_H;
  const s = outScale || t.scale;
  const width = Math.max(1, Math.round(tw * s)); const height = Math.max(1, Math.round(th * s));
  const grey = new Uint8Array(width * height);
  for (let v = 0; v < height; v += 1) {
    for (let u = 0; u < width; u += 1) {
      const q = apply(t, x0 + u / s, y0 + v / s);
      const fx = q.x - 0.5; const fy = q.y - 0.5;
      const ix = Math.floor(fx); const iy = Math.floor(fy);
      if (ix < 0 || iy < 0 || ix + 1 >= image.width || iy + 1 >= image.height) { grey[v * width + u] = 255; continue; }
      const ax = fx - ix; const ay = fy - iy; const i = iy * image.width + ix;
      const top = image.grey[i] * (1 - ax) + image.grey[i + 1] * ax;
      const bottom = image.grey[i + image.width] * (1 - ax) + image.grey[i + image.width + 1] * ax;
      grey[v * width + u] = Math.round(top * (1 - ay) + bottom * ay);
    }
  }
  return { width, height, grey };
}

// Maps a point given as fractions of the blank form to image pixels.
function mapFraction(t, fx, fy) {
  return apply(t, fx * TEMPLATE_W, fy * TEMPLATE_H);
}

module.exports = { fitPageTransform, sampleRegion, mapFraction, parseTsvWords, TEMPLATE_W, TEMPLATE_H };
