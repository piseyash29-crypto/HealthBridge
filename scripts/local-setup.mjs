import {existsSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const run=(args)=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)};
if(!existsSync('.dev.vars'))writeFileSync('.dev.vars','BOOTSTRAP_ADMIN_EMAIL="seedy@sites.test"\n# Optional: enable server-side AI report explanation\n# OPENAI_API_KEY="your-key-here"\n# OPENAI_MODEL="gpt-4.1"\n');
run(['scripts/run-framework.mjs','build']);
const config='dist/server/wrangler.json';
const ledger='.wrangler/healthbridge-applied.json';
let done=existsSync(ledger)?JSON.parse(readFileSync(ledger,'utf8')):[];
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())if(!done.includes(file)){
 run(['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config',config,'--persist-to','.wrangler/state','--file',join('drizzle',file)]);
 done.push(file);writeFileSync(ledger,JSON.stringify(done,null,2));
}
console.log('\nReady. Run npm run dev:hosted, then open http://localhost:5173.\nSign in with ChatGPT locally to use the development identity, then register as hospital owner.\n');
