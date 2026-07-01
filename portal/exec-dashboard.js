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
  await loadAllEvents();
  document.getElementById('sortBy').addEventListener('change', renderQueue);
  document.getElementById('allStatusFilter').addEventListener('change', renderAllEvents);
  document.getElementById('soClose').addEventListener('click', closeSlideover);
  document.getElementById('slideoverOverlay').addEventListener('click', closeSlideover);
});

let allEventRows = [];
const ALL_STATUSES = [
  'Submitted — Pending Review','Resubmitted — Pending Review','Approved — Awaiting Link','Approved — Link Sent',
  'Event Complete — Awaiting Report','Completed — Awaiting Impact Report','Complete — Impact Report Delivered',
  'Incomplete — No Report','Cancelled','Denied'
];

async function loadAllEvents() {
  if (!activeCycle) { document.getElementById('allEventsContainer').innerHTML = `<div class="empty-state">No active cycle.</div>`; return; }
  const { data, error } = await sb
    .from('events')
    .select('*, profiles(display_name, university, ambassador_id)')
    .eq('cycle_id', activeCycle.id)
    .order('event_date', { ascending: true });
  if (error) { document.getElementById('allEventsContainer').innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  allEventRows = data || [];

  // Populate status filter with statuses actually present.
  const present = [...new Set(allEventRows.map(r => r.status))];
  const sel = document.getElementById('allStatusFilter');
  sel.innerHTML = '<option value="">All statuses</option>' +
    ALL_STATUSES.filter(s => present.includes(s)).map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  renderAllEvents();
}

function statusColor(s) {
  if (s.startsWith('Approved')) return '#0369a1';
  if (s.startsWith('Complete')) return '#15803d';
  if (s.startsWith('Incomplete') || s === 'Denied' || s === 'Cancelled') return '#b91c1c';
  if (s.startsWith('Event Complete')) return '#b45309';
  return '#6b7280'; // pending
}

function renderAllEvents() {
  const container = document.getElementById('allEventsContainer');
  const filter = document.getElementById('allStatusFilter').value;
  const rows = filter ? allEventRows.filter(r => r.status === filter) : allEventRows;
  if (!rows.length) { container.innerHTML = `<div class="empty-state">No events${filter?' with this status':''} in the active cycle.</div>`; return; }

  container.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>EVT</th><th>Event</th><th>Ambassador</th><th>University</th><th>Event Date</th><th>Status</th></tr></thead>
    <tbody>${rows.map(r => `<tr data-id="${esc(r.id)}">
      <td>${esc(r.event_id)}</td><td>${esc(r.event_name)}</td>
      <td>${esc(r.profiles?.display_name||'—')}</td><td>${esc(r.profiles?.university||'—')}</td>
      <td>${r.event_date ? new Date(r.event_date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
      <td><span class="flag-badge" style="background:${statusColor(r.status)}1a;color:${statusColor(r.status)};">${esc(r.status)}</span></td>
    </tr>`).join('')}</tbody></table></div>`;

  // Clicking any row opens the same detail slide-over used by the queue.
  container.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.addEventListener('click', () => openDetail(tr.dataset.id));
  });
}

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
  currentEvent = pendingRows.find(r => r.id === id) || allEventRows.find(r => r.id === id);
  if (!currentEvent) return;

  document.getElementById('soTitle').textContent = `${currentEvent.event_name} (${currentEvent.event_id})`;
  document.getElementById('soBody').innerHTML = renderFormResponse(buildD1Sections(currentEvent));

  // Scenario is set per-cycle (inherited), shown read-only.
  let scenarioRef = '';
  if (activeCycle) {
    scenarioRef = `<div class="scenario-ref"><strong>Cycle scenario: ${activeCycle.scenario ? esc(activeCycle.scenario) : 'not set'}</strong>This event inherits its scenario from the cycle. To change it, edit the cycle in the Cycles tab.</div>`;
  }

  // Approve/Deny only make sense for events still pending review.
  const isPending = ['Submitted — Pending Review','Resubmitted — Pending Review'].includes(currentEvent.status);
  const actions = isPending
    ? `<div class="so-action-row">
         <button class="btn-portal" id="approveBtn" style="flex:1;background:#15803d;">Approve</button>
         <button class="btn-portal" id="denyBtn" style="flex:1;background:#b91c1c;">Deny</button>
       </div>`
    : `<div class="scenario-ref"><strong>Current status: ${esc(currentEvent.status)}</strong>This event is past the review stage. Manage it from the Calendar or Data Editor.</div>`;

  document.getElementById('soActions').innerHTML = `${scenarioRef}${actions}`;

  if (isPending) {
    document.getElementById('approveBtn').addEventListener('click', approveEvent);
    document.getElementById('denyBtn').addEventListener('click', denyEvent);
  }

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
  closeSlideover(); await loadQueue(); await loadAllEvents();
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
  closeSlideover(); await loadQueue(); await loadAllEvents();
}
