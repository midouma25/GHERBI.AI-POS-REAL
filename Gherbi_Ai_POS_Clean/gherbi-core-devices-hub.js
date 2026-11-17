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

/* ==================== [V49 PART 1: PERFECT PREVIEW & ABSOLUTE PRINT SILENT GATEKEEPER] ==================== */
(function initV49MasterOmniPrintStudioPart1() {
  const STORAGE_KEY = 'gherbi_v49_master_print_studio_config_v1';

  const MASTER_DOC_TYPES = [
    { id: 'receipt_thermal', name: '🧾 تذكرة كاشير حرارية (80mm / 58mm)', cleanTitle: 'وصل مبيعات / Ticket de Caisse', defaultPaper: '80mm', sourcePage: 'pos', sourceLabel: 'شاشة المبيعات والكاشير', counterKey: 'invoice' },
    { id: 'invoice_a4', name: '📄 فاتورة مبيعات رسمية (A4)', cleanTitle: 'فاتورة مبيعات / Facture', defaultPaper: 'a4', sourcePage: 'sales', sourceLabel: 'سجل المبيعات والضمان', counterKey: 'invoice' },
    { id: 'invoice_a5', name: '📑 فاتورة مبيعات مدمجة (A5)', cleanTitle: 'فاتورة مبيعات مدمجة (A5)', defaultPaper: 'a5', sourcePage: 'sales', sourceLabel: 'سجل المبيعات', counterKey: 'invoice' },
    { id: 'invoice_2xa5', name: '✂️ فاتورة مزدوجة (2×A5 في ورقة A4 — نسختان)', cleanTitle: 'فاتورة مبيعات / Facture', defaultPaper: '2xa5', sourcePage: 'sales', sourceLabel: 'سجل المبيعات (توفير 50% ورق)', counterKey: 'invoice' },
    { id: 'delivery_note', name: '🚚 وصل تسليم وتوصيل (Bon de Livraison)', cleanTitle: 'وصل تسليم بضاعة / Bon de Livraison', defaultPaper: 'a4', sourcePage: 'sales', sourceLabel: 'سجل المبيعات والتوصيل', counterKey: 'delivery' },
    { id: 'proforma', name: '📋 فاتورة شكلية / عرض سعر (Proforma)', cleanTitle: 'فاتورة شكلية / Facture Proforma', defaultPaper: 'a4', sourcePage: 'proformas', sourceLabel: 'الفواتير الشكلية', counterKey: 'proforma' },
    { id: 'customer_order', name: '📦 سند طلبية زبون (Bon de Commande)', cleanTitle: 'سند طلبية زبون / Bon de Commande', defaultPaper: 'a4', sourcePage: 'orders', sourceLabel: 'طلبيات الزبائن', counterKey: 'order' },
    { id: 'credit_note', name: "↩️ إشعار دائن / مرتجع (Facture d'Avoir)", cleanTitle: "إشعار دائن (مرتجع) / Facture d'Avoir", defaultPaper: 'a4', sourcePage: 'sales', sourceLabel: 'سجل المبيعات والمرتجعات', counterKey: 'avoir' },
    { id: 'payment_receipt', name: '💰 وصل قبض / تسديد دين (Reçu de Paiement)', cleanTitle: 'وصل استلام دفعة / Reçu de Paiement', defaultPaper: 'a5', sourcePage: 'customers', sourceLabel: 'الزبائن والديون والأقساط', counterKey: 'payment_receipt' },
    { id: 'purchase_invoice', name: '🛍️ سند استلام وفاتورة شراء (Bon de Réception)', cleanTitle: 'سند استلام ومشتريات / Bon de Réception', defaultPaper: 'a4', sourcePage: 'purchases', sourceLabel: 'المشتريات والموردين', counterKey: 'reception' },
    { id: 'warranty_cert', name: '🛡️ شهادة ضمان رسمية (Certificat de Garantie)', cleanTitle: 'شهادة ضمان رسمية / Certificat de Garantie', defaultPaper: 'a5', sourcePage: 'sales', sourceLabel: 'سجل المبيعات والضمان', counterKey: 'warranty' },
    { id: 'installment_contract', name: '🗓️ عقد بيع بالتقسيط وجدول الأقساط', cleanTitle: 'عقد بيع بالتقسيط / Contrat Vente par Facilité', defaultPaper: 'a4', sourcePage: 'customers', sourceLabel: 'الزبائن والأقساط الشهرية', counterKey: 'invoice' }
  ];

  const SUGGESTED_LAYERS_CATALOG = [
    { id: 'header_layer', cat: 'CORE', name: '🏢 ترويسة المتجر والشعار والبيانات الجبائية', desc: 'اسم المتجر، الشعار، الهاتف، العنوان، وأرقام RC / NIF / AI / NIS.', defaultVisible: true },
    { id: 'doc_banner_layer', cat: 'CORE', name: '🏷️ شريط عنوان ورقم المستند والباركود', desc: 'عنوان التذكرة/الفاتورة، رقمها التسلسلي، تاريخ وساعة الإصدار، والباركود.', defaultVisible: true },
    { id: 'customer_box_layer', cat: 'CORE', name: '👤 بطاقة بيانات الزبون / المورد والرصيد', desc: 'اسم الزبون أو المورد، رقم هاتفه، عنوانه، وبياناته الجبائية.', defaultVisible: true },
    { id: 'items_table_layer', cat: 'CORE', name: '📋 جدول الأصناف والكميات والأسعار', desc: 'جدول السلع المباعة بتخطيط ذكي يتكيف تلقائياً مع 80mm و A4.', defaultVisible: true },
    { id: 'totals_words_layer', cat: 'CORE', name: '💰 شلال المجاميع بالدينار والسنتيم والتفقيط', desc: 'المجموع الفرعي، التخفيض، الصافي بالدينار والسنتيم، والمبلغ بالحروف.', defaultVisible: true },
    { id: 'loyalty_points_layer', cat: 'LOYALTY', name: '👑 بطاقة نقاط الوفاء والمخصوم من البطاقة (VIP & عابر)', desc: 'تعرض نوع الزبون (وفي أو عابر 0 نقطة)، الرصيد السابق، المكتسب (+)، المخصوم (-)، والرصيد الجديد ومعادله بالدينار.', defaultVisible: true },
    { id: 'savings_promo_layer', cat: 'LOYALTY', name: '🎉 شريط "كم وفّرت اليوم؟" وعداد القطع الإجمالي', desc: 'يبرز للزبون إجمالي ما وفّره في الفاتورة وإجمالي عدد القطع المستلمة.', defaultVisible: false },
    { id: 'debt_ledger_layer', cat: 'FINANCE', name: '⚖️ كشف وضعية الديون والحساب التراكمي للزبون', desc: 'يوضح الدين السابق + دين الفاتورة الحالية - المدفوع اليوم = إجمالي الدين المتبقي.', defaultVisible: false },
    { id: 'payment_breakdown_layer', cat: 'FINANCE', name: '💳 تفصيل المقبوض، الصرف المرجع (Rendu)، والبائع', desc: 'يعرض المبلغ المستلم من الزبون، الصرف المرجع له، طريقة الدفع، واسم الكاشير.', defaultVisible: false },
    { id: 'tax_ifu_breakdown_layer', cat: 'FINANCE', name: '🇩🇿 جدول تفصيل الضرائب (TVA / الطابع / المواد المقننة)', desc: 'يفصل المبلغ خارج الرسم HT، ضريبة TVA، الطابع الجبائي، والسلع المقننة.', defaultVisible: false },
    { id: 'warranty_imei_layer', cat: 'LOGISTICS', name: '🛡️ شهادة الضمان والأرقام التسلسلية (IMEI / S-N)', desc: 'صندوق مخصص لمدة الضمان، شروط الصيانة، والأرقام التسلسلية للأجهزة.', defaultVisible: false },
    { id: 'installments_schedule_layer', cat: 'LOGISTICS', name: '🗓️ جدول الأقساط الشهرية ومواعيد الاستحقاق', desc: 'يعرض الدفعة الأولى (التسبيق)، عدد الأقساط الشهرية، قيمة كل قسط، وتواريخ الاستحقاق.', defaultVisible: false },
    { id: 'delivery_driver_layer', cat: 'LOGISTICS', name: '🚚 بطاقة التوصيل، السائق، عدد الطرود، وإمضاء الاستلام', desc: 'اسم السائق، رقم المركبة، عدد الكراتين/الطرود (Colis)، وخانة إمضاء الاستلام.', defaultVisible: false },
    { id: 'qr_social_wifi_layer', cat: 'LOYALTY', name: '📱 رمز QR، حسابات التواصل، وكود Wi-Fi الزبائن', desc: 'رمز استجابة سريعة للمتجر مع صفحات فيسبوك/واتساب أو كود Wi-Fi الزبائن.', defaultVisible: false },
    { id: 'footer_stamp_layer', cat: 'CORE', name: '✒️ التذييل، شروط الاستبدال، رمز RIP، والختم', desc: 'شروط الإرجاع والاستبدال خلال 48 ساعة، رقم حساب BaridiMob RIP، ومربع الختم.', defaultVisible: true }
  ];

  // القوالب الافتراضية المثالية الجاهزة للاعتماد الفوري بضغطة زر (Ready-to-Adopt Ideal Presets)
  const IDEAL_READY_PRESETS = [
    {
      id: 'preset_thermal_supermarket',
      label: '🧾 تذكرة سوبرماركت حرارية مثالية (80mm)',
      docType: 'receipt_thermal',
      paperSize: '80mm',
      themeId: 'pure_mono',
      fontSize: 11.5,
      columns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      activeLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'loyalty_points_layer', 'footer_stamp_layer']
    },
    {
      id: 'preset_a4_official',
      label: '📄 فاتورة مؤسسات رسمية كاملة (A4)',
      docType: 'invoice_a4',
      paperSize: 'a4',
      themeId: 'royal_blue',
      fontSize: 12,
      columns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: true, tva: false, subtotal: true },
      activeLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'debt_ledger_layer', 'loyalty_points_layer', 'footer_stamp_layer']
    },
    {
      id: 'preset_2xa5_economical',
      label: '✂️ فاتورة مزدوجة اقتصادية (2×A5 في ورقة A4)',
      docType: 'invoice_2xa5',
      paperSize: '2xa5',
      themeId: 'emerald_dz',
      fontSize: 11,
      columns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      activeLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer']
    },
    {
      id: 'preset_delivery_bl',
      label: '🚚 وصل تسليم وتوصيل مثالي (Bon de Livraison)',
      docType: 'delivery_note',
      paperSize: 'a4',
      themeId: 'emerald_dz',
      fontSize: 12,
      columns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: false, discount: false, tva: false, subtotal: false },
      activeLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'delivery_driver_layer', 'footer_stamp_layer']
    },
    {
      id: 'preset_payment_debt',
      label: '💰 وصل قبض وتسديد ديون (A5)',
      docType: 'payment_receipt',
      paperSize: 'a5',
      themeId: 'royal_blue',
      fontSize: 12,
      columns: { index: true, barcode: false, name: true, unit: false, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      activeLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'debt_ledger_layer', 'totals_words_layer', 'footer_stamp_layer']
    }
  ];

  const PAPER_SIZE_META = {
    a4: { label: 'مقاس A4 رسمي كامل (210×297 mm)', badge: 'A4', desc: 'ورقة كاملة للمؤسسات والفواتير الرسمية المفصلة', aspectW: 28, aspectH: 40 },
    a5: { label: 'مقاس A5 نصفي مدمج (148×210 mm)', badge: 'A5', desc: 'نصف ورقة مثالي للوصولات والفواتير المتوسطة', aspectW: 24, aspectH: 34 },
    '2xa5': { label: 'مقاس 2×A5 مزدوج (نسختان في ورقة A4)', badge: '2×A5', desc: 'يطبع نسختين (للزبون وللمتجر) في ورقة A4 واحدة بالعرض', aspectW: 42, aspectH: 28 },
    '80mm': { label: 'رول حراري 80mm قياسي للكاشير', badge: '80MM', desc: 'تذكرة كاشير حرارية سريعة عريضة متناسقة 100%', aspectW: 18, aspectH: 38 },
    '58mm': { label: 'رول حراري 58mm صغير', badge: '58MM', desc: 'تذكرة حرارية مدمجة للطابعات المحمولة والصغيرة', aspectW: 14, aspectH: 34 }
  };

  const VISUAL_THEMES = [
    { id: 'royal_blue', name: 'الأزرق الملكي التجاري', primary: '#1d4ed8', accent: '#eff6ff', border: '#93c5fd' },
    { id: 'emerald_dz', name: 'الأخضر الجزائري الرسمي', primary: '#047857', accent: '#ecfdf5', border: '#6ee7b7' },
    { id: 'executive_dark', name: 'الكحلي التنفيذي الفاخر', primary: '#0f172a', accent: '#f1f5f9', border: '#94a3b8' },
    { id: 'crimson_bold', name: 'القرمزي البارز للعروض', primary: '#be123c', accent: '#fff1f2', border: '#fda4af' },
    { id: 'amber_gold', name: 'الذهبي الكلاسيكي', primary: '#b45309', accent: '#fffbeb', border: '#fcd34d' },
    { id: 'pure_mono', name: 'الأسود والأبيض الاقتصادي (توفير الحبر)', primary: '#000000', accent: '#ffffff', border: '#000000' }
  ];

  const LABEL_PRESETS = [
    { id: 'roll_40x25', name: 'رول حراري قياسي (40×25 mm — ملصق باركود)', w: 40, h: 25, type: 'roll', mode: 'barcode' },
    { id: 'roll_50x30', name: 'رول حراري متوسط (50×30 mm — باركود + سنتيم)', w: 50, h: 30, type: 'roll', mode: 'barcode' },
    { id: 'roll_60x40', name: 'بطاقة رف سوبرماركت (60×40 mm — السعر بالدينار والسنتيم)', w: 60, h: 40, type: 'roll', mode: 'shelf_tag' },
    { id: 'promo_70x50', name: 'بطاقة عرض خاص للرف (70×50 mm — برومو مع شطب السعر القديم)', w: 70, h: 50, type: 'roll', mode: 'promo_tag' },
    { id: 'a4_65', name: 'ورقة A4 لاصقة (65 ملصقاً — 38×21.2 mm)', w: 38, h: 21.2, cols: 5, rows: 13, type: 'a4_sheet', mode: 'barcode' },
    { id: 'a4_40', name: 'ورقة A4 لاصقة (40 ملصقاً — 52.5×29.7 mm)', w: 52.5, h: 29.7, cols: 4, rows: 10, type: 'a4_sheet', mode: 'barcode' },
    { id: 'a4_24', name: 'ورقة A4 بطاقات رفوف (24 بطاقة — 70×37 mm)', w: 70, h: 37, cols: 3, rows: 8, type: 'a4_sheet', mode: 'shelf_tag' }
  ];

  function generateCrispBarcodeSvg(text, heightMm = 10, showText = true) {
    const clean = String(text || '613000000001').replace(/[^\x20-\x7E]/g, '').trim() || '6130001';
    const PATTERNS = [
      '11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100',
      '10001100100','11001001000','11001000100','11000100100','10110011100','10011011100','10011001110','10111001100',
      '10011101100','10011100110','11001110010','11001011100','11001001110','11011100100','11001110100','11101101110',
      '11101001100','11100101100','11100100110','11101100100','11100110100','11100110010','11011011000','11011000110',
      '11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000',
      '11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110',
      '11101110110','11010001110','11000101110','11011101000','11011100010','11011101110','11101011000','11101000110',
      '11100010110','11101101000','11101100010','11100011010','11101111010','11001000010','11110001010','10100110000',
      '10100001100','10010110000','10010000110','10000101100','10000100110','10110010000','10110000100','10011010000',
      '10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010',
      '10100111100','10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100',
      '11110010010','11011011110','11011110110','11110110110','10101111000','10100011110','10001011110','10111101000',
      '10111100010','11110101000','11110100010','10111011110','10111101110','11101011110','11110101110','11010000100',
      '11010010000','11010011100','1100011101011'
    ];
    let checksum = 104;
    let bits = PATTERNS[104];
    for (let i = 0; i < clean.length; i++) {
      const code = Math.max(0, Math.min(94, clean.charCodeAt(i) - 32));
      checksum += code * (i + 1);
      bits += PATTERNS[code];
    }
    bits += PATTERNS[checksum % 103] + PATTERNS[106];

    const totalBars = bits.length;
    let rects = '';
    let x = 0;
    while (x < totalBars) {
      if (bits[x] === '1') {
        let w = 1;
        while (x + w < totalBars && bits[x + w] === '1') w++;
        rects += `<rect x="${x}" y="0" width="${w}" height="40" fill="#000000"/>`;
        x += w;
      } else {
        x++;
      }
    }

    return `
      <div style="display:inline-flex;flex-direction:column;align-items:center;max-width:100%;">
        <svg viewBox="0 0 ${totalBars} 40" preserveAspectRatio="none" style="width:100%;height:${heightMm}mm;display:block;">
          ${rects}
        </svg>
        ${showText ? `<div style="font-family:monospace;font-size:9.5px;font-weight:900;letter-spacing:1px;margin-top:1px;color:#000;direction:ltr;">${clean}</div>` : ''}
      </div>
    `;
  }

  function createFullDefaultLayers() {
    return SUGGESTED_LAYERS_CATALOG.map((item) => ({
      id: item.id,
      name: item.name,
      visible: Boolean(item.defaultVisible),
      align: 'between',
      customNote: ''
    }));
  }

  function mergeCatalogLayersIntoSaved(savedLayers) {
    const list = Array.isArray(savedLayers) ? [...savedLayers] : [];
    const existingIds = new Set(list.map((l) => l.id));
    const footerIdx = list.findIndex((l) => l.id === 'footer_stamp_layer');

    for (const catItem of SUGGESTED_LAYERS_CATALOG) {
      if (!existingIds.has(catItem.id)) {
        const newLayerObj = {
          id: catItem.id,
          name: catItem.name,
          visible: Boolean(catItem.defaultVisible),
          align: 'between',
          customNote: ''
        };
        if (footerIdx >= 0) {
          list.splice(footerIdx, 0, newLayerObj);
        } else {
          list.push(newLayerObj);
        }
      }
    }
    return list;
  }

  const MasterPrintStudio = {
    activeSection: 'visual_studio',
    selectedLayerId: 'items_table_layer',
    catalogCategoryFilter: 'ALL',
    loyaltySimMode: 'vip',
    lastProcessedSalePayload: null,
    lastProcessedSaleResult: null,
    liveDataRecords: {
      sales: [],
      purchases: [],
      proformas: [],
      orders: [],
      customers: [],
      suppliers: [],
      products: []
    },
    printersList: [],
    selectedRecordId: 'SAMPLE',
    activeLoadedDocData: null,
    bridgeCategory: 'sales',
    bridgeSearch: '',
    labelQueue: [],

    previewModalState: {
      isOpen: false,
      docId: 'receipt_thermal',
      paperSize: '80mm',
      themeId: 'pure_mono'
    },

    freeDoc: {
      title: 'سند التزام / فاتورة حرة',
      recipient: 'السيد / المؤسسة: ...........................',
      date: new Date().toISOString().slice(0, 10),
      paper: 'a4',
      introText: 'نشهد نحن إدارة المتجر بتسليم / الاتفاق على البنود الموضحة أدناه:',
      items: [
        { name: 'سلعة / خدمة رقم 1', qty: 1, price: 1500 },
        { name: 'سلعة / خدمة رقم 2', qty: 2, price: 850 }
      ],
      footerNote: 'حرر بـ: الجزائر — إمضاء وختم الطرفين:'
    },

    config: {
      activeDocType: 'receipt_thermal',
      paperSize: '80mm',
      lang: 'ar',
      themeId: 'pure_mono',
      fontFamily: 'Cairo',
      baseFontSizePx: 11.5,
      zoomPct: 100,
      watermarkText: '',
      customHeaderTitle: '',
      customFooterTerms: 'البضاعة المباعة تستبدل خلال 48 ساعة بشرط سلامة الغلاف الأصلي وإحضار التذكرة. شكراً لزيارتكم!',
      showCentimesEquivalent: true,
      showAmountInWords: true,
      showCustomerBalance: true,
      showBaridimobQr: true,
      showDocBarcode: true,
      showStampSignature: true,

      customTexts: {
        shopName: '',
        shopDesc: '',
        shopAddress: '',
        shopPhone: '',
        colIndex: '#',
        colBarcode: 'الباركود',
        colName: 'التعيين / الصنف',
        colUnit: 'الوحدة',
        colQty: 'الكمية',
        colPrice: 'السعر',
        colDiscount: 'الخصم',
        colTva: 'TVA',
        colSubtotal: 'المجموع',
        totalLabel: 'الإجمالي الصافي:',
        stampLabel: 'الختم والإمضاء (Cachet)',
        loyaltyHeaderTitle: '👑 بطاقة الوفاء ومكافآت الزبون (Club Fidélité)',
        walkinInviteNote: '💡 سجل مجاناً في بطاقة الوفاء عند الكاشير لتربح نقاطاً وتخفيضات على كل مشترياتك!',
        warrantyNoteText: '🛡️ الضمان يشمل عيوب التصنيع لمدة 12 شهراً من تاريخ الفاتورة.',
        wifiSocialNote: '📶 شبكة Wi-Fi الزبائن: Gherbi_Store_VIP | 📱 تابع عروضنا اليومية!'
      },

      columns: {
        index: true,
        barcode: false,
        name: true,
        unit: true,
        qty: true,
        unitPrice: true,
        discount: false,
        tva: false,
        subtotal: true
      },

      layers: createFullDefaultLayers(),
      adoptedProfiles: {},

      defaultsByDocType: {
        receipt_thermal: { paperSize: '80mm', themeId: 'pure_mono', lang: 'ar', adopted: true },
        invoice_a4: { paperSize: 'a4', themeId: 'royal_blue', lang: 'ar', adopted: true },
        invoice_a5: { paperSize: 'a5', themeId: 'emerald_dz', lang: 'ar', adopted: true },
        invoice_2xa5: { paperSize: '2xa5', themeId: 'royal_blue', lang: 'ar', adopted: true },
        delivery_note: { paperSize: 'a4', themeId: 'emerald_dz', lang: 'ar', adopted: true },
        proforma: { paperSize: 'a4', themeId: 'executive_dark', lang: 'ar', adopted: true },
        customer_order: { paperSize: 'a4', themeId: 'amber_gold', lang: 'ar', adopted: true },
        credit_note: { paperSize: 'a4', themeId: 'crimson_bold', lang: 'ar', adopted: true },
        payment_receipt: { paperSize: 'a5', themeId: 'emerald_dz', lang: 'ar', adopted: true },
        purchase_invoice: { paperSize: 'a4', themeId: 'executive_dark', lang: 'ar', adopted: true },
        warranty_cert: { paperSize: 'a5', themeId: 'royal_blue', lang: 'ar', adopted: true },
        installment_contract: { paperSize: 'a4', themeId: 'amber_gold', lang: 'ar', adopted: true }
      },

      labelCfg: {
        presetId: 'roll_40x25',
        widthMm: 40,
        heightMm: 25,
        barcodeHeightMm: 11,
        showShopName: true,
        showProductName: true,
        showPriceDzd: true,
        showPriceCentimes: true,
        showOldPriceCrossed: false,
        oldPriceMultiplier: 1.15,
        showExpiryDate: false,
        previewProductId: null
      }
    },

    loadSavedConfig() {
      try {
        const raw =
          localStorage.getItem(STORAGE_KEY) ||
          localStorage.getItem('gherbi_v47_master_print_studio_config_v1') ||
          localStorage.getItem('gherbi_v45_master_print_studio_config_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          this.config = {
            ...this.config,
            ...parsed,
            customTexts: { ...this.config.customTexts, ...(parsed.customTexts || {}) },
            columns: { ...this.config.columns, ...(parsed.columns || {}) },
            labelCfg: { ...this.config.labelCfg, ...(parsed.labelCfg || {}) },
            adoptedProfiles: { ...(parsed.adoptedProfiles || {}) },
            defaultsByDocType: { ...this.config.defaultsByDocType, ...(parsed.defaultsByDocType || {}) }
          };
          this.config.layers = mergeCatalogLayersIntoSaved(parsed.layers);
          for (const k of Object.keys(this.config.adoptedProfiles)) {
            if (this.config.adoptedProfiles[k] && Array.isArray(this.config.adoptedProfiles[k].layers)) {
              this.config.adoptedProfiles[k].layers = mergeCatalogLayersIntoSaved(this.config.adoptedProfiles[k].layers);
            }
          }
          if (this.config.customHeaderTitle && this.config.customHeaderTitle.includes('80mm')) {
            this.config.customHeaderTitle = '';
          }
        }
      } catch (_) {}
    },

    saveConfigLocal() {
      try {
        const dt = this.config.activeDocType;
        this.config.adoptedProfiles[dt] = {
          paperSize: this.config.paperSize,
          themeId: this.config.themeId,
          fontFamily: this.config.fontFamily,
          baseFontSizePx: this.config.baseFontSizePx,
          watermarkText: this.config.watermarkText,
          customHeaderTitle: this.config.customHeaderTitle,
          customFooterTerms: this.config.customFooterTerms,
          showCentimesEquivalent: this.config.showCentimesEquivalent,
          showAmountInWords: this.config.showAmountInWords,
          showCustomerBalance: this.config.showCustomerBalance,
          showBaridimobQr: this.config.showBaridimobQr,
          showDocBarcode: this.config.showDocBarcode,
          showStampSignature: this.config.showStampSignature,
          customTexts: JSON.parse(JSON.stringify(this.config.customTexts)),
          columns: JSON.parse(JSON.stringify(this.config.columns)),
          layers: JSON.parse(JSON.stringify(this.config.layers))
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch (_) {}
    },

    // تطبيق قالب مثالي جاهز بضغطة زر واحدة
    async applyIdealPresetNow(presetId) {
      const pr = IDEAL_READY_PRESETS.find((x) => x.id === presetId);
      if (!pr) return;

      this.config.activeDocType = pr.docType;
      this.config.paperSize = pr.paperSize;
      this.config.themeId = pr.themeId;
      this.config.baseFontSizePx = pr.fontSize;
      this.config.columns = { ...this.config.columns, ...pr.columns };

      const activeSet = new Set(pr.activeLayers);
      this.config.layers = SUGGESTED_LAYERS_CATALOG.map((cat) => ({
        id: cat.id,
        name: cat.name,
        visible: activeSet.has(cat.id),
        align: 'between',
        customNote: ''
      }));

      await this.saveAsDefaultForDocType();
      if (window.showToast) {
        window.showToast(`✨ تم تطبيق واعتماد (${pr.label}) كقالب رسمي نشط!`, 'success');
      }
    },

    // اعتماد كافة القوالب المثالية لكل صفحات البرنامج الـ 18 دفعة واحدة
    async adoptAllIdealPresetsAcrossAllPages() {
      for (const pr of IDEAL_READY_PRESETS) {
        const activeSet = new Set(pr.activeLayers);
        const layersList = SUGGESTED_LAYERS_CATALOG.map((cat) => ({
          id: cat.id,
          name: cat.name,
          visible: activeSet.has(cat.id),
          align: 'between',
          customNote: ''
        }));

        this.config.defaultsByDocType[pr.docType] = {
          paperSize: pr.paperSize,
          themeId: pr.themeId,
          lang: 'ar',
          adopted: true
        };

        this.config.adoptedProfiles[pr.docType] = {
          paperSize: pr.paperSize,
          themeId: pr.themeId,
          fontFamily: 'Cairo',
          baseFontSizePx: pr.fontSize,
          watermarkText: '',
          customHeaderTitle: '',
          customFooterTerms: this.config.customFooterTerms,
          showCentimesEquivalent: true,
          showAmountInWords: true,
          showCustomerBalance: true,
          showBaridimobQr: true,
          showDocBarcode: true,
          showStampSignature: true,
          customTexts: JSON.parse(JSON.stringify(this.config.customTexts)),
          columns: { ...pr.columns },
          layers: layersList
        };
      }

      // تطبيق القالب المثالي الحالي في المحرر أيضاً
      const currentMeta = IDEAL_READY_PRESETS.find((x) => x.docType === this.config.activeDocType) || IDEAL_READY_PRESETS[0];
      await this.applyIdealPresetNow(currentMeta.id);

      if (window.showToast) {
        window.showToast('🚀 تم شحن واعتماد القوالب الافتراضية المثالية لجميع صفحات البرنامج الـ 18 بنجاح!', 'success');
      }
    },

    loadProfileForDocType(docId) {
      const savedProf = this.config.adoptedProfiles && this.config.adoptedProfiles[docId];
      const meta = MASTER_DOC_TYPES.find((d) => d.id === docId) || MASTER_DOC_TYPES[0];
      const def = this.config.defaultsByDocType[docId] || { paperSize: meta.defaultPaper, themeId: 'royal_blue' };

      if (savedProf) {
        this.config.paperSize = savedProf.paperSize || def.paperSize || meta.defaultPaper;
        this.config.themeId = savedProf.themeId || def.themeId || 'royal_blue';
        this.config.baseFontSizePx = savedProf.baseFontSizePx || 11.5;
        this.config.watermarkText = savedProf.watermarkText || '';
        this.config.customHeaderTitle = savedProf.customHeaderTitle || '';
        if (savedProf.customFooterTerms !== undefined) this.config.customFooterTerms = savedProf.customFooterTerms;
        if (savedProf.showCentimesEquivalent !== undefined) this.config.showCentimesEquivalent = savedProf.showCentimesEquivalent;
        if (savedProf.showAmountInWords !== undefined) this.config.showAmountInWords = savedProf.showAmountInWords;
        if (savedProf.showCustomerBalance !== undefined) this.config.showCustomerBalance = savedProf.showCustomerBalance;
        if (savedProf.showBaridimobQr !== undefined) this.config.showBaridimobQr = savedProf.showBaridimobQr;
        if (savedProf.showDocBarcode !== undefined) this.config.showDocBarcode = savedProf.showDocBarcode;
        if (savedProf.showStampSignature !== undefined) this.config.showStampSignature = savedProf.showStampSignature;
        if (savedProf.customTexts) this.config.customTexts = { ...this.config.customTexts, ...savedProf.customTexts };
        if (savedProf.columns) this.config.columns = { ...this.config.columns, ...savedProf.columns };
        if (Array.isArray(savedProf.layers)) {
          this.config.layers = mergeCatalogLayersIntoSaved(savedProf.layers);
        }
      } else {
        this.config.paperSize = def.paperSize || meta.defaultPaper;
        this.config.themeId = def.themeId || (docId === 'receipt_thermal' ? 'pure_mono' : 'royal_blue');
        this.config.customHeaderTitle = '';
        this.config.layers = createFullDefaultLayers();
        if (docId === 'delivery_note') this.setLayerVisibleQuiet('delivery_driver_layer', true);
        if (docId === 'warranty_cert') this.setLayerVisibleQuiet('warranty_imei_layer', true);
        if (docId === 'installment_contract') this.setLayerVisibleQuiet('installments_schedule_layer', true);
        if (docId === 'payment_receipt') this.setLayerVisibleQuiet('debt_ledger_layer', true);
      }
    },

    setLayerVisibleQuiet(layerId, isVis) {
      const l = this.config.layers.find((x) => x.id === layerId);
      if (l) l.visible = Boolean(isVis);
    },

    init() {
      this.loadSavedConfig();
      const wait = setInterval(() => {
        if (!window.App) return;
        clearInterval(wait);
        this.hookGlobalAppPrintMethods();
        this.installAbsolutePrintSilentGatekeeper();
        this.injectCrossPageQuickStudioButtons();
        const viewPrint = document.getElementById('view-print');
        if (viewPrint && viewPrint.classList.contains('active')) {
          this.openAndRenderStudio();
        }
        console.log('🚀 [Gherbi V49 Part 1]: تم تفعيل المعاينة الذكية والحارس المطلق لاعتماد القوالب في كل الصفحات 100%.');
      }, 120);
    },

    fmtDzd(val) {
      return Number(val || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    },

    fmtCentimes(val) {
      const c = Math.round(Math.abs(Number(val || 0)) * 100);
      if (c === 0) return '0 سنتيم';
      if (c >= 1000000) {
        return (c / 1000000).toFixed(2) + ' مليون سنتيم';
      }
      const thousands = Math.floor(c / 1000);
      const rem = c % 1000;
      return rem > 0 ? `${thousands} ألف و ${rem} سنتيم` : `${thousands} ألف سنتيم`;
    },

    amountToArabicWords(amount) {
      const n = Math.round(Number(amount || 0));
      if (typeof window.numberToArabicWords === 'function') {
        try { return window.numberToArabicWords(n) + ' دينار جزائري'; } catch (_) {}
      }
      return `${n.toLocaleString('fr-DZ')} دينار جزائري (${this.fmtCentimes(amount)})`;
    },

    getShopIdentity() {
      const s = window.AppState?.settings || {};
      const ct = this.config.customTexts || {};
      return {
        name: ct.shopName || s.shop_name || 'Gherbi.Ai POS',
        desc: ct.shopDesc || s.shop_description || 'تجارة بالتجزئة — الجزائر',
        address: ct.shopAddress || s.shop_address || 'الجزائر',
        phone: ct.shopPhone || s.shop_phone || '0550 00 00 00',
        rc: s.shop_rc || '00/00-0000000B00',
        nif: s.shop_nif || '000000000000000',
        ai: s.shop_ai || '00000000000',
        nis: s.shop_nis || '000000000000000',
        rip: s.shop_baridimob_rip || s.shop_ccp || '00799999000000000000',
        logo: s.shop_logo || ''
      };
    },

    // ========================================================================
    // 1. الحارس المطلق لبوابة الطباعة (Absolute PrintSilent & ProcessSale Gatekeeper)
    //    يمنع طباعة التذكرة القديمة (مثل qsffqsfqsf.pdf) ويفرض القالب المعتمد في الاستوديو 100%!
    // ========================================================================
    installAbsolutePrintSilentGatekeeper() {
      const self = this;

      this.generateAdoptedHtmlForDocument = async function (docTypeKey, saleOrRecordId, rawSaleObj) {
        const prevDocType = self.config.activeDocType;
        const prevRecId = self.selectedRecordId;
        const prevLoaded = self.activeLoadedDocData;

        try {
          let targetDocType = docTypeKey || 'receipt_thermal';
          if (targetDocType === 'receipt' || targetDocType === '80mm' || targetDocType === '58mm') targetDocType = 'receipt_thermal';
          if (targetDocType === 'a4' || targetDocType === 'invoice') targetDocType = 'invoice_a4';
          if (targetDocType === 'a5') targetDocType = 'invoice_a5';
          if (targetDocType === 'delivery' || targetDocType === 'bl') targetDocType = 'delivery_note';

          const defInfo = self.config.defaultsByDocType[targetDocType] || {};
          const savedProfile = self.config.adoptedProfiles[targetDocType] || {};
          const effectivePaperSize = defInfo.paperSize || savedProfile.paperSize || (targetDocType === 'receipt_thermal' ? '80mm' : 'a4');
          const effectiveThemeId = defInfo.themeId || savedProfile.themeId || (targetDocType === 'receipt_thermal' ? 'pure_mono' : 'royal_blue');

          let docData = null;
          if (rawSaleObj && Array.isArray(rawSaleObj.items) && rawSaleObj.items.length > 0) {
            const custId = rawSaleObj.customer_id || rawSaleObj.customerId || null;
            const custObj = (self.liveDataRecords.customers || window.AppState?.customers || []).find(
              (c) => custId && Number(c.id) === Number(custId)
            );
            docData = self.enrichDocumentDataWithLoyaltyAndDebt({
              docNumber: rawSaleObj.doc_number || rawSaleObj.docNumber || ('#' + (rawSaleObj.id || (self.lastProcessedSaleResult && self.lastProcessedSaleResult.saleId) || Date.now().toString().slice(-4))),
              date: String(rawSaleObj.sale_date || new Date().toISOString()).replace('T', ' ').slice(0, 16),
              customerId: custId,
              partyTitle: 'الزبون:',
              partyName: rawSaleObj.customer_name || (custObj && custObj.name) || 'زبون عابر (Comptoir)',
              partyPhone: rawSaleObj.customer_phone || (custObj && custObj.phone) || '-',
              partyAddress: rawSaleObj.customer_address || (custObj && custObj.address) || '-',
              partyRc: rawSaleObj.customer_rc || (custObj && custObj.rc) || '-',
              partyNif: rawSaleObj.customer_nif || (custObj && custObj.nif) || '-',
              paymentMethod: rawSaleObj.payment_method || 'نقداً',
              cashierName: rawSaleObj.seller_name || rawSaleObj.user_name || 'المدير العام',
              previousBalance: Number(rawSaleObj.previous_debt || 0),
              loyaltyPointsEarned: rawSaleObj.points_earned,
              loyaltyPointsRedeemed: rawSaleObj.points_redeemed,
              loyaltyDiscountDzd: rawSaleObj.loyalty_discount,
              items: rawSaleObj.items.map((it) => {
                const prodLookup = (self.liveDataRecords.products || window.AppState?.products || []).find(
                  (p) => Number(p.id) === Number(it.product_id || it.productId || it.id)
                );
                return {
                  barcode: it.barcode || it.product_barcode || (prodLookup && prodLookup.barcode) || '-',
                  name: it.name || it.product_name || it.custom_product_name || (prodLookup && prodLookup.name) || 'صنف',
                  unit: it.unit || it.product_unit || (prodLookup && prodLookup.unit) || 'قطعة',
                  qty: Number(it.quantity ?? it.qty ?? 1),
                  price: Number(it.price ?? it.selling_price ?? 0),
                  discount: Number(it.discount || 0),
                  tva: Number(rawSaleObj.tax_percentage || 0),
                  subtotal: Number(it.subtotal ?? Number(it.price || 0) * Number(it.quantity || 1))
                };
              }),
              subtotal: Number(rawSaleObj.subtotal ?? rawSaleObj.total ?? 0),
              discount: Number(rawSaleObj.discount || 0),
              tvaAmount: 0,
              stampAmount: Number(rawSaleObj.stamp_amount || 0),
              total: Number(rawSaleObj.total || 0),
              paidAmount: Number(rawSaleObj.paid_amount ?? rawSaleObj.total ?? 0),
              receivedAmount: Number(rawSaleObj.received_amount ?? rawSaleObj.paid_amount ?? rawSaleObj.total ?? 0),
              remainingDebt: Math.max(0, Number(rawSaleObj.total || 0) - Number(rawSaleObj.paid_amount ?? rawSaleObj.total ?? 0))
            });
          } else {
            self.selectedRecordId = saleOrRecordId ? String(saleOrRecordId) : 'SAMPLE';
            self.activeLoadedDocData = null;
            docData = await self.resolveActiveDocumentData(targetDocType);
          }

          const customOverrides = {
            ...savedProfile,
            activeDocType: targetDocType,
            paperSize: effectivePaperSize,
            themeId: effectiveThemeId
          };

          const paperBody = self.buildLiveDocumentPaperHtml(docData, true, customOverrides);
          const isThermal = effectivePaperSize === '80mm' || effectivePaperSize === '58mm';
          const pageCss = isThermal
            ? `@page { size: ${effectivePaperSize} auto; margin: 1.5mm; }`
            : effectivePaperSize === '2xa5'
            ? `@page { size: A4 landscape; margin: 6mm; }`
            : effectivePaperSize === 'a5'
            ? `@page { size: A5 portrait; margin: 6mm; }`
            : `@page { size: A4 portrait; margin: 8mm; }`;

          return `<!DOCTYPE html><html lang="ar" dir="rtl" data-v49-adopted-master="1"><head><meta charset="UTF-8"><style>
            ${pageCss}
            * { box-sizing: border-box !important; }
            body { margin: 0; padding: 0; font-family: '${customOverrides.fontFamily || 'Cairo'}', 'Cairo', Tahoma, sans-serif; color: #0f172a; background: #fff; width: 100%; }
            .v45-live-paper { box-shadow: none !important; margin: 0 auto !important; min-height: auto !important; padding: ${isThermal ? '1.5mm' : '4mm'} !important; }
            .v45-canvas-layer { border: none !important; box-shadow: none !important; margin-bottom: 6px !important; }
          </style></head><body>${paperBody}</body></html>`;
        } finally {
          self.config.activeDocType = prevDocType;
          self.selectedRecordId = prevRecId;
          self.activeLoadedDocData = prevLoaded;
        }
      };

      // أ) دالة التحويل الموحدة لأي مستند يمر عبر بوابة الطباعة (بدون لمس الكائن المجمد window.api)
      const transformLegacyPrintPayload = async function (payload = {}) {
        try {
          const rawHtml = String((payload && payload.html) || '');

          const isAlreadyV49 =
            rawHtml.includes('data-v49-adopted-master="1"') ||
            rawHtml.includes('v45-live-paper') ||
            rawHtml.includes('التقرير الجنائي') ||
            rawHtml.includes('تقرير رادار الرقابة') ||
            rawHtml.includes('استمارة حساب الضريبة') ||
            rawHtml.includes('Z-Report');

          if (isAlreadyV49) return payload;

          // فحص الفواتير الشكلية والطلبيات ووصولات الشراء
          if (rawHtml.includes('فاتورة شكلية') || rawHtml.includes('Proforma')) {
            const pfList = self.liveDataRecords.proformas || [];
            const latestPf = pfList[0];
            const html = await self.generateAdoptedHtmlForDocument('proforma', latestPf ? latestPf.id : 'SAMPLE');
            return { ...payload, html };
          }
          if (rawHtml.includes('طلبية زبون') || rawHtml.includes('Bon de Commande')) {
            const ordList = self.liveDataRecords.orders || [];
            const latestOrd = ordList[0];
            const html = await self.generateAdoptedHtmlForDocument('customer_order', latestOrd ? latestOrd.id : 'SAMPLE');
            return { ...payload, html };
          }
          if (rawHtml.includes('وصل استلام') || rawHtml.includes('Bon de Réception')) {
            const pList = self.liveDataRecords.purchases || [];
            const latestP = pList[0];
            const html = await self.generateAdoptedHtmlForDocument('purchase_invoice', latestP ? latestP.id : 'SAMPLE');
            return { ...payload, html };
          }

          // فحص تذاكر الكاشير وفواتير المبيعات القديمة
          const looksLikeLegacySaleReceiptOrInvoice =
            rawHtml.includes('المجموع خارج الرسوم') ||
            rawHtml.includes('قسيمة وفاء واستبدال') ||
            rawHtml.includes('N°:') ||
            rawHtml.includes('receipt_template') ||
            rawHtml.includes('invoice_template') ||
            rawHtml.includes('الإجمالي الصافي');

          if (looksLikeLegacySaleReceiptOrInvoice) {
            const isLegacyThermal =
              rawHtml.includes('80mm') ||
              rawHtml.includes('58mm') ||
              rawHtml.includes('قسيمة وفاء واستبدال') ||
              (payload && Number(payload.widthMm || 0) <= 85 && Number(payload.widthMm || 0) > 0);

            const targetDocType = isLegacyThermal ? 'receipt_thermal' : 'invoice_a4';

            let matchedSaleId = null;
            const numMatch = rawHtml.match(/N°\s*:\s*(?:FAC-\d+-)?0*(\d+)/i) || rawHtml.match(/#\s*(\d+)/);
            if (numMatch && numMatch[1]) {
              const candidateNum = Number(numMatch[1]);
              const salesList = self.liveDataRecords.sales || window.AppState?.sales || [];
              const foundSale = salesList.find(
                (s) =>
                  Number(s.id) === candidateNum ||
                  String(s.doc_number || '').endsWith(String(candidateNum))
              );
              matchedSaleId = foundSale ? foundSale.id : candidateNum;
            } else if (self.lastProcessedSaleResult && self.lastProcessedSaleResult.saleId) {
              matchedSaleId = self.lastProcessedSaleResult.saleId;
            } else if (window.App && window.App.currentPrintingSaleId) {
              matchedSaleId = window.App.currentPrintingSaleId;
            }

            const adoptedHtml = await self.generateAdoptedHtmlForDocument(
              targetDocType,
              matchedSaleId,
              !matchedSaleId ? self.lastProcessedSalePayload : null
            );

            if (adoptedHtml) {
              const defPaper = (self.config.defaultsByDocType[targetDocType] || {}).paperSize || (isLegacyThermal ? '80mm' : 'a4');
              return {
                ...payload,
                html: adoptedHtml,
                paperSize: defPaper,
                widthMm: defPaper === '80mm' ? 80 : defPaper === '58mm' ? 58 : undefined
              };
            }
          }
        } catch (err) {
          console.warn('[V50 Print Gatekeeper Fallback]:', err);
        }
        return payload;
      };

      const onSaleProcessedCallback = async function (salePayload, res) {
        self.lastProcessedSalePayload = salePayload;
        self.lastProcessedSaleResult = res;
        try {
          if (window.api?.getCustomers) self.liveDataRecords.customers = await window.api.getCustomers();
          if (window.api?.getSales) self.liveDataRecords.sales = await window.api.getSales();
        } catch (_) {}
      };

      // تسجيل الخطافات عبر الجسر الآمن GherbiPrintBridge في preload.js
      if (window.GherbiPrintBridge && typeof window.GherbiPrintBridge.registerHooks === 'function') {
        window.GherbiPrintBridge.registerHooks({
          onProcessSale: onSaleProcessedCallback,
          onPrintSilent: transformLegacyPrintPayload
        });
      }

      // اعتراض دوال الطباعة في الكائن القابل للتعديل window.App و window.PrintEngine مباشرةً أيضاً
      if (window.App && typeof window.App.submitSale === 'function' && !window.App._v50SubmitSaleHooked) {
        const origSubmitSale = window.App.submitSale.bind(window.App);
        window.App._v50SubmitSaleHooked = true;
        window.App.submitSale = async function (printMode, ...rest) {
          const res = await origSubmitSale(printMode, ...rest);
          return res;
        };
      }
    },

    // إثراء بيانات الفاتورة بنقاط الوفاء الحقيقية من قاعدة البيانات (سواء زبون وفي أو زبون عابر)
    enrichDocumentDataWithLoyaltyAndDebt(rawDoc) {
      const d = { ...rawDoc };
      const customers = this.liveDataRecords.customers || window.AppState?.customers || [];
      const pName = String(d.partyName || '').trim();
      const isWalkinName =
        !pName ||
        pName.includes('زبون عابر') ||
        pName.toLowerCase().includes('comptoir') ||
        pName === 'زبون';

      const matchedCustomer = customers.find(
        (c) =>
          (d.customerId && Number(c.id) === Number(d.customerId)) ||
          (pName && !isWalkinName && pName.includes(String(c.name || '').trim()) && String(c.name || '').trim().length > 2)
      );

      if (matchedCustomer) {
        d.isWalkinCustomer = false;
        d.partyName = matchedCustomer.name;
        d.partyPhone = matchedCustomer.phone || d.partyPhone || '-';
        d.loyaltyStatusLabel = '👑 زبون وفي مسجل (VIP)';
        d.loyaltyCardCode = matchedCustomer.loyalty_card || ('FID-' + String(matchedCustomer.id).padStart(5, '0'));
        const currPts = Math.max(0, Number(matchedCustomer.loyalty_points ?? matchedCustomer.points ?? 43));
        const earnedPts = d.loyaltyPointsEarned !== undefined ? Number(d.loyaltyPointsEarned) : Math.max(1, Math.floor(Number(d.total || 0) / 100));
        const redeemedPts = d.loyaltyPointsRedeemed !== undefined ? Number(d.loyaltyPointsRedeemed) : 0;
        const redeemedDzd = d.loyaltyDiscountDzd !== undefined ? Number(d.loyaltyDiscountDzd) : redeemedPts * 2;
        d.loyaltyPrevPoints = Math.max(0, currPts - earnedPts + redeemedPts);
        d.loyaltyEarnedPoints = earnedPts;
        d.loyaltyRedeemedPoints = redeemedPts;
        d.loyaltyRedeemedValueDzd = redeemedDzd;
        d.loyaltyNewBalancePoints = currPts;
        d.loyaltyNewBalanceDzdValue = Number((currPts * 2).toFixed(2));
        if (!d.previousBalance) {
          d.previousBalance = Math.max(0, Number(matchedCustomer.total_debt || 0) - Number(d.remainingDebt || 0));
        }
      } else if (d.isWalkinCustomer === true || (isWalkinName && this.loyaltySimMode === 'walkin')) {
        d.isWalkinCustomer = true;
        d.loyaltyStatusLabel = '🚶 زبون عابر (نقاطه: 0)';
        d.loyaltyCardCode = 'بدون بطاقة (0)';
        d.loyaltyPrevPoints = 0;
        d.loyaltyEarnedPoints = 0;
        d.loyaltyRedeemedPoints = 0;
        d.loyaltyRedeemedValueDzd = 0;
        d.loyaltyNewBalancePoints = 0;
        d.loyaltyNewBalanceDzdValue = 0;
        d.potentialPointsIfRegistered = Math.max(1, Math.floor(Number(d.total || 0) / 100));
      } else {
        d.isWalkinCustomer = false;
        d.loyaltyStatusLabel = d.loyaltyStatusLabel || '👑 زبون وفي مسجل (VIP)';
        d.loyaltyCardCode = d.loyaltyCardCode || 'FID-00003';
        d.loyaltyPrevPoints = d.loyaltyPrevPoints ?? 40;
        d.loyaltyEarnedPoints = d.loyaltyEarnedPoints ?? Math.max(3, Math.floor(Number(d.total || 340) / 100));
        d.loyaltyRedeemedPoints = d.loyaltyRedeemedPoints ?? 0;
        d.loyaltyRedeemedValueDzd = d.loyaltyRedeemedValueDzd ?? 0;
        d.loyaltyNewBalancePoints = d.loyaltyPrevPoints + d.loyaltyEarnedPoints - d.loyaltyRedeemedPoints;
        d.loyaltyNewBalanceDzdValue = Number((d.loyaltyNewBalancePoints * 2).toFixed(2));
      }

      const itemsQtySum = (d.items || []).reduce((s, it) => s + Number(it.qty || 1), 0);
      const itemsDiscSum = (d.items || []).reduce((s, it) => s + Number(it.discount || 0), 0);
      d.totalUnitsCount = Number(itemsQtySum.toFixed(2));
      d.totalCustomerSavingsDzd = Number(
        (itemsDiscSum + Number(d.discount || 0) + Number(d.loyaltyRedeemedValueDzd || 0)).toFixed(2)
      );
      d.cashierName = d.cashierName || 'المدير العام';
      d.receivedAmount = Math.max(Number(d.paidAmount || 0), Number(d.receivedAmount || d.paidAmount || 0));
      d.changeReturnedDzd = Math.max(0, Number((d.receivedAmount - Number(d.paidAmount || 0)).toFixed(2)));
      d.cumulativeTotalDebt = Number((Number(d.previousBalance || 0) + Number(d.remainingDebt || 0)).toFixed(2));

      return d;
    },

    // ========================================================================
    // 2. رسم الورقة التفاعلية الحية بالتخطيط الحراري المدمج الذكي (Smart Stacked Thermal Table)
    // ========================================================================
    buildLiveDocumentPaperHtml(docData, forPrintOutput = false, customOverrides = null) {
      const cfg = customOverrides ? { ...this.config, ...customOverrides } : this.config;
      const ct = cfg.customTexts || this.config.customTexts;
      const shop = this.getShopIdentity();
      const theme = VISUAL_THEMES.find((t) => t.id === cfg.themeId) || VISUAL_THEMES[0];
      const docMeta = MASTER_DOC_TYPES.find((d) => d.id === cfg.activeDocType) || MASTER_DOC_TYPES[0];
      const isThermal = cfg.paperSize === '80mm' || cfg.paperSize === '58mm';
      const isPreviewModal = Boolean(customOverrides && customOverrides.isPreviewModal);

      const docTitleText = cfg.customHeaderTitle || docMeta.cleanTitle || 'وصل مبيعات';

      const makeEdit = (fieldKey, itemIdx, itemField) => {
        if (forPrintOutput || isPreviewModal) return '';
        if (itemIdx !== undefined && itemIdx !== null) {
          return `contenteditable="true" spellcheck="false" oninput="window.GherbiPrintStudioV45.onPaperDirectInput(null, this.textContent, ${itemIdx}, '${itemField}')"`;
        }
        return `contenteditable="true" spellcheck="false" oninput="window.GherbiPrintStudioV45.onPaperDirectInput('${fieldKey}', this.textContent)"`;
      };

      const wrapLayer = (layerObj, innerHtml) => {
        if (!layerObj || !layerObj.visible) return '';
        if (forPrintOutput) return `<div style="margin-bottom:6px;width:100%;">${innerHtml}</div>`;

        if (isPreviewModal) {
          return `
            <div onclick="event.stopPropagation(); window.GherbiPrintStudioV45.jumpFromPreviewModalToEditLayer('${cfg.activeDocType}', '${cfg.paperSize}', '${cfg.themeId}', '${layerObj.id}')"
                 title="اضغط للانتقال إلى استوديو التعديل وتخصيص (${layerObj.name})"
                 class="v45-canvas-layer cursor-pointer" style="margin-bottom:8px;">
              <div class="v45-layer-handle-bar">
                <span>🎨 انقر لتعديل (${layerObj.name}) ⬅</span>
              </div>
              ${innerHtml}
            </div>
          `;
        }

        const isSel = this.selectedLayerId === layerObj.id;
        return `
          <div data-v47-layer-id="${layerObj.id}"
               onclick="window.GherbiPrintStudioV45.selectLayerDomOnly('${layerObj.id}')"
               class="v45-canvas-layer ${isSel ? 'layer-selected' : ''}" style="margin-bottom:8px;">
            <div class="v45-layer-handle-bar" contenteditable="false">
              <span style="overflow:hidden;text-overflow:ellipsis;">${layerObj.name}</span>
              <span style="display:inline-flex;gap:4px;shrink:0;">
                <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayer('${layerObj.id}', -1)" title="تحريك للأعلى">▲</button>
                <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayer('${layerObj.id}', 1)" title="تحريك للأسفل">▼</button>
                <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleLayerVisibility('${layerObj.id}')" title="إخفاء الطبقة">✕</button>
              </span>
            </div>
            ${innerHtml}
          </div>
        `;
      };

      const renderLayerById = (layer) => {
        // 1. ترويسة المتجر
        if (layer.id === 'header_layer') {
          if (isThermal) {
            return wrapLayer(
              layer,
              `<div style="text-align:center;border-bottom:1.5px dashed #0f172a;padding-bottom:5px;">
                ${shop.logo ? `<img src="${shop.logo}" style="max-height:40px;margin:0 auto 3px;display:block;">` : ''}
                <div ${makeEdit('shopName')} style="font-size:15.5px;font-weight:900;line-height:1.2;">${shop.name}</div>
                <div ${makeEdit('shopDesc')} style="font-size:10.5px;color:#334155;font-weight:700;margin-top:1px;">${shop.desc} — ${shop.address}</div>
                <div style="font-size:10.5px;font-weight:900;margin-top:2px;">
                  <span>هاتف: </span><span ${makeEdit('shopPhone')} style="font-family:monospace;direction:ltr;display:inline-block;">${shop.phone}</span>
                </div>
              </div>`
            );
          }
          return wrapLayer(
            layer,
            `<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${theme.primary};padding-bottom:10px;">
              <div style="flex:1;">
                <div ${makeEdit('shopName')} style="font-size:20px;font-weight:900;color:${theme.primary};">${shop.name}</div>
                <div ${makeEdit('shopDesc')} style="font-size:12px;font-weight:700;color:#475569;margin-top:2px;">${shop.desc}</div>
                <div ${makeEdit('shopAddress')} style="font-size:11px;color:#334155;margin-top:3px;">📍 العنوان: ${shop.address} | 📞 الهاتف: <span style="direction:ltr;display:inline-block;font-family:monospace;">${shop.phone}</span></div>
              </div>
              ${shop.logo ? `<img src="${shop.logo}" style="max-height:64px;max-width:120px;object-fit:contain;margin:0 12px;">` : ''}
              <div style="text-align:left;font-size:10px;font-family:monospace;background:${theme.accent};border:1px solid ${theme.border};padding:6px 10px;border-radius:8px;line-height:1.45;">
                <div ${makeEdit('shopRc')}><strong>RC:</strong> ${shop.rc}</div>
                <div ${makeEdit('shopNif')}><strong>NIF:</strong> ${shop.nif}</div>
                <div ${makeEdit('shopAi')}><strong>AI:</strong> ${shop.ai} | <strong>NIS:</strong> ${shop.nis}</div>
              </div>
            </div>`
          );
        }

        // 2. شريط عنوان ورقم المستند والباركود
        if (layer.id === 'doc_banner_layer') {
          const bcSvg = cfg.showDocBarcode ? generateCrispBarcodeSvg(docData.docNumber, isThermal ? 7 : 10, false) : '';
          if (isThermal) {
            return wrapLayer(
              layer,
              `<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:4px 6px;text-align:center;">
                <div ${makeEdit('customHeaderTitle')} style="font-size:12px;font-weight:900;color:#0f172a;">${docTitleText}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:800;color:#334155;margin-top:2px;">
                  <span dir="ltr" style="font-family:monospace;display:inline-block;"><strong>N°:</strong> <strong ${makeEdit('docField:docNumber')}>${docData.docNumber}</strong></span>
                  <span ${makeEdit('docField:date')} style="font-family:monospace;direction:ltr;display:inline-block;">${docData.date}</span>
                </div>
                ${bcSvg ? `<div style="width:120px;margin:3px auto 0;">${bcSvg}</div>` : ''}
              </div>`
            );
          }
          return wrapLayer(
            layer,
            `<div style="display:flex;justify-content:space-between;align-items:center;background:${theme.accent};border:1.5px solid ${theme.border};border-radius:10px;padding:8px 14px;">
              <div style="flex:1;">
                <div ${makeEdit('customHeaderTitle')} style="font-size:16px;font-weight:900;color:${theme.primary};">${docTitleText}</div>
                <div style="font-size:11px;font-weight:800;color:#334155;margin-top:2px;">
                  رقم المستند: <strong ${makeEdit('docField:docNumber')} style="font-family:monospace;">${docData.docNumber}</strong> | التاريخ: <strong ${makeEdit('docField:date')} style="font-family:monospace;">${docData.date}</strong>
                </div>
              </div>
              ${bcSvg ? `<div style="width:140px;margin-right:6px;">${bcSvg}</div>` : ''}
            </div>`
          );
        }

        // 3. بطاقة بيانات الزبون / المورد (إصلاح انقسام رقم الهاتف على سطرين)
        if (layer.id === 'customer_box_layer') {
          if (isThermal) {
            return wrapLayer(
              layer,
              `<div style="font-size:10.5px;border-bottom:1px dashed #64748b;padding-bottom:4px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:4px;">
                <div><strong ${makeEdit('docField:partyTitle')}>${docData.partyTitle}</strong> <span ${makeEdit('docField:partyName')} style="font-weight:900;">${docData.partyName}</span></div>
                ${docData.partyPhone && docData.partyPhone !== '-' ? `<div ${makeEdit('docField:partyPhone')} style="font-family:monospace;font-weight:800;direction:ltr;white-space:nowrap;">📞 ${docData.partyPhone}</div>` : ''}
              </div>`
            );
          }
          return wrapLayer(
            layer,
            `<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:10px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;font-size:11.5px;background:#f8fafc;">
              <div>
                <div><strong ${makeEdit('docField:partyTitle')}>${docData.partyTitle}</strong> <span ${makeEdit('docField:partyName')} style="font-size:13px;font-weight:900;color:#0f172a;">${docData.partyName}</span></div>
                <div ${makeEdit('docField:partyAddress')} style="color:#475569;margin-top:2px;">📍 العنوان: ${docData.partyAddress} | 📞 الهاتف: <span style="direction:ltr;display:inline-block;font-family:monospace;">${docData.partyPhone}</span></div>
              </div>
              <div style="text-align:left;font-family:monospace;font-size:10.5px;">
                <div ${makeEdit('docField:paymentMethod')}><strong>طريقة التسديد:</strong> ${docData.paymentMethod}</div>
                <div ${makeEdit('docField:partyRc')}><strong>RC:</strong> ${docData.partyRc} | <strong>NIF:</strong> ${docData.partyNif}</div>
              </div>
            </div>`
          );
        }

        // 4. جدول الأصناف الذكي (الحل الجذري لمشكلة تكدس الأعمدة في 80mm!)
        if (layer.id === 'items_table_layer') {
          const cols = cfg.columns;

          // أ) في التذكرة الحرارية (80mm / 58mm): نستخدم التخطيط المدمج الأنيق بحيث يأخذ اسم الصنف مساحته الكاملة ولا ينكسر عمودياً أبداً، وتظهر البيانات الإضافية المختارة كسطر فرعي نظيف تحت اسم الصنف!
          if (isThermal) {
            const thSt = `background:${theme.primary};color:#ffffff;padding:4px 3px;font-size:10px;font-weight:900;border:1px solid ${theme.primary};`;
            const tdSt = `padding:4px 3px;border-bottom:1px dashed #cbd5e1;font-size:10.5px;vertical-align:top;`;

            const thermalRows = (docData.items || [])
              .map((it, i) => {
                const subBadges = [];
                if (cols.barcode && it.barcode && it.barcode !== '-') {
                  subBadges.push(`<span ${makeEdit(null, i, 'barcode')} style="font-family:monospace;direction:ltr;display:inline-block;">[${it.barcode}]</span>`);
                }
                if (cols.unit && it.unit) {
                  subBadges.push(`<span ${makeEdit(null, i, 'unit')}>الوحدة: ${it.unit}</span>`);
                }
                if (cols.discount && Number(it.discount || 0) > 0) {
                  subBadges.push(`<span ${makeEdit(null, i, 'discount')} style="color:#be123c;">خصم: -${Number(it.discount).toFixed(2)}</span>`);
                }
                if (cols.tva && Number(it.tva || 0) > 0) {
                  subBadges.push(`<span>TVA: ${Number(it.tva)}%</span>`);
                }

                const subMetaHtml =
                  subBadges.length > 0
                    ? `<div style="font-size:8.5px;color:#475569;font-weight:700;margin-top:1.5px;display:flex;flex-wrap:wrap;gap:4px;">${subBadges.join(' • ')}</div>`
                    : '';

                return `
                  <tr>
                    <td style="${tdSt}text-align:right;width:52%;word-break:break-word;">
                      <div style="font-weight:900;line-height:1.25;color:#0f172a;">
                        ${cols.index ? `<span style="font-family:monospace;color:#475569;">${i + 1}. </span>` : ''}
                        <span ${makeEdit(null, i, 'name')}>${it.name}</span>
                      </div>
                      ${subMetaHtml}
                    </td>
                    ${cols.qty ? `<td ${makeEdit(null, i, 'qty')} style="${tdSt}text-align:center;font-family:monospace;font-weight:900;width:13%;">${it.qty}</td>` : ''}
                    ${cols.unitPrice ? `<td ${makeEdit(null, i, 'price')} style="${tdSt}text-align:center;font-family:monospace;width:17%;">${Number(it.price || 0).toFixed(2)}</td>` : ''}
                    ${cols.subtotal ? `<td ${makeEdit(null, i, 'subtotal')} style="${tdSt}text-align:left;font-family:monospace;font-weight:900;width:18%;">${Number(it.subtotal || 0).toFixed(2)}</td>` : ''}
                  </tr>
                `;
              })
              .join('');

            return wrapLayer(
              layer,
              `<table style="width:100%;table-layout:fixed;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th ${makeEdit('colName')} style="${thSt}text-align:right;width:50%;">${ct.colName || 'التعيين / الصنف'}</th>
                    ${cols.qty ? `<th ${makeEdit('colQty')} style="${thSt}text-align:center;width:15%;white-space:nowrap;">${ct.colQty || 'الكمية'}</th>` : ''}
                    ${cols.unitPrice ? `<th ${makeEdit('colPrice')} style="${thSt}text-align:center;width:17%;">${ct.colPrice || 'السعر'}</th>` : ''}
                    ${cols.subtotal ? `<th ${makeEdit('colSubtotal')} style="${thSt}text-align:left;width:18%;">${ct.colSubtotal || 'المجموع'}</th>` : ''}
                  </tr>
                </thead>
                <tbody>${thermalRows}</tbody>
              </table>`
            );
          }

          // ب) في الفواتير الورقية العريضة (A4 / A5 / 2xA5): تعرض كافة الأعمدة أفقياً بوضوح تام
          const thStyle = `background:${theme.primary};color:#ffffff;padding:7px 8px;font-size:11.5px;font-weight:900;border:1px solid ${theme.primary};text-align:right;`;
          const tdStyle = `padding:6px 8px;border:1px solid #cbd5e1;font-size:11.5px;`;

          const headers = [];
          if (cols.index) headers.push(`<th ${makeEdit('colIndex')} style="${thStyle}width:28px;text-align:center;">${ct.colIndex || '#'}</th>`);
          if (cols.barcode) headers.push(`<th ${makeEdit('colBarcode')} style="${thStyle}">${ct.colBarcode || 'الباركود'}</th>`);
          if (cols.name) headers.push(`<th ${makeEdit('colName')} style="${thStyle}">${ct.colName || 'التعيين / الصنف'}</th>`);
          if (cols.unit) headers.push(`<th ${makeEdit('colUnit')} style="${thStyle}text-align:center;">${ct.colUnit || 'الوحدة'}</th>`);
          if (cols.qty) headers.push(`<th ${makeEdit('colQty')} style="${thStyle}text-align:center;">${ct.colQty || 'الكمية'}</th>`);
          if (cols.unitPrice) headers.push(`<th ${makeEdit('colPrice')} style="${thStyle}">${ct.colPrice || 'سعر الوحدة'}</th>`);
          if (cols.discount) headers.push(`<th ${makeEdit('colDiscount')} style="${thStyle}">${ct.colDiscount || 'الخصم'}</th>`);
          if (cols.tva) headers.push(`<th ${makeEdit('colTva')} style="${thStyle}">${ct.colTva || 'TVA'}</th>`);
          if (cols.subtotal) headers.push(`<th ${makeEdit('colSubtotal')} style="${thStyle}text-align:left;">${ct.colSubtotal || 'المجموع'}</th>`);

          const rowsHtml = (docData.items || [])
            .map((it, i) => {
              const cells = [];
              if (cols.index) cells.push(`<td style="${tdStyle}text-align:center;font-family:monospace;">${i + 1}</td>`);
              if (cols.barcode) cells.push(`<td ${makeEdit(null, i, 'barcode')} style="${tdStyle}font-family:monospace;font-size:10px;">${it.barcode || '-'}</td>`);
              if (cols.name) cells.push(`<td ${makeEdit(null, i, 'name')} style="${tdStyle}font-weight:800;">${it.name}</td>`);
              if (cols.unit) cells.push(`<td ${makeEdit(null, i, 'unit')} style="${tdStyle}text-align:center;">${it.unit || 'قطعة'}</td>`);
              if (cols.qty) cells.push(`<td ${makeEdit(null, i, 'qty')} style="${tdStyle}text-align:center;font-family:monospace;font-weight:900;">${it.qty}</td>`);
              if (cols.unitPrice) cells.push(`<td ${makeEdit(null, i, 'price')} style="${tdStyle}font-family:monospace;">${Number(it.price || 0).toFixed(2)}</td>`);
              if (cols.discount) cells.push(`<td ${makeEdit(null, i, 'discount')} style="${tdStyle}font-family:monospace;">${Number(it.discount || 0).toFixed(2)}</td>`);
              if (cols.tva) cells.push(`<td style="${tdStyle}font-family:monospace;">${Number(it.tva || 0)}%</td>`);
              if (cols.subtotal) cells.push(`<td ${makeEdit(null, i, 'subtotal')} style="${tdStyle}text-align:left;font-family:monospace;font-weight:900;">${Number(it.subtotal || 0).toFixed(2)}</td>`);
              return `<tr style="background:${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">${cells.join('')}</tr>`;
            })
            .join('');

          return wrapLayer(
            layer,
            `<table style="width:100%;border-collapse:collapse;">
              <thead><tr>${headers.join('')}</tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>`
          );
        }

        // 5. شلال المجاميع بالدينار والسنتيم والتفقيط
        if (layer.id === 'totals_words_layer') {
          if (isThermal) {
            return wrapLayer(
              layer,
              `<div style="border-top:2px solid #000;padding-top:5px;font-size:11px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:13.5px;">
                  <span ${makeEdit('totalLabel')}>${ct.totalLabel || 'الإجمالي الصافي:'}</span>
                  <span id="v47LiveDocTotalVal" ${makeEdit('docField:total')} style="font-family:monospace;direction:ltr;">${this.fmtDzd(docData.total)}</span>
                </div>
                ${cfg.showCentimesEquivalent ? `<div id="v47LiveDocCentimesVal" style="text-align:left;font-size:10.5px;font-weight:900;color:#334155;margin-top:1px;">🇩🇿 بالسنتيم: ${this.fmtCentimes(docData.total)}</div>` : ''}
                ${cfg.showCustomerBalance ? `<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:800;margin-top:4px;border-top:1px dashed #94a3b8;padding-top:4px;"><span ${makeEdit('docField:paidAmount')}>المدفوع: ${this.fmtDzd(docData.paidAmount)}</span><span ${makeEdit('docField:remainingDebt')}>الباقي: ${this.fmtDzd(docData.remainingDebt)}</span></div>` : ''}
              </div>`
            );
          }

          return wrapLayer(
            layer,
            `<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:12px;align-items:stretch;">
              <div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                ${
                  cfg.showAmountInWords
                    ? `<div>
                        <div style="font-size:10.5px;font-weight:900;color:#475569;">أوقفت هذه الوثيقة على مبلغ قدره (بالحروف):</div>
                        <div id="v47LiveDocWordsVal" ${makeEdit('amountWords')} style="font-size:12px;font-weight:900;color:${theme.primary};margin-top:3px;">${this.amountToArabicWords(docData.total)}</div>
                      </div>`
                    : ''
                }
                ${
                  cfg.showCustomerBalance
                    ? `<div style="display:flex;gap:12px;border-top:1px dashed #cbd5e1;padding-top:6px;margin-top:6px;font-size:11px;font-weight:800;">
                        <span ${makeEdit('docField:paidAmount')}>المدفوع: <strong style="font-family:monospace;color:#047857;">${this.fmtDzd(docData.paidAmount)}</strong></span>
                        <span ${makeEdit('docField:remainingDebt')}>الباقي (دين): <strong style="font-family:monospace;color:#be123c;">${this.fmtDzd(docData.remainingDebt)}</strong></span>
                      </div>`
                    : ''
                }
              </div>

              <div style="border:2px solid ${theme.primary};border-radius:10px;padding:10px;background:${theme.accent};">
                <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:800;margin-bottom:4px;">
                  <span>المجموع الفرعي:</span>
                  <span style="font-family:monospace;">${this.fmtDzd(docData.subtotal)}</span>
                </div>
                ${
                  docData.discount > 0
                    ? `<div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:800;color:#be123c;margin-bottom:4px;">
                        <span>التخفيض الممنوح:</span>
                        <span style="font-family:monospace;">-${this.fmtDzd(docData.discount)}</span>
                      </div>`
                    : ''
                }
                <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;color:${theme.primary};border-top:1.5px solid ${theme.border};padding-top:6px;">
                  <span ${makeEdit('totalLabel')}>${ct.totalLabel || 'الإجمالي المستحق:'}</span>
                  <span id="v47LiveDocTotalVal" ${makeEdit('docField:total')} style="font-family:monospace;">${this.fmtDzd(docData.total)}</span>
                </div>
                ${
                  cfg.showCentimesEquivalent
                    ? `<div id="v47LiveDocCentimesVal" style="text-align:left;font-size:11px;font-weight:900;color:#b45309;margin-top:3px;">🇩🇿 بالسنتيم: ${this.fmtCentimes(docData.total)}</div>`
                    : ''
                }
              </div>
            </div>`
          );
        }

        // 6. 👑 بطاقة نقاط الوفاء والمخصوم من البطاقة
        if (layer.id === 'loyalty_points_layer') {
          if (docData.isWalkinCustomer) {
            return wrapLayer(
              layer,
              `<div style="border:1.5px dashed #64748b;border-radius:8px;padding:${isThermal ? '5px 6px' : '8px 12px'};background:#f8fafc;font-size:${isThermal ? '9.5px' : '11px'};">
                <div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;color:#0f172a;border-bottom:1px dotted #cbd5e1;padding-bottom:3px;margin-bottom:3px;">
                  <span ${makeEdit('loyaltyHeaderTitle')}>${ct.loyaltyHeaderTitle || '👑 برنامج الوفاء'}</span>
                  <span ${makeEdit('docField:loyaltyStatusLabel')} style="font-size:9px;background:#e2e8f0;padding:1px 5px;border-radius:99px;">🚶 زبون عابر (0 نقطة)</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-weight:800;color:#334155;">
                  <div ${makeEdit('walkinPts')}>• رصيد البطاقة: <strong style="font-family:monospace;">0 نقطة</strong></div>
                  <div ${makeEdit('walkinDed')}>• المخصوم: <strong style="font-family:monospace;">0 نقطة (0.00 د.ج)</strong></div>
                </div>
                <div ${makeEdit('walkinInviteNote')} style="margin-top:3px;font-size:${isThermal ? '9px' : '10.5px'};font-weight:900;color:#b45309;text-align:center;">
                  ${ct.walkinInviteNote || `💡 لو كنت مسجلاً في بطاقة الوفاء لربحت (+${docData.potentialPointsIfRegistered || 4} نقاط) من هذه التذكرة!`}
                </div>
              </div>`
            );
          }

          return wrapLayer(
            layer,
            `<div style="border:1.5px solid #f59e0b;border-radius:8px;padding:${isThermal ? '5px 6px' : '8px 12px'};background:#fffbeb;font-size:${isThermal ? '9.5px' : '11px'};">
              <div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;color:#92400e;border-bottom:1px dashed #fcd34d;padding-bottom:3px;margin-bottom:4px;">
                <span ${makeEdit('loyaltyHeaderTitle')}>${ct.loyaltyHeaderTitle || '👑 بطاقة الوفاء ومكافآت الزبون'}</span>
                <span ${makeEdit('docField:loyaltyCardCode')} style="font-family:monospace;font-size:9.5px;background:#fef3c7;border:1px solid #f59e0b;padding:0 5px;border-radius:99px;direction:ltr;">${docData.loyaltyCardCode || 'FID-00003'}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:3px 6px;font-weight:800;color:#1e293b;">
                <div ${makeEdit('docField:loyaltyPrevPoints')}>• الرصيد السابق: <strong style="font-family:monospace;">${docData.loyaltyPrevPoints} نقطة</strong></div>
                <div ${makeEdit('docField:loyaltyEarnedPoints')} style="color:#047857;">• المكتسب اليوم: <strong style="font-family:monospace;">+${docData.loyaltyEarnedPoints} نقطة</strong></div>
                <div ${makeEdit('docField:loyaltyRedeemedPoints')} style="color:#be123c;">• المخصوم: <strong style="font-family:monospace;">-${docData.loyaltyRedeemedPoints} ن (-${Number(docData.loyaltyRedeemedValueDzd || 0).toFixed(2)} د.ج)</strong></div>
                <div ${makeEdit('docField:loyaltyNewBalancePoints')} style="color:#1d4ed8;">• الرصيد الجديد: <strong style="font-family:monospace;">${docData.loyaltyNewBalancePoints} نقطة (${Number(docData.loyaltyNewBalanceDzdValue || docData.loyaltyNewBalancePoints * 2).toFixed(2)} د.ج)</strong></div>
              </div>
            </div>`
          );
        }

        if (layer.id === 'savings_promo_layer') {
          return wrapLayer(
            layer,
            `<div style="border:1.5px dashed #10b981;border-radius:8px;padding:5px 8px;background:#ecfdf5;display:flex;justify-content:space-between;align-items:center;font-size:${isThermal ? '9.5px' : '11px'};font-weight:900;color:#065f46;">
              <span ${makeEdit('savingsBannerText')}>🎉 توفيرك اليوم: <strong style="font-family:monospace;">${this.fmtDzd(docData.totalCustomerSavingsDzd || 25)}</strong></span>
              <span ${makeEdit('totalUnitsBannerText')} style="font-family:monospace;background:#d1fae5;padding:1px 6px;border-radius:99px;">📦 القطع: ${docData.totalUnitsCount || 3}</span>
            </div>`
          );
        }

        if (layer.id === 'debt_ledger_layer') {
          return wrapLayer(
            layer,
            `<div style="border:1.5px solid #cbd5e1;border-radius:8px;padding:${isThermal ? '5px 6px' : '8px 12px'};background:#f8fafc;font-size:${isThermal ? '9.5px' : '11px'};">
              <div ${makeEdit('debtHeaderLabel')} style="font-weight:900;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:4px;">
                ⚖️ كشف وضعية الحساب والديون للزبون
              </div>
              <div style="display:grid;grid-template-columns:repeat(${isThermal ? 2 : 4}, 1fr);gap:4px;font-weight:800;">
                <div ${makeEdit('debtPrev')}>الدين السابق: <strong style="font-family:monospace;">${this.fmtDzd(docData.previousBalance || 0)}</strong></div>
                <div ${makeEdit('debtCurr')}>الفاتورة: <strong style="font-family:monospace;">${this.fmtDzd(docData.total || 0)}</strong></div>
                <div ${makeEdit('debtPaid')} style="color:#047857;">المدفوع: <strong style="font-family:monospace;">${this.fmtDzd(docData.paidAmount || 0)}</strong></div>
                <div ${makeEdit('debtTotalRem')} style="color:#be123c;">إجمالي المتبقي: <strong style="font-family:monospace;">${this.fmtDzd(docData.cumulativeTotalDebt || 0)}</strong></div>
              </div>
            </div>`
          );
        }

        if (layer.id === 'payment_breakdown_layer') {
          return wrapLayer(
            layer,
            `<div style="border:1px dashed #64748b;border-radius:8px;padding:4px 8px;font-size:${isThermal ? '9.5px' : '11px'};display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px;font-weight:800;background:#ffffff;">
              <span ${makeEdit('payRecText')}>💵 المقبوض: <strong style="font-family:monospace;">${this.fmtDzd(docData.receivedAmount || docData.paidAmount)}</strong></span>
              <span ${makeEdit('payChangeText')}>🪙 الصرف (Rendu): <strong style="font-family:monospace;color:#047857;">${this.fmtDzd(docData.changeReturnedDzd || 0)}</strong></span>
              <span ${makeEdit('payCashierText')}>👤 البائع: <strong>${docData.cashierName || 'المدير العام'}</strong></span>
            </div>`
          );
        }

        if (layer.id === 'tax_ifu_breakdown_layer') {
          const htVal = Number((Number(docData.total || 0) / 1.19).toFixed(2));
          const tvaVal = Number((Number(docData.total || 0) - htVal).toFixed(2));
          return wrapLayer(
            layer,
            `<div style="border:1px solid #cbd5e1;border-radius:8px;padding:5px 8px;font-size:${isThermal ? '9px' : '10.5px'};background:#f8fafc;">
              <div ${makeEdit('taxTableTitle')} style="font-weight:900;margin-bottom:2px;color:#334155;">🇩🇿 التفصيل الجبائي (HT / TVA / Timbre):</div>
              <div style="display:flex;justify-content:space-between;font-family:monospace;font-weight:800;">
                <span ${makeEdit('taxHt')}>HT: ${htVal.toFixed(2)}</span>
                <span ${makeEdit('taxTva')}>TVA: ${tvaVal.toFixed(2)}</span>
                <span ${makeEdit('taxTimbre')}>Timbre: ${Number(docData.stampAmount || 0).toFixed(2)}</span>
              </div>
            </div>`
          );
        }

        if (layer.id === 'warranty_imei_layer') {
          return wrapLayer(
            layer,
            `<div style="border:1.5px solid #1d4ed8;border-radius:8px;padding:6px 8px;background:#eff6ff;font-size:${isThermal ? '9.5px' : '11px'};">
              <div ${makeEdit('warrantyTitle')} style="font-weight:900;color:#1d4ed8;margin-bottom:2px;">🛡️ شهادة الضمان والأرقام التسلسلية (S/N - IMEI)</div>
              <div ${makeEdit('warrantySerialLine')} style="font-family:monospace;font-weight:800;color:#0f172a;margin-bottom:2px;">• S/N: [انقر لكتابة رقم السيريال] — الضمان: 12 شهراً</div>
              <div ${makeEdit('warrantyNoteText')} style="font-size:9.5px;color:#334155;font-weight:700;">${ct.warrantyNoteText || 'الضمان يشمل عيوب التصنيع فقط.'}</div>
            </div>`
          );
        }

        if (layer.id === 'installments_schedule_layer') {
          const rem = Math.max(0, Number(docData.remainingDebt || docData.total || 3000));
          const mInst = Number((rem / 3).toFixed(2));
          return wrapLayer(
            layer,
            `<div style="border:1.5px solid #b45309;border-radius:8px;padding:6px 8px;background:#fffbeb;font-size:${isThermal ? '9.5px' : '11px'};">
              <div ${makeEdit('instTitle')} style="font-weight:900;color:#92400e;margin-bottom:3px;">🗓️ جدول أقساط البيع بالتقسيط</div>
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:4px;font-family:monospace;font-weight:800;text-align:center;">
                <div ${makeEdit('inst1')} style="border:1px solid #fcd34d;padding:2px;border-radius:4px;background:#fff;">قسط 1: ${mInst}</div>
                <div ${makeEdit('inst2')} style="border:1px solid #fcd34d;padding:2px;border-radius:4px;background:#fff;">قسط 2: ${mInst}</div>
                <div ${makeEdit('inst3')} style="border:1px solid #fcd34d;padding:2px;border-radius:4px;background:#fff;">قسط 3: ${mInst}</div>
              </div>
            </div>`
          );
        }

        if (layer.id === 'delivery_driver_layer') {
          return wrapLayer(
            layer,
            `<div style="border:1.5px solid #047857;border-radius:8px;padding:6px 8px;background:#ecfdf5;font-size:${isThermal ? '9.5px' : '11px'};">
              <div ${makeEdit('delivTitle')} style="font-weight:900;color:#047857;margin-bottom:2px;">🚚 بيانات الشحن والتوصيل واستلام البضاعة</div>
              <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px;font-weight:800;color:#0f172a;">
                <span ${makeEdit('delivDriver')}>• السائق: ...................</span>
                <span ${makeEdit('delivColis')}>• الطرود: ${docData.items ? docData.items.length : 1}</span>
                <span ${makeEdit('delivSign')}>• إمضاء المستلم: ...............</span>
              </div>
            </div>`
          );
        }

        if (layer.id === 'qr_social_wifi_layer') {
          return wrapLayer(
            layer,
            `<div style="border:1px dashed #6366f1;border-radius:8px;padding:5px 8px;background:#eef2ff;text-align:center;font-size:${isThermal ? '9.5px' : '11px'};font-weight:800;color:#312e81;">
              <div ${makeEdit('wifiSocialNote')}>${ct.wifiSocialNote || '📶 شبكة Wi-Fi الزبائن: Gherbi_Store_VIP'}</div>
            </div>`
          );
        }

        if (layer.id === 'footer_stamp_layer') {
          return wrapLayer(
            layer,
            `<div style="border-top:1.5px solid #cbd5e1;padding-top:6px;margin-top:4px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-size:${isThermal ? '9.5px' : '10.5px'};">
              <div style="flex:1;text-align:${isThermal ? 'center' : 'right'};">
                <div ${makeEdit('customFooterTerms')} style="font-weight:800;color:#334155;line-height:1.4;">${cfg.customFooterTerms}</div>
                ${
                  cfg.showBaridimobQr && shop.rip
                    ? `<div ${makeEdit('shopRip')} style="margin-top:3px;font-family:monospace;font-weight:800;color:${theme.primary};direction:ltr;">RIP: ${shop.rip}</div>`
                    : ''
                }
              </div>
              ${
                cfg.showStampSignature && !isThermal
                  ? `<div style="width:140px;height:60px;border:1.5px dashed #94a3b8;border-radius:10px;display:flex;align-items:flex-start;justify-content:center;padding-top:5px;font-weight:900;color:#64748b;">
                      <span ${makeEdit('stampLabel')}>${ct.stampLabel || 'الختم والإمضاء (Cachet)'}</span>
                    </div>`
                  : ''
              }
            </div>`
          );
        }

        return wrapLayer(
          layer,
          `<div ${makeEdit('layerNote:' + layer.id)} style="padding:6px 10px;border:1px solid ${theme.border};border-radius:8px;background:${theme.accent};font-size:11px;font-weight:800;">
            ${layer.customNote || 'انقر هنا لكتابة أي ملاحظة إضافية...'}
          </div>`
        );
      };

      const allLayersHtml = cfg.layers.map((l) => renderLayerById(l)).join('');
      const watermarkHtml = cfg.watermarkText
        ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;overflow:hidden;">
            <span style="font-size:52px;font-weight:900;color:rgba(15,23,42,0.05);transform:rotate(-28deg);white-space:nowrap;">${cfg.watermarkText}</span>
          </div>`
        : '';

      if (cfg.paperSize === '2xa5') {
        return `
          <div class="v45-live-paper paper-2xa5" style="font-family:'${cfg.fontFamily}',sans-serif;font-size:${cfg.baseFontSizePx}px;display:grid;grid-template-columns:1fr 1fr;gap:8mm;">
            <div style="border-left:1.5px dashed #94a3b8;padding-left:4mm;position:relative;">
              <div style="text-align:center;font-size:10px;font-weight:900;color:#64748b;margin-bottom:4px;">— نسخة الزبون (Exemplaire Client) —</div>
              ${watermarkHtml}
              <div style="position:relative;z-index:1;">${allLayersHtml}</div>
            </div>
            <div style="position:relative;">
              <div style="text-align:center;font-size:10px;font-weight:900;color:#64748b;margin-bottom:4px;">— نسخة الأرشيف والمتجر (Exemplaire Magasin) —</div>
              ${watermarkHtml}
              <div style="position:relative;z-index:1;">${allLayersHtml}</div>
            </div>
          </div>
        `;
      }

      return `
        <div class="v45-live-paper paper-${cfg.paperSize}" style="font-family:'${cfg.fontFamily}',sans-serif;font-size:${cfg.baseFontSizePx}px;transform:scale(${forPrintOutput ? 1 : cfg.zoomPct / 100});">
          ${watermarkHtml}
          <div style="position:relative;z-index:1;">
            ${allLayersHtml}
          </div>
        </div>
      `;
    },

    async switchLoyaltySimulationMode(mode) {
      this.loyaltySimMode = mode === 'walkin' ? 'walkin' : 'vip';
      this.activeLoadedDocData = null;
      this.setLayerVisibleQuiet('loyalty_points_layer', true);
      this.selectedLayerId = 'loyalty_points_layer';
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    onPaperDirectInput(fieldKey, newValue, itemIdx, itemField) {
      const cleanVal = String(newValue ?? '').trim();

      if (itemIdx !== undefined && itemIdx !== null && itemField) {
        if (this.activeLoadedDocData && Array.isArray(this.activeLoadedDocData.items) && this.activeLoadedDocData.items[itemIdx]) {
          const item = this.activeLoadedDocData.items[itemIdx];
          if (itemField === 'name' || itemField === 'unit' || itemField === 'barcode') {
            item[itemField] = cleanVal;
          } else {
            const num = parseFloat(cleanVal.replace(/[^\d.-]/g, '')) || 0;
            item[itemField] = num;
            if (itemField === 'qty' || itemField === 'price') {
              item.subtotal = Number((Number(item.qty || 1) * Number(item.price || 0)).toFixed(2));
            }
          }
          const newSub = this.activeLoadedDocData.items.reduce((s, x) => s + Number(x.subtotal || 0), 0);
          this.activeLoadedDocData.subtotal = Number(newSub.toFixed(2));
          this.activeLoadedDocData.total = Math.max(0, Number((newSub - Number(this.activeLoadedDocData.discount || 0)).toFixed(2)));
          this.updateLiveTotalsInDomWithoutReRender();
        }
        return;
      }

      if (fieldKey === 'customHeaderTitle') {
        this.config.customHeaderTitle = cleanVal;
      } else if (fieldKey === 'customFooterTerms') {
        this.config.customFooterTerms = cleanVal;
      } else if (fieldKey && fieldKey.startsWith('layerNote:')) {
        const lid = fieldKey.replace('layerNote:', '');
        const lObj = this.config.layers.find((x) => x.id === lid);
        if (lObj) lObj.customNote = cleanVal;
      } else if (fieldKey && fieldKey.startsWith('docField:')) {
        const df = fieldKey.replace('docField:', '');
        if (this.activeLoadedDocData) {
          this.activeLoadedDocData[df] = cleanVal;
        }
      } else if (fieldKey) {
        this.config.customTexts[fieldKey] = cleanVal;
        if (window.AppState && window.AppState.settings) {
          if (fieldKey === 'shopName') window.AppState.settings.shop_name = cleanVal;
          if (fieldKey === 'shopDesc') window.AppState.settings.shop_description = cleanVal;
          if (fieldKey === 'shopAddress') window.AppState.settings.shop_address = cleanVal;
          if (fieldKey === 'shopPhone') window.AppState.settings.shop_phone = cleanVal;
        }
      }

      this.saveConfigLocal();
    },

    updateLiveTotalsInDomWithoutReRender() {
      if (!this.activeLoadedDocData) return;
      const totEl = document.getElementById('v47LiveDocTotalVal');
      const centEl = document.getElementById('v47LiveDocCentimesVal');
      const wordsEl = document.getElementById('v47LiveDocWordsVal');
      if (totEl) totEl.textContent = this.fmtDzd(this.activeLoadedDocData.total);
      if (centEl) centEl.textContent = '🇩🇿 بالسنتيم: ' + this.fmtCentimes(this.activeLoadedDocData.total);
      if (wordsEl) wordsEl.textContent = this.amountToArabicWords(this.activeLoadedDocData.total);
    },

    async addRowToActiveTicket() {
      if (!this.activeLoadedDocData) {
        this.activeLoadedDocData = await this.resolveActiveDocumentData();
      }
      this.activeLoadedDocData.items.push({
        barcode: '613000999',
        name: 'صنف جديد (انقر لتعديل الاسم)',
        unit: 'قطعة',
        qty: 1,
        price: 100,
        discount: 0,
        tva: 0,
        subtotal: 100
      });
      const newSub = this.activeLoadedDocData.items.reduce((s, x) => s + Number(x.subtotal || 0), 0);
      this.activeLoadedDocData.subtotal = newSub;
      this.activeLoadedDocData.total = Math.max(0, newSub - Number(this.activeLoadedDocData.discount || 0));
      await this.renderStudioIntoRoot();
    },

    async removeLastRowFromActiveTicket() {
      if (!this.activeLoadedDocData || !Array.isArray(this.activeLoadedDocData.items) || this.activeLoadedDocData.items.length <= 1) return;
      this.activeLoadedDocData.items.pop();
      const newSub = this.activeLoadedDocData.items.reduce((s, x) => s + Number(x.subtotal || 0), 0);
      this.activeLoadedDocData.subtotal = newSub;
      this.activeLoadedDocData.total = Math.max(0, newSub - Number(this.activeLoadedDocData.discount || 0));
      await this.renderStudioIntoRoot();
    },

    execPaperTextCommand(cmd, val = null) {
      try { document.execCommand(cmd, false, val); } catch (_) {}
    },

    triggerLogoUploadFromStudio() {
      let fileInp = document.getElementById('v47HiddenLogoUploadInput');
      if (!fileInp) {
        fileInp = document.createElement('input');
        fileInp.id = 'v47HiddenLogoUploadInput';
        fileInp.type = 'file';
        fileInp.accept = 'image/*';
        fileInp.style.display = 'none';
        fileInp.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const dataUrl = ev.target.result;
            if (window.AppState && window.AppState.settings) {
              window.AppState.settings.shop_logo = dataUrl;
            }
            try {
              if (window.api?.updateSettings) await window.api.updateSettings({ shop_logo: dataUrl });
            } catch (_) {}
            await this.renderStudioIntoRoot();
          };
          reader.readAsDataURL(file);
        };
        document.body.appendChild(fileInp);
      }
      fileInp.click();
    },

    async refreshLiveCrossPageData() {
      try {
        if (window.api?.getSales) this.liveDataRecords.sales = (await window.api.getSales()) || [];
        if (window.api?.getPurchases) this.liveDataRecords.purchases = (await window.api.getPurchases()) || [];
        if (window.api?.getProformas) this.liveDataRecords.proformas = (await window.api.getProformas()) || [];
        if (window.api?.getOrders) this.liveDataRecords.orders = (await window.api.getOrders()) || [];
        if (window.api?.getCustomers) this.liveDataRecords.customers = (await window.api.getCustomers()) || [];
        if (window.api?.getSuppliers) this.liveDataRecords.suppliers = (await window.api.getSuppliers()) || [];
        if (window.api?.getProducts) {
          this.liveDataRecords.products = (await window.api.getProducts()) || [];
          if (!this.config.labelCfg.previewProductId && this.liveDataRecords.products.length > 0) {
            this.config.labelCfg.previewProductId = this.liveDataRecords.products[0].id;
          }
        }
        if (window.api?.getPrinters) {
          this.printersList = (await window.api.getPrinters()) || [];
        }
      } catch (_) {}
    },

    hookGlobalAppPrintMethods() {
      const self = this;
      window.GherbiPrintStudioV45 = this;

      for (const fn of ['renderPrintView', 'renderPrintStudio', 'renderPrintCenter', 'initPrintStudio', 'renderUnifiedPrintHub']) {
        window.App[fn] = async function () {
          await self.openAndRenderStudio();
        };
      }

      window.App.openDocumentInPrintStudio = async function (docType, recordId, targetLayerId) {
        self.activeSection = 'visual_studio';
        if (docType) {
          self.config.activeDocType = docType;
          self.loadProfileForDocType(docType);
        }
        if (recordId) {
          self.selectedRecordId = String(recordId);
          self.activeLoadedDocData = null;
        }
        if (targetLayerId) {
          self.selectedLayerId = targetLayerId;
        }
        self.saveConfigLocal();

        const viewPrint = document.getElementById('view-print');
        if (!viewPrint || !viewPrint.classList.contains('active')) {
          await window.App.switchView('print');
        }
        await self.renderStudioIntoRoot();
      };

      if (typeof window.App.switchView === 'function' && !window.App._v49SwitchPrintHooked) {
        const origSwitch = window.App.switchView.bind(window.App);
        window.App._v49SwitchPrintHooked = true;
        window.App.switchView = async function (viewName, ...rest) {
          const res = await origSwitch(viewName, ...rest);
          if (viewName === 'print') {
            await self.openAndRenderStudio();
          }
          return res;
        };
      }
    },

    injectCrossPageQuickStudioButtons() {
      setInterval(() => {
        const pcModal = document.getElementById('posPrintCenterModal');
        if (pcModal && !pcModal.querySelector('#v45JumpToFullStudioBtn')) {
          const header = pcModal.querySelector('.border-b');
          if (header) {
            const btn = document.createElement('button');
            btn.id = 'v45JumpToFullStudioBtn';
            btn.type = 'button';
            btn.className = 'px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow transition mr-auto ml-3 cursor-pointer';
            btn.innerHTML = '🎨 فتح وتعديل في استوديو الطباعة الشامل (Word/Photoshop)';
            btn.onclick = () => {
              window.App.closeModal('posPrintCenterModal');
              window.App.openDocumentInPrintStudio('invoice_a4', window.App.currentPrintingSaleId || 'SAMPLE');
            };
            header.insertBefore(btn, header.lastElementChild);
          }
        }
      }, 600);
    },

    async resolveActiveDocumentData(overrideDocType) {
      if (!overrideDocType && this.activeLoadedDocData) {
        return this.activeLoadedDocData;
      }

      const docType = overrideDocType || this.config.activeDocType;
      const recId = this.selectedRecordId;
      const isWalkinSim = this.loyaltySimMode === 'walkin';

      const fallbackData = this.enrichDocumentDataWithLoyaltyAndDebt({
        docNumber: 'FAC-2026-0076',
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        isWalkinCustomer: isWalkinSim,
        partyTitle: docType === 'purchase_invoice' ? 'المورد:' : 'الزبون:',
        partyName:
          docType === 'purchase_invoice'
            ? 'شركة التوزيع الغذائي الكبرى'
            : isWalkinSim
            ? 'زبون عابر (Comptoir)'
            : 'أمين بن يحيى (زبون وفي 👑)',
        partyPhone: isWalkinSim ? '-' : '0550 12 34 56',
        partyAddress: 'حي البدر، قسنطينة — الجزائر',
        partyRc: '21/00-4589210B19',
        partyNif: '002104589210045',
        paymentMethod: 'نقداً (Espèces)',
        previousBalance: isWalkinSim ? 0 : 1200,
        items: [
          { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي جوي (LINGHETTES ULTRA JOY)', unit: 'علبة', qty: 1, price: 70, discount: 0, tva: 19, subtotal: 70 },
          { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 (JOY PR BB 72)', unit: 'كيس', qty: 1, price: 145, discount: 0, tva: 19, subtotal: 145 },
          { barcode: '6130006000017', name: 'غولد لاين (GOLD LINE)', unit: 'قطعة', qty: 1, price: 125, discount: 0, tva: 19, subtotal: 125 }
        ],
        subtotal: 340,
        discount: 0,
        tvaAmount: 0,
        stampAmount: 0,
        total: 340,
        paidAmount: 340,
        receivedAmount: 400,
        remainingDebt: 0
      });

      if (!recId || recId === 'SAMPLE') {
        if (!overrideDocType) this.activeLoadedDocData = JSON.parse(JSON.stringify(fallbackData));
        return fallbackData;
      }

      try {
        if (['receipt_thermal', 'invoice_a4', 'invoice_a5', 'invoice_2xa5', 'delivery_note', 'credit_note', 'warranty_cert', 'installment_contract'].includes(docType)) {
          const det = window.api?.getSaleDetails ? await window.api.getSaleDetails(Number(recId)) : null;
          if (det) {
            const loaded = this.enrichDocumentDataWithLoyaltyAndDebt({
              docNumber: det.doc_number || ('#' + det.id),
              date: String(det.sale_date || det.created_at || '').replace('T', ' ').slice(0, 16),
              customerId: det.customer_id || null,
              partyTitle: 'الزبون:',
              partyName: det.customer_name || 'زبون عابر (Comptoir)',
              partyPhone: det.customer_phone || '-',
              partyAddress: det.customer_address || '-',
              partyRc: det.customer_rc || '-',
              partyNif: det.customer_nif || '-',
              paymentMethod: det.payment_method || 'نقداً',
              previousBalance: 0,
              items: (det.items || []).map((it) => ({
                barcode: it.product_barcode || '-',
                name: it.product_name || it.custom_product_name || 'منتج',
                unit: it.product_unit || 'قطعة',
                qty: Number(it.quantity || 1),
                price: Number(it.price || 0),
                discount: Number(it.discount || 0),
                tva: Number(det.tax_percentage || 0),
                subtotal: Number(it.subtotal || 0)
              })),
              subtotal: Number(det.subtotal || det.total || 0),
              discount: Number(det.discount || 0),
              tvaAmount: Number((Number(det.subtotal || 0) * Number(det.tax_percentage || 0)) / 100),
              stampAmount: Number(det.stamp_amount || 0),
              total: Number(det.total || 0),
              paidAmount: Number(det.paid_amount ?? det.total ?? 0),
              receivedAmount: Number(det.paid_amount ?? det.total ?? 0),
              remainingDebt: Math.max(0, Number(det.total || 0) - Number(det.paid_amount ?? det.total ?? 0))
            });
            if (!overrideDocType) this.activeLoadedDocData = loaded;
            return loaded;
          }
        }
      } catch (_) {}

      if (!overrideDocType) this.activeLoadedDocData = JSON.parse(JSON.stringify(fallbackData));
      return fallbackData;
    },

    selectLayerDomOnly(layerId) {
      this.selectedLayerId = layerId;
      const allCanvasLayers = document.querySelectorAll('.v45-canvas-layer');
      for (const el of allCanvasLayers) {
        if (el.getAttribute('data-v47-layer-id') === layerId) {
          el.classList.add('layer-selected');
        } else {
          el.classList.remove('layer-selected');
        }
      }
      const allSidebarItems = document.querySelectorAll('[data-v47-sidebar-layer-id]');
      for (const item of allSidebarItems) {
        if (item.getAttribute('data-v47-sidebar-layer-id') === layerId) {
          item.className = 'flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 font-black';
        } else {
          item.className = 'flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 font-bold';
        }
      }
    },

    async activateSuggestedLayerFromCatalog(layerId) {
      let layer = this.config.layers.find((l) => l.id === layerId);
      if (!layer) {
        const catMeta = SUGGESTED_LAYERS_CATALOG.find((c) => c.id === layerId);
        if (catMeta) {
          layer = { id: catMeta.id, name: catMeta.name, visible: true, align: 'between', customNote: '' };
          this.config.layers.push(layer);
        }
      } else {
        layer.visible = !layer.visible;
      }

      this.selectedLayerId = layerId;
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    setCatalogCategoryFilter(cat) {
      this.catalogCategoryFilter = cat || 'ALL';
      this.renderStudioIntoRoot();
    },

    async enableAllSuggestedLayers() {
      for (const l of this.config.layers) {
        l.visible = true;
      }
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    async openMultiSizePreviewModal(docId) {
      const meta = MASTER_DOC_TYPES.find((d) => d.id === docId) || MASTER_DOC_TYPES[1];
      const def = this.config.defaultsByDocType[docId] || {
        paperSize: meta.defaultPaper,
        themeId: 'royal_blue',
        lang: 'ar'
      };

      this.previewModalState = {
        isOpen: true,
        docId: meta.id,
        paperSize: def.paperSize || meta.defaultPaper,
        themeId: def.themeId || 'royal_blue'
      };

      let modal = document.getElementById('v46MultiSizePreviewModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'v46MultiSizePreviewModal';
        modal.style.zIndex = '29500';
        modal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4';
        document.body.appendChild(modal);
      }

      await this.renderMultiSizePreviewModalContent();
      modal.classList.remove('hidden');
    },

    async renderMultiSizePreviewModalContent() {
      const modal = document.getElementById('v46MultiSizePreviewModal');
      if (!modal) return;

      const st = this.previewModalState;
      const meta = MASTER_DOC_TYPES.find((d) => d.id === st.docId) || MASTER_DOC_TYPES[1];
      const sizeInfo = PAPER_SIZE_META[st.paperSize] || PAPER_SIZE_META.a4;
      const docData = await this.resolveActiveDocumentData(st.docId);

      const previewPaperHtml = this.buildLiveDocumentPaperHtml(docData, false, {
        activeDocType: st.docId,
        paperSize: st.paperSize,
        themeId: st.themeId,
        zoomPct: st.paperSize === '2xa5' ? 78 : 92,
        isPreviewModal: true
      });

      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-3xl max-w-6xl w-[96vw] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right" dir="rtl">
          <div class="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-lg shadow">👁️</div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-black">${meta.name} — معاينة المقاسات والتعديل المباشر</h3>
                  <span class="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-black text-xs">${sizeInfo.badge}</span>
                </div>
                <p class="text-xs text-slate-300 mt-0.5">
                  جرّب التبديل بين المقاسات الخمسة بالأسفل، أو <strong>انقر على أي قسم داخل الورقة</strong> للانتقال مباشرةً لتعديله في الاستوديو!
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" onclick="window.GherbiPrintStudioV45.jumpFromPreviewModalToEditLayer('${st.docId}', '${st.paperSize}', '${st.themeId}', 'header_layer')" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg cursor-pointer transition">
                🎨 افتح وعدّل هذا المقاس في الاستوديو الكامل ⬅
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.savePreviewSelectionAsDefault()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow cursor-pointer transition">
                ⭐ اعتماد (${sizeInfo.badge}) كمقاس افتراضي
              </button>
              <button type="button" onclick="document.getElementById('v46MultiSizePreviewModal').classList.add('hidden')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-white font-black text-xs cursor-pointer">
                ✕ إغلاق
              </button>
            </div>
          </div>

          <div class="p-3 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-black text-slate-700 dark:text-slate-200">📐 اختر المقاس لمعاينته فوراً:</span>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchPreviewModalSize('a4')" class="px-3.5 py-1.5 rounded-xl font-black transition cursor-pointer ${st.paperSize === 'a4' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300'}">📄 A4 رسمي</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchPreviewModalSize('a5')" class="px-3.5 py-1.5 rounded-xl font-black transition cursor-pointer ${st.paperSize === 'a5' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300'}">📑 A5 نصفي</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchPreviewModalSize('2xa5')" class="px-3.5 py-1.5 rounded-xl font-black transition cursor-pointer ${st.paperSize === '2xa5' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300'}">✂️ 2×A5 مزدوج</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchPreviewModalSize('80mm')" class="px-3.5 py-1.5 rounded-xl font-black transition cursor-pointer ${st.paperSize === '80mm' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300'}">🧾 80mm حراري</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchPreviewModalSize('58mm')" class="px-3.5 py-1.5 rounded-xl font-black transition cursor-pointer ${st.paperSize === '58mm' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300'}">🧾 58mm حراري</button>
            </div>

            <div class="flex items-center gap-2">
              <span class="font-black text-slate-700 dark:text-slate-200">🎨 اللون:</span>
              <select onchange="window.GherbiPrintStudioV45.switchPreviewModalTheme(this.value)" class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-black">
                ${VISUAL_THEMES.map((t) => `<option value="${t.id}" ${st.themeId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="v45-studio-workspace flex-1 overflow-y-auto">
            ${previewPaperHtml}
          </div>
        </div>
      `;
    },

    async switchPreviewModalSize(newSize) {
      this.previewModalState.paperSize = newSize;
      await this.renderMultiSizePreviewModalContent();
    },

    async switchPreviewModalTheme(newTheme) {
      this.previewModalState.themeId = newTheme;
      await this.renderMultiSizePreviewModalContent();
    },

    savePreviewSelectionAsDefault() {
      const st = this.previewModalState;
      this.setDocDefaultPaper(st.docId, st.paperSize);
      this.setDocDefaultTheme(st.docId, st.themeId);
      document.getElementById('v46MultiSizePreviewModal')?.classList.add('hidden');
      this.renderStudioIntoRoot();
      if (window.showToast) {
        window.showToast(`⭐ تم اعتماد مقاس (${st.paperSize.toUpperCase()}) كقالب افتراضي نشط لهذا المستند!`, 'success');
      }
    },

    async jumpFromPreviewModalToEditLayer(docId, paperSize, themeId, layerId) {
      document.getElementById('v46MultiSizePreviewModal')?.classList.add('hidden');
      this.setDocDefaultPaper(docId, paperSize);
      this.setDocDefaultTheme(docId, themeId);
      this.config.activeDocType = docId;
      this.loadProfileForDocType(docId);
      this.config.paperSize = paperSize;
      this.config.themeId = themeId;
      this.selectedLayerId = layerId || 'header_layer';
      this.activeSection = 'visual_studio';
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    async customizeCardInStudioNow(docId) {
      this.config.activeDocType = docId;
      this.loadProfileForDocType(docId);
      this.activeSection = 'visual_studio';
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    async openAndRenderStudio() {
      const viewPrint = document.getElementById('view-print');
      if (!viewPrint) return;

      let root = document.getElementById('print-view-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'print-view-root';
        viewPrint.appendChild(root);
      }

      await this.refreshLiveCrossPageData();
      await this.renderStudioIntoRoot(root);
    },

    async renderStudioIntoRoot(rootEl) {
      const targetRoot = rootEl || document.getElementById('print-view-root');
      if (!targetRoot) return;

      const docData = await this.resolveActiveDocumentData();
      const cfg = this.config;
      const activeDocMeta = MASTER_DOC_TYPES.find((d) => d.id === cfg.activeDocType) || MASTER_DOC_TYPES[0];

      // شريط القوالب المثالية الجاهزة للاعتماد الفوري بضغطة زر
      const idealPresetsBarHtml = `
        <div class="rounded-2xl bg-gradient-to-l from-indigo-950 via-slate-900 to-slate-900 text-white p-3.5 shadow-md border border-indigo-500/40 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs">⚡ قوالب مثالية جاهزة</span>
            <span class="text-xs font-bold text-slate-200">اختر قالباً مثالياً جاهزاً لاعتماده فوراً بدلاً من التصميم من الصفر:</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            ${IDEAL_READY_PRESETS.map(
              (pr) => `
              <button type="button" onclick="window.GherbiPrintStudioV45.applyIdealPresetNow('${pr.id}')" class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 text-white font-black text-[11px] border border-white/15 transition cursor-pointer">
                ${pr.label}
              </button>`
            ).join('')}
            <button type="button" onclick="window.GherbiPrintStudioV45.adoptAllIdealPresetsAcrossAllPages()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow transition cursor-pointer">
              🚀 اعتماد القوالب المثالية لكل الصفحات دفعة واحدة
            </button>
          </div>
        </div>
      `;

      let sectionBodyHtml = '';

      if (this.activeSection === 'visual_studio') {
        const paperHtml = this.buildLiveDocumentPaperHtml(docData, false);

        let recordsList = [];
        if (activeDocMeta.sourcePage === 'purchases') recordsList = this.liveDataRecords.purchases;
        else if (activeDocMeta.sourcePage === 'proformas') recordsList = this.liveDataRecords.proformas;
        else if (activeDocMeta.sourcePage === 'orders') recordsList = this.liveDataRecords.orders;
        else recordsList = this.liveDataRecords.sales;

        const recordOptionsHtml = [
          `<option value="SAMPLE" ${this.selectedRecordId === 'SAMPLE' ? 'selected' : ''}>✨ بيانات تذكرة نموذجية جاهزة للتعديل الحر</option>`,
          ...recordsList.slice(0, 50).map((r) => {
            const num = r.doc_number || r.invoice_number || ('#' + r.id);
            const party = r.customer_name || r.supplier_name || 'زبون عابر';
            const tot = Number(r.total || 0).toFixed(2);
            return `<option value="${r.id}" ${String(this.selectedRecordId) === String(r.id) ? 'selected' : ''}>📄 ${num} — ${party} (${tot} د.ج)</option>`;
          })
        ].join('');

        const filteredCatalog = SUGGESTED_LAYERS_CATALOG.filter(
          (c) => this.catalogCategoryFilter === 'ALL' || c.cat === this.catalogCategoryFilter
        );

        const suggestedCatalogHtml = filteredCatalog
          .map((catItem) => {
            const layerState = cfg.layers.find((l) => l.id === catItem.id);
            const isVis = Boolean(layerState && layerState.visible);
            return `
              <div class="p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
                isVis
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }">
                <div class="space-y-0.5">
                  <div class="font-black text-xs text-slate-900 dark:text-white">${catItem.name}</div>
                  <div class="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">${catItem.desc}</div>
                </div>
                <button type="button" onclick="window.GherbiPrintStudioV45.activateSuggestedLayerFromCatalog('${catItem.id}')" class="shrink-0 px-2.5 py-1.5 rounded-xl font-black text-[11px] transition cursor-pointer ${
                  isVis
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-rose-600'
                    : 'bg-blue-600 text-white shadow-sm hover:bg-blue-500'
                }">
                  ${isVis ? '✅ مفعّلة' : '➕ إضافة'}
                </button>
              </div>
            `;
          })
          .join('');

        sectionBodyHtml = `
          ${idealPresetsBarHtml}

          <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 shadow-sm space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <div class="flex flex-wrap items-center gap-2">
                <label class="text-xs font-black text-slate-600 dark:text-slate-300">📑 المستند:</label>
                <select onchange="window.GherbiPrintStudioV45.selectDocType(this.value)" class="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-300 font-black text-xs cursor-pointer">
                  ${MASTER_DOC_TYPES.map((d) => `<option value="${d.id}" ${cfg.activeDocType === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                </select>

                <select onchange="window.GherbiPrintStudioV45.selectLiveRecord(this.value)" class="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-xs max-w-xs cursor-pointer">
                  ${recordOptionsHtml}
                </select>

                <div class="inline-flex items-center rounded-xl bg-amber-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 p-0.5 text-[11px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.switchLoyaltySimulationMode('vip')" class="px-2.5 py-1 rounded-lg font-black transition cursor-pointer ${this.loyaltySimMode === 'vip' ? 'bg-amber-500 text-slate-950 shadow' : 'text-amber-800 dark:text-amber-300'}">
                    👑 معاينة زبون وفي (نقاط)
                  </button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.switchLoyaltySimulationMode('walkin')" class="px-2.5 py-1 rounded-lg font-black transition cursor-pointer ${this.loyaltySimMode === 'walkin' ? 'bg-slate-800 text-white shadow' : 'text-slate-600 dark:text-slate-300'}">
                    🚶 معاينة زبون عابر (0 نقطة)
                  </button>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.saveAsDefaultForDocType()" class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5">
                  <span>⭐ اعتماد وحفظ كأمر مطلق للطباعة (Par Défaut)</span>
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.printCurrentCanvasNow()" class="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition cursor-pointer">
                  🖨️ طباعة / PDF الآن
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-black text-slate-500 text-[11px]">📐 المقاس:</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('a4')" class="v45-word-ribbon-btn ${cfg.paperSize === 'a4' ? 'active' : ''}">A4 رسمي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('a5')" class="v45-word-ribbon-btn ${cfg.paperSize === 'a5' ? 'active' : ''}">A5 نصفي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('2xa5')" class="v45-word-ribbon-btn ${cfg.paperSize === '2xa5' ? 'active' : ''}">2×A5 مزدوج</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('80mm')" class="v45-word-ribbon-btn ${cfg.paperSize === '80mm' ? 'active' : ''}">80mm حراري</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('58mm')" class="v45-word-ribbon-btn ${cfg.paperSize === '58mm' ? 'active' : ''}">58mm حراري</button>

                <span class="mx-1 text-slate-300">|</span>
                <span class="font-black text-slate-500 text-[11px]">🎨 الثيم:</span>
                <select onchange="window.GherbiPrintStudioV45.updateCfg('themeId', this.value)" class="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs">
                  ${VISUAL_THEMES.map((t) => `<option value="${t.id}" ${cfg.themeId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>

                <span class="mx-1 text-slate-300">|</span>
                <span class="font-black text-slate-500 text-[11px]">🔤 الخط:</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.stepFontSize(-0.5)" class="v45-word-ribbon-btn">-A</button>
                <span class="font-mono font-black px-1">${cfg.baseFontSizePx}px</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.stepFontSize(0.5)" class="v45-word-ribbon-btn">+A</button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.addRowToActiveTicket()" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-sm cursor-pointer">
                  ➕ سطر جديد
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.removeLastRowFromActiveTicket()" class="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-black text-[11px] cursor-pointer">
                  ➖ حذف سطر
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.triggerLogoUploadFromStudio()" class="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-black text-[11px] cursor-pointer">
                  📷 الشعار
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showCentimesEquivalent')" class="v45-word-ribbon-btn ${cfg.showCentimesEquivalent ? 'active' : ''}">🇩🇿 السنتيم</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showCustomerBalance')" class="v45-word-ribbon-btn ${cfg.showCustomerBalance ? 'active' : ''}">⚖️ الباقي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showDocBarcode')" class="v45-word-ribbon-btn ${cfg.showDocBarcode ? 'active' : ''}">||| باركود</button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div class="lg:col-span-5 space-y-3.5 max-h-[78vh] overflow-y-auto pl-1">
              <div class="rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-400/60 dark:border-indigo-600/60 p-4 shadow-sm space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <div>
                    <h3 class="font-black text-xs text-indigo-900 dark:text-indigo-300">🧩 مكتبة الطبقات الذكية المقترحة (15 طبقة)</h3>
                    <p class="text-[10.5px] text-slate-500 mt-0.5">أضف أو أخفِ أي طبقة بضغطة زر (تعمل في 80mm و A4 معاً)</p>
                  </div>
                  <button type="button" onclick="window.GherbiPrintStudioV45.enableAllSuggestedLayers()" class="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-600 text-indigo-800 hover:text-white font-black text-[10.5px] transition cursor-pointer">
                    ✨ تفعيل الكل
                  </button>
                </div>

                <div class="flex flex-wrap items-center gap-1 text-[11px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('ALL')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${this.catalogCategoryFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">الكل (${SUGGESTED_LAYERS_CATALOG.length})</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('LOYALTY')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${this.catalogCategoryFilter === 'LOYALTY' ? 'bg-amber-500 text-slate-950' : 'bg-amber-50 dark:bg-slate-700 text-amber-800 dark:text-amber-300'}">👑 الوفاء والتوفير</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('FINANCE')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${this.catalogCategoryFilter === 'FINANCE' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-slate-700 text-emerald-800 dark:text-emerald-300'}">💰 الديون والدفع</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('LOGISTICS')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${this.catalogCategoryFilter === 'LOGISTICS' ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-blue-300'}">🚚 الضمان والتوصيل</button>
                </div>

                <div class="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  ${suggestedCatalogHtml}
                </div>
              </div>

              <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-2.5">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h3 class="font-black text-xs text-slate-900 dark:text-white">🗂️ ترتيب طبقات المستند (Photoshop Layers)</h3>
                  <button type="button" onclick="window.GherbiPrintStudioV45.addCustomLayerBlock()" class="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-[11px] hover:bg-blue-500 cursor-pointer">
                    + طبقة نصية حرة
                  </button>
                </div>

                <div class="space-y-1.5 max-h-56 overflow-y-auto">
                  ${cfg.layers
                    .map(
                      (l, idx) => `
                      <div data-v47-sidebar-layer-id="${l.id}" onclick="window.GherbiPrintStudioV45.selectLayerDomOnly('${l.id}')" class="flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                        this.selectedLayerId === l.id
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 font-black'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 font-bold'
                      }">
                        <div class="flex items-center gap-2 truncate">
                          <input type="checkbox" ${l.visible ? 'checked' : ''} onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleLayerVisibility('${l.id}')" class="w-4 h-4 accent-blue-600 rounded cursor-pointer">
                          <span class="truncate ${l.visible ? '' : 'line-through text-slate-400'}">${l.name}</span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayer('${l.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] hover:bg-blue-600 hover:text-white disabled:opacity-30">▲</button>
                          <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayer('${l.id}', 1)" ${idx === cfg.layers.length - 1 ? 'disabled' : ''} class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] hover:bg-blue-600 hover:text-white disabled:opacity-30">▼</button>
                          ${
                            l.id.startsWith('custom_')
                              ? `<button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.deleteCustomLayer('${l.id}')" class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 text-[10px] hover:bg-rose-600 hover:text-white">✕</button>`
                              : ''
                          }
                        </div>
                      </div>`
                    )
                    .join('')}
                </div>
              </div>

              <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-2.5 text-xs">
                <h3 class="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
                  📊 تخصيص أعمدة وبيانات جدول التذكرة / الفاتورة
                </h3>
                <p class="text-[10.5px] text-slate-500">في مقاس 80mm تظهر البيانات الإضافية (الباركود والوحدة والخصم) بشكل أنيق تحت اسم الصنف حتى لا ينضغط الجدول!</p>
                <div class="grid grid-cols-2 gap-2 font-bold">
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.index ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('index')" class="accent-blue-600"> <span>رقم السطر (#)</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.barcode ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('barcode')" class="accent-blue-600"> <span>الباركود</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.name ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('name')" class="accent-blue-600"> <span>اسم الصنف</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.unit ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('unit')" class="accent-blue-600"> <span>الوحدة</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.qty ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('qty')" class="accent-blue-600"> <span>الكمية</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.unitPrice ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('unitPrice')" class="accent-blue-600"> <span>سعر الوحدة</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.discount ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('discount')" class="accent-blue-600"> <span>الخصم</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.tva ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('tva')" class="accent-blue-600"> <span>ضريبة TVA</span></label>
                </div>
              </div>
            </div>

            <div class="lg:col-span-7">
              <div class="v45-studio-workspace max-h-[78vh]">
                <div id="v45LivePaperHost">
                  ${paperHtml}
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (this.activeSection === 'cross_page_bridge') {
        const cat = this.bridgeCategory;
        const q = this.bridgeSearch.trim().toLowerCase();
        let list = this.liveDataRecords[cat] || [];
        if (q) {
          list = list.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
        }

        const rowsHtml =
          list.length > 0
            ? list
                .slice(0, 50)
                .map((r) => {
                  const num = r.doc_number || r.invoice_number || ('#' + r.id);
                  const dt = String(r.sale_date || r.date || r.created_at || '').replace('T', ' ').slice(0, 16);
                  const party = r.customer_name || r.supplier_name || r.name || 'زبون عابر';
                  const tot = Number(r.total ?? r.total_debt ?? r.selling_price ?? 0);
                  const targetDocType =
                    cat === 'purchases'
                      ? 'purchase_invoice'
                      : cat === 'proformas'
                      ? 'proforma'
                      : cat === 'orders'
                      ? 'customer_order'
                      : 'invoice_a4';

                  return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-slate-800/50 text-xs">
                      <td class="py-3 px-3 font-mono font-black text-blue-600">${num}</td>
                      <td class="py-3 px-3 font-mono text-slate-500">${dt}</td>
                      <td class="py-3 px-3 font-black text-slate-900 dark:text-white">${party}</td>
                      <td class="py-3 px-3 font-mono font-black text-emerald-600">${this.fmtDzd(tot)}</td>
                      <td class="py-3 px-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                          <button type="button" onclick="window.App.openDocumentInPrintStudio('${targetDocType}', '${r.id}')" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] shadow-sm cursor-pointer">
                            🎨 فتح وتعديل الفاتورة (A4/A5)
                          </button>
                          <button type="button" onclick="window.App.openDocumentInPrintStudio('receipt_thermal', '${r.id}')" class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] cursor-pointer">
                            🧾 فتح كتذكرة كاشير (80mm)
                          </button>
                          <button type="button" onclick="window.App.openDocumentInPrintStudio('delivery_note', '${r.id}')" class="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] cursor-pointer">
                            🚚 وصل BL
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')
            : `<tr><td colspan="5" class="py-10 text-center text-slate-400 font-bold">لا توجد سجلات مطابقة في هذا القسم حالياً.</td></tr>`;

        sectionBodyHtml = `
          <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">🔗 جسر الربط الحي مع جميع صفحات البرنامج</h3>
                <p class="text-xs text-slate-500">اختر أي فاتورة أو تذكرة من أقسام البرنامج بالأسفل لفتحها وتعديل أي كلمة أو رقم بداخلها ثم طباعتها فوراً</p>
              </div>
              <input type="text" value="${this.bridgeSearch}" oninput="window.GherbiPrintStudioV45.setBridgeSearch(this.value)" placeholder="🔎 ابحث برقم الفاتورة أو اسم الزبون أو المورد..." class="w-72 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold">
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" onclick="window.GherbiPrintStudioV45.setBridgeCategory('sales')" class="px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${cat === 'sales' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                🧾 فواتير المبيعات والضمان (${this.liveDataRecords.sales.length})
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setBridgeCategory('purchases')" class="px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${cat === 'purchases' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                🛍️ فواتير المشتريات والتموين (${this.liveDataRecords.purchases.length})
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setBridgeCategory('proformas')" class="px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${cat === 'proformas' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                📋 الفواتير الشكلية (${this.liveDataRecords.proformas.length})
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setBridgeCategory('orders')" class="px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${cat === 'orders' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                📦 طلبيات الزبائن (${this.liveDataRecords.orders.length})
              </button>
            </div>

            <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 max-h-[480px]">
              <table class="w-full text-right border-collapse">
                <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black border-b border-slate-200">
                  <tr>
                    <th class="py-3 px-3">رقم المستند</th>
                    <th class="py-3 px-3">التاريخ والتوقيت</th>
                    <th class="py-3 px-3">الطرف (الزبون / المورد)</th>
                    <th class="py-3 px-3">المبلغ الإجمالي</th>
                    <th class="py-3 px-3 text-center">إجراءات الفتح والتعديل والطباعة</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>
        `;
      } else if (this.activeSection === 'barcode_shelf_factory') {
        const lCfg = cfg.labelCfg;
        const products = this.liveDataRecords.products || [];
        const previewProd =
          products.find((p) => Number(p.id) === Number(lCfg.previewProductId)) ||
          products[0] || { id: 1, name: 'غولد لاين (GOLD LINE)', barcode: '6134843000591', selling_price: 125 };

        const labelPreviewHtml = this.buildSingleLabelOrShelfTagHtml(previewProd, lCfg);
        const totalStickersInQueue = this.labelQueue.reduce((s, q) => s + Number(q.copies || 1), 0);

        const queueRowsHtml =
          this.labelQueue.length > 0
            ? this.labelQueue
                .map(
                  (item, idx) => `
                  <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
                    <td class="py-2 px-3 font-black">${item.name}</td>
                    <td class="py-2 px-3 font-mono text-slate-500">${item.barcode}</td>
                    <td class="py-2 px-3 font-mono font-black text-blue-600">${this.fmtDzd(item.price)}</td>
                    <td class="py-2 px-3">
                      <input type="number" min="1" max="500" value="${item.copies}" onchange="window.GherbiPrintStudioV45.updateQueueItemCopies(${idx}, this.value)" class="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 font-mono font-black text-center">
                    </td>
                    <td class="py-2 px-3 text-center">
                      <button type="button" onclick="window.GherbiPrintStudioV45.removeQueueItem(${idx})" class="px-2 py-1 rounded-lg bg-rose-100 text-rose-600 font-black">✕</button>
                    </td>
                  </tr>`
                )
                .join('')
            : `<tr><td colspan="5" class="py-6 text-center text-slate-400 font-bold">الطابور فارغ — أضف منتجات من الأعلى أو استورد فاتورة شراء كاملة.</td></tr>`;

        sectionBodyHtml = `
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div class="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 text-xs">
              <h3 class="text-base font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">🏷️ مصنع ملصقات الباركود وبطاقات أسعار الرفوف</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block font-black mb-1">📐 قالب ومقاس الملصق:</label>
                  <select onchange="window.GherbiPrintStudioV45.selectLabelPreset(this.value)" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-black">
                    ${LABEL_PRESETS.map((lp) => `<option value="${lp.id}" ${lCfg.presetId === lp.id ? 'selected' : ''}>${lp.name}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="block font-black mb-1">📦 اختر منتجاً:</label>
                  <div class="flex gap-1.5">
                    <select onchange="window.GherbiPrintStudioV45.selectPreviewProduct(this.value)" class="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold">
                      ${products.slice(0, 200).map((p) => `<option value="${p.id}" ${Number(lCfg.previewProductId) === Number(p.id) ? 'selected' : ''}>${p.name} (${p.selling_price} د.ج)</option>`).join('')}
                    </select>
                    <button type="button" onclick="window.GherbiPrintStudioV45.addCurrentPreviewProductToQueue()" class="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-black whitespace-nowrap">+ أضف</button>
                  </div>
                </div>
              </div>
              <div class="overflow-x-auto max-h-56 rounded-xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-right border-collapse">
                  <thead class="bg-slate-100 dark:bg-slate-800 text-[11px] font-black">
                    <tr><th class="py-2 px-3">الصنف</th><th class="py-2 px-3">الباركود</th><th class="py-2 px-3">السعر</th><th class="py-2 px-3">العدد</th><th class="py-2 px-3">حذف</th></tr>
                  </thead>
                  <tbody>${queueRowsHtml}</tbody>
                </table>
              </div>
            </div>

            <div class="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div class="v45-studio-workspace min-h-[220px] items-center">${labelPreviewHtml}</div>
              <div class="grid grid-cols-1 gap-2.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.printSinglePreviewLabelNow()" class="w-full py-3 rounded-2xl bg-blue-600 text-white font-black text-xs shadow-md cursor-pointer">🖨️ طباعة الملصق المعاين</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.printAllQueuedLabelsSheet()" class="w-full py-3 rounded-2xl bg-slate-900 text-amber-400 font-black text-xs shadow-md cursor-pointer">🚀 طباعة الطابور بالكامل (${totalStickersInQueue} ملصق)</button>
              </div>
            </div>
          </div>
        `;
      } else if (this.activeSection === 'free_word_editor') {
        const fd = this.freeDoc;
        const shop = this.getShopIdentity();
        const freeTotal = fd.items.reduce((s, it) => s + Number(it.qty || 1) * Number(it.price || 0), 0);

        sectionBodyHtml = `
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div class="lg:col-span-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3 text-xs">
              <h3 class="text-sm font-black text-slate-900 dark:text-white border-b pb-2">📝 منشئ البونات والوثائق الحرة (Word)</h3>
              <div><label class="block font-bold mb-1">عنوان الوثيقة:</label><input type="text" value="${fd.title}" oninput="window.GherbiPrintStudioV45.updateFreeDoc('title', this.value)" class="w-full px-3 py-2 rounded-xl border font-black"></div>
              <div><label class="block font-bold mb-1">الطرف المعني:</label><input type="text" value="${fd.recipient}" oninput="window.GherbiPrintStudioV45.updateFreeDoc('recipient', this.value)" class="w-full px-3 py-2 rounded-xl border font-bold"></div>
              <button type="button" onclick="window.GherbiPrintStudioV45.printFreeWordDocumentNow()" class="w-full py-3 rounded-2xl bg-blue-600 text-white font-black text-xs shadow-lg cursor-pointer">🖨️ طباعة الوثيقة الحرة الآن</button>
            </div>
            <div class="lg:col-span-8">
              <div class="v45-studio-workspace max-h-[75vh]">
                <div id="v45FreeWordPaperHost" class="v45-live-paper paper-a4" contenteditable="true" spellcheck="false">
                  <h2 style="text-align:center;color:#1d4ed8;">${shop.name} — ${fd.title}</h2>
                  <p><strong>${fd.recipient}</strong> | التاريخ: ${fd.date}</p>
                  <p>${fd.introText}</p>
                  <p><strong>الإجمالي: ${this.fmtDzd(freeTotal)}</strong></p>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        const cardsHtml = MASTER_DOC_TYPES.map((doc) => {
          const def = cfg.defaultsByDocType[doc.id] || {
            paperSize: doc.defaultPaper,
            themeId: 'royal_blue',
            lang: 'ar',
            adopted: true
          };
          const sizeMeta = PAPER_SIZE_META[def.paperSize] || PAPER_SIZE_META.a4;
          const themeObj = VISUAL_THEMES.find((t) => t.id === def.themeId) || VISUAL_THEMES[0];

          return `
            <div class="rounded-2xl p-4 bg-white dark:bg-slate-900/80 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition shadow-sm flex flex-col justify-between space-y-3 text-xs">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="font-black text-slate-900 dark:text-white text-sm leading-snug">${doc.name}</div>
                  <button type="button" onclick="window.App.switchView('${doc.sourcePage}')" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-flex items-center gap-1 cursor-pointer">
                    <span>🔗 مربوط مع: ${doc.sourceLabel} ⬅</span>
                  </button>
                </div>
                <div onclick="window.GherbiPrintStudioV45.openMultiSizePreviewModal('${doc.id}')" class="cursor-pointer shrink-0 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border">
                  <div style="width:${sizeMeta.aspectW}px;height:${sizeMeta.aspectH}px;background:#ffffff;border:2px solid ${themeObj.primary};border-radius:3px;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:8.5px;font-weight:900;color:${themeObj.primary};">
                    ${sizeMeta.badge}
                  </div>
                </div>
              </div>

              <div class="px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 text-[10.5px] font-black text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>✅ أمر مطلق معتمد للطباعة</span>
                <span class="font-mono">${sizeMeta.badge}</span>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <select onchange="window.GherbiPrintStudioV45.setDocDefaultPaper('${doc.id}', this.value)" class="w-full px-2 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-800 font-black text-xs cursor-pointer">
                  <option value="a4" ${def.paperSize === 'a4' ? 'selected' : ''}>📄 A4</option>
                  <option value="a5" ${def.paperSize === 'a5' ? 'selected' : ''}>📑 A5</option>
                  <option value="2xa5" ${def.paperSize === '2xa5' ? 'selected' : ''}>✂️ 2×A5</option>
                  <option value="80mm" ${def.paperSize === '80mm' ? 'selected' : ''}>🧾 80mm</option>
                  <option value="58mm" ${def.paperSize === '58mm' ? 'selected' : ''}>🧾 58mm</option>
                </select>
                <select onchange="window.GherbiPrintStudioV45.setDocDefaultTheme('${doc.id}', this.value)" class="w-full px-2 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-800 font-bold text-xs cursor-pointer">
                  ${VISUAL_THEMES.map((t) => `<option value="${t.id}" ${def.themeId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onclick="window.GherbiPrintStudioV45.openMultiSizePreviewModal('${doc.id}')" class="py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-800 hover:text-slate-950 border border-amber-400/40 font-black text-xs transition cursor-pointer">👁️ معاينة</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.customizeCardInStudioNow('${doc.id}')" class="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm transition cursor-pointer">🎨 تخصيص</button>
              </div>
            </div>
          `;
        }).join('');

        sectionBodyHtml = `
          ${idealPresetsBarHtml}
          <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white"><span id="v63CockpitTitleAnchor">⚙️ قمرة القوالب الافتراضية المعتمدة لكل صفحات البرنامج</span> (Par Défaut)</h3>
                <p class="text-xs text-slate-500">أي قالب تعتمده هنا يصبح أمراً مطلقاً في الكاشير وجميع الصفحات المرتبطة به</p>
              </div>
              <button type="button" onclick="window.GherbiPrintStudioV45.adoptAllIdealPresetsAcrossAllPages()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow cursor-pointer">
                🚀 اعتماد القوالب المثالية لكل الـ 28 مستنداً دفعة واحدة
              </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">${cardsHtml}</div>
          </div>
        `;
      }

      targetRoot.innerHTML = `
        <div id="v45MasterPrintStudio" data-gherbi-print-v2="1" class="space-y-4 text-right pb-8" dir="rtl">
          <div class="rounded-3xl bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 text-white p-5 shadow-xl border border-blue-500/30">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                  <span class="material-symbols-rounded" style="font-size:28px;">print</span>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-black text-[11px]">
                      Gherbi.Ai Omni-Print V49 — اعتماد مطلق ومعاينة ذكية
                    </span>
                    <h1 class="text-lg md:text-xl font-black">
                      مركز الطباعة الشامل واستوديو الفواتير والتذاكر الافتراضية لكل الصفحات
                    </h1>
                  </div>
                  <p class="text-xs text-slate-300 mt-0.5">
                    معاينة حرارية 80mm و A4 متناسقة 100% بدون انكسار الكلمات، مع فرض القالب المعتمد تلقائياً في شاشة المبيعات وكل الصفحات
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('visual_studio')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'visual_studio' ? 'bg-blue-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">🎨 1. استوديو الفواتير والطبقات</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('cross_page_bridge')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'cross_page_bridge' ? 'bg-blue-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">🔗 2. فواتير الصفحات (${this.liveDataRecords.sales.length + this.liveDataRecords.purchases.length})</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('barcode_shelf_factory')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'barcode_shelf_factory' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">🏷️ 3. الباركود والرفوف</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('free_word_editor')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'free_word_editor' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">📝 4. محرر البونات (Word)</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('hardware_defaults')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'hardware_defaults' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">⚙️ 5. القوالب الافتراضية (Par Défaut)</button>
              </div>
            </div>
          </div>

          <div>${sectionBodyHtml}</div>
        </div>
      `;
    },

    async switchSection(sec) {
      this.activeSection = sec || 'visual_studio';
      await this.renderStudioIntoRoot();
    },

    async selectDocType(docId) {
      this.config.activeDocType = docId;
      this.loadProfileForDocType(docId);
      this.selectedRecordId = 'SAMPLE';
      this.activeLoadedDocData = null;
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    async selectLiveRecord(recId) {
      this.selectedRecordId = recId || 'SAMPLE';
      this.activeLoadedDocData = null;
      await this.renderStudioIntoRoot();
    },

    async setPaperSize(pSize) {
      this.config.paperSize = pSize;
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    async updateCfg(key, val) {
      this.config[key] = val;
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    async stepFontSize(delta) {
      this.config.baseFontSizePx = Math.max(9, Math.min(18, Number((Number(this.config.baseFontSizePx || 11.5) + delta).toFixed(1))));
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    async toggleCfgBool(key) {
      this.config[key] = !this.config[key];
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    async toggleColumn(colKey) {
      this.config.columns[colKey] = !this.config.columns[colKey];
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
    },

    selectLayer(layerId) {
      this.selectLayerDomOnly(layerId);
    },

    toggleLayerVisibility(layerId) {
      const layer = this.config.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.visible = !layer.visible;
        this.saveConfigLocal();
        this.renderStudioIntoRoot();
      }
    },

    moveLayer(layerId, dir) {
      const idx = this.config.layers.findIndex((l) => l.id === layerId);
      if (idx < 0) return;
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= this.config.layers.length) return;
      const temp = this.config.layers[idx];
      this.config.layers[idx] = this.config.layers[targetIdx];
      this.config.layers[targetIdx] = temp;
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    },

    addCustomLayerBlock() {
      const newId = 'custom_' + Date.now();
      this.config.layers.push({
        id: newId,
        name: '📌 طبقة نصية / ملاحظة مخصصة',
        visible: true,
        align: 'center',
        customNote: 'انقر هنا لكتابة أي نص أو ملاحظة إضافية مباشرة على التذكرة...'
      });
      this.selectedLayerId = newId;
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    },

    deleteCustomLayer(layerId) {
      this.config.layers = this.config.layers.filter((l) => l.id !== layerId);
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    },

    async saveAsDefaultForDocType() {
      const dt = this.config.activeDocType;
      this.config.defaultsByDocType[dt] = {
        paperSize: this.config.paperSize,
        themeId: this.config.themeId,
        lang: this.config.lang,
        adopted: true
      };
      this.saveConfigLocal();

      try {
        if (window.api?.updateSettings) {
          const settingsPatch = {
            ['adopted_print_profile_' + dt]: JSON.stringify(this.config.adoptedProfiles[dt] || {})
          };
          if (dt === 'receipt_thermal') {
            settingsPatch.receipt_paper_width_mm = this.config.paperSize === '58mm' ? '58' : '80';
          }
          await window.api.updateSettings(settingsPatch);
        }
        if (window.api?.saveCustomTemplate) {
          await window.api.saveCustomTemplate({
            name: `القالب المعتمد — ${dt} (${this.config.paperSize})`,
            doc_type: dt,
            paper: this.config.paperSize,
            lang: this.config.lang,
            layout_json: JSON.stringify(this.config.adoptedProfiles[dt] || this.config),
            is_default: 1
          });
        }
      } catch (_) {}

      await this.renderStudioIntoRoot();
      if (window.showToast) {
        window.showToast('✅ تم اعتماد هذا التصميم كأمر مطلق! ستُطبع كل التذاكر والفواتير في البرنامج بهذا الشكل تماماً.', 'success');
      }
    },

    async saveCustomTemplateToDb() {
      await this.saveAsDefaultForDocType();
    },

    async printCurrentCanvasNow() {
      const livePaperEl = document.querySelector('#v45LivePaperHost .v45-live-paper');
      let bodyContent = '';
      if (livePaperEl) {
        const clone = livePaperEl.cloneNode(true);
        clone.querySelectorAll('.v45-layer-handle-bar').forEach((el) => el.remove());
        clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
        clone.style.transform = 'none';
        bodyContent = clone.outerHTML;
      } else {
        const docData = await this.resolveActiveDocumentData();
        bodyContent = this.buildLiveDocumentPaperHtml(docData, true);
      }

      const isThermal = this.config.paperSize === '80mm' || this.config.paperSize === '58mm';
      const pageCss = isThermal
        ? `@page { size: ${this.config.paperSize} auto; margin: 1.5mm; }`
        : this.config.paperSize === '2xa5'
        ? `@page { size: A4 landscape; margin: 6mm; }`
        : this.config.paperSize === 'a5'
        ? `@page { size: A5 portrait; margin: 6mm; }`
        : `@page { size: A4 portrait; margin: 8mm; }`;

      const html = `<!DOCTYPE html><html lang="ar" dir="rtl" data-v49-adopted-master="1"><head><meta charset="UTF-8"><style>
        ${pageCss}
        * { box-sizing: border-box !important; }
        body { margin: 0; padding: 0; font-family: '${this.config.fontFamily}', 'Cairo', Tahoma, sans-serif; color: #0f172a; background: #fff; }
        .v45-live-paper { box-shadow: none !important; margin: 0 auto !important; min-height: auto !important; }
        .v45-canvas-layer { border: none !important; box-shadow: none !important; }
      </style></head><body>${bodyContent}</body></html>`;

      window.__gherbiMasterPrintSilent({ html, silent: false });
    },

    setBridgeCategory(cat) { this.bridgeCategory = cat; this.renderStudioIntoRoot(); },
    setBridgeSearch(val) { this.bridgeSearch = val || ''; this.renderStudioIntoRoot(); },
    selectLabelPreset(presetId) {
      const pr = LABEL_PRESETS.find((x) => x.id === presetId);
      if (pr) {
        this.config.labelCfg.presetId = pr.id;
        this.config.labelCfg.widthMm = pr.w;
        this.config.labelCfg.heightMm = pr.h;
        this.saveConfigLocal();
        this.renderStudioIntoRoot();
      }
    },
    selectPreviewProduct(prodId) {
      this.config.labelCfg.previewProductId = Number(prodId);
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    },
    updateLabelCfg(key, val) {
      this.config.labelCfg[key] = val;
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    },
    buildSingleLabelOrShelfTagHtml(prod, lCfg) {
      const shop = this.getShopIdentity();
      const price = Number(prod.selling_price || prod.price || 0);
      const bc = prod.barcode || '613000000001';
      const bcSvg = generateCrispBarcodeSvg(bc, lCfg.barcodeHeightMm || 10, true);
      return `
        <div class="v45-live-paper" style="width:${lCfg.widthMm}mm;height:${lCfg.heightMm}mm;min-height:auto;background:#ffffff;color:#000000;border:1.5px solid #0f172a;border-radius:6px;padding:2mm;display:flex;flex-direction:column;justify-content:space-between;text-align:center;overflow:hidden;">
          ${lCfg.showShopName ? `<div contenteditable="true" style="font-size:8.5px;font-weight:900;border-bottom:1px solid #cbd5e1;">${shop.name}</div>` : ''}
          ${lCfg.showProductName ? `<div contenteditable="true" style="font-size:10px;font-weight:900;line-height:1.15;max-height:2.2em;overflow:hidden;">${prod.name || 'منتج'}</div>` : ''}
          <div>${bcSvg}</div>
          ${lCfg.showPriceDzd ? `<div><span style="font-size:12.5px;font-weight:900;font-family:monospace;">${price.toFixed(2)} د.ج</span></div>` : ''}
        </div>
      `;
    },
    addProductToLabelQueue(prod, copies = 1) {
      if (!prod) return;
      const existing = this.labelQueue.find((x) => Number(x.id) === Number(prod.id));
      if (existing) existing.copies += Math.max(1, Number(copies || 1));
      else this.labelQueue.push({ id: prod.id, name: prod.name || 'منتج', barcode: prod.barcode || '6130001', price: Number(prod.selling_price || 0), copies: Math.max(1, Number(copies || 1)) });
    },
    addCurrentPreviewProductToQueue() {
      const prod = (this.liveDataRecords.products || []).find((p) => Number(p.id) === Number(this.config.labelCfg.previewProductId));
      if (prod) { this.addProductToLabelQueue(prod, 1); this.renderStudioIntoRoot(); }
    },
    updateQueueItemCopies(idx, val) { if (this.labelQueue[idx]) { this.labelQueue[idx].copies = Math.max(1, Number(val || 1)); this.renderStudioIntoRoot(); } },
    removeQueueItem(idx) { this.labelQueue.splice(idx, 1); this.renderStudioIntoRoot(); },
    clearLabelQueue() { this.labelQueue = []; this.renderStudioIntoRoot(); },
    printSinglePreviewLabelNow() {
      const prod = (this.liveDataRecords.products || []).find((p) => Number(p.id) === Number(this.config.labelCfg.previewProductId)) || (this.liveDataRecords.products || [])[0];
      if (!prod) return;
      const lCfg = this.config.labelCfg;
      const stickerHtml = this.buildSingleLabelOrShelfTagHtml(prod, lCfg);
      const html = `<!DOCTYPE html><html lang="ar" dir="rtl" data-v49-adopted-master="1"><head><meta charset="UTF-8"><style>@page { size: ${lCfg.widthMm}mm ${lCfg.heightMm}mm; margin: 0; } body { margin: 0; display: flex; justify-content: center; align-items: center; }</style></head><body>${stickerHtml}</body></html>`;
      window.__gherbiMasterPrintSilent({ html, silent: false });
    },
    printAllQueuedLabelsSheet() {
      if (this.labelQueue.length === 0) return;
      const lCfg = this.config.labelCfg;
      const allStickers = [];
      for (const qItem of this.labelQueue) {
        for (let i = 0; i < Math.min(200, Math.max(1, Number(qItem.copies || 1))); i++) {
          allStickers.push(this.buildSingleLabelOrShelfTagHtml({ name: qItem.name, barcode: qItem.barcode, selling_price: qItem.price }, lCfg));
        }
      }
      const html = `<!DOCTYPE html><html lang="ar" dir="rtl" data-v49-adopted-master="1"><head><meta charset="UTF-8"><style>@page { margin: 5mm; } body { margin: 0; display: flex; flex-wrap: wrap; gap: 2.5mm; }</style></head><body>${allStickers.join('')}</body></html>`;
      window.__gherbiMasterPrintSilent({ html, silent: false });
    },
    updateFreeDoc(key, val) { this.freeDoc[key] = val; this.renderStudioIntoRoot(); },
    printFreeWordDocumentNow() {
      const host = document.getElementById('v45FreeWordPaperHost');
      if (!host) return;
      const html = `<!DOCTYPE html><html lang="ar" dir="rtl" data-v49-adopted-master="1"><head><meta charset="UTF-8"><style>@page { size: A4 portrait; margin: 10mm; } body { margin: 0; font-family: 'Cairo', sans-serif; }</style></head><body>${host.innerHTML}</body></html>`;
      window.__gherbiMasterPrintSilent({ html, silent: false });
    },
    setDocDefaultPaper(docId, paperVal) {
      if (!this.config.defaultsByDocType[docId]) this.config.defaultsByDocType[docId] = { paperSize: paperVal, themeId: 'royal_blue', lang: 'ar', adopted: true };
      else { this.config.defaultsByDocType[docId].paperSize = paperVal; this.config.defaultsByDocType[docId].adopted = true; }
      if (this.config.adoptedProfiles[docId]) this.config.adoptedProfiles[docId].paperSize = paperVal;
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    },
    setDocDefaultTheme(docId, themeVal) {
      if (!this.config.defaultsByDocType[docId]) this.config.defaultsByDocType[docId] = { paperSize: 'a4', themeId: themeVal, lang: 'ar', adopted: true };
      else { this.config.defaultsByDocType[docId].themeId = themeVal; this.config.defaultsByDocType[docId].adopted = true; }
      if (this.config.adoptedProfiles[docId]) this.config.adoptedProfiles[docId].themeId = themeVal;
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    },
    async saveAllDefaultsToSettings() { await this.saveAsDefaultForDocType(); }
  };

  window.GherbiPrintStudioV45 = MasterPrintStudio;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MasterPrintStudio.init());
  } else {
    MasterPrintStudio.init();
  }
})();

/* ==================== [V52 STAGE 1: SOURCE-LEVEL PRINT ROUTER & EXACT POS MATCH] ==================== */
(function installV52MasterPrintRouterAndPosBridge() {
  // حفظ مرجع للدوال الأصلية في window.api باستخدام الفهرسة النصية حتى لا تتأثر بالاستبدال
  const getNativePrintSilent = () => {
    const apiObj = window.api || window._nativeApi;
    const k = 'print' + 'Silent';
    return apiObj && typeof apiObj[k] === 'function' ? apiObj[k].bind(apiObj) : null;
  };

  const getNativeProcessSale = () => {
    const apiObj = window.api || window._nativeApi;
    const k = 'process' + 'Sale';
    return apiObj && typeof apiObj[k] === 'function' ? apiObj[k].bind(apiObj) : null;
  };

  window.__gherbiLastSaleState = {
    payload: null,
    result: null,
    timestamp: 0
  };

  // 1. الموجه المركزي لعملية حفظ البيع (يلتقط بيانات الفاتورة ورقمها فور بيعها في شاشة المبيعات)
  window.__gherbiMasterProcessSale = async function (salePayload, ...rest) {
    window.__gherbiLastSaleState.payload = salePayload;
    window.__gherbiLastSaleState.timestamp = Date.now();

    const nativeFn = getNativeProcessSale();
    if (!nativeFn) throw new Error('processSale native API not found');

    const result = await nativeFn(salePayload, ...rest);
    window.__gherbiLastSaleState.result = result;
    window.__gherbiLastSaleState.timestamp = Date.now();

    const studio = window.GherbiPrintStudioV45;
    if (studio) {
      studio.lastProcessedSalePayload = salePayload;
      studio.lastProcessedSaleResult = result;
    }
    if (result && (result.saleId || result.id) && window.App) {
      window.App.currentPrintingSaleId = result.saleId || result.id;
    }
    return result;
  };

  // 2. دالة بناء HTML التذكرة أو الفاتورة المطابق 100% لمعاينة مركز الطباعة (image_8810a6.png)
  async function buildExactStudioDocumentHtml(docTypeKey, saleIdHint, rawSalePayloadHint) {
    const studio = window.GherbiPrintStudioV45;
    if (!studio) return null;

    let targetDocType = docTypeKey || 'receipt_thermal';
    if (['receipt', '80mm', '58mm', 'thermal'].includes(targetDocType)) {
      targetDocType = 'receipt_thermal';
    } else if (['a4', 'invoice'].includes(targetDocType)) {
      targetDocType = 'invoice_a4';
    } else if (targetDocType === 'a5') {
      targetDocType = 'invoice_a5';
    } else if (['delivery', 'bl'].includes(targetDocType)) {
      targetDocType = 'delivery_note';
    }

    // تحديث قوائم المبيعات والزبائن من القاعدة لضمان قراءة الرصيد الجديد لنقاط الوفاء ورقم الفاتورة
    try {
      if (window.api?.getCustomers) {
        studio.liveDataRecords.customers = await window.api.getCustomers();
      }
      if (window.api?.getSales) {
        studio.liveDataRecords.sales = await window.api.getSales();
      }
    } catch (_) {}

    const recentSaleId =
      saleIdHint ||
      (Date.now() - window.__gherbiLastSaleState.timestamp < 20000 &&
        window.__gherbiLastSaleState.result &&
        (window.__gherbiLastSaleState.result.saleId || window.__gherbiLastSaleState.result.id)) ||
      window.App?.currentPrintingSaleId ||
      (studio.liveDataRecords.sales[0] && studio.liveDataRecords.sales[0].id) ||
      null;

    let docData = null;

    // أ) جلب البيانات الكاملة للفاتورة من قاعدة البيانات (getSaleDetails) إن وجد رقم فاتورة
    if (recentSaleId && recentSaleId !== 'SAMPLE' && window.api?.getSaleDetails) {
      try {
        const det = await window.api.getSaleDetails(Number(recentSaleId));
        if (det && Array.isArray(det.items) && det.items.length > 0) {
          // حساب نقاط الوفاء المكتسبة والمخصومة في هذه الفاتورة بدقة
          const earnedFromTotal = Math.max(0, Math.floor(Number(det.total || 0) / 100));
          docData = studio.enrichDocumentDataWithLoyaltyAndDebt({
            docNumber: det.doc_number || String(det.id),
            date: String(det.sale_date || det.created_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
            customerId: det.customer_id || null,
            partyTitle: 'الزبون:',
            partyName: det.customer_name || 'زبون عابر (Comptoir)',
            partyPhone: det.customer_phone || '-',
            partyAddress: det.customer_address || '-',
            partyRc: det.customer_rc || '-',
            partyNif: det.customer_nif || '-',
            paymentMethod: det.payment_method || 'نقداً',
            cashierName: det.seller_name || 'المدير العام',
            previousBalance: 0,
            loyaltyPointsEarned: earnedFromTotal,
            loyaltyPointsRedeemed: 0,
            loyaltyDiscountDzd: 0,
            items: det.items.map((it) => ({
              barcode: it.product_barcode || '-',
              name: it.product_name || it.custom_product_name || 'منتج',
              unit: it.product_unit || 'قطعة',
              qty: Number(it.quantity || 1),
              price: Number(it.price || 0),
              discount: Number(it.discount || 0),
              tva: Number(det.tax_percentage || 0),
              subtotal: Number(it.subtotal || 0)
            })),
            subtotal: Number(det.subtotal || det.total || 0),
            discount: Number(det.discount || 0),
            tvaAmount: Number(((Number(det.subtotal || 0) * Number(det.tax_percentage || 0)) / 100).toFixed(2)),
            stampAmount: Number(det.stamp_amount || 0),
            total: Number(det.total || 0),
            paidAmount: Number(det.paid_amount ?? det.total ?? 0),
            receivedAmount: Number(det.paid_amount ?? det.total ?? 0),
            remainingDebt: Math.max(0, Number((Number(det.total || 0) - Number(det.paid_amount ?? det.total ?? 0)).toFixed(2)))
          });
        }
      } catch (_) {}
    }

    // ب) إذا كانت تذكرة فورية من السلة قبل الحفظ أو لم تُجلب من القاعدة، نقرأها من حمولة البيع أو السلة النشطة
    if (!docData) {
      const payloadSrc = rawSalePayloadHint || window.__gherbiLastSaleState.payload;
      const activeCart = typeof window.App?.getCurrentCart === 'function' ? window.App.getCurrentCart() : null;
      const itemsList =
        (payloadSrc && Array.isArray(payloadSrc.items) && payloadSrc.items.length > 0 && payloadSrc.items) ||
        (activeCart && Array.isArray(activeCart.items) && activeCart.items.length > 0 && activeCart.items) ||
        null;

      if (itemsList) {
        const custId =
          (payloadSrc && (payloadSrc.customer_id || payloadSrc.customerId)) ||
          (activeCart && activeCart.customerId) ||
          Number(document.getElementById('posCustomerSelect')?.value || 0) ||
          null;
        const custObj = (studio.liveDataRecords.customers || window.AppState?.customers || []).find(
          (c) => custId && Number(c.id) === Number(custId)
        );
        const subVal = itemsList.reduce(
          (s, it) => s + Number(it.subtotal ?? Number(it.price || 0) * Number(it.quantity || 1)),
          0
        );
        const discVal = Number((payloadSrc && payloadSrc.discount) || (activeCart && activeCart.discount) || 0);
        const totVal = Math.max(0, Number((subVal - discVal).toFixed(2)));
        const paidVal = Number((payloadSrc && payloadSrc.paid_amount) ?? totVal);

        docData = studio.enrichDocumentDataWithLoyaltyAndDebt({
          docNumber:
            (window.__gherbiLastSaleState.result &&
              (window.__gherbiLastSaleState.result.docNumber || window.__gherbiLastSaleState.result.saleId)) ||
            'FAC-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4),
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          customerId: custId,
          partyTitle: 'الزبون:',
          partyName: custObj ? custObj.name : 'زبون عابر (Comptoir)',
          partyPhone: custObj ? custObj.phone || '-' : '-',
          partyAddress: custObj ? custObj.address || '-' : '-',
          partyRc: custObj ? custObj.rc || '-' : '-',
          partyNif: custObj ? custObj.nif || '-' : '-',
          paymentMethod: (payloadSrc && payloadSrc.payment_method) || 'نقداً',
          previousBalance: 0,
          items: itemsList.map((it) => ({
            barcode: it.barcode || it.product_barcode || '-',
            name: it.name || it.product_name || it.custom_product_name || 'منتج',
            unit: it.unit || it.product_unit || 'قطعة',
            qty: Number(it.quantity ?? it.qty ?? 1),
            price: Number(it.price ?? it.selling_price ?? 0),
            discount: Number(it.discount || 0),
            tva: 0,
            subtotal: Number(it.subtotal ?? Number(it.price || 0) * Number(it.quantity || 1))
          })),
          subtotal: subVal,
          discount: discVal,
          tvaAmount: 0,
          stampAmount: 0,
          total: totVal,
          paidAmount: paidVal,
          receivedAmount: paidVal,
          remainingDebt: Math.max(0, Number((totVal - paidVal).toFixed(2)))
        });
      }
    }

    if (!docData) {
      docData = await studio.resolveActiveDocumentData(targetDocType);
    }

    // جلب إعدادات القالب المعتمد لهذا المستند
    const defInfo = studio.config.defaultsByDocType[targetDocType] || {};
    const savedProfile = studio.config.adoptedProfiles[targetDocType] || {};
    const effectivePaperSize =
      defInfo.paperSize || savedProfile.paperSize || (targetDocType === 'receipt_thermal' ? '80mm' : 'a4');
    const effectiveThemeId =
      defInfo.themeId || savedProfile.themeId || (targetDocType === 'receipt_thermal' ? 'pure_mono' : 'royal_blue');

    const customOverrides = {
      ...savedProfile,
      activeDocType: targetDocType,
      paperSize: effectivePaperSize,
      themeId: effectiveThemeId
    };

    const paperHtml = studio.buildLiveDocumentPaperHtml(docData, true, customOverrides);
    const isThermal = effectivePaperSize === '80mm' || effectivePaperSize === '58mm';
    const thermalWidthMm = effectivePaperSize === '58mm' ? '56mm' : '78mm';

    // تضمين كافة تنسيقات الورقة والخطوط والحدود داخل وثيقة الطباعة والـ PDF لتطابق المعاينة في مركز الطباعة 100%!
    const pageCss = isThermal
      ? `@page { size: ${effectivePaperSize} auto; margin: 2mm; }`
      : effectivePaperSize === '2xa5'
      ? `@page { size: A4 landscape; margin: 6mm; }`
      : effectivePaperSize === 'a5'
      ? `@page { size: A5 portrait; margin: 6mm; }`
      : `@page { size: A4 portrait; margin: 8mm; }`;

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-v52-studio-master="1">
<head>
  <meta charset="UTF-8">
  <title>${docData.docNumber || 'Gherbi.Ai POS'}</title>
  <style>
    ${pageCss}
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: '${customOverrides.fontFamily || 'Cairo'}', 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif !important;
      direction: rtl !important;
    }
    .v45-live-paper {
      background: #ffffff !important;
      color: #0f172a !important;
      box-shadow: none !important;
      margin: 0 auto !important;
      width: ${isThermal ? thermalWidthMm : '100%'} !important;
      max-width: 100% !important;
      min-height: auto !important;
      padding: ${isThermal ? '2.5mm' : '5mm'} !important;
      overflow: hidden !important;
    }
    .v45-canvas-layer {
      border: none !important;
      box-shadow: none !important;
      margin-bottom: 6px !important;
    }
    .v45-layer-handle-bar {
      display: none !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
  </style>
</head>
<body>
  ${paperHtml}
</body>
</html>`;
  }

  // 3. الموجه المركزي لعملية الطباعة والـ PDF (window.__gherbiMasterPrintSilent)
  window.__gherbiMasterPrintSilent = async function (payload = {}, ...rest) {
    const nativePrint = getNativePrintSilent();
    if (!nativePrint) return;

    try {
      const rawHtml = String((payload && payload.html) || '');

      // أ) إذا كان الكود صادراً بالفعل من محرك الاستوديو V52/V49 أو كان ملصق باركود أو تقرير رقابي، نمرره كما هو
      const isAlreadyStudioMaster =
        rawHtml.includes('data-v52-studio-master="1"') ||
        rawHtml.includes('data-v49-adopted-master="1"') ||
        rawHtml.includes('التقرير الجنائي') ||
        rawHtml.includes('تقرير رادار الرقابة') ||
        rawHtml.includes('استمارة حساب الضريبة') ||
        rawHtml.includes('Z-Report');

      if (isAlreadyStudioMaster) {
        return await nativePrint(payload, ...rest);
      }

      // ب) إذا كان المستند يحتوي على v45-live-paper (من زر طباعة الورقة الآن داخل الاستوديو)، نضمن وجود ترويسة CSS الكاملة
      if (rawHtml.includes('v45-live-paper')) {
        return await nativePrint(payload, ...rest);
      }

      // ج) أي تذكرة كاشير أو فاتورة مبيعات قديمة (مثل التي تحتوي على قسيمة وفاء واستبدال أو المجموع خارج الرسوم أو N°:)
      const isThermalRequest =
        rawHtml.includes('80mm') ||
        rawHtml.includes('58mm') ||
        rawHtml.includes('قسيمة وفاء واستبدال') ||
        rawHtml.includes('المجموع خارج الرسوم') ||
        (payload && Number(payload.widthMm || 0) > 0 && Number(payload.widthMm || 0) <= 85);

      let targetDocType = isThermalRequest ? 'receipt_thermal' : 'invoice_a4';
      if (rawHtml.includes('فاتورة شكلية') || rawHtml.includes('Proforma')) targetDocType = 'proforma';
      else if (rawHtml.includes('طلبية زبون') || rawHtml.includes('Bon de Commande')) targetDocType = 'customer_order';
      else if (rawHtml.includes('وصل التوصيل') || rawHtml.includes('Bon de Livraison')) targetDocType = 'delivery_note';
      else if (rawHtml.includes('إشعار دائن') || rawHtml.includes('Avoir')) targetDocType = 'credit_note';
      else if (rawHtml.includes('وصل استلام') || rawHtml.includes('Bon de Réception')) targetDocType = 'purchase_invoice';

      // استخراج رقم الفاتورة من الكود القديم (مثل N°: 82)
      let extractedSaleId = null;
      const numMatch =
        rawHtml.match(/N°\s*:\s*(?:FAC-\d+-)?0*(\d+)/i) ||
        rawHtml.match(/رقم(?:\s+المستند|\s+الفاتورة)?\s*:\s*(?:FAC-\d+-)?0*(\d+)/i) ||
        rawHtml.match(/#\s*(\d+)/);

      if (numMatch && numMatch[1]) {
        const candidate = Number(numMatch[1]);
        const salesList = window.GherbiPrintStudioV45?.liveDataRecords?.sales || window.AppState?.sales || [];
        const found = salesList.find(
          (s) => Number(s.id) === candidate || String(s.doc_number || '').endsWith(String(candidate))
        );
        extractedSaleId = found ? found.id : candidate;
      }

      const studioHtml = await buildExactStudioDocumentHtml(targetDocType, extractedSaleId, null);
      if (studioHtml) {
        const studio = window.GherbiPrintStudioV45;
        const defPaper =
          (studio && studio.config.defaultsByDocType[targetDocType]?.paperSize) ||
          (isThermalRequest ? '80mm' : 'a4');

        return await nativePrint(
          {
            ...payload,
            html: studioHtml,
            paperSize: defPaper,
            widthMm: defPaper === '80mm' ? 80 : defPaper === '58mm' ? 58 : undefined
          },
          ...rest
        );
      }
    } catch (err) {
      console.warn('[V52 Master Print Router Error]:', err);
    }

    return await nativePrint(payload, ...rest);
  };

  // 4. ربط دوال الطباعة المباشرة في window.App و window.PrintEngine بالموجه الجديد
  const waitApp = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!window.App || !studio) return;
    clearInterval(waitApp);

    studio.interceptAndBuildPosDocumentHtml = buildExactStudioDocumentHtml;

    // ربط نافذة #posPrintCenterModal
    window.App.refreshPrintCenterPreview = async function () {
      const selEl = document.getElementById('pcDocTypeSelect');
      const rawType = selEl ? selEl.value : 'invoice_a4';
      const mappedType =
        rawType === 'receipt' ? 'receipt_thermal' : rawType === 'delivery' ? 'delivery_note' : rawType;

      const saleId =
        window.App.currentPrintingSaleId ||
        (window.__gherbiLastSaleState.result && window.__gherbiLastSaleState.result.saleId) ||
        (studio.liveDataRecords.sales[0] && studio.liveDataRecords.sales[0].id) ||
        'SAMPLE';

      const html = await buildExactStudioDocumentHtml(mappedType, saleId, null);
      window.App._v52CurrentPrintCenterHtml = html;
      const frame = document.getElementById('printCenterPreviewFrame');
      if (frame && html) frame.srcdoc = html;
    };

    window.App.executePrintCenterAction = async function () {
      if (!window.App._v52CurrentPrintCenterHtml) {
        await window.App.refreshPrintCenterPreview();
      }
      const html = window.App._v52CurrentPrintCenterHtml;
      if (html) {
        await window.__gherbiMasterPrintSilent({ html, silent: false });
      }
    };

    console.log('🏆 [Gherbi V52 Master Print Router]: تم ربط جميع استدعاءات الطباعة في شاشة المبيعات بمركز الطباعة بنسبة 100%!');
  }, 120);
})();

/* ==================== [V52 DEFINITIVE POS & PRINT HUB UNIFIER] ==================== */
(function initV52DefinitivePosAndPrintHubUnifier() {
  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.App) return;
    clearInterval(waitStudio);

    // 1. تعريف دالة generateAdoptedHtmlForDocument مباشرة على studio بشكل مستقل ومحصن 100%
    studio.generateAdoptedHtmlForDocument = async function (docTypeKey, saleOrRecordId, rawSaleObj) {
      const self = this;
      const prevDocType = self.config.activeDocType;
      const prevRecId = self.selectedRecordId;
      const prevLoaded = self.activeLoadedDocData;

      try {
        let targetDocType = docTypeKey || 'receipt_thermal';
        if (targetDocType === 'receipt' || targetDocType === '80mm' || targetDocType === '58mm' || targetDocType === 'thermal') {
          targetDocType = 'receipt_thermal';
        } else if (targetDocType === 'a4' || targetDocType === 'invoice') {
          targetDocType = 'invoice_a4';
        } else if (targetDocType === 'a5') {
          targetDocType = 'invoice_a5';
        } else if (targetDocType === '2xa5') {
          targetDocType = 'invoice_2xa5';
        } else if (targetDocType === 'delivery' || targetDocType === 'bl') {
          targetDocType = 'delivery_note';
        }

        // تحديث قوائم المبيعات والزبائن من قاعدة البيانات لضمان دقة الرصيد والنقاط ورقم الفاتورة
        try {
          if (window.api?.getCustomers) self.liveDataRecords.customers = (await window.api.getCustomers()) || [];
          if (window.api?.getSales) self.liveDataRecords.sales = (await window.api.getSales()) || [];
        } catch (_) {}

        const defInfo = self.config.defaultsByDocType[targetDocType] || {};
        const savedProfile = self.config.adoptedProfiles[targetDocType] || {};

        // إذا كان المستخدم يعدّل حالياً نفس نوع المستند في مركز الطباعة، نأخذ إعداداته الحية مباشرةً!
        const useCurrentStudioConfig = self.config.activeDocType === targetDocType;
        const effectivePaperSize = useCurrentStudioConfig
          ? self.config.paperSize
          : defInfo.paperSize || savedProfile.paperSize || (targetDocType === 'receipt_thermal' ? '80mm' : 'a4');
        const effectiveThemeId = useCurrentStudioConfig
          ? self.config.themeId
          : defInfo.themeId || savedProfile.themeId || (targetDocType === 'receipt_thermal' ? 'pure_mono' : 'royal_blue');

        let docData = null;

        // أولاً: إذا توفر رقم فاتورة فعلي محفوظ في قاعدة البيانات (مثل الفاتورة 82)، نجلب تفاصيلها الكاملة من SQLite!
        if (saleOrRecordId && saleOrRecordId !== 'SAMPLE' && !isNaN(Number(saleOrRecordId))) {
          self.selectedRecordId = String(saleOrRecordId);
          self.activeLoadedDocData = null;
          docData = await self.resolveActiveDocumentData(targetDocType);
        }

        // ثانياً: إذا لم يتوفر رقم فاتورة أو لم يُعثر عليها، نبنيها من بيانات السلة المباشرة (rawSaleObj)
        if ((!docData || docData.docNumber === 'FAC-2026-0076') && rawSaleObj && Array.isArray(rawSaleObj.items) && rawSaleObj.items.length > 0) {
          const custId = rawSaleObj.customer_id || rawSaleObj.customerId || null;
          const custObj = (self.liveDataRecords.customers || window.AppState?.customers || []).find(
            (c) => custId && Number(c.id) === Number(custId)
          );
          const latestSale = (self.liveDataRecords.sales || [])[0];
          const resolvedDocNum =
            rawSaleObj.doc_number ||
            rawSaleObj.docNumber ||
            (self.lastProcessedSaleResult && (self.lastProcessedSaleResult.docNumber || self.lastProcessedSaleResult.doc_number)) ||
            (latestSale && latestSale.doc_number) ||
            ('#' + ((self.lastProcessedSaleResult && self.lastProcessedSaleResult.saleId) || (latestSale && latestSale.id) || Date.now().toString().slice(-4)));

          docData = self.enrichDocumentDataWithLoyaltyAndDebt({
            docNumber: resolvedDocNum,
            date: String(rawSaleObj.sale_date || new Date().toISOString()).replace('T', ' ').slice(0, 16),
            customerId: custId,
            partyTitle: 'الزبون:',
            partyName: rawSaleObj.customer_name || (custObj && custObj.name) || 'زبون عابر (Comptoir)',
            partyPhone: rawSaleObj.customer_phone || (custObj && custObj.phone) || '-',
            partyAddress: rawSaleObj.customer_address || (custObj && custObj.address) || '-',
            partyRc: rawSaleObj.customer_rc || (custObj && custObj.rc) || '-',
            partyNif: rawSaleObj.customer_nif || (custObj && custObj.nif) || '-',
            paymentMethod: rawSaleObj.payment_method || 'نقداً',
            cashierName: rawSaleObj.seller_name || rawSaleObj.user_name || 'المدير العام',
            previousBalance: Number(rawSaleObj.previous_debt || 0),
            loyaltyPointsEarned: rawSaleObj.points_earned,
            loyaltyPointsRedeemed: rawSaleObj.points_redeemed,
            loyaltyDiscountDzd: rawSaleObj.loyalty_discount,
            items: rawSaleObj.items.map((it) => {
              const prodLookup = (self.liveDataRecords.products || window.AppState?.products || []).find(
                (p) => Number(p.id) === Number(it.product_id || it.productId || it.id)
              );
              const q = Number(it.quantity ?? it.qty ?? 1);
              const pr = Number(it.price ?? it.selling_price ?? 0);
              return {
                barcode: it.barcode || it.product_barcode || (prodLookup && prodLookup.barcode) || '-',
                name: it.name || it.product_name || it.custom_product_name || (prodLookup && prodLookup.name) || 'صنف',
                unit: it.unit || it.product_unit || (prodLookup && prodLookup.unit) || 'قطعة',
                qty: q,
                price: pr,
                discount: Number(it.discount || 0),
                tva: Number(rawSaleObj.tax_percentage || 0),
                subtotal: Number(it.subtotal ?? (q * pr))
              };
            }),
            subtotal: Number(rawSaleObj.subtotal ?? rawSaleObj.total ?? 0),
            discount: Number(rawSaleObj.discount || 0),
            tvaAmount: 0,
            stampAmount: Number(rawSaleObj.stamp_amount || 0),
            total: Number(rawSaleObj.total || 0),
            paidAmount: Number(rawSaleObj.paid_amount ?? rawSaleObj.total ?? 0),
            receivedAmount: Number(rawSaleObj.received_amount ?? rawSaleObj.paid_amount ?? rawSaleObj.total ?? 0),
            remainingDebt: Math.max(0, Number(rawSaleObj.total || 0) - Number(rawSaleObj.paid_amount ?? rawSaleObj.total ?? 0))
          });
        }

        if (!docData) {
          docData = await self.resolveActiveDocumentData(targetDocType);
        }

        const customOverrides = {
          ...(useCurrentStudioConfig ? self.config : savedProfile),
          activeDocType: targetDocType,
          paperSize: effectivePaperSize,
          themeId: effectiveThemeId,
          layers:
            savedProfile && Array.isArray(savedProfile.layers) && savedProfile.layers.length > 0
              ? savedProfile.layers
              : self.config.layers,
          columns:
            savedProfile && savedProfile.columns
              ? savedProfile.columns
              : self.config.columns,
          customTexts:
            savedProfile && savedProfile.customTexts
              ? { ...self.config.customTexts, ...savedProfile.customTexts }
              : self.config.customTexts
        };

        const paperBody = self.buildLiveDocumentPaperHtml(docData, true, customOverrides);
        const isThermal = effectivePaperSize === '80mm' || effectivePaperSize === '58mm';
        const pageCss = isThermal
          ? `@page { size: ${effectivePaperSize} auto; margin: 1.5mm; }`
          : effectivePaperSize === '2xa5'
          ? `@page { size: A4 landscape; margin: 6mm; }`
          : effectivePaperSize === 'a5'
          ? `@page { size: A5 portrait; margin: 6mm; }`
          : `@page { size: A4 portrait; margin: 8mm; }`;

        return `<!DOCTYPE html><html lang="ar" dir="rtl" data-v49-adopted-master="1" data-v52-adopted-master="1"><head><meta charset="UTF-8"><style>
          ${pageCss}
          * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0; padding: 0; font-family: '${customOverrides.fontFamily || 'Cairo'}', 'Cairo', Tahoma, sans-serif; color: #0f172a; background: #fff; width: 100%; direction: rtl; }
          .v45-live-paper { box-shadow: none !important; margin: 0 auto !important; width: ${isThermal ? '76mm' : '100%'} !important; max-width: 100% !important; min-height: auto !important; padding: ${isThermal ? '2mm' : '5mm'} !important; background: #fff !important; }
          .v45-canvas-layer { border: none !important; box-shadow: none !important; margin-bottom: 6px !important; }
          .v45-layer-handle-bar { display: none !important; }
        </style></head><body>${paperBody}</body></html>`;
      } finally {
        self.config.activeDocType = prevDocType;
        self.selectedRecordId = prevRecId;
        self.activeLoadedDocData = prevLoaded;
      }
    };

    // 2. دالة طباعة مباشرة لأي فاتورة أو تذكرة من شاشة المبيعات أو السجل
    studio.printMasterDocumentBySaleId = async function (docTypeKey, saleId, fallbackSalePayload) {
      const html = await this.generateAdoptedHtmlForDocument(docTypeKey, saleId, fallbackSalePayload);
      const isThermal =
        docTypeKey === 'receipt_thermal' ||
        docTypeKey === 'receipt' ||
        docTypeKey === '80mm' ||
        docTypeKey === '58mm';
      const defPaper = (this.config.defaultsByDocType[isThermal ? 'receipt_thermal' : 'invoice_a4'] || {}).paperSize || (isThermal ? '80mm' : 'a4');
      await window.api?.printSilent?.({
        html,
        silent: false,
        paperSize: defPaper,
        widthMm: defPaper === '58mm' ? 58 : defPaper === '80mm' ? 80 : undefined
      });
    };

    // 3. دالة تحويل أي Payload قديم يمر عبر printSilent إلى القالب المعتمد في الاستوديو
    const interceptAnyLegacyPrintPayload = async function (payload = {}) {
      const rawHtml = String((payload && payload.html) || '');
      if (
        rawHtml.includes('data-v52-adopted-master="1"') ||
        rawHtml.includes('data-v49-adopted-master="1"') ||
        rawHtml.includes('v45-live-paper') ||
        rawHtml.includes('التقرير الجنائي') ||
        rawHtml.includes('تقرير رادار الرقابة') ||
        rawHtml.includes('استمارة حساب الضريبة') ||
        rawHtml.includes('Z-Report')
      ) {
        return payload;
      }

      const isThermal =
        rawHtml.includes('80mm') ||
        rawHtml.includes('58mm') ||
        rawHtml.includes('قسيمة وفاء واستبدال') ||
        rawHtml.includes('المجموع خارج الرسوم') ||
        (payload && Number(payload.widthMm || 0) > 0 && Number(payload.widthMm || 0) <= 85);

      const targetDocType = isThermal ? 'receipt_thermal' : 'invoice_a4';

      // استخراج رقم الفاتورة من الكود القديم (مثل N°: 82)
      let extractedSaleId = null;
      const m = rawHtml.match(/N°\s*:\s*(?:FAC-\d+-)?0*(\d+)/i) || rawHtml.match(/#\s*(\d+)/);
      if (m && m[1]) {
        const candidate = Number(m[1]);
        try {
          if (window.api?.getSales) studio.liveDataRecords.sales = await window.api.getSales();
        } catch (_) {}
        const sales = studio.liveDataRecords.sales || window.AppState?.sales || [];
        const matchSale = sales.find(
          (s) => Number(s.id) === candidate || String(s.doc_number || '').endsWith(String(candidate))
        );
        extractedSaleId = matchSale ? matchSale.id : candidate;
      } else if (studio.lastProcessedSaleResult && (studio.lastProcessedSaleResult.saleId || studio.lastProcessedSaleResult.id)) {
        extractedSaleId = studio.lastProcessedSaleResult.saleId || studio.lastProcessedSaleResult.id;
      } else if (window.App.currentPrintingSaleId) {
        extractedSaleId = window.App.currentPrintingSaleId;
      }

      const adoptedHtml = await studio.generateAdoptedHtmlForDocument(
        targetDocType,
        extractedSaleId,
        studio.lastProcessedSalePayload
      );

      if (adoptedHtml) {
        const defPaper = (studio.config.defaultsByDocType[targetDocType] || {}).paperSize || (isThermal ? '80mm' : 'a4');
        return {
          ...payload,
          html: adoptedHtml,
          paperSize: defPaper,
          widthMm: defPaper === '80mm' ? 80 : defPaper === '58mm' ? 58 : undefined
        };
      }
      return payload;
    };

    // 4. تسجيل الخطافات في الجسر الآمن GherbiV52Bridge داخل preload.js
    if (window.GherbiV52Bridge && typeof window.GherbiV52Bridge.registerHooks === 'function') {
      window.GherbiV52Bridge.registerHooks({
        onProcessSale: async (salePayload, saleResult) => {
          studio.lastProcessedSalePayload = salePayload;
          studio.lastProcessedSaleResult = saleResult;
          if (saleResult && (saleResult.saleId || saleResult.id)) {
            window.App.currentPrintingSaleId = saleResult.saleId || saleResult.id;
          }
        },
        onPrintSilent: interceptAnyLegacyPrintPayload
      });
    }

    // 5. السيطرة المباشرة على App.submitSale في شاشة المبيعات (#checkoutModal)
    //    حتى لا يتم تشغيل كود التذكرة القديمة أصلاً عند الضغط على "حفظ وطباعة وصل حراري" أو "فاتورة A4"!
    if (typeof window.App.submitSale === 'function' && !window.App._v52SubmitSaleMasterHooked) {
      const origSubmitSale = window.App.submitSale.bind(window.App);
      window.App._v52SubmitSaleMasterHooked = true;

      window.App.submitSale = async function (printMode = 'receipt', ...rest) {
        // التقاط نسخة من السلة والزبون قبل أن تفرغها دالة البيع
        const currentTab =
          (window.AppState?.cartTabs && window.AppState.cartTabs[window.AppState.activeCartTabIndex || 0]) || {};
        const cartItems = Array.isArray(currentTab.items)
          ? currentTab.items
          : Array.isArray(window.AppState?.cart)
          ? window.AppState.cart
          : [];
        const custId = document.getElementById('posCustomerSelect')?.value || currentTab.customerId || null;
        const paidInp = Number(document.getElementById('chkPaidAmount')?.value || 0);
        const payMethod = document.getElementById('chkPaymentMethod')?.value || 'cash';
        const discVal = Number(document.getElementById('cartDiscountInput')?.value || 0);
        const subVal = cartItems.reduce((s, it) => s + Number(it.subtotal ?? Number(it.price || 0) * Number(it.quantity || 1)), 0);
        const totVal = Math.max(0, subVal - discVal);

        const cartSnapshot = {
          customer_id: custId ? Number(custId) : null,
          payment_method: payMethod,
          subtotal: subVal,
          discount: discVal,
          total: totVal,
          paid_amount: paidInp > 0 ? paidInp : totVal,
          received_amount: paidInp > 0 ? paidInp : totVal,
          items: JSON.parse(JSON.stringify(cartItems))
        };
        studio.lastProcessedSalePayload = cartSnapshot;

        // إذا طلب المستخدم طباعة وصل حراري أو فاتورة A4، نمرر 'none' للدالة الأصلية كي تحفظ الفاتورة وتخصم المخزون وتحدث النقاط دون تشغيل الطابعة القديمة!
        const wantsPrint = printMode && printMode !== 'none';
        const res = await origSubmitSale(wantsPrint ? 'none' : printMode, ...rest);

        if (wantsPrint) {
          // جلب أحدث فاتورة حُفظت للتو في قاعدة البيانات
          let targetSaleId =
            (res && (res.saleId || res.id)) ||
            (studio.lastProcessedSaleResult && (studio.lastProcessedSaleResult.saleId || studio.lastProcessedSaleResult.id)) ||
            window.App.currentPrintingSaleId ||
            null;

          if (!targetSaleId && window.api?.getSales) {
            try {
              const latestSales = await window.api.getSales();
              studio.liveDataRecords.sales = latestSales || [];
              if (latestSales && latestSales[0]) {
                targetSaleId = latestSales[0].id;
              }
            } catch (_) {}
          }

          const targetDocType = printMode === 'a4' || printMode === 'invoice' ? 'invoice_a4' : 'receipt_thermal';
          await studio.printMasterDocumentBySaleId(targetDocType, targetSaleId, cartSnapshot);
        }

        return res;
      };
    }

    // 6. توجيه جميع دوال طباعة المبيعات السريعة وإعادة الطباعة في App و PrintEngine إلى القالب المعتمد
    const legacyReceiptMethodNames = [
      'printReceipt',
      'printSaleReceipt',
      'quickPrintReceipt',
      'quickPrintThermal80',
      'printThermalReceipt',
      'printPosReceipt'
    ];
    for (const fnName of legacyReceiptMethodNames) {
      window.App[fnName] = async function (saleIdOrObj) {
        const sid = typeof saleIdOrObj === 'object' && saleIdOrObj !== null ? saleIdOrObj.id || saleIdOrObj.saleId : saleIdOrObj;
        await studio.printMasterDocumentBySaleId('receipt_thermal', sid, typeof saleIdOrObj === 'object' ? saleIdOrObj : null);
      };
    }

    const legacyInvoiceMethodNames = [
      'printInvoice',
      'printSaleInvoice',
      'printA4Invoice',
      'printSaleA4'
    ];
    for (const fnName of legacyInvoiceMethodNames) {
      window.App[fnName] = async function (saleIdOrObj) {
        const sid = typeof saleIdOrObj === 'object' && saleIdOrObj !== null ? saleIdOrObj.id || saleIdOrObj.saleId : saleIdOrObj;
        await studio.printMasterDocumentBySaleId('invoice_a4', sid, typeof saleIdOrObj === 'object' ? saleIdOrObj : null);
      };
    }

    if (window.PrintEngine && typeof window.PrintEngine === 'object') {
      window.PrintEngine.printReceipt = async function (saleOrId) {
        const sid = typeof saleOrId === 'object' && saleOrId !== null ? saleOrId.id || saleOrId.saleId : saleOrId;
        await studio.printMasterDocumentBySaleId('receipt_thermal', sid, typeof saleOrId === 'object' ? saleOrId : null);
      };
      window.PrintEngine.printInvoice = async function (saleOrId) {
        const sid = typeof saleOrId === 'object' && saleOrId !== null ? saleOrId.id || saleOrId.saleId : saleOrId;
        await studio.printMasterDocumentBySaleId('invoice_a4', sid, typeof saleOrId === 'object' ? saleOrId : null);
      };
    }

    // 7. ربط نافذة المعاينة والطباعة الفورية (#posPrintCenterModal)
    window.App.openPrintCenterModal = async function (saleId, defaultDocType = 'receipt') {
      window.App.currentPrintingSaleId = saleId;
      const selEl = document.getElementById('pcDocTypeSelect');
      if (selEl && defaultDocType) {
        selEl.value = defaultDocType === 'receipt_thermal' ? 'receipt' : defaultDocType;
      }
      window.App.openModal('posPrintCenterModal');
      await window.App.refreshPrintCenterPreview();
    };

    window.App.refreshPrintCenterPreview = async function () {
      const selEl = document.getElementById('pcDocTypeSelect');
      const rawType = selEl ? selEl.value : 'receipt';
      const mappedType =
        rawType === 'receipt'
          ? 'receipt_thermal'
          : rawType === 'delivery'
          ? 'delivery_note'
          : rawType;

      const saleId =
        window.App.currentPrintingSaleId ||
        (studio.lastProcessedSaleResult && studio.lastProcessedSaleResult.saleId) ||
        (studio.liveDataRecords.sales[0] && studio.liveDataRecords.sales[0].id) ||
        'SAMPLE';

      const html = await studio.generateAdoptedHtmlForDocument(mappedType, saleId, studio.lastProcessedSalePayload);
      window.App._v52CurrentModalHtml = html;
      window.App._v52CurrentModalDocType = mappedType;

      const frame = document.getElementById('printCenterPreviewFrame');
      if (frame) {
        frame.srcdoc = html;
      }
    };

    window.App.executePrintCenterAction = async function () {
      if (!window.App._v52CurrentModalHtml) {
        await window.App.refreshPrintCenterPreview();
      }
      const html = window.App._v52CurrentModalHtml;
      if (!html) return;
      const isThermal = window.App._v52CurrentModalDocType === 'receipt_thermal';
      await window.api?.printSilent?.({
        html,
        silent: false,
        paperSize: isThermal ? '80mm' : 'a4',
        widthMm: isThermal ? 80 : undefined
      });
    };

    console.log('🏆 [Gherbi V52 Definitive Unifier]: تم توحيد طباعة شاشة المبيعات مع معاينة مركز الطباعة بنسبة 100%!');
  }, 140);
})();

/* ==================== [V55 STAGE 2: COMPLETE SALES VIEW HIJACK, FILTER, PDF EXPORT & BULK ACTIONS] ==================== */
(function initV55Stage2CompleteSalesViewOverhaul() {
  const TEMPLATE_TO_THEME_MAP = {
    default: null,
    template1: 'royal_blue',
    template2: 'executive_dark',
    template3: 'emerald_dz',
    template9: 'amber_gold',
    detailed: 'crimson_bold',
    mono: 'pure_mono'
  };

  const DOC_LANG_LABELS = {
    ar: {
      dir: 'rtl',
      invoiceTitle: 'فاتورة مبيعات / Facture',
      receiptTitle: 'وصل مبيعات / Ticket de Caisse',
      deliveryTitle: 'وصل تسليم بضاعة / Bon de Livraison',
      creditNoteTitle: "إشعار دائن (مرتجع) / Facture d'Avoir",
      warrantyTitle: 'شهادة ضمان رسمية / Certificat de Garantie',
      partyLabel: 'الزبون:',
      colIndex: '#',
      colBarcode: 'الباركود',
      colName: 'التعيين / الصنف',
      colUnit: 'الوحدة',
      colQty: 'الكمية',
      colPrice: 'سعر الوحدة',
      colDiscount: 'الخصم',
      colSubtotal: 'المجموع',
      totalLabel: 'الإجمالي الصافي:'
    },
    fr: {
      dir: 'ltr',
      invoiceTitle: 'FACTURE DE VENTE',
      receiptTitle: 'TICKET DE CAISSE',
      deliveryTitle: 'BON DE LIVRAISON (BL)',
      creditNoteTitle: "FACTURE D'AVOIR",
      warrantyTitle: 'CERTIFICAT DE GARANTIE',
      partyLabel: 'Client :',
      colIndex: 'N°',
      colBarcode: 'Code-barres',
      colName: 'Désignation / Article',
      colUnit: 'Unité',
      colQty: 'Qté',
      colPrice: 'P.U (DA)',
      colDiscount: 'Remise',
      colSubtotal: 'Total (DA)',
      totalLabel: 'NET À PAYER :'
    },
    en: {
      dir: 'ltr',
      invoiceTitle: 'SALES INVOICE',
      receiptTitle: 'SALES RECEIPT',
      deliveryTitle: 'DELIVERY NOTE',
      creditNoteTitle: 'CREDIT NOTE',
      warrantyTitle: 'WARRANTY CERTIFICATE',
      partyLabel: 'Customer:',
      colIndex: '#',
      colBarcode: 'Barcode',
      colName: 'Item Description',
      colUnit: 'Unit',
      colQty: 'Qty',
      colPrice: 'Unit Price',
      colDiscount: 'Disc.',
      colSubtotal: 'Subtotal',
      totalLabel: 'GRAND TOTAL:'
    }
  };

  const FastCache = {
    sales: [],
    customers: [],
    saleDetailsById: new Map(),
    lastSalesFetchAt: 0,
    lastCustomersFetchAt: 0,

    async getCustomersFast(force = false) {
      const now = Date.now();
      if (!force && this.customers.length > 0 && now - this.lastCustomersFetchAt < 15000) {
        return this.customers;
      }
      try {
        if (window.api?.getCustomers) {
          this.customers = (await window.api.getCustomers()) || [];
          this.lastCustomersFetchAt = Date.now();
          if (window.AppState) window.AppState.customers = this.customers;
        }
      } catch (_) {}
      return this.customers;
    },

    async getSalesFast(force = false) {
      const now = Date.now();
      if (!force && this.sales.length > 0 && now - this.lastSalesFetchAt < 6000) {
        return this.sales;
      }
      try {
        if (window.api?.getSales) {
          this.sales = (await window.api.getSales({})) || [];
          this.lastSalesFetchAt = Date.now();
          if (window.AppState) window.AppState.sales = this.sales;
        }
      } catch (_) {}
      return this.sales;
    },

    async getSaleDetailsFast(saleId, force = false) {
      const sid = Number(saleId);
      if (!sid || isNaN(sid)) return null;
      if (!force && this.saleDetailsById.has(sid)) {
        return this.saleDetailsById.get(sid);
      }
      try {
        if (window.api?.getSaleDetails) {
          const det = await window.api.getSaleDetails(sid);
          if (det) {
            this.saleDetailsById.set(sid, det);
            return det;
          }
        }
      } catch (_) {}
      return null;
    },

    invalidate(saleId) {
      this.lastSalesFetchAt = 0;
      this.lastCustomersFetchAt = 0;
      if (saleId) this.saleDetailsById.delete(Number(saleId));
      else this.saleDetailsById.clear();
    }
  };

  const SalesState = {
    searchQuery: '',
    customerFilter: 'ALL',
    statusFilter: 'ALL',
    methodFilter: 'ALL',
    dateFrom: '',
    dateTo: '',
    quickDatePreset: 'ALL',
    pageSize: 35,
    currentPage: 1,
    filteredSales: [],
    selectedSaleIds: new Set()
  };

  const waitReady = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.App) return;
    clearInterval(waitReady);

    window.GherbiFastCacheV55 = FastCache;
    window.GherbiSalesStateV55 = SalesState;

    // 1. ترقية نافذة المعاينة والطباعة الفورية (#posPrintCenterModal) لدعم الألوان واللغات فوراً
    function ensurePrintCenterSelectOptions() {
      const selDoc = document.getElementById('pcDocTypeSelect');
      if (selDoc && !selDoc.querySelector('option[value="invoice_2xa5"]')) {
        selDoc.innerHTML = [
          '<option value="invoice_a4">📄 فاتورة رسمية (A4)</option>',
          '<option value="invoice_a5">📑 فاتورة مدمجة (A5)</option>',
          '<option value="invoice_2xa5">✂️ فاتورة مزدوجة (2×A5 في ورقة A4)</option>',
          '<option value="receipt">🧾 تذكرة حرارية (80mm / 58mm)</option>',
          '<option value="delivery">🚚 وصل توصيل (Bon de Livraison)</option>',
          '<option value="credit_note">↩️ إشعار دائن (Facture d\'Avoir)</option>',
          '<option value="warranty">🛡️ شهادة ضمان (Certificat de Garantie)</option>'
        ].join('');
      }

      const selTpl = document.getElementById('pcTemplateSelect');
      if (selTpl && !selTpl.querySelector('option[value="mono"]')) {
        selTpl.innerHTML = [
          '<option value="default">⭐ القالب الافتراضي المعتمد للمتجر</option>',
          '<option value="template1">🔵 القالب الكلاسيكي الأزرق (1)</option>',
          '<option value="template2">⚫ القالب الداكن التنفيذي الرسمي (2)</option>',
          '<option value="template3">🟢 القالب الأخضر التجاري الجزائري (3)</option>',
          '<option value="template9">🟡 القالب الذهبي الجبائي المفصل (9)</option>',
          '<option value="detailed">🔴 القالب القرمزي المفصل بالرصيد السابق</option>',
          '<option value="mono">⚪ القالب الأسود والأبيض الاقتصادي (توفير الحبر)</option>'
        ].join('');
      }
    }

    window.App.openPrintCenterModal = async function (saleId, defaultDocType = 'invoice_a4') {
      ensurePrintCenterSelectOptions();
      window.App.currentPrintingSaleId = saleId;
      const selDoc = document.getElementById('pcDocTypeSelect');
      if (selDoc && defaultDocType) {
        selDoc.value = defaultDocType === 'receipt_thermal' ? 'receipt' : defaultDocType;
      }
      window.App.openModal('posPrintCenterModal');
      await window.App.refreshPrintCenterPreview();
    };

    window.App.refreshPrintCenterPreview = async function () {
      ensurePrintCenterSelectOptions();
      const rawDocType = document.getElementById('pcDocTypeSelect')?.value || 'invoice_a4';
      const langVal = document.getElementById('pcLangSelect')?.value || 'ar';
      const tplKey = document.getElementById('pcTemplateSelect')?.value || 'default';

      const mappedDocType =
        rawDocType === 'receipt'
          ? 'receipt_thermal'
          : rawDocType === 'delivery'
          ? 'delivery_note'
          : rawDocType === 'warranty'
          ? 'warranty_cert'
          : rawDocType;

      const chosenThemeId = TEMPLATE_TO_THEME_MAP[tplKey] || null;
      const langPack = DOC_LANG_LABELS[langVal] || DOC_LANG_LABELS.ar;

      // حفظ الثيم المختار مؤقتاً وتمريره لمحرك الرسم
      const prevTheme = studio.config.themeId;
      const prevLang = studio.config.lang;
      const prevHeader = studio.config.customHeaderTitle;
      const prevTexts = JSON.parse(JSON.stringify(studio.config.customTexts || {}));

      try {
        if (chosenThemeId) {
          studio.config.themeId = chosenThemeId;
          if (!studio.config.defaultsByDocType[mappedDocType]) {
            studio.config.defaultsByDocType[mappedDocType] = { paperSize: 'a4', themeId: chosenThemeId, lang: langVal, adopted: true };
          } else {
            studio.config.defaultsByDocType[mappedDocType].themeId = chosenThemeId;
            studio.config.defaultsByDocType[mappedDocType].lang = langVal;
          }
          if (studio.config.adoptedProfiles[mappedDocType]) {
            studio.config.adoptedProfiles[mappedDocType].themeId = chosenThemeId;
          }
        }

        studio.config.lang = langVal;
        if (mappedDocType === 'receipt_thermal') studio.config.customHeaderTitle = langPack.receiptTitle;
        else if (mappedDocType === 'delivery_note') studio.config.customHeaderTitle = langPack.deliveryTitle;
        else if (mappedDocType === 'credit_note') studio.config.customHeaderTitle = langPack.creditNoteTitle;
        else if (mappedDocType === 'warranty_cert') studio.config.customHeaderTitle = langPack.warrantyTitle;
        else studio.config.customHeaderTitle = langPack.invoiceTitle;

        studio.config.customTexts = {
          ...studio.config.customTexts,
          colIndex: langPack.colIndex,
          colBarcode: langPack.colBarcode,
          colName: langPack.colName,
          colUnit: langPack.colUnit,
          colQty: langPack.colQty,
          colPrice: langPack.colPrice,
          colDiscount: langPack.colDiscount,
          colSubtotal: langPack.colSubtotal,
          totalLabel: langPack.totalLabel
        };

        if (tplKey === 'template9') studio.setLayerVisibleQuiet('tax_ifu_breakdown_layer', true);
        if (tplKey === 'detailed') studio.setLayerVisibleQuiet('debt_ledger_layer', true);

        const saleId =
          window.App.currentPrintingSaleId ||
          (studio.lastProcessedSaleResult && studio.lastProcessedSaleResult.saleId) ||
          (FastCache.sales[0] && FastCache.sales[0].id) ||
          'SAMPLE';

        const html = await studio.generateAdoptedHtmlForDocument(mappedDocType, saleId, studio.lastProcessedSalePayload);
        window.App._v52CurrentModalHtml = html;
        window.App._v52CurrentModalDocType = mappedDocType;

        const frame = document.getElementById('printCenterPreviewFrame');
        if (frame) frame.srcdoc = html;
      } finally {
        studio.config.themeId = prevTheme;
        studio.config.lang = prevLang;
        studio.config.customHeaderTitle = prevHeader;
        studio.config.customTexts = prevTexts;
      }
    };

    // 2. إصلاح نافذة تفاصيل الفاتورة (#saleDetailsModal) بالكامل
    window.App.openSaleDetailsModal = async function (saleId) {
      const sid = Number(saleId);
      if (!sid) return;
      window.App.currentPrintingSaleId = sid;

      const titleEl = document.getElementById('saleDetailsModalTitle');
      const bodyEl = document.getElementById('saleDetailsModalBody');
      if (!bodyEl) return;

      if (titleEl) titleEl.innerHTML = '📄 تفاصيل الفاتورة رقم <span class="font-mono text-blue-600">#' + sid + '</span>';
      bodyEl.innerHTML = '<div class="py-10 text-center text-slate-400 font-bold">⏳ جاري جلب بيانات الفاتورة...</div>';
      window.App.openModal('saleDetailsModal');

      const det = await FastCache.getSaleDetailsFast(sid, true);
      if (!det) {
        bodyEl.innerHTML = '<div class="py-8 text-center text-rose-500 font-bold">❌ تعذر العثور على تفاصيل هذه الفاتورة.</div>';
        return;
      }

      const docNum = det.doc_number || ('#' + det.id);
      if (titleEl) {
        titleEl.innerHTML = '📄 تفاصيل الفاتورة <span class="font-mono text-blue-600">' + docNum + '</span> — ' + (det.customer_name || 'زبون عابر');
      }

      const totalVal = Number(det.total || 0);
      const paidVal = Number(det.paid_amount ?? totalVal);
      const remDebt = Math.max(0, Number((totalVal - paidVal).toFixed(2)));
      const centimesText = studio.fmtCentimes(totalVal);

      const itemsRowsHtml =
        Array.isArray(det.items) && det.items.length > 0
          ? det.items
              .map(
                (it, idx) => `
                <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td class="py-2 px-2.5 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
                  <td class="py-2 px-2.5 font-mono text-[11px] text-slate-500">${it.product_barcode || '-'}</td>
                  <td class="py-2 px-2.5 font-black text-slate-900 dark:text-white">
                    <div><bdi>${it.product_name || it.custom_product_name || 'صنف'}</bdi></div>
                    ${it.serial_number ? `<div class="text-[10px] font-mono text-indigo-600">S/N: ${it.serial_number} ${it.warranty_months ? `(${it.warranty_months} شهر ضمان)` : ''}</div>` : ''}
                  </td>
                  <td class="py-2 px-2.5 text-center font-bold text-slate-600 dark:text-slate-300">${it.product_unit || 'قطعة'}</td>
                  <td class="py-2 px-2.5 text-center font-mono font-black text-blue-600">${Number(it.quantity || 1)}</td>
                  <td class="py-2 px-2.5 text-center font-mono">${Number(it.price || 0).toFixed(2)}</td>
                  <td class="py-2 px-2.5 text-left font-mono font-black text-slate-900 dark:text-white">${Number(it.subtotal || 0).toFixed(2)} د.ج</td>
                </tr>`
              )
              .join('')
          : '<tr><td colspan="7" class="py-6 text-center text-slate-400 font-bold">لا توجد أصناف مسجلة في هذه الفاتورة</td></tr>';

      bodyEl.innerHTML = `
        <div class="space-y-4 text-right" dir="rtl">
          <div class="p-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-black text-amber-400">🖨️ خيارات الطباعة والتصدير الفوري:</span>
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" onclick="window.GherbiPrintStudioV45.printMasterDocumentBySaleId('receipt_thermal', ${det.id})" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer">🧾 تذكرة 80mm</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.printMasterDocumentBySaleId('invoice_a4', ${det.id})" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs cursor-pointer">📄 فاتورة A4</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.printMasterDocumentBySaleId('invoice_2xa5', ${det.id})" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer">✂️ مزدوجة 2×A5</button>
              <button type="button" onclick="window.App.closeModal('saleDetailsModal'); window.App.openDeliveryNoteModal(${det.id})" class="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs cursor-pointer">🚚 وصل BL</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.printMasterDocumentBySaleId('warranty_cert', ${det.id})" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer">🛡️ شهادة ضمان</button>
              <button type="button" onclick="window.App.closeModal('saleDetailsModal'); window.App.openDocumentInPrintStudio('invoice_a4', '${det.id}')" class="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black text-xs cursor-pointer">🎨 تعديل في الاستوديو</button>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div class="text-slate-400 font-bold text-[11px]">رقم الفاتورة والتاريخ</div>
              <div class="font-mono font-black text-sm text-blue-600 mt-0.5"><bdi>${docNum}</bdi></div>
              <div class="font-mono text-[11px] text-slate-500"><bdi>${String(det.sale_date || '').replace('T', ' ').slice(0, 16)}</bdi></div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div class="text-slate-400 font-bold text-[11px]">الزبون</div>
              <div class="font-black text-sm text-slate-900 dark:text-white mt-0.5">${det.customer_name || 'زبون عابر (Comptoir)'}</div>
              <div class="font-mono text-[11px] text-slate-500"><bdi>${det.customer_phone || 'بدون هاتف'}</bdi></div>
            </div>
            <div class="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div class="text-blue-600 dark:text-blue-400 font-bold text-[11px]">الإجمالي الصافي</div>
              <div class="font-mono font-black text-base text-blue-700 dark:text-blue-300 mt-0.5">${totalVal.toFixed(2)} د.ج</div>
              <div class="text-[10.5px] font-black text-amber-600">🇩🇿 ${centimesText}</div>
            </div>
            <div class="p-3 rounded-xl ${remDebt > 0.009 ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200' : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200'} border">
              <div class="font-bold text-[11px] ${remDebt > 0.009 ? 'text-rose-600' : 'text-emerald-600'}">المدفوع والباقي (${det.payment_method || 'cash'})</div>
              <div class="font-mono font-black text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">المدفوع: ${paidVal.toFixed(2)} د.ج</div>
              <div class="font-mono font-black text-xs ${remDebt > 0.009 ? 'text-rose-600' : 'text-slate-500'}">الباقي: ${remDebt.toFixed(2)} د.ج</div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table class="w-full text-right border-collapse text-xs">
              <thead class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black">
                <tr>
                  <th class="py-2.5 px-2.5 text-center w-10">#</th>
                  <th class="py-2.5 px-2.5">الباركود</th>
                  <th class="py-2.5 px-2.5">التعيين / الصنف</th>
                  <th class="py-2.5 px-2.5 text-center">الوحدة</th>
                  <th class="py-2.5 px-2.5 text-center">الكمية</th>
                  <th class="py-2.5 px-2.5 text-center">سعر الوحدة</th>
                  <th class="py-2.5 px-2.5 text-left">المجموع</th>
                </tr>
              </thead>
              <tbody>${itemsRowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    };

    window.App.viewSaleDetails = window.App.openSaleDetailsModal;
    window.App.showSaleDetails = window.App.openSaleDetailsModal;

    // 3. المتحكم الرئيسي الشامل لصفحة سجل المبيعات والضمان (V55 Sales Master Controller)
    const SalesMasterController = {
      applyQuickDatePreset(preset) {
        SalesState.quickDatePreset = preset;
        const today = new Date();
        const fmt = (d) => d.toISOString().slice(0, 10);

        if (preset === 'TODAY') {
          const t = fmt(today);
          SalesState.dateFrom = t;
          SalesState.dateTo = t;
        } else if (preset === 'YESTERDAY') {
          const y = new Date(today.getTime() - 86400000);
          const ys = fmt(y);
          SalesState.dateFrom = ys;
          SalesState.dateTo = ys;
        } else if (preset === 'WEEK') {
          const w = new Date(today.getTime() - 7 * 86400000);
          SalesState.dateFrom = fmt(w);
          SalesState.dateTo = fmt(today);
        } else if (preset === 'MONTH') {
          const m = new Date(today.getFullYear(), today.getMonth(), 1);
          SalesState.dateFrom = fmt(m);
          SalesState.dateTo = fmt(today);
        } else {
          SalesState.dateFrom = '';
          SalesState.dateTo = '';
        }

        const dfEl = document.getElementById('v55SalesDateFrom');
        const dtEl = document.getElementById('v55SalesDateTo');
        if (dfEl) dfEl.value = SalesState.dateFrom;
        if (dtEl) dtEl.value = SalesState.dateTo;

        SalesState.currentPage = 1;
        this.renderFullSalesView(false);
      },

      resetAllFilters() {
        SalesState.searchQuery = '';
        SalesState.customerFilter = 'ALL';
        SalesState.statusFilter = 'ALL';
        SalesState.methodFilter = 'ALL';
        SalesState.dateFrom = '';
        SalesState.dateTo = '';
        SalesState.quickDatePreset = 'ALL';
        SalesState.currentPage = 1;
        SalesState.selectedSaleIds.clear();
        this.renderFullSalesView(false);
      },

      toggleSelectSale(saleId, checked) {
        const sid = Number(saleId);
        if (checked) SalesState.selectedSaleIds.add(sid);
        else SalesState.selectedSaleIds.delete(sid);
        this.updateBulkToolbarVisibility();
      },

      toggleSelectAllOnPage(checked) {
        const checkboxes = document.querySelectorAll('.v55-sale-row-check');
        checkboxes.forEach((cb) => {
          cb.checked = checked;
          const sid = Number(cb.getAttribute('data-sale-id'));
          if (checked) SalesState.selectedSaleIds.add(sid);
          else SalesState.selectedSaleIds.delete(sid);
        });
        this.updateBulkToolbarVisibility();
      },

      updateBulkToolbarVisibility() {
        const bar = document.getElementById('v55BulkActionsBar');
        const countSpan = document.getElementById('v55BulkCountText');
        if (!bar) return;
        const cnt = SalesState.selectedSaleIds.size;
        if (cnt > 0) {
          bar.classList.remove('hidden');
          if (countSpan) countSpan.textContent = String(cnt);
        } else {
          bar.classList.add('hidden');
        }
      },

      async bulkPrintSelected(docType = 'invoice_a4') {
        const ids = Array.from(SalesState.selectedSaleIds);
        if (ids.length === 0) return;
        for (const sid of ids) {
          await studio.printMasterDocumentBySaleId(docType, sid);
        }
      },

      computeFilteredSales() {
        const allSales = FastCache.sales || [];
        const q = String(SalesState.searchQuery || '').trim().toLowerCase();
        const cFilter = SalesState.customerFilter;
        const sFilter = SalesState.statusFilter;
        const mFilter = SalesState.methodFilter;
        const dFrom = SalesState.dateFrom;
        const dTo = SalesState.dateTo;

        const filtered = allSales.filter((s) => {
          if (cFilter === 'VIP_ONLY' && !s.customer_id) return false;
          if (cFilter === 'WALKIN_ONLY' && s.customer_id) return false;
          if (cFilter !== 'ALL' && cFilter !== 'VIP_ONLY' && cFilter !== 'WALKIN_ONLY') {
            if (Number(s.customer_id) !== Number(cFilter)) return false;
          }

          const tot = Number(s.total || 0);
          const paid = Number(s.paid_amount ?? tot);
          const rem = Number((tot - paid).toFixed(2));
          if (sFilter === 'PAID' && (rem > 0.009 || s.credit_note_number)) return false;
          if (sFilter === 'DEBT' && rem <= 0.009) return false;
          if (sFilter === 'CREDIT_NOTE' && !s.credit_note_number) return false;

          if (mFilter !== 'ALL' && String(s.payment_method || 'cash').toLowerCase() !== mFilter.toLowerCase()) {
            return false;
          }

          const saleDay = String(s.sale_date || s.created_at || '').slice(0, 10);
          if (dFrom && saleDay < dFrom) return false;
          if (dTo && saleDay > dTo) return false;

          if (q) {
            const hay = [
              s.id,
              s.doc_number || '',
              s.customer_name || 'زبون عابر',
              s.customer_phone || '',
              s.payment_method || '',
              s.credit_note_number || '',
              tot.toFixed(2)
            ]
              .join(' ')
              .toLowerCase();
            if (!hay.includes(q)) return false;
          }

          return true;
        });

        SalesState.filteredSales = filtered;
        return filtered;
      },

      filterAndRenderTableOnly() {
        const list = this.computeFilteredSales();
        const totalCount = list.length;
        const totalRev = list.reduce((sum, s) => sum + Number(s.total || 0), 0);
        const totalPaid = list.reduce((sum, s) => sum + Number(s.paid_amount ?? s.total ?? 0), 0);
        const totalDebt = list.reduce((sum, s) => sum + Math.max(0, Number(s.total || 0) - Number(s.paid_amount ?? s.total ?? 0)), 0);

        const kpiBox = document.getElementById('v55SalesLiveKpiStrip');
        if (kpiBox) {
          kpiBox.innerHTML = `
            <div class="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400">عدد الفواتير المطابقة</div>
                <div class="text-lg font-black font-mono text-slate-900 dark:text-white">${totalCount} <span class="text-xs font-bold text-slate-400">/ ${(FastCache.sales || []).length}</span></div>
              </div>
              <span class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black">🧾</span>
            </div>
            <div class="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400">إجمالي المبيعات المفلترة</div>
                <div class="text-lg font-black font-mono text-blue-600">${studio.fmtDzd(totalRev)}</div>
                <div class="text-[10px] font-black text-amber-600">🇩🇿 ${studio.fmtCentimes(totalRev)}</div>
              </div>
              <span class="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">💰</span>
            </div>
            <div class="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400">إجمالي المقبوض</div>
                <div class="text-lg font-black font-mono text-emerald-600">${studio.fmtDzd(totalPaid)}</div>
              </div>
              <span class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">✅</span>
            </div>
            <div class="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400">إجمالي الديون المتبقية</div>
                <div class="text-lg font-black font-mono text-rose-600">${studio.fmtDzd(totalDebt)}</div>
              </div>
              <span class="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-black">⚖️</span>
            </div>
          `;
        }

        const tbody = document.getElementById('v55SalesTableBody');
        if (!tbody) return;

        const pageSize = SalesState.pageSize || 35;
        const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
        if (SalesState.currentPage > totalPages) SalesState.currentPage = totalPages;
        const startIdx = (SalesState.currentPage - 1) * pageSize;
        const pageItems = list.slice(startIdx, startIdx + pageSize);

        if (pageItems.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" class="py-12 text-center text-slate-400 font-bold text-sm">لا توجد فواتير مطابقة لمعايير التصفية الحالية. اضغط على (↺ إعادة ضبط) لعرض الكل.</td></tr>';
        } else {
          tbody.innerHTML = pageItems
            .map((s) => {
              const tot = Number(s.total || 0);
              const paid = Number(s.paid_amount ?? tot);
              const rem = Math.max(0, Number((tot - paid).toFixed(2)));
              const isVip = Boolean(s.customer_id);
              const isChecked = SalesState.selectedSaleIds.has(Number(s.id));
              const custLabel = isVip
                ? '👑 ' + (s.customer_name || 'زبون مسجل') + ' (زبون وفي)'
                : '🚶 زبون عابر (انقر للربط بزبون)';

              return `
                <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition text-xs">
                  <td class="py-2.5 px-2.5 text-center">
                    <input type="checkbox" data-sale-id="${s.id}" ${isChecked ? 'checked' : ''}
                           onchange="window.GherbiSalesControllerV55.toggleSelectSale(${s.id}, this.checked)"
                           class="v55-sale-row-check w-4 h-4 accent-blue-600 rounded cursor-pointer">
                  </td>
                  <td class="py-2.5 px-3 font-mono font-black text-blue-600">
                    <span class="cursor-pointer hover:underline" onclick="window.App.openSaleDetailsModal(${s.id})">${s.id}</span>
                  </td>
                  <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500"><bdi>${String(s.sale_date || '').slice(0, 16)}</bdi></td>
                  <td class="py-2.5 px-3">
                    <button type="button" onclick="window.GherbiSalesControllerV55.openQuickCustomerAssignModal(${s.id}, ${s.customer_id || 'null'})"
                            class="px-2.5 py-1 rounded-xl border text-[11px] font-black transition cursor-pointer ${
                              isVip
                                ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-300 hover:bg-amber-100'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                            }">
                      ${custLabel} ▾
                    </button>
                  </td>
                  <td class="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-300">${s.payment_method || 'cash'}</td>
                  <td class="py-2.5 px-3 font-mono font-black text-slate-900 dark:text-white">${tot.toFixed(2)} د.ج</td>
                  <td class="py-2.5 px-3 font-mono font-bold text-emerald-600">${paid.toFixed(2)}</td>
                  <td class="py-2.5 px-3 font-mono font-black ${rem > 0.009 ? 'text-rose-600' : 'text-slate-400'}">${rem.toFixed(2)}</td>
                  <td class="py-2.5 px-3 text-center">
                    ${
                      s.credit_note_number
                        ? `<span class="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 font-mono font-black text-[10px]">${s.credit_note_number}</span>`
                        : '<span class="text-slate-300">-</span>'
                    }
                  </td>
                  <td class="py-2.5 px-3">
                    <div class="flex items-center justify-end gap-1 flex-wrap">
                      <button type="button" onclick="window.App.openSaleDetailsModal(${s.id})" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-blue-500 font-black text-[11px] text-slate-800 dark:text-slate-100 cursor-pointer">
                        تفاصيل
                      </button>
                      <button type="button" onclick="window.GherbiSalesControllerV55.openFastEditSaleModal(${s.id})" class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-700 hover:text-white font-black text-[11px] cursor-pointer transition">
                        تعديل
                      </button>
                      <button type="button" onclick="window.App.openPrintCenterModal(${s.id}, 'invoice_a4')" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] shadow-sm cursor-pointer transition">
                        🖨️ طباعة
                      </button>
                      <button type="button" onclick="window.GherbiPrintStudioV45.printMasterDocumentBySaleId('invoice_a4', ${s.id})" class="px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-600 text-blue-700 hover:text-white font-mono font-black text-[11px] cursor-pointer transition">
                        A4
                      </button>
                      <button type="button" onclick="window.GherbiPrintStudioV45.printMasterDocumentBySaleId('receipt_thermal', ${s.id})" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 hover:text-white font-black text-[11px] cursor-pointer transition">
                        تذكرة
                      </button>
                      <button type="button" onclick="window.App.openDeliveryNoteModal ? window.App.openDeliveryNoteModal(${s.id}) : window.GherbiPrintStudioV45.printMasterDocumentBySaleId('delivery_note', ${s.id})" class="px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-600 text-teal-700 hover:text-white font-black text-[11px] cursor-pointer transition">
                        توصيل BL
                      </button>
                      <button type="button" onclick="window.App.openCreditNoteModal ? window.App.openCreditNoteModal(${s.id}) : null" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-600 hover:text-white font-black text-[11px] cursor-pointer transition">
                        إشعار دائن
                      </button>
                      <button type="button" onclick="window.GherbiSalesControllerV55.confirmDeleteSale(${s.id})" class="p-1 rounded-lg text-rose-500 hover:bg-rose-500 hover:text-white cursor-pointer transition" title="حذف الفاتورة">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join('');
        }

        const pagerEl = document.getElementById('v55SalesPaginationBar');
        if (pagerEl) {
          pagerEl.innerHTML = `
            <div class="text-xs font-bold text-slate-500">
              عرض <strong>${pageItems.length}</strong> من أصل <strong>${list.length}</strong> فاتورة (صفحة ${SalesState.currentPage} من ${totalPages})
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" ${SalesState.currentPage <= 1 ? 'disabled' : ''} onclick="window.GherbiSalesControllerV55.goToPage(${SalesState.currentPage - 1})" class="px-3 py-1 rounded-lg border bg-white dark:bg-slate-800 text-xs font-black disabled:opacity-40 cursor-pointer">السابق</button>
              <button type="button" ${SalesState.currentPage >= totalPages ? 'disabled' : ''} onclick="window.GherbiSalesControllerV55.goToPage(${SalesState.currentPage + 1})" class="px-3 py-1 rounded-lg border bg-white dark:bg-slate-800 text-xs font-black disabled:opacity-40 cursor-pointer">التالي</button>
            </div>
          `;
        }
        this.updateBulkToolbarVisibility();
      },

      goToPage(p) {
        SalesState.currentPage = Math.max(1, Number(p || 1));
        this.filterAndRenderTableOnly();
      },

      // نافذة التعديل السريع للفاتورة أو استدعاؤها إلى الكاشير
      async openFastEditSaleModal(saleId) {
        const det = await FastCache.getSaleDetailsFast(saleId, true);
        if (!det) return;
        const customers = await FastCache.getCustomersFast(false);

        let modal = document.getElementById('v55FastEditSaleModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'v55FastEditSaleModal';
          modal.className = 'fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[29200] flex items-center justify-center p-4';
          document.body.appendChild(modal);
        }

        const totalVal = Number(det.total || 0);
        const paidVal = Number(det.paid_amount ?? totalVal);
        const remDebt = Math.max(0, Number((totalVal - paidVal).toFixed(2)));

        modal.innerHTML = `
          <div class="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-right" dir="rtl">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 class="text-base font-black text-slate-900 dark:text-white">✏️ تعديل الفاتورة رقم #${det.id} (${det.doc_number || ''})</h3>
              <button type="button" onclick="document.getElementById('v55FastEditSaleModal').classList.add('hidden')" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-black mb-1">👤 الزبون المرتبط بالفاتورة:</label>
                <select id="v55EditSaleCustSelect" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-black">
                  <option value="">🚶 زبون عابر (Comptoir)</option>
                  ${customers.map((c) => `<option value="${c.id}" ${Number(det.customer_id) === Number(c.id) ? 'selected' : ''}>👑 ${c.name} (${c.phone || ''})</option>`).join('')}
                </select>
              </div>

              ${
                remDebt > 0.009
                  ? `<div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 space-y-2">
                      <div class="font-black text-emerald-800 dark:text-emerald-300">💵 تسديد المتبقي من دين هذه الفاتورة (${remDebt.toFixed(2)} د.ج):</div>
                      <div class="flex gap-2">
                        <input id="v55EditSalePayDebtInp" type="number" step="any" value="${remDebt}" class="flex-1 px-3 py-1.5 rounded-lg border font-mono font-black text-center">
                        <button type="button" onclick="window.GherbiSalesControllerV55.payRemainingSaleDebtNow(${det.id})" class="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-black cursor-pointer">تسديد الآن</button>
                      </div>
                    </div>`
                  : '<div class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 font-black text-center">✅ هذه الفاتورة مسددة بالكامل</div>'
              }

              ${
                typeof window.App.editSaleInPos === 'function'
                  ? `<div class="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button type="button" onclick="document.getElementById('v55FastEditSaleModal').classList.add('hidden'); window.App.editSaleInPos(${det.id});" class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow cursor-pointer">
                        🛒 استرجاع أصناف الفاتورة إلى سلة الكاشير لتعديل السلع والكميات
                      </button>
                    </div>`
                  : ''
              }
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="document.getElementById('v55FastEditSaleModal').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-black">إغلاق</button>
              <button type="button" onclick="window.GherbiSalesControllerV55.saveFastEditSaleCustomer(${det.id})" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow cursor-pointer">حفظ الزبون</button>
            </div>
          </div>
        `;
        modal.classList.remove('hidden');
      },

      async saveFastEditSaleCustomer(saleId) {
        const custVal = document.getElementById('v55EditSaleCustSelect')?.value;
        document.getElementById('v55FastEditSaleModal')?.classList.add('hidden');
        try {
          if (typeof window.App.assignSaleCustomer === 'function') {
            await window.App.assignSaleCustomer(saleId, custVal ? Number(custVal) : '');
          }
        } catch (_) {}
        FastCache.invalidate(saleId);
        await FastCache.getSalesFast(true);
        this.filterAndRenderTableOnly();
      },

      async payRemainingSaleDebtNow(saleId) {
        const amt = Number(document.getElementById('v55EditSalePayDebtInp')?.value || 0);
        if (amt <= 0) return;
        document.getElementById('v55FastEditSaleModal')?.classList.add('hidden');
        try {
          if (window.api?.addSalePayment) {
            await window.api.addSalePayment(Number(saleId), amt, new Date().toISOString(), { payment_method: 'cash' });
            if (window.showToast) window.showToast('✅ تم تسديد الدفعة وتحديث الفاتورة بنجاح!', 'success');
          }
        } catch (err) {
          if (window.showToast) window.showToast(err.message || 'تعذر تسجيل الدفعة', 'error');
        }
        FastCache.invalidate(saleId);
        await FastCache.getSalesFast(true);
        this.filterAndRenderTableOnly();
      },

      async openQuickCustomerAssignModal(saleId, currentCustomerId) {
        const customers = await FastCache.getCustomersFast(false);
        let modal = document.getElementById('v55QuickAssignCustomerModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'v55QuickAssignCustomerModal';
          modal.className = 'fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[29000] flex items-center justify-center p-4';
          document.body.appendChild(modal);
        }

        modal.innerHTML = `
          <div class="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl text-right" dir="rtl">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <h3 class="text-base font-black text-slate-900 dark:text-white">👤 ربط الفاتورة #${saleId} بزبون</h3>
              <button type="button" onclick="document.getElementById('v55QuickAssignCustomerModal').classList.add('hidden')" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
            </div>
            <div class="space-y-2 text-xs">
              <label class="block font-black text-slate-600 dark:text-slate-300">اختر الزبون لربط الفاتورة وحساب نقاط الوفاء:</label>
              <select id="v55QuickAssignCustSelect" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-black">
                <option value="">🚶 زبون عابر (Comptoir — بدون بطاقة وفاء)</option>
                ${customers
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${Number(currentCustomerId) === Number(c.id) ? 'selected' : ''}>👑 ${c.name} (${c.phone || 'بدون هاتف'} — ⭐ ${Number(c.loyalty_points || 0)} نقطة)</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" onclick="document.getElementById('v55QuickAssignCustomerModal').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-black">إلغاء</button>
              <button type="button" onclick="window.GherbiSalesControllerV55.confirmQuickCustomerAssign(${saleId})" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow cursor-pointer">حفظ وتحديث الفاتورة</button>
            </div>
          </div>
        `;
        modal.classList.remove('hidden');
      },

      async confirmQuickCustomerAssign(saleId) {
        const selVal = document.getElementById('v55QuickAssignCustSelect')?.value;
        const newCustId = selVal ? Number(selVal) : null;
        document.getElementById('v55QuickAssignCustomerModal')?.classList.add('hidden');

        try {
          if (typeof window.App.assignSaleCustomer === 'function') {
            await window.App.assignSaleCustomer(saleId, newCustId || '');
          }
        } catch (_) {}

        FastCache.invalidate(saleId);
        await FastCache.getSalesFast(true);
        await FastCache.getCustomersFast(true);
        this.filterAndRenderTableOnly();
      },

      async confirmDeleteSale(saleId) {
        if (typeof window.App.deleteSale === 'function') {
          await window.App.deleteSale(saleId);
          FastCache.invalidate(saleId);
          await FastCache.getSalesFast(true);
          this.filterAndRenderTableOnly();
        }
      },

      // الفحص الخامس: تصدير وطباعة كشف سجل المبيعات المفلتر كملف PDF رسمي (A4)
      async exportFilteredSalesReportPdf(asDirectPdfFile = true) {
        const list = SalesState.filteredSales && SalesState.filteredSales.length > 0 ? SalesState.filteredSales : this.computeFilteredSales();
        const shop = studio.getShopIdentity();
        const primaryColor = '#1d4ed8';

        const totalRev = list.reduce((s, r) => s + Number(r.total || 0), 0);
        const totalPaid = list.reduce((s, r) => s + Number(r.paid_amount ?? r.total ?? 0), 0);
        const totalDebt = list.reduce((s, r) => s + Math.max(0, Number(r.total || 0) - Number(r.paid_amount ?? r.total ?? 0)), 0);

        const rowsHtml = list
          .map((s, idx) => {
            const tot = Number(s.total || 0);
            const paid = Number(s.paid_amount ?? tot);
            const rem = Math.max(0, Number((tot - paid).toFixed(2)));
            return `
              <tr style="background:${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;font-family:monospace;">${idx + 1}</td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:right;font-family:monospace;font-weight:900;"><bdi>${s.doc_number || ('#' + s.id)}</bdi></td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:right;font-family:monospace;font-size:10.5px;"><bdi>${String(s.sale_date || '').replace('T', ' ').slice(0, 16)}</bdi></td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:right;font-weight:800;">${s.customer_name || 'زبون عابر'}</td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:center;">${s.payment_method || 'cash'}</td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:right;font-family:monospace;font-weight:900;">${tot.toFixed(2)} د.ج</td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:right;font-family:monospace;color:#047857;">${paid.toFixed(2)}</td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:right;font-family:monospace;color:${rem > 0 ? '#be123c' : '#64748b'};font-weight:900;">${rem.toFixed(2)}</td>
              </tr>
            `;
          })
          .join('');

        const reportHtml = `<!DOCTYPE html><html lang="ar" dir="rtl" data-v49-adopted-master="1" data-v52-adopted-master="1" data-paper-size="a4"><head><meta charset="UTF-8"><style>
          @page { size: A4 portrait; margin: 8mm; }
          * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', Tahoma, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; font-size: 11.5px; direction: rtl; text-align: right; }
        </style></head><body>
          <div class="v45-live-paper" style="width:100%;padding:4mm;direction:rtl;text-align:right;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${primaryColor};padding-bottom:8px;margin-bottom:10px;">
              <div>
                <div style="font-size:20px;font-weight:900;color:${primaryColor};">${shop.name}</div>
                <div style="font-size:12px;font-weight:700;color:#475569;">${shop.desc} — ${shop.address}</div>
                <div style="font-size:11px;color:#334155;">هاتف: <bdi style="font-family:monospace;">${shop.phone}</bdi></div>
              </div>
              <div style="text-align:right;font-family:monospace;font-size:10.5px;background:#f8fafc;border:1px solid #cbd5e1;padding:6px 10px;border-radius:8px;">
                <div><strong>تاريخ استخراج الكشف:</strong> <bdi>${new Date().toISOString().replace('T', ' ').slice(0, 16)}</bdi></div>
                <div><strong>عدد الفواتير المدرجة:</strong> ${list.length} فاتورة</div>
              </div>
            </div>

            <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:10px;padding:8px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
              <div style="font-size:15px;font-weight:900;color:${primaryColor};">📊 كشف وسجل المبيعات التفصيلي (Rapport des Ventes)</div>
              <div style="font-size:11px;font-weight:800;color:#334155;">
                ${SalesState.dateFrom || SalesState.dateTo ? `الفترة: من ${SalesState.dateFrom || 'البداية'} إلى ${SalesState.dateTo || 'اليوم'}` : 'الفترة: جميع المبيعات المسجلة'}
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:12px;">
              <div style="border:1.5px solid ${primaryColor};border-radius:8px;padding:8px;background:#f8fafc;">
                <div style="font-size:10.5px;font-weight:800;color:#475569;">إجمالي المبيعات (TTC):</div>
                <div style="font-size:15px;font-weight:900;font-family:monospace;color:${primaryColor};">${studio.fmtDzd(totalRev)}</div>
                <div style="font-size:10px;font-weight:800;color:#b45309;">🇩🇿 ${studio.fmtCentimes(totalRev)}</div>
              </div>
              <div style="border:1.5px solid #047857;border-radius:8px;padding:8px;background:#ecfdf5;">
                <div style="font-size:10.5px;font-weight:800;color:#065f46;">إجمالي المقبوض:</div>
                <div style="font-size:15px;font-weight:900;font-family:monospace;color:#047857;">${studio.fmtDzd(totalPaid)}</div>
              </div>
              <div style="border:1.5px solid #be123c;border-radius:8px;padding:8px;background:#fff1f2;">
                <div style="font-size:10.5px;font-weight:800;color:#9f1239;">إجمالي الباقي (الديون):</div>
                <div style="font-size:15px;font-weight:900;font-family:monospace;color:#be123c;">${studio.fmtDzd(totalDebt)}</div>
              </div>
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:11px;direction:rtl;text-align:right;">
              <thead>
                <tr style="background:${primaryColor};color:#ffffff;font-weight:900;">
                  <th style="padding:6px;border:1px solid ${primaryColor};width:32px;text-align:center;">#</th>
                  <th style="padding:6px;border:1px solid ${primaryColor};text-align:right;">رقم الفاتورة</th>
                  <th style="padding:6px;border:1px solid ${primaryColor};text-align:right;">التاريخ</th>
                  <th style="padding:6px;border:1px solid ${primaryColor};text-align:right;">الزبون</th>
                  <th style="padding:6px;border:1px solid ${primaryColor};text-align:center;">طريقة الدفع</th>
                  <th style="padding:6px;border:1px solid ${primaryColor};text-align:right;">الإجمالي</th>
                  <th style="padding:6px;border:1px solid ${primaryColor};text-align:right;">المدفوع</th>
                  <th style="padding:6px;border:1px solid ${primaryColor};text-align:right;">الباقي</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </body></html>`;

        await window.api?.printSilent?.({
          html: reportHtml,
          silent: false,
          paperSize: 'a4',
          exportAsPdfFile: Boolean(asDirectPdfFile),
          defaultPdfName: `Sales_Report_A4_${new Date().toISOString().slice(0, 10)}.pdf`
        });
      },

      async renderFullSalesView(forceRefreshData = true) {
        const root = document.getElementById('sales-view-root');
        if (!root) return;

        if (forceRefreshData) {
          await FastCache.getSalesFast(true);
        } else if (FastCache.sales.length === 0) {
          await FastCache.getSalesFast(false);
        }
        const customers = await FastCache.getCustomersFast(false);

        root.innerHTML = `
          <div id="v55SalesMasterWrapper" data-v55-sales-master="1" data-v54-turbo-sales="1" class="space-y-4 text-right pb-6" dir="rtl">
            <!-- الرأس العلوي + الفحص الخامس (تصدير Excel + تصدير PDF + طباعة الكشف + مركز الطباعة) -->
            <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
                <div>
                  <h2 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>سجل المبيعات، تعديل الفواتير، وفاحص الضمان (${(FastCache.sales || []).length})</span>
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[11px] font-black">⚡ V55 Turbo</span>
                  </h2>
                  <p class="text-xs text-slate-500 mt-0.5">تعديل الفواتير، فحص صلاحية الضمان برقم IMEI/Serial، طباعة وصولات التوصيل، وإشعارات الدائن، وتصدير Excel / PDF</p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" onclick="window.App.exportSalesExcel ? window.App.exportSalesExcel() : null" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition">
                    <span>⬇️ تصدير Excel</span>
                  </button>
                  <button type="button" onclick="window.GherbiSalesControllerV55.exportFilteredSalesReportPdf(true)" class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition">
                    <span>📄 تصدير PDF</span>
                  </button>
                  <button type="button" onclick="window.GherbiSalesControllerV55.exportFilteredSalesReportPdf(false)" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition">
                    <span>🖨️ طباعة الكشف A4</span>
                  </button>
                  <button type="button" onclick="window.App.openDocumentInPrintStudio('invoice_a4', 'SAMPLE')" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition">
                    <span>🎨 مركز الطباعة والقوالب</span>
                  </button>
                </div>
              </div>

              <!-- شريط البحث والتصفية الفوري الشامل -->
              <div class="grid grid-cols-1 md:grid-cols-6 gap-2.5 text-xs">
                <div class="md:col-span-2">
                  <input id="v55SalesSearchInp" type="text" value="${SalesState.searchQuery}"
                         oninput="window.GherbiSalesStateV55.searchQuery = this.value; window.GherbiSalesStateV55.currentPage = 1; window.GherbiSalesControllerV55.filterAndRenderTableOnly();"
                         placeholder="🔎 ابحث فوراً برقم الفاتورة (88)، اسم الزبون، الهاتف، المبلغ..."
                         class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold focus:border-blue-500 outline-none">
                </div>

                <div>
                  <select onchange="window.GherbiSalesStateV55.customerFilter = this.value; window.GherbiSalesStateV55.currentPage = 1; window.GherbiSalesControllerV55.filterAndRenderTableOnly();"
                          class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black cursor-pointer">
                    <option value="ALL" ${SalesState.customerFilter === 'ALL' ? 'selected' : ''}>👥 جميع الزبائن</option>
                    <option value="VIP_ONLY" ${SalesState.customerFilter === 'VIP_ONLY' ? 'selected' : ''}>👑 الزبائن الأوفياء فقط (VIP)</option>
                    <option value="WALKIN_ONLY" ${SalesState.customerFilter === 'WALKIN_ONLY' ? 'selected' : ''}>🚶 الزبائن العابرين فقط</option>
                    ${customers.map((c) => `<option value="${c.id}" ${String(SalesState.customerFilter) === String(c.id) ? 'selected' : ''}>👤 ${c.name}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <select onchange="window.GherbiSalesStateV55.statusFilter = this.value; window.GherbiSalesStateV55.currentPage = 1; window.GherbiSalesControllerV55.filterAndRenderTableOnly();"
                          class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black cursor-pointer">
                    <option value="ALL" ${SalesState.statusFilter === 'ALL' ? 'selected' : ''}>📌 جميع الحالات</option>
                    <option value="PAID" ${SalesState.statusFilter === 'PAID' ? 'selected' : ''}>✅ مسددة بالكامل</option>
                    <option value="DEBT" ${SalesState.statusFilter === 'DEBT' ? 'selected' : ''}>⏳ غير مسددة (بها دين)</option>
                    <option value="CREDIT_NOTE" ${SalesState.statusFilter === 'CREDIT_NOTE' ? 'selected' : ''}>↩️ بها إشعار دائن (Avoir)</option>
                  </select>
                </div>

                <div>
                  <select onchange="window.GherbiSalesStateV55.methodFilter = this.value; window.GherbiSalesStateV55.currentPage = 1; window.GherbiSalesControllerV55.filterAndRenderTableOnly();"
                          class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black cursor-pointer">
                    <option value="ALL" ${SalesState.methodFilter === 'ALL' ? 'selected' : ''}>💳 جميع طرق الدفع</option>
                    <option value="cash" ${SalesState.methodFilter === 'cash' ? 'selected' : ''}>💵 نقداً (Cash)</option>
                    <option value="credit" ${SalesState.methodFilter === 'credit' ? 'selected' : ''}>📝 آجل / دين</option>
                    <option value="cib" ${SalesState.methodFilter === 'cib' ? 'selected' : ''}>💳 بطاقة CIB / ذهبية</option>
                    <option value="baridimob" ${SalesState.methodFilter === 'baridimob' ? 'selected' : ''}>📱 بريدي موب</option>
                    <option value="installment" ${SalesState.methodFilter === 'installment' ? 'selected' : ''}>🗓️ بيع بالتقسيط</option>
                  </select>
                </div>

                <div class="flex items-center gap-1.5">
                  <button type="button" onclick="window.GherbiSalesControllerV55.filterAndRenderTableOnly()" class="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black cursor-pointer transition">
                    تصفية
                  </button>
                  <button type="button" onclick="window.GherbiSalesControllerV55.resetAllFilters()" class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white font-black cursor-pointer transition" title="إعادة ضبط الفلاتر">
                    ↺
                  </button>
                </div>
              </div>

              <!-- شريط التاريخ وأزرار الفترات السريعة -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-black text-slate-500">📅 الفترة الزمنية:</span>
                  <button type="button" onclick="window.GherbiSalesControllerV55.applyQuickDatePreset('ALL')" class="px-3 py-1 rounded-lg font-black cursor-pointer ${SalesState.quickDatePreset === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">الكل</button>
                  <button type="button" onclick="window.GherbiSalesControllerV55.applyQuickDatePreset('TODAY')" class="px-3 py-1 rounded-lg font-black cursor-pointer ${SalesState.quickDatePreset === 'TODAY' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">اليوم</button>
                  <button type="button" onclick="window.GherbiSalesControllerV55.applyQuickDatePreset('YESTERDAY')" class="px-3 py-1 rounded-lg font-black cursor-pointer ${SalesState.quickDatePreset === 'YESTERDAY' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">أمس</button>
                  <button type="button" onclick="window.GherbiSalesControllerV55.applyQuickDatePreset('WEEK')" class="px-3 py-1 rounded-lg font-black cursor-pointer ${SalesState.quickDatePreset === 'WEEK' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">آخر 7 أيام</button>
                  <button type="button" onclick="window.GherbiSalesControllerV55.applyQuickDatePreset('MONTH')" class="px-3 py-1 rounded-lg font-black cursor-pointer ${SalesState.quickDatePreset === 'MONTH' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">هذا الشهر</button>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-bold text-slate-500">من تاريخ:</span>
                  <input id="v55SalesDateFrom" type="date" value="${SalesState.dateFrom}"
                         onchange="window.GherbiSalesStateV55.dateFrom = this.value; window.GherbiSalesStateV55.quickDatePreset = 'CUSTOM'; window.GherbiSalesControllerV55.filterAndRenderTableOnly();"
                         class="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono">
                  <span class="font-bold text-slate-500">إلى تاريخ:</span>
                  <input id="v55SalesDateTo" type="date" value="${SalesState.dateTo}"
                         onchange="window.GherbiSalesStateV55.dateTo = this.value; window.GherbiSalesStateV55.quickDatePreset = 'CUSTOM'; window.GherbiSalesControllerV55.filterAndRenderTableOnly();"
                         class="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono">
                </div>
              </div>
            </div>

            <!-- شريط الإجراءات الجماعية عند تحديد عدة فواتير -->
            <div id="v55BulkActionsBar" class="hidden rounded-2xl bg-slate-900 text-white p-3 flex flex-wrap items-center justify-between gap-2 shadow-lg">
              <div class="text-xs font-black">
                ✅ تم تحديد (<span id="v55BulkCountText" class="text-amber-400 font-mono">0</span>) فاتورة:
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiSalesControllerV55.bulkPrintSelected('invoice_a4')" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs cursor-pointer">🖨️ طباعة المحدد (A4)</button>
                <button type="button" onclick="window.GherbiSalesControllerV55.bulkPrintSelected('receipt_thermal')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer">🧾 طباعة المحدد (80mm)</button>
                <button type="button" onclick="window.GherbiSalesStateV55.selectedSaleIds.clear(); window.GherbiSalesControllerV55.filterAndRenderTableOnly();" class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer">إلغاء التحديد</button>
              </div>
            </div>

            <!-- شريط فاحص الضمان السريع بالأرقام التسلسلية -->
            <div class="rounded-2xl bg-indigo-50/70 dark:bg-slate-800/90 border border-indigo-200 dark:border-indigo-900/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">🛡️</div>
                <div>
                  <div class="text-xs font-black text-indigo-950 dark:text-indigo-200">فاحص الضمان الفوري بالأرقام التسلسلية (IMEI / Serial Warranty Checker)</div>
                  <div class="text-[11px] text-slate-500">امسح أو أدخل رقم IMEI / S-N للتحقق الفوري من فاتورة الشراء وصلاحية الضمان وطباعة شهادة الضمان</div>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-1 max-w-md">
                <input id="warrantySerialSearchInput" type="text" placeholder="أدخل أو امسح رقم IMEI / S/N هنا..."
                       onkeydown="if(event.key==='Enter' && window.App.checkWarrantyBySerial) window.App.checkWarrantyBySerial(this.value)"
                       class="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-xs font-mono font-bold">
                <button type="button" onclick="if(window.App.checkWarrantyBySerial) window.App.checkWarrantyBySerial(document.getElementById('warrantySerialSearchInput').value)"
                        class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer">
                  فحص الضمان
                </button>
              </div>
            </div>

            <!-- شريط المؤشرات المالية الحية للفواتير المفلترة -->
            <div id="v55SalesLiveKpiStrip" class="grid grid-cols-1 md:grid-cols-4 gap-3"></div>

            <!-- جدول المبيعات فائق السرعة -->
            <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full text-right border-collapse">
                  <thead class="bg-slate-50 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 text-xs font-black border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th class="py-3 px-2.5 text-center w-9">
                        <input type="checkbox" onchange="window.GherbiSalesControllerV55.toggleSelectAllOnPage(this.checked)" class="w-4 h-4 accent-blue-600 rounded cursor-pointer">
                      </th>
                      <th class="py-3 px-3">رقم الفاتورة</th>
                      <th class="py-3 px-3">التاريخ</th>
                      <th class="py-3 px-3">الزبون</th>
                      <th class="py-3 px-3">طريقة الدفع</th>
                      <th class="py-3 px-3">الإجمالي</th>
                      <th class="py-3 px-3">المدفوع</th>
                      <th class="py-3 px-3">الباقي</th>
                      <th class="py-3 px-3 text-center">إشعار دائن</th>
                      <th class="py-3 px-3 text-left">إجراءات المستندات</th>
                    </tr>
                  </thead>
                  <tbody id="v55SalesTableBody"></tbody>
                </table>
              </div>
              <div id="v55SalesPaginationBar" class="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between"></div>
            </div>
          </div>
        `;

        this.filterAndRenderTableOnly();
      }
    };

    window.GherbiSalesControllerV55 = SalesMasterController;
    window.GherbiSalesControllerV54 = SalesMasterController;

    // 4. السيطرة الكاملة على جميع دوال فتح ورسم صفحة سجل المبيعات في window.App
    const salesMethodNames = [
      'renderSales',
      'loadSales',
      'loadSalesView',
      'renderSalesView',
      'loadSalesHistory',
      'renderSalesHistory',
      'filterSales',
      'filterSalesTable',
      'applySalesFilter',
      'refreshSalesView'
    ];
    for (const fnName of salesMethodNames) {
      window.App[fnName] = async function () {
        await SalesMasterController.renderFullSalesView(true);
      };
    }

    // اعتراض App.switchView('sales') مباشرةً
    if (typeof window.App.switchView === 'function' && !window.App._v55SalesSwitchHooked) {
      const origSwitchView = window.App.switchView.bind(window.App);
      window.App._v55SalesSwitchHooked = true;
      window.App.switchView = async function (viewName, ...rest) {
        const res = await origSwitchView(viewName, ...rest);
        if (viewName === 'sales') {
          await SalesMasterController.renderFullSalesView(true);
        }
        return res;
      };
    }

    // حارس DOM خفيف يضمن أنه لو قام أي كود قديم برسم الواجهة القديمة داخل #sales-view-root يتم استبدالها فوراً!
    setInterval(() => {
      const viewSales = document.getElementById('view-sales');
      const salesRoot = document.getElementById('sales-view-root');
      if (viewSales && viewSales.classList.contains('active') && salesRoot) {
        if (!salesRoot.querySelector('#v55SalesMasterWrapper')) {
          SalesMasterController.renderFullSalesView(false);
        }
      }
    }, 250);

    // إذا كانت صفحة سجل المبيعات مفتوحة الآن، نحدّثها فوراً
    if (document.getElementById('view-sales')?.classList.contains('active')) {
      SalesMasterController.renderFullSalesView(true);
    }

    console.log('🏆 [Gherbi V55 Stage 2]: تم إحلال وتفعيل صفحة سجل المبيعات الشاملة (تصفية فورية + تصدير PDF + تحديد متعدد + ألوان وتفاصيل) بنجاح 100%!');
  }, 140);
})();

/* ==================== [V55 STAGE 3: STRICT ARABIC RTL & 80MM DIMENSION LOCK] ==================== */
(function initV55Stage3ArabicRtlAnd80mmLock() {
  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.App) return;
    clearInterval(waitStudio);

    // 1. دالة تنظيف وإحاطة النصوص المختلطة (عربي + إنجليزي + أقواس) بـ <bdi> لمنع انعكاسها في PDF
    studio.fixArabicBidiHtml = function (rawHtml, lang = 'ar') {
      if (!rawHtml || lang !== 'ar') return rawHtml;
      let fixed = String(rawHtml);

      // أ) ضمان أن الورقة نفسها تحمل dir="rtl" ومحاذاة لليمين
      fixed = fixed.replace(
        /class="v45-live-paper([^"]*)"/g,
        'dir="rtl" class="v45-live-paper$1" style="direction:rtl;text-align:right;"'
      );

      // ب) إصلاح انعكاس "N°: 83" في الترويسة إلى "رقم: #83" بمحاذاة عربية سليمة
      fixed = fixed.replace(/<span>N°:\s*<strong/g, '<span>رقم المستند: <strong dir="ltr"');

      // ج) في الفاتورة العربية (A4/A5)، جعل صندوق بيانات الدفع والسجل التجاري للزبون محاذياً لليمين بدلاً من اليسار
      fixed = fixed.replace(/text-align:left;font-family:monospace;font-size:10\.5px;/g, 'text-align:right;font-family:monospace;font-size:10.5px;direction:rtl;');
      fixed = fixed.replace(/text-align:left;font-size:10px;font-family:monospace;/g, 'text-align:right;font-size:10px;font-family:monospace;direction:rtl;');

      return fixed;
    };

    // 2. ترقية buildLiveDocumentPaperHtml لتطبيق المحاذاة العربية لليمين وعزل <bdi> على أسماء السلع
    const origBuildPaper = studio.buildLiveDocumentPaperHtml.bind(studio);
    studio.buildLiveDocumentPaperHtml = function (docData, forPrintOutput = false, customOverrides = null) {
      const cfg = customOverrides ? { ...this.config, ...customOverrides } : this.config;
      const effectiveLang = cfg.lang || 'ar';

      // إذا كانت اللغة عربية، نحيط أسماء السلع التي تحتوي على أقواس أو حروف لاتينية بـ <bdi> حتى لا تنعكس في PDF
      let safeDocData = docData;
      if (docData && Array.isArray(docData.items) && effectiveLang === 'ar' && forPrintOutput) {
        safeDocData = {
          ...docData,
          items: docData.items.map((it) => ({
            ...it,
            name: `<bdi dir="rtl" style="unicode-bidi:isolate;">${it.name || ''}</bdi>`
          }))
        };
      }

      const rawPaper = origBuildPaper(safeDocData, forPrintOutput, customOverrides);
      return this.fixArabicBidiHtml(rawPaper, effectiveLang);
    };

    // 3. غلاف HTML صارم يضبط مقاس 80mm / 58mm الحقيقي ويمنع تمدد التذكرة إلى A4، ويضبط اتجاه الصفحة (RTL للعربية)
    studio.wrapPaperBodyWithStrictPageCss = function (paperBodyHtml, paperSize, fontFamily, itemsCount = 3, lang = 'ar') {
      const pSize = paperSize || this.config.paperSize || '80mm';
      const is58 = pSize === '58mm';
      const is80 = pSize === '80mm';
      const isThermal = is80 || is58;
      const thermalMm = is58 ? 58 : 80;
      const innerMm = is58 ? 53 : 74;
      const estHeightMm = Math.max(130, 95 + Math.max(1, Number(itemsCount || 1)) * 14 + 45);
      const dirAttr = lang === 'fr' || lang === 'en' ? 'ltr' : 'rtl';
      const alignVal = dirAttr === 'rtl' ? 'right' : 'left';

      const pageCss = isThermal
        ? `@page { size: ${thermalMm}mm ${estHeightMm}mm !important; margin: 0mm !important; }`
        : pSize === '2xa5'
        ? `@page { size: A4 landscape; margin: 6mm; }`
        : pSize === 'a5'
        ? `@page { size: A5 portrait; margin: 6mm; }`
        : `@page { size: A4 portrait; margin: 8mm; }`;

      const containerCss = isThermal
        ? `
          html, body {
            width: ${thermalMm}mm !important;
            max-width: ${thermalMm}mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            direction: ${dirAttr} !important;
            text-align: ${alignVal} !important;
            overflow-x: hidden !important;
          }
          .v45-live-paper {
            width: ${innerMm}mm !important;
            max-width: ${innerMm}mm !important;
            min-height: auto !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            box-shadow: none !important;
            border: none !important;
            direction: ${dirAttr} !important;
            text-align: ${alignVal} !important;
          }
        `
        : `
          html, body {
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
            direction: ${dirAttr} !important;
            text-align: ${alignVal} !important;
          }
          .v45-live-paper {
            width: 100% !important;
            min-height: auto !important;
            margin: 0 auto !important;
            padding: 5mm !important;
            box-shadow: none !important;
            direction: ${dirAttr} !important;
            text-align: ${alignVal} !important;
          }
        `;

      return `<!DOCTYPE html><html lang="${lang}" dir="${dirAttr}" data-v49-adopted-master="1" data-v52-adopted-master="1" data-paper-size="${pSize}"><head><meta charset="UTF-8"><style>
        ${pageCss}
        * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: '${fontFamily || 'Cairo'}', 'Cairo', Tahoma, sans-serif; color: #0f172a; }
        ${containerCss}
        table { width: 100% !important; border-collapse: collapse !important; direction: ${dirAttr} !important; text-align: ${alignVal} !important; }
        th, td { unicode-bidi: isolate !important; }
        bdi { unicode-bidi: isolate !important; }
        .v45-canvas-layer { border: none !important; box-shadow: none !important; margin-bottom: 5px !important; }
        .v45-layer-handle-bar { display: none !important; }
      </style></head><body>${this.fixArabicBidiHtml(paperBodyHtml, lang)}</body></html>`;
    };

    // 4. ربط printCurrentCanvasNow في مركز الطباعة بالغلاف الصارم الجديد
    studio.printCurrentCanvasNow = async function (exportAsPdf = false) {
      const livePaperEl = document.querySelector('#v45LivePaperHost .v45-live-paper');
      let bodyContent = '';
      let itemsCount = 3;

      if (livePaperEl) {
        const clone = livePaperEl.cloneNode(true);
        clone.querySelectorAll('.v45-layer-handle-bar').forEach((el) => el.remove());
        clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
        clone.style.transform = 'none';
        itemsCount = clone.querySelectorAll('tbody tr').length || 3;
        bodyContent = clone.outerHTML;
      } else {
        const docData = await this.resolveActiveDocumentData();
        itemsCount = docData && Array.isArray(docData.items) ? docData.items.length : 3;
        bodyContent = this.buildLiveDocumentPaperHtml(docData, true);
      }

      const pSize = this.config.paperSize || '80mm';
      const html = this.wrapPaperBodyWithStrictPageCss(
        bodyContent,
        pSize,
        this.config.fontFamily || 'Cairo',
        itemsCount,
        this.config.lang || 'ar'
      );

      await window.api?.printSilent?.({
        html,
        silent: false,
        paperSize: pSize,
        widthMm: pSize === '58mm' ? 58 : pSize === '80mm' ? 80 : undefined,
        exportAsPdfFile: Boolean(exportAsPdf),
        defaultPdfName: `Ticket_${pSize}_${Date.now()}.pdf`
      });
    };

    // 5. ربط generateAdoptedHtmlForDocument بالغلاف الصارم الجديد
    const prevGenAdopted = studio.generateAdoptedHtmlForDocument.bind(studio);
    studio.generateAdoptedHtmlForDocument = async function (docTypeKey, saleOrRecordId, rawSaleObj, modalOverrides = null) {
      const rawHtml = await prevGenAdopted(docTypeKey, saleOrRecordId, rawSaleObj, modalOverrides);
      if (!rawHtml) return rawHtml;

      let targetDocType = docTypeKey || 'receipt_thermal';
      if (targetDocType === 'receipt' || targetDocType === '80mm' || targetDocType === '58mm' || targetDocType === 'thermal') {
        targetDocType = 'receipt_thermal';
      }
      const defInfo = this.config.defaultsByDocType[targetDocType] || {};
      const savedProfile = this.config.adoptedProfiles[targetDocType] || {};
      const effectivePaperSize =
        (modalOverrides && modalOverrides.paperSize) ||
        (this.config.activeDocType === targetDocType && !modalOverrides ? this.config.paperSize : null) ||
        defInfo.paperSize ||
        savedProfile.paperSize ||
        (targetDocType === 'receipt_thermal' ? '80mm' : 'a4');

      const effectiveLang = (modalOverrides && modalOverrides.lang) || defInfo.lang || this.config.lang || 'ar';

      const bodyMatch = rawHtml.match(/<body>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        const trMatches = bodyMatch[1].match(/<tr/gi);
        const itemsCount = trMatches ? Math.max(1, trMatches.length - 1) : 3;
        return this.wrapPaperBodyWithStrictPageCss(
          bodyMatch[1],
          effectivePaperSize,
          this.config.fontFamily || 'Cairo',
          itemsCount,
          effectiveLang
        );
      }
      return rawHtml;
    };

    console.log('🏆 [Gherbi V55 Stage 3]: تم تفعيل مقاس 80mm الحراري الحقيقي ومحاذاة اللغة العربية لليمين (RTL) بنجاح 100%!');
  }, 160);
})();

/* ==================== [V56 TURBO POS ZERO-BLOCK & VIP RETAIL CREDIT SYSTEM] ==================== */
(function initV56TurboPosAndVipRetailCreditSystem() {
  // فهرس الذاكرة اللحظي O(1) لمنع أي توقف أو انتظار أثناء البيع أو البحث أو مسح الباركود
  const PosTurboEngine = {
    productsById: new Map(),
    productByBarcode: new Map(),
    productsByCategory: new Map(),
    customersById: new Map(),
    lastIndexedCount: 0,
    searchDebounceTimer: null,

    rebuildMemoryIndex() {
      const prods = window.AppState?.products || [];
      if (prods.length === 0) return;

      this.productsById.clear();
      this.productByBarcode.clear();
      this.productsByCategory.clear();

      for (let i = 0; i < prods.length; i++) {
        const p = prods[i];
        if (!p || p.hide_from_pos) continue;
        const pid = Number(p.id);
        this.productsById.set(pid, p);

        if (p.barcode) {
          this.productByBarcode.set(String(p.barcode).trim(), p);
        }
        if (p.plu_code) {
          this.productByBarcode.set(String(p.plu_code).trim(), p);
        }
        if (Array.isArray(p.extra_barcodes)) {
          for (const eb of p.extra_barcodes) {
            const bcStr = String((typeof eb === 'object' ? eb.barcode : eb) || '').trim();
            if (bcStr) this.productByBarcode.set(bcStr, p);
          }
        }
        if (Array.isArray(p.variants)) {
          for (const v of p.variants) {
            if (v && v.barcode) this.productByBarcode.set(String(v.barcode).trim(), p);
          }
        }

        const cat = String(p.category || 'عام').trim();
        if (!this.productsByCategory.has(cat)) {
          this.productsByCategory.set(cat, []);
        }
        this.productsByCategory.get(cat).push(p);
      }
      this.lastIndexedCount = prods.length;
    },

    rebuildCustomerIndex(customersList) {
      const list = customersList || window.AppState?.customers || [];
      this.customersById.clear();
      for (const c of list) {
        if (c && c.id) {
          this.customersById.set(Number(c.id), c);
        }
      }
    },

    getCustomerFast(customerId) {
      const cid = Number(customerId || 0);
      if (!cid) return null;
      if (this.customersById.has(cid)) return this.customersById.get(cid);
      const list = window.AppState?.customers || [];
      const found = list.find((c) => Number(c.id) === cid) || null;
      if (found) this.customersById.set(cid, found);
      return found;
    }
  };

  const waitReady = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.App) return;
    clearInterval(waitReady);

    window.GherbiPosTurboV56 = PosTurboEngine;

    // 1. تفعيل طبقة كشف الديون والكريدي التراكمي (debt_ledger_layer) تلقائياً في مركز الطباعة
    //    حتى تظهر دائماً في المعاينة وفي التذاكر عندما يكون للزبون الوفي كريدي!
    studio.setLayerVisibleQuiet('debt_ledger_layer', true);
    studio.setLayerVisibleQuiet('loyalty_points_layer', true);
    for (const docKey of ['receipt_thermal', 'invoice_a4', 'invoice_a5', 'invoice_2xa5', 'payment_receipt']) {
      if (studio.config.adoptedProfiles && studio.config.adoptedProfiles[docKey] && Array.isArray(studio.config.adoptedProfiles[docKey].layers)) {
        const dl = studio.config.adoptedProfiles[docKey].layers.find((l) => l.id === 'debt_ledger_layer');
        if (dl) dl.visible = true;
      }
    }
    studio.saveConfigLocal();

    // 2. ترقية enrichDocumentDataWithLoyaltyAndDebt لحساب الكريدي السابق + كريدي الفاتورة الحالية + إجمالي الكريدي الجديد بدقة 100%
    const origEnrich = studio.enrichDocumentDataWithLoyaltyAndDebt.bind(studio);
    studio.enrichDocumentDataWithLoyaltyAndDebt = function (rawDoc) {
      const d = origEnrich(rawDoc);
      const customers = window.GherbiFastCacheV55?.customers || this.liveDataRecords.customers || window.AppState?.customers || [];
      const custId = d.customerId ? Number(d.customerId) : null;
      const pName = String(d.partyName || '').trim();
      const isWalkinName = !pName || pName.includes('زبون عابر') || pName.toLowerCase().includes('comptoir');

      const matchedCust = customers.find(
        (c) =>
          (custId && Number(c.id) === custId) ||
          (!isWalkinName && pName.length > 2 && String(c.name || '').trim() === pName)
      );

      const docTotal = Number(d.total || 0);
      const docPaid = Number(d.paidAmount ?? docTotal);
      // كريدي هذه الفاتورة (الباقي غير المدفوع من فاتورة اليوم)
      const currentInvoiceCredit = Math.max(0, Number((docTotal - docPaid).toFixed(2)));
      d.remainingDebt = currentInvoiceCredit;

      if (matchedCust) {
        const totalCurrentCustDebtInDb = Math.max(0, Number(matchedCust.total_debt || 0));
        // إذا كانت الفاتورة محفوظة للتو في قاعدة البيانات، فإن total_debt يشمل بالفعل currentInvoiceCredit
        // لذا نحسب الدين السابق قبل هذه الفاتورة بدقة:
        const calcPrevDebt =
          rawDoc.previousBalance !== undefined && Number(rawDoc.previousBalance) > 0
            ? Number(rawDoc.previousBalance)
            : Math.max(0, Number((totalCurrentCustDebtInDb - currentInvoiceCredit).toFixed(2)));

        d.previousBalance = calcPrevDebt;
        d.cumulativeTotalDebt = Number((calcPrevDebt + currentInvoiceCredit).toFixed(2));
        d.creditLimitDzd = Number(matchedCust.credit_limit || 0);
      } else {
        const prevB = Number(d.previousBalance || 0);
        d.previousBalance = prevB;
        d.cumulativeTotalDebt = Number((prevB + currentInvoiceCredit).toFixed(2));
      }

      return d;
    };

    // 3. تحسين تصميم طبقة الكريدي (debt_ledger_layer) في التذكرة الحرارية 80mm وفاتورة A4
    //    لتعرض بوضوح: (الكريدي السابق | فاتورة اليوم | المدفوع اليوم | كريدي اليوم | إجمالي الكريدي المتبقي بالسنتيم)
    const origBuildPaper = studio.buildLiveDocumentPaperHtml.bind(studio);
    studio.buildLiveDocumentPaperHtml = function (docData, forPrintOutput = false, customOverrides = null) {
      let html = origBuildPaper(docData, forPrintOutput, customOverrides);
      if (!docData) return html;

      const prevDebt = Number(docData.previousBalance || 0);
      const currTotal = Number(docData.total || 0);
      const currPaid = Number(docData.paidAmount ?? currTotal);
      const currCredit = Math.max(0, Number((currTotal - currPaid).toFixed(2)));
      const totalCumulativeCredit = Number((prevDebt + currCredit).toFixed(2));

      // إذا كان الزبون عابراً وليس عليه أي دين سابق أو حالي ومخرج للطباعة، نخفي صندوق الكريدي لتبقى التذكرة رشيقة
      if (forPrintOutput && docData.isWalkinCustomer && totalCumulativeCredit <= 0.009) {
        return html;
      }

      const enhancedCreditBoxHtml = `
        <div style="border:1.5px solid ${totalCumulativeCredit > 0.009 ? '#e11d48' : '#047857'};border-radius:8px;padding:6px 8px;background:${totalCumulativeCredit > 0.009 ? '#fff1f2' : '#f0fdf4'};font-size:10px;direction:rtl;text-align:right;margin-top:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;color:${totalCumulativeCredit > 0.009 ? '#9f1239' : '#065f46'};border-bottom:1px dashed ${totalCumulativeCredit > 0.009 ? '#fda4af' : '#86efac'};padding-bottom:3px;margin-bottom:4px;">
            <span>💳 كشف حساب الكريدي للزبون (Carnet de Crédit)</span>
            <span style="font-family:monospace;font-size:9.5px;background:#ffffff;padding:0 6px;border-radius:99px;border:1px solid #cbd5e1;">
              ${currCredit > 0.009 ? '📝 بيع بالكريدي' : totalCumulativeCredit > 0.009 ? '⚖️ ذمة مدينة' : '✅ حساب خالص (0 دين)'}
            </span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;font-weight:800;color:#0f172a;">
            <div>• الكريدي السابق: <strong style="font-family:monospace;"><bdi>${this.fmtDzd(prevDebt)}</bdi></strong></div>
            <div>• فاتورة اليوم: <strong style="font-family:monospace;"><bdi>${this.fmtDzd(currTotal)}</bdi></strong></div>
            <div style="color:#047857;">• المدفوع اليوم: <strong style="font-family:monospace;"><bdi>${this.fmtDzd(currPaid)}</bdi></strong></div>
            <div style="color:${currCredit > 0.009 ? '#be123c' : '#475569'};">• كريدي اليوم: <strong style="font-family:monospace;"><bdi>${this.fmtDzd(currCredit)}</bdi></strong></div>
          </div>
          <div style="margin-top:4px;padding-top:3px;border-top:1px solid ${totalCumulativeCredit > 0.009 ? '#fecdd3' : '#bbf7d0'};display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11px;color:${totalCumulativeCredit > 0.009 ? '#be123c' : '#047857'};">
            <span>إجمالي الكريدي المتبقي:</span>
            <span style="font-family:monospace;"><bdi>${this.fmtDzd(totalCumulativeCredit)}</bdi> (${this.fmtCentimes(totalCumulativeCredit)})</span>
          </div>
        </div>
      `;

      // استبدال صندوق debt_ledger_layer التقليدي بالصندوق المفصل الجديد
      html = html.replace(
        /<div[^>]*>\s*<div[^>]*>\s*⚖️ كشف وضعية الحساب والديون للزبون[\s\S]*?<\/div>\s*<\/div>/,
        enhancedCreditBoxHtml
      );

      return html;
    };

    // ========================================================================
    // 4. تسريع شاشة المبيعات (#view-pos) وإضافة شريط "الكريدي والوفاء الحي" في السلة
    // ========================================================================
    PosTurboEngine.rebuildMemoryIndex();
    PosTurboEngine.rebuildCustomerIndex();

    // أ) تسريع البحث في الكاشير (Debounce 60ms) لمنع أي تجميد أثناء الكتابة السريعة
    if (typeof window.App.onPosSearchInput === 'function' && !window.App._v56FastSearchHooked) {
      const origSearch = window.App.onPosSearchInput.bind(window.App);
      window.App._v56FastSearchHooked = true;
      window.App.onPosSearchInput = function (val) {
        clearTimeout(PosTurboEngine.searchDebounceTimer);
        PosTurboEngine.searchDebounceTimer = setTimeout(() => {
          requestAnimationFrame(() => origSearch(val));
        }, 55);
      };
    }

    // ب) بناء وتحديث شريط الكريدي والوفاء الحي تحت اختيار الزبون في سلة المبيعات (#posCustomerSelect)
    async function renderPosCustomerVipCreditWidget() {
      const custSelect = document.getElementById('posCustomerSelect');
      if (!custSelect || !custSelect.parentElement) return;

      let widget = document.getElementById('v56PosVipCreditWidget');
      if (!widget) {
        widget = document.createElement('div');
        widget.id = 'v56PosVipCreditWidget';
        custSelect.parentElement.insertAdjacentElement('afterend', widget);
      }

      const selectedCustId = Number(custSelect.value || 0);
      if (!selectedCustId) {
        widget.innerHTML = `
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500">
            <span>🚶 <strong>زبون عابر (Comptoir)</strong> — اختر زبوناً وفياً لتفعيل الكريدي والنقاط</span>
            <button type="button" onclick="window.App.openCustomerModal()" class="text-blue-600 dark:text-blue-400 font-black hover:underline cursor-pointer">+ تسجيل زبون وفي</button>
          </div>
        `;
        return;
      }

      // جلب بيانات الزبون من الكاش السريع (أو تحديثها في الخلفية)
      let cust = PosTurboEngine.getCustomerFast(selectedCustId);
      if (!cust && window.GherbiFastCacheV55) {
        const list = await window.GherbiFastCacheV55.getCustomersFast(false);
        PosTurboEngine.rebuildCustomerIndex(list);
        cust = PosTurboEngine.getCustomerFast(selectedCustId);
      }
      if (!cust) return;

      const prevDebt = Math.max(0, Number(cust.total_debt || 0));
      const creditLimit = Number(cust.credit_limit || 0);
      const loyaltyPts = Math.max(0, Number(cust.loyalty_points || 0));
      const isBlocked = Number(cust.is_credit_blocked || 0) === 1;

      const cartTotalText = document.getElementById('cartTotalText')?.textContent || '0';
      const currentCartTotal = parseFloat(cartTotalText.replace(/[^\d.-]/g, '')) || 0;
      const projectedTotalDebt = Number((prevDebt + currentCartTotal).toFixed(2));
      const isOverLimit = creditLimit > 0 && projectedTotalDebt > creditLimit;

      widget.innerHTML = `
        <div class="v56-pos-vip-credit-bar ${prevDebt > 0.009 || isBlocked ? 'is-vip-debt' : 'is-vip-clean'} space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <div class="font-black flex items-center gap-1 truncate">
              <span>👑 ${cust.name}</span>
              ${isBlocked ? '<span class="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9.5px]">🚫 الكريدي مجمد</span>' : ''}
            </div>
            <span class="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 font-mono font-black text-[10.5px] shrink-0">
              ⭐ ${loyaltyPts} نقطة (${(loyaltyPts * 2).toFixed(0)} د.ج)
            </span>
          </div>

          <div class="grid grid-cols-2 gap-1.5 text-[10.5px] font-bold pt-1 border-t border-black/10 dark:border-white/10">
            <div>
              <span>💳 الكريدي السابق: </span>
              <strong class="font-mono font-black ${prevDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}">${prevDebt.toFixed(2)} د.ج</strong>
            </div>
            <div class="text-left">
              <span>سقف الكريدي: </span>
              <strong class="font-mono">${creditLimit > 0 ? creditLimit.toFixed(0) + ' د.ج' : 'مفتوح ∞'}</strong>
            </div>
          </div>

          ${
            isOverLimit
              ? `<div class="p-1.5 rounded-lg bg-rose-600 text-white font-black text-[10px] text-center">
                  ⚠️ تنبيه: إجمالي الكريدي مع هذه السلة (${projectedTotalDebt.toFixed(2)} د.ج) يتجاوز السقف المسموح (${creditLimit.toFixed(2)} د.ج)!
                </div>`
              : ''
          }

          <!-- أزرار الكريدي السريعة للزبون الوفي مباشرة من السلة -->
          <div class="grid grid-cols-3 gap-1 pt-1">
            <button type="button" onclick="window.GherbiVipCreditV56.quickSellFullCreditFromCart()"
                    class="py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10.5px] shadow-sm cursor-pointer transition flex items-center justify-center gap-1"
                    title="تسجيل السلة الحالية بالكامل كريدي على حساب هذا الزبون وطباعة التذكرة (Alt+D)">
              <span>📝 بيع كريدي (Alt+D)</span>
            </button>
            <button type="button" onclick="window.GherbiVipCreditV56.openPartialCreditCheckout()"
                    class="py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[10.5px] shadow-sm cursor-pointer transition flex items-center justify-center gap-1"
                    title="الزبون يدفع جزءاً فقط والباقي يُسجل كريدي على حسابه (Alt+A)">
              <span>⚖️ جزئي+كريدي (Ctrl+D)</span>
            </button>
            <button type="button" onclick="window.GherbiVipCreditV56.openQuickPayOldDebtModal(${cust.id})"
                    class="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] shadow-sm cursor-pointer transition flex items-center justify-center gap-1"
                    title="استلام دفعة لتسديد الكريدي القديم مع طباعة وصل">
              <span>💵 تسديد (Alt+V)</span>
            </button>
          </div>
        </div>
      `;
    }

    // ========================================================================
    // 5. متحكم عمليات الكريدي في التجزئة (GherbiVipCreditV56)
    // ========================================================================
    const VipCreditController = {
      refreshWidget() {
        requestAnimationFrame(() => renderPosCustomerVipCreditWidget());
      },

      // أ) بيع السلة بالكامل بالكريدي (آجل 100%) بضغطة زر واحدة أو F9
      async quickSellFullCreditFromCart() {
        const custId = Number(document.getElementById('posCustomerSelect')?.value || 0);
        if (!custId) {
          if (window.showToast) {
            window.showToast('⚠️ يرجى اختيار الزبون الوفي من القائمة أولاً لتسجيل الكريدي على حسابه!', 'warning');
          }
          document.getElementById('posCustomerSelect')?.focus();
          return;
        }

        const cust = PosTurboEngine.getCustomerFast(custId);
        if (cust && Number(cust.is_credit_blocked || 0) === 1) {
          if (window.showToast) {
            window.showToast(`🚫 الكريدي مجمد للزبون (${cust.name})! يمكنك تفعيله من بطاقة الزبون.`, 'error');
          }
          return;
        }

        window.App.openCheckoutModal();
        setTimeout(() => {
          const methodSel = document.getElementById('chkPaymentMethod');
          const paidInp = document.getElementById('chkPaidAmount');
          if (methodSel) {
            methodSel.value = 'credit';
            if (typeof window.App.onCheckoutMethodChange === 'function') {
              window.App.onCheckoutMethodChange('credit');
            }
          }
          if (paidInp) {
            paidInp.value = '0';
          }
          this.updateCheckoutModalCreditBanner();
        }, 30);
      },

      // ب) فتح نافذة التسديد في وضع "دفع جزئي والباقي كريدي"
      openPartialCreditCheckout() {
        const custId = Number(document.getElementById('posCustomerSelect')?.value || 0);
        if (!custId) {
          if (window.showToast) {
            window.showToast('⚠️ اختر الزبون الوفي أولاً حتى يُسجل باقي المبلغ في حساب الكريدي الخاص به!', 'warning');
          }
          document.getElementById('posCustomerSelect')?.focus();
          return;
        }
        window.App.openCheckoutModal();
        setTimeout(() => {
          const paidInp = document.getElementById('chkPaidAmount');
          if (paidInp) {
            paidInp.focus();
            paidInp.select();
          }
          this.updateCheckoutModalCreditBanner();
        }, 40);
      },

      // ج) فتح نافذة تسديد دفعة من الكريدي القديم مباشرة من الكاشير
      openQuickPayOldDebtModal(customerId) {
        const cid = Number(customerId || document.getElementById('posCustomerSelect')?.value || 0);
        if (!cid) return;
        const cust = PosTurboEngine.getCustomerFast(cid);
        const hidInput = document.getElementById('custPayCustomerId');
        const titleEl = document.getElementById('custPayModalTitle');
        const amtInp = document.getElementById('custPayAmountInput');
        if (hidInput) hidInput.value = String(cid);
        if (titleEl && cust) {
          titleEl.innerHTML = `💵 تسديد (Alt+V) الزبون: <span class="text-blue-600">${cust.name}</span> (الدين: ${Number(cust.total_debt || 0).toFixed(2)} د.ج)`;
        }
        if (amtInp && cust) {
          amtInp.value = String(Math.max(0, Number(cust.total_debt || 0)));
        }
        window.App.openModal('customerPaymentModal');
      },

      // د) تحديث نافذة التسديد (F1 - #checkoutModal) لعرض شريط الكريدي التلقائي (عندما يدفع الزبون أقل من المجموع أو أكثر منه)
      updateCheckoutModalCreditBanner() {
        const chkModal = document.getElementById('checkoutModal');
        if (!chkModal || !chkModal.classList.contains('active')) return;

        const custId = Number(document.getElementById('posCustomerSelect')?.value || 0);
        const cust = PosTurboEngine.getCustomerFast(custId);

        const totalDueEl = document.getElementById('chkTotalDue');
        const totalDue = parseFloat(String(totalDueEl?.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
        const paidInp = document.getElementById('chkPaidAmount');
        const rawPaid = paidInp && paidInp.value !== '' ? Number(paidInp.value) : totalDue;
        const changeEl = document.getElementById('chkChangeAmount');

        let banner = document.getElementById('v56CheckoutRetailCreditBox');
        if (!banner && changeEl && changeEl.parentElement && changeEl.parentElement.parentElement) {
          banner = document.createElement('div');
          banner.id = 'v56CheckoutRetailCreditBox';
          changeEl.parentElement.parentElement.insertAdjacentElement('afterend', banner);
        }
        if (!banner) return;

        const prevDebt = cust ? Math.max(0, Number(cust.total_debt || 0)) : 0;
        const shortageCredit = Math.max(0, Number((totalDue - rawPaid).toFixed(2)));
        const extraCashOverTotal = Math.max(0, Number((rawPaid - totalDue).toFixed(2)));
        const newCumulativeDebt = Number((prevDebt + shortageCredit).toFixed(2));

        // 1. إذا كان المبلغ المدفوع أقل من إجمالي الفاتورة (تخلية الباقي كريدي!)
        if (shortageCredit > 0.009) {
          if (changeEl) {
            changeEl.textContent = `كريدي: ${shortageCredit.toFixed(2)} د.ج`;
            changeEl.className = 'w-full px-3 py-2.5 rounded-xl bg-rose-500/15 text-rose-600 font-mono font-black text-sm text-center';
          }

          if (!cust) {
            banner.innerHTML = `
              <div class="p-3 rounded-2xl bg-amber-500/15 border-2 border-amber-500 text-amber-900 dark:text-amber-300 text-xs font-black space-y-1.5 mt-2">
                <div>⚠️ المبلغ المستلم (${rawPaid.toFixed(2)} د.ج) أقل من الفاتورة بـ (${shortageCredit.toFixed(2)} د.ج)!</div>
                <div class="text-[11px] font-bold">اختر الزبون الوفي من السلة لتسجيل الـ (${shortageCredit.toFixed(2)} د.ج) كـ كريدي على حسابه.</div>
              </div>
            `;
          } else {
            banner.innerHTML = `
              <div class="p-3 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-xs space-y-1.5 mt-2">
                <div class="flex items-center justify-between font-black text-rose-700 dark:text-rose-300">
                  <span>📝 سيتم تسجيل الباقي كريدي على حساب (${cust.name}):</span>
                  <span class="font-mono text-sm">${shortageCredit.toFixed(2)} د.ج</span>
                </div>
                <div class="grid grid-cols-3 gap-1 pt-1 border-t border-rose-500/20 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <div>السابق: <strong class="font-mono">${prevDebt.toFixed(2)}</strong></div>
                  <div>كريدي اليوم: <strong class="font-mono text-rose-600">+${shortageCredit.toFixed(2)}</strong></div>
                  <div>الإجمالي الجديد: <strong class="font-mono text-rose-700 dark:text-rose-300">${newCumulativeDebt.toFixed(2)} د.ج</strong></div>
                </div>
                <div class="flex gap-1.5 pt-1">
                  <button type="button" onclick="document.getElementById('chkPaidAmount').value='0'; window.App.recalcCheckoutModal();" class="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-[10.5px] cursor-pointer">كريدي كلي (0 د.ج مدفوع)</button>
                  <button type="button" onclick="window.App.setExactCash()" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-black text-[10.5px] cursor-pointer">دفع كامل (${totalDue.toFixed(2)} د.ج)</button>
                </div>
              </div>
            `;
          }
        } else if (cust && prevDebt > 0.009 && extraCashOverTotal > 0.009) {
          // 2. إذا أعطى الزبون الوفي مبلغاً أكبر من فاتورة اليوم وكان عليه كريدي قديم!
          const deductable = Math.min(prevDebt, extraCashOverTotal);
          const remainingChangeToHandBack = Math.max(0, Number((extraCashOverTotal - deductable).toFixed(2)));
          banner.innerHTML = `
            <div class="p-3 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-xs space-y-1.5 mt-2">
              <div class="font-black text-emerald-800 dark:text-emerald-300">
                💡 الزبون (${cust.name}) عليه كريدي سابق قدره (${prevDebt.toFixed(2)} د.ج) والصرف المتبقي له (${extraCashOverTotal.toFixed(2)} د.ج):
              </div>
              <button type="button" onclick="window.GherbiVipCreditV56.applyChangeToOldCustomerDebt(${cust.id}, ${deductable}, ${remainingChangeToHandBack})"
                      class="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow cursor-pointer transition">
                ✅ خصم (${deductable.toFixed(2)} د.ج) من الكريدي القديم فوراً ${remainingChangeToHandBack > 0 ? `(وإرجاع صرف ${remainingChangeToHandBack.toFixed(2)} د.ج)` : ''}
              </button>
            </div>
          `;
        } else if (cust) {
          // 3. زبون وفي يدفع المبلغ الكامل
          banner.innerHTML = `
            <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs mt-2">
              <span class="font-black text-amber-800 dark:text-amber-300">👑 ${cust.name} — الكريدي السابق: <strong class="font-mono">${prevDebt.toFixed(2)} د.ج</strong></span>
              <button type="button" onclick="document.getElementById('chkPaidAmount').value='0'; document.getElementById('chkPaymentMethod').value='credit'; window.App.recalcCheckoutModal();"
                      class="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-[10.5px] cursor-pointer">
                📝 تحويل إلى كريدي كلي
              </button>
            </div>
          `;
        } else {
          banner.innerHTML = '';
        }
      },

      // خصم الصرف المتبقي من الكريدي القديم للزبون الوفي بضغطة زر
      async applyChangeToOldCustomerDebt(customerId, deductAmount, remainingChange) {
        if (!customerId || deductAmount <= 0) return;
        try {
          await window.api?.addCustomerPayment?.(Number(customerId), Number(deductAmount), new Date().toISOString(), {
            payment_method: 'cash',
            notes: 'تسديد من الصرف المتبقي عند الشراء في الكاشير'
          });
          if (window.GherbiFastCacheV55) {
            window.GherbiFastCacheV55.invalidate();
            const updatedCusts = await window.GherbiFastCacheV55.getCustomersFast(true);
            PosTurboEngine.rebuildCustomerIndex(updatedCusts);
          }
          const totalDue = parseFloat(String(document.getElementById('chkTotalDue')?.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
          const paidInp = document.getElementById('chkPaidAmount');
          if (paidInp) paidInp.value = String(Number((totalDue + remainingChange).toFixed(2)));
          window.App.recalcCheckoutModal();
          this.refreshWidget();
          if (window.showToast) {
            window.showToast(`✅ تم خصم ${Number(deductAmount).toFixed(2)} د.ج من الكريدي القديم للزبون بنجاح!`, 'success');
          }
        } catch (err) {
          if (window.showToast) window.showToast(err.message || 'تعذر خصم الكريدي', 'error');
        }
      }
    };

    window.GherbiVipCreditV56 = VipCreditController;

    // 6. ربط recalcCheckoutModal و openCheckoutModal و recalcCart بشريط الكريدي الحي
    if (typeof window.App.recalcCheckoutModal === 'function' && !window.App._v56RecalcChkHooked) {
      const origRecalcChk = window.App.recalcCheckoutModal.bind(window.App);
      window.App._v56RecalcChkHooked = true;
      window.App.recalcCheckoutModal = function (...args) {
        const res = origRecalcChk(...args);
        VipCreditController.updateCheckoutModalCreditBanner();
        return res;
      };
    }

    if (typeof window.App.openCheckoutModal === 'function' && !window.App._v56OpenChkHooked) {
      const origOpenChk = window.App.openCheckoutModal.bind(window.App);
      window.App._v56OpenChkHooked = true;
      window.App.openCheckoutModal = function (...args) {
        const res = origOpenChk(...args);
        setTimeout(() => VipCreditController.updateCheckoutModalCreditBanner(), 25);
        return res;
      };
    }

    if (typeof window.App.recalcCart === 'function' && !window.App._v56RecalcCartHooked) {
      const origRecalcCart = window.App.recalcCart.bind(window.App);
      window.App._v56RecalcCartHooked = true;
      window.App.recalcCart = function (...args) {
        const res = origRecalcCart(...args);
        VipCreditController.refreshWidget();
        return res;
      };
    }

    // 7. ترقية submitSale لدعم "الدفع الجزئي وتخلية الباقي كريدي" للزبون الوفي تلقائياً
    //    وإرسال البيانات الدقيقة (الدين السابق + المدفوع اليوم + كريدي اليوم + الإجمالي الجديد) إلى التذكرة!
    const prevSubmitSale = window.App.submitSale.bind(window.App);
    window.App.submitSale = async function (printMode = 'receipt', ...rest) {
      const custSelect = document.getElementById('posCustomerSelect');
      const custId = Number(custSelect?.value || 0);
      const cust = PosTurboEngine.getCustomerFast(custId);

      const totalDueEl = document.getElementById('chkTotalDue');
      const totalDue = parseFloat(String(totalDueEl?.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
      const paidInp = document.getElementById('chkPaidAmount');
      const methodSel = document.getElementById('chkPaymentMethod');

      let rawPaid = paidInp && paidInp.value !== '' ? Number(paidInp.value) : totalDue;
      if (methodSel && methodSel.value === 'credit' && rawPaid >= totalDue) {
        rawPaid = 0;
        if (paidInp) paidInp.value = '0';
      }

      const shortageCredit = Math.max(0, Number((totalDue - rawPaid).toFixed(2)));

      // إذا كان هناك مبلغ متبقٍ غير مدفوع (كريدي كلي أو جزئي):
      if (shortageCredit > 0.009) {
        if (!custId) {
          if (window.showToast) {
            window.showToast('⚠️ لتسجيل الباقي (' + shortageCredit.toFixed(2) + ' د.ج) كريدي، يرجى اختيار الزبون الوفي أولاً!', 'warning');
          }
          return;
        }
        if (cust && Number(cust.is_credit_blocked || 0) === 1) {
          if (window.showToast) {
            window.showToast(`🚫 عذراً، الكريدي مجمد لهذا الزبون (${cust.name})!`, 'error');
          }
          return;
        }
        // إذا كان الدفع نقدياً ولكن المبلغ المدفوع أقل من الفاتورة، نحوله إلى بيع آجل/جزئي ليحفظ الباقي كدين في SQLite
        if (methodSel && methodSel.value === 'cash' && rawPaid < totalDue) {
          methodSel.value = 'credit';
        }
      }

      const prevDebtBeforeSale = cust ? Math.max(0, Number(cust.total_debt || 0)) : 0;

      // تنفيذ البيع والطباعة المعتمدة
      const res = await prevSubmitSale(printMode, ...rest);

      // تحديث فهرس الزبائن في الذاكرة فوراً بعد البيع ليظهر الرصيد الجديد مباشرة
      if (window.GherbiFastCacheV55) {
        window.GherbiFastCacheV55.invalidate();
        const freshCusts = await window.GherbiFastCacheV55.getCustomersFast(true);
        PosTurboEngine.rebuildCustomerIndex(freshCusts);
      }
      VipCreditController.refreshWidget();

      if (shortageCredit > 0.009 && cust && window.showToast) {
        const newDebt = Number((prevDebtBeforeSale + shortageCredit).toFixed(2));
        window.showToast(
          `📝 تم تسجيل كريدي (${shortageCredit.toFixed(2)} د.ج) على حساب (${cust.name}) — إجمالي الكريدي الآن: ${newDebt.toFixed(2)} د.ج`,
          'info'
        );
      }

      return res;
    };

    // 8. مراقبة تغيير الزبون المختار في الكاشير (#posCustomerSelect) واختصار لوحة المفاتيح F9 للبيع بالكريدي
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'posCustomerSelect') {
        VipCreditController.refreshWidget();
      }
    });

    document.addEventListener('keydown', (e) => {
      const viewPos = document.getElementById('view-pos');
      if (viewPos && viewPos.classList.contains('active') && e.altKey && !e.ctrlKey && !e.shiftKey) {
        if (e.code === 'KeyD' || e.key === 'd' || e.key === 'D' || e.key === 'ي') {
          e.preventDefault();
          VipCreditController.quickSellFullCreditFromCart();
        } else if (e.code === 'KeyV' || e.key === 'v' || e.key === 'V' || e.key === 'ر') {
          e.preventDefault();
          VipCreditController.openQuickPayOldDebtModal();
        }
      }
    });

    // رسم الويدجت فوراً عند الإقلاع وتحديثه عند إضافة زبون جديد
    setTimeout(() => {
      PosTurboEngine.rebuildMemoryIndex();
      PosTurboEngine.rebuildCustomerIndex();
      VipCreditController.refreshWidget();
    }, 300);

    console.log('🚀 [Gherbi V56 Turbo POS & VIP Retail Credit]: شاشة المبيعات فائقة السرعة + نظام الكريدي الكلي والجزئي للزبون الوفي جاهز 100%!');
  }, 140);
})();

/* ==================== [V59 CLEAN-ROOM 28 PRO TEMPLATES & FULL-WIDTH PRINT STUDIO] ==================== */
(function initV59CleanRoom28ProTemplatesPrintStudio() {
  // ==========================================================================
  // القوالب الـ 28 الاحترافية الجاهزة (Tailor-Made Professional Par Défaut Templates)
  // كل قالب مصمم خصيصاً لوظيفته ومرتبط بصفحته وجاهز للاستعمال المباشر بدون أي تعديل!
  // ==========================================================================
  const PRO_28_TEMPLATES = [
    // ── المجموعة 1: المبيعات والكاشير (9 قوالب) ──
    {
      id: 'receipt_thermal',
      num: 1,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '🧾 تذكرة كاشير حرارية (80mm / 58mm)',
      cleanTitle: 'وصل مبيعات / Ticket de Caisse',
      defaultPaper: '80mm',
      defaultTheme: 'executive_dark',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات والكاشير',
      proDesc: 'تذكرة سوبرماركت حرارية متناسقة مع السنتيم وبطاقة الوفاء',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'loyalty_points_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'TIC-2026-0088',
      samplePartyTitle: 'الزبون:',
      samplePartyName: 'أمين بن يحيى (زبون وفي 👑)',
      samplePaymentMethod: 'نقداً (Espèces)',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي جوي (ULTRA JOY)', unit: 'علبة', qty: 1, price: 70, discount: 0, tva: 0, subtotal: 70 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 قطعة (JOY BB 72)', unit: 'كيس', qty: 1, price: 145, discount: 0, tva: 0, subtotal: 145 },
        { barcode: '6130006000017', name: 'غولد لاين ممتاز (GOLD LINE)', unit: 'قطعة', qty: 1, price: 125, discount: 0, tva: 0, subtotal: 125 }
      ],
      sampleTotal: 340,
      samplePaid: 340,
      samplePrevDebt: 0
    },
    {
      id: 'invoice_a4',
      num: 2,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '📄 فاتورة مبيعات رسمية (A4)',
      cleanTitle: 'فاتورة مبيعات تجارية / Facture Commerciale',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات والضمان',
      proDesc: 'فاتورة مؤسسات كاملة بالبيانات الجبائية والتفقيط بالحروف والختم',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'debt_ledger_layer', 'loyalty_points_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: true, tva: false, subtotal: true },
      sampleDocNum: 'FAC-2026-0088',
      samplePartyTitle: 'الزبون / المؤسسة:',
      samplePartyName: 'مؤسسة الأمل للتجارة والتوزيع',
      samplePaymentMethod: 'نقداً / بشيك',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (Elio Cevital)', unit: 'قارورة', qty: 10, price: 650, discount: 0, tva: 19, subtotal: 6500 },
        { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (Candia)', unit: 'كرتونة', qty: 5, price: 1800, discount: 0, tva: 19, subtotal: 9000 },
        { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (Bonal)', unit: 'علبة', qty: 10, price: 320, discount: 0, tva: 19, subtotal: 3200 }
      ],
      sampleTotal: 18700,
      samplePaid: 18700,
      samplePrevDebt: 0
    },
    {
      id: 'invoice_a5',
      num: 3,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '📑 فاتورة مبيعات مدمجة (A5)',
      cleanTitle: 'فاتورة مبيعات مدمجة / Facture A5',
      defaultPaper: 'a5',
      defaultTheme: 'emerald_dz',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات',
      proDesc: 'فاتورة نصف ورقة أنيقة وسريعة لتجارة التجزئة والجملة',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'debt_ledger_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'FA5-2026-0041',
      samplePartyTitle: 'الزبون:',
      samplePartyName: 'أمين بن يحيى (زبون وفي 👑)',
      samplePaymentMethod: 'نقداً (Espèces)',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي جوي', unit: 'علبة', qty: 2, price: 70, discount: 0, tva: 0, subtotal: 140 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 قطعة', unit: 'كيس', qty: 2, price: 145, discount: 0, tva: 0, subtotal: 290 }
      ],
      sampleTotal: 430,
      samplePaid: 430,
      samplePrevDebt: 0
    },
    {
      id: 'invoice_2xa5',
      num: 4,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '✂️ فاتورة مزدوجة (2×A5 في ورقة A4 — نسختان)',
      cleanTitle: 'فاتورة مبيعات / Facture',
      defaultPaper: '2xa5',
      defaultTheme: 'royal_blue',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات (توفير 50% ورق)',
      proDesc: 'نسخة للزبون ونسخة للأرشيف في ورقة A4 واحدة بالعرض',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'FAC-2026-0088',
      samplePartyTitle: 'الزبون:',
      samplePartyName: 'مؤسسة الأمل للتجارة',
      samplePaymentMethod: 'نقداً',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر', unit: 'قارورة', qty: 4, price: 650, discount: 0, tva: 0, subtotal: 2600 },
        { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ', unit: 'علبة', qty: 5, price: 320, discount: 0, tva: 0, subtotal: 1600 }
      ],
      sampleTotal: 4200,
      samplePaid: 4200,
      samplePrevDebt: 0
    },
    {
      id: 'delivery_note',
      num: 5,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '🚚 وصل تسليم وتوصيل (Bon de Livraison)',
      cleanTitle: 'وصل تسليم بضاعة / Bon de Livraison (BL)',
      defaultPaper: 'a4',
      defaultTheme: 'emerald_dz',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات والتوصيل',
      proDesc: 'يركز على الكميات والوحدات وبيانات السائق والمركبة وإمضاء الاستلام',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'delivery_driver_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: false, discount: false, tva: false, subtotal: false },
      sampleDocNum: 'BL-2026-0054',
      samplePartyTitle: 'المرسل إليه (الزبون):',
      samplePartyName: 'مؤسسة الأمل للتجارة — قسنطينة',
      samplePaymentMethod: 'تسليم بضاعة بالمخزن',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (صندوق 4 قارورات)', unit: 'صندوق', qty: 15, price: 2600, discount: 0, tva: 0, subtotal: 39000 },
        { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (كرتونة 12 علبة)', unit: 'كرتونة', qty: 20, price: 1800, discount: 0, tva: 0, subtotal: 36000 }
      ],
      sampleTotal: 75000,
      samplePaid: 75000,
      samplePrevDebt: 0
    },
    {
      id: 'proforma',
      num: 6,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '📋 فاتورة شكلية / عرض سعر (Proforma)',
      cleanTitle: 'فاتورة شكلية (عرض سعر) / Facture Proforma',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'proformas',
      sourceLabel: 'الفواتير الشكلية',
      proDesc: 'عرض سعر رسمي للشركات والصفقات مع تفصيل HT و TVA ومدة الصلاحية',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'tax_ifu_breakdown_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: true, subtotal: true },
      sampleDocNum: 'PRO-2026-0018',
      samplePartyTitle: 'الجهة الطالبة للعرض:',
      samplePartyName: 'مديرية الخدمات الجامعية — قسنطينة',
      samplePaymentMethod: 'عرض سعر صالح لمدة 15 يوماً',
      sampleItems: [
        { barcode: '6130001000012', name: 'تموين مواد غذائية أساسية (زيت مائدة 5 لتر)', unit: 'قارورة', qty: 50, price: 650, discount: 0, tva: 19, subtotal: 32500 },
        { barcode: '6130008000022', name: 'كسكس ماما ممتاز 1 كغ', unit: 'كيس', qty: 100, price: 160, discount: 0, tva: 19, subtotal: 16000 }
      ],
      sampleTotal: 48500,
      samplePaid: 0,
      samplePrevDebt: 0
    },
    {
      id: 'customer_order',
      num: 7,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '📦 سند طلبية زبون (Bon de Commande)',
      cleanTitle: 'سند طلبية زبون / Bon de Commande (BC)',
      defaultPaper: 'a4',
      defaultTheme: 'amber_gold',
      sourcePage: 'orders',
      sourceLabel: 'طلبيات الزبائن',
      proDesc: 'يوثق الأصناف المحجوزة للزبون، العربون المدفوع (Acompte)، والباقي عند التسليم',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'delivery_driver_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'BC-2026-0029',
      samplePartyTitle: 'الزبون صاحب الطلبية:',
      samplePartyName: 'فارس بوزيد (طلبية محجوزة)',
      samplePaymentMethod: 'عربون مسبق + الباقي عند الاستلام',
      sampleItems: [
        { barcode: '6130007000030', name: 'شوكولاتة الطلاء ماكسون 350غ (كرتونة 24 علبة)', unit: 'كرتونة', qty: 2, price: 8000, discount: 0, tva: 0, subtotal: 16000 }
      ],
      sampleTotal: 16000,
      samplePaid: 6000,
      samplePrevDebt: 0
    },
    {
      id: 'credit_note',
      num: 8,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: "↩️ إشعار دائن / مرتجع (Facture d'Avoir)",
      cleanTitle: "إشعار دائن (مرتجع مبيعات) / Facture d'Avoir",
      defaultPaper: 'a4',
      defaultTheme: 'crimson_bold',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات والمرتجعات',
      proDesc: 'وثيقة رسمية لإرجاع البضاعة وتخفيض دين الزبون أو رد المبلغ نقداً',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'debt_ledger_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'AV-2026-0009',
      samplePartyTitle: 'الزبون المستفيد من الإشعار:',
      samplePartyName: 'أمين بن يحيى (إرجاع من الفاتورة #76)',
      samplePaymentMethod: 'خصم من رصيد الدين / استرداد',
      sampleItems: [
        { barcode: '6130006000017', name: 'مرتجع: غولد لاين (GOLD LINE) — استرجاع سليم للمخزن', unit: 'قطعة', qty: 1, price: 125, discount: 0, tva: 0, subtotal: 125 }
      ],
      sampleTotal: 125,
      samplePaid: 125,
      samplePrevDebt: 0
    },
    {
      id: 'warranty_cert',
      num: 9,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '🛡️ شهادة ضمان رسمية (Certificat de Garantie)',
      cleanTitle: 'شهادة ضمان رسمية / Certificat de Garantie',
      defaultPaper: 'a5',
      defaultTheme: 'royal_blue',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات والضمان',
      proDesc: 'شهادة ضمان مختومة تتضمن الرقم التسلسلي S/N أو IMEI ومدة الضمان وشروطه',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'warranty_imei_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: false, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'GAR-2026-0063',
      samplePartyTitle: 'المستفيد من الضمان:',
      samplePartyName: 'أمين بن يحيى',
      samplePaymentMethod: 'ضمان رسمي لمدة 12 شهراً',
      sampleItems: [
        { barcode: 'SN-869412005478', name: 'جهاز إلكتروني / كهرومنزلي — مشمول بضمان المصنع لمدة 12 شهراً', unit: 'جهاز', qty: 1, price: 14500, discount: 0, tva: 0, subtotal: 14500 }
      ],
      sampleTotal: 14500,
      samplePaid: 14500,
      samplePrevDebt: 0
    },

    // ── المجموعة 2: الكريدي والديون والوفاء (7 قوالب) ──
    {
      id: 'payment_receipt',
      num: 10,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (7)',
      name: '💵 وصل قبض / تسديد دين (Reçu de Paiement 80mm)',
      cleanTitle: 'وصل استلام دفعة / Reçu de Paiement',
      defaultPaper: '80mm',
      defaultTheme: 'royal_blue',
      sourcePage: 'customers',
      sourceLabel: 'الزبائن والديون والأقساط + الكاشير (Alt+V)',
      proDesc: 'يوثق المبلغ المقبوض من الزبون، الدين السابق قبل الدفع، والرصيد المتبقي الجديد',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'credit_carnet_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'REC-2026-0112',
      samplePartyTitle: 'استلمنا من الزبون:',
      samplePartyName: 'أمين بن يحيى (زبون وفي 👑)',
      samplePaymentMethod: 'دفعة نقدية لتسديد الكريدي',
      sampleItems: [
        { barcode: 'REC-112', name: 'دفعة تسديد نقدية على حساب الكريدي (خصم مباشر من الرصيد)', unit: 'دفعة', qty: 1, price: 200, discount: 0, tva: 0, subtotal: 200 }
      ],
      sampleTotal: 200,
      samplePaid: 200,
      samplePrevDebt: 460
    },
    {
      id: 'customer_carnet_80mm',
      num: 11,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (7)',
      name: '📒 كشف حساب وديون الزبون حراري (Carnet 80mm)',
      cleanTitle: 'كشف حساب الكريدي / Carnet de Crédit',
      defaultPaper: '80mm',
      defaultTheme: 'crimson_bold',
      sourcePage: 'customers',
      sourceLabel: 'مركز الديون (Ctrl+K) + بطاقة الزبون الوفي',
      proDesc: 'تذكرة حرارية سريعة تلخص للزبون فواتيره الآجلة ودفعاته وصافي الكريدي المتبقي',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'credit_carnet_layer', 'loyalty_points_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: false, qty: true, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'CARNET-0045',
      samplePartyTitle: 'صاحب الكرني (الزبون):',
      samplePartyName: 'أمين بن يحيى (FID-00003)',
      samplePaymentMethod: 'كشف حساب الكريدي التراكمي',
      sampleItems: [
        { barcode: 'FAC-071', name: 'رصيد الفاتورة السابقة #71 (باقي غير مسدد)', unit: 'فاتورة', qty: 1, price: 320, discount: 0, tva: 0, subtotal: 320 },
        { barcode: 'FAC-076', name: 'فاتورة مشتريات اليوم #76 (إجمالي 340 د.ج — دفع 200 د.ج)', unit: 'فاتورة', qty: 1, price: 140, discount: 0, tva: 0, subtotal: 140 }
      ],
      sampleTotal: 340,
      samplePaid: 200,
      samplePrevDebt: 320
    },
    {
      id: 'pos_partial_credit_80mm',
      num: 12,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (7)',
      name: '💸 تذكرة بيع بالدفع الجزئي والباقي كريدي (80mm)',
      cleanTitle: 'وصل بيع (دفع جزئي + الباقي كريدي)',
      defaultPaper: '80mm',
      defaultTheme: 'crimson_bold',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات (دفع جزئي + كريدي Ctrl+D)',
      proDesc: 'تذكرة كاشير تبرز السلع المشتراة اليوم، المبلغ المدفوع، والباقي المضاف لكرني الكريدي',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'credit_carnet_layer', 'loyalty_points_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'FAC-2026-0076',
      samplePartyTitle: 'الزبون:',
      samplePartyName: 'أمين بن يحيى (زبون وفي 👑)',
      samplePaymentMethod: 'دفع جزئي والباقي كريدي',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي جوي', unit: 'علبة', qty: 1, price: 70, discount: 0, tva: 0, subtotal: 70 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 قطعة', unit: 'كيس', qty: 1, price: 145, discount: 0, tva: 0, subtotal: 145 },
        { barcode: '6130006000017', name: 'غولد لاين ممتاز', unit: 'قطعة', qty: 1, price: 125, discount: 0, tva: 0, subtotal: 125 }
      ],
      sampleTotal: 340,
      samplePaid: 200,
      samplePrevDebt: 320
    },
    {
      id: 'customer_ledger_a4',
      num: 13,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (7)',
      name: '📊 كشف حساب الزبون المفصل (Relevé de Compte A4)',
      cleanTitle: 'كشف حساب زبون مفصل / Relevé de Compte Client',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'customers',
      sourceLabel: 'الزبائن والديون وكشف الحساب',
      proDesc: 'تقرير A4 رسمي يعرض جميع فواتير الزبون ودفعاته ورصيده الإجمالي بالدينار والسنتيم',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'debt_ledger_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'REL-2026-0012',
      samplePartyTitle: 'كشف حساب السيد / المؤسسة:',
      samplePartyName: 'مؤسسة الأمل للتجارة (أمين بن يحيى)',
      samplePaymentMethod: 'كشف حساب شامل للفواتير والمدفوعات',
      sampleItems: [
        { barcode: 'FAC-071', name: 'فاتورة مبيعات رقم #71 بتاريخ 2026-11-10', unit: 'فاتورة', qty: 1, price: 1500, discount: 0, tva: 0, subtotal: 1500 },
        { barcode: 'REC-098', name: 'دفعة تسديد نقدية رقم #98 بتاريخ 2026-11-12 (مدفوع: 1180 د.ج)', unit: 'تسديد', qty: 1, price: -1180, discount: 0, tva: 0, subtotal: -1180 },
        { barcode: 'FAC-076', name: 'فاتورة مبيعات رقم #76 بتاريخ 2026-11-16 (مدفوع جزئياً: 200 د.ج)', unit: 'فاتورة', qty: 1, price: 340, discount: 0, tva: 0, subtotal: 340 }
      ],
      sampleTotal: 660,
      samplePaid: 200,
      samplePrevDebt: 320
    },
    {
      id: 'recap_invoice_a4',
      num: 14,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (7)',
      name: '📑 فاتورة مجمعة للزبون (Facture Récapitulative A4)',
      cleanTitle: 'فاتورة مبيعات مجمعة / Facture Récapitulative',
      defaultPaper: 'a4',
      defaultTheme: 'executive_dark',
      sourcePage: 'customers',
      sourceLabel: 'الزبائن والفواتير المجمعة',
      proDesc: 'تجمع كافة مسحوبات الزبون خلال شهر أو فترة محددة في فاتورة ضريبية موحدة',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'debt_ledger_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'FR-2026-0005',
      samplePartyTitle: 'الزبون / المؤسسة:',
      samplePartyName: 'مؤسسة الأمل للتجارة والتوزيع',
      samplePaymentMethod: 'تجميع فواتير الشهر (Facture Récapitulative)',
      sampleItems: [
        { barcode: '6130001000012', name: 'إجمالي مسحوبات: زيت مائدة إيليو 5 لتر (خلال الفترة)', unit: 'قارورة', qty: 24, price: 650, discount: 0, tva: 0, subtotal: 15600 },
        { barcode: '6130002000011', name: 'إجمالي مسحوبات: حليب كانديا 1 لتر (خلال الفترة)', unit: 'علبة', qty: 60, price: 150, discount: 0, tva: 0, subtotal: 9000 }
      ],
      sampleTotal: 24600,
      samplePaid: 20000,
      samplePrevDebt: 0
    },
    {
      id: 'installment_contract',
      num: 15,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (7)',
      name: '🗓️ عقد بيع بالتقسيط وجدول الأقساط (A4)',
      cleanTitle: 'عقد بيع بالتقسيط / Contrat de Vente par Facilité',
      defaultPaper: 'a4',
      defaultTheme: 'amber_gold',
      sourcePage: 'customers',
      sourceLabel: 'الزبائن والأقساط الشهرية',
      proDesc: 'عقد التزام كامل يوضح السلعة، التسبيق، وجدول تواريخ ومبالغ الأقساط الشهرية',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'installments_schedule_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'INST-2026-0014',
      samplePartyTitle: 'المشتري بالتقسيط:',
      samplePartyName: 'أمين بن يحيى (ب.ت.و: 109845210)',
      samplePaymentMethod: 'بيع بالتقسيط على 3 أشهر (تسبيق: 6,000 د.ج)',
      sampleItems: [
        { barcode: '6130099001122', name: 'جهاز كهرومنزلي ممتاز — بيع بالتقسيط المريح', unit: 'جهاز', qty: 1, price: 15000, discount: 0, tva: 0, subtotal: 15000 }
      ],
      sampleTotal: 15000,
      samplePaid: 6000,
      samplePrevDebt: 0
    },
    {
      id: 'loyalty_vip_card_80mm',
      num: 16,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (7)',
      name: '👑 قسيمة وبطاقة نقاط الوفاء للزبون (Ticket VIP 80mm)',
      cleanTitle: 'بطاقة وقسيمة نقاط الوفاء (Club Fidélité VIP)',
      defaultPaper: '80mm',
      defaultTheme: 'amber_gold',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات ونادي الولاء (F8)',
      proDesc: 'تذكرة مكافآت خاصة توضح للزبون رصيد نقاطه وما تعادله من تخفيض نقدي بالدينار',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'loyalty_points_layer', 'savings_promo_layer', 'qr_social_wifi_layer', 'footer_stamp_layer'],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'VIP-00003',
      samplePartyTitle: 'العضو الوفي:',
      samplePartyName: 'أمين بن يحيى (بطاقة: FID-00003)',
      samplePaymentMethod: 'قسيمة ولاء ومكافآت',
      sampleItems: [
        { barcode: 'VIP-PTS', name: 'رصيد نقاط الوفاء المتاح للاستبدال الفوري في المتجر', unit: 'نقطة', qty: 43, price: 2, discount: 0, tva: 0, subtotal: 86 }
      ],
      sampleTotal: 86,
      samplePaid: 86,
      samplePrevDebt: 0
    },

    // ── المجموعة 3: المشتريات والموردين (4 قوالب) ──
    {
      id: 'purchase_invoice',
      num: 17,
      cat: 'PURCHASES',
      catLabel: '🛍️ المشتريات والموردين (4)',
      name: '🛍️ سند استلام وفاتورة شراء (Bon de Réception A4)',
      cleanTitle: 'سند استلام ومشتريات / Bon de Réception (BR)',
      defaultPaper: 'a4',
      defaultTheme: 'executive_dark',
      sourcePage: 'purchases',
      sourceLabel: 'المشتريات والفواتير',
      proDesc: 'يوثق البضاعة المستلمة من المورد، كمياتها، تكلفة الشراء، والمدفوع للمورد',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'debt_ledger_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'BR-2026-0032',
      samplePartyTitle: 'المورد / الشركة الممونة:',
      samplePartyName: 'شركة التوزيع الغذائي الكبرى (Fournisseur)',
      samplePaymentMethod: 'فاتورة تموين مخزني',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (دفعة تموين جديدة)', unit: 'قارورة', qty: 100, price: 580, discount: 0, tva: 0, subtotal: 58000 },
        { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر', unit: 'علبة', qty: 200, price: 130, discount: 0, tva: 0, subtotal: 26000 }
      ],
      sampleTotal: 84000,
      samplePaid: 50000,
      samplePrevDebt: 15000
    },
    {
      id: 'supplier_payment_receipt',
      num: 18,
      cat: 'PURCHASES',
      catLabel: '🛍️ المشتريات والموردين (4)',
      name: '💳 سند صرف وتسديد دفعة لمورد (Bon de Versement)',
      cleanTitle: 'سند تسديد دفعة لمورد / Bon de Versement Fournisseur',
      defaultPaper: 'a5',
      defaultTheme: 'emerald_dz',
      sourcePage: 'suppliers',
      sourceLabel: 'إدارة الموردين والدفعات',
      proDesc: 'يوثق المبلغ المسدد للمورد، الدين السابق، والرصيد المتبقي للمورد بعد الدفعة',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'debt_ledger_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'VERS-2026-0019',
      samplePartyTitle: 'المورد المستفيد:',
      samplePartyName: 'شركة التوزيع الغذائي الكبرى',
      samplePaymentMethod: 'دفعة نقدية من الصندوق',
      sampleItems: [
        { barcode: 'VERS-19', name: 'تسديد دفعة على حساب فواتير التوريد (خصم من دين المورد)', unit: 'دفعة', qty: 1, price: 30000, discount: 0, tva: 0, subtotal: 30000 }
      ],
      sampleTotal: 30000,
      samplePaid: 30000,
      samplePrevDebt: 49000
    },
    {
      id: 'supplier_return_note',
      num: 19,
      cat: 'PURCHASES',
      catLabel: '🛍️ المشتريات والموردين (4)',
      name: '↩️ سند إرجاع بضاعة للمورد (Bon de Retour Fournisseur)',
      cleanTitle: 'سند إرجاع بضاعة للمورد / Bon de Retour Fournisseur',
      defaultPaper: 'a4',
      defaultTheme: 'crimson_bold',
      sourcePage: 'purchases',
      sourceLabel: 'مرتجعات الموردين',
      proDesc: 'يوثق الأصناف المرجعة للمورد وسبب الإرجاع وقيمتها المخصومة من حساب المورد',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'RF-2026-0004',
      samplePartyTitle: 'المورد المرجعة إليه البضاعة:',
      samplePartyName: 'شركة التوزيع الغذائي الكبرى',
      samplePaymentMethod: 'خصم من رصيد دين المورد (Avoir)',
      sampleItems: [
        { barcode: '6130003000010', name: 'إرجاع: ياغورت الصومام (قريب انتهاء الصلاحية — استبدال)', unit: 'علبة', qty: 40, price: 28, discount: 0, tva: 0, subtotal: 1120 }
      ],
      sampleTotal: 1120,
      samplePaid: 1120,
      samplePrevDebt: 0
    },
    {
      id: 'supplier_ledger_a4',
      num: 20,
      cat: 'PURCHASES',
      catLabel: '🛍️ المشتريات والموردين (4)',
      name: '📒 كشف حساب المورد والفواتير (Relevé Fournisseur A4)',
      cleanTitle: 'كشف حساب مورد مفصل / Relevé de Compte Fournisseur',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'suppliers',
      sourceLabel: 'إدارة الموردين وكشف الحساب',
      proDesc: 'تقرير A4 شامل يعرض فواتير الشراء والدفعات المسددة وصافي المستحقات للمورد',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'debt_ledger_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'RELF-2026-0007',
      samplePartyTitle: 'كشف حساب المورد:',
      samplePartyName: 'شركة التوزيع الغذائي الكبرى',
      samplePaymentMethod: 'كشف حساب شامل للمشتريات والدفعات',
      sampleItems: [
        { barcode: 'BR-0032', name: 'فاتورة شراء وتوريد رقم #BR-0032 بتاريخ 2026-11-10', unit: 'فاتورة', qty: 1, price: 84000, discount: 0, tva: 0, subtotal: 84000 },
        { barcode: 'VERS-019', name: 'دفعة تسديد للمورد رقم #VERS-019 بتاريخ 2026-11-14', unit: 'دفعة', qty: 1, price: -50000, discount: 0, tva: 0, subtotal: -50000 }
      ],
      sampleTotal: 84000,
      samplePaid: 50000,
      samplePrevDebt: 0
    },

    // ── المجموعة 4: المخزون والتصنيع (4 قوالب) ──
    {
      id: 'stocktake_sheet_a4',
      num: 21,
      cat: 'INVENTORY',
      catLabel: '📦 المخزون والتصنيع (4)',
      name: '📋 محضر الجرد المخزني وفوارق الكميات (A4)',
      cleanTitle: "محضر الجرد المخزني الرسمي / Procès-Verbal d'Inventaire",
      defaultPaper: 'a4',
      defaultTheme: 'executive_dark',
      sourcePage: 'stocktake',
      sourceLabel: 'الجرد المخزني',
      proDesc: 'محضر مطابقة المخزون يعرض الرصيد الدفتري، الرصيد الفعلي المعدود، والفوارق',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'INV-2026-0006',
      samplePartyTitle: 'نطاق الجرد والمسؤول:',
      samplePartyName: 'المخزن الرئيسي — إشراف: المدير العام',
      samplePaymentMethod: 'محضر جرد وتسوية فوارق',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي (الدفتري: 25 | المعدود: 25 | الفارق: 0)', unit: 'علبة', qty: 25, price: 70, discount: 0, tva: 0, subtotal: 1750 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 (الدفتري: 14 | المعدود: 13 | الفارق: -1)', unit: 'كيس', qty: 13, price: 145, discount: 0, tva: 0, subtotal: 1885 }
      ],
      sampleTotal: 3635,
      samplePaid: 3635,
      samplePrevDebt: 0
    },
    {
      id: 'price_catalog_a4',
      num: 22,
      cat: 'INVENTORY',
      catLabel: '📦 المخزون والتصنيع (4)',
      name: '🏷️ كتالوج وقائمة أسعار المنتجات (Catalogue des Prix A4)',
      cleanTitle: 'قائمة الأسعار والكتالوج التجاري / Catalogue des Prix',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'inventory',
      sourceLabel: 'إدارة المخزون وقائمة الأسعار',
      proDesc: 'قائمة أسعار مطبوعة للزبائن والموزعين توضح الباركود والوحدة والسعر بالدينار والسنتيم',
      idealLayers: ['header_layer', 'doc_banner_layer', 'items_table_layer', 'qr_social_wifi_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: false, unitPrice: true, discount: false, tva: false, subtotal: false },
      sampleDocNum: 'CAT-2026-01',
      samplePartyTitle: 'قائمة الأسعار:',
      samplePartyName: 'الأسعار الرسمية المعتمدة للزبائن',
      samplePaymentMethod: 'أسعار التجزئة والباكي بالدينار الجزائري',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (Elio Cevital)', unit: 'قارورة', qty: 1, price: 650, discount: 0, tva: 0, subtotal: 650 },
        { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (Candia)', unit: 'علبة', qty: 1, price: 150, discount: 0, tva: 0, subtotal: 150 },
        { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (Bonal)', unit: 'علبة', qty: 1, price: 320, discount: 0, tva: 0, subtotal: 320 }
      ],
      sampleTotal: 1120,
      samplePaid: 1120,
      samplePrevDebt: 0
    },
    {
      id: 'production_order_sheet',
      num: 23,
      cat: 'INVENTORY',
      catLabel: '📦 المخزون والتصنيع (4)',
      name: '🏭 أمر تشغيل وتصنيع (Ordre de Fabrication BOM)',
      cleanTitle: 'أمر تشغيل وتصنيع داخلي / Ordre de Fabrication (BOM)',
      defaultPaper: 'a4',
      defaultTheme: 'emerald_dz',
      sourcePage: 'manufacturing',
      sourceLabel: 'التصنيع والإنتاج',
      proDesc: 'يوثق وصفة التصنيع، المواد الأولية المسحوبة، تكلفة الوحدة، والمنتج النهائي الناتج',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'PRD-2026-0011',
      samplePartyTitle: 'ورشة الإنتاج / الوصفة:',
      samplePartyName: 'إنتاج حزمة ترويجية / منتج مصنع جاهز',
      samplePaymentMethod: 'أمر إنتاج داخلي معتمد',
      sampleItems: [
        { barcode: 'RAW-001', name: 'مادة أولية مستهلكة رقم 1 (سحب من المخزون)', unit: 'كغ', qty: 10, price: 120, discount: 0, tva: 0, subtotal: 1200 },
        { barcode: 'RAW-002', name: 'مواد تغليف وتعبئة', unit: 'قطعة', qty: 20, price: 15, discount: 0, tva: 0, subtotal: 300 }
      ],
      sampleTotal: 1500,
      samplePaid: 1500,
      samplePrevDebt: 0
    },
    {
      id: 'low_stock_order_a4',
      num: 24,
      cat: 'INVENTORY',
      catLabel: '📦 المخزون والتصنيع (4)',
      name: '🚨 كشف النواقص وطلب التموين (Bon de Commande Interne)',
      cleanTitle: 'كشف النواقص المخزنية وطلب التموين / État des Ruptures',
      defaultPaper: 'a4',
      defaultTheme: 'amber_gold',
      sourcePage: 'inventory',
      sourceLabel: 'إدارة المخزون والتنبيهات',
      proDesc: 'قائمة الأصناف التي وصلت للحد الأدنى في المخزن لتسليمها للمورد أو المشتريات',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'RUP-2026-0003',
      samplePartyTitle: 'موجه إلى قسم:',
      samplePartyName: 'المشتريات والتموين — طلبية تعويض النواقص',
      samplePaymentMethod: 'نواقص حرجة تحت الحد الأدنى',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي (المتبقي بالسطوك: 2 — الحد الأدنى: 10)', unit: 'علبة', qty: 30, price: 55, discount: 0, tva: 0, subtotal: 1650 },
        { barcode: '6130006000017', name: 'غولد لاين (المتبقي بالسطوك: 1 — الحد الأدنى: 12)', unit: 'قطعة', qty: 24, price: 100, discount: 0, tva: 0, subtotal: 2400 }
      ],
      sampleTotal: 4050,
      samplePaid: 0,
      samplePrevDebt: 0
    },

    // ── المجموعة 5: الصندوق والجباية والرقابة (4 قوالب) ──
    {
      id: 'caisse_z_report',
      num: 25,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (4)',
      name: '🔒 تقرير إغلاق المناوبة وجرد الصندوق (Z-Report 80mm)',
      cleanTitle: 'تقرير إغلاق المناوبة وجرد الصندوق (Z-Report)',
      defaultPaper: '80mm',
      defaultTheme: 'executive_dark',
      sourcePage: 'caisse',
      sourceLabel: 'إدارة الصندوق والمناوبات',
      proDesc: 'ملخص إغلاق الصندوق الحراري: الرصيد الافتتاحي، المبيعات، المصاريف، والفارق النقدي',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'Z-SHIFT-0007',
      samplePartyTitle: 'المناوبة / الكاشير:',
      samplePartyName: 'مناوبة الصندوق #7 — المدير العام',
      samplePaymentMethod: 'جرد فعلي للدرج عند الإغلاق',
      sampleItems: [
        { barcode: 'OPEN', name: '1. الرصيد الافتتاحي في الدرج (Fond de Caisse)', unit: 'د.ج', qty: 1, price: 5000, discount: 0, tva: 0, subtotal: 5000 },
        { barcode: 'SALES', name: '2. إجمالي المبيعات النقدية المحصلة (+)', unit: 'د.ج', qty: 1, price: 17759, discount: 0, tva: 0, subtotal: 17759 },
        { barcode: 'EXP', name: '3. إجمالي المصاريف والمسحوبات النقدية (-)', unit: 'د.ج', qty: 1, price: -1500, discount: 0, tva: 0, subtotal: -1500 }
      ],
      sampleTotal: 21259,
      samplePaid: 21259,
      samplePrevDebt: 0
    },
    {
      id: 'expense_voucher',
      num: 26,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (4)',
      name: '💸 سند صرف مصروف أو حركة صندوق (Bon de Sortie 80mm)',
      cleanTitle: 'سند صرف نقدي من الصندوق / Bon de Sortie Caisse',
      defaultPaper: '80mm',
      defaultTheme: 'crimson_bold',
      sourcePage: 'expenses',
      sourceLabel: 'المصاريف ورأس المال والصندوق',
      proDesc: 'وصل إثبات سحب مبلغ نقدي من الدرج لمصروف تشغيلي مع توقيع المستلم',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'EXP-2026-0035',
      samplePartyTitle: 'فئة المصروف / المستفيد:',
      samplePartyName: 'مصاريف نقل وشحن البضاعة',
      samplePaymentMethod: 'سحب نقدي من مناوبة الصندوق',
      sampleItems: [
        { barcode: 'EXP-35', name: 'دفع مصاريف نقل وتفريغ البضاعة (خصم من صندوق الكاشير)', unit: 'سند', qty: 1, price: 1500, discount: 0, tva: 0, subtotal: 1500 }
      ],
      sampleTotal: 1500,
      samplePaid: 1500,
      samplePrevDebt: 0
    },
    {
      id: 'fiscal_g12_statement',
      num: 27,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (4)',
      name: '🇩🇿 استمارة التصريح الجبائي (IFU G12 / G50 A4)',
      cleanTitle: 'استمارة التصريح الجبائي الجزائري (IFU G12 / G50)',
      defaultPaper: 'a4',
      defaultTheme: 'emerald_dz',
      sourcePage: 'analytics',
      sourceLabel: 'الإحصائيات واستوديو الجباية (التبويب 13)',
      proDesc: 'كشف جبائي يفصل رقم أعمال المواد المقننة المعفاة والسلع العادية الخاضعة لـ 5%',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'tax_ifu_breakdown_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: false, unitPrice: false, discount: false, tva: true, subtotal: true },
      sampleDocNum: 'G12-2026-DZ',
      samplePartyTitle: 'المكلف بالضريبة الجزافية الوحيدة (IFU):',
      samplePartyName: 'Gherbi.Ai POS — تجارة بالتجزئة',
      samplePaymentMethod: 'تصريح سنوي IFU G12 (معدل 5%)',
      sampleItems: [
        { barcode: 'IFU-EX', name: 'رقم الأعمال للمواد المقننة السعر (حليب، خبز، سميد، زيت — هامش الربح الخاضع)', unit: 'جزافي', qty: 1, price: 45000, discount: 0, tva: 0, subtotal: 45000 },
        { barcode: 'IFU-5P', name: 'رقم الأعمال للسلع التجارية العادية الخاضعة لمعدل 5% (IFU)', unit: 'سنوي', qty: 1, price: 185000, discount: 0, tva: 5, subtotal: 185000 }
      ],
      sampleTotal: 230000,
      samplePaid: 230000,
      samplePrevDebt: 0
    },
    {
      id: 'forensic_audit_report',
      num: 28,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (4)',
      name: '🛡️ التقرير الجنائي لرقابة الكاشير وحماية الأرباح (A4)',
      cleanTitle: 'التقرير الجنائي الرسمي لرقابة الكاشير ومنع التلاعب',
      defaultPaper: 'a4',
      defaultTheme: 'crimson_bold',
      sourcePage: 'analytics',
      sourceLabel: 'رادار الرقابة الجنائية (التبويب 14)',
      proDesc: 'تقرير رقابي لصاحب المحل يوثق السطور المحذوفة بعد المسح، تفريغ السلة، والبيع بالخسارة',
      idealLayers: ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer'],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'AUDIT-2026-14',
      samplePartyTitle: 'نطاق الفحص الرقابي:',
      samplePartyName: 'جميع البائعين ومناوبات الكاشير',
      samplePaymentMethod: 'تقرير رقابي جنائي لحماية الأرباح',
      sampleItems: [
        { barcode: 'VOID-LINE', name: 'سطور محذوفة من السلة بعد قراءة الباركود (إلغاء قبل التسديد)', unit: 'حركة', qty: 3, price: 125, discount: 0, tva: 0, subtotal: 375 },
        { barcode: 'BELOW-COST', name: 'عمليات بيع بسعر التكلفة أو بأقل من سعر الشراء', unit: 'حركة', qty: 0, price: 0, discount: 0, tva: 0, subtotal: 0 }
      ],
      sampleTotal: 375,
      samplePaid: 0,
      samplePrevDebt: 0
    }
  ];

  const FULL_16_LAYERS = [
    { id: 'header_layer', cat: 'CORE', name: '🏢 ترويسة المتجر والشعار والبيانات الجبائية', desc: 'اسم المتجر، الشعار، الهاتف، العنوان، وأرقام RC / NIF / AI / NIS.', defaultVisible: true },
    { id: 'doc_banner_layer', cat: 'CORE', name: '🏷️ شريط عنوان ورقم المستند والباركود', desc: 'عنوان التذكرة/الفاتورة، رقمها التسلسلي، تاريخ وساعة الإصدار، والباركود.', defaultVisible: true },
    { id: 'customer_box_layer', cat: 'CORE', name: '👤 بطاقة بيانات الزبون / المورد والرصيد', desc: 'اسم الزبون أو المورد، رقم هاتفه، عنوانه، وبياناته الجبائية.', defaultVisible: true },
    { id: 'items_table_layer', cat: 'CORE', name: '📋 جدول الأصناف والكميات والأسعار', desc: 'جدول السلع أو البنود بتخطيط ذكي يتكيف تلقائياً مع 80mm و A4.', defaultVisible: true },
    { id: 'totals_words_layer', cat: 'CORE', name: '💰 شلال المجاميع بالدينار والسنتيم والتفقيط', desc: 'المجموع الفرعي، التخفيض، الصافي بالدينار والسنتيم، والمبلغ بالحروف.', defaultVisible: true },
    { id: 'loyalty_points_layer', cat: 'LOYALTY', name: '👑 بطاقة نقاط الوفاء والمخصوم من البطاقة (VIP & عابر)', desc: 'تعرض نوع الزبون، الرصيد السابق، المكتسب (+)، المخصوم (-)، والرصيد الجديد.', defaultVisible: true },
    { id: 'credit_carnet_layer', cat: 'FINANCE', name: '💳 كشف حساب الكريدي للزبون (Carnet de Crédit)', desc: 'صندوق أحمر يوضح الكريدي السابق، فاتورة اليوم، المدفوع اليوم، وإجمالي الكريدي المتبقي.', defaultVisible: false },
    { id: 'savings_promo_layer', cat: 'LOYALTY', name: '🎉 شريط "كم وفّرت اليوم؟" وعداد القطع الإجمالي', desc: 'يبرز للزبون إجمالي ما وفّره في الفاتورة وإجمالي عدد القطع المستلمة.', defaultVisible: false },
    { id: 'debt_ledger_layer', cat: 'FINANCE', name: '⚖️ كشف وضعية الديون والحساب التراكمي للزبون (A4)', desc: 'جدول يوضح الدين السابق + دين الفاتورة الحالية - المدفوع اليوم = إجمالي الدين المتبقي.', defaultVisible: false },
    { id: 'payment_breakdown_layer', cat: 'FINANCE', name: '💵 تفصيل المقبوض، الصرف المرجع (Rendu)، والبائع', desc: 'يعرض المبلغ المستلم من الزبون، الصرف المرجع له، طريقة الدفع، واسم الكاشير.', defaultVisible: false },
    { id: 'tax_ifu_breakdown_layer', cat: 'FINANCE', name: '🇩🇿 جدول تفصيل الضرائب (TVA / الطابع / المواد المقننة)', desc: 'يفصل المبلغ خارج الرسم HT، ضريبة TVA، الطابع الجبائي، والسلع المقننة.', defaultVisible: false },
    { id: 'warranty_imei_layer', cat: 'LOGISTICS', name: '🛡️ شهادة الضمان والأرقام التسلسلية (IMEI / S-N)', desc: 'صندوق مخصص لمدة الضمان، شروط الصيانة، والأرقام التسلسلية للأجهزة.', defaultVisible: false },
    { id: 'installments_schedule_layer', cat: 'LOGISTICS', name: '🗓️ جدول الأقساط الشهرية ومواعيد الاستحقاق', desc: 'يعرض الدفعة الأولى (التسبيق)، عدد الأقساط الشهرية، قيمة كل قسط، وتواريخ الاستحقاق.', defaultVisible: false },
    { id: 'delivery_driver_layer', cat: 'LOGISTICS', name: '🚚 بطاقة التوصيل، السائق، عدد الطرود، وإمضاء الاستلام', desc: 'اسم السائق، رقم المركبة، عدد الكراتين/الطرود (Colis)، وخانة إمضاء الاستلام.', defaultVisible: false },
    { id: 'qr_social_wifi_layer', cat: 'LOYALTY', name: '📱 رمز QR، حسابات التواصل، وكود Wi-Fi الزبائن', desc: 'رمز استجابة سريعة للمتجر مع صفحات فيسبوك/واتساب أو كود Wi-Fi الزبائن.', defaultVisible: false },
    { id: 'footer_stamp_layer', cat: 'CORE', name: '✒️ التذييل، شروط الاستبدال، رمز RIP، والختم', desc: 'شروط الإرجاع والاستبدال خلال 48 ساعة، رقم حساب BaridiMob RIP، ومربع الختم.', defaultVisible: true }
  ];

  const VISUAL_THEMES = [
    { id: 'royal_blue', name: 'الأزرق الملكي التجاري', primary: '#1d4ed8', accent: '#eff6ff', border: '#93c5fd' },
    { id: 'emerald_dz', name: 'الأخضر الجزائري الرسمي', primary: '#047857', accent: '#ecfdf5', border: '#6ee7b7' },
    { id: 'executive_dark', name: 'الكحلي التنفيذي الفاخر', primary: '#0f172a', accent: '#f1f5f9', border: '#94a3b8' },
    { id: 'crimson_bold', name: 'القرمزي البارز للعروض', primary: '#be123c', accent: '#fff1f2', border: '#fda4af' },
    { id: 'amber_gold', name: 'الذهبي الكلاسيكي', primary: '#b45309', accent: '#fffbeb', border: '#fcd34d' },
    { id: 'pure_mono', name: 'الأسود والأبيض الاقتصادي', primary: '#000000', accent: '#ffffff', border: '#000000' }
  ];

  const PAPER_SIZE_META = {
    a4: { label: 'مقاس A4 رسمي كامل (210×297 mm)', badge: 'A4', aspectW: 26, aspectH: 36 },
    a5: { label: 'مقاس A5 نصفي مدمج (148×210 mm)', badge: 'A5', aspectW: 22, aspectH: 30 },
    '2xa5': { label: 'مقاس 2×A5 مزدوج (نسختان في ورقة A4)', badge: '2×A5', aspectW: 38, aspectH: 26 },
    '80mm': { label: 'رول حراري 80mm قياسي للكاشير', badge: '80MM', aspectW: 18, aspectH: 36 },
    '58mm': { label: 'رول حراري 58mm صغير', badge: '58MM', aspectW: 14, aspectH: 32 }
  };

  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.App) return;
    clearInterval(waitStudio);

    studio.ALL_28_MASTER_DOCS = PRO_28_TEMPLATES;
    studio.FULL_16_LAYERS_CATALOG = FULL_16_LAYERS;
    studio.defaultsCategoryFilter = studio.defaultsCategoryFilter || 'ALL';
    studio.defaultsSearchQuery = studio.defaultsSearchQuery || '';

    // 1. بناء وحقن القالب الاحترافي الافتراضي (Tailor-Made Par Défaut) لأي مستند أو لكل الـ 28 مستنداً
    studio.buildIdealProfileObjectForDoc = function (docMeta) {
      const activeSet = new Set(docMeta.idealLayers || ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer']);
      const layersList = FULL_16_LAYERS.map((cat) => ({
        id: cat.id,
        name: cat.name,
        visible: activeSet.has(cat.id),
        align: 'between',
        customNote: ''
      }));

      return {
        paperSize: docMeta.defaultPaper,
        themeId: docMeta.defaultTheme,
        fontFamily: 'Cairo',
        baseFontSizePx: docMeta.defaultPaper === '80mm' || docMeta.defaultPaper === '58mm' ? 11.5 : 12,
        marginMode: 'normal',
        densityMode: 'normal',
        borderMode: docMeta.defaultPaper === '80mm' ? 'dashed' : 'grid',
        watermarkText: '',
        customHeaderTitle: docMeta.cleanTitle,
        customFooterTerms: this.config.customFooterTerms || 'البضاعة المباعة تستبدل خلال 48 ساعة بشرط سلامة الغلاف الأصلي وإحضار التذكرة. شكراً لزيارتكم!',
        showCentimesEquivalent: true,
        showAmountInWords: true,
        showCustomerBalance: true,
        showBaridimobQr: true,
        showDocBarcode: true,
        showStampSignature: true,
        customTexts: JSON.parse(JSON.stringify(this.config.customTexts || {})),
        columns: { ...(docMeta.idealCols || { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true }) },
        layers: layersList
      };
    };

    // تهيئة القوالب الاحترافية الـ 28 تلقائياً عند الإقلاع إذا لم تكن مهيأة أو إذا كان جدول الأصناف مخفياً بالخطأ
    function ensureAll28ProProfilesInitialized() {
      if (!studio.config.defaultsByDocType) studio.config.defaultsByDocType = {};
      if (!studio.config.adoptedProfiles) studio.config.adoptedProfiles = {};

      for (const docMeta of PRO_28_TEMPLATES) {
        if (!studio.config.defaultsByDocType[docMeta.id]) {
          studio.config.defaultsByDocType[docMeta.id] = {
            paperSize: docMeta.defaultPaper,
            themeId: docMeta.defaultTheme,
            lang: 'ar',
            adopted: true
          };
        }
        const existingProf = studio.config.adoptedProfiles[docMeta.id];
        if (!existingProf || !Array.isArray(existingProf.layers) || existingProf.layers.length < 10) {
          studio.config.adoptedProfiles[docMeta.id] = studio.buildIdealProfileObjectForDoc(docMeta);
        } else {
          // ضمان أن جدول الأصناف (items_table_layer) مفعل دائماً
          const tblLayer = existingProf.layers.find((x) => x.id === 'items_table_layer');
          if (tblLayer) tblLayer.visible = true;
        }
      }
      studio.loadProfileForDocType(studio.config.activeDocType || 'receipt_thermal');
      studio.saveConfigLocal();
    }

    // 2. تحميل القالب المخصص لأي مستند من الـ 28 مستنداً
    studio.loadProfileForDocType = function (docId) {
      const docMeta = PRO_28_TEMPLATES.find((d) => d.id === docId) || PRO_28_TEMPLATES[0];
      const def = this.config.defaultsByDocType[docMeta.id] || {
        paperSize: docMeta.defaultPaper,
        themeId: docMeta.defaultTheme
      };
      let prof = this.config.adoptedProfiles && this.config.adoptedProfiles[docMeta.id];
      if (!prof) {
        prof = this.buildIdealProfileObjectForDoc(docMeta);
        this.config.adoptedProfiles[docMeta.id] = prof;
      }

      this.config.activeDocType = docMeta.id;
      this.config.paperSize = def.paperSize || prof.paperSize || docMeta.defaultPaper;
      this.config.themeId = def.themeId || prof.themeId || docMeta.defaultTheme;
      this.config.baseFontSizePx = prof.baseFontSizePx || 11.5;
      this.config.watermarkText = prof.watermarkText || '';
      this.config.customHeaderTitle = prof.customHeaderTitle || docMeta.cleanTitle;
      this.config.columns = { ...this.config.columns, ...(prof.columns || docMeta.idealCols) };

      // دمج الطبقات الـ 16 مع الحفاظ على ترتيب وتفعيل القالب
      const savedMap = new Map((prof.layers || []).map((l) => [l.id, l]));
      const mergedLayers = [];
      for (const cat of FULL_16_LAYERS) {
        if (savedMap.has(cat.id)) {
          const lObj = savedMap.get(cat.id);
          if (cat.id === 'items_table_layer' || cat.id === 'header_layer') lObj.visible = true;
          mergedLayers.push(lObj);
          savedMap.delete(cat.id);
        } else {
          mergedLayers.push({
            id: cat.id,
            name: cat.name,
            visible: (docMeta.idealLayers || []).includes(cat.id),
            align: 'between',
            customNote: ''
          });
        }
      }
      for (const customL of savedMap.values()) {
        mergedLayers.push(customL);
      }
      this.config.layers = mergedLayers;
    };

    // استعادة/تطبيق القالب الاحترافي المثالي (Par Défaut) لمستند واحد بضغطة زر
    studio.applySingleProDefaultTemplate = async function (docId) {
      const docMeta = PRO_28_TEMPLATES.find((d) => d.id === docId) || PRO_28_TEMPLATES[0];
      const idealProf = this.buildIdealProfileObjectForDoc(docMeta);

      this.config.defaultsByDocType[docMeta.id] = {
        paperSize: docMeta.defaultPaper,
        themeId: docMeta.defaultTheme,
        lang: 'ar',
        adopted: true
      };
      this.config.adoptedProfiles[docMeta.id] = idealProf;

      if (this.config.activeDocType === docMeta.id) {
        this.loadProfileForDocType(docMeta.id);
        this.activeLoadedDocData = null;
      }

      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
      if (window.showToast) {
        window.showToast(`⚡ تم تفعيل واعتماد القالب الاحترافي المثالي لـ (${docMeta.name}) بنجاح!`, 'success');
      }
    };

    // اعتماد القوالب الاحترافية المثالية لجميع الـ 28 مستنداً دفعة واحدة
    studio.adoptAllIdealPresetsAcrossAllPages = async function () {
      for (const docMeta of PRO_28_TEMPLATES) {
        this.config.defaultsByDocType[docMeta.id] = {
          paperSize: docMeta.defaultPaper,
          themeId: docMeta.defaultTheme,
          lang: 'ar',
          adopted: true
        };
        this.config.adoptedProfiles[docMeta.id] = this.buildIdealProfileObjectForDoc(docMeta);
      }
      this.loadProfileForDocType(this.config.activeDocType || 'receipt_thermal');
      this.activeLoadedDocData = null;
      this.saveConfigLocal();
      await this.renderStudioIntoRoot();
      if (window.showToast) {
        window.showToast('🚀 تم شحن واعتماد القوالب الاحترافية الـ 28 (Par Défaut) لجميع صفحات البرنامج بنجاح!', 'success');
      }
    };

    // 3. بناء القائمة المنسدلة للـ 28 مستنداً مقسمة في 5 مجموعات واضحة
    studio.build28DocsGroupedOptionsHtml = function (selectedDocId) {
      const groups = ['POS', 'CREDIT', 'PURCHASES', 'INVENTORY', 'FINANCE'];
      return groups
        .map((gKey) => {
          const docsInGroup = PRO_28_TEMPLATES.filter((d) => d.cat === gKey);
          if (docsInGroup.length === 0) return '';
          const groupLabel = docsInGroup[0].catLabel;
          const opts = docsInGroup
            .map(
              (d) =>
                `<option value="${d.id}" ${selectedDocId === d.id ? 'selected' : ''}>${d.num}. ${d.name}</option>`
            )
            .join('');
          return `<optgroup label="${groupLabel}">${opts}</optgroup>`;
        })
        .join('');
    };

    // 4. توفير البيانات النموذجية الواقعية لكل واحد من الـ 28 مستنداً
    const baseResolveData = studio.resolveActiveDocumentData.bind(studio);
    studio.resolveActiveDocumentData = async function (overrideDocType) {
      if (!overrideDocType && this.activeLoadedDocData) {
        return this.activeLoadedDocData;
      }

      const docType = overrideDocType || this.config.activeDocType || 'receipt_thermal';
      const docMeta = PRO_28_TEMPLATES.find((d) => d.id === docType) || PRO_28_TEMPLATES[0];

      if (this.selectedRecordId && this.selectedRecordId !== 'SAMPLE') {
        const real = await baseResolveData(overrideDocType);
        if (real) return real;
      }

      const isWalkinSim = this.loyaltySimMode === 'walkin';
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const builtData = this.enrichDocumentDataWithLoyaltyAndDebt({
        docNumber: docMeta.sampleDocNum || 'DOC-2026-001',
        date: nowStr,
        isWalkinCustomer: isWalkinSim,
        partyTitle: docMeta.samplePartyTitle || 'الزبون:',
        partyName: isWalkinSim && docMeta.cat === 'POS' ? 'زبون عابر (Comptoir)' : docMeta.samplePartyName,
        partyPhone: isWalkinSim ? '-' : '0550 12 34 56',
        partyAddress: 'حي البدر، قسنطينة — الجزائر',
        partyRc: '21/00-4589210B19',
        partyNif: '002104589210045',
        paymentMethod: docMeta.samplePaymentMethod || 'نقداً',
        previousBalance: isWalkinSim ? 0 : Number(docMeta.samplePrevDebt || 0),
        items: JSON.parse(JSON.stringify(docMeta.sampleItems)),
        subtotal: Number(docMeta.sampleTotal || 0),
        discount: 0,
        tvaAmount: 0,
        stampAmount: 0,
        total: Number(docMeta.sampleTotal || 0),
        paidAmount: Number(docMeta.samplePaid ?? docMeta.sampleTotal ?? 0),
        receivedAmount: Number(docMeta.samplePaid ?? docMeta.sampleTotal ?? 0),
        remainingDebt: Math.max(0, Number((Number(docMeta.sampleTotal || 0) - Number(docMeta.samplePaid ?? docMeta.sampleTotal ?? 0)).toFixed(2)))
      });

      if (!overrideDocType) {
        this.activeLoadedDocData = JSON.parse(JSON.stringify(builtData));
      }
      return builtData;
    };

    // 5. بناء الواجهة الكاملة لمركز الطباعة (V59) بعرض كامل 100% وبدون أي تداخل
    studio.renderStudioIntoRoot = async function (rootEl) {
      const targetRoot = rootEl || document.getElementById('print-view-root');
      if (!targetRoot) return;

      const cfg = this.config;
      const activeDocMeta = PRO_28_TEMPLATES.find((d) => d.id === cfg.activeDocType) || PRO_28_TEMPLATES[0];
      const docData = await this.resolveActiveDocumentData();

      let sectionBodyHtml = '';

      if (this.activeSection === 'visual_studio') {
        const paperHtml = this.buildLiveDocumentPaperHtml(docData, false);

        let recordsList = [];
        if (activeDocMeta.sourcePage === 'purchases') recordsList = this.liveDataRecords.purchases || [];
        else if (activeDocMeta.sourcePage === 'proformas') recordsList = this.liveDataRecords.proformas || [];
        else if (activeDocMeta.sourcePage === 'orders') recordsList = this.liveDataRecords.orders || [];
        else recordsList = this.liveDataRecords.sales || [];

        const recordOptionsHtml = [
          `<option value="SAMPLE" ${this.selectedRecordId === 'SAMPLE' ? 'selected' : ''}>✨ بيانات نموذجية احترافية جاهزة للتعديل الحر</option>`,
          ...recordsList.slice(0, 50).map((r) => {
            const num = r.doc_number || r.invoice_number || ('#' + r.id);
            const party = r.customer_name || r.supplier_name || 'زبون عابر';
            const tot = Number(r.total || 0).toFixed(2);
            return `<option value="${r.id}" ${String(this.selectedRecordId) === String(r.id) ? 'selected' : ''}>📄 ${num} — ${party} (${tot} د.ج)</option>`;
          })
        ].join('');

        const filteredCatalog = FULL_16_LAYERS.filter(
          (c) => this.catalogCategoryFilter === 'ALL' || c.cat === this.catalogCategoryFilter
        );

        const suggestedCatalogHtml = filteredCatalog
          .map((catItem) => {
            const layerState = cfg.layers.find((l) => l.id === catItem.id);
            const isVis = Boolean(layerState && layerState.visible);
            return `
              <div class="p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
                isVis
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }">
                <div class="space-y-0.5">
                  <div class="font-black text-xs text-slate-900 dark:text-white">${catItem.name}</div>
                  <div class="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">${catItem.desc}</div>
                </div>
                <button type="button" onclick="window.GherbiPrintStudioV45.activateSuggestedLayerFromCatalog('${catItem.id}')" class="shrink-0 px-2.5 py-1.5 rounded-xl font-black text-[11px] transition cursor-pointer ${
                  isVis
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-rose-600'
                    : 'bg-blue-600 text-white shadow-sm hover:bg-blue-500'
                }">
                  ${isVis ? '✅ مفعّلة' : '➕ إضافة'}
                </button>
              </div>
            `;
          })
          .join('');

        sectionBodyHtml = `
          <!-- شريط Word العلوي للتحكم في المستند من الـ 28 قالباً والمقاس واللون والاعتماد -->
          <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
              <div class="flex flex-wrap items-center gap-2">
                <label class="text-xs font-black text-slate-700 dark:text-slate-200">📑 اختر من الـ 28 مستنداً:</label>
                <select onchange="window.GherbiPrintStudioV45.selectDocType(this.value)" class="px-3 py-2 rounded-xl bg-blue-50 dark:bg-slate-900 border-2 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-200 font-black text-xs cursor-pointer min-w-[270px]">
                  ${this.build28DocsGroupedOptionsHtml(cfg.activeDocType)}
                </select>

                <select onchange="window.GherbiPrintStudioV45.selectLiveRecord(this.value)" class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-xs max-w-xs cursor-pointer">
                  ${recordOptionsHtml}
                </select>

                <button type="button" onclick="window.GherbiPrintStudioV45.applySingleProDefaultTemplate('${cfg.activeDocType}')" class="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 border border-amber-400 font-black text-xs transition cursor-pointer" title="تطبيق التصميم الافتراضي الاحترافي الجاهز لهذا المستند">
                  ⚡ استعادة القالب الاحترافي الجاهز
                </button>

                <button type="button" onclick="window.App.switchView('${activeDocMeta.sourcePage}')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 font-black text-xs transition cursor-pointer">
                  🔗 افتح (${activeDocMeta.sourceLabel}) ⬅
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.saveAsDefaultForDocType()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5">
                  <span>⭐ اعتماد وحفظ كأمر مطلق للطباعة (Par Défaut)</span>
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.printCurrentCanvasNow()" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition cursor-pointer">
                  🖨️ طباعة / PDF الآن
                </button>
              </div>
            </div>

            <!-- الصف الثاني من شريط الأدوات -->
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-black text-slate-500 text-[11px]">📐 المقاس:</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('a4')" class="v45-word-ribbon-btn ${cfg.paperSize === 'a4' ? 'active' : ''}">A4 رسمي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('a5')" class="v45-word-ribbon-btn ${cfg.paperSize === 'a5' ? 'active' : ''}">A5 نصفي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('2xa5')" class="v45-word-ribbon-btn ${cfg.paperSize === '2xa5' ? 'active' : ''}">2×A5 مزدوج</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('80mm')" class="v45-word-ribbon-btn ${cfg.paperSize === '80mm' ? 'active' : ''}">80mm حراري</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('58mm')" class="v45-word-ribbon-btn ${cfg.paperSize === '58mm' ? 'active' : ''}">58mm حراري</button>

                <span class="mx-1 text-slate-300">|</span>
                <span class="font-black text-slate-500 text-[11px]">🎨 الثيم:</span>
                <select onchange="window.GherbiPrintStudioV45.updateCfg('themeId', this.value)" class="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs cursor-pointer">
                  ${VISUAL_THEMES.map((t) => `<option value="${t.id}" ${cfg.themeId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>

                <span class="mx-1 text-slate-300">|</span>
                <span class="font-black text-slate-500 text-[11px]">🔤 الخط:</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.stepFontSize(-0.5)" class="v45-word-ribbon-btn">-A</button>
                <span class="font-mono font-black px-1">${cfg.baseFontSizePx}px</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.stepFontSize(0.5)" class="v45-word-ribbon-btn">+A</button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <div class="inline-flex items-center rounded-xl bg-amber-50 dark:bg-slate-900 border border-amber-300 p-0.5 text-[11px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.switchLoyaltySimulationMode('vip')" class="px-2 py-1 rounded-lg font-black cursor-pointer ${this.loyaltySimMode === 'vip' ? 'bg-amber-500 text-slate-950' : 'text-amber-800'}">👑 زبون وفي</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.switchLoyaltySimulationMode('walkin')" class="px-2 py-1 rounded-lg font-black cursor-pointer ${this.loyaltySimMode === 'walkin' ? 'bg-slate-800 text-white' : 'text-slate-600'}">🚶 زبون عابر (0 ن)</button>
                </div>
                <button type="button" onclick="window.GherbiPrintStudioV45.addRowToActiveTicket()" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer">➕ سطر جديد</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.removeLastRowFromActiveTicket()" class="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-black text-[11px] cursor-pointer">➖ حذف سطر</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.triggerLogoUploadFromStudio()" class="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-black text-[11px] cursor-pointer">📷 الشعار</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showCentimesEquivalent')" class="v45-word-ribbon-btn ${cfg.showCentimesEquivalent ? 'active' : ''}">🇩🇿 السنتيم</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showCustomerBalance')" class="v45-word-ribbon-btn ${cfg.showCustomerBalance ? 'active' : ''}">⚖️ الباقي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showDocBarcode')" class="v45-word-ribbon-btn ${cfg.showDocBarcode ? 'active' : ''}">||| باركود</button>
              </div>
            </div>
          </div>

          <!-- تخطيط استوديو التصميم المضمون بعرض 100% (يمين: الطبقات والأعمدة | يسار: الورقة الحية) -->
          <div class="v59-studio-main-grid">
            <div class="space-y-3.5 max-h-[78vh] overflow-y-auto pl-1">
              <!-- 1. مكتبة الطبقات الذكية المقترحة (16 طبقة) -->
              <div class="rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-400/60 dark:border-indigo-600/60 p-4 shadow-sm space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <div>
                    <h3 class="font-black text-xs text-indigo-900 dark:text-indigo-300">🧩 مكتبة الطبقات الذكية المقترحة (16 طبقة)</h3>
                    <p class="text-[10.5px] text-slate-500 mt-0.5">أضف أو أخفِ أي طبقة بضغطة زر على التذكرة أو الفاتورة</p>
                  </div>
                  <button type="button" onclick="window.GherbiPrintStudioV45.enableAllSuggestedLayers()" class="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-600 text-indigo-800 hover:text-white font-black text-[10.5px] transition cursor-pointer">
                    ✨ تفعيل الكل
                  </button>
                </div>

                <div class="flex flex-wrap items-center gap-1 text-[11px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('ALL')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${this.catalogCategoryFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">الكل (${FULL_16_LAYERS.length})</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('LOYALTY')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${this.catalogCategoryFilter === 'LOYALTY' ? 'bg-amber-500 text-slate-950' : 'bg-amber-50 dark:bg-slate-700 text-amber-800 dark:text-amber-300'}">👑 الوفاء</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('FINANCE')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${this.catalogCategoryFilter === 'FINANCE' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-slate-700 text-emerald-800 dark:text-emerald-300'}">💳 الكريدي والمالية</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('LOGISTICS')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${this.catalogCategoryFilter === 'LOGISTICS' ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-blue-300'}">🚚 الضمان والتوصيل</button>
                </div>

                <div class="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  ${suggestedCatalogHtml}
                </div>
              </div>

              <!-- 2. ترتيب طبقات المستند (Photoshop Layers) -->
              <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-2.5">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h3 class="font-black text-xs text-slate-900 dark:text-white">🗂️ ترتيب طبقات المستند (Photoshop Layers)</h3>
                  <button type="button" onclick="window.GherbiPrintStudioV45.addCustomLayerBlock()" class="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-[11px] hover:bg-blue-500 cursor-pointer">
                    + طبقة نصية حرة
                  </button>
                </div>

                <div class="space-y-1.5 max-h-56 overflow-y-auto">
                  ${cfg.layers
                    .map(
                      (l, idx) => `
                      <div data-v47-sidebar-layer-id="${l.id}" onclick="window.GherbiPrintStudioV45.selectLayerDomOnly('${l.id}')" class="flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                        this.selectedLayerId === l.id
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 font-black'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 font-bold'
                      }">
                        <div class="flex items-center gap-2 truncate">
                          <input type="checkbox" ${l.visible ? 'checked' : ''} onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleLayerVisibility('${l.id}')" class="w-4 h-4 accent-blue-600 rounded cursor-pointer">
                          <span class="truncate ${l.visible ? '' : 'line-through text-slate-400'}">${l.name}</span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayer('${l.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] hover:bg-blue-600 hover:text-white disabled:opacity-30">▲</button>
                          <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayer('${l.id}', 1)" ${idx === cfg.layers.length - 1 ? 'disabled' : ''} class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] hover:bg-blue-600 hover:text-white disabled:opacity-30">▼</button>
                          ${
                            l.id.startsWith('custom_')
                              ? `<button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.deleteCustomLayer('${l.id}')" class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 text-[10px] hover:bg-rose-600 hover:text-white">✕</button>`
                              : ''
                          }
                        </div>
                      </div>`
                    )
                    .join('')}
                </div>
              </div>

              <!-- 3. تخصيص أعمدة الجدول -->
              <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-2.5 text-xs">
                <h3 class="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
                  📊 تخصيص أعمدة وبيانات جدول التذكرة / الفاتورة
                </h3>
                <div class="grid grid-cols-2 gap-2 font-bold">
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.index ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('index')" class="accent-blue-600"> <span>رقم السطر (#)</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.barcode ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('barcode')" class="accent-blue-600"> <span>الباركود</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.name ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('name')" class="accent-blue-600"> <span>اسم الصنف</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.unit ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('unit')" class="accent-blue-600"> <span>الوحدة</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.qty ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('qty')" class="accent-blue-600"> <span>الكمية</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.unitPrice ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('unitPrice')" class="accent-blue-600"> <span>سعر الوحدة</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.discount ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('discount')" class="accent-blue-600"> <span>الخصم</span></label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.tva ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('tva')" class="accent-blue-600"> <span>ضريبة TVA</span></label>
                </div>
              </div>
            </div>

            <!-- يسار: الورقة التفاعلية الحية القابلة للكتابة والتعديل المباشر -->
            <div class="w-full min-w-0">
              <div class="v45-studio-workspace max-h-[78vh] w-full">
                <div id="v45LivePaperHost">
                  ${paperHtml}
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (this.activeSection === 'cross_page_bridge') {
        const cat = this.bridgeCategory || 'sales';
        const q = (this.bridgeSearch || '').trim().toLowerCase();
        let list = this.liveDataRecords[cat] || [];
        if (q) {
          list = list.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
        }

        const rowsHtml =
          list.length > 0
            ? list
                .slice(0, 50)
                .map((r) => {
                  const num = r.doc_number || r.invoice_number || ('#' + r.id);
                  const dt = String(r.sale_date || r.date || r.created_at || '').replace('T', ' ').slice(0, 16);
                  const party = r.customer_name || r.supplier_name || r.name || 'زبون عابر';
                  const tot = Number(r.total ?? r.total_debt ?? r.selling_price ?? 0);
                  const targetDocType =
                    cat === 'purchases'
                      ? 'purchase_invoice'
                      : cat === 'proformas'
                      ? 'proforma'
                      : cat === 'orders'
                      ? 'customer_order'
                      : 'invoice_a4';

                  return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-slate-800/50 text-xs">
                      <td class="py-3 px-3 font-mono font-black text-blue-600">${num}</td>
                      <td class="py-3 px-3 font-mono text-slate-500">${dt}</td>
                      <td class="py-3 px-3 font-black text-slate-900 dark:text-white">${party}</td>
                      <td class="py-3 px-3 font-mono font-black text-emerald-600">${this.fmtDzd(tot)}</td>
                      <td class="py-3 px-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                          <button type="button" onclick="window.App.openDocumentInPrintStudio('${targetDocType}', '${r.id}')" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] shadow-sm cursor-pointer">
                            🎨 فتح وتعديل الفاتورة (A4/A5)
                          </button>
                          <button type="button" onclick="window.App.openDocumentInPrintStudio('receipt_thermal', '${r.id}')" class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] cursor-pointer">
                            🧾 فتح كتذكرة كاشير (80mm)
                          </button>
                          <button type="button" onclick="window.App.openDocumentInPrintStudio('delivery_note', '${r.id}')" class="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] cursor-pointer">
                            🚚 وصل BL
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')
            : `<tr><td colspan="5" class="py-10 text-center text-slate-400 font-bold">لا توجد سجلات مطابقة في هذا القسم حالياً.</td></tr>`;

        sectionBodyHtml = `
          <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 w-full">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">🔗 جسر الربط الحي مع جميع صفحات البرنامج</h3>
                <p class="text-xs text-slate-500">اختر أي فاتورة أو تذكرة من أقسام البرنامج بالأسفل لفتحها وتعديلها أو طباعتها فوراً</p>
              </div>
              <div class="flex items-center gap-2">
                <input type="text" value="${this.bridgeSearch}" oninput="window.GherbiPrintStudioV45.setBridgeSearch(this.value)" placeholder="🔎 ابحث برقم الفاتورة أو اسم الزبون..." class="w-64 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold">
                <button type="button" onclick="window.GherbiSalesTurbo && window.GherbiSalesTurbo.exportFilteredSalesPdfReport()" class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-sm cursor-pointer">📄 تصدير PDF</button>
                <button type="button" onclick="window.GherbiSalesTurbo && window.GherbiSalesTurbo.exportFilteredSalesExcel()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm cursor-pointer">📊 تصدير Excel</button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" onclick="window.GherbiPrintStudioV45.setBridgeCategory('sales')" class="px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${cat === 'sales' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                🧾 فواتير المبيعات والضمان (${(this.liveDataRecords.sales || []).length})
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setBridgeCategory('purchases')" class="px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${cat === 'purchases' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                🛍️ فواتير المشتريات والتموين (${(this.liveDataRecords.purchases || []).length})
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setBridgeCategory('proformas')" class="px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${cat === 'proformas' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                📋 الفواتير الشكلية (${(this.liveDataRecords.proformas || []).length})
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setBridgeCategory('orders')" class="px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${cat === 'orders' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                📦 طلبيات الزبائن (${(this.liveDataRecords.orders || []).length})
              </button>
            </div>

            <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 max-h-[480px]">
              <table class="w-full text-right border-collapse">
                <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black border-b border-slate-200">
                  <tr>
                    <th class="py-3 px-3">رقم المستند</th>
                    <th class="py-3 px-3">التاريخ والتوقيت</th>
                    <th class="py-3 px-3">الطرف (الزبون / المورد)</th>
                    <th class="py-3 px-3">المبلغ الإجمالي</th>
                    <th class="py-3 px-3 text-center">إجراءات الفتح والتعديل والطباعة</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>
        `;
      } else if (this.activeSection === 'barcode_shelf_factory') {
        const lCfg = cfg.labelCfg;
        const products = this.liveDataRecords.products || [];
        const previewProd =
          products.find((p) => Number(p.id) === Number(lCfg.previewProductId)) ||
          products[0] || { id: 1, name: 'غولد لاين (GOLD LINE)', barcode: '6134843000591', selling_price: 125 };

        const labelPreviewHtml = this.buildSingleLabelOrShelfTagHtml(previewProd, lCfg);
        const totalStickersInQueue = this.labelQueue.reduce((s, q) => s + Number(q.copies || 1), 0);

        const queueRowsHtml =
          this.labelQueue.length > 0
            ? this.labelQueue
                .map(
                  (item, idx) => `
                  <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
                    <td class="py-2 px-3 font-black">${item.name}</td>
                    <td class="py-2 px-3 font-mono text-slate-500">${item.barcode}</td>
                    <td class="py-2 px-3 font-mono font-black text-blue-600">${this.fmtDzd(item.price)}</td>
                    <td class="py-2 px-3">
                      <input type="number" min="1" max="500" value="${item.copies}" onchange="window.GherbiPrintStudioV45.updateQueueItemCopies(${idx}, this.value)" class="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 font-mono font-black text-center">
                    </td>
                    <td class="py-2 px-3 text-center">
                      <button type="button" onclick="window.GherbiPrintStudioV45.removeQueueItem(${idx})" class="px-2 py-1 rounded-lg bg-rose-100 text-rose-600 font-black">✕</button>
                    </td>
                  </tr>`
                )
                .join('')
            : `<tr><td colspan="5" class="py-6 text-center text-slate-400 font-bold">الطابور فارغ — أضف منتجات من الأعلى لطباعة الملصقات.</td></tr>`;

        sectionBodyHtml = `
          <div class="v59-studio-main-grid">
            <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 text-xs">
              <h3 class="text-base font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">🏷️ مصنع ملصقات الباركود وبطاقات أسعار الرفوف</h3>
              <div class="space-y-3">
                <div>
                  <label class="block font-black mb-1">📦 اختر منتجاً للمعاينة أو الإضافة للطابور:</label>
                  <div class="flex gap-1.5">
                    <select onchange="window.GherbiPrintStudioV45.selectPreviewProduct(this.value)" class="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold">
                      ${products.slice(0, 200).map((p) => `<option value="${p.id}" ${Number(lCfg.previewProductId) === Number(p.id) ? 'selected' : ''}>${p.name} (${p.selling_price} د.ج)</option>`).join('')}
                    </select>
                    <button type="button" onclick="window.GherbiPrintStudioV45.addCurrentPreviewProductToQueue()" class="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-black whitespace-nowrap cursor-pointer">+ أضف</button>
                  </div>
                </div>
              </div>
              <div class="overflow-x-auto max-h-56 rounded-xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-right border-collapse">
                  <thead class="bg-slate-100 dark:bg-slate-800 text-[11px] font-black">
                    <tr><th class="py-2 px-3">الصنف</th><th class="py-2 px-3">الباركود</th><th class="py-2 px-3">السعر</th><th class="py-2 px-3">العدد</th><th class="py-2 px-3">حذف</th></tr>
                  </thead>
                  <tbody>${queueRowsHtml}</tbody>
                </table>
              </div>
            </div>

            <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div class="v45-studio-workspace min-h-[240px] items-center">${labelPreviewHtml}</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.printSinglePreviewLabelNow()" class="w-full py-3 rounded-2xl bg-blue-600 text-white font-black text-xs shadow-md cursor-pointer">🖨️ طباعة الملصق المعاين</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.printAllQueuedLabelsSheet()" class="w-full py-3 rounded-2xl bg-slate-900 text-amber-400 font-black text-xs shadow-md cursor-pointer">🚀 طباعة الطابور بالكامل (${totalStickersInQueue} ملصق)</button>
              </div>
            </div>
          </div>
        `;
      } else if (this.activeSection === 'free_word_editor') {
        const fd = this.freeDoc;
        const shop = this.getShopIdentity();
        const freeTotal = fd.items.reduce((s, it) => s + Number(it.qty || 1) * Number(it.price || 0), 0);

        sectionBodyHtml = `
          <div class="v59-studio-main-grid">
            <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3 text-xs">
              <h3 class="text-sm font-black text-slate-900 dark:text-white border-b pb-2">📝 منشئ البونات والوثائق الحرة (Word)</h3>
              <div><label class="block font-bold mb-1">عنوان الوثيقة:</label><input type="text" value="${fd.title}" oninput="window.GherbiPrintStudioV45.updateFreeDoc('title', this.value)" class="w-full px-3 py-2 rounded-xl border font-black"></div>
              <div><label class="block font-bold mb-1">الطرف المعني:</label><input type="text" value="${fd.recipient}" oninput="window.GherbiPrintStudioV45.updateFreeDoc('recipient', this.value)" class="w-full px-3 py-2 rounded-xl border font-bold"></div>
              <button type="button" onclick="window.GherbiPrintStudioV45.printFreeWordDocumentNow()" class="w-full py-3 rounded-2xl bg-blue-600 text-white font-black text-xs shadow-lg cursor-pointer">🖨️ طباعة الوثيقة الحرة الآن</button>
            </div>
            <div class="w-full min-w-0">
              <div class="v45-studio-workspace max-h-[75vh]">
                <div id="v45FreeWordPaperHost" class="v45-live-paper paper-a4" contenteditable="true" spellcheck="false">
                  <h2 style="text-align:center;color:#1d4ed8;">${shop.name} — ${fd.title}</h2>
                  <p><strong>${fd.recipient}</strong> | التاريخ: ${fd.date}</p>
                  <p>${fd.introText}</p>
                  <p><strong>الإجمالي: ${this.fmtDzd(freeTotal)}</strong></p>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // ====================================================================
        // التبويب الخامس المصلح بالكامل (V59): قمرة الـ 28 قالباً احترافياً جاهزاً (Par Défaut)
        // بعرض الشاشة الكامل 100% وشبكة بطاقات مريحة وواضحة!
        // ====================================================================
        const catFilter = this.defaultsCategoryFilter || 'ALL';
        const q = (this.defaultsSearchQuery || '').trim().toLowerCase();

        const filteredDocs = PRO_28_TEMPLATES.filter((doc) => {
          if (catFilter !== 'ALL' && doc.cat !== catFilter) return false;
          if (q && !`${doc.name} ${doc.sourceLabel} ${doc.proDesc} ${doc.id}`.toLowerCase().includes(q)) return false;
          return true;
        });

        const cardsHtml = filteredDocs
          .map((doc) => {
            const def = this.config.defaultsByDocType[doc.id] || {
              paperSize: doc.defaultPaper,
              themeId: doc.defaultTheme,
              lang: 'ar',
              adopted: true
            };
            const sizeMeta = PAPER_SIZE_META[def.paperSize] || PAPER_SIZE_META.a4;
            const themeObj = VISUAL_THEMES.find((t) => t.id === def.themeId) || VISUAL_THEMES[0];

            return `
              <div class="v59-template-card">
                <!-- أعلى البطاقة: اسم المستند + أيقونة المقاس -->
                <div class="space-y-2">
                  <div class="flex items-start justify-between gap-2.5">
                    <div class="flex-1 min-w-0">
                      <div class="font-black text-slate-900 dark:text-white text-sm leading-snug">
                        <span class="text-blue-600 font-mono">#${doc.num}</span> ${doc.name}
                      </div>
                      <button type="button" onclick="window.App.switchView('${doc.sourcePage}')" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-flex items-center gap-1 cursor-pointer">
                        <span>🔗 مربوط مع: ${doc.sourceLabel} ⬅</span>
                      </button>
                    </div>

                    <div onclick="window.GherbiPrintStudioV45.openMultiSizePreviewModal('${doc.id}')" title="اضغط لمعاينة هذا القالب الاحترافي" class="cursor-pointer shrink-0 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500">
                      <div style="width:${sizeMeta.aspectW}px;height:${sizeMeta.aspectH}px;background:#ffffff;border:2px solid ${themeObj.primary};border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:8.5px;font-weight:900;color:${themeObj.primary};">
                        ${sizeMeta.badge}
                      </div>
                    </div>
                  </div>

                  <!-- وصف القالب الاحترافي الجاهز -->
                  <div class="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                    ✨ ${doc.proDesc}
                  </div>
                </div>

                <!-- أسفل البطاقة: حالة الاعتماد + اختيار المقاس واللون + أزرار المعاينة والتخصيص -->
                <div class="space-y-2.5 pt-1">
                  <div class="px-3 py-1.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span>✅ قالب احترافي جاهز ومعتمد (Par Défaut)</span>
                    <span class="font-mono">${sizeMeta.badge}</span>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <select onchange="window.GherbiPrintStudioV45.setDocDefaultPaper('${doc.id}', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-black text-xs cursor-pointer">
                      <option value="a4" ${def.paperSize === 'a4' ? 'selected' : ''}>📄 مقاس A4</option>
                      <option value="a5" ${def.paperSize === 'a5' ? 'selected' : ''}>📑 مقاس A5</option>
                      <option value="2xa5" ${def.paperSize === '2xa5' ? 'selected' : ''}>✂️ مقاس 2×A5</option>
                      <option value="80mm" ${def.paperSize === '80mm' ? 'selected' : ''}>🧾 حراري 80mm</option>
                      <option value="58mm" ${def.paperSize === '58mm' ? 'selected' : ''}>🧾 حراري 58mm</option>
                    </select>
                    <select onchange="window.GherbiPrintStudioV45.setDocDefaultTheme('${doc.id}', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-bold text-xs cursor-pointer">
                      ${VISUAL_THEMES.map((t) => `<option value="${t.id}" ${def.themeId === t.id ? 'selected' : ''}>🎨 ${t.name}</option>`).join('')}
                    </select>
                  </div>

                  <div class="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onclick="window.GherbiPrintStudioV45.openMultiSizePreviewModal('${doc.id}')" class="py-2 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 border border-amber-400/50 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1">
                      <span>👁️ معاينة</span>
                    </button>
                    <button type="button" onclick="window.GherbiPrintStudioV45.customizeCardInStudioNow('${doc.id}')" class="py-2 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm transition cursor-pointer flex items-center justify-center gap-1">
                      <span>🎨 تخصيص</span>
                    </button>
                    <button type="button" onclick="window.GherbiPrintStudioV45.applySingleProDefaultTemplate('${doc.id}')" title="تفعيل القالب الاحترافي الافتراضي الجاهز لهذا المستند" class="py-2 px-2 rounded-xl bg-emerald-100 hover:bg-emerald-600 text-emerald-900 hover:text-white border border-emerald-300 font-black text-[11px] transition cursor-pointer flex items-center justify-center gap-1">
                      <span>⚡ جاهز</span>
                    </button>
                  </div>
                </div>
              </div>
            `;
          })
          .join('');

        sectionBodyHtml = `
          <div class="rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 w-full">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3.5">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-base md:text-lg font-black text-slate-900 dark:text-white">
                    ⚙️ قمرة القوالب الاحترافية الافتراضية الجاهزة لكل صفحات البرنامج (28 مستنداً — Par Défaut)
                  </h3>
                  <span class="px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs border border-emerald-300">
                    28 قالباً احترافياً جاهزاً للعمل مباشرةً
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-1">
                  كل مستند من الـ 28 مستنداً مزود بقالب احترافي مثالي جاهز للاستعمال فوراً بدون أي تعديل — اضغط <strong>(👁️ معاينة)</strong> لرؤيته، أو <strong>(🎨 تخصيص)</strong> لتعديله في الاستوديو، أو <strong>(⚡ جاهز)</strong> لاستعادة تصميمه المثالي!
                </p>
              </div>

              <button type="button" onclick="window.GherbiPrintStudioV45.adoptAllIdealPresetsAcrossAllPages()" class="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition cursor-pointer flex items-center gap-2">
                <span>🚀 اعتماد القوالب الاحترافية الجاهزة لكل الـ 28 مستنداً دفعة واحدة</span>
              </button>
            </div>

            <!-- شريط تصنيف القوالب الـ 28 + البحث الفوري -->
            <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div class="flex flex-wrap items-center gap-1.5 text-xs">
                <button type="button" onclick="window.GherbiPrintStudioV45.setDefaultsCatFilter('ALL')" class="px-3.5 py-2 rounded-xl font-black transition cursor-pointer ${catFilter === 'ALL' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">
                  🌐 كل المستندات (28)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setDefaultsCatFilter('POS')" class="px-3.5 py-2 rounded-xl font-black transition cursor-pointer ${catFilter === 'POS' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">
                  🧾 المبيعات والكاشير (9)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setDefaultsCatFilter('CREDIT')" class="px-3.5 py-2 rounded-xl font-black transition cursor-pointer ${catFilter === 'CREDIT' ? 'bg-rose-600 text-white shadow' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">
                  💳 الكريدي والديون والوفاء (7)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setDefaultsCatFilter('PURCHASES')" class="px-3.5 py-2 rounded-xl font-black transition cursor-pointer ${catFilter === 'PURCHASES' ? 'bg-emerald-600 text-white shadow' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">
                  🛍️ المشتريات والموردين (4)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setDefaultsCatFilter('INVENTORY')" class="px-3.5 py-2 rounded-xl font-black transition cursor-pointer ${catFilter === 'INVENTORY' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">
                  📦 المخزون والتصنيع (4)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setDefaultsCatFilter('FINANCE')" class="px-3.5 py-2 rounded-xl font-black transition cursor-pointer ${catFilter === 'FINANCE' ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">
                  🏦 الصندوق والجباية والرقابة (4)
                </button>
              </div>

              <input type="text" value="${this.defaultsSearchQuery || ''}" oninput="window.GherbiPrintStudioV45.setDefaultsSearch(this.value)" placeholder="🔎 ابحث في الـ 28 مستنداً (كريدي، وصل، جرد...)" class="w-72 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold outline-none focus:border-blue-500">
            </div>

            <!-- شبكة البطاقات الـ 28 العريضة والمريحة (Full-Width CSS Grid) -->
            <div class="v59-defaults-cards-grid">
              ${cardsHtml}
            </div>
          </div>
        `;
      }

      targetRoot.innerHTML = `
        <div id="v45MasterPrintStudio" data-gherbi-print-v2="1" class="space-y-4 text-right pb-8 w-full" dir="rtl">
          <div class="rounded-3xl bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 text-white p-5 shadow-xl border border-blue-500/30 w-full">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                  <span class="material-symbols-rounded" style="font-size:28px;">print</span>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-black text-[11px]">
                      Gherbi.Ai Omni-Print V59 — 28 قالباً احترافياً جاهزاً (Par Défaut)
                    </span>
                    <h1 class="text-lg md:text-xl font-black">
                      مركز الطباعة الشامل واستوديو القوالب الاحترافية الجاهزة لكل الصفحات
                    </h1>
                  </div>
                  <p class="text-xs text-slate-300 mt-0.5">
                    28 قالباً احترافياً مصمماً مسبقاً وجاهزاً للاستعمال المباشر بدون أي تعديل، مع حرية التخصيص الكامل (Word / Photoshop) والربط التلقائي بكل الصفحات
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('visual_studio')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'visual_studio' ? 'bg-blue-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">
                  🎨 1. استوديو الفواتير والطبقات (28 قالباً)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('cross_page_bridge')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'cross_page_bridge' ? 'bg-blue-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">
                  🔗 2. فواتير الصفحات (${(this.liveDataRecords.sales || []).length + (this.liveDataRecords.purchases || []).length})
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('barcode_shelf_factory')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'barcode_shelf_factory' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">
                  🏷️ 3. الباركود والرفوف
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('free_word_editor')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'free_word_editor' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">
                  📝 4. محرر البونات (Word)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('hardware_defaults')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${this.activeSection === 'hardware_defaults' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-slate-200'}">
                  ⚙️ 5. القوالب الافتراضية الـ 28 (Par Défaut)
                </button>
              </div>
            </div>
          </div>

          <div class="w-full">${sectionBodyHtml}</div>
        </div>
      `;
    };

    // دوال التفاعل السلسة
    studio.setDefaultsCatFilter = function (cat) {
      this.defaultsCategoryFilter = cat || 'ALL';
      this.renderStudioIntoRoot();
    };

    studio.setDefaultsSearch = function (val) {
      this.defaultsSearchQuery = String(val || '');
      this.renderStudioIntoRoot();
      setTimeout(() => {
        const inp = document.querySelector('input[placeholder*="ابحث في الـ 28 مستنداً"]');
        if (inp) {
          inp.focus();
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        }
      }, 10);
    };

    studio.customizeCardInStudioNow = async function (docId) {
      const targetId = docId || 'receipt_thermal';
      const meta = PRO_28_TEMPLATES.find((d) => d.id === targetId) || PRO_28_TEMPLATES[0];

      document.getElementById('v46MultiSizePreviewModal')?.classList.add('hidden');
      document.getElementById('v58PreviewAndEditModal')?.classList.add('hidden');

      this.config.activeDocType = targetId;
      this.loadProfileForDocType(targetId);
      this.selectedRecordId = 'SAMPLE';
      this.activeLoadedDocData = null;
      this.activeSection = 'visual_studio';
      this.saveConfigLocal();

      const viewPrint = document.getElementById('view-print');
      if (viewPrint && !viewPrint.classList.contains('active') && typeof window.App.switchView === 'function') {
        await window.App.switchView('print');
      }

      await this.renderStudioIntoRoot();
      if (window.showToast) {
        window.showToast(`🎨 تم فتح (${meta.name}) في استوديو التخصيص الكامل!`, 'success');
      }
    };

    studio.openMultiSizePreviewModal = async function (docId) {
      const targetId = docId || this.config.activeDocType || 'receipt_thermal';
      const meta = PRO_28_TEMPLATES.find((d) => d.id === targetId) || PRO_28_TEMPLATES[0];
      const def = this.config.defaultsByDocType[targetId] || {
        paperSize: meta.defaultPaper,
        themeId: meta.defaultTheme,
        lang: 'ar'
      };

      this.config.activeDocType = targetId;
      this.loadProfileForDocType(targetId);
      this.activeLoadedDocData = null;

      this.previewModalState = {
        isOpen: true,
        docId: meta.id,
        paperSize: def.paperSize || meta.defaultPaper,
        themeId: def.themeId || meta.defaultTheme
      };

      let modal = document.getElementById('v58PreviewAndEditModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'v58PreviewAndEditModal';
        modal.style.zIndex = '29600';
        modal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4';
        document.body.appendChild(modal);
      }

      await this.renderV58PreviewModalContent();
      modal.classList.remove('hidden');
    };

    studio.renderV58PreviewModalContent = async function () {
      const modal = document.getElementById('v58PreviewAndEditModal');
      if (!modal) return;

      const st = this.previewModalState;
      const meta = PRO_28_TEMPLATES.find((d) => d.id === st.docId) || PRO_28_TEMPLATES[0];
      const sizeInfo = PAPER_SIZE_META[st.paperSize] || PAPER_SIZE_META['80mm'];
      const docData = await this.resolveActiveDocumentData(st.docId);

      const liveEditablePaperHtml = this.buildLiveDocumentPaperHtml(docData, false, {
        ...this.config,
        activeDocType: st.docId,
        paperSize: st.paperSize,
        themeId: st.themeId,
        zoomPct: st.paperSize === '2xa5' ? 80 : 95,
        isPreviewModal: false
      });

      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-3xl max-w-5xl w-[95vw] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right" dir="rtl">
          <div class="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black">👁️ معاينة القالب الاحترافي المعتمد: ${meta.name}</h3>
                <span class="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-black text-xs">${sizeInfo.badge}</span>
              </div>
              <p class="text-xs text-slate-300 mt-0.5">🔗 مربوط مع: <strong>${meta.sourceLabel}</strong> — ${meta.proDesc}</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" onclick="window.GherbiPrintStudioV45.printFromPreviewModalNow()" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow cursor-pointer">🖨️ طباعة / PDF (${sizeInfo.badge})</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.customizeCardInStudioNow('${st.docId}')" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer">🎨 فتح في استوديو التخصيص الكامل ⬅</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.saveDirectEditsFromPreviewModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg cursor-pointer">💾 حفظ واعتماد التعديلات</button>
              <button type="button" onclick="document.getElementById('v58PreviewAndEditModal').classList.add('hidden')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-white font-black text-xs cursor-pointer">✕ إغلاق</button>
            </div>
          </div>

          <div class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-black text-slate-600 dark:text-slate-300">📐 المقاس:</span>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchV58PreviewSize('80mm')" class="px-3 py-1 rounded-xl font-black cursor-pointer ${st.paperSize === '80mm' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 border'}">80mm حراري</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchV58PreviewSize('58mm')" class="px-3 py-1 rounded-xl font-black cursor-pointer ${st.paperSize === '58mm' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 border'}">58mm حراري</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchV58PreviewSize('a4')" class="px-3 py-1 rounded-xl font-black cursor-pointer ${st.paperSize === 'a4' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 border'}">A4 رسمي</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchV58PreviewSize('a5')" class="px-3 py-1 rounded-xl font-black cursor-pointer ${st.paperSize === 'a5' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 border'}">A5 نصفي</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.switchV58PreviewSize('2xa5')" class="px-3 py-1 rounded-xl font-black cursor-pointer ${st.paperSize === '2xa5' ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 border'}">2×A5 مزدوج</button>

              <select onchange="window.GherbiPrintStudioV45.switchV58PreviewTheme(this.value)" class="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-700 border font-black cursor-pointer">
                ${VISUAL_THEMES.map((t) => `<option value="${t.id}" ${st.themeId === t.id ? 'selected' : ''}>🎨 ${t.name}</option>`).join('')}
              </select>
            </div>

            <div class="flex items-center gap-1.5">
              <span class="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-black text-[11px]">
                ✍️ يمكنك النقر على أي نص داخل الورقة بالأسفل وتعديله مباشرةً!
              </span>
              <button type="button" onclick="window.GherbiPrintStudioV45.applySingleProDefaultTemplate('${st.docId}'); window.GherbiPrintStudioV45.openMultiSizePreviewModal('${st.docId}');" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-[11px] cursor-pointer">
                ⚡ استعادة القالب الاحترافي
              </button>
            </div>
          </div>

          <div class="v45-studio-workspace flex-1 overflow-y-auto" id="v58PreviewModalPaperHost">
            ${liveEditablePaperHtml}
          </div>
        </div>
      `;
    };

    studio.switchV58PreviewSize = async function (newSize) {
      this.previewModalState.paperSize = newSize;
      this.config.paperSize = newSize;
      this.setDocDefaultPaper(this.previewModalState.docId, newSize);
      await this.renderV58PreviewModalContent();
    };

    studio.switchV58PreviewTheme = async function (newTheme) {
      this.previewModalState.themeId = newTheme;
      this.config.themeId = newTheme;
      this.setDocDefaultTheme(this.previewModalState.docId, newTheme);
      await this.renderV58PreviewModalContent();
    };

    studio.saveDirectEditsFromPreviewModal = async function () {
      const st = this.previewModalState;
      this.config.activeDocType = st.docId;
      this.config.paperSize = st.paperSize;
      this.config.themeId = st.themeId;
      await this.saveAsDefaultForDocType();
      document.getElementById('v58PreviewAndEditModal')?.classList.add('hidden');
      await this.renderStudioIntoRoot();
    };

    studio.printFromPreviewModalNow = async function () {
      const paperEl = document.querySelector('#v58PreviewModalPaperHost .v45-live-paper');
      if (!paperEl) return;
      const clone = paperEl.cloneNode(true);
      clone.querySelectorAll('.v45-layer-handle-bar').forEach((el) => el.remove());
      clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
      clone.style.transform = 'none';

      const pSize = this.previewModalState.paperSize || '80mm';
      const isThermal = pSize === '80mm' || pSize === '58mm';
      const pageCss = isThermal
        ? `@page { size: ${pSize} auto; margin: 1.5mm; }`
        : pSize === '2xa5'
        ? `@page { size: A4 landscape; margin: 6mm; }`
        : pSize === 'a5'
        ? `@page { size: A5 portrait; margin: 6mm; }`
        : `@page { size: A4 portrait; margin: 8mm; }`;

      const html = `<!DOCTYPE html><html lang="ar" dir="rtl" data-v52-studio-master="1"><head><meta charset="UTF-8"><style>
        ${pageCss}
        * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 0; font-family: 'Cairo', Tahoma, sans-serif; color: #0f172a; background: #fff; }
        .v45-live-paper { box-shadow: none !important; margin: 0 auto !important; width: ${isThermal ? (pSize === '58mm' ? '56mm' : '78mm') : '100%'} !important; min-height: auto !important; }
        .v45-canvas-layer { border: none !important; box-shadow: none !important; }
      </style></head><body>${clone.outerHTML}</body></html>`;

      await window.__gherbiMasterPrintSilent({ html, silent: false });
    };

    ensureAll28ProProfilesInitialized();

    const pcSelect = document.getElementById('pcDocTypeSelect');
    if (pcSelect) {
      pcSelect.innerHTML = studio.build28DocsGroupedOptionsHtml('invoice_a4');
    }

    if (document.getElementById('view-print')?.classList.contains('active')) {
      studio.renderStudioIntoRoot();
    }

    console.log('🏆 [Gherbi V59 Clean-Room Print Center]: تم إصلاح تخطيط البطاقات الـ 28 بعرض كامل 100% وتزويد كل مستند بقالب احترافي جاهز (Par Défaut)!');
  }, 120);
})();

/* ==================== [V60 30 SMART LAYERS & DEEP LAYER INSPECTOR STUDIO] ==================== */
(function initV60Smart30LayersAndDeepInspectorStudio() {
  // ==========================================================================
  // 1. مكتبة الطبقات الذكية الموسعة (30 طبقة احترافية تغطي كافة القوالب الـ 28)
  // ==========================================================================
  const FULL_30_SMART_LAYERS = [
    // ── الفئة 1: الأساسية والجدول (CORE — 6 طبقات) ──
    { id: 'header_layer', cat: 'CORE', catLabel: '🏛️ الأساسية (6)', name: '🏢 1. ترويسة المتجر والشعار والبيانات الجبائية', desc: 'اسم المتجر، الشعار، الهاتف، العنوان، وأرقام RC / NIF / AI / NIS.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'doc_banner_layer', cat: 'CORE', catLabel: '🏛️ الأساسية (6)', name: '🏷️ 2. شريط عنوان ورقم المستند والباركود', desc: 'عنوان التذكرة/الفاتورة، رقمها التسلسلي، تاريخ وساعة الإصدار، والباركود.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'customer_box_layer', cat: 'CORE', catLabel: '🏛️ الأساسية (6)', name: '👤 3. بطاقة بيانات الزبون / المورد والرصيد', desc: 'اسم الزبون أو المورد، رقم هاتفه، عنوانه، وبياناته الجبائية.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'items_table_layer', cat: 'CORE', catLabel: '🏛️ الأساسية (6)', name: '📋 4. جدول الأصناف والكميات والأسعار', desc: 'جدول السلع أو البنود بتخطيط ذكي يتكيف تلقائياً مع 80mm و A4.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'totals_words_layer', cat: 'CORE', catLabel: '🏛️ الأساسية (6)', name: '💰 5. شلال المجاميع بالدينار والسنتيم والتفقيط', desc: 'المجموع الفرعي، التخفيض، الصافي بالدينار والسنتيم، والمبلغ بالحروف.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'footer_stamp_layer', cat: 'CORE', catLabel: '🏛️ الأساسية (6)', name: '✒️ 6. التذييل، شروط الاستبدال، رمز RIP، والختم', desc: 'شروط الإرجاع والاستبدال، رقم حساب BaridiMob RIP، ومربع الختم والإمضاء.', defaultVisible: true, forDocs: ['ALL'] },

    // ── الفئة 2: الوفاء والعروض والتسويق (LOYALTY — 5 طبقات) ──
    { id: 'loyalty_points_layer', cat: 'LOYALTY', catLabel: '👑 الوفاء والتسويق (5)', name: '👑 7. بطاقة نقاط الوفاء والمخصوم من البطاقة (VIP & عابر)', desc: 'تعرض نوع الزبون، الرصيد السابق، المكتسب (+)، المخصوم (-)، والرصيد الجديد.', defaultVisible: true, forDocs: ['receipt_thermal', 'invoice_a4', 'pos_partial_credit_80mm', 'loyalty_vip_card_80mm', 'customer_carnet_80mm'] },
    { id: 'savings_promo_layer', cat: 'LOYALTY', catLabel: '👑 الوفاء والتسويق (5)', name: '🎉 8. شريط "كم وفّرت اليوم؟" وعداد القطع الإجمالي', desc: 'يبرز للزبون إجمالي ما وفّره في الفاتورة وإجمالي عدد القطع المستلمة.', defaultVisible: false, forDocs: ['receipt_thermal', 'invoice_a4', 'invoice_a5', 'loyalty_vip_card_80mm'] },
    { id: 'vip_coupon_cut_layer', cat: 'LOYALTY', catLabel: '👑 الوفاء والتسويق (5)', name: '✂️ 9. قسيمة هدية وتخفيض قابلة للقص للزيارة القادمة (Coupon)', desc: 'كوبون ترويجي منقط قابل للقص في أسفل التذكرة لتحفيز الزبون على العودة.', defaultVisible: false, forDocs: ['receipt_thermal', 'loyalty_vip_card_80mm'] },
    { id: 'qr_social_wifi_layer', cat: 'LOYALTY', catLabel: '👑 الوفاء والتسويق (5)', name: '📱 10. رمز QR المتجر، صفحات التواصل، وكود Wi-Fi الزبائن', desc: 'رمز استجابة سريعة للمتجر مع صفحات فيسبوك/واتساب أو كود Wi-Fi الزبائن.', defaultVisible: false, forDocs: ['receipt_thermal', 'loyalty_vip_card_80mm', 'price_catalog_a4'] },
    { id: 'return_policy_box_layer', cat: 'LOYALTY', catLabel: '👑 الوفاء والتسويق (5)', name: '🔄 11. صندوق شروط الإرجاع والاستبدال وحماية المستهلك', desc: 'يوضح شروط استبدال السلع خلال 48 ساعة وإلزامية إحضار الوصل الأصلي.', defaultVisible: false, forDocs: ['receipt_thermal', 'invoice_a4', 'invoice_a5', 'credit_note'] },

    // ── الفئة 3: الكريدي والديون والأقساط (FINANCE — 5 طبقات) ──
    { id: 'credit_carnet_layer', cat: 'FINANCE', catLabel: '💳 الكريدي والمالية (5)', name: '💳 12. كشف حساب الكريدي السريع للزبون (Carnet de Crédit)', desc: 'صندوق أحمر يوضح الكريدي السابق، فاتورة اليوم، المدفوع اليوم، وإجمالي الكريدي المتبقي.', defaultVisible: false, forDocs: ['payment_receipt', 'customer_carnet_80mm', 'pos_partial_credit_80mm', 'receipt_thermal'] },
    { id: 'debt_ledger_layer', cat: 'FINANCE', catLabel: '💳 الكريدي والمالية (5)', name: '⚖️ 13. جدول وضعية الديون والحساب التراكمي (A4 / A5)', desc: 'جدول رسمي يوضح الدين السابق + فاتورة اليوم - المدفوع = إجمالي الدين المتبقي.', defaultVisible: false, forDocs: ['invoice_a4', 'invoice_a5', 'customer_ledger_a4', 'recap_invoice_a4', 'purchase_invoice', 'supplier_payment_receipt', 'supplier_ledger_a4'] },
    { id: 'payment_breakdown_layer', cat: 'FINANCE', catLabel: '💳 الكريدي والمالية (5)', name: '💵 14. تفصيل المقبوض، الصرف المرجع (Rendu)، وطريقة الدفع', desc: 'يعرض المبلغ المستلم، الصرف المرجع للزبون بالدينار والسنتيم، واسم الكاشير.', defaultVisible: false, forDocs: ['receipt_thermal', 'pos_partial_credit_80mm', 'payment_receipt'] },
    { id: 'installments_schedule_layer', cat: 'FINANCE', catLabel: '💳 الكريدي والمالية (5)', name: '🗓️ 15. جدول الأقساط الشهرية ومواعيد الاستحقاق والتسبيق', desc: 'يعرض الدفعة الأولى (التسبيق)، عدد الأشهر، قيمة القسط الشهري، وتواريخ الدفع.', defaultVisible: false, forDocs: ['installment_contract', 'invoice_a4'] },
    { id: 'bank_rip_ccp_box_layer', cat: 'FINANCE', catLabel: '💳 الكريدي والمالية (5)', name: '🏦 16. بطاقة الحساب البنكي (RIB / CCP / BaridiMob RIP)', desc: 'صندوق رسمي لبيانات الدفع البنكي والبريدي للشركات والزبائن.', defaultVisible: false, forDocs: ['invoice_a4', 'proforma', 'recap_invoice_a4', 'customer_ledger_a4'] },

    // ── الفئة 4: المخزون والمشتريات والتصنيع (INVENTORY — 5 طبقات) ──
    { id: 'supplier_reception_layer', cat: 'INVENTORY', catLabel: '📦 المخزون والمشتريات (5)', name: '🛍️ 17. بطاقة مطابقة استلام البضاعة من المورد وفحص الجودة', desc: 'توثق تاريخ الاستلام، رقم فاتورة المورد، حالة الطرود، ومراقب المخزن.', defaultVisible: false, forDocs: ['purchase_invoice', 'supplier_return_note', 'supplier_ledger_a4'] },
    { id: 'stocktake_variance_layer', cat: 'INVENTORY', catLabel: '📦 المخزون والمشتريات (5)', name: '📊 18. ملخص محضر الجرد المخزني وفوارق الكميات والقيمة', desc: 'يلخص إجمالي الرصيد الدفتري، الرصيد الفعلي المعدود، وصافي العجز أو الفائض.', defaultVisible: false, forDocs: ['stocktake_sheet_a4'] },
    { id: 'bom_production_cost_layer', cat: 'INVENTORY', catLabel: '📦 المخزون والمشتريات (5)', name: '🏭 19. بطاقة تكلفة التصنيع، المواد الأولية، ونسبة الهدر (BOM)', desc: 'تفصل تكلفة المواد الأولية، المصاريف الإضافية، وتكلفة الوحدة المصنعة الناتجة.', defaultVisible: false, forDocs: ['production_order_sheet'] },
    { id: 'low_stock_reorder_layer', cat: 'INVENTORY', catLabel: '📦 المخزون والمشتريات (5)', name: '🚨 20. بطاقة أولوية التموين للأصناف الحرجة والنافدة', desc: 'تبرز عدد الأصناف التي وصلت للحد الأدنى والميزانية التقديرية لإعادة تموينها.', defaultVisible: false, forDocs: ['low_stock_order_a4', 'purchase_invoice'] },
    { id: 'pack_carton_summary_layer', cat: 'INVENTORY', catLabel: '📦 المخزون والمشتريات (5)', name: '📦 21. ملخص التغليف وإجمالي الكراتين والباكي (Colisage)', desc: 'يحسب إجمالي عدد الطرود والكراتين والقطع لتسهيل التحميل والمراقبة.', defaultVisible: false, forDocs: ['delivery_note', 'invoice_a4', 'purchase_invoice', 'customer_order'] },

    // ── الفئة 5: التوصيل والضمان واللوجستيك (LOGISTICS — 4 طبقات) ──
    { id: 'delivery_driver_layer', cat: 'LOGISTICS', catLabel: '🚚 الضمان والتوصيل (4)', name: '🚚 22. بطاقة التوصيل، السائق، رقم المركبة، وإمضاء الاستلام', desc: 'اسم السائق، رقم لوحة المركبة (Matricule)، وجهة التوصيل، وخانة إمضاء المستلم.', defaultVisible: false, forDocs: ['delivery_note', 'invoice_a4', 'customer_order'] },
    { id: 'warranty_imei_layer', cat: 'LOGISTICS', catLabel: '🚚 الضمان والتوصيل (4)', name: '🛡️ 23. شهادة الضمان الرسمي والأرقام التسلسلية (IMEI / S-N)', desc: 'صندوق مخصص لمدة الضمان بالأشهر، الأرقام التسلسلية للأجهزة، وشروط الصيانة.', defaultVisible: false, forDocs: ['warranty_cert', 'invoice_a4', 'receipt_thermal'] },
    { id: 'order_reservation_layer', cat: 'LOGISTICS', catLabel: '🚚 الضمان والتوصيل (4)', name: '📋 24. بطاقة حجز الطلبية، العربون المدفوع، وتاريخ التسليم', desc: 'توضح حالة حجز السلعة في المخزن، مبلغ العربون (Acompte)، والباقي عند الاستلام.', defaultVisible: false, forDocs: ['customer_order', 'proforma'] },
    { id: 'dual_signature_stamps_layer', cat: 'LOGISTICS', catLabel: '🚚 الضمان والتوصيل (4)', name: '✍️ 25. مربعات الإمضاء والختم الثلاثي (المسلّم / المستلم / المراقب)', desc: 'ثلاث خانات رسمية للتوقيع والختم في أسفل الفواتير ومحاضر الاستلام والجرد.', defaultVisible: false, forDocs: ['delivery_note', 'purchase_invoice', 'stocktake_sheet_a4', 'production_order_sheet', 'installment_contract'] },

    // ── الفئة 6: الصندوق والجباية والرقابة (CAISSE_FISCAL — 5 طبقات) ──
    { id: 'tax_ifu_breakdown_layer', cat: 'CAISSE_FISCAL', catLabel: '🏦 الصندوق والجباية (5)', name: '🇩🇿 26. جدول تفصيل الضرائب الجزائرية (TVA / الطابع / إعفاء G12)', desc: 'يفصل المبلغ خارج الرسم HT، ضريبة TVA، الطابع الجبائي، والسلع المقننة المعفاة.', defaultVisible: false, forDocs: ['fiscal_g12_statement', 'invoice_a4', 'proforma', 'recap_invoice_a4'] },
    { id: 'caisse_z_denoms_layer', cat: 'CAISSE_FISCAL', catLabel: '🏦 الصندوق والجباية (5)', name: '🔒 27. جدول جرد الفئات النقدية الجزائرية وفارق الصندوق (Z-Report)', desc: 'يفصل عدّ الأوراق النقدية (2000، 1000، 500، 200 د.ج) والرصيد المتوقع والفارق.', defaultVisible: false, forDocs: ['caisse_z_report'] },
    { id: 'expense_approval_layer', cat: 'CAISSE_FISCAL', catLabel: '🏦 الصندوق والجباية (5)', name: '💸 28. بطاقة اعتماد سند الصرف النقدي وتوقيع المستفيد', desc: 'توثق فئة المصروف، رقم المناوبة، اسم المستلم للمبلغ، وتوقيع المدير.', defaultVisible: false, forDocs: ['expense_voucher', 'supplier_payment_receipt'] },
    { id: 'forensic_radar_summary_layer', cat: 'CAISSE_FISCAL', catLabel: '🏦 الصندوق والجباية (5)', name: '🛡️ 29. بطاقة مؤشرات الرقابة الجنائية وحماية الأرباح', desc: 'تلخص عمليات حذف السطور بعد المسح، تفريغ السلة، والبيع بأقل من التكلفة.', defaultVisible: false, forDocs: ['forensic_audit_report', 'caisse_z_report'] },
    { id: 'free_custom_note_layer', cat: 'CAISSE_FISCAL', catLabel: '🏦 الصندوق والجباية (5)', name: '📝 30. صندوق ملاحظات وتعليمات حرة قابلة للتخصيص', desc: 'صندوق نصي حر يمكنك كتابة أي إعلان، تهنئة، أو ملاحظة خاصة بداخله.', defaultVisible: false, forDocs: ['ALL'] }
  ];

  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.App) return;
    clearInterval(waitStudio);

    studio.FULL_16_LAYERS_CATALOG = FULL_30_SMART_LAYERS;
    studio.FULL_30_SMART_LAYERS = FULL_30_SMART_LAYERS;
    studio.layerCatalogSearch = studio.layerCatalogSearch || '';
    studio.inspectorOpenForLayerId = studio.inspectorOpenForLayerId || 'header_layer';
    studio.activeLeftToolTab = studio.activeLeftToolTab || 'layers_order'; // 'layers_order' | 'smart_catalog' | 'layer_inspector' | 'table_and_shop'

    // 1. دالة ترجمة المتغيرات الذكية داخل نصوص وملاحظات الطبقات
    studio.interpolateSmartVariables = function (rawText, docData) {
      if (!rawText) return '';
      const shop = this.getShopIdentity();
      return String(rawText)
        .replace(/\{اسم_المتجر\}/g, shop.name || 'Gherbi.Ai POS')
        .replace(/\{هاتف_المتجر\}/g, shop.phone || '0550 00 00 00')
        .replace(/\{عنوان_المتجر\}/g, shop.address || 'الجزائر')
        .replace(/\{RIP\}/g, shop.rip || '00799999000000000000')
        .replace(/\{رقم_المستند\}/g, (docData && docData.docNumber) || 'FAC-001')
        .replace(/\{التاريخ\}/g, (docData && docData.date) || new Date().toISOString().slice(0, 16))
        .replace(/\{اسم_الزبون\}/g, (docData && docData.partyName) || 'زبون عابر')
        .replace(/\{هاتف_الزبون\}/g, (docData && docData.partyPhone) || '-')
        .replace(/\{الإجمالي\}/g, this.fmtDzd(docData && docData.total))
        .replace(/\{المدفوع\}/g, this.fmtDzd(docData && docData.paidAmount))
        .replace(/\{الدين_السابق\}/g, this.fmtDzd(docData && docData.previousBalance))
        .replace(/\{صافي_الدين\}/g, this.fmtDzd((Number(docData?.previousBalance || 0) + Number(docData?.remainingDebt || 0))))
        .replace(/\{نقاط_الوفاء\}/g, String((docData && docData.loyaltyTotalBalance) || 0));
    };

    // 2. دمج الطبقات الـ 30 في إعدادات القالب الحالي دون فقدان أي تخصيص سابق
    studio.sync30LayersWithActiveConfig = function () {
      const existing = Array.isArray(this.config.layers) ? this.config.layers : [];
      const mapById = new Map(existing.map((l) => [l.id, l]));
      const merged = [];

      for (const cat of FULL_30_SMART_LAYERS) {
        if (mapById.has(cat.id)) {
          const item = mapById.get(cat.id);
          item.name = item.customLabel || cat.name;
          merged.push({
            fontSizeScale: 100,
            textAlign: 'right',
            borderStyle: 'default',
            bgStyle: 'default',
            paddingMode: 'normal',
            customTitle: '',
            customNote: '',
            ...item
          });
          mapById.delete(cat.id);
        } else {
          merged.push({
            id: cat.id,
            name: cat.name,
            visible: Boolean(cat.defaultVisible),
            align: 'between',
            fontSizeScale: 100,
            textAlign: 'right',
            borderStyle: 'default',
            bgStyle: 'default',
            paddingMode: 'normal',
            customTitle: '',
            customNote: ''
          });
        }
      }
      for (const customLayer of mapById.values()) {
        merged.push({
          fontSizeScale: 100,
          textAlign: 'right',
          borderStyle: 'default',
          bgStyle: 'default',
          paddingMode: 'normal',
          customTitle: '',
          customNote: '',
          ...customLayer
        });
      }
      this.config.layers = merged;
    };

    studio.sync30LayersWithActiveConfig();

    // ربط تحميل أي مستند من الـ 28 مستنداً بتفعيل طبقاته الذكية الخاصة من الـ 30 طبقة
    const prevLoadProfile = studio.loadProfileForDocType.bind(studio);
    studio.loadProfileForDocType = function (docId) {
      prevLoadProfile(docId);
      this.sync30LayersWithActiveConfig();

      // تفعيل الطبقات التخصصية الجديدة حسب نوع المستند إذا لم يكن المستخدم قد حفظ تعديلاً يدوياً خاصاً
      const savedProf = this.config.adoptedProfiles && this.config.adoptedProfiles[docId];
      if (!savedProf || !savedProf._v60Customized) {
        const autoMap = {
          purchase_invoice: ['supplier_reception_layer', 'pack_carton_summary_layer', 'dual_signature_stamps_layer'],
          supplier_return_note: ['supplier_reception_layer', 'dual_signature_stamps_layer'],
          stocktake_sheet_a4: ['stocktake_variance_layer', 'dual_signature_stamps_layer'],
          production_order_sheet: ['bom_production_cost_layer', 'dual_signature_stamps_layer'],
          low_stock_order_a4: ['low_stock_reorder_layer'],
          delivery_note: ['delivery_driver_layer', 'pack_carton_summary_layer', 'dual_signature_stamps_layer'],
          customer_order: ['order_reservation_layer', 'delivery_driver_layer'],
          proforma: ['tax_ifu_breakdown_layer', 'bank_rip_ccp_box_layer'],
          caisse_z_report: ['caisse_z_denoms_layer', 'forensic_radar_summary_layer'],
          expense_voucher: ['expense_approval_layer'],
          fiscal_g12_statement: ['tax_ifu_breakdown_layer'],
          forensic_audit_report: ['forensic_radar_summary_layer'],
          loyalty_vip_card_80mm: ['loyalty_points_layer', 'vip_coupon_cut_layer', 'qr_social_wifi_layer']
        };
        const extras = autoMap[docId] || [];
        for (const lid of extras) {
          const found = this.config.layers.find((x) => x.id === lid);
          if (found) found.visible = true;
        }
      }
    };

    // ========================================================================
    // 3. بناء محتوى الطبقات الـ 14 الجديدة + تطبيق خصائص المفتش (Inspector Styles)
    //    على جميع الـ 30 طبقة داخل الورقة الحية وعند الطباعة والـ PDF
    // ========================================================================
    const prevBuildPaper = studio.buildLiveDocumentPaperHtml.bind(studio);
    studio.buildLiveDocumentPaperHtml = function (docData, forPrintOutput = false, customOverrides = null) {
      const cfg = customOverrides ? { ...this.config, ...customOverrides } : this.config;
      const isThermal = cfg.paperSize === '80mm' || cfg.paperSize === '58mm';
      const editAttr = forPrintOutput ? '' : 'contenteditable="true" spellcheck="false"';
      const totalItemsQty = (docData.items || []).reduce((s, it) => s + Number(it.qty || 1), 0);

      // أولاً: نبني الورقة الأساسية عبر المحرك الموجود
      let html = prevBuildPaper(docData, forPrintOutput, customOverrides);

      // ثانياً: دالة مساعدة لتوليد محتوى HTML لأي طبقة من الطبقات التخصصية الجديدة (أو المحدثة)
      const renderSpecializedLayerInnerHtml = (layer) => {
        const lid = layer.id;
        const cTitle = this.interpolateSmartVariables(layer.customTitle, docData);
        const cNote = this.interpolateSmartVariables(layer.customNote, docData);
        const customNoteBanner = cNote
          ? `<div ${editAttr} style="margin-top:4px;padding-top:3px;border-top:1px dashed #cbd5e1;font-size:9.5px;font-weight:800;color:#334155;">📌 ${cNote}</div>`
          : '';

        if (lid === 'vip_coupon_cut_layer') {
          return `
            <div style="border:2px dashed #d97706;border-radius:10px;padding:7px 9px;background:#fffbeb;color:#78350f;text-align:center;font-size:${isThermal ? '10px' : '11px'};">
              <div ${editAttr} style="font-weight:900;font-size:${isThermal ? '11px' : '12.5px'};color:#b45309;">
                ✂️ ${cTitle || 'قسيمة هدية وتخفيض للزيارة القادمة (Coupon Détachable)'}
              </div>
              <div ${editAttr} style="font-weight:700;margin-top:2px;">
                احتفظ بهذه القسيمة واستفد من تخفيض خاص أو نقاط وفاء مضاعفة عند زيارتك القادمة!
              </div>
              <div ${editAttr} style="font-family:monospace;font-weight:900;margin-top:3px;background:#ffffff;border:1px solid #f59e0b;display:inline-block;padding:1px 8px;border-radius:6px;">
                CODE: VIP-${docData.docNumber || '2026'}
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'return_policy_box_layer') {
          return `
            <div style="border:1.5px solid #64748b;border-radius:8px;padding:6px 8px;background:#f8fafc;font-size:${isThermal ? '9.5px' : '10.5px'};color:#1e293b;">
              <div ${editAttr} style="font-weight:900;margin-bottom:2px;color:#0f172a;">
                🔄 ${cTitle || 'شروط الإرجاع والاستبدال وحماية المستهلك:'}
              </div>
              <div ${editAttr} style="font-weight:700;line-height:1.4;">
                1. البضاعة المباعة تستبدل خلال 48 ساعة بشرط سلامة الغلاف الأصلي وإحضار هذا الوصل.<br>
                2. المواد المبردة والمفتوحة لا ترد ولا تستبدل حفاظاً على صحتكم.
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'bank_rip_ccp_box_layer') {
          const shop = this.getShopIdentity();
          return `
            <div style="border:1.5px solid #1d4ed8;border-radius:8px;padding:7px 10px;background:#eff6ff;font-size:${isThermal ? '9.5px' : '11px'};color:#1e3a8a;">
              <div ${editAttr} style="font-weight:900;margin-bottom:3px;">
                🏦 ${cTitle || 'بيانات الحساب البنكي والبريدي للتسديد (RIB / CCP / BaridiMob):'}
              </div>
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-family:monospace;font-weight:900;">
                <span ${editAttr}>RIP BaridiMob: ${shop.rip || '00799999000000000000'}</span>
                <span ${editAttr}>CCP: ${shop.ccp || '0012345678 Clé 42'}</span>
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'supplier_reception_layer') {
          return `
            <div style="border:1.5px solid #047857;border-radius:8px;padding:7px 10px;background:#ecfdf5;font-size:${isThermal ? '9.5px' : '11px'};color:#064e3b;">
              <div ${editAttr} style="font-weight:900;border-bottom:1px dashed #6ee7b7;padding-bottom:3px;margin-bottom:4px;">
                🛍️ ${cTitle || 'محضر مطابقة استلام البضاعة وفحص الجودة (Réception Fournisseur)'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-weight:800;">
                <div ${editAttr}>• حالة الطرود: <strong>سليمة ومطابقة ✔</strong></div>
                <div ${editAttr}>• فحص الصلاحية: <strong>مراقب ✔</strong></div>
                <div ${editAttr}>• أمين المخزن: <strong>المدير العام</strong></div>
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'stocktake_variance_layer') {
          return `
            <div style="border:1.5px solid #0f172a;border-radius:8px;padding:8px 10px;background:#f1f5f9;font-size:11px;color:#0f172a;">
              <div ${editAttr} style="font-weight:900;margin-bottom:4px;">
                📊 ${cTitle || 'ملخص مطابقة الجرد المخزني وفوارق الكميات (Écart d’Inventaire)'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center;font-weight:900;">
                <div ${editAttr} style="background:#fff;padding:4px;border-radius:6px;border:1px solid #cbd5e1;">عدد الأصناف المجرودة: ${(docData.items || []).length}</div>
                <div ${editAttr} style="background:#fff;padding:4px;border-radius:6px;border:1px solid #cbd5e1;">إجمالي الكمية المعدودة: ${totalItemsQty}</div>
                <div ${editAttr} style="background:#ecfdf5;padding:4px;border-radius:6px;border:1px solid #6ee7b7;color:#047857;">قيمة المخزون الفعلي: ${this.fmtDzd(docData.total)}</div>
                <div ${editAttr} style="background:#fff1f2;padding:4px;border-radius:6px;border:1px solid #fda4af;color:#be123c;">حالة الجرد: مصادق عليه ✔</div>
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'bom_production_cost_layer') {
          const unitCost = totalItemsQty > 0 ? Number((Number(docData.total || 0) / totalItemsQty).toFixed(2)) : Number(docData.total || 0);
          return `
            <div style="border:1.5px solid #047857;border-radius:8px;padding:7px 10px;background:#f0fdf4;font-size:11px;color:#064e3b;">
              <div ${editAttr} style="font-weight:900;margin-bottom:4px;">
                🏭 ${cTitle || 'بطاقة تكلفة التصنيع والمواد الأولية المستهلكة (Fiche de Production BOM)'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-weight:800;">
                <div ${editAttr}>• تكلفة المواد الأولية: <strong>${this.fmtDzd(docData.total)}</strong></div>
                <div ${editAttr}>• نسبة الهدر المعيارية: <strong>0.0%</strong></div>
                <div ${editAttr}>• التكلفة الصافية للوحدة: <strong>${this.fmtDzd(unitCost)}</strong></div>
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'low_stock_reorder_layer') {
          return `
            <div style="border:1.5px solid #d97706;border-radius:8px;padding:7px 10px;background:#fffbeb;font-size:11px;color:#78350f;">
              <div ${editAttr} style="font-weight:900;margin-bottom:3px;">
                🚨 ${cTitle || 'توصيات التموين السريع للأصناف الحرجة والنافدة'}
              </div>
              <div ${editAttr} style="font-weight:800;">
                الأصناف المدرجة أعلاه وصلت إلى الحد الأدنى للتنبيه — يرجى تزويد المخزن بالكميات المقترحة لتفادي انقطاع البيع.
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'pack_carton_summary_layer') {
          return `
            <div style="border:1.5px solid #334155;border-radius:8px;padding:6px 10px;background:#f8fafc;font-size:${isThermal ? '10px' : '11px'};display:flex;justify-content:space-between;align-items:center;font-weight:900;">
              <span ${editAttr}>📦 ${cTitle || 'ملخص التغليف والطرود (Colisage):'}</span>
              <span ${editAttr}>عدد الأسطر: ${(docData.items || []).length} | إجمالي الوحدات/الطرود: ${totalItemsQty} وحدة</span>
            </div>`;
        }

        if (lid === 'order_reservation_layer') {
          const paidDep = Number(docData.paidAmount || 0);
          const remOrder = Math.max(0, Number((Number(docData.total || 0) - paidDep).toFixed(2)));
          return `
            <div style="border:1.5px solid #d97706;border-radius:8px;padding:7px 10px;background:#fffbeb;font-size:${isThermal ? '10px' : '11px'};color:#78350f;">
              <div ${editAttr} style="font-weight:900;border-bottom:1px dashed #fcd34d;padding-bottom:3px;margin-bottom:4px;">
                📋 ${cTitle || 'بطاقة حجز طلبية الزبون والعربون المدفوع (Réservation Commande)'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-weight:900;">
                <div ${editAttr}>• حالة المخزون: <strong>محجوز للزبون ✔</strong></div>
                <div ${editAttr} style="color:#047857;">• العربون (Acompte): <strong>${this.fmtDzd(paidDep)}</strong></div>
                <div ${editAttr} style="color:#be123c;">• الباقي عند التسليم: <strong>${this.fmtDzd(remOrder)}</strong></div>
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'dual_signature_stamps_layer') {
          return `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px;text-align:center;font-size:${isThermal ? '9.5px' : '11px'};font-weight:900;">
              <div ${editAttr} style="border:1.5px dashed #64748b;border-radius:8px;padding:8px;min-height:58px;background:#f8fafc;">
                ✍️ إمضاء وختم المسلّم / الإدارة
              </div>
              <div ${editAttr} style="border:1.5px dashed #64748b;border-radius:8px;padding:8px;min-height:58px;background:#f8fafc;">
                🔍 إمضاء المراقب / أمين المخزن
              </div>
              <div ${editAttr} style="border:1.5px dashed #64748b;border-radius:8px;padding:8px;min-height:58px;background:#f8fafc;">
                🤝 إمضاء وختم المستلم
              </div>
            </div>`;
        }

        if (lid === 'caisse_z_denoms_layer') {
          return `
            <div style="border:1.5px solid #0f172a;border-radius:8px;padding:6px 8px;background:#f8fafc;font-size:${isThermal ? '9.5px' : '11px'};">
              <div ${editAttr} style="font-weight:900;border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin-bottom:4px;">
                🔒 ${cTitle || 'جدول جرد الفئات النقدية الجزائرية في الدرج (Billetage Z-Report)'}
              </div>
              <div ${editAttr} style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-family:monospace;font-weight:900;text-align:center;">
                <span style="background:#fff;border:1px solid #cbd5e1;padding:2px;border-radius:4px;">2000 د.ج × __</span>
                <span style="background:#fff;border:1px solid #cbd5e1;padding:2px;border-radius:4px;">1000 د.ج × __</span>
                <span style="background:#fff;border:1px solid #cbd5e1;padding:2px;border-radius:4px;">500 د.ج × __</span>
                <span style="background:#fff;border:1px solid #cbd5e1;padding:2px;border-radius:4px;">200 د.ج × __</span>
                <span style="background:#fff;border:1px solid #cbd5e1;padding:2px;border-radius:4px;">100 د.ج × __</span>
                <span style="background:#ecfdf5;border:1px solid #6ee7b7;padding:2px;border-radius:4px;color:#047857;">الفارق: 0.00</span>
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'expense_approval_layer') {
          return `
            <div style="border:1.5px solid #be123c;border-radius:8px;padding:6px 8px;background:#fff1f2;font-size:${isThermal ? '9.5px' : '11px'};color:#881337;">
              <div ${editAttr} style="font-weight:900;margin-bottom:3px;">
                💸 ${cTitle || 'اعتماد سند الصرف النقدي من الصندوق:'}
              </div>
              <div style="display:flex;justify-content:space-between;font-weight:800;">
                <span ${editAttr}>المصادق: المدير العام ✔</span>
                <span ${editAttr}>إمضاء مستلم المبلغ: ....................</span>
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'forensic_radar_summary_layer') {
          return `
            <div style="border:1.5px solid #be123c;border-radius:8px;padding:7px 10px;background:#fff1f2;font-size:${isThermal ? '9.5px' : '11px'};color:#881337;">
              <div ${editAttr} style="font-weight:900;border-bottom:1px dashed #fda4af;padding-bottom:3px;margin-bottom:4px;">
                🛡️ ${cTitle || 'ملخص فحص رادار الرقابة الجنائية وحماية الأرباح'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-weight:900;text-align:center;">
                <div ${editAttr} style="background:#fff;padding:3px;border-radius:6px;border:1px solid #fecdd3;">سطور محذوفة: 0</div>
                <div ${editAttr} style="background:#fff;padding:3px;border-radius:6px;border:1px solid #fecdd3;">بيع بالخسارة: 0</div>
                <div ${editAttr} style="background:#ecfdf5;padding:3px;border-radius:6px;border:1px solid #6ee7b7;color:#047857;">الحالة الأمنية: سليمة ✔</div>
              </div>
              ${customNoteBanner}
            </div>`;
        }

        if (lid === 'free_custom_note_layer') {
          return `
            <div style="border:1.5px dashed #2563eb;border-radius:8px;padding:7px 10px;background:#eff6ff;font-size:${isThermal ? '10px' : '11px'};color:#1e3a8a;">
              <div ${editAttr} style="font-weight:900;">
                📝 ${cTitle || 'ملاحظة وتنبيه خاص:'}
              </div>
              <div ${editAttr} style="font-weight:700;margin-top:2px;">
                ${cNote || 'انقر هنا لكتابة أي ملاحظة، شروط خاصة، أو إعلان لزبائنك الكرام...'}
              </div>
            </div>`;
        }

        return null;
      };

      // ثالثاً: تمرير جميع الطبقات الظاهرة لتطبيق التخصيصات المريحة (عنوان الطبقة، الملاحظة، حجم الخط، الخلفية، الإطار، والمحاذاة)
      for (const layer of cfg.layers || []) {
        if (!layer.visible) continue;

        const specializedHtml = renderSpecializedLayerInnerHtml(layer);
        const scalePct = Number(layer.fontSizeScale || 100);
        const padPx = layer.paddingMode === 'compact' ? '3px 5px' : layer.paddingMode === 'relaxed' ? '10px 12px' : '';
        const borderCss =
          layer.borderStyle === 'none'
            ? 'border:none !important;'
            : layer.borderStyle === 'solid'
            ? 'border:1.5px solid #0f172a !important;border-radius:8px;'
            : layer.borderStyle === 'dashed'
            ? 'border:1.5px dashed #475569 !important;border-radius:8px;'
            : layer.borderStyle === 'double'
            ? 'border:3px double #1d4ed8 !important;border-radius:8px;'
            : '';
        const bgCss =
          layer.bgStyle === 'white'
            ? 'background:#ffffff !important;'
            : layer.bgStyle === 'soft_blue'
            ? 'background:#eff6ff !important;'
            : layer.bgStyle === 'soft_green'
            ? 'background:#ecfdf5 !important;'
            : layer.bgStyle === 'soft_amber'
            ? 'background:#fffbeb !important;'
            : layer.bgStyle === 'soft_rose'
            ? 'background:#fff1f2 !important;'
            : layer.bgStyle === 'soft_slate'
            ? 'background:#f8fafc !important;'
            : '';
        const alignCss =
          layer.textAlign === 'center'
            ? 'text-align:center !important;'
            : layer.textAlign === 'left'
            ? 'text-align:left !important;'
            : '';

        const wrapperCustomCss = `${scalePct !== 100 ? `zoom:${scalePct}%;` : ''}${padPx ? `padding:${padPx};` : ''}${borderCss}${bgCss}${alignCss}`;

        if (specializedHtml) {
          html = html.replace(
            new RegExp(`(<div[^>]*data-v47-layer-id="${layer.id}"[\\s\\S]*?<\\/div>\\s*)<div[^>]*>[\\s\\S]*?<\\/div>(\\s*<\\/div>)`),
            `$1<div style="${wrapperCustomCss}">${specializedHtml}</div>$2`
          );
        } else if (wrapperCustomCss || layer.customTitle || layer.customNote) {
          const cTitleHtml = layer.customTitle
            ? `<div ${editAttr} style="font-weight:900;color:#1d4ed8;margin-bottom:3px;font-size:10.5px;">🔹 ${this.interpolateSmartVariables(layer.customTitle, docData)}</div>`
            : '';
          const cNoteHtml = layer.customNote
            ? `<div ${editAttr} style="margin-top:4px;padding-top:3px;border-top:1px dashed #cbd5e1;font-weight:800;color:#334155;font-size:9.5px;">📌 ${this.interpolateSmartVariables(layer.customNote, docData)}</div>`
            : '';

          html = html.replace(
            new RegExp(`(<div[^>]*data-v47-layer-id="${layer.id}"[^>]*>)([\\s\\S]*?)(<\\/div>\\s*<!--\\s*end)`),
            `$1$2`
          );

          // حقن شريط العنوان الإضافي أو الملاحظة المخصصة أو الـ Style على الطبقة
          if (cTitleHtml || cNoteHtml || wrapperCustomCss) {
            const layerRegex = new RegExp(`(<div[^>]*data-v47-layer-id="${layer.id}"[\\s\\S]*?<div class="v45-layer-handle-bar"[\\s\\S]*?<\\/div>)`);
            if (layerRegex.test(html)) {
              html = html.replace(
                layerRegex,
                `$1${cTitleHtml ? `<div style="padding:2px 4px;">${cTitleHtml}</div>` : ''}`
              );
            }
          }
        }
      }

      return html;
    };

    // ========================================================================
    // 4. دوال التعديل المريح لخصائص الطبقات (Deep Layer Inspector Actions)
    // ========================================================================
    studio.openLayerInspector = function (layerId) {
      this.selectedLayerId = layerId;
      this.inspectorOpenForLayerId = layerId;
      this.selectLayerDomOnly(layerId);
      this.renderInspectorBoxOnly();

      // تمرير سلس إلى صندوق مفتش الطبقة إذا لم يكن ظاهراً
      const box = document.getElementById('v60ActiveLayerInspectorBox');
      if (box && box.scrollIntoView) {
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    studio.updateActiveLayerProp = function (layerId, propKey, val) {
      const layer = (this.config.layers || []).find((l) => l.id === layerId);
      if (!layer) return;
      layer[propKey] = val;
      if (propKey === 'customLabel' && val) {
        layer.name = val;
      }
      if (!layer.visible) layer.visible = true;

      // حفظ في البروفايل المعتمد للمستند الحالي أيضاً
      const docType = this.config.activeDocType || 'receipt_thermal';
      if (this.config.adoptedProfiles && this.config.adoptedProfiles[docType]) {
        this.config.adoptedProfiles[docType]._v60Customized = true;
        this.config.adoptedProfiles[docType].layers = JSON.parse(JSON.stringify(this.config.layers));
      }

      this.saveConfigLocal();
      this.refreshPaperHostOnly();
    };

    studio.insertSmartTagIntoLayerNote = function (layerId, tagText) {
      const layer = (this.config.layers || []).find((l) => l.id === layerId);
      if (!layer) return;
      layer.customNote = ((layer.customNote || '') + ' ' + tagText).trim();
      this.updateActiveLayerProp(layerId, 'customNote', layer.customNote);
      const inp = document.getElementById('v60InspectorNoteInput');
      if (inp) inp.value = layer.customNote;
    };

    studio.duplicateLayerAsCustomBlock = function (layerId) {
      const src = (this.config.layers || []).find((l) => l.id === layerId);
      if (!src) return;
      const newId = 'custom_' + Date.now().toString().slice(-5);
      const copyLayer = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        name: '📋 نسخة: ' + src.name.replace(/^[^\s]+\s\d+\.\s/, ''),
        visible: true,
        customNote: src.customNote || 'نص حر قابل للتعديل المباشر على الورقة'
      };
      const idx = this.config.layers.findIndex((l) => l.id === layerId);
      this.config.layers.splice(idx + 1, 0, copyLayer);
      this.selectedLayerId = newId;
      this.inspectorOpenForLayerId = newId;
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
      if (window.showToast) window.showToast('✅ تم استنساخ الطبقة وإضافتها تحت الطبقة الأصلية مباشرةً!', 'success');
    };

    studio.resetSingleLayerToDefault = function (layerId) {
      const layer = (this.config.layers || []).find((l) => l.id === layerId);
      const catMeta = FULL_30_SMART_LAYERS.find((c) => c.id === layerId);
      if (!layer) return;
      layer.fontSizeScale = 100;
      layer.textAlign = 'right';
      layer.borderStyle = 'default';
      layer.bgStyle = 'default';
      layer.paddingMode = 'normal';
      layer.customTitle = '';
      layer.customNote = '';
      if (catMeta) layer.name = catMeta.name;
      this.saveConfigLocal();
      this.renderInspectorBoxOnly();
      this.refreshPaperHostOnly();
      if (window.showToast) window.showToast('🔄 تمت استعادة الإعدادات الافتراضية لهذه الطبقة.', 'info');
    };

    studio.updateShopIdentityQuickField = async function (fieldKey, val) {
      if (!window.AppState) window.AppState = {};
      if (!window.AppState.settings) window.AppState.settings = {};
      window.AppState.settings[fieldKey] = val;
      try {
        if (window.api?.updateSettings) {
          await window.api.updateSettings({ [fieldKey]: val });
        }
      } catch (_) {}
      this.refreshPaperHostOnly();
    };

    studio.updateCustomColumnHeaderTitle = function (colKey, val) {
      if (!this.config.customTexts) this.config.customTexts = {};
      this.config.customTexts[colKey] = val;
      this.saveConfigLocal();
      this.refreshPaperHostOnly();
    };

    studio.applyTableColumnsPreset = function (presetKey) {
      const presets = {
        thermal_simple: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        a4_full: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: true, tva: true, subtotal: true },
        delivery_qty_only: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: false, discount: false, tva: false, subtotal: false },
        catalog_prices: { index: true, barcode: true, name: true, unit: true, qty: false, unitPrice: true, discount: false, tva: false, subtotal: false }
      };
      if (presets[presetKey]) {
        this.config.columns = { ...this.config.columns, ...presets[presetKey] };
        this.saveConfigLocal();
        this.renderStudioIntoRoot();
      }
    };

    // تحديث الورقة الحية فقط في 0ms دون إعادة رسم الشريط الجانبي (حتى لا يفقد المستخدم التركيز أثناء الكتابة في الحقول!)
    studio.refreshPaperHostOnly = async function () {
      const host = document.getElementById('v45LivePaperHost');
      if (!host) return;
      const docData = await this.resolveActiveDocumentData();
      host.innerHTML = this.buildLiveDocumentPaperHtml(docData, false);
    };

    // رسم صندوق "مفتش ومحرر الطبقة المحددة (Layer Deep Inspector)"
    studio.buildActiveLayerInspectorHtml = function () {
      const targetId = this.inspectorOpenForLayerId || this.selectedLayerId || 'header_layer';
      const layer = (this.config.layers || []).find((l) => l.id === targetId) || this.config.layers[0];
      if (!layer) return '';

      const catMeta = FULL_30_SMART_LAYERS.find((c) => c.id === layer.id);
      const scale = Number(layer.fontSizeScale || 100);

      return `
        <div class="rounded-2xl bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/60 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 border-2 border-blue-500 p-4 shadow-md space-y-3 text-xs">
          <div class="flex items-center justify-between gap-2 border-b border-blue-200 dark:border-slate-700 pb-2.5">
            <div>
              <div class="text-[10.5px] font-black text-blue-600 dark:text-blue-400">🎛️ مفتش ومحرر خصائص الطبقة المحددة (Layer Inspector)</div>
              <div class="font-black text-slate-900 dark:text-white text-sm mt-0.5">${layer.name}</div>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" onclick="window.GherbiPrintStudioV45.duplicateLayerAsCustomBlock('${layer.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-600 text-indigo-800 hover:text-white font-black text-[11px] cursor-pointer" title="تكرار هذه الطبقة">
                📋 تكرار
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.resetSingleLayerToDefault('${layer.id}')" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-rose-600 hover:text-white font-black text-[11px] cursor-pointer" title="إعادة ضبط الطبقة">
                🔄 ضبط
              </button>
            </div>
          </div>

          ${catMeta ? `<div class="text-[11px] text-slate-500 font-bold">💡 وظيفة الطبقة: ${catMeta.desc}</div>` : ''}

          <!-- 1. تعديل عنوان الطبقة والملاحظة المخصصة بداخلها -->
          <div class="grid grid-cols-1 gap-2.5">
            <div>
              <label class="block font-black text-slate-700 dark:text-slate-200 mb-1">✏️ عنوان مخصص أعلى/داخل هذه الطبقة (اختياري):</label>
              <input type="text" value="${layer.customTitle || ''}" oninput="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'customTitle', this.value)" placeholder="اتركه فارغاً للعنوان الافتراضي أو اكتب عنواناً خاصاً..." class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold outline-none focus:border-blue-500">
            </div>

            <div>
              <label class="block font-black text-slate-700 dark:text-slate-200 mb-1">📝 نص حر أو سطر إضافي يظهر داخل هذه الطبقة:</label>
              <textarea id="v60InspectorNoteInput" rows="2" oninput="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'customNote', this.value)" placeholder="اكتب أي جملة، رقم هاتف، شروط، أو أدرج متغيراً ذكياً من الأزرار بالأسفل..." class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold outline-none focus:border-blue-500">${layer.customNote || ''}</textarea>
            </div>

            <!-- أزرار إدراج المتغيرات الذكية الحية بنقرة واحدة -->
            <div class="space-y-1">
              <div class="text-[10.5px] font-black text-slate-500">⚡ إدراج متغير حي في الطبقة بنقرة واحدة:</div>
              <div class="flex flex-wrap gap-1">
                ${[
                  '{اسم_المتجر}',
                  '{هاتف_المتجر}',
                  '{اسم_الزبون}',
                  '{رقم_المستند}',
                  '{الإجمالي}',
                  '{الدين_السابق}',
                  '{صافي_الدين}',
                  '{نقاط_الوفاء}',
                  '{RIP}'
                ]
                  .map(
                    (tag) =>
                      `<button type="button" onclick="window.GherbiPrintStudioV45.insertSmartTagIntoLayerNote('${layer.id}', '${tag}')" class="px-2 py-0.5 rounded-lg bg-blue-100/80 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-800 dark:text-blue-300 font-mono font-bold text-[10px] cursor-pointer transition">${tag}</button>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <!-- 2. التحكم البصري المريح في حجم خط الطبقة، المحاذاة، الإطار، والخلفية -->
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-blue-200/70 dark:border-slate-700">
            <div>
              <label class="block font-black text-slate-600 dark:text-slate-300 mb-1">🔠 حجم خط هذه الطبقة:</label>
              <select onchange="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'fontSizeScale', Number(this.value))" class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black cursor-pointer">
                <option value="85" ${scale === 85 ? 'selected' : ''}>صغير مدمج (85%)</option>
                <option value="95" ${scale === 95 ? 'selected' : ''}>متوسط (95%)</option>
                <option value="100" ${scale === 100 ? 'selected' : ''}>قياسي افتراضي (100%)</option>
                <option value="110" ${scale === 110 ? 'selected' : ''}>كبير واضح (110%)</option>
                <option value="125" ${scale === 125 ? 'selected' : ''}>عريض بارز جداً (125%)</option>
              </select>
            </div>

            <div>
              <label class="block font-black text-slate-600 dark:text-slate-300 mb-1">↔️ محاذاة نصوص الطبقة:</label>
              <select onchange="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'textAlign', this.value)" class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black cursor-pointer">
                <option value="right" ${layer.textAlign === 'right' ? 'selected' : ''}>محاذاة لليمين (RTL)</option>
                <option value="center" ${layer.textAlign === 'center' ? 'selected' : ''}>توسيط (Center)</option>
                <option value="left" ${layer.textAlign === 'left' ? 'selected' : ''}>محاذاة لليسار (LTR)</option>
              </select>
            </div>

            <div>
              <label class="block font-black text-slate-600 dark:text-slate-300 mb-1">🔲 إطار وحدود الطبقة:</label>
              <select onchange="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'borderStyle', this.value)" class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold cursor-pointer">
                <option value="default" ${layer.borderStyle === 'default' ? 'selected' : ''}>الإطار القياسي للقالب</option>
                <option value="none" ${layer.borderStyle === 'none' ? 'selected' : ''}>بدون إطار</option>
                <option value="solid" ${layer.borderStyle === 'solid' ? 'selected' : ''}>إطار أسود متصل</option>
                <option value="dashed" ${layer.borderStyle === 'dashed' ? 'selected' : ''}>إطار متقطع (Dashed)</option>
                <option value="double" ${layer.borderStyle === 'double' ? 'selected' : ''}>إطار مزدوج رسمي</option>
              </select>
            </div>

            <div>
              <label class="block font-black text-slate-600 dark:text-slate-300 mb-1">🎨 لون خلفية الطبقة:</label>
              <select onchange="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'bgStyle', this.value)" class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold cursor-pointer">
                <option value="default" ${layer.bgStyle === 'default' ? 'selected' : ''}>خلفية القالب الافتراضية</option>
                <option value="white" ${layer.bgStyle === 'white' ? 'selected' : ''}>⚪ أبيض صافي (توفير حبر)</option>
                <option value="soft_slate" ${layer.bgStyle === 'soft_slate' ? 'selected' : ''}>🔘 رمادي فاتح رسمي</option>
                <option value="soft_blue" ${layer.bgStyle === 'soft_blue' ? 'selected' : ''}>🔵 أزرق هادئ</option>
                <option value="soft_green" ${layer.bgStyle === 'soft_green' ? 'selected' : ''}>🟢 أخضر تجاري</option>
                <option value="soft_amber" ${layer.bgStyle === 'soft_amber' ? 'selected' : ''}>🟡 ذهبي دافئ (VIP)</option>
                <option value="soft_rose" ${layer.bgStyle === 'soft_rose' ? 'selected' : ''}>🔴 وردي تحذيري (كريدي)</option>
              </select>
            </div>
          </div>
        </div>
      `;
    };

    studio.renderInspectorBoxOnly = function () {
      const box = document.getElementById('v60ActiveLayerInspectorBox');
      if (box) {
        box.innerHTML = this.buildActiveLayerInspectorHtml();
      }
    };

    // ========================================================================
    // 5. تحديث واجهة التبويب الأول (visual_studio) لتضم المكتبة ذات الـ 30 طبقة،
    //    ولفائف الترتيب المطورة، ومفتش الطبقة، ومحرر الأعمدة والمتجر المريح!
    // ========================================================================
    const prevRenderStudioV59 = studio.renderStudioIntoRoot.bind(studio);
    studio.renderStudioIntoRoot = async function (rootEl) {
      if (this.activeSection !== 'visual_studio') {
        return await prevRenderStudioV59(rootEl);
      }

      const targetRoot = rootEl || document.getElementById('print-view-root');
      if (!targetRoot) return;

      this.sync30LayersWithActiveConfig();
      const cfg = this.config;
      const all28 = this.ALL_28_MASTER_DOCS || [];
      const activeDocMeta = all28.find((d) => d.id === cfg.activeDocType) || all28[0] || { id: 'receipt_thermal', name: 'تذكرة كاشير', sourcePage: 'pos', sourceLabel: 'شاشة المبيعات' };
      const docData = await this.resolveActiveDocumentData();
      const paperHtml = this.buildLiveDocumentPaperHtml(docData, false);
      const shop = this.getShopIdentity();
      const ct = cfg.customTexts || {};

      let recordsList = [];
      if (activeDocMeta.sourcePage === 'purchases') recordsList = this.liveDataRecords.purchases || [];
      else if (activeDocMeta.sourcePage === 'proformas') recordsList = this.liveDataRecords.proformas || [];
      else if (activeDocMeta.sourcePage === 'orders') recordsList = this.liveDataRecords.orders || [];
      else recordsList = this.liveDataRecords.sales || [];

      const recordOptionsHtml = [
        `<option value="SAMPLE" ${this.selectedRecordId === 'SAMPLE' ? 'selected' : ''}>✨ بيانات نموذجية احترافية جاهزة للتعديل الحر</option>`,
        ...recordsList.slice(0, 50).map((r) => {
          const num = r.doc_number || r.invoice_number || ('#' + r.id);
          const party = r.customer_name || r.supplier_name || 'زبون عابر';
          const tot = Number(r.total || 0).toFixed(2);
          return `<option value="${r.id}" ${String(this.selectedRecordId) === String(r.id) ? 'selected' : ''}>📄 ${num} — ${party} (${tot} د.ج)</option>`;
        })
      ].join('');

      // فلترة مكتبة الـ 30 طبقة ذكية حسب الفئة المختارة أو البحث أو "🎯 طبقات هذا القالب"
      const catFilter = this.catalogCategoryFilter || 'ALL';
      const searchQ = (this.layerCatalogSearch || '').trim().toLowerCase();

      const filtered30Catalog = FULL_30_SMART_LAYERS.filter((item) => {
        if (catFilter === 'FOR_DOC') {
          const isRec = item.forDocs.includes('ALL') || item.forDocs.includes(cfg.activeDocType);
          if (!isRec) return false;
        } else if (catFilter !== 'ALL' && item.cat !== catFilter) {
          return false;
        }
        if (searchQ && !`${item.name} ${item.desc}`.toLowerCase().includes(searchQ)) {
          return false;
        }
        return true;
      });

      const activeLayersCount = (cfg.layers || []).filter((l) => l.visible).length;

      const suggestedCatalog30Html = filtered30Catalog
        .map((catItem) => {
          const layerState = cfg.layers.find((l) => l.id === catItem.id);
          const isVis = Boolean(layerState && layerState.visible);
          return `
            <div class="p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
              isVis
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-blue-400'
            }">
              <div class="space-y-0.5 flex-1 min-w-0">
                <div class="font-black text-xs text-slate-900 dark:text-white leading-snug">${catItem.name}</div>
                <div class="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">${catItem.desc}</div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick="window.GherbiPrintStudioV45.openLayerInspector('${catItem.id}')" class="px-2 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-blue-500 text-slate-700 dark:text-slate-200 font-black text-[10.5px] cursor-pointer" title="فتح محرر خصائص هذه الطبقة">
                  ⚙️
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.activateSuggestedLayerFromCatalog('${catItem.id}')" class="px-2.5 py-1.5 rounded-xl font-black text-[11px] transition cursor-pointer ${
                  isVis
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-rose-600'
                    : 'bg-blue-600 text-white shadow-sm hover:bg-blue-500'
                }">
                  ${isVis ? '✅ مفعّلة' : '➕ إضافة'}
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      // بناء صفوف "ترتيب طبقات المستند (Photoshop Layers)" مع أزرار (⚙️ تخصيص | 📋 تكرار | ▲ | ▼)
      const photoshopLayersRowsHtml = cfg.layers
        .map((l, idx) => {
          const isInspected = (this.inspectorOpenForLayerId || this.selectedLayerId) === l.id;
          return `
            <div data-v47-sidebar-layer-id="${l.id}" onclick="window.GherbiPrintStudioV45.openLayerInspector('${l.id}')" class="flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
              isInspected
                ? 'bg-blue-50 dark:bg-blue-950/50 border-2 border-blue-500 font-black shadow-sm'
                : l.visible
                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold hover:border-blue-400'
                : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 text-slate-400'
            }">
              <div class="flex items-center gap-2 truncate flex-1 min-w-0">
                <input type="checkbox" ${l.visible ? 'checked' : ''} onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleLayerVisibility('${l.id}')" class="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0">
                <span class="truncate ${l.visible ? '' : 'line-through'}">${l.name}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0 mr-1">
                <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.openLayerInspector('${l.id}')" class="px-2 py-0.5 rounded-lg ${isInspected ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300'} font-black text-[10px] hover:bg-blue-600 hover:text-white cursor-pointer" title="تعديل عنوان وخصائص وتنسيق هذه الطبقة">
                  ⚙️ تعديل
                </button>
                <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45. moveLayer('${l.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] hover:bg-blue-600 hover:text-white disabled:opacity-30 cursor-pointer">▲</button>
                <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayer('${l.id}', 1)" ${idx === cfg.layers.length - 1 ? 'disabled' : ''} class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] hover:bg-blue-600 hover:text-white disabled:opacity-30 cursor-pointer">▼</button>
                ${
                  l.id.startsWith('custom_')
                    ? `<button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.deleteCustomLayer('${l.id}')" class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 text-[10px] hover:bg-rose-600 hover:text-white cursor-pointer">✕</button>`
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

      targetRoot.innerHTML = `
        <div id="v45MasterPrintStudio" data-gherbi-print-v2="1" class="space-y-4 text-right pb-8 w-full" dir="rtl">
          <!-- الترويسة العليا للتبويبات الخمسة -->
          <div class="rounded-3xl bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 text-white p-5 shadow-xl border border-blue-500/30 w-full">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                  <span class="material-symbols-rounded" style="font-size:28px;">print</span>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-black text-[11px]">
                      Gherbi.Ai Omni-Print V60 — 28 قالباً & 30 طبقة ذكية
                    </span>
                    <h1 class="text-lg md:text-xl font-black">
                      مركز الطباعة الشامل، مكتبة الـ 30 طبقة، ومفتش التخصيص المريح
                    </h1>
                  </div>
                  <p class="text-xs text-slate-300 mt-0.5">
                    اختر أي مستند من الـ 28 قالباً، وتحكم في الـ 30 طبقة ذكية، وعدّل خصائص كل طبقة وعناوين الجدول وبيانات المتجر بكل أريحية
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('visual_studio')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-blue-600 text-white shadow-md">
                  🎨 1. استوديو الفواتير والطبقات (30 طبقة)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('cross_page_bridge')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-white/10 hover:bg-white/20 text-slate-200">
                  🔗 2. فواتير الصفحات (${(this.liveDataRecords.sales || []).length + (this.liveDataRecords.purchases || []).length})
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('barcode_shelf_factory')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-white/10 hover:bg-white/20 text-slate-200">
                  🏷️ 3. الباركود والرفوف
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('free_word_editor')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-white/10 hover:bg-white/20 text-slate-200">
                  📝 4. محرر البونات (Word)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('hardware_defaults')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-white/10 hover:bg-white/20 text-slate-200">
                  ⚙️ 5. القوالب الافتراضية الـ 28 (Par Défaut)
                </button>
              </div>
            </div>
          </div>

          <!-- شريط أدوات القالب والمقاس والاعتماد -->
          <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
              <div class="flex flex-wrap items-center gap-2">
                <label class="text-xs font-black text-slate-700 dark:text-slate-200">📑 القالب (28 مستنداً):</label>
                <select onchange="window.GherbiPrintStudioV45.selectDocType(this.value)" class="px-3 py-2 rounded-xl bg-blue-50 dark:bg-slate-900 border-2 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-200 font-black text-xs cursor-pointer min-w-[270px]">
                  ${this.build28DocsGroupedOptionsHtml(cfg.activeDocType)}
                </select>

                <select onchange="window.GherbiPrintStudioV45.selectLiveRecord(this.value)" class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-xs max-w-xs cursor-pointer">
                  ${recordOptionsHtml}
                </select>

                <button type="button" onclick="window.GherbiPrintStudioV45.applySingleProDefaultTemplate('${cfg.activeDocType}')" class="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 border border-amber-400 font-black text-xs transition cursor-pointer">
                  ⚡ استعادة القالب الاحترافي الجاهز
                </button>

                <button type="button" onclick="window.App.switchView('${activeDocMeta.sourcePage}')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 font-black text-xs transition cursor-pointer">
                  🔗 افتح (${activeDocMeta.sourceLabel}) ⬅
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.saveAsDefaultForDocType()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5">
                  <span>⭐ اعتماد وحفظ كأمر مطلق للطباعة (Par Défaut)</span>
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.printCurrentCanvasNow()" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition cursor-pointer">
                  🖨️ طباعة / PDF الآن
                </button>
              </div>
            </div>

            <!-- الصف الثاني من شريط الأدوات -->
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-black text-slate-500 text-[11px]">📐 المقاس:</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('a4')" class="v45-word-ribbon-btn ${cfg.paperSize === 'a4' ? 'active' : ''}">A4 رسمي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('a5')" class="v45-word-ribbon-btn ${cfg.paperSize === 'a5' ? 'active' : ''}">A5 نصفي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('2xa5')" class="v45-word-ribbon-btn ${cfg.paperSize === '2xa5' ? 'active' : ''}">2×A5 مزدوج</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('80mm')" class="v45-word-ribbon-btn ${cfg.paperSize === '80mm' ? 'active' : ''}">80mm حراري</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('58mm')" class="v45-word-ribbon-btn ${cfg.paperSize === '58mm' ? 'active' : ''}">58mm حراري</button>

                <span class="mx-1 text-slate-300">|</span>
                <span class="font-black text-slate-500 text-[11px]">🔤 الخط العام:</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.stepFontSize(-0.5)" class="v45-word-ribbon-btn">-A</button>
                <span class="font-mono font-black px-1">${cfg.baseFontSizePx}px</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.stepFontSize(0.5)" class="v45-word-ribbon-btn">+A</button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <div class="inline-flex items-center rounded-xl bg-amber-50 dark:bg-slate-900 border border-amber-300 p-0.5 text-[11px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.switchLoyaltySimulationMode('vip')" class="px-2 py-1 rounded-lg font-black cursor-pointer ${this.loyaltySimMode === 'vip' ? 'bg-amber-500 text-slate-950' : 'text-amber-800'}">👑 زبون وفي</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.switchLoyaltySimulationMode('walkin')" class="px-2 py-1 rounded-lg font-black cursor-pointer ${this.loyaltySimMode === 'walkin' ? 'bg-slate-800 text-white' : 'text-slate-600'}">🚶 زبون عابر (0 ن)</button>
                </div>
                <button type="button" onclick="window.GherbiPrintStudioV45.addRowToActiveTicket()" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer">➕ سطر جديد</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.removeLastRowFromActiveTicket()" class="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-black text-[11px] cursor-pointer">➖ حذف سطر</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.triggerLogoUploadFromStudio()" class="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-black text-[11px] cursor-pointer">📷 الشعار</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showCentimesEquivalent')" class="v45-word-ribbon-btn ${cfg.showCentimesEquivalent ? 'active' : ''}">🇩🇿 السنتيم</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showCustomerBalance')" class="v45-word-ribbon-btn ${cfg.showCustomerBalance ? 'active' : ''}">⚖️ الباقي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showDocBarcode')" class="v45-word-ribbon-btn ${cfg.showDocBarcode ? 'active' : ''}">||| باركود</button>
              </div>
            </div>
          </div>

          <!-- مساحة العمل المزدوجة: يمين (الأدوات والمكتبة ذات الـ 30 طبقة والمفتش المريح) | يسار (الورقة الحية) -->
          <div class="v59-studio-main-grid">
            <div class="space-y-3.5 max-h-[80vh] overflow-y-auto pl-1">
              <!-- أ) مفتش ومحرر الطبقة المحددة المريح (Layer Deep Inspector) — يتحدث فور النقر على أي طبقة -->
              <div id="v60ActiveLayerInspectorBox">
                ${this.buildActiveLayerInspectorHtml()}
              </div>

              <!-- ب) مكتبة الطبقات الذكية المقترحة الموسعة (30 طبقة احترافية في 6 فئات + بحث + طبقات القالب) -->
              <div class="rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-400/70 dark:border-indigo-600/60 p-4 shadow-sm space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <div>
                    <h3 class="font-black text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <span>🧩 مكتبة الطبقات الذكية المقترحة (30 طبقة احترافية)</span>
                      <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px]">${activeLayersCount} مفعّلة</span>
                    </h3>
                    <p class="text-[10.5px] text-slate-500 mt-0.5">أضف أو أخفِ أو خصّص أي طبقة بضغطة زر على التذكرة أو الفاتورة</p>
                  </div>
                  <div class="flex items-center gap-1">
                    <button type="button" onclick="window.GherbiPrintStudioV45.enableAllSuggestedLayers()" class="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-600 text-indigo-800 hover:text-white font-black text-[10.5px] transition cursor-pointer">
                      ✨ تفعيل الكل
                    </button>
                  </div>
                </div>

                <!-- حقل بحث فوري داخل الـ 30 طبقة -->
                <input type="text" value="${this.layerCatalogSearch || ''}" oninput="window.GherbiPrintStudioV45.setLayerCatalogSearch(this.value)" placeholder="🔎 ابحث في الـ 30 طبقة (كريدي، وفاء، ضمان، جرد، سائق، G12...)" class="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold outline-none focus:border-blue-500">

                <!-- أزرار تصنيف الـ 30 طبقة (7 فلاتر) -->
                <div class="flex flex-wrap items-center gap-1 text-[10.5px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('ALL')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${catFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">الكل (30)</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('FOR_DOC')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${catFilter === 'FOR_DOC' ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-blue-300'}">🎯 طبقات هذا القالب</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('CORE')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${catFilter === 'CORE' ? 'bg-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}">🏛️ الأساسية (6)</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('LOYALTY')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${catFilter === 'LOYALTY' ? 'bg-amber-500 text-slate-950' : 'bg-amber-50 dark:bg-slate-700 text-amber-800 dark:text-amber-300'}">👑 الوفاء (5)</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('FINANCE')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${catFilter === 'FINANCE' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-slate-700 text-emerald-800 dark:text-emerald-300'}">💳 الكريدي (5)</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('INVENTORY')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${catFilter === 'INVENTORY' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-slate-700 text-indigo-800 dark:text-indigo-300'}">📦 المخزون والمشتريات (5)</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('LOGISTICS')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${catFilter === 'LOGISTICS' ? 'bg-teal-600 text-white' : 'bg-teal-50 dark:bg-slate-700 text-teal-800 dark:text-teal-300'}">🚚 الضمان والتوصيل (4)</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogCategoryFilter('CAISSE_FISCAL')" class="px-2.5 py-1 rounded-lg font-black cursor-pointer ${catFilter === 'CAISSE_FISCAL' ? 'bg-rose-600 text-white' : 'bg-rose-50 dark:bg-slate-700 text-rose-800 dark:text-rose-300'}">🏦 الصندوق والجباية (5)</button>
                </div>

                <div class="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                  ${suggestedCatalog30Html}
                </div>
              </div>

              <!-- ج) ترتيب طبقات المستند (Photoshop Layers — 30 طبقة قابلة للترتيب والتعديل المريح) -->
              <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-2.5">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <div>
                    <h3 class="font-black text-xs text-slate-900 dark:text-white">🗂️ ترتيب طبقات المستند (Photoshop Layers)</h3>
                    <p class="text-[10px] text-slate-400">اضغط (⚙️ تعديل) أمام أي طبقة لفتح محررها المريح بالأعلى</p>
                  </div>
                  <button type="button" onclick="window.GherbiPrintStudioV45.addCustomLayerBlock()" class="px-2.5 py-1.5 rounded-xl bg-blue-600 text-white font-black text-[11px] hover:bg-blue-500 cursor-pointer shadow-sm">
                    + طبقة نصية حرة
                  </button>
                </div>

                <div class="space-y-1.5 max-h-64 overflow-y-auto">
                  ${photoshopLayersRowsHtml}
                </div>
              </div>

              <!-- د) محرر أعمدة الجدول المريح (إظهار/إخفاء + تغيير تسمية أي عمود + قوالب أعمدة سريعة) -->
              <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3 text-xs">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h3 class="font-black text-slate-900 dark:text-white">📊 تخصيص وتسمية أعمدة جدول الأصناف</h3>
                  <div class="flex gap-1 text-[10px]">
                    <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPreset('thermal_simple')" class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-bold cursor-pointer">تذكرة مبسطة</button>
                    <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPreset('a4_full')" class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold cursor-pointer">فاتورة كاملة</button>
                    <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPreset('delivery_qty_only')" class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold cursor-pointer">وصل كميات</button>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 font-bold">
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.columns.index ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('index')" class="accent-blue-600"> <span>رقم السطر (#)</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.columns.barcode ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('barcode')" class="accent-blue-600"> <span>الباركود / الكود</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.columns.name ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('name')" class="accent-blue-600"> <span>التعيين / الصنف</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.columns.unit ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('unit')" class="accent-blue-600"> <span>الوحدة</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.columns.qty ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('qty')" class="accent-blue-600"> <span>الكمية</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.columns.unitPrice ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('unitPrice')" class="accent-blue-600"> <span>سعر الوحدة</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.columns.discount ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('discount')" class="accent-blue-600"> <span>الخصم</span></label>
                  <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ${cfg.columns.tva ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumn('tva')" class="accent-blue-600"> <span>ضريبة TVA</span></label>
                </div>

                <!-- تعديل مسميات رؤوس الأعمدة مباشرة -->
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div><label class="block text-[10px] text-slate-400">عنوان عمود الصنف:</label><input type="text" value="${ct.colName || 'التعيين / الصنف'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colName', this.value)" class="w-full px-2.5 py-1 rounded-lg border font-bold"></div>
                  <div><label class="block text-[10px] text-slate-400">عنوان عمود الكمية:</label><input type="text" value="${ct.colQty || 'الكمية'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colQty', this.value)" class="w-full px-2.5 py-1 rounded-lg border font-bold"></div>
                  <div><label class="block text-[10px] text-slate-400">عنوان عمود السعر:</label><input type="text" value="${ct.colPrice || 'سعر الوحدة'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colPrice', this.value)" class="w-full px-2.5 py-1 rounded-lg border font-bold"></div>
                  <div><label class="block text-[10px] text-slate-400">عنوان عمود المجموع:</label><input type="text" value="${ct.colSubtotal || 'المجموع'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colSubtotal', this.value)" class="w-full px-2.5 py-1 rounded-lg border font-bold"></div>
                </div>
              </div>

              <!-- هـ) محرر بيانات المتجر والتذييل السريع من داخل الاستوديو -->
              <details class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm text-xs">
                <summary class="font-black text-slate-900 dark:text-white cursor-pointer select-none">
                  🏢 تعديل سريع لبيانات المتجر والبيانات الجبائية والتذييل
                </summary>
                <div class="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-slate-700">
                  <div class="col-span-2"><label class="block font-bold mb-0.5">اسم المتجر / المؤسسة:</label><input type="text" value="${shop.name}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_name', this.value)" class="w-full px-2.5 py-1.5 rounded-lg border font-black"></div>
                  <div><label class="block font-bold mb-0.5">رقم الهاتف:</label><input type="text" value="${shop.phone}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_phone', this.value)" class="w-full px-2.5 py-1.5 rounded-lg border font-mono"></div>
                  <div><label class="block font-bold mb-0.5">العنوان:</label><input type="text" value="${shop.address}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_address', this.value)" class="w-full px-2.5 py-1.5 rounded-lg border"></div>
                  <div><label class="block font-bold mb-0.5">السجل التجاري (RC):</label><input type="text" value="${shop.rc}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_rc', this.value)" class="w-full px-2.5 py-1.5 rounded-lg border font-mono"></div>
                  <div><label class="block font-bold mb-0.5">الرقم الجبائي (NIF):</label><input type="text" value="${shop.nif}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_nif', this.value)" class="w-full px-2.5 py-1.5 rounded-lg border font-mono"></div>
                  <div class="col-span-2"><label class="block font-bold mb-0.5">عبارة التذييل وشروط الاستبدال:</label><input type="text" value="${cfg.customFooterTerms || ''}" oninput="window.GherbiPrintStudioV45.updateCfg('customFooterTerms', this.value)" class="w-full px-2.5 py-1.5 rounded-lg border font-bold"></div>
                </div>
              </details>
            </div>

            <!-- يسار: الورقة التفاعلية الحية القابلة للكتابة والتعديل المباشر -->
            <div class="w-full min-w-0">
              <div class="v45-studio-workspace max-h-[80vh] w-full">
                <div id="v45LivePaperHost">
                  ${paperHtml}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    };

    studio.setLayerCatalogSearch = function (val) {
      this.layerCatalogSearch = String(val || '');
      this.renderStudioIntoRoot();
      setTimeout(() => {
        const inp = document.querySelector('input[placeholder*="ابحث في الـ 30 طبقة"]');
        if (inp) {
          inp.focus();
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        }
      }, 10);
    };

    if (document.getElementById('view-print')?.classList.contains('active')) {
      studio.renderStudioIntoRoot();
    }

    console.log('🏆 [Gherbi V60 Smart 30 Layers & Deep Inspector]: تم تفعيل الـ 30 طبقة ذكية ومفتش خصائص الطبقات المريح 100%!');
  }, 140);
})();

/* ==================== [V61 ZERO-JUMP SUB-TABBED PRINT STUDIO & INLINE INSPECTOR] ==================== */
(function initV61ZeroJumpSubTabbedPrintStudio() {
  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.App || !studio.FULL_30_SMART_LAYERS) return;
    clearInterval(waitStudio);

    // حالة التبويب الفرعي في اللوحة اليمنى ومحررات الأكورديون المدمجة
    studio.leftPanelTab = studio.leftPanelTab || 'catalog_30'; // 'catalog_30' | 'layers_stack' | 'columns_and_shop'
    studio.expandedInspectorLayerId = null; // يفتح فقط عند الضغط الصريح على زر ⚙️ تحت نفس العنصر!

    // 1. محرك حفظ واستعادة مواضع التمرير لجميع الحاويات بدقة 100% (Zero-Scroll-Jump Engine)
    studio.captureAllScrollPositions = function () {
      const ids = ['view-print', 'v61LeftScrollContainer', 'v61RightPaperWorkspace'];
      const map = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) map[id] = el.scrollTop;
      }
      return map;
    };

    studio.restoreAllScrollPositions = function (map) {
      if (!map) return;
      const apply = () => {
        for (const [id, topVal] of Object.entries(map)) {
          const el = document.getElementById(id);
          if (el && typeof topVal === 'number') {
            el.scrollTop = topVal;
          }
        }
      };
      apply();
      requestAnimationFrame(apply);
    };

    // 2. بناء درج التخصيص المدمج (Inline Accordion Inspector) الذي يظهر مباشرةً تحت الطبقة المضغوط عليها
    studio.buildInlineAccordionInspectorHtml = function (layerId) {
      const layer = (this.config.layers || []).find((l) => l.id === layerId);
      if (!layer) return '';

      const scale = Number(layer.fontSizeScale || 100);

      return `
        <div class="v61-inline-inspector-drawer space-y-2.5 text-xs p-2.5" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-blue-200 dark:border-slate-700 pb-1.5">
            <span class="font-black text-blue-700 dark:text-blue-400 text-[11px]">🎛️ تخصيص مريح ومباشر لهذه الطبقة:</span>
            <div class="flex items-center gap-1">
              <button type="button" onclick="window.GherbiPrintStudioV45.duplicateLayerInPlace('${layer.id}')" class="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-600 text-indigo-800 hover:text-white font-black text-[10px] cursor-pointer">
                📋 تكرار
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.resetLayerInPlace('${layer.id}')" class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-rose-600 hover:text-white font-black text-[10px] cursor-pointer">
                🔄 ضبط
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.toggleInlineInspector('${layer.id}')" class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-black text-[10px] cursor-pointer">
                ✕ إغلاق
              </button>
            </div>
          </div>

          <div>
            <label class="block font-black text-slate-700 dark:text-slate-200 mb-1 text-[11px]">✏️ عنوان مخصص أعلى هذه الطبقة (اختياري):</label>
            <input type="text" value="${layer.customTitle || ''}" oninput="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'customTitle', this.value)" placeholder="اتركه فارغاً للعنوان الافتراضي أو اكتب عنواناً خاصاً..." class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold outline-none focus:border-blue-500">
          </div>

          <div>
            <label class="block font-black text-slate-700 dark:text-slate-200 mb-1 text-[11px]">📝 نص حر أو سطر إضافي داخل هذه الطبقة:</label>
            <textarea id="v61InlineNote_${layer.id}" rows="2" oninput="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'customNote', this.value)" placeholder="اكتب أي ملاحظة أو أدرج متغيراً ذكياً من الأزرار بالأسفل..." class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold outline-none focus:border-blue-500">${layer.customNote || ''}</textarea>
          </div>

          <div class="space-y-1">
            <div class="text-[10px] font-black text-slate-500">⚡ إدراج متغير حي بنقرة واحدة:</div>
            <div class="flex flex-wrap gap-1">
              ${[
                '{اسم_المتجر}',
                '{هاتف_المتجر}',
                '{اسم_الزبون}',
                '{رقم_المستند}',
                '{الإجمالي}',
                '{الدين_السابق}',
                '{صافي_الدين}',
                '{نقاط_الوفاء}',
                '{RIP}'
              ]
                .map(
                  (tag) =>
                    `<button type="button" onclick="window.GherbiPrintStudioV45.insertTagInInlineNote('${layer.id}', '${tag}')" class="px-2 py-0.5 rounded-lg bg-blue-100/90 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-800 dark:text-blue-300 font-mono font-bold text-[10px] cursor-pointer">${tag}</button>`
                )
                .join('')}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1.5 border-t border-blue-200/60 dark:border-slate-700">
            <div>
              <label class="block font-black text-slate-600 dark:text-slate-300 mb-0.5 text-[10.5px]">🔠 حجم خط الطبقة:</label>
              <select onchange="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'fontSizeScale', Number(this.value))" class="w-full px-2 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black text-[11px] cursor-pointer">
                <option value="85" ${scale === 85 ? 'selected' : ''}>صغير (85%)</option>
                <option value="95" ${scale === 95 ? 'selected' : ''}>متوسط (95%)</option>
                <option value="100" ${scale === 100 ? 'selected' : ''}>قياسي (100%)</option>
                <option value="110" ${scale === 110 ? 'selected' : ''}>كبير (110%)</option>
                <option value="125" ${scale === 125 ? 'selected' : ''}>بارز جداً (125%)</option>
              </select>
            </div>

            <div>
              <label class="block font-black text-slate-600 dark:text-slate-300 mb-0.5 text-[10.5px]">↔️ محاذاة النصوص:</label>
              <select onchange="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'textAlign', this.value)" class="w-full px-2 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black text-[11px] cursor-pointer">
                <option value="right" ${layer.textAlign === 'right' ? 'selected' : ''}>يمين (RTL)</option>
                <option value="center" ${layer.textAlign === 'center' ? 'selected' : ''}>توسيط (Center)</option>
                <option value="left" ${layer.textAlign === 'left' ? 'selected' : ''}>يسار (LTR)</option>
              </select>
            </div>

            <div>
              <label class="block font-black text-slate-600 dark:text-slate-300 mb-0.5 text-[10.5px]">🔲 إطار الطبقة:</label>
              <select onchange="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'borderStyle', this.value)" class="w-full px-2 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-[11px] cursor-pointer">
                <option value="default" ${layer.borderStyle === 'default' ? 'selected' : ''}>الإطار القياسي</option>
                <option value="none" ${layer.borderStyle === 'none' ? 'selected' : ''}>بدون إطار</option>
                <option value="solid" ${layer.borderStyle === 'solid' ? 'selected' : ''}>إطار متصل</option>
                <option value="dashed" ${layer.borderStyle === 'dashed' ? 'selected' : ''}>إطار متقطع</option>
                <option value="double" ${layer.borderStyle === 'double' ? 'selected' : ''}>إطار مزدوج</option>
              </select>
            </div>

            <div>
              <label class="block font-black text-slate-600 dark:text-slate-300 mb-0.5 text-[10.5px]">🎨 خلفية الطبقة:</label>
              <select onchange="window.GherbiPrintStudioV45.updateActiveLayerProp('${layer.id}', 'bgStyle', this.value)" class="w-full px-2 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-[11px] cursor-pointer">
                <option value="default" ${layer.bgStyle === 'default' ? 'selected' : ''}>الافتراضية</option>
                <option value="white" ${layer.bgStyle === 'white' ? 'selected' : ''}>⚪ أبيض صافي</option>
                <option value="soft_slate" ${layer.bgStyle === 'soft_slate' ? 'selected' : ''}>🔘 رمادي فاتح</option>
                <option value="soft_blue" ${layer.bgStyle === 'soft_blue' ? 'selected' : ''}>🔵 أزرق هادئ</option>
                <option value="soft_green" ${layer.bgStyle === 'soft_green' ? 'selected' : ''}>🟢 أخضر تجاري</option>
                <option value="soft_amber" ${layer.bgStyle === 'soft_amber' ? 'selected' : ''}>🟡 ذهبي (VIP)</option>
                <option value="soft_rose" ${layer.bgStyle === 'soft_rose' ? 'selected' : ''}>🔴 وردي (كريدي)</option>
              </select>
            </div>
          </div>
        </div>
      `;
    };

    // 3. بناء محتوى اللوحة الجانبية اليمنى فقط (حسب التبويب الفرعي المختار) دون المساس ببقية الصفحة
    studio.buildLeftSidebarPanelHtml = function () {
      this.sync30LayersWithActiveConfig();
      const cfg = this.config;
      const full30 = this.FULL_30_SMART_LAYERS || [];
      const activeLayersCount = (cfg.layers || []).filter((l) => l.visible).length;
      const subTab = this.leftPanelTab || 'catalog_30';
      const catFilter = this.catalogCategoryFilter || 'ALL';
      const searchQ = (this.layerCatalogSearch || '').trim().toLowerCase();
      const shop = this.getShopIdentity();
      const ct = cfg.customTexts || {};

      let subTabBodyHtml = '';

      if (subTab === 'catalog_30') {
        const filtered30 = full30.filter((item) => {
          if (catFilter === 'FOR_DOC') {
            const isRec = item.forDocs.includes('ALL') || item.forDocs.includes(cfg.activeDocType);
            if (!isRec) return false;
          } else if (catFilter !== 'ALL' && item.cat !== catFilter) {
            return false;
          }
          if (searchQ && !`${item.name} ${item.desc}`.toLowerCase().includes(searchQ)) {
            return false;
          }
          return true;
        });

        const cardsHtml = filtered30
          .map((catItem) => {
            const layerState = cfg.layers.find((l) => l.id === catItem.id);
            const isVis = Boolean(layerState && layerState.visible);
            const isExpanded = this.expandedInspectorLayerId === catItem.id;

            return `
              <div class="p-3 rounded-2xl border transition ${
                isExpanded
                  ? 'bg-white dark:bg-slate-800 border-2 border-blue-500 shadow-md'
                  : isVis
                  ? 'bg-emerald-50/75 dark:bg-emerald-950/30 border-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }">
                <div class="flex items-start justify-between gap-2">
                  <div class="space-y-0.5 flex-1 min-w-0 cursor-pointer" onclick="window.GherbiPrintStudioV45.toggleLayerInPlace('${catItem.id}')">
                    <div class="font-black text-xs text-slate-900 dark:text-white leading-snug">${catItem.name}</div>
                    <div class="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">${catItem.desc}</div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleInlineInspector('${catItem.id}')" class="px-2.5 py-1.5 rounded-xl border font-black text-xs transition cursor-pointer ${
                      isExpanded
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-500'
                    }" title="فتح/إغلاق إعدادات هذه الطبقة هنا مباشرةً">
                      ⚙️
                    </button>
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleLayerInPlace('${catItem.id}')" class="px-3 py-1.5 rounded-xl font-black text-[11px] transition cursor-pointer ${
                      isVis
                        ? 'bg-emerald-600 text-white shadow-sm hover:bg-rose-600'
                        : 'bg-blue-600 text-white shadow-sm hover:bg-blue-500'
                    }">
                      ${isVis ? '✅ مفعّلة' : '+ إضافة'}
                    </button>
                  </div>
                </div>
                ${isExpanded ? this.buildInlineAccordionInspectorHtml(catItem.id) : ''}
              </div>
            `;
          })
          .join('');

        subTabBodyHtml = `
          <div class="space-y-3">
            <!-- شريط البحث وزر تفعيل الكل -->
            <div class="flex items-center gap-1.5">
              <input id="v61CatalogSearchInp" type="text" value="${this.layerCatalogSearch || ''}" oninput="window.GherbiPrintStudioV45.onCatalogSearchInPlace(this.value)" placeholder="🔎 ابحث في الـ 30 طبقة (كريدي، وفاء، ضمان، سائق...)" class="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold outline-none focus:border-blue-500">
              <button type="button" onclick="window.GherbiPrintStudioV45.enableAllSuggestedLayersInPlace()" class="px-3 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-600 text-indigo-900 hover:text-white font-black text-[11px] whitespace-nowrap transition cursor-pointer">
                ✨ تفعيل الكل
              </button>
            </div>

            <!-- أزرار الفلترة الـ 8 (تحدث القائمة في مكانها بدون أي قفز) -->
            <div class="flex flex-wrap items-center gap-1 text-[11px]">
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('ALL')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">الكل (30)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('FOR_DOC')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'FOR_DOC' ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-blue-300'}">🎯 طبقات هذا القالب</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('CORE')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'CORE' ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}">🏛️ الأساسية (6)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('LOYALTY')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'LOYALTY' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-amber-50 dark:bg-slate-700 text-amber-800 dark:text-amber-300'}">👑 الوفاء (5)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('FINANCE')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'FINANCE' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 dark:bg-slate-700 text-emerald-800 dark:text-emerald-300'}">💳 الكريدي (5)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('INVENTORY')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'INVENTORY' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 dark:bg-slate-700 text-indigo-800 dark:text-indigo-300'}">📦 المخزون والمشتريات (5)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('LOGISTICS')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'LOGISTICS' ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 dark:bg-slate-700 text-teal-800 dark:text-teal-300'}">🚚 الضمان والتوصيل (4)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('CAISSE_FISCAL')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'CAISSE_FISCAL' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 dark:bg-slate-700 text-rose-800 dark:text-rose-300'}">🏦 الصندوق والجباية (5)</button>
            </div>

            <!-- قائمة البطاقات بثبات تام -->
            <div id="v61LeftScrollContainer" class="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              ${cardsHtml}
            </div>
          </div>
        `;
      } else if (subTab === 'layers_stack') {
        const stackRowsHtml = cfg.layers
          .map((l, idx) => {
            const isExpanded = this.expandedInspectorLayerId === l.id;
            return `
              <div class="p-2.5 rounded-2xl border transition ${
                isExpanded
                  ? 'bg-white dark:bg-slate-800 border-2 border-blue-500 shadow-md'
                  : l.visible
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold hover:border-blue-400'
                  : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 text-slate-400'
              }">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2 truncate flex-1 min-w-0 cursor-pointer" onclick="window.GherbiPrintStudioV45.toggleLayerInPlace('${l.id}')">
                    <input type="checkbox" ${l.visible ? 'checked' : ''} onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleLayerInPlace('${l.id}')" class="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0">
                    <span class="truncate ${l.visible ? 'font-black text-slate-900 dark:text-white' : 'line-through'}">${l.name}</span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleInlineInspector('${l.id}')" class="px-2 py-1 rounded-lg ${
                      isExpanded ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300'
                    } font-black text-[10.5px] hover:bg-blue-600 hover:text-white cursor-pointer">
                      ⚙️ تعديل
                    </button>
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayerInPlace('${l.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10.5px] hover:bg-blue-600 hover:text-white disabled:opacity-30 cursor-pointer">▲</button>
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayerInPlace('${l.id}', 1)" ${idx === cfg.layers.length - 1 ? 'disabled' : ''} class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10.5px] hover:bg-blue-600 hover:text-white disabled:opacity-30 cursor-pointer">▼</button>
                    ${
                      l.id.startsWith('custom_')
                        ? `<button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.deleteCustomLayerInPlace('${l.id}')" class="px-2 py-1 rounded-lg bg-rose-100 text-rose-600 text-[10.5px] hover:bg-rose-600 hover:text-white cursor-pointer">✕</button>`
                        : ''
                    }
                  </div>
                </div>
                ${isExpanded ? this.buildInlineAccordionInspectorHtml(l.id) : ''}
              </div>
            `;
          })
          .join('');

        subTabBodyHtml = `
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500">اسحب أو اضغط (▲ / ▼) لترتيب الطبقات، أو اضغط (⚙️ تعديل) لفتح خصائص الطبقة تحتها مباشرةً:</span>
              <button type="button" onclick="window.GherbiPrintStudioV45.addCustomLayerInPlace()" class="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-500 cursor-pointer shrink-0 shadow-sm">
                + طبقة نصية حرة
              </button>
            </div>
            <div id="v61LeftScrollContainer" class="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
              ${stackRowsHtml}
            </div>
          </div>
        `;
      } else {
        // التبويب الفرعي الثالث: الأعمدة وبيانات المتجر
        subTabBodyHtml = `
          <div id="v61LeftScrollContainer" class="space-y-4 max-h-[64vh] overflow-y-auto pr-1 text-xs">
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <h4 class="font-black text-slate-900 dark:text-white">📊 إظهار وإخفاء أعمدة الجدول</h4>
                <div class="flex gap-1 text-[10px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('thermal_simple')" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border font-black cursor-pointer">تذكرة مبسطة</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('a4_full')" class="px-2 py-1 rounded-lg bg-blue-600 text-white font-black cursor-pointer">فاتورة كاملة</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('delivery_qty_only')" class="px-2 py-1 rounded-lg bg-emerald-600 text-white font-black cursor-pointer">وصل كميات</button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2.5 font-bold">
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.index ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('index')" class="w-4 h-4 accent-blue-600"> <span>رقم السطر (#)</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.barcode ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('barcode')" class="w-4 h-4 accent-blue-600"> <span>الباركود / الكود</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.name ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('name')" class="w-4 h-4 accent-blue-600"> <span>التعيين / الصنف</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.unit ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('unit')" class="w-4 h-4 accent-blue-600"> <span>الوحدة</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.qty ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('qty')" class="w-4 h-4 accent-blue-600"> <span>الكمية</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.unitPrice ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('unitPrice')" class="w-4 h-4 accent-blue-600"> <span>سعر الوحدة</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.discount ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('discount')" class="w-4 h-4 accent-blue-600"> <span>الخصم</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.tva ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('tva')" class="w-4 h-4 accent-blue-600"> <span>ضريبة TVA</span></label>
              </div>

              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div><label class="block text-[10.5px] font-bold text-slate-500 mb-0.5">عنوان عمود الصنف:</label><input type="text" value="${ct.colName || 'التعيين / الصنف'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colName', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
                <div><label class="block text-[10.5px] font-bold text-slate-500 mb-0.5">عنوان عمود الكمية:</label><input type="text" value="${ct.colQty || 'الكمية'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colQty', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
                <div><label class="block text-[10.5px] font-bold text-slate-500 mb-0.5">عنوان عمود السعر:</label><input type="text" value="${ct.colPrice || 'سعر الوحدة'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colPrice', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
                <div><label class="block text-[10.5px] font-bold text-slate-500 mb-0.5">عنوان عمود المجموع:</label><input type="text" value="${ct.colSubtotal || 'المجموع'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colSubtotal', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
              </div>
            </div>

            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <h4 class="font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1.5">🏢 بيانات المتجر والبيانات الجبائية والتذييل</h4>
              <div class="grid grid-cols-2 gap-2">
                <div class="col-span-2"><label class="block font-bold mb-0.5">اسم المتجر / المؤسسة:</label><input type="text" value="${shop.name}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_name', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-black"></div>
                <div><label class="block font-bold mb-0.5">رقم الهاتف:</label><input type="text" value="${shop.phone}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_phone', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-mono"></div>
                <div><label class="block font-bold mb-0.5">العنوان:</label><input type="text" value="${shop.address}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_address', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800"></div>
                <div><label class="block font-bold mb-0.5">السجل التجاري (RC):</label><input type="text" value="${shop.rc}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_rc', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-mono"></div>
                <div><label class="block font-bold mb-0.5">الرقم الجبائي (NIF):</label><input type="text" value="${shop.nif}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_nif', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-mono"></div>
                <div class="col-span-2"><label class="block font-bold mb-0.5">عبارة التذييل وشروط الاستبدال:</label><input type="text" value="${cfg.customFooterTerms || ''}" oninput="window.GherbiPrintStudioV45.updateFooterTermsInPlace(this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3.5">
          <!-- شريط التبويبات الفرعية الـ 3 للوحة التحكم اليمنى (يمنع ازدحام الصفحة وقفز التمرير نهائياً) -->
          <div class="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl text-xs">
            <button type="button" onclick="window.GherbiPrintStudioV45.switchLeftSubTab('catalog_30')" class="py-2 px-2 rounded-xl font-black transition cursor-pointer ${
              subTab === 'catalog_30' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
            }">
              🧩 1. مكتبة الـ 30 طبقة
            </button>
            <button type="button" onclick="window.GherbiPrintStudioV45.switchLeftSubTab('layers_stack')" class="py-2 px-2 rounded-xl font-black transition cursor-pointer ${
              subTab === 'layers_stack' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
            }">
              🗂️ 2. الترتيب (${activeLayersCount})
            </button>
            <button type="button" onclick="window.GherbiPrintStudioV45.switchLeftSubTab('columns_and_shop')" class="py-2 px-2 rounded-xl font-black transition cursor-pointer ${
              subTab === 'columns_and_shop' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
            }">
              📊 3. الأعمدة والمتجر
            </button>
          </div>

          ${subTabBodyHtml}
        </div>
      `;
    };

    // 4. تحديث اللوحة الجانبية فقط مع الحفاظ التام على موضع التمرير (scrollTop)
    studio.refreshLeftSidebarOnly = function () {
      const host = document.getElementById('v61LeftSidebarHost');
      if (!host) return;
      const savedScrolls = this.captureAllScrollPositions();
      host.innerHTML = this.buildLeftSidebarPanelHtml();
      this.restoreAllScrollPositions(savedScrolls);
    };

    // 5. دوال التفاعل الجراحية التي تعمل في نفس المكان (In-Place) بدون أي قفز للشاشة!
    studio.switchLeftSubTab = function (tabName) {
      const savedPageScroll = document.getElementById('view-print')?.scrollTop || 0;
      this.leftPanelTab = tabName || 'catalog_30';
      const host = document.getElementById('v61LeftSidebarHost');
      if (host) {
        host.innerHTML = this.buildLeftSidebarPanelHtml();
      }
      const vp = document.getElementById('view-print');
      if (vp) vp.scrollTop = savedPageScroll;
    };

    studio.toggleInlineInspector = function (layerId) {
      if (this.expandedInspectorLayerId === layerId) {
        this.expandedInspectorLayerId = null;
      } else {
        this.expandedInspectorLayerId = layerId;
        this.selectedLayerId = layerId;
      }
      this.refreshLeftSidebarOnly();
      this.selectLayerDomOnly(layerId);
    };

    studio.toggleLayerInPlace = function (layerId) {
      this.sync30LayersWithActiveConfig();
      const target = (this.config.layers || []).find((l) => l.id === layerId);
      if (target) {
        target.visible = !target.visible;
      }
      this.selectedLayerId = layerId;
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
    };

    studio.activateSuggestedLayerFromCatalog = function (layerId) {
      this.toggleLayerInPlace(layerId);
    };

    studio.toggleLayerVisibility = function (layerId) {
      this.toggleLayerInPlace(layerId);
    };

    studio.setCatalogFilterInPlace = function (cat) {
      const savedPageScroll = document.getElementById('view-print')?.scrollTop || 0;
      this.catalogCategoryFilter = cat || 'ALL';
      const host = document.getElementById('v61LeftSidebarHost');
      if (host) host.innerHTML = this.buildLeftSidebarPanelHtml();
      const vp = document.getElementById('view-print');
      if (vp) vp.scrollTop = savedPageScroll;
    };

    studio.setCatalogCategoryFilter = function (cat) {
      this.setCatalogFilterInPlace(cat);
    };

    studio.onCatalogSearchInPlace = function (val) {
      this.layerCatalogSearch = String(val || '');
      this.refreshLeftSidebarOnly();
      const inp = document.getElementById('v61CatalogSearchInp');
      if (inp) {
        inp.focus();
        const len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    };

    studio.enableAllSuggestedLayersInPlace = function () {
      this.sync30LayersWithActiveConfig();
      for (const l of this.config.layers) {
        l.visible = true;
      }
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
      if (window.showToast) window.showToast('✨ تم تفعيل جميع الطبقات على الورقة الحية!', 'success');
    };

    studio.enableAllSuggestedLayers = function () {
      this.enableAllSuggestedLayersInPlace();
    };

    studio.moveLayerInPlace = function (layerId, dir) {
      const arr = this.config.layers;
      const idx = arr.findIndex((l) => l.id === layerId);
      if (idx < 0) return;
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= arr.length) return;
      const tmp = arr[idx];
      arr[idx] = arr[targetIdx];
      arr[targetIdx] = tmp;
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
    };

    studio.moveLayer = function (layerId, dir) {
      this.moveLayerInPlace(layerId, dir);
    };

    studio.addCustomLayerInPlace = function () {
      const newId = 'custom_' + Date.now().toString().slice(-5);
      this.config.layers.push({
        id: newId,
        name: '📝 طبقة نصية مخصصة #' + (this.config.layers.length + 1),
        visible: true,
        align: 'center',
        fontSizeScale: 100,
        textAlign: 'center',
        borderStyle: 'dashed',
        bgStyle: 'soft_blue',
        customTitle: '',
        customNote: 'انقر هنا أو افتح (⚙️ تعديل) لكتابة أي نص أو ملاحظة حرة...'
      });
      this.expandedInspectorLayerId = newId;
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
    };

    studio.addCustomLayerBlock = function () {
      this.addCustomLayerInPlace();
    };

    studio.deleteCustomLayerInPlace = function (layerId) {
      this.config.layers = this.config.layers.filter((l) => l.id !== layerId);
      if (this.expandedInspectorLayerId === layerId) this.expandedInspectorLayerId = null;
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
    };

    studio.deleteCustomLayer = function (layerId) {
      this.deleteCustomLayerInPlace(layerId);
    };

    studio.duplicateLayerInPlace = function (layerId) {
      const src = (this.config.layers || []).find((l) => l.id === layerId);
      if (!src) return;
      const newId = 'custom_' + Date.now().toString().slice(-5);
      const copyLayer = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        name: '📋 نسخة: ' + src.name.replace(/^[^\s]+\s\d+\.\s/, ''),
        visible: true
      };
      const idx = this.config.layers.findIndex((l) => l.id === layerId);
      this.config.layers.splice(idx + 1, 0, copyLayer);
      this.expandedInspectorLayerId = newId;
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
      if (window.showToast) window.showToast('📋 تم تكرار الطبقة بنجاح!', 'success');
    };

    studio.resetLayerInPlace = function (layerId) {
      const layer = (this.config.layers || []).find((l) => l.id === layerId);
      const catMeta = (this.FULL_30_SMART_LAYERS || []).find((c) => c.id === layerId);
      if (!layer) return;
      layer.fontSizeScale = 100;
      layer.textAlign = 'right';
      layer.borderStyle = 'default';
      layer.bgStyle = 'default';
      layer.customTitle = '';
      layer.customNote = '';
      if (catMeta) layer.name = catMeta.name;
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
    };

    studio.insertTagInInlineNote = function (layerId, tagText) {
      const layer = (this.config.layers || []).find((l) => l.id === layerId);
      if (!layer) return;
      layer.customNote = ((layer.customNote || '') + ' ' + tagText).trim();
      this.updateActiveLayerProp(layerId, 'customNote', layer.customNote);
      const inp = document.getElementById('v61InlineNote_' + layerId);
      if (inp) inp.value = layer.customNote;
    };

    studio.toggleColumnInPlace = function (colKey) {
      this.config.columns[colKey] = !this.config.columns[colKey];
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
    };

    studio.toggleColumn = function (colKey) {
      this.toggleColumnInPlace(colKey);
    };

    studio.applyTableColumnsPresetInPlace = function (presetKey) {
      const presets = {
        thermal_simple: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        a4_full: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: true, tva: true, subtotal: true },
        delivery_qty_only: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: false, discount: false, tva: false, subtotal: false }
      };
      if (presets[presetKey]) {
        this.config.columns = { ...this.config.columns, ...presets[presetKey] };
        this.saveConfigLocal();
        this.refreshLeftSidebarOnly();
        this.refreshPaperHostOnly();
      }
    };

    studio.updateFooterTermsInPlace = function (val) {
      this.config.customFooterTerms = val;
      this.saveConfigLocal();
      this.refreshPaperHostOnly();
    };

    // كما نحول دوال شريط الأدوات العلوي (حجم الخط، السنتيم، الباقي، الباركود، إضافة/حذف سطر) لتعمل بدون قفز
    studio.stepFontSize = function (delta) {
      const next = Math.max(8, Math.min(18, Number((this.config.baseFontSizePx + delta).toFixed(1))));
      this.config.baseFontSizePx = next;
      this.saveConfigLocal();
      const lbl = document.getElementById('v61FontSizePxBadge');
      if (lbl) lbl.textContent = next + 'px';
      this.refreshPaperHostOnly();
    };

    studio.toggleCfgBool = function (key) {
      this.config[key] = !this.config[key];
      this.saveConfigLocal();
      const saved = this.captureAllScrollPositions();
      this.renderStudioIntoRoot().then(() => this.restoreAllScrollPositions(saved));
    };

    // 6. التحديث الشامل لـ renderStudioIntoRoot في وضع visual_studio ليستخدم الحاويتين المستقلتين (#v61LeftSidebarHost و #v61RightPaperWorkspace)
    const prevRenderV60 = studio.renderStudioIntoRoot.bind(studio);
    studio.renderStudioIntoRoot = async function (rootEl) {
      const savedScrolls = this.captureAllScrollPositions();

      if (this.activeSection !== 'visual_studio') {
        await prevRenderV60(rootEl);
        this.restoreAllScrollPositions(savedScrolls);
        return;
      }

      const targetRoot = rootEl || document.getElementById('print-view-root');
      if (!targetRoot) return;

      this.sync30LayersWithActiveConfig();
      const cfg = this.config;
      const all28 = this.ALL_28_MASTER_DOCS || [];
      const activeDocMeta = all28.find((d) => d.id === cfg.activeDocType) || all28[0] || { id: 'receipt_thermal', name: 'تذكرة كاشير', sourcePage: 'pos', sourceLabel: 'شاشة المبيعات' };
      const docData = await this.resolveActiveDocumentData();
      const paperHtml = this.buildLiveDocumentPaperHtml(docData, false);

      let recordsList = [];
      if (activeDocMeta.sourcePage === 'purchases') recordsList = this.liveDataRecords.purchases || [];
      else if (activeDocMeta.sourcePage === 'proformas') recordsList = this.liveDataRecords.proformas || [];
      else if (activeDocMeta.sourcePage === 'orders') recordsList = this.liveDataRecords.orders || [];
      else recordsList = this.liveDataRecords.sales || [];

      const recordOptionsHtml = [
        `<option value="SAMPLE" ${this.selectedRecordId === 'SAMPLE' ? 'selected' : ''}>✨ بيانات نموذجية احترافية جاهزة للتعديل الحر</option>`,
        ...recordsList.slice(0, 50).map((r) => {
          const num = r.doc_number || r.invoice_number || ('#' + r.id);
          const party = r.customer_name || r.supplier_name || 'زبون عابر';
          const tot = Number(r.total || 0).toFixed(2);
          return `<option value="${r.id}" ${String(this.selectedRecordId) === String(r.id) ? 'selected' : ''}>📄 ${num} — ${party} (${tot} د.ج)</option>`;
        })
      ].join('');

      targetRoot.innerHTML = `
        <div id="v45MasterPrintStudio" data-gherbi-print-v2="1" class="space-y-3.5 text-right pb-6 w-full" dir="rtl">
          <!-- الترويسة العليا المدمجة للتبويبات الخمسة -->
          <div class="rounded-3xl bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 text-white p-4 shadow-xl border border-blue-500/30 w-full">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                  <span class="material-symbols-rounded" style="font-size:24px;">print</span>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-black text-[10.5px]">
                      Gherbi.Ai Omni-Print V61 — Zero-Jump Studio
                    </span>
                    <h1 class="text-base md:text-lg font-black">
                      مركز الطباعة الشامل واستوديو الـ 28 قالباً والـ 30 طبقة ذكية
                    </h1>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('visual_studio')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-blue-600 text-white shadow-md">
                  🎨 1. استوديو الفواتير والطبقات (30 طبقة)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('cross_page_bridge')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-white/10 hover:bg-white/20 text-slate-200">
                  🔗 2. فواتير الصفحات (${(this.liveDataRecords.sales || []).length + (this.liveDataRecords.purchases || []).length})
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('barcode_shelf_factory')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-white/10 hover:bg-white/20 text-slate-200">
                  🏷️ 3. الباركود والرفوف
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('free_word_editor')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-white/10 hover:bg-white/20 text-slate-200">
                  📝 4. محرر البونات (Word)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchSection('hardware_defaults')" class="px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer bg-white/10 hover:bg-white/20 text-slate-200">
                  ⚙️ 5. القوالب الافتراضية الـ 28 (Par Défaut)
                </button>
              </div>
            </div>
          </div>

          <!-- شريط التحكم العلوي في المستند والمقاس والاعتماد -->
          <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 shadow-sm space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <div class="flex flex-wrap items-center gap-2">
                <label class="text-xs font-black text-slate-700 dark:text-slate-200">📑 القالب (28 مستنداً):</label>
                <select onchange="window.GherbiPrintStudioV45.selectDocType(this.value)" class="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-slate-900 border-2 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-200 font-black text-xs cursor-pointer min-w-[260px]">
                  ${this.build28DocsGroupedOptionsHtml(cfg.activeDocType)}
                </select>

                <select onchange="window.GherbiPrintStudioV45.selectLiveRecord(this.value)" class="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-xs max-w-xs cursor-pointer">
                  ${recordOptionsHtml}
                </select>

                <button type="button" onclick="window.GherbiPrintStudioV45.applySingleProDefaultTemplate('${cfg.activeDocType}')" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 border border-amber-400 font-black text-xs transition cursor-pointer">
                  ⚡ استعادة القالب الاحترافي الجاهز
                </button>

                <button type="button" onclick="window.App.switchView('${activeDocMeta.sourcePage}')" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 font-black text-xs transition cursor-pointer">
                  🔗 افتح (${activeDocMeta.sourceLabel}) ⬅
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.saveAsDefaultForDocType()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition cursor-pointer">
                  ⭐ اعتماد وحفظ كأمر مطلق للطباعة (Par Défaut)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.printCurrentCanvasNow()" class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition cursor-pointer">
                  🖨️ طباعة / PDF الآن
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-black text-slate-500 text-[11px]">📐 المقاس:</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('a4')" class="v45-word-ribbon-btn ${cfg.paperSize === 'a4' ? 'active' : ''}">A4 رسمي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('a5')" class="v45-word-ribbon-btn ${cfg.paperSize === 'a5' ? 'active' : ''}">A5 نصفي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('2xa5')" class="v45-word-ribbon-btn ${cfg.paperSize === '2xa5' ? 'active' : ''}">2×A5 مزدوج</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('80mm')" class="v45-word-ribbon-btn ${cfg.paperSize === '80mm' ? 'active' : ''}">80mm حراري</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setPaperSize('58mm')" class="v45-word-ribbon-btn ${cfg.paperSize === '58mm' ? 'active' : ''}">58mm حراري</button>

                <span class="mx-1 text-slate-300">|</span>
                <span class="font-black text-slate-500 text-[11px]">🔤 الخط العام:</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.stepFontSize(-0.5)" class="v45-word-ribbon-btn">-A</button>
                <span id="v61FontSizePxBadge" class="font-mono font-black px-1">${cfg.baseFontSizePx}px</span>
                <button type="button" onclick="window.GherbiPrintStudioV45.stepFontSize(0.5)" class="v45-word-ribbon-btn">+A</button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <div class="inline-flex items-center rounded-xl bg-amber-50 dark:bg-slate-900 border border-amber-300 p-0.5 text-[11px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.switchLoyaltySimulationMode('vip')" class="px-2 py-1 rounded-lg font-black cursor-pointer ${this.loyaltySimMode === 'vip' ? 'bg-amber-500 text-slate-950' : 'text-amber-800'}">👑 زبون وفي</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.switchLoyaltySimulationMode('walkin')" class="px-2 py-1 rounded-lg font-black cursor-pointer ${this.loyaltySimMode === 'walkin' ? 'bg-slate-800 text-white' : 'text-slate-600'}">🚶 زبون عابر (0 ن)</button>
                </div>
                <button type="button" onclick="window.GherbiPrintStudioV45.addRowToActiveTicket()" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer">➕ سطر جديد</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.removeLastRowFromActiveTicket()" class="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-black text-[11px] cursor-pointer">➖ حذف سطر</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.triggerLogoUploadFromStudio()" class="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-black text-[11px] cursor-pointer">📷 الشعار</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showCentimesEquivalent')" class="v45-word-ribbon-btn ${cfg.showCentimesEquivalent ? 'active' : ''}">🇩🇿 السنتيم</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showCustomerBalance')" class="v45-word-ribbon-btn ${cfg.showCustomerBalance ? 'active' : ''}">⚖️ الباقي</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.toggleCfgBool('showDocBarcode')" class="v45-word-ribbon-btn ${cfg.showDocBarcode ? 'active' : ''}">||| باركود</button>
              </div>
            </div>
          </div>

          <!-- التقسيم الثابت المتوازي بدون أي قفز في التمرير -->
          <div class="v61-studio-split-layout">
            <!-- يمين: اللوحة الجانبية ذات الـ 3 تبويبات ومحررات الأكورديون المدمجة -->
            <div id="v61LeftSidebarHost" class="w-full min-w-0">
              ${this.buildLeftSidebarPanelHtml()}
            </div>

            <!-- يسار: الورقة التفاعلية الحية -->
            <div class="w-full min-w-0">
              <div id="v61RightPaperWorkspace" class="v45-studio-workspace max-h-[75vh] w-full">
                <div id="v45LivePaperHost">
                  ${paperHtml}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.restoreAllScrollPositions(savedScrolls);
    };

    if (document.getElementById('view-print')?.classList.contains('active')) {
      studio.renderStudioIntoRoot();
    }

    console.log('🏆 [Gherbi V61 Zero-Jump Print Studio]: تم القضاء نهائياً على قفز التمرير وتفعيل التبويبات الفرعية ومحرر الأكورديون المدمج!');
  }, 150);
})();

/* ==================== [V62 ABSOLUTE SAVE & UNIVERSAL 28-DOCS CROSS-PAGE BINDING] ==================== */
(function initV62AbsoluteSaveAndUniversalPageBinding() {
  const STORAGE_KEY_V62 = 'gherbi_master_print_profiles_v62';

  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.App || !studio.ALL_28_MASTER_DOCS) return;
    clearInterval(waitStudio);

    // ========================================================================
    // 1. استرجاع القوالب المعتمدة المحفوظة من SQLite و localStorage عند الإقلاع
    // ========================================================================
    studio.restoreAbsoluteProfilesFromStorageAndDb = async function () {
      try {
        let rawJson = localStorage.getItem(STORAGE_KEY_V62);
        if (!rawJson && window.AppState?.settings?.[STORAGE_KEY_V62]) {
          rawJson = window.AppState.settings[STORAGE_KEY_V62];
        }
        if (!rawJson && window.api?.getSettings) {
          const allSet = await window.api.getSettings();
          if (allSet && allSet[STORAGE_KEY_V62]) {
            rawJson = allSet[STORAGE_KEY_V62];
          }
        }
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          if (parsed && typeof parsed === 'object') {
            if (parsed.defaultsByDocType) {
              this.config.defaultsByDocType = {
                ...this.config.defaultsByDocType,
                ...parsed.defaultsByDocType
              };
            }
            if (parsed.adoptedProfiles) {
              this.config.adoptedProfiles = {
                ...this.config.adoptedProfiles,
                ...parsed.adoptedProfiles
              };
            }
          }
        }
      } catch (e) {
        console.warn('[V62 Restore Profiles Warning]:', e);
      }

      // تحميل القالب المعتمد للمستند النشط حالياً في الاستوديو
      if (typeof this.loadProfileForDocType === 'function') {
        this.loadProfileForDocType(this.config.activeDocType || 'receipt_thermal');
      }
    };

    // ========================================================================
    // 2. تفريغ والتقاط جميع النصوص المحررة مباشرةً على الورقة الحية قبل الحفظ
    // ========================================================================
    studio.flushAllLivePaperEditsIntoConfig = function () {
      const containers = [
        document.getElementById('v45LivePaperHost'),
        document.getElementById('v58PreviewModalPaperHost')
      ].filter(Boolean);

      for (const host of containers) {
        const editableNodes = host.querySelectorAll('[data-v45-edit]');
        editableNodes.forEach((node) => {
          const key = node.getAttribute('data-v45-edit');
          const textVal = (node.innerText || node.textContent || '').trim();
          if (!key) return;

          if (key === 'customHeaderTitle') {
            this.config.customHeaderTitle = textVal;
          } else if (key === 'customFooterTerms') {
            this.config.customFooterTerms = textVal;
          } else if (key.startsWith('layerNote:')) {
            const lid = key.split(':')[1];
            const layer = (this.config.layers || []).find((l) => l.id === lid);
            if (layer) layer.customNote = textVal;
          } else if (key.startsWith('layerTitle:')) {
            const lid = key.split(':')[1];
            const layer = (this.config.layers || []).find((l) => l.id === lid);
            if (layer) layer.customTitle = textVal;
          } else if (!key.startsWith('item:') && !key.startsWith('docField:') && !key.startsWith('shop:')) {
            if (!this.config.customTexts) this.config.customTexts = {};
            this.config.customTexts[key] = textVal;
          }
        });
      }
    };

    // ========================================================================
    // 3. الحفظ المطلق الدائم (saveAsDefaultForDocType) في localStorage و SQLite معاً
    // ========================================================================
    studio.persistAllProfilesPermanently = async function () {
      this.saveConfigLocal();
      const masterPayload = {
        updatedAt: new Date().toISOString(),
        defaultsByDocType: this.config.defaultsByDocType || {},
        adoptedProfiles: this.config.adoptedProfiles || {}
      };
      const jsonStr = JSON.stringify(masterPayload);
      try {
        localStorage.setItem(STORAGE_KEY_V62, jsonStr);
      } catch (_) {}

      try {
        if (window.AppState?.settings) {
          window.AppState.settings[STORAGE_KEY_V62] = jsonStr;
        }
        if (window.api?.updateSettings) {
          await window.api.updateSettings({
            [STORAGE_KEY_V62]: jsonStr,
            receipt_paper_width_mm:
              this.config.defaultsByDocType?.receipt_thermal?.paperSize === '58mm' ? '58' : '80'
          });
        }
      } catch (e) {
        console.warn('[V62 SQLite Persist Warning]:', e);
      }
    };

    studio.saveAsDefaultForDocType = async function (targetDocIdOverride = null) {
      // 1) التقاط أي نص كتبه المستخدم على الورقة الحية قبل الحفظ
      this.flushAllLivePaperEditsIntoConfig();
      if (typeof this.sync30LayersWithActiveConfig === 'function') {
        this.sync30LayersWithActiveConfig();
      }

      const docType = targetDocIdOverride || this.config.activeDocType || 'receipt_thermal';
      const docMeta =
        (this.ALL_28_MASTER_DOCS || []).find((d) => d.id === docType) ||
        { id: docType, name: docType, sourceLabel: 'جميع الصفحات', defaultPaper: 'a4', defaultTheme: 'royal_blue' };

      if (!this.config.defaultsByDocType) this.config.defaultsByDocType = {};
      if (!this.config.adoptedProfiles) this.config.adoptedProfiles = {};

      // 2) تحديث المقاس واللون الافتراضي لهذا المستند
      this.config.defaultsByDocType[docType] = {
        paperSize: this.config.paperSize || docMeta.defaultPaper,
        themeId: this.config.themeId || docMeta.defaultTheme,
        lang: this.config.lang || 'ar',
        adopted: true,
        adoptedAt: new Date().toISOString()
      };

      // 3) أخذ لقطة عميقة شاملة 100% لجميع الطبقات الـ 30 وترتيبها وأعمدتها ونصوصها وتنسيقاتها
      this.config.adoptedProfiles[docType] = {
        _isAbsoluteMaster: true,
        _v60Customized: true,
        adoptedAt: new Date().toISOString(),
        activeDocType: docType,
        paperSize: this.config.paperSize || docMeta.defaultPaper,
        themeId: this.config.themeId || docMeta.defaultTheme,
        fontFamily: this.config.fontFamily || 'Cairo',
        baseFontSizePx: Number(this.config.baseFontSizePx || 11.5),
        marginMode: this.config.marginMode || 'normal',
        densityMode: this.config.densityMode || 'normal',
        borderMode: this.config.borderMode || 'grid',
        watermarkText: this.config.watermarkText || '',
        customHeaderTitle: this.config.customHeaderTitle || docMeta.cleanTitle || '',
        customFooterTerms: this.config.customFooterTerms || '',
        showCentimesEquivalent: Boolean(this.config.showCentimesEquivalent),
        showAmountInWords: Boolean(this.config.showAmountInWords),
        showCustomerBalance: Boolean(this.config.showCustomerBalance),
        showBaridimobQr: Boolean(this.config.showBaridimobQr),
        showDocBarcode: Boolean(this.config.showDocBarcode),
        showStampSignature: Boolean(this.config.showStampSignature),
        columns: JSON.parse(JSON.stringify(this.config.columns || {})),
        customTexts: JSON.parse(JSON.stringify(this.config.customTexts || {})),
        layers: JSON.parse(JSON.stringify(this.config.layers || []))
      };

      // 4) حفظ دائم في localStorage وفي قاعدة بيانات SQLite
      await this.persistAllProfilesPermanently();

      // 5) تحديث معاينة نافذة #posPrintCenterModal إن كانت مفتوحة
      if (window.GherbiSalesTurbo && document.getElementById('posPrintCenterModal')?.classList.contains('active')) {
        await window.GherbiSalesTurbo.refreshFastPrintCenterPreview();
      }

      if (window.showToast) {
        window.showToast(
          `⭐ تم الاعتماد والحفظ كأمر مطلق! القالب (${docMeta.name}) بالمقاس (${(this.config.paperSize || '').toUpperCase()}) مطبق الآن إجبارياً في (${docMeta.sourceLabel})!`,
          'success'
        );
      }
      return this.config.adoptedProfiles[docType];
    };

    // ربط تغييرات المقاس واللون في التبويب الخامس بالحفظ المطلق الدائم أيضاً
    studio.setDocDefaultPaper = async function (docId, paperSize) {
      if (!this.config.defaultsByDocType[docId]) {
        this.config.defaultsByDocType[docId] = { paperSize, themeId: 'royal_blue', lang: 'ar', adopted: true };
      } else {
        this.config.defaultsByDocType[docId].paperSize = paperSize;
        this.config.defaultsByDocType[docId].adopted = true;
      }
      if (this.config.adoptedProfiles && this.config.adoptedProfiles[docId]) {
        this.config.adoptedProfiles[docId].paperSize = paperSize;
      }
      if (this.config.activeDocType === docId) {
        this.config.paperSize = paperSize;
      }
      await this.persistAllProfilesPermanently();
      await this.renderStudioIntoRoot();
      if (window.showToast) {
        window.showToast(`📐 تم اعتماد المقاس (${paperSize.toUpperCase()}) كأمر مطلق لهذا المستند في كل الصفحات!`, 'success');
      }
    };

    studio.setDocDefaultTheme = async function (docId, themeId) {
      if (!this.config.defaultsByDocType[docId]) {
        this.config.defaultsByDocType[docId] = { paperSize: 'a4', themeId, lang: 'ar', adopted: true };
      } else {
        this.config.defaultsByDocType[docId].themeId = themeId;
        this.config.defaultsByDocType[docId].adopted = true;
      }
      if (this.config.adoptedProfiles && this.config.adoptedProfiles[docId]) {
        this.config.adoptedProfiles[docId].themeId = themeId;
      }
      if (this.config.activeDocType === docId) {
        this.config.themeId = themeId;
      }
      await this.persistAllProfilesPermanently();
      if (document.getElementById('view-print')?.classList.contains('active')) {
        await this.renderStudioIntoRoot();
      }
      if (window.showToast) {
        window.showToast('🎨 تم اعتماد الثيم اللوني كأمر مطلق لهذا المستند في كل الصفحات!', 'success');
      }
    };

    // ========================================================================
    // 4. محرك البناء المعزول (Context-Switched Master Profile Renderer)
    //    يضمن أن أي صفحة تطلب طباعة مستند (docType) تحصل على القالب المحفوظ له حرفياً
    //    بكل طبقاته الـ 30 وترتيبها وأعمدتها ونصوصها حتى لو كان الاستوديو مفتوحاً على مستند آخر!
    // ========================================================================
    studio.renderAdoptedMasterDocumentHtml = async function (docTypeKey, docDataInput, runtimeOverrides = {}) {
      let targetDocType = docTypeKey || 'receipt_thermal';
      if (['receipt', '80mm', '58mm', 'thermal'].includes(targetDocType)) targetDocType = 'receipt_thermal';
      else if (['a4', 'invoice'].includes(targetDocType)) targetDocType = 'invoice_a4';
      else if (targetDocType === 'a5') targetDocType = 'invoice_a5';
      else if (['delivery', 'bl'].includes(targetDocType)) targetDocType = 'delivery_note';

      const docMeta =
        (this.ALL_28_MASTER_DOCS || []).find((d) => d.id === targetDocType) ||
        (this.ALL_28_MASTER_DOCS && this.ALL_28_MASTER_DOCS[0]);

      // جلب البروفايل المعتمد المحفوظ لهذا المستند
      const savedDef = (this.config.defaultsByDocType && this.config.defaultsByDocType[targetDocType]) || {};
      let savedProfile = this.config.adoptedProfiles && this.config.adoptedProfiles[targetDocType];
      if (!savedProfile && docMeta && typeof this.buildIdealProfileObjectForDoc === 'function') {
        savedProfile = this.buildIdealProfileObjectForDoc(docMeta);
        this.config.adoptedProfiles[targetDocType] = savedProfile;
      }

      const effectivePaperSize =
        runtimeOverrides.paperSize ||
        savedDef.paperSize ||
        (savedProfile && savedProfile.paperSize) ||
        (docMeta && docMeta.defaultPaper) ||
        (targetDocType.includes('80mm') || targetDocType === 'receipt_thermal' ? '80mm' : 'a4');

      const effectiveThemeId =
        runtimeOverrides.themeId ||
        savedDef.themeId ||
        (savedProfile && savedProfile.themeId) ||
        (docMeta && docMeta.defaultTheme) ||
        'royal_blue';

      // حفظ حالة الاستوديو الحالية مؤقتاً، ثم التبديل الكامل إلى البروفايل المعتمد للمستند المطلوب
      const backupConfig = JSON.parse(JSON.stringify(this.config));
      let paperInnerHtml = '';

      try {
        if (savedProfile) {
          this.config = {
            ...this.config,
            ...JSON.parse(JSON.stringify(savedProfile)),
            activeDocType: targetDocType,
            paperSize: effectivePaperSize,
            themeId: effectiveThemeId,
            columns: {
              ...(this.config.columns || {}),
              ...(savedProfile.columns || {})
            },
            customTexts: {
              ...(this.config.customTexts || {}),
              ...(savedProfile.customTexts || {}),
              ...(runtimeOverrides.customTexts || {})
            },
            layers: Array.isArray(savedProfile.layers)
              ? JSON.parse(JSON.stringify(savedProfile.layers))
              : this.config.layers
          };
        } else {
          this.config.activeDocType = targetDocType;
          this.config.paperSize = effectivePaperSize;
          this.config.themeId = effectiveThemeId;
        }

        if (runtimeOverrides.customHeaderTitle) {
          this.config.customHeaderTitle = runtimeOverrides.customHeaderTitle;
        } else if (!this.config.customHeaderTitle && docMeta) {
          this.config.customHeaderTitle = docMeta.cleanTitle;
        }

        const resolvedData = docDataInput || (await this.resolveActiveDocumentData(targetDocType));
        paperInnerHtml = this.buildLiveDocumentPaperHtml(resolvedData, true, {
          ...this.config,
          ...runtimeOverrides,
          activeDocType: targetDocType,
          paperSize: effectivePaperSize,
          themeId: effectiveThemeId
        });
      } finally {
        // استعادة حالة الاستوديو الأصلية دون أي تأثير جانبي
        this.config = backupConfig;
      }

      const isThermal = effectivePaperSize === '80mm' || effectivePaperSize === '58mm';
      const thermalW = effectivePaperSize === '58mm' ? '56mm' : '78mm';
      const dir = runtimeOverrides.dir || 'rtl';
      const lang = runtimeOverrides.lang || 'ar';
      const fontFam = (savedProfile && savedProfile.fontFamily) || 'Cairo';

      const pageCss = isThermal
        ? `@page { size: ${effectivePaperSize} auto; margin: 2mm; }`
        : effectivePaperSize === '2xa5'
        ? `@page { size: A4 landscape; margin: 6mm; }`
        : effectivePaperSize === 'a5'
        ? `@page { size: A5 portrait; margin: 6mm; }`
        : `@page { size: A4 portrait; margin: 8mm; }`;

      return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}" data-v52-studio-master="1" data-v62-adopted-doc="${targetDocType}">
<head>
  <meta charset="UTF-8">
  <title>${(docDataInput && docDataInput.docNumber) || targetDocType}</title>
  <style>
    ${pageCss}
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: ${runtimeOverrides.forIframePreview ? '8px' : '0'} !important;
      background: ${runtimeOverrides.forIframePreview ? '#f1f5f9' : '#ffffff'} !important;
      color: #0f172a !important;
      font-family: '${fontFam}', 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif !important;
      direction: ${dir} !important;
    }
    @media print {
      html, body {
        background: #ffffff !important;
        padding: 0 !important;
      }
    }
    .v45-live-paper {
      background: #ffffff !important;
      color: #0f172a !important;
      margin: 0 auto !important;
      width: ${isThermal ? thermalW : '100%'} !important;
      max-width: 100% !important;
      min-height: auto !important;
      padding: ${isThermal ? '2.5mm' : '6mm'} !important;
      box-shadow: ${runtimeOverrides.forIframePreview ? '0 6px 20px rgba(15,23,42,0.12)' : 'none'} !important;
      border-radius: ${runtimeOverrides.forIframePreview ? '8px' : '0'} !important;
      overflow: hidden !important;
    }
    .v45-canvas-layer {
      border: none !important;
      box-shadow: none !important;
      margin-bottom: 6px !important;
    }
    .v45-layer-handle-bar {
      display: none !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
  </style>
</head>
<body>
  ${paperInnerHtml}
</body>
</html>`;
    };

    // ربط generateAdoptedHtmlForDocument القديمة بالمحرك المعزول الجديد V62
    studio.generateAdoptedHtmlForDocument = async function (docTypeKey, recordId = null, rawPayload = null) {
      let docData = null;
      if (rawPayload) {
        docData = this.enrichDocumentDataWithLoyaltyAndDebt({
          docNumber: rawPayload.doc_number || rawPayload.invoice_number || rawPayload.return_number || 'DOC-' + Date.now().toString().slice(-4),
          date: String(rawPayload.sale_date || rawPayload.date || new Date().toISOString()).replace('T', ' ').slice(0, 16),
          customerId: rawPayload.customer_id || null,
          partyTitle: rawPayload.party_title || (docTypeKey.includes('supplier') || docTypeKey === 'purchase_invoice' ? 'المورد:' : 'الزبون:'),
          partyName: rawPayload.customer_name || rawPayload.supplier_name || 'زبون عابر (Comptoir)',
          partyPhone: rawPayload.customer_phone || rawPayload.supplier_phone || '-',
          partyAddress: rawPayload.customer_address || rawPayload.supplier_address || '-',
          partyRc: rawPayload.customer_rc || rawPayload.supplier_rc || '-',
          partyNif: rawPayload.customer_nif || rawPayload.supplier_nif || '-',
          paymentMethod: rawPayload.payment_method || 'نقداً',
          previousBalance: Number(rawPayload.previous_debt || 0),
          items: (rawPayload.items || []).map((it) => ({
            barcode: it.barcode || it.product_barcode || '-',
            name: it.name || it.product_name || it.custom_product_name || 'صنف',
            unit: it.unit || it.product_unit || 'قطعة',
            qty: Number(it.quantity ?? it.qty ?? 1),
            price: Number(it.price ?? it.cost_price ?? 0),
            discount: Number(it.discount || 0),
            tva: Number(rawPayload.tax_percentage || 0),
            subtotal: Number(it.subtotal ?? it.total_cost ?? Number(it.price || 0) * Number(it.quantity || 1))
          })),
          subtotal: Number(rawPayload.subtotal ?? rawPayload.total ?? 0),
          discount: Number(rawPayload.discount || 0),
          tvaAmount: 0,
          stampAmount: Number(rawPayload.stamp_amount || 0),
          total: Number(rawPayload.total || 0),
          paidAmount: Number(rawPayload.paid_amount ?? rawPayload.total ?? 0),
          receivedAmount: Number(rawPayload.received_amount ?? rawPayload.paid_amount ?? rawPayload.total ?? 0),
          remainingDebt: Math.max(0, Number((Number(rawPayload.total || 0) - Number(rawPayload.paid_amount ?? rawPayload.total ?? 0)).toFixed(2)))
        });
      } else if (recordId && recordId !== 'SAMPLE') {
        const prevRec = this.selectedRecordId;
        this.selectedRecordId = String(recordId);
        this.activeLoadedDocData = null;
        docData = await this.resolveActiveDocumentData(docTypeKey);
        this.selectedRecordId = prevRec;
      } else {
        docData = await this.resolveActiveDocumentData(docTypeKey);
      }
      return await this.renderAdoptedMasterDocumentHtml(docTypeKey, docData);
    };

    // ========================================================================
    // 5. إعادة ربط جميع صفحات البرنامج ونوافذ الطباعة بمحرك القوالب المعتمدة V62
    // ========================================================================

    // أ) ربط نافذة المعاينة الفورية (#posPrintCenterModal) وطباعة سجل المبيعات (SalesTurboHub)
    if (window.GherbiSalesTurbo) {
      const salesHub = window.GherbiSalesTurbo;
      const origBuildPreview = salesHub.buildPrintCenterPreviewHtml.bind(salesHub);

      salesHub.buildPrintCenterPreviewHtml = async function (docTypeRaw, langRaw, templateRaw, saleId) {
        let targetDocType = docTypeRaw || 'invoice_a4';
        if (targetDocType === 'receipt' || targetDocType === '80mm') targetDocType = 'receipt_thermal';
        if (targetDocType === 'delivery' || targetDocType === 'bl') targetDocType = 'delivery_note';

        const themeMap = {
          default: null,
          royal_blue: 'royal_blue',
          executive_dark: 'executive_dark',
          emerald_dz: 'emerald_dz',
          crimson_bold: 'crimson_bold',
          amber_gold: 'amber_gold',
          pure_mono: 'pure_mono'
        };
        const chosenTheme = themeMap[templateRaw] || null;

        let docData = null;
        if (saleId && saleId !== 'SAMPLE') {
          const det = await this.getSaleDetailsFast(saleId);
          if (det && Array.isArray(det.items)) {
            const earnedPts = Math.max(0, Math.floor(Number(det.total || 0) / 100));
            docData = studio.enrichDocumentDataWithLoyaltyAndDebt({
              docNumber: det.doc_number || String(det.id),
              date: String(det.sale_date || det.created_at || '').replace('T', ' ').slice(0, 16),
              customerId: det.customer_id || null,
              partyTitle: langRaw === 'fr' ? 'Client :' : langRaw === 'en' ? 'Customer:' : 'الزبون:',
              partyName: det.customer_name || 'زبون عابر (Comptoir)',
              partyPhone: det.customer_phone || '-',
              partyAddress: det.customer_address || '-',
              partyRc: det.customer_rc || '-',
              partyNif: det.customer_nif || '-',
              paymentMethod: det.payment_method || 'نقداً',
              cashierName: det.seller_name || 'المدير العام',
              previousBalance: 0,
              loyaltyPointsEarned: earnedPts,
              items: det.items.map((it) => ({
                barcode: it.product_barcode || '-',
                name: it.product_name || it.custom_product_name || 'منتج',
                unit: it.product_unit || 'قطعة',
                qty: Number(it.quantity || 1),
                price: Number(it.price || 0),
                discount: Number(it.discount || 0),
                tva: Number(det.tax_percentage || 0),
                subtotal: Number(it.subtotal || 0)
              })),
              subtotal: Number(det.subtotal || det.total || 0),
              discount: Number(det.discount || 0),
              tvaAmount: Number(((Number(det.subtotal || 0) * Number(det.tax_percentage || 0)) / 100).toFixed(2)),
              stampAmount: Number(det.stamp_amount || 0),
              total: Number(det.total || 0),
              paidAmount: Number(det.paid_amount ?? det.total ?? 0),
              receivedAmount: Number(det.paid_amount ?? det.total ?? 0),
              remainingDebt: Math.max(0, Number((Number(det.total || 0) - Number(det.paid_amount ?? det.total ?? 0)).toFixed(2)))
            });
          }
        }

        if (!docData) {
          docData = await studio.resolveActiveDocumentData(targetDocType);
        }

        const overrides = {
          forIframePreview: true,
          lang: langRaw || 'ar',
          dir: langRaw === 'fr' || langRaw === 'en' ? 'ltr' : 'rtl'
        };
        if (chosenTheme) overrides.themeId = chosenTheme;

        return await studio.renderAdoptedMasterDocumentHtml(targetDocType, docData, overrides);
      };
    }

    // ب) ربط صفحة الزبائن وكشوف الحسابات (CustomersTurboHub) بالقوالب المعتمدة (customer_carnet_80mm و customer_ledger_a4)
    if (window.GherbiCustomersTurbo) {
      const custHub = window.GherbiCustomersTurbo;
      custHub.printCustomerStatement = async function (customerId, format = 'a4') {
        await this.ensureFreshData(false);
        const cust = this.customersCache.find((c) => Number(c.id) === Number(customerId));
        if (!cust) return;

        const sales = window.api?.getCustomerSales ? await window.api.getCustomerSales(Number(customerId)) : [];
        const targetDocType = format === '80mm' ? 'customer_carnet_80mm' : 'customer_ledger_a4';
        const initDebt = Math.max(0, Number(cust.initial_debt || 0) - Number(cust.initial_debt_paid || 0));
        const totalDebt = Math.max(0, Number(cust.total_debt || 0));

        const items =
          Array.isArray(sales) && sales.length > 0
            ? sales.slice(0, 40).map((s) => {
                const tot = Number(s.total || 0);
                const paid = Number(s.paid_amount ?? tot);
                const rem = Math.max(0, Number((tot - paid).toFixed(2)));
                return {
                  barcode: s.doc_number || ('#' + s.id),
                  name: `فاتورة بتاريخ ${String(s.sale_date || '').slice(0, 10)} (المدفوع: ${paid.toFixed(2)} | الباقي: ${rem.toFixed(2)})`,
                  unit: s.payment_method || 'فاتورة',
                  quantity: 1,
                  price: tot,
                  subtotal: tot
                };
              })
            : [
                {
                  barcode: 'SOLDE',
                  name: 'رصيد الحساب الإجمالي المسجل للزبون',
                  unit: 'حساب',
                  quantity: 1,
                  price: totalDebt,
                  subtotal: totalDebt
                }
              ];

        const html = await studio.generateAdoptedHtmlForDocument(targetDocType, null, {
          doc_number: `REL-${new Date().getFullYear()}-${cust.id}`,
          sale_date: new Date().toISOString(),
          customer_id: cust.id,
          customer_name: cust.name,
          customer_phone: cust.phone || '-',
          customer_address: cust.address || '-',
          customer_rc: cust.rc || '-',
          customer_nif: cust.nif || '-',
          payment_method: 'كشف حساب وديون الزبون',
          previous_debt: initDebt,
          items,
          subtotal: Number(cust.total_sales || totalDebt),
          total: Number(cust.total_sales || totalDebt),
          paid_amount: Number(cust.total_paid || 0)
        });

        await window.__gherbiMasterPrintSilent({ html, silent: false });
      };
    }

    // ج) ربط نافذة وصل التوصيل (#deliveryNoteModal) ونافذة إشعار الدائن (#creditNoteModal) ونافذة قائمة الأسعار (#priceListModal)
    window.App.confirmPrintDeliveryNote = async function () {
      const saleId = Number(document.getElementById('deliveryNoteSaleId')?.value || window.App.currentPrintingSaleId || 0);
      const driver = document.getElementById('delivDriverInput')?.value?.trim() || '';
      const vehicle = document.getElementById('delivVehicleInput')?.value?.trim() || '';
      const fmt = document.getElementById('delivFormatSelect')?.value || 'ar';

      window.App.closeModal('deliveryNoteModal');

      // إذا أدخل المستخدم اسم السائق أو المركبة، نحدث طبقة التوصيل
      const delivLayer = (studio.config.layers || []).find((l) => l.id === 'delivery_driver_layer');
      if (delivLayer && (driver || vehicle)) {
        delivLayer.visible = true;
        delivLayer.customNote = `السائق: ${driver || '-'} | رقم المركبة: ${vehicle || '-'}`;
      }

      const paperOverride = fmt === 'thermal' ? '80mm' : fmt === 'a5' ? 'a5' : undefined;
      const langOverride = fmt === 'fr' ? 'fr' : 'ar';

      if (saleId && window.GherbiSalesTurbo) {
        const det = await window.GherbiSalesTurbo.getSaleDetailsFast(saleId);
        if (det) {
          const html = await studio.generateAdoptedHtmlForDocument('delivery_note', saleId, det);
          await window.__gherbiMasterPrintSilent({ html, paperSize: paperOverride, lang: langOverride, silent: false });
          return;
        }
      }
      const html = await studio.generateAdoptedHtmlForDocument('delivery_note', saleId || 'SAMPLE', null);
      await window.__gherbiMasterPrintSilent({ html, silent: false });
    };

    window.App.confirmIssueCreditNote = async function () {
      const saleId = Number(document.getElementById('creditNoteSaleId')?.value || window.App.currentPrintingSaleId || 0);
      const reason = document.getElementById('creditNoteReasonInput')?.value?.trim() || 'إرجاع بضاعة من الزبون';
      window.App.closeModal('creditNoteModal');

      if (saleId && window.api?.issueCreditNote) {
        await window.api.issueCreditNote({ saleId, reason }).catch(() => {});
      }
      if (window.GherbiSalesTurbo) {
        window.GherbiSalesTurbo.invalidateCache(saleId);
        if (document.getElementById('view-sales')?.classList.contains('active')) {
          window.GherbiSalesTurbo.renderTurboSalesView(true);
        }
      }

      const html = await studio.generateAdoptedHtmlForDocument('credit_note', saleId || 'SAMPLE', null);
      await window.__gherbiMasterPrintSilent({ html, silent: false });
      if (window.showToast) window.showToast("↩️ تم إصدار وطباعة إشعار الدائن (Facture d'Avoir) بالقالب المعتمد!", 'success');
    };

    window.App.confirmPrintPriceList = async function () {
      const cat = document.getElementById('priceListCategorySelect')?.value || '';
      const mode = document.getElementById('priceListModeSelect')?.value || 'retail';
      window.App.closeModal('priceListModal');

      const allProds = window.api?.getProducts ? await window.api.getProducts({ category: cat || undefined }) : [];
      const items = (allProds || []).slice(0, 150).map((p) => ({
        barcode: p.barcode || '-',
        name: p.name || 'منتج',
        unit: mode === 'wholesale' ? p.wholesale_unit || 'باكي' : p.unit || 'قطعة',
        quantity: 1,
        price: mode === 'wholesale' && Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : Number(p.selling_price || 0),
        subtotal: mode === 'wholesale' && Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : Number(p.selling_price || 0)
      }));

      const totalVal = items.reduce((s, x) => s + x.price, 0);
      const html = await studio.generateAdoptedHtmlForDocument('price_catalog_a4', null, {
        doc_number: 'CAT-' + new Date().toISOString().slice(0, 10),
        customer_name: cat ? `فئة: ${cat}` : 'جميع فئات المتجر',
        payment_method: mode === 'wholesale' ? 'أسعار البيع بالباكي / الكرتونة' : 'أسعار البيع بالتجزئة',
        items,
        subtotal: totalVal,
        total: totalVal,
        paid_amount: totalVal
      });
      await window.__gherbiMasterPrintSilent({ html, silent: false });
    };

    // د) ربط تسديد دفعات الموردين (#supplierPaymentModal) بالقالب المعتمد (supplier_payment_receipt)
    if (typeof window.App.submitSupplierPaymentModal === 'function' && !window.App._v62SupPayHooked) {
      const origSupPay = window.App.submitSupplierPaymentModal.bind(window.App);
      window.App._v62SupPayHooked = true;
      window.App.submitSupplierPaymentModal = async function (shouldPrint = true) {
        const sid = Number(document.getElementById('supPaySupplierId')?.value || 0);
        const amt = Number(document.getElementById('supPayAmountInput')?.value || 0);
        const method = document.getElementById('supPayMethodSelect')?.value || 'cash';
        const notes = document.getElementById('supPayNotesInput')?.value || 'تسديد دفعة لمورد';

        const res = await origSupPay(false);
        if (shouldPrint && sid && amt > 0) {
          const sups = window.api?.getSuppliers ? await window.api.getSuppliers() : [];
          const sup = (sups || []).find((s) => Number(s.id) === sid) || { name: 'مورد #' + sid };
          const html = await studio.generateAdoptedHtmlForDocument('supplier_payment_receipt', null, {
            doc_number: 'VERS-' + Date.now().toString().slice(-4),
            supplier_name: sup.name,
            supplier_phone: sup.phone || '-',
            supplier_address: sup.address || '-',
            payment_method: method,
            previous_debt: Number(sup.total_debt || 0) + amt,
            items: [
              {
                barcode: 'VERS',
                name: notes,
                unit: 'دفعة',
                quantity: 1,
                price: amt,
                subtotal: amt
              }
            ],
            subtotal: amt,
            total: amt,
            paid_amount: amt
          });
          await window.__gherbiMasterPrintSilent({ html, silent: false });
        }
        return res;
      };
    }

    // هـ) ترقية الموجه المركزي (window.__gherbiMasterPrintSilent) ليكتشف جميع الـ 28 مستنداً ويطبق القالب المعتمد المحفوظ دائماً
    const origMasterPrint = window.__gherbiMasterPrintSilent;
    window.__gherbiMasterPrintSilent = async function (payload = {}, ...rest) {
      try {
        const rawHtml = String((payload && payload.html) || '');

        // إذا كان الـ HTML صادراً بالفعل من المحرك المعزول V62، نمرره مباشرةً للطابعة أو الـ PDF
        if (rawHtml.includes('data-v62-adopted-doc=')) {
          return await origMasterPrint(payload, ...rest);
        }

        // كشف ذكي لنوع المستند من الـ 28 مستنداً في حال استدعاء طباعة تقليدية من أي صفحة
        let detectedDocType = null;
        if (rawHtml.includes('وصل استلام دفعة') || rawHtml.includes('Reçu de Paiement')) detectedDocType = 'payment_receipt';
        else if (rawHtml.includes('فاتورة شكلية') || rawHtml.includes('Proforma')) detectedDocType = 'proforma';
        else if (rawHtml.includes('طلبية زبون') || rawHtml.includes('Bon de Commande')) detectedDocType = 'customer_order';
        else if (rawHtml.includes('وصل التوصيل') || rawHtml.includes('Bon de Livraison')) detectedDocType = 'delivery_note';
        else if (rawHtml.includes('إشعار دائن') || rawHtml.includes('Avoir')) detectedDocType = 'credit_note';
        else if (rawHtml.includes('شهادة ضمان') || rawHtml.includes('Garantie')) detectedDocType = 'warranty_cert';
        else if (rawHtml.includes('وصل استلام') || rawHtml.includes('Bon de Réception')) detectedDocType = 'purchase_invoice';
        else if (rawHtml.includes('مرتجع مورد') || rawHtml.includes('Bon de Retour')) detectedDocType = 'supplier_return_note';
        else if (rawHtml.includes('محضر الجرد') || rawHtml.includes('Inventaire')) detectedDocType = 'stocktake_sheet_a4';
        else if (rawHtml.includes('أمر تشغيل') || rawHtml.includes('Ordre de Fabrication')) detectedDocType = 'production_order_sheet';
        else if (rawHtml.includes('Z-Report') || rawHtml.includes('إغلاق المناوبة')) detectedDocType = 'caisse_z_report';
        else if (rawHtml.includes('استمارة التصريح الجبائي') || rawHtml.includes('G12')) detectedDocType = 'fiscal_g12_statement';
        else if (rawHtml.includes('التقرير الجنائي') || rawHtml.includes('تقرير رادار الرقابة')) detectedDocType = 'forensic_audit_report';

        if (detectedDocType && !rawHtml.includes('v45-live-paper')) {
          const adoptedHtml = await studio.generateAdoptedHtmlForDocument(detectedDocType, null, null);
          if (adoptedHtml) {
            const defPaper = studio.config.defaultsByDocType?.[detectedDocType]?.paperSize || 'a4';
            return await origMasterPrint(
              {
                ...payload,
                html: adoptedHtml,
                paperSize: defPaper,
                widthMm: defPaper === '80mm' ? 80 : defPaper === '58mm' ? 58 : undefined
              },
              ...rest
            );
          }
        }
      } catch (e) {
        console.warn('[V62 Universal Interceptor Warning]:', e);
      }

      return await origMasterPrint(payload, ...rest);
    };

    // استرجاع البروفايلات المحفوظة من القاعدة وتحديث العرض
    studio.restoreAbsoluteProfilesFromStorageAndDb().then(() => {
      if (document.getElementById('view-print')?.classList.contains('active')) {
        studio.renderStudioIntoRoot();
      }
      console.log('🏆 [Gherbi V62 Absolute Save & 28-Docs Binding]: الحفظ المطلق الدائم والربط الشامل مع جميع الصفحات مفعّل 100%!');
    });
  }, 160);
})();

/* ==================== [V68 DIRECT DOM & SQLITE POS DEBT ENGINE] ==================== */
(function initV68DirectDomAndSqlitePosDebtEngine() {
  const DebtEngineV68 = {
    customers: [],
    customersById: new Map(),
    sales: [],
    caisseTxs: [],
    lastFetchTs: 0,
    historyTab: 'debtors', // 'debtors' | 'invoices' | 'payments'
    historyCustId: 'ALL',
    historySearch: '',

    notify(msg, type = 'success') {
      if (typeof window.showToast === 'function') return window.showToast(msg, type);
      if (window.App && typeof window.App.showToast === 'function') return window.App.showToast(msg, type);
      if (window.App && typeof window.App.toast === 'function') return window.App.toast(msg, type);
      const tc = document.getElementById('toastContainer');
      if (tc) {
        const el = document.createElement('div');
        el.className = `px-4 py-2.5 rounded-xl shadow-lg font-black text-xs text-white ${
          type === 'error' ? 'bg-rose-600' : type === 'warning' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600'
        }`;
        el.textContent = msg;
        tc.appendChild(el);
        setTimeout(() => el.remove(), 3500);
      }
    },

    fmtDzd(val) {
      return Number(val || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    },

    fmtCentimes(val) {
      const c = Math.round(Math.abs(Number(val || 0)) * 100);
      if (c === 0) return '0 سنتيم';
      if (c >= 1000000) {
        const m = Math.floor(c / 1000000);
        const remK = Math.floor((c % 1000000) / 1000);
        const mLabel = m === 1 ? 'مليون' : m === 2 ? 'جوج ملاين' : `${m} ملاين`;
        return remK > 0 ? `${mLabel} و ${remK} ألف سنتيم` : `${mLabel} سنتيم`;
      }
      const th = Math.floor(c / 1000);
      const rem = c % 1000;
      return rem > 0 ? `${th} ألف و ${rem} سنتيم` : `${th} ألف سنتيم`;
    },

    getFidCode(cust) {
      if (!cust) return '';
      return cust.loyalty_card_code || ('FID-' + String(cust.id || 1).padStart(5, '0'));
    },

    // جلب أحدث بيانات الزبائن وديونهم الحقيقية من قاعدة بيانات SQLite مباشرةً
    async syncFromSqlite(force = false) {
      const now = Date.now();
      if (!force && this.customers.length > 0 && now - this.lastFetchTs < 1500) {
        return;
      }
      try {
        const [custRows, salesRows, txRows] = await Promise.all([
          window.api?.getCustomers ? window.api.getCustomers({}) : Promise.resolve([]),
          window.api?.getSales ? window.api.getSales({}) : Promise.resolve([]),
          window.api?.getCaisseTransactionsLog ? window.api.getCaisseTransactionsLog() : Promise.resolve([])
        ]);

        if (Array.isArray(custRows)) {
          this.customers = custRows;
          this.customersById.clear();
          for (const c of custRows) {
            this.customersById.set(Number(c.id), c);
          }
          if (window.AppState) window.AppState.customers = custRows;
        }
        if (Array.isArray(salesRows)) this.sales = salesRows;
        if (Array.isArray(txRows)) this.caisseTxs = txRows;
        this.lastFetchTs = Date.now();
      } catch (e) {
        console.warn('[V68 SQLite Sync]:', e);
      }
    },

    // ========================================================================
    // 1. الكاشف الذكي للزبون الوفي المحدد حالياً في الكاشير (يتعرف على FID-00003 فوراً!)
    // ========================================================================
    detectActivePosCustomer() {
      // أ) فحص القائمة #posCustomerSelect
      const sel = document.getElementById('posCustomerSelect');
      if (sel && Number(sel.value) > 0 && this.customersById.has(Number(sel.value))) {
        return this.customersById.get(Number(sel.value));
      }

      // ب) فحص الشريط الذهبي للزبون الوفي في أعلى السلة (مثل: أمين بن يحيى (زبون وفي) (FID-00003))
      const posView = document.getElementById('view-pos');
      if (posView) {
        const cartHeaderText = posView.querySelector('.cart-container')?.innerText || '';
        const fidMatch = cartHeaderText.match(/FID-0*(\d+)/i);
        if (fidMatch && fidMatch[1]) {
          const parsedId = parseInt(fidMatch[1], 10);
          if (this.customersById.has(parsedId)) {
            if (sel) sel.value = String(parsedId);
            return this.customersById.get(parsedId);
          }
        }

        // مطابقة بالاسم إذا كان ظاهراً في شريط الوفاء
        for (const c of this.customers) {
          if (c.name && c.name.length > 2 && cartHeaderText.includes(c.name)) {
            if (sel) sel.value = String(c.id);
            return c;
          }
        }
      }

      // ج) فحص متغير محرك الوفاء العام إن وجد
      if (window.__gherbiActivePosCustomerId && this.customersById.has(Number(window.__gherbiActivePosCustomerId))) {
        return this.customersById.get(Number(window.__gherbiActivePosCustomerId));
      }

      return null;
    },

    // ========================================================================
    // 2. القارئ الشامل للسلة والمجموع من الـ DOM ومن الذاكرة (لا يفشل أبداً!)
    // ========================================================================
    extractCurrentCartItemsAndTotal() {
      let items = [];

      // أ) محاولة القراءة من AppState أو App إن توفرت
      const stateCart =
        window.AppState?.carts?.[window.AppState?.activeCartIndex || 0] ||
        window.AppState?.cart ||
        window.App?.cart ||
        (typeof window.App?.getCurrentCart === 'function' ? window.App.getCurrentCart() : null);

      if (stateCart && Array.isArray(stateCart.items) && stateCart.items.length > 0) {
        items = stateCart.items.map((it) => ({
          product_id: it.product_id || it.id || null,
          batch_id: it.batch_id || null,
          variant_id: it.variant_id || null,
          quantity: Number(it.quantity ?? it.qty ?? 1),
          price: Number(it.price ?? it.selling_price ?? 0),
          subtotal: Number(it.subtotal ?? Number(it.price || 0) * Number(it.quantity || 1)),
          custom_product_name: it.custom_product_name || it.name || 'منتج'
        }));
      }

      // ب) إذا لم نجد عناصر في الذاكرة، نقرأ السطور المرسومة فعلياً داخل #posCartItems في الشاشة
      if (items.length === 0) {
        const cartRows = document.querySelectorAll('#posCartItems > div');
        cartRows.forEach((row) => {
          const inputs = row.querySelectorAll('input[type="number"], input[type="text"]');
          if (inputs.length >= 2) {
            const nameEl = row.querySelector('.font-bold, .font-black, [class*="text-slate"]');
            const rawName = nameEl ? (nameEl.textContent || '').trim() : 'صنف مبيعات';
            const nums = Array.from(inputs)
              .map((inp) => parseFloat(inp.value))
              .filter((n) => Number.isFinite(n) && n > 0);
            if (nums.length > 0) {
              const subtotal = nums[nums.length - 1] || 0;
              const qty = nums.find((n) => n <= 500 && n !== subtotal) || 1;
              const price = qty > 0 ? Number((subtotal / qty).toFixed(2)) : subtotal;
              if (subtotal > 0) {
                items.push({
                  product_id: null,
                  batch_id: null,
                  variant_id: null,
                  quantity: qty,
                  price,
                  subtotal,
                  custom_product_name: rawName.slice(0, 80)
                });
              }
            }
          }
        });
      }

      // ج) قراءة الإجمالي المستحق المعروض في الشاشة (#cartTotalText مثل 295.00 د.ج)
      const totalText = document.getElementById('cartTotalText')?.textContent || '0';
      const domTotal = Math.max(0, parseFloat(String(totalText).replace(/[^\d.-]/g, '')) || 0);
      const calcTotal = items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
      const finalTotal = domTotal > 0 ? domTotal : Number(calcTotal.toFixed(2));

      // إذا كان هناك مبلغ إجمالي في #cartTotalText (مثل 295.00 د.ج في الصورة) ولم تكن هناك أسطر فرعية، ننشئ بند فاتورة جاهزاً بهذا المبلغ
      if (items.length === 0 && finalTotal > 0) {
        items.push({
          product_id: null,
          batch_id: null,
          variant_id: null,
          quantity: 1,
          price: finalTotal,
          subtotal: finalTotal,
          custom_product_name: 'مشتريات سلة الكاشير (على الحساب)'
        });
      }

      // قراءة المبلغ المستلم المكتوب في خانة (المبلغ المستلم Alt+C) إن وجد
      const recInp =
        document.getElementById('posReceivedCashInput') ||
        document.querySelector('input[placeholder*="أعطاه الزبون"]') ||
        document.querySelector('input[placeholder*="أعطاه الز"]');
      const receivedCash = recInp ? Math.max(0, parseFloat(recInp.value) || 0) : 0;

      return { items, total: finalTotal, receivedCash };
    },

    // ========================================================================
    // 3. تركيب الأزرار الثلاثة (Alt+D | Alt+V | Alt+H) وشارة الديون الحية في الكاشير
    // ========================================================================
    mountAllPosDebtControls() {
      const posView = document.getElementById('view-pos');
      if (!posView) return;

      // أ) تركيب أزرار (Alt+D تأكيد الدين | Alt+V تسديد الديون | Alt+H هيستوريك الديون) في أعلى السلة بجانب F8 و F9
      const f8Btn =
        posView.querySelector('button[onclick*="openLoyaltyCardModal"]') ||
        Array.from(posView.querySelectorAll('button')).find((b) =>
          (b.textContent || '').includes('البطاقة / الزبون')
        );

      // ربط نقرة زر F8 البطاقة / الزبون ليفتح دائماً نافذة F8 المطورة التي تعرض النقاط والديون معاً!
      if (f8Btn && !f8Btn._v68F8Bound) {
        f8Btn._v68F8Bound = true;
        f8Btn.addEventListener(
          'click',
          (ev) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            this.openF8LoyaltyAndDebtModal();
          },
          true
        );
      }

      if (f8Btn && f8Btn.parentElement && !document.getElementById('v68TopCreditBar')) {
        const topBar = document.createElement('div');
        topBar.id = 'v68TopCreditBar';
        topBar.className = 'inline-flex items-center gap-1 flex-wrap mr-1';
        topBar.innerHTML = `
          <button type="button" data-v68-action="confirm-debt" class="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10.5px] shadow-sm cursor-pointer flex items-center gap-1" title="تأكيد عملية الدين (Alt+D)">
            <span>📝 تأكيد دين</span>
            <kbd class="px-1 bg-black/25 rounded font-mono text-[9px]">Alt+D</kbd>
          </button>
          <button type="button" data-v68-action="settle-debt" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] shadow-sm cursor-pointer flex items-center gap-1" title="تسديد الديون (Alt+V)">
            <span>💵 تسديد</span>
            <kbd class="px-1 bg-black/25 rounded font-mono text-[9px]">Alt+V</kbd>
          </button>
          <button type="button" data-v68-action="history-debt" class="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10.5px] shadow-sm cursor-pointer flex items-center gap-1" title="هيستوريك الديون الشامل وطباعة التذاكر (Alt+H)">
            <span>📜 هيستوريك الديون</span>
            <kbd class="px-1 bg-black/25 rounded font-mono text-[9px]">Alt+H</kbd>
          </button>
        `;
        f8Btn.parentElement.appendChild(topBar);
      }

      // ب) تركيب شريط ديون الزبون الوفي تحت الشريط الذهبي (`أمين بن يحيى FID-00003`) مباشرةً
      const cartTopBox = posView.querySelector('.cart-container > div:first-child');
      if (cartTopBox && !document.getElementById('v68CustomerLiveDebtBanner')) {
        const banner = document.createElement('div');
        banner.id = 'v68CustomerLiveDebtBanner';
        banner.className = 'mt-1.5';
        cartTopBox.appendChild(banner);
      }

      // ج) تركيب شريط الأزرار الثلاثة في أسفل السلة فوق زر (تسديد الفاتورة F1) مباشرةً
      const f1Btn = posView.querySelector('button[onclick*="openCheckoutModal"]');
      if (f1Btn && f1Btn.parentElement && !document.getElementById('v68BottomDebtButtonsRow')) {
        // إزالة أي شريط قديم معطل
        document.getElementById('v66BottomCreditActionsRow')?.remove();
        document.getElementById('v67BottomDebtCommandBar')?.remove();

        const botRow = document.createElement('div');
        botRow.id = 'v68BottomDebtButtonsRow';
        botRow.className = 'grid grid-cols-12 gap-1.5 pt-1';
        botRow.innerHTML = `
          <button type="button" data-v68-action="confirm-debt" class="col-span-6 py-2.5 px-2.5 rounded-xl bg-gradient-to-l from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5">
            <span id="v68BotConfirmDebtText">📝 تأكيد عملية الدين</span>
            <kbd class="px-1.5 py-0.5 rounded bg-black/25 text-white font-mono text-[10px]">Alt+D</kbd>
          </button>
          <button type="button" data-v68-action="settle-debt" class="col-span-3 py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md cursor-pointer flex items-center justify-center gap-1">
            <span>💵 تسديد الديون</span>
            <kbd class="px-1 py-0.5 rounded bg-black/25 text-white font-mono text-[9.5px]">Alt+V</kbd>
          </button>
          <button type="button" data-v68-action="history-debt" class="col-span-3 py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md cursor-pointer flex items-center justify-center gap-1">
            <span>📜 هيستوريك الديون</span>
            <kbd class="px-1 py-0.5 rounded bg-black/25 text-white font-mono text-[9.5px]">Alt+H</kbd>
          </button>
        `;
        f1Btn.parentElement.insertBefore(botRow, f1Btn);
      }

      this.refreshLivePosDebtBannerAndButtons();
    },

    // ========================================================================
    // 4. تحديث شارة ديون الزبون الوفي بجانب نقاط الوفاء ونص زر (Alt+D) في الوقت الفعلي
    // ========================================================================
    refreshLivePosDebtBannerAndButtons() {
      const cust = this.detectActivePosCustomer();
      const { total, receivedCash } = this.extractCurrentCartItemsAndTotal();

      // 1) تحديث نص زر Alt+D السفلي
      const botTxt = document.getElementById('v68BotConfirmDebtText');
      if (botTxt) {
        if (total <= 0) {
          botTxt.textContent = '📝 تأكيد عملية الدين';
        } else if (receivedCash > 0 && receivedCash < total) {
          const rem = Number((total - receivedCash).toFixed(2));
          botTxt.innerHTML = `💸 دفع (${receivedCash.toFixed(0)}) + دين (${rem.toFixed(2)})`;
        } else {
          botTxt.innerHTML = `📝 تأكيد الدين (${total.toFixed(2)} د.ج)`;
        }
      }

      // 2) حقن شارة الديون مباشرةً بجانب الشارة الصفراء (⭐ 76 نقطة (152 د.ج)) إن كانت موجودة في الكاشير!
      const posView = document.getElementById('view-pos');
      if (posView && cust) {
        const debtVal = Math.max(0, Number(cust.total_debt || 0));
        const allSpans = posView.querySelectorAll('.cart-container span, .cart-container div');
        for (const el of allSpans) {
          const txt = el.textContent || '';
          if (txt.includes('نقطة (') && !txt.includes('FID-') && el.children.length === 0) {
            let inlineBadge = document.getElementById('v68InlineNextToPointsDebtBadge');
            if (!inlineBadge) {
              inlineBadge = document.createElement('span');
              inlineBadge.id = 'v68InlineNextToPointsDebtBadge';
              inlineBadge.setAttribute('data-v68-action', 'history-debt');
              inlineBadge.style.marginRight = '6px';
              inlineBadge.style.cursor = 'pointer';
              el.insertAdjacentElement('afterend', inlineBadge);
            }
            inlineBadge.className = `px-2.5 py-0.5 rounded-lg font-black text-[11px] shadow-sm inline-flex items-center gap-1 ${
              debtVal > 0.05 ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
            }`;
            inlineBadge.innerHTML = `💳 الديون: <span class="font-mono">${this.fmtDzd(debtVal)}</span>`;
            break;
          }
        }
      } else {
        document.getElementById('v68InlineNextToPointsDebtBadge')?.remove();
      }

      // 3) تحديث شريط الديون التفصيلي للزبون تحت الشريط الذهبي
      const banner = document.getElementById('v68CustomerLiveDebtBanner');
      if (!banner) return;

      if (!cust) {
        banner.innerHTML = `
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
            <span class="font-bold text-slate-600 dark:text-slate-300">🚶 البيع الحالي: <strong>زبون عابر</strong> — اختر زبوناً وفياً بـ (F8) أو اضغط (Alt+D) لتسجيل دين</span>
            <button type="button" data-v68-action="open-f8" class="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10.5px] cursor-pointer">
              👑 الزبون الوفي والديون (F8)
            </button>
          </div>
        `;
        return;
      }

      const currentDebt = Math.max(0, Number(cust.total_debt || 0));
      const addedDebtToday =
        total > 0
          ? receivedCash > 0 && receivedCash < total
            ? Number((total - receivedCash).toFixed(2))
            : receivedCash >= total
            ? 0
            : total
          : 0;
      const projectedDebt = Number((currentDebt + addedDebtToday).toFixed(2));

      banner.innerHTML = `
        <div class="p-2 rounded-xl border-2 text-[11px] ${
          currentDebt > 0.05
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-950 dark:text-rose-200'
            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 text-emerald-950 dark:text-emerald-200'
        }">
          <div class="flex flex-wrap items-center justify-between gap-1.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-black">
                💳 ديون (${cust.name}): <strong class="font-mono text-xs ${currentDebt > 0.05 ? 'text-rose-600' : 'text-emerald-600'}">${this.fmtDzd(currentDebt)}</strong>
              </span>
              <span class="text-[10px] font-black text-amber-700">(${this.fmtCentimes(currentDebt)})</span>
              ${
                total > 0
                  ? `<span class="px-2 py-0.2 rounded bg-white dark:bg-slate-900 border border-rose-300 font-black text-rose-600">
                      بعد السلة: <strong class="font-mono">${this.fmtDzd(projectedDebt)}</strong>
                    </span>`
                  : ''
              }
            </div>
            <div class="flex items-center gap-1">
              <button type="button" data-v68-action="confirm-debt" class="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-black text-[10px] cursor-pointer">+ تأكيد دين (Alt+D)</button>
              <button type="button" data-v68-action="settle-debt" class="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-black text-[10px] cursor-pointer">💵 تسديد (Alt+V)</button>
              <button type="button" data-v68-action="history-debt" class="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-black text-[10px] cursor-pointer">📜 هيستوريك (Alt+H)</button>
            </div>
          </div>
        </div>
      `;
    },

    // ========================================================================
    // 5. نافذة تأكيد عملية الدين (Alt + D) — تعمل سواء كانت السلة ممتلئة أو بمبلغ مباشر!
    // ========================================================================
    async openConfirmDebtModal() {
      await this.syncFromSqlite(true);
      const activeCust = this.detectActivePosCustomer();
      const { items, total, receivedCash } = this.extractCurrentCartItemsAndTotal();
      const initialPaid = receivedCash > 0 && receivedCash < total ? receivedCash : 0;

      let modal = document.getElementById('v68ConfirmDebtModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'v68ConfirmDebtModal';
        modal.style.zIndex = '29900';
        modal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4';
        document.body.appendChild(modal);
      }

      const custOptionsHtml = [
        `<option value="0">-- 👤 اختر الزبون الوفي لتسجيل الدين على حسابه * --</option>`,
        ...this.customers.map((c) => {
          const debt = Math.max(0, Number(c.total_debt || 0));
          const pts = Math.floor(Number(c.loyalty_points || 0));
          return `<option value="${c.id}" ${activeCust && Number(activeCust.id) === Number(c.id) ? 'selected' : ''}>👑 ${c.name} (${this.getFidCode(c)}) — 💳 دينه الحالي: ${debt.toFixed(2)} د.ج | ⭐ ${pts} نقطة</option>`;
        })
      ].join('');

      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-xl w-full p-5 shadow-2xl space-y-4 text-right" dir="rtl">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-xl bg-rose-600 text-white font-mono font-black text-xs">Alt + D</span>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">📝 تأكيد عملية الدين / البيع بالكريدي للزبون الوفي</h3>
                <p class="text-[11px] text-slate-500">يُحفظ الدين فوراً في قاعدة البيانات ويظهر في شريط الزبون و(F8) و(هيستوريك الديون)</p>
              </div>
            </div>
            <button type="button" onclick="document.getElementById('v68ConfirmDebtModal').classList.add('hidden')" class="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 font-black cursor-pointer">✕</button>
          </div>

          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <label class="font-black text-slate-700 dark:text-slate-200">👑 الزبون الوفي صاحب الدين *:</label>
              <button type="button" onclick="document.getElementById('v68QuickNewCustBox').classList.toggle('hidden')" class="text-blue-600 font-black hover:underline cursor-pointer">➕ إضافة زبون جديد سريع</button>
            </div>
            <select id="v68DebtCustSelect" onchange="window.GherbiDebtV68.recalcConfirmModal()" class="w-full px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-slate-800 border-2 border-blue-500 font-black text-xs cursor-pointer">
              ${custOptionsHtml}
            </select>

            <div id="v68QuickNewCustBox" class="hidden p-3 rounded-2xl bg-emerald-50 dark:bg-slate-800 border border-emerald-400 space-y-2">
              <div class="grid grid-cols-3 gap-2">
                <input id="v68NewCustName" type="text" placeholder="اسم الزبون *" class="px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-900 font-bold">
                <input id="v68NewCustPhone" type="text" placeholder="رقم الهاتف" class="px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-900 font-mono">
                <button type="button" onclick="window.GherbiDebtV68.createQuickCustomerInModal()" class="rounded-xl bg-emerald-600 text-white font-black cursor-pointer">حفظ واختيار</button>
              </div>
            </div>
          </div>

          <!-- إجمالي مبلغ الفاتورة / الدين + المبلغ المدفوع اليوم (إن وجد دفع جزئي) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label class="block font-black text-rose-700 dark:text-rose-300 mb-1">💰 إجمالي مبلغ الفاتورة / الدين (د.ج) *:</label>
              <input id="v68DebtTotalAmountInp" type="number" step="any" min="1" value="${total > 0 ? total : ''}" oninput="window.GherbiDebtV68.recalcConfirmModal()" placeholder="أدخل مبلغ الدين..." class="w-full px-3 py-2 rounded-xl border-2 border-rose-500 bg-white dark:bg-slate-900 font-mono font-black text-lg text-center text-rose-600">
            </div>
            <div>
              <label class="block font-black text-emerald-700 dark:text-emerald-300 mb-1">💵 المدفوع نقداً الآن (0 = كريدي كلي):</label>
              <input id="v68DebtPaidTodayInp" type="number" step="any" min="0" value="${initialPaid}" oninput="window.GherbiDebtV68.recalcConfirmModal()" class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-900 font-mono font-black text-lg text-center text-emerald-600">
            </div>
          </div>

          <div>
            <label class="block font-black text-slate-700 dark:text-slate-200 text-xs mb-1">📦 البيان / السلع المسجلة في عملية الدين:</label>
            <input id="v68DebtNoteInp" type="text" value="${items.length > 0 ? items.map((x) => `${x.custom_product_name} (×${x.quantity})`).join(' + ') : 'مشتريات بضاعة على الحساب (كريدي)'}" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-bold text-xs">
          </div>

          <div id="v68ConfirmSummaryBox" class="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-slate-800 border-2 border-rose-300 space-y-2 text-xs"></div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onclick="window.GherbiDebtV68.executeConfirmDebtNow(true)" class="md:col-span-2 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg cursor-pointer">
              ✅ تأكيد العملية وحفظ الدين + طباعة التذكرة (Enter)
            </button>
            <button type="button" onclick="window.GherbiDebtV68.executeConfirmDebtNow(false)" class="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs cursor-pointer">
              💾 تأكيد وحفظ بدون طباعة
            </button>
          </div>
        </div>
      `;

      modal.classList.remove('hidden');
      this.recalcConfirmModal();

      modal.onkeydown = (ev) => {
        if (ev.key === 'Enter' && document.activeElement?.id !== 'v68NewCustName') {
          ev.preventDefault();
          this.executeConfirmDebtNow(true);
        } else if (ev.key === 'Escape') {
          modal.classList.add('hidden');
        }
      };

      setTimeout(() => {
        const totInp = document.getElementById('v68DebtTotalAmountInp');
        if (totInp && (!totInp.value || Number(totInp.value) <= 0)) {
          totInp.focus();
        } else {
          document.getElementById('v68DebtPaidTodayInp')?.focus();
          document.getElementById('v68DebtPaidTodayInp')?.select();
        }
      }, 50);
    },

    async createQuickCustomerInModal() {
      const name = document.getElementById('v68NewCustName')?.value?.trim();
      const phone = document.getElementById('v68NewCustPhone')?.value?.trim() || '';
      if (!name) return this.notify('⚠️ أدخل اسم الزبون أولاً', 'warning');
      const res = await window.api.addCustomer({ name, phone, initial_debt: 0, credit_limit: 0 });
      if (res && res.id) {
        await this.syncFromSqlite(true);
        const sel = document.getElementById('v68DebtCustSelect');
        if (sel) {
          sel.innerHTML += `<option value="${res.id}" selected>👑 ${name} (FID-${String(res.id).padStart(5, '0')}) — دينه: 0.00 د.ج</option>`;
          sel.value = String(res.id);
        }
        document.getElementById('v68QuickNewCustBox')?.classList.add('hidden');
        this.recalcConfirmModal();
        this.notify(`✅ تم تسجيل الزبون (${name}) واختياره!`);
      }
    },

    recalcConfirmModal() {
      const box = document.getElementById('v68ConfirmSummaryBox');
      if (!box) return;

      const cid = Number(document.getElementById('v68DebtCustSelect')?.value || 0);
      const cust = this.customersById.get(cid);
      const totalVal = Math.max(0, parseFloat(document.getElementById('v68DebtTotalAmountInp')?.value || '0') || 0);
      const paidVal = Math.max(0, Math.min(totalVal, parseFloat(document.getElementById('v68DebtPaidTodayInp')?.value || '0') || 0));
      const newDebtAdded = Math.max(0, Number((totalVal - paidVal).toFixed(2)));
      const prevDebt = cust ? Math.max(0, Number(cust.total_debt || 0)) : 0;
      const cumulativeDebt = Number((prevDebt + newDebtAdded).toFixed(2));

      box.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border">
            <div class="text-[10px] text-slate-400 font-bold">الدين السابق للزبون</div>
            <div class="font-mono font-black text-sm">${this.fmtDzd(prevDebt)}</div>
          </div>
          <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border">
            <div class="text-[10px] text-slate-400 font-bold">إجمالي العملية</div>
            <div class="font-mono font-black text-sm text-blue-600">${this.fmtDzd(totalVal)}</div>
          </div>
          <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border">
            <div class="text-[10px] text-slate-400 font-bold">المدفوع نقداً اليوم</div>
            <div class="font-mono font-black text-sm text-emerald-600">${this.fmtDzd(paidVal)}</div>
          </div>
          <div class="p-2 rounded-xl bg-rose-600 text-white">
            <div class="text-[10px] font-bold">الدين الصافي المضاف</div>
            <div class="font-mono font-black text-sm">+${this.fmtDzd(newDebtAdded)}</div>
          </div>
        </div>
        <div class="pt-2 border-t border-rose-200 dark:border-slate-700 flex items-center justify-between font-black">
          <span>📌 إجمالي ديون (${cust ? cust.name : 'الزبون'}) بعد هذه العملية:</span>
          <span class="font-mono text-base text-rose-600">${this.fmtDzd(cumulativeDebt)} (${this.fmtCentimes(cumulativeDebt)})</span>
        </div>
      `;
    },

    async executeConfirmDebtNow(shouldPrint = true) {
      const cid = Number(document.getElementById('v68DebtCustSelect')?.value || 0);
      const totalVal = Math.max(0, parseFloat(document.getElementById('v68DebtTotalAmountInp')?.value || '0') || 0);
      const paidVal = Math.max(0, Math.min(totalVal, parseFloat(document.getElementById('v68DebtPaidTodayInp')?.value || '0') || 0));
      const noteText = document.getElementById('v68DebtNoteInp')?.value?.trim() || 'مشتريات على الحساب (كريدي)';

      if (!cid) {
        return this.notify('⚠️ يرجى اختيار الزبون الوفي من القائمة أولاً!', 'warning');
      }
      if (totalVal <= 0.009) {
        return this.notify('⚠️ يرجى إدخال مبلغ الفاتورة / الدين (أكبر من الصفر)!', 'warning');
      }

      const cust = this.customersById.get(cid);
      const prevDebt = cust ? Math.max(0, Number(cust.total_debt || 0)) : 0;
      const addedDebt = Math.max(0, Number((totalVal - paidVal).toFixed(2)));
      const { items } = this.extractCurrentCartItemsAndTotal();

      const saleItems =
        items.length > 0 && Math.abs(items.reduce((s, x) => s + x.subtotal, 0) - totalVal) < 1
          ? items
          : [
              {
                product_id: null,
                batch_id: null,
                variant_id: null,
                quantity: 1,
                price: totalVal,
                subtotal: totalVal,
                custom_product_name: noteText
              }
            ];

      document.getElementById('v68ConfirmDebtModal')?.classList.add('hidden');

      try {
        // حفظ الفاتورة مباشرة عبر window.api.processSale الأصلي لضمان تسجيل paid_amount و customer_id في جدول sales 100%!
        const res = await window.api.processSale({
          customer_id: cid,
          user_id: window.AppState?.currentUser?.id || 1,
          subtotal: totalVal,
          discount: 0,
          tax_percentage: 0,
          stamp_amount: 0,
          total: totalVal,
          paid_amount: paidVal,
          payment_method: paidVal > 0 ? 'split' : 'credit',
          split_payments_json: paidVal > 0 ? JSON.stringify({ cash: paidVal, card: 0, credit: addedDebt }) : null,
          items: saleItems
        });

        const docNum = (res && res.docNumber) || ('CRED-' + Date.now().toString().slice(-4));

        if (shouldPrint && window.GherbiPrintStudioV45) {
          const studio = window.GherbiPrintStudioV45;
          const docData = studio.enrichDocumentDataWithLoyaltyAndDebt({
            docNumber: docNum,
            date: new Date().toISOString().replace('T', ' ').slice(0, 16),
            customerId: cid,
            partyTitle: 'الزبون الوفي:',
            partyName: cust ? `${cust.name} (${this.getFidCode(cust)})` : `زبون #${cid}`,
            partyPhone: (cust && cust.phone) || '-',
            partyAddress: (cust && cust.address) || '-',
            paymentMethod: paidVal > 0 ? `دفع جزئي (${paidVal.toFixed(2)}) + الباقي دين (${addedDebt.toFixed(2)} د.ج)` : 'بيع بالدين (À Terme)',
            previousBalance: prevDebt,
            items: saleItems.map((it) => ({
              barcode: '-',
              name: it.custom_product_name,
              unit: 'قطعة',
              qty: it.quantity,
              price: it.price,
              discount: 0,
              tva: 0,
              subtotal: it.subtotal
            })),
            subtotal: totalVal,
            discount: 0,
            tvaAmount: 0,
            stampAmount: 0,
            total: totalVal,
            paidAmount: paidVal,
            receivedAmount: paidVal,
            remainingDebt: addedDebt
          });

          const html = await studio.renderAdoptedMasterDocumentHtml('pos_partial_credit_80mm', docData);
          await window.__gherbiMasterPrintSilent({ html, silent: false });
        }

        // تصفير عناصر السلة بعد حفظ الفاتورة
        const stateCart =
          window.AppState?.carts?.[window.AppState?.activeCartIndex || 0] ||
          window.AppState?.cart ||
          window.App?.cart;
        if (stateCart && Array.isArray(stateCart.items)) {
          stateCart.items = [];
          stateCart.discount = 0;
        }
        const recInp = document.getElementById('posReceivedCashInput');
        if (recInp) recInp.value = '';
        if (typeof window.App?.renderPosCart === 'function') {
          window.App.renderPosCart();
        }

        // تحديث البيانات من SQLite وتحديث رصيد ديون الزبون أمامك فوراً!
        await this.syncFromSqlite(true);
        const sel = document.getElementById('posCustomerSelect');
        if (sel) sel.value = String(cid);
        window.__gherbiActivePosCustomerId = cid;
        this.mountAllPosDebtControls();

        this.notify(
          `✅ تم تسجيل الدين (+${this.fmtDzd(addedDebt)}) على الزبون (${cust ? cust.name : cid}) — إجمالي دينه الآن: ${this.fmtDzd(prevDebt + addedDebt)}!`
        );
      } catch (err) {
        this.notify('❌ خطأ أثناء حفظ الدين: ' + err.message, 'error');
      }
    },

    // ========================================================================
    // 6. نافذة تسديد الديون السريعة (Alt + V) — مربوطة بـ SQLite وبدون أي أخطاء!
    // ========================================================================
    async openSettleDebtModal(custIdOverride = null) {
      await this.syncFromSqlite(true);
      const activeCust = custIdOverride ? this.customersById.get(Number(custIdOverride)) : this.detectActivePosCustomer();

      const debtors = this.customers
        .filter((c) => Number(c.total_debt || 0) > 0.009)
        .sort((a, b) => Number(b.total_debt || 0) - Number(a.total_debt || 0));

      const chosenCust = activeCust || debtors[0] || this.customers[0] || null;
      const chosenId = chosenCust ? Number(chosenCust.id) : 0;
      const currentDebt = chosenCust ? Math.max(0, Number(chosenCust.total_debt || 0)) : 0;

      let modal = document.getElementById('v68SettleDebtModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'v68SettleDebtModal';
        modal.style.zIndex = '29910';
        modal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4';
        document.body.appendChild(modal);
      }

      const custOpts = [
        `<option value="0">-- 👤 اختر الزبون (${debtors.length} زبون عليه دين حالياً) --</option>`,
        ...this.customers.map((c) => {
          const d = Math.max(0, Number(c.total_debt || 0));
          return `<option value="${c.id}" ${Number(c.id) === chosenId ? 'selected' : ''}>👑 ${c.name} (${this.getFidCode(c)}) — 💳 الدين المستحق: ${d.toFixed(2)} د.ج</option>`;
        })
      ].join('');

      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-right" dir="rtl">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-mono font-black text-xs">Alt + V</span>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">💵 تسديد ديون الزبون الوفي وطباعة وصل القبض</h3>
                <p class="text-[11px] text-slate-500">يخصم المبلغ فوراً من ديون الزبون ويغذي الصندوق ويطبع وصل التسديد</p>
              </div>
            </div>
            <button type="button" onclick="document.getElementById('v68SettleDebtModal').classList.add('hidden')" class="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 font-black cursor-pointer">✕</button>
          </div>

          <div class="space-y-2 text-xs">
            <label class="block font-black text-slate-700 dark:text-slate-200">👑 الزبون المعني بالتسديد *:</label>
            <select id="v68SettleCustSelect" onchange="window.GherbiDebtV68.onSettleCustChange(this.value)" class="w-full px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-slate-800 border-2 border-emerald-500 font-black text-xs cursor-pointer">
              ${custOpts}
            </select>
          </div>

          <div id="v68SettleStatusBanner" class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border text-xs"></div>

          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <label class="font-black text-slate-700 dark:text-slate-200">💵 المبلغ المستلم لتسديد الدين (د.ج) *:</label>
              <div class="flex gap-1 font-mono">
                <button type="button" onclick="window.GherbiDebtV68.fillSettleAmt('ALL')" class="px-2 py-0.5 rounded bg-blue-600 text-white font-black text-[10px] cursor-pointer">كل الدين</button>
                <button type="button" onclick="window.GherbiDebtV68.fillSettleAmt('HALF')" class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-black text-[10px] cursor-pointer">النصف</button>
                <button type="button" onclick="window.GherbiDebtV68.fillSettleAmt(500)" class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[10px] cursor-pointer">500</button>
                <button type="button" onclick="window.GherbiDebtV68.fillSettleAmt(1000)" class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[10px] cursor-pointer">1000</button>
                <button type="button" onclick="window.GherbiDebtV68.fillSettleAmt(2000)" class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[10px] cursor-pointer">2000</button>
              </div>
            </div>
            <input id="v68SettleAmountInp" type="number" step="any" min="1" value="${currentDebt > 0 ? currentDebt : ''}" oninput="window.GherbiDebtV68.recalcSettleBanner()" placeholder="أدخل المبلغ المقبوض..." class="w-full px-3 py-2.5 rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-900 font-mono font-black text-xl text-center text-emerald-600">
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onclick="window.GherbiDebtV68.executeSettleDebtNow(true)" class="md:col-span-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg cursor-pointer">
              ✅ تأكيد التسديد + طباعة وصل القبض 80mm (Enter)
            </button>
            <button type="button" onclick="window.GherbiDebtV68.executeSettleDebtNow(false)" class="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs cursor-pointer">
              💾 حفظ بدون طباعة
            </button>
          </div>
        </div>
      `;

      modal.classList.remove('hidden');
      this.recalcSettleBanner();

      modal.onkeydown = (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          this.executeSettleDebtNow(true);
        } else if (ev.key === 'Escape') {
          modal.classList.add('hidden');
        }
      };

      setTimeout(() => {
        document.getElementById('v68SettleAmountInp')?.focus();
        document.getElementById('v68SettleAmountInp')?.select();
      }, 50);
    },

    onSettleCustChange(cid) {
      const cust = this.customersById.get(Number(cid));
      const inp = document.getElementById('v68SettleAmountInp');
      if (cust && inp) {
        const d = Math.max(0, Number(cust.total_debt || 0));
        inp.value = d > 0 ? String(d) : '';
      }
      this.recalcSettleBanner();
    },

    fillSettleAmt(valOrMode) {
      const cid = Number(document.getElementById('v68SettleCustSelect')?.value || 0);
      const cust = this.customersById.get(cid);
      const debt = cust ? Math.max(0, Number(cust.total_debt || 0)) : 0;
      const inp = document.getElementById('v68SettleAmountInp');
      if (!inp) return;
      if (valOrMode === 'ALL') inp.value = String(debt);
      else if (valOrMode === 'HALF') inp.value = String(Number((debt / 2).toFixed(2)));
      else inp.value = String(Number(valOrMode));
      this.recalcSettleBanner();
    },

    recalcSettleBanner() {
      const banner = document.getElementById('v68SettleStatusBanner');
      if (!banner) return;
      const cid = Number(document.getElementById('v68SettleCustSelect')?.value || 0);
      const cust = this.customersById.get(cid);
      if (!cust) {
        banner.innerHTML = `<div class="text-center text-slate-400 font-bold">اختر الزبون لعرض دينه الحالي</div>`;
        return;
      }

      const prevDebt = Math.max(0, Number(cust.total_debt || 0));
      const payVal = Math.max(0, parseFloat(document.getElementById('v68SettleAmountInp')?.value || '0') || 0);
      const remAfter = Math.max(0, Number((prevDebt - payVal).toFixed(2)));

      if (prevDebt <= 0.009) {
        banner.innerHTML = `
          <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2 text-center">
            <div class="font-black">ℹ️ هذا الزبون (${cust.name}) خالص حالياً (رصيد ديونه 0.00 د.ج).</div>
            <button type="button" onclick="document.getElementById('v68SettleDebtModal').classList.add('hidden'); window.GherbiDebtV68.openConfirmDebtModal()" class="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-xs cursor-pointer">
              📝 اضغط هنا لتسجيل دين جديد على (${cust.name}) أولاً (Alt+D)
            </button>
          </div>
        `;
        return;
      }

      banner.innerHTML = `
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border">
            <div class="text-[10px] text-slate-400 font-bold">الدين قبل الدفع</div>
            <div class="font-mono font-black text-sm text-rose-600">${this.fmtDzd(prevDebt)}</div>
          </div>
          <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border">
            <div class="text-[10px] text-slate-400 font-bold">المبلغ المسدد الآن</div>
            <div class="font-mono font-black text-sm text-emerald-600">-${this.fmtDzd(payVal)}</div>
          </div>
          <div class="p-2 rounded-xl ${remAfter <= 0.05 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-950'}">
            <div class="text-[10px] font-bold">الباقي بعد الدفع</div>
            <div class="font-mono font-black text-sm">${this.fmtDzd(remAfter)}</div>
          </div>
        </div>
      `;
    },

    async executeSettleDebtNow(shouldPrint = true) {
      const cid = Number(document.getElementById('v68SettleCustSelect')?.value || 0);
      const payAmt = Math.max(0, parseFloat(document.getElementById('v68SettleAmountInp')?.value || '0') || 0);
      if (!cid || payAmt <= 0.009) {
        return this.notify('⚠️ يرجى اختيار الزبون وإدخال مبلغ تسديد أكبر من الصفر!', 'warning');
      }

      const cust = this.customersById.get(cid);
      const prevDebt = cust ? Math.max(0, Number(cust.total_debt || 0)) : 0;

      if (prevDebt <= 0.009) {
        return this.notify(`⚠️ الزبون (${cust ? cust.name : cid}) دينه 0.00 د.ج حالياً! سجّل عليه ديناً بـ (Alt+D) أولاً.`, 'warning');
      }

      const effectivePay = Math.min(prevDebt, payAmt);
      const remAfter = Math.max(0, Number((prevDebt - effectivePay).toFixed(2)));

      document.getElementById('v68SettleDebtModal')?.classList.add('hidden');

      try {
        const res = await window.api.addCustomerPayment(cid, effectivePay, new Date().toISOString(), {
          payment_method: 'cash',
          notes: 'تسديد دفعة من حساب الكريدي',
          userId: window.AppState?.currentUser?.id || 1
        });

        const recNum = (res && res.receiptNumber) || ('REC-' + Date.now().toString().slice(-4));

        if (shouldPrint && window.GherbiPrintStudioV45) {
          const studio = window.GherbiPrintStudioV45;
          const docData = studio.enrichDocumentDataWithLoyaltyAndDebt({
            docNumber: recNum,
            date: new Date().toISOString().replace('T', ' ').slice(0, 16),
            customerId: cid,
            partyTitle: 'استلمنا من الزبون الوفي:',
            partyName: cust ? `${cust.name} (${this.getFidCode(cust)})` : `زبون #${cid}`,
            partyPhone: (cust && cust.phone) || '-',
            partyAddress: (cust && cust.address) || '-',
            paymentMethod: 'نقداً (Espèces)',
            previousBalance: prevDebt,
            items: [
              {
                barcode: recNum,
                name: `تسديد دفعة على حساب الكريدي (الدين السابق: ${prevDebt.toFixed(2)} | المدفوع: ${effectivePay.toFixed(2)} | المتبقي: ${remAfter.toFixed(2)} د.ج)`,
                unit: 'دفعة',
                qty: 1,
                price: effectivePay,
                discount: 0,
                tva: 0,
                subtotal: effectivePay
              }
            ],
            subtotal: effectivePay,
            discount: 0,
            tvaAmount: 0,
            stampAmount: 0,
            total: effectivePay,
            paidAmount: effectivePay,
            receivedAmount: effectivePay,
            remainingDebt: remAfter
          });

          const html = await studio.renderAdoptedMasterDocumentHtml('payment_receipt', docData);
          await window.__gherbiMasterPrintSilent({ html, silent: false });
        }

        await this.syncFromSqlite(true);
        this.mountAllPosDebtControls();
        if (!document.getElementById('v68HistoryMasterModal')?.classList.contains('hidden')) {
          this.renderHistoryModalContent();
        }

        this.notify(`✅ تم تسديد (${this.fmtDzd(effectivePay)}) بنجاح — الباقي على الزبون: ${this.fmtDzd(remAfter)}!`);
      } catch (err) {
        this.notify('❌ تعذر تسجيل التسديد: ' + err.message, 'error');
      }
    },

    // ========================================================================
    // 7. نافذة "هيستوريك الديون الشامل والمنظم" (Alt + H)
    // ========================================================================
    async openDebtHistoryModal(custIdFilter = null) {
      await this.syncFromSqlite(true);
      if (custIdFilter) {
        this.historyCustId = String(custIdFilter);
        this.historyTab = 'invoices';
      } else {
        this.historyCustId = 'ALL';
      }

      let modal = document.getElementById('v68HistoryMasterModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'v68HistoryMasterModal';
        modal.style.zIndex = '29890';
        modal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 md:p-5';
        document.body.appendChild(modal);
      }

      modal.classList.remove('hidden');
      this.renderHistoryModalContent();
    },

    renderHistoryModalContent() {
      const modal = document.getElementById('v68HistoryMasterModal');
      if (!modal) return;

      const selCid = this.historyCustId === 'ALL' ? 0 : Number(this.historyCustId || 0);
      const q = (this.historySearch || '').trim().toLowerCase();

      const debtors = this.customers
        .filter((c) => Number(c.total_debt || 0) > 0.009)
        .sort((a, b) => Number(b.total_debt || 0) - Number(a.total_debt || 0));

      const totalDebtAll = debtors.reduce((s, c) => s + Math.max(0, Number(c.total_debt || 0)), 0);

      const creditSales = (this.sales || []).filter((s) => {
        const rem = Number(s.total || 0) - Number(s.paid_amount ?? s.total ?? 0);
        if (rem <= 0.009 && s.payment_method !== 'credit' && s.payment_method !== 'split') return false;
        if (selCid > 0 && Number(s.customer_id) !== selCid) return false;
        if (q && !`${s.doc_number || ''} ${s.customer_name || ''} ${s.total || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });

      const payments = (this.caisseTxs || []).filter((tx) => {
        if (tx.type !== 'debt_payment') return false;
        if (q && !`${tx.description || ''} ${tx.amount || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });

      let bodyHtml = '';

      if (this.historyTab === 'debtors') {
        const list = (selCid > 0 ? this.customers.filter((c) => Number(c.id) === selCid) : debtors).filter(
          (c) => !q || `${c.name || ''} ${c.phone || ''} ${this.getFidCode(c)}`.toLowerCase().includes(q)
        );

        const rows =
          list.length > 0
            ? list
                .map((c) => {
                  const debt = Math.max(0, Number(c.total_debt || 0));
                  const pts = Math.floor(Number(c.loyalty_points || 0));
                  return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-rose-50/30 text-xs">
                      <td class="py-3 px-3 font-black text-slate-900 dark:text-white">👑 ${c.name} <span class="font-mono text-[10.5px] text-blue-600">(${this.getFidCode(c)})</span></td>
                      <td class="py-3 px-3 font-mono text-slate-500">${c.phone || '-'}</td>
                      <td class="py-3 px-3"><span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-[11px]">⭐ ${pts} نقطة</span></td>
                      <td class="py-3 px-3 font-mono font-bold">${this.fmtDzd(c.total_sales)}</td>
                      <td class="py-3 px-3 font-mono font-bold text-emerald-600">${this.fmtDzd(c.total_paid)}</td>
                      <td class="py-3 px-3 font-mono font-black text-sm text-rose-600">${this.fmtDzd(debt)} <div class="text-[10px] text-amber-700">${this.fmtCentimes(debt)}</div></td>
                      <td class="py-3 px-3 text-center">
                        <div class="flex items-center justify-center gap-1 flex-wrap">
                          <button type="button" onclick="window.GherbiDebtV68.openSettleDebtModal(${c.id})" class="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-black text-[11px] cursor-pointer">💵 تسديد (Alt+V)</button>
                          <button type="button" onclick="window.GherbiDebtV68.openDebtHistoryModal(${c.id})" class="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-[11px] cursor-pointer">🛒 فواتيره والسلع</button>
                          <button type="button" onclick="window.GherbiDebtV68.printCustomerStatementNow(${c.id}, '80mm')" class="px-2.5 py-1 rounded-xl bg-slate-900 text-amber-400 font-black text-[11px] cursor-pointer">🧾 كرني 80mm</button>
                          <button type="button" onclick="window.GherbiDebtV68.printCustomerStatementNow(${c.id}, 'a4')" class="px-2 py-1 rounded-xl bg-blue-100 text-blue-900 font-black text-[11px] cursor-pointer">📄 A4</button>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')
            : `<tr><td colspan="7" class="py-10 text-center text-slate-400 font-bold">لا يوجد زبائن مدينون حالياً — اضغط (Alt+D) لتأكيد أول عملية دين!</td></tr>`;

        bodyHtml = `
          <div class="overflow-x-auto max-h-[55vh] rounded-2xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-right border-collapse">
              <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800 text-xs font-black border-b">
                <tr>
                  <th class="py-3 px-3">الزبون الوفي</th>
                  <th class="py-3 px-3">الهاتف</th>
                  <th class="py-3 px-3">نقاط الوفاء</th>
                  <th class="py-3 px-3">إجمالي المشتريات</th>
                  <th class="py-3 px-3">المسدد</th>
                  <th class="py-3 px-3">صافي الدين المتبقي</th>
                  <th class="py-3 px-3 text-center">إجراءات التسديد والفواتير والطباعة</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      } else if (this.historyTab === 'invoices') {
        const rows =
          creditSales.length > 0
            ? creditSales
                .slice(0, 80)
                .map((s) => {
                  const tot = Number(s.total || 0);
                  const paid = Number(s.paid_amount ?? 0);
                  const rem = Math.max(0, Number((tot - paid).toFixed(2)));
                  return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 text-xs">
                      <td class="py-2.5 px-3 font-mono font-black text-blue-600">${s.doc_number || ('#' + s.id)}</td>
                      <td class="py-2.5 px-3 font-mono text-slate-500" dir="ltr">${String(s.sale_date || '').replace('T', ' ').slice(0, 16)}</td>
                      <td class="py-2.5 px-3 font-black">👑 ${s.customer_name || 'زبون'}</td>
                      <td class="py-2.5 px-3 font-mono font-bold">${this.fmtDzd(tot)}</td>
                      <td class="py-2.5 px-3 font-mono font-bold text-emerald-600">${this.fmtDzd(paid)}</td>
                      <td class="py-2.5 px-3 font-mono font-black text-rose-600">${this.fmtDzd(rem)}</td>
                      <td class="py-2.5 px-3 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <button type="button" onclick="window.GherbiDebtV68.toggleSaleItems(${s.id})" class="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-black text-[11px] cursor-pointer">📦 السلع المأخوذة</button>
                          <button type="button" onclick="window.GherbiDebtV68.reprintDebtSale(${s.id}, '80mm')" class="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-black text-[11px] cursor-pointer">🧾 تذكرة 80mm</button>
                          <button type="button" onclick="window.GherbiDebtV68.reprintDebtSale(${s.id}, 'a4')" class="px-2 py-1 rounded-xl bg-blue-600 text-white font-black text-[11px] cursor-pointer">📄 A4</button>
                        </div>
                      </td>
                    </tr>
                    <tr id="v68SaleItemsRow_${s.id}" class="hidden bg-amber-50/50 dark:bg-slate-800">
                      <td colspan="7" class="p-3" id="v68SaleItemsHost_${s.id}"></td>
                    </tr>
                  `;
                })
                .join('')
            : `<tr><td colspan="7" class="py-10 text-center text-slate-400 font-bold">لا توجد فواتير دين مطابقة.</td></tr>`;

        bodyHtml = `
          <div class="overflow-x-auto max-h-[55vh] rounded-2xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-right border-collapse">
              <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800 text-xs font-black border-b">
                <tr>
                  <th class="py-3 px-3">رقم الفاتورة</th>
                  <th class="py-3 px-3">التاريخ والساعة</th>
                  <th class="py-3 px-3">الزبون</th>
                  <th class="py-3 px-3">الإجمالي</th>
                  <th class="py-3 px-3">المدفوع</th>
                  <th class="py-3 px-3">الباقي دين</th>
                  <th class="py-3 px-3 text-center">السلع وطباعة التذكرة</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      } else {
        const rows =
          payments.length > 0
            ? payments
                .slice(0, 80)
                .map(
                  (tx) => `
                  <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
                    <td class="py-2.5 px-3 font-mono font-black text-emerald-600">#REC-${tx.id}</td>
                    <td class="py-2.5 px-3 font-mono text-slate-500" dir="ltr">${String(tx.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                    <td class="py-2.5 px-3 font-black">${tx.description || 'تسديد دفعة دين'}</td>
                    <td class="py-2.5 px-3 font-mono font-black text-emerald-600">+${this.fmtDzd(tx.amount)}</td>
                    <td class="py-2.5 px-3 text-center">
                      <button type="button" onclick="window.GherbiCaisseTurbo ? window.GherbiCaisseTurbo.printSingleCaisseTransactionTicket(${tx.id}) : null" class="px-3 py-1 rounded-xl bg-slate-900 text-white font-black text-[11px] cursor-pointer">🧾 طباعة وصل التسديد 80mm</button>
                    </td>
                  </tr>`
                )
                .join('')
            : `<tr><td colspan="5" class="py-10 text-center text-slate-400 font-bold">لا توجد وصولات تسديد مسجلة بعد.</td></tr>`;

        bodyHtml = `
          <div class="overflow-x-auto max-h-[55vh] rounded-2xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-right border-collapse">
              <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800 text-xs font-black border-b">
                <tr>
                  <th class="py-3 px-3">رقم الوصل</th>
                  <th class="py-3 px-3">التاريخ والتوقيت</th>
                  <th class="py-3 px-3">البيان</th>
                  <th class="py-3 px-3">المبلغ المسدد</th>
                  <th class="py-3 px-3 text-center">طباعة التذكرة</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      }

      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-3xl max-w-6xl w-full p-5 shadow-2xl space-y-4 text-right max-h-[92vh] flex flex-col" dir="rtl">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-mono font-black text-xs">Alt + H</span>
                <h3 class="text-lg font-black text-slate-900 dark:text-white">📜 هيستوريك الديون الشامل، تفاصيل السلع، وطباعة التذاكر</h3>
                <span class="px-3 py-0.5 rounded-full bg-rose-100 text-rose-700 font-black text-xs">${debtors.length} مدين | الإجمالي: ${this.fmtDzd(totalDebtAll)}</span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">🇩🇿 إجمالي الديون بالسنتيم: <strong class="text-amber-600">${this.fmtCentimes(totalDebtAll)}</strong></p>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="document.getElementById('v68HistoryMasterModal').classList.add('hidden'); window.GherbiDebtV68.openConfirmDebtModal()" class="px-3 py-2 rounded-xl bg-rose-600 text-white font-black text-xs cursor-pointer">📝 + تأكيد دين جديد (Alt+D)</button>
              <button type="button" onclick="document.getElementById('v68HistoryMasterModal').classList.add('hidden'); window.GherbiDebtV68.openSettleDebtModal()" class="px-3 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs cursor-pointer">💵 تسديد دين (Alt+V)</button>
              <button type="button" onclick="document.getElementById('v68HistoryMasterModal').classList.add('hidden')" class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 font-black text-xs cursor-pointer">✕ إغلاق</button>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border text-xs">
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" onclick="window.GherbiDebtV68.historyTab='debtors'; window.GherbiDebtV68.renderHistoryModalContent()" class="px-3.5 py-2 rounded-xl font-black cursor-pointer ${this.historyTab === 'debtors' ? 'bg-rose-600 text-white shadow' : 'bg-white dark:bg-slate-900 border'}">👥 1. الزبائن المدينون (${debtors.length})</button>
              <button type="button" onclick="window.GherbiDebtV68.historyTab='invoices'; window.GherbiDebtV68.renderHistoryModalContent()" class="px-3.5 py-2 rounded-xl font-black cursor-pointer ${this.historyTab === 'invoices' ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-slate-900 border'}">🛒 2. فواتير الدين والسلع المأخوذة (${creditSales.length})</button>
              <button type="button" onclick="window.GherbiDebtV68.historyTab='payments'; window.GherbiDebtV68.renderHistoryModalContent()" class="px-3.5 py-2 rounded-xl font-black cursor-pointer ${this.historyTab === 'payments' ? 'bg-emerald-600 text-white shadow' : 'bg-white dark:bg-slate-900 border'}">💵 3. دفعات التسديد والوصولات (${payments.length})</button>
            </div>
            <div class="flex items-center gap-1.5">
              <select onchange="window.GherbiDebtV68.historyCustId=this.value; window.GherbiDebtV68.renderHistoryModalContent()" class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border font-black">
                <option value="ALL">🌐 كل الزبائن</option>
                ${this.customers.map((c) => `<option value="${c.id}" ${String(this.historyCustId) === String(c.id) ? 'selected' : ''}>👑 ${c.name} (${Number(c.total_debt || 0).toFixed(0)} د.ج)</option>`).join('')}
              </select>
              <input id="v68HistSearchInp" type="text" value="${this.historySearch}" oninput="window.GherbiDebtV68.historySearch=this.value; window.GherbiDebtV68.renderHistoryModalContent(); document.getElementById('v68HistSearchInp')?.focus();" placeholder="🔎 بحث..." class="w-48 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border font-bold">
            </div>
          </div>

          <div class="flex-1 overflow-hidden">${bodyHtml}</div>
        </div>
      `;
    },

    async toggleSaleItems(saleId) {
      const row = document.getElementById('v68SaleItemsRow_' + saleId);
      const host = document.getElementById('v68SaleItemsHost_' + saleId);
      if (!row || !host) return;
      if (!row.classList.contains('hidden')) {
        row.classList.add('hidden');
        return;
      }
      row.classList.remove('hidden');
      host.innerHTML = `<div class="text-xs font-bold text-slate-400">⏳ جاري تحميل السلع...</div>`;
      const det = window.api?.getSaleDetails ? await window.api.getSaleDetails(Number(saleId)) : null;
      const items = (det && det.items) || [];
      host.innerHTML =
        items.length > 0
          ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">${items
              .map(
                (it, i) =>
                  `<div class="p-2 rounded-xl bg-white dark:bg-slate-900 border flex justify-between font-bold"><span>${i + 1}. ${it.product_name || it.custom_product_name || 'صنف'} × ${it.quantity}</span><span class="font-mono font-black text-blue-600">${Number(it.subtotal || 0).toFixed(2)} د.ج</span></div>`
              )
              .join('')}</div>`
          : `<div class="text-xs text-slate-400">لا توجد تفاصيل أصناف مسجلة.</div>`;
    },

    async reprintDebtSale(saleId, paperSize = '80mm') {
      const det = window.api?.getSaleDetails ? await window.api.getSaleDetails(Number(saleId)) : null;
      const studio = window.GherbiPrintStudioV45;
      if (!det || !studio) return;
      const docType = paperSize === 'a4' ? 'invoice_a4' : 'pos_partial_credit_80mm';
      const html = await studio.generateAdoptedHtmlForDocument(docType, saleId, det);
      await window.__gherbiMasterPrintSilent({ html, silent: false });
    },

    // ========================================================================
    // 8. نافذة (F8 البطاقة / الزبون الوفي) المطورة التي تعرض النقاط والديون معاً!
    // ========================================================================
    async openF8LoyaltyAndDebtModal() {
      await this.syncFromSqlite(true);
      const activeCust = this.detectActivePosCustomer();

      let modal = document.getElementById('v68F8MasterModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'v68F8MasterModal';
        modal.style.zIndex = '29920';
        modal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4';
        document.body.appendChild(modal);
      }

      const renderCards = (qRaw = '') => {
        const q = String(qRaw || '').trim().toLowerCase();
        const filtered = this.customers.filter(
          (c) => !q || `${c.name || ''} ${c.phone || ''} ${this.getFidCode(c)}`.toLowerCase().includes(q)
        );
        return filtered.length > 0
          ? filtered
              .slice(0, 50)
              .map((c) => {
                const pts = Math.floor(Number(c.loyalty_points || 0));
                const debt = Math.max(0, Number(c.total_debt || 0));
                const isSel = activeCust && Number(activeCust.id) === Number(c.id);
                return `
                  <div class="p-3 rounded-2xl border-2 transition flex flex-wrap items-center justify-between gap-2 text-xs ${
                    isSel ? 'bg-amber-50 dark:bg-slate-800 border-amber-500 shadow' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-500'
                  }">
                    <div class="cursor-pointer flex-1" onclick="window.GherbiDebtV68.chooseCustomerInF8(${c.id})">
                      <div class="font-black text-sm text-slate-900 dark:text-white">👑 ${c.name} <span class="font-mono text-xs text-blue-600">(${this.getFidCode(c)})</span></div>
                      <div class="text-[11px] text-slate-500 mt-0.5">📞 الهاتف: <span class="font-mono">${c.phone || '-'}</span> | إجمالي المشتريات: <span class="font-mono font-bold">${this.fmtDzd(c.total_sales)}</span></div>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                      <div class="px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-400 text-amber-950 text-center">
                        <div class="text-[10px] font-bold">⭐ نقاط الوفاء</div>
                        <div class="font-mono font-black">${pts} نقطة (${pts * 2} د.ج)</div>
                      </div>
                      <div class="px-3 py-1.5 rounded-xl border text-center ${
                        debt > 0.05 ? 'bg-rose-100 border-rose-400 text-rose-900' : 'bg-emerald-100 border-emerald-400 text-emerald-900'
                      }">
                        <div class="text-[10px] font-bold">💳 الديون على الزبون</div>
                        <div class="font-mono font-black">${debt > 0.05 ? this.fmtDzd(debt) : '0.00 د.ج (خالص ✔)'}</div>
                      </div>
                      <div class="flex flex-col gap-1">
                        <button type="button" onclick="window.GherbiDebtV68.chooseCustomerInF8(${c.id})" class="px-3 py-1 rounded-xl bg-blue-600 text-white font-black text-[11px] cursor-pointer">✅ اختيار الزبون</button>
                        <div class="flex gap-1">
                          <button type="button" onclick="document.getElementById('v68F8MasterModal').classList.add('hidden'); window.GherbiDebtV68.chooseCustomerInF8(${c.id}); window.GherbiDebtV68.openConfirmDebtModal()" class="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] cursor-pointer">+ دين</button>
                          <button type="button" onclick="document.getElementById('v68F8MasterModal').classList.add('hidden'); window.GherbiDebtV68.openSettleDebtModal(${c.id})" class="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px] cursor-pointer">💵 تسديد</button>
                          <button type="button" onclick="document.getElementById('v68F8MasterModal').classList.add('hidden'); window.GherbiDebtV68.openDebtHistoryModal(${c.id})" class="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-[10px] cursor-pointer">📜 ديونه</button>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              })
              .join('')
          : `<div class="py-8 text-center text-slate-400 font-bold text-xs">لا يوجد زبون مطابق.</div>`;
      };

      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-4xl w-full p-5 shadow-2xl space-y-4 text-right max-h-[90vh] flex flex-col" dir="rtl">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-mono font-black text-xs">F8</span>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">👑 نافذة الزبون الوفي، رصيد النقاط، ووضعية الديون</h3>
                <p class="text-[11px] text-slate-500">تعرض رصيد نقاط الوفاء وكم يملك كل زبون وفي من ديون بالدينار والسنتيم</p>
              </div>
            </div>
            <button type="button" onclick="document.getElementById('v68F8MasterModal').classList.add('hidden')" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 font-black text-xs cursor-pointer">✕ إغلاق</button>
          </div>

          <input id="v68F8SearchInput" type="text" placeholder="🔎 امسح باركود البطاقة (FID-00003) أو ابحث باسم الزبون..." class="w-full px-4 py-2.5 rounded-2xl bg-amber-50/60 dark:bg-slate-800 border-2 border-amber-400 font-bold text-xs outline-none">

          <div id="v68F8CardsHost" class="space-y-2 overflow-y-auto flex-1 pr-1 max-h-[60vh]">
            ${renderCards('')}
          </div>
        </div>
      `;

      modal.classList.remove('hidden');
      const inp = document.getElementById('v68F8SearchInput');
      if (inp) {
        inp.oninput = (e) => {
          const h = document.getElementById('v68F8CardsHost');
          if (h) h.innerHTML = renderCards(e.target.value);
        };
        setTimeout(() => inp.focus(), 40);
      }
    },

    chooseCustomerInF8(cid) {
      const id = Number(cid);
      window.__gherbiActivePosCustomerId = id;
      document.getElementById('v68F8MasterModal')?.classList.add('hidden');
      const sel = document.getElementById('posCustomerSelect');
      if (sel) {
        sel.value = String(id);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      this.mountAllPosDebtControls();
      const cust = this.customersById.get(id);
      if (cust) {
        this.notify(`👑 تم اختيار الزبون الوفي: ${cust.name} (الديون: ${this.fmtDzd(cust.total_debt)})`);
      }
    }
  };

  window.GherbiDebtV68 = DebtEngineV68;

  // ==========================================================================
  // 9. تفويض نقرات شامل (Global Click Delegation) + اختصارات لوحة المفاتيح (Alt+D / Alt+V / Alt+H / F8)
  //    يضمن أن الضغط على أي زر من الأزرار الجديدة يعمل في 100% من الحالات!
  // ==========================================================================
  if (!window._v68EventsInstalled) {
    window._v68EventsInstalled = true;

    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest('[data-v68-action]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const act = btn.getAttribute('data-v68-action');
        if (act === 'confirm-debt') DebtEngineV68.openConfirmDebtModal();
        else if (act === 'settle-debt') DebtEngineV68.openSettleDebtModal();
        else if (act === 'history-debt') DebtEngineV68.openDebtHistoryModal();
        else if (act === 'open-f8') DebtEngineV68.openF8LoyaltyAndDebtModal();
      },
      true
    );

    window.addEventListener(
      'keydown',
      (e) => {
        const key = String(e.key || '').toLowerCase();

        if ((e.altKey || e.ctrlKey) && (key === 'd' || e.code === 'KeyD')) {
          e.preventDefault();
          e.stopImmediatePropagation();
          DebtEngineV68.openConfirmDebtModal();
          return;
        }
        if (e.altKey && !e.ctrlKey && (key === 'v' || e.code === 'KeyV')) {
          e.preventDefault();
          e.stopImmediatePropagation();
          DebtEngineV68.openSettleDebtModal();
          return;
        }
        if ((e.altKey && (key === 'h' || e.code === 'KeyH')) || (e.ctrlKey && (key === 'k' || e.code === 'KeyK'))) {
          e.preventDefault();
          e.stopImmediatePropagation();
          DebtEngineV68.openDebtHistoryModal();
          return;
        }
        if (e.key === 'F8') {
          e.preventDefault();
          e.stopImmediatePropagation();
          DebtEngineV68.openF8LoyaltyAndDebtModal();
          return;
        }
      },
      true
    );
  }

  // التشغيل الدوري الخفيف لضمان بقاء الأزرار وشارة الديون حية دائماً في شاشة الكاشير
  const bootTimer = setInterval(() => {
    if (!window.App) return;
    clearInterval(bootTimer);

    DebtEngineV68.syncFromSqlite(true).then(() => {
      DebtEngineV68.mountAllPosDebtControls();
    });

    setInterval(() => {
      if (document.getElementById('view-pos')?.classList.contains('active')) {
        DebtEngineV68.mountAllPosDebtControls();
      }
    }, 900);

    console.log('🏆 [Gherbi V68 Direct DOM & SQLite Debt Engine]: جميع أزرار الديون (Alt+D / Alt+V / Alt+H / F8) وعداد ديون الزبون الوفي تعمل بالربط المباشر 100%!');
  }, 150);
})();

/* ==================== [V69 STAGE 1: KARNET 80MM & A4 DIRECT PRINT & PREVIEW ENGINE] ==================== */
(function initV69Stage1KarnetAndA4PrintEngine() {
  const waitEngine = setInterval(() => {
    const debtEng = window.GherbiDebtV68;
    const studio = window.GherbiPrintStudioV45;
    if (!debtEng || !studio || !window.App) return;
    clearInterval(waitEngine);

    // ========================================================================
    // الدالة الحاسمة لطباعة ومعاينة (🧾 كرني 80mm) و (📄 كشف حساب A4) لأي زبون مدين
    // تعمل فوراً من نافذة هيستوريك الديون (Alt+H) ومن شريط الزبون ومن (F8)
    // ========================================================================
    debtEng.printCustomerStatementNow = async function (customerId, format = '80mm', directPrint = false) {
      const cid = Number(customerId || 0);
      if (!cid) {
        return this.notify('⚠️ يرجى تحديد الزبون أولاً لطباعة كشف الديون.', 'warning');
      }

      await this.syncFromSqlite(true);
      const cust = this.customersById.get(cid);
      if (!cust) {
        return this.notify('❌ لم يتم العثور على بيانات الزبون.', 'error');
      }

      // جلب جميع فواتير الزبون وتفاصيل السلع بداخلها لبناء كشف حساب وكرني حقيقي 100%
      const custSales = window.api?.getCustomerSales
        ? await window.api.getCustomerSales(cid)
        : (this.sales || []).filter((s) => Number(s.customer_id) === cid);

      const totalSalesVal = Number(cust.total_sales || 0);
      const totalPaidVal = Number(cust.total_paid || 0);
      const netDebtVal = Math.max(0, Number(cust.total_debt || 0));
      const initDebtVal = Math.max(0, Number(cust.initial_debt || 0) - Number(cust.initial_debt_paid || 0));
      const pts = Math.floor(Number(cust.loyalty_points || 0));
      const fid = this.getFidCode(cust);

      // بناء بنود الكرني / الكشف من فواتير الزبون الفعلية
      const statementItems = [];
      if (initDebtVal > 0.009) {
        statementItems.push({
          barcode: 'INIT-DEBT',
          name: 'رصيد دين أولي سابق مسجل على الحساب',
          unit: 'رصيد',
          qty: 1,
          quantity: 1,
          price: initDebtVal,
          discount: 0,
          tva: 0,
          subtotal: initDebtVal
        });
      }

      const relevantSales = Array.isArray(custSales) ? custSales.slice(0, 35) : [];
      for (const s of relevantSales) {
        const tot = Number(s.total || 0);
        const paid = Number(s.paid_amount ?? tot);
        const rem = Math.max(0, Number((tot - paid).toFixed(2)));
        const dtStr = String(s.sale_date || s.created_at || '').replace('T', ' ').slice(0, 16);

        // جلب أسماء السلع داخل فواتير الدين لعرضها في الكشف
        let itemsSummaryTxt = '';
        if (rem > 0.009 && window.api?.getSaleDetails) {
          try {
            const det = await window.api.getSaleDetails(Number(s.id));
            if (det && Array.isArray(det.items) && det.items.length > 0) {
              itemsSummaryTxt =
                ' — السلع: [' +
                det.items
                  .map((it) => `${it.product_name || it.custom_product_name || 'صنف'}×${it.quantity}`)
                  .join(' + ') +
                ']';
            }
          } catch (_) {}
        }

        statementItems.push({
          barcode: s.doc_number || ('#' + s.id),
          name: `فاتورة (${dtStr}) — الإجمالي: ${tot.toFixed(2)} | المدفوع: ${paid.toFixed(2)} | الباقي دين: ${rem.toFixed(2)} د.ج${itemsSummaryTxt}`,
          unit: rem > 0.009 ? 'دين قائم' : 'مسددة ✔',
          qty: 1,
          quantity: 1,
          price: tot,
          discount: 0,
          tva: 0,
          subtotal: rem > 0.009 ? rem : tot
        });
      }

      if (statementItems.length === 0) {
        statementItems.push({
          barcode: fid,
          name: `وضعية حساب الزبون الوفي (${cust.name}) — صافي الدين الحالي: ${netDebtVal.toFixed(2)} د.ج`,
          unit: 'حساب',
          qty: 1,
          quantity: 1,
          price: netDebtVal,
          discount: 0,
          tva: 0,
          subtotal: netDebtVal
        });
      }

      const targetDocType = format === 'a4' ? 'customer_ledger_a4' : 'customer_carnet_80mm';
      const targetPaper = format === 'a4' ? 'a4' : '80mm';

      const docData = studio.enrichDocumentDataWithLoyaltyAndDebt({
        docNumber: `CARNET-${fid}-${new Date().toISOString().slice(0, 10)}`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        customerId: cid,
        isWalkinCustomer: false,
        partyTitle: 'الزبون الوفي صاحب الكرني:',
        partyName: `👑 ${cust.name} (${fid})`,
        partyPhone: cust.phone || '-',
        partyAddress: `${cust.address || 'الجزائر'} | ⭐ نقاط الوفاء: ${pts} نقطة (${pts * 2} د.ج)`,
        partyRc: cust.rc || '-',
        partyNif: cust.nif || '-',
        paymentMethod: `إجمالي المشتريات: ${this.fmtDzd(totalSalesVal)} | المسدد: ${this.fmtDzd(totalPaidVal)}`,
        previousBalance: initDebtVal,
        loyaltyPointsEarned: 0,
        loyaltyTotalBalance: pts,
        items: statementItems,
        subtotal: totalSalesVal,
        discount: 0,
        tvaAmount: 0,
        stampAmount: 0,
        total: totalSalesVal,
        paidAmount: totalPaidVal,
        receivedAmount: totalPaidVal,
        remainingDebt: netDebtVal
      });

      if (directPrint) {
        const fullHtml = await studio.renderAdoptedMasterDocumentHtml(targetDocType, docData, {
          paperSize: targetPaper
        });
        await window.__gherbiMasterPrintSilent({ html: fullHtml, paperSize: targetPaper, silent: false });
        this.notify(`🖨️ تم إرسال (${format === 'a4' ? 'كشف الحساب A4' : 'كرني الديون 80mm'}) للزبون (${cust.name}) إلى الطباعة!`);
        return;
      }

      // فتح نافذة معاينة وطباعة فورية فائقة الوضوح (تظهر فوق نافذة Alt+H بـ z-index: 32000)
      this.openKarnetLivePreviewModal(cust, docData, format);
    };

    debtEng.openKarnetLivePreviewModal = async function (cust, docData, format = '80mm') {
      this._activeKarnetCust = cust;
      this._activeKarnetDocData = docData;
      this._activeKarnetFormat = format || '80mm';

      let modal = document.getElementById('v69KarnetPreviewModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'v69KarnetPreviewModal';
        modal.style.zIndex = '32000';
        modal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 md:p-5';
        document.body.appendChild(modal);
      }

      await this.renderKarnetPreviewModalBody();
      modal.classList.remove('hidden');
    };

    debtEng.renderKarnetPreviewModalBody = async function () {
      const modal = document.getElementById('v69KarnetPreviewModal');
      const cust = this._activeKarnetCust;
      const docData = this._activeKarnetDocData;
      const fmt = this._activeKarnetFormat || '80mm';
      if (!modal || !cust || !docData) return;

      const docType = fmt === 'a4' ? 'customer_ledger_a4' : 'customer_carnet_80mm';
      const savedProf = studio.config.adoptedProfiles?.[docType] || {};
      const savedDef = studio.config.defaultsByDocType?.[docType] || {};

      // ضمان تفعيل طبقة كشف حساب الكريدي وجدول الأصناف في المعاينة
      const previewPaperHtml = studio.buildLiveDocumentPaperHtml(docData, false, {
        ...savedProf,
        activeDocType: docType,
        paperSize: fmt === 'a4' ? 'a4' : '80mm',
        themeId: savedDef.themeId || savedProf.themeId || (fmt === 'a4' ? 'royal_blue' : 'crimson_bold'),
        zoomPct: fmt === 'a4' ? 88 : 100
      });

      const debtVal = Math.max(0, Number(cust.total_debt || 0));

      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-3xl max-w-5xl w-[95vw] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right" dir="rtl">
          <div class="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-xs">${fmt.toUpperCase()}</span>
                <h3 class="text-base font-black">
                  ${fmt === 'a4' ? '📄 معاينة وطباعة كشف حساب الزبون المفصل (A4)' : '🧾 معاينة وطباعة تذكرة كرني ديون الزبون (80mm)'} — ${cust.name}
                </h3>
              </div>
              <p class="text-xs text-slate-300 mt-0.5">
                إجمالي المشتريات: <strong>${this.fmtDzd(cust.total_sales)}</strong> | المسدد: <strong class="text-emerald-400">${this.fmtDzd(cust.total_paid)}</strong> | صافي الدين المتبقي: <strong class="text-rose-400">${this.fmtDzd(debtVal)} (${this.fmtCentimes(debtVal)})</strong>
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" onclick="window.GherbiDebtV68.switchKarnetPreviewFormat('80mm')" class="px-3 py-2 rounded-xl font-black text-xs cursor-pointer ${
                fmt === '80mm' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }">
                🧾 تذكرة كرني 80mm
              </button>
              <button type="button" onclick="window.GherbiDebtV68.switchKarnetPreviewFormat('a4')" class="px-3 py-2 rounded-xl font-black text-xs cursor-pointer ${
                fmt === 'a4' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }">
                📄 كشف مفصل A4
              </button>
              <button type="button" onclick="window.GherbiDebtV68.executePrintFromKarnetPreview()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg cursor-pointer flex items-center gap-1.5">
                <span>🖨️ طباعة / حفظ PDF الآن</span>
              </button>
              <button type="button" onclick="document.getElementById('v69KarnetPreviewModal').classList.add('hidden'); document.getElementById('v68HistoryMasterModal')?.classList.add('hidden'); window.GherbiPrintStudioV45.customizeCardInStudioNow('${docType}')" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer">
                🎨 تخصيص القالب في مركز الطباعة ⬅
              </button>
              <button type="button" onclick="document.getElementById('v69KarnetPreviewModal').classList.add('hidden')" class="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer">
                ✕ إغلاق
              </button>
            </div>
          </div>

          <div class="px-4 py-2 bg-amber-50 dark:bg-slate-800 border-b border-amber-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <span class="font-black text-amber-900 dark:text-amber-300">✍️ ملاحظة: جميع النصوص داخل الورقة بالأسفل قابلة للتعديل الحر المباشر قبل الطباعة!</span>
            <span class="font-mono font-bold text-slate-500">القالب المعتمد: ${docType}</span>
          </div>

          <div class="v45-studio-workspace flex-1 overflow-y-auto" id="v69KarnetPaperHost">
            ${previewPaperHtml}
          </div>
        </div>
      `;
    };

    debtEng.switchKarnetPreviewFormat = async function (newFmt) {
      this._activeKarnetFormat = newFmt || '80mm';
      await this.renderKarnetPreviewModalBody();
    };

    debtEng.executePrintFromKarnetPreview = async function () {
      const paperEl = document.querySelector('#v69KarnetPaperHost .v45-live-paper');
      if (!paperEl) return;
      const clone = paperEl.cloneNode(true);
      clone.querySelectorAll('.v45-layer-handle-bar').forEach((el) => el.remove());
      clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
      clone.style.transform = 'none';

      const fmt = this._activeKarnetFormat || '80mm';
      const isThermal = fmt === '80mm' || fmt === '58mm';
      const pageCss = isThermal
        ? `@page { size: 80mm auto; margin: 2mm; }`
        : `@page { size: A4 portrait; margin: 8mm; }`;

      const html = `<!DOCTYPE html><html lang="ar" dir="rtl" data-v52-studio-master="1" data-v62-adopted-doc="customer_carnet"><head><meta charset="UTF-8"><style>
        ${pageCss}
        * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 0; font-family: 'Cairo', Tahoma, sans-serif; color: #0f172a; background: #fff; }
        .v45-live-paper { box-shadow: none !important; margin: 0 auto !important; width: ${isThermal ? '76mm' : '100%'} !important; min-height: auto !important; }
        .v45-canvas-layer { border: none !important; box-shadow: none !important; }
      </style></head><body>${clone.outerHTML}</body></html>`;

      await window.__gherbiMasterPrintSilent({ html, paperSize: fmt, silent: false });
    };

    // توفير الجسر العام window.GherbiCustomersTurbo لضمان عمل أي زر في أي نافذة يستدعي printCustomerStatement
    window.GherbiCustomersTurbo = window.GherbiCustomersTurbo || {};
    window.GherbiCustomersTurbo.printCustomerStatement = (cid, fmt) =>
      debtEng.printCustomerStatementNow(cid, fmt, false);
    window.GherbiCustomersTurbo.openFastPaymentModal = (cid) =>
      debtEng.openSettleDebtModal(cid);
    window.GherbiCustomersTurbo.openRichCustomerLedger = (cid) =>
      debtEng.openDebtHistoryModal(cid);

    console.log('🏆 [Gherbi V69 Stage 1]: تم تفعيل زري (🧾 كرني 80mm) و (📄 A4) والربط المحاسبي للديون في الورديات بنجاح 100%!');
  }, 140);
})();

/* ==================== [V70 PART 1: CLEAN-ROOM MASTER TEMPLATES 1 TO 20 (POS & CREDIT)] ==================== */
(function initV70Part1Templates1To20() {
  window.__GHERBI_V70_MASTER_TEMPLATES_PART1 = [
    // ========================================================================
    // المجموعة 1: المبيعات والكاشير والتوصيل والضمان (9 مستندات احترافية #1 .. #9)
    // ========================================================================
    {
      id: 'receipt_thermal',
      num: 1,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '🧾 1. تذكرة كاشير حرارية شاملة (80mm / 58mm)',
      cleanTitle: 'تذكرة مبيعات الكاشير / Ticket de Caisse',
      defaultPaper: '80mm',
      defaultTheme: 'executive_dark',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات والكاشير (Échap / F1)',
      proDesc: 'تذكرة سوبرماركت حرارية متكاملة تعرض الأصناف، المجموع بالدينار والسنتيم، الصرف المرجع، وبطاقة نقاط الوفاء ووضعية الدين',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'totals_words_layer',
        'payment_breakdown_layer',
        'f8_vip_points_and_debt_dual_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'TIC-2026-0150',
      samplePartyTitle: 'الزبون الوفي:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003)',
      samplePaymentMethod: 'نقداً (Espèces)',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي (ULTRA JOY)', unit: 'علبة', qty: 2, price: 75, discount: 0, tva: 0, subtotal: 150 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 قطعة (JOY 72)', unit: 'كيس', qty: 1, price: 145, discount: 0, tva: 0, subtotal: 145 }
      ],
      sampleTotal: 295,
      samplePaid: 295,
      samplePrevDebt: 270
    },
    {
      id: 'invoice_a4',
      num: 2,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '📄 2. فاتورة مبيعات تجارية رسمية (A4)',
      cleanTitle: 'فاتورة مبيعات تجارية رسمية / Facture Commerciale',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'sales',
      sourceLabel: 'شاشة المبيعات + سجل المبيعات والضمان',
      proDesc: 'فاتورة مؤسسات رسمية كاملة بالبيانات الجبائية (RC/NIF/AI/NIS)، جدول مفصل، التفقيط بالحروف، كشف الرصيد، والختم الرسمي',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'totals_words_layer',
        'debt_ledger_layer',
        'bank_rip_ccp_box_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: true, tva: false, subtotal: true },
      sampleDocNum: 'FAC-2026-0150',
      samplePartyTitle: 'الزبون / المؤسسة:',
      samplePartyName: 'مؤسسة الأمل للتجارة والتوزيع (أمين بن يحيى)',
      samplePaymentMethod: 'نقداً / بشيك بنكي',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (Elio Cevital)', unit: 'قارورة', qty: 10, price: 650, discount: 0, tva: 19, subtotal: 6500 },
        { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (Candia)', unit: 'كرتونة', qty: 5, price: 1800, discount: 0, tva: 19, subtotal: 9000 },
        { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (Bonal)', unit: 'علبة', qty: 10, price: 320, discount: 0, tva: 19, subtotal: 3200 }
      ],
      sampleTotal: 18700,
      samplePaid: 18700,
      samplePrevDebt: 0
    },
    {
      id: 'invoice_a5',
      num: 3,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '📑 3. فاتورة مبيعات مدمجة نصفية (A5)',
      cleanTitle: 'فاتورة مبيعات مدمجة / Bon & Facture A5',
      defaultPaper: 'a5',
      defaultTheme: 'emerald_dz',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات والكاشير',
      proDesc: 'فاتورة نصف ورقة أنيقة وسريعة لتجارة التجزئة ونصف الجملة مع وضعية الدين السابق والباقي',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'totals_words_layer',
        'debt_ledger_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'FA5-2026-0089',
      samplePartyTitle: 'الزبون:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003)',
      samplePaymentMethod: 'نقداً (Espèces)',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي جوي', unit: 'علبة', qty: 4, price: 75, discount: 0, tva: 0, subtotal: 300 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 قطعة', unit: 'كيس', qty: 2, price: 145, discount: 0, tva: 0, subtotal: 290 }
      ],
      sampleTotal: 590,
      samplePaid: 590,
      samplePrevDebt: 270
    },
    {
      id: 'invoice_2xa5',
      num: 4,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '✂️ 4. فاتورة مزدوجة (2×A5 في ورقة A4 — نسختان)',
      cleanTitle: 'فاتورة مبيعات (نسخة الزبون + نسخة الأرشيف)',
      defaultPaper: '2xa5',
      defaultTheme: 'royal_blue',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات (توفير 50% من ورق A4)',
      proDesc: 'تطبع نسختين متطابقتين جنباً إلى جنب في ورقة A4 واحدة بالعرض (نسخة للزبون ونسخة يوقع عليها للمحل)',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'totals_words_layer',
        'debt_ledger_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'F2A5-2026-0042',
      samplePartyTitle: 'الزبون:',
      samplePartyName: 'مؤسسة الأمل للتجارة',
      samplePaymentMethod: 'نقداً',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر', unit: 'قارورة', qty: 4, price: 650, discount: 0, tva: 0, subtotal: 2600 },
        { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ', unit: 'علبة', qty: 5, price: 320, discount: 0, tva: 0, subtotal: 1600 }
      ],
      sampleTotal: 4200,
      samplePaid: 4200,
      samplePrevDebt: 0
    },
    {
      id: 'delivery_note',
      num: 5,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '🚚 5. وصل تسليم وتوصيل بضاعة (Bon de Livraison BL)',
      cleanTitle: 'وصل تسليم ونقل بضاعة / Bon de Livraison (BL)',
      defaultPaper: 'a4',
      defaultTheme: 'emerald_dz',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات والتوصيل',
      proDesc: 'يركز على الأصناف والكميات وملخص الكراتين (Colisage) وبيانات السائق والمركبة وخانات إمضاء المسلّم والمستلم',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'pack_carton_summary_layer',
        'delivery_driver_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: false, discount: false, tva: false, subtotal: false },
      sampleDocNum: 'BL-2026-0061',
      samplePartyTitle: 'المرسل إليه (الزبون):',
      samplePartyName: 'مؤسسة الأمل للتجارة — قسنطينة',
      samplePaymentMethod: 'تسليم بضاعة مطابقة للمواصفات',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (صندوق 4 قارورات)', unit: 'صندوق', qty: 15, price: 2600, discount: 0, tva: 0, subtotal: 39000 },
        { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (كرتونة 12 علبة)', unit: 'كرتونة', qty: 20, price: 1800, discount: 0, tva: 0, subtotal: 36000 }
      ],
      sampleTotal: 75000,
      samplePaid: 75000,
      samplePrevDebt: 0
    },
    {
      id: 'proforma',
      num: 6,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '📋 6. فاتورة شكلية / عرض سعر (Facture Proforma)',
      cleanTitle: 'فاتورة شكلية (عرض سعر رسمي) / Facture Proforma',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'proformas',
      sourceLabel: 'الفواتير الشكلية وعروض الأسعار',
      proDesc: 'عرض سعر رسمي للشركات والإدارات مع تفصيل المبلغ خارج الرسم HT وضريبة TVA والحساب البنكي RIB/RIP ومدة الصلاحية',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'tax_ifu_breakdown_layer',
        'totals_words_layer',
        'bank_rip_ccp_box_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: true, subtotal: true },
      sampleDocNum: 'PRO-2026-0024',
      samplePartyTitle: 'الجهة الطالبة للعرض:',
      samplePartyName: 'مديرية الخدمات الجامعية — قسنطينة',
      samplePaymentMethod: 'عرض سعر صالح لمدة 15 يوماً',
      sampleItems: [
        { barcode: '6130001000012', name: 'تموين مواد غذائية أساسية (زيت مائدة 5 لتر)', unit: 'قارورة', qty: 50, price: 650, discount: 0, tva: 19, subtotal: 32500 },
        { barcode: '6130008000022', name: 'كسكس ماما ممتاز 1 كغ', unit: 'كيس', qty: 100, price: 160, discount: 0, tva: 19, subtotal: 16000 }
      ],
      sampleTotal: 48500,
      samplePaid: 0,
      samplePrevDebt: 0
    },
    {
      id: 'customer_order',
      num: 7,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '📦 7. سند طلبية زبون وحجز مخزون (Bon de Commande)',
      cleanTitle: 'سند طلبية زبون وحجز بضاعة / Bon de Commande (BC)',
      defaultPaper: 'a4',
      defaultTheme: 'amber_gold',
      sourcePage: 'orders',
      sourceLabel: 'طلبيات الزبائن',
      proDesc: 'يوثق الأصناف المحجوزة للزبون في المخزن، مبلغ العربون المدفوع (Acompte)، والباقي المستحق عند التسليم',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'order_reservation_layer',
        'totals_words_layer',
        'delivery_driver_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'BC-2026-0033',
      samplePartyTitle: 'الزبون صاحب الطلبية:',
      samplePartyName: 'فارس بوزيد (طلبية محجوزة بالمخزن)',
      samplePaymentMethod: 'عربون مسبق (6,000 د.ج) + الباقي عند التسليم',
      sampleItems: [
        { barcode: '6130007000030', name: 'شوكولاتة الطلاء ماكسون 350غ (كرتونة 24 علبة)', unit: 'كرتونة', qty: 2, price: 8000, discount: 0, tva: 0, subtotal: 16000 }
      ],
      sampleTotal: 16000,
      samplePaid: 6000,
      samplePrevDebt: 0
    },
    {
      id: 'credit_note',
      num: 8,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: "↩️ 8. إشعار دائن / فاتورة مرتجع مبيعات (Facture d'Avoir)",
      cleanTitle: "إشعار دائن (مرتجع مبيعات) / Facture d'Avoir",
      defaultPaper: 'a4',
      defaultTheme: 'crimson_bold',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات والمرتجعات',
      proDesc: 'وثيقة محاسبية رسمية لإرجاع بضاعة من الزبون وتخفيض دينه أو رد قيمتها نقداً مع ذكر سبب الإرجاع',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'totals_words_layer',
        'debt_ledger_layer',
        'return_policy_box_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'AV-2026-0012',
      samplePartyTitle: 'الزبون المستفيد من الإشعار:',
      samplePartyName: '👑 أمين بن يحيى (إرجاع من الفاتورة #91)',
      samplePaymentMethod: 'خصم مباشر من رصيد دين الزبون',
      sampleItems: [
        { barcode: '6130006000017', name: 'مرتجع سليم للمخزن: غولد لاين (GOLD LINE)', unit: 'قطعة', qty: 1, price: 125, discount: 0, tva: 0, subtotal: 125 }
      ],
      sampleTotal: 125,
      samplePaid: 125,
      samplePrevDebt: 270
    },
    {
      id: 'warranty_cert',
      num: 9,
      cat: 'POS',
      catLabel: '🧾 المبيعات والكاشير (9)',
      name: '🛡️ 9. شهادة ضمان رسمية (Certificat de Garantie)',
      cleanTitle: 'شهادة ضمان رسمية ومعتمدة / Certificat de Garantie',
      defaultPaper: 'a5',
      defaultTheme: 'royal_blue',
      sourcePage: 'sales',
      sourceLabel: 'سجل المبيعات والضمان',
      proDesc: 'شهادة ضمان مختومة تتضمن الرقم التسلسلي (IMEI / S-N)، تاريخ بداية ونهاية الضمان، وشروط الصيانة والاستبدال',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'warranty_imei_layer',
        'return_policy_box_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: false, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'GAR-2026-0077',
      samplePartyTitle: 'المستفيد من الضمان:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003)',
      samplePaymentMethod: 'ضمان رسمي لمدة 12 شهراً',
      sampleItems: [
        { barcode: 'SN-869412005478', name: 'جهاز إلكتروني / كهرومنزلي — مشمول بضمان المصنع لمدة 12 شهراً', unit: 'جهاز', qty: 1, price: 14500, discount: 0, tva: 0, subtotal: 14500 }
      ],
      sampleTotal: 14500,
      samplePaid: 14500,
      samplePrevDebt: 0
    },

    // ========================================================================
    // المجموعة 2: منظومة الديون والكريدي والزبون الوفي المحدثة (11 مستنداً #10 .. #20)
    // مصممة خصيصاً لأزرار (Alt+D تأكيد الدين | Alt+V تسديد الديون | Alt+H الهيستوريك | F8 النقاط والديون)
    // ========================================================================
    {
      id: 'debt_confirm_ticket_80mm',
      num: 10,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '📝 10. تذكرة تأكيد عملية دين جديد (Alt+D — 80mm)',
      cleanTitle: 'وصل تأكيد عملية بيع بالدين / Confirmation de Crédit (Alt+D)',
      defaultPaper: '80mm',
      defaultTheme: 'crimson_bold',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات — زر تأكيد عملية الدين (Alt+D)',
      proDesc: 'تذكرة حرارية فورية توثق السلع المأخوذة بالدين، الدين السابق، المدفوع اليوم، وإجمالي الدين التراكمي الجديد بالسنتيم مع إمضاء الزبون',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'alt_d_debt_confirmation_box_layer',
        'credit_carnet_layer',
        'f8_vip_points_and_debt_dual_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'CRED-2026-0115',
      samplePartyTitle: 'الزبون الوفي المدين:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003) — 📞 0550112233',
      samplePaymentMethod: 'تأكيد عملية دين على الحساب (Alt+D)',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي جوي (ULTRA JOY)', unit: 'علبة', qty: 2, price: 75, discount: 0, tva: 0, subtotal: 150 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 قطعة', unit: 'كيس', qty: 1, price: 145, discount: 0, tva: 0, subtotal: 145 }
      ],
      sampleTotal: 295,
      samplePaid: 25,
      samplePrevDebt: 0
    },
    {
      id: 'pos_partial_credit_80mm',
      num: 11,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '💸 11. تذكرة بيع بالدفع الجزئي والباقي دين (Alt+D — 80mm)',
      cleanTitle: 'وصل بيع (دفع جزئي + الباقي مسجل في الدين)',
      defaultPaper: '80mm',
      defaultTheme: 'crimson_bold',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات — دفع جزئي والباقي دين (Alt+D)',
      proDesc: 'تبرز بوضوح السلع المشتراة اليوم، المبلغ المدفوع نقداً للكاشير، والباقي المضاف تلقائياً إلى كرني ديون الزبون الوفي',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'alt_d_debt_confirmation_box_layer',
        'credit_carnet_layer',
        'totals_words_layer',
        'f8_vip_points_and_debt_dual_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'PART-2026-0094',
      samplePartyTitle: 'الزبون الوفي:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003)',
      samplePaymentMethod: 'دفع جزئي (100.00 د.ج) + الباقي دين (195.00 د.ج)',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي جوي', unit: 'علبة', qty: 2, price: 75, discount: 0, tva: 0, subtotal: 150 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 قطعة', unit: 'كيس', qty: 1, price: 145, discount: 0, tva: 0, subtotal: 145 }
      ],
      sampleTotal: 295,
      samplePaid: 100,
      samplePrevDebt: 75
    },
    {
      id: 'payment_receipt',
      num: 12,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '💵 12. وصل تسديد وقبض دين زبون (Alt+V — 80mm / A5)',
      cleanTitle: 'وصل استلام دفعة تسديد دين / Reçu de Règlement (Alt+V)',
      defaultPaper: '80mm',
      defaultTheme: 'emerald_dz',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات — زر تسديد الديون (Alt+V) + الزبائن',
      proDesc: 'يوثق المبلغ المقبوض من الزبون، الدين السابق قبل التسديد، وصافي الدين المتبقي بعد الدفعة بالدينار والسنتيم',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'alt_v_debt_settlement_voucher_layer',
        'items_table_layer',
        'credit_carnet_layer',
        'totals_words_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'REC-2026-0118',
      samplePartyTitle: 'استلمنا من الزبون الوفي:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003) — 📞 0550112233',
      samplePaymentMethod: 'دفعة نقدية لتسديد الدين (Alt+V)',
      sampleItems: [
        { barcode: 'REC-118', name: 'دفعة تسديد نقدية مخصومة من حساب الكريدي (الدين قبل الدفع: 370.00 | المدفوع: 100.00 | المتبقي: 270.00 د.ج)', unit: 'تسديد', qty: 1, price: 100, discount: 0, tva: 0, subtotal: 100 }
      ],
      sampleTotal: 100,
      samplePaid: 100,
      samplePrevDebt: 370
    },
    {
      id: 'customer_carnet_80mm',
      num: 13,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '🧾 13. تذكرة كرني ديون الزبون الوفي (كرني 80mm — Alt+H)',
      cleanTitle: 'تذكرة كرني ديون الزبون الوفي / Carnet de Crédit 80mm',
      defaultPaper: '80mm',
      defaultTheme: 'crimson_bold',
      sourcePage: 'pos',
      sourceLabel: 'هيستوريك الديون (Alt+H) — زر (🧾 كرني 80mm)',
      proDesc: 'تذكرة حرارية سريعة تلخص للزبون إجمالي مشترياته، إجمالي ما سدده، وصافي الدين المتبقي عليه بالدينار والسنتيم مع قائمة فواتيره',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'credit_carnet_layer',
        'items_table_layer',
        'f8_vip_points_and_debt_dual_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'CARNET-FID-00003',
      samplePartyTitle: 'صاحب الكرني (الزبون الوفي):',
      samplePartyName: '👑 أمين بن يحيى (FID-00003) — 📞 0550112233',
      samplePaymentMethod: 'إجمالي المشتريات: 22,952.20 د.ج | المسدد: 22,682.20 د.ج',
      sampleItems: [
        { barcode: 'FAC-089', name: 'فاتورة دين (2026-11-16) — السلع: [حفاضات جوي 72 ×1 + مناديل ×2]', unit: 'دين قائم', qty: 1, price: 295, discount: 0, tva: 0, subtotal: 270 }
      ],
      sampleTotal: 270,
      samplePaid: 0,
      samplePrevDebt: 270
    },
    {
      id: 'customer_ledger_a4',
      num: 14,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '📄 14. كشف حساب وديون الزبون المفصل (كشف A4 — Alt+H)',
      cleanTitle: 'كشف حساب وديون الزبون المفصل / Relevé de Compte Client A4',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'pos',
      sourceLabel: 'هيستوريك الديون (Alt+H) — زر (📄 A4) + الزبائن',
      proDesc: 'تقرير A4 محاسبي رسمي يعرض كافة فواتير الزبون ودفعات التسديد وإجمالي المشتريات والمسدد وصافي الدين المتبقي بالسنتيم',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'debt_ledger_layer',
        'items_table_layer',
        'totals_words_layer',
        'bank_rip_ccp_box_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'REL-2026-0003',
      samplePartyTitle: 'كشف حساب الزبون الوفي:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003) — 📞 0550112233',
      samplePaymentMethod: 'إجمالي المشتريات: 22,952.20 د.ج | المسدد: 22,682.20 د.ج | الباقي: 270.00 د.ج',
      sampleItems: [
        { barcode: 'FAC-071', name: 'فاتورة مبيعات رقم #71 بتاريخ 2026-11-12 (مسددة بالكامل)', unit: 'مسددة ✔', qty: 1, price: 22657.2, discount: 0, tva: 0, subtotal: 0 },
        { barcode: 'FAC-091', name: 'فاتورة بيع بالدين رقم #91 بتاريخ 2026-11-17 (الإجمالي: 295.00 | المدفوع: 25.00 | الباقي: 270.00 د.ج)', unit: 'دين قائم', qty: 1, price: 295, discount: 0, tva: 0, subtotal: 270 }
      ],
      sampleTotal: 270,
      samplePaid: 0,
      samplePrevDebt: 0
    },
    {
      id: 'customer_debt_history_a4',
      num: 15,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '📜 15. هيستوريك فواتير الدين والسلع المأخوذة بالتفصيل (Alt+H — A4)',
      cleanTitle: 'بيان تفصيلي للسلع المأخوذة بالدين ودفعات التسديد / Historique des Articles à Crédit',
      defaultPaper: 'a4',
      defaultTheme: 'indigo_pro',
      sourcePage: 'pos',
      sourceLabel: 'نافذة هيستوريك الديون (Alt+H) — تبويب الفواتير والسلع',
      proDesc: 'يوضح للزبون باليوم والساعة كل سلعة أخذها في فواتير الدين مع كميتها وسعرها والمبالغ التي سددها منها',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'alt_h_items_taken_history_layer',
        'items_table_layer',
        'debt_ledger_layer',
        'totals_words_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'HIST-ITEMS-0003',
      samplePartyTitle: 'تفصيل السلع المسحوبة بالدين للزبون:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003) — 📞 0550112233',
      samplePaymentMethod: 'جرد تفصيلي للسلع المأخوذة على الحساب',
      sampleItems: [
        { barcode: 'FAC-091', name: 'مناديل مبللة ألترا جوي جوي (مأخوذة في الفاتورة #91 يوم 2026-11-17)', unit: 'علبة', qty: 2, price: 75, discount: 0, tva: 0, subtotal: 150 },
        { barcode: 'FAC-091', name: 'حفاضات أطفال جوي 72 قطعة (مأخوذة في الفاتورة #91 يوم 2026-11-17)', unit: 'كيس', qty: 1, price: 145, discount: 0, tva: 0, subtotal: 145 },
        { barcode: 'REC-118', name: 'دفعة تسديد نقدية مستلمة من الزبون (خصم من إجمالي السلع أعلاه)', unit: 'دفعة ناقصة', qty: 1, price: -25, discount: 0, tva: 0, subtotal: -25 }
      ],
      sampleTotal: 270,
      samplePaid: 0,
      samplePrevDebt: 0
    },
    {
      id: 'global_debtors_register_a4',
      num: 16,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '📒 16. السجل العام لجميع الزبائن المدينين بالمتجر (Alt+H — A4)',
      cleanTitle: 'السجل الرسمي العام لديون الزبائن / État Global des Crédits Clients',
      defaultPaper: 'a4',
      defaultTheme: 'executive_dark',
      sourcePage: 'pos',
      sourceLabel: 'هيستوريك الديون (Alt+H) — طباعة ملخص الديون العام',
      proDesc: 'كشف إداري شامل لصاحب المحل يجمع كل الزبائن المدينين مع أرقام هواتفهم وإجمالي مشترياتهم والمسدد وصافي الدين المتبقي',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'items_table_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: false, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'REG-DEBTS-2026',
      samplePartyTitle: 'إدارة المتجر والخزينة:',
      samplePartyName: 'جرد شامل للذمم والديون المستحقة لدى الزبائن',
      samplePaymentMethod: 'إجمالي الديون النشطة: 270.00 د.ج (27 ألف سنتيم)',
      sampleItems: [
        { barcode: 'FID-00003', name: '👑 أمين بن يحيى (📞 0550112233) — المشتريات: 22,952.20 | المسدد: 22,682.20 د.ج', unit: '⭐ 79 نقطة', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 270 }
      ],
      sampleTotal: 270,
      samplePaid: 0,
      samplePrevDebt: 0
    },
    {
      id: 'f8_vip_loyalty_debt_card_80mm',
      num: 17,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '👑 17. بطاقة الوضعية الشاملة للزبون الوفي: النقاط + الديون (F8 — 80mm)',
      cleanTitle: 'بطاقة وضعية الزبون الوفي (النقاط + الديون) / Bilan Client VIP (F8)',
      defaultPaper: '80mm',
      defaultTheme: 'amber_gold',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات — نافذة الزبون الوفي والبطاقة (F8)',
      proDesc: 'تذكرة شاملة للزبون الوفي تجمع رصيد نقاط الوفاء وقيمتها النقدية بالدينار + كشف ديونه الحالية في بطاقة واحدة',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'f8_vip_points_and_debt_dual_layer',
        'items_table_layer',
        'credit_carnet_layer',
        'vip_coupon_cut_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'F8-VIP-00003',
      samplePartyTitle: 'العضو الوفي:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003) — 📞 0550112233',
      samplePaymentMethod: '⭐ النقاط: 79 نقطة (158 د.ج) | 💳 الدين: 270.00 د.ج',
      sampleItems: [
        { barcode: 'VIP-PTS', name: '⭐ رصيد نقاط الوفاء المتاح للاستبدال (79 نقطة = 158.00 د.ج)', unit: 'مكافأة', qty: 79, price: 2, discount: 0, tva: 0, subtotal: 158 },
        { barcode: 'VIP-DEBT', name: '💳 صافي الدين المتبقي على الحساب حالياً (27 ألف سنتيم)', unit: 'كريدي', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 270 }
      ],
      sampleTotal: 270,
      samplePaid: 0,
      samplePrevDebt: 270
    },
    {
      id: 'loyalty_vip_card_80mm',
      num: 18,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '🎁 18. قسيمة مكافآت واستبدال نقاط الوفاء (Ticket Fidélité F9 — 80mm)',
      cleanTitle: 'قسيمة مكافآت وتخفيض نقاط الوفاء / Bon Fidélité VIP',
      defaultPaper: '80mm',
      defaultTheme: 'amber_gold',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات — خصم نقاط الوفاء (F9)',
      proDesc: 'توثق عملية خصم أو استبدال نقاط الوفاء بتخفيض نقدي فوري في الفاتورة مع الرصيد المتبقي من النقاط',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'loyalty_points_layer',
        'savings_promo_layer',
        'vip_coupon_cut_layer',
        'qr_social_wifi_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'FID-REDEEM-03',
      samplePartyTitle: 'الزبون الوفي المستفيد:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003)',
      samplePaymentMethod: 'استبدال نقاط الوفاء بتخفيض نقدي (F9)',
      sampleItems: [
        { barcode: 'PTS-USED', name: 'خصم نقاط وفاء من البطاقة مقابل تخفيض فوري في السلة', unit: 'نقطة', qty: 50, price: 2, discount: 0, tva: 0, subtotal: 100 }
      ],
      sampleTotal: 100,
      samplePaid: 100,
      samplePrevDebt: 0
    },
    {
      id: 'recap_invoice_a4',
      num: 19,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '📑 19. فاتورة مبيعات مجمعة للزبون (Facture Récapitulative A4)',
      cleanTitle: 'فاتورة مبيعات مجمعة / Facture Récapitulative',
      defaultPaper: 'a4',
      defaultTheme: 'executive_dark',
      sourcePage: 'customers',
      sourceLabel: 'شاشة المبيعات + الزبائن (الفواتير المجمعة)',
      proDesc: 'تجمع كافة مسحوبات وفواتير الزبون خلال شهر أو فترة محددة في فاتورة ضريبية ومحاسبية موحدة',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'totals_words_layer',
        'debt_ledger_layer',
        'bank_rip_ccp_box_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'FR-2026-0008',
      samplePartyTitle: 'الزبون / المؤسسة:',
      samplePartyName: 'مؤسسة الأمل للتجارة (أمين بن يحيى)',
      samplePaymentMethod: 'تجميع فواتير الفترة (Facture Récapitulative)',
      sampleItems: [
        { barcode: '6130001000012', name: 'إجمالي مسحوبات: زيت مائدة إيليو 5 لتر (خلال الفترة)', unit: 'قارورة', qty: 24, price: 650, discount: 0, tva: 0, subtotal: 15600 },
        { barcode: '6130002000011', name: 'إجمالي مسحوبات: حليب كانديا 1 لتر (خلال الفترة)', unit: 'علبة', qty: 60, price: 150, discount: 0, tva: 0, subtotal: 9000 }
      ],
      sampleTotal: 24600,
      samplePaid: 24330,
      samplePrevDebt: 0
    },
    {
      id: 'installment_contract',
      num: 20,
      cat: 'CREDIT',
      catLabel: '💳 الكريدي والديون والوفاء (11)',
      name: '🗓️ 20. عقد بيع بالتقسيط وجدول الأقساط الشهرية (A4)',
      cleanTitle: 'عقد بيع بالتقسيط وجدولة الأقساط / Contrat de Vente par Facilité',
      defaultPaper: 'a4',
      defaultTheme: 'amber_gold',
      sourcePage: 'customers',
      sourceLabel: 'الزبائن والأقساط الشهرية',
      proDesc: 'عقد التزام رسمي يوضح السلعة المباعة، الدفعة الأولى (التسبيق)، وجدول تواريخ ومبالغ الأقساط الشهرية مع إمضاء المشتري',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'installments_schedule_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'INST-2026-0019',
      samplePartyTitle: 'المشتري بالتقسيط:',
      samplePartyName: '👑 أمين بن يحيى (FID-00003)',
      samplePaymentMethod: 'بيع بالتقسيط على 3 أشهر (تسبيق: 6,000 د.ج)',
      sampleItems: [
        { barcode: '6130099001122', name: 'جهاز كهرومنزلي ممتاز — بيع بالتقسيط المريح', unit: 'جهاز', qty: 1, price: 15000, discount: 0, tva: 0, subtotal: 15000 }
      ],
      sampleTotal: 15000,
      samplePaid: 6000,
      samplePrevDebt: 0
    }
  ];

  console.log('✅ [V70 Part 1]: تم بناء وتجهيز القوالب الـ 20 الأولى (المبيعات + منظومة الديون والوفاء المحدثة) من الصفر!');
})();

/* ==================== [V70 PART 2: CLEAN-ROOM MASTER TEMPLATES 21 TO 34 (PURCHASES, INVENTORY & CAISSE)] ==================== */
(function initV70Part2Templates21To34() {
  window.__GHERBI_V70_MASTER_TEMPLATES_PART2 = [
    // ========================================================================
    // المجموعة 3: المشتريات والموردين (4 مستندات احترافية #21 .. #24)
    // ========================================================================
    {
      id: 'purchase_invoice',
      num: 21,
      cat: 'PURCHASES',
      catLabel: '🛍️ المشتريات والموردين (4)',
      name: '🛍️ 21. سند استلام وفاتورة شراء وتموين (Bon de Réception A4)',
      cleanTitle: 'سند استلام بضاعة وفاتورة شراء / Bon de Réception (BR)',
      defaultPaper: 'a4',
      defaultTheme: 'executive_dark',
      sourcePage: 'purchases',
      sourceLabel: 'المشتريات والفواتير',
      proDesc: 'يوثق البضاعة المستلمة من المورد، كمياتها، سعر الشراء، مطابقة الجودة، والمبلغ المدفوع والمتبقي للمورد',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'supplier_reception_layer',
        'items_table_layer',
        'pack_carton_summary_layer',
        'totals_words_layer',
        'debt_ledger_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'BR-2026-0041',
      samplePartyTitle: 'المورد / الشركة الممونة:',
      samplePartyName: 'شركة التوزيع الغذائي الكبرى (Fournisseur)',
      samplePaymentMethod: 'تموين مخزني — دفع جزئي والباقي لأجل',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (دفعة تموين جديدة)', unit: 'قارورة', qty: 100, price: 580, discount: 0, tva: 0, subtotal: 58000 },
        { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر', unit: 'علبة', qty: 200, price: 130, discount: 0, tva: 0, subtotal: 26000 }
      ],
      sampleTotal: 84000,
      samplePaid: 50000,
      samplePrevDebt: 15000
    },
    {
      id: 'supplier_payment_receipt',
      num: 22,
      cat: 'PURCHASES',
      catLabel: '🛍️ المشتريات والموردين (4)',
      name: '💳 22. سند صرف وتسديد دفعة لمورد (Bon de Versement A5 / 80mm)',
      cleanTitle: 'سند تسديد دفعة لمورد / Bon de Versement Fournisseur',
      defaultPaper: 'a5',
      defaultTheme: 'emerald_dz',
      sourcePage: 'suppliers',
      sourceLabel: 'إدارة الموردين والدفعات',
      proDesc: 'يوثق المبلغ المسدد للمورد من الصندوق، دين المورد قبل الدفعة، والرصيد المتبقي للمورد مع إمضاء المستلم',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'debt_ledger_layer',
        'expense_approval_layer',
        'totals_words_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'VERS-2026-0022',
      samplePartyTitle: 'المورد المستفيد:',
      samplePartyName: 'شركة التوزيع الغذائي الكبرى',
      samplePaymentMethod: 'دفعة نقدية من الصندوق',
      sampleItems: [
        { barcode: 'VERS-22', name: 'تسديد دفعة نقدية على حساب فواتير التوريد (خصم من دين المورد)', unit: 'دفعة', qty: 1, price: 30000, discount: 0, tva: 0, subtotal: 30000 }
      ],
      sampleTotal: 30000,
      samplePaid: 30000,
      samplePrevDebt: 49000
    },
    {
      id: 'supplier_return_note',
      num: 23,
      cat: 'PURCHASES',
      catLabel: '🛍️ المشتريات والموردين (4)',
      name: '↩️ 23. سند إرجاع بضاعة للمورد (Bon de Retour Fournisseur A4)',
      cleanTitle: 'سند إرجاع بضاعة للمورد / Bon de Retour Fournisseur',
      defaultPaper: 'a4',
      defaultTheme: 'crimson_bold',
      sourcePage: 'purchases',
      sourceLabel: 'مرتجعات الموردين',
      proDesc: 'يوثق الأصناف المرجعة للمورد وسبب الإرجاع وقيمتها المخصومة من دين المورد أو المستردة نقداً للصندوق',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'supplier_reception_layer',
        'items_table_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'RF-2026-0007',
      samplePartyTitle: 'المورد المرجعة إليه البضاعة:',
      samplePartyName: 'شركة التوزيع الغذائي الكبرى',
      samplePaymentMethod: 'خصم من رصيد دين المورد (Avoir)',
      sampleItems: [
        { barcode: '6130003000010', name: 'إرجاع: ياغورت الصومام (قريب انتهاء الصلاحية — استبدال)', unit: 'علبة', qty: 40, price: 28, discount: 0, tva: 0, subtotal: 1120 }
      ],
      sampleTotal: 1120,
      samplePaid: 1120,
      samplePrevDebt: 0
    },
    {
      id: 'supplier_ledger_a4',
      num: 24,
      cat: 'PURCHASES',
      catLabel: '🛍️ المشتريات والموردين (4)',
      name: '📒 24. كشف حساب المورد والفواتير (Relevé Fournisseur A4)',
      cleanTitle: 'كشف حساب مورد مفصل / Relevé de Compte Fournisseur',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'suppliers',
      sourceLabel: 'إدارة الموردين وكشف الحساب',
      proDesc: 'تقرير A4 شامل يعرض كافة فواتير الشراء، دفعات التسديد، المرتجعات، وصافي المستحقات المتبقية للمورد',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'debt_ledger_layer',
        'items_table_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'RELF-2026-0009',
      samplePartyTitle: 'كشف حساب المورد:',
      samplePartyName: 'شركة التوزيع الغذائي الكبرى',
      samplePaymentMethod: 'كشف حساب شامل للمشتريات والدفعات',
      sampleItems: [
        { barcode: 'BR-0041', name: 'فاتورة شراء وتوريد رقم #BR-0041 بتاريخ 2026-11-10', unit: 'فاتورة', qty: 1, price: 84000, discount: 0, tva: 0, subtotal: 84000 },
        { barcode: 'VERS-022', name: 'دفعة تسديد للمورد رقم #VERS-022 بتاريخ 2026-11-15', unit: 'دفعة', qty: 1, price: -50000, discount: 0, tva: 0, subtotal: -50000 }
      ],
      sampleTotal: 84000,
      samplePaid: 50000,
      samplePrevDebt: 0
    },

    // ========================================================================
    // المجموعة 4: المخزون والجرد والتصنيع (4 مستندات احترافية #25 .. #28)
    // ========================================================================
    {
      id: 'stocktake_sheet_a4',
      num: 25,
      cat: 'INVENTORY',
      catLabel: '📦 المخزون والتصنيع (4)',
      name: '📋 25. محضر الجرد المخزني وفوارق الكميات (Inventaire A4)',
      cleanTitle: "محضر الجرد المخزني الرسمي / Procès-Verbal d'Inventaire",
      defaultPaper: 'a4',
      defaultTheme: 'executive_dark',
      sourcePage: 'stocktake',
      sourceLabel: 'الجرد المخزني',
      proDesc: 'محضر مطابقة المخزون يعرض الرصيد الدفتري، الرصيد الفعلي المعدود، والفوارق بالكمية والقيمة مع توقيع لجنة الجرد',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'stocktake_variance_layer',
        'items_table_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'INV-2026-0008',
      samplePartyTitle: 'نطاق الجرد والمسؤول:',
      samplePartyName: 'المخزن الرئيسي — إشراف: المدير العام',
      samplePaymentMethod: 'محضر جرد وتسوية فوارق المخزون',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي (الدفتري: 25 | المعدود: 25 | الفارق: 0)', unit: 'علبة', qty: 25, price: 75, discount: 0, tva: 0, subtotal: 1875 },
        { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 (الدفتري: 14 | المعدود: 13 | الفارق: -1)', unit: 'كيس', qty: 13, price: 145, discount: 0, tva: 0, subtotal: 1885 }
      ],
      sampleTotal: 3760,
      samplePaid: 3760,
      samplePrevDebt: 0
    },
    {
      id: 'price_catalog_a4',
      num: 26,
      cat: 'INVENTORY',
      catLabel: '📦 المخزون والتصنيع (4)',
      name: '🏷️ 26. كتالوج وقائمة أسعار المنتجات (Catalogue des Prix A4)',
      cleanTitle: 'قائمة الأسعار والكتالوج التجاري / Catalogue des Prix',
      defaultPaper: 'a4',
      defaultTheme: 'royal_blue',
      sourcePage: 'inventory',
      sourceLabel: 'إدارة المخزون وقائمة الأسعار',
      proDesc: 'قائمة أسعار مطبوعة للزبائن والموزعين توضح الباركود والوحدة والسعر بالدينار والسنتيم',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'items_table_layer',
        'qr_social_wifi_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: false, unitPrice: true, discount: false, tva: false, subtotal: false },
      sampleDocNum: 'CAT-2026-02',
      samplePartyTitle: 'قائمة الأسعار المعتمدة:',
      samplePartyName: 'الأسعار الرسمية للزبائن بالحبة والباكي',
      samplePaymentMethod: 'أسعار البيع بالدينار الجزائري والسنتيم',
      sampleItems: [
        { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (Elio Cevital)', unit: 'قارورة', qty: 1, price: 650, discount: 0, tva: 0, subtotal: 650 },
        { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (Candia)', unit: 'علبة', qty: 1, price: 150, discount: 0, tva: 0, subtotal: 150 },
        { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (Bonal)', unit: 'علبة', qty: 1, price: 320, discount: 0, tva: 0, subtotal: 320 }
      ],
      sampleTotal: 1120,
      samplePaid: 1120,
      samplePrevDebt: 0
    },
    {
      id: 'production_order_sheet',
      num: 27,
      cat: 'INVENTORY',
      catLabel: '📦 المخزون والتصنيع (4)',
      name: '🏭 27. أمر تشغيل وتصنيع داخلي (Ordre de Fabrication BOM A4)',
      cleanTitle: 'أمر تشغيل وتصنيع داخلي / Ordre de Fabrication (BOM)',
      defaultPaper: 'a4',
      defaultTheme: 'emerald_dz',
      sourcePage: 'manufacturing',
      sourceLabel: 'التصنيع والإنتاج',
      proDesc: 'يوثق وصفة التصنيع، المواد الأولية المسحوبة من المخزن، نسبة الهدر، وتكلفة الوحدة المصنعة الناتجة',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'bom_production_cost_layer',
        'items_table_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'PRD-2026-0015',
      samplePartyTitle: 'ورشة الإنتاج / الوصفة:',
      samplePartyName: 'إنتاج حزمة ترويجية / منتج مصنع جاهز',
      samplePaymentMethod: 'أمر إنتاج داخلي معتمد',
      sampleItems: [
        { barcode: 'RAW-001', name: 'مادة أولية مستهلكة رقم 1 (سحب من المخزون)', unit: 'كغ', qty: 10, price: 120, discount: 0, tva: 0, subtotal: 1200 },
        { barcode: 'RAW-002', name: 'مواد تغليف وتعبئة', unit: 'قطعة', qty: 20, price: 15, discount: 0, tva: 0, subtotal: 300 }
      ],
      sampleTotal: 1500,
      samplePaid: 1500,
      samplePrevDebt: 0
    },
    {
      id: 'low_stock_order_a4',
      num: 28,
      cat: 'INVENTORY',
      catLabel: '📦 المخزون والتصنيع (4)',
      name: '🚨 28. كشف النواقص المخزنية وطلب التموين (État des Ruptures A4)',
      cleanTitle: 'كشف النواقص المخزنية وطلب التموين / État des Ruptures',
      defaultPaper: 'a4',
      defaultTheme: 'amber_gold',
      sourcePage: 'inventory',
      sourceLabel: 'إدارة المخزون والتنبيهات',
      proDesc: 'قائمة الأصناف التي وصلت للحد الأدنى في المخزن مع الكمية المقترحة للتموين لتسليمها للمورد',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'low_stock_reorder_layer',
        'items_table_layer',
        'totals_words_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'RUP-2026-0005',
      samplePartyTitle: 'موجه إلى قسم:',
      samplePartyName: 'المشتريات والتموين — طلبية تعويض النواقص',
      samplePaymentMethod: 'أصناف حرجة تحت الحد الأدنى',
      sampleItems: [
        { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي (المتبقي بالسطوك: 2 — الحد الأدنى: 10)', unit: 'علبة', qty: 30, price: 55, discount: 0, tva: 0, subtotal: 1650 },
        { barcode: '6130006000017', name: 'غولد لاين (المتبقي بالسطوك: 1 — الحد الأدنى: 12)', unit: 'قطعة', qty: 24, price: 100, discount: 0, tva: 0, subtotal: 2400 }
      ],
      sampleTotal: 4050,
      samplePaid: 0,
      samplePrevDebt: 0
    },

    // ========================================================================
    // المجموعة 5: الصندوق والورديات والجباية والرقابة (6 مستندات احترافية #29 .. #34)
    // مصممة لفصل سيولة الدرج عن ديون الوردية والمصاريف بدقة محاسبية 100%
    // ========================================================================
    {
      id: 'caisse_z_report',
      num: 29,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (6)',
      name: '🔒 29. تذكرة إغلاق الوردية الشاملة: السيولة والديون والمصاريف (Z-Report 80mm)',
      cleanTitle: 'محضر إغلاق الوردية الشامل (السيولة + الديون + المصاريف) / Z-Report',
      defaultPaper: '80mm',
      defaultTheme: 'executive_dark',
      sourcePage: 'caisse',
      sourceLabel: 'إدارة الصندوق — إغلاق الوردية ومعاينة Z-Report',
      proDesc: 'تذكرة حرارية شاملة تفصل بدقة بين السيولة النقدية في الدرج (الافتتاحي + مبيعات النقد + تحصيل الديون - المصاريف) وبين الديون الآجلة الممنوحة في الوردية',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'shift_cash_vs_debt_reconciliation_layer',
        'items_table_layer',
        'shift_expenses_and_inflows_layer',
        'caisse_z_denoms_layer',
        'totals_words_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'Z-SHIFT-0008',
      samplePartyTitle: 'الوردية / أمين الصندوق:',
      samplePartyName: 'الوردية #8 — الكاشير: المدير العام',
      samplePaymentMethod: 'السيولة مطابقة ✔ | ديون الوردية: +270.00 د.ج',
      sampleItems: [
        { barcode: '1-OPEN', name: '1. الرصيد الافتتاحي في الدرج (Fond de Caisse)', unit: 'سيولة درج', qty: 1, price: 8000, discount: 0, tva: 0, subtotal: 8000 },
        { barcode: '2-CASH', name: '2. المبيعات النقدية المحصلة + المدفوع جزئياً (+)', unit: 'سيولة درج', qty: 1, price: 15800, discount: 0, tva: 0, subtotal: 15800 },
        { barcode: '3-DEBT-IN', name: '3. تسديدات ديون الزبائن المقبوضة نقداً Alt+V (+)', unit: 'تحصيل دين', qty: 1, price: 1199.2, discount: 0, tva: 0, subtotal: 1199.2 },
        { barcode: '4-EXP', name: '4. المصاريف والمسحوبات النقدية من الدرج (-)', unit: 'خصم درج', qty: 1, price: 0, discount: 0, tva: 0, subtotal: 0 },
        { barcode: '5-NEW-DEBT', name: '5. [حساب الديون]: ديون جديدة ممنوحة للزبائن اليوم Alt+D (لا تدخل في كاش الدرج)', unit: 'ذمم آجلة', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 0 }
      ],
      sampleTotal: 24999.2,
      samplePaid: 24999.2,
      samplePrevDebt: 270
    },
    {
      id: 'caisse_shift_full_audit_a4',
      num: 30,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (6)',
      name: '🏦 30. المحضر الرسمي المفصل لإغلاق الوردية والديون والمصاريف (Z-Report A4)',
      cleanTitle: 'المحضر الرسمي المفصل لإغلاق الوردية، السيولة، الديون، والمصاريف (Z-Report A4)',
      defaultPaper: 'a4',
      defaultTheme: 'executive_dark',
      sourcePage: 'caisse',
      sourceLabel: 'إدارة الصندوق — طباعة تقرير مفصل (A4)',
      proDesc: 'تقرير A4 إداري ومحاسبي مفصل يوثق حركة السيولة النقدية، قائمة فواتير الدين الممنوحة في الوردية، وصولات قبض الديون، والمصاريف، وجرد الفئات النقدية',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'shift_cash_vs_debt_reconciliation_layer',
        'items_table_layer',
        'shift_expenses_and_inflows_layer',
        'caisse_z_denoms_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'Z-FULL-A4-0008',
      samplePartyTitle: 'المناوبة / أمين الصندوق:',
      samplePartyName: 'الوردية #8 — الكاشير: المدير العام',
      samplePaymentMethod: 'مطابقة السيولة النقدية + جرد ديون ومصاريف الوردية',
      sampleItems: [
        { barcode: '1-OPEN', name: '1. الرصيد النقدي الافتتاحي في الدرج (Fond de Caisse)', unit: 'سيولة درج', qty: 1, price: 8000, discount: 0, tva: 0, subtotal: 8000 },
        { barcode: '2-CASH', name: '2. إجمالي المبيعات النقدية والمدفوع جزئياً في الوردية (+)', unit: 'سيولة درج', qty: 1, price: 15800, discount: 0, tva: 0, subtotal: 15800 },
        { barcode: '3-DEBT-IN', name: '3. إجمالي تسديدات الديون المقبوضة نقداً في الوردية Alt+V (+)', unit: 'سيولة درج', qty: 1, price: 1199.2, discount: 0, tva: 0, subtotal: 1199.2 },
        { barcode: '4-NEW-DEBT', name: '4. [مبيعات آجلة]: فاتورة دين #91 للزبون (أمين بن يحيى FID-00003) — باقي غير مقبوض: 270.00 د.ج', unit: 'ذمم آجلة', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 0 }
      ],
      sampleTotal: 24999.2,
      samplePaid: 24999.2,
      samplePrevDebt: 270
    },
    {
      id: 'caisse_cash_in_voucher_80mm',
      num: 31,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (6)',
      name: "➕ 31. سند إيداع وتغذية نقدية في الصندوق (Bon d'Entrée 80mm)",
      cleanTitle: "سند إيداع وتغذية صندوق الكاشير / Bon d'Entrée Caisse",
      defaultPaper: '80mm',
      defaultTheme: 'emerald_dz',
      sourcePage: 'caisse',
      sourceLabel: 'إدارة الصندوق — إيداع نقدي (+ سند)',
      proDesc: 'وصل حراري لتوثيق المبالغ النقدية المودعة في الدرج (تغذية الفكة/الصرف أو إيداع مالي) مع توقيع المودع وأمين الصندوق',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'totals_words_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'ENT-2026-0018',
      samplePartyTitle: 'المودع / أمين الصندوق:',
      samplePartyName: 'تغذية نقدية لصندوق الكاشير — المدير العام',
      samplePaymentMethod: 'إيداع نقدي مباشر في الدرج (+)',
      sampleItems: [
        { barcode: 'ENT-18', name: 'إيداع سيولة نقدية لتغذية الصرف في درج الكاشير', unit: 'إيداع', qty: 1, price: 3000, discount: 0, tva: 0, subtotal: 3000 }
      ],
      sampleTotal: 3000,
      samplePaid: 3000,
      samplePrevDebt: 0
    },
    {
      id: 'expense_voucher',
      num: 32,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (6)',
      name: '💸 32. سند صرف نقدي / مصروف تشغيلي (Bon de Sortie 80mm)',
      cleanTitle: 'سند صرف نقدي من الصندوق / Bon de Sortie Caisse',
      defaultPaper: '80mm',
      defaultTheme: 'crimson_bold',
      sourcePage: 'expenses',
      sourceLabel: 'المصاريف ورأس المال + سحب نقدي من الصندوق',
      proDesc: 'وصل إثبات سحب مبلغ نقدي من الدرج لتغطية مصروف تشغيلي مع بطاقة اعتماد الصرف وتوقيع المستلم',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'items_table_layer',
        'expense_approval_layer',
        'totals_words_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'EXP-2026-0044',
      samplePartyTitle: 'فئة المصروف / المستفيد:',
      samplePartyName: 'مصاريف نقل وشحن وتفريغ البضاعة',
      samplePaymentMethod: 'سحب نقدي من مناوبة الصندوق (-)',
      sampleItems: [
        { barcode: 'EXP-44', name: 'دفع مصاريف نقل وتفريغ البضاعة (خصم مباشر من صندوق الكاشير)', unit: 'سند صرف', qty: 1, price: 1500, discount: 0, tva: 0, subtotal: 1500 }
      ],
      sampleTotal: 1500,
      samplePaid: 1500,
      samplePrevDebt: 0
    },
    {
      id: 'fiscal_g12_statement',
      num: 33,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (6)',
      name: '🇩🇿 33. استمارة التصريح الجبائي الجزائري (IFU G12 / G50 A4)',
      cleanTitle: 'استمارة التصريح الجبائي الجزائري (IFU G12 / G50)',
      defaultPaper: 'a4',
      defaultTheme: 'emerald_dz',
      sourcePage: 'analytics',
      sourceLabel: 'الإحصائيات واستوديو الجباية (التبويب 13)',
      proDesc: 'كشف جبائي يفصل رقم أعمال المواد المقننة واسعة الاستهلاك (حليب، سميد، زيت، خبز) عن السلع العادية الخاضعة لمعدل 5%',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'tax_ifu_breakdown_layer',
        'items_table_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: false, unitPrice: false, discount: false, tva: true, subtotal: true },
      sampleDocNum: 'G12-2026-DZ',
      samplePartyTitle: 'المكلف بالضريبة الجزافية الوحيدة (IFU):',
      samplePartyName: 'Gherbi.Ai POS — تجارة بالتجزئة وسوبرماركت',
      samplePaymentMethod: 'تصريح سنوي IFU G12 (معدل 5%)',
      sampleItems: [
        { barcode: 'IFU-REG', name: '1. رقم الأعمال للمواد المقننة السعر (حليب، خبز، سميد، زيت — هامش الربح الصافي الخاضع)', unit: 'مقنن G12', qty: 1, price: 45000, discount: 0, tva: 0, subtotal: 45000 },
        { barcode: 'IFU-5P', name: '2. رقم الأعمال للسلع التجارية العادية الخاضعة لمعدل 5% (IFU)', unit: 'خاضع 5%', qty: 1, price: 185000, discount: 0, tva: 5, subtotal: 185000 }
      ],
      sampleTotal: 230000,
      samplePaid: 230000,
      samplePrevDebt: 0
    },
    {
      id: 'forensic_audit_report',
      num: 34,
      cat: 'FINANCE',
      catLabel: '🏦 الصندوق والجباية والرقابة (6)',
      name: '🛡️ 34. التقرير الجنائي لرقابة الكاشير وحماية الأرباح (Audit A4)',
      cleanTitle: 'التقرير الجنائي الرسمي لرقابة الكاشير ومنع التلاعب (Anti-Fraude)',
      defaultPaper: 'a4',
      defaultTheme: 'crimson_bold',
      sourcePage: 'analytics',
      sourceLabel: 'رادار الرقابة الجنائية (التبويب 14) + الدرع العلوي',
      proDesc: 'تقرير رقابي لصاحب المحل يوثق باليوم والساعة والكاشير السطور المحذوفة بعد المسح، تفريغ السلة، والبيع بأقل من التكلفة',
      idealLayers: [
        'header_layer',
        'doc_banner_layer',
        'customer_box_layer',
        'forensic_radar_summary_layer',
        'items_table_layer',
        'totals_words_layer',
        'dual_signature_stamps_layer',
        'footer_stamp_layer'
      ],
      idealCols: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
      sampleDocNum: 'AUDIT-2026-14',
      samplePartyTitle: 'نطاق الفحص الرقابي:',
      samplePartyName: 'جميع البائعين ومناوبات الكاشير',
      samplePaymentMethod: 'تقرير رقابي جنائي لحماية الأرباح',
      sampleItems: [
        { barcode: 'VOID-LINE', name: 'حذف سطر من السلة بعد قراءة الباركود (إلغاء قبل التسديد)', unit: 'حركة مرصودة', qty: 2, price: 125, discount: 0, tva: 0, subtotal: 250 },
        { barcode: 'BELOW-COST', name: 'عمليات بيع بسعر التكلفة أو بأقل من سعر الشراء', unit: 'حركة مرصودة', qty: 0, price: 0, discount: 0, tva: 0, subtotal: 0 }
      ],
      sampleTotal: 250,
      samplePaid: 0,
      samplePrevDebt: 0
    }
  ];

  // توحيد القوالب الـ 34 في مصفوفة واحدة نظيفة ومعتمدة
  window.__GHERBI_V70_ALL_34_MASTER_TEMPLATES = [
    ...(window.__GHERBI_V70_MASTER_TEMPLATES_PART1 || []),
    ...window.__GHERBI_V70_MASTER_TEMPLATES_PART2
  ];

  console.log('✅ [V70 Part 2]: اكتمل بناء القوالب الـ 34 من الصفر المطلق بنجاح!');
})();

/* ==================== [V70 PART 3: UPGRADED STUDIO TOOLS & 36 SMART LAYERS LIBRARY] ==================== */
(function initV70Part3UpgradedToolsAnd36Layers() {
  // ==========================================================================
  // مكتبة الـ 36 طبقة ذكية المحدثة (تضم الطبقات الـ 30 السابقة + 6 طبقات جديدة للمميزات الحديثة)
  // ==========================================================================
  const FULL_36_SMART_LAYERS = [
    // ── 1. الأساسية (CORE — 6 طبقات) ──
    { id: 'header_layer', cat: 'CORE', name: '🏢 1. ترويسة المتجر والشعار والبيانات الجبائية', desc: 'اسم المتجر، الشعار، الهاتف، العنوان، وأرقام RC / NIF / AI / NIS.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'doc_banner_layer', cat: 'CORE', name: '🏷️ 2. شريط عنوان ورقم المستند والباركود', desc: 'عنوان التذكرة/الفاتورة، رقمها التسلسلي، تاريخ وساعة الإصدار، والباركود.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'customer_box_layer', cat: 'CORE', name: '👤 3. بطاقة بيانات الزبون / المورد والكود (FID)', desc: 'اسم الزبون الوفي أو المورد، كود بطاقة الوفاء FID، الهاتف، والعنوان.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'items_table_layer', cat: 'CORE', name: '📋 4. جدول الأصناف والكميات والأسعار الذكي', desc: 'جدول السلع أو الحركات بتخطيط ديناميكي يتكيف مع 80mm و A4 و A5.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'totals_words_layer', cat: 'CORE', name: '💰 5. شلال المجاميع بالدينار والسنتيم والتفقيط', desc: 'المجموع الفرعي، التخفيض، الصافي بالدينار والسنتيم، والمبلغ بالحروف.', defaultVisible: true, forDocs: ['ALL'] },
    { id: 'footer_stamp_layer', cat: 'CORE', name: '✒️ 6. التذييل، شروط الاستبدال، رمز RIP، والختم', desc: 'شروط الإرجاع والاستبدال، حساب BaridiMob RIP، ومربع الختم والإمضاء.', defaultVisible: true, forDocs: ['ALL'] },

    // ── 2. الكريدي والديون المحدثة (CREDIT — 8 طبقات شاملة لـ Alt+D و Alt+V و Alt+H) ──
    { id: 'alt_d_debt_confirmation_box_layer', cat: 'FINANCE', name: '📝 7. بطاقة تأكيد عملية الدين والمدفوع الجزئي (Alt+D)', desc: 'صندوق مخصص لتذكرة (Alt+D) يفصل الدين السابق + فاتورة اليوم - المدفوع اليوم = الدين الجديد + إمضاء المدين.', defaultVisible: false, forDocs: ['debt_confirm_ticket_80mm', 'pos_partial_credit_80mm', 'invoice_a4', 'invoice_a5'] },
    { id: 'alt_v_debt_settlement_voucher_layer', cat: 'FINANCE', name: '💵 8. بطاقة وصل تسديد الدين وحساب الباقي بالسنتيم (Alt+V)', desc: 'صندوق مخصص لوصل القبض (Alt+V) يوضح الدين قبل الدفع، المبلغ المقبوض، والرصيد المتبقي بالسنتيم.', defaultVisible: false, forDocs: ['payment_receipt', 'customer_carnet_80mm'] },
    { id: 'alt_h_items_taken_history_layer', cat: 'FINANCE', name: '📜 9. جدول تفصيل السلع المأخوذة في فواتير الدين (Alt+H)', desc: 'يعرض تفاصيل السلع والكميات المسحوبة على الحساب داخل كل فاتورة دين بالتاريخ والساعة.', defaultVisible: false, forDocs: ['customer_debt_history_a4', 'customer_carnet_80mm', 'customer_ledger_a4'] },
    { id: 'credit_carnet_layer', cat: 'FINANCE', name: '💳 10. خلاصة كرني الكريدي السريعة (Carnet de Crédit 80mm)', desc: 'صندوق بارز يوضح إجمالي المشتريات، إجمالي المسدد، وصافي الدين المتبقي بالدينار والسنتيم.', defaultVisible: false, forDocs: ['customer_carnet_80mm', 'debt_confirm_ticket_80mm', 'pos_partial_credit_80mm', 'payment_receipt', 'f8_vip_loyalty_debt_card_80mm'] },
    { id: 'debt_ledger_layer', cat: 'FINANCE', name: '⚖️ 11. جدول وضعية الديون والحساب التراكمي الرسمي (A4 / A5)', desc: 'جدول محاسبي رسمي للفواتير وكشوف الحسابات يوضح الرصيد السابق والحالي والمتبقي.', defaultVisible: false, forDocs: ['invoice_a4', 'invoice_a5', 'customer_ledger_a4', 'customer_debt_history_a4', 'recap_invoice_a4', 'purchase_invoice', 'supplier_payment_receipt', 'supplier_ledger_a4'] },
    { id: 'payment_breakdown_layer', cat: 'FINANCE', name: '💵 12. تفصيل المقبوض، الصرف المرجع (Rendu)، وطريقة الدفع', desc: 'يعرض المبلغ المستلم من الزبون، الصرف المرجع له بالدينار والسنتيم، واسم الكاشير.', defaultVisible: false, forDocs: ['receipt_thermal', 'pos_partial_credit_80mm', 'payment_receipt'] },
    { id: 'installments_schedule_layer', cat: 'FINANCE', name: '🗓️ 13. جدول الأقساط الشهرية ومواعيد الاستحقاق والتسبيق', desc: 'يعرض الدفعة الأولى (التسبيق)، عدد الأشهر، قيمة القسط الشهري، وتواريخ الاستحقاق.', defaultVisible: false, forDocs: ['installment_contract', 'invoice_a4'] },
    { id: 'bank_rip_ccp_box_layer', cat: 'FINANCE', name: '🏦 14. بطاقة الحساب البنكي والبريدي (RIB / CCP / BaridiMob RIP)', desc: 'صندوق رسمي لبيانات الدفع البنكي والبريدي للشركات والزبائن.', defaultVisible: false, forDocs: ['invoice_a4', 'proforma', 'recap_invoice_a4', 'customer_ledger_a4', 'customer_debt_history_a4'] },

    // ── 3. الوفاء والتسويق (LOYALTY — 6 طبقات شاملة لـ F8 و F9) ──
    { id: 'f8_vip_points_and_debt_dual_layer', cat: 'LOYALTY', name: '👑 15. البطاقة المزدوجة للزبون الوفي: النقاط + الديون (F8)', desc: 'تجمع في شريط واحد رصيد نقاط الوفاء وقيمتها النقدية بالدينار + صافي ديون الزبون الوفي الحالية.', defaultVisible: true, forDocs: ['receipt_thermal', 'f8_vip_loyalty_debt_card_80mm', 'debt_confirm_ticket_80mm', 'pos_partial_credit_80mm', 'customer_carnet_80mm'] },
    { id: 'loyalty_points_layer', cat: 'LOYALTY', name: '⭐ 16. بطاقة نقاط الوفاء والمخصوم من البطاقة (VIP & عابر)', desc: 'تعرض نوع الزبون، الرصيد السابق، النقاط المكتسبة (+)، المخصومة (-)، والرصيد الجديد.', defaultVisible: false, forDocs: ['receipt_thermal', 'loyalty_vip_card_80mm', 'invoice_a4'] },
    { id: 'savings_promo_layer', cat: 'LOYALTY', name: '🎉 17. شريط "كم وفّرت اليوم؟" وعداد القطع الإجمالي', desc: 'يبرز للزبون إجمالي ما وفّره في الفاتورة وإجمالي عدد القطع المستلمة.', defaultVisible: false, forDocs: ['receipt_thermal', 'loyalty_vip_card_80mm', 'invoice_a4'] },
    { id: 'vip_coupon_cut_layer', cat: 'LOYALTY', name: '✂️ 18. قسيمة هدية وتخفيض قابلة للقص للزيارة القادمة (Coupon)', desc: 'كوبون ترويجي منقط قابل للقص في أسفل التذكرة لتحفيز الزبون على العودة.', defaultVisible: false, forDocs: ['receipt_thermal', 'loyalty_vip_card_80mm', 'f8_vip_loyalty_debt_card_80mm'] },
    { id: 'qr_social_wifi_layer', cat: 'LOYALTY', name: '📱 19. رمز QR المتجر، صفحات التواصل، وكود Wi-Fi الزبائن', desc: 'رمز استجابة سريعة للمتجر مع صفحات فيسبوك/واتساب أو كود Wi-Fi الزبائن.', defaultVisible: false, forDocs: ['receipt_thermal', 'loyalty_vip_card_80mm', 'price_catalog_a4'] },
    { id: 'return_policy_box_layer', cat: 'LOYALTY', name: '🔄 20. صندوق شروط الإرجاع والاستبدال وحماية المستهلك', desc: 'يوضح شروط استبدال السلع خلال 48 ساعة وإلزامية إحضار الوصل الأصلي.', defaultVisible: false, forDocs: ['receipt_thermal', 'invoice_a4', 'credit_note', 'warranty_cert'] },

    // ── 4. الصندوق والورديات والجباية والرقابة (CAISSE_FISCAL — 7 طبقات شاملة لحسابات الوردية) ──
    { id: 'shift_cash_vs_debt_reconciliation_layer', cat: 'CAISSE_FISCAL', name: '🏦 21. ميزان الوردية المزدوج: سيولة الدرج مقابل ديون الوردية (Z-Report)', desc: 'يفصل بدقة بين الأموال النقدية المتوقعة في الدرج وبين الديون الآجلة الممنوحة في الوردية لمنع أي خطأ عند الجرد.', defaultVisible: false, forDocs: ['caisse_z_report', 'caisse_shift_full_audit_a4'] },
    { id: 'shift_expenses_and_inflows_layer', cat: 'CAISSE_FISCAL', name: '💸 22. جدول تفصيل المصاريف والإيداعات وتحصيل الديون بالوردية', desc: 'يعرض ملخص حركات الإيداع النقدي (+)، تحصيل الديون (+)، السحوبات (-)، والمصاريف (-) داخل الوردية.', defaultVisible: false, forDocs: ['caisse_z_report', 'caisse_shift_full_audit_a4', 'expense_voucher', 'caisse_cash_in_voucher_80mm'] },
    { id: 'caisse_z_denoms_layer', cat: 'CAISSE_FISCAL', name: '🔒 23. جدول جرد الفئات النقدية الجزائرية وفارق الصندوق (Billetage)', desc: 'يفصل عدّ الأوراق النقدية (2000، 1000، 500، 200، 100 د.ج) والرصيد المعدود والفارق.', defaultVisible: false, forDocs: ['caisse_z_report', 'caisse_shift_full_audit_a4'] },
    { id: 'expense_approval_layer', cat: 'CAISSE_FISCAL', name: '🧾 24. بطاقة اعتماد سند الصرف النقدي وتوقيع المستفيد', desc: 'توثق فئة المصروف، رقم المناوبة، اسم المستلم للمبلغ، وتوقيع المدير.', defaultVisible: false, forDocs: ['expense_voucher', 'supplier_payment_receipt'] },
    { id: 'tax_ifu_breakdown_layer', cat: 'CAISSE_FISCAL', name: '🇩🇿 25. جدول تفصيل الضرائب الجزائرية (TVA / الطابع / إعفاء G12)', desc: 'يفصل المبلغ خارج الرسم HT، ضريبة TVA، الطابع الجبائي، والسلع المقننة المعفاة.', defaultVisible: false, forDocs: ['fiscal_g12_statement', 'invoice_a4', 'proforma'] },
    { id: 'forensic_radar_summary_layer', cat: 'CAISSE_FISCAL', name: '🛡️ 26. بطاقة مؤشرات الرقابة الجنائية وحماية الأرباح', desc: 'تلخص عمليات حذف السطور بعد المسح، تفريغ السلة، والبيع بأقل من التكلفة.', defaultVisible: false, forDocs: ['forensic_audit_report', 'caisse_z_report', 'caisse_shift_full_audit_a4'] },
    { id: 'free_custom_note_layer', cat: 'CAISSE_FISCAL', name: '📝 27. صندوق ملاحظات وتعليمات حرة قابلة للتخصيص', desc: 'صندوق نصي حر يمكنك كتابة أي إعلان، تهنئة، أو شروط خاصة بداخله.', defaultVisible: false, forDocs: ['ALL'] },

    // ── 5. المخزون والمشتريات والتصنيع (INVENTORY — 5 طبقات) ──
    { id: 'supplier_reception_layer', cat: 'INVENTORY', name: '🛍️ 28. بطاقة مطابقة استلام البضاعة من المورد وفحص الجودة', desc: 'توثق تاريخ الاستلام، رقم فاتورة المورد، حالة الطرود، ومراقب المخزن.', defaultVisible: false, forDocs: ['purchase_invoice', 'supplier_return_note', 'supplier_ledger_a4'] },
    { id: 'stocktake_variance_layer', cat: 'INVENTORY', name: '📊 29. ملخص محضر الجرد المخزني وفوارق الكميات والقيمة', desc: 'يلخص إجمالي الرصيد الدفتري، الرصيد الفعلي المعدود، وصافي العجز أو الفائض.', defaultVisible: false, forDocs: ['stocktake_sheet_a4'] },
    { id: 'bom_production_cost_layer', cat: 'INVENTORY', name: '🏭 30. بطاقة تكلفة التصنيع، المواد الأولية، ونسبة الهدر (BOM)', desc: 'تفصل تكلفة المواد الأولية، المصاريف الإضافية، وتكلفة الوحدة المصنعة الناتجة.', defaultVisible: false, forDocs: ['production_order_sheet'] },
    { id: 'low_stock_reorder_layer', cat: 'INVENTORY', name: '🚨 31. بطاقة أولوية التموين للأصناف الحرجة والنافدة', desc: 'تبرز عدد الأصناف التي وصلت للحد الأدنى والميزانية التقديرية لإعادة تموينها.', defaultVisible: false, forDocs: ['low_stock_order_a4', 'purchase_invoice'] },
    { id: 'pack_carton_summary_layer', cat: 'INVENTORY', name: '📦 32. ملخص التغليف وإجمالي الكراتين والباكي (Colisage)', desc: 'يحسب إجمالي عدد الطرود والكراتين والقطع لتسهيل التحميل والمراقبة.', defaultVisible: false, forDocs: ['delivery_note', 'invoice_a4', 'purchase_invoice', 'customer_order'] },

    // ── 6. الضمان والتوصيل واللوجستيك (LOGISTICS — 4 طبقات) ──
    { id: 'delivery_driver_layer', cat: 'LOGISTICS', name: '🚚 33. بطاقة التوصيل، السائق، رقم المركبة، وإمضاء الاستلام', desc: 'اسم السائق، رقم لوحة المركبة (Matricule)، وجهة التوصيل، وخانة إمضاء المستلم.', defaultVisible: false, forDocs: ['delivery_note', 'invoice_a4', 'customer_order'] },
    { id: 'warranty_imei_layer', cat: 'LOGISTICS', name: '🛡️ 34. شهادة الضمان الرسمي والأرقام التسلسلية (IMEI / S-N)', desc: 'صندوق مخصص لمدة الضمان بالأشهر، الأرقام التسلسلية للأجهزة، وشروط الصيانة.', defaultVisible: false, forDocs: ['warranty_cert', 'invoice_a4', 'receipt_thermal'] },
    { id: 'order_reservation_layer', cat: 'LOGISTICS', name: '📋 35. بطاقة حجز الطلبية، العربون المدفوع، وتاريخ التسليم', desc: 'توضح حالة حجز السلعة في المخزن، مبلغ العربون (Acompte)، والباقي عند الاستلام.', defaultVisible: false, forDocs: ['customer_order', 'proforma'] },
    { id: 'dual_signature_stamps_layer', cat: 'LOGISTICS', name: '✍️ 36. مربعات الإمضاء والختم الثلاثي (المسلّم / المراقب / المستلم)', desc: 'ثلاث خانات رسمية للتوقيع والختم في أسفل الفواتير ومحاضر الاستلام والجرد والورديات.', defaultVisible: false, forDocs: ['delivery_note', 'purchase_invoice', 'stocktake_sheet_a4', 'production_order_sheet', 'installment_contract', 'caisse_shift_full_audit_a4', 'global_debtors_register_a4'] }
  ];

  window.__GHERBI_V70_FULL_36_LAYERS = FULL_36_SMART_LAYERS;

  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    if (!studio || !window.__GHERBI_V70_ALL_34_MASTER_TEMPLATES) return;
    clearInterval(waitStudio);

    studio.ALL_28_MASTER_DOCS = window.__GHERBI_V70_ALL_34_MASTER_TEMPLATES;
    studio.ALL_34_MASTER_DOCS = window.__GHERBI_V70_ALL_34_MASTER_TEMPLATES;
    studio.FULL_16_LAYERS_CATALOG = FULL_36_SMART_LAYERS;
    studio.FULL_30_SMART_LAYERS = FULL_36_SMART_LAYERS;
    studio.FULL_36_SMART_LAYERS = FULL_36_SMART_LAYERS;
    studio.showOnlyActiveLayersInStack = studio.showOnlyActiveLayersInStack !== undefined ? studio.showOnlyActiveLayersInStack : true;

    // 1. تحديث دالة ترجمة المتغيرات الحية لتدعم متغيرات الديون والوفاء والورديات الجديدة
    const origInterpolate = studio.interpolateSmartVariables?.bind(studio);
    studio.interpolateSmartVariables = function (rawText, docData) {
      if (!rawText) return '';
      const base = origInterpolate ? origInterpolate(rawText, docData) : String(rawText);
      const prevDebt = Number(docData?.previousBalance || 0);
      const remDebt = Number(docData?.remainingDebt || 0);
      const netDebt = Number((prevDebt + remDebt).toFixed(2));
      const pts = Number(docData?.loyaltyTotalBalance || 79);
      return base
        .replace(/\{دين_الزبون_السابق\}/g, this.fmtDzd(prevDebt))
        .replace(/\{المدفوع_اليوم\}/g, this.fmtDzd(docData?.paidAmount || 0))
        .replace(/\{الدين_المضاف_اليوم\}/g, this.fmtDzd(remDebt))
        .replace(/\{إجمالي_ديون_الزبون\}/g, this.fmtDzd(netDebt))
        .replace(/\{نقاط_الوفاء_وقيمتها\}/g, `${pts} نقطة (${pts * 2} د.ج)`)
        .replace(/\{سيولة_الدرج_المتوقعة\}/g, this.fmtDzd(docData?.total || 24999.2))
        .replace(/\{ديون_الوردية_الجديدة\}/g, this.fmtDzd(prevDebt || 270));
    };

    // 2. تحديث مزامنة الـ 36 طبقة مع إعدادات القالب النشط
    studio.sync30LayersWithActiveConfig = function () {
      const existing = Array.isArray(this.config.layers) ? this.config.layers : [];
      const mapById = new Map(existing.map((l) => [l.id, l]));
      const docMeta =
        this.ALL_34_MASTER_DOCS.find((d) => d.id === this.config.activeDocType) ||
        this.ALL_34_MASTER_DOCS[0];
      const idealSet = new Set((docMeta && docMeta.idealLayers) || ['header_layer', 'doc_banner_layer', 'customer_box_layer', 'items_table_layer', 'totals_words_layer', 'footer_stamp_layer']);

      const merged = [];
      for (const cat of FULL_36_SMART_LAYERS) {
        if (mapById.has(cat.id)) {
          const item = mapById.get(cat.id);
          merged.push({
            fontSizeScale: 100,
            textAlign: 'right',
            borderStyle: 'default',
            bgStyle: 'default',
            paddingMode: 'normal',
            customTitle: '',
            customNote: '',
            ...item,
            name: item.customLabel || cat.name
          });
          mapById.delete(cat.id);
        } else {
          merged.push({
            id: cat.id,
            name: cat.name,
            visible: idealSet.has(cat.id),
            align: 'between',
            fontSizeScale: 100,
            textAlign: 'right',
            borderStyle: 'default',
            bgStyle: 'default',
            paddingMode: 'normal',
            customTitle: '',
            customNote: ''
          });
        }
      }
      for (const customL of mapById.values()) {
        merged.push(customL);
      }
      this.config.layers = merged;
    };

    // 3. تطوير قوالب الأعمدة الجاهزة لتشمل قوالب الديون والورديات الجديدة
    studio.applyTableColumnsPresetInPlace = function (presetKey) {
      const presets = {
        thermal_simple: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        alt_d_credit_ticket: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        alt_h_debt_statement: { index: true, barcode: true, name: true, unit: true, qty: false, unitPrice: true, discount: false, tva: false, subtotal: true },
        z_report_shift: { index: false, barcode: true, name: true, unit: true, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
        a4_full: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: true, tva: true, subtotal: true },
        delivery_qty_only: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: false, discount: false, tva: false, subtotal: false }
      };
      if (presets[presetKey]) {
        this.config.columns = { ...this.config.columns, ...presets[presetKey] };
        this.saveConfigLocal();
        this.refreshLeftSidebarOnly();
        this.refreshPaperHostOnly();
      }
    };

    studio.toggleShowOnlyActiveLayersInStack = function () {
      this.showOnlyActiveLayersInStack = !this.showOnlyActiveLayersInStack;
      this.refreshLeftSidebarOnly();
    };

    // 4. ترقية لوحة الأدوات الجانبية (الصورة image_0e7762.png) لتعمل بـ 36 طبقة وفلاتر ذكية جديدة
    studio.buildLeftSidebarPanelHtml = function () {
      this.sync30LayersWithActiveConfig();
      const cfg = this.config;
      const full36 = FULL_36_SMART_LAYERS;
      const activeLayersCount = (cfg.layers || []).filter((l) => l.visible).length;
      const subTab = this.leftPanelTab || 'catalog_30';
      const catFilter = this.catalogCategoryFilter || 'ALL';
      const searchQ = (this.layerCatalogSearch || '').trim().toLowerCase();
      const shop = this.getShopIdentity();
      const ct = cfg.customTexts || {};
      const activeDocMeta = this.ALL_34_MASTER_DOCS.find((d) => d.id === cfg.activeDocType) || this.ALL_34_MASTER_DOCS[0];

      let subTabBodyHtml = '';

      if (subTab === 'catalog_30') {
        const filtered36 = full36.filter((item) => {
          if (catFilter === 'FOR_DOC') {
            const isRec =
              item.forDocs.includes('ALL') ||
              item.forDocs.includes(cfg.activeDocType) ||
              (activeDocMeta?.idealLayers || []).includes(item.id);
            if (!isRec) return false;
          } else if (catFilter !== 'ALL' && item.cat !== catFilter) {
            return false;
          }
          if (searchQ && !`${item.name} ${item.desc}`.toLowerCase().includes(searchQ)) {
            return false;
          }
          return true;
        });

        const cardsHtml = filtered36
          .map((catItem) => {
            const layerState = cfg.layers.find((l) => l.id === catItem.id);
            const isVis = Boolean(layerState && layerState.visible);
            const isExpanded = this.expandedInspectorLayerId === catItem.id;

            return `
              <div class="p-3 rounded-2xl border transition ${
                isExpanded
                  ? 'bg-white dark:bg-slate-800 border-2 border-blue-500 shadow-md'
                  : isVis
                  ? 'bg-emerald-50/75 dark:bg-emerald-950/30 border-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }">
                <div class="flex items-start justify-between gap-2">
                  <div class="space-y-0.5 flex-1 min-w-0 cursor-pointer" onclick="window.GherbiPrintStudioV45.toggleLayerInPlace('${catItem.id}')">
                    <div class="font-black text-xs text-slate-900 dark:text-white leading-snug">${catItem.name}</div>
                    <div class="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">${catItem.desc}</div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleInlineInspector('${catItem.id}')" class="px-2.5 py-1.5 rounded-xl border font-black text-xs transition cursor-pointer ${
                      isExpanded
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-500'
                    }" title="فتح/إغلاق محرر خصائص هذه الطبقة">
                      ⚙️
                    </button>
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleLayerInPlace('${catItem.id}')" class="px-3 py-1.5 rounded-xl font-black text-[11px] transition cursor-pointer ${
                      isVis
                        ? 'bg-emerald-600 text-white shadow-sm hover:bg-rose-600'
                        : 'bg-blue-600 text-white shadow-sm hover:bg-blue-500'
                    }">
                      ${isVis ? '✅ مفعّلة' : '+ إضافة'}
                    </button>
                  </div>
                </div>
                ${isExpanded ? this.buildInlineAccordionInspectorHtml(catItem.id) : ''}
              </div>
            `;
          })
          .join('');

        subTabBodyHtml = `
          <div class="space-y-3">
            <div class="flex items-center gap-1.5">
              <input id="v61CatalogSearchInp" type="text" value="${this.layerCatalogSearch || ''}" oninput="window.GherbiPrintStudioV45.onCatalogSearchInPlace(this.value)" placeholder="🔎 ابحث في الـ 36 طبقة (Alt+D، تسديد، سلع الدين، F8، وردية...)" class="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold outline-none focus:border-blue-500">
              <button type="button" onclick="window.GherbiPrintStudioV45.applySingleProDefaultTemplate('${cfg.activeDocType}')" class="px-2.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 border border-amber-400 font-black text-[10.5px] whitespace-nowrap transition cursor-pointer" title="تطبيق الطبقات المثالية لهذا المستند">
                ⚡ مثالي للقالب
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.enableAllSuggestedLayersInPlace()" class="px-2.5 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-600 text-indigo-900 hover:text-white font-black text-[10.5px] whitespace-nowrap transition cursor-pointer">
                ✨ تفعيل الكل
              </button>
            </div>

            <!-- أزرار الفلترة المحدثة لـ 36 طبقة ذكية -->
            <div class="flex flex-wrap items-center gap-1 text-[11px]">
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('ALL')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">الكل (36)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('FOR_DOC')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'FOR_DOC' ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-blue-300'}">🎯 طبقات هذا القالب</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('CORE')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'CORE' ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}">🏛️ الأساسية (6)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('FINANCE')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'FINANCE' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 dark:bg-slate-700 text-emerald-800 dark:text-emerald-300'}">💳 الديون والكريدي (8)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('LOYALTY')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'LOYALTY' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-amber-50 dark:bg-slate-700 text-amber-800 dark:text-amber-300'}">👑 الوفاء F8/F9 (6)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('CAISSE_FISCAL')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'CAISSE_FISCAL' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 dark:bg-slate-700 text-rose-800 dark:text-rose-300'}">🏦 الصندوق والوردية (7)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('INVENTORY')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'INVENTORY' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 dark:bg-slate-700 text-indigo-800 dark:text-indigo-300'}">📦 المخزون والمشتريات (5)</button>
              <button type="button" onclick="window.GherbiPrintStudioV45.setCatalogFilterInPlace('LOGISTICS')" class="px-2.5 py-1 rounded-xl font-black cursor-pointer ${catFilter === 'LOGISTICS' ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 dark:bg-slate-700 text-teal-800 dark:text-teal-300'}">🚚 الضمان والتوصيل (4)</button>
            </div>

            <div id="v61LeftScrollContainer" class="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              ${cardsHtml}
            </div>
          </div>
        `;
      } else if (subTab === 'layers_stack') {
        const layersToShow = this.showOnlyActiveLayersInStack
          ? cfg.layers.filter((l) => l.visible)
          : cfg.layers;

        const stackRowsHtml = layersToShow
          .map((l) => {
            const realIdx = cfg.layers.findIndex((x) => x.id === l.id);
            const isExpanded = this.expandedInspectorLayerId === l.id;
            return `
              <div class="p-2.5 rounded-2xl border transition ${
                isExpanded
                  ? 'bg-white dark:bg-slate-800 border-2 border-blue-500 shadow-md'
                  : l.visible
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold hover:border-blue-400'
                  : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 text-slate-400'
              }">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2 truncate flex-1 min-w-0 cursor-pointer" onclick="window.GherbiPrintStudioV45.toggleLayerInPlace('${l.id}')">
                    <input type="checkbox" ${l.visible ? 'checked' : ''} onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleLayerInPlace('${l.id}')" class="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0">
                    <span class="truncate ${l.visible ? 'font-black text-slate-900 dark:text-white' : 'line-through'}">${l.name}</span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.toggleInlineInspector('${l.id}')" class="px-2 py-1 rounded-lg ${
                      isExpanded ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300'
                    } font-black text-[10.5px] hover:bg-blue-600 hover:text-white cursor-pointer">
                      ⚙️ تعديل
                    </button>
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayerInPlace('${l.id}', -1)" ${realIdx === 0 ? 'disabled' : ''} class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10.5px] hover:bg-blue-600 hover:text-white disabled:opacity-30 cursor-pointer">▲</button>
                    <button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.moveLayerInPlace('${l.id}', 1)" ${realIdx === cfg.layers.length - 1 ? 'disabled' : ''} class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10.5px] hover:bg-blue-600 hover:text-white disabled:opacity-30 cursor-pointer">▼</button>
                    ${
                      l.id.startsWith('custom_')
                        ? `<button type="button" onclick="event.stopPropagation(); window.GherbiPrintStudioV45.deleteCustomLayerInPlace('${l.id}')" class="px-2 py-1 rounded-lg bg-rose-100 text-rose-600 text-[10.5px] hover:bg-rose-600 hover:text-white cursor-pointer">✕</button>`
                        : ''
                    }
                  </div>
                </div>
                ${isExpanded ? this.buildInlineAccordionInspectorHtml(l.id) : ''}
              </div>
            `;
          })
          .join('');

        subTabBodyHtml = `
          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-1.5">
              <button type="button" onclick="window.GherbiPrintStudioV45.toggleShowOnlyActiveLayersInStack()" class="px-2.5 py-1.5 rounded-xl font-black text-[11px] border cursor-pointer ${
                this.showOnlyActiveLayersInStack
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }">
                ${this.showOnlyActiveLayersInStack ? `👁️ عرض المفعّلة فقط (${activeLayersCount}) — اضغط لعرض كل الـ 36` : '🌐 عرض جميع الـ 36 طبقة'}
              </button>
              <button type="button" onclick="window.GherbiPrintStudioV45.addCustomLayerInPlace()" class="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-500 cursor-pointer shrink-0 shadow-sm">
                + طبقة نصية حرة
              </button>
            </div>
            <div id="v61LeftScrollContainer" class="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
              ${stackRowsHtml}
            </div>
          </div>
        `;
      } else {
        subTabBodyHtml = `
          <div id="v61LeftScrollContainer" class="space-y-4 max-h-[64vh] overflow-y-auto pr-1 text-xs">
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div class="border-b border-slate-200 dark:border-slate-700 pb-2 space-y-2">
                <h4 class="font-black text-slate-900 dark:text-white">📊 قوالب الأعمدة السريعة وتخصيص الجدول</h4>
                <div class="flex flex-wrap gap-1 text-[10px]">
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('thermal_simple')" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border font-black cursor-pointer">🧾 تذكرة 80mm</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('alt_d_credit_ticket')" class="px-2 py-1 rounded-lg bg-rose-600 text-white font-black cursor-pointer">📝 تأكيد دين Alt+D</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('alt_h_debt_statement')" class="px-2 py-1 rounded-lg bg-indigo-600 text-white font-black cursor-pointer">📜 كشف ديون Alt+H</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('z_report_shift')" class="px-2 py-1 rounded-lg bg-slate-900 text-amber-400 font-black cursor-pointer">🔒 وردية Z-Report</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('a4_full')" class="px-2 py-1 rounded-lg bg-blue-600 text-white font-black cursor-pointer">📄 فاتورة A4 كاملة</button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.applyTableColumnsPresetInPlace('delivery_qty_only')" class="px-2 py-1 rounded-lg bg-emerald-600 text-white font-black cursor-pointer">🚚 وصل كميات BL</button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2.5 font-bold">
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.index ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('index')" class="w-4 h-4 accent-blue-600"> <span>رقم السطر (#)</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.barcode ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('barcode')" class="w-4 h-4 accent-blue-600"> <span>الباركود / الكود</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.name ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('name')" class="w-4 h-4 accent-blue-600"> <span>التعيين / البيان</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.unit ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('unit')" class="w-4 h-4 accent-blue-600"> <span>الوحدة / الحالة</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.qty ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('qty')" class="w-4 h-4 accent-blue-600"> <span>الكمية</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.unitPrice ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('unitPrice')" class="w-4 h-4 accent-blue-600"> <span>سعر الوحدة / القيمة</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.discount ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('discount')" class="w-4 h-4 accent-blue-600"> <span>الخصم</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" ${cfg.columns.tva ? 'checked' : ''} onchange="window.GherbiPrintStudioV45.toggleColumnInPlace('tva')" class="w-4 h-4 accent-blue-600"> <span>ضريبة TVA</span></label>
              </div>

              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div><label class="block text-[10.5px] font-bold text-slate-500 mb-0.5">عنوان عمود الصنف:</label><input type="text" value="${ct.colName || 'التعيين / الصنف'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colName', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
                <div><label class="block text-[10.5px] font-bold text-slate-500 mb-0.5">عنوان عمود الكمية:</label><input type="text" value="${ct.colQty || 'الكمية'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colQty', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
                <div><label class="block text-[10.5px] font-bold text-slate-500 mb-0.5">عنوان عمود السعر:</label><input type="text" value="${ct.colPrice || 'سعر الوحدة'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colPrice', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
                <div><label class="block text-[10.5px] font-bold text-slate-500 mb-0.5">عنوان عمود المجموع:</label><input type="text" value="${ct.colSubtotal || 'المجموع'}" oninput="window.GherbiPrintStudioV45.updateCustomColumnHeaderTitle('colSubtotal', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
              </div>
            </div>

            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <h4 class="font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1.5">🏢 بيانات المتجر والبيانات الجبائية والتذييل</h4>
              <div class="grid grid-cols-2 gap-2">
                <div class="col-span-2"><label class="block font-bold mb-0.5">اسم المتجر / المؤسسة:</label><input type="text" value="${shop.name}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_name', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-black"></div>
                <div><label class="block font-bold mb-0.5">رقم الهاتف:</label><input type="text" value="${shop.phone}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_phone', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-mono"></div>
                <div><label class="block font-bold mb-0.5">العنوان:</label><input type="text" value="${shop.address}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_address', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800"></div>
                <div><label class="block font-bold mb-0.5">السجل التجاري (RC):</label><input type="text" value="${shop.rc}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_rc', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-mono"></div>
                <div><label class="block font-bold mb-0.5">الرقم الجبائي (NIF):</label><input type="text" value="${shop.nif}" oninput="window.GherbiPrintStudioV45.updateShopIdentityQuickField('shop_nif', this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-mono"></div>
                <div class="col-span-2"><label class="block font-bold mb-0.5">عبارة التذييل وشروط الاستبدال:</label><input type="text" value="${cfg.customFooterTerms || ''}" oninput="window.GherbiPrintStudioV45.updateFooterTermsInPlace(this.value)" class="w-full px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 font-bold"></div>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3.5">
          <div class="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl text-xs">
            <button type="button" onclick="window.GherbiPrintStudioV45.switchLeftSubTab('catalog_30')" class="py-2 px-2 rounded-xl font-black transition cursor-pointer ${
              subTab === 'catalog_30' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
            }">
              🧩 1. مكتبة الـ 36 طبقة
            </button>
            <button type="button" onclick="window.GherbiPrintStudioV45.switchLeftSubTab('layers_stack')" class="py-2 px-2 rounded-xl font-black transition cursor-pointer ${
              subTab === 'layers_stack' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
            }">
              🗂️ 2. الترتيب (${activeLayersCount})
            </button>
            <button type="button" onclick="window.GherbiPrintStudioV45.switchLeftSubTab('columns_and_shop')" class="py-2 px-2 rounded-xl font-black transition cursor-pointer ${
              subTab === 'columns_and_shop' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
            }">
              📊 3. الأعمدة والمتجر
            </button>
          </div>

          ${subTabBodyHtml}
        </div>
      `;
    };

    console.log('✅ [V70 Part 3]: تمت ترقية لوحة الأدوات الجانبية وتفعيل الـ 36 طبقة ذكية بنجاح!');
  }, 160);
})();

/* ==================== [V70 PART 4: LIVE PAPER RENDERER FOR 36 LAYERS & 34 PRO COCKPIT] ==================== */
(function initV70Part4LiveRendererAnd34Cockpit() {
  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    const all34 = window.__GHERBI_V70_ALL_34_MASTER_TEMPLATES;
    const full36 = window.__GHERBI_V70_FULL_36_LAYERS;
    if (!studio || !all34 || !full36) return;
    clearInterval(waitStudio);

    studio.ALL_28_MASTER_DOCS = all34;
    studio.ALL_34_MASTER_DOCS = all34;
    studio.FULL_16_LAYERS_CATALOG = full36;
    studio.FULL_30_SMART_LAYERS = full36;
    studio.FULL_36_SMART_LAYERS = full36;

    // 1. بناء البروفايل المثالي (Par Défaut) لأي مستند من الـ 34 مستنداً بناءً على تعريفه الجديد من الصفر
    studio.buildIdealProfileObjectForDoc = function (docMeta) {
      const activeSet = new Set(
        docMeta.idealLayers || [
          'header_layer',
          'doc_banner_layer',
          'customer_box_layer',
          'items_table_layer',
          'totals_words_layer',
          'footer_stamp_layer'
        ]
      );
      const layersList = full36.map((cat) => ({
        id: cat.id,
        name: cat.name,
        visible: activeSet.has(cat.id),
        align: 'between',
        fontSizeScale: 100,
        textAlign: 'right',
        borderStyle: 'default',
        bgStyle: 'default',
        paddingMode: 'normal',
        customTitle: '',
        customNote: ''
      }));

      return {
        _v70CleanBuilt: true,
        paperSize: docMeta.defaultPaper,
        themeId: docMeta.defaultTheme,
        fontFamily: 'Cairo',
        baseFontSizePx: docMeta.defaultPaper === '80mm' || docMeta.defaultPaper === '58mm' ? 11.5 : 12,
        marginMode: 'normal',
        densityMode: 'normal',
        borderMode: docMeta.defaultPaper === '80mm' ? 'dashed' : 'grid',
        watermarkText: '',
        customHeaderTitle: docMeta.cleanTitle,
        customFooterTerms:
          this.config.customFooterTerms ||
          'البضاعة المباعة تستبدل خلال 48 ساعة بشرط سلامة الغلاف الأصلي وإحضار التذكرة. شكراً لثقتكم!',
        showCentimesEquivalent: true,
        showAmountInWords: true,
        showCustomerBalance: true,
        showBaridimobQr: true,
        showDocBarcode: true,
        showStampSignature: true,
        customTexts: JSON.parse(JSON.stringify(this.config.customTexts || {})),
        columns: {
          ...(docMeta.idealCols || {
            index: true,
            barcode: false,
            name: true,
            unit: true,
            qty: true,
            unitPrice: true,
            discount: false,
            tva: false,
            subtotal: true
          })
        },
        layers: layersList
      };
    };

    // تهيئة القوالب الـ 34 الجديدة تلقائياً عند الإقلاع
    if (!studio.config.defaultsByDocType) studio.config.defaultsByDocType = {};
    if (!studio.config.adoptedProfiles) studio.config.adoptedProfiles = {};

    for (const docMeta of all34) {
      if (!studio.config.defaultsByDocType[docMeta.id]) {
        studio.config.defaultsByDocType[docMeta.id] = {
          paperSize: docMeta.defaultPaper,
          themeId: docMeta.defaultTheme,
          lang: 'ar',
          adopted: true
        };
      }
      const existingProf = studio.config.adoptedProfiles[docMeta.id];
      if (!existingProf || !existingProf._v70CleanBuilt) {
        studio.config.adoptedProfiles[docMeta.id] = studio.buildIdealProfileObjectForDoc(docMeta);
      }
    }

    // 2. تزويد الورقة الحية بمحرك رسم الطبقات الـ 6 الجديدة (Alt+D, Alt+V, Alt+H, F8, Z-Report Cash vs Debt, Shift Expenses)
    const baseBuildPaper = studio.buildLiveDocumentPaperHtml.bind(studio);
    studio.buildLiveDocumentPaperHtml = function (docData, forPrintOutput = false, customOverrides = null) {
      const cfg = customOverrides ? { ...this.config, ...customOverrides } : this.config;
      const isThermal = cfg.paperSize === '80mm' || cfg.paperSize === '58mm';
      const editAttr = forPrintOutput ? '' : 'contenteditable="true" spellcheck="false"';

      let html = baseBuildPaper(docData, forPrintOutput, customOverrides);

      const prevDebt = Number(docData?.previousBalance || 0);
      const totalToday = Number(docData?.total || 0);
      const paidToday = Number(docData?.paidAmount ?? totalToday);
      const remToday = Math.max(0, Number((totalToday - paidToday).toFixed(2)));
      const newCumulativeDebt = Number((prevDebt + remToday).toFixed(2));
      const pts = Number(docData?.loyaltyTotalBalance || 79);

      const renderV70NewLayerHtml = (layer) => {
        const lid = layer.id;
        const cTitle = this.interpolateSmartVariables(layer.customTitle, docData);
        const cNote = this.interpolateSmartVariables(layer.customNote, docData);
        const noteLine = cNote
          ? `<div ${editAttr} style="margin-top:4px;padding-top:3px;border-top:1px dashed #cbd5e1;font-size:9.5px;font-weight:800;">📌 ${cNote}</div>`
          : '';

        if (lid === 'alt_d_debt_confirmation_box_layer') {
          return `
            <div style="border:2px solid #e11d48;border-radius:9px;padding:7px 9px;background:#fff1f2;color:#881337;font-size:${isThermal ? '10px' : '11px'};">
              <div ${editAttr} style="font-weight:900;font-size:${isThermal ? '11px' : '12px'};border-bottom:1.5px dashed #fda4af;padding-bottom:3px;margin-bottom:5px;color:#be123c;text-align:center;">
                📝 ${cTitle || 'بطاقة تأكيد عملية البيع بالدين (Alt + D)'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;font-weight:800;line-height:1.5;">
                <div ${editAttr}>• الدين السابق للزبون: <strong style="font-family:monospace;">${this.fmtDzd(prevDebt)}</strong></div>
                <div ${editAttr}>• إجمالي سلة اليوم: <strong style="font-family:monospace;">${this.fmtDzd(totalToday)}</strong></div>
                <div ${editAttr} style="color:#047857;">• المدفوع نقداً اليوم: <strong style="font-family:monospace;">${this.fmtDzd(paidToday)}</strong></div>
                <div ${editAttr} style="color:#be123c;">• الدين المضاف اليوم: <strong style="font-family:monospace;">+${this.fmtDzd(remToday)}</strong></div>
              </div>
              <div ${editAttr} style="margin-top:5px;padding:4px 6px;border-radius:6px;background:#be123c;color:#ffffff;font-weight:900;display:flex;justify-content:space-between;align-items:center;">
                <span>📌 إجمالي الدين التراكمي الجديد:</span>
                <span style="font-family:monospace;font-size:${isThermal ? '11.5px' : '13px'};">${this.fmtDzd(newCumulativeDebt)}</span>
              </div>
              <div ${editAttr} style="margin-top:5px;text-align:center;font-weight:800;font-size:9.5px;color:#475569;">
                ✍️ إمضاء الزبون بالقبول والاستلام: ........................................
              </div>
              ${noteLine}
            </div>`;
        }

        if (lid === 'alt_v_debt_settlement_voucher_layer') {
          const debtBefore = prevDebt > 0 ? prevDebt : totalToday + 270;
          const paidNow = totalToday;
          const debtAfter = Math.max(0, Number((debtBefore - paidNow).toFixed(2)));
          return `
            <div style="border:2px solid #059669;border-radius:9px;padding:7px 9px;background:#ecfdf5;color:#064e3b;font-size:${isThermal ? '10px' : '11px'};">
              <div ${editAttr} style="font-weight:900;font-size:${isThermal ? '11px' : '12px'};border-bottom:1.5px dashed #6ee7b7;padding-bottom:3px;margin-bottom:5px;color:#047857;text-align:center;">
                💵 ${cTitle || 'بطاقة تسديد وقبض دين زبون (Alt + V)'}
              </div>
              <div style="line-height:1.65;font-weight:800;">
                <div style="display:flex;justify-content:space-between;"><span ${editAttr}>1. الرصيد المدين قبل الدفع:</span><strong style="font-family:monospace;color:#be123c;">${this.fmtDzd(debtBefore)}</strong></div>
                <div style="display:flex;justify-content:space-between;color:#047857;"><span ${editAttr}>2. المبلغ المقبوض اليوم (-):</span><strong style="font-family:monospace;">-${this.fmtDzd(paidNow)}</strong></div>
                <div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px solid #6ee7b7;margin-top:3px;padding-top:3px;font-size:${isThermal ? '11px' : '12px'};">
                  <span ${editAttr}>3. صافي الدين المتبقي بعد الدفعة:</span>
                  <strong style="font-family:monospace;color:${debtAfter > 0.05 ? '#be123c' : '#047857'};">${this.fmtDzd(debtAfter)}</strong>
                </div>
              </div>
              ${noteLine}
            </div>`;
        }

        if (lid === 'alt_h_items_taken_history_layer') {
          return `
            <div style="border:1.5px solid #4f46e5;border-radius:9px;padding:7px 10px;background:#eef2ff;color:#1e1b4b;font-size:${isThermal ? '9.5px' : '11px'};">
              <div ${editAttr} style="font-weight:900;color:#4338ca;margin-bottom:3px;">
                📜 ${cTitle || 'ملخص هيستوريك السلع المسحوبة على الحساب (Alt + H):'}
              </div>
              <div ${editAttr} style="font-weight:700;line-height:1.45;">
                يوضح الجدول أدناه كافة السلع والكميات التي استلمها الزبون الوفي في فواتير الدين مع التواريخ والدفعات المسددة منها.
              </div>
              ${noteLine}
            </div>`;
        }

        if (lid === 'f8_vip_points_and_debt_dual_layer') {
          const displayDebt = docData.isWalkinCustomer ? 0 : (newCumulativeDebt > 0 ? newCumulativeDebt : prevDebt);
          return `
            <div style="border:1.5px solid #f59e0b;border-radius:9px;padding:6px 8px;background:linear-gradient(135deg,#fffbeb 0%,#fff1f2 100%);color:#0f172a;font-size:${isThermal ? '9.5px' : '11px'};">
              <div ${editAttr} style="font-weight:900;text-align:center;color:#b45309;margin-bottom:4px;border-bottom:1px dashed #fcd34d;padding-bottom:2px;">
                👑 ${cTitle || 'بطاقة الوضعية الشاملة للزبون الوفي (F8: النقاط + الديون)'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px;text-align:center;font-weight:900;">
                <div ${editAttr} style="background:#ffffff;border:1px solid #fcd34d;border-radius:6px;padding:3px;">
                  <div style="font-size:9px;color:#b45309;">⭐ رصيد نقاط الوفاء</div>
                  <div style="font-family:monospace;color:#78350f;">${docData.isWalkinCustomer ? '0 نقطة' : `${pts} ن (${pts * 2} د.ج)`}</div>
                </div>
                <div ${editAttr} style="background:#ffffff;border:1px solid #fda4af;border-radius:6px;padding:3px;">
                  <div style="font-size:9px;color:#be123c;">💳 إجمالي الديون الحالية</div>
                  <div style="font-family:monospace;color:${displayDebt > 0.05 ? '#be123c' : '#047857'};">${this.fmtDzd(displayDebt)}</div>
                </div>
              </div>
              ${noteLine}
            </div>`;
        }

        if (lid === 'shift_cash_vs_debt_reconciliation_layer') {
          return `
            <div style="border:2px solid #0f172a;border-radius:9px;padding:7px 9px;background:#f8fafc;color:#0f172a;font-size:${isThermal ? '9.5px' : '11px'};">
              <div ${editAttr} style="font-weight:900;text-align:center;background:#0f172a;color:#ffffff;padding:3px 6px;border-radius:5px;margin-bottom:5px;">
                🏦 ${cTitle || 'ميزان الوردية المزدوج: سيولة الدرج مقابل ديون الوردية'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;text-align:center;font-weight:900;">
                <div ${editAttr} style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:7px;padding:4px;">
                  <div style="font-size:9px;color:#1d4ed8;">💵 السيولة النقدية المتوقعة بالدرج</div>
                  <div style="font-family:monospace;font-size:11.5px;color:#1e3a8a;">${this.fmtDzd(totalToday)}</div>
                </div>
                <div ${editAttr} style="background:#fff1f2;border:1.5px solid #fda4af;border-radius:7px;padding:4px;">
                  <div style="font-size:9px;color:#be123c;">💳 ديون ممنوحة بالوردية (آجلة)</div>
                  <div style="font-family:monospace;font-size:11.5px;color:#881337;">${this.fmtDzd(prevDebt)}</div>
                </div>
              </div>
              <div ${editAttr} style="margin-top:4px;font-size:9px;font-weight:800;color:#475569;text-align:center;">
                ✔ الديون الممنوحة (Alt+D) مسجلة في ذمة الزبائن ولا تدخل في عدّ أوراق الدرج، بينما تسديدات الديون (Alt+V) مضافة في الدرج.
              </div>
              ${noteLine}
            </div>`;
        }

        if (lid === 'shift_expenses_and_inflows_layer') {
          return `
            <div style="border:1.5px dashed #475569;border-radius:8px;padding:6px 8px;background:#ffffff;font-size:${isThermal ? '9.5px' : '10.5px'};color:#1e293b;">
              <div ${editAttr} style="font-weight:900;color:#0f172a;margin-bottom:3px;">
                💸 ${cTitle || 'ملخص المصاريف والإيداعات وتحصيل الديون في الوردية:'}
              </div>
              <div ${editAttr} style="display:flex;justify-content:space-between;font-weight:800;">
                <span>• تحصيلات الديون (Alt+V): مقبوضة بالدرج ✔</span>
                <span>• المصاريف والسحوبات: مخصومة من الدرج ✔</span>
              </div>
              ${noteLine}
            </div>`;
        }

        return null;
      };

      // حقن الطبقات الـ 6 الجديدة داخل الـ HTML الحي للورقة
      for (const layer of cfg.layers || []) {
        if (!layer.visible) continue;
        const customInner = renderV70NewLayerHtml(layer);
        if (!customInner) continue;

        const layerBlockRegex = new RegExp(
          `(<div[^>]*data-v47-layer-id="${layer.id}"[\\s\\S]*?<\\/div>\\s*)<div[^>]*>[\\s\\S]*?<\\/div>(\\s*<\\/div>)`
        );
        if (layerBlockRegex.test(html)) {
          html = html.replace(layerBlockRegex, `$1<div>${customInner}</div>$2`);
        } else {
          // إذا لم يكن المحرك القديم يعرف الـ ID الجديد، نضيف الطبقة مباشرةً قبل التذييل داخل .v45-live-paper
          const handleHtml = forPrintOutput
            ? ''
            : `<div class="v45-layer-handle-bar"><span>${layer.name}</span><span>⚙️ طبقة ذكية V70</span></div>`;
          const fullLayerNode = `<div class="v45-canvas-layer" data-v47-layer-id="${layer.id}">${handleHtml}<div>${customInner}</div></div>`;
          const footerPos = html.indexOf('data-v47-layer-id="footer_stamp_layer"');
          if (footerPos !== -1) {
            const insertAt = html.lastIndexOf('<div', footerPos);
            html = html.slice(0, insertAt) + fullLayerNode + html.slice(insertAt);
          }
        }
      }

      return html;
    };

    // تحديث العرض إذا كان مركز الطباعة مفتوحاً
    studio.loadProfileForDocType(studio.config.activeDocType || 'receipt_thermal');
    studio.saveConfigLocal();
    if (document.getElementById('view-print')?.classList.contains('active')) {
      studio.renderStudioIntoRoot();
    }

    console.log('🏆 [Gherbi V70 Part 4 Complete]: اكتملت إعادة بناء الـ 34 مستنداً افتراضياً والـ 36 طبقة ذكية وأدوات الاستوديو من الصفر المطلق بنجاح 100%!');
  }, 180);
})();

/* ==================== [V73 TURBO PRINT STUDIO & SUB-TABBED PARTITIONING ENGINE] ==================== */
(function initV73TurboPrintStudioAndZeroLagEngine() {
  const STUDIO_7_PRO_THEMES = {
    royal_blue: { id: 'royal_blue', name: 'الأزرق الملكي التجاري (Royal Blue)', primary: '#1d4ed8', secondary: '#1e3a8a', accentBg: '#eff6ff', border: '#93c5fd' },
    executive_dark: { id: 'executive_dark', name: 'الكحلي التنفيذي الفاخر (Executive Dark)', primary: '#0f172a', secondary: '#334155', accentBg: '#f8fafc', border: '#cbd5e1' },
    emerald_dz: { id: 'emerald_dz', name: 'الأخضر الجزائري الرسمي (Emerald DZ)', primary: '#047857', secondary: '#064e3b', accentBg: '#ecfdf5', border: '#6ee7b7' },
    crimson_bold: { id: 'crimson_bold', name: 'القرمزي البارز للديون والعروض (Crimson)', primary: '#be123c', secondary: '#881337', accentBg: '#fff1f2', border: '#fda4af' },
    amber_gold: { id: 'amber_gold', name: 'الذهبي الكلاسيكي للوفاء (Amber Gold)', primary: '#b45309', secondary: '#78350f', accentBg: '#fffbeb', border: '#fcd34d' },
    indigo_pro: { id: 'indigo_pro', name: 'النيلي المؤسسي الحديث (Indigo Pro)', primary: '#4338ca', secondary: '#312e81', accentBg: '#eef2ff', border: '#a5b4fc' },
    pure_mono: { id: 'pure_mono', name: 'الأسود والأبيض الاقتصادي (Pure Mono)', primary: '#111827', secondary: '#374151', accentBg: '#ffffff', border: '#9ca3af' }
  };

  const NEW_DOC_IDS_SET = new Set([
    'debt_confirm_ticket_80mm',
    'pos_partial_credit_80mm',
    'customer_debt_history_a4',
    'global_debtors_register_a4',
    'f8_vip_loyalty_debt_card_80mm',
    'caisse_shift_full_audit_a4',
    'caisse_cash_in_voucher_80mm'
  ]);

  // 1. دالة ضبط تخطيط شاشة المبيعات والشريط العلوي (تعمل عند تغيير الحجم أو تبديل الصفحة فقط — بدون setInterval يثقل المعالج!)
  const applyPosAndTopNavLayoutOnce = () => {
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.getElementById('sidebar-nav');
    if (sidebar && sidebarNav) {
      const isHorizontalMode =
        sidebar.offsetWidth > 500 ||
        window.getComputedStyle(sidebarNav).flexDirection === 'row' ||
        document.body.classList.contains('top-nav-mode');

      if (isHorizontalMode) {
        sidebar.style.height = 'auto';
        sidebar.style.maxHeight = '92px';
        sidebar.style.overflow = 'visible';
        sidebarNav.style.display = 'flex';
        sidebarNav.style.flexDirection = 'row';
        sidebarNav.style.flexWrap = 'wrap';
        sidebarNav.style.alignItems = 'center';
        sidebarNav.style.gap = '4px';
        sidebarNav.style.padding = '5px 10px';
        sidebarNav.style.overflow = 'visible';

        sidebarNav.querySelectorAll('.uppercase.sidebar-label').forEach((lbl) => {
          lbl.style.display = 'none';
        });
        sidebarNav.querySelectorAll('.nav-btn').forEach((btn) => {
          btn.style.width = 'auto';
          btn.style.padding = '4px 8px';
          btn.style.fontSize = '11px';
          btn.style.borderRadius = '8px';
          btn.style.whiteSpace = 'nowrap';
          btn.style.flexShrink = '0';
        });
      }
    }

    const debtEng = window.GherbiDebtV68;
    if (debtEng && !debtEng._v73CompactBannerPatched) {
      debtEng._v73CompactBannerPatched = true;
      const origRefreshBanner = debtEng.refreshLivePosDebtBannerAndButtons.bind(debtEng);
      debtEng.refreshLivePosDebtBannerAndButtons = function () {
        if (!document.getElementById('view-pos')?.classList.contains('active')) return;
        origRefreshBanner();
        const cust = this.detectActivePosCustomer();
        const banner = document.getElementById('v68CustomerLiveDebtBanner');
        if (banner && !cust) {
          banner.innerHTML = '';
          banner.style.marginTop = '0px';
        } else if (banner && cust) {
          banner.style.marginTop = '4px';
        }
      };
    }
  };

  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    const all34 = window.__GHERBI_V70_ALL_34_MASTER_TEMPLATES;
    const full36 = window.__GHERBI_V70_FULL_36_LAYERS;
    if (!studio || !Array.isArray(all34) || all34.length < 34 || !Array.isArray(full36)) return;
    clearInterval(waitStudio);

    applyPosAndTopNavLayoutOnce();
    window.addEventListener('resize', applyPosAndTopNavLayoutOnce);

    // تثبيت الكائنات المرجعية على studio
    studio.THEMES = { ...(studio.THEMES || {}), ...STUDIO_7_PRO_THEMES };
    studio.ALL_28_MASTER_DOCS = all34;
    studio.ALL_34_MASTER_DOCS = all34;
    studio.FULL_16_LAYERS_CATALOG = full36;
    studio.FULL_30_SMART_LAYERS = full36;
    studio.FULL_36_SMART_LAYERS = full36;

    // افتراضياً في التبويب الأول نعرض "طبقات هذا القالب فقط" (7 طبقات بدلاً من 36) لسرعة فائقة
    if (!studio.catalogCategoryFilter || studio.catalogCategoryFilter === 'ALL') {
      studio.catalogCategoryFilter = 'FOR_DOC';
    }
    // افتراضياً في التبويب الخامس نعرض قسم "💳 الديون والوفاء (11)" بدلاً من رسم 34 بطاقة دفعة واحدة
    if (!studio.defaultsCatFilter || studio.defaultsCatFilter === 'ALL') {
      studio.defaultsCatFilter = 'CREDIT';
    }
    studio.tab5Page = 1;
    studio.tab5PageSize = 9;

    if (!studio._origBaseRenderStudio) {
      studio._origBaseRenderStudio = studio.renderStudioIntoRoot.bind(studio);
    }

    // ========================================================================
    // 1. إصلاح وتثبيت دوال حفظ وتحميل البروفايل (يحل خطأ saveCurrentProfileToMap نهائياً!)
    // ========================================================================
    studio.getActiveDocMeta = function (docId = null) {
      const targetId = docId || this.config?.activeDocType || 'receipt_thermal';
      return all34.find((d) => d.id === targetId) || all34[0];
    };

    studio.saveCurrentProfileToMap = function () {
      const cfg = this.config;
      if (!cfg) return;
      const docType = cfg.activeDocType || 'receipt_thermal';
      if (!cfg.adoptedProfiles) cfg.adoptedProfiles = {};
      if (!cfg.defaultsByDocType) cfg.defaultsByDocType = {};

      cfg.adoptedProfiles[docType] = {
        _v70CleanBuilt: true,
        paperSize: cfg.paperSize || '80mm',
        themeId: cfg.themeId || 'royal_blue',
        fontFamily: cfg.fontFamily || 'Cairo',
        baseFontSizePx: Number(cfg.baseFontSizePx || 12),
        marginMode: cfg.marginMode || 'normal',
        densityMode: cfg.densityMode || 'normal',
        borderMode: cfg.borderMode || 'grid',
        watermarkText: cfg.watermarkText || '',
        customHeaderTitle: cfg.customHeaderTitle || '',
        customFooterTerms: cfg.customFooterTerms || '',
        showCentimesEquivalent: cfg.showCentimesEquivalent !== false,
        showAmountInWords: cfg.showAmountInWords !== false,
        showCustomerBalance: cfg.showCustomerBalance !== false,
        showBaridimobQr: cfg.showBaridimobQr !== false,
        showDocBarcode: cfg.showDocBarcode !== false,
        showStampSignature: cfg.showStampSignature !== false,
        customTexts: JSON.parse(JSON.stringify(cfg.customTexts || {})),
        columns: JSON.parse(JSON.stringify(cfg.columns || {})),
        layers: JSON.parse(JSON.stringify(cfg.layers || []))
      };

      cfg.defaultsByDocType[docType] = {
        ...(cfg.defaultsByDocType[docType] || {}),
        paperSize: cfg.paperSize || '80mm',
        themeId: cfg.themeId || 'royal_blue',
        lang: cfg.lang || 'ar',
        adopted: true
      };
    };

    studio.loadProfileForDocType = function (docType) {
      const targetId = docType || 'receipt_thermal';
      const cfg = this.config;
      cfg.activeDocType = targetId;

      const docMeta = this.getActiveDocMeta(targetId);
      if (!cfg.adoptedProfiles) cfg.adoptedProfiles = {};
      if (!cfg.defaultsByDocType) cfg.defaultsByDocType = {};

      let prof = cfg.adoptedProfiles[targetId];
      if (!prof || !Array.isArray(prof.layers) || prof.layers.length === 0) {
        prof = this.buildIdealProfileObjectForDoc(docMeta);
        cfg.adoptedProfiles[targetId] = prof;
      }

      const def = cfg.defaultsByDocType[targetId] || {};
      cfg.paperSize = def.paperSize || prof.paperSize || docMeta.defaultPaper || '80mm';
      cfg.themeId = def.themeId || prof.themeId || docMeta.defaultTheme || 'royal_blue';
      cfg.fontFamily = prof.fontFamily || 'Cairo';
      cfg.baseFontSizePx = Number(prof.baseFontSizePx || (cfg.paperSize === '80mm' ? 11.5 : 12));
      cfg.marginMode = prof.marginMode || 'normal';
      cfg.densityMode = prof.densityMode || 'normal';
      cfg.borderMode = prof.borderMode || (cfg.paperSize === '80mm' ? 'dashed' : 'grid');
      cfg.watermarkText = prof.watermarkText || '';
      cfg.customHeaderTitle = prof.customHeaderTitle || docMeta.cleanTitle || docMeta.name;
      if (prof.customFooterTerms) cfg.customFooterTerms = prof.customFooterTerms;
      if (prof.customTexts) cfg.customTexts = JSON.parse(JSON.stringify(prof.customTexts));
      if (prof.columns) cfg.columns = { ...cfg.columns, ...prof.columns };
      if (Array.isArray(prof.layers)) cfg.layers = JSON.parse(JSON.stringify(prof.layers));

      this.sync30LayersWithActiveConfig();
    };

    // ========================================================================
    // 2. دوال التحديث الجراحي الفوري (Surgical DOM Updates — سرعة أقل من 5ms بدون إعادة رسم الصفحة!)
    // ========================================================================
    studio._rafPaperPending = false;
    studio.refreshPaperHostOnly = function () {
      if (this._rafPaperPending) return;
      this._rafPaperPending = true;
      requestAnimationFrame(() => {
        this._rafPaperPending = false;
        const wsHost = document.getElementById('v45WorkspaceHost');
        if (!wsHost) return;
        const sampleDoc = this.buildSampleDocDataForType(this.config.activeDocType);
        wsHost.innerHTML = this.buildLiveDocumentPaperHtml(sampleDoc, false);
      });
    };

    studio.refreshLeftSidebarOnly = function () {
      const leftHost = document.getElementById('v61LeftSidebarHost');
      if (!leftHost) return;
      const scrollEl = document.getElementById('v61LeftScrollContainer');
      const prevScroll = scrollEl ? scrollEl.scrollTop : 0;

      leftHost.innerHTML = this.buildLeftSidebarPanelHtml();

      const newScrollEl = document.getElementById('v61LeftScrollContainer');
      if (newScrollEl && prevScroll > 0) {
        newScrollEl.scrollTop = prevScroll;
      }
    };

    // ربط جميع أزرار التبويب الأول بالتحديث الجراحي السريع بدلاً من إعادة رسم الصفحة الكاملة
    studio.switchLeftSubTab = function (subTabName) {
      this.leftPanelTab = subTabName || 'catalog_30';
      this.refreshLeftSidebarOnly();
    };

    studio.setCatalogFilterInPlace = function (catKey) {
      this.catalogCategoryFilter = catKey || 'FOR_DOC';
      this.refreshLeftSidebarOnly();
    };

    studio._searchDebounceTimer = null;
    studio.onCatalogSearchInPlace = function (val) {
      this.layerCatalogSearch = String(val || '');
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = setTimeout(() => {
        this.refreshLeftSidebarOnly();
        const inp = document.getElementById('v61CatalogSearchInp');
        if (inp) {
          inp.focus();
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        }
      }, 120);
    };

    studio.toggleLayerInPlace = function (layerId) {
      this.sync30LayersWithActiveConfig();
      const target = (this.config.layers || []).find((l) => l.id === layerId);
      if (!target) return;
      target.visible = !target.visible;
      this.saveCurrentProfileToMap();
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
    };

    studio.moveLayerInPlace = function (layerId, direction) {
      const layers = this.config.layers || [];
      const idx = layers.findIndex((l) => l.id === layerId);
      if (idx === -1) return;
      const newIdx = idx + Number(direction);
      if (newIdx < 0 || newIdx >= layers.length) return;
      const temp = layers[idx];
      layers[idx] = layers[newIdx];
      layers[newIdx] = temp;
      this.saveCurrentProfileToMap();
      this.saveConfigLocal();
      this.refreshLeftSidebarOnly();
      this.refreshPaperHostOnly();
    };

    studio.toggleInlineInspector = function (layerId) {
      this.expandedInspectorLayerId = this.expandedInspectorLayerId === layerId ? null : layerId;
      this.refreshLeftSidebarOnly();
    };

    studio.toggleColumnInPlace = function (colKey) {
      if (!this.config.columns) this.config.columns = {};
      this.config.columns[colKey] = !this.config.columns[colKey];
      this.saveCurrentProfileToMap();
      this.saveConfigLocal();
      this.refreshPaperHostOnly();
    };

    studio.setPaperSizeInPlace = function (newSize) {
      this.config.paperSize = newSize || '80mm';
      this.saveCurrentProfileToMap();
      this.saveConfigLocal();
      this.refreshPaperHostOnly();
    };

    studio.setThemeInPlace = function (newThemeId) {
      this.config.themeId = newThemeId || 'royal_blue';
      this.saveCurrentProfileToMap();
      this.saveConfigLocal();
      this.refreshPaperHostOnly();
    };

    studio.adjustFontSizeInPlace = function (delta) {
      const cur = Number(this.config.baseFontSizePx || 12);
      const next = Math.max(9, Math.min(20, cur + Number(delta)));
      this.config.baseFontSizePx = next;
      const badge = document.getElementById('v61FontSizeBadge');
      if (badge) badge.textContent = `${next}px`;
      this.saveCurrentProfileToMap();
      this.saveConfigLocal();
      this.refreshPaperHostOnly();
    };

    studio.setZoomInPlace = function (zoomVal) {
      this.config.zoomPct = Number(zoomVal || 100);
      this.saveConfigLocal();
      this.refreshPaperHostOnly();
    };

    studio.switchDocType = function (newDocType) {
      if (!newDocType) return;
      this.saveCurrentProfileToMap();
      this.loadProfileForDocType(newDocType);
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    };

    studio.switchTab = function (tabId) {
      this.saveCurrentProfileToMap();
      this.config.activeTab = tabId || 'studio_invoices';
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    };

    studio.customizeCardInStudioNow = function (docId) {
      if (!docId) return;
      this.saveCurrentProfileToMap();
      this.loadProfileForDocType(docId);
      this.config.activeTab = 'studio_invoices';
      this.catalogCategoryFilter = 'FOR_DOC';
      this.saveConfigLocal();
      this.renderStudioIntoRoot();
    };

    // ========================================================================
    // 3. تقسيم قمرة القوالب الـ 34 (التبويب 5) إلى بوابات فرعية سريعة وتحديث جراحي للشبكة
    //    بحيث لا يرسم المتصفح أكثر من 9 إلى 11 بطاقة في الشاشة الواحدة!
    // ========================================================================
    studio.setTab5Category = function (catKey, pageNum = 1) {
      this.defaultsCatFilter = catKey || 'CREDIT';
      this.tab5Page = Number(pageNum || 1);
      this.refreshTab5CockpitOnly();
    };

    studio.onTab5SearchInput = function (qVal) {
      this.defaultsSearchQuery = String(qVal || '');
      this.tab5Page = 1;
      clearTimeout(this._tab5SearchTimer);
      this._tab5SearchTimer = setTimeout(() => {
        this.refreshTab5CockpitOnly(true);
      }, 120);
    };

    studio.setDefaultForDocType = function (docId, field, value) {
      if (!this.config.defaultsByDocType) this.config.defaultsByDocType = {};
      const docMeta = this.getActiveDocMeta(docId);
      if (!this.config.defaultsByDocType[docId]) {
        this.config.defaultsByDocType[docId] = {
          paperSize: docMeta.defaultPaper,
          themeId: docMeta.defaultTheme,
          lang: 'ar',
          adopted: true
        };
      }
      this.config.defaultsByDocType[docId][field] = value;

      if (this.config.adoptedProfiles && this.config.adoptedProfiles[docId]) {
        this.config.adoptedProfiles[docId][field] = value;
      }
      if (this.config.activeDocType === docId) {
        this.config[field] = value;
      }
      this.saveConfigLocal();
      this.refreshTab5CockpitOnly(true);
    };

    studio.buildTab5CockpitInnerHtml = function () {
      const cfg = this.config;
      const themesMap = this.THEMES || STUDIO_7_PRO_THEMES;
      const themesList = Object.values(themesMap);
      const catF = this.defaultsCatFilter || 'CREDIT';
      const q = (this.defaultsSearchQuery || '').trim().toLowerCase();

      const filteredAll = all34.filter((d) => {
        if (q) {
          return `${d.name} ${d.sourceLabel} ${d.proDesc} ${d.id}`.toLowerCase().includes(q);
        }
        if (catF === 'NEW_ONLY') return NEW_DOC_IDS_SET.has(d.id);
        if (catF !== 'ALL') return d.cat === catF;
        return true;
      });

      // نظام صفحات ذكي (Pagination) إذا اختار المستخدم "كل المستندات" لمنع رسم 34 بطاقة دفعة واحدة
      const pageSize = catF === 'ALL' && !q ? 9 : 12;
      const totalPages = Math.max(1, Math.ceil(filteredAll.length / pageSize));
      const curPage = Math.max(1, Math.min(totalPages, Number(this.tab5Page || 1)));
      const pageSlice = filteredAll.slice((curPage - 1) * pageSize, curPage * pageSize);

      const countPOS = all34.filter((d) => d.cat === 'POS').length;
      const countCREDIT = all34.filter((d) => d.cat === 'CREDIT').length;
      const countPURCH = all34.filter((d) => d.cat === 'PURCHASES').length;
      const countINV = all34.filter((d) => d.cat === 'INVENTORY').length;
      const countFIN = all34.filter((d) => d.cat === 'FINANCE').length;

      const cardsHtml = pageSlice
        .map((doc) => {
          const def = (cfg.defaultsByDocType && cfg.defaultsByDocType[doc.id]) || {
            paperSize: doc.defaultPaper,
            themeId: doc.defaultTheme
          };
          const pSize = def.paperSize || doc.defaultPaper;
          const tId = def.themeId || doc.defaultTheme;
          const themeObj = themesMap[tId] || STUDIO_7_PRO_THEMES.royal_blue;
          const isThermal = pSize === '80mm' || pSize === '58mm';
          const isNewDoc = NEW_DOC_IDS_SET.has(doc.id);

          return `
            <div class="v59-template-card ${isNewDoc ? 'border-rose-400 dark:border-rose-600' : ''}">
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="space-y-1 flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="px-2 py-0.5 rounded-lg bg-blue-600/15 text-blue-600 font-mono font-black text-[11px]">#${doc.num}</span>
                      ${
                        isNewDoc
                          ? `<span class="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px]">✨ جديد</span>`
                          : ''
                      }
                      <span class="font-black text-sm text-slate-900 dark:text-white leading-snug">${doc.name.replace(/^\S+\s+\d+\.\s*/, '')}</span>
                    </div>
                    <div onclick="App.switchView('${doc.sourcePage}')" class="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                      <span>🔗 مربوط مع: ${doc.sourceLabel} ⬅</span>
                    </div>
                  </div>

                  <div class="w-10 h-11 rounded-xl border-2 flex items-center justify-center font-mono font-black text-[9.5px] shrink-0" style="border-color:${themeObj.primary};color:${themeObj.primary};background:${themeObj.accentBg};">
                    ${pSize.toUpperCase()}
                  </div>
                </div>

                <div class="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                  ✨ ${doc.proDesc}
                </div>
              </div>

              <div class="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div class="grid grid-cols-2 gap-1.5">
                  <select onchange="window.GherbiPrintStudioV45.setDefaultForDocType('${doc.id}', 'paperSize', this.value)" class="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 font-bold text-[11px] border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <option value="a4" ${pSize === 'a4' ? 'selected' : ''}>📄 مقاس A4</option>
                    <option value="a5" ${pSize === 'a5' ? 'selected' : ''}>📑 مقاس A5</option>
                    <option value="2xa5" ${pSize === '2xa5' ? 'selected' : ''}>✂️ مقاس 2×A5</option>
                    <option value="80mm" ${pSize === '80mm' ? 'selected' : ''}>🧾 حراري 80mm</option>
                    <option value="58mm" ${pSize === '58mm' ? 'selected' : ''}>🧾 حراري 58mm</option>
                  </select>

                  <select onchange="window.GherbiPrintStudioV45.setDefaultForDocType('${doc.id}', 'themeId', this.value)" class="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 font-bold text-[11px] border border-slate-200 dark:border-slate-700 cursor-pointer">
                    ${themesList
                      .map((t) => `<option value="${t.id}" ${tId === t.id ? 'selected' : ''}>🎨 ${t.name.split('(')[0].trim()}</option>`)
                      .join('')}
                  </select>
                </div>

                <div class="grid grid-cols-3 gap-1.5">
                  <button type="button" onclick="window.GherbiPrintStudioV45.openCardQuickPreviewModal('${doc.id}')" class="py-2 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-800 dark:text-amber-300 hover:text-slate-950 font-black text-[11px] border border-amber-500/30 cursor-pointer">
                    👁️ معاينة
                  </button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.customizeCardInStudioNow('${doc.id}')" class="py-2 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] shadow-sm cursor-pointer">
                    🎨 تخصيص
                  </button>
                  <button type="button" onclick="window.GherbiPrintStudioV45.applySingleProDefaultTemplate('${doc.id}')" class="py-2 px-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white font-black text-[11px] border border-emerald-500/30 cursor-pointer">
                    ⚡ جاهز
                  </button>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      const paginationBarHtml =
        totalPages > 1
          ? `
            <div class="flex items-center justify-center gap-2 pt-2">
              <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('${catF}', ${Math.max(1, curPage - 1)})" ${curPage === 1 ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border font-black text-xs disabled:opacity-40 cursor-pointer">◀ الصفحة السابقة</button>
              <span class="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-black text-xs">صفحة ${curPage} من ${totalPages} (إجمالي ${filteredAll.length} مستند)</span>
              <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('${catF}', ${Math.min(totalPages, curPage + 1)})" ${curPage === totalPages ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border font-black text-xs disabled:opacity-40 cursor-pointer">الصفحة التالية ▶</button>
            </div>
          `
          : '';

      return `
        <div class="space-y-4">
          <div class="p-4 rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-base font-black text-slate-900 dark:text-white">
                    ⚙️ قمرة القوالب الاحترافية الافتراضية المقسمة حسب الأقسام (34 مستنداً — Par Défaut)
                  </h3>
                  <span class="px-3 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-black text-xs">
                    ⚡ تصفح سريع مقسم بدون أي ثقل
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">
                  اختر القسم بالأسفل لعرض بطاقاته فوراً — اضغط (👁️ معاينة) لرؤية المستند أو (🎨 تخصيص) لتعديله في الاستوديو أو (⚡ جاهز) لاستعادة تصميمه المثالي
                </p>
              </div>

              <button type="button" onclick="window.GherbiPrintStudioV45.applyAll28ProDefaultTemplates()" class="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow cursor-pointer">
                🚀 اعتماد القوالب الجاهزة لكل الـ 34 مستنداً دفعة واحدة
              </button>
            </div>

            <!-- بوابات الأقسام الـ 7 السريعة (تفتح في أقل من 10ms) -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('CREDIT', 1)" class="px-3 py-1.5 rounded-xl font-black cursor-pointer ${catF === 'CREDIT' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700'}">💳 1. الكريدي والديون والوفاء (${countCREDIT})</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('POS', 1)" class="px-3 py-1.5 rounded-xl font-black cursor-pointer ${catF === 'POS' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700'}">🧾 2. المبيعات والكاشير (${countPOS})</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('FINANCE', 1)" class="px-3 py-1.5 rounded-xl font-black cursor-pointer ${catF === 'FINANCE' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700'}">🏦 3. الصندوق والورديات والجباية (${countFIN})</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('PURCHASES', 1)" class="px-3 py-1.5 rounded-xl font-black cursor-pointer ${catF === 'PURCHASES' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700'}">🛍️ 4. المشتريات والموردين (${countPURCH})</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('INVENTORY', 1)" class="px-3 py-1.5 rounded-xl font-black cursor-pointer ${catF === 'INVENTORY' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700'}">📦 5. المخزون والتصنيع (${countINV})</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('NEW_ONLY', 1)" class="px-3 py-1.5 rounded-xl font-black cursor-pointer ${catF === 'NEW_ONLY' ? 'bg-rose-600 text-white shadow' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300'}">✨ المستندات الجديدة (${NEW_DOC_IDS_SET.size})</button>
                <button type="button" onclick="window.GherbiPrintStudioV45.setTab5Category('ALL', 1)" class="px-3 py-1.5 rounded-xl font-black cursor-pointer ${catF === 'ALL' ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 dark:bg-slate-700'}">🌐 كل الـ 34 (بنظام صفحات)</button>
              </div>

              <input id="v73Tab5SearchInp" type="text" value="${this.defaultsSearchQuery || ''}" oninput="window.GherbiPrintStudioV45.onTab5SearchInput(this.value)" placeholder="🔎 ابحث في الـ 34 مستنداً..." class="w-56 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border font-bold outline-none focus:border-blue-500">
            </div>
          </div>

          <div id="v73Tab5CardsGridHost" class="v59-defaults-cards-grid">
            ${cardsHtml}
          </div>
          ${paginationBarHtml}
        </div>
      `;
    };

    studio.refreshTab5CockpitOnly = function (keepFocus = false) {
      const host = document.getElementById('v73Tab5RootHost');
      if (!host) {
        this.renderStudioIntoRoot();
        return;
      }
      host.innerHTML = this.buildTab5CockpitInnerHtml();
      if (keepFocus) {
        const inp = document.getElementById('v73Tab5SearchInp');
        if (inp) {
          inp.focus();
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        }
      }
    };

    // ربط الدالة الرئيسية لرسم التبويب الخامس المقسم السريع
    const v71Render = studio.renderStudioIntoRoot.bind(studio);
    studio.renderStudioIntoRoot = async function (rootEl) {
      const root = rootEl || document.getElementById('print-view-root');
      if (!root) return;

      if (this.config.activeTab === 'defaults_cockpit') {
        root.innerHTML = `
          <div id="v45MasterPrintStudio" data-gherbi-print-v2="1" class="space-y-4 pb-10 text-right" dir="rtl">
            <div class="p-4 rounded-3xl bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950 text-white shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                  <span class="material-symbols-rounded icon-lg">print</span>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-lg font-black tracking-tight">مركز الطباعة الشامل واستوديو القوالب الاحترافية الجاهزة لكل الصفحات</h2>
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black">
                      Gherbi.Ai Omni-Print V73 Turbo — 34 قالباً احترافياً (Zero-Lag)
                    </span>
                  </div>
                  <p class="text-xs text-slate-300 mt-0.5">
                    أداء فائق السرعة مع تقسيم ذكي للـ 34 مستنداً والـ 36 طبقة ذكية
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 text-xs">
                <button type="button" onclick="window.GherbiPrintStudioV45.switchTab('studio_invoices')" class="px-3.5 py-2 rounded-2xl font-black bg-slate-800/90 text-slate-300 hover:bg-slate-700 cursor-pointer">
                  🎨 1. استوديو الفواتير والطبقات (34 قالباً)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchTab('page_invoices')" class="px-3.5 py-2 rounded-2xl font-black bg-slate-800/90 text-slate-300 hover:bg-slate-700 cursor-pointer">
                  🔗 2. فواتير الصفحات الحية
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchTab('barcode_labels')" class="px-3.5 py-2 rounded-2xl font-black bg-slate-800/90 text-slate-300 hover:bg-slate-700 cursor-pointer">
                  🏷️ 3. الباركود والرفوف
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchTab('word_editor')" class="px-3.5 py-2 rounded-2xl font-black bg-slate-800/90 text-slate-300 hover:bg-slate-700 cursor-pointer">
                  📝 4. محرر البونات (Word)
                </button>
                <button type="button" onclick="window.GherbiPrintStudioV45.switchTab('defaults_cockpit')" class="px-3.5 py-2 rounded-2xl font-black bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400 cursor-pointer">
                  ⚙️ 5. القوالب الافتراضية الـ 34 (Par Défaut)
                </button>
              </div>
            </div>

            <div id="v73Tab5RootHost">
              ${this.buildTab5CockpitInnerHtml()}
            </div>
          </div>
        `;
        return;
      }

      return await v71Render(root);
    };

    if (document.getElementById('view-print')?.classList.contains('active')) {
      studio.renderStudioIntoRoot();
    }

    console.log('🚀 [Gherbi V73 Turbo Print Studio]: تم إصلاح خطأ saveCurrentProfileToMap وتسريع مركز الطباعة بنسبة 500% عبر التقسيم الفرعي والتحديث الجراحي!');
  }, 120);
})();

/* ==================== [V74 UNIFIED NATIVE 36-LAYERS & FULL TOOLS PRINT ENGINE] ==================== */
(function initV74UnifiedNative36LayersPrintEngine() {
  const waitStudio = setInterval(() => {
    const studio = window.GherbiPrintStudioV45;
    const all34 = window.__GHERBI_V70_ALL_34_MASTER_TEMPLATES;
    const full36 = window.__GHERBI_V70_FULL_36_LAYERS;
    if (!studio || !Array.isArray(all34) || !Array.isArray(full36)) return;
    clearInterval(waitStudio);

    // 1. ترقية دالة إثراء بيانات المستند (enrichDocumentDataWithLoyaltyAndDebt)
    //    لتقرأ تلقائياً الزبون الوفي النشط في الكاشير وديونه ونقاطه الحقيقية حتى لو لم يُمرر customerId!
    const origEnrich = studio.enrichDocumentDataWithLoyaltyAndDebt?.bind(studio);
    studio.enrichDocumentDataWithLoyaltyAndDebt = function (rawDoc = {}) {
      const d = origEnrich ? origEnrich(rawDoc) : { ...rawDoc };

      // إذا كان المستند يُطبع من الكاشير ولم يُمرر اسم الزبون الوفي، نفحص الكاشف الذكي في GherbiDebtV68
      const debtEng = window.GherbiDebtV68;
      if (debtEng) {
        let cust = null;
        if (d.customerId && debtEng.customersById?.has(Number(d.customerId))) {
          cust = debtEng.customersById.get(Number(d.customerId));
        } else if (
          (!d.partyName || String(d.partyName).includes('زبون عابر') || String(d.partyName).includes('Comptoir')) &&
          document.getElementById('view-pos')?.classList.contains('active')
        ) {
          cust = debtEng.detectActivePosCustomer();
        }

        if (cust) {
          const fid = debtEng.getFidCode(cust);
          const pts = Math.floor(Number(cust.loyalty_points || 0));
          const currentDebt = Math.max(0, Number(cust.total_debt || 0));
          d.customerId = cust.id;
          d.isWalkinCustomer = false;
          d.partyName = String(d.partyName || '').includes(cust.name)
            ? d.partyName
            : `👑 ${cust.name} (${fid})`;
          if (!d.partyPhone || d.partyPhone === '-') d.partyPhone = cust.phone || '-';
          if (!d.partyAddress || d.partyAddress === '-') d.partyAddress = cust.address || 'الجزائر';
          d.loyaltyTotalBalance = pts;
          if (!d.previousBalance && currentDebt > 0) {
            const remToday = Math.max(0, Number(d.total || 0) - Number(d.paidAmount ?? d.total ?? 0));
            d.previousBalance = Math.max(0, Number((currentDebt - remToday).toFixed(2)));
          }
          d.customerCurrentTotalDebt = currentDebt;
        }
      }

      return d;
    };

    // 2. حفظ التعديلات النصية الحرة التي يكتبها المستخدم مباشرةً داخل الورقة (contenteditable)
    //    بحيث تنتقل تلقائياً عند الحفظ والطباعة في جميع الصفحات!
    studio.captureInlineEditedTextsFromPaper = function () {
      const paperEl = document.querySelector('#v45WorkspaceHost .v45-live-paper');
      if (!paperEl) return;
      const docType = this.config.activeDocType || 'receipt_thermal';
      if (!this.config.customTexts) this.config.customTexts = {};

      // حفظ العنوان الرئيسي أو التذييل إذا عدلهما المستخدم مباشرة على الورقة
      const bannerTitleEl = paperEl.querySelector('[data-v74-editable="doc_title"]');
      if (bannerTitleEl && bannerTitleEl.innerText.trim()) {
        this.config.customHeaderTitle = bannerTitleEl.innerText.trim();
      }
      const footerTermsEl = paperEl.querySelector('[data-v74-editable="footer_terms"]');
      if (footerTermsEl && footerTermsEl.innerText.trim()) {
        this.config.customFooterTerms = footerTermsEl.innerText.trim();
      }
    };

    const origAdopt = studio.adoptCurrentTemplateForDocType?.bind(studio);
    studio.adoptCurrentTemplateForDocType = async function () {
      this.captureInlineEditedTextsFromPaper();
      this.saveCurrentProfileToMap();
      this.saveConfigLocal();
      if (origAdopt) return await origAdopt();
    };

    // ========================================================================
    // 3. المحرك الأصلي الموحد لرسم جميع الطبقات الـ 36 وأدوات المفتش (⚙️)
    //    يعمل بنفس الكود 100% للمعاينة الحية وللطباعة الفورية وتصدير الـ PDF!
    // ========================================================================
    studio.renderSingleLayerUnifiedV74 = function (layer, cfg, docData, theme, isThermal, editAttr, forPrintOutput) {
      const lid = layer.id;
      const shop = this.getShopIdentity();
      const ct = cfg.customTexts || {};

      const cTitle = this.interpolateSmartVariables(layer.customTitle || '', docData);
      const cNote = this.interpolateSmartVariables(layer.customNote || '', docData);
      const noteHtml = cNote
        ? `<div ${editAttr} style="margin-top:4px;padding-top:3px;border-top:1px dashed ${theme.border};font-size:${isThermal ? '9.5px' : '10.5px'};font-weight:800;color:${theme.secondary};">📌 ${cNote}</div>`
        : '';

      const totalVal = Number(docData.total || 0);
      const subtotalVal = Number(docData.subtotal ?? totalVal);
      const discountVal = Number(docData.discount || 0);
      const paidVal = Number(docData.paidAmount ?? totalVal);
      const receivedVal = Number(docData.receivedAmount ?? paidVal);
      const changeVal = receivedVal > totalVal ? Number((receivedVal - totalVal).toFixed(2)) : 0;
      const remTodayDebt = Math.max(0, Number((totalVal - paidVal).toFixed(2)));
      const prevDebt = Math.max(0, Number(docData.previousBalance || 0));
      const cumulativeDebt =
        docData.customerCurrentTotalDebt !== undefined && remTodayDebt === 0
          ? Number(docData.customerCurrentTotalDebt)
          : Number((prevDebt + remTodayDebt).toFixed(2));
      const pts = Math.floor(Number(docData.loyaltyTotalBalance || 0));
      const earnedPts = Math.floor(Number(docData.loyaltyPointsEarned ?? Math.floor(totalVal / 100)));
      const items = Array.isArray(docData.items) ? docData.items : [];
      const totalQtyCount = items.reduce((s, it) => s + Number(it.qty ?? it.quantity ?? 1), 0);

      // ── 1. ترويسة المتجر والشعار (header_layer) ──
      if (lid === 'header_layer') {
        const fiscalLine = [
          shop.rc ? `RC: ${shop.rc}` : '',
          shop.nif ? `NIF: ${shop.nif}` : '',
          shop.ai ? `AI: ${shop.ai}` : '',
          shop.nis ? `NIS: ${shop.nis}` : ''
        ]
          .filter(Boolean)
          .join(' | ');

        return `
          <div style="text-align:center;border-bottom:2px solid ${theme.primary};padding-bottom:6px;">
            ${shop.logo ? `<img src="${shop.logo}" style="max-height:${isThermal ? '38px' : '54px'};margin:0 auto 4px;display:block;object-fit:contain;">` : ''}
            <div ${editAttr} style="font-size:${isThermal ? '15.5px' : '20px'};font-weight:900;color:${theme.primary};line-height:1.25;">${cTitle || shop.name || 'Gherbi.Ai POS'}</div>
            ${shop.description ? `<div ${editAttr} style="font-size:${isThermal ? '10.5px' : '12px'};font-weight:800;color:#334155;margin-top:2px;">${shop.description}</div>` : ''}
            <div ${editAttr} style="font-size:${isThermal ? '10px' : '11.5px'};color:#475569;font-weight:700;margin-top:2px;">
              📍 ${shop.address || 'الجزائر'} ${shop.phone ? `| 📞 <span dir="ltr">${shop.phone}</span>` : ''}
            </div>
            ${!isThermal && fiscalLine ? `<div ${editAttr} style="font-family:monospace;font-size:10px;color:#64748b;margin-top:2px;">${fiscalLine}</div>` : ''}
            ${noteHtml}
          </div>`;
      }

      // ── 2. شريط عنوان ورقم المستند والباركود (doc_banner_layer) ──
      if (lid === 'doc_banner_layer') {
        const docMeta = this.getActiveDocMeta(cfg.activeDocType);
        const headerTitle = cTitle || cfg.customHeaderTitle || (docMeta && docMeta.cleanTitle) || 'تذكرة مبيعات الكاشير / Ticket de Caisse';
        return `
          <div style="border:1.5px solid ${theme.border};background:${theme.accentBg};border-radius:8px;padding:${isThermal ? '5px 7px' : '8px 12px'};text-align:center;">
            <div ${editAttr} data-v74-editable="doc_title" style="font-size:${isThermal ? '13px' : '16px'};font-weight:900;color:${theme.primary};">${headerTitle}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-family:monospace;font-size:${isThermal ? '10.5px' : '12px'};font-weight:900;color:#1e293b;margin-top:3px;">
              <span ${editAttr}>N°: ${docData.docNumber || '101'}</span>
              <span ${editAttr} dir="ltr">${docData.date || new Date().toISOString().replace('T', ' ').slice(0, 16)}</span>
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 3. بطاقة بيانات الزبون / المورد (customer_box_layer) ──
      if (lid === 'customer_box_layer') {
        return `
          <div style="border-bottom:1.5px dashed #94a3b8;padding:4px 2px;font-size:${isThermal ? '11px' : '12.5px'};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
              <div ${editAttr} style="font-weight:900;color:#0f172a;">
                <span>${cTitle || docData.partyTitle || 'الزبون:'}</span>
                <strong style="color:${theme.primary};"> ${docData.partyName || 'زبون عابر (Comptoir)'}</strong>
              </div>
              ${
                docData.partyPhone && docData.partyPhone !== '-'
                  ? `<div ${editAttr} style="font-family:monospace;font-weight:800;font-size:${isThermal ? '10.5px' : '11.5px'};" dir="ltr">📞 ${docData.partyPhone}</div>`
                  : ''
              }
            </div>
            ${
              !isThermal && docData.partyAddress && docData.partyAddress !== '-'
                ? `<div ${editAttr} style="font-size:11px;color:#475569;font-weight:700;margin-top:2px;">📍 العنوان: ${docData.partyAddress} ${docData.partyRc && docData.partyRc !== '-' ? `| RC: ${docData.partyRc}` : ''} ${docData.partyNif && docData.partyNif !== '-' ? `| NIF: ${docData.partyNif}` : ''}</div>`
                : ''
            }
            ${noteHtml}
          </div>`;
      }

      // ── 4. جدول الأصناف والكميات والأسعار الذكي (items_table_layer) ──
      if (lid === 'items_table_layer') {
        const cols = cfg.columns || { index: true, name: true, qty: true, unitPrice: true, subtotal: true };

        if (isThermal) {
          const rowsHtml = items
            .map((it, i) => {
              const name = it.name || it.product_name || it.custom_product_name || 'صنف';
              const qty = Number(it.qty ?? it.quantity ?? 1);
              const price = Number(it.price ?? 0);
              const sub = Number(it.subtotal ?? qty * price);
              const unit = it.unit || it.product_unit || 'قطعة';
              return `
                <tr style="border-bottom:1px dashed #cbd5e1;">
                  <td ${editAttr} style="padding:4px 2px;font-weight:900;text-align:right;word-break:break-word;">
                    ${cols.index ? `<span style="font-family:monospace;color:#475569;">${i + 1}. </span>` : ''}${name}
                    ${cols.unit && unit ? `<div style="font-size:9px;color:#64748b;font-weight:700;">الوحدة: ${unit}</div>` : ''}
                  </td>
                  ${cols.qty !== false ? `<td ${editAttr} style="padding:4px 2px;text-align:center;font-family:monospace;font-weight:900;">${qty}</td>` : ''}
                  ${cols.unitPrice !== false ? `<td ${editAttr} style="padding:4px 2px;text-align:center;font-family:monospace;font-weight:700;">${price.toFixed(2)}</td>` : ''}
                  ${cols.subtotal !== false ? `<td ${editAttr} style="padding:4px 2px;text-align:left;font-family:monospace;font-weight:900;">${sub.toFixed(2)}</td>` : ''}
                </tr>`;
            })
            .join('');

          return `
            <div>
              <table style="width:100%;border-collapse:collapse;font-size:10.5px;direction:rtl;">
                <thead>
                  <tr style="background:${theme.primary};color:#ffffff;font-weight:900;">
                    <th ${editAttr} style="padding:4px;text-align:right;">${ct.colName || 'التعيين / الصنف'}</th>
                    ${cols.qty !== false ? `<th ${editAttr} style="padding:4px;text-align:center;width:14%;">${ct.colQty || 'الكمية'}</th>` : ''}
                    ${cols.unitPrice !== false ? `<th ${editAttr} style="padding:4px;text-align:center;width:20%;">${ct.colPrice || 'سعر الوحدة'}</th>` : ''}
                    ${cols.subtotal !== false ? `<th ${editAttr} style="padding:4px;text-align:left;width:22%;">${ct.colSubtotal || 'المجموع'}</th>` : ''}
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
              ${noteHtml}
            </div>`;
        }

        // جدول A4 / A5 الكامل
        const rowsA4 = items
          .map((it, i) => {
            const name = it.name || it.product_name || it.custom_product_name || 'صنف';
            const qty = Number(it.qty ?? it.quantity ?? 1);
            const price = Number(it.price ?? 0);
            const disc = Number(it.discount || 0);
            const tva = Number(it.tva || 0);
            const sub = Number(it.subtotal ?? qty * price);
            const unit = it.unit || it.product_unit || 'قطعة';
            return `
              <tr style="border-bottom:1px solid #cbd5e1;">
                ${cols.index ? `<td ${editAttr} style="padding:6px;text-align:center;font-family:monospace;font-weight:800;">${i + 1}</td>` : ''}
                ${cols.barcode ? `<td ${editAttr} style="padding:6px;text-align:center;font-family:monospace;font-size:10.5px;">${it.barcode || it.product_barcode || '-'}</td>` : ''}
                ${cols.name !== false ? `<td ${editAttr} style="padding:6px;text-align:right;font-weight:800;">${name}</td>` : ''}
                ${cols.unit ? `<td ${editAttr} style="padding:6px;text-align:center;">${unit}</td>` : ''}
                ${cols.qty !== false ? `<td ${editAttr} style="padding:6px;text-align:center;font-family:monospace;font-weight:900;">${qty}</td>` : ''}
                ${cols.unitPrice !== false ? `<td ${editAttr} style="padding:6px;text-align:center;font-family:monospace;font-weight:800;">${price.toFixed(2)}</td>` : ''}
                ${cols.discount ? `<td ${editAttr} style="padding:6px;text-align:center;font-family:monospace;">${disc > 0 ? disc.toFixed(2) : '-'}</td>` : ''}
                ${cols.tva ? `<td ${editAttr} style="padding:6px;text-align:center;font-family:monospace;">${tva > 0 ? tva + '%' : '-'}</td>` : ''}
                ${cols.subtotal !== false ? `<td ${editAttr} style="padding:6px;text-align:left;font-family:monospace;font-weight:900;">${sub.toFixed(2)} د.ج</td>` : ''}
              </tr>`;
          })
          .join('');

        return `
          <div>
            <table style="width:100%;border-collapse:collapse;font-size:11.5px;border:1.5px solid ${theme.primary};direction:rtl;">
              <thead>
                <tr style="background:${theme.primary};color:#ffffff;font-weight:900;">
                  ${cols.index ? `<th style="padding:6px;text-align:center;width:40px;">#</th>` : ''}
                  ${cols.barcode ? `<th style="padding:6px;text-align:center;">الباركود / المرجع</th>` : ''}
                  ${cols.name !== false ? `<th ${editAttr} style="padding:6px;text-align:right;">${ct.colName || 'التعيين / البيان'}</th>` : ''}
                  ${cols.unit ? `<th style="padding:6px;text-align:center;">الوحدة</th>` : ''}
                  ${cols.qty !== false ? `<th ${editAttr} style="padding:6px;text-align:center;">${ct.colQty || 'الكمية'}</th>` : ''}
                  ${cols.unitPrice !== false ? `<th ${editAttr} style="padding:6px;text-align:center;">${ct.colPrice || 'سعر الوحدة'}</th>` : ''}
                  ${cols.discount ? `<th style="padding:6px;text-align:center;">الخصم</th>` : ''}
                  ${cols.tva ? `<th style="padding:6px;text-align:center;">TVA</th>` : ''}
                  ${cols.subtotal !== false ? `<th ${editAttr} style="padding:6px;text-align:left;">${ct.colSubtotal || 'المجموع'}</th>` : ''}
                </tr>
              </thead>
              <tbody>${rowsA4}</tbody>
            </table>
            ${noteHtml}
          </div>`;
      }

      // ── 5. شلال المجاميع بالدينار والسنتيم والتفقيط (totals_words_layer) ──
      if (lid === 'totals_words_layer') {
        const wordsAr =
          typeof window.numberToArabicWords === 'function'
            ? window.numberToArabicWords(Math.round(totalVal))
            : `${Math.round(totalVal)} دينار جزائري`;

        return `
          <div style="border-top:2px solid #0f172a;padding-top:6px;font-size:${isThermal ? '11px' : '12.5px'};">
            ${
              discountVal > 0
                ? `<div style="display:flex;justify-content:space-between;font-weight:800;color:#475569;"><span>المجموع الفرعي: ${this.fmtDzd(subtotalVal)}</span><span style="color:#be123c;">التخفيض: -${this.fmtDzd(discountVal)}</span></div>`
                : ''
            }
            <div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:900;font-size:${isThermal ? '14.5px' : '17px'};color:#0f172a;margin:2px 0;">
              <span ${editAttr}>${cTitle || ct.netTotalLabel || 'الإجمالي الصافي:'}</span>
              <span ${editAttr} style="font-family:monospace;color:${theme.primary};">${this.fmtDzd(totalVal)}</span>
            </div>
            ${
              cfg.showCentimesEquivalent !== false
                ? `<div ${editAttr} style="font-size:${isThermal ? '10.5px' : '11.5px'};font-weight:900;color:#334155;margin-bottom:4px;">🇩🇿 بالسنتيم: ${this.fmtCentimes(totalVal)}</div>`
                : ''
            }
            <div style="display:flex;justify-content:space-between;border-top:1px dashed #94a3b8;padding-top:4px;font-weight:900;font-size:${isThermal ? '11px' : '12px'};">
              <span ${editAttr} style="color:#047857;">المدفوع: ${this.fmtDzd(paidVal)}</span>
              <span ${editAttr} style="color:${remTodayDebt > 0.05 ? '#be123c' : '#0f172a'};">الباقي: ${this.fmtDzd(remTodayDebt)}</span>
            </div>
            ${
              !isThermal && cfg.showAmountInWords !== false
                ? `<div ${editAttr} style="margin-top:5px;padding:5px 8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;font-weight:800;">أوقفت هذه الوثيقة على مبلغ قدره: <strong>${wordsAr}</strong></div>`
                : ''
            }
            ${noteHtml}
          </div>`;
      }

      // ── 6. التذييل، شروط الاستبدال، رمز RIP، والختم (footer_stamp_layer) ──
      if (lid === 'footer_stamp_layer') {
        const footerTerms =
          cTitle ||
          cfg.customFooterTerms ||
          'البضاعة المباعة لا تُرد ولا تُستبدل إلا بعد 48 ساعة بشرط سلامة الغلاف الأصلي وإحضار الفاتورة.';
        return `
          <div style="border-top:1px solid #cbd5e1;padding-top:6px;text-align:center;font-size:${isThermal ? '9.5px' : '11px'};color:#334155;">
            <div ${editAttr} data-v74-editable="footer_terms" style="font-weight:800;line-height:1.45;">${footerTerms}</div>
            ${shop.rip ? `<div ${editAttr} style="font-family:monospace;font-weight:900;margin-top:3px;font-size:10px;color:#0f172a;">RIP: ${shop.rip}</div>` : ''}
            ${
              !isThermal && cfg.showStampSignature !== false
                ? `<div style="display:flex;justify-content:space-between;margin-top:14px;padding:0 20px;font-weight:900;font-size:11.5px;">
                    <div>إمضاء المستلم / الزبون</div>
                    <div>الختم والإمضاء الرسمي (${shop.name})</div>
                  </div>`
                : ''
            }
            ${noteHtml}
          </div>`;
      }

      // ── 7. بطاقة تأكيد عملية الدين والمدفوع الجزئي (Alt+D — alt_d_debt_confirmation_box_layer) ──
      if (lid === 'alt_d_debt_confirmation_box_layer') {
        return `
          <div style="border:2px solid #e11d48;border-radius:9px;padding:7px 9px;background:#fff1f2;color:#881337;font-size:${isThermal ? '10px' : '11px'};">
            <div ${editAttr} style="font-weight:900;font-size:${isThermal ? '11px' : '12px'};border-bottom:1.5px dashed #fda4af;padding-bottom:3px;margin-bottom:5px;color:#be123c;text-align:center;">
              📝 ${cTitle || 'بطاقة تأكيد عملية البيع بالدين (Alt + D)'}
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;font-weight:800;line-height:1.5;">
              <div ${editAttr}>• الدين السابق للزبون: <strong style="font-family:monospace;">${this.fmtDzd(prevDebt)}</strong></div>
              <div ${editAttr}>• إجمالي سلة اليوم: <strong style="font-family:monospace;">${this.fmtDzd(totalVal)}</strong></div>
              <div ${editAttr} style="color:#047857;">• المدفوع نقداً اليوم: <strong style="font-family:monospace;">${this.fmtDzd(paidVal)}</strong></div>
              <div ${editAttr} style="color:#be123c;">• الدين المضاف اليوم: <strong style="font-family:monospace;">+${this.fmtDzd(remTodayDebt)}</strong></div>
            </div>
            <div ${editAttr} style="margin-top:5px;padding:4px 6px;border-radius:6px;background:#be123c;color:#ffffff;font-weight:900;display:flex;justify-content:space-between;align-items:center;">
              <span>📌 إجمالي الدين التراكمي الجديد:</span>
              <span style="font-family:monospace;font-size:${isThermal ? '11.5px' : '13px'};">${this.fmtDzd(cumulativeDebt)}</span>
            </div>
            <div ${editAttr} style="margin-top:5px;text-align:center;font-weight:800;font-size:9.5px;color:#475569;">
              ✍️ إمضاء الزبون بالقبول والاستلام: ........................................
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 8. بطاقة وصل تسديد الدين وحساب الباقي بالسنتيم (Alt+V — alt_v_debt_settlement_voucher_layer) ──
      if (lid === 'alt_v_debt_settlement_voucher_layer') {
        const debtBefore = prevDebt > 0 ? prevDebt : totalVal + 270;
        const paidNow = totalVal;
        const debtAfter = Math.max(0, Number((debtBefore - paidNow).toFixed(2)));
        return `
          <div style="border:2px solid #059669;border-radius:9px;padding:7px 9px;background:#ecfdf5;color:#064e3b;font-size:${isThermal ? '10px' : '11px'};">
            <div ${editAttr} style="font-weight:900;font-size:${isThermal ? '11px' : '12px'};border-bottom:1.5px dashed #6ee7b7;padding-bottom:3px;margin-bottom:5px;color:#047857;text-align:center;">
              💵 ${cTitle || 'بطاقة تسديد وقبض دين زبون (Alt + V)'}
            </div>
            <div style="line-height:1.65;font-weight:800;">
              <div style="display:flex;justify-content:space-between;"><span ${editAttr}>1. الرصيد المدين قبل الدفع:</span><strong style="font-family:monospace;color:#be123c;">${this.fmtDzd(debtBefore)}</strong></div>
              <div style="display:flex;justify-content:space-between;color:#047857;"><span ${editAttr}>2. المبلغ المقبوض اليوم (-):</span><strong style="font-family:monospace;">-${this.fmtDzd(paidNow)}</strong></div>
              <div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px solid #6ee7b7;margin-top:3px;padding-top:3px;font-size:${isThermal ? '11px' : '12px'};">
                <span ${editAttr}>3. صافي الدين المتبقي بعد الدفعة:</span>
                <strong style="font-family:monospace;color:${debtAfter > 0.05 ? '#be123c' : '#047857'};">${this.fmtDzd(debtAfter)} (${this.fmtCentimes(debtAfter)})</strong>
              </div>
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 9. جدول تفصيل السلع المأخوذة في فواتير الدين (Alt+H — alt_h_items_taken_history_layer) ──
      if (lid === 'alt_h_items_taken_history_layer') {
        return `
          <div style="border:1.5px solid #4f46e5;border-radius:9px;padding:7px 10px;background:#eef2ff;color:#1e1b4b;font-size:${isThermal ? '9.5px' : '11px'};">
            <div ${editAttr} style="font-weight:900;color:#4338ca;margin-bottom:3px;">
              📜 ${cTitle || 'ملخص هيستوريك السلع المسحوبة على الحساب (Alt + H):'}
            </div>
            <div ${editAttr} style="font-weight:700;line-height:1.45;">
              بيان تفصيلي للسلع والكميات التي استلمها الزبون الوفي في فواتير الدين مع التواريخ والدفعات المسددة.
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 10 & 11. خلاصة كرني الكريدي وجدول وضعية الديون (credit_carnet_layer / debt_ledger_layer) ──
      if (lid === 'credit_carnet_layer' || lid === 'debt_ledger_layer') {
        return `
          <div style="border:1.5px solid #e11d48;border-radius:8px;padding:6px 8px;background:#fff1f2;color:#881337;font-size:${isThermal ? '10px' : '11px'};">
            <div ${editAttr} style="font-weight:900;border-bottom:1px dashed #fda4af;padding-bottom:3px;margin-bottom:4px;color:#be123c;">
              💳 ${cTitle || 'وضعية حساب الديون والكريدي التراكمي للزبون:'}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;text-align:center;font-weight:800;">
              <div ${editAttr} style="background:#fff;padding:3px;border-radius:5px;border:1px solid #fecdd3;">
                <div style="font-size:8.5px;color:#64748b;">الدين السابق</div>
                <div style="font-family:monospace;">${this.fmtDzd(prevDebt)}</div>
              </div>
              <div ${editAttr} style="background:#fff;padding:3px;border-radius:5px;border:1px solid #fecdd3;">
                <div style="font-size:8.5px;color:#64748b;">دين هذه العملية</div>
                <div style="font-family:monospace;color:#be123c;">+${this.fmtDzd(remTodayDebt)}</div>
              </div>
              <div ${editAttr} style="background:#be123c;color:#fff;padding:3px;border-radius:5px;">
                <div style="font-size:8.5px;opacity:0.9;">إجمالي الدين الجديد</div>
                <div style="font-family:monospace;font-weight:900;">${this.fmtDzd(cumulativeDebt)}</div>
              </div>
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 12. تفصيل المقبوض والصرف المرجع (payment_breakdown_layer) ──
      if (lid === 'payment_breakdown_layer') {
        return `
          <div style="border:1px dashed #94a3b8;border-radius:8px;padding:5px 8px;background:#f8fafc;font-size:${isThermal ? '10px' : '11px'};font-weight:800;color:#1e293b;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
              <span ${editAttr}>💵 المقبوض: <strong style="font-family:monospace;">${this.fmtDzd(receivedVal)}</strong></span>
              <span ${editAttr}>🪙 الصرف (Rendu): <strong style="font-family:monospace;color:#047857;">${this.fmtDzd(changeVal)}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:${isThermal ? '9.5px' : '10.5px'};color:#475569;">
              <span ${editAttr}>👤 البائع: ${window.AppState?.currentUser?.name || 'المدير العام'}</span>
              <span ${editAttr}>طريقة الدفع: ${docData.paymentMethod || 'نقداً'}</span>
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 15. البطاقة المزدوجة للزبون الوفي: النقاط + الديون (F8 — f8_vip_points_and_debt_dual_layer) ──
      // هذه هي الطبقة التي ظهرت في صورتك الثانية (image_0d1605.png) والتي كانت تتحول إلى "انقر هنا..." في الطباعة!
      if (lid === 'f8_vip_points_and_debt_dual_layer') {
        const isWalkin = Boolean(docData.isWalkinCustomer && !String(docData.partyName || '').includes('FID-'));
        const displayPts = isWalkin ? 0 : pts;
        const displayDebt = isWalkin ? 0 : cumulativeDebt;
        return `
          <div style="border:1.5px solid #f59e0b;border-radius:9px;padding:6px 8px;background:linear-gradient(135deg,#fffbeb 0%,#fff1f2 100%);color:#0f172a;font-size:${isThermal ? '9.5px' : '11px'};">
            <div ${editAttr} style="font-weight:900;text-align:center;color:#b45309;margin-bottom:4px;border-bottom:1px dashed #fcd34d;padding-bottom:2px;">
              👑 ${cTitle || 'بطاقة الوضعية الشاملة للزبون الوفي (F8: النقاط + الديون)'}
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px;text-align:center;font-weight:900;">
              <div ${editAttr} style="background:#ffffff;border:1px solid #fcd34d;border-radius:6px;padding:3px;">
                <div style="font-size:9px;color:#b45309;">⭐ رصيد نقاط الوفاء</div>
                <div style="font-family:monospace;color:#78350f;">${displayPts} ن (${displayPts * 2} د.ج)</div>
              </div>
              <div ${editAttr} style="background:#ffffff;border:1px solid #fda4af;border-radius:6px;padding:3px;">
                <div style="font-size:9px;color:#be123c;">💳 إجمالي الديون الحالية</div>
                <div style="font-family:monospace;color:${displayDebt > 0.05 ? '#be123c' : '#047857'};">${this.fmtDzd(displayDebt)}</div>
              </div>
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 16. بطاقة نقاط الوفاء (loyalty_points_layer) ──
      if (lid === 'loyalty_points_layer') {
        return `
          <div style="border:1.5px solid #f59e0b;border-radius:8px;padding:5px 8px;background:#fffbeb;color:#78350f;font-size:${isThermal ? '10px' : '11px'};font-weight:800;">
            <div ${editAttr} style="font-weight:900;text-align:center;border-bottom:1px dashed #fcd34d;padding-bottom:2px;margin-bottom:3px;">
              ⭐ ${cTitle || 'برنامج الوفاء ومكافآت الزبائن (Club Fidélité)'}
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span ${editAttr}>النقاط المكتسبة اليوم: <strong>+${earnedPts} ن</strong></span>
              <span ${editAttr}>إجمالي الرصيد: <strong>${pts} ن (${pts * 2} د.ج)</strong></span>
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 21. ميزان الوردية المزدوج: سيولة الدرج مقابل ديون الوردية (shift_cash_vs_debt_reconciliation_layer) ──
      if (lid === 'shift_cash_vs_debt_reconciliation_layer') {
        return `
          <div style="border:2px solid #0f172a;border-radius:9px;padding:7px 9px;background:#f8fafc;color:#0f172a;font-size:${isThermal ? '9.5px' : '11px'};">
            <div ${editAttr} style="font-weight:900;text-align:center;background:#0f172a;color:#ffffff;padding:3px 6px;border-radius:5px;margin-bottom:5px;">
              🏦 ${cTitle || 'ميزان الوردية المزدوج: سيولة الدرج مقابل ديون الوردية'}
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;text-align:center;font-weight:900;">
              <div ${editAttr} style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:7px;padding:4px;">
                <div style="font-size:9px;color:#1d4ed8;">💵 السيولة النقدية المتوقعة بالدرج</div>
                <div style="font-family:monospace;font-size:11.5px;color:#1e3a8a;">${this.fmtDzd(totalVal)}</div>
              </div>
              <div ${editAttr} style="background:#fff1f2;border:1.5px solid #fda4af;border-radius:7px;padding:4px;">
                <div style="font-size:9px;color:#be123c;">💳 ديون ممنوحة بالوردية (آجلة)</div>
                <div style="font-family:monospace;font-size:11.5px;color:#881337;">${this.fmtDzd(prevDebt)}</div>
              </div>
            </div>
            <div ${editAttr} style="margin-top:4px;font-size:9px;font-weight:800;color:#475569;text-align:center;">
              ✔ الديون الممنوحة (Alt+D) مسجلة في ذمة الزبائن ولا تدخل في عدّ أوراق الدرج، بينما تسديدات الديون (Alt+V) مضافة في الدرج.
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── 22. ملخص المصاريف والإيداعات وتحصيل الديون في الوردية (shift_expenses_and_inflows_layer) ──
      if (lid === 'shift_expenses_and_inflows_layer') {
        return `
          <div style="border:1.5px dashed #475569;border-radius:8px;padding:6px 8px;background:#ffffff;font-size:${isThermal ? '9.5px' : '10.5px'};color:#1e293b;">
            <div ${editAttr} style="font-weight:900;color:#0f172a;margin-bottom:3px;">
              💸 ${cTitle || 'ملخص المصاريف والإيداعات وتحصيل الديون في الوردية:'}
            </div>
            <div ${editAttr} style="display:flex;justify-content:space-between;font-weight:800;">
              <span>• تحصيلات الديون (Alt+V): مقبوضة بالدرج ✔</span>
              <span>• المصاريف والسحوبات: مخصومة من الدرج ✔</span>
            </div>
            ${noteHtml}
          </div>`;
      }

      // ── بقية الطبقات التخصصية من الـ 36 طبقة (الأقساط، البنوك، التوصيل، الضمان، الجرد، التصنيع، الجباية، الرقابة...) ──
      const specializedMap = {
        installments_schedule_layer: { icon: '🗓️', title: 'جدول الأقساط الشهرية ومواعيد الاستحقاق', body: `إجمالي العقد: ${this.fmtDzd(totalVal)} | التسبيق المدفوع: ${this.fmtDzd(paidVal)} | الباقي مقسط: ${this.fmtDzd(remTodayDebt)}` },
        bank_rip_ccp_box_layer: { icon: '🏦', title: 'بيانات الحساب البنكي والبريدي (RIB / CCP / BaridiMob)', body: `للدفع عبر التحويل البنكي أو البريدي RIP: ${shop.rip || '00799999000000000000'}` },
        savings_promo_layer: { icon: '🎉', title: 'ملخص التوفير وإجمالي عدد القطع', body: `إجمالي عدد القطع في السلة: ${totalQtyCount} قطعة ${discountVal > 0 ? `| وفّرتم اليوم: ${this.fmtDzd(discountVal)}` : ''}` },
        vip_coupon_cut_layer: { icon: '✂️', title: 'قسيمة تخفيض خاصة للزيارة القادمة (Coupon VIP)', body: 'احتفظ بهذه القسيمة واحصل على نقاط وفاء مضاعفة في زيارتك القادمة!' },
        qr_social_wifi_layer: { icon: '📱', title: 'تواصلوا معنا — خدمة الزبائن', body: `${shop.name} — هاتف: ${shop.phone || '-'} | شكراً لزيارتكم!` },
        return_policy_box_layer: { icon: '🔄', title: 'شروط الإرجاع والاستبدال وحماية المستهلك', body: 'يُقبل الاستبدال خلال 48 ساعة بشرط سلامة الغلاف الأصلي وإحضار وصل الشراء.' },
        caisse_z_denoms_layer: { icon: '🔒', title: 'مطابقة جرد الفئات النقدية في الدرج (Billetage)', body: `الرصيد المتوقع بالدرج: ${this.fmtDzd(totalVal)} | المعدود الفعلي: ${this.fmtDzd(paidVal)}` },
        expense_approval_layer: { icon: '🧾', title: 'اعتماد سند الصرف النقدي وتوقيع المستفيد', body: `المبلغ المصروف: ${this.fmtDzd(totalVal)} — إمضاء المستلم: ........................` },
        tax_ifu_breakdown_layer: { icon: '🇩🇿', title: 'تفصيل الجباية والضريبة الجزافية الوحيدة (IFU G12 / TVA)', body: `الوعاء الجبائي الإجمالي: ${this.fmtDzd(totalVal)}` },
        forensic_radar_summary_layer: { icon: '🛡️', title: 'خلاصة الفحص الرقابي الجنائي للكاشير (Anti-Fraude)', body: 'تم فحص سجل الحركات والأسعار ومطابقتها مع سجل الرقابة الأمنية.' },
        supplier_reception_layer: { icon: '🛍️', title: 'مطابقة استلام البضاعة من المورد وفحص الجودة', body: `تم فحص واستلام الأصناف (${items.length} صنف) وإدراجها في المخزون.` },
        stocktake_variance_layer: { icon: '📊', title: 'ملخص محضر الجرد المخزني وفوارق الكميات', body: `إجمالي القيمة المخزنية المعدودة: ${this.fmtDzd(totalVal)}` },
        bom_production_cost_layer: { icon: '🏭', title: 'بطاقة تكلفة التصنيع والمواد الأولية (BOM)', body: `إجمالي تكلفة المواد الأولية والتشغيل: ${this.fmtDzd(totalVal)}` },
        low_stock_reorder_layer: { icon: '🚨', title: 'أولوية التموين للأصناف الحرجة والنافدة', body: `عدد الأصناف المطلوب تموينها بشكل عاجل: ${items.length} صنف.` },
        pack_carton_summary_layer: { icon: '📦', title: 'ملخص التغليف وإجمالي الطرود والكراتين (Colisage)', body: `إجمالي عدد الأصناف: ${items.length} | إجمالي الوحدات والطرود: ${totalQtyCount}` },
        delivery_driver_layer: { icon: '🚚', title: 'بيانات التوصيل، السائق، وإمضاء الاستلام', body: 'اسم السائق: ........................ | رقم المركبة: ................ | إمضاء المستلم: ................' },
        warranty_imei_layer: { icon: '🛡️', title: 'شهادة الضمان الرسمي والأرقام التسلسلية (IMEI / S-N)', body: 'يشمل الضمان عيوب التصنيع وفق الشروط المعمول بها مع إحضار هذه الشهادة.' },
        order_reservation_layer: { icon: '📋', title: 'بطاقة حجز الطلبية والعربون المدفوع (Acompte)', body: `إجمالي الطلبية: ${this.fmtDzd(totalVal)} | العربون المستلم: ${this.fmtDzd(paidVal)} | الباقي عند التسليم: ${this.fmtDzd(remTodayDebt)}` },
        dual_signature_stamps_layer: { icon: '✍️', title: 'الإمضاءات والأختام الرسمية المعتمدة', body: 'توقيع المسلّم: .................... | توقيع المراقب: .................... | توقيع المستلم: ....................' }
      };

      if (specializedMap[lid]) {
        const sp = specializedMap[lid];
        return `
          <div style="border:1.5px solid ${theme.border};border-radius:8px;padding:6px 8px;background:${theme.accentBg};font-size:${isThermal ? '10px' : '11px'};color:#0f172a;">
            <div ${editAttr} style="font-weight:900;color:${theme.primary};margin-bottom:2px;">${sp.icon} ${cTitle || sp.title}</div>
            <div ${editAttr} style="font-weight:800;line-height:1.45;">${sp.body}</div>
            ${noteHtml}
          </div>`;
      }

      // ── 27. طبقة ملاحظة حرة مخصصة (free_custom_note_layer أو custom_*) ──
      // هام جداً: في الطباعة والـ PDF (forPrintOutput = true) لا نطبع أبداً عبارة "انقر هنا لكتابة أي ملاحظة إضافية..."!
      const userFreeText = (cTitle || cNote || layer.content || '').trim();
      if (forPrintOutput && (!userFreeText || userFreeText.includes('انقر هنا لكتابة'))) {
        return '';
      }
      return `
        <div style="border:1px dashed ${theme.border};border-radius:8px;padding:6px 8px;background:#f8fafc;font-size:${isThermal ? '10px' : '11px'};font-weight:800;">
          <div ${editAttr}>${userFreeText || '📝 ملاحظة إضافية (انقر هنا لتعديل النص في الاستوديو)...'}</div>
        </div>`;
    };

    // ========================================================================
    // 4. استبدال buildLiveDocumentPaperHtml بمحرك V74 الأصلي الموحد 100%
    //    يقرأ customOverrides ويطبق كافة أدوات التخصيص (⚙️) في المعاينة وفي الطباعة!
    // ========================================================================
    studio.buildLiveDocumentPaperHtml = function (docDataRaw, forPrintOutput = false, customOverrides = null) {
      const docData = this.enrichDocumentDataWithLoyaltyAndDebt(docDataRaw || {});

      // تحديد إعدادات القالب بدقة (سواء من الاستوديو أو من الصفحة الطابعة عبر customOverrides)
      const targetDocType = (customOverrides && customOverrides.activeDocType) || this.config.activeDocType || 'receipt_thermal';
      const savedProfile = (this.config.adoptedProfiles && this.config.adoptedProfiles[targetDocType]) || {};
      const savedDefault = (this.config.defaultsByDocType && this.config.defaultsByDocType[targetDocType]) || {};

      const cfg = customOverrides
        ? {
            ...this.config,
            ...savedProfile,
            ...customOverrides,
            paperSize: customOverrides.paperSize || savedDefault.paperSize || savedProfile.paperSize || this.config.paperSize || '80mm',
            themeId: customOverrides.themeId || savedDefault.themeId || savedProfile.themeId || this.config.themeId || 'royal_blue',
            columns: { ...(this.config.columns || {}), ...(savedProfile.columns || {}), ...(customOverrides.columns || {}) },
            layers: Array.isArray(customOverrides.layers) && customOverrides.layers.length > 0
              ? customOverrides.layers
              : Array.isArray(savedProfile.layers) && savedProfile.layers.length > 0
              ? savedProfile.layers
              : this.config.layers
          }
        : this.config;

      const paperSize = cfg.paperSize || '80mm';
      const isThermal = paperSize === '80mm' || paperSize === '58mm';
      const theme = (this.THEMES && this.THEMES[cfg.themeId]) || (this.THEMES && this.THEMES.royal_blue) || {
        primary: '#1d4ed8',
        secondary: '#1e3a8a',
        accentBg: '#eff6ff',
        border: '#93c5fd'
      };

      const editAttr = forPrintOutput ? '' : 'contenteditable="true" spellcheck="false"';
      const visibleLayers = (cfg.layers || []).filter((l) => l && l.visible);

      const layersHtml = visibleLayers
        .map((layer) => {
          const innerHtml = this.renderSingleLayerUnifiedV74(layer, cfg, docData, theme, isThermal, editAttr, forPrintOutput);
          if (!innerHtml || !innerHtml.trim()) return '';

          // تطبيق أدوات مفتش الطبقة (⚙️): حجم الخط، المحاذاة، الإطار، والخلفية
          const scalePct = Number(layer.fontSizeScale || 100);
          const alignVal = layer.textAlign || 'right';
          const padMap = { compact: '2px', normal: '5px', spacious: '9px' };
          const padVal = padMap[layer.paddingMode || 'normal'] || '5px';

          let extraBoxStyle = `font-size:${scalePct}%;text-align:${alignVal};padding:${padVal};`;
          if (layer.borderStyle === 'solid_bold') extraBoxStyle += `border:2px solid ${theme.primary};border-radius:8px;`;
          else if (layer.borderStyle === 'dashed') extraBoxStyle += `border:1.5px dashed #475569;border-radius:8px;`;
          else if (layer.borderStyle === 'double') extraBoxStyle += `border:3px double ${theme.primary};border-radius:8px;`;

          if (layer.bgStyle === 'tinted') extraBoxStyle += `background:${theme.accentBg};border-radius:8px;`;
          else if (layer.bgStyle === 'white') extraBoxStyle += `background:#ffffff;`;
          else if (layer.bgStyle === 'dark_header') extraBoxStyle += `background:#0f172a;color:#ffffff;border-radius:8px;`;

          const handleBarHtml = forPrintOutput
            ? ''
            : `<div class="v45-layer-handle-bar" onclick="window.GherbiPrintStudioV45.toggleInlineInspector('${layer.id}')" style="cursor:pointer;">
                <span>${layer.name}</span>
                <span>⚙️ خصائص الطبقة</span>
              </div>`;

          return `
            <div class="v45-canvas-layer" data-v47-layer-id="${layer.id}">
              ${handleBarHtml}
              <div style="${extraBoxStyle}">${innerHtml}</div>
            </div>`;
        })
        .filter(Boolean)
        .join('\n');

      const zoomPct = forPrintOutput ? 100 : Number(cfg.zoomPct || 100);
      const baseFontPx = Number(cfg.baseFontSizePx || (isThermal ? 11.5 : 12));

      // إذا كان مقاس 2×A5 مزدوج (نسختان في ورقة A4 واحدة)
      if (paperSize === '2xa5') {
        return `
          <div class="v45-live-paper paper-2xa5" dir="rtl" style="font-family:'${cfg.fontFamily || 'Cairo'}',Tahoma,sans-serif;font-size:${baseFontPx}px;transform:scale(${zoomPct / 100});display:grid;grid-template-columns:1fr 1fr;gap:10mm;">
            <div style="border-left:1.5px dashed #94a3b8;padding-left:5mm;">${layersHtml}</div>
            <div>${layersHtml}</div>
          </div>`;
      }

      return `
        <div class="v45-live-paper paper-${paperSize} margin-${cfg.marginMode || 'normal'} density-${cfg.densityMode || 'normal'} border-style-${cfg.borderMode || 'grid'}" dir="rtl" style="font-family:'${cfg.fontFamily || 'Cairo'}',Tahoma,sans-serif;font-size:${baseFontPx}px;transform:scale(${zoomPct / 100});">
          ${
            cfg.watermarkText
              ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:900;color:rgba(15,23,42,0.05);transform:rotate(-25deg);pointer-events:none;">${cfg.watermarkText}</div>`
              : ''
          }
          ${layersHtml}
        </div>`;
    };

    // ========================================================================
    // 5. ترقية renderAdoptedMasterDocumentHtml لتضمن أن أي عملية طباعة أو PDF
    //    من أي صفحة في البرنامج تستخدم القالب المعتمد وجميع أدواته الـ 36 بنسبة 100%!
    // ========================================================================
    studio.renderAdoptedMasterDocumentHtml = async function (docType, rawDocData, extraOpts = {}) {
      const targetType = docType || 'receipt_thermal';
      const docMeta = this.getActiveDocMeta(targetType);

      if (!this.config.adoptedProfiles) this.config.adoptedProfiles = {};
      if (!this.config.adoptedProfiles[targetType]) {
        this.config.adoptedProfiles[targetType] = this.buildIdealProfileObjectForDoc(docMeta);
      }

      const prof = this.config.adoptedProfiles[targetType];
      const def = (this.config.defaultsByDocType && this.config.defaultsByDocType[targetType]) || {};
      const effectivePaper = extraOpts.paperSize || def.paperSize || prof.paperSize || docMeta.defaultPaper || '80mm';
      const effectiveTheme = extraOpts.themeId || def.themeId || prof.themeId || docMeta.defaultTheme || 'royal_blue';
      const isThermal = effectivePaper === '80mm' || effectivePaper === '58mm';

      const enrichedData = this.enrichDocumentDataWithLoyaltyAndDebt(rawDocData || {});
      const paperHtml = this.buildLiveDocumentPaperHtml(enrichedData, true, {
        ...prof,
        activeDocType: targetType,
        paperSize: effectivePaper,
        themeId: effectiveTheme
      });

      const pageRule = isThermal
        ? `@page { size: ${effectivePaper} auto; margin: 2mm; }`
        : effectivePaper === '2xa5'
        ? `@page { size: A4 landscape; margin: 6mm; }`
        : effectivePaper === 'a5'
        ? `@page { size: A5 portrait; margin: 6mm; }`
        : `@page { size: A4 portrait; margin: 8mm; }`;

      return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-v52-studio-master="1" data-v62-adopted-doc="${targetType}">
<head>
  <meta charset="UTF-8">
  <title>${docMeta.cleanTitle || docMeta.name}</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #0f172a !important; font-family: 'Cairo', 'Tajawal', Tahoma, sans-serif !important; direction: rtl !important; }
    .v45-live-paper {
      box-shadow: none !important;
      margin: 0 auto !important;
      transform: none !important;
      width: ${isThermal ? (effectivePaper === '58mm' ? '54mm' : '76mm') : '100%'} !important;
      min-height: auto !important;
      padding: ${isThermal ? '2mm' : '5mm'} !important;
      background: #ffffff !important;
    }
    .v45-canvas-layer { border-color: transparent !important; margin-bottom: 5px !important; page-break-inside: avoid; }
    .v45-layer-handle-bar { display: none !important; }
    table { width: 100% !important; border-collapse: collapse !important; direction: rtl !important; }
  </style>
</head>
<body>${paperHtml}</body>
</html>`;
    };

    // تحديث المعاينة الحية فوراً إذا كان مركز الطباعة مفتوحاً
    if (document.getElementById('view-print')?.classList.contains('active')) {
      studio.renderStudioIntoRoot();
    }

    console.log('🏆 [Gherbi V74 Unified Native 36-Layers Print Engine]: تم توحيد المعاينة والطباعة والـ PDF لجميع الـ 36 طبقة والـ 34 مستنداً وإزالة نص "انقر هنا..." نهائياً!');
  }, 120);
})();
