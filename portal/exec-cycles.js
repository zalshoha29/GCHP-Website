/* =========================================
   GCHP Portal — Executive Cycle Management
   Create / edit / activate cycles. Scenario set per cycle.
   ========================================= */
(function(){ const t=document.getElementById('sidebarToggle'),s=document.getElementById('sidebar'); if(t&&s)t.addEventListener('click',()=>s.classList.toggle('open')); })();
(function(){ const el=document.getElementById('topbarDate'); if(el)el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); })();
function toast(msg,type=''){ const t=document.getElementById('toast'); t.textContent=msg; t.className='portal-toast show '+type; setTimeout(()=>{t.className='portal-toast '+type;},2800); }
function showError(msg){ const b=document.getElementById('cycleError'); document.getElementById('cycleErrorMsg').textContent=msg; b.style.display='flex'; }
function fmtDate(d){ return d ? new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'; }

const SCENARIO_LABEL = { 'A':'A','B':'B','C Track 1':'C Track 1','C Track 2':'C Track 2' };
let editingId = null;

document.addEventListener('gchp:ready', async () => {
  document.getElementById('newCycleBtn').addEventListener('click', openNew);
  document.getElementById('soClose').addEventListener('click', closeSO);
  document.getElementById('slideoverOverlay').addEventListener('click', closeSO);
  document.getElementById('saveCycleBtn').addEventListener('click', saveCycle);
  await loadCycles();
});

function closeSO(){ document.getElementById('slideover').classList.remove('open'); document.getElementById('slideoverOverlay').classList.remove('open'); }

async function loadCycles() {
  const { data, error } = await sb.from('cycles').select('*').order('start_date', { ascending: false });
  const c = document.getElementById('cyclesContainer');
  if (error) { c.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; return; }
  if (!data || !data.length) { c.innerHTML = `<div class="empty-state">No cycles yet. Click "New Cycle" to create one.</div>`; return; }

  c.innerHTML = `<div class="exec-table-wrap"><table class="exec-table">
    <thead><tr><th>Cycle</th><th>Dates</th><th>D1 / D2 Deadline</th><th>Scenario</th><th>Active</th><th>Action</th></tr></thead>
    <tbody>${data.map(cy => `<tr style="cursor:default;">
      <td><strong>${esc(cy.cycle_name)}</strong></td>
      <td>${fmtDate(cy.start_date)} – ${fmtDate(cy.end_date)}</td>
      <td>${fmtDate(cy.deliverable_1_deadline)} / ${fmtDate(cy.deliverable_2_deadline)}</td>
      <td>${cy.scenario ? esc(cy.scenario) : '<span style="color:var(--gray);">—</span>'}</td>
      <td>${cy.is_active ? '<span class="flag-badge" style="background:#dcfce7;color:#15803d;">Active</span>' : ''}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn-portal secondary" style="padding:6px 12px;font-size:12px;" data-edit="${esc(cy.id)}">Edit</button>
        ${cy.is_active ? '' : `<button class="btn-portal" style="padding:6px 12px;font-size:12px;" data-activate="${esc(cy.id)}">Activate</button>`}
      </td></tr>`).join('')}</tbody></table></div>`;

  c.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(data.find(x=>x.id===b.dataset.edit))));
  c.querySelectorAll('[data-activate]').forEach(b => b.addEventListener('click', () => activateCycle(b.dataset.activate)));
}

function openNew() {
  editingId = null;
  document.getElementById('soTitle').textContent = 'New Cycle';
  ['c_name','c_start','c_end','c_d1','c_d2'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('c_scenario').value = '';
  document.getElementById('c_inactivity').value = 14;
  document.getElementById('c_overdue').value = 14;
  document.getElementById('c_active').checked = false;
  document.getElementById('cycleError').style.display = 'none';
  openSO();
}

function openEdit(cy) {
  editingId = cy.id;
  document.getElementById('soTitle').textContent = `Edit — ${cy.cycle_name}`;
  document.getElementById('c_name').value = cy.cycle_name || '';
  document.getElementById('c_start').value = cy.start_date || '';
  document.getElementById('c_end').value = cy.end_date || '';
  document.getElementById('c_d1').value = cy.deliverable_1_deadline || '';
  document.getElementById('c_d2').value = cy.deliverable_2_deadline || '';
  document.getElementById('c_scenario').value = cy.scenario || '';
  document.getElementById('c_inactivity').value = cy.inactivity_flag_days ?? 14;
  document.getElementById('c_overdue').value = cy.d2_overdue_days ?? 14;
  document.getElementById('c_active').checked = !!cy.is_active;
  document.getElementById('cycleError').style.display = 'none';
  openSO();
}

function openSO(){ document.getElementById('slideover').classList.add('open'); document.getElementById('slideoverOverlay').classList.add('open'); }

async function saveCycle() {
  document.getElementById('cycleError').style.display = 'none';
  const name = document.getElementById('c_name').value.trim();
  const start = document.getElementById('c_start').value;
  const end = document.getElementById('c_end').value;
  const scenario = document.getElementById('c_scenario').value;
  if (!name || !start || !end) { showError('Name, start date and end date are required.'); return; }
  if (!scenario) { showError('Please choose a scenario for this cycle.'); return; }
  if (new Date(end) < new Date(start)) { showError('End date cannot be before start date.'); return; }

  const payload = {
    cycle_name: name, start_date: start, end_date: end,
    deliverable_1_deadline: document.getElementById('c_d1').value || null,
    deliverable_2_deadline: document.getElementById('c_d2').value || null,
    scenario,
    inactivity_flag_days: Number(document.getElementById('c_inactivity').value) || 14,
    d2_overdue_days: Number(document.getElementById('c_overdue').value) || 14,
    is_active: document.getElementById('c_active').checked,
  };

  let error;
  if (editingId) ({ error } = await sb.from('cycles').update(payload).eq('id', editingId));
  else ({ error } = await sb.from('cycles').insert(payload));

  if (error) { showError('Save failed: ' + error.message); return; }
  toast(editingId ? 'Cycle updated.' : 'Cycle created.', 'success');
  closeSO();
  await loadCycles();
}

async function activateCycle(id) {
  if (!confirm('Make this the active cycle? Any other active cycle will be deactivated.')) return;
  const { error } = await sb.from('cycles').update({ is_active: true }).eq('id', id);
  if (error) { toast('Activation failed: ' + error.message, 'error'); return; }
  toast('Cycle activated.', 'success');
  await loadCycles();
}
