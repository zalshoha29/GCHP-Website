/* =========================================
   GCHP Portal — Executive Send Message
   Two modes: individual search (default) or group filters (toggle).
   ========================================= */
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},2800); }
function showError(msg){ const b=document.getElementById('formError'); document.getElementById('formErrorMsg').textContent=msg; b.style.display='flex'; }

let myProfile = null;
let activeCycle = null;
let allAmbassadors = [];          // {id, display_name, university}
let selected = new Map();         // id -> display_name (individual mode)

document.addEventListener('gchp:ready', async (e) => {
  myProfile = e.detail.profile;
  activeCycle = await getActiveCycle();

  const { data: profs } = await sb.from('profiles').select('id, display_name, university').eq('role','ambassador');
  allAmbassadors = profs || [];

  const unis = [...new Set(allAmbassadors.map(p => p.university).filter(Boolean))].sort();
  document.getElementById('universitySelect').innerHTML = unis.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');

  document.getElementById('useFilter').addEventListener('change', onModeToggle);
  document.getElementById('recipientFilter').addEventListener('change', onFilterChange);
  document.getElementById('universitySelect').addEventListener('change', updateCount);
  document.getElementById('recipientSearch').addEventListener('input', onSearchType);
  document.getElementById('msgForm').addEventListener('submit', handleSend);
  await updateCount();
});

function onModeToggle() {
  const useFilter = document.getElementById('useFilter').checked;
  document.getElementById('filterMode').style.display = useFilter ? 'block' : 'none';
  document.getElementById('individualMode').style.display = useFilter ? 'none' : 'block';
  updateCount();
}

/* ---------- Individual search mode ---------- */
function onSearchType() {
  const q = document.getElementById('recipientSearch').value.trim().toLowerCase();
  const box = document.getElementById('searchResults');
  if (!q) { box.innerHTML = ''; return; }
  const matches = allAmbassadors.filter(a =>
    (a.display_name||'').toLowerCase().includes(q) && !selected.has(a.id)
  ).slice(0, 8);
  if (!matches.length) { box.innerHTML = `<div class="pf-hint">No matches.</div>`; return; }
  box.innerHTML = matches.map(a =>
    `<div class="search-pick" data-id="${esc(a.id)}" data-name="${esc(a.display_name)}" style="padding:8px 12px;border:1px solid var(--gray-mid);border-radius:7px;margin-bottom:4px;cursor:pointer;font-size:13.5px;">
      ${esc(a.display_name)} <span style="color:var(--gray);">— ${esc(a.university||'—')}</span></div>`
  ).join('');
  box.querySelectorAll('.search-pick').forEach(el => el.addEventListener('click', () => {
    selected.set(el.dataset.id, el.dataset.name);
    document.getElementById('recipientSearch').value = '';
    box.innerHTML = '';
    renderSelected();
    updateCount();
  }));
}

function renderSelected() {
  const box = document.getElementById('selectedRecipients');
  if (!selected.size) { box.innerHTML = '<div class="pf-hint">No recipients selected yet.</div>'; return; }
  box.innerHTML = [...selected.entries()].map(([id,name]) =>
    `<span class="flag-badge flag-resub" style="display:inline-flex;align-items:center;gap:6px;margin:2px;padding:5px 10px;">
      ${esc(name)} <button data-remove="${esc(id)}" style="background:none;border:none;cursor:pointer;color:inherit;font-weight:700;">×</button></span>`
  ).join('');
  box.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
    selected.delete(b.dataset.remove); renderSelected(); updateCount();
  }));
}

/* ---------- Filter mode ---------- */
function onFilterChange() {
  document.getElementById('uniWrap').style.display =
    document.getElementById('recipientFilter').value === 'university' ? 'flex' : 'none';
  updateCount();
}

async function resolveFilterRecipients() {
  const filter = document.getElementById('recipientFilter').value;
  if (filter === 'all') return allAmbassadors.map(p => p.id);
  if (filter === 'university') {
    const uni = document.getElementById('universitySelect').value;
    return allAmbassadors.filter(p => p.university === uni).map(p => p.id);
  }
  if (filter === 'first_time') {
    const { data: allEv } = await sb.from('events').select('ambassador_id, cycle_id');
    const priorAmb = new Set((allEv||[]).filter(e => e.cycle_id !== activeCycle?.id).map(e => e.ambassador_id));
    return allAmbassadors.map(p => p.id).filter(id => !priorAmb.has(id));
  }
  if (filter === 'overdue_d2') {
    // Overdue state comes from the database (event_status_view), computed on the same
    // clock as the nightly escalator. Previously this was recomputed here in JS, which
    // meant the recipient list could disagree with the system's own view of "overdue".
    const { data: evs } = await sb
      .from('event_status_view')
      .select('ambassador_id, is_d2_overdue')
      .eq('is_d2_overdue', true);
    return [...new Set((evs || []).map(e => e.ambassador_id))];
  }
  return [];
}

async function currentRecipients() {
  if (document.getElementById('useFilter').checked) return await resolveFilterRecipients();
  return [...selected.keys()];
}

async function updateCount() {
  const ids = await currentRecipients();
  document.getElementById('recipientCount').textContent =
    `${ids.length} recipient${ids.length===1?'':'s'} will receive this message.`;
  if (!document.getElementById('useFilter').checked) renderSelected();
}

async function handleSend(ev) {
  ev.preventDefault();
  document.getElementById('formError').style.display = 'none';
  const subject = document.getElementById('subject').value.trim();
  const body = document.getElementById('body').value.trim();
  if (!subject || !body) { showError('Subject and body are required.'); return; }

  const ids = await currentRecipients();
  if (!ids.length) { showError('No recipients selected.'); return; }

  const btn = document.getElementById('sendBtn');
  btn.disabled = true; btn.querySelector('span').textContent = 'Sending...';

  const rows = ids.map(rid => ({ recipient_id: rid, sent_by: myProfile.id, subject, body, message_type: 'manual' }));
  const { error } = await sb.from('messages').insert(rows);

  if (error) { btn.disabled=false; btn.querySelector('span').textContent='Send Message'; showError('Send failed: '+error.message); return; }

  toast(`Message sent to ${ids.length} recipient${ids.length===1?'':'s'}.`, 'success');
  document.getElementById('msgForm').reset();
  selected.clear(); renderSelected();
  document.getElementById('uniWrap').style.display = 'none';
  document.getElementById('filterMode').style.display = 'none';
  document.getElementById('individualMode').style.display = 'block';
  btn.disabled=false; btn.querySelector('span').textContent='Send Message';
  await updateCount();
}
