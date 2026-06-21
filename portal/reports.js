/* =========================================
   GCHP Portal — Ambassador Impact Reports
   ========================================= */
function toast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'portal-toast show ' + type;
  setTimeout(() => { t.className = 'portal-toast ' + type; }, 2600);
}
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();

document.addEventListener('gchp:ready', async (e) => {
  await loadUnreadBadge(e.detail.profile.id);
  await loadReports();
});

async function loadUnreadBadge(userId){
  const c = await getUnreadCount(userId);
  const b = document.getElementById('msgBadge');
  if (c>0){ b.textContent=c; b.style.display='inline-block'; }
}

function fmtDate(d){ return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

async function loadReports() {
  const container = document.getElementById('reportsContainer');
  // RLS automatically scopes to reports visible to this ambassador.
  const { data, error } = await sb.from('reports').select('*').order('created_at', { ascending: false });

  if (error) { container.innerHTML = `<div class="empty-state">Could not load reports: ${esc(error.message)}</div>`; return; }
  if (!data || !data.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 48 48" fill="none" width="48" height="48"><rect x="10" y="6" width="28" height="36" rx="3" stroke="currentColor" stroke-width="2"/><path d="M17 16 H31 M17 23 H31 M17 30 H26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <p>No impact reports have been published to you yet.<br>They'll appear here once GCHP shares them.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="event-grid">${data.map(r => `
    <div class="event-card">
      <div class="event-card-head"><h3>${esc(r.title)}</h3></div>
      ${r.description ? `<div class="ec-meta">${esc(r.description)}</div>` : ''}
      <div class="ec-meta">Published ${fmtDate(r.created_at)}</div>
      <div style="display:flex;gap:8px;margin-top:6px;">
        <button class="btn-portal" style="padding:8px 16px;font-size:13px;" data-view="${esc(r.file_path)}">View</button>
        <button class="btn-portal secondary" style="padding:8px 16px;font-size:13px;" data-download="${esc(r.file_path)}">Download</button>
      </div>
    </div>`).join('')}</div>`;

  // View: open signed URL in new tab.
  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => openStoredFile(btn.dataset.view, 'reports'));
  });
  // Download: fetch signed URL, force download.
  container.querySelectorAll('[data-download]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: signed, error } = await sb.storage.from('reports').createSignedUrl(btn.dataset.download, 3600);
      if (error) { toast('Could not download: ' + error.message, 'error'); return; }
      const a = document.createElement('a');
      a.href = signed.signedUrl;
      a.download = btn.dataset.download.split('/').pop();
      document.body.appendChild(a); a.click(); a.remove();
    });
  });
}
