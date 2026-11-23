const HARD_SKILL_SERIES = {
 offlineBadTicket:'is-offline', onlineBadTicket:'is-online-bad', onlineAcsIBooster:'is-online-acs', other:'is-other',
};
const hardSkillSelection = {bucket:'',location:''};
const hardSkillResults = new Map();
let hardSkillLastQuery = '';
let hardSkillSessionsOpen = false;
let hardSkillEvaluationOpen = false;

const hardSkillNumber = new Intl.NumberFormat('id-ID');
const hardSkillScore = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
const hardSkillMonthShort = new Intl.DateTimeFormat('id-ID',{month:'short',timeZone:'UTC'});
const hardSkillDateFormat = new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});

const hardSkillDate = key=>new Date((key.length===7?key+'-01':key)+'T00:00:00Z');
const hardSkillMonthLabel = key=>dashboardTrialFormatMonth(key);
const hardSkillCount = (value,unit)=>`${hardSkillNumber.format(value)} ${unit}`;
const hardSkillShare = (value,total)=>`${hardSkillScore.format(total?100*value/total:0)}%`;

function hardSkillPeriod() {
 return [reportFrom.slice(0,7),reportTo.slice(0,7)];
}

function hardSkillDateCoverage(dates) {
 if (!dates) return '';
 const {from,to} = dates;
 const start = hardSkillDate(from);
 const end = hardSkillDate(to);
 if (from===to) return hardSkillDateFormat.format(end);
 return from.slice(0,7)===to.slice(0,7) ? `${start.getUTCDate()}–${hardSkillDateFormat.format(end)}` : hardSkillDateFormat.formatRange(start,end);
}

function resetHardSkillDrilldown() {
 Object.assign(hardSkillSelection,{bucket:'',location:''});
 hardSkillSessionsOpen = false;
}

function hardSkillKpis({attendance,participants,sessions,online,offline},period) {
 return `<div class="hard-skill-kpis">${[
  ['Kehadiran',attendance,`${hardSkillCount(online,'Online')} · ${hardSkillCount(offline,'Offline')}`],
  ['Peserta unik',participants,`${period} · CSR unik`],['Sesi',sessions,`${period} · Sesi pelatihan`],
 ].map(([label,value,note])=>`<article class="hard-skill-kpi"><h4>${label}</h4><strong>${hardSkillNumber.format(value)}</strong><small>${el(note)}</small></article>`).join('')}</div>`;
}

function hardSkillChart(report,daily,active) {
 const buckets = daily ? report.timeline.days : report.timeline.months;
 const maximum = Math.max(1,...buckets.map(bucket=>bucket.attendance));
 const magnitude = 10**Math.floor(Math.log10(maximum));
 const scale = Math.ceil(maximum/magnitude)*magnitude;
 const classes = key=>HARD_SKILL_SERIES[key] || 'is-other';
 const bucketLabel = key=>daily ? hardSkillDateFormat.format(hardSkillDate(key)) : hardSkillMonthLabel(key);
 const buttonLabel = key=>daily ? hardSkillDate(key).getUTCDate() : hardSkillMonthShort.format(hardSkillDate(key));
 return `<section class="hard-skill-panel"><header><h4>${daily?'Kehadiran per hari':'Kehadiran per bulan'}</h4>
  <p>${daily?'Pilih tanggal untuk melihat sesi.':'Pilih bulan untuk melihat perubahan dan rincian sesi.'}</p></header>
  <div class="hard-skill-legend" aria-label="Materi dan metode">${report.series.map(({key,label})=>`<span class="${classes(key)}">${el(label)}</span>`).join('')}</div>
  <div class="hard-skill-chart"><div class="hard-skill-chart-columns" style="--columns:${buckets.length}">${buckets.map(({key,attendance,bySeries})=>{
   const label = `${bucketLabel(key)}, ${hardSkillCount(attendance,'kehadiran')}`;
   const title = report.series.map(series=>`${series.label} ${hardSkillNumber.format(bySeries[series.key] || 0)}`).join(' · ');
   return `<button type="button" id="hard-skill-bucket-${key}" class="hard-skill-chart-column${key===active?' is-active':''}" data-hard-skill-bucket="${key}"
    aria-pressed="${hardSkillSelection.bucket===key}" aria-label="${el(label)}" title="${el(title)}">
    <strong class="hard-skill-chart-total">${hardSkillNumber.format(attendance)}</strong>
    <span class="hard-skill-chart-stack" aria-hidden="true">${report.series.map(({key})=>
     bySeries[key]?`<i class="${classes(key)}" style="--height:${100*bySeries[key]/scale}%"></i>`:'').join('')}</span>
    <span class="hard-skill-chart-label">${buttonLabel(key)}</span></button>`;
  }).join('')}</div></div>
  ${active?`<p class="hard-skill-selection">${el(bucketLabel(active))} · ${hardSkillCount(buckets.find(bucket=>bucket.key===active)?.attendance || 0,'kehadiran')}</p>`:''}
 </section>`;
}

function hardSkillInsights(report,daily,active) {
 let body;
 if (daily) {
  const {online,offline,attendance} = report.totals;
  const dominant = offline>online ? ['Offline',offline] : ['Online',online];
  const lead = [...report.groups].sort((a,b)=>b.attendance-a.attendance)[0];
  body = `<p>${online===offline ? `Online dan Offline masing-masing mencatat <strong>${hardSkillCount(online,'kehadiran')}</strong>.` :
   `<strong>${dominant[0]}</strong> paling banyak diikuti, dengan <strong>${hardSkillCount(dominant[1],'kehadiran')}</strong> (${hardSkillShare(dominant[1],attendance)}).`}</p>
   ${lead?`<p><strong>${el(lead.channel)} · ${el(lead.label)}</strong> mencatat kehadiran terbanyak, yaitu <strong>${hardSkillCount(lead.attendance,'kehadiran')}</strong> (${hardSkillShare(lead.attendance,attendance)}).</p>`:''}`;
 } else {
  const {current,previous} = report.comparisons[active] || {};
  if (!current || !previous) body = '<p>Pembanding bulan sebelumnya belum tersedia.</p>';
  else {
   const delta = current.attendance-previous.attendance;
   const movement = delta===0?'tetap':delta>0?'naik':'turun';
   const priorLabel = hardSkillMonthLabel(previous.key);
   const offlineTrend = current.offline*previous.attendance-previous.offline*current.attendance;
   const offlineMovement = offlineTrend>0?'naik':offlineTrend<0?'turun':'tetap';
   const offlineChange = current.attendance && previous.attendance
    ? `Porsi Offline ${offlineMovement==='tetap'?`tetap di <strong>${hardSkillShare(current.offline,current.attendance)}</strong>`:
     `${offlineMovement} dari <strong>${hardSkillShare(previous.offline,previous.attendance)}</strong> menjadi <strong>${hardSkillShare(current.offline,current.attendance)}</strong>`}.` : '';
   body = `<p>${el(hardSkillMonthLabel(current.key))} ${movement} ${delta===0?'':`<strong>${hardSkillCount(Math.abs(delta),'kehadiran')}</strong> `}dibanding ${el(priorLabel)}.</p>${offlineChange?`<p>${offlineChange}</p>`:''}
    <p>${el(priorLabel)} ${hardSkillNumber.format(previous.attendance)} → ${el(hardSkillMonthLabel(current.key))} ${hardSkillCount(current.attendance,'kehadiran')}.</p>`;
  }
 }
 return `<aside class="hard-skill-panel hard-skill-insight"><header><h4>${daily?'Sorotan Bulan Ini':'Apa yang Berubah?'}</h4></header>${body}</aside>`;
}

function hardSkillLocations(report) {
 const groups = Map.groupBy(report.groups,group=>group.channel);
 const maximum = Math.max(1,...report.groups.map(group=>group.attendance));
 return `<div class="hard-skill-area-groups">${[...groups].map(([channel,items])=>`<section class="hard-skill-panel">
  <header><h4>${el(channel)}${channel==='GraPARI'?' per Area':channel==='Contact Center'?' per Site':''}</h4><p>Pilih batang untuk melihat rincian sesi.</p></header>
  <div class="hard-skill-area-rows">${items.map(({key,label,attendance})=>`<button type="button" id="hard-skill-area-${el(key)}" class="hard-skill-area-row"
   data-hard-skill-location="${el(key)}" aria-pressed="${hardSkillSelection.location===key}"><span>${el(label)}</span>
   <span class="hard-skill-area-track" aria-hidden="true"><i style="--width:${100*attendance/maximum}%"></i></span><strong>${hardSkillCount(attendance,'kehadiran')}</strong>
  </button>`).join('')}</div></section>`).join('')}</div>`;
}

function hardSkillDetails(report,daily) {
 const {bucket,location} = hardSkillSelection;
 const rows = report.details.filter(row=>(!bucket || (daily?row.date:row.date.slice(0,7))===bucket) && (!location || row.place===location));
 const label = [bucket?(daily?hardSkillDateFormat.format(hardSkillDate(bucket)):hardSkillMonthLabel(bucket)):'',report.groups.find(group=>group.key===location)?.label].filter(Boolean).join(' · ');
 const count = rows.reduce((total,row)=>total+row.attendance,0);
 const columns = [
  ['Tanggal',row=>hardSkillDateFormat.format(hardSkillDate(row.date))],['Batch',row=>row.batch],['Materi',row=>row.title || row.material],
  ['Metode',row=>row.method],['Fungsi kerja',row=>row.function],['Area/Site',row=>row.placeLabel],
  ...(rows.some(row=>row.region)?[['Regional',row=>row.region]]:[]),...(rows.some(row=>row.unit)?[['Unit',row=>row.unit]]:[]),
  ['Kehadiran',row=>hardSkillNumber.format(row.attendance)],
 ];
 return `<details class="hard-skill-evaluation" data-hard-skill-details${hardSkillSessionsOpen?' open':''}>
  <summary id="hard-skill-detail-summary">Rincian sesi · ${label?`${el(label)} · `:''}${hardSkillCount(count,'kehadiran')}</summary>
  ${rows.length?`<div class="hard-skill-table-wrap" tabindex="0" role="region" aria-label="Tabel rincian sesi"><table class="hard-skill-table">
   <thead><tr>${columns.map(([name])=>`<th scope="col">${name}</th>`).join('')}</tr></thead>
   <tbody>${rows.map(row=>`<tr>${columns.map(([,read])=>`<td>${el(read(row) || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:
   '<p class="hard-skill-empty">Data sesi belum tersedia untuk pilihan ini.</p>'}</details>`;
}

function hardSkillEvaluation({pairs,pre,post,surveySubmitted,surveyRecorded},period) {
 return `<details class="hard-skill-evaluation" data-hard-skill-eval${hardSkillEvaluationOpen?' open':''}>
  <summary id="hard-skill-eval-summary">Rincian evaluasi · ${el(period)}</summary>
  ${pairs?`<p><strong>${hardSkillScore.format(pre)} → ${hardSkillScore.format(post)} /100</strong> · ${hardSkillCount(pairs,'pasangan tes')} dari peserta dan sesi yang sama.</p>`:
   '<p>Data pasangan pre-test dan post-test belum tersedia untuk filter ini.</p>'}
  ${surveyRecorded?`<p>Survei · ${hardSkillCount(surveySubmitted,'pengisian tercatat')} pada rekap kehadiran.</p>`:'<p>Data pengisian survei belum tersedia untuk filter ini.</p>'}
 </details>`;
}

function dashboardHardSkillBody() {
 const [start,end] = hardSkillPeriod();
 const daily = start===end;
 const period = dashboardTrialPeriodLabel();
 const result = hardSkillResults.get(localLearningQuery());
 const report = result?.report;
 const coverage = hardSkillDateCoverage(report?.dates || report?.periodDates);
 const scope = [ctp==='All CTPs'?'':dashboardChannelLabel(),dashboardLocationLabel(),period].filter(Boolean).join(' · ');
 const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M7 16v-3m5 3V9m5 7V5M5 5l3 3 4-4"/></svg>';
 const header = `<header class="hard-skill-hero"><div><h3>Jangkauan pelatihan Hard Skill</h3><p>${el(scope)}</p>${coverage?`<small>Data ${el(coverage)}</small>`:''}</div><span class="hard-skill-icon" aria-hidden="true">${icon}</span></header>`;
 let body;
 if (!report?.totals.attendance) {
  const message = result?.status==='error'?'Rekap Hard Skill belum dapat dimuat.':!report?'Memuat rekap Hard Skill…':
   dashboardTrialWindow==='current'&&!report.periodDates?'Data bulan ini belum tersedia':'Data Hard Skill belum tersedia untuk filter ini.';
  body = `<p class="hard-skill-empty" role="status">${message}</p>`;
 } else {
  const active = hardSkillSelection.bucket || (daily?'':report.timeline.months.findLast(bucket=>bucket.attendance>0)?.key);
  body = hardSkillKpis(report.totals,period)+`<div class="hard-skill-grid">${hardSkillChart(report,daily,active)}${hardSkillInsights(report,daily,active)}</div>`+
   hardSkillLocations(report)+hardSkillDetails(report,daily)+hardSkillEvaluation(report.evaluation,period)+
   '<p class="hard-skill-note"><strong>Tindak lanjut.</strong> Cek jadwal refreshment Online berikutnya dan bandingkan jangkauan tiap Area atau Site dengan target saat target tersedia.</p>';
 }
 return `<div class="hard-skill-report">${header}${body}</div>`;
}

function dashboardHardSkillSection(scope) {
 return dashboardLearningDisclosure('hard','Distribusi Hard Skill',scope,'<div data-hard-skill-mount></div>');
}

function bindDashboardHardSkill() {
 const panel = document.querySelector('details[data-learning-disclosure="hard"]');
 const mount = panel?.querySelector('[data-hard-skill-mount]');
 if (!mount) return;
 const redraw = (focusId='')=>{
  const scroll = mount.querySelector('.hard-skill-chart')?.scrollLeft || 0;
  mount.innerHTML = dashboardHardSkillBody();
  const chart = mount.querySelector('.hard-skill-chart');
  if (chart) chart.scrollLeft = scroll;
  if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
 };
 const load = async ()=>{
  if (!panel.open) return;
  const query = localLearningQuery();
  if (query!==hardSkillLastQuery) {
   hardSkillLastQuery = query;
   resetHardSkillDrilldown();
  }
  const stored = hardSkillResults.get(query);
  let pending = stored?.pending;
  if (!pending && !stored?.report) {
   pending = fetch('/api/local-hard-skill?'+query).then(async response=>{
    if (!response.ok) throw Error('Hard Skill report unavailable');
    hardSkillResults.set(query,{report:await response.json()});
   }).catch(()=>hardSkillResults.set(query,{status:'error'}));
   hardSkillResults.set(query,{pending});
  }
  redraw();
  if (pending) {
   await pending;
   if (panel.isConnected && panel.open && localLearningQuery()===query) {
    redraw(mount.contains(document.activeElement)?document.activeElement.id:'');
   }
  }
 };
 panel.addEventListener('toggle',()=>{if(panel.isConnected) load();});
 mount.addEventListener('toggle',event=>{
  if (event.target.matches('[data-hard-skill-details]')) hardSkillSessionsOpen = event.target.open;
  if (event.target.matches('[data-hard-skill-eval]')) hardSkillEvaluationOpen = event.target.open;
 },true);
 mount.addEventListener('click',event=>{
  const button = event.target.closest('[data-hard-skill-bucket],[data-hard-skill-location]');
  if (!button) return;
  const field = button.dataset.hardSkillBucket?'bucket':'location';
  const selected = button.dataset.hardSkillBucket || button.dataset.hardSkillLocation;
  hardSkillSelection[field] = hardSkillSelection[field]===selected?'':selected;
  hardSkillSessionsOpen = true;
  redraw(button.id);
 });
 load();
}
