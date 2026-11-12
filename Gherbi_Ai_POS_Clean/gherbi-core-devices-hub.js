/**
 * gherbi-core-devices-hub.js
 * الحزمة المعمارية الثالثة (V13 Core Devices, Multi-Barcodes, Scale, Kiosk & Shortcuts Hub):
 * تضم هيكلة نافذة المنتج والباركودات المتعددة، شاشة فاحص الأسعار (/kiosk & Alt+B)، الميزان الإلكتروني (Alt+G)، ومركز الاختصارات (Alt+H).
 */
'use strict';


/* ==================== [MODULE: gherbi-v4-clean-stage3.js] ==================== */
/**
 * gherbi-v4-clean-stage3.js
 * الشطر الثالث (المحور 6 الكامل)
 */

'use strict';

(function initGherbiV4CleanStage3() {
  const Stage3 = {
    init() {
      const timer = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(timer);
        this.restructureProductModalForRetail();
        this.hookMultiBarcodeScanner();
        console.log('🚀 [Stage 3 Active]: Clean Retail Product Modal + Multi-Barcodes + Loyalty Policy Ready.');
      }, 240);
    },

    getTabElements() {
      const modal = document.getElementById('productModal');
      if (!modal) return {};
      return {
        modal,
        tab1: document.getElementById('prodTabContent-basic') || document.getElementById('prodTab1'),
        tab2: document.getElementById('prodTabContent-pricing') || document.getElementById('prodTab2'),
        tab3: document.getElementById('prodTabContent-barcodes') || document.getElementById('prodTab3'),
        barcodesContainer: document.getElementById('prodExtraBarcodesContainer') || document.getElementById('prodMultiBarcodesList')
      };
    },

    restructureProductModalForRetail() {
      const cleanAndEnhanceModal = () => {
        const { modal, tab1, tab2, tab3, barcodesContainer } = this.getTabElements();
        if (!modal) return;

        // 1. منع تكرار صندوق السوبرماركت وعروض BOGO تحت كل التبويبات، وحصره داخل التبويب 3 فقط
        const bogoSections = Array.from(modal.querySelectorAll('div')).filter(
          (d) =>
            d.id === 'supermarketRetailBogoSection' ||
            (d.textContent && d.textContent.includes('إعدادات السوبرماركت، الرفوف، وعروض المجاني التلقائية (BOGO):') && d.classList.contains('rounded-2xl'))
        );

        bogoSections.forEach((box, i) => {
          if (i > 0) {
            box.remove();
          } else if (tab3 && box.parentElement !== tab3) {
            tab3.appendChild(box);
          }
          // إخفاء حقل موقع السلعة في الرف المكرر داخل صندوق BOGO
          const dupRayon = box.querySelector('#prodShelfLocationInput') ||
            Array.from(box.querySelectorAll('input')).find((inp) => (inp.placeholder || '').includes('رواق'));
          if (dupRayon && dupRayon.parentElement) {
            dupRayon.parentElement.style.display = 'none';
          }
        });

        // 2. في التبويب 1: إضافة بطاقة "👑 احتساب المنتج في بطاقة الولاء حسب الفائدة"
        if (tab1 && !document.getElementById('prodLoyaltyPolicySelect')) {
          const card = document.createElement('div');
          card.id = 'v4ProductLoyaltyPolicyBox';
          card.className = 'md:col-span-3 col-span-full p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-wrap items-center justify-between gap-3 mt-1';
          card.innerHTML = `
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">👑</span>
              <div>
                <label for="prodLoyaltyPolicySelect" class="font-black text-xs text-amber-700 dark:text-amber-300 block">
                  هل يُحتسب هذا المنتج في بطاقة الولاء؟ (حماية هامش الفائدة)
                </label>
                <span id="prodLoyaltyAutoMarginHint" class="text-[11px] text-slate-500 font-bold">
                  استثنِ السلع ذات الفائدة الضعيفة أو المقننة (كالحليب والخبز والسكر) حتى لا تخسر في نقاط الولاء
                </span>
              </div>
            </div>
            <select id="prodLoyaltyPolicySelect" class="px-3 py-2 rounded-xl border-2 border-amber-500 font-black text-xs bg-white dark:bg-slate-900">
              <option value="1">✅ يُحتسب في بطاقة الولاء (100% نقاط كاملة)</option>
              <option value="0.5">⚖️ نصف النقاط فقط (50% - فائدة متوسطة)</option>
              <option value="0">🚫 لا يُحتسب في بطاقة الولاء نهائياً (0% - فائدة ضعيفة/مقنن)</option>
              <option value="2">🔥 نقاط مضاعفة ترويجية (200%)</option>
            </select>
          `;
          tab1.appendChild(card);
        }

        // 3. في التبويب 2: إزالة حقل هامش الربح المكرر وقسم نصف الجملة، وتحويل حقول الجملة إلى "الكارطون/الحزمة بالتجزئة"
        if (tab2) {
          Array.from(tab2.querySelectorAll('input')).forEach((inp) => {
            if (inp.id !== 'prodMarkupInput' && (inp.placeholder || '').includes('25%')) {
              const wrap = inp.parentElement;
              if (wrap && wrap !== tab2) wrap.style.display = 'none';
            }
          });

          const extraPrices = document.getElementById('prodExtraPricesContainer');
          if (extraPrices && extraPrices.parentElement && extraPrices.parentElement !== tab2) {
            extraPrices.parentElement.style.display = 'none';
          }

          const wsPrice = document.getElementById('prodWholesaleInput');
          const wsUnit = document.getElementById('prodWholesaleUnitInput');
          const wsQty = document.getElementById('prodWholesaleQtyInput') || document.getElementById('prodWholesaleMinQtyInput');

          if (wsPrice && wsPrice.previousElementSibling) {
            wsPrice.previousElementSibling.textContent = '📦 سعر بيع الكارطون / الحزمة بالتجزئة (د.ج)';
            wsPrice.previousElementSibling.className = 'block font-black mb-1 text-indigo-600 dark:text-indigo-400';
            wsPrice.placeholder = 'مثال: 250 د.ج لحزمة 6 قارورات...';
          }
          if (wsUnit && wsUnit.previousElementSibling) {
            wsUnit.previousElementSibling.textContent = 'اسم العبوة (كارطون / حزمة / فاردو)';
          }
          if (wsQty && wsQty.previousElementSibling) {
            wsQty.previousElementSibling.textContent = '🔢 عدد الحبات داخل الكارطون / الحزمة (الشد)';
          }

          // فحص تلقائي لهامش الربح لتنبيه التاجر إذا كان الربح ضعيفاً (<= 6%)
          const costInp = document.getElementById('prodCostInput');
          const priceInp = document.getElementById('prodPriceInput') || document.getElementById('prodSellInput');
          if (costInp && priceInp && !priceInp.dataset.v4MarginBound) {
            priceInp.dataset.v4MarginBound = '1';
            const checkProfitMargin = () => {
              const cost = parseFloat(costInp.value || '0') || 0;
              const sell = parseFloat(priceInp.value || '0') || 0;
              const sel = document.getElementById('prodLoyaltyPolicySelect');
              const hint = document.getElementById('prodLoyaltyAutoMarginHint');
              if (cost > 0 && sell > 0 && sel && hint) {
                const marginPct = ((sell - cost) / sell) * 100;
                if (marginPct <= 6) {
                  sel.value = '0';
                  hint.innerHTML = `<span class="text-rose-600 font-black">⚠️ فائدة هذا المنتج ضعيفة (${marginPct.toFixed(1)}%) — تم تحويله تلقائياً إلى (🚫 لا يُحتسب في بطاقة الولاء) لحماية ربحك!</span>`;
                } else {
                  hint.textContent = `هامش الفائدة جيد (${marginPct.toFixed(1)}%) — مؤهل لمنح نقاط الولاء`;
                }
              }
            };
            costInp.addEventListener('input', checkProfitMargin);
            priceInp.addEventListener('input', checkProfitMargin);
          }
        }

        // 4. في التبويب 3: شريط أزرار واضح لإضافة (باركود إضافي لنفس الحبة ×1) أو (باركود كارطون/حزمة ×6)
        if (tab3 && !document.getElementById('v4MultiBarcodesHeader')) {
          const oldBtn = tab3.querySelector('button[onclick*="addExtraBarcodeRow"], button[onclick*="addMultiBarcodeRow"]');
          const bar = document.createElement('div');
          bar.id = 'v4MultiBarcodesHeader';
          bar.className = 'p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex flex-wrap items-center justify-between gap-2 mb-3';
          bar.innerHTML = `
            <div class="text-xs">
              <div class="font-black text-blue-700 dark:text-blue-300">🏷️ الباركودات المتعددة لنفس المنتج أو للكارطون:</div>
              <div class="text-[11px] text-slate-500 font-bold">
                إذا كان لنفس المنتج أكثر من باركود في المحل اضغط (باركود إضافي لنفس الحبة ×1)، أو أضف باركود الكارطون/الحزمة
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" onclick="GherbiV4Stage3.addSameItemBarcodeRow()"
                class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm">
                🏷️ + باركود إضافي لنفس الحبة (×1)
              </button>
              <button type="button" onclick="GherbiV4Stage3.addCartonPackBarcodeRow()"
                class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-sm">
                📦 + باركود كارطون / حزمة (×6 / ×12)
              </button>
            </div>
          `;

          if (oldBtn && oldBtn.parentElement && oldBtn.parentElement !== tab3) {
            oldBtn.parentElement.replaceWith(bar);
          } else {
            tab3.insertBefore(bar, tab3.firstChild);
          }
        }
      };

      cleanAndEnhanceModal();

      // توحيد دالة إضافة سطر باركود فرعي (سواء استُدعيت باسم addExtraBarcodeRow أو addMultiBarcodeRow)
      const renderRetailBarcodeRow = (data = {}) => {
        const { barcodesContainer } = this.getTabElements();
        if (!barcodesContainer) return;

        const factor = Math.max(1, Number(data.pack_factor ?? data.unit_multiplier ?? 1));
        const isSingleUnit = factor === 1;
        const rawPrice = data.price_tier ?? data.price ?? '';
        const cleanPrice = rawPrice && !isNaN(Number(rawPrice)) ? rawPrice : '';
        const defaultLabel = isSingleUnit ? 'نفس الحبة (باركود إضافي)' : 'كارطون / حزمة';
        const labelVal = data.unit_label && data.unit_label !== 'نصف جملة' ? data.unit_label : (data.pack_name || defaultLabel);

        const row = document.createElement('div');
        row.className = 'multi-barcode-row extra-barcode-row grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mb-2';
        row.innerHTML = `
          <div class="col-span-5">
            <label class="text-[10px] font-black ${isSingleUnit ? 'text-blue-600' : 'text-indigo-600'}">
              ${isSingleUnit ? '🏷️ باركود إضافي لنفس المنتج/الحبة' : '📦 باركود الكارطون / الحزمة'}
            </label>
            <input type="text" class="mb-code eb-barcode w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-black border"
              placeholder="امسح الباركود الإضافي هنا..." value="${data.barcode || ''}">
          </div>
          <div class="col-span-3">
            <label class="text-[10px] text-slate-500 font-bold">البيان (نفس الحبة / حزمة)</label>
            <input type="text" class="mb-label eb-pack-name w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border"
              placeholder="${defaultLabel}" value="${labelVal}">
          </div>
          <div class="col-span-2">
            <label class="text-[10px] text-blue-600 font-bold">الشد (× حبة)</label>
            <input type="number" step="1" min="1" class="mb-factor eb-multiplier w-full px-2 py-1.5 rounded-lg text-xs font-mono font-black text-center border"
              value="${factor}">
          </div>
          <div class="col-span-1">
            <label class="text-[10px] text-emerald-600 font-bold">سعر خاص</label>
            <input type="number" step="any" class="mb-tier eb-price w-full px-1 py-1.5 rounded-lg text-xs font-mono font-black text-center text-emerald-600 border"
              placeholder="نفس السعر" value="${cleanPrice}">
          </div>
          <div class="col-span-1 pt-4 text-center">
            <button type="button" onclick="this.closest('.multi-barcode-row').remove()" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg font-black">✕</button>
          </div>
        `;
        barcodesContainer.appendChild(row);
        row.querySelector('.mb-code')?.focus();
      };

      window.App.addExtraBarcodeRow = renderRetailBarcodeRow;
      window.App.addMultiBarcodeRow = renderRetailBarcodeRow;

      // ربط فتح وحفظ نافذة المنتج
      const origOpen = window.App.openProductModal?.bind(window.App);
      if (origOpen && !window.App._v4Stage3OpenProdHooked) {
        window.App.openProductModal = function (prod = null) {
          const res = origOpen(prod);
          cleanAndEnhanceModal();
          const policies = JSON.parse(localStorage.getItem('gherbi_product_loyalty_policies') || '{}');
          const pid = prod && typeof prod === 'object' ? prod.id : (prod || document.getElementById('prodIdInput')?.value);
          const sel = document.getElementById('prodLoyaltyPolicySelect');
          if (sel) {
            sel.value = pid && policies[pid] !== undefined ? String(policies[pid]) : '1';
          }
          return res;
        };
        window.App._v4Stage3OpenProdHooked = true;
      }

      ['saveProduct', 'saveProductFromModal'].forEach((saveFnName) => {
        const origSave = window.App[saveFnName]?.bind(window.App);
        if (origSave && !window.App['_v4Stage3Save_' + saveFnName]) {
          window.App[saveFnName] = async function (...args) {
            const pidBefore = document.getElementById('prodIdInput')?.value || document.getElementById('prodEditId')?.value;
            const policyVal = parseFloat(document.getElementById('prodLoyaltyPolicySelect')?.value ?? '1');

            // حفظ الباركودات الإضافية أيضاً في خريطة محلية فورية لضمان تعرف الكاشير عليها في نفس اللحظة
            const { barcodesContainer } = Stage3.getTabElements();
            const extraBarcodes = [];
            if (barcodesContainer) {
              barcodesContainer.querySelectorAll('.multi-barcode-row, .extra-barcode-row').forEach((r) => {
                const code = r.querySelector('.mb-code, .eb-barcode, input[type="text"]')?.value?.trim();
                const label = r.querySelector('.mb-label, .eb-pack-name')?.value?.trim() || 'نفس الحبة';
                const factor = Math.max(1, parseFloat(r.querySelector('.mb-factor, .eb-multiplier')?.value || '1') || 1);
                const customPrice = parseFloat(r.querySelector('.mb-tier, .eb-price')?.value || '');
                if (code) {
                  extraBarcodes.push({
                    barcode: code,
                    unit_label: label,
                    pack_factor: factor,
                    price_tier: Number.isFinite(customPrice) && customPrice > 0 ? customPrice : ''
                  });
                }
              });
            }

            const res = await origSave(...args);

            const targetId = pidBefore || (window.AppState.products?.[window.AppState.products.length - 1]?.id);
            if (targetId) {
              const policies = JSON.parse(localStorage.getItem('gherbi_product_loyalty_policies') || '{}');
              policies[targetId] = policyVal;
              localStorage.setItem('gherbi_product_loyalty_policies', JSON.stringify(policies));

              const barcodeMap = JSON.parse(localStorage.getItem('gherbi_product_multi_barcodes_map') || '{}');
              barcodeMap[targetId] = extraBarcodes;
              localStorage.setItem('gherbi_product_multi_barcodes_map', JSON.stringify(barcodeMap));
            }
            return res;
          };
          window.App['_v4Stage3Save_' + saveFnName] = true;
        }
      });
    },

    addSameItemBarcodeRow() {
      window.App.addMultiBarcodeRow({
        barcode: '',
        unit_label: 'نفس الحبة (باركود إضافي)',
        pack_factor: 1,
        price_tier: ''
      });
    },

    addCartonPackBarcodeRow() {
      const qtyInp = document.getElementById('prodWholesaleQtyInput') || document.getElementById('prodWholesaleMinQtyInput');
      const priceInp = document.getElementById('prodWholesaleInput');
      const factor = parseFloat(qtyInp?.value || '6') || 6;
      const packPrice = parseFloat(priceInp?.value || '') || '';
      window.App.addMultiBarcodeRow({
        barcode: '',
        unit_label: 'كارطون / حزمة',
        pack_factor: factor,
        price_tier: packPrice
      });
    },

    findByAnyBarcode(rawCode) {
      const code = String(rawCode || '').trim();
      if (!code) return null;
      const products = window.AppState?.products || [];
      const localMap = JSON.parse(localStorage.getItem('gherbi_product_multi_barcodes_map') || '{}');

      for (const p of products) {
        if (String(p.barcode || '').trim() === code) {
          return { product: p, factor: 1, customPrice: null };
        }
        let multi = [];
        try {
          if (Array.isArray(p.multi_barcodes)) multi = multi.concat(p.multi_barcodes);
          if (typeof p.multi_barcodes_json === 'string' && p.multi_barcodes_json) {
            multi = multi.concat(JSON.parse(p.multi_barcodes_json));
          }
          if (Array.isArray(localMap[p.id])) {
            multi = multi.concat(localMap[p.id]);
          }
        } catch (_) {}

        const sub = multi.find((m) => String(m.barcode || '').trim() === code);
        if (sub) {
          const factor = Math.max(1, Number(sub.pack_factor ?? sub.unit_multiplier ?? 1));
          const priceVal = parseFloat(sub.price_tier ?? sub.price);
          return {
            product: p,
            factor,
            customPrice: Number.isFinite(priceVal) && priceVal > 0 ? priceVal : null
          };
        }
      }
      return null;
    },

    hookMultiBarcodeScanner() {
      const origScan = window.App.handleBarcodeScan?.bind(window.App);
      if (origScan && !window.App._v4Stage3ScanHooked) {
        window.App.handleBarcodeScan = async function (rawCode) {
          const found = Stage3.findByAnyBarcode(rawCode);
          if (found && found.product) {
            const p = found.product;
            const factor = found.factor;
            if (typeof window.App.addProductToCart === 'function') {
              window.App.addProductToCart(p.id, factor);
            } else if (typeof window.App.addToCart === 'function') {
              window.App.addToCart(p.id, factor);
            }

            if (found.customPrice !== null) {
              const items = window.App.currentCart?.items || [];
              const line = items.find((it) => Number(it.product_id || it.productId) === Number(p.id));
              if (line) {
                const unitPrice = found.customPrice > Number(p.selling_price || 0) && factor > 1
                  ? Number((found.customPrice / factor).toFixed(2))
                  : found.customPrice;
                line.price = unitPrice;
                line.subtotal = Number((Number(line.quantity || 1) * unitPrice).toFixed(2));
                window.App.recalcAndRenderCart?.();
              }
            }
            const bcInp = document.getElementById('barcodeInput');
            if (bcInp) bcInp.value = '';
            return;
          }
          return origScan(rawCode);
        };
        window.App._v4Stage3ScanHooked = true;
      }
    }
  };

  window.GherbiV4Stage3 = Stage3;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Stage3.init());
  } else {
    Stage3.init();
  }
})();


/* ==================== [MODULE: gherbi-v6-stage2-shortcuts-hub.js] ==================== */
/**
 * gherbi-v6-stage2-shortcuts-hub.js (V12 Complete Catalog Edition)
 * يضم كافة اختصارات النظام الجديدة والسابقة مع شرحها الدقيق وتنفيذها المباشر بالنقر
 */

'use strict';

(function initGherbiV6Stage2() {
  const V6Stage2 = {
    shortcutsCatalog: [
      // المجموعة 1: التسديد وإتمام الفاتورة
      {
        group: '💳 1. التسديد وإتمام الفاتورة',
        key: 'F1',
        title: 'فتح نافذة التسديد الشاملة',
        desc: 'فتح شاشة الدفع بالتجزئة (نقداً، كريدي/دين، بطاقة ذهبية CIB، أو بريدي موب) مع ملخص القفة والنقاط',
        action: () => window.App?.openCheckoutModal?.()
      },
      {
        group: '💳 1. التسديد وإتمام الفاتورة',
        key: 'Échap (Esc)',
        title: 'تذكرة 80mm فورية بضغطة واحدة',
        desc: 'تأكيد البيع نقداً وطباعة وصل حراري 80mm فوراً دون فتح نوافذ إضافية',
        action: () => window.App?.instantConfirmAndCheckout?.('receipt')
      },
      {
        group: '💳 1. التسديد وإتمام الفاتورة',
        key: 'Ctrl + Space',
        title: 'حفظ الفاتورة فوراً بدون طباعة',
        desc: 'تسجيل البيعة نقداً في الصندوق والمخزون وإفراغ السلة للزبون التالي بدون طباعة ورق',
        action: () => window.App?.instantConfirmAndCheckout?.('none')
      },
      {
        group: '💳 1. التسديد وإتمام الفاتورة',
        key: 'Alt + C',
        title: 'القفز لخانة المبلغ المستلم (حاسبة الصرف)',
        desc: 'وضع المؤشر مباشرة في خانة ما أعطاك الزبون لحساب الباقي بالدينار والسنتيم لحظياً',
        action: () => window.RetailV2?.focusInlineReceivedCash?.()
      },

      // المجموعة 2: بطاقة الوفاء، الزبائن، والسلات
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F8',
        title: 'نافذة بطاقة الوفاء واختيار الزبون',
        desc: 'فتح نافذة الزبائن مع وضع المؤشر تلقائياً لمسح باركود بطاقة الوفاء (FID-...) أو البحث بالاسم',
        action: () => window.RetailMaster?.openSmartLoyaltyModal?.('scan')
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F9',
        title: 'اختزال وخصم نقاط الوفاء بالدينار',
        desc: 'الذهاب مباشرة لخانة خصم نقاط الزبون الوفي وتحويلها إلى تخفيض مالي بالدينار والسنتيم',
        action: () => window.RetailMaster?.openSmartLoyaltyModal?.('redeem')
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'Alt + W',
        title: 'العودة الفورية إلى الزبون العابر',
        desc: 'إلغاء ربط الزبون الوفي من السلة الحالية والعودة فوراً إلى (زبون عابر — بدون بطاقة وفاء)',
        action: () => window.GherbiV7Stage1?.switchImmediatelyToWalkInCustomer?.()
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'Ctrl + N',
        title: 'فتح سلة مبيعات جديدة (+ سلة)',
        desc: 'إنشاء سلة جديدة فارغة على الزبون العابر لخدمة زبون آخر بالتوازي',
        action: () => window.App?.newCartTab?.()
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F2',
        title: 'تعليق الفاتورة في المسودات',
        desc: 'حفظ السلة الحالية مؤقتاً في المسودات ريثما يكمل الزبون تسوقه',
        action: () => window.App?.holdCurrentCart?.()
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F3',
        title: 'فتح نافذة المسودات المعلقة',
        desc: 'عرض واسترجاع الفواتير التي تم تعليقها مسبقاً بضغطة زر',
        action: () => window.App?.openDraftsModal ? window.App.openDraftsModal() : window.App?.openModal?.('draftsModal')
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F4',
        title: 'إلغاء وتفريغ السلة الحالية / البحث',
        desc: 'تفريغ السلة الحالية أو الانتقال لحقل البحث عن منتج بالاسم',
        action: () => document.getElementById('globalPosSearch')?.focus()
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'Alt + 1..9',
        title: 'التنقل السريع بين السلات المفتوحة',
        desc: 'اضغط Alt+1 للسلة الأولى، Alt+2 للسلة الثانية... للتنقل الفوري بالكيبورد',
        action: () => window.App?.switchCartTab?.(0)
      },

      // المجموعة 3: الإجمالي في الشريحة (F12)، السعر الأوسط (Alt+P)، الكمية، والباركود
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'F12',
        title: 'تعديل الإجمالي في الشريحة (السعر الأيسر)',
        desc: 'القفز مباشرة لتعديل إجمالي السطر في أقصى اليسار (ينقص الكمية 0.8 أو يخفض السعر حسب الوضع المختار)',
        action: () => window.GherbiV9Engine?.focusLineSubtotalWithF12?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + P / F11',
        title: 'تعديل السعر الأوسط (سعر الوحدة المباشر)',
        desc: 'القفز مباشرة إلى خانة السعر الأوسط (سعر الحبة) في الشريحة لتعديله مع حماية سعر التكلفة',
        action: () => window.GherbiV9Engine?.focusMiddleUnitPriceInput?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + Q',
        title: 'تعديل خانة الكمية في الشريحة مباشرة',
        desc: 'القفز مباشرة إلى مربع الكمية في الشريحة لكتابة العدد أو الوزن يدوياً',
        action: () => window.GherbiV9Engine?.focusQuantityInput?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + S',
        title: 'تبديل نظام عمل الإجمالي (كمية 0.8 ⇄ سعر ⇄ ذكي)',
        desc: 'التحكم في وظيفة خانة الإجمالي (F12) بين إنقاص الكمية تلقائياً (0.8) أو تخفيض السعر أو الوضع الذكي',
        action: () => window.GherbiV9Engine?.cycleSubtotalEditMode?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + T',
        title: 'قلب السطر بين (كمية جزئية بالغرام ⇄ تخفيض سعر)',
        desc: 'تحويل السطر المحدد بضغطة واحدة بين كمية جزئية بالمبلغ (0.96 = 960غ) وتخفيض سعر بكمية 1',
        action: () => {
          const idx = window.GherbiV9Engine?.getValidSelectedRowIndex?.() ?? 0;
          window.GherbiV9Engine?.convertRowBetweenFractionalQtyAndPriceDiscount?.(idx);
        }
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + K',
        title: 'التبديل بين (البيع بالحبة ⇄ الكرتونة / الباكي)',
        desc: 'تحويل السلعة المحددة في السلة إلى كرتونة/باكي حسب إعداداتها (مثل 8 قطع بـ 950 د.ج) أو ×6 افتراضياً',
        action: () => {
          const idx = window.GherbiV9Engine?.getValidSelectedRowIndex?.() ?? 0;
          window.GherbiV8PackEngine?.togglePackOnRow?.(idx);
        }
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'F5',
        title: 'التركيز الفوري على قارئ الباركود',
        desc: 'إعادة المؤشر فوراً إلى خانة مسح الباركود في أي وقت',
        action: () => document.getElementById('barcodeInput')?.focus()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'F6',
        title: 'نافذة فاحص السعر والمخزون الفوري',
        desc: 'فحص سعر أي سلعة بالدينار والسنتيم ومعرفة كميتها في المخزن دون إضافتها للسلة',
        action: () => window.RetailMaster?.openPriceCheckerModal?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'F7',
        title: 'مركز اللمس السريع والسلع اليومية ومنتجات المخزن',
        desc: 'فتح لوحة الأزرار السريعة (خبز، حليب، بيض، خدمات، ومنتجات المخزن المربوطة)',
        action: () => window.GherbiStage12Enforcer ? window.GherbiStage12Enforcer.openOurF7Modal() : window.App?.openQuickTouchModal?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Ctrl + X',
        title: 'تبديل مضاعف الكمية السريع (1x..10x)',
        desc: 'تغيير مضاعف الكمية (1x ⬅ 2x ⬅ 3x ⬅ 5x ⬅ 10x) قبل مسح السلعة',
        action: () => {
          const seq = [1, 2, 3, 5, 10];
          const cur = window.AppState?._quickMultiplier || 1;
          window.App?.setQuickMultiplier?.(seq[(seq.indexOf(cur) + 1) % seq.length]);
        }
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + F',
        title: 'إضافة منتج حر غير مسجل',
        desc: 'فتح نافذة إدخال سلعة أو خدمة سريعة غير مسجلة في المخزن',
        action: () => window.App?.openFreeItemModal?.()
      },

      // المجموعة 4: التحكم في السلة، الميزان، شاشة الأسعار، والإدارة
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: '↑ / ↓',
        title: 'التنقل بين سطور السلة للأعلى والأسفل',
        desc: 'اختيار السلعة داخل السلة بالكيبورد لتعديل إجماليها بـ F12 أو سعرها الأوسط بـ Alt+P',
        action: () => {}
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: '+ / - / Delete',
        title: 'زيادة أو إنقاص الكمية أو حذف السطر',
        desc: 'استخدم (+) و (-) لتغيير كمية السطر المحدد، و (Delete) لحذفه من السلة',
        action: () => {}
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + G',
        title: 'فتح محطة الميزان الإلكتروني المباشر',
        desc: 'فتح نافذة الميزان الإلكتروني وحاسبة الأوزان السريعة (100غ، 250غ، 500غ رطل، 1كغ) والبيع بالمبلغ',
        action: () => window.App?.openPosScaleModal?.()
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + B',
        title: 'تشغيل شاشة فاحص الأسعار للزبائن (Borne de Prix)',
        desc: 'فتح شاشة الأسعار الذاتية المخصصة للزبائن (والمحمية بكود المدير السري عند الخروج)',
        action: () => window.GherbiV7Stage2?.openKioskMode?.()
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'F10',
        title: 'إغلاق الوردية وجرد الصندوق (Z-Report)',
        desc: 'فتح نافذة إغلاق المناوبة وعدّ الفئات النقدية وطباعة تقرير Z-Report',
        action: () => window.RetailMaster?.triggerShiftCloseShortcutF10?.()
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + R',
        title: 'فتح خزنة الفواتير غير المسجلة وطوارئ الكهرباء',
        desc: 'استعراض واسترجاع الفواتير التي لم تُسجل أو انقطعت الكهرباء أثناء بيعها',
        action: () => window.GherbiV7Stage1?.openCrashVaultModal?.()
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + M',
        title: 'كاشف صافي ربح الفاتورة السري للمدير',
        desc: 'عرض إشعار سري يوضح صافي ربح المحل في السلة الحالية والمبلغ المؤهل للنقاط',
        action: () => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', altKey: true }));
        }
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + H',
        title: 'فتح دليل ومركز اختصارات لوحة المفاتيح الشامل',
        desc: 'فتح هذه النافذة في أي وقت للاطلاع على جميع الاختصارات أو البحث فيها',
        action: () => window.GherbiV6Stage2?.openShortcutsHub?.()
      }
    ],

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.injectShortcutsButtonInPos();
        this.buildInteractiveShortcutsModal();
        console.log('🚀 [Gherbi V12 Shortcuts Hub]: تم تحديث مركز الاختصارات بكامل الأزرار الجديدة والسابقة.');
      }, 200);
    },

    injectShortcutsButtonInPos() {
      const ensureBtn = () => {
        const topDeckRow = document.querySelector('#gherbiCartTopDeck > div:nth-child(2) > div:last-child');
        if (topDeckRow && !document.getElementById('gherbiPosShortcutsTriggerBtn')) {
          const btn = document.createElement('button');
          btn.id = 'gherbiPosShortcutsTriggerBtn';
          btn.type = 'button';
          btn.onclick = () => this.openShortcutsHub();
          btn.title = 'دليل كل اختصارات لوحة المفاتيح مع الشرح والتنفيذ المباشر (Alt+H)';
          btn.className = 'px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-slate-950 border border-amber-500/30 text-[11px] font-black transition flex items-center gap-1';
          btn.innerHTML = '<span>⌨️ الاختصارات</span>';
          topDeckRow.appendChild(btn);
        }

        const helpBtn = document.querySelector('button[onclick*="shortcutsHelpModal"]');
        if (helpBtn && !helpBtn.dataset.v12Upgraded) {
          helpBtn.dataset.v12Upgraded = '1';
          helpBtn.className = 'px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-black flex items-center gap-1 transition border border-slate-200 dark:border-slate-700';
          helpBtn.innerHTML = '<span class="material-symbols-rounded icon-sm text-blue-600 dark:text-blue-400">keyboard_command_key</span><span class="hidden xl:inline">دليل الاختصارات</span>';
          helpBtn.onclick = (e) => {
            e.preventDefault();
            this.openShortcutsHub();
          };
        }
      };

      ensureBtn();
      setInterval(ensureBtn, 800);
    },

    buildInteractiveShortcutsModal() {
      const modal = document.getElementById('shortcutsHelpModal');
      if (!modal) return;

      modal.innerHTML = `
        <div class="modal-content bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          <div class="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <span class="material-symbols-rounded">keyboard</span>
              </div>
              <div>
                <h3 class="text-sm font-black">دليل ومركز اختصارات لوحة المفاتيح الشامل (Keyboard Shortcuts Hub)</h3>
                <p class="text-[11px] text-slate-400">جميع الاختصارات المعتمدة في الكاشير (${this.shortcutsCatalog.length} اختصاراً) — 💡 انقر على أي اختصار لتنفيذه مباشرة!</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <input id="v6ShortcutsSearchInput" type="text" oninput="GherbiV6Stage2.renderShortcutsGrid(this.value)"
                placeholder="🔍 ابحث عن اختصار أو وظيفة (مثال: F12، السعر الأوسط، كمية)..."
                class="w-64 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs">
              <button type="button" onclick="App.closeModal('shortcutsHelpModal'); window.GherbiV6Stage1?.restorePosKeyboardFocus();"
                class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black flex items-center justify-center">✕</button>
            </div>
          </div>

          <div id="v6ShortcutsModalBody" class="p-5 overflow-y-auto space-y-5 flex-1"></div>

          <div class="px-5 py-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            <span class="text-[11px] font-bold text-slate-500">🟢 جميع الاختصارات تعمل تلقائياً داخل شاشة المبيعات لتسريع عمل البائع 100%</span>
            <button type="button" onclick="App.closeModal('shortcutsHelpModal'); window.GherbiV6Stage1?.restorePosKeyboardFocus();"
              class="px-5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black">
              إغلاق الدليل (Esc)
            </button>
          </div>
        </div>
      `;

      this.renderShortcutsGrid('');
    },

    openShortcutsHub() {
      this.buildInteractiveShortcutsModal();
      window.App.openModal('shortcutsHelpModal');
      setTimeout(() => document.getElementById('v6ShortcutsSearchInput')?.focus(), 50);
    },

    renderShortcutsGrid(query = '') {
      const body = document.getElementById('v6ShortcutsModalBody');
      if (!body) return;
      const q = String(query || '').trim().toLowerCase();

      const filtered = this.shortcutsCatalog
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
          if (!q) return true;
          return (
            item.key.toLowerCase().includes(q) ||
            item.title.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            item.group.toLowerCase().includes(q)
          );
        });

      if (!filtered.length) {
        body.innerHTML = '<div class="py-12 text-center text-slate-400 font-bold">لا يوجد اختصار مطابق للبحث</div>';
        return;
      }

      const groups = [...new Set(filtered.map((x) => x.item.group))];
      body.innerHTML = groups.map((grp) => {
        const itemsInGroup = filtered.filter((x) => x.item.group === grp);
        return `
          <div class="space-y-2">
            <div class="font-black text-xs text-blue-600 dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1">
              ${grp}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              ${itemsInGroup.map(({ item, idx }) => `
                <div onclick="GherbiV6Stage2.triggerShortcutFromHub(${idx})"
                     class="gherbi-shortcut-card" title="انقر لتجربة أو تنفيذ هذا الاختصار الآن">
                  <div class="space-y-0.5 min-w-0 flex-1">
                    <div class="font-black text-xs text-slate-800 dark:text-slate-100">${item.title}</div>
                    <div class="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">${item.desc}</div>
                  </div>
                  <kbd class="gherbi-kbd-badge" dir="ltr">${item.key}</kbd>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');
    },

    triggerShortcutFromHub(idx) {
      const item = this.shortcutsCatalog[idx];
      window.App.closeModal('shortcutsHelpModal');
      setTimeout(() => {
        if (item && typeof item.action === 'function') {
          item.action();
        }
      }, 60);
    }
  };

  window.GherbiV6Stage2 = V6Stage2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V6Stage2.init());
  } else {
    V6Stage2.init();
  }
})();


/* ==================== [MODULE: gherbi-v7-stage2-price-kiosk.js] ==================== */
/**
 * gherbi-v7-stage2-price-kiosk.js (Updated Navigation Bar Placement & Live Server Catalog Sync)
 * 1. يضع زر "🏷️ شاشة الأسعار للزبائن" داخل شريط أسماء الصفحات (#gherbiEnterpriseTopNav و #sidebar-nav) بدلاً من الهيدر الضيق.
 * 2. يصلح عرض رابط الشبكة (http://192.168.x.x:8080/kiosk) بدون أي نص زائد.
 * 3. يزامن مصفوفة المنتجات (AppState.products) تلقائياً مع الخادم المحلي لتعمل الشاشة في أي متصفح خارجي بكفاءة 100%.
 */

'use strict';

(function initGherbiV7Stage2Kiosk() {
  const V7Kiosk = {
    standbyTimer: null,
    focusTimer: null,
    lastSyncedCount: 0,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        // إزالة الزر القديم الضيق من الهيدر العلوي إن وجد
        document.getElementById('gherbiOpenAisleKioskBtn')?.remove();

        this.buildKioskOverlayDom();
        this.injectKioskButtonIntoPageNavBars();
        this.startAutomaticCatalogSyncToServer();
        console.log('🚀 [Gherbi V7 - Stage 2 Fixed]: تم نقل زر شاشة الأسعار إلى شريط الصفحات وتفعيل مزامنة المتصفح الخارجي.');
      }, 200);
    },

    // ========================================================================
    // 1. وضع زر "🏷️ شاشة الأسعار للزبائن" في شريط أسماء الصفحات (العلوي والجانبي)
    // ========================================================================
    injectKioskButtonIntoPageNavBars() {
      const ensureNavPlacement = () => {
        // 1. إزالة أي زر قديم في الهيدر الضيق
        document.querySelector('#top-header #gherbiOpenAisleKioskBtn')?.remove();

        // 2. الإضافة في القائمة الجانبية (#sidebar-nav) بدون الكلاس .nav-btn حتى لا ينسخه الشريط العلوي مرتين
        const sideNav = document.getElementById('sidebar-nav');
        if (sideNav) {
          const existingSideBtns = Array.from(sideNav.querySelectorAll('button')).filter((b) =>
            (b.textContent || '').includes('شاشة الأسعار للزبائن')
          );
          if (existingSideBtns.length > 1) {
            existingSideBtns.slice(1).forEach((b) => b.remove());
          }
          if (existingSideBtns.length === 0) {
            const btnSide = document.createElement('button');
            btnSide.id = 'gherbiSideNavKioskBtn';
            btnSide.type = 'button';
            btnSide.onclick = () => this.openKioskMode();
            // لاحظ عدم وضع كلاس nav-btn هنا لمنع النسخ المزدوج إلى الشريط العلوي
            btnSide.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition font-black';
            btnSide.innerHTML = '<span class="material-symbols-rounded icon-sm">qr_code_scanner</span><span class="sidebar-label font-black">شاشة الأسعار للزبائن</span>';
            const posNavBtn = sideNav.querySelector('button[data-view="pos"]');
            if (posNavBtn && posNavBtn.parentNode === sideNav) {
              sideNav.insertBefore(btnSide, posNavBtn.nextSibling);
            } else {
              sideNav.insertBefore(btnSide, sideNav.firstChild);
            }
          } else {
            existingSideBtns[0].classList.remove('nav-btn');
          }
        }

        // 3. ضمان وجود زر واحد فقط داخل الشريط العلوي (#gherbiEnterpriseTopNav)
        const topNav = document.getElementById('gherbiEnterpriseTopNav');
        if (topNav) {
          const allKioskBtnsInTop = Array.from(topNav.querySelectorAll('button')).filter((b) =>
            (b.textContent || '').includes('شاشة الأسعار للزبائن')
          );

          // إذا وُجد أكثر من زر (الأخضر والأزرق كما في الصورة 1)، نحذف الزائد فوراً
          if (allKioskBtnsInTop.length > 1) {
            allKioskBtnsInTop.slice(1).forEach((dupBtn) => dupBtn.remove());
          }

          let singleTopBtn = allKioskBtnsInTop[0] || null;
          if (!singleTopBtn) {
            singleTopBtn = document.createElement('button');
            if (topNav.firstElementChild) {
              topNav.insertBefore(singleTopBtn, topNav.firstElementChild.nextSibling);
            } else {
              topNav.appendChild(singleTopBtn);
            }
          }

          singleTopBtn.id = 'gherbiTopNavKioskBtn';
          singleTopBtn.type = 'button';
          singleTopBtn.removeAttribute('data-topview');
          singleTopBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openKioskMode();
          };
          singleTopBtn.className = 'gherbi-topnav-item shrink-0';
          singleTopBtn.style.cssText = 'background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff !important; border: 1px solid #34d399; font-weight: 900; border-radius: 0.6rem; padding: 0.28rem 0.75rem; margin-right: 0.25rem; display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);';
          singleTopBtn.innerHTML = '<span class="material-symbols-rounded icon-sm" style="font-size:16px">qr_code_scanner</span><span>شاشة الأسعار للزبائن</span>';
        }
      };

      ensureNavPlacement();
      setInterval(ensureNavPlacement, 400);
    },

    // ========================================================================
    // 2. مزامنة مصفوفة المنتجات (AppState.products) مع الخادم المحلي ليعمل المتصفح الخارجي 100%
    // ========================================================================
    syncCatalogToServerNow(forceSync = false) {
      const prods = window.AppState?.products || [];
      if (!Array.isArray(prods) || prods.length === 0) return;

      // حساب بصمة سريعة للكتالوج لمنع إرسال البيانات وكتابتها على القرص إذا لم يتغير أي منتج!
      let quickSum = prods.length;
      for (let i = 0; i < prods.length; i++) {
        const p = prods[i];
        quickSum += Number(p.selling_price || 0) * 13 + Number(p.total_stock ?? p.stock ?? 0) * 7 + Number(p.wholesale_price || 0);
      }
      const currentCatalogHash = `${prods.length}_${quickSum.toFixed(2)}`;
      if (!forceSync && this._lastSyncedCatalogHash === currentCatalogHash) {
        return; // لا يوجد أي تغيير — 0 استهلاك للمعالج والقرص!
      }
      this._lastSyncedCatalogHash = currentCatalogHash;

      const payload = JSON.stringify({ products: prods });
      fetch('http://127.0.0.1:8080/api/kiosk/sync-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: payload
      }).catch(() => {});
    },

    startAutomaticCatalogSyncToServer() {
      setTimeout(() => this.syncCatalogToServerNow(), 600);
      setTimeout(() => this.syncCatalogToServerNow(), 2000);
      setInterval(() => {
        const count = (window.AppState?.products || []).length;
        if (count > 0) {
          this.syncCatalogToServerNow();
        }
      }, 8000);
    },

    // ========================================================================
    // 3. بناء وتشغيل شاشة الكشك المدمجة مع إصلاح صيغة عنوان الشبكة
    // ========================================================================
    extractCleanLanUrl() {
      const lanBadge = document.getElementById('lanClientsCountText')?.textContent || '';
      const ipMatch = lanBadge.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch && ipMatch[1]) {
        return `http://${ipMatch[1]}:8080/kiosk`;
      }
      return 'http://localhost:8080/kiosk';
    },

    buildKioskOverlayDom() {
      const existing = document.getElementById('gherbiAisleKioskOverlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'gherbiAisleKioskOverlay';
      overlay.innerHTML = `
        <!-- الشريط العلوي لشاشة الزبون -->
        <header class="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-emerald-500/30">🏷️</div>
            <div>
              <h2 class="text-lg font-black text-white">شاشة فاحص الأسعار الذاتي للزبائن (Borne de Prix)</h2>
              <p class="text-xs text-emerald-400 font-bold">
                لفتح هذه الشاشة على أي تابلت أو متصفح في المحل افتح الرابط:
                <span id="kioskNetworkUrlHint" class="font-mono underline px-1.5 py-0.5 rounded bg-slate-800 text-amber-300" dir="ltr">http://localhost:8080/kiosk</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2.5 flex-1 max-w-xl">
            <input id="aisleKioskScanInput" type="text"
              oninput="GherbiV7Stage2.onKioskTyping(this.value)"
              onkeydown="if(event.key==='Enter') GherbiV7Stage2.lookupKioskItem(this.value)"
              placeholder="مرر باركود السلعة بالقارئ أو اكتب اسمها هنا..."
              class="flex-1 px-4 py-2.5 rounded-2xl bg-slate-950 border-2 border-emerald-500 text-white font-black text-sm text-center focus:ring-4 focus:ring-emerald-500/30">
            <button type="button" onclick="GherbiV7Stage2.promptExitKioskMode()"
              class="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black text-xs transition shrink-0"
              title="الخروج من وضع شاشة الزبائن (محمي بكود المدير)">
              🔒 خروج للكاشير
            </button>
          </div>
        </header>

        <main id="aisleKioskDisplayArea" class="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto"></main>

        <div id="kioskExitPinBox" class="hidden fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div class="w-full max-w-sm p-5 rounded-2xl bg-slate-900 border-2 border-amber-500 space-y-3 text-center">
            <div class="text-2xl">🔐</div>
            <h4 class="font-black text-sm text-amber-400">أدخل كود المدير للخروج من شاشة الزبائن</h4>
            <p class="text-[11px] text-slate-400">هذه الحماية تمنع الزبائن من إغلاق شاشة الأسعار والدخول للبرنامج (الافتراضي: 1234)</p>
            <input id="kioskExitPinInput" type="password" placeholder="كود المدير..."
              onkeydown="if(event.key==='Enter') GherbiV7Stage2.confirmExitKioskMode()"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500 text-white font-mono font-black text-center text-base tracking-widest">
            <div class="flex items-center justify-center gap-2 pt-1">
              <button type="button" onclick="document.getElementById('kioskExitPinBox').classList.add('hidden'); document.getElementById('aisleKioskScanInput')?.focus();"
                class="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">إلغاء</button>
              <button type="button" onclick="GherbiV7Stage2.confirmExitKioskMode()"
                class="px-5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">✔ تأكيد الخروج</button>
            </div>
          </div>
        </div>

        <footer class="px-6 py-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-bold">
          <span>🟢 القارئ الضوئي جاهز دائماً — مرر أي سلعة لمعرفة سعرها بالدينار والسنتيم</span>
          <span>تعود الشاشة تلقائياً لوضع الاستعداد بعد 10 ثوانٍ</span>
        </footer>
      `;

      overlay.addEventListener('click', (e) => {
        if (!e.target.closest('#kioskExitPinBox') && e.target.id !== 'aisleKioskScanInput') {
          document.getElementById('aisleKioskScanInput')?.focus();
        }
      });

      document.body.appendChild(overlay);
    },

    openKioskMode() {
      this.syncCatalogToServerNow();
      if (!document.getElementById('gherbiAisleKioskOverlay')) {
        this.buildKioskOverlayDom();
      }
      const overlay = document.getElementById('gherbiAisleKioskOverlay');
      if (!overlay) return;
      overlay.classList.add('active');
      this.renderStandbyScreen();

      const urlHint = document.getElementById('kioskNetworkUrlHint');
      if (urlHint) {
        urlHint.textContent = this.extractCleanLanUrl();
      }

      if (this.focusTimer) clearInterval(this.focusTimer);
      this.focusTimer = setInterval(() => {
        const pinBox = document.getElementById('kioskExitPinBox');
        if (overlay.classList.contains('active') && pinBox && pinBox.classList.contains('hidden')) {
          const inp = document.getElementById('aisleKioskScanInput');
          if (inp && document.activeElement !== inp) inp.focus();
        }
      }, 500);
    },

    promptExitKioskMode() {
      const box = document.getElementById('kioskExitPinBox');
      const inp = document.getElementById('kioskExitPinInput');
      if (!box || !inp) return;
      box.classList.remove('hidden');
      inp.value = '';
      setTimeout(() => inp.focus(), 50);
    },

    confirmExitKioskMode() {
      const entered = String(document.getElementById('kioskExitPinInput')?.value || '').trim();
      const validPin = String(
        window.AppState?.settings?.manager_loyalty_pin ||
        localStorage.getItem('gherbi_manager_loyalty_pin') ||
        '1234'
      ).trim();

      if (entered !== validPin) {
        if (window.showToast) window.showToast('❌ كود المدير غير صحيح!', 'error');
        document.getElementById('kioskExitPinInput')?.focus();
        return;
      }

      document.getElementById('kioskExitPinBox')?.classList.add('hidden');
      document.getElementById('gherbiAisleKioskOverlay')?.classList.remove('active');
      if (this.focusTimer) clearInterval(this.focusTimer);
      if (this.standbyTimer) clearTimeout(this.standbyTimer);
      window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
    },

    renderStandbyScreen() {
      const area = document.getElementById('aisleKioskDisplayArea');
      if (!area) return;
      area.innerHTML = `
        <div class="max-w-2xl space-y-4 animate-pulse">
          <div class="text-7xl">🛒⬇️</div>
          <h1 class="text-3xl md:text-4xl font-black text-white leading-snug">
            مرحباً بكم! مرّر باركود السلعة أمام القارئ لمعرفة السعر فوراً
          </h1>
          <p class="text-base md:text-lg text-slate-300 font-bold">
            يعرض السعر بالدينار الجزائري وبالسنتيم مع تسعيرة الكارطون والحزم العائلية
          </p>
        </div>
      `;
    },

    normalizeAr(str) {
      return String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه');
    },

    onKioskTyping(val) {
      const q = String(val || '').trim();
      if (q.length >= 2 && !/^\d+$/.test(q)) {
        this.lookupKioskItem(q, false);
      }
    },

    lookupKioskItem(rawQuery, clearInput = true) {
      const q = String(rawQuery || '').trim();
      const inp = document.getElementById('aisleKioskScanInput');
      if (clearInput && inp) inp.value = '';
      if (!q) return;

      const area = document.getElementById('aisleKioskDisplayArea');
      if (!area) return;

      const products = window.AppState?.products || [];
      let matchedProd = null;
      let matchedCustomPrice = null;

      if (window.GherbiV4Stage3 && typeof window.GherbiV4Stage3.findByAnyBarcode === 'function') {
        const subMatch = window.GherbiV4Stage3.findByAnyBarcode(q);
        if (subMatch && subMatch.product) {
          matchedProd = subMatch.product;
          matchedCustomPrice = subMatch.customPrice;
        }
      }

      if (!matchedProd) {
        const qNorm = this.normalizeAr(q);
        matchedProd = products.find(
          (p) =>
            String(p.barcode || '').toLowerCase() === q.toLowerCase() ||
            String(p.plu_code || '').toLowerCase() === q.toLowerCase() ||
            this.normalizeAr(p.name || '').includes(qNorm)
        );
      }

      if (!matchedProd) {
        area.innerHTML = `
          <div class="p-8 rounded-3xl bg-rose-950/60 border-2 border-rose-500 max-w-xl w-full space-y-3">
            <div class="text-5xl">⚠️</div>
            <div class="text-2xl font-black text-rose-300">لم يتم العثور على سلعة مطابقة لـ (${q})</div>
            <div class="text-sm font-bold text-slate-300">يرجى إعادة تمرير الباركود بوضوح أو استشارة البائع في الصندوق</div>
          </div>
        `;
      } else {
        const unitPrice = matchedCustomPrice !== null
          ? Number(matchedCustomPrice)
          : Number(matchedProd.selling_price ?? matchedProd.price ?? 0);
        const centimes = Math.round(unitPrice * 100).toLocaleString('fr-DZ');
        const packPrice = Number(matchedProd.wholesale_price || 0);
        const packQty = Number(matchedProd.wholesale_qty || matchedProd.wholesale_min_qty || 0);
        const stock = Number(matchedProd.total_stock ?? matchedProd.stock ?? 0);

        area.innerHTML = `
          <div class="p-8 rounded-3xl bg-slate-900/95 border-4 border-emerald-500 max-w-3xl w-full space-y-4 shadow-2xl">
            <div class="flex items-center justify-center gap-2 flex-wrap">
              <span class="px-4 py-1 rounded-full bg-blue-500/20 text-blue-300 font-black text-sm">🏷️ ${matchedProd.category || 'سلعة متوفرة'}</span>
              ${matchedProd.barcode ? `<span class="px-4 py-1 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-sm">${matchedProd.barcode}</span>` : ''}
            </div>

            <div class="text-3xl md:text-4xl font-black text-white leading-tight">${matchedProd.name}</div>

            <div class="py-3 px-6 rounded-2xl bg-slate-950/90 border border-emerald-500/40 inline-block">
              <div class="text-xs font-bold text-slate-400 mb-1">سعر البيع للزبون</div>
              <div class="kiosk-price-glow">${unitPrice.toFixed(2)} د.ج</div>
              <div class="text-xl md:text-2xl font-black text-amber-400 mt-2">🇩🇿 بالسنتيم: ${centimes} سنتيم</div>
            </div>

            <div class="flex items-center justify-center gap-3 flex-wrap pt-2">
              <div class="px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-sm">
                📦 الحالة: ${stock > 0 ? `متوفر في المحل (${stock} ${matchedProd.unit || 'قطعة'})` : 'متوفر'}
              </div>
              ${
                packPrice > 0 && packQty > 1
                  ? `<div class="px-4 py-2 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 font-black text-sm">
                       🎁 سعر الكارطون / الحزمة (×${packQty}): <span class="font-mono text-amber-300">${packPrice.toFixed(2)} د.ج</span>
                     </div>`
                  : ''
              }
            </div>
          </div>
        `;
      }

      if (this.standbyTimer) clearTimeout(this.standbyTimer);
      this.standbyTimer = setTimeout(() => {
        this.renderStandbyScreen();
      }, 10000);
    }
  };

  window.GherbiV7Stage2 = V7Kiosk;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V7Kiosk.init());
  } else {
    V7Kiosk.init();
  }
})();


/* ==================== [MODULE: gherbi-v7-stage3-pro-scale.js] ==================== */
/**
 * gherbi-v7-stage3-pro-scale.js
 * المحرك التنفيذي للشطر الثالث (الإصدار 7):
 * - تطوير نافذة الميزان الإلكتروني المباشر (#posScaleModal — الصورة الثالثة)
 * - حساب السعر الحي بالوزن (كغ / غرام) أو بالمبلغ العكسي (بيع بمبلغ د.ج)
 * - مفكك باركود الميزان الذكي (EAN-13 Scale Barcodes 20 / 21 / 22)
 */

'use strict';

(function initGherbiV7Stage3Scale() {
  const V7Scale = {
    currentWeightKg: 0.5,
    selectedProductId: null,
    onlyWeightedFilter: false,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.upgradePosScaleModalDom();
        this.hookScaleOpenAndLiveEvents();
        this.hookEan13ScaleBarcodeDecoder();
        console.log('🚀 [Gherbi V7 - Stage 3]: محطة الميزان الإلكتروني المباشر وقارئ باركود الميزان (20/21/22) جاهزة.');
      }, 220);
    },

    // ========================================================================
    // 1. إعادة بناء نافذة الميزان الإلكتروني المباشر (#posScaleModal) بتصميم احترافي
    // ========================================================================
    upgradePosScaleModalDom() {
      const modal = document.getElementById('posScaleModal');
      if (!modal) return;

      modal.innerHTML = `
        <div class="modal-content bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          <!-- الهيدر -->
          <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <span class="material-symbols-rounded">scale</span>
              </div>
              <div>
                <h3 class="text-sm font-black text-white">محطة الميزان الإلكتروني وحاسبة الوزن الفورية</h3>
                <p class="text-[10.5px] text-slate-400">تدعم القراءة الحية من الميزان بالكابل (USB/COM) أو اختيار الوزن السريع أو البيع بمبلغ محدد</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('posScaleModal')" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black">✕</button>
          </div>

          <div class="p-5 space-y-4">
            <!-- الشاشة الرقمية المزدوجة: الوزن الصافي + السعر الإجمالي المحسوب لحظياً -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 text-white border-2 border-emerald-500/50 shadow-inner">
              <div class="text-center border-l border-slate-800 pl-3 flex flex-col justify-center">
                <div class="text-[11px] text-slate-400 font-bold mb-1">الوزن الصافي المستقر ( بالكيلوغرام والغرام )</div>
                <div id="scaleModalWeightDisplay" class="text-4xl font-mono font-black text-emerald-400" dir="ltr">0.500 kg</div>
                <div id="scaleModalGramHelper" class="text-xs font-mono font-bold text-amber-400 mt-1">⚖️ يعادل: 500 غرام (رطل)</div>
              </div>

              <div class="text-center flex flex-col justify-center">
                <div class="text-[11px] text-slate-400 font-bold mb-1">المبلغ المحسوب لهذا الوزن</div>
                <div id="scaleModalComputedPriceDzd" class="text-3xl font-mono font-black text-sky-400">0.00 د.ج</div>
                <div id="scaleModalComputedCentimes" class="text-xs font-bold text-amber-300 mt-1">🇩🇿 بالسنتيم: 0 سنتيم</div>
              </div>
            </div>

            <!-- اختيار السلعة الموزونة مع بحث فوري -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="font-black text-slate-700 dark:text-slate-200">1. اختر السلعة المراد وزنها وتسعيرها:</label>
                <input id="scaleProductFilterInp" type="text" oninput="GherbiV7Stage3.populateScaleProducts(this.value)"
                  placeholder="🔍 ابحث عن سلعة بالاسم أو كود PLU..."
                  class="w-56 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-xs">
              </div>
              <select id="scaleModalProductSelect" onchange="GherbiV7Stage3.onScaleProductChange(this.value)"
                class="w-full px-3 py-2.5 rounded-xl border-2 border-blue-500/50 font-black text-xs bg-slate-50 dark:bg-slate-800"></select>
            </div>

            <!-- أزرار الأوزان الجزائرية الجاهزة بلمسة واحدة -->
            <div class="space-y-1.5">
              <label class="block font-black text-slate-700 dark:text-slate-200">2. اختر وزناً سريعاً بلمسة واحدة أو اقرأ من الميزان:</label>
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(0.100)" data-wpreset="0.1" class="scale-preset-pill">100 غ</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(0.200)" data-wpreset="0.2" class="scale-preset-pill">200 غ</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(0.250)" data-wpreset="0.25" class="scale-preset-pill">250 غ (ربع)</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(0.500)" data-wpreset="0.5" class="scale-preset-pill active">500 غ (رطل)</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(1.000)" data-wpreset="1" class="scale-preset-pill">1 كغ</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(2.000)" data-wpreset="2" class="scale-preset-pill">2 كغ</button>
              </div>
            </div>

            <!-- إدخال يدوي للوزن (كغ) ⇄ أو إدخال المبلغ المطلوب بالدينار لحساب الوزن عكسياً -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div>
                <label class="block font-black text-emerald-700 dark:text-emerald-400 mb-1">⚖️ كتابة الوزن يدوياً (بالكيلوغرام kg):</label>
                <input id="scaleManualWeightInput" type="number" step="0.001" min="0.001" value="0.500"
                  oninput="GherbiV7Stage3.setWeightKg(this.value, false)"
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-sm text-center">
              </div>
              <div>
                <label class="block font-black text-indigo-600 dark:text-indigo-400 mb-1">💵 أو البيع بمبلغ (اكتب كم أعطاك الزبون د.ج):</label>
                <input id="scaleTargetAmountDzdInput" type="number" step="any" min="1" placeholder="مثال: بـ 150 د.ج..."
                  oninput="GherbiV7Stage3.calcWeightFromMoneyDzd(this.value)"
                  class="w-full px-3 py-2 rounded-xl border-2 border-indigo-500 font-mono font-black text-sm text-center">
              </div>
            </div>

            <!-- أزرار التحكم الفيزيائي في الميزان المربوط بالكابل -->
            <div class="grid grid-cols-3 gap-2">
              <button type="button" onclick="GherbiV7Stage3.sendScaleCommand('zero')" class="py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700">
                🔄 تصفير الميزان (Zero)
              </button>
              <button type="button" onclick="GherbiV7Stage3.sendScaleCommand('tare')" class="py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700">
                🥣 خصم العلبة (Tare)
              </button>
              <button type="button" onclick="GherbiV7Stage3.sendScaleCommand('readOnce')" class="py-2 bg-blue-600/15 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl font-black transition">
                📡 قراءة من الكابل الآن
              </button>
            </div>

            <!-- زر الإدراج النهائي في السلة -->
            <button type="button" onclick="GherbiV7Stage3.confirmAddWeightedItemToCart()"
              class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2">
              <span class="material-symbols-rounded">add_shopping_cart</span>
              <span>إضافة الوزن والسعر المحسوب إلى السلة (Enter)</span>
            </button>
          </div>
        </div>
      `;
    },

    hookScaleOpenAndLiveEvents() {
      window.App.openPosScaleModal = () => {
        this.upgradePosScaleModalDom();
        this.populateScaleProducts('');

        // قراءة الوزن الحي إن كان الميزان يبث وزناً أكبر من 0
        const liveTxt = document.getElementById('liveScaleWeight')?.textContent || '0';
        const parsedLive = parseFloat(liveTxt.replace(/[^\d.]/g, '')) || 0;
        this.setWeightKg(parsedLive > 0 ? parsedLive : 0.5, true);

        window.App.openModal('posScaleModal');
      };

      window.App.addWeightedProductFromScaleModal = () => this.confirmAddWeightedItemToCart();
    },

    populateScaleProducts(query = '') {
      const sel = document.getElementById('scaleModalProductSelect');
      if (!sel) return;
      const q = String(query || '').trim().toLowerCase();
      const allProds = (window.AppState?.products || []).filter((p) => !p.hide_from_pos);

      // وضع السلع الموزونة (التي وحدتها كغ/متر أو لها كود ميزان PLU) في المقدمة دائماً
      const sorted = [...allProds].sort((a, b) => {
        const aIsWeighted = (a.plu_code && String(a.plu_code).trim() !== '') || /كغ|kg|غرام|وزن|ميزان/i.test(a.unit || '');
        const bIsWeighted = (b.plu_code && String(b.plu_code).trim() !== '') || /كغ|kg|غرام|وزن|ميزان/i.test(b.unit || '');
        if (aIsWeighted && !bIsWeighted) return -1;
        if (!aIsWeighted && bIsWeighted) return 1;
        return 0;
      });

      const filtered = sorted.filter((p) => {
        if (!q) return true;
        return (
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.plu_code || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q)
        );
      });

      if (!filtered.length) {
        sel.innerHTML = '<option value="">لا توجد سلعة مطابقة...</option>';
        return;
      }

      sel.innerHTML = filtered.slice(0, 120).map((p) => {
        const price = Number(p.selling_price ?? p.price ?? 0).toFixed(2);
        const unit = p.unit || 'كغ';
        const pluTag = p.plu_code ? ` [PLU: ${p.plu_code}]` : '';
        return `<option value="${p.id}">${p.name}${pluTag} — (${price} د.ج / ${unit})</option>`;
      }).join('');

      this.selectedProductId = Number(sel.value || 0);
      this.recalcScaleLiveTotal();
    },

    onScaleProductChange(pid) {
      this.selectedProductId = Number(pid || 0);
      this.recalcScaleLiveTotal();
    },

    setWeightKg(valKg, updateManualInput = true) {
      const w = Math.max(0, parseFloat(valKg) || 0);
      this.currentWeightKg = Number(w.toFixed(3));

      const disp = document.getElementById('scaleModalWeightDisplay');
      const gramEl = document.getElementById('scaleModalGramHelper');
      const manInp = document.getElementById('scaleManualWeightInput');

      if (disp) disp.textContent = `${this.currentWeightKg.toFixed(3)} kg`;
      if (gramEl) {
        const grams = Math.round(this.currentWeightKg * 1000);
        gramEl.textContent = `⚖️ يعادل بالغرام: ${grams.toLocaleString('fr-DZ')} غرام`;
      }
      if (updateManualInput && manInp) {
        manInp.value = this.currentWeightKg.toFixed(3);
      }

      document.querySelectorAll('[data-wpreset]').forEach((btn) => {
        btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.wpreset) - this.currentWeightKg) < 0.002);
      });

      this.recalcScaleLiveTotal();
    },

    getSelectedProduct() {
      const pid = Number(document.getElementById('scaleModalProductSelect')?.value || this.selectedProductId || 0);
      return (window.AppState?.products || []).find((p) => Number(p.id) === pid) || null;
    },

    recalcScaleLiveTotal() {
      const prod = this.getSelectedProduct();
      const unitPrice = prod ? Number(prod.selling_price ?? prod.price ?? 0) : 0;
      const totalDzd = Number((this.currentWeightKg * unitPrice).toFixed(2));
      const centimes = Math.round(totalDzd * 100).toLocaleString('fr-DZ');

      const priceEl = document.getElementById('scaleModalComputedPriceDzd');
      const centEl = document.getElementById('scaleModalComputedCentimes');

      if (priceEl) priceEl.textContent = `${totalDzd.toFixed(2)} د.ج`;
      if (centEl) centEl.textContent = `🇩🇿 بالسنتيم: ${centimes} سنتيم`;
    },

    calcWeightFromMoneyDzd(amountDzd) {
      const targetDzd = parseFloat(amountDzd);
      const prod = this.getSelectedProduct();
      const unitPrice = prod ? Number(prod.selling_price ?? prod.price ?? 0) : 0;
      if (!Number.isFinite(targetDzd) || targetDzd <= 0 || unitPrice <= 0) return;

      const computedKg = Number((targetDzd / unitPrice).toFixed(3));
      this.setWeightKg(computedKg, true);
    },

    async sendScaleCommand(cmd) {
      try {
        if (cmd === 'zero') {
          await window.api?.scale?.zero?.();
          this.setWeightKg(0, true);
          if (window.showToast) window.showToast('✅ تم تصفير الميزان (0.000 kg)', 'info');
        } else if (cmd === 'tare') {
          await window.api?.scale?.tare?.();
          if (window.showToast) window.showToast('✅ تم تفعيل خصم وزن العلبة (Tare)', 'info');
        } else if (cmd === 'readOnce') {
          const res = await window.api?.scale?.readOnce?.();
          const w = res && typeof res === 'object' ? Number(res.weight || 0) : Number(res || 0);
          if (w > 0) {
            this.setWeightKg(w, true);
            if (window.showToast) window.showToast(`📡 تمت قراءة الوزن من الميزان: ${w.toFixed(3)} كغ`, 'success');
          } else {
            if (window.showToast) window.showToast('ℹ️ لم يتم رصد وزن من الكابل — يمكنك اختيار الوزن السريع أو كتابته يدوياً', 'info');
          }
        }
      } catch (_) {
        if (window.showToast) window.showToast('ℹ️ الميزان غير متصل بالكابل حالياً — استخدم الأزرار السريعة أو الإدخال اليدوي', 'info');
      }
    },

    confirmAddWeightedItemToCart() {
      const prod = this.getSelectedProduct();
      if (!prod) {
        if (window.showToast) window.showToast('⚠️ يرجى اختيار السلعة أولاً', 'warning');
        return;
      }
      if (this.currentWeightKg <= 0) {
        if (window.showToast) window.showToast('⚠️ يرجى تحديد وزن أكبر من 0.000 كغ', 'warning');
        return;
      }

      if (typeof window.App.addProductToCart === 'function') {
        window.App.addProductToCart(prod.id, this.currentWeightKg);
      } else if (typeof window.App.addToCart === 'function') {
        window.App.addToCart(prod.id, this.currentWeightKg);
      }

      const grams = Math.round(this.currentWeightKg * 1000);
      const totalDzd = (this.currentWeightKg * Number(prod.selling_price || 0)).toFixed(2);
      window.App.closeModal('posScaleModal');
      if (window.showToast) {
        window.showToast(`⚖️ تمت إضافة "${prod.name}" (${grams} غرام = ${totalDzd} د.ج) إلى السلة`, 'success');
      }
      window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
    },

    // ========================================================================
    // 2. مفكك باركود ملصقات الميزان التلقائي (EAN-13 Scale Barcodes: 20 / 21 / 22)
    // ========================================================================
    decodeScaleBarcodeEan13(rawCode) {
      const code = String(rawCode || '').trim();
      // الباركود الموزون القياسي يتكون من 13 رقماً ويبدأ بـ 20 أو 21 أو 22
      if (!/^(20|21|22)\d{11}$/.test(code)) return null;

      const prefix = code.slice(0, 2);
      const pluRaw = code.slice(2, 7); // 5 أرقام لكود السلعة في الميزان (PLU)
      const valRaw = parseInt(code.slice(7, 12), 10) || 0; // 5 أرقام للوزن بالغرام أو السعر

      const products = window.AppState?.products || [];
      const pluNumber = parseInt(pluRaw, 10);

      const matchedProd = products.find((p) => {
        const pPlu = String(p.plu_code || '').trim();
        if (pPlu && (pPlu === pluRaw || parseInt(pPlu, 10) === pluNumber)) return true;
        if (String(p.barcode || '').trim() === pluRaw) return true;
        return false;
      });

      if (!matchedProd) return null;

      // في البادئة 20 و 21 القيمة هي الوزن بالغرام (مثلاً 00750 = 0.750 كغ)
      // وفي البادئة 22 القيمة هي المبلغ بالدينار فنتحول منه إلى الوزن
      let weightKg = Number((valRaw / 1000).toFixed(3));
      if (prefix === '22' && Number(matchedProd.selling_price) > 0) {
        weightKg = Number((valRaw / Number(matchedProd.selling_price)).toFixed(3));
      }

      return {
        product: matchedProd,
        weightKg: Math.max(0.001, weightKg),
        grams: Math.round(weightKg * 1000)
      };
    },

    hookEan13ScaleBarcodeDecoder() {
      const origScan = window.App.handleBarcodeScan?.bind(window.App);
      if (!origScan || window.App._v7ScaleBarcodeHooked) return;

      window.App.handleBarcodeScan = async function (rawCode) {
        const decoded = V7Scale.decodeScaleBarcodeEan13(rawCode);
        if (decoded && decoded.product) {
          const p = decoded.product;
          const w = decoded.weightKg;
          if (typeof window.App.addProductToCart === 'function') {
            window.App.addProductToCart(p.id, w);
          } else if (typeof window.App.addToCart === 'function') {
            window.App.addToCart(p.id, w);
          }
          const bcInp = document.getElementById('barcodeInput');
          if (bcInp) bcInp.value = '';
          if (window.showToast) {
            const totalDzd = (w * Number(p.selling_price || 0)).toFixed(2);
            window.showToast(`⚖️ باركود ميزان: "${p.name}" — الوزن: ${decoded.grams} غرام (${totalDzd} د.ج)`, 'success');
          }
          return;
        }
        return origScan(rawCode);
      };
      window.App._v7ScaleBarcodeHooked = true;
    }
  };

  window.GherbiV7Stage3 = V7Scale;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V7Scale.init());
  } else {
    V7Scale.init();
  }
})();


/* ==================== [V13 STAGE 3: EXPIRY GUARD, CUSTOMER DISPLAY SYNC & 80MM RECEIPT] ==================== */
(function initV13HardwareAndUiGuarantee() {
  const V13Stage3 = {
    alertedExpiredIds: new Set(),

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.setupLiveExpiryGuardInCart();
        this.setupCustomerDisplayAutoBroadcast();
        this.upgradeThermalReceiptWithCentimesAndLoyalty();
        this.guaranteeAllTopBarAndPosButtonsVisible();
        console.log('🚀 [V13 Devices Hub Fixed]: تم تفعيل جميع أزرار الشريط العلوي وواجهة المبيعات بنجاح 100%.');
      }, 220);
    },

    // ========================================================================
    // ضمان ظهور كافة أزرار الشريط العلوي وشريط السلة ولوحة اللمس (F7)
    // ========================================================================
    guaranteeAllTopBarAndPosButtonsVisible() {
      const enforceUiElements = () => {
        // 1. ضمان ظهور الشريط العلوي للأقسام وزر شاشة الأسعار للزبائن
        if (window.RetailV2 && typeof window.RetailV2.setupEnterpriseTopRibbon === 'function') {
          if (!document.getElementById('gherbiEnterpriseTopNav')) {
            window.RetailV2.setupEnterpriseTopRibbon();
          }
        }
        if (window.GherbiV7Stage2 && typeof window.GherbiV7Stage2.injectKioskButtonIntoPageNavBars === 'function') {
          window.GherbiV7Stage2.injectKioskButtonIntoPageNavBars();
        }

        // 2. ضمان ظهور شريط الأزرار السريعة المثبت (⚡ لوحة اللمس F7) أعلى المنتجات
        if (window.GherbiStage12Enforcer && typeof window.GherbiStage12Enforcer.ensureSinglePinnedDock === 'function') {
          window.GherbiStage12Enforcer.ensureSinglePinnedDock();
        }

        // 3. ضمان ظهور أزرار (+ سلة Ctrl+N | سجل | ⌨️ الاختصارات | ⚡ غير مسجلة) وأزرار (👤 عابر Alt+W)
        if (window.GherbiV6Stage2 && typeof window.GherbiV6Stage2.injectShortcutsButtonInPos === 'function') {
          window.GherbiV6Stage2.injectShortcutsButtonInPos();
        }
        if (window.GherbiV7Stage1 && typeof window.GherbiV7Stage1.injectVaultAndWalkInButtons === 'function') {
          window.GherbiV7Stage1.injectVaultAndWalkInButtons();
        }

        // 4. ضمان ظهور شريط التحكم في الإجمالي (F12) والسعر الأوسط (Alt+P) وحاسبة الصرف (Alt+C)
        if (window.GherbiV9Engine && typeof window.GherbiV9Engine.injectModeControlToolbarInPos === 'function') {
          window.GherbiV9Engine.injectModeControlToolbarInPos();
        }
        if (window.RetailV2 && typeof window.RetailV2.injectInlineChangeCalculatorAndQuickJump === 'function') {
          if (!document.getElementById('gherbiInlineChangeCalc')) {
            window.RetailV2.injectInlineChangeCalculatorAndQuickJump();
          }
        }
      };

      enforceUiElements();
      setTimeout(enforceUiElements, 500);
      setInterval(enforceUiElements, 1200);
    },

    computeProductExpiryStatus(prod) {
      if (!prod) return null;
      let rawExp = prod.expiry_date || '';
      if (!rawExp && Array.isArray(prod.batches)) {
        const activeBatchWithExp = prod.batches.find((b) => Number(b.stock || 0) > 0 && b.expiry_date);
        if (activeBatchWithExp) rawExp = activeBatchWithExp.expiry_date;
      }
      if (!rawExp || String(rawExp).trim() === '') return null;

      const expDateStr = String(rawExp).trim().slice(0, 10);
      const expTime = new Date(expDateStr + 'T23:59:59').getTime();
      if (isNaN(expTime)) return null;

      const daysLeft = Math.ceil((expTime - Date.now()) / 86400000);
      if (daysLeft < 0) {
        return { status: 'expired', daysLeft, dateStr: expDateStr, label: '🚨 منتهي الصلاحية (' + expDateStr + ')' };
      }
      if (daysLeft <= 15) {
        return { status: 'near_expiry', daysLeft, dateStr: expDateStr, label: '⏳ قريب الانتهاء (بقي ' + daysLeft + ' يوم)' };
      }
      return null;
    },

    setupLiveExpiryGuardInCart() {
      setInterval(() => {
        const cartBox = document.getElementById('posCartItems');
        if (!cartBox) return;

        const items = window.App?.currentCart?.items || [];
        if (items.length === 0) {
          this.alertedExpiredIds.clear();
          return;
        }

        const rows = Array.from(cartBox.children).filter(
          (el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة')
        );

        rows.forEach((row, idx) => {
          const item = items[idx];
          if (!item) return;

          const prod = (window.AppState?.products || []).find(
            (p) => Number(p.id) === Number(item.product_id || item.productId)
          );
          const expInfo = this.computeProductExpiryStatus(prod);
          const toolsBar = row.querySelector('.gherbi-v11-row-tools') || row.firstElementChild;
          if (!toolsBar) return;

          let badge = row.querySelector('.v13-expiry-guard-badge');
          if (!expInfo) {
            if (badge) badge.remove();
            return;
          }

          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'v13-expiry-guard-badge';
            toolsBar.appendChild(badge);
          }

          if (expInfo.status === 'expired') {
            badge.className = 'v13-expiry-guard-badge px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[10px] animate-pulse shadow-sm';
            if (badge.textContent !== expInfo.label) badge.textContent = expInfo.label;

            if (prod && !this.alertedExpiredIds.has(prod.id)) {
              this.alertedExpiredIds.add(prod.id);
              if (window.showToast) {
                window.showToast('🚨 تحذير هام: السلعة "' + prod.name + '" منتهية الصلاحية بتاريخ (' + expInfo.dateStr + ')!', 'error');
              }
            }
          } else if (expInfo.status === 'near_expiry') {
            badge.className = 'v13-expiry-guard-badge px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-black text-[10px]';
            if (badge.textContent !== expInfo.label) badge.textContent = expInfo.label;
          }
        });
      }, 450);
    },

    broadcastToCustomerDisplay() {
      if (!window.api?.updateCustomerDisplay) return;
      try {
        const cart = window.App?.currentCart;
        const items = cart?.items || [];
        const subtotal = items.reduce(
          (s, it) => s + Number(it.subtotal ?? Number(it.quantity || 1) * Number(it.price || 0)),
          0
        );
        const discount = Number(cart?.discount || 0) + Number(cart?.couponDiscount || 0);
        const total = Math.max(0, Number((subtotal - discount).toFixed(2)));
        const receivedCash = parseFloat(document.getElementById('gherbiReceivedCashInput')?.value || '0') || 0;

        const cid = cart?.customerId || document.getElementById('posCustomerSelect')?.value;
        const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;

        window.api.updateCustomerDisplay({
          items: items.map((it) => ({
            name: it.name || it.custom_product_name || 'سلعة',
            quantity: it.quantity || 1,
            price: it.price || 0,
            subtotal: it.subtotal || 0,
            _isCartonPackMode: Boolean(it._isCartonPackMode)
          })),
          subtotal,
          discount,
          total,
          receivedCash,
          customerName: cust ? cust.name : '',
          customerPoints: cust ? Number(cust.loyalty_points || 0) : 0
        });
      } catch (_) {}
    },

    setupCustomerDisplayAutoBroadcast() {
      ['recalcCart', 'recalcAndRenderCart', 'clearCurrentCart'].forEach((fn) => {
        const orig = window.App[fn]?.bind(window.App);
        if (orig && !window.App['_v13CustDisp_' + fn]) {
          window.App[fn] = function (...args) {
            const res = orig(...args);
            V13Stage3.broadcastToCustomerDisplay();
            return res;
          };
          window.App['_v13CustDisp_' + fn] = true;
        }
      });

      document.addEventListener(
        'input',
        (e) => {
          if (e.target && e.target.id === 'gherbiReceivedCashInput') {
            this.broadcastToCustomerDisplay();
          }
        },
        true
      );
    },

    upgradeThermalReceiptWithCentimesAndLoyalty() {
      if (!window.PrintEngine || typeof window.PrintEngine.renderReceiptHtml !== 'function') return;
      if (window.PrintEngine._v13ReceiptWrapped) return;

      const origRenderRec = window.PrintEngine.renderReceiptHtml.bind(window.PrintEngine);
      window.PrintEngine.renderReceiptHtml = async function (...args) {
        const rawHtml = await origRenderRec(...args);
        if (!rawHtml || typeof rawHtml !== 'string') return rawHtml;
        if (rawHtml.includes('v13-thermal-loyalty-footer') || rawHtml.includes('barcode_label')) {
          return rawHtml;
        }

        const cart = window.App?.currentCart;
        const lastSale = JSON.parse(localStorage.getItem('gherbi_last_completed_sale') || 'null');
        const totalDzd = Number(lastSale?.total ?? (typeof window.computeSafeCartTotalDzd === "function" ? window.computeSafeCartTotalDzd() : 0) ?? 0);
        if (totalDzd <= 0) return rawHtml;

        const centimesStr = Math.round(totalDzd * 100).toLocaleString('fr-DZ');
        const discountDzd = Number(lastSale?.discount ?? cart?.discount ?? 0);
        const cid = lastSale?.customer_id || cart?.customerId || document.getElementById('posCustomerSelect')?.value;
        const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;

        let loyaltyBoxHtml = '';
        if (cust) {
          const fidCode = 'FID-' + String(cust.id).padStart(5, '0');
          const pts = Number(cust.loyalty_points || 0);
          const ptsValDzd = (pts * 2).toFixed(2);
          loyaltyBoxHtml =
            '<div style="margin-top:6px;padding:6px;border:1px dashed #000;border-radius:6px;text-align:center;font-size:11px;font-weight:bold;">' +
            '<div>👑 بطاقة الوفاء: ' + cust.name + ' (' + fidCode + ')</div>' +
            '<div>رصيد نقاطكم الحالي: ⭐ ' + pts + ' نقطة (تعادل ' + ptsValDzd + ' د.ج)</div>' +
            '</div>';
        }

        const footerBlock =
          '<div class="v13-thermal-loyalty-footer" style="margin-top:8px;padding-top:6px;border-top:1.5px solid #000;font-family:Cairo,Tahoma,sans-serif;direction:rtl;text-align:center;">' +
          '<div style="font-size:12px;font-weight:900;">🇩🇿 المبلغ بالسنتيم: ' + centimesStr + ' سنتيم</div>' +
          (discountDzd > 0 ? '<div style="font-size:11px;font-weight:bold;margin-top:2px;">🎁 قيمة التخفيض والتوفير: -' + discountDzd.toFixed(2) + ' د.ج</div>' : '') +
          loyaltyBoxHtml +
          '</div>';

        if (rawHtml.includes('</body>')) {
          return rawHtml.replace('</body>', footerBlock + '</body>');
        }
        return rawHtml + footerBlock;
      };
      window.PrintEngine._v13ReceiptWrapped = true;
    }
  };

  window.GherbiV13Stage3 = V13Stage3;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V13Stage3.init());
  } else {
    V13Stage3.init();
  }
})();
