import {runtime} from './runtime.mjs';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {handle}=await import('../server/service.ts');
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),port=Number(process.env.PORT||(process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:5173)),env=runtime(process.env.HB_DATA_DIR||resolve(root,'local-data'));
env.sql.exec('CREATE TABLE IF NOT EXISTS local_credentials(id TEXT PRIMARY KEY,salt TEXT NOT NULL,hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS local_sessions(token TEXT PRIMARY KEY,member_id TEXT NOT NULL,expires INTEGER NOT NULL);');
// Local UPI payment requests: only the patient can open a QR or submit a reference.
// A reference is never proof that a payment succeeded.
env.sql.exec(`CREATE TABLE IF NOT EXISTS payment_requests(
 invoice_id TEXT NOT NULL, member_id TEXT NOT NULL, amount_paise INTEGER NOT NULL,
 reference TEXT, status TEXT NOT NULL DEFAULT 'Awaiting payment', updated_at TEXT NOT NULL,
 PRIMARY KEY(invoice_id,member_id));`);
function paymentInvoice(invoiceId,member){
 if(!member||member.role!=='patient'||!member.patient_id)return null;
 const row=env.sql.prepare("SELECT data FROM entities WHERE kind='bills' AND id=?").get(invoiceId);
 if(!row)return null;
 const invoice=JSON.parse(row.data);
 if(invoice.patient!==member.patient_id||invoice.status==='Paid')return null;
 const amount=Number(invoice.amount);
 if(!Number.isFinite(amount)||amount<=0||amount>1000000||Math.round(amount*100)<1)return null;
 return {id:invoice.id,amount:Math.round(amount*100),title:String(invoice.title||'Medical invoice').slice(0,60)};
}
const upiId=String(process.env.HB_UPI_ID||'').trim();
const upiName=String(process.env.HB_UPI_NAME||'HealthBridge Hospital').trim();
function upiLink(invoice){const params=new URLSearchParams({pa:upiId,pn:upiName,am:(invoice.amount/100).toFixed(2),cu:'INR',tn:('HealthBridge '+invoice.id).slice(0,75),tr:invoice.id});return 'upi://pay?'+params.toString()}
const accounts=[['demo-admin','admin@healthbridge.demo','Hospital Administrator','admin',null],['demo-doctor','doctor@healthbridge.demo','Dr. Kavya Desai','doctor',null],['demo-patient','patient@healthbridge.demo','Aarav Mehta','patient','P-001']];
for(const [id,email,name,role,pid] of accounts){if(!env.sql.prepare('SELECT id FROM members WHERE id=?').get(id)){env.sql.prepare('INSERT INTO members VALUES(?,?,?,?,?,?,?)').run(id,email,name,role,'active',pid,new Date().toISOString());const salt=randomBytes(16).toString('hex');env.sql.prepare('INSERT OR IGNORE INTO local_credentials VALUES(?,?,?)').run(id,salt,scryptSync('HealthBridge@123',salt,64).toString('hex'));}}
await handle(new Request('http://localhost/api/hb/seed',{method:'POST',headers:{origin:'http://localhost','oai-authenticated-user-id':'demo-admin'}}),env);
if(!env.sql.prepare("SELECT id FROM entities WHERE id='local-assignment'").get()){const p=env.sql.prepare("SELECT data FROM entities WHERE id='P-001'").get();if(p){const d=JSON.parse(p.data);d.assignedDoctor='demo-doctor';env.sql.prepare("UPDATE entities SET data=? WHERE id='P-001'").run(JSON.stringify(d));env.sql.prepare("INSERT INTO entities(id,kind,data,created_by,updated_at) VALUES('local-assignment','internal','{}','demo-admin',?)").run(new Date().toISOString());}}
// Stable longitudinal care episodes, shared by all authorized portals.
env.sql.exec(`CREATE TABLE IF NOT EXISTS care_episodes(id TEXT PRIMARY KEY,patient_id TEXT NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL);`);
const careSeed=JSON.parse(readFileSync(resolve(root,'local','care_seed.json'),'utf8'));
if(!env.sql.prepare("SELECT name FROM migrations WHERE name='care-journey-v1'").get()){
 env.sql.exec('BEGIN');try{
  const created=new Date().toISOString();
  for(const [id,name,specialty] of careSeed.doctors){
   const email=id+'@healthbridge.demo';
   if(!env.sql.prepare('SELECT id FROM members WHERE id=?').get(id)){
    env.sql.prepare('INSERT INTO members VALUES(?,?,?,?,?,?,?)').run(id,email,name,'doctor','active',null,created);
    const salt=randomBytes(16).toString('hex');env.sql.prepare('INSERT OR IGNORE INTO local_credentials VALUES(?,?,?)').run(id,salt,scryptSync('HealthBridge@123',salt,64).toString('hex'));
   }
  }
  for(const item of careSeed.cases){
   for(const [kind,data] of [['patients',item.profile],['records',item.report],['prescriptions',item.prescription],['bills',item.bill],['appointments',item.appointment],['appointments',item.priorAppointment],['records',item.priorReport],['prescriptions',item.priorPrescription]]){
    env.sql.prepare('INSERT OR IGNORE INTO entities(id,kind,patient_id,data,version,doctor_id,slot_date,slot_time,status,created_by,updated_at) VALUES(?,?,?,?,1,?,?,?,?,?,?)').run(data.id,kind,kind==='patients'?null:item.profile.id,JSON.stringify(data),kind==='appointments'?data.doctorId:null,kind==='appointments'?data.date:null,kind==='appointments'?data.time:null,data.status||null,'demo-admin',created);
   }
   const ep=item.episode;env.sql.prepare('INSERT OR IGNORE INTO care_episodes VALUES(?,?,?,?)').run(ep.id,ep.patient,JSON.stringify(ep),created);
   if(['Admitted','ICU'].includes(ep.stage)&&ep.bed){
    const bed={id:ep.bed,type:ep.stage==='ICU'?'ICU':'General',patient:ep.patient};
    env.sql.prepare('INSERT OR IGNORE INTO entities(id,kind,patient_id,data,version,status,created_by,updated_at) VALUES(?,?,?, ?,1,?,?,?)').run(bed.id,'beds',null,JSON.stringify(bed),'Occupied','demo-admin',created);
   }
  }
  // Keep previous six patient records and attach longitudinal encounters without replacing existing data.
  for(let i=1;i<=6;i++){
   const pid='P-'+String(i).padStart(3,'0');
   if(!env.sql.prepare("SELECT id FROM entities WHERE kind='patients' AND id=?").get(pid))continue;
   const existing=env.sql.prepare('SELECT data FROM entities WHERE id=?').get(pid);
   const profile=JSON.parse(existing.data);
   const stages=['Arrived','Admitted','ICU','Discharged','Admitted','Discharged'];
   const stage=stages[i-1],arrival='2026-11-'+String(12+i).padStart(2,'0')+'T09:30:00+05:30';
   const prior='2026-08-'+String(10+i).padStart(2,'0')+'T11:00:00+05:30';
   const ep={id:'EP-'+pid,patient:pid,stage,visitType:stage==='ICU'?'Emergency':'Outpatient',arrivalAt:arrival,admittedAt:stage==='Arrived'?null:arrival,dischargedAt:stage==='Discharged'?'2026-11-18T16:15:00+05:30':null,doctorId:'demo-doctor',department:'General Medicine',ward:stage==='ICU'?'ICU':stage==='Admitted'?'General ward':'',bed:stage==='ICU'?'ICU-03':stage==='Admitted'?'WARD-03':'',notes:profile.condition||'Clinical review',priorVisitAt:prior,medications:[{name:i===1?'Amlodipine 5 mg':'Medication review',schedule:i===1?'Morning':'Morning / Evening',instructions:'Follow documented prescription and treating clinician instructions',status:'Active'}],events:[{at:prior,title:'Previous consultation',detail:'Earlier visit and investigations reviewed'},{at:arrival,title:'Arrival registered',detail:'Patient checked in at hospital'},{at:'2026-11-18T11:30:00+05:30',title:'Clinical review',detail:'Care team reviewed reports and medications'}],updatedAt:created};
   env.sql.prepare('INSERT OR IGNORE INTO care_episodes VALUES(?,?,?,?)').run(ep.id,pid,JSON.stringify(ep),created);
  }
  // Patient records already present in earlier installations stay intact.
  env.sql.prepare("INSERT INTO migrations VALUES('care-journey-v1')").run();env.sql.exec('COMMIT');
 }catch(e){env.sql.exec('ROLLBACK');throw e}
}
// Add dated operational fields to existing care journeys without replacing clinical updates.
if(!env.sql.prepare("SELECT name FROM migrations WHERE name='care-journey-dates-v2'").get()){
 env.sql.exec('BEGIN');try{
  const timestamp=new Date().toISOString();
  const sourceCases=new Map(careSeed.cases.map(c=>[c.episode.id,c]));
  for(const record of env.sql.prepare('SELECT id,data FROM care_episodes').all()){
   const episode=JSON.parse(record.data);const original=sourceCases.get(record.id);
   if(!('expectedDischargeAt' in episode)){
    const admitted=episode.admittedAt||episode.arrivalAt;
    episode.expectedDischargeAt=['ICU','Admitted'].includes(episode.stage)&&admitted?new Date(new Date(admitted).getTime()+(episode.stage==='ICU'?7:5)*86400000).toISOString():null;
   }
   if(!('bedEnteredAt' in episode))episode.bedEnteredAt=['Admitted','ICU'].includes(episode.stage)?episode.admittedAt||episode.arrivalAt:null;
   if(!('bedReleasedAt' in episode))episode.bedReleasedAt=episode.dischargedAt||null;
   if(original&&episode.events)episode.events=episode.events.map(e=>({...e}));
   env.sql.prepare('UPDATE care_episodes SET data=? WHERE id=?').run(JSON.stringify(episode),record.id);
  }
  // Backfill clock times ONLY for known starter records; never assign invented times to user-authored records.
  for(const item of careSeed.cases){
   const e=item.episode;
   for(const [field,time] of [['report','10:20:00'],['prescription','11:15:00'],['priorReport','10:10:00'],['priorPrescription','11:25:00']]){
    const starter=item[field];if(!starter)continue;
    const record=env.sql.prepare('SELECT data FROM entities WHERE id=?').get(starter.id);if(!record)continue;
    const data=JSON.parse(record.data);
    if(!data.recordedAt&&/^\d{4}-\d{2}-\d{2}$/.test(data.date||'')){
     data.recordedAt=data.date+'T'+time+'+05:30';
     env.sql.prepare('UPDATE entities SET data=? WHERE id=?').run(JSON.stringify(data),starter.id);
    }
   }
  }
  env.sql.prepare("INSERT INTO migrations VALUES('care-journey-dates-v2')").run();env.sql.exec('COMMIT');
 }catch(error){env.sql.exec('ROLLBACK');throw error}
}
const attempts=new Map();
const server=createServer(async(req,res)=>{try{const origin=`http://localhost:${port}`,url=new URL(req.url,origin);if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){res.writeHead(403);return res.end('Localhost only')}const requestOrigin=`http://${req.headers.host}`;const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>6*1024*1024){res.writeHead(413);return res.end('Request too large')}chunks.push(chunk)}const bytes=Buffer.concat(chunks);const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
const token=(req.headers.cookie||'').match(/(?:^|; )hb_session=([^;]+)/)?.[1];const member=token?env.sql.prepare('SELECT m.* FROM local_sessions s JOIN members m ON m.id=s.member_id WHERE token=? AND expires>?').get(token,Date.now()):null;

// Staff-managed specialties. Existing doctor records can be assigned a clinical specialty.
if(url.pathname==='/api/local/doctor-specialties'){
 const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify(body))};
 if(!member||member.status!=='active')return reply(401,{error:'Sign in required'});
 env.sql.exec('CREATE TABLE IF NOT EXISTS doctor_specialties(doctor_id TEXT PRIMARY KEY, specialty TEXT NOT NULL, updated_at TEXT NOT NULL)');
 if(req.method==='GET'){
  const rows=env.sql.prepare("SELECT m.id,m.name,COALESCE(ds.specialty,'Unspecified') specialty FROM members m LEFT JOIN doctor_specialties ds ON ds.doctor_id=m.id WHERE m.role='doctor' AND m.status='active' ORDER BY m.name").all();
  return reply(200,{doctors:rows});
 }
 if(req.method==='POST'){
  if(member.role!=='admin')return reply(403,{error:'Staff administration required'});
  if(req.headers.origin!==requestOrigin)return reply(403,{error:'Invalid origin'});
  let b;try{b=JSON.parse(bytes)}catch{return reply(400,{error:'Invalid JSON'})}
  const id=String(b.doctorId||'');const specialty=String(b.specialty||'').trim();
  if(!specialty||specialty.length>90)return reply(400,{error:'Enter a valid specialty'});
  const doc=env.sql.prepare("SELECT id FROM members WHERE id=? AND role='doctor' AND status='active'").get(id);
  if(!doc)return reply(404,{error:'Doctor account not found'});
  env.sql.prepare('INSERT INTO doctor_specialties(doctor_id,specialty,updated_at) VALUES(?,?,?) ON CONFLICT(doctor_id) DO UPDATE SET specialty=excluded.specialty,updated_at=excluded.updated_at').run(id,specialty,new Date().toISOString());
  return reply(200,{ok:true});
 }
 return reply(405,{error:'Method not allowed'});
}
if(url.pathname.startsWith('/api/local/care-episodes')){
 const reply=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify(body))};
 if(!member||member.status!=='active')return reply(401,{error:'Please sign in.'});
 const canSee=pid=>{
  if(member.role==='admin')return true;
  if(member.role==='patient')return pid===member.patient_id;
  const p=env.sql.prepare("SELECT data FROM entities WHERE kind='patients' AND id=?").get(pid);
  return Boolean(p&&JSON.parse(p.data).assignedDoctor===member.id);
 };
 if(req.method==='GET'){
  const list=env.sql.prepare('SELECT data FROM care_episodes ORDER BY updated_at DESC').all().filter(row=>canSee(JSON.parse(row.data).patient)).map(row=>JSON.parse(row.data));
  return reply(200,{episodes:list});
 }
 if(!['POST','PATCH'].includes(req.method))return reply(405,{error:'Unsupported method'});
 if(req.headers.origin!==requestOrigin)return reply(403,{error:'Invalid origin'});
 let b;try{b=JSON.parse(bytes)}catch{return reply(400,{error:'Invalid request JSON'})}
 const pid=String(b.patient||'');if(!/^P-[A-Z0-9-]{1,40}$/.test(pid)||!canSee(pid))return reply(403,{error:'Patient not authorized'});
 const existing=env.sql.prepare('SELECT data FROM care_episodes WHERE id=?').get(String(b.id||''));
 const old=existing?JSON.parse(existing.data):null;
 if(req.method==='PATCH'&&!old)return reply(404,{error:'Care episode not found'});
 if(old&&old.patient!==pid)return reply(403,{error:'Patient cannot be changed'});
 const timestamp=new Date().toISOString();const stage=String(b.stage||old?.stage||'Arrived');
 const chosenDoctor=String(b.doctorId||old?.doctorId||'');
 if(chosenDoctor && chosenDoctor!=='sample-doctor'){
  const dr=env.sql.prepare("SELECT id FROM members WHERE id=? AND role='doctor' AND status='active'").get(chosenDoctor);
  if(!dr)return reply(400,{error:'Assign an active doctor account'});
 }
 if(member.role==='patient'&&chosenDoctor!==String(old?.doctorId||''))return reply(403,{error:'Only hospital staff may assign doctors'});

 if(!['Arrived','Admitted','ICU','Discharged'].includes(stage))return reply(400,{error:'Invalid care stage'});
 if(member.role==='patient'&&(req.method==='PATCH'||stage!=='Arrived'))return reply(403,{error:'Only clinical staff may change admission or discharge status.'});
 if(req.method==='POST'&&old)return reply(409,{error:'Record already exists'});
 if(req.method==='POST'&&member.role==='patient'&&env.sql.prepare("SELECT id FROM care_episodes WHERE patient_id=? AND json_extract(data,'$.stage')!='Discharged'").get(pid))return reply(409,{error:'Active hospital visit already exists'});
 const safe=(v,max=200)=>String(v??'').slice(0,max);
 const id=old?.id||'EP-'+crypto.randomUUID();
 const meds=member.role==='patient'?(old?.medications||[]):Array.isArray(b.medications)?b.medications.slice(0,25).map(m=>({name:safe(m.name,120),schedule:safe(m.schedule,70),instructions:safe(m.instructions,300),status:safe(m.status||'Active',32)})).filter(m=>m.name):old?.medications||[];
 const expectedProvided=Object.prototype.hasOwnProperty.call(b,'expectedDischargeAt');
 const expectedRaw=expectedProvided?String(b.expectedDischargeAt||''):String(old?.expectedDischargeAt||'');
 const expected=expectedRaw&&Number.isFinite(Date.parse(expectedRaw))?new Date(expectedRaw).toISOString():null;
 if(expectedProvided&&expectedRaw&&!expected)return reply(400,{error:'Invalid estimated discharge date and time'});
 if(member.role==='patient'&&expectedProvided)return reply(403,{error:'Only clinical staff can estimate discharge.'});

 const data={...(old||{}),id,patient:pid,stage,visitType:safe(b.visitType||old?.visitType||'Outpatient'),arrivalAt:old?.arrivalAt||timestamp,admittedAt:stage==='Arrived'?null:(old?.admittedAt||timestamp),dischargedAt:stage==='Discharged'?(old?.dischargedAt||timestamp):null,doctorId:safe(b.doctorId||old?.doctorId||'',100),department:safe(b.department||old?.department||'',100),ward:safe(b.ward||old?.ward||'',80),bed:safe(b.bed||old?.bed||'',60),notes:safe(b.notes||old?.notes||'',3000),priorVisitAt:old?.priorVisitAt||null,expectedDischargeAt:stage==='Discharged'?null:expected,bedEnteredAt:(old?.bed===safe(b.bed||old?.bed||'',60)&&old?.bedEnteredAt)?old.bedEnteredAt:(['ICU','Admitted'].includes(stage)?timestamp:null),bedReleasedAt:stage==='Discharged'?timestamp:(old?.bedReleasedAt||null),medications:meds,updatedAt:timestamp,events:[...(old?.events||[]),{at:timestamp,title:old?'Care status updated: '+stage:'Arrival registered',detail:member.role==='patient'?'Patient check-in':'Updated by '+member.name}]};
 // Keep bed allocations in sync with the Hospital Operations inventory.
 const inpatient=['Admitted','ICU'].includes(stage);
 if(!inpatient){
  if(old?.bed&&old.bed!=='—')data.events.push({at:timestamp,title:'Bed released',detail:'Previous allocation: '+old.bed});
  data.bed='';data.ward=stage==='Discharged'?'Discharged':data.ward;data.bedEnteredAt=null;if(stage==='Discharged')data.bedReleasedAt=timestamp;
 }
 if(old?.stage==='Discharged'&&stage!=='Discharged')return reply(409,{error:'Discharged stays in the completed journey. Register a new arrival for a new visit.'});
 const oldBed=old?.bed&&old.bed!=='—'?old.bed:'';
 const newBed=inpatient&&data.bed&&data.bed!=='—'?data.bed:'';
 if(newBed&&!/^(ICU|WARD)-[A-Z0-9-]{1,20}$/.test(newBed))return reply(400,{error:'Bed ID must be an ICU- or WARD- identifier.'});
 if(newBed&&((stage==='ICU'&&!newBed.startsWith('ICU-'))||(stage==='Admitted'&&!newBed.startsWith('WARD-'))))return reply(400,{error:'Bed type does not match ICU or general admission.'});
 if(newBed){
  const record=env.sql.prepare("SELECT data FROM entities WHERE kind='beds' AND id=?").get(newBed);
  if(record){const bed=JSON.parse(record.data);if(bed.patient&&bed.patient!==pid)return reply(409,{error:'This bed is occupied by another patient.'});}
 }
 env.sql.exec('BEGIN');try{
  if(oldBed&&oldBed!==newBed){
   const record=env.sql.prepare("SELECT data FROM entities WHERE kind='beds' AND id=?").get(oldBed);
   if(record){const bed=JSON.parse(record.data);if(bed.patient===pid){bed.patient='';env.sql.prepare('UPDATE entities SET data=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(bed),timestamp,oldBed)}}
  }
  if(newBed){
   const record=env.sql.prepare("SELECT data FROM entities WHERE kind='beds' AND id=?").get(newBed);
   const bed={id:newBed,type:stage==='ICU'?'ICU':'General',patient:pid};
   if(record)env.sql.prepare('UPDATE entities SET data=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(bed),timestamp,newBed);
   else env.sql.prepare('INSERT INTO entities(id,kind,patient_id,data,version,status,created_by,updated_at) VALUES(?,?,?, ?,1,?,?,?)').run(newBed,'beds',null,JSON.stringify(bed),'Occupied',member.id,timestamp);
  }
  env.sql.prepare('INSERT INTO care_episodes(id,patient_id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').run(id,pid,JSON.stringify(data),timestamp);
  env.sql.exec('COMMIT');
 }catch(error){env.sql.exec('ROLLBACK');throw error}
 return reply(old?200:201,{episode:data});
}
if(url.pathname.startsWith('/api/local/payments/')){
 const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify(body))};
 if(!member||member.status!=='active'||member.role!=='patient')return json(403,{error:'Patient sign-in required.'});
 if(!upiId||!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9._-]{2,}$/.test(upiId))return json(503,{error:'Hospital UPI payment ID is not configured. Set HB_UPI_ID and restart the server.'});
 const invoiceId=url.searchParams.get('invoice')||'';
 if(!/^[-\w]{1,100}$/.test(invoiceId))return json(400,{error:'Invalid invoice.'});
 const invoice=paymentInvoice(invoiceId,member);
 if(!invoice)return json(404,{error:'Unpaid invoice not found for your patient account.'});
 const prior=env.sql.prepare('SELECT reference,status,updated_at FROM payment_requests WHERE invoice_id=? AND member_id=?').get(invoiceId,member.id);
 if(url.pathname==='/api/local/payments/details'&&req.method==='GET')return json(200,{invoice:invoice.id,amount:(invoice.amount/100).toFixed(2),recipient:upiName,upiId,link:upiLink(invoice),status:prior?.status||'Awaiting payment',reference:prior?.reference||''});
 if(url.pathname==='/api/local/payments/qr'&&req.method==='GET'){
   const result=spawnSync(process.platform==='win32'?'python':'python3',[resolve(root,'local','qr_svg.py')],{input:upiLink(invoice),encoding:'utf8',timeout:5000,maxBuffer:1024*1024});
   if(result.error||result.status!==0)return json(503,{error:'QR library unavailable. Install qrcode with: python -m pip install qrcode'});
   res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(result.stdout);
 }
 if(url.pathname==='/api/local/payments/reference'&&req.method==='POST'){
   if(req.headers.origin!==requestOrigin)return json(403,{error:'Invalid origin'});
   let b;try{b=JSON.parse(bytes)}catch{return json(400,{error:'Invalid request'})}
   const reference=String(b.reference||'').trim().toUpperCase();
   if(!/^[A-Z0-9-]{6,35}$/.test(reference))return json(400,{error:'Enter a valid UPI reference / transaction ID (6–35 letters or digits).'});
   env.sql.prepare(`INSERT INTO payment_requests(invoice_id,member_id,amount_paise,reference,status,updated_at) VALUES(?,?,?,?,?,?)
   ON CONFLICT(invoice_id,member_id) DO UPDATE SET reference=excluded.reference,status=excluded.status,updated_at=excluded.updated_at`)
   .run(invoiceId,member.id,invoice.amount,reference,'Verification pending',new Date().toISOString());
   return json(200,{status:'Verification pending',message:'Reference received. The bill remains unpaid until hospital verification.'});
 }
 return json(404,{error:'Payment endpoint not found'});
}
if(url.pathname==='/api/local/login'&&req.method==='POST'){if(req.headers.origin!==requestOrigin){res.writeHead(403);return res.end('{}')}const key=req.socket.remoteAddress,n=attempts.get(key)||{count:0,until:Date.now()+60000};if(n.until<Date.now()){n.count=0;n.until=Date.now()+60000}n.count++;attempts.set(key,n);if(n.count>20){res.writeHead(429,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Too many attempts. Try again in one minute.'}))}let b;try{b=JSON.parse(bytes)}catch{res.writeHead(400);return res.end('{}')}const login=String(b.email||b.identifier||'').trim().toLowerCase().replace(/\s/g,'');let row=env.sql.prepare('SELECT c.*,m.email,m.status FROM local_credentials c JOIN members m ON m.id=c.id WHERE lower(m.email)=?').get(login);if(!row){row=env.sql.prepare("SELECT c.*,m.email,m.status FROM local_credentials c JOIN members m ON m.id=c.id JOIN entities e ON e.patient_id=m.patient_id WHERE e.kind='abha' AND json_extract(e.data,'$.identifier')=? AND json_extract(e.data,'$.status')='Demo Linked'").get(login);}const requestedRole=String(b.role||'').trim().toLowerCase();const intendedRole=requestedRole==='staff'?'admin':requestedRole;const authorizedRole=!!row&&(!intendedRole||(['patient','doctor','admin'].includes(intendedRole)&&env.sql.prepare('SELECT role FROM members WHERE id=?').get(row.id)?.role===intendedRole));const ok=row&&authorizedRole&&row.status==='active'&&timingSafeEqual(scryptSync(String(b.password),row.salt,64),Buffer.from(row.hash,'hex'));if(!ok){res.writeHead(401,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Invalid email, health ID, or password.'}))}const t=randomBytes(32).toString('hex');env.sql.prepare('INSERT INTO local_sessions VALUES(?,?,?)').run(t,row.id,Date.now()+8*3600000);res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`hb_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,'Cache-Control':'no-store'});return res.end('{"ok":true}')}
if(url.pathname==='/api/local/register'&&req.method==='POST'){
if(req.headers.origin!==requestOrigin){res.writeHead(403);return res.end('{}')}
let b;try{b=JSON.parse(bytes)}catch{res.writeHead(400);return res.end('{}')}
const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim().slice(0,100),password=String(b.password||''),role=String(b.role||'patient');
const reply=(code,error)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify({error}))};
if(!['patient','doctor','admin'].includes(role)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||name.length<2||password.length<12||password.length>128)return reply(400,'Enter a valid name, email, and password of 12–128 characters.');
if(env.sql.prepare('SELECT id FROM members WHERE lower(email)=?').get(email))return reply(409,'An account already uses this email.');
const id='member-'+crypto.randomUUID(),pid='P-'+crypto.randomUUID().slice(0,8).toUpperCase(),salt=randomBytes(16).toString('hex'),hash=scryptSync(password,salt,64).toString('hex'),at=new Date().toISOString();
env.sql.exec('BEGIN');try{env.sql.prepare('INSERT INTO members VALUES(?,?,?,?,?,?,?)').run(id,email,name,role,'active',role==='patient'?pid:null,at);env.sql.prepare('INSERT INTO local_credentials VALUES(?,?,?)').run(id,salt,hash);if(role==='patient')env.sql.prepare('INSERT INTO entities(id,kind,data,created_by,updated_at) VALUES(?,?,?,?,?)').run(pid,'patients',JSON.stringify({id:pid,name,email,age:'Not recorded',gender:'Not recorded',condition:'New patient',blood:'Not recorded',assignedDoctor:null}),id,at);env.sql.exec('COMMIT')}catch(e){env.sql.exec('ROLLBACK');throw e}
res.writeHead(201,{'Content-Type':'application/json'});return res.end('{"ok":true}')}
if(url.pathname==='/api/local/logout'&&req.method==='POST'){if(req.headers.origin!==requestOrigin){res.writeHead(403);return res.end('{}')}if(token)env.sql.prepare('DELETE FROM local_sessions WHERE token=?').run(token);res.writeHead(200,{'Set-Cookie':'hb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0','Content-Type':'application/json'});return res.end('{}')}
if(url.pathname==='/api/local/config'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"local":true}')}
if(url.pathname.startsWith('/api/hb/')){if(member){headers.set('oai-authenticated-user-id',member.id);headers.set('oai-authenticated-user-email',member.email)}const r=await handle(new Request(requestOrigin+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:bytes}),env);res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(Buffer.from(await r.arrayBuffer()))}
const path=resolve(root,'public','.'+decodeURIComponent(url.pathname==='/'?'/portal.html':url.pathname));if(!path.startsWith(resolve(root,'public')+sep)){res.writeHead(403);return res.end()}if(!(await stat(path)).isFile())throw Error('File not found');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'}[extname(path)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(await readFile(path));}catch(e){console.error('[HealthBridge]',req.method,req.url,e?.message||e);if(req.url?.startsWith('/api/')){res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Local server error. Check the VS Code terminal for details.'}))}else{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Page not found')}}});
server.listen(port,'127.0.0.1',()=>console.log(`HealthBridge running at http://localhost:${port}\nLocal development server — read START-HERE.md for accounts.`));
