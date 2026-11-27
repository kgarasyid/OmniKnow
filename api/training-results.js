import {trainingResults} from '../server/training-results.mjs';
export default async function handler(req, res) {
  const response = await trainingResults(new Request('http://internal/api/training-results', {method:req.method}));
  res.statusCode = response.status;
  for (const [key, value] of response.headers) res.setHeader(key, value);
  res.end(Buffer.from(await response.arrayBuffer()));
}
