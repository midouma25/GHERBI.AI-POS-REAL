/**
 * part1-restore-pages-fix-extensible-and-clean-pos-v25.js
 * [الشطر 1 من 2] — استرجاع الصفحات السليمة (#view-pos & #view-analytics) + إصلاح خطأ (object is not extensible) + تصفير نقاط الولاء + تنظيف وإعادة ترتيب شاشة المبيعات:
 * 1. إزالة البلوكات المعطوبة (V20, V22, V23, V24) من نهاية renderer-rc-100.js لإرجاع صفحة الإحصائيات والتقارير (#view-analytics) وشاشة المبيعات (#view-pos) إلى حالتهما السليمة 100%.
 * 2. حل خطأ (Cannot add property _loyaltyExactHooked, object is not extensible) نهائياً بعدم لمس الكائن المجمد window.api.
 * 3. تثبيت خصم وتصفير نقاط الولاء (0 نقطة) فوراً على الشاشة وفي قاعدة البيانات عند استعمالها لإنقاص الفاتورة.
 * 4. إعادة ترتيب وتنظيف UI/UX شاشة المبيعات (#view-pos): إزالة الأزرار المكررة، دمج بطاقة الولاء في شريط رشيق، طيّ الكوبون والتخفيض في درج ذكي، وتوسيع قائمة المشتريات (#posCartItems).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sqlite3 = require('sqlite3').verbose();

const ROOT = __dirname;

console.log('🇩🇿🚀 [الشطر 1/2 - V25] بدء استرجاع الصفحات السليمة، إصلاح خطأ contextBridge، وتنظيف واجهة شاشة المبيعات...\n');

// ============================================================================
// 1. تنظيف الأرشيف ومزامنة إعدادات الولاء في قاعدة البيانات الحية
// ============================================================================
const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
if (!fs.existsSync(archiveDir)) {
  try { fs.mkdirSync(archiveDir, { recursive: true }); } catch (_) {}
}
[
  'purify-retail-no-etat104-and-rebuild-loyalty-customers-v20.js',
  'fix-sale-items-bonus-qty-db-columns-v21.js',
  'fix-loyalty-points-sync-and-atomic-math-v22.js',
  'fix-loyalty-redemption-zero-balance-v23.js',
  'part1-fix-extensible-and-clean-pos-ux-v24.js'
].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

function syncLiveDatabaseV25() {
  const candidates = new Set([
    path.join(ROOT, 'data', 'gherbi_ai_pos.db'),
    path.join(ROOT, 'gherbi_ai_pos.db')
  ]);
  const appData = process.env.APPDATA || '';
  if (appData && fs.existsSync(appData)) {
    try {
      for (const d of fs.readdirSync(appData, { withFileTypes: true })) {
        if (d.isDirectory() && /gherbi|electron/i.test(d.name)) {
          candidates.add(path.join(appData, d.name, 'gherbi_ai_pos.db'));
        }
      }
    } catch (_) {}
  }

  const files = Array.from(candidates).filter((p) => fs.existsSync(p));
  return Promise.all(
    files.map(
      (dbFile) =>
        new Promise((resolve) => {
          const liveDb = new sqlite3.Database(dbFile, (err) => {
            if (err) return resolve();
            liveDb.serialize(() => {
              liveDb.run('PRAGMA busy_timeout = 8000');
              liveDb.run('ALTER TABLE sale_items ADD COLUMN bonus_qty REAL DEFAULT 0', () => {});
              liveDb.run('ALTER TABLE sale_items ADD COLUMN pack_count REAL DEFAULT 0', () => {});
              liveDb.run('ALTER TABLE sale_items ADD COLUMN pack_multiplier REAL DEFAULT 1', () => {});
              liveDb.run('ALTER TABLE sale_items ADD COLUMN sold_m2 REAL DEFAULT 0', () => {});
              liveDb.run("UPDATE customers SET name = REPLACE(name, '(زبون جملة)', '(زبون وفي)'), price_tier = 'retail' WHERE name LIKE '%زبون جملة%' OR price_tier = 'wholesale'", () => {});
            });
            liveDb.close(() => resolve());
          });
        })
    )
  );
}

// ============================================================================
// 2. الدالة النظيفة لاسترجاع الصفحات، تصفير النقاط، وإعادة تنظيم شاشة المبيعات (#view-pos)
// ============================================================================
function installPart1RestorePagesFixExtensibleAndCleanPosV25() {
  if (!window.App || !window.AppState) return;

  var savedPtsPer100 = Number(localStorage.getItem('gherbi_loyalty_pts_per_100') || 1);
  var savedPtValDzd = Number(localStorage.getItem('gherbi_loyalty_pt_val_dzd') || 2);
  AppState.loyaltyPointsPer100Dzd = savedPtsPer100 > 0 ? savedPtsPer100 : 1;
  AppState.loyaltyPointValueDzd = savedPtValDzd > 0 ? savedPtValDzd : 2;
  AppState.posDiscountDrawerOpen = false;
  AppState.posMoreToolsOpen = false;

  // إظهار جميع أقسام القائمة الجانبية بشكل طبيعي وسليم
  document.querySelectorAll('#sidebar-nav button[data-view]').forEach(function (btn) {
    btn.style.display = '';
    btn.classList.remove('opacity-75');
  });

  function getCleanLoyaltyTierBadge(points) {
    var pts = Number(points || 0);
    if (pts >= 200) return { label: '💎 VIP', cls: 'bg-sky-500 text-slate-950' };
    if (pts >= 100) return { label: '🥇 Gold', cls: 'bg-amber-500 text-slate-950' };
    if (pts >= 30) return { label: '🥈 Silver', cls: 'bg-slate-300 text-slate-900' };
    return { label: '⭐ وفي', cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' };
  }

  // --------------------------------------------------------------------------
  // أ) مزامنة قاعدة نقاط الولاء مع جدول settings في قاعدة البيانات
  // --------------------------------------------------------------------------
  App.syncLoyaltyRulesToBackendSettings = async function () {
    if (AppState.settings) {
      AppState.settings.loyalty_points_per_100_dzd = String(AppState.loyaltyPointsPer100Dzd);
      AppState.settings.loyalty_point_value_dzd = String(AppState.loyaltyPointValueDzd);
    }
    if (window.api && typeof window.api.updateSettings === 'function') {
      await window.api.updateSettings({
        loyalty_points_per_100_dzd: String(AppState.loyaltyPointsPer100Dzd),
        loyalty_point_value_dzd: String(AppState.loyaltyPointValueDzd)
      }).catch(function () {});
    }
  };

  App.saveLoyaltyRuleSettingsFromCustomersPage = async function () {
    var ptsPer100 = Math.max(0.1, parseFloat(document.getElementById('cfgLoyaltyPtsPer100Inp')?.value) || 1);
    var dzdPerPt = Math.max(0.5, parseFloat(document.getElementById('cfgLoyaltyDzdPerPtInp')?.value) || 2);

    AppState.loyaltyPointsPer100Dzd = ptsPer100;
    AppState.loyaltyPointValueDzd = dzdPerPt;
    localStorage.setItem('gherbi_loyalty_pts_per_100', String(ptsPer100));
    localStorage.setItem('gherbi_loyalty_pt_val_dzd', String(dzdPerPt));

    await this.syncLoyaltyRulesToBackendSettings();
    if (AppState.currentView === 'customers' && typeof this.renderCustomersView === 'function') {
      await this.renderCustomersView();
    }
    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ القاعدة: كل 100 د.ج = ' + ptsPer100 + ' نقطة | كل 1 نقطة = ' + dzdPerPt + ' د.ج خصم!', 'success');
    }
  };

  // السماح بتحديد عدد مخصص من النقاط لإنقاص الفاتورة
  App.promptCustomLoyaltyPointsRedeem = function () {
    var cid = this.syncPosSelectedCustomerToCart();
    if (!cid) return;
    var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === Number(cid); });
    if (!cust) return;

    var availPts = Math.max(0, Number(cust.loyalty_points || 0));
    var ptVal = Math.max(0.5, Number(AppState.loyaltyPointValueDzd || 2));
    var cart = this.currentCart;
    var rawSubtotal = (cart && cart.items ? cart.items : []).reduce(function (s, it) { return s + Number(it.subtotal || 0); }, 0);
    if (rawSubtotal <= 0 || availPts <= 0) return;

    var maxUsefulPts = Math.min(availPts, Math.ceil(rawSubtotal / ptVal));
    var inputStr = window.prompt(
      '🎁 استعمال نقاط الولاء لإنقاص فاتورة الزبون (' + cust.name + '):\n' +
      '• رصيد النقاط المتاح: ' + availPts + ' نقطة (تساوي ' + (availPts * ptVal).toFixed(2) + ' د.ج)\n' +
      '• قيمة كل 1 نقطة = ' + ptVal + ' د.ج خصم\n\n' +
      'أدخل عدد النقاط المراد استعمالها:',
      String(maxUsefulPts)
    );
    if (inputStr === null) return;

    var chosenPts = Math.min(availPts, Math.max(1, parseInt(inputStr, 10) || 0));
    var discountDzd = Math.min(rawSubtotal, Number((chosenPts * ptVal).toFixed(2)));

    var baseDisc = Math.max(0, Number(cart.discount || 0) - Number(cart.redeemedLoyaltyDiscountDzd || 0));
    cart.redeemedLoyaltyPoints = chosenPts;
    cart.redeemedLoyaltyDiscountDzd = discountDzd;
    cart.discount = Number((baseDisc + discountDzd).toFixed(2));

    var discInp = document.getElementById('cartDiscountInput');
    if (discInp) discInp.value = String(cart.discount);

    this.recalcCart();
    this.renderCartItems();
    this.renderPosLoyaltySmartBar();
    if (typeof showToast === 'function') {
      showToast('🎁 تم إنقاص (-' + discountDzd.toFixed(2) + ' د.ج) باستعمال (' + chosenPts + ' نقطة ولاء)!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // ب) شريط الولاء المدمج الأنيق في السلة (#posLoyaltySmartBar)
  //    يعرض النقاط المتبقية (0 نقطة فور الخصم) في سطر واحد مدمج بدون تكدس!
  // --------------------------------------------------------------------------
  App.renderPosLoyaltySmartBar = function () {
    var custSelect = document.getElementById('posCustomerSelect');
    if (!custSelect) return;

    var tierSel = document.getElementById('posPriceTierSelect');
    if (tierSel) {
      tierSel.value = 'retail';
      tierSel.style.display = 'none';
    }

    var parentBox = custSelect.closest('.p-3') || custSelect.parentElement.parentElement;
    if (!parentBox) return;

    var bar = document.getElementById('posLoyaltySmartBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'posLoyaltySmartBar';
      parentBox.appendChild(bar);
    }

    var cid = this.currentCart && this.currentCart.customerId
      ? Number(this.currentCart.customerId)
      : (custSelect.value ? Number(custSelect.value) : null);
    var cust = cid ? (AppState.customers || []).find(function (c) { return Number(c.id) === Number(cid); }) : null;

    if (!cust) {
      bar.innerHTML =
        '<div class="mt-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-[10.5px]">' +
        '  <span class="text-slate-500 font-bold truncate">👤 زبون عابر — امسح بطاقة الوفاء (<code class="font-mono text-indigo-500">FID-...</code>) أو اختر زبوناً وفياً</span>' +
        '  <button type="button" onclick="App.openPosVipLoyaltyDirectoryModal()" class="text-amber-600 dark:text-amber-400 font-black hover:underline shrink-0 mr-1">👑 الأوفياء</button>' +
        '</div>';
      return;
    }

    var cartItems = (this.currentCart && this.currentCart.items) || [];
    var rawSubtotal = cartItems.reduce(function (s, it) { return s + Number(it.subtotal || 0); }, 0);
    var curDiscount = Number((this.currentCart && this.currentCart.discount) || 0);
    var netTotal = Math.max(0, rawSubtotal - curDiscount);

    var originalPts = Math.max(0, Number(cust.loyalty_points || 0));
    var alreadyRedeemedPts = Math.min(originalPts, Math.max(0, Number((this.currentCart && this.currentCart.redeemedLoyaltyPoints) || 0)));
    var alreadyRedeemedDzd = Number((this.currentCart && this.currentCart.redeemedLoyaltyDiscountDzd) || 0);

    // الرصيد المتبقي الفعلي بعد طرح النقاط المستعملة في السلة الحالية (يظهر 0 نقطة فوراً عند خصم كل النقاط!)
    var remainingPts = Math.max(0, originalPts - alreadyRedeemedPts);
    var ptValueDzd = Math.max(0.5, Number(AppState.loyaltyPointValueDzd || 2));
    var remainingValueDzd = Number((remainingPts * ptValueDzd).toFixed(2));
    var possibleDiscountNow = Math.min(rawSubtotal, Number((originalPts * ptValueDzd).toFixed(2)));

    var ptsToEarn = alreadyRedeemedPts > 0
      ? 0
      : Math.floor((netTotal / 100) * Math.max(0.1, Number(AppState.loyaltyPointsPer100Dzd || 1)));

    var tierInfo = getCleanLoyaltyTierBadge(originalPts);

    bar.innerHTML =
      '<div class="mt-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">' +
      '  <div class="flex items-center gap-1.5 min-w-0">' +
      '    <span class="px-1.5 py-0.5 rounded text-[9.5px] font-black ' + tierInfo.cls + '">' + tierInfo.label + '</span>' +
      '    <span class="font-mono font-black ' + (remainingPts === 0 && alreadyRedeemedPts > 0 ? 'text-rose-600' : 'text-amber-600 dark:text-amber-400') + '">⭐ ' + remainingPts + ' ن</span>' +
      '    <span class="text-slate-400">|</span>' +
      '    <span class="font-mono font-black text-emerald-600">' + remainingValueDzd.toFixed(0) + ' د.ج</span>' +
      (alreadyRedeemedPts > 0
        ? '<span class="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-black text-[9.5px]">✅ خُصم -' + alreadyRedeemedDzd.toFixed(0) + ' د.ج (' + alreadyRedeemedPts + 'ن)</span>'
        : ptsToEarn > 0
          ? '<span class="text-[10px] font-mono font-bold text-emerald-600">(+' + ptsToEarn + 'ن بهذه الفاتورة)</span>'
          : '') +
      '  </div>' +
      '  <div class="flex items-center gap-1 shrink-0">' +
      (alreadyRedeemedPts > 0
        ? '<button type="button" onclick="App.cancelLoyaltyRedemptionInCart()" class="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px]">✕ إلغاء الخصم</button>'
        : originalPts > 0 && rawSubtotal > 0
          ? '<button type="button" onclick="App.redeemLoyaltyPointsInPosCart()" class="px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] shadow-sm">🎁 خصم النقاط (-' + possibleDiscountNow.toFixed(0) + ' د.ج)</button>' +
            '<button type="button" onclick="App.promptCustomLoyaltyPointsRedeem()" class="px-1.5 py-0.5 rounded-lg bg-indigo-600 text-white font-black text-[10px]" title="تحديد عدد النقاط">🔢</button>'
          : '') +
      '    <button type="button" onclick="App.openLoyaltyCardStudioModal(' + cust.id + ')" class="px-1.5 py-0.5 rounded-lg bg-slate-900 text-amber-400 font-black text-[10px]" title="بطاقة الوفاء">💳</button>' +
      '  </div>' +
      '</div>';
  };

  // --------------------------------------------------------------------------
  // ج) تثبيت خصم النقاط وتصفيرها في قاعدة البيانات بعد البيع (بدون لمس window.api!)
  // --------------------------------------------------------------------------
  App.finalizeCustomerLoyaltyAfterSale = async function (customerId, origPtsBeforeSale, redeemedPts, saleTotalDzd) {
    var cid = Number(customerId || 0);
    if (!cid || !window.api || !window.api.updateCustomer) return;

    var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === cid; });
    if (!cust && window.api.getCustomers) {
      var list = (await window.api.getCustomers().catch(function () { return []; })) || [];
      cust = list.find(function (c) { return Number(c.id) === cid; });
    }
    if (!cust) return;

    var basePts = Math.max(0, Number(origPtsBeforeSale ?? cust.loyalty_points ?? 0));
    var ptsRate = Math.max(0.1, Number(AppState.loyaltyPointsPer100Dzd || 1));
    var earnedPts = redeemedPts > 0 ? 0 : Math.floor((Math.max(0, Number(saleTotalDzd || 0)) / 100) * ptsRate);

    var targetFinalPts = redeemedPts > 0
      ? Math.max(0, basePts - redeemedPts)
      : (basePts + earnedPts);

    cust.loyalty_points = targetFinalPts;
    await window.api.updateCustomer(cid, Object.assign({}, cust, {
      loyalty_points: targetFinalPts
    })).catch(function () {});

    if (window.api.getCustomers) {
      AppState.customers = (await window.api.getCustomers().catch(function () { return []; })) || AppState.customers;
    }
  };

  if (!AppState._safeLoyaltyHookV25) {
    AppState._safeLoyaltyHookV25 = true;

    var _origSubmitSaleV25 = App.submitSale.bind(App);
    App.submitSale = async function (printMode) {
      var cid = this.syncPosSelectedCustomerToCart();
      var cart = this.currentCart || {};
      var redeemedPts = Math.max(0, Number(cart.redeemedLoyaltyPoints || 0));
      var totals = this.recalcCart();
      var saleTotal = Number(totals.total || 0);

      var custObj = cid ? (AppState.customers || []).find(function (c) { return Number(c.id) === Number(cid); }) : null;
      var origPtsBeforeSale = custObj ? Math.max(0, Number(custObj.loyalty_points || 0)) : 0;

      // تصفير عداد السلة قبل الاستدعاء الداخلي لمنع الخصم المزدوج
      cart.redeemedLoyaltyPoints = 0;
      cart.redeemedLoyaltyDiscountDzd = 0;

      await _origSubmitSaleV25(printMode);

      if (cid) {
        await this.finalizeCustomerLoyaltyAfterSale(cid, origPtsBeforeSale, redeemedPts, saleTotal);
      }
      this.renderPosView();
    };

    if (typeof App.instantConfirmAndCheckout === 'function') {
      var _origInstantCheckoutV25 = App.instantConfirmAndCheckout.bind(App);
      App.instantConfirmAndCheckout = async function (mode) {
        var cid = this.syncPosSelectedCustomerToCart();
        var cart = this.currentCart || {};
        var redeemedPts = Math.max(0, Number(cart.redeemedLoyaltyPoints || 0));
        var totals = this.recalcCart();
        var saleTotal = Number(totals.total || 0);

        var custObj = cid ? (AppState.customers || []).find(function (c) { return Number(c.id) === Number(cid); }) : null;
        var origPtsBeforeSale = custObj ? Math.max(0, Number(custObj.loyalty_points || 0)) : 0;

        cart.redeemedLoyaltyPoints = 0;
        cart.redeemedLoyaltyDiscountDzd = 0;

        await _origInstantCheckoutV25(mode);

        if (cid) {
          await this.finalizeCustomerLoyaltyAfterSale(cid, origPtsBeforeSale, redeemedPts, saleTotal);
        }
        this.renderPosView();
      };
    }
  }

  // --------------------------------------------------------------------------
  // د) إعادة ترتيب وتنظيف شاشة المبيعات (#view-pos) لمنح الكاشير سلاسة ومساحة قصوى
  // --------------------------------------------------------------------------
  App.togglePosDiscountDrawer = function () {
    AppState.posDiscountDrawerOpen = !AppState.posDiscountDrawerOpen;
    this.organizePosWorkspaceErgonomics();
  };

  App.togglePosSecondaryToolsMenu = function () {
    var menu = document.getElementById('posSecondaryToolsDropdown');
    if (!menu) return;
    menu.classList.toggle('hidden');
  };

  App.organizePosWorkspaceErgonomics = function () {
    // 1. إخفاء أزرار QA المكررة من شاشة المبيعات
    var dupQa1 = document.getElementById('btnPosHeaderQaBot');
    if (dupQa1) dupQa1.style.display = 'none';
    var dupQa2 = document.getElementById('btnRunPosAutoTest');
    if (dupQa2) dupQa2.style.display = 'none';

    // 2. تنظيم شريط أعلى السلة (#posAlgerianMasterBar) في سطر واحد نظيف بدون ازدحام
    var masterBar = document.getElementById('posAlgerianMasterBar');
    if (masterBar) {
      masterBar.className = 'px-2.5 py-1 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 text-[10.5px] font-bold shrink-0 overflow-x-auto';
      masterBar.innerHTML =
        '<div class="flex items-center gap-1">' +
        '  <button type="button" onclick="App.openPosRecentSalesModal()" class="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 hover:border-blue-500 whitespace-nowrap">🧾 آخر المبيعات</button>' +
        '  <button type="button" onclick="App.openLoyaltyCardStudioModal(null)" class="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-500/30 text-amber-600 dark:text-amber-400 whitespace-nowrap">💳 بطاقات الوفاء</button>' +
        '  <button type="button" onclick="App.printCurrentCartExchangeTicket80mm()" class="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-pink-500/30 text-pink-600 whitespace-nowrap">🎁 وصل تبديل</button>' +
        '</div>' +
        '<button type="button" onclick="App.openMobileCompanionModal()" class="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-600 whitespace-nowrap">📱 ربط الهاتف</button>';
    }

    // 3. جعل الفئات (#posCategoryPills) في شريط أفقي انسيابي لا يلتف إلى عدة أسطر مزدحمة
    var pillsBox = document.getElementById('posCategoryPills');
    if (pillsBox) {
      pillsBox.className = 'flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar max-w-full';
    }

    // 4. طيّ الكوبون والتخفيض داخل درج ذكي لتوفير المساحة العمودية لقائمة السلع (#posCartItems)
    var couponBar = document.getElementById('posCartCouponInputBar');
    var discInput = document.getElementById('cartDiscountInput');
    var discRow = discInput ? discInput.parentElement : null;
    var subText = document.getElementById('cartSubtotalText');
    var subRow = subText ? subText.parentElement : null;

    var curDiscVal = parseFloat(discInput ? discInput.value : '0') || 0;
    var shouldShowDrawer = Boolean(AppState.posDiscountDrawerOpen || curDiscVal > 0);

    if (subRow && !document.getElementById('btnTogglePosDiscountDrawer')) {
      subRow.insertAdjacentHTML(
        'beforeend',
        '<button id="btnTogglePosDiscountDrawer" type="button" onclick="App.togglePosDiscountDrawer()" class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-black text-[10.5px] hover:bg-indigo-600 hover:text-white transition">🎟️ تخفيض / كوبون ▾</button>'
      );
    }

    var toggleBtn = document.getElementById('btnTogglePosDiscountDrawer');
    if (toggleBtn) {
      toggleBtn.textContent = shouldShowDrawer
        ? (curDiscVal > 0 ? '🏷️ الخصم: -' + curDiscVal.toFixed(0) + ' د.ج ▴' : '🔼 إخفاء الكوبون والتخفيض')
        : '🎟️ تخفيض / كوبون ▾';
    }

    if (couponBar) couponBar.style.display = shouldShowDrawer ? 'flex' : 'none';
    if (discRow) discRow.style.display = shouldShowDrawer ? 'flex' : 'none';

    if (subRow && subRow.parentElement) {
      subRow.parentElement.className = 'p-2.5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-700 space-y-1.5 shrink-0';
    }

    // إخفاء زر "كمبدئية" من أسفل السلة في وضع التجزئة لتوسيع أزرار السلة
    document.querySelectorAll('#posCartContainer button[onclick*="saveCartAsProforma"]').forEach(function (b) {
      b.style.display = 'none';
    });
    var draftsGrid = document.querySelector('#posCartContainer .grid.grid-cols-5');
    if (draftsGrid) {
      draftsGrid.className = 'grid grid-cols-4 gap-1 text-[11px] font-bold';
    }
  };

  var _prevRenderPosViewV25 = App.renderPosView.bind(App);
  App.renderPosView = function () {
    _prevRenderPosViewV25();
    this.renderPosLoyaltySmartBar();
    this.organizePosWorkspaceErgonomics();
  };

  var _prevRenderCartItemsV25 = App.renderCartItems.bind(App);
  App.renderCartItems = function () {
    _prevRenderCartItemsV25();
    this.renderPosLoyaltySmartBar();
    this.organizePosWorkspaceErgonomics();
  };

  setTimeout(async function () {
    if (window.App) {
      await window.App.syncLoyaltyRulesToBackendSettings();
      if (window.api && window.api.getCustomers) {
        AppState.customers = (await window.api.getCustomers().catch(function () { return []; })) || [];
      }
      if (AppState.currentView === 'pos') window.App.renderPosView();
      else if (AppState.currentView === 'analytics') window.App.renderAnalyticsView();
      else if (AppState.currentView === 'customers') window.App.renderCustomersView();
    }
  }, 200);
}

syncLiveDatabaseV25().then(() => {
  const rcPath = path.join(ROOT, 'renderer-rc-100.js');
  if (fs.existsSync(rcPath)) {
    let rc = fs.readFileSync(rcPath, 'utf8').replace(/\r\n/g, '\n');

    // قص وإزالة البلوكات المعطوبة (V20, V22, V23, V24) لإرجاع #view-analytics و #view-pos إلى حالتهما السليمة
    const cutMarkers = [
      '// [PURE RETAIL NO ETAT104 & VIP LOYALTY CUSTOMERS REBUILD V20]',
      '// [EXACT LOYALTY POINTS SYNC & ATOMIC MATH FIX V22]',
      '// [LOYALTY REDEMPTION ZERO BALANCE FIX V23]',
      '// [PART 1/2: FIX EXTENSIBLE ERROR, ZERO LOYALTY & CLEAN POS UX V24]',
      '// [PART 1/2: RESTORE PAGES, FIX EXTENSIBLE & CLEAN POS UX V25]'
    ];
    for (const m of cutMarkers) {
      const idx = rc.indexOf(m);
      if (idx !== -1) {
        rc = rc.slice(0, idx).trimEnd();
      }
    }

    const block =
      '\n\n// [PART 1/2: RESTORE PAGES, FIX EXTENSIBLE & CLEAN POS UX V25]\n(' +
      installPart1RestorePagesFixExtensibleAndCleanPosV25.toString() +
      ')();\n';

    const finalRc = rc.trimEnd() + block;
    new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
    fs.writeFileSync(rcPath, finalRc, 'utf8');
    console.log('✅ تم استرجاع الصفحات السليمة (#view-pos & #view-analytics) وحقن [الشطر 1/2: إصلاح خطأ contextBridge + تصفير النقاط + تنظيف شاشة المبيعات] بنجاح (0 أخطاء نحوية).');
  }

  console.log('\n🎉 اكتمل تنفيذ [الشطر الأول 1/2] بنجاح! اضغط Ctrl+R داخل البرنامج للتأكد من عودة كل الصفحات سليمة واختفاء الخطأ، ثم اكتب لي: "إلى الشطر الثاني (2/2)" لإضافة زر ومحرّك الواجهات الـ 4 الاحترافية لشاشة المبيعات.');
});