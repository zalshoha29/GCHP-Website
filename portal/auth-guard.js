/* =========================================
   GCHP Portal — Auth Guard
   Include on every protected portal page.
   Usage: <body data-require-role="ambassador"> or "executive".
   Omit the attribute to allow any signed-in user.
   ========================================= */

(async function guard() {
  const requiredRole = document.body.getAttribute('data-require-role');

  const profile = await getCurrentProfile();

  // Not signed in → login.
  if (!profile) {
    window.location.replace('login.html');
    return;
  }

  // Signed in but wrong portal → send to their own home.
  if (requiredRole && profile.role !== requiredRole) {
    if (profile.role === 'executive') {
      window.location.replace('exec-dashboard.html');
    } else {
      window.location.replace('dashboard.html');
    }
    return;
  }

  // Expose the loaded profile to the page.
  window.GCHP_PROFILE = profile;
  document.body.classList.add('auth-ready');

  // Populate any standard chrome present on the page.
  const nameEls = document.querySelectorAll('[data-user-name]');
  nameEls.forEach(el => { el.textContent = profile.display_name || 'GCHP User'; });

  const roleEls = document.querySelectorAll('[data-user-role]');
  roleEls.forEach(el => {
    el.textContent = profile.role === 'executive' ? 'Executive' : 'Ambassador';
  });

  const avatarEls = document.querySelectorAll('[data-user-avatar]');
  avatarEls.forEach(el => {
    const initials = (profile.display_name || 'GU')
      .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    el.textContent = initials;
  });

  // Wire any logout buttons.
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); signOut(); });
  });

  // Fire a ready event for page scripts that need the profile.
  document.dispatchEvent(new CustomEvent('gchp:ready', { detail: { profile } }));
})();
