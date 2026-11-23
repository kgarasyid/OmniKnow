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

function trainingSummary(rows) {
  const hard = rows.filter(row => formatKey(row.type) === 'hardskill');
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
  };
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

  const channel = query.get('channel');
  const area = formatKey(query.get('area'));
  const regions = query.getAll('geoRegion').map(formatKey);
  const selectedRegion = formatKey(query.get('region'));
  const unit = formatKey(query.get('unit'));
  const unitId = query.get('unitId');
  const locationMatches = row =>
    (!channel || channel === row.channel) &&
    (!area || area === formatKey(row.area)) &&
    (!regions.length || regions.includes(formatKey(row.region))) &&
    (!selectedRegion || selectedRegion === formatKey(row.region)) &&
    (!unit || (unitId && row.unitId ? unitId === row.unitId : unit === formatKey(row.unit)));
  const scopedTraining = data.training.filter(locationMatches);
  const scopedTryout = data.tryout.filter(locationMatches);
  const within = (start, end) => row => row.date >= start && row.date <= end;
  const currentTraining = scopedTraining.filter(within(from, to));
  const currentTryout = scopedTryout.filter(within(from, to));
  const previous = previousMonth(from, to);
  const training = trainingSummary(currentTraining);
  const tryout = tryoutSummary(currentTryout);
  const months = [...new Set([...data.training, ...data.tryout].map(row => row.date.slice(0, 7)))].sort();
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
    const tryoutRows = currentTryout.filter(matches);
    return trainingRows.length || tryoutRows.length
      ? [{label, training: trainingSummary(trainingRows), tryout: tryoutSummary(tryoutRows)}]
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
    priorTraining: data.hasTraining && previous ? trainingSummary(scopedTraining.filter(within(...previous))) : null,
    tryout: data.hasTryout ? tryout : null,
    priorTryout,
  };
}
