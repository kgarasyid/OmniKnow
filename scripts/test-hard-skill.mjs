import assert from 'node:assert/strict';
import { hardSkillReport } from './hard-skill-report.mjs';

function row(id, date, method, material, batch, extra = {}) {
  return {
    id, date, method, material, batch,
    title: material + ' Fiktif',
    channel: 'GraPARI',
    area: 'Area 1',
    site: '',
    region: 'Region Fiktif',
    unit: 'Unit Fiktif',
    function: 'CSR',
    session: [date, material, method, batch],
    ...extra,
  };
}

const data = {hardSkill: [
  row('NIK-FIKTIF-A', '2026-09-10', 'Offline', 'Bad Ticket', 'A'),
  row('NIK-FIKTIF-B', '2026-09-11', 'Online', 'Bad Ticket', 'B'),
  row('NIK-FIKTIF-A', '2026-10-01', 'Online', 'Bad Ticket', 'A', {
    channel: 'Call Center', area: '', site: 'Site 2', pre: 60, post: 80, surveySubmitted: true,
  }),
  row('NIK-FIKTIF-B', '2026-10-01', 'Online', 'Bad Ticket', 'A', {
    channel: 'E-Care', area: '', site: 'Site 2', pre: 80, post: 90, surveySubmitted: false,
  }),
  row('NIK-FIKTIF-A', '2026-10-03', 'Online', 'ACS iBooster', 'C', {
    area: 'Area 2', pre: 55, surveySubmitted: false,
  }),
]};

const query = filters => hardSkillReport(data, new URLSearchParams({
  from: '2026-09-01', to: '2026-10-31', ...filters,
}));

const report = query();
assert.deepEqual(report.totals, {attendance: 5, participants: 2, sessions: 4, online: 4, offline: 1});
assert.deepEqual(report.timeline.months.map(({attendance}) => attendance), [2,3]);
assert.deepEqual(report.timeline.months[1].bySeries, {offlineBadTicket: 0, onlineBadTicket: 2, onlineAcsIBooster: 1, other: 0});
assert.equal(report.comparisons['2026-10'].previous.attendance, 2);
assert.equal(report.comparisons['2026-09'].previous, null);
assert.deepEqual(report.dates, {from: '2026-09-10', to: '2026-10-03'});
assert.deepEqual(report.evaluation, {pairs: 2, pre: 70, post: 85, surveySubmitted: 1, surveyRecorded: true});
assert.equal(report.details.reduce((sum, row) => sum + row.attendance, 0), report.totals.attendance);
assert.doesNotMatch(JSON.stringify(report), /NIK-FIKTIF/);

const site = query({place:'cc:site-2'});
assert.deepEqual(site.totals, {attendance: 2, participants: 2, sessions: 1, online: 2, offline: 0});
assert.deepEqual(site.groups, [{key:'cc:site-2', label:'Site 2', channel:'Contact Center', attendance:2}]);
assert.deepEqual(site.details.map(({channel})=>channel), ['Call Center','E-Care']);
assert.equal(site.comparisons['2026-10'].previous.attendance, 0);
assert.equal(query({place:'cc:site-2', channel:'E-Care'}).totals.attendance, 1);
assert.equal(query({method:'Online', material:'ACS iBooster', area:'AREA-2', region:'region fiktif'}).totals.attendance, 1);
assert.equal(query({unit:'unit fiktif', unitId:'CROSS-SOURCE-ID'}).totals.attendance, 5);

const missingMonth = query({from:'2026-11-01', to:'2026-11-30'});
assert.deepEqual(missingMonth.timeline.days, []);
assert.equal(missingMonth.comparisons['2026-11'].current, null);
assert.equal(missingMonth.totals.attendance, 0);
assert.equal(query({from:'2026-02-30'}), null);
console.log('PASS: Hard Skill counts, monthly comparison, filters, paired evaluation, and aggregate-only drilldown.');
