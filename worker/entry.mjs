// Private-site workspace. Platform identity gates all account and patient APIs.
let hostedInit;
const hostedReply=(v,status=200,extra={})=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...extra}});
async function hostedHash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hostedPassword(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:new TextEncoder().encode(salt)},key,256);return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hostedInitialize(env,owner){
 await env.DB.prepare("INSERT OR IGNORE INTO entities(id,kind,data,created_by,updated_at) VALUES('hosted-owner','internal',?,?,?)").bind(JSON.stringify({owner}),owner,new Date().toISOString()).run();
 const entry=await env.DB.prepare("SELECT data FROM entities WHERE id='hosted-owner'").first();if(JSON.parse(entry.data).owner!==owner)return false;
 if(!hostedInit)hostedInit=(async()=>{
  const accounts=[['demo-admin','admin@healthbridge.demo','Hospital Administrator','admin',null],['demo-doctor','doctor@healthbridge.demo','Dr. Kavya Desai','doctor',null],['demo-patient','patient@healthbridge.demo','Aarav Mehta','patient','P-001']];
  for(const [id,email,name,role,pid] of accounts){await env.DB.prepare('INSERT OR IGNORE INTO members VALUES(?,?,?,?,?,?,?)').bind(id,email,name,role,'active',pid,new Date().toISOString()).run();const salt=crypto.randomUUID(),hash=await hostedPassword('HealthBridge@123',salt);await env.DB.prepare("INSERT OR IGNORE INTO entities(id,kind,data,created_by,updated_at) VALUES(?,'internal',?,?,?)").bind('login:'+email,JSON.stringify({member:id,email,salt,hash}),owner,new Date().toISOString()).run();}
  await handle(new Request('https://healthbridge/api/hb/seed',{method:'POST',headers:{origin:'https://healthbridge','oai-authenticated-user-id':'demo-admin'}}),env);
  const p=await env.DB.prepare("SELECT data FROM entities WHERE id='P-001'").first();if(p){const data=JSON.parse(p.data);if(data.assignedDoctor==='sample-doctor'){data.assignedDoctor='demo-doctor';await env.DB.prepare("UPDATE entities SET data=? WHERE id='P-001'").bind(JSON.stringify(data)).run();}}
 })().catch(e=>{hostedInit=null;throw e});await hostedInit;return true;
}
async function hostedFetch(req,env){
 const url=new URL(req.url);
 if(!url.pathname.startsWith('/api/')){
  const path=url.pathname==='/'?'/portal.html':url.pathname,asset=ASSETS[path];if(!asset)return new Response('Not found',{status:404});
  const binary=atob(asset.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':asset.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
 }
 const owner=req.headers.get('oai-authenticated-user-id');if(!owner)return hostedReply({error:'Sign in to open your private workspace.'},401);
 if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==url.origin)return hostedReply({error:'Same-origin request required.'},403);
 if(!await hostedInitialize(env,owner))return hostedReply({error:'This workspace belongs to another account.'},403);
 const token=(req.headers.get('cookie')||'').match(/(?:^|; )hb_session=([^;]+)/)?.[1];
 let sessionRecord=token?await env.DB.prepare("SELECT id,data FROM entities WHERE id=? AND kind='internal'").bind('session:'+await hostedHash(token)).first():null;
 let sessionData=sessionRecord?JSON.parse(sessionRecord.data):null;if(sessionData&&(sessionData.owner!==owner||sessionData.expires<Date.now()))sessionData=null;
 const member=sessionData?await env.DB.prepare("SELECT * FROM members WHERE id=? AND status='active'").bind(sessionData.member).first():null;
 if(url.pathname==='/api/local/config')return hostedReply({local:true,hosted:true});
 if(url.pathname==='/api/local/logout'&&req.method==='POST'){if(sessionRecord)await env.DB.prepare('DELETE FROM entities WHERE id=?').bind(sessionRecord.id).run();return hostedReply({ok:true},200,{'Set-Cookie':'hb_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});}
 if(['/api/local/login','/api/local/register'].includes(url.pathname)&&req.method==='POST'){
  const limitId='auth:'+owner+':'+Math.floor(Date.now()/60000);const count=await env.DB.prepare('INSERT INTO rate_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(limitId,Date.now()+60000).first();if(count.count>20)return hostedReply({error:'Too many attempts. Try again in a minute.'},429);
  let data;try{data=await body(req)}catch{return hostedReply({error:'Invalid request.'},400)}
  const email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');if(password.length>128)return hostedReply({error:'Invalid password.'},400);
  if(url.pathname.endsWith('/register')){
   const name=String(data.name||'').trim().slice(0,100);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||name.length<2||password.length<12)return hostedReply({error:'Enter a name, valid email and a password of at least 12 characters.'},400);
   if(await env.DB.prepare('SELECT id FROM entities WHERE id=?').bind('login:'+email).first())return hostedReply({error:'An account already uses this email.'},409);
   const id='member-'+crypto.randomUUID(),pid='P-'+crypto.randomUUID().slice(0,8).toUpperCase(),salt=crypto.randomUUID(),hash=await hostedPassword(password,salt),at=new Date().toISOString();
   await env.DB.batch([env.DB.prepare('INSERT INTO members VALUES(?,?,?,?,?,?,?)').bind(id,email,name,'patient','active',pid,at),env.DB.prepare("INSERT INTO entities(id,kind,data,created_by,updated_at) VALUES(?,'internal',?,?,?)").bind('login:'+email,JSON.stringify({member:id,email,salt,hash}),owner,at),env.DB.prepare("INSERT INTO entities(id,kind,data,created_by,updated_at) VALUES(?,'patients',?,?,?)").bind(pid,JSON.stringify({id:pid,name,email,age:'Not recorded',gender:'Not recorded',condition:'New patient',blood:'Not recorded',assignedDoctor:null}),id,at)]);return hostedReply({ok:true},201);
  }
  let record=await env.DB.prepare('SELECT data FROM entities WHERE id=?').bind('login:'+email).first();
  if(!record){const identity=await env.DB.prepare("SELECT m.email FROM entities e JOIN members m ON m.patient_id=e.patient_id WHERE e.kind='abha' AND json_extract(e.data,'$.identifier')=? AND json_extract(e.data,'$.status')='Demo Linked'").bind(email.replace(/\s/g,'')).first();if(identity)record=await env.DB.prepare('SELECT data FROM entities WHERE id=?').bind('login:'+identity.email).first();}
  const credential=record?JSON.parse(record.data):null;
  const hash=await hostedPassword(password,credential?.salt||'unknown-account');
  if(!credential||hash!==credential.hash)return hostedReply({error:'Invalid email, health ID, or password.'},401);
  const account=await env.DB.prepare("SELECT id FROM members WHERE id=? AND status='active'").bind(credential.member).first();if(!account)return hostedReply({error:'Account is not active.'},403);
  const t=crypto.randomUUID()+crypto.randomUUID(),at=new Date().toISOString();await env.DB.prepare("INSERT INTO entities(id,kind,data,created_by,updated_at) VALUES(?,'internal',?,?,?)").bind('session:'+await hostedHash(t),JSON.stringify({member:credential.member,owner,expires:Date.now()+28800000}),owner,at).run();
  return hostedReply({ok:true},200,{'Set-Cookie':`hb_session=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
 }
 if(url.pathname.startsWith('/api/hb/')){const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');if(member){headers.set('oai-authenticated-user-id',member.id);headers.set('oai-authenticated-user-email',member.email)}return handle(new Request(req,{headers}),env)}
 return hostedReply({error:'Not found.'},404);
}
export default {async fetch(req,env){try{return await hostedFetch(req,env)}catch(e){console.error('Request failed',e?.message);return hostedReply({error:'The request could not be completed. Please retry.'},500)}}};
