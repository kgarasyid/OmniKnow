// The public dashboard exposes only synthetic agent results.
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'GET') return res.status(405).setHeader('Allow','GET').end();
  try {
    const upstream=await fetch('https://omniknow-training.vercel.app/api/results',{
      headers:{'x-api-key':process.env.TRAINING_FEED_API_KEY},redirect:'error',
      cache:'no-store',signal:AbortSignal.timeout(12000)
    });
    if(!upstream.ok) throw Error();
    const feed=await upstream.json();
    if(feed.version!==1 || feed.synthetic!==true || !Array.isArray(feed.results)) throw Error();
    const results=feed.results.filter(r=>r.synthetic===true).map(({name,score,result,submittedAt})=>({name,score,result,submittedAt}));
    return res.json({results});
  } catch {return res.status(503).json({error:'Training results are temporarily unavailable.'});}
}
