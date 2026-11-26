import fs from 'fs';import {initializeTestEnvironment,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,collection,query,where,getDocs} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-hcns',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
const R='hcns_hub/main';const em='nv.test@upharma.com.vn';
await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,`${R}/members/${em}`),{role:'staff',staffId:'s0',name:'NV'});await setDoc(doc(d,`${R}/staff/s0`),{name:'NV',code:'UP1'});});
const db=env.authenticatedContext('u1',{email:em,email_verified:true}).firestore();
const t=async(n,p)=>{try{await p;console.log('OK  ',n)}catch(e){console.log('FAIL',n,e.code||'',String(e.message).slice(0,200))}};
const body={staffId:'s0',quarter:'2026-11',status:'draft',objectives:[{id:'o1',area:'C&B',title:'X',okrId:'',w:30,krs:[{id:'k1',title:'Y',target:10,unit:'',src:'',meas:'',current:0}]}],checkins:{},updatedAt:new Date().toISOString()};
await t('member get',getDoc(doc(db,`${R}/members/${em}`)));
await t('okrp list mine',getDocs(query(collection(db,`${R}/okrp`),where('staffId','==','s0'))));
await t('okrp create',setDoc(doc(db,`${R}/okrp/2026-11_s0`),body));
await t('okrp update',setDoc(doc(db,`${R}/okrp/2026-11_s0`),{...body,objectives:[...body.objectives,{...body.objectives[0],id:'o2'}]}));
await t('okrp submit',setDoc(doc(db,`${R}/okrp/2026-11_s0`),{...body,status:'submitted',submittedAt:'x'}));
await t('pub get',getDoc(doc(db,`${R}/pub/okr_2026-11`)));
// email chữ hoa trong token
const db2=env.authenticatedContext('u2',{email:'NV.Test@upharma.com.vn',email_verified:true}).firestore();
await t('token email chữ hoa → create',setDoc(doc(db2,`${R}/okrp/2026-12_s0`),{...body,quarter:'2026-12'}));
await env.cleanup();
