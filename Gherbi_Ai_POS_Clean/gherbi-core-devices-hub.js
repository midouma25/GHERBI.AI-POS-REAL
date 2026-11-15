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
                <h3 class="text-base font-black text-slate-900 dark:text-white">⚙️ قمرة القوالب الافتراضية المعتمدة لكل صفحات البرنامج (Par Défaut)</h3>
                <p class="text-xs text-slate-500">أي قالب تعتمده هنا يصبح أمراً مطلقاً في الكاشير وجميع الصفحات المرتبطة به</p>
              </div>
              <button type="button" onclick="window.GherbiPrintStudioV45.adoptAllIdealPresetsAcrossAllPages()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow cursor-pointer">
                🚀 اعتماد القوالب المثالية لكل الـ 12 مستنداً دفعة واحدة
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
