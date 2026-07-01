/* =========================================
   GCHP Portal — Executive Cycle Summary
   Separate Generate / Refresh; Excel export with tabs.
   ========================================= */
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},2800); }

let activeCycle = null;
let currentSummary = null;

document.addEventListener('gchp:ready', async () => {
  activeCycle = await getActiveCycle();
  if (activeCycle) document.getElementById('summaryTitle').textContent = `Cycle Summary — ${activeCycle.cycle_name}`;
  document.getElementById('generateBtn').addEventListener('click', () => runSummary('generate'));
  document.getElementById('refreshBtn').addEventListener('click', () => runSummary('refresh'));
  document.getElementById('exportBtn').addEventListener('click', exportExcel);
  await loadSummary(); await loadHistory();
});

async function runSummary(mode) {
  if (!activeCycle) { toast('No active cycle.', 'error'); return; }

  // Generate = only when none exists yet; Refresh = recompute existing.
  if (mode === 'generate' && currentSummary) {
    toast('A summary already exists. Use Refresh to recompute it.', 'error');
    return;
  }
  if (mode === 'refresh' && !currentSummary) {
    toast('No summary yet — use Generate first.', 'error');
    return;
  }

  const btn = document.getElementById(mode === 'generate' ? 'generateBtn' : 'refreshBtn');
  const orig = btn.textContent; btn.disabled = true; btn.textContent = mode === 'generate' ? 'Generating...' : 'Refreshing...';
  const { error } = await sb.rpc('generate_cycle_summary', { p_cycle_id: activeCycle.id });
  btn.disabled = false; btn.textContent = orig;
  if (error) { toast('Failed: ' + error.message, 'error'); return; }
  toast(mode === 'generate' ? 'Summary generated.' : 'Summary refreshed.', 'success');
  await loadSummary(); await loadHistory();
}

async function loadSummary() {
  if (!activeCycle) return;
  const { data } = await sb.from('cycle_summaries').select('*').eq('cycle_id', activeCycle.id).maybeSingle();
  currentSummary = data || null;
  const grid = document.getElementById('summaryMetrics');

  // Reflect button availability.
  document.getElementById('generateBtn').style.display = currentSummary ? 'none' : 'inline-block';
  document.getElementById('refreshBtn').style.display = currentSummary ? 'inline-block' : 'none';

  if (!data) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No summary yet for this cycle. Click "Generate Summary".</div>`; return; }
  grid.innerHTML = `
    <div class="metric-card"><div class="mc-num">$${Number(data.total_raised||0).toLocaleString()}</div><div class="mc-label">Total raised</div></div>
    <div class="metric-card"><div class="mc-num">${data.total_events_submitted||0}</div><div class="mc-label">Events submitted</div></div>
    <div class="metric-card"><div class="mc-num">${data.total_events_approved||0}</div><div class="mc-label">Events approved</div></div>
    <div class="metric-card"><div class="mc-num">${data.total_events_completed||0}</div><div class="mc-label">Events completed</div></div>
    <div class="metric-card"><div class="mc-num">${data.d2_completion_rate||0}%</div><div class="mc-label">D2 completion rate</div></div>
    <div class="metric-card"><div class="mc-num">${data.total_ambassadors||0}</div><div class="mc-label">Ambassadors</div></div>
    <div class="metric-card"><div class="mc-num">${data.returning_ambassadors||0}</div><div class="mc-label">Returning</div></div>
    <div class="metric-card"><div class="mc-num">${data.first_time_ambassadors||0}</div><div class="mc-label">First-time</div></div>`;
}

let historyRows = [];
async function loadHistory() {
  const { data } = await sb.from('cycle_summaries').select('*, cycles(cycle_name, end_date)').order('generated_at', { ascending: false });
  historyRows = data || [];
  const c = document.getElementById('historyTable');
  if (!historyRows.length) { c.innerHTML = `<div class="empty-state">No summaries generated yet.</div>`; return; }
  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Cycle</th><th>Raised</th><th>Submitted</th><th>Completed</th><th>D2 %</th><th>Ambassadors</th><th>Generated</th></tr></thead>
    <tbody>${historyRows.map(r=>`<tr style="cursor:default;">
      <td>${esc(r.cycles?.cycle_name||'—')}</td><td>$${Number(r.total_raised||0).toLocaleString()}</td>
      <td>${r.total_events_submitted||0}</td><td>${r.total_events_completed||0}</td>
      <td>${r.d2_completion_rate||0}%</td><td>${r.total_ambassadors||0}</td>
      <td>${new Date(r.generated_at).toLocaleDateString('en-GB')}</td></tr>`).join('')}</tbody></table></div>`;
}

// Excel export: Tab 1 = current cycle totals; Tab 2 = all cycles data.
// Excel tab names: max 31 chars, no : \ / ? * [ ]
function sheetName(name, used) {
  let base = String(name).replace(/[:\\/?*\[\]]/g, ' ').trim().slice(0, 28) || 'Cycle';
  let n = base, i = 2;
  while (used.has(n)) { n = base.slice(0, 25) + ' (' + i + ')'; i++; }
  used.add(n);
  return n;
}

async function exportExcel() {
  if (typeof XLSX === 'undefined') { toast('Export library not loaded.', 'error'); return; }
  toast('Building workbook…');

  // Pull every cycle, and all events joined with ambassador + D2 report.
  const { data: allCycles, error: cErr } = await sb.from('cycles').select('*').order('start_date', { ascending: true });
  if (cErr) { toast('Export failed: ' + cErr.message, 'error'); return; }

  const { data: events, error: eErr } = await sb.from('events')
    .select('*, profiles(display_name, ambassador_id, university), post_reports(*)');
  if (eErr) { toast('Export failed: ' + eErr.message, 'error'); return; }

  const wb = XLSX.utils.book_new();
  const usedNames = new Set();

  const EVENT_HEADER = [
    'Event ID','Event Name','Activity Type','Event Date','Status','Scenario',
    'Ambassador','Ambassador ID','University',
    'Fundraising Target ($)','Fundraising Code',
    'D2 Submitted','Total Raised ($)','Attendance','Target Met','Donations Submitted',
    'Would Run Again','Experience Rating','Report Date','What Went Well','What To Change','Advice For Others','Open Feedback'
  ];

  function eventRow(e) {
    const p = e.profiles || {};
    const r = (e.post_reports && e.post_reports[0]) || null;
    return [
      e.event_id||'', e.event_name||'', e.activity_type||'', e.event_date||'', e.status||'', e.scenario||'',
      p.display_name||'', p.ambassador_id||'', p.university||'',
      Number(e.fundraising_target||0), e.fundraising_code||'',
      r ? 'Yes' : 'No',
      r ? Number(r.total_raised||0) : '', r ? (r.attendance ?? '') : '', r ? (r.target_met||'') : '',
      r ? (r.donations_submitted ? 'Yes':'No') : '',
      r ? (r.run_another_event ? 'Yes':'No') : '', r ? (r.experience_rating ?? '') : '',
      r && r.date_submitted ? new Date(r.date_submitted).toLocaleDateString('en-GB') : '',
      r ? (r.what_went_well||'') : '', r ? (r.what_to_change||'') : '', r ? (r.advice_for_others||'') : '',
      r ? (r.open_feedback||'') : '',
    ];
  }

  const COMPLETED = ['Completed — Awaiting Impact Report','Complete — Impact Report Delivered'];

  // ---- One detailed tab per cycle ----
  (allCycles||[]).forEach(cy => {
    const cyEvents = (events||[]).filter(e => e.cycle_id === cy.id);
    const rows = cyEvents.map(eventRow);

    // Small header block above the event table.
    const raised = cyEvents.reduce((s,e)=> s + ((e.post_reports&&e.post_reports[0]) ? Number(e.post_reports[0].total_raised||0):0), 0);
    const meta = [
      [cy.cycle_name || 'Cycle'],
      ['Dates', `${cy.start_date||''} to ${cy.end_date||''}`],
      ['Scenario', cy.scenario||'—'],
      ['Events', cyEvents.length, 'Completed', cyEvents.filter(e=>COMPLETED.includes(e.status)).length],
      ['Total Raised ($)', raised],
      [],
      EVENT_HEADER,
      ...rows,
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), sheetName(cy.cycle_name, usedNames));
  });

  // ---- Cumulative tab across all cycles ----
  const perCycle = (allCycles||[]).map(cy => {
    const cyEvents = (events||[]).filter(e => e.cycle_id === cy.id);
    const completed = cyEvents.filter(e=>COMPLETED.includes(e.status));
    const withReport = cyEvents.filter(e=> e.post_reports && e.post_reports.length);
    const raised = cyEvents.reduce((s,e)=> s + ((e.post_reports&&e.post_reports[0]) ? Number(e.post_reports[0].total_raised||0):0), 0);
    const ambs = new Set(cyEvents.map(e=>e.ambassador_id));
    return {
      name: cy.cycle_name||'', scenario: cy.scenario||'—', events: cyEvents.length,
      completed: completed.length, d2rate: completed.length ? Math.round(withReport.length/completed.length*100) : 0,
      raised, ambassadors: ambs.size,
    };
  });
  const totalRaised = perCycle.reduce((s,c)=>s+c.raised,0);
  const totalEvents = perCycle.reduce((s,c)=>s+c.events,0);
  const totalCompleted = perCycle.reduce((s,c)=>s+c.completed,0);

  const cumulative = [
    ['GCHP — Cumulative Report (All Cycles)'],
    ['Generated', new Date().toLocaleString('en-GB')],
    [],
    ['TOTALS'],
    ['Total Raised ($)', totalRaised],
    ['Total Events', totalEvents],
    ['Total Completed Events', totalCompleted],
    ['Cycles', perCycle.length],
    [],
    ['PER CYCLE'],
    ['Cycle','Scenario','Events','Completed','D2 Completion (%)','Total Raised ($)','Ambassadors'],
    ...perCycle.map(c => [c.name, c.scenario, c.events, c.completed, c.d2rate, c.raised, c.ambassadors]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cumulative), sheetName('Cumulative', usedNames));

  XLSX.writeFile(wb, `GCHP_Full_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('Excel file downloaded.', 'success');
}
