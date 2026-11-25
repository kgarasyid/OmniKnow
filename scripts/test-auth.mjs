import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {authConfig,seal,unseal,session,authRoute,validateIdToken} from '../server/auth.mjs';
import {gateway} from '../server/gateway.mjs';
const tenant='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222',oid='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const env={AUTH_ORIGIN:'http://127.0.0.1:5173',MICROSOFT_TENANT_ID:tenant,MICROSOFT_CLIENT_ID:client,MICROSOFT_CLIENT_SECRET:'fictional-client-secret',AUTH_SESSION_SECRET:'a'.repeat(64),AUTH_ALLOWED_OBJECT_IDS:oid+','+other};
assert.throws(()=>authConfig({}));assert.throws(()=>authConfig({...env,AUTH_ALLOWED_OBJECT_IDS:oid}));assert.throws(()=>authConfig({...env,VERCEL:'1'}));
const c=authConfig(env),now=Math.floor(Date.now()/1000),s={type:'session',tid:tenant,oid,exp:now+300},token=seal(s,c);
assert.equal(unseal(token,c).oid,oid);assert.equal(unseal(token+'x',c),null);assert.equal(unseal(seal({...s,exp:now-1},c),c),null);
const request=(path,cookie='',method='GET')=>new Request(c.origin+path,{method,headers:{cookie}});
assert.equal(session(request('/',`omniknow_session=${token}`),c).oid,oid);
assert.equal(session(request('/',`omniknow_session=${seal({...s,oid:'unknown'},c)}`),c),null);
const start=await authRoute(request('/auth/login'),'/auth/login',c);assert.equal(start.status,302);const location=new URL(start.headers.get('location'));assert.equal(location.searchParams.get('code_challenge_method'),'S256');assert.equal(location.searchParams.get('scope'),'openid profile');
assert.equal((await authRoute(request('/auth/callback?state=wrong&code=fake'),'/auth/callback',c,()=>{throw Error('Must not fetch')})).status,403);
assert.equal((await authRoute(request('/auth/logout','','POST'),'/auth/logout',c)).status,403);
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...publicKey.export({format:'jwk'}),kid:'test-key',use:'sig'};
const claims={iss:`https://login.microsoftonline.com/${tenant}/v2.0`,tid:tenant,aud:client,nonce:'nonce',oid,iat:now,exp:now+300};
const jwt=p=>{const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url'),b=Buffer.from(JSON.stringify(p)).toString('base64url'),data=h+'.'+b;return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url')};
const fetcher=async()=>Response.json({keys:[jwk]});assert.equal((await validateIdToken(jwt(claims),c,'nonce',fetcher)).oid,oid);
for(const change of [{oid:'unknown'},{aud:'wrong'},{tid:'wrong'},{iss:'wrong'},{nonce:'wrong'},{exp:now-1}])await assert.rejects(()=>validateIdToken(jwt({...claims,...change}),c,'nonce',fetcher));
const old={...process.env};Object.assign(process.env,env);
for(const path of ['/','/index.html','/dashboard-workspace.js','/dist/index.html','/api/survey-feed']){
 const r=await gateway(request(path));assert.equal(r.status,path.startsWith('/api/')?401:401);
 assert.ok(!(await r.text()).includes('const demoAgents='));
}
assert.equal((await gateway(request('/index.html',`omniknow_session=${token}`),{root:new URL('../',import.meta.url)})).status,200);
assert.equal((await gateway(request('/reference/deployed-index.html',`omniknow_session=${token}`))).status,404);
Object.keys(env).forEach(k=>delete process.env[k]);assert.equal((await gateway(request('/'))).status,503);Object.assign(process.env,old);
console.log('PASS: fail-closed configuration, two-user enforcement, signed cookies, expiry/tampering, PKCE/state, real RSA token verification and claim rejection, logout CSRF, protected HTML/assets/API and file allowlist.');
