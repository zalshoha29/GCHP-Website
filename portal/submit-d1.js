/* =========================================
   GCHP Portal — Submit / Resubmit D1
   ========================================= */

let activeCycle = null;
let resubmitId = null;       // event id when in resubmit mode
let resubmitEvent = null;

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'portal-toast show ' + type;
  setTimeout(() => { t.className = 'portal-toast ' + type; }, 2600);
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

// Conditional UI: Activity "Other"
document.getElementById('activity_type').addEventListener('change', (e) => {
  document.getElementById('activityOtherWrap').style.display = e.target.value === 'Other' ? 'flex' : 'none';
});
// Conditional UI: "Other" promotion channel reveals a free-text field.
document.getElementById('promoOther').addEventListener('change', (e) => {
  document.getElementById('promoOtherWrap').style.display = e.target.checked ? 'block' : 'none';
  if (!e.target.checked) document.getElementById('promotion_other').value = '';
});

document.addEventListener('gchp:ready', async (e) => {
  const profile = e.detail.profile;
  await loadUnreadBadge(profile.id);

  activeCycle = await getActiveCycle();
  if (!activeCycle) {
    showError('There is no active fundraising cycle right now, so you cannot submit an event plan. Please check back later.');
    document.getElementById('submitBtn').disabled = true;
    return;
  }

  // Prefill read-only Section A
  document.getElementById('campaign_cycle').value = activeCycle.cycle_name;
  document.getElementById('university').value = profile.university || '—';

  // Resubmit mode?
  const params = new URLSearchParams(window.location.search);
  resubmitId = params.get('resubmit');
  if (resubmitId) await enterResubmitMode(profile);

  document.getElementById('d1Form').addEventListener('submit', (ev) => handleSubmit(ev, profile));
});

async function loadUnreadBadge(userId) {
  const count = await getUnreadCount(userId);
  const badge = document.getElementById('msgBadge');
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
}

async function enterResubmitMode(profile) {
  const { data, error } = await sb.from('events').select('*').eq('id', resubmitId).single();
  if (error || !data) { showError('Could not load the event to resubmit.'); return; }

  // Guard: only denied events, and only once.
  if (data.status !== 'Denied') {
    showError('This event is not in a state that can be resubmitted.');
    document.getElementById('submitBtn').disabled = true;
    return;
  }
  if (data.resubmission_count >= 1) {
    showError('This submission has already been resubmitted once. Please contact the GCHP team directly to discuss further.');
    document.getElementById('submitBtn').disabled = true;
    return;
  }

  resubmitEvent = data;
  document.getElementById('formTitle').textContent = 'Edit & Resubmit Event Plan';
  document.getElementById('formSub').textContent = 'Update your submission and resubmit it for review.';
  document.getElementById('formCrumb').textContent = 'Edit & Resubmit';
  document.getElementById('submitBtn').querySelector('span').textContent = 'Resubmit Event Plan';
  if (data.denial_reason) {
    document.getElementById('resubmitBanner').innerHTML =
      `<div class="resubmit-notice"><strong>Previous denial reason:</strong> ${esc(data.denial_reason)}</div>`;
  }

  // Prefill all fields
  setVal('event_name', data.event_name);
  const knownTypes = ['Bake Sale','Quiz Night','Sports Event','Auction','Raffle','Concert/Performance','Art Sale','Sponsored Challenge','Film Night','Market Stall','Gala/Dinner','Online Campaign'];
  if (data.activity_type && !knownTypes.includes(data.activity_type)) {
    setVal('activity_type', 'Other');
    document.getElementById('activityOtherWrap').style.display = 'flex';
    setVal('activity_type_other', data.activity_type);
  } else {
    setVal('activity_type', data.activity_type || '');
  }
  setVal('event_date', data.event_date);
  setVal('event_location', data.event_location);
  setVal('event_format', data.event_format || '');
  setVal('description', data.description);
  setVal('expected_attendance', data.expected_attendance);
  setVal('volunteer_count', data.volunteer_count);
  setVal('fundraising_target', data.fundraising_target);
  (data.promotion_channels || []).forEach(ch => {
    const cb = document.querySelector(`#promoChannels input[value="${ch}"]`);
    if (cb) cb.checked = true;
  });
  setVal('support_requests', data.support_requests);
  setVal('comments', data.comments);
}

function setVal(id, v) { const el = document.getElementById(id); if (el && v !== null && v !== undefined) el.value = v; }

function gatherForm(profile) {
  let activity = document.getElementById('activity_type').value;
  if (activity === 'Other') activity = document.getElementById('activity_type_other').value.trim() || 'Other';

  // Promotion channels; if "Other" is ticked, replace it with the typed value.
  let channels = [...document.querySelectorAll('#promoChannels input:checked')].map(c => c.value);
  if (channels.includes('Other')) {
    const otherText = document.getElementById('promotion_other').value.trim();
    channels = channels.filter(c => c !== 'Other');
    if (otherText) channels.push(otherText);
    else channels.push('Other');
  }

  const num = (id) => { const v = document.getElementById(id).value; return v === '' ? null : Number(v); };
  const txt = (id) => { const v = document.getElementById(id).value.trim(); return v === '' ? null : v; };

  return {
    ambassador_id: profile.id,
    cycle_id: activeCycle.id,
    campaign_cycle: activeCycle.cycle_name,
    university: profile.university,
    event_name: txt('event_name'),
    activity_type: activity || null,
    event_date: txt('event_date'),
    event_location: txt('event_location'),
    event_format: txt('event_format'),
    description: txt('description'),
    expected_attendance: num('expected_attendance'),
    volunteer_count: num('volunteer_count'),
    fundraising_target: num('fundraising_target'),
    promotion_channels: channels.length ? channels : null,
    support_requests: txt('support_requests'),
    comments: txt('comments'),
  };
}

async function handleSubmit(ev, profile) {
  ev.preventDefault();
  document.getElementById('formError').style.display = 'none';

  // Required checkboxes
  if (!document.getElementById('confirm_guide').checked || !document.getElementById('confirm_nopromo').checked) {
    showError('Please confirm both checkboxes in Section E before submitting.');
    return;
  }
  // Required fields
  const data = gatherForm(profile);
  if (!data.event_name) { showError('Event Name is required.'); return; }
  if (!data.event_date) { showError('Event Date is required.'); return; }
  // Future date
  const today = new Date(); today.setHours(0,0,0,0);
  if (new Date(data.event_date + 'T00:00:00') < today) {
    showError('Event Date must be in the future.'); return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.querySelector('span').textContent = 'Submitting...';

  let error;
  if (resubmitId) {
    // Update existing row, flag as resubmission.
    ({ error } = await sb.from('events').update({
      ...data,
      status: 'Resubmitted — Pending Review',
      is_resubmission: true,
      resubmission_count: (resubmitEvent.resubmission_count || 0) + 1,
    }).eq('id', resubmitId));
  } else {
    // New submission. event_id is generated by the DB trigger; do not set it here.
    ({ error } = await sb.from('events').insert({
      ...data,
      status: 'Submitted — Pending Review',
    }));
  }

  if (error) {
    btn.disabled = false; btn.querySelector('span').textContent = resubmitId ? 'Resubmit Event Plan' : 'Submit Event Plan';
    showError('Submission failed: ' + error.message);
    return;
  }

  toast('Your event plan has been received. GCHP will review it within 3 business days.', 'success');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 1600);
}
