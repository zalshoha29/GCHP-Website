/* =========================================
   GCHP Portal — Ambassador Fundraising Materials
   Shows the active cycle's materials; download via signed URL.
   ========================================= */
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},2600); }
function fmtDate(d){ return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

document.addEventListener('gchp:ready', async (e) => {
  await loadUnreadBadge(e.detail.profile.id);
  await loadMaterials();
});
async function loadUnreadBadge(userId){ const c=await getUnreadCount(userId); const b=document.getElementById('msgBadge'); if(c>0){b.textContent=c;b.style.display='inline-block';} }

async function loadMaterials() {
  const container = document.getElementById('materialsContainer');
  const cycle = await getActiveCycle();
  if (!cycle) { container.innerHTML = `<div class="empty-state">No active cycle, so no materials are available right now.</div>`; return; }

  const { data, error } = await sb.from('materials')
    .select('*').eq('cycle_id', cycle.id).order('created_at', { ascending: false });
  if (error) { container.innerHTML = `<div class="empty-state">Could not load materials: ${esc(error.message)}</div>`; return; }
  if (!data || !data.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 48 48" fill="none" width="48" height="48"><path d="M8 12 C8 10 9 9 11 9 L20 9 L24 14 L38 14 C40 14 41 15 41 17 L41 37 C41 39 40 40 38 40 L11 40 C9 40 8 39 8 37 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      <p>No materials have been uploaded for this cycle yet.<br>Check back soon — GCHP will share resources here.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="event-grid">${data.map(m => `
    <div class="event-card">
      <div class="event-card-head"><h3>${esc(m.title)}</h3></div>
      ${m.description ? `<div class="ec-meta">${esc(m.description)}</div>` : ''}
      ${m.file_name ? `<div class="ec-meta" style="color:var(--gray);">${esc(m.file_name)}</div>` : ''}
      <div class="ec-meta" style="color:var(--gray);">Added ${fmtDate(m.created_at)}</div>
      <button class="btn-portal" style="padding:9px 16px;font-size:13px;align-self:flex-start;" data-download="${esc(m.file_path)}" data-name="${esc(m.file_name||m.title)}">Download</button>
    </div>`).join('')}</div>`;

  container.querySelectorAll('[data-download]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: signed, error } = await sb.storage.from('materials').createSignedUrl(btn.dataset.download, 3600);
      if (error) { toast('Could not download: ' + error.message, 'error'); return; }
      window.open(signed.signedUrl, '_blank', 'noopener');
    });
  });
}
