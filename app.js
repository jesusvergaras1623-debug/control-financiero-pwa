/* ═══════════════════════════════════════════════════════════════════
   CONTROL FINANCIERO PWA — App v2.0
   Refactored: clean code, Canvas charts, animations, filters
   ═══════════════════════════════════════════════════════════════════ */

// ── Constants ──────────────────────────────────────────────────────
const STORAGE = 'control_financiero_data_v1';

const DEFAULT = {
  accounts: [
    { id: 'bancolombia', name: 'Bancolombia', balance: 0, active: true },
    { id: 'nequi', name: 'Nequi', balance: 0, active: true },
    { id: 'nu', name: 'Nu', balance: 0, active: true },
    { id: 'sistecredito', name: 'Sistecredito', balance: 0, active: true },
    { id: 'efectivo', name: 'Efectivo', balance: 0, active: true },
    { id: 'otro', name: 'Otro', balance: 0, active: true }
  ],
  categories: [
    'Vivienda', 'Alimentación', 'Transporte', 'Servicios',
    'Educación', 'Salud', 'Entretenimiento', 'Compras',
    'Deudas', 'Ahorro', 'Otros'
  ],
  movements: [],
  budgets: [],
  debts: [],
  payments: []
};

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#d946ef'
];

const NAV_ITEMS = [
  ['dashboard', '⌂', 'Dashboard'],
  ['movements', '↕', 'Movimientos'],
  ['budget', '◫', 'Presupuesto'],
  ['debts', '◈', 'Deudas'],
  ['accounts', '◉', 'Cuentas'],
  ['settings', '⚙', 'Ajustes']
];

// ── State ──────────────────────────────────────────────────────────
let db = load();
let state = {
  page: 'dashboard',
  month: currentMonth(),
  movementFilter: { search: '', type: '' }
};

// ── Formatters ─────────────────────────────────────────────────────
const moneyFmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const dateFmt = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
});

// ── Utility Functions ──────────────────────────────────────────────

function load() {
  try {
    return { ...structuredClone(DEFAULT), ...JSON.parse(localStorage.getItem(STORAGE) || '{}') };
  } catch {
    return structuredClone(DEFAULT);
  }
}

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(db));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function money(v) {
  return moneyFmt.format(Number(v) || 0);
}

function parseNum(v) {
  if (typeof v === 'string') {
    v = v.replace(/[$ \.]/g, '').replace(',', '.');
  }
  return Math.max(0, Number(v) || 0);
}

function monthOf(date) {
  return String(date).slice(0, 7);
}

function monthName(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
    .format(new Date(y, m - 1, 1));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

function setPage(page) {
  state.page = page;
  state.movementFilter = { search: '', type: '' };
  render();
}

// ── Theme Toggle ───────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('cf_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeButton(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cf_theme', next);
  updateThemeButton(next);

  // Update theme-color meta tag
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = next === 'dark' ? '#0a0e1a' : '#f5f7fb';
}

function updateThemeButton(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ── Initialization ─────────────────────────────────────────────────

function init() {
  initTheme();

  document.getElementById('monthInput').value = state.month;
  document.getElementById('monthInput').addEventListener('change', e => {
    state.month = e.target.value || currentMonth();
    render();
  });

  document.getElementById('quickAddBtn').onclick = () => openMovement();
  document.getElementById('backupBtn').onclick = exportBackup;
  document.getElementById('importInput').addEventListener('change', importBackup);
  document.getElementById('themeToggle').onclick = toggleTheme;

  render();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }

  // PWA Install
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window.deferredPrompt = e;
    document.getElementById('installBtn').classList.remove('hidden');
  });

  document.getElementById('installBtn').onclick = async () => {
    if (!window.deferredPrompt) return;
    window.deferredPrompt.prompt();
    window.deferredPrompt = null;
    document.getElementById('installBtn').classList.add('hidden');
  };

  // Event delegation for dynamic content
  document.getElementById('content').addEventListener('click', handleContentClick);
  document.getElementById('modalRoot').addEventListener('click', handleModalClick);
  document.getElementById('bottomNav').addEventListener('click', handleBottomNavClick);
}

// ── Event Delegation ───────────────────────────────────────────────

function handleContentClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  switch (action) {
    case 'open-movement': openMovement(); break;
    case 'delete-movement': deleteMovement(id); break;
    case 'open-debt': openDebt(id || ''); break;
    case 'open-payment': openPayment(id); break;
    case 'view-payments': viewDebtPayments(id); break;
    case 'edit-debt': openDebt(id); break;
    case 'delete-debt': deleteDebt(id); break;
    case 'open-account': openAccount(id || ''); break;
    case 'save-budget': saveBudgetAll(); break;
    case 'add-category': addCategory(); break;
    case 'remove-category': removeCategory(btn.dataset.cat); break;
    case 'export-backup': exportBackup(); break;
    case 'reset-data': resetData(); break;
    case 'goto': setPage(btn.dataset.page); break;
  }
}

function handleModalClick(e) {
  const btn = e.target.closest('[data-modal-action]');
  if (!btn) return;

  const action = btn.dataset.modalAction;
  const id = btn.dataset.id;

  switch (action) {
    case 'close': closeModal(); break;
    case 'save-movement': saveMovement(id || ''); break;
    case 'save-debt': saveDebt(id || ''); break;
    case 'save-payment': savePayment(id); break;
    case 'delete-payment': deletePayment(id); break;
    case 'confirm-yes':
      if (window._confirmResolve) window._confirmResolve(true);
      closeModal();
      break;
    case 'confirm-no':
      if (window._confirmResolve) window._confirmResolve(false);
      closeModal();
      break;
  }

  // Close on backdrop click
  if (e.target.classList.contains('modal-backdrop')) {
    closeModal();
  }
}

function handleBottomNavClick(e) {
  const btn = e.target.closest('[data-page]');
  if (btn) setPage(btn.dataset.page);
}

// ── Custom Confirm ─────────────────────────────────────────────────

function customConfirm(title, text) {
  return new Promise(resolve => {
    window._confirmResolve = resolve;
    document.getElementById('modalRoot').innerHTML = `
      <div class="modal-backdrop">
        <div class="modal confirm-modal">
          <div class="confirm-icon">⚠️</div>
          <div class="confirm-title">${esc(title)}</div>
          <div class="confirm-text">${esc(text)}</div>
          <div class="modal-actions">
            <button class="secondary-btn" data-modal-action="confirm-no">Cancelar</button>
            <button class="danger-btn" data-modal-action="confirm-yes">Confirmar</button>
          </div>
        </div>
      </div>`;
    document.body.classList.add('modal-open');
  });
}

// ── Rendering ──────────────────────────────────────────────────────

function renderNav() {
  const navHTML = NAV_ITEMS.map(([k, i, n]) => `
    <button class="${state.page === k ? 'active' : ''}" data-page="${k}">
      <span class="ico">${i}</span>${n}
    </button>
  `).join('');

  document.getElementById('nav').innerHTML = navHTML;
  document.querySelectorAll('#nav button').forEach(b =>
    b.onclick = () => setPage(b.dataset.page)
  );

  // Bottom nav (mobile)
  document.getElementById('bottomNav').innerHTML = NAV_ITEMS.map(([k, i, n]) => `
    <button class="${state.page === k ? 'active' : ''}" data-page="${k}">
      <span class="ico">${i}</span>${n}
    </button>
  `).join('');
}

function render() {
  renderNav();
  document.getElementById('monthInput').value = state.month;

  const titles = {
    dashboard: ['Dashboard', 'Panorama de ' + monthName(state.month)],
    movements: ['Movimientos', 'Registra ingresos, gastos y transferencias'],
    budget: ['Presupuesto', 'Compara lo planeado con lo ejecutado'],
    debts: ['Deudas', 'Cuotas, intereses, abonos y saldos'],
    accounts: ['Cuentas', 'Bancolombia, Nequi, Nu, Sistecredito y efectivo'],
    settings: ['Configuración', 'Categorías y opciones de la aplicación']
  };

  document.getElementById('pageTitle').textContent = titles[state.page][0];
  document.getElementById('pageSubtitle').textContent = titles[state.page][1];

  const renderers = {
    dashboard: renderDashboard,
    movements: renderMovements,
    budget: renderBudget,
    debts: renderDebts,
    accounts: renderAccounts,
    settings: renderSettings
  };

  const c = document.getElementById('content');
  c.innerHTML = renderers[state.page]();
  bindPageEvents();

  // Render charts after DOM is ready
  requestAnimationFrame(() => {
    if (state.page === 'dashboard') renderDonutChart();
    animateNumbers();
  });
}

// ── Number Animation ───────────────────────────────────────────────

function animateNumbers() {
  document.querySelectorAll('.metric-value[data-value]').forEach(el => {
    const target = Number(el.dataset.value);
    const duration = 600;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      el.textContent = money(current);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

// ── Data Helpers ───────────────────────────────────────────────────

function monthMovements() {
  return db.movements.filter(m => monthOf(m.date) === state.month);
}

function monthIncome() {
  return monthMovements()
    .filter(m => m.type === 'Ingreso')
    .reduce((s, m) => s + Number(m.amount), 0);
}

function monthExpenses() {
  return monthMovements()
    .filter(m => m.type === 'Gasto')
    .reduce((s, m) => s + Number(m.amount), 0);
}

function monthTransfers() {
  return monthMovements()
    .filter(m => m.type === 'Transferencia')
    .reduce((s, m) => s + Number(m.amount), 0);
}

function debtPaidThisMonth() {
  return db.payments
    .filter(p => monthOf(p.date) === state.month)
    .reduce((s, p) => s + Number(p.principal) + Number(p.interest) + Number(p.fees), 0);
}

function debtBalances() {
  return db.debts.map(d => {
    const paid = db.payments.filter(p => p.debtId === d.id);
    const principal = paid.reduce((s, p) => s + Number(p.principal), 0);
    const interest = paid.reduce((s, p) => s + Number(p.interest), 0);
    const fees = paid.reduce((s, p) => s + Number(p.fees), 0);
    const balance = Math.max(0, Number(d.initialBalance || 0) - principal);
    return { ...d, principal, interest, fees, balance, totalPaid: principal + interest + fees };
  });
}

function upcomingDebtPayments() {
  return debtBalances()
    .filter(d => d.balance > 0 && d.paymentDay)
    .sort((a, b) => a.paymentDay - b.paymentDay);
}

function getBudget(cat) {
  return Number(db.budgets.find(b => b.month === state.month && b.category === cat)?.amount || 0);
}

function typePill(t) {
  const cls = t === 'Ingreso' ? 'good' : t === 'Gasto' ? 'bad' : 'neutral';
  return `<span class="pill ${cls}">${esc(t)}</span>`;
}

function healthStatus(income, expenses) {
  if (income === 0) return { cls: 'caution', text: 'Sin ingresos registrados', icon: '⏸' };
  const ratio = expenses / income;
  if (ratio <= 0.6) return { cls: 'healthy', text: 'Finanzas saludables', icon: '✓' };
  if (ratio <= 0.9) return { cls: 'caution', text: 'Gastos elevados — cuidado', icon: '⚡' };
  return { cls: 'critical', text: 'Gastos excesivos — alerta', icon: '⚠' };
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function renderDashboard() {
  const inc = monthIncome();
  const exp = monthExpenses();
  const debt = debtPaidThisMonth();
  const available = inc - exp - debt;
  const debts = debtBalances();
  const pending = debts.reduce((s, d) => s + d.balance, 0);
  const health = healthStatus(inc, exp);

  const cats = [...new Set([
    ...db.categories,
    ...monthMovements().map(m => m.category).filter(Boolean)
  ])];

  const catRows = cats.map(cat => {
    const actual = monthMovements()
      .filter(m => m.type === 'Gasto' && m.category === cat)
      .reduce((s, m) => s + Number(m.amount), 0);
    const b = getBudget(cat);
    return { cat, actual, b };
  }).filter(x => x.actual || x.b);

  const max = Math.max(...catRows.map(x => Math.max(x.actual, x.b)), 1);

  const mv = monthMovements()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return `
    <!-- Health Indicator -->
    <div class="health-indicator ${health.cls}" style="margin-bottom:16px">
      <span class="health-dot"></span>
      <span>${health.icon} ${health.text}</span>
    </div>

    <!-- Stats Cards -->
    <div class="grid stats">
      <div class="card stat-card income">
        <div class="stat-icon">📈</div>
        <div class="metric-label">Ingresos</div>
        <div class="metric-value" data-value="${inc}">${money(inc)}</div>
        <div class="metric-note">Entradas del mes</div>
      </div>
      <div class="card stat-card expense">
        <div class="stat-icon">📉</div>
        <div class="metric-label">Gastos</div>
        <div class="metric-value" data-value="${exp}">${money(exp)}</div>
        <div class="metric-note">Salidas registradas</div>
      </div>
      <div class="card stat-card debt-pay">
        <div class="stat-icon">💳</div>
        <div class="metric-label">Pagos de deuda</div>
        <div class="metric-value" data-value="${debt}">${money(debt)}</div>
        <div class="metric-note">Capital + intereses + recargos</div>
      </div>
      <div class="card stat-card available">
        <div class="stat-icon">${available < 0 ? '⚠️' : '💰'}</div>
        <div class="metric-label">Disponible</div>
        <div class="metric-value ${available < 0 ? 'bad' : 'good'}" data-value="${available}">${money(available)}</div>
        <div class="metric-note">Ingresos − gastos − deudas</div>
      </div>
      <div class="card stat-card pending">
        <div class="stat-icon">🏦</div>
        <div class="metric-label">Deuda pendiente</div>
        <div class="metric-value" data-value="${pending}">${money(pending)}</div>
        <div class="metric-note">Capital pendiente</div>
      </div>
    </div>

    <!-- Budget vs Expense + Donut Chart -->
    <div class="grid content-grid" style="margin-top:16px">
      <div class="card">
        <div class="section-title">
          <h2>Presupuesto vs. gasto</h2>
          <button class="small-btn" data-action="goto" data-page="budget">Ver presupuesto</button>
        </div>
        ${catRows.length ? catRows.map(x => `
          <div class="bar-row">
            <div>${esc(x.cat)}</div>
            <div class="bar"><span style="width:${Math.min(100, (x.actual / Math.max(max, 1)) * 100)}%"></span></div>
            <div style="text-align:right">
              ${money(x.actual)}${x.b ? ` <span class="muted">/ ${money(x.b)}</span>` : ''}
            </div>
          </div>
        `).join('') : '<div class="empty">Aún no hay gastos ni presupuestos para este mes.</div>'}
      </div>

      <div class="card">
        <div class="section-title">
          <h2>Gastos por categoría</h2>
        </div>
        <div class="chart-container">
          <canvas id="donutChart" width="220" height="220"></canvas>
        </div>
        <div id="chartLegend" class="chart-legend"></div>
      </div>
    </div>

    <!-- Recent Movements + Quick Summary + Upcoming Debts -->
    <div class="grid content-grid" style="margin-top:16px">
      <div class="card">
        <div class="section-title">
          <h2>Últimos movimientos</h2>
          <button class="small-btn" data-action="goto" data-page="movements">Ver todos</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Cuenta</th><th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${mv.map(m => `
                <tr>
                  <td>${esc(dateFmt.format(new Date(m.date + 'T12:00:00')))}</td>
                  <td>${typePill(m.type)}</td>
                  <td>${esc(m.description)}</td>
                  <td>${esc(m.account)}</td>
                  <td>${money(m.amount)}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="empty">No hay movimientos.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <!-- Quick Summary -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-title"><h2>Resumen rápido</h2></div>
          <div class="mini-cards">
            <div class="mini">
              <div class="k">Tasa gasto / ingreso</div>
              <div class="v">${inc ? ((exp / inc) * 100).toFixed(1) : 0}%</div>
            </div>
            <div class="mini">
              <div class="k">Movimientos</div>
              <div class="v">${monthMovements().length}</div>
            </div>
            <div class="mini">
              <div class="k">Deudas activas</div>
              <div class="v">${debts.filter(d => d.balance > 0).length}</div>
            </div>
            <div class="mini">
              <div class="k">Transferencias</div>
              <div class="v">${money(monthTransfers())}</div>
            </div>
          </div>
        </div>

        <!-- Upcoming Debts -->
        <div class="card">
          <div class="section-title">
            <h2>Próximas deudas</h2>
            <button class="small-btn" data-action="goto" data-page="debts">Ver deudas</button>
          </div>
          ${upcomingDebtPayments().slice(0, 4).map(d => `
            <div class="mini" style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong>${esc(d.creditor)}</strong>
                <span class="pill warn">Día ${d.paymentDay}</span>
              </div>
              <div class="debt-meta" style="margin-top:4px">
                Cuota ${money(d.agreedPayment)} · Saldo ${money(d.balance)}
              </div>
            </div>
          `).join('') || '<div class="empty">No tienes deudas con próximo pago configurado.</div>'}
        </div>
      </div>
    </div>`;
}

// ── Donut Chart (Canvas) ───────────────────────────────────────────

function renderDonutChart() {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 220;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const cats = [...new Set([
    ...db.categories,
    ...monthMovements().map(m => m.category).filter(Boolean)
  ])];

  const data = cats.map((cat, i) => ({
    label: cat,
    value: monthMovements()
      .filter(m => m.type === 'Gasto' && m.category === cat)
      .reduce((s, m) => s + Number(m.amount), 0),
    color: CHART_COLORS[i % CHART_COLORS.length]
  })).filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    ctx.font = '500 14px Inter, sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
    ctx.textAlign = 'center';
    ctx.fillText('Sin gastos', size / 2, size / 2);

    const legend = document.getElementById('chartLegend');
    if (legend) legend.innerHTML = '';
    return;
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = 90;
  const inner = 55;
  let startAngle = -Math.PI / 2;

  // Animate drawing
  const duration = 800;
  const startTime = performance.now();

  function drawFrame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    ctx.clearRect(0, 0, size, size);
    let currentAngle = -Math.PI / 2;

    data.forEach(d => {
      const sweep = (d.value / total) * Math.PI * 2 * eased;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, currentAngle, currentAngle + sweep);
      ctx.arc(cx, cy, inner, currentAngle + sweep, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      currentAngle += sweep;
    });

    // Center text
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');

    ctx.font = '800 18px Inter, sans-serif';
    ctx.fillStyle = textColor.trim();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(money(Math.round(total * eased)), cx, cy - 6);

    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillStyle = mutedColor.trim();
    ctx.fillText('Total gastos', cx, cy + 12);

    if (progress < 1) requestAnimationFrame(drawFrame);
  }

  requestAnimationFrame(drawFrame);

  // Legend
  const legend = document.getElementById('chartLegend');
  if (legend) {
    legend.innerHTML = data.map(d => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${d.color}"></span>
        ${esc(d.label)} (${((d.value / total) * 100).toFixed(0)}%)
      </div>
    `).join('');
  }
}

// ═══════════════════════════════════════════════════════════════════
// MOVEMENTS
// ═══════════════════════════════════════════════════════════════════

function renderMovements() {
  let rows = monthMovements().sort((a, b) => b.date.localeCompare(a.date));

  // Apply filters
  const { search, type } = state.movementFilter;
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(m =>
      m.description.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q) ||
      m.account.toLowerCase().includes(q)
    );
  }
  if (type) {
    rows = rows.filter(m => m.type === type);
  }

  const totalFiltered = rows.reduce((s, m) => s + Number(m.amount), 0);

  return `
    <div class="card">
      <div class="section-title">
        <h2>Movimientos de ${monthName(state.month)}</h2>
        <button class="primary-btn" data-action="open-movement">+ Registrar</button>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <input
          type="text"
          class="search-input"
          placeholder="Buscar por descripción, categoría o cuenta..."
          id="searchInput"
          value="${esc(search)}"
        />
        <select id="typeFilter">
          <option value="">Todos los tipos</option>
          <option value="Ingreso" ${type === 'Ingreso' ? 'selected' : ''}>Ingresos</option>
          <option value="Gasto" ${type === 'Gasto' ? 'selected' : ''}>Gastos</option>
          <option value="Transferencia" ${type === 'Transferencia' ? 'selected' : ''}>Transferencias</option>
        </select>
      </div>

      <div class="muted" style="margin-bottom:12px;font-size:13px">
        ${rows.length} movimiento${rows.length !== 1 ? 's' : ''} · Total: ${money(totalFiltered)}
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Categoría</th>
              <th>Cuenta</th><th>Monto</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(m => `
              <tr>
                <td>${esc(m.date)}</td>
                <td>${typePill(m.type)}</td>
                <td>${esc(m.description)}</td>
                <td>${esc(m.category || '—')}</td>
                <td>${esc(m.account)}</td>
                <td>${money(m.amount)}</td>
                <td>
                  <button class="small-btn" data-action="delete-movement" data-id="${m.id}">Eliminar</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" class="empty">No hay movimientos para este mes.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Movement Form & CRUD ───────────────────────────────────────────

function movementForm(data = {}) {
  const accs = db.accounts.filter(a => a.active);
  const cats = db.categories;
  const type = data.type || 'Gasto';

  return `
    <div class="form-grid">
      <div class="field">
        <label>Tipo</label>
        <select id="mType">
          <option ${type === 'Gasto' ? 'selected' : ''}>Gasto</option>
          <option ${type === 'Ingreso' ? 'selected' : ''}>Ingreso</option>
          <option ${type === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
        </select>
      </div>
      <div class="field">
        <label>Fecha</label>
        <input id="mDate" type="date" value="${data.date || new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="field">
        <label>Descripción</label>
        <input id="mDesc" value="${esc(data.description || '')}">
      </div>
      <div class="field">
        <label>Monto</label>
        <input id="mAmount" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${data.amount || ''}">
      </div>
      <div class="field">
        <label>Categoría</label>
        <select id="mCat">
          <option value="">—</option>
          ${cats.map(c => `<option ${data.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Cuenta / medio</label>
        <select id="mAcc">
          ${accs.map(a => `<option ${data.account === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Recurrente</label>
        <select id="mRec">
          <option value="0">No</option>
          <option value="1" ${data.recurring ? 'selected' : ''}>Sí</option>
        </select>
      </div>
      <div class="field">
        <label>Esencial</label>
        <select id="mEss">
          <option value="0">No</option>
          <option value="1" ${data.essential ? 'selected' : ''}>Sí</option>
        </select>
      </div>
      <div class="field">
        <label>Cuenta destino (solo transferencia)</label>
        <select id="mDest">
          <option value="">—</option>
          ${accs.map(a => `<option ${data.destinationAccount === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field full">
        <label>Notas</label>
        <textarea id="mNotes" rows="3">${esc(data.notes || '')}</textarea>
      </div>
    </div>`;
}

function openMovement(existing) {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>${existing ? 'Editar' : 'Nuevo'} movimiento</h3>
          <button class="icon-btn" data-modal-action="close">×</button>
        </div>
        ${movementForm(existing || {})}
        <div class="modal-actions">
          <button class="secondary-btn" data-modal-action="close">Cancelar</button>
          <button class="primary-btn" data-modal-action="save-movement" data-id="${existing?.id || ''}">Guardar</button>
        </div>
      </div>
    </div>`;
  document.body.classList.add('modal-open');
}

function saveMovement(editId) {
  const data = {
    type: document.getElementById('mType').value,
    date: document.getElementById('mDate').value,
    description: document.getElementById('mDesc').value.trim(),
    amount: parseNum(document.getElementById('mAmount').value),
    category: document.getElementById('mCat').value,
    account: document.getElementById('mAcc').value,
    recurring: +document.getElementById('mRec').value,
    essential: +document.getElementById('mEss').value,
    destinationAccount: document.getElementById('mDest').value,
    notes: document.getElementById('mNotes').value.trim()
  };

  if (!data.date || !data.description || !data.amount) {
    toast('Completa fecha, descripción y monto.');
    return;
  }
  if (data.type === 'Transferencia' && !data.destinationAccount) {
    toast('Elige la cuenta destino.');
    return;
  }

  if (editId) {
    const i = db.movements.findIndex(x => x.id === editId);
    db.movements[i] = { ...db.movements[i], ...data };
  } else {
    db.movements.push({ id: uid(), ...data });
  }

  save();
  closeModal();
  render();
  toast('Movimiento guardado');
}

async function deleteMovement(mid) {
  const ok = await customConfirm('Eliminar movimiento', '¿Estás seguro de que deseas eliminar este movimiento?');
  if (!ok) return;
  db.movements = db.movements.filter(m => m.id !== mid);
  save();
  render();
  toast('Movimiento eliminado');
}

// ═══════════════════════════════════════════════════════════════════
// BUDGET
// ═══════════════════════════════════════════════════════════════════

function renderBudget() {
  const rows = db.categories.map(cat => {
    const b = getBudget(cat);
    const actual = monthMovements()
      .filter(m => m.type === 'Gasto' && m.category === cat)
      .reduce((s, m) => s + Number(m.amount), 0);
    const diff = b - actual;
    const pct = b ? (actual / b * 100) : 0;
    return { cat, b, actual, diff, pct };
  });

  const totalBudget = rows.reduce((s, r) => s + r.b, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return `
    <div class="card" style="margin-bottom:16px">
      <div class="summary-banner">
        <div>
          <div class="metric-label">Presupuesto total</div>
          <div class="big-number">${money(totalBudget)}</div>
        </div>
        <div style="text-align:right">
          <div class="metric-label">Gastado</div>
          <div class="big-number ${totalActual > totalBudget ? 'bad' : ''}">${money(totalActual)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">
        <h2>Presupuesto de ${monthName(state.month)}</h2>
        <button class="primary-btn" data-action="save-budget">💾 Guardar presupuesto</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Categoría</th><th>Presupuesto</th><th>Gasto real</th>
              <th>Disponible</th><th>Uso</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${esc(r.cat)}</strong></td>
                <td>
                  <input class="budget-input" data-cat="${esc(r.cat)}" type="number"
                    min="0" step="1" value="${r.b || ''}" style="width:130px">
                </td>
                <td>${money(r.actual)}</td>
                <td class="${r.diff < 0 ? 'bad' : 'good'}">${money(r.diff)}</td>
                <td style="min-width:150px">
                  <div class="progress ${r.pct > 100 ? 'over' : ''}">
                    <span style="width:${Math.min(100, r.pct)}%"></span>
                  </div>
                  <div class="muted" style="margin-top:4px;font-size:11px">
                    ${r.pct.toFixed(0)}%
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="notice" style="margin-top:14px">
        💡 Consejo: registra transferencias entre cuentas como <strong>Transferencia</strong>.
        Así no se cuentan como gasto.
      </div>
    </div>`;
}

function saveBudgetAll() {
  document.querySelectorAll('.budget-input').forEach(el => {
    const cat = el.dataset.cat;
    const amount = parseNum(el.value);
    db.budgets = db.budgets.filter(b => !(b.month === state.month && b.category === cat));
    if (amount > 0) {
      db.budgets.push({ id: uid(), month: state.month, category: cat, amount });
    }
  });
  save();
  render();
  toast('Presupuesto actualizado');
}

// ═══════════════════════════════════════════════════════════════════
// DEBTS
// ═══════════════════════════════════════════════════════════════════

function renderDebts() {
  const ds = debtBalances();
  const total = ds.reduce((s, d) => s + d.balance, 0);
  const monthly = ds.filter(d => d.balance > 0).reduce((s, d) => s + Number(d.agreedPayment || 0), 0);

  return `
    <div class="grid stats" style="grid-template-columns:repeat(3,1fr)">
      <div class="card stat-card pending">
        <div class="stat-icon">🏦</div>
        <div class="metric-label">Deuda pendiente</div>
        <div class="metric-value" data-value="${total}">${money(total)}</div>
      </div>
      <div class="card stat-card expense">
        <div class="stat-icon">📅</div>
        <div class="metric-label">Cuotas mensuales</div>
        <div class="metric-value" data-value="${monthly}">${money(monthly)}</div>
      </div>
      <div class="card stat-card income">
        <div class="stat-icon">✅</div>
        <div class="metric-label">Pagado este mes</div>
        <div class="metric-value" data-value="${debtPaidThisMonth()}">${money(debtPaidThisMonth())}</div>
      </div>
    </div>

    <div class="section-title" style="margin-top:18px">
      <h2>Mis deudas</h2>
      <button class="primary-btn" data-action="open-debt" data-id="">+ Nueva deuda</button>
    </div>

    <div class="grid two-col">
      ${ds.map(d => {
        const paidPct = d.initialBalance ? Math.min(100, (d.principal / d.initialBalance) * 100) : 0;
        return `
        <div class="card debt-card">
          <div class="debt-head">
            <div>
              <div class="debt-title">${esc(d.creditor)}</div>
              <div class="debt-meta">${esc(d.debtType)} · ${esc(d.account || 'Sin cuenta')}</div>
            </div>
            ${d.balance > 0
              ? '<span class="pill warn">Pendiente</span>'
              : '<span class="pill good">Pagada</span>'}
          </div>

          <!-- Progress bar -->
          <div style="margin:4px 0">
            <div class="progress">
              <span style="width:${paidPct}%;background:var(--gradient-income)"></span>
            </div>
            <div class="muted" style="font-size:11px;margin-top:3px">${paidPct.toFixed(0)}% pagado</div>
          </div>

          <div class="mini-cards">
            <div class="mini">
              <div class="k">Saldo</div>
              <div class="v">${money(d.balance)}</div>
            </div>
            <div class="mini">
              <div class="k">Cuota</div>
              <div class="v">${money(d.agreedPayment)}</div>
            </div>
            <div class="mini">
              <div class="k">Tasa mensual</div>
              <div class="v">${Number(d.monthlyRate || 0).toFixed(2)}%</div>
            </div>
            <div class="mini">
              <div class="k">Día de pago</div>
              <div class="v">${d.paymentDay || '—'}</div>
            </div>
          </div>
          <div class="debt-meta">Pagado: ${money(d.totalPaid)} · Capital abonado: ${money(d.principal)}</div>
          <div class="actions">
            <button class="small-btn" data-action="open-payment" data-id="${d.id}">Registrar pago</button>
            <button class="small-btn" data-action="view-payments" data-id="${d.id}">Historial</button>
            <button class="small-btn" data-action="edit-debt" data-id="${d.id}">Editar</button>
            <button class="small-btn" data-action="delete-debt" data-id="${d.id}">Eliminar</button>
          </div>
        </div>`;
      }).join('') || '<div class="card empty" style="grid-column:1/-1">Aún no hay deudas registradas.</div>'}
    </div>`;
}

// ── Debt Form & CRUD ───────────────────────────────────────────────

function debtForm(d = {}) {
  return `
    <div class="form-grid">
      <div class="field">
        <label>Acreedor</label>
        <input id="dCred" value="${esc(d.creditor || '')}">
      </div>
      <div class="field">
        <label>Tipo de deuda</label>
        <input id="dType" value="${esc(d.debtType || 'Crédito')}">
      </div>
      <div class="field">
        <label>Cuenta / medio</label>
        <select id="dAcc">
          <option value="">—</option>
          ${db.accounts.map(a => `<option ${d.account === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Fecha de inicio</label>
        <input id="dStart" type="date" value="${d.startDate || ''}">
      </div>
      <div class="field">
        <label>Fecha de vencimiento</label>
        <input id="dDue" type="date" value="${d.dueDate || ''}">
      </div>
      <div class="field">
        <label>Monto original</label>
        <input id="dOrig" type="number" min="0" value="${d.originalAmount || ''}">
      </div>
      <div class="field">
        <label>Saldo inicial</label>
        <input id="dInit" type="number" min="0" value="${d.initialBalance || ''}">
      </div>
      <div class="field">
        <label>Tasa mensual (%)</label>
        <input id="dRate" type="number" step="0.01" min="0" value="${d.monthlyRate || ''}">
      </div>
      <div class="field">
        <label>Cuota pactada</label>
        <input id="dPay" type="number" min="0" value="${d.agreedPayment || ''}">
      </div>
      <div class="field">
        <label>Día de pago</label>
        <input id="dDay" type="number" min="1" max="31" value="${d.paymentDay || ''}">
      </div>
      <div class="field">
        <label>Frecuencia</label>
        <select id="dFreq">
          <option ${d.frequency === 'Mensual' || !d.frequency ? 'selected' : ''}>Mensual</option>
          <option ${d.frequency === 'Quincenal' ? 'selected' : ''}>Quincenal</option>
          <option ${d.frequency === 'Semanal' ? 'selected' : ''}>Semanal</option>
        </select>
      </div>
      <div class="field full">
        <label>Notas</label>
        <textarea id="dNotes" rows="3">${esc(d.notes || '')}</textarea>
      </div>
    </div>`;
}

function openDebt(editId) {
  const d = editId ? db.debts.find(x => x.id === editId) : null;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>${d ? 'Editar' : 'Nueva'} deuda</h3>
          <button class="icon-btn" data-modal-action="close">×</button>
        </div>
        ${debtForm(d || {})}
        <div class="modal-actions">
          <button class="secondary-btn" data-modal-action="close">Cancelar</button>
          <button class="primary-btn" data-modal-action="save-debt" data-id="${editId || ''}">Guardar deuda</button>
        </div>
      </div>
    </div>`;
  document.body.classList.add('modal-open');
}

function saveDebt(editId) {
  const d = {
    creditor: document.getElementById('dCred').value.trim(),
    debtType: document.getElementById('dType').value.trim() || 'Crédito',
    account: document.getElementById('dAcc').value,
    startDate: document.getElementById('dStart').value,
    dueDate: document.getElementById('dDue').value,
    originalAmount: parseNum(document.getElementById('dOrig').value),
    initialBalance: parseNum(document.getElementById('dInit').value),
    monthlyRate: parseNum(document.getElementById('dRate').value),
    agreedPayment: parseNum(document.getElementById('dPay').value),
    paymentDay: parseNum(document.getElementById('dDay').value) || null,
    frequency: document.getElementById('dFreq').value,
    notes: document.getElementById('dNotes').value.trim()
  };

  if (!d.creditor || !d.initialBalance) {
    toast('Completa acreedor y saldo inicial.');
    return;
  }

  if (editId) {
    const i = db.debts.findIndex(x => x.id === editId);
    db.debts[i] = { ...db.debts[i], ...d };
  } else {
    db.debts.push({ id: uid(), ...d });
  }

  save();
  closeModal();
  render();
  toast('Deuda guardada');
}

async function deleteDebt(did) {
  const ok = await customConfirm(
    'Eliminar deuda',
    'Esto eliminará la deuda y todo su historial de pagos. ¿Deseas continuar?'
  );
  if (!ok) return;
  db.debts = db.debts.filter(d => d.id !== did);
  db.payments = db.payments.filter(p => p.debtId !== did);
  save();
  render();
  toast('Deuda eliminada');
}

// ── Payment Form & CRUD ───────────────────────────────────────────

function paymentForm(d) {
  return `
    <div class="notice" style="margin-bottom:14px">
      <strong>${esc(d.creditor)}</strong> · Saldo actual ${money(d.balance)} · Cuota ${money(d.agreedPayment)}
    </div>
    <div class="form-grid">
      <div class="field">
        <label>Fecha de pago</label>
        <input id="pDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="field">
        <label>Tipo</label>
        <select id="pType">
          <option>Cuota normal</option>
          <option>Abono extraordinario</option>
          <option>Intereses</option>
          <option>Recargo</option>
        </select>
      </div>
      <div class="field">
        <label>Capital</label>
        <input id="pPrincipal" type="number" min="0" step="1" value="${d.agreedPayment || ''}">
      </div>
      <div class="field">
        <label>Intereses</label>
        <input id="pInterest" type="number" min="0" step="1" value="0">
      </div>
      <div class="field">
        <label>Recargos</label>
        <input id="pFees" type="number" min="0" step="1" value="0">
      </div>
      <div class="field">
        <label>Cuenta utilizada</label>
        <select id="pAcc">
          ${db.accounts.map(a => `<option>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field full">
        <label>Referencia / notas</label>
        <textarea id="pNotes" rows="2"></textarea>
      </div>
    </div>`;
}

function openPayment(did) {
  const d = debtBalances().find(x => x.id === did);
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Registrar pago</h3>
          <button class="icon-btn" data-modal-action="close">×</button>
        </div>
        ${paymentForm(d)}
        <div class="modal-actions">
          <button class="secondary-btn" data-modal-action="close">Cancelar</button>
          <button class="primary-btn" data-modal-action="save-payment" data-id="${did}">Guardar pago</button>
        </div>
      </div>
    </div>`;
  document.body.classList.add('modal-open');
}

function savePayment(did) {
  const p = {
    id: uid(),
    debtId: did,
    date: document.getElementById('pDate').value,
    type: document.getElementById('pType').value,
    principal: parseNum(document.getElementById('pPrincipal').value),
    interest: parseNum(document.getElementById('pInterest').value),
    fees: parseNum(document.getElementById('pFees').value),
    account: document.getElementById('pAcc').value,
    notes: document.getElementById('pNotes').value.trim()
  };

  const d = debtBalances().find(x => x.id === did);

  if (p.principal > d.balance) {
    toast('El capital abonado no puede superar el saldo.');
    return;
  }
  if (!p.date || (p.principal + p.interest + p.fees) <= 0) {
    toast('Registra un valor de pago.');
    return;
  }

  db.payments.push(p);
  save();
  closeModal();
  render();
  toast('Pago registrado');
}

function viewDebtPayments(did) {
  const d = db.debts.find(x => x.id === did);
  const ps = db.payments
    .filter(p => p.debtId === did)
    .sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Historial · ${esc(d.creditor)}</h3>
          <button class="icon-btn" data-modal-action="close">×</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th><th>Tipo</th><th>Capital</th><th>Interés</th>
                <th>Recargos</th><th>Cuenta</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${ps.map(p => `
                <tr>
                  <td>${esc(p.date)}</td>
                  <td>${esc(p.type)}</td>
                  <td>${money(p.principal)}</td>
                  <td>${money(p.interest)}</td>
                  <td>${money(p.fees)}</td>
                  <td>${esc(p.account || '')}</td>
                  <td><button class="small-btn" data-modal-action="delete-payment" data-id="${p.id}">Eliminar</button></td>
                </tr>
              `).join('') || '<tr><td colspan="7" class="empty">Sin pagos.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  document.body.classList.add('modal-open');
}

async function deletePayment(pid) {
  const ok = await customConfirm('Eliminar pago', '¿Estás seguro de que deseas eliminar este pago?');
  if (!ok) return;
  db.payments = db.payments.filter(p => p.id !== pid);
  save();
  closeModal();
  render();
  toast('Pago eliminado');
}

// ═══════════════════════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════════════════════

function renderAccounts() {
  const calc = db.accounts.map(a => {
    let bal = Number(a.balance) || 0;

    db.movements.forEach(m => {
      if (m.account === a.name) {
        if (m.type === 'Ingreso') bal += Number(m.amount);
        if (m.type === 'Gasto') bal -= Number(m.amount);
        if (m.type === 'Transferencia') bal -= Number(m.amount);
      }
      if (m.type === 'Transferencia' && m.destinationAccount === a.name) {
        bal += Number(m.amount);
      }
    });

    db.payments
      .filter(p => p.account === a.name)
      .forEach(p => bal -= Number(p.principal) + Number(p.interest) + Number(p.fees));

    return { ...a, calc: bal };
  });

  const totalBalance = calc.reduce((s, a) => s + a.calc, 0);

  return `
    <div class="card" style="margin-bottom:16px">
      <div class="summary-banner">
        <div>
          <div class="metric-label">Patrimonio total calculado</div>
          <div class="big-number ${totalBalance < 0 ? 'bad' : 'good'}">${money(totalBalance)}</div>
        </div>
        <button class="primary-btn" data-action="open-account" data-id="">+ Nueva cuenta</button>
      </div>
    </div>

    <div class="grid three-col">
      ${calc.map(a => `
        <div class="card">
          <div class="section-title">
            <h2>${esc(a.name)}</h2>
            <span class="pill ${a.active ? 'good' : 'neutral'}">${a.active ? 'Activa' : 'Inactiva'}</span>
          </div>
          <div class="metric-label">Saldo inicial</div>
          <div style="font-weight:800;font-size:16px">${money(a.balance)}</div>
          <div class="metric-label" style="margin-top:14px">Saldo calculado</div>
          <div class="metric-value ${a.calc < 0 ? 'bad' : 'good'}">${money(a.calc)}</div>
          <div class="actions" style="margin-top:12px">
            <button class="small-btn" data-action="open-account" data-id="${a.id}">Editar</button>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="notice" style="margin-top:16px">
      💡 El saldo calculado parte del saldo inicial, suma ingresos, resta gastos y pagos de deuda,
      y mueve fondos entre cuentas mediante transferencias. Verifica el saldo real con tu banco/app.
    </div>`;
}

function openAccount(aid) {
  const a = aid ? db.accounts.find(x => x.id === aid) : null;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>${a ? 'Editar' : 'Nueva'} cuenta</h3>
          <button class="icon-btn" data-modal-action="close">×</button>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Nombre</label>
            <input id="aName" value="${esc(a?.name || '')}">
          </div>
          <div class="field">
            <label>Saldo inicial</label>
            <input id="aBal" type="number" min="0" value="${a?.balance || ''}">
          </div>
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" data-modal-action="close">Cancelar</button>
          <button class="primary-btn" onclick="saveAccount('${aid || ''}')">Guardar</button>
        </div>
      </div>
    </div>`;
  document.body.classList.add('modal-open');
}

function saveAccount(aid) {
  const name = document.getElementById('aName').value.trim();
  const balance = parseNum(document.getElementById('aBal').value);

  if (!name) {
    toast('Escribe un nombre.');
    return;
  }

  if (aid) {
    const i = db.accounts.findIndex(x => x.id === aid);
    db.accounts[i] = { ...db.accounts[i], name, balance };
  } else {
    db.accounts.push({ id: uid(), name, balance, active: true });
  }

  save();
  closeModal();
  render();
  toast('Cuenta guardada');
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════

function renderSettings() {
  return `
    <div class="grid two-col">
      <div class="card">
        <div class="section-title">
          <h2>Categorías</h2>
          <button class="small-btn" data-action="add-category">+ Agregar</button>
        </div>
        <div class="actions" style="gap:8px">
          ${db.categories.map(c => `
            <span class="pill neutral" style="gap:6px">
              ${esc(c)}
              <button style="border:0;background:transparent;cursor:pointer;color:var(--text-muted);font-size:14px"
                data-action="remove-category" data-cat="${esc(c)}">×</button>
            </span>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="section-title">
          <h2>Cuentas</h2>
          <button class="small-btn" data-action="open-account" data-id="">+ Agregar</button>
        </div>
        <div class="actions" style="gap:8px">
          ${db.accounts.map(a => `
            <span class="pill ${a.active ? 'good' : 'neutral'}">${esc(a.name)}</span>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="section-title">
        <h2>Datos</h2>
      </div>
      <p class="muted" style="margin-bottom:14px;line-height:1.6">
        Esta versión guarda la información en el navegador.
        Usa el respaldo JSON para mover o conservar tus datos.
      </p>
      <div class="actions" style="gap:8px">
        <button class="primary-btn" data-action="export-backup">📦 Exportar respaldo</button>
        <label class="secondary-btn file-btn">📥 Importar respaldo
          <input id="importInput2" type="file" accept="application/json" hidden>
        </label>
        <button class="danger-btn" data-action="reset-data">🗑 Borrar todos los datos</button>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="section-title">
        <h2>Apariencia</h2>
      </div>
      <p class="muted" style="margin-bottom:14px">
        Tema actual: <strong>${document.documentElement.getAttribute('data-theme') === 'dark' ? 'Oscuro' : 'Claro'}</strong>
      </p>
      <button class="secondary-btn" onclick="toggleTheme();render()">
        ${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️ Cambiar a modo claro' : '🌙 Cambiar a modo oscuro'}
      </button>
    </div>`;
}

function addCategory() {
  // Use a simple modal instead of prompt()
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" style="max-width:400px">
        <div class="modal-head">
          <h3>Nueva categoría</h3>
          <button class="icon-btn" data-modal-action="close">×</button>
        </div>
        <div class="field">
          <label>Nombre de la categoría</label>
          <input id="newCatInput" autofocus>
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" data-modal-action="close">Cancelar</button>
          <button class="primary-btn" onclick="saveCategoryFromModal()">Agregar</button>
        </div>
      </div>
    </div>`;
  document.body.classList.add('modal-open');
  // Focus the input
  requestAnimationFrame(() => {
    const inp = document.getElementById('newCatInput');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveCategoryFromModal();
      });
    }
  });
}

function saveCategoryFromModal() {
  const inp = document.getElementById('newCatInput');
  const c = inp?.value.trim();
  if (!c) return;
  if (db.categories.includes(c)) {
    toast('Esa categoría ya existe.');
    return;
  }
  db.categories.push(c);
  save();
  closeModal();
  render();
  toast('Categoría agregada');
}

async function removeCategory(c) {
  const ok = await customConfirm(
    'Eliminar categoría',
    `¿Eliminar "${c}" de las opciones? Los movimientos existentes no se borrarán.`
  );
  if (!ok) return;
  db.categories = db.categories.filter(x => x !== c);
  save();
  render();
  toast('Categoría eliminada');
}

// ── Page Events Binding ────────────────────────────────────────────

function bindPageEvents() {
  // Import input in settings
  const second = document.getElementById('importInput2');
  if (second) second.addEventListener('change', importBackup);

  // Movement filters
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.movementFilter.search = e.target.value;
      const c = document.getElementById('content');
      c.innerHTML = renderMovements();
      bindPageEvents();
      // Restore focus
      const inp = document.getElementById('searchInput');
      if (inp) {
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
    });
  }

  const typeFilter = document.getElementById('typeFilter');
  if (typeFilter) {
    typeFilter.addEventListener('change', e => {
      state.movementFilter.type = e.target.value;
      const c = document.getElementById('content');
      c.innerHTML = renderMovements();
      bindPageEvents();
    });
  }
}

// ── Modal & Backup ─────────────────────────────────────────────────

function closeModal() {
  const root = document.getElementById('modalRoot');
  const backdrop = root.querySelector('.modal-backdrop');
  document.body.classList.remove('modal-open');
  if (backdrop) {
    backdrop.style.animation = 'backdropOut 0.15s ease-in forwards';
    const modal = backdrop.querySelector('.modal, .confirm-modal');
    if (modal) modal.style.animation = 'modalOut 0.15s ease-in forwards';
    setTimeout(() => { root.innerHTML = ''; }, 150);
  } else {
    root.innerHTML = '';
  }
}

function exportBackup() {
  const data = { ...db, exportedAt: new Date().toISOString(), version: 1 };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `control-financiero-${currentMonth()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Respaldo exportado');
}

function importBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const x = JSON.parse(reader.result);
      if (!x.accounts || !x.movements || !x.debts) throw new Error();
      db = { ...structuredClone(DEFAULT), ...x };
      save();
      render();
      toast('Respaldo importado');
    } catch {
      toast('El archivo no es un respaldo válido.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function resetData() {
  const ok = await customConfirm(
    'Borrar todos los datos',
    'Esto eliminará todos tus movimientos, presupuestos y deudas del navegador. ¿Deseas continuar?'
  );
  if (!ok) return;
  db = structuredClone(DEFAULT);
  save();
  render();
  toast('Datos borrados');
}

// ── Add close-modal animation keyframes dynamically ────────────────
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes backdropOut { to { opacity: 0; } }
  @keyframes modalOut { to { opacity: 0; transform: scale(0.95) translateY(5px); } }
`;
document.head.appendChild(styleSheet);

// ── Global Exports & Init ──────────────────────────────────────────
window.setPage = setPage;
window.openMovement = openMovement;
window.openDebt = openDebt;
window.openPayment = openPayment;
window.viewDebtPayments = viewDebtPayments;
window.deleteMovement = deleteMovement;
window.deleteDebt = deleteDebt;
window.deletePayment = deletePayment;
window.saveBudgetAll = saveBudgetAll;
window.openAccount = openAccount;
window.saveAccount = saveAccount;
window.exportBackup = exportBackup;
window.resetData = resetData;
window.addCategory = addCategory;
window.removeCategory = removeCategory;
window.toggleTheme = toggleTheme;
window.saveCategoryFromModal = saveCategoryFromModal;

document.addEventListener('DOMContentLoaded', init);
