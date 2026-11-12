/**
 * gherbi-v5-stage1-walkin-and-edit.js
 * المحرك التنفيذي للشطر الأول (الإصدار 5):
 * - منع ظهور شريط "تعديل فاتورة سابقة" في المبيعات العادية، وحصره في التعديل الحقيقي من السجل فقط
 * - إرجاع الزبون تلقائياً إلى "زبون عابر" بعد كل عملية بيع وتصفير النقاط المختزلة
 */

'use strict';

(function initGherbiV5Stage1() {
  const V5Stage1 = {
    lastSoldCustomerId: null,
    lastSoldCustomerName: '',
    quickRelinkTimer: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.fixStrictEditBannerLogic();
        this.setupAutoResetToWalkInAfterSale();
        console.log('🚀 [Gherbi V5 - Stage 1]: تم تفعيل ضبط شريط التعديل والإرجاع التلقائي للزبون العابر.');
      }, 180);
    },

    // ========================================================================
    // 1. حصر شريط "تعديل فاتورة سابقة" في حالة التعديل الفعلي فقط
    // ========================================================================
    isStrictlyEditingPreviousSale() {
      const cart = window.App?.currentCart;
      if (!cart) return false;

      const explicitSaleId = Number(cart.editingSaleId || window.AppState?.editingSaleId || 0);
      const editBannerEl = document.getElementById('posEditSaleBanner');
      const isOrigBannerVisible = Boolean(
        editBannerEl &&
        !editBannerEl.classList.contains('hidden') &&
        editBannerEl.offsetParent !== null
      );

      return explicitSaleId > 0 || isOrigBannerVisible || Boolean(cart._strictHistoryEditActive);
    },

    fixStrictEditBannerLogic() {
      // مسح أي حالة تعديل وهمية عالقة من الجلسة السابقة عند الإقلاع
      if (window.GherbiStage12Enforcer) {
        window.GherbiStage12Enforcer.editSnapshot = null;
      }
      if (window.App?.currentCart && !window.App.currentCart.editingSaleId && !window.AppState?.editingSaleId) {
        delete window.App.currentCart._isGherbiEditedSale;
        delete window.App.currentCart._oldSaleEarnedPoints;
        delete window.App.currentCart._strictHistoryEditActive;
      }
      document.getElementById('gherbiLiveDeltaLoyaltyBanner')?.classList.add('hidden');

      if (window.GherbiStage12Enforcer) {
        // استبدال دالة تحديث الشريط لتفحص التعديل الحقيقي فقط
        window.GherbiStage12Enforcer.updateLiveEditDeltaBanner = () => {
          const banner = document.getElementById('gherbiLiveDeltaLoyaltyBanner');
          const cart = window.App?.currentCart;

          if (!this.isStrictlyEditingPreviousSale() || !cart || !Array.isArray(cart.items) || cart.items.length === 0) {
            if (banner) banner.classList.add('hidden');
            return;
          }

          const snap = window.GherbiStage12Enforcer.editSnapshot;
          if (!snap || !snap.active) return;

          const topDeck = document.getElementById('gherbiCartTopDeck');
          if (!topDeck) return;

          let activeBanner = banner;
          if (!activeBanner) {
            activeBanner = document.createElement('div');
            activeBanner.id = 'gherbiLiveDeltaLoyaltyBanner';
            activeBanner.className = 'gherbi-delta-loyalty-banner';
            topDeck.insertBefore(activeBanner, topDeck.firstChild);
          }

          const oldPts = Number(snap.oldSaleEarnedPoints || 0);
          const newPts = window.GherbiStage12Enforcer.calcEligiblePoints(cart.items, cart.discount || 0);
          const delta = newPts - oldPts;
          const deltaStr = delta > 0 ? `+${delta} نقطة إضافية` : delta < 0 ? `${delta} نقطة (خصم ما حُذف)` : '0 نقطة (بدون تغيير)';
          const badgeColor = delta > 0 ? 'bg-emerald-500 text-slate-950' : delta < 0 ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-200';

          activeBanner.classList.remove('hidden');
          activeBanner.innerHTML = `
            <div class="flex items-center gap-1.5">
              <span>👑 تعديل فاتورة سابقة (#${snap.saleId || ''}):</span>
              <span>نقاطها السابقة (<strong class="font-mono text-amber-300">${oldPts}</strong>)</span>
              <span>⬅</span>
              <span>الآن (<strong class="font-mono text-emerald-300">${newPts}</strong>)</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="px-2 py-0.5 rounded font-mono font-black ${badgeColor}">الصافي: ${deltaStr}</span>
              <button type="button" onclick="GherbiV5Stage1.cancelEditModeBanner()" title="إلغاء وضع التعديل" class="text-slate-300 hover:text-rose-400 px-1 font-black">✕</button>
            </div>
          `;
        };

        window.GherbiStage12Enforcer.captureEditedSaleSnapshotNow = (saleIdHint = null) => {
          setTimeout(() => {
            const cart = window.App?.currentCart;
            if (!cart) return;
            const realSaleId = saleIdHint || cart.editingSaleId || window.AppState?.editingSaleId;
            if (!realSaleId && !cart._strictHistoryEditActive) return;

            const cid = Number(cart.customerId || document.getElementById('posCustomerSelect')?.value || 0);
            const cust = cid ? (window.AppState.customers || []).find((c) => Number(c.id) === cid) : null;
            const curPts = cust ? Number(cust.loyalty_points || 0) : 0;
            const oldPts = window.GherbiStage12Enforcer.calcEligiblePoints(cart.items || [], cart.discount || 0);

            window.GherbiStage12Enforcer.editSnapshot = {
              active: true,
              saleId: realSaleId || 'تعديل',
              customerId: cid,
              customerBalanceBeforeEdit: curPts,
              oldSaleEarnedPoints: oldPts,
              capturedAt: Date.now()
            };
            cart._isGherbiEditedSale = true;
            cart._oldSaleEarnedPoints = oldPts;
            window.GherbiStage12Enforcer.updateLiveEditDeltaBanner();
          }, 180);
        };
      }

      // تفعيل علامة _strictHistoryEditActive فقط عند النقر على زر "تعديل" داخل سجل المبيعات
      document.addEventListener(
        'click',
        (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const txt = (btn.textContent || '').trim();
          const onclickStr = btn.getAttribute('onclick') || '';
          const inHistory = btn.closest('#view-sales, #posRecentSalesModal, #recentSalesModal');
          if (inHistory && (txt.includes('تعديل') || /edit/i.test(onclickStr))) {
            setTimeout(() => {
              if (window.App?.currentCart) {
                window.App.currentCart._strictHistoryEditActive = true;
                window.GherbiStage12Enforcer?.captureEditedSaleSnapshotNow();
              }
            }, 120);
          }
        },
        true
      );
    },

    cancelEditModeBanner() {
      if (window.GherbiStage12Enforcer) {
        window.GherbiStage12Enforcer.editSnapshot = null;
      }
      if (window.App?.currentCart) {
        delete window.App.currentCart._isGherbiEditedSale;
        delete window.App.currentCart._oldSaleEarnedPoints;
        delete window.App.currentCart._strictHistoryEditActive;
        delete window.App.currentCart.editingSaleId;
      }
      if (window.AppState) {
        window.AppState.editingSaleId = null;
      }
      document.getElementById('gherbiLiveDeltaLoyaltyBanner')?.classList.add('hidden');
      document.getElementById('posEditSaleBanner')?.classList.add('hidden');
    },

    // ========================================================================
    // 2. الإرجاع التلقائي للزبون العابر بعد كل عملية بيع أو إلغاء أو تعليق
    // ========================================================================
    resetActiveCartToWalkInCustomer(previousCustId = null) {
      const cart = window.App?.currentCart;
      if (previousCustId) {
        const prevCust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(previousCustId));
        if (prevCust) {
          this.lastSoldCustomerId = prevCust.id;
          this.lastSoldCustomerName = prevCust.name;
          this.showQuickRelinkCustomerChip();
        }
      }

      if (cart) {
        cart.customerId = '';
        cart.discount = 0;
        cart._redeemedPoints = 0;
        cart.couponCode = '';
        cart.couponDiscount = 0;
        delete cart._isGherbiEditedSale;
        delete cart._oldSaleEarnedPoints;
        delete cart._strictHistoryEditActive;
        delete cart.editingSaleId;
      }

      if (window.AppState) {
        window.AppState.editingSaleId = null;
      }

      const custSelect = document.getElementById('posCustomerSelect');
      if (custSelect) {
        custSelect.value = '';
        custSelect.dispatchEvent(new Event('change'));
      }

      const discInp = document.getElementById('cartDiscountInput');
      if (discInp) discInp.value = '0';

      const redeemInp = document.getElementById('smartRedeemPointsInput');
      if (redeemInp) redeemInp.value = '0';

      const cashInp = document.getElementById('gherbiReceivedCashInput');
      if (cashInp) cashInp.value = '';

      this.cancelEditModeBanner();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      window.GherbiV4Stage1?.computeChangeInstant(0);
      window.GherbiStage12Enforcer?.updateChangeInstant(0);
      window.App?.recalcAndRenderCart?.();
    },

    showQuickRelinkCustomerChip() {
      if (!this.lastSoldCustomerId) return;
      const topDeck = document.getElementById('gherbiCartTopDeck');
      if (!topDeck) return;

      let chip = document.getElementById('gherbiQuickRelinkPrevCustBtn');
      if (!chip) {
        chip = document.createElement('button');
        chip.id = 'gherbiQuickRelinkPrevCustBtn';
        chip.type = 'button';
        chip.className = 'w-full py-1 px-2.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-500/30 text-[10.5px] font-black flex items-center justify-between transition';
        topDeck.appendChild(chip);
      }

      chip.classList.remove('hidden');
      chip.innerHTML = `
        <span>👤 عادت السلة إلى (زبون عابر) تلقائياً</span>
        <span class="underline">↩️ إعادة اختيار (${this.lastSoldCustomerName})؟</span>
      `;
      chip.onclick = () => {
        if (window.RetailMaster && this.lastSoldCustomerId) {
          window.RetailMaster.pickCustomerInSmartModal(this.lastSoldCustomerId);
          chip.classList.add('hidden');
          if (window.showToast) window.showToast(`👑 تمت إعادة ربط السلة بالزبون: ${this.lastSoldCustomerName}`, 'info');
        }
      };

      if (this.quickRelinkTimer) clearTimeout(this.quickRelinkTimer);
      this.quickRelinkTimer = setTimeout(() => {
        chip?.classList.add('hidden');
      }, 15000);
    },

    setupAutoResetToWalkInAfterSale() {
      // اعتراض إتمام البيع (سواء بنافذة التسديد F1 أو التذكرة الفورية Echap أو الحفظ بدون طباعة)
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (!origFn || window.App['_v5WalkInReset_' + fnName]) return;

        window.App[fnName] = async function (...args) {
          const prevCid = window.App.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value || null;
          const res = await origFn(...args);

          // إذا تمت البيعة بنجاح وأصبحت السلة فارغة، نرجع الزبون فوراً إلى "زبون عابر"
          setTimeout(() => {
            const remainingItems = window.App.currentCart?.items || [];
            if (remainingItems.length === 0) {
              V5Stage1.resetActiveCartToWalkInCustomer(prevCid);
            }
          }, 120);

          return res;
        };
        window.App['_v5WalkInReset_' + fnName] = true;
      });

      // اعتراض إلغاء السلة (F4) وتعليق المسودة (F2) لإرجاع الزبون العابر أيضاً
      ['clearCurrentCart', 'holdCurrentCart'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (!origFn || window.App['_v5WalkInClear_' + fnName]) return;

        window.App[fnName] = function (...args) {
          const res = origFn(...args);
          setTimeout(() => {
            V5Stage1.resetActiveCartToWalkInCustomer(null);
          }, 60);
          return res;
        };
        window.App['_v5WalkInClear_' + fnName] = true;
      });
    }
  };

  window.GherbiV5Stage1 = V5Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V5Stage1.init());
  } else {
    V5Stage1.init();
  }
})();
