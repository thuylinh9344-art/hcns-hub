import {GoogleAuth} from 'google-auth-library';
import fs from 'fs';
const sa=JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
console.log('SA_EMAIL', sa.client_email, 'PROJECT', sa.project_id);
const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/datastore']});
const c=await auth.getClient();
const SHEETS={DataHCNS:'1m---YbVPTlLOeL6G6cXRkwty16TKqMrQ1SioPXa5AiM',DSNS:'1AdSIpmxiyRQlbIGvavvLS4vytUVwCpK2Qe8ypRIDPGM',REC:'1Rdbf388QNJ_JXGbbDueoT9EDkMUW0ZvwGrXwgEuhduY'};
for(const [k,id] of Object.entries(SHEETS)){try{const r=await c.request({url:`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title`});console.log('SHEET',k,'OK')}catch(e){console.log('SHEET',k,'FAIL',e.response?.status,(e.response?.data?.error?.message||e.message).slice(0,160))}}
try{const r=await c.request({url:`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/sys/dsns?mask.fieldPaths=updatedAt`});console.log('FS_READ OK',JSON.stringify(r.data.fields||{}).slice(0,80))}catch(e){console.log('FS_READ FAIL',e.response?.status,(e.response?.data?.error?.message||e.message).slice(0,160))}
