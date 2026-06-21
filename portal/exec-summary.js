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
function exportExcel() {
  if (typeof XLSX === 'undefined') { toast('Export library not loaded.', 'error'); return; }
  if (!currentSummary && !historyRows.length) { toast('Nothing to export yet — generate a summary first.', 'error'); return; }

  const wb = XLSX.utils.book_new();

  // Sheet 1 — Current Totals (the active cycle's summary as key/value rows).
  if (currentSummary) {
    const cur = [
      ['Metric', 'Value'],
      ['Cycle', activeCycle?.cycle_name || ''],
      ['Total Raised ($)', Number(currentSummary.total_raised||0)],
      ['Events Submitted', currentSummary.total_events_submitted||0],
      ['Events Approved', currentSummary.total_events_approved||0],
      ['Events Completed', currentSummary.total_events_completed||0],
      ['D2 Completion Rate (%)', currentSummary.d2_completion_rate||0],
      ['Total Ambassadors', currentSummary.total_ambassadors||0],
      ['Returning Ambassadors', currentSummary.returning_ambassadors||0],
      ['First-time Ambassadors', currentSummary.first_time_ambassadors||0],
      ['Generated', new Date(currentSummary.generated_at).toLocaleString('en-GB')],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cur), 'Current Totals');
  }

  // Sheet 2 — All Cycles (one row per cycle summary).
  const header = ['Cycle','Total Raised','Events Submitted','Events Approved','Events Completed','D2 Completion Rate (%)','Total Ambassadors','Returning','First-time','Generated'];
  const rows = historyRows.map(r => [
    r.cycles?.cycle_name || '', Number(r.total_raised||0), r.total_events_submitted||0,
    r.total_events_approved||0, r.total_events_completed||0, r.d2_completion_rate||0,
    r.total_ambassadors||0, r.returning_ambassadors||0, r.first_time_ambassadors||0,
    new Date(r.generated_at).toLocaleDateString('en-GB'),
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), 'All Cycles');

  XLSX.writeFile(wb, `GCHP_Cycle_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('Excel file downloaded.', 'success');
}
