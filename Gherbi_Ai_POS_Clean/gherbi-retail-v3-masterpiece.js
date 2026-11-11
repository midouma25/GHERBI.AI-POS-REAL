/**
 * gherbi-retail-v3-masterpiece.js
 * المحرك الشامل لمعالجة جميع الملاحظات والترقيات الاستشارية (الإصدار 3):
 * 1. مدير طبقات النوافذ (Modal Stack Z-Index) لفتح تعديل الزبون فوق نافذة F8 + حذف CCP نهائياً.
 * 2. قفل رصيد نقاط الوفاء بكود سري للمدير (Manager PIN) + سجل رقابة كامل للمدير في صفحة التقارير.
 * 3. خيار استثناء المنتجات ذات الفائدة القليلة من نقاط الوفاء (أو منح نقاط مضاعفة 2x).
 * 4. إصلاح الشاشة البيضاء في وضع الشريط العلوي + مهدئ (Debounce) لحفظ الإعدادات لمنع أخطاء SQLite.
 * 5. إزالة كل ما يخص "الجملة" نهائياً، وإضافة نظام بيع "الكارطون / الفاردو / العلبة للتجزئة" (Pack/Carton System).
 * 6. تطوير لوحة الأزرار السريعة (F7) مع التعديل المباشر، قوالب جديدة، وشريط مثبت في الكاشير.
 */

'use strict';

(function initGherbiRetailV3() {
  const RetailV3 = {
    modalStackCounter: 1050,
    settingsDebounceTimer: null,
    pendingSettingsPatch: {},

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.debounceSettingsUpdates();
        this.installModalStackManager();
        this.cleanCustomerModalAndLockLoyaltyPoints();
        this.upgradeProductModalForRetailAndCartons();
        this.upgradeCartForRetailCartonsAndLoyalty();
        this.upgradeQuickTouchBoardF7();
        this.injectLoyaltyAuditReportInAnalytics();
        this.fixTopNavbarWhiteScreen();
      }, 240);
    },

    // ========================================================================
    // 1. تهدئة (Debounce) نداءات updateSettings لمنع إغراق SQLite أثناء السحب
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
    // 2. مدير طبقات النوافذ المنبثقة (Modal Z-Index Stack Manager)
    // يضمن أن أي نافذة تفتح حديثاً (مثل تعديل الزبون) تظهر دائماً فوق نافذة F8!
    // ========================================================================
    installModalStackManager() {
      if (window.App._v3ModalStackInstalled) return;
      const origOpenModal = window.App.openModal?.bind(window.App);
      const origCloseModal = window.App.closeModal?.bind(window.App);

      window.App.openModal = function (id) {
        if (origOpenModal) origOpenModal(id);
        const el = document.getElementById(id);
        if (el) {
          RetailV3.modalStackCounter += 10;
          el.style.zIndex = String(RetailV3.modalStackCounter);
          el.classList.add('active');
          // نقل النافذة إلى آخر body لضمان أولوية الرسم في المتصفح
          if (el.parentElement === document.body) {
            document.body.appendChild(el);
          }
        }
      };

      window.App.closeModal = function (id) {
        if (origCloseModal) origCloseModal(id);
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('active');
        }
        // إذا أغلقت نافذة الزبون وكانت نافذة F8 مفتوحة تحتها، نعيد التركيز لنافذة F8 فوراً
        if (id === 'customerModal') {
          const f8Modal = document.getElementById('smartLoyaltyCustomerModal');
          if (f8Modal && f8Modal.classList.contains('active')) {
            if (window.RetailMaster) {
              window.RetailMaster.renderSmartLoyaltyCustomersList(
                document.getElementById('smartLoyaltyScanOrSearchInput')?.value || ''
              );
              window.RetailMaster.refreshSmartModalSelectedCustomer();
              window.RetailMaster.syncSmartLoyaltyButtonDisplay();
            }
            setTimeout(() => document.getElementById('smartRedeemPointsInput')?.focus(), 50);
          }
        }
      };

      window.App._v3ModalStackInstalled = true;
    },

    // ========================================================================
    // 3. تنظيف نافذة الزبون من مربع CCP نهائياً + قفل نقاط الولاء بكود سري للمدير وسجل رقابة
    // ========================================================================
    cleanCustomerModalAndLockLoyaltyPoints() {
      const stripCcpAndSetupLock = (id = null) => {
        const custModal = document.getElementById('customerModal');
        if (!custModal) return;

        // حذف أي مربع CCP / BaridiMob تم حقنه ديناميكياً من سكربتات قديمة
        custModal.querySelectorAll('#customerModalCcpAlgerieSection, [id*="Ccp"], [id*="ccp"]').forEach((el) => {
          const box = el.closest('.p-3, .rounded-xl, .border') || el;
          if (box && box.textContent.includes('CCP')) box.remove();
        });

        // إزالة خيار الجملة من قائمة تصنيف الزبون والاكتفاء بالتجزئة والـ VIP
        const tierSel = document.getElementById('custPriceTierInput');
        if (tierSel) {
          tierSel.innerHTML = `
            <option value="retail">زبون تجزئة عادي (Détail)</option>
            <option value="vip">زبون وفي مميز (VIP Fidélité)</option>
          `;
        }

        // قفل حقل نقاط الولاء وإضافة زر "🔑 تعديل بكود المدير"
        const ptsInput = document.getElementById('custLoyaltyPointsInput');
        if (ptsInput) {
          const existingCust = id
            ? (window.AppState.customers || []).find((c) => Number(c.id) === Number(id))
            : null;
          const originalPts = existingCust ? Number(existingCust.loyalty_points || 0) : 0;

          ptsInput.dataset.originalPoints = String(originalPts);
          ptsInput.dataset.managerUnlocked = '0';
          ptsInput.dataset.adjustReason = '';
          ptsInput.readOnly = true;
          ptsInput.classList.add('bg-slate-100', 'dark:bg-slate-800', 'cursor-not-allowed', 'opacity-80');

          let lockToolbar = document.getElementById('loyaltyManagerLockToolbar');
          if (!lockToolbar) {
            lockToolbar = document.createElement('div');
            lockToolbar.id = 'loyaltyManagerLockToolbar';
            lockToolbar.className = 'mt-2 flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700';
            ptsInput.parentElement.appendChild(lockToolbar);
          }

          lockToolbar.innerHTML = `
            <div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <span id="loyaltyLockStatusIcon">🔒</span>
              <span id="loyaltyLockStatusText">محمي من التعديل اليدوي (يتطلب كود المدير)</span>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" onclick="RetailV3.unlockLoyaltyPointsWithManagerPin()"
                class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] transition flex items-center gap-1 shadow-sm">
                <span>🔑 كود المدير للتعديل</span>
              </button>
              <button type="button" onclick="RetailV3.changeManagerLoyaltyPin()"
                class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px]"
                title="تغيير الكود السري للمدير">⚙️</button>
            </div>
          `;
        }
      };

      // اعتراض فتح نافذة الزبون لتطبيق القفل والتنظيف في كل مرة تفتح فيها
      const prevOpenCustomer = window.App.openCustomerModal.bind(window.App);
      window.App.openCustomerModal = function (id = null) {
        const res = prevOpenCustomer(id);
        setTimeout(() => stripCcpAndSetupLock(id), 30);
        return res;
      };

      // اعتراض حفظ الزبون لتسجيل أي تعديل في النقاط في سجل رقابة المدير
      const prevSaveCustomer = window.App.saveCustomer.bind(window.App);
      window.App.saveCustomer = async function () {
        const id = document.getElementById('custEditId')?.value;
        const name = document.getElementById('custNameInput')?.value?.trim() || 'زبون';
        const ptsInput = document.getElementById('custLoyaltyPointsInput');

        const oldPts = Number(ptsInput?.dataset?.originalPoints || 0);
        let newPts = Number(ptsInput?.value || 0);

        // إذا تغيرت النقاط دون فتح قفل المدير، نعيدها للقيمة الأصلية فوراً!
        if (oldPts !== newPts && ptsInput?.dataset?.managerUnlocked !== '1') {
          if (ptsInput) ptsInput.value = String(oldPts);
          newPts = oldPts;
          if (window.showToast) {
            window.showToast('🔒 لم يتم تغيير النقاط لأنها محمية بكود المدير', 'warning');
          }
        }

        await prevSaveCustomer();

        // إذا تم تعديل النقاط (بعد إدخال كود المدير)، نسجل ذلك في سجل الرقابة ليراه المدير دائماً
        if (oldPts !== newPts) {
          const diff = newPts - oldPts;
          const reason = ptsInput?.dataset?.adjustReason || 'تعديل يدوي بكود المدير';
          if (window.api?.addAuditLog) {
            await window.api.addAuditLog({
              user_id: window.AppState.currentUser?.id || 1,
              user_name: window.AppState.currentUser?.name || 'المدير / الكاشير',
              action_type: 'LOYALTY_POINTS_MANUAL_ADJUST',
              target_type: 'customer',
              target_id: id ? Number(id) : null,
              severity: diff > 0 ? 'warning' : 'info',
              details: {
                customer_name: name,
                old_points: oldPts,
                new_points: newPts,
                diff_points: diff,
                reason: reason,
                authorized_by_pin: true,
                timestamp: new Date().toISOString()
              }
            }).catch(() => {});
          }
          if (window.showToast) {
            window.showToast(
              `📋 تم تسجيل تعديل نقاط الوفاء (${diff > 0 ? '+' + diff : diff} نقطة) في سجل رقابة المدير`,
              'info'
            );
          }
        }
      };
    },

    getManagerPin() {
      return localStorage.getItem('gherbi_manager_loyalty_pin') || window.AppState?.settings?.manager_loyalty_pin || '1234';
    },

    unlockLoyaltyPointsWithManagerPin() {
      const enteredPin = prompt('🔑 أدخل الكود السري للمدير لفتح تعديل رصيد نقاط الولاء (الافتراضي: 1234):');
      if (enteredPin === null) return;

      if (enteredPin.trim() !== this.getManagerPin()) {
        if (window.showToast) window.showToast('❌ الكود السري للمدير غير صحيح!', 'error');
        else alert('❌ الكود السري للمدير غير صحيح!');
        return;
      }

      const reason = prompt('📝 اكتب سبب تعديل نقاط الوفاء (يُحفظ في تقرير المدير — مثال: تعويض، هدية، تصحيح):', 'تصحيح رصيد / مكافأة زبون وفي') || 'تعديل بموافقة المدير';

      const ptsInput = document.getElementById('custLoyaltyPointsInput');
      if (ptsInput) {
        ptsInput.readOnly = false;
        ptsInput.dataset.managerUnlocked = '1';
        ptsInput.dataset.adjustReason = reason.trim();
        ptsInput.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'cursor-not-allowed', 'opacity-80');
        ptsInput.focus();
        ptsInput.select();
      }

      const iconEl = document.getElementById('loyaltyLockStatusIcon');
      const txtEl = document.getElementById('loyaltyLockStatusText');
      if (iconEl) iconEl.textContent = '🔓';
      if (txtEl) {
        txtEl.textContent = `تم فتح القفل بموافقة المدير (السبب: ${reason}) — سيتم توثيق التعديل في التقارير`;
        txtEl.className = 'text-emerald-600 dark:text-emerald-400 font-black';
      }
    },

    changeManagerLoyaltyPin() {
      const currentPin = prompt('أدخل الكود السري الحالي للمدير (الافتراضي: 1234):');
      if (currentPin === null) return;
      if (currentPin.trim() !== this.getManagerPin()) {
        alert('❌ الكود الحالي غير صحيح!');
        return;
      }
      const newPin = prompt('أدخل الكود السري الجديد للمدير (4 أرقام أو أكثر):');
      if (!newPin || newPin.trim().length < 3) return;
      localStorage.setItem('gherbi_manager_loyalty_pin', newPin.trim());
      if (window.api?.updateSettings) {
        window.api.updateSettings({ manager_loyalty_pin: newPin.trim() });
      }
      if (window.showToast) window.showToast('✅ تم تحديث الكود السري للمدير بنجاح', 'success');
    },

    // ========================================================================
    // 4 & 7. تطوير نافذة إضافة منتج:
    // أ) إضافة خيار (استثناء من نقاط الوفاء / نقاط عادية / نقاط مضاعفة 2x)
    // ب) إزالة كل ما يتعلق بـ "الجملة" نهائياً، وابتكار نظام "بيع الكارطون / الفاردو للتجزئة"
    // ========================================================================
    upgradeProductModalForRetailAndCartons() {
      const prodModal = document.getElementById('productModal');
      if (!prodModal) return;

      // 1. حقن خيار "احتساب المنتج في بطاقة الوفاء" في التبويب الأول (البيانات الأساسية)
      const tab1 = document.getElementById('prodTab1');
      if (tab1 && !document.getElementById('prodLoyaltyModeSelect')) {
        const loyaltyCard = document.createElement('div');
        loyaltyCard.className = 'col-span-full p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 mt-1';
        loyaltyCard.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-lg">👑</span>
            <div>
              <div class="text-xs font-black text-amber-800 dark:text-amber-300">سياسة نقاط الوفاء لهذا المنتج (Fidélité Produit)</div>
              <div class="text-[10.5px] text-slate-500 dark:text-slate-400">استثنِ السلع ذات الفائدة الضئيلة (مثل الحليب والسكر) لحماية هامش ربح المحل</div>
            </div>
          </div>
          <select id="prodLoyaltyModeSelect" class="px-3 py-1.5 rounded-xl border-2 border-amber-500/50 font-black text-xs bg-white dark:bg-slate-900">
            <option value="1">✅ يمنح نقاط وفاء عادية (1x)</option>
            <option value="0">🚫 مستثنى من نقاط الوفاء (بدون نقاط - ربح ضئيل)</option>
            <option value="2">🔥 يمنح نقاطاً مضاعفة لترويج السلعة (2x Bonus)</option>
          </select>
        `;
        tab1.appendChild(loyaltyCard);
      }

      // 2. إزالة حقول "سعر الجملة / نصف الجملة" من التبويب الثاني واستبدالها بـ "سعر الكارطون / الفاردو للتجزئة"
      const wholesalePriceInp = document.getElementById('prodWholesalePriceInput');
      if (wholesalePriceInp) {
        const parentDiv = wholesalePriceInp.parentElement;
        const label = parentDiv?.querySelector('label');
        if (label) {
          label.innerHTML = '📦 سعر بيع الحبة داخل الكارطون/الفاردو (تجزئة عائلي د.ج) :';
          label.className = 'block text-xs font-black text-amber-600 dark:text-amber-400 mb-1';
        }
        wholesalePriceInp.placeholder = 'سعر الحبة عند شراء كارطون/فاردو...';
      }

      const semiWholesaleInp = document.getElementById('prodSemiWholesalePriceInput');
      const minWholesaleQtyInp = document.getElementById('prodMinWholesaleQtyInput');
      if (semiWholesaleInp && semiWholesaleInp.parentElement) {
        const lbl = semiWholesaleInp.parentElement.querySelector('label');
        if (lbl) lbl.innerHTML = '💰 إجمالي سعر الكارطون / الفاردو كاملاً (د.ج) :';
        semiWholesaleInp.placeholder = 'مثال: 250 د.ج للفاردو كاملاً';
        semiWholesaleInp.oninput = () => {
          const packTotal = parseFloat(semiWholesaleInp.value) || 0;
          const packUnits = Math.max(1, parseFloat(minWholesaleQtyInp?.value || '1') || 1);
          if (packTotal > 0 && wholesalePriceInp) {
            wholesalePriceInp.value = (packTotal / packUnits).toFixed(2);
          }
        };
      }
      if (minWholesaleQtyInp && minWholesaleQtyInp.parentElement) {
        const lbl = minWholesaleQtyInp.parentElement.querySelector('label');
        if (lbl) lbl.innerHTML = '📦 عدد الحبات داخل الكارطون / الفاردو (الشد) :';
        minWholesaleQtyInp.placeholder = 'مثال: 6 أو 12 أو 24';
        minWholesaleQtyInp.oninput = () => {
          const packUnits = Math.max(1, parseFloat(minWholesaleQtyInp.value || '1') || 1);
          const unitPackPrice = parseFloat(wholesalePriceInp?.value || '0') || 0;
          if (unitPackPrice > 0 && semiWholesaleInp) {
            semiWholesaleInp.value = (unitPackPrice * packUnits).toFixed(2);
          }
        };
      }

      // 3. ترقية تبويب 3 (الباركودات والعبوات) لإزالة كلمة "نصف جملة" وإضافة حاسبة الكارطون/الفاردو للتجزئة
      window.App.addExtraBarcodeRow = function (data = {}) {
        const container = document.getElementById('extraBarcodesContainer');
        if (!container) return;
        const unitSellPrice = parseFloat(document.getElementById('prodSellPriceInput')?.value || '0') || 0;
        const defaultPackQty = data.pack_qty || 12;
        const defaultPackPrice = data.pack_price || (unitSellPrice > 0 ? (unitSellPrice * defaultPackQty).toFixed(2) : '');

        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 gap-2 items-center extra-barcode-row bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700';
        row.innerHTML = `
          <div class="col-span-4">
            <label class="text-[10px] text-slate-400 font-bold">باركود الكارطون / الفاردو (اختياري)</label>
            <input type="text" value="${data.barcode || ''}" placeholder="امسح باركود الكارطون..." class="eb-code w-full px-2.5 py-1.5 rounded-lg text-xs font-mono">
          </div>
          <div class="col-span-3">
            <label class="text-[10px] text-amber-600 font-bold">نوع العبوة في التجزئة</label>
            <select class="eb-pack w-full px-2 py-1.5 rounded-lg text-xs font-bold">
              <option value="كارطون" ${(data.pack_label || '').includes('كارطون') || (data.pack_label || '').includes('كرتون') ? 'selected' : ''}>📦 كارطون (Carton)</option>
              <option value="فاردو" ${(data.pack_label || '').includes('فاردو') ? 'selected' : ''}>🥤 فاردو (Fardeau)</option>
              <option value="علبة" ${(data.pack_label || '').includes('علبة') ? 'selected' : ''}>🎁 علبة / باك (Pack)</option>
            </select>
          </div>
          <div class="col-span-2">
            <label class="text-[10px] text-blue-500 font-bold">الشد (عدد الحبات)</label>
            <input type="number" step="1" min="1" value="${defaultPackQty}" class="eb-qty w-full px-2 py-1.5 rounded-lg text-xs font-mono text-center font-black">
          </div>
          <div class="col-span-2">
            <label class="text-[10px] text-emerald-600 font-bold">سعر العبوة كاملاً (د.ج)</label>
            <input type="number" step="any" value="${defaultPackPrice}" placeholder="سعر الكارطون" class="eb-tier w-full px-2 py-1.5 rounded-lg text-xs font-mono text-center font-black text-emerald-600">
          </div>
          <div class="col-span-1 pt-4 text-center">
            <button type="button" onclick="this.closest('.extra-barcode-row').remove()" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg">✕</button>
          </div>
        `;
        container.appendChild(row);
      };

      // حفظ واسترجاع سياسة نقاط الوفاء للمنتج (في localStorage + قاعدة البيانات)
      const getLoyaltyMap = () => JSON.parse(localStorage.getItem('gherbi_product_loyalty_map') || '{}');
      const setLoyaltyForProduct = (prodIdOrBarcode, mode) => {
        const map = getLoyaltyMap();
        map[String(prodIdOrBarcode)] = Number(mode);
        localStorage.setItem('gherbi_product_loyalty_map', JSON.stringify(map));
      };
      this.getProductLoyaltyMultiplier = (prod) => {
        if (!prod) return 1;
        const map = getLoyaltyMap();
        if (map[String(prod.id)] !== undefined) return Number(map[String(prod.id)]);
        if (prod.barcode && map[String(prod.barcode)] !== undefined) return Number(map[String(prod.barcode)]);
        return 1;
      };

      const origOpenProdModal = window.App.openProductModal?.bind(window.App);
      if (origOpenProdModal && !window.App._v3ProdModalHooked) {
        window.App.openProductModal = function (id = null) {
          const r = origOpenProdModal(id);
          const sel = document.getElementById('prodLoyaltyModeSelect');
          if (sel) {
            const p = id ? (window.AppState.products || []).find((x) => Number(x.id) === Number(id)) : null;
            sel.value = String(p ? RetailV3.getProductLoyaltyMultiplier(p) : 1);
          }
          return r;
        };

        const origSaveProd = window.App.saveProduct?.bind(window.App);
        if (origSaveProd) {
          window.App.saveProduct = async function () {
            const id = document.getElementById('prodEditId')?.value;
            const barcode = document.getElementById('prodBarcodeInput')?.value?.trim();
            const loyaltyMode = document.getElementById('prodLoyaltyModeSelect')?.value ?? '1';
            await origSaveProd();
            if (id) setLoyaltyForProduct(id, loyaltyMode);
            if (barcode) setLoyaltyForProduct(barcode, loyaltyMode);
          };
        }
        window.App._v3ProdModalHooked = true;
      }
    },

    // ========================================================================
    // 7 (تتمة). ترقية السلة لدعم البيع بالكارطون/الفاردو للتجزئة + شارة الوفاء للمنتج
    // ========================================================================
    upgradeCartForRetailCartonsAndLoyalty() {
      // استبدال دالة toggleCartItemWholesaleUnit بدالة التبديل الذكية بين (بالقطعة / بالكارطون أو الفاردو)
      window.App.toggleCartItemWholesaleUnit = function (idx) {
        const cart = window.App.currentCart;
        if (!cart || !cart.items || !cart.items[idx]) return;
        const item = cart.items[idx];
        const prod = (window.AppState.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );

        // استخراج بيانات الكارطون/الفاردو للمنتج
        let packQty = Math.max(1, Number((prod && prod.min_wholesale_qty) || 1));
        let packUnitPrice = Number((prod && (prod.wholesale_price || prod.semi_wholesale_price)) || 0);
        let packLabel = 'كارطون';

        if (prod && prod.extra_barcodes_json) {
          try {
            const extra = JSON.parse(prod.extra_barcodes_json);
            if (Array.isArray(extra) && extra.length > 0) {
              const firstPack = extra[0];
              if (Number(firstPack.pack_qty) > 1) packQty = Number(firstPack.pack_qty);
              if (firstPack.pack_label) packLabel = firstPack.pack_label;
              const customPackTotal = parseFloat(firstPack.price_tier);
              if (Number.isFinite(customPackTotal) && customPackTotal > 0 && packQty > 0) {
                packUnitPrice = Number((customPackTotal / packQty).toFixed(2));
              }
            }
          } catch (_) {}
        }

        // إذا لم يكن للمنتج شد كارطون مسجل مسبقاً، نسأل البائع بسرعة (مثلاً 6 أو 12)
        if (packQty <= 1 && !item._isWholesaleMode) {
          const askQty = prompt(`📦 أدخل عدد الحبات داخل الكارطون / الفاردو لـ (${item.name}) (مثال: 6 أو 12):`, '6');
          if (!askQty || parseInt(askQty, 10) <= 1) return;
          packQty = parseInt(askQty, 10);
          const defaultTotal = (Number(item.price || 0) * packQty).toFixed(2);
          const askTotal = prompt(`💰 أدخل سعر بيع الكارطون/الفاردو كاملاً (${packQty} حبات) بالدينار:`, defaultTotal);
          if (askTotal && parseFloat(askTotal) > 0) {
            packUnitPrice = Number((parseFloat(askTotal) / packQty).toFixed(2));
          } else {
            packUnitPrice = Number(item.price || 0);
          }
        }

        if (!item._isWholesaleMode) {
          item._isWholesaleMode = true;
          item._savedRetailUnitPrice = item.price;
          item._packQtyMultiplier = packQty;
          item._packLabel = packLabel;
          item.price = packUnitPrice > 0 ? packUnitPrice : item.price;
          // نضبط الكمية لتكون مضاعفاً لعدد حبات الكارطون حتى يخصم المخزون بدقة!
          const numCartons = Math.max(1, Math.round(Number(item.quantity || 1)));
          item.quantity = numCartons * packQty;
          item.subtotal = Number((item.quantity * item.price).toFixed(2));
          if (window.showToast) {
            window.showToast(
              `📦 تم التحويل إلى بيع (${numCartons} ${packLabel} = ${item.quantity} حبة) بإجمالي ${item.subtotal.toFixed(2)} د.ج`,
              'info'
            );
          }
        } else {
          item._isWholesaleMode = false;
          item.price = Number(item._savedRetailUnitPrice || (prod && prod.selling_price) || item.price);
          item.quantity = 1;
          item.subtotal = Number((item.quantity * item.price).toFixed(2));
          if (window.showToast) {
            window.showToast('🥤 تم الإرجاع إلى البيع بالقطعة المفردة', 'info');
          }
        }

        window.App.recalcAndRenderCart();
      };

      // تحديث زر "📦 جملة / وحدة" داخل السلة ليصبح زر "[ بالقطعة | 📦 بالكارطون ]" مع إظهار شارة الوفاء
      const origRenderCartItems = window.App.renderCartItems?.bind(window.App);
      if (origRenderCartItems && !window.App._v3CartRenderHooked) {
        window.App.renderCartItems = function () {
          origRenderCartItems();
          const container = document.getElementById('posCartItems');
          if (!container) return;
          const items = window.App.currentCart?.items || [];

          Array.from(container.children).forEach((rowEl, idx) => {
            const item = items[idx];
            if (!item) return;
            const prod = (window.AppState.products || []).find(
              (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
            );

            // تحويل زر الجملة القديم إلى زر الكارطون/الفاردو للتجزئة
            const toggleBtn = rowEl.querySelector('button[onclick*="toggleCartItemWholesaleUnit"]');
            if (toggleBtn) {
              const packQty = item._packQtyMultiplier || (prod && prod.min_wholesale_qty > 1 ? prod.min_wholesale_qty : '');
              const packName = item._packLabel || 'كارطون';
              if (item._isWholesaleMode) {
                const cartonsCount = packQty > 1 ? (item.quantity / packQty).toFixed(0) : 1;
                toggleBtn.className = 'gherbi-pack-switch-pill mode-pack';
                toggleBtn.innerHTML = `📦 ${cartonsCount} ${packName} (×${packQty || item.quantity} حبة)`;
              } else {
                toggleBtn.className = 'gherbi-pack-switch-pill mode-unit';
                toggleBtn.innerHTML = `📦 بيع بالكارطون/الفاردو${packQty > 1 ? ' (×' + packQty + ')' : ''}`;
              }
            }

            // إضافة شارة حالة نقاط الوفاء للمنتج (مستثنى / مضاعف)
            if (prod) {
              const loyaltyMult = RetailV3.getProductLoyaltyMultiplier(prod);
              const metaRow = rowEl.querySelector('.flex.flex-wrap.items-center');
              if (metaRow && !metaRow.querySelector('.loyalty-elig-badge')) {
                const b = document.createElement('span');
                b.className = 'loyalty-elig-badge px-1.5 py-0.2 rounded text-[9.5px] font-sans font-bold';
                if (loyaltyMult === 0) {
                  b.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500');
                  b.textContent = '🚫 بدون نقاط وفاء';
                } else if (loyaltyMult === 2) {
                  b.classList.add('bg-amber-500/20', 'text-amber-600');
                  b.textContent = '🔥 نقاط وفاء 2x';
                }
                if (loyaltyMult !== 1) metaRow.appendChild(b);
              }
            }
          });
        };
        window.App._v3CartRenderHooked = true;
      }
    },

    // ========================================================================
    // 6. تطوير لوحة الأزرار السريعة (F7): تعديل الأزرار + قوالب جديدة + شريط مثبت في الكاشير
    // ========================================================================
    upgradeQuickTouchBoardF7() {
      // إضافة قوالب تجزئة إضافية (مخبزة، خضر وفواكه، أكياس وتغليف)
      const extraPresets = {
        bakery_veggies: [
          { label: 'خبز عادي (Baguette)', price: 15, category: 'مخبزة', icon: '🥖' },
          { label: 'خبز محسن / سميد', price: 30, category: 'مخبزة', icon: '🍞' },
          { label: 'حليب كيس مدعم (25 د.ج)', price: 25, category: 'ألبان', icon: '🥛' },
          { label: 'كيس بلاستيكي كبير', price: 10, category: 'تغليف', icon: '🛍️' },
          { label: 'بيض (حبة واحدة)', price: 25, category: 'غذائية', icon: '🥚' },
          { label: 'بلاطو بيض (30 حبة)', price: 680, category: 'غذائية', icon: '📦' },
          { label: 'خضر موسمية (موزونة)', price: 100, category: 'خضر', icon: '🥬' },
          { label: 'فواكه موسمية (موزونة)', price: 250, category: 'فواكه', icon: '🍎' }
        ]
      };

      const origLoadPreset = window.App.loadQuickTouchPreset?.bind(window.App);
      if (origLoadPreset) {
        window.App.loadQuickTouchPreset = function (presetKey) {
          if (extraPresets[presetKey]) {
            window.App.saveQuickTouchItems(extraPresets[presetKey]);
            window.App.renderQuickTouchBoard();
            if (window.showToast) window.showToast('✅ تم تحميل أزرار المخبزة والخضر والمواد اليومية', 'success');
            return;
          }
          return origLoadPreset(presetKey);
        };
      }

      // تطوير renderQuickTouchBoard لإضافة زر (✏️ تعديل السعر/الاسم) على كل بطاقة في نافذة F7 + شريط مثبت في الكاشير
      window.App.renderQuickTouchBoard = function () {
        const items = window.App.getQuickTouchItems();
        const modalGrid = document.getElementById('quickTouchModalGrid');
        if (modalGrid) {
          modalGrid.innerHTML = items.map((item, idx) => `
            <div class="relative group p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-500 transition text-right flex flex-col justify-between min-h-[96px] shadow-sm">
              <div class="flex items-center justify-between gap-1">
                <button type="button" onclick="event.stopPropagation(); App.removeQuickTouchItem(${idx})"
                  class="w-6 h-6 rounded-full bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white text-xs font-black flex items-center justify-center" title="حذف الزر">✕</button>
                <button type="button" onclick="event.stopPropagation(); RetailV3.editQuickTouchItem(${idx})"
                  class="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 text-[10px] font-black transition" title="تعديل اسم أو سعر هذا الزر السريع">✏️ تعديل</button>
              </div>
              <div onclick="App.triggerQuickTouchItem(${idx}); App.closeModal('quickTouchBoardModal');" class="cursor-pointer mt-1">
                <div class="text-xs font-black text-slate-800 dark:text-slate-100 leading-snug">${item.icon || '⚡'} ${item.label}</div>
                <div class="mt-1.5 flex items-center justify-between">
                  <span class="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">${Number(item.price || 0).toFixed(2)} د.ج</span>
                  <span class="text-[10px] font-bold text-slate-400">+ إدراج</span>
                </div>
              </div>
            </div>
          `).join('');
        }

        // تحديث شريط اللمس السريع المثبت أعلى المنتجات في شاشة البيع
        const strip = document.getElementById('posQuickTouchStrip');
        if (strip) {
          strip.className = 'gherbi-pinned-f7-strip';
          strip.innerHTML = items.slice(0, 12).map((item, idx) => `
            <button type="button" onclick="App.triggerQuickTouchItem(${idx})"
              oncontextmenu="event.preventDefault(); RetailV3.editQuickTouchItem(${idx});"
              title="اضغط لإدراجه فوراً في السلة | انقر بالزر الأيمن لتعديل سعره"
              class="gherbi-f7-quick-chip">
              <span>${item.icon || '⚡'}</span>
              <span>${item.label}</span>
              <span class="font-mono text-emerald-600 dark:text-emerald-400 font-black">(${Number(item.price || 0).toFixed(0)} د.ج)</span>
            </button>
          `).join('');
        }
      };

      window.App.renderQuickTouchBoard();
    },

    editQuickTouchItem(idx) {
      const items = window.App.getQuickTouchItems();
      const target = items[idx];
      if (!target) return;

      const newLabel = prompt('✏️ تعديل اسم السلعة / الخدمة السريعة:', target.label);
      if (newLabel === null || !newLabel.trim()) return;

      const newPrice = prompt(`💰 تعديل السعر بالدينار لـ (${newLabel.trim()}):`, target.price);
      if (newPrice === null) return;
      const parsedPrice = parseFloat(newPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return;

      target.label = newLabel.trim();
      target.price = parsedPrice;
      window.App.saveQuickTouchItems(items);
      window.App.renderQuickTouchBoard();
      if (window.showToast) window.showToast('✅ تم تحديث الزر السريع بنجاح', 'success');
    },

    // ========================================================================
    // 3 (تتمة). جدول رقابة المدير لتعديلات نقاط الوفاء داخل صفحة التقارير والإحصائيات
    // ========================================================================
    injectLoyaltyAuditReportInAnalytics() {
      const origRenderAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (!origRenderAnalytics || window.App._v3AnalyticsHooked) return;

      window.App.renderAnalyticsView = async function () {
        await origRenderAnalytics();
        const root = document.getElementById('analytics-view-root');
        if (!root || document.getElementById('ownerLoyaltyAuditReportCard')) return;

        const logs = (await window.api?.getAuditLogs?.().catch(() => [])) || [];
        const loyaltyLogs = logs.filter((l) => l.action_type === 'LOYALTY_POINTS_MANUAL_ADJUST');

        const card = document.createElement('div');
        card.id = 'ownerLoyaltyAuditReportCard';
        card.className = 'bg-white dark:bg-slate-800 border-2 border-amber-500/40 rounded-2xl p-5 mt-5 space-y-3';
        card.innerHTML = `
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="text-xl">👑</span>
              <div>
                <h3 class="font-black text-sm text-amber-600 dark:text-amber-400">سجل رقابة المدير: التعديلات اليدوية في رصيد نقاط الوفاء (${loyaltyLogs.length})</h3>
                <p class="text-[11px] text-slate-400">يوثّق أي زيادة أو إنقاص في رصيد نقاط الزبائن تم عبر الكود السري للمدير مع السبب والتوقيت</p>
              </div>
            </div>
          </div>
          ${
            loyaltyLogs.length === 0
              ? '<div class="py-6 text-center text-emerald-600 font-bold text-xs">✅ لم يتم تسجيل أي تعديل يدوي في نقاط الوفاء حتى الآن</div>'
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
                        <th class="py-2">السبب المسجل</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                      ${loyaltyLogs.map((l) => {
                        let d = {};
                        try { d = JSON.parse(l.details_json || '{}'); } catch (_) {}
                        const diff = Number(d.diff_points || 0);
                        return `
                          <tr class="hover:bg-amber-500/5">
                            <td class="py-2 font-mono text-[11px]">${String(l.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                            <td class="py-2 font-bold">${l.user_name || 'المدير'}</td>
                            <td class="py-2 font-black">${d.customer_name || 'زبون'}</td>
                            <td class="py-2 font-mono">${d.old_points ?? 0} نقطة</td>
                            <td class="py-2 font-mono font-black text-amber-600">${d.new_points ?? 0} نقطة</td>
                            <td class="py-2 font-mono font-black ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${diff > 0 ? '+' + diff : diff}</td>
                            <td class="py-2 font-bold text-slate-600 dark:text-slate-300">${d.reason || '—'}</td>
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
      window.App._v3AnalyticsHooked = true;
    },

    // ========================================================================
    // 5. ضمان عدم ظهور شاشة بيضاء عند الضغط على أي زر في الشريط العلوي
    // ========================================================================
    fixTopNavbarWhiteScreen() {
      const topNav = document.getElementById('gherbiEnterpriseTopNav');
      if (topNav) {
        topNav.addEventListener('click', () => {
          setTimeout(() => {
            const activeSec = document.querySelector('.view-section.active');
            if (!activeSec) {
              window.App.switchView('pos');
            }
          }, 50);
        });
      }
    }
  };

  window.RetailV3 = RetailV3;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailV3.init());
  } else {
    RetailV3.init();
  }
})();
