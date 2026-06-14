/* =========================================
   GCHP — Dashboard JavaScript
   ========================================= */

// Auth guard
const rawUser = sessionStorage.getItem('gchp_user') || localStorage.getItem('gchp_user');
if (!rawUser) { window.location.href = 'login.html'; }
const currentUser = JSON.parse(rawUser);

// Deliverables data — from Leadership Meeting action items
const DELIVERABLES = [
  // Partnerships
  { id: 1, title: 'Email template for outreach to NGO partners', dept: 'partnerships', assigned: 'Laila Salih', status: 'in-progress', notes: 'Draft in Google Drive. Need legal review.' },
  { id: 2, title: 'Presentation deck for partner meetings', dept: 'partnerships', assigned: 'Laila Salih', status: 'done', notes: 'Completed — Partnership Deck v1 finalized.' },
  { id: 3, title: 'Template Memorandum of Agreement (MOA)', dept: 'partnerships', assigned: 'Laila Salih', status: 'todo', notes: '' },

  // Media
  { id: 4, title: 'Create the GCHP Instagram account', dept: 'media', assigned: 'Lin Kuang', status: 'done', notes: '@gchproject — live and verified.' },
  { id: 5, title: 'PowerPoint templates for organizational presentations', dept: 'media', assigned: 'Lin Kuang', status: 'in-progress', notes: 'Brand colors applied. Fonts pending.' },
  { id: 6, title: 'Preliminary Instagram posting plan', dept: 'media', assigned: 'Lin Kuang', status: 'in-progress', notes: 'Content calendar drafted for March–April.' },

  // Mobilization
  { id: 7, title: 'Onboarding document for student ambassadors', dept: 'mobilization', assigned: 'Douae Maarouf', status: 'in-progress', notes: 'Sections 1–3 complete, need section 4 (expectations).' },
  { id: 8, title: 'Student ambassador tracker sheet', dept: 'mobilization', assigned: 'Douae Maarouf', status: 'todo', notes: '' },

  // Operations
  { id: 9, title: 'SOP for fundraising: how it works & where money goes', dept: 'operations', assigned: 'Karim Jawhari', status: 'in-progress', notes: 'Working with Partnerships to align with NGO.' },
  { id: 10, title: 'Fundraising activities guide for student organizations', dept: 'operations', assigned: 'Karim Jawhari', status: 'todo', notes: '' },

  // Exec
  { id: 11, title: 'GCHP website initial draft', dept: 'operations', assigned: 'Web Dev Team', status: 'done', notes: 'Website live — internal dashboard built.' },
  { id: 12, title: 'Weekly meeting cadence established', dept: 'operations', assigned: 'Dina Hassouna', status: 'done', notes: 'Every Tuesday, 30 min. Agenda doc shared.' },
];

const DEPT_META = {
  partnerships: { label: 'Head of Partnerships', lead: 'Laila Salih', color: '#589593' },
  media: { label: 'Head of Media', lead: 'Lin Kuang', color: '#0B2D52' },
  mobilization: { label: 'Head of Student Mobilization', lead: 'Douae Maarouf', color: '#7ab5b3' },
  operations: { label: 'Head of Operations', lead: 'Karim Jawhari', color: '#676f7a' },
};

const TEAM = [
  { name: 'Zaid Al-Shoha', role: 'Founder & Executive Director', initials: 'ZA', color: '#0B2D52', exec: true,
    desc: 'Provides long-term vision, organizational leadership, and external legitimacy while safeguarding the mission, values, and strategic direction.',
    deliverables: ['Set and protect organizational mission & values', 'Lead external partnerships and legitimacy', 'Strategic direction and long-term planning'] },
  { name: 'Dina Hassouna', role: 'Managing Director', initials: 'DH', color: '#589593', exec: true,
    desc: 'Oversees day-to-day execution and coordination, ensuring strategy is translated into action and progress is sustained across all teams.',
    deliverables: ['Coordinate day-to-day operations', 'Facilitate weekly check-ins', 'Track progress on all deliverables'] },
  { name: 'Laila Salih', role: 'Head of Partnerships', initials: 'LS', color: '#0B2D52',
    desc: 'Manages relationships with humanitarian NGO partners and ensures alignment, accountability, and impact reporting.',
    deliverables: ['NGO outreach email template', 'Partner presentation deck', 'MOA template'] },
  { name: 'Lin Kuang', role: 'Head of Media', initials: 'LK', color: '#589593',
    desc: 'Owns the organization\'s public narrative, messaging, and storytelling to ensure clarity, consistency, and dignity.',
    deliverables: ['GCHP Instagram account', 'PPT presentation templates', 'Instagram content plan'] },
  { name: 'Douae Maarouf', role: 'Head of Student Mobilization', initials: 'DM', color: '#0B2D52',
    desc: 'Leads the growth and coordination of the international student network through recruitment and engagement.',
    deliverables: ['Ambassador onboarding document', 'Ambassador tracker sheet'] },
  { name: 'Karim Jawhari', role: 'Head of Operations', initials: 'KJ', color: '#676f7a',
    desc: 'Builds and maintains the systems, processes, and materials that ensure consistency, quality, and scalability.',
    deliverables: ['Fundraising SOP', 'Fundraising activities guide'] },
];

const ACTIVITY = [
  { text: '<strong>Laila Salih</strong> completed the Partnership Deck', time: '2 days ago', color: '#589593' },
  { text: '<strong>Lin Kuang</strong> created the GCHP Instagram account', time: '3 days ago', color: '#0B2D52' },
  { text: '<strong>Karim Jawhari</strong> started the Fundraising SOP draft', time: '4 days ago', color: '#676f7a' },
  { text: '<strong>Douae Maarouf</strong> began the Ambassador onboarding doc', time: '5 days ago', color: '#7ab5b3' },
  { text: '<strong>Web Dev Team</strong> deployed the GCHP website', time: '6 days ago', color: '#589593' },
  { text: '<strong>Dina Hassouna</strong> established the weekly meeting cadence', time: '1 week ago', color: '#0B2D52' },
];

// ---- SETUP USER ----
function setupUser() {
  document.getElementById('sidebarName').textContent = currentUser.name;
  document.getElementById('sidebarRole').textContent = currentUser.role;
  document.getElementById('sidebarAvatar').textContent = currentUser.initials;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = currentUser.name.split(' ')[0];
  document.getElementById('welcomeMsg').textContent = `${greeting}, ${firstName}`;
}

// ---- DATE ----
function setupDate() {
  const el = document.getElementById('topbarDate');
  if (!el) return;
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  el.textContent = new Date().toLocaleDateString('en-US', opts);
}

// ---- NAVIGATION ----
function setupNav() {
  const links = document.querySelectorAll('.sidebar-link[data-view]');
  const deptLinks = document.querySelectorAll('.sidebar-link[data-dept]');

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const view = link.dataset.view;
      switchView(view);
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.getElementById('topbarTitle').textContent = link.textContent.trim();
    });
  });

  deptLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const dept = link.dataset.dept;
      switchView('deliverables');
      document.getElementById('deptFilter').value = dept;
      renderDeliverables();
      links.forEach(l => l.classList.remove('active'));
      document.querySelector('[data-view="deliverables"]').classList.add('active');
      document.getElementById('topbarTitle').textContent = 'Deliverables';
    });
  });
}

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.add('active');
}

// ---- OVERVIEW ----
function renderOverview() {
  const total = DELIVERABLES.length;
  const done = DELIVERABLES.filter(d => d.status === 'done').length;
  const inProgress = DELIVERABLES.filter(d => d.status === 'in-progress').length;
  const todo = DELIVERABLES.filter(d => d.status === 'todo').length;

  document.getElementById('sc-total').textContent = total;
  document.getElementById('sc-done').textContent = done;
  document.getElementById('sc-progress').textContent = inProgress;
  document.getElementById('sc-todo').textContent = todo;

  // Dept progress
  const deptList = document.getElementById('deptProgressList');
  if (deptList) {
    deptList.innerHTML = Object.entries(DEPT_META).map(([dept, meta]) => {
      const items = DELIVERABLES.filter(d => d.dept === dept);
      const doneCount = items.filter(d => d.status === 'done').length;
      const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
      return `
        <div class="dpt-item">
          <div class="dpt-header">
            <span class="dpt-name" style="color:${meta.color}">${dept.charAt(0).toUpperCase() + dept.slice(1)}</span>
            <span class="dpt-count">${doneCount}/${items.length}</span>
          </div>
          <div class="dpt-bar">
            <div class="dpt-fill" style="width:${pct}%; background:${meta.color};"></div>
          </div>
        </div>`;
    }).join('');
  }

  // Activity
  const feed = document.getElementById('activityFeed');
  if (feed) {
    feed.innerHTML = ACTIVITY.map(a => `
      <div class="activity-item">
        <div class="ai-dot" style="background:${a.color};"></div>
        <div>
          <div class="ai-text">${a.text}</div>
          <div class="ai-time">${a.time}</div>
        </div>
      </div>`).join('');
  }
}

// ---- DELIVERABLES ----
function renderDeliverables() {
  const deptFilter = document.getElementById('deptFilter')?.value || 'all';
  const statusFilter = document.getElementById('statusFilter')?.value || 'all';
  const container = document.getElementById('deliverablesList');
  if (!container) return;

  let filtered = DELIVERABLES;
  if (deptFilter !== 'all') filtered = filtered.filter(d => d.dept === deptFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(d => d.status === statusFilter);

  // Group by dept
  const depts = [...new Set(filtered.map(d => d.dept))];

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--gray);font-size:14px;">No deliverables match your filters.</div>`;
    return;
  }

  container.innerHTML = depts.map(dept => {
    const meta = DEPT_META[dept];
    const items = filtered.filter(d => d.dept === dept);
    return `
      <div class="dept-section">
        <div class="dept-section-header">
          <div class="dept-section-dot" style="background:${meta.color};"></div>
          <span class="dept-section-title">${dept.charAt(0).toUpperCase() + dept.slice(1)}</span>
          <span class="dept-section-lead">${meta.lead} · ${meta.label}</span>
        </div>
        ${items.map(item => renderDeliverableItem(item)).join('')}
      </div>`;
  }).join('');

  // Bind edit buttons
  container.querySelectorAll('.di-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      openModal(id);
    });
  });

  // Bind status toggle on icon click
  container.querySelectorAll('.di-status-icon').forEach(icon => {
    icon.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(icon.dataset.id);
      cycleStatus(id);
    });
  });
}

function renderDeliverableItem(item) {
  const statusLabel = { done: 'Completed', 'in-progress': 'In Progress', todo: 'Not Started' }[item.status];
  const icons = { done: '✓', 'in-progress': '◷', todo: '○' };
  return `
    <div class="deliverable-item status-${item.status}">
      <div class="di-status-icon ${item.status}" data-id="${item.id}" title="Click to cycle status" style="cursor:pointer;">
        ${icons[item.status]}
      </div>
      <div class="di-info">
        <div class="di-title ${item.status}">${item.title}</div>
        <div class="di-meta">Assigned: ${item.assigned}${item.notes ? ' · ' + item.notes : ''}</div>
      </div>
      <span class="di-badge ${item.status}">${statusLabel}</span>
      <button class="di-edit-btn" data-id="${item.id}">Edit</button>
    </div>`;
}

function cycleStatus(id) {
  const item = DELIVERABLES.find(d => d.id === id);
  if (!item) return;
  const cycle = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };
  item.status = cycle[item.status];

  // Log activity
  const statusLabel = { done: 'completed', 'in-progress': 'started', todo: 'reset' }[item.status];
  ACTIVITY.unshift({ text: `<strong>${currentUser.name}</strong> ${statusLabel} "${item.title}"`, time: 'Just now', color: DEPT_META[item.dept]?.color || '#589593' });

  renderDeliverables();
  renderOverview();
}

// ---- MODAL ----
let editingId = null;

function openModal(id) {
  const item = DELIVERABLES.find(d => d.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Deliverable';
  document.getElementById('mTitle').value = item.title;
  document.getElementById('mDept').value = item.dept;
  document.getElementById('mAssigned').value = item.assigned;
  document.getElementById('mStatus').value = item.status;
  document.getElementById('mNotes').value = item.notes || '';
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

document.getElementById('modalClose')?.addEventListener('click', closeModal);
document.getElementById('modalCancel')?.addEventListener('click', closeModal);
document.getElementById('modalOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

document.getElementById('modalSave')?.addEventListener('click', () => {
  if (editingId === null) return;
  const item = DELIVERABLES.find(d => d.id === editingId);
  if (!item) return;

  const oldStatus = item.status;
  item.title = document.getElementById('mTitle').value.trim() || item.title;
  item.dept = document.getElementById('mDept').value;
  item.assigned = document.getElementById('mAssigned').value.trim() || item.assigned;
  item.status = document.getElementById('mStatus').value;
  item.notes = document.getElementById('mNotes').value.trim();

  if (item.status !== oldStatus) {
    const statusLabel = { done: 'completed', 'in-progress': 'marked in progress', todo: 'reset' }[item.status];
    ACTIVITY.unshift({ text: `<strong>${currentUser.name}</strong> ${statusLabel} "${item.title}"`, time: 'Just now', color: DEPT_META[item.dept]?.color || '#589593' });
  }

  closeModal();
  renderDeliverables();
  renderOverview();
});

// ---- TEAM ----
function renderTeam() {
  const grid = document.getElementById('teamGrid');
  if (!grid) return;
  grid.innerHTML = TEAM.map(member => {
    const deliverables = DELIVERABLES.filter(d => d.assigned === member.name);
    const statusColor = { done: '#16a34a', 'in-progress': '#d97706', todo: '#9ca3af' };
    return `
      <div class="team-card ${member.exec ? 'exec-card' : ''}">
        <div class="tc-avatar" style="background:${member.color};">${member.initials}</div>
        <div class="tc-name">${member.name}</div>
        <div class="tc-role">${member.role}</div>
        <div class="tc-desc">${member.desc}</div>
        ${deliverables.length ? `
        <div class="tc-deliverables">
          <div class="tc-del-label">Deliverables</div>
          <div class="tc-del-list">
            ${deliverables.map(d => `
              <div class="tc-del-item">
                <div class="tc-del-dot" style="background:${statusColor[d.status]};"></div>
                <span>${d.title}</span>
              </div>`).join('')}
          </div>
        </div>` : `
        <div class="tc-deliverables">
          <div class="tc-del-label">Key Responsibilities</div>
          <div class="tc-del-list">
            ${member.deliverables.map(r => `<div class="tc-del-item"><div class="tc-del-dot" style="background:var(--teal);"></div><span>${r}</span></div>`).join('')}
          </div>
        </div>`}
      </div>`;
  }).join('');
}

// ---- FILTERS ----
function setupFilters() {
  document.getElementById('deptFilter')?.addEventListener('change', renderDeliverables);
  document.getElementById('statusFilter')?.addEventListener('change', renderDeliverables);
}

// ---- MOBILE SIDEBAR ----
function setupSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// ---- LOGOUT ----
document.getElementById('logoutBtn')?.addEventListener('click', e => {
  sessionStorage.removeItem('gchp_user');
  localStorage.removeItem('gchp_user');
});

// ---- INIT ----
setupUser();
setupDate();
setupNav();
setupSidebar();
setupFilters();
renderOverview();
renderDeliverables();
renderTeam();
