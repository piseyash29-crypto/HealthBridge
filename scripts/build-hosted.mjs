import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,extname} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
const assets={};function walk(dir,prefix=''){for(const f of readdirSync(dir,{withFileTypes:true})){const name=prefix+'/'+f.name;if(f.isDirectory())walk(join(dir,f.name),name);else assets[name]={data:readFileSync(join(dir,f.name)).toString('base64'),mime:({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'})[extname(f.name)]||'application/octet-stream'}}}walk('public');
const modules=['analysis','seed','service'].map(name=>stripTypeScriptTypes(readFileSync('server/'+name+'.ts','utf8').replace(/^import .*;\n/gm,''),{mode:'transform'}).replace(/\bexport /g,''));
mkdirSync('dist/server',{recursive:true});writeFileSync('dist/server/index.js',modules.join('\n')+'\nconst ASSETS='+JSON.stringify(assets)+';\n'+readFileSync('worker/entry.mjs','utf8'));
console.log('Built HealthBridge Worker with '+Object.keys(assets).length+' assets.');
