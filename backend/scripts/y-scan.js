"use strict";
const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");
const LANG_PATH = path.resolve(__dirname, "..");
const CACHE_PATH = path.join(LANG_PATH, ".tesseract-cache");
const image = fs.readFileSync(process.argv[2]);
const PAGE_W = 1240, PAGE_H = 1755; // known from earlier test

(async () => {
  const worker = await Tesseract.createWorker("eng", 1, {
    langPath: LANG_PATH, cachePath: CACHE_PATH, cacheMethod: "write", gzip: false, logger: () => {},
  });
  await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, user_defined_dpi: "300" });

  // Scan full-width strips at various Y fractions to find what text is there
  const testYs = [0.14, 0.15, 0.155, 0.16, 0.165, 0.17, 0.175, 0.18, 0.185, 0.19, 0.195, 0.20,
                  0.205, 0.21, 0.215, 0.22, 0.225, 0.23, 0.235, 0.24, 0.245, 0.25];
  console.log("\n=== Y-scan strips (full width, height=30px each) ===");
  for (const y of testYs) {
    const top = Math.round(PAGE_H * y);
    const r = await worker.recognize(image, {
      rectangle: { left: 5, top, width: 1230, height: 30 }
    }, { text: true });
    const val = (r.data?.text || "").replace(/\s+/g, " ").trim().slice(0, 120);
    console.log(`  y=${y.toFixed(3)} (top=${top}px): "${val}"`);
  }

  await worker.terminate();
})().catch(e => { console.error(e.message); process.exit(1); });
