import { grade } from '../lib/assessment.js';
import { saveResult } from '../lib/results.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).setHeader('Allow','POST').end();
  const result = grade(req.body);
  if (!result) return res.status(400).json({error:'Choose one answer for every question.'});
  try { return res.json(await saveResult(result)); }
  catch { return res.status(503).json({error:'Could not confirm submission. Your answers are ready to retry.'}); }
}
