/* Shim chạy trong trình duyệt headless của máy đồng bộ: thay hub-runtime.js, chuyển mọi đọc/ghi qua Node (tài khoản dịch vụ). */
(function(){
  window.HUB_STANDALONE=true;
  const call=(op,a)=>window.__hub(JSON.stringify({op,a})).then(r=>{const o=JSON.parse(r);if(o.err){const e=new Error(o.err);e.code=o.code||'unavailable';throw e}return o.v});
  const snapDoc=(id,v)=>({id,exists:v!=null,data:()=>v==null?undefined:JSON.parse(JSON.stringify(v))});
  const rid=()=>Array.from({length:20},()=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.random()*62|0]).join('');
  const wrapDoc=p=>({id:p.split('/').pop(),path:p,
    get:()=>call('get',{p}).then(v=>snapDoc(p.split('/').pop(),v)),
    set:b=>call('set',{p,b}),update:b=>call('update',{p,b}),delete:()=>call('del',{p}),
    onSnapshot(next){call('get',{p}).then(v=>next(snapDoc(p.split('/').pop(),v))).catch(()=>{});return()=>{}},
    collection:c=>wrapCol(p+'/'+c,[])});
  const match=(d,w)=>w.every(([f,op,v])=>{const x=d[f];return op==='=='?x===v:op==='!='?x!==v:op==='>='?x>=v:op==='<='?x<=v:op==='>'?x>v:op==='<'?x<v:op==='in'?v.includes(x):op==='array-contains'?Array.isArray(x)&&x.includes(v):true});
  const listSnap=(c,w)=>call('list',{c}).then(o=>{const docs=Object.entries(o).filter(([,d])=>match(d,w)).map(([id,d])=>snapDoc(id,d));return{docs,size:docs.length,empty:!docs.length,forEach:f=>docs.forEach(f)}});
  const wrapCol=(c,w)=>({path:c,doc:id=>wrapDoc(c+'/'+(id||rid())),add:b=>{const p=c+'/'+rid();return call('set',{p,b}).then(()=>wrapDoc(p))},
    where:(f,op,v)=>wrapCol(c,[...w,[f,op,v]]),get:()=>listSnap(c,w),onSnapshot(next){listSnap(c,w).then(next).catch(()=>{});return()=>{}}});
  const db={doc:wrapDoc,collection:c=>wrapCol(c,[])};
  const user={isOwner:async()=>false,canEdit:async()=>true,can:async()=>null,id:async()=>'sync-bot',me:async()=>({id:'sync-bot',name:'Máy đồng bộ',email:window.__SYNC_EMAIL})};
  const mcp={callTool:(server,tool,input)=>call('sheet',input).then(values=>({payload:{values}})),listTools:async()=>({servers:[{server:'Google Sheets',authStatus:'connected',tools:[{name:'get_values',description:''}]}]})};
  const dl={save:async()=>{}};
  window.claude={use:async n=>n==='db'?db:n==='user'?user:n==='mcp'?mcp:n==='downloads'?dl:null};
})();
