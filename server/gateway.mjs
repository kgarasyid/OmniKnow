import {readFile} from 'node:fs/promises';
import {authConfig,authRoute,session,loginPage} from './auth.mjs';
import {reportData} from './report-data.mjs';
import {handleSurveyRequest} from '../api/survey-feed.js';
const assets={'/local-grapari-map':'grapari-map.html','/':'index.html','/index.html':'index.html',...Object.fromEntries(['training-results.html','dashboard-hard-skill.js','dashboard-workspace.js','dashboard-workspace.css','dashboard-insights.js','dashboard-period.js','dashboard-downloads.js','survey-monitor.js','survey-feed-template.gs','manrope.woff2','manrope-OFL.txt'].map(f=>['/'+f,f]))};
export async function gateway(request,{root=new URL('../dist/',import.meta.url),fetcher=fetch}={}){
 const path=new URL(request.url).pathname,base={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':path==='/local-grapari-map'?'SAMEORIGIN':'DENY'};
 const requireMicrosoft=process.env.AUTH_MODE==='microsoft';
 let c;if(requireMicrosoft){try{c=authConfig()}catch{return new Response(loginPage('Login belum dikonfigurasi. Pengelola perlu menyiapkan Microsoft Entra dan dua Object ID pengguna sebelum aplikasi dapat dibuka.'),{status:503,headers:{...base,'Content-Type':'text/html; charset=utf-8'}})}}
 if(!['GET','HEAD'].includes(request.method)&&path!=='/auth/logout'&&path!=='/api/survey-feed')return new Response('Method not allowed',{status:405,headers:base});
 if(!requireMicrosoft&&path.startsWith('/auth/'))return new Response(null,{status:302,headers:{...base,Location:'/'}});
 if(requireMicrosoft&&path.startsWith('/auth/')){if(path!=='/auth/logout'&&!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const r=await authRoute(request,path,c,fetcher);if(r)return r}
 if(requireMicrosoft&&!session(request,c))return path.startsWith('/api/')?Response.json({error:'Authentication required'},{status:401,headers:base}):new Response(loginPage(),{status:401,headers:{...base,'Content-Type':'text/html; charset=utf-8'}});
 const report=await reportData(request);if(report)return report;
 if(path==='/api/survey-feed')return request.method==='POST'?handleSurveyRequest(request,fetcher):new Response('Method not allowed',{status:405});
 if(!assets[path])return new Response('Not found',{status:404,headers:base});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 try{let body=await readFile(new URL(assets[path],root));const type=path.endsWith('.woff2')?'font/woff2':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':/\.(gs|txt)$/.test(path)?'text/plain':'text/html';
 if(requireMicrosoft&&type==='text/html')body=Buffer.from(body.toString().replace('<body>','<body><form method="post" action="/auth/logout" style="position:fixed;bottom:12px;right:14px;z-index:9999"><button style="padding:10px;background:white;color:#c90032;border:1px solid #dfcbd1;border-radius:8px">Keluar akun</button></form>').replaceAll('Demo Admin','Pengguna terautentikasi'));
 return new Response(request.method==='HEAD'?null:body,{headers:{...base,'Content-Type':type==='font/woff2'?type:type+'; charset=utf-8'}})
 }catch{return new Response('Application unavailable',{status:503,headers:base})}
}
