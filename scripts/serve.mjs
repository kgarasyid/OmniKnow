import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { POST } from '../api/survey-feed.js';

const args = process.argv.slice(2);
const isPreview = args.includes('--dist');
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || (isPreview ? 4173 : 5173));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Provide a port from 1 to 65535.');
const entry = new URL(isPreview ? '../dist/index.html' : '../index.html', import.meta.url);
try { await readFile(entry); } catch { throw new Error(isPreview ? 'Build first: npm run build' : 'Missing index.html'); }

// Serve only the application. Repository files and local credentials are never exposed.
const server = createServer(async (request, response) => {
  if (request.url === '/api/survey-feed' && request.method === 'POST') {
    let body = ''; for await (const chunk of request) { body += chunk; if(body.length>4096){response.writeHead(413);return response.end('Too large');} }
    const result = await POST(new Request(`http://127.0.0.1:${port}/api/survey-feed`, {method:'POST',headers:request.headers,body}));
    response.writeHead(result.status,Object.fromEntries(result.headers));return response.end(await result.text());
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end('Method not allowed');
  }
  let path;
  try {
    path = new URL(request.url, 'http://localhost').pathname;
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Bad request');
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
