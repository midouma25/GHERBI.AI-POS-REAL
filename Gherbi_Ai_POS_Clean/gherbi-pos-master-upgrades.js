/**
 * gherbi-pos-master-upgrades.js
 * المحرك الجراحي الشامل للتعديلات الـ 12 والإضافات الاستشارية لنظام Gherbi.Ai POS
 */

'use strict';

window.GherbiMasterUpgrades = {
  activeMultiplier: 1,
  returnModeActive: false,
  selectedCartRowIndex: 0,
  pointsConversionRate: 2.0, // 1 نقطة = 2.00 د.ج (كما في 8 نقاط = 16.00 د.ج)
  cashReceivedAmount: 0,
  discountDrawerOpen: false,

  init() {
    this.injectModalsAndAuditContainers();
    this.setupResizableSplitPane();
    this.setupTopNavSwitcher();
    this.reorganizeCartTopHeader();
    this.setupCompactCustomerAndLoyaltyBar();
    this.compactDiscountAndCouponSection();
    this.wireMultiplierButtons();
    this.wireReturnModeButton();
    this.relabelPriceCheckerAndShiftShortcuts();
    this.optimizeRetailCustomerModal();
    this.hookIntoAppEngine();
    this.bindMasterKeyboardShortcuts();

    setTimeout(() => {
      this.refreshAllEnhancements();
    }, 500);
  },

  // ==========================================================================
  // 1. فاصل السحب الديناميكي (Smooth Resizable Split-Pane)
  // ==========================================================================
  setupResizableSplitPane() {
    const posLayout = document.querySelector('#view-pos .pos-layout');
    const cartContainer = document.querySelector('#view-pos .cart-container');
    if (!posLayout || !cartContainer) return;

    // استرجاع العرض المحفوظ
    const savedWidth = localStorage.getItem('gherbi_pos_cart_width');
    if (savedWidth) {
      document.documentElement.style.setProperty('--gherbi-cart-width', savedWidth + 'px');
    }

    if (document.getElementById('gherbiPosResizer')) return;

    const resizer = document.createElement('div');
    resizer.id = 'gherbiPosResizer';
    resizer.className = 'gherbi-split-resizer';
    resizer.title = 'اسحب لتكبير أو تصغير شاشة السلة (انقر مرتين لإعادة الحجم القياسي)';

    posLayout.insertBefore(resizer, cartContainer);

    let isDragging = false;

    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      resizer.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const layoutRect = posLayout.getBoundingClientRect();
      // في واجهة RTL، السلة تقع في أقصى اليسار، لذا عرضها يساوي المسافة من يسار الشاشة إلى موقع المؤشر
      const isRtl = getComputedStyle(posLayout).direction === 'rtl';
      let newWidth = isRtl
        ? (e.clientX - layoutRect.left)
        : (layoutRect.right - e.clientX);

      const minW = 340;
      const maxW = Math.floor(window.innerWidth * 0.65);
      newWidth = Math.max(minW, Math.min(maxW, newWidth));

      requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--gherbi-cart-width', newWidth + 'px');
      });
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      resizer.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const currentW = parseInt(getComputedStyle(cartContainer).width, 10);
      if (currentW) {
        localStorage.setItem('gherbi_pos_cart_width', String(currentW));
      }
    });

    // النقر المزدوج لإعادة الضبط القياسي
    resizer.addEventListener('dblclick', () => {
      document.documentElement.style.setProperty('--gherbi-cart-width', '460px');
      localStorage.setItem('gherbi_pos_cart_width', '460');
    });
  },

  // ==========================================================================
  // 2. إعادة هندسة شريط السلات المتعددة (سلة #1 ✕ | + سلة Ctrl+N | سجل)
  // ==========================================================================
  reorganizeCartTopHeader() {
    const cartContainer = document.querySelector('#view-pos .cart-container');
    if (!cartContainer) return;

    // البحث عن حاوية التبويبات الأصلية #multiCartTabs
    const multiTabs = document.getElementById('multiCartTabs');
    if (!multiTabs) return;

    const parentRow = multiTabs.parentElement;
    if (parentRow && !parentRow.classList.contains('gherbi-compact-tabs-bar')) {
      parentRow.className = 'gherbi-compact-tabs-bar';
      parentRow.innerHTML = `
        <div id="multiCartTabs" class="flex items-center gap-1 overflow-x-auto flex-1 py-0.5"></div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" onclick="GherbiMasterUpgrades.createNewCartWithShortcut()"
            class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black flex items-center gap-1 shadow-sm"
            title="إضافة سلة جديدة (Ctrl+N)">
            <span>+ سلة</span>
            <kbd class="text-[9.5px] bg-blue-800/80 px-1 rounded font-mono">Ctrl+N</kbd>
          </button>
          <button type="button" onclick="GherbiMasterUpgrades.openCartHistoryOrSales()"
            class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1"
            title="سجل الفواتير والعمليات">
            <span>🕒 سجل</span>
          </button>
          <button type="button" onclick="GherbiMasterUpgrades.clearCartHistoryLog()"
            class="px-1.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 text-[11px] font-black"
            title="حذف/تصفير السجل المؤقت">
            ✕
          </button>
        </div>
      `;
    }

    this.renderEnhancedCartTabs();
  },

  renderEnhancedCartTabs() {
    const multiTabs = document.getElementById('multiCartTabs');
    if (!multiTabs || !window.App) return;

    const carts = Array.isArray(window.App.carts) ? window.App.carts : [];
    const activeIdx = Number(window.App.activeCartIndex || 0);

    if (!carts.length) return;

    multiTabs.innerHTML = carts.map((c, idx) => {
      const itemsCount = Array.isArray(c.items) ? c.items.length : 0;
      const isActive = idx === activeIdx;
      return `
        <div onclick="GherbiMasterUpgrades.switchCartTab(${idx})"
             class="gherbi-cart-tab-pill ${isActive ? 'active' : ''}">
          <span>سلة #${idx + 1} (${itemsCount})</span>
          <span onclick="event.stopPropagation(); GherbiMasterUpgrades.removeOrClearCartTab(${idx})"
                class="gherbi-cart-tab-close" title="حذف / إغلاق هذه السلة">✕</span>
        </div>
      `;
    }).join('');
  },

  switchCartTab(idx) {
    if (!window.App) return;
    if (typeof window.App.switchCartTab === 'function') {
      window.App.switchCartTab(idx);
    } else {
      window.App.activeCartIndex = idx;
      if (typeof window.App.renderPosView === 'function') window.App.renderPosView();
    }
    this.refreshAllEnhancements();
  },

  createNewCartWithShortcut() {
    if (!window.App) return;
    if (typeof window.App.newCartTab === 'function') {
      window.App.newCartTab();
    } else if (Array.isArray(window.App.carts)) {
      window.App.carts.push({ items: [], customerId: '', discount: 0, priceTier: 'retail' });
      window.App.activeCartIndex = window.App.carts.length - 1;
    }
    this.refreshAllEnhancements();
  },

  removeOrClearCartTab(idx) {
    if (!window.App || !Array.isArray(window.App.carts)) return;
    const targetCart = window.App.carts[idx];
    const hasItems = targetCart && Array.isArray(targetCart.items) && targetCart.items.length > 0;

    if (hasItems && !confirm(`السلة #${idx + 1} تحتوي على (${targetCart.items.length}) أصناف. هل تريد حذفها؟`)) {
      return;
    }

    if (window.App.carts.length <= 1) {
      // إذا كانت السلة الوحيدة، نقوم بتفريغها
      window.App.carts[0].items = [];
      if (Array.isArray(window.App.cart)) window.App.cart.length = 0;
      if (typeof window.App.clearCurrentCart === 'function') window.App.clearCurrentCart();
    } else if (typeof window.App.closeCartTab === 'function') {
      window.App.closeCartTab(idx);
    } else {
      window.App.carts.splice(idx, 1);
      if (window.App.activeCartIndex >= window.App.carts.length) {
        window.App.activeCartIndex = Math.max(0, window.App.carts.length - 1);
      }
    }
    this.refreshAllEnhancements();
  },

  openCartHistoryOrSales() {
    if (window.App && typeof window.App.openDraftsModal === 'function') {
      window.App.openDraftsModal();
    } else if (window.App && typeof window.App.switchView === 'function') {
      window.App.switchView('sales');
    }
  },

  clearCartHistoryLog() {
    if (confirm('هل تريد مسح سجل السلات الفارغة وتصفير السلة الحالية؟')) {
      if (window.App && Array.isArray(window.App.carts)) {
        window.App.carts = [{ items: [], customerId: '', discount: 0, priceTier: 'retail' }];
        window.App.activeCartIndex = 0;
      }
      if (window.App && typeof window.App.clearCurrentCart === 'function') {
        window.App.clearCurrentCart();
      }
      this.refreshAllEnhancements();
    }
  },

  // ==========================================================================
  // 3. الزر الشريطي الذكي للزبون ونافذة الوفاء الفورية (F8 / F9)
  // ==========================================================================
  setupCompactCustomerAndLoyaltyBar() {
    const cartContainer = document.querySelector('#view-pos .cart-container');
    if (!cartContainer) return;

    // إخفاء الصناديق البيضاء والصفراء الكبيرة القديمة التي تستهلك مساحة السلة
    Array.from(cartContainer.querySelectorAll('div, p, span')).forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (
        (txt.includes('البيع الحالي: زبون عابر') || txt.includes('رصيد نقاط الولاء الحالي') || txt.includes('عضو نادي الوفاء')) &&
        el.tagName === 'DIV' &&
        !el.contains(document.getElementById('posCartItems')) &&
        !el.classList.contains('cart-container')
      ) {
        if (el.offsetHeight < 220 && !el.querySelector('#posCustomerSelect')) {
          el.classList.add('gherbi-hide-legacy-loyalty-box');
        }
      }
    });

    if (document.getElementById('gherbiSmartCustomerBar')) return;

    const custSelect = document.getElementById('posCustomerSelect');
    const bar = document.createElement('div');
    bar.id = 'gherbiSmartCustomerBar';
    bar.className = 'gherbi-customer-smart-bar';
    bar.innerHTML = `
      <button type="button" onclick="GherbiMasterUpgrades.openSmartLoyaltyModal('f8')"
        class="gherbi-customer-trigger-btn" title="اضغط هنا أو F8 لاختيار الزبون ومسح بطاقة الوفاء، أو F9 لاختزال النقاط">
        <div class="flex items-center gap-2 min-w-0">
          <span id="gherbiSmartCustIcon" class="text-base">👤</span>
          <div class="truncate">
            <div id="gherbiSmartCustName" class="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
              زبون عابر (بدون بطاقة وفاء)
            </div>
            <div id="gherbiSmartCustSub" class="text-[10px] font-bold text-amber-600 dark:text-amber-400">
              اضغط F8 لمسح بطاقة الوفاء (FID) أو البحث | F9 لخصم النقاط
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <span id="gherbiSmartCustPointsPill" class="hidden px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-black text-[10.5px]">
            0 نقطة
          </span>
          <span class="px-2 py-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black text-[10.5px]">
            👑 الوفاء (F8/F9)
          </span>
        </div>
      </button>

      <button type="button" onclick="App.openCustomerModal()"
        class="p-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600 text-emerald-600 hover:text-white transition shrink-0"
        title="إضافة زبون تجزئة جديد">
        <span class="material-symbols-rounded icon-sm">person_add</span>
      </button>
    `;

    // وضع الشريط الذكي في أعلى السلة وتخبئة الـ select القديم دون حذفه من الـ DOM
    if (custSelect) {
      const selectRow = custSelect.closest('.flex') || custSelect.parentElement;
      if (selectRow && !selectRow.contains(document.getElementById('posCartItems'))) {
        selectRow.style.display = 'none';
        selectRow.parentNode.insertBefore(bar, selectRow);
      } else {
        cartContainer.insertBefore(bar, cartContainer.firstChild.nextSibling);
      }
      custSelect.addEventListener('change', () => this.syncSmartCustomerBar());
    } else {
      cartContainer.insertBefore(bar, cartContainer.firstChild);
    }
  },

  syncSmartCustomerBar() {
    const custSelect = document.getElementById('posCustomerSelect');
    const nameEl = document.getElementById('gherbiSmartCustName');
    const subEl = document.getElementById('gherbiSmartCustSub');
    const iconEl = document.getElementById('gherbiSmartCustIcon');
    const pillEl = document.getElementById('gherbiSmartCustPointsPill');
    if (!nameEl) return;

    const cid = custSelect ? custSelect.value : '';
    const customers = (window.App && Array.isArray(window.App.customers)) ? window.App.customers : [];
    const cust = customers.find((c) => String(c.id) === String(cid));

    if (!cust) {
      if (iconEl) iconEl.textContent = '👤';
      nameEl.textContent = 'زبون عابر (بدون بطاقة وفاء)';
      if (subEl) subEl.textContent = 'اضغط F8 لمسح بطاقة الوفاء (FID) أو البحث | F9 لخصم النقاط';
      pillEl?.classList.add('hidden');
    } else {
      const pts = Number(cust.loyalty_points || 0);
      const dzdVal = (pts * this.pointsConversionRate).toFixed(2);
      const fidCode = cust.loyalty_card || cust.barcode || ('FID-' + String(cust.id).padStart(5, '0'));
      if (iconEl) iconEl.textContent = '👑';
      nameEl.textContent = `${cust.name} (${fidCode})`;
      if (subEl) subEl.textContent = `الرصيد: ${pts} نقطة = ${dzdVal} د.ج | الهاتف: ${cust.phone || '—'}`;
      if (pillEl) {
        pillEl.textContent = `⭐ ${pts} نقطة (${dzdVal} د.ج)`;
        pillEl.classList.remove('hidden');
      }
    }
  },

  openSmartLoyaltyModal(focusTarget = 'f8') {
    const modal = document.getElementById('gherbiSmartLoyaltyModal');
    if (!modal) return;
    modal.classList.add('active');

    this.renderSmartLoyaltyCustomerList('');
    this.updateSmartLoyaltyRedeemPreview();

    setTimeout(() => {
      if (focusTarget === 'f9') {
        const ptsInput = document.getElementById('gherbiLoyaltyRedeemPtsInput');
        if (ptsInput) {
          ptsInput.focus();
          ptsInput.select();
        }
      } else {
        const scanInput = document.getElementById('gherbiLoyaltyBarcodeOrSearchInput');
        if (scanInput) {
          scanInput.value = '';
          scanInput.focus();
        }
      }
    }, 60);
  },

  closeSmartLoyaltyModal() {
    document.getElementById('gherbiSmartLoyaltyModal')?.classList.remove('active');
  },

  onLoyaltyScanOrSearch(val) {
    const clean = String(val || '').trim();
    const customers = (window.App && Array.isArray(window.App.customers)) ? window.App.customers : [];

    // إذا مرر البائع باركود البطاقة (FID-00003 مثلاً)، يتم اختيار الزبون تلقائياً
    const exactMatch = customers.find((c) => {
      const fid = String(c.loyalty_card || c.barcode || ('FID-' + String(c.id).padStart(5, '0'))).toLowerCase();
      return fid === clean.toLowerCase() || String(c.phone || '') === clean;
    });

    if (exactMatch && clean.length >= 4) {
      this.selectCustomerInModal(exactMatch.id, false);
    }

    this.renderSmartLoyaltyCustomerList(clean);
  },

  renderSmartLoyaltyCustomerList(query = '') {
    const tbody = document.getElementById('gherbiSmartLoyaltyCustomerTbody');
    if (!tbody) return;

    const customers = (window.App && Array.isArray(window.App.customers)) ? window.App.customers : [];
    const q = String(query || '').trim().toLowerCase();
    const currentId = document.getElementById('posCustomerSelect')?.value || '';

    const filtered = customers.filter((c) => {
      if (!q) return true;
      const fid = ('FID-' + String(c.id).padStart(5, '0')).toLowerCase();
      return (
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.phone || '').toLowerCase().includes(q) ||
        String(c.loyalty_card || '').toLowerCase().includes(q) ||
        fid.includes(q)
      );
    });

    const walkInRow = `
      <tr onclick="GherbiMasterUpgrades.selectCustomerInModal('', true)"
          class="border-b border-slate-200 dark:border-slate-700 hover:bg-blue-600/10 cursor-pointer ${!currentId ? 'bg-blue-600/15 font-black' : ''}">
        <td class="py-2 px-3">👤 زبون عابر (بدون بطاقة وفاء)</td>
        <td class="py-2 px-3 font-mono text-center">—</td>
        <td class="py-2 px-3 font-mono text-center">—</td>
        <td class="py-2 px-3 font-mono text-center">0</td>
        <td class="py-2 px-3 font-mono text-center">0.00 د.ج</td>
      </tr>
    `;

    tbody.innerHTML = walkInRow + filtered.slice(0, 100).map((c) => {
      const fid = c.loyalty_card || ('FID-' + String(c.id).padStart(5, '0'));
      const pts = Number(c.loyalty_points || 0);
      const dzd = (pts * this.pointsConversionRate).toFixed(2);
      const isSel = String(c.id) === String(currentId);
      return `
        <tr onclick="GherbiMasterUpgrades.selectCustomerInModal('${c.id}', false)"
            ondblclick="GherbiMasterUpgrades.selectCustomerInModal('${c.id}', true)"
            class="border-b border-slate-200 dark:border-slate-700 hover:bg-amber-500/15 cursor-pointer ${isSel ? 'bg-amber-500/20 font-black' : 'font-bold'}">
          <td class="py-2 px-3">👑 ${c.name || ''}</td>
          <td class="py-2 px-3 font-mono text-center text-blue-600 dark:text-blue-400">${fid}</td>
          <td class="py-2 px-3 font-mono text-center">${c.phone || '—'}</td>
          <td class="py-2 px-3 font-mono text-center text-amber-600 font-black">⭐ ${pts}</td>
          <td class="py-2 px-3 font-mono text-center text-emerald-600 font-black">${dzd} د.ج</td>
        </tr>
      `;
    }).join('');
  },

  selectCustomerInModal(custId, closeImmediately = false) {
    const sel = document.getElementById('posCustomerSelect');
    if (sel) {
      sel.value = String(custId || '');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (window.App && Array.isArray(window.App.carts) && window.App.carts[window.App.activeCartIndex || 0]) {
      window.App.carts[window.App.activeCartIndex || 0].customerId = custId || '';
    }
    this.syncSmartCustomerBar();
    this.renderSmartLoyaltyCustomerList(document.getElementById('gherbiLoyaltyBarcodeOrSearchInput')?.value || '');
    this.updateSmartLoyaltyRedeemPreview();

    if (closeImmediately) {
      this.closeSmartLoyaltyModal();
    }
  },

  updateSmartLoyaltyRedeemPreview() {
    const sel = document.getElementById('posCustomerSelect');
    const cid = sel ? sel.value : '';
    const customers = (window.App && Array.isArray(window.App.customers)) ? window.App.customers : [];
    const cust = customers.find((c) => String(c.id) === String(cid));

    const availPts = cust ? Number(cust.loyalty_points || 0) : 0;
    const availDzd = (availPts * this.pointsConversionRate).toFixed(2);
    const availCentimes = Math.round(availPts * this.pointsConversionRate * 100).toLocaleString('fr-DZ');

    const nameBox = document.getElementById('gherbiModalSelectedCustTitle');
    const availBox = document.getElementById('gherbiModalAvailablePointsText');
    const redeemInput = document.getElementById('gherbiLoyaltyRedeemPtsInput');
    const eqDzdBox = document.getElementById('gherbiLoyaltyRedeemDzdEquivalent');

    if (nameBox) {
      nameBox.textContent = cust
        ? `👑 ${cust.name} (FID-${String(cust.id).padStart(5, '0')})`
        : '👤 زبون عابر (يرجى اختيار زبون وفي لتفعيل النقاط)';
    }
    if (availBox) {
      availBox.textContent = `${availPts} نقطة = ${availDzd} د.ج (${availCentimes} سنتيم)`;
    }

    const typedPts = Math.max(0, Math.min(availPts, parseFloat(redeemInput?.value || '0') || 0));
    const eqDzd = (typedPts * this.pointsConversionRate).toFixed(2);
    const eqCent = Math.round(typedPts * this.pointsConversionRate * 100).toLocaleString('fr-DZ');

    if (eqDzdBox) {
      eqDzdBox.textContent = `= ${eqDzd} د.ج (${eqCent} سنتيم)`;
    }
  },

  redeemAllAvailablePoints() {
    const sel = document.getElementById('posCustomerSelect');
    const cid = sel ? sel.value : '';
    const customers = (window.App && Array.isArray(window.App.customers)) ? window.App.customers : [];
    const cust = customers.find((c) => String(c.id) === String(cid));
    if (!cust || Number(cust.loyalty_points || 0) <= 0) {
      alert('⚠️ هذا الزبون لا يملك نقاط ولاء متاحة حالياً.');
      return;
    }
    const redeemInput = document.getElementById('gherbiLoyaltyRedeemPtsInput');
    if (redeemInput) {
      redeemInput.value = Number(cust.loyalty_points || 0);
      this.updateSmartLoyaltyRedeemPreview();
      this.confirmLoyaltyModalAndApply();
    }
  },

  confirmLoyaltyModalAndApply() {
    const sel = document.getElementById('posCustomerSelect');
    const cid = sel ? sel.value : '';
    const customers = (window.App && Array.isArray(window.App.customers)) ? window.App.customers : [];
    const cust = customers.find((c) => String(c.id) === String(cid));

    const redeemInput = document.getElementById('gherbiLoyaltyRedeemPtsInput');
    const ptsToRedeem = Math.max(0, parseFloat(redeemInput?.value || '0') || 0);

    if (cust && ptsToRedeem > 0) {
      const maxPts = Number(cust.loyalty_points || 0);
      const validPts = Math.min(maxPts, ptsToRedeem);
      const discountDzd = Number((validPts * this.pointsConversionRate).toFixed(2));

      const discInput = document.getElementById('cartDiscountInput');
      if (discInput) {
        discInput.value = discountDzd;
        discInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.App && typeof window.App.recalcCart === 'function') {
        window.App.recalcCart();
      }
    }

    this.syncSmartCustomerBar();
    this.closeSmartLoyaltyModal();
  },

  // ==========================================================================
  // 4. ضغط قسم الكوبون والتخفيض لتعظيم مساحة المشتريات + حاسبة الصرف السريعة
  // ==========================================================================
  compactDiscountAndCouponSection() {
    const discInput = document.getElementById('cartDiscountInput');
    if (!discInput || document.getElementById('gherbiCompactFinanceControls')) return;

    const summaryFooter = discInput.closest('.border-t') || discInput.parentElement?.parentElement;
    if (!summaryFooter) return;

    // إضافة شريط مدمج يجمع (+ كوبون/خصم) وحاسبة الصرف السريعة (200 / 500 / 1000 / 2000 د.ج)
    const controlsWrap = document.createElement('div');
    controlsWrap.id = 'gherbiCompactFinanceControls';
    controlsWrap.className = 'space-y-1.5 mb-1';
    controlsWrap.innerHTML = `
      <div class="gherbi-quick-change-strip">
        <div class="flex items-center gap-1 flex-wrap">
          <span class="font-black text-emerald-800 dark:text-emerald-300 text-[10.5px]">💵 صرف سريع:</span>
          <button type="button" onclick="GherbiMasterUpgrades.calcQuickChange(200)" class="gherbi-banknote-btn">200</button>
          <button type="button" onclick="GherbiMasterUpgrades.calcQuickChange(500)" class="gherbi-banknote-btn">500</button>
          <button type="button" onclick="GherbiMasterUpgrades.calcQuickChange(1000)" class="gherbi-banknote-btn">1000</button>
          <button type="button" onclick="GherbiMasterUpgrades.calcQuickChange(2000)" class="gherbi-banknote-btn">2000</button>
          <input id="gherbiQuickPaidInput" type="number" step="any" placeholder="المستلم..."
            oninput="GherbiMasterUpgrades.calcQuickChange(this.value)"
            class="w-16 px-1.5 py-0.5 rounded text-[11px] font-mono font-black border border-emerald-500/40 bg-white dark:bg-slate-900 text-center">
        </div>
        <div class="text-left shrink-0">
          <span class="text-[10px] font-bold text-slate-500">الباقي:</span>
          <span id="gherbiQuickChangeResult" class="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">0.00 د.ج</span>
        </div>
      </div>
    `;

    summaryFooter.insertBefore(controlsWrap, summaryFooter.firstChild);
  },

  calcQuickChange(paidVal) {
    const paid = parseFloat(paidVal) || 0;
    const paidInput = document.getElementById('gherbiQuickPaidInput');
    if (paidInput && String(paidInput.value) !== String(paidVal)) {
      paidInput.value = paid || '';
    }
    const totalEl = document.getElementById('cartTotalText');
    const total = parseFloat(String(totalEl?.textContent || '0').replace(/[^0-9.-]/g, '')) || 0;
    const change = Math.max(0, paid - total);
    const resEl = document.getElementById('gherbiQuickChangeResult');
    if (resEl) {
      resEl.textContent = change.toFixed(2) + ' د.ج';
    }
  },

  // ==========================================================================
  // 5 & 11. إصلاح تحديث السعر (F12) + درع حماية سعر التكلفة + عداد المخزون (قبل وبعد البيع)
  // ==========================================================================
  enhanceCartItemsRows() {
    const cartContainer = document.getElementById('posCartItems');
    if (!cartContainer || !window.App) return;

    const items = this.getActiveCartItems();
    const products = Array.isArray(window.App.products) ? window.App.products : [];
    const rows = Array.from(cartContainer.children);

    rows.forEach((row, idx) => {
      const item = items[idx];
      if (!item) return;

      const product = products.find((p) => Number(p.id) === Number(item.product_id || item.id));
      const costPrice = Number(product?.cost_price ?? item.cost_price ?? 0);
      const currentStock = Number(product?.total_stock ?? product?.stock ?? item.stock ?? 0);
      const cartQty = Number(item.quantity || 1);
      const remainingStock = Number((currentStock - cartQty).toFixed(2));
      const currentSellPrice = Number(item.price ?? item.selling_price ?? 0);

      // 1. ربط وتصليح حقل السعر داخل السطر ليتحدث فوراً عند الضغط على Enter أو التغيير (F12)
      const inputs = Array.from(row.querySelectorAll('input'));
      inputs.forEach((inp) => {
        const valNum = parseFloat(inp.value);
        // تمييز حقل السعر عن حقل الكمية
        const isPriceInput =
          inp.dataset.role === 'price' ||
          (inputs.length >= 2 && inp === inputs[inputs.length - 1] && Math.abs(valNum - currentSellPrice) < 0.01);

        if (isPriceInput && !inp.dataset.gherbiPriceBound) {
          inp.dataset.gherbiPriceBound = '1';
          inp.dataset.cartIdx = String(idx);
          inp.title = 'سعر الوحدة (اضغط Enter لتأكيد السعر الجديد)';

          const commitPriceUpdate = () => {
            const newPrice = parseFloat(inp.value);
            if (!Number.isFinite(newPrice) || newPrice < 0) return;
            this.applyRowPriceChange(idx, newPrice);
          };

          inp.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              commitPriceUpdate();
              inp.blur();
            }
          });
          inp.addEventListener('change', commitPriceUpdate);
        }
      });

      // 2. إضافة شارة المخزون الحالي والمتبقي بعد البيع + تحذير البيع بسعر التكلفة أو أقل
      let metaBox = row.querySelector('.gherbi-row-meta-box');
      if (!metaBox) {
        metaBox = document.createElement('div');
        metaBox.className = 'gherbi-row-meta-box flex flex-col items-start mt-1';
        const titleArea = row.querySelector('.font-bold, h4, span') || row.firstElementChild;
        if (titleArea && titleArea.parentElement) {
          titleArea.parentElement.appendChild(metaBox);
        } else {
          row.appendChild(metaBox);
        }
      }

      const afterClass =
        remainingStock <= 0
          ? 'stock-pill-after-zero'
          : remainingStock <= Number(product?.min_stock || 5)
            ? 'stock-pill-after-low'
            : 'stock-pill-after-ok';

      const isBelowOrEqualCost = costPrice > 0 && currentSellPrice <= costPrice;
      row.classList.toggle('gherbi-Below-cost-row', isBelowOrEqualCost);

      metaBox.innerHTML = `
        <div class="gherbi-stock-forecast-pills">
          <span class="gherbi-stock-pill stock-pill-current">📦 المتوفر: ${currentStock}</span>
          <span class="gherbi-stock-pill ${afterClass}">⬅ سيبقى بعد البيع: ${remainingStock}</span>
        </div>
        ${
          isBelowOrEqualCost
            ? `<div class="gherbi-cost-warning-badge">
                 ⚠️ تحذير: السعر (${currentSellPrice.toFixed(2)} د.ج) يساوي أو أقل من التكلفة (${costPrice.toFixed(2)} د.ج)!
               </div>`
            : ''
        }
      `;
    });
  },

  applyRowPriceChange(rowIndex, newPrice) {
    const items = this.getActiveCartItems();
    const item = items[rowIndex];
    if (!item) return;

    const products = Array.isArray(window.App?.products) ? window.App.products : [];
    const product = products.find((p) => Number(p.id) === Number(item.product_id || item.id));
    const costPrice = Number(product?.cost_price ?? item.cost_price ?? 0);
    const oldPrice = Number(item.price || 0);

    item.price = Number(newPrice.toFixed(2));
    item.custom_price = item.price;
    item.subtotal = Number((Number(item.quantity || 1) * item.price).toFixed(2));

    // التحقق من درع حماية سعر التكلفة
    if (costPrice > 0 && item.price <= costPrice) {
      const diff = Number((costPrice - item.price).toFixed(2));
      this.logCostPriceViolation({
        productId: item.product_id || item.id,
        productName: item.name || product?.name || 'صنف',
        costPrice,
        soldPrice: item.price,
        oldPrice,
        quantity: item.quantity || 1,
        lossAmount: Number((diff * Number(item.quantity || 1)).toFixed(2)),
        cashier: document.getElementById('currentUserName')?.textContent?.trim() || 'البائع',
        timestamp: new Date().toISOString()
      });

      alert(
        `🚨 تحذير رقابة الأسعار:\n\n` +
        `السلعة: ${item.name || product?.name}\n` +
        `سعر الشراء (التكلفة): ${costPrice.toFixed(2)} د.ج\n` +
        `السعر المدخل: ${item.price.toFixed(2)} د.ج\n\n` +
        `⚠️ أنت تبيع بسعر التكلفة أو بخسارة! تم تسجيل هذا التنبيه في تقرير الإدارة.`
      );
    }

    if (window.App) {
      if (typeof window.App.recalcCart === 'function') window.App.recalcCart();
      if (typeof window.App.renderCart === 'function') window.App.renderCart();
      else if (typeof window.App.renderPosView === 'function') window.App.renderPosView();
    }
    this.refreshAllEnhancements();
  },

  triggerF12PriceEdit() {
    const items = this.getActiveCartItems();
    if (!items.length) return;
    const idx = Math.min(Math.max(0, this.selectedCartRowIndex), items.length - 1);
    const item = items[idx];

    const cartContainer = document.getElementById('posCartItems');
    const row = cartContainer?.children[idx];
    const priceInp = row?.querySelector('input[data-gherbi-price-bound="1"]');

    if (priceInp) {
      priceInp.focus();
      priceInp.select();
    } else {
      const newVal = prompt(`تعديل سعر الوحدة (F12) للصنف [${item.name}]:`, item.price);
      if (newVal !== null && Number.isFinite(parseFloat(newVal))) {
        this.applyRowPriceChange(idx, parseFloat(newVal));
      }
    }
  },

  logCostPriceViolation(entry) {
    try {
      const list = JSON.parse(localStorage.getItem('gherbi_cost_price_alerts') || '[]');
      list.unshift(entry);
      localStorage.setItem('gherbi_cost_price_alerts', JSON.stringify(list.slice(0, 300)));
      this.renderManagerCostAuditPanels();
    } catch (_) {}
  },

  renderManagerCostAuditPanels() {
    const alerts = JSON.parse(localStorage.getItem('gherbi_cost_price_alerts') || '[]');
    const targets = ['view-analytics', 'view-sales'];

    targets.forEach((viewId) => {
      const sec = document.getElementById(viewId);
      if (!sec) return;

      let panel = sec.querySelector('.gherbi-manager-cost-audit-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'gherbi-manager-cost-audit-panel mb-4 p-4 rounded-2xl border-2 border-rose-500/40 bg-rose-500/5';
        sec.insertBefore(panel, sec.firstChild.nextSibling);
      }

      if (!alerts.length) {
        panel.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 font-black text-xs text-emerald-600 dark:text-emerald-400">
              <span>🛡️ سجل رقابة الأسعار (البيع بسعر التكلفة أو بأقل):</span>
              <span>لا توجد أي مخالفات مسجلة — جميع المبيعات ضمن هامش الربح الآمن.</span>
            </div>
          </div>
        `;
        return;
      }

      panel.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2 font-black text-sm text-rose-600 dark:text-rose-400">
            <span>🚨 تنبيهات الإدارة: عمليات بيع بسعر التكلفة أو بأقل (${alerts.length} عملية)</span>
          </div>
          <button type="button" onclick="GherbiMasterUpgrades.clearCostAuditAlerts()"
            class="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-500">
            تصفير السجل الرقابي
          </button>
        </div>
        <div class="max-h-44 overflow-y-auto border border-rose-500/25 rounded-xl bg-white dark:bg-slate-900">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-rose-500/15 text-rose-900 dark:text-rose-200 font-black">
                <th class="py-1.5 px-2 text-right">التاريخ والوقت</th>
                <th class="py-1.5 px-2 text-right">البائع</th>
                <th class="py-1.5 px-2 text-right">السلعة</th>
                <th class="py-1.5 px-2 text-center">الكمية</th>
                <th class="py-1.5 px-2 text-center">سعر التكلفة</th>
                <th class="py-1.5 px-2 text-center">سعر البيع</th>
                <th class="py-1.5 px-2 text-center">قيمة الخسارة / الفرق</th>
              </tr>
            </thead>
            <tbody>
              ${alerts.slice(0, 30).map((a) => `
                <tr class="border-b border-slate-200 dark:border-slate-800 font-bold">
                  <td class="py-1.5 px-2 font-mono text-[11px]">${new Date(a.timestamp).toLocaleString('fr-DZ')}</td>
                  <td class="py-1.5 px-2">${a.cashier}</td>
                  <td class="py-1.5 px-2">${a.productName}</td>
                  <td class="py-1.5 px-2 text-center font-mono">${a.quantity}</td>
                  <td class="py-1.5 px-2 text-center font-mono text-slate-600">${Number(a.costPrice).toFixed(2)} د.ج</td>
                  <td class="py-1.5 px-2 text-center font-mono text-rose-600 font-black">${Number(a.soldPrice).toFixed(2)} د.ج</td>
                  <td class="py-1.5 px-2 text-center font-mono text-rose-700 font-black">-${Number(a.lossAmount).toFixed(2)} د.ج</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });
  },

  clearCostAuditAlerts() {
    if (!confirm('هل تريد مسح سجل تنبيهات البيع بسعر التكلفة؟')) return;
    localStorage.removeItem('gherbi_cost_price_alerts');
    this.renderManagerCostAuditPanels();
  },

  // ==========================================================================
  // 6. إصلاح أزرار مضاعفات الكمية (1x | 2x | 3x | 5x | 10x) وبيع بمبلغ
  // ==========================================================================
  wireMultiplierButtons() {
    // البحث عن جميع أزرار المضاعفات في الشاشة (1x, 2x, 3x, 5x, 10x)
    const allButtons = Array.from(document.querySelectorAll('#view-pos button'));
    allButtons.forEach((btn) => {
      const txt = (btn.textContent || '').trim();
      const match = txt.match(/^(1|2|3|5|10)[x×]$/i);
      if (match) {
        const multVal = parseInt(match[1], 10);
        btn.dataset.gherbiMult = String(multVal);
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setMultiplier(multVal);
        };
      } else if (txt.includes('بيع بمبلغ')) {
        btn.onclick = (e) => {
          e.preventDefault();
          this.sellByCustomAmountDzd();
        };
      }
    });
  },

  setMultiplier(val) {
    this.activeMultiplier = Math.max(1, parseInt(val, 10) || 1);
    document.querySelectorAll('[data-gherbi-mult]').forEach((btn) => {
      const isMatch = parseInt(btn.dataset.gherbiMult, 10) === this.activeMultiplier;
      btn.classList.toggle('gherbi-mult-btn-active', isMatch);
    });
  },

  sellByCustomAmountDzd() {
    const items = this.getActiveCartItems();
    if (!items.length) {
      alert('يرجى اختيار أو مسح السلعة أولاً ثم الضغط على "بيع بمبلغ (د.ج)" لحساب كميتها تلقائياً.');
      return;
    }
    const idx = Math.min(Math.max(0, this.selectedCartRowIndex), items.length - 1);
    const item = items[idx];
    const unitPrice = Number(item.price || 0);
    if (unitPrice <= 0) return;

    const amountStr = prompt(`⚖️ البيع بمبلغ محسوب للصنف [${item.name}] (سعر الوحدة: ${unitPrice} د.ج):\nأدخل المبلغ المطلوب بالدينار:`, unitPrice);
    if (amountStr === null) return;
    const targetAmount = parseFloat(amountStr);
    if (Number.isFinite(targetAmount) && targetAmount > 0) {
      item.quantity = Number((targetAmount / unitPrice).toFixed(3));
      item.subtotal = Number(targetAmount.toFixed(2));
      if (window.App?.recalcCart) window.App.recalcCart();
      if (window.App?.renderCart) window.App.renderCart();
      this.refreshAllEnhancements();
    }
  },

  // ==========================================================================
  // 7. تحسين نافذة إضافة / تعديل زبون لتناسب البيع بالتجزئة (Retail Customer Modal)
  // ==========================================================================
  optimizeRetailCustomerModal() {
    const modal = document.getElementById('customerModal');
    if (!modal || modal.dataset.gherbiRetailOptimized) return;
    modal.dataset.gherbiRetailOptimized = '1';

    // البحث عن حقول الجملة (RC, NIF, AI, NIS, CCP) ووضعها داخل أكورديون اختياري مطوي
    const allInputs = Array.from(modal.querySelectorAll('input, select, textarea'));
    const wholesaleContainers = [];

    allInputs.forEach((inp) => {
      const idOrName = (inp.id + ' ' + inp.name + ' ' + inp.placeholder).toLowerCase();
      const labelTxt = (inp.parentElement?.textContent || '').trim();
      if (
        labelTxt.includes('السجل التجاري') ||
        labelTxt.includes('الرقم الجبائي') ||
        labelTxt.includes('مادة الضريبة') ||
        labelTxt.includes('الرقم الإحصائي') ||
        labelTxt.includes('بيانات الحساب البريدي') ||
        idOrName.includes('rc') ||
        idOrName.includes('nif') ||
        idOrName.includes('nis')
      ) {
        const block = inp.closest('.grid') || inp.parentElement;
        if (block && !wholesaleContainers.includes(block)) {
          wholesaleContainers.push(block);
        }
      }
    });

    if (wholesaleContainers.length > 0) {
      const accordion = document.createElement('details');
      accordion.className = 'mt-3 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50/60 dark:bg-slate-800/40';
      accordion.innerHTML = `
        <summary class="cursor-pointer font-black text-xs text-blue-600 dark:text-blue-400 select-none">
          ➕ بيانات إضافية (الحساب البريدي CCP للتقسيط / بيانات جبائية - اختياري)
        </summary>
        <div class="mt-3 space-y-3" id="gherbiWholesaleAccordionBody"></div>
      `;
      const firstBlock = wholesaleContainers[0];
      firstBlock.parentNode.insertBefore(accordion, firstBlock);
      const body = accordion.querySelector('#gherbiWholesaleAccordionBody');
      wholesaleContainers.forEach((b) => body.appendChild(b));
    }
  },

  // ==========================================================================
  // 8. خيار تبديل موضع القائمة الرئيسية (بين الأعلى والجانب)
  // ==========================================================================
  setupTopNavSwitcher() {
    const savedNavMode = localStorage.getItem('gherbi_nav_position') || 'side';
    document.body.classList.toggle('gherbi-top-nav-mode', savedNavMode === 'top');

    const topHeader = document.getElementById('top-header') || document.querySelector('header');
    if (topHeader && !document.getElementById('gherbiNavPositionBtn')) {
      const btn = document.createElement('button');
      btn.id = 'gherbiNavPositionBtn';
      btn.type = 'button';
      btn.className = 'px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-black flex items-center gap-1 transition border border-slate-200 dark:border-slate-700';
      btn.title = 'تبديل مكان القائمة الرئيسية (في الأعلى / في الجانب)';
      btn.innerHTML = `<span>${savedNavMode === 'top' ? '◧ القائمة جانبية' : '⬆️ القائمة بالأعلى'}</span>`;
      btn.onclick = () => {
        const isTop = document.body.classList.toggle('gherbi-top-nav-mode');
        localStorage.setItem('gherbi_nav_position', isTop ? 'top' : 'side');
        btn.innerHTML = `<span>${isTop ? '◧ القائمة جانبية' : '⬆️ القائمة بالأعلى'}</span>`;
      };
      topHeader.insertBefore(btn, topHeader.firstChild);
    }
  },

  // ==========================================================================
  // 9. تعديل زر فاحص السعر إلى (F6) وتخصيص (F10) لإغلاق الوردية
  // ==========================================================================
  relabelPriceCheckerAndShiftShortcuts() {
    const allBtns = Array.from(document.querySelectorAll('button'));
    allBtns.forEach((btn) => {
      const txt = (btn.textContent || '').trim();
      if (txt.includes('فاحص السعر')) {
        btn.innerHTML = btn.innerHTML.replace(/F10/g, 'F6');
        if (!btn.innerHTML.includes('F6')) {
          btn.innerHTML = '🔍 فاحص السعر (F6)';
        }
        btn.onclick = (e) => {
          e.preventDefault();
          this.openFastPriceCheckerModal();
        };
      } else if (txt.includes('المناوبة نشطة') || txt.includes('إدارة الصندوق')) {
        btn.title = 'إدارة الصندوق وإغلاق الوردية (F10)';
      }
    });
  },

  openFastPriceCheckerModal() {
    const modal = document.getElementById('gherbiPriceCheckerModal');
    if (!modal) return;
    modal.classList.add('active');
    const inp = document.getElementById('gherbiPriceCheckerInput');
    if (inp) {
      inp.value = '';
      setTimeout(() => inp.focus(), 50);
    }
  },

  onPriceCheckerLookup(query) {
    const resBox = document.getElementById('gherbiPriceCheckerResult');
    if (!resBox || !window.App) return;
    const q = String(query || '').trim().toLowerCase();
    if (!q) {
      resBox.innerHTML = '<div class="text-slate-400 py-6 text-center font-bold">امسح الباركود أو اكتب اسم السلعة لعرض السعر والمخزون فوراً</div>';
      return;
    }

    const products = Array.isArray(window.App.products) ? window.App.products : [];
    const found = products.find(
      (p) => String(p.barcode || '').toLowerCase() === q || String(p.name || '').toLowerCase().includes(q)
    );

    if (!found) {
      resBox.innerHTML = '<div class="text-rose-500 py-6 text-center font-black">⚠️ لم يتم العثور على أي سلعة مطابقة</div>';
      return;
    }

    const price = Number(found.selling_price ?? found.price ?? 0);
    const stock = Number(found.total_stock ?? found.stock ?? 0);
    const centimes = Math.round(price * 100).toLocaleString('fr-DZ');

    resBox.innerHTML = `
      <div class="p-4 rounded-2xl bg-slate-900 text-white text-center space-y-2 border border-blue-500/40">
        <div class="text-base font-black text-blue-300">${found.name}</div>
        <div class="text-4xl font-mono font-black text-emerald-400">${price.toFixed(2)} د.ج</div>
        <div class="text-xs font-bold text-amber-300">بالتداول الجزائري: ${centimes} سنتيم</div>
        <div class="flex items-center justify-center gap-4 pt-2 text-xs font-bold">
          <span class="px-3 py-1 rounded-full bg-white/10">📦 المخزون المتوفر: ${stock}</span>
          <span class="px-3 py-1 rounded-full bg-white/10">🏷️ الباركود: ${found.barcode || '—'}</span>
        </div>
        <div class="pt-2">
          <button type="button" onclick="App.addToCart(${found.id}); document.getElementById('gherbiPriceCheckerModal').classList.remove('active');"
            class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs">
            ➕ إضافة إلى السلة الحالية
          </button>
        </div>
      </div>
    `;
  },

  triggerShiftCloseF10() {
    if (window.App) {
      if (typeof window.App.openCloseShiftModal === 'function') {
        window.App.openCloseShiftModal();
      } else if (typeof window.App.switchView === 'function') {
        window.App.switchView('caisse');
      }
    }
  },

  // ==========================================================================
  // 10. إصلاح وتفعيل زر الإرجاع (إرجاع) ليعمل بكفاءة 100%
  // ==========================================================================
  wireReturnModeButton() {
    const allBtns = Array.from(document.querySelectorAll('#view-pos button'));
    allBtns.forEach((btn) => {
      const txt = (btn.textContent || '').trim();
      if (txt === 'إرجاع' || btn.id === 'btnReturnMode') {
        btn.id = 'btnReturnMode';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleReturnMode();
        };
      }
    });
  },

  toggleReturnMode() {
    this.returnModeActive = !this.returnModeActive;
    if (window.App) {
      window.App.isReturnMode = this.returnModeActive;
      window.App.returnMode = this.returnModeActive;
    }

    const btn = document.getElementById('btnReturnMode');
    if (btn) {
      btn.classList.toggle('gherbi-return-mode-active', this.returnModeActive);
      btn.innerHTML = this.returnModeActive
        ? '↩️ وضع الإرجاع نشط (انقر للإلغاء)'
        : '↩️ إرجاع';
    }

    const cartContainer = document.querySelector('#view-pos .cart-container');
    let banner = document.getElementById('gherbiReturnModeBanner');
    if (this.returnModeActive) {
      if (!banner && cartContainer) {
        banner = document.createElement('div');
        banner.id = 'gherbiReturnModeBanner';
        banner.className = 'gherbi-return-banner';
        banner.innerHTML = `
          <span>🔄 وضع إرجاع السلع نشط: أي سلعة تضيفها الآن ستُرجع للمخزون وتُخصم قيمتها</span>
          <button type="button" onclick="GherbiMasterUpgrades.toggleReturnMode()" class="px-2 py-0.5 rounded bg-white text-rose-700 font-black text-[10px]">إنهاء الإرجاع</button>
        `;
        cartContainer.insertBefore(banner, cartContainer.firstChild);
      }
    } else if (banner) {
      banner.remove();
    }
  },

  // ==========================================================================
  // ربط المحرك بدوال window.App الأصلية (المضاعفات + الإرجاع + التحديث التلقائي)
  // ==========================================================================
  getActiveCartItems() {
    if (!window.App) return [];
    if (Array.isArray(window.App.cart)) return window.App.cart;
    if (Array.isArray(window.App.carts) && window.App.carts[window.App.activeCartIndex || 0]) {
      const c = window.App.carts[window.App.activeCartIndex || 0];
      return Array.isArray(c.items) ? c.items : [];
    }
    return [];
  },

  hookIntoAppEngine() {
    const waitApp = setInterval(() => {
      if (!window.App) return;
      clearInterval(waitApp);

      // 1. اعتراض addToCart لتطبيق مضاعف الكمية (1x..10x) ووضع الإرجاع تلقائياً
      if (typeof window.App.addToCart === 'function' && !window.App._gherbiMasterAddWrapped) {
        const origAddToCart = window.App.addToCart.bind(window.App);
        window.App.addToCart = (productId, ...rest) => {
          const mult = Math.max(1, Number(this.activeMultiplier || 1));
          const isReturn = Boolean(this.returnModeActive);

          const res = origAddToCart(productId, ...rest);

          const items = this.getActiveCartItems();
          const addedItem = items.find((it) => Number(it.product_id || it.id) === Number(productId));

          if (addedItem) {
            if (mult > 1) {
              addedItem.quantity = Number((Number(addedItem.quantity || 1) + (mult - 1)).toFixed(3));
            }
            if (isReturn && addedItem.quantity > 0) {
              addedItem.quantity = -Math.abs(addedItem.quantity);
              addedItem.is_return = true;
            }
            addedItem.subtotal = Number((Number(addedItem.quantity || 1) * Number(addedItem.price || 0)).toFixed(2));
            if (typeof window.App.recalcCart === 'function') window.App.recalcCart();
            if (typeof window.App.renderCart === 'function') window.App.renderCart();
          }

          if (mult > 1) this.setMultiplier(1);
          this.refreshAllEnhancements();
          return res;
        };
        window.App._gherbiMasterAddWrapped = true;
      }

      // 2. اعتراض دوال إعادة الرسم لتحديث كافة التحسينات تلقائياً
      ['renderPosView', 'renderCart', 'recalcCart', 'switchView'].forEach((fn) => {
        if (typeof window.App[fn] === 'function' && !window.App['_gherbiMasterWrap_' + fn]) {
          const origFn = window.App[fn].bind(window.App);
          window.App[fn] = (...args) => {
            const out = origFn(...args);
            this.refreshAllEnhancements();
            return out;
          };
          window.App['_gherbiMasterWrap_' + fn] = true;
        }
      });

      this.refreshAllEnhancements();
    }, 200);

    // مراقب DOM للسلة
    const cartEl = document.getElementById('posCartItems');
    if (cartEl) {
      const obs = new MutationObserver(() => {
        this.enhanceCartItemsRows();
        this.renderEnhancedCartTabs();
      });
      obs.observe(cartEl, { childList: true });
    }
  },

  refreshAllEnhancements() {
    this.renderEnhancedCartTabs();
    this.syncSmartCustomerBar();
    this.enhanceCartItemsRows();
    this.wireMultiplierButtons();
    this.wireReturnModeButton();
    this.relabelPriceCheckerAndShiftShortcuts();
    this.renderManagerCostAuditPanels();
  },

  // ==========================================================================
  // حقن النوافذ الذكية (نافذة F8/F9 للزبائن والوفاء + نافذة F6 لفاحص السعر)
  // ==========================================================================
  injectModalsAndAuditContainers() {
    if (document.getElementById('gherbiSmartLoyaltyModal')) return;

    const modalsHtml = `
      <!-- نافذة الزبون والوفاء الذكية الفورية (F8 / F9) -->
      <div id="gherbiSmartLoyaltyModal" class="modal-overlay" dir="rtl">
        <div class="modal-content w-full max-w-3xl p-0 overflow-hidden rounded-2xl border border-amber-500/40 shadow-2xl bg-white dark:bg-slate-900">
          <!-- الهيدر -->
          <div class="flex items-center justify-between px-5 py-3.5 bg-gradient-to-l from-slate-900 via-slate-800 to-amber-950 text-white">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">👑</span>
              <div>
                <h3 class="font-black text-sm">نافذة الزبائن وبطاقة الوفاء الفورية (F8 / F9)</h3>
                <p class="text-[11px] text-amber-300 font-bold">امسح باركود البطاقة مباشرة (F8) أو ابحث بالاسم، واضغط (F9) لاختزال النقاط فوراً</p>
              </div>
            </div>
            <button type="button" onclick="GherbiMasterUpgrades.closeSmartLoyaltyModal()" class="text-slate-300 hover:text-rose-400 font-black text-lg">✕</button>
          </div>

          <div class="p-4 space-y-4 text-xs">
            <!-- 1. خانة المسح الفوري للبطاقة (Auto-Focus on F8) أو البحث بالاسم -->
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
              <div class="flex items-center justify-between">
                <label class="font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <span class="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px]">F8</span>
                  <span>امسح باركود بطاقة الوفاء (FID-...) أو ابحث بالاسم / رقم الهاتف:</span>
                </label>
                <button type="button" onclick="GherbiMasterUpgrades.closeSmartLoyaltyModal(); App.openCustomerModal();"
                  class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-[11px] hover:bg-emerald-500">
                  + تسجيل زبون وفي جديد
                </button>
              </div>

              <div class="flex items-center gap-2">
                <input id="gherbiLoyaltyBarcodeOrSearchInput" type="text"
                  oninput="GherbiMasterUpgrades.onLoyaltyScanOrSearch(this.value)"
                  onkeydown="if(event.key==='Enter'){ GherbiMasterUpgrades.confirmLoyaltyModalAndApply(); }"
                  placeholder="مرر بطاقة الوفاء بالقارئ الآن أو اكتب اسم الزبون / الهاتف..."
                  class="flex-1 px-3.5 py-2 rounded-xl border-2 border-blue-500 font-bold text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/30">
                <button type="button" onclick="GherbiMasterUpgrades.renderSmartLoyaltyCustomerList('')"
                  class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-black hover:bg-blue-600 hover:text-white transition">
                  📋 عرض كل الزبائن
                </button>
              </div>

              <!-- جدول الزبائن المباشر -->
              <div class="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
                <table class="w-full text-xs border-collapse">
                  <thead>
                    <tr class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black border-b border-slate-200 dark:border-slate-700">
                      <th class="py-2 px-3 text-right">اسم الزبون</th>
                      <th class="py-2 px-3 text-center">كود البطاقة (FID)</th>
                      <th class="py-2 px-3 text-center">الهاتف</th>
                      <th class="py-2 px-3 text-center">النقاط المتاحة</th>
                      <th class="py-2 px-3 text-center">القيمة بالدينار</th>
                    </tr>
                  </thead>
                  <tbody id="gherbiSmartLoyaltyCustomerTbody"></tbody>
                </table>
              </div>
            </div>

            <!-- 2. قسم اختزال النقاط الفوري (Auto-Focus on F9) -->
            <div class="p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 space-y-3">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-black text-[10.5px]">F9</span>
                  <span id="gherbiModalSelectedCustTitle" class="font-black text-sm text-slate-900 dark:text-white">👤 زبون عابر</span>
                </div>
                <div class="text-xs font-black text-amber-700 dark:text-amber-300">
                  الرصيد المتاح: <span id="gherbiModalAvailablePointsText" class="font-mono text-emerald-600 dark:text-emerald-400">0 نقطة = 0.00 د.ج</span>
                </div>
              </div>

              <div class="flex items-center gap-2 flex-wrap">
                <label class="font-black text-slate-700 dark:text-slate-200">عدد النقاط المراد اختزالها:</label>
                <input id="gherbiLoyaltyRedeemPtsInput" type="number" step="1" min="0" value="0"
                  oninput="GherbiMasterUpgrades.updateSmartLoyaltyRedeemPreview()"
                  onkeydown="if(event.key==='Enter'){ GherbiMasterUpgrades.confirmLoyaltyModalAndApply(); }"
                  class="w-28 px-3 py-1.5 rounded-xl border-2 border-amber-500 text-center font-mono font-black text-base bg-white dark:bg-slate-900">
                
                <div id="gherbiLoyaltyRedeemDzdEquivalent" class="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono font-black text-sm">
                  = 0.00 د.ج (0 سنتيم)
                </div>

                <button type="button" onclick="GherbiMasterUpgrades.redeemAllAvailablePoints()"
                  class="mr-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow flex items-center gap-1">
                  <span>🎁</span>
                  <span>اختزال كل النقاط المتاحة</span>
                </button>
              </div>
            </div>

            <!-- أزرار التأكيد والإغلاق -->
            <div class="flex items-center justify-end gap-2 pt-1">
              <button type="button" onclick="GherbiMasterUpgrades.confirmLoyaltyModalAndApply()"
                class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg flex items-center gap-1.5">
                <span>✔</span>
                <span>موافق وتطبيق على الفاتورة (OK / Enter)</span>
              </button>
              <button type="button" onclick="GherbiMasterUpgrades.closeSmartLoyaltyModal()"
                class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-black text-xs">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- نافذة فاحص السعر الفوري (F6) -->
      <div id="gherbiPriceCheckerModal" class="modal-overlay" dir="rtl">
        <div class="modal-content w-full max-w-lg p-0 overflow-hidden rounded-2xl border border-indigo-500/40 shadow-2xl bg-white dark:bg-slate-900">
          <div class="flex items-center justify-between px-4 py-3 bg-indigo-950 text-white">
            <div class="flex items-center gap-2 font-black text-sm">
              <span>🔍</span>
              <span>فاحص السعر والمخزون الفوري (F6)</span>
            </div>
            <button type="button" onclick="document.getElementById('gherbiPriceCheckerModal').classList.remove('active')" class="text-slate-300 hover:text-rose-400 font-black">✕</button>
          </div>
          <div class="p-4 space-y-3">
            <input id="gherbiPriceCheckerInput" type="text"
              oninput="GherbiMasterUpgrades.onPriceCheckerLookup(this.value)"
              placeholder="امسح الباركود أو اكتب اسم السلعة..."
              class="w-full px-3.5 py-2.5 rounded-xl border-2 border-indigo-500 font-bold text-sm bg-white dark:bg-slate-800">
            <div id="gherbiPriceCheckerResult">
              <div class="text-slate-400 py-6 text-center font-bold text-xs">امسح الباركود أو اكتب اسم السلعة لعرض السعر والمخزون فوراً</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalsHtml);
  },

  // ==========================================================================
  // الاختصارات الشاملة للوحة المفاتيح (Ctrl+N, F6, F8, F9, F10, F12, Ctrl+X)
  // ==========================================================================
  bindMasterKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const posView = document.getElementById('view-pos');
      const isPosActive = posView && posView.classList.contains('active');
      if (!isPosActive) return;

      // Ctrl + N: سلة جديدة فوراً
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.createNewCartWithShortcut();
        return;
      }

      // F6: فاحص السعر الفوري
      if (e.key === 'F6') {
        e.preventDefault();
        this.openFastPriceCheckerModal();
        return;
      }

      // F8: فتح نافذة الزبون والوفاء مع التركيز المباشر في خانة مسح باركود البطاقة
      if (e.key === 'F8') {
        e.preventDefault();
        this.openSmartLoyaltyModal('f8');
        return;
      }

      // F9: فتح نافذة الزبون والوفاء مع التركيز المباشر في خانة اختزال النقاط
      if (e.key === 'F9') {
        e.preventDefault();
        this.openSmartLoyaltyModal('f9');
        return;
      }

      // F10: إغلاق الوردية / المناوبة
      if (e.key === 'F10') {
        e.preventDefault();
        this.triggerShiftCloseF10();
        return;
      }

      // F12: تعديل سعر الوحدة للسطر المحدد مع تفعيل درع حماية سعر التكلفة
      if (e.key === 'F12') {
        e.preventDefault();
        this.triggerF12PriceEdit();
        return;
      }

      // Ctrl + X: اختيار مضاعف الكمية
      if (e.ctrlKey && e.key.toLowerCase() === 'x') {
        const steps = [1, 2, 3, 5, 10];
        const next = steps[(steps.indexOf(this.activeMultiplier) + 1) % steps.length];
        e.preventDefault();
        this.setMultiplier(next);
      }
    }, true);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.GherbiMasterUpgrades.init();
});
