const series = [
  {key: 'offlineBadTicket', label: 'Offline Bad Ticket', method: 'Offline'},
  {key: 'onlineBadTicket', label: 'Online Bad Ticket', method: 'Online'},
  {key: 'onlineAcsIBooster', label: 'Online ACS iBooster', method: 'Online'},
  {key: 'other', label: 'Materi dan metode lainnya', method: ''},
];

const collator = new Intl.Collator('id-ID', {numeric: true});
const keyOf = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const slugOf = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const monthOf = row => row.date.slice(0, 7);

function location(row) {
  const {channel, area, site} = row;
  const contactCenter = channel === 'Call Center' || (channel !== 'GraPARI' && Boolean(site));
  const prefix = contactCenter ? 'cc' : {GraPARI:'grapari', 'E-Care':'ecare'}[channel] || 'other';
  const label = (contactCenter ? site : area) || 'Lokasi belum tercatat';
  return {key: prefix + ':' + slugOf(label), label, channel: contactCenter ? 'Contact Center' : channel || 'CTP belum tercatat'};
}

function groupBy(rows, select) {
  const groups = new Map();
  for (const row of rows) {
    const key = select(row);
    const members = groups.get(key);
    if (members) members.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

function timelineBucket(key, rows) {
  const bySeries = {offlineBadTicket: 0, onlineBadTicket: 0, onlineAcsIBooster: 0, other: 0};
  const online = rows.filter(row => row.method === 'Online').length;
  const offline = rows.filter(row => row.method === 'Offline').length;
  for (const {method, material} of rows) {
    const topic = keyOf(material);
    const key = topic === 'badticket' && method === 'Offline' ? 'offlineBadTicket' :
      topic === 'badticket' && method === 'Online' ? 'onlineBadTicket' :
      topic === 'acsibooster' && method === 'Online' ? 'onlineAcsIBooster' : 'other';
    bySeries[key]++;
  }
  return {key, attendance: rows.length, online, offline, bySeries};
}

function dates(rows) {
  if (!rows.length) return null;
  const values = rows.map(row => row.date).sort();
  return {from: values[0], to: values.at(-1)};
}

function monthsBetween(from, to) {
  const months = [];
  const cursor = new Date(from.slice(0, 7) + '-01');
  const end = to.slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= end) {
    const month = cursor.toISOString().slice(0, 7);
    months.push(month);
    if (month === end) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function previousMonth(month) {
  const previous = new Date(month + '-01');
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return previous.toISOString().slice(0, 7);
}

function evaluation(rows) {
  const pairs = rows.filter(row => Number.isFinite(row.pre) && Number.isFinite(row.post));
  const mean = key => pairs.length ? pairs.reduce((sum,row) => sum + row[key],0) / pairs.length : null;
  return {
    pairs: pairs.length, pre: mean('pre'), post: mean('post'),
    surveySubmitted: rows.filter(row => row.surveySubmitted === true).length,
    surveyRecorded: rows.some(row => typeof row.surveySubmitted === 'boolean'),
  };
}

function details(rows) {
  const groups = groupBy(rows, row => JSON.stringify([
    row.date, row.batch, row.material, row.title, row.method, row.function, row.region, row.unit, row.channel, location(row).key,
  ]));
  return [...groups.values()].map(matches => {
    const {date, batch, material, title, method, function: role, region, unit, channel} = matches[0];
    const place = location(matches[0]);
    return {date, batch, material, title, method, function: role, region, unit, place: place.key,
      placeLabel: place.label, channel: channel || place.channel, attendance: matches.length};
  }).sort((a,b) => a.date.localeCompare(b.date) || collator.compare(a.method,b.method) ||
    collator.compare(a.material,b.material) || collator.compare(a.batch,b.batch));
}

export function hardSkillReport(data, query) {
  const from = query.get('from');
  const to = query.get('to');
  if (!isDay(from) || !isDay(to) || from > to) return null;

  const rows = data.hardSkill || [];
  const channel = query.get('channel');
  const area = keyOf(query.get('area'));
  const region = keyOf(query.get('region'));
  const regions = query.getAll('geoRegion').map(keyOf).filter(Boolean);
  const unit = keyOf(query.get('unit'));
  const unitId = query.get('unitId');
  const method = query.get('method');
  const material = keyOf(query.get('material'));
  const place = query.get('place');
  const selectedPeriod = row => row.date >= from && row.date <= to;
  const scope = rows.filter(row => {
    const rowRegion = keyOf(row.region);
    return (!channel || row.channel === channel) &&
      (!area || area === keyOf(row.area) || area === keyOf(row.site)) &&
      (!region || region === rowRegion) && (!regions.length || regions.includes(rowRegion)) &&
      (!unit || (unitId && row.unitId ? unitId === row.unitId : unit === keyOf(row.unit)));
  });
  const filtered = scope.filter(row =>
    (!method || row.method === method) &&
    (!material || material === keyOf(row.material)) &&
    (!place || place === location(row).key));
  const current = filtered.filter(selectedPeriod);
  const periodRows = scope.filter(selectedPeriod);
  const allMonths = new Set(rows.map(monthOf));
  const byMonth = groupBy(filtered, monthOf);
  const currentMonths = groupBy(current, monthOf);
  const months = monthsBetween(from, to);
  const monthly = months.map(key => timelineBucket(key, currentMonths.get(key) || []));
  const daily = [...groupBy(current, row => row.date)].sort(([a],[b]) => a.localeCompare(b))
    .map(([key, members]) => timelineBucket(key, members));
  const comparisons = Object.fromEntries(monthly.map(bucket => {
    const prior = previousMonth(bucket.key);
    return [bucket.key, {
      current: allMonths.has(bucket.key) ? bucket : null,
      previous: allMonths.has(prior) ? timelineBucket(prior, byMonth.get(prior) || []) : null,
    }];
  }));
  const {attendance, online, offline} = timelineBucket('', current);
  const groups = [...groupBy(current, row => location(row).key).values()]
    .map(members => ({...location(members[0]), attendance: members.length}))
    .sort((a,b) => collator.compare(a.channel,b.channel) || collator.compare(a.label,b.label));

  const options = {
    methods: [...new Set(periodRows.map(row => row.method).filter(Boolean))].sort(collator.compare),
    materials: [...new Set(periodRows.map(row => row.material).filter(Boolean))].sort(collator.compare),
    places: [...new Map(periodRows.map(location).map(choice => [choice.key, choice])).values()]
      .sort((a,b) => collator.compare(a.channel,b.channel) || collator.compare(a.label,b.label)),
  };
  return {
    months: [...allMonths].sort(),
    options,
    totals: {attendance, participants: new Set(current.map(row => row.id)).size,
      sessions: new Set(current.map(row => JSON.stringify(row.session))).size, online, offline},
    dates: dates(current),
    periodDates: dates(periodRows),
    series: series.filter(item => item.key !== 'other' || monthly.some(bucket => bucket.bySeries.other)),
    timeline: {months: monthly, days: daily},
    comparisons,
    groups,
    details: details(current),
    evaluation: evaluation(current),
  };
}
