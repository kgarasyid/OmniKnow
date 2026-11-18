// Local integration fixture only; never uploaded to production.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {handleSurveyRequest} from '../api/survey-feed.js';
const counts={pre:0,post:0};
const mockFetch=async url=>{
  const stage=new URL(url).searchParams.get('stage');
  if(!['pre','post'].includes(stage))return new Response('Not found',{status:404});
  counts[stage]++;
  const n=stage==='pre'?(counts.pre>1?3:2):2;
  return Response.json({headers:['Agent ID','Score','Timestamp'],rows:Array.from({length:n},(_,i)=>[`SYN-000${i+1}`,stage==='pre'?50+i*10:80+i*5,`2026-11-04T09:0${i}:00Z`])});
};
createServer(async(req,res)=>{
  if(req.url==='/api/survey-feed'&&req.method==='POST'){
    let body='';for await(const c of req)body+=c;
    const r=await handleSurveyRequest(new Request('http://127.0.0.1:5175/api/survey-feed',{method:'POST',headers:req.headers,body}),mockFetch);
    res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());
  }
  const files={'/':'index.html','/survey-monitor.js':'survey-monitor.js','/survey-feed-template.gs':'survey-feed-template.gs'};
  if(!files[req.url]){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':req.url.endsWith('.js')?'text/javascript':'text/html','Cache-Control':'no-store'});
  res.end(await readFile(new URL('../'+files[req.url],import.meta.url)));
}).listen(5175,'127.0.0.1',()=>console.log('Synthetic integration test server: http://127.0.0.1:5175'));
