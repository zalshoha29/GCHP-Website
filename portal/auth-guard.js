/* =========================================
   GCHP Portal — Auth Guard + Shared Navigation

   Include on every protected portal page, after supabase-client.js.

   Usage:
     <body data-require-role="ambassador" data-nav="dashboard">
     <body data-require-role="executive"  data-nav="exec-cycles">

   - data-require-role : which role may view this page. Omit to allow any signed-in user.
   - data-nav          : key of the nav item to mark active (see NAV_* below).

   The sidebar is INJECTED from the definitions below — it is NOT written into
   each HTML page. To add, remove, or rename a tab, edit NAV_AMBASSADOR or
   NAV_EXECUTIVE here once and it updates across every page.

   NOTE: this guard is a UX convenience, NOT a security boundary. Row Level
   Security in Postgres is what actually protects data.
   ========================================= */

const NAV_ICONS = {
  home:     '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg>',
  form:     '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M7 7 L13 7 M7 10 L13 10 M7 13 L10 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  upload:   '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M10 2 L10 13 M6 9 L10 13 L14 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 16 L17 16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  report:   '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><rect x="4" y="2" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M7 6 L13 6 M7 9 L13 9 M7 12 L11 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  folder:   '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M3 5 C3 4 3.4 3.5 4 3.5 L8 3.5 L10 5.5 L16 5.5 C16.6 5.5 17 6 17 6.5 L17 15 C17 15.6 16.6 16 16 16 L4 16 C3.4 16 3 15.6 3 15 Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  mail:     '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M3 5 L10 11 L17 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  calendar: '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M3 8 L17 8 M7 2 L7 5 M13 2 L13 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  chart:    '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M3 17 L3 3 M3 17 L17 17 M6 13 L9 9 L12 12 L16 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bars:     '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M4 16 L4 9 M10 16 L10 4 M16 16 L16 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  userPlus: '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><circle cx="8" cy="7" r="3.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 17 C2 13.7 4.7 11 8 11 C9 11 10 11.2 10.8 11.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M15 11 L15 17 M12 14 L18 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  database: '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><ellipse cx="10" cy="5" rx="7" ry="3" stroke="currentColor" stroke-width="1.4"/><path d="M3 5 L3 15 C3 16.7 6.1 18 10 18 C13.9 18 17 16.7 17 15 L17 5" stroke="currentColor" stroke-width="1.4"/></svg>',
  cycle:    '<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M3 10 A7 7 0 1 1 5 15 M3 10 L3 14 M3 10 L6 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  logout:   '<svg viewBox="0 0 20 20" fill="none" width="14" height="14"><path d="M7 3 L3 3 C2.4 3 2 3.4 2 4 L2 16 C2 16.6 2.4 17 3 17 L7 17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M13 7 L18 10 L13 13 M18 10 L8 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/* ---- SINGLE SOURCE OF TRUTH FOR THE SIDEBARS ----
   Add a tab by adding one entry here. It appears on every page automatically. */
const NAV_AMBASSADOR = {
  label: 'Portal',
  items: [
    { key: 'dashboard', href: 'dashboard.html', icon: 'home',   text: 'Home' },
    { key: 'submit-d1', href: 'submit-d1.html', icon: 'form',   text: 'Submit Event Plan (D1)' },
    { key: 'submit-d2', href: 'submit-d2.html', icon: 'upload', text: 'Submit Report (D2)' },
    { key: 'reports',   href: 'reports.html',   icon: 'report', text: 'Impact Reports' },
    { key: 'materials', href: 'materials.html', icon: 'folder', text: 'Fundraising Materials' },
    { key: 'messages',  href: 'messages.html',  icon: 'mail',   text: 'Messages', badge: true },
  ],
};

const NAV_EXECUTIVE = {
  label: 'Executive',
  items: [
    { key: 'exec-dashboard',      href: 'exec-dashboard.html',      icon: 'form',     text: 'Pending Deliverables' },
    { key: 'exec-cycles',         href: 'exec-cycles.html',         icon: 'cycle',    text: 'Cycles' },
    { key: 'exec-calendar',       href: 'exec-calendar.html',       icon: 'calendar', text: 'Calendar & Deadlines' },
    { key: 'exec-engagement',     href: 'exec-engagement.html',     icon: 'chart',    text: 'Engagement Health' },
    { key: 'exec-add-ambassador', href: 'exec-add-ambassador.html', icon: 'userPlus', text: 'Add Ambassador' },
    { key: 'exec-impact',         href: 'exec-impact.html',         icon: 'report',   text: 'Impact Reports' },
    { key: 'exec-materials',      href: 'exec-materials.html',      icon: 'folder',   text: 'Manage Materials' },
    { key: 'exec-data',           href: 'exec-data.html',           icon: 'database', text: 'Data Editor' },
    { key: 'exec-message',        href: 'exec-message.html',        icon: 'mail',     text: 'Send Message' },
    { key: 'exec-summary',        href: 'exec-summary.html',        icon: 'bars',     text: 'Cycle Summary' },
  ],
};

function renderSidebar(profile) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const activeKey = document.body.getAttribute('data-nav') || '';
  const nav = profile.role === 'executive' ? NAV_EXECUTIVE : NAV_AMBASSADOR;
  const initials = (profile.display_name || 'GU')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const links = nav.items.map(item => `
      <a href="${item.href}" class="sidebar-link${item.key === activeKey ? ' active' : ''}">
        ${NAV_ICONS[item.icon] || ''}
        ${item.text}${item.badge ? ' <span class="nav-badge" id="msgBadge" style="display:none;"></span>' : ''}
      </a>`).join('');

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="logo-text">
        <span class="logo-the">THE</span>
        <span class="logo-main">GLOBAL CHILD HEALTH</span>
        <span class="logo-project">PROJECT</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section-label">${nav.label}</div>
      ${links}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-avatar" data-user-avatar>${initials}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" data-user-name>${profile.display_name || 'GCHP User'}</div>
          <div class="sidebar-user-role" data-user-role>${profile.role === 'executive' ? 'Executive' : 'Ambassador'}</div>
        </div>
      </div>
      <a href="#" class="sidebar-logout" data-logout>${NAV_ICONS.logout} Sign Out</a>
    </div>`;

  const toggle = document.getElementById('sidebarToggle');
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}

/* Clean access-denied page instead of a broken, empty UI. */
function showAccessDenied(profile) {
  const home = profile.role === 'executive' ? 'exec-dashboard.html' : 'dashboard.html';
  const forWhom = profile.role === 'executive' ? 'ambassadors' : 'the executive team';
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',sans-serif;background:#f6f8f8;">
      <div style="max-width:440px;text-align:center;background:#fff;padding:44px 36px;border-radius:14px;box-shadow:0 4px 24px rgba(11,45,82,0.08);">
        <svg viewBox="0 0 24 24" fill="none" width="48" height="48" style="margin-bottom:18px;">
          <circle cx="12" cy="12" r="10" stroke="#b91c1c" stroke-width="1.6"/>
          <path d="M12 7.5 V13 M12 16.2 V16.3" stroke="#b91c1c" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <h1 style="font-family:'Fredoka',sans-serif;font-size:24px;color:#0B2D52;margin:0 0 10px;">Access denied</h1>
        <p style="font-size:14.5px;color:#5b6670;line-height:1.6;margin:0 0 24px;">
          This page is for ${forWhom}, and your account does not have access to it.
          No data from this page was loaded.
        </p>
        <a href="${home}" style="display:inline-block;background:#0B2D52;color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:600;font-size:14px;">
          Back to my portal
        </a>
      </div>
    </div>`;
}

(async function guard() {
  const requiredRole = document.body.getAttribute('data-require-role');
  const profile = await getCurrentProfile();

  if (!profile) { window.location.replace('login.html'); return; }

  // Wrong portal → clean access-denied screen.
  // (RLS already guarantees no data loads; this just avoids a broken-looking page.)
  if (requiredRole && profile.role !== requiredRole) {
    showAccessDenied(profile);
    return;
  }

  window.GCHP_PROFILE = profile;
  document.body.classList.add('auth-ready');

  renderSidebar(profile);

  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); signOut(); });
  });
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = profile.display_name || 'GCHP User';
  });
  document.querySelectorAll('[data-user-role]').forEach(el => {
    el.textContent = profile.role === 'executive' ? 'Executive' : 'Ambassador';
  });
  document.querySelectorAll('[data-user-avatar]').forEach(el => {
    el.textContent = (profile.display_name || 'GU')
      .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  });

  document.dispatchEvent(new CustomEvent('gchp:ready', { detail: { profile } }));
})();
