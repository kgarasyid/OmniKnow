import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {reportData} from '../server/report-data.mjs';
const directory=await mkdtemp(join(tmpdir(),'omniknow-report-test-'));
const root=pathToFileURL(directory+'/');
try {
 const ask={summary:{'2026-10':{groups:{}}},placements:{'2026-10':{
  fictional:['Call In','HAHAKO (HA)',['Call Center','','Jabar','F1','CC BANDUNG'],'Fictional CSR',[80,90,100]],
 }}};
 await writeFile(new URL('ask.json.gz',root),gzipSync(JSON.stringify(ask)));
 const request=path=>new Request('https://example.test'+path);
 assert.equal(await reportData(request('/private-data/raw.xlsx'),{root}),null);
 const response=await reportData(request('/api/local-ask-drilldown?from=2026-10-01&to=2026-10-31&view=roster&listArea=Site%201%20%C2%B7%20Bandung'),{root});
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.total,1);assert.equal(result.rows[0].name,'Fictional CSR');
 assert.equal((await reportData(request('/api/local-ask-summary'),{root})).status,200);
 assert.equal((await reportData(request('/api/local-ask-drilldown?view=invalid'),{root})).status,400);
 assert.equal((await reportData(request('/api/local-learning'),{root})).status,503);
 console.log('PASS: packaged report routing, snapshot loading, real-data filter logic with fictional records, invalid scope and missing snapshot responses.');
}finally{await rm(directory,{recursive:true,force:true})}
