import { reportLocationFilter } from './report-area.mjs';

const formatKey = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function average(rows, key) {
  const values = rows.map(row => row[key]).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function uniqueParticipants(rows) {
  return rows.length ? new Set(rows.map(row => row.id).filter(Boolean)).size : null;
}

function sessionCount(rows) {
  return new Set(rows.map(row => JSON.stringify(row.session))).size;
}

function trainingSummary(rows, hard = rows.filter(row => formatKey(row.type) === 'hardskill')) {
  const regular = rows.filter(row => row.program);
  const pairs = regular.filter(row => Number.isFinite(row.pre) && Number.isFinite(row.post));
  return {
    hard: uniqueParticipants(hard),
    hardAttendance: hard.length,
    hardSessions: sessionCount(hard),
    soft: uniqueParticipants(rows.filter(row => formatKey(row.type) === 'softskill')),
    regular: uniqueParticipants(regular),
    acs: uniqueParticipants(regular.filter(row => row.program === 'ACS Booster')),
    bad: uniqueParticipants(regular.filter(row => row.program === 'Bad Ticket')),
    attendance: rows.length,
    sessions: sessionCount(rows),
    post: average(regular, 'post'),
    pairs: pairs.length,
    pairPre: average(pairs, 'pre'),
    pairPost: average(pairs, 'post'),
    pairMovement: {
      naik: pairs.filter(row => row.post > row.pre).length,
      tetap: pairs.filter(row => row.post === row.pre).length,
      turun: pairs.filter(row => row.post < row.pre).length,
    },
    pairChangeBands: {
      downOver5: pairs.filter(row => row.post - row.pre < -5).length,
      downTo5: pairs.filter(row => row.post - row.pre >= -5 && row.post < row.pre).length,
      unchanged: pairs.filter(row => row.post === row.pre).length,
      upTo5: pairs.filter(row => row.post - row.pre <= 5 && row.post > row.pre).length,
      upOver5: pairs.filter(row => row.post - row.pre > 5).length,
    },
    preOnly: regular.filter(row => Number.isFinite(row.pre) && !Number.isFinite(row.post)).length,
    postOnly: regular.filter(row => !Number.isFinite(row.pre) && Number.isFinite(row.post)).length,
  };
}

function testPairDetails(rows) {
  return rows
    .filter(row => row.program && Number.isFinite(row.pre) && Number.isFinite(row.post))
    .map(row => ({
      id: row.id || '',
      name: row.name || row.id || 'Peserta tanpa nama',
      channel: row.channel || 'CTP belum terpetakan',
      area: row.area || row.site || row.region || row.unit || 'Area belum tercatat',
      region: row.region || '',
      unit: row.unit || '',
      program: row.program || '',
      title: row.title || '',
      date: row.date || '',
      pre: row.pre,
      post: row.post,
      delta: Math.round((row.post - row.pre) * 10) / 10,
      movement: row.post > row.pre ? 'naik' : row.post < row.pre ? 'turun' : 'tetap',
    }));
}

function testBreakdown(rows, keyFor) {
  const groups = new Map();
  for (const row of rows.filter(row => row.program)) {
    const key = keyFor(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].map(([label, group]) => ({label, ...trainingSummary(group)}))
    .filter(group => group.pairs || group.preOnly || group.postOnly)
    .sort((a, b) => b.pairs - a.pairs || a.label.localeCompare(b.label, 'id'));
}

function tryoutSummary(rows) {
  const groupByLevel = new Map();
  const bands = {count: 0, high: 0, mid: 0, low: 0};
  for (const row of rows) {
    const levelRows = groupByLevel.get(row.level) ?? [];
    levelRows.push(row);
    groupByLevel.set(row.level, levelRows);
    if (Number.isFinite(row.score)) {
      bands.count++;
      bands[row.score >= 90 ? 'high' : row.score >= 80 ? 'mid' : 'low']++;
    }
  }
  const levels = ['Basic', 'Intermediate', 'Advance', 'Expert'].flatMap(level => {
    const entries = groupByLevel.get(level);
    return entries ? [{level, attempts: entries.length, score: average(entries, 'score')}] : [];
  });
  return {
    ...bands,
    attempts: rows.length,
    score: average(rows, 'score'),
    unmapped: rows.filter(row => !row.channel).length,
    coverage: [...new Set(rows.map(row => row.date.slice(0, 7) + ' W' + row.week))].sort(),
    sessions: sessionCount(rows),
    levels,
  };
}

function previousMonth(from, to) {
  const start = new Date(from);
  if (start.getUTCDate() !== 1 || from.slice(0, 7) !== to.slice(0, 7)) return null;
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() + 1);
  if (end.getUTCDate() !== 1) return null;
  start.setUTCDate(0);
  const last = start.toISOString().slice(0, 10);
  return [last.slice(0, 7) + '-01', last];
}

export function localLearningReport(data, query) {
  const from = query.get('from');
  const to = query.get('to');
  if (!day(from) || !day(to) || from > to) return null;

  const locationMatches = reportLocationFilter(query);
  const scopedTraining = data.training.filter(locationMatches);
  const scopedHardSkill = data.hardSkill?.filter(locationMatches);
  const scopedTryout = data.tryout.filter(locationMatches);
  const within = (start, end) => row => row.date >= start && row.date <= end;
  const currentPeriod = within(from, to);
  const currentTraining = scopedTraining.filter(currentPeriod);
  const currentHardSkill = scopedHardSkill?.filter(currentPeriod);
  const currentTryout = scopedTryout.filter(currentPeriod);
  const previous = previousMonth(from, to);
  const previousPeriod = previous && within(...previous);
  const training = trainingSummary(currentTraining, currentHardSkill);
  const priorTraining = data.hasTraining && previousPeriod
    ? trainingSummary(scopedTraining.filter(previousPeriod), scopedHardSkill?.filter(previousPeriod)) : null;
  if (priorTraining && data.hardSkill?.some(previousPeriod)) priorTraining.hard ??= 0;
  const tryout = tryoutSummary(currentTryout);
  const months = [...new Set([
    ...[...data.training, ...data.tryout].map(row => row.date.slice(0, 7)),
    ...(data.badTickets || []).map(row => row.month),
  ])].sort();
  const cohorts = [
    ['GraPARI · MOMO', row => row.channel === 'GraPARI' && row.model === 'MOMO'],
    ['GraPARI · TOMO', row => row.channel === 'GraPARI' && row.model === 'TOMO'],
    ['GraPARI · Model belum tercatat', row => row.channel === 'GraPARI' && !row.model],
    ['Call Center', row => row.channel === 'Call Center'],
    ['E-Care', row => row.channel === 'E-Care'],
    ['CTP belum terpetakan', row => !row.channel],
  ];
  const groups = cohorts.flatMap(([label, matches]) => {
    const trainingRows = currentTraining.filter(matches);
    const hardSkillRows = currentHardSkill?.filter(matches);
    const tryoutRows = currentTryout.filter(matches);
    return trainingRows.length || hardSkillRows?.length || tryoutRows.length
      ? [{label, training: trainingSummary(trainingRows, hardSkillRows), tryout: tryoutSummary(tryoutRows)}]
      : [];
  });
  // Compare the same set of Tryout weeks, levels and makeup sessions.
  const slots = rows => [...new Set(rows.map(row => JSON.stringify(row.session.slice(1))))].sort().join('|');
  const previousTryout = previous ? data.tryout.filter(within(...previous)) : [];
  const currentSlots = slots(data.tryout.filter(within(from, to)));
  const priorTryout = currentSlots && currentSlots === slots(previousTryout)
    ? tryoutSummary(scopedTryout.filter(within(...previous))) : null;
  return {
    months, groups,
    training: data.hasTraining ? training : null,
    testBreakdown: data.hasTraining ? {
      programs: testBreakdown(currentTraining, row => row.program),
      channels: testBreakdown(currentTraining, row => row.channel || 'CTP belum terpetakan'),
      programChannels: testBreakdown(currentTraining, row => `${row.program} · ${row.channel || 'CTP belum terpetakan'}`),
      sessions: testBreakdown(currentTraining, row => `${row.date} · ${row.title} · ${row.channel || 'CTP belum terpetakan'}${row.session[2] ? ' · '+row.session[2] : ''}`),
      pairDetails: testPairDetails(currentTraining),
    } : null,
    priorTraining,
    tryout: data.hasTryout ? tryout : null,
    priorTryout,
  };
}
