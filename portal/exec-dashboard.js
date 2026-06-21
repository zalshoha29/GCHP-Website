/* =========================================
   GCHP Portal — Executive Pending Queue
   ========================================= */
let pendingRows = [];
let activeCycle = null;
let currentEvent = null;

function toast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'portal-toast show ' + type;
  setTimeout(() => { t.className = 'portal-toast ' + type; }, 2800);
}
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();

function fmtDate(d){ return d ? new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'; }
function fmtDT(d){ return d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—'; }

document.addEventListener('gchp:ready', async () => {
  activeCycle = await getActiveCycle();
  await loadQueue();
  document.getElementById('sortBy').addEventListener('change', renderQueue);
  document.getElementById('soClose').addEventListener('click', closeSlideover);
  document.getElementById('slideoverOverlay').addEventListener('click', closeSlideover);
});

async function loadQueue() {
  const { data, error } = await sb
    .from('events')
    .select('*, profiles(display_name, university, ambassador_id, phone)')
    .in('status', ['Submitted — Pending Review', 'Resubmitted — Pending Review'])
    .order('date_pre_form_received', { ascending: true });

  if (error) { document.getElementById('queueContainer').innerHTML = `<div class="empty-state">Could not load: ${esc(error.message)}</div>`; return; }
  pendingRows = data || [];
  renderQueue();
}

function renderQueue() {
  const container = document.getElementById('queueContainer');
  if (!pendingRows.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 48 48" fill="none" width="48" height="48"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/><path d="M16 24 L22 30 L33 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <p>No submissions awaiting review. You're all caught up.</p></div>`;
    return;
  }

  const sortKey = document.getElementById('sortBy').value;
  const rows = [...pendingRows].sort((a,b) => {
    const av = sortKey === 'university' ? (a.profiles?.university || '') : (a[sortKey] || '');
    const bv = sortKey === 'university' ? (b.profiles?.university || '') : (b[sortKey] || '');
    return String(av).localeCompare(String(bv));
  });

  container.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr>
      <th>Ambassador</th><th>University</th><th>Event</th><th>Event Date</th>
      <th>Activity</th><th>Received</th><th>Flags</th>
    </tr></thead>
    <tbody>${rows.map(r => `
      <tr data-id="${esc(r.id)}">
        <td>${esc(r.profiles?.display_name || '—')}</td>
        <td>${esc(r.profiles?.university || '—')}</td>
        <td>${esc(r.event_name)}</td>
        <td>${fmtDate(r.event_date)}</td>
        <td>${esc(r.activity_type || '—')}</td>
        <td>${fmtDT(r.date_pre_form_received)}</td>
        <td>
          ${r.is_resubmission ? '<span class="flag-badge flag-resub">Resubmission</span> ' : ''}
          ${r.is_duplicate_flagged ? '<span class="flag-badge flag-dup">Possible duplicate</span>' : ''}
        </td>
      </tr>`).join('')}
    </tbody></table></div>`;

  container.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.addEventListener('click', () => openDetail(tr.dataset.id));
  });
}

function openDetail(id) {
  currentEvent = pendingRows.find(r => r.id === id);
  if (!currentEvent) return;

  document.getElementById('soTitle').textContent = `${currentEvent.event_name} (${currentEvent.event_id})`;
  document.getElementById('soBody').innerHTML = renderFormResponse(buildD1Sections(currentEvent));

  // Scenario is now set per-cycle (inherited by all events), shown read-only.
  let scenarioRef = '';
  if (activeCycle) {
    scenarioRef = `<div class="scenario-ref"><strong>Cycle scenario: ${activeCycle.scenario ? esc(activeCycle.scenario) : 'not set'}</strong>This event inherits its scenario from the cycle. To change it, edit the cycle in the Cycles tab.</div>`;
  }

  document.getElementById('soActions').innerHTML = `
    ${scenarioRef}
    <div class="so-action-row">
      <button class="btn-portal" id="approveBtn" style="flex:1;background:#15803d;">Approve</button>
      <button class="btn-portal" id="denyBtn" style="flex:1;background:#b91c1c;">Deny</button>
    </div>`;

  document.getElementById('approveBtn').addEventListener('click', approveEvent);
  document.getElementById('denyBtn').addEventListener('click', denyEvent);

  document.getElementById('slideover').classList.add('open');
  document.getElementById('slideoverOverlay').classList.add('open');
}

function closeSlideover() {
  document.getElementById('slideover').classList.remove('open');
  document.getElementById('slideoverOverlay').classList.remove('open');
  currentEvent = null;
}


async function approveEvent() {
  const { error } = await sb.from('events')
    .update({ status: 'Approved — Awaiting Link', date_approved: new Date().toISOString() })
    .eq('id', currentEvent.id);
  if (error) { toast('Approve failed: ' + error.message, 'error'); return; }
  toast('Approved. The ambassador has been notified automatically.', 'success');
  closeSlideover(); await loadQueue();
}

function denyEvent() {
  // Capture mandatory denial reason via modal.
  const reason = prompt('Denial reason (required — this is sent to the ambassador):');
  if (reason === null) return;
  if (!reason.trim()) { toast('A denial reason is required.', 'error'); return; }
  doDeny(reason.trim());
}

async function doDeny(reason) {
  const { error } = await sb.from('events')
    .update({ status: 'Denied', denial_reason: reason })
    .eq('id', currentEvent.id);
  if (error) { toast('Deny failed: ' + error.message, 'error'); return; }
  toast('Denied. The reason has been sent to the ambassador.', 'success');
  closeSlideover(); await loadQueue();
}
