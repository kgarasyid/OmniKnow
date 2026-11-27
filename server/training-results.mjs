// Only synthetic submissions may be returned to the dashboard.
export async function trainingResults(request, {fetcher = fetch, apiKey = process.env.TRAINING_FEED_API_KEY} = {}) {
  const headers = {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'};
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, {status:405, headers:{...headers, Allow:'GET, HEAD'}});
  }
  try {
    if (!apiKey) throw new Error('Feed unavailable');
    const upstream = await fetcher('https://omniknow-training.vercel.app/api/results', {
      headers:{'x-api-key':apiKey}, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(12000)
    });
    if (!upstream.ok) throw new Error('Feed unavailable');
    const feed = await upstream.json();
    if (feed.version !== 1 || feed.synthetic !== true || !Array.isArray(feed.results)) throw new Error('Invalid feed');
    const results = feed.results.filter(record => record?.synthetic === true)
      .map(({name, score, result, submittedAt}) => ({name, score, result, submittedAt}));
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({results}), {
      headers:{...headers, 'Content-Type':'application/json; charset=utf-8'}
    });
  } catch {
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({error:'Training results are temporarily unavailable.'}), {
      status:503, headers:{...headers, 'Content-Type':'application/json; charset=utf-8'}
    });
  }
}
