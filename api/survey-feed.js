import {requireSession} from '../server/auth.mjs';
// Read-only, public Google response feeds. No credentials or arbitrary URL proxying.
export function normalizeFeedUrl(value) {
  let u;
  try { u = new URL(value); } catch { throw new Error('Enter a valid Google response-data URL.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw new Error('Use an HTTPS Google data-feed link without credentials.');
  if (u.hostname === 'script.google.com' && /^\/macros\/s\/[\w-]+\/exec$/.test(u.pathname)) return u.href;
  if (u.hostname === 'docs.google.com') {
    if (/^\/spreadsheets\/d\/e\/[\w-]+\/pub$/.test(u.pathname)) {
      u.searchParams.set('output', 'csv'); return u.href;
    }
    const match = u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/(?:edit|export))?\/?$/);
    if (match) {
      const gid = u.searchParams.get('gid') || new URLSearchParams(u.hash.slice(1)).get('gid') || '0';
      if (!/^\d+$/.test(gid)) throw new Error('The sheet tab ID must be numeric.');
      return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
    }
  }
  throw new Error('Use a Google Sheets response-data link or a deployed Apps Script /exec URL. A form respondent link cannot supply responses.');
}

function allowedRedirect(value) {
  const u = new URL(value);
  return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
    (u.hostname === 'docs.google.com' || u.hostname === 'script.google.com' ||
      u.hostname === 'script.googleusercontent.com' || /^[a-z0-9-]+-sheets\.googleusercontent\.com$/.test(u.hostname));
}

export async function readFeed(url, fetcher = fetch) {
  let target = normalizeFeedUrl(url);
  const signal = AbortSignal.timeout(15000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const r = await fetcher(target, { redirect: 'manual', signal, headers: { Accept: 'application/json,text/csv,text/plain', 'Cache-Control': 'no-cache' } });
    if ([301,302,303,307,308].includes(r.status)) {
      const location = r.headers.get('location');
      if (!location) throw new Error('The feed returned an invalid redirect.');
      const next = new URL(location, target).href;
      if (!allowedRedirect(next)) throw new Error('The feed requires sign-in or redirects outside supported Google data hosts. Use an accessible demo feed.');
      target = next; continue;
    }
    if (!r.ok) throw new Error(`Google returned HTTP ${r.status}. Check the link and its read access.`);
    const limit = 2 * 1024 * 1024;
    if (Number(r.headers.get('content-length')) > limit) throw new Error('Feed is too large (maximum 2 MB).');
    const reader = r.body.getReader(); let size = 0; const chunks = [];
    while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('Feed is too large (maximum 2 MB).'); } chunks.push(value); }
    const text = Buffer.concat(chunks).toString('utf8');
    if (/^\s*</.test(text)) throw new Error('The link returned a web page, not response data. Use CSV or an Apps Script JSON feed.');
    return { text, fetchedAt: new Date().toISOString() };
  }
  throw new Error('Too many redirects from the Google feed.');
}

export async function handleSurveyRequest(request, fetcher = fetch) {
  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return Response.json({error:'Cross-origin requests are not supported.'}, {status:403,headers});
    const body = await request.text();
    if (body.length > 4096) return Response.json({error:'Request is too large.'},{status:413,headers});
    const {url} = JSON.parse(body);
    if (typeof url !== 'string' || url.length > 2048) throw new Error('Provide one response-data URL.');
    return Response.json(await readFeed(url, fetcher), {headers});
  } catch (error) {
    const message = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'Google did not respond within 15 seconds. Try again.' : error.message;
    // Do not log URLs or response rows.
    console.warn('Survey feed request failed:', error.name);
    return Response.json({error:message || 'Could not read the response feed.'}, {status:400,headers});
  }
}
export async function POST(request) { const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Cross-origin requests are not supported.'},{status:403});if(!requireSession(request))return Response.json({error:'Authentication required'},{status:401});return handleSurveyRequest(request); }
