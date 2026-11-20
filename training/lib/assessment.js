export const agents = {
  'agent-1': 'Nadia Putri Maharani',
  'agent-2': 'Rizky Pratama Wijaya',
  'agent-3': 'Aulia Rahmawati'
};
export const activity = 'service-readiness-v1';
const correct = [1, 0, 2, 1, 0];

export function grade(body) {
  if (!body || body.activity !== activity || !Object.hasOwn(agents, body.agentId) ||
      typeof body.attemptId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.attemptId) ||
      !Array.isArray(body.answers) || body.answers.length !== correct.length ||
      !body.answers.every(n => Number.isInteger(n) && n >= 0 && n < 3)) return null;
  const score = correct.filter((answer, i) => body.answers[i] === answer).length * 20;
  return { activity, agentId: body.agentId, name: agents[body.agentId], attemptId: body.attemptId,
    score, result: score >= 80 ? 'Passed' : 'Remedial', synthetic: true };
}
