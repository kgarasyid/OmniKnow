import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/initializePeriodFeatures\(\);/,'').replace(/render\(\);\s*$/,'');
const context=vm.createContext({structuredClone,Blob,console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout});
vm.runInContext(await readFile(new URL('../survey-monitor.js',import.meta.url),'utf8'),context);
vm.runInContext(await readFile(new URL('../dashboard-insights.js',import.meta.url),'utf8'),context);
vm.runInContext(await readFile(new URL('../dashboard-workspace.js',import.meta.url),'utf8'),context);
vm.runInContext(script,context);
// Original 48-agent regression fixture; E-Care addition has its own assertions.
vm.runInContext("state.agents=state.agents.filter(a=>a.ctp!=='E-Care')",context);
const run=code=>JSON.parse(JSON.stringify(vm.runInContext(code,context)));
assert.equal(run('assessmentRows().length'),48);
assert.deepEqual(run('scoreDistribution(assessmentRows(),"pre").map(b=>b.count)'),[13,20,15,0]);
assert.deepEqual(run('scoreDistribution(assessmentRows(),"post").map(b=>b.count)'),[0,10,21,17]);
const results=[];
for(const channel of ['GraPARI','Contact Center']){
  vm.runInContext(`ctp=${JSON.stringify(channel)};ctpScope='All locations'`,context);
  const full=run('assessmentRows().map(a=>a.id)');
  assert.equal(full.length,24);
  const locations=channel==='GraPARI'?['Area 1','Area 2','Area 3','Area 4']:['Site 1','Site 2'];
  const ids=[];
  for(const location of locations){
    vm.runInContext(`ctpScope=${JSON.stringify(location)}`,context);
    const rows=run('assessmentRows()');
    assert.ok(rows.length>0);
    assert.ok(rows.every(a=>a.ctp===channel));
    assert.ok(run('assessmentRows().every(a=>agentLocation(a)===ctpScope)'));
    for(const key of ['pre','post'])assert.equal(run(`scoreDistribution(assessmentRows(), '${key}').reduce((n,b)=>n+b.count,0)`),rows.length);
    for(const mode of ['Area','Region']){
      const grouped=run(`assessmentGroups(assessmentRows(), '${mode}')`);
      assert.equal(grouped.reduce((n,g)=>n+g.rows.length,0),rows.length);
      assert.equal(new Set(grouped.flatMap(g=>g.rows.map(a=>a.id))).size,rows.length);
      for(const key of ['pre','post']){
        vm.runInContext(`assessmentView.${key}='${mode}'`,context);
        const output=run(`assessmentGrouped(assessmentRows(),'${key}')`);
        assert.ok(!/NaN|Infinity/.test(output));
        assert.ok(output.includes('data-chart-tip'));
        const detail=run(`assessmentDetail('${key}')`);
        for(const row of rows)assert.ok(detail.includes(row.id));
      }
    }
    vm.runInContext("assessmentView={pre:'Nat',post:'Nat'}",context);
    const charts=run('assessmentDistributions(filtered())');
    assert.ok(!/NaN|Infinity/.test(charts));
    assert.ok(charts.includes(`data-total="${rows.length}"`));
    const evaluation=run('prePostEvaluation()');
    for(const row of rows)assert.ok(evaluation.includes(row.name));
    ids.push(...rows.map(a=>a.id));results.push({channel,location,agents:rows.length});
  }
  assert.equal(new Set(ids).size,full.length);assert.deepEqual(ids.sort(),full.sort());
}
assert.deepEqual(run('scoreDistribution([0,54.99,55,69.99,70,84.99,85,100].map(pre=>({pre})),"pre").map(b=>b.count)'),[2,2,2,2]);
assert.equal(run('assessmentRows([{pre:null,post:80},{pre:"",post:80},{pre:50,post:101},{pre:-1,post:50},{pre:50,post:undefined},{pre:"55",post:"85"}]).length'),1);
vm.runInContext("ctp='All CTPs';ctpScope='All locations';q='not-an-agent'",context);
assert.equal(run('assessmentRows().length'),0);assert.ok(run('assessmentDistributions(filtered()).includes("No assessment data")'));
assert.ok(!/NaN|Infinity/.test(run('assessmentDistributions(filtered())')));
vm.runInContext("q='';state.agents[0].pre=90;state.agents[0].post=100",context);
assert.deepEqual(run('scoreDistribution(assessmentRows(),"pre").map(b=>b.count)'),[12,20,15,1]);
assert.deepEqual(run('scoreDistribution(assessmentRows(),"post").map(b=>b.count)'),[0,9,21,18]);
vm.runInContext("state.activities[0].attendeeIds=['SYN-0001'];category=state.activities[0].category",context);
assert.equal(run('assessmentRows().length'),1);
assert.equal(run('agentLocation({id:"IMPORTED-1",ctp:"Contact Center"})'),'Unassigned');
assert.equal(run('agentLocation({id:"IMPORTED-1",ctp:"Contact Center",site:"Site 2"})'),'Site 2');
console.log('PASS: 48 records; six disjoint Area/Site cohorts; pie totals; paired score validation; boundaries; empty state; changed scores; activity filters; imported assignments.');
console.table(results);
