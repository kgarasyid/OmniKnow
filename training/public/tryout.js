const questions = [
  ['A customer describes an intermittent issue. What should you clarify first?', 'Promise a repair time', 'Ask when it occurs and which services are affected', 'Close the case'],
  ['What makes a handover actionable?', 'Symptoms, checks completed, findings and next owner', 'A ticket number alone', 'A copy of the greeting'],
  ['Two support notes give different instructions. What should you do?', 'Use the shortest note', 'Choose the older note', 'Check the current approved knowledge article'],
  ['A customer is upset about a recurring fault. What is the best opening?', 'Ask them to call tomorrow', 'Acknowledge the impact and confirm the issue', 'Transfer immediately without context'],
  ['Before closing a resolved case, what should you confirm?', 'The outcome with the customer and any follow-up', 'Only the call duration', 'Only the queue name']
];
const activity = 'service-readiness-v1';
const section = document.getElementById('practice');
const selector = document.getElementById('agentSelector');
const stateKey = () => activity + ':' + selector.value;
const empty = () => ({attemptId:crypto.randomUUID(), step:-1, answers:Array(5).fill(null)});
let state, busy = false;
function load() {
  try { state = JSON.parse(localStorage.getItem(stateKey())) || empty(); }
  catch { state = empty(); }
  render();
}
function persist() {
  try { localStorage.setItem(stateKey(), JSON.stringify(state)); }
  catch { document.getElementById('practice-message').textContent = 'Device storage unavailable. Keep this tab open to finish.'; }
}
function render(message='') {
  const step = state.step;
  let body;
  if (state.receipt) {
    const r = state.receipt;
    body = '<h2>Result · '+ Number(r.score) +'/100</h2><p>'+ (r.score>=80?'Passed':'Remedial') +' · Submitted to the OmniKnow results feed.</p><button data-action="restart">Practice again</button> <a href="https://omniknow.vercel.app/training-results.html">View team results ↗</a>';
  } else if (step < 0) {
    body = '<h2>Service readiness tryout</h2><p>5 questions · Pass at 80/100. Choose a demo agent above. Your draft stays on this device.</p><button data-action="next">Start tryout →</button>';
  } else if (step === questions.length) {
    body = '<h2>Review your answers</h2><ol>'+questions.map(([q,...choices],i)=>'<li><strong>'+q+'</strong><br>'+choices[state.answers[i]]+' <button class="edit" data-step="'+i+'">Edit</button></li>').join('')+'</ol><button data-action="submit">Submit answers</button>';
  } else {
    const [question,...choices]=questions[step];
    body = '<p>Question '+(step+1)+' of '+questions.length+'</p><fieldset><legend>'+question+'</legend>'+choices.map((choice,i)=>'<label><input type="radio" name="choice" value="'+i+'" '+(state.answers[step]===i?'checked':'')+'> '+choice+'</label>').join('')+'</fieldset><button class="back" data-action="back">Back</button> <button data-action="next" '+(state.answers[step]===null?'disabled':'')+'>'+(step===4?'Review answers':'Next question')+' →</button>';
  }
  section.innerHTML='<div class="practice-tag">Weekly tryout · Synthetic practice</div>'+body+'<p id="practice-message" role="status"></p>';
  document.getElementById('practice-message').textContent=message;
}
section.addEventListener('change', e=>{
  if(e.target.name==='choice') {
    state.answers[state.step]=Number(e.target.value);
    section.querySelector('[data-action="next"]').disabled=false;
    persist();
  }
});
section.addEventListener('click',async e=>{
  const b=e.target.closest('button');
  if(!b || busy) return;
  if(b.dataset.action==='submit') {
    busy=true; selector.disabled=true; b.disabled=true;
    document.getElementById('practice-message').textContent='Submitting answers…';
    try {
      const response=await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({activity,agentId:selector.value,attemptId:state.attemptId,answers:state.answers}),signal:AbortSignal.timeout(20000)});
      if(!response.ok) throw Error();
      const receipt=await response.json();
      if(receipt.attemptId!==state.attemptId || !Number.isFinite(receipt.score)) throw Error();
      state.receipt=receipt;
      try { localStorage.setItem('latest-practice:'+selector.value,JSON.stringify(receipt)); } catch {}
      render();persist();
      window.dispatchEvent(new Event('practice-result'));
    } catch { render('Submission unconfirmed. Retry with your saved answers.'); }
    finally {busy=false;selector.disabled=false;}
    return;
  }
  if(b.dataset.step!==undefined) state.step=Number(b.dataset.step);
  else if(b.dataset.action==='restart') state={...empty(),step:0};
  else state.step+=b.dataset.action==='back'?-1:1;
  render();persist();
  section.focus({preventScroll:true});
});
selector.addEventListener('change',load);
load();
