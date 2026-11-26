/* Chẩn đoán tạm thời quyền tạo OKR của tài khoản nhân viên. Chỉ in số đếm / true-false, không in email hay tên (repo công khai). */
import fs from 'fs';import {GoogleAuth} from 'google-auth-library';
const sa=JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));const P=sa.project_id;
const cl=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
const rq=async o=>{try{return (await cl.request(o)).data}catch(e){return {__err:e.response?.status+' '+(e.response?.data?.error?.message||e.message).slice(0,150)}}};
const B=`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents/hcns_hub/main`;
const fromV=v=>v==null?null:'stringValue'in v?v.stringValue:'integerValue'in v?+v.integerValue:'booleanValue'in v?v.booleanValue:'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,fromV(x)])):'arrayValue'in v?(v.arrayValue.values||[]).map(fromV):'nullValue'in v?null:'?';
const list=async c=>{const o=[];let t='';do{const d=await rq({url:`${B}/${c}?pageSize=300${t?'&pageToken='+t:''}`});if(d.__err){console.log(c,'ERR',d.__err);break}(d.documents||[]).forEach(x=>o.push({id:x.name.split('/').pop(),f:Object.fromEntries(Object.entries(x.fields||{}).map(([k,v])=>[k,fromV(v)]))}));t=d.nextPageToken||''}while(t);return o};
// 1. Rules đang chạy
const rel=await rq({url:`https://firebaserules.googleapis.com/v1/projects/${P}/releases/cloud.firestore`});
let src='';if(rel.rulesetName){const rs=await rq({url:`https://firebaserules.googleapis.com/v1/${rel.rulesetName}`});src=(rs.source?.files||[]).map(f=>f.content).join('\n');console.log('RULES updateTime',rel.updateTime);}else console.log('RULES ERR',rel.__err);
const has=s=>src.includes(s);
console.log('rules có hubStaff:',has('function hubStaff'),'| okrp create:',has("match /hcns_hub/main/okrp/{id}")&&has("allow create: if hubStaff()\n        && request.resource.data.staffId == mySid()"),'| tasks bb-self:',has("'bb-self'"),'| pub:',has('/hcns_hub/main/pub/'),'| email_verified:',has('email_verified'));
const repo=fs.readFileSync('firestore.rules','utf8');const norm=s=>s.replace(/\s+/g,' ');const blk=s=>{const i=norm(s).indexOf('// ===== Bàn điều hành HCNS');return i<0?'':norm(s).slice(i)};
console.log('khối HCNS live == repo:',blk(src)===blk(repo),'| live chứa khối repo:',norm(src).includes(blk(repo).replace(/\}\s*\}\s*$/,'').trim().slice(0,4000)));
// 2. Tài khoản nhân viên
const staff=await list('staff');const sids=new Set(staff.map(s=>s.id));
const mem=await list('members');
mem.forEach((m,i)=>console.log(`member#${i+1}: role=${m.f.role} | có staffId=${!!m.f.staffId} | staffId khớp hồ sơ=${sids.has(m.f.staffId)} | id viết thường=${m.id===m.id.toLowerCase()} | id có khoảng trắng=${/\s/.test(m.id)} | staffId=${m.f.staffId||''}`));
// 3. OKR cá nhân
const ok=await list('okrp');ok.filter(o=>/^2026-1[12]/.test(o.id)).forEach(o=>console.log(`okrp ${o.id}: status=${o.f.status} | staffId khớp id=${o.id.endsWith('_'+o.f.staffId)} | quarter khớp=${o.id.startsWith(o.f.quarter+'_')} | rkLive=${'rkLive'in o.f} | số mục tiêu=${(o.f.objectives||[]).length}`));
console.log('tổng okrp',ok.length);
