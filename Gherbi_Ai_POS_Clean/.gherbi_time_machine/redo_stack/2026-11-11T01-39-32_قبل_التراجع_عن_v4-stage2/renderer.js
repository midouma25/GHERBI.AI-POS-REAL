/**
 * renderer.js — [الشطر الأول 1/3 من الترقية الختامية 100%]
 * المحرك الرئيسي الشامل للواجهة الأمامية ونقطة البيع (Enterprise Frontend & POS Controller)
 * لنظام Gherbi.Ai POS — تطابق 100% مع Lumina POS + الميزات الحصرية للسوق الجزائري
 */

'use strict';

const AppState = {
  lang: 'ar',
  darkMode: false,
  currentView: 'pos',
  currentUser: { id: 1, name: 'المدير العام', username: 'admin', role: 'Admin' },
  settings: {},
  products: [],
  categories: [],
  families: [],
  productSuppliers: [],
  customers: [],
  suppliers: [],
  activeSession: null,
  notifications: { lowStock: [], expiring: [], dueInstallments: [] },

  // حالة شاشة الكاشير والتخصيص (POS State, Customization & Edit Sale Mode)
  selectedCategory: 'all',
  searchQuery: '',
  posFilterFamily: '',
  posFilterSupplier: '',
  posFilterOnlyAvailable: false,
  posPage: 1,
  posPageSize: 24,
  posCardSize: 'medium',
  posShowImages: true,
  posShowCost: false,
  posCartWidth: 420,
  isReturnMode: false,
  priceTier: 'retail',
  editingSaleId: null,
  editingSaleNumber: null,
  unregisteredScannedBarcode: '',
  numpadActiveField: 'qty',

  // السلات المتعددة والمسودات
  carts: [{ id: 1, label: 'سلة #1', items: [], customerId: '', discount: 0 }],
  activeCartIndex: 0,
  draftCarts: [],

  // حالة المخزون والنوافذ المؤقتة
  invStockFilter: 'all',
  invSearchQuery: '',
  invSortKey: 'newest',
  lastFocusedInput: null,
  liveScaleWeight: 0,
  tempExtraPrices: [],
  tempExtraBarcodes: [],
  tempVariantsMatrix: [],
  tempPurchaseItems: [],

  // الإحصائيات، استوديو الطباعة، وطابور الملصقات بالجملة (Batch Label Queue)
  analyticsTab: 'summary',
  analyticsDateFrom: '',
  analyticsDateTo: '',
  analyticsData: null,
  segmentData: null,
  charts: {},
  printStudioTab: 'labels',
  labelPrintQueue: [],
  labelStudioConfig: {
    source: 'products',
    selectedId: '',
    priceOnlyMode: false,
    widthMm: 40,
    heightMm: 25,
    barcodeHeightMm: 11,
    columns: 1,
    copies: 1,
    showShop: false,
    showName: true,
    showPrice: true,
    showPriceType: false,
    showBarcodeText: true,
    showVariants: false,
    showDiscount: false,
    showPlu: false
  },

  // تبويب الإعدادات النشط (7 تبويبات)
  settingsTab: 'general'
};

window.AppState = AppState;

// ============================================================================
// 1. المؤثرات الصوتية الذاتية، الإشعارات، وسجل الرقابة الأمنية (Audit Log)
// ============================================================================
function playBeep(success = true) {
  try {
    if (String(AppState.settings.scan_alert_sounds) === 'false') return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'sawtooth';
    osc.frequency.value = success ? 1080 : 260;
    gain.gain.value = Math.min(1, Math.max(0.05, Number(AppState.settings.scan_alert_volume || 0.2)));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.07 : 0.22));
  } catch (_) {}
}

function showToast(message, type = 'info') {
  const box = document.getElementById('toastContainer');
  if (!box) return;
  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-slate-900 text-white'
  };
  const el = document.createElement('div');
  el.className = `px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 ${colors[type] || colors.info}`;
  el.innerHTML = `<span class="material-symbols-rounded icon-sm">notifications</span><span>${message}</span>`;
  box.appendChild(el);
  if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 3400);
}

window.showToast = showToast;

async function logSecurityAudit(actionType, details = {}, severity = 'info', targetType = null, targetId = null) {
  try {
    if (!window.api || !window.api.addAuditLog) return;
    await window.api.addAuditLog({
      user_id: AppState.currentUser ? AppState.currentUser.id : 1,
      user_name: AppState.currentUser ? AppState.currentUser.name : 'Cashier',
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      severity,
      details
    });
  } catch (_) {}
}

// ============================================================================
// 2. الكائن الرئيسي للنظام (App Master Controller)
// ============================================================================
const App = {
  async init() {
    if (!window.api) return;

    const [settings, products, categories, families, prodSuppliers, customers, suppliers, activeSession] =
      await Promise.all([
        window.api.getSettings().catch(() => ({})),
        window.api.getPosStock().catch(() => []),
        window.api.getCategories().catch(() => []),
        window.api.getFamilies().catch(() => []),
        window.api.getProductSuppliers().catch(() => []),
        window.api.getCustomers().catch(() => []),
        window.api.getSuppliers().catch(() => []),
        window.api.getActiveSession(1).catch(() => null)
      ]);

    AppState.settings = settings || {};
    AppState.products = Array.isArray(products) ? products : [];
    AppState.categories = Array.isArray(categories) ? categories : [];
    AppState.families = Array.isArray(families) ? families : [];
    AppState.productSuppliers = Array.isArray(prodSuppliers) ? prodSuppliers : [];
    AppState.customers = Array.isArray(customers) ? customers : [];
    AppState.suppliers = Array.isArray(suppliers) ? suppliers : [];
    AppState.activeSession = activeSession;

    AppState.posPageSize = Math.max(6, parseInt(AppState.settings.pos_page_size || '24', 10) || 24);
    AppState.posCardSize = AppState.settings.pos_card_size || 'medium';
    AppState.posShowImages = String(AppState.settings.pos_show_images) !== 'false';
    AppState.posShowCost = String(AppState.settings.pos_show_cost) === 'true';
    AppState.posCartWidth = Math.min(620, Math.max(320, parseInt(AppState.settings.pos_cart_width || '420', 10) || 420));

    this.applyCartWidthLayout(AppState.posCartWidth);

    const isFirst = await window.api.checkFirstRun().catch(() => false);
    if (isFirst === true || (isFirst && isFirst.isFirstRun === true)) {
      const adminRes = await window.api.setupFirstAdmin('المدير العام', 'admin', '1234').catch(() => null);
      if (adminRes && adminRes.user) AppState.currentUser = adminRes.user;
    } else {
      const users = await window.api.getUsers().catch(() => []);
      if (users && users.length > 0) AppState.currentUser = users[0];
    }

    this.updateUserBadge();
    this.updateShiftHeaderBadge();
    this.setLanguage(AppState.settings.app_lang || 'ar', false);
    this.initVirtualKeyboard();
    this.initCartResizer();
    this.bindKeyboardShortcuts();
    this.bindLiveEvents();
    this.renderPosView();
    await this.refreshHeaderNotifications();
    await this.refreshLanClientsBadge();
  },

  openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(el);
    }
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  applyCartWidthLayout(widthPx) {
    const grid = document.getElementById('posMainGridContainer');
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const availW = rect.width > 500 ? rect.width : (window.innerWidth - 270);
    // ضمان بقاء 420px على الأقل لقسم المنتجات على اليمين حتى لا تخرج السلة أبداً خارج يسار الشاشة
    const maxSafeCartW = Math.min(520, Math.max(350, Math.floor(availW - 420)));
    const w = Math.min(maxSafeCartW, Math.max(330, Math.round(Number(widthPx) || 410)));
    AppState.posCartWidth = w;
    grid.style.gridTemplateColumns = `minmax(0, 1fr) 6px ${w}px`;
  },

  initCartResizer() {
    const resizer = document.getElementById('posCartResizer');
    if (!resizer || resizer.dataset.boundDirect === '1') return;
    resizer.dataset.boundDirect = '1';
    let dragging = false;

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    resizer.addEventListener('dblclick', () => {
      this.applyCartWidthLayout(410);
      if (window.api) window.api.updateSettings({ pos_cart_width: '410' });
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const grid = document.getElementById('posMainGridContainer');
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const isRtl = document.documentElement.dir !== 'ltr';
      const newWidth = isRtl ? (e.clientX - rect.left) : (rect.right - e.clientX);
      this.applyCartWidthLayout(newWidth);
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (window.api) {
        window.api.updateSettings({ pos_cart_width: String(AppState.posCartWidth || 410) });
      }
    });

    window.addEventListener('resize', () => {
      if (AppState.currentView === 'pos') {
        this.applyCartWidthLayout(AppState.posCartWidth || 410);
      }
    });
  },

  openLockScreenModal() {
    document.getElementById('lockPassword').value = '';
    document.getElementById('lockErrorText').textContent = '';
    this.openModal('lockScreenModal');
  },

  async unlockScreen() {
    const pass = document.getElementById('lockPassword').value;
    const username = AppState.currentUser ? AppState.currentUser.username : 'admin';
    const res = await window.api.loginUser(username, pass);
    if (res && res.success) {
      this.closeModal('lockScreenModal');
      showToast('تم فتح قفل الشاشة بنجاح', 'success');
    } else {
      document.getElementById('lockErrorText').textContent = 'كلمة المرور غير صحيحة!';
      playBeep(false);
    }
  },

  updateUserBadge() {
    const u = AppState.currentUser || { name: 'المدير العام', role: 'Admin' };
    const nameEl = document.getElementById('currentUserName');
    const roleEl = document.getElementById('currentUserRole');
    const avEl = document.getElementById('userAvatarBadge');
    if (nameEl) nameEl.textContent = u.name;
    if (roleEl) roleEl.textContent = u.role || 'Admin';
    if (avEl) avEl.textContent = String(u.name || 'م').charAt(0).toUpperCase();
  },

  updateShiftHeaderBadge() {
    const badge = document.getElementById('headerShiftText');
    if (!badge) return;
    if (AppState.activeSession && AppState.activeSession.session) {
      const bal = Number(AppState.activeSession.summary?.currentBalance || 0).toFixed(2);
      badge.textContent = `الصندوق: ${bal} د.ج`;
    } else {
      badge.textContent = 'فتح مناوبة صندوق';
    }
  },

  async refreshHeaderNotifications() {
    if (!window.api || !window.api.getNotifications) return;
    const notif = (await window.api.getNotifications().catch(() => ({}))) || {};
    AppState.notifications = {
      lowStock: notif.lowStock || [],
      expiring: notif.expiring || [],
      dueInstallments: notif.dueInstallments || []
    };
    const totalCount =
      AppState.notifications.lowStock.length +
      AppState.notifications.expiring.length +
      AppState.notifications.dueInstallments.length;

    const badge = document.getElementById('notifCountBadge');
    if (badge) {
      if (totalCount > 0) {
        badge.textContent = totalCount > 99 ? '99+' : String(totalCount);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  },

  toggleNotificationsPopover() {
    const pop = document.getElementById('notificationsPopover');
    if (!pop) return;
    pop.classList.toggle('hidden');
    if (!pop.classList.contains('hidden')) {
      const { lowStock, expiring, dueInstallments } = AppState.notifications;
      if (lowStock.length === 0 && expiring.length === 0 && dueInstallments.length === 0) {
        pop.innerHTML = `<div class="py-6 text-center text-slate-400 font-bold">لا توجد تنبيهات عاجلة حالياً</div>`;
        return;
      }
      pop.innerHTML = `
        <div class="font-black text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1.5">مركز التنبيهات الذكي</div>
        ${
          dueInstallments.length > 0
            ? `<div class="space-y-1">
                <div class="text-[11px] font-black text-indigo-600">📅 أقساط زبائن مستحقة (${dueInstallments.length})</div>
                ${dueInstallments
                  .slice(0, 5)
                  .map(
                    (ins) =>
                      `<div onclick="App.openInstallmentsManagerModal()" class="p-1.5 rounded-lg bg-indigo-500/10 flex justify-between cursor-pointer">
                        <span>${ins.customer_name || 'زبون'}</span>
                        <span class="font-mono font-bold text-indigo-600">${Number(ins.amount - ins.paid_amount).toFixed(0)} د.ج</span>
                      </div>`
                  )
                  .join('')}
              </div>`
            : ''
        }
        ${
          lowStock.length > 0
            ? `<div class="space-y-1">
                <div class="text-[11px] font-black text-amber-600">⚠️ مخزون منخفض (${lowStock.length})</div>
                ${lowStock
                  .slice(0, 6)
                  .map(
                    (p) =>
                      `<div onclick="App.switchView('inventory')" class="p-1.5 rounded-lg bg-amber-500/10 flex justify-between cursor-pointer">
                        <span class="truncate">${p.name}</span>
                        <span class="font-mono font-bold text-amber-600">${p.stock} ${p.unit || ''}</span>
                      </div>`
                  )
                  .join('')}
              </div>`
            : ''
        }
        ${
          expiring.length > 0
            ? `<div class="space-y-1">
                <div class="text-[11px] font-black text-rose-500">⏰ دفعات قريبة الانتهاء (${expiring.length})</div>
                ${expiring
                  .slice(0, 6)
                  .map(
                    (b) =>
                      `<div onclick="App.switchView('inventory')" class="p-1.5 rounded-lg bg-rose-500/10 flex justify-between cursor-pointer">
                        <span class="truncate">${b.name}</span>
                        <span class="font-mono text-rose-500">${b.expiry_date}</span>
                      </div>`
                  )
                  .join('')}
              </div>`
            : ''
        }
      `;
    }
  },

  async refreshLanClientsBadge() {
    if (!window.api || !window.api.getConnectedClients) return;
    const clients = (await window.api.getConnectedClients().catch(() => [])) || [];
    const ip = (await window.api.getLocalIp().catch(() => '127.0.0.1')) || '127.0.0.1';
    const txt = document.getElementById('lanClientsCountText');
    if (txt) {
      txt.textContent = `${ip}:8080 (${clients.length})`;
    }
  },

  async openCustomerDisplayWindow() {
    if (!window.api || !window.api.openCustomerDisplay) return;
    await window.api.openCustomerDisplay();
    this.syncCustomerDisplay();
    showToast('تم فتح شاشة عرض الزبون الثانية بنجاح', 'success');
  },

  syncCustomerDisplay() {
    if (!window.api || !window.api.updateCustomerDisplay) return;
    const cart = this.currentCart;
    const subtotal = cart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const discount = Number(cart.discount || 0);
    const total = Math.max(0, Number((subtotal - discount).toFixed(2)));
    window.api.updateCustomerDisplay({
      items: cart.items,
      subtotal,
      discount,
      total
    });
  },

  initVirtualKeyboard() {
    document.addEventListener('focusin', (e) => {
      if (
        e.target &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') &&
        e.target.id !== 'barcodeInput'
      ) {
        AppState.lastFocusedInput = e.target;
      }
    });

    const keysBox = document.getElementById('virtualKeyboardKeys');
    if (!keysBox) return;
    const keys = [
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
      'ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح',
      'ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك',
      'ط', 'ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ',
      'A', 'B', 'C', 'D', 'E', 'F', '.', '-', 'مسافة', 'مسح'
    ];
    keysBox.innerHTML = keys
      .map(
        (k) =>
          `<button onclick="App.pressVirtualKey('${k}')" class="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white font-bold">${k}</button>`
      )
      .join('');
  },

  pressVirtualKey(key) {
    const inp = AppState.lastFocusedInput || document.getElementById('globalPosSearch');
    if (!inp) return;
    if (key === 'مسح') {
      inp.value = String(inp.value || '').slice(0, -1);
    } else if (key === 'مسافة') {
      inp.value = String(inp.value || '') + ' ';
    } else {
      inp.value = String(inp.value || '') + key;
    }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.focus();
  },

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (document.getElementById('lockScreenModal')?.classList.contains('active')) return;
      if (e.key === 'F1') {
        e.preventDefault();
        this.openCheckoutModal();
      } else if (e.key === 'F2') {
        e.preventDefault();
        this.holdCurrentCart();
      } else if (e.key === 'F3') {
        e.preventDefault();
        this.openDraftsModal();
      } else if (e.key === 'F4') {
        e.preventDefault();
        this.clearCurrentCart();
      } else if (e.key === 'F8') {
        e.preventDefault();
        this.openFreeItemModal();
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (window.api && window.api.openCashDrawer) window.api.openCashDrawer();
        logSecurityAudit('open_cash_drawer_manual', { source: 'F10_shortcut' }, 'warning');
        showToast('تم إرسال نبضة فتح درج النقود (مسجل في الرقابة)', 'info');
      } else if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach((m) => {
          if (m.id !== 'lockScreenModal') m.classList.remove('active');
        });
      }
    });
  },

  bindLiveEvents() {
    if (window.api && window.api.scale && window.api.scale.onReading) {
      window.api.scale.onReading((reading) => {
        if (!reading) return;
        AppState.liveScaleWeight = Number(reading.weight || 0);
        const unit = reading.unit || 'kg';
        const txt = document.getElementById('liveScaleWeight');
        if (txt) txt.textContent = `${AppState.liveScaleWeight.toFixed(3)} ${unit}`;
        const modalDisp = document.getElementById('scaleModalWeightDisplay');
        if (modalDisp) modalDisp.textContent = `${AppState.liveScaleWeight.toFixed(3)} ${unit}`;
        const numScaleVal = document.getElementById('numModalScaleValue');
        if (numScaleVal) numScaleVal.textContent = `${AppState.liveScaleWeight.toFixed(3)} ${unit}`;
      });
    }
  },

  // ==========================================================================
  // 3. التنقل بين الأقسام الـ 18، اللغات، والوضع الليلي
  // ==========================================================================
  toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('collapsed');
  },

  toggleDarkMode() {
    AppState.darkMode = !AppState.darkMode;
    document.documentElement.classList.toggle('dark', AppState.darkMode);
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  },

  setLanguage(lang, save = true) {
    AppState.lang = lang || 'ar';
    document.documentElement.lang = AppState.lang;
    document.documentElement.dir = AppState.lang === 'ar' ? 'rtl' : 'ltr';
    const sel = document.getElementById('langSwitcher');
    if (sel) sel.value = AppState.lang;

    if (window.getTranslation) {
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        el.textContent = window.getTranslation(AppState.lang, key);
      });
    }
    if (save && window.api) {
      window.api.updateSettings({ app_lang: AppState.lang });
    }
  },

  async switchView(viewName) {
    AppState.currentView = viewName;
    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('#sidebar-nav .nav-btn').forEach((btn) => {
      if (btn.getAttribute('data-view') === viewName) {
        btn.className = 'nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600 text-white';
      } else {
        btn.className = 'nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800';
      }
    });

    switch (viewName) {
      case 'pos':
        await this.refreshProducts();
        this.renderPosView();
        break;
      case 'sales':
        await this.renderSalesHistoryView();
        break;
      case 'caisse':
        await this.renderCaisseView();
        break;
      case 'inventory':
        await this.renderInventoryView();
        break;
      case 'bundles':
        await this.renderBundlesAndPromosView();
        break;
      case 'manufacturing':
        if (window.ManufacturingUI) await window.ManufacturingUI.renderManufacturingView();
        break;
      case 'stocktake':
        if (window.StocktakeUI) await window.StocktakeUI.renderStocktakeView();
        break;
      case 'print':
        await this.renderPrintStudioView();
        break;
      case 'suppliers':
        await this.renderSuppliersView();
        break;
      case 'purchases':
        await this.renderPurchasesView();
        break;
      case 'customers':
        await this.renderCustomersView();
        break;
      case 'proformas':
        await this.renderProformasView();
        break;
      case 'orders':
        await this.renderOrdersView();
        break;
      case 'expenses':
        await this.renderExpensesAndCapitalView();
        break;
      case 'analytics':
        await this.renderAnalyticsView();
        break;
      case 'copilot':
        await this.renderCopilotView();
        break;
      case 'users':
        await this.renderUsersView();
        break;
      case 'settings':
        await this.renderSettingsView();
        break;
    }
  },

  async refreshProducts() {
    const [products, categories, families, prodSuppliers, customers, suppliers] = await Promise.all([
      window.api.getPosStock().catch(() => []),
      window.api.getCategories().catch(() => []),
      window.api.getFamilies().catch(() => []),
      window.api.getProductSuppliers().catch(() => []),
      window.api.getCustomers().catch(() => []),
      window.api.getSuppliers().catch(() => [])
    ]);
    AppState.products = Array.isArray(products) ? products : [];
    AppState.categories = Array.isArray(categories) ? categories : [];
    AppState.families = Array.isArray(families) ? families : [];
    AppState.productSuppliers = Array.isArray(prodSuppliers) ? prodSuppliers : [];
    AppState.customers = Array.isArray(customers) ? customers : [];
    AppState.suppliers = Array.isArray(suppliers) ? suppliers : [];
    await this.refreshHeaderNotifications();
  },

  // ==========================================================================
  // 4. محرك شاشة المبيعات المتقدم، لوحة الأرقام اللمسية، وتعديل الفاتورة
  // ==========================================================================
  get currentCart() {
    return AppState.carts[AppState.activeCartIndex] || AppState.carts[0];
  },

  async seedSampleStoreData() {
    if (!window.api || !window.api.seedDemoData) return;
    await window.api.seedDemoData();
    await this.refreshProducts();
    this.renderPosView();
    showToast('تم تحميل المنتجات والزبائن والموردين النموذجيين بنجاح!', 'success');
  },

  renderPosView() {
    const editBanner = document.getElementById('posEditSaleBanner');
    const editBannerTxt = document.getElementById('posEditSaleBannerText');
    const chkBtnTxt = document.getElementById('btnCheckoutMainText');

    if (AppState.editingSaleId) {
      if (editBanner) editBanner.classList.remove('hidden');
      if (editBannerTxt) {
        editBannerTxt.textContent = `✏️ وضع تعديل الفاتورة (${AppState.editingSaleNumber || '#' + AppState.editingSaleId})`;
      }
      if (chkBtnTxt) chkBtnTxt.textContent = 'حفظ تعديلات الفاتورة (F1)';
    } else {
      if (editBanner) editBanner.classList.add('hidden');
      if (chkBtnTxt) chkBtnTxt.textContent = 'تسديد الفاتورة (F1)';
    }

    const pillsBox = document.getElementById('posCategoryPills');
    if (pillsBox) {
      const cats = ['all', 'featured', ...AppState.categories];
      pillsBox.innerHTML = cats
        .map((c) => {
          const active = AppState.selectedCategory === c;
          const label = c === 'all' ? 'جميع الفئات' : c === 'featured' ? '⭐ المفضلة' : c;
          return `<button onclick="App.selectPosCategory('${c}')"
            class="px-3 py-1.5 rounded-xl text-xs font-bold ${
              active
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }">${label}</button>`;
        })
        .join('');
    }

    const custSelect = document.getElementById('posCustomerSelect');
    if (custSelect) {
      custSelect.innerHTML =
        `<option value="">زبون عابر (بدون حساب)</option>` +
        AppState.customers
          .map(
            (c) =>
              `<option value="${c.id}" ${
                Number(this.currentCart.customerId) === Number(c.id) ? 'selected' : ''
              }>${c.name} ${Number(c.total_debt) > 0 ? `(دين: ${Number(c.total_debt).toFixed(0)})` : ''}</option>`
          )
          .join('');
      custSelect.onchange = (e) => {
        const cid = e.target.value ? Number(e.target.value) : '';
        this.currentCart.customerId = cid;
        const foundCust = AppState.customers.find((x) => Number(x.id) === Number(cid));
        if (foundCust && foundCust.price_tier) {
          this.setCartPriceTier(foundCust.price_tier);
        }
      };
    }

    this.renderPosProductsGrid();
    this.renderCartTabs();
    this.renderCartItems();
  },

  selectPosCategory(cat) {
    AppState.selectedCategory = cat;
    AppState.posPage = 1;
    this.renderPosView();
  },

  onPosSearchInput(query) {
    AppState.searchQuery = String(query || '').trim().toLowerCase();
    AppState.posPage = 1;
    this.renderPosProductsGrid();
  },

  getFilteredPosProducts() {
    return AppState.products.filter((p) => {
      if (AppState.selectedCategory === 'featured' && Number(p.is_featured) !== 1) return false;
      if (
        AppState.selectedCategory !== 'all' &&
        AppState.selectedCategory !== 'featured' &&
        p.category !== AppState.selectedCategory
      ) {
        return false;
      }
      if (AppState.posFilterFamily && p.family !== AppState.posFilterFamily) return false;
      if (AppState.posFilterSupplier && p.supplier !== AppState.posFilterSupplier) return false;
      if (AppState.posFilterOnlyAvailable && Number(p.stock || 0) <= 0) return false;

      if (AppState.searchQuery) {
        const q = AppState.searchQuery;
        const matchName = String(p.name || '').toLowerCase().includes(q);
        const matchBc = String(p.barcode || '').toLowerCase().includes(q);
        const matchPlu = String(p.plu_code || '').toLowerCase().includes(q);
        const matchCat = String(p.category || '').toLowerCase().includes(q);
        return matchName || matchBc || matchPlu || matchCat;
      }
      return true;
    });
  },

  changePosPage(delta) {
    const filtered = this.getFilteredPosProducts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / AppState.posPageSize));
    AppState.posPage = Math.min(totalPages, Math.max(1, AppState.posPage + delta));
    this.renderPosProductsGrid();
  },

  renderPosProductsGrid() {
    const grid = document.getElementById('posProductsGrid');
    if (!grid) return;

    const minWidthMap = { small: '125px', medium: '155px', large: '190px' };
    grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${minWidthMap[AppState.posCardSize] || '155px'}, 1fr))`;

    const filtered = this.getFilteredPosProducts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / AppState.posPageSize));
    if (AppState.posPage > totalPages) AppState.posPage = totalPages;

    const pageInfo = document.getElementById('posPageInfoText');
    if (pageInfo) {
      pageInfo.textContent = `صفحة ${AppState.posPage} من ${totalPages} (${filtered.length} منتج)`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 space-y-2">
          <span class="material-symbols-rounded icon-xl">inventory_2</span>
          <div class="text-sm font-bold">لا توجد منتجات مطابقة للبحث أو المخزون فارغ</div>
          <div class="pt-2">
            <button onclick="App.seedSampleStoreData()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow">
              + تحميل بيانات متجر جزائري نموذجي للتجربة الفورية
            </button>
          </div>
        </div>`;
      return;
    }

    const startIdx = (AppState.posPage - 1) * AppState.posPageSize;
    const pageItems = filtered.slice(startIdx, startIdx + AppState.posPageSize);

    grid.innerHTML = pageItems
      .map((p) => {
        const price =
          AppState.priceTier === 'wholesale' && Number(p.wholesale_price) > 0
            ? Number(p.wholesale_price)
            : Number(p.selling_price || 0);
        const stock = Number(p.stock || 0);
        const stockBadgeClass =
          stock <= 0
            ? 'bg-rose-500/15 text-rose-500'
            : stock <= Number(p.min_stock || 5)
              ? 'bg-amber-500/15 text-amber-600'
              : 'bg-emerald-500/15 text-emerald-600';

        const imgHtml =
          AppState.posShowImages && p.image
            ? `<img src="${p.image}" class="w-full h-20 object-contain rounded-lg bg-slate-50 dark:bg-slate-900 mb-1">`
            : '';

        const costLine = AppState.posShowCost
          ? `<div class="text-[10px] font-mono text-slate-400">شراء: ${Number(p.cost_price || 0).toFixed(2)}</div>`
          : '';

        return `
          <div onclick="App.onPosProductCardClick(${p.id})" class="product-card flex flex-col justify-between gap-1.5">
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${stockBadgeClass}">${stock} ${p.unit || ''}</span>
                <div class="flex items-center gap-1">
                  ${Number(p.has_variants) === 1 ? '<span class="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold">متغيرات</span>' : ''}
                  ${Number(p.track_serial) === 1 ? '<span class="px-1.5 py-0.5 rounded bg-slate-800 text-white text-[9px] font-bold">IMEI</span>' : ''}
                  ${p.active_promotion ? '<span class="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold">عرض</span>' : ''}
                </div>
              </div>
              ${imgHtml}
              <div class="font-bold text-xs line-clamp-2 min-h-[2rem]">${p.name}</div>
              ${costLine}
            </div>
            <div class="pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span class="font-mono font-black text-sm text-blue-600 dark:text-blue-400">${price.toFixed(2)}</span>
              <span class="text-[10px] text-slate-400">د.ج</span>
            </div>
          </div>`;
      })
      .join('');
  },

  savePosCustomization() {
    AppState.posCardSize = document.getElementById('posCardSizeSelect').value || 'medium';
    AppState.posPageSize = parseInt(document.getElementById('posPageSizeSelect').value || '24', 10) || 24;
    AppState.posShowImages = document.getElementById('posShowImagesCheckbox').checked;
    AppState.posShowCost = Boolean(document.getElementById('posShowCostCheckbox')?.checked);
    const widthVal = parseInt(document.getElementById('posCartWidthInput')?.value || '420', 10) || 420;
    this.applyCartWidthLayout(widthVal);
    AppState.posPage = 1;

    if (window.api) {
      window.api.updateSettings({
        pos_card_size: AppState.posCardSize,
        pos_page_size: String(AppState.posPageSize),
        pos_show_images: String(AppState.posShowImages),
        pos_show_cost: String(AppState.posShowCost),
        pos_cart_width: String(AppState.posCartWidth)
      });
    }
    this.closeModal('posCustomizeModal');
    this.renderPosProductsGrid();
  },

  openPosAdvancedFilterModal() {
    const famSel = document.getElementById('posFilterFamilySelect');
    const supSel = document.getElementById('posFilterSupplierSelect');
    if (famSel) {
      famSel.innerHTML =
        `<option value="">جميع العائلات</option>` +
        AppState.families.map((f) => `<option value="${f}" ${AppState.posFilterFamily === f ? 'selected' : ''}>${f}</option>`).join('');
    }
    if (supSel) {
      supSel.innerHTML =
        `<option value="">جميع الموردين</option>` +
        AppState.productSuppliers.map((s) => `<option value="${s}" ${AppState.posFilterSupplier === s ? 'selected' : ''}>${s}</option>`).join('');
    }
    document.getElementById('posFilterOnlyAvailable').checked = AppState.posFilterOnlyAvailable;
    this.openModal('posAdvancedFilterModal');
  },

  applyPosAdvancedFilter() {
    AppState.posFilterFamily = document.getElementById('posFilterFamilySelect').value || '';
    AppState.posFilterSupplier = document.getElementById('posFilterSupplierSelect').value || '';
    AppState.posFilterOnlyAvailable = document.getElementById('posFilterOnlyAvailable').checked;
    AppState.posPage = 1;
    this.closeModal('posAdvancedFilterModal');
    this.renderPosProductsGrid();
  },

  resetPosAdvancedFilter() {
    AppState.posFilterFamily = '';
    AppState.posFilterSupplier = '';
    AppState.posFilterOnlyAvailable = false;
    AppState.posPage = 1;
    this.closeModal('posAdvancedFilterModal');
    this.renderPosProductsGrid();
  },

  openPosScaleModal() {
    const sel = document.getElementById('scaleModalProductSelect');
    if (sel) {
      sel.innerHTML = AppState.products
        .map((p) => `<option value="${p.id}">${p.name} (${Number(p.selling_price || 0).toFixed(2)} د.ج / ${p.unit || 'كغ'})</option>`)
        .join('');
    }
    this.openModal('posScaleModal');
  },

  addWeightedProductFromScaleModal() {
    const pid = Number(document.getElementById('scaleModalProductSelect').value);
    const weight = AppState.liveScaleWeight > 0 ? AppState.liveScaleWeight : 1;
    if (pid) {
      this.addProductToCart(pid, weight);
      this.closeModal('posScaleModal');
    }
  },

  async openPosQuickProduceModal() {
    const recipes = (await window.api.getBomRecipes({ activeOnly: true }).catch(() => [])) || [];
    if (recipes.length === 0) {
      showToast('لا توجد وصفات تصنيع مسجلة بعد. أنشئ وصفة من قسم التصنيع أولاً.', 'warning');
      return;
    }
    const sel = document.getElementById('posQuickRecipeSelect');
    if (sel) {
      sel.innerHTML = recipes
        .map((r) => `<option value="${r.id}">${r.name} (ينتج: ${r.output_qty} ${r.product_unit || ''})</option>`)
        .join('');
    }
    document.getElementById('posQuickProduceQty').value = '1';
    this.openModal('posQuickProduceModal');
  },

  async confirmPosQuickProduce() {
    const recipeId = Number(document.getElementById('posQuickRecipeSelect').value);
    const qty = parseFloat(document.getElementById('posQuickProduceQty').value) || 1;
    if (!recipeId || qty <= 0) return;
    try {
      await window.api.createProductionOrder({
        recipe_id: recipeId,
        planned_qty: qty,
        produced_qty: qty,
        confirmImmediately: true
      });
      this.closeModal('posQuickProduceModal');
      await this.refreshProducts();
      this.renderPosView();
      showToast('تم التصنيع الفوري وإضافة المنتج النهائي للمخزون بنجاح', 'success');
    } catch (err) {
      showToast(err.message || 'تعذر تنفيذ التصنيع الفوري', 'error');
    }
  },

  onPosProductCardClick(productId) {
    const prod = AppState.products.find((p) => Number(p.id) === Number(productId));
    if (!prod) return;

    const hasMultipleVariants = Array.isArray(prod.variants) && prod.variants.length > 0;
    const positiveBatches = (prod.batches || []).filter((b) => Number(b.stock) > 0);
    const hasDistinctBatchPrices =
      positiveBatches.length > 1 &&
      new Set(positiveBatches.map((b) => Number(b.selling_price))).size > 1;
    const needsSerial = Number(prod.track_serial) === 1;

    if (hasMultipleVariants || hasDistinctBatchPrices || needsSerial) {
      this.openVariantBatchSerialPicker(prod);
      return;
    }

    this.addProductToCart(prod.id, 1);
  },

  openVariantBatchSerialPicker(prod) {
    document.getElementById('pickerModalProductName').textContent = prod.name;
    const body = document.getElementById('pickerModalBody');
    const batches = prod.batches || [];
    const variants = prod.variants || [];

    body.innerHTML = `
      ${
        variants.length > 0
          ? `<div>
              <label class="block font-bold mb-1">اختر المتغير (المقاس / اللون):</label>
              <select id="pickerVariantSelect" class="w-full px-3 py-2 rounded-xl font-bold">
                ${variants.map((v) => `<option value="${v.id}">${v.sku || v.barcode || 'متغير #' + v.id}</option>`).join('')}
              </select>
            </div>`
          : '<input id="pickerVariantSelect" type="hidden" value="">'
      }
      ${
        batches.length > 1
          ? `<div>
              <label class="block font-bold mb-1">اختر الدفعة (Batch):</label>
              <select id="pickerBatchSelect" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
                ${batches
                  .map(
                    (b) =>
                      `<option value="${b.id}" data-price="${b.selling_price}">دفعة #${b.id} | الرصيد: ${b.stock} | السعر: ${b.selling_price} د.ج ${b.expiry_date ? '| صلاحية: ' + b.expiry_date : ''}</option>`
                  )
                  .join('')}
              </select>
            </div>`
          : `<input id="pickerBatchSelect" type="hidden" value="${batches[0]?.id || ''}">`
      }
      ${
        Number(prod.track_serial) === 1
          ? `<div>
              <label class="block font-bold mb-1 text-blue-600">الرقم التسلسلي للجهاز (IMEI / Serial Number) *:</label>
              <input id="pickerSerialInput" type="text" placeholder="امسح أو أدخل رقم IMEI / S/N..." class="w-full px-3 py-2 rounded-xl font-mono font-bold">
            </div>`
          : '<input id="pickerSerialInput" type="hidden" value="">'
      }
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block font-bold mb-1">الكمية</label>
          <input id="pickerQtyInput" type="number" step="any" value="1" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
        </div>
        <div>
          <label class="block font-bold mb-1">مدة الضمان (بالأشهر)</label>
          <input id="pickerWarrantyInput" type="number" value="${prod.warranty_months || 0}" class="w-full px-3 py-2 rounded-xl font-mono">
        </div>
      </div>
      <button onclick="App.confirmPickerSelection(${prod.id})" class="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold">إضافة إلى السلة</button>
    `;

    this.openModal('posVariantBatchPickerModal');
  },

  confirmPickerSelection(productId) {
    const variantId = document.getElementById('pickerVariantSelect')?.value || null;
    const batchEl = document.getElementById('pickerBatchSelect');
    const batchId = batchEl?.value || null;
    const serialNumber = document.getElementById('pickerSerialInput')?.value?.trim() || null;
    const qty = parseFloat(document.getElementById('pickerQtyInput')?.value) || 1;
    const warrantyMonths = parseInt(document.getElementById('pickerWarrantyInput')?.value || '0', 10) || 0;

    this.addProductToCart(productId, qty, {
      variantId: variantId ? Number(variantId) : null,
      batchId: batchId ? Number(batchId) : null,
      serialNumber,
      warrantyMonths
    });
    this.closeModal('posVariantBatchPickerModal');
  },

  async handleBarcodeScan(rawCode) {
    const code = String(rawCode || '').trim();
    const input = document.getElementById('barcodeInput');
    if (input) input.value = '';
    if (!code) return;

    // 1. فحص باركود الميزان الإلكتروني (يبدأ بـ 20 إلى 29 وطوله 13 رقماً)
    if (/^2[0-9]\d{11}$/.test(code)) {
      const plu = code.slice(2, 7);
      const pluNum = String(parseInt(plu, 10));
      const weightKg = parseInt(code.slice(7, 12), 10) / 1000;
      const prod = AppState.products.find(
        (p) => String(p.plu_code) === plu || String(p.plu_code) === pluNum || String(p.barcode) === plu
      );
      if (prod && weightKg > 0) {
        this.addProductToCart(prod.id, weightKg);
        playBeep(true);
        return;
      }
    }

    // 2. البحث بالباركود الأساسي أو الباركودات الفرعية
    for (const p of AppState.products) {
      if (String(p.barcode) === code) {
        this.addProductToCart(p.id, 1);
        playBeep(true);
        return;
      }
      if (Array.isArray(p.extra_barcodes)) {
        const subBc = p.extra_barcodes.find((b) => String(b.barcode) === code);
        if (subBc) {
          let customPrice = null;
          if (subBc.price_label && Array.isArray(p.extra_prices)) {
            const matchedPrice = p.extra_prices.find((ep) => ep.label === subBc.price_label);
            if (matchedPrice) customPrice = Number(matchedPrice.price);
          }
          this.addProductToCart(p.id, 1, { overridePrice: customPrice });
          playBeep(true);
          return;
        }
      }
    }

    // 3. البحث في القاموس الجزائري الذكي لباركود 613
    if (code.startsWith('613') && window.api && window.api.lookupDzBarcode) {
      const dictItem = await window.api.lookupDzBarcode(code).catch(() => null);
      if (dictItem) {
        playBeep(true);
        showToast(`تم التعرف على المنتج الجزائري: ${dictItem.name}`, 'info');
        this.openProductModal({
          barcode: dictItem.barcode,
          name: dictItem.name,
          category: dictItem.category || 'مواد غذائية',
          supplier: dictItem.brand || '',
          unit: dictItem.unit || 'قطعة',
          selling_price: dictItem.suggested_price || 0,
          stock: 10
        });
        return;
      }
    }

    // 4. فتح نافذة مساعد الباركود غير المسجل (#posBarcodeSuggestModal) كما في Lumina POS
    playBeep(false);
    this.openUnregisteredBarcodeModal(code);
  },

  openUnregisteredBarcodeModal(barcode) {
    AppState.unregisteredScannedBarcode = barcode;
    const txt = document.getElementById('unregisteredBarcodeText');
    if (txt) txt.textContent = barcode;
    const sel = document.getElementById('posBarcodeLinkProductSelect');
    if (sel) {
      sel.innerHTML = AppState.products
        .map((p) => `<option value="${p.id}">${p.name} (${Number(p.selling_price || 0).toFixed(2)} د.ج)</option>`)
        .join('');
    }
    this.openModal('posBarcodeSuggestModal');
  },

  createProductFromUnregisteredBarcode() {
    const bc = AppState.unregisteredScannedBarcode;
    this.closeModal('posBarcodeSuggestModal');
    this.openProductModal({ barcode: bc, name: '', stock: 10 });
  },

  async linkUnregisteredBarcodeToProduct() {
    const bc = AppState.unregisteredScannedBarcode;
    const pid = Number(document.getElementById('posBarcodeLinkProductSelect')?.value);
    if (!bc || !pid) return;
    await window.api.addProductBarcode(pid, bc, null);
    this.closeModal('posBarcodeSuggestModal');
    await this.refreshProducts();
    this.addProductToCart(pid, 1);
    showToast(`تم ربط الباركود (${bc}) بالمنتج وإضافته للسلة`, 'success');
  },

  createSimilarProductFromSuggest() {
    const bc = AppState.unregisteredScannedBarcode;
    const pid = Number(document.getElementById('posBarcodeLinkProductSelect')?.value);
    const prod = AppState.products.find((p) => Number(p.id) === pid);
    this.closeModal('posBarcodeSuggestModal');
    if (prod) {
      this.openProductModal({
        ...prod,
        id: '',
        barcode: bc,
        name: `${prod.name} (نسخة)`
      });
    } else {
      this.openProductModal({ barcode: bc });
    }
  },

  addProductToCart(productId, customQty = 1, options = {}) {
    const prod = AppState.products.find((p) => Number(p.id) === Number(productId));
    if (!prod) return;

    const sign = AppState.isReturnMode ? -1 : 1;
    const qtyToAdd = Number(customQty || 1) * sign;

    let unitPrice =
      options.overridePrice !== undefined && options.overridePrice !== null
        ? Number(options.overridePrice)
        : AppState.priceTier === 'wholesale' && Number(prod.wholesale_price) > 0
          ? Number(prod.wholesale_price)
          : Number(prod.selling_price || 0);

    if (prod.active_promotion && !options.overridePrice) {
      const prm = prod.active_promotion;
      if (prm.discount_type === 'percentage') {
        unitPrice = Number((unitPrice * (1 - Number(prm.discount_value || 0) / 100)).toFixed(2));
      } else {
        unitPrice = Math.max(0, Number((unitPrice - Number(prm.discount_value || 0)).toFixed(2)));
      }
    }

    const cart = this.currentCart;
    const existing = cart.items.find(
      (it) =>
        Number(it.product_id) === Number(prod.id) &&
        it.variant_id === (options.variantId || null) &&
        it.batch_id === (options.batchId || null) &&
        !options.serialNumber
    );

    if (existing) {
      existing.quantity = Number((existing.quantity + qtyToAdd).toFixed(4));
      existing.subtotal = Number((existing.quantity * existing.price).toFixed(2));
    } else {
      cart.items.push({
        product_id: prod.id,
        variant_id: options.variantId || null,
        batch_id: options.batchId || null,
        name: prod.name,
        barcode: prod.barcode,
        unit: prod.unit || 'قطعة',
        wholesale_unit: prod.wholesale_unit || null,
        wholesale_qty: Number(prod.wholesale_qty || 0),
        wholesale_price: Number(prod.wholesale_price || 0),
        retail_price: Number(prod.selling_price || 0),
        extra_prices: prod.extra_prices || [],
        quantity: qtyToAdd,
        price: unitPrice,
        cost_price: Number(prod.cost_price || 0),
        subtotal: Number((qtyToAdd * unitPrice).toFixed(2)),
        serial_number: options.serialNumber || null,
        warranty_months: options.warrantyMonths ?? Number(prod.warranty_months || 0),
        applied_promotion_id: prod.active_promotion ? prod.active_promotion.id : null
      });
    }

    this.renderCartItems();
  },

  // نافذة اختيار الوحدة والتسعيرة (#posUnitChoiceModal)
  openPosUnitChoiceModal(cartIndex) {
    const it = this.currentCart.items[cartIndex];
    if (!it) return;
    document.getElementById('unitChoiceModalTitle').textContent = `اختيار الوحدة والتسعيرة: ${it.name}`;
    const body = document.getElementById('posUnitChoiceModalBody');

    const choices = [
      {
        label: `بيع بالوحدة (${it.unit || 'قطعة'}) — تجزئة`,
        qty: 1,
        price: Number(it.retail_price || it.price || 0)
      }
    ];

    if (it.wholesale_price > 0) {
      choices.push({
        label: `سعر الجملة بالوحدة (${it.unit || 'قطعة'})`,
        qty: it.quantity || 1,
        price: Number(it.wholesale_price)
      });
    }

    if (it.wholesale_qty && it.wholesale_qty > 1) {
      choices.push({
        label: `بيع بـ ${it.wholesale_unit || 'كرتونة'} (${it.wholesale_qty} ${it.unit || 'قطعة'})`,
        qty: Number(it.wholesale_qty),
        price: Number(it.wholesale_price > 0 ? it.wholesale_price : it.retail_price)
      });
    }

    if (Array.isArray(it.extra_prices)) {
      for (const ep of it.extra_prices) {
        choices.push({
          label: `تسعيرة خاصة: ${ep.label}`,
          qty: it.quantity || 1,
          price: Number(ep.price || 0)
        });
      }
    }

    body.innerHTML = choices
      .map(
        (ch) => `
        <button onclick="App.selectUnitOrPriceForCartItem(${cartIndex}, ${ch.qty}, ${ch.price})"
          class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 flex items-center justify-between font-bold">
          <span>${ch.label}</span>
          <span class="font-mono text-blue-600">${ch.price.toFixed(2)} د.ج (الكمية: ${ch.qty})</span>
        </button>`
      )
      .join('');

    this.openModal('posUnitChoiceModal');
  },

  selectUnitOrPriceForCartItem(cartIndex, newQty, newPrice) {
    const it = this.currentCart.items[cartIndex];
    if (!it) return;
    it.quantity = Number(newQty);
    it.price = Number(newPrice);
    it.subtotal = Number((it.quantity * it.price).toFixed(2));
    this.closeModal('posUnitChoiceModal');
    this.renderCartItems();
  },

  // لوحة الأرقام اللمسية للكمية والسعر والوزن (#numberInputModal)
  openNumberInputModal(cartIndex, focusField = 'qty') {
    const it = this.currentCart.items[cartIndex];
    if (!it) return;
    AppState.numpadActiveField = focusField;
    document.getElementById('numModalCartIndex').value = String(cartIndex);
    document.getElementById('numModalTitle').textContent = it.name;

    const qtyInp = document.getElementById('numModalInput');
    const prcInp = document.getElementById('numModalPriceInput');
    qtyInp.value = String(it.quantity);
    prcInp.value = String(it.price);

    qtyInp.onclick = () => { AppState.numpadActiveField = 'qty'; };
    prcInp.onclick = () => { AppState.numpadActiveField = 'price'; };

    this.openModal('numberInputModal');
  },

  tapNumpad(key) {
    const targetId = AppState.numpadActiveField === 'price' ? 'numModalPriceInput' : 'numModalInput';
    const inp = document.getElementById(targetId);
    if (!inp) return;

    if (key === 'C') {
      inp.value = '';
    } else if (key.startsWith('+')) {
      const add = parseFloat(key.slice(1)) || 0;
      inp.value = String(Number(((parseFloat(inp.value) || 0) + add).toFixed(4)));
    } else {
      inp.value = String(inp.value || '') + key;
    }
  },

  pullWeightIntoNumberModal() {
    if (AppState.liveScaleWeight > 0) {
      document.getElementById('numModalInput').value = AppState.liveScaleWeight.toFixed(3);
    } else {
      showToast('وزن الميزان الحالي 0.000 كغ', 'warning');
    }
  },

  confirmNumberInputModal() {
    const idx = Number(document.getElementById('numModalCartIndex').value);
    const it = this.currentCart.items[idx];
    if (!it) return;
    const newQty = parseFloat(document.getElementById('numModalInput').value) || 0;
    const newPrice = parseFloat(document.getElementById('numModalPriceInput').value) || 0;

    if (newPrice < it.price) {
      logSecurityAudit(
        'price_reduced_in_cart',
        { product: it.name, old_price: it.price, new_price: newPrice },
        'warning',
        'product',
        it.product_id
      );
    }

    it.quantity = newQty;
    it.price = newPrice;
    it.subtotal = Number((it.quantity * it.price).toFixed(2));
    this.closeModal('numberInputModal');
    this.renderCartItems();
  },

  // نافذة خصم السلة بالـ % أو المبلغ (#cartModifierModal)
  openCartModifierModal() {
    const subtotal = this.currentCart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const curDisc = Number(this.currentCart.discount || 0);
    const pct = subtotal > 0 ? Number(((curDisc / subtotal) * 100).toFixed(2)) : 0;

    document.getElementById('modPercentInput').value = String(pct);
    document.getElementById('modAmountInput').value = String(curDisc);
    document.getElementById('modPercentPreview').textContent = `الصافي بعد الخصم: ${(subtotal - curDisc).toFixed(2)} د.ج`;
    this.openModal('cartModifierModal');
  },

  applyQuickCartPercent(pct) {
    document.getElementById('modPercentInput').value = String(pct);
    this.onCartModPercentChange(pct);
  },

  onCartModPercentChange(pctVal) {
    const subtotal = this.currentCart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const pct = Math.min(100, Math.max(0, parseFloat(pctVal) || 0));
    const amt = Number(((subtotal * pct) / 100).toFixed(2));
    document.getElementById('modAmountInput').value = String(amt);
    document.getElementById('modPercentPreview').textContent = `الصافي بعد الخصم: ${(subtotal - amt).toFixed(2)} د.ج`;
  },

  onCartModAmountChange(amtVal) {
    const subtotal = this.currentCart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const amt = Math.max(0, parseFloat(amtVal) || 0);
    const pct = subtotal > 0 ? Number(((amt / subtotal) * 100).toFixed(2)) : 0;
    document.getElementById('modPercentInput').value = String(pct);
    document.getElementById('modPercentPreview').textContent = `الصافي بعد الخصم: ${(subtotal - amt).toFixed(2)} د.ج`;
  },

  confirmCartModifierModal() {
    const amt = Math.max(0, parseFloat(document.getElementById('modAmountInput').value) || 0);
    const discInput = document.getElementById('cartDiscountInput');
    if (discInput) discInput.value = String(amt);
    this.closeModal('cartModifierModal');
    this.recalcCart();
    this.syncCustomerDisplay();
  },

  renderCartTabs() {
    const box = document.getElementById('multiCartTabs');
    if (!box) return;
    box.innerHTML = AppState.carts
      .map(
        (c, idx) => `
        <button onclick="App.switchCartTab(${idx})"
          class="px-2.5 py-1 rounded-lg text-xs font-bold ${
            idx === AppState.activeCartIndex
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }">
          ${c.label} (${c.items.length})
        </button>`
      )
      .join('');

    const badge = document.getElementById('draftsCountBadge');
    if (badge) badge.textContent = AppState.draftCarts.length;
  },

  switchCartTab(idx) {
    AppState.activeCartIndex = idx;
    this.renderPosView();
  },

  newCartTab() {
    const nextNum = AppState.carts.length + 1;
    AppState.carts.push({ id: Date.now(), label: `سلة #${nextNum}`, items: [], customerId: '', discount: 0 });
    AppState.activeCartIndex = AppState.carts.length - 1;
    this.renderPosView();
  },

  renderCartItems() {
    const box = document.getElementById('posCartItems');
    if (!box) return;
    const cart = this.currentCart;

    const countEl = document.getElementById('cartItemsCountText');
    if (countEl) countEl.textContent = String(cart.items.length);

    if (cart.items.length === 0) {
      box.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-slate-400 py-12">
          <span class="material-symbols-rounded icon-xl">shopping_basket</span>
          <p class="text-xs font-bold mt-2">السلة فارغة — اختر منتجاً أو امسح باركود</p>
        </div>`;
      this.recalcCart();
      this.syncCustomerDisplay();
      return;
    }

    box.innerHTML = cart.items
      .map((it, idx) => {
        const hasUnitOptions =
          (it.wholesale_qty && it.wholesale_qty > 1) ||
          it.wholesale_price > 0 ||
          (Array.isArray(it.extra_prices) && it.extra_prices.length > 0);
        return `
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
          <div class="flex-1 min-w-0">
            <div class="font-bold truncate">${it.name}</div>
            <div class="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-1.5">
              <span>${Number(it.price || 0).toFixed(2)} د.ج / ${it.unit || 'وحدة'}</span>
              ${it.serial_number ? `<span class="text-blue-500">[S/N: ${it.serial_number}]</span>` : ''}
              ${
                hasUnitOptions
                  ? `<button onclick="App.openPosUnitChoiceModal(${idx})" class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-600 font-bold text-[10px]">وحدة/تسعيرة</button>`
                  : ''
              }
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="App.openNumberInputModal(${idx}, 'qty')" title="تعديل الكمية باللمس"
              class="min-w-[3.2rem] px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-center font-mono font-black hover:border-blue-500">
              ${it.quantity}
            </button>
            <button onclick="App.openNumberInputModal(${idx}, 'price')" title="تعديل السعر باللمس"
              class="min-w-[4rem] px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-center font-mono font-bold text-blue-600 hover:border-blue-500">
              ${Number(it.price || 0).toFixed(2)}
            </button>
          </div>
          <div class="w-20 text-left font-mono font-black">${Number(it.subtotal || 0).toFixed(2)}</div>
          <button onclick="App.removeCartItem(${idx})" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg">
            <span class="material-symbols-rounded icon-sm">delete</span>
          </button>
        </div>`;
      })
      .join('');

    this.recalcCart();
    this.renderCartTabs();
    this.syncCustomerDisplay();
  },

  removeCartItem(idx) {
    const removed = this.currentCart.items[idx];
    if (removed) {
      logSecurityAudit(
        'cart_line_deleted',
        { product: removed.name, qty: removed.quantity, subtotal: removed.subtotal },
        'warning',
        'product',
        removed.product_id
      );
    }
    this.currentCart.items.splice(idx, 1);
    this.renderCartItems();
  },

  recalcCart() {
    const cart = this.currentCart;
    const subtotal = cart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const discInput = document.getElementById('cartDiscountInput');
    const discount = discInput ? parseFloat(discInput.value) || 0 : 0;
    cart.discount = discount;
    const total = Number((subtotal - discount).toFixed(2));

    const subEl = document.getElementById('cartSubtotalText');
    const totEl = document.getElementById('cartTotalText');
    if (subEl) subEl.textContent = `${subtotal.toFixed(2)} د.ج`;
    if (totEl) totEl.textContent = `${total.toFixed(2)} د.ج`;
    return { subtotal, discount, total };
  },

  clearCurrentCart() {
    if (this.currentCart.items.length > 0) {
      logSecurityAudit('cart_cleared', { items_count: this.currentCart.items.length }, 'warning');
    }
    this.currentCart.items = [];
    AppState.editingSaleId = null;
    AppState.editingSaleNumber = null;
    const discInput = document.getElementById('cartDiscountInput');
    if (discInput) discInput.value = '0';
    this.renderPosView();
  },

  async loadSaleIntoPosForEdit(saleId) {
    const fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;

    AppState.editingSaleId = fullSale.id;
    AppState.editingSaleNumber = fullSale.doc_number || `#${fullSale.id}`;

    const cart = this.currentCart;
    cart.customerId = fullSale.customer_id || '';
    cart.discount = Number(fullSale.discount || 0);
    const discInput = document.getElementById('cartDiscountInput');
    if (discInput) discInput.value = String(cart.discount);

    cart.items = (fullSale.items || []).map((it) => ({
      product_id: it.product_id || null,
      variant_id: it.variant_id || null,
      batch_id: it.batch_id || null,
      name: it.product_name || it.custom_product_name || 'منتج',
      barcode: it.product_barcode || '',
      unit: it.product_unit || 'قطعة',
      quantity: Number(it.quantity || 1),
      price: Number(it.price || 0),
      cost_price: Number(it.cost_price || 0),
      subtotal: Number(it.subtotal || 0),
      serial_number: it.serial_number || null,
      warranty_months: Number(it.warranty_months || 0)
    }));

    await this.switchView('pos');
    showToast(`تم تحميل الفاتورة (${AppState.editingSaleNumber}) في السلة للتعديل`, 'info');
  },

  cancelEditSaleMode() {
    AppState.editingSaleId = null;
    AppState.editingSaleNumber = null;
    this.clearCurrentCart();
    showToast('تم إلغاء وضع تعديل الفاتورة', 'info');
  },

  holdCurrentCart() {
    if (this.currentCart.items.length === 0) return;
    AppState.draftCarts.push({
      ...JSON.parse(JSON.stringify(this.currentCart)),
      heldAt: new Date().toLocaleTimeString('ar-DZ')
    });
    this.currentCart.items = [];
    this.renderCartItems();
    showToast('تم تعليق الفاتورة في المسودات (F3)', 'info');
  },

  openDraftsModal() {
    const body = document.getElementById('draftsModalBody');
    if (!body) return;
    if (AppState.draftCarts.length === 0) {
      body.innerHTML = `<div class="py-10 text-center text-slate-400 font-bold">لا توجد فواتير معلقة في المسودات حالياً</div>`;
    } else {
      body.innerHTML = `
        <table class="w-full text-xs text-right">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
              <th class="py-2">#</th>
              <th class="py-2">الوقت</th>
              <th class="py-2">عدد الأصناف</th>
              <th class="py-2">الإجمالي</th>
              <th class="py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
            ${AppState.draftCarts
              .map((d, i) => {
                const tot = d.items.reduce((s, it) => s + Number(it.subtotal || 0), 0) - Number(d.discount || 0);
                return `
                  <tr>
                    <td class="py-2 font-mono">#${i + 1}</td>
                    <td class="py-2 font-mono">${d.heldAt || ''}</td>
                    <td class="py-2 font-bold">${d.items.length} أصناف</td>
                    <td class="py-2 font-mono font-bold text-blue-600">${tot.toFixed(2)} د.ج</td>
                    <td class="py-2 flex gap-1.5">
                      <button onclick="App.restoreDraftCart(${i})" class="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold">استرجاع</button>
                      <button onclick="App.deleteDraftCart(${i})" class="px-2.5 py-1 bg-rose-500/15 text-rose-500 rounded-lg font-bold">حذف</button>
                    </td>
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>`;
    }
    this.openModal('draftsModal');
  },

  restoreDraftCart(idx) {
    const restored = AppState.draftCarts.splice(idx, 1)[0];
    if (restored) {
      AppState.carts[AppState.activeCartIndex] = restored;
      this.closeModal('draftsModal');
      this.renderPosView();
      showToast('تم استرجاع الفاتورة المعلقة إلى السلة', 'success');
    }
  },

  deleteDraftCart(idx) {
    AppState.draftCarts.splice(idx, 1);
    this.openDraftsModal();
    this.renderCartTabs();
  },

  async openRecentSalesModal() {
    const sales = (await window.api.getSales({}).catch(() => [])) || [];
    const recent = sales.slice(0, 15);
    const body = document.getElementById('recentSalesModalBody');
    if (body) {
      body.innerHTML = `
        <table class="w-full text-xs text-right">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
              <th class="py-2">رقم الفاتورة</th>
              <th class="py-2">التاريخ</th>
              <th class="py-2">الزبون</th>
              <th class="py-2">الإجمالي</th>
              <th class="py-2">إجراءات سريعة</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
            ${recent
              .map(
                (s) => `
              <tr>
                <td class="py-2 font-mono font-bold">${s.doc_number || '#' + s.id}</td>
                <td class="py-2 font-mono">${String(s.sale_date || '').slice(0, 16)}</td>
                <td class="py-2 font-bold">${s.customer_name || 'زبون عابر'}</td>
                <td class="py-2 font-mono font-bold text-blue-600">${Number(s.total || 0).toFixed(2)} د.ج</td>
                <td class="py-2 flex gap-1.5">
                  <button onclick="App.reprintSale(${s.id}, 'receipt')" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold">تذكرة</button>
                  <button onclick="App.reprintSale(${s.id}, 'a4')" class="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold">A4</button>
                  <button onclick="App.closeModal('recentSalesModal'); App.loadSaleIntoPosForEdit(${s.id})" class="px-2.5 py-1 bg-amber-500 text-white rounded-lg font-bold">تعديل</button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;
    }
    this.openModal('recentSalesModal');
  },

  toggleReturnMode() {
    AppState.isReturnMode = !AppState.isReturnMode;
    const btn = document.getElementById('btnReturnMode');
    if (btn) {
      btn.className = AppState.isReturnMode
        ? 'px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center gap-1'
        : 'px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold flex items-center gap-1';
    }
    showToast(AppState.isReturnMode ? 'تم تفعيل وضع مرتجع المبيعات' : 'تم العودة لوضع البيع العادي', 'info');
  },

  setCartPriceTier(tier) {
    AppState.priceTier = tier;
    const sel = document.getElementById('posPriceTierSelect');
    if (sel) sel.value = tier;
    this.renderPosProductsGrid();
  },

  // ==========================================================================
  // 5. نافذة الدفع الشاملة (Checkout + Split Payment + Installments + Edit Sale)
  // ==========================================================================
  async openCheckoutModal() {
    if (this.currentCart.items.length === 0) {
      showToast('السلة فارغة! أضف منتجات أولاً', 'warning');
      return;
    }

    const { total } = this.recalcCart();
    document.getElementById('chkApplyTva').checked = false;
    document.getElementById('chkApplyStamp').checked = false;
    document.getElementById('chkPaymentMethod').value = 'cash';
    document.getElementById('chkPaidAmount').value = total.toFixed(2);
    document.getElementById('chkSplitPaymentBox').classList.add('hidden');
    document.getElementById('chkInstallmentBox').classList.add('hidden');

    const alertBox = document.getElementById('creditLimitAlertBox');
    if (alertBox) alertBox.classList.add('hidden');

    if (this.currentCart.customerId && window.api.getCustomerCreditSummary) {
      const creditInfo = await window.api
        .getCustomerCreditSummary(this.currentCart.customerId, AppState.editingSaleId)
        .catch(() => null);
      if (creditInfo && creditInfo.credit_limit > 0) {
        alertBox.classList.remove('hidden');
        alertBox.textContent = `الزبون: ${creditInfo.name} | الدين الحالي: ${creditInfo.current_debt} د.ج | سقف الدين: ${creditInfo.credit_limit} د.ج`;
      }
    }

    this.recalcCheckoutModal();
    this.openModal('checkoutModal');
  },

  onCheckoutMethodChange(method) {
    const splitBox = document.getElementById('chkSplitPaymentBox');
    const instBox = document.getElementById('chkInstallmentBox');
    splitBox.classList.toggle('hidden', method !== 'split');
    instBox.classList.toggle('hidden', method !== 'installment');

    if (method === 'split') {
      const { total } = this.recalcCart();
      document.getElementById('splitCashInput').value = (total / 2).toFixed(2);
      document.getElementById('splitCardInput').value = (total / 2).toFixed(2);
      document.getElementById('splitCreditInput').value = '0.00';
    }
    this.recalcCheckoutModal();
  },

  recalcSplitTotals() {
    const { subtotal, discount } = this.recalcCart();
    const applyTva = document.getElementById('chkApplyTva').checked;
    const applyStamp = document.getElementById('chkApplyStamp').checked;
    const afterDisc = subtotal - discount;
    const tvaAmount = applyTva ? afterDisc * 0.19 : 0;
    const stampAmount = applyStamp ? (afterDisc + tvaAmount) * 0.01 : 0;
    const finalTotal = Number((afterDisc + tvaAmount + stampAmount).toFixed(2));

    const cash = parseFloat(document.getElementById('splitCashInput').value) || 0;
    const card = parseFloat(document.getElementById('splitCardInput').value) || 0;
    const credit = Math.max(0, Number((finalTotal - cash - card).toFixed(2)));
    document.getElementById('splitCreditInput').value = credit.toFixed(2);
    document.getElementById('chkPaidAmount').value = (cash + card).toFixed(2);
    this.recalcCheckoutModal();
  },

  recalcCheckoutModal() {
    const { subtotal, discount } = this.recalcCart();
    const afterDisc = subtotal - discount;
    const applyTva = document.getElementById('chkApplyTva').checked;
    const applyStamp = document.getElementById('chkApplyStamp').checked;
    const method = document.getElementById('chkPaymentMethod').value;

    const tvaAmount = applyTva ? afterDisc * 0.19 : 0;
    const stampAmount = applyStamp ? (afterDisc + tvaAmount) * 0.01 : 0;
    const finalTotal = Number((afterDisc + tvaAmount + stampAmount).toFixed(2));

    document.getElementById('chkTotalDue').textContent = `${finalTotal.toFixed(2)} د.ج`;

    const paidInput = document.getElementById('chkPaidAmount');
    if (method === 'credit' && document.activeElement !== paidInput) {
      paidInput.value = '0';
    } else if (method === 'installment') {
      const down = parseFloat(document.getElementById('instDownPayment').value) || 0;
      const months = Math.max(1, parseInt(document.getElementById('instMonthsCount').value || '6', 10));
      const monthly = Math.max(0, (finalTotal - down) / months);
      document.getElementById('instMonthlyVal').value = `${monthly.toFixed(2)} د.ج / شهر`;
      paidInput.value = down.toFixed(2);
    }

    const paid = parseFloat(paidInput.value) || 0;
    const change = Math.max(0, Number((paid - finalTotal).toFixed(2)));
    document.getElementById('chkChangeAmount').textContent = `${change.toFixed(2)} د.ج`;

    let splitPayments = null;
    if (method === 'split') {
      const cash = parseFloat(document.getElementById('splitCashInput').value) || 0;
      const card = parseFloat(document.getElementById('splitCardInput').value) || 0;
      splitPayments = [];
      if (cash > 0) splitPayments.push({ method: 'cash', amount: cash });
      if (card > 0) splitPayments.push({ method: 'cib', amount: card });
    }

    let installmentPlan = null;
    if (method === 'installment') {
      installmentPlan = {
        down_payment: parseFloat(document.getElementById('instDownPayment').value) || 0,
        months_count: Math.max(1, parseInt(document.getElementById('instMonthsCount').value || '6', 10))
      };
    }

    return {
      subtotal,
      discount,
      tax_percentage: applyTva ? 19 : 0,
      stamp_amount: Number(stampAmount.toFixed(2)),
      total: finalTotal,
      paid_amount: Math.min(paid, finalTotal),
      payment_method: method,
      due_date: document.getElementById('chkDueDate')?.value || null,
      split_payments: splitPayments,
      installment_plan: installmentPlan
    };
  },

  addCashDenom(denom) {
    const inp = document.getElementById('chkPaidAmount');
    const current = parseFloat(inp.value) || 0;
    inp.value = (current + Number(denom)).toFixed(2);
    this.recalcCheckoutModal();
  },

  setExactCash() {
    const calc = this.recalcCheckoutModal();
    document.getElementById('chkPaidAmount').value = calc.total.toFixed(2);
    this.recalcCheckoutModal();
  },

  async submitSale(printMode = 'none') {
    const calc = this.recalcCheckoutModal();
    const cart = this.currentCart;

    if (
      (calc.payment_method === 'credit' ||
        calc.payment_method === 'installment' ||
        calc.paid_amount < calc.total - 0.01) &&
      !cart.customerId
    ) {
      showToast('يرجى اختيار الزبون عند البيع الآجل أو بالتقسيط أو الدفع الجزئي', 'error');
      return;
    }

    const salePayload = {
      editSaleId: AppState.editingSaleId || undefined,
      customer_id: cart.customerId || null,
      user_id: AppState.currentUser ? AppState.currentUser.id : 1,
      subtotal: calc.subtotal,
      discount: calc.discount,
      tax_percentage: calc.tax_percentage,
      stamp_amount: calc.stamp_amount,
      total: calc.total,
      paid_amount: calc.paid_amount,
      payment_method: calc.payment_method,
      due_date: calc.due_date,
      split_payments: calc.split_payments,
      installment_plan: calc.installment_plan,
      items: cart.items
    };

    try {
      const res = await window.api.processSale(salePayload);
      this.closeModal('checkoutModal');
      showToast(
        AppState.editingSaleId
          ? `تم تحديث الفاتورة بنجاح (${AppState.editingSaleNumber})`
          : `تم تسجيل الفاتورة بنجاح (${res.docNumber || '#' + res.saleId})`,
        'success'
      );

      if (printMode !== 'none' && window.PrintEngine) {
        const fullSale = await window.api.getSaleDetails(res.saleId);
        const html =
          printMode === 'a4'
            ? await window.PrintEngine.renderInvoiceHtml(fullSale, AppState.settings)
            : await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings);
        await window.PrintEngine.printHtmlDocument(html, {
          silent: String(AppState.settings.silent_print) === 'true'
        });
      }

      AppState.editingSaleId = null;
      AppState.editingSaleNumber = null;
      this.currentCart.items = [];
      const discInput = document.getElementById('cartDiscountInput');
      if (discInput) discInput.value = '0';
      await this.refreshProducts();
      this.renderPosView();
    } catch (err) {
      showToast(err.message || 'حدث خطأ أثناء حفظ الفاتورة', 'error');
    }
  },

  async saveCartAsProforma() {
    if (this.currentCart.items.length === 0) {
      showToast('السلة فارغة!', 'warning');
      return;
    }
    const { subtotal, discount, total } = this.recalcCart();
    const res = await window.api.createProforma({
      customer_id: this.currentCart.customerId || null,
      subtotal,
      discount,
      total,
      items: this.currentCart.items
    });
    this.currentCart.items = [];
    this.renderCartItems();
    showToast(`تم حفظ الفاتورة الشكلية (${res.doc_number})`, 'success');
    if (window.PrintEngine) {
      const fullPf = await window.api.getProformaDetails(res.id);
      const html = await window.PrintEngine.renderProformaHtml(fullPf, AppState.settings, AppState.lang);
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  },

  openOrderModalFromCart() {
    if (this.currentCart.items.length === 0) {
      showToast('السلة فارغة!', 'warning');
      return;
    }
    document.getElementById('orderDepositInput').value = '0';
    document.getElementById('orderDeliveryDateInput').value = new Date(Date.now() + 86400000)
      .toISOString()
      .slice(0, 10);
    document.getElementById('orderNotesInput').value = '';
    document.getElementById('orderReserveStockCheckbox').checked = true;
    this.openModal('orderModal');
  },

  async confirmSaveCartAsOrder() {
    const { subtotal, discount, total } = this.recalcCart();
    const deposit = parseFloat(document.getElementById('orderDepositInput').value) || 0;
    const expectedDate = document.getElementById('orderDeliveryDateInput').value || null;
    const notes = document.getElementById('orderNotesInput').value.trim();
    const reservesStock = document.getElementById('orderReserveStockCheckbox').checked;

    const res = await window.api.createOrder({
      customer_id: this.currentCart.customerId || null,
      user_id: AppState.currentUser ? AppState.currentUser.id : 1,
      subtotal,
      discount,
      total,
      deposit_amount: deposit,
      expected_delivery_date: expectedDate,
      notes,
      reserves_stock: reservesStock,
      items: this.currentCart.items
    });

    this.closeModal('orderModal');
    this.currentCart.items = [];
    this.renderCartItems();
    showToast(`تم حفظ طلبية الزبون (${res.doc_number})`, 'success');

    if (window.PrintEngine) {
      const fullOrd = await window.api.getOrderDetails(res.id);
      const html = await window.PrintEngine.renderOrderReceiptHtml(fullOrd, AppState.settings, AppState.lang);
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  },

  // ==========================================================================
  // 6. النوافذ السريعة (المنتج الحر F8، وصفة التصنيع BOM، والمصادقة) — [الشطر الثاني 2/3]
  // ==========================================================================
  openFreeItemModal() {
    document.getElementById('freeItemName').value = 'منتج متنوع';
    document.getElementById('freeItemPrice').value = '100';
    document.getElementById('freeItemQty').value = '1';
    this.openModal('freeItemModal');
  },

  confirmFreeItem() {
    const name = document.getElementById('freeItemName').value.trim() || 'منتج حر';
    const price = parseFloat(document.getElementById('freeItemPrice').value) || 0;
    const qty = parseFloat(document.getElementById('freeItemQty').value) || 1;
    this.currentCart.items.push({
      product_id: null,
      name,
      custom_product_name: name,
      unit: 'وحدة',
      quantity: qty,
      price,
      subtotal: Number((qty * price).toFixed(2))
    });
    this.closeModal('freeItemModal');
    this.renderCartItems();
  },

  async saveBomRecipeFromModal() {
    const name = document.getElementById('bomRecipeName').value.trim() || 'وصفة تصنيع';
    const productId = Number(document.getElementById('bomTargetProduct').value);
    const compId = Number(document.getElementById('bomComponentSelect').value);
    const compQty = parseFloat(document.getElementById('bomComponentQty').value) || 1;
    const outputQty = parseFloat(document.getElementById('bomOutputQty').value) || 1;
    const autoOnSale = document.getElementById('bomAutoOnSale').checked ? 1 : 0;

    if (!productId || !compId) {
      showToast('يرجى اختيار المنتج النهائي والمكون الأولي', 'warning');
      return;
    }
    await window.api.saveBomRecipe({
      name,
      product_id: productId,
      output_qty: outputQty,
      auto_on_sale: autoOnSale,
      components: [{ component_product_id: compId, quantity: compQty }]
    });
    this.closeModal('bom-recipe-modal');
    if (window.ManufacturingUI) await window.ManufacturingUI.renderManufacturingView();
    showToast('تم حفظ وصفة التصنيع بنجاح', 'success');
  },

  openLoginModal() {
    document.getElementById('authErrorBox').textContent = '';
    this.openModal('authModal');
  },

  async submitAuthModal() {
    const u = document.getElementById('authUsernameInput').value.trim();
    const p = document.getElementById('authPasswordInput').value;
    const res = await window.api.loginUser(u, p);
    if (res && res.success) {
      AppState.currentUser = res.user || res;
      this.updateUserBadge();
      this.closeModal('authModal');
      showToast(`مرحباً بك، ${AppState.currentUser.name}`, 'success');
    } else {
      document.getElementById('authErrorBox').textContent = 'بيانات الدخول غير صحيحة';
    }
  },

  // ==========================================================================
  // 7. سجل المبيعات المطور، تعديل الفاتورة، وفاحص الضمان برقم IMEI / Serial
  // ==========================================================================
  async renderSalesHistoryView(filters = {}) {
    const root = document.getElementById('sales-view-root');
    if (!root) return;
    let sales = (await window.api.getSales(filters).catch(() => [])) || [];

    if (filters.paymentStatus === 'paid') {
      sales = sales.filter((s) => Number(s.paid_amount || 0) >= Number(s.total || 0) - 0.01);
    } else if (filters.paymentStatus === 'unpaid') {
      sales = sales.filter((s) => Number(s.paid_amount || 0) < Number(s.total || 0) - 0.01);
    }

    root.innerHTML = `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">سجل المبيعات، تعديل الفواتير، وفاحص الضمان (${sales.length})</h2>
            <p class="text-xs text-slate-500">تعديل الفواتير، فحص صلاحية الضمان برقم IMEI/Serial، طباعة وصولات التوصيل، وإشعارات الدائن</p>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <select id="salesFilterCustomer" class="px-3 py-2 rounded-xl font-bold">
              <option value="">جميع الزبائن</option>
              ${AppState.customers
                .map(
                  (c) =>
                    `<option value="${c.id}" ${Number(filters.customerId) === Number(c.id) ? 'selected' : ''}>${c.name}</option>`
                )
                .join('')}
            </select>
            <select id="salesFilterStatus" class="px-3 py-2 rounded-xl font-bold">
              <option value="" ${!filters.paymentStatus ? 'selected' : ''}>جميع الحالات</option>
              <option value="paid" ${filters.paymentStatus === 'paid' ? 'selected' : ''}>مسددة بالكامل</option>
              <option value="unpaid" ${filters.paymentStatus === 'unpaid' ? 'selected' : ''}>غير مسددة (بها دين)</option>
            </select>
            <input id="salesFilterFrom" type="date" value="${filters.dateFrom || ''}" class="px-3 py-2 rounded-xl font-mono">
            <input id="salesFilterTo" type="date" value="${filters.dateTo || ''}" class="px-3 py-2 rounded-xl font-mono">
            <button onclick="App.filterSalesHistory()" class="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold">تصفية</button>
            <button onclick="window.api.exportSalesToExcel()" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-1">
              <span class="material-symbols-rounded icon-sm">download</span>
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        <!-- شريط فاحص الضمان برقم IMEI / Serial Number -->
        <div class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2">
            <span class="material-symbols-rounded text-indigo-600">verified_user</span>
            <div>
              <div class="font-black text-sm text-indigo-700 dark:text-indigo-300">فاحص الضمان الفوري بالأرقام التسلسلية (IMEI / Serial Warranty Checker)</div>
              <div class="text-slate-500">امسح أو أدخل رقم IMEI / S/N للتحقق الفوري من فاتورة الشراء وصلاحية الضمان</div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <input id="warrantySerialSearchInput" type="text" placeholder="أدخل أو امسح رقم IMEI / S/N هنا..."
              onkeydown="if(event.key==='Enter') App.checkWarrantyBySerial()"
              class="flex-1 px-3 py-2 rounded-xl font-mono font-bold">
            <button onclick="App.checkWarrantyBySerial()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold">فحص الضمان</button>
          </div>
          <div id="warrantyCheckResultBox" class="w-full hidden pt-2 border-t border-indigo-500/20"></div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2.5 px-2">رقم الفاتورة</th>
                <th class="py-2.5 px-2">التاريخ</th>
                <th class="py-2.5 px-2">الزبون</th>
                <th class="py-2.5 px-2">طريقة الدفع</th>
                <th class="py-2.5 px-2">الإجمالي</th>
                <th class="py-2.5 px-2">المدفوع</th>
                <th class="py-2.5 px-2">الباقي</th>
                <th class="py-2.5 px-2">إشعار دائن</th>
                <th class="py-2.5 px-2">إجراءات المستندات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${
                sales.length === 0
                  ? '<tr><td colspan="9" class="py-10 text-center text-slate-400 font-bold">لا توجد فواتير مبيعات مطابقة للبحث</td></tr>'
                  : sales
                      .map((s) => {
                        const rem = Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0));
                        return `
                        <tr>
                          <td class="py-2.5 px-2 font-mono font-bold text-blue-600">${s.doc_number || '#' + s.id}</td>
                          <td class="py-2.5 px-2 font-mono">${String(s.sale_date || '').slice(0, 16)}</td>
                          <td class="py-2.5 px-2 font-bold">${s.customer_name || 'زبون عابر'}</td>
                          <td class="py-2.5 px-2 font-bold text-slate-500">${s.payment_method || 'cash'}</td>
                          <td class="py-2.5 px-2 font-mono font-black">${Number(s.total || 0).toFixed(2)} د.ج</td>
                          <td class="py-2.5 px-2 font-mono text-emerald-600 font-bold">${Number(s.paid_amount || 0).toFixed(2)}</td>
                          <td class="py-2.5 px-2 font-mono ${rem > 0 ? 'text-rose-500 font-black' : 'text-slate-400'}">${rem.toFixed(2)}</td>
                          <td class="py-2.5 px-2 font-mono text-rose-600 font-bold">${s.credit_note_number || '-'}</td>
                          <td class="py-2.5 px-2 flex flex-wrap items-center gap-1">
                            <button onclick="App.openSaleDetailsModal(${s.id})" class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg font-bold">تفاصيل</button>
                            <button onclick="App.loadSaleIntoPosForEdit(${s.id})" class="px-2 py-1 bg-amber-500/15 text-amber-600 rounded-lg font-bold" title="تحميل الفاتورة للكاشير لتعديلها">تعديل</button>
                            <button onclick="App.openPrintCenterModal(${s.id}, 'invoice_a4')" class="px-2 py-1 bg-indigo-600 text-white rounded-lg font-bold" title="مركز الطباعة واللغات">🖨️ طباعة</button>
                            <button onclick="App.reprintSale(${s.id}, 'a4')" class="px-2 py-1 bg-blue-600/10 text-blue-600 rounded-lg font-bold">A4</button>
                            <button onclick="App.reprintSale(${s.id}, 'receipt')" class="px-2 py-1 bg-emerald-600/10 text-emerald-600 rounded-lg font-bold">تذكرة</button>
                            <button onclick="App.openDeliveryNoteModal(${s.id})" class="px-2 py-1 bg-teal-600/10 text-teal-600 rounded-lg font-bold">توصيل BL</button>
                            <button onclick="App.openCreditNoteModal(${s.id})" class="px-2 py-1 bg-rose-500/15 text-rose-600 rounded-lg font-bold">إشعار دائن</button>
                            <button onclick="App.deleteSaleRecord(${s.id})" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                          </td>
                        </tr>`;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>`;
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  async filterSalesHistory() {
    const customerId = document.getElementById('salesFilterCustomer')?.value || '';
    const paymentStatus = document.getElementById('salesFilterStatus')?.value || '';
    const dateFrom = document.getElementById('salesFilterFrom')?.value || '';
    const dateTo = document.getElementById('salesFilterTo')?.value || '';
    await this.renderSalesHistoryView({ customerId, paymentStatus, dateFrom, dateTo });
  },

  async checkWarrantyBySerial() {
    const serial = document.getElementById('warrantySerialSearchInput')?.value?.trim();
    const resBox = document.getElementById('warrantyCheckResultBox');
    if (!serial || !resBox) return;

    const info = await window.api.lookupWarrantySerial(serial);
    resBox.classList.remove('hidden');

    if (!info || !info.found) {
      resBox.innerHTML = `<div class="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 font-bold">❌ لم يتم العثور على أي جهاز مباع بالرقم التسلسلي (${serial})</div>`;
      return;
    }

    resBox.innerHTML = `
      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="font-black text-sm">${info.product_name} <span class="font-mono text-indigo-600">[S/N: ${info.serial}]</span></div>
          <div class="text-slate-500">المشتري: <strong>${info.customer_name}</strong> | فاتورة: <strong class="font-mono">${info.doc_number}</strong> | تاريخ الشراء: <strong class="font-mono">${info.sale_date}</strong></div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-left">
            <div class="font-black ${info.is_valid ? 'text-emerald-600' : 'text-rose-600'}">
              ${info.is_valid ? `✅ الضمان ساري المفعول (متبقي ${info.days_remaining} يوماً)` : '❌ انتهت فترة الضمان'}
            </div>
            <div class="text-[11px] font-mono text-slate-400">ينتهي في: ${info.warranty_end_date} (${info.warranty_months} شهراً)</div>
          </div>
          <button onclick="App.openSaleDetailsModal(${info.sale_id})" class="px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-bold">فتح الفاتورة والطباعة</button>
        </div>
      </div>`;
  },

  async openSaleDetailsModal(saleId) {
    const fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;
    document.getElementById('saleDetailsModalTitle').textContent = `تفاصيل الفاتورة (${fullSale.doc_number || '#' + fullSale.id})`;
    const body = document.getElementById('saleDetailsModalBody');
    const items = fullSale.items || [];
    const rem = Math.max(0, Number(fullSale.total || 0) - Number(fullSale.paid_amount || 0));

    body.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
        <div><span class="text-slate-400">الزبون:</span> <strong>${fullSale.customer_name || 'زبون عابر'}</strong></div>
        <div><span class="text-slate-400">التاريخ:</span> <strong class="font-mono">${String(fullSale.sale_date || '').slice(0, 16)}</strong></div>
        <div><span class="text-slate-400">الإجمالي:</span> <strong class="font-mono text-blue-600">${Number(fullSale.total || 0).toFixed(2)} د.ج</strong></div>
        <div><span class="text-slate-400">المدفوع:</span> <strong class="font-mono text-emerald-600">${Number(fullSale.paid_amount || 0).toFixed(2)} د.ج</strong></div>
      </div>

      ${
        rem > 0.01
          ? `<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <span>متبقي غير مسدد على هذه الفاتورة: <strong class="font-mono text-rose-500">${rem.toFixed(2)} د.ج</strong></span>
              <div class="flex gap-1.5">
                <input id="saleDetailQuickPayInput" type="number" step="any" value="${rem.toFixed(2)}" class="w-28 px-2 py-1 rounded-lg font-mono font-bold text-center">
                <button onclick="App.addQuickPaymentToSale(${fullSale.id})" class="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold">تسديد وطباعة وصل</button>
              </div>
            </div>`
          : ''
      }

      <table class="w-full text-xs text-right">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
            <th class="py-2">المنتج</th>
            <th class="py-2">الكمية</th>
            <th class="py-2">السعر</th>
            <th class="py-2">المجموع</th>
            <th class="py-2">السيريال / الضمان</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${items
            .map(
              (it, idx) => `
            <tr>
              <td class="py-2 font-bold">${it.product_name}</td>
              <td class="py-2 font-mono">${it.quantity}</td>
              <td class="py-2 font-mono">${Number(it.price || 0).toFixed(2)}</td>
              <td class="py-2 font-mono font-bold">${Number(it.subtotal || 0).toFixed(2)} د.ج</td>
              <td class="py-2">
                <button onclick="App.printSaleItemWarranty(${fullSale.id}, ${idx})" class="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold text-[11px]">
                  شهادة ضمان ${it.serial_number ? '(' + it.serial_number + ')' : ''}
                </button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
    this.openModal('saleDetailsModal');
  },

  async addQuickPaymentToSale(saleId) {
    const amt = parseFloat(document.getElementById('saleDetailQuickPayInput')?.value) || 0;
    if (amt <= 0) return;
    const res = await window.api.addSalePayment(saleId, amt, new Date().toISOString(), {
      payment_method: 'cash',
      userId: AppState.currentUser ? AppState.currentUser.id : 1
    });
    await this.openSaleDetailsModal(saleId);
    await this.renderSalesHistoryView();
    showToast('تم تسجيل الدفعة على الفاتورة بنجاح', 'success');

    if (res && res.paymentId && window.PrintEngine) {
      const details = await window.api.getPaymentDetails(res.paymentId, 'sale');
      if (details) {
        const html = await window.PrintEngine.renderPaymentReceiptHtml(details, AppState.settings, AppState.lang);
        await window.PrintEngine.printHtmlDocument(html, { silent: false });
      }
    }
  },

  async printSaleItemWarranty(saleId, itemIndex) {
    const fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale || !fullSale.items || !fullSale.items[itemIndex]) return;
    const item = fullSale.items[itemIndex];
    if (window.PrintEngine && window.PrintEngine.renderWarrantyCertificateHtml) {
      const html = window.PrintEngine.renderWarrantyCertificateHtml(item, fullSale, AppState.settings);
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  },

  openCreditNoteModal(saleId) {
    document.getElementById('creditNoteSaleId').value = String(saleId);
    document.getElementById('creditNoteReasonInput').value = 'إرجاع بضاعة / تصحيح فاتورة بيع';
    this.openModal('creditNoteModal');
  },

  async confirmIssueCreditNote() {
    const saleId = Number(document.getElementById('creditNoteSaleId').value);
    const reason = document.getElementById('creditNoteReasonInput').value.trim() || 'إرجاع بضاعة';
    if (!saleId) return;

    const res = await window.api.issueCreditNote({ saleId, reason });
    this.closeModal('creditNoteModal');
    const fullSale = await window.api.getSaleDetails(saleId);
    if (fullSale && window.PrintEngine) {
      fullSale.credit_note_number = res.credit_note_number;
      fullSale.credit_note_reason = reason;
      const html = await window.PrintEngine.renderCreditNoteHtml(fullSale, AppState.settings, AppState.lang);
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
    await this.renderSalesHistoryView();
    showToast(`تم إصدار إشعار الدائن (${res.credit_note_number}) بنجاح`, 'success');
  },

  openDeliveryNoteModal(saleId) {
    document.getElementById('deliveryNoteSaleId').value = String(saleId);
    document.getElementById('delivDriverInput').value = '';
    document.getElementById('delivVehicleInput').value = '';
    this.openModal('deliveryNoteModal');
  },

  async confirmPrintDeliveryNote() {
    const saleId = Number(document.getElementById('deliveryNoteSaleId').value);
    const driverName = document.getElementById('delivDriverInput').value.trim();
    const vehiclePlate = document.getElementById('delivVehicleInput').value.trim();
    const fmt = document.getElementById('delivFormatSelect').value || 'ar';

    const fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale || !window.PrintEngine) return;

    this.closeModal('deliveryNoteModal');
    const html = await window.PrintEngine.renderDeliveryNoteHtml(
      {
        ...fullSale,
        driver_name: driverName,
        carrier_name: driverName,
        vehicle_plate: vehiclePlate
      },
      AppState.settings,
      fmt
    );
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  async reprintSale(saleId, mode = 'a4') {
    const fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale || !window.PrintEngine) return;
    const html =
      mode === 'a4'
        ? await window.PrintEngine.renderInvoiceHtml(fullSale, AppState.settings)
        : await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings);
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  async deleteSaleRecord(saleId) {
    if (!confirm('هل تريد حذف هذه الفاتورة واسترجاع مخزونها بالكامل؟')) return;
    await window.api.deleteSale(saleId);
    await logSecurityAudit('sale_deleted', { sale_id: saleId }, 'danger', 'sale', saleId);
    await this.renderSalesHistoryView();
    showToast('تم حذف الفاتورة واسترجاع المخزون', 'info');
  },

  // ==========================================================================
  // 8. إدارة الصندوق والمناوبات (Caisse & Shifts)
  // ==========================================================================
  async renderCaisseView() {
    const root = document.getElementById('caisse-view-root');
    if (!root) return;
    const [active, sessions, txLog] = await Promise.all([
      window.api.getActiveSession(AppState.currentUser.id).catch(() => null),
      window.api.getCaisseSessions().catch(() => []),
      window.api.getCaisseTransactionsLog().catch(() => [])
    ]);
    AppState.activeSession = active;
    this.updateShiftHeaderBadge();

    const curBal = active && active.summary ? Number(active.summary.currentBalance || 0) : 0;

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">إدارة الصندوق والمناوبات (Caisse & Shifts)</h2>
            <p class="text-xs text-slate-500">فتح وإغلاق الورديات، الإيداع والسحب النقدي، وتقارير Z-Report</p>
          </div>
          <div class="flex flex-wrap gap-2">
            ${
              !active
                ? `<button onclick="App.openNewShiftModal()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow">فتح مناوبة صندوق جديدة</button>`
                : `
                  <button onclick="App.openCaisseTxModal('cash_in')" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">+ إيداع نقدي</button>
                  <button onclick="App.openCaisseTxModal('cash_out')" class="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold">- سحب نقدي</button>
                  <button onclick="App.openCloseShiftModal(${active.session.id}, ${curBal})" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">إغلاق المناوبة (Z-Report)</button>
                `
            }
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">الرصيد الافتتاحي</div>
            <div class="text-xl font-black font-mono mt-1">${active ? Number(active.summary.openingBalance).toFixed(2) : '0.00'} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">مبيعات وتسديدات النقد</div>
            <div class="text-xl font-black font-mono text-emerald-600 mt-1">${active ? Number(active.summary.totalSalesCash).toFixed(2) : '0.00'} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">المصاريف والمسحوبات</div>
            <div class="text-xl font-black font-mono text-rose-500 mt-1">${active ? Number(active.summary.totalExpenses + active.summary.totalCashOut).toFixed(2) : '0.00'} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <div class="text-xs opacity-80 font-bold">الرصيد المتوقع في الدرج</div>
            <div class="text-2xl font-black font-mono mt-1">${curBal.toFixed(2)} د.ج</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">سجل المناوبات (${sessions.length})</h3>
            <div class="overflow-x-auto max-h-80">
              <table class="w-full text-xs text-right">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th class="py-2">#</th>
                    <th class="py-2">المستخدم</th>
                    <th class="py-2">الافتتاح</th>
                    <th class="py-2">الافتتاحي</th>
                    <th class="py-2">الختامي</th>
                    <th class="py-2">الفارق</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                  ${sessions
                    .map(
                      (s) => `
                    <tr>
                      <td class="py-2 font-mono flex items-center gap-1">#${s.id} <button onclick="App.printSessionZReport(${s.id})">🖨️ Z</button><button onclick="App.openSessionReviewModal(${s.id})" class="px-1.5 py-0.5 bg-blue-600/15 text-blue-600 rounded text-[10px] font-sans font-bold" title="مراجعة تفاصيل المناوبة">تفاصيل</button><button style="display:none" class="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-sans font-bold" title="طباعة تقرير Z-Report">🖨️ Z</button></td>
                      <td class="py-2 font-bold">${s.user_name || 'المدير'}</td>
                      <td class="py-2 font-mono">${String(s.opened_at || '').slice(0, 16)}</td>
                      <td class="py-2 font-mono">${Number(s.opening_balance || 0).toFixed(2)}</td>
                      <td class="py-2 font-mono">${s.closing_balance !== null ? Number(s.closing_balance).toFixed(2) : '-'}</td>
                      <td class="py-2 font-mono ${Number(s.difference || 0) < 0 ? 'text-rose-500 font-bold' : 'text-emerald-600'}">${s.difference !== null ? Number(s.difference).toFixed(2) : s.status === 'open' ? 'مفتوحة' : '-'}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">حركات الخزينة المباشرة (${txLog.length})</h3>
            <div class="overflow-x-auto max-h-80">
              <table class="w-full text-xs text-right">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th class="py-2">النوع</th>
                    <th class="py-2">البيان</th>
                    <th class="py-2">المبلغ</th>
                    <th class="py-2">التوقيت</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                  ${txLog
                    .slice(0, 40)
                    .map(
                      (t) => `
                    <tr>
                      <td class="py-2 font-bold ${t.type === 'cash_in' || t.type === 'order_deposit' ? 'text-emerald-600' : 'text-rose-500'}">${t.type}</td>
                      <td class="py-2">${t.description || t.category || '-'}</td>
                      <td class="py-2 font-mono font-bold">${Number(t.amount || 0).toFixed(2)} د.ج</td>
                      <td class="py-2 font-mono text-slate-400">${String(t.created_at || '').slice(0, 16)}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  },

  openNewShiftModal() {
    document.getElementById('openShiftBalanceInput').value = '0';
    this.openModal('openShiftModal');
  },

  async confirmOpenShift() {
    const val = parseFloat(document.getElementById('openShiftBalanceInput').value) || 0;
    await window.api.openCaisseSession({
      userId: AppState.currentUser ? AppState.currentUser.id : 1,
      openingBalance: val
    });
    this.closeModal('openShiftModal');
    await this.renderCaisseView();
    showToast('تم فتح مناوبة الصندوق بنجاح', 'success');
  },

  openCaisseTxModal(type = 'cash_in') {
    document.getElementById('caisseTxTypeInput').value = type;
    document.getElementById('caisseTxModalTitle').textContent =
      type === 'cash_in' ? 'إيداع نقدي في الصندوق' : 'سحب نقدي من الصندوق';
    document.getElementById('caisseTxAmountInput').value = '1000';
    document.getElementById('caisseTxDescInput').value = '';
    this.openModal('caisseTxModal');
  },

  async confirmCaisseTx() {
    const type = document.getElementById('caisseTxTypeInput').value || 'cash_in';
    const amt = parseFloat(document.getElementById('caisseTxAmountInput').value) || 0;
    const desc =
      document.getElementById('caisseTxDescInput').value.trim() ||
      (type === 'cash_in' ? 'إيداع نقدي' : 'سحب نقدي');
    if (amt <= 0) return;

    await window.api.addCaisseTransaction({
      type,
      amount: amt,
      description: desc,
      user_id: AppState.currentUser ? AppState.currentUser.id : 1
    });
    this.closeModal('caisseTxModal');
    await this.renderCaisseView();
    showToast('تم تسجيل الحركة النقدية في الصندوق', 'success');
  },

  openCloseShiftModal(sessionId, expectedBalance = 0) {
    document.getElementById('closeShiftSessionId').value = String(sessionId);
    document.getElementById('closeShiftExpectedText').textContent = `${Number(expectedBalance).toFixed(2)} د.ج`;
    document.getElementById('closeShiftCountedInput').value = Number(expectedBalance).toFixed(2);
    document.getElementById('closeShiftNoteInput').value = '';
    this.openModal('closeShiftModal');
  },

  async confirmCloseShift() {
    const sessionId = Number(document.getElementById('closeShiftSessionId').value);
    const counted = parseFloat(document.getElementById('closeShiftCountedInput').value) || 0;
    const note = document.getElementById('closeShiftNoteInput').value.trim();

    await window.api.closeCaisseSession({
      sessionId,
      closingBalance: counted,
      closeNote: note
    });
    this.closeModal('closeShiftModal');
    await this.renderCaisseView();
    showToast('تم إغلاق المناوبة وحفظ تقرير Z-Report بنجاح', 'success');
  },

  // ==========================================================================
  // 9. إدارة المخزون، فلاتر المخزون المتقدمة، القاموس الجزائري 613 الضخم، و Markup %
  // ==========================================================================
  async renderInventoryView(filters = {}) {
    const root = document.getElementById('inventory-view-root');
    if (!root) return;
    if (filters.stockStatus !== undefined) AppState.invStockFilter = filters.stockStatus;
    if (filters.search !== undefined) AppState.invSearchQuery = filters.search;
    if (filters.sort !== undefined) AppState.invSortKey = filters.sort;

    const [allProducts, debtSum, dzStats] = await Promise.all([
      window.api.getProducts({ search: AppState.invSearchQuery, sort: AppState.invSortKey }).catch(() => []),
      window.api.getStockDebtSummary().catch(() => ({ count: 0, total_qty: 0 })),
      window.api.getDzDictionaryStats ? window.api.getDzDictionaryStats().catch(() => ({ count: 31 })) : { count: 31 }
    ]);
    AppState.products = allProducts;

    const lowStockCount = allProducts.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.min_stock || 5)).length;
    const outOfStockCount = allProducts.filter((p) => Number(p.stock) <= 0).length;
    const expiredCount = allProducts.filter((p) => Number(p.expired_qty || 0) > 0).length;

    let products = allProducts;
    if (AppState.invStockFilter === 'available') {
      products = allProducts.filter((p) => Number(p.stock) > 0);
    } else if (AppState.invStockFilter === 'low') {
      products = allProducts.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.min_stock || 5));
    } else if (AppState.invStockFilter === 'out') {
      products = allProducts.filter((p) => Number(p.stock) <= 0);
    } else if (AppState.invStockFilter === 'expired') {
      products = allProducts.filter((p) => Number(p.expired_qty || 0) > 0);
    }

    root.innerHTML = `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">إدارة المخزون، الدفعات، والمتغيرات (${products.length} منتج)</h2>
            <p class="text-xs text-slate-500">القاموس الجزائري الذكي (يضم حالياً <strong>${dzStats.count || 31}</strong> منتج بباركود 613)، الدفعات، ومصفوفة المتغيرات</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="App.importDzDictionaryNow()" class="px-3.5 py-2 bg-amber-500/15 text-amber-600 border border-amber-500/30 rounded-xl text-xs font-bold">
              🇩🇿 استيراد قاموس 613 (CSV)
            </button>
            <button onclick="App.openStockDebtModal()" class="px-3.5 py-2 bg-rose-500/15 text-rose-600 rounded-xl text-xs font-bold">
              ديون المخزون (${debtSum.count || 0})
            </button>
            <button onclick="window.api.downloadInventoryTemplate()" class="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold">قالب Excel</button>
            <button onclick="window.api.importProductsFromExcel().then(() => App.renderInventoryView())" class="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">استيراد Excel</button>
            <button onclick="window.api.exportProductsToExcel()" class="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">تصدير Excel</button>
            <button onclick="App.openProductModal()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow">+ منتج جديد</button>
          </div>
        </div>

        <!-- بطاقات فلاتر حالة المخزون التفاعلية -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div onclick="App.renderInventoryView({ stockStatus: 'all' })" class="p-3.5 rounded-2xl cursor-pointer border ${AppState.invStockFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}">
            <div class="opacity-80 font-bold">جميع المنتجات</div>
            <div class="text-xl font-black font-mono mt-1">${allProducts.length}</div>
          </div>
          <div onclick="App.renderInventoryView({ stockStatus: 'available' })" class="p-3.5 rounded-2xl cursor-pointer border ${AppState.invStockFilter === 'available' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}">
            <div class="opacity-80 font-bold">متوفرة في المخزون</div>
            <div class="text-xl font-black font-mono mt-1">${allProducts.length - outOfStockCount}</div>
          </div>
          <div onclick="App.renderInventoryView({ stockStatus: 'low' })" class="p-3.5 rounded-2xl cursor-pointer border ${AppState.invStockFilter === 'low' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}">
            <div class="opacity-80 font-bold">منخفضة المخزون</div>
            <div class="text-xl font-black font-mono mt-1">${lowStockCount}</div>
          </div>
          <div onclick="App.renderInventoryView({ stockStatus: 'out' })" class="p-3.5 rounded-2xl cursor-pointer border ${AppState.invStockFilter === 'out' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}">
            <div class="opacity-80 font-bold">نافدة (الرصيد <= 0)</div>
            <div class="text-xl font-black font-mono mt-1">${outOfStockCount}</div>
          </div>
          <div onclick="App.renderInventoryView({ stockStatus: 'expired' })" class="p-3.5 rounded-2xl cursor-pointer border ${AppState.invStockFilter === 'expired' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}">
            <div class="opacity-80 font-bold">منتهية الصلاحية</div>
            <div class="text-xl font-black font-mono mt-1">${expiredCount}</div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <input id="invSearchInput" type="text" value="${AppState.invSearchQuery || ''}" placeholder="ابحث بالاسم أو الباركود أو الفئة (Enter)..."
              onkeydown="if(event.key==='Enter') App.renderInventoryView({ search: this.value })"
              class="w-80 px-3 py-2 rounded-xl text-xs font-bold">
            <select onchange="App.renderInventoryView({ sort: this.value })" class="px-3 py-2 rounded-xl text-xs font-bold">
              <option value="newest" ${AppState.invSortKey === 'newest' ? 'selected' : ''}>الأحدث إضافة</option>
              <option value="name_asc" ${AppState.invSortKey === 'name_asc' ? 'selected' : ''}>الاسم (أ - ي)</option>
              <option value="stock_asc" ${AppState.invSortKey === 'stock_asc' ? 'selected' : ''}>الأقل رصيداً</option>
              <option value="stock_desc" ${AppState.invSortKey === 'stock_desc' ? 'selected' : ''}>الأكثر رصيداً</option>
              <option value="expiry_asc" ${AppState.invSortKey === 'expiry_asc' ? 'selected' : ''}>الأقرب انتهاءً للصلاحية</option>
            </select>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-xs text-right">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th class="py-2.5 px-2">الباركود</th>
                  <th class="py-2.5 px-2">المنتج</th>
                  <th class="py-2.5 px-2">الفئة</th>
                  <th class="py-2.5 px-2">سعر الشراء</th>
                  <th class="py-2.5 px-2">سعر البيع</th>
                  <th class="py-2.5 px-2">سعر الجملة</th>
                  <th class="py-2.5 px-2">الرصيد الكلي</th>
                  <th class="py-2.5 px-2">أقرب صلاحية</th>
                  <th class="py-2.5 px-2">إجراءات</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                ${products
                  .map(
                    (p) => `
                  <tr>
                    <td class="py-2 px-2 font-mono text-slate-500">${p.barcode || '-'}</td>
                    <td class="py-2 px-2 font-bold">${p.name}</td>
                    <td class="py-2 px-2">${p.category || 'عام'}</td>
                    <td class="py-2 px-2 font-mono">${Number(p.cost_price || 0).toFixed(2)}</td>
                    <td class="py-2 px-2 font-mono font-bold text-blue-600">${Number(p.selling_price || 0).toFixed(2)}</td>
                    <td class="py-2 px-2 font-mono">${p.wholesale_price ? Number(p.wholesale_price).toFixed(2) : '-'}</td>
                    <td class="py-2 px-2 font-mono font-bold ${Number(p.stock) <= 0 ? 'text-rose-500' : ''}">${p.stock} ${p.unit || ''}</td>
                    <td class="py-2 px-2 font-mono text-slate-500">${p.next_expiry || p.expiry_date || '-'}</td>
                    <td class="py-2 px-2 flex flex-wrap items-center gap-1">
                      <button onclick="App.editProductById(${p.id})" class="px-2 py-1 bg-blue-500/10 text-blue-600 rounded-lg font-bold">تعديل</button>
                      <button onclick="App.openBatchesModal(${p.id})" class="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg font-bold">الدفعات (${(p.batches || []).length})</button>
                      <button onclick="App.openProductAnalyticsModal(${p.id})" class="px-2 py-1 bg-indigo-500/10 text-indigo-600 rounded-lg font-bold">ربحية</button>
                      <button onclick="App.enqueueProductForLabelPrint(${p.id})" class="px-2 py-1 bg-amber-500/15 text-amber-600 rounded-lg font-bold" title="إضافة لطابور طباعة الباركود">باركود</button>
                      <button onclick="window.api.deleteProduct(${p.id}).then(() => App.renderInventoryView())" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                    </td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  async importDzDictionaryNow() {
    if (!window.api || !window.api.importDzDictionaryCsv) return;
    const res = await window.api.importDzDictionaryCsv();
    if (res && res.success) {
      await this.renderInventoryView();
      showToast(`تم استيراد ${res.imported} منتج جزائري إلى القاموس المحلي بنجاح!`, 'success');
    }
  },

  switchProductModalTab(tabKey = 'basic') {
    ['basic', 'pricing', 'barcodes', 'variants', 'bom'].forEach((k) => {
      const btn = document.getElementById(`prodTabBtn-${k}`);
      const content = document.getElementById(`prodTabContent-${k}`);
      if (btn) {
        btn.className =
          k === tabKey
            ? 'px-3 py-1.5 rounded-xl bg-blue-600 text-white'
            : 'px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800';
      }
      if (content) content.classList.toggle('hidden', k !== tabKey);
    });
  },

  async editProductById(productId) {
    const fullProd = await window.api.getProductFull(productId);
    if (fullProd) this.openProductModal(fullProd);
  },

  openProductModal(prod = null) {
    this.switchProductModalTab('basic');
    document.getElementById('prodIdInput').value = prod && prod.id ? prod.id : '';
    document.getElementById('prodNameInput').value = prod ? prod.name || '' : '';
    document.getElementById('prodBarcodeInput').value = prod ? prod.barcode || '' : '';
    document.getElementById('prodCategoryInput').value = prod ? prod.category || 'عام' : 'عام';
    document.getElementById('prodFamilyInput').value = prod && prod.family ? prod.family : '';
    document.getElementById('prodSupplierInput').value = prod && prod.supplier ? prod.supplier : '';
    document.getElementById('prodUnitInput').value = prod ? prod.unit || 'قطعة' : 'قطعة';
    document.getElementById('prodStockInput').value = prod ? prod.stock ?? 0 : 0;
    document.getElementById('prodMinStockInput').value = prod ? prod.min_stock ?? 5 : 5;
    document.getElementById('prodExpiryInput').value = prod && prod.expiry_date ? prod.expiry_date : '';
    document.getElementById('prodLocationInput').value = prod && prod.location ? prod.location : '';
    document.getElementById('prodPluInput').value = prod && prod.plu_code ? prod.plu_code : '';
    document.getElementById('prodImageDataInput').value = prod && prod.image ? prod.image : '';
    document.getElementById('prodFeaturedCheckbox').checked = Boolean(prod && Number(prod.is_featured) === 1);

    const cost = prod ? Number(prod.cost_price ?? 0) : 0;
    const sell = prod ? Number(prod.selling_price ?? 0) : 0;
    document.getElementById('prodCostInput').value = cost;
    document.getElementById('prodPriceInput').value = sell;
    document.getElementById('prodMarkupInput').value =
      cost > 0 && sell >= cost ? Number((((sell - cost) / cost) * 100).toFixed(1)) : '';
    document.getElementById('prodWholesaleInput').value = prod && prod.wholesale_price ? prod.wholesale_price : '';
    document.getElementById('prodWholesaleUnitInput').value = prod && prod.wholesale_unit ? prod.wholesale_unit : '';
    document.getElementById('prodWholesaleQtyInput').value = prod && prod.wholesale_qty ? prod.wholesale_qty : '';

    document.getElementById('prodMaterialRoleInput').value = prod && prod.material_role ? prod.material_role : '';
    document.getElementById('prodWarrantyMonthsInput').value = prod && prod.warranty_months ? prod.warranty_months : 0;
    document.getElementById('prodTrackSerialCheckbox').checked = Boolean(prod && Number(prod.track_serial) === 1);
    document.getElementById('prodHideFromPosCheckbox').checked = Boolean(prod && Number(prod.hide_from_pos) === 1);
    document.getElementById('prodHasVariantsCheckbox').checked = Boolean(prod && Number(prod.has_variants) === 1);

    AppState.tempExtraPrices = prod && Array.isArray(prod.extra_prices) ? [...prod.extra_prices] : [];
    AppState.tempExtraBarcodes = prod && Array.isArray(prod.extra_barcodes) ? [...prod.extra_barcodes] : [];
    AppState.tempVariantsMatrix = prod && Array.isArray(prod.variants) ? [...prod.variants] : [];

    this.renderExtraPricesInModal();
    this.renderExtraBarcodesInModal();
    this.renderVariantsMatrixInModal();

    this.openModal('productModal');
  },

  onProdCostOrMarkupInput() {
    const cost = parseFloat(document.getElementById('prodCostInput')?.value) || 0;
    const markup = parseFloat(document.getElementById('prodMarkupInput')?.value);
    if (cost > 0 && Number.isFinite(markup)) {
      document.getElementById('prodPriceInput').value = Number((cost * (1 + markup / 100)).toFixed(2));
    }
  },

  onProdMarkupChange(markupVal) {
    const cost = parseFloat(document.getElementById('prodCostInput')?.value) || 0;
    const markup = parseFloat(markupVal);
    if (cost > 0 && Number.isFinite(markup)) {
      document.getElementById('prodPriceInput').value = Number((cost * (1 + markup / 100)).toFixed(2));
    }
  },

  async autoFillFromDzDictionary(barcode) {
    const clean = String(barcode || '').trim();
    if (!clean || !clean.startsWith('613') || !window.api || !window.api.lookupDzBarcode) return;
    const item = await window.api.lookupDzBarcode(clean).catch(() => null);
    if (item) {
      const nameInput = document.getElementById('prodNameInput');
      if (nameInput && !nameInput.value.trim()) nameInput.value = item.name;
      document.getElementById('prodCategoryInput').value = item.category || 'مواد غذائية';
      document.getElementById('prodSupplierInput').value = item.brand || '';
      document.getElementById('prodUnitInput').value = item.unit || 'قطعة';
      if (item.suggested_price) {
        document.getElementById('prodPriceInput').value = item.suggested_price;
      }
      showToast(`تم التعبئة التلقائية من القاموس الجزائري: ${item.name}`, 'success');
    }
  },

  generateRandomBarcode() {
    const rnd = '613' + String(Math.floor(1000000000 + Math.random() * 9000000000)).slice(0, 10);
    document.getElementById('prodBarcodeInput').value = rnd;
  },

  handleProductImageUpload(inputEl) {
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('prodImageDataInput').value = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  addExtraPriceRow() {
    AppState.tempExtraPrices.push({ label: 'نصف جملة', price: 0 });
    this.renderExtraPricesInModal();
  },

  renderExtraPricesInModal() {
    const box = document.getElementById('prodExtraPricesContainer');
    if (!box) return;
    box.innerHTML = AppState.tempExtraPrices
      .map(
        (ep, i) => `
      <div class="flex gap-2 items-center">
        <input type="text" value="${ep.label || ''}" placeholder="التسمية (نصف جملة / VIP)"
          oninput="AppState.tempExtraPrices[${i}].label = this.value" class="flex-1 px-2.5 py-1.5 rounded-lg">
        <input type="number" step="any" value="${ep.price || 0}" placeholder="السعر"
          oninput="AppState.tempExtraPrices[${i}].price = parseFloat(this.value) || 0" class="w-32 px-2.5 py-1.5 rounded-lg font-mono font-bold">
        <button onclick="AppState.tempExtraPrices.splice(${i},1); App.renderExtraPricesInModal()" class="text-rose-500">✕</button>
      </div>`
      )
      .join('');
  },

  addExtraBarcodeRow() {
    AppState.tempExtraBarcodes.push({ barcode: '', price_label: '' });
    this.renderExtraBarcodesInModal();
  },

  renderExtraBarcodesInModal() {
    const box = document.getElementById('prodExtraBarcodesContainer');
    if (!box) return;
    box.innerHTML = AppState.tempExtraBarcodes
      .map(
        (eb, i) => `
      <div class="flex gap-2 items-center">
        <input type="text" value="${eb.barcode || ''}" placeholder="الباركود الإضافي..."
          oninput="AppState.tempExtraBarcodes[${i}].barcode = this.value" class="flex-1 px-2.5 py-1.5 rounded-lg font-mono">
        <input type="text" value="${eb.price_label || ''}" placeholder="مرتبط بتسعيرة (اختياري)"
          oninput="AppState.tempExtraBarcodes[${i}].price_label = this.value" class="w-44 px-2.5 py-1.5 rounded-lg">
        <button onclick="AppState.tempExtraBarcodes.splice(${i},1); App.renderExtraBarcodesInModal()" class="text-rose-500">✕</button>
      </div>`
      )
      .join('');
  },

  applyVariantTemplate(type) {
    document.getElementById('prodHasVariantsCheckbox').checked = true;
    const baseName = document.getElementById('prodNameInput').value.trim() || 'منتج';
    const price = parseFloat(document.getElementById('prodPriceInput').value) || 0;
    const cost = parseFloat(document.getElementById('prodCostInput').value) || 0;

    if (type === 'clothing') {
      AppState.tempVariantsMatrix = ['S', 'M', 'L', 'XL', 'XXL'].map((sz) => ({
        sku: `${baseName} - ${sz}`,
        barcode: '',
        stock: 5,
        cost_price: cost,
        selling_price: price
      }));
    } else {
      AppState.tempVariantsMatrix = ['39', '40', '41', '42', '43'].map((sz) => ({
        sku: `${baseName} - مقاس ${sz}`,
        barcode: '',
        stock: 4,
        cost_price: cost,
        selling_price: price
      }));
    }
    this.renderVariantsMatrixInModal();
  },

  bulkFillVariantBarcodes() {
    const baseBc = document.getElementById('prodBarcodeInput').value.trim() || '61300099';
    AppState.tempVariantsMatrix.forEach((v, idx) => {
      if (!v.barcode) {
        v.barcode = `${baseBc}-${idx + 1}`;
      }
    });
    this.renderVariantsMatrixInModal();
    showToast('تم توليد باركودات فرعية لجميع المتغيرات تلقائياً', 'success');
  },

  bulkApplyVariantFields() {
    const bulkCost = document.getElementById('bulkVariantCost')?.value;
    const bulkPrice = document.getElementById('bulkVariantPrice')?.value;
    const bulkStock = document.getElementById('bulkVariantStock')?.value;

    AppState.tempVariantsMatrix.forEach((v) => {
      if (bulkCost !== '' && bulkCost !== undefined) v.cost_price = parseFloat(bulkCost) || 0;
      if (bulkPrice !== '' && bulkPrice !== undefined) v.selling_price = parseFloat(bulkPrice) || 0;
      if (bulkStock !== '' && bulkStock !== undefined) v.stock = parseFloat(bulkStock) || 0;
    });
    this.renderVariantsMatrixInModal();
    showToast('تم تطبيق القيم الجماعية على كافة المتغيرات', 'success');
  },

  addVariantRowInModal() {
    document.getElementById('prodHasVariantsCheckbox').checked = true;
    AppState.tempVariantsMatrix.push({
      sku: 'متغير جديد',
      barcode: '',
      stock: 5,
      cost_price: parseFloat(document.getElementById('prodCostInput').value) || 0,
      selling_price: parseFloat(document.getElementById('prodPriceInput').value) || 0
    });
    this.renderVariantsMatrixInModal();
  },

  renderVariantsMatrixInModal() {
    const box = document.getElementById('prodVariantsMatrixContainer');
    if (!box) return;
    box.innerHTML = AppState.tempVariantsMatrix
      .map(
        (v, i) => `
      <div class="grid grid-cols-6 gap-1.5 items-center">
        <input type="text" value="${v.sku || ''}" placeholder="المتغير (XL - أسود)"
          oninput="AppState.tempVariantsMatrix[${i}].sku = this.value" class="col-span-2 px-2 py-1.5 rounded-lg font-bold">
        <input type="text" value="${v.barcode || ''}" placeholder="الباركود"
          oninput="AppState.tempVariantsMatrix[${i}].barcode = this.value" class="px-2 py-1.5 rounded-lg font-mono">
        <input type="number" step="any" value="${v.selling_price ?? 0}" placeholder="سعر البيع"
          oninput="AppState.tempVariantsMatrix[${i}].selling_price = parseFloat(this.value) || 0" class="px-2 py-1.5 rounded-lg font-mono text-blue-600 font-bold">
        <input type="number" step="any" value="${v.stock ?? 0}" placeholder="الرصيد"
          oninput="AppState.tempVariantsMatrix[${i}].stock = parseFloat(this.value) || 0" class="px-2 py-1.5 rounded-lg font-mono">
        <button onclick="AppState.tempVariantsMatrix.splice(${i},1); App.renderVariantsMatrixInModal()" class="text-rose-500">حذف</button>
      </div>`
      )
      .join('');
  },

  async saveProductFromModal() {
    const id = document.getElementById('prodIdInput').value;
    const payload = {
      name: document.getElementById('prodNameInput').value.trim(),
      barcode: document.getElementById('prodBarcodeInput').value.trim() || null,
      category: document.getElementById('prodCategoryInput').value.trim() || 'عام',
      family: document.getElementById('prodFamilyInput').value.trim() || null,
      supplier: document.getElementById('prodSupplierInput').value.trim() || null,
      unit: document.getElementById('prodUnitInput').value.trim() || 'قطعة',
      cost_price: parseFloat(document.getElementById('prodCostInput').value) || 0,
      selling_price: parseFloat(document.getElementById('prodPriceInput').value) || 0,
      wholesale_price: document.getElementById('prodWholesaleInput').value || null,
      wholesale_unit: document.getElementById('prodWholesaleUnitInput').value.trim() || null,
      wholesale_qty: parseInt(document.getElementById('prodWholesaleQtyInput').value || '0', 10) || null,
      stock: parseFloat(document.getElementById('prodStockInput').value) || 0,
      min_stock: parseInt(document.getElementById('prodMinStockInput').value, 10) || 5,
      expiry_date: document.getElementById('prodExpiryInput').value || null,
      location: document.getElementById('prodLocationInput').value.trim() || null,
      plu_code: document.getElementById('prodPluInput').value.trim() || null,
      image: document.getElementById('prodImageDataInput').value || null,
      is_featured: document.getElementById('prodFeaturedCheckbox').checked ? 1 : 0,
      material_role: document.getElementById('prodMaterialRoleInput').value || null,
      warranty_months: parseInt(document.getElementById('prodWarrantyMonthsInput').value || '0', 10) || 0,
      track_serial: document.getElementById('prodTrackSerialCheckbox').checked ? 1 : 0,
      hide_from_pos: document.getElementById('prodHideFromPosCheckbox').checked ? 1 : 0,
      has_variants: document.getElementById('prodHasVariantsCheckbox').checked ? 1 : 0,
      extra_prices: AppState.tempExtraPrices,
      extra_barcodes: AppState.tempExtraBarcodes,
      variants: AppState.tempVariantsMatrix
    };

    if (!payload.name) {
      showToast('يرجى إدخال اسم المنتج', 'error');
      return;
    }

    if (id) {
      await window.api.updateProduct(Number(id), payload);
    } else {
      await window.api.addProduct(payload);
    }

    this.closeModal('productModal');
    await this.refreshProducts();
    if (AppState.currentView === 'inventory') await this.renderInventoryView();
    else this.renderPosView();
    showToast('تم حفظ بيانات المنتج بنجاح', 'success');
  },

  async openBatchesModal(productId) {
    const fullProd = await window.api.getProductFull(productId);
    if (!fullProd) return;
    document.getElementById('batchesModalProductId').value = String(productId);
    document.getElementById('batchesModalTitle').textContent = `دفعات المنتج: ${fullProd.name}`;
    document.getElementById('newBatchStock').value = '10';
    document.getElementById('newBatchCost').value = String(fullProd.cost_price || 0);
    document.getElementById('newBatchSell').value = String(fullProd.selling_price || 0);
    document.getElementById('newBatchWholesale').value = fullProd.wholesale_price ? String(fullProd.wholesale_price) : '';
    document.getElementById('newBatchExpiry').value = '';

    const batches = fullProd.batches || [];
    const body = document.getElementById('batchesModalTableBody');
    body.innerHTML = `
      <table class="w-full text-xs text-right">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
            <th class="py-2">#</th>
            <th class="py-2">الرصيد</th>
            <th class="py-2">سعر الشراء</th>
            <th class="py-2">سعر البيع</th>
            <th class="py-2">سعر الجملة</th>
            <th class="py-2">تاريخ الصلاحية</th>
            <th class="py-2">إجراء</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${batches
            .map(
              (b) => `
            <tr>
              <td class="py-2 font-mono">#${b.id}</td>
              <td class="py-2"><input id="bt-stk-${b.id}" type="number" step="any" value="${b.stock}" class="w-20 px-2 py-1 rounded font-mono font-bold"></td>
              <td class="py-2"><input id="bt-cst-${b.id}" type="number" step="any" value="${b.cost_price}" class="w-20 px-2 py-1 rounded font-mono"></td>
              <td class="py-2"><input id="bt-sel-${b.id}" type="number" step="any" value="${b.selling_price}" class="w-20 px-2 py-1 rounded font-mono font-bold text-blue-600"></td>
              <td class="py-2"><input id="bt-whl-${b.id}" type="number" step="any" value="${b.wholesale_price || ''}" class="w-20 px-2 py-1 rounded font-mono"></td>
              <td class="py-2"><input id="bt-exp-${b.id}" type="date" value="${b.expiry_date || ''}" class="px-2 py-1 rounded font-mono"></td>
              <td class="py-2 flex gap-1">
                <button onclick="App.updateBatchRowInModal(${b.id}, ${productId})" class="px-2.5 py-1 bg-blue-600 text-white rounded font-bold">حفظ</button>
                <button onclick="App.deleteBatchInModal(${b.id}, ${productId})" class="px-2 py-1 bg-rose-500/15 text-rose-500 rounded font-bold">حذف</button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
    this.openModal('batchesModal');
  },

  async submitNewBatchFromModal() {
    const productId = Number(document.getElementById('batchesModalProductId').value);
    const stock = parseFloat(document.getElementById('newBatchStock').value) || 0;
    const cost_price = parseFloat(document.getElementById('newBatchCost').value) || 0;
    const selling_price = parseFloat(document.getElementById('newBatchSell').value) || 0;
    const wholesale_price = document.getElementById('newBatchWholesale').value || null;
    const expiry_date = document.getElementById('newBatchExpiry').value || null;

    await window.api.addBatch(productId, { stock, cost_price, selling_price, wholesale_price, expiry_date });
    await this.openBatchesModal(productId);
    await this.renderInventoryView();
    showToast('تمت إضافة الدفعة الجديدة وتسوية ديون المخزون بنجاح', 'success');
  },

  async updateBatchRowInModal(batchId, productId) {
    await window.api.updateBatch(batchId, {
      stock: parseFloat(document.getElementById(`bt-stk-${batchId}`).value) || 0,
      cost_price: parseFloat(document.getElementById(`bt-cst-${batchId}`).value) || 0,
      selling_price: parseFloat(document.getElementById(`bt-sel-${batchId}`).value) || 0,
      wholesale_price: document.getElementById(`bt-whl-${batchId}`).value || null,
      expiry_date: document.getElementById(`bt-exp-${batchId}`).value || null
    });
    await this.openBatchesModal(productId);
    await this.renderInventoryView();
    showToast('تم تحديث بيانات الدفعة', 'success');
  },

  async deleteBatchInModal(batchId, productId) {
    await window.api.deleteBatch(batchId);
    await this.openBatchesModal(productId);
    await this.renderInventoryView();
  },

  async openProductAnalyticsModal(productId) {
    const st = await window.api.getProductAnalytics(productId);
    const body = document.getElementById('productAnalyticsModalBody');
    if (body && st) {
      body.innerHTML = `
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex justify-between"><span>إجمالي الكمية المباعة:</span><strong class="font-mono">${st.total_sold_qty}</strong></div>
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex justify-between"><span>إجمالي الإيرادات:</span><strong class="font-mono text-blue-600">${Number(st.total_revenue).toFixed(2)} د.ج</strong></div>
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex justify-between"><span>التكلفة الإجمالية:</span><strong class="font-mono">${Number(st.total_cost).toFixed(2)} د.ج</strong></div>
        <div class="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 flex justify-between"><span>صافي الربح المحقق:</span><strong class="font-mono font-black">${Number(st.total_profit).toFixed(2)} د.ج</strong></div>
      `;
    }
    this.openModal('productAnalyticsModal');
  },

  async openStockDebtModal() {
    const debts = (await window.api.getStockDebt().catch(() => [])) || [];
    const body = document.getElementById('stockDebtModalBody');
    if (body) {
      body.innerHTML =
        debts.length === 0
          ? `<div class="py-10 text-center text-slate-400 font-bold">لا توجد أي ديون مخزون مفتوحة حالياً</div>`
          : `<table class="w-full text-xs text-right">
              <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-2">المنتج</th><th class="py-2">الباركود</th><th class="py-2">الكمية المباعة بالسالب</th><th class="py-2">التاريخ</th></tr></thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                ${debts.map((d) => `<tr><td class="py-2 font-bold">${d.product_name}</td><td class="py-2 font-mono">${d.barcode || '-'}</td><td class="py-2 font-mono font-bold text-rose-500">${d.quantity} ${d.unit || ''}</td><td class="py-2 font-mono">${String(d.created_at || '').slice(0, 16)}</td></tr>`).join('')}
              </tbody>
            </table>`;
    }
    this.openModal('stockDebtModal');
  },

  // ==========================================================================
  // 10. الحزم الترويجية (Bundles) والعروض (Promotions)
  // ==========================================================================
  async renderBundlesAndPromosView() {
    const root = document.getElementById('bundles-view-root');
    if (!root) return;
    const [bundles, promos] = await Promise.all([
      window.api.getBundles().catch(() => []),
      window.api.getPromotions().catch(() => [])
    ]);

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">الحزم الترويجية (Packs) والعروض الخاصة</h2>
            <p class="text-xs text-slate-500">إنشاء باقات مجمعة وتخفيضات موقوتة تطبق تلقائياً في شاشة المبيعات</p>
          </div>
          <div class="flex gap-2">
            <button onclick="App.openBundleModal()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">+ إنشاء حزمة (Pack)</button>
            <button onclick="App.openPromoModal()" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">+ إضافة عرض تخفيض</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">الحزم والباقات (${bundles.length})</h3>
            <div class="space-y-2 text-xs">
              ${
                bundles.length === 0
                  ? '<div class="py-8 text-center text-slate-400">لا توجد حزم مسجلة</div>'
                  : bundles
                      .map(
                        (b) => `
                    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                      <div>
                        <div class="font-bold">${b.name}</div>
                        <div class="text-[10px] text-slate-400">المكونات: ${(b.items || []).length} أصناف</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold text-blue-600">${Number(b.selling_price || 0).toFixed(2)} د.ج</span>
                        <button onclick="window.api.deleteBundle(${b.id}).then(() => App.renderBundlesAndPromosView())" class="text-rose-500">✕</button>
                      </div>
                    </div>`
                      )
                      .join('')
              }
            </div>
          </div>

          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">العروض الترويجية النشطة (${promos.length})</h3>
            <div class="space-y-2 text-xs">
              ${
                promos.length === 0
                  ? '<div class="py-8 text-center text-slate-400">لا توجد عروض ترويجية نشطة</div>'
                  : promos
                      .map(
                        (pr) => `
                    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                      <div>
                        <div class="font-bold">${pr.product_name || 'منتج'}</div>
                        <div class="text-[10px] text-slate-400">${pr.start_date || ''} ${pr.end_date ? '-> ' + pr.end_date : ''}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-rose-500">خصم: ${pr.discount_value} ${pr.discount_type === 'percentage' ? '%' : 'د.ج'}</span>
                        <button onclick="window.api.deletePromotion(${pr.id}).then(() => App.renderBundlesAndPromosView())" class="text-rose-500">✕</button>
                      </div>
                    </div>`
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>`;
  },

  openBundleModal() {
    document.getElementById('bundleNameInput').value = '';
    document.getElementById('bundleBarcodeInput').value = '';
    document.getElementById('bundlePriceInput').value = '0';
    document.getElementById('bundleCostInput').value = '0';
    const sel = document.getElementById('bundleProductSelect');
    if (sel) {
      sel.innerHTML = AppState.products.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
    }
    this.openModal('bundleModal');
  },

  async saveBundleFromModal() {
    const name = document.getElementById('bundleNameInput').value.trim();
    if (!name) return;
    const pid = Number(document.getElementById('bundleProductSelect').value);
    const qty = parseFloat(document.getElementById('bundleProductQty').value) || 1;
    await window.api.saveBundle({
      name,
      barcode: document.getElementById('bundleBarcodeInput').value.trim() || null,
      selling_price: parseFloat(document.getElementById('bundlePriceInput').value) || 0,
      cost_price: parseFloat(document.getElementById('bundleCostInput').value) || 0,
      items: pid ? [{ product_id: pid, quantity: qty }] : []
    });
    this.closeModal('bundleModal');
    await this.renderBundlesAndPromosView();
    showToast('تم حفظ الحزمة الترويجية بنجاح', 'success');
  },

  openPromoModal() {
    const sel = document.getElementById('promoProductSelect');
    if (sel) {
      sel.innerHTML = AppState.products.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
    }
    document.getElementById('promoValueInput').value = '10';
    document.getElementById('promoStartInput').value = new Date().toISOString().slice(0, 10);
    document.getElementById('promoEndInput').value = '';
    this.openModal('promotionModal');
  },

  async savePromoFromModal() {
    const product_id = Number(document.getElementById('promoProductSelect').value);
    if (!product_id) return;
    await window.api.savePromotion({
      product_id,
      discount_type: document.getElementById('promoTypeSelect').value || 'percentage',
      discount_value: parseFloat(document.getElementById('promoValueInput').value) || 10,
      start_date: document.getElementById('promoStartInput').value || new Date().toISOString().slice(0, 10),
      end_date: document.getElementById('promoEndInput').value || null
    });
    this.closeModal('promotionModal');
    await this.renderBundlesAndPromosView();
    showToast('تم حفظ وتفعيل العرض الترويجي بنجاح', 'success');
  },

  // ==========================================================================
  // 11. إدارة الموردين، كشف حساب المورد، تفاصيل فاتورة الشراء، ومرتجعات الموردين
  // ==========================================================================
  async renderSuppliersView() {
    const root = document.getElementById('suppliers-view-root');
    if (!root) return;
    const suppliers = (await window.api.getSuppliers().catch(() => [])) || [];
    AppState.suppliers = suppliers;

    root.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">إدارة الموردين، كشف الحساب، والديون (${suppliers.length})</h2>
            <p class="text-xs text-slate-500">متابعة الحسابات، الفواتير، المرتجعات، وتسديد دفعات الموردين مع طباعة وصولات التسديد</p>
          </div>
          <div class="flex gap-2">
            <button onclick="window.api.downloadSuppliersTemplate()" class="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold">قالب Excel</button>
            <button onclick="window.api.importSuppliersFromExcel().then(() => App.renderSuppliersView())" class="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">استيراد Excel</button>
            <button onclick="window.api.exportSuppliersToExcel()" class="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">تصدير Excel</button>
            <button onclick="App.openSupplierModal()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">+ إضافة مورد</button>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">اسم المورد</th>
                <th class="py-2">الهاتف</th>
                <th class="py-2">العنوان</th>
                <th class="py-2">إجمالي المشتريات</th>
                <th class="py-2">الدين المتبقي للمورد</th>
                <th class="py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${suppliers
                .map(
                  (s) => `
                <tr>
                  <td class="py-2.5 font-bold">${s.name}</td>
                  <td class="py-2.5 font-mono">${s.phone || '-'}</td>
                  <td class="py-2.5">${s.address || '-'}</td>
                  <td class="py-2.5 font-mono">${Number(s.total_purchases || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 font-mono font-bold text-rose-500">${Number(s.total_debt || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 flex flex-wrap items-center gap-1.5">
                    <button onclick="App.openSupplierPaymentModal(${s.id}, '${s.name.replace(/'/g, '')}', ${Number(s.total_debt || 0)})" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold">تسديد دفعة</button>
                    <button onclick="App.openSupplierLedgerModal(${s.id})" class="px-2.5 py-1 bg-indigo-600/15 text-indigo-600 rounded-lg font-bold">كشف حساب</button>
                    <button onclick='App.openSupplierModal(${JSON.stringify(s).replace(/'/g, "&apos;")})' class="px-2.5 py-1 bg-blue-500/10 text-blue-600 rounded-lg font-bold">تعديل</button>
                    <button onclick="window.api.deleteSupplier(${s.id}).then(() => App.renderSuppliersView())" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  async openSupplierLedgerModal(supplierId) {
    const sup = AppState.suppliers.find((s) => Number(s.id) === Number(supplierId));
    const ledger = window.api.getSupplierLedger
      ? await window.api.getSupplierLedger(supplierId).catch(() => null)
      : { purchases: await window.api.getSupplierPurchases(supplierId).catch(() => []), payments: [], returns: [] };

    const purchases = (ledger && ledger.purchases) || [];
    const payments = (ledger && ledger.payments) || [];
    const returns = (ledger && ledger.returns) || [];

    document.getElementById('supLedgerTitle').textContent = `كشف حساب المورد: ${sup ? sup.name : '#' + supplierId}`;
    const body = document.getElementById('supplierLedgerBody');

    body.innerHTML = `
      <div class="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
        <div>فواتير الشراء: <strong class="font-mono">${purchases.length}</strong></div>
        <div>إجمالي التوريدات: <strong class="font-mono text-blue-600">${Number(sup?.total_purchases || 0).toFixed(2)} د.ج</strong></div>
        <div>الدين المتبقي للمورد: <strong class="font-mono text-rose-500">${Number(sup?.total_debt || 0).toFixed(2)} د.ج</strong></div>
      </div>

      <h4 class="font-black text-xs mt-2">1. فواتير الشراء (${purchases.length})</h4>
      <table class="w-full text-xs text-right">
        <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">رقم الفاتورة</th><th class="py-1.5">التاريخ</th><th class="py-1.5">الإجمالي</th><th class="py-1.5">المدفوع</th><th class="py-1.5">الباقي</th><th class="py-1.5">إجراء</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${purchases
            .map((p) => {
              const rem = Math.max(0, Number(p.total || 0) - Number(p.paid_amount || 0));
              return `<tr><td class="py-1.5 font-mono font-bold">${p.invoice_number || '#' + p.id}</td><td class="py-1.5 font-mono">${p.date || ''}</td><td class="py-1.5 font-mono">${Number(p.total || 0).toFixed(2)}</td><td class="py-1.5 font-mono text-emerald-600">${Number(p.paid_amount || 0).toFixed(2)}</td><td class="py-1.5 font-mono text-rose-500 font-bold">${rem.toFixed(2)}</td><td class="py-1.5"><button onclick="App.closeModal('supplierLedgerModal'); App.openPurchaseDetailsModal(${p.id})" class="px-2 py-0.5 bg-blue-600 text-white rounded font-bold">تفاصيل</button></td></tr>`;
            })
            .join('')}
        </tbody>
      </table>

      <h4 class="font-black text-xs mt-3">2. سجل الدفعات المسددة للمورد (${payments.length})</h4>
      <table class="w-full text-xs text-right">
        <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">رقم الوصل</th><th class="py-1.5">التاريخ</th><th class="py-1.5">المبلغ</th><th class="py-1.5">الطريقة</th><th class="py-1.5">طباعة</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${payments
            .map(
              (pay) =>
                `<tr><td class="py-1.5 font-mono">${pay.receipt_number || '#' + pay.id}</td><td class="py-1.5 font-mono">${String(pay.date || '').slice(0, 10)}</td><td class="py-1.5 font-mono font-bold text-emerald-600">${Number(pay.amount || 0).toFixed(2)} د.ج</td><td class="py-1.5">${pay.payment_method || 'cash'}</td><td class="py-1.5"><button onclick="App.reprintPaymentReceipt(${pay.id}, 'purchase')" class="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold">وصل التسديد</button></td></tr>`
            )
            .join('')}
        </tbody>
      </table>

      ${
        returns.length > 0
          ? `<h4 class="font-black text-xs mt-3">3. مرتجعات المورد (${returns.length})</h4>
             <div class="space-y-1">${returns.map((r) => `<div class="p-2 rounded bg-rose-500/10 flex justify-between"><span>${r.return_number} (${r.date}) — ${r.reason || ''}</span><strong class="font-mono text-rose-500">${Number(r.total || 0).toFixed(2)} د.ج</strong></div>`).join('')}</div>`
          : ''
      }
    `;
    this.openModal('supplierLedgerModal');
  },

  async reprintPaymentReceipt(paymentId, type = 'sale') {
    const details = await window.api.getPaymentDetails(paymentId, type);
    if (details && window.PrintEngine) {
      const html = await window.PrintEngine.renderPaymentReceiptHtml(details, AppState.settings, AppState.lang);
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  },

  openSupplierModal(sup = null) {
    document.getElementById('supIdInput').value = sup ? sup.id : '';
    document.getElementById('supNameInput').value = sup ? sup.name || '' : '';
    document.getElementById('supPhoneInput').value = sup ? sup.phone || '' : '';
    document.getElementById('supInitDebtInput').value = sup ? sup.initial_debt || 0 : 0;
    document.getElementById('supAddressInput').value = sup ? sup.address || '' : '';
    document.getElementById('supRcInput').value = sup ? sup.rc || '' : '';
    document.getElementById('supNifInput').value = sup ? sup.nif || '' : '';
    document.getElementById('supAiInput').value = sup ? sup.ai || '' : '';
    document.getElementById('supNisInput').value = sup ? sup.nis || '' : '';
    this.openModal('supplierModal');
  },

  async saveSupplierFromModal() {
    const id = document.getElementById('supIdInput').value;
    const payload = {
      name: document.getElementById('supNameInput').value.trim(),
      phone: document.getElementById('supPhoneInput').value.trim() || null,
      initial_debt: parseFloat(document.getElementById('supInitDebtInput').value) || 0,
      address: document.getElementById('supAddressInput').value.trim() || null,
      rc: document.getElementById('supRcInput').value.trim() || null,
      nif: document.getElementById('supNifInput').value.trim() || null,
      ai: document.getElementById('supAiInput').value.trim() || null,
      nis: document.getElementById('supNisInput').value.trim() || null
    };
    if (!payload.name) return;

    if (id) await window.api.updateSupplier(Number(id), payload);
    else await window.api.addSupplier(payload);

    this.closeModal('supplierModal');
    await this.renderSuppliersView();
    showToast('تم حفظ بيانات المورد بنجاح', 'success');
  },

  openSupplierPaymentModal(supplierId, name, currentDebt = 0) {
    document.getElementById('supPaySupplierId').value = String(supplierId);
    document.getElementById('supPayModalTitle').textContent = `تسديد دفعة للمورد: ${name}`;
    document.getElementById('supPayAmountInput').value = currentDebt > 0 ? currentDebt.toFixed(2) : '1000';
    document.getElementById('supPayNotesInput').value = '';
    this.openModal('supplierPaymentModal');
  },

  async submitSupplierPaymentModal(printReceipt = true) {
    const supplierId = Number(document.getElementById('supPaySupplierId').value);
    const amt = parseFloat(document.getElementById('supPayAmountInput').value) || 0;
    const method = document.getElementById('supPayMethodSelect').value || 'cash';
    const notes = document.getElementById('supPayNotesInput').value.trim();
    if (!supplierId || amt <= 0) return;

    const res = await window.api.addSupplierPayment(supplierId, amt, new Date().toISOString(), {
      payment_method: method,
      notes
    });
    this.closeModal('supplierPaymentModal');
    await this.renderSuppliersView();
    showToast('تم تسجيل دفعة المورد بنجاح', 'success');

    if (printReceipt && res && res.paymentId && window.PrintEngine) {
      const details = await window.api.getPaymentDetails(res.paymentId, 'purchase');
      if (details) {
        const html = await window.PrintEngine.renderPaymentReceiptHtml(details, AppState.settings, AppState.lang);
        await window.PrintEngine.printHtmlDocument(html, { silent: false });
      }
    }
  },

  async renderPurchasesView() {
    const root = document.getElementById('purchases-view-root');
    if (!root) return;
    const [purchases, returnsList] = await Promise.all([
      window.api.getPurchases().catch(() => []),
      window.api.getSupplierReturns().catch(() => [])
    ]);

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">فواتير المشتريات والتموين ومرتجعات الموردين</h2>
            <p class="text-xs text-slate-500">إدخال فواتير الشراء مع توزيع مصاريف النقل، متابعة دفعات الفاتورة، وطباعة وصولات الاستلام (Bon de Réception)</p>
          </div>
          <div class="flex gap-2">
            <button onclick="App.openSupplierReturnModal()" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">مرتجع للمورد</button>
            <button onclick="App.openPurchaseInvoiceModal()" class="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow">+ فاتورة شراء جديدة</button>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <h3 class="font-black text-sm mb-3">فواتير الشراء (${purchases.length})</h3>
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">رقم الفاتورة</th>
                <th class="py-2">المورد</th>
                <th class="py-2">التاريخ</th>
                <th class="py-2">مصاريف إضافية</th>
                <th class="py-2">الإجمالي</th>
                <th class="py-2">المدفوع</th>
                <th class="py-2">الباقي</th>
                <th class="py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${purchases
                .map((p) => {
                  const rem = Math.max(0, Number(p.total || 0) - Number(p.paid_amount || 0));
                  return `
                <tr>
                  <td class="py-2.5 font-mono font-bold text-blue-600">${p.invoice_number || '#' + p.id}</td>
                  <td class="py-2.5 font-bold">${p.supplier_name || 'مورد عام'}</td>
                  <td class="py-2.5 font-mono">${p.date || ''}</td>
                  <td class="py-2.5 font-mono">${Number(p.additional_costs || 0).toFixed(2)}</td>
                  <td class="py-2.5 font-mono font-bold">${Number(p.total || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 font-mono text-emerald-600">${Number(p.paid_amount || 0).toFixed(2)}</td>
                  <td class="py-2.5 font-mono ${rem > 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}">${rem.toFixed(2)}</td>
                  <td class="py-2.5 flex items-center gap-1.5">
                    <button onclick="App.editPurchaseInvoice(${p.id})" class="px-2.5 py-1 bg-amber-500/15 text-amber-600 rounded-lg font-bold">تعديل</button>
                    <button onclick="App.openPurchaseDetailsModal(${p.id})" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg font-bold">تفاصيل / دفعات</button>
                    <button onclick="App.printReceptionNote(${p.id})" class="px-2.5 py-1 bg-emerald-600/15 text-emerald-600 rounded-lg font-bold">وصل استلام BR</button>
                    <button onclick="window.api.deletePurchase(${p.id}).then(() => App.renderPurchasesView())" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                  </td>
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <h3 class="font-black text-sm mb-3">مرتجعات الموردين (${returnsList.length})</h3>
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">رقم المرتجع</th>
                <th class="py-2">المورد</th>
                <th class="py-2">التاريخ</th>
                <th class="py-2">القيمة</th>
                <th class="py-2">السبب</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${returnsList
                .map(
                  (r) => `
                <tr>
                  <td class="py-2 font-mono font-bold text-rose-500">${r.return_number || '#' + r.id}</td>
                  <td class="py-2 font-bold">${r.supplier_name || 'مورد'}</td>
                  <td class="py-2 font-mono">${r.date || ''}</td>
                  <td class="py-2 font-mono font-bold">${Number(r.total || 0).toFixed(2)} د.ج</td>
                  <td class="py-2 text-slate-500">${r.reason || '-'}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  async openPurchaseDetailsModal(invoiceId) {
    const inv = await window.api.getInvoiceDetails(invoiceId);
    if (!inv) return;
    document.getElementById('purchaseDetailsModalTitle').textContent = `تفاصيل فاتورة الشراء (${inv.invoice_number || '#' + inv.id})`;
    const body = document.getElementById('purchaseDetailsModalBody');
    const rem = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));

    body.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
        <div>المورد: <strong>${inv.supplier_name || 'مورد'}</strong></div>
        <div>التاريخ: <strong class="font-mono">${inv.date || ''}</strong></div>
        <div>الإجمالي: <strong class="font-mono text-blue-600">${Number(inv.total || 0).toFixed(2)} د.ج</strong></div>
        <div>المدفوع: <strong class="font-mono text-emerald-600">${Number(inv.paid_amount || 0).toFixed(2)} د.ج</strong></div>
      </div>

      ${
        rem > 0.01
          ? `<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <span>متبقي غير مسدد للمورد: <strong class="font-mono text-rose-500">${rem.toFixed(2)} د.ج</strong></span>
              <div class="flex gap-1.5">
                <input id="purchDetailQuickPayInput" type="number" step="any" value="${rem.toFixed(2)}" class="w-28 px-2 py-1 rounded-lg font-mono font-bold text-center">
                <button onclick="App.addQuickPaymentToPurchase(${inv.id})" class="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold">تسديد دفعة</button>
              </div>
            </div>`
          : ''
      }

      <table class="w-full text-xs text-right">
        <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">المنتج</th><th class="py-1.5">الكمية</th><th class="py-1.5">تكلفة الوحدة</th><th class="py-1.5">سعر البيع</th><th class="py-1.5">إجمالي التكلفة</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${(inv.items || [])
            .map(
              (it) =>
                `<tr><td class="py-1.5 font-bold">${it.product_name}</td><td class="py-1.5 font-mono">${it.quantity}</td><td class="py-1.5 font-mono">${Number(it.cost_price || 0).toFixed(2)}</td><td class="py-1.5 font-mono text-blue-600">${Number(it.selling_price || 0).toFixed(2)}</td><td class="py-1.5 font-mono font-bold">${Number(it.total_cost || 0).toFixed(2)} د.ج</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="App.printReceptionNote(${inv.id})" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">طباعة وصل استلام (BR)</button>
      </div>
    `;
    this.openModal('purchaseDetailsModal');
  },

  async addQuickPaymentToPurchase(invoiceId) {
    const amt = parseFloat(document.getElementById('purchDetailQuickPayInput')?.value) || 0;
    if (amt <= 0) return;
    await window.api.addInvoicePayment(invoiceId, amt, new Date().toISOString(), { payment_method: 'cash' });
    await this.openPurchaseDetailsModal(invoiceId);
    await this.renderPurchasesView();
    showToast('تم تسجيل الدفعة على فاتورة الشراء بنجاح', 'success');
  },

  openPurchaseInvoiceModal() {
    AppState.tempPurchaseItems = [];
    const supSel = document.getElementById('purchSupplierSelect');
    if (supSel) {
      supSel.innerHTML = AppState.suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    }
    const prodSel = document.getElementById('purchItemProductSelect');
    if (prodSel) {
      prodSel.innerHTML = AppState.products
        .map((p) => `<option value="${p.id}" data-cost="${p.cost_price}" data-sell="${p.selling_price}">${p.name}</option>`)
        .join('');
      prodSel.onchange = () => {
        const opt = prodSel.options[prodSel.selectedIndex];
        if (opt) {
          document.getElementById('purchItemCost').value = opt.getAttribute('data-cost') || '0';
          document.getElementById('purchItemSell').value = opt.getAttribute('data-sell') || '0';
        }
      };
      if (prodSel.options.length > 0) prodSel.onchange();
    }
    document.getElementById('purchNumberInput').value = `ACH-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    document.getElementById('purchDateInput').value = new Date().toISOString().slice(0, 10);
    document.getElementById('purchExtraCostInput').value = '0';
    document.getElementById('purchPaidInput').value = '0';
    this.recalcPurchaseModal();
    this.openModal('purchaseInvoiceModal');
  },

  addPurchaseItemRow() {
    const prodSel = document.getElementById('purchItemProductSelect');
    const pid = Number(prodSel.value);
    const prod = AppState.products.find((p) => Number(p.id) === pid);
    if (!prod) return;

    const qty = parseFloat(document.getElementById('purchItemQty').value) || 1;
    const cost_price = parseFloat(document.getElementById('purchItemCost').value) || 0;
    const selling_price = parseFloat(document.getElementById('purchItemSell').value) || 0;

    AppState.tempPurchaseItems.push({
      product_id: pid,
      name: prod.name,
      quantity: qty,
      cost_price,
      selling_price,
      subtotal: Number((qty * cost_price).toFixed(2))
    });
    this.recalcPurchaseModal();
  },

  recalcPurchaseModal() {
    const itemsBox = document.getElementById('purchItemsTableBody');
    const subtotal = AppState.tempPurchaseItems.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const extra = parseFloat(document.getElementById('purchExtraCostInput').value) || 0;
    const total = Number((subtotal + extra).toFixed(2));

    document.getElementById('purchTotalText').textContent = `${total.toFixed(2)} د.ج`;
    document.getElementById('purchPaidInput').value = total.toFixed(2);

    if (itemsBox) {
      itemsBox.innerHTML = AppState.tempPurchaseItems
        .map(
          (it, i) => `
        <div class="flex items-center justify-between p-2 border-b border-slate-100 dark:border-slate-700">
          <span class="font-bold flex-1">${it.name}</span>
          <span class="font-mono w-24">${it.quantity} × ${it.cost_price}</span>
          <span class="font-mono font-bold w-24 text-blue-600">${it.subtotal.toFixed(2)} د.ج</span>
          <button onclick="AppState.tempPurchaseItems.splice(${i},1); App.recalcPurchaseModal()" class="text-rose-500">✕</button>
        </div>`
        )
        .join('');
    }
    return { subtotal, extra, total };
  },

  async submitPurchaseInvoice() {
    if (AppState.tempPurchaseItems.length === 0) {
      showToast('يرجى إدراج صنف واحد على الأقل في فاتورة الشراء', 'warning');
      return;
    }
    const { subtotal, extra, total } = this.recalcPurchaseModal();
    const supplier_id = Number(document.getElementById('purchSupplierSelect').value) || null;
    const invoice_number = document.getElementById('purchNumberInput').value.trim();
    const date = document.getElementById('purchDateInput').value;
    const paid_amount = parseFloat(document.getElementById('purchPaidInput').value) || 0;

    await window.api.savePurchase({
      supplier_id,
      invoice_number,
      date,
      subtotal,
      additional_costs: extra,
      total,
      paid_amount,
      items: AppState.tempPurchaseItems
    });

    this.closeModal('purchaseInvoiceModal');
    await this.refreshProducts();
    await this.renderPurchasesView();
    showToast('تم حفظ فاتورة الشراء وتغذية المخزون بنجاح', 'success');
  },

  async printReceptionNote(invoiceId) {
    const inv = await window.api.getInvoiceDetails(invoiceId);
    if (!inv || !window.PrintEngine) return;
    const html = await window.PrintEngine.renderReceptionNoteHtml(inv, AppState.settings, AppState.lang);
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  openSupplierReturnModal() {
    const supSel = document.getElementById('supRetSupplierSelect');
    if (supSel) {
      supSel.innerHTML = AppState.suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    }
    const prodSel = document.getElementById('supRetProductSelect');
    if (prodSel) {
      prodSel.innerHTML = AppState.products
        .map((p) => `<option value="${p.id}" data-cost="${p.cost_price}" data-batch="${p.batches?.[0]?.id || ''}">${p.name} (الرصيد: ${p.stock})</option>`)
        .join('');
      prodSel.onchange = () => {
        const opt = prodSel.options[prodSel.selectedIndex];
        if (opt) document.getElementById('supRetCostInput').value = opt.getAttribute('data-cost') || '0';
      };
      if (prodSel.options.length > 0) prodSel.onchange();
    }
    this.openModal('supplierReturnModal');
  },

  async submitSupplierReturnFromModal() {
    const supplier_id = Number(document.getElementById('supRetSupplierSelect').value);
    const prodSel = document.getElementById('supRetProductSelect');
    const product_id = Number(prodSel.value);
    const opt = prodSel.options[prodSel.selectedIndex];
    const batch_id = opt && opt.getAttribute('data-batch') ? Number(opt.getAttribute('data-batch')) : null;
    const quantity = parseFloat(document.getElementById('supRetQtyInput').value) || 1;
    const cost_price = parseFloat(document.getElementById('supRetCostInput').value) || 0;
    const reason = document.getElementById('supRetReasonInput').value.trim();

    const total = Number((quantity * cost_price).toFixed(2));
    await window.api.saveSupplierReturn({
      supplier_id,
      total,
      credit_applied: total,
      reason,
      items: [{ product_id, batch_id, quantity, cost_price }]
    });

    this.closeModal('supplierReturnModal');
    await this.refreshProducts();
    await this.renderPurchasesView();
    showToast('تم تسجيل مرتجع المورد وخصم الكمية من المخزون', 'success');
  },

  // ==========================================================================
  // 12. الزبائن، كشف الحساب، الفاتورة المجمعة، وعقود التقسيط الرسمية — [الشطر الثالث والأخير 3/3]
  // ==========================================================================
  async renderCustomersView() {
    const root = document.getElementById('customers-view-root');
    if (!root) return;
    const [customers, installments] = await Promise.all([
      window.api.getCustomers().catch(() => []),
      window.api.getInstallmentPlans({}).catch(() => [])
    ]);
    AppState.customers = customers;

    const activePlansCount = installments.filter((p) => p.status === 'active').length;

    root.innerHTML = `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">إدارة الزبائن، الديون، نقاط الولاء، وعقود التقسيط (${customers.length})</h2>
            <p class="text-xs text-slate-500">كشف حساب تفصيلي، توزيع التسديدات بـ FIFO، الفواتير المجمعة، وطباعة عقود البيع بالتقسيط الرسمية</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="App.openInstallmentsManagerModal()" class="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow">
              <span class="material-symbols-rounded icon-sm">calendar_month</span>
              <span>عقود التقسيط (${activePlansCount})</span>
            </button>
            <button onclick="window.api.downloadCustomersTemplate()" class="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold">قالب Excel</button>
            <button onclick="window.api.importCustomersFromExcel().then(() => App.renderCustomersView())" class="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">استيراد Excel</button>
            <button onclick="window.api.exportCustomersToExcel()" class="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">تصدير Excel</button>
            <button onclick="App.openCustomerModal()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow">+ زبون جديد</button>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2.5 px-2">الزبون</th>
                <th class="py-2.5 px-2">الهاتف</th>
                <th class="py-2.5 px-2">التسعيرة</th>
                <th class="py-2.5 px-2">نقاط الولاء</th>
                <th class="py-2.5 px-2">سقف الدين</th>
                <th class="py-2.5 px-2">إجمالي المشتريات</th>
                <th class="py-2.5 px-2">الدين الحالي</th>
                <th class="py-2.5 px-2">إجراءات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${customers
                .map(
                  (c) => `
                <tr>
                  <td class="py-2.5 px-2 font-bold">${c.name}</td>
                  <td class="py-2.5 px-2 font-mono">${c.phone || '-'}</td>
                  <td class="py-2.5 px-2">${c.price_tier === 'wholesale' ? '<span class="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 font-bold">جملة</span>' : 'تجزئة'}</td>
                  <td class="py-2.5 px-2 font-mono text-amber-500 font-bold">⭐ ${c.loyalty_points || 0}</td>
                  <td class="py-2.5 px-2 font-mono">${Number(c.credit_limit || 0) > 0 ? Number(c.credit_limit).toFixed(0) : 'مفتوح'}</td>
                  <td class="py-2.5 px-2 font-mono">${Number(c.total_sales || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 px-2 font-mono font-black ${Number(c.total_debt || 0) > 0 ? 'text-rose-500' : 'text-emerald-600'}">${Number(c.total_debt || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 px-2 flex flex-wrap items-center gap-1">
                    <button onclick="App.openCustomerPaymentModal(${c.id}, '${c.name.replace(/'/g, '')}', ${Number(c.total_debt || 0)})" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold">تسديد دين</button>
                    <button onclick="App.openCustomerLedgerModal(${c.id})" class="px-2.5 py-1 bg-blue-600/10 text-blue-600 rounded-lg font-bold">كشف حساب</button>
                    <button onclick="App.printCustomerRecapInvoice(${c.id})" class="px-2.5 py-1 bg-indigo-600/10 text-indigo-600 rounded-lg font-bold">فاتورة مجمعة</button>
                    <button onclick="App.sendWhatsAppReminder('${c.phone || ''}', '${c.name.replace(/'/g, '')}', ${Number(c.total_debt || 0)})" class="px-2 py-1 bg-green-600/15 text-green-600 rounded-lg font-bold">WhatsApp</button>
                    <button onclick='App.openCustomerModal(${JSON.stringify(c).replace(/'/g, "&apos;")})' class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg font-bold">تعديل</button>
                    <button onclick="window.api.deleteCustomer(${c.id}).then(() => App.renderCustomersView())" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  openCustomerModal(cust = null) {
    document.getElementById('custIdInput').value = cust ? cust.id : '';
    document.getElementById('custNameInput').value = cust ? cust.name || '' : '';
    document.getElementById('custPhoneInput').value = cust ? cust.phone || '' : '';
    document.getElementById('custPriceTierInput').value = cust && cust.price_tier ? cust.price_tier : 'retail';
    document.getElementById('custInitDebtInput').value = cust ? cust.initial_debt || 0 : 0;
    document.getElementById('custCreditLimitInput').value = cust ? cust.credit_limit || 0 : 0;
    document.getElementById('custAddressInput').value = cust ? cust.address || '' : '';
    document.getElementById('custRcInput').value = cust ? cust.rc || '' : '';
    document.getElementById('custNifInput').value = cust ? cust.nif || '' : '';
    document.getElementById('custAiInput').value = cust ? cust.ai || '' : '';
    document.getElementById('custNisInput').value = cust ? cust.nis || '' : '';
    this.openModal('customerModal');
  },

  async saveCustomerFromModal() {
    const id = document.getElementById('custIdInput').value;
    const payload = {
      name: document.getElementById('custNameInput').value.trim(),
      phone: document.getElementById('custPhoneInput').value.trim() || null,
      price_tier: document.getElementById('custPriceTierInput').value || 'retail',
      initial_debt: parseFloat(document.getElementById('custInitDebtInput').value) || 0,
      credit_limit: parseFloat(document.getElementById('custCreditLimitInput').value) || 0,
      address: document.getElementById('custAddressInput').value.trim() || null,
      rc: document.getElementById('custRcInput').value.trim() || null,
      nif: document.getElementById('custNifInput').value.trim() || null,
      ai: document.getElementById('custAiInput').value.trim() || null,
      nis: document.getElementById('custNisInput').value.trim() || null
    };
    if (!payload.name) {
      showToast('يرجى إدخال اسم الزبون', 'error');
      return;
    }

    if (id) await window.api.updateCustomer(Number(id), payload);
    else await window.api.addCustomer(payload);

    this.closeModal('customerModal');
    await this.refreshProducts();
    if (AppState.currentView === 'customers') await this.renderCustomersView();
    else this.renderPosView();
    showToast('تم حفظ ملف الزبون بنجاح', 'success');
  },

  openCustomerPaymentModal(customerId, name, currentDebt = 0) {
    document.getElementById('custPayCustomerId').value = String(customerId);
    document.getElementById('custPayModalTitle').textContent = `تسديد دين الزبون: ${name}`;
    document.getElementById('custPayAmountInput').value = currentDebt > 0 ? currentDebt.toFixed(2) : '1000';
    document.getElementById('custPayNotesInput').value = '';
    this.openModal('customerPaymentModal');
  },

  async submitCustomerPaymentModal(printReceipt = true) {
    const customerId = Number(document.getElementById('custPayCustomerId').value);
    const amt = parseFloat(document.getElementById('custPayAmountInput').value) || 0;
    const method = document.getElementById('custPayMethodSelect').value || 'cash';
    const notes = document.getElementById('custPayNotesInput').value.trim();
    if (!customerId || amt <= 0) return;

    const res = await window.api.addCustomerPayment(customerId, amt, new Date().toISOString(), {
      payment_method: method,
      notes,
      userId: AppState.currentUser ? AppState.currentUser.id : 1
    });
    this.closeModal('customerPaymentModal');
    await this.renderCustomersView();
    showToast('تم تسجيل الدفعة وتوزيعها على فواتير الزبون بـ FIFO بنجاح', 'success');

    if (printReceipt && res && res.paymentId && window.PrintEngine) {
      const details = await window.api.getPaymentDetails(res.paymentId, 'sale');
      if (details) {
        const html = await window.PrintEngine.renderPaymentReceiptHtml(details, AppState.settings, AppState.lang);
        await window.PrintEngine.printHtmlDocument(html, { silent: false });
      }
    }
  },

  async openCustomerLedgerModal(customerId) {
    const cust = AppState.customers.find((c) => Number(c.id) === Number(customerId));
    const sales = (await window.api.getCustomerSales(customerId).catch(() => [])) || [];
    document.getElementById('custLedgerTitle').textContent = `كشف حساب الزبون: ${cust ? cust.name : '#' + customerId}`;
    const body = document.getElementById('customerLedgerBody');

    body.innerHTML = `
      <div class="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
        <div>إجمالي الفواتير: <strong class="font-mono">${sales.length}</strong></div>
        <div>إجمالي المسحوبات: <strong class="font-mono text-blue-600">${Number(cust?.total_sales || 0).toFixed(2)} د.ج</strong></div>
        <div>الدين المتبقي: <strong class="font-mono text-rose-500">${Number(cust?.total_debt || 0).toFixed(2)} د.ج</strong></div>
      </div>
      <table class="w-full text-xs text-right">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
            <th class="py-2">رقم الفاتورة</th>
            <th class="py-2">التاريخ</th>
            <th class="py-2">الإجمالي</th>
            <th class="py-2">المدفوع</th>
            <th class="py-2">الباقي</th>
            <th class="py-2">إجراءات</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${sales
            .map((s) => {
              const rem = Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0));
              return `
              <tr>
                <td class="py-2 font-mono font-bold">${s.doc_number || '#' + s.id}</td>
                <td class="py-2 font-mono">${String(s.sale_date || '').slice(0, 16)}</td>
                <td class="py-2 font-mono font-bold">${Number(s.total || 0).toFixed(2)}</td>
                <td class="py-2 font-mono text-emerald-600">${Number(s.paid_amount || 0).toFixed(2)}</td>
                <td class="py-2 font-mono text-rose-500 font-bold">${rem.toFixed(2)}</td>
                <td class="py-2 flex gap-1">
                  <button onclick="App.reprintSale(${s.id}, 'a4')" class="px-2 py-0.5 bg-blue-600 text-white rounded font-bold">طباعة</button>
                  <button onclick="App.closeModal('customerLedgerModal'); App.loadSaleIntoPosForEdit(${s.id})" class="px-2 py-0.5 bg-amber-500 text-white rounded font-bold">تعديل</button>
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
    this.openModal('customerLedgerModal');
  },

  async printCustomerRecapInvoice(customerId) {
    const cust = AppState.customers.find((c) => Number(c.id) === Number(customerId));
    const agg = await window.api.getCustomerSalesAggregated({ customerId });
    if (!agg || !window.PrintEngine) return;
    const html = await window.PrintEngine.renderRecapInvoiceHtml(
      { ...agg, customer: cust },
      AppState.settings,
      AppState.lang
    );
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  sendWhatsAppReminder(phone, name, debt) {
    if (!phone) {
      showToast('لا يوجد رقم هاتف مسجل لهذا الزبون', 'warning');
      return;
    }
    const cleanPhone = String(phone).replace(/^0/, '213').replace(/\D/g, '');
    const text = encodeURIComponent(
      `مرحباً سيد ${name}، نذكركم بأن رصيدكم المستحق لدى ${AppState.settings.shop_name || 'Gherbi.Ai POS'} هو ${Number(debt || 0).toFixed(2)} د.ج. شكراً لتعاملكم معنا.`
    );
    window.api.openExternalLink(`https://wa.me/${cleanPhone}?text=${text}`);
  },

  async openInstallmentsManagerModal() {
    const plans = (await window.api.getInstallmentPlans({}).catch(() => [])) || [];
    AppState._cachedInstallmentPlans = plans;
    const body = document.getElementById('installmentPlanModalBody');
    if (body) {
      body.innerHTML =
        plans.length === 0
          ? `<div class="py-10 text-center text-slate-400 font-bold">لا توجد عقود بيع بالتقسيط مسجلة حالياً. يمكنك إنشاء عقد تقسيط مباشرة من نافذة تسديد الفاتورة (F1).</div>`
          : plans
              .map(
                (p, pIdx) => `
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-3 space-y-2">
                <div class="flex flex-wrap justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div>
                    <span class="font-black text-sm">${p.customer_name || 'زبون'}</span>
                    <span class="text-slate-400 font-mono mr-2">(${p.customer_phone || ''})</span>
                  </div>
                  <div class="flex items-center gap-3 font-mono text-xs">
                    <span>الإجمالي: <strong>${Number(p.total_amount).toFixed(2)}</strong></span>
                    <span class="text-rose-500">المتبقي: <strong>${Number(p.remaining_amount).toFixed(2)} د.ج</strong></span>
                    <button onclick="App.printInstallmentContract(${pIdx})" class="px-3 py-1 bg-blue-600 text-white rounded-lg font-sans font-bold">🖨️ طباعة العقد الرسمي (A4)</button>
                  </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                  ${(p.schedules || [])
                    .map(
                      (s) => `
                    <div class="p-2 rounded-xl border ${s.status === 'paid' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}">
                      <div class="flex justify-between font-bold"><span>قسط #${s.installment_num}</span><span class="font-mono">${s.due_date}</span></div>
                      <div class="font-mono font-black text-blue-600 my-1">${Number(s.amount).toFixed(2)} د.ج</div>
                      ${
                        s.status === 'paid'
                          ? '<span class="text-emerald-600 font-bold text-[11px]">✓ مسدد بالكامل</span>'
                          : `<div class="flex gap-1 mt-1">
                              <button onclick="App.payInstallmentRow(${s.id}, ${Number(s.amount - s.paid_amount)})" class="flex-1 py-1 bg-emerald-600 text-white rounded font-bold text-[10px]">تسديد القسط</button>
                              <button onclick="App.sendWhatsAppReminder('${p.customer_phone || ''}', '${(p.customer_name || '').replace(/'/g, '')}', ${Number(s.amount - s.paid_amount)})" class="px-2 py-1 bg-green-600/20 text-green-600 rounded font-bold text-[10px]">WA</button>
                            </div>`
                      }
                    </div>`
                    )
                    .join('')}
                </div>
              </div>`
              )
              .join('');
    }
    this.openModal('installmentPlanModal');
  },

  async printInstallmentContract(planIndex) {
    const plan = AppState._cachedInstallmentPlans && AppState._cachedInstallmentPlans[planIndex];
    if (!plan || !window.PrintEngine || !window.PrintEngine.renderInstallmentContractHtml) return;
    const html = window.PrintEngine.renderInstallmentContractHtml(plan, AppState.settings);
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  async payInstallmentRow(scheduleId, dueAmt) {
    await window.api.payInstallmentSchedule(scheduleId, dueAmt);
    await this.openInstallmentsManagerModal();
    await this.refreshHeaderNotifications();
    showToast('تم تسديد القسط الشهري بنجاح', 'success');
  },

  // ==========================================================================
  // 13. الفواتير الشكلية (Proformas) وطلبيات الزبائن (Customer Orders)
  // ==========================================================================
  async renderProformasView() {
    const root = document.getElementById('proformas-view-root');
    if (!root) return;
    const list = (await window.api.getProformas().catch(() => [])) || [];

    root.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-black">الفواتير الشكلية / المبدئية (Factures Proforma) (${list.length})</h2>
            <p class="text-xs text-slate-500">عروض الأسعار الرسمية، فحص توفر المخزون الفوري، والتحويل بضغطة واحدة إلى فاتورة بيع</p>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">رقم المستند</th>
                <th class="py-2">التاريخ</th>
                <th class="py-2">الزبون</th>
                <th class="py-2">الإجمالي</th>
                <th class="py-2">الحالة</th>
                <th class="py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${list
                .map(
                  (pf) => `
                <tr>
                  <td class="py-2.5 font-mono font-bold text-indigo-600">${pf.doc_number}</td>
                  <td class="py-2.5 font-mono">${String(pf.created_at || '').slice(0, 10)}</td>
                  <td class="py-2.5 font-bold">${pf.customer_name || 'زبون عابر'}</td>
                  <td class="py-2.5 font-mono font-black">${Number(pf.total || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 font-bold">${pf.status === 'converted' ? '<span class="text-emerald-600">محولة لفاتورة</span>' : pf.status === 'cancelled' ? '<span class="text-rose-500">ملغاة</span>' : 'معلقة'}</td>
                  <td class="py-2.5 flex items-center gap-1.5">
                    <button onclick="App.loadProformaIntoPos(${pf.id})" class="px-2.5 py-1 bg-blue-600/15 text-blue-600 rounded-lg font-bold">للسلة</button>
                    <button onclick="App.printProformaById(${pf.id})" class="px-2.5 py-1 bg-indigo-600/15 text-indigo-600 rounded-lg font-bold">طباعة</button>
                    <button onclick="App.openProformaStockCheck(${pf.id})" class="px-2.5 py-1 bg-amber-500/15 text-amber-600 rounded-lg font-bold">فحص المخزون</button>
                    ${
                      pf.status === 'pending'
                        ? `<button onclick="App.convertProformaNow(${pf.id})" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold">تحويل لمبيعة</button>`
                        : ''
                    }
                    <button onclick="window.api.deleteProforma(${pf.id}).then(() => App.renderProformasView())" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  async printProformaById(proformaId) {
    const fullPf = await window.api.getProformaDetails(proformaId);
    if (!fullPf || !window.PrintEngine) return;
    const html = await window.PrintEngine.renderProformaHtml(fullPf, AppState.settings, AppState.lang);
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  async openProformaStockCheck(proformaId) {
    const res = await window.api.checkProformaStock(proformaId);
    if (res && res.ok) {
      showToast('جميع أصناف الفاتورة الشكلية متوفرة بالكامل في المخزون!', 'success');
    } else if (res && Array.isArray(res.shortages)) {
      const msg = res.shortages.map((s) => `${s.product_name}: مطلوب ${s.requested} | متوفر ${s.available}`).join(' ، ');
      showToast(`نقص مخزني في: ${msg}`, 'warning');
    }
  },

  async convertProformaNow(proformaId) {
    const res = await window.api.convertProformaToSale(proformaId, { payment_method: 'cash' });
    await this.renderProformasView();
    showToast(`تم تحويل الفاتورة الشكلية إلى فاتورة بيع (${res.docNumber})`, 'success');
  },

  async renderOrdersView() {
    const root = document.getElementById('orders-view-root');
    if (!root) return;
    const orders = (await window.api.getOrders().catch(() => [])) || [];

    root.innerHTML = `
      <div class="space-y-4">
        <h2 class="text-2xl font-black">طلبيات الزبائن (Bons de Commande) (${orders.length})</h2>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">رقم الطلبية</th>
                <th class="py-2">الزبون</th>
                <th class="py-2">تاريخ التسليم</th>
                <th class="py-2">الإجمالي</th>
                <th class="py-2">العربون المدفوع</th>
                <th class="py-2">الحالة</th>
                <th class="py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${orders
                .map(
                  (o) => `
                <tr>
                  <td class="py-2.5 font-mono font-bold text-teal-600">${o.doc_number}</td>
                  <td class="py-2.5 font-bold">${o.customer_name || 'زبون'}</td>
                  <td class="py-2.5 font-mono">${o.expected_delivery_date || '-'}</td>
                  <td class="py-2.5 font-mono font-black">${Number(o.total || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 font-mono text-emerald-600 font-bold">${Number(o.deposit_amount || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 font-bold">${o.status === 'delivered' ? '<span class="text-emerald-600">مسلّمة</span>' : 'قيد التجهيز'}</td>
                  <td class="py-2.5 flex items-center gap-1.5">
                    <button onclick="App.loadOrderIntoPos(${o.id})" class="px-2.5 py-1 bg-blue-600/15 text-blue-600 rounded-lg font-bold">للسلة</button>
                    <button onclick="App.printOrderById(${o.id})" class="px-2.5 py-1 bg-teal-600/15 text-teal-600 rounded-lg font-bold">طباعة BC</button>
                    ${
                      o.status === 'pending'
                        ? `<button onclick="App.convertOrderToSaleNow(${o.id})" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold">تسليم وتحويل لمبيعة</button>`
                        : ''
                    }
                    <button onclick="window.api.deleteOrder(${o.id}).then(() => App.renderOrdersView())" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  async printOrderById(orderId) {
    const fullOrd = await window.api.getOrderDetails(orderId);
    if (!fullOrd || !window.PrintEngine) return;
    const html = await window.PrintEngine.renderOrderReceiptHtml(fullOrd, AppState.settings, AppState.lang);
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  async convertOrderToSaleNow(orderId) {
    const fullOrd = await window.api.getOrderDetails(orderId);
    if (!fullOrd) return;
    const saleRes = await window.api.processSale({
      customer_id: fullOrd.customer_id,
      subtotal: fullOrd.subtotal,
      discount: fullOrd.discount,
      tax_percentage: fullOrd.tax_percentage,
      total: fullOrd.total,
      paid_amount: fullOrd.total,
      payment_method: 'cash',
      items: fullOrd.items || []
    });
    await window.api.markOrderDelivered(orderId, saleRes.saleId);
    await this.renderOrdersView();
    showToast(`تم تسليم الطلبية وتحويلها إلى فاتورة بيع (${saleRes.docNumber})`, 'success');
  },

  // ==========================================================================
  // 14. المصاريف التشغيلية وإيداعات رأس المال
  // ==========================================================================
  async renderExpensesAndCapitalView() {
    const root = document.getElementById('expenses-view-root');
    if (!root) return;
    const [expenses, capital] = await Promise.all([
      window.api.getExpenses().catch(() => []),
      window.api.getCapital().catch(() => [])
    ]);

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-black">المصاريف التشغيلية وحركات رأس المال</h2>
            <p class="text-xs text-slate-500">توثيق مصاريف المتجر وإيداعات/مسحوبات الشركاء</p>
          </div>
          <div class="flex gap-2">
            <button onclick="App.openExpenseModal()" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">+ تسجيل مصروف</button>
            <button onclick="App.openCapitalModal()" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">+ حركة رأس مال</button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 class="font-black text-sm mb-3">سجل المصاريف (${expenses.length})</h3>
            <div class="space-y-2 text-xs max-h-96 overflow-y-auto">
              ${expenses
                .map(
                  (e) => `
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  <div><div class="font-bold">${e.category}</div><div class="text-[10px] text-slate-400">${e.date} — ${e.description || ''}</div></div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-rose-500">${Number(e.amount).toFixed(2)} د.ج</span>
                    <button onclick="window.api.deleteExpense(${e.id}).then(() => App.renderExpensesAndCapitalView())" class="text-rose-500">✕</button>
                  </div>
                </div>`
                )
                .join('')}
            </div>
          </div>
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 class="font-black text-sm mb-3">حركات رأس المال (${capital.length})</h3>
            <div class="space-y-2 text-xs max-h-96 overflow-y-auto">
              ${capital
                .map(
                  (c) => `
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  <div><div class="font-bold">${c.category}</div><div class="text-[10px] text-slate-400">${c.date} — ${c.description || ''}</div></div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-emerald-600">${Number(c.amount).toFixed(2)} د.ج</span>
                    <button onclick="window.api.deleteCapital(${c.id}).then(() => App.renderExpensesAndCapitalView())" class="text-rose-500">✕</button>
                  </div>
                </div>`
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>`;
  },

  openExpenseModal() {
    document.getElementById('expAmountInput').value = '0';
    document.getElementById('expDescInput').value = '';
    document.getElementById('expDeductCaisseCheckbox').checked = true;
    this.openModal('expenseModal');
  },

  async confirmSaveExpense() {
    const amt = parseFloat(document.getElementById('expAmountInput').value) || 0;
    if (amt <= 0) return;
    await window.api.addExpense({
      category: document.getElementById('expCategoryInput').value || 'عام',
      amount: amt,
      description: document.getElementById('expDescInput').value.trim(),
      deductFromCaisse: document.getElementById('expDeductCaisseCheckbox').checked,
      user_id: AppState.currentUser ? AppState.currentUser.id : 1
    });
    this.closeModal('expenseModal');
    await this.renderExpensesAndCapitalView();
    showToast('تم حفظ المصروف التشغيلي بنجاح', 'success');
  },

  openCapitalModal() {
    document.getElementById('capAmountInput').value = '0';
    document.getElementById('capDescInput').value = '';
    this.openModal('capitalModal');
  },

  async confirmSaveCapital() {
    const amt = parseFloat(document.getElementById('capAmountInput').value) || 0;
    if (amt <= 0) return;
    await window.api.addCapital({
      category: document.getElementById('capCategoryInput').value || 'إيداع رأس مال',
      amount: amt,
      description: document.getElementById('capDescInput').value.trim()
    });
    this.closeModal('capitalModal');
    await this.renderExpensesAndCapitalView();
    showToast('تم تسجيل حركة رأس المال بنجاح', 'success');
  },

  // ==========================================================================
  // 15. مركز الطباعة وطابور الملصقات بالجملة (Batch Label Print Queue & Sheet Preview)
  // ==========================================================================
  enqueueProductForLabelPrint(productId, copies = 1) {
    const prod = AppState.products.find((p) => Number(p.id) === Number(productId));
    if (!prod) return;
    const ex = AppState.labelPrintQueue.find((q) => Number(q.id) === Number(prod.id));
    if (ex) {
      ex.copies = Number(ex.copies || 1) + Number(copies || 1);
    } else {
      AppState.labelPrintQueue.push({
        id: prod.id,
        name: prod.name,
        barcode: prod.barcode || `613000${prod.id}`,
        price: prod.selling_price || 0,
        stock: Math.max(1, Math.round(Number(prod.stock || 1))),
        plu: prod.plu_code || '',
        copies: Math.max(1, Number(copies || 1))
      });
    }
    showToast(`تمت إضافة "${prod.name}" إلى طابور طباعة الملصقات`, 'success');
  },

  async renderPrintStudioView() {
    const root = document.getElementById('print-view-root');
    if (!root) return;
    const cfg = AppState.labelStudioConfig;
    if (!cfg.selectedId && AppState.products.length > 0) {
      cfg.selectedId = AppState.products[0].id;
    }

    const totalQueuedLabels = AppState.labelPrintQueue.reduce((s, q) => s + Number(q.copies || 1), 0);

    root.innerHTML = `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">مركز الطباعة، طابور ملصقات الباركود بالجملة، ومصمم القوالب</h2>
            <p class="text-xs text-slate-500">طباعة ملصق مفرد أو طابور ملصقات كامل حسب كمية المخزون، ملصقات الأسعار للرفوف، وتخصيص الفواتير</p>
          </div>
          <div class="flex gap-2 text-xs font-bold">
            <button onclick="App.switchPrintStudioTab('labels')" class="px-4 py-2 rounded-xl ${AppState.printStudioTab === 'labels' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}">1. استوديو وطابور الملصقات</button>
            <button onclick="App.switchPrintStudioTab('designer')" class="px-4 py-2 rounded-xl ${AppState.printStudioTab === 'designer' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}">2. مصمم قوالب الفواتير المرئي</button>
            <button onclick="App.printFullCatalogue()" class="px-4 py-2 rounded-xl bg-emerald-600 text-white">3. طباعة قائمة الأسعار (Catalogue)</button>
          </div>
        </div>

        ${
          AppState.printStudioTab === 'designer'
            ? `<div id="template-designer-root"></div>`
            : `
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <!-- إعدادات الملصق وطابور الطباعة بالجملة -->
              <div class="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 text-xs">
                <h3 class="font-black text-sm">إعدادات الملصق (باركود / سعر رفوف / بطاقة زبون)</h3>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block font-bold mb-1">مصدر البيانات</label>
                    <select onchange="App.updateLabelStudioProp('source', this.value)" class="w-full px-2.5 py-2 rounded-xl font-bold">
                      <option value="products" ${cfg.source === 'products' ? 'selected' : ''}>المنتجات</option>
                      <option value="customers" ${cfg.source === 'customers' ? 'selected' : ''}>بطاقات الزبائن</option>
                    </select>
                  </div>
                  <div>
                    <label class="block font-bold mb-1">وضع الملصق</label>
                    <select onchange="App.updateLabelStudioProp('priceOnlyMode', this.value === 'price')" class="w-full px-2.5 py-2 rounded-xl font-bold">
                      <option value="barcode" ${!cfg.priceOnlyMode ? 'selected' : ''}>باركود قياسي</option>
                      <option value="price" ${cfg.priceOnlyMode ? 'selected' : ''}>سعر كبير للرفوف</option>
                    </select>
                  </div>
                  <div>
                    <label class="block font-bold mb-1">أعمدة الورقة</label>
                    <select onchange="App.updateLabelStudioProp('columns', Number(this.value))" class="w-full px-2.5 py-2 rounded-xl font-mono font-bold">
                      <option value="1" ${cfg.columns === 1 ? 'selected' : ''}>عمود 1 (رول حراري)</option>
                      <option value="2" ${cfg.columns === 2 ? 'selected' : ''}>عمودان (2)</option>
                      <option value="3" ${cfg.columns === 3 ? 'selected' : ''}>3 أعمدة (A4)</option>
                      <option value="4" ${cfg.columns === 4 ? 'selected' : ''}>4 أعمدة (A4)</option>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div class="col-span-2">
                    <label class="block font-bold mb-1">العنصر المختار</label>
                    <select id="studioItemSelect" onchange="App.updateLabelStudioProp('selectedId', Number(this.value))" class="w-full px-2.5 py-2 rounded-xl font-bold">
                      ${(cfg.source === 'customers' ? AppState.customers : AppState.products)
                        .map((item) => `<option value="${item.id}" ${Number(cfg.selectedId) === Number(item.id) ? 'selected' : ''}>${item.name} ${item.barcode ? '(' + item.barcode + ')' : ''}</option>`)
                        .join('')}
                    </select>
                  </div>
                  <div class="flex items-end">
                    <button onclick="App.addSelectedStudioItemToQueue()" class="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold">+ أضف للطابور</button>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div><label class="block font-bold mb-1">العرض (mm)</label><input type="number" value="${cfg.widthMm}" oninput="App.updateLabelStudioProp('widthMm', Number(this.value))" class="w-full px-2.5 py-1.5 rounded-xl font-mono font-bold"></div>
                  <div><label class="block font-bold mb-1">الارتفاع (mm)</label><input type="number" value="${cfg.heightMm}" oninput="App.updateLabelStudioProp('heightMm', Number(this.value))" class="w-full px-2.5 py-1.5 rounded-xl font-mono font-bold"></div>
                  <div><label class="block font-bold mb-1">ارتفاع الباركود (mm)</label><input type="number" value="${cfg.barcodeHeightMm}" oninput="App.updateLabelStudioProp('barcodeHeightMm', Number(this.value))" class="w-full px-2.5 py-1.5 rounded-xl font-mono font-bold"></div>
                </div>

                <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.showShop ? 'checked' : ''} onchange="App.updateLabelStudioProp('showShop', this.checked)"><span>اسم المتجر</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.showName ? 'checked' : ''} onchange="App.updateLabelStudioProp('showName', this.checked)"><span>اسم المنتج</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.showPrice ? 'checked' : ''} onchange="App.updateLabelStudioProp('showPrice', this.checked)"><span>السعر</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.showBarcodeText ? 'checked' : ''} onchange="App.updateLabelStudioProp('showBarcodeText', this.checked)"><span>رقم الباركود</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.showPlu ? 'checked' : ''} onchange="App.updateLabelStudioProp('showPlu', this.checked)"><span>كود PLU</span></label>
                </div>

                <!-- قسم طابور طباعة الملصقات بالجملة (Print Queue) -->
                <div class="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <div class="flex flex-wrap items-center justify-between gap-1">
                    <span class="font-black text-indigo-600">طابور الطباعة بالجملة (${AppState.labelPrintQueue.length} صنف | ${totalQueuedLabels} ملصق)</span>
                    <div class="flex gap-1">
                      <button onclick="App.addAllProductsToLabelQueue()" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold text-[10px]">+ كل المخزون</button>
                      <button onclick="App.applyPlQtyFromStock()" class="px-2 py-1 bg-emerald-600/15 text-emerald-600 rounded-lg font-bold text-[10px]">العدد = رصيد المخزون</button>
                      <button onclick="App.clearLabelPrintQueue()" class="px-2 py-1 bg-rose-500/15 text-rose-500 rounded-lg font-bold text-[10px]">تفريغ</button>
                    </div>
                  </div>
                  <div class="max-h-36 overflow-y-auto space-y-1">
                    ${
                      AppState.labelPrintQueue.length === 0
                        ? '<div class="py-4 text-center text-slate-400">الطابور فارغ — أضف منتجات لطباعتها دفعة واحدة</div>'
                        : AppState.labelPrintQueue
                            .map(
                              (q, i) => `
                          <div class="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                            <span class="font-bold truncate flex-1">${q.name}</span>
                            <div class="flex items-center gap-1.5">
                              <span class="text-[10px] text-slate-400">النسخ:</span>
                              <input type="number" min="1" value="${q.copies}" onchange="AppState.labelPrintQueue[${i}].copies = Math.max(1, parseInt(this.value,10)||1); App.renderPrintStudioView()" class="w-16 px-1.5 py-0.5 rounded font-mono font-bold text-center">
                              <button onclick="AppState.labelPrintQueue.splice(${i},1); App.renderPrintStudioView()" class="text-rose-500">✕</button>
                            </div>
                          </div>`
                            )
                            .join('')
                    }
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button onclick="App.printCurrentStudioLabel()" class="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black flex items-center justify-center gap-1.5 shadow">
                    <span class="material-symbols-rounded icon-sm">print</span>
                    <span>طباعة الملصق المفرد</span>
                  </button>
                  <button onclick="App.openPlSheetPreviewModal()" class="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black flex items-center justify-center gap-1.5 shadow">
                    <span class="material-symbols-rounded icon-sm">layers</span>
                    <span>معاينة وطباعة الطابور (${totalQueuedLabels})</span>
                  </button>
                </div>
              </div>

              <!-- معاينة الملصق الحية -->
              <div class="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center">
                <div class="text-xs font-bold text-slate-400 mb-4">معاينة حية ومطابقة للطباعة (${cfg.widthMm}mm × ${cfg.heightMm}mm)</div>
                <iframe id="labelStudioPreviewFrame" class="border-2 border-dashed border-slate-300 rounded-xl bg-white shadow-inner" style="width:${Math.max(220, cfg.widthMm * 4.5)}px;height:${Math.max(140, cfg.heightMm * 4.5)}px;"></iframe>
              </div>
            </div>`
        }
      </div>`;

    if (AppState.printStudioTab === 'designer' && window.TemplateBuilder) {
      await window.TemplateBuilder.initTemplateBuilder('template-designer-root');
    } else {
      await this.refreshLabelStudioPreview();
    }
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  addSelectedStudioItemToQueue() {
    const id = Number(document.getElementById('studioItemSelect')?.value || AppState.labelStudioConfig.selectedId);
    if (id) {
      this.enqueueProductForLabelPrint(id, 1);
      this.renderPrintStudioView();
    }
  },

  addAllProductsToLabelQueue() {
    for (const p of AppState.products.slice(0, 100)) {
      if (!AppState.labelPrintQueue.some((q) => Number(q.id) === Number(p.id))) {
        AppState.labelPrintQueue.push({
          id: p.id,
          name: p.name,
          barcode: p.barcode || `613000${p.id}`,
          price: p.selling_price || 0,
          stock: Math.max(1, Math.round(Number(p.stock || 1))),
          plu: p.plu_code || '',
          copies: 1
        });
      }
    }
    this.renderPrintStudioView();
    showToast('تمت إضافة المنتجات إلى طابور الطباعة', 'success');
  },

  applyPlQtyFromStock() {
    AppState.labelPrintQueue.forEach((q) => {
      q.copies = Math.max(1, Number(q.stock || 1));
    });
    this.renderPrintStudioView();
    showToast('تم ضبط عدد الملصقات مساوياً لرصيد المخزون لكل منتج!', 'success');
  },

  clearLabelPrintQueue() {
    AppState.labelPrintQueue = [];
    this.renderPrintStudioView();
  },

  async openPlSheetPreviewModal() {
    if (AppState.labelPrintQueue.length === 0) {
      this.addSelectedStudioItemToQueue();
    }
    const html = await window.PrintEngine.renderBatchBarcodeLabelsHtml(
      AppState.labelPrintQueue,
      AppState.settings,
      AppState.labelStudioConfig
    );
    this.openModal('plSheetPreviewModal');
    const frame = document.getElementById('plSheetPreviewFrame');
    if (frame) {
      const doc = frame.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }
  },

  async printAllQueuedLabelsNow() {
    const html = await window.PrintEngine.renderBatchBarcodeLabelsHtml(
      AppState.labelPrintQueue,
      AppState.settings,
      AppState.labelStudioConfig
    );
    this.closeModal('plSheetPreviewModal');
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  async exportQueuedLabelsPdf() {
    const html = await window.PrintEngine.renderBatchBarcodeLabelsHtml(
      AppState.labelPrintQueue,
      AppState.settings,
      AppState.labelStudioConfig
    );
    if (window.api && window.api.exportPDF) {
      await window.api.exportPDF({ html, filename: `Gherbi_Labels_${Date.now()}.pdf` });
    }
  },

  async switchPrintStudioTab(tab) {
    AppState.printStudioTab = tab;
    await this.renderPrintStudioView();
  },

  async updateLabelStudioProp(key, val) {
    AppState.labelStudioConfig[key] = val;
    if (key === 'source' || key === 'widthMm' || key === 'heightMm') {
      await this.renderPrintStudioView();
    } else {
      await this.refreshLabelStudioPreview();
    }
  },

  async buildCurrentLabelHtml() {
    const cfg = AppState.labelStudioConfig;
    if (cfg.source === 'customers') {
      const cust =
        AppState.customers.find((c) => Number(c.id) === Number(cfg.selectedId)) ||
        AppState.customers[0] ||
        { id: 1, name: 'زبون', phone: '0550000000', total_debt: 0 };
      return await window.PrintEngine.renderBarcodeLabelHtml(
        {
          ...cfg,
          name: cust.name,
          barcode: `CUST-${cust.id}`,
          custPhone: cust.phone || '',
          custDebt: `الرصيد: ${Number(cust.total_debt || 0).toFixed(2)} د.ج`,
          custDate: new Date().toISOString().slice(0, 10),
          showPrice: false
        },
        AppState.settings
      );
    }

    const prod =
      AppState.products.find((p) => Number(p.id) === Number(cfg.selectedId)) ||
      AppState.products[0] ||
      { name: 'منتج نموذجي', barcode: '6130001000012', selling_price: 650 };
    return await window.PrintEngine.renderBarcodeLabelHtml(
      {
        ...cfg,
        name: prod.name,
        barcode: prod.barcode || '6130001000012',
        price: prod.selling_price,
        plu: prod.plu_code || ''
      },
      AppState.settings
    );
  },

  async refreshLabelStudioPreview() {
    const frame = document.getElementById('labelStudioPreviewFrame');
    if (!frame || !window.PrintEngine) return;
    const html = await this.buildCurrentLabelHtml();
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  },

  async printCurrentStudioLabel() {
    const html = await this.buildCurrentLabelHtml();
    if (html && window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  },

  async printFullCatalogue() {
    if (!window.PrintEngine) return;
    const html = await window.PrintEngine.renderPriceListHtml(AppState.products, AppState.settings, 'جميع المنتجات');
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  // ==========================================================================
  // 16. مركز الإحصائيات والتقارير بالتبويبات الـ 8 الكاملة + Chart.js + حاسبة الزكاة
  // ==========================================================================
  async renderAnalyticsView() {
    const root = document.getElementById('analytics-view-root');
    if (!root) return;

    const data =
      (await window.api
        .getAnalytics({
          dateFrom: AppState.analyticsDateFrom,
          dateTo: AppState.analyticsDateTo
        })
        .catch(() => ({}))) || {};
    AppState.analyticsData = data;

    const tab = AppState.analyticsTab || 'summary';
    const goldPrice = Number(AppState.settings.zakat_gold_price_per_gram || 14500);
    const nisabDzd = goldPrice * 85;
    const zakatPool = Number(data.zakat?.pool || 0);
    const zakatDue = Number(data.zakat?.amount || 0);

    root.innerHTML = `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">مركز القيادة، التحليلات المالية، وحاسبة الزكاة (8 تبويبات)</h2>
            <p class="text-xs text-slate-500">تحليل الإيرادات، تكلفة البضاعة المباعة (COGS)، تحليلات الشرائح، أعمار الديون، والزكاة الشرعية</p>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <input id="anDateFrom" type="date" value="${AppState.analyticsDateFrom}" class="px-2.5 py-1.5 rounded-xl font-mono">
            <input id="anDateTo" type="date" value="${AppState.analyticsDateTo}" class="px-2.5 py-1.5 rounded-xl font-mono">
            <button onclick="App.applyAnalyticsDateRange()" class="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl font-bold">تطبيق الفترة</button>
            <button onclick="App.setAnalyticsQuickRange(0)" class="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold">اليوم</button>
            <button onclick="App.setAnalyticsQuickRange(30)" class="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold">30 يوماً</button>
            <button onclick="App.openAlgerianFiscalModal()" class="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold">🇩🇿 تصريح État 104 & G50</button>
            <button onclick="App.printAnalyticsSalesSummary()" class="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl font-bold">🖨️ طباعة ملخص المبيعات</button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2 text-xs font-bold">
          ${[
            { id: 'summary', label: '1. الملخص المالي' },
            { id: 'segment', label: '2. إحصائيات الشرائح المتقدمة' },
            { id: 'debts', label: '3. الديون وأعمارها' },
            { id: 'inventory', label: '4. تقييم المخزون' },
            { id: 'expenses', label: '5. تحليل المصاريف' },
            { id: 'caisse', label: '6. التدفق النقدي' },
            { id: 'charts', label: '7. الرسوم البيانية (Chart.js)' },
            { id: 'zakat', label: '8. حاسبة الزكاة الشرعية' }
          ]
            .map(
              (t) =>
                `<button onclick="App.switchAnalyticsTab('${t.id}')" class="px-3 py-1.5 rounded-xl ${
                  tab === t.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }">${t.label}</button>`
            )
            .join('')}
        </div>

        <div id="analyticsTabBody"></div>
      </div>`;

    const body = document.getElementById('analyticsTabBody');
    if (!body) return;

    if (tab === 'summary') {
      body.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">صافي المبيعات (${data.total_sales_count || 0} فاتورة)</div>
            <div class="text-2xl font-black font-mono text-blue-600 mt-1">${Number(data.net_revenue || 0).toFixed(2)} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">تكلفة البضاعة المباعة (COGS)</div>
            <div class="text-2xl font-black font-mono text-amber-500 mt-1">${Number(data.cogs || 0).toFixed(2)} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">مجمل الربح</div>
            <div class="text-2xl font-black font-mono text-indigo-600 mt-1">${Number(data.gross_profit || 0).toFixed(2)} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-emerald-600 text-white shadow-lg">
            <div class="text-xs opacity-85 font-bold">صافي الربح النهائي (بعد المصاريف)</div>
            <div class="text-2xl font-black font-mono mt-1">${Number(data.net_profit || 0).toFixed(2)} د.ج</div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">أفضل المنتجات ربحية ومبيعاً</h3>
            <div class="space-y-2 text-xs">
              ${(data.topProducts || [])
                .slice(0, 10)
                .map(
                  (tp) =>
                    `<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900"><span class="font-bold">${tp.name} (${tp.qty_sold})</span><span class="font-mono font-bold text-emerald-600">ربح: ${Number(tp.profit || 0).toFixed(2)} د.ج</span></div>`
                )
                .join('')}
            </div>
          </div>
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">أفضل الزبائن مساهمة في الإيرادات</h3>
            <div class="space-y-2 text-xs">
              ${(data.topCustomers || [])
                .slice(0, 10)
                .map(
                  (tc) =>
                    `<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900"><span class="font-bold">${tc.name} (${tc.purchase_count} فاتورة)</span><span class="font-mono font-bold text-blue-600">${Number(tc.total_revenue || 0).toFixed(2)} د.ج</span></div>`
                )
                .join('')}
            </div>
          </div>
        </div>`;
    } else if (tab === 'segment') {
      const seg = (await window.api.getSegmentAnalytics({ scopeType: 'all' }).catch(() => ({}))) || {};
      body.innerHTML = `
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="font-black text-sm">تحليلات الشرائح والفئات المتقدمة (Segment Analytics)</h3>
            <select onchange="App.loadSegmentByCategory(this.value)" class="px-3 py-2 rounded-xl text-xs font-bold">
              <option value="">جميع الفئات</option>
              ${AppState.categories.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div id="segmentAnalyticsResultBox" class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>صافي الكمية المباعة</div><div class="text-xl font-black font-mono mt-1">${Number(seg.summary?.net_qty || 0)}</div></div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>صافي إيراد الشريحة</div><div class="text-xl font-black font-mono text-blue-600 mt-1">${Number(seg.summary?.net_revenue || 0).toFixed(2)} د.ج</div></div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>صافي ربح الشريحة</div><div class="text-xl font-black font-mono text-emerald-600 mt-1">${Number(seg.summary?.profit || 0).toFixed(2)} د.ج</div></div>
          </div>
        </div>`;
    } else if (tab === 'debts') {
      const ag = data.debtAging || {};
      body.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">ديون حديثة (0 - 30 يوماً)</div><div class="text-xl font-black font-mono text-emerald-600 mt-1">${Number(ag.bucket_0_30 || 0).toFixed(2)} د.ج</div></div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">ديون متوسطة (31 - 60 يوماً)</div><div class="text-xl font-black font-mono text-blue-600 mt-1">${Number(ag.bucket_31_60 || 0).toFixed(2)} د.ج</div></div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">ديون متأخرة (61 - 90 يوماً)</div><div class="text-xl font-black font-mono text-amber-500 mt-1">${Number(ag.bucket_61_90 || 0).toFixed(2)} د.ج</div></div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">ديون حرجة (+90 يوماً)</div><div class="text-xl font-black font-mono text-rose-600 mt-1">${Number(ag.bucket_90_plus || 0).toFixed(2)} د.ج</div></div>
        </div>`;
    } else if (tab === 'inventory') {
      body.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">قيمة المخزون بسعر التكلفة</div><div class="text-2xl font-black font-mono mt-1">${Number(data.inventory?.cost_value || 0).toFixed(2)} د.ج</div></div>
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">قيمة المخزون بسعر البيع</div><div class="text-2xl font-black font-mono text-blue-600 mt-1">${Number(data.inventory?.sell_value || 0).toFixed(2)} د.ج</div></div>
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">الربح الكامن المتوقع من المخزون</div><div class="text-2xl font-black font-mono text-emerald-600 mt-1">${Number(data.inventory?.expected_profit || 0).toFixed(2)} د.ج</div></div>
        </div>`;
    } else if (tab === 'expenses') {
      body.innerHTML = `
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3">
          <h3 class="font-black text-sm">توزيع المصاريف حسب الفئة (الإجمالي: ${Number(data.totalExpenses || 0).toFixed(2)} د.ج)</h3>
          <div class="space-y-2 text-xs">
            ${(data.expensesByCategory || [])
              .map(
                (e) =>
                  `<div class="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900"><span class="font-bold">${e.category}</span><span class="font-mono font-bold text-rose-500">${Number(e.total || 0).toFixed(2)} د.ج</span></div>`
              )
              .join('')}
          </div>
        </div>`;
    } else if (tab === 'caisse') {
      body.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">إجمالي النقد الداخل (Cash In)</div><div class="text-2xl font-black font-mono text-emerald-600 mt-1">${Number(data.cash_in || 0).toFixed(2)} د.ج</div></div>
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-400 font-bold">إجمالي النقد الخارج (Cash Out)</div><div class="text-2xl font-black font-mono text-rose-500 mt-1">${Number(data.cash_out || 0).toFixed(2)} د.ج</div></div>
          <div class="p-5 rounded-2xl bg-blue-600 text-white"><div class="text-xs opacity-80 font-bold">صافي التدفق النقدي (Net Cash Flow)</div><div class="text-2xl font-black font-mono mt-1">${Number(data.net_cash_flow || 0).toFixed(2)} د.ج</div></div>
        </div>`;
    } else if (tab === 'charts') {
      body.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 class="font-black text-xs mb-2">منحنى المبيعات اليومية</h3>
            <canvas id="dailySalesChartCanvas" height="200"></canvas>
          </div>
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 class="font-black text-xs mb-2">توزيع المبيعات حسب ساعات الذروة</h3>
            <canvas id="hourlySalesChartCanvas" height="200"></canvas>
          </div>
        </div>`;
      setTimeout(() => this.drawAnalyticsCharts(data), 60);
    } else if (tab === 'zakat') {
      body.innerHTML = `
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <h3 class="text-lg font-black text-emerald-600">حاسبة الزكاة الشرعية لعروض التجارة (2.5%)</h3>
              <p class="text-xs text-slate-400">وعاء الزكاة = (السيولة النقدية + تقييم المخزون بسعر التكلفة + ديون الزبائن المرجوة) - ديون الموردين</p>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <label class="font-bold">سعر غرام الذهب (عيار 24 د.ج):</label>
              <input id="zakatGoldInput" type="number" value="${goldPrice}" onchange="App.updateZakatGoldPrice(this.value)" class="w-28 px-2.5 py-1.5 rounded-xl font-mono font-bold text-center">
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>النصاب الشرعي (85غ ذهب)</div><div class="text-lg font-black font-mono mt-1">${nisabDzd.toLocaleString()} د.ج</div></div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>قيمة المخزون + النقد + ديون الزبائن</div><div class="text-lg font-black font-mono text-blue-600 mt-1">${(Number(data.inventory?.cost_value || 0) + Math.max(0, Number(data.net_cash_flow || 0)) + Number(data.totalCustomerDebt || 0)).toFixed(2)} د.ج</div></div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>وعاء الزكاة الصافي</div><div class="text-lg font-black font-mono text-indigo-600 mt-1">${zakatPool.toFixed(2)} د.ج</div></div>
            <div class="p-4 rounded-xl bg-emerald-900 text-white"><div>مقدار الزكاة الواجب إخراجه (2.5%)</div><div class="text-2xl font-black font-mono mt-1">${zakatDue.toFixed(2)} د.ج</div></div>
          </div>
        </div>`;
    }
  },

  async switchAnalyticsTab(tabId) {
    AppState.analyticsTab = tabId;
    await this.renderAnalyticsView();
  },

  async applyAnalyticsDateRange() {
    AppState.analyticsDateFrom = document.getElementById('anDateFrom')?.value || '';
    AppState.analyticsDateTo = document.getElementById('anDateTo')?.value || '';
    await this.renderAnalyticsView();
  },

  async setAnalyticsQuickRange(daysBack = 0) {
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    AppState.analyticsDateFrom = from;
    AppState.analyticsDateTo = today;
    await this.renderAnalyticsView();
  },

  async loadSegmentByCategory(category) {
    const seg = await window.api.getSegmentAnalytics({
      scopeType: category ? 'category' : 'all',
      category
    });
    const box = document.getElementById('segmentAnalyticsResultBox');
    if (box && seg && seg.summary) {
      box.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>صافي الكمية المباعة</div><div class="text-xl font-black font-mono mt-1">${Number(seg.summary.net_qty || 0)}</div></div>
        <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>صافي إيراد الشريحة</div><div class="text-xl font-black font-mono text-blue-600 mt-1">${Number(seg.summary.net_revenue || 0).toFixed(2)} د.ج</div></div>
        <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900"><div>صافي ربح الشريحة</div><div class="text-xl font-black font-mono text-emerald-600 mt-1">${Number(seg.summary.profit || 0).toFixed(2)} د.ج</div></div>
      `;
    }
  },

  drawAnalyticsCharts(data = {}) {
    if (typeof window.Chart !== 'function') return;
    const dailyCanvas = document.getElementById('dailySalesChartCanvas');
    const hourlyCanvas = document.getElementById('hourlySalesChartCanvas');

    if (dailyCanvas) {
      const trend = data.dailySalesTrend || [];
      new window.Chart(dailyCanvas, {
        type: 'line',
        data: {
          labels: trend.map((x) => x.date),
          datasets: [{ label: 'المبيعات اليومية (د.ج)', data: trend.map((x) => x.revenue), borderColor: '#2563eb', tension: 0.3 }]
        }
      });
    }

    if (hourlyCanvas) {
      const hrs = data.hourlySales || [];
      new window.Chart(hourlyCanvas, {
        type: 'bar',
        data: {
          labels: hrs.map((x) => `${x.hour}:00`),
          datasets: [{ label: 'المبيعات حسب الساعة (د.ج)', data: hrs.map((x) => x.revenue), backgroundColor: '#10b981' }]
        }
      });
    }
  },

  async updateZakatGoldPrice(val) {
    AppState.settings.zakat_gold_price_per_gram = String(val || '14500');
    await window.api.updateSettings({ zakat_gold_price_per_gram: AppState.settings.zakat_gold_price_per_gram });
    await this.renderAnalyticsView();
  },

  // ==========================================================================
  // 17. المساعد الذكي (Copilot)، المستخدمون، سجل الرقابة، والإعدادات ذات الـ 7 تبويبات
  // ==========================================================================
  async renderCopilotView() {
    const root = document.getElementById('copilot-view-root');
    if (!root) return;
    const insights = (await window.api.getAiCopilotInsights().catch(() => ({}))) || {};
    const reorders = insights.reorderSuggestions || [];
    const dead = insights.deadStock || [];

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
            <span class="material-symbols-rounded icon-lg">auto_awesome</span>
          </div>
          <div>
            <h2 class="text-2xl font-black">المساعد التجاري الذكي (Gherbi.Ai Copilot)</h2>
            <p class="text-xs text-slate-500">تحليل ذكي محلي لسرعة دوران المخزون، توصيات الشراء اليومية، وكشف البضاعة الراكدة</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm text-emerald-600 mb-3">🚀 توصيات إعادة الطلب العاجلة (بناءً على سرعة السحب)</h3>
            <div class="space-y-2 text-xs">
              ${
                reorders.length === 0
                  ? '<div class="text-slate-400 py-6 text-center">جميع المنتجات السريعة متوفرة بكميات كافية</div>'
                  : reorders
                      .map(
                        (r) =>
                          `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between"><div><div class="font-bold">${r.name}</div><div class="text-[10px] text-slate-400">معدل البيع اليومي: ${r.daily_velocity}</div></div><span class="font-mono font-bold text-rose-500">يكفي ${r.days_of_supply} يوم</span></div>`
                      )
                      .join('')
              }
            </div>
          </div>
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm text-amber-500 mb-3">⚠️ تنبيهات البضاعة الراكدة (لم تُبع منذ 30 يوماً)</h3>
            <div class="space-y-2 text-xs">
              ${
                dead.length === 0
                  ? '<div class="text-slate-400 py-6 text-center">لا توجد بضاعة راكدة حالياً</div>'
                  : dead
                      .map(
                        (d) =>
                          `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between"><span class="font-bold">${d.name} (الرصيد: ${d.stock_qty})</span><span class="font-mono font-bold text-amber-500">رأس مال مجمد: ${Number(d.tied_capital || 0).toFixed(2)} د.ج</span></div>`
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>`;
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  },

  async renderUsersView() {
    const root = document.getElementById('users-view-root');
    if (!root) return;
    const [users, logs] = await Promise.all([
      window.api.getUsers().catch(() => []),
      window.api.getAuditLogs().catch(() => [])
    ]);

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-black">إدارة المستخدمين، الصلاحيات، وسجل الرقابة الأمنية</h2>
            <p class="text-xs text-slate-500">إدارة حسابات الكاشير ومراقبة أي حذف سطور من السلة أو تخفيض أسعار أو فتح درج النقود</p>
          </div>
          <button onclick="App.openUserModal()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">+ إضافة مستخدم</button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 class="font-black text-sm mb-3">المستخدمون (${users.length})</h3>
            <table class="w-full text-xs text-right">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th class="py-2">الاسم</th>
                  <th class="py-2">اسم الدخول</th>
                  <th class="py-2">الدور</th>
                  <th class="py-2">إجراء</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                ${users
                  .map(
                    (u) => `
                  <tr>
                    <td class="py-2.5 font-bold">${u.name}</td>
                    <td class="py-2.5 font-mono">${u.username}</td>
                    <td class="py-2.5">${u.role}</td>
                    <td class="py-2.5 flex gap-1.5">
                      <button onclick='App.openUserModal(${JSON.stringify(u).replace(/'/g, "&apos;")})' class="px-2 py-1 bg-blue-500/10 text-blue-600 rounded font-bold">تعديل</button>
                    </td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 class="font-black text-sm text-amber-500 mb-3">🛡️ آخر أحداث الرقابة الأمنية للكاشير (${logs.length})</h3>
            <div class="space-y-1.5 text-xs max-h-80 overflow-y-auto">
              ${
                logs.length === 0
                  ? '<div class="py-8 text-center text-slate-400">لا توجد أحداث رقابية مسجلة بعد</div>'
                  : logs
                      .slice(0, 30)
                      .map(
                        (l) => `
                    <div class="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                      <div>
                        <span class="font-bold text-amber-600">${l.action_type}</span>
                        <span class="text-slate-400 mr-1">(${l.user_name || 'Cashier'})</span>
                        <div class="text-[10px] text-slate-500 font-mono">${l.details_json || ''}</div>
                      </div>
                      <span class="font-mono text-[10px] text-slate-400">${String(l.created_at || '').slice(0, 16)}</span>
                    </div>`
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>`;
  },

  openUserModal(u = null) {
    document.getElementById('usrIdInput').value = u ? u.id : '';
    document.getElementById('usrNameInput').value = u ? u.name || '' : '';
    document.getElementById('usrUsernameInput').value = u ? u.username || '' : '';
    document.getElementById('usrPasswordInput').value = '';
    document.getElementById('usrRoleSelect').value = u ? u.role || 'Cashier' : 'Cashier';
    this.openModal('userModal');
  },

  async confirmSaveUser() {
    const id = document.getElementById('usrIdInput').value;
    const payload = {
      name: document.getElementById('usrNameInput').value.trim(),
      username: document.getElementById('usrUsernameInput').value.trim(),
      password: document.getElementById('usrPasswordInput').value,
      role: document.getElementById('usrRoleSelect').value || 'Cashier'
    };
    if (!payload.name || !payload.username) return;

    if (id) await window.api.updateUser(Number(id), payload);
    else await window.api.addUser(payload);

    this.closeModal('userModal');
    await this.renderUsersView();
    showToast('تم حفظ بيانات المستخدم بنجاح', 'success');
  },

  async confirmUpdateOwnAccount() {
    const username = document.getElementById('accUsernameInput').value.trim();
    const newPass = document.getElementById('accNewPassInput').value;
    if (!username) return;
    await window.api.updateAccount(AppState.currentUser.id, username, '', newPass);
    this.closeModal('accountModal');
    showToast('تم تحديث بيانات الحساب الشخصي بنجاح', 'success');
  },

  async openAuditLogsModal() {
    const logs = (await window.api.getAuditLogs().catch(() => [])) || [];
    const body = document.getElementById('auditLogModalBody');
    if (body) {
      body.innerHTML =
        logs.length === 0
          ? `<div class="py-10 text-center text-slate-400 font-bold">سجل الرقابة نظيف — لا توجد عمليات حذف من السلة أو تخفيض أسعار مشبوهة</div>`
          : `<table class="w-full text-xs text-right">
              <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-2">التوقيت</th><th class="py-2">المستخدم</th><th class="py-2">نوع العملية</th><th class="py-2">التفاصيل</th></tr></thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                ${logs
                  .map(
                    (l) =>
                      `<tr><td class="py-2 font-mono">${String(l.created_at || '').slice(0, 19)}</td><td class="py-2 font-bold">${l.user_name || ''}</td><td class="py-2 font-bold text-amber-600">${l.action_type}</td><td class="py-2 font-mono text-[11px]">${l.details_json || ''}</td></tr>`
                  )
                  .join('')}
              </tbody>
            </table>`;
    }
    this.openModal('auditLogModal');
  },

  // ==========================================================================
  // 18. قسم الإعدادات المتكامل ذو الـ 7 تبويبات (7-Tab Enterprise Settings View)
  // ==========================================================================
  async switchSettingsTab(tabId) {
    AppState.settingsTab = tabId;
    await this.renderSettingsView();
  },

  async renderSettingsView() {
    const root = document.getElementById('settings-view-root');
    if (!root) return;
    const [settings, localIp, qrDataUrl, printers, comPorts, counters, dzStats] = await Promise.all([
      window.api.getSettings().catch(() => ({})),
      window.api.getLocalIp().catch(() => '127.0.0.1'),
      window.api.pairingQrDataUrl().catch(() => ''),
      window.api.getPrinters().catch(() => []),
      window.api.listComPorts().catch(() => []),
      window.api.getDocCounters ? window.api.getDocCounters().catch(() => []) : [],
      window.api.getDzDictionaryStats ? window.api.getDzDictionaryStats().catch(() => ({ count: 31 })) : { count: 31 }
    ]);
    AppState.settings = settings;
    const tab = AppState.settingsTab || 'general';

    const tabsList = [
      { id: 'general', label: '1. المتجر والشعار' },
      { id: 'invoices', label: '2. الفواتير والطابعات والترقيم' },
      { id: 'scale', label: '3. الميزان الإلكتروني والباركود' },
      { id: 'policies', label: '4. سياسات المخزون والولاء' },
      { id: 'network', label: '5. الشبكة والمزامنة السحابية' },
      { id: 'mobile', label: '6. تطبيق الهاتف المحمول' },
      { id: 'backup', label: '7. النسخ الاحتياطي وضبط المصنع' }
    ];

    root.innerHTML = `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">مركز الإعدادات الشامل وتهيئة النظام (7 تبويبات)</h2>
            <p class="text-xs text-slate-500">تخصيص الهوية الجبائية، الطابعات، الميزان الإلكتروني، الشبكة المحلية، السحابة، والنسخ الاحتياطي</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2 text-xs font-bold">
          ${tabsList
            .map(
              (t) =>
                `<button onclick="App.switchSettingsTab('${t.id}')" class="px-3.5 py-2 rounded-xl ${
                  tab === t.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }">${t.label}</button>`
            )
            .join('')}
        </div>

        <div id="settingsTabContentBox" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-xs"></div>
      </div>`;

    const box = document.getElementById('settingsTabContentBox');
    if (!box) return;

    if (tab === 'general') {
      box.innerHTML = `
        <div class="space-y-4">
          <h3 class="font-black text-sm">معلومات المتجر، الهوية الجبائية الجزائرية، وشعار المؤسسة</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label class="block font-bold mb-1">اسم المتجر / المؤسسة</label><input id="set-shop-name" value="${settings.shop_name || ''}" class="w-full px-3 py-2 rounded-xl font-bold"></div>
            <div><label class="block font-bold mb-1">النشاط / الوصف</label><input id="set-shop-desc" value="${settings.shop_description || ''}" class="w-full px-3 py-2 rounded-xl"></div>
            <div><label class="block font-bold mb-1">العنوان</label><input id="set-shop-addr" value="${settings.shop_address || ''}" class="w-full px-3 py-2 rounded-xl"></div>
            <div><label class="block font-bold mb-1">رقم الهاتف</label><input id="set-shop-phone" value="${settings.shop_phone || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
            <div><label class="block font-bold mb-1">الفاكس</label><input id="set-shop-fax" value="${settings.shop_fax || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
            <div><label class="block font-bold mb-1">البريد الإلكتروني</label><input id="set-shop-email" value="${settings.shop_email || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
            <div><label class="block font-bold mb-1">السجل التجاري (RC)</label><input id="set-shop-rc" value="${settings.shop_rc || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
            <div><label class="block font-bold mb-1">الرقم الجبائي (NIF)</label><input id="set-shop-nif" value="${settings.shop_nif || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
            <div><label class="block font-bold mb-1">مادة الضريبة (AI)</label><input id="set-shop-ai" value="${settings.shop_ai || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
            <div><label class="block font-bold mb-1">الرقم الإحصائي (NIS)</label><input id="set-shop-nis" value="${settings.shop_nis || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
            <div class="md:col-span-2"><label class="block font-bold mb-1">حساب BaridiMob / RIP (لشاشة الزبون وعقود التقسيط)</label><input id="set-shop-rip" value="${settings.shop_baridimob_rip || ''}" placeholder="00799999000000000000" class="w-full px-3 py-2 rounded-xl font-mono"></div>
          </div>
          <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
            <div>
              <label class="block font-bold mb-1">شعار المتجر (يظهر على الفواتير والتذاكر):</label>
              <input type="file" accept="image/*" onchange="App.handleShopLogoUpload(this)" class="text-xs">
              <input id="set-shop-logo" type="hidden" value="${settings.shop_logo || ''}">
            </div>
            ${settings.shop_logo ? `<img id="settLogoPreview" src="${settings.shop_logo}" class="h-16 w-16 object-contain border rounded-xl p-1 bg-white">` : ''}
          </div>
          <button onclick="App.saveGeneralSettingsTab()" class="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow">حفظ معلومات المتجر</button>
        </div>`;
    } else if (tab === 'invoices') {
      box.innerHTML = `
        <div class="space-y-4">
          <h3 class="font-black text-sm">إعدادات قوالب الفواتير، الطابعات، وترقيم المستندات</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block font-bold mb-1">قالب الفاتورة الافتراضي (A4 / A5)</label>
              <select id="set-inv-tpl" class="w-full px-3 py-2 rounded-xl font-bold">
                ${['template1', 'template2', 'template3', 'template4', 'template5', 'template6', 'template7', 'template8', 'template9', 'a5', 'detailed', 'thermal80']
                  .map((k) => `<option value="${k}" ${settings.invoice_template === k ? 'selected' : ''}>${k}</option>`)
                  .join('')}
              </select>
            </div>
            <div>
              <label class="block font-bold mb-1">قالب التذكرة الحرارية (1..5)</label>
              <select id="set-rcpt-tpl" class="w-full px-3 py-2 rounded-xl font-bold">
                ${['receipt1', 'receipt2', 'receipt3', 'receipt4', 'receipt5']
                  .map((k) => `<option value="${k}" ${settings.receipt_template === k ? 'selected' : ''}>${k}</option>`)
                  .join('')}
              </select>
            </div>
            <div>
              <label class="block font-bold mb-1">عرض ورق التذكرة الحرارية</label>
              <select id="set-rcpt-width" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
                <option value="80" ${String(settings.receipt_paper_width_mm) !== '58' ? 'selected' : ''}>80mm (قياسي)</option>
                <option value="58" ${String(settings.receipt_paper_width_mm) === '58' ? 'selected' : ''}>58mm (صغير)</option>
              </select>
            </div>
            <div>
              <label class="block font-bold mb-1">مهلة السماح بتعديل الفاتورة (بالأيام)</label>
              <select id="set-thermal-printer" class="w-full px-3 py-2 rounded-xl font-bold mb-2">
                <option value="">الطابعة الحرارية الافتراضية للنظام</option>
                ${printers.map((pr) => `<option value="${pr.name}" ${settings.thermal_printer_name === pr.name ? 'selected' : ''}>🖨️ حرارية: ${pr.name}</option>`).join('')}
              </select>
              <select id="set-a4-printer" class="w-full px-3 py-2 rounded-xl font-bold mb-2">
                <option value="">طابعة A4 الافتراضية للنظام</option>
                ${printers.map((pr) => `<option value="${pr.name}" ${settings.a4_printer_name === pr.name ? 'selected' : ''}>🖨️ A4: ${pr.name}</option>`).join('')}
              </select>
              <input id="set-edit-win" type="number" value="${settings.sale_edit_window_days || '30'}" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
            </div>
            <label class="flex items-center gap-2 cursor-pointer pt-5">
              <input id="set-silent-print" type="checkbox" ${String(settings.silent_print) === 'true' ? 'checked' : ''}>
              <span class="font-bold">تفعيل الطباعة الصامتة المباشرة بدون نافذة</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer pt-5">
              <input id="set-rcpt-bc" type="checkbox" ${String(settings.show_receipt_barcode) !== 'false' ? 'checked' : ''}>
              <span class="font-bold">طباعة باركود الفاتورة أسفل الوصل الحراري</span>
            </label>
          </div>
          <button onclick="App.saveInvoiceSettingsTab()" class="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow">حفظ إعدادات الطباعة</button>

          <div class="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <h4 class="font-black text-xs">تخصيص عدادات وصيغ ترقيم المستندات (${new Date().getFullYear()})</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              ${counters
                .map(
                  (c) => `
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2">
                  <span class="font-mono font-bold w-28">${c.doc_type}</span>
                  <input id="ctr-fmt-${c.doc_type}" type="text" value="${c.prefix_format || ''}" class="flex-1 px-2 py-1 rounded font-mono">
                  <input id="ctr-num-${c.doc_type}" type="number" value="${c.last_number || 0}" class="w-20 px-2 py-1 rounded font-mono text-center">
                  <button onclick="App.saveDocCounterRow('${c.doc_type}', ${c.year})" class="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold">حفظ</button>
                </div>`
                )
                .join('')}
            </div>
          </div>
        </div>`;
    } else if (tab === 'scale') {
      box.innerHTML = `
        <div class="space-y-4">
          <h3 class="font-black text-sm">إعدادات الميزان الإلكتروني (USB / RS232) وباركود الميزان</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block font-bold mb-1">منفذ الميزان التسلسلي (COM Port)</label>
              <select id="set-scale-port" class="w-full px-3 py-2 rounded-xl font-mono">
                <option value="">غير متصل</option>
                ${comPorts.map((cp) => `<option value="${cp.path}" ${settings.usb_scale_port === cp.path ? 'selected' : ''}>${cp.path} (${cp.manufacturer || 'Serial'})</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block font-bold mb-1">سرعة الاتصال (Baud Rate)</label>
              <select id="set-scale-baud" class="w-full px-3 py-2 rounded-xl font-mono">
                ${['9600', '4800', '19200', '38400', '115200'].map((b) => `<option value="${b}" ${String(settings.usb_scale_baud || '9600') === b ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block font-bold mb-1">بادئة باركود الميزان (Prefix)</label>
              <input id="set-scale-prefix" type="text" value="${settings.scale_barcode_prefix || '20'}" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <div class="col-span-full grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
            <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input id="set-open-drawer-cash" type="checkbox" ${String(settings.open_drawer_on_cash_sale) !== 'false' ? 'checked' : ''}>
              <span class="font-bold">فتح درج النقود تلقائياً عند كل عملية بيع نقدي (ESC/POS)</span>
            </label>
            <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input id="set-scale-auto-add" type="checkbox" ${String(settings.usb_scale_auto_add) === 'true' ? 'checked' : ''}>
              <span class="font-bold">إضافة المنتج الموزون تلقائياً للسلة فور استقرار الميزان</span>
            </label>
          </div>
          <button onclick="App.saveScaleSettingsTab()" class="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold">حفظ إعدادات الميزان</button>
            <button onclick="App.testScaleConnection()" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">بدء الاتصال بالميزان</button>
            <button onclick="window.api.scale.probe({}).then((r)=>showToast('نتيجة الفحص: '+JSON.stringify(r),'info'))" class="px-4 py-2 bg-indigo-600/15 text-indigo-600 rounded-xl font-bold">فحص البروتوكول التلقائي (Probe)</button>
          </div>
        </div>`;
    } else if (tab === 'policies') {
      box.innerHTML = `
        <div class="space-y-4">
          <h3 class="font-black text-sm">سياسات المخزون، التصنيع التلقائي، نقاط الولاء، وحاسبة الزكاة</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input id="set-allow-neg" type="checkbox" ${String(settings.allow_negative_stock) !== 'false' ? 'checked' : ''}>
              <span class="font-bold">السماح بالبيع بالسالب عند نفاد المخزون (مع تسجيله في ديون المخزون)</span>
            </label>
            <label class="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input id="set-auto-bom" type="checkbox" ${String(settings.manufacturing_auto_on_sale) === 'true' ? 'checked' : ''}>
              <span class="font-bold">تفعيل التصنيع التلقائي الفوري للمنتجات المركبة عند البيع</span>
            </label>
            <div>
              <label class="block font-bold mb-1">نقاط الولاء المكتسبة لكل 100 د.ج مشتريات</label>
              <input id="set-loyalty-pts" type="number" step="any" value="${settings.loyalty_points_per_100_dzd || '1'}" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
            </div>
            <div>
              <label class="block font-bold mb-1">سعر غرام الذهب عيار 24 (د.ج) لحساب نصاب الزكاة</label>
              <input id="set-zakat-gold" type="number" step="any" value="${settings.zakat_gold_price_per_gram || '14500'}" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
            </div>
          </div>
          <button onclick="App.savePoliciesSettingsTab()" class="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow">حفظ السياسات</button>
        </div>`;
    } else if (tab === 'network') {
      box.innerHTML = `
        <div class="space-y-4">
          <h3 class="font-black text-sm">الشبكة المحلية (LAN Multi-POS) والمزامنة السحابية</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block font-bold mb-1">وضع الجهاز في الشبكة المحلية</label>
              <select id="set-net-mode" class="w-full px-3 py-2 rounded-xl font-bold">
                <option value="server" ${settings.network_mode !== 'client' ? 'selected' : ''}>خادم رئيسي (Server Master)</option>
                <option value="client" ${settings.network_mode === 'client' ? 'selected' : ''}>كاشير فرعي (LAN Client)</option>
              </select>
            </div>
            <div>
              <label class="block font-bold mb-1">عنوان IP الخادم الرئيسي</label>
              <input id="set-server-ip" type="text" value="${settings.server_ip || localIp}" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
            </div>
            <div>
              <label class="block font-bold mb-1">منفذ الشبكة (Port)</label>
              <input id="set-server-port" type="number" value="${settings.server_port || '8080'}" class="w-full px-3 py-2 rounded-xl font-mono font-bold">
            </div>
          </div>
          <button onclick="App.saveNetworkSettingsTab()" class="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold">حفظ إعدادات الشبكة</button>

          <div class="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
            <h4 class="font-black text-xs text-indigo-600">أدوات المزامنة السحابية وصيانة دفتر المخزون (Cloud & Stock Ledger Tools)</h4>
            <div class="flex flex-wrap gap-2">
              <button onclick="window.api.cloudSync.trigger().then(()=>showToast('تمت المزامنة الآنية','success'))" class="px-3.5 py-2 bg-indigo-600 text-white rounded-xl font-bold">مزامنة الآن (Trigger)</button>
              <button onclick="window.api.cloudSync.snapshot().then(()=>showToast('تم رفع النسخة الكاملة','success'))" class="px-3.5 py-2 bg-blue-600/15 text-blue-600 rounded-xl font-bold">رفع نسخة كاملة (Snapshot)</button>
              <button onclick="window.api.cloudSync.recomputeStock().then(()=>showToast('تم إعادة حساب أرصدة الدفعات','success'))" class="px-3.5 py-2 bg-emerald-600/15 text-emerald-600 rounded-xl font-bold">إعادة حساب المخزون</button>
              <button onclick="window.api.cloudSync.repairLedger().then(()=>showToast('تم إصلاح دفتر حركات المخزون','success'))" class="px-3.5 py-2 bg-amber-500/15 text-amber-600 rounded-xl font-bold">إصلاح دفتر المخزون</button>
              <button onclick="window.api.cloudSync.deepDiagnose().then((r)=>showToast('المشغلات النشطة: '+r.triggersCount,'info'))" class="px-3.5 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold">فحص عميق (Deep Diagnose)</button>
            </div>
          </div>
        </div>`;
    } else if (tab === 'mobile') {
      box.innerHTML = `
        <div class="text-center space-y-4 py-4">
          <h3 class="font-black text-base">ربط تطبيق الهاتف المحمول والكاشير اللاسلكي</h3>
          <div class="text-xs text-slate-400">عنوان الخادم المحلي النشط: <strong class="font-mono text-blue-500">http://${localIp}:8080</strong></div>
          ${qrDataUrl ? `<img src="${qrDataUrl}" class="w-48 h-48 mx-auto rounded-2xl border border-slate-200 p-2 bg-white shadow">` : ''}
          <div class="flex justify-center gap-2">
            <button onclick="window.api.cloudSync.issueMobilePairCode().then((r)=>showToast('كود اقتران الهاتف: '+r.code,'success'))" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold">إصدار كود اقتران سداسي للهاتف</button>
          </div>
        </div>`;
    } else if (tab === 'backup') {
      box.innerHTML = `
        <div class="space-y-5">
          <h3 class="font-black text-sm">النسخ الاحتياطي، استيراد قاموس المنتجات الجزائرية (613)، وإعادة ضبط المصنع</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button onclick="window.api.exportDatabaseBackup()" class="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-center">📦 تصدير نسخة احتياطية كاملة (ZIP)</button>
            <button onclick="window.api.importDatabaseBackup()" class="p-4 rounded-2xl bg-amber-600 text-white font-bold text-center">📂 استعادة نسخة احتياطية (ZIP / DB)</button>
            <button onclick="App.importDzDictionaryNow()" class="p-4 rounded-2xl bg-blue-600 text-white font-bold text-center">🇩🇿 استيراد قاموس 613 الضخم (حالي: ${dzStats.count || 31})</button>
          </div>
          <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
            <div>
              <div class="font-black text-rose-600">منطقة الخطر: إعادة ضبط المصنع (Reset System)</div>
              <div class="text-slate-500">يمسح جميع المبيعات والمنتجات والديون مع الإبقاء على حساب المدير وإعدادات المتجر</div>
            </div>
            <button onclick="App.confirmFactoryReset()" class="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-black">إعادة ضبط المصنع</button>
          </div>
        </div>`;
    }
  },

  handleShopLogoUpload(inputEl) {
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('set-shop-logo').value = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  async saveGeneralSettingsTab() {
    const updated = {
      shop_name: document.getElementById('set-shop-name').value.trim(),
      shop_description: document.getElementById('set-shop-desc').value.trim(),
      shop_address: document.getElementById('set-shop-addr').value.trim(),
      shop_phone: document.getElementById('set-shop-phone').value.trim(),
      shop_fax: document.getElementById('set-shop-fax').value.trim(),
      shop_email: document.getElementById('set-shop-email').value.trim(),
      shop_rc: document.getElementById('set-shop-rc').value.trim(),
      shop_nif: document.getElementById('set-shop-nif').value.trim(),
      shop_ai: document.getElementById('set-shop-ai').value.trim(),
      shop_nis: document.getElementById('set-shop-nis').value.trim(),
      shop_baridimob_rip: document.getElementById('set-shop-rip').value.trim(),
      shop_logo: document.getElementById('set-shop-logo').value
    };
    await window.api.updateSettings(updated);
    AppState.settings = { ...AppState.settings, ...updated };
    await this.renderSettingsView();
    showToast('تم حفظ معلومات المتجر والشعار بنجاح', 'success');
  },

  async saveInvoiceSettingsTab() {
    const updated = {
      invoice_template: document.getElementById('set-inv-tpl').value,
      receipt_template: document.getElementById('set-rcpt-tpl').value,
      receipt_paper_width_mm: document.getElementById('set-rcpt-width').value,
      sale_edit_window_days: document.getElementById('set-edit-win').value,
      thermal_printer_name: document.getElementById('set-thermal-printer')?.value || '',
      a4_printer_name: document.getElementById('set-a4-printer')?.value || '',
      silent_print: String(document.getElementById('set-silent-print').checked),
      show_receipt_barcode: String(document.getElementById('set-rcpt-bc').checked)
    };
    await window.api.updateSettings(updated);
    AppState.settings = { ...AppState.settings, ...updated };
    showToast('تم حفظ إعدادات الفواتير والطباعة بنجاح', 'success');
  },

  async saveDocCounterRow(docType, year) {
    const prefix_format = document.getElementById(`ctr-fmt-${docType}`)?.value?.trim();
    const last_number = parseInt(document.getElementById(`ctr-num-${docType}`)?.value || '0', 10) || 0;
    await window.api.updateDocCounter({ doc_type: docType, year, prefix_format, last_number });
    showToast(`تم تحديث عداد (${docType}) بنجاح`, 'success');
  },

  async saveScaleSettingsTab() {
    const updated = {
      usb_scale_port: document.getElementById('set-scale-port').value,
      usb_scale_baud: document.getElementById('set-scale-baud').value,
      scale_barcode_prefix: document.getElementById('set-scale-prefix').value.trim() || '20',
      open_drawer_on_cash_sale: String(Boolean(document.getElementById('set-open-drawer-cash')?.checked)),
      usb_scale_auto_add: String(Boolean(document.getElementById('set-scale-auto-add')?.checked))
    };
    await window.api.updateSettings(updated);
    AppState.settings = { ...AppState.settings, ...updated };
    showToast('تم حفظ إعدادات الميزان الإلكتروني', 'success');
  },

  async savePoliciesSettingsTab() {
    const updated = {
      allow_negative_stock: String(document.getElementById('set-allow-neg').checked),
      manufacturing_auto_on_sale: String(document.getElementById('set-auto-bom').checked),
      loyalty_points_per_100_dzd: document.getElementById('set-loyalty-pts').value,
      zakat_gold_price_per_gram: document.getElementById('set-zakat-gold').value
    };
    await window.api.updateSettings(updated);
    AppState.settings = { ...AppState.settings, ...updated };
    showToast('تم حفظ السياسات بنجاح', 'success');
  },

  async saveNetworkSettingsTab() {
    const updated = {
      network_mode: document.getElementById('set-net-mode').value,
      server_ip: document.getElementById('set-server-ip').value.trim(),
      server_port: document.getElementById('set-server-port').value.trim()
    };
    await window.api.updateSettings(updated);
    AppState.settings = { ...AppState.settings, ...updated };
    showToast('تم حفظ إعدادات الشبكة المحلية', 'success');
  },

  async confirmFactoryReset() {
    if (!confirm('تحذير: هل أنت متأكد من مسح جميع المبيعات والمنتجات وإعادة ضبط المصنع؟')) return;
    await window.api.resetSystem();
    await this.refreshProducts();
    showToast('تمت إعادة ضبط المصنع بنجاح', 'info');
  },

  async testScaleConnection() {
    const port = document.getElementById('set-scale-port')?.value;
    if (!port) {
      showToast('يرجى اختيار منفذ الميزان (COM Port) أولاً', 'warning');
      return;
    }
    await window.api.scale.start({ port, baud: 9600, protocol: 'auto' });
    showToast(`تم بدء الاتصال بالميزان على المنفذ ${port}`, 'info');
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());