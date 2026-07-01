/* =========================================
   GCHP Portal — Executive Data Editor + Audit Log
   Search/view Events or Ambassadors. Read-only until
   "Enable editing" is ticked. Every change is written to
   manual_data_changes BEFORE the update is applied.
   No role switching is ever permitted.
   ========================================= */
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},2800); }

let currentRecord = null, currentTable = 'events', myProfile = null;
let lastSearchTerm = '';   // remembers the last search so "Back" restores it

// Return from a record's editor to the results list.
function goBack() {
  currentRecord = null;
  document.getElementById('editPanel').innerHTML = '';
  const input = document.getElementById('searchInput');
  if (lastSearchTerm) { input.value = lastSearchTerm; doSearch(); }
  else loadAll();
}

// Editable fields per table. NOTE: profiles deliberately excludes `role`.
const EVENT_FIELDS = [
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
];
const PROFILE_FIELDS = [
  { f:'display_name', label:'Full Name', t:'text' },
  { f:'university', label:'University', t:'text' },
  { f:'phone', label:'Phone', t:'text' },
  { f:'ambassador_id', label:'Ambassador ID', t:'text' },
  { f:'status', label:'Participation Status', t:'select', opts:['active','inactive'] },
  { f:'inactive_until', label:'Inactive Until (blank = indefinite)', t:'date' },
  { f:'internal_notes', label:'Internal Notes (executive-only)', t:'text' },
];
function fieldsFor(table){ return table === 'events' ? EVENT_FIELDS : PROFILE_FIELDS; }
function editingEnabled(){ return document.getElementById('enableEditing').checked; }

document.addEventListener('gchp:ready', async (e) => {
  myProfile = e.detail.profile;
  document.getElementById('searchBtn').addEventListener('click', doSearch);
  document.getElementById('searchInput').addEventListener('keydown', ev => { if (ev.key==='Enter') doSearch(); });
  document.getElementById('searchMode').addEventListener('change', onModeChange);
  document.getElementById('enableEditing').addEventListener('change', () => { if (currentRecord) openEditor(currentRecord); });
  document.getElementById('auditToggle').addEventListener('click', toggleAudit);
  document.getElementById('reasonCancel').addEventListener('click', () => document.getElementById('reasonModal').classList.remove('open'));
  document.getElementById('reasonConfirm').addEventListener('click', confirmSave);
  updatePlaceholder();
  await loadAll();
});

function onModeChange() {
  currentTable = document.getElementById('searchMode').value;
  currentRecord = null;
  lastSearchTerm = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('editPanel').innerHTML = '';
  updatePlaceholder();
  loadAll();
}
function updatePlaceholder() {
  document.getElementById('searchInput').placeholder =
    currentTable === 'events' ? 'Search by EVT-### or ambassador name…' : 'Search by ambassador name…';
}

async function loadAll() {
  if (currentTable === 'events') {
    const { data, error } = await sb.from('events')
      .select('*, profiles(display_name, university, ambassador_id, phone), post_reports(*)')
      .order('date_pre_form_received', { ascending: false }).limit(100);
    if (error) { document.getElementById('searchResults').innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
    renderEventRows(data || []);
  } else {
    const { data, error } = await sb.from('profiles')
      .select('*').eq('role','ambassador').order('display_name').limit(200);
    if (error) { document.getElementById('searchResults').innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
    renderProfileRows(data || []);
  }
}

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  lastSearchTerm = q;
  document.getElementById('editPanel').innerHTML = '';
  if (!q) { await loadAll(); return; }

  if (currentTable === 'events') {
    let query = sb.from('events').select('*, profiles(display_name, university, ambassador_id, phone), post_reports(*)');
    if (/^EVT-/i.test(q)) query = query.ilike('event_id', q);
    else query = query.ilike('profiles.display_name', `%${q}%`);
    const { data, error } = await query.limit(50);
    if (error) { document.getElementById('searchResults').innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
    renderEventRows((data||[]).filter(r => r.profiles));
  } else {
    const { data, error } = await sb.from('profiles').select('*').eq('role','ambassador').ilike('display_name', `%${q}%`).limit(50);
    if (error) { document.getElementById('searchResults').innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
    renderProfileRows(data || []);
  }
}

function renderEventRows(rows) {
  const c = document.getElementById('searchResults');
  if (!rows.length) { c.innerHTML = `<div class="empty-state">No records found.</div>`; return; }
  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>EVT</th><th>Event</th><th>Ambassador</th><th>Status</th></tr></thead>
    <tbody>${rows.map(r=>`<tr data-id="${esc(r.id)}"><td>${esc(r.event_id)}</td><td>${esc(r.event_name)}</td><td>${esc(r.profiles?.display_name||'—')}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody>
  </table></div>`;
  c.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => openEditor(rows.find(r=>r.id===tr.dataset.id))));
}

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

function renderProfileRows(rows) {
  const c = document.getElementById('searchResults');
  if (!rows.length) { c.innerHTML = `<div class="empty-state">No ambassadors found.</div>`; return; }
  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Name</th><th>Ambassador ID</th><th>University</th><th>Status</th></tr></thead>
    <tbody>${rows.map(r=>{
      let statusCell;
      if (r.status === 'inactive') {
        const d = daysSince(r.inactive_since);
        const dur = d === null ? '' : ` · ${d} day${d===1?'':'s'}`;
        const until = r.inactive_until ? ` · until ${esc(r.inactive_until)}` : ' · indefinite';
        statusCell = `<span class="flag-badge" style="background:#fee2e2;color:#b91c1c;">Inactive${dur}${until}</span>`;
      } else {
        statusCell = '<span class="flag-badge" style="background:#dcfce7;color:#15803d;">Active</span>';
      }
      return `<tr data-id="${esc(r.id)}"><td>${esc(r.display_name||'—')}</td><td>${esc(r.ambassador_id||'—')}</td><td>${esc(r.university||'—')}</td><td>${statusCell}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
  c.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => openEditor(rows.find(r=>r.id===tr.dataset.id))));
}

function openEditor(rec) {
  currentRecord = rec;
  document.getElementById('searchResults').innerHTML = '';
  const editable = editingEnabled();
  const fields = fieldsFor(currentTable);
  const title = currentTable === 'events' ? `${esc(rec.event_id)} — ${esc(rec.event_name)}` : esc(rec.display_name || 'Ambassador');

  const body = fields.map(fd => {
    const val = rec[fd.f] ?? '';
    if (!editable) {
      // Read-only view.
      return `<div class="frv-row"><div class="frv-q">${esc(fd.label)}</div><div class="frv-a">${val===''?'<span class="no-answer">Not provided</span>':esc(val)}</div></div>`;
    }
    let input;
    if (fd.t === 'select') {
      input = `<select id="edit_${fd.f}" data-field="${fd.f}">${fd.opts.map(o=>`<option value="${esc(o)}"${String(val)===o?' selected':''}>${esc(o||'—')}</option>`).join('')}</select>`;
    } else {
      input = `<input type="${fd.t}" id="edit_${fd.f}" data-field="${fd.f}" value="${esc(val)}" />`;
    }
    return `<div class="pf-group" id="grp_${fd.f}"><label>${esc(fd.label)} <span style="color:var(--gray);font-weight:400;">(${fd.f})</span></label>${input}</div>`;
  }).join('');

  // Inactivity duration info (profiles only, when inactive) — read-only, auto-managed.
  let inactiveInfo = '';
  if (currentTable === 'profiles' && rec.status === 'inactive') {
    const d = daysSince(rec.inactive_since);
    const since = rec.inactive_since ? new Date(rec.inactive_since).toLocaleDateString('en-GB') : 'unknown';
    inactiveInfo = `<div class="scenario-ref" style="background:#fef2f2;"><strong>Currently inactive${d!==null?` — ${d} day${d===1?'':'s'}`:''}</strong>Inactive since ${since}${rec.inactive_until?` · scheduled to reactivate on ${esc(rec.inactive_until)}`:` · no reactivation date (indefinite)`}</div>`;
  }

  // For a completed event with a submitted D2, show the report read-only below the fields.
  let d2Block = '';
  if (currentTable === 'events' && rec.post_reports && rec.post_reports.length) {
    const r = rec.post_reports[0];
    const d2rows = [
      ['Total Raised ($)', r.total_raised],
      ['Attendance', r.attendance],
      ['Target Met', r.target_met],
      ['Donations Submitted', r.donations_submitted ? 'Yes' : 'No'],
      ['Would Run Another Event', r.run_another_event ? 'Yes' : 'No'],
      ['Experience Rating', r.experience_rating ? `${r.experience_rating} / 5` : ''],
      ['What Went Well', r.what_went_well],
      ['What To Change', r.what_to_change],
      ['Advice For Others', r.advice_for_others],
      ['Open Feedback', r.open_feedback],
      ['Photo', r.photo_url ? 'Uploaded' : 'Not uploaded'],
      ['Report Submitted', r.date_submitted ? new Date(r.date_submitted).toLocaleString('en-GB') : ''],
    ];
    d2Block = `<div class="form-section-block" style="background:#f0fdfa;">
      <h3>Post-Event Report (D2) — submitted</h3>
      ${d2rows.map(([q,a]) => `<div class="frv-row"><div class="frv-q">${esc(q)}</div><div class="frv-a">${a===null||a===undefined||a===''?'<span class="no-answer">Not provided</span>':esc(a)}</div></div>`).join('')}
    </div>`;
  }

  document.getElementById('editPanel').innerHTML = `
    <button class="btn-portal secondary" id="backToResults" style="padding:7px 14px;font-size:13px;margin-bottom:14px;">← Back to results</button>
    <div class="form-section-block">
      <h3>${editable ? 'Editing' : 'Viewing'}: ${title}</h3>
      ${inactiveInfo}
      ${editable
        ? '<p style="font-size:12.5px;color:var(--gray);margin:-8px 0 16px;">Changed fields are highlighted. A reason is required before saving.</p>'
        : '<p style="font-size:12.5px;color:var(--gray);margin:-8px 0 16px;">Read-only. Tick “Enable editing” in the toolbar to make changes.</p>'}
      ${body}
      ${editable ? '<button class="btn-portal" id="saveEdits">Save Changes</button>' : ''}
    </div>
    ${d2Block}`;
  document.getElementById('backToResults').addEventListener('click', goBack);

  if (editable) {
    fields.forEach(fd => {
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
}

function collectChanges() {
  const changes = [];
  fieldsFor(currentTable).forEach(fd => {
    const el = document.getElementById(`edit_${fd.f}`);
    if (!el) return;
    const orig = currentRecord[fd.f];
    const now = el.value;
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

  // 1) Audit rows first (table_name reflects which table is edited).
  const auditRows = changes.map(c => ({
    changed_by: myProfile.id, table_name: currentTable, record_id: currentRecord.id,
    field_name: c.field, old_value: c.oldVal, new_value: c.newVal, change_reason: reason,
  }));
  const { error: auditErr } = await sb.from('manual_data_changes').insert(auditRows);
  if (auditErr) { toast('Audit write failed — change NOT applied: ' + auditErr.message, 'error'); return; }

  // 2) Apply update to the relevant table.
  const patch = {}; changes.forEach(c => { patch[c.field] = c.typedVal; });
  const { error: updErr } = await sb.from(currentTable).update(patch).eq('id', currentRecord.id);
  if (updErr) { toast('Update failed (audit already recorded): ' + updErr.message, 'error'); return; }

  document.getElementById('reasonModal').classList.remove('open');
  toast('Changes saved and logged.', 'success');

  // Refresh the record.
  const sel = currentTable === 'events' ? '*, profiles(display_name, university, ambassador_id, phone), post_reports(*)' : '*';
  const { data } = await sb.from(currentTable).select(sel).eq('id', currentRecord.id).single();
  if (data) openEditor(data);
}

async function toggleAudit() {
  const panel = document.getElementById('auditPanel');
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  document.getElementById('editPanel').innerHTML = ''; document.getElementById('searchResults').innerHTML = '';
  panel.style.display = 'block';
  panel.innerHTML = `<div class="empty-state">Loading audit log...</div>`;
  const { data, error } = await sb.from('manual_data_changes').select('*, profiles:changed_by(display_name)').order('changed_at', { ascending: false }).limit(200);
  if (error) { panel.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { panel.innerHTML = `<div class="empty-state">No changes logged yet.</div>`; return; }
  panel.innerHTML = `<div class="portal-section"><h2>Audit Log</h2><div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>When</th><th>By</th><th>Table</th><th>Record</th><th>Field</th><th>Old</th><th>New</th><th>Reason</th></tr></thead>
    <tbody>${data.map(r=>`<tr style="cursor:default;">
      <td>${new Date(r.changed_at).toLocaleString('en-GB')}</td><td>${esc(r.profiles?.display_name||'—')}</td>
      <td>${esc(r.table_name)}</td><td style="font-size:11px;">${esc(r.record_id)}</td>
      <td>${esc(r.field_name)}</td><td>${esc(r.old_value||'—')}</td><td>${esc(r.new_value||'—')}</td>
      <td>${esc(r.change_reason)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
