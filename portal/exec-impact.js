/* =========================================
   GCHP Portal — Executive Impact Reports
   Upload per-ambassador, per-cycle PDF → reports bucket,
   create report row, flip completed events to delivered.
   Replace / delete supported (reverts status).
   ========================================= */
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},3000); }
function showError(msg){ const b=document.getElementById('formError'); document.getElementById('formErrorMsg').textContent=msg; b.style.display='flex'; }

let myProfile = null;
let ambassadors = [], cycles = [];

document.addEventListener('gchp:ready', async (e) => {
  myProfile = e.detail.profile;
  const { data: ambs } = await sb.from('profiles').select('id, display_name, university').eq('role','ambassador').order('display_name');
  ambassadors = ambs || [];
  const { data: cyc } = await sb.from('cycles').select('id, cycle_name, is_active').order('start_date', { ascending: false });
  cycles = cyc || [];

  document.getElementById('ambSelect').innerHTML = '<option value="">Select…</option>' + ambassadors.map(a => `<option value="${esc(a.id)}">${esc(a.display_name)} (${esc(a.university||'—')})</option>`).join('');
  document.getElementById('cycleSelect').innerHTML = '<option value="">Select…</option>' + cycles.map(c => `<option value="${esc(c.id)}"${c.is_active?' selected':''}>${esc(c.cycle_name)}</option>`).join('');

  document.getElementById('uploadForm').addEventListener('submit', handleUpload);
  await loadExisting();
});

async function handleUpload(ev) {
  ev.preventDefault();
  document.getElementById('formError').style.display = 'none';
  const ambId = document.getElementById('ambSelect').value;
  const cycleId = document.getElementById('cycleSelect').value;
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim() || null;
  const file = document.getElementById('pdfFile').files[0];
  if (!ambId || !cycleId || !title || !file) { showError('Ambassador, cycle, title and a PDF file are all required.'); return; }

  const btn = document.getElementById('uploadBtn');
  btn.disabled = true; btn.querySelector('span').textContent = 'Uploading...';

  // 1) Upload PDF to the private reports bucket.
  const path = `${ambId}/${cycleId}-${Date.now()}.pdf`;
  const { error: upErr } = await sb.storage.from('reports').upload(path, file, { upsert: false, contentType: 'application/pdf' });
  if (upErr) { btn.disabled=false; btn.querySelector('span').textContent='Upload & Mark Delivered'; showError('Upload failed: '+upErr.message); return; }

  // 2) Create the report row (scoped to this ambassador, flagged impact report).
  const { error: insErr } = await sb.from('reports').insert({
    title, description, file_path: path, cycle_id: cycleId,
    ambassador_id: ambId, is_impact_report: true,
    recipient_scope: 'specific', visible_to: [ambId],
    uploaded_by: myProfile.id,
  });
  if (insErr) { btn.disabled=false; btn.querySelector('span').textContent='Upload & Mark Delivered'; showError('Record failed: '+insErr.message); return; }

  // 3) Flip the ambassador's completed events in this cycle to delivered.
  const { error: rpcErr } = await sb.rpc('apply_impact_report_status', { p_ambassador_id: ambId, p_cycle_id: cycleId });
  if (rpcErr) { toast('Report uploaded, but status update failed: ' + rpcErr.message, 'error'); }

  btn.disabled=false; btn.querySelector('span').textContent='Upload & Mark Delivered';
  toast('Impact report uploaded and events marked delivered.', 'success');
  document.getElementById('uploadForm').reset();
  await loadExisting();
}

async function loadExisting() {
  const { data, error } = await sb.from('reports')
    .select('*, profiles:ambassador_id(display_name), cycles(cycle_name)')
    .eq('is_impact_report', true)
    .order('created_at', { ascending: false });
  const c = document.getElementById('existingContainer');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { c.innerHTML = `<div class="empty-state">No impact reports uploaded yet.</div>`; return; }

  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Title</th><th>Ambassador</th><th>Cycle</th><th>Uploaded</th><th>Actions</th></tr></thead>
    <tbody>${data.map(r=>`<tr style="cursor:default;">
      <td>${esc(r.title)}</td><td>${esc(r.profiles?.display_name||'—')}</td><td>${esc(r.cycles?.cycle_name||'—')}</td>
      <td>${new Date(r.created_at).toLocaleDateString('en-GB')}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn-portal secondary" style="padding:6px 12px;font-size:12px;" data-view="${esc(r.file_path)}">View</button>
        <button class="btn-portal secondary" style="padding:6px 12px;font-size:12px;" data-replace="${esc(r.id)}">Replace</button>
        <button class="btn-portal" style="padding:6px 12px;font-size:12px;background:#b91c1c;" data-delete="${esc(r.id)}" data-amb="${esc(r.ambassador_id)}" data-cycle="${esc(r.cycle_id)}" data-path="${esc(r.file_path)}">Delete</button>
      </td></tr>`).join('')}</tbody></table></div>
    <input type="file" id="replaceFile" accept="application/pdf" style="display:none;" />`;

  c.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => openStoredFile(b.dataset.view, 'reports')));
  c.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteReport(b.dataset)));
  c.querySelectorAll('[data-replace]').forEach(b => b.addEventListener('click', () => startReplace(b.dataset.replace)));
}

async function deleteReport(d) {
  if (!confirm('Delete this impact report? This removes the PDF, hides it from the ambassador, and reverts their events to "Awaiting Impact Report".')) return;
  // 1) Remove the file from storage.
  await sb.storage.from('reports').remove([d.path]);
  // 2) Delete the report row.
  const { error } = await sb.from('reports').delete().eq('id', d.delete);
  if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
  // 3) Revert event statuses.
  await sb.rpc('revert_impact_report_status', { p_ambassador_id: d.amb, p_cycle_id: d.cycle });
  toast('Impact report deleted and statuses reverted.', 'success');
  await loadExisting();
}

let replaceTargetId = null;
function startReplace(reportId) {
  replaceTargetId = reportId;
  const input = document.getElementById('replaceFile');
  input.value = '';
  input.onchange = doReplace;
  input.click();
}

async function doReplace() {
  const file = document.getElementById('replaceFile').files[0];
  if (!file || !replaceTargetId) return;
  // Fetch the existing report to get its path/scope.
  const { data: rep } = await sb.from('reports').select('*').eq('id', replaceTargetId).single();
  if (!rep) { toast('Could not find the report to replace.', 'error'); return; }

  // Upload new file (new path), update row, remove old file. Status already delivered, so no flip needed.
  const newPath = `${rep.ambassador_id}/${rep.cycle_id}-${Date.now()}.pdf`;
  const { error: upErr } = await sb.storage.from('reports').upload(newPath, file, { upsert: false, contentType: 'application/pdf' });
  if (upErr) { toast('Replace upload failed: ' + upErr.message, 'error'); return; }
  const { error: updErr } = await sb.from('reports').update({ file_path: newPath }).eq('id', replaceTargetId);
  if (updErr) { toast('Replace failed: ' + updErr.message, 'error'); return; }
  await sb.storage.from('reports').remove([rep.file_path]); // clean up old file
  toast('Impact report PDF replaced.', 'success');
  replaceTargetId = null;
  await loadExisting();
}
