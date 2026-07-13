
const screens=window.MMS_SCREENS;
const roles=['MMS Administrator','Facility User','Hospital/Social Worker','Community Agency','Client/Representative'];
const adminPattern=/audit|permission|configuration|policy|user administration|official dss|decision registry/i;
const bulkPattern=/bulk|import/i;
const agencyPattern=/agency assigned|agency response|community referral|resource/i;
const familyPattern=/family|client upload|my checklist|representative|appointment/i;
const role=document.getElementById('role'),nav=document.getElementById('nav'),search=document.getElementById('search'),content=document.getElementById('content');
const STORE_KEY='mms-connect-functional-demo-v1';
const seedState={records:[
  {id:'MMS-1001',client:'Martha Green',program:'Long-Term Care Medicaid',date:'2026-07-12',status:'Pending review',notes:'Fictional prototype content only.',owner:'Lakisha Brown',due:'Jul 16, 2026',action:'Request bank records'},
  {id:'MMS-1002',client:'James Carter',program:'Special Assistance',date:'2026-07-10',status:'Denied',notes:'Demo denial record.',owner:'Review queue',due:'Today',action:'Review appeal options'},
  {id:'MMS-1003',client:'Dorothy Hall',program:'SAIH',date:'2026-07-09',status:'Agency declined',notes:'Demo community referral.',owner:'Community team',due:'Jul 14, 2026',action:'Rematch resource'}
],activeId:'MMS-1001',activity:[],documentRequests:[],tasks:[]};
function clone(v){return JSON.parse(JSON.stringify(v))}
function loadState(){try{return Object.assign(clone(seedState),JSON.parse(localStorage.getItem(STORE_KEY)||'{}'))}catch(e){return clone(seedState)}}
let demo=loadState();let currentScreen=null;const activeCase=document.getElementById('activeCase');
const walkthrough=document.getElementById('walkthrough');let walkthroughIndex=-1;
const facilityWalkthrough=[
  {id:'UX-014',title:'Facility dashboard',why:'Begin with the facility work queue, referral activity, and cases needing attention.'},
  {id:'UX-136',title:'Download the facility template',why:'Show how a facility starts a multi-resident referral batch without entering each resident separately.'},
  {id:'UX-137',title:'Upload referrals',why:'Upload the completed fictional Excel template into the sandbox.'},
  {id:'UX-138',title:'Validate records',why:'Review ready rows, missing fields, invalid dates, and possible existing cases.'},
  {id:'UX-140',title:'Resolve duplicates',why:'Match residents to existing fictional MMS clients and avoid duplicate cases.'},
  {id:'UX-141',title:'Confirm authorization',why:'Confirm authority before creating referrals or requesting protected information.'},
  {id:'UX-024',title:'Create the referral',why:'Create or update the shared client and case record used throughout the walkthrough.'},
  {id:'UX-051',title:'Complete program-specific intake',why:'Capture fictional eligibility facts that determine the program and document requirements.'},
  {id:'UX-054',title:'Generate the personalized checklist',why:'Show how program and client circumstances produce a tailored document list.'},
  {id:'UX-064',title:'Collect and review documents',why:'Demonstrate missing, received, under-review, clarification, and accepted statuses.'},
  {id:'UX-117',title:'Review application readiness',why:'Confirm required information before recording submission to DSS.'},
  {id:'UX-143',title:'Track DSS timeliness',why:'Follow checkpoints, applicable standards, days remaining, and delay attribution.'},
  {id:'UX-126',title:'Record the DSS decision',why:'Enter the official approval, denial, pending, withdrawn, or closed determination.'},
  {id:'UX-129',title:'Assign appeal or reapplication',why:'Show the follow-up workflow when a denial requires further action.'},
  {id:'UX-132',title:'Measure the final outcome',why:'Close the loop with placement, service, appeal, reapplication, and follow-up results.'}
];
if(!demo.activeId||!demo.records.some(r=>r.id===demo.activeId))demo.activeId=demo.records[0]?.id||null;
function activeRecord(){return demo.records.find(r=>r.id===demo.activeId)||demo.records[0]||null}
function refreshCaseSelector(){activeCase.innerHTML=demo.records.map(r=>`<option value="${esc(r.id)}" ${r.id===demo.activeId?'selected':''}>${esc(r.client)} · ${esc(r.id)}</option>`).join('')}
function persist(){localStorage.setItem(STORE_KEY,JSON.stringify(demo))}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function notify(message){const t=document.getElementById('toast');t.textContent=message;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),2800)}
roles.forEach(r=>role.add(new Option(r,r)));

function allowed(screen){
  const n=screen.name;
  if(role.value==='MMS Administrator') return true;
  if(adminPattern.test(n)) return false;
  if(bulkPattern.test(n)) return role.value==='Facility User';
  if(role.value==='Community Agency') return agencyPattern.test(n)||/message|task|notification|profile/i.test(n);
  if(role.value==='Client/Representative') return familyPattern.test(n)||/document|message|resource|referral status|home/i.test(n);
  return true;
}
function primaryAction(cat){return ({dashboard:'View work queue',list:'Create record',form:'Save draft',document:'Request document',referral:'Create referral',decision:'Record official action',admin:'Review configuration',detail:'Update record',auth:'Continue'})[cat]||'Continue'}
function metrics(cat){
  const map={
    dashboard:[['Open cases','27','8 need documents'],['Near deadline','6','Within 10 days'],['Approval rate','69%','29 of 42 submitted'],['Closed-loop success','74%','Service confirmed']],
    referral:[['Open referrals','18','5 new this week'],['Acknowledged','12','67%'],['Accepted','9','50%'],['Outcome confirmed','7','39%']],
    decision:[['Pending decisions','5','Awaiting DSS'],['Approved','29','Official decisions'],['Denied','8','Reasons categorized'],['Avg. days','38','Across programs']],
    admin:[['Active users','42','5 roles'],['Organizations','14','6 counties'],['Denied events','12','Last 30 days'],['Config versions','18','All auditable']],
    document:[['Required','21','Program-specific'],['Received','18','3 outstanding'],['Under review','4','Human review'],['Accepted','14','Exact versions']]
  };
  return map[cat]||map.dashboard;
}
function renderMetrics(cat){return `<div class="grid">${metrics(cat).map(m=>`<article class="card"><div class="metric-label">${m[0]}</div><div class="metric-value">${m[1]}</div><div class="metric-help">${m[2]}</div></article>`).join('')}</div>`}
function renderTable(cat){
  let heads=['Record','Status','Owner','Due date','Next action'];
  let rows=demo.records.map(r=>[r.client,r.status,r.owner||role.value,r.due||r.date,r.action||'Open record']);
  if(cat==='admin'){heads=['Event','Actor','Scope','Result','Time'];rows=[['Access denied','Agency user','Unrelated client route','Denied','10:14 AM'],['Document disclosure','MMS specialist','Exact version grant','Allowed','9:52 AM'],['Role context switch','Administrator','Granted membership','Logged','9:31 AM']]}
  return `<div class="record-count">${rows.length} fictional demo record${rows.length===1?'':'s'} synchronized across this sandbox</div><div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r,rowIndex)=>`<tr class="${cat!=='admin'&&demo.records[rowIndex]?.id===demo.activeId?'active-row':''}">${r.map((c,i)=>`<td>${i===0&&cat!=='admin'?`<button class="link-button" data-action="activate-record" data-record-id="${esc(demo.records[rowIndex]?.id)}">${esc(c)}</button>`:i===1?`<span class="status ${/denied|declined/i.test(c)?'risk':/needs|pending/i.test(c)?'caution':'info'}">${esc(c)}</span>`:esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderForm(name){
  const r=activeRecord()||{client:'',program:'Long-Term Care Medicaid',date:'2026-07-12',status:'Draft',notes:''};
  return `<div class="two-col"><section class="card"><h2>${name}</h2><div class="form-grid">
    <div class="field"><label for="clientField">Client or record</label><input id="clientField" data-field="client" value="${esc(r.client)}"><div class="help">Use a fictional name for this demonstration.</div></div>
    <div class="field"><label for="programField">Program</label><select id="programField" data-field="program">${['Long-Term Care Medicaid','Special Assistance','SAIH','CAP','Other'].map(v=>`<option ${r.program===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label for="dateField">Business date</label><input id="dateField" data-field="date" type="date" value="${esc(r.date||'2026-07-12')}"></div>
    <div class="field"><label for="statusField">Status</label><select id="statusField" data-field="status">${['Draft','Pending review','Completed','Approved','Denied'].map(v=>`<option ${r.status===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="field" style="grid-column:1/-1"><label for="notesField">Minimum-necessary notes</label><textarea id="notesField" data-field="notes" placeholder="Fictional demonstration notes only">${esc(r.notes||'')}</textarea><div class="help">Updates synchronize to this case throughout the sandbox.</div></div>
  </div><div class="actions"><button class="btn btn-primary" data-action="save-record">Save and sync case</button><button class="btn" data-action="new-case">Start new fictional case</button></div></section>
  <aside class="card"><h3>Before you continue</h3><ul class="task-list"><li><span>Identity and authority checked</span><span class="status positive">Complete</span></li><li><span>Required evidence</span><span class="status caution">3 missing</span></li><li><span>Human review</span><span class="status restricted">Required</span></li></ul></aside></div>`;
}
function renderDocument(){
  return `<div class="alert"><strong>Human review required.</strong> Files remain quarantined until scanning and review are complete.</div>
  <div class="two-col"><section class="card"><h2>Document requirements</h2><ul class="doc-list">
  <li><span><strong>Current bank statements</strong><div class="help">Why needed: verify countable resources. Due Jul 16.</div></span><span class="status risk">Missing</span></li>
  <li><span><strong>Facility verification</strong><div class="help">Version 2 • received Jul 9</div></span><span class="status positive">Accepted</span></li>
  <li><span><strong>Life insurance verification</strong><div class="help">Human review in progress</div></span><span class="status caution">Under review</span></li></ul>
  <button class="btn btn-primary" data-action="document-request">Create simulated upload request</button></section>
  <aside class="card"><h3>Protected file access</h3><p>Community Agencies receive exact, purpose-bound, time-limited grants only after approval.</p><span class="status restricted">Request-only</span></aside></div>`;
}
function renderReferral(){return `<div class="stepper"><div class="step done">Need identified</div><div class="step done">Authorization</div><div class="step current">Referral sent</div><div class="step">Agency response</div><div class="step">Outcome confirmed</div></div>${renderMetrics('referral')}<div style="height:16px"></div>${renderTable('referral')}`}
function renderDecision(){return `<div class="alert"><strong>Official-source rule:</strong> MMS Connect records the DSS determination exactly as stated on the notice. MMS does not decide eligibility.</div>${renderMetrics('decision')}<div style="height:16px"></div>${renderTable('decision')}`}
function renderDashboard(){return `${renderMetrics('dashboard')}<div style="height:16px"></div><div class="two-col"><section>${renderTable('dashboard')}</section><aside class="card"><h2>Next actions</h2><ul class="task-list"><li><span>Escalate missing bank records</span><span class="status risk">Today</span></li><li><span>Review denial notice</span><span class="status caution">Due</span></li><li><span>Confirm community outcome</span><span class="status info">2 days</span></li></ul></aside></div>`}
function renderDetail(){const r=activeRecord()||seedState.records[0];const activity=demo.activity.filter(a=>!a.recordId||a.recordId===r.id).slice(-8).reverse();return `<div class="two-col"><section class="card"><h2>Active sandbox case</h2><div class="form-grid"><p><strong>Client</strong><br><span class="saved-value">${esc(r.client)}</span></p><p><strong>Program</strong><br>${esc(r.program)}</p><p><strong>Status</strong><br>${esc(r.status)}</p><p><strong>Workflow stage</strong><br>${esc(r.stage||'Intake')}</p></div><h3>Shared workflow history</h3><div class="timeline">${activity.length?activity.map(a=>`<div class="timeline-item"><time>${esc(a.time)}</time><strong> ${esc(a.message)}</strong></div>`).join(''):'<div class="empty-state">No new demo activity yet.</div>'}</div></section><aside class="card"><h3>Status and next action</h3><span class="status caution">${esc(r.status)}</span><p><strong>Notes:</strong> ${esc(r.notes||'None')}</p><p><strong>Tasks:</strong> ${demo.tasks.filter(t=>t.recordId===r.id).length}</p><p><strong>Upload requests:</strong> ${demo.documentRequests.filter(d=>d.recordId===r.id).length}</p><button class="btn btn-primary" data-action="create-task">Create task</button></aside></div>`}
function renderAuth(name){return `<div class="card" style="max-width:520px;margin:auto"><h2>${name}</h2><p class="subtitle">Use fictional credentials to explore this prototype.</p><div class="field"><label>Email</label><input value="demo@mmsconnect.com"></div><div class="field"><label>Password</label><input type="password" value="prototype"></div><button class="btn btn-primary" style="width:100%;margin-top:16px">Continue securely</button></div>`}
function renderAdmin(){return `${renderMetrics('admin')}<div style="height:16px"></div>${renderTable('admin')}<div class="confirmation" style="margin-top:16px"><strong>Configuration changes are versioned.</strong><div>Every material change requires an owner, effective date, approver, impact preview, and audit event.</div></div>`}
function renderScreen(screen){
  if(!allowed(screen)) return `<div class="breadcrumb">${screen.id} / Restricted capability</div><div class="denied-panel"><h2>Access Denied</h2><div class="meta-grid"><strong>Current role</strong><span>${role.value}</span><strong>Attempted area</strong><span>${screen.name}</span><strong>Authorized roles</strong><span>MMS Administrator or specifically assigned role</span><strong>Why restricted</strong><span>This area is outside the current organization, role, or client assignment scope.</span></div><div class="actions" style="margin-top:20px"><button class="btn" onclick="openFirstAllowed()">Return to safe page</button><button class="btn btn-primary">Request approved access</button></div></div>`;
  const body=screen.category==='dashboard'?renderDashboard():screen.category==='form'?renderForm(screen.name):screen.category==='document'?renderDocument():screen.category==='referral'?renderReferral():screen.category==='decision'?renderDecision():screen.category==='admin'?renderAdmin():screen.category==='auth'?renderAuth(screen.name):screen.category==='list'?renderTable('list'):renderDetail();
  const r=activeRecord();const context=r?`<div class="case-context"><strong>Active case: ${esc(r.client)}</strong><span>${esc(r.id)}</span><span>${esc(r.program)}</span><span class="status info">${esc(r.stage||'Intake')}</span></div>`:'';
  return `<div class="breadcrumb">${screen.id} / ${role.value}</div><div class="page-header"><div><h1>${screen.name}</h1><p class="subtitle">Connected fictional-data sandbox using one shared active case across the workflow.</p></div><div class="actions"><button class="btn btn-primary">${primaryAction(screen.category)}</button><button class="btn">Help</button></div></div>${context}${body}<div class="footer-note">Responsive at 360px, tablet, and desktop • WCAG 2.2 AA target • No production PHI</div>`;
}
function openScreen(screen){currentScreen=screen;document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.id===screen.id));document.getElementById('topTitle').textContent=screen.name;document.getElementById('topContext').textContent=role.value;content.innerHTML=renderScreen(screen);document.querySelector('main').focus()}
function showWalkthroughStep(index){walkthroughIndex=Math.max(0,Math.min(index,facilityWalkthrough.length-1));const step=facilityWalkthrough[walkthroughIndex];const screen=screens.find(s=>s.id===step.id);if(screen)openScreen(screen);walkthrough.hidden=false;walkthrough.innerHTML=`<div class="walkthrough-grid"><div><div class="walkthrough-progress">Facility walkthrough · Step ${walkthroughIndex+1} of ${facilityWalkthrough.length}</div><h2>${esc(step.title)}</h2><p>${esc(step.why)}</p></div><div class="actions"><button class="btn" data-walkthrough="exit">Exit</button><button class="btn" data-walkthrough="back" ${walkthroughIndex===0?'disabled':''}>Back</button><button class="btn btn-primary" data-walkthrough="next">${walkthroughIndex===facilityWalkthrough.length-1?'Finish':'Next'}</button></div></div>`}
function startFacilityWalkthrough(){role.value='Facility User';renderNav();const r=activeRecord();if(r){r.stage='Facility walkthrough';demo.activity.push({recordId:r.id,time:new Date().toLocaleString(),message:'Facility walkthrough started'});persist()}showWalkthroughStep(0);notify('Facility walkthrough mode started.')}
function openFirstAllowed(){openScreen(screens.find(allowed))}
function renderNav(){const q=search.value.trim().toLowerCase();nav.innerHTML='';screens.filter(s=>!q||`${s.id} ${s.name}`.toLowerCase().includes(q)).forEach(s=>{const b=document.createElement('button');b.dataset.id=s.id;b.innerHTML=`${s.id} · ${s.name}${allowed(s)?'':'<span class="restricted">Restricted</span>'}`;b.onclick=()=>openScreen(s);nav.appendChild(b)})}
function saveRecord(){const fields=Object.fromEntries([...content.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el.value.trim()]));if(!fields.client){notify('Enter a fictional client or record name.');content.querySelector('[data-field="client"]').focus();return}let record=activeRecord();if(!record||record.client!==fields.client){record={id:`MMS-${1000+demo.records.length+1}`,owner:role.value,action:'Open record'};demo.records.push(record)}Object.assign(record,fields,{due:fields.date,stage:currentScreen.name,lastUpdated:new Date().toISOString()});demo.activeId=record.id;demo.activity.push({recordId:record.id,time:new Date().toLocaleString(),message:`Case synchronized from ${currentScreen.name}`});persist();refreshCaseSelector();notify(`${fields.client} synchronized across the sandbox.`);openScreen(currentScreen)}
content.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;const r=activeRecord();if(action==='save-record')saveRecord();if(action==='new-case'){demo.activeId=null;content.querySelectorAll('[data-field]').forEach(el=>el.value='');notify('Enter a new fictional case, then save it.')}if(action==='activate-record'){demo.activeId=b.dataset.recordId;persist();refreshCaseSelector();openScreen(currentScreen);notify(`${activeRecord().client} is now the active sandbox case.`)}if(action==='document-request'&&r){demo.documentRequests.push({recordId:r.id,created:new Date().toISOString(),role:role.value});r.stage='Document request';demo.activity.push({recordId:r.id,time:new Date().toLocaleString(),message:'Simulated secure upload request created'});persist();notify('Upload request synchronized to the active case.');openScreen(currentScreen)}if(action==='create-task'&&r){demo.tasks.push({recordId:r.id,created:new Date().toISOString(),status:'Open',owner:role.value});demo.activity.push({recordId:r.id,time:new Date().toLocaleString(),message:'Follow-up task created'});persist();notify('Task synchronized to the active case.');openScreen(currentScreen)}});
document.getElementById('resetDemo').onclick=()=>{if(confirm('Reset all fictional demo data in this browser?')){demo=clone(seedState);persist();refreshCaseSelector();renderNav();openScreen(screens.find(s=>s.id==='UX-012')||screens[0]);notify('Demo data reset.')}};
activeCase.onchange=()=>{demo.activeId=activeCase.value;persist();openScreen(currentScreen);notify(`${activeRecord().client} is now active.`)};
document.getElementById('startWalkthrough').onclick=startFacilityWalkthrough;
walkthrough.addEventListener('click',e=>{const b=e.target.closest('[data-walkthrough]');if(!b||b.disabled)return;if(b.dataset.walkthrough==='back')showWalkthroughStep(walkthroughIndex-1);if(b.dataset.walkthrough==='exit'){walkthrough.hidden=true;walkthroughIndex=-1;notify('Facility walkthrough closed.')}if(b.dataset.walkthrough==='next'){if(walkthroughIndex===facilityWalkthrough.length-1){walkthrough.hidden=true;walkthroughIndex=-1;notify('Facility walkthrough completed.')}else showWalkthroughStep(walkthroughIndex+1)}});
role.onchange=()=>{renderNav();openFirstAllowed()};search.oninput=renderNav;role.value='MMS Administrator';refreshCaseSelector();renderNav();openScreen(screens.find(s=>s.id==='UX-012')||screens[0]);
