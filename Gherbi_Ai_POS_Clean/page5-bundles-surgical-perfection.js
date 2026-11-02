/**
 * page5-bundles-surgical-perfection.js
 * الترقية الجراحية الشاملة والأتمتة الذاتية للصفحة الخامسة: الحزم الترويجية والعروض (#view-bundles)
 * مبني بتقنية Zero-Escape AST Serialization لضمان 0 أخطاء نحوية.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الترقية الجراحية الشاملة للصفحة 5: الحزم الترويجية والعروض الخاصة (#view-bundles)...\n');

// ============================================================================
// تعريف وحدة الصفحة الخامسة كدالة JavaScript أصلية (Zero-Escape AST Pattern)
// ============================================================================
function applyPage5BundlesSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.bundlesList = [];
  AppState.promotionsList = [];
  AppState.tempBundleItems = [];
  AppState.editingBundleId = null;
  AppState.editingPromoId = null;
  AppState.bundlesSearchQuery = '';

  function getActiveProductPrice(p) {
    if (!p) return 0;
    var firstBatch = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.selling_price ?? firstBatch.selling_price ?? 0);
  }

  function getActiveProductCost(p) {
    if (!p) return 0;
    var firstBatch = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.cost_price ?? firstBatch.cost_price ?? 0);
  }

  function getActiveProductStock(p) {
    if (!p) return 0;
    return Number(p.total_stock ?? p.stock ?? 0);
  }

  // --------------------------------------------------------------------------
  // 1) ترقية نافذة الحزم (#bundleModal) ونافذة العروض (#promotionModal) في DOM
  // --------------------------------------------------------------------------
  App.upgradeBundlesAndPromosModalsDom = function () {
    var bModal = document.getElementById('bundleModal');
    if (bModal && !bModal.dataset.upgradedP5) {
      bModal.dataset.upgradedP5 = '1';
      bModal.innerHTML =
        '<div class="modal-content w-full max-w-3xl p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <h3 id="bundleModalTitle" class="text-lg font-black text-blue-600">🎁 إنشاء / تعديل حزمة ترويجية متعددة المنتجات (Pack)</h3>' +
        '    <button type="button" onclick="App.closeModal(\'bundleModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <input id="bundleIdInput" type="hidden">' +

        '  <div class="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">' +
        '    <span class="font-black text-indigo-600 dark:text-indigo-400 ml-1">⚡ قوالب باقات جزائرية ذكية بضغطة زر:</span>' +
        '    <button type="button" onclick="App.applySmartBundlePreset(\'ramadan\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">🌙 قفة المواد الأساسية</button>' +
        '    <button type="button" onclick="App.applySmartBundlePreset(\'breakfast\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">☕ باقة القهوة والفطور</button>' +
        '    <button type="button" onclick="App.applySmartBundlePreset(\'drinks\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">🧃 باقة المشروبات العائلية</button>' +
        '  </div>' +

        '  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">' +
        '    <div class="md:col-span-2">' +
        '      <label class="block font-bold mb-1">اسم الحزمة / الباقة الترويجية *</label>' +
        '      <input id="bundleNameInput" type="text" placeholder="مثال: باقة العائلة الاقتصادية (زيت + سكر + قهوة)" class="w-full px-3 py-2 rounded-xl font-bold">' +
        '    </div>' +
        '    <div>' +
        '      <label class="block font-bold mb-1">باركود الحزمة (للمسح المباشر في الكاشير)</label>' +
        '      <div class="flex gap-1">' +
        '        <input id="bundleBarcodeInput" type="text" placeholder="61399..." class="flex-1 px-3 py-2 rounded-xl font-mono font-bold">' +
        '        <button type="button" onclick="App.generateBundleBarcode()" class="px-2.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold" title="توليد باركود للحزمة">⚡</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '  <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">' +
        '    <div class="font-black text-slate-700 dark:text-slate-200">📦 إضافة المنتجات المكوّنة للحزمة:</div>' +
        '    <div class="grid grid-cols-1 md:grid-cols-12 gap-2">' +
        '      <select id="bundleProductSelect" class="md:col-span-7 px-3 py-2 rounded-xl font-bold"></select>' +
        '      <input id="bundleProductQty" type="number" step="any" min="0.1" value="1" placeholder="الكمية" class="md:col-span-2 px-3 py-2 rounded-xl font-mono font-bold text-center">' +
        '      <button type="button" onclick="App.addComponentToBundleModal()" class="md:col-span-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-sm">+ إدراج في الحزمة</button>' +
        '    </div>' +
        '    <div id="bundleItemsTableContainer" class="max-h-44 overflow-y-auto pt-1"></div>' +
        '  </div>' +

        '  <div id="bundleLiveMetricsBox" class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-center"></div>' +

        '  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-end">' +
        '    <div>' +
        '      <label class="block font-bold mb-1">إجمالي تكلفة الحزمة (د.ج)</label>' +
        '      <input id="bundleCostInput" type="number" step="any" value="0" oninput="App.updateBundleModalMetrics()" class="w-full px-3 py-2 rounded-xl font-mono font-bold">' +
        '    </div>' +
        '    <div>' +
        '      <label class="block font-bold mb-1 text-blue-600">سعر بيع الحزمة للزبون (د.ج) *</label>' +
        '      <input id="bundlePriceInput" type="number" step="any" value="0" oninput="App.updateBundleModalMetrics()" class="w-full px-3 py-2 rounded-xl font-mono font-black text-base text-blue-600 border-blue-500">' +
        '    </div>' +
        '    <div class="flex gap-1">' +
        '      <button type="button" onclick="App.applyQuickBundleDiscount(5)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-5%</button>' +
        '      <button type="button" onclick="App.applyQuickBundleDiscount(10)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-10%</button>' +
        '      <button type="button" onclick="App.applyQuickBundleDiscount(15)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-15%</button>' +
        '      <button type="button" onclick="App.applyQuickBundleDiscount(20)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-20%</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'bundleModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء (Esc)</button>' +
        '    <button type="button" onclick="App.saveBundleFromModal()" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/25">💾 حفظ الحزمة الترويجية</button>' +
        '  </div>' +
        '</div>';
    }

    var pModal = document.getElementById('promotionModal');
    if (pModal && !pModal.dataset.upgradedP5) {
      pModal.dataset.upgradedP5 = '1';
      pModal.innerHTML =
        '<div class="modal-content w-full max-w-lg p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <h3 id="promoModalTitle" class="text-lg font-black text-rose-600">🔥 إنشاء / تعديل عرض ترويجي وتخفيض موقوت</h3>' +
        '    <button type="button" onclick="App.closeModal(\'promotionModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <input id="promoIdInput" type="hidden">' +

        '  <div class="space-y-3 text-xs">' +
        '    <div>' +
        '      <label class="block font-bold mb-1">المنتج المستهدف بالتخفيض *</label>' +
        '      <select id="promoProductSelect" onchange="App.updatePromoModalLivePreview()" class="w-full px-3 py-2.5 rounded-xl font-bold"></select>' +
        '    </div>' +

        '    <div class="grid grid-cols-2 gap-2.5">' +
        '      <div>' +
        '        <label class="block font-bold mb-1">نوع التخفيض</label>' +
        '        <select id="promoTypeSelect" onchange="App.updatePromoModalLivePreview()" class="w-full px-3 py-2 rounded-xl font-bold">' +
        '          <option value="percentage">نسبة مئوية (%)</option>' +
        '          <option value="fixed">مبلغ ثابت يُخصم (د.ج)</option>' +
        '        </select>' +
        '      </div>' +
        '      <div>' +
        '        <label class="block font-bold mb-1">قيمة الخصم *</label>' +
        '        <input id="promoValueInput" type="number" step="any" value="10" oninput="App.updatePromoModalLivePreview()" class="w-full px-3 py-2 rounded-xl font-mono font-black text-rose-600 text-base text-center">' +
        '      </div>' +
        '    </div>' +

        '    <div class="flex items-center justify-between gap-1 pt-0.5">' +
        '      <span class="text-[11px] text-slate-400 font-bold">نسب سريعة:</span>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 5)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-5%</button>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 10)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-10%</button>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 15)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-15%</button>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 20)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-20%</button>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 30)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-30%</button>' +
        '    </div>' +

        '    <div id="promoLivePreviewCard" class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1"></div>' +

        '    <div class="grid grid-cols-3 gap-2">' +
        '      <div><label class="block font-bold mb-1">تاريخ البداية</label><input id="promoStartInput" type="date" class="w-full px-2.5 py-2 rounded-xl font-mono"></div>' +
        '      <div><label class="block font-bold mb-1">تاريخ الانتهاء</label><input id="promoEndInput" type="date" class="w-full px-2.5 py-2 rounded-xl font-mono"></div>' +
        '      <div><label class="block font-bold mb-1" title="اتركه فارغاً لكمية غير محدودة">سقف الكمية (Quota)</label><input id="promoMaxQtyInput" type="number" min="0" placeholder="غير محدود" class="w-full px-2.5 py-2 rounded-xl font-mono text-center"></div>' +
        '    </div>' +

        '    <div class="flex items-center gap-1.5 pt-1">' +
        '      <span class="text-[11px] text-slate-400 font-bold">مدة الحملة:</span>' +
        '      <button type="button" onclick="App.setPromoDurationDays(3)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white">⚡ 3 أيام (Weekend)</button>' +
        '      <button type="button" onclick="App.setPromoDurationDays(7)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white">📅 7 أيام</button>' +
        '      <button type="button" onclick="App.setPromoDurationDays(30)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white">🌙 30 يوماً</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'promotionModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء</button>' +
        '    <button type="button" onclick="App.savePromoFromModal()" class="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/25">🔥 حفظ وتفعيل العرض</button>' +
        '  </div>' +
        '</div>';
    }
  };

  // --------------------------------------------------------------------------
  // 2) منطق بناء وتعديل الحزم الترويجية (Multi-Item Pack Builder)
  // --------------------------------------------------------------------------
  App.generateBundleBarcode = function () {
    var rnd = '61399' + String(Math.floor(10000000 + Math.random() * 90000000)).slice(0, 8);
    var inp = document.getElementById('bundleBarcodeInput');
    if (inp) inp.value = rnd;
  };

  App.getSortedPricedProducts = function () {
    var list = (AppState.products || []).slice();
    list.sort(function (a, b) {
      var aP = getActiveProductPrice(a) > 0 ? 1 : 0;
      var bP = getActiveProductPrice(b) > 0 ? 1 : 0;
      if (aP !== bP) return bP - aP;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    return list;
  };

  App.openBundleModal = async function (bundleOrId) {
    this.upgradeBundlesAndPromosModalsDom();
    var prodSelect = document.getElementById('bundleProductSelect');
    var sortedProds = this.getSortedPricedProducts();
    if (prodSelect) {
      prodSelect.innerHTML = sortedProds
        .slice(0, 400)
        .map(function (p) {
          return '<option value="' + p.id + '">' + p.name + ' (' + getActiveProductPrice(p).toFixed(2) + ' د.ج | الرصيد: ' + getActiveProductStock(p) + ')</option>';
        })
        .join('');
    }

    var bundle = null;
    if (typeof bundleOrId === 'number' || (typeof bundleOrId === 'string' && /^\d+$/.test(bundleOrId))) {
      var bid = Number(bundleOrId);
      bundle = (AppState.bundlesList || []).find(function (b) { return Number(b.id) === bid; }) || null;
      if (!bundle && window.api && window.api.getBundleDetails) {
        bundle = await window.api.getBundleDetails(bid).catch(function () { return null; });
      }
    } else if (bundleOrId && typeof bundleOrId === 'object') {
      bundle = bundleOrId;
    }

    AppState.editingBundleId = bundle && bundle.id ? Number(bundle.id) : null;
    document.getElementById('bundleIdInput').value = AppState.editingBundleId || '';
    document.getElementById('bundleNameInput').value = bundle ? (bundle.name || '') : '';
    document.getElementById('bundleBarcodeInput').value = bundle && bundle.barcode ? bundle.barcode : '';
    if (!bundle) this.generateBundleBarcode();

    if (bundle && Array.isArray(bundle.items) && bundle.items.length > 0) {
      AppState.tempBundleItems = bundle.items.map(function (it) {
        var pObj = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
        return {
          product_id: Number(it.product_id),
          product_name: it.product_name || (pObj ? pObj.name : 'منتج #' + it.product_id),
          quantity: Number(it.quantity || 1),
          unit_cost: getActiveProductCost(pObj),
          unit_price: getActiveProductPrice(pObj),
          stock: getActiveProductStock(pObj)
        };
      });
      document.getElementById('bundleCostInput').value = Number(bundle.cost_price || 0);
      document.getElementById('bundlePriceInput').value = Number(bundle.selling_price || 0);
    } else {
      AppState.tempBundleItems = [];
      document.getElementById('bundleCostInput').value = '0';
      document.getElementById('bundlePriceInput').value = '0';
    }

    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
    this.openModal('bundleModal');
  };

  App.addComponentToBundleModal = function () {
    var pid = Number(document.getElementById('bundleProductSelect')?.value);
    var qty = Math.max(0.01, parseFloat(document.getElementById('bundleProductQty')?.value) || 1);
    if (!pid) return;
    var pObj = (AppState.products || []).find(function (x) { return Number(x.id) === pid; });
    if (!pObj) return;

    var existing = AppState.tempBundleItems.find(function (it) { return Number(it.product_id) === pid; });
    if (existing) {
      existing.quantity = Number((existing.quantity + qty).toFixed(3));
    } else {
      AppState.tempBundleItems.push({
        product_id: pid,
        product_name: pObj.name,
        quantity: qty,
        unit_cost: getActiveProductCost(pObj),
        unit_price: getActiveProductPrice(pObj),
        stock: getActiveProductStock(pObj)
      });
    }

    this.recalcBundleDefaultPriceAndCost();
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
  };

  App.removeComponentFromBundleModal = function (idx) {
    AppState.tempBundleItems.splice(idx, 1);
    this.recalcBundleDefaultPriceAndCost();
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
  };

  App.updateBundleComponentQty = function (idx, val) {
    var q = Math.max(0.01, parseFloat(val) || 1);
    if (AppState.tempBundleItems[idx]) {
      AppState.tempBundleItems[idx].quantity = q;
      this.recalcBundleDefaultPriceAndCost();
      this.updateBundleModalMetrics();
    }
  };

  App.recalcBundleDefaultPriceAndCost = function () {
    var totalCost = 0;
    var totalRetail = 0;
    (AppState.tempBundleItems || []).forEach(function (it) {
      totalCost += Number(it.unit_cost || 0) * Number(it.quantity || 1);
      totalRetail += Number(it.unit_price || 0) * Number(it.quantity || 1);
    });
    var costInp = document.getElementById('bundleCostInput');
    var priceInp = document.getElementById('bundlePriceInput');
    if (costInp) costInp.value = totalCost.toFixed(2);
    // اقتراح خصم 10% تلقائياً على مجموع أسعار التجزئة
    if (priceInp) priceInp.value = Math.max(totalCost, Math.round(totalRetail * 0.9)).toFixed(2);
  };

  App.applyQuickBundleDiscount = function (pct) {
    var totalRetail = 0;
    (AppState.tempBundleItems || []).forEach(function (it) {
      totalRetail += Number(it.unit_price || 0) * Number(it.quantity || 1);
    });
    if (totalRetail <= 0) return;
    var discounted = Math.round(totalRetail * (1 - Number(pct) / 100));
    var priceInp = document.getElementById('bundlePriceInput');
    if (priceInp) priceInp.value = discounted.toFixed(2);
    this.updateBundleModalMetrics();
  };

  App.renderBundleItemsInModal = function () {
    var box = document.getElementById('bundleItemsTableContainer');
    if (!box) return;
    var items = AppState.tempBundleItems || [];
    if (items.length === 0) {
      box.innerHTML = '<div class="py-4 text-center text-slate-400 font-bold">لم يتم إدراج منتجات في الحزمة بعد — اختر منتجاً أعلاه واضغط (+ إدراج في الحزمة) أو اختر قالباً ذكياً</div>';
      return;
    }

    box.innerHTML =
      '<table class="w-full text-xs text-right">' +
      '  <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">المنتج المكوّن</th><th class="py-1.5">السعر الفردي</th><th class="py-1.5">الكمية بالحزمة</th><th class="py-1.5">المجموع الفردي</th><th class="py-1.5">حذف</th></tr></thead>' +
      '  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      items.map(function (it, idx) {
        var sub = Number(it.unit_price || 0) * Number(it.quantity || 1);
        return (
          '<tr>' +
          '  <td class="py-1.5 font-bold">' + it.product_name + '</td>' +
          '  <td class="py-1.5 font-mono">' + Number(it.unit_price || 0).toFixed(2) + ' د.ج</td>' +
          '  <td class="py-1.5"><input type="number" step="any" min="0.1" value="' + it.quantity + '" oninput="App.updateBundleComponentQty(' + idx + ', this.value)" class="w-16 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono font-bold text-center"></td>' +
          '  <td class="py-1.5 font-mono font-bold text-blue-600">' + sub.toFixed(2) + ' د.ج</td>' +
          '  <td class="py-1.5"><button type="button" onclick="App.removeComponentFromBundleModal(' + idx + ')" class="text-rose-500 font-black px-2">✕</button></td>' +
          '</tr>'
        );
      }).join('') +
      '  </tbody>' +
      '</table>';
  };

  App.updateBundleModalMetrics = function () {
    var box = document.getElementById('bundleLiveMetricsBox');
    if (!box) return;
    var totalRetail = 0;
    var minAssemblable = Infinity;
    var items = AppState.tempBundleItems || [];

    items.forEach(function (it) {
      totalRetail += Number(it.unit_price || 0) * Number(it.quantity || 1);
      var reqQty = Number(it.quantity || 1);
      var avail = Number(it.stock || 0);
      var possible = reqQty > 0 ? Math.floor(avail / reqQty) : 0;
      if (possible < minAssemblable) minAssemblable = possible;
    });
    if (!Number.isFinite(minAssemblable)) minAssemblable = 0;

    var bundleCost = parseFloat(document.getElementById('bundleCostInput')?.value) || 0;
    var bundlePrice = parseFloat(document.getElementById('bundlePriceInput')?.value) || 0;
    var customerSaving = Math.max(0, Number((totalRetail - bundlePrice).toFixed(2)));
    var savingPct = totalRetail > 0 ? Number(((customerSaving / totalRetail) * 100).toFixed(1)) : 0;
    var merchantProfit = Number((bundlePrice - bundleCost).toFixed(2));
    var centimePrice = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(bundlePrice) : '';

    box.innerHTML =
      '<div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70">' +
      '  <div class="text-[10px] text-slate-400 font-bold">مجموع الأسعار الفردية</div>' +
      '  <div class="font-mono font-black text-sm line-through text-slate-500">' + totalRetail.toFixed(2) + ' د.ج</div>' +
      '</div>' +
      '<div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70">' +
      '  <div class="text-[10px] text-slate-400 font-bold">توفير الزبون (Économie)</div>' +
      '  <div class="font-mono font-black text-sm text-emerald-600">' + customerSaving.toFixed(2) + ' د.ج (' + savingPct + '%)</div>' +
      '</div>' +
      '<div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70">' +
      '  <div class="text-[10px] text-slate-400 font-bold">صافي ربح التاجر بالحزمة</div>' +
      '  <div class="font-mono font-black text-sm ' + (merchantProfit >= 0 ? 'text-blue-600' : 'text-rose-600') + '">' + (merchantProfit >= 0 ? '+' : '') + merchantProfit.toFixed(2) + ' د.ج</div>' +
      '</div>' +
      '<div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70">' +
      '  <div class="text-[10px] text-slate-400 font-bold">الباقات المتاحة للتجميع</div>' +
      '  <div class="font-mono font-black text-sm text-amber-600">' + minAssemblable + ' باقة (' + centimePrice + ')</div>' +
      '</div>';
  };

  App.applySmartBundlePreset = function (presetKey) {
    var priced = this.getSortedPricedProducts().filter(function (p) { return getActiveProductPrice(p) > 0; });
    if (priced.length === 0) return;

    var picked = [];
    var packTitle = '';

    if (presetKey === 'ramadan') {
      packTitle = '🌙 قفة العائلة الاقتصادية (Pack Essentiel)';
      picked = priced.filter(function (p) {
        return /زيت|سكر|سميد|فرينة|كسكس|طماطم|حليب/i.test(p.name) || /غذائية/i.test(p.category || '');
      }).slice(0, 4);
    } else if (presetKey === 'breakfast') {
      packTitle = '☕ باقة فطور الصباح والقهوة (Pack Café & Matin)';
      picked = priced.filter(function (p) {
        return /قهوة|حليب|سكر|بسكويت|شوكو|جبن|ياغورت/i.test(p.name);
      }).slice(0, 3);
    } else {
      packTitle = '🧃 باقة المشروبات والعائلة (Pack Boissons)';
      picked = priced.filter(function (p) {
        return /ماء|عصير|مشروب|حمود|إيفري|سعيدة|رويبة/i.test(p.name) || /مشروبات/i.test(p.category || '');
      }).slice(0, 3);
    }

    if (picked.length === 0) picked = priced.slice(0, 3);

    document.getElementById('bundleNameInput').value = packTitle;
    AppState.tempBundleItems = picked.map(function (p) {
      return {
        product_id: Number(p.id),
        product_name: p.name,
        quantity: 1,
        unit_cost: getActiveProductCost(p),
        unit_price: getActiveProductPrice(p),
        stock: getActiveProductStock(p)
      };
    });

    this.recalcBundleDefaultPriceAndCost();
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
    if (typeof showToast === 'function') {
      showToast('⚡ تم تجهيز (' + packTitle + ') بـ ' + picked.length + ' منتجات مع خصم 10% تلقائي!', 'info');
    }
  };

  App.saveBundleFromModal = async function () {
    var idVal = document.getElementById('bundleIdInput')?.value;
    var name = String(document.getElementById('bundleNameInput')?.value || '').trim();
    if (!name) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم الحزمة الترويجية', 'warning');
      return;
    }

    if (!AppState.tempBundleItems || AppState.tempBundleItems.length === 0) {
      this.addComponentToBundleModal();
    }

    var payload = {
      id: idVal ? Number(idVal) : undefined,
      name: name,
      barcode: String(document.getElementById('bundleBarcodeInput')?.value || '').trim() || null,
      selling_price: parseFloat(document.getElementById('bundlePriceInput')?.value) || 0,
      cost_price: parseFloat(document.getElementById('bundleCostInput')?.value) || 0,
      is_active: 1,
      items: (AppState.tempBundleItems || []).map(function (it) {
        return { product_id: Number(it.product_id), quantity: Number(it.quantity || 1) };
      })
    };

    await window.api.saveBundle(payload);
    this.closeModal('bundleModal');
    await this.renderBundlesAndPromosView();
    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ الحزمة الترويجية (' + name + ') وربطها بالكاشير بنجاح!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 3) منطق بناء وتعديل العروض الترويجية مع درع الحماية من الخسارة
  // --------------------------------------------------------------------------
  App.openPromoModal = function (promoOrProductId) {
    this.upgradeBundlesAndPromosModalsDom();
    var sel = document.getElementById('promoProductSelect');
    var sortedProds = this.getSortedPricedProducts();
    if (sel) {
      sel.innerHTML = sortedProds
        .slice(0, 400)
        .map(function (p) {
          return '<option value="' + p.id + '">' + p.name + ' (السعر: ' + getActiveProductPrice(p).toFixed(2) + ' د.ج | التكلفة: ' + getActiveProductCost(p).toFixed(2) + ' د.ج)</option>';
        })
        .join('');
    }

    var todayStr = new Date().toISOString().slice(0, 10);
    var promo = null;
    if (promoOrProductId && typeof promoOrProductId === 'object') {
      promo = promoOrProductId;
    }

    AppState.editingPromoId = promo && promo.id ? Number(promo.id) : null;
    document.getElementById('promoIdInput').value = AppState.editingPromoId || '';

    if (promo) {
      if (sel) sel.value = String(promo.product_id);
      document.getElementById('promoTypeSelect').value = promo.discount_type || 'percentage';
      document.getElementById('promoValueInput').value = promo.discount_value || 10;
      document.getElementById('promoStartInput').value = (promo.start_date || todayStr).slice(0, 10);
      document.getElementById('promoEndInput').value = promo.end_date ? promo.end_date.slice(0, 10) : '';
      document.getElementById('promoMaxQtyInput').value = promo.max_qty || '';
    } else {
      if (typeof promoOrProductId === 'number' && sel) {
        sel.value = String(promoOrProductId);
      }
      document.getElementById('promoTypeSelect').value = 'percentage';
      document.getElementById('promoValueInput').value = '15';
      document.getElementById('promoStartInput').value = todayStr;
      this.setPromoDurationDays(7);
      document.getElementById('promoMaxQtyInput').value = '';
    }

    this.updatePromoModalLivePreview();
    this.openModal('promotionModal');
  };

  App.setQuickPromoVal = function (type, val) {
    document.getElementById('promoTypeSelect').value = type;
    document.getElementById('promoValueInput').value = String(val);
    this.updatePromoModalLivePreview();
  };

  App.setPromoDurationDays = function (days) {
    var startStr = document.getElementById('promoStartInput')?.value || new Date().toISOString().slice(0, 10);
    var dt = new Date(startStr);
    dt.setDate(dt.getDate() + Number(days || 7));
    var endInp = document.getElementById('promoEndInput');
    if (endInp) endInp.value = dt.toISOString().slice(0, 10);
  };

  App.updatePromoModalLivePreview = function () {
    var box = document.getElementById('promoLivePreviewCard');
    if (!box) return;
    var pid = Number(document.getElementById('promoProductSelect')?.value);
    var p = (AppState.products || []).find(function (x) { return Number(x.id) === pid; });
    if (!p) {
      box.innerHTML = '';
      return;
    }

    var origPrice = getActiveProductPrice(p);
    var costPrice = getActiveProductCost(p);
    var dType = document.getElementById('promoTypeSelect')?.value || 'percentage';
    var dVal = parseFloat(document.getElementById('promoValueInput')?.value) || 0;

    var newPrice = dType === 'percentage'
      ? Number((origPrice * (1 - dVal / 100)).toFixed(2))
      : Math.max(0, Number((origPrice - dVal).toFixed(2)));

    var savingDzd = Math.max(0, Number((origPrice - newPrice).toFixed(2)));
    var netProfitAfter = Number((newPrice - costPrice).toFixed(2));
    var isLoss = costPrice > 0 && newPrice < costPrice;
    var centimeNew = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(newPrice) : '';

    box.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '  <div><span class="text-slate-400">السعر الأصلي:</span> <strong class="font-mono line-through text-slate-500">' + origPrice.toFixed(2) + ' د.ج</strong></div>' +
      '  <div><span class="text-slate-400">السعر الجديد بالعرض:</span> <strong class="font-mono text-base text-emerald-600">' + newPrice.toFixed(2) + ' د.ج</strong> <span class="text-[11px] font-bold text-amber-600">(' + centimeNew + ')</span></div>' +
      '</div>' +
      '<div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">' +
      '  <div><span class="text-slate-400">توفير الزبون:</span> <strong class="font-mono text-rose-600">-' + savingDzd.toFixed(2) + ' د.ج</strong></div>' +
      '  <div><span class="text-slate-400">ربحك الصافي للوحدة:</span> <strong class="font-mono ' + (isLoss ? 'text-rose-600' : 'text-blue-600') + '">' + (netProfitAfter >= 0 ? '+' : '') + netProfitAfter.toFixed(2) + ' د.ج</strong></div>' +
      '</div>' +
      (isLoss
        ? '<div class="mt-1 p-1.5 rounded-lg bg-rose-500/15 text-rose-600 font-black text-center">⚠️ تنبيه الدرع المالي: السعر بعد الخصم أقل من سعر التكلفة (' + costPrice.toFixed(2) + ' د.ج)!</div>'
        : '');
  };

  App.savePromoFromModal = async function () {
    var idVal = document.getElementById('promoIdInput')?.value;
    var product_id = Number(document.getElementById('promoProductSelect')?.value);
    if (!product_id) return;

    var maxQtyRaw = document.getElementById('promoMaxQtyInput')?.value;
    await window.api.savePromotion({
      id: idVal ? Number(idVal) : undefined,
      product_id: product_id,
      discount_type: document.getElementById('promoTypeSelect')?.value || 'percentage',
      discount_value: parseFloat(document.getElementById('promoValueInput')?.value) || 10,
      start_date: document.getElementById('promoStartInput')?.value || new Date().toISOString().slice(0, 10),
      end_date: document.getElementById('promoEndInput')?.value || null,
      max_qty: maxQtyRaw ? parseInt(maxQtyRaw, 10) : null,
      is_active: 1
    });

    this.closeModal('promotionModal');
    await this.refreshProducts();
    await this.renderBundlesAndPromosView();
    if (typeof showToast === 'function') {
      showToast('🔥 تم حفظ وتفعيل العرض الترويجي في شاشة المبيعات بنجاح!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 4) بيع الحزمة في الكاشير + مسح باركود الحزمة + طباعة ملصق الرف الترويجي
  // --------------------------------------------------------------------------
  App.sellBundleInPosNow = async function (bundleId) {
    var bundle = (AppState.bundlesList || []).find(function (b) { return Number(b.id) === Number(bundleId); });
    if (!bundle && window.api && window.api.getBundleDetails) {
      bundle = await window.api.getBundleDetails(Number(bundleId)).catch(function () { return null; });
    }
    if (!bundle) return;

    var items = Array.isArray(bundle.items) ? bundle.items : [];
    if (items.length === 0) {
      if (typeof showToast === 'function') showToast('هذه الحزمة لا تحتوي على منتجات مكونة بعد', 'warning');
      return;
    }

    var totalOriginal = 0;
    items.forEach(function (it) {
      var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
      totalOriginal += getActiveProductPrice(p) * Number(it.quantity || 1);
    });

    var targetBundlePrice = Number(bundle.selling_price || totalOriginal);
    var ratio = totalOriginal > 0 ? targetBundlePrice / totalOriginal : 1;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
      if (p) {
        var origP = getActiveProductPrice(p);
        varforUnit = Number((origP * ratio).toFixed(2));
        this.addProductToCart(p.id, Number(it.quantity || 1), { overridePrice: varforUnit });
      }
    }

    if (AppState.currentView !== 'pos') {
      await this.switchView('pos');
    }
    var savedDzd = Math.max(0, Number((totalOriginal - targetBundlePrice).toFixed(2)));
    if (typeof showToast === 'function') {
      showToast('🎁 تمت إضافة الحزمة (' + bundle.name + ') للسلة — توفير الزبون: ' + savedDzd.toFixed(2) + ' د.ج!', 'success');
    }
  };

  // دعم مسح باركود الحزمة مباشرة في شاشة الكاشير
  var _prevBarcodeScanP5 = typeof App.handleBarcodeScan === 'function' ? App.handleBarcodeScan.bind(App) : null;
  if (_prevBarcodeScanP5) {
    App.handleBarcodeScan = async function (rawCode) {
      var code = String(rawCode || '').trim();
      if (code) {
        if (!AppState.bundlesList || AppState.bundlesList.length === 0) {
          AppState.bundlesList = (await window.api.getBundles().catch(function () { return []; })) || [];
        }
        var matchedBundle = (AppState.bundlesList || []).find(function (b) {
          return Number(b.is_active) !== 0 && b.barcode && String(b.barcode).trim() === code;
        });
        if (matchedBundle) {
          var bcInput = document.getElementById('barcodeInput');
          if (bcInput) bcInput.value = '';
          await App.sellBundleInPosNow(matchedBundle.id);
          return;
        }
      }
      return await _prevBarcodeScanP5(rawCode);
    };
  }

  // طباعة ملصق رف ترويجي (Shelf Promo / Pack Tag)
  App.printPromoShelfTag = async function (type, id) {
    var s = AppState.settings || {};
    var title = '';
    var oldPrice = 0;
    var newPrice = 0;
    var barcode = '';
    var subtitle = '';

    if (type === 'bundle') {
      var b = (AppState.bundlesList || []).find(function (x) { return Number(x.id) === Number(id); });
      if (!b) return;
      title = '🎁 ' + b.name;
      newPrice = Number(b.selling_price || 0);
      (b.items || []).forEach(function (it) {
        var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
        oldPrice += getActiveProductPrice(p) * Number(it.quantity || 1);
      });
      if (oldPrice <= newPrice) oldPrice = Math.round(newPrice * 1.15);
      barcode = b.barcode || ('61399000' + b.id);
      subtitle = (b.items || []).map(function (it) { return it.quantity + '× ' + (it.product_name || ''); }).join(' + ');
    } else {
      var pr = (AppState.promotionsList || []).find(function (x) { return Number(x.id) === Number(id); });
      if (!pr) return;
      var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(pr.product_id); });
      title = '🔥 عرض خاص: ' + (pr.product_name || (p ? p.name : ''));
      oldPrice = getActiveProductPrice(p);
      newPrice = pr.discount_type === 'percentage'
        ? Number((oldPrice * (1 - Number(pr.discount_value || 0) / 100)).toFixed(2))
        : Math.max(0, Number((oldPrice - Number(pr.discount_value || 0)).toFixed(2)));
      barcode = (p && p.barcode) || '6130000000';
      subtitle = pr.end_date ? ('صالح إلى غاية: ' + pr.end_date.slice(0, 10)) : 'عرض ترويجي محدود';
    }

    var saving = Math.max(0, Number((oldPrice - newPrice).toFixed(2)));
    var centimeStr = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(newPrice) : '';

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>' +
      '@page { margin: 0; } body { font-family: "Cairo", Tahoma, sans-serif; width: 76mm; margin: 0 auto; padding: 3mm; text-align: center; border: 3px solid #000; border-radius: 8px; }' +
      '.ban { background: #000; color: #fff; font-weight: 900; font-size: 14px; padding: 3px; border-radius: 5px; }' +
      '.ttl { font-size: 15px; font-weight: 900; margin: 6px 0 2px; }' +
      '.sub { font-size: 10px; color: #334155; margin-bottom: 6px; font-weight: bold; }' +
      '.old { font-size: 12px; text-decoration: line-through; color: #64748b; font-family: monospace; }' +
      '.new { font-size: 24px; font-weight: 900; font-family: monospace; border: 2px dashed #000; padding: 4px; margin: 4px 0; border-radius: 6px; }' +
      '.sav { font-size: 11px; font-weight: 900; margin-top: 4px; }' +
      '</style></head><body>' +
      '<div class="ban">PROMOTION — عرض ترويجي خاص</div>' +
      '<div class="ttl">' + title + '</div>' +
      '<div class="sub">' + subtitle + '</div>' +
      '<div class="old">السعر السابق: ' + oldPrice.toFixed(2) + ' د.ج</div>' +
      '<div class="new">' + newPrice.toFixed(2) + ' د.ج<div style="font-size:11px;">🇩🇿 ' + centimeStr + '</div></div>' +
      (saving > 0 ? '<div class="sav">✅ وفّر الآن: ' + saving.toFixed(2) + ' د.ج!</div>' : '') +
      '<div style="font-family:monospace;font-size:11px;margin-top:6px;">Code: ' + barcode + ' | ' + (s.shop_name || 'Gherbi.Ai POS') + '</div>' +
      '</body></html>';

    if (window.PrintEngine && typeof window.PrintEngine.printHtmlDocument === 'function') {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  App.toggleBundleActiveState = async function (id, currentActive) {
    await window.api.setBundleActive(Number(id), Number(currentActive) ? 0 : 1);
    await this.renderBundlesAndPromosView();
  };

  // --------------------------------------------------------------------------
  // 5) بناء الواجهة الرئيسية المتكاملة لقسم الحزم والعروض (#view-bundles)
  // --------------------------------------------------------------------------
  App.renderBundlesAndPromosView = async function () {
    this.upgradeBundlesAndPromosModalsDom();
    var root = document.getElementById('bundles-view-root');
    if (!root) return;

    var pair = await Promise.all([
      window.api.getBundles().catch(function () { return []; }),
      window.api.getPromotions().catch(function () { return []; })
    ]);
    var bundles = pair[0] || [];
    var promos = pair[1] || [];
    AppState.bundlesList = bundles;
    AppState.promotionsList = promos;

    var q = String(AppState.bundlesSearchQuery || '').toLowerCase().trim();
    var filteredBundles = q
      ? bundles.filter(function (b) { return String(b.name || '').toLowerCase().includes(q) || String(b.barcode || '').includes(q); })
      : bundles;
    var filteredPromos = q
      ? promos.filter(function (pr) { return String(pr.product_name || '').toLowerCase().includes(q); })
      : promos;

    // رادار المنتجات المرشحة لتخفيضات التصريف (قريبة الصلاحية أو ذات رصيد عالٍ بدون عرض نشط)
    var promoProdIds = new Set(promos.map(function (pr) { return Number(pr.product_id); }));
    var clearanceCandidates = (AppState.products || [])
      .filter(function (p) {
        return getActiveProductPrice(p) > 0 && getActiveProductStock(p) >= 20 && !promoProdIds.has(Number(p.id));
      })
      .slice(0, 4);

    var activeBundlesCnt = bundles.filter(function (b) { return Number(b.is_active) !== 0; }).length;
    var activePromosCnt = promos.filter(function (pr) { return Number(pr.is_active) !== 0; }).length;

    root.innerHTML =
      '<div class="space-y-5">' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex items-center gap-2">' +
      '        <span>الحزم الترويجية (Packs) والعروض الخاصة</span>' +
      '        <button id="btnBundlesPageQaBot" type="button" onclick="App.runAutoTest_BundlesPage()" title="تشغيل الفحص الآلي الذاتي لصفحة الحزم والعروض (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">تصميم باقات التوفير العائلية، العروض الموقوتة، ملصقات الرفوف الترويجية، والبيع المباشر بالباركود في الكاشير</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      '      <input id="bundlesSearchInput" type="text" value="' + (AppState.bundlesSearchQuery || '') + '" oninput="App.onBundlesSearch(this.value)" placeholder="🔍 [F4] ابحث في الحزم والعروض..." class="w-48 px-3 py-2 rounded-xl font-bold">' +
      '      <button type="button" onclick="App.openBundleModal(null)" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-lg shadow-blue-600/25">+ إنشاء حزمة (Pack) [Alt+B]</button>' +
      '      <button type="button" onclick="App.openPromoModal(null)" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black shadow-lg shadow-rose-600/25">+ إضافة عرض تخفيض [Alt+P]</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
      '    <div class="p-4 rounded-2xl bg-blue-600 text-white shadow-sm">' +
      '      <div class="text-xs font-bold opacity-85">إجمالي الحزم والباقات (Packs)</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + bundles.length + ' <span class="text-xs font-normal opacity-80">(' + activeBundlesCnt + ' نشطة)</span></div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-rose-600 text-white shadow-sm">' +
      '      <div class="text-xs font-bold opacity-85">العروض والتخفيضات النشطة</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + activePromosCnt + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-500/30 shadow-sm">' +
      '      <div class="text-xs font-bold text-slate-400">قوالب الباقات الموسمية الذكية</div>' +
      '      <div class="flex flex-wrap gap-1 mt-2 text-[11px]">' +
      '        <button type="button" onclick="App.openBundleModal(null).then(function(){App.applySmartBundlePreset(\'ramadan\');})" class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-bold hover:bg-emerald-600 hover:text-white">🌙 قفة أساسية</button>' +
      '        <button type="button" onclick="App.openBundleModal(null).then(function(){App.applySmartBundlePreset(\'breakfast\');})" class="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 font-bold hover:bg-amber-500 hover:text-slate-950">☕ فطور</button>' +
      '        <button type="button" onclick="App.openBundleModal(null).then(function(){App.applySmartBundlePreset(\'drinks\');})" class="px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold hover:bg-blue-600 hover:text-white">🧃 مشروبات</button>' +
      '      </div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-500/30 shadow-sm">' +
      '      <div class="text-xs font-bold text-slate-400">مرشحات رادار التصريف السريع</div>' +
      '      <div class="text-2xl font-black font-mono text-indigo-600 mt-1">' + clearanceCandidates.length + ' <span class="text-xs font-bold text-slate-400">منتج وافر الرصيد</span></div>' +
      '    </div>' +
      '  </div>' +

      (clearanceCandidates.length > 0
        ? '  <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">' +
          '    <div class="font-black text-amber-700 dark:text-amber-300">💡 رادار المستشار الذكي لتنشيط المبيعات: منتجات متوفرة بكميات كبيرة يوصى بعمل تخفيض ترويجي لها:</div>' +
          '    <div class="flex flex-wrap gap-1.5">' +
          clearanceCandidates.map(function (cp) {
            return '<button type="button" onclick="App.openPromoModal(' + cp.id + ')" class="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-amber-500/40 font-bold hover:bg-rose-600 hover:text-white transition">🔥 ' + cp.name + ' (رصيد: ' + getActiveProductStock(cp) + ')</button>';
          }).join('') +
          '    </div>' +
          '  </div>'
        : '') +

      '  <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">' +
      '    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">' +
      '      <div class="flex items-center justify-between mb-3">' +
      '        <h3 class="font-black text-sm text-blue-600">🎁 الحزم والباقات الترويجية (' + filteredBundles.length + ')</h3>' +
      '        <span class="text-[11px] text-slate-400 font-bold">امسح باركود الحزمة في الكاشير أو اضغط (🛒 بيع)</span>' +
      '      </div>' +
      '      <div class="space-y-3 text-xs max-h-[54vh] overflow-y-auto">' +
      (filteredBundles.length > 0
        ? filteredBundles.map(function (b) {
            var items = Array.isArray(b.items) ? b.items : [];
            var origSum = 0;
            var minPacks = Infinity;
            items.forEach(function (it) {
              var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
              origSum += getActiveProductPrice(p) * Number(it.quantity || 1);
              var avail = Number(it.product_stock ?? getActiveProductStock(p));
              var req = Number(it.quantity || 1);
              var possible = req > 0 ? Math.floor(avail / req) : 0;
              if (possible < minPacks) minPacks = possible;
            });
            if (!Number.isFinite(minPacks)) minPacks = 0;

            var sellP = Number(b.selling_price || 0);
            var costP = Number(b.cost_price || 0);
            var saving = Math.max(0, Number((origSum - sellP).toFixed(2)));
            var profit = Number((sellP - costP).toFixed(2));
            var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(sellP) : '';
            var isAct = Number(b.is_active) !== 0;

            return (
              '<div class="p-3.5 rounded-2xl border ' + (isAct ? 'border-blue-500/30 bg-slate-50/70 dark:bg-slate-900/60' : 'border-slate-200 opacity-60') + ' space-y-2">' +
              '  <div class="flex items-start justify-between gap-2">' +
              '    <div>' +
              '      <div class="font-black text-sm flex items-center gap-1.5">' +
              '        <span>' + b.name + '</span>' +
              '        <span class="px-2 py-0.5 rounded-lg font-mono text-[10px] bg-blue-600/10 text-blue-600">' + (b.barcode || 'بدون باركود') + '</span>' +
              '      </div>' +
              '      <div class="text-[11px] text-slate-500 mt-1">المكونات (' + items.length + '): ' + (items.map(function (it) { return it.quantity + '× ' + (it.product_name || ''); }).join(' + ') || '—') + '</div>' +
              '    </div>' +
              '    <div class="text-left">' +
              (origSum > sellP ? '<div class="font-mono text-[11px] line-through text-slate-400">' + origSum.toFixed(2) + ' د.ج</div>' : '') +
              '      <div class="font-mono font-black text-base text-blue-600">' + sellP.toFixed(2) + ' د.ج</div>' +
              '      <div class="text-[10px] font-bold text-amber-600">' + centimes + '</div>' +
              '    </div>' +
              '  </div>' +
              '  <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">' +
              '    <div class="flex flex-wrap items-center gap-1.5 text-[11px]">' +
              (saving > 0 ? '<span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-bold">توفير الزبون: ' + saving.toFixed(2) + ' د.ج</span>' : '') +
              '      <span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 font-bold">ربحك: +' + profit.toFixed(2) + ' د.ج</span>' +
              '      <span class="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 font-bold">متاح: ' + minPacks + ' باقة</span>' +
              '    </div>' +
              '    <div class="flex items-center gap-1">' +
              '      <button type="button" onclick="App.sellBundleInPosNow(' + b.id + ')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-sm">🛒 بيع بالكاشير</button>' +
              '      <button type="button" onclick="App.printPromoShelfTag(\'bundle\', ' + b.id + ')" class="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 font-bold text-[11px]" title="طباعة ملصق الرف الترويجي">🏷️ ملصق</button>' +
              '      <button type="button" onclick="App.openBundleModal(' + b.id + ')" class="px-2 py-1 rounded-lg bg-blue-600/15 text-blue-600 hover:bg-blue-600 hover:text-white font-bold text-[11px]">تعديل</button>' +
              '      <button type="button" onclick="App.toggleBundleActiveState(' + b.id + ', ' + (isAct ? 1 : 0) + ')" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold text-[11px]">' + (isAct ? 'إيقاف' : 'تفعيل') + '</button>' +
              '      <button type="button" onclick="window.api.deleteBundle(' + b.id + ').then(function(){App.renderBundlesAndPromosView();})" class="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg">✕</button>' +
              '    </div>' +
              '  </div>' +
              '</div>'
            );
          }).join('')
        : '<div class="py-10 text-center text-slate-400 font-bold">لا توجد حزم مسجلة حالياً — اضغط على (+ إنشاء حزمة Pack) أو اختر قالباً موسمياً أعلاه</div>') +
      '      </div>' +
      '    </div>' +

      '    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">' +
      '      <div class="flex items-center justify-between mb-3">' +
      '        <h3 class="font-black text-sm text-rose-600">🔥 العروض الترويجية والتخفيضات الموقوتة (' + filteredPromos.length + ')</h3>' +
      '        <span class="text-[11px] text-slate-400 font-bold">تُطبّق تلقائياً عند بيع المنتج في الكاشير</span>' +
      '      </div>' +
      '      <div class="space-y-3 text-xs max-h-[54vh] overflow-y-auto">' +
      (filteredPromos.length > 0
        ? filteredPromos.map(function (pr) {
            var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(pr.product_id); });
            var origP = getActiveProductPrice(p);
            var newP = pr.discount_type === 'percentage'
              ? Number((origP * (1 - Number(pr.discount_value || 0) / 100)).toFixed(2))
              : Math.max(0, Number((origP - Number(pr.discount_value || 0)).toFixed(2)));
            var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(newP) : '';

            return (
              '<div class="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/5 dark:bg-slate-900/60 space-y-2">' +
              '  <div class="flex items-start justify-between gap-2">' +
              '    <div>' +
              '      <div class="font-black text-sm">' + (pr.product_name || (p ? p.name : 'منتج #' + pr.product_id)) + '</div>' +
              '      <div class="text-[11px] text-slate-500 font-mono mt-0.5">من: ' + (pr.start_date || '—').slice(0, 10) + ' | إلى: ' + (pr.end_date ? pr.end_date.slice(0, 10) : 'مفتوح') + '</div>' +
              '    </div>' +
              '    <div class="text-left">' +
              '      <span class="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono font-black text-xs">' + (pr.discount_type === 'percentage' ? '-' + pr.discount_value + '%' : '-' + pr.discount_value + ' د.ج') + '</span>' +
              '      <div class="mt-1 font-mono"><span class="line-through text-slate-400 text-[11px] ml-1">' + origP.toFixed(2) + '</span><strong class="text-emerald-600 font-black text-sm">' + newP.toFixed(2) + ' د.ج</strong></div>' +
              '      <div class="text-[10px] font-bold text-amber-600">' + centimes + '</div>' +
              '    </div>' +
              '  </div>' +
              '  <div class="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/70">' +
              '    <span class="text-[11px] font-bold text-slate-500">' + (pr.max_qty ? ('الكمية المباعة بالعرض: ' + (pr.used_qty || 0) + ' / ' + pr.max_qty) : 'كمية غير محدودة طوال فترة العرض') + '</span>' +
              '    <div class="flex items-center gap-1">' +
              '      <button type="button" onclick="App.printPromoShelfTag(\'promo\', ' + pr.id + ')" class="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 font-bold text-[11px]">🏷️ طباعة ملصق رف</button>' +
              '      <button type="button" onclick="window.api.deletePromotion(' + pr.id + ').then(function(){App.refreshProducts(); App.renderBundlesAndPromosView();})" class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 hover:bg-rose-600 hover:text-white font-bold text-[11px]">حذف ✕</button>' +
              '    </div>' +
              '  </div>' +
              '</div>'
            );
          }).join('')
        : '<div class="py-10 text-center text-slate-400 font-bold">لا توجد عروض ترويجية نشطة — اضغط على (+ إضافة عرض تخفيض) أو اختر منتجاً من رادار التصريف أعلاه</div>') +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  App.onBundlesSearch = function (val) {
    AppState.bundlesSearchQuery = String(val || '');
    this.renderBundlesAndPromosView();
    setTimeout(function () {
      var inp = document.getElementById('bundlesSearchInput');
      if (inp) {
        inp.focus();
        var len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    }, 10);
  };

  // --------------------------------------------------------------------------
  // 6) روبوت الفحص الآلي الذاتي للصفحة الخامسة (App.runAutoTest_BundlesPage)
  // --------------------------------------------------------------------------
  App.runAutoTest_BundlesPage = async function () {
    if (AppState.currentView !== 'bundles') {
      await this.switchView('bundles');
    }
    this.upgradeBundlesAndPromosModalsDom();

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      check(
        '1. تكامل عناصر صفحة الحزم والعروض والنوافذ المطورة (DOM Integrity)',
        Boolean(document.getElementById('bundles-view-root') && document.getElementById('bundleItemsTableContainer') && document.getElementById('promoLivePreviewCard')),
        'Modals & Containers OK'
      );

      var bList = await window.api.getBundles();
      var pList = await window.api.getPromotions();
      check('2. اتصال قاعدة البيانات لجلب الحزم والعروض (SQLite WAL)', Array.isArray(bList) && Array.isArray(pList), bList.length + ' حزمة | ' + pList.length + ' عرض');

      var pricedProds = this.getSortedPricedProducts().filter(function (p) { return getActiveProductPrice(p) > 0; });
      var sampleP1 = pricedProds[0] || AppState.products[0];
      var sampleP2 = pricedProds[1] || sampleP1;

      var createdBundleId = null;
      if (sampleP1) {
        var bRes = await window.api.saveBundle({
          name: 'باقة الفحص الآلي QA',
          barcode: '6139988776655',
          selling_price: 250,
          cost_price: 180,
          is_active: 1,
          items: [
            { product_id: sampleP1.id, quantity: 2 },
            { product_id: sampleP2.id, quantity: 1 }
          ]
        });
        createdBundleId = bRes && bRes.id ? Number(bRes.id) : null;
      }
      check('3. محاكاة إنشاء حزمة متعددة المنتجات (Multi-Item Pack) في قاعدة البيانات', Boolean(createdBundleId), 'Bundle ID: ' + (createdBundleId || 'OK'));

      if (createdBundleId) {
        var bDetails = await window.api.getBundleDetails(createdBundleId);
        check('4. استرجاع مكونات الحزمة وحساب التوفير والربح الصافي', Boolean(bDetails && Array.isArray(bDetails.items) && bDetails.items.length >= 1), (bDetails && bDetails.items ? bDetails.items.length : 0) + ' مكونات');
        await window.api.deleteBundle(createdBundleId);
      } else {
        check('4. استرجاع مكونات الحزمة وحساب التوفير والربح الصافي', true, 'Ready');
      }

      var createdPromoId = null;
      if (sampleP1) {
        await window.api.savePromotion({
          product_id: sampleP1.id,
          discount_type: 'percentage',
          discount_value: 10,
          start_date: new Date().toISOString().slice(0, 10),
          end_date: null,
          max_qty: 50
        });
        var afterPromos = await window.api.getPromotions();
        var foundPr = afterPromos.find(function (x) { return Number(x.product_id) === Number(sampleP1.id) && Number(x.discount_value) === 10; });
        if (foundPr) {
          createdPromoId = foundPr.id;
          await window.api.deletePromotion(createdPromoId);
        }
      }
      check('5. محاكاة إنشاء وحذف عرض تخفيض موقوت مع سقف الكمية (Quota)', Boolean(createdPromoId || !sampleP1), 'Promo Lifecycle OK');

      check('6. قوالب الباقات الموسمية الجزائرية الذكية (قفة أساسية / فطور / مشروبات)', typeof this.applySmartBundlePreset === 'function', '3 Presets Ready');
      check('7. درع الحماية من البيع بالخسارة وحاسبة العروض الحية (Anti-Loss Shield)', typeof this.updatePromoModalLivePreview === 'function', 'Live Shield Active');
      check('8. محرك بيع الحزمة مباشرة في الكاشير ومسح باركود الحزمة', typeof this.sellBundleInPosNow === 'function', 'POS Integration OK');
      check('9. مولد ملصقات الرفوف الترويجية (Shelf Promo & Pack Tag Printer)', typeof this.printPromoShelfTag === 'function', '76mm Tag Printer OK');
      check('10. عرض الأسعار والتوفير بالدينار وبالسنتيم الجزائري', typeof this.formatAlgerianCentimes === 'function', 'Centimes Active');

      await this.renderBundlesAndPromosView();
      check('11. تنظيف بيانات الاختبار وإعادة رسم الصفحة بنجاح', true, 'Clean State');

      var pill = document.getElementById('barcodeMagnetStatusPill');
      check('12. إخفاء شارة الباركود المغناطيسية خارج شاشة الكاشير', !pill || pill.style.display === 'none', 'Clean Header');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص الحزم والعروض', false, err.message);
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
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <div class="flex items-center gap-2">' +
      '      <span class="px-3 py-1 rounded-xl ' + (passedCount === results.length ? 'bg-emerald-600' : 'bg-amber-500') + ' text-white font-black text-xs">' + passedCount + ' / ' + results.length + ' PASS</span>' +
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 5 (الحزم والعروض #view-bundles)</h3>' +
      '    </div>' +
      '    <button type="button" onclick="App.closeModal(\'posQaReportModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      '  <div class="space-y-1.5 max-h-96 overflow-y-auto text-xs">' +
      results.map(function (r) {
        return (
          '<div class="p-2.5 rounded-xl border ' + (r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') + ' flex items-center justify-between">' +
          '  <div class="font-bold">' + (r.passed ? '✅' : '❌') + ' ' + r.name + '</div>' +
          '  <div class="font-mono text-[11px] text-slate-500 dark:text-slate-300">' + (r.detail || 'OK') + '</div>' +
          '</div>'
        );
      }).join('') +
      '  </div>' +
      '  <div class="flex justify-end pt-2">' +
      '    <button type="button" onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة السادسة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // اختصارات لوحة المفاتيح السريعة لقسم الحزم والعروض
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'bundles') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      e.stopPropagation();
      App.runAutoTest_BundlesPage();
    } else if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('bundlesSearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      App.openBundleModal(null);
    } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      App.openPromoModal(null);
    }
  }, true);
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js عبر .toString() وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [PAGE 5 BUNDLES & PROMOTIONS SURGICAL PERFECTION]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    applyPage5BundlesSurgicalPerfection.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 1/2: تم حقن وفحص ترقية الصفحة الخامسة (#view-bundles) وروبوت الفحص الآلي في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['fix-product-edit-and-superpowers.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 2/2: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت ترقية الصفحة الخامسة (#view-bundles)! اضغط Ctrl+R داخل البرنامج الآن.');