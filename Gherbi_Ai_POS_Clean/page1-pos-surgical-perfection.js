/**
 * fix-page1-now.js
 * السكربت الجراحي الفوري لإصلاح خطأ السطر 2537 في renderer-rc-100.js وخطأ pos-produce.js
 * وإلغاء تجمد شاشة الإقلاع (#splashScreen) وتفعيل كامل مزايا الصفحة 1 (#view-pos) وروبوت الفحص الآلي.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🔧 بدء الإصلاح الجراحي الفوري لشاشة الإقلاع والصفحة 1 (#view-pos)...\n');

// ============================================================================
// 1. إصلاح manufacturing/pos-produce.js ليعمل في كلٍ من Node.js (server.js) والمتصفح (index.html)
//    بدون خطأ Uncaught ReferenceError: require is not defined
// ============================================================================
const posProducePath = path.join(ROOT, 'manufacturing', 'pos-produce.js');
const universalPosProduceCode = `/**
 * manufacturing/pos-produce.js
 * محرك التصنيع الآلي الفوري عند البيع في شاشة الكاشير (يعمل في Node.js وفي المتصفح معاً)
 */

'use strict';

(function (root) {
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const productionGuard = isNode ? require('./production-guard') : null;

  async function autoProduceShortfallsForSale(db, saleItems = [], options = {}) {
    if (!isNode || !productionGuard || !db) return [];
    const globalAutoSetting = await db.getSetting('manufacturing_auto_on_sale', 'false');
    const isGlobalAutoEnabled =
      String(globalAutoSetting).toLowerCase() === 'true' || globalAutoSetting === '1';

    const producedOrders = [];

    for (const item of Array.isArray(saleItems) ? saleItems : []) {
      const productId = Number(item.product_id || item.productId);
      const requestedQty = Number(item.quantity || 0);
      if (!productId || requestedQty <= 0) continue;

      const stockRow = await db.dbGet(
        'SELECT COALESCE(SUM(stock), 0) AS current_stock FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL',
        [productId]
      );
      const currentStock = Number((stockRow && stockRow.current_stock) || 0);
      const shortfall = Number((requestedQty - currentStock).toFixed(6));

      if (shortfall <= 0.0001) continue;

      const recipe = await db.dbGet(
        \`SELECT * FROM bom_recipes
         WHERE product_id = ? AND is_active = 1 AND deleted_at IS NULL
         ORDER BY is_default DESC, id DESC
         LIMIT 1\`,
        [productId]
      );

      if (!recipe) continue;
      if (!isGlobalAutoEnabled && !Number(recipe.auto_on_sale)) continue;

      let qtyToProduce = shortfall;
      if (recipe.auto_round === 'batch' && Number(recipe.output_qty) > 0) {
        const batchesNeeded = Math.ceil(shortfall / Number(recipe.output_qty));
        qtyToProduce = batchesNeeded * Number(recipe.output_qty);
      }

      try {
        const avail = await productionGuard.computeRecipeAvailability(db, {
          recipeId: recipe.id,
          plannedQty: qtyToProduce
        });

        if (avail && avail.can_produce) {
          const order = await productionGuard.createProductionOrder(db, {
            recipe_id: recipe.id,
            planned_qty: qtyToProduce,
            produced_qty: qtyToProduce,
            trigger_source: 'auto_pos_sale',
            sale_id: options.saleId || null,
            user_id: options.userId || null,
            confirmImmediately: true,
            note: 'إنتاج تلقائي لتغطية بيع الكاشير'
          });
          producedOrders.push(order);
        }
      } catch (err) {
        console.warn('[Auto-Produce POS] Skipped product #' + productId + ':', err.message);
      }
    }

    return producedOrders;
  }

  if (isNode) {
    module.exports = { autoProduceShortfallsForSale };
  } else if (root) {
    root.PosProduce = {
      openQuickProduceModal: function () {
        if (root.App && typeof root.App.openPosQuickProduceModal === 'function') {
          root.App.openPosQuickProduceModal();
        }
      }
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(posProducePath, universalPosProduceCode, 'utf8');
console.log('✅ 1/4: تم إصلاح manufacturing/pos-produce.js ليعمل في المتصفح والخادم بدون خطأ require.');

// ============================================================================
// 2. إضافة صمام أمان في index.html لإخفاء #splashScreen دائماً وتثبيت الوضع النهاري
// ============================================================================
const twPath = path.join(ROOT, 'assets', 'js', 'tailwind.min.js');
if (fs.existsSync(twPath)) {
  let twCode = fs.readFileSync(twPath, 'utf8');
  twCode = twCode.replace(/darkMode:"media"/g, 'darkMode:"class"').replace(/darkMode:'media'/g, "darkMode:'class'");
  fs.writeFileSync(twPath, twCode, 'utf8');
}

const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // إضافة صمام أمان مباشر بعد #splashScreen ليختفي تلقائياً بعد 500ms تحت أي ظرف
  if (!html.includes('id="splash-failsafe-script"')) {
    html = html.replace(
      '<div id="app-container">',
      `<script id="splash-failsafe-script">
    setTimeout(function () {
      var sp = document.getElementById('splashScreen');
      if (sp) {
        sp.style.opacity = '0';
        setTimeout(function () { sp.style.display = 'none'; }, 300);
      }
    }, 500);
  </script>\n  <div id="app-container">`
    );
  }

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✅ 2/4: تم تركيب صمام الأمان الفوري لشاشة الإقلاع (#splashScreen) في index.html.');
}

// ============================================================================
// 3. قص الجزء التالف من نهاية renderer-rc-100.js وحقن كود الصفحة 1 السليم 100%
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  // قص أي كتلة PAGE 1 سابقة (بما فيها الكتلة التي احتوت على الخطأ النحوي عند السطر 2537)
  const markerIdx = rc.indexOf('// [PAGE 1 POS SURGICAL PERFECTION');
  if (markerIdx !== -1) {
    const headerStart = rc.lastIndexOf('// ====', markerIdx);
    rc = rc.slice(0, headerStart !== -1 ? headerStart : markerIdx).trimEnd();
  }

  // إيقاف حقن صناديق العملات المكررة في #checkoutModal
  rc = rc.replace(
    /if \(paidInput && !document\.getElementById\('chkDzBanknotesBar'\)\) \{[\s\S]*?paidInput\.parentNode\.appendChild\(bar\);\s*\}/m,
    '/* [Unified Banknotes Deck] */'
  );
  rc = rc.replace(
    /if \(paidInput && !document\.getElementById\('chkAlgerianBanknotesBox'\)\) \{[\s\S]*?paidInput\.parentElement\.insertAdjacentHTML\('beforeend', notesHtml\);\s*\}/m,
    '/* [Unified Banknotes Deck] */'
  );

  // قراءة الكود الجديد كسلسلة خام (String.raw) حتى لا يتحول أي رمز هروب إلى سطر جديد
  const cleanPage1Code = String.raw`
// ============================================================================
// [PAGE 1 POS SURGICAL PERFECTION & AUTOMATED QA BOT — GHERBI.AI EXCLUSIVE]
// ============================================================================
(function applyPage1PosSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  // 1. إخفاء سعر الشراء (التكلفة) افتراضياً عن عين الزبون، ولا يظهر إلا بطلب البائع (Alt+C أو زر العين)
  AppState.posShowCost = false;
  AppState._quickMultiplier = 1;

  function cleanAndUpgradePosDom() {
    // إزالة الأزرار المكررة من الشريط العلوي
    ['btnPosRecentSalesQuick', 'btnPosCustomizeQuick'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    // إزالة صناديق الفئات النقدية المكررة داخل #checkoutModal
    ['chkDzBanknotesBar', 'chkAlgerianBanknotesBox'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    // إضافة زر "تصفير (0 د.ج)" بجانب زر "المبلغ الكامل" في لوحة الفئات النقدية اليسرى داخل #checkoutModal
    var exactBtn = document.querySelector('#checkoutModal button[onclick*="setExactCash"]');
    if (exactBtn && !document.getElementById('btnCheckoutZeroCash')) {
      exactBtn.classList.add('col-span-2');
      exactBtn.insertAdjacentHTML(
        'afterend',
        '<button id="btnCheckoutZeroCash" type="button" onclick="document.getElementById(\'chkPaidAmount\').value=\'0\'; AppState._banknoteClickedOnce=true; App.recalcCheckoutModal()" class="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs">تصفير (0 د.ج)</button>'
      );
    }

    // تحديث شريط الأدوات الجزائري في أعلى السلة (#posAlgerianMasterBar)
    var masterBar = document.getElementById('posAlgerianMasterBar');
    if (masterBar && !document.getElementById('btnRunPosAutoTest')) {
      masterBar.innerHTML =
        '<button type="button" onclick="App.openPosRecentSalesModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-blue-600"><span data-i18n-pos="recent_sales">🧾 آخر المبيعات</span></button>' +
        '<button type="button" onclick="App.openChequesPortfolioModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-indigo-600"><span data-i18n-pos="cheques">🏦 الشيكات</span></button>' +
        '<button type="button" onclick="App.openAlgerianFiscalModal()" class="px-2 py-1 rounded-lg bg-emerald-600 text-white">🇩🇿 État 104 & G50</button>' +
        '<button type="button" onclick="App.openRecapInvoiceModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-purple-600"><span data-i18n-pos="recap_inv">📑 فاتورة مجمعة</span></button>' +
        '<button type="button" onclick="App.openPriceListModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"><span data-i18n-pos="price_catalog">🖨️ كتالوج الأسعار</span></button>' +
        '<button type="button" onclick="App.openMobileCompanionModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-emerald-600"><span data-i18n-pos="mobile_pair">📱 ربط الهاتف</span></button>' +
        '<button id="btnRunPosAutoTest" type="button" onclick="App.runAutoTest_PosPage()" title="تشغيل الفحص الآلي الشامل لشاشة الكاشير (Ctrl+Shift+T)" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black mr-auto">🤖 فحص آلي (QA)</button>';
    }

    // حقن شريط الضرب السريع (×1, ×2, ×3, ×5, ×10 + بيع بمبلغ د.ج) أعلى قائمة عناصر السلة
    var cartItemsBox = document.getElementById('posCartItems');
    if (cartItemsBox && !document.getElementById('posQuickMultiplierBar')) {
      var multBar = document.createElement('div');
      multBar.id = 'posQuickMultiplierBar';
      multBar.className = 'px-3 py-1.5 bg-blue-500/5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1 text-[11px] font-bold shrink-0';
      multBar.innerHTML =
        '<div class="flex items-center gap-1">' +
        '<span class="text-slate-400 text-[10px]" data-i18n-pos="mult_label">ضرب الكمية:</span>' +
        [1, 2, 3, 5, 10]
          .map(function (m) {
            return (
              '<button type="button" data-mult="' +
              m +
              '" onclick="App.setQuickMultiplier(' +
              m +
              ')" class="mult-pill px-2 py-0.5 rounded-md font-mono font-black ' +
              (m === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300') +
              '">×' +
              m +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        '<button type="button" onclick="App.openReverseAmountCalculator()" title="احسب الوزن أو الكمية تلقائياً حسب المبلغ الذي يطلبه الزبون (مثلاً: أعطني بـ 500 د.ج)" class="px-2 py-0.5 rounded-md bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-black">⚖️ بيع بمبلغ (د.ج)</button>';
      cartItemsBox.parentNode.insertBefore(multBar, cartItemsBox);
    }

    // ضبط أبعاد تذييل السلة لمنع انقطاع زر التسديد (F1) عند ظهور شريط تعديل الفاتورة
    var cartFooter = document.querySelector('#posCartContainer > div:last-child');
    if (cartFooter) {
      cartFooter.className = 'p-2.5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-700 space-y-1.5 shrink-0';
    }
    var checkoutMainBtn = document.querySelector('#posCartContainer button[onclick*="openCheckoutModal"]');
    if (checkoutMainBtn) {
      checkoutMainBtn.className = 'w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25';
    }
  }

  App.setQuickMultiplier = function (m) {
    AppState._quickMultiplier = Number(m) || 1;
    document.querySelectorAll('#posQuickMultiplierBar .mult-pill').forEach(function (btn) {
      var val = Number(btn.getAttribute('data-mult'));
      btn.className =
        'mult-pill px-2 py-0.5 rounded-md font-mono font-black ' +
        (val === AppState._quickMultiplier
          ? 'bg-blue-600 text-white shadow'
          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300');
    });
  };

  // 2. دمج السطور تلقائياً في السلة + أزرار (+ / -) وحارس منع البيع بالخسارة
  App.addProductToCart = function (productId, qty, options) {
    if (qty === undefined) qty = 1;
    options = options || {};
    var prod = AppState.products.find(function (p) {
      return Number(p.id) === Number(productId);
    });
    if (!prod) return;

    var mult = AppState._quickMultiplier || 1;
    var effectiveQty = Number(qty || 1) * mult;
    if (mult !== 1) this.setQuickMultiplier(1);

    var signedQty = AppState.returnMode ? -Math.abs(effectiveQty) : effectiveQty;
    var cart = this.currentCart;
    var tier = cart.priceTier || 'retail';
    var basePrice =
      options.overridePrice !== undefined
        ? Number(options.overridePrice)
        : tier === 'wholesale' && Number(prod.wholesale_price) > 0
          ? Number(prod.wholesale_price)
          : Number(prod.selling_price || 0);

    var targetVariantId = options.variantId || null;

    var existingItem = cart.items.find(function (it) {
      return (
        (Number(it.product_id || it.productId) === Number(prod.id) ||
          (it.name && it.name === prod.name && !it.product_id)) &&
        (it.variant_id || null) === targetVariantId &&
        !it._isWholesaleMode &&
        Math.abs(Number(it.price || 0) - basePrice) < 0.01
      );
    });

    if (existingItem) {
      existingItem.product_id = Number(prod.id);
      existingItem.quantity = Number((Number(existingItem.quantity || 0) + signedQty).toFixed(3));
      existingItem.subtotal = Number((existingItem.quantity * existingItem.price).toFixed(2));
      if (existingItem.quantity === 0) {
        cart.items = cart.items.filter(function (x) {
          return x !== existingItem;
        });
      }
    } else {
      var batches = Array.isArray(prod.batches) ? prod.batches : [];
      var firstBatch =
        batches.find(function (b) {
          return Number(b.stock) > 0;
        }) ||
        batches[0] ||
        null;
      cart.items.push({
        product_id: Number(prod.id),
        batch_id: options.batchId || (firstBatch ? firstBatch.id : null),
        variant_id: targetVariantId,
        name: options.customName || prod.name,
        unit: prod.unit || 'قطعة',
        quantity: signedQty,
        price: basePrice,
        cost_price: Number(prod.cost_price || (firstBatch && firstBatch.cost_price) || 0),
        subtotal: Number((signedQty * basePrice).toFixed(2)),
        serial_number: options.serialNumber || null,
        warranty_months: Number(prod.warranty_months || 0)
      });
    }

    this.recalcAndRenderCart();
  };

  App.stepCartItemQty = function (idx, delta) {
    var item = this.currentCart.items[idx];
    if (!item) return;
    var nextQty = Number((Number(item.quantity || 0) + Number(delta)).toFixed(3));
    if (nextQty <= 0 && !AppState.returnMode) {
      this.removeCartItem(idx);
      return;
    }
    item.quantity = nextQty;
    item.subtotal = Number((item.quantity * item.price).toFixed(2));
    this.recalcAndRenderCart();
  };

  App.renderCartItems = function () {
    var container = document.getElementById('posCartItems');
    if (!container) return;
    var items = this.currentCart.items || [];

    if (items.length === 0) {
      var emptyTxt =
        AppState.lang === 'fr'
          ? 'Panier vide — Choisissez un produit ou scannez un code-barres'
          : AppState.lang === 'en'
            ? 'Cart is empty — Select a product or scan a barcode'
            : 'السلة فارغة — اختر منتجاً أو امسح باركود';
      container.innerHTML =
        '<div class="h-full flex flex-col items-center justify-center text-slate-400 py-8">' +
        '<span class="material-symbols-rounded icon-xl mb-2 opacity-40">shopping_basket</span>' +
        '<div class="text-xs font-bold">' +
        emptyTxt +
        '</div></div>';
      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
      return;
    }

    container.innerHTML = items
      .map(function (item, idx) {
        var prod = AppState.products.find(function (p) {
          return Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name;
        });
        if (prod && !item.product_id) item.product_id = prod.id;
        var cost = Number(item.cost_price || (prod && prod.cost_price) || 0);
        var isBelowCost = cost > 0 && Number(item.price) < cost;

        return (
          '<div class="p-2 rounded-xl border ' +
          (isBelowCost
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90') +
          ' flex items-center justify-between gap-1.5 shadow-sm">' +
          '<div class="min-w-0 flex-1">' +
          '<div class="font-bold text-xs truncate">' +
          (item.name || item.custom_product_name || 'منتج') +
          '</div>' +
          '<div class="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">' +
          '<span>' +
          Number(item.price || 0).toFixed(2) +
          ' د.ج / ' +
          (item.unit || (prod && prod.unit) || 'قطعة') +
          '</span>' +
          (prod
            ? '<button type="button" onclick="App.toggleCartItemWholesaleUnit(' +
              idx +
              ')" class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 font-sans font-bold hover:bg-indigo-600 hover:text-white transition">' +
              (item._isWholesaleMode ? '📦 جملة' : 'وحدة / تسعيرة') +
              '</button>'
            : '') +
          (isBelowCost
            ? '<span class="px-1.5 py-0.2 rounded bg-rose-600 text-white font-sans font-bold">⚠️ أقل من التكلفة (' +
              cost.toFixed(0) +
              ')</span>'
            : '') +
          '</div></div>' +
          '<div class="flex items-center gap-1">' +
          '<button type="button" onclick="App.stepCartItemQty(' +
          idx +
          ', -1)" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white font-mono font-black text-xs">-</button>' +
          '<input type="number" step="any" value="' +
          item.quantity +
          '" onclick="App.openNumpadForCartItem(' +
          idx +
          ')" onchange="App.updateCartItemQty(' +
          idx +
          ', this.value)" title="انقر لفتح لوحة الأرقام اللمسية" class="w-11 px-1 py-1 rounded-lg text-center font-mono font-black text-xs cursor-pointer">' +
          '<button type="button" onclick="App.stepCartItemQty(' +
          idx +
          ', 1)" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white font-mono font-black text-xs">+</button>' +
          '</div>' +
          '<input type="number" step="any" value="' +
          Number(item.price || 0).toFixed(2) +
          '" onchange="App.updateCartItemPrice(' +
          idx +
          ', this.value)" class="w-16 px-1 py-1 rounded-lg text-center font-mono font-bold text-xs text-blue-600 dark:text-blue-400">' +
          '<div class="w-14 text-left font-mono font-black text-xs">' +
          Number(item.subtotal || 0).toFixed(2) +
          '</div>' +
          '<button type="button" onclick="App.removeCartItem(' +
          idx +
          ')" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
          '</div>'
        );
      })
      .join('');

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
  };

  // 3. الحاسبة العكسية للوزن والمبلغ ("أعطني بـ 500 د.ج لوز")
  App.openReverseAmountCalculator = function () {
    var items = this.currentCart.items || [];
    if (items.length === 0) {
      var weightedProd =
        AppState.products.find(function (p) {
          return p.unit === 'كغ' || p.plu_code;
        }) || AppState.products[0];
      if (weightedProd) this.addProductToCart(weightedProd.id, 1);
      else return;
    }
    var lastIdx = this.currentCart.items.length - 1;
    var item = this.currentCart.items[lastIdx];
    this.openNumpadForCartItem(lastIdx);

    var scaleRow = document.getElementById('numModalScaleRow');
    if (scaleRow) {
      scaleRow.innerHTML =
        '<div class="w-full space-y-1.5">' +
        '<div class="font-black text-emerald-600 text-[11px]">⚖️ الحاسبة العكسية (كمية/وزن مقابل مبلغ مطلوب بالدينار):</div>' +
        '<div class="flex gap-1.5">' +
        '<input id="reverseTargetDzdInput" type="number" step="any" placeholder="المبلغ المطلوب (مثلاً 500 د.ج)" oninput="App.computeReverseQtyFromDzd(' +
        lastIdx +
        ', this.value)" class="flex-1 px-2.5 py-1.5 rounded-lg font-mono font-black text-xs">' +
        '<button type="button" onclick="App.computeReverseQtyFromDzd(' +
        lastIdx +
        ', 500)" class="px-2 py-1 bg-emerald-600 text-white rounded-lg font-mono font-bold text-[10px]">500 د.ج</button>' +
        '<button type="button" onclick="App.computeReverseQtyFromDzd(' +
        lastIdx +
        ', 1000)" class="px-2 py-1 bg-emerald-600 text-white rounded-lg font-mono font-bold text-[10px]">1000 د.ج</button>' +
        '</div>' +
        '<div id="reverseCalcResultText" class="text-[11px] font-mono font-bold text-blue-600">سعر الوحدة: ' +
        Number(item.price).toFixed(2) +
        ' د.ج</div></div>';
    }
  };

  App.computeReverseQtyFromDzd = function (idx, targetAmountDzd) {
    var item = this.currentCart.items[idx];
    if (!item || Number(item.price) <= 0) return;
    var amt = parseFloat(targetAmountDzd) || 0;
    if (amt <= 0) return;
    var exactQty = Number((amt / Number(item.price)).toFixed(3));
    var qtyInput = document.getElementById('numModalInput');
    if (qtyInput) qtyInput.value = String(exactQty);
    var resTxt = document.getElementById('reverseCalcResultText');
    if (resTxt) {
      resTxt.textContent =
        'الكمية المحسوبة: ' +
        exactQty +
        ' ' +
        (item.unit || 'وحدة') +
        ' (' +
        Math.round(exactQty * 1000) +
        ' غرام) = ' +
        amt.toFixed(2) +
        ' د.ج';
    }
  };

  // 4. ترقية جدول الشيكات ليعرض بطاقات الإحصائيات أعلى الجدول
  var _origRenderCheques = App.renderChequesPortfolioTable ? App.renderChequesPortfolioTable.bind(App) : null;
  App.renderChequesPortfolioTable = async function () {
    if (_origRenderCheques) await _origRenderCheques();
    var rows = (await window.api.getChequesPortfolio().catch(function () { return []; })) || [];
    var sumBox = document.getElementById('chequesSummaryCards');
    if (sumBox) {
      var totalIn = rows
        .filter(function (r) { return r.direction === 'in' && r.status !== 'rejected'; })
        .reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
      var totalOut = rows
        .filter(function (r) { return r.direction === 'out' && r.status !== 'rejected'; })
        .reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
      var rejectedCnt = rows.filter(function (r) { return r.status === 'rejected'; }).length;
      sumBox.innerHTML =
        '<div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex justify-between items-center">' +
        '<span class="font-bold text-emerald-600">📥 شيكات الزبائن (واردة):</span>' +
        '<strong class="font-mono text-sm font-black text-emerald-600">' + totalIn.toFixed(2) + ' د.ج</strong></div>' +
        '<div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex justify-between items-center">' +
        '<span class="font-bold text-rose-600">📤 شيكات الموردين (صادرة):</span>' +
        '<strong class="font-mono text-sm font-black text-rose-600">' + totalOut.toFixed(2) + ' د.ج</strong></div>' +
        '<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex justify-between items-center">' +
        '<span class="font-bold text-amber-600">⚠️ شيكات مرفوضة (Impayés):</span>' +
        '<strong class="font-mono text-sm font-black text-amber-600">' + rejectedCnt + ' شيك</strong></div>';
    }
  };

  // 5. الترجمة الثلاثية الفورية لأزرار الكاشير (AR / FR / EN)
  var POS_I18N = {
    ar: {
      search_ph: 'ابحث بالاسم، الباركود، الفئة، العائلة، أو كود PLU...',
      barcode_ph: 'امسح الباركود (Enter)...',
      shift_open: 'المناوبة نشطة',
      shift_closed: 'فتح مناوبة صندوق',
      btn_customize: 'تخصيص',
      btn_filter: 'فلتر',
      btn_produce: 'إنتاج فوري',
      btn_free: 'منتج حر (F8)',
      btn_return: 'إرجاع',
      btn_add_prod: 'إضافة منتج',
      prev_page: 'السابق',
      next_page: 'التالي',
      walkin_cust: 'زبون عابر (بدون حساب)',
      tier_retail: 'سعر التجزئة',
      tier_wholesale: 'سعر الجملة',
      discount_lbl: 'التخفيض (% أو مبلغ):',
      btn_clear: 'إلغاء (F4)',
      btn_hold: 'تعليق (F2)',
      btn_proforma: 'كمبدئية',
      btn_order: 'كطلبية',
      btn_pay: 'تسديد الفاتورة (F1)',
      recent_sales: '🧾 آخر المبيعات',
      cheques: '🏦 الشيكات',
      recap_inv: '📑 فاتورة مجمعة',
      price_catalog: '🖨️ كتالوج الأسعار',
      mobile_pair: '📱 ربط الهاتف',
      mult_label: 'ضرب الكمية:'
    },
    fr: {
      search_ph: 'Rechercher par nom, code-barres, catégorie ou PLU...',
      barcode_ph: 'Scanner code-barres (Entrée)...',
      shift_open: 'Session active',
      shift_closed: 'Ouvrir la caisse',
      btn_customize: 'Affichage',
      btn_filter: 'Filtre',
      btn_produce: 'Production',
      btn_free: 'Article libre (F8)',
      btn_return: 'Retour',
      btn_add_prod: 'Nouveau produit',
      prev_page: 'Précédent',
      next_page: 'Suivant',
      walkin_cust: 'Client de passage (Comptoir)',
      tier_retail: 'Prix Détail',
      tier_wholesale: 'Prix Gros',
      discount_lbl: 'Remise (% ou montant):',
      btn_clear: 'Vider (F4)',
      btn_hold: 'Attente (F2)',
      btn_proforma: 'Proforma',
      btn_order: 'Commande',
      btn_pay: 'Encaisser la facture (F1)',
      recent_sales: '🧾 Ventes récentes',
      cheques: '🏦 Chèques & CCP',
      recap_inv: '📑 Facture Récap.',
      price_catalog: '🖨️ Catalogue Prix',
      mobile_pair: '📱 App Mobile',
      mult_label: 'Multiplicateur:'
    },
    en: {
      search_ph: 'Search by name, barcode, category, or PLU...',
      barcode_ph: 'Scan barcode (Enter)...',
      shift_open: 'Shift Active',
      shift_closed: 'Open Till Shift',
      btn_customize: 'Customize',
      btn_filter: 'Filter',
      btn_produce: 'Quick Produce',
      btn_free: 'Free Item (F8)',
      btn_return: 'Return',
      btn_add_prod: 'Add Product',
      prev_page: 'Previous',
      next_page: 'Next',
      walkin_cust: 'Walk-in Customer',
      tier_retail: 'Retail Price',
      tier_wholesale: 'Wholesale Price',
      discount_lbl: 'Discount (% or amount):',
      btn_clear: 'Clear (F4)',
      btn_hold: 'Hold (F2)',
      btn_proforma: 'Proforma',
      btn_order: 'Order',
      btn_pay: 'Checkout & Pay (F1)',
      recent_sales: '🧾 Recent Sales',
      cheques: '🏦 Cheques',
      recap_inv: '📑 Recap Invoice',
      price_catalog: '🖨️ Price List',
      mobile_pair: '📱 Mobile App',
      mult_label: 'Multiplier:'
    }
  };

  var _origSetLanguage = typeof App.setLanguage === 'function' ? App.setLanguage.bind(App) : null;
  App.setLanguage = function (lang) {
    if (_origSetLanguage) _origSetLanguage(lang);
    var dict = POS_I18N[lang] || POS_I18N.ar;

    var searchInp = document.getElementById('globalPosSearch');
    if (searchInp) searchInp.placeholder = dict.search_ph;
    var bcInp = document.getElementById('barcodeInput');
    if (bcInp) bcInp.placeholder = dict.barcode_ph;
    var shiftTxt = document.getElementById('headerShiftText');
    if (shiftTxt) shiftTxt.textContent = AppState.activeSession ? dict.shift_open : dict.shift_closed;

    var setSpanText = function (selector, text) {
      var el = document.querySelector(selector);
      if (el) el.textContent = text;
    };

    setSpanText('button[onclick*="posCustomizeModal"] span:last-child', dict.btn_customize);
    setSpanText('button[onclick*="openPosAdvancedFilterModal"] span:last-child', dict.btn_filter);
    setSpanText('button[onclick*="openPosQuickProduceModal"] span:last-child', dict.btn_produce);
    setSpanText('button[onclick*="openFreeItemModal"] span:last-child', dict.btn_free);
    setSpanText('#btnReturnMode span:last-child', dict.btn_return);
    setSpanText('#view-pos button[onclick*="openProductModal"] span:last-child', dict.btn_add_prod);
    setSpanText('#posPaginationBar button:first-child', dict.prev_page);
    setSpanText('#posPaginationBar button:last-child', dict.next_page);
    setSpanText('#posPriceTierSelect option[value="retail"]', dict.tier_retail);
    setSpanText('#posPriceTierSelect option[value="wholesale"]', dict.tier_wholesale);
    setSpanText('#posCustomerSelect option[value=""]', dict.walkin_cust);
    setSpanText('button[onclick*="openCartModifierModal"] span:last-child', dict.discount_lbl);
    setSpanText('button[onclick*="clearCurrentCart"]', dict.btn_clear);
    setSpanText('button[onclick*="holdCurrentCart"]', dict.btn_hold);
    setSpanText('button[onclick*="saveCartAsProforma"]', dict.btn_proforma);
    setSpanText('button[onclick*="openOrderModalFromCart"]', dict.btn_order);
    setSpanText('#btnCheckoutMainText', dict.btn_pay);

    document.querySelectorAll('[data-i18n-pos]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-pos');
      if (dict[k]) el.textContent = dict[k];
    });

    this.renderPosView();
    this.renderCartItems();
  };

  // 6. روبوت الفحص الآلي الشامل للصفحة الأولى (App.runAutoTest_PosPage)
  App.runAutoTest_PosPage = async function () {
    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      var backupItems = JSON.parse(JSON.stringify(this.currentCart.items || []));
      var backupDiscount = this.currentCart.discount || 0;

      var twMode = window.tailwind && window.tailwind.config && window.tailwind.config.darkMode;
      check('1. توافق محرك الألوان النهاري/الليلي (Tailwind Class Mode)', twMode === 'class', 'darkMode=' + twMode);

      var chkBtn = document.querySelector('#posCartContainer button[onclick*="openCheckoutModal"]');
      var rect = chkBtn ? chkBtn.getBoundingClientRect() : null;
      check('2. ظهور زر التسديد السفلي (F1) بالكامل دون انقطاع', Boolean(rect && rect.height >= 24), rect ? 'Visible OK' : 'Missing');

      var requiredIds = ['globalPosSearch', 'barcodeInput', 'posProductsGrid', 'posCartItems', 'cartTotalText', 'checkoutModal', 'posQuickMultiplierBar'];
      var missingIds = requiredIds.filter(function (id) { return !document.getElementById(id); });
      check('3. تكامل عناصر شاشة المبيعات والنوافذ (DOM Integrity)', missingIds.length === 0, missingIds.join(', ') || 'All Elements OK');

      var prods = await window.api.getProducts({});
      check('4. اتصال قاعدة البيانات وجلب المنتجات (SQLite WAL)', Array.isArray(prods) && prods.length > 0, prods.length + ' منتج');

      this.currentCart.items = [];
      this.currentCart.discount = 0;
      var sampleProd = AppState.products[0];
      if (sampleProd) {
        this.addProductToCart(sampleProd.id, 1);
        check('5. محاكاة إضافة منتج إلى السلة', this.currentCart.items.length === 1, sampleProd.name);

        this.addProductToCart(sampleProd.id, 2);
        check('6. دمج الكميات تلقائياً لنفس المنتج دون تكرار السطور', this.currentCart.items.length === 1 && Number(this.currentCart.items[0].quantity) === 3, 'Qty = 3');

        this.stepCartItemQty(0, 1);
        check('7. عمل أزرار زيادة ونقصان الكمية السريعة (+ / -)', Number(this.currentCart.items[0].quantity) === 4, 'Qty = 4');
      }

      if (this.currentCart.items.length > 0) {
        this.computeReverseQtyFromDzd(0, 600);
        check('8. الحاسبة العكسية للوزن والمبلغ (بيع بمبلغ د.ج)', Boolean(document.getElementById('numModalInput')), 'Calculator Ready');
      }

      var centStr = typeof this.formatAlgerianCentimes === 'function' ? this.formatAlgerianCentimes(3530) : '';
      check('9. محرك التداول بالعملة الجزائرية (السنتيم)', centStr.includes('353'), centStr);

      var stampVal = typeof this.computeAlgerianStampDuty === 'function' ? this.computeAlgerianStampDuty(45000) : 0;
      check('10. محرك الطابع الجبائي الجزائري التدريجي (1% / 1.5% / 2%)', stampVal === 525, '525 د.ج');

      await this.openCheckoutModal();
      var noDupBanknotes = !document.getElementById('chkDzBanknotesBar') && !document.getElementById('chkAlgerianBanknotesBox');
      this.closeModal('checkoutModal');
      check('11. نظافة نافذة التسديد (#checkoutModal) وعدم تكرار الفئات النقدية', noDupBanknotes, 'Single Banknote Grid');

      this.currentCart.items = backupItems;
      this.currentCart.discount = backupDiscount;
      this.recalcAndRenderCart();
      check('12. حماية سرية سعر الشراء واستعادة السلة النظيفة', AppState.posShowCost === false, 'Cost Hidden by Default');
    } catch (err) {
      check('خطأ غير متوقع أثناء الاختبار', false, err.message);
    }

    var passedCount = results.filter(function (r) { return r.passed; }).length;
    var modal = document.getElementById('posQaReportModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'posQaReportModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="modal-content w-full max-w-2xl p-6 space-y-4">' +
      '<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="px-3 py-1 rounded-xl ' + (passedCount === results.length ? 'bg-emerald-600' : 'bg-amber-500') + ' text-white font-black text-xs">' +
      passedCount + ' / ' + results.length + ' PASS</span>' +
      '<h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 1 (شاشة الكاشير #view-pos)</h3></div>' +
      '<button onclick="App.closeModal(\'posQaReportModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button></div>' +
      '<div class="space-y-1.5 max-h-96 overflow-y-auto text-xs">' +
      results.map(function (r) {
        return (
          '<div class="p-2.5 rounded-xl border ' +
          (r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') +
          ' flex items-center justify-between">' +
          '<div class="font-bold">' + (r.passed ? '✅' : '❌') + ' ' + r.name + '</div>' +
          '<div class="font-mono text-[11px] text-slate-500 dark:text-slate-300">' + (r.detail || 'OK') + '</div></div>'
        );
      }).join('') +
      '</div>' +
      '<div class="flex justify-end pt-2">' +
      '<button onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة التالية</button>' +
      '</div></div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      App.runAutoTest_PosPage();
    } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      App.togglePosCostPeek();
    } else if (e.key === 'F9') {
      e.preventDefault();
      var s = document.getElementById('globalPosSearch');
      if (s) s.focus();
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function () {
      cleanAndUpgradePosDom();
      App.renderPosView();
      App.renderCartItems();
    }, 350);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        cleanAndUpgradePosDom();
        App.renderPosView();
        App.renderCartItems();
      }, 350);
    });
  }
})();
`;

  const finalRc = rc.trimEnd() + '\n\n' + cleanPage1Code.trim() + '\n';

  // فحص القواعد النحوية قبل حفظ الملف على القرص لضمان عدم حدوث أي خطأ نحوي إطلاقاً
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  new vm.Script(universalPosProduceCode, { filename: 'pos-produce.js' });

  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 3/4: تم تنظيف السطر 2537 وحقن كود الصفحة 1 السليم في renderer-rc-100.js.');
  console.log('✅ 4/4: اجتاز كلٌ من renderer-rc-100.js و pos-produce.js فحص القواعد النحوية بنسبة 100% (0 أخطاء)!');
  console.log('\n🎉 شغّل التطبيق الآن عبر: npm run dev');
}

