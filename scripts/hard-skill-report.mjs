import { reportAreaFilter, reportLocationFilter } from './report-area.mjs';

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

function participation(rows) {
  return {
    attendance: rows.length,
    participants: new Set(rows.map(row => row.id)).size,
    sessions: new Set(rows.map(row => JSON.stringify(row.session))).size,
  };
}

function methodBreakdown(rows) {
  return Object.fromEntries(['Offline', 'Online'].map(method => [
    method, participation(rows.filter(row => row.method === method)),
  ]));
}

function dates(rows) {
  if (!rows.length) return null;
  const values = rows.map(row => row.date).sort();
  return {from: values[0], to: values.at(-1)};
}

function trainingBreakdowns(rows) {
  const byLocation = members => [...groupBy(members, row => location(row).key).values()]
    .map(entries => ({...location(entries[0]), ...participation(entries)}))
    .sort((a,b) => collator.compare(a.label,b.label));
  const byMaterial = members => [...groupBy(members, row => row.material || 'Materi belum tercatat')]
    .map(([label,entries]) => ({
      label,...participation(entries),dates:dates(entries),
      channels:['GraPARI','Call Center','E-Care'].flatMap(ch => {
        const subset = entries.filter(row => row.channel === ch);
        return subset.length ? [{channel:ch,...participation(subset)}] : [];
      }),
    }))
    .sort((a,b) => b.attendance-a.attendance || collator.compare(a.label,b.label));
  const offline = rows.filter(row => row.channel === 'GraPARI' && row.method === 'Offline');
  const online = rows.filter(row => row.method === 'Online');
  const refreshmentPrograms = online.filter(row => ['badticket','acsibooster'].includes(keyOf(row.material)));
  const contact = online.filter(row => row.channel === 'Call Center' || row.channel === 'E-Care');
  const channelSummary = channels => {
    const members = contact.filter(row => channels.includes(row.channel) && keyOf(row.material) === 'badticket');
    return {...participation(members), locations:byLocation(members), dates:dates(members)};
  };
  const roles = [...groupBy(offline, row => row.function || 'Fungsi belum tercatat')]
    .map(([label,entries]) => ({label, participants:participation(entries).participants}))
    .sort((a,b) => b.participants-a.participants || collator.compare(a.label,b.label));
  return {
    bootcamp:{...participation(offline), locations:byLocation(offline), roles, materials:byMaterial(offline)},
    refreshment:{...participation(online), materials:byMaterial(online), programs:participation(refreshmentPrograms),
      contact:{...participation(contact), locations:byLocation(contact)}},
    contactCenter:channelSummary(['Call Center','E-Care']),
    callCenter:channelSummary(['Call Center']),
    eCare:channelSummary(['E-Care']),
  };
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

function badTicketReport(data, query, months, reportArea) {
  const rows = data.badTickets || [];
  const regionKey = value => {
    const key = keyOf(value);
    return {jawabarat:'jabar', jawatengah:'jatengdiy', jateng:'jatengdiy', jawatimur:'jatim',
      jakartadanbanten:'jakartabanten', eastjakarta:'easternjabotabek', easternjabodetabek:'easternjabotabek'}[key] || key;
  };
  const unitKey = value => keyOf(value).replace(/^(contactcenter|callcenter)/,'cc');
  const channel = query.get('channel');
  const area = keyOf(query.get('area'));
  const region = regionKey(query.get('region'));
  const regions = query.getAll('geoRegion').map(regionKey).filter(Boolean);
  const unit = unitKey(query.get('unit'));
  const regionGroup = key => ['centraljakarta','westjakarta'].includes(key) ? 'jakartabanten' : key;
  const mobileMonths = new Set(Object.keys(data.mobileTicketDates || {}));
  const prior = previousMonth(months[0]);
  const sum = members => members.reduce((total,row) => total + row.count, 0);
  const breakdown = (members, labelOf) => [...groupBy(members,labelOf)]
    .map(([label,entries]) => ({label,count:sum(entries)}))
    .sort((a,b) => b.count-a.count || collator.compare(a.label,b.label));
  const matchesLocation = row => {
    const key = regionKey(row.region);
    return reportArea.matches(row) &&
      (!area || [keyOf(row.area), keyOf(row.site), keyOf(row.site?.split(' · ')[0])].includes(area)) &&
      (!region || region === key || (region === 'jakartabanten' && region === regionGroup(key))) &&
      (!regions.length || regions.includes(regionGroup(key))) &&
      (!unit || unit === unitKey(row.unit));
  };
  const inPeriod = row => row.month >= months[0] && row.month <= months.at(-1);
  const monthCounts = (members, coverage) => months.map(month => ({month,
    count:coverage.has(month) ? sum(members.filter(row => row.month === month)) : null,
  }));
  const topAgents = (members, limit = 5, extras = () => ({})) => [...groupBy(members,row => row.agent)]
    .map(([agent,entries]) => ({
      label:entries.find(row => row.name)?.name || `SIAD ••••${agent.slice(-4)}`,
      count:sum(entries),
      location:[...new Set(entries.map(row => row.site || row.unit).filter(Boolean))].join(' · '),
      ...extras(entries),
    }))
    .sort((a,b) => b.count-a.count || collator.compare(a.label,b.label) || collator.compare(a.location,b.location))
    .slice(0,limit);

  const slides = data.badTicketSlides;
  const slideMonths = slides?.months || [];
  const intersectsSlides = slideMonths.some(month => months.includes(month));
  const locationRestricted = Boolean(area || region || regions.length || unit);
  const grapariAreas = ['Area 1','Area 2','Area 3','Area 4'];
  const regionLabel = row => {
    const key = regionKey(row.region);
    if (key===region && regionGroup(key)!==key) return row.region;
    return ({
      easternjabotabek:'Eastern Jabotabek', jakartabanten:'Jakarta Banten', jabar:'Jawa Barat',
      jatengdiy:'Jateng', jatim:'Jatim', balinusra:'BaliNusra', papuamaluku:'PapuaMaluku',
    })[regionGroup(key)] || row.region || 'Region belum tercatat';
  };
  const ticketServices = ['Fixed','Mobile'];
  const contactSiteLabels = ['Site 1 · Bandung','Site 2 · Semarang'];
  const siteLabel = row => row.site || 'Site belum tercatat';
  const serviceSummary = (members, coverage) => {
    const coveredMonths = months.filter(month => coverage.has(month));
    return {
      months:coveredMonths,
      count:coveredMonths.length ? sum(members.filter(inPeriod)) : null,
      prior:months.length === 1 && coverage.has(prior)
        ? sum(members.filter(row => row.month === prior)) : null,
    };
  };
  const sitePerformance = (all, scoped, agents) => {
    const sites = [...new Set(scoped.map(row => row.site).filter(Boolean))]
      .sort((a,b) => (contactSiteLabels.includes(b)-contactSiteLabels.includes(a)) || collator.compare(a,b));
    return ticketServices.map(name => {
      const local = all.filter(row => row.service === name);
      const coverage = new Set([...local.map(row => row.month), ...(name === 'Mobile' ? mobileMonths : [])]);
      const members = scoped.filter(row => row.service === name);
      const summary = serviceSummary(members,coverage);
      if (!agents) return {name,...summary};
      const current = members.filter(inPeriod);
      const serviceAgents = agents.filter(row=>row.service===name);
      const identifiable = new Set(serviceAgents.map(row=>row.agent)).size;
      return {
        name,...summary,
        agentCount:identifiable || (summary.count===0 ? 0 : null),
        agents:topAgents(serviceAgents,Math.max(1,serviceAgents.length),entries=>({
          site:entries.find(r=>r.site)?.site || '',
        })),
        symptoms:breakdown(current.filter(row=>row.symptom),row=>row.symptom).slice(0,5),
        source:'Workbook Bad Ticket '+name,
        sites:sites.map(label => {
          const entries = members.filter(row => siteLabel(row) === label);
          const key = ['bandung','semarang'][contactSiteLabels.indexOf(label)] || slugOf(label);
          return {key,label,...serviceSummary(entries,coverage),
            months:monthCounts(entries,coverage).filter(row => row.count !== null)};
        }),
      };
    });
  };
  const serviceReport = (service, all, agents, summaryOnly) => {
    const local = all.filter(row => row.service === service);
    const localMonths = new Set([...local.map(row => row.month), ...(service === 'Mobile' ? mobileMonths : [])]);
    const slide = slides?.[service.toLowerCase()];
    const referenceRegions = unit || regionGroup(region)!==region ? [] : slide?.regions || [];
    const referenceRows = referenceRegions.flatMap(([area,region,...counts]) =>
      slideMonths.flatMap((month,index) => localMonths.has(month) ? [] : [{
        channel:'GraPARI',area,region,month,count:counts[index],
      }]));
    const localRows = local.filter(row => inPeriod(row) && matchesLocation(row));
    const pptRows = referenceRows.filter(row => inPeriod(row) && matchesLocation(row));
    const current = [...localRows,...pptRows];
    const coverage = new Set([...localMonths,...referenceRows.map(row => row.month)]);
    const previous = months.length===1 && coverage.has(prior)
      ? [...local,...referenceRows].filter(row=>row.month===prior && matchesLocation(row)) : null;
    const summary = {service,count:sum(current),months:monthCounts(current,coverage),prior:previous ? sum(previous) : null};
    if (summaryOnly) return summary;
    const serviceAgents = agents.filter(row => row.service === service);
    const tables = (members, earlier, monthsCovered, labelOf, details=()=>({})) => {
      const groups = groupBy(members,labelOf);
      const previousGroups = earlier ? groupBy(earlier,labelOf) : null;
      const labels = new Set([...groups.keys(),...(previousGroups?.keys() || [])]);
      return [...labels].map(label=>{
        const rows = groups.get(label) || [];
        const before = previousGroups ? previousGroups.get(label) || [] : null;
        return {label,count:sum(rows),months:monthCounts(rows,monthsCovered),
          prior:before ? sum(before) : null,...details(rows,before)};
      }).sort((a,b)=>b.count-a.count || (b.prior||0)-(a.prior||0) || collator.compare(a.label,b.label));
    };
    const unitLabel = row => row.unit || row.site || 'Unit / Site belum tercatat';
    const showLocalPrior = previous!==null && localMonths.has(prior);
    const regionRows = tables(current,previous,coverage,regionLabel,(rows,before)=>({
      units:tables(rows.filter(row=>localMonths.has(row.month)),showLocalPrior ? before : null,localMonths,unitLabel,
        (tickets,earlier)=>({categories:tables(tickets,earlier,localMonths,row=>row.category || 'Kategori belum tercatat')})),
    }));
    const rankUnits = members => breakdown(members.filter(row => row.unit),row => row.unit).slice(0,10).map(row => {
      const units = members.filter(item => item.unit === row.label);
      return {...row, area:units[0].area, region:units[0].region,
        category:breakdown(units,row => row.category)[0]?.label};
    });
    const fullScope = !locationRestricted && grapariAreas.every(area => reportArea.matches({channel:'GraPARI',area}));
    const showReference = fullScope && intersectsSlides;
    const selectedAreas = locationRestricted ? new Set(current.map(row => row.area)) :
      new Set(grapariAreas.filter(area => reportArea.matches({channel:'GraPARI',area})));
    return {...summary,
      priorFromPpt:previous!==null && !localMonths.has(prior),
      localMonths:months.filter(month => localMonths.has(month)),
      pptMonths:months.filter(month => !localMonths.has(month) && referenceRows.some(row => row.month === month)),
      areas:tables(current,previous,coverage,row=>row.area || 'Area lain'), regions:regionRows,
      unitsByArea:grapariAreas.filter(area => selectedAreas.has(area))
        .map(area => ({area,rows:rankUnits(localRows.filter(row => row.area === area))})),
      unitCategories:rankUnits(localRows),
      suspects:topAgents(serviceAgents,10,entries => ({area:entries[0].area})),
      agents:topAgents(serviceAgents,Math.max(1,serviceAgents.length),entries => ({
        area:entries[0].area,
        region:entries[0].region,
      })),
      suspectCount:new Set(serviceAgents.map(row => row.agent)).size,
      symptoms:breakdown(localRows.filter(row => row.symptom),row => row.symptom).slice(0,10),
      reference:showReference ? slide : undefined,
    };
  };
  return ['GraPARI','Call Center','E-Care'].filter(name =>
    (!channel || channel === name) && reportArea.includesChannel(name)).map(name => {
    const all = rows.filter(row => row.channel === name);
    const covered = new Set([...all.map(row => row.month), ...mobileMonths]);
    const knownServices = month => {
      const services = new Set(all.filter(row => row.month === month).map(row => row.service).filter(Boolean));
      if (mobileMonths.has(month)) services.add('Mobile');
      return [...services].sort();
    };
    const workbookServices = [...new Set(months.flatMap(knownServices))];
    const previousAvailable = months.length === 1 && covered.has(prior);
    const priorScopeDiffers = previousAvailable && knownServices(prior).join() !== workbookServices.join();
    const scoped = all.filter(matchesLocation);
    const current = scoped.filter(inPeriod);
    const priorRows = previousAvailable && !priorScopeDiffers ? scoped.filter(row => row.month === prior) : null;
    const deepDive = channel === name;
    const agents = deepDive ? (data.badTicketAgents || []).filter(row =>
      row.channel === name && inPeriod(row) && matchesLocation(row)) : [];
    const postTraining = agents.filter(row => row.after);
    const categories = breakdown(current,row => row.category).slice(0,5);
    const callCenterSlides = slides?.callCenter;
    const contactServices = name === 'GraPARI' ? [] : sitePerformance(all,scoped,deepDive ? agents : null);
    const localServices = contactServices.filter(service => service.count != null);
    const siteDetails = () => {
      const workbookRows = current.filter(row => row.service === 'Fixed');
      const workbookAgents = postTraining.filter(row => row.service === 'Fixed');
      const workbookMonths = new Set(months.filter(month => knownServices(month).includes('Fixed')));
      const workbookCategories = breakdown(workbookRows,row => row.category).slice(0,5);
      const currentMonth = months.at(-1);
      const comparisonMonth = previousMonth(currentMonth);
      const comparisonAvailable = knownServices(comparisonMonth).includes('Fixed');
      const comparisonRows = scoped.filter(row => row.service === 'Fixed' && row.month === comparisonMonth);
      const comparisonAgents = (data.badTicketAgents || []).filter(row => row.channel === name &&
        row.service === 'Fixed' && row.month === comparisonMonth && row.after && matchesLocation(row));
      const monthMovement = (label,selected,earlier) => ({
        momCurrent:sum(selected.filter(row => row.month === currentMonth && row.category === label)),
        momPrior:comparisonAvailable ? sum(earlier.filter(row => row.category === label)) : null,
      });
      const tierSites = [...new Set(current.map(row => row.site).filter(Boolean))].sort(collator.compare);
      const siteTotals = tierSites.map(site=>
        [...groupBy(agents.filter(row=>siteLabel(row)===site),row=>row.agent).values()].map(sum));
      const byTier = (min,max) => siteTotals.map(counts=>
        counts.length ? counts.filter(count=>count>=min && count<=max).length : null);
      return {
        tableComparison:{current:currentMonth,previous:comparisonMonth},
        categoryMonths:workbookCategories.map(row=>({...row,
          months:monthCounts(workbookRows.filter(item=>item.category===row.label),workbookMonths),
          ...monthMovement(row.label,workbookRows,comparisonRows)})),
        afterTrainingAgents:topAgents(workbookAgents,5,entries=>({
          months:monthCounts(entries,workbookMonths),
          momCurrent:sum(entries.filter(row=>row.month===currentMonth)),
          momPrior:comparisonAvailable ? sum(comparisonAgents.filter(row=>row.agent===entries[0].agent)) : null,
        })),
        tierSites,
        tiers:siteTotals.some(counts=>counts.length) ? [
          ['Tier 3','11+','Prioritaskan review',...byTier(11,Infinity)],
          ['Tier 2','3–10','Review kasus berulang',...byTier(3,10)],
          ['Tier 1','1–2','Pantau temuan',...byTier(1,2)],
        ] : [],
      };
    };
    return {
      channel:name,
      count:sum(current),
      months:months.map(month => ({
        month, count:covered.has(month) ? sum(current.filter(row => row.month === month)) : null,
      })),
      prior:priorRows ? sum(priorRows) : null,
      priorScopeDiffers,
      workbookServices,
      locations:breakdown(current,row => row.site || row.area || 'Lokasi belum tercatat'),
      categories,
      ...(deepDive ? {
        symptoms:breakdown(current.filter(row => row.symptom),row => row.symptom).slice(0,5),
        regions:breakdown(current.filter(row => row.region),row => row.region),
        units:breakdown(current.filter(row => row.unit),row => row.unit).slice(0,10),
        agents:topAgents(postTraining.length ? postTraining : agents),
        agentsAfterTraining:postTraining.length > 0,
        agentCoverage:{
          withSiad:sum(agents),
          matched:sum(agents.filter(row => row.matched || row.after)),
          afterTraining:sum(postTraining),
        },
      } : {}),
      ...(!channel ? {
        categoryDetails:[...groupBy(current,row=>JSON.stringify([row.month,row.service,row.category]))]
          .map(([,entries])=>({month:entries[0].month,service:entries[0].service,
            category:entries[0].category || 'Kategori belum tercatat',count:sum(entries),
            prior:previousAvailable && knownServices(prior).includes(entries[0].service)
              ? sum(scoped.filter(row=>row.month===prior && row.service===entries[0].service && row.category===entries[0].category)) : null}))
          .sort((a,b)=>a.month.localeCompare(b.month) || collator.compare(a.service,b.service) ||
            b.count-a.count || collator.compare(a.category,b.category)),
        serviceTotals:name === 'GraPARI' ? ticketServices.map(service => {
          const {count,months,prior} = serviceReport(service,all,agents,true);
          const covered = months.filter(row => row.count !== null).map(row => row.month);
          return {name:service,count:covered.length ? count : null,months:covered,prior};
        }) : contactServices,
      } : name === 'GraPARI' ? {
        services:ticketServices.map(service => serviceReport(service,all,agents)),
      } : {
        performance:{months:months.filter(month => localServices.some(service => service.months.includes(month))),services:localServices},
      }),
      ...(deepDive && name !== 'GraPARI' ? siteDetails() : {}),
      ...(channel === 'Call Center' && name === channel && !locationRestricted && intersectsSlides ? {
        documentation:callCenterSlides?.documentation,
      } : {}),
    };
  });
}

function nationalPerformance(data, query, months, reportArea) {
  const source = data.hardSkillPerformance;
  const areas = ['Area 1','Area 2','Area 3','Area 4'];
  const hasLocalFilter = query.get('unit') || query.get('region') || query.getAll('geoRegion').some(Boolean);
  const selection = areas.map((label,index)=>({label,index})).filter(({label})=>
    !hasLocalFilter && reportArea.matches({channel:'GraPARI',area:label}) &&
    (!query.get('area') || keyOf(query.get('area'))===keyOf(label)));
  const prior = months.length===1 ? previousMonth(months[0]) : '';
  const series = (items, read) => items.map(item=>({
    label:item.label,
    values:months.map(month=>read(source?.[month],item) ?? null),
    prior:read(source?.[prior],item) ?? null,
  }));
  const areaRates = key => series(selection,(month,{index})=>month?.[key]?.[index]);
  const ticketMonths = [...months, ...(prior ? [prior] : [])];
  const grapari = (data.badTickets || []).filter(row => row.channel === 'GraPARI' && ticketMonths.includes(row.month));
  const ticketSeries = (service,key) => {
    const workbook = groupBy(grapari.filter(row => row.service === service),row => row.month);
    const sources = {workbook:[], reference:[]};
    const counts = new Map();
    for (const month of ticketMonths) {
      if (workbook.has(month) || (service === 'Mobile' && data.mobileTicketDates?.[month])) {
        const totals = [0,0,0,0,0];
        for (const row of workbook.get(month) || []) {
          const index = areas.findIndex(area => keyOf(area) === keyOf(row.area));
          totals[index < 0 ? areas.length : index] += row.count;
        }
        counts.set(month,totals);
        sources.workbook.push(month);
      } else if (source?.[month]?.[key]?.length === areas.length &&
        source[month][key].every(count => Number.isSafeInteger(count) && count >= 0)) {
        counts.set(month,source[month][key]);
        sources.reference.push(month);
      }
    }
    const showOther = selection.length === areas.length && !query.getAll('reportArea').length &&
      [...counts.values()].some(values => values[areas.length] > 0);
    const value = (month,index) => {
      const values = counts.get(month);
      if (!values) return null;
      const count = values[index] || 0;
      const total = values.reduce((sum,amount) => sum + amount,0);
      return {count,rate:total ? 100*count/total : null};
    };
    const selected = showOther ? [...selection,{label:'Area lain',index:areas.length}] : selection;
    return {sources,rows:selected.map(({label,index}) => ({
      label, values:months.map(month => value(month,index)), prior:value(prior,index),
    }))};
  };
  const fixed = ticketSeries('Fixed','badTicketFixed');
  const mobile = ticketSeries('Mobile','badTicketMobile');
  return {
    months,
    tnps:areaRates('tnps'),
    badTicketFixed:fixed.rows,
    badTicketMobile:mobile.rows,
    ticketSources:{Fixed:fixed.sources,Mobile:mobile.sources},
  };
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
  const reportArea = reportAreaFilter(query);
  const method = query.get('method');
  const material = keyOf(query.get('material'));
  const place = query.get('place');
  const selectedPeriod = row => row.date >= from && row.date <= to;
  const scope = rows.filter(reportLocationFilter(query, reportArea));
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
  const methods = methodBreakdown(current);
  const priorMonth = months.length === 1 ? previousMonth(months[0]) : null;
  const priorRows = byMonth.get(priorMonth) || [];
  const hasPriorMonth = allMonths.has(priorMonth);
  const groups = [...groupBy(current, row => location(row).key).values()]
    .map(members => ({...location(members[0]), attendance: members.length}))
    .sort((a,b) => collator.compare(a.channel,b.channel) || collator.compare(a.label,b.label));
  const mobileTicketThrough = months.map(month => data.mobileTicketDates?.[month]).filter(day => {
    if (!day) return false;
    const lastOfMonth = new Date(day + 'T00:00:00Z');
    lastOfMonth.setUTCMonth(lastOfMonth.getUTCMonth()+1,0);
    return day < lastOfMonth.toISOString().slice(0,10);
  }).at(-1) || null;

  const options = {
    methods: [...new Set(periodRows.map(row => row.method).filter(Boolean))].sort(collator.compare),
    materials: [...new Set(periodRows.map(row => row.material).filter(Boolean))].sort(collator.compare),
    places: [...new Map(periodRows.map(location).map(choice => [choice.key, choice])).values()]
      .sort((a,b) => collator.compare(a.channel,b.channel) || collator.compare(a.label,b.label)),
  };
  return {
    months: [...allMonths].sort(),
    options,
    totals: {...participation(current), online:methods.Online.attendance, offline:methods.Offline.attendance},
    methods,
    priorParticipation:hasPriorMonth ?
      {totals:participation(priorRows), methods:methodBreakdown(priorRows)} : null,
    dates: dates(current),
    periodDates: dates(periodRows),
    series: series.filter(item => item.key !== 'other' || monthly.some(bucket => bucket.bySeries.other)),
    timeline: {months: monthly, days: daily},
    comparisons,
    groups,
    trainingBreakdowns:trainingBreakdowns(current),
    priorTrainingBreakdowns:hasPriorMonth ? trainingBreakdowns(priorRows) : null,
    details: details(current),
    evaluation: evaluation(current),
    badTickets:badTicketReport(data, query, months, reportArea),
    mobileTicketThrough,
    ...(!query.get('channel') || query.get('channel') === 'GraPARI' ? {performanceAnalytics:nationalPerformance(data,query,months,reportArea)} : {}),
  };
}
