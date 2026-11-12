/**
 * gherbi-v4-clean-stage1.js
 * الشطر الأول (المحاور 1 + 2 + 3)
 */

'use strict';

(function initGherbiV4CleanStage1() {
  const Stage1 = {
    init() {
      const timer = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(timer);
        this.injectStage1Modals();
        this.setupManagerPinAndAuditDeduplication();
        this.unifyQuickTouchF7Strip();
        this.setupZeroClickLiveChange();
        console.log('🚀 [Stage 1 Active]: PIN Modal + Unified F7 Strip + Instant Change Ready.');
      }, 180);
    },

    // ========================================================================
    // المحور 1: نافذة تغيير كود المدير السري (PIN) بدون prompt() + منع تكرار السجل
    // ========================================================================
    injectStage1Modals() {
      if (!document.getElementById('changeManagerPinModal')) {
        const pinModal = document.createElement('div');
        pinModal.id = 'changeManagerPinModal';
        pinModal.className = 'modal-overlay';
        pinModal.innerHTML = `
          <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border-2 border-amber-500 shadow-2xl text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">🔑</span>
                <div>
                  <h3 class="text-sm font-black text-amber-600 dark:text-amber-400">تغيير كود المدير السري (Manager PIN)</h3>
                  <p class="text-[10.5px] text-slate-400">يُستخدم هذا الكود لتصريح تعديل نقاط الولاء والعمليات الحساسة</p>
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
                <input id="v4PinConfirmInp" type="password" placeholder="أعد إدخال الكود الجديد..."
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
        document.body.appendChild(pinModal);
      }
    },

    getManagerPin() {
      return String(
        window.AppState?.settings?.manager_loyalty_pin ||
        localStorage.getItem('gherbi_manager_loyalty_pin') ||
        '1234'
      ).trim();
    },

    openChangePinModal() {
      this.injectStage1Modals();
      document.getElementById('v4PinCurrentInp').value = '';
      document.getElementById('v4PinNewInp').value = '';
      document.getElementById('v4PinConfirmInp').value = '';
      window.App.openModal('changeManagerPinModal');
      setTimeout(() => document.getElementById('v4PinCurrentInp')?.focus(), 60);
    },

    saveManagerPin() {
      const curPin = this.getManagerPin();
      const oldVal = String(document.getElementById('v4PinCurrentInp')?.value || '').trim();
      const newVal = String(document.getElementById('v4PinNewInp')?.value || '').trim();
      const confVal = String(document.getElementById('v4PinConfirmInp')?.value || '').trim();

      if (oldVal !== curPin) {
        if (window.showToast) window.showToast('❌ الكود السري الحالي غير صحيح!', 'error');
        document.getElementById('v4PinCurrentInp')?.focus();
        return;
      }
      if (newVal.length < 3) {
        if (window.showToast) window.showToast('⚠️ يرجى إدخال كود سري جديد من 3 أرقام أو حروف على الأقل', 'warning');
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
      if (window.showToast) window.showToast('✅ تم تغيير كود المدير السري (PIN) وحفظه بنجاح!', 'success');
    },

    setupManagerPinAndAuditDeduplication() {
      if (window.RetailV3) {
        window.RetailV3.changeManagerLoyaltyPinPrompt = () => this.openChangePinModal();
        window.RetailV3.getManagerSecretPin = () => this.getManagerPin();

        // قفل لمنع إرسال سجل الرقابة أكثر من مرة عند الضغط على زر التأكيد
        const origConfirm = window.RetailV3.confirmManagerPinPointsChange?.bind(window.RetailV3);
        if (origConfirm && !window.RetailV3._v4Stage1PinLocked) {
          window.RetailV3.confirmManagerPinPointsChange = async function () {
            if (this._pinSubmitBusy) return;
            this._pinSubmitBusy = true;
            try {
              await origConfirm();
            } finally {
              setTimeout(() => { this._pinSubmitBusy = false; }, 1000);
            }
          };
          window.RetailV3._v4Stage1PinLocked = true;
        }
      }

      // تنظيف الصفوف المكررة في بطاقة سجل رقابة المدير داخل صفحة التقارير
      const cleanAuditCardRows = () => {
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
        let uniqueRows = 0;

        Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
          // بصمة الصف: المستخدم + الزبون + الرصيد السابق + الرصيد الجديد + الفارق + السبب
          const key = cells.slice(1).join('|');
          if (seen.has(key)) {
            tr.remove();
          } else {
            seen.add(key);
            uniqueRows++;
          }
        });

        const h3 = card.querySelector('h3');
        if (h3) {
          h3.textContent = `سجل رقابة المدير: تعديلات رصيد نقاط الوفاء (${uniqueRows})`;
        }
      };

      setInterval(cleanAuditCardRows, 600);
    },

    // ========================================================================
    // المحور 2: إزالة ازدواجية شريط اللمس السريع (F7) في شاشة المبيعات
    // ========================================================================
    unifyQuickTouchF7Strip() {
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
    // المحور 3: الحساب اللحظي الفوري لـ "الباقي للزبون" بدون ضغط وبدون حلقة لا نهائية
    // ========================================================================
    getCartTotalDirectly(forcedTotal) {
      if (forcedTotal !== undefined && forcedTotal !== null && !isNaN(Number(forcedTotal))) {
        return Number(forcedTotal);
      }
      // قراءة مباشرة من عناصر السلة دون استدعاء App.recalcCart() نهائياً
      try {
        const cart = window.App?.currentCart;
        if (cart && Array.isArray(cart.items)) {
          const subtotal = cart.items.reduce((sum, item) => {
            const q = Number(item.quantity ?? 1);
            const p = Number(item.price ?? 0);
            const line = item.subtotal !== undefined ? Number(item.subtotal) : (q * p);
            return sum + (isNaN(line) ? 0 : line);
          }, 0);
          const discount = Number(cart.discount ?? document.getElementById('cartDiscountInput')?.value ?? 0);
          const couponDisc = Number(cart.couponDiscount || 0);
          return Math.max(0, Number((subtotal - discount - couponDisc).toFixed(2)));
        }
      } catch (_) {}

      const domTxt = document.getElementById('cartTotalText')?.textContent || '0';
      return parseFloat(String(domTxt).replace(/[^\d.-]/g, '')) || 0;
    },

    computeChangeInstant(forcedTotal) {
      if (this._computingChange) return;
      this._computingChange = true;
      try {
        const inp = document.getElementById('gherbiReceivedCashInput');
        const resEl = document.getElementById('gherbiInlineChangeResult');
        const centEl = document.getElementById('gherbiInlineChangeCentimes');
        if (!inp || !resEl) return;

        const totalDue = this.getCartTotalDirectly(forcedTotal);
        const rawText = String(inp.value || '').trim();
        const received = parseFloat(rawText);

        if (!rawText || !Number.isFinite(received) || received <= 0) {
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
        this._computingChange = false;
      }
    },

    setupZeroClickLiveChange() {
      if (window.RetailV2) {
        window.RetailV2.recalcInlineChange = (forcedTotal) => this.computeChangeInstant(forcedTotal);
      }

      // التقاط فوري لأي كتابة في حقل المبلغ المستلم على مستوى الوثيقة
      ['input', 'keyup', 'keydown', 'change', 'paste'].forEach((evt) => {
        document.addEventListener(
          evt,
          (e) => {
            if (e.target && e.target.id === 'gherbiReceivedCashInput') {
              this.computeChangeInstant();
              requestAnimationFrame(() => this.computeChangeInstant());
            }
          },
          true
        );
      });

      // مراقب مباشر على نص الإجمالي المستحق (#cartTotalText)
      const bindTotalObs = () => {
        const totalEl = document.getElementById('cartTotalText');
        if (totalEl && !totalEl.dataset.v4LiveObs) {
          totalEl.dataset.v4LiveObs = '1';
          const obs = new MutationObserver(() => this.computeChangeInstant());
          obs.observe(totalEl, { childList: true, characterData: true, subtree: true });
        }
      };
      bindTotalObs();
      setInterval(bindTotalObs, 800);
    }
  };

  window.GherbiV4Stage1 = Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Stage1.init());
  } else {
    Stage1.init();
  }
})();
