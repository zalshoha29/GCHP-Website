/* =========================================
   GCHP Portal — Ambassador Messages (inbox)
   ========================================= */

let myId = null;

document.addEventListener('gchp:ready', async (e) => {
  myId = e.detail.profile.id;
  await loadMessages();
});

function fmtDateTime(d){ return new Date(d).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
const TYPE_LABEL = { manual:'From GCHP team', automated:'Automated notification', scheduled:'Reminder' };

async function refreshBadge(){
  const c = await getUnreadCount(myId);
  const b = document.getElementById('msgBadge');
  if (!b) return;
  if (c>0){ b.textContent=c; b.style.display='inline-block'; } else { b.style.display='none'; }
}

async function loadMessages() {
  const container = document.getElementById('msgContainer');
  const { data, error } = await sb.from('messages')
    .select('*').eq('recipient_id', myId).order('created_at', { ascending: false });

  if (error) { container.innerHTML = `<div class="empty-state">Could not load messages: ${esc(error.message)}</div>`; return; }
  if (!data || !data.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 48 48" fill="none" width="48" height="48"><rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" stroke-width="2"/><path d="M8 12 L24 26 L40 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <p>No messages yet.</p></div>`;
    await refreshBadge();
    return;
  }

  container.innerHTML = `<div class="msg-list">${data.map(m => `
    <div class="msg-item ${m.is_read ? '' : 'unread'}" data-id="${esc(m.id)}" data-read="${m.is_read}">
      <div class="msg-head">
        <span class="msg-subject">${esc(m.subject)}</span>
        <span style="display:flex;align-items:center;gap:10px;">
          <span class="msg-date">${fmtDateTime(m.created_at)}</span>
          <button class="msg-delete" data-id="${esc(m.id)}" title="Delete from my inbox" aria-label="Delete message">
            <svg viewBox="0 0 20 20" fill="none" width="15" height="15"><path d="M4 6 L16 6 M8 6 V4.5 A1 1 0 0 1 9 3.5 H11 A1 1 0 0 1 12 4.5 V6 M6 6 L7 16.5 A1 1 0 0 0 8 17.5 H12 A1 1 0 0 0 13 16.5 L14 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </span>
      </div>
      <div class="msg-body">${esc(m.body)}${m.related_event_id ? `<div style="margin-top:10px;"><a href="dashboard.html" style="color:var(--teal);font-weight:600;font-size:13px;">View related event →</a></div>` : ''}</div>
      <div class="msg-type">${TYPE_LABEL[m.message_type] || ''}</div>
    </div>`).join('')}</div>`;

  container.querySelectorAll('.msg-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.msg-delete')) return; // ignore delete clicks
      item.classList.toggle('open');
      if (item.dataset.read === 'false' && item.classList.contains('open')) {
        item.dataset.read = 'true';
        item.classList.remove('unread');
        await sb.from('messages').update({ is_read: true }).eq('id', item.dataset.id);
        await refreshBadge();
      }
    });
  });

  // Delete (own inbox only — RLS scopes to recipient).
  container.querySelectorAll('.msg-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this message? This only removes it from your inbox.')) return;
      const { error } = await sb.from('messages').delete().eq('id', btn.dataset.id);
      if (error) { alert('Could not delete: ' + error.message); return; }
      btn.closest('.msg-item').remove();
      await refreshBadge();
      if (!container.querySelector('.msg-item')) loadMessages();
    });
  });

  await refreshBadge();
}
