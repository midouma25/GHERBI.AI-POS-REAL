/* [V31_SAFE_QUERY_SELECTOR_SHIELD] */
(function installSafeQuerySelectorShield() {
  function sanitizeFractionalSelector(sel) {
    if (typeof sel !== 'string') return sel;
    return sel.replace(/\.([a-zA-Z0-9_-]+)\.(5)\b/g, '.$1\\.$2');
  }
  const origElQS = Element.prototype.querySelector;
  const origElQSA = Element.prototype.querySelectorAll;
  const origDocQS = Document.prototype.querySelector;
  const origDocQSA = Document.prototype.querySelectorAll;
  Element.prototype.querySelector = function (s) {
    try { return origElQS.call(this, s); } catch (_) { return origElQS.call(this, sanitizeFractionalSelector(s)); }
  };
  Element.prototype.querySelectorAll = function (s) {
    try { return origElQSA.call(this, s); } catch (_) { return origElQSA.call(this, sanitizeFractionalSelector(s)); }
  };
  Document.prototype.querySelector = function (s) {
    try { return origDocQS.call(this, s); } catch (_) { return origDocQS.call(this, sanitizeFractionalSelector(s)); }
  };
  Document.prototype.querySelectorAll = function (s) {
    try { return origDocQSA.call(this, s); } catch (_) { return origDocQSA.call(this, sanitizeFractionalSelector(s)); }
  };
})();
/* [V30_TAILWIND_DECIMAL_SELECTOR_SHIELD] */
(function installTailwindDecimalSelectorShield() {
  function sanitizeSelector(sel) {
    if (typeof sel !== 'string' || !sel.includes('.')) return sel;
    return sel.replace(/(\.[a-zA-Z0-9_-]+?)\.(\d)/g, '$1\\.$2');
  }
  if (typeof Element !== 'undefined' && Element.prototype) {
    const origQS = Element.prototype.querySelector;
    const origQSA = Element.prototype.querySelectorAll;
    if (origQS && !Element.prototype._v30QsPatched) {
      Element.prototype._v30QsPatched = true;
      Element.prototype.querySelector = function (sel) {
        return origQS.call(this, sanitizeSelector(sel));
      };
    }
    if (origQSA && !Element.prototype._v30QsaPatched) {
      Element.prototype._v30QsaPatched = true;
      Element.prototype.querySelectorAll = function (sel) {
        return origQSA.call(this, sanitizeSelector(sel));
      };
    }
  }
})();

/* ==================== [SAFE CART TOTAL HELPER] ==================== */
window.computeSafeCartTotalDzd = function () {
  try {
    const cart = window.App && window.App.currentCart;
    if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
      const sub = cart.items.reduce(
        (sum, it) => sum + Number(it.subtotal !== undefined ? it.subtotal : Number(it.quantity || 1) * Number(it.price || 0)),
        0
      );
      const disc = Number(cart.discount || 0) + Number(cart.couponDiscount || 0);
      return Math.max(0, Number((sub - disc).toFixed(2)));
    }
    const domTxt = (document.getElementById('cartTotal') && document.getElementById('cartTotal').textContent) || '0';
    return Math.max(0, parseFloat(domTxt.replace(/[^0-9.-]/g, '')) || 0);
  } catch (_) {
    return 0;
  }
};
window.GherbiV4Stage1 = window.GherbiV4Stage1 || {};
window.GherbiV4Stage1.getCartTotalDirectly = window.computeSafeCartTotalDzd;

/* ==================== [MODULE: gherbi-v4-stage1-clean.js] ==================== */
/**
 * gherbi-v4-stage1-clean.js
 * الشطر الأول (1/3):
 * - نافذة مخصصة لتغيير كود المدير السري (PIN) بدون window.prompt() + تنظيف تكرار جدول الرقابة
 * - توحيد شريط اللمس السريع (F7) وإزالة التكرار
 * - الحساب اللحظي الفوري لـ "الباقي للزبون" بمجرد كتابة أي رقم بدون أي ضغط وبدون استدعاء recalcCart
 */

'use strict';

(function initGherbiV4Stage1Clean() {
  const GherbiV4Stage1 = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.buildManagerPinModalDom();
        this.wireManagerPinAndDeduplicateAuditRows();
        this.unifyF7QuickStrip();
        this.setupInstantZeroClickChangeCalc();
        console.log('✅ [Gherbi V4 - Stage 1 Clean]: جاهز ويعمل بنجاح.');
      }, 180);
    },

    // ========================================================================
    // 1. نافذة تغيير كود المدير السري (PIN) بدون prompt() + إزالة تكرار السجل
    // ========================================================================
    buildManagerPinModalDom() {
      if (document.getElementById('changeManagerPinModal')) return;
      const modal = document.createElement('div');
      modal.id = 'changeManagerPinModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border-2 border-amber-500 shadow-2xl text-xs bg-white dark:bg-slate-900">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="text-xl">🔑</span>
              <div>
                <h3 class="text-sm font-black text-amber-600 dark:text-amber-400">تغيير كود المدير السري (Manager PIN)</h3>
                <p class="text-[10.5px] text-slate-400">يُستخدم هذا الكود لتوثيق وحماية تعديل رصيد نقاط الوفاء</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="text-slate-400 hover:text-rose-500 font-black text-base">✕</button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">1. الكود السري الحالي (الافتراضي: 1234) * :</label>
              <input id="v4PinCurrentInp" type="password" placeholder="أدخل الكود السري الحالي..."
                onkeydown="if(event.key==='Enter') document.getElementById('v4PinNewInp')?.focus()"
                class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
            </div>

            <div>
              <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">2. الكود السري الجديد (3 خانات أو أكثر) * :</label>
              <input id="v4PinNewInp" type="password" placeholder="أدخل الكود الجديد..."
                onkeydown="if(event.key==='Enter') document.getElementById('v4PinConfirmInp')?.focus()"
                class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-base tracking-widest">
            </div>

            <div>
              <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">3. تأكيد الكود السري الجديد * :</label>
              <input id="v4PinConfirmInp" type="password" placeholder="أعد كتابة الكود الجديد..."
                onkeydown="if(event.key==='Enter') GherbiV4Stage1.saveManagerPin()"
                class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
            <button type="button" onclick="GherbiV4Stage1.saveManagerPin()"
              class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg">
              ✔ حفظ الكود السري الجديد
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    getStoredManagerPin() {
      return String(
        window.AppState?.settings?.manager_loyalty_pin ||
        localStorage.getItem('gherbi_manager_loyalty_pin') ||
        '1234'
      ).trim();
    },

    openChangePinModal() {
      this.buildManagerPinModalDom();
      document.getElementById('v4PinCurrentInp').value = '';
      document.getElementById('v4PinNewInp').value = '';
      document.getElementById('v4PinConfirmInp').value = '';
      window.App.openModal('changeManagerPinModal');
      setTimeout(() => document.getElementById('v4PinCurrentInp')?.focus(), 60);
    },

    saveManagerPin() {
      const curPin = this.getStoredManagerPin();
      const oldVal = String(document.getElementById('v4PinCurrentInp')?.value || '').trim();
      const newVal = String(document.getElementById('v4PinNewInp')?.value || '').trim();
      const confVal = String(document.getElementById('v4PinConfirmInp')?.value || '').trim();

      if (oldVal !== curPin) {
        if (window.showToast) window.showToast('❌ الكود السري الحالي غير صحيح!', 'error');
        document.getElementById('v4PinCurrentInp')?.focus();
        return;
      }
      if (newVal.length < 3) {
        if (window.showToast) window.showToast('⚠️ يجب أن يتكون الكود الجديد من 3 خانات على الأقل', 'warning');
        document.getElementById('v4PinNewInp')?.focus();
        return;
      }
      if (newVal !== confVal) {
        if (window.showToast) window.showToast('⚠️ الكود الجديد وتأكيده غير متطابقين!', 'warning');
        document.getElementById('v4PinConfirmInp')?.focus();
        return;
      }

      localStorage.setItem('gherbi_manager_loyalty_pin', newVal);
      if (window.AppState?.settings) window.AppState.settings.manager_loyalty_pin = newVal;
      if (window.api?.updateSettings) {
        window.api.updateSettings({ manager_loyalty_pin: newVal }).catch(() => {});
      }

      window.App.closeModal('changeManagerPinModal');
      if (window.showToast) {
        window.showToast('✅ تم تغيير كود المدير السري (PIN) وحفظه بنجاح!', 'success');
      }
    },

    wireManagerPinAndDeduplicateAuditRows() {
      if (window.RetailV3) {
        window.RetailV3.changeManagerLoyaltyPinPrompt = () => this.openChangePinModal();
        window.RetailV3.getManagerSecretPin = () => this.getStoredManagerPin();

        // قفل منع تكرار تسجيل نفس التعديل في سجل الرقابة
        const origConfirm = window.RetailV3.confirmManagerPinPointsChange?.bind(window.RetailV3);
        if (origConfirm && !window.RetailV3._s1CleanDedup) {
          window.RetailV3.confirmManagerPinPointsChange = async function () {
            if (this._pinSaveBusy) return;
            this._pinSaveBusy = true;
            try {
              await origConfirm();
            } finally {
              setTimeout(() => { this._pinSaveBusy = false; }, 900);
            }
          };
          window.RetailV3._s1CleanDedup = true;
        }
      }

      // تنظيف الصفوف المكررة في جدول سجل رقابة المدير تلقائياً
      const cleanAuditTable = () => {
        const card = document.getElementById('ownerLoyaltyPointsAuditCard');
        if (!card) return;

        const btn = card.querySelector('button[onclick*="changeManagerLoyaltyPinPrompt"]');
        if (btn) {
          btn.onclick = (e) => {
            e.preventDefault();
            this.openChangePinModal();
          };
        }

        const tbody = card.querySelector('tbody');
        if (!tbody) return;
        const seen = new Set();
        let uniqueCount = 0;

        Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
          if (cells.length < 3) return;
          // مفتاح التفرد: المستخدم + الزبون + الرصيد السابق + الرصيد الجديد + الفارق + السبب
          const key = cells.slice(1).join('||');
          if (seen.has(key)) {
            tr.remove();
          } else {
            seen.add(key);
            uniqueCount++;
          }
        });

        const h3 = card.querySelector('h3');
        if (h3) {
          h3.textContent = `سجل رقابة المدير: تعديلات رصيد نقاط الوفاء (${uniqueCount})`;
        }
      };

      setInterval(cleanAuditTable, 600);
    },

    // ========================================================================
    // 2. إزالة تكرار شريط اللمس السريع (F7) وتوحيده في شريط واحد
    // ========================================================================
    unifyF7QuickStrip() {
      const removeLegacyStrip = () => {
        document.getElementById('posQuickTouchStrip')?.remove();
      };
      removeLegacyStrip();

      if (window.App) {
        window.App.renderQuickTouchStrip = function () {
          removeLegacyStrip();
          if (window.RetailV3 && typeof window.RetailV3.renderPinnedQuickDock === 'function') {
            window.RetailV3.renderPinnedQuickDock();
          }
        };
      }
      setInterval(removeLegacyStrip, 500);
    },

    // ========================================================================
    // 3. التحديث اللحظي الفوري لـ "الباقي للزبون" بدون ضغط وبدون استدعاء recalcCart
    // ========================================================================
    getSafeTotalDue(forcedTotal) {
      if (forcedTotal !== undefined && forcedTotal !== null && !isNaN(Number(forcedTotal))) {
        return Number(forcedTotal);
      }
      try {
        const cart = window.App?.currentCart;
        if (cart && Array.isArray(cart.items)) {
          const sub = cart.items.reduce((s, it) => {
            const line = it.subtotal !== undefined ? Number(it.subtotal) : (Number(it.quantity || 1) * Number(it.price || 0));
            return s + (isNaN(line) ? 0 : line);
          }, 0);
          const disc = Number(cart.discount || document.getElementById('cartDiscountInput')?.value || 0);
          return Math.max(0, Number((sub - disc).toFixed(2)));
        }
      } catch (_) {}
      const txt = document.getElementById('cartTotalText')?.textContent || '0';
      return parseFloat(String(txt).replace(/[^\d.-]/g, '')) || 0;
    },

    computeLiveChange(forcedTotal) {
      if (this._calcBusy) return;
      this._calcBusy = true;
      try {
        const inp = document.getElementById('gherbiReceivedCashInput');
        const resEl = document.getElementById('gherbiInlineChangeResult');
        const centEl = document.getElementById('gherbiInlineChangeCentimes');
        if (!inp || !resEl) return;

        const totalDue = this.getSafeTotalDue(forcedTotal);
        const rawVal = String(inp.value || '').trim();
        const received = parseFloat(rawVal);

        if (!rawVal || !Number.isFinite(received) || received <= 0) {
          resEl.textContent = '0.00 د.ج';
          resEl.className = 'font-mono font-black text-sm text-slate-500';
          if (centEl) centEl.classList.add('hidden');
          return;
        }

        const diff = Number((received - totalDue).toFixed(2));
        if (diff >= 0) {
          resEl.textContent = `${diff.toFixed(2)} د.ج`;
          resEl.className = 'font-mono font-black text-base text-emerald-600 dark:text-emerald-400';
          if (centEl) {
            const centStr = window.App?.formatAlgerianCentimes
              ? window.App.formatAlgerianCentimes(diff)
              : `${Math.round(diff * 100).toLocaleString('fr-DZ')} سنتيم`;
            centEl.textContent = `🇩🇿 الصرف بالتداول الجزائري: ${centStr}`;
            centEl.classList.remove('hidden');
          }
        } else {
          const missing = Math.abs(diff);
          resEl.textContent = `ناقص: ${missing.toFixed(2)} د.ج`;
          resEl.className = 'font-mono font-black text-sm text-rose-600';
          if (centEl) {
            centEl.textContent = `⚠️ المبلغ المستلم أقل من الإجمالي المستحق بـ ${missing.toFixed(2)} د.ج`;
            centEl.classList.remove('hidden');
          }
        }
      } finally {
        this._calcBusy = false;
      }
    },

    setupInstantZeroClickChangeCalc() {
      if (window.RetailV2) {
        window.RetailV2.recalcInlineChange = (t) => this.computeLiveChange(t);
      }

      ['input', 'keyup', 'change', 'paste'].forEach((ev) => {
        document.addEventListener(
          ev,
          (e) => {
            if (e.target && e.target.id === 'gherbiReceivedCashInput') {
              this.computeLiveChange();
            }
          },
          true
        );
      });

      const attachObserver = () => {
        const totalEl = document.getElementById('cartTotalText');
        if (totalEl && !totalEl.dataset.v4LiveObs) {
          totalEl.dataset.v4LiveObs = '1';
          const obs = new MutationObserver(() => this.computeLiveChange());
          obs.observe(totalEl, { childList: true, characterData: true, subtree: true });
        }
      };
      attachObserver();
      setInterval(attachObserver, 800);
    }
  };

  window.GherbiV4Stage1 = GherbiV4Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GherbiV4Stage1.init());
  } else {
    GherbiV4Stage1.init();
  }
})();

/**
 * gherbi-core-pos-engine.js
 * الحزمة المعمارية الأولى (V13 Core POS Engine):
 * تضم محرك السلة، التعديل المزدوج (F12 / Alt+P / 0.8)، محرك الباكي/الكرتونة، حاسبة الصرف (Alt+C)، ونافذة تسديد التجزئة (F1).
 */
'use strict';


/* ==================== [MODULE: gherbi-retail-master-upgrade.js] ==================== */
/**
 * gherbi-retail-master-upgrade.js
 * المحرك الشامل للتعديلات الـ 12 لبيئة بيع التجزئة في نظام Gherbi.Ai POS
 */

'use strict';

(function initGherbiRetailMasterUpgrade() {
  const RetailMaster = {
    lastCompletedSale: JSON.parse(localStorage.getItem('gherbi_last_completed_sale') || 'null'),
    navLayoutMode: localStorage.getItem('gherbi_nav_layout_mode') || 'side', // 'side' | 'top'

    init() {
      const waitApp = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(waitApp);
        this.applyAllUpgrades();
      }, 180);
    },

    applyAllUpgrades() {
      this.applyNavLayoutMode(this.navLayoutMode);
      this.injectTopHeaderControls();
      this.buildSmartModalsDom();
      this.upgradeCustomerModalForRetail();
      this.upgradeSplitResizer();
      this.compactCartStructureAndLoyaltyBar();
      this.fixMultipliersAndReverseAmount();
      this.upgradeCartItemsWithLiveStockAndCostGuard();
      this.fixReturnModeEngine();
      this.hookCheckoutForLastSaleMemoryAndLoyalty();
      this.upgradeSalesHistoryAndOwnerCostReport();
      this.bindMasterKeyboardShortcuts();

      // إعادة الرندر لتطبيق التحسينات فوراً
      setTimeout(() => {
        if (window.App && typeof window.App.renderPosView === 'function') {
          window.App.renderPosView();
          window.App.renderCartTabs();
          window.App.renderCartItems();
        }
      }, 300);
    },

    // ========================================================================
    // 1. التحجيم الحر والديناميكي لشاشة المبيعات (Smooth Drag-to-Resize Split Pane)
    // ========================================================================
    upgradeSplitResizer() {
      const posLayout = document.querySelector('#view-pos .pos-layout') || document.getElementById('posMainGridContainer');
      if (!posLayout) return;
      posLayout.id = 'posMainGridContainer';

      let resizer = document.getElementById('posCartResizer');
      const children = Array.from(posLayout.children);
      const cartContainer = posLayout.querySelector('.cart-container') || document.getElementById('posCartContainer');

      if (!resizer && cartContainer) {
        resizer = document.createElement('div');
        resizer.id = 'posCartResizer';
        resizer.className = 'gherbi-splitter-handle';
        resizer.title = 'اسحب يميناً أو يساراً لتكبير وتصغير شاشة السلة (نقر مزدوج لإرجاع القياس المتوازن)';
        posLayout.insertBefore(resizer, cartContainer);
      } else if (resizer) {
        resizer.className = 'gherbi-splitter-handle';
        resizer.title = 'اسحب يميناً أو يساراً لتكبير وتصغير شاشة السلة (نقر مزدوج لإرجاع القياس المتوازن)';
      }

      // تجاوز الدالة المقيدة في renderer.js للسماح بتكبير النصف الأيسر حتى 68% من الشاشة
      window.App.applyCartWidthLayout = function (widthPx) {
        const grid = document.getElementById('posMainGridContainer') || document.querySelector('#view-pos .pos-layout');
        if (!grid) return;
        const rect = grid.getBoundingClientRect();
        const totalW = rect.width > 600 ? rect.width : (window.innerWidth - 80);
        const maxAllowedW = Math.max(480, Math.floor(totalW * 0.68));
        const minAllowedW = 340;
        const clampedW = Math.min(maxAllowedW, Math.max(minAllowedW, Math.round(Number(widthPx) || 470)));

        window.AppState.posCartWidth = clampedW;
        document.documentElement.style.setProperty('--gherbi-cart-width', clampedW + 'px');
        grid.style.gridTemplateColumns = `minmax(300px, 1fr) 10px ${clampedW}px`;
      };

      const savedWidth = parseInt(localStorage.getItem('gherbi_pos_cart_width') || window.AppState.posCartWidth || '470', 10);
      window.App.applyCartWidthLayout(savedWidth);

      if (resizer && resizer.dataset.masterResizerBound !== '1') {
        resizer.dataset.masterResizerBound = '1';
        let isDragging = false;
        let rafId = null;

        resizer.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          isDragging = true;
          document.body.classList.add('gherbi-resizing-active');
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        });

        resizer.addEventListener('dblclick', () => {
          window.App.applyCartWidthLayout(470);
          localStorage.setItem('gherbi_pos_cart_width', '470');
          if (window.api?.updateSettings) window.api.updateSettings({ pos_cart_width: '470' });
          if (window.showToast) window.showToast('تمت استعادة القياس القياسي المتوازن للسلة', 'info');
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            const grid = document.getElementById('posMainGridContainer') || document.querySelector('#view-pos .pos-layout');
            if (!grid) return;
            const rect = grid.getBoundingClientRect();
            const isRtl = document.documentElement.dir !== 'ltr';
            const desiredWidth = isRtl ? (e.clientX - rect.left) : (rect.right - e.clientX);
            window.App.applyCartWidthLayout(desiredWidth);
          });
        });

        window.addEventListener('mouseup', () => {
          if (!isDragging) return;
          isDragging = false;
          document.body.classList.remove('gherbi-resizing-active');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          const finalW = String(window.AppState.posCartWidth || 470);
          localStorage.setItem('gherbi_pos_cart_width', finalW);
          if (window.api?.updateSettings) window.api.updateSettings({ pos_cart_width: finalW });
        });
      }
    },

    // ========================================================================
    // 2 & 3 & 4. إعادة هندسة قمة السلة، شريط السلات (✕ و Ctrl+N)، الزر الذكي للوفاء (F8/F9)، وتعظيم مساحة المشتريات
    // ========================================================================
    compactCartStructureAndLoyaltyBar() {
      const cartContainer = document.getElementById('posCartContainer') || document.querySelector('#view-pos .cart-container');
      if (!cartContainer) return;
      cartContainer.id = 'posCartContainer';

      // إخفاء الصناديق القديمة المتفرقة الخاصة بالوفاء والسلات لتوفير مساحة رأسية كبيرة
      Array.from(cartContainer.children).forEach((child) => {
        if (
          child.id !== 'posCartItems' &&
          child.id !== 'posEditSaleBanner' &&
          child.id !== 'posQuickMultiplierBar' &&
          !child.querySelector('#cartTotalText')
        ) {
          // إذا كان يحتوي على posCustomerSelect أو multiCartTabs نخفيه بصرياً مع إبقائه في DOM لسلامة الكود الخلفي
          if (child.querySelector('#posCustomerSelect') || child.querySelector('#multiCartTabs') || child.id === 'posAlgerianMasterBar') {
            child.classList.add('gherbi-legacy-loyalty-hidden');
          }
        }
      });

      // إنشاء القمة المدمجة الجديدة للسلة (gherbiCartTopDeck)
      if (!document.getElementById('gherbiCartTopDeck')) {
        const topDeck = document.createElement('div');
        topDeck.id = 'gherbiCartTopDeck';
        topDeck.className = 'gherbi-cart-top-deck';
        topDeck.innerHTML = `
          <!-- شريط تنبيه وضع الإرجاع النشط (مخفي افتراضياً) -->
          <div id="gherbiReturnActiveBanner" class="gherbi-return-mode-banner rounded-lg hidden">
            <div class="flex items-center gap-1.5">
              <span>🔄 وضع إرجاع السلع للمخزون نشط</span>
              <button type="button" onclick="RetailMaster.openReturnFromInvoicePicker()" class="px-2 py-0.5 rounded bg-white text-rose-700 text-[10px] font-black">إرجاع من فاتورة سابقة</button>
            </div>
            <button type="button" onclick="App.toggleReturnMode()" class="px-2 py-0.5 rounded bg-black/25 hover:bg-black/40 text-white text-[10px]">إيقاف الإرجاع ✕</button>
          </div>

          <!-- السطر 1: تبويبات السلات (مع علامة ✕) + زر (+ سلة Ctrl+N) + زر (سجل) + أزرار الأدوات -->
          <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1" id="gherbiModernCartTabs"></div>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" onclick="App.newCartTab()" title="إنشاء سلة جديدة (اختصار: Ctrl + N)"
                class="px-2 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600 text-blue-600 hover:text-white text-[11px] font-black transition flex items-center gap-0.5">
                <span>+ سلة</span>
                <kbd class="text-[9px] font-mono opacity-75">Ctrl+N</kbd>
              </button>
              <button type="button" onclick="App.openPosRecentSalesModal()" title="سجل آخر المبيعات وتعديل الفواتير"
                class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-[11px] font-bold transition flex items-center gap-0.5">
                <span>🕒 سجل</span>
              </button>
              <button type="button" onclick="App.openMobileCompanionModal()" title="ربط الهاتف المحمول"
                class="px-1.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[11px] font-bold transition">
                📱
              </button>
            </div>
          </div>

          <!-- السطر 2: الزر الشريطي الذكي الموحد للزبون وبطاقة الوفاء وخصم النقاط (F8 / F9) -->
          <div class="flex items-center gap-1">
            <div id="gherbiSmartLoyaltyBtn" onclick="RetailMaster.openSmartLoyaltyModal('scan')" class="gherbi-smart-loyalty-trigger flex-1" title="اضغط أو F8 لمسح بطاقة الوفاء أو اختيار الزبون | اضغط F9 لاختزال النقاط">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-base leading-none">👑</span>
                <span id="gherbiSmartCustName" class="truncate font-black text-slate-800 dark:text-slate-100">زبون عابر (بدون بطاقة)</span>
                <span id="gherbiSmartCustPointsBadge" class="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono text-[10px] font-black hidden">0 نقطة</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[9.5px] font-black">F8 البطاقة/الزبون</span>
                <span onclick="event.stopPropagation(); RetailMaster.openSmartLoyaltyModal('redeem')" class="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[9.5px] font-black hover:bg-emerald-500">F9 خصم نقاط</span>
              </div>
            </div>
            <button type="button" onclick="App.openCustomerModal(null)" title="إضافة زبون جديد للمحل"
              class="p-1.5 rounded-lg bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600 hover:text-white transition shrink-0">
              <span class="material-symbols-rounded icon-sm">person_add</span>
            </button>
          </div>
        `;

        // شريط ذاكرة آخر فاتورة والباقي للزبون
        const memBar = document.createElement('div');
        memBar.id = 'gherbiLastSaleMemoryBar';
        memBar.className = 'gherbi-last-sale-memory-bar hidden';

        cartContainer.insertBefore(memBar, cartContainer.firstChild);
        cartContainer.insertBefore(topDeck, memBar);
      }

      this.renderLastSaleMemoryBar();

      // ترقية دالة renderCartTabs لدعم زر الحذف (✕) وتحديث الزر الذكي للزبون
      window.App.renderCartTabs = function () {
        const modernBox = document.getElementById('gherbiModernCartTabs');
        const legacyBox = document.getElementById('multiCartTabs');
        const carts = window.AppState.carts || [];
        const activeIdx = window.AppState.activeCartIndex || 0;

        if (modernBox) {
          modernBox.innerHTML = carts.map((c, idx) => {
            const isActive = idx === activeIdx;
            const count = (c.items || []).length;
            return `
              <div onclick="App.switchCartTab(${idx})" class="gherbi-cart-tab-pill ${isActive ? 'active' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">
                <span>${c.label} (${count})</span>
                <span onclick="App.closeCartTab(${idx}, event)" class="gherbi-cart-tab-close" title="إغلاق وحذف هذه السلة">✕</span>
              </div>
            `;
          }).join('');
        }

        if (legacyBox) {
          legacyBox.innerHTML = carts.map((c, idx) => `<button onclick="App.switchCartTab(${idx})">${c.label}</button>`).join('');
        }

        const badge = document.getElementById('draftsCountBadge');
        if (badge) badge.textContent = (window.AppState.draftCarts || []).length;

        RetailMaster.syncSmartLoyaltyButtonDisplay();
      };

      window.App.closeCartTab = function (idx, event) {
        if (event) event.stopPropagation();
        const carts = window.AppState.carts || [];
        const target = carts[idx];
        if (!target) return;

        if (target.items && target.items.length > 0) {
          if (!confirm(`السلة (${target.label}) تحتوي على ${target.items.length} أصناف. هل تريد حذفها وإغلاقها؟`)) {
            return;
          }
        }

        if (carts.length <= 1) {
          window.App.clearCurrentCart();
          return;
        }

        carts.splice(idx, 1);
        carts.forEach((c, i) => {
          c.label = `سلة #${i + 1}`;
        });
        if (window.AppState.activeCartIndex >= carts.length) {
          window.AppState.activeCartIndex = carts.length - 1;
        }
        window.App.renderPosView();
      };

      // ضغط تذييل السلة (المجموع الفرعي + الكوبون + التخفيض) لتوفير أقصى مساحة لمستطيل المشتريات
      const footer = document.querySelector('#posCartContainer > div:last-child');
      if (footer && !footer.dataset.compactedRetail) {
        footer.dataset.compactedRetail = '1';
        footer.style.padding = '0.45rem 0.65rem';
        footer.classList.remove('space-y-3', 'space-y-2.5');
        footer.classList.add('space-y-1');
      }
    },

    syncSmartLoyaltyButtonDisplay() {
      const cart = window.App?.currentCart;
      const nameEl = document.getElementById('gherbiSmartCustName');
      const ptsBadge = document.getElementById('gherbiSmartCustPointsBadge');
      if (!nameEl || !ptsBadge) return;

      const cid = cart ? cart.customerId : '';
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));

      if (cust) {
        const pts = Number(cust.loyalty_points || 0);
        const dzdVal = (pts * 2).toFixed(0); // أو حسب معامل النقاط
        nameEl.textContent = `${cust.name} (FID-${String(cust.id).padStart(5, '0')})`;
        ptsBadge.textContent = `⭐ ${pts} نقطة (${dzdVal} د.ج)`;
        ptsBadge.classList.remove('hidden');
      } else {
        nameEl.textContent = 'زبون عابر (اضغط أو F8 لبطاقة الوفاء)';
        ptsBadge.classList.add('hidden');
      }
    },

    // ========================================================================
    // 3 (تتمة). نافذة الزبون والوفاء الذكية (F8 المسح والبحث / F9 اختزال النقاط) + نافذة فاحص السعر (F6)
    // ========================================================================
    buildSmartModalsDom() {
      if (!document.getElementById('smartLoyaltyCustomerModal')) {
        const modal = document.createElement('div');
        modal.id = 'smartLoyaltyCustomerModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="modal-content w-full max-w-2xl p-5 space-y-4 overflow-y-auto text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">👑</span>
                <div>
                  <h3 class="text-base font-black">بطاقة الوفاء، اختيار الزبون، واختزال النقاط (F8 / F9)</h3>
                  <p class="text-[11px] text-slate-400">مرر بطاقة الوفاء مباشرة (F8) أو ابحث بالاسم/الهاتف، واضغط (F9) لخصم النقاط بالدينار</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('smartLoyaltyCustomerModal'); App.focusBarcodeMagnet?.(false);" class="text-slate-400 hover:text-rose-500">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>

            <!-- 1. خانة مسح باركود بطاقة الوفاء المباشر (F8 Auto-Focus) -->
            <div class="p-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-2">
              <div class="flex items-center justify-between">
                <label class="font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-[10px]">F8</span>
                  <span>1. مسح باركود بطاقة الوفاء (FID-...) أو البحث الفوري:</span>
                </label>
                <div class="flex items-center gap-1.5">
                  <button type="button" onclick="RetailMaster.selectWalkInCustomer()" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold hover:bg-slate-300">👤 زبون عابر</button>
                  <button type="button" onclick="App.closeModal('smartLoyaltyCustomerModal'); App.openCustomerModal(null);" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold">+ زبون جديد</button>
                </div>
              </div>

              <div class="flex gap-2">
                <input id="smartLoyaltyScanOrSearchInput" type="text"
                  oninput="RetailMaster.onSmartLoyaltySearch(this.value)"
                  onkeydown="RetailMaster.onSmartLoyaltyInputKeydown(event)"
                  placeholder="مرر قارئ الباركود على بطاقة الوفاء (FID-...) أو اكتب اسم/هاتف الزبون..."
                  class="flex-1 px-3 py-2 rounded-xl font-bold text-sm border-2 border-amber-500">
                <button type="button" onclick="RetailMaster.toggleAllCustomersList()" class="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-black whitespace-nowrap">
                  📋 كل الزبائن
                </button>
              </div>

              <!-- قائمة الزبائن المطابقة -->
              <div id="smartLoyaltyCustomersListBox" class="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800"></div>
            </div>

            <!-- 2. بطاقة الزبون المحدد واختزال النقاط الفوري (F9) -->
            <div id="smartSelectedCustCard" class="p-3.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/35 space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                <div>
                  <span class="text-slate-400 font-bold">الزبون المحدد:</span>
                  <strong id="smartModalCustTitle" class="text-sm font-black mr-1">زبون عابر</strong>
                  <span id="smartModalCustCode" class="font-mono text-[11px] text-amber-600 font-bold"></span>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-left">
                    <span class="text-slate-400">رصيد النقاط:</span>
                    <strong id="smartModalAvailablePoints" class="font-mono text-base font-black text-amber-500 mr-1">0 نقطة</strong>
                  </div>
                  <div class="text-left">
                    <span class="text-slate-400">قيمتها المالية:</span>
                    <strong id="smartModalTotalPointsDzd" class="font-mono text-base font-black text-emerald-600 mr-1">0.00 د.ج</strong>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                <div class="md:col-span-5">
                  <label class="block font-black text-emerald-700 dark:text-emerald-300 mb-1">
                    <span class="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] ml-1">F9</span>
                    <span>عدد النقاط المراد اختزالها:</span>
                  </label>
                  <input id="smartRedeemPointsInput" type="number" step="1" min="0" value="0"
                    oninput="RetailMaster.updateRedeemPreview()"
                    onkeydown="if(event.key==='Enter'){ event.preventDefault(); RetailMaster.confirmSmartLoyaltyModal(); }"
                    class="w-full px-3 py-2 rounded-xl font-mono font-black text-base text-center border-2 border-emerald-500">
                </div>

                <div class="md:col-span-4 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 text-center">
                  <div class="text-[10px] text-slate-400 font-bold">قيمة الخصم المباشر بالدينار:</div>
                  <div id="smartRedeemDzdEquivalent" class="font-mono font-black text-lg text-emerald-600">0.00 د.ج</div>
                  <div id="smartRedeemCentimesEquivalent" class="text-[10px] font-bold text-amber-600">0 سنتيم</div>
                </div>

                <div class="md:col-span-3 flex flex-col gap-1.5">
                  <button type="button" onclick="RetailMaster.setRedeemAllPoints()"
                    class="w-full py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm">
                    🎁 اختزال كل النقاط
                  </button>
                  <button type="button" onclick="RetailMaster.setRedeemHalfPoints()"
                    class="w-full py-1.5 px-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-[11px]">
                    نصف النقاط (50%)
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <span class="text-[11px] text-slate-400 font-bold">💡 اضغط Enter أو زر (OK تأكيد) لحفظ الزبون وتطبيق خصم النقاط فوراً</span>
              <div class="flex items-center gap-2">
                <button type="button" onclick="App.closeModal('smartLoyaltyCustomerModal'); App.focusBarcodeMagnet?.(false);" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
                <button type="button" onclick="RetailMaster.confirmSmartLoyaltyModal()" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow-lg shadow-blue-600/25">
                  ✔ OK — تأكيد وتطبيق (Enter)
                </button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      // نافذة فاحص السعر الفوري (F6)
      if (!document.getElementById('posPriceCheckerModal')) {
        const pcModal = document.createElement('div');
        pcModal.id = 'posPriceCheckerModal';
        pcModal.className = 'modal-overlay';
        pcModal.innerHTML = `
          <div class="modal-content w-full max-w-lg p-5 space-y-4 text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <h3 class="text-base font-black text-indigo-600 flex items-center gap-1.5">
                <span class="material-symbols-rounded">manage_search</span>
                <span>فاحص السعر والمخزون الفوري (F6)</span>
              </h3>
              <button type="button" onclick="App.closeModal('posPriceCheckerModal'); App.focusBarcodeMagnet?.(false);" class="text-slate-400 hover:text-rose-500">✕</button>
            </div>
            <input id="priceCheckerScanInput" type="text"
              oninput="RetailMaster.onPriceCheckerInput(this.value)"
              onkeydown="if(event.key==='Enter') RetailMaster.onPriceCheckerInput(this.value, true)"
              placeholder="امسح الباركود أو اكتب اسم السلعة لفحص سعرها..."
              class="w-full px-3.5 py-2.5 rounded-xl font-bold text-sm border-2 border-indigo-500">
            <div id="priceCheckerResultCard" class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center space-y-2">
              <div class="text-slate-400 font-bold py-6">امسح باركود أي سلعة لعرض سعرها بالدينار والسنتيم والكمية المتوفرة</div>
            </div>
          </div>
        `;
        document.body.appendChild(pcModal);
      }
    },

    getPointDzdValue() {
      // افتراضياً كل 1 نقطة = 2 د.ج (أو حسب إعدادات المتجر)
      const customRate = parseFloat(window.AppState?.settings?.loyalty_point_value_dzd || '2');
      return Number.isFinite(customRate) && customRate > 0 ? customRate : 2;
    },

    openSmartLoyaltyModal(focusMode = 'scan') {
      this.buildSmartModalsDom();
      window.App.openModal('smartLoyaltyCustomerModal');
      const scanInp = document.getElementById('smartLoyaltyScanOrSearchInput');
      if (scanInp) scanInp.value = '';
      this.renderSmartLoyaltyCustomersList('');
      this.refreshSmartModalSelectedCustomer();

      setTimeout(() => {
        if (focusMode === 'redeem') {
          const redInp = document.getElementById('smartRedeemPointsInput');
          if (redInp) {
            redInp.focus();
            redInp.select();
          }
        } else if (scanInp) {
          scanInp.focus();
          scanInp.select();
        }
      }, 60);
    },

    onSmartLoyaltySearch(val) {
      const clean = String(val || '').trim();
      // إذا مسح بطاقة وفاء بصيغة FID-00003 أو كود مباشر
      const fidMatch = clean.match(/^FID-0*(d+)$/i);
      if (fidMatch) {
        const cid = Number(fidMatch[1]);
        const found = (window.AppState.customers || []).find((c) => Number(c.id) === cid);
        if (found) {
          this.pickCustomerInSmartModal(found.id);
        }
      }
      this.renderSmartLoyaltyCustomersList(clean);
    },

    onSmartLoyaltyInputKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        const val = String(event.target.value || '').trim();
        const fidMatch = val.match(/^FID-0*(d+)$/i);
        let found = null;
        if (fidMatch) {
          found = (window.AppState.customers || []).find((c) => Number(c.id) === Number(fidMatch[1]));
        } else if (val) {
          const q = val.toLowerCase();
          found = (window.AppState.customers || []).find(
            (c) =>
              String(c.phone || '').includes(q) ||
              String(c.barcode || '').toLowerCase() === q ||
              String(c.name || '').toLowerCase().includes(q)
          );
        }
        if (found) {
          this.pickCustomerInSmartModal(found.id);
          if (window.showToast) window.showToast(`👑 تم اختيار الزبون: ${found.name}`, 'success');
          // إذا لم يكن يريد اختزال نقاط، نغلق النافذة مباشرة أو ننقل المؤشر لخانة الاختزال
          const redInp = document.getElementById('smartRedeemPointsInput');
          if (redInp && Number(found.loyalty_points || 0) > 0) {
            redInp.focus();
            redInp.select();
          } else {
            this.confirmSmartLoyaltyModal();
          }
        }
      } else if (event.key === 'F9') {
        event.preventDefault();
        const redInp = document.getElementById('smartRedeemPointsInput');
        if (redInp) {
          redInp.focus();
          redInp.select();
        }
      }
    },

    toggleAllCustomersList() {
      const inp = document.getElementById('smartLoyaltyScanOrSearchInput');
      if (inp) inp.value = '';
      this.renderSmartLoyaltyCustomersList('');
    },

    renderSmartLoyaltyCustomersList(query = '') {
      const box = document.getElementById('smartLoyaltyCustomersListBox');
      if (!box) return;
      const q = String(query || '').trim().toLowerCase();
      const customers = window.AppState.customers || [];
      const curCid = Number(window.App?.currentCart?.customerId || 0);

      const filtered = customers.filter((c) => {
        if (!q) return true;
        const fid = 'fid-' + String(c.id).padStart(5, '0');
        return (
          String(c.name || '').toLowerCase().includes(q) ||
          String(c.phone || '').toLowerCase().includes(q) ||
          fid.includes(q) ||
          String(c.id) === q
        );
      });

      if (filtered.length === 0) {
        box.innerHTML = '<div class="py-4 text-center text-slate-400 font-bold">لا يوجد زبون مطابق — اضغط (+ زبون جديد) لإضافته</div>';
        return;
      }

      box.innerHTML = filtered.slice(0, 60).map((c) => {
        const isSelected = Number(c.id) === curCid;
        const pts = Number(c.loyalty_points || 0);
        const fidCode = 'FID-' + String(c.id).padStart(5, '0');
        return `
          <div onclick="RetailMaster.pickCustomerInSmartModal(${c.id})"
            class="p-2.5 flex items-center justify-between cursor-pointer hover:bg-blue-600/10 transition ${isSelected ? 'bg-blue-600/15 font-black' : ''}">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono text-[10px] font-bold">${fidCode}</span>
              <span class="font-bold">${c.name}</span>
              ${c.phone ? `<span class="text-slate-400 font-mono text-[11px]">(${c.phone})</span>` : ''}
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-mono font-bold text-[11px]">⭐ ${pts} نقطة</span>
              ${Number(c.total_debt || 0) > 0 ? `<span class="text-rose-500 font-mono text-[11px]">دين: ${Number(c.total_debt).toFixed(0)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
    },

    pickCustomerInSmartModal(customerId) {
      if (!window.App) return;
      const cid = customerId ? Number(customerId) : '';
      window.App.currentCart.customerId = cid;
      const sel = document.getElementById('posCustomerSelect');
      if (sel) {
        sel.value = String(cid);
        sel.dispatchEvent(new Event('change'));
      }
      this.refreshSmartModalSelectedCustomer();
      this.renderSmartLoyaltyCustomersList(document.getElementById('smartLoyaltyScanOrSearchInput')?.value || '');
      this.syncSmartLoyaltyButtonDisplay();
    },

    selectWalkInCustomer() {
      this.pickCustomerInSmartModal('');
      document.getElementById('smartRedeemPointsInput').value = '0';
      this.updateRedeemPreview();
    },

    refreshSmartModalSelectedCustomer() {
      const cid = window.App?.currentCart?.customerId;
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));
      const rate = this.getPointDzdValue();

      const titleEl = document.getElementById('smartModalCustTitle');
      const codeEl = document.getElementById('smartModalCustCode');
      const ptsEl = document.getElementById('smartModalAvailablePoints');
      const dzdEl = document.getElementById('smartModalTotalPointsDzd');
      const redInp = document.getElementById('smartRedeemPointsInput');

      if (cust) {
        const pts = Math.max(0, Number(cust.loyalty_points || 0));
        const dzd = Number((pts * rate).toFixed(2));
        if (titleEl) titleEl.textContent = cust.name;
        if (codeEl) codeEl.textContent = `(FID-${String(cust.id).padStart(5, '0')})`;
        if (ptsEl) ptsEl.textContent = `${pts} نقطة`;
        if (dzdEl) dzdEl.textContent = `${dzd.toFixed(2)} د.ج`;
        if (redInp) {
          redInp.max = String(pts);
          redInp.value = String(window.App.currentCart._redeemedPoints || 0);
        }
      } else {
        if (titleEl) titleEl.textContent = 'زبون عابر (بدون بطاقة وفاء)';
        if (codeEl) codeEl.textContent = '';
        if (ptsEl) ptsEl.textContent = '0 نقطة';
        if (dzdEl) dzdEl.textContent = '0.00 د.ج';
        if (redInp) {
          redInp.max = '0';
          redInp.value = '0';
        }
      }
      this.updateRedeemPreview();
    },

    updateRedeemPreview() {
      const cid = window.App?.currentCart?.customerId;
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));
      const maxPts = cust ? Math.max(0, Number(cust.loyalty_points || 0)) : 0;
      const rate = this.getPointDzdValue();

      const redInp = document.getElementById('smartRedeemPointsInput');
      let pts = Math.max(0, parseFloat(redInp?.value || '0') || 0);
      if (pts > maxPts) {
        pts = maxPts;
        if (redInp) redInp.value = String(pts);
      }

      const dzdDiscount = Number((pts * rate).toFixed(2));
      const eqEl = document.getElementById('smartRedeemDzdEquivalent');
      const centEl = document.getElementById('smartRedeemCentimesEquivalent');
      if (eqEl) eqEl.textContent = `${dzdDiscount.toFixed(2)} د.ج`;
      if (centEl && window.App?.formatAlgerianCentimes) {
        centEl.textContent = window.App.formatAlgerianCentimes(dzdDiscount);
      }
    },

    setRedeemAllPoints() {
      const cid = window.App?.currentCart?.customerId;
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));
      if (!cust) return;
      const pts = Math.max(0, Number(cust.loyalty_points || 0));
      const redInp = document.getElementById('smartRedeemPointsInput');
      if (redInp) redInp.value = String(pts);
      this.updateRedeemPreview();
    },

    setRedeemHalfPoints() {
      const cid = window.App?.currentCart?.customerId;
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));
      if (!cust) return;
      const pts = Math.floor(Math.max(0, Number(cust.loyalty_points || 0)) / 2);
      const redInp = document.getElementById('smartRedeemPointsInput');
      if (redInp) redInp.value = String(pts);
      this.updateRedeemPreview();
    },

    confirmSmartLoyaltyModal() {
      const cart = window.App?.currentCart;
      if (!cart) return;
      const pts = Math.max(0, parseFloat(document.getElementById('smartRedeemPointsInput')?.value || '0') || 0);
      const rate = this.getPointDzdValue();
      const dzdDiscount = Number((pts * rate).toFixed(2));

      cart._redeemedPoints = pts;
      if (pts > 0) {
        cart.discount = dzdDiscount;
        const discInput = document.getElementById('cartDiscountInput');
        if (discInput) discInput.value = String(dzdDiscount);
        if (window.showToast) {
          window.showToast(`🎁 تم تطبيق خصم نقاط الوفاء: -${dzdDiscount.toFixed(2)} د.ج (${pts} نقطة)`, 'success');
        }
      }

      window.App.closeModal('smartLoyaltyCustomerModal');
      window.App.recalcAndRenderCart();
      this.syncSmartLoyaltyButtonDisplay();
      if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
    },

    // ========================================================================
    // 5 & 7. إصلاح تعديل السعر (F12 + Enter/OK) + درع الحماية من البيع بالتكلفة أو بخسارة + عداد المخزون الحي والكمية المتبقية
    // ========================================================================
    upgradeCartItemsWithLiveStockAndCostGuard() {
      // تعريف دوال تحديث السعر والكمية المفقودة في renderer.js مع درع حماية رأس المال
      window.App.updateCartItemQty = function (idx, rawVal) {
        const items = window.App.currentCart?.items || [];
        const item = items[idx];
        if (!item) return;
        const newQty = parseFloat(rawVal);
        if (!Number.isFinite(newQty) || (newQty === 0 && !window.AppState.isReturnMode)) {
          window.App.renderCartItems();
          return;
        }
        item.quantity = Number(newQty.toFixed(3));
        item.subtotal = Number((item.quantity * Number(item.price || 0)).toFixed(2));
        window.App.recalcAndRenderCart();
      };

      window.App.updateCartItemPrice = async function (idx, rawVal) {
        const items = window.App.currentCart?.items || [];
        const item = items[idx];
        if (!item) return;
        const newPrice = parseFloat(rawVal);
        if (!Number.isFinite(newPrice) || newPrice < 0) {
          window.App.renderCartItems();
          return;
        }

        const prod = (window.AppState.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );
        const costPrice = Number(item.cost_price || (prod && prod.cost_price) || 0);

        item.price = Number(newPrice.toFixed(2));
        item.subtotal = Number((Number(item.quantity || 1) * item.price).toFixed(2));

        // فحص إذا كان السعر المدخل يساوي أو يقل عن سعر الشراء (Cost-Price Guardrail)
        if (costPrice > 0 && item.price <= costPrice) {
          const isEqual = Math.abs(item.price - costPrice) < 0.01;
          const warnMsg = isEqual
            ? `⚠️ تحذير: السعر المدخل (${item.price.toFixed(2)} د.ج) يساوي سعر الشراء للمحل (${costPrice.toFixed(2)} د.ج) — الربح 0!`
            : `🚨 تحذير خسارة: السعر المدخل (${item.price.toFixed(2)} د.ج) أقل من سعر الشراء (${costPrice.toFixed(2)} د.ج)!`;

          if (window.showToast) window.showToast(warnMsg, 'error');

          // تسجيل فوري في سجل الرقابة ليراه صاحب المحل في التقارير
          if (window.api?.addAuditLog) {
            await window.api.addAuditLog({
              user_id: window.AppState.currentUser?.id || 1,
              user_name: window.AppState.currentUser?.name || 'Cashier',
              action_type: 'SALE_AT_OR_BELOW_COST',
              target_type: 'product',
              target_id: item.product_id || null,
              severity: 'danger',
              details: {
                product_name: item.name,
                cost_price: costPrice,
                sold_price: item.price,
                loss_per_unit: Number((costPrice - item.price).toFixed(2)),
                quantity: item.quantity,
                timestamp: new Date().toISOString()
              }
            }).catch(() => {});
          }
        }

        window.App.recalcAndRenderCart();
      };

      // ربط زر OK في نافذة الأرقام اللمسية (#numberInputModal) ليمر عبر updateCartItemPrice ويفحص التكلفة
      window.App.confirmNumpadModal = async function () {
        const idx = window.AppState._activeNumpadCartIdx ?? Number(document.getElementById('numModalCartIndex')?.value || 0);
        const item = window.App.currentCart?.items?.[idx];
        if (!item) {
          window.App.closeModal('numberInputModal');
          return;
        }
        const newQty = parseFloat(document.getElementById('numModalInput')?.value);
        const newPrice = parseFloat(document.getElementById('numModalPriceInput')?.value);
        window.App.closeModal('numberInputModal');

        if (Number.isFinite(newQty) && newQty !== 0) {
          window.App.updateCartItemQty(idx, newQty);
        }
        if (Number.isFinite(newPrice) && newPrice >= 0) {
          await window.App.updateCartItemPrice(idx, newPrice);
        }
        if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
      };
      window.App.confirmNumberInputModal = window.App.confirmNumpadModal;

      // ترقية رسم عناصر السلة (renderCartItems) لإظهار:
      // 1) الكمية المتوفرة حالياً + كم سيبقى بعد البيع (المخزون: X ⬅ يبقى: Y)
      // 2) تحذير البيع بسعر التكلفة أو أقل
      window.App.renderCartItems = function () {
        const container = document.getElementById('posCartItems');
        if (!container) return;
        const items = (window.App.currentCart && window.App.currentCart.items) || [];

        const countEl = document.getElementById('cartItemsCountText');
        if (countEl) countEl.textContent = String(items.length);

        if (items.length === 0) {
          window.AppState.selectedCartRowIdx = 0;
          container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-slate-400 py-8">
              <span class="material-symbols-rounded icon-xl mb-1 opacity-40">shopping_basket</span>
              <div class="text-xs font-bold">السلة فارغة — امسح الباركود (F5) أو ابحث بالاسم (F4)</div>
              <div class="text-[10px] text-slate-400 mt-1 font-mono text-center">
                [F5] باركود | [F4] بحث | [F8] بطاقة وفاء | [F9] خصم نقاط | [F12] السعر | [Échap] تذكرة 80mm
              </div>
            </div>`;
          if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
          return;
        }

        if (window.AppState.selectedCartRowIdx >= items.length || window.AppState.selectedCartRowIdx < 0) {
          window.AppState.selectedCartRowIdx = items.length - 1;
        }

        container.innerHTML = items.map((item, idx) => {
          const prod = (window.AppState.products || []).find(
            (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
          );
          if (prod && !item.product_id) item.product_id = prod.id;

          const cost = Number(item.cost_price || (prod && prod.cost_price) || 0);
          const isAtOrBelowCost = cost > 0 && Number(item.price) <= cost;
          const isSelected = idx === window.AppState.selectedCartRowIdx;

          // حساب المخزون المتوفر حالياً والكمية المتبقية بعد هذه البيعة
          let stockBadgeHtml = '';
          if (prod) {
            const currentStock = Number(prod.total_stock ?? prod.stock ?? 0);
            const remainingAfterSale = Number((currentStock - Number(item.quantity || 0)).toFixed(2));
            const minStk = Number(prod.min_stock ?? 5);
            const unitLbl = item.unit || prod.unit || 'قطعة';

            const badgeColor =
              remainingAfterSale <= 0
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                : remainingAfterSale <= minStk
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

            stockBadgeHtml = `
              <span class="px-1.5 py-0.5 rounded border font-mono font-black text-[10px] ${badgeColor}" title="الكمية في المخزن حالياً والكمية التي ستبقى بعد بيع هذا السطر">
                📦 متوفر: ${currentStock} ⬅ يبقى: ${remainingAfterSale} ${unitLbl}
              </span>
            `;
          }

          return `
            <div onclick="AppState.selectedCartRowIdx=${idx};"
              class="p-2 rounded-xl border ${isAtOrBelowCost ? 'cart-row-below-cost' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90'} ${isSelected ? 'cart-row-selected' : ''} flex items-center justify-between gap-1.5 shadow-sm transition">
              
              <div class="min-w-0 flex-1">
                <div class="font-bold text-xs truncate">${item.name || item.custom_product_name || 'منتج'}</div>
                <div class="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>${Number(item.price || 0).toFixed(2)} د.ج / ${item.unit || (prod && prod.unit) || 'قطعة'}</span>
                  ${stockBadgeHtml}
                  ${
                    prod
                      ? `<button type="button" onclick="App.toggleCartItemWholesaleUnit(${idx}); App.focusBarcodeMagnet?.(false);" class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 font-sans font-bold hover:bg-indigo-600 hover:text-white transition">${item._isWholesaleMode ? '📦 جملة' : 'وحدة / تسعيرة'}</button>`
                      : ''
                  }
                  ${
                    isAtOrBelowCost
                      ? `<span class="px-1.5 py-0.5 rounded bg-rose-600 text-white font-sans font-black text-[9.5px] animate-pulse">⚠️ ${Math.abs(item.price - cost) < 0.01 ? 'بسعر التكلفة' : 'أقل من التكلفة'} (الشراء: ${cost.toFixed(2)})</span>`
                      : ''
                  }
                </div>
              </div>

              <div class="flex items-center gap-1">
                <button type="button" title="إنقاص الكمية (-)"
                  onclick="AppState.selectedCartRowIdx=${idx}; App.stepCartItemQty(${idx}, -1); App.focusBarcodeMagnet?.(false);"
                  class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white font-mono font-black text-xs">-</button>
                <input id="cartItemQtyInput-${idx}" type="number" step="any" value="${item.quantity}"
                  onkeydown="App.onCartQtyInputKeydown(event, ${idx}, this)"
                  onchange="App.updateCartItemQty(${idx}, this.value); App.focusBarcodeMagnet?.(false);"
                  class="w-11 px-1 py-1 rounded-lg text-center font-mono font-black text-xs">
                <button type="button" title="زيادة الكمية (+)"
                  onclick="AppState.selectedCartRowIdx=${idx}; App.stepCartItemQty(${idx}, 1); App.focusBarcodeMagnet?.(false);"
                  class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white font-mono font-black text-xs">+</button>
              </div>

              <input id="cartItemPriceInput-${idx}" type="number" step="any" value="${Number(item.price || 0).toFixed(2)}"
                onkeydown="App.onCartPriceInputKeydown(event, ${idx}, this)"
                onchange="App.updateCartItemPrice(${idx}, this.value); App.focusBarcodeMagnet?.(false);"
                title="سعر الوحدة (اضغط F12 للتعديل ثم Enter للتأكيد)"
                class="cart-price-input w-16 px-1 py-1 rounded-lg text-center font-mono font-bold text-xs text-blue-600 dark:text-blue-400">

              <div class="w-14 text-left font-mono font-black text-xs">${Number(item.subtotal || 0).toFixed(2)}</div>

              <button type="button" title="حذف الصنف (Delete)"
                onclick="App.removeCartItem(${idx}); App.focusBarcodeMagnet?.(false);"
                class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg">
                <span class="material-symbols-rounded icon-sm">delete</span>
              </button>
            </div>
          `;
        }).join('');

        if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
      };
    },

    // ========================================================================
    // 6. إصلاح أزرار مضاعف الكمية (1x, 2x, 3x, 5x, 10x) والبيع بمبلغ (د.ج)
    // ========================================================================
    fixMultipliersAndReverseAmount() {
      window.App.setQuickMultiplier = function (m) {
        const multVal = Math.max(1, Number(m) || 1);
        window.AppState._quickMultiplier = multVal;

        // تحديث مظهر الأزرار في جميع أشرطة المضاعفات
        document.querySelectorAll('[data-mult], .mult-pill').forEach((btn) => {
          const val = Number(btn.getAttribute('data-mult') || btn.textContent.replace(/[^d]/g, ''));
          const isAct = val === multVal;
          btn.className = `mult-pill px-2.5 py-0.5 rounded-md font-mono font-black text-xs transition ${
            isAct ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`;
        });

        if (multVal > 1 && window.showToast) {
          window.showToast(`✖️ تم تفعيل مضاعف الكمية (×${multVal}) للصنف القادم أو اضغط مرتين لتطبيقه على السطر الحالي`, 'info');
        }
        if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
      };

      // ربط النقر المزدوج على زر المضاعف ليضرب كمية السطر المحدد حالياً في السلة فوراً!
      document.addEventListener('dblclick', (e) => {
        const btn = e.target.closest('[data-mult], .mult-pill');
        if (!btn) return;
        const multVal = Math.max(1, Number(btn.getAttribute('data-mult') || btn.textContent.replace(/[^d]/g, '')) || 1);
        const items = window.App?.currentCart?.items || [];
        if (items.length > 0) {
          const idx = window.AppState.selectedCartRowIdx ?? (items.length - 1);
          if (items[idx]) {
            items[idx].quantity = multVal;
            items[idx].subtotal = Number((multVal * Number(items[idx].price || 0)).toFixed(2));
            window.App.setQuickMultiplier(1);
            window.App.recalcAndRenderCart();
            if (window.showToast) window.showToast(`✅ تم ضبط كمية "${items[idx].name}" إلى ×${multVal}`, 'success');
          }
        }
      });
    },

    // ========================================================================
    // 8. تبسيط وتخصيص نافذة الزبون لتناسب "بيع التجزئة" (Retail Customer Modal)
    // ========================================================================
    upgradeCustomerModalForRetail() {
      const custModal = document.getElementById('customerModal');
      if (!custModal || custModal.dataset.retailUpgraded === '1') return;
      custModal.dataset.retailUpgraded = '1';

      // إضافة خانة باركود بطاقة الوفاء (FID) وطي حقول الجملة (RC / NIF / AI / NIS / CCP) في قسم اختياري
      const rcInput = document.getElementById('custRcInput');
      if (rcInput) {
        const wholesaleSection = document.createElement('details');
        wholesaleSection.className = 'col-span-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50/60 dark:bg-slate-900/50 text-xs mt-1';
        wholesaleSection.innerHTML = `
          <summary class="font-black text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            🏢 + بيانات المؤسسات والجملة والحساب البريدي (RC / NIF / NIS / CCP) — اختياري
          </summary>
          <div id="retailCollapsedWholesaleFields" class="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 mt-2 border-t border-slate-200 dark:border-slate-700"></div>
        `;

        const containerGrid = rcInput.closest('.grid') || rcInput.parentElement.parentElement;
        if (containerGrid) {
          containerGrid.appendChild(wholesaleSection);
          const targetBox = wholesaleSection.querySelector('#retailCollapsedWholesaleFields');
          ['custRcInput', 'custNifInput', 'custAiInput', 'custNisInput'].forEach((id) => {
            const el = document.getElementById(id);
            if (el && el.parentElement) {
              targetBox.appendChild(el.parentElement);
            }
          });
        }
      }
    },

    // ========================================================================
    // 9 & 10. تحويل القائمة الجانبية إلى شريط علوي + تخصيص F10 لإغلاق الوردية و F6 لفاحص السعر
    // ========================================================================
    injectTopHeaderControls() {
      const headerRight = document.querySelector('#top-header > div:last-child');
      if (headerRight && !document.getElementById('btnToggleNavLayoutMode')) {
        const btn = document.createElement('button');
        btn.id = 'btnToggleNavLayoutMode';
        btn.type = 'button';
        btn.className = 'px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-black flex items-center gap-1 transition';
        btn.title = 'تبديل موضع القائمة الرئيسية (قائمة جانبية يمين الشاشة / شريط علوي أفقي)';
        btn.onclick = () => this.toggleNavLayoutMode();
        this.updateNavLayoutButtonLabel(btn);
        headerRight.insertBefore(btn, headerRight.firstChild);
      }

      // تحديث زر فاحص السعر ليحمل الاختصار F6 وإضافة زر إغلاق الوردية (F10)
      document.querySelectorAll('button').forEach((b) => {
        if (b.textContent.includes('فاحص السعر')) {
          b.innerHTML = '<span class="material-symbols-rounded icon-sm">manage_search</span><span>فاحص السعر (F6)</span>';
          b.onclick = () => this.openPriceCheckerModal();
        }
      });
    },

    applyNavLayoutMode(mode) {
      this.navLayoutMode = mode === 'top' ? 'top' : 'side';
      localStorage.setItem('gherbi_nav_layout_mode', this.navLayoutMode);
      document.body.classList.toggle('gherbi-top-nav-mode', this.navLayoutMode === 'top');
      const btn = document.getElementById('btnToggleNavLayoutMode');
      if (btn) this.updateNavLayoutButtonLabel(btn);
      setTimeout(() => {
        if (window.App?.applyCartWidthLayout) {
          window.App.applyCartWidthLayout(window.AppState.posCartWidth || 470);
        }
      }, 100);
    },

    toggleNavLayoutMode() {
      this.applyNavLayoutMode(this.navLayoutMode === 'top' ? 'side' : 'top');
      if (window.showToast) {
        window.showToast(
          this.navLayoutMode === 'top'
            ? '⬆️ تم تحويل القائمة الرئيسية إلى الشريط العلوي لتوسيع شاشة البيع 100%'
            : '➡️ تمت إعادة القائمة الرئيسية إلى الجانب الأيمن',
          'info'
        );
      }
    },

    updateNavLayoutButtonLabel(btn) {
      btn.innerHTML = this.navLayoutMode === 'top'
        ? '<span class="material-symbols-rounded icon-sm">dock_to_right</span><span class="hidden md:inline">قائمة جانبية</span>'
        : '<span class="material-symbols-rounded icon-sm">dock_to_bottom</span><span class="hidden md:inline">قائمة علوية</span>';
    },

    openPriceCheckerModal() {
      this.buildSmartModalsDom();
      window.App.openModal('posPriceCheckerModal');
      const inp = document.getElementById('priceCheckerScanInput');
      if (inp) {
        inp.value = '';
        setTimeout(() => inp.focus(), 50);
      }
    },

    onPriceCheckerInput(val, isEnter = false) {
      const q = String(val || '').trim().toLowerCase();
      const box = document.getElementById('priceCheckerResultCard');
      if (!box) return;
      if (!q) {
        box.innerHTML = '<div class="text-slate-400 font-bold py-6">امسح باركود أي سلعة لعرض سعرها بالدينار والسنتيم والكمية المتوفرة</div>';
        return;
      }

      const found = (window.AppState.products || []).find(
        (p) =>
          String(p.barcode || '').toLowerCase() === q ||
          String(p.plu_code || '').toLowerCase() === q ||
          String(p.name || '').toLowerCase().includes(q)
      );

      if (!found) {
        box.innerHTML = `<div class="py-6 text-rose-500 font-black">❌ لم يتم العثور على سلعة مطابقة لـ "${val}"</div>`;
        return;
      }

      const price = Number(found.selling_price || 0);
      const stock = Number(found.total_stock ?? found.stock ?? 0);
      const centimes = window.App?.formatAlgerianCentimes ? window.App.formatAlgerianCentimes(price) : '';

      box.innerHTML = `
        <div class="text-base font-black text-slate-800 dark:text-white">${found.name}</div>
        <div class="text-xs font-mono text-slate-400">الباركود: ${found.barcode || '—'} | الفئة: ${found.category || 'عام'}</div>
        <div class="text-4xl font-black font-mono text-blue-600 dark:text-blue-400 my-2">${price.toFixed(2)} د.ج</div>
        <div class="text-sm font-black text-amber-600">🇩🇿 بالتداول الجزائري: ${centimes}</div>
        <div class="flex items-center justify-center gap-3 pt-2">
          <span class="px-3 py-1 rounded-full font-mono font-bold ${stock > 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}">
            📦 المخزون المتوفر: ${stock} ${found.unit || 'قطعة'}
          </span>
          <button type="button" onclick="App.addProductToCart(${found.id}, 1); App.closeModal('posPriceCheckerModal');"
            class="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black">
            + إضافة للسلة
          </button>
        </div>
      `;

      if (isEnter) {
        const inp = document.getElementById('priceCheckerScanInput');
        if (inp) inp.select();
      }
    },

    async triggerShiftCloseShortcutF10() {
      if (!window.App) return;
      await window.App.refreshActiveSession?.();
      const active = window.AppState.activeSession;
      if (active) {
        const sessId = active.session ? active.session.id : active.id;
        const sum = await window.api.getCaisseSummary({ sessionId: sessId }).catch(() => null);
        const expected = sum && sum.summary ? Number(sum.summary.expectedBalance || 0) : 0;
        window.App.openCloseShiftModal(sessId, expected);
      } else {
        window.App.openNewShiftModal?.();
      }
    },

    // ========================================================================
    // 11. إصلاح شامل لزر ونظام الإرجاع (Return Mode)
    // ========================================================================
    fixReturnModeEngine() {
      window.App.toggleReturnMode = function () {
        const nextState = !Boolean(window.AppState.isReturnMode || window.AppState.returnMode);
        window.AppState.isReturnMode = nextState;
        window.AppState.returnMode = nextState;

        const btn = document.getElementById('btnReturnMode');
        if (btn) {
          btn.className = nextState
            ? 'px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-1 shadow-lg shadow-rose-600/30 animate-pulse'
            : 'px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold flex items-center gap-1';
        }

        const banner = document.getElementById('gherbiReturnActiveBanner');
        if (banner) {
          banner.classList.toggle('hidden', !nextState);
        }

        // عكس إشارة العناصر الموجودة في السلة الحالية إذا تم تفعيل وضع الإرجاع
        const items = window.App.currentCart?.items || [];
        if (items.length > 0) {
          items.forEach((it) => {
            it.quantity = nextState ? -Math.abs(Number(it.quantity || 1)) : Math.abs(Number(it.quantity || 1));
            it.subtotal = Number((it.quantity * Number(it.price || 0)).toFixed(2));
          });
          window.App.recalcAndRenderCart();
        }

        if (window.showToast) {
          window.showToast(
            nextState
              ? '🔄 تم تفعيل وضع إرجاع السلع — أي سلعة تمسحها أو تضيفها ستُرجع للمخزون'
              : '✅ تم العودة إلى وضع البيع العادي',
            nextState ? 'warning' : 'info'
          );
        }
        if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
      };
    },

    openReturnFromInvoicePicker() {
      if (window.App?.openPosRecentSalesModal) {
        window.App.openPosRecentSalesModal();
      }
    },

    // ========================================================================
    // 12. شريط ذاكرة آخر فاتورة والباقي للزبون + خصم نقاط الولاء عند التسديد
    // ========================================================================
    hookCheckoutForLastSaleMemoryAndLoyalty() {
      const saveLastSaleInfo = (total, paid, change, docNum) => {
        this.lastCompletedSale = {
          total: Number(total || 0),
          paid: Number(paid || 0),
          change: Math.max(0, Number(change || 0)),
          docNum: docNum || '',
          time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
        };
        localStorage.setItem('gherbi_last_completed_sale', JSON.stringify(this.lastCompletedSale));
        this.renderLastSaleMemoryBar();
      };

      const origSubmitSale = window.App.submitSale?.bind(window.App);
      if (origSubmitSale) {
        window.App.submitSale = async function (printMode = 'none') {
          const calc = window.App.recalcCheckoutModal();
          const paidInputVal = parseFloat(document.getElementById('chkPaidAmount')?.value) || calc.total;
          const changeAmt = Math.max(0, Number((paidInputVal - calc.total).toFixed(2)));
          const cart = window.App.currentCart;
          const redeemedPts = Number(cart?._redeemedPoints || 0);
          const cid = cart?.customerId;

          await origSubmitSale(printMode);

          if (cid && redeemedPts > 0 && window.api?.redeemCustomerLoyaltyPoints) {
            await window.api.redeemCustomerLoyaltyPoints({
              customerId: cid,
              points: redeemedPts,
              reason: 'اختزال نقاط ولاء في الكاشير'
            }).catch(() => {});
            if (cart) cart._redeemedPoints = 0;
          }

          if (window.AppState.isReturnMode || window.AppState.returnMode) {
            window.App.toggleReturnMode();
          }

          saveLastSaleInfo(calc.total, paidInputVal, changeAmt, '');
          RetailMaster.syncSmartLoyaltyButtonDisplay();
        };
      }

      const origInstant = window.App.instantConfirmAndCheckout?.bind(window.App);
      if (origInstant) {
        window.App.instantConfirmAndCheckout = async function (mode) {
          const totals = window.App.recalcCart();
          const cart = window.App.currentCart;
          const redeemedPts = Number(cart?._redeemedPoints || 0);
          const cid = cart?.customerId;

          await origInstant(mode);

          if (cid && redeemedPts > 0 && window.api?.redeemCustomerLoyaltyPoints) {
            await window.api.redeemCustomerLoyaltyPoints({
              customerId: cid,
              points: redeemedPts,
              reason: 'اختزال نقاط ولاء في تذكرة فورية'
            }).catch(() => {});
            if (cart) cart._redeemedPoints = 0;
          }

          if (window.AppState.isReturnMode || window.AppState.returnMode) {
            window.App.toggleReturnMode();
          }

          saveLastSaleInfo(totals.total, totals.total, 0, '');
          RetailMaster.syncSmartLoyaltyButtonDisplay();
        };
      }
    },

    renderLastSaleMemoryBar() {
      const bar = document.getElementById('gherbiLastSaleMemoryBar');
      if (!bar) return;
      const info = this.lastCompletedSale;
      if (!info || !info.total) {
        bar.classList.add('hidden');
        return;
      }
      bar.classList.remove('hidden');
      bar.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-emerald-700 dark:text-emerald-300">🧾 آخر عملية (${info.time || ''}):</span>
          <strong class="font-mono">${Number(info.total).toFixed(2)} د.ج</strong>
        </div>
        <div class="flex items-center gap-2">
          <span>المدفوع: <strong class="font-mono">${Number(info.paid).toFixed(2)}</strong></span>
          <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
            الباقي للزبون: ${Number(info.change).toFixed(2)} د.ج
          </span>
        </div>
      `;
    },

    // ========================================================================
    // 5 (تتمة). إضافة تبويب تقارير المدير "تنبيهات البيع بسعر التكلفة أو بخسارة"
    // ========================================================================
    upgradeSalesHistoryAndOwnerCostReport() {
      const origRenderAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (origRenderAnalytics) {
        window.App.renderAnalyticsView = async function () {
          await origRenderAnalytics();
          const root = document.getElementById('analytics-view-root');
          if (!root || document.getElementById('ownerBelowCostReportCard')) return;

          const logs = (await window.api?.getAuditLogs?.().catch(() => [])) || [];
          const costAlerts = logs.filter((l) => l.action_type === 'SALE_AT_OR_BELOW_COST');

          const card = document.createElement('div');
          card.id = 'ownerBelowCostReportCard';
          card.className = 'bg-white dark:bg-slate-800 border-2 border-rose-500/40 rounded-2xl p-5 mt-5 space-y-3';
          card.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">🚨</span>
                <div>
                  <h3 class="font-black text-sm text-rose-600">سجل رقابة المدير: تنبيهات البيع بسعر التكلفة أو بخسارة (${costAlerts.length})</h3>
                  <p class="text-[11px] text-slate-400">يرصد تلقائياً أي عملية قام فيها البائع بتعديل سعر السلعة (F12) إلى سعر الشراء أو أقل منه</p>
                </div>
              </div>
            </div>
            ${
              costAlerts.length === 0
                ? '<div class="py-6 text-center text-emerald-600 font-bold text-xs">✅ سجل سليم 100% — لم يتم تسجيل أي عملية بيع بسعر التكلفة أو بخسارة</div>'
                : `<div class="overflow-x-auto max-h-64">
                    <table class="w-full text-xs text-right">
                      <thead>
                        <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                          <th class="py-2">التوقيت</th>
                          <th class="py-2">البائع</th>
                          <th class="py-2">الصنف</th>
                          <th class="py-2">سعر الشراء</th>
                          <th class="py-2">السعر المباع به</th>
                          <th class="py-2">الكمية</th>
                          <th class="py-2">الفارق للوحدة</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                        ${costAlerts.map((a) => {
                          let d = {};
                          try { d = JSON.parse(a.details_json || '{}'); } catch (_) {}
                          return `
                            <tr class="hover:bg-rose-500/5">
                              <td class="py-2 font-mono text-[11px]">${String(a.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                              <td class="py-2 font-bold">${a.user_name || 'Cashier'}</td>
                              <td class="py-2 font-black text-rose-600">${d.product_name || 'منتج'}</td>
                              <td class="py-2 font-mono font-bold">${Number(d.cost_price || 0).toFixed(2)} د.ج</td>
                              <td class="py-2 font-mono font-black text-rose-600">${Number(d.sold_price || 0).toFixed(2)} د.ج</td>
                              <td class="py-2 font-mono">${d.quantity || 1}</td>
                              <td class="py-2 font-mono font-bold text-rose-500">-${Number(d.loss_per_unit || 0).toFixed(2)} د.ج</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>`
            }
          `;
          root.appendChild(card);
        };
      }
    },

    // ========================================================================
    // اختصارات الكيبورد الشاملة (Ctrl+N, F6, F8, F9, F10, F12, Ctrl+X, Delete)
    // ========================================================================
    bindMasterKeyboardShortcuts() {
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          const isPosActive = Boolean(posSec && posSec.classList.contains('active'));
          if (!isPosActive) return;

          // Ctrl + N -> فتح سلة جديدة فوراً
          if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
            e.preventDefault();
            e.stopPropagation();
            window.App.newCartTab();
            if (window.showToast) window.showToast('🛒 تم فتح سلة جديدة (Ctrl+N)', 'info');
            return;
          }

          // Ctrl + X -> تبديل مضاعف الكمية السريع (1x -> 2x -> 3x -> 5x -> 10x)
          if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
            const activeTag = (document.activeElement?.tagName || '').toUpperCase();
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
              e.preventDefault();
              const seq = [1, 2, 3, 5, 10];
              const cur = window.AppState._quickMultiplier || 1;
              const next = seq[(seq.indexOf(cur) + 1) % seq.length];
              window.App.setQuickMultiplier(next);
              return;
            }
          }

          // F6 -> فاحص السعر الفوري
          if (e.key === 'F6') {
            e.preventDefault();
            e.stopPropagation();
            this.openPriceCheckerModal();
            return;
          }

          // F8 -> فتح نافذة بطاقة الوفاء واختيار الزبون مع التركيز المباشر على حقل مسح البطاقة
          if (e.key === 'F8') {
            e.preventDefault();
            e.stopPropagation();
            this.openSmartLoyaltyModal('scan');
            return;
          }

          // F9 -> فتح نافذة الزبون والوفاء مع التركيز المباشر على خانة اختزال النقاط
          if (e.key === 'F9') {
            e.preventDefault();
            e.stopPropagation();
            this.openSmartLoyaltyModal('redeem');
            return;
          }

          // F10 -> إغلاق الوردية (Z-Report)
          if (e.key === 'F10') {
            e.preventDefault();
            e.stopPropagation();
            this.triggerShiftCloseShortcutF10();
            return;
          }

          // Delete -> حذف السطر المحدد في السلة عندما لا يكون المؤشر داخل نص
          if (e.key === 'Delete') {
            const activeEl = document.activeElement;
            const isBarcodeEmpty = activeEl && activeEl.id === 'barcodeInput' && !activeEl.value;
            const notTyping = !activeEl || activeEl === document.body || isBarcodeEmpty;
            if (notTyping && !document.querySelector('.modal-overlay.active')) {
              const items = window.App.currentCart?.items || [];
              if (items.length > 0) {
                e.preventDefault();
                const idx = window.AppState.selectedCartRowIdx ?? (items.length - 1);
                window.App.removeCartItem(idx);
              }
            }
          }
        },
        true
      );
    }
  };

  window.RetailMaster = RetailMaster;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailMaster.init());
  } else {
    RetailMaster.init();
  }
})();


/* ==================== [MODULE: gherbi-retail-v2-enhancements.js] ==================== */
/**
 * gherbi-retail-v2-enhancements.js (Repaired & Hardened Edition)
 * يتضمن:
 * - حاسبة الصرف الفورية + أزرار الفئات النقدية (+200, +500, +1000, +2000) + اختصار Alt+C
 * - نافذة بطاقة زبون التجزئة (Client Détail & Fidélité) + زر (✏️ تعديل) داخل نافذة F8
 * - شريط التنقل العلوي الاحترافي + فصل اختصار المنتج الحر (Alt+F) عن F8
 */

'use strict';

(function initGherbiRetailV2() {
  const RetailV2 = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        const steps = [
          'setupEnterpriseTopRibbon',
          'fixFreeItemShortcutConflict',
          'injectInlineChangeCalculatorAndQuickJump',
          'redesignCustomerModalForRetail',
          'enhanceF8ModalWithEditButtons',
          'bindV2Shortcuts'
        ];
        steps.forEach((fn) => {
          try {
            if (typeof this[fn] === 'function') this[fn]();
          } catch (err) {
            console.warn('[RetailV2 Init Warning]:', fn, err.message);
          }
        });
      }, 200);
    },

    setupEnterpriseTopRibbon() {
      const mainContent = document.getElementById('main-content');
      const topHeader = document.getElementById('top-header');
      if (!mainContent || !topHeader) return;

      let topNav = document.getElementById('gherbiEnterpriseTopNav');
      if (!topNav) {
        topNav = document.createElement('nav');
        topNav.id = 'gherbiEnterpriseTopNav';
        topHeader.insertAdjacentElement('afterend', topNav);
      }
      this.renderEnterpriseTopRibbon();
    },

    renderEnterpriseTopRibbon() {
      const topNav = document.getElementById('gherbiEnterpriseTopNav');
      if (!topNav) return;
      const navButtons = Array.from(document.querySelectorAll('#sidebar-nav .nav-btn'));
      if (!navButtons.length) return;

      topNav.innerHTML = navButtons.map((btn) => {
        let viewId = btn.getAttribute('data-view') || '';
        if (!viewId) {
          const m = (btn.getAttribute('onclick') || '').match(/switchView\(\s*['"]([^'"]+)['"]\s*\)/);
          if (m && m[1]) viewId = m[1];
        }
        if (!viewId) viewId = 'pos';
        const iconEl = btn.querySelector('.material-symbols-rounded, svg');
        const labelEl = btn.querySelector('.sidebar-label') || btn.querySelector('span:last-child');
        const labelText = labelEl ? labelEl.textContent.trim() : btn.textContent.trim();
        const isActive = btn.classList.contains('active');

        return `
          <button type="button" data-topview="${viewId}" onclick="App.switchView('${viewId}')"
            class="gherbi-topnav-item ${isActive ? 'active' : ''}">
            ${iconEl ? iconEl.outerHTML : ''}
            <span>${labelText}</span>
          </button>
        `;
      }).join('');
    },

    highlightActiveTopRibbon(viewId) {
      document.querySelectorAll('#gherbiEnterpriseTopNav .gherbi-topnav-item').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.topview === viewId);
      });
    },

    fixFreeItemShortcutConflict() {
      document.querySelectorAll('button').forEach((btn) => {
        if ((btn.textContent || '').includes('منتج حر')) {
          btn.innerHTML = '<span class="material-symbols-rounded icon-sm">add_shopping_cart</span><span>منتج حر (Alt+F)</span>';
          btn.title = 'إضافة منتج حر غير مسجل (اختصار: Alt + F)';
        }
      });
    },

    // ========================================================================
    // حاسبة الصرف الفورية وأزرار الأوراق النقدية (+200, +500, +1000, +2000)
    // ========================================================================
    injectInlineChangeCalculatorAndQuickJump() {
      const multBar = document.getElementById('posQuickMultiplierBar');
      if (multBar && !document.getElementById('btnQuickJumpChangeCalc')) {
        const jumpBtn = document.createElement('button');
        jumpBtn.id = 'btnQuickJumpChangeCalc';
        jumpBtn.type = 'button';
        jumpBtn.onclick = () => this.focusInlineReceivedCash();
        jumpBtn.className = 'px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-black hover:bg-blue-600 hover:text-white transition flex items-center gap-1 text-[11px]';
        jumpBtn.innerHTML = '<span>💵 حساب الصرف (Alt+C)</span>';
        multBar.appendChild(jumpBtn);
      }

      const totalEl = document.getElementById('cartTotalText');
      const totalRow = totalEl ? totalEl.closest('.flex.items-center.justify-between') : null;

      if (totalRow && !document.getElementById('gherbiInlineChangeCalc')) {
        const calcBox = document.createElement('div');
        calcBox.id = 'gherbiInlineChangeCalc';
        calcBox.className = 'gherbi-inline-change-box';
        calcBox.innerHTML = `
          <div class="flex items-center justify-between gap-1.5">
            <label for="gherbiReceivedCashInput" class="text-[11px] font-black text-slate-700 dark:text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer">
              <span>💵 المبلغ المستلم:</span>
              <kbd class="px-1 py-0.2 rounded bg-blue-600 text-white font-mono text-[9px]">Alt+C</kbd>
            </label>
            <div class="flex items-center gap-1 flex-1 max-w-[180px]">
              <input id="gherbiReceivedCashInput" type="number" step="any" min="0" placeholder="أدخل ما أعطاك الزبون..."
                oninput="RetailV2.recalcInlineChange()"
                onkeydown="RetailV2.onInlineCashKeydown(event)"
                class="w-full px-2 py-1 rounded-lg text-center font-mono font-black text-xs bg-white dark:bg-slate-900 border-2 border-emerald-500 focus:ring-2 focus:ring-emerald-400">
              <button type="button" onclick="RetailV2.setInlineCashValue(0)" title="مسح المبلغ"
                class="px-1.5 py-1 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-black hover:bg-rose-500 hover:text-white">✕</button>
            </div>
          </div>
          <div class="flex items-center justify-between gap-1 flex-wrap">
            <div class="flex items-center gap-1">
              <button type="button" onclick="RetailV2.addInlineCashNote(200)" class="gherbi-banknote-pill">+200</button>
              <button type="button" onclick="RetailV2.addInlineCashNote(500)" class="gherbi-banknote-pill">+500</button>
              <button type="button" onclick="RetailV2.addInlineCashNote(1000)" class="gherbi-banknote-pill">+1000</button>
              <button type="button" onclick="RetailV2.addInlineCashNote(2000)" class="gherbi-banknote-pill">+2000</button>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">الباقي للزبون:</span>
              <span id="gherbiInlineChangeResult" class="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">0.00 د.ج</span>
            </div>
          </div>
          <div id="gherbiInlineChangeCentimes" class="text-left text-[10px] font-extrabold text-amber-600 dark:text-amber-400 hidden"></div>
        `;
        totalRow.parentElement.insertBefore(calcBox, totalRow);
      }

      if (!window.App._v2ClearCartHooked && typeof window.App.clearCurrentCart === 'function') {
        const origClear = window.App.clearCurrentCart.bind(window.App);
        window.App.clearCurrentCart = function (...args) {
          const r = origClear(...args);
          RetailV2.setInlineCashValue(0);
          return r;
        };
        window.App._v2ClearCartHooked = true;
      }
    },

    focusInlineReceivedCash() {
      const inp = document.getElementById('gherbiReceivedCashInput');
      if (inp) {
        inp.focus();
        inp.select();
      }
    },

    setInlineCashValue(val) {
      const inp = document.getElementById('gherbiReceivedCashInput');
      if (!inp) return;
      inp.value = Number(val) > 0 ? String(val) : '';
      this.recalcInlineChange();
    },

    addInlineCashNote(noteVal) {
      const inp = document.getElementById('gherbiReceivedCashInput');
      if (!inp) return;
      const cur = parseFloat(inp.value) || 0;
      inp.value = String(cur + Number(noteVal || 0));
      this.recalcInlineChange();
      inp.focus();
    },

    getCurrentTotalDue(forcedTotal) {
      if (forcedTotal !== undefined && forcedTotal !== null && !isNaN(Number(forcedTotal))) {
        return Number(forcedTotal);
      }
      try {
        const cart = window.App?.currentCart;
        if (cart && Array.isArray(cart.items)) {
          const sub = cart.items.reduce((acc, it) => {
            const q = Number(it.quantity ?? 1);
            const p = Number(it.price ?? 0);
            const line = it.subtotal !== undefined ? Number(it.subtotal) : (q * p);
            return acc + (isNaN(line) ? 0 : line);
          }, 0);
          const disc = Number(cart.discount ?? document.getElementById('cartDiscountInput')?.value ?? 0);
          const cpDisc = Number(cart.couponDiscount || 0);
          return Math.max(0, Number((sub - disc - cpDisc).toFixed(2)));
        }
      } catch (_) {}
      const txt = document.getElementById('cartTotalText')?.textContent || '0';
      const m = String(txt).match(/-?\d+(?:\.\d+)?/);
      return m ? parseFloat(m[0]) : 0;
    },

    recalcInlineChange(forcedTotal) {
      const inp = document.getElementById('gherbiReceivedCashInput');
      const resEl = document.getElementById('gherbiInlineChangeResult');
      const centEl = document.getElementById('gherbiInlineChangeCentimes');
      if (!inp || !resEl) return;

      const totalDue = this.getCurrentTotalDue(forcedTotal);
      const rawVal = String(inp.value || '').trim();
      const received = parseFloat(rawVal);

      if (!rawVal || !Number.isFinite(received) || received <= 0) {
        resEl.textContent = '0.00 د.ج';
        resEl.className = 'font-mono font-black text-sm text-slate-500';
        if (centEl) centEl.classList.add('hidden');
        return;
      }

      const diff = Number((received - totalDue).toFixed(2));
      if (diff >= 0) {
        resEl.textContent = `${diff.toFixed(2)} د.ج`;
        resEl.className = 'font-mono font-black text-base text-emerald-600 dark:text-emerald-400';
        if (centEl) {
          const centStr = window.App?.formatAlgerianCentimes
            ? window.App.formatAlgerianCentimes(diff)
            : `${Math.round(diff * 100).toLocaleString('fr-DZ')} سنتيم`;
          centEl.textContent = `🇩🇿 الصرف بالتداول الجزائري: ${centStr}`;
          centEl.classList.remove('hidden');
        }
      } else {
        const missing = Math.abs(diff);
        resEl.textContent = `ناقص: ${missing.toFixed(2)} د.ج`;
        resEl.className = 'font-mono font-black text-sm text-rose-600';
        if (centEl) {
          centEl.textContent = `⚠️ المبلغ المستلم أقل من الإجمالي المستحق بـ ${missing.toFixed(2)} د.ج`;
          centEl.classList.remove('hidden');
        }
      }
    },

    onInlineCashKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        const received = parseFloat(event.target.value) || 0;
        window.App.openCheckoutModal?.();
        setTimeout(() => {
          const chkPaid = document.getElementById('chkPaidAmount');
          if (chkPaid && received > 0) {
            chkPaid.value = received.toFixed(2);
            window.App.recalcCheckoutModal?.();
          }
        }, 60);
      }
    },

    // ========================================================================
    // نافذة بطاقة زبون التجزئة (Client Détail & Fidélité) + زر (✏️ تعديل) داخل F8
    // ========================================================================
    redesignCustomerModalForRetail() {
      const modal = document.getElementById('customerModal');
      if (!modal || modal.dataset.v2RetailDesigned === '1') return;
      modal.dataset.v2RetailDesigned = '1';

      modal.innerHTML = `
        <div class="modal-content w-full max-w-2xl p-0 overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          <div class="flex items-center justify-between px-5 py-3 bg-slate-900 text-white">
            <div class="flex items-center gap-2">
              <span class="text-lg">👤</span>
              <h3 class="text-sm font-black">بطاقة زبون التجزئة (Client Détail &amp; Fidélité)</h3>
            </div>
            <button type="button" onclick="App.closeModal('customerModal')" class="text-slate-400 hover:text-rose-400 font-black text-base">✕</button>
          </div>

          <div class="p-4 space-y-3.5 bg-slate-50 dark:bg-slate-900 max-h-[82vh] overflow-y-auto">
            <input type="hidden" id="custIdInput">
            <input type="hidden" id="custEditId">

            <!-- الإطار الأول: البيانات الأساسية (Principales) -->
            <fieldset class="sds-retail-fieldset">
              <legend class="sds-retail-legend">Principales — البيانات الأساسية للزبون</legend>
              <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1">
                <div class="md:col-span-5">
                  <label class="block font-bold text-slate-500 mb-1">كود البطاقة / المرجع (Code FID) :</label>
                  <input id="custFidCodePreview" type="text" readonly placeholder="يُولّد تلقائياً (FID-...)"
                    class="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-amber-600">
                </div>

                <div class="md:col-span-7">
                  <label class="block font-black text-slate-700 dark:text-slate-200 mb-1">الاسم الكامل للزبون (Nom &amp; Prénom) * :</label>
                  <input id="custNameInput" type="text" placeholder="مثال: أمين بن يحيى..."
                    class="w-full px-3 py-1.5 rounded-lg border-2 border-blue-500/60 font-black text-sm">
                </div>

                <div class="md:col-span-5">
                  <label class="block font-bold text-slate-500 mb-1">نوع التسعيرة / التصنيف (Famille) :</label>
                  <select id="custPriceTierInput" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold">
                    <option value="retail">زبون تجزئة عادي (Détail)</option>
                    <option value="wholesale">زبون مميز / تسعيرة خاصة (VIP)</option>
                  </select>
                </div>

                <div class="md:col-span-7 flex items-center gap-5 pt-4 pr-2">
                  <label class="flex items-center gap-1.5 cursor-pointer font-black text-amber-600">
                    <input id="custVipCheckbox" type="checkbox" checked class="rounded text-amber-500">
                    <span>👑 عضو نادي الأوفياء (Fidélité VIP)</span>
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer font-bold text-rose-600">
                    <input id="custBlockedCheckbox" type="checkbox" class="rounded text-rose-500">
                    <span>🚫 تجميد الكريدي (Bloqué)</span>
                  </label>
                </div>
              </div>
            </fieldset>

            <!-- الإطار الثاني: البيانات التكميلية (Complémentaires) -->
            <fieldset class="sds-retail-fieldset">
              <legend class="sds-retail-legend">Complémentaires — تفاصيل الاتصال والوفاء والدين</legend>

              <div class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 mb-3 pt-1">
                <button type="button" onclick="RetailV2.switchClientTab('coord')" data-ctab="coord" class="sds-retail-tab-btn active">
                  📞 الهاتف والعنوان (Coordonnées)
                </button>
                <button type="button" onclick="RetailV2.switchClientTab('fidelite')" data-ctab="fidelite" class="sds-retail-tab-btn">
                  ⭐ نقاط الولاء (Fidélité)
                </button>
                <button type="button" onclick="RetailV2.switchClientTab('credit')" data-ctab="credit" class="sds-retail-tab-btn">
                  💳 الديون وسقف الكريدي (Crédit)
                </button>
              </div>

              <!-- تبويب 1: الهاتف والعنوان -->
              <div id="retailClientTabCoord" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">رقم الهاتف (Tel / WhatsApp) :</label>
                  <input id="custPhoneInput" type="text" placeholder="0550..."
                    class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-mono font-bold text-sm">
                </div>
                <div>
                  <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">الولاية (Wilaya) :</label>
                  <select id="custWilayaSelect"
                    class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold">
                    <option value="">اختر الولاية...</option>
                    <option value="25 - قسنطينة">25 - قسنطينة</option>
                    <option value="16 - الجزائر">16 - الجزائر</option>
                    <option value="43 - ميلة">43 - ميلة</option>
                    <option value="19 - سطيف">19 - سطيف</option>
                    <option value="31 - وهران">31 - وهران</option>
                    <option value="23 - عنابة">23 - عنابة</option>
                    <option value="09 - البليدة">09 - البليدة</option>
                    <option value="05 - باتنة">05 - باتنة</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">العنوان / الحي / ملاحظات (Adresse &amp; Notes) :</label>
                  <input id="custAddressInput" type="text" placeholder="الحي، الشارع، أو ملاحظة خاصة بالزبون..."
                    class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold">
                </div>
              </div>

              <!-- تبويب 2: نقاط الولاء -->
              <div id="retailClientTabFidelite" class="hidden grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                <div>
                  <label class="block font-black text-amber-600 dark:text-amber-400 mb-1">⭐ رصيد نقاط الولاء الحالي (Points de Fidélité) :</label>
                  <input id="custLoyaltyPointsInput" type="number" step="1" value="0" readonly
                    class="w-full px-3 py-2 rounded-lg border-2 border-amber-500/60 font-mono font-black text-base text-center text-amber-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed">
                  <button type="button" id="btnUnlockLoyaltyPtsWithPin" onclick="window.RetailV3 && window.RetailV3.openLoyaltyPinVerifyModal()"
                    class="mt-2 w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow">
                    <span>🔐</span>
                    <span>تعديل رصيد النقاط بكود المدير السري</span>
                  </button>
                </div>
                <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] leading-relaxed">
                  <div class="font-black text-amber-700 dark:text-amber-300 mb-0.5">💡 كيف تعمل بطاقة الوفاء؟</div>
                  <div>تُجمع النقاط تلقائياً مع كل عملية شراء، ويمكن للبائع مسح بطاقة الزبون أو ضغط <kbd class="px-1 rounded bg-slate-800 text-white font-mono">F8</kbd> ثم <kbd class="px-1 rounded bg-emerald-600 text-white font-mono">F9</kbd> لتحويل النقاط إلى تخفيض مالي فوري.</div>
                </div>
              </div>

              <!-- تبويب 3: الديون وسقف الكريدي -->
              <div id="retailClientTabCredit" class="hidden grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">الدين الأولي السابق (Solde initial د.ج) :</label>
                  <input id="custInitDebtInput" type="number" step="any" value="0"
                    class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-mono font-bold text-center">
                </div>
                <div>
                  <label class="block font-bold text-rose-600 dark:text-rose-400 mb-1">سقف الدين المسموح (Plafond Crédit د.ج) :</label>
                  <input id="custCreditLimitInput" type="number" step="any" value="0"
                    class="w-full px-3 py-1.5 rounded-lg border border-rose-500/40 font-mono font-bold text-center">
                </div>
              </div>

              <div class="hidden" aria-hidden="true">
                <input id="custRcInput" type="text">
                <input id="custNifInput" type="text">
                <input id="custAiInput" type="text">
                <input id="custNisInput" type="text">
                <input id="custCcpNumberInput" type="text">
                <input id="custCcpKeyInput" type="text">
                <input id="custRipInput" type="text">
                <input id="custCommuneInput" type="text">
              </div>
            </fieldset>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('customerModal')"
                class="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-500 hover:text-white font-black transition">
                ✕ إغلاق (Fermer)
              </button>
              <button type="button" onclick="RetailV2.saveRetailCustomerAndSync()"
                class="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 transition">
                <span>✔</span>
                <span>حفظ بيانات الزبون (Enregistrer)</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // اعتراض فتح نافذة الزبون لتعبئة جميع الحقول بما فيها رصيد النقاط وكود البطاقة FID
      const origOpenCust = window.App.openCustomerModal?.bind(window.App);
      window.App.openCustomerModal = function (custOrId = null) {
        const cid = custOrId && typeof custOrId === 'object' ? custOrId.id : custOrId;
        window.AppState.editingCustomerId = cid ? Number(cid) : null;
        if (origOpenCust) {
          try { origOpenCust(custOrId); } catch (_) {}
        }

        const cust = cid ? (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid)) : null;
        document.getElementById('custIdInput').value = cust ? String(cust.id) : '';
        document.getElementById('custEditId').value = cust ? String(cust.id) : '';
        document.getElementById('custFidCodePreview').value = cust ? ('FID-' + String(cust.id).padStart(5, '0')) : 'يُولّد تلقائياً عند الحفظ';
        document.getElementById('custNameInput').value = cust ? (cust.name || '') : '';
        document.getElementById('custPhoneInput').value = cust ? (cust.phone || '') : '';
        document.getElementById('custAddressInput').value = cust ? (cust.address || '') : '';
        document.getElementById('custPriceTierInput').value = cust ? (cust.price_tier || 'retail') : 'retail';
        document.getElementById('custLoyaltyPointsInput').value = cust ? Number(cust.loyalty_points || 0) : 0;
        document.getElementById('custInitDebtInput').value = cust ? Number(cust.initial_debt || 0) : 0;
        document.getElementById('custCreditLimitInput').value = cust ? Number(cust.credit_limit || 0) : 0;

        RetailV2.switchClientTab('coord');
        const modalEl = document.getElementById('customerModal');
        if (modalEl) {
          modalEl.style.zIndex = '10220';
          modalEl.classList.add('active');
        }
        setTimeout(() => document.getElementById('custNameInput')?.focus(), 60);
      };
    },

    switchClientTab(tabKey) {
      document.querySelectorAll('[data-ctab]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.ctab === tabKey);
      });
      document.getElementById('retailClientTabCoord')?.classList.toggle('hidden', tabKey !== 'coord');
      document.getElementById('retailClientTabFidelite')?.classList.toggle('hidden', tabKey !== 'fidelite');
      document.getElementById('retailClientTabCredit')?.classList.toggle('hidden', tabKey !== 'credit');
    },

    async saveRetailCustomerAndSync() {
      if (window.App && typeof window.App.saveCustomer === 'function') {
        await window.App.saveCustomer();
      } else if (window.App && typeof window.App.saveCustomerFromModal === 'function') {
        await window.App.saveCustomerFromModal();
      }
      if (window.RetailMaster) {
        window.RetailMaster.renderSmartLoyaltyCustomersList(
          document.getElementById('smartLoyaltyScanOrSearchInput')?.value || ''
        );
        window.RetailMaster.refreshSmartModalSelectedCustomer();
        window.RetailMaster.syncSmartLoyaltyButtonDisplay();
      }
    },

    enhanceF8ModalWithEditButtons() {
      const ensureF8EditBtn = () => {
        const selectedCardHeader = document.querySelector('#smartSelectedCustCard > div:first-child > div:first-child');
        if (selectedCardHeader && !document.getElementById('btnEditSelectedCustInF8')) {
          const editBtn = document.createElement('button');
          editBtn.id = 'btnEditSelectedCustInF8';
          editBtn.type = 'button';
          editBtn.onclick = () => this.editCurrentCustomerFromF8();
          editBtn.className = 'mr-2 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-slate-950 font-black text-[11px] transition inline-flex items-center gap-1';
          editBtn.innerHTML = '<span>✏️ تعديل بيانات الزبون</span>';
          selectedCardHeader.appendChild(editBtn);
        }
      };

      ensureF8EditBtn();
      setInterval(ensureF8EditBtn, 700);

      if (window.RetailMaster) {
        window.RetailMaster.renderSmartLoyaltyCustomersList = function (query = '') {
          const box = document.getElementById('smartLoyaltyCustomersListBox');
          if (!box) return;
          const q = String(query || '').trim().toLowerCase();
          const customers = window.AppState.customers || [];
          const curCid = Number(window.App?.currentCart?.customerId || 0);

          const filtered = customers.filter((c) => {
            if (!q) return true;
            const fid = 'fid-' + String(c.id).padStart(5, '0');
            return (
              String(c.name || '').toLowerCase().includes(q) ||
              String(c.phone || '').toLowerCase().includes(q) ||
              fid.includes(q) ||
              String(c.id) === q
            );
          });

          if (filtered.length === 0) {
            box.innerHTML = '<div class="py-4 text-center text-slate-400 font-bold">لا يوجد زبون مطابق — اضغط (+ زبون جديد) لإضافته</div>';
            return;
          }

          box.innerHTML = filtered.slice(0, 60).map((c) => {
            const isSelected = Number(c.id) === curCid;
            const pts = Number(c.loyalty_points || 0);
            const fidCode = 'FID-' + String(c.id).padStart(5, '0');
            return `
              <div onclick="RetailMaster.pickCustomerInSmartModal(${c.id})"
                class="p-2 flex items-center justify-between cursor-pointer hover:bg-blue-600/10 transition ${isSelected ? 'bg-blue-600/15 font-black' : ''}">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono text-[10px] font-bold">${fidCode}</span>
                  <span class="font-bold truncate">${c.name}</span>
                  ${c.phone ? `<span class="text-slate-400 font-mono text-[11px]">(${c.phone})</span>` : ''}
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-mono font-bold text-[10.5px]">⭐ ${pts} نقطة</span>
                  <button type="button" onclick="event.stopPropagation(); RetailV2.openEditCustomerFromF8Row(${c.id})"
                    class="px-2.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-800 dark:text-amber-300 hover:text-slate-950 font-black text-[10.5px] transition flex items-center gap-1"
                    title="تعديل بيانات أو رصيد نقاط هذا الزبون">
                    <span>✏️ تعديل</span>
                  </button>
                </div>
              </div>
            `;
          }).join('');
        };
      }
    },

    editCurrentCustomerFromF8() {
      const cid = window.App?.currentCart?.customerId;
      if (!cid) {
        if (window.showToast) window.showToast('يرجى اختيار زبون أولاً لتعديل بياناته، أو اضغط (+ زبون جديد)', 'warning');
        return;
      }
      this.redesignCustomerModalForRetail();
      window.App.openCustomerModal(Number(cid));
    },

    openEditCustomerFromF8Row(customerId) {
      if (!customerId) return;
      if (window.RetailMaster) {
        window.RetailMaster.pickCustomerInSmartModal(customerId);
      }
      this.redesignCustomerModalForRetail();
      window.App.openCustomerModal(Number(customerId));
    },

    bindV2Shortcuts() {
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;

          if (e.altKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
            e.preventDefault();
            e.stopPropagation();
            this.focusInlineReceivedCash();
            return;
          }
          if (e.altKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
            e.preventDefault();
            e.stopPropagation();
            window.App.openFreeItemModal?.();
            return;
          }
        },
        true
      );
    }
  };

  window.RetailV2 = RetailV2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailV2.init());
  } else {
    RetailV2.init();
  }
})();


/* ==================== [MODULE: gherbi-retail-v3-master.js] ==================== */
/**
 * gherbi-retail-v3-master.js
 * المحرك الشامل للمتطلبات الـ 8 لبيئة بيع التجزئة في Gherbi.Ai POS
 */

'use strict';

(function initGherbiRetailV3Master() {
  const RetailV3 = {
    retailQuickPresets: {
      supermarket: [
        { icon: '🥖', name: 'خبز عادي (Baguette)', price: 15, category: 'مخبزة ويوميات', pinned: true, noLoyalty: true },
        { icon: '🥖', name: 'خبز كومبلي / شعير', price: 30, category: 'مخبزة ويوميات', pinned: true },
        { icon: '🥛', name: 'حليب شكارة (مقنن)', price: 25, category: 'ألبان', pinned: true, noLoyalty: true },
        { icon: '🥚', name: 'بيض (بالحبة)', price: 25, category: 'مواد غذائية', pinned: true },
        { icon: '🥚', name: 'بلاطو بيض (30 حبة)', price: 680, category: 'مواد غذائية', pinned: true },
        { icon: '🛍️', name: 'كيس بلاستيكي كبير', price: 10, category: 'أكياس', pinned: true, noLoyalty: true },
        { icon: '💧', name: 'قارورة ماء صغيرة 0.5L', price: 30, category: 'مشروبات', pinned: true },
        { icon: '🧃', name: 'عصير أطفال صغير', price: 40, category: 'مشروبات', pinned: false },
        { icon: '🕯️', name: 'شمعة / ولاعة', price: 35, category: 'متفرقات', pinned: false },
        { icon: '🧼', name: 'جافيل / غسول باللتر', price: 60, category: 'تنظيف', pinned: false }
      ],
      produce: [
        { icon: '🥔', name: 'بطاطا (1 كغ)', price: 90, category: 'خضر وفواكه', pinned: true },
        { icon: '🍅', name: 'طماطم (1 كغ)', price: 120, category: 'خضر وفواكه', pinned: true },
        { icon: '🧅', name: 'بصل (1 كغ)', price: 80, category: 'خضر وفواكه', pinned: true },
        { icon: '🌶️', name: 'فلفل حلو / حار (1 كغ)', price: 140, category: 'خضر وفواكه', pinned: false },
        { icon: '🥕', name: 'جزر (1 كغ)', price: 90, category: 'خضر وفواكه', pinned: false },
        { icon: '🍎', name: 'تفاح محلي (1 كغ)', price: 350, category: 'خضر وفواكه', pinned: false },
        { icon: '🍌', name: 'موز (1 كغ)', price: 420, category: 'خضر وفواكه', pinned: false },
        { icon: '🌴', name: 'تمر دقلة نور (1 كغ)', price: 600, category: 'خضر وفواكه', pinned: true }
      ],
      bakery: [
        { icon: '🥐', name: 'كرواسون / بتي بان', price: 35, category: 'مخبزة', pinned: true },
        { icon: '🫓', name: 'خبز الدار / مطلوع', price: 50, category: 'مخبزة', pinned: true },
        { icon: '🍰', name: 'قطعة باتيسري (طارت)', price: 120, category: 'مرطبات', pinned: true },
        { icon: '🍮', name: 'فلان / تحلية', price: 80, category: 'مرطبات', pinned: false },
        { icon: '🍯', name: 'قلب اللوز / زلابية', price: 100, category: 'حلويات', pinned: false },
        { icon: '🍕', name: 'بيتزا كاري / سوفلي', price: 100, category: 'مملحات', pinned: true }
      ],
      library: [
        { icon: '📄', name: 'نسخ ورق (Photocopie N/B)', price: 5, category: 'خدمات سريعة', pinned: true },
        { icon: '🌈', name: 'نسخ بالألوان (Couleur)', price: 20, category: 'خدمات سريعة', pinned: true },
        { icon: '🖨️', name: 'طباعة صفحة (Impression)', price: 15, category: 'خدمات سريعة', pinned: true },
        { icon: '📘', name: 'تغليف حلزوني (Reliure)', price: 100, category: 'خدمات سريعة', pinned: false },
        { icon: '🪪', name: 'تغليف حراري (Plastification)', price: 80, category: 'خدمات سريعة', pinned: false },
        { icon: '✉️', name: 'ظرف بريدي (Enveloppe)', price: 10, category: 'قرطاسية', pinned: false },
        { icon: '🖊️', name: 'قلم جاف أزرق/أسود', price: 30, category: 'قرطاسية', pinned: false }
      ],
      perfume: [
        { icon: '🌸', name: 'تعبئة عطر 10 مل', price: 300, category: 'عطور', pinned: true },
        { icon: '🌺', name: 'تعبئة عطر 30 مل', price: 800, category: 'عطور', pinned: true },
        { icon: '👑', name: 'تعبئة عطر مركز 50 مل', price: 1300, category: 'عطور', pinned: true },
        { icon: '🎁', name: 'تغليف هدية فاخر', price: 250, category: 'هدايا', pinned: true },
        { icon: '🛍️', name: 'كيس هدايا مزخرف', price: 120, category: 'هدايا', pinned: false }
      ],
      services: [
        { icon: '📱', name: 'تعبئة رصيد (Flexy 100)', price: 110, category: 'خدمات', pinned: true, noLoyalty: true },
        { icon: '📱', name: 'تعبئة رصيد (Flexy 200)', price: 210, category: 'خدمات', pinned: true, noLoyalty: true },
        { icon: '🛵', name: 'توصيل طلبية للمنزل', price: 200, category: 'خدمات', pinned: false },
        { icon: '⚡', name: 'سلعة متنوعة سريعة', price: 50, category: 'متفرقات', pinned: true }
      ]
    },

    init() {
      const waitTimer = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(waitTimer);
        const steps = [
          'debounceSettingsCalls',
          'setupModalStackAndKillCcp',
          'fixModalLayeringAndKillCcp',
          'fixTopRibbonNavigationBlankScreen',
          'setupManagerPinForLoyaltyPoints',
          'setupProductLoyaltyPolicyAndRetailCarton',
          'upgradeQuickTouchF7AndPinnedDock',
          'enableCrashProofCartAndLoyaltyCalculation',
          'enableCrashProofCartRecovery',
          'bindManagerProfitPeekAndCartonShortcut'
        ];
        steps.forEach((fn) => {
          if (typeof this[fn] === 'function') {
            try { this[fn](); } catch (err) { console.warn('[RetailV3 Step Warning]:', fn, err.message); }
          }
        });
      }, 220);
    },

    // ========================================================================
    // 1. تنظيم زمني (Debounce) لطلبات updateSettings لمنع إغراق SQLite
    // ========================================================================
    debounceSettingsCalls() {
      // window.api مجمد بواسطة Electron contextBridge، لذا نستخدم دالة محلية آمنة
      let timerId = null;
      let pendingPayload = {};
      this.safeUpdateSettings = (payload = {}) => {
        Object.assign(pendingPayload, payload);
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(() => {
          const batch = { ...pendingPayload };
          pendingPayload = {};
          timerId = null;
          if (window.api && typeof window.api.updateSettings === 'function') {
            window.api.updateSettings(batch).catch(() => {});
          }
        }, 200);
      };
    },

    // ========================================================================
    // 2. مدير طبقات النوافذ المنبثقة (Dynamic Z-Index Stack) وإلغاء مربع CCP نهائياً
    // ========================================================================
    setupModalStackAndKillCcp() {
      window.App.ensureCustomerModalCcpFields = function () {
        document.getElementById('customerCcpBaridimobSection')?.remove();
      };
      document.getElementById('customerCcpBaridimobSection')?.remove();

      let currentTopZ = 10050;
      const origOpenModal = window.App.openModal?.bind(window.App);
      if (origOpenModal && !window.App._v3ModalStackHooked) {
        window.App.openModal = function (modalId) {
          const res = origOpenModal(modalId);
          const el = document.getElementById(modalId);
          if (el) {
            currentTopZ += 10;
            el.style.zIndex = String(currentTopZ);
            if (modalId === 'customerModal') {
              document.getElementById('customerCcpBaridimobSection')?.remove();
              RetailV3.lockCustomerLoyaltyInputWithPinButton();
            }
          }
          return res;
        };
        window.App._v3ModalStackHooked = true;
      }

      // ضمان تحديث نافذة F8 تلقائياً بعد حفظ تعديل الزبون في #customerModal
      const origSaveCustomer = window.App.saveCustomer?.bind(window.App);
      if (origSaveCustomer && !window.App._v3SaveCustSyncHooked) {
        window.App.saveCustomer = async function (...args) {
          const editedId = document.getElementById('custEditId')?.value;
          const res = await origSaveCustomer(...args);
          if (window.RetailMaster) {
            if (editedId && window.App.currentCart) {
              window.App.currentCart.customerId = Number(editedId);
            }
            window.RetailMaster.renderSmartLoyaltyCustomersList(
              document.getElementById('smartLoyaltyScanOrSearchInput')?.value || ''
            );
            window.RetailMaster.refreshSmartModalSelectedCustomer();
            window.RetailMaster.syncSmartLoyaltyButtonDisplay();
          }
          return res;
        };
        window.App._v3SaveCustSyncHooked = true;
      }
    },

    // ========================================================================
    // 3. قفل تعديل نقاط الوفاء بكود سري للمدير (Manager PIN) + سجل رقابة إجباري
    // ========================================================================
    setupManagerPinForLoyaltyPoints() {
      if (!document.getElementById('loyaltyPinVerifyModal')) {
        const pinModal = document.createElement('div');
        pinModal.id = 'loyaltyPinVerifyModal';
        pinModal.className = 'modal-overlay';
        pinModal.innerHTML = `
          <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border-2 border-amber-500 shadow-2xl text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">🔐</span>
                <div>
                  <h3 class="text-sm font-black text-amber-600 dark:text-amber-400">تصريح المدير لتعديل رصيد نقاط الولاء</h3>
                  <p class="text-[10.5px] text-slate-400">يتم توثيق كل تعديل وإرساله لسجل رقابة المدير</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('loyaltyPinVerifyModal')" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
            </div>

            <div class="space-y-3">
              <div class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
                <span class="font-bold text-slate-500">الرصيد الحالي للزبون:</span>
                <strong id="pinModalOldPoints" class="font-mono text-sm font-black text-amber-500">0 نقطة</strong>
              </div>

              <div>
                <label class="block font-black text-slate-700 dark:text-slate-200 mb-1">1. كود المدير السري (Manager PIN) * :</label>
                <input id="pinModalSecretInput" type="password" placeholder="أدخل كود المدير السري (الافتراضي: 1234)..."
                  class="w-full px-3 py-2 rounded-xl border-2 border-amber-500 font-mono font-black text-center text-base tracking-widest">
              </div>

              <div>
                <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">2. رصيد النقاط الجديد المطلوب * :</label>
                <input id="pinModalNewPointsInput" type="number" step="1" min="0"
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-base">
              </div>

              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">3. سبب التعديل (يظهر في تقرير المدير) * :</label>
                <select id="pinModalReasonSelect" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold mb-1.5">
                  <option value="نقاط ترحيبية / هدية زبون وفي">🎁 نقاط ترحيبية / هدية زبون وفي</option>
                  <option value="تعويض عن عملية شراء سابقة">🔄 تعويض عن عملية شراء سابقة</option>
                  <option value="تصحيح خطأ في الرصيد">🛠️ تصحيح خطأ في الرصيد</option>
                  <option value="تحويل رصيد من بطاقة قديمة">💳 تحويل رصيد من بطاقة قديمة</option>
                </select>
                <input id="pinModalCustomNote" type="text" placeholder="ملاحظة إضافية للمدير (اختياري)..."
                  class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700">
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('loyaltyPinVerifyModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="RetailV3.confirmManagerPinPointsChange()"
                class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg">
                ✔ اعتماد التعديل وتوثيقه
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(pinModal);
      }

      this.lockCustomerLoyaltyInputWithPinButton();
      this.injectLoyaltyAuditReportForManager();
    },

    lockCustomerLoyaltyInputWithPinButton() {
      const ptsInput = document.getElementById('custLoyaltyPointsInput');
      if (!ptsInput) return;

      ptsInput.readOnly = true;
      ptsInput.classList.add('bg-slate-100', 'dark:bg-slate-800', 'cursor-not-allowed');
      ptsInput.title = 'هذا الحقل محمي — اضغط زر (🔐 تعديل الرصيد بكود المدير) لتغييره';

      if (!document.getElementById('btnUnlockLoyaltyPtsWithPin')) {
        const wrapper = ptsInput.parentElement;
        const btn = document.createElement('button');
        btn.id = 'btnUnlockLoyaltyPtsWithPin';
        btn.type = 'button';
        btn.onclick = () => this.openLoyaltyPinVerifyModal();
        btn.className = 'mt-2 w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow';
        btn.innerHTML = '<span>🔐</span><span>تعديل رصيد النقاط بكود المدير السري</span>';
        wrapper.appendChild(btn);
      }
    },

    getManagerSecretPin() {
      return String(
        window.AppState?.settings?.manager_loyalty_pin ||
        localStorage.getItem('gherbi_manager_loyalty_pin') ||
        '1234'
      ).trim();
    },

    openLoyaltyPinVerifyModal() {
      const ptsInput = document.getElementById('custLoyaltyPointsInput');
      const curPts = Number(ptsInput?.value || 0);
      window.AppState._originalCustomerPointsBeforePin = curPts;

      const oldEl = document.getElementById('pinModalOldPoints');
      const newInp = document.getElementById('pinModalNewPointsInput');
      const secInp = document.getElementById('pinModalSecretInput');
      const noteInp = document.getElementById('pinModalCustomNote');

      if (oldEl) oldEl.textContent = `${curPts} نقطة`;
      if (newInp) newInp.value = String(curPts);
      if (secInp) secInp.value = '';
      if (noteInp) noteInp.value = '';

      window.App.openModal('loyaltyPinVerifyModal');
      setTimeout(() => secInp?.focus(), 60);
    },

    async confirmManagerPinPointsChange() {
      const enteredPin = String(document.getElementById('pinModalSecretInput')?.value || '').trim();
      const validPin = this.getManagerSecretPin();

      if (enteredPin !== validPin) {
        if (window.showToast) window.showToast('🚨 كود المدير السري غير صحيح! تم تسجيل المحاولة في سجل الرقابة.', 'error');
        if (window.api?.addAuditLog) {
          await window.api.addAuditLog({
            user_id: window.AppState.currentUser?.id || 1,
            user_name: window.AppState.currentUser?.name || 'Cashier',
            action_type: 'LOYALTY_PIN_FAILED_ATTEMPT',
            target_type: 'customer',
            target_id: document.getElementById('custEditId')?.value || null,
            severity: 'danger',
            details: {
              customer_name: document.getElementById('custNameInput')?.value || 'زبون',
              timestamp: new Date().toISOString()
            }
          }).catch(() => {});
        }
        return;
      }

      const oldPts = Number(window.AppState._originalCustomerPointsBeforePin || 0);
      const newPts = Math.max(0, parseInt(document.getElementById('pinModalNewPointsInput')?.value || '0', 10) || 0);
      const reason = document.getElementById('pinModalReasonSelect')?.value || 'تعديل يدوي';
      const note = document.getElementById('pinModalCustomNote')?.value?.trim() || '';
      const fullReason = note ? `${reason} (${note})` : reason;
      const custName = document.getElementById('custNameInput')?.value?.trim() || 'زبون جديد';
      const custId = document.getElementById('custEditId')?.value || null;

      const ptsInput = document.getElementById('custLoyaltyPointsInput');
      if (ptsInput) ptsInput.value = String(newPts);

      if (window.api?.addAuditLog) {
        await window.api.addAuditLog({
          user_id: window.AppState.currentUser?.id || 1,
          user_name: window.AppState.currentUser?.name || 'Cashier',
          action_type: 'LOYALTY_POINTS_MANUAL_EDIT',
          target_type: 'customer',
          target_id: custId ? Number(custId) : null,
          severity: 'warning',
          details: {
            customer_name: custName,
            old_points: oldPts,
            new_points: newPts,
            delta: newPts - oldPts,
            reason: fullReason,
            authorized_by_pin: true,
            timestamp: new Date().toISOString()
          }
        }).catch(() => {});
      }

      window.App.closeModal('loyaltyPinVerifyModal');
      if (window.showToast) {
        window.showToast(`✅ تم اعتماد الرصيد الجديد (${newPts} نقطة) وتوثيق العملية في سجل رقابة المدير`, 'success');
      }
    },

    injectLoyaltyAuditReportForManager() {
      const origRenderAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (origRenderAnalytics && !window.App._v3LoyaltyAuditHooked) {
        window.App.renderAnalyticsView = async function () {
          await origRenderAnalytics();
          const root = document.getElementById('analytics-view-root');
          if (!root || document.getElementById('ownerLoyaltyPointsAuditCard')) return;

          const logs = (await window.api?.getAuditLogs?.().catch(() => [])) || [];
          const loyaltyLogs = logs.filter(
            (l) => l.action_type === 'LOYALTY_POINTS_MANUAL_EDIT' || l.action_type === 'LOYALTY_PIN_FAILED_ATTEMPT'
          );

          const card = document.createElement('div');
          card.id = 'ownerLoyaltyPointsAuditCard';
          card.className = 'bg-white dark:bg-slate-800 border-2 border-amber-500/40 rounded-2xl p-5 mt-5 space-y-3';
          card.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">👑</span>
                <div>
                  <h3 class="font-black text-sm text-amber-600 dark:text-amber-400">سجل رقابة المدير: تعديلات رصيد نقاط الوفاء (${loyaltyLogs.length})</h3>
                  <p class="text-[11px] text-slate-400">يوثق كل زيادة أو إنقاص يدوي في نقاط الوفاء (سواء بكود المدير أو محاولات الدخول الخاطئة)</p>
                </div>
              </div>
              <button type="button" onclick="RetailV3.changeManagerLoyaltyPinPrompt()"
                class="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-400 font-black text-xs">
                🔑 تغيير كود المدير السري (PIN)
              </button>
            </div>
            ${
              loyaltyLogs.length === 0
                ? '<div class="py-6 text-center text-emerald-600 font-bold text-xs">✅ لم يتم إجراء أي تعديل يدوي على نقاط الوفاء حتى الآن</div>'
                : `<div class="overflow-x-auto max-h-64">
                    <table class="w-full text-xs text-right">
                      <thead>
                        <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                          <th class="py-2">التوقيت</th>
                          <th class="py-2">المستخدم</th>
                          <th class="py-2">الزبون</th>
                          <th class="py-2">الرصيد السابق</th>
                          <th class="py-2">الرصيد الجديد</th>
                          <th class="py-2">الفارق</th>
                          <th class="py-2">السبب والتصريح</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                        ${loyaltyLogs.map((l) => {
                          let d = {};
                          try { d = JSON.parse(l.details_json || '{}'); } catch (_) {}
                          if (l.action_type === 'LOYALTY_PIN_FAILED_ATTEMPT') {
                            return `
                              <tr class="bg-rose-500/10">
                                <td class="py-2 font-mono text-[11px]">${String(l.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                                <td class="py-2 font-bold text-rose-600">${l.user_name || 'Cashier'}</td>
                                <td class="py-2 font-black">${d.customer_name || '—'}</td>
                                <td colspan="4" class="py-2 font-black text-rose-600">🚨 محاولة فاشلة لتعديل النقاط بكود سري خاطئ!</td>
                              </tr>
                            `;
                          }
                          const delta = Number(d.delta || 0);
                          return `
                            <tr class="hover:bg-amber-500/5">
                              <td class="py-2 font-mono text-[11px]">${String(l.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                              <td class="py-2 font-bold">${l.user_name || 'Cashier'}</td>
                              <td class="py-2 font-black text-blue-600 dark:text-blue-400">${d.customer_name || 'زبون'}</td>
                              <td class="py-2 font-mono">${d.old_points ?? 0}</td>
                              <td class="py-2 font-mono font-black">${d.new_points ?? 0}</td>
                              <td class="py-2 font-mono font-black ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${delta >= 0 ? '+' + delta : delta}</td>
                              <td class="py-2 font-bold">${d.reason || '—'} <span class="text-[10px] text-emerald-600">(✔ بكود المدير)</span></td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>`
            }
          `;
          root.appendChild(card);
        };
        window.App._v3LoyaltyAuditHooked = true;
      }
    },

    changeManagerLoyaltyPinPrompt() {
      if (window.RetailV4 && typeof window.RetailV4.openChangeManagerPinModal === 'function') {
        window.RetailV4.openChangeManagerPinModal();
      }
    },

    // ========================================================================
    // 4 & 7. خيار "سياسة نقاط الوفاء للمنتج" + إزالة الجملة واستبدالها بـ "الكارطون/الحزمة في التجزئة"
    // ========================================================================
    setupProductLoyaltyPolicyAndRetailCarton() {
      const prodModal = document.getElementById('productModal');
      if (!prodModal) return;

      const tab1 = document.getElementById('prodTab1');
      if (tab1 && !document.getElementById('prodLoyaltyPolicySelect')) {
        const policyBox = document.createElement('div');
        policyBox.className = 'col-span-full p-3 rounded-2xl bg-amber-500/10 border border-amber-500/35 flex flex-wrap items-center justify-between gap-3 mt-1';
        policyBox.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-xl">👑</span>
            <div>
              <label for="prodLoyaltyPolicySelect" class="font-black text-xs text-amber-700 dark:text-amber-300 block">
                هل يُحتسب هذا المنتج في بطاقة الوفاء؟ (سياسة النقاط حسب هامش الفائدة)
              </label>
              <span id="prodLoyaltyAutoMarginHint" class="text-[10.5px] text-slate-500 font-bold">
                يمكنك استثناء المواد ذات الربح الضعيف (كالحليب والخبز والسكر) من منح النقاط
              </span>
            </div>
          </div>
          <select id="prodLoyaltyPolicySelect" class="px-3 py-1.5 rounded-xl border-2 border-amber-500 font-black text-xs bg-white dark:bg-slate-900">
            <option value="1">✅ يمنح نقاط وفاء كاملة (100%)</option>
            <option value="0.5">⚖️ يمنح نصف النقاط (50% - فائدة متوسطة)</option>
            <option value="0">🚫 لا يمنح نقاط وفاء نهائياً (0% - ربح ضعيف/مدعم)</option>
            <option value="2">🔥 نقاط مضاعفة ترويجية (200%)</option>
          </select>
        `;
        tab1.appendChild(policyBox);
      }

      const wholesalePriceInput = document.getElementById('prodWholesaleInput');
      const wholesaleMinQtyInput = document.getElementById('prodWholesaleMinQtyInput');
      if (wholesalePriceInput) {
        const labelPrice = wholesalePriceInput.previousElementSibling;
        if (labelPrice) {
          labelPrice.innerHTML = '📦 سعر بيع الكارطون / الحزمة العائلية بالتجزئة (د.ج) :';
          labelPrice.className = 'block text-xs font-black text-indigo-600 dark:text-indigo-400 mb-1';
        }
        wholesalePriceInput.placeholder = 'مثال: 250 د.ج لحزمة 6 قارورات...';
      }
      if (wholesaleMinQtyInput) {
        const labelQty = wholesaleMinQtyInput.previousElementSibling;
        if (labelQty) {
          labelQty.innerHTML = '🔢 عدد الحبات داخل الكارطون / الحزمة (الشد) :';
          labelQty.className = 'block text-xs font-black text-indigo-600 dark:text-indigo-400 mb-1';
        }
        wholesaleMinQtyInput.placeholder = 'مثال: 6 أو 12 أو 24 حبة...';
      }

      const costInp = document.getElementById('prodCostInput');
      const sellInp = document.getElementById('prodSellInput');
      const checkMarginForLoyalty = () => {
        const cost = parseFloat(costInp?.value || '0') || 0;
        const sell = parseFloat(sellInp?.value || '0') || 0;
        const policySel = document.getElementById('prodLoyaltyPolicySelect');
        const hintEl = document.getElementById('prodLoyaltyAutoMarginHint');

        if (cost > 0 && sell > 0 && policySel && hintEl) {
          const marginPct = ((sell - cost) / sell) * 100;
          if (marginPct <= 6) {
            policySel.value = '0';
            hintEl.innerHTML = `<span class="text-rose-600 font-black">⚠️ هامش الربح ضعيف (${marginPct.toFixed(1)}%) — تم ضبط المنتج تلقائياً على (🚫 بدون نقاط وفاء) لحماية فائدتك!</span>`;
          } else {
            hintEl.textContent = `هامش الربح جيد (${marginPct.toFixed(1)}%) — مؤهل لمنح نقاط الوفاء`;
          }
        }
      };
      costInp?.addEventListener('input', checkMarginForLoyalty);
      sellInp?.addEventListener('input', checkMarginForLoyalty);

      window.App.addMultiBarcodeRow = function (data = {}) {
        const list = document.getElementById('prodMultiBarcodesList');
        if (!list) return;
        const row = document.createElement('div');
        row.className = 'multi-barcode-row grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700';
        row.innerHTML = `
          <div class="col-span-4">
            <label class="text-[10px] text-slate-400 font-bold">باركود الكارطون / الحزمة</label>
            <input type="text" class="mb-code w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold" placeholder="امسح باركود الكارطون..." value="${data.barcode || ''}">
          </div>
          <div class="col-span-3">
            <label class="text-[10px] text-amber-500 font-bold">نوع العبوة للمستهلك</label>
            <input type="text" class="mb-label w-full px-2.5 py-1.5 rounded-lg text-xs font-bold" placeholder="كارطون / حزمة 6 / علبة" value="${data.unit_label || 'كارطون / حزمة'}">
          </div>
          <div class="col-span-2">
            <label class="text-[10px] text-blue-500 font-bold">الشد (عدد الحبات)</label>
            <input type="number" step="1" min="1" class="mb-factor w-full px-2 py-1.5 rounded-lg text-xs font-mono font-black text-center" value="${data.pack_factor || 6}">
          </div>
          <div class="col-span-2">
            <label class="text-[10px] text-emerald-600 font-bold">سعر العبوة بالتجزئة</label>
            <input type="number" step="any" class="mb-tier w-full px-2 py-1.5 rounded-lg text-xs font-mono font-black text-center text-emerald-600" placeholder="سعر الحزمة" value="${data.price_tier && !isNaN(Number(data.price_tier)) ? data.price_tier : ''}">
          </div>
          <div class="col-span-1 pt-4 text-center">
            <button type="button" onclick="this.closest('.multi-barcode-row').remove()" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg">✕</button>
          </div>
        `;
        list.appendChild(row);
      };

      const loyaltyPolicyMap = JSON.parse(localStorage.getItem('gherbi_product_loyalty_policies') || '{}');

      if (!window.App._v3OpenProdHooked && typeof window.App.openProductModal === 'function') {
        const origOpenProd = window.App.openProductModal.bind(window.App);
        window.App.openProductModal = function (product = null) {
          const res = origOpenProd(product);
          const sel = document.getElementById('prodLoyaltyPolicySelect');
          if (sel) {
            const pid = product && typeof product === 'object' ? product.id : product;
            sel.value = pid && loyaltyPolicyMap[pid] !== undefined ? String(loyaltyPolicyMap[pid]) : '1';
          }
          return res;
        };
        window.App._v3OpenProdHooked = true;
      }

      if (!window.App._v3SaveProdHooked && typeof window.App.saveProduct === 'function') {
        const origSaveProd = window.App.saveProduct.bind(window.App);
        window.App.saveProduct = async function () {
          const cost = parseFloat(document.getElementById('prodCostInput')?.value || '0') || 0;
          const packPrice = parseFloat(document.getElementById('prodWholesaleInput')?.value || '0') || 0;
          const packQty = parseFloat(document.getElementById('prodWholesaleMinQtyInput')?.value || '1') || 1;
          if (cost > 0 && packPrice > 0 && packQty > 1) {
            const totalCartonCost = cost * packQty;
            if (packPrice < totalCartonCost) {
              if (!confirm(`⚠️ تنبيه: سعر بيع الكارطون/الحزمة (${packPrice} د.ج) أقل من تكلفة شراء ${packQty} حبات (${totalCartonCost.toFixed(2)} د.ج)! هل تريد المتابعة على أي حال؟`)) {
                return;
              }
            }
          }

          const pid = document.getElementById('prodEditId')?.value;
          const policyVal = parseFloat(document.getElementById('prodLoyaltyPolicySelect')?.value ?? '1');
          await origSaveProd();

          const savedId = pid || (window.AppState.products?.[window.AppState.products.length - 1]?.id);
          if (savedId) {
            loyaltyPolicyMap[savedId] = policyVal;
            localStorage.setItem('gherbi_product_loyalty_policies', JSON.stringify(loyaltyPolicyMap));
          }
        };
        window.App._v3SaveProdHooked = true;
      }

      /* تم نقل إدارة الباكي والكرتونة بالكامل إلى المحرك الذكي V8PackEngine */
    },

    getProductLoyaltyMultiplier(productId) {
      const map = JSON.parse(localStorage.getItem('gherbi_product_loyalty_policies') || '{}');
      return map[productId] !== undefined ? Number(map[productId]) : 1;
    },

    // ========================================================================
    // 5. إصلاح جذري للشاشة البيضاء في وضع "قائمة علوية" (Top Ribbon Fix)
    // ========================================================================
    fixTopRibbonNavigationBlankScreen() {
      const renderTopNav = () => {
        const topNav = document.getElementById('gherbiEnterpriseTopNav');
        if (!topNav) return;

        const navButtons = Array.from(document.querySelectorAll('#sidebar-nav .nav-btn'));
        if (!navButtons.length) return;

        topNav.innerHTML = navButtons.map((btn) => {
          let viewId = btn.getAttribute('data-view') || '';
          if (!viewId) {
            const onclickAttr = btn.getAttribute('onclick') || '';
            const match = onclickAttr.match(/switchView(s*['"]([^'"]+)['"]s*)/);
            if (match && match[1]) viewId = match[1];
          }
          if (!viewId && btn.id) {
            viewId = btn.id.replace(/^nav-/, '');
          }
          if (!viewId) viewId = 'pos';

          const iconEl = btn.querySelector('.material-symbols-rounded, svg');
          const labelEl = btn.querySelector('.sidebar-label') || btn.querySelector('span:last-child');
          const labelText = labelEl ? labelEl.textContent.trim() : btn.textContent.trim();
          const isActive = btn.classList.contains('active') || document.getElementById('view-' + viewId)?.classList.contains('active');

          return `
            <button type="button" data-topview="${viewId}" onclick="RetailV3.safeSwitchTopView('${viewId}')"
              class="gherbi-topnav-item ${isActive ? 'active' : ''}">
              ${iconEl ? iconEl.outerHTML : ''}
              <span>${labelText}</span>
            </button>
          `;
        }).join('');
      };

      if (window.RetailV2) {
        window.RetailV2.renderEnterpriseTopRibbon = renderTopNav;
      }
      renderTopNav();
    },

    safeSwitchTopView(viewId) {
      const cleanId = String(viewId || 'pos').trim() || 'pos';
      if (window.App && typeof window.App.switchView === 'function') {
        window.App.switchView(cleanId);
      }
      const targetSec = document.getElementById('view-' + cleanId) || document.getElementById('view-pos');
      if (targetSec && !targetSec.classList.contains('active')) {
        targetSec.classList.add('active');
      }
      document.querySelectorAll('#gherbiEnterpriseTopNav .gherbi-topnav-item').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.topview === cleanId);
      });
    },

    // ========================================================================
    // 6. تطوير لوحة الأزرار السريعة (F7) بـ 6 قوالب تجزئة + شريط اللمس المثبت
    // ========================================================================
    upgradeQuickTouchF7AndPinnedDock() {
      const productsPane = document.querySelector('#view-pos .pos-layout > div:first-child');
      const productsGrid = document.getElementById('posProductsGrid');

      if (productsPane && productsGrid && !document.getElementById('gherbiPinnedQuickDock')) {
        const dock = document.createElement('div');
        dock.id = 'gherbiPinnedQuickDock';
        dock.className = 'gherbi-pinned-f7-dock';
        productsPane.insertBefore(dock, productsGrid);
      }

      const f7Modal = document.getElementById('quickTouchPadModal');
      if (f7Modal && !f7Modal.dataset.v3Upgraded) {
        f7Modal.dataset.v3Upgraded = '1';
        const presetBanner = f7Modal.querySelector('.bg-slate-900, .bg-slate-950') || f7Modal.querySelector('div > div:nth-child(2)');
        if (presetBanner) {
          presetBanner.className = 'p-3 rounded-2xl bg-slate-900 text-white space-y-2';
          presetBanner.innerHTML = `
            <div class="flex items-center justify-between text-xs">
              <span class="font-black text-amber-400">🎯 تحميل قوالب أزرار سريعة جاهزة لمحلات التجزئة بضغطة زر:</span>
              <span class="text-[10.5px] text-slate-300">انقر بزر الفأرة الأيمن على أي زر لتعديل سعره أو تثبيته 📌</span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" onclick="RetailV3.loadQuickPresetGroup('supermarket')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs">🛒 سوبرماركت ومواد يومية</button>
              <button type="button" onclick="RetailV3.loadQuickPresetGroup('produce')" class="px-3 py-1.5 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-black text-xs">🍎 خضر وفواكه وميزان</button>
              <button type="button" onclick="RetailV3.loadQuickPresetGroup('bakery')" class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs">🥖 مخبزة ومرطبات</button>
              <button type="button" onclick="RetailV3.loadQuickPresetGroup('library')" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs">📚 مكتبة وفوتوكوبي</button>
              <button type="button" onclick="RetailV3.loadQuickPresetGroup('perfume')" class="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs">✨ عطور وتغليف هدايا</button>
              <button type="button" onclick="RetailV3.loadQuickPresetGroup('services')" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs">📱 خدمات سريعة وفليكسي</button>
            </div>
          `;
        }
      }

      const currentButtons = this.getQuickTouchButtons();
      if (!currentButtons.length || (currentButtons[0]?.name?.includes('Photocopie') && !localStorage.getItem('gherbi_f7_retail_initialized'))) {
        localStorage.setItem('gherbi_f7_retail_initialized', '1');
        this.saveQuickTouchButtons(this.retailQuickPresets.supermarket);
      } else {
        this.renderPinnedQuickDock();
      }
    },

    getQuickTouchButtons() {
      try {
        const raw = localStorage.getItem('gherbi_quick_touch_buttons');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) return parsed;
        }
      } catch (_) {}
      return this.retailQuickPresets.supermarket;
    },

    saveQuickTouchButtons(list) {
      localStorage.setItem('gherbi_quick_touch_buttons', JSON.stringify(list));
      if (window.AppState) window.AppState.quickTouchButtons = list;
      if (window.App?.renderQuickTouchPad) window.App.renderQuickTouchPad();
      this.renderPinnedQuickDock();
    },

    loadQuickPresetGroup(groupKey) {
      const preset = this.retailQuickPresets[groupKey];
      if (!preset) return;
      this.saveQuickTouchButtons(JSON.parse(JSON.stringify(preset)));
      if (window.showToast) window.showToast('✅ تم تحميل مجموعة الأزرار السريعة وتثبيتها في شاشة المبيعات', 'success');
    },

    renderPinnedQuickDock() {
      const dock = document.getElementById('gherbiPinnedQuickDock');
      if (!dock) return;
      const list = this.getQuickTouchButtons();

      dock.innerHTML = `
        <button type="button" onclick="App.openQuickTouchModal ? App.openQuickTouchModal() : App.openModal('quickTouchPadModal')"
          class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-[11px] shrink-0 flex items-center gap-1 shadow-sm">
          <span>⚡</span>
          <span>لوحة اللمس (F7)</span>
        </button>
        ${list.map((b, idx) => `
          <div onclick="RetailV3.triggerQuickTouchItem(${idx})"
               oncontextmenu="event.preventDefault(); RetailV3.quickEditQuickButtonPrice(${idx});"
               class="gherbi-pinned-f7-chip" title="انقر للإضافة للسلة فوراً | نقرة يمين لتعديل السعر">
            <span>${b.icon || '⚡'}</span>
            <span>${b.name}</span>
            <span class="font-mono font-black text-emerald-600 dark:text-emerald-400">${Number(b.price || 0).toFixed(0)} د.ج</span>
          </div>
        `).join('')}
      `;
    },

    triggerQuickTouchItem(idx) {
      const list = this.getQuickTouchButtons();
      const item = list[idx];
      if (!item || !window.App) return;

      const mult = Math.max(1, Number(window.AppState._quickMultiplier || 1));
      const sign = (window.AppState.isReturnMode || window.AppState.returnMode) ? -1 : 1;
      const qty = mult * sign;
      const price = Number(item.price || 0);

      const cartItems = window.App.currentCart?.items || [];
      const existing = cartItems.find((x) => !x.product_id && x.name === item.name && Number(x.price) === price);

      if (existing) {
        existing.quantity = Number((Number(existing.quantity || 0) + qty).toFixed(3));
        existing.subtotal = Number((existing.quantity * price).toFixed(2));
      } else {
        cartItems.push({
          product_id: null,
          custom_product_name: item.name,
          name: item.name,
          price,
          cost_price: 0,
          quantity: qty,
          unit: 'وحدة',
          subtotal: Number((qty * price).toFixed(2)),
          _noLoyalty: Boolean(item.noLoyalty)
        });
      }

      window.App.setQuickMultiplier?.(1);
      window.App.recalcAndRenderCart();
      if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
    },

    quickEditQuickButtonPrice(idx) {
      if (window.RetailV4 && typeof window.RetailV4.openEditQuickButtonModal === 'function') {
        window.RetailV4.openEditQuickButtonModal(idx);
      }
    },

    // ========================================================================
    // 8. الحفظ التلقائي للسلة ضد انقطاع الكهرباء + كاشف الربح السري للمدير (Alt+M)
    // ========================================================================
    enableCrashProofCartAndLoyaltyCalculation() {
      try {
        const savedCartsRaw = localStorage.getItem('gherbi_crash_recovery_carts');
        if (savedCartsRaw) {
          const savedCarts = JSON.parse(savedCartsRaw);
          if (
            Array.isArray(savedCarts) &&
            savedCarts.some((c) => Array.isArray(c.items) && c.items.length > 0) &&
            (!window.AppState.carts || window.AppState.carts.every((c) => !c.items || c.items.length === 0))
          ) {
            window.AppState.carts = savedCarts;
            window.App.renderPosView?.();
          }
        }
      } catch (_) {}

      if (!window.App._v3AutoSaveCartHooked && typeof window.App.recalcAndRenderCart === 'function') {
        const origRecalcRender = window.App.recalcAndRenderCart.bind(window.App);
        window.App.recalcAndRenderCart = function (...args) {
          const res = origRecalcRender(...args);
          try {
            localStorage.setItem('gherbi_crash_recovery_carts', JSON.stringify(window.AppState.carts || []));
          } catch (_) {}
          return res;
        };
        window.App._v3AutoSaveCartHooked = true;
      }
    },

    bindManagerProfitPeekAndCartonShortcut() {
      window.addEventListener('keydown', (e) => {
        const posSec = document.getElementById('view-pos');
        if (!posSec || !posSec.classList.contains('active')) return;

        // Alt + M -> كاشف صافي الربح السري للمدير في الفاتورة الحالية
        if (e.altKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) {
          e.preventDefault();
          const items = window.App.currentCart?.items || [];
          let totalRev = 0;
          let totalCost = 0;
          let eligibleLoyaltyRev = 0;

          items.forEach((it) => {
            const qty = Number(it.quantity || 0);
            const sell = Number(it.price || 0);
            const prod = (window.AppState.products || []).find((p) => Number(p.id) === Number(it.product_id));
            const cost = Number(it.cost_price || (prod && prod.cost_price) || 0);
            const lineRev = qty * sell;
            totalRev += lineRev;
            totalCost += qty * cost;

            const pol = it.product_id ? this.getProductLoyaltyMultiplier(it.product_id) : (it._noLoyalty ? 0 : 1);
            eligibleLoyaltyRev += lineRev * pol;
          });

          const disc = Number(window.App.currentCart?.discount || 0);
          const netProfit = totalRev - totalCost - disc;
          if (window.showToast) {
            window.showToast(
              `👁️ معاينة المدير (Alt+M): صافي ربحك في هذه السلة = ${netProfit.toFixed(2)} د.ج | المبلغ المؤهل للنقاط = ${eligibleLoyaltyRev.toFixed(0)} د.ج`,
              netProfit >= 0 ? 'success' : 'error'
            );
          }
        }

        // Alt + K -> تبديل السطر المحدد في السلة بين (قطعة مفردة ⇄ كارطون/حزمة)
        if (e.altKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
          e.preventDefault();
          const items = window.App.currentCart?.items || [];
          if (items.length > 0) {
            const idx = window.AppState.selectedCartRowIdx ?? (items.length - 1);
            window.App.toggleCartItemWholesaleUnit?.(idx);
          }
        }
      });
    }
  };

  window.RetailV3 = RetailV3;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailV3.init());
  } else {
    RetailV3.init();
  }
})();


// === [DIRECT RETAIL CUSTOMER SAVE PATCH] ===
(function attachBulletproofCustomerSave() {
  function getVal(id, fallback = '') {
    const el = document.getElementById(id);
    return el && el.value !== undefined ? String(el.value).trim() : fallback;
  }

  function resolveEditingCustomerId() {
    // 1. من الحقل المخفي custEditId
    const rawEditId = getVal('custEditId');
    if (rawEditId && !isNaN(Number(rawEditId)) && Number(rawEditId) > 0) {
      return Number(rawEditId);
    }
    // 2. من حقل الكود الظاهر FID-00003
    const fidText = getVal('custFidCodePreview');
    const fidMatch = fidText.match(/FID-0*(\d+)/i);
    if (fidMatch && fidMatch[1]) {
      return Number(fidMatch[1]);
    }
    // 3. من AppState
    if (window.AppState?.editingCustomerId) {
      return Number(window.AppState.editingCustomerId);
    }
    return null;
  }

  async function saveRetailCustomerDirectly() {
    const name = getVal('custNameInput');
    if (!name) {
      if (window.showToast) window.showToast('⚠️ يرجى إدخال الاسم الكامل للزبون أولاً', 'warning');
      document.getElementById('custNameInput')?.focus();
      return;
    }

    const editId = resolveEditingCustomerId();
    const phone = getVal('custPhoneInput');
    const wilaya = getVal('custWilayaSelect');
    const rawAddress = getVal('custAddressInput');
    const address = wilaya && !rawAddress.includes(wilaya)
      ? (rawAddress ? `${wilaya} - ${rawAddress}` : wilaya)
      : rawAddress;

    const price_tier = getVal('custPriceTierInput', 'retail') || 'retail';
    const loyalty_points = Math.max(0, parseInt(getVal('custLoyaltyPointsInput', '0'), 10) || 0);
    const initial_debt = parseFloat(getVal('custInitDebtInput', '0')) || 0;
    const credit_limit = parseFloat(getVal('custCreditLimitInput', '0')) || 0;

    const payload = {
      id: editId ? Number(editId) : undefined,
      name,
      phone,
      address,
      wilaya,
      price_tier,
      loyalty_points,
      initial_debt,
      credit_limit,
      rc: '',
      nif: '',
      ai: '',
      nis: '',
      ccp_number: '',
      ccp_key: '',
      rip: '',
      commune: ''
    };

    try {
      let savedId = editId;

      if (editId) {
        // تحديث زبون موجود
        if (window.api?.updateCustomer) {
          try {
            await window.api.updateCustomer(Number(editId), payload);
          } catch (_) {
            await window.api.updateCustomer(payload);
          }
        }
      } else {
        // إضافة زبون جديد
        if (window.api?.addCustomer) {
          const created = await window.api.addCustomer(payload);
          if (created && (created.id || created.lastID)) {
            savedId = Number(created.id || created.lastID);
          }
        }
      }

      // تحديث مصفوفة الزبائن في الذاكرة الحية فوراً
      if (window.api?.getCustomers) {
        const freshList = await window.api.getCustomers().catch(() => null);
        if (Array.isArray(freshList)) {
          window.AppState.customers = freshList;
        }
      }

      // ضمان تحديث رصيد النقاط والبيانات في الذاكرة الحية حتى لو تأخر SQLite
      if (Array.isArray(window.AppState?.customers)) {
        const idx = window.AppState.customers.findIndex((c) => Number(c.id) === Number(savedId));
        if (idx !== -1) {
          window.AppState.customers[idx] = {
            ...window.AppState.customers[idx],
            ...payload,
            id: Number(savedId),
            loyalty_points
          };
        } else if (savedId) {
          window.AppState.customers.push({ ...payload, id: Number(savedId), loyalty_points });
        }
      }

      // تحديث القوائم المنسدلة ونافذة F8 المفتوحة بالخلفية
      if (typeof window.App?.renderCustomerSelects === 'function') {
        window.App.renderCustomerSelects();
      }
      if (savedId && window.App?.currentCart) {
        window.App.currentCart.customerId = Number(savedId);
      }
      if (window.RetailMaster) {
        window.RetailMaster.renderSmartLoyaltyCustomersList(
          document.getElementById('smartLoyaltyScanOrSearchInput')?.value || ''
        );
        window.RetailMaster.refreshSmartModalSelectedCustomer();
        window.RetailMaster.syncSmartLoyaltyButtonDisplay();
      }
      if (typeof window.App?.renderCustomersView === 'function') {
        try { window.App.renderCustomersView(); } catch (_) {}
      }

      // إغلاق نافذة تعديل الزبون فوراً
      if (typeof window.App?.closeModal === 'function') {
        window.App.closeModal('customerModal');
      } else {
        document.getElementById('customerModal')?.classList.remove('active');
      }

      if (window.showToast) {
        window.showToast(`✅ تم حفظ بيانات الزبون "${name}" ورصيد النقاط (${loyalty_points} نقطة) بنجاح`, 'success');
      }
    } catch (err) {
      console.error('Save Customer Error:', err);
      if (window.showToast) {
        window.showToast('❌ تعذر حفظ الزبون: ' + (err.message || err), 'error');
      }
    }
  }

  const hookInterval = setInterval(() => {
    if (!window.App) return;
    clearInterval(hookInterval);

    window.App.saveCustomer = saveRetailCustomerDirectly;
    if (window.RetailV2) {
      window.RetailV2.saveRetailCustomerAndSync = saveRetailCustomerDirectly;
    }

    // التأكد من حفظ معرّف الزبون عند فتح نافذة التعديل
    const origOpen = window.App.openCustomerModal?.bind(window.App);
    if (origOpen && !window.App._directCustOpenHooked) {
      window.App.openCustomerModal = function (id = null) {
        window.AppState.editingCustomerId = id ? Number(id) : null;
        const res = origOpen(id);
        const editInp = document.getElementById('custEditId');
        if (editInp) editInp.value = id ? String(id) : '';
        const fidInp = document.getElementById('custFidCodePreview');
        if (fidInp) {
          fidInp.value = id ? ('FID-' + String(id).padStart(5, '0')) : 'يُولّد تلقائياً عند الحفظ';
        }
        return res;
      };
      window.App._directCustOpenHooked = true;
    }
  }, 200);
})();



/* ==================== [MODULE: gherbi-v5-stage2-total-and-f3.js] ==================== */
/**
 * gherbi-v5-stage2-total-and-f3.js
 * المحرك التنفيذي للشطر الثاني (الإصدار 5):
 * - تكبير الإجمالي المستحق وعرض شارة "كم تم الاختزال" والنقاط المستعملة والمبلغ قبل الخصم أمامه مباشرة
 * - تحديث زر المسودات ليحمل اختصار (F3) دائماً: "مسودات (0) (F3)" مع تنبيه بصري عند وجود مسودات
 */

'use strict';

(function initGherbiV5Stage2() {
  const V5Stage2 = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.setupGiantTotalAndSavingsBadge();
        this.setupDraftsButtonWithF3Label();
        console.log('🚀 [Gherbi V5 - Stage 2]: تم تفعيل الإجمالي العملاق وشارة الاختزال وزر المسودات (F3).');
      }, 200);
    },

    // ========================================================================
    // 3. تكبير الإجمالي المستحق + إظهار شارة المبلغ المختزل والنقاط أمامه للزبون
    // ========================================================================
    setupGiantTotalAndSavingsBadge() {
      const totalEl = document.getElementById('cartTotalText');
      if (!totalEl) return;

      const totalRow = totalEl.closest('.flex.items-center.justify-between') || totalEl.parentElement;
      if (totalRow && !document.getElementById('gherbiLiveRedeemedBadge')) {
        // إنشاء حاوية تجمع شارة الاختزال بجانب الإجمالي العملاق
        const rightTitle = totalRow.firstElementChild;
        if (rightTitle) {
          rightTitle.className = 'font-black text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-0.5';
        }

        const badge = document.createElement('div');
        badge.id = 'gherbiLiveRedeemedBadge';
        badge.className = 'gherbi-live-redeemed-badge hidden';
        totalRow.insertBefore(badge, totalEl);
      }

      const updateSavingsDisplay = () => {
        const badge = document.getElementById('gherbiLiveRedeemedBadge');
        if (!badge) return;

        const cart = window.App?.currentCart;
        const items = cart?.items || [];
        const subtotal = items.reduce((acc, it) => {
          const q = Number(it.quantity ?? 1);
          const p = Number(it.price ?? 0);
          const line = it.subtotal !== undefined ? Number(it.subtotal) : (q * p);
          return acc + (isNaN(line) ? 0 : line);
        }, 0);

        const rawDisc = Number(cart?.discount ?? document.getElementById('cartDiscountInput')?.value ?? 0);
        const couponDisc = Number(cart?.couponDiscount || 0);
        const totalSavedDzd = Number((rawDisc + couponDisc).toFixed(2));
        const redeemedPts = Number(cart?._redeemedPoints || 0);

        if (totalSavedDzd <= 0 || subtotal <= 0) {
          badge.classList.add('hidden');
          return;
        }

        badge.classList.remove('hidden');
        const ptsText = redeemedPts > 0 ? ` (${redeemedPts} نقطة وفاء)` : '';
        badge.innerHTML = `
          <div class="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
            كان قبل الخصم: <span class="line-through font-mono font-black text-rose-500">${subtotal.toFixed(2)} د.ج</span>
          </div>
          <div class="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono">
            🎁 تم اختزال: -${totalSavedDzd.toFixed(2)} د.ج${ptsText}
          </div>
        `;
      };

      updateSavingsDisplay();

      // مراقبة أي تغير في الإجمالي أو حقل الخصم لتحديث الشارة فوراً
      const obs = new MutationObserver(() => updateSavingsDisplay());
      obs.observe(totalEl, { childList: true, characterData: true, subtree: true });

      const discInp = document.getElementById('cartDiscountInput');
      if (discInp) {
        discInp.addEventListener('input', updateSavingsDisplay);
        discInp.addEventListener('change', updateSavingsDisplay);
      }

      setInterval(updateSavingsDisplay, 500);
    },

    // ========================================================================
    // 4. إضافة (F3) أمام زر المسودات "مسودات (0) (F3)" وتفعيله بصرياً
    // ========================================================================
    setupDraftsButtonWithF3Label() {
      const enforceDraftsButtonFormat = () => {
        const draftsBtns = Array.from(document.querySelectorAll('#view-pos button')).filter((b) => {
          const onclickStr = b.getAttribute('onclick') || '';
          const txt = b.textContent || '';
          return onclickStr.includes('openDraftsModal') || txt.includes('مسودات');
        });

        const draftsCount = Array.isArray(window.AppState?.draftCarts) ? window.AppState.draftCarts.length : 0;

        draftsBtns.forEach((btn) => {
          // الحفاظ على <span id="draftsCountBadge"> داخله مع إضافة (F3)
          if (!btn.textContent.includes('(F3)')) {
            btn.innerHTML = `مسودات (<span id="draftsCountBadge">${draftsCount}</span>) (F3)`;
          } else {
            const badgeEl = btn.querySelector('#draftsCountBadge');
            if (badgeEl && badgeEl.textContent !== String(draftsCount)) {
              badgeEl.textContent = String(draftsCount);
            }
          }
          btn.title = 'فتح نافذة الفواتير المعلقة والمسودات (اختصار: F3)';
          btn.classList.toggle('gherbi-drafts-btn-has-items', draftsCount > 0);
        });
      };

      enforceDraftsButtonFormat();
      setInterval(enforceDraftsButtonFormat, 500);

      // ضمان فتح نافذة المسودات عند الضغط على مفتاح F3 في شاشة المبيعات
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;
          if (e.key === 'F3') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.App?.openDraftsModal === 'function') {
              window.App.openDraftsModal();
            } else {
              window.App?.openModal?.('draftsModal');
            }
          }
        },
        true
      );
    }
  };

  window.GherbiV5Stage2 = V5Stage2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V5Stage2.init());
  } else {
    V5Stage2.init();
  }
})();


/* ==================== [MODULE: gherbi-v8-stage2-pack-engine.js] ==================== */
/**
 * gherbi-v8-stage2-pack-engine.js (Pure Logic Edition — No Competing DOM Timers)
 * يوفر حسابات الباكي والكرتونة المخصصة (مثل غولد لاين #528: 8 حبات بـ 950 د.ج أو ×6 افتراضياً)
 * ويترك رسم أزرار السلة للمحرك الموحد V9Engine لمنع أي ارتعاش (Zero-Flicker).
 */

'use strict';

(function initGherbiV8Stage2PackEngine() {
  const PACK_STORAGE_KEY = 'gherbi_product_pack_configs_v8';

  const V8PackEngine = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.ensureDefaultKnownConfigs();
        this.hookProductModalPackInputsAndLivePreview();
        this.overrideAllPackMethodsAndRecalc();
        console.log('✅ [Gherbi V8 Pack Engine]: جاهز (بدون مؤقتات DOM متضاربة).');
      }, 180);
    },

    getSavedPackMap() {
      try {
        const raw = localStorage.getItem(PACK_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (_) {
        return {};
      }
    },

    savePackConfig(productId, productName, config) {
      const map = this.getSavedPackMap();
      const cleanCfg = {
        packPrice: Math.max(0, Number(config.packPrice || 0)),
        packQty: Math.max(0, Number(config.packQty || 0)),
        packUnit: String(config.packUnit || 'كرتونة').trim() || 'كرتونة'
      };

      if (productId) map['ID_' + Number(productId)] = cleanCfg;
      if (productName) map['NAME_' + String(productName).trim().toLowerCase()] = cleanCfg;
      localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(map));

      const prods = window.AppState?.products || [];
      prods.forEach((p) => {
        if (
          (productId && Number(p.id) === Number(productId)) ||
          (productName && String(p.name || '').trim().toLowerCase() === String(productName).trim().toLowerCase())
        ) {
          p.wholesale_price = cleanCfg.packPrice;
          p.pack_price = cleanCfg.packPrice;
          p.wholesale_qty = cleanCfg.packQty;
          p.pack_qty = cleanCfg.packQty;
          p.wholesale_min_qty = cleanCfg.packQty;
          p.pack_factor = cleanCfg.packQty;
          p.wholesale_unit = cleanCfg.packUnit;
          p.pack_unit = cleanCfg.packUnit;
        }
      });
    },

    ensureDefaultKnownConfigs() {
      const map = this.getSavedPackMap();
      if (!map['ID_528']) {
        map['ID_528'] = { packPrice: 950, packQty: 8, packUnit: 'كرتونة' };
        map['NAME_غولد لاين (gold line)'] = { packPrice: 950, packQty: 8, packUnit: 'كرتونة' };
        localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(map));
      }

      const prods = window.AppState?.products || [];
      prods.forEach((p) => {
        const pid = Number(p.id);
        const pNameKey = 'NAME_' + String(p.name || '').trim().toLowerCase();
        const stored = map['ID_' + pid] || map[pNameKey];

        if (stored && (stored.packQty > 1 || stored.packPrice > 0)) {
          p.wholesale_price = stored.packPrice;
          p.pack_price = stored.packPrice;
          p.wholesale_qty = stored.packQty;
          p.pack_qty = stored.packQty;
          p.wholesale_min_qty = stored.packQty;
          p.pack_factor = stored.packQty;
          p.wholesale_unit = stored.packUnit || 'كرتونة';
        }
      });
    },

    resolvePackConfig(prod, item = null) {
      const map = this.getSavedPackMap();
      const pid = Number(prod?.id || item?.product_id || item?.productId || 0);
      const pName = String(prod?.name || item?.name || '').trim();
      const stored = (pid && map['ID_' + pid]) || (pName && map['NAME_' + pName.toLowerCase()]) || null;

      const unitRetailPrice = Number(
        item?._savedUnitPrice ??
        prod?.selling_price ??
        prod?.price ??
        item?.price ??
        0
      );

      const rawQty = Number(
        stored?.packQty ||
        prod?.pack_qty ||
        prod?.wholesale_qty ||
        prod?.wholesale_min_qty ||
        prod?.pack_factor ||
        0
      );

      const rawPrice = Number(
        stored?.packPrice ||
        prod?.wholesale_price ||
        prod?.pack_price ||
        0
      );

      const packUnitName = String(
        stored?.packUnit ||
        prod?.wholesale_unit ||
        prod?.pack_unit ||
        'كرتونة'
      ).trim() || 'كرتونة';

      const isConfigured = rawQty > 1 || rawPrice > 0;
      const packQty = rawQty > 1 ? rawQty : 6;

      let totalPackPriceDzd = Number((packQty * unitRetailPrice).toFixed(2));
      let unitPriceInsidePack = unitRetailPrice;

      if (rawPrice > 0) {
        if (rawPrice > unitRetailPrice) {
          totalPackPriceDzd = Number(rawPrice.toFixed(2));
          unitPriceInsidePack = Number((rawPrice / packQty).toFixed(4));
        } else {
          unitPriceInsidePack = rawPrice;
          totalPackPriceDzd = Number((packQty * rawPrice).toFixed(2));
        }
      }

      const regularTotalForSameQty = Number((packQty * unitRetailPrice).toFixed(2));
      const savingsPerPack = Math.max(0, Number((regularTotalForSameQty - totalPackPriceDzd).toFixed(2)));

      return {
        isConfigured,
        packQty,
        packUnitName,
        unitRetailPrice,
        totalPackPriceDzd,
        unitPriceInsidePack,
        savingsPerPack
      };
    },

    locateModalInputs() {
      const modal = document.getElementById('productModal');
      if (!modal) return {};

      let costInp = document.getElementById('prodCostInput');
      let sellInp = document.getElementById('prodPriceInput') || document.getElementById('prodSellInput');
      let packPriceInp = document.getElementById('prodWholesaleInput');
      let packUnitInp = document.getElementById('prodWholesaleUnitInput') || document.getElementById('prodPackUnitInput');
      let packQtyInp = document.getElementById('prodWholesaleQtyInput') ||
        document.getElementById('prodPackQtyInput') ||
        document.getElementById('prodWholesaleMinQtyInput');

      Array.from(modal.querySelectorAll('label')).forEach((lbl) => {
        const txt = (lbl.textContent || '').trim();
        const inp = lbl.parentElement?.querySelector('input');
        if (!inp) return;
        if (txt.includes('سعر البيع بالباكي') || txt.includes('سعر الجملة')) packPriceInp = inp;
        else if (txt.includes('pack_qty') || txt.includes('عدد الحبات داخل الباكي') || txt.includes('عدد القطع في الكرتونة')) packQtyInp = inp;
        else if (txt.includes('اسم العبوة') || txt.includes('اسم وحدة الجملة')) packUnitInp = inp;
        else if (txt.includes('سعر البيع (التجزئة)')) sellInp = inp;
        else if (txt.includes('سعر التكلفة')) costInp = inp;
      });

      return { modal, costInp, sellInp, packPriceInp, packUnitInp, packQtyInp };
    },

    hookProductModalPackInputsAndLivePreview() {
      const saveCurrentModalPackInputs = () => {
        const { modal, packPriceInp, packUnitInp, packQtyInp } = this.locateModalInputs();
        if (!modal || !modal.classList.contains('active')) return;

        let pid = document.getElementById('prodIdInput')?.value ||
          document.getElementById('prodEditId')?.value ||
          window.AppState?.editingProductId || '';

        if (!pid) {
          const headerText = modal.querySelector('h3')?.parentElement?.textContent || modal.textContent || '';
          const hashMatch = headerText.match(/#(\d+)/);
          if (hashMatch && hashMatch[1]) pid = hashMatch[1];
        }

        const pName = document.getElementById('prodNameInput')?.value?.trim() || '';
        const packPrice = parseFloat(packPriceInp?.value || '0') || 0;
        const packQty = parseFloat(packQtyInp?.value || '0') || 0;
        const packUnit = packUnitInp?.value?.trim() || 'كرتونة';

        if (pid || pName) {
          this.savePackConfig(pid, pName, { packPrice, packQty, packUnit });
        }
      };

      document.addEventListener(
        'input',
        (e) => {
          if (e.target && e.target.closest('#productModal')) saveCurrentModalPackInputs();
        },
        true
      );
      document.addEventListener(
        'click',
        (e) => {
          if (e.target && e.target.closest('#productModal')) setTimeout(saveCurrentModalPackInputs, 60);
        },
        true
      );
    },

    applyPackModeToRow(idx, packsCount = 1) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );

      const cfg = this.resolvePackConfig(prod, item);
      const count = Math.max(1, parseInt(packsCount, 10) || 1);

      if (!item._savedUnitPrice) item._savedUnitPrice = cfg.unitRetailPrice;

      item._isCartonPackMode = true;
      item._isWholesaleMode = true;
      item._editedFromSubtotalBox = false;
      delete item._manualLineSubtotal;
      item._packsCount = count;
      item._packQtyFactor = cfg.packQty;
      item._packUnitLabel = cfg.packUnitName;
      item._singlePackTotalDzd = cfg.totalPackPriceDzd;

      item.quantity = Number((count * cfg.packQty).toFixed(3));
      item.price = Number((cfg.totalPackPriceDzd / cfg.packQty).toFixed(4));
      item.custom_price = item.price;
      item.subtotal = Number((count * cfg.totalPackPriceDzd).toFixed(2));

      window.App.recalcAndRenderCart?.();
    },

    revertRowToSingleUnit(idx) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );
      const unitPrice = Number(item._savedUnitPrice || prod?.selling_price || prod?.price || 125);

      item._isCartonPackMode = false;
      item._isWholesaleMode = false;
      item._editedFromSubtotalBox = false;
      delete item._manualLineSubtotal;
      delete item._packsCount;
      delete item._singlePackTotalDzd;
      delete item.custom_price;

      item.quantity = 1;
      item.price = unitPrice;
      item.subtotal = Number(unitPrice.toFixed(2));

      window.App.recalcAndRenderCart?.();
    },

    togglePackOnRow(idx) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;
      if (!item._isCartonPackMode) this.applyPackModeToRow(idx, 1);
      else this.revertRowToSingleUnit(idx);
    },

    stepPacksOnRow(idx, delta) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;
      const nextCount = Number(item._packsCount || 1) + delta;
      if (nextCount <= 0) this.revertRowToSingleUnit(idx);
      else this.applyPackModeToRow(idx, nextCount);
    },

    overrideAllPackMethodsAndRecalc() {
      const toggleFn = (idx) => this.togglePackOnRow(idx);
      if (window.App) {
        window.App.toggleCartItemWholesaleUnit = toggleFn;
        window.App.openUnitChoiceModal = toggleFn;
        window.App.openPosUnitChoiceModal = toggleFn;
      }

      if (window.App && typeof window.App.recalcCart === 'function' && !window.App._v8ExactPackRecalcWrapped) {
        const origRecalc = window.App.recalcCart.bind(window.App);
        window.App.recalcCart = function (...args) {
          const cart = window.App?.currentCart;
          if (cart && Array.isArray(cart.items)) {
            cart.items.forEach((it) => {
              const qty = Number(it.quantity || 1);
              const price = Number(it.price || 0);

              if (it._isCartonPackMode && it._packQtyFactor) {
                const expectedUnitFromPack = Number(((it._singlePackTotalDzd || 0) / it._packQtyFactor).toFixed(4));
                if (Math.abs(price - expectedUnitFromPack) > 0.02 && !it._editedFromSubtotalBox) {
                  it._singlePackTotalDzd = Number((price * it._packQtyFactor).toFixed(2));
                  it.subtotal = Number((qty * price).toFixed(2));
                } else if (it._editedFromSubtotalBox && it._manualLineSubtotal !== undefined) {
                  it.subtotal = Number(it._manualLineSubtotal.toFixed(2));
                } else {
                  const ratio = qty / Number(it._packQtyFactor);
                  if (Math.abs(ratio - Math.round(ratio)) < 0.01 && Math.round(ratio) >= 1) {
                    it._packsCount = Math.round(ratio);
                    it.subtotal = Number((it._packsCount * it._singlePackTotalDzd).toFixed(2));
                  } else {
                    it.subtotal = Number((qty * price).toFixed(2));
                  }
                }
              } else if (it._editedFromSubtotalBox && it._manualLineSubtotal !== undefined) {
                it.subtotal = Number(it._manualLineSubtotal.toFixed(2));
              }
            });
          }

          const res = origRecalc(...args);

          if (cart && Array.isArray(cart.items)) {
            let exactSub = 0;
            cart.items.forEach((it) => {
              if (it._editedFromSubtotalBox && it._manualLineSubtotal !== undefined) {
                it.subtotal = Number(it._manualLineSubtotal.toFixed(2));
              } else if (it._isCartonPackMode && it._singlePackTotalDzd && it._packsCount) {
                const ratio = Number(it.quantity || 0) / Number(it._packQtyFactor || 1);
                if (Math.abs(ratio - it._packsCount) < 0.01) {
                  it.subtotal = Number((it._packsCount * it._singlePackTotalDzd).toFixed(2));
                }
              }
              exactSub += Number(it.subtotal || 0);
            });
            if (res && typeof res === 'object') {
              const disc = Number(cart.discount || 0) + Number(cart.couponDiscount || 0);
              res.subtotal = Number(exactSub.toFixed(2));
              res.total = Math.max(0, Number((exactSub - disc).toFixed(2)));
            }
          }
          return res;
        };
        window.App._v8ExactPackRecalcWrapped = true;
      }
    }
  };

  window.GherbiV8PackEngine = V8PackEngine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V8PackEngine.init());
  } else {
    V8PackEngine.init();
  }
})();


/* ==================== [MODULE: gherbi-v8-stage3-retail-checkout.js] ==================== */
/**
 * gherbi-v8-stage3-retail-checkout.js (Fixed Selector Edition)
 * تحويل نافذة التسديد (F1 - #checkoutModal) لتناسب البيع بالتجزئة والسوبرماركت 100%
 */

'use strict';

(function initGherbiV8Stage3RetailCheckout() {
  const V8Checkout = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.transformCheckoutModalForRetail();
        this.hookOpenCheckoutModalSync();
        console.log('🚀 [Gherbi V8 - Stage 3 Fixed]: نافذة التسديد (F1) للتجزئة والسوبرماركت تعمل بدون أي أخطاء.');
      }, 200);
    },

    transformCheckoutModalForRetail() {
      const modal = document.getElementById('checkoutModal');
      if (!modal) return;

      // 1. إلغاء تحديد وإخفاء TVA (19%) وحق الطابع (1%) الخاصة بالجملة نهائياً
      const tvaChk = document.getElementById('chkApplyTva');
      const stampChk = document.getElementById('chkApplyStamp');
      if (tvaChk) {
        tvaChk.checked = false;
        const row = tvaChk.closest('.grid');
        if (row && row.querySelector('#chkApplyStamp')) {
          row.style.display = 'none';
        }
      }
      if (stampChk) stampChk.checked = false;

      // 2. إضافة أزرار طرق الدفع اللمسية السريعة للتجزئة (نقداً | كريدي | الذهبية | بريدي موب)
      const methodSelect = document.getElementById('chkPaymentMethod');
      if (methodSelect && !document.getElementById('retailPaymentMethodPills')) {
        const wrapper = methodSelect.parentElement;
        methodSelect.classList.add('hidden');

        const pillsGrid = document.createElement('div');
        pillsGrid.id = 'retailPaymentMethodPills';
        pillsGrid.className = 'grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1';
        pillsGrid.innerHTML = `
          <button type="button" onclick="GherbiV8Checkout.selectRetailPayMethod('cash')" data-rpay="cash" class="retail-pay-method-pill active">
            <span>💵 نقداً (Cash)</span>
          </button>
          <button type="button" onclick="GherbiV8Checkout.selectRetailPayMethod('credit')" data-rpay="credit" class="retail-pay-method-pill">
            <span>📒 كريدي (دين)</span>
          </button>
          <button type="button" onclick="GherbiV8Checkout.selectRetailPayMethod('cib')" data-rpay="cib" class="retail-pay-method-pill">
            <span>💳 الذهبية / CIB</span>
          </button>
          <button type="button" onclick="GherbiV8Checkout.selectRetailPayMethod('baridimob')" data-rpay="baridimob" class="retail-pay-method-pill">
            <span>📱 بريدي موب</span>
          </button>
        `;
        wrapper.appendChild(pillsGrid);
      }

      // 3. إخفاء "تاريخ استحقاق الدين" في الوضع النقدي وإظهار ملخص القفة والنقاط مكانه
      const dueDateInp = document.getElementById('chkDueDate');
      if (dueDateInp) {
        const dueWrap = dueDateInp.parentElement;
        if (dueWrap) {
          dueWrap.id = 'retailDueDateContainer';
          dueWrap.classList.add('hidden');

          if (!document.getElementById('retailCheckoutSummaryCard')) {
            const summaryCard = document.createElement('div');
            summaryCard.id = 'retailCheckoutSummaryCard';
            summaryCard.className = 'p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 text-xs mt-2';
            dueWrap.parentElement.insertBefore(summaryCard, dueWrap);
          }
        }
      }

      // 4. ربط حقل المبلغ المستلم لتحديث الباقي بالسنتيم لحظياً
      const paidInp = document.getElementById('chkPaidAmount');
      if (paidInp && !paidInp.dataset.v8LiveBound) {
        paidInp.dataset.v8LiveBound = '1';
        paidInp.addEventListener('input', () => this.updateCheckoutChangeInCentimes());
        paidInp.addEventListener('keyup', () => this.updateCheckoutChangeInCentimes());
      }

      // 5. الوصول الآمن لحاوية الأزرار السفلية بدون استخدام النقطتين (:) في querySelector
      const firstSubmitBtn = modal.querySelector('button[onclick*="submitSale"]');
      const bottomBtnsGrid = firstSubmitBtn ? firstSubmitBtn.parentElement : null;

      if (bottomBtnsGrid && !bottomBtnsGrid.dataset.v8RetailButtons) {
        bottomBtnsGrid.dataset.v8RetailButtons = '1';
        bottomBtnsGrid.innerHTML = `
          <button type="button" onclick="App.submitSale('receipt')"
            class="py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/25">
            <span class="material-symbols-rounded icon-sm">receipt_long</span>
            <span>تأكيد وطباعة وصل حراري (Enter)</span>
          </button>
          <button type="button" onclick="App.submitSale('none')"
            class="py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow">
            <span class="material-symbols-rounded icon-sm">check_circle</span>
            <span>حفظ سريع بدون طباعة (Ctrl+Space)</span>
          </button>
          <button type="button" onclick="GherbiV8Checkout.submitSaleWithGiftExchangeTicket()"
            class="py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow">
            <span>🎁</span>
            <span>حفظ + وصل تبديل هدية (بدون أسعار)</span>
          </button>
        `;
      }
    },

    selectRetailPayMethod(method) {
      const sel = document.getElementById('chkPaymentMethod');
      if (sel) {
        sel.value = method;
        window.App.onCheckoutMethodChange?.(method);
      }

      document.querySelectorAll('[data-rpay]').forEach((btn) => {
        const isMatch = btn.dataset.rpay === method;
        btn.className = 'retail-pay-method-pill ' + (isMatch ? (method === 'credit' ? 'active-credit' : 'active') : '');
      });

      const dueWrap = document.getElementById('retailDueDateContainer');
      const paidInp = document.getElementById('chkPaidAmount');
      const totalTxt = document.getElementById('chkTotalDue')?.textContent || '0';
      const totalDue = parseFloat(totalTxt.replace(/[^0-9.-]/g, '')) || 0;

      if (method === 'credit') {
        dueWrap?.classList.remove('hidden');
        if (paidInp) paidInp.value = '0';
        const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value;
        if (!cid && window.showToast) {
          window.showToast('⚠️ تنبيه: لتسجيل الدين (الكريدي)، يرجى تحديد اسم الزبون أولاً عبر (F8)', 'warning');
        }
      } else {
        dueWrap?.classList.add('hidden');
        if (paidInp && Number(paidInp.value || 0) === 0 && totalDue > 0) {
          paidInp.value = totalDue.toFixed(2);
        }
      }

      window.App.recalcCheckoutModal?.();
      this.updateCheckoutChangeInCentimes();
    },

    updateCheckoutChangeInCentimes() {
      setTimeout(() => {
        const totalTxt = document.getElementById('chkTotalDue')?.textContent || '0';
        const totalDue = parseFloat(totalTxt.replace(/[^0-9.-]/g, '')) || 0;
        const paid = parseFloat(document.getElementById('chkPaidAmount')?.value || '0') || 0;
        const changeEl = document.getElementById('chkChangeAmount');
        const method = document.getElementById('chkPaymentMethod')?.value || 'cash';

        if (!changeEl) return;
        const diff = Number((paid - totalDue).toFixed(2));

        if (diff >= 0) {
          const centimes = Math.round(diff * 100).toLocaleString('fr-DZ');
          changeEl.className = 'w-full px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono font-black text-base text-center';
          changeEl.innerHTML = `<div>${diff.toFixed(2)} د.ج</div><div class="text-[10px] text-amber-600 dark:text-amber-400 font-bold">(${centimes} سنتيم)</div>`;
        } else {
          const debt = Math.abs(diff);
          changeEl.className = 'w-full px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 font-mono font-black text-sm text-center';
          changeEl.innerHTML = `<div>${method === 'credit' ? 'دين مسجل:' : 'باقي مطلوب:'} ${debt.toFixed(2)} د.ج</div>`;
        }
      }, 20);
    },

    renderRetailCheckoutSummary() {
      const box = document.getElementById('retailCheckoutSummaryCard');
      if (!box) return;

      const cart = window.App?.currentCart;
      const items = cart?.items || [];
      const totalPieces = items.reduce((s, it) => s + Math.abs(Number(it.quantity || 0)), 0);
      const cid = cart?.customerId || document.getElementById('posCustomerSelect')?.value;
      const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;
      const earnedPts = window.GherbiStage12Enforcer
        ? window.GherbiStage12Enforcer.calcEligiblePoints(items, cart?.discount || 0)
        : 0;

      box.innerHTML = `
        <div class="flex items-center justify-between font-bold">
          <span class="text-slate-500">🛒 إجمالي السلع في القفة:</span>
          <strong class="font-mono text-slate-800 dark:text-white">${items.length} أصناف (${Number(totalPieces.toFixed(2))} وحدة)</strong>
        </div>
        <div class="flex items-center justify-between font-bold">
          <span class="text-slate-500">👤 الزبون:</span>
          <strong class="text-blue-600 dark:text-blue-400">${cust ? '👑 ' + cust.name : 'زبون عابر (نقدي)'}</strong>
        </div>
        ${
          cust
            ? `<div class="flex items-center justify-between font-black text-amber-600 dark:text-amber-400 pt-1 border-t border-emerald-500/20">
                 <span>⭐ النقاط المكتسبة من هذه الفاتورة:</span>
                 <span class="font-mono">+${earnedPts} نقطة وفاء</span>
               </div>`
            : ''
        }
      `;
    },

    async submitSaleWithGiftExchangeTicket() {
      await window.App.submitSale?.('none');
      setTimeout(() => {
        if (window.RetailMaster && typeof window.RetailMaster.printGiftExchangeTicket === 'function') {
          window.RetailMaster.printGiftExchangeTicket();
        }
      }, 200);
    },

    hookOpenCheckoutModalSync() {
      const origOpenChk = window.App.openCheckoutModal?.bind(window.App);
      if (origOpenChk && !window.App._v8OpenChkHooked) {
        window.App.openCheckoutModal = function (...args) {
          const res = origOpenChk(...args);
          V8Checkout.transformCheckoutModalForRetail();
          V8Checkout.selectRetailPayMethod('cash');
          V8Checkout.renderRetailCheckoutSummary();

          const inlineCashVal = parseFloat(document.getElementById('gherbiReceivedCashInput')?.value || '0') || 0;
          const chkPaidInp = document.getElementById('chkPaidAmount');
          if (inlineCashVal > 0 && chkPaidInp) {
            chkPaidInp.value = inlineCashVal.toFixed(2);
            window.App.recalcCheckoutModal?.();
          }
          V8Checkout.updateCheckoutChangeInCentimes();
          return res;
        };
        window.App._v8OpenChkHooked = true;
      }

      const origDenom = window.App.addCashDenom?.bind(window.App);
      if (origDenom && !window.App._v8DenomHooked) {
        window.App.addCashDenom = function (val) {
          const r = origDenom(val);
          V8Checkout.updateCheckoutChangeInCentimes();
          return r;
        };
        window.App._v8DenomHooked = true;
      }
    }
  };

  window.GherbiV8Checkout = V8Checkout;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V8Checkout.init());
  } else {
    V8Checkout.init();
  }
})();


/* ==================== [MODULE: gherbi-v9-dual-price-and-owner-radar.js] ==================== */
/**
 * gherbi-v9-dual-price-and-owner-radar.js (V12 Master Edition)
 * - F12: يركز ويظلل "الإجمالي في الشريحة" (الرقم الأيسر المشار إليه في الصورة 1).
 * - Alt+P أو F11: يركز ويظلل "السعر الأوسط" (سعر الوحدة في وسط السطر).
 * - Alt+Q: يركز ويظلل خانة "الكمية".
 * - شريط أزرار ثلاثي مباشر لاختيار وضع التغيير: [⚖️ ينقص الكمية] | [🏷️ يخفض السعر] | [🧠 ذكي] + اختصار (Alt+S) و (Alt+T).
 * - خالٍ تماماً من الارتعاش (Zero-Flicker) مع حفظ اسم المنتج وتفاصيله.
 */

'use strict';

(function initGherbiV12MasterEngine() {
  const RADAR_STORAGE_KEY = 'gherbi_owner_price_radar_v9';
  const SUBTOTAL_MODE_KEY = 'gherbi_subtotal_edit_mode_v10'; // 'qty' | 'price' | 'smart'

  const V9Engine = {
    activeRadarFilter: 'all',
    subtotalEditMode: localStorage.getItem(SUBTOTAL_MODE_KEY) || 'qty',
    selectedRowIdx: 0,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);

        this.disableConflictingLegacyCartRowTimers();
        this.injectModeControlToolbarInPos();
        this.hookCartLifecycleMethods();
        this.bindMasterRowKeyboardShortcuts();
        this.hookAnalyticsViewForOwnerRadar();

        if (typeof window.App.renderCartItems === 'function') {
          window.App.renderCartItems();
        }
        this.decorateAllCartRowsOnce();

        setInterval(() => {
          this.injectModeControlToolbarInPos();
          this.decorateAllCartRowsOnce();
          this.ensureOwnerRadarRenderedInAnalytics();
        }, 350);

        console.log('🚀 [Gherbi V12 Ready]: F12 للإجمالي + Alt+P/F11 للسعر الأوسط + أزرار التحكم في الكمية/السعر نشطة 100%.');
      }, 180);
    },

    disableConflictingLegacyCartRowTimers() {
      if (window.GherbiMasterUpgrade) {
        window.GherbiMasterUpgrade.enhanceCartRowsAndStockForecast = function () {};
        window.GherbiMasterUpgrade.focusLastItemPriceWithF12 = () => this.focusLineSubtotalWithF12();
      }
      if (window.GherbiMasterUpgrades) {
        window.GherbiMasterUpgrades.enhanceCartItemsRows = function () {};
        window.GherbiMasterUpgrades.triggerF12PriceEdit = () => this.focusLineSubtotalWithF12();
      }
      if (window.RetailMaster) {
        window.RetailMaster.upgradeCartItemsWithLiveStockAndCostGuard = function () {};
      }
    },

    // ========================================================================
    // 1. دوال التركيز المباشر على الخانات الثلاث في الشريحة (F12 | Alt+P / F11 | Alt+Q)
    // ========================================================================
    getValidSelectedRowIndex() {
      const items = window.App?.currentCart?.items || [];
      if (!items.length) return -1;
      if (this.selectedRowIdx >= 0 && this.selectedRowIdx < items.length) {
        return this.selectedRowIdx;
      }
      this.selectedRowIdx = items.length - 1;
      return this.selectedRowIdx;
    },

    selectCartRow(idx) {
      const items = window.App?.currentCart?.items || [];
      if (!items.length) return;
      this.selectedRowIdx = Math.max(0, Math.min(idx, items.length - 1));
      if (window.AppState) window.AppState.selectedCartRowIdx = this.selectedRowIdx;

      const cartBox = document.getElementById('posCartItems');
      if (!cartBox) return;
      const rows = Array.from(cartBox.children).filter(
        (el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة')
      );
      rows.forEach((r, i) => r.classList.toggle('gherbi-active-cart-row', i === this.selectedRowIdx));
    },

    // F12 -> يركز ويظلل "الإجمالي في الشريحة" (الرقم الأيسر المشار إليه بالدائرة الزرقاء في الصورة 1)
    focusLineSubtotalWithF12(targetIdx = null) {
      this.decorateAllCartRowsOnce();
      const idx = targetIdx !== null ? targetIdx : this.getValidSelectedRowIndex();
      if (idx < 0) {
        if (window.showToast) window.showToast('⚠️ السلة فارغة — أضف سلعة أولاً لتعديل إجمالي الشريحة (F12)', 'warning');
        return;
      }
      this.selectCartRow(idx);
      const subInputs = Array.from(document.querySelectorAll('#posCartItems .gherbi-line-subtotal-input'));
      const targetInp = subInputs[idx] || subInputs[subInputs.length - 1];
      if (targetInp) {
        targetInp.focus();
        targetInp.select();
      }
    },

    // Alt+P أو F11 -> يركز ويظلل "السعر الأوسط" (سعر الوحدة في وسط الشريحة)
    focusMiddleUnitPriceInput(targetIdx = null) {
      this.decorateAllCartRowsOnce();
      const idx = targetIdx !== null ? targetIdx : this.getValidSelectedRowIndex();
      if (idx < 0) {
        if (window.showToast) window.showToast('⚠️ السلة فارغة — أضف سلعة أولاً لتعديل السعر الأوسط (Alt+P)', 'warning');
        return;
      }
      this.selectCartRow(idx);
      const priceInputs = Array.from(document.querySelectorAll('#posCartItems .gherbi-middle-unit-price-input'));
      const targetInp = priceInputs[idx] || priceInputs[priceInputs.length - 1];
      if (targetInp) {
        targetInp.focus();
        targetInp.select();
      }
    },

    // Alt+Q -> يركز ويظلل خانة "الكمية" في الشريحة
    focusQuantityInput(targetIdx = null) {
      this.decorateAllCartRowsOnce();
      const idx = targetIdx !== null ? targetIdx : this.getValidSelectedRowIndex();
      if (idx < 0) {
        if (window.showToast) window.showToast('⚠️ السلة فارغة — أضف سلعة أولاً لتعديل الكمية (Alt+Q)', 'warning');
        return;
      }
      this.selectCartRow(idx);
      const qtyInputs = Array.from(document.querySelectorAll('#posCartItems .gherbi-cart-qty-input-wide'));
      const targetInp = qtyInputs[idx] || qtyInputs[qtyInputs.length - 1];
      if (targetInp) {
        targetInp.focus();
        targetInp.select();
      }
    },

    // ========================================================================
    // 2. شريط الأزرار الثلاثي للتحكم في تغيير الكمية (0.8) أو تخفيض السعر
    // ========================================================================
    setSubtotalEditMode(mode) {
      const validModes = ['qty', 'price', 'smart'];
      if (!validModes.includes(mode)) return;
      this.subtotalEditMode = mode;
      localStorage.setItem(SUBTOTAL_MODE_KEY, mode);
      this.refreshModeControlButtonsUI();

      if (window.showToast) {
        const messages = {
          qty: '⚖️ تم تفعيل وضع: إنقاص/تغيير الكمية تلقائياً (1 ⬅ 0.8) عند تعديل الإجمالي (F12)',
          price: '🏷️ تم تفعيل وضع: تخفيض/تغيير السعر عند تعديل الإجمالي (F12) مع بقاء الكمية ثابتة',
          smart: '🧠 تم تفعيل الوضع الذكي: يغير الكمية (0.8) بالحبة/الميزان، ويغير السعر في الكرتونة'
        };
        window.showToast(messages[mode], 'info');
      }
    },

    cycleSubtotalEditMode() {
      const order = ['qty', 'price', 'smart'];
      const next = order[(order.indexOf(this.subtotalEditMode) + 1) % order.length];
      this.setSubtotalEditMode(next);
    },

    refreshModeControlButtonsUI() {
      const m = this.subtotalEditMode;
      const btnQty = document.getElementById('v12ModeBtnQty');
      const btnPrice = document.getElementById('v12ModeBtnPrice');
      const btnSmart = document.getElementById('v12ModeBtnSmart');

      if (btnQty) btnQty.className = 'gherbi-v12-mode-btn ' + (m === 'qty' ? 'active-qty' : '');
      if (btnPrice) btnPrice.className = 'gherbi-v12-mode-btn ' + (m === 'price' ? 'active-price' : '');
      if (btnSmart) btnSmart.className = 'gherbi-v12-mode-btn ' + (m === 'smart' ? 'active-smart' : '');
    },

    injectModeControlToolbarInPos() {
      // إزالة الزر الفردي القديم إن وجد واستبداله بشريط أزرار التحكم المتكامل
      document.getElementById('gherbiSubtotalModeSwitchBtn')?.remove();

      const multStrip = document.querySelector('.gherbi-multiplier-strip') || document.getElementById('posQuickMultiplierBar');
      if (!multStrip || document.getElementById('gherbiV12ModeControlBar')) return;

      const bar = document.createElement('div');
      bar.id = 'gherbiV12ModeControlBar';
      bar.className = 'flex items-center gap-1.5 flex-wrap';
      bar.innerHTML = `
        <div class="gherbi-v12-mode-segmented-bar" title="اختر ماذا يتغير عندما تعدل خانة الإجمالي (F12) — اختصار التبديل: Alt+S">
          <span class="text-[9.5px] font-black text-slate-500 px-1.5">الإجمالي (F12) يغير:</span>
          <button type="button" id="v12ModeBtnQty" onclick="GherbiV9Engine.setSubtotalEditMode('qty')" class="gherbi-v12-mode-btn">
            ⚖️ الكمية (0.8)
          </button>
          <button type="button" id="v12ModeBtnPrice" onclick="GherbiV9Engine.setSubtotalEditMode('price')" class="gherbi-v12-mode-btn">
            🏷️ السعر
          </button>
          <button type="button" id="v12ModeBtnSmart" onclick="GherbiV9Engine.setSubtotalEditMode('smart')" class="gherbi-v12-mode-btn">
            🧠 ذكي
          </button>
        </div>

        <button type="button" onclick="GherbiV9Engine.focusMiddleUnitPriceInput()"
          class="px-2 py-0.5 rounded-md bg-sky-500/15 hover:bg-sky-600 text-sky-700 dark:text-sky-300 hover:text-white border border-sky-500/30 text-[10px] font-black transition flex items-center gap-1"
          title="القفز مباشرة لتعديل السعر الأوسط للسلعة (اختصار: Alt+P أو F11)">
          <span>🏷️ السعر الأوسط</span>
          <kbd class="font-mono text-[9px] bg-black/15 px-1 rounded" dir="ltr">Alt+P</kbd>
        </button>
      `;

      multStrip.appendChild(bar);
      this.refreshModeControlButtonsUI();
    },

    // ========================================================================
    // 3. الاختصارات الشاملة للتحكم في الشريحة (F12 | Alt+P / F11 | Alt+Q | Alt+S | Alt+T | ↑ / ↓)
    // ========================================================================
    bindMasterRowKeyboardShortcuts() {
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;

          // عدم مقاطعة النوافذ المنبثقة المفتوحة
          const openModal = document.querySelector('.modal-overlay.active, #gherbiAisleKioskOverlay.active');
          if (openModal) return;

          // 1. F12 -> التركيز الفوري على "الإجمالي في الشريحة" (الرقم الأيسر المشار إليه في الصورة 1)
          if (e.key === 'F12') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusLineSubtotalWithF12();
            return;
          }

          // 2. Alt + P أو F11 -> التركيز الفوري على "السعر الأوسط" (سعر الوحدة)
          if (e.key === 'F11' || (e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusMiddleUnitPriceInput();
            return;
          }

          // 3. Alt + Q -> التركيز الفوري على خانة "الكمية"
          if (e.altKey && (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusQuantityInput();
            return;
          }

          // 4. Alt + S -> تبديل وضع عمل الإجمالي (كمية 0.8 ⇄ سعر ⇄ ذكي)
          if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
            e.preventDefault();
            e.stopPropagation();
            this.cycleSubtotalEditMode();
            return;
          }

          // 5. Alt + T -> قلب السطر المحدد فوراً بين (كمية جزئية 1.04 = 1040غ ⇄ تخفيض سعر بكمية 1)
          if (e.altKey && (e.key === 't' || e.key === 'T' || e.code === 'KeyT')) {
            e.preventDefault();
            e.stopPropagation();
            const idx = this.getValidSelectedRowIndex();
            if (idx >= 0) {
              this.convertRowBetweenFractionalQtyAndPriceDiscount(idx);
            }
            return;
          }

          // 6. Alt + G -> فتح محطة الميزان الإلكتروني المباشر
          if (e.altKey && (e.key === 'g' || e.key === 'G' || e.code === 'KeyG')) {
            e.preventDefault();
            e.stopPropagation();
            window.App.openPosScaleModal?.();
            return;
          }

          // 7. Alt + B -> فتح شاشة فاحص الأسعار الذاتي للزبائن (Borne de Prix)
          if (e.altKey && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) {
            e.preventDefault();
            e.stopPropagation();
            window.GherbiV7Stage2?.openKioskMode?.();
            return;
          }

          // 8. Alt + H -> فتح دليل ومركز الاختصارات الشامل
          if (e.altKey && (e.key === 'h' || e.key === 'H' || e.code === 'KeyH')) {
            e.preventDefault();
            e.stopPropagation();
            window.GherbiV6Stage2?.openShortcutsHub?.();
            return;
          }

          // 9. الأسهم (↑ / ↓) للتنقل بين سطور السلة عندما لا يكون المؤشر داخل قائمة بحث
          const activeTag = (document.activeElement?.tagName || '').toLowerCase();
          if (activeTag !== 'select' && activeTag !== 'textarea' && document.activeElement?.id !== 'globalPosSearch') {
            const items = window.App?.currentCart?.items || [];
            if (items.length > 1 && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.ctrlKey && !e.altKey) {
              const inCartInput = document.activeElement?.closest('#posCartItems');
              if (!inCartInput || e.target.id === 'barcodeInput') {
                e.preventDefault();
                const cur = this.getValidSelectedRowIndex();
                const next = e.key === 'ArrowUp' ? Math.max(0, cur - 1) : Math.min(items.length - 1, cur + 1);
                this.selectCartRow(next);
              }
            }
          }
        },
        true
      );
    },

    // ========================================================================
    // 4. التبديل الفوري داخل السطر بين (كمية جزئية 1.04 = 1040غ ⇄ تخفيض/تعديل سعر كمية 1)
    // ========================================================================
    convertRowBetweenFractionalQtyAndPriceDiscount(idx) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );
      const baseRetailPrice = Number(item._savedUnitPrice || prod?.selling_price || prod?.price || 125);
      const currentSubtotal = Number(item.subtotal ?? (Number(item.quantity || 1) * Number(item.price || 0)));
      const currentQty = Math.abs(Number(item.quantity || 1));
      const sign = Number(item.quantity || 1) < 0 ? -1 : 1;
      const isCurrentlyFractional = Math.abs(currentQty - Math.round(currentQty)) > 0.001;

      if (isCurrentlyFractional) {
        const targetWholeQty = Math.max(1, Math.round(currentQty) || 1);
        const newDiscountedPrice = Number((currentSubtotal / targetWholeQty).toFixed(2));

        item.quantity = targetWholeQty * sign;
        item.price = newDiscountedPrice;
        item.custom_price = newDiscountedPrice;
        item.subtotal = Number((currentSubtotal * sign).toFixed(2));
        item._editedFromSubtotalBox = true;
        item._manualLineSubtotal = item.subtotal;
        item._lastSubtotalEditType = 'price_discount';

        this.recordPriceModificationEvent(item, prod, baseRetailPrice, newDiscountedPrice, 'تحويل إلى تعديل سعر');
        window.App.recalcAndRenderCart?.();
        if (window.showToast) {
          window.showToast(`🏷️ تم التحويل إلى تعديل السعر الأوسط: الكمية (${targetWholeQty} قطعة) بسعر ${newDiscountedPrice.toFixed(2)} د.ج`, 'success');
        }
      } else if (baseRetailPrice > 0) {
        const newFracQty = Number((currentSubtotal / baseRetailPrice).toFixed(3));
        item._savedUnitPrice = baseRetailPrice;
        item.price = baseRetailPrice;
        delete item.custom_price;
        item.quantity = newFracQty * sign;
        item.subtotal = Number((currentSubtotal * sign).toFixed(2));
        item._editedFromSubtotalBox = true;
        item._manualLineSubtotal = item.subtotal;
        item._lastSubtotalEditType = 'fractional_qty';

        this.recordFractionalQuantityEvent(item, prod, currentQty, newFracQty, currentSubtotal);
        window.App.recalcAndRenderCart?.();
        if (window.showToast) {
          const grams = Math.round(newFracQty * 1000);
          window.showToast(`⚖️ تم التحويل إلى كمية جزئية بالمبلغ: (${newFracQty} = ${grams} غرام) بسعر الوحدة الأصلي ${baseRetailPrice.toFixed(2)} د.ج`, 'success');
        }
      }
    },

    applyUnitPriceChangeToRow(idx, newUnitPriceVal) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const parsedPrice = parseFloat(newUnitPriceVal);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );

      if (!item._savedUnitPrice) {
        item._savedUnitPrice = Number(prod?.selling_price ?? prod?.price ?? item.price ?? parsedPrice);
      }

      const oldPrice = Number(item.price || 0);
      const qty = Math.max(0.001, Math.abs(Number(item.quantity || 1)));
      const sign = Number(item.quantity || 1) < 0 ? -1 : 1;

      item._editedFromSubtotalBox = false;
      delete item._manualLineSubtotal;
      item._lastSubtotalEditType = 'unit_price';

      item.price = Number(parsedPrice.toFixed(2));
      item.custom_price = item.price;
      item.subtotal = Number((qty * sign * item.price).toFixed(2));

      if (item._isCartonPackMode) {
        const factor = Number(item._packQtyFactor || qty || 1);
        item._singlePackTotalDzd = Number((item.price * factor).toFixed(2));
      }

      this.recordPriceModificationEvent(item, prod, oldPrice, item.price, 'تعديل السعر الأوسط (Alt+P)');
      window.App.recalcAndRenderCart?.();
    },

    applyLineSubtotalChangeToRow(idx, newSubtotalVal, shiftKeyPressed = false) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const parsedTotal = parseFloat(newSubtotalVal);
      if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );

      const baseUnitPrice = Number(item._savedUnitPrice || prod?.selling_price || item.price || 1);
      if (!item._savedUnitPrice) item._savedUnitPrice = baseUnitPrice;

      const oldQty = Math.abs(Number(item.quantity || 1));
      const sign = Number(item.quantity || 1) < 0 ? -1 : 1;

      let shouldAdjustQuantity = false;
      if (this.subtotalEditMode === 'qty') {
        shouldAdjustQuantity = !shiftKeyPressed;
      } else if (this.subtotalEditMode === 'price') {
        shouldAdjustQuantity = shiftKeyPressed;
      } else {
        shouldAdjustQuantity = item._isCartonPackMode ? shiftKeyPressed : !shiftKeyPressed;
      }

      if (shouldAdjustQuantity && baseUnitPrice > 0) {
        const cleanQty = Number((parsedTotal / baseUnitPrice).toFixed(3));
        item.price = baseUnitPrice;
        item.quantity = cleanQty * sign;
        item.subtotal = Number((parsedTotal * sign).toFixed(2));
        item._editedFromSubtotalBox = true;
        item._manualLineSubtotal = item.subtotal;
        item._lastSubtotalEditType = 'fractional_qty';

        this.recordFractionalQuantityEvent(item, prod, oldQty, cleanQty, parsedTotal);
        window.App.recalcAndRenderCart?.();
        return;
      }

      const newUnitPrice = Number((parsedTotal / oldQty).toFixed(4));
      item._editedFromSubtotalBox = true;
      item._manualLineSubtotal = Number((parsedTotal * sign).toFixed(2));
      item.subtotal = item._manualLineSubtotal;
      item.price = newUnitPrice;
      item.custom_price = newUnitPrice;
      item._lastSubtotalEditType = 'price_discount';

      if (item._isCartonPackMode) {
        const packsCount = Math.max(1, Number(item._packsCount || 1));
        item._singlePackTotalDzd = Number((parsedTotal / packsCount).toFixed(2));
      }

      this.recordPriceModificationEvent(item, prod, baseUnitPrice, newUnitPrice, 'تعديل إجمالي الشريحة (F12)');
      window.App.recalcAndRenderCart?.();
    },

    hookCartLifecycleMethods() {
      if (typeof window.App.updateCartItemPrice === 'function' && !window.App._v12UpdatePriceHooked) {
        window.App.updateCartItemPrice = (idx, val) => {
          this.applyUnitPriceChangeToRow(idx, val);
        };
        window.App._v12UpdatePriceHooked = true;
      }

      if (typeof window.App.updateCartItemQty === 'function' && !window.App._v12UpdateQtyHooked) {
        const origUpdateQty = window.App.updateCartItemQty.bind(window.App);
        window.App.updateCartItemQty = (idx, val) => {
          const item = window.App?.currentCart?.items?.[idx];
          if (item) {
            item._editedFromSubtotalBox = false;
            delete item._manualLineSubtotal;
          }
          return origUpdateQty(idx, val);
        };
        window.App._v12UpdateQtyHooked = true;
      }

      ['renderCartItems', 'recalcAndRenderCart', 'renderPosView'].forEach((fnName) => {
        const orig = window.App[fnName]?.bind(window.App);
        if (orig && !window.App['_v12Hook_' + fnName]) {
          window.App[fnName] = function (...args) {
            const res = orig(...args);
            V9Engine.decorateAllCartRowsOnce();
            return res;
          };
          window.App['_v12Hook_' + fnName] = true;
        }
      });
    },

    formatCleanQtyString(q) {
      const num = Number(Number(q || 0).toFixed(3));
      return String(num);
    },

    // ========================================================================
    // 5. تزيين سطور السلة مع شارات الاختصارات (F12 | Alt+P | Alt+Q) بدون ارتعاش
    // ========================================================================
    decorateAllCartRowsOnce() {
      const cartBox = document.getElementById('posCartItems');
      if (!cartBox) return;

      const items = window.App?.currentCart?.items || [];
      const rows = Array.from(cartBox.children).filter(
        (el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة')
      );

      if (this.selectedRowIdx >= items.length) {
        this.selectedRowIdx = Math.max(0, items.length - 1);
      }

      rows.forEach((row, idx) => {
        const item = items[idx];
        if (!item) return;

        row.classList.toggle('gherbi-active-cart-row', idx === this.selectedRowIdx);
        if (!row.dataset.v12RowClickBound) {
          row.dataset.v12RowClickBound = '1';
          row.addEventListener('mousedown', () => {
            this.selectedRowIdx = idx;
            rows.forEach((r, i) => r.classList.toggle('gherbi-active-cart-row', i === idx));
          });
        }

        const prod = (window.AppState?.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );

        const qty = Math.abs(Number(item.quantity || 1));
        const unitPrice = Number(item.price || 0);
        const baseRetailPrice = Number(item._savedUnitPrice || prod?.selling_price || prod?.price || unitPrice);
        const lineSubtotal = Number(item.subtotal !== undefined ? item.subtotal : (qty * unitPrice));
        const availableStock = prod ? Number(prod.total_stock ?? prod.stock ?? 0) : null;
        const remainingStock = availableStock !== null ? Number((availableStock - qty).toFixed(2)) : null;

        const rowSignature = `v12_${idx}_${item.name}_${qty}_${unitPrice.toFixed(2)}_${lineSubtotal.toFixed(2)}_${Boolean(item._isCartonPackMode)}_${remainingStock}`;

        // 1. حماية اسم المنتج وتحديث شارة المخزون الورقية فقط
        const rightInfoCol = row.firstElementChild;
        if (rightInfoCol && !(rightInfoCol.textContent || '').includes(item.name || prod?.name || '')) {
          const pTitle = item.name || prod?.name || 'سلعة';
          const uName = prod?.unit || item.unit || 'قطعة';
          rightInfoCol.innerHTML = `
            <div class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${pTitle}</div>
            <div class="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
              <span>${unitPrice.toFixed(2)} د.ج / ${uName}</span>
              ${
                availableStock !== null
                  ? `<span class="gherbi-leaf-stock-badge px-2 py-0.5 rounded-md font-bold text-[10.5px] ${
                      remainingStock <= 0 ? 'bg-rose-500/15 text-rose-600' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    }">📦 متوفر: ${availableStock} ⬅ يبقى: ${remainingStock} ${uName}</span>`
                  : ''
              }
            </div>
          `;
        } else if (rightInfoCol && availableStock !== null) {
          const leafBadges = Array.from(rightInfoCol.querySelectorAll('span')).filter(
            (sp) => sp.children.length === 0 && (sp.textContent || '').includes('متوفر:')
          );
          leafBadges.forEach((sp) => {
            const newStockTxt = `📦 متوفر: ${availableStock} ⬅ يبقى: ${remainingStock} ${prod?.unit || 'قطعة'}`;
            if (sp.textContent !== newStockTxt) sp.textContent = newStockTxt;
          });
        }

        // 2. تنسيق حقل الكمية (Alt+Q) وحقل السعر الأوسط (Alt+P / F11)
        const allInputs = Array.from(row.querySelectorAll('input')).filter(
          (inp) => !inp.classList.contains('gherbi-line-subtotal-input')
        );
        const qtyInp = allInputs.length >= 1 ? allInputs[0] : null;
        const unitPriceInp = allInputs.length >= 2 ? allInputs[allInputs.length - 1] : null;

        if (qtyInp) {
          qtyInp.type = 'text';
          qtyInp.inputMode = 'decimal';
          qtyInp.classList.add('gherbi-cart-qty-input-wide');
          qtyInp.title = 'الكمية (اختصار: Alt+Q)';
          const formattedQty = this.formatCleanQtyString(qty);
          if (document.activeElement !== qtyInp && qtyInp.value !== formattedQty) {
            qtyInp.value = formattedQty;
          }
          if (!qtyInp.parentElement.classList.contains('gherbi-field-kbd-box')) {
            const qWrap = document.createElement('div');
            qWrap.className = 'gherbi-field-kbd-box';
            qtyInp.parentNode.insertBefore(qWrap, qtyInp);
            qWrap.appendChild(qtyInp);
            const qTag = document.createElement('span');
            qTag.className = 'gherbi-mini-kbd-tag tag-altq';
            qTag.dir = 'ltr';
            qTag.textContent = 'Alt+Q';
            qWrap.appendChild(qTag);
          }
        }

        if (unitPriceInp) {
          unitPriceInp.classList.add('gherbi-middle-unit-price-input');
          unitPriceInp.title = 'السعر الأوسط للوحدة (اختصار: Alt+P أو F11)';
          if (document.activeElement !== unitPriceInp) {
            if (unitPriceInp.value !== unitPrice.toFixed(2)) {
              unitPriceInp.value = unitPrice.toFixed(2);
            }
          }
          if (!unitPriceInp.parentElement.classList.contains('gherbi-field-kbd-box')) {
            const pWrap = document.createElement('div');
            pWrap.className = 'gherbi-field-kbd-box';
            unitPriceInp.parentNode.insertBefore(pWrap, unitPriceInp);
            pWrap.appendChild(unitPriceInp);
            const pTag = document.createElement('span');
            pTag.className = 'gherbi-mini-kbd-tag tag-altp';
            pTag.dir = 'ltr';
            pTag.textContent = 'Alt+P';
            pWrap.appendChild(pTag);
          }
          if (!unitPriceInp.dataset.v12PriceBound) {
            unitPriceInp.dataset.v12PriceBound = '1';
            unitPriceInp.removeAttribute('onchange');
            unitPriceInp.removeAttribute('oninput');

            const commitPrice = () => {
              const val = parseFloat(unitPriceInp.value);
              if (Number.isFinite(val) && Math.abs(val - Number(item.price || 0)) > 0.005) {
                this.applyUnitPriceChangeToRow(idx, val);
              }
            };
            unitPriceInp.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                commitPrice();
                unitPriceInp.blur();
                window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
              }
            });
            unitPriceInp.addEventListener('change', commitPrice);
          }
        }

        // 3. تحويل إجمالي الشريحة الأيسر (المشار إليه في الصورة 1) إلى حقل مرتبط بـ (F12)
        let subInput = row.querySelector('.gherbi-line-subtotal-input');
        if (!subInput) {
          const trashBtn = row.querySelector('button[onclick*="removeFromCart"], button[onclick*="removeCartItem"], .text-rose-500');
          let targetPriceTextEl = null;

          if (trashBtn && trashBtn.parentElement) {
            targetPriceTextEl = Array.from(trashBtn.parentElement.children).find(
              (el) =>
                el !== trashBtn &&
                el.tagName !== 'INPUT' &&
                !el.querySelector('input') &&
                /^-?[0-9]+(\.[0-9]+)?(\s*د\.ج)?$/.test((el.textContent || '').trim())
            );
          }

          if (!targetPriceTextEl) {
            targetPriceTextEl = Array.from(row.querySelectorAll('span, div')).find(
              (el) => el.children.length === 0 && /^-?[0-9]+\.[0-9]{2}$/.test((el.textContent || '').trim())
            );
          }

          if (targetPriceTextEl) {
            const sWrap = document.createElement('div');
            sWrap.className = 'gherbi-field-kbd-box';

            subInput = document.createElement('input');
            subInput.type = 'number';
            subInput.step = 'any';
            subInput.className = 'gherbi-line-subtotal-input';
            subInput.title = 'إجمالي الشريحة (اختصار: F12) — اكتب المبلغ واضغط Enter';

            const f12Tag = document.createElement('span');
            f12Tag.className = 'gherbi-mini-kbd-tag tag-f12';
            f12Tag.dir = 'ltr';
            f12Tag.textContent = 'F12';

            sWrap.appendChild(subInput);
            sWrap.appendChild(f12Tag);
            targetPriceTextEl.replaceWith(sWrap);
          }
        } else if (!subInput.parentElement.classList.contains('gherbi-field-kbd-box')) {
          const sWrap = document.createElement('div');
          sWrap.className = 'gherbi-field-kbd-box';
          subInput.parentNode.insertBefore(sWrap, subInput);
          sWrap.appendChild(subInput);
          const f12Tag = document.createElement('span');
          f12Tag.className = 'gherbi-mini-kbd-tag tag-f12';
          f12Tag.dir = 'ltr';
          f12Tag.textContent = 'F12';
          sWrap.appendChild(f12Tag);
        }

        if (subInput) {
          if (document.activeElement !== subInput && subInput.value !== lineSubtotal.toFixed(2)) {
            subInput.value = lineSubtotal.toFixed(2);
          }
          if (!subInput.dataset.v12SubBound) {
            subInput.dataset.v12SubBound = '1';
            subInput.addEventListener('click', (e) => {
              e.stopPropagation();
              subInput.select();
            });
            subInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.applyLineSubtotalChangeToRow(idx, subInput.value, e.shiftKey);
                subInput.blur();
                window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
              }
            });
            subInput.addEventListener('change', () => {
              const val = parseFloat(subInput.value);
              if (Number.isFinite(val) && Math.abs(val - lineSubtotal) > 0.01) {
                this.applyLineSubtotalChangeToRow(idx, val, false);
              }
            });
          }
        }

        if (row.dataset.v12Sig === rowSignature && row.querySelector('.gherbi-v11-row-tools')) {
          return;
        }
        row.dataset.v12Sig = rowSignature;

        if (rightInfoCol) {
          Array.from(rightInfoCol.querySelectorAll('button, .gherbi-v8-pack-bar')).forEach((oldEl) => {
            if (!oldEl.closest('.gherbi-v11-row-tools')) {
              oldEl.style.display = 'none';
            }
          });
        }

        let toolsBar = row.querySelector('.gherbi-v11-row-tools');
        if (!toolsBar && rightInfoCol) {
          toolsBar = document.createElement('div');
          toolsBar.className = 'gherbi-v11-row-tools';
          rightInfoCol.appendChild(toolsBar);
        }
        if (!toolsBar) return;

        const cfg = window.GherbiV8PackEngine
          ? window.GherbiV8PackEngine.resolvePackConfig(prod, item)
          : { isConfigured: false, packQty: 6, packUnitName: 'باكي', totalPackPriceDzd: unitPrice * 6, savingsPerPack: 0 };

        const isFractional = Math.abs(qty - Math.round(qty)) > 0.001;
        const isDiscountedUnit = !isFractional && !item._isCartonPackMode && Math.abs(unitPrice - baseRetailPrice) > 0.01;

        let htmlParts = [];

        if (item._isCartonPackMode) {
          const pCount = Number(item._packsCount || 1);
          const uLabel = cfg.isConfigured ? cfg.packUnitName : 'باكي (×6)';
          htmlParts.push(`
            <button type="button" onclick="GherbiV8PackEngine.revertRowToSingleUnit(${idx})"
              class="gherbi-v8-pack-toggle-btn is-pack-mode" title="اختصار التبديل: Alt+K">
              <span>📦 ${pCount} ${uLabel} (${qty} قطع = ${lineSubtotal.toFixed(0)} د.ج)</span>
              <span class="underline text-[9.5px] mr-1">⇄ بالحبة</span>
            </button>
            <button type="button" onclick="GherbiV8PackEngine.stepPacksOnRow(${idx}, 1)" class="gherbi-v8-pack-step-btn">+ ${uLabel}</button>
            <button type="button" onclick="GherbiV8PackEngine.stepPacksOnRow(${idx}, -1)" class="gherbi-v8-pack-step-btn">-</button>
          `);
        } else {
          const packBtnLabel = cfg.isConfigured
            ? `📦 ${cfg.packUnitName} (${cfg.packQty} قطع = ${cfg.totalPackPriceDzd.toFixed(0)} د.ج)`
            : `📦 باكي ×6 (${cfg.totalPackPriceDzd.toFixed(0)} د.ج)`;
          htmlParts.push(`
            <button type="button" onclick="GherbiV8PackEngine.applyPackModeToRow(${idx}, 1)"
              class="gherbi-v8-pack-toggle-btn is-unit-mode" title="تحويل إلى الكرتونة/الباكي (اختصار: Alt+K)">
              <span>${packBtnLabel}</span>
            </button>
          `);
        }

        if (isFractional) {
          const grams = Math.round(qty * 1000);
          htmlParts.push(`
            <button type="button" onclick="GherbiV9Engine.convertRowBetweenFractionalQtyAndPriceDiscount(${idx})"
              class="gherbi-v11-mode-convert-pill" title="اختصار التبديل المباشر: Alt+T">
              <span>⚖️ كمية جزئية (${this.formatCleanQtyString(qty)} = ${grams}غ)</span>
              <span class="underline">⇄ اجعلها تخفيض سعر (كمية 1) [Alt+T]</span>
            </button>
          `);
        } else if (isDiscountedUnit) {
          const diffDzd = Number((unitPrice - baseRetailPrice).toFixed(2));
          const fracEquiv = baseRetailPrice > 0 ? Number((lineSubtotal / baseRetailPrice).toFixed(2)) : 1;
          const gramsEquiv = Math.round(fracEquiv * 1000);
          htmlParts.push(`
            <button type="button" onclick="GherbiV9Engine.convertRowBetweenFractionalQtyAndPriceDiscount(${idx})"
              class="gherbi-v11-mode-convert-pill" title="اختصار التبديل المباشر: Alt+T">
              <span>🏷️ سعر معدل (${diffDzd > 0 ? '+' + diffDzd : diffDzd} د.ج)</span>
              <span class="underline">⇄ اجعلها كمية جزئية (${fracEquiv} = ${gramsEquiv}غ) [Alt+T]</span>
            </button>
          `);
        }

        if (remainingStock !== null && remainingStock < 0 && availableStock > 0) {
          htmlParts.push(`
            <button type="button" onclick="GherbiV9Engine.adjustPackToAvailableStock(${idx}, ${availableStock})"
              class="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] shadow-sm">
              ⚠️ بيع المتوفر فقط (${availableStock} قطعة)
            </button>
          `);
        }

        toolsBar.innerHTML = htmlParts.join('');
      });
    },

    adjustPackToAvailableStock(idx, availableStock) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item || availableStock <= 0) return;

      item._editedFromSubtotalBox = false;
      delete item._manualLineSubtotal;
      item.quantity = Number(availableStock);
      item.subtotal = Number((availableStock * Number(item.price || 0)).toFixed(2));
      window.App.recalcAndRenderCart?.();
    },

    // ========================================================================
    // 6. سجل ورادار صاحب المحل في صفحة الإحصائيات
    // ========================================================================
    getRadarLogs() {
      try {
        const raw = localStorage.getItem(RADAR_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (_) {
        return [];
      }
    },

    saveRadarLogs(list) {
      localStorage.setItem(RADAR_STORAGE_KEY, JSON.stringify((list || []).slice(0, 400)));
    },

    recordFractionalQuantityEvent(item, prod, oldQty, newQty, enteredTotalDzd) {
      const unitPrice = Number(item?.price || prod?.selling_price || 0);
      const costPrice = Number(prod?.cost_price ?? item?.cost_price ?? 0);
      const currentStock = Number(prod?.total_stock ?? prod?.stock ?? 0);
      const remainingStock = Number((currentStock - Math.abs(newQty)).toFixed(2));
      const netProfitOnLine = costPrice > 0 ? Number(((unitPrice - costPrice) * Math.abs(newQty)).toFixed(2)) : 0;

      const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value;
      const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;
      const seller = document.getElementById('currentUserName')?.textContent?.trim() || window.AppState?.currentUser?.name || 'المدير العام';
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const entry = {
        id: 'rad_qty_' + Date.now(),
        timestamp: new Date().toISOString(),
        dateFormatted: nowStr,
        seller,
        customerName: cust ? cust.name : 'زبون عابر',
        productId: prod?.id || item?.product_id || null,
        productName: item?.name || prod?.name || 'سلعة',
        saleMode: `⚖️ بيع بالمبلغ (الكمية: ${oldQty} ⬅ ${newQty})`,
        editSource: 'تعديل إجمالي الشريحة (F12)',
        quantity: Math.abs(newQty),
        stockBefore: currentStock,
        stockAfter: remainingStock,
        costPrice,
        originalUnitPrice: unitPrice,
        newUnitPrice: unitPrice,
        originalLineTotal: Number((oldQty * unitPrice).toFixed(2)),
        newLineTotal: Number(enteredTotalDzd.toFixed(2)),
        unitPriceDiff: 0,
        profitImpactDzd: 0,
        netProfitOnLine,
        category: 'fractional_qty'
      };

      const logs = this.getRadarLogs();
      const existingIdx = logs.findIndex(
        (l) => l.productName === entry.productName && String(l.dateFormatted).slice(0, 15) === nowStr.slice(0, 15)
      );
      if (existingIdx !== -1) logs[existingIdx] = entry;
      else logs.unshift(entry);
      this.saveRadarLogs(logs);
    },

    recordPriceModificationEvent(item, prod, oldUnitPrice, newUnitPrice, editSource = 'تعديل السعر الأوسط') {
      const costPrice = Number(prod?.cost_price ?? item?.cost_price ?? 0);
      const officialRetailPrice = Number(prod?.selling_price ?? prod?.price ?? item?._savedUnitPrice ?? oldUnitPrice ?? 0);
      const refOriginalPrice = officialRetailPrice > 0 ? officialRetailPrice : Number(oldUnitPrice || 0);
      const qty = Math.abs(Number(item?.quantity || 1));

      if (Math.abs(newUnitPrice - refOriginalPrice) < 0.01 && Math.abs(newUnitPrice - oldUnitPrice) < 0.01) {
        return;
      }

      const currentStock = Number(prod?.total_stock ?? prod?.stock ?? 0);
      const remainingStock = Number((currentStock - qty).toFixed(2));
      const newLineTotal = Number((item?.subtotal !== undefined ? item.subtotal : (qty * newUnitPrice)).toFixed(2));
      const originalLineTotal = Number((qty * refOriginalPrice).toFixed(2));

      const profitImpactDzd = Number((newLineTotal - originalLineTotal).toFixed(2));
      const netProfitOnLine = costPrice > 0 ? Number((newLineTotal - (qty * costPrice)).toFixed(2)) : 0;

      let category = 'discount';
      if (costPrice > 0 && newUnitPrice < costPrice - 0.01) category = 'below_cost';
      else if (costPrice > 0 && Math.abs(newUnitPrice - costPrice) <= 0.01) category = 'at_cost';
      else if (newUnitPrice > refOriginalPrice + 0.01) category = 'increase';

      const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value;
      const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;
      const seller = document.getElementById('currentUserName')?.textContent?.trim() || window.AppState?.currentUser?.name || 'المدير العام';
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const entry = {
        id: 'rad_' + Date.now(),
        timestamp: new Date().toISOString(),
        dateFormatted: nowStr,
        seller,
        customerName: cust ? cust.name : 'زبون عابر',
        productId: prod?.id || item?.product_id || null,
        productName: item?.name || prod?.name || 'سلعة',
        saleMode: item?._isCartonPackMode ? `📦 ${item._packUnitLabel || 'كرتونة'} (×${item._packQtyFactor || qty})` : '🏷️ بالحبة',
        editSource,
        quantity: qty,
        stockBefore: currentStock,
        stockAfter: remainingStock,
        costPrice,
        originalUnitPrice: refOriginalPrice,
        newUnitPrice: Number(newUnitPrice.toFixed(2)),
        originalLineTotal,
        newLineTotal,
        unitPriceDiff: Number((newUnitPrice - refOriginalPrice).toFixed(2)),
        profitImpactDzd,
        netProfitOnLine,
        category
      };

      const logs = this.getRadarLogs();
      const existingIdx = logs.findIndex(
        (l) => l.productName === entry.productName && String(l.dateFormatted).slice(0, 15) === nowStr.slice(0, 15)
      );
      if (existingIdx !== -1) logs[existingIdx] = entry;
      else logs.unshift(entry);
      this.saveRadarLogs(logs);
    },

    hookAnalyticsViewForOwnerRadar() {
      const origRenderAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (origRenderAnalytics && !window.App._v12OwnerRadarHooked) {
        window.App.renderAnalyticsView = async function (...args) {
          const res = await origRenderAnalytics(...args);
          V9Engine.renderOwnerPriceRadarCard(true);
          return res;
        };
        window.App._v12OwnerRadarHooked = true;
      }
    },

    ensureOwnerRadarRenderedInAnalytics() {
      const analyticsSec = document.getElementById('view-analytics');
      if (!analyticsSec || !analyticsSec.classList.contains('active')) return;
      if (!document.getElementById('v9OwnerPriceSurveillanceRadar')) {
        this.renderOwnerPriceRadarCard(false);
      }
    },

    setRadarFilter(filterKey) {
      this.activeRadarFilter = filterKey;
      this.renderOwnerPriceRadarCard(true);
    },

    clearRadarLogs() {
      localStorage.removeItem(RADAR_STORAGE_KEY);
      localStorage.removeItem('gherbi_cost_price_alerts');
      this.renderOwnerPriceRadarCard(true);
      if (window.showToast) window.showToast('🗑️ تم تصفير سجل رقابة الأسعار والكميات بنجاح', 'info');
    },

    renderOwnerPriceRadarCard(forceRebuild = false) {
      const root = document.getElementById('analytics-view-root') || document.getElementById('view-analytics');
      if (!root) return;

      document.getElementById('ownerPriceViolationReportCard')?.remove();

      let radarEl = document.getElementById('v9OwnerPriceSurveillanceRadar');
      if (radarEl && !forceRebuild) return;

      if (!radarEl) {
        radarEl = document.createElement('div');
        radarEl.id = 'v9OwnerPriceSurveillanceRadar';
        radarEl.className = 'v9-owner-radar-card space-y-4 text-xs';
        const loyaltyCard = document.getElementById('ownerLoyaltyPointsAuditCard');
        if (loyaltyCard && loyaltyCard.parentNode === root) {
          root.insertBefore(radarEl, loyaltyCard);
        } else {
          root.appendChild(radarEl);
        }
      }

      const allLogs = this.getRadarLogs();
      const belowOrAtCostLogs = allLogs.filter((l) => l.category === 'below_cost' || l.category === 'at_cost');
      const discountLogs = allLogs.filter((l) => l.category === 'discount');
      const fractionalLogs = allLogs.filter((l) => l.category === 'fractional_qty');
      const increaseLogs = allLogs.filter((l) => l.category === 'increase');

      const totalDiscountGivenDzd = allLogs
        .filter((l) => Number(l.profitImpactDzd || 0) < 0)
        .reduce((s, l) => s + Math.abs(Number(l.profitImpactDzd || 0)), 0);

      const totalExtraGainedDzd = allLogs
        .filter((l) => Number(l.profitImpactDzd || 0) > 0)
        .reduce((s, l) => s + Number(l.profitImpactDzd || 0), 0);

      const netProfitImpact = Number((totalExtraGainedDzd - totalDiscountGivenDzd).toFixed(2));

      const filtered = allLogs.filter((l) => {
        if (this.activeRadarFilter === 'danger') return l.category === 'below_cost' || l.category === 'at_cost';
        if (this.activeRadarFilter === 'discount') return l.category === 'discount';
        if (this.activeRadarFilter === 'fractional') return l.category === 'fractional_qty';
        if (this.activeRadarFilter === 'increase') return l.category === 'increase';
        if (this.activeRadarFilter === 'voided_line') return l.category === 'voided_line';
        return true;
      });

      radarEl.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center text-xl font-black">🛡️</div>
            <div>
              <h3 class="text-sm font-black text-rose-600 dark:text-rose-400">
                رادار رقابة صاحب المحل الشامل: تعديلات الإجمالي (F12)، السعر الأوسط (Alt+P)، والكميات (${allLogs.length})
              </h3>
              <p class="text-[11px] text-slate-500 font-bold">
                يوثق لصاحب المحل كل عملية بيع بالمبلغ (كمية جزئية) أو تعديل في سعر الوحدة أو الكرتونة مع الرصيد المتبقي في السطوك
              </p>
            </div>
          </div>

          <button type="button" onclick="GherbiV9Engine.clearRadarLogs()"
            class="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 hover:text-white font-black text-xs transition">
            🗑️ تصفير السجل الرقابي
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <div class="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">⚖️ عمليات البيع بالمبلغ (كمية جزئية)</div>
            <div class="text-xl font-mono font-black text-emerald-600 mt-0.5">${fractionalLogs.length} عملية</div>
            <div class="text-[10px] text-emerald-600/80 font-bold">تعديل الكمية تلقائياً مع ثبات السعر</div>
          </div>

          <div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30">
            <div class="text-[11px] text-rose-700 dark:text-rose-300 font-bold">🚨 بيع بالتكلفة أو بخسارة في السطوك</div>
            <div class="text-xl font-mono font-black text-rose-600 mt-0.5">${belowOrAtCostLogs.length} حالات</div>
            <div class="text-[10px] text-rose-500 font-bold">تعديلات سعر نزلت لتكلفة الشراء أو تحتها</div>
          </div>

          <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div class="text-[11px] text-amber-800 dark:text-amber-300 font-bold">📉 إجمالي التخفيضات السعرية الممنوحة</div>
            <div class="text-xl font-mono font-black text-amber-600 mt-0.5">-${totalDiscountGivenDzd.toFixed(2)} د.ج</div>
            <div class="text-[10px] text-amber-600/80 font-bold">في (${discountLogs.length + belowOrAtCostLogs.length}) عملية تخفيض سعر</div>
          </div>

          <div class="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
            <div class="text-[11px] font-bold text-slate-600 dark:text-slate-300">📊 صافي أثر تعديلات السعر على الربح</div>
            <div class="text-xl font-mono font-black ${netProfitImpact >= 0 ? 'text-emerald-600' : 'text-indigo-600 dark:text-indigo-400'} mt-0.5">
              ${netProfitImpact >= 0 ? '+' : ''}${netProfitImpact.toFixed(2)} د.ج
            </div>
            <div class="text-[10px] text-slate-500 font-bold">زيادات السعر: +${totalExtraGainedDzd.toFixed(2)} د.ج (${increaseLogs.length})</div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('all')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'all' ? 'active' : ''}">
            الكل (${allLogs.length})
          </button>
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('fractional')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'fractional' ? 'active' : ''}">
            ⚖️ كمية جزئية بالمبلغ (${fractionalLogs.length})
          </button>
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('danger')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'danger' ? 'active' : ''}">
            🚨 بالتكلفة أو بخسارة (${belowOrAtCostLogs.length})
          </button>
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('discount')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'discount' ? 'active' : ''}">
            📉 تخفيض السعر (${discountLogs.length})
          </button>
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('increase')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'increase' ? 'active' : ''}">
            📈 زيادة السعر (${increaseLogs.length})
          </button>
        </div>

        ${
          filtered.length === 0
            ? '<div class="py-8 text-center text-emerald-600 font-black text-xs bg-emerald-500/5 rounded-2xl border border-emerald-500/20">✅ لا توجد عمليات مسجلة في هذا التصنيف حالياً</div>'
            : `<div class="overflow-x-auto max-h-80 rounded-xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                      <th class="py-2.5 px-3">التوقيت</th>
                      <th class="py-2.5 px-2">البائع / الزبون</th>
                      <th class="py-2.5 px-3">الصنف وطريقة التعديل</th>
                      <th class="py-2.5 px-2 text-center">الكمية والسطوك</th>
                      <th class="py-2.5 px-2 text-center">سعر الشراء</th>
                      <th class="py-2.5 px-2 text-center">سعر الوحدة</th>
                      <th class="py-2.5 px-2 text-center">إجمالي السطر</th>
                      <th class="py-2.5 px-3 text-center">صافي ربح السطر</th>
                      <th class="py-2.5 px-2 text-center">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    ${filtered.map((l) => {
                      const netProfit = Number(l.netProfitOnLine || 0);
                      let statusBadge = '';
                      let rowBg = '';

                      if (l.category === 'voided_line') {
                        rowBg = 'bg-rose-500/5 hover:bg-rose-500/10';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-rose-600/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px] font-black">🗑️ محذوف بعد المسح</span>';
                      } else if (l.category === 'fractional_qty') {
                        rowBg = 'hover:bg-emerald-500/5';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">⚖️ كمية بالمبلغ</span>';
                      } else if (l.category === 'below_cost') {
                        rowBg = 'bg-rose-500/10';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">🚨 بيع بخسارة!</span>';
                      } else if (l.category === 'at_cost') {
                        rowBg = 'bg-amber-500/10';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">⚠️ بسعر التكلفة</span>';
                      } else if (l.category === 'increase') {
                        rowBg = 'hover:bg-emerald-500/5';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">📈 رفع السعر</span>';
                      } else {
                        rowBg = 'hover:bg-amber-500/5';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black">📉 تخفيض سعر</span>';
                      }

                      return `
                        <tr class="${rowBg}">
                          <td class="py-2 px-3 font-mono text-[11px] whitespace-nowrap">${l.dateFormatted || ''}</td>
                          <td class="py-2 px-2">
                            <div>${l.seller || 'البائع'}</div>
                            <div class="text-[10px] text-slate-400">${l.customerName || 'زبون عابر'}</div>
                          </td>
                          <td class="py-2 px-3">
                            <div class="font-black text-slate-900 dark:text-white">${l.productName}</div>
                            <div class="text-[10px] text-indigo-600 dark:text-indigo-400">${l.saleMode || ''} (${l.editSource || ''})</div>
                          </td>
                          <td class="py-2 px-2 text-center font-mono">
                            <div class="font-black text-emerald-600">-${l.quantity} وحدة</div>
                            <div class="text-[10px] text-slate-400">بقي بالسطوك: ${l.stockAfter ?? '—'}</div>
                          </td>
                          <td class="py-2 px-2 text-center font-mono text-slate-500">${Number(l.costPrice || 0).toFixed(2)} د.ج</td>
                          <td class="py-2 px-2 text-center font-mono">
                            ${
                              l.category === 'fractional_qty'
                                ? `<strong class="text-slate-700 dark:text-slate-200">${Number(l.newUnitPrice || 0).toFixed(2)} د.ج (ثابت)</strong>`
                                : `<span class="line-through text-slate-400 text-[10.5px]">${Number(l.originalUnitPrice || 0).toFixed(2)}</span> ⬅ <strong>${Number(l.newUnitPrice || 0).toFixed(2)} د.ج</strong>`
                            }
                          </td>
                          <td class="py-2 px-2 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                            ${Number(l.newLineTotal || 0).toFixed(2)} د.ج
                          </td>
                          <td class="py-2 px-3 text-center font-mono">
                            <div class="font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                              ${netProfit >= 0 ? '+' + netProfit.toFixed(2) : netProfit.toFixed(2)} د.ج
                            </div>
                          </td>
                          <td class="py-2 px-2 text-center whitespace-nowrap">${statusBadge}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>`
        }
      `;
    }
  };

  window.GherbiV9Engine = V9Engine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V9Engine.init());
  } else {
    V9Engine.init();
  }
})();


/* ==================== [V13 STAGE 4: QUICK INVENTORY & Z-REPORT RADAR] ==================== */
(function initV13InventoryAndZReport() {
  const V13Stage4 = {
    editingProdId: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.buildQuickInventoryEditModal();
        this.injectQuickEditButtonsInInventoryTable();
        this.enhanceCloseShiftModalWithOwnerRadar();
        console.log('🚀 [V13 Stage 4 Ready]: التعديل السريع للمخزون + تقرير Z-Report الرقابي المدمج جاهز 100%.');
      }, 240);
    },

    // ========================================================================
    // 1. نافذة وزر التعديل السريع للسعر والكرتونة والكمية من جدول المخزون مباشرة
    // ========================================================================
    buildQuickInventoryEditModal() {
      if (document.getElementById('v13QuickInventoryModal')) return;

      const modal = document.createElement('div');
      modal.id = 'v13QuickInventoryModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content w-full max-w-lg p-0 overflow-hidden rounded-2xl border-2 border-emerald-500/60 shadow-2xl bg-white dark:bg-slate-900 text-xs">
          <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">⚡</span>
              <div>
                <h3 id="v13QuickInvTitle" class="text-sm font-black text-emerald-400">تعديل سريع للسعر والكرتونة والسطوك</h3>
                <p class="text-[10.5px] text-slate-400">عدّل الأسعار وإعدادات الباكي/الكرتونة والكمية واضغط Enter للحفظ الفوري</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('v13QuickInventoryModal')" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black">✕</button>
          </div>

          <div class="p-5 space-y-4">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-500 mb-1">سعر الشراء (التكلفة د.ج)</label>
                <input id="v13InvCostInp" type="number" step="any"
                  onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold text-center">
              </div>

              <div>
                <label class="block font-black text-blue-600 dark:text-blue-400 mb-1">🏷️ سعر بيع الحبة (التجزئة) *</label>
                <input id="v13InvSellInp" type="number" step="any"
                  onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                  class="w-full px-3 py-2 rounded-xl border-2 border-blue-500 font-mono font-black text-sm text-center text-blue-600">
              </div>

              <div>
                <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">📦 السطوك المتوفر حالياً</label>
                <input id="v13InvStockInp" type="number" step="any"
                  onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-sm text-center text-emerald-600">
              </div>
            </div>

            <!-- إعدادات الكرتونة / الباكي -->
            <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2.5">
              <div class="font-black text-indigo-700 dark:text-indigo-300">📦 إعدادات البيع بالباكي / الكرتونة / العلبة:</div>
              <div class="grid grid-cols-3 gap-2.5">
                <div>
                  <label class="block text-[10.5px] font-bold mb-1">اسم العبوة</label>
                  <input id="v13InvPackUnitInp" type="text" placeholder="كرتونة / باكي"
                    onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                    class="w-full px-2.5 py-1.5 rounded-xl border font-bold text-center">
                </div>
                <div>
                  <label class="block text-[10.5px] font-black text-indigo-600 mb-1">🔢 عدد الحبات في الكرتونة</label>
                  <input id="v13InvPackQtyInp" type="number" step="1" min="0" placeholder="مثال: 8 أو 12"
                    onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                    class="w-full px-2.5 py-1.5 rounded-xl border-2 border-indigo-500/60 font-mono font-black text-center">
                </div>
                <div>
                  <label class="block text-[10.5px] font-black text-amber-600 mb-1">💰 سعر الكرتونة الكامل (د.ج)</label>
                  <input id="v13InvPackPriceInp" type="number" step="any" min="0" placeholder="مثال: 950"
                    onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                    class="w-full px-2.5 py-1.5 rounded-xl border-2 border-amber-500/60 font-mono font-black text-center">
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('v13QuickInventoryModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 font-bold">إلغاء (Esc)</button>
              <button type="button" onclick="GherbiV13Stage4.saveQuickInventoryEdit()"
                class="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-600/25">
                ✔ حفظ وتطبيق فوراً (Enter)
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    openQuickInventoryModal(productId) {
      this.buildQuickInventoryEditModal();
      const pid = Number(productId);
      const prod = (window.AppState?.products || []).find((p) => Number(p.id) === pid);
      if (!prod) return;

      this.editingProdId = pid;
      const cfg = window.GherbiV8PackEngine
        ? window.GherbiV8PackEngine.resolvePackConfig(prod)
        : { isConfigured: false, packQty: 0, packUnitName: 'كرتونة', totalPackPriceDzd: 0 };

      document.getElementById('v13QuickInvTitle').textContent = `⚡ تعديل سريع: ${prod.name}`;
      document.getElementById('v13InvCostInp').value = Number(prod.cost_price ?? 0);
      document.getElementById('v13InvSellInp').value = Number(prod.selling_price ?? prod.price ?? 0);
      document.getElementById('v13InvStockInp').value = Number(prod.total_stock ?? prod.stock ?? 0);
      document.getElementById('v13InvPackUnitInp').value = cfg.packUnitName || 'كرتونة';
      document.getElementById('v13InvPackQtyInp').value = cfg.isConfigured ? cfg.packQty : '';
      document.getElementById('v13InvPackPriceInp').value = cfg.isConfigured ? cfg.totalPackPriceDzd : '';

      window.App.openModal('v13QuickInventoryModal');
      setTimeout(() => {
        const sellInp = document.getElementById('v13InvSellInp');
        if (sellInp) {
          sellInp.focus();
          sellInp.select();
        }
      }, 50);
    },

    async saveQuickInventoryEdit() {
      const pid = Number(this.editingProdId);
      const prod = (window.AppState?.products || []).find((p) => Number(p.id) === pid);
      if (!prod) return;

      const newCost = Math.max(0, parseFloat(document.getElementById('v13InvCostInp')?.value || '0') || 0);
      const newSell = Math.max(0, parseFloat(document.getElementById('v13InvSellInp')?.value || '0') || 0);
      const newStock = parseFloat(document.getElementById('v13InvStockInp')?.value || '0') || 0;
      const packUnit = document.getElementById('v13InvPackUnitInp')?.value?.trim() || 'كرتونة';
      const packQty = Math.max(0, parseFloat(document.getElementById('v13InvPackQtyInp')?.value || '0') || 0);
      const packPrice = Math.max(0, parseFloat(document.getElementById('v13InvPackPriceInp')?.value || '0') || 0);

      // 1. حفظ إعدادات الكرتونة
      if (window.GherbiV8PackEngine) {
        window.GherbiV8PackEngine.savePackConfig(pid, prod.name, { packPrice, packQty, packUnit });
      }

      // 2. تحديث الكائن الحي
      prod.cost_price = newCost;
      prod.selling_price = newSell;
      prod.price = newSell;
      prod.stock = newStock;
      prod.total_stock = newStock;
      prod.wholesale_price = packPrice;
      prod.wholesale_qty = packQty;
      prod.wholesale_unit = packUnit;

      // 3. تحديث الدفعة والمنتج في SQLite
      try {
        await window.api?.updateProduct?.(pid, {
          ...prod,
          cost_price: newCost,
          selling_price: newSell,
          wholesale_price: packPrice,
          wholesale_qty: packQty,
          wholesale_unit: packUnit
        });

        const fullProd = await window.api?.getProductFull?.(pid);
        const batches = fullProd?.batches || prod.batches || [];
        if (batches.length > 0) {
          const latestBatch = batches[0];
          await window.api?.updateBatch?.(latestBatch.id, {
            ...latestBatch,
            stock: newStock,
            cost_price: newCost,
            selling_price: newSell,
            wholesale_price: packPrice > 0 ? packPrice : null
          });
        } else {
          await window.api?.addBatch?.(pid, {
            stock: newStock,
            cost_price: newCost,
            selling_price: newSell,
            wholesale_price: packPrice > 0 ? packPrice : null
          });
        }
      } catch (_) {}

      window.App.closeModal('v13QuickInventoryModal');
      window.App.renderInventoryView?.();
      window.App.renderPosView?.();
      if (window.showToast) {
        window.showToast(`✅ تم تحديث "${prod.name}" فوراً (الحبة: ${newSell} د.ج | الكرتونة: ${packQty || 6} قطع بـ ${packPrice || (newSell * 6)} د.ج)`, 'success');
      }
    },

    injectQuickEditButtonsInInventoryTable() {
      const scanInventoryRows = () => {
        const invSec = document.getElementById('view-inventory');
        if (!invSec || !invSec.classList.contains('active')) return;

        const editBtns = Array.from(invSec.querySelectorAll('button[onclick*="openProductModal"]'));
        editBtns.forEach((btn) => {
          const onclickStr = btn.getAttribute('onclick') || '';
          const match = onclickStr.match(/openProductModal\(\s*(\d+)\s*\)/);
          if (!match || !match[1]) return;
          const pid = Number(match[1]);
          const parentCell = btn.parentElement;
          if (!parentCell || parentCell.querySelector('.v13-inv-quick-btn')) return;

          const quickBtn = document.createElement('button');
          quickBtn.type = 'button';
          quickBtn.className = 'v13-inv-quick-btn';
          quickBtn.title = 'تعديل سريع لسعر الحبة وسعر الكرتونة والكمية بضغطة واحدة';
          quickBtn.innerHTML = '<span>⚡ سريع</span>';
          quickBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openQuickInventoryModal(pid);
          };
          parentCell.insertBefore(quickBtn, btn);
        });
      };

      setInterval(scanInventoryRows, 600);
    },

    // ========================================================================
    // 2. دمج تقرير إغلاق المناوبة (Z-Report) مع ملخص رادار المدير في (#closeShiftModal)
    // ========================================================================
    enhanceCloseShiftModalWithOwnerRadar() {
      const injectRadarSummaryIntoCloseShift = () => {
        const modal = document.getElementById('closeShiftModal');
        if (!modal || !modal.classList.contains('active')) return;

        const bodyContainer = modal.querySelector('.space-y-3.text-xs');
        if (!bodyContainer) return;

        let radarBox = document.getElementById('v13ZReportRadarSummaryBox');
        if (!radarBox) {
          radarBox = document.createElement('div');
          radarBox.id = 'v13ZReportRadarSummaryBox';
          radarBox.className = 'p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/35 space-y-2 text-xs';
          bodyContainer.appendChild(radarBox);
        }

        const radarLogs = window.GherbiV9Engine ? window.GherbiV9Engine.getRadarLogs() : [];
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayLogs = radarLogs.filter((l) => String(l.timestamp || l.dateFormatted || '').startsWith(todayStr));

        const dangerCount = todayLogs.filter((l) => l.category === 'below_cost' || l.category === 'at_cost').length;
        const fracCount = todayLogs.filter((l) => l.category === 'fractional_qty').length;
        const discountSum = todayLogs
          .filter((l) => Number(l.profitImpactDzd || 0) < 0)
          .reduce((s, l) => s + Math.abs(Number(l.profitImpactDzd || 0)), 0);

        const sig = `${todayLogs.length}_${dangerCount}_${fracCount}_${discountSum}`;
        if (radarBox.dataset.sig === sig) return;
        radarBox.dataset.sig = sig;

        radarBox.innerHTML = `
          <div class="flex items-center justify-between border-b border-rose-500/25 pb-1.5">
            <span class="font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <span>🛡️</span>
              <span>ملخص رادار الرقابة وتعديلات الأسعار خلال وردية اليوم:</span>
            </span>
            <button type="button" onclick="GherbiV13Stage4.printExecutiveZReportWithRadar()"
              class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-[10.5px]">
              🖨️ طباعة Z-Report الرقابي (80mm)
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center font-bold pt-1">
            <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-500/20">
              <div class="text-[10px] text-slate-500">بيع بالتكلفة/خسارة</div>
              <div class="font-mono font-black text-sm text-rose-600">${dangerCount} عمليات</div>
            </div>
            <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20">
              <div class="text-[10px] text-slate-500">تخفيضات يدوية</div>
              <div class="font-mono font-black text-sm text-amber-600">-${discountSum.toFixed(2)} د.ج</div>
            </div>
            <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/20">
              <div class="text-[10px] text-slate-500">بيع بالمبلغ (0.8)</div>
              <div class="font-mono font-black text-sm text-emerald-600">${fracCount} عمليات</div>
            </div>
          </div>
        `;
      };

      setInterval(injectRadarSummaryIntoCloseShift, 500);
    },

    printExecutiveZReportWithRadar() {
      const expectedTxt = document.getElementById('closeShiftExpectedText')?.textContent || '0.00 د.ج';
      const countedVal = parseFloat(document.getElementById('closeShiftCountedInput')?.value || '0') || 0;
      const diffTxt = document.getElementById('caisseDiffPreview')?.textContent || '0.00 د.ج';

      const radarLogs = window.GherbiV9Engine ? window.GherbiV9Engine.getRadarLogs() : [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayLogs = radarLogs.filter((l) => String(l.timestamp || l.dateFormatted || '').startsWith(todayStr));

      const dangerCount = todayLogs.filter((l) => l.category === 'below_cost' || l.category === 'at_cost').length;
      const fracCount = todayLogs.filter((l) => l.category === 'fractional_qty').length;
      const discountSum = todayLogs
        .filter((l) => Number(l.profitImpactDzd || 0) < 0)
        .reduce((s, l) => s + Math.abs(Number(l.profitImpactDzd || 0)), 0);

      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { width: 72mm; margin: 0 auto; padding: 4mm; font-family: 'Cairo', Tahoma, sans-serif; font-size: 12px; color: #000; }
    h2 { text-align: center; margin: 0 0 4px; font-size: 15px; }
    .sub { text-align: center; font-size: 11px; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; font-weight: bold; }
    .sec { border-top: 1.5px solid #000; margin-top: 8px; padding-top: 6px; font-weight: 900; }
  </style>
</head>
<body>
  <h2>تقرير إغلاق الوردية والرقابة (Z-Report)</h2>
  <div class="sub">التاريخ: ${new Date().toLocaleString('fr-DZ')}</div>
  <div class="row"><span>الرصيد الدفتري المتوقع:</span><span>${expectedTxt}</span></div>
  <div class="row"><span>المبلغ الفعلي المعدود:</span><span>${countedVal.toFixed(2)} د.ج</span></div>
  <div class="row"><span>الفارق (Écart de Caisse):</span><span>${diffTxt}</span></div>
  <div class="sec">🛡️ ملخص رادار رقابة الأسعار والكميات:</div>
  <div class="row"><span>إجمالي تعديلات اليوم:</span><span>${todayLogs.length} عملية</span></div>
  <div class="row"><span>بيع بالتكلفة أو بخسارة:</span><span>${dangerCount} حالات</span></div>
  <div class="row"><span>إجمالي التخفيضات اليدوية:</span><span>-${discountSum.toFixed(2)} د.ج</span></div>
  <div class="row"><span>عمليات البيع بالمبلغ (كمية جزئية):</span><span>${fracCount} عمليات</span></div>
</body>
</html>`;

      window.api?.printSilent?.({ html, silent: false });
    }
  };

  window.GherbiV13Stage4 = V13Stage4;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V13Stage4.init());
  } else {
    V13Stage4.init();
  }
})();

/* ==================== [V13 STAGE 4: QUICK INVENTORY & Z-REPORT RADAR] ==================== */
(function initV13InventoryAndZReport() {
  const V13Stage4 = {
    editingProdId: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.buildQuickInventoryEditModal();
        this.injectQuickEditButtonsInInventoryTable();
        this.enhanceCloseShiftModalWithOwnerRadar();
        console.log('🚀 [V13 Stage 4 Ready]: التعديل السريع للمخزون + تقرير Z-Report الرقابي المدمج جاهز 100%.');
      }, 240);
    },

    // ========================================================================
    // 1. نافذة وزر التعديل السريع للسعر والكرتونة والكمية من جدول المخزون مباشرة
    // ========================================================================
    buildQuickInventoryEditModal() {
      if (document.getElementById('v13QuickInventoryModal')) return;

      const modal = document.createElement('div');
      modal.id = 'v13QuickInventoryModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content w-full max-w-lg p-0 overflow-hidden rounded-2xl border-2 border-emerald-500/60 shadow-2xl bg-white dark:bg-slate-900 text-xs">
          <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xl">⚡</span>
              <div>
                <h3 id="v13QuickInvTitle" class="text-sm font-black text-emerald-400">تعديل سريع للسعر والكرتونة والسطوك</h3>
                <p class="text-[10.5px] text-slate-400">عدّل الأسعار وإعدادات الباكي/الكرتونة والكمية واضغط Enter للحفظ الفوري</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('v13QuickInventoryModal')" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black">✕</button>
          </div>

          <div class="p-5 space-y-4">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-500 mb-1">سعر الشراء (التكلفة د.ج)</label>
                <input id="v13InvCostInp" type="number" step="any"
                  onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold text-center">
              </div>

              <div>
                <label class="block font-black text-blue-600 dark:text-blue-400 mb-1">🏷️ سعر بيع الحبة (التجزئة) *</label>
                <input id="v13InvSellInp" type="number" step="any"
                  onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                  class="w-full px-3 py-2 rounded-xl border-2 border-blue-500 font-mono font-black text-sm text-center text-blue-600">
              </div>

              <div>
                <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">📦 السطوك المتوفر حالياً</label>
                <input id="v13InvStockInp" type="number" step="any"
                  onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-sm text-center text-emerald-600">
              </div>
            </div>

            <!-- إعدادات الكرتونة / الباكي -->
            <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2.5">
              <div class="font-black text-indigo-700 dark:text-indigo-300">📦 إعدادات البيع بالباكي / الكرتونة / العلبة:</div>
              <div class="grid grid-cols-3 gap-2.5">
                <div>
                  <label class="block text-[10.5px] font-bold mb-1">اسم العبوة</label>
                  <input id="v13InvPackUnitInp" type="text" placeholder="كرتونة / باكي"
                    onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                    class="w-full px-2.5 py-1.5 rounded-xl border font-bold text-center">
                </div>
                <div>
                  <label class="block text-[10.5px] font-black text-indigo-600 mb-1">🔢 عدد الحبات في الكرتونة</label>
                  <input id="v13InvPackQtyInp" type="number" step="1" min="0" placeholder="مثال: 8 أو 12"
                    onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                    class="w-full px-2.5 py-1.5 rounded-xl border-2 border-indigo-500/60 font-mono font-black text-center">
                </div>
                <div>
                  <label class="block text-[10.5px] font-black text-amber-600 mb-1">💰 سعر الكرتونة الكامل (د.ج)</label>
                  <input id="v13InvPackPriceInp" type="number" step="any" min="0" placeholder="مثال: 950"
                    onkeydown="if(event.key==='Enter') GherbiV13Stage4.saveQuickInventoryEdit()"
                    class="w-full px-2.5 py-1.5 rounded-xl border-2 border-amber-500/60 font-mono font-black text-center">
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('v13QuickInventoryModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 font-bold">إلغاء (Esc)</button>
              <button type="button" onclick="GherbiV13Stage4.saveQuickInventoryEdit()"
                class="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-600/25">
                ✔ حفظ وتطبيق فوراً (Enter)
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    openQuickInventoryModal(productId) {
      this.buildQuickInventoryEditModal();
      const pid = Number(productId);
      const prod = (window.AppState?.products || []).find((p) => Number(p.id) === pid);
      if (!prod) return;

      this.editingProdId = pid;
      const cfg = window.GherbiV8PackEngine
        ? window.GherbiV8PackEngine.resolvePackConfig(prod)
        : { isConfigured: false, packQty: 0, packUnitName: 'كرتونة', totalPackPriceDzd: 0 };

      document.getElementById('v13QuickInvTitle').textContent = `⚡ تعديل سريع: ${prod.name}`;
      document.getElementById('v13InvCostInp').value = Number(prod.cost_price ?? 0);
      document.getElementById('v13InvSellInp').value = Number(prod.selling_price ?? prod.price ?? 0);
      document.getElementById('v13InvStockInp').value = Number(prod.total_stock ?? prod.stock ?? 0);
      document.getElementById('v13InvPackUnitInp').value = cfg.packUnitName || 'كرتونة';
      document.getElementById('v13InvPackQtyInp').value = cfg.isConfigured ? cfg.packQty : '';
      document.getElementById('v13InvPackPriceInp').value = cfg.isConfigured ? cfg.totalPackPriceDzd : '';

      window.App.openModal('v13QuickInventoryModal');
      setTimeout(() => {
        const sellInp = document.getElementById('v13InvSellInp');
        if (sellInp) {
          sellInp.focus();
          sellInp.select();
        }
      }, 50);
    },

    async saveQuickInventoryEdit() {
      const pid = Number(this.editingProdId);
      const prod = (window.AppState?.products || []).find((p) => Number(p.id) === pid);
      if (!prod) return;

      const newCost = Math.max(0, parseFloat(document.getElementById('v13InvCostInp')?.value || '0') || 0);
      const newSell = Math.max(0, parseFloat(document.getElementById('v13InvSellInp')?.value || '0') || 0);
      const newStock = parseFloat(document.getElementById('v13InvStockInp')?.value || '0') || 0;
      const packUnit = document.getElementById('v13InvPackUnitInp')?.value?.trim() || 'كرتونة';
      const packQty = Math.max(0, parseFloat(document.getElementById('v13InvPackQtyInp')?.value || '0') || 0);
      const packPrice = Math.max(0, parseFloat(document.getElementById('v13InvPackPriceInp')?.value || '0') || 0);

      // 1. حفظ إعدادات الكرتونة
      if (window.GherbiV8PackEngine) {
        window.GherbiV8PackEngine.savePackConfig(pid, prod.name, { packPrice, packQty, packUnit });
      }

      // 2. تحديث الكائن الحي
      prod.cost_price = newCost;
      prod.selling_price = newSell;
      prod.price = newSell;
      prod.stock = newStock;
      prod.total_stock = newStock;
      prod.wholesale_price = packPrice;
      prod.wholesale_qty = packQty;
      prod.wholesale_unit = packUnit;

      // 3. تحديث الدفعة والمنتج في SQLite
      try {
        await window.api?.updateProduct?.(pid, {
          ...prod,
          cost_price: newCost,
          selling_price: newSell,
          wholesale_price: packPrice,
          wholesale_qty: packQty,
          wholesale_unit: packUnit
        });

        const fullProd = await window.api?.getProductFull?.(pid);
        const batches = fullProd?.batches || prod.batches || [];
        if (batches.length > 0) {
          const latestBatch = batches[0];
          await window.api?.updateBatch?.(latestBatch.id, {
            ...latestBatch,
            stock: newStock,
            cost_price: newCost,
            selling_price: newSell,
            wholesale_price: packPrice > 0 ? packPrice : null
          });
        } else {
          await window.api?.addBatch?.(pid, {
            stock: newStock,
            cost_price: newCost,
            selling_price: newSell,
            wholesale_price: packPrice > 0 ? packPrice : null
          });
        }
      } catch (_) {}

      window.App.closeModal('v13QuickInventoryModal');
      window.App.renderInventoryView?.();
      window.App.renderPosView?.();
      if (window.showToast) {
        window.showToast(`✅ تم تحديث "${prod.name}" فوراً (الحبة: ${newSell} د.ج | الكرتونة: ${packQty || 6} قطع بـ ${packPrice || (newSell * 6)} د.ج)`, 'success');
      }
    },

    injectQuickEditButtonsInInventoryTable() {
      const scanInventoryRows = () => {
        const invSec = document.getElementById('view-inventory');
        if (!invSec || !invSec.classList.contains('active')) return;

        const editBtns = Array.from(invSec.querySelectorAll('button[onclick*="openProductModal"]'));
        editBtns.forEach((btn) => {
          const onclickStr = btn.getAttribute('onclick') || '';
          const match = onclickStr.match(/openProductModal\(\s*(\d+)\s*\)/);
          if (!match || !match[1]) return;
          const pid = Number(match[1]);
          const parentCell = btn.parentElement;
          if (!parentCell || parentCell.querySelector('.v13-inv-quick-btn')) return;

          const quickBtn = document.createElement('button');
          quickBtn.type = 'button';
          quickBtn.className = 'v13-inv-quick-btn';
          quickBtn.title = 'تعديل سريع لسعر الحبة وسعر الكرتونة والكمية بضغطة واحدة';
          quickBtn.innerHTML = '<span>⚡ سريع</span>';
          quickBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openQuickInventoryModal(pid);
          };
          parentCell.insertBefore(quickBtn, btn);
        });
      };

      setInterval(scanInventoryRows, 600);
    },

    // ========================================================================
    // 2. دمج تقرير إغلاق المناوبة (Z-Report) مع ملخص رادار المدير في (#closeShiftModal)
    // ========================================================================
    enhanceCloseShiftModalWithOwnerRadar() {
      const injectRadarSummaryIntoCloseShift = () => {
        const modal = document.getElementById('closeShiftModal');
        if (!modal || !modal.classList.contains('active')) return;

        const bodyContainer = modal.querySelector('.space-y-3.text-xs');
        if (!bodyContainer) return;

        let radarBox = document.getElementById('v13ZReportRadarSummaryBox');
        if (!radarBox) {
          radarBox = document.createElement('div');
          radarBox.id = 'v13ZReportRadarSummaryBox';
          radarBox.className = 'p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/35 space-y-2 text-xs';
          bodyContainer.appendChild(radarBox);
        }

        const radarLogs = window.GherbiV9Engine ? window.GherbiV9Engine.getRadarLogs() : [];
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayLogs = radarLogs.filter((l) => String(l.timestamp || l.dateFormatted || '').startsWith(todayStr));

        const dangerCount = todayLogs.filter((l) => l.category === 'below_cost' || l.category === 'at_cost').length;
        const fracCount = todayLogs.filter((l) => l.category === 'fractional_qty').length;
        const discountSum = todayLogs
          .filter((l) => Number(l.profitImpactDzd || 0) < 0)
          .reduce((s, l) => s + Math.abs(Number(l.profitImpactDzd || 0)), 0);

        const sig = `${todayLogs.length}_${dangerCount}_${fracCount}_${discountSum}`;
        if (radarBox.dataset.sig === sig) return;
        radarBox.dataset.sig = sig;

        radarBox.innerHTML = `
          <div class="flex items-center justify-between border-b border-rose-500/25 pb-1.5">
            <span class="font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <span>🛡️</span>
              <span>ملخص رادار الرقابة وتعديلات الأسعار خلال وردية اليوم:</span>
            </span>
            <button type="button" onclick="GherbiV13Stage4.printExecutiveZReportWithRadar()"
              class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-[10.5px]">
              🖨️ طباعة Z-Report الرقابي (80mm)
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center font-bold pt-1">
            <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-500/20">
              <div class="text-[10px] text-slate-500">بيع بالتكلفة/خسارة</div>
              <div class="font-mono font-black text-sm text-rose-600">${dangerCount} عمليات</div>
            </div>
            <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20">
              <div class="text-[10px] text-slate-500">تخفيضات يدوية</div>
              <div class="font-mono font-black text-sm text-amber-600">-${discountSum.toFixed(2)} د.ج</div>
            </div>
            <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/20">
              <div class="text-[10px] text-slate-500">بيع بالمبلغ (0.8)</div>
              <div class="font-mono font-black text-sm text-emerald-600">${fracCount} عمليات</div>
            </div>
          </div>
        `;
      };

      setInterval(injectRadarSummaryIntoCloseShift, 500);
    },

    printExecutiveZReportWithRadar() {
      const expectedTxt = document.getElementById('closeShiftExpectedText')?.textContent || '0.00 د.ج';
      const countedVal = parseFloat(document.getElementById('closeShiftCountedInput')?.value || '0') || 0;
      const diffTxt = document.getElementById('caisseDiffPreview')?.textContent || '0.00 د.ج';

      const radarLogs = window.GherbiV9Engine ? window.GherbiV9Engine.getRadarLogs() : [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayLogs = radarLogs.filter((l) => String(l.timestamp || l.dateFormatted || '').startsWith(todayStr));

      const dangerCount = todayLogs.filter((l) => l.category === 'below_cost' || l.category === 'at_cost').length;
      const fracCount = todayLogs.filter((l) => l.category === 'fractional_qty').length;
      const discountSum = todayLogs
        .filter((l) => Number(l.profitImpactDzd || 0) < 0)
        .reduce((s, l) => s + Math.abs(Number(l.profitImpactDzd || 0)), 0);

      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { width: 72mm; margin: 0 auto; padding: 4mm; font-family: 'Cairo', Tahoma, sans-serif; font-size: 12px; color: #000; }
    h2 { text-align: center; margin: 0 0 4px; font-size: 15px; }
    .sub { text-align: center; font-size: 11px; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; font-weight: bold; }
    .sec { border-top: 1.5px solid #000; margin-top: 8px; padding-top: 6px; font-weight: 900; }
  </style>
</head>
<body>
  <h2>تقرير إغلاق الوردية والرقابة (Z-Report)</h2>
  <div class="sub">التاريخ: ${new Date().toLocaleString('fr-DZ')}</div>
  <div class="row"><span>الرصيد الدفتري المتوقع:</span><span>${expectedTxt}</span></div>
  <div class="row"><span>المبلغ الفعلي المعدود:</span><span>${countedVal.toFixed(2)} د.ج</span></div>
  <div class="row"><span>الفارق (Écart de Caisse):</span><span>${diffTxt}</span></div>
  <div class="sec">🛡️ ملخص رادار رقابة الأسعار والكميات:</div>
  <div class="row"><span>إجمالي تعديلات اليوم:</span><span>${todayLogs.length} عملية</span></div>
  <div class="row"><span>بيع بالتكلفة أو بخسارة:</span><span>${dangerCount} حالات</span></div>
  <div class="row"><span>إجمالي التخفيضات اليدوية:</span><span>-${discountSum.toFixed(2)} د.ج</span></div>
  <div class="row"><span>عمليات البيع بالمبلغ (كمية جزئية):</span><span>${fracCount} عمليات</span></div>
</body>
</html>`;

      window.api?.printSilent?.({ html, silent: false });
    }
  };

  window.GherbiV13Stage4 = V13Stage4;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V13Stage4.init());
  } else {
    V13Stage4.init();
  }
})();

/* ==================== [MODULE: gherbi-v10-subtotal-qty-price-switch.js] ==================== */
/**
 * gherbi-v10-subtotal-qty-price-switch.js
 * المحرك المزدوج لخانة إجمالي السطر (125.00 ⬅ الكمية 0.8 أو تعديل السعر):
 * - يتيح التبديل بين وضع (⚖️ تغيير الكمية تلقائياً 1 ⬅ 0.8) ووضع (💰 تغيير السعر / تخفيض).
 * - يضيف زر قلب فوري (⇄) داخل كل سطر تم تعديل إجماليه لعكس الطريقة بضغطة واحدة.
 * - يوثق عمليات البيع بالكمية الجزئية (0.8) وتخفيضات السعر في رادار صاحب المحل بصفحة الإحصائيات.
 */

'use strict';

(function initGherbiV10SubtotalModeEngine() {
  const MODE_STORAGE_KEY = 'gherbi_subtotal_edit_mode_v10'; // 'qty' | 'price'

  const V10SubtotalEngine = {
    // الوضع الافتراضي هو 'qty' (تغيير الكمية تلقائياً 1 -> 0.8 كما أشار المستخدم بالسهم الأزرق)
    currentMode: localStorage.getItem(MODE_STORAGE_KEY) || 'qty',

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState || !window.GherbiV9Engine) return;
        clearInterval(wait);
        this.injectModeSwitcherInPosBar();
        this.overrideV9SubtotalHandler();
        setInterval(() => {
          this.injectModeSwitcherInPosBar();
          this.renderRowFlipChipsAndFractionHints();
        }, 300);
        console.log('🚀 [Gherbi V10 Ready]: محرك تعديل الإجمالي (تغيير الكمية 1 ⬅ 0.8 أو تغيير السعر) جاهز 100%.');
      }, 200);
    },

    getMode() {
      return this.currentMode === 'price' ? 'price' : 'qty';
    },

    setMode(newMode) {
      this.currentMode = newMode === 'price' ? 'price' : 'qty';
      localStorage.setItem(MODE_STORAGE_KEY, this.currentMode);
      this.updateModeSwitcherButtonUI();

      if (window.showToast) {
        if (this.currentMode === 'qty') {
          window.showToast(
            '⚖️ الوضع النشط الآن: عند تعديل إجمالي السطر (125.00) تتغير الكمية تلقائياً (مثلاً 1 ⬅ 0.8)',
            'success'
          );
        } else {
          window.showToast(
            '💰 الوضع النشط الآن: عند تعديل إجمالي السطر (125.00) يتغير السعر (تخفيض) وتبقى الكمية ثابتة (1)',
            'info'
          );
        }
      }
    },

    toggleGlobalMode() {
      this.setMode(this.getMode() === 'qty' ? 'price' : 'qty');
    },

    // ========================================================================
    // 1. إضافة زر التبديل بين الوضعين في شريط مضاعفات الكمية أعلى السلة
    // ========================================================================
    injectModeSwitcherInPosBar() {
      const multStrip = document.getElementById('posQuickMultiplierBar') ||
        document.querySelector('.gherbi-multiplier-strip') ||
        Array.from(document.querySelectorAll('#view-pos div')).find((d) => (d.textContent || '').includes('ضرب الكمية:'));

      if (!multStrip) return;

      let btn = document.getElementById('gherbiV10SubtotalModeBtn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'gherbiV10SubtotalModeBtn';
        btn.type = 'button';
        btn.onclick = () => this.toggleGlobalMode();
        multStrip.appendChild(btn);
        this.updateModeSwitcherButtonUI();
      }
    },

    updateModeSwitcherButtonUI() {
      const btn = document.getElementById('gherbiV10SubtotalModeBtn');
      if (!btn) return;
      const isQty = this.getMode() === 'qty';

      if (isQty) {
        btn.className = 'gherbi-v10-mode-switcher mode-qty';
        btn.innerHTML = '<span>⚖️ تعديل الإجمالي: يغير الكمية (0.8)</span><span class="underline text-[9px] mr-1">⇄ تبديل</span>';
        btn.title = 'الوضع الحالي: كتابة مبلغ أقل في خانة الإجمالي (125.00) ينقص الكمية تلقائياً (مثلاً 1 تصبح 0.8). انقر للتبديل إلى وضع تغيير السعر.';
      } else {
        btn.className = 'gherbi-v10-mode-switcher mode-price';
        btn.innerHTML = '<span>💰 تعديل الإجمالي: يغير السعر (تخفيض)</span><span class="underline text-[9px] mr-1">⇄ تبديل</span>';
        btn.title = 'الوضع الحالي: كتابة مبلغ أقل في خانة الإجمالي (125.00) يخفض سعر الوحدة ويبقي الكمية (1) ثابتة. انقر للتبديل إلى وضع تغيير الكمية (0.8).';
      }
    },

    // ========================================================================
    // 2. ترقية دالة تعديل خانة الإجمالي الفرعي للسطر (الدائرة الزرقاء 125.00)
    // ========================================================================
    overrideV9SubtotalHandler() {
      const v9 = window.GherbiV9Engine;
      if (!v9) return;

      // استبدال دالة applyLineSubtotalChangeToRow في المحرك التاسع لتعمل حسب الوضع المختار (الكمية 0.8 أو السعر)
      v9.applyLineSubtotalChangeToRow = (idx, newSubtotalVal, forceFlipMode = null) => {
        const items = window.App?.currentCart?.items || [];
        const item = items[idx];
        if (!item) return;

        const parsedTotal = parseFloat(newSubtotalVal);
        if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) return;

        const prod = (window.AppState?.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );

        const sign = Number(item.quantity || 1) < 0 ? -1 : 1;

        // حفظ القيم المرجعية الأصلية قبل التعديل لأول مرة حتى نتمكن من القلب بين الوضعين (0.8 كمية ⇄ تخفيض سعر) في أي لحظة!
        if (!item._baseReferenceUnitPrice) {
          item._baseReferenceUnitPrice = Number(prod?.selling_price ?? prod?.price ?? item.price ?? 0);
        }
        if (!item._baseReferenceQty) {
          item._baseReferenceQty = Math.max(0.001, Math.abs(Number(item.quantity || 1)));
        }

        const effectiveMode = forceFlipMode || this.getMode();
        item._lastSubtotalAppliedMode = effectiveMode;
        item._targetLineSubtotalDzd = Number(parsedTotal.toFixed(2));

        if (effectiveMode === 'qty') {
          // ==================================================================
          // الوضع أ: تعديل الإجمالي يغير الكمية تلقائياً (مثلاً 100 / 125 = 0.8)
          // ==================================================================
          // إذا كان السطر في وضع الكرتونة (مثلاً 8 قطع بـ 950 د.ج)، نحسب سعر الحبة المرجعي أو نرجع لسعر الحبة الرسمي
          const refUnitPrice = item._isCartonPackMode && item._singlePackTotalDzd && item._packQtyFactor
            ? Number((item._singlePackTotalDzd / item._packQtyFactor).toFixed(4))
            : Number(item._baseReferenceUnitPrice || item.price || 1);

          const computedQty = Number((parsedTotal / Math.max(0.01, refUnitPrice)).toFixed(3));

          item.price = Number(refUnitPrice.toFixed(2));
          item.quantity = computedQty * sign;
          item.subtotal = Number((parsedTotal * sign).toFixed(2));
          item._editedFromSubtotalBox = true;
          item._manualLineSubtotal = item.subtotal;

          // تسجيل عملية البيع بكمية جزئية (0.8) في رادار صاحب المحل بصفحة الإحصائيات
          this.logFractionalQtySaleInOwnerRadar(item, prod, item._baseReferenceQty, computedQty, parsedTotal);

          window.App.recalcAndRenderCart?.();
          v9.enhanceCartRowsWithEditableSubtotalAndStockGuard?.();
          this.renderRowFlipChipsAndFractionHints();

          if (window.showToast) {
            const pct = Math.round(computedQty * 100);
            window.showToast(
              `⚖️ تم تعديل الكمية تلقائياً إلى (${computedQty}) مقابل مبلغ (${parsedTotal.toFixed(2)} د.ج) — يخصم ${computedQty} من السطوك`,
              'success'
            );
          }
        } else {
          // ==================================================================
          // الوضع ب: تعديل الإجمالي يغير السعر (تخفيض مالي) مع بقاء الكمية ثابتة (1)
          // ==================================================================
          const fixedQty = Math.max(0.001, Number(item._baseReferenceQty || Math.abs(Number(item.quantity || 1))));
          const oldUnitPrice = Number(item._baseReferenceUnitPrice || item.price || 0);
          const newUnitPrice = Number((parsedTotal / fixedQty).toFixed(4));

          item.quantity = fixedQty * sign;
          item.price = newUnitPrice;
          item.custom_price = newUnitPrice;
          item.subtotal = Number((parsedTotal * sign).toFixed(2));
          item._editedFromSubtotalBox = true;
          item._manualLineSubtotal = item.subtotal;

          if (item._isCartonPackMode) {
            const packsCount = Math.max(1, Number(item._packsCount || 1));
            item._singlePackTotalDzd = Number((parsedTotal / packsCount).toFixed(2));
          }

          v9.recordPriceModificationEvent(item, prod, oldUnitPrice, newUnitPrice, 'تخفيض من خانة الإجمالي (مع ثبات الكمية)');
          window.App.recalcAndRenderCart?.();
          v9.enhanceCartRowsWithEditableSubtotalAndStockGuard?.();
          this.renderRowFlipChipsAndFractionHints();
        }
      };
    },

    // قلب طريقة حساب السطر الحالي بضغطة واحدة (بين 0.8 كمية ⇄ تخفيض سعر)
    flipRowSubtotalMethod(idx) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item || !item._targetLineSubtotalDzd) return;

      const nextMode = item._lastSubtotalAppliedMode === 'qty' ? 'price' : 'qty';
      window.GherbiV9Engine?.applyLineSubtotalChangeToRow(idx, item._targetLineSubtotalDzd, nextMode);
    },

    // توثيق البيع بكمية جزئية (مثل 0.8 أو 0.9) في رادار صاحب المحل بصفحة الإحصائيات
    logFractionalQtySaleInOwnerRadar(item, prod, oldQty, newQty, lineTotalDzd) {
      const v9 = window.GherbiV9Engine;
      if (!v9 || Math.abs(newQty - oldQty) < 0.001) return;

      const costPrice = Number(prod?.cost_price ?? item?.cost_price ?? 0);
      const unitPrice = Number(item?.price || 0);
      const currentStock = Number(prod?.total_stock ?? prod?.stock ?? 0);
      const remainingStock = Number((currentStock - newQty).toFixed(3));
      const netProfitOnLine = costPrice > 0 ? Number((lineTotalDzd - (newQty * costPrice)).toFixed(2)) : 0;

      const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value;
      const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;
      const seller = document.getElementById('currentUserName')?.textContent?.trim() || window.AppState?.currentUser?.name || 'المدير العام';
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const entry = {
        id: 'rad_qty_' + Date.now(),
        timestamp: new Date().toISOString(),
        dateFormatted: nowStr,
        seller,
        customerName: cust ? cust.name : 'زبون عابر',
        productId: prod?.id || item?.product_id || null,
        productName: item?.name || prod?.name || 'سلعة',
        saleMode: `⚖️ بيع بمبلغ (تعديل الكمية: ${oldQty} ⬅ ${newQty})`,
        editSource: 'تحويل الإجمالي إلى كمية جزئية',
        quantity: newQty,
        stockBefore: currentStock,
        stockAfter: remainingStock,
        costPrice,
        originalUnitPrice: unitPrice,
        newUnitPrice: unitPrice,
        originalLineTotal: Number((oldQty * unitPrice).toFixed(2)),
        newLineTotal: Number(lineTotalDzd.toFixed(2)),
        unitPriceDiff: 0,
        profitImpactDzd: 0,
        netProfitOnLine,
        category: 'fractional_qty'
      };

      const logs = v9.getRadarLogs();
      const existingIdx = logs.findIndex(
        (l) => l.productName === entry.productName && String(l.dateFormatted).slice(0, 15) === nowStr.slice(0, 15)
      );
      if (existingIdx !== -1) {
        logs[existingIdx] = entry;
      } else {
        logs.unshift(entry);
      }
      v9.saveRadarLogs(logs);
    },

    // ========================================================================
    // 3. عرض شارة الكمية الجزئية (0.8) وزر القلب السريع (⇄) داخل سطر السلة
    // ========================================================================
    renderRowFlipChipsAndFractionHints() {
      const cartBox = document.getElementById('posCartItems');
      if (!cartBox) return;

      const items = window.App?.currentCart?.items || [];
      const rows = Array.from(cartBox.children).filter(
        (el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة')
      );

      rows.forEach((row, idx) => {
        const item = items[idx];
        if (!item) return;

        // تحديث قيمة حقل الكمية الظاهر في السطر ليطابق 0.8 أو 0.9 فوراً
        const numberInputs = Array.from(row.querySelectorAll('input[type="number"], input[type="text"]')).filter(
          (inp) => !inp.classList.contains('gherbi-line-subtotal-input')
        );
        const qtyInp = numberInputs[0] || null;
        if (qtyInp && document.activeElement !== qtyInp) {
          const cleanQty = Number(Number(item.quantity || 1).toFixed(3));
          if (parseFloat(qtyInp.value) !== cleanQty) {
            qtyInp.value = String(cleanQty);
          }
        }

        // تحديث شارة المخزون المتبقي لتعرض الكسور بدقة (مثلاً: متوفر: 6 ⬅ يبقى: 5.2 قطعة)
        const prod = (window.AppState?.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );
        if (prod) {
          const avail = Number(prod.total_stock ?? prod.stock ?? 0);
          const rem = Number((avail - Math.abs(Number(item.quantity || 1))).toFixed(2));
          Array.from(row.querySelectorAll('span, div')).forEach((el) => {
            const t = (el.textContent || '').trim();
            if (t.includes('متوفر:') && t.includes('يبقى:') && el.children.length <= 2) {
              el.innerHTML = `📦 متوفر: ${avail} ⬅ يبقى: ${rem} ${prod.unit || 'قطعة'}`;
            }
          });
        }

        // إظهار زر القلب السريع (⇄) عندما يكون السطر قد عُدّل من خانة الإجمالي (125.00)
        const packBar = row.querySelector('.gherbi-v8-pack-bar') || row.querySelector('div');
        if (!packBar) return;

        let flipChip = row.querySelector('.gherbi-v10-flip-chip');
        if (item._editedFromSubtotalBox && item._targetLineSubtotalDzd) {
          if (!flipChip) {
            flipChip = document.createElement('button');
            flipChip.type = 'button';
            flipChip.className = 'gherbi-v10-flip-chip';
            packBar.appendChild(flipChip);
          }
          const isCurrentlyQty = item._lastSubtotalAppliedMode === 'qty';
          const qVal = Number(Math.abs(Number(item.quantity || 1)).toFixed(3));
          if (isCurrentlyQty) {
            const gramsOrPct = Math.round(qVal * 1000);
            flipChip.innerHTML = `<span>⚖️ كمية جزئية (${qVal} = ${gramsOrPct}غ)</span><span class="underline mr-1">⇄ اجعلها تخفيض سعر (كمية ${item._baseReferenceQty || 1})</span>`;
            flipChip.title = 'انقر هنا إذا أخذ الزبون الحبة كاملة (1) بسعر مخفض بدلاً من إنقاص الكمية إلى ' + qVal;
          } else {
            const calcQ = Number((item._targetLineSubtotalDzd / Math.max(0.01, Number(item._baseReferenceUnitPrice || 125))).toFixed(2));
            flipChip.innerHTML = `<span>💰 تخفيض سعر (الكمية ${qVal})</span><span class="underline mr-1">⇄ أو أنقص الكمية إلى (${calcQ})</span>`;
            flipChip.title = 'انقر هنا إذا كنت تريد إنقاص الكمية إلى (' + calcQ + ') وإبقاء سعر الوحدة ثابتاً';
          }
          flipChip.onclick = (e) => {
            e.stopPropagation();
            this.flipRowSubtotalMethod(idx);
          };
        } else if (flipChip) {
          flipChip.remove();
        }
      });
    }
  };

  window.GherbiV10SubtotalEngine = V10SubtotalEngine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V10SubtotalEngine.init());
  } else {
    V10SubtotalEngine.init();
  }
})();


/* ==================== [V14 AUDIT PERFECTION: ANTI-VOID RADAR, CREDIT GUARD & LABEL PRINT] ==================== */
(function initV14AuditPerfectionSuite() {
  const RADAR_STORAGE_KEY = 'gherbi_owner_price_radar_v9';

  const V14Suite = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.hookScanAndVoidAntiTheftRadar();
        this.hookCreditLimitAndPaidLoyaltyGuard();
        this.addVoidFilterToOwnerRadarUI();
        this.addNearExpiryClearanceDiscountButton();
        this.addInstantLabelPrintToQuickInventoryModal();
        this.captureLastSaleBeforeCartResetFor80mmReceipt();
        console.log('🚀 [V14 Audit Perfection Active]: رادار الحذف بعد المسح + درع سقف الكريدي + تصفية الصلاحية جاهزة 100%.');
      }, 260);
    },

    // ========================================================================
    // 1. رادار كشف "الحذف بعد المسح" (Scan-and-Void Anti-Theft Surveillance)
    // ========================================================================
    logVoidedItemOrCartToOwnerRadar(item, reasonLabel = '🗑️ حذف سطر من السلة بعد المسح') {
      if (!item) return;
      const qty = Math.abs(Number(item.quantity || 1));
      const price = Number(item.price || 0);
      const lineTotal = Number((item.subtotal !== undefined ? item.subtotal : (qty * price)).toFixed(2));
      if (lineTotal <= 0) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );
      const costPrice = Number(prod?.cost_price ?? item.cost_price ?? 0);
      const curStock = Number(prod?.total_stock ?? prod?.stock ?? 0);

      const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value;
      const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;
      const seller = document.getElementById('currentUserName')?.textContent?.trim() || window.AppState?.currentUser?.name || 'المدير العام';
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const entry = {
        id: 'void_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        dateFormatted: nowStr,
        seller,
        customerName: cust ? cust.name : 'زبون عابر',
        productId: prod?.id || item.product_id || null,
        productName: item.name || item.custom_product_name || prod?.name || 'سلعة محذوفة',
        saleMode: reasonLabel,
        editSource: 'إلغاء قبل التسديد',
        quantity: qty,
        stockBefore: curStock,
        stockAfter: curStock,
        costPrice,
        originalUnitPrice: price,
        newUnitPrice: 0,
        originalLineTotal: lineTotal,
        newLineTotal: 0,
        unitPriceDiff: -price,
        profitImpactDzd: 0,
        netProfitOnLine: 0,
        category: 'voided_line'
      };

      const logs = window.GherbiV9Engine ? window.GherbiV9Engine.getRadarLogs() : [];
      logs.unshift(entry);
      if (window.GherbiV9Engine) {
        window.GherbiV9Engine.saveRadarLogs(logs);
      } else {
        localStorage.setItem(RADAR_STORAGE_KEY, JSON.stringify(logs.slice(0, 400)));
      }

      if (window.api?.addAuditLog) {
        window.api.addAuditLog({
          user_id: window.AppState?.currentUser?.id || 1,
          user_name: seller,
          action_type: 'POS_LINE_OR_CART_VOIDED',
          target_type: 'product',
          target_id: entry.productId,
          severity: 'warning',
          details: entry
        }).catch(() => {});
      }
    },

    hookScanAndVoidAntiTheftRadar() {
      // أ) اعتراض حذف سطر مفرد من السلة (أيقونة سلة المهملات الحمراء أو مفتاح Delete)
      ['removeFromCart', 'removeCartItem'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (origFn && !window.App['_v14VoidHook_' + fnName]) {
          window.App[fnName] = function (idx, ...rest) {
            const item = window.App?.currentCart?.items?.[idx];
            if (item) {
              V14Suite.logVoidedItemOrCartToOwnerRadar(item, '🗑️ حذف سطر من السلة بعد المسح');
            }
            return origFn(idx, ...rest);
          };
          window.App['_v14VoidHook_' + fnName] = true;
        }
      });

      // ب) اعتراض الحذف النهائي لسلة كاملة تحتوي على أصناف
      if (window.GherbiV6Stage1 && !window.GherbiV6Stage1._v14CartVoidHooked) {
        const origDeleteCart = window.GherbiV6Stage1.executeConfirmedCartDelete.bind(window.GherbiV6Stage1);
        window.GherbiV6Stage1.executeConfirmedCartDelete = function () {
          const idx = this.pendingDeleteCartIdx;
          const targetCart = idx !== null && idx !== undefined ? window.AppState?.carts?.[idx] : null;
          if (targetCart && Array.isArray(targetCart.items) && targetCart.items.length > 0) {
            targetCart.items.forEach((it) => {
              V14Suite.logVoidedItemOrCartToOwnerRadar(it, `🗑️ حذف سلة كاملة (${targetCart.label || 'سلة'}) قبل التسديد`);
            });
          }
          return origDeleteCart();
        };
        window.GherbiV6Stage1._v14CartVoidHooked = true;
      }
    },

    addVoidFilterToOwnerRadarUI() {
      if (!window.GherbiV9Engine || window.GherbiV9Engine._v14RadarUpgraded) return;
      const origRenderRadar = window.GherbiV9Engine.renderOwnerPriceRadarCard.bind(window.GherbiV9Engine);

      window.GherbiV9Engine.renderOwnerPriceRadarCard = function (forceRebuild = false) {
        origRenderRadar(forceRebuild);
        const radarEl = document.getElementById('v9OwnerPriceSurveillanceRadar');
        if (!radarEl) return;

        const allLogs = this.getRadarLogs();
        const voidLogs = allLogs.filter((l) => l.category === 'voided_line');

        // إضافة زر فلترة "🗑️ محذوفات بعد المسح" في شريط الفلاتر إن لم يكن موجوداً
        const filterBar = radarEl.querySelector('.flex.flex-wrap.items-center.gap-1\.5');
        if (filterBar && !filterBar.querySelector('[data-v14-void-filter]')) {
          const voidBtn = document.createElement('button');
          voidBtn.type = 'button';
          voidBtn.setAttribute('data-v14-void-filter', '1');
          voidBtn.className = 'v9-radar-filter-pill ' + (this.activeRadarFilter === 'voided_line' ? 'active' : '');
          voidBtn.innerHTML = `🗑️ سطور محذوفة بعد المسح (${voidLogs.length})`;
          voidBtn.onclick = () => {
            this.activeRadarFilter = 'voided_line';
            // عند اختيار فلتر المحذوفات نعرض فقط voided_line
            this.renderOwnerPriceRadarCard(true);
            const tbody = radarEl.querySelector('tbody');
            if (tbody && this.activeRadarFilter === 'voided_line') {
              Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
                if (!tr.textContent.includes('حذف')) tr.remove();
              });
            }
          };
          filterBar.appendChild(voidBtn);
        }
      };
      window.GherbiV9Engine._v14RadarUpgraded = true;
    },

    // ========================================================================
    // 2. درع سقف الدين (Plafond Crédit Guard) في نافذة التسديد (F1)
    // ========================================================================
    hookCreditLimitAndPaidLoyaltyGuard() {
      const origSubmit = window.App.submitSale?.bind(window.App);
      if (!origSubmit || window.App._v14CreditGuardHooked) return;

      window.App.submitSale = async function (printMode = 'receipt', ...rest) {
        const method = document.getElementById('chkPaymentMethod')?.value || 'cash';
        const totalTxt = document.getElementById('chkTotalDue')?.textContent || '0';
        const totalDue = parseFloat(totalTxt.replace(/[^0-9.-]/g, '')) || 0;
        const paidAmount = parseFloat(document.getElementById('chkPaidAmount')?.value || '0') || 0;
        const newDebt = Math.max(0, Number((totalDue - paidAmount).toFixed(2)));

        if (method === 'credit' || newDebt > 0.01) {
          const cid = Number(window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value || 0);
          if (!cid) {
            if (window.showToast) {
              window.showToast('🚨 لا يمكن تسجيل دين (كريدي) لزبون عابر! يرجى اختيار اسم الزبون أولاً عبر (F8).', 'error');
            }
            return;
          }

          const cust = (window.AppState?.customers || []).find((c) => Number(c.id) === cid);
          if (cust) {
            if (cust.is_blocked || cust.blocked) {
              if (window.showToast) {
                window.showToast(`🚫 الزبون "${cust.name}" مجمد من الكريدي (Bloqué)! لا يمكن تسجيل دين جديد له.`, 'error');
              }
              return;
            }

            const creditLimit = Number(cust.credit_limit || 0);
            const currentDebt = Number(cust.total_debt ?? cust.debt ?? cust.initial_debt ?? 0);
            const projectedDebt = Number((currentDebt + newDebt).toFixed(2));

            if (creditLimit > 0 && projectedDebt > creditLimit && !window.App._v14CreditLimitOverrideApproved) {
              if (window.showToast) {
                window.showToast(
                  `⚠️ تجاوز سقف الدين! دين الزبون سيصبح (${projectedDebt.toFixed(2)} د.ج) بينما السقف المسموح له هو (${creditLimit.toFixed(2)} د.ج).`,
                  'warning'
                );
              }
              if (window.GherbiStage1) {
                const pin = await window.GherbiStage1.openCustomPrompt(
                  `🔐 تجاوز سقف الكريدي لـ (${cust.name}): أدخل كود المدير السري للموافقة الاستثنائية`,
                  ''
                );
                const validPin = window.GherbiStage12Enforcer ? window.GherbiStage12Enforcer.getStoredPin() : '1234';
                if (String(pin || '').trim() !== validPin) {
                  if (window.showToast) window.showToast('❌ لم تتم الموافقة على تجاوز سقف الدين', 'error');
                  return;
                }
              }
            }
          }
        }

        return origSubmit(printMode, ...rest);
      };
      window.App._v14CreditGuardHooked = true;
    },

    // ========================================================================
    // 3. زر "🏷️ تصفية قريب الانتهاء (-15%)" بضغطة واحدة داخل السلة
    // ========================================================================
    applyNearExpiryClearanceDiscount(idx) {
      const item = window.App?.currentCart?.items?.[idx];
      if (!item) return;
      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId)
      );
      const basePrice = Number(item._savedUnitPrice || prod?.selling_price || item.price || 0);
      const costPrice = Number(prod?.cost_price || 0);
      // تخفيض 15% مع ضمان عدم النزول تحت سعر التكلفة (حماية رأس المال)
      const discounted = Math.max(costPrice > 0 ? costPrice : 0, Number((basePrice * 0.85).toFixed(2)));

      if (window.GherbiV9Engine) {
        window.GherbiV9Engine.applyUnitPriceChangeToRow(idx, discounted);
      }
      if (window.showToast) {
        window.showToast(`🏷️ تم تطبيق تخفيض تصفية قريب الانتهاء (-15%): السعر الآن ${discounted.toFixed(2)} د.ج (مع حماية رأس المال)`, 'success');
      }
    },

    addNearExpiryClearanceDiscountButton() {
      setInterval(() => {
        const cartBox = document.getElementById('posCartItems');
        if (!cartBox) return;
        const rows = Array.from(cartBox.children).filter(
          (el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة')
        );
        rows.forEach((row, idx) => {
          const expBadge = row.querySelector('.v13-expiry-guard-badge');
          const toolsBar = row.querySelector('.gherbi-v11-row-tools');
          if (expBadge && toolsBar && !toolsBar.querySelector('.v14-clearance-btn')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'v14-clearance-btn px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] shadow-sm transition';
            btn.innerHTML = '🏷️ تصفية (-15%)';
            btn.title = 'تطبيق تخفيض تصفية فوري (-15% مع حماية رأس المال) لتصريف السلعة قبل انتهاء صلاحيتها';
            btn.onclick = (e) => {
              e.stopPropagation();
              this.applyNearExpiryClearanceDiscount(idx);
            };
            toolsBar.appendChild(btn);
          }
        });
      }, 500);
    },

    // ========================================================================
    // 4. زر "🖨️ حفظ + طباعة ملصق السعر للرف" داخل نافذة التعديل السريع للمخزون
    // ========================================================================
    addInstantLabelPrintToQuickInventoryModal() {
      setInterval(() => {
        const modal = document.getElementById('v13QuickInventoryModal');
        if (!modal) return;
        const footer = modal.querySelector('.flex.items-center.justify-end');
        if (footer && !document.getElementById('v14SaveAndPrintShelfLabelBtn')) {
          const printBtn = document.createElement('button');
          printBtn.id = 'v14SaveAndPrintShelfLabelBtn';
          printBtn.type = 'button';
          printBtn.className = 'px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow flex items-center gap-1';
          printBtn.innerHTML = '<span>🖨️ حفظ + طباعة ملصق الرف</span>';
          printBtn.onclick = async () => {
            const pid = window.GherbiV13Stage4?.editingProdId;
            await window.GherbiV13Stage4?.saveQuickInventoryEdit?.();
            if (pid && window.App?.openBarcodePrintModal) {
              setTimeout(() => window.App.openBarcodePrintModal(pid), 150);
            }
          };
          footer.insertBefore(printBtn, footer.lastElementChild);
        }
      }, 600);
    },

    // ========================================================================
    // 5. تثبيت سياق الفاتورة قبل تصفير السلة لضمان اكتمال التذكرة الحرارية 80mm دائماً
    // ========================================================================
    captureLastSaleBeforeCartResetFor80mmReceipt() {
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fn) => {
        const orig = window.App[fn]?.bind(window.App);
        if (orig && !window.App['_v14CaptureReceipt_' + fn]) {
          window.App[fn] = async function (...args) {
            try {
              const cart = window.App?.currentCart;
              if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
                const total = typeof window.computeSafeCartTotalDzd === 'function' ? window.computeSafeCartTotalDzd() : 0;
                const cid = cart.customerId || document.getElementById('posCustomerSelect')?.value || '';
                localStorage.setItem(
                  'gherbi_last_completed_sale',
                  JSON.stringify({
                    total,
                    discount: Number(cart.discount || 0) + Number(cart.couponDiscount || 0),
                    customer_id: cid,
                    timestamp: Date.now()
                  })
                );
              }
            } catch (_) {}
            return orig(...args);
          };
          window.App['_v14CaptureReceipt_' + fn] = true;
        }
      });
    }
  };

  window.GherbiV14Suite = V14Suite;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V14Suite.init());
  } else {
    V14Suite.init();
  }
})();


/* ==================== [V15 FINAL SEAL: BARCODE AUTO-TRAP & DOUBLE-SUBMIT GUARD] ==================== */
(function initV15FinalPosSeal() {
  const V15Seal = {
    lastCheckoutTimestamp: 0,
    scanBuffer: '',
    lastKeyTime: 0,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.installDoubleSubmitCooldownGuard();
        this.installGlobalBarcodeScannerAutoTrap();
        this.injectScannerReadyIndicator();
        console.log('🏆 [Gherbi V15 Final Seal]: قفل منع تكرار الفواتير + لاقط الباركود الذكي الشامل جاهز 100%.');
      }, 240);
    },

    // ========================================================================
    // 1. منع تكرار الفاتورة عند الضغط المزدوج السريع على (Esc أو Ctrl+Space أو Enter)
    // ========================================================================
    installDoubleSubmitCooldownGuard() {
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fnName) => {
        const orig = window.App[fnName]?.bind(window.App);
        if (orig && !window.App['_v15Cooldown_' + fnName]) {
          window.App[fnName] = async function (...args) {
            const now = Date.now();
            if (now - V15Seal.lastCheckoutTimestamp < 850) {
              return; // تجاهل الضربة المزدوجة الخاطئة خلال أقل من 850ms
            }
            const items = window.App?.currentCart?.items || [];
            if (items.length === 0) return;

            V15Seal.lastCheckoutTimestamp = now;
            try {
              return await orig(...args);
            } finally {
              setTimeout(() => { V15Seal.lastCheckoutTimestamp = 0; }, 850);
            }
          };
          window.App['_v15Cooldown_' + fnName] = true;
        }
      });
    },

    // ========================================================================
    // 2. الالتقاط الشامل لنبضات قارئ الباركود حتى لو لم يكن المؤشر داخل حقل الباركود
    // ========================================================================
    installGlobalBarcodeScannerAutoTrap() {
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;
          if (document.querySelector('.modal-overlay.active, #gherbiAisleKioskOverlay.active')) return;

          const activeEl = document.activeElement;
          const isInsideInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
          if (isInsideInput) return;

          const now = Date.now();
          if (now - this.lastKeyTime > 90) {
            this.scanBuffer = '';
          }
          this.lastKeyTime = now;

          if (/^[0-9A-Za-z-]$/.test(e.key) && !e.ctrlKey && !e.altKey) {
            this.scanBuffer += e.key;
            const bcInp = document.getElementById('barcodeInput');
            if (bcInp && this.scanBuffer.length >= 2) {
              bcInp.focus();
              bcInp.value = this.scanBuffer;
            }
          } else if (e.key === 'Enter' && this.scanBuffer.length >= 4) {
            e.preventDefault();
            const code = this.scanBuffer;
            this.scanBuffer = '';
            const bcInp = document.getElementById('barcodeInput');
            if (bcInp) bcInp.value = '';
            window.App.handleBarcodeScan?.(code);
          }
        },
        true
      );
    },

    // ========================================================================
    // 3. مؤشر جاهزية القارئ الضوئي في حقل الباركود العلوي
    // ========================================================================
    injectScannerReadyIndicator() {
      const bcInp = document.getElementById('barcodeInput');
      if (!bcInp || document.getElementById('v15ScannerStatusDot')) return;

      const parent = bcInp.parentElement;
      if (!parent) return;

      const dot = document.createElement('span');
      dot.id = 'v15ScannerStatusDot';
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 absolute left-2.5 top-3 shadow-sm shadow-emerald-500/50';
      dot.title = '🟢 قارئ الباركود نشط وجاهز للمسح الفوري من أي مكان في الشاشة (F5)';
      parent.appendChild(dot);
    }
  };

  window.GherbiV15Seal = V15Seal;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V15Seal.init());
  } else {
    V15Seal.init();
  }
})();


/* ==================== [V17 COMPETITIVE EXCELLENCE: SERVICE TIMER, CARTON FLOOR GUARD & RADAR EXPORT] ==================== */
(function initV17CompetitiveExcellence() {
  const V17Excellence = {
    cartStartTime: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.setupLiveCashierServiceTimer();
        this.setupCartonFloorPriceWarning();
        this.injectExportAndPrintButtonsIntoOwnerRadar();
        console.log('🏆 [Gherbi V17 Excellence]: عداد سرعة الكاشير + درع سعر الكرتونة + تصدير/طباعة رادار المدير نشطة 100%.');
      }, 260);
    },

    // ========================================================================
    // 1. عداد سرعة خدمة الزبون الحي في شريط السلة (⏱️ Live Cashier Service Timer)
    // ========================================================================
    setupLiveCashierServiceTimer() {
      setInterval(() => {
        const items = window.App?.currentCart?.items || [];
        if (items.length === 0) {
          this.cartStartTime = null;
        } else if (!this.cartStartTime) {
          this.cartStartTime = Date.now();
        }

        const multStrip = document.querySelector('.gherbi-multiplier-strip') || document.getElementById('multiCartTabs')?.parentElement;
        if (!multStrip) return;

        let timerBadge = document.getElementById('v17CashierServiceTimerBadge');
        if (!timerBadge) {
          timerBadge = document.createElement('span');
          timerBadge.id = 'v17CashierServiceTimerBadge';
          timerBadge.className = 'px-2 py-0.5 rounded-md font-mono font-black text-[10px] border transition';
          timerBadge.title = 'زمن خدمة الزبون الحالي منذ مسح أول سلعة';
          multStrip.appendChild(timerBadge);
        }

        if (!this.cartStartTime) {
          const idleTxt = '⏱️ جاهز';
          if (timerBadge.textContent !== idleTxt) {
            timerBadge.textContent = idleTxt;
            timerBadge.className = 'px-2 py-0.5 rounded-md font-mono font-black text-[10px] bg-slate-500/10 text-slate-500 border border-slate-500/20';
          }
          return;
        }

        const elapsedSec = Math.max(0, Math.floor((Date.now() - this.cartStartTime) / 1000));
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(elapsedSec % 60).padStart(2, '0');
        const activeTxt = `⏱️ ${mins}:${secs}`;

        if (timerBadge.textContent !== activeTxt) {
          timerBadge.textContent = activeTxt;
          timerBadge.className =
            elapsedSec > 90
              ? 'px-2 py-0.5 rounded-md font-mono font-black text-[10px] bg-amber-500/15 text-amber-600 border border-amber-500/30'
              : 'px-2 py-0.5 rounded-md font-mono font-black text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
        }
      }, 1000);
    },

    // ========================================================================
    // 2. درع التنبيه عند بيع حبة مفردة بسعر أقل من سعر الحبة داخل الكرتونة
    // ========================================================================
    setupCartonFloorPriceWarning() {
      if (!window.GherbiV9Engine || window.GherbiV9Engine._v17CartonFloorHooked) return;
      const origApplyUnit = window.GherbiV9Engine.applyUnitPriceChangeToRow.bind(window.GherbiV9Engine);

      window.GherbiV9Engine.applyUnitPriceChangeToRow = function (idx, newUnitPriceVal) {
        const res = origApplyUnit(idx, newUnitPriceVal);
        try {
          const item = window.App?.currentCart?.items?.[idx];
          if (item && !item._isCartonPackMode && window.GherbiV8PackEngine) {
            const prod = (window.AppState?.products || []).find(
              (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
            );
            const cfg = window.GherbiV8PackEngine.resolvePackConfig(prod, item);
            const costPrice = Number(prod?.cost_price || 0);
            if (
              cfg.isConfigured &&
              Number(item.price) < cfg.unitPriceInsidePack - 0.05 &&
              Number(item.price) > costPrice
            ) {
              if (window.showToast) {
                window.showToast(
                  `📦 تنبيه: السعر المدخل للحبة (${Number(item.price).toFixed(2)} د.ج) أقل حتى من سعر الحبة داخل الكرتونة (${cfg.unitPriceInsidePack.toFixed(2)} د.ج)!`,
                  'warning'
                );
              }
            }
          }
        } catch (_) {}
        return res;
      };
      window.GherbiV9Engine._v17CartonFloorHooked = true;
    },

    // ========================================================================
    // 3. تصدير وطباعة سجل "رادار رقابة صاحب المحل" (CSV/Excel & 80mm Thermal)
    // ========================================================================
    exportOwnerRadarToCsv() {
      const logs = window.GherbiV9Engine ? window.GherbiV9Engine.getRadarLogs() : [];
      if (!logs.length) {
        if (window.showToast) window.showToast('ℹ️ السجل الرقابي فارغ حالياً', 'info');
        return;
      }

      const headers = ['التوقيت', 'البائع', 'الزبون', 'الصنف', 'طريقة البيع', 'الكمية', 'المتبقي بالسطوك', 'سعر الشراء', 'السعر الأصلي', 'السعر الجديد', 'إجمالي السطر', 'صافي الربح', 'التصنيف'];
      const rows = logs.map((l) => [
        l.dateFormatted || '',
        l.seller || '',
        l.customerName || '',
        `"${String(l.productName || '').replace(/"/g, '""')}"`,
        `"${String(l.saleMode || '').replace(/"/g, '""')}"`,
        l.quantity ?? 1,
        l.stockAfter ?? '',
        Number(l.costPrice || 0).toFixed(2),
        Number(l.originalUnitPrice || 0).toFixed(2),
        Number(l.newUnitPrice || 0).toFixed(2),
        Number(l.newLineTotal || 0).toFixed(2),
        Number(l.netProfitOnLine || 0).toFixed(2),
        l.category || ''
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gherbi_Owner_Radar_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('📊 تم تصدير تقرير رادار رقابة صاحب المحل بنجاح!', 'success');
    },

    printOwnerRadarThermal80mm() {
      const logs = window.GherbiV9Engine ? window.GherbiV9Engine.getRadarLogs() : [];
      if (!logs.length) {
        if (window.showToast) window.showToast('ℹ️ السجل الرقابي فارغ حالياً', 'info');
        return;
      }

      const rowsHtml = logs.slice(0, 40).map((l) => `
        <tr>
          <td style="padding:3px 2px;border-bottom:1px dashed #ccc;">${l.productName}</td>
          <td style="padding:3px 2px;border-bottom:1px dashed #ccc;text-align:center;">${l.quantity}</td>
          <td style="padding:3px 2px;border-bottom:1px dashed #ccc;text-align:center;">${Number(l.originalUnitPrice || 0).toFixed(0)}⬅${Number(l.newUnitPrice || 0).toFixed(0)}</td>
          <td style="padding:3px 2px;border-bottom:1px dashed #ccc;text-align:left;">${l.category === 'voided_line' ? 'حذف' : Number(l.newLineTotal || 0).toFixed(0)}</td>
        </tr>
      `).join('');

      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { width: 72mm; margin: 0 auto; padding: 3mm; font-family: 'Cairo', Tahoma, sans-serif; font-size: 11px; color: #000; }
    h3 { text-align: center; margin: 0 0 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 6px; }
    th { border-bottom: 1.5px solid #000; padding: 3px 2px; text-align: right; }
  </style>
</head>
<body>
  <h3>🛡️ تقرير رادار رقابة صاحب المحل</h3>
  <div style="text-align:center;font-size:10px;border-bottom:1px solid #000;padding-bottom:4px;">التاريخ: ${new Date().toLocaleString('fr-DZ')} | العمليات: ${logs.length}</div>
  <table>
    <thead>
      <tr><th>الصنف</th><th style="text-align:center;">ك</th><th style="text-align:center;">السعر</th><th style="text-align:left;">إجمالي</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

      window.api?.printSilent?.({ html, silent: false });
    },

    injectExportAndPrintButtonsIntoOwnerRadar() {
      setInterval(() => {
        const radarEl = document.getElementById('v9OwnerPriceSurveillanceRadar');
        if (!radarEl) return;
        const clearBtn = radarEl.querySelector('button[onclick*="clearRadarLogs"]');
        if (!clearBtn || radarEl.querySelector('#v17RadarExportCsvBtn')) return;

        const parentDiv = clearBtn.parentElement;
        parentDiv.className = 'flex flex-wrap items-center gap-1.5';

        const csvBtn = document.createElement('button');
        csvBtn.id = 'v17RadarExportCsvBtn';
        csvBtn.type = 'button';
        csvBtn.className = 'px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white font-black text-xs transition';
        csvBtn.innerHTML = '📊 تصدير Excel/CSV';
        csvBtn.onclick = () => this.exportOwnerRadarToCsv();

        const printBtn = document.createElement('button');
        printBtn.type = 'button';
        printBtn.className = 'px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-black text-xs transition';
        printBtn.innerHTML = '🖨️ طباعة التقرير (80mm)';
        printBtn.onclick = () => this.printOwnerRadarThermal80mm();

        parentDiv.insertBefore(csvBtn, clearBtn);
        parentDiv.insertBefore(printBtn, clearBtn);
      }, 600);
    }
  };

  window.GherbiV17Excellence = V17Excellence;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V17Excellence.init());
  } else {
    V17Excellence.init();
  }
})();

/* [V29_PURE_RETAIL_PACK_GUARD] */
(function enforcePureRetailWithPackEngine() {
  function applyRetailLabels() {
    try {
      if (window.App && typeof window.App.setCartPriceTier === 'function' && !window.App._v29RetailTierLocked) {
        window.App._v29RetailTierLocked = true;
        window.App.setCartPriceTier = function () {
          const sel = document.getElementById('posPriceTierSelect');
          if (sel) sel.value = 'retail';
          const c = typeof window.App.getCurrentCart === 'function' ? window.App.getCurrentCart() : null;
          if (c) c.priceTier = 'retail';
          return 'retail';
        };
      }
      const custTier = document.getElementById('custPriceTierInput');
      if (custTier) custTier.value = 'retail';
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyRetailLabels);
  } else {
    applyRetailLabels();
  }
})();
