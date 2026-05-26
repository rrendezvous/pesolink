// X-scan script: scan horizontal strips at a given Y to find text column positions
// Usage: node scripts/x-scan.js <image> <y_fraction>
// e.g.:  node scripts/x-scan.js ../samples/nsrp-ocr/nsrp-page-1-sample.jpg 0.175
'use strict';
const fs=require('fs'), path=require('path'), Tesseract=require('tesseract.js');
const LANG_PATH=path.resolve(__dirname,'..'), CACHE_PATH=path.join(LANG_PATH,'.tesseract-cache');
const image=fs.readFileSync(process.argv[2]);
const Y_FRAC=parseFloat(process.argv[3]||'0.175');
const PAGE_H=1755, PAGE_W=1240;
(async()=>{
  const w=await Tesseract.createWorker('eng',1,{langPath:LANG_PATH,cachePath:CACHE_PATH,cacheMethod:'write',gzip:false,logger:()=>{}});
  await w.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,user_defined_dpi:'300'});
  const top=Math.round(PAGE_H*Y_FRAC);
  console.log(`\n=== X-column scan at y=${Y_FRAC} (top=${top}px), height=32px ===`);
  // Test various x-start positions in the name row
  const testXs=[
    [0.00,0.25,'full-left'],[0.02,0.22,'surname'],[0.03,0.21,'s-narrow'],
    [0.25,0.23,'first-a'],[0.26,0.23,'first-b'],[0.27,0.23,'first-c'],[0.28,0.20,'first-d'],
    [0.50,0.23,'mid-a'],[0.52,0.22,'mid-b'],[0.54,0.20,'mid-c'],
    [0.75,0.23,'suf-a'],[0.77,0.20,'suf-b'],
  ];
  for(const[x,wf,label]of testXs){
    const r=await w.recognize(image,{rectangle:{left:Math.round(PAGE_W*x),top,width:Math.round(PAGE_W*wf),height:32}},{text:true});
    const val=(r.data?.text||'').replace(/\s+/g,' ').trim().slice(0,80);
    if(val) console.log(`  x=${x.toFixed(3)} w=${wf.toFixed(3)} [${label}]: "${val}"`);
  }
  // Also scan the contact rows
  const contactY=Math.round(PAGE_H*0.375);
  console.log(`\n=== Contact row scan at y=0.375 (top=${contactY}px), height=28px ===`);
  const cxs=[[0.60,0.38,'all-right'],[0.65,0.33,'right-a'],[0.70,0.28,'right-b'],[0.72,0.26,'right-c']];
  for(const[x,wf,label]of cxs){
    const r=await w.recognize(image,{rectangle:{left:Math.round(PAGE_W*x),top:contactY,width:Math.round(PAGE_W*wf),height:28}},{text:true});
    const val=(r.data?.text||'').replace(/\s+/g,' ').trim().slice(0,80);
    if(val) console.log(`  x=${x.toFixed(3)} w=${wf.toFixed(3)} [${label}]: "${val}"`);
  }
  // DOB scan
  const dobY=Math.round(PAGE_H*0.210);
  console.log(`\n=== DOB row scan at y=0.210 (top=${dobY}px), height=28px ===`);
  const dxs=[[0.03,0.50,'full-row'],[0.10,0.30,'dob-a'],[0.13,0.26,'dob-b'],[0.15,0.24,'dob-c'],[0.17,0.22,'dob-d'],[0.20,0.18,'dob-e']];
  for(const[x,wf,label]of dxs){
    const r=await w.recognize(image,{rectangle:{left:Math.round(PAGE_W*x),top:dobY,width:Math.round(PAGE_W*wf),height:28}},{text:true});
    const val=(r.data?.text||'').replace(/\s+/g,' ').trim().slice(0,80);
    if(val) console.log(`  x=${x.toFixed(3)} w=${wf.toFixed(3)} [${label}]: "${val}"`);
  }
  await w.terminate();
  console.log('\nDone.');
})().catch(e=>{console.error(e.message);process.exit(1);});
