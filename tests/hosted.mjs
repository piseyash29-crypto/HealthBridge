import assert from 'node:assert/strict';
import {runtime} from '../local/runtime.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const worker=(await import('../dist/server/index.js')).default;
const dir=await mkdtemp(join(tmpdir(),'hb-hosted-')),env=runtime(dir),origin='https://healthbridge.example';
async function request(path,{owner='owner-one',method='GET',body,cookie,expected=200}={}){const headers={origin};if(owner)headers['oai-authenticated-user-id']=owner;if(cookie)headers.cookie=cookie;if(body)headers['content-type']='application/json';const r=await worker.fetch(new Request(origin+path,{method,headers,body:body?JSON.stringify(body):undefined}),env);assert.equal(r.status,expected,path+': '+(r.status!==expected?await r.text():''));return r}
try{
 await request('/');await request('/api/local/config',{owner:null,expected:401});
 await request('/api/local/config');await request('/api/local/config',{owner:'other-owner',expected:403});
 await request('/api/local/login',{method:'POST',body:{email:'patient@healthbridge.demo',password:'wrong'},expected:401});
 const r=await request('/api/local/login',{method:'POST',body:{email:'patient@healthbridge.demo',password:'HealthBridge@123'}});const cookie=r.headers.get('set-cookie').split(';')[0];assert(r.headers.get('set-cookie').includes('Secure'));
 const state=await (await request('/api/hb/state',{cookie})).json();assert.equal(state.member.role,'patient');assert.equal(state.data.patients.length,1);
 await request('/api/local/register',{method:'POST',body:{name:'New Patient',email:'new@example.test',password:'Long-test-password-123',role:'admin'},expected:201});
 const nr=await request('/api/local/login',{method:'POST',body:{email:'new@example.test',password:'Long-test-password-123'}});const nc=nr.headers.get('set-cookie').split(';')[0];const ns=await (await request('/api/hb/state',{cookie:nc})).json();assert.equal(ns.member.role,'patient');
 await request('/api/hb/continuity/abha',{cookie,method:'POST',body:{patient:'P-001',mode:'demo',identifier:'12345678901234',consent:true}});
 await request('/api/local/login',{method:'POST',body:{email:'12345678901234',password:'HealthBridge@123'}});
 await request('/api/local/logout',{method:'POST',cookie});await request('/api/hb/state',{cookie,expected:401});
 console.log('PASS: hosted Worker assets, private platform identity, owner isolation, email login, patient registration without role escalation, linked-ID login, secure cookie, logout.');
}finally{env.sql.close();await rm(dir,{recursive:true,force:true})}
