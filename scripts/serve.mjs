import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { handleSurveyRequest } from '../api/survey-feed.js';
import { localLearningReport } from './local-learning.mjs';
import { hardSkillReport } from './hard-skill-report.mjs';
import { askUnitDetails, localAskDrilldown } from './local-ask-drilldown.mjs';
import { trainingResults } from '../server/training-results.mjs';

const args = process.argv.slice(2);
const isPreview = args.includes('--dist');
const trainingResultsDemo = args.includes('--training-results-demo');
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || (isPreview ? 4173 : 5173));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Provide a port from 1 to 65535.');
const entry = new URL(isPreview ? '../dist/index.html' : '../index.html', import.meta.url);
try { await readFile(entry); } catch { throw new Error(isPreview ? 'Build first: npm run build' : 'Missing index.html'); }

const askDirectoryIndex = args.indexOf('--ask-dir');
const explicitAskDirectory = askDirectoryIndex >= 0 ? args[askDirectoryIndex + 1] : null;
if (askDirectoryIndex >= 0 && !explicitAskDirectory) throw new Error('Provide a directory after --ask-dir.');
const bundledAskDirectory = new URL('../private-data/ask/', import.meta.url);
const hasBundledAskDirectory = !isPreview && !explicitAskDirectory &&
  await stat(bundledAskDirectory).then(info => info.isDirectory(), () => false);
const askDirectory = explicitAskDirectory || (hasBundledAskDirectory ? fileURLToPath(bundledAskDirectory) : null);
const askReader = fileURLToPath(new URL('./read-ask-summary.py', import.meta.url));
const askDetailsEnabled = !args.includes('--no-ask-details') && !isPreview;
const askData = askDirectory
  ? promisify(execFile)('python3', ['-B', askReader, askDirectory, ...(askDetailsEnabled ? ['--details'] : [])],
      { timeout: 120_000, maxBuffer: 32 * 1024 * 1024 })
      .then(({stdout}) => {
        const data = JSON.parse(stdout);
        return askDetailsEnabled ? data : {summary:data};
      }).catch(() => null)
  : null;

async function learningDirectory(source) {
  const option = '--' + source + '-dir';
  const index = args.indexOf(option);
  if (index >= 0) {
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Provide a directory after ' + option);
    return args[index + 1];
  }
  const bundled = new URL('../private-data/' + source + '/', import.meta.url);
  return await stat(bundled).then(info => info.isDirectory(), () => false) ? fileURLToPath(bundled) : '';
}

const [trainingDirectory, tryoutDirectory] = isPreview ? ['', ''] :
  await Promise.all([learningDirectory('training'), learningDirectory('tryout')]);
const learningData = trainingDirectory || tryoutDirectory
  ? promisify(execFile)('python3', ['-B', fileURLToPath(new URL('./read-local-learning.py', import.meta.url)),
      trainingDirectory, tryoutDirectory, askDirectory || ''], {timeout:120_000, maxBuffer:16 * 1024 * 1024})
      .then(({stdout}) => JSON.parse(stdout))
      .catch(() => {
        console.error('Could not read the local Training or Tryout workbooks. Check the input folders and workbook formats.');
        return null;
      })
  : null;

function jsonResponse(request, response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  response.end(request.method === 'HEAD' ? undefined : JSON.stringify(data));
}

// Serve only the application. Repository files and local credentials are never exposed.
const server = createServer(async (request, response) => {
  if (request.url === '/api/survey-feed' && request.method === 'POST') {
    let body = ''; for await (const chunk of request) { body += chunk; if(body.length>4096){response.writeHead(413);return response.end('Too large');} }
    const result = await handleSurveyRequest(new Request(`http://127.0.0.1:${port}/api/survey-feed`, {method:'POST',headers:request.headers,body}));
    response.writeHead(result.status,Object.fromEntries(result.headers));return response.end(await result.text());
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end('Method not allowed');
  }
  let url;
  try {
    url = new URL(request.url, 'http://localhost');
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Bad request');
  }
  const path = url.pathname;
  if (path === '/api/training-results') {
    const demoResults = [
      {synthetic:true,name:'Demo Agent Alpha',score:92,result:'Pass',submittedAt:'2026-11-26T02:00:00Z'},
      {synthetic:true,name:'Demo Agent Beta',score:72,result:'Needs improvement',submittedAt:'2026-11-26T01:30:00Z'}
    ];
    const result = await trainingResults(new Request(url, {method:request.method}), trainingResultsDemo ? {
      apiKey:'fictional-local-preview',
      fetcher:async () => Response.json({version:1,synthetic:true,results:demoResults})
    } : {});
    if (trainingResultsDemo && result.ok && request.method !== 'HEAD') {
      return jsonResponse(request,response,result.status,{...await result.json(),preview:'fictional'});
    }
    response.writeHead(result.status,Object.fromEntries(result.headers));
    return response.end(Buffer.from(await result.arrayBuffer()));
  }
  if (learningData && ['/api/local-learning','/api/local-hard-skill','/local-hard-skill-documentation.png'].includes(path)) {
    const {host, origin, 'sec-fetch-site':site} = request.headers;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host) ||
        (site && site !== 'same-origin' && site !== 'none') || (origin && origin !== `http://${host}`)) {
      return jsonResponse(request, response, 403, {error:'Local access only'});
    }
    if (path === '/local-hard-skill-documentation.png') {
      const image = await readFile(new URL('../private-data/call-center-training-slide.png', import.meta.url)).catch(() => null);
      if (!image) return jsonResponse(request, response, 404, {error:'Documentation unavailable'});
      response.writeHead(200, {'Content-Type':'image/png','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'});
      return response.end(request.method === 'HEAD' ? undefined : image);
    }
    const data = await learningData;
    if (!data) return jsonResponse(request, response, 503, {error:'Local learning workbooks unavailable'});
    const report = path === '/api/local-hard-skill' ? hardSkillReport(data, url.searchParams) : localLearningReport(data, url.searchParams);
    return jsonResponse(request, response, report ? 200 : 400, report ?? {error:'Invalid period'});
  }
  if (['/local-grapari-map', '/api/local-grapari', '/api/local-grapari-locations'].includes(path)) {
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const site = request.headers['sec-fetch-site'];
    if (!hosts.includes(request.headers.host) || (site && site !== 'same-origin' && site !== 'none')) {
      return jsonResponse(request, response, 403, {error:'Local access only'});
    }
    const localMapData = path === '/api/local-grapari' ? 'grapari-units.json' : path === '/api/local-grapari-locations' ? 'grapari-locations.json' : null;
    try {
      if (localMapData) {
        const data = JSON.parse(await readFile(new URL('../private-data/' + localMapData, import.meta.url), 'utf8'));
        return jsonResponse(request, response, 200, data);
      }
      const html = await readFile(new URL('../grapari-map.html', import.meta.url));
      response.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'});
      return response.end(request.method === 'HEAD' ? undefined : html);
    } catch {
      return jsonResponse(request, response, 404, {error:'Local GraPARI file unavailable'});
    }
  }
  if (askData && path === '/api/local-ask-summary') {
    const data = await askData;
    return jsonResponse(request,response,data ? 200 : 503,data?.summary ?? {error:'ASK workbook unavailable'});
  }
  if (askData && askDetailsEnabled && ['/api/local-ask-unit-details', '/api/local-ask-drilldown'].includes(path)) {
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const {host, origin, 'sec-fetch-site':site} = request.headers;
    if (!hosts.includes(host) || (site && site !== 'same-origin' && site !== 'none') || (origin && origin !== `http://${host}`)) {
      return jsonResponse(request,response,403,{error:'Local access only'});
    }
    const data = await askData;
    if (!data) return jsonResponse(request,response,503,{error:'ASK workbook unavailable'});
    const report = path === '/api/local-ask-unit-details'
      ? askUnitDetails(data,url.searchParams) : localAskDrilldown(data,url.searchParams);
    return jsonResponse(request,response,report ? 200 : 400,report ?? {error:'Invalid ASK scope'});
  }
  const assets = {'/dashboard-period.js':'text/javascript; charset=utf-8','/dashboard-insights.js':'text/javascript; charset=utf-8','/dashboard-downloads.js':'text/javascript; charset=utf-8','/survey-monitor.js':'text/javascript; charset=utf-8','/survey-feed-template.gs':'text/plain; charset=utf-8','/dashboard-workspace.js':'text/javascript; charset=utf-8','/dashboard-workspace.css':'text/css; charset=utf-8','/help.html':'text/html; charset=utf-8','/help.js':'text/javascript; charset=utf-8'};
  if (!isPreview) {
    assets['/ringkasan-ask.html'] = 'text/html; charset=utf-8';
  }
  assets['/manrope.woff2'] = 'font/woff2';
  assets['/manrope-OFL.txt'] = 'text/plain; charset=utf-8';
  assets['/dashboard-hard-skill.js'] = 'text/javascript; charset=utf-8';
  assets['/training-results.html'] = 'text/html; charset=utf-8';
  if (path !== '/' && path !== '/index.html' && !assets[path]) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Not found');
  }
  try {
    const served = await readFile(assets[path] ? new URL('.' + path, new URL(isPreview ? '../dist/' : '../', import.meta.url)) : entry);
    response.writeHead(200, {
      'Content-Type': assets[path] || 'text/html; charset=utf-8',
      'Content-Length': served.length,
      'Cache-Control': 'no-store'
    });
    response.end(request.method === 'HEAD' ? undefined : served);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Could not read index.html');
  }
});
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`OmniKnow ${isPreview ? 'build preview' : 'development'}: http://127.0.0.1:${port}\nRefresh your browser after editing. Ctrl+C stops the server.`));
