/* =========================================
   GCHP Portal — Executive Manage Materials
   Upload any-file-type material per cycle; list/delete.
   ========================================= */
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},2800); }
function showError(msg){ const b=document.getElementById('formError'); document.getElementById('formErrorMsg').textContent=msg; b.style.display='flex'; }
function fmtDate(d){ return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

let myProfile = null, cycles = [];

document.addEventListener('gchp:ready', async (e) => {
  myProfile = e.detail.profile;
  const { data: cyc } = await sb.from('cycles').select('id, cycle_name, is_active').order('start_date', { ascending: false });
  cycles = cyc || [];
  const opts = cycles.map(c => `<option value="${esc(c.id)}"${c.is_active?' selected':''}>${esc(c.cycle_name)}${c.is_active?' (active)':''}</option>`).join('');
  document.getElementById('cycleSelect').innerHTML = opts;
  document.getElementById('filterCycle').innerHTML = opts;

  document.getElementById('uploadForm').addEventListener('submit', handleUpload);
  document.getElementById('filterCycle').addEventListener('change', loadExisting);
  await loadExisting();
});

async function handleUpload(ev) {
  ev.preventDefault();
  document.getElementById('formError').style.display = 'none';
  const cycleId = document.getElementById('cycleSelect').value;
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim() || null;
  const file = document.getElementById('file').files[0];
  if (!cycleId || !title || !file) { showError('Cycle, title and a file are all required.'); return; }

  const btn = document.getElementById('uploadBtn');
  btn.disabled = true; btn.querySelector('span').textContent = 'Uploading...';

  // Preserve original filename for download; store under cycle folder.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${cycleId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await sb.storage.from('materials').upload(path, file, { upsert: false });
  if (upErr) { btn.disabled=false; btn.querySelector('span').textContent='Upload Material'; showError('Upload failed: '+upErr.message); return; }

  const { error: insErr } = await sb.from('materials').insert({
    title, description, file_path: path, file_name: file.name,
    cycle_id: cycleId, uploaded_by: myProfile.id,
  });
  if (insErr) { btn.disabled=false; btn.querySelector('span').textContent='Upload Material'; showError('Record failed: '+insErr.message); return; }

  btn.disabled=false; btn.querySelector('span').textContent='Upload Material';
  toast('Material uploaded.', 'success');
  document.getElementById('uploadForm').reset();
  // Reset cycle selects to active default after form reset.
  const active = cycles.find(c => c.is_active);
  if (active) document.getElementById('cycleSelect').value = active.id;
  await loadExisting();
}

async function loadExisting() {
  const cycleId = document.getElementById('filterCycle').value;
  const { data, error } = await sb.from('materials')
    .select('*').eq('cycle_id', cycleId).order('created_at', { ascending: false });
  const c = document.getElementById('existingContainer');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { c.innerHTML = `<div class="empty-state">No materials uploaded for this cycle yet.</div>`; return; }

  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Title</th><th>File</th><th>Description</th><th>Added</th><th>Actions</th></tr></thead>
    <tbody>${data.map(m=>`<tr style="cursor:default;">
      <td><strong>${esc(m.title)}</strong></td><td style="font-size:12px;color:var(--gray);">${esc(m.file_name||'—')}</td>
      <td>${esc(m.description||'—')}</td><td>${fmtDate(m.created_at)}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn-portal secondary" style="padding:6px 12px;font-size:12px;" data-dl="${esc(m.file_path)}" data-name="${esc(m.file_name||m.title)}">Download</button>
        <button class="btn-portal" style="padding:6px 12px;font-size:12px;background:#b91c1c;" data-del="${esc(m.id)}" data-path="${esc(m.file_path)}">Delete</button>
      </td></tr>`).join('')}</tbody></table></div>`;

  c.querySelectorAll('[data-dl]').forEach(b => b.addEventListener('click', async () => {
    const { data: signed, error } = await sb.storage.from('materials').createSignedUrl(b.dataset.dl, 3600);
    if (error) { toast('Download failed: '+error.message, 'error'); return; }
    window.open(signed.signedUrl, '_blank', 'noopener');
  }));
  c.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this material? Ambassadors will no longer see it.')) return;
    await sb.storage.from('materials').remove([b.dataset.path]);
    const { error } = await sb.from('materials').delete().eq('id', b.dataset.del);
    if (error) { toast('Delete failed: '+error.message, 'error'); return; }
    toast('Material deleted.', 'success');
    await loadExisting();
  }));
}
