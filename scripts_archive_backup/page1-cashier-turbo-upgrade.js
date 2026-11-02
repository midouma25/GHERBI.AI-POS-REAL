/**
 * page1-cashier-turbo-upgrade.js
 * الترقية الجراحية الشاملة لمنظومة الكاشير السريع بدون فأرة (Zero-Mouse Cashier Turbo Workflow)
 * تطبق:
 * 1. التركيز التلقائي المغناطيسي الدائم على خانة الباركود (#barcodeInput) + اختصار F5 + لاقط الليزر الذكي.
 * 2. اختصار F4 للانتقال الفوري لخانة البحث بالاسم (#globalPosSearch) + الإضافة المباشرة بـ Enter.
 * 3. اختصار F12 للانتقال الفوري وتظليل خانة السعر في السلة لتعديله يدوياً ثم العودة للباركود بـ Enter.
 * 4. التحكم الفوري بالكمية عبر (+ / -) من الكيبورد أو الماوس والتنقل بين سطور السلة بـ (ArrowUp / ArrowDown).
 * 5. اختصار Escape (Échap) لتأكيد الفاتورة وطباعة تذكرة حرارية 80mm مباشرة وبصمت (Silent 80mm Print).
 * 6. اختصار Ctrl + Space لحفظ وتأكيد الفاتورة فوراً بدون طباعة.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿⚡ بدء تطبيق منظومة الكاشير التوربيني السريع (page1-cashier-turbo-upgrade.js)...\n');

// ============================================================================
// 1. تحديث index.html لإضافة شارات الاختصارات الجديدة وأزرار البيع السريع (Échap / Ctrl+Space)
// ============================================================================
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // تحديث placeholder خانة البحث وخانة الباركود ليوضحا F4 و F5 للبائع
  html = html.replace(
    'placeholder="ابحث بالاسم، الباركود، الفئة، العائلة، أو كود PLU..."',
    'placeholder="[F4] ابحث بالاسم، الباركود، الفئة، أو اضغط Enter للإضافة..."'
  );
  html = html.replace(
    'placeholder="امسح الباركود (Enter)..."',
    'placeholder="[F5] امسح الباركود هنا دائماً..."'
  );

  // تحديث نص زر إلغاء السلة ليصبح (Shift+F4) بعد تخصيص F4 للبحث السريع
  html = html.replace('إلغاء (F4)</button>', 'إلغاء (Shift+F4)</button>');

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✅ 1/3: تم تحديث عناوين خانات البحث (F4) والباركود (F5) في index.html.');
}

// ============================================================================
// 2. تحديث styles.css لإبراز السطر النشط في السلة وخانة الباركود النشطة
// ============================================================================
const cssPath = path.join(ROOT, 'styles.css');
if (fs.existsSync(cssPath)) {
  let css = fs.readFileSync(cssPath, 'utf8');
  css = css.replace(/\/\* \[CASHIER TURBO HUD STYLES\][\s\S]*$/m, '');

  const turboCss = `
/* [CASHIER TURBO HUD STYLES] */
#barcodeInput:focus {
  border-color: #10b981 !important;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25) !important;
}
#globalPosSearch:focus {
  border-color: #2563eb !important;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25) !important;
}
.cart-row-selected {
  border-color: #2563eb !important;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.22) !important;
}
.cart-price-input:focus {
  border-color: #f59e0b !important;
  background-color: rgba(245, 158, 11, 0.12) !important;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3) !important;
}
`;
  fs.writeFileSync(cssPath, css.trimEnd() + '\n' + turboCss + '\n', 'utf8');
  console.log('✅ 2/3: تم تدعيم styles.css بتأثيرات التركيز البصري لخانات الباركود والبحث والسعر.');
}

// ============================================================================
// 3. حقن محرك الكاشير التوربيني (Turbo Cashier Engine) في renderer-rc-100.js
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  // إزالة أي نسخة سابقة من كتلة TURBO CASHIER ENGINE
  const oldTurboIdx = rc.indexOf('// [TURBO CASHIER ENGINE');
  if (oldTurboIdx !== -1) {
    const prevHeader = rc.lastIndexOf('// ====', oldTurboIdx);
    rc = rc.slice(0, prevHeader !== -1 ? prevHeader : oldTurboIdx).trimEnd();
  }

  const turboEngineCode = String.raw`
// ============================================================================
// [TURBO CASHIER ENGINE — F5 BARCODE MAGNET, F4 SEARCH, F12 PRICE, ESC 80MM, CTRL+SPACE SAVE]
// ============================================================================
(function applyTurboCashierEngine() {
  if (!window.App || !window.AppState) return;

  AppState.selectedCartRowIdx = 0;
  AppState._isSubmittingInstantSale = false;

  // فحص ما إذا كانت هناك أي نافذة منبثقة مفتوحة حالياً
  function getActiveModalElement() {
    var modals = document.querySelectorAll('.modal-overlay.active');
    return modals.length > 0 ? modals[modals.length - 1] : null;
  }

  function isPosViewActive() {
    var posSec = document.getElementById('view-pos');
    return Boolean(posSec && posSec.classList.contains('active'));
  }

  // --------------------------------------------------------------------------
  // 1. المغناطيس التلقائي الدائم لخانة الباركود (#barcodeInput) + اختصار F5
  // --------------------------------------------------------------------------
  App.focusBarcodeMagnet = function (clearValue) {
    var bcInp = document.getElementById('barcodeInput');
    if (!bcInp) return;
    if (clearValue) bcInp.value = '';
    bcInp.focus();
    try {
      bcInp.select();
    } catch (_) {}
    updateBarcodeStatusPill(true);
  };

  function updateBarcodeStatusPill(isFocused) {
    var pill = document.getElementById('barcodeMagnetStatusPill');
    if (!pill) return;
    if (isFocused) {
      pill.className = 'px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black whitespace-nowrap';
      pill.textContent = '🟢 جاهز للمسح (F5)';
    } else {
      pill.className = 'px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black whitespace-nowrap cursor-pointer';
      pill.textContent = '⚠️ اضغط F5 للمسح';
    }
  }

  // مراقب ذكي يعيد التركيز لخانة الباركود تلقائياً عندما لا يكون البائع يكتب في حقل آخر
  function installBarcodeAutoFocusGuard() {
    var bcInp = document.getElementById('barcodeInput');
    if (!bcInp) return;

    bcInp.addEventListener('focus', function () {
      updateBarcodeStatusPill(true);
    });
    bcInp.addEventListener('blur', function () {
      updateBarcodeStatusPill(false);
    });

    // عند النقر في أي مكان فارغ داخل شاشة الكاشير، يعود المؤشر فوراً لخانة الباركود
    document.addEventListener('click', function (e) {
      if (!isPosViewActive() || getActiveModalElement()) return;
      var tag = (e.target && e.target.tagName ? e.target.tagName : '').toUpperCase();
      var isInteractive =
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        tag === 'TEXTAREA' ||
        tag === 'BUTTON' ||
        Boolean(e.target && e.target.closest && e.target.closest('button, select, input, textarea, a'));
      if (!isInteractive) {
        setTimeout(function () {
          if (!getActiveModalElement()) App.focusBarcodeMagnet(false);
        }, 40);
      }
    });

    // فحص دوري خفيف: إذا كان المؤشر تائهاً على document.body في شاشة الكاشير، نرجعه فوراً لخانة الباركود
    setInterval(function () {
      if (!isPosViewActive() || getActiveModalElement()) return;
      var active = document.activeElement;
      if (!active || active === document.body || active.tagName === 'HTML' || active.tagName === 'MAIN' || active.tagName === 'SECTION') {
        App.focusBarcodeMagnet(false);
      }
    }, 900);
  }

  // --------------------------------------------------------------------------
  // 2. قفز المؤشر بـ F12 إلى خانة السعر لتعديله يدوياً + العودة للباركود بـ Enter
  // --------------------------------------------------------------------------
  App.focusCartItemPriceInput = function (targetIdx) {
    var items = (this.currentCart && this.currentCart.items) || [];
    if (items.length === 0) {
      if (typeof showToast === 'function') showToast('السلة فارغة — أضف منتجاً أولاً لتعديل سعره (F12)', 'warning');
      return false;
    }
    var idx =
      targetIdx !== undefined && targetIdx !== null && items[targetIdx]
        ? Number(targetIdx)
        : items[AppState.selectedCartRowIdx]
          ? AppState.selectedCartRowIdx
          : items.length - 1;

    AppState.selectedCartRowIdx = idx;
    var priceInp = document.getElementById('cartItemPriceInput-' + idx);
    if (!priceInp) {
      this.renderCartItems();
      priceInp = document.getElementById('cartItemPriceInput-' + idx);
    }
    if (priceInp) {
      priceInp.focus();
      priceInp.select();
      return true;
    }
    return false;
  };

  App.onCartPriceInputKeydown = function (event, idx, inputEl) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.updateCartItemPrice(idx, inputEl.value);
      this.focusBarcodeMagnet(true);
      if (typeof showToast === 'function') {
        showToast('✅ تم تحديث السعر يدوياً والعودة لخانة الباركود', 'success');
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.renderCartItems();
      this.focusBarcodeMagnet(false);
    }
  };

  App.onCartQtyInputKeydown = function (event, idx, inputEl) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.updateCartItemQty(idx, inputEl.value);
      this.focusBarcodeMagnet(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.renderCartItems();
      this.focusBarcodeMagnet(false);
    }
  };

  // تحديث renderCartItems لإضافة المعرف الفريد #cartItemPriceInput-idx ودعم التحديد البصري وأزرار + و -
  App.renderCartItems = function () {
    var container = document.getElementById('posCartItems');
    if (!container) return;
    var items = (this.currentCart && this.currentCart.items) || [];

    if (items.length === 0) {
      AppState.selectedCartRowIdx = 0;
      var emptyTxt =
        AppState.lang === 'fr'
          ? 'Panier vide — Scannez un code-barres (F5) ou recherchez (F4)'
          : AppState.lang === 'en'
            ? 'Cart is empty — Scan barcode (F5) or search (F4)'
            : 'السلة فارغة — امسح الباركود (F5) أو ابحث بالاسم (F4)';
      container.innerHTML =
        '<div class="h-full flex flex-col items-center justify-center text-slate-400 py-8">' +
        '<span class="material-symbols-rounded icon-xl mb-2 opacity-40">shopping_basket</span>' +
        '<div class="text-xs font-bold">' + emptyTxt + '</div>' +
        '<div class="text-[10px] text-slate-400 mt-1 font-mono">[F5] الباركود | [F4] البحث | [F12] السعر | [Échap] طباعة 80mm فورية | [Ctrl+Space] حفظ فقط</div>' +
        '</div>';
      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
      return;
    }

    if (AppState.selectedCartRowIdx >= items.length || AppState.selectedCartRowIdx < 0) {
      AppState.selectedCartRowIdx = items.length - 1;
    }

    container.innerHTML = items
      .map(function (item, idx) {
        var prod = AppState.products.find(function (p) {
          return Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name;
        });
        if (prod && !item.product_id) item.product_id = prod.id;
        var cost = Number(item.cost_price || (prod && prod.cost_price) || 0);
        var isBelowCost = cost > 0 && Number(item.price) < cost;
        var isSelected = idx === AppState.selectedCartRowIdx;

        return (
          '<div onclick="AppState.selectedCartRowIdx=' + idx + ';" class="p-2 rounded-xl border ' +
          (isBelowCost
            ? 'border-amber-500 bg-amber-500/10 '
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 ') +
          (isSelected ? 'cart-row-selected ' : '') +
          'flex items-center justify-between gap-1.5 shadow-sm transition">' +
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
              '); App.focusBarcodeMagnet(false);" class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 font-sans font-bold hover:bg-indigo-600 hover:text-white transition">' +
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
          '<button type="button" title="إنقاص الكمية (-)" onclick="AppState.selectedCartRowIdx=' +
          idx +
          '; App.stepCartItemQty(' +
          idx +
          ', -1); App.focusBarcodeMagnet(false);" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white font-mono font-black text-xs">-</button>' +
          '<input id="cartItemQtyInput-' +
          idx +
          '" type="number" step="any" value="' +
          item.quantity +
          '" onkeydown="App.onCartQtyInputKeydown(event, ' +
          idx +
          ', this)" onchange="App.updateCartItemQty(' +
          idx +
          ', this.value); App.focusBarcodeMagnet(false);" title="الكمية (اضغط Enter للتأكيد)" class="w-11 px-1 py-1 rounded-lg text-center font-mono font-black text-xs">' +
          '<button type="button" title="زيادة الكمية (+)" onclick="AppState.selectedCartRowIdx=' +
          idx +
          '; App.stepCartItemQty(' +
          idx +
          ', 1); App.focusBarcodeMagnet(false);" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white font-mono font-black text-xs">+</button>' +
          '</div>' +
          '<input id="cartItemPriceInput-' +
          idx +
          '" type="number" step="any" value="' +
          Number(item.price || 0).toFixed(2) +
          '" onkeydown="App.onCartPriceInputKeydown(event, ' +
          idx +
          ', this)" onchange="App.updateCartItemPrice(' +
          idx +
          ', this.value); App.focusBarcodeMagnet(false);" title="سعر الوحدة (اختصار التعديل اليدوي: F12 ثم Enter)" class="cart-price-input w-16 px-1 py-1 rounded-lg text-center font-mono font-bold text-xs text-blue-600 dark:text-blue-400">' +
          '<div class="w-14 text-left font-mono font-black text-xs">' +
          Number(item.subtotal || 0).toFixed(2) +
          '</div>' +
          '<button type="button" title="حذف الصنف" onclick="App.removeCartItem(' +
          idx +
          '); App.focusBarcodeMagnet(false);" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
          '</div>'
        );
      })
      .join('');

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
  };

  // عند إضافة منتج للسلة، نجعل السطر المضاف هو المحدد حالياً ونعيد المؤشر للباركود فوراً
  var _prevAddProdToCart = App.addProductToCart.bind(App);
  App.addProductToCart = function (productId, qty, options) {
    var res = _prevAddProdToCart(productId, qty, options);
    var items = (this.currentCart && this.currentCart.items) || [];
    if (items.length > 0) {
      var foundIdx = items.findIndex(function (it) {
        return Number(it.product_id || it.productId) === Number(productId);
      });
      AppState.selectedCartRowIdx = foundIdx !== -1 ? foundIdx : items.length - 1;
      this.renderCartItems();
    }
    this.focusBarcodeMagnet(false);
    return res;
  };

  // --------------------------------------------------------------------------
  // 3. البيع والتأكيد الفوري المباشر:
  //    - Escape (Échap) -> حفظ الفاتورة + طباعة تذكرة حرارية 80mm مباشرة وبصمت بدون أي نافذة
  //    - Ctrl + Space   -> حفظ الفاتورة فقط بدون أي طباعة
  // --------------------------------------------------------------------------
  App.instantConfirmAndCheckout = async function (mode) {
    // mode: 'thermal80_silent' | 'save_only'
    if (AppState._isSubmittingInstantSale) return;
    var cart = this.currentCart;
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      if (typeof showToast === 'function') {
        showToast('السلة فارغة — امسح باركود منتج أولاً!', 'warning');
      }
      this.focusBarcodeMagnet(false);
      return;
    }

    AppState._isSubmittingInstantSale = true;
    try {
      var totals = this.recalcCart();
      var customerId = cart.customerId ? Number(cart.customerId) : null;
      var payload = {
        editSaleId: AppState.editingSaleId || null,
        customer_id: customerId,
        subtotal: totals.subtotal,
        tax_percentage: totals.taxPercentage || 0,
        discount: totals.discount || 0,
        stamp_amount: totals.stampAmount || 0,
        total: totals.total,
        paid_amount: totals.total,
        payment_method: 'cash',
        due_date: null,
        user_id: AppState.currentUser ? AppState.currentUser.id : 1,
        session_id: AppState.activeSession ? AppState.activeSession.id : null,
        items: cart.items.map(function (it) {
          return {
            product_id: it.product_id || it.productId || null,
            batch_id: it.batch_id || it.batchId || null,
            variant_id: it.variant_id || it.variantId || null,
            custom_product_name: it.custom_product_name || it.name,
            quantity: Number(it.quantity || 1),
            price: Number(it.price || 0),
            cost_price: Number(it.cost_price || 0),
            subtotal: Number(it.subtotal || 0),
            serial_number: it.serial_number || null,
            warranty_months: Number(it.warranty_months || 0)
          };
        })
      };

      var saved = await window.api.processSale(payload);
      var saleId = saved && (saved.id || saved.saleId);
      var docNum = (saved && saved.doc_number) || ('#' + saleId);

      // فتح درج النقود تلقائياً عند البيع النقدي
      if (
        String(AppState.settings.open_drawer_on_cash_sale) !== 'false' &&
        window.api &&
        typeof window.api.openCashDrawer === 'function'
      ) {
        window.api.openCashDrawer().catch(function () {});
      }

      if (mode === 'thermal80_silent' && saleId && window.PrintEngine) {
        var fullSale = (await window.api.getSaleDetails(saleId).catch(function () { return null; })) || {
          ...payload,
          id: saleId,
          doc_number: docNum,
          sale_date: new Date().toISOString()
        };
        var receiptHtml = await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings, {
          lang: AppState.settings.receipt_lang || AppState.lang || 'ar',
          template: AppState.settings.receipt_template || 'receipt1'
        });

        // طباعة صامتة مباشرة على طابعة التذاكر الحرارية 80mm دون فتح مربع حوار
        if (window.api && typeof window.api.printSilent === 'function') {
          var printRes = await window.api.printSilent({
            html: receiptHtml,
            silent: true,
            printerName: AppState.settings.thermal_printer_name || undefined
          });
          if (!printRes || !printRes.success) {
            await window.PrintEngine.printHtmlDocument(receiptHtml, { silent: true });
          }
        } else {
          await window.PrintEngine.printHtmlDocument(receiptHtml, { silent: true });
        }
        if (typeof showToast === 'function') {
          showToast('🖨️ تم تأكيد الفاتورة (' + docNum + ') وطباعة تذكرة 80mm مباشرة!', 'success');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('💾 تم حفظ الفاتورة (' + docNum + ') بنجاح بدون طباعة!', 'success');
        }
      }

      AppState.editingSaleId = null;
      var editBanner = document.getElementById('posEditSaleBanner');
      if (editBanner) editBanner.classList.add('hidden');

      this.clearCurrentCart();
      await this.refreshProducts();
      this.focusBarcodeMagnet(true);
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('تعذر إتمام الفاتورة السريعة: ' + (err.message || err), 'error');
      }
    } finally {
      AppState._isSubmittingInstantSale = false;
    }
  };

  // --------------------------------------------------------------------------
  // 4. اختصار F4 للبحث السريع + إضافة أول منتج مطابق عند ضغط Enter في البحث
  // --------------------------------------------------------------------------
  function setupSearchInputEnterToAdd() {
    var searchInp = document.getElementById('globalPosSearch');
    if (!searchInp || searchInp.dataset.turboBound === '1') return;
    searchInp.dataset.turboBound = '1';

    searchInp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var q = String(searchInp.value || '').trim().toLowerCase();
        if (q) {
          var matches = (AppState.products || []).filter(function (p) {
            return (
              !p.hide_from_pos &&
              (String(p.name || '').toLowerCase().includes(q) ||
                String(p.barcode || '').toLowerCase().includes(q) ||
                String(p.plu_code || '').toLowerCase() === q)
            );
          });
          if (matches.length > 0) {
            App.addProductToCart(matches[0].id, 1);
            searchInp.value = '';
            App.onPosSearchInput('');
            if (typeof showToast === 'function') {
              showToast('➕ تمت إضافة "' + matches[0].name + '" من البحث وعاد المؤشر للباركود', 'info');
            }
          }
        }
        App.focusBarcodeMagnet(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        searchInp.value = '';
        App.onPosSearchInput('');
        App.focusBarcodeMagnet(false);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. بناء شريط الإرشاد السريع وأزرار البيع الفوري (Échap / Ctrl+Space) في الواجهة
  // --------------------------------------------------------------------------
  function injectTurboPosControls() {
    // شارة حالة المغناطيس بجانب حقل الباركود
    var bcWrap = document.getElementById('barcodeInput') ? document.getElementById('barcodeInput').parentElement : null;
    if (bcWrap && !document.getElementById('barcodeMagnetStatusPill')) {
      bcWrap.classList.add('flex', 'items-center', 'gap-1.5');
      bcWrap.style.width = '290px';
      bcWrap.insertAdjacentHTML(
        'beforeend',
        '<span id="barcodeMagnetStatusPill" onclick="App.focusBarcodeMagnet(false)" class="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black whitespace-nowrap">🟢 جاهز للمسح (F5)</span>'
      );
    }

    // أزرار التنفيذ المباشر (تذكرة 80mm فورية بـ Échap + حفظ بدون طباعة بـ Ctrl+Space) في أسفل السلة
    var mainPayBtn = document.querySelector('#posCartContainer button[onclick*="openCheckoutModal"]');
    if (mainPayBtn && !document.getElementById('turboInstantActionButtons')) {
      var barHtml =
        '<div id="turboInstantActionButtons" class="grid grid-cols-2 gap-1.5 pt-0.5">' +
        '<button type="button" onclick="App.instantConfirmAndCheckout(\'thermal80_silent\')" title="تأكيد الفاتورة وطباعة تذكرة 80mm مباشرة بدون نافذة (اختصار: Échap)" class="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm">' +
        '<span>🖨️ تذكرة 80mm فورية (Échap)</span>' +
        '</button>' +
        '<button type="button" onclick="App.instantConfirmAndCheckout(\'save_only\')" title="حفظ الفاتورة وتأكيدها مباشرة بدون طباعة (اختصار: Ctrl + Space)" class="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm">' +
        '<span>💾 حفظ بدون طباعة (Ctrl+Space)</span>' +
        '</button>' +
        '</div>';
      mainPayBtn.insertAdjacentHTML('beforebegin', barHtml);
    }
  }

  // --------------------------------------------------------------------------
  // 6. الموجه المركزي لاختصارات الكاشير الخارقة (F5, F4, F12, +, -, Escape, Ctrl+Space)
  // --------------------------------------------------------------------------
  document.addEventListener(
    'keydown',
    function (e) {
      if (!isPosViewActive()) return;

      var activeModal = getActiveModalElement();
      var activeEl = document.activeElement;
      var activeId = activeEl ? activeEl.id : '';
      var isBarcodeFocused = activeId === 'barcodeInput';
      var barcodeVal = isBarcodeFocused ? String(activeEl.value || '') : '';

      // 1) F5 -> العودة الفورية لخانة الباركود دائماً (ومنع إعادة تحميل المتصفح)
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        if (activeModal) App.closeModal(activeModal.id);
        App.focusBarcodeMagnet(true);
        if (typeof showToast === 'function') showToast('🎯 المؤشر جاهز في خانة مسح الباركود (F5)', 'info');
        return;
      }

      // 2) F4 -> الذهاب الفوري لخانة البحث بالاسم والباركود (#globalPosSearch)
      if (e.key === 'F4' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        var sInp = document.getElementById('globalPosSearch');
        if (sInp) {
          sInp.focus();
          sInp.select();
        }
        return;
      }

      // Shift + F4 -> إفراغ السلة الحالية
      if (e.key === 'F4' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        App.clearCurrentCart();
        App.focusBarcodeMagnet(true);
        return;
      }

      // 3) F12 -> الذهاب الفوري إلى خانة السعر في السلة لتعديله يدوياً
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        App.focusCartItemPriceInput();
        return;
      }

      // 4) Ctrl + Space (Ctrl + Espace) -> حفظ الفاتورة وتأكيدها مباشرة بدون طباعة
      if (e.ctrlKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        e.stopPropagation();
        if (activeModal && activeModal.id === 'checkoutModal') {
          App.submitSale('none');
        } else {
          App.instantConfirmAndCheckout('save_only');
        }
        return;
      }

      // 5) Escape (Échap) -> طباعة تذكرة 80mm وتأكيد الفاتورة مباشرة بدون أي ضغطة إضافية
      if (e.key === 'Escape') {
        // إذا كان البائع داخل حقل السعر أو البحث، يعيده Escape للباركود أولاً
        if (activeEl && (activeEl.classList.contains('cart-price-input') || activeId === 'globalPosSearch')) {
          return;
        }
        // إذا كانت هناك نافذة منبثقة غير نافذة الدفع مفتوحة، نغلقها ونعيد المؤشر للباركود
        if (activeModal && activeModal.id !== 'checkoutModal') {
          e.preventDefault();
          App.closeModal(activeModal.id);
          App.focusBarcodeMagnet(false);
          return;
        }
        // إذا كانت نافذة الدفع مفتوحة أو كنا في شاشة الكاشير المباشرة وفيها سلة غير فارغة -> طباعة تذكرة 80mm فورية!
        if (App.currentCart && Array.isArray(App.currentCart.items) && App.currentCart.items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (activeModal && activeModal.id === 'checkoutModal') {
            App.closeModal('checkoutModal');
          }
          App.instantConfirmAndCheckout('thermal80_silent');
          return;
        }
      }

      // 6) التحكم بـ (+ و -) في كمية المنتج مباشرة عندما يكون المؤشر في خانة الباركود الفارغة
      if (!activeModal && isBarcodeFocused && barcodeVal === '') {
        var items = (App.currentCart && App.currentCart.items) || [];
        if (items.length > 0) {
          var targetIdx = items[AppState.selectedCartRowIdx] ? AppState.selectedCartRowIdx : items.length - 1;
          if (e.key === '+' || e.code === 'NumpadAdd') {
            e.preventDefault();
            App.stepCartItemQty(targetIdx, 1);
            App.focusBarcodeMagnet(false);
            return;
          }
          if (e.key === '-' || e.code === 'NumpadSubtract') {
            e.preventDefault();
            App.stepCartItemQty(targetIdx, -1);
            App.focusBarcodeMagnet(false);
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            AppState.selectedCartRowIdx = Math.max(0, targetIdx - 1);
            App.renderCartItems();
            App.focusBarcodeMagnet(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            AppState.selectedCartRowIdx = Math.min(items.length - 1, targetIdx + 1);
            App.renderCartItems();
            App.focusBarcodeMagnet(false);
            return;
          }
        }
      }
    },
    true
  );

  // تحديث دليل الاختصارات (#shortcutsHelpModal) ليعكس تعليماتك الجديدة بدقة
  function updateShortcutsHelpModalContent() {
    var modalBody = document.querySelector('#shortcutsHelpModal .space-y-2.text-xs');
    if (!modalBody) return;
    modalBody.innerHTML =
      '<div class="flex justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-bold"><span>تأكيد الفاتورة وطباعة تذكرة 80mm مباشرة</span><kbd class="px-2 py-0.5 bg-emerald-600 text-white rounded font-mono">Échap (Esc)</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 font-bold"><span>حفظ الفاتورة وتأكيدها مباشرة بدون طباعة</span><kbd class="px-2 py-0.5 bg-blue-600 text-white rounded font-mono">Ctrl + Space</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>الرجوع الفوري لخانة مسح الباركود</span><kbd class="px-2 py-0.5 bg-emerald-600 text-white rounded font-mono">F5</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>الذهاب الفوري لخانة البحث بالاسم والباركود</span><kbd class="px-2 py-0.5 bg-blue-600 text-white rounded font-mono">F4</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>تعديل سعر المنتج يدوياً في السلة (ثم Enter)</span><kbd class="px-2 py-0.5 bg-amber-500 text-slate-950 rounded font-mono font-black">F12</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>زيادة أو إنقاص كمية المنتج في السلة</span><kbd class="px-2 py-0.5 bg-indigo-600 text-white rounded font-mono">+ / -</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>فتح نافذة التسديد المفصلة (آجل / تقسيط / شيك)</span><kbd class="px-2 py-0.5 bg-blue-600 text-white rounded font-mono">F1</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>تعليق الفاتورة (F2) / المسودات (F3) / منتج حر (F8)</span><kbd class="px-2 py-0.5 bg-slate-700 text-white rounded font-mono">F2 / F3 / F8</kbd></div>';
  }

  function initAllTurboFeatures() {
    injectTurboPosControls();
    setupSearchInputEnterToAdd();
    installBarcodeAutoFocusGuard();
    updateShortcutsHelpModalContent();
    App.renderCartItems();
    App.focusBarcodeMagnet(false);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initAllTurboFeatures, 550);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initAllTurboFeatures, 550);
    });
  }
})();
`;

  const finalRc = rc.trimEnd() + '\n\n' + turboEngineCode.trim() + '\n';

  // فحص القواعد النحوية بـ vm.Script قبل الحفظ لضمان 0 أخطاء
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 3/3: تم حقن وفحص محرك الكاشير التوربيني في renderer-rc-100.js بنجاح (0 أخطاء نحوية)!');
}

// تنظيف ونقل أي سكربت مؤقت سابق إلى الأرشيف الأب
const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['show-qa-btn.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 اكتملت الترقية بنجاح 100%! شغّل أو حدّث البرنامج الآن عبر Ctrl+R أو npm run dev');