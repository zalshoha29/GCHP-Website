/* =========================================
   GCHP Portal — Executive Data Editor + Audit Log
   Editable event fields; every change is written to
   manual_data_changes BEFORE the update is applied.
   ========================================= */
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},2800); }

let currentRecord = null;
let myProfile = null;

// Editable fields (label + type). Admin/status fields included but flagged.
const EDITABLE = [
  { f:'event_name', label:'Event Name', t:'text' },
  { f:'activity_type', label:'Activity Type', t:'text' },
  { f:'event_date', label:'Event Date', t:'date' },
  { f:'event_location', label:'Location', t:'text' },
  { f:'fundraising_target', label:'Fundraising Target ($)', t:'number' },
  { f:'fundraising_link', label:'Fundraising Link', t:'text' },
  { f:'fundraising_code', label:'Fundraising Code', t:'text' },
  { f:'status', label:'Status', t:'select', opts:[
    'Submitted — Pending Review','Resubmitted — Pending Review','Approved — Awaiting Link','Approved — Link Sent',
    'Event Complete — Awaiting Report','Completed — Awaiting Impact Report','Complete — Impact Report Delivered',
    'Incomplete — No Report','Cancelled','Denied'] },
  { f:'scenario', label:'Scenario', t:'select', opts:['','A','B','C Track 1','C Track 2'] },
  { f:'promotion_status', label:'Promotion Status', t:'select', opts:['','On Track','Check Needed','Not Started'] },
];

document.addEventListener('gchp:ready', async (e) => {
  myProfile = e.detail.profile;
  document.getElementById('searchBtn').addEventListener('click', doSearch);
  document.getElementById('searchInput').addEventListener('keydown', ev => { if (ev.key==='Enter') doSearch(); });
  document.getElementById('auditToggle').addEventListener('click', toggleAudit);
  document.getElementById('reasonCancel').addEventListener('click', () => document.getElementById('reasonModal').classList.remove('open'));
  document.getElementById('reasonConfirm').addEventListener('click', confirmSave);
  await loadAllEvents(); // auto-load on open
});

// Load all events (no search term) so the editor is populated immediately.
async function loadAllEvents() {
  const { data, error } = await sb.from('events')
    .select('*, profiles(display_name, university, ambassador_id)')
    .order('date_pre_form_received', { ascending: false })
    .limit(100);
  const c = document.getElementById('searchResults');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  renderResultRows(data || []);
}

function renderResultRows(rows) {
  const c = document.getElementById('searchResults');
  if (!rows.length) { c.innerHTML = `<div class="empty-state">No records found.</div>`; return; }
  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>EVT</th><th>Event</th><th>Ambassador</th><th>Status</th></tr></thead>
    <tbody>${rows.map(r=>`<tr data-id="${esc(r.id)}"><td>${esc(r.event_id)}</td><td>${esc(r.event_name)}</td><td>${esc(r.profiles?.display_name||'—')}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody>
  </table></div>`;
  c.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => openEditor(rows.find(r=>r.id===tr.dataset.id))));
}

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  document.getElementById('editPanel').innerHTML = '';
  if (!q) { await loadAllEvents(); return; }  // empty search → show all

  let query = sb.from('events').select('*, profiles(display_name, university, ambassador_id)');
  if (/^EVT-/i.test(q)) query = query.ilike('event_id', q);
  else query = query.ilike('profiles.display_name', `%${q}%`);

  const { data, error } = await query.limit(50);
  const c = document.getElementById('searchResults');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  const rows = (data||[]).filter(r => r.profiles);
  renderResultRows(rows);
}

function openEditor(rec) {
  currentRecord = rec;
  document.getElementById('searchResults').innerHTML = '';
  const fields = EDITABLE.map(fd => {
    const val = rec[fd.f] ?? '';
    let input;
    if (fd.t === 'select') {
      input = `<select id="edit_${fd.f}" data-field="${fd.f}">${fd.opts.map(o=>`<option value="${esc(o)}"${String(val)===o?' selected':''}>${esc(o||'—')}</option>`).join('')}</select>`;
    } else {
      input = `<input type="${fd.t}" id="edit_${fd.f}" data-field="${fd.f}" value="${esc(val)}" />`;
    }
    return `<div class="pf-group" id="grp_${fd.f}"><label>${esc(fd.label)} <span style="color:var(--gray);font-weight:400;">(${fd.f})</span></label>${input}</div>`;
  }).join('');

  document.getElementById('editPanel').innerHTML = `
    <div class="form-section-block">
      <h3>Editing ${esc(rec.event_id)} — ${esc(rec.event_name)}</h3>
      <p style="font-size:12.5px;color:var(--gray);margin:-8px 0 16px;">Changed fields are highlighted. A reason is required before saving.</p>
      ${fields}
      <button class="btn-portal" id="saveEdits">Save Changes</button>
    </div>`;

  // Highlight changed fields live.
  EDITABLE.forEach(fd => {
    const el = document.getElementById(`edit_${fd.f}`);
    el.addEventListener('input', () => {
      const orig = String(currentRecord[fd.f] ?? '');
      document.getElementById(`grp_${fd.f}`).classList.toggle('field-edited', el.value !== orig);
    });
  });
  document.getElementById('saveEdits').addEventListener('click', () => {
    if (collectChanges().length === 0) { toast('No changes to save.', 'error'); return; }
    document.getElementById('reasonText').value = '';
    document.getElementById('reasonModal').classList.add('open');
  });
}

function collectChanges() {
  const changes = [];
  EDITABLE.forEach(fd => {
    const el = document.getElementById(`edit_${fd.f}`);
    if (!el) return;
    const orig = currentRecord[fd.f];
    let now = el.value;
    const origStr = orig === null || orig === undefined ? '' : String(orig);
    if (now !== origStr) {
      let typed = now;
      if (fd.t === 'number') typed = now === '' ? null : Number(now);
      if (now === '' && fd.t !== 'number') typed = null;
      changes.push({ field: fd.f, oldVal: origStr, newVal: now, typedVal: typed });
    }
  });
  return changes;
}

async function confirmSave() {
  const reason = document.getElementById('reasonText').value.trim();
  if (!reason) { toast('A reason is required.', 'error'); return; }
  const changes = collectChanges();
  if (!changes.length) { document.getElementById('reasonModal').classList.remove('open'); return; }

  // 1) Write one audit row per changed field FIRST.
  const auditRows = changes.map(c => ({
    changed_by: myProfile.id,
    table_name: 'events',
    record_id: currentRecord.id,
    field_name: c.field,
    old_value: c.oldVal,
    new_value: c.newVal,
    change_reason: reason,
  }));
  const { error: auditErr } = await sb.from('manual_data_changes').insert(auditRows);
  if (auditErr) { toast('Audit log write failed — change NOT applied: ' + auditErr.message, 'error'); return; }

  // 2) Apply the update only after the audit succeeds.
  const patch = {}; changes.forEach(c => { patch[c.field] = c.typedVal; });
  const { error: updErr } = await sb.from('events').update(patch).eq('id', currentRecord.id);
  if (updErr) { toast('Update failed (audit already recorded): ' + updErr.message, 'error'); return; }

  document.getElementById('reasonModal').classList.remove('open');
  toast('Changes saved and logged.', 'success');
  // Refresh the record + editor.
  const { data } = await sb.from('events').select('*, profiles(display_name, university, ambassador_id)').eq('id', currentRecord.id).single();
  if (data) openEditor(data);
}

async function toggleAudit() {
  const panel = document.getElementById('auditPanel');
  const editPanel = document.getElementById('editPanel');
  const results = document.getElementById('searchResults');
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  editPanel.innerHTML = ''; results.innerHTML = '';
  panel.style.display = 'block';
  panel.innerHTML = `<div class="empty-state">Loading audit log...</div>`;

  const { data, error } = await sb.from('manual_data_changes').select('*, profiles:changed_by(display_name)').order('changed_at', { ascending: false }).limit(200);
  if (error) { panel.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { panel.innerHTML = `<div class="empty-state">No changes logged yet.</div>`; return; }

  panel.innerHTML = `<div class="portal-section"><h2>Audit Log</h2><div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>When</th><th>By</th><th>Table</th><th>Record</th><th>Field</th><th>Old</th><th>New</th><th>Reason</th></tr></thead>
    <tbody>${data.map(r=>`<tr style="cursor:default;">
      <td>${new Date(r.changed_at).toLocaleString('en-GB')}</td>
      <td>${esc(r.profiles?.display_name||'—')}</td>
      <td>${esc(r.table_name)}</td><td style="font-size:11px;">${esc(r.record_id)}</td>
      <td>${esc(r.field_name)}</td><td>${esc(r.old_value||'—')}</td><td>${esc(r.new_value||'—')}</td>
      <td>${esc(r.change_reason)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
