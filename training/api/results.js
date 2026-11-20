import { createHash, timingSafeEqual } from 'node:crypto';
import { agents } from '../lib/assessment.js';
import { readResult } from '../lib/results.js';
const digest = value => createHash('sha256').update(value).digest();
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).setHeader('Allow','GET').end();
  const key = process.env.TRAINING_FEED_API_KEY;
  if (!key || !timingSafeEqual(digest(key),digest(String(req.headers['x-api-key'] || ''))))
    return res.status(401).json({error:'API key required.'});
  try {
    const results = (await Promise.all(Object.keys(agents).map(readResult))).filter(Boolean);
    return res.json({version:1, synthetic:true, results:results.sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt))});
  } catch { return res.status(503).json({error:'Results temporarily unavailable.'}); }
}
