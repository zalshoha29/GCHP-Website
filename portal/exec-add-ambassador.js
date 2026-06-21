/* =========================================
   GCHP Portal — Executive: Add Ambassador
   Calls the add-ambassador Edge Function (service-role
   admin work happens server-side, never in the browser).
   ========================================= */
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},3200); }
function showError(msg){ const b=document.getElementById('formError'); document.getElementById('formErrorMsg').textContent=msg; b.style.display='flex'; }

document.getElementById('addForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  document.getElementById('formError').style.display = 'none';

  const email = document.getElementById('email').value.trim().toLowerCase();
  const display_name = document.getElementById('display_name').value.trim();
  if (!email || !display_name) { showError('Email and full name are required.'); return; }

  const btn = document.getElementById('addBtn');
  btn.disabled = true; btn.querySelector('span').textContent = 'Creating...';

  // sb.functions.invoke automatically attaches the caller's JWT, which the
  // Edge Function uses to confirm the caller is an executive.
  const { data, error } = await sb.functions.invoke('add-ambassador', {
    body: {
      email, display_name,
      university: document.getElementById('university').value.trim() || null,
      phone: document.getElementById('phone').value.trim() || null,
    },
  });

  btn.disabled = false; btn.querySelector('span').textContent = 'Create Account';

  if (error) { showError('Could not create account: ' + (error.message || 'unknown error')); return; }
  if (data && data.error) { showError(data.error); return; }

  toast(`Ambassador account created for ${email}. They'll receive an email to set their password.`, 'success');
  document.getElementById('addForm').reset();
});
