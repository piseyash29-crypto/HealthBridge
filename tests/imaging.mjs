import assert from 'node:assert/strict';
import {runtime} from '../local/runtime.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {handle}=await import('../server/service.ts');
const temp=await mkdtemp(join(tmpdir(),'hb-imaging-')),env=runtime(temp);let checks=0;
const originalFetch=globalThis.fetch;
async function req(who,path,method='GET',body,status=200){const headers={origin:'http://localhost','oai-authenticated-user-id':who,'oai-authenticated-user-email':who==='admin'?'admin@healthbridge.demo':who+'@example.test'};let payload;if(body instanceof FormData)payload=body;else if(body!==undefined){payload=JSON.stringify(body);headers['content-type']='application/json'}const r=await handle(new Request('http://localhost/api/hb/'+path,{method,headers,body:payload}),env);const out=await r.json();assert.equal(r.status,status,`${who} ${path}: ${JSON.stringify(out)}`);checks++;return out}
try{
 await req('admin','register','POST',{name:'Admin'},201);
 const a=(await req('alice','register','POST',{name:'Alice'},201)).member;
 const b=(await req('bob','register','POST',{name:'Bob'},201)).member;
 await req('doctor','register','POST',{name:'Doctor',role:'doctor'},201);await req('admin','members/doctor','PATCH',{status:'active'});
 let p=(await req('admin','state')).data.patients.find(p=>p.id===a.patient_id);await req('admin','entities/patients/'+p.id,'PATCH',{...p,age:30,assignedDoctor:'doctor'});
 await req('alice','continuity/abha','POST',{patient:a.patient_id,mode:'demo',identifier:'12345678901234',consent:true});
 await req('bob','continuity/abha','POST',{patient:b.patient_id,mode:'demo',identifier:'12345678901234',consent:true},409);
 assert.equal((await req('alice','state')).data.abha[0].verified,false);
 assert.equal((await req('alice','mri/models')).available,false);
 const form=new FormData();form.set('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')],'test.png',{type:'image/png'}));form.set('patient',a.patient_id);form.set('title','Test fixture, not clinical image');
 const upload=(await req('alice','upload','POST',form,201)).report;
 const scan=(await req('alice','mri','POST',{uploadId:upload.id},201)).scan;
 await req('bob','mri/'+scan.id,'GET',undefined,403);
 await req('doctor','mri/'+scan.id,'GET',undefined,403);
 assert.equal((await req('doctor','state')).data.mriCases.length,0);
 await req('alice','mri/'+scan.id+'/predict','POST',{consent:true,model:'efficientnet_b0'},503);
 assert.equal((await req('alice','mri/'+scan.id)).scan.result,undefined);
 await req('alice','reports/'+upload.id,'PATCH',{shared:true});
 await req('doctor','mri/'+scan.id);
 await req('alice','mri/'+scan.id+'/review','PATCH',{note:'Not allowed',_version:1},403);
 env.MRI_API_URL='https://models.example.test';
 await req('alice','mri/'+scan.id+'/predict','POST',{model:'efficientnet_b0'},400);
 // A deterministic API fixture exercises wiring only. This is not model validation.
 globalThis.fetch=async()=>Response.json({model:'efficientnet_b0',version:'test-fixture',scores:[{label:'A',probability:.7},{label:'B',probability:.3}]});
 await req('alice','mri/'+scan.id+'/predict','POST',{consent:true,model:'efficientnet_b0'});
 let current=(await req('doctor','mri/'+scan.id)).scan;assert.equal(current.result.label,'A');
 await req('doctor','mri/'+scan.id+'/review','PATCH',{note:'Reviewed test fixture',_version:current._version});
 await req('doctor','mri/'+scan.id+'/review','PATCH',{note:'Stale',_version:current._version},409);
 globalThis.fetch=async()=>Response.json({model:'efficientnet_b0',version:'test',scores:[{label:'A',probability:NaN},{label:'B',probability:1}]});
 await req('alice','mri/'+scan.id+'/predict','POST',{consent:true,model:'efficientnet_b0'},502);
 assert.equal((await req('alice','mri/'+scan.id)).scan.result.version,'test-fixture');
 await req('alice','reports/'+upload.id,'PATCH',{shared:false});await req('doctor','mri/'+scan.id,'GET',undefined,403);
 await req('alice','reports/'+upload.id,'DELETE',{});await req('alice','mri/'+scan.id,'GET',undefined,404);
 console.log(`PASS: ${checks} imaging/API checks. Identity validation, cross-patient isolation, private scan sharing, missing model, consent, response validation, review roles, stale edits and cascading file deletion. No clinical model accuracy tested.`);
}finally{globalThis.fetch=originalFetch;env.sql.close();await rm(temp,{recursive:true,force:true})}
