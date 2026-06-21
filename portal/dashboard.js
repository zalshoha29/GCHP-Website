/* =========================================
   GCHP Portal — Ambassador Dashboard
   ========================================= */

// Map every status to a badge class + readable label.
const STATUS_MAP = {
  'Submitted — Pending Review':          { cls: 'sb-pending',     label: 'Pending Review' },
  'Resubmitted — Pending Review':        { cls: 'sb-pending',     label: 'Resubmitted — Pending' },
  'Approved — Awaiting Link':            { cls: 'sb-approved',    label: 'Approved — Awaiting Link' },
  'Approved — Link Sent':                { cls: 'sb-link',        label: 'Approved — Link Sent' },
  'Event Complete — Awaiting Report':    { cls: 'sb-eventdone',   label: 'Event Complete — Awaiting Report' },
  'Completed — Awaiting Impact Report':  { cls: 'sb-awaitimpact', label: 'Completed — Awaiting Impact Report' },
  'Complete — Impact Report Delivered':  { cls: 'sb-delivered',   label: 'Impact Report Delivered' },
  'Incomplete — No Report':              { cls: 'sb-incomplete',  label: 'Incomplete — No Report' },
  'Cancelled':                           { cls: 'sb-cancelled',   label: 'Cancelled' },
  'Denied':                              { cls: 'sb-denied',      label: 'Denied' },
};

function statusBadge(status) {
  const m = STATUS_MAP[status] || { cls: 'sb-cancelled', label: status };
  return `<span class="status-badge ${m.cls}">${esc(m.label)}</span>`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'portal-toast show ' + type;
  setTimeout(() => { t.className = 'portal-toast ' + type; }, 2600);
}

// Topbar date
(function () {
  const el = document.getElementById('topbarDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
})();

// Mobile sidebar toggle
(function () {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
})();

document.addEventListener('gchp:ready', async (e) => {
  const profile = e.detail.profile;
  await loadUnreadBadge(profile.id);
  await loadDashboard(profile);
});

async function loadUnreadBadge(userId) {
  const count = await getUnreadCount(userId);
  const badge = document.getElementById('msgBadge');
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
}

async function loadDashboard(profile) {
  const cycle = await getActiveCycle();

  // Cycle banner
  const banner = document.getElementById('cycleBanner');
  if (cycle) {
    banner.innerHTML = `
      <div class="cycle-banner">
        <div>
          <h2>${esc(cycle.cycle_name)}</h2>
          <div class="cb-sub">Current fundraising cycle</div>
        </div>
        <div class="cycle-deadlines">
          <div class="cycle-deadline">
            <div class="cd-label">D1 Deadline</div>
            <div class="cd-date">${fmtDate(cycle.deliverable_1_deadline)}</div>
          </div>
          <div class="cycle-deadline">
            <div class="cd-label">D2 Deadline</div>
            <div class="cd-date">${fmtDate(cycle.deliverable_2_deadline)}</div>
          </div>
        </div>
      </div>`;
  } else {
    banner.innerHTML = `<div class="cycle-banner"><div><h2>No active cycle</h2><div class="cb-sub">There is no fundraising cycle open right now.</div></div></div>`;
  }

  // Current-cycle events
  const container = document.getElementById('eventsContainer');
  let events = [];
  if (cycle) {
    const { data, error } = await sb
      .from('events')
      .select('*, post_reports(id)')
      .eq('ambassador_id', profile.id)
      .eq('cycle_id', cycle.id)
      .order('created_at', { ascending: false });
    if (error) { container.innerHTML = `<div class="empty-state">Could not load events: ${esc(error.message)}</div>`; return; }
    events = data || [];
  }

  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" width="48" height="48"><rect x="8" y="6" width="32" height="36" rx="3" stroke="currentColor" stroke-width="2"/><path d="M16 16 H32 M16 23 H32 M16 30 H26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <p>You haven't submitted any events this cycle yet.<br><a href="submit-d1.html" style="color:var(--teal);font-weight:600;">Submit your first event plan →</a></p>
      </div>`;
  } else {
    container.innerHTML = `<div class="event-grid">${events.map(renderEventCard).join('')}</div>`;
    bindCardActions();
  }

  await loadLifetimeStats(profile);
}

function renderEventCard(ev) {
  const hasD2 = ev.post_reports && ev.post_reports.length > 0;

  let linkBlock = '';
  if (ev.status === 'Approved — Link Sent' && ev.fundraising_link) {
    linkBlock = `
      <div class="link-box">
        <span class="lb-url">${esc(ev.fundraising_link)}</span>
        <button class="lb-copy" data-copy="${esc(ev.fundraising_link)}">Copy</button>
      </div>`;
  }

  let resubBlock = '';
  if (ev.status === 'Denied') {
    const blocked = ev.resubmission_count >= 1;
    resubBlock = `
      <div class="resubmit-notice">
        ${ev.denial_reason ? '<div><strong>Reason:</strong> ' + esc(ev.denial_reason) + '</div>' : ''}
        ${blocked
          ? '<div style="margin-top:6px;">This event has already been resubmitted once. Please contact GCHP to discuss further.</div>'
          : '<a class="btn-resubmit" href="submit-d1.html?resubmit=' + esc(ev.id) + '">Edit &amp; Resubmit</a>'}
      </div>`;
  }

  return `
    <div class="event-card">
      <div class="event-card-head">
        <h3>${esc(ev.event_name)}</h3>
        ${statusBadge(ev.status)}
      </div>
      <div class="ec-meta"><strong>${esc(ev.event_id)}</strong> &middot; ${esc(ev.activity_type || '—')}</div>
      <div class="ec-meta">Event date: <strong>${fmtDate(ev.event_date)}</strong></div>
      <div class="ec-meta">Target: <strong>$${esc(ev.fundraising_target ?? '—')}</strong>${hasD2 ? ' &middot; <span style="color:#15803d;font-weight:600;">Report submitted</span>' : ''}</div>
      ${linkBlock}
      ${resubBlock}
    </div>`;
}

function bindCardActions() {
  document.querySelectorAll('.lb-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        const orig = btn.textContent; btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      });
    });
  });
}

async function loadLifetimeStats(profile) {
  // All events across all cycles for this ambassador.
  const { data: allEvents } = await sb
    .from('events')
    .select('id, status, cycle_id, post_reports(total_raised)')
    .eq('ambassador_id', profile.id);

  const events = allEvents || [];
  const completed = events.filter(e =>
    ['Completed — Awaiting Impact Report', 'Complete — Impact Report Delivered'].includes(e.status)
  ).length;

  let totalRaised = 0;
  events.forEach(e => {
    (e.post_reports || []).forEach(pr => { totalRaised += Number(pr.total_raised) || 0; });
  });

  const cycles = new Set(events.map(e => e.cycle_id).filter(Boolean)).size;

  document.getElementById('lifetimeStats').innerHTML = `
    <div class="ls-card"><div class="ls-num">${events.length}</div><div class="ls-label">Total events</div></div>
    <div class="ls-card"><div class="ls-num">${completed}</div><div class="ls-label">Events completed</div></div>
    <div class="ls-card"><div class="ls-num">$${totalRaised.toLocaleString()}</div><div class="ls-label">Total raised</div></div>
    <div class="ls-card"><div class="ls-num">${cycles}</div><div class="ls-label">Cycles participated</div></div>`;
}
