import {createHmac, timingSafeEqual, randomBytes, createHash, createPublicKey, verify} from 'node:crypto';
const guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function authConfig(env=process.env){
 const users=(env.AUTH_ALLOWED_OBJECT_IDS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean),origin=new URL(env.AUTH_ORIGIN||'http://127.0.0.1:5173');
 if(!guid.test(env.MICROSOFT_TENANT_ID||'')||!guid.test(env.MICROSOFT_CLIENT_ID||'')||!env.MICROSOFT_CLIENT_SECRET||!env.AUTH_SESSION_SECRET||env.AUTH_SESSION_SECRET.length<43||users.length!==2||new Set(users).size!==2||users.some(s=>!guid.test(s)))throw Error('AUTH_NOT_CONFIGURED');
 if(origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||!(origin.protocol==='https:'||(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)&&env.VERCEL!=='1')))throw Error('AUTH_INVALID_ORIGIN');
 return {tenant:env.MICROSOFT_TENANT_ID.toLowerCase(),client:env.MICROSOFT_CLIENT_ID,clientSecret:env.MICROSOFT_CLIENT_SECRET,secret:env.AUTH_SESSION_SECRET,users,origin:origin.origin,secure:origin.protocol==='https:'};
}
export function seal(value,c){const data=Buffer.from(JSON.stringify(value)).toString('base64url');return data+'.'+createHmac('sha256',c.secret).update(data).digest('base64url')}
export function unseal(value,c){try{const [data,mac,...extra]=(value||'').split('.');if(extra.length||!data||!mac)return null;const want=createHmac('sha256',c.secret).update(data).digest(),got=Buffer.from(mac,'base64url');if(want.length!==got.length||!timingSafeEqual(want,got))return null;const obj=JSON.parse(Buffer.from(data,'base64url'));return Number.isFinite(obj.exp)&&obj.exp>Date.now()/1000?obj:null}catch{return null}}
function readCookie(request,name){const parts=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));return parts.length===1?parts[0].slice(name.length+1):''}
function cookie(name,value,c,age){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${c.secure?'; Secure':''}`}
export function session(request,c){const s=unseal(readCookie(request,'omniknow_session'),c);return s?.type==='session'&&s.tid===c.tenant&&c.users.includes(s.oid)?s:null}
export function requireSession(request){try{return session(request,authConfig())}catch{return null}}
export async function validateIdToken(token,c,nonce,fetcher=fetch){
 const parts=String(token||'').split('.');if(parts.length!==3)throw Error('TOKEN_INVALID');
 const head=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
 if(head.alg!=='RS256'||typeof head.kid!=='string')throw Error('TOKEN_INVALID');
 const res=await fetcher(`https://login.microsoftonline.com/${c.tenant}/discovery/v2.0/keys`,{signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('KEYS_UNAVAILABLE');
 const keys=await res.json(),key=keys.keys?.find(k=>k.kid===head.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig'));if(!key||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error('TOKEN_INVALID');
 const now=Date.now()/1000;if(claims.iss!==`https://login.microsoftonline.com/${c.tenant}/v2.0`||claims.tid!==c.tenant||claims.aud!==c.client||claims.nonce!==nonce||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||(claims.nbf&&claims.nbf>now+60)||!c.users.includes(claims.oid))throw Error('ACCESS_DENIED');
 return claims;
}
export function loginPage(message='Masuk dengan akun Microsoft kantor yang telah diizinkan.'){return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OmniKnow · Login</title><style>body{font:16px system-ui;background:#fff5f7;color:#252b3b;min-height:95vh;display:grid;place-items:center;margin:0}main{background:white;border:1px solid #f5dce3;border-top:5px solid #ed1639;border-radius:18px;padding:40px;max-width:420px;margin:20px}h1{color:#db1239}p{line-height:1.8}a{display:block;background:#e90032;color:white;padding:14px;border-radius:8px;text-decoration:none;text-align:center}small{display:block;margin-top:22px;color:#677085}</style><main><h1>OmniKnow</h1><h2>Akses tim terbatas</h2><p>${message}</p><a href="/auth/login">Masuk dengan Microsoft</a><small>Hanya dua akun yang disetujui. Data asli tidak termasuk dalam repository.</small></main></html>`}
export async function authRoute(request,path,c,fetcher=fetch){
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"};
 if(path==='/auth/login'){
  const transaction={type:'transaction',state:randomBytes(24).toString('base64url'),nonce:randomBytes(24).toString('base64url'),verifier:randomBytes(48).toString('base64url'),exp:Math.floor(Date.now()/1000)+600};
  const url=new URL(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/authorize`);url.search=new URLSearchParams({client_id:c.client,response_type:'code',redirect_uri:c.origin+'/auth/callback',response_mode:'query',scope:'openid profile',state:transaction.state,nonce:transaction.nonce,code_challenge:createHash('sha256').update(transaction.verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});
  return new Response(null,{status:302,headers:{...headers,Location:url.href,'Set-Cookie':cookie('omniknow_login',seal(transaction,c),c,600)}});
 }
 if(path==='/auth/callback'){
  try{
   const url=new URL(request.url),tx=unseal(readCookie(request,'omniknow_login'),c);if(!tx||tx.type!=='transaction'||url.searchParams.get('state')!==tx.state||!url.searchParams.get('code')||url.searchParams.has('error'))throw Error('LOGIN_FAILED');
   const response=await fetcher(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client,client_secret:c.clientSecret,grant_type:'authorization_code',code:url.searchParams.get('code'),redirect_uri:c.origin+'/auth/callback',code_verifier:tx.verifier}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('LOGIN_FAILED');const tokens=await response.json(),claims=await validateIdToken(tokens.id_token,c,tx.nonce,fetcher),now=Math.floor(Date.now()/1000);
   const result=new Response(null,{status:302,headers:{...headers,Location:'/'}});result.headers.append('Set-Cookie',cookie('omniknow_login','',c,0));result.headers.append('Set-Cookie',cookie('omniknow_session',seal({type:'session',tid:c.tenant,oid:claims.oid,exp:Math.min(now+3600,claims.exp)},c),c,Math.min(3600,claims.exp-now)));return result;
  }catch{return new Response(loginPage('Login gagal atau akun belum memiliki akses. Hubungi pengelola aplikasi.'),{status:403,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Set-Cookie':cookie('omniknow_login','',c,0)}})}
 }
 if(path==='/auth/logout'){
  if(request.method!=='POST'||request.headers.get('origin')!==c.origin)return new Response('Forbidden',{status:403,headers});
  return new Response(null,{status:303,headers:{...headers,Location:'/', 'Set-Cookie':cookie('omniknow_session','',c,0)}});
 }
 if(path==='/auth/session')return Response.json({authenticated:!!session(request,c)},{headers});
 return null;
}
