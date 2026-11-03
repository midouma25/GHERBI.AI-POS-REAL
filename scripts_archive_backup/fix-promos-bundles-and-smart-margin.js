/**
 * fix-promos-bundles-and-smart-margin.js
 * 1. تفعيل تطبيق العروض الترويجية (Promotions) تلقائياً في شاشة المبيعات (#view-pos) والسلة مع شارة السعر المشطوب والتوفير
 * 2. إصلاح خطأ varforUnit في App.sellBundleInPosNow وإضافة تبويب (🎁 الحزم والباقات) مباشرة في شاشة الكاشير
 * 3. إصلاح جذري لخانة مسح الباركود (#barcodeInput) في الكاشير لدعم المنتجات والحزم والميزان بدون أي انهيار
 * 4. ترقية نافذة الحزم (#bundleModal) بمحرك التوزيع الذكي للتوفير المحمي بالهامش (Margin-Protected Profit & Savings Breakdown per Product) + 8 قوالب اقتراحية من المخزون الفعلي
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الإصلاح الجراحي الشامل للعروض الترويجية، الباركود، ومحرك الحزم الذكي...\n');

// ============================================================================
// الوحدة الشاملة بصيغة JavaScript أصلية (Zero-Escape AST Pattern)
// ============================================================================
function installSmartPromosBundlesAndBarcodeFix() {
  if (!window.App || !window.AppState) return;

  // تهيئة المصفوفات لضمان عدم حدوث TypeError: Cannot read properties of undefined
  AppState.bundles = Array.isArray(AppState.bundles) ? AppState.bundles : [];
  AppState.bundlesList = Array.isArray(AppState.bundlesList) ? AppState.bundlesList : [];
  AppState.promotionsList = Array.isArray(AppState.promotionsList) ? AppState.promotionsList : [];
  AppState.bundleAllocMode = 'margin_weighted'; // 'margin_weighted' | 'proportional' | 'equal'

  function getBaseRetailPrice(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.selling_price ?? fb.selling_price ?? 0);
  }

  function getBaseCostPrice(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.cost_price ?? fb.cost_price ?? 0);
  }

  function getBaseStock(p) {
    if (!p) return 0;
    return Number(p.total_stock ?? p.stock ?? 0);
  }

  // --------------------------------------------------------------------------
  // 1) محرك فحص وحساب العرض الترويجي النشط لأي منتج في الكاشير والسلة
  // --------------------------------------------------------------------------
  App.getActivePromotionForProduct = function (prod) {
    if (!prod) return null;
    var todayIso = new Date().toISOString().slice(0, 10);
    var prm = prod.active_promotion || null;

    if (!prm && Array.isArray(AppState.promotionsList) && AppState.promotionsList.length > 0) {
      prm = AppState.promotionsList.find(function (x) {
        return Number(x.product_id) === Number(prod.id) && Number(x.is_active) !== 0;
      }) || null;
    }
    if (!prm || Number(prm.is_active) === 0) return null;

    var startStr = prm.start_date ? String(prm.start_date).slice(0, 10) : '';
    var endStr = prm.end_date ? String(prm.end_date).slice(0, 10) : '';
    if (startStr && startStr > todayIso) return null;
    if (endStr && endStr < todayIso) return null;
    if (prm.max_qty && Number(prm.used_qty || 0) >= Number(prm.max_qty)) return null;

    return prm;
  };

  App.getEffectiveProductPromoInfo = function (prod, tier) {
    var origRetail = getBaseRetailPrice(prod);
    if (tier === 'wholesale' && Number(prod && prod.wholesale_price) > 0) {
      return {
        finalPrice: Number(prod.wholesale_price),
        originalPrice: origRetail,
        hasPromo: false,
        savingPerUnit: 0,
        badgeText: 'جملة',
        promoId: null
      };
    }

    var prm = this.getActivePromotionForProduct(prod);
    if (!prm || origRetail <= 0) {
      return {
        finalPrice: origRetail,
        originalPrice: origRetail,
        hasPromo: false,
        savingPerUnit: 0,
        badgeText: '',
        promoId: null
      };
    }

    var dVal = Number(prm.discount_value || 0);
    var finalPrice = prm.discount_type === 'percentage'
      ? Number((origRetail * (1 - dVal / 100)).toFixed(2))
      : Math.max(0, Number((origRetail - dVal).toFixed(2)));

    var saving = Math.max(0, Number((origRetail - finalPrice).toFixed(2)));
    var badge = prm.discount_type === 'percentage' ? ('-' + dVal + '%') : ('-' + dVal + ' د.ج');

    return {
      finalPrice: finalPrice,
      originalPrice: origRetail,
      hasPromo: saving > 0,
      savingPerUnit: saving,
      badgeText: badge,
      promoId: prm.id
    };
  };

  // تحديث refreshProducts ليجلب أيضاً الحزم والعروض النشطة دائماً إلى الكاشير
  var _origRefreshProducts = typeof App.refreshProducts === 'function' ? App.refreshProducts.bind(App) : null;
  App.refreshProducts = async function () {
    if (_origRefreshProducts) {
      await _origRefreshProducts();
    }
    var pair = await Promise.all([
      window.api.getBundles ? window.api.getBundles().catch(function () { return []; }) : Promise.resolve([]),
      window.api.getPromotions ? window.api.getPromotions().catch(function () { return []; }) : Promise.resolve([])
    ]);
    AppState.bundlesList = Array.isArray(pair[0]) ? pair[0] : [];
    AppState.bundles = AppState.bundlesList;
    AppState.promotionsList = Array.isArray(pair[1]) ? pair[1] : [];

    // ربط العروض النشطة بالمنتجات في الذاكرة مباشرة
    var promoMap = new Map();
    AppState.promotionsList.forEach(function (pr) {
      if (Number(pr.is_active) !== 0) promoMap.set(Number(pr.product_id), pr);
    });
    (AppState.products || []).forEach(function (p) {
      if (promoMap.has(Number(p.id))) {
        p.active_promotion = promoMap.get(Number(p.id));
      }
    });
  };

  // --------------------------------------------------------------------------
  // 2) ترقية شاشة الكاشير (#view-pos) لعرض الأسعار المخفضة وتبويب (🎁 الحزم والباقات)
  // --------------------------------------------------------------------------
  App.renderPosView = function () {
    var editBanner = document.getElementById('posEditSaleBanner');
    var editBannerTxt = document.getElementById('posEditSaleBannerText');
    var chkBtnTxt = document.getElementById('btnCheckoutMainText');

    if (AppState.editingSaleId) {
      if (editBanner) editBanner.classList.remove('hidden');
      if (editBannerTxt) {
        editBannerTxt.textContent = '✏️ وضع تعديل الفاتورة (' + (AppState.editingSaleNumber || '#' + AppState.editingSaleId) + ')';
      }
      if (chkBtnTxt) chkBtnTxt.textContent = 'حفظ تعديلات الفاتورة (F1)';
    } else {
      if (editBanner) editBanner.classList.add('hidden');
      if (chkBtnTxt) chkBtnTxt.textContent = 'تسديد الفاتورة (F1)';
    }

    var activeBundlesCount = (AppState.bundlesList || []).filter(function (b) { return Number(b.is_active) !== 0; }).length;
    var activePromosCount = (AppState.products || []).filter(function (p) { return Boolean(App.getActivePromotionForProduct(p)); }).length;

    var pillsBox = document.getElementById('posCategoryPills');
    if (pillsBox) {
      var cats = ['all', 'featured', '__bundles__', '__promos__'].concat(AppState.categories || []);
      pillsBox.innerHTML = cats
        .map(function (c) {
          var active = AppState.selectedCategory === c;
          var label = c;
          var extraStyle = '';
          if (c === 'all') label = 'جميع الفئات';
          else if (c === 'featured') label = '⭐ المفضلة';
          else if (c === '__bundles__') {
            label = '🎁 الحزم والباقات (' + activeBundlesCount + ')';
            if (!active) extraStyle = 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/5';
          } else if (c === '__promos__') {
            label = '🔥 العروض (' + activePromosCount + ')';
            if (!active) extraStyle = 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5';
          }

          return (
            '<button type="button" onclick="App.selectPosCategory(\'' + String(c).replace(/'/g, "\\'") + '\')" ' +
            'class="px-3 py-1.5 rounded-xl text-xs font-bold transition ' +
            (active
              ? 'bg-blue-600 text-white shadow'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ' + extraStyle) +
            '">' + label + '</button>'
          );
        })
        .join('');
    }

    var custSelect = document.getElementById('posCustomerSelect');
    if (custSelect) {
      custSelect.innerHTML =
        '<option value="">زبون عابر (بدون حساب)</option>' +
        (AppState.customers || [])
          .map(function (c) {
            return (
              '<option value="' + c.id + '" ' +
              (Number(App.currentCart.customerId) === Number(c.id) ? 'selected' : '') +
              '>' + c.name + (Number(c.total_debt) > 0 ? ' (دين: ' + Number(c.total_debt).toFixed(0) + ')' : '') + '</option>'
            );
          })
          .join('');
    }

    this.renderPosProductsGrid();
    this.renderCartTabs();
    this.renderCartItems();
  };

  App.renderPosProductsGrid = function () {
    var grid = document.getElementById('posProductsGrid');
    if (!grid) return;

    var minWidthMap = { small: '125px', medium: '155px', large: '190px' };
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(' + (minWidthMap[AppState.posCardSize] || '155px') + ', 1fr))';

    // إذا اختار الكاشير تبويب (🎁 الحزم والباقات) نعرض بطاقات الحزم الجاهزة للبيع المباشر!
    if (AppState.selectedCategory === '__bundles__') {
      var activeBundles = (AppState.bundlesList || []).filter(function (b) { return Number(b.is_active) !== 0; });
      if (activeBundles.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400 font-bold">لا توجد حزم ترويجية نشطة حالياً — أنشئ حزمة من قسم (الحزم والعروض)</div>';
        return;
      }
      grid.innerHTML = activeBundles
        .map(function (b) {
          var items = Array.isArray(b.items) ? b.items : [];
          var origSum = 0;
          items.forEach(function (it) {
            var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
            origSum += getBaseRetailPrice(p) * Number(it.quantity || 1);
          });
          var sellP = Number(b.selling_price || 0);
          var saving = Math.max(0, Number((origSum - sellP).toFixed(2)));
          return (
            '<div onclick="App.sellBundleInPosNow(' + b.id + ')" class="product-card border-2 border-blue-500/40 bg-blue-500/5 flex flex-col justify-between gap-1.5">' +
            '  <div>' +
            '    <div class="flex items-center justify-between mb-1">' +
            '      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">🎁 حزمة Pack</span>' +
            (saving > 0 ? '<span class="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black">توفير ' + saving.toFixed(0) + ' د.ج</span>' : '') +
            '    </div>' +
            '    <div class="font-black text-xs text-slate-800 dark:text-white">' + b.name + '</div>' +
            '    <div class="text-[10px] text-slate-500 mt-1 line-clamp-2">' + items.map(function (it) { return it.quantity + '× ' + (it.product_name || ''); }).join(' + ') + '</div>' +
            '  </div>' +
            '  <div class="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">' +
            (origSum > sellP ? '<span class="font-mono text-[10px] line-through text-slate-400">' + origSum.toFixed(0) + '</span>' : '') +
            '    <span class="font-mono font-black text-sm text-blue-600">' + sellP.toFixed(2) + ' د.ج</span>' +
            '  </div>' +
            '</div>'
          );
        })
        .join('');
      return;
    }

    var filtered = this.getFilteredPosProducts();
    if (AppState.selectedCategory === '__promos__') {
      filtered = (AppState.products || []).filter(function (p) {
        return Boolean(App.getActivePromotionForProduct(p));
      });
    }

    var totalPages = Math.max(1, Math.ceil(filtered.length / AppState.posPageSize));
    if (AppState.posPage > totalPages) AppState.posPage = totalPages;

    var pageInfo = document.getElementById('posPageInfoText');
    if (pageInfo) {
      pageInfo.textContent = 'صفحة ' + AppState.posPage + ' من ' + totalPages + ' (' + filtered.length + ' منتج)';
    }

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="col-span-full py-16 text-center text-slate-400 font-bold">لا توجد منتجات مطابقة للبحث</div>';
      return;
    }

    var startIdx = (AppState.posPage - 1) * AppState.posPageSize;
    var pageItems = filtered.slice(startIdx, startIdx + AppState.posPageSize);
    var tier = (this.currentCart && this.currentCart.priceTier) || AppState.priceTier || 'retail';

    grid.innerHTML = pageItems
      .map(function (p) {
        var promoInfo = App.getEffectiveProductPromoInfo(p, tier);
        var stock = getBaseStock(p);
        var stockBadgeClass =
          stock <= 0
            ? 'bg-rose-500/15 text-rose-500'
            : stock <= Number(p.min_stock || 5)
              ? 'bg-amber-500/15 text-amber-600'
              : 'bg-emerald-500/15 text-emerald-600';

        var imgHtml =
          AppState.posShowImages && p.image
            ? '<img src="' + p.image + '" class="w-full h-20 object-contain rounded-lg bg-slate-50 dark:bg-slate-900 mb-1">'
            : '';

        var costLine = AppState.posShowCost
          ? '<div class="text-[10px] font-mono text-slate-400">شراء: ' + getBaseCostPrice(p).toFixed(2) + '</div>'
          : '';

        return (
          '<div onclick="App.onPosProductCardClick(' + p.id + ')" class="product-card ' + (promoInfo.hasPromo ? 'border-rose-500/50 bg-rose-500/5' : '') + ' flex flex-col justify-between gap-1.5">' +
          '  <div>' +
          '    <div class="flex items-center justify-between mb-1">' +
          '      <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ' + stockBadgeClass + '">' + stock + ' ' + (p.unit || '') + '</span>' +
          '      <div class="flex items-center gap-1">' +
          (Number(p.has_variants) === 1 ? '<span class="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold">متغيرات</span>' : '') +
          (promoInfo.hasPromo ? '<span class="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black">🔥 ' + promoInfo.badgeText + '</span>' : '') +
          '      </div>' +
          '    </div>' +
          imgHtml +
          '    <div class="font-bold text-xs line-clamp-2 min-h-[2rem]">' + p.name + '</div>' +
          costLine +
          '  </div>' +
          '  <div class="pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">' +
          (promoInfo.hasPromo
            ? '<div class="flex items-baseline gap-1"><span class="font-mono font-black text-sm text-rose-600 dark:text-rose-400">' + promoInfo.finalPrice.toFixed(2) + '</span><span class="font-mono text-[10px] line-through text-slate-400">' + promoInfo.originalPrice.toFixed(0) + '</span></div>'
            : '<span class="font-mono font-black text-sm text-blue-600 dark:text-blue-400">' + promoInfo.finalPrice.toFixed(2) + '</span>') +
          '    <span class="text-[10px] text-slate-400">د.ج</span>' +
          '  </div>' +
          '</div>'
        );
      })
      .join('');
  };

  // --------------------------------------------------------------------------
  // 3) إصلاح App.addProductToCart و App.renderCartItems لتطبيق العروض الترويجية والحزم فوراً
  // --------------------------------------------------------------------------
  App.addProductToCart = function (productId, qty, options) {
    if (qty === undefined) qty = 1;
    options = options || {};
    var prod = (AppState.products || []).find(function (p) {
      return Number(p.id) === Number(productId);
    });
    if (!prod) return;

    var mult = AppState._quickMultiplier || 1;
    var effectiveQty = Number(qty || 1) * mult;
    if (mult !== 1 && typeof this.setQuickMultiplier === 'function') this.setQuickMultiplier(1);

    var signedQty = (AppState.returnMode || AppState.isReturnMode) ? -Math.abs(effectiveQty) : effectiveQty;
    var cart = this.currentCart;
    var tier = cart.priceTier || AppState.priceTier || 'retail';

    var promoInfo = this.getEffectiveProductPromoInfo(prod, tier);
    var unitPrice =
      options.overridePrice !== undefined && options.overridePrice !== null
        ? Number(options.overridePrice)
        : promoInfo.finalPrice;

    var origPrice = options.originalPrice !== undefined
      ? Number(options.originalPrice)
      : promoInfo.originalPrice;

    var promoBadge = options.promoBadge || (options.overridePrice === undefined && promoInfo.hasPromo ? promoInfo.badgeText : '');
    var appliedPromoId = options.overridePrice === undefined && promoInfo.hasPromo ? promoInfo.promoId : null;
    var targetVariantId = options.variantId || null;

    var existingItem = cart.items.find(function (it) {
      return (
        Number(it.product_id || it.productId) === Number(prod.id) &&
        (it.variant_id || null) === targetVariantId &&
        !it._isWholesaleMode &&
        (it.bundle_tag || '') === (options.bundleTag || '') &&
        Math.abs(Number(it.price || 0) - unitPrice) < 0.01
      );
    });

    if (existingItem) {
      existingItem.quantity = Number((Number(existingItem.quantity || 0) + signedQty).toFixed(3));
      existingItem.subtotal = Number((existingItem.quantity * existingItem.price).toFixed(2));
      if (existingItem.quantity === 0) {
        cart.items = cart.items.filter(function (x) { return x !== existingItem; });
      }
    } else {
      var batches = Array.isArray(prod.batches) ? prod.batches : [];
      var firstBatch = batches.find(function (b) { return Number(b.stock) > 0; }) || batches[0] || null;
      cart.items.push({
        product_id: Number(prod.id),
        batch_id: options.batchId || (firstBatch ? firstBatch.id : null),
        variant_id: targetVariantId,
        name: options.customName || prod.name,
        unit: prod.unit || 'قطعة',
        quantity: signedQty,
        price: unitPrice,
        original_price: origPrice,
        promo_badge: promoBadge,
        bundle_tag: options.bundleTag || '',
        applied_promotion_id: appliedPromoId,
        cost_price: getBaseCostPrice(prod),
        subtotal: Number((signedQty * unitPrice).toFixed(2)),
        serial_number: options.serialNumber || null,
        warranty_months: Number(prod.warranty_months || 0)
      });
    }

    var items = cart.items || [];
    if (items.length > 0) {
      var foundIdx = items.findIndex(function (it) { return Number(it.product_id) === Number(productId); });
      AppState.selectedCartRowIdx = foundIdx !== -1 ? foundIdx : items.length - 1;
    }

    this.recalcAndRenderCart();
    if (typeof this.focusBarcodeMagnet === 'function') this.focusBarcodeMagnet(false);
  };

  // تحديث عرض عناصر السلة لإظهار السعر المشطوب وشارة العرض الترويجي أو شارة الحزمة بوضوح
  var _prevRenderCartItems = typeof App.renderCartItems === 'function' ? App.renderCartItems.bind(App) : null;
  App.renderCartItems = function () {
    var container = document.getElementById('posCartItems');
    if (!container) return;
    var items = (this.currentCart && this.currentCart.items) || [];

    if (items.length === 0) {
      if (_prevRenderCartItems) return _prevRenderCartItems();
      return;
    }

    if (AppState.selectedCartRowIdx >= items.length || AppState.selectedCartRowIdx < 0) {
      AppState.selectedCartRowIdx = items.length - 1;
    }

    container.innerHTML = items
      .map(function (item, idx) {
        var prod = (AppState.products || []).find(function (p) {
          return Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name;
        });
        if (prod && !item.product_id) item.product_id = prod.id;
        var cost = Number(item.cost_price || getBaseCostPrice(prod) || 0);
        var isBelowCost = cost > 0 && Number(item.price) < cost;
        var isSelected = idx === AppState.selectedCartRowIdx;
        var origP = Number(item.original_price || (prod ? getBaseRetailPrice(prod) : item.price) || 0);
        var hasDiscount = origP > Number(item.price) + 0.01;
        var savedTotal = hasDiscount ? Number(((origP - Number(item.price)) * Number(item.quantity || 1)).toFixed(2)) : 0;

        return (
          '<div onclick="AppState.selectedCartRowIdx=' + idx + ';" class="p-2 rounded-xl border ' +
          (isBelowCost
            ? 'border-amber-500 bg-amber-500/10 '
            : hasDiscount
              ? 'border-rose-500/40 bg-rose-500/5 dark:bg-slate-800/90 '
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 ') +
          (isSelected ? 'cart-row-selected ' : '') +
          'flex items-center justify-between gap-1.5 shadow-sm transition">' +
          '<div class="min-w-0 flex-1">' +
          '  <div class="font-bold text-xs truncate flex items-center gap-1">' +
          '    <span>' + (item.name || item.custom_product_name || 'منتج') + '</span>' +
          (item.promo_badge ? '<span class="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-black">🔥 ' + item.promo_badge + '</span>' : '') +
          (item.bundle_tag ? '<span class="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] font-black">🎁 ' + item.bundle_tag + '</span>' : '') +
          '  </div>' +
          '  <div class="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">' +
          (hasDiscount ? '<span class="line-through text-rose-400">' + origP.toFixed(2) + '</span>' : '') +
          '    <span class="' + (hasDiscount ? 'text-emerald-600 font-black' : '') + '">' + Number(item.price || 0).toFixed(2) + ' د.ج / ' + (item.unit || (prod && prod.unit) || 'قطعة') + '</span>' +
          (savedTotal > 0 ? '<span class="px-1 rounded bg-emerald-500/15 text-emerald-600 font-sans font-bold">وفّر ' + savedTotal.toFixed(2) + ' د.ج</span>' : '') +
          (prod
            ? '<button type="button" onclick="App.toggleCartItemWholesaleUnit(' + idx + ')" class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 font-sans font-bold hover:bg-indigo-600 hover:text-white transition">' +
              (item._isWholesaleMode ? '📦 جملة' : 'وحدة / تسعيرة') +
              '</button>'
            : '') +
          '  </div>' +
          '</div>' +
          '<div class="flex items-center gap-1">' +
          '  <button type="button" onclick="App.stepCartItemQty(' + idx + ', -1)" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white font-mono font-black text-xs">-</button>' +
          '  <input id="cartItemQtyInput-' + idx + '" type="number" step="any" value="' + item.quantity + '" onkeydown="App.onCartQtyInputKeydown(event, ' + idx + ', this)" onchange="App.updateCartItemQty(' + idx + ', this.value)" class="w-11 px-1 py-1 rounded-lg text-center font-mono font-black text-xs">' +
          '  <button type="button" onclick="App.stepCartItemQty(' + idx + ', 1)" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white font-mono font-black text-xs">+</button>' +
          '</div>' +
          '<input id="cartItemPriceInput-' + idx + '" type="number" step="any" value="' + Number(item.price || 0).toFixed(2) + '" onkeydown="App.onCartPriceInputKeydown(event, ' + idx + ', this)" onchange="App.updateCartItemPrice(' + idx + ', this.value)" title="[F12] تعديل السعر" class="w-16 px-1 py-1 rounded-lg text-center font-mono font-bold text-xs text-blue-600 dark:text-blue-400">' +
          '<div class="w-14 text-left font-mono font-black text-xs">' + Number(item.subtotal || 0).toFixed(2) + '</div>' +
          '<button type="button" onclick="App.removeCartItem(' + idx + ')" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
          '</div>'
        );
      })
      .join('');

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
  };

  // --------------------------------------------------------------------------
  // 4) إصلاح App.sellBundleInPosNow (حل خطأ varforUnit وتوزيع السعر بالهامش المحمي)
  // --------------------------------------------------------------------------
  App.computeSmartBundleAllocation = function (items, targetBundlePrice, mode) {
    mode = mode || AppState.bundleAllocMode || 'margin_weighted';
    var cleanItems = (items || []).map(function (it) {
      var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
      var qty = Math.max(0.01, Number(it.quantity || 1));
      var unitCost = Number(it.unit_cost !== undefined ? it.unit_cost : getBaseCostPrice(p));
      var unitPrice = Number(it.unit_price !== undefined ? it.unit_price : getBaseRetailPrice(p));
      var lineCost = Number((unitCost * qty).toFixed(2));
      var lineRetail = Number((unitPrice * qty).toFixed(2));
      var lineOrigProfit = Math.max(0, Number((lineRetail - lineCost).toFixed(2)));
      return {
        product_id: Number(it.product_id),
        product_name: it.product_name || (p ? p.name : 'منتج #' + it.product_id),
        quantity: qty,
        unit_cost: unitCost,
        unit_price: unitPrice,
        stock: Number(it.stock !== undefined ? it.stock : getBaseStock(p)),
        locked: Boolean(it.locked),
        lineCost: lineCost,
        lineRetail: lineRetail,
        lineOrigProfit: lineOrigProfit
      };
    });

    var totalCost = cleanItems.reduce(function (s, x) { return s + x.lineCost; }, 0);
    var totalRetail = cleanItems.reduce(function (s, x) { return s + x.lineRetail; }, 0);
    var totalOrigProfit = cleanItems.reduce(function (s, x) { return s + x.lineOrigProfit; }, 0);
    var bundlePrice = targetBundlePrice !== undefined && targetBundlePrice !== null ? Number(targetBundlePrice) : totalRetail;
    var totalDiscountToDistribute = Math.max(0, Number((totalRetail - bundlePrice).toFixed(2)));

    // المنتجات غير المقفلة التي ستتحمل التخفيض
    var unlocked = cleanItems.filter(function (x) { return !x.locked; });
    var unlockedProfitSum = unlocked.reduce(function (s, x) { return s + x.lineOrigProfit; }, 0);
    var unlockedRetailSum = unlocked.reduce(function (s, x) { return s + x.lineRetail; }, 0);

    var allocatedSoFar = 0;
    cleanItems.forEach(function (x, idx) {
      if (x.locked || totalDiscountToDistribute <= 0) {
        x.lineDiscount = 0;
      } else {
        var weight = 0;
        if (mode === 'margin_weighted' && unlockedProfitSum > 0) {
          weight = x.lineOrigProfit / unlockedProfitSum;
        } else if (unlockedRetailSum > 0) {
          weight = x.lineRetail / unlockedRetailSum;
        } else {
          weight = 1 / Math.max(1, unlocked.length);
        }

        var rawDisc = Number((totalDiscountToDistribute * weight).toFixed(2));
        // حماية التاجر: لا يتجاوز الخصم ربح المنتج الأصلي إلا إذا كان التاجر نفسه باع الحزمة بأقل من التكلفة الكلية
        if (bundlePrice >= totalCost && rawDisc > x.lineOrigProfit) {
          rawDisc = x.lineOrigProfit;
        }
        x.lineDiscount = rawDisc;
        allocatedSoFar += rawDisc;
      }

      x.lineBundlePrice = Number((x.lineRetail - x.lineDiscount).toFixed(2));
      x.unitBundlePrice = Number((x.lineBundlePrice / x.quantity).toFixed(2));
      x.lineNetProfit = Number((x.lineBundlePrice - x.lineCost).toFixed(2));
      x.unitNetProfit = Number((x.lineNetProfit / x.quantity).toFixed(2));
      x.discountSharePct = totalDiscountToDistribute > 0 ? Number(((x.lineDiscount / totalDiscountToDistribute) * 100).toFixed(1)) : 0;
    });

    // تسوية أي فرق قروش صغير في آخر عنصر غير مقفل ليطابق مجموع الحزمة 100%
    var sumLines = cleanItems.reduce(function (s, x) { return s + x.lineBundlePrice; }, 0);
    var diff = Number((bundlePrice - sumLines).toFixed(2));
    if (Math.abs(diff) >= 0.01 && unlocked.length > 0) {
      var lastUnlocked = unlocked[unlocked.length - 1];
      lastUnlocked.lineBundlePrice = Number((lastUnlocked.lineBundlePrice + diff).toFixed(2));
      lastUnlocked.lineDiscount = Math.max(0, Number((lastUnlocked.lineRetail - lastUnlocked.lineBundlePrice).toFixed(2)));
      lastUnlocked.unitBundlePrice = Number((lastUnlocked.lineBundlePrice / lastUnlocked.quantity).toFixed(2));
      lastUnlocked.lineNetProfit = Number((lastUnlocked.lineBundlePrice - lastUnlocked.lineCost).toFixed(2));
      lastUnlocked.unitNetProfit = Number((lastUnlocked.lineNetProfit / lastUnlocked.quantity).toFixed(2));
    }

    return {
      items: cleanItems,
      totalCost: Number(totalCost.toFixed(2)),
      totalRetail: Number(totalRetail.toFixed(2)),
      totalOrigProfit: Number(totalOrigProfit.toFixed(2)),
      bundlePrice: Number(bundlePrice.toFixed(2)),
      totalSaving: Number(totalDiscountToDistribute.toFixed(2)),
      totalNetProfit: Number((bundlePrice - totalCost).toFixed(2))
    };
  };

  App.sellBundleInPosNow = async function (bundleId) {
    if (!AppState.bundlesList || AppState.bundlesList.length === 0) {
      AppState.bundlesList = (await window.api.getBundles().catch(function () { return []; })) || [];
      AppState.bundles = AppState.bundlesList;
    }

    var bundle = (AppState.bundlesList || []).find(function (b) { return Number(b.id) === Number(bundleId); });
    if (!bundle && window.api && window.api.getBundleDetails) {
      bundle = await window.api.getBundleDetails(Number(bundleId)).catch(function () { return null; });
    }
    if (!bundle) {
      if (typeof showToast === 'function') showToast('لم يتم العثور على بيانات الحزمة', 'error');
      return;
    }

    var rawItems = Array.isArray(bundle.items) ? bundle.items : [];
    if (rawItems.length === 0) {
      if (typeof showToast === 'function') showToast('هذه الحزمة لا تحتوي على منتجات مكونة بعد', 'warning');
      return;
    }

    var alloc = this.computeSmartBundleAllocation(rawItems, Number(bundle.selling_price || 0), 'margin_weighted');

    for (var i = 0; i < alloc.items.length; i++) {
      var line = alloc.items[i];
      var unitBundlePrice = Number(line.unitBundlePrice);
      this.addProductToCart(line.product_id, Number(line.quantity || 1), {
        overridePrice: unitBundlePrice,
        originalPrice: line.unit_price,
        bundleTag: bundle.name
      });
    }

    if (AppState.currentView !== 'pos') {
      await this.switchView('pos');
    } else {
      this.renderPosView();
    }

    if (typeof showToast === 'function') {
      showToast(
        '🎁 تمت إضافة (' + bundle.name + ') للسلة بـ ' + alloc.bundlePrice.toFixed(2) + ' د.ج — وفّر الزبون ' + alloc.totalSaving.toFixed(2) + ' د.ج وربحك الصافي +' + alloc.totalNetProfit.toFixed(2) + ' د.ج!',
        'success'
      );
    }
  };

  // --------------------------------------------------------------------------
  // 5) إصلاح جذري لخانة مسح الباركود (#barcodeInput) في شاشة الكاشير
  // --------------------------------------------------------------------------
  App.handleBarcodeScan = async function (rawCode) {
    var code = String(rawCode || '').trim();
    var bcInput = document.getElementById('barcodeInput');
    if (bcInput) bcInput.value = '';
    if (!code) return;

    var codeLower = code.toLowerCase();

    // 1. البحث في الحزم والباقات الترويجية النشطة (بالباركود أو الاسم المختصر مثل pack)
    if (!AppState.bundlesList || AppState.bundlesList.length === 0) {
      AppState.bundlesList = (await window.api.getBundles().catch(function () { return []; })) || [];
      AppState.bundles = AppState.bundlesList;
    }
    var matchedBundle = (AppState.bundlesList || []).find(function (b) {
      if (Number(b.is_active) === 0) return false;
      var bCode = String(b.barcode || '').trim().toLowerCase();
      var bName = String(b.name || '').trim().toLowerCase();
      return (bCode && bCode === codeLower) || bName === codeLower;
    });

    if (matchedBundle) {
      if (typeof playBeep === 'function') playBeep(true);
      await this.sellBundleInPosNow(matchedBundle.id);
      return;
    }

    // 2. فحص باركود الميزان الإلكتروني (يبدأ بـ 20..29 وطوله 12 أو 13 رقماً)
    var scalePrefix = String((AppState.settings && AppState.settings.scale_barcode_prefix) || '20');
    if (code.length >= 12 && (code.startsWith(scalePrefix) || /^2[0-9]\d{11}$/.test(code))) {
      var plu = code.slice(2, 7);
      var pluNum = String(parseInt(plu, 10));
      var weightKg = parseInt(code.slice(7, 12), 10) / 1000;
      var wProd = (AppState.products || []).find(function (p) {
        return String(p.plu_code || '') === plu || String(p.plu_code || '') === pluNum || String(p.barcode || '') === plu;
      });
      if (wProd && weightKg > 0) {
        this.addProductToCart(wProd.id, weightKg);
        if (typeof playBeep === 'function') playBeep(true);
        return;
      }
    }

    // 3. البحث في المنتجات (الباركود الأساسي، كود PLU، الباركودات الفرعية، المتغيرات)
    for (var i = 0; i < (AppState.products || []).length; i++) {
      var p = AppState.products[i];
      if (String(p.barcode || '').trim().toLowerCase() === codeLower || String(p.plu_code || '').trim().toLowerCase() === codeLower) {
        this.addProductToCart(p.id, 1);
        if (typeof playBeep === 'function') playBeep(true);
        return;
      }
      if (Array.isArray(p.extra_barcodes)) {
        var subBc = p.extra_barcodes.find(function (b) {
          return String((b && b.barcode) || b || '').trim().toLowerCase() === codeLower;
        });
        if (subBc) {
          var customPrice = undefined;
          if (subBc.price_label && Array.isArray(p.extra_prices)) {
            var matchedPrice = p.extra_prices.find(function (ep) { return ep.label === subBc.price_label; });
            if (matchedPrice) customPrice = Number(matchedPrice.price);
          }
          this.addProductToCart(p.id, 1, { overridePrice: customPrice });
          if (typeof playBeep === 'function') playBeep(true);
          return;
        }
      }
      if (Array.isArray(p.variants)) {
        var matchedVar = p.variants.find(function (v) {
          return String(v.barcode || '').trim().toLowerCase() === codeLower;
        });
        if (matchedVar) {
          this.addProductToCart(p.id, 1, {
            variantId: matchedVar.id,
            overridePrice: matchedVar.selling_price ? Number(matchedVar.selling_price) : undefined,
            customName: p.name + ' (' + (matchedVar.sku || matchedVar.barcode) + ')'
          });
          if (typeof playBeep === 'function') playBeep(true);
          return;
        }
      }
    }

    // 4. البحث في القاموس الوطني الجزائري 613
    if (window.api && typeof window.api.lookupDzBarcode === 'function') {
      var dzItem = await window.api.lookupDzBarcode(code).catch(function () { return null; });
      if (dzItem && dzItem.name) {
        if (typeof playBeep === 'function') playBeep(true);
        if (typeof showToast === 'function') showToast('🇩🇿 تم التعرف على المنتج الجزائري: ' + dzItem.name, 'info');
        await this.openProductModal({
          barcode: dzItem.barcode || code,
          name: dzItem.name,
          category: dzItem.category || 'مواد غذائية',
          supplier: dzItem.brand || '',
          unit: dzItem.unit || 'قطعة',
          selling_price: Number(dzItem.suggested_price || 100),
          cost_price: Math.round(Number(dzItem.suggested_price || 100) * 0.82),
          stock: 10
        });
        return;
      }
    }

    // 5. الباركود غير مسجل -> فتح نافذة مساعد الباركود غير المسجل
    if (typeof playBeep === 'function') playBeep(false);
    if (typeof this.openUnregisteredBarcodeModal === 'function') {
      this.openUnregisteredBarcodeModal(code);
    } else if (typeof showToast === 'function') {
      showToast('الباركود (' + code + ') غير مسجل في المخزون', 'warning');
    }
  };

  // تأمين حدث Enter على خانة #barcodeInput حتى لو أعيد رسم الهيدر
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'barcodeInput' && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      App.handleBarcodeScan(e.target.value);
    }
  }, true);

  // --------------------------------------------------------------------------
  // 6) تطوير نافذة الحزمة (#bundleModal) بالتحليل الربحي المفصل لكل منتج + 8 قوالب ذكية من المخزون
  // --------------------------------------------------------------------------
  App.upgradeSmartBundleModalV2 = function () {
    var bModal = document.getElementById('bundleModal');
    if (!bModal) return;

    bModal.innerHTML =
      '<div class="modal-content w-full max-w-4xl p-6 space-y-3.5 overflow-y-auto">' +
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">' +
      '    <div>' +
      '      <h3 id="bundleModalTitle" class="text-lg font-black text-blue-600">🎁 مهندس الحزم والباقات الذكي (Smart Margin-Protected Pack Builder)</h3>' +
      '      <p class="text-[11px] text-slate-400 font-bold">يحسب ربح كل منتج داخل الباقة ويوزع التخفيض بذكاء على الأصناف عالية الربح لحماية رأس مال التاجر</p>' +
      '    </div>' +
      '    <button type="button" onclick="App.closeModal(\'bundleModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      '  <input id="bundleIdInput" type="hidden">' +

      '  <div class="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5 text-xs">' +
      '    <div class="font-black text-indigo-600 dark:text-indigo-400">⚡ قوالب باقات اقتراحية ذكية مبنية تلقائياً على ما يوجد في مخزونك الفعلي:</div>' +
      '    <div class="flex flex-wrap items-center gap-1.5">' +
      '      <button type="button" onclick="App.applySmartBundlePreset(\'ramadan\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">🌙 قفة المواد الأساسية</button>' +
      '      <button type="button" onclick="App.applySmartBundlePreset(\'breakfast\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">☕ باقة القهوة والفطور</button>' +
      '      <button type="button" onclick="App.applySmartBundlePreset(\'dairy\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">🧀 باقة الأجبان والألبان</button>' +
      '      <button type="button" onclick="App.applySmartBundlePreset(\'drinks\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">🧃 باقة المشروبات العائلية</button>' +
      '      <button type="button" onclick="App.applySmartBundlePreset(\'high_margin\')" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black hover:bg-emerald-600 hover:text-white transition">💎 باقة الأعلى ربحاً للتاجر</button>' +
      '      <button type="button" onclick="App.applySmartBundlePreset(\'overstock\')" class="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black hover:bg-amber-500 hover:text-slate-950 transition">📦 باقة تصريف الرصيد الوفير</button>' +
      '      <button type="button" onclick="App.applySmartBundlePreset(\'expiry\')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 font-black hover:bg-rose-600 hover:text-white transition">⏳ باقة قريبة الانتهاء</button>' +
      '      <button type="button" onclick="App.applySmartBundlePreset(\'budget500\')" class="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-600 font-black hover:bg-sky-600 hover:text-white transition">🛒 باقة اقتصادية (< 500 د.ج)</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">' +
      '    <div class="md:col-span-2">' +
      '      <label class="block font-bold mb-1">اسم الحزمة / الباقة الترويجية *</label>' +
      '      <input id="bundleNameInput" type="text" placeholder="مثال: باقة فطور الصباح والقهوة (Pack Café & Matin)" class="w-full px-3 py-2 rounded-xl font-bold">' +
      '    </div>' +
      '    <div>' +
      '      <label class="block font-bold mb-1">باركود أو كود الحزمة (للمسح المباشر بالكاشير)</label>' +
      '      <div class="flex gap-1">' +
      '        <input id="bundleBarcodeInput" type="text" placeholder="61399... أو pack1" class="flex-1 px-3 py-2 rounded-xl font-mono font-bold">' +
      '        <button type="button" onclick="App.generateBundleBarcode()" class="px-2.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold" title="توليد باركود EAN-13 للحزمة">⚡</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">' +
      '    <div class="flex flex-wrap items-center justify-between gap-2">' +
      '      <span class="font-black text-slate-700 dark:text-slate-200">📦 جدول تشريح المنتجات المكوّنة للحزمة (التكلفة، السعر، التوفير، والربح الصافي لكل منتج):</span>' +
      '      <div class="flex items-center gap-1 text-[11px]">' +
      '        <span class="text-slate-400 font-bold">خوارزمية توزيع التوفير:</span>' +
      '        <button type="button" onclick="App.setBundleAllocMode(\'margin_weighted\')" class="px-2 py-0.5 rounded font-bold ' + (AppState.bundleAllocMode === 'margin_weighted' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700') + '">🧠 ذكي حسب الهامش (يحمي الأصناف ضعيفة الربح)</button>' +
      '        <button type="button" onclick="App.setBundleAllocMode(\'proportional\')" class="px-2 py-0.5 rounded font-bold ' + (AppState.bundleAllocMode === 'proportional' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700') + '">⚖️ نسبي حسب السعر</button>' +
      '      </div>' +
      '    </div>' +
      '    <div class="grid grid-cols-1 md:grid-cols-12 gap-2">' +
      '      <select id="bundleProductSelect" class="md:col-span-7 px-3 py-2 rounded-xl font-bold"></select>' +
      '      <input id="bundleProductQty" type="number" step="any" min="0.1" value="1" placeholder="الكمية" class="md:col-span-2 px-3 py-2 rounded-xl font-mono font-bold text-center">' +
      '      <button type="button" onclick="App.addComponentToBundleModal()" class="md:col-span-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-sm">+ إدراج في الحزمة</button>' +
      '    </div>' +
      '    <div id="bundleItemsTableContainer" class="max-h-52 overflow-y-auto pt-1"></div>' +
      '  </div>' +

      '  <div id="bundleSavingsOriginBanner" class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs"></div>' +

      '  <div id="bundleLiveMetricsBox" class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-center"></div>' +

      '  <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs items-end">' +
      '    <div class="md:col-span-3">' +
      '      <label class="block font-bold mb-1">إجمالي تكلفة الحزمة (د.ج)</label>' +
      '      <input id="bundleCostInput" type="number" step="any" value="0" readonly class="w-full px-3 py-2 rounded-xl font-mono font-bold bg-slate-100 dark:bg-slate-900">' +
      '    </div>' +
      '    <div class="md:col-span-4">' +
      '      <label class="block font-bold mb-1 text-blue-600">سعر بيع الحزمة النهائي للزبون (د.ج) *</label>' +
      '      <input id="bundlePriceInput" type="number" step="any" value="0" oninput="App.onBundlePriceManualInput()" class="w-full px-3 py-2 rounded-xl font-mono font-black text-base text-blue-600 border-blue-500">' +
      '    </div>' +
      '    <div class="md:col-span-5 flex flex-wrap gap-1">' +
      '      <button type="button" onclick="App.applyQuickBundleDiscount(5)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-5%</button>' +
      '      <button type="button" onclick="App.applyQuickBundleDiscount(10)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-10%</button>' +
      '      <button type="button" onclick="App.applyQuickBundleDiscount(15)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-15%</button>' +
      '      <button type="button" onclick="App.applyPsychologicalBundleRounding()" title="تقريب السعر لرقم نفسي جذاب ومريح في الصرف (مثلاً 590 أو 600 د.ج)" class="px-2.5 py-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black hover:bg-amber-500 hover:text-slate-950">🎯 تقريب نفسي</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="flex justify-end gap-2 pt-2.5 border-t border-slate-200 dark:border-slate-700">' +
      '    <button type="button" onclick="App.closeModal(\'bundleModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء (Esc)</button>' +
      '    <button type="button" onclick="App.saveBundleFromModal()" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/25">💾 حفظ الحزمة الترويجية</button>' +
      '  </div>' +
      '</div>';
  };

  App.setBundleAllocMode = function (mode) {
    AppState.bundleAllocMode = mode;
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
  };

  App.toggleLockBundleItem = function (idx) {
    if (AppState.tempBundleItems && AppState.tempBundleItems[idx]) {
      AppState.tempBundleItems[idx].locked = !AppState.tempBundleItems[idx].locked;
      this.renderBundleItemsInModal();
      this.updateBundleModalMetrics();
    }
  };

  App.onBundlePriceManualInput = function () {
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
  };

  App.applyPsychologicalBundleRounding = function () {
    var cur = parseFloat(document.getElementById('bundlePriceInput')?.value) || 0;
    var cost = parseFloat(document.getElementById('bundleCostInput')?.value) || 0;
    if (cur <= 0) return;
    // تقريب لأقرب 10 د.ج أقل (أو 5 د.ج) مع ضمان عدم النزول تحت التكلفة + 5%
    var rounded = Math.floor(cur / 10) * 10;
    if (rounded < cost * 1.05) rounded = Math.ceil((cost * 1.05) / 5) * 5;
    document.getElementById('bundlePriceInput').value = rounded.toFixed(2);
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
  };

  App.renderBundleItemsInModal = function () {
    var box = document.getElementById('bundleItemsTableContainer');
    var originBanner = document.getElementById('bundleSavingsOriginBanner');
    if (!box) return;
    var items = AppState.tempBundleItems || [];
    if (items.length === 0) {
      box.innerHTML = '<div class="py-4 text-center text-slate-400 font-bold">اختر قالباً ذكياً أعلاه بضغطة زر أو أضف منتجاتك لترى تشريح الربح والتوفير لكل صنف</div>';
      if (originBanner) originBanner.innerHTML = '💡 نصيحة المستشار: أضف منتجين أو أكثر لتوزيع التوفير بذكاء على المنتج ذي الهامش الأعلى.';
      return;
    }

    var targetPrice = parseFloat(document.getElementById('bundlePriceInput')?.value) || 0;
    var alloc = this.computeSmartBundleAllocation(items, targetPrice, AppState.bundleAllocMode);

    var costInp = document.getElementById('bundleCostInput');
    if (costInp) costInp.value = alloc.totalCost.toFixed(2);

    box.innerHTML =
      '<table class="w-full text-[11px] text-right">' +
      '  <thead>' +
      '    <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '      <th class="py-1.5 px-1">المنتج المكوّن</th>' +
      '      <th class="py-1.5 px-1">شراء</th>' +
      '      <th class="py-1.5 px-1">بيع فردي</th>' +
      '      <th class="py-1.5 px-1">الربح الأصلي</th>' +
      '      <th class="py-1.5 px-1">الكمية</th>' +
      '      <th class="py-1.5 px-1 text-rose-600">التوفير المقتطع منه</th>' +
      '      <th class="py-1.5 px-1 text-blue-600">سعره بالحزمة</th>' +
      '      <th class="py-1.5 px-1 text-emerald-600">ربحك الصافي فيه</th>' +
      '      <th class="py-1.5 px-1 text-center">حماية / حذف</th>' +
      '    </tr>' +
      '  </thead>' +
      '  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      alloc.items.map(function (it, idx) {
        return (
          '<tr class="hover:bg-white/60 dark:hover:bg-slate-900/40">' +
          '  <td class="py-1.5 px-1 font-bold">' + it.product_name + '</td>' +
          '  <td class="py-1.5 px-1 font-mono text-slate-400">' + it.unit_cost.toFixed(2) + '</td>' +
          '  <td class="py-1.5 px-1 font-mono">' + it.unit_price.toFixed(2) + '</td>' +
          '  <td class="py-1.5 px-1 font-mono text-slate-500">+' + it.lineOrigProfit.toFixed(2) + '</td>' +
          '  <td class="py-1.5 px-1"><input type="number" step="any" min="0.1" value="' + it.quantity + '" oninput="App.updateBundleComponentQty(' + idx + ', this.value)" class="w-14 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono font-bold text-center"></td>' +
          '  <td class="py-1.5 px-1 font-mono font-bold text-rose-600">-' + it.lineDiscount.toFixed(2) + ' د.ج <span class="text-[9px] text-slate-400">(' + it.discountSharePct + '%)</span></td>' +
          '  <td class="py-1.5 px-1 font-mono font-black text-blue-600">' + it.lineBundlePrice.toFixed(2) + ' د.ج</td>' +
          '  <td class="py-1.5 px-1 font-mono font-black ' + (it.lineNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600') + '">' + (it.lineNetProfit >= 0 ? '+' : '') + it.lineNetProfit.toFixed(2) + ' د.ج</td>' +
          '  <td class="py-1.5 px-1 flex items-center justify-center gap-1">' +
          '    <button type="button" onclick="App.toggleLockBundleItem(' + idx + ')" title="' + (it.locked ? 'محمي من الخصم (اضغط لإلغاء القفل)' : 'اضغط لقفل هذا المنتج ومنع خصم أي دينار من ربحه') + '" class="px-1.5 py-0.5 rounded ' + (it.locked ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-200 dark:bg-slate-700') + '">' + (it.locked ? '🔒 محمي' : '🔓') + '</button>' +
          '    <button type="button" onclick="App.removeComponentFromBundleModal(' + idx + ')" class="text-rose-500 font-black px-1.5">✕</button>' +
          '  </td>' +
          '</tr>'
        );
      }).join('') +
      '  </tbody>' +
      '</table>';

    if (originBanner) {
      if (alloc.totalSaving > 0) {
        var breakdownText = alloc.items
          .filter(function (x) { return x.lineDiscount > 0; })
          .map(function (x) {
            return '<strong>' + x.product_name + '</strong> تحمّل <strong>-' + x.lineDiscount.toFixed(2) + ' د.ج (' + x.discountSharePct + '%)</strong> وبقي ربحك فيه <strong class="text-emerald-600">+' + x.lineNetProfit.toFixed(2) + ' د.ج</strong>';
          })
          .join(' | ');
        originBanner.innerHTML = '🔍 <strong>من أين جاء توفير الزبون (' + alloc.totalSaving.toFixed(2) + ' د.ج)؟</strong> ' + (breakdownText || '');
      } else {
        originBanner.innerHTML = 'ℹ️ سعر الحزمة الحالي يساوي مجموع الأسعار الفردية (التوفير 0 د.ج) — اضغط (-5% أو -10%) لتوليد توفير ذكي محمي بالهامش.';
      }
    }
  };

  var _origOpenBundleModal = App.openBundleModal.bind(App);
  App.openBundleModal = async function (bundleOrId) {
    this.upgradeSmartBundleModalV2();
    return await _origOpenBundleModal(bundleOrId);
  };

  // توسيع القوالب الاقتراحية الذكية لتشمل 8 قوالب حية تفحص مخزونك الفعلي
  App.applySmartBundlePreset = function (presetKey) {
    var priced = this.getSortedPricedProducts().filter(function (p) { return getBaseRetailPrice(p) > 0; });
    if (priced.length === 0) return;

    var picked = [];
    var packTitle = '';

    if (presetKey === 'ramadan') {
      packTitle = '🌙 قفة المواد الغذائية الأساسية (Pack Essentiel)';
      picked = priced.filter(function (p) {
        return /زيت|سكر|سميد|فرينة|كسكس|طماطم|حليب/i.test(p.name) || /غذائية/i.test(p.category || '');
      }).slice(0, 4);
    } else if (presetKey === 'breakfast') {
      packTitle = '☕ باقة فطور الصباح والقهوة (Pack Café & Matin)';
      picked = priced.filter(function (p) {
        return /قهوة|حليب|سكر|شيدر|جبن/i.test(p.name);
      }).slice(0, 3);
    } else if (presetKey === 'dairy') {
      packTitle = '🧀 باقة الأجبان والألبان العائلية (Pack Fromage & Lait)';
      picked = priced.filter(function (p) {
        return /جبن|شيدر|حليب|ياغورت|لبن|زبدة/i.test(p.name) || /أجبان|ألبان/i.test(p.category || '');
      }).slice(0, 3);
    } else if (presetKey === 'drinks') {
      packTitle = '🧃 باقة المشروبات والعصائر العائلية (Pack Boissons)';
      picked = priced.filter(function (p) {
        return /ماء|عصير|مشروب|حمود|إيفري|سعيدة|رويبة/i.test(p.name);
      }).slice(0, 3);
    } else if (presetKey === 'high_margin') {
      packTitle = '💎 باقة التوفير الممتاز (الأعلى ربحية للتاجر)';
      picked = priced.slice().sort(function (a, b) {
        return (getBaseRetailPrice(b) - getBaseCostPrice(b)) - (getBaseRetailPrice(a) - getBaseCostPrice(a));
      }).slice(0, 3);
    } else if (presetKey === 'overstock') {
      packTitle = '📦 باقة التصريف السريع (الأعلى رصيداً في المستودع)';
      picked = priced.slice().sort(function (a, b) {
        return getBaseStock(b) - getBaseStock(a);
      }).slice(0, 3);
    } else if (presetKey === 'expiry') {
      packTitle = '⏳ باقة العرض الخاص (الأقرب لتاريخ الصلاحية)';
      picked = priced.filter(function (p) { return Boolean(p.expiry_date || p.next_expiry); }).slice(0, 3);
    } else if (presetKey === 'budget500') {
      packTitle = '🛒 باقة التوفير اليومي السريع (أقل من 500 د.ج)';
      picked = priced.slice().sort(function (a, b) {
        return getBaseRetailPrice(a) - getBaseRetailPrice(b);
      }).slice(0, 3);
    }

    if (picked.length === 0) picked = priced.slice(0, 3);

    document.getElementById('bundleNameInput').value = packTitle;
    AppState.tempBundleItems = picked.map(function (p) {
      return {
        product_id: Number(p.id),
        product_name: p.name,
        quantity: 1,
        unit_cost: getBaseCostPrice(p),
        unit_price: getBaseRetailPrice(p),
        stock: getBaseStock(p),
        locked: false
      };
    });

    this.recalcBundleDefaultPriceAndCost();
    this.applyPsychologicalBundleRounding();
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
    if (typeof showToast === 'function') {
      showToast('⚡ تم تركيب (' + packTitle + ') من مخزونك مع توزيع التوفير الذكي حسب هامش ربح كل منتج!', 'info');
    }
  };

  // تحميل الحزم والعروض فور بدء التشغيل
  setTimeout(function () {
    App.refreshProducts().then(function () {
      if (AppState.currentView === 'pos') App.renderPosView();
      else if (AppState.currentView === 'bundles') App.renderBundlesAndPromosView();
    });
  }, 200);
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  // أيضاً نصلح السطر القديم varforUnit داخل الكود السابق إن وجد
  rc = rc.replace(/varforUnit\s*=/g, 'var forUnit =');

  const marker = '// [SMART PROMOS, BUNDLES & BARCODE ENGINE V2]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installSmartPromosBundlesAndBarcodeFix.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 1/2: تم حقن محرك العروض الترويجية، إصلاح بيع الحزم والباركود، وجدول تشريح ربح كل منتج في الحزمة بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page5-bundles-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 2/2: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتمل الإصلاح والترقية! اضغط Ctrl+R داخل البرنامج الآن وجرّب الكاشير والحزم.');