import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { handleSurveyRequest } from '../api/survey-feed.js';

const args = process.argv.slice(2);
const isPreview = args.includes('--dist');
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
const askDetailsEnabled = args.includes('--ask-details') && !isPreview;
const askData = askDirectory
  ? promisify(execFile)('python3', [askReader, askDirectory, ...(askDetailsEnabled ? ['--details'] : [])],
      { timeout: 120_000, maxBuffer: 32 * 1024 * 1024 })
      .then(({stdout}) => {
        const data = JSON.parse(stdout);
        return askDetailsEnabled ? data : {summary:data};
      }).catch(() => null)
  : null;

function jsonResponse(request, response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  response.end(request.method === 'HEAD' ? undefined : JSON.stringify(data));
}

function askUnitDetails(data, query) {
  const from = query.get('from');
  const to = query.get('to');
  const unit = query.get('unit');
  const quadrant = query.get('quadrant');
  const segment = query.get('segment');
  const isMonth = value => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value ?? '');
  let location;
  try { location = JSON.parse(unit); } catch { return null; }
  if (!Array.isArray(location) || location.length !== 5 || !location.every(field => typeof field==='string') ||
      !isMonth(from) || !isMonth(to) || from>to || !/^(?:HAHAKO|HALOKO|LOHAKO|LOLOKO) \((?:HA|LA)\)$|^BELUM TERSEDIA$/.test(quadrant ?? '')) return null;
  const key = JSON.stringify(location);
  const latest = new Map();
  const periods = Object.keys(data.placements).sort().filter(month=>month>=from&&month<=to);
  if (!periods.some(month=>Object.hasOwn(data.summary[month].locations,key))) return null;
  for (const month of periods) {
    for (const [id, placement] of Object.entries(data.placements[month])) latest.set(id, {placement,month});
  }
  return Array.from(latest.values()).filter(({placement:[group,label,assigned]}) =>
    label===quadrant && JSON.stringify(assigned)===key && (!segment || segment===group))
    .map(({placement:[group,,,name,scores],month})=>({name,scores,segment:group,month}))
    .sort((a,b)=>a.name.localeCompare(b.name,'id'));
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
  if (askData && askDetailsEnabled && path === '/api/local-ask-unit-details') {
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const site = request.headers['sec-fetch-site'];
    if (!hosts.includes(request.headers.host) || (site && site !== 'same-origin' && site !== 'none')) {
      return jsonResponse(request,response,403,{error:'Local access only'});
    }
    const data = await askData;
    if (!data) return jsonResponse(request,response,503,{error:'ASK workbook unavailable'});
    const rows = askUnitDetails(data,url.searchParams);
    return jsonResponse(request,response,rows ? 200 : 400,rows ?? {error:'Invalid ASK unit scope'});
  }
  const assets = {'/dashboard-period.js':'text/javascript; charset=utf-8','/dashboard-insights.js':'text/javascript; charset=utf-8','/dashboard-downloads.js':'text/javascript; charset=utf-8','/survey-monitor.js':'text/javascript; charset=utf-8','/survey-feed-template.gs':'text/plain; charset=utf-8','/dashboard-workspace.js':'text/javascript; charset=utf-8','/dashboard-workspace.css':'text/css; charset=utf-8'};
  if (path !== '/' && path !== '/index.html' && !assets[path]) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Not found');
  }
  try {
    const body = await readFile(assets[path] ? new URL('.' + path, new URL(isPreview ? '../dist/' : '../', import.meta.url)) : entry);
    response.writeHead(200, {
      'Content-Type': assets[path] || 'text/html; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Could not read index.html');
  }
});
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`OmniKnow ${isPreview ? 'build preview' : 'development'}: http://127.0.0.1:${port}\nRefresh your browser after editing. Ctrl+C stops the server.`));
