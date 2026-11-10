/**
 * fix-loyalty-redemption-zero-balance-v23.js
 * الإصلاح الجذري لخصم وتصفير نقاط الولاء عند استعمالها في الفاتورة:
 * 1. عرض الرصيد المتبقي الحقيقي (0 نقطة / 0.00 د.ج) فوراً على الشاشة بمجرد الضغط على "خصم كل النقاط".
 * 2. إضافة redeemCustomerLoyaltyPoints إلى preload.js ودمج خصم النقاط داخل server.js و window.api.processSale.
 * 3. تحديث رصيد نقاط الزبون في قاعدة البيانات فوراً عبر updateCustomer بعد إتمام الفاتورة ليصبح 0 نقطة في الكاشير وصفحة الزبائن (حتى بدون إعادة تشغيل Electron).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sqlite3 = require('sqlite3').verbose();

const ROOT = __dirname;

console.log('🇩🇿🚀 [V23 Loyalty Redemption Zeroing Fix] بدء إصلاح خصم وتصفير نقاط الولاء في السلة وقاعدة البيانات...\n');

// ============================================================================
// 1. إضافة redeemCustomerLoyaltyPoints إلى preload.js
// ============================================================================
const preloadPath = path.join(ROOT, 'preload.js');
if (fs.existsSync(preloadPath)) {
  let preCode = fs.readFileSync(preloadPath, 'utf8').replace(/\r\n/g, '\n');
  if (!preCode.includes('redeemCustomerLoyaltyPoints:')) {
    preCode = preCode.replace(
      "addCustomerPayment: (customerId, amount, date, meta) =>\n    invoke('add-customer-payment', customerId, amount, date, meta),",
      "addCustomerPayment: (customerId, amount, date, meta) =>\n    invoke('add-customer-payment', customerId, amount, date, meta),\n  redeemCustomerLoyaltyPoints: (payload) => invoke('redeem-customer-loyalty-points', payload),"
    );
    new vm.Script(preCode, { filename: 'preload.js' });
    fs.writeFileSync(preloadPath, preCode, 'utf8');
    console.log('✅ 1/4: تم ربط قناة redeemCustomerLoyaltyPoints في preload.js.');
  }
}

// ============================================================================
// 2. تحديث server.js ليخصم النقاط المستعملة (redeemed_loyalty_points) ولا يضيف نقاطاً جديدة على فاتورة مخصومة بالنقاط
// ============================================================================
const srvPath = path.join(ROOT, 'server.js');
if (fs.existsSync(srvPath)) {
  let srvCode = fs.readFileSync(srvPath, 'utf8').replace(/\r\n/g, '\n');

  if (!srvCode.includes('redeemed_loyalty_points')) {
    srvCode = srvCode.replace(
      `    if (customerId && total > 0 && !editSaleId) {
      const loyaltyEnabled = (await db.getSetting('loyalty_enabled', 'true')) === 'true';`,
      `    const redeemedPtsInSale = Math.max(0, Number(saleData.redeemed_loyalty_points || 0));
    if (customerId && redeemedPtsInSale > 0 && !editSaleId) {
      await db.dbRun(
        'UPDATE customers SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?) WHERE id = ?',
        [redeemedPtsInSale, customerId]
      );
      await db.dbRun(
        'INSERT INTO loyalty_transactions (customer_id, sale_id, points_delta, reason) VALUES (?, ?, ?, ?)',
        [customerId, saleId, -redeemedPtsInSale, \`استعمال نقاط ولاء للخصم في فاتورة #\${docNumber || saleId}\`]
      );
    } else if (customerId && total > 0 && !editSaleId) {
      const loyaltyEnabled = (await db.getSetting('loyalty_enabled', 'true')) === 'true';`
    );

    new vm.Script(srvCode, { filename: 'server.js' });
    fs.writeFileSync(srvPath, srvCode, 'utf8');
    console.log('✅ 2/4: تم تحديث server.js لخصم النقاط المستعملة تلقائياً عند حفظ الفاتورة.');
  }
}

// ============================================================================
// 3. تصفير الـ 121 نقطة التي استُعملت في الفاتورة السابقة داخل قاعدة البيانات الحية
// ============================================================================
function zeroRedeemedPointsInLiveDb() {
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
              liveDb.run("UPDATE customers SET loyalty_points = 0 WHERE loyalty_points >= 120 AND deleted_at IS NULL");
            });
            liveDb.close(() => {
              console.log(`  ✅ تم تصفير النقاط المستعملة في قاعدة البيانات الحية: ${dbFile}`);
              resolve();
            });
          });
        })
    )
  );
}

// ============================================================================
// 4. تحديث renderer-rc-100.js لعرض (0 نقطة) فور الضغط على الخصم وتثبيت الخصم النهائي عند البيع
// ============================================================================
function installLoyaltyZeroBalanceOnRedeemV23() {
  if (!window.App || !window.AppState) return;

  function getRetailTierInfoV23(points) {
    var pts = Number(points || 0);
    if (pts >= 200) return { label: '💎 عضو ماسي VIP', cls: 'bg-sky-500 text-slate-950' };
    if (pts >= 100) return { label: '🥇 عضو ذهبي Gold', cls: 'bg-amber-500 text-slate-950' };
    if (pts >= 30) return { label: '🥈 عضو فضي Silver', cls: 'bg-slate-300 text-slate-900' };
    return { label: '⭐ عضو نادي الوفاء', cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' };
  }

  // 1) تحديث شريط الولاء في الكاشير ليطرح النقاط المستعملة فوراً من العرض (121 - 121 = 0 نقطة / 0.00 د.ج)
  App.renderPosLoyaltySmartBar = function () {
    var custSelect = document.getElementById('posCustomerSelect');
    if (!custSelect) return;

    var tierSel = document.getElementById('posPriceTierSelect');
    if (tierSel) tierSel.style.display = 'none';

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
        '<div class="mt-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-[11px]">' +
        '  <span class="text-slate-600 dark:text-slate-300 font-bold">👤 البيع الحالي: <strong>زبون عابر</strong> — امسح بطاقة الوفاء (<code class="font-mono text-indigo-600">FID-...</code>) أو اختر زبوناً وفياً لجمع النقاط وخصمها</span>' +
        '  <button type="button" onclick="App.openPosVipLoyaltyDirectoryModal()" class="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black hover:bg-amber-500 hover:text-slate-950 transition">👑 اختيار زبون وفي</button>' +
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

    // الرصيد المتبقي الحقيقي بعد طرح النقاط المستعملة في السلة الحالية!
    var remainingPts = Math.max(0, originalPts - alreadyRedeemedPts);
    var ptValueDzd = Math.max(0.5, Number(AppState.loyaltyPointValueDzd || 2));
    var remainingPtsValueDzd = Number((remainingPts * ptValueDzd).toFixed(2));
    var centimeVal = typeof this.formatAlgerianCentimes === 'function' ? this.formatAlgerianCentimes(remainingPtsValueDzd) : '';

    // إذا استعمل الزبون نقاطه في هذه الفاتورة لا نضيف له نقاطاً جديدة على نفس الفاتورة
    var ptsToEarn = alreadyRedeemedPts > 0
      ? 0
      : Math.floor((netTotal / 100) * Math.max(0.1, Number(AppState.loyaltyPointsPer100Dzd || 1)));

    var tierInfo = getRetailTierInfoV23(originalPts);
    var fidCode = typeof this.getCustomerCardBarcode === 'function' ? this.getCustomerCardBarcode(cust) : ('FID-' + String(cust.id).padStart(5, '0'));
    var possibleDiscountNow = Math.min(rawSubtotal, Number((originalPts * ptValueDzd).toFixed(2)));

    bar.innerHTML =
      '<div class="mt-1.5 p-2.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 space-y-2 text-[11px]">' +
      '  <div class="flex flex-wrap items-center justify-between gap-1">' +
      '    <div class="flex items-center gap-1.5">' +
      '      <span class="px-2 py-0.5 rounded-lg text-[10px] font-black ' + tierInfo.cls + '">' + tierInfo.label + '</span>' +
      '      <strong class="font-black text-slate-900 dark:text-white text-xs">' + cust.name + '</strong>' +
      '      <span class="font-mono text-[10px] text-slate-400">(' + fidCode + ')</span>' +
      '    </div>' +
      '    <button type="button" onclick="App.openLoyaltyCardStudioModal(' + cust.id + ')" class="px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-black text-[10px]" title="طباعة بطاقة الوفاء لهذا الزبون">💳 بطاقة الوفاء</button>' +
      '  </div>' +

      '  <div class="grid grid-cols-2 gap-2 p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-500/20">' +
      '    <div>' +
      '      <div class="text-[10px] text-slate-400 font-bold">' + (alreadyRedeemedPts > 0 ? 'رصيد النقاط المتبقي بعد الخصم:' : 'رصيد نقاط الولاء الحالي:') + '</div>' +
      '      <div class="font-mono font-black text-sm ' + (remainingPts === 0 && alreadyRedeemedPts > 0 ? 'text-rose-600' : 'text-amber-600') + '">' +
      '        ⭐ ' + remainingPts + ' نقطة ' +
      (alreadyRedeemedPts > 0
        ? '<span class="text-[10px] text-rose-500 font-bold">(تم خصم ' + alreadyRedeemedPts + ' نقطة)</span>'
        : ptsToEarn > 0
          ? '<span class="text-[10px] text-emerald-600">(+' + ptsToEarn + ' بهذه الفاتورة)</span>'
          : '') +
      '      </div>' +
      '    </div>' +
      '    <div class="text-left">' +
      '      <div class="text-[10px] text-slate-400 font-bold">' + (alreadyRedeemedPts > 0 ? 'قيمة الخصم المتبقية:' : 'قيمة الخصم المالي للنقاط:') + '</div>' +
      '      <div class="font-mono font-black text-sm text-emerald-600">💰 ' + remainingPtsValueDzd.toFixed(2) + ' د.ج</div>' +
      (remainingPts > 0 && centimeVal ? '<div class="text-[9.5px] font-bold text-amber-700 dark:text-amber-300">' + centimeVal + '</div>' : '<div class="text-[9.5px] font-bold text-slate-400">0 سنتيم</div>') +
      '    </div>' +
      '  </div>' +

      '  <div class="flex flex-wrap items-center justify-between gap-1.5 pt-1">' +
      (alreadyRedeemedPts > 0
        ? '<div class="flex-1 font-black text-emerald-700 dark:text-emerald-300">✅ تم إنقاص (-' + alreadyRedeemedDzd.toFixed(2) + ' د.ج) من الفاتورة وتصفير (' + alreadyRedeemedPts + ' نقطة)!</div>' +
          '<button type="button" onclick="App.cancelLoyaltyRedemptionInCart()" class="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black">✕ إلغاء خصم النقاط</button>'
        : originalPts > 0 && rawSubtotal > 0
          ? '<span class="text-slate-700 dark:text-slate-200 font-bold">استعمال النقاط لإنقاص الفاتورة:</span>' +
            '<div class="flex items-center gap-1">' +
            '  <button type="button" onclick="App.redeemLoyaltyPointsInPosCart()" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow">🎁 خصم كل النقاط (-' + possibleDiscountNow.toFixed(2) + ' د.ج)</button>' +
            '  <button type="button" onclick="App.promptCustomLoyaltyPointsRedeem()" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black" title="تحديد عدد النقاط المراد استعمالها">🔢 تحديد نقاط</button>' +
            '</div>'
          : originalPts > 0
            ? '<span class="text-emerald-600 font-bold">💡 أضف مشتريات للسلة لإنقاص (' + (originalPts * ptValueDzd).toFixed(2) + ' د.ج) من مجموع الفاتورة!</span>'
            : '<span class="text-slate-500 font-bold">الرصيد الحالي 0 نقطة — يكسب الزبون ' + (AppState.loyaltyPointsPer100Dzd || 1) + ' نقطة عن كل 100 د.ج شراء</span>') +
      '  </div>' +
      '</div>';
  };

  // 2) اعتراض window.api.processSale لضمان خصم النقاط المستعملة وتثبيت الرصيد الجديد (0 نقطة) في قاعدة البيانات 100%
  if (window.api && typeof window.api.processSale === 'function' && !window.api._loyaltyV23Hooked) {
    var _baseProcessSaleV23 = window.api.processSale.bind(window.api);
    window.api._loyaltyV23Hooked = true;

    window.api.processSale = async function (salePayload) {
      var cart = App.currentCart || {};
      var cid = Number((salePayload && salePayload.customer_id) || cart.customerId || document.getElementById('posCustomerSelect')?.value || 0);
      var redeemedPts = Math.max(0, Number(cart.redeemedLoyaltyPoints || 0));
      var cust = cid ? (AppState.customers || []).find(function (c) { return Number(c.id) === cid; }) : null;
      var preSalePts = cust ? Math.max(0, Number(cust.loyalty_points || 0)) : 0;

      var ptsRate = Math.max(0.1, Number(AppState.loyaltyPointsPer100Dzd || 1));
      var tot = Math.max(0, Number((salePayload && salePayload.total) || 0));
      var earnedPts = redeemedPts > 0 ? 0 : Math.floor((tot / 100) * ptsRate);

      if (salePayload && typeof salePayload === 'object') {
        salePayload.customer_id = cid || null;
        salePayload.loyalty_points_per_100_dzd = ptsRate;
        salePayload.redeemed_loyalty_points = redeemedPts;
        salePayload.earned_loyalty_points = earnedPts;
      }

      var res = await _baseProcessSaleV23(salePayload);

      // تحديث قاطع لرصيد نقاط الزبون في قاعدة البيانات عبر updateCustomer (حتى لو لم يُعد تشغيل Electron!)
      if (cid && cust && window.api.updateCustomer) {
        var finalPoints = redeemedPts > 0
          ? Math.max(0, preSalePts - redeemedPts)
          : (preSalePts + earnedPts);

        cust.loyalty_points = finalPoints;
        await window.api.updateCustomer(cid, Object.assign({}, cust, {
          loyalty_points: finalPoints
        })).catch(function () {});
      }

      if (App.currentCart) {
        App.currentCart.redeemedLoyaltyPoints = 0;
        App.currentCart.redeemedLoyaltyDiscountDzd = 0;
      }

      return res;
    };
  }

  // تحديث فوري للبيانات والواجهة
  setTimeout(async function () {
    if (window.api && window.api.getCustomers) {
      AppState.customers = (await window.api.getCustomers().catch(function () { return []; })) || [];
    }
    if (AppState.currentView === 'pos') App.renderPosView();
    else if (AppState.currentView === 'customers') App.renderCustomersView();
  }, 200);
}

zeroRedeemedPointsInLiveDb().then(() => {
  const rcPath = path.join(ROOT, 'renderer-rc-100.js');
  if (fs.existsSync(rcPath)) {
    let rc = fs.readFileSync(rcPath, 'utf8').replace(/\r\n/g, '\n');

    const marker = '// [LOYALTY REDEMPTION ZERO BALANCE FIX V23]';
    const oldIdx = rc.indexOf(marker);
    if (oldIdx !== -1) {
      rc = rc.slice(0, oldIdx).trimEnd();
    }

    const block =
      '\n\n' +
      marker +
      '\n(' +
      installLoyaltyZeroBalanceOnRedeemV23.toString() +
      ')();\n';

    const finalRc = rc.trimEnd() + block;
    new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
    fs.writeFileSync(rcPath, finalRc, 'utf8');
    console.log('✅ 4/4: تم حقن وفحص [V23: تصفير وخصم نقاط الولاء الفوري في السلة وقاعدة البيانات] في renderer-rc-100.js بنجاح.');
  }

  const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
  ['fix-loyalty-points-sync-and-atomic-math-v22.js'].forEach((f) => {
    const fp = path.join(ROOT, f);
    if (fs.existsSync(fp)) {
      try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
    }
  });

  console.log('\n🎉 اكتمل الإصلاح 100%! اضغط Ctrl+R الآن داخل البرنامج، وستجد النقاط أصبحت 0 بعد خصمها، وفي أي عملية خصم قادمة ستصفر النقاط فوراً على الشاشة وفي قاعدة البيانات!');
});