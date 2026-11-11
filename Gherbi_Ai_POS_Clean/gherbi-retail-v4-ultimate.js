/**
 * gherbi-retail-v4-ultimate.js
 * المحرك الهندسي الشامل للإصدار الرابع (Enterprise Retail POS V4)
 */

'use strict';

(function initGherbiRetailV4Ultimate() {
  const RetailV4 = {
    activeF7Category: 'all',

    init() {
      const waitApp = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(waitApp);
        this.executeAllV4Modules();
      }, 200);
    },

    executeAllV4Modules() {
      const modules = [
        'buildCustomModalsDom',
        'fixManagerPinChangeAndDeduplicateLogs',
        'eliminateDuplicateF7StripInPos',
        'enableZeroClickInstantChangeCalculator',
        'upgradeF7QuickTouchStudioWithInventory',
        'setupDeltaLoyaltyPointsOnSaleEdit',
        'overhaulProductModalForRetailAndMultiBarcodes'
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
    // المحور 1: نافذة تغيير كود المدير السري (بديلة prompt) + منع تكرار سجل الرقابة
    // ========================================================================
    buildCustomModalsDom() {
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
                  <p class="text-[10.5px] text-slate-400">يُستخدم هذا الكود لحماية تعديل نقاط الوفاء والعمليات الحساسة</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="text-slate-400 hover:text-rose-500 font-black text-sm">✕</button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">1. الكود السري الحالي (الافتراضي: 1234) * :</label>
                <input id="mgrPinCurrentInput" type="password" placeholder="أدخل الكود الحالي..."
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>

              <div>
                <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">2. الكود السري الجديد (3 إلى 10 أرقام/حروف) * :</label>
                <input id="mgrPinNewInput" type="password" placeholder="أدخل الكود السري الجديد..."
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-base tracking-widest">
              </div>

              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">3. تأكيد الكود السري الجديد * :</label>
                <input id="mgrPinConfirmInput" type="password" placeholder="أعد كتابة الكود الجديد..."
                  onkeydown="if(event.key==='Enter') RetailV4.saveNewManagerPin()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="RetailV4.saveNewManagerPin()"
                class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg">
                ✔ حفظ الكود السري الجديد
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(pinModal);
      }

      if (!document.getElementById('quickBtnEditModal')) {
        const qbModal = document.createElement('div');
        qbModal.id = 'quickBtnEditModal';
        qbModal.className = 'modal-overlay';
        qbModal.innerHTML = `
          <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <h3 class="text-sm font-black text-emerald-600">✏️ تعديل زر اللمس السريع</h3>
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
                <label class="block font-bold mb-1">القسم</label>
                <input id="qbEditCatInput" type="text" class="w-full px-3 py-2 rounded-xl border font-bold">
              </div>
              <div class="col-span-12 flex items-center justify-between pt-2">
                <label class="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input id="qbEditPinnedCheck" type="checkbox" class="rounded text-emerald-600">
                  <span>📌 إظهار في الشريط المثبت بالكاشير</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer font-bold text-amber-600">
                  <input id="qbEditNoLoyaltyCheck" type="checkbox" class="rounded text-amber-500">
                  <span>🚫 استثناء من نقاط الوفاء</span>
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

    openChangeManagerPinModal() {
      this.buildCustomModalsDom();
      document.getElementById('mgrPinCurrentInput').value = '';
      document.getElementById('mgrPinNewInput').value = '';
      document.getElementById('mgrPinConfirmInput').value = '';
      window.App.openModal('changeManagerPinModal');
      setTimeout(() => document.getElementById('mgrPinCurrentInput')?.focus(), 60);
    },

    saveNewManagerPin() {
      const curPin = window.RetailV3 ? window.RetailV3.getManagerSecretPin() : (localStorage.getItem('gherbi_manager_loyalty_pin') || '1234');
      const enteredOld = String(document.getElementById('mgrPinCurrentInput')?.value || '').trim();
      const enteredNew = String(document.getElementById('mgrPinNewInput')?.value || '').trim();
      const enteredConfirm = String(document.getElementById('mgrPinConfirmInput')?.value || '').trim();

      if (enteredOld !== curPin) {
        if (window.showToast) window.showToast('❌ الكود السري الحالي غير صحيح!', 'error');
        document.getElementById('mgrPinCurrentInput')?.focus();
        return;
      }
      if (enteredNew.length < 3) {
        if (window.showToast) window.showToast('⚠️ يرجى إدخال كود سري جديد مكون من 3 أرقام أو حروف على الأقل', 'warning');
        document.getElementById('mgrPinNewInput')?.focus();
        return;
      }
      if (enteredNew !== enteredConfirm) {
        if (window.showToast) window.showToast('⚠️ الكود الجديد وتأكيده غير متطابقين!', 'warning');
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
        window.showToast('✅ تم تغيير كود المدير السري (PIN) وحفظه بنجاح!', 'success');
      }
    },

    fixManagerPinChangeAndDeduplicateLogs() {
      if (window.RetailV3) {
        window.RetailV3.changeManagerLoyaltyPinPrompt = () => this.openChangeManagerPinModal();
        window.RetailV3.quickEditQuickButtonPrice = (idx) => this.openEditQuickButtonModal(idx);

        // منع إرسال سجل التعديل أكثر من مرة عند الضغط السريع
        const origConfirm = window.RetailV3.confirmManagerPinPointsChange?.bind(window.RetailV3);
        if (origConfirm && !window.RetailV3._v4PinGuard) {
          window.RetailV3.confirmManagerPinPointsChange = async function () {
            if (this._pinBusy) return;
            this._pinBusy = true;
            try {
              await origConfirm();
            } finally {
              setTimeout(() => { this._pinBusy = false; }, 800);
            }
          };
          window.RetailV3._v4PinGuard = true;
        }
      }

      // إزالة أي صفوف مكررة في جدول سجل رقابة المدير عند فتح صفحة التقارير
      const deduplicateAuditTableDom = () => {
        const card = document.getElementById('ownerLoyaltyPointsAuditCard');
        if (!card) return;
        const rows = Array.from(card.querySelectorAll('tbody tr'));
        const seen = new Set();
        let validCount = 0;
        rows.forEach((tr) => {
          const cols = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
          // بصمة الصف: اسم الزبون + الرصيد السابق + الرصيد الجديد + السبب + الدقيقة
          const timeMinute = (cols[0] || '').slice(0, 16);
          const key = [timeMinute, cols[2], cols[3], cols[4], cols[6]].join('|');
          if (seen.has(key)) {
            tr.remove();
          } else {
            seen.add(key);
            validCount++;
          }
        });
        const h3 = card.querySelector('h3');
        if (h3) h3.textContent = `سجل رقابة المدير: تعديلات رصيد نقاط الوفاء (${validCount})`;
      };

      const origAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (origAnalytics && !window.App._v4DedupAnalyticsHooked) {
        window.App.renderAnalyticsView = async function (...args) {
          const r = await origAnalytics(...args);
          setTimeout(deduplicateAuditTableDom, 80);
          return r;
        };
        window.App._v4DedupAnalyticsHooked = true;
      }
    },

    // ========================================================================
    // المحور 2: إزالة ازدواجية شريط اللمس السريع (F7) في شاشة المبيعات نهائياً
    // ========================================================================
    eliminateDuplicateF7StripInPos() {
      const cleanOldStrips = () => {
        document.getElementById('posQuickTouchStrip')?.remove();
        document.getElementById('quickTouchStrip')?.remove();

        // البحث عن أي شريط قديم يحتوي على نص "لمس سريع (F7):" وإخفائه فوراً
        const posSection = document.getElementById('view-pos');
        if (!posSection) return;
        posSection.querySelectorAll('button, span, div').forEach((el) => {
          if (el.id === 'gherbiPinnedQuickDock' || el.closest('#gherbiPinnedQuickDock')) return;
          const txt = (el.textContent || '').trim();
          if (txt === '⚡ لمس سريع (F7):' || txt === 'لمس سريع (F7):') {
            const stripRow = el.closest('.flex') || el.parentElement;
            if (stripRow && stripRow.id !== 'gherbiPinnedQuickDock') {
              stripRow.classList.add('gherbi-legacy-f7-strip-hidden');
              stripRow.style.display = 'none';
            }
          }
        });
      };

      cleanOldStrips();
      window.App.renderQuickTouchStrip = () => {
        cleanOldStrips();
        this.renderUnifiedPinnedDock();
      };
      setInterval(cleanOldStrips, 1200);
    },

    // ========================================================================
    // المحور 3: التحديث اللحظي الفوري (0ms) لحاسبة الصرف + إصلاح تصفير السلات
    // ========================================================================
    enableZeroClickInstantChangeCalculator() {
      // إصلاح تحديث الإجمالي وحاسبة الصرف عند تبديل السلات أو إنشاء سلة جديدة
      ['switchCartTab', 'newCartTab', 'closeCartTab'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (origFn && !window.App['_v4CartTabSync_' + fnName]) {
          window.App[fnName] = function (...args) {
            const res = origFn(...args);
            window.App.recalcAndRenderCart?.();
            RetailV4.computeLiveChangeNow();
            return res;
          };
          window.App['_v4CartTabSync_' + fnName] = true;
        }
      });

      const bindInstantCashEvents = () => {
        const cashInp = document.getElementById('gherbiReceivedCashInput');
        if (!cashInp) return;

        // إزالة أي اعتراض من ماسح الباركود عند الكتابة داخل خانة المبلغ المستلم
        if (cashInp.dataset.v4ZeroClickBound !== '1') {
          cashInp.dataset.v4ZeroClickBound = '1';
          cashInp.oninput = () => this.computeLiveChangeNow();
          cashInp.onkeyup = () => this.computeLiveChangeNow();

          ['input', 'keyup', 'keydown', 'change', 'paste', 'click'].forEach((ev) => {
            cashInp.addEventListener(
              ev,
              (e) => {
                e.stopPropagation();
                setTimeout(() => this.computeLiveChangeNow(), 0);
              },
              true
            );
          });
        }
      };

      bindInstantCashEvents();
      setInterval(bindInstantCashEvents, 800);
    },

    computeLiveChangeNow() {
      const inp = document.getElementById('gherbiReceivedCashInput');
      const resEl = document.getElementById('gherbiInlineChangeResult');
      const centEl = document.getElementById('gherbiInlineChangeCentimes');
      if (!inp || !resEl) return;

      // قراءة الإجمالي الحقيقي مباشرة من حساب السلة النشطة حالياً
      let totalDue = 0;
      const items = window.App?.currentCart?.items || [];
      if (items.length === 0) {
        totalDue = 0;
        const totTextEl = document.getElementById('cartTotalText');
        const subTextEl = document.getElementById('cartSubtotalText');
        if (totTextEl) totTextEl.textContent = '0.00 د.ج';
        if (subTextEl) subTextEl.textContent = '0.00 د.ج';
      } else if (typeof window.App?.recalcCart === 'function') {
        const calc = window.App.recalcCart();
        totalDue = Number(calc?.total || 0);
      } else {
        const txt = document.getElementById('cartTotalText')?.textContent || '0';
        totalDue = parseFloat(txt.replace(/[^d.-]/g, '')) || 0;
      }

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
          centEl.textContent = `⚠️ المبلغ المستلم ينقصه ${missing.toFixed(2)} د.ج عن إجمالي الفاتورة`;
          centEl.classList.remove('hidden');
        }
      }
    },

    // ========================================================================
    // المحور 4: تطوير لوحة اللمس السريع (F7) وربطها بمنتجات المخزن الحقيقية
    // ========================================================================
    upgradeF7QuickTouchStudioWithInventory() {
      const injectStudioLayout = () => {
        const modal = document.getElementById('quickTouchPadModal');
        if (!modal || modal.dataset.v4StudioBuilt === '1') return;
        modal.dataset.v4StudioBuilt = '1';

        modal.innerHTML = `
          <div class="modal-content w-full max-w-5xl p-5 space-y-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs max-h-[92vh] flex flex-col overflow-hidden">
            <!-- الهيدر -->
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5 shrink-0">
              <div class="flex items-center gap-2">
                <span class="text-2xl">⚡</span>
                <div>
                  <h3 class="text-base font-black text-emerald-600 dark:text-emerald-400">مركز اللمس السريع للسلع اليومية ومنتجات المخزن (F7)</h3>
                  <p class="text-[11px] text-slate-400">اضغط على أي بطاقة لبيعها فوراً — يمكنك ربط أي سلعة من مخزنك أو تثبيتها في الشاشة الرئيسية 📌</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('quickTouchPadModal'); App.focusBarcodeMagnet?.(false);" class="text-slate-400 hover:text-rose-500 font-black text-base">✕</button>
            </div>

            <!-- شريط القوالب الجاهزة + استيراد منتجات المخزن -->
            <div class="p-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-black text-amber-400 ml-1">🎯 مجموعات جاهزة:</span>
                <button type="button" onclick="RetailV4.loadPreset('supermarket')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-black">🛒 سوبرماركت ويوميات</button>
                <button type="button" onclick="RetailV4.loadPreset('produce')" class="px-2.5 py-1 rounded-lg bg-lime-600 hover:bg-lime-500 font-black">🍎 خضر وفواكه</button>
                <button type="button" onclick="RetailV4.loadPreset('bakery')" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 font-black">🥖 مخبزة ومرطبات</button>
                <button type="button" onclick="RetailV4.loadPreset('library')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 font-black">📚 مكتبة ونسخ</button>
                <button type="button" onclick="RetailV4.loadPreset('perfume')" class="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 font-black">✨ عطور وهدايا</button>
              </div>
              <button type="button" onclick="RetailV4.importTopInventoryProductsToF7()"
                class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center gap-1 shadow">
                <span>🔥</span>
                <span>+ استيراد منتجات المخزن تلقائياً</span>
              </button>
            </div>

            <!-- شريط الفلترة حسب القسم والبحث داخل أزرار اللمس -->
            <div class="flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div id="v4F7CategoryPills" class="flex items-center gap-1 overflow-x-auto"></div>
              <input id="v4F7FilterSearchInput" type="text" oninput="RetailV4.renderF7Grid()"
                placeholder="🔍 ابحث في أزرار اللمس السريع..."
                class="w-60 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold">
            </div>

            <!-- شبكة بطاقات الأزرار السريعة -->
            <div id="quickTouchButtonsGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 overflow-y-auto flex-1 p-1"></div>

            <!-- اللوحة السفلية المزدوجة: 1) بحث وإضافة من منتجات المخزن | 2) إضافة زر حر جديد -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 shrink-0">
              
              <!-- أ. بحث وربط مباشر بمنتجات المخزن -->
              <div class="md:col-span-6 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-1.5">
                <label class="block font-black text-blue-600 dark:text-blue-400">📦 1. إضافة منتج موجود في المخزن إلى لوحة اللمس السريع:</label>
                <div class="flex gap-1.5">
                  <input id="v4F7InvSearchInput" type="text" oninput="RetailV4.filterF7InventorySelect(this.value)"
                    placeholder="اكتب اسم أو باركود المنتج للبحث..."
                    class="w-40 px-2.5 py-1.5 rounded-xl border border-blue-400 font-bold">
                  <select id="v4F7InventoryProductSelect" class="flex-1 px-2.5 py-1.5 rounded-xl border border-blue-500/50 font-bold"></select>
                  <button type="button" onclick="RetailV4.addSelectedInventoryProductToF7()"
                    class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shrink-0">
                    + ربط
                  </button>
                </div>
              </div>

              <!-- ب. إنشاء زر سلعة يومية أو خدمة بدون باركود -->
              <div class="md:col-span-6 space-y-1.5">
                <label class="block font-black text-emerald-600 dark:text-emerald-400">⚡ 2. أو إضافة سلعة يومية / خدمة سريعة بدون باركود:</label>
                <div class="grid grid-cols-12 gap-1.5 items-center">
                  <input id="qtIconInput" type="text" value="🥖" placeholder="أيقونة" class="col-span-2 px-2 py-1.5 rounded-xl border text-center font-bold">
                  <input id="qtNameInput" type="text" placeholder="اسم السلعة (خبز / حليب / نسخ)..." class="col-span-5 px-2.5 py-1.5 rounded-xl border font-bold">
                  <input id="qtPriceInput" type="number" step="any" placeholder="السعر د.ج" class="col-span-2 px-2 py-1.5 rounded-xl border font-mono font-black text-center">
                  <button type="button" onclick="RetailV4.addCustomQuickButton()"
                    class="col-span-3 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black">
                    + إضافة زر
                  </button>
                </div>
              </div>

            </div>
          </div>
        `;
      };

      injectStudioLayout();

      // اعتراض جميع دوال فتح نافذة F7 الممكنة في النظام لضمان ظهور الواجهة المطورة دائماً
      const openStudioFn = () => {
        injectStudioLayout();
        this.filterF7InventorySelect('');
        this.renderF7Grid();
        window.App.openModal('quickTouchPadModal');
      };

      window.App.openQuickTouchModal = openStudioFn;
      window.App.openQuickTouchPadModal = openStudioFn;
      window.App.renderQuickTouchPad = () => {
        injectStudioLayout();
        this.renderF7Grid();
      };

      // اعتراض openModal('quickTouchPadModal') مباشرة
      const origOpenModal = window.App.openModal?.bind(window.App);
      if (origOpenModal && !window.App._v4F7ModalIntercepted) {
        window.App.openModal = function (modalId) {
          if (modalId === 'quickTouchPadModal') {
            injectStudioLayout();
            RetailV4.filterF7InventorySelect('');
            RetailV4.renderF7Grid();
          }
          return origOpenModal(modalId);
        };
        window.App._v4F7ModalIntercepted = true;
      }

      this.renderUnifiedPinnedDock();
    },

    getF7List() {
      return window.RetailV3 ? window.RetailV3.getQuickTouchButtons() : [];
    },

    saveF7List(list) {
      if (window.RetailV3) {
        window.RetailV3.saveQuickTouchButtons(list);
      } else {
        localStorage.setItem('gherbi_quick_touch_buttons', JSON.stringify(list));
      }
      this.renderF7Grid();
      this.renderUnifiedPinnedDock();
    },

    loadPreset(key) {
      if (!window.RetailV3 || !window.RetailV3.retailQuickPresets[key]) return;
      const preset = JSON.parse(JSON.stringify(window.RetailV3.retailQuickPresets[key]));
      const existingInv = this.getF7List().filter((b) => b.productId);
      this.saveF7List([...existingInv, ...preset]);
      if (window.showToast) window.showToast('✅ تم تحميل المجموعة السريعة مع الحفاظ على منتجات المخزن المربوطة', 'success');
    },

    filterF7InventorySelect(query = '') {
      const sel = document.getElementById('v4F7InventoryProductSelect');
      if (!sel) return;
      const q = String(query || '').trim().toLowerCase();
      const prods = (window.AppState.products || []).filter((p) => {
        if (!q) return true;
        return (
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q) ||
          String(p.category || '').toLowerCase().includes(q)
        );
      });

      sel.innerHTML =
        '<option value="">اختر منتجاً من المخزن (' + prods.length + ')...</option>' +
        prods.slice(0, 120).map((p) => `<option value="${p.id}">${p.name} — (${Number(p.selling_price || 0).toFixed(2)} د.ج | مخزون: ${Number(p.total_stock ?? p.stock ?? 0)})</option>`).join('');
    },

    addSelectedInventoryProductToF7() {
      const sel = document.getElementById('v4F7InventoryProductSelect');
      const pid = Number(sel?.value || 0);
      if (!pid) {
        if (window.showToast) window.showToast('⚠️ يرجى اختيار منتج من قائمة المخزن أولاً', 'warning');
        return;
      }
      const prod = (window.AppState.products || []).find((p) => Number(p.id) === pid);
      if (!prod) return;

      const list = this.getF7List();
      if (list.some((b) => Number(b.productId) === pid)) {
        if (window.showToast) window.showToast('ℹ️ هذا المنتج مضاف مسبقاً في لوحة اللمس السريع', 'info');
        return;
      }

      list.unshift({
        productId: prod.id,
        icon: '📦',
        name: prod.name,
        price: Number(prod.selling_price || 0),
        category: prod.category || 'منتجات المخزن',
        pinned: true,
        noLoyalty: window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(prod.id) === 0 : false
      });

      this.saveF7List(list);
      if (window.showToast) window.showToast(`✅ تمت إضافة "${prod.name}" إلى لوحة اللمس وتثبيته في الشاشة`, 'success');
    },

    importTopInventoryProductsToF7() {
      const prods = (window.AppState.products || []).filter((p) => !p.hide_from_pos);
      if (!prods.length) {
        if (window.showToast) window.showToast('⚠️ لا توجد منتجات مسجلة في المخزن حالياً', 'warning');
        return;
      }
      const list = this.getF7List();
      let addedCount = 0;
      const featuredFirst = [...prods].sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)));
      featuredFirst.slice(0, 10).forEach((p) => {
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
          addedCount++;
        }
      });
      this.saveF7List(list);
      if (window.showToast) {
        window.showToast(`📦 تم استيراد ${addedCount} منتجات من المخزن إلى لوحة اللمس السريع بنجاح`, 'success');
      }
    },

    addCustomQuickButton() {
      const icon = document.getElementById('qtIconInput')?.value?.trim() || '⚡';
      const name = document.getElementById('qtNameInput')?.value?.trim() || '';
      const price = parseFloat(document.getElementById('qtPriceInput')?.value || '0');
      if (!name || !Number.isFinite(price) || price < 0) {
        if (window.showToast) window.showToast('⚠️ يرجى إدخال اسم السلعة والسعر بشكل صحيح', 'warning');
        return;
      }
      const list = this.getF7List();
      list.push({
        icon,
        name,
        price,
        category: 'خدمات ويوميات',
        pinned: true,
        noLoyalty: false
      });
      document.getElementById('qtNameInput').value = '';
      document.getElementById('qtPriceInput').value = '';
      this.saveF7List(list);
      if (window.showToast) window.showToast(`✅ تمت إضافة الزر السريع "${name}"`, 'success');
    },

    renderF7Grid() {
      const grid = document.getElementById('quickTouchButtonsGrid');
      const pillsBox = document.getElementById('v4F7CategoryPills');
      if (!grid) return;

      const list = this.getF7List();
      const q = String(document.getElementById('v4F7FilterSearchInput')?.value || '').trim().toLowerCase();

      const cats = ['all', 'pinned', 'inventory', ...new Set(list.map((b) => b.category || 'عام'))];
      if (pillsBox) {
        const labels = { all: 'الكل (' + list.length + ')', pinned: '📌 المثبتة في الكاشير', inventory: '📦 منتجات المخزن' };
        pillsBox.innerHTML = cats.map((c) => `
          <button type="button" onclick="RetailV4.activeF7Category='${c}'; RetailV4.renderF7Grid();"
            class="px-2.5 py-1 rounded-lg font-black text-[11px] whitespace-nowrap transition ${
              this.activeF7Category === c ? 'bg-emerald-600 text-white shadow' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }">
            ${labels[c] || c}
          </button>
        `).join('');
      }

      const filtered = list
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
          if (this.activeF7Category === 'pinned' && item.pinned === false) return false;
          if (this.activeF7Category === 'inventory' && !item.productId) return false;
          if (!['all', 'pinned', 'inventory'].includes(this.activeF7Category) && (item.category || 'عام') !== this.activeF7Category) {
            return false;
          }
          if (!q) return true;
          return String(item.name || '').toLowerCase().includes(q) || String(item.category || '').toLowerCase().includes(q);
        });

      if (!filtered.length) {
        grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 font-bold">لا توجد أزرار مطابقة — اختر منتجاً من المخزن بالأسفل أو أضف زراً جديداً</div>';
        return;
      }

      grid.innerHTML = filtered.map(({ item, idx }) => {
        const prod = item.productId ? (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId)) : null;
        const displayPrice = prod ? Number(prod.selling_price || item.price || 0) : Number(item.price || 0);
        const stockText = prod ? `📦 مخزون: ${Number(prod.total_stock ?? prod.stock ?? 0)}` : '⚡ سريع';
        const isPinned = item.pinned !== false;

        return `
          <div onclick="RetailV4.executeQuickTouchButton(${idx}, true)" class="v4-f7-card ${prod ? 'is-inventory-linked' : ''}">
            <div class="flex items-center justify-between gap-1">
              <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold ${prod ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}">${stockText}</span>
              <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                <button type="button" onclick="RetailV4.togglePinQuickButton(${idx})" title="تثبيت أو إخفاء من الشريط الرئيسي"
                  class="px-1.5 py-0.5 rounded text-[10px] font-black ${isPinned ? 'bg-amber-500/20 text-amber-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}">📌</button>
                <button type="button" onclick="RetailV4.openEditQuickButtonModal(${idx})" title="تعديل السعر أو الاسم"
                  class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 text-[10px]">✏️</button>
                <button type="button" onclick="RetailV4.deleteQuickButton(${idx})" title="حذف الزر"
                  class="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 text-[10px]">✕</button>
              </div>
            </div>

            <div class="font-black text-xs text-slate-800 dark:text-slate-100 my-1 line-clamp-2">
              <span>${item.icon || '⚡'}</span>
              <span>${prod ? prod.name : item.name}</span>
            </div>

            <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <span class="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">${displayPrice.toFixed(2)} د.ج</span>
              ${item.noLoyalty ? '<span class="text-[9.5px] font-bold text-rose-500">🚫 بدون نقاط</span>' : '<span class="text-[9.5px] font-bold text-amber-500">👑 مؤهل للنقاط</span>'}
            </div>
          </div>
        `;
      }).join('');
    },

    renderUnifiedPinnedDock() {
      const dock = document.getElementById('gherbiPinnedQuickDock');
      if (!dock) return;
      const list = this.getF7List();
      const pinnedItems = list.map((b, idx) => ({ b, idx })).filter(({ b }) => b.pinned !== false);

      dock.innerHTML = `
        <button type="button" onclick="App.openQuickTouchModal()"
          class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shrink-0 flex items-center gap-1 shadow-sm">
          <span>⚡</span>
          <span>لوحة اللمس (F7)</span>
        </button>
        ${pinnedItems.map(({ b, idx }) => {
          const prod = b.productId ? (window.AppState.products || []).find((p) => Number(p.id) === Number(b.productId)) : null;
          const price = prod ? Number(prod.selling_price || b.price || 0) : Number(b.price || 0);
          const name = prod ? prod.name : b.name;
          return `
            <div onclick="RetailV4.executeQuickTouchButton(${idx}, false)"
                 oncontextmenu="event.preventDefault(); RetailV4.openEditQuickButtonModal(${idx});"
                 class="gherbi-pinned-f7-chip" title="انقر للإضافة للسلة فوراً | نقرة يمين لتعديل السعر أو الخصائص">
              <span>${b.icon || '⚡'}</span>
              <span>${name}</span>
              <span class="font-mono font-black text-emerald-600 dark:text-emerald-400">${price.toFixed(0)} د.ج</span>
            </div>
          `;
        }).join('')}
      `;
    },

    executeQuickTouchButton(idx, closeModalAfter = false) {
      const list = this.getF7List();
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

    togglePinQuickButton(idx) {
      const list = this.getF7List();
      if (!list[idx]) return;
      list[idx].pinned = list[idx].pinned === false ? true : false;
      this.saveF7List(list);
    },

    deleteQuickButton(idx) {
      const list = this.getF7List();
      if (!list[idx]) return;
      list.splice(idx, 1);
      this.saveF7List(list);
    },

    openEditQuickButtonModal(idx) {
      const list = this.getF7List();
      const item = list[idx];
      if (!item) return;
      this.buildCustomModalsDom();

      document.getElementById('qbEditIndexInput').value = String(idx);
      document.getElementById('qbEditIconInput').value = item.icon || '⚡';
      document.getElementById('qbEditNameInput').value = item.name || '';
      document.getElementById('qbEditPriceInput').value = Number(item.price || 0);
      document.getElementById('qbEditCatInput').value = item.category || 'خدمات سريعة';
      document.getElementById('qbEditPinnedCheck').checked = item.pinned !== false;
      document.getElementById('qbEditNoLoyaltyCheck').checked = Boolean(item.noLoyalty);

      window.App.openModal('quickBtnEditModal');
    },

    saveEditedQuickButton() {
      const idx = parseInt(document.getElementById('qbEditIndexInput')?.value || '-1', 10);
      const list = this.getF7List();
      if (!list[idx]) return;

      list[idx].icon = document.getElementById('qbEditIconInput')?.value?.trim() || '⚡';
      list[idx].name = document.getElementById('qbEditNameInput')?.value?.trim() || list[idx].name;
      list[idx].price = Math.max(0, parseFloat(document.getElementById('qbEditPriceInput')?.value || '0') || 0);
      list[idx].category = document.getElementById('qbEditCatInput')?.value?.trim() || 'خدمات سريعة';
      list[idx].pinned = Boolean(document.getElementById('qbEditPinnedCheck')?.checked);
      list[idx].noLoyalty = Boolean(document.getElementById('qbEditNoLoyaltyCheck')?.checked);

      this.saveF7List(list);
      window.App.closeModal('quickBtnEditModal');
      if (window.showToast) window.showToast('✅ تم تحديث زر اللمس السريع بنجاح', 'success');
    },

    // ========================================================================
    // المحور 5: محرك "فارق النقاط الذكي (Delta Loyalty Engine)" عند تعديل مبيعة سابقة
    // ========================================================================
    calculateEligiblePointsForCart(items = [], discount = 0) {
      let eligibleRevenue = 0;
      items.forEach((it) => {
        const lineSub = Number(it.subtotal ?? (Number(it.quantity || 1) * Number(it.price || 0)));
        if (it._noLoyalty) return;
        const pid = it.product_id || it.productId;
        const mult = pid && window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(pid) : 1;
        eligibleRevenue += lineSub * mult;
      });
      const netEligible = Math.max(0, eligibleRevenue - Number(discount || 0));
      return Math.floor(netEligible / 100);
    },

    setupDeltaLoyaltyPointsOnSaleEdit() {
      // مراقبة مستمرة لحالة السلة لالتقاط النقاط الأصلية فور تحميل أي فاتورة سابقة للتعديل
      setInterval(() => {
        const cart = window.App?.currentCart;
        if (!cart) return;
        const editId = cart.editingSaleId || window.AppState?.editingSaleId;
        if (editId && cart._savedBaselineEditId !== editId) {
          cart._savedBaselineEditId = editId;
          cart._baselineCustomerId = Number(cart.customerId || 0);
          cart._baselineEarnedPoints = this.calculateEligiblePointsForCart(cart.items || [], cart.discount || 0);
        } else if (!editId && cart._savedBaselineEditId) {
          delete cart._savedBaselineEditId;
          delete cart._baselineCustomerId;
          delete cart._baselineEarnedPoints;
        }
      }, 250);

      // اعتراض تأكيد البيع (سواء عبر نافذة التسديد F1 أو التذكرة الفورية Echap أو الحفظ Ctrl+Space)
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (!origFn || window.App['_v4DeltaLoyaltyWrapped_' + fnName]) return;

        window.App[fnName] = async function (...args) {
          const cart = window.App.currentCart;
          const isEditingSale = Boolean(cart?.editingSaleId || window.AppState?.editingSaleId || cart?._savedBaselineEditId);
          const cid = Number(cart?.customerId || 0);
          const redeemedPtsInThisOrder = Number(cart?._redeemedPoints || 0);
          const oldEarnedPts = Number(cart?._baselineEarnedPoints ?? 0);
          const newEarnedPts = RetailV4.calculateEligiblePointsForCart(cart?.items || [], cart?.discount || 0);

          const custObj = cid ? (window.AppState.customers || []).find((c) => Number(c.id) === cid) : null;
          const pointsBeforeCheckout = custObj ? Number(custObj.loyalty_points || 0) : 0;

          const res = await origFn(...args);

          if (cid && custObj) {
            let rightfulFinalPoints = pointsBeforeCheckout;

            if (isEditingSale) {
              // حالة إعادة تأكيد فاتورة سابقة معدلة: نضيف أو نخصم الفارق فقط (Delta)
              const deltaPts = newEarnedPts - oldEarnedPts;
              rightfulFinalPoints = Math.max(0, pointsBeforeCheckout - redeemedPtsInThisOrder + deltaPts);

              if (window.showToast) {
                const deltaStr = deltaPts >= 0 ? `+${deltaPts}` : `${deltaPts}`;
                window.showToast(
                  `👑 تسوية نقاط الفاتورة المعدلة: نقاط التأكيد السابق (${oldEarnedPts}) ⬅ الجديد (${newEarnedPts}) | تم احتساب الفارق فقط (${deltaStr} نقطة)`,
                  'info'
                );
              }
            } else {
              // حالة فاتورة جديدة: نضيف فقط النقاط المؤهلة (بعد استبعاد السلع المستثناة 0%)
              rightfulFinalPoints = Math.max(0, pointsBeforeCheckout - redeemedPtsInThisOrder + newEarnedPts);
            }

            custObj.loyalty_points = rightfulFinalPoints;
            if (window.api?.updateCustomer) {
              await window.api.updateCustomer(cid, { ...custObj, loyalty_points: rightfulFinalPoints }).catch(() => {});
            }
            window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
          }

          return res;
        };
        window.App['_v4DeltaLoyaltyWrapped_' + fnName] = true;
      });
    },

    // ========================================================================
    // المحور 6: إعادة هيكلة نافذة (إضافة / تعديل منتج #productModal) للتجزئة والباركودات المتعددة
    // ========================================================================
    overhaulProductModalForRetailAndMultiBarcodes() {
      const applyCleanRetailProductModalLayout = (productArg = null) => {
        const prodModal = document.getElementById('productModal');
        if (!prodModal) return;

        // 1. إخفاء التبويب 4 (مصفوفة المتغيرات) والتبويب 5 (التصنيع والضمان)
        ['prodTabBtn4', 'prodTabBtn5', 'prodTab4', 'prodTab5'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });

        // تسمية التبويبات الثلاثة بوضوح لتاجر التجزئة
        const b1 = document.getElementById('prodTabBtn1');
        const b2 = document.getElementById('prodTabBtn2');
        const b3 = document.getElementById('prodTabBtn3');
        if (b1) b1.textContent = '1. البيانات الأساسية والولاء';
        if (b2) b2.textContent = '2. الأسعار، الفائدة، والكارطون';
        if (b3) b3.textContent = '3. الباركودات المتعددة والعروض';

        // 2. نقل الصندوق الأخضر (BOGO) إلى داخل التبويب الثالث فقط لمنع تكراره تحت كل التبويبات
        const tab1 = document.getElementById('prodTab1');
        const tab2 = document.getElementById('prodTab2');
        const tab3 = document.getElementById('prodTab3');

        const allDivs = Array.from(prodModal.querySelectorAll('div'));
        const bogoBox = document.getElementById('supermarketRetailBogoSection') ||
          allDivs.find((d) => d.textContent.includes('إعدادات السوبرماركت، الرفوف، وعروض المجاني') && d.classList.contains('rounded-2xl'));

        if (bogoBox && tab3 && bogoBox.parentElement !== tab3) {
          tab3.appendChild(bogoBox);
          bogoBox.classList.add('mt-3');
        }
        // إخفاء حقل موقع الرف المكرر داخل صندوق BOGO
        const dupShelf = document.getElementById('prodShelfLocationInput');
        if (dupShelf && dupShelf.parentElement) {
          dupShelf.parentElement.style.display = 'none';
        }

        // 3. حقن بطاقة "احتساب المنتج في بطاقة الولاء" داخل التبويب الأول
        if (tab1 && !document.getElementById('prodLoyaltyPolicySelect')) {
          const loyaltyCard = document.createElement('div');
          loyaltyCard.id = 'v4ProdLoyaltyPolicyCard';
          loyaltyCard.className = 'col-span-full p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-wrap items-center justify-between gap-3 mt-1';
          loyaltyCard.innerHTML = `
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">👑</span>
              <div>
                <label for="prodLoyaltyPolicySelect" class="font-black text-xs text-amber-700 dark:text-amber-300 block">
                  احتساب هذا المنتج في بطاقة الولاء (حسب فائدة السلعة):
                </label>
                <span id="prodLoyaltyAutoMarginHint" class="text-[11px] text-slate-500 font-bold">
                  استثنِ السلع ذات الربح الضعيف أو المعدوم (كالحليب المقنن والخبز والسكر) لحماية أرباح المحل
                </span>
              </div>
            </div>
            <select id="prodLoyaltyPolicySelect" class="px-3 py-2 rounded-xl border-2 border-amber-500 font-black text-xs bg-white dark:bg-slate-900">
              <option value="1">✅ يُحتسب في بطاقة الولاء (100% نقاط كاملة)</option>
              <option value="0.5">⚖️ نصف النقاط فقط (50% — فائدة محدودة)</option>
              <option value="0">🚫 لا يُحتسب في بطاقة الولاء (0% — فائدة ضعيفة/معدومة)</option>
              <option value="2">🔥 نقاط مضاعفة ترويجية (200%)</option>
            </select>
          `;
          tab1.appendChild(loyaltyCard);
        }

        // قراءة القيمة المحفوظة لسياسة ولاء المنتج
        const policyMap = JSON.parse(localStorage.getItem('gherbi_product_loyalty_policies') || '{}');
        const pid = (productArg && typeof productArg === 'object' ? productArg.id : productArg) || document.getElementById('prodEditId')?.value;
        const policySel = document.getElementById('prodLoyaltyPolicySelect');
        if (policySel) {
          policySel.value = pid && policyMap[pid] !== undefined ? String(policyMap[pid]) : '1';
        }

        // 4. تنظيف التبويب الثاني (حذف حقل هامش الربح المكرر وحذف نصف الجملة)
        if (tab2) {
          Array.from(tab2.querySelectorAll('input')).forEach((inp) => {
            if (inp.id !== 'prodMarkupInput' && (inp.placeholder || '').includes('25%')) {
              const container = inp.closest('.flex, div');
              if (container && container !== tab2 && !container.querySelector('#prodSellInput')) {
                container.style.display = 'none';
              } else {
                inp.style.display = 'none';
                if (inp.previousElementSibling) inp.previousElementSibling.style.display = 'none';
              }
            }
          });
        }

        // 5. تطوير التبويب الثالث (الباركودات المتعددة لنفس المنتج أو للكارطون)
        if (tab3 && !document.getElementById('v4MultiBarcodeHeaderBox')) {
          const oldBtn = tab3.querySelector('button[onclick*="addMultiBarcodeRow"]');
          const headerBox = document.createElement('div');
          headerBox.id = 'v4MultiBarcodeHeaderBox';
          headerBox.className = 'p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex flex-wrap items-center justify-between gap-2 mb-3';
          headerBox.innerHTML = `
            <div>
              <div class="font-black text-xs text-blue-700 dark:text-blue-300">🏷️ الباركودات المتعددة لنفس المنتج أو للكارطون:</div>
              <div class="text-[11px] text-slate-500 font-bold">أضف عدة باركودات لنفس السلعة (إذا كان للمنتج أكثر من باركود من المصنع) أو باركود خاص بالكارطون</div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="RetailV4.addSameProductBarcodeRow()"
                class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm">
                🏷️ + باركود إضافي لنفس الحبة (×1)
              </button>
              <button type="button" onclick="RetailV4.addCartonPackBarcodeRow()"
                class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-sm">
                📦 + باركود كارطون / حزمة (×6 / ×12)
              </button>
            </div>
          `;
          if (oldBtn && oldBtn.parentElement) {
            oldBtn.parentElement.replaceWith(headerBox);
          } else {
            tab3.insertBefore(headerBox, tab3.firstChild);
          }
        }
      };

      // تعريف دالة بناء سطر الباركود المتعدد بدون أي إشارة لـ "نصف جملة"
      window.App.addMultiBarcodeRow = function (data = {}) {
        const list = document.getElementById('prodMultiBarcodesList');
        if (!list) return;
        const factor = Math.max(1, Number(data.pack_factor || 1));
        const isSingle = factor === 1;
        const row = document.createElement('div');
        row.className = 'multi-barcode-row grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mb-2';
        row.innerHTML = `
          <div class="col-span-5">
            <label class="text-[10px] font-black ${isSingle ? 'text-blue-600' : 'text-indigo-600'}">
              ${isSingle ? '🏷️ باركود إضافي لنفس المنتج (الحبة)' : '📦 باركود العبوة / الكارطون'}
            </label>
            <input type="text" class="mb-code w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-black border"
              placeholder="امسح الباركود هنا..." value="${data.barcode || ''}">
          </div>
          <div class="col-span-3">
            <label class="text-[10px] text-slate-500 font-bold">البيان / النكهة / النوع</label>
            <input type="text" class="mb-label w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border"
              placeholder="${isSingle ? 'نفس الحبة / دفعة 2' : 'كارطون / حزمة'}" value="${data.unit_label || (isSingle ? 'نفس الحبة' : 'كارطون / حزمة')}">
          </div>
          <div class="col-span-2">
            <label class="text-[10px] text-blue-600 font-bold">الشد (عدد الحبات)</label>
            <input type="number" step="1" min="1" class="mb-factor w-full px-2 py-1.5 rounded-lg text-xs font-mono font-black text-center border"
              value="${factor}">
          </div>
          <div class="col-span-1">
            <label class="text-[10px] text-emerald-600 font-bold">سعر خاص</label>
            <input type="number" step="any" class="mb-tier w-full px-1 py-1.5 rounded-lg text-xs font-mono font-bold text-center border"
              placeholder="نفس السعر" value="${data.price_tier && !isNaN(Number(data.price_tier)) ? data.price_tier : ''}">
          </div>
          <div class="col-span-1 pt-4 text-center">
            <button type="button" onclick="this.closest('.multi-barcode-row').remove()" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg font-black">✕</button>
          </div>
        `;
        list.appendChild(row);
        row.querySelector('.mb-code')?.focus();
      };

      // ربط التنظيف بفتح نافذة المنتج دائماً
      const origOpenProd = window.App.openProductModal?.bind(window.App);
      if (origOpenProd && !window.App._v4CleanProdModalHooked) {
        window.App.openProductModal = function (product = null) {
          const res = origOpenProd(product);
          setTimeout(() => applyCleanRetailProductModalLayout(product), 20);
          return res;
        };
        window.App._v4CleanProdModalHooked = true;
      }

      applyCleanRetailProductModalLayout();
      this.enhanceMultiBarcodeLookupEverywhere();
    },

    addSameProductBarcodeRow() {
      window.App.addMultiBarcodeRow({ unit_label: 'نفس المنتج (باركود إضافي)', pack_factor: 1, price_tier: '' });
    },

    addCartonPackBarcodeRow() {
      const packQty = parseFloat(document.getElementById('prodWholesaleMinQtyInput')?.value || '6') || 6;
      const packPrice = parseFloat(document.getElementById('prodWholesaleInput')?.value || '0') || '';
      window.App.addMultiBarcodeRow({ unit_label: 'كارطون / حزمة', pack_factor: packQty, price_tier: packPrice });
    },

    enhanceMultiBarcodeLookupEverywhere() {
      // حفظ الباركودات المتعددة محلياً أيضاً عند حفظ المنتج لضمان سرعة مسحها 0ms في الكاشير
      const multiMap = JSON.parse(localStorage.getItem('gherbi_multi_barcodes_lookup') || '{}');

      const origSaveProd = window.App.saveProduct?.bind(window.App);
      if (origSaveProd && !window.App._v4SaveMultiBarcodesHooked) {
        window.App.saveProduct = async function () {
          const rows = Array.from(document.querySelectorAll('#prodMultiBarcodesList .multi-barcode-row'));
          const collected = rows
            .map((r) => ({
              barcode: r.querySelector('.mb-code')?.value?.trim() || '',
              unit_label: r.querySelector('.mb-label')?.value?.trim() || 'نفس الحبة',
              pack_factor: Math.max(1, parseFloat(r.querySelector('.mb-factor')?.value || '1') || 1),
              price_tier: r.querySelector('.mb-tier')?.value?.trim() || ''
            }))
            .filter((x) => x.barcode);

          const editId = document.getElementById('prodEditId')?.value;
          const prodName = document.getElementById('prodNameInput')?.value?.trim();

          await origSaveProd();

          const targetProd = (window.AppState.products || []).find(
            (p) => (editId && Number(p.id) === Number(editId)) || p.name === prodName
          );
          if (targetProd) {
            targetProd.multi_barcodes = collected;
            multiMap[targetProd.id] = collected;
            localStorage.setItem('gherbi_multi_barcodes_lookup', JSON.stringify(multiMap));
          }
        };
        window.App._v4SaveMultiBarcodesHooked = true;
      }

      // دالة مساعدة للبحث عن منتج بأي باركود من باركوداته المتعددة
      this.findProductByAnyBarcode = (rawBarcode) => {
        const code = String(rawBarcode || '').trim();
        if (!code) return null;
        const products = window.AppState.products || [];
        const savedMap = JSON.parse(localStorage.getItem('gherbi_multi_barcodes_lookup') || '{}');

        for (const p of products) {
          if (String(p.barcode || '').trim() === code) {
            return { product: p, pack_factor: 1, custom_price: null };
          }
          let list = savedMap[p.id] || [];
          if (!list.length) {
            try {
              if (Array.isArray(p.multi_barcodes)) list = p.multi_barcodes;
              else if (typeof p.multi_barcodes_json === 'string' && p.multi_barcodes_json) {
                list = JSON.parse(p.multi_barcodes_json);
              }
            } catch (_) {}
          }
          const hit = list.find((mb) => String(mb.barcode || '').trim() === code);
          if (hit) {
            return {
              product: p,
              pack_factor: Math.max(1, Number(hit.pack_factor || 1)),
              custom_price: hit.price_tier && !isNaN(Number(hit.price_tier)) ? Number(hit.price_tier) : null
            };
          }
        }
        return null;
      };
    }
  };

  window.RetailV4 = RetailV4;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailV4.init());
  } else {
    RetailV4.init();
  }
})();
