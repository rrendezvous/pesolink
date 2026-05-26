// Fine-tune scan round 2: DOB cell exact position, address columns, gov ID columns
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
    console.log(`  ${label.padEnd(40)}: "${val}"`);
  }

  // The DOB field: scanning right side of the DOB label row only
  console.log('\n=== DOB - scanning within data cell (right of DATE OF BIRTH label) ===');
  // Form has DATE OF BIRTH label ~x=0.02..0.26, then DOB value box x≈0.26..0.47
  await scan('dob x=0.26 w=0.22', 0.26, 0.208, 0.22, 0.027);
  await scan('dob x=0.27 w=0.21', 0.27, 0.208, 0.21, 0.027);
  await scan('dob x=0.28 w=0.20', 0.28, 0.208, 0.20, 0.027);
  await scan('dob x=0.30 w=0.18', 0.30, 0.208, 0.18, 0.027);
  // And PLACE OF BIRTH right column: from ~x=0.67..0.98 (the actual data cell not the label)
  console.log('\n=== PLACE OF BIRTH - data cell (right of "PLACE OF BIRTH" label) ===');
  await scan('pob x=0.67 w=0.31', 0.67, 0.208, 0.31, 0.027);
  await scan('pob x=0.70 w=0.28', 0.70, 0.208, 0.28, 0.027);
  await scan('pob x=0.72 w=0.26', 0.72, 0.208, 0.26, 0.027);
  await scan('pob x=0.75 w=0.23', 0.75, 0.208, 0.23, 0.027);

  // Religion: need to start AFTER the "RELIGION" label text
  console.log('\n=== RELIGION data cell (right of RELIGION label) ===');
  await scan('relig x=0.12 w=0.14', 0.12, 0.242, 0.14, 0.027);
  await scan('relig x=0.14 w=0.12', 0.14, 0.242, 0.12, 0.027);
  await scan('relig x=0.16 w=0.10', 0.16, 0.242, 0.10, 0.027);

  // Address - the right column ADDRESSES
  // y-scan shows: village at y~0.255, barangay at y~0.270, city at y~0.285, province at y~0.300
  // But the cells are small. Need correct x too. Looking at the form: right column starts ~0.50
  console.log('\n=== Address cells (right column, testing x range) ===');
  await scan('house x=0.50 y=0.239',  0.50, 0.239, 0.48, 0.027);
  await scan('house x=0.55 y=0.239',  0.55, 0.239, 0.43, 0.027);
  await scan('house x=0.60 y=0.239',  0.60, 0.239, 0.38, 0.027);
  await scan('village x=0.50 y=0.252',0.50, 0.252, 0.48, 0.027);
  await scan('village x=0.55 y=0.252',0.55, 0.252, 0.43, 0.027);
  await scan('village x=0.60 y=0.252',0.60, 0.252, 0.43, 0.027);
  await scan('barangay x=0.50 y=0.268',0.50,0.268, 0.48, 0.027);
  await scan('barangay x=0.55 y=0.268',0.55,0.268, 0.43, 0.027);
  await scan('city x=0.50 y=0.285',   0.50, 0.285, 0.48, 0.027);
  await scan('city x=0.55 y=0.285',   0.55, 0.285, 0.43, 0.027);
  await scan('city x=0.58 y=0.285',   0.58, 0.285, 0.40, 0.027);
  await scan('province x=0.50 y=0.300',0.50,0.300, 0.48, 0.025);
  await scan('province x=0.55 y=0.300',0.55,0.300, 0.43, 0.025);

  // Gov IDs — testing x positions to skip labels  
  console.log('\n=== GOV ID data cells (testing x to skip label) ===');
  await scan('tin     x=0.26 y=0.320', 0.26, 0.320, 0.18, 0.026);
  await scan('tin     x=0.29 y=0.320', 0.29, 0.320, 0.15, 0.026);
  await scan('gsis    x=0.26 y=0.337', 0.26, 0.337, 0.18, 0.026);
  await scan('gsis    x=0.26 y=0.340', 0.26, 0.340, 0.18, 0.026);
  await scan('pagibig x=0.26 y=0.353', 0.26, 0.353, 0.18, 0.026);
  await scan('pagibig x=0.26 y=0.356', 0.26, 0.356, 0.18, 0.026);
  await scan('phh     x=0.26 y=0.370', 0.26, 0.370, 0.18, 0.026);
  // Full cell from label column start - test right side
  await scan('tin     RIGHT x=0.28', 0.28, 0.320, 0.15, 0.026);
  await scan('gsis    RIGHT x=0.28', 0.28, 0.337, 0.15, 0.026);

  console.log('\n=== Expected Salary - narrow cell ===');
  await scan('salary x=0.165 y=0.765', 0.165, 0.765, 0.200, 0.022);
  await scan('salary x=0.155 y=0.765', 0.155, 0.765, 0.210, 0.022);

  await w.terminate();
  console.log('\nDone.');
})().catch(e=>{console.error(e.message);process.exit(1);});
