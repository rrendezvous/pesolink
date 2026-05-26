"use strict";
const fs = require("fs"), path = require("path"), Tesseract = require("tesseract.js");
const LANG_PATH = path.resolve(__dirname, "..");
const CACHE_PATH = path.join(LANG_PATH, ".tesseract-cache");
const image = fs.readFileSync(process.argv[2]);
const PAGE_H = 1755;
(async () => {
  const w = await Tesseract.createWorker("eng", 1, {langPath:LANG_PATH,cachePath:CACHE_PATH,cacheMethod:"write",gzip:false,logger:()=>{}});
  await w.setParameters({tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, user_defined_dpi:"300"});
  const ys = [0.255,0.26,0.265,0.27,0.275,0.28,0.285,0.29,0.295,0.30,
               0.305,0.31,0.315,0.32,0.325,0.33,0.335,0.34,0.345,0.35,
               0.355,0.36,0.365,0.37,0.375,0.38,0.385,0.39,0.395,0.40,
               0.41,0.42,0.43,0.44,0.45,0.46,0.47,0.48,0.49,0.50,
               0.51,0.52,0.53,0.54,0.55,0.56,0.57,0.58,0.59,0.60,
               0.61,0.62,0.63,0.64,0.65,0.66,0.67,0.68,0.69,0.70,
               0.71,0.72,0.73,0.74,0.75,0.76,0.77,0.78,0.79,0.80,
               0.81,0.82,0.83,0.84,0.85,0.86,0.87,0.88,0.89,0.90,
               0.91,0.92,0.93,0.94,0.95,0.96,0.97];
  for (const y of ys) {
    const top = Math.round(PAGE_H*y);
    const r = await w.recognize(image,{rectangle:{left:5,top,width:1230,height:28}},{text:true});
    const v = (r.data?.text||"").replace(/\s+/g," ").trim().slice(0,110);
    if (v.length > 2) console.log(`  y=${y.toFixed(3)} (${top}px): "${v}"`);
  }
  await w.terminate();
})().catch(e=>{console.error(e.message);process.exit(1);});
