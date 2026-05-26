// Checkbox wide scan: find where the unemployed and new entrant checkmarks actually are
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),Tesseract=require('tesseract.js');
const LANG_PATH=path.resolve(__dirname,'..'),CACHE_PATH=path.join(LANG_PATH,'.tesseract-cache');
const image=fs.readFileSync(process.argv[2]||path.resolve(__dirname,'..','..','samples','nsrp-ocr','nsrp-page-1-sample.jpg'));
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

  // Print a horizontal density profile for a given row
  function rowProfile(label, y, xStart=0.05, xEnd=0.95, step=0.01, threshold=0.15) {
    const hits=[];
    for(let x=xStart;x<=xEnd;x+=step){
      const d=dens(bi,x,y);
      if(d>threshold) hits.push(`x=${x.toFixed(2)}:${d.toFixed(2)}`);
    }
    console.log(`${label} (y=${y.toFixed(3)}): ${hits.length?hits.join('  '):'(none above '+threshold+')'}`);
  }

  console.log('\n=== Employment Status row (y=0.430-0.445) density profile ===');
  for(const y of [0.430,0.432,0.434,0.436,0.438,0.440,0.443,0.446]) rowProfile(`Emp.Status`,y);

  console.log('\n=== Employment Type rows ===');
  for(const y of [0.454,0.457,0.460,0.463,0.466,0.469,0.472]) rowProfile(`EmpType`,y);

  console.log('\n=== Looking for work row ===');
  for(const y of [0.558,0.561,0.564,0.567,0.570]) rowProfile(`LookWork`,y);

  console.log('\n=== Willing to work row ===');
  for(const y of [0.565,0.568,0.571,0.574,0.577]) rowProfile(`Willing`,y);

  console.log('\n=== 4Ps row ===');
  for(const y of [0.599,0.602,0.605,0.608,0.611]) rowProfile(`4Ps`,y);

  console.log('\nDone.');
})().catch(e=>{console.error(e.message);process.exit(1);});
