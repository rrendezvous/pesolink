// Final calibration: address data cells (right side), gov ID data cells
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
    console.log(`  ${label.padEnd(42)}: "${val}"`);
  }

  // From y-scan we know right column addresses at:
  //   y=0.240: "RELIGION NA | HouseNo./Street 1 T2ZRIZALSTREET"
  //   y=0.255: "| RELIGION na [I |" <- village in right side
  //   y=0.270-0.275: CIVIL STATUS / Barangay 
  //   y=0.285-0.290: Municipality / City
  //   y=0.300-0.310: Province
  // The right column data cells: LEFT edge is at approx x=0.73 (after "House No./Street" label)
  // The "House No./Street", "Village", "Barangay", "Municipality/City", "Province" labels
  // are on the LEFT side of the right column (~x=0.50..0.72), data on right (~x=0.72..0.98)

  console.log('\n=== Address - RIGHT data column only (x=0.72..0.98) ===');
  // House No./Street data cell
  await scan('house data y=0.239 x=0.72', 0.72, 0.239, 0.26, 0.027);
  await scan('house data y=0.242 x=0.72', 0.72, 0.242, 0.26, 0.027);
  await scan('house data y=0.244 x=0.72', 0.72, 0.244, 0.26, 0.027);
  // Village data cell
  await scan('village y=0.253 x=0.72',    0.72, 0.253, 0.26, 0.027);
  await scan('village y=0.256 x=0.72',    0.72, 0.256, 0.26, 0.027);
  await scan('village y=0.259 x=0.72',    0.72, 0.259, 0.26, 0.027);
  // Barangay data cell
  await scan('barangay y=0.270 x=0.72',   0.72, 0.270, 0.26, 0.027);
  await scan('barangay y=0.273 x=0.72',   0.72, 0.273, 0.26, 0.027);
  await scan('barangay y=0.276 x=0.72',   0.72, 0.276, 0.26, 0.027);
  // City data cell
  await scan('city y=0.285 x=0.72',       0.72, 0.285, 0.26, 0.027);
  await scan('city y=0.288 x=0.72',       0.72, 0.288, 0.26, 0.027);
  await scan('city y=0.291 x=0.72',       0.72, 0.291, 0.26, 0.027);
  // Province data cell
  await scan('province y=0.300 x=0.72',   0.72, 0.300, 0.26, 0.025);
  await scan('province y=0.303 x=0.72',   0.72, 0.303, 0.26, 0.025);
  await scan('province y=0.306 x=0.72',   0.72, 0.306, 0.26, 0.025);

  // Gov IDs — The actual data is NA for all, right of the label.
  // From y-scan: y=0.320 "TIN NA HEIGHT 170 CM"
  // The TIN data column appears to be: right of "TIN" label, which is about x=0.08..0.15, data at ~x=0.16..0.44
  // But also there's HEIGHT column on the RIGHT
  // So TIN data: x~0.16..0.45
  // GSIS: same x range, y~0.337
  // PAG-IBIG: y~0.353
  // PhilHealth: y~0.370
  console.log('\n=== GOV ID data columns (left half) ===');
  // TIN: let's scan the right of "TIN" label which ends at about x=0.10, data starts ~x=0.10
  await scan('tin  x=0.10 w=0.40 y=0.322',  0.10, 0.322, 0.40, 0.026);
  await scan('tin  x=0.15 w=0.35 y=0.322',  0.15, 0.322, 0.35, 0.026);
  await scan('tin  x=0.20 w=0.30 y=0.322',  0.20, 0.322, 0.30, 0.026);
  await scan('tin  x=0.25 w=0.25 y=0.322',  0.25, 0.322, 0.25, 0.026);
  await scan('gsis x=0.25 w=0.25 y=0.340',  0.25, 0.340, 0.25, 0.026);
  await scan('gsis x=0.20 w=0.30 y=0.340',  0.20, 0.340, 0.30, 0.026);
  await scan('pag  x=0.20 w=0.30 y=0.355',  0.20, 0.355, 0.30, 0.026);
  await scan('phh  x=0.20 w=0.30 y=0.372',  0.20, 0.372, 0.30, 0.026);
  // Test wider range to see where NA actually is
  await scan('tin  x=0.05 w=0.55 y=0.322',  0.05, 0.322, 0.55, 0.026);
  await scan('gsis x=0.05 w=0.55 y=0.340',  0.05, 0.340, 0.55, 0.026);
  await scan('pag  x=0.05 w=0.55 y=0.355',  0.05, 0.355, 0.55, 0.026);
  await scan('phh  x=0.05 w=0.55 y=0.372',  0.05, 0.372, 0.55, 0.026);

  console.log('\n=== Salary data only ===');
  // Expected salary: y=0.770
  await scan('salary x=0.20 w=0.15 y=0.770',  0.20, 0.770, 0.15, 0.022);
  await scan('salary x=0.22 w=0.13 y=0.770',  0.22, 0.770, 0.13, 0.022);
  await scan('salary x=0.24 w=0.11 y=0.770',  0.24, 0.770, 0.11, 0.022);

  await w.terminate();
  console.log('\nDone.');
})().catch(e=>{console.error(e.message);process.exit(1);});
