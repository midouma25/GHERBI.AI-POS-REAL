/**
 * fix-product-edit-and-superpowers.js
 * 1. إصلاح جذري لدالة App.openProductModal و App.editProductById لملء جميع الحقول والتبويبات الـ 5 فوراً عند الضغط على (تعديل)
 * 2. إصلاح حفظ الأسعار والكميات (cost_price, selling_price, wholesale_price, stock) في inventory_batches عند تعديل المنتج
 * 3. إضافة الميزات الاستشارية الـ 5: التعديل الفوري داخل الجدول (Inline Edit)، وحفظ والانتقال للتالي، واستنساخ المنتج، وترتيب الأولوية، وتنظيف المنتجات الصفرية.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء إصلاح نافذة تعديل المنتج وتفعيل الميزات الاستشارية الـ 5...\n');

// ============================================================================
// 1. ترقية معالج update-product في main.js ليقوم بتحديث الدفعة النشطة (inventory_batches) أيضاً
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  const targetSnippet = `      if (p.extra_barcodes !== undefined || p.extra_prices !== undefined) {
        await productWriter.insertExtraBarcodesAndPrices(
          productId,
          p.extra_barcodes || [],
          p.extra_prices || []
        );
      }

      return { success: true, id: productId };`;

  const upgradedSnippet = `      if (p.extra_barcodes !== undefined || p.extra_prices !== undefined) {
        await productWriter.insertExtraBarcodesAndPrices(
          productId,
          p.extra_barcodes || [],
          p.extra_prices || []
        );
      }

      // تحديث أو إنشاء الدفعة الأساسية في inventory_batches لضمان حفظ الأسعار والكمية والصلاحية
      if (p.cost_price !== undefined || p.selling_price !== undefined || p.stock !== undefined) {
        const primaryBatch = await dbGet(
          'SELECT id FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT 1',
          [productId]
        );
        const cPrice = Number(p.cost_price ?? 0);
        const sPrice = Number(p.selling_price ?? 0);
        const wPrice = p.wholesale_price !== null && p.wholesale_price !== undefined && p.wholesale_price !== '' ? Number(p.wholesale_price) : null;
        const stk = Number(p.stock ?? 0);
        const exp = p.expiry_date || null;
        const loc = p.location || null;

        if (primaryBatch && primaryBatch.id) {
          await dbRun(
            \`UPDATE inventory_batches
             SET cost_price = ?, selling_price = ?, wholesale_price = ?, stock = ?,
                 expiry_date = COALESCE(?, expiry_date), location = COALESCE(?, location)
             WHERE id = ?\`,
            [cPrice, sPrice, wPrice, stk, exp, loc, primaryBatch.id]
          );
        } else {
          await dbRun(
            \`INSERT INTO inventory_batches (product_id, stock, cost_price, selling_price, wholesale_price, expiry_date, location)
             VALUES (?, ?, ?, ?, ?, ?, ?)\`,
            [productId, stk, cPrice, sPrice, wPrice, exp, loc]
          );
        }
      }

      return { success: true, id: productId };`;

  if (mainCode.includes(targetSnippet) && !mainCode.includes('primaryBatch && primaryBatch.id')) {
    mainCode = mainCode.replace(targetSnippet, upgradedSnippet);
    new vm.Script(mainCode, { filename: 'main.js' });
    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('✅ 1/2: تم ترقية update-product في main.js لحفظ الأسعار والكميات في الدفعات تلقائياً.');
  } else {
    console.log('✅ 1/2: معالج update-product في main.js جاهز.');
  }
}

// ============================================================================
// 2. دالة الترقية الشاملة لنافذة التعديل وجدول المخزون (Zero-Escape AST Serialization)
// ============================================================================
function installSmartProductEditAndConsultantSuperpowers() {
  if (!window.App || !window.AppState) return;

  AppState.inventoryStockStatusFilter = 'all';
  AppState.inventoryInlineEditMode = false;
  AppState.currentEditingProductId = null;

  // دالة مساعدة لوضع قيمة داخل حقل بأمان تام
  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  }

  function setChk(id, boolVal) {
    var el = document.getElementById(id);
    if (el) el.checked = Boolean(boolVal);
  }

  // --------------------------------------------------------------------------
  // 1) الدالة الذكية الموحدة لفتح نافذة المنتج (تقبل رقم ID أو كائن منتج أو null)
  // --------------------------------------------------------------------------
  App.editProductById = async function (productId) {
    return await this.openProductModal(Number(productId));
  };

  App.openProductModal = async function (prodOrId) {
    var prod = null;

    // إذا تم تمرير رقم ID (مثلاً 18 أو "18") نجلب المنتج الكامل من قاعدة البيانات ومن الذاكرة
    if (typeof prodOrId === 'number' || (typeof prodOrId === 'string' && /^\d+$/.test(prodOrId.trim()))) {
      var pid = Number(prodOrId);
      var memProd = (AppState.products || []).find(function (x) { return Number(x.id) === pid; }) || null;
      var dbProd = null;
      if (window.api && typeof window.api.getProductFull === 'function') {
        dbProd = await window.api.getProductFull(pid).catch(function () { return null; });
      }
      prod = Object.assign({}, memProd || {}, dbProd || {});
      if (!prod.id) prod.id = pid;
    } else if (prodOrId && typeof prodOrId === 'object') {
      // إذا تم تمرير كائن له id ولكن تنقصه التفاصيل الكاملة نكمله من قاعدة البيانات
      if (prodOrId.id && (!prodOrId.batches || !prodOrId.option_groups) && window.api && typeof window.api.getProductFull === 'function') {
        var full = await window.api.getProductFull(Number(prodOrId.id)).catch(function () { return null; });
        prod = Object.assign({}, prodOrId, full || {});
      } else {
        prod = prodOrId;
      }
    }

    var isEdit = Boolean(prod && prod.id);
    AppState.currentEditingProductId = isEdit ? Number(prod.id) : null;

    // استخراج بيانات الدفعة الأولى في حال كانت الأسعار أو التواريخ محفوظة داخل batches
    var firstBatch = (prod && Array.isArray(prod.batches) && prod.batches[0]) ? prod.batches[0] : {};
    var cost = prod ? Number(prod.cost_price ?? firstBatch.cost_price ?? 0) : 0;
    var sell = prod ? Number(prod.selling_price ?? firstBatch.selling_price ?? 0) : 0;
    var wholesale = prod ? (prod.wholesale_price ?? firstBatch.wholesale_price ?? '') : '';
    var totalStock = prod ? Number(prod.total_stock ?? prod.stock ?? firstBatch.stock ?? 0) : 0;
    var expiryDate = prod ? (prod.expiry_date || prod.next_expiry || firstBatch.expiry_date || '') : '';
    var locationStr = prod ? (prod.location || firstBatch.location || '') : '';

    this.switchProductModalTab('basic');

    // تحديث عنوان النافذة وشريط التنقل والاستنساخ
    var titleEl = document.getElementById('productModalTitle');
    if (titleEl) {
      titleEl.innerHTML = isEdit
        ? '<span class="text-blue-600">✏️ تعديل المنتج:</span> ' + (prod.name || '') + ' <span class="px-2 py-0.5 rounded-lg bg-blue-600/10 text-blue-600 font-mono text-xs">#' + prod.id + '</span>'
        : '<span class="text-emerald-600">➕ إضافة منتج جديد إلى المخزون</span>';
    }

    this.ensureProductModalSuperToolbar(isEdit);

    // تعبئة التبويب 1: البيانات الأساسية
    setVal('prodIdInput', isEdit ? prod.id : '');
    setVal('prodNameInput', prod ? (prod.name || '') : '');
    setVal('prodBarcodeInput', prod ? (prod.barcode || '') : '');
    setVal('prodCategoryInput', prod ? (prod.category || 'عام') : 'عام');
    setVal('prodFamilyInput', prod ? (prod.family || '') : '');
    setVal('prodSupplierInput', prod ? (prod.supplier || '') : '');
    setVal('prodUnitInput', prod ? (prod.unit || 'قطعة') : 'قطعة');
    setVal('prodStockInput', totalStock);
    setVal('prodMinStockInput', prod ? (prod.min_stock ?? 5) : 5);
    setVal('prodExpiryInput', expiryDate ? String(expiryDate).slice(0, 10) : '');
    setVal('prodLocationInput', locationStr);
    setVal('prodPluInput', prod ? (prod.plu_code || '') : '');
    setVal('prodImageDataInput', prod ? (prod.image || '') : '');
    setChk('prodFeaturedCheckbox', prod && Number(prod.is_featured) === 1);

    // تعبئة التبويب 2: الأسعار وهامش الربح
    setVal('prodCostInput', cost);
    setVal('prodPriceInput', sell);
    var markup = (cost > 0 && sell >= cost) ? Number((((sell - cost) / cost) * 100).toFixed(1)) : '';
    setVal('prodMarkupInput', markup);
    setVal('prodWholesaleInput', wholesale !== null && wholesale !== undefined ? wholesale : '');
    setVal('prodWholesaleUnitInput', prod ? (prod.wholesale_unit || '') : '');
    setVal('prodWholesaleQtyInput', prod && prod.wholesale_qty ? prod.wholesale_qty : '');

    // تعبئة التبويب 3 و 4 و 5
    setVal('prodMaterialRoleInput', prod ? (prod.material_role || '') : '');
    setVal('prodWarrantyMonthsInput', prod ? (prod.warranty_months || 0) : 0);
    setChk('prodTrackSerialCheckbox', prod && Number(prod.track_serial) === 1);
    setChk('prodHideFromPosCheckbox', prod && Number(prod.hide_from_pos) === 1);
    setChk('prodHasVariantsCheckbox', prod && Number(prod.has_variants) === 1);

    AppState.tempExtraPrices = (prod && Array.isArray(prod.extra_prices)) ? prod.extra_prices.slice() : [];
    AppState.tempExtraBarcodes = (prod && Array.isArray(prod.extra_barcodes)) ? prod.extra_barcodes.slice() : [];
    AppState.tempVariantsMatrix = (prod && Array.isArray(prod.variants)) ? prod.variants.slice() : [];

    if (prod && Array.isArray(prod.option_groups) && prod.option_groups.length > 0) {
      AppState.tempOptionGroups = prod.option_groups.map(function (g) {
        return {
          id: g.id,
          name: g.name,
          valuesStr: Array.isArray(g.values)
            ? g.values.map(function (v) { return typeof v === 'object' ? v.value : v; }).join(', ')
            : ''
        };
      });
    } else {
      AppState.tempOptionGroups = [];
    }

    if (typeof this.renderExtraPricesInModal === 'function') this.renderExtraPricesInModal();
    if (typeof this.renderExtraBarcodesInModal === 'function') this.renderExtraBarcodesInModal();
    if (typeof this.renderVariantsMatrixInModal === 'function') this.renderVariantsMatrixInModal();
    if (typeof this.renderOptionGroupsInModal === 'function') this.renderOptionGroupsInModal();

    this.updateLiveProfitBannerInModal();
    this.openModal('productModal');

    setTimeout(function () {
      var nameInp = document.getElementById('prodNameInput');
      if (nameInp) nameInp.focus();
    }, 60);
  };

  // --------------------------------------------------------------------------
  // 2) شريط الأدوات الاستشاري داخل نافذة التعديل (التنقل بين المنتجات + الاستنساخ + حاسبة الربح)
  // --------------------------------------------------------------------------
  App.ensureProductModalSuperToolbar = function (isEdit) {
    var modalContent = document.querySelector('#productModal .modal-content');
    if (!modalContent) return;

    var navBar = document.getElementById('prodModalConsultantBar');
    if (!navBar) {
      navBar = document.createElement('div');
      navBar.id = 'prodModalConsultantBar';
      var firstChild = modalContent.firstElementChild;
      if (firstChild && firstChild.nextSibling) {
        modalContent.insertBefore(navBar, firstChild.nextSibling);
      } else {
        modalContent.prepend(navBar);
      }
    }

    if (!isEdit) {
      navBar.className = 'hidden';
    } else {
      navBar.className = 'flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs';
      navBar.innerHTML =
        '<div class="flex items-center gap-1.5">' +
        '  <button type="button" onclick="App.navigateEditProduct(-1)" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white transition">⏮️ المنتج السابق</button>' +
        '  <button type="button" onclick="App.navigateEditProduct(1)" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white transition">المنتج التالي ⏭️</button>' +
        '</div>' +
        '<div class="flex items-center gap-1.5">' +
        '  <button type="button" onclick="App.duplicateCurrentProductInModal()" class="px-3 py-1 rounded-lg bg-indigo-600/15 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold transition">📋 استنساخ كمنتج جديد</button>' +
        '  <button type="button" onclick="App.saveAndEditNextProduct()" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm transition">💾 حفظ والانتقال للتالي ⏭️</button>' +
        '</div>';
    }

    // إضافة شريط صافي الربح وأزرار النسب السريعة داخل تبويب الأسعار
    var pricingTab = document.getElementById('prodTabContent-pricing');
    if (pricingTab && !document.getElementById('prodLiveProfitBanner')) {
      var banner = document.createElement('div');
      banner.id = 'prodLiveProfitBanner';
      banner.className = 'p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs';
      pricingTab.prepend(banner);

      ['prodCostInput', 'prodPriceInput', 'prodMarkupInput', 'prodWholesaleInput'].forEach(function (inpId) {
        var el = document.getElementById(inpId);
        if (el) {
          el.addEventListener('input', function () {
            App.updateLiveProfitBannerInModal();
          });
        }
      });
    }
  };

  App.updateLiveProfitBannerInModal = function () {
    var banner = document.getElementById('prodLiveProfitBanner');
    if (!banner) return;
    var cost = parseFloat(document.getElementById('prodCostInput')?.value) || 0;
    var sell = parseFloat(document.getElementById('prodPriceInput')?.value) || 0;
    var profit = Number((sell - cost).toFixed(2));
    var marginPct = cost > 0 ? Number((((sell - cost) / cost) * 100).toFixed(1)) : 0;
    var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(sell) : '';

    banner.innerHTML =
      '<div>' +
      '  <span class="font-bold text-slate-500">صافي الربح للوحدة: </span>' +
      '  <strong class="font-mono text-sm ' + (profit >= 0 ? 'text-emerald-600' : 'text-rose-600') + '">' + (profit >= 0 ? '+' : '') + profit.toFixed(2) + ' د.ج (' + marginPct + '%)</strong>' +
      '  <span class="mx-2 text-slate-300">|</span>' +
      '  <span class="font-bold text-amber-600">سعر البيع بالسنتيم: ' + centimes + '</span>' +
      '</div>' +
      '<div class="flex items-center gap-1">' +
      '  <span class="text-[11px] text-slate-400 font-bold ml-1">هامش سريع:</span>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(15)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+15%</button>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(20)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+20%</button>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(25)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+25%</button>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(35)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+35%</button>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(50)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+50%</button>' +
      '</div>';
  };

  App.applyQuickMarkupPct = function (pct) {
    var costInp = document.getElementById('prodCostInput');
    var markupInp = document.getElementById('prodMarkupInput');
    var priceInp = document.getElementById('prodPriceInput');
    var cost = parseFloat(costInp ? costInp.value : '0') || 0;
    if (markupInp) markupInp.value = String(pct);
    if (cost > 0 && priceInp) {
      priceInp.value = String(Math.round(cost * (1 + pct / 100)));
    }
    this.updateLiveProfitBannerInModal();
  };

  App.duplicateCurrentProductInModal = function () {
    setVal('prodIdInput', '');
    AppState.currentEditingProductId = null;
    var curName = document.getElementById('prodNameInput')?.value || '';
    setVal('prodNameInput', curName + ' (نسخة)');
    this.generateRandomBarcode();
    var titleEl = document.getElementById('productModalTitle');
    if (titleEl) {
      titleEl.innerHTML = '<span class="text-indigo-600">📋 استنساخ منتج جديد — عدّل الاسم أو السعر ثم اضغط حفظ</span>';
    }
    if (typeof showToast === 'function') {
      showToast('📋 تم تحويل النافذة لنسخة جديدة بوليد باركود جديد — اضغط حفظ لإضافتها!', 'info');
    }
  };

  App.navigateEditProduct = async function (direction) {
    var list = AppState._lastRenderedInventoryList || AppState.products || [];
    if (list.length === 0) return;
    var curId = Number(document.getElementById('prodIdInput')?.value || AppState.currentEditingProductId || 0);
    var idx = list.findIndex(function (p) { return Number(p.id) === curId; });
    var nextIdx = idx === -1 ? 0 : (idx + direction + list.length) % list.length;
    var target = list[nextIdx];
    if (target && target.id) {
      await this.openProductModal(target.id);
    }
  };

  App.saveAndEditNextProduct = async function () {
    var list = AppState._lastRenderedInventoryList || AppState.products || [];
    var curId = Number(document.getElementById('prodIdInput')?.value || AppState.currentEditingProductId || 0);
    var idx = list.findIndex(function (p) { return Number(p.id) === curId; });
    var nextProd = (idx !== -1 && idx + 1 < list.length) ? list[idx + 1] : null;

    await this.saveProductFromModal(true);
    if (nextProd && nextProd.id) {
      await this.openProductModal(nextProd.id);
    }
  };

  // --------------------------------------------------------------------------
  // 3) حفظ بيانات المنتج وتحديث الدفعات (inventory_batches) والمتغيرات بأمان تام
  // --------------------------------------------------------------------------
  App.saveProductFromModal = async function (keepModalOpen) {
    var idVal = document.getElementById('prodIdInput')?.value;
    var id = idVal ? Number(idVal) : null;

    var payload = {
      name: String(document.getElementById('prodNameInput')?.value || '').trim(),
      barcode: String(document.getElementById('prodBarcodeInput')?.value || '').trim() || null,
      category: String(document.getElementById('prodCategoryInput')?.value || 'عام').trim() || 'عام',
      family: String(document.getElementById('prodFamilyInput')?.value || '').trim() || null,
      supplier: String(document.getElementById('prodSupplierInput')?.value || '').trim() || null,
      unit: String(document.getElementById('prodUnitInput')?.value || 'قطعة').trim() || 'قطعة',
      cost_price: parseFloat(document.getElementById('prodCostInput')?.value) || 0,
      selling_price: parseFloat(document.getElementById('prodPriceInput')?.value) || 0,
      wholesale_price: document.getElementById('prodWholesaleInput')?.value !== '' ? parseFloat(document.getElementById('prodWholesaleInput')?.value) : null,
      wholesale_unit: String(document.getElementById('prodWholesaleUnitInput')?.value || '').trim() || null,
      wholesale_qty: parseInt(document.getElementById('prodWholesaleQtyInput')?.value || '0', 10) || null,
      stock: parseFloat(document.getElementById('prodStockInput')?.value) || 0,
      min_stock: parseInt(document.getElementById('prodMinStockInput')?.value || '5', 10) || 5,
      expiry_date: document.getElementById('prodExpiryInput')?.value || null,
      location: String(document.getElementById('prodLocationInput')?.value || '').trim() || null,
      plu_code: String(document.getElementById('prodPluInput')?.value || '').trim() || null,
      image: document.getElementById('prodImageDataInput')?.value || null,
      is_featured: document.getElementById('prodFeaturedCheckbox')?.checked ? 1 : 0,
      material_role: document.getElementById('prodMaterialRoleInput')?.value || null,
      warranty_months: parseInt(document.getElementById('prodWarrantyMonthsInput')?.value || '0', 10) || 0,
      track_serial: document.getElementById('prodTrackSerialCheckbox')?.checked ? 1 : 0,
      hide_from_pos: document.getElementById('prodHideFromPosCheckbox')?.checked ? 1 : 0,
      has_variants: document.getElementById('prodHasVariantsCheckbox')?.checked ? 1 : 0,
      extra_prices: AppState.tempExtraPrices || [],
      extra_barcodes: AppState.tempExtraBarcodes || [],
      variants: AppState.tempVariantsMatrix || []
    };

    if (!payload.name) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم المنتج أولاً', 'error');
      return;
    }

    var savedId = id;
    if (id) {
      await window.api.updateProduct(id, payload);
      // ضمان تحديث الدفعة الأولى في inventory_batches مباشرة عبر جسر الدفعات أيضاً
      var fullProd = await window.api.getProductFull(id).catch(function () { return null; });
      var batches = (fullProd && Array.isArray(fullProd.batches)) ? fullProd.batches : [];
      if (batches.length > 0 && window.api.updateBatch) {
        await window.api.updateBatch(batches[0].id, {
          stock: batches.length === 1 ? payload.stock : batches[0].stock,
          cost_price: payload.cost_price,
          selling_price: payload.selling_price,
          wholesale_price: payload.wholesale_price,
          expiry_date: payload.expiry_date || batches[0].expiry_date || null,
          location: payload.location || batches[0].location || null
        });
      } else if (batches.length === 0 && window.api.addBatch) {
        await window.api.addBatch(id, {
          stock: payload.stock,
          cost_price: payload.cost_price,
          selling_price: payload.selling_price,
          wholesale_price: payload.wholesale_price,
          expiry_date: payload.expiry_date
        });
      }
    } else {
      var res = await window.api.addProduct(payload);
      savedId = res && res.id ? Number(res.id) : null;
    }

    var optionGroupsPayload = (AppState.tempOptionGroups || [])
      .map(function (g, idx) {
        return {
          name: String(g.name || '').trim(),
          position: idx,
          values: String(g.valuesStr || '').split(/[,،]/).map(function (x) { return x.trim(); }).filter(Boolean)
        };
      })
      .filter(function (g) { return g.name && g.values.length > 0; });

    if (savedId && (optionGroupsPayload.length > 0 || (payload.variants && payload.variants.length > 0)) && window.api.saveProductVariants) {
      await window.api.saveProductVariants(savedId, {
        has_variants: payload.has_variants,
        option_groups: optionGroupsPayload,
        variants: payload.variants
      }).catch(function () {});
    }

    if (!keepModalOpen) {
      this.closeModal('productModal');
    }
    await this.refreshProducts();
    if (AppState.currentView === 'inventory') await this.renderInventoryView();
    else this.renderPosView();

    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ وتحديث بيانات المنتج (' + payload.name + ') بنجاح!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 4) التعديل الفوري داخل الجدول (Inline Quick-Edit) + حذف المنتج + تنظيف الصفرية
  // --------------------------------------------------------------------------
  App.toggleInventoryInlineEdit = function () {
    AppState.inventoryInlineEditMode = !AppState.inventoryInlineEditMode;
    this.renderInventoryView();
    if (typeof showToast === 'function') {
      showToast(
        AppState.inventoryInlineEditMode
          ? '⚡ تم تفعيل وضع التسعير والرصيد الفوري داخل الجدول — عدّل أي رقم واضغط Enter!'
          : 'تم إيقاف وضع التعديل الفوري داخل الجدول',
        'info'
      );
    }
  };

  App.saveInlineProductRow = async function (productId) {
    var pid = Number(productId);
    var p = (AppState.products || []).find(function (x) { return Number(x.id) === pid; });
    if (!p) return;

    var newCost = parseFloat(document.getElementById('inl-cost-' + pid)?.value) || 0;
    var newSell = parseFloat(document.getElementById('inl-sell-' + pid)?.value) || 0;
    var newWhlRaw = document.getElementById('inl-whl-' + pid)?.value;
    var newWhl = newWhlRaw !== '' && newWhlRaw !== undefined ? parseFloat(newWhlRaw) : null;
    var newStk = parseFloat(document.getElementById('inl-stk-' + pid)?.value) || 0;

    var fullProd = await window.api.getProductFull(pid).catch(function () { return null; });
    var batches = (fullProd && Array.isArray(fullProd.batches)) ? fullProd.batches : [];
    if (batches.length > 0 && window.api.updateBatch) {
      await window.api.updateBatch(batches[0].id, {
        stock: newStk,
        cost_price: newCost,
        selling_price: newSell,
        wholesale_price: newWhl,
        expiry_date: batches[0].expiry_date || null
      });
    } else if (window.api.addBatch) {
      await window.api.addBatch(pid, {
        stock: newStk,
        cost_price: newCost,
        selling_price: newSell,
        wholesale_price: newWhl
      });
    }

    await this.refreshProducts();
    var rowEl = document.getElementById('inv-row-' + pid);
    if (rowEl) {
      rowEl.classList.add('bg-emerald-500/20');
      setTimeout(function () { rowEl.classList.remove('bg-emerald-500/20'); }, 600);
    }
    if (typeof showToast === 'function') {
      showToast('⚡ تم تحديث (' + p.name + ') فوراً: بيع ' + newSell.toFixed(2) + ' د.ج | رصيد ' + newStk, 'success');
    }
  };

  App.deleteProductById = async function (productId) {
    var pid = Number(productId);
    if (!pid) return;
    await window.api.deleteProduct(pid);
    await this.refreshProducts();
    await this.renderInventoryView();
    if (typeof showToast === 'function') showToast('🗑️ تم حذف المنتج من المخزون', 'info');
  };
  App.deleteProduct = App.deleteProductById;

  App.cleanZeroPriceEmptyProducts = async function () {
    var zeroProds = (AppState.products || []).filter(function (p) {
      var stk = Number(p.total_stock ?? p.stock ?? 0);
      var sell = Number(p.selling_price ?? 0);
      var cost = Number(p.cost_price ?? 0);
      return stk <= 0 && sell <= 0 && cost <= 0;
    });

    if (zeroProds.length === 0) {
      if (typeof showToast === 'function') showToast('لا توجد منتجات صفرية (0 د.ج و 0 رصيد) لتنظيفها', 'info');
      return;
    }

    if (typeof showToast === 'function') {
      showToast('🧹 جاري تنظيف ' + zeroProds.length + ' منتج صفري من الجدول (ستبقى محفوظة في القاموس الجزائري 613)...', 'info');
    }

    for (var i = 0; i < zeroProds.length; i++) {
      await window.api.deleteProduct(zeroProds[i].id);
    }

    await this.refreshProducts();
    AppState.inventoryStockStatusFilter = 'all';
    await this.renderInventoryView();
    if (typeof showToast === 'function') {
      showToast('✅ تم تنظيف ' + zeroProds.length + ' منتج صفري بنجاح! بقيت منتجات متجرك الحقيقية فقط.', 'success');
    }
  };

  App.setInventoryStockFilter = function (statusKey) {
    AppState.inventoryStockStatusFilter = statusKey || 'all';
    this.renderInventoryView();
  };

  // --------------------------------------------------------------------------
  // 5) ترقية عرض جدول المخزون مع الترتيب الذكي (المنتجات المسعرة أولاً) والتعديل المباشر
  // --------------------------------------------------------------------------
  App.renderInventoryView = async function () {
    var root = document.getElementById('inventory-view-root');
    if (!root) return;

    var rawProds = (AppState.products || []).slice();

    // ترتيب ذكي: المنتجات التي لها رصيد أو سعر بيع > 0 تظهر في أعلى الجدول دائماً!
    rawProds.sort(function (a, b) {
      var aActive = (Number(a.selling_price || 0) > 0 || Number(a.total_stock ?? a.stock ?? 0) > 0) ? 1 : 0;
      var bActive = (Number(b.selling_price || 0) > 0 || Number(b.total_stock ?? b.stock ?? 0) > 0) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    var emptyStockCnt = 0;
    var lowStockCnt = 0;
    var expiredCnt = 0;
    var zeroPriceEmptyCnt = 0;
    var nowMs = Date.now();

    rawProds.forEach(function (p) {
      var stock = Number(p.total_stock ?? p.stock ?? 0);
      var minStock = Number(p.min_stock ?? 5);
      var sell = Number(p.selling_price ?? 0);
      var cost = Number(p.cost_price ?? 0);

      if (stock <= 0) emptyStockCnt++;
      else if (stock <= minStock) lowStockCnt++;
      if (stock <= 0 && sell <= 0 && cost <= 0) zeroPriceEmptyCnt++;

      if (Array.isArray(p.batches)) {
        var hasExp = p.batches.some(function (b) {
          return Number(b.stock) > 0 && b.expiry_date && new Date(b.expiry_date).getTime() <= nowMs;
        });
        if (hasExp) expiredCnt++;
      }
    });

    var filtered = rawProds;

    if (AppState.inventoryRoleFilter && AppState.inventoryRoleFilter !== 'all') {
      if (AppState.inventoryRoleFilter === 'commercial') {
        filtered = filtered.filter(function (p) { return !p.material_role; });
      } else {
        filtered = filtered.filter(function (p) { return p.material_role === AppState.inventoryRoleFilter; });
      }
    }

    var stFilter = AppState.inventoryStockStatusFilter || 'all';
    if (stFilter === 'available') {
      filtered = filtered.filter(function (p) { return Number(p.total_stock ?? p.stock ?? 0) > 0; });
    } else if (stFilter === 'low') {
      filtered = filtered.filter(function (p) {
        var s = Number(p.total_stock ?? p.stock ?? 0);
        return s > 0 && s <= Number(p.min_stock ?? 5);
      });
    } else if (stFilter === 'empty') {
      filtered = filtered.filter(function (p) { return Number(p.total_stock ?? p.stock ?? 0) <= 0; });
    } else if (stFilter === 'expired') {
      filtered = filtered.filter(function (p) {
        return Array.isArray(p.batches) && p.batches.some(function (b) {
          return Number(b.stock) > 0 && b.expiry_date && new Date(b.expiry_date).getTime() <= nowMs;
        });
      });
    }

    var q = String(AppState.inventorySearchQuery || '').toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(function (p) {
        return (
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q) ||
          String(p.category || '').toLowerCase().includes(q)
        );
      });
    }

    var displayedProds = filtered.slice(0, 300);
    AppState._lastRenderedInventoryList = displayedProds;
    var isInline = Boolean(AppState.inventoryInlineEditMode);

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex items-center gap-2">' +
      '        <span>إدارة المخزون، الدفعات، والمتغيرات (' + filtered.length + ' منتج)</span>' +
      '        <button id="btnInventoryPageQaBot" type="button" onclick="App.runAutoTest_InventoryPage()" title="تشغيل الفحص الآلي الذاتي لصفحة المخزون (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">المنتجات المسعّرة والمتوفرة تظهر في الصدارة تلقائياً — اضغط على اسم أي منتج أو زر (تعديل) لفتح بطاقته الكاملة</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      '      <button type="button" onclick="App.toggleInventoryInlineEdit()" class="px-3.5 py-2 rounded-xl font-black transition shadow-sm ' + (isInline ? 'bg-amber-500 text-slate-950' : 'bg-indigo-600/15 text-indigo-600 hover:bg-indigo-600 hover:text-white') + '">⚡ ' + (isInline ? 'إغلاق التعديل السريع بالجدول' : 'تسعير وتعديل سريع بالجدول') + '</button>' +
      (zeroPriceEmptyCnt > 0
        ? '<button type="button" onclick="App.cleanZeroPriceEmptyProducts()" class="px-3 py-2 rounded-xl bg-rose-600/15 text-rose-600 hover:bg-rose-600 hover:text-white font-bold transition" title="حذف المنتجات المستوردة بسعر 0 ورصيد 0 من الجدول مع إبقائها في القاموس">🧹 تنظيف الصفرية (' + zeroPriceEmptyCnt + ')</button>'
        : '') +
      '      <button type="button" onclick="App.importDzMasterCsv()" class="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500 hover:text-slate-950 transition">🇩🇿 استيراد قاموس 613 (CSV)</button>' +
      '      <button type="button" onclick="App.openStockDebtModal()" class="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-600 font-bold hover:bg-rose-500 hover:text-white transition">ديون المخزون</button>' +
      '      <button type="button" onclick="App.downloadInventoryTemplate()" class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">قالب Excel</button>' +
      '      <button type="button" onclick="App.importProductsExcel()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded icon-sm">upload_file</span><span>استيراد Excel / CSV</span></button>' +
      '      <button type="button" onclick="App.exportInventoryExcel()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded icon-sm">download</span><span>تصدير Excel</span></button>' +
      '      <button type="button" onclick="App.openProductModal(null)" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center gap-1 shadow-lg shadow-blue-600/25">+ منتج جديد (Alt+N)</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="grid grid-cols-2 md:grid-cols-5 gap-3">' +
      '    <div onclick="App.setInventoryStockFilter(\'all\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">' +
      '      <div class="text-xs font-bold opacity-85">جميع المنتجات</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + rawProds.length + '</div>' +
      '    </div>' +
      '    <div onclick="App.setInventoryStockFilter(\'available\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'available' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 border border-emerald-500/30') + '">' +
      '      <div class="text-xs font-bold ' + (stFilter === 'available' ? 'text-white' : 'text-slate-400') + '">متوفرة في المخزون (> 0)</div>' +
      '      <div class="text-2xl font-black font-mono ' + (stFilter === 'available' ? 'text-white' : 'text-emerald-600') + ' mt-1">' + Math.max(0, rawProds.length - emptyStockCnt) + '</div>' +
      '    </div>' +
      '    <div onclick="App.setInventoryStockFilter(\'low\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'low' ? 'bg-amber-500 text-slate-950' : 'bg-white dark:bg-slate-800 border border-amber-500/30') + '">' +
      '      <div class="text-xs font-bold ' + (stFilter === 'low' ? 'text-slate-950' : 'text-slate-400') + '">منخفضة المخزون</div>' +
      '      <div class="text-2xl font-black font-mono ' + (stFilter === 'low' ? 'text-slate-950' : 'text-amber-500') + ' mt-1">' + lowStockCnt + '</div>' +
      '    </div>' +
      '    <div onclick="App.setInventoryStockFilter(\'empty\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'empty' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-slate-800 border border-rose-500/30') + '">' +
      '      <div class="text-xs font-bold ' + (stFilter === 'empty' ? 'text-white' : 'text-slate-400') + '">نافدة (الرصيد <= 0)</div>' +
      '      <div class="text-2xl font-black font-mono ' + (stFilter === 'empty' ? 'text-white' : 'text-rose-500') + ' mt-1">' + emptyStockCnt + '</div>' +
      '    </div>' +
      '    <div onclick="App.setInventoryStockFilter(\'expired\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'expired' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 border border-purple-500/30') + '">' +
      '      <div class="text-xs font-bold ' + (stFilter === 'expired' ? 'text-white' : 'text-slate-400') + '">منتهية الصلاحية</div>' +
      '      <div class="text-2xl font-black font-mono ' + (stFilter === 'expired' ? 'text-white' : 'text-purple-600') + ' mt-1">' + expiredCnt + '</div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">' +
      '    <div class="flex flex-wrap items-center gap-2 mb-4">' +
      '      <div class="relative flex-1 min-w-[220px]">' +
      '        <span class="material-symbols-rounded icon-sm absolute right-3 top-2.5 text-slate-400">search</span>' +
      '        <input id="inventorySearchInput" type="text" value="' + (AppState.inventorySearchQuery || '') + '" oninput="App.onInventorySearch(this.value)" placeholder="🔍 [F4] ابحث بالاسم أو الباركود أو الفئة..." class="w-full pr-9 pl-3 py-2 rounded-xl text-xs font-bold">' +
      '      </div>' +
      '      <select onchange="AppState.inventoryRoleFilter=this.value; App.renderInventoryView()" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">' +
      '        <option value="all" ' + (AppState.inventoryRoleFilter === 'all' ? 'selected' : '') + '>الكل (تجاري + تصنيع)</option>' +
      '        <option value="commercial" ' + (AppState.inventoryRoleFilter === 'commercial' ? 'selected' : '') + '>المنتجات التجارية العادية</option>' +
      '        <option value="raw_material" ' + (AppState.inventoryRoleFilter === 'raw_material' ? 'selected' : '') + '>المواد الأولية للتصنيع</option>' +
      '        <option value="finished_good" ' + (AppState.inventoryRoleFilter === 'finished_good' ? 'selected' : '') + '>المنتجات المصنعة النهائية</option>' +
      '      </select>' +
      '    </div>' +

      '    <div class="overflow-x-auto max-h-[58vh]">' +
      '      <table class="w-full text-xs text-right">' +
      '        <thead class="sticky top-0 bg-white dark:bg-slate-800 z-10">' +
      '          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '            <th class="py-2.5 px-2">الباركود</th>' +
      '            <th class="py-2.5 px-2">المنتج</th>' +
      '            <th class="py-2.5 px-2">الفئة</th>' +
      '            <th class="py-2.5 px-2">سعر الشراء</th>' +
      '            <th class="py-2.5 px-2">سعر البيع</th>' +
      '            <th class="py-2.5 px-2">سعر الجملة</th>' +
      '            <th class="py-2.5 px-2">الرصيد الكلي</th>' +
      '            <th class="py-2.5 px-2 text-center">إجراءات سريعة</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (displayedProds.length > 0
        ? displayedProds.map(function (p) {
            var stock = Number(p.total_stock ?? p.stock ?? 0);
            var isLow = stock > 0 && stock <= Number(p.min_stock ?? 5);
            var batchCnt = Array.isArray(p.batches) ? p.batches.length : 1;
            var costVal = Number(p.cost_price || 0);
            var sellVal = Number(p.selling_price || 0);
            var whlVal = p.wholesale_price ? Number(p.wholesale_price) : '';

            return (
              '<tr id="inv-row-' + p.id + '" class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5 px-2 font-mono font-bold text-slate-400">' + (p.barcode || '—') + '</td>' +
              '  <td class="py-2.5 px-2 font-bold cursor-pointer text-slate-800 dark:text-slate-100 hover:text-blue-600" onclick="App.editProductById(' + p.id + ')">' + p.name + '</td>' +
              '  <td class="py-2.5 px-2 text-slate-500">' + (p.category || 'عام') + '</td>' +
              (isInline
                ? '  <td class="py-1.5 px-1"><input id="inl-cost-' + p.id + '" type="number" step="any" value="' + costVal + '" onkeydown="if(event.key===\'Enter\') App.saveInlineProductRow(' + p.id + ')" class="w-20 px-2 py-1 rounded-lg font-mono font-bold text-center border-blue-400"></td>' +
                  '  <td class="py-1.5 px-1"><input id="inl-sell-' + p.id + '" type="number" step="any" value="' + sellVal + '" onkeydown="if(event.key===\'Enter\') App.saveInlineProductRow(' + p.id + ')" class="w-20 px-2 py-1 rounded-lg font-mono font-black text-blue-600 text-center border-blue-500"></td>' +
                  '  <td class="py-1.5 px-1"><input id="inl-whl-' + p.id + '" type="number" step="any" value="' + whlVal + '" placeholder="—" onkeydown="if(event.key===\'Enter\') App.saveInlineProductRow(' + p.id + ')" class="w-20 px-2 py-1 rounded-lg font-mono text-center"></td>' +
                  '  <td class="py-1.5 px-1"><input id="inl-stk-' + p.id + '" type="number" step="any" value="' + stock + '" onkeydown="if(event.key===\'Enter\') App.saveInlineProductRow(' + p.id + ')" class="w-20 px-2 py-1 rounded-lg font-mono font-black text-emerald-600 text-center border-emerald-500"></td>'
                : '  <td class="py-2.5 px-2 font-mono" ondblclick="App.toggleInventoryInlineEdit()" title="نقر مزدوج للتعديل المباشر">' + costVal.toFixed(2) + '</td>' +
                  '  <td class="py-2.5 px-2 font-mono font-black text-blue-600" ondblclick="App.toggleInventoryInlineEdit()" title="نقر مزدوج للتعديل المباشر">' + sellVal.toFixed(2) + '</td>' +
                  '  <td class="py-2.5 px-2 font-mono text-slate-500">' + (whlVal !== '' ? Number(whlVal).toFixed(2) : '—') + '</td>' +
                  '  <td class="py-2.5 px-2 font-mono font-black ' + (stock <= 0 ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-600') + '" ondblclick="App.toggleInventoryInlineEdit()">' + stock + ' ' + (p.unit || 'قطعة') + '</td>') +
              '  <td class="py-2.5 px-2 flex flex-wrap items-center justify-center gap-1">' +
              (isInline
                ? '    <button type="button" onclick="App.saveInlineProductRow(' + p.id + ')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[11px] shadow-sm">💾 حفظ</button>'
                : '') +
              '    <button type="button" onclick="App.editProductById(' + p.id + ')" class="px-2.5 py-1 bg-blue-600/15 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-[11px] transition">تعديل</button>' +
              '    <button type="button" onclick="App.openBatchesModal(' + p.id + ')" class="px-2 py-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg font-bold text-[11px] transition">الدفعات (' + batchCnt + ')</button>' +
              '    <button type="button" onclick="App.openProductAnalyticsModal(' + p.id + ')" class="px-2 py-1 bg-indigo-500/15 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-[11px] transition">ربحية</button>' +
              '    <button type="button" onclick="App.quickPrintLabel(' + p.id + ')" class="px-2 py-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 rounded-lg font-bold text-[11px] transition">🏷️ باركود</button>' +
              '    <button type="button" onclick="App.deleteProductById(' + p.id + ')" class="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
              '  </td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="8" class="py-10 text-center text-slate-400 font-bold">لا توجد منتجات مطابقة للبحث</td></tr>') +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };
}

const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [SMART PRODUCT EDIT & CONSULTANT SUPERPOWERS]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installSmartProductEditAndConsultantSuperpowers.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/2: تم حقن وفحص نظام التعديل الذكي للمنتج والميزات الـ 5 في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['fix-all-excel-buttons.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 اكتمل الإصلاح والترقية! اضغط Ctrl+R داخل البرنامج الآن وجرّب زر (تعديل) أو (⚡ تسعير وتعديل سريع بالجدول).');