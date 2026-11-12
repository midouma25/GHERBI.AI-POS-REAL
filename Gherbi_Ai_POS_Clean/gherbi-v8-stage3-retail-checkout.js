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
