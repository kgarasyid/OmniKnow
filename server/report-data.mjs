import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {localLearningReport} from '../scripts/local-learning.mjs';
import {hardSkillReport} from '../scripts/hard-skill-report.mjs';
import {askUnitDetails,localAskDrilldown} from '../scripts/local-ask-drilldown.mjs';
const reportPaths=new Set(['/api/local-learning','/api/local-hard-skill','/api/local-ask-summary','/api/local-ask-unit-details','/api/local-ask-drilldown','/api/local-grapari','/api/local-grapari-locations']);
const cache=new Map();
export async function reportData(request,{root=new URL('../deployment-data/',import.meta.url)}={}) {
 const url=new URL(request.url),path=url.pathname;
 if(!reportPaths.has(path)&&path!=='/local-hard-skill-documentation.png')return null;
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
 const read=async name=>{
  const key=new URL(name+'.json.gz',root).href;
  if(!cache.has(key))cache.set(key,readFile(new URL(key)).then(bytes=>JSON.parse(gunzipSync(bytes))).catch(error=>{cache.delete(key);throw error}));
  return cache.get(key);
 };
 try {
  if(path==='/local-hard-skill-documentation.png')return new Response(request.method==='HEAD'?null:await readFile(new URL('call-center-training-slide.png',root)),{headers:{...headers,'Content-Type':'image/png'}});
  let data;
  if(path==='/api/local-grapari')data=await read('grapari-units');
  else if(path==='/api/local-grapari-locations')data=await read('grapari-locations');
  else if(path.startsWith('/api/local-ask-')) {
   const ask=await read('ask');
   data=path.endsWith('summary')?ask.summary:path.endsWith('unit-details')?askUnitDetails(ask,url.searchParams):localAskDrilldown(ask,url.searchParams);
  } else {
   const learning=await read('learning');
   data=path.endsWith('hard-skill')?hardSkillReport(learning,url.searchParams):localLearningReport(learning,url.searchParams);
  }
  return data==null?Response.json({error:'Invalid report scope'},{status:400,headers}):new Response(request.method==='HEAD'?null:JSON.stringify(data),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
 }catch{return Response.json({error:'Reporting snapshot unavailable'},{status:503,headers})}
}
