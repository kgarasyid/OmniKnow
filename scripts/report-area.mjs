const areaKeys = ['area1','area2','area3','area4'];
const keyOf = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const channelKey = value => {
  const key = keyOf(value);
  return key === 'contactcenter' ? 'callcenter' : key;
};

export function reportAreaFilter(query) {
  const choices = query.getAll('reportArea');
  const unrestricted = choices.length === 0;
  const selected = new Set(choices.map(channelKey).filter(key =>
    areaKeys.includes(key) || key === 'callcenter' || key === 'ecare'));

  return {
    matches({channel,area}) {
      if (unrestricted) return true;
      const key = channelKey(channel);
      if (key !== 'grapari') return (key === 'callcenter' || key === 'ecare') && selected.has(key);
      const areaKey = keyOf(area);
      return areaKeys.includes(areaKey) && selected.has(areaKey);
    },
    includesChannel(channel) {
      if (unrestricted) return true;
      const key = channelKey(channel);
      return key === 'grapari' ? areaKeys.some(area => selected.has(area)) : selected.has(key);
    },
  };
}

export function reportLocationFilter(query, reportArea = reportAreaFilter(query)) {
  const channel = query.get('channel');
  const area = keyOf(query.get('area'));
  const region = keyOf(query.get('region'));
  const regions = query.getAll('geoRegion').map(keyOf).filter(Boolean);
  const unit = keyOf(query.get('unit'));
  const unitId = query.get('unitId');
  return row => {
    const rowRegion = keyOf(row.region);
    return (!channel || channel === row.channel) &&
      reportArea.matches(row) &&
      (!area || area === keyOf(row.area) || area === keyOf(row.site)) &&
      (!region || region === rowRegion) &&
      (!regions.length || regions.includes(rowRegion)) &&
      (!unit || (unitId && row.unitId ? unitId === row.unitId : unit === keyOf(row.unit)));
  };
}
