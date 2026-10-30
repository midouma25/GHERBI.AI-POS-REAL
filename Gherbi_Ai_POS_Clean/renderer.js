/**
 * renderer.js
 * المحرك الرئيسي للواجهة الأمامية ونقطة البيع (Master Frontend & POS Controller) لنظام Gherbi.Ai POS
 * يدير الأقسام الـ 18، تعدد السلات، تفكيك باركود الميزان، الاختصارات، الصوت، الإحصائيات، والزكاة
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
  customers: [],
  suppliers: [],
  activeSession: null,
  selectedCategory: 'all',
  searchQuery: '',
  isReturnMode: false,
  priceTier: 'retail',
  carts: [{ id: 1, label: 'سلة #1', items: [], customerId: '', discount: 0 }],
  activeCartIndex: 0,
  draftCarts: [],
  lastRevision: 0
};

window.AppState = AppState;

// ============================================================================
// 1. المؤثرات الصوتية الذاتية (Web Audio Synthesizer) والإشعارات
// ============================================================================
function playBeep(success = true) {
  try {
    if (String(AppState.settings.scan_alert_sounds) === 'false') return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'sawtooth';
    osc.frequency.value = success ? 1050 : 280;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.08 : 0.22));
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
  el.className = `px-4 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 ${colors[type] || colors.info}`;
  el.innerHTML = `<span class="material-symbols-rounded icon-sm">notifications</span><span>${message}</span>`;
  box.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 3200);
}

window.showToast = showToast;

// ============================================================================
// 2. التهيئة الأولية وتحميل البيانات من النواة الخلفية
// ============================================================================
const App = {
  async init() {
    if (!window.api) return;

    const [settings, products, categories, customers, suppliers, activeSession] = await Promise.all([
      window.api.getSettings().catch(() => ({})),
      window.api.getPosStock().catch(() => []),
      window.api.getCategories().catch(() => []),
      window.api.getCustomers().catch(() => []),
      window.api.getSuppliers().catch(() => []),
      window.api.getActiveSession(1).catch(() => null)
    ]);

    AppState.settings = settings || {};
    AppState.products = Array.isArray(products) ? products : [];
    AppState.categories = Array.isArray(categories) ? categories : [];
    AppState.customers = Array.isArray(customers) ? customers : [];
    AppState.suppliers = Array.isArray(suppliers) ? suppliers : [];
    AppState.activeSession = activeSession;

    // التحقق من وجود مستخدم أو إنشاء المدير الافتراضي تلقائياً بشكل سلس
    const isFirst = await window.api.checkFirstRun().catch(() => false);
    if (isFirst === true || (isFirst && isFirst.isFirstRun === true)) {
      const adminRes = await window.api.setupFirstAdmin('المدير العام', 'admin', '1234').catch(() => null);
      if (adminRes && adminRes.user) AppState.currentUser = adminRes.user;
    } else {
      const users = await window.api.getUsers().catch(() => []);
      if (users && users.length > 0) {
        AppState.currentUser = users[0];
      }
    }

    this.updateUserBadge();
    this.updateShiftHeaderBadge();
    this.setLanguage(AppState.settings.app_lang || 'ar', false);
    this.renderPosView();
    this.bindKeyboardShortcuts();
    this.bindLiveEvents();
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

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
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
        showToast('تم إرسال نبضة فتح درج النقود', 'info');
      }
    });
  },

  bindLiveEvents() {
    if (window.api && window.api.scale && window.api.scale.onReading) {
      window.api.scale.onReading((reading) => {
        const box = document.getElementById('liveScaleBox');
        const txt = document.getElementById('liveScaleWeight');
        if (box) box.classList.remove('hidden');
        if (txt && reading) {
          txt.textContent = `${Number(reading.weight || 0).toFixed(3)} ${reading.unit || 'kg'}`;
        }
      });
    }
  },

  // ==========================================================================
  // 3. التنقل بين الأقسام الـ 18 واللغات والوضع الليلي
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
    AppState.products = (await window.api.getPosStock().catch(() => [])) || [];
    AppState.categories = (await window.api.getCategories().catch(() => [])) || [];
    AppState.customers = (await window.api.getCustomers().catch(() => [])) || [];
  },

  // ==========================================================================
  // 4. شاشة المبيعات والكاشير (POS Engine & Scale Barcode Parser)
  // ==========================================================================
  get currentCart() {
    return AppState.carts[AppState.activeCartIndex] || AppState.carts[0];
  },

  renderPosView() {
    // الفئات
    const pillsBox = document.getElementById('posCategoryPills');
    if (pillsBox) {
      const cats = ['all', ...AppState.categories];
      pillsBox.innerHTML = cats
        .map((c) => {
          const active = AppState.selectedCategory === c;
          const label = c === 'all' ? 'جميع الفئات' : c;
          return `<button onclick="App.selectPosCategory('${c}')"
            class="px-3 py-1.5 rounded-xl text-xs font-bold ${
              active ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }">${label}</button>`;
        })
        .join('');
    }

    // الزبائن
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
        this.currentCart.customerId = e.target.value ? Number(e.target.value) : '';
      };
    }

    this.renderPosProductsGrid();
    this.renderCartTabs();
    this.renderCartItems();
  },

  selectPosCategory(cat) {
    AppState.selectedCategory = cat;
    this.renderPosView();
  },

  onPosSearchInput(query) {
    AppState.searchQuery = String(query || '').trim().toLowerCase();
    this.renderPosProductsGrid();
  },

  renderPosProductsGrid() {
    const grid = document.getElementById('posProductsGrid');
    if (!grid) return;

    const filtered = AppState.products.filter((p) => {
      if (AppState.selectedCategory !== 'all' && p.category !== AppState.selectedCategory) {
        return false;
      }
      if (AppState.searchQuery) {
        const q = AppState.searchQuery;
        const matchName = String(p.name || '').toLowerCase().includes(q);
        const matchBc = String(p.barcode || '').toLowerCase().includes(q);
        const matchPlu = String(p.plu_code || '').toLowerCase().includes(q);
        return matchName || matchBc || matchPlu;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 space-y-2">
          <span class="material-symbols-rounded icon-xl">inventory_2</span>
          <div class="text-sm font-bold">لا توجد منتجات مطابقة للبحث</div>
        </div>`;
      return;
    }

    grid.innerHTML = filtered
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

        return `
          <div onclick="App.addProductToCart(${p.id})" class="product-card flex flex-col justify-between gap-2">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${stockBadgeClass}">${stock} ${p.unit || ''}</span>
              ${p.active_promotion ? '<span class="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold">عرض</span>' : ''}
            </div>
            <div class="font-bold text-xs line-clamp-2 min-h-[2rem]">${p.name}</div>
            <div class="pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span class="font-mono font-black text-sm text-blue-600 dark:text-blue-400">${price.toFixed(2)}</span>
              <span class="text-[10px] text-slate-400">د.ج</span>
            </div>
          </div>`;
      })
      .join('');
  },

  handleBarcodeScan(rawCode) {
    const code = String(rawCode || '').trim();
    const input = document.getElementById('barcodeInput');
    if (input) input.value = '';
    if (!code) return;

    // 1. فحص باركود الميزان (يبدأ بـ 20 إلى 29 وطوله 13 رقماً)
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

    // 2. البحث بالباركود الأساسي أو الباركودات الإضافية
    const found = AppState.products.find(
      (p) =>
        String(p.barcode) === code ||
        (Array.isArray(p.barcodes) && p.barcodes.includes(code))
    );

    if (found) {
      this.addProductToCart(found.id, 1);
      playBeep(true);
    } else {
      playBeep(false);
      showToast(`لم يتم العثور على منتج بالباركود: ${code}`, 'warning');
    }
  },

  addProductToCart(productId, customQty = 1) {
    const prod = AppState.products.find((p) => Number(p.id) === Number(productId));
    if (!prod) return;

    const sign = AppState.isReturnMode ? -1 : 1;
    const qtyToAdd = Number(customQty || 1) * sign;

    let unitPrice =
      AppState.priceTier === 'wholesale' && Number(prod.wholesale_price) > 0
        ? Number(prod.wholesale_price)
        : Number(prod.selling_price || 0);

    if (prod.active_promotion) {
      const prm = prod.active_promotion;
      if (prm.discount_type === 'percentage') {
        unitPrice = Number((unitPrice * (1 - Number(prm.discount_value || 0) / 100)).toFixed(2));
      } else {
        unitPrice = Math.max(0, Number((unitPrice - Number(prm.discount_value || 0)).toFixed(2)));
      }
    }

    const cart = this.currentCart;
    const existing = cart.items.find((it) => Number(it.product_id) === Number(prod.id));

    if (existing) {
      existing.quantity = Number((existing.quantity + qtyToAdd).toFixed(4));
      existing.subtotal = Number((existing.quantity * existing.price).toFixed(2));
    } else {
      cart.items.push({
        product_id: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        unit: prod.unit || 'قطعة',
        quantity: qtyToAdd,
        price: unitPrice,
        cost_price: Number(prod.cost_price || 0),
        subtotal: Number((qtyToAdd * unitPrice).toFixed(2)),
        applied_promotion_id: prod.active_promotion ? prod.active_promotion.id : null
      });
    }

    this.renderCartItems();
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

    if (cart.items.length === 0) {
      box.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-slate-400 py-12">
          <span class="material-symbols-rounded icon-xl">shopping_basket</span>
          <p class="text-xs font-bold mt-2">السلة فارغة — اختر منتجاً أو امسح باركود</p>
        </div>`;
      this.recalcCart();
      return;
    }

    box.innerHTML = cart.items
      .map(
        (it, idx) => `
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
          <div class="flex-1 min-w-0">
            <div class="font-bold truncate">${it.name}</div>
            <div class="text-[11px] text-slate-400 font-mono">${it.price.toFixed(2)} د.ج / ${it.unit || 'وحدة'}</div>
          </div>
          <div class="flex items-center gap-1">
            <input type="number" step="any" value="${it.quantity}"
              oninput="App.updateCartItemQty(${idx}, this.value)"
              class="w-16 px-1.5 py-1 rounded-lg text-center font-mono font-bold">
            <input type="number" step="any" value="${it.price}"
              oninput="App.updateCartItemPrice(${idx}, this.value)"
              class="w-20 px-1.5 py-1 rounded-lg text-center font-mono font-bold text-blue-600">
          </div>
          <div class="w-20 text-left font-mono font-black">${it.subtotal.toFixed(2)}</div>
          <button onclick="App.removeCartItem(${idx})" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg">
            <span class="material-symbols-rounded icon-sm">delete</span>
          </button>
        </div>`
      )
      .join('');

    this.recalcCart();
    this.renderCartTabs();
  },

  updateCartItemQty(idx, val) {
    const it = this.currentCart.items[idx];
    if (!it) return;
    it.quantity = parseFloat(val) || 0;
    it.subtotal = Number((it.quantity * it.price).toFixed(2));
    this.recalcCart();
  },

  updateCartItemPrice(idx, val) {
    const it = this.currentCart.items[idx];
    if (!it) return;
    it.price = parseFloat(val) || 0;
    it.subtotal = Number((it.quantity * it.price).toFixed(2));
    this.recalcCart();
  },

  removeCartItem(idx) {
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
    this.currentCart.items = [];
    const discInput = document.getElementById('cartDiscountInput');
    if (discInput) discInput.value = '0';
    this.renderCartItems();
  },

  holdCurrentCart() {
    if (this.currentCart.items.length === 0) return;
    AppState.draftCarts.push(JSON.parse(JSON.stringify(this.currentCart)));
    this.clearCurrentCart();
    showToast('تم تعليق الفاتورة في المسودات (F3)', 'info');
  },

  openDraftsModal() {
    if (AppState.draftCarts.length === 0) {
      showToast('لا توجد فواتير معلقة في المسودات حالياً', 'info');
      return;
    }
    const restored = AppState.draftCarts.pop();
    AppState.carts[AppState.activeCartIndex] = restored;
    this.renderPosView();
    showToast('تم استرجاع الفاتورة المعلقة إلى السلة', 'success');
  },

  toggleReturnMode() {
    AppState.isReturnMode = !AppState.isReturnMode;
    const btn = document.getElementById('btnReturnMode');
    if (btn) {
      btn.className = AppState.isReturnMode
        ? 'px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center gap-1'
        : 'px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold flex items-center gap-1';
    }
    showToast(AppState.isReturnMode ? 'تم تفعيل وضع مرتجع المبيعات' : 'تم العودة لوضع البيع العادي', 'info');
  },

  setCartPriceTier(tier) {
    AppState.priceTier = tier;
    this.renderPosProductsGrid();
  },

  // ==========================================================================
  // 5. نافذة التسديد والدفع (Checkout Modal) ومراقب سقف الدين
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

    const alertBox = document.getElementById('creditLimitAlertBox');
    if (alertBox) alertBox.classList.add('hidden');

    if (this.currentCart.customerId && window.api.getCustomerCreditSummary) {
      const creditInfo = await window.api.getCustomerCreditSummary(this.currentCart.customerId).catch(() => null);
      if (creditInfo && creditInfo.credit_limit > 0) {
        alertBox.classList.remove('hidden');
        alertBox.textContent = `الزبون: ${creditInfo.name} | الدين الحالي: ${creditInfo.current_debt} د.ج | سقف الدين: ${creditInfo.credit_limit} د.ج`;
      }
    }

    this.recalcCheckoutModal();
    document.getElementById('checkoutModal').classList.add('active');
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
    }
    const paid = parseFloat(paidInput.value) || 0;
    const change = Math.max(0, Number((paid - finalTotal).toFixed(2)));
    document.getElementById('chkChangeAmount').textContent = `${change.toFixed(2)} د.ج`;

    return { subtotal, discount, tax_percentage: applyTva ? 19 : 0, stamp_amount: Number(stampAmount.toFixed(2)), total: finalTotal, paid_amount: Math.min(paid, finalTotal), payment_method: method };
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

    if (calc.payment_method === 'credit' && !cart.customerId) {
      showToast('يرجى اختيار الزبون عند البيع الآجل (بالدين)', 'error');
      return;
    }

    const salePayload = {
      customer_id: cart.customerId || null,
      user_id: AppState.currentUser ? AppState.currentUser.id : 1,
      subtotal: calc.subtotal,
      discount: calc.discount,
      tax_percentage: calc.tax_percentage,
      stamp_amount: calc.stamp_amount,
      total: calc.total,
      paid_amount: calc.paid_amount,
      payment_method: calc.payment_method,
      items: cart.items
    };

    try {
      const res = await window.api.processSale(salePayload);
      this.closeModal('checkoutModal');
      showToast(`تم تسجيل الفاتورة بنجاح (${res.docNumber || '#' + res.saleId})`, 'success');

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

      this.clearCurrentCart();
      await this.refreshProducts();
      this.renderPosView();
    } catch (err) {
      showToast(err.message || 'حدث خطأ أثناء حفظ الفاتورة', 'error');
    }
  },

  async saveCartAsProforma() {
    if (this.currentCart.items.length === 0) return;
    const { subtotal, discount, total } = this.recalcCart();
    const res = await window.api.createProforma({
      customer_id: this.currentCart.customerId || null,
      subtotal,
      discount,
      total,
      items: this.currentCart.items
    });
    this.clearCurrentCart();
    showToast(`تم حفظ الفاتورة الشكلية (${res.doc_number})`, 'success');
  },

  // ==========================================================================
  // 6. النوافذ المنبثقة (المنتج، الزبون، المنتج الحر، الوصفة، تسجيل الدخول)
  // ==========================================================================
  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  openProductModal(prod = null) {
    document.getElementById('prodIdInput').value = prod ? prod.id : '';
    document.getElementById('prodNameInput').value = prod ? prod.name : '';
    document.getElementById('prodBarcodeInput').value = prod ? prod.barcode || '' : '';
    document.getElementById('prodCategoryInput').value = prod ? prod.category || 'عام' : 'عام';
    document.getElementById('prodSupplierInput').value = prod ? prod.supplier || '' : '';
    document.getElementById('prodUnitInput').value = prod ? prod.unit || 'قطعة' : 'قطعة';
    document.getElementById('prodCostInput').value = prod ? prod.cost_price || 0 : 0;
    document.getElementById('prodPriceInput').value = prod ? prod.selling_price || 0 : 0;
    document.getElementById('prodWholesaleInput').value = prod && prod.wholesale_price ? prod.wholesale_price : '';
    document.getElementById('prodStockInput').value = prod ? prod.stock || 0 : 0;
    document.getElementById('prodMinStockInput').value = prod ? prod.min_stock || 5 : 5;
    document.getElementById('prodExpiryInput').value = prod && prod.expiry_date ? prod.expiry_date : '';
    document.getElementById('prodPluInput').value = prod && prod.plu_code ? prod.plu_code : '';
    document.getElementById('prodMaterialRoleInput').value = prod && prod.material_role ? prod.material_role : '';
    document.getElementById('productModal').classList.add('active');
  },

  generateRandomBarcode() {
    const rnd = '613' + String(Math.floor(1000000000 + Math.random() * 9000000000)).slice(0, 10);
    document.getElementById('prodBarcodeInput').value = rnd;
  },

  async saveProductFromModal() {
    const id = document.getElementById('prodIdInput').value;
    const payload = {
      name: document.getElementById('prodNameInput').value.trim(),
      barcode: document.getElementById('prodBarcodeInput').value.trim() || null,
      category: document.getElementById('prodCategoryInput').value.trim() || 'عام',
      supplier: document.getElementById('prodSupplierInput').value.trim() || null,
      unit: document.getElementById('prodUnitInput').value.trim() || 'قطعة',
      cost_price: parseFloat(document.getElementById('prodCostInput').value) || 0,
      selling_price: parseFloat(document.getElementById('prodPriceInput').value) || 0,
      wholesale_price: document.getElementById('prodWholesaleInput').value || null,
      stock: parseFloat(document.getElementById('prodStockInput').value) || 0,
      min_stock: parseInt(document.getElementById('prodMinStockInput').value, 10) || 5,
      expiry_date: document.getElementById('prodExpiryInput').value || null,
      plu_code: document.getElementById('prodPluInput').value.trim() || null,
      material_role: document.getElementById('prodMaterialRoleInput').value || null
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

  openCustomerModal() {
    document.getElementById('custIdInput').value = '';
    document.getElementById('custNameInput').value = '';
    document.getElementById('custPhoneInput').value = '';
    document.getElementById('custAddressInput').value = '';
    document.getElementById('custInitDebtInput').value = '0';
    document.getElementById('custCreditLimitInput').value = '0';
    document.getElementById('customerModal').classList.add('active');
  },

  async saveCustomerFromModal() {
    const name = document.getElementById('custNameInput').value.trim();
    if (!name) return;
    await window.api.addCustomer({
      name,
      phone: document.getElementById('custPhoneInput').value.trim(),
      address: document.getElementById('custAddressInput').value.trim(),
      initial_debt: parseFloat(document.getElementById('custInitDebtInput').value) || 0,
      credit_limit: parseFloat(document.getElementById('custCreditLimitInput').value) || 0
    });
    this.closeModal('customerModal');
    await this.refreshProducts();
    if (AppState.currentView === 'customers') await this.renderCustomersView();
    else this.renderPosView();
    showToast('تم حفظ الزبون بنجاح', 'success');
  },

  openFreeItemModal() {
    document.getElementById('freeItemModal').classList.add('active');
  },

  confirmFreeItem() {
    const name = document.getElementById('freeItemName').value.trim() || 'منتج حر';
    const price = parseFloat(document.getElementById('freeItemPrice').value) || 0;
    const qty = parseFloat(document.getElementById('freeItemQty').value) || 1;
    this.currentCart.items.push({
      product_id: null,
      name,
      custom_product_name: name,
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

    if (!productId || !compId) return;
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
    document.getElementById('authModal').classList.add('active');
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
  // 7. عرض بقية الأقسام الـ 17 بالكامل
  // ==========================================================================
  async renderSalesHistoryView() {
    const root = document.getElementById('sales-view-root');
    const sales = (await window.api.getSales({}).catch(() => [])) || [];
    root.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black">سجل المبيعات والفواتير (${sales.length})</h2>
          <button onclick="window.api.exportSalesToExcel()" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">تصدير Excel</button>
        </div>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2.5 px-2">رقم الفاتورة</th>
                <th class="py-2.5 px-2">التاريخ</th>
                <th class="py-2.5 px-2">الزبون</th>
                <th class="py-2.5 px-2">الإجمالي</th>
                <th class="py-2.5 px-2">المدفوع</th>
                <th class="py-2.5 px-2">الباقي</th>
                <th class="py-2.5 px-2">إجراءات الطباعة</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${sales
                .map((s) => {
                  const rem = Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0));
                  return `
                  <tr>
                    <td class="py-2.5 px-2 font-mono font-bold">${s.doc_number || '#' + s.id}</td>
                    <td class="py-2.5 px-2 font-mono">${String(s.sale_date || '').slice(0, 16)}</td>
                    <td class="py-2.5 px-2 font-bold">${s.customer_name || 'زبون عابر'}</td>
                    <td class="py-2.5 px-2 font-mono font-bold">${Number(s.total || 0).toFixed(2)} د.ج</td>
                    <td class="py-2.5 px-2 font-mono text-emerald-600">${Number(s.paid_amount || 0).toFixed(2)}</td>
                    <td class="py-2.5 px-2 font-mono ${rem > 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}">${rem.toFixed(2)}</td>
                    <td class="py-2.5 px-2 flex items-center gap-1.5">
                      <button onclick="App.reprintSale(${s.id}, 'a4')" class="px-2.5 py-1 bg-blue-600/10 text-blue-600 rounded-lg font-bold">فاتورة A4</button>
                      <button onclick="App.reprintSale(${s.id}, 'receipt')" class="px-2.5 py-1 bg-emerald-600/10 text-emerald-600 rounded-lg font-bold">تذكرة</button>
                      <button onclick="App.deleteSaleRecord(${s.id})" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                    </td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
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
    if (!confirm('هل تريد حذف هذه الفاتورة واسترجاع مخزونها؟')) return;
    await window.api.deleteSale(saleId);
    await this.renderSalesHistoryView();
    showToast('تم حذف الفاتورة واسترجاع المخزون', 'info');
  },

  async renderCaisseView() {
    const root = document.getElementById('caisse-view-root');
    const [active, sessions] = await Promise.all([
      window.api.getActiveSession(AppState.currentUser.id).catch(() => null),
      window.api.getCaisseSessions().catch(() => [])
    ]);
    AppState.activeSession = active;
    this.updateShiftHeaderBadge();

    const curBal = active && active.summary ? Number(active.summary.currentBalance || 0) : 0;

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-black">إدارة الصندوق والمناوبات (Caisse & Shifts)</h2>
            <p class="text-xs text-slate-500">فتح وإغلاق الورديات وتتبع الإيداعات والمسحوبات النقدية لحظياً</p>
          </div>
          <div class="flex gap-2">
            ${
              !active
                ? `<button onclick="App.openNewShiftPrompt()" class="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">فتح مناوبة جديدة</button>`
                : `
                  <button onclick="App.caisseTxPrompt('cash_in')" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">+ إيداع نقدي</button>
                  <button onclick="App.caisseTxPrompt('cash_out')" class="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold">- سحب نقدي</button>
                  <button onclick="App.closeShiftPrompt(${active.session.id})" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">إغلاق المناوبة الحالية</button>
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
          <div class="p-4 rounded-2xl bg-blue-600 text-white">
            <div class="text-xs opacity-80 font-bold">الرصيد المتوقع في الدرج</div>
            <div class="text-2xl font-black font-mono mt-1">${curBal.toFixed(2)} د.ج</div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
          <h3 class="font-black text-sm mb-3">سجل المناوبات (${sessions.length})</h3>
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">#</th>
                <th class="py-2">المستخدم</th>
                <th class="py-2">الافتتاح</th>
                <th class="py-2">الرصيد الافتتاحي</th>
                <th class="py-2">الرصيد الختامي</th>
                <th class="py-2">الحالة</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${sessions
                .map(
                  (s) => `
                <tr>
                  <td class="py-2 font-mono">#${s.id}</td>
                  <td class="py-2 font-bold">${s.user_name || 'المدير'}</td>
                  <td class="py-2 font-mono">${String(s.opened_at || '').slice(0, 16)}</td>
                  <td class="py-2 font-mono">${Number(s.opening_balance || 0).toFixed(2)}</td>
                  <td class="py-2 font-mono">${s.closing_balance !== null ? Number(s.closing_balance).toFixed(2) : '-'}</td>
                  <td class="py-2">${s.status === 'open' ? '<span class="text-emerald-600 font-bold">مفتوحة</span>' : 'مغلقة'}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async openNewShiftPrompt() {
    const val = prompt('أدخل الرصيد الافتتاحي للصندوق (د.ج):', '0');
    if (val === null) return;
    await window.api.openCaisseSession({ userId: AppState.currentUser.id, openingBalance: parseFloat(val) || 0 });
    await this.renderCaisseView();
    showToast('تم فتح مناوبة الصندوق بنجاح', 'success');
  },

  async caisseTxPrompt(type) {
    const amt = parseFloat(prompt('أدخل المبلغ (د.ج):', '1000'));
    if (!amt || amt <= 0) return;
    const desc = prompt('السبب / البيان:', type === 'cash_in' ? 'إيداع نقدي' : 'سحب نقدي') || '';
    await window.api.addCaisseTransaction({ type, amount: amt, description: desc });
    await this.renderCaisseView();
  },

  async closeShiftPrompt(sessionId) {
    const counted = parseFloat(prompt('أدخل المبلغ الفعلي المعدود في الدرج عند الإغلاق:', '0'));
    if (isNaN(counted)) return;
    await window.api.closeCaisseSession({ sessionId, closingBalance: counted });
    await this.renderCaisseView();
    showToast('تم إغلاق المناوبة وحفظ التقرير', 'info');
  },

  async renderInventoryView() {
    const root = document.getElementById('inventory-view-root');
    const products = (await window.api.getProducts({}).catch(() => [])) || [];
    AppState.products = products;

    root.innerHTML = `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black">إدارة المخزون والدفعات (${products.length} منتج)</h2>
            <p class="text-xs text-slate-500">تتبع الأرصدة، الصلاحية، الأسعار، واستيراد/تصدير ملفات Excel</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="window.api.importProductsFromExcel().then(() => App.renderInventoryView())" class="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">استيراد Excel</button>
            <button onclick="window.api.exportProductsToExcel()" class="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">تصدير Excel</button>
            <button onclick="App.openProductModal()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">+ إضافة منتج جديد</button>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2.5 px-2">الباركود</th>
                <th class="py-2.5 px-2">المنتج</th>
                <th class="py-2.5 px-2">الفئة</th>
                <th class="py-2.5 px-2">سعر الشراء</th>
                <th class="py-2.5 px-2">سعر البيع</th>
                <th class="py-2.5 px-2">الرصيد الكلي</th>
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
                  <td class="py-2 px-2 font-mono font-bold">${p.stock} ${p.unit || ''}</td>
                  <td class="py-2 px-2 flex items-center gap-1.5">
                    <button onclick='App.openProductModal(${JSON.stringify(p).replace(/'/g, "&apos;")})' class="px-2 py-1 bg-blue-500/10 text-blue-600 rounded-lg font-bold">تعديل</button>
                    <button onclick="App.quickAddBatchPrompt(${p.id})" class="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg font-bold">+ دفعة</button>
                    <button onclick="window.api.deleteProduct(${p.id}).then(() => App.renderInventoryView())" class="text-rose-500 p-1"><span class="material-symbols-rounded icon-sm">delete</span></button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async quickAddBatchPrompt(productId) {
    const qty = parseFloat(prompt('أدخل كمية الدفعة الجديدة المراد إضافتها للمخزون:', '10'));
    if (!qty || qty <= 0) return;
    const prod = AppState.products.find((p) => Number(p.id) === Number(productId));
    await window.api.addBatch(productId, {
      stock: qty,
      cost_price: prod ? prod.cost_price : 0,
      selling_price: prod ? prod.selling_price : 0
    });
    await this.renderInventoryView();
    showToast('تمت إضافة الدفعة الجديدة وتسوية أي ديون مخزون معلقة', 'success');
  },

  async renderBundlesAndPromosView() {
    const root = document.getElementById('bundles-view-root');
    const [bundles, promos] = await Promise.all([
      window.api.getBundles().catch(() => []),
      window.api.getPromotions().catch(() => [])
    ]);

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black">الحزم (Packs) والعروض الترويجية</h2>
          <button onclick="App.createPromoPrompt()" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">+ إضافة عرض تخفيض</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">العروض الترويجية النشطة (${promos.length})</h3>
            <div class="space-y-2 text-xs">
              ${promos.map((pr) => `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between"><span>${pr.product_name || ''}</span><span class="font-bold text-rose-500">خصم: ${pr.discount_value} ${pr.discount_type === 'percentage' ? '%' : 'د.ج'}</span></div>`).join('')}
            </div>
          </div>
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">الحزم والباقات (${bundles.length})</h3>
            <div class="space-y-2 text-xs">
              ${bundles.map((b) => `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between"><span class="font-bold">${b.name}</span><span class="font-mono font-bold text-blue-600">${b.selling_price} د.ج</span></div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  },

  async createPromoPrompt() {
    if (AppState.products.length === 0) return;
    const val = parseFloat(prompt('أدخل نسبة الخصم المئوية (%) لأول منتج:', '10'));
    if (!val) return;
    await window.api.savePromotion({
      product_id: AppState.products[0].id,
      discount_type: 'percentage',
      discount_value: val,
      start_date: new Date().toISOString().slice(0, 10)
    });
    await this.renderBundlesAndPromosView();
  },

  async renderPrintStudioView() {
    const root = document.getElementById('print-view-root');
    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-black">مركز الطباعة، ملصقات الباركود، ومصمم القوالب</h2>
            <p class="text-xs text-slate-500">طباعة ملصقات الباركود وأسعار الرفوف وتخصيص قوالب الفواتير</p>
          </div>
          <button onclick="App.printSampleLabel()" class="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
            <span class="material-symbols-rounded icon-sm">qr_code_2</span>
            <span>طباعة ملصق باركود سريع</span>
          </button>
        </div>
        <div id="template-designer-root"></div>
      </div>`;
    if (window.TemplateBuilder) {
      await window.TemplateBuilder.initTemplateBuilder('template-designer-root');
    }
  },

  async printSampleLabel() {
    const prod = AppState.products[0] || { name: 'منتج تجريبي', barcode: '613000001234', selling_price: 250 };
    if (!window.PrintEngine) return;
    const html = await window.PrintEngine.renderBarcodeLabelHtml(
      {
        name: prod.name,
        barcode: prod.barcode || '613000123',
        price: prod.selling_price,
        showPrice: true,
        showName: true,
        showBarcodeText: true
      },
      AppState.settings
    );
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  },

  async renderSuppliersView() {
    const root = document.getElementById('suppliers-view-root');
    const suppliers = (await window.api.getSuppliers().catch(() => [])) || [];
    root.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black">إدارة الموردين وديونهم (${suppliers.length})</h2>
          <button onclick="App.addSupplierPrompt()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">+ إضافة مورد</button>
        </div>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">اسم المورد</th>
                <th class="py-2">الهاتف</th>
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
                  <td class="py-2.5 font-mono">${Number(s.total_purchases || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 font-mono font-bold text-rose-500">${Number(s.total_debt || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5">
                    <button onclick="App.paySupplierPrompt(${s.id})" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold">تسديد دفعة</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async addSupplierPrompt() {
    const name = prompt('اسم المورد الجديد:');
    if (!name) return;
    const phone = prompt('رقم الهاتف:', '') || '';
    await window.api.addSupplier({ name, phone });
    await this.renderSuppliersView();
  },

  async paySupplierPrompt(supplierId) {
    const amt = parseFloat(prompt('أدخل مبلغ الدفعة للمورد (د.ج):', '0'));
    if (!amt || amt <= 0) return;
    await window.api.addSupplierPayment(supplierId, amt);
    await this.renderSuppliersView();
    showToast('تم تسجيل دفعة المورد بنجاح', 'success');
  },

  async renderPurchasesView() {
    const root = document.getElementById('purchases-view-root');
    const purchases = (await window.api.getPurchases().catch(() => [])) || [];
    root.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black">فواتير المشتريات والتموين (${purchases.length})</h2>
        </div>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">رقم الفاتورة</th>
                <th class="py-2">المورد</th>
                <th class="py-2">التاريخ</th>
                <th class="py-2">الإجمالي</th>
                <th class="py-2">المدفوع</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${purchases
                .map(
                  (p) => `
                <tr>
                  <td class="py-2.5 font-mono font-bold">${p.invoice_number || '#' + p.id}</td>
                  <td class="py-2.5 font-bold">${p.supplier_name || 'مورد عام'}</td>
                  <td class="py-2.5 font-mono">${p.date || ''}</td>
                  <td class="py-2.5 font-mono font-bold">${Number(p.total || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 font-mono text-emerald-600">${Number(p.paid_amount || 0).toFixed(2)} د.ج</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async renderCustomersView() {
    const root = document.getElementById('customers-view-root');
    const customers = (await window.api.getCustomers().catch(() => [])) || [];
    AppState.customers = customers;

    root.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black">إدارة الزبائن، نقاط الولاء، والديون (${customers.length})</h2>
          <button onclick="App.openCustomerModal()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">+ زبون جديد</button>
        </div>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">الزبون</th>
                <th class="py-2">الهاتف</th>
                <th class="py-2">نقاط الولاء</th>
                <th class="py-2">إجمالي المشتريات</th>
                <th class="py-2">الدين الحالي</th>
                <th class="py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${customers
                .map(
                  (c) => `
                <tr>
                  <td class="py-2.5 font-bold">${c.name}</td>
                  <td class="py-2.5 font-mono">${c.phone || '-'}</td>
                  <td class="py-2.5 font-mono text-amber-500 font-bold">⭐ ${c.loyalty_points || 0}</td>
                  <td class="py-2.5 font-mono">${Number(c.total_sales || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 font-mono font-bold text-rose-500">${Number(c.total_debt || 0).toFixed(2)} د.ج</td>
                  <td class="py-2.5 flex items-center gap-1.5">
                    <button onclick="App.payCustomerDebtPrompt(${c.id})" class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold">تسديد دين</button>
                    <button onclick="App.sendWhatsAppReminder('${c.phone || ''}', '${c.name}', ${Number(c.total_debt || 0)})" class="px-2.5 py-1 bg-green-600/15 text-green-600 rounded-lg font-bold">WhatsApp</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async payCustomerDebtPrompt(customerId) {
    const amt = parseFloat(prompt('أدخل المبلغ المستلم من الزبون لتسديد دينه (د.ج):', '0'));
    if (!amt || amt <= 0) return;
    await window.api.addCustomerPayment(customerId, amt);
    await this.renderCustomersView();
    showToast('تم تسديد دفعة الزبون وتوزيعها بـ FIFO بنجاح', 'success');
  },

  sendWhatsAppReminder(phone, name, debt) {
    if (!phone) {
      showToast('لا يوجد رقم هاتف مسجل لهذا الزبون', 'warning');
      return;
    }
    const cleanPhone = phone.replace(/^0/, '213').replace(/\D/g, '');
    const text = encodeURIComponent(`مرحباً سيد ${name}، نذكركم بأن رصيدكم المستحق لدى ${AppState.settings.shop_name || 'Gherbi.Ai POS'} هو ${debt.toFixed(2)} د.ج. شكراً لتعاملكم معنا.`);
    window.api.openExternalLink(`https://wa.me/${cleanPhone}?text=${text}`);
  },

  async renderProformasView() {
    const root = document.getElementById('proformas-view-root');
    const list = (await window.api.getProformas().catch(() => [])) || [];
    root.innerHTML = `
      <div class="space-y-4">
        <h2 class="text-2xl font-black">الفواتير الشكلية / المبدئية (${list.length})</h2>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">الرقم</th>
                <th class="py-2">الزبون</th>
                <th class="py-2">الإجمالي</th>
                <th class="py-2">الحالة</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${list.map((pf) => `<tr><td class="py-2 font-mono font-bold">${pf.doc_number}</td><td class="py-2">${pf.customer_name || 'زبون عابر'}</td><td class="py-2 font-mono font-bold">${Number(pf.total || 0).toFixed(2)} د.ج</td><td class="py-2">${pf.status}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async renderOrdersView() {
    const root = document.getElementById('orders-view-root');
    const orders = (await window.api.getOrders().catch(() => [])) || [];
    root.innerHTML = `
      <div class="space-y-4">
        <h2 class="text-2xl font-black">طلبيات الزبائن (Bons de Commande) (${orders.length})</h2>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">الرقم</th>
                <th class="py-2">الزبون</th>
                <th class="py-2">الإجمالي</th>
                <th class="py-2">العربون المدفوع</th>
                <th class="py-2">الحالة</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${orders.map((o) => `<tr><td class="py-2 font-mono font-bold">${o.doc_number}</td><td class="py-2">${o.customer_name || 'زبون'}</td><td class="py-2 font-mono">${Number(o.total || 0).toFixed(2)}</td><td class="py-2 font-mono text-emerald-600">${Number(o.deposit_amount || 0).toFixed(2)}</td><td class="py-2">${o.status}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async renderExpensesAndCapitalView() {
    const root = document.getElementById('expenses-view-root');
    const [expenses, capital] = await Promise.all([
      window.api.getExpenses().catch(() => []),
      window.api.getCapital().catch(() => [])
    ]);

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black">المصاريف التشغيلية وإيداعات رأس المال</h2>
          <div class="flex gap-2">
            <button onclick="App.addExpensePrompt()" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">+ تسجيل مصروف</button>
            <button onclick="App.addCapitalPrompt()" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">+ إيداع رأس مال</button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 class="font-black text-sm mb-3">سجل المصاريف (${expenses.length})</h3>
            <div class="space-y-2 text-xs">
              ${expenses.map((e) => `<div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between"><span>${e.category} — ${e.description || ''}</span><span class="font-mono font-bold text-rose-500">${Number(e.amount).toFixed(2)} د.ج</span></div>`).join('')}
            </div>
          </div>
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 class="font-black text-sm mb-3">حركات رأس المال (${capital.length})</h3>
            <div class="space-y-2 text-xs">
              ${capital.map((c) => `<div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between"><span>${c.category} — ${c.description || ''}</span><span class="font-mono font-bold text-emerald-600">${Number(c.amount).toFixed(2)} د.ج</span></div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  },

  async addExpensePrompt() {
    const amt = parseFloat(prompt('أدخل قيمة المصروف (د.ج):', '0'));
    if (!amt || amt <= 0) return;
    const cat = prompt('فئة المصروف (كراء، كهرباء، رواتب، نقل...):', 'عام') || 'عام';
    await window.api.addExpense({ category: cat, amount: amt, deductFromCaisse: true });
    await this.renderExpensesAndCapitalView();
  },

  async addCapitalPrompt() {
    const amt = parseFloat(prompt('أدخل مبلغ رأس المال المودع (د.ج):', '0'));
    if (!amt || amt <= 0) return;
    await window.api.addCapital({ category: 'إيداع شريك', amount: amt });
    await this.renderExpensesAndCapitalView();
  },

  async renderAnalyticsView() {
    const root = document.getElementById('analytics-view-root');
    const data = (await window.api.getAnalytics({}).catch(() => ({}))) || {};

    root.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl font-black">مركز القيادة، التحليلات المالية، وحاسبة الزكاة الشرعية</h2>
          <p class="text-xs text-slate-500">تحليل الإيرادات، تكلفة البضاعة المباعة (COGS)، صافي الربح، وأعمار الديون</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">صافي الإيرادات</div>
            <div class="text-2xl font-black font-mono text-blue-600 mt-1">${Number(data.net_revenue || 0).toFixed(2)} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">تكلفة البضاعة المباعة (COGS)</div>
            <div class="text-2xl font-black font-mono text-amber-500 mt-1">${Number(data.cogs || 0).toFixed(2)} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div class="text-xs text-slate-400 font-bold">صافي الربح النهائي</div>
            <div class="text-2xl font-black font-mono text-emerald-600 mt-1">${Number(data.net_profit || 0).toFixed(2)} د.ج</div>
          </div>
          <div class="p-4 rounded-2xl bg-emerald-900 text-white">
            <div class="text-xs opacity-80 font-bold">مقدار الزكاة الشرعية (2.5%)</div>
            <div class="text-2xl font-black font-mono mt-1">${Number(data.zakat?.amount || 0).toFixed(2)} د.ج</div>
            <div class="text-[10px] opacity-75">وعاء الزكاة: ${Number(data.zakat?.pool || 0).toFixed(2)} د.ج</div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">أفضل المنتجات ربحية ومبيعاً</h3>
            <div class="space-y-2 text-xs">
              ${(data.topProducts || [])
                .slice(0, 8)
                .map(
                  (tp) => `
                <div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                  <span class="font-bold">${tp.name} (${tp.qty_sold})</span>
                  <span class="font-mono font-bold text-emerald-600">ربح: ${Number(tp.profit || 0).toFixed(2)} د.ج</span>
                </div>`
                )
                .join('')}
            </div>
          </div>

          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h3 class="font-black text-sm mb-3">تقييم المخزون وأعمار الديون</h3>
            <div class="space-y-2 text-xs">
              <div class="flex justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                <span>قيمة المخزون بسعر التكلفة:</span>
                <span class="font-mono font-bold">${Number(data.inventory?.cost_value || 0).toFixed(2)} د.ج</span>
              </div>
              <div class="flex justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                <span>قيمة المخزون بسعر البيع:</span>
                <span class="font-mono font-bold text-blue-600">${Number(data.inventory?.sell_value || 0).toFixed(2)} د.ج</span>
              </div>
              <div class="flex justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                <span>إجمالي ديون الزبائن:</span>
                <span class="font-mono font-bold text-rose-500">${Number(data.totalCustomerDebt || 0).toFixed(2)} د.ج</span>
              </div>
              <div class="flex justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                <span>إجمالي ديون الموردين:</span>
                <span class="font-mono font-bold text-amber-500">${Number(data.totalSupplierDebt || 0).toFixed(2)} د.ج</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  },

  async renderCopilotView() {
    const root = document.getElementById('copilot-view-root');
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
                        (r) => `
                    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between">
                      <div>
                        <div class="font-bold">${r.name}</div>
                        <div class="text-[10px] text-slate-400">معدل البيع اليومي: ${r.daily_velocity}</div>
                      </div>
                      <span class="font-mono font-bold text-rose-500">يكفي ${r.days_of_supply} يوم</span>
                    </div>`
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
                        (d) => `
                    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex justify-between">
                      <span class="font-bold">${d.name} (الرصيد: ${d.stock_qty})</span>
                      <span class="font-mono font-bold text-amber-500">رأس مال مجمد: ${Number(d.tied_capital || 0).toFixed(2)} د.ج</span>
                    </div>`
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>`;
  },

  async renderUsersView() {
    const root = document.getElementById('users-view-root');
    const users = (await window.api.getUsers().catch(() => [])) || [];
    root.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black">إدارة المستخدمين والصلاحيات (${users.length})</h2>
          <button onclick="App.addUserPrompt()" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">+ إضافة مستخدم</button>
        </div>
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <table class="w-full text-xs text-right">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th class="py-2">الاسم</th>
                <th class="py-2">اسم الدخول</th>
                <th class="py-2">الدور</th>
                <th class="py-2">الحالة</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
              ${users.map((u) => `<tr><td class="py-2.5 font-bold">${u.name}</td><td class="py-2.5 font-mono">${u.username}</td><td class="py-2.5">${u.role}</td><td class="py-2.5 text-emerald-600 font-bold">${u.status}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async addUserPrompt() {
    const name = prompt('اسم الموظف / الكاشير:');
    if (!name) return;
    const username = prompt('اسم المستخدم للدخول:', name);
    const password = prompt('كلمة المرور:', '1234') || '1234';
    await window.api.addUser({ name, username, password, role: 'Cashier' });
    await this.renderUsersView();
  },

  async renderSettingsView() {
    const root = document.getElementById('settings-view-root');
    const [settings, localIp, qrDataUrl] = await Promise.all([
      window.api.getSettings().catch(() => ({})),
      window.api.getLocalIp().catch(() => '127.0.0.1'),
      window.api.pairingQrDataUrl().catch(() => '')
    ]);
    AppState.settings = settings;

    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black">إعدادات المتجر، الشبكة المحلية، والنسخ الاحتياطي</h2>
          <div class="flex gap-2">
            <button onclick="window.api.exportDatabaseBackup()" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">حفظ نسخة احتياطية (ZIP)</button>
            <button onclick="window.api.importDatabaseBackup()" class="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold">استعادة نسخة احتياطية</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="md:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 text-xs">
            <h3 class="font-black text-sm">معلومات المتجر والبيانات الجبائية (تظهر في الفواتير)</h3>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block font-bold mb-1">اسم المتجر / المؤسسة</label><input id="set-shop-name" value="${settings.shop_name || ''}" class="w-full px-3 py-2 rounded-xl font-bold"></div>
              <div><label class="block font-bold mb-1">النشاط / الوصف</label><input id="set-shop-desc" value="${settings.shop_description || ''}" class="w-full px-3 py-2 rounded-xl"></div>
              <div><label class="block font-bold mb-1">العنوان</label><input id="set-shop-addr" value="${settings.shop_address || ''}" class="w-full px-3 py-2 rounded-xl"></div>
              <div><label class="block font-bold mb-1">رقم الهاتف</label><input id="set-shop-phone" value="${settings.shop_phone || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
              <div><label class="block font-bold mb-1">السجل التجاري (RC)</label><input id="set-shop-rc" value="${settings.shop_rc || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
              <div><label class="block font-bold mb-1">الرقم الجبائي (NIF)</label><input id="set-shop-nif" value="${settings.shop_nif || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
              <div><label class="block font-bold mb-1">مادة الضريبة (AI)</label><input id="set-shop-ai" value="${settings.shop_ai || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
              <div><label class="block font-bold mb-1">الرقم الإحصائي (NIS)</label><input id="set-shop-nis" value="${settings.shop_nis || ''}" class="w-full px-3 py-2 rounded-xl font-mono"></div>
            </div>
            <button onclick="App.saveSettingsForm()" class="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold">حفظ الإعدادات</button>
          </div>

          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-center space-y-3">
            <h3 class="font-black text-sm">الشبكة المحلية واقتران الهاتف</h3>
            <div class="text-xs text-slate-400">عنوان الخادم المحلي: <strong class="font-mono text-blue-500">http://${localIp}:8080</strong></div>
            ${qrDataUrl ? `<img src="${qrDataUrl}" class="w-44 h-44 mx-auto rounded-xl border border-slate-200 p-2 bg-white">` : ''}
            <p class="text-[11px] text-slate-400">امسح الرمز لربط تطبيق الهاتف أو الكاشير الفرعي على نفس شبكة Wi-Fi</p>
          </div>
        </div>
      </div>`;
  },

  async saveSettingsForm() {
    const updated = {
      shop_name: document.getElementById('set-shop-name').value.trim(),
      shop_description: document.getElementById('set-shop-desc').value.trim(),
      shop_address: document.getElementById('set-shop-addr').value.trim(),
      shop_phone: document.getElementById('set-shop-phone').value.trim(),
      shop_rc: document.getElementById('set-shop-rc').value.trim(),
      shop_nif: document.getElementById('set-shop-nif').value.trim(),
      shop_ai: document.getElementById('set-shop-ai').value.trim(),
      shop_nis: document.getElementById('set-shop-nis').value.trim()
    };
    await window.api.updateSettings(updated);
    AppState.settings = { ...AppState.settings, ...updated };
    showToast('تم حفظ إعدادات المتجر بنجاح', 'success');
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());