/* =========================================
   GCHP Portal — Executive Calendar & Deadlines
   ========================================= */
let activeCycle = null;
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function fmtDate(d){ return d ? new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'; }

document.addEventListener('gchp:ready', async () => {
  activeCycle = await getActiveCycle();
  await loadAwaitingLink();
  await loadUpcoming();
  await loadDeadlines();
  await loadIncomplete();
  document.getElementById('soClose').addEventListener('click', closeSO);
  document.getElementById('slideoverOverlay').addEventListener('click', closeSO);
});

// Events finalized as Incomplete — No Report (no D2 received in the window).
async function loadIncomplete() {
  const { data, error } = await sb
    .from('events')
    .select('*, profiles(display_name, university, ambassador_id)')
    .eq('status', 'Incomplete — No Report')
    .order('event_date', { ascending: true });

  const c = document.getElementById('incompleteContainer');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { c.innerHTML = `<div class="empty-state">No events have been marked incomplete.</div>`; return; }

  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Event</th><th>Ambassador</th><th>University</th><th>Event Date</th><th>Days Since</th><th>Action</th></tr></thead>
    <tbody>${data.map(r => {
      const days = Math.floor((new Date().setHours(0,0,0,0) - new Date(r.event_date+'T00:00:00')) / 86400000);
      return `<tr class="row-overdue" style="cursor:default;"><td>${esc(r.event_name)} <span style="color:var(--gray);font-size:12px;">(${esc(r.event_id)})</span></td>
        <td>${esc(r.profiles?.display_name||'—')}</td><td>${esc(r.profiles?.university||'—')}</td>
        <td>${fmtDate(r.event_date)}</td><td><strong>${days}d</strong></td>
        <td><button class="btn-portal" style="padding:6px 12px;font-size:12px;" data-reopen="${esc(r.id)}" data-name="${esc(r.event_name)}">Reopen for report</button></td></tr>`;
    }).join('')}</tbody></table></div>`;

  c.querySelectorAll('[data-reopen]').forEach(btn => {
    btn.addEventListener('click', () => reopenForReport(btn.dataset.reopen, btn.dataset.name));
  });
}

// Reopen an incomplete event so the ambassador can submit a late report.
async function reopenForReport(eventId, eventName) {
  if (!confirm(`Reopen "${eventName}" so the ambassador can submit a late post-event report?\n\nThis moves it back to "Event Complete — Awaiting Report".`)) return;
  const { error } = await sb.from('events')
    .update({ status: 'Event Complete — Awaiting Report', reopened_for_report: true })
    .eq('id', eventId);
  if (error) { alert('Reopen failed: ' + error.message); return; }
  await loadIncomplete();
  await loadDeadlines();
}

function closeSO(){ document.getElementById('slideover').classList.remove('open'); document.getElementById('slideoverOverlay').classList.remove('open'); }

// Events approved but still awaiting a link — exec sets the link here.
async function loadAwaitingLink() {
  const { data, error } = await sb
    .from('events')
    .select('*, profiles(display_name, university, ambassador_id, phone)')
    .eq('status', 'Approved — Awaiting Link')
    .order('event_date', { ascending: true });

  const c = document.getElementById('awaitingLinkContainer');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { c.innerHTML = `<div class="empty-state">No events are awaiting a fundraising link.</div>`; return; }

  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Event</th><th>Ambassador</th><th>Date</th><th>Action</th></tr></thead>
    <tbody>${data.map(r => `<tr data-id="${esc(r.id)}" style="cursor:default;">
      <td>${esc(r.event_name)} <span style="color:var(--gray);font-size:12px;">(${esc(r.event_id)})</span></td>
      <td>${esc(r.profiles?.display_name||'—')}</td><td>${fmtDate(r.event_date)}</td>
      <td><button class="btn-portal" style="padding:7px 14px;font-size:12.5px;" data-setlink="${esc(r.id)}">Send Link</button></td></tr>`).join('')}</tbody></table></div>`;

  c.querySelectorAll('[data-setlink]').forEach(btn => {
    btn.addEventListener('click', () => openLinkSetter(data.find(r => r.id === btn.dataset.setlink)));
  });
}

function openLinkSetter(ev) {
  document.getElementById('soTitle').textContent = `Send Link — ${ev.event_name} (${ev.event_id})`;
  document.getElementById('soBody').innerHTML = `
    <div class="form-section-block" style="box-shadow:none;border:none;padding:0;">
      <div class="pf-group"><label>Fundraising Link <span class="req">*</span></label>
        <input type="url" id="linkInput" placeholder="https://..." value="${esc(ev.fundraising_link||'')}" /></div>
      <div class="pf-group"><label>Fundraising Code (optional)</label>
        <input type="text" id="codeInput" placeholder="e.g. GCHP-SP26-LEEDS" value="${esc(ev.fundraising_code||'')}" /></div>
      <div class="pf-hint" style="margin-bottom:16px;">Sending the link sets this event to <strong>Approved — Link Sent</strong> and notifies the ambassador automatically.</div>
      <button class="btn-portal" id="confirmLink">Send Link &amp; Notify</button>
    </div>`;
  document.getElementById('confirmLink').addEventListener('click', async () => {
    const link = document.getElementById('linkInput').value.trim();
    if (!link) { alert('A fundraising link is required.'); return; }
    const code = document.getElementById('codeInput').value.trim() || null;
    const { error } = await sb.from('events').update({
      fundraising_link: link, fundraising_code: code,
      status: 'Approved — Link Sent', date_link_sent: new Date().toISOString(),
    }).eq('id', ev.id);
    if (error) { alert('Failed: ' + error.message); return; }
    closeSO();
    await loadAwaitingLink(); await loadUpcoming();
  });
  document.getElementById('slideover').classList.add('open');
  document.getElementById('slideoverOverlay').classList.add('open');
}

async function loadUpcoming() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await sb
    .from('events')
    .select('*, profiles(display_name, university, ambassador_id, phone)')
    .gte('event_date', today)
    .in('status', ['Approved — Awaiting Link','Approved — Link Sent'])
    .order('event_date', { ascending: true });

  const c = document.getElementById('upcomingContainer');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { c.innerHTML = `<div class="empty-state">No upcoming approved events.</div>`; return; }

  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Event</th><th>Ambassador</th><th>University</th><th>Date</th><th>Status</th></tr></thead>
    <tbody>${data.map(r => `<tr data-id="${esc(r.id)}">
      <td>${esc(r.event_name)} <span style="color:var(--gray);font-size:12px;">(${esc(r.event_id)})</span></td>
      <td>${esc(r.profiles?.display_name||'—')}</td><td>${esc(r.profiles?.university||'—')}</td>
      <td>${fmtDate(r.event_date)}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>`;

  c.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => openD1(tr.dataset.id, data)));
}

async function loadDeadlines() {
  // Deadline and days-left are computed by the database (event_status_view), on the
  // same clock the nightly escalator uses. Do NOT recompute them here — the browser's
  // local date can differ from the system's, and the UI would disagree with reality.
  const { data, error } = await sb
    .from('event_status_view')
    .select('*, profiles(display_name, university, ambassador_id)')
    .eq('status', 'Event Complete — Awaiting Report')
    .order('event_date', { ascending: true });

  const c = document.getElementById('deadlinesContainer');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { c.innerHTML = `<div class="empty-state">No events currently awaiting a report.</div>`; return; }

  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Event</th><th>Ambassador</th><th>Event Date</th><th>D2 Deadline</th><th>Status</th></tr></thead>
    <tbody>${data.map(r => {
      const daysLeft = r.d2_days_left;
      const cls = daysLeft < 0 ? 'row-overdue' : (daysLeft <= 3 ? 'row-soon' : '');
      const label = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`;
      return `<tr class="${cls}"><td>${esc(r.event_name)} <span style="color:var(--gray);font-size:12px;">(${esc(r.event_id)})</span></td>
        <td>${esc(r.profiles?.display_name||'—')}</td><td>${fmtDate(r.event_date)}</td>
        <td>${fmtDate(r.d2_deadline)} <strong>(${label})</strong></td><td>${esc(r.status)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function openD1(id, rows) {
  const ev = rows.find(r => r.id === id);
  if (!ev) return;
  document.getElementById('soTitle').textContent = `${ev.event_name} (${ev.event_id})`;
  document.getElementById('soBody').innerHTML = renderFormResponse(buildD1Sections(ev));
  document.getElementById('slideover').classList.add('open');
  document.getElementById('slideoverOverlay').classList.add('open');
}
