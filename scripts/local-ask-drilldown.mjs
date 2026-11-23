const channels = new Set(['GraPARI', 'Call Center', 'E-Care']);
const pageSize = 20;
const collator = new Intl.Collator('id', {numeric:true, sensitivity:'base'});
const isMonth = value => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value ?? '');
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const isQuadrant = value => /^(?:(?:HAHAKO|HALOKO|LOHAKO|LOLOKO) \((?:HA|LA)\)|BELUM TERSEDIA)$/.test(value ?? '');
const normalize = value => String(value ?? '').trim().toLowerCase();

function monthsInScope(placements, from, to) {
  return Object.keys(placements).filter(month => month >= from && month <= to).sort();
}

function latestPlacements(placements, months) {
  const latest = new Map();
  for (const month of months) {
    for (const [id, placement] of Object.entries(placements[month])) latest.set(id, {placement, month});
  }
  return Array.from(latest.values());
}

export function askUnitDetails(data, query) {
  const from = query.get('from');
  const to = query.get('to');
  const quadrant = query.get('quadrant');
  const segment = query.get('segment');
  let location;
  try { location = JSON.parse(query.get('unit')); } catch { return null; }
  if (!Array.isArray(location) || location.length !== 5 || !location.every(field => typeof field === 'string') ||
      !isMonth(from) || !isMonth(to) || from > to || !isQuadrant(quadrant)) return null;
  const key = JSON.stringify(location);
  const months = monthsInScope(data.placements, from, to);
  if (!months.some(month => Object.hasOwn(data.summary[month].locations, key))) return null;
  return latestPlacements(data.placements, months).filter(({placement:[group, label, assigned]}) =>
    label === quadrant && JSON.stringify(assigned) === key && (!segment || segment === group))
    .map(({placement:[group, , , name, scores], month}) => ({name, scores, segment:group, month}))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

export function localAskDrilldown(data, query) {
  const from = query.get('from');
  const to = query.get('to');
  const view = query.get('view');
  const channel = query.get('channel');
  const quadrant = query.get('quadrant');
  const offsetValue = query.get('offset') ?? '0';
  const offset = Number(offsetValue);
  if (!isDay(from) || !isDay(to) || from > to || (channel && !channels.has(channel)) ||
      !['ranking', 'quadrant'].includes(view) ||
      (view === 'quadrant' && (!isQuadrant(quadrant) || !/^\d+$/.test(offsetValue) || !Number.isSafeInteger(offset)))) return null;
  const startMonth = from.slice(0, 7);
  const endMonth = to.slice(0, 7);
  const monthNumber = value => Number(value.slice(0, 4)) * 12 + Number(value.slice(5));
  if (monthNumber(endMonth) - monthNumber(startMonth) >= 12) return null;

  const area = normalize(query.get('area'));
  const region = normalize(query.get('region'));
  const unit = normalize(query.get('unit'));
  const unitId = query.get('unitId')?.trim();
  const geoRegions = new Set(query.getAll('geoRegion').map(normalize).filter(Boolean));
  const nameQuery = view === 'quadrant' ? normalize(query.get('q')) : '';
  const months = monthsInScope(data.placements, startMonth, endMonth);
  const rows = latestPlacements(data.placements, months).flatMap(({
    placement:[, label, [rowChannel, rowArea, rowRegion, rowUnitId, rowUnit], name, scores],
  }) => {
    if ((channel && channel !== rowChannel) || (area && area !== normalize(rowArea)) ||
        (region && region !== normalize(rowRegion)) || (geoRegions.size && !geoRegions.has(normalize(rowRegion))) ||
        (unitId ? unitId !== String(rowUnitId ?? '').trim() : unit && unit !== normalize(rowUnit)) ||
        (view === 'quadrant' && label !== quadrant) || (nameQuery && !normalize(name).includes(nameQuery)) ||
        !Array.isArray(scores) || scores.length !== 3 || !scores.every(score => Number.isFinite(score) && score >= 0 && score <= 100)) return [];
    const [attitude, skill, knowledge] = scores;
    // Preserve tied scores despite floating-point differences in the weighted sum.
    const score = Number(((attitude * 4 + skill * 3 + knowledge * 3) / 10).toFixed(12));
    return [{name:String(name ?? '').trim() || '—', score, channel:rowChannel, area:rowArea, region:rowRegion, unit:rowUnit}];
  });
  const byName = (a, b) => collator.compare(a.name, b.name) || collator.compare(a.channel, b.channel) ||
    collator.compare(a.area, b.area) || collator.compare(a.region, b.region) || collator.compare(a.unit, b.unit);
  if (view === 'ranking') {
    const top = rows.toSorted((a, b) => b.score - a.score || byName(a, b)).slice(0, 5);
    const bottom = rows.toSorted((a, b) => a.score - b.score || byName(a, b)).slice(0, 5);
    return {total:rows.length, top, bottom};
  }
  return {total:rows.length, offset, rows:rows.sort(byName).slice(offset, offset + pageSize)};
}
