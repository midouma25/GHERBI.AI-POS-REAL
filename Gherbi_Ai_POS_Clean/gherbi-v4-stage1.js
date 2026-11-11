
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
 * gherbi-v4-stage1.js
 * المحرك التنفيذي للشطر الأول:
 * - نافذة تغيير كود المدير السري (PIN) بدون prompt() + تنظيف تكرار جدول الرقابة
 * - توحيد شريط اللمس السريع (F7)
 * - الحساب اللحظي الفوري للصرف (المبلغ المستلم ⬅ الباقي للزبون) بدون أي ضغط
 */

'use strict';

(function initGherbiV4Stage1() {
  const Stage1 = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.buildCustomPinAndPromptModals();
        this.bindManagerPinAndDeduplicateAuditTable();
        this.killDuplicateQuickTouchStrip();
        this.activateZeroClickLiveChangeCalculator();
        console.log('✅ [Gherbi V4 - Stage 1]: تم تفعيل الشطر الأول بنجاح.');
      }, 180);
    },

    // ========================================================================
    // 1. بناء نافذة تغيير كود المدير السري (#changeManagerPinModal) + بديل prompt() العام
    // ========================================================================
    buildCustomPinAndPromptModals() {
      if (!document.getElementById('changeManagerPinModal')) {
        const modal = document.createElement('div');
        modal.id = 'changeManagerPinModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border-2 border-amber-500 shadow-2xl text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">🔑</span>
                <div>
                  <h3 class="text-sm font-black text-amber-600 dark:text-amber-400">تغيير كود المدير السري (Manager PIN)</h3>
                  <p class="text-[10.5px] text-slate-400">يُستخدم هذا الكود لحماية تعديل رصيد نقاط الولاء والعمليات الحساسة</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="text-slate-400 hover:text-rose-500 font-black text-base">✕</button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">1. الكود السري الحالي (الافتراضي: 1234) * :</label>
                <input id="s1PinCurrentInput" type="password" placeholder="أدخل الكود السري الحالي..."
                  onkeydown="if(event.key==='Enter') document.getElementById('s1PinNewInput')?.focus()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>

              <div>
                <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">2. الكود السري الجديد (3 إلى 10 أرقام/حروف) * :</label>
                <input id="s1PinNewInput" type="password" placeholder="أدخل الكود السري الجديد..."
                  onkeydown="if(event.key==='Enter') document.getElementById('s1PinConfirmInput')?.focus()"
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-base tracking-widest">
              </div>

              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">3. تأكيد الكود السري الجديد * :</label>
                <input id="s1PinConfirmInput" type="password" placeholder="أعد كتابة الكود الجديد للتأكيد..."
                  onkeydown="if(event.key==='Enter') GherbiStage1.submitManagerPinChange()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="GherbiStage1.submitManagerPinChange()"
                class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg">
                ✔ حفظ الكود السري الجديد
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      // نافذة بديلة عامة لأي استدعاء prompt() في النظام
      if (!document.getElementById('gherbiCustomPromptModal')) {
        const pModal = document.createElement('div');
        pModal.id = 'gherbiCustomPromptModal';
        pModal.className = 'modal-overlay';
        pModal.innerHTML = `
          <div class="modal-content w-full max-w-sm p-5 space-y-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
            <h3 id="gPromptTitle" class="text-sm font-black text-slate-800 dark:text-slate-100">إدخال قيمة</h3>
            <input id="gPromptInput" type="text"
              onkeydown="if(event.key==='Enter') GherbiStage1.resolveCustomPrompt(true)"
              class="w-full px-3 py-2 rounded-xl border-2 border-blue-500 font-mono font-black text-center text-sm">
            <div class="flex items-center justify-end gap-2 pt-1">
              <button type="button" onclick="GherbiStage1.resolveCustomPrompt(false)" class="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="GherbiStage1.resolveCustomPrompt(true)" class="px-5 py-1.5 rounded-xl bg-blue-600 text-white font-black">✔ تأكيد (OK)</button>
            </div>
          </div>
        `;
        document.body.appendChild(pModal);
      }
    },

    openCustomPrompt(title, defaultValue = '') {
      this.buildCustomPinAndPromptModals();
      return new Promise((resolve) => {
        this._promptResolver = resolve;
        const titleEl = document.getElementById('gPromptTitle');
        const inpEl = document.getElementById('gPromptInput');
        if (titleEl) titleEl.textContent = title || 'إدخال قيمة';
        if (inpEl) inpEl.value = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : '';
        window.App.openModal('gherbiCustomPromptModal');
        setTimeout(() => {
          inpEl?.focus();
          inpEl?.select();
        }, 50);
      });
    },

    resolveCustomPrompt(confirmed) {
      const val = document.getElementById('gPromptInput')?.value ?? '';
      window.App.closeModal('gherbiCustomPromptModal');
      if (typeof this._promptResolver === 'function') {
        const fn = this._promptResolver;
        this._promptResolver = null;
        fn(confirmed ? val : null);
      }
    },

    openManagerPinModal() {
      this.buildCustomPinAndPromptModals();
      document.getElementById('s1PinCurrentInput').value = '';
      document.getElementById('s1PinNewInput').value = '';
      document.getElementById('s1PinConfirmInput').value = '';
      window.App.openModal('changeManagerPinModal');
      setTimeout(() => document.getElementById('s1PinCurrentInput')?.focus(), 60);
    },

    getStoredPin() {
      return String(
        window.AppState?.settings?.manager_loyalty_pin ||
        localStorage.getItem('gherbi_manager_loyalty_pin') ||
        '1234'
      ).trim();
    },

    submitManagerPinChange() {
      const currentPin = this.getStoredPin();
      const oldVal = String(document.getElementById('s1PinCurrentInput')?.value || '').trim();
      const newVal = String(document.getElementById('s1PinNewInput')?.value || '').trim();
      const confirmVal = String(document.getElementById('s1PinConfirmInput')?.value || '').trim();

      if (oldVal !== currentPin) {
        if (window.showToast) window.showToast('❌ الكود السري الحالي غير صحيح!', 'error');
        document.getElementById('s1PinCurrentInput')?.focus();
        return;
      }
      if (newVal.length < 3) {
        if (window.showToast) window.showToast('⚠️ يجب أن يتكون الكود الجديد من 3 خانات على الأقل', 'warning');
        document.getElementById('s1PinNewInput')?.focus();
        return;
      }
      if (newVal !== confirmVal) {
        if (window.showToast) window.showToast('⚠️ الكود الجديد وتأكيده غير متطابقين!', 'warning');
        document.getElementById('s1PinConfirmInput')?.focus();
        return;
      }

      localStorage.setItem('gherbi_manager_loyalty_pin', newVal);
      if (window.AppState?.settings) {
        window.AppState.settings.manager_loyalty_pin = newVal;
      }
      if (window.api?.updateSettings) {
        window.api.updateSettings({ manager_loyalty_pin: newVal }).catch(() => {});
      }

      window.App.closeModal('changeManagerPinModal');
      if (window.showToast) {
        window.showToast('✅ تم تغيير كود المدير السري (PIN) وحفظه بنجاح!', 'success');
      }
    },

    bindManagerPinAndDeduplicateAuditTable() {
      if (window.RetailV3) {
        window.RetailV3.changeManagerLoyaltyPinPrompt = () => this.openManagerPinModal();
        window.RetailV3.getManagerSecretPin = () => this.getStoredPin();

        // منع إرسال سجل الرقابة أكثر من مرة لنفس العملية
        const origConfirm = window.RetailV3.confirmManagerPinPointsChange?.bind(window.RetailV3);
        if (origConfirm && !window.RetailV3._s1DedupWrapped) {
          window.RetailV3.confirmManagerPinPointsChange = async function () {
            if (this._pinBusyLock) return;
            this._pinBusyLock = true;
            try {
              await origConfirm();
            } finally {
              setTimeout(() => { this._pinBusyLock = false; }, 800);
            }
          };
          window.RetailV3._s1DedupWrapped = true;
        }
      }

      // تنظيف الصفوف المكررة في جدول "سجل رقابة المدير: تعديلات رصيد نقاط الوفاء"
      const deduplicateAuditDom = () => {
        const card = document.getElementById('ownerLoyaltyPointsAuditCard');
        if (!card) return;

        // ربط زر تغيير الكود السري داخل البطاقة
        const pinBtn = card.querySelector('button[onclick*="changeManagerLoyaltyPinPrompt"]');
        if (pinBtn) {
          pinBtn.onclick = (e) => {
            e.preventDefault();
            this.openManagerPinModal();
          };
        }

        const tbody = card.querySelector('tbody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const seen = new Set();
        let kept = 0;

        rows.forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((c) => c.textContent.trim());
          // بصمة الصف: اسم الزبون + الرصيد السابق + الرصيد الجديد + الفارق + السبب
          const sig = cells.slice(1).join('||');
          if (seen.has(sig)) {
            tr.remove();
          } else {
            seen.add(sig);
            kept++;
          }
        });

        const titleEl = card.querySelector('h3');
        if (titleEl) {
          titleEl.textContent = `سجل رقابة المدير: تعديلات رصيد نقاط الوفاء (${kept})`;
        }
      };

      setInterval(deduplicateAuditDom, 700);
    },

    // ========================================================================
    // 2. إزالة تكرار شريط اللمس السريع (F7) في شاشة المبيعات وتوحيده
    // ========================================================================
    killDuplicateQuickTouchStrip() {
      const removeOldStrip = () => {
        const oldStrip = document.getElementById('posQuickTouchStrip');
        if (oldStrip) oldStrip.remove();
      };
      removeOldStrip();

      if (window.App) {
        window.App.renderQuickTouchStrip = function () {
          removeOldStrip();
          if (window.RetailV3 && typeof window.RetailV3.renderPinnedQuickDock === 'function') {
            window.RetailV3.renderPinnedQuickDock();
          }
        };
      }
      setInterval(removeOldStrip, 600);
    },

    // ========================================================================
    // 3. الحساب اللحظي الفوري لـ "الباقي للزبون" بمجرد لمس أي رقم بدون أي ضغط
    // ========================================================================
    activateZeroClickLiveChangeCalculator() {
      const computeLiveChangeNow = () => {
        const inp = document.getElementById('gherbiReceivedCashInput');
        const resEl = document.getElementById('gherbiInlineChangeResult');
        const centEl = document.getElementById('gherbiInlineChangeCentimes');
        if (!inp || !resEl) return;

        const rawTotalText = document.getElementById('cartTotalText')?.textContent || '0';
        const totalDue = parseFloat(rawTotalText.replace(/[^\d.-]/g, '')) || 0;
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
          resEl.className = 'font-mono font-black text-sm text-rose-600 animate-pulse';
          if (centEl) {
            centEl.textContent = `⚠️ المبلغ المستلم أقل من الإجمالي المستحق بـ ${missing.toFixed(2)} د.ج`;
            centEl.classList.remove('hidden');
          }
        }
      };

      if (window.RetailV2) {
        window.RetailV2.recalcInlineChange = computeLiveChangeNow;
      }

      // مستمع شامل على مستوى الوثيقة يلتقط أي حرف أو رقم يُكتب في خانة المبلغ المستلم فوراً
      ['input', 'keyup', 'keydown', 'change', 'paste'].forEach((evtType) => {
        document.addEventListener(
          evtType,
          (e) => {
            if (e.target && e.target.id === 'gherbiReceivedCashInput') {
              computeLiveChangeNow();
              requestAnimationFrame(computeLiveChangeNow);
            }
          },
          true
        );
      });

      // مراقب مباشر على عنصر الإجمالي المستحق (#cartTotalText) لتحديث الباقي فور إضافة أو حذف أي سلعة
      const bindTotalObserver = () => {
        const totalEl = document.getElementById('cartTotalText');
        if (totalEl && !totalEl.dataset.s1LiveObs) {
          totalEl.dataset.s1LiveObs = '1';
          const obs = new MutationObserver(() => computeLiveChangeNow());
          obs.observe(totalEl, { childList: true, characterData: true, subtree: true });
        }
      };
      bindTotalObserver();
      setInterval(bindTotalObserver, 800);
    }
  };

  window.GherbiStage1 = Stage1;
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
