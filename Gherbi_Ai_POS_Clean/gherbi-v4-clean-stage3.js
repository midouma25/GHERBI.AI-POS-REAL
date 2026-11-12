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
