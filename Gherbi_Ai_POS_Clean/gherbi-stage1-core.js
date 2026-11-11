
function getSafeCartTotalWithoutRecursion(forcedTotal) {
  if (forcedTotal !== undefined && forcedTotal !== null && !isNaN(Number(forcedTotal))) {
    return Number(forcedTotal);
  }
  // 1. حساب مباشر من مصفوفة السلة الحالية دون استدعاء recalcCart
  try {
    const cart = window.App && window.App.currentCart;
    if (cart && Array.isArray(cart.items)) {
      const sub = cart.items.reduce((acc, it) => {
        const q = Number(it.quantity ?? 1);
        const p = Number(it.price ?? 0);
        const line = it.subtotal !== undefined ? Number(it.subtotal) : (q * p);
        return acc + (isNaN(line) ? 0 : line);
      }, 0);
      const disc = Number(cart.discount || document.getElementById('cartDiscountInput')?.value || 0);
      return Math.max(0, Number((sub - disc).toFixed(2)));
    }
  } catch (_) {}
  // 2. قراءة احتياطية من النص الظاهر في الشاشة
  const txt = document.getElementById('cartTotalText')?.textContent || '0';
  return parseFloat(String(txt).replace(/[^\d.-]/g, '')) || 0;
}

function safeUpdateInlineChangeNow(forcedTotal) {
  if (window._gherbiChangeCalcBusy) return;
  window._gherbiChangeCalcBusy = true;
  try {
    const inp = document.getElementById('gherbiReceivedCashInput');
    const resEl = document.getElementById('gherbiInlineChangeResult');
    const centEl = document.getElementById('gherbiInlineChangeCentimes');
    if (!inp || !resEl) return;

    const totalDue = getSafeCartTotalWithoutRecursion(forcedTotal);
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
      resEl.textContent = diff.toFixed(2) + ' د.ج';
      resEl.className = 'font-mono font-black text-base text-emerald-600 dark:text-emerald-400';
      if (centEl) {
        const centStr = window.App?.formatAlgerianCentimes
          ? window.App.formatAlgerianCentimes(diff)
          : (Math.round(diff * 100).toLocaleString('fr-DZ') + ' سنتيم');
        centEl.textContent = '🇩🇿 الصرف بالتداول الجزائري: ' + centStr;
        centEl.classList.remove('hidden');
      }
    } else {
      const missing = Math.abs(diff);
      resEl.textContent = 'ناقص: ' + missing.toFixed(2) + ' د.ج';
      resEl.className = 'font-mono font-black text-sm text-rose-600';
      if (centEl) {
        centEl.textContent = '⚠️ المبلغ المستلم أقل من الإجمالي المستحق بـ ' + missing.toFixed(2) + ' د.ج';
        centEl.classList.remove('hidden');
      }
    }
  } finally {
    window._gherbiChangeCalcBusy = false;
  }
}

/**
 * gherbi-stage1-core.js
 * الشطر الأول: نافذة تغيير كود المدير + منع تكرار السجل + توحيد شريط F7 + حاسبة الصرف اللحظية
 */

'use strict';

(function initGherbiStage1() {
  const Stage1 = {
    _customPromptResolver: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        try { this.buildCustomModals(); } catch (e) { console.warn(e); }
        try { this.patchManagerPinAndDeduplicateLogs(); } catch (e) { console.warn(e); }
        try { this.unifyQuickTouchStrip(); } catch (e) { console.warn(e); }
        try { this.bindZeroClickLiveChangeCalculator(); } catch (e) { console.warn(e); }
        console.log('✅ [Stage 1 Ready]: تم تفعيل الشطر الأول بنجاح.');
      }, 200);
    },

    // أ. بناء النوافذ البديلة لـ window.prompt()
    buildCustomModals() {
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
                  <p class="text-[10.5px] text-slate-400">الكود الافتراضي هو 1234 — يُستخدم لحماية تعديل نقاط الوفاء</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="text-slate-400 hover:text-rose-500 font-black text-sm">✕</button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">1. الكود السري الحالي * :</label>
                <input id="s1PinCurrentInput" type="password" placeholder="أدخل الكود السري الحالي (الافتراضي 1234)..."
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>
              <div>
                <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">2. الكود السري الجديد * :</label>
                <input id="s1PinNewInput" type="password" placeholder="أدخل الكود الجديد (4 أرقام أو أكثر)..."
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-base tracking-widest">
              </div>
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">3. تأكيد الكود السري الجديد * :</label>
                <input id="s1PinConfirmInput" type="password" placeholder="أعد كتابة الكود الجديد..."
                  onkeydown="if(event.key==='Enter') Stage1.saveNewManagerPin()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="Stage1.saveNewManagerPin()"
                class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg">
                ✔ حفظ الكود السري الجديد
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(pinModal);
      }

      if (!document.getElementById('gherbiCustomInputModal')) {
        const inpModal = document.createElement('div');
        inpModal.id = 'gherbiCustomInputModal';
        inpModal.className = 'modal-overlay';
        inpModal.innerHTML = `
          <div class="modal-content w-full max-w-sm p-5 space-y-4 rounded-2xl border border-blue-500 shadow-2xl text-xs">
            <h3 id="s1CustomPromptTitle" class="text-sm font-black text-slate-800 dark:text-slate-100">إدخال القيمة</h3>
            <input id="s1CustomPromptField" type="text"
              onkeydown="if(event.key==='Enter') Stage1.resolveCustomPrompt(true); if(event.key==='Escape') Stage1.resolveCustomPrompt(false);"
              class="w-full px-3 py-2 rounded-xl border-2 border-blue-500 font-mono font-black text-center text-base">
            <div class="flex items-center justify-end gap-2">
              <button type="button" onclick="Stage1.resolveCustomPrompt(false)" class="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="Stage1.resolveCustomPrompt(true)" class="px-5 py-1.5 rounded-xl bg-blue-600 text-white font-black">✔ موافق</button>
            </div>
          </div>
        `;
        document.body.appendChild(inpModal);
      }
    },

    askCustomInput(title, defaultValue = '') {
      this.buildCustomModals();
      return new Promise((resolve) => {
        this._customPromptResolver = resolve;
        const titleEl = document.getElementById('s1CustomPromptTitle');
        const fieldEl = document.getElementById('s1CustomPromptField');
        if (titleEl) titleEl.textContent = title;
        if (fieldEl) fieldEl.value = String(defaultValue ?? '');
        window.App.openModal('gherbiCustomInputModal');
        setTimeout(() => {
          fieldEl?.focus();
          fieldEl?.select();
        }, 50);
      });
    },

    resolveCustomPrompt(confirmed) {
      const val = document.getElementById('s1CustomPromptField')?.value;
      window.App.closeModal('gherbiCustomInputModal');
      if (this._customPromptResolver) {
        const fn = this._customPromptResolver;
        this._customPromptResolver = null;
        fn(confirmed ? val : null);
      }
    },

    // ب. إصلاح تغيير كود المدير السري ومنع تكرار الصفوف في جدول الرقابة
    patchManagerPinAndDeduplicateLogs() {
      const openChangePinModal = () => {
        this.buildCustomModals();
        document.getElementById('s1PinCurrentInput').value = '';
        document.getElementById('s1PinNewInput').value = '';
        document.getElementById('s1PinConfirmInput').value = '';
        window.App.openModal('changeManagerPinModal');
        setTimeout(() => document.getElementById('s1PinCurrentInput')?.focus(), 60);
      };

      if (window.RetailV3) {
        window.RetailV3.changeManagerLoyaltyPinPrompt = openChangePinModal;

        // قفل ضد النقر المزدوج لمنع تسجيل العملية مرتين أو ثلاث مرات
        const origConfirm = window.RetailV3.confirmManagerPinPointsChange?.bind(window.RetailV3);
        if (origConfirm && !window.RetailV3._s1DedupGuarded) {
          window.RetailV3.confirmManagerPinPointsChange = async function () {
            if (this._pinBusyLock) return;
            this._pinBusyLock = true;
            try {
              await origConfirm();
            } finally {
              setTimeout(() => { this._pinBusyLock = false; }, 800);
            }
          };
          window.RetailV3._s1DedupGuarded = true;
        }
      }

      // إزالة الصفوف المكررة من جدول رقابة المدير في صفحة الإحصائيات والتقارير
      const deduplicateAuditTable = () => {
        const card = document.getElementById('ownerLoyaltyPointsAuditCard');
        if (!card) return;
        const rows = Array.from(card.querySelectorAll('tbody tr'));
        const seen = new Set();
        let validCount = 0;
        rows.forEach((tr) => {
          const cols = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
          // بصمة الصف: الدقيقة + المستخدم + الزبون + الرصيد السابق + الرصيد الجديد + السبب
          const timeMinute = (cols[0] || '').slice(0, 16);
          const signature = [timeMinute, cols[1], cols[2], cols[3], cols[4], cols[6]].join('|');
          if (seen.has(signature)) {
            tr.remove();
          } else {
            seen.add(signature);
            validCount++;
          }
        });
        const h3 = card.querySelector('h3');
        if (h3) {
          h3.textContent = `سجل رقابة المدير: تعديلات رصيد نقاط الوفاء (${validCount})`;
        }
      };

      const origAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (origAnalytics && !window.App._s1AnalyticsHooked) {
        window.App.renderAnalyticsView = async function () {
          await origAnalytics();
          setTimeout(deduplicateAuditTable, 80);
        };
        window.App._s1AnalyticsHooked = true;
      }
    },

    saveNewManagerPin() {
      const currentPin = String(
        window.AppState?.settings?.manager_loyalty_pin ||
        localStorage.getItem('gherbi_manager_loyalty_pin') ||
        '1234'
      ).trim();

      const oldVal = String(document.getElementById('s1PinCurrentInput')?.value || '').trim();
      const newVal = String(document.getElementById('s1PinNewInput')?.value || '').trim();
      const confVal = String(document.getElementById('s1PinConfirmInput')?.value || '').trim();

      if (oldVal !== currentPin) {
        if (window.showToast) window.showToast('❌ الكود السري الحالي غير صحيح!', 'error');
        document.getElementById('s1PinCurrentInput')?.focus();
        return;
      }
      if (newVal.length < 3) {
        if (window.showToast) window.showToast('⚠️ يرجى إدخال كود جديد لا يقل عن 3 أرقام أو حروف', 'warning');
        document.getElementById('s1PinNewInput')?.focus();
        return;
      }
      if (newVal !== confVal) {
        if (window.showToast) window.showToast('⚠️ الكود الجديد وتأكيده غير متطابقين!', 'warning');
        document.getElementById('s1PinConfirmInput')?.focus();
        return;
      }

      localStorage.setItem('gherbi_manager_loyalty_pin', newVal);
      if (window.AppState?.settings) {
        window.AppState.settings.manager_loyalty_pin = newVal;
      }
      if (window.api && typeof window.api.updateSettings === 'function') {
        window.api.updateSettings({ manager_loyalty_pin: newVal }).catch(() => {});
      }

      window.App.closeModal('changeManagerPinModal');
      if (window.showToast) {
        window.showToast('✅ تم تغيير كود المدير السري (PIN) وحفظه بنجاح!', 'success');
      }
    },

    // ج. إزالة الشريط المكرر للأزرار السريعة F7 في شاشة المبيعات
    unifyQuickTouchStrip() {
      const removeOldStrip = () => {
        const old = document.getElementById('posQuickTouchStrip');
        if (old) old.remove();
      };
      removeOldStrip();
      window.App.renderQuickTouchStrip = removeOldStrip;
      setInterval(removeOldStrip, 1200);
    },

    // د. الحساب اللحظي الفوري لـ "الباقي للزبون" بمجرد كتابة أي رقم بدون أي ضغط
    bindZeroClickLiveChangeCalculator() {
      const updateChangeNow = () => {
        const inp = document.getElementById('gherbiReceivedCashInput');
        const resEl = document.getElementById('gherbiInlineChangeResult');
        const centEl = document.getElementById('gherbiInlineChangeCentimes');
        if (!inp || !resEl) return;

        // قراءة الإجمالي المستحق الحي من السلة مباشرة
        let totalDue = 0;
        if (window.App && typeof window.App.recalcCart === 'function') {
          const calc = window.App.recalcCart();
          if (calc && Number.isFinite(calc.total)) totalDue = Number(calc.total);
        }
        if (!totalDue) {
          const rawTxt = document.getElementById('cartTotalText')?.textContent || '0';
          totalDue = parseFloat(rawTxt.replace(/[^\d.-]/g, '')) || 0;
        }

        const rawReceived = String(inp.value || '').trim();
        const received = parseFloat(rawReceived);

        if (!rawReceived || !Number.isFinite(received) || received <= 0) {
          resEl.textContent = '0.00 د.ج';
          resEl.className = 'font-mono font-black text-sm text-slate-500';
          if (centEl) centEl.classList.add('hidden');
          return;
        }

        const diff = Number((received - totalDue).toFixed(2));
        if (diff >= 0) {
          resEl.textContent = `${diff.toFixed(2)} د.ج`;
          resEl.className = 'font-mono font-black text-base text-emerald-600 dark:text-emerald-400 transition-all';
          if (centEl) {
            const centStr = window.App?.formatAlgerianCentimes
              ? window.App.formatAlgerianCentimes(diff)
              : `${Math.round(diff * 100)} سنتيم`;
            centEl.textContent = `🇩🇿 الصرف بالتداول الجزائري: ${centStr}`;
            centEl.classList.remove('hidden');
          }
        } else {
          const shortAmt = Math.abs(diff);
          resEl.textContent = `متبقي على الزبون: ${shortAmt.toFixed(2)} د.ج`;
          resEl.className = 'font-mono font-black text-sm text-rose-600 transition-all';
          if (centEl) {
            const centStr = window.App?.formatAlgerianCentimes
              ? window.App.formatAlgerianCentimes(shortAmt)
              : `${Math.round(shortAmt * 100)} سنتيم`;
            centEl.textContent = `⚠️ ينقص من المبلغ: ${centStr}`;
            centEl.classList.remove('hidden');
          }
        }
      };

      if (window.RetailV2) {
        window.RetailV2.recalcInlineChange = updateChangeNow;
      }

      const wireInputEvents = () => {
        const inp = document.getElementById('gherbiReceivedCashInput');
        if (!inp || inp.dataset.s1LiveWired === '1') return;
        inp.dataset.s1LiveWired = '1';

        ['input', 'keyup', 'keydown', 'change', 'paste', 'click'].forEach((ev) => {
          inp.addEventListener(ev, () => {
            updateChangeNow();
            requestAnimationFrame(updateChangeNow);
          });
        });

        const totalNode = document.getElementById('cartTotalText');
        if (totalNode) {
          const observer = new MutationObserver(() => updateChangeNow());
          observer.observe(totalNode, { childList: true, subtree: true, characterData: true });
        }
      };

      wireInputEvents();
      setInterval(wireInputEvents, 800);
    }
  };

  window.Stage1 = Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Stage1.init());
  } else {
    Stage1.init();
  }
})();

// توجيه آمن لمنع أي استدعاء دائري
if (window.RetailV2) {
  window.RetailV2.recalcInlineChange = safeUpdateInlineChangeNow;
}
