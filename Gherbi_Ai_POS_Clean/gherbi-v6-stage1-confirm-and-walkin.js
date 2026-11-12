/**
 * gherbi-v6-stage1-confirm-and-walkin.js (Clean & Syntax-Verified V8 Edition)
 * - نافذة احترافية غير حاجزة عند حذف السلة تضم:
 *   1) زر "⏸️ إضافتها إلى المسودات (F2)"
 *   2) زر "🗑️ تأكيد الحذف النهائي (Enter)"
 *   3) زر "إلغاء (Esc)"
 * - منع ظهور نافذة window.confirm الأصلية نهائياً وعدم تجميد الكيبورد
 * - الحفاظ على السلة النشطة عند التنقل بين الصفحات، والبدء بسلة جديدة على الزبون العابر عند تشغيل البرنامج فقط
 */

'use strict';

(function initGherbiV6Stage1Clean() {
  const V6Stage1 = {
    pendingDeleteCartIdx: null,
    lastDeletedCartBackup: null,
    undoToastTimer: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.buildProCartConfirmModal();
        this.interceptAllCartCloseActions();
        this.setupBootWalkInWithoutClearingOnTabSwitch();
        this.bindAltNumberCartSwitching();
        console.log('✅ [Gherbi V6 Stage 1 Fixed]: نافذة حذف السلة الاحترافية (نقل للمسودات / حذف نهائي) نشطة 100%.');
      }, 160);
    },

    // ========================================================================
    // 1. بناء نافذة حذف السلة الاحترافية (إضافتها للمسودات | تأكيد الحذف النهائي)
    // ========================================================================
    buildProCartConfirmModal() {
      const existing = document.getElementById('gherbiProCartConfirmModal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'gherbiProCartConfirmModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content w-full max-w-lg p-0 overflow-hidden rounded-2xl border-2 border-rose-500/60 shadow-2xl bg-white dark:bg-slate-900 text-xs">
          <!-- الهيدر -->
          <div class="px-5 py-3.5 bg-gradient-to-l from-slate-900 via-rose-950 to-slate-900 text-white flex items-center justify-between border-b border-rose-500/30">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
                <span class="material-symbols-rounded icon-sm">shopping_cart_off</span>
              </div>
              <div>
                <h3 id="proCartConfirmTitle" class="text-sm font-black text-white">إغلاق أو حذف السلة</h3>
                <p class="text-[10.5px] text-rose-300 font-bold">اختر إضافتها إلى المسودات للرجوع إليها لاحقاً أو تأكيد حذفها النهائي</p>
              </div>
            </div>
            <button type="button" onclick="GherbiV6Stage1.closeProCartConfirm()"
              class="w-7 h-7 rounded-full bg-white/10 hover:bg-rose-600 text-white font-black flex items-center justify-center transition">✕</button>
          </div>

          <div class="p-5 space-y-4">
            <!-- تفاصيل السلة -->
            <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <span class="text-2xl leading-none">🛒</span>
              <div class="space-y-1 flex-1">
                <div id="proCartConfirmMessage" class="font-black text-sm text-slate-800 dark:text-slate-100">
                  هذه السلة تحتوي على أصناف. ماذا تريد أن تفعل بها؟
                </div>
                <div id="proCartConfirmSubDetails" class="text-[11px] font-bold text-slate-500 dark:text-slate-400"></div>
              </div>
            </div>

            <!-- الأزرار الثلاثة الواضحة: إلغاء | إضافتها إلى المسودات (F2) | تأكيد الحذف النهائي (Enter) -->
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="GherbiV6Stage1.closeProCartConfirm()"
                class="sm:col-span-3 py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-black text-xs transition">
                إلغاء (Esc)
              </button>

              <button type="button" onclick="GherbiV6Stage1.moveCartToDraftsInstead()"
                class="sm:col-span-4 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition">
                <span>⏸️</span>
                <span>إضافتها للمسودات (F2)</span>
              </button>

              <button type="button" id="proCartConfirmYesBtn" onclick="GherbiV6Stage1.executeConfirmedCartDelete()"
                class="sm:col-span-5 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition">
                <span class="material-symbols-rounded icon-sm">delete_forever</span>
                <span>تأكيد الحذف النهائي (Enter)</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // اختصارات الكيبورد داخل النافذة الاحترافية (Enter = حذف نهائي | F2 = إضافة للمسودات | Esc = إلغاء)
      window.addEventListener(
        'keydown',
        (e) => {
          const m = document.getElementById('gherbiProCartConfirmModal');
          if (!m || !m.classList.contains('active')) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            this.executeConfirmedCartDelete();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.closeProCartConfirm();
          } else if (e.key === 'F2') {
            e.preventDefault();
            e.stopPropagation();
            this.moveCartToDraftsInstead();
          }
        },
        true
      );
    },

    restorePosKeyboardFocus() {
      setTimeout(() => {
        window.focus();
        if (typeof window.App?.focusBarcodeMagnet === 'function') {
          window.App.focusBarcodeMagnet(true);
        } else {
          document.getElementById('barcodeInput')?.focus();
        }
      }, 40);
    },

    openProCartConfirm(idx) {
      if (!document.getElementById('gherbiProCartConfirmModal')) {
        this.buildProCartConfirmModal();
      }
      const carts = window.AppState?.carts || [];
      const targetIdx = idx !== undefined && idx !== null ? Number(idx) : Number(window.AppState?.activeCartIndex || 0);
      const target = carts[targetIdx];
      if (!target) return;

      this.pendingDeleteCartIdx = targetIdx;
      const items = target.items || [];
      const totalDzd = items.reduce(
        (s, it) => s + Number(it.subtotal ?? Number(it.quantity || 1) * Number(it.price || 0)),
        0
      );
      const previewNames = items
        .slice(0, 3)
        .map((it) => it.name || it.custom_product_name || 'صنف')
        .join(' ، ');

      const cartLabel = target.label || `سلة #${targetIdx + 1}`;
      const titleEl = document.getElementById('proCartConfirmTitle');
      const msgEl = document.getElementById('proCartConfirmMessage');
      const subEl = document.getElementById('proCartConfirmSubDetails');

      if (titleEl) titleEl.textContent = `إغلاق أو حذف (${cartLabel})`;
      if (msgEl) {
        msgEl.textContent = `السلة (${cartLabel}) تحتوي على ${items.length} أصناف بإجمالي ${totalDzd.toFixed(2)} د.ج. هل تريد إضافتها للمسودات أم حذفها نهائياً؟`;
      }
      if (subEl) {
        subEl.textContent = `🛒 الأصناف: ${previewNames}${items.length > 3 ? ' ...' : ''}`;
      }

      window.App.openModal('gherbiProCartConfirmModal');
      setTimeout(() => document.getElementById('proCartConfirmYesBtn')?.focus(), 50);
    },

    closeProCartConfirm() {
      this.pendingDeleteCartIdx = null;
      window.App.closeModal('gherbiProCartConfirmModal');
      this.restorePosKeyboardFocus();
    },

    // الخيار 1: إضافة السلة إلى المسودات (F2) وإغلاق/تفريغ التبويب
    moveCartToDraftsInstead() {
      const idx = this.pendingDeleteCartIdx;
      this.closeProCartConfirm();
      if (idx === null || idx === undefined) return;

      const carts = window.AppState?.carts || [];
      const target = carts[idx];
      if (!target || !Array.isArray(target.items) || target.items.length === 0) return;

      // التبديل إلى السلة المراد تعليقها واستدعاء holdCurrentCart الرسمي
      window.AppState.activeCartIndex = idx;
      if (typeof window.App?.holdCurrentCart === 'function') {
        window.App.holdCurrentCart();
      } else {
        if (!Array.isArray(window.AppState.draftCarts)) window.AppState.draftCarts = [];
        window.AppState.draftCarts.unshift({
          ...JSON.parse(JSON.stringify(target)),
          savedAt: new Date().toLocaleTimeString('ar-DZ')
        });
      }

      // إذا كان هناك أكثر من سلة مفتوحة، نغلق التبويب الذي أصبح فارغاً بعد نقله للمسودات
      if (carts.length > 1 && (!carts[idx]?.items || carts[idx].items.length === 0)) {
        carts.splice(idx, 1);
        carts.forEach((c, i) => {
          c.label = `سلة #${i + 1}`;
        });
        window.AppState.activeCartIndex = Math.max(0, Math.min(window.AppState.activeCartIndex || 0, carts.length - 1));
      }

      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      if (window.showToast) {
        window.showToast('⏸️ تمت إضافة السلة إلى المسودات (F3) بنجاح!', 'success');
      }
      this.restorePosKeyboardFocus();
    },

    // الخيار 2: تأكيد الحذف النهائي للسلة
    executeConfirmedCartDelete() {
      const idx = this.pendingDeleteCartIdx;
      this.closeProCartConfirm();
      if (idx === null || idx === undefined) return;
      this.performSilentCartDelete(idx);
    },

    performSilentCartDelete(idx) {
      const carts = window.AppState?.carts || [];
      const target = carts[idx];
      if (!target) return;

      if (Array.isArray(target.items) && target.items.length > 0) {
        this.lastDeletedCartBackup = JSON.parse(JSON.stringify(target));
        this.showUndoDeletedCartBanner(target.label || `سلة #${idx + 1}`, target.items.length);
      }

      if (carts.length <= 1) {
        carts[0] = {
          id: 'cart_' + Date.now(),
          label: 'سلة #1',
          items: [],
          customerId: '',
          priceTier: 'retail',
          discount: 0,
          _redeemedPoints: 0
        };
        window.AppState.activeCartIndex = 0;
      } else {
        carts.splice(idx, 1);
        carts.forEach((c, i) => {
          c.label = `سلة #${i + 1}`;
        });
        if (window.AppState.activeCartIndex >= carts.length) {
          window.AppState.activeCartIndex = Math.max(0, carts.length - 1);
        }
      }

      const activeCart = carts[window.AppState.activeCartIndex || 0];
      if (activeCart && (!activeCart.items || activeCart.items.length === 0)) {
        activeCart.customerId = '';
        activeCart.discount = 0;
        activeCart._redeemedPoints = 0;
        const sel = document.getElementById('posCustomerSelect');
        if (sel) sel.value = '';
      }

      localStorage.removeItem('gherbi_crash_recovery_carts');
      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      this.restorePosKeyboardFocus();
    },

    showUndoDeletedCartBanner(label, count) {
      let toast = document.getElementById('gherbiUndoCartToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'gherbiUndoCartToast';
        toast.className = 'gherbi-undo-cart-toast';
        document.body.appendChild(toast);
      }
      toast.classList.remove('hidden');
      toast.innerHTML = `
        <span>🗑️ تم الحذف النهائي لـ (${label}) وبها ${count} أصناف</span>
        <button type="button" onclick="GherbiV6Stage1.restoreLastDeletedCart()"
          class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">
          ↩️ تراجع واسترجاع السلة
        </button>
        <button type="button" onclick="document.getElementById('gherbiUndoCartToast').classList.add('hidden')" class="text-slate-400 hover:text-white">✕</button>
      `;

      if (this.undoToastTimer) clearTimeout(this.undoToastTimer);
      this.undoToastTimer = setTimeout(() => {
        toast?.classList.add('hidden');
      }, 8000);
    },

    restoreLastDeletedCart() {
      if (!this.lastDeletedCartBackup) return;
      const carts = window.AppState?.carts || [];
      const restored = JSON.parse(JSON.stringify(this.lastDeletedCartBackup));
      this.lastDeletedCartBackup = null;
      document.getElementById('gherbiUndoCartToast')?.classList.add('hidden');

      const cur = window.App.currentCart;
      if (cur && (!cur.items || cur.items.length === 0)) {
        carts[window.AppState.activeCartIndex || 0] = restored;
      } else {
        carts.push(restored);
        window.AppState.activeCartIndex = carts.length - 1;
      }
      carts.forEach((c, i) => {
        c.label = `سلة #${i + 1}`;
      });

      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      if (window.showToast) window.showToast('✅ تمت استعادة السلة المحذوفة بكامل أصنافها!', 'success');
      this.restorePosKeyboardFocus();
    },

    // ========================================================================
    // 2. اعتراض ثلاثي الطبقات لمنع ظهور نافذة window.confirm الأصلية نهائياً
    // ========================================================================
    interceptAllCartCloseActions() {
      const handleCloseCartIndex = (idx, event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        const carts = window.AppState?.carts || [];
        const target = carts[idx];
        if (!target) return;

        if (Array.isArray(target.items) && target.items.length > 0) {
          this.openProCartConfirm(idx);
        } else {
          this.performSilentCartDelete(idx);
        }
      };

      // الطبقة 1: اعتراض النقر على أي زر ✕ داخل تبويبات السلات في مرحلة Capture قبل وصوله لأي كود قديم
      document.addEventListener(
        'click',
        (e) => {
          const closeEl = e.target.closest(
            '[onclick*="closeCartTab"], [onclick*="deleteOrClearCartTab"], [onclick*="removeOrClearCartTab"], .gherbi-cart-tab-close'
          );
          if (!closeEl) return;
          const onclickStr = closeEl.getAttribute('onclick') || '';
          const match = onclickStr.match(/(?:closeCartTab|deleteOrClearCartTab|removeOrClearCartTab)\s*\(\s*(\d+)/);
          if (match && match[1] !== undefined) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            handleCloseCartIndex(parseInt(match[1], 10), e);
          }
        },
        true
      );

      // الطبقة 2: استبدال الدوال البرمجية مباشرة
      const enforceMethodOverrides = () => {
        if (window.App) {
          window.App.closeCartTab = handleCloseCartIndex;
        }
        if (window.GherbiMasterUpgrade) {
          window.GherbiMasterUpgrade.deleteOrClearCartTab = handleCloseCartIndex;
        }
        if (window.GherbiMasterUpgrades) {
          window.GherbiMasterUpgrades.removeOrClearCartTab = handleCloseCartIndex;
        }
      };
      enforceMethodOverrides();
      setInterval(enforceMethodOverrides, 500);

      // الطبقة 3: درع حماية على window.confirm لمنع نافذة "هل تريد حذفها وإغلاقها؟" حتى لو استُدعيت من داخل دالة مغلقة
      if (!window._gherbiConfirmShielded) {
        const nativeConfirm = window.confirm.bind(window);
        window.confirm = function (message) {
          const msgStr = String(message || '');
          if (msgStr.includes('حذفها وإغلاقها') || (msgStr.includes('السلة') && msgStr.includes('أصناف'))) {
            const matchIdx = msgStr.match(/#(\d+)/);
            const targetIdx = matchIdx && matchIdx[1] ? parseInt(matchIdx[1], 10) - 1 : (window.AppState?.activeCartIndex || 0);
            setTimeout(() => V6Stage1.openProCartConfirm(targetIdx), 10);
            return false;
          }
          return nativeConfirm(message);
        };
        window._gherbiConfirmShielded = true;
      }

      // ضمان أن إنشاء سلة جديدة (+ سلة / Ctrl+N) يبدأ دائماً بالزبون العابر
      window.App.newCartTab = () => {
        const carts = window.AppState?.carts || [];
        carts.push({
          id: 'cart_' + Date.now(),
          label: `سلة #${carts.length + 1}`,
          items: [],
          customerId: '',
          priceTier: 'retail',
          discount: 0,
          _redeemedPoints: 0
        });
        window.AppState.activeCartIndex = carts.length - 1;
        const sel = document.getElementById('posCustomerSelect');
        if (sel) sel.value = '';
        window.App.renderPosView?.();
        window.App.renderCartTabs?.();
        window.App.renderCartItems?.();
        window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
        this.restorePosKeyboardFocus();
      };
    },

    // ========================================================================
    // 3. البدء بسلة نظيفة وزبون عابر عند إقلاع البرنامج فقط، مع الحفاظ على السلة عند التنقل
    // ========================================================================
    forceWalkInOnCart(cartObj) {
      if (!cartObj) return;
      cartObj.customerId = '';
      cartObj.discount = 0;
      cartObj._redeemedPoints = 0;
      delete cartObj._isGherbiEditedSale;
      delete cartObj._oldSaleEarnedPoints;
      delete cartObj._strictHistoryEditActive;
      delete cartObj.editingSaleId;

      const sel = document.getElementById('posCustomerSelect');
      if (sel) sel.value = '';
      const discInp = document.getElementById('cartDiscountInput');
      if (discInp) discInp.value = '0';
      const cashInp = document.getElementById('gherbiReceivedCashInput');
      if (cashInp) cashInp.value = '';

      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
    },

    openFreshWalkInCartOnPosEntry(isInitialBoot = false) {
      if (!isInitialBoot) {
        // عند التنقل بين الصفحات والعودة لشاشة المبيعات: لا نفتح سلة جديدة بل نحافظ على السلة الحالية كما هي!
        this.restorePosKeyboardFocus();
        return;
      }

      localStorage.removeItem('gherbi_crash_recovery_carts');
      window.AppState.carts = [
        {
          id: 'cart_' + Date.now(),
          label: 'سلة #1',
          items: [],
          customerId: '',
          priceTier: 'retail',
          discount: 0,
          _redeemedPoints: 0
        }
      ];
      window.AppState.activeCartIndex = 0;
      this.forceWalkInOnCart(window.AppState.carts[0]);

      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      this.restorePosKeyboardFocus();
    },

    setupBootWalkInWithoutClearingOnTabSwitch() {
      setTimeout(() => {
        this.openFreshWalkInCartOnPosEntry(true);
      }, 320);
    },

    bindAltNumberCartSwitching() {
      window.addEventListener('keydown', (e) => {
        const posSec = document.getElementById('view-pos');
        if (!posSec || !posSec.classList.contains('active')) return;
        if (e.altKey && /^[1-9]$/.test(e.key)) {
          const targetIdx = parseInt(e.key, 10) - 1;
          const carts = window.AppState?.carts || [];
          if (carts[targetIdx]) {
            e.preventDefault();
            window.App.switchCartTab?.(targetIdx);
          }
        }
      });
    }
  };

  window.GherbiV6Stage1 = V6Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V6Stage1.init());
  } else {
    V6Stage1.init();
  }
})();
