/* ==========================================================================
   SMART EQUIPMENT MAINTENANCE SYSTEM (SEMS) - ENTERPRISE ENGINE
   Full Stack Interactive Asset Reliability & Maintenance Platform
   ========================================================================== */

// Global State Management
const SEMS_STATE = {
  currentUser: { name: 'Alex Mercer (Admin)', role: 'Plant Manager (Admin)', email: 'admin@smartfactory.com' },
  machines: [],
  technicians: [],
  maintenanceTasks: [],
  notifications: [],
  recentActivities: [],
  kpiData: { total_machines: 150, active_machines: 132, maintenance_due: 10, overdue_maintenance: 3, completed_services: 95 },
  charts: {},
  isSendingWA: false
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  fetchInitialData();
  setupResponsiveHandlers();
});

/* --------------------------------------------------------
   DATA FETCHING & REFRESH
   -------------------------------------------------------- */
async function fetchInitialData() {
  try {
    // 1. KPI Stats
    const kpiRes = await fetch('/api/kpi');
    if (kpiRes.ok) {
      SEMS_STATE.kpiData = await kpiRes.json();
      updateKPICards();
    }

    // 2. Machines
    const macRes = await fetch('/api/machines');
    if (macRes.ok) {
      SEMS_STATE.machines = await macRes.json();
      renderMachinesTable();
    }

    // 3. Technicians
    const techRes = await fetch('/api/technicians');
    if (techRes.ok) {
      SEMS_STATE.technicians = await techRes.json();
      renderTechniciansTable();
      populateWhatsAppTechDropdown();
    }

    // 4. Maintenance Schedules
    const mainRes = await fetch('/api/maintenance');
    if (mainRes.ok) {
      SEMS_STATE.maintenanceTasks = await mainRes.json();
      renderSchedulerTable();
    }

    // 5. Recent Activities
    const actRes = await fetch('/api/recent-activities');
    if (actRes.ok) {
      SEMS_STATE.recentActivities = await actRes.json();
      renderRecentActivityTable();
    }

    // 6. Notifications
    const notifRes = await fetch('/api/notifications');
    if (notifRes.ok) {
      SEMS_STATE.notifications = await notifRes.json();
      renderNotifications();
    }

    // 7. Render Charts
    initCharts();

  } catch (err) {
    console.error("Data load error:", err);
    updateKPICards();
    renderRecentActivityTable();
    initCharts();
  }
}

/* --------------------------------------------------------
   NAVIGATION & TAB ROUTING
   -------------------------------------------------------- */
function switchTab(viewId, element) {
  // Update sidebar active classes
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  } else {
    const matchingNav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if (matchingNav) matchingNav.classList.add('active');
  }

  // Hide all views and show target view
  document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update Page Title in Top Header
  const titleMap = {
    'dashboardView': 'Executive Maintenance Dashboard',
    'machinesView': 'Machine Inventory System',
    'addMachineView': 'Register Equipment Asset',
    'schedulerView': 'Calendar Maintenance Scheduler',
    'techniciansView': 'Technician Roster & WhatsApp Dispatch',
    'notificationsView': 'Notification Center & WhatsApp Dispatch',
    'reportsView': 'Industrial Analytics & Audit Reports'
  };

  const titleElem = document.getElementById('pageTitleDisplay');
  if (titleElem && titleMap[viewId]) {
    titleElem.innerText = titleMap[viewId];
  }

  // Resize charts on view change if necessary
  if (viewId === 'reportsView' && SEMS_STATE.charts.downtimeBar) {
    setTimeout(() => {
      SEMS_STATE.charts.downtimeBar.resize();
      SEMS_STATE.charts.costChart.resize();
    }, 50);
  }

  // Close mobile sidebar if open
  closeMobileSidebar();
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('appSidebar');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('appSidebar');
  if (sidebar) {
    sidebar.classList.remove('mobile-open');
  }
}

function setupResponsiveHandlers() {
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('appSidebar');
    const menuBtn = document.getElementById('mobileMenuBtn');
    if (sidebar && sidebar.classList.contains('mobile-open')) {
      if (!sidebar.contains(e.target) && (!menuBtn || !menuBtn.contains(e.target))) {
        sidebar.classList.remove('mobile-open');
      }
    }
  });
}

/* --------------------------------------------------------
   MODULE 1: AUTHENTICATION & LOGIN
   -------------------------------------------------------- */
function fillLogin(email, password) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = password;
  hideLoginAlert();
}

function showLoginAlert(msg) {
  const banner = document.getElementById('loginAlertBanner');
  const text = document.getElementById('loginAlertMessage');
  if (banner && text) {
    text.innerText = msg;
    banner.style.display = 'flex';
  }
}

function hideLoginAlert() {
  const banner = document.getElementById('loginAlertBanner');
  if (banner) banner.style.display = 'none';
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

async function handleLogin() {
  hideLoginAlert();
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  const email = emailInput.value.trim();
  const password = passInput.value.trim();

  // Validate empty fields
  if (!email) {
    showLoginAlert('Please enter your work email address.');
    emailInput.focus();
    return;
  }

  if (!validateEmail(email)) {
    showLoginAlert('Please enter a valid work email address format.');
    emailInput.focus();
    return;
  }

  if (!password) {
    showLoginAlert('Please enter your account password.');
    passInput.focus();
    return;
  }

  // Toggle button loading spinner
  const submitBtn = document.getElementById('loginSubmitBtn');
  const btnIcon = document.getElementById('loginBtnIcon');
  const btnText = document.getElementById('loginBtnText');

  if (submitBtn) submitBtn.disabled = true;
  if (btnIcon) btnIcon.className = 'fa-solid fa-spinner fa-spin';
  if (btnText) btnText.innerText = 'Authenticating...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok && data.status === 'success') {
      SEMS_STATE.currentUser = data.user;
      
      // Update UI displays
      document.getElementById('userNameDisplay').innerText = data.user.name;
      document.getElementById('userRoleDisplay').innerText = data.user.role;
      document.getElementById('userAvatar').innerText = data.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      // Hide login overlay
      document.getElementById('loginPage').style.display = 'none';
      showToast(`Welcome back, ${data.user.name}!`);
      
      // Fetch latest data
      fetchInitialData();
    } else {
      showLoginAlert(data.message || 'Invalid work email or password. Please verify credentials.');
    }
  } catch (err) {
    console.error("Login request failed:", err);
    // Graceful fallback for offline demo testing
    if (email === 'admin@smartfactory.com' || email.includes('admin')) {
      SEMS_STATE.currentUser = { name: 'Alex Mercer (Admin)', role: 'Plant Manager (Admin)', email };
      document.getElementById('userNameDisplay').innerText = SEMS_STATE.currentUser.name;
      document.getElementById('userRoleDisplay').innerText = SEMS_STATE.currentUser.role;
      document.getElementById('loginPage').style.display = 'none';
      showToast(`Logged in as ${SEMS_STATE.currentUser.name}`);
    } else {
      showLoginAlert('Could not connect to backend server. Please check your connection.');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (btnIcon) btnIcon.className = 'fa-solid fa-right-to-bracket';
    if (btnText) btnText.innerText = 'Sign In to Dashboard';
  }
}

function logout() {
  document.getElementById('loginPage').style.display = 'flex';
  hideLoginAlert();
  showToast('Logged out of SEMS Industrial ERP.');
}

function handlePasswordReset() {
  const email = document.getElementById('resetEmailInput').value.trim();
  if (!email || !validateEmail(email)) {
    alert('Please enter a valid work email address.');
    return;
  }
  showToast(`Password reset link dispatched to ${email}!`);
  closeModal('forgotPasswordModal');
}

/* --------------------------------------------------------
   MODULE 2: DASHBOARD & KPI CARDS
   -------------------------------------------------------- */
function updateKPICards() {
  const data = SEMS_STATE.kpiData;
  const setVal = (id, val, fallback) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val !== undefined && val !== null ? val : fallback;
  };

  setVal('kpiTotalMachines', data.total_machines, 150);
  setVal('kpiActiveMachines', data.active_machines, 132);
  setVal('kpiMaintenanceDue', data.maintenance_due, 10);
  setVal('kpiOverdue', data.overdue_maintenance, 3);
  setVal('kpiCompleted', data.completed_services, 95);
}

function renderRecentActivityTable() {
  const tbody = document.getElementById('recentActivityTableBody');
  if (!tbody) return;

  let activities = SEMS_STATE.recentActivities;

  if (!activities || activities.length === 0) {
    activities = SEMS_STATE.maintenanceTasks.slice(0, 5).map(t => ({
      name: t.machine_name || t.machine_id,
      type: t.service_type || 'Preventive Maintenance',
      date: t.maintenance_date,
      status: t.status,
      tech: t.technician_name || 'Assigned Specialist'
    }));
  }

  if (activities.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No recent maintenance activities recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = activities.slice(0, 6).map(act => `
    <tr>
      <td style="font-weight: 700; color: var(--primary-dark);">${act.name}</td>
      <td>${act.type}</td>
      <td style="font-family: var(--font-mono); font-size: 0.85rem;">${act.date}</td>
      <td>${getStatusBadge(act.status)}</td>
      <td><i class="fa-solid fa-user-gear" style="color: var(--primary-blue); font-size: 0.8rem; margin-right: 0.3rem;"></i> ${act.tech}</td>
    </tr>
  `).join('');
}

/* --------------------------------------------------------
   CHARTS INITIALIZATION
   -------------------------------------------------------- */
function initCharts() {
  // 1. Monthly Trend Line Chart
  const trendCtx = document.getElementById('monthlyTrendChart');
  if (trendCtx) {
    if (SEMS_STATE.charts.trendLine) SEMS_STATE.charts.trendLine.destroy();
    SEMS_STATE.charts.trendLine = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'],
        datasets: [
          {
            label: 'Completed Preventive Services',
            data: [77, 84, 88, 92, 97, 95],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4
          },
          {
            label: 'Unplanned Machine Breakdowns',
            data: [5, 4, 3, 2, 1, 3],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderDash: [5, 5],
            fill: false,
            tension: 0.35,
            borderWidth: 2,
            pointBackgroundColor: '#ef4444',
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 14, font: { family: 'Plus Jakarta Sans', size: 12 } } }
        },
        scales: {
          y: { grid: { color: 'rgba(226, 232, 240, 0.6)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 2. Status Doughnut Chart
  const statusCtx = document.getElementById('statusPieChart');
  if (statusCtx) {
    if (SEMS_STATE.charts.statusPie) SEMS_STATE.charts.statusPie.destroy();
    SEMS_STATE.charts.statusPie = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Completed Services', 'Scheduled / Pending', 'Overdue Alerts'],
        datasets: [{
          data: [
            SEMS_STATE.kpiData.completed_services || 95,
            SEMS_STATE.kpiData.maintenance_due || 10,
            SEMS_STATE.kpiData.overdue_maintenance || 3
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 12 } } }
        },
        cutout: '70%'
      }
    });
  }

  // 3. Downtime Bar Chart
  const downtimeCtx = document.getElementById('downtimeBarChart');
  if (downtimeCtx) {
    if (SEMS_STATE.charts.downtimeBar) SEMS_STATE.charts.downtimeBar.destroy();
    SEMS_STATE.charts.downtimeBar = new Chart(downtimeCtx, {
      type: 'bar',
      data: {
        labels: ['Machining Shop', 'Thermal Utilities', 'Assembly Line A', 'Robotics Hub', 'Utility Plant'],
        datasets: [{
          label: 'Downtime Hours (Sep 2026)',
          data: [18.5, 34.0, 12.2, 8.0, 22.5],
          backgroundColor: '#0284c7',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.6)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 4. Cost Analysis Bar Chart
  const costCtx = document.getElementById('costAnalysisChart');
  if (costCtx) {
    if (SEMS_STATE.charts.costChart) SEMS_STATE.charts.costChart.destroy();
    SEMS_STATE.charts.costChart = new Chart(costCtx, {
      type: 'bar',
      data: {
        labels: ['Spare Parts', 'Labor', 'Emergency Repair', 'Overhauls'],
        datasets: [{
          label: 'Expenditure ($)',
          data: [14200, 9800, 4500, 18600],
          backgroundColor: ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.6)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

/* --------------------------------------------------------
   MODULE 3: MACHINE MANAGEMENT & FILTERING
   -------------------------------------------------------- */
function renderMachinesTable() {
  const tbody = document.getElementById('machinesTableBody');
  if (!tbody) return;

  const machines = SEMS_STATE.machines;

  if (machines.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
      <i class="fa-solid fa-inbox" style="font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
      No machine records found. Click "Add New Machine" to register assets.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = machines.slice(0, 30).map(m => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 700; color: var(--primary-navy);">${m.machine_id}</td>
      <td style="font-weight: 700;">${m.machine_name}</td>
      <td>${m.category}</td>
      <td>${m.location}</td>
      <td style="font-family: var(--font-mono); font-size: 0.85rem;">${m.install_date}</td>
      <td style="font-family: var(--font-mono); font-size: 0.85rem;">${m.next_service_date || '2026-09-25'}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; width: 60px;">
            <div style="height: 100%; width: ${m.health_score || 90}%; background: ${m.health_score < 70 ? '#ef4444' : m.health_score < 85 ? '#f59e0b' : '#10b981'};"></div>
          </div>
          <span style="font-size: 0.75rem; font-weight: 700;">${m.health_score || 90}%</span>
        </div>
      </td>
      <td>${getStatusBadge(m.status)}</td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          <button class="btn btn-secondary btn-sm" onclick="openEditMachineModal('${m.machine_id}')" title="Edit Machine">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteMachine('${m.machine_id}')" title="Delete Machine">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterMachinesList() {
  const query = (document.getElementById('machineSearchInput')?.value || '').toLowerCase().trim();
  const status = document.getElementById('statusFilterSelect')?.value || '';

  const filtered = SEMS_STATE.machines.filter(m => {
    const matchesQ = !query || 
      m.machine_name.toLowerCase().includes(query) || 
      m.machine_id.toLowerCase().includes(query) || 
      (m.department && m.department.toLowerCase().includes(query)) ||
      (m.category && m.category.toLowerCase().includes(query));
    const matchesStatus = !status || m.status === status;
    return matchesQ && matchesStatus;
  });

  const tbody = document.getElementById('machinesTableBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
      <i class="fa-solid fa-magnifying-glass" style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
      No equipment found matching "<strong>${query || status}</strong>".
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.slice(0, 30).map(m => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 700;">${m.machine_id}</td>
      <td style="font-weight: 700;">${m.machine_name}</td>
      <td>${m.category}</td>
      <td>${m.location}</td>
      <td style="font-family: var(--font-mono); font-size: 0.85rem;">${m.install_date}</td>
      <td style="font-family: var(--font-mono); font-size: 0.85rem;">${m.next_service_date || '2026-09-25'}</td>
      <td><span style="font-weight: 700;">${m.health_score || 90}%</span></td>
      <td>${getStatusBadge(m.status)}</td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          <button class="btn btn-secondary btn-sm" onclick="openEditMachineModal('${m.machine_id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteMachine('${m.machine_id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openEditMachineModal(machineId) {
  const m = SEMS_STATE.machines.find(item => item.machine_id === machineId);
  if (!m) return;

  document.getElementById('editMachineIdHidden').value = m.machine_id;
  document.getElementById('editMachineIdDisplay').value = m.machine_id;
  document.getElementById('editMachineName').value = m.machine_name;
  document.getElementById('editCategory').value = m.category;
  document.getElementById('editDepartment').value = m.department;
  document.getElementById('editLocation').value = m.location;
  document.getElementById('editStatus').value = m.status;

  openModal('editMachineModal');
}

async function submitEditMachine() {
  const mId = document.getElementById('editMachineIdHidden').value;
  const updatedData = {
    machine_name: document.getElementById('editMachineName').value.trim(),
    category: document.getElementById('editCategory').value.trim(),
    department: document.getElementById('editDepartment').value.trim(),
    location: document.getElementById('editLocation').value.trim(),
    status: document.getElementById('editStatus').value
  };

  if (!updatedData.machine_name) {
    alert('Machine Name cannot be empty.');
    return;
  }

  try {
    const res = await fetch(`/api/machines/${mId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    if (res.ok) {
      const targetIdx = SEMS_STATE.machines.findIndex(m => m.machine_id === mId);
      if (targetIdx !== -1) {
        SEMS_STATE.machines[targetIdx] = { ...SEMS_STATE.machines[targetIdx], ...updatedData };
      }
      renderMachinesTable();
      closeModal('editMachineModal');
      showToast(`Machine ${mId} details updated.`);
    }
  } catch (e) {
    showToast(`Failed to update machine.`);
  }
}

async function deleteMachine(machineId) {
  if (confirm(`Are you sure you want to delete Machine ${machineId}? This will remove all associated logs.`)) {
    try {
      const res = await fetch(`/api/machines/${machineId}`, { method: 'DELETE' });
      if (res.ok) {
        SEMS_STATE.machines = SEMS_STATE.machines.filter(m => m.machine_id !== machineId);
        if (SEMS_STATE.kpiData.total_machines > 0) SEMS_STATE.kpiData.total_machines -= 1;
        updateKPICards();
        renderMachinesTable();
        showToast(`Machine ${machineId} deleted successfully.`);
      }
    } catch (e) {
      showToast(`Error deleting machine: ${e}`);
    }
  }
}

function generateAutoId() {
  const randNum = Math.floor(100 + Math.random() * 900);
  document.getElementById('addMachineId').value = `MCH-IND-${randNum}`;
}

async function submitAddMachine() {
  const machineId = document.getElementById('addMachineId').value.trim();
  const machineName = document.getElementById('addMachineName').value.trim();

  if (!machineId || !machineName) {
    alert('Machine ID and Machine Name are required.');
    return;
  }

  const newMachine = {
    machine_id: machineId,
    machine_name: machineName,
    machine_type: document.getElementById('addMachineType').value,
    category: document.getElementById('addCategory').value,
    department: document.getElementById('addDepartment').value.trim(),
    location: document.getElementById('addLocation').value.trim(),
    install_date: document.getElementById('addInstallDate').value,
    manufacturer: document.getElementById('addManufacturer').value.trim(),
    maintenance_interval: document.getElementById('addInterval').value,
    notes: document.getElementById('addNotes').value.trim(),
    status: 'Active',
    health_score: 98
  };

  try {
    const res = await fetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMachine)
    });
    const result = await res.json();

    if (res.ok && result.status === 'success') {
      SEMS_STATE.machines.unshift(newMachine);
      SEMS_STATE.kpiData.total_machines += 1;
      SEMS_STATE.kpiData.active_machines += 1;
      updateKPICards();
      renderMachinesTable();

      showToast(`Machine ${machineId} registered successfully!`);
      document.getElementById('addMachineForm').reset();
      switchTab('machinesView', document.querySelector('[data-target=machinesView]'));
    } else {
      alert(result.message || 'Could not add machine.');
    }
  } catch (err) {
    showToast('Failed to connect to backend.');
  }
}

/* --------------------------------------------------------
   MODULE 4: MAINTENANCE SCHEDULER
   -------------------------------------------------------- */
function renderSchedulerTable() {
  const tbody = document.getElementById('schedulerTableBody');
  if (!tbody) return;

  const tasks = SEMS_STATE.maintenanceTasks;

  if (tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
      <i class="fa-solid fa-calendar-xmark" style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
      No maintenance tasks scheduled. Click "Schedule Maintenance Task" above.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = tasks.map(t => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 700;">#TASK-${t.maintenance_id}</td>
      <td style="font-weight: 700; color: var(--primary-dark);">${t.machine_name || t.machine_id}</td>
      <td><i class="fa-solid fa-user" style="color: var(--primary-blue); font-size: 0.8rem; margin-right: 0.25rem;"></i> ${t.technician_name || 'Marcus Vance'}</td>
      <td style="font-family: var(--font-mono); font-size: 0.85rem;">${t.maintenance_date}</td>
      <td><span class="priority-tag priority-${(t.priority || 'Medium').toLowerCase()}">${t.priority}</span></td>
      <td>${getStatusBadge(t.status)}</td>
      <td>${t.service_type || 'Routine Service'}</td>
      <td>
        <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-whatsapp btn-sm" onclick="openWhatsAppModal(${t.technician_id}, '${t.machine_id}', '${t.status === 'Overdue' ? 'Overdue Critical Alert' : 'Maintenance Due Reminder'}', '${t.priority || 'High'}', '${(t.description || t.service_type || '').replace(/'/g, "\\'")}')" title="Notify Assigned Technician on WhatsApp">
            <i class="fa-brands fa-whatsapp"></i>
          </button>
          ${t.status !== 'Completed' ? `
            <button class="btn btn-secondary btn-sm" onclick="completeMaintenanceTask(${t.maintenance_id})" title="Mark Completed">
              <i class="fa-solid fa-check"></i>
            </button>
          ` : `<span style="font-size: 0.78rem; color: #10b981; font-weight: 700;"><i class="fa-solid fa-check-double"></i> Done</span>`}
          <button class="btn btn-danger btn-sm" onclick="deleteMaintenanceTask(${t.maintenance_id})" title="Delete Task">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openScheduleModal() {
  const mSelect = document.getElementById('schedMachineSelect');
  if (mSelect) {
    mSelect.innerHTML = SEMS_STATE.machines.map(m => `<option value="${m.machine_id}">${m.machine_id} - ${m.machine_name}</option>`).join('');
  }

  const tSelect = document.getElementById('schedTechSelect');
  if (tSelect) {
    tSelect.innerHTML = SEMS_STATE.technicians.map(t => `<option value="${t.technician_id}">${t.name} (${t.department})</option>`).join('');
  }

  // Set default date to future (7 days ahead)
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const futureStr = d.toISOString().split('T')[0];
  const dateInput = document.getElementById('schedDate');
  if (dateInput) {
    dateInput.value = futureStr;
    dateInput.min = new Date().toISOString().split('T')[0];
  }

  openModal('scheduleModal');
}

async function submitScheduleTask() {
  const machineId = document.getElementById('schedMachineSelect').value;
  const techId = document.getElementById('schedTechSelect').value;
  const dateVal = document.getElementById('schedDate').value;
  const priority = document.getElementById('schedPriority').value;
  const serviceType = document.getElementById('schedServiceType').value.trim();
  const description = document.getElementById('schedDescription').value.trim();

  // Date validation
  if (!dateVal) {
    alert('Please select a valid scheduled service date.');
    return;
  }

  const newTask = {
    machine_id: machineId,
    technician_id: parseInt(techId) || 101,
    maintenance_date: dateVal,
    priority: priority,
    service_type: serviceType,
    description: description
  };

  try {
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    });

    if (res.ok) {
      // Re-fetch maintenance tasks
      const mRes = await fetch('/api/maintenance');
      if (mRes.ok) SEMS_STATE.maintenanceTasks = await mRes.json();

      SEMS_STATE.kpiData.maintenance_due += 1;
      updateKPICards();
      renderSchedulerTable();
      renderRecentActivityTable();

      closeModal('scheduleModal');
      showToast('Maintenance task scheduled successfully!');
    }
  } catch (err) {
    showToast('Failed to schedule maintenance.');
  }
}

async function completeMaintenanceTask(taskId) {
  try {
    const res = await fetch(`/api/maintenance/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completed', notes: 'Completed by field engineer.' })
    });

    if (res.ok) {
      const task = SEMS_STATE.maintenanceTasks.find(t => t.maintenance_id === taskId);
      if (task) task.status = 'Completed';

      SEMS_STATE.kpiData.completed_services += 1;
      if (SEMS_STATE.kpiData.maintenance_due > 0) SEMS_STATE.kpiData.maintenance_due -= 1;

      updateKPICards();
      renderSchedulerTable();
      showToast(`Task #TASK-${taskId} marked as completed.`);
    }
  } catch (e) {
    showToast('Could not update task status.');
  }
}

async function deleteMaintenanceTask(taskId) {
  if (confirm(`Delete maintenance task #TASK-${taskId}?`)) {
    try {
      const res = await fetch(`/api/maintenance/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        SEMS_STATE.maintenanceTasks = SEMS_STATE.maintenanceTasks.filter(t => t.maintenance_id !== taskId);
        renderSchedulerTable();
        showToast(`Task #TASK-${taskId} deleted.`);
      }
    } catch (e) {
      showToast('Failed to delete task.');
    }
  }
}

/* --------------------------------------------------------
   MODULE 5: TECHNICIAN MANAGEMENT (WHATSAPP ENABLED)
   -------------------------------------------------------- */
function renderTechniciansTable() {
  const tbody = document.getElementById('techniciansTableBody');
  if (!tbody) return;

  const techs = SEMS_STATE.technicians;

  if (techs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
      <i class="fa-solid fa-users-slash" style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
      No technicians registered. Click "Add New Technician" above.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = techs.map(t => {
    const rawPhone = t.phone || 'Not specified';
    const email = t.email || '';
    return `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 700;">#TECH-${t.technician_id}</td>
        <td style="font-weight: 700; color: var(--primary-dark);">
          <a href="javascript:void(0)" onclick="openWhatsAppModalForTech(${t.technician_id})" title="Click to send WhatsApp message" style="color: var(--primary-dark); display: inline-flex; align-items: center; gap: 0.35rem;">
            <i class="fa-solid fa-user-gear" style="color: var(--primary-blue); font-size: 0.85rem;"></i>
            ${t.name}
          </a>
        </td>
        <td>
          <a href="javascript:void(0)" onclick="openWhatsAppModalForTech(${t.technician_id})" class="whatsapp-badge" title="Click to message on WhatsApp (${rawPhone})">
            <i class="fa-brands fa-whatsapp" style="font-size: 0.95rem;"></i>
            <span>${rawPhone}</span>
          </a>
        </td>
        <td>${t.department}</td>
        <td style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--text-muted);">
          ${email ? `<span title="${email}">${email}</span>` : '<span style="color: var(--text-light); font-style: italic;">Optional</span>'}
        </td>
        <td><span style="font-weight: 800; color: var(--primary-navy);">${t.assigned_tasks || 0} Tasks</span></td>
        <td>
          <span class="status-badge ${t.status === 'Available' ? 'badge-active' : t.status === 'Busy' ? 'badge-overdue' : 'badge-due'}">
            ${t.status || 'Available'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="openEditTechModal(${t.technician_id})" title="Edit Technician Details">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-whatsapp btn-sm" onclick="openWhatsAppModalForTech(${t.technician_id})" title="Send WhatsApp Message">
              <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteTechnician(${t.technician_id})" title="Remove Technician">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function submitAddTechnician() {
  const name = document.getElementById('techNameInput').value.trim();
  const phone = document.getElementById('techPhoneInput').value.trim();
  const dept = document.getElementById('techDeptInput').value.trim();
  const email = (document.getElementById('techEmailInput')?.value || '').trim();

  if (!name || !phone) {
    alert('Technician Full Name and WhatsApp Contact Number are required.');
    return;
  }

  // Basic phone sanity check (must have at least 7 digits)
  const cleanDigits = phone.replace(/\D/g, '');
  if (cleanDigits.length < 7) {
    alert('Please enter a valid WhatsApp phone number (e.g. 8946028566 or +91 8946028566).');
    return;
  }

  if (email && !validateEmail(email)) {
    alert('Please enter a valid email address or leave the field blank.');
    return;
  }

  const newTech = { name, phone, department: dept, email };

  try {
    const res = await fetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTech)
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      const techRes = await fetch('/api/technicians');
      if (techRes.ok) SEMS_STATE.technicians = await techRes.json();

      renderTechniciansTable();
      populateWhatsAppTechDropdown();
      closeModal('addTechModal');
      document.getElementById('addTechForm').reset();
      showToast(`Technician ${name} registered with WhatsApp (${phone})!`);
    } else {
      alert(data.message || 'Failed to register technician.');
    }
  } catch (e) {
    showToast('Failed to register technician.');
  }
}

function openEditTechModal(techId) {
  const t = SEMS_STATE.technicians.find(item => item.technician_id === techId);
  if (!t) return;

  document.getElementById('editTechIdHidden').value = t.technician_id;
  document.getElementById('editTechName').value = t.name;
  document.getElementById('editTechPhone').value = t.phone || '';
  document.getElementById('editTechDept').value = t.department || '';
  document.getElementById('editTechEmail').value = t.email || '';
  document.getElementById('editTechStatus').value = t.status || 'Available';

  openModal('editTechModal');
}

async function submitEditTechnician() {
  const techId = document.getElementById('editTechIdHidden').value;
  const name = document.getElementById('editTechName').value.trim();
  const phone = document.getElementById('editTechPhone').value.trim();
  const dept = document.getElementById('editTechDept').value.trim();
  const email = document.getElementById('editTechEmail').value.trim();
  const status = document.getElementById('editTechStatus').value;

  if (!name || !phone) {
    alert('Technician Name and WhatsApp Phone Number cannot be empty.');
    return;
  }

  if (email && !validateEmail(email)) {
    alert('Invalid email format. Please check the email or leave blank.');
    return;
  }

  const updated = { name, phone, department: dept, email, status };

  try {
    const res = await fetch(`/api/technicians/${techId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      const idx = SEMS_STATE.technicians.findIndex(t => t.technician_id == techId);
      if (idx !== -1) {
        SEMS_STATE.technicians[idx] = { ...SEMS_STATE.technicians[idx], ...updated };
      }
      renderTechniciansTable();
      populateWhatsAppTechDropdown();
      closeModal('editTechModal');
      showToast(`Technician ${name} updated successfully.`);
    } else {
      alert(data.message || 'Failed to update technician.');
    }
  } catch (e) {
    showToast('Failed to update technician.');
  }
}

async function deleteTechnician(techId) {
  if (confirm(`Are you sure you want to remove technician record #TECH-${techId}?`)) {
    try {
      const res = await fetch(`/api/technicians/${techId}`, { method: 'DELETE' });
      if (res.ok) {
        SEMS_STATE.technicians = SEMS_STATE.technicians.filter(t => t.technician_id != techId);
        renderTechniciansTable();
        populateWhatsAppTechDropdown();
        showToast(`Technician removed.`);
      }
    } catch (e) {
      showToast('Error removing technician.');
    }
  }
}

function populateWhatsAppTechDropdown() {
  const select = document.getElementById('waTechSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Select Registered Field Engineer --</option>' +
    SEMS_STATE.technicians.map(t => {
      const phoneDisplay = t.phone || 'No phone';
      return `<option value="${t.technician_id}">${t.name} (${phoneDisplay} - ${t.department})</option>`;
    }).join('');

  if (currentVal && SEMS_STATE.technicians.some(t => t.technician_id == currentVal)) {
    select.value = currentVal;
  }
}

function applySelectedTechWhatsApp() {
  const techId = document.getElementById('waTechSelect').value;
  const t = SEMS_STATE.technicians.find(item => item.technician_id == techId);
  const phoneInput = document.getElementById('waRecipientPhone');

  if (t && phoneInput) {
    phoneInput.value = t.phone || '';
  }
  updateWhatsAppPreview();
}

/* --------------------------------------------------------
   MODULE 6: WHATSAPP MESSAGING & NOTIFICATION CENTER
   -------------------------------------------------------- */

/**
 * Normalizes phone numbers to pure digits including country code for WhatsApp URLs.
 * Automatically adds country code 91 for standard 10-digit Indian numbers.
 */
function formatWhatsAppNumber(rawPhone, defaultCountry = '91') {
  if (!rawPhone) return '';
  // Remove spaces, parentheses, hyphens
  let clean = rawPhone.replace(/[^\d+]/g, '');

  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }
  if (clean.startsWith('00')) {
    clean = clean.substring(2);
  }
  // Remove leading single 0 if domestic style
  if (clean.length === 11 && clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  // If 10 digits, prepend default country code (e.g. 91)
  if (clean.length === 10) {
    clean = defaultCountry + clean;
  }
  return clean;
}

/**
 * Builds the structured WhatsApp notification text with rich formatting
 */
function generateWhatsAppMessageText() {
  const techId = document.getElementById('waTechSelect')?.value;
  const t = SEMS_STATE.technicians.find(item => item.technician_id == techId);
  const techName = t ? t.name : 'Field Reliability Engineer';
  const phone = document.getElementById('waRecipientPhone')?.value || (t ? t.phone : '');

  const machineId = document.getElementById('waMachineSelect')?.value;
  const m = SEMS_STATE.machines.find(item => item.machine_id === machineId) || {
    machine_id: machineId || 'MCH-UNIT',
    machine_name: 'Industrial Equipment Unit',
    category: 'General Equipment',
    department: 'Main Plant Floor',
    location: 'Bay A',
    status: 'Active',
    health_score: 95,
    manufacturer: 'Siemens Industrial'
  };

  const priority = document.getElementById('waPrioritySelect')?.value || 'High';
  const waType = document.getElementById('waTypeSelect')?.value || 'Maintenance Due Reminder';
  const dueDate = document.getElementById('waDueDateInput')?.value || new Date().toISOString().split('T')[0];
  const notes = (document.getElementById('waCustomNotes')?.value || '').trim();

  const priorityEmoji = priority === 'Critical' ? '🚨' : priority === 'High' ? '⚠️' : priority === 'Medium' ? '⚡' : 'ℹ️';

  let defaultTaskNotes = '';
  if (waType === 'Maintenance Due Reminder') {
    defaultTaskNotes = 'Scheduled preventive maintenance due. Conduct thorough visual inspection, test vibration thresholds, replenish lubricants, and record resolution in SEMS.';
  } else if (waType === 'Overdue Critical Alert') {
    defaultTaskNotes = 'URGENT ATTENTION REQUIRED: Scheduled servicing for this asset is OVERDUE! Immediate diagnostic check and safety verification must be performed to prevent equipment failure.';
  } else if (waType === 'Equipment Breakdown Emergency') {
    defaultTaskNotes = 'EMERGENCY SHUTDOWN ALERT: Equipment reported breakdown during active shift. Immediate technical intervention and component triage required at workstation.';
  } else if (waType === 'Technician Assignment Work Order') {
    defaultTaskNotes = 'You have been assigned as the primary reliability lead for this unit. Please inspect maintenance logbook and schedule necessary toolsets.';
  } else {
    defaultTaskNotes = 'Perform routine maintenance check, test calibration accuracy, and confirm operational health score.';
  }

  const taskNotes = notes || defaultTaskNotes;

  return `🔧 *SMART FACTORY | EQUIPMENT MAINTENANCE DISPATCH*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Assigned Specialist:* ${techName} (${phone})
${priorityEmoji} *Priority Level:* *${priority.toUpperCase()}*
📋 *Work Order Type:* ${waType}

🏭 *EQUIPMENT SPECIFICATIONS:*
• *Machine ID:* ${m.machine_id}
• *Machine Name:* ${m.machine_name}
• *Category:* ${m.category || 'Machinery'}
• *Department:* ${m.department || 'Production'}
• *Plant Location:* ${m.location || 'Main Floor'}
• *Operating Status:* ${m.status || 'Active'} (Health Score: ${m.health_score || 90}%)
• *Manufacturer:* ${m.manufacturer || 'Siemens Industrial'}

📅 *Service Target Date:* ${dueDate}

📝 *REQUIRED OPERATIONAL INSTRUCTIONS:*
${taskNotes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏭 *SEMS Industrial Platform | Plant Reliability Ops*`;
}

function updateWhatsAppPreview() {
  const bubble = document.getElementById('whatsappMessageBubble');
  if (!bubble) return;

  const rawText = generateWhatsAppMessageText();

  // Convert WhatsApp *bold* to <strong>, and \n to <br> for the preview chat bubble
  let formattedHtml = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bubble.innerHTML = `
    <div>${formattedHtml}</div>
    <div class="whatsapp-bubble-time">
      <span>${timeStr}</span>
      <i class="fa-solid fa-check-double" style="color: #53bdeb; font-size: 0.75rem;"></i>
    </div>
  `;
}

function handleWATypeChange() {
  const type = document.getElementById('waTypeSelect')?.value;
  const prioSelect = document.getElementById('waPrioritySelect');
  const notesArea = document.getElementById('waCustomNotes');

  if (type === 'Overdue Critical Alert' || type === 'Equipment Breakdown Emergency') {
    if (prioSelect) prioSelect.value = 'Critical';
  } else if (type === 'Maintenance Due Reminder') {
    if (prioSelect) prioSelect.value = 'High';
  } else if (type === 'Technician Assignment Work Order') {
    if (prioSelect) prioSelect.value = 'Medium';
  } else {
    if (prioSelect) prioSelect.value = 'Low';
  }

  updateWhatsAppPreview();
}

function openWhatsAppModal(presetTechId = null, presetMachineId = null, presetType = 'Maintenance Due Reminder', presetPriority = 'High', presetNotes = '') {
  // 1. Populate Machine dropdown
  const mSelect = document.getElementById('waMachineSelect');
  if (mSelect) {
    mSelect.innerHTML = SEMS_STATE.machines.map(m => `
      <option value="${m.machine_id}">${m.machine_id} - ${m.machine_name} (${m.department})</option>
    `).join('');
    if (presetMachineId) mSelect.value = presetMachineId;
  }

  // 2. Populate Technician dropdown
  populateWhatsAppTechDropdown();
  const tSelect = document.getElementById('waTechSelect');
  if (tSelect) {
    if (presetTechId) {
      tSelect.value = presetTechId;
    } else if (SEMS_STATE.technicians.length > 0) {
      tSelect.value = SEMS_STATE.technicians[0].technician_id;
    }
  }

  // 3. Set phone number
  applySelectedTechWhatsApp();

  // 4. Set Type, Priority, Date, Notes
  const typeSelect = document.getElementById('waTypeSelect');
  if (typeSelect) typeSelect.value = presetType;

  const prioSelect = document.getElementById('waPrioritySelect');
  if (prioSelect) prioSelect.value = presetPriority;

  const dateInput = document.getElementById('waDueDateInput');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  const notesInput = document.getElementById('waCustomNotes');
  if (notesInput) {
    notesInput.value = presetNotes || '';
  }

  // 5. Hide previous alert banner
  const banner = document.getElementById('whatsappDispatchStatusBanner');
  if (banner) banner.style.display = 'none';

  // 6. Update Preview & Open Modal
  updateWhatsAppPreview();
  openModal('sendWhatsAppModal');
}

function openWhatsAppModalForTech(techId) {
  // If machine is selected or default
  const defaultMachineId = SEMS_STATE.machines[0]?.machine_id || 'MCH-CNC-001';
  openWhatsAppModal(techId, defaultMachineId, 'Technician Assignment Work Order', 'High');
}

function openWhatsAppModalForAlert(machineId, message, dueDate, priority) {
  const isOverdue = priority === 'Critical' || (message && message.toLowerCase().includes('overdue'));
  const isBreakdown = message && message.toLowerCase().includes('breakdown');
  const type = isBreakdown ? 'Equipment Breakdown Emergency' : (isOverdue ? 'Overdue Critical Alert' : 'Maintenance Due Reminder');

  // Pick first technician assigned to machine or default
  const firstTech = SEMS_STATE.technicians[0];
  const techId = firstTech ? firstTech.technician_id : null;

  openWhatsAppModal(techId, machineId, type, priority, message);

  const dateInput = document.getElementById('waDueDateInput');
  if (dateInput && dueDate) {
    dateInput.value = dueDate;
    updateWhatsAppPreview();
  }
}

function copyWhatsAppMessage() {
  const text = generateWhatsAppMessageText();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('✓ WhatsApp message copied to clipboard!');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showToast('✓ WhatsApp message copied to clipboard!');
}

/**
 * Dispatches WhatsApp message directly via device WhatsApp account (Web or Desktop App)
 * and logs the notification to the backend.
 */
async function submitWhatsAppDispatch(mode = 'auto') {
  if (SEMS_STATE.isSendingWA) return;

  const phoneInput = document.getElementById('waRecipientPhone');
  const rawPhone = phoneInput ? phoneInput.value.trim() : '';

  const banner = document.getElementById('whatsappDispatchStatusBanner');
  const btn = document.getElementById('sendWhatsAppBtn');
  const btnIcon = document.getElementById('sendWABtnIcon');
  const btnText = document.getElementById('sendWABtnText');

  const cleanPhone = formatWhatsAppNumber(rawPhone);

  if (!cleanPhone || cleanPhone.length < 10) {
    if (banner) {
      banner.style.display = 'block';
      banner.style.background = '#fee2e2';
      banner.style.color = '#b91c1c';
      banner.style.border = '1px solid #fca5a5';
      banner.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Please enter a valid 10+ digit WhatsApp phone number with country code (e.g. 8946028566 or +91 8946028566).`;
    }
    return;
  }

  const messageText = generateWhatsAppMessageText();
  const encodedMessage = encodeURIComponent(messageText);

  // Construct target WhatsApp URL
  // If mode === 'web', force WhatsApp Web directly in browser tab
  // If mode === 'auto', use api.whatsapp.com/send which seamlessly delegates to WhatsApp Desktop or Web
  let whatsappUrl = '';
  if (mode === 'web') {
    whatsappUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  } else {
    whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  }

  // Trigger WhatsApp launch on the device
  window.open(whatsappUrl, '_blank');

  // Log dispatch in backend database
  const techId = document.getElementById('waTechSelect')?.value;
  const techObj = SEMS_STATE.technicians.find(t => t.technician_id == techId);
  const techName = techObj ? techObj.name : 'Field Specialist';
  const machineId = document.getElementById('waMachineSelect')?.value || 'Industrial Equipment';
  const priority = document.getElementById('waPrioritySelect')?.value || 'High';
  const waType = document.getElementById('waTypeSelect')?.value || 'WhatsApp Work Order';
  const dueDate = document.getElementById('waDueDateInput')?.value || new Date().toISOString().split('T')[0];

  SEMS_STATE.isSendingWA = true;
  if (btn) btn.disabled = true;
  if (btnIcon) btnIcon.className = 'fa-solid fa-spinner fa-spin';
  if (btnText) btnText.innerText = 'Connecting WhatsApp...';

  if (banner) {
    banner.style.display = 'block';
    banner.style.background = '#ecfdf5';
    banner.style.color = '#065f46';
    banner.style.border = '1px solid #a7f3d0';
    banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> WhatsApp window opened for <strong>+${cleanPhone}</strong>. Logging alert in SEMS...`;
  }

  try {
    const res = await fetch('/api/notifications/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        technician_name: techName,
        phone: cleanPhone,
        machine_id: machineId,
        message: messageText,
        priority: priority,
        notification_type: waType,
        due_date: dueDate
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        SEMS_STATE.notifications = await notifRes.json();
        renderNotifications();
      }
      showToast(`✓ WhatsApp message dispatched to ${techName} (+${cleanPhone})!`);
      setTimeout(() => {
        closeModal('sendWhatsAppModal');
      }, 1500);
    }
  } catch (err) {
    console.warn("Backend notification log note:", err);
  } finally {
    SEMS_STATE.isSendingWA = false;
    if (btn) btn.disabled = false;
    if (btnIcon) btnIcon.className = 'fa-brands fa-whatsapp';
    if (btnText) btnText.innerText = 'Send via WhatsApp';
  }
}

function renderNotifications() {
  const feed = document.getElementById('notificationFeed');
  if (!feed) return;

  const alerts = SEMS_STATE.notifications;

  // Update unread count badge
  const unreadCount = alerts.filter(n => n.status === 'Unread').length;
  const badge = document.getElementById('unreadNotifBadge');
  if (badge) badge.innerText = unreadCount;

  if (alerts.length === 0) {
    feed.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 3rem;">
      <i class="fa-solid fa-bell-slash" style="font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
      No notifications at this time. System operating nominally.
    </div>`;
    return;
  }

  feed.innerHTML = alerts.map(n => {
    const isUnread = n.status === 'Unread';
    const isCritical = n.priority === 'Critical' || (n.notification_type && n.notification_type.includes('Alert'));
    const isWhatsApp = n.status === 'Sent via WhatsApp' || (n.notification_type && n.notification_type.toLowerCase().includes('whatsapp'));

    return `
      <div class="notification-item ${n.priority.toLowerCase()} ${isUnread ? 'unread' : 'read'}">
        <div class="notification-content">
          <div class="notification-icon" style="background: ${isWhatsApp ? '#dcfce7' : isCritical ? '#fee2e2' : '#fef3c7'}; color: ${isWhatsApp ? '#15803d' : isCritical ? '#dc2626' : '#d97706'};">
            <i class="${isWhatsApp ? 'fa-brands fa-whatsapp' : isCritical ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-bell'}"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span style="font-weight: 800; font-size: 0.95rem; color: var(--primary-dark);">
                ${n.notification_type || 'Alert'}: ${n.machine_id}
              </span>
              ${isUnread ? `<span class="priority-tag priority-critical" style="font-size: 0.7rem; padding: 0.15rem 0.4rem;">NEW</span>` : ''}
              ${isWhatsApp ? `<span class="whatsapp-badge" style="font-size: 0.68rem; padding: 0.1rem 0.4rem;"><i class="fa-brands fa-whatsapp"></i> WhatsApp Logged</span>` : ''}
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${n.message}</p>
            <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-light); margin-top: 0.5rem; flex-wrap: wrap;">
              <span><i class="fa-solid fa-calendar"></i> Due: ${n.due_date}</span>
              <span><i class="fa-solid fa-flag"></i> Priority: ${n.priority}</span>
              <span><i class="fa-solid fa-circle-check"></i> Status: ${n.status}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 0.4rem; align-self: center; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="viewNotificationDetails(${n.notification_id})" title="View Details">
            <i class="fa-solid fa-circle-info"></i> Details
          </button>
          ${isUnread ? `
            <button class="btn btn-outline btn-sm" onclick="markNotificationRead(${n.notification_id})" title="Mark as Read">
              <i class="fa-solid fa-check"></i> Read
            </button>
          ` : ''}
          <button class="btn btn-whatsapp btn-sm" onclick="openWhatsAppModalForAlert('${n.machine_id}', '${n.message.replace(/'/g, "\\'")}', '${n.due_date}', '${n.priority}')" title="Dispatch WhatsApp Alert">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function markNotificationRead(notifId) {
  try {
    const res = await fetch(`/api/notifications/${notifId}/read`, { method: 'PUT' });
    if (res.ok) {
      const notif = SEMS_STATE.notifications.find(n => n.notification_id == notifId);
      if (notif) notif.status = 'Read';
      renderNotifications();
      showToast(`Notification #${notifId} marked as read.`);
    }
  } catch (e) {
    showToast('Failed to update notification status.');
  }
}

function viewNotificationDetails(notifId) {
  const n = SEMS_STATE.notifications.find(item => item.notification_id == notifId);
  if (!n) return;

  const body = document.getElementById('notificationDetailsBody');
  if (body) {
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
          <span style="color: var(--text-muted); font-size: 0.85rem;">Notification ID</span>
          <span style="font-family: var(--font-mono); font-weight: 700;">#NOTIF-${n.notification_id}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
          <span style="color: var(--text-muted); font-size: 0.85rem;">Target Machine</span>
          <span style="font-weight: 700; color: var(--primary-dark);">${n.machine_id}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
          <span style="color: var(--text-muted); font-size: 0.85rem;">Priority Level</span>
          <span class="priority-tag priority-${n.priority.toLowerCase()}">${n.priority}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
          <span style="color: var(--text-muted); font-size: 0.85rem;">Scheduled Date</span>
          <span style="font-family: var(--font-mono);">${n.due_date}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
          <span style="color: var(--text-muted); font-size: 0.85rem;">Dispatch Status</span>
          <span style="font-weight: 700; color: ${n.status.includes('WhatsApp') ? '#10b981' : n.status === 'Unread' ? '#dc2626' : '#2563eb'};">${n.status}</span>
        </div>
        <div style="margin-top: 0.5rem;">
          <span style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">Alert Message:</span>
          <div style="background: var(--bg-main); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.9rem; line-height: 1.5; border: 1px solid var(--border-subtle);">
            ${n.message}
          </div>
        </div>
      </div>
    `;
  }

  const waBtn = document.getElementById('notifDetailsWABtn');
  if (waBtn) {
    waBtn.onclick = () => {
      closeModal('notificationDetailsModal');
      openWhatsAppModalForAlert(n.machine_id, n.message, n.due_date, n.priority);
    };
  }

  openModal('notificationDetailsModal');
}

/* --------------------------------------------------------
   MODULE 7: REPORTS & EXPORT AUDITS (PDF / EXCEL)
   -------------------------------------------------------- */
function exportToPDF() {
  if (!window.jspdf) {
    alert("jsPDF library loading...");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("SMART EQUIPMENT MAINTENANCE SYSTEM (SEMS)", 14, 20);

  doc.setFontSize(11);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Plant Asset Reliability & Maintenance Operations Audit", 14, 28);
  doc.text(`Generated Date: ${new Date().toLocaleDateString()} | Author: ${SEMS_STATE.currentUser ? SEMS_STATE.currentUser.name : 'Plant Admin'}`, 14, 34);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 38, 196, 38);

  doc.setFont("Helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("1. EXECUTIVE OPERATIONS KPIs", 14, 48);

  doc.setFont("Helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`• Total Registered Machines: ${SEMS_STATE.kpiData.total_machines}`, 20, 56);
  doc.text(`• Active Operational Machines: ${SEMS_STATE.kpiData.active_machines}`, 20, 64);
  doc.text(`• Upcoming Maintenance Due: ${SEMS_STATE.kpiData.maintenance_due}`, 20, 72);
  doc.text(`• Overdue Critical Alerts: ${SEMS_STATE.kpiData.overdue_maintenance}`, 20, 80);
  doc.text(`• YTD Completed Services: ${SEMS_STATE.kpiData.completed_services}`, 20, 88);

  doc.setFont("Helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("2. MONITORED EQUIPMENT STATUS SAMPLES", 14, 102);

  let y = 112;
  SEMS_STATE.machines.slice(0, 12).forEach((m, idx) => {
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(`${idx + 1}. [${m.machine_id}] ${m.machine_name} - ${m.status} (Health: ${m.health_score || 95}%)`, 20, y);
    y += 8;
  });

  doc.save("SEMS_Industrial_Maintenance_Audit.pdf");
  showToast("PDF Maintenance Audit Report generated & downloaded!");
}

function exportToExcel() {
  if (!window.XLSX) {
    alert("SheetJS library loading...");
    return;
  }
  const worksheetData = [
    ["Machine ID", "Machine Name", "Category", "Department", "Location", "Manufacturer", "Install Date", "Next Service Date", "Health Score", "Status"],
    ...SEMS_STATE.machines.map(m => [
      m.machine_id,
      m.machine_name,
      m.category,
      m.department,
      m.location,
      m.manufacturer || 'Siemens Industrial',
      m.install_date,
      m.next_service_date || '2026-09-25',
      `${m.health_score || 90}%`,
      m.status
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Machine Inventory");
  XLSX.writeFile(wb, "SEMS_Equipment_Inventory_Audit.xlsx");

  showToast("Excel spreadsheet exported successfully!");
}

/* --------------------------------------------------------
   UI HELPERS & BADGES
   -------------------------------------------------------- */
function getStatusBadge(status) {
  switch (status) {
    case 'Active':
      return `<span class="status-badge badge-active"><i class="fa-solid fa-circle-check"></i> Active</span>`;
    case 'Under Maintenance':
    case 'Pending':
      return `<span class="status-badge badge-due"><i class="fa-solid fa-wrench"></i> Under Service</span>`;
    case 'Breakdown':
    case 'Overdue':
      return `<span class="status-badge badge-overdue"><i class="fa-solid fa-triangle-exclamation"></i> Overdue / Breakdown</span>`;
    case 'Scheduled':
      return `<span class="status-badge badge-scheduled"><i class="fa-solid fa-clock"></i> Scheduled</span>`;
    case 'Completed':
      return `<span class="status-badge badge-active"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
    default:
      return `<span class="status-badge badge-active">${status || 'Active'}</span>`;
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color: #38bdf8;"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
