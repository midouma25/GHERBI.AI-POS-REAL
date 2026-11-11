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

      window.App.toggleCartItemWholesaleUnit = function (idx) {
        const items = window.App.currentCart?.items || [];
        const item = items[idx];
        if (!item) return;

        const prod = (window.AppState.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );
        if (!prod) return;

        const packFactor = Math.max(2, Number(prod.wholesale_min_qty || prod.pack_factor || 6));
        const unitRetailPrice = Number(prod.selling_price || item.price || 0);
        const rawPackPrice = Number(prod.wholesale_price || 0);

        if (!item._isCartonPackMode) {
          item._isCartonPackMode = true;
          item._isWholesaleMode = true;
          item._savedUnitPrice = unitRetailPrice;
          item.quantity = packFactor;

          if (rawPackPrice > unitRetailPrice) {
            item.price = Number((rawPackPrice / packFactor).toFixed(2));
            item.subtotal = Number(rawPackPrice.toFixed(2));
          } else if (rawPackPrice > 0) {
            item.price = rawPackPrice;
            item.subtotal = Number((packFactor * rawPackPrice).toFixed(2));
          } else {
            item.price = unitRetailPrice;
            item.subtotal = Number((packFactor * unitRetailPrice).toFixed(2));
          }

          if (window.showToast) {
            window.showToast(`📦 تم التحويل إلى بيع بالكارطون/الحزمة (×${packFactor} وحدات) بإجمالي ${item.subtotal.toFixed(2)} د.ج`, 'success');
          }
        } else {
          item._isCartonPackMode = false;
          item._isWholesaleMode = false;
          item.quantity = 1;
          item.price = item._savedUnitPrice || unitRetailPrice;
          item.subtotal = Number(item.price.toFixed(2));
          if (window.showToast) {
            window.showToast('🏷️ تم العودة إلى البيع بالقطعة المفردة (1 وحدة)', 'info');
          }
        }

        window.App.recalcAndRenderCart();
      };
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

