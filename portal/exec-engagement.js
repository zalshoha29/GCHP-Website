/* =========================================
   GCHP Portal — Executive Engagement Health
   Overall (all cycles) + per-cycle (selectable).
   ========================================= */
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();

const COMPLETED = ['Completed — Awaiting Impact Report','Complete — Impact Report Delivered'];
const APPROVED_PLUS = ['Approved — Awaiting Link','Approved — Link Sent','Event Complete — Awaiting Report',...COMPLETED];

let ambassadors = [], allEvents = [], cycles = [], activeCycle = null;

document.addEventListener('gchp:ready', async () => {
  const { data: ambs } = await sb.from('profiles').select('id, display_name, university').eq('role','ambassador');
  ambassadors = ambs || [];
  const { data: evs } = await sb.from('events').select('*, post_reports(total_raised, date_submitted)');
  allEvents = evs || [];
  const { data: cyc } = await sb.from('cycles').select('*').order('start_date', { ascending: false });
  cycles = cyc || [];
  activeCycle = cycles.find(c => c.is_active) || cycles[0] || null;

  renderOverall();

  const sel = document.getElementById('cycleSelect');
  sel.innerHTML = cycles.map(c => `<option value="${esc(c.id)}"${c.id===activeCycle?.id?' selected':''}>${esc(c.cycle_name)}${c.is_active?' (active)':''}</option>`).join('');
  sel.addEventListener('change', () => renderCycle(sel.value));
  if (activeCycle) renderCycle(activeCycle.id);
});

function metricsFor(events) {
  const submitted = events.length;
  const approved = events.filter(e => APPROVED_PLUS.includes(e.status)).length;
  const completed = events.filter(e => COMPLETED.includes(e.status)).length;
  const withReport = events.filter(e => e.post_reports && e.post_reports.length).length;
  const d2Rate = completed ? Math.round((withReport/completed)*100) : 0;
  let raised = 0; events.forEach(e => (e.post_reports||[]).forEach(r => raised += Number(r.total_raised)||0));
  return { submitted, approved, completed, d2Rate, raised };
}

function metricCards(m, extra='') {
  return `
    <div class="metric-card"><div class="mc-num">${m.submitted}</div><div class="mc-label">Events submitted</div></div>
    <div class="metric-card"><div class="mc-num">${m.approved}</div><div class="mc-label">Events approved+</div></div>
    <div class="metric-card"><div class="mc-num">${m.completed}</div><div class="mc-label">Events completed</div></div>
    <div class="metric-card"><div class="mc-num">${m.d2Rate}%</div><div class="mc-label">D2 completion rate</div></div>
    <div class="metric-card"><div class="mc-num">$${m.raised.toLocaleString()}</div><div class="mc-label">Total raised</div></div>
    ${extra}`;
}

function renderOverall() {
  const m = metricsFor(allEvents);
  const activeAmbIds = new Set(allEvents.map(e => e.ambassador_id));
  document.getElementById('overallGrid').innerHTML = metricCards(m, `
    <div class="metric-card"><div class="mc-num">${ambassadors.length}</div><div class="mc-label">Total ambassadors</div></div>
    <div class="metric-card"><div class="mc-num">${activeAmbIds.size}</div><div class="mc-label">Ever participated</div></div>`);
}

function renderCycle(cycleId) {
  const cyc = cycles.find(c => c.id === cycleId);
  const cycleEvents = allEvents.filter(e => e.cycle_id === cycleId);
  const m = metricsFor(cycleEvents);

  // No-D1 + overdue for this cycle
  const evByAmb = {}; cycleEvents.forEach(e => (evByAmb[e.ambassador_id] ||= []).push(e));
  const noD1 = ambassadors.filter(a => !evByAmb[a.id]).length;
  const overdueDays = cyc?.d2_overdue_days || 14;
  const today = new Date(); today.setHours(0,0,0,0);
  const overdueD2 = cycleEvents.filter(e => {
    if (e.status !== 'Event Complete — Awaiting Report') return false;
    if (e.post_reports && e.post_reports.length) return false;
    const dl = new Date(e.event_date+'T00:00:00'); dl.setDate(dl.getDate()+overdueDays);
    return dl < today;
  }).length;

  document.getElementById('cycleGrid').innerHTML = metricCards(m, `
    <div class="metric-card amber"><div class="mc-num">${noD1}</div><div class="mc-label">No D1 (this cycle)</div></div>
    <div class="metric-card red"><div class="mc-num">${overdueD2}</div><div class="mc-label">Overdue D2</div></div>`);

  // Returning = has events in a cycle other than this one.
  const priorAmb = new Set(allEvents.filter(e => e.cycle_id !== cycleId).map(e => e.ambassador_id));

  const rows = ambassadors.map(a => {
    const evs = evByAmb[a.id] || [];
    const aComp = evs.filter(e => COMPLETED.includes(e.status)).length;
    const aRep = evs.filter(e => e.post_reports && e.post_reports.length).length;
    let raised = 0; evs.forEach(e => (e.post_reports||[]).forEach(r => raised += Number(r.total_raised)||0));
    let lags = [];
    evs.forEach(e => (e.post_reports||[]).forEach(r => {
      if (r.date_submitted && e.event_date) { const d=(new Date(r.date_submitted)-new Date(e.event_date+'T00:00:00'))/86400000; if(d>=0)lags.push(d); }
    }));
    const lag = lags.length ? Math.round(lags.reduce((x,y)=>x+y,0)/lags.length) : null;
    return { a, sub:evs.length, app:evs.filter(e=>APPROVED_PLUS.includes(e.status)).length, comp:aComp,
             rate: aComp?Math.round((aRep/aComp)*100):0, raised, returning:priorAmb.has(a.id), lag };
  });

  document.getElementById('ambTable').innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Ambassador</th><th>University</th><th>Type</th><th>Sub</th><th>App</th><th>Comp</th><th>D2 %</th><th>Raised</th><th>Lag</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td>${esc(r.a.display_name)}</td><td>${esc(r.a.university||'—')}</td>
      <td>${r.returning?'<span class="flag-badge flag-resub">Returning</span>':'<span class="flag-badge" style="background:#dcfce7;color:#15803d;">First-time</span>'}</td>
      <td>${r.sub}</td><td>${r.app}</td><td>${r.comp}</td><td>${r.rate}%</td>
      <td>$${r.raised.toLocaleString()}</td><td>${r.lag===null?'—':r.lag+'d'}</td></tr>`).join('')}</tbody></table></div>`;
}
