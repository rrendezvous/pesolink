// Checkbox calibration: scan checkbox positions to find actual tick mark densities
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),Tesseract=require('tesseract.js');
const LANG_PATH=path.resolve(__dirname,'..'),CACHE_PATH=path.join(LANG_PATH,'.tesseract-cache');
const image=fs.readFileSync(process.argv[2]||path.resolve(__dirname,'..','..','samples','nsrp-ocr','nsrp-page-1-sample.jpg'));
const PAGE_H=1755,PAGE_W=1240;

// Minimal PNG decoder for binary image
function paethPred(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decodePng(buf){
  let off=8,w=0,h=0,bd=0,ct=0;const idat=[];
  while(off<buf.length){const len=buf.readUInt32BE(off),type=buf.subarray(off+4,off+8).toString('ascii'),data=buf.subarray(off+8,off+8+len);off+=12+len;
    if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);bd=data[8];ct=data[9];}
    else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;}
  const ch=ct===0?1:ct===2?3:ct===4?2:ct===6?4:0,bpp=ch*bd,Bpp=Math.max(1,Math.ceil(bpp/8)),rb=Math.ceil(w*bpp/8);
  const inf=zlib.inflateSync(Buffer.concat(idat));const rows=[];let inp=0;
  for(let y=0;y<h;y++){const f=inf[inp++],row=Buffer.from(inf.subarray(inp,inp+rb));inp+=rb;const prev=rows[y-1];
    for(let x=0;x<rb;x++){const l=x>=Bpp?row[x-Bpp]:0,u=prev?prev[x]:0,ul=prev&&x>=Bpp?prev[x-Bpp]:0;
      if(f===1)row[x]=(row[x]+l)&0xff;else if(f===2)row[x]=(row[x]+u)&0xff;
      else if(f===3)row[x]=(row[x]+Math.floor((l+u)/2))&0xff;
      else if(f===4)row[x]=(row[x]+paethPred(l,u,ul))&0xff;}rows.push(row);}
  const black=new Uint8Array(w*h);
  for(let y=0;y<h;y++){const row=rows[y];for(let x=0;x<w;x++){
    let v=255;if(ct===0&&bd===1)v=((row[Math.floor(x/8)]>>(7-(x%8)))&1)?255:0;
    else if(ct===0)v=row[x];else if(ct===2){const i=x*3;v=Math.round((row[i]+row[i+1]+row[i+2])/3);}
    else if(ct===6){const i=x*4;v=row[i+3]===0?255:Math.round((row[i]+row[i+1]+row[i+2])/3);}
    black[y*w+x]=v<160?1:0;}}
  return{width:w,height:h,black};
}
function dens(bi,cx_,cy_,size=0.016){
  const cx=Math.round(bi.width*cx_),cy=Math.round(bi.height*cy_);
  const half=Math.max(3,Math.round(Math.min(bi.width,bi.height)*size*0.5));
  let tot=0,blk=0;
  for(let y=cy-half+1;y<=cy+half-1;y++)for(let x=cx-half+1;x<=cx+half-1;x++){if(x<0||y<0||x>=bi.width||y>=bi.height)continue;tot++;blk+=bi.black[y*bi.width+x];}
  return tot?blk/tot:0;
}

(async()=>{
  const wk=await Tesseract.createWorker('eng',1,{langPath:LANG_PATH,cachePath:CACHE_PATH,cacheMethod:'write',gzip:false,logger:()=>{}});
  await wk.setParameters({tessedit_pageseg_mode:Tesseract.PSM.AUTO,user_defined_dpi:'300'});
  const full=await wk.recognize(image,{},{text:true,imageBinary:true});
  await wk.terminate();
  const b64=(full.data?.imageBinary||'').replace(/^data:image\/png;base64,/,'');
  const bi=decodePng(Buffer.from(b64,'base64'));
  console.log(`Binary image: ${bi.width}x${bi.height}`);

  function densRow(label, ys, xs) {
    console.log(`\n--- ${label} ---`);
    for(const y of ys) {
      const row=xs.map(x=>`x=${x.toFixed(3)}:${dens(bi,x,y).toFixed(3)}`).join('  ');
      console.log(`  y=${y.toFixed(3)}: ${row}`);
    }
  }

  // Gender: SEX checkbox row at y~0.228-0.234
  densRow('Gender (Male=checked)',
    [0.225,0.228,0.231,0.234,0.237],
    [0.280,0.285,0.290,0.295,0.300,0.305,0.420,0.425,0.430,0.435,0.440]);

  // Civil status: Single checkbox at y~0.274-0.280
  densRow('Civil Status (Single=checked)',
    [0.272,0.275,0.278,0.281,0.284],
    [0.080,0.085,0.090,0.095,0.100,0.105,0.110,0.270,0.275,0.280,0.285]);

  // Employment Status (Unemployed=checked) at y~0.428-0.438
  densRow('Employment Status (Unemployed=checked)',
    [0.428,0.432,0.436,0.440,0.444],
    [0.125,0.130,0.135,0.140,0.145,0.340,0.350,0.355,0.360,0.365,0.370,0.375]);

  // Employment Type: New Entrant/Fresh Graduate at y~0.460
  densRow('Employment Type (New Entrant=checked)',
    [0.457,0.460,0.463,0.466,0.469],
    [0.130,0.135,0.140,0.145,0.150,0.350,0.355,0.360,0.365,0.370,0.375,0.600,0.615,0.625]);

  // Looking for work: No=checked (y~0.560)
  densRow('Looking for work (No=checked)',
    [0.556,0.559,0.562,0.565,0.568],
    [0.325,0.330,0.335,0.340,0.345,0.390,0.395,0.400,0.405,0.410,0.415]);

  // Willing to work: Yes=checked (y~0.570)
  densRow('Willing to work (Yes=checked)',
    [0.566,0.569,0.572,0.575,0.578],
    [0.280,0.285,0.290,0.295,0.300,0.375,0.380,0.385,0.390,0.395]);

  // 4Ps: No=checked (y~0.600)
  densRow('4Ps beneficiary (No=checked)',
    [0.596,0.599,0.602,0.605,0.608],
    [0.205,0.210,0.215,0.220,0.225,0.275,0.280,0.285,0.290,0.295,0.300]);

  console.log('\nDone.');
})().catch(e=>{console.error(e.message);process.exit(1);});
