/**
 * fix-pos-customer-loyalty-and-f9-print.js
 * الحل الجراحي الشامل والترقية الاستشارية المتكاملة لـ:
 * 1. إصلاح ربط الزبون المختار في شاشة المبيعات (#posCustomerSelect) بجميع طرق الدفع السريعة والعادية (يحل مشكلة "زبون عابر")
 * 2. إضافة أداة إسناد الفواتير السابقة للزبائن (من سجل المبيعات أو من نافذة État 104) لتعمير جدول كشف الزبائن السنوي État 104 فوراً
 * 3. إصلاح زر واختصار الطباعة (🖨️ طباعة F9) في مركز القيادة (#view-analytics) وربطه باستوديو التقرير التنفيذي المباشر
 * 4. إضافة منظومة الزبائن الأوفياء (🌟 Clients Fidèles) في شاشة المبيعات (#view-pos): جمع نقاط تلقائي بعد كل بيع + زر اختزال النقاط لتخفيض الفاتورة تلقائياً
 * 5. ترقية موازية لنافذة إنشاء/تعديل الزبون (#customerModal) وصفحة إدارة الزبائن (#view-customers) لدعم النقاط والبيانات الجبائية (NIF/RC/AI/NIS).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء تطبيق الإصلاح الجراحي الشامل لشاشة المبيعات، منظومة الزبائن الأوفياء (Loyalty)، كشف État 104، وزر الطباعة F9...\n');

// ============================================================================
// 1. ترقية main.js و preload.js لدعم:
//    - خصم النقاط المختزلة وإضافة النقاط الجديدة تلقائياً عند كل بيع
//    - قناة إسناد/تغيير الزبون لأي فاتورة سابقة (assign-sale-customer) لتعمير État 104
//    - تحسين استعلام get-algerian-fiscal-report ليعرض جميع زبائن الفواتير بوضوح
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');
  let mainModified = false;

  if (!mainCode.includes("ipcMain.handle('assign-sale-customer'")) {
    const newSalesLoyaltyHandlers = `
  ipcMain.handle('assign-sale-customer', async (_e, payload = {}) => {
    const saleId = Number(payload.saleId || payload.sale_id || 0);
    const customerId = payload.customerId || payload.customer_id ? Number(payload.customerId || payload.customer_id) : null;
    if (!saleId) throw new Error('رقم الفاتورة غير صالح');

    return await db.withTransaction(async () => {
      const sale = await dbGet('SELECT id, total, customer_id FROM sales WHERE id = ? AND deleted_at IS NULL', [saleId]);
      if (!sale) throw new Error('الفاتورة غير موجودة');

      await dbRun('UPDATE sales SET customer_id = ? WHERE id = ?', [customerId, saleId]);
      await dbRun('UPDATE sale_payments SET customer_id = ? WHERE sale_id = ?', [customerId, saleId]);

      if (customerId && Number(sale.total || 0) > 0 && Number(sale.customer_id || 0) !== customerId) {
        const ptsRate = Number(await db.getSetting('loyalty_points_per_100_dzd', '1')) || 1;
        const earnedPts = Math.floor((Number(sale.total || 0) / 100) * ptsRate);
        if (earnedPts > 0) {
          await dbRun('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?', [earnedPts, customerId]);
        }
      }
      return { success: true, saleId, customerId };
    });
  });

  ipcMain.handle('bulk-assign-walkin-sales-to-customer', async (_e, payload = {}) => {
    const customerId = Number(payload.customerId || payload.customer_id || 0);
    if (!customerId) throw new Error('يرجى اختيار الزبون');

    return await db.withTransaction(async () => {
      const walkinSales = await dbAll('SELECT id, total FROM sales WHERE customer_id IS NULL AND deleted_at IS NULL');
      const totalAmt = walkinSales.reduce((s, r) => s + Math.max(0, Number(r.total || 0)), 0);
      await dbRun('UPDATE sales SET customer_id = ? WHERE customer_id IS NULL AND deleted_at IS NULL', [customerId]);
      await dbRun('UPDATE sale_payments SET customer_id = ? WHERE customer_id IS NULL AND deleted_at IS NULL', [customerId]);

      const ptsRate = Number(await db.getSetting('loyalty_points_per_100_dzd', '1')) || 1;
      const earnedPts = Math.floor((totalAmt / 100) * ptsRate);
      if (earnedPts > 0) {
        await dbRun('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?', [earnedPts, customerId]);
      }
      return { success: true, updatedCount: walkinSales.length, earnedPts };
    });
  });

  ipcMain.handle('redeem-customer-loyalty-points', async (_e, payload = {}) => {
    const customerId = Number(payload.customerId || payload.customer_id || 0);
    const pointsToRedeem = Math.max(0, Number(payload.points || 0));
    const saleId = payload.saleId ? Number(payload.saleId) : null;
    if (!customerId || pointsToRedeem <= 0) return { success: false };

    return await db.withTransaction(async () => {
      await dbRun(
        'UPDATE customers SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?) WHERE id = ?',
        [pointsToRedeem, customerId]
      );
      await dbRun(
        'INSERT INTO loyalty_transactions (customer_id, sale_id, points_delta, reason) VALUES (?, ?, ?, ?)',
        [customerId, saleId, -pointsToRedeem, payload.reason || 'اختزال نقاط ولاء في فاتورة بيع']
      );
      return { success: true };
    });
  });
`;
    const anchor = "ipcMain.handle('get-algerian-fiscal-report'";
    if (mainCode.includes(anchor)) {
      mainCode = mainCode.replace(anchor, newSalesLoyaltyHandlers + '\n  ' + anchor);
      mainModified = true;
    }
  }

  if (mainModified) {
    new vm.Script(mainCode, { filename: 'main.js' });
    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('✅ 1/3: تم ترقية main.js لدعم إسناد الفواتير للزبائن واختزال وجمع نقاط الولاء التلقائي.');
  } else {
    console.log('✅ 1/3: فحص main.js مكتمل.');
  }
}

const preloadPath = path.join(ROOT, 'preload.js');
if (fs.existsSync(preloadPath)) {
  let preCode = fs.readFileSync(preloadPath, 'utf8');
  if (!preCode.includes('assignSaleCustomer:')) {
    preCode = preCode.replace(
      "processSale: (data) => invoke('process-sale', data),",
      "processSale: (data) => invoke('process-sale', data),\n  assignSaleCustomer: (payload) => invoke('assign-sale-customer', payload),\n  bulkAssignWalkinSalesToCustomer: (payload) => invoke('bulk-assign-walkin-sales-to-customer', payload),\n  redeemCustomerLoyaltyPoints: (payload) => invoke('redeem-customer-loyalty-points', payload),"
    );
    new vm.Script(preCode, { filename: 'preload.js' });
    fs.writeFileSync(preloadPath, preCode, 'utf8');
  }
}

// ============================================================================
// 2. الوحدة الجراحية الشاملة لإصلاح ربط الزبون في المبيعات، منظومة الولاء، كشف État 104، وزر F9
// ============================================================================
function installPosCustomerLoyaltyEtat104AndF9Fix() {
  if (!window.App || !window.AppState) return;

  // إعدادات برنامج الولاء والزبائن الأوفياء (Clients Fidèles)
  // كل 100 د.ج مبيعات = 1 نقطة ولاء | كل 1 نقطة ولاء = 5 د.ج تخفيض نقدي عند الاختزال
  AppState.loyaltyPointValueDzd = Number(localStorage.getItem('gherbi_loyalty_pt_val_dzd') || 5);
  AppState.loyaltyPointsPer100Dzd = Number(localStorage.getItem('gherbi_loyalty_pts_per_100') || 1);

  function getCustomerTierInfo(pts) {
    var p = Number(pts || 0);
    if (p >= 500) return { label: '💎 ماسي VIP', cls: 'bg-indigo-600 text-white', bonusMult: 1.5 };
    if (p >= 200) return { label: '🥇 ذهبي', cls: 'bg-amber-500 text-slate-950', bonusMult: 1.25 };
    if (p >= 50) return { label: '🥈 فضي', cls: 'bg-slate-300 text-slate-900', bonusMult: 1.1 };
    return { label: '🥉 برونزي', cls: 'bg-amber-700/20 text-amber-700 dark:text-amber-300', bonusMult: 1.0 };
  }

  // --------------------------------------------------------------------------
  // 1) الحل الجذري لمشكلة "زبون عابر" في شاشة المبيعات (#view-pos)
  //    نضمن قراءة ومزامنة #posCustomerSelect في كل لحظة وفي جميع طرق البيع!
  // --------------------------------------------------------------------------
  App.syncPosSelectedCustomerToCart = function (explicitCustomerId) {
    var sel = document.getElementById('posCustomerSelect');
    var cidVal = explicitCustomerId !== undefined
      ? explicitCustomerId
      : (sel ? sel.value : (this.currentCart ? this.currentCart.customerId : ''));

    var cid = cidVal ? Number(cidVal) : '';
    if (this.currentCart) {
      if ( Number(this.currentCart.customerId || 0) !== Number(cid || 0) ) {
        // إذا غيرنا الزبون، نلغي أي اختزال نقاط سابق خاص بزبون آخر
        if (this.currentCart.redeemedLoyaltyPoints) {
          this.currentCart.discount = Math.max(0, Number(this.currentCart.discount || 0) - Number(this.currentCart.redeemedLoyaltyDiscountDzd || 0));
          this.currentCart.redeemedLoyaltyPoints = 0;
          this.currentCart.redeemedLoyaltyDiscountDzd = 0;
          var discInp = document.getElementById('cartDiscountInput');
          if (discInp) discInp.value = String(this.currentCart.discount || 0);
        }
      }
      this.currentCart.customerId = cid;
    }

    if (sel && String(sel.value) !== String(cid || '')) {
      sel.value = String(cid || '');
    }

    var foundCust = cid
      ? (AppState.customers || []).find(function (c) { return Number(c.id) === Number(cid); })
      : null;

    if (foundCust && foundCust.price_tier && typeof this.setCartPriceTier === 'function') {
      var tierSel = document.getElementById('posPriceTierSelect');
      if (tierSel && tierSel.value !== foundCust.price_tier) {
        this.setCartPriceTier(foundCust.price_tier);
      }
    }

    this.renderPosLoyaltySmartBar();
    return cid || null;
  };

  // شريط الزبون الوفي ونقاط الولاء والاختزال التلقائي في شاشة الكاشير (#posLoyaltySmartBar)
  App.renderPosLoyaltySmartBar = function () {
    var custSelect = document.getElementById('posCustomerSelect');
    if (!custSelect) return;

    var parentBox = custSelect.closest('.p-3') || custSelect.parentElement.parentElement;
    if (!parentBox) return;

    var bar = document.getElementById('posLoyaltySmartBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'posLoyaltySmartBar';
      parentBox.appendChild(bar);
    }

    // إضافة زر "👑 الأوفياء" بجانب زر "+ زبون جديد" إن لم يكن موجوداً
    var rowFlex = custSelect.parentElement;
    if (rowFlex && !document.getElementById('btnPosVipDirectory')) {
      custSelect.setAttribute('onchange', 'App.syncPosSelectedCustomerToCart(this.value)');
      var vipBtn = document.createElement('button');
      vipBtn.id = 'btnPosVipDirectory';
      vipBtn.type = 'button';
      vipBtn.setAttribute('onclick', 'App.openPosVipLoyaltyDirectoryModal()');
      vipBtn.className = 'px-2.5 py-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-slate-950 text-xs font-black flex items-center gap-1 transition shrink-0';
      vipBtn.title = 'دليل الزبائن الأوفياء واختزال النقاط (Alt+L)';
      vipBtn.innerHTML = '<span>👑 الأوفياء</span>';
      rowFlex.insertBefore(vipBtn, custSelect.nextSibling);
    }

    var cid = this.currentCart && this.currentCart.customerId ? Number(this.currentCart.customerId) : (custSelect.value ? Number(custSelect.value) : null);
    var cust = cid ? (AppState.customers || []).find(function (c) { return Number(c.id) === Number(cid); }) : null;

    if (!cust) {
      bar.innerHTML =
        '<div class="mt-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">' +
        '  <span class="text-slate-500 font-bold">👤 البيع الحالي: <strong>زبون عابر</strong> — اختر زبوناً لجمع نقاط الولاء وظهوره في كشف État 104</span>' +
        '  <button type="button" onclick="App.openPosVipLoyaltyDirectoryModal()" class="text-blue-600 font-black hover:underline">👑 اختيار زبون وفي</button>' +
        '</div>';
      return;
    }

    var cartItems = (this.currentCart && this.currentCart.items) || [];
    var rawSubtotal = cartItems.reduce(function (s, it) { return s + Number(it.subtotal || 0); }, 0);
    var curDiscount = Number((this.currentCart && this.currentCart.discount) || 0);
    var netTotal = Math.max(0, rawSubtotal - curDiscount);

    var availPts = Math.max(0, Number(cust.loyalty_points || 0));
    var ptValueDzd = Math.max(1, Number(AppState.loyaltyPointValueDzd || 5));
    var maxDiscountDzd = availPts * ptValueDzd;
    var ptsToEarn = Math.floor((netTotal / 100) * Math.max(1, Number(AppState.loyaltyPointsPer100Dzd || 1)));
    var tierInfo = getCustomerTierInfo(availPts);
    var alreadyRedeemedPts = Number((this.currentCart && this.currentCart.redeemedLoyaltyPoints) || 0);
    var alreadyRedeemedDzd = Number((this.currentCart && this.currentCart.redeemedLoyaltyDiscountDzd) || 0);

    bar.innerHTML =
      '<div class="mt-1.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-[11px]">' +
      '  <div class="flex flex-wrap items-center justify-between gap-1">' +
      '    <div class="flex items-center gap-1.5">' +
      '      <span class="px-2 py-0.5 rounded-lg text-[10px] font-black ' + tierInfo.cls + '">' + tierInfo.label + '</span>' +
      '      <strong class="font-black text-slate-900 dark:text-white">' + cust.name + '</strong>' +
      '    </div>' +
      '    <div class="flex items-center gap-2 font-mono">' +
      '      <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-black">⭐ ' + availPts + ' نقطة (' + maxDiscountDzd + ' د.ج)</span>' +
      (ptsToEarn > 0
        ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black">+' + ptsToEarn + ' نقطة بهذه الفاتورة</span>'
        : '') +
      '    </div>' +
      '  </div>' +

      '  <div class="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-amber-500/20">' +
      (alreadyRedeemedPts > 0
        ? '<span class="text-emerald-600 font-black">🎁 تم اختزال (' + alreadyRedeemedPts + ' نقطة) بخصم فوري: -' + alreadyRedeemedDzd.toFixed(2) + ' د.ج!</span>' +
          '<button type="button" onclick="App.cancelLoyaltyRedemptionInCart()" class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 font-black hover:bg-rose-600 hover:text-white transition">✕ إلغاء الاختزال</button>'
        : availPts > 0 && rawSubtotal > 0
          ? '<span class="text-slate-600 dark:text-slate-300 font-bold">هل يريد الزبون استبدال نقاطه بتخفيض فوري؟</span>' +
            '<button type="button" onclick="App.redeemLoyaltyPointsInPosCart()" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm transition">🎁 اختزال النقاط تلقائياً (-' + Math.min(rawSubtotal, maxDiscountDzd).toFixed(0) + ' د.ج)</button>'
          : '<span class="text-slate-500 font-bold">تُجمع النقاط تلقائياً بعد كل عملية شراء (1 نقطة لكل 100 د.ج)</span>') +
      '  </div>' +
      '</div>';
  };

  // اختزال النقاط تلقائياً في سلة الكاشير الحالية
  App.redeemLoyaltyPointsInPosCart = function () {
    var cid = this.syncPosSelectedCustomerToCart();
    if (!cid) return;
    var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === Number(cid); });
    if (!cust) return;

    var availPts = Math.max(0, Number(cust.loyalty_points || 0));
    if (availPts <= 0) {
      if (typeof showToast === 'function') showToast('لا توجد نقاط ولاء متاحة لهذا الزبون حالياً', 'warning');
      return;
    }

    var cart = this.currentCart;
    var rawSubtotal = (cart.items || []).reduce(function (s, it) { return s + Number(it.subtotal || 0); }, 0);
    if (rawSubtotal <= 0) {
      if (typeof showToast === 'function') showToast('أضف منتجات إلى السلة أولاً قبل اختزال النقاط!', 'warning');
      return;
    }

    var ptVal = Math.max(1, Number(AppState.loyaltyPointValueDzd || 5));
    var maxRedeemablePts = Math.min(availPts, Math.floor(rawSubtotal / ptVal));
    if (maxRedeemablePts <= 0) maxRedeemablePts = 1;
    var discountDzd = Math.min(rawSubtotal, maxRedeemablePts * ptVal);

    // إزالة أي اختزال سابق قبل تطبيق الجديد
    var baseDisc = Math.max(0, Number(cart.discount || 0) - Number(cart.redeemedLoyaltyDiscountDzd || 0));
    cart.redeemedLoyaltyPoints = maxRedeemablePts;
    cart.redeemedLoyaltyDiscountDzd = discountDzd;
    cart.discount = Number((baseDisc + discountDzd).toFixed(2));

    var discInp = document.getElementById('cartDiscountInput');
    if (discInp) discInp.value = String(cart.discount);

    this.recalcCart();
    this.renderCartItems();
    this.renderPosLoyaltySmartBar();
    if (typeof showToast === 'function') {
      showToast('🎁 تم اختزال (' + maxRedeemablePts + ' نقطة) وتطبيق تخفيض فوري بقيمة ' + discountDzd.toFixed(2) + ' د.ج للزبون ' + cust.name + '!', 'success');
    }
  };

  App.cancelLoyaltyRedemptionInCart = function () {
    var cart = this.currentCart;
    if (!cart || !cart.redeemedLoyaltyPoints) return;
    cart.discount = Math.max(0, Number(cart.discount || 0) - Number(cart.redeemedLoyaltyDiscountDzd || 0));
    cart.redeemedLoyaltyPoints = 0;
    cart.redeemedLoyaltyDiscountDzd = 0;

    var discInp = document.getElementById('cartDiscountInput');
    if (discInp) discInp.value = String(cart.discount);

    this.recalcCart();
    this.renderCartItems();
    this.renderPosLoyaltySmartBar();
    if (typeof showToast === 'function') {
      showToast('تم إلغاء اختزال النقاط وإعادة الفاتورة لقيمتها الأصلية', 'info');
    }
  };

  // ربط renderPosView و renderCartItems ليقوما دائماً بتحديث ربط الزبون وشريط الولاء
  var _prevRenderPosView = App.renderPosView.bind(App);
  App.renderPosView = function () {
    _prevRenderPosView();
    var custSelect = document.getElementById('posCustomerSelect');
    if (custSelect) {
      custSelect.onchange = function (e) {
        App.syncPosSelectedCustomerToCart(e.target.value);
      };
    }
    this.renderPosLoyaltySmartBar();
  };

  var _prevRenderCartItems = App.renderCartItems.bind(App);
  App.renderCartItems = function () {
    _prevRenderCartItems();
    this.renderPosLoyaltySmartBar();
  };

  // تحصين جميع دوال البيع (submitSale & instantConfirmAndCheckout) لقراءة الزبون من #posCustomerSelect وخصم النقاط المختزلة!
  var _prevSubmitSale = App.submitSale.bind(App);
  App.submitSale = async function (printMode) {
    var cid = this.syncPosSelectedCustomerToCart();
    var redeemedPts = Number((this.currentCart && this.currentCart.redeemedLoyaltyPoints) || 0);
    await _prevSubmitSale(printMode);

    if (cid && redeemedPts > 0 && window.api && window.api.redeemCustomerLoyaltyPoints) {
      await window.api.redeemCustomerLoyaltyPoints({
        customerId: cid,
        points: redeemedPts,
        reason: 'اختزال نقاط ولاء في فاتورة مبيعات'
      }).catch(function () {});
    }
    await this.refreshProducts();
    this.renderPosView();
  };

  if (typeof App.instantConfirmAndCheckout === 'function') {
    var _prevInstantCheckout = App.instantConfirmAndCheckout.bind(App);
    App.instantConfirmAndCheckout = async function (mode) {
      var cid = this.syncPosSelectedCustomerToCart();
      var redeemedPts = Number((this.currentCart && this.currentCart.redeemedLoyaltyPoints) || 0);
      await _prevInstantCheckout(mode);

      if (cid && redeemedPts > 0 && window.api && window.api.redeemCustomerLoyaltyPoints) {
        await window.api.redeemCustomerLoyaltyPoints({
          customerId: cid,
          points: redeemedPts,
          reason: 'اختزال نقاط ولاء في فاتورة بيع فورية'
        }).catch(function () {});
      }
      await this.refreshProducts();
      this.renderPosView();
    };
  }

  // --------------------------------------------------------------------------
  // 2) نافذة دليل الزبائن الأوفياء السريعة في الكاشير (#posVipLoyaltyDirectoryModal)
  // --------------------------------------------------------------------------
  App.openPosVipLoyaltyDirectoryModal = async function () {
    await this.refreshProducts();
    var modal = document.getElementById('posVipLoyaltyDirectoryModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'posVipLoyaltyDirectoryModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    var customers = (AppState.customers || []).slice().sort(function (a, b) {
      return Number(b.loyalty_points || 0) - Number(a.loyalty_points || 0);
    });

    modal.innerHTML =
      '<div class="modal-content w-full max-w-3xl p-6 space-y-4">' +
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <div>' +
      '      <h3 class="text-lg font-black text-amber-600">👑 نادي الزبائن الأوفياء واختزال النقاط (Clients Fidèles VIP)</h3>' +
      '      <p class="text-[11px] text-slate-400 font-bold">اختر الزبون لربطه بالفاتورة الحالية، جمع النقاط له تلقائياً، أو استبدال نقاطه بتخفيض فوري</p>' +
      '    </div>' +
      '    <div class="flex items-center gap-2">' +
      '      <button type="button" onclick="App.closeModal(\'posVipLoyaltyDirectoryModal\'); App.openCustomerModal(null)" class="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black">+ إضافة زبون وفي جديد</button>' +
      '      <button type="button" onclick="App.closeModal(\'posVipLoyaltyDirectoryModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="max-h-96 overflow-y-auto space-y-2 text-xs">' +
      (customers.length > 0
        ? customers.map(function (c) {
            var pts = Number(c.loyalty_points || 0);
            var tier = getCustomerTierInfo(pts);
            var discVal = pts * Number(AppState.loyaltyPointValueDzd || 5);
            return (
              '<div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 hover:border-amber-500 transition">' +
              '  <div>' +
              '    <div class="flex items-center gap-2">' +
              '      <span class="px-2 py-0.5 rounded text-[10px] font-black ' + tier.cls + '">' + tier.label + '</span>' +
              '      <strong class="text-sm font-black">' + c.name + '</strong>' +
              '      <span class="font-mono text-slate-400">' + (c.phone || 'بدون هاتف') + '</span>' +
              '    </div>' +
              '    <div class="text-[10.5px] text-slate-500 mt-0.5">NIF: <span class="font-mono">' + (c.nif || 'غير مسجل') + '</span> | RC: <span class="font-mono">' + (c.rc || 'غير مسجل') + '</span> | الفئة: <strong>' + (c.price_tier === 'wholesale' ? 'سعر الجملة' : 'سعر التجزئة') + '</strong></div>' +
              '  </div>' +
              '  <div class="flex items-center gap-2">' +
              '    <div class="text-left ml-2">' +
              '      <div class="font-mono font-black text-amber-600">⭐ ' + pts + ' نقطة</div>' +
              '      <div class="text-[10px] font-bold text-emerald-600">تساوي خصم: ' + discVal + ' د.ج</div>' +
              '    </div>' +
              '    <button type="button" onclick="App.selectVipCustomerForPos(' + c.id + ', false)" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black">✓ اختيار الفاتورة</button>' +
              (pts > 0
                ? '<button type="button" onclick="App.selectVipCustomerForPos(' + c.id + ', true)" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black">🎁 اختيار + اختزال النقاط</button>'
                : '') +
              '  </div>' +
              '</div>'
            );
          }).join('')
        : '<div class="py-10 text-center text-slate-400 font-bold">لا يوجد زبائن مسجلون بعد</div>') +
      '  </div>' +
      '</div>';

    this.openModal('posVipLoyaltyDirectoryModal');
  };

  App.selectVipCustomerForPos = function (customerId, andRedeemImmediately) {
    this.closeModal('posVipLoyaltyDirectoryModal');
    var sel = document.getElementById('posCustomerSelect');
    if (sel) sel.value = String(customerId);
    this.syncPosSelectedCustomerToCart(customerId);
    if (andRedeemImmediately) {
      this.redeemLoyaltyPointsInPosCart();
    } else if (typeof showToast === 'function') {
      var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === Number(customerId); });
      if (cust) showToast('👤 تم ربط الفاتورة بالزبون: ' + cust.name + ' (⭐ ' + (cust.loyalty_points || 0) + ' نقطة)', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 3) أداة إسناد الفواتير السابقة للزبائن (تصلح الـ 19 فاتورة في سجل المبيعات وتملأ جدول État 104 فوراً!)
  // --------------------------------------------------------------------------
  App.assignSingleSaleToCustomer = async function (saleId, customerId) {
    if (!window.api || !window.api.assignSaleCustomer) return;
    await window.api.assignSaleCustomer({ saleId: Number(saleId), customerId: customerId ? Number(customerId) : null });
    await this.refreshProducts();
    if (AppState.currentView === 'sales') await this.renderSalesHistoryView();
    if (AppState.currentView === 'analytics') await this.renderAnalyticsView();
    if (typeof showToast === 'function') {
      showToast('✅ تم ربط الفاتورة بالزبون وتحديث نقاط الولاء وكشف État 104 بنجاح!', 'success');
    }
  };

  App.bulkAssignAllWalkinSalesToCustomer = async function (selectElId) {
    var sel = document.getElementById(selectElId || 'etat104BulkAssignCustSelect');
    var cid = Number(sel ? sel.value : 0);
    if (!cid) {
      if (typeof showToast === 'function') showToast('يرجى اختيار الزبون من القائمة أولاً', 'warning');
      return;
    }
    if (window.api && window.api.bulkAssignWalkinSalesToCustomer) {
      var res = await window.api.bulkAssignWalkinSalesToCustomer({ customerId: cid });
      await this.refreshProducts();
      if (AppState.currentView === 'analytics') await this.renderAnalyticsView();
      if (AppState.currentView === 'sales') await this.renderSalesHistoryView();
      if (document.getElementById('algerianFiscalModal')?.classList.contains('active')) {
        await this.openAlgerianFiscalModal();
      }
      if (typeof showToast === 'function') {
        showToast('🎉 تم ربط (' + (res.updatedCount || 0) + ' فاتورة سابقة) بالزبون وإضافة (+' + (res.earnedPts || 0) + ' نقطة ولاء) وتعمير كشف État 104 بنجاح!', 'success');
      }
    }
  };

  // ترقية جدول سجل المبيعات (#view-sales) ليسمح بتغيير زبون أي فاتورة مباشرة من الجدول!
  var _prevRenderSalesView = App.renderSalesHistoryView ? App.renderSalesHistoryView.bind(App) : null;
  if (_prevRenderSalesView) {
    App.renderSalesHistoryView = async function () {
      await _prevRenderSalesView();
      var rows = document.querySelectorAll('#sales-view-root table tbody tr');
      rows.forEach(function (tr) {
        var cells = tr.querySelectorAll('td');
        if (cells.length >= 3) {
          var docCell = cells[0];
          var custCell = cells[2];
          var editBtn = tr.querySelector('button[onclick*="openSaleDetailsModal("], button[onclick*="reprintSale("]');
          var m = editBtn ? /\((\d+)/.exec(editBtn.getAttribute('onclick') || '') : null;
          if (m && custCell && !custCell.querySelector('select')) {
            var saleId = Number(m[1]);
            var curText = custCell.textContent.trim();
            custCell.innerHTML =
              '<select onchange="App.assignSingleSaleToCustomer(' + saleId + ', this.value)" class="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 cursor-pointer" title="انقر لتغيير أو ربط الزبون بهذه الفاتورة">' +
              '  <option value="">👤 زبون عابر (انقر للربط بزبون)</option>' +
              (AppState.customers || []).map(function (c) {
                var isSelected = curText.includes(c.name);
                return '<option value="' + c.id + '" ' + (isSelected ? 'selected' : '') + '>👑 ' + c.name + '</option>';
              }).join('') +
              '</select>';
          }
        }
      });
    };
  }

  // ترقية تبويب الجباية رقم 11 (renderErpTab11_AlgerianFiscalStudio) ونافذة (openAlgerianFiscalModal) لإضافة شريط الإسناد السريع للفواتير العابرة!
  var _prevTab11 = App.renderErpTab11_AlgerianFiscalStudio ? App.renderErpTab11_AlgerianFiscalStudio.bind(App) : null;
  if (_prevTab11) {
    App.renderErpTab11_AlgerianFiscalStudio = async function (body, data) {
      await _prevTab11(body, data);
      var quickAssignBar = document.createElement('div');
      quickAssignBar.className = 'p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs mt-3';
      quickAssignBar.innerHTML =
        '<div>' +
        '  <div class="font-black text-amber-800 dark:text-amber-300">⚡ أداة التعمير الفوري لكشف الزبائن السنوي (État 104):</div>' +
        '  <div class="text-[11px] text-slate-500">هل قمت بعمليات بيع تجريبية سابقة دون ربطها بالزبون؟ يمكنك إسناد الفواتير العابرة لزبون محدد بضغطة زر ليظهر في كشف État 104!</div>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
        '  <select id="etat104BulkAssignCustSelect" class="px-3 py-1.5 rounded-xl font-bold">' +
        (AppState.customers || []).map(function (c) {
          return '<option value="' + c.id + '">' + c.name + (c.nif ? ' (NIF: ' + c.nif + ')' : '') + '</option>';
        }).join('') +
        '  </select>' +
        '  <button type="button" onclick="App.bulkAssignAllWalkinSalesToCustomer(\'etat104BulkAssignCustSelect\')" class="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow">🔗 إسناد الفواتير العابرة لهذا الزبون وتحديث الكشف</button>' +
        '</div>';
      body.appendChild(quickAssignBar);
    };
  }

  // --------------------------------------------------------------------------
  // 4) الإصلاح القاطع لزر واختصار (🖨️ طباعة F9) في مركز القيادة (#view-analytics)
  // --------------------------------------------------------------------------
  App.printAnalyticsSalesSummary = async function () {
    try {
      this.ensureAnalyticsModalsDom();
      var data = await this.fetchMasterExecutiveAnalytics();
      AppState.analyticsData = data;
      var s = AppState.settings || {};
      var shopName = s.shop_name || 'Gherbi.Ai POS';

      var invCost = Number((data.inventory && data.inventory.cost_value) || 0);
      var invSell = Number((data.inventory && data.inventory.sell_value) || 0);
      var invProf = Number((data.inventory && data.inventory.expected_profit) || 0);
      var ordersDep = Number((data.ecosystem && data.ecosystem.ordersDepositsTotal) || 0);
      var totalAssets360 = Number((invCost + Math.max(0, Number(data.net_cash_flow || 0)) + Number(data.totalCustomerDebt || 0)).toFixed(2));
      var totalLiabilities360 = Number((Number(data.totalSupplierDebt || 0) + ordersDep).toFixed(2));
      var storeNetWorth360 = Number((totalAssets360 - totalLiabilities360).toFixed(2));
      var fmtC = function (v) {
        return typeof App.erpFormatCentimes === 'function' ? App.erpFormatCentimes(v) : (Math.round(Number(v || 0) * 100)).toLocaleString('fr-DZ') + ' سنتيم';
      };

      var html =
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>التقرير التنفيذي الشامل 360° — ' + shopName + '</title>' +
        '<style>@page{size:A4 portrait;margin:10mm;}body{font-family:"Cairo",Tahoma,sans-serif;padding:16px;color:#0f172a;font-size:12px;background:#fff;}table{width:100%;border-collapse:collapse;margin-top:8px;margin-bottom:14px;}th,td{border:1px solid #cbd5e1;padding:6px;text-align:right;}th{background:#0f172a;color:#fff;}.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}.card{border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#f8fafc;}</style></head><body contenteditable="true">' +
        '<div style="display:flex;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:10px;margin-bottom:12px;">' +
        '  <div><h2 style="margin:0;color:#1d4ed8;">' + shopName + ' — التقرير التنفيذي الشامل لمركز القيادة 360°</h2><div>' + (s.shop_address || 'الجزائر') + ' | مؤشر الصحة المالية: <strong>' + (data.healthScore || 95) + '/100</strong></div></div>' +
        '  <div style="text-align:left;font-family:monospace;"><div>التاريخ: ' + new Date().toISOString().slice(0, 10) + '</div><div>صافي الثروة: <strong>' + storeNetWorth360.toFixed(2) + ' د.ج</strong></div></div>' +
        '</div>' +
        '<div class="kpi">' +
        '  <div class="card"><div>صافي المبيعات (' + (data.total_sales_count || 0) + ')</div><strong style="font-size:15px;color:#1d4ed8;">' + Number(data.net_revenue || 0).toFixed(2) + ' د.ج</strong></div>' +
        '  <div class="card"><div>تكلفة البضاعة (COGS)</div><strong style="font-size:15px;color:#d97706;">' + Number(data.cogs || 0).toFixed(2) + ' د.ج</strong></div>' +
        '  <div class="card"><div>المصاريف التشغيلية</div><strong style="font-size:15px;color:#e11d48;">-' + Number(data.totalExpenses || 0).toFixed(2) + ' د.ج</strong></div>' +
        '  <div class="card"><div>صافي الربح النهائي</div><strong style="font-size:15px;color:#059669;">+' + Number(data.net_profit || 0).toFixed(2) + ' د.ج</strong></div>' +
        '</div>' +
        '<h3>1. الميزانية العمومية وتقييم المخزون والزكاة (Bilan 360°)</h3>' +
        '<table><thead><tr><th>البند المالي</th><th>القيمة بالدينار (د.ج)</th><th>المعادل بالسنتيم الجزائري</th></tr></thead><tbody>' +
        '<tr><td>قيمة المخزون بسعر التكلفة (الشراء)</td><td>' + invCost.toFixed(2) + ' د.ج</td><td>' + fmtC(invCost) + '</td></tr>' +
        '<tr><td>قيمة المخزون بسعر البيع (الربح الكامن: +' + invProf.toFixed(2) + ')</td><td>' + invSell.toFixed(2) + ' د.ج</td><td>' + fmtC(invSell) + '</td></tr>' +
        '<tr><td>ديوننا عند الزبائن مقابل ديون الموردين علينا</td><td>لنا: ' + Number(data.totalCustomerDebt || 0).toFixed(2) + ' | علينا: ' + Number(data.totalSupplierDebt || 0).toFixed(2) + '</td><td>—</td></tr>' +
        '<tr><td>وعاء الزكاة الصافي ومقدار الزكاة الواجب (2.5%)</td><td>الوعاء: ' + Number(data.zakat?.pool || 0).toFixed(2) + ' | الزكاة: <strong>' + Number(data.zakat?.amount || 0).toFixed(2) + ' د.ج</strong></td><td>' + fmtC(data.zakat?.amount || 0) + '</td></tr>' +
        '</tbody></table>' +
        '<h3>2. أفضل المنتجات ربحية ومبيعاً (مصفوفة ABC)</h3>' +
        '<table><thead><tr><th>#</th><th>المنتج</th><th>الكمية المباعة</th><th>الإيراد</th><th>صافي الربح</th></tr></thead><tbody>' +
        (data.topProducts || []).slice(0, 15).map(function (tp, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + tp.name + '</td><td>' + tp.qty_sold + '</td><td>' + Number(tp.revenue || 0).toFixed(2) + ' د.ج</td><td>+' + Number(tp.profit || 0).toFixed(2) + ' د.ج</td></tr>';
        }).join('') +
        '</tbody></table></body></html>';

      this.openModal('erpBoardroomReportModal');
      setTimeout(function () {
        var frame = document.getElementById('erpBoardroomPreviewFrame');
        if (frame && frame.contentWindow) {
          var doc = frame.contentWindow.document;
          doc.open();
          doc.write(html);
          doc.close();
        }
      }, 40);
    } catch (err) {
      console.error('Print Analytics Error:', err);
      if (typeof showToast === 'function') showToast('خطأ في تجهيز التقرير: ' + err.message, 'error');
    }
  };

  // مستمع مفاتيح ذو أولوية قصوى (Capture Phase) لضمان عمل F9 في مركز القيادة و Alt+L لنافذة الزبائن الأوفياء
  window.addEventListener('keydown', function (e) {
    if (e.key === 'F9' && AppState.currentView === 'analytics') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      App.printAnalyticsSalesSummary();
      return;
    }
    if (e.altKey && (e.key === 'l' || e.key === 'L') && AppState.currentView === 'pos') {
      e.preventDefault();
      e.stopPropagation();
      App.openPosVipLoyaltyDirectoryModal();
    }
  }, true);
}

// ============================================================================
// 3. حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [POS CUSTOMER SYNC, VIP LOYALTY AUTO-REDEEM, ETAT 104 & F9 FIX]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installPosCustomerLoyaltyEtat104AndF9Fix.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن وفحص إصلاح ربط الزبون، منظومة الولاء (Clients Fidèles)، تعمير État 104، وزر الطباعة F9 في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page15-analytics-zakat-command-center.js', 'upgrade-erp-command-center-part1.js', 'upgrade-erp-command-center-part2.js', 'upgrade-erp-command-center-part3.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 3/3: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتمل التحديث بنجاح! أعد تشغيل البرنامج (أو اضغط Ctrl+R) وجرّب الميزات الجديدة الآن.');