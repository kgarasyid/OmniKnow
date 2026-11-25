import { reportAreaFilter } from './report-area.mjs';

const channels = new Set(['GraPARI', 'Call Center', 'E-Care']);
const dimensions = ['attitude', 'skill', 'knowledge'];
const segments = new Set(['Walk In Mitra','Walk In TOMO','Call In','E-Care','GraPARI model belum tercatat']);
const nameOrders = new Set(['name-asc','name-desc','score-asc','score-desc']);
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
    for (const [id, placement] of Object.entries(placements[month])) latest.set(id, {id, placement, month});
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
  const dimension = dimensions.indexOf(query.get('dimension'));
  const level = query.get('level');
  const segment = query.get('segment');
  const sort = query.get('sort') ?? 'name-asc';
  const offsetValue = query.get('offset') ?? '0';
  const offset = Number(offsetValue);
  if (!isDay(from) || !isDay(to) || from > to || (channel && !channels.has(channel)) ||
      !['ranking', 'quadrant', 'dimension'].includes(view) ||
      (view !== 'ranking' && (!/^\d+$/.test(offsetValue) || !Number.isSafeInteger(offset) || !nameOrders.has(sort))) ||
      (view === 'quadrant' && !isQuadrant(quadrant)) ||
      (view === 'dimension' && (dimension<0 || !['high','low'].includes(level) || (segment && !segments.has(segment))))) return null;
  let locationRegions = [];
  if (view==='dimension' && query.has('locationRegions')) {
    try { locationRegions = JSON.parse(query.get('locationRegions')); } catch { return null; }
    if (!Array.isArray(locationRegions) || !locationRegions.every(item=>typeof item==='string')) return null;
  }
  const locationRegionSet = new Set(locationRegions.map(normalize));
  const locationArea = view==='dimension' ? normalize(query.get('locationArea')) : '';
  const startMonth = from.slice(0, 7);
  const endMonth = to.slice(0, 7);
  const monthNumber = value => Number(value.slice(0, 4)) * 12 + Number(value.slice(5));
  if (monthNumber(endMonth) - monthNumber(startMonth) >= 12) return null;

  const area = normalize(query.get('area'));
  const reportArea = reportAreaFilter(query);
  const region = normalize(query.get('region'));
  const unit = normalize(query.get('unit'));
  const unitId = query.get('unitId')?.trim();
  const geoRegions = new Set(query.getAll('geoRegion').map(normalize).filter(Boolean));
  const nameQuery = view !== 'ranking' ? normalize(query.get('q')) : '';
  const months = monthsInScope(data.placements, startMonth, endMonth);
  const rowsForMonths = selectedMonths => (view==='dimension'
    ? selectedMonths.flatMap(month=>Object.entries(data.placements[month]).map(([id,placement])=>({id,placement,month})))
    : latestPlacements(data.placements, selectedMonths)).flatMap(({
    id,month,
    placement:[rowSegment, label, [rowChannel, rowArea, rowRegion, rowUnitId, rowUnit], name, scores],
  }) => {
    if ((channel && channel !== rowChannel) || !reportArea.matches({channel:rowChannel,area:rowArea}) ||
        (area && area !== normalize(rowArea)) ||
        (region && region !== normalize(rowRegion)) || (geoRegions.size && !geoRegions.has(normalize(rowRegion))) ||
        (unitId ? unitId !== String(rowUnitId ?? '').trim() : unit && unit !== normalize(rowUnit)) ||
        (view === 'quadrant' && label !== quadrant) || (nameQuery && !normalize(name).includes(nameQuery)) ||
        !Array.isArray(scores) || scores.length !== 3 || !scores.every(score => Number.isFinite(score) && score >= 0 && score <= 100)) return [];
    if (view==='dimension' && ((segment && rowSegment!==segment) || (locationArea && locationArea!==normalize(rowArea)) ||
        (locationRegionSet.size && !locationRegionSet.has(normalize(rowRegion))) ||
        (scores[dimension]>=80)!==(level==='high'))) return [];
    const [attitude, skill, knowledge] = scores;
    // Preserve tied scores despite floating-point differences in the weighted sum.
    const score = Number(((attitude * 4 + skill * 3 + knowledge * 3) / 10).toFixed(12));
    const row = {name:String(name ?? '').trim() || '—', score, channel:rowChannel, area:rowArea, region:rowRegion, unit:rowUnit};
    if (view==='dimension') return [{...row,id,month,dimensionScore:scores[dimension]}];
    return [view === 'ranking' ? {...row,id,attitude,skill,knowledge} : row];
  });
  const rows = rowsForMonths(months);
  const byName = (a, b) => collator.compare(a.name, b.name) || collator.compare(a.channel, b.channel) ||
    collator.compare(a.area, b.area) || collator.compare(a.region, b.region) || collator.compare(a.unit, b.unit);
  if (view === 'ranking') {
    const requestedLimit = query.get('limit');
    const limit = requestedLimit === '5' ? 5 : requestedLimit === '10' ? 10 : !channel ? 10 : 5;
    let comparison;
    let previousRows = [];
    if (query.get('compare') === 'previous' && startMonth === endMonth) {
      const previousDate = new Date(startMonth + '-01T00:00:00Z');
      previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
      const month = previousDate.toISOString().slice(0, 7);
      previousRows = rowsForMonths(monthsInScope(data.placements, month, month));
      comparison = {month, available:previousRows.length > 0};
    }
    const ranking = (direction, current = rows, previous = previousRows, take = limit) => {
      const order = (a, b) => direction * (a.score - b.score) || byName(a, b) || collator.compare(a.id,b.id);
      const previousRanks = new Map(previous.toSorted(order).map(({id},index)=>[id,index+1]));
      return current.toSorted(order).slice(0, take).map(({id,...row}) => comparison
        ? {...row, previousRank:previousRanks.get(id) ?? null} : row);
    };
    const result = {total:rows.length, top:ranking(-1), ...(comparison ? {comparison} : {})};
    if (query.get('bottomBy') === 'location') {
      const locationFor = row => {
        if (row.channel==='GraPARI') return row.area || 'Area belum tercatat';
        const unit = normalize(row.unit).replace(/[^a-z0-9]/g,'');
        if (unit==='ccbandung') return 'CC Bandung';
        if (unit==='ccsemarang') return 'CC Semarang';
        if (unit==='ecarebandung') return 'E-Care Bandung';
        if (unit==='ecaresemarang') return 'E-Care Semarang';
        return row.unit || row.channel || 'Lokasi belum tercatat';
      };
      const preferred = ['Area 1','Area 2','Area 3','Area 4','CC Bandung','CC Semarang','E-Care Bandung','E-Care Semarang'];
      const locations = [...new Set(rows.map(locationFor))].toSorted((a,b)=>{
        const left = preferred.indexOf(a), right = preferred.indexOf(b);
        return (left<0?Number.MAX_SAFE_INTEGER:left)-(right<0?Number.MAX_SAFE_INTEGER:right) || collator.compare(a,b);
      });
      const bottomByLocation = locations.map(location=>{
        const current = rows.filter(row=>locationFor(row)===location);
        const previous = previousRows.filter(row=>locationFor(row)===location);
        return {location,total:current.length,rows:ranking(1,current,previous),
          ...(comparison ? {comparison:{...comparison,available:previous.length>0}} : {})};
      });
      return {...result,bottomByLocation};
    }
    if (query.get('bottomBy') !== 'area') return {...result,bottom:ranking(1)};
    const bottomByArea = [1,2,3,4].flatMap(number=>{
      const label = 'Area '+number;
      const matches = row=>row.channel==='GraPARI' && normalize(row.area)===normalize(label);
      const current = rows.filter(matches);
      if (!current.length) return [];
      const previous = previousRows.filter(matches);
      return [{area:label, total:current.length, rows:ranking(1,current,previous),
        ...(comparison ? {comparison:{...comparison,available:previous.length>0}} : {})}];
    });
    return {...result,bottomByArea};
  }
  const direction = sort.endsWith('-desc') ? -1 : 1;
  const byScore = sort.startsWith('score-');
  const sortRows = (a,b)=>{
    const scoreA = view==='dimension' ? a.dimensionScore : a.score;
    const scoreB = view==='dimension' ? b.dimensionScore : b.score;
    const order = byScore ? direction*(scoreA-scoreB) || byName(a,b) : direction*byName(a,b);
    return order || collator.compare(a.month ?? '',b.month ?? '') || collator.compare(a.id ?? '',b.id ?? '');
  };
  return {total:rows.length,offset,rows:rows.sort(sortRows).slice(offset,offset+pageSize).map(({id,...row})=>row)};
}
