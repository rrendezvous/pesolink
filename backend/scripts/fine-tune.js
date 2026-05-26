// Fine-tune scan: find exact column/row for date of birth cell value and checkboxes
'use strict';
const fs=require('fs'), path=require('path'), Tesseract=require('tesseract.js');
const LANG_PATH=path.resolve(__dirname,'..'), CACHE_PATH=path.join(LANG_PATH,'.tesseract-cache');
const image=fs.readFileSync(process.argv[2]||'figma-reference/NSRP_Form_1_ssamplepg1.jpg');
const PAGE_H=1755, PAGE_W=1240;
(async()=>{
  const w=await Tesseract.createWorker('eng',1,{langPath:LANG_PATH,cachePath:CACHE_PATH,cacheMethod:'write',gzip:false,logger:()=>{}});
  await w.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,user_defined_dpi:'300'});

  async function scan(label, x, y, wf, hf) {
    const r=await w.recognize(image,{rectangle:{left:Math.round(PAGE_W*x),top:Math.round(PAGE_H*y),width:Math.round(PAGE_W*wf),height:Math.round(PAGE_H*hf)}},{text:true});
    const val=(r.data?.text||'').replace(/\s+/g,' ').trim().slice(0,100);
    console.log(`  ${label.padEnd(35)}: "${val}"`);
  }

  console.log('\n=== DOB data cell (y=0.210, scanning right portion of row) ===');
  await scan('dob x=0.12..0.38',    0.12, 0.208, 0.26, 0.028);
  await scan('dob x=0.14..0.36',    0.14, 0.208, 0.22, 0.028);
  await scan('dob x=0.16..0.34',    0.16, 0.208, 0.20, 0.028);
  await scan('dob x=0.18..0.32',    0.18, 0.208, 0.18, 0.028);
  await scan('dob x=0.20..0.30',    0.20, 0.208, 0.14, 0.028);
  // Test y range too
  await scan('dob y=0.205',         0.14, 0.205, 0.22, 0.026);
  await scan('dob y=0.208',         0.14, 0.208, 0.22, 0.026);
  await scan('dob y=0.211',         0.14, 0.211, 0.22, 0.026);

  console.log('\n=== Place of Birth (right half of same row) ===');
  await scan('pob x=0.50..0.48',    0.50, 0.208, 0.48, 0.026);
  await scan('pob x=0.52..0.46',    0.52, 0.208, 0.46, 0.026);
  await scan('pob x=0.55..0.43',    0.55, 0.208, 0.43, 0.026);

  console.log('\n=== Religion row (y=0.245) ===');
  await scan('religion y=0.240',    0.025, 0.240, 0.24, 0.028);
  await scan('religion y=0.242',    0.025, 0.242, 0.24, 0.028);
  await scan('religion y=0.245',    0.025, 0.245, 0.24, 0.028);

  console.log('\n=== Address rows ===');
  await scan('house y=0.240',       0.625, 0.240, 0.355, 0.026);
  await scan('house y=0.242',       0.625, 0.242, 0.355, 0.026);
  await scan('village y=0.252',     0.625, 0.252, 0.355, 0.024);
  await scan('village y=0.255',     0.625, 0.255, 0.355, 0.024);
  await scan('barangay y=0.270',    0.625, 0.270, 0.355, 0.024);
  await scan('barangay y=0.273',    0.625, 0.273, 0.355, 0.024);
  await scan('city y=0.285',        0.625, 0.285, 0.355, 0.024);
  await scan('city y=0.288',        0.625, 0.288, 0.355, 0.024);
  await scan('province y=0.300',    0.625, 0.300, 0.355, 0.024);
  await scan('province y=0.303',    0.625, 0.303, 0.355, 0.024);

  console.log('\n=== GOV ID rows ===');
  await scan('tin y=0.320',         0.155, 0.320, 0.290, 0.026);
  await scan('tin y=0.322',         0.155, 0.322, 0.290, 0.026);
  await scan('gsis y=0.337',        0.155, 0.337, 0.290, 0.026);
  await scan('gsis y=0.340',        0.155, 0.340, 0.290, 0.026);
  await scan('pagibig y=0.353',     0.155, 0.353, 0.290, 0.026);
  await scan('pagibig y=0.356',     0.155, 0.356, 0.290, 0.026);
  await scan('philhealth y=0.370',  0.155, 0.370, 0.290, 0.026);
  await scan('philhealth y=0.373',  0.155, 0.373, 0.290, 0.026);

  console.log('\n=== Contact rows (right column) ===');
  await scan('height y=0.320 x=0.72',   0.720, 0.320, 0.26, 0.026);
  await scan('email y=0.337 x=0.72',    0.720, 0.337, 0.26, 0.026);
  await scan('email y=0.340 x=0.72',    0.720, 0.340, 0.26, 0.026);
  await scan('landline y=0.353 x=0.72', 0.720, 0.353, 0.26, 0.026);
  await scan('cell y=0.370 x=0.72',     0.720, 0.370, 0.26, 0.026);
  await scan('cell y=0.373 x=0.72',     0.720, 0.373, 0.26, 0.026);

  console.log('\n=== Occupation row 1 (y=0.660) ===');
  await scan('occ1 y=0.658',        0.025, 0.658, 0.240, 0.026);
  await scan('occ1 y=0.660',        0.025, 0.660, 0.240, 0.026);
  await scan('occ1 y=0.655',        0.025, 0.655, 0.240, 0.026);
  await scan('occ1 full-row',       0.025, 0.658, 0.960, 0.026);

  await w.terminate();
  console.log('\nDone.');
})().catch(e=>{console.error(e.message);process.exit(1);});
