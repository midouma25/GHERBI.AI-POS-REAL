/**
 * gherbi-retail-v4-enterprise.js
 * المحرك المعماري الشامل للإصدار 4 (Enterprise Retail Edition) لنظام Gherbi.Ai POS
 */

'use strict';

(function initGherbiRetailV4Enterprise() {
  const RetailV4 = {
    activeF7Tab: 'all',
    _auditMutex: false,
    _recentAuditSignatures: new Set(),

    init() {
      const waitApp = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(waitApp);
        this.bootAllModules();
      }, 200);
    },

    bootAllModules() {
      const modules = [
        'buildCustomDialogModalsDom',
        'replaceAllNativePromptsAndFixManagerPin',
        'deduplicateManagerAuditLogs',
        'unifyQuickTouchF7Strip',
        'activateZeroLatencyChangeCalculator',
        'upgradeQuickTouchCommandCenterF7',
        'activateDeltaLoyaltyPointsEngine',
        'overhaulProductModalAndMultiBarcodes'
      ];

      modules.forEach((fn) => {
        try {
          if (typeof this[fn] === 'function') this[fn]();
        } catch (err) {
          console.warn('[RetailV4 Module Warning]:', fn, err.message);
        }
      });
    },

    // ========================================================================
    // المحور 1: استبدال window.prompt() بنوافذ مخصصة + إصلاح تغيير كود المدير (PIN) + منع تكرار السجل
    // ========================================================================
    buildCustomDialogModalsDom() {
      // أ. نافذة الإدخال السريع المخصصة بديلة window.prompt()
      if (!document.getElementById('gherbiAsyncPromptModal')) {
        const pModal = document.createElement('div');
        pModal.id = 'gherbiAsyncPromptModal';
        pModal.className = 'modal-overlay';
        pModal.innerHTML = `
          <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border-2 border-blue-500/60 shadow-2xl text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <h3 id="asyncPromptTitle" class="text-sm font-black text-blue-600 dark:text-blue-400">إدخال القيمة</h3>
              <button type="button" id="asyncPromptCloseBtn" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
            </div>
            <div class="space-y-2">
              <p id="asyncPromptLabel" class="font-bold text-slate-600 dark:text-slate-300 leading-relaxed"></p>
              <input id="asyncPromptInput" type="text"
                class="w-full px-3.5 py-2.5 rounded-xl border-2 border-blue-500 font-mono font-black text-center text-base">
            </div>
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" id="asyncPromptCancelBtn" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء (Esc)</button>
              <button type="button" id="asyncPromptOkBtn" class="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow-lg">✔ موافق (Enter)</button>
            </div>
          </div>
        `;
        document.body.appendChild(pModal);
      }

      // ب. نافذة تغيير كود المدير السري (Manager PIN)
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
                  <p class="text-[10.5px] text-slate-400">الكود الخاص بحماية تعديل رصيد نقاط الولاء والعمليات الرقابية</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">1. الكود السري الحالي (الافتراضي: 1234) * :</label>
                <input id="mgrPinCurrentInput" type="password" placeholder="أدخل الكود السري الحالي..."
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>

              <div>
                <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">2. الكود السري الجديد (3 إلى 10 أرقام/حروف) * :</label>
                <input id="mgrPinNewInput" type="password" placeholder="أدخل الكود السري الجديد..."
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-base tracking-widest">
              </div>

              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">3. تأكيد الكود السري الجديد * :</label>
                <input id="mgrPinConfirmInput" type="password" placeholder="أعد كتابة الكود السري الجديد..."
                  onkeydown="if(event.key==='Enter') RetailV4.submitManagerPinChange()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <label class="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-500">
                <input type="checkbox" onchange="['mgrPinCurrentInput','mgrPinNewInput','mgrPinConfirmInput'].forEach(id=>{const el=document.getElementById(id); if(el) el.type=this.checked?'text':'password';})">
                <span>إظهار الأرقام</span>
              </label>
              <div class="flex items-center gap-2">
                <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
                <button type="button" onclick="RetailV4.submitManagerPinChange()"
                  class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg">
                  ✔ حفظ الكود الجديد
                </button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(pinModal);
      }

      // ج. نافذة تعديل زر اللمس السريع في F7
      if (!document.getElementById('quickBtnEditModal')) {
        const qbModal = document.createElement('div');
        qbModal.id = 'quickBtnEditModal';
        qbModal.className = 'modal-overlay';
        qbModal.innerHTML = `
          <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <h3 class="text-sm font-black text-emerald-600">✏️ تعديل خصائص زر اللمس السريع</h3>
              <button type="button" onclick="App.closeModal('quickBtnEditModal')" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
            </div>
            <input type="hidden" id="qbEditIndexInput">
            <div class="grid grid-cols-12 gap-2.5">
              <div class="col-span-3">
                <label class="block font-bold mb-1">الأيقونة</label>
                <input id="qbEditIconInput" type="text" class="w-full px-2 py-2 rounded-xl border text-center text-base">
              </div>
              <div class="col-span-9">
                <label class="block font-bold mb-1">اسم السلعة أو الخدمة *</label>
                <input id="qbEditNameInput" type="text" class="w-full px-3 py-2 rounded-xl border font-black">
              </div>
              <div class="col-span-6">
                <label class="block font-black text-emerald-600 mb-1">السعر (د.ج) *</label>
                <input id="qbEditPriceInput" type="number" step="any" class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-sm">
              </div>
              <div class="col-span-6">
                <label class="block font-bold mb-1">القسم / الفئة</label>
                <input id="qbEditCatInput" type="text" class="w-full px-3 py-2 rounded-xl border font-bold">
              </div>
              <div class="col-span-12 flex items-center justify-between pt-2">
                <label class="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input id="qbEditPinnedCheck" type="checkbox" class="rounded text-emerald-600">
                  <span>📌 تثبيت في شريط الكاشير الرئيسي</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer font-bold text-rose-600">
                  <input id="qbEditNoLoyaltyCheck" type="checkbox" class="rounded text-rose-500">
                  <span>🚫 استثناء من نقاط الولاء</span>
                </label>
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('quickBtnEditModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="RetailV4.saveEditedQuickButton()" class="px-5 py-2 rounded-xl bg-emerald-600 text-white font-black">✔ حفظ التعديلات</button>
            </div>
          </div>
        `;
        document.body.appendChild(qbModal);
      }
    },

    promptModal({ title = 'إدخال القيمة', label = '', defaultValue = '', inputType = 'text' } = {}) {
      this.buildCustomDialogModalsDom();
      return new Promise((resolve) => {
        const modal = document.getElementById('gherbiAsyncPromptModal');
        const titleEl = document.getElementById('asyncPromptTitle');
        const labelEl = document.getElementById('asyncPromptLabel');
        const inpEl = document.getElementById('asyncPromptInput');
        const okBtn = document.getElementById('asyncPromptOkBtn');
        const cancelBtn = document.getElementById('asyncPromptCancelBtn');
        const closeBtn = document.getElementById('asyncPromptCloseBtn');

        if (!modal || !inpEl) return resolve(null);

        titleEl.textContent = title;
        labelEl.textContent = label;
        inpEl.type = inputType;
        inpEl.value = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : '';

        const cleanup = (val) => {
          inpEl.onkeydown = null;
          okBtn.onclick = null;
          cancelBtn.onclick = null;
          closeBtn.onclick = null;
          window.App.closeModal('gherbiAsyncPromptModal');
          resolve(val);
        };

        okBtn.onclick = () => cleanup(inpEl.value);
        cancelBtn.onclick = () => cleanup(null);
        closeBtn.onclick = () => cleanup(null);
        inpEl.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            cleanup(inpEl.value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(null);
          }
        };

        window.App.openModal('gherbiAsyncPromptModal');
        setTimeout(() => {
          inpEl.focus();
          inpEl.select();
        }, 50);
      });
    },

    replaceAllNativePromptsAndFixManagerPin() {
      const openManagerPinChange = () => {
        this.buildCustomDialogModalsDom();
        ['mgrPinCurrentInput', 'mgrPinNewInput', 'mgrPinConfirmInput'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.value = '';
            el.type = 'password';
          }
        });
        window.App.openModal('changeManagerPinModal');
        setTimeout(() => document.getElementById('mgrPinCurrentInput')?.focus(), 60);
      };

      if (window.RetailV3) {
        window.RetailV3.changeManagerLoyaltyPinPrompt = openManagerPinChange;
        window.RetailV3.quickEditQuickButtonPrice = (idx) => this.openEditQuickButtonModal(idx);
      }

      // استبدال أي استدعاءات قديمة لـ prompt() في البيع بمبلغ أو مضاعف الكمية
      if (window.UltimatePosUI) {
        window.UltimatePosUI.sellByTargetAmount = async () => {
          const items = window.App.currentCart?.items || [];
          if (!items.length) return window.App.openFreeItemModal?.();
          const idx = window.AppState.selectedCartRowIdx ?? (items.length - 1);
          const it = items[idx];
          if (!it || Number(it.price || 0) <= 0) return;
          const valStr = await this.promptModal({
            title: '⚖️ البيع بمبلغ مالي محسوب',
            label: `أدخل المبلغ المطلوب بالدينار الجزائري لحساب الكمية تلقائياً من (${it.name}):`,
            defaultValue: it.price,
            inputType: 'number'
          });
          if (valStr === null) return;
          const targetDzd = parseFloat(valStr);
          if (Number.isFinite(targetDzd) && targetDzd > 0) {
            it.quantity = Number((targetDzd / Number(it.price)).toFixed(3));
            it.subtotal = Number(targetDzd.toFixed(2));
            window.App.recalcAndRenderCart();
          }
        };
      }
    },

    submitManagerPinChange() {
      const curPin = window.RetailV3
        ? window.RetailV3.getManagerSecretPin()
        : String(localStorage.getItem('gherbi_manager_loyalty_pin') || '1234').trim();

      const enteredOld = String(document.getElementById('mgrPinCurrentInput')?.value || '').trim();
      const enteredNew = String(document.getElementById('mgrPinNewInput')?.value || '').trim();
      const enteredConfirm = String(document.getElementById('mgrPinConfirmInput')?.value || '').trim();

      if (enteredOld !== curPin) {
        if (window.showToast) window.showToast('❌ الكود السري الحالي غير صحيح!', 'error');
        document.getElementById('mgrPinCurrentInput')?.focus();
        return;
      }
      if (enteredNew.length < 3) {
        if (window.showToast) window.showToast('⚠️ يجب أن يتكون الكود الجديد من 3 أرقام أو حروف على الأقل', 'warning');
        document.getElementById('mgrPinNewInput')?.focus();
        return;
      }
      if (enteredNew !== enteredConfirm) {
        if (window.showToast) window.showToast('⚠️ الكود السري الجديد وتأكيده غير متطابقين!', 'warning');
        document.getElementById('mgrPinConfirmInput')?.focus();
        return;
      }

      localStorage.setItem('gherbi_manager_loyalty_pin', enteredNew);
      if (window.AppState?.settings) {
        window.AppState.settings.manager_loyalty_pin = enteredNew;
      }
      if (window.api?.updateSettings) {
        window.api.updateSettings({ manager_loyalty_pin: enteredNew }).catch(() => {});
      }

      window.App.closeModal('changeManagerPinModal');
      if (window.showToast) {
        window.showToast('✅ تم تحديث كود المدير السري (PIN) وحفظه بنجاح!', 'success');
      }
    },

    deduplicateManagerAuditLogs() {
      // 1. منع تكرار الحفظ عند النقر المتتابع في نافذة كود المدير
      if (window.RetailV3 && typeof window.RetailV3.confirmManagerPinPointsChange === 'function' && !window.RetailV3._v4MutexWrapped) {
        const origConfirm = window.RetailV3.confirmManagerPinPointsChange.bind(window.RetailV3);
        window.RetailV3.confirmManagerPinPointsChange = async function () {
          if (RetailV4._auditMutex) return;
          const oldPts = Number(window.AppState._originalCustomerPointsBeforePin || 0);
          const newPts = Math.max(0, parseInt(document.getElementById('pinModalNewPointsInput')?.value || '0', 10) || 0);
          const custName = document.getElementById('custNameInput')?.value?.trim() || '';
          const sig = `${custName}|${oldPts}|${newPts}|${Math.floor(Date.now() / 15000)}`;

          if (RetailV4._recentAuditSignatures.has(sig)) {
            window.App.closeModal('loyaltyPinVerifyModal');
            return;
          }

          RetailV4._auditMutex = true;
          try {
            await origConfirm();
            RetailV4._recentAuditSignatures.add(sig);
          } finally {
            setTimeout(() => { RetailV4._auditMutex = false; }, 800);
          }
        };
        window.RetailV3._v4MutexWrapped = true;
      }

      // 2. إزالة أي صفوف مكررة في جدول سجل رقابة المدير عند عرض صفحة التقارير
      const cleanAuditTableDom = () => {
        const card = document.getElementById('ownerLoyaltyPointsAuditCard');
        if (!card) return;
        const rows = Array.from(card.querySelectorAll('tbody tr'));
        const seen = new Set();
        let validCount = 0;
        rows.forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((c) => c.textContent.trim());
          // بصمة الصف: المستخدم + الزبون + الرصيد السابق + الرصيد الجديد + الفارق + السبب
          const rowKey = cells.slice(1).join('||');
          if (seen.has(rowKey)) {
            tr.remove();
          } else {
            seen.add(rowKey);
            validCount++;
          }
        });
        const h3 = card.querySelector('h3');
        if (h3) {
          h3.textContent = `سجل رقابة المدير: تعديلات رصيد نقاط الوفاء (${validCount})`;
        }
      };

      const origRenderAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (origRenderAnalytics && !window.App._v4CleanAuditTableHooked) {
        window.App.renderAnalyticsView = async function (...args) {
          const res = await origRenderAnalytics(...args);
          setTimeout(cleanAuditTableDom, 60);
          return res;
        };
        window.App._v4CleanAuditTableHooked = true;
      }
    },

    // ========================================================================
    // المحور 2: توحيد شريط اللمس السريع (F7) وإزالة الازدواجية في شاشة المبيعات
    // ========================================================================
    unifyQuickTouchF7Strip() {
      const removeLegacyStrip = () => {
        const legacy = document.getElementById('posQuickTouchStrip');
        if (legacy) legacy.remove();
      };
      removeLegacyStrip();

      window.App.renderQuickTouchStrip = () => {
        removeLegacyStrip();
        this.renderUnifiedPinnedDock();
      };
    },

    // ========================================================================
    // المحور 3: التحديث اللحظي الفوري لحاسبة الصرف (المبلغ المستلم ⬅ الباقي للزبون) بدون أي ضغط
    // ========================================================================
    activateZeroLatencyChangeCalculator() {
      const computeLiveTotalDue = () => {
        try {
          if (window.App && typeof window.App.recalcCart === 'function' && !this._isInsideRecalc) {
            this._isInsideRecalc = true;
            const calc = window.App.recalcCart();
            this._isInsideRecalc = false;
            if (calc && Number.isFinite(Number(calc.total))) {
              return Number(calc.total);
            }
          }
        } catch (_) {
          this._isInsideRecalc = false;
        }
        const domTxt = document.getElementById('cartTotalText')?.textContent || '0';
        return parseFloat(domTxt.replace(/[^d.-]/g, '')) || 0;
      };

      const updateChangeInstant = (forcedTotal) => {
        const inp = document.getElementById('gherbiReceivedCashInput');
        const resEl = document.getElementById('gherbiInlineChangeResult');
        const centEl = document.getElementById('gherbiInlineChangeCentimes');
        if (!inp || !resEl) return;

        const rawStr = String(inp.value || '').replace(/,/g, '.').trim();
        const received = parseFloat(rawStr);
        const totalDue = forcedTotal !== undefined && Number.isFinite(Number(forcedTotal))
          ? Number(forcedTotal)
          : computeLiveTotalDue();

        if (!rawStr || !Number.isFinite(received) || received <= 0) {
          resEl.textContent = '0.00 د.ج';
          resEl.className = 'font-mono font-black text-sm text-slate-500';
          if (centEl) centEl.classList.add('hidden');
          return;
        }

        const diff = Number((received - totalDue).toFixed(2));
        resEl.classList.add('change-pulse');
        setTimeout(() => resEl.classList.remove('change-pulse'), 110);

        if (diff >= 0) {
          resEl.textContent = `${diff.toFixed(2)} د.ج`;
          resEl.className = 'font-mono font-black text-base text-emerald-600 dark:text-emerald-400 change-pulse';
          if (centEl) {
            const centStr = window.App?.formatAlgerianCentimes
              ? window.App.formatAlgerianCentimes(diff)
              : `${Math.round(diff * 100).toLocaleString('fr-DZ')} سنتيم`;
            centEl.textContent = `🇩🇿 الصرف بالتداول الجزائري: ${centStr}`;
            centEl.classList.remove('hidden');
          }
        } else {
          const shortage = Math.abs(diff);
          resEl.textContent = `ناقص: ${shortage.toFixed(2)} د.ج`;
          resEl.className = 'font-mono font-black text-sm text-rose-600 change-pulse';
          if (centEl) {
            const centStr = window.App?.formatAlgerianCentimes
              ? window.App.formatAlgerianCentimes(shortage)
              : `${Math.round(shortage * 100).toLocaleString('fr-DZ')} سنتيم`;
            centEl.textContent = `⚠️ المبلغ المستلم ناقص بـ ${shortage.toFixed(2)} د.ج (${centStr})`;
            centEl.classList.remove('hidden');
          }
        }
      };

      if (window.RetailV2) {
        window.RetailV2.recalcInlineChange = updateChangeInstant;
      }
      this.recalcInlineChangeInstant = updateChangeInstant;

      const bindCashInputEvents = () => {
        const inp = document.getElementById('gherbiReceivedCashInput');
        if (!inp || inp.dataset.v4ZeroLatency === '1') return;
        inp.dataset.v4ZeroLatency = '1';
        inp.setAttribute('oninput', 'RetailV4.recalcInlineChangeInstant()');

        ['input', 'keyup', 'keydown', 'change', 'paste', 'focus', 'click'].forEach((ev) => {
          inp.addEventListener(ev, () => {
            updateChangeInstant();
            requestAnimationFrame(() => updateChangeInstant());
          });
        });

        const totalNode = document.getElementById('cartTotalText');
        if (totalNode) {
          const obs = new MutationObserver(() => updateChangeInstant());
          obs.observe(totalNode, { childList: true, subtree: true, characterData: true });
        }
      };

      bindCashInputEvents();
      setInterval(bindCashInputEvents, 800);
    },

    // ========================================================================
    // المحور 4: تطوير لوحة اللمس السريع (F7) وربطها الحي بمنتجات المخزن الحقيقية
    // ========================================================================
    upgradeQuickTouchCommandCenterF7() {
      const modal = document.getElementById('quickTouchPadModal');
      if (!modal) return;

      modal.innerHTML = `
        <div class="modal-content w-full max-w-5xl p-5 space-y-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden">
          <!-- رأس النافذة -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5 shrink-0">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">⚡</span>
              <div>
                <h3 class="text-base font-black text-emerald-600 dark:text-emerald-400">مركز اللمس السريع للسلع اليومية ومنتجات المخزن (F7)</h3>
                <p class="text-[11px] text-slate-400">اضغط على أي بطاقة لبيعها فوراً — يمكنك ربط منتجات حقيقية من مخزنك (تخصم من المخزون) أو إضافة سلع يومية سريعة وتثبيتها 📌</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('quickTouchPadModal'); App.focusBarcodeMagnet?.(false);" class="text-slate-400 hover:text-rose-500 font-black text-base">✕</button>
          </div>

          <!-- شريط القوالب الجاهزة واستيراد منتجات المخزن -->
          <div class="p-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-black text-amber-400 ml-1">🎯 مجموعات جاهزة:</span>
              <button type="button" onclick="RetailV4.applyF7Preset('supermarket')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-black">🛒 سوبرماركت ويوميات</button>
              <button type="button" onclick="RetailV4.applyF7Preset('produce')" class="px-2.5 py-1 rounded-lg bg-lime-600 hover:bg-lime-500 font-black">🍎 خضر وفواكه</button>
              <button type="button" onclick="RetailV4.applyF7Preset('bakery')" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 font-black">🥖 مخبزة ومرطبات</button>
              <button type="button" onclick="RetailV4.applyF7Preset('library')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 font-black">📚 مكتبة ونسخ</button>
              <button type="button" onclick="RetailV4.applyF7Preset('perfume')" class="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 font-black">✨ عطور وهدايا</button>
            </div>
            <button type="button" onclick="RetailV4.importFeaturedWarehouseProductsToF7()"
              class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center gap-1 shadow">
              <span>🔥</span>
              <span>+ استيراد منتجات المخزن المفضلة تلقائياً</span>
            </button>
          </div>

          <!-- شريط الفلترة حسب القسم والبحث داخل الأزرار السريعة -->
          <div class="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div id="v4F7CatFilterBar" class="flex items-center gap-1 overflow-x-auto no-scrollbar"></div>
            <input id="v4F7SearchFilterInput" type="text" oninput="RetailV4.renderF7CardsGrid()"
              placeholder="🔍 ابحث في أزرار اللمس السريع..."
              class="w-60 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold">
          </div>

          <!-- شبكة البطاقات التفاعلية -->
          <div id="quickTouchButtonsGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 overflow-y-auto flex-1 p-1"></div>

          <!-- اللوحة السفلية المزدوجة: 1) بحث وربط مباشر من المخزن | 2) إنشاء زر سلعة/خدمة حرة -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shrink-0">
            
            <!-- 1. ربط منتج موجود في المخزن بالبحث الفوري -->
            <div class="md:col-span-5 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-1.5 relative">
              <label class="block font-black text-blue-600 dark:text-blue-400">📦 1. إضافة منتج من المخزن إلى لوحة اللمس السريع:</label>
              <div class="flex gap-1.5">
                <input id="v4F7WarehouseLookupInput" type="text"
                  oninput="RetailV4.renderWarehouseLookupSuggestions(this.value)"
                  onfocus="RetailV4.renderWarehouseLookupSuggestions(this.value)"
                  placeholder="ابحث باسم المنتج أو الباركود في مخزنك..."
                  class="flex-1 px-2.5 py-1.5 rounded-xl border-2 border-blue-500/50 font-bold">
              </div>
              <div id="v4F7WarehouseSuggestionsBox" class="hidden absolute bottom-full mb-1 right-0 left-3 max-h-44 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-2xl z-50 divide-y divide-slate-100 dark:divide-slate-800"></div>
            </div>

            <!-- 2. إضافة زر سلعة يومية أو خدمة بدون باركود -->
            <div class="md:col-span-7 space-y-1.5">
              <label class="block font-black text-emerald-600 dark:text-emerald-400">⚡ 2. أو إنشاء زر سريع لسلعة يومية / خدمة بدون باركود:</label>
              <div class="grid grid-cols-12 gap-1.5 items-center">
                <input id="qtIconInput" type="text" value="🥖" placeholder="أيقونة" class="col-span-2 px-2 py-1.5 rounded-xl border text-center font-bold">
                <input id="qtNameInput" type="text" placeholder="اسم السلعة (مثال: خبز / حليب / نسخ)..." class="col-span-5 px-2.5 py-1.5 rounded-xl border font-bold">
                <input id="qtPriceInput" type="number" step="any" placeholder="السعر د.ج" class="col-span-2 px-2 py-1.5 rounded-xl border font-mono font-black text-center">
                <button type="button" onclick="RetailV4.createCustomF7Button()"
                  class="col-span-3 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow">
                  + إضافة زر
                </button>
              </div>
            </div>

          </div>
        </div>
      `;

      // إغلاق قائمة اقتراحات المخزن عند النقر خارجها
      document.addEventListener('click', (e) => {
        const box = document.getElementById('v4F7WarehouseSuggestionsBox');
        const inp = document.getElementById('v4F7WarehouseLookupInput');
        if (box && !box.classList.contains('hidden') && !box.contains(e.target) && e.target !== inp) {
          box.classList.add('hidden');
        }
      });

      window.App.openQuickTouchModal = () => {
        this.renderF7CardsGrid();
        window.App.openModal('quickTouchPadModal');
      };
      window.App.renderQuickTouchPad = () => this.renderF7CardsGrid();

      this.renderUnifiedPinnedDock();
    },

    getF7Buttons() {
      return window.RetailV3 ? window.RetailV3.getQuickTouchButtons() : [];
    },

    saveF7Buttons(list) {
      if (window.RetailV3) {
        window.RetailV3.saveQuickTouchButtons(list);
      } else {
        localStorage.setItem('gherbi_quick_touch_buttons', JSON.stringify(list));
      }
      this.renderF7CardsGrid();
      this.renderUnifiedPinnedDock();
    },

    applyF7Preset(presetKey) {
      if (!window.RetailV3 || !window.RetailV3.retailQuickPresets[presetKey]) return;
      const preset = JSON.parse(JSON.stringify(window.RetailV3.retailQuickPresets[presetKey]));
      // الاحتفاظ بالمنتجات التي ربطها التاجر من مخزنه حتى لا تُمسح عند تبديل القالب
      const warehouseLinked = this.getF7Buttons().filter((b) => b.productId);
      this.saveF7Buttons([...warehouseLinked, ...preset]);
      if (window.showToast) window.showToast('✅ تم تحميل المجموعة السريعة مع الحفاظ على منتجات المخزن المربوطة', 'success');
    },

    renderWarehouseLookupSuggestions(query = '') {
      const box = document.getElementById('v4F7WarehouseSuggestionsBox');
      if (!box) return;
      const prods = (window.AppState.products || []).filter((p) => !p.hide_from_pos);
      const q = String(query || '').trim().toLowerCase();

      const matches = prods
        .filter((p) => !q || String(p.name || '').toLowerCase().includes(q) || String(p.barcode || '').toLowerCase().includes(q))
        .slice(0, 25);

      if (!matches.length) {
        box.innerHTML = '<div class="p-3 text-center text-slate-400 font-bold">لا يوجد منتج مطابق في المخزن</div>';
        box.classList.remove('hidden');
        return;
      }

      box.innerHTML = matches.map((p) => {
        const stk = Number(p.total_stock ?? p.stock ?? 0);
        const price = Number(p.selling_price || 0);
        return `
          <div onclick="RetailV4.linkWarehouseProductToF7(${p.id})"
            class="p-2.5 flex items-center justify-between hover:bg-blue-600/10 cursor-pointer transition">
            <div class="font-bold truncate">📦 ${p.name}</div>
            <div class="flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span class="font-black text-blue-600">${price.toFixed(2)} د.ج</span>
              <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">مخزون: ${stk}</span>
              <span class="px-2 py-0.5 rounded bg-blue-600 text-white font-sans font-black">+ ربط</span>
            </div>
          </div>
        `;
      }).join('');
      box.classList.remove('hidden');
    },

    linkWarehouseProductToF7(productId) {
      const prod = (window.AppState.products || []).find((p) => Number(p.id) === Number(productId));
      if (!prod) return;
      const list = this.getF7Buttons();
      if (list.some((b) => Number(b.productId) === Number(prod.id))) {
        if (window.showToast) window.showToast('هذا المنتج مربوط مسبقاً في لوحة اللمس السريع', 'info');
        document.getElementById('v4F7WarehouseSuggestionsBox')?.classList.add('hidden');
        return;
      }

      list.unshift({
        productId: prod.id,
        icon: '📦',
        name: prod.name,
        price: Number(prod.selling_price || 0),
        category: 'منتجات المخزن',
        pinned: true,
        noLoyalty: window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(prod.id) === 0 : false
      });

      const inp = document.getElementById('v4F7WarehouseLookupInput');
      if (inp) inp.value = '';
      document.getElementById('v4F7WarehouseSuggestionsBox')?.classList.add('hidden');

      this.saveF7Buttons(list);
      if (window.showToast) window.showToast(`✅ تم ربط "${prod.name}" بلوحة اللمس السريع وتثبيته في الشاشة`, 'success');
    },

    importFeaturedWarehouseProductsToF7() {
      const prods = (window.AppState.products || []).filter((p) => !p.hide_from_pos);
      if (!prods.length) {
        if (window.showToast) window.showToast('لا توجد منتجات في المخزن حالياً', 'warning');
        return;
      }
      const list = this.getF7Buttons();
      const featured = prods.filter((p) => p.is_featured);
      const pool = (featured.length ? featured : prods).slice(0, 10);
      let added = 0;

      pool.forEach((p) => {
        if (!list.some((b) => Number(b.productId) === Number(p.id))) {
          list.unshift({
            productId: p.id,
            icon: '📦',
            name: p.name,
            price: Number(p.selling_price || 0),
            category: 'منتجات المخزن',
            pinned: true,
            noLoyalty: window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(p.id) === 0 : false
          });
          added++;
        }
      });

      this.saveF7Buttons(list);
      if (window.showToast) {
        window.showToast(`📦 تم استيراد ${added} منتجات من المخزن إلى لوحة اللمس السريع بنجاح`, 'success');
      }
    },

    createCustomF7Button() {
      const icon = document.getElementById('qtIconInput')?.value?.trim() || '⚡';
      const name = document.getElementById('qtNameInput')?.value?.trim() || '';
      const price = parseFloat(document.getElementById('qtPriceInput')?.value || '0');

      if (!name || !Number.isFinite(price) || price < 0) {
        if (window.showToast) window.showToast('⚠️ يرجى إدخال اسم السلعة والسعر بشكل صحيح', 'warning');
        return;
      }

      const list = this.getF7Buttons();
      list.push({
        icon,
        name,
        price,
        category: 'سلع وخدمات يومية',
        pinned: true,
        noLoyalty: false
      });

      document.getElementById('qtNameInput').value = '';
      document.getElementById('qtPriceInput').value = '';
      this.saveF7Buttons(list);
      if (window.showToast) window.showToast(`✅ تمت إضافة الزر السريع "${name}"`, 'success');
    },

    renderF7CardsGrid() {
      const grid = document.getElementById('quickTouchButtonsGrid');
      const filterBar = document.getElementById('v4F7CatFilterBar');
      if (!grid) return;

      const list = this.getF7Buttons();
      const q = String(document.getElementById('v4F7SearchFilterInput')?.value || '').trim().toLowerCase();

      const cats = ['all', 'pinned', 'warehouse', ...new Set(list.map((b) => b.category || 'عام'))];
      if (filterBar) {
        const titles = { all: 'الكل', pinned: '📌 المثبتة في الكاشير', warehouse: '📦 منتجات المخزن' };
        filterBar.innerHTML = cats.map((c) => `
          <button type="button" onclick="RetailV4.activeF7Tab='${c}'; RetailV4.renderF7CardsGrid();"
            class="px-2.5 py-1 rounded-lg font-black text-[11px] whitespace-nowrap transition ${
              this.activeF7Tab === c ? 'bg-emerald-600 text-white shadow' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }">
            ${titles[c] || c}
          </button>
        `).join('');
      }

      const filtered = list
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
          if (this.activeF7Tab === 'pinned' && item.pinned === false) return false;
          if (this.activeF7Tab === 'warehouse' && !item.productId) return false;
          if (!['all', 'pinned', 'warehouse'].includes(this.activeF7Tab) && (item.category || 'عام') !== this.activeF7Tab) {
            return false;
          }
          if (!q) return true;
          return String(item.name || '').toLowerCase().includes(q) || String(item.category || '').toLowerCase().includes(q);
        });

      if (!filtered.length) {
        grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 font-bold">لا توجد أزرار سريعة في هذا القسم — أضف منتجاً من المخزن بالأسفل</div>';
        return;
      }

      grid.innerHTML = filtered.map(({ item, idx }) => {
        const prod = item.productId
          ? (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId))
          : null;
        const livePrice = prod ? Number(prod.selling_price || item.price || 0) : Number(item.price || 0);
        const liveName = prod ? prod.name : item.name;
        const stockBadge = prod
          ? `📦 مخزون: ${Number(prod.total_stock ?? prod.stock ?? 0)}`
          : '⚡ بيع فوري';
        const isPinned = item.pinned !== false;
        const isNoLoyalty = prod
          ? (window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(prod.id) === 0 : false)
          : Boolean(item.noLoyalty);

        return `
          <div onclick="RetailV4.triggerF7Button(${idx}, true)" class="v4-f7-tile ${prod ? 'tile-warehouse-linked' : ''}">
            <div class="flex items-center justify-between gap-1">
              <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-500">${stockBadge}</span>
              <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                <button type="button" onclick="RetailV4.togglePinF7Button(${idx})" title="تثبيت أو إخفاء من الشريط الرئيسي"
                  class="px-1.5 py-0.5 rounded text-[10px] font-black ${isPinned ? 'bg-amber-500/20 text-amber-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}">📌</button>
                <button type="button" onclick="RetailV4.openEditQuickButtonModal(${idx})" title="تعديل السعر أو الاسم"
                  class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 text-[10px]">✏️</button>
                <button type="button" onclick="RetailV4.deleteF7Button(${idx})" title="حذف الزر"
                  class="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 text-[10px]">✕</button>
              </div>
            </div>

            <div class="font-black text-xs text-slate-800 dark:text-slate-100 my-1 line-clamp-2">
              <span>${item.icon || '⚡'}</span>
              <span>${liveName}</span>
            </div>

            <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <span class="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">${livePrice.toFixed(2)} د.ج</span>
              ${isNoLoyalty ? '<span class="text-[9.5px] font-bold text-rose-500">🚫 بدون نقاط</span>' : '<span class="text-[9.5px] font-bold text-amber-500">👑 يمنح نقاطاً</span>'}
            </div>
          </div>
        `;
      }).join('');
    },

    renderUnifiedPinnedDock() {
      document.getElementById('posQuickTouchStrip')?.remove();
      const dock = document.getElementById('gherbiPinnedQuickDock');
      if (!dock) return;

      const list = this.getF7Buttons();
      const pinned = list.map((b, idx) => ({ b, idx })).filter(({ b }) => b.pinned !== false);

      dock.innerHTML = `
        <button type="button" onclick="App.openQuickTouchModal()"
          class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shrink-0 flex items-center gap-1 shadow-sm">
          <span>⚡</span>
          <span>لمس سريع (F7)</span>
        </button>
        ${pinned.map(({ b, idx }) => {
          const prod = b.productId
            ? (window.AppState.products || []).find((p) => Number(p.id) === Number(b.productId))
            : null;
          const price = prod ? Number(prod.selling_price || b.price || 0) : Number(b.price || 0);
          const name = prod ? prod.name : b.name;
          return `
            <div onclick="RetailV4.triggerF7Button(${idx}, false)"
                 oncontextmenu="event.preventDefault(); RetailV4.openEditQuickButtonModal(${idx});"
                 class="gherbi-pinned-f7-chip" title="اضغط للبيع الفوري | نقرة يمين لتعديل السعر أو الخصائص">
              <span>${b.icon || '⚡'}</span>
              <span>${name}</span>
              <span class="font-mono font-black text-emerald-600 dark:text-emerald-400">(${price.toFixed(0)} د.ج)</span>
            </div>
          `;
        }).join('')}
      `;
    },

    triggerF7Button(idx, closeModalAfter = false) {
      const list = this.getF7Buttons();
      const item = list[idx];
      if (!item || !window.App) return;

      if (item.productId) {
        const prod = (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId));
        if (prod && typeof window.App.addProductToCart === 'function') {
          window.App.addProductToCart(prod.id, 1);
          if (closeModalAfter) window.App.closeModal('quickTouchPadModal');
          if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
          return;
        }
      }

      if (window.RetailV3) {
        window.RetailV3.triggerQuickTouchItem(idx);
      }
      if (closeModalAfter) window.App.closeModal('quickTouchPadModal');
    },

    togglePinF7Button(idx) {
      const list = this.getF7Buttons();
      if (!list[idx]) return;
      list[idx].pinned = list[idx].pinned === false ? true : false;
      this.saveF7Buttons(list);
    },

    deleteF7Button(idx) {
      const list = this.getF7Buttons();
      if (!list[idx]) return;
      list.splice(idx, 1);
      this.saveF7Buttons(list);
    },

    openEditQuickButtonModal(idx) {
      const list = this.getF7Buttons();
      const item = list[idx];
      if (!item) return;
      this.buildCustomDialogModalsDom();

      const prod = item.productId
        ? (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId))
        : null;

      document.getElementById('qbEditIndexInput').value = String(idx);
      document.getElementById('qbEditIconInput').value = item.icon || '⚡';
      document.getElementById('qbEditNameInput').value = prod ? prod.name : (item.name || '');
      document.getElementById('qbEditPriceInput').value = prod ? Number(prod.selling_price || 0) : Number(item.price || 0);
      document.getElementById('qbEditCatInput').value = item.category || 'خدمات سريعة';
      document.getElementById('qbEditPinnedCheck').checked = item.pinned !== false;
      document.getElementById('qbEditNoLoyaltyCheck').checked = Boolean(item.noLoyalty);

      window.App.openModal('quickBtnEditModal');
      setTimeout(() => document.getElementById('qbEditPriceInput')?.focus(), 50);
    },

    saveEditedQuickButton() {
      const idx = parseInt(document.getElementById('qbEditIndexInput')?.value || '-1', 10);
      const list = this.getF7Buttons();
      if (!list[idx]) return;

      list[idx].icon = document.getElementById('qbEditIconInput')?.value?.trim() || '⚡';
      list[idx].name = document.getElementById('qbEditNameInput')?.value?.trim() || list[idx].name;
      list[idx].price = Math.max(0, parseFloat(document.getElementById('qbEditPriceInput')?.value || '0') || 0);
      list[idx].category = document.getElementById('qbEditCatInput')?.value?.trim() || 'خدمات سريعة';
      list[idx].pinned = Boolean(document.getElementById('qbEditPinnedCheck')?.checked);
      list[idx].noLoyalty = Boolean(document.getElementById('qbEditNoLoyaltyCheck')?.checked);

      if (list[idx].productId) {
        const prod = (window.AppState.products || []).find((p) => Number(p.id) === Number(list[idx].productId));
        if (prod) prod.selling_price = list[idx].price;
        if (window.RetailV3) {
          const map = JSON.parse(localStorage.getItem('gherbi_product_loyalty_policies') || '{}');
          map[list[idx].productId] = list[idx].noLoyalty ? 0 : 1;
          localStorage.setItem('gherbi_product_loyalty_policies', JSON.stringify(map));
        }
      }

      this.saveF7Buttons(list);
      window.App.closeModal('quickBtnEditModal');
      if (window.showToast) window.showToast('✅ تم حفظ تعديلات الزر السريع بنجاح', 'success');
    },

    // ========================================================================
    // المحور 5: محرك "فارق النقاط الذكي (Delta Loyalty Points Engine)" عند تعديل مبيعة سابقة من السجل
    // ========================================================================
    computeCartEligiblePoints(items = [], discount = 0) {
      let eligibleRevenueDzd = 0;
      items.forEach((it) => {
        if (it._noLoyalty) return;
        const lineSub = Number(it.subtotal ?? (Number(it.quantity || 1) * Number(it.price || 0)));
        const pid = it.product_id || it.productId;
        const mult = pid && window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(pid) : 1;
        eligibleRevenueDzd += lineSub * mult;
      });
      const netEligible = Math.max(0, eligibleRevenueDzd - Number(discount || 0));
      // كل 100 د.ج من المشتريات المؤهلة تمنح 1 نقطة ولاء
      return Math.floor(netEligible / 100);
    },

    getInvoiceLoyaltyLedger() {
      try {
        return JSON.parse(localStorage.getItem('gherbi_invoice_loyalty_ledger') || '{}');
      } catch (_) {
        return {};
      }
    },

    saveInvoiceLoyaltyLedger(ledger) {
      try {
        localStorage.setItem('gherbi_invoice_loyalty_ledger', JSON.stringify(ledger));
      } catch (_) {}
    },

    activateDeltaLoyaltyPointsEngine() {
      // التقاط بصمة الفاتورة الأصلية فور تحميلها في السلة للتعديل
      const captureEditInvoiceSnapshot = () => {
        const cart = window.App?.currentCart;
        if (!cart) return;
        const editSaleId = cart.editingSaleId || window.AppState?.editingSaleId;

        if (editSaleId && String(cart._snapshotSaleId) !== String(editSaleId)) {
          const ledger = this.getInvoiceLoyaltyLedger();
          const recordedEntry = ledger[editSaleId];

          const baselinePoints = recordedEntry && recordedEntry.earnedPoints !== undefined
            ? Number(recordedEntry.earnedPoints)
            : this.computeCartEligiblePoints(cart.items || [], cart.discount || 0);

          cart._snapshotSaleId = editSaleId;
          cart._snapshotOriginalCustomerId = recordedEntry?.customerId ?? (cart.customerId || null);
          cart._snapshotOriginalEarnedPoints = baselinePoints;
        } else if (!editSaleId && cart._snapshotSaleId) {
          delete cart._snapshotSaleId;
          delete cart._snapshotOriginalCustomerId;
          delete cart._snapshotOriginalEarnedPoints;
        }
      };

      setInterval(captureEditInvoiceSnapshot, 250);

      // اعتراض إتمام البيع لتطبيق الفارق فقط (Delta = NewPoints - OldPoints) عند تعديل فاتورة سابقة
      const hookCheckoutMethod = (methodName) => {
        const origFn = window.App[methodName]?.bind(window.App);
        if (!origFn || window.App['_v4DeltaLoyalty_' + methodName]) return;

        window.App[methodName] = async function (...args) {
          const cart = window.App.currentCart;
          const editSaleId = cart?.editingSaleId || window.AppState?.editingSaleId || cart?._snapshotSaleId;
          const isEditingSale = Boolean(editSaleId);

          const currentCustomerId = Number(cart?.customerId || 0);
          const originalCustomerId = Number(cart?._snapshotOriginalCustomerId || currentCustomerId || 0);
          const oldEarnedPoints = Number(cart?._snapshotOriginalEarnedPoints ?? 0);
          const newEarnedPoints = RetailV4.computeCartEligiblePoints(cart?.items || [], cart?.discount || 0);
          const redeemedInThisSession = Number(cart?._redeemedPoints || 0);

          // حفظ أرصدة الزبائن الدقيقة قبل أن يقوم الكود الخلفي بإضافة نقاط الفاتورة كاملة مرة ثانية
          const customersList = window.AppState.customers || [];
          const currentCustObj = currentCustomerId ? customersList.find((c) => Number(c.id) === currentCustomerId) : null;
          const origCustObj = originalCustomerId ? customersList.find((c) => Number(c.id) === originalCustomerId) : null;

          const curCustBalanceBefore = currentCustObj ? Number(currentCustObj.loyalty_points || 0) : 0;
          const origCustBalanceBefore = origCustObj ? Number(origCustObj.loyalty_points || 0) : 0;

          const res = await origFn(...args);

          // بعد نجاح حفظ الفاتورة، نضبط رصيد نقاط الولاء وفق معادلة الفارق الصارمة (Delta Engine)
          const ledger = RetailV4.getInvoiceLoyaltyLedger();

          if (isEditingSale) {
            if (currentCustomerId && currentCustomerId === originalCustomerId && currentCustObj) {
              // نفس الزبون الوفي: نضيف الفارق فقط (الجديد ناقص القديم)
              const deltaPts = newEarnedPoints - oldEarnedPoints;
              const correctedBalance = Math.max(0, curCustBalanceBefore + deltaPts - redeemedInThisSession);

              currentCustObj.loyalty_points = correctedBalance;
              if (window.api?.updateCustomer) {
                await window.api.updateCustomer(currentCustomerId, {
                  ...currentCustObj,
                  loyalty_points: correctedBalance
                }).catch(() => {});
              }

              ledger[editSaleId] = { customerId: currentCustomerId, earnedPoints: newEarnedPoints, updatedAt: Date.now() };
              RetailV4.saveInvoiceLoyaltyLedger(ledger);

              if (window.showToast) {
                const sign = deltaPts >= 0 ? '+' + deltaPts : String(deltaPts);
                window.showToast(
                  `👑 تسوية نقاط الفاتورة المعدلة: السابق (${oldEarnedPoints}) ⬅ الجديد (${newEarnedPoints}) | تم احتساب الفارق فقط (${sign} نقطة)`,
                  'info'
                );
              }
            } else {
              // في حال تم تغيير الزبون أثناء تعديل الفاتورة: نخصم النقاط القديمة من الزبون الأول ونمنح النقاط الجديدة للزبون الثاني
              if (originalCustomerId && origCustObj) {
                const revertedOrigBalance = Math.max(0, origCustBalanceBefore - oldEarnedPoints);
                origCustObj.loyalty_points = revertedOrigBalance;
                if (window.api?.updateCustomer) {
                  await window.api.updateCustomer(originalCustomerId, {
                    ...origCustObj,
                    loyalty_points: revertedOrigBalance
                  }).catch(() => {});
                }
              }
              if (currentCustomerId && currentCustObj) {
                const newCustBalance = Math.max(0, curCustBalanceBefore + newEarnedPoints - redeemedInThisSession);
                currentCustObj.loyalty_points = newCustBalance;
                if (window.api?.updateCustomer) {
                  await window.api.updateCustomer(currentCustomerId, {
                    ...currentCustObj,
                    loyalty_points: newCustBalance
                  }).catch(() => {});
                }
              }
              ledger[editSaleId] = { customerId: currentCustomerId || null, earnedPoints: newEarnedPoints, updatedAt: Date.now() };
              RetailV4.saveInvoiceLoyaltyLedger(ledger);
            }
          } else if (currentCustomerId && currentCustObj) {
            // فاتورة بيع جديدة: نضمن احتساب النقاط من المنتجات المؤهلة فقط (واستثناء منتجات 0% نقاط)
            const exactNewBalance = Math.max(0, curCustBalanceBefore + newEarnedPoints - redeemedInThisSession);
            currentCustObj.loyalty_points = exactNewBalance;
            if (window.api?.updateCustomer) {
              await window.api.updateCustomer(currentCustomerId, {
                ...currentCustObj,
                loyalty_points: exactNewBalance
              }).catch(() => {});
            }

            // حفظ بصمة آخر فاتورة في الدفتر
            const latestSaleId = window.AppState.sales?.[0]?.id;
            if (latestSaleId) {
              ledger[latestSaleId] = { customerId: currentCustomerId, earnedPoints: newEarnedPoints, updatedAt: Date.now() };
              RetailV4.saveInvoiceLoyaltyLedger(ledger);
            }
          }

          window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
          return res;
        };

        window.App['_v4DeltaLoyalty_' + methodName] = true;
      };

      hookCheckoutMethod('submitSale');
      hookCheckoutMethod('instantConfirmAndCheckout');
    },

    // ========================================================================
    // المحور 6: إعادة هيكلة وتنظيف نافذة (إضافة / تعديل منتج #productModal) والباركودات المتعددة
    // ========================================================================
    overhaulProductModalAndMultiBarcodes() {
      const prodModal = document.getElementById('productModal');
      if (!prodModal) return;

      // 1. إضافة زر صغير في رأس النافذة لإظهار/إخفاء تبويبات التصنيع والمتغيرات المتقدمة عند الحاجة فقط
      const modalHeader = prodModal.querySelector('.flex.items-center.justify-between');
      if (modalHeader && !document.getElementById('btnToggleAdvancedProdTabs')) {
        const advBtn = document.createElement('button');
        advBtn.id = 'btnToggleAdvancedProdTabs';
        advBtn.type = 'button';
        advBtn.className = 'px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 text-[10.5px] font-bold mr-auto ml-3';
        advBtn.textContent = '⚙️ إظهار خيارات التصنيع والمتغيرات';
        advBtn.onclick = () => {
          const shown = prodModal.classList.toggle('show-advanced-manufacturing-tabs');
          advBtn.textContent = shown ? '⬆️ إخفاء الخيارات المتقدمة (وضع التجزئة)' : '⚙️ إظهار خيارات التصنيع والمتغيرات';
        };
        modalHeader.insertBefore(advBtn, modalHeader.lastElementChild);
      }

      // 2. إزالة تكرار صندوق السوبرماركت وعروض BOGO من أسفل النافذة ونقله للتبويب الثالث فقط
      const bogoBox = document.getElementById('supermarketRetailBogoSection') ||
        Array.from(prodModal.querySelectorAll('div')).find((d) => d.textContent.includes('إعدادات السوبرماركت، الرفوف، وعروض المجاني'));
      const tab3 = document.getElementById('prodTab3');
      if (bogoBox && tab3) {
        tab3.appendChild(bogoBox);
        // إخفاء حقل موقع السلعة في الرف المكرر داخل صندوق BOGO لأنه موجود في التبويب الأول
        const dupShelfInp = document.getElementById('prodShelfLocationInput');
        if (dupShelfInp && dupShelfInp.parentElement) {
          dupShelfInp.parentElement.style.display = 'none';
        }
      }

      // 3. تنظيف التبويب الثاني (الأسعار، الفائدة، والكارطون) وإضافة حقل "السعر الإجمالي للكارطون/الحزمة"
      const tab2 = document.getElementById('prodTab2');
      if (tab2) {
        // إخفاء حقل هامش الربح المكرر
        Array.from(tab2.querySelectorAll('input')).forEach((inp) => {
          if (inp.id !== 'prodMarkupInput' && (inp.placeholder || '').includes('25%')) {
            const holder = inp.closest('.flex, div');
            if (holder && holder !== tab2) holder.style.display = 'none';
          }
        });

        const packUnitPriceInp = document.getElementById('prodWholesaleInput');
        const packQtyInp = document.getElementById('prodWholesaleMinQtyInput');

        if (packUnitPriceInp && packQtyInp && !document.getElementById('prodTotalCartonPriceInput')) {
          const totalCartonWrap = document.createElement('div');
          totalCartonWrap.innerHTML = `
            <label class="block text-xs font-black text-emerald-600 dark:text-emerald-400 mb-1">
              💰 السعر الإجمالي للكارطون / الحزمة كاملة (د.ج) :
            </label>
            <input id="prodTotalCartonPriceInput" type="number" step="any" placeholder="مثال: 270 د.ج للكارطون كامل..."
              class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500/60 font-mono font-black text-center text-emerald-600">
            <span class="text-[10px] text-slate-400 font-bold block mt-0.5">يتزامن تلقائياً مع سعر الحبة داخل الكارطون × عدد الحبات</span>
          `;
          packUnitPriceInp.parentElement.insertAdjacentElement('afterend', totalCartonWrap);

          const totalCartonInp = document.getElementById('prodTotalCartonPriceInput');

          // مزامنة ثنائية الاتجاه بين (سعر الحبة داخل الكارطون × عدد الحبات) و (السعر الإجمالي للكارطون)
          const syncFromUnitAndQty = () => {
            const unitP = parseFloat(packUnitPriceInp.value || '0') || 0;
            const qty = Math.max(1, parseFloat(packQtyInp.value || '1') || 1);
            if (unitP > 0) {
              totalCartonInp.value = (unitP * qty).toFixed(2);
            } else {
              totalCartonInp.value = '';
            }
          };

          const syncFromTotalCarton = () => {
            const totP = parseFloat(totalCartonInp.value || '0') || 0;
            const qty = Math.max(1, parseFloat(packQtyInp.value || '1') || 1);
            if (totP > 0) {
              packUnitPriceInp.value = (totP / qty).toFixed(2);
            }
          };

          packUnitPriceInp.addEventListener('input', syncFromUnitAndQty);
          packQtyInp.addEventListener('input', syncFromUnitAndQty);
          totalCartonInp.addEventListener('input', syncFromTotalCarton);
        }
      }

      // 4. تطوير التبويب الثالث (الباركودات المتعددة لنفس المنتج أو للكارطون)
      if (tab3) {
        let toolbar = document.getElementById('v4MultiBarcodeToolbar');
        if (!toolbar) {
          toolbar = document.createElement('div');
          toolbar.id = 'v4MultiBarcodeToolbar';
          tab3.insertBefore(toolbar, tab3.firstChild);
        }
        toolbar.className = 'flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 mb-3';
        toolbar.innerHTML = `
          <div class="text-xs">
            <div class="font-black text-blue-700 dark:text-blue-300">🏷️ إدارة الباركودات المتعددة لنفس المنتج أو للكارطون:</div>
            <div class="text-[10.5px] text-slate-500">أضف أي عدد من الباركودات الإضافية لنفس السلعة (الأذواق/الدفعات المختلفة بنفس المخزون) أو باركود الكارطون الخارجي</div>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="RetailV4.addMultiBarcodeRow({ unit_label: 'نفس الحبة (باركود إضافي)', pack_factor: 1, price_tier: '' })"
              class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm">
              🏷️ + باركود إضافي لنفس الحبة (×1)
            </button>
            <button type="button" onclick="RetailV4.addCartonMultiBarcodeRow()"
              class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-sm">
              📦 + باركود كارطون / حزمة (×الشد)
            </button>
          </div>
        `;

        // إخفاء أي زر قديم مكرر لإضافة باركود فرعي خارج الشريط الجديد
        Array.from(tab3.querySelectorAll('button')).forEach((b) => {
          if (b.textContent.includes('إضافة باركود فرعي') && !toolbar.contains(b)) {
            if (b.parentElement && b.parentElement !== tab3) b.parentElement.style.display = 'none';
            else b.style.display = 'none';
          }
        });
      }

      window.App.addMultiBarcodeRow = (data = {}) => this.addMultiBarcodeRow(data);
      this.hookMultiBarcodePersistenceAndScanner();
    },

    addCartonMultiBarcodeRow() {
      const packQty = Math.max(2, parseFloat(document.getElementById('prodWholesaleMinQtyInput')?.value || '6') || 6);
      const totalCartonP = parseFloat(document.getElementById('prodTotalCartonPriceInput')?.value || '0');
      const unitPackP = parseFloat(document.getElementById('prodWholesaleInput')?.value || '0');
      const packTotal = totalCartonP > 0 ? totalCartonP : (unitPackP > 0 ? Number((unitPackP * packQty).toFixed(2)) : '');
      this.addMultiBarcodeRow({
        unit_label: document.getElementById('prodPackNameInput')?.value || 'كارطون / حزمة',
        pack_factor: packQty,
        price_tier: packTotal
      });
    },

    addMultiBarcodeRow(data = {}) {
      const list = document.getElementById('prodMultiBarcodesList');
      if (!list) return;
      const factor = Math.max(1, Number(data.pack_factor || 1));
      const isSingle = factor === 1;

      const row = document.createElement('div');
      row.className = 'multi-barcode-row grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mb-2';
      row.innerHTML = `
        <div class="col-span-5">
          <label class="text-[10px] font-black ${isSingle ? 'text-blue-600' : 'text-indigo-600'}">
            ${isSingle ? '🏷️ باركود إضافي لنفس الحبة' : '📦 باركود الكارطون / الحزمة'}
          </label>
          <input type="text" oninput="RetailV4.validateSubBarcodeUniqueness(this)"
            class="mb-code w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-black border"
            placeholder="امسح أو اكتب الباركود الإضافي..." value="${data.barcode || ''}">
          <span class="mb-dup-warn text-[9.5px] font-black text-rose-600 hidden"></span>
        </div>
        <div class="col-span-3">
          <label class="text-[10px] text-slate-500 font-bold">البيان / النكهة / العبوة</label>
          <input type="text" class="mb-label w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border"
            placeholder="${isSingle ? 'نفس الحبة / دفعة 2' : 'كارطون / حزمة'}"
            value="${data.unit_label || (isSingle ? 'نفس الحبة' : 'كارطون / حزمة')}">
        </div>
        <div class="col-span-2">
          <label class="text-[10px] text-blue-600 font-bold">الشد (عدد الحبات)</label>
          <input type="number" step="1" min="1" class="mb-factor w-full px-2 py-1.5 rounded-lg text-xs font-mono font-black text-center border"
            value="${factor}">
        </div>
        <div class="col-span-1">
          <label class="text-[10px] text-emerald-600 font-bold">سعر العبوة</label>
          <input type="number" step="any" class="mb-tier w-full px-1 py-1.5 rounded-lg text-xs font-mono font-bold text-center border text-emerald-600"
            placeholder="نفس السعر" value="${data.price_tier && !isNaN(Number(data.price_tier)) ? data.price_tier : ''}">
        </div>
        <div class="col-span-1 pt-4 text-center">
          <button type="button" onclick="this.closest('.multi-barcode-row').remove()" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg font-black">✕</button>
        </div>
      `;
      list.appendChild(row);
      row.querySelector('.mb-code')?.focus();
    },

    validateSubBarcodeUniqueness(inputEl) {
      const code = String(inputEl?.value || '').trim();
      const warnEl = inputEl?.parentElement?.querySelector('.mb-dup-warn');
      if (!warnEl) return;
      if (!code) {
        warnEl.classList.add('hidden');
        return;
      }
      const curProdId = Number(document.getElementById('prodEditId')?.value || 0);
      const conflictProd = (window.AppState.products || []).find(
        (p) => Number(p.id) !== curProdId && String(p.barcode || '').trim() === code
      );
      if (conflictProd) {
        warnEl.textContent = `⚠️ مسجل مسبقاً للمنتج: ${conflictProd.name}`;
        warnEl.classList.remove('hidden');
      } else {
        warnEl.classList.add('hidden');
      }
    },

    getMultiBarcodesStore() {
      try {
        return JSON.parse(localStorage.getItem('gherbi_product_multi_barcodes_map') || '{}');
      } catch (_) {
        return {};
      }
    },

    saveMultiBarcodesStore(map) {
      try {
        localStorage.setItem('gherbi_product_multi_barcodes_map', JSON.stringify(map));
      } catch (_) {}
    },

    hookMultiBarcodePersistenceAndScanner() {
      // 1. استرجاع الباركودات المتعددة والسعر الإجمالي للكارطون عند فتح نافذة تعديل المنتج
      const origOpenProd = window.App.openProductModal?.bind(window.App);
      if (origOpenProd && !window.App._v4OpenProdMultiHooked) {
        window.App.openProductModal = function (product = null) {
          const res = origOpenProd(product);
          setTimeout(() => {
            const pid = product && typeof product === 'object' ? product.id : product;
            const prodObj = pid ? (window.AppState.products || []).find((p) => Number(p.id) === Number(pid)) : null;

            // تحديث السعر الإجمالي للكارطون في التبويب الثاني
            const unitPackP = parseFloat(document.getElementById('prodWholesaleInput')?.value || '0') || 0;
            const packQty = Math.max(1, parseFloat(document.getElementById('prodWholesaleMinQtyInput')?.value || '1') || 1);
            const totCartonInp = document.getElementById('prodTotalCartonPriceInput');
            if (totCartonInp) {
              totCartonInp.value = unitPackP > 0 ? (unitPackP * packQty).toFixed(2) : '';
            }

            // تحميل الباركودات المتعددة المحفوظة لهذا المنتج
            const listEl = document.getElementById('prodMultiBarcodesList');
            if (listEl && listEl.children.length === 0 && pid) {
              const store = RetailV4.getMultiBarcodesStore();
              const savedRows = store[pid] || (prodObj && Array.isArray(prodObj.multi_barcodes) ? prodObj.multi_barcodes : []);
              if (Array.isArray(savedRows) && savedRows.length > 0) {
                savedRows.forEach((r) => RetailV4.addMultiBarcodeRow(r));
              }
            }
          }, 80);
          return res;
        };
        window.App._v4OpenProdMultiHooked = true;
      }

      // 2. حفظ الباركودات المتعددة عند حفظ المنتج
      const origSaveProd = window.App.saveProduct?.bind(window.App);
      if (origSaveProd && !window.App._v4SaveProdMultiHooked) {
        window.App.saveProduct = async function (...args) {
          const editId = document.getElementById('prodEditId')?.value;
          const prodName = document.getElementById('prodNameInput')?.value?.trim();
          const rows = Array.from(document.querySelectorAll('#prodMultiBarcodesList .multi-barcode-row'))
            .map((r) => ({
              barcode: String(r.querySelector('.mb-code')?.value || '').trim(),
              unit_label: String(r.querySelector('.mb-label')?.value || 'نفس الحبة').trim(),
              pack_factor: Math.max(1, parseFloat(r.querySelector('.mb-factor')?.value || '1') || 1),
              price_tier: String(r.querySelector('.mb-tier')?.value || '').trim()
            }))
            .filter((r) => r.barcode.length > 0);

          const res = await origSaveProd(...args);

          // تحديد معرف المنتج المحفوظ
          const targetProd = editId
            ? (window.AppState.products || []).find((p) => Number(p.id) === Number(editId))
            : (window.AppState.products || []).find((p) => p.name === prodName);

          const finalPid = editId || targetProd?.id;
          if (finalPid) {
            const store = RetailV4.getMultiBarcodesStore();
            store[finalPid] = rows;
            RetailV4.saveMultiBarcodesStore(store);
            if (targetProd) {
              targetProd.multi_barcodes = rows;
            }
          }
          return res;
        };
        window.App._v4SaveProdMultiHooked = true;
      }

      // 3. ربط قارئ الباركود في الكاشير وفاحص السعر (F6) للبحث في الباركودات المتعددة فوراً
      const findProductByAnyBarcode = (code) => {
        const clean = String(code || '').trim();
        if (!clean) return null;
        const products = window.AppState.products || [];
        const store = this.getMultiBarcodesStore();

        for (const p of products) {
          const multiList = store[p.id] || p.multi_barcodes || [];
          if (Array.isArray(multiList)) {
            const hit = multiList.find((m) => String(m.barcode || '').trim() === clean);
            if (hit) return { product: p, subBarcode: hit };
          }
        }
        return null;
      };

      const origScan = window.App.handleBarcodeScan?.bind(window.App);
      if (origScan && !window.App._v4MasterScanHooked) {
        window.App.handleBarcodeScan = async function (rawCode) {
          const hit = findProductByAnyBarcode(rawCode);
          if (hit) {
            const { product, subBarcode } = hit;
            const factor = Math.max(1, Number(subBarcode.pack_factor || 1));
            const customPrice = parseFloat(subBarcode.price_tier);

            window.App.addProductToCart(product.id, factor);

            if (Number.isFinite(customPrice) && customPrice > 0) {
              const items = window.App.currentCart?.items || [];
              const cartItem = items.find((it) => Number(it.product_id || it.productId) === Number(product.id));
              if (cartItem) {
                const unitP = customPrice > Number(product.selling_price || 0) && factor > 1
                  ? Number((customPrice / factor).toFixed(2))
                  : customPrice;
                cartItem.price = unitP;
                cartItem.subtotal = Number((Number(cartItem.quantity || 1) * unitP).toFixed(2));
                window.App.recalcAndRenderCart();
              }
            }
            if (window.showToast) {
              window.showToast(`🏷️ تم مسح ${subBarcode.unit_label || 'باركود إضافي'}: ${product.name} (×${factor})`, 'success');
            }
            return;
          }
          return origScan(rawCode);
        };
        window.App._v4MasterScanHooked = true;
      }
    }
  };

  window.RetailV4 = RetailV4;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailV4.init());
  } else {
    RetailV4.init();
  }
})();
