import { get, put } from '@vercel/blob';
import { activity } from './assessment.js';
const path = id => activity + '/' + id + '.json';
export async function readResult(id) {
  const file = await get(path(id), { access: 'private', useCache: false });
  return file ? new Response(file.stream).json() : null;
}
export async function saveResult(record) {
  const previous = await readResult(record.agentId);
  if (previous?.attemptId === record.attemptId) return previous;
  const result = { ...record, submittedAt: new Date().toISOString() };
  await put(path(record.agentId), JSON.stringify(result), { access: 'private',
    addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  return result;
}
