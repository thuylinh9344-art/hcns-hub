/* Máy đồng bộ chạy định kỳ trên GitHub Actions: mở web HCNS trong Chrome headless với tài khoản dịch vụ,
   đọc 3 link (Theo dõi nhà mới, Data nhân sự 2026, Hồ sơ tuyển dụng) và ghi vào Firestore bằng chính code của web.
   Không in dữ liệu nhân sự ra log (repo công khai) – chỉ in số đếm. */
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
import {chromium} from 'playwright-core';
const HERE=path.dirname(fileURLToPath(import.meta.url));const PUB=path.join(HERE,'../../public');
const ROOT='hcns_hub/main';const MOCK=process.env.SYNC_MOCK;
let be;
if(MOCK){be=(await import(path.resolve(MOCK))).default}
else{
  const {GoogleAuth}=await import('google-auth-library');
  const sa=JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
  const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/datastore']});
  const cl=await auth.getClient();const BASE=`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const req=async(o)=>{try{return (await cl.request(o)).data}catch(e){const s=e.response?.status;if(s===404)return null;const m=e.response?.data?.error?.message||e.message;const er=new Error(`${s||''} ${m}`.trim());er.code=s===403?'invalid_argument':'unavailable';throw er}};
  const toV=v=>v===null||v===undefined?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):typeof v==='string'?{stringValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(toV)}}:{mapValue:{fields:toF(v)}};
  const toF=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined).map(([k,v])=>[k,toV(v)]));
  const fromV=v=>'stringValue'in v?v.stringValue:'integerValue'in v?+v.integerValue:'doubleValue'in v?v.doubleValue:'booleanValue'in v?v.booleanValue:'nullValue'in v?null:'timestampValue'in v?v.timestampValue:'arrayValue'in v?(v.arrayValue.values||[]).map(fromV):'mapValue'in v?fromF(v.mapValue.fields||{}):null;
  const fromF=f=>Object.fromEntries(Object.entries(f).map(([k,v])=>[k,fromV(v)]));
  const fp=k=>/^[A-Za-z_][A-Za-z_0-9]*$/.test(k)?k:'`'+k.replace(/[`\\]/g,m=>'\\'+m)+'`';
  be={
    get:async({p})=>{const d=await req({url:`${BASE}/${ROOT}/${p}`});return d?fromF(d.fields||{}):null},
    list:async({c})=>{const o={};let tok='';do{const d=await req({url:`${BASE}/${ROOT}/${c}?pageSize=300${tok?'&pageToken='+encodeURIComponent(tok):''}`});(d?.documents||[]).forEach(x=>{o[x.name.split('/').pop()]=fromF(x.fields||{})});tok=d?.nextPageToken||''}while(tok);return o},
    set:async({p,b})=>{await req({url:`${BASE}/${ROOT}/${p}`,method:'PATCH',data:{fields:toF(b)}});W.n++;return true},
    update:async({p,b})=>{const q=Object.keys(b).map(k=>'updateMask.fieldPaths='+encodeURIComponent(fp(k))).join('&');await req({url:`${BASE}/${ROOT}/${p}?${q}&currentDocument.exists=true`,method:'PATCH',data:{fields:toF(b)}});W.n++;return true},
    del:async({p})=>{await req({url:`${BASE}/${ROOT}/${p}`,method:'DELETE'});W.n++;return true},
    sheet:async({spreadsheetId,range})=>{const d=await req({url:`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`});return d?.values||[]}
  };
}
const W={n:0,skip:0};if(MOCK)be.W=W;
/* Chỉ cho máy đồng bộ ghi vào các nhánh dữ liệu đồng bộ – các phần khác (nhân sự phòng, cấu hình, KPI…) không bao giờ bị ghi đè */
const ALLOW=/^(sys|rec|dcshop|dcmove|assign)\//;
for(const op of ['set','update','del']){const f=be[op];be[op]=async a=>{if(!ALLOW.test(a.p)){W.skip++;return true}return f(a)}}
if(!MOCK){const cfg=await be.get({p:'config/main'}).catch(e=>{console.log('KHÔNG ĐỌC ĐƯỢC FIRESTORE:',String(e.message).slice(0,160));process.exit(0)});if(!cfg){console.log('Không thấy config/main trong Firestore – dừng để tránh ghi sai');process.exit(0)}}
const t0=Date.now();
const browser=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});
const pg=await browser.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e.message).slice(0,200)));
await pg.exposeFunction('__hub',async s=>{const {op,a}=JSON.parse(s);try{const v=await be[op](a);if(MOCK&&/set|update|del/.test(op))W.n++;return JSON.stringify({v})}catch(e){return JSON.stringify({err:String(e.message||e),code:e.code})}});
await pg.addInitScript(`window.__SYNC_EMAIL=${JSON.stringify(process.env.SYNC_EMAIL||'thuylinh9344@gmail.com')};`);
await pg.route('**/*',r=>{const u=r.request().url();
  if(u.startsWith('https://hub.local/')){let f=u.slice(18).split(/[?#]/)[0]||'index.html';if(f==='hub-runtime.js')return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(HERE,'shim.js'),'utf8')});const fpth=path.join(PUB,f);return fs.existsSync(fpth)?r.fulfill({path:fpth}):r.fulfill({status:404,body:''})}
  if(/cdnjs\.cloudflare\.com/.test(u))return r.continue();return r.abort()});
await pg.goto('https://hub.local/index.html#dieu-chuyen');
const ok=await pg.waitForFunction(()=>typeof S!=='undefined'&&S.db&&S.mcp&&S.dcLoaded&&S.dcMvLoaded&&S.sys!==undefined,null,{timeout:60000}).then(()=>true,()=>false);
if(!ok){console.log('KHÔNG KHỞI ĐỘNG ĐƯỢC WEB',errs.slice(0,3).join(' | '));await browser.close();process.exit(0)}
await pg.waitForTimeout(1500);
const res=await pg.evaluate(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<60&&S.dcSyncBusy;i++)await wait(500);
  S.dcLast=0;await dcSync(true);for(let i=0;i<60&&S.dcSyncBusy;i++)await wait(500);
  let sysN=0;try{sysN=sysRows().length}catch(_){}let recN=0;try{recN=JSON.parse(S.rec.rowsJson||'[]').length}catch(_){}
  return {err:S.syncErr||{},shops:Object.keys(S.dcShops||{}).length,moves:Object.keys(S.dcMoves||{}).length,sysN,recN}});
await browser.close();
console.log(`Đồng bộ xong sau ${((Date.now()-t0)/1000).toFixed(1)}s · ghi ${W.n} lần (bỏ qua ${W.skip}) · nhà ${res.shops} · người điều ${res.moves} · DSNS ${res.sysN} dòng · hồ sơ ${res.recN} dòng`);
const ek=Object.keys(res.err);if(ek.length){console.log('LỖI ĐỌC:',ek.map(k=>k+': '+String(res.err[k]).slice(0,160)).join(' | '))}
if(errs.length)console.log('Lỗi trang:',errs.slice(0,3).join(' | '));
