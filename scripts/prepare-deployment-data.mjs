import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('deployment-data/',root);
await mkdir(out,{recursive:true});
const run=async(script,args)=>{
 const {stdout}=await promisify(execFile)('python3',['-B',fileURLToPath(new URL(script,import.meta.url)),...args],{timeout:180000,maxBuffer:64*1024*1024});
 JSON.parse(stdout);return stdout;
};
const path=name=>fileURLToPath(new URL('private-data/'+name+'/',root));
const ask=await run('read-ask-summary.py',[path('ask'),'--details']);
await writeFile(new URL('ask.json.gz',out),gzipSync(ask));
const learning=await run('read-local-learning.py',[path('training'),path('tryout'),path('ask')]);
await writeFile(new URL('learning.json.gz',out),gzipSync(learning));
for(const name of ['grapari-units','grapari-locations']){
 const bytes=await readFile(new URL('private-data/'+name+'.json',root));JSON.parse(bytes);
 await writeFile(new URL(name+'.json.gz',out),gzipSync(bytes));
}
await copyFile(new URL('private-data/call-center-training-slide.png',root),new URL('call-center-training-slide.png',out));
console.log('Prepared reporting snapshots from local sources. Raw workbooks remain excluded.');
