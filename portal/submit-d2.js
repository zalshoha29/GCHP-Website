/* =========================================
   GCHP Portal — Submit D2 (Post-Event Report)
   ========================================= */

let eligibleEvents = [];

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'portal-toast show ' + type;
  setTimeout(() => { t.className = 'portal-toast ' + type; }, 2800);
}
function showError(msg) {
  const box = document.getElementById('formError');
  document.getElementById('formErrorMsg').textContent = msg;
  box.style.display = 'flex';
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Mobile sidebar
(function () {
  const t = document.getElementById('sidebarToggle'), s = document.getElementById('sidebar');
  if (t && s) t.addEventListener('click', () => s.classList.toggle('open'));
})();

document.addEventListener('gchp:ready', async (e) => {
  const profile = e.detail.profile;
  await loadUnreadBadge(profile.id);
  await loadEligible(profile);
  document.getElementById('d2Form').addEventListener('submit', (ev) => handleSubmit(ev, profile));
});

async function loadUnreadBadge(userId) {
  const count = await getUnreadCount(userId);
  const badge = document.getElementById('msgBadge');
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
}

async function loadEligible(profile) {
  const today = new Date().toISOString().split('T')[0];

  // Eligible: own events, status in the two reportable states, event date passed,
  // and no existing post_report. We pull post_reports(id) to filter client-side.
  const { data, error } = await sb
    .from('events')
    .select('id, event_id, event_name, event_date, status, post_reports(id)')
    .eq('ambassador_id', profile.id)
    .in('status', ['Approved — Link Sent', 'Event Complete — Awaiting Report'])
    .lt('event_date', today)
    .order('event_date', { ascending: true });

  if (error) { showError('Could not load your events: ' + error.message); return; }

  eligibleEvents = (data || []).filter(ev => !ev.post_reports || ev.post_reports.length === 0);

  if (!eligibleEvents.length) {
    document.getElementById('noEligible').style.display = 'block';
    return;
  }

  const sel = document.getElementById('eventSelect');
  sel.innerHTML = eligibleEvents.map(ev =>
    `<option value="${esc(ev.id)}">${esc(ev.event_name)} (${esc(ev.event_id)}) — ${esc(ev.event_date)}</option>`
  ).join('');

  document.getElementById('selectorWrap').style.display = 'block';
  document.getElementById('d2Form').style.display = 'block';
}

async function handleSubmit(ev, profile) {
  ev.preventDefault();
  document.getElementById('formError').style.display = 'none';

  const eventId = document.getElementById('eventSelect').value;
  if (!eventId) { showError('Please select an event.'); return; }

  const totalRaised = document.getElementById('total_raised').value;
  if (totalRaised === '') { showError('Total Amount Raised is required.'); return; }

  const donationsSubmitted = document.getElementById('donations_submitted').value;
  if (donationsSubmitted === '') { showError('Please confirm whether you have submitted the donations.'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.querySelector('span').textContent = 'Submitting...';

  // Optional photo upload to the private submissions bucket.
  let photoPath = null;
  const fileInput = document.getElementById('photo_file');
  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/${eventId}-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('submissions').upload(path, file, { upsert: false });
    if (upErr) {
      btn.disabled = false; btn.querySelector('span').textContent = 'Submit Report';
      showError('Photo upload failed: ' + upErr.message);
      return;
    }
    photoPath = path;
  }

  const num = (id) => { const v = document.getElementById(id).value; return v === '' ? null : Number(v); };
  const txt = (id) => { const v = document.getElementById(id).value.trim(); return v === '' ? null : v; };
  const boolSel = (id) => { const v = document.getElementById(id).value; return v === '' ? null : v === 'true'; };

  const payload = {
    event_id: eventId,
    ambassador_id: profile.id,
    total_raised: Number(totalRaised),
    donations_submitted: donationsSubmitted === 'true',
    attendance: num('attendance'),
    target_met: txt('target_met'),
    what_went_well: txt('what_went_well'),
    what_to_change: txt('what_to_change'),
    advice_for_others: txt('advice_for_others'),
    run_another_event: boolSel('run_another_event'),
    photo_url: photoPath,
    photo_permission: document.getElementById('photo_permission').checked,
    experience_rating: num('experience_rating'),
    open_feedback: txt('open_feedback'),
  };

  // The on_d2_submitted trigger updates the event status automatically.
  const { error } = await sb.from('post_reports').insert(payload);

  if (error) {
    btn.disabled = false; btn.querySelector('span').textContent = 'Submit Report';
    showError('Submission failed: ' + error.message);
    return;
  }

  toast('Your post-event report has been submitted. Thank you!', 'success');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 1700);
}
