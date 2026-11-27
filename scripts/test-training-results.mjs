import assert from 'node:assert/strict';
import {gateway} from '../server/gateway.mjs';
import {trainingResults} from '../server/training-results.mjs';

const previous = {key:process.env.TRAINING_FEED_API_KEY, mode:process.env.AUTH_MODE};
const request = method => new Request('http://127.0.0.1:5173/api/training-results', {method});
const row = {synthetic:true,name:'Fictional Agent',score:92,result:'Pass',submittedAt:'2026-11-26T02:00:00Z',privateField:'omit'};
let calls = 0;
const fetcher = async (url, options) => {
  calls++;
  assert.equal(url,'https://omniknow-training.vercel.app/api/results');
  assert.equal(options.headers['x-api-key'],'fictional-test-key');
  assert.equal(options.redirect,'error');
  return Response.json({version:1,synthetic:true,results:[row,{...row,synthetic:false},null]});
};
try {
  delete process.env.AUTH_MODE;
  process.env.TRAINING_FEED_API_KEY = 'fictional-test-key';
  const response = await gateway(request('GET'),{fetcher});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{results:[{name:row.name,score:92,result:'Pass',submittedAt:row.submittedAt}]});
  assert.equal(await (await gateway(request('HEAD'),{fetcher})).text(),'');
  assert.equal((await gateway(request('POST'),{fetcher})).status,405);
  const beforeAuth = calls;
  process.env.AUTH_MODE = 'microsoft';
  assert.ok([401,503].includes((await gateway(request('GET'),{fetcher})).status));
  assert.equal(calls,beforeAuth,'Authentication must run before upstream access');
  for (const feed of [{version:1,synthetic:true,results:[]},{version:1,synthetic:false,results:[row]},{version:2,synthetic:true,results:[row]}]) {
    const r = await trainingResults(request('GET'),{apiKey:'fictional',fetcher:async()=>Response.json(feed)});
    assert.equal(r.status,feed.version===1 && feed.synthetic===true ? 200 : 503);
  }
  assert.equal((await trainingResults(request('GET'),{apiKey:'',fetcher:()=>assert.fail('No key must not fetch')})).status,503);
  assert.equal((await trainingResults(request('GET'),{apiKey:'fictional',fetcher:async()=>{throw Error('upstream failed')}})).status,503);
} finally {
  for (const [name,value] of [['TRAINING_FEED_API_KEY',previous.key],['AUTH_MODE',previous.mode]]) {
    if (value===undefined) delete process.env[name]; else process.env[name]=value;
  }
}
console.log('PASS: gateway routing, synthetic-only projection, auth before feed access, HEAD/POST, empty feed and unavailable upstream.');
