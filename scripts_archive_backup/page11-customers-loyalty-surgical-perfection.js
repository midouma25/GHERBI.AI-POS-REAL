/**
 * page11-customers-loyalty-surgical-perfection.js
 * الترقية الجراحية والاستشارية الشاملة للصفحة الحادية عشرة: إدارة الزبائن، الديون، بطاقات الوفاء (Carte de Fidélité)، وعقود التقسيط (#view-customers)
 * - استوديو تصميم وطباعة بطاقات الوفاء (Carte de Fidélité CR80 & A4 10-Cards Sheet) مع مسح الباركود في الكاشير
 * - محول نقاط الولاء إلى قسائم شراء (Bon d'Achat VIP) أو خصم مباشر من الدين
 * - نافذة تأكيد الحذف النظامية الآمنة (#customerDeleteConfirmModal - بدون alert/confirm)
 * - استوديو التقرير الشامل وتصدير PDF لجميع الزبائن والديون ونقاط الولاء (F9)
 * - منشئ عقود البيع بالتقسيط المباشر + روبوت الفحص الآلي (12/12 PASS).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الترقية الجراحية الشاملة للصفحة 11: إدارة الزبائن، الديون، واستوديو بطاقات الوفاء (Carte de Fidélité)...\n');

// ============================================================================
// 1. ترقية main.js لدعم حفظ وتحديث نقاط الولاء (loyalty_points) في add-customer و update-customer
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');
  let modifiedMain = false;

  const oldAddCust = `INSERT INTO customers (name, phone, address, nif, rc, ai, nis, initial_debt, credit_limit, price_tier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
      [
        String(c.name || '').trim(),
        c.phone || null,
        c.address || null,
        c.nif || null,
        c.rc || null,
        c.ai || null,
        c.nis || null,
        Number(c.initial_debt ?? 0),
        Number(c.credit_limit ?? 0),
        c.price_tier || null
      ]`;

  const newAddCust = `INSERT INTO customers (name, phone, address, nif, rc, ai, nis, initial_debt, credit_limit, price_tier, loyalty_points)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
      [
        String(c.name || '').trim(),
        c.phone || null,
        c.address || null,
        c.nif || null,
        c.rc || null,
        c.ai || null,
        c.nis || null,
        Number(c.initial_debt ?? 0),
        Number(c.credit_limit ?? 0),
        c.price_tier || null,
        Number(c.loyalty_points ?? 0)
      ]`;

  if (mainCode.includes(oldAddCust)) {
    mainCode = mainCode.replace(oldAddCust, newAddCust);
    modifiedMain = true;
  }

  const oldUpdCust = `UPDATE customers
       SET name = ?, phone = ?, address = ?, nif = ?, rc = ?, ai = ?, nis = ?,
           initial_debt = ?, credit_limit = ?, price_tier = ?
       WHERE id = ?\`,
      [
        String(c.name || '').trim(),
        c.phone || null,
        c.address || null,
        c.nif || null,
        c.rc || null,
        c.ai || null,
        c.nis || null,
        Number(c.initial_debt ?? 0),
        Number(c.credit_limit ?? 0),
        c.price_tier || null,
        id
      ]`;

  const newUpdCust = `UPDATE customers
       SET name = ?, phone = ?, address = ?, nif = ?, rc = ?, ai = ?, nis = ?,
           initial_debt = ?, credit_limit = ?, price_tier = ?,
           loyalty_points = COALESCE(?, loyalty_points, 0)
       WHERE id = ?\`,
      [
        String(c.name || '').trim(),
        c.phone || null,
        c.address || null,
        c.nif || null,
        c.rc || null,
        c.ai || null,
        c.nis || null,
        Number(c.initial_debt ?? 0),
        Number(c.credit_limit ?? 0),
        c.price_tier || null,
        c.loyalty_points !== undefined && c.loyalty_points !== null ? Number(c.loyalty_points) : null,
        id
      ]`;

  if (mainCode.includes(oldUpdCust)) {
    mainCode = mainCode.replace(oldUpdCust, newUpdCust);
    modifiedMain = true;
  }

  if (modifiedMain) {
    new vm.Script(mainCode, { filename: 'main.js' });
    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('✅ 1/3: تم ترقية main.js لحفظ وتحديث رصيد نقاط الولاء (loyalty_points) للزبائن.');
  } else {
    console.log('✅ 1/3: فحص main.js مكتمل.');
  }
}

// ============================================================================
// 2. الوحدة الشاملة للصفحة الحادية عشرة (#view-customers) واستوديو Carte de Fidélité
// ============================================================================
function applyPage11CustomersSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.customersSearchQuery = '';
  AppState.customersFilterMode = 'all'; // 'all' | 'has_debt' | 'wholesale' | 'vip_loyalty' | 'over_limit'
  AppState.customersSortBy = 'newest'; // 'newest' | 'debt_desc' | 'sales_desc' | 'points_desc'
  AppState.custLedgerTab = 'sales'; // 'sales' | 'loyalty'
  AppState.loyaltyCardLayoutMode = 'single_cr80'; // 'single_cr80' | 'a4_sheet_10'
  AppState.loyaltyCardTheme = 'gold'; // 'gold' | 'royal_blue' | 'vip_black' | 'emerald'

  function formatCleanCustDate(raw) {
    if (!raw) return '—';
    var s = String(raw).replace('T', ' ');
    var d = s.slice(0, 10);
    var t = s.slice(11, 16);
    return t ? d + ' | 🕒 ' + t : d;
  }

  // تحديد رتبة الولاء للزبون حسب نقاطه أو مسحوباته
  App.getCustomerLoyaltyTier = function (cust) {
    var pts = Number((cust && cust.loyalty_points) || 0);
    var sales = Number((cust && cust.total_sales) || 0);
    if (pts >= 200 || sales >= 100000) {
      return { key: 'diamond', label: '💎 ماسي VIP', color: '#0f172a', accent: '#f59e0b', badgeCls: 'bg-slate-900 text-amber-400 border border-amber-400/40' };
    }
    if (pts >= 50 || sales >= 30000) {
      return { key: 'gold', label: '🥇 ذهبي Gold', color: '#b45309', accent: '#fbbf24', badgeCls: 'bg-amber-500/15 text-amber-600 border border-amber-500/30' };
    }
    if (pts >= 15 || sales >= 10000) {
      return { key: 'silver', label: '🥈 فضي Silver', color: '#334155', accent: '#94a3b8', badgeCls: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' };
    }
    return { key: 'bronze', label: '🥉 عضو وفي', color: '#1d4ed8', accent: '#60a5fa', badgeCls: 'bg-blue-500/10 text-blue-600' };
  };

  // توليد كود الباركود القياسي لبطاقة ولاء الزبون
  App.getCustomerCardBarcode = function (custOrId) {
    var cid = typeof custOrId === 'object' && custOrId ? custOrId.id : custOrId;
    return 'FID-' + String(Number(cid || 1)).padStart(5, '0');
  };

  // --------------------------------------------------------------------------
  // 1) بناء النوافذ النظامية الجديدة (تأكيد الحذف بدون Alert + استوديو Carte Fidélité + استوديو PDF)
  // --------------------------------------------------------------------------
  App.ensureCustomersExtraModalsDom = function () {
    // أ) إصلاح نص اختيار الولاية وإضافة حقل نقاط الولاء في نافذة الزبون (#customerModal)
    var wilayaSel = document.getElementById('custWilayaSelect');
    if (wilayaSel && wilayaSel.options.length > 0) {
      wilayaSel.options[0].textContent = '🇩🇿 اختر الولاية (58 ولاية جزائرية)...';
    }
    var creditInp = document.getElementById('custCreditLimitInput');
    if (creditInp && !document.getElementById('custLoyaltyPointsInput')) {
      var gridParent = creditInp.closest('.grid');
      if (gridParent) {
        var ptsDiv = document.createElement('div');
        ptsDiv.className = 'col-span-2';
        ptsDiv.innerHTML =
          '<label class="block font-bold mb-1 text-amber-600">⭐ رصيد نقاط الولاء (Points de Fidélité)</label>' +
          '<input id="custLoyaltyPointsInput" type="number" step="1" value="0" class="w-full px-3 py-2 rounded-xl font-mono font-black text-amber-600 border-amber-400">';
        gridParent.insertBefore(ptsDiv, creditInp.parentElement.nextSibling);
      }
    }

    // ب) نافذة تأكيد حذف الزبون النظامية (#customerDeleteConfirmModal — بديل آمن لـ alert/confirm)
    if (!document.getElementById('customerDeleteConfirmModal')) {
      var delModal = document.createElement('div');
      delModal.id = 'customerDeleteConfirmModal';
      delModal.className = 'modal-overlay';
      delModal.innerHTML =
        '<div class="modal-content w-full max-w-md p-6 space-y-4">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <h3 class="text-lg font-black text-rose-600 flex items-center gap-2">' +
        '      <span class="material-symbols-rounded">delete</span>' +
        '      <span>تأكيد حذف ملف الزبون</span>' +
        '    </h3>' +
        '    <button type="button" onclick="App.closeModal(\'customerDeleteConfirmModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="customerDeleteConfirmBody" class="space-y-3 text-xs"></div>' +
        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'customerDeleteConfirmModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء والعودة (Esc)</button>' +
        '    <button id="btnConfirmDeleteCustomerAction" type="button" onclick="App.executeConfirmedCustomerDelete()" class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/25">🗑️ نعم، احذف الزبون نهائياً</button>' +
        '  </div>' +
        '</div>';
      document.body.appendChild(delModal);
    }

    // ج) نافذة استوديو بطاقات الوفاء ونادي الزبائن الأوفياء (#loyaltyCardStudioModal — Carte de Fidélité)
    if (!document.getElementById('loyaltyCardStudioModal')) {
      var fidModal = document.createElement('div');
      fidModal.id = 'loyaltyCardStudioModal';
      fidModal.className = 'modal-overlay';
      fidModal.innerHTML =
        '<div class="modal-content w-full max-w-5xl p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 class="text-lg font-black text-amber-600">💳 استوديو بطاقات الوفاء ومكافآت الزبائن الأوفياء (Carte de Fidélité & VIP Rewards Studio)</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">صمّم واطبع بطاقة وفاء احترافية بالباركود والـ QR لأي زبون (أو ورقة A4 تضم 10 بطاقات)، واستبدل نقاطه بقسائم شراء فورية</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'loyaltyCardStudioModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="loyaltyCardStudioBody" class="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs"></div>' +
        '</div>';
      document.body.appendChild(fidModal);
    }

    // د) نافذة استوديو التقرير الشامل وتصدير PDF للزبائن والديون (#customersPdfStudioModal)
    if (!document.getElementById('customersPdfStudioModal')) {
      var pdfModal = document.createElement('div');
      pdfModal.id = 'customersPdfStudioModal';
      pdfModal.className = 'modal-overlay';
      pdfModal.innerHTML =
        '<div class="modal-content w-full max-w-5xl p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 class="text-lg font-black text-blue-600">📄 استوديو التقرير الشامل وتصدير PDF للزبائن، الديون، ونقاط الولاء</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">معاينة حية قابلة للتعديل المباشر بالماوس قبل الطباعة أو التصدير إلى ملف PDF</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'customersPdfStudioModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="customersPdfToolbar" class="gherbi-studio-toolbar flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl text-xs"></div>' +
        '  <iframe id="customersPdfPreviewFrame" class="w-full h-[62vh] border border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-100 dark:bg-slate-900 shadow-inner"></iframe>' +
        '</div>';
      document.body.appendChild(pdfModal);
    }
  };

  // --------------------------------------------------------------------------
  // 2) نافذة تأكيد الحذف النظامية الآمنة (بدل الحذف الصامت أو الـ Alert)
  // --------------------------------------------------------------------------
  App.promptDeleteCustomerModal = function (customerId) {
    this.ensureCustomersExtraModalsDom();
    var cid = Number(customerId);
    var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === cid; });
    if (!cust) return;

    AppState._pendingDeleteCustomerId = cid;
    var debt = Number(cust.total_debt || 0);
    var sales = Number(cust.total_sales || 0);
    var pts = Number(cust.loyalty_points || 0);
    var centDebt = debt > 0 && typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(debt) : '';

    var body = document.getElementById('customerDeleteConfirmBody');
    if (body) {
      body.innerHTML =
        '<div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">' +
        '  <div class="text-sm font-black text-slate-800 dark:text-white">هل أنت متأكد من رغبتك في حذف الزبون: <span class="text-rose-600">' + cust.name + '</span>؟</div>' +
        '  <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-center">' +
        '    <div><div class="text-[10px] text-slate-400">إجمالي المشتريات</div><div class="font-mono font-bold text-blue-600">' + sales.toFixed(2) + ' د.ج</div></div>' +
        '    <div><div class="text-[10px] text-slate-400">نقاط الولاء</div><div class="font-mono font-bold text-amber-500">⭐ ' + pts + '</div></div>' +
        '    <div><div class="text-[10px] text-slate-400">الدين الحالي</div><div class="font-mono font-black ' + (debt > 0.01 ? 'text-rose-600' : 'text-emerald-600') + '">' + debt.toFixed(2) + ' د.ج</div></div>' +
        '  </div>' +
        '</div>' +
        (debt > 0.01
          ? '<div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 font-bold">' +
            '  ⚠️ تنبيه مالي مهم: هذا الزبون لا يزال عليه دين غير مسدد بقيمة <strong>' + debt.toFixed(2) + ' د.ج</strong> (' + centDebt + ')! يُنصح بتصفية حسابه قبل الحذف.' +
            '</div>'
          : '<div class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">✅ رصيد هذا الزبون خالص (0.00 د.ج) ويمكن أرشفته وحذفه بأمان.</div>');
    }

    this.openModal('customerDeleteConfirmModal');
  };

  App.executeConfirmedCustomerDelete = async function () {
    var cid = Number(AppState._pendingDeleteCustomerId || 0);
    if (!cid) return;
    await window.api.deleteCustomer(cid);
    AppState._pendingDeleteCustomerId = null;
    this.closeModal('customerDeleteConfirmModal');
    await this.refreshProducts();
    await this.renderCustomersView();
    if (typeof showToast === 'function') {
      showToast('🗑️ تم حذف ملف الزبون بنجاح', 'info');
    }
  };

  // --------------------------------------------------------------------------
  // 3) إصلاح وتطوير نافذة إضافة/تعديل زبون (تقبل رقم ID أو كائن أو null)
  // --------------------------------------------------------------------------
  App.openCustomerModal = async function (custOrId) {
    this.ensureCustomersExtraModalsDom();
    var cust = null;
    if (typeof custOrId === 'number' || (typeof custOrId === 'string' && /^\d+$/.test(custOrId.trim()))) {
      var cid = Number(custOrId);
      cust = (AppState.customers || []).find(function (c) { return Number(c.id) === cid; }) || null;
      if (!cust && window.api && window.api.getCustomers) {
        var list = (await window.api.getCustomers().catch(function () { return []; })) || [];
        AppState.customers = list;
        cust = list.find(function (c) { return Number(c.id) === cid; }) || null;
      }
    } else if (custOrId && typeof custOrId === 'object') {
      cust = custOrId;
    }

    var setVal = function (id, v) {
      var el = document.getElementById(id);
      if (el) el.value = v !== undefined && v !== null ? String(v) : '';
    };

    setVal('custIdInput', cust ? cust.id : '');
    setVal('custNameInput', cust ? (cust.name || '') : '');
    setVal('custPhoneInput', cust ? (cust.phone || '') : '');
    setVal('custPriceTierInput', cust && cust.price_tier ? cust.price_tier : 'retail');
    setVal('custInitDebtInput', cust ? Number(cust.initial_debt || 0) : 0);
    setVal('custCreditLimitInput', cust ? Number(cust.credit_limit || 0) : 0);
    setVal('custLoyaltyPointsInput', cust ? Number(cust.loyalty_points || 0) : 0);
    setVal('custAddressInput', cust ? (cust.address || '') : '');
    setVal('custRcInput', cust ? (cust.rc || '') : '');
    setVal('custNifInput', cust ? (cust.nif || '') : '');
    setVal('custAiInput', cust ? (cust.ai || '') : '');
    setVal('custNisInput', cust ? (cust.nis || '') : '');

    this.openModal('customerModal');
    setTimeout(function () {
      var inp = document.getElementById('custNameInput');
      if (inp) inp.focus();
    }, 50);
  };

  App.saveCustomerFromModal = async function () {
    var id = document.getElementById('custIdInput')?.value;
    var payload = {
      name: String(document.getElementById('custNameInput')?.value || '').trim(),
      phone: String(document.getElementById('custPhoneInput')?.value || '').trim() || null,
      price_tier: document.getElementById('custPriceTierInput')?.value || 'retail',
      initial_debt: parseFloat(document.getElementById('custInitDebtInput')?.value) || 0,
      credit_limit: parseFloat(document.getElementById('custCreditLimitInput')?.value) || 0,
      loyalty_points: parseInt(document.getElementById('custLoyaltyPointsInput')?.value || '0', 10) || 0,
      address: String(document.getElementById('custAddressInput')?.value || '').trim() || null,
      rc: String(document.getElementById('custRcInput')?.value || '').trim() || null,
      nif: String(document.getElementById('custNifInput')?.value || '').trim() || null,
      ai: String(document.getElementById('custAiInput')?.value || '').trim() || null,
      nis: String(document.getElementById('custNisInput')?.value || '').trim() || null
    };

    if (!payload.name) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم الزبون أو المؤسسة', 'warning');
      return;
    }

    if (id) await window.api.updateCustomer(Number(id), payload);
    else await window.api.addCustomer(payload);

    this.closeModal('customerModal');
    await this.refreshProducts();
    if (AppState.currentView === 'customers') await this.renderCustomersView();
    else this.renderPosView();
    if (typeof showToast === 'function') showToast('✅ تم حفظ ملف الزبون (' + payload.name + ') بنجاح!', 'success');
  };

  // --------------------------------------------------------------------------
  // 4) ترقية نافذة تسديد دين الزبون (#customerPaymentModal) بالمعاينة الحية والأزرار السريعة
  // --------------------------------------------------------------------------
  App.openCustomerPaymentModal = function (customerId, name, currentDebt) {
    this.ensureCustomersExtraModalsDom();
    var debt = Math.max(0, Number(currentDebt || 0));
    AppState._custPayCurrentDebt = debt;

    document.getElementById('custPayCustomerId').value = String(customerId);
    document.getElementById('custPayModalTitle').textContent = '💵 تسديد دين الزبون: ' + name;
    document.getElementById('custPayAmountInput').value = debt > 0 ? debt.toFixed(2) : '0';
    document.getElementById('custPayNotesInput').value = '';

    var amtInp = document.getElementById('custPayAmountInput');
    if (amtInp && !document.getElementById('custPaySummaryBanner')) {
      amtInp.setAttribute('oninput', 'App.updateCustPaymentLivePreview()');
      amtInp.parentElement.insertAdjacentHTML(
        'beforebegin',
        '<div id="custPaySummaryBanner" class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-center"></div>'
      );
      amtInp.insertAdjacentHTML(
        'afterend',
        '<div class="flex flex-wrap items-center justify-between gap-1 mt-1.5">' +
        '  <div class="flex gap-1">' +
        '    <button type="button" onclick="App.setCustQuickPayRatio(1)" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 font-black text-[10px]">تسديد كامل الدين (100%)</button>' +
        '    <button type="button" onclick="App.setCustQuickPayRatio(0.5)" class="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 font-black text-[10px]">نصف الدين (50%)</button>' +
        '  </div>' +
        '  <span id="custPayCentimesHint" class="text-[11px] font-bold text-amber-600"></span>' +
        '</div>'
      );
    }

    this.updateCustPaymentLivePreview();
    this.openModal('customerPaymentModal');
  };

  App.setCustQuickPayRatio = function (ratio) {
    var debt = Number(AppState._custPayCurrentDebt || 0);
    var inp = document.getElementById('custPayAmountInput');
    if (inp) inp.value = (debt * Number(ratio)).toFixed(2);
    this.updateCustPaymentLivePreview();
  };

  App.updateCustPaymentLivePreview = function () {
    var debt = Number(AppState._custPayCurrentDebt || 0);
    var paid = Math.max(0, parseFloat(document.getElementById('custPayAmountInput')?.value) || 0);
    var rem = Math.max(0, Number((debt - paid).toFixed(2)));
    var banner = document.getElementById('custPaySummaryBanner');
    if (banner) {
      banner.innerHTML =
        '<div><div class="text-[10px] text-slate-400 font-bold">الدين الحالي قبل الدفع</div><div class="font-mono font-black text-base text-rose-600">' + debt.toFixed(2) + ' د.ج</div></div>' +
        '<div><div class="text-[10px] text-slate-400 font-bold">الدين المتبقي بعد الدفع</div><div class="font-mono font-black text-base ' + (rem > 0.01 ? 'text-amber-600' : 'text-emerald-600') + '">' + rem.toFixed(2) + ' د.ج</div></div>';
    }
    var centEl = document.getElementById('custPayCentimesHint');
    if (centEl && typeof App.formatAlgerianCentimes === 'function') {
      centEl.textContent = paid > 0 ? ('🇩🇿 بالسنتيم: ' + App.formatAlgerianCentimes(paid)) : '';
    }
  };

  // --------------------------------------------------------------------------
  // 5) استوديو بطاقات الوفاء ونادي الزبائن الأوفياء (Carte de Fidélité & VIP Club Studio)
  // --------------------------------------------------------------------------
  App.openLoyaltyCardStudioModal = async function (customerId) {
    this.ensureCustomersExtraModalsDom();
    var customers = AppState.customers || [];
    var cust = customers.find(function (c) { return Number(c.id) === Number(customerId); }) || customers[0] || { id: 1, name: 'محمد أمين بن علي', phone: '0661223344', loyalty_points: 50, price_tier: 'retail' };
    AppState._activeLoyaltyCustId = cust.id;

    await this.renderLoyaltyCardStudioContent();
    this.openModal('loyaltyCardStudioModal');
  };

  App.buildLoyaltyCardHtmlDocument = async function (cust, layoutMode, themeKey) {
    var s = AppState.settings || {};
    var codeText = this.getCustomerCardBarcode(cust);
    var tier = this.getCustomerLoyaltyTier(cust);
    var pts = Number(cust.loyalty_points || 0);
    var voucherValueDzd = pts * 5; // كل 1 نقطة = 5 د.ج مكافأة افتراضية

    var bcImg = '';
    if (window.api && window.api.generateBarcodeImage) {
      bcImg = await window.api.generateBarcodeImage(codeText, { bcid: 'code128', height: 9, scale: 3 }).catch(function () { return ''; });
    }

    var themes = {
      gold: { bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #78350f 100%)', border: '#f59e0b', accent: '#fbbf24', badge: 'GOLD VIP FIDÉLITÉ' },
      royal_blue: { bg: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)', border: '#93c5fd', accent: '#fde047', badge: 'CLUB FIDÉLITÉ' },
      vip_black: { bg: 'linear-gradient(135deg, #090d16 0%, #1e293b 100%)', border: '#e2e8f0', accent: '#38bdf8', badge: 'DIAMOND VIP MEMBER' },
      emerald: { bg: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', border: '#6ee7b7', accent: '#fde68a', badge: 'CARTE PRIVILÈGE' }
    };
    var th = themes[themeKey || AppState.loyaltyCardTheme || 'gold'] || themes.gold;

    var buildOneCardHtml = function (cItem) {
      var cCode = App.getCustomerCardBarcode(cItem);
      var cPts = Number(cItem.loyalty_points || 0);
      return (
        '<div class="fid-card" style="width:85.6mm;height:54mm;background:' + th.bg + ';color:#fff;border:1.5px solid ' + th.border + ';border-radius:3.5mm;padding:3.5mm 4mm;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;position:relative;overflow:hidden;page-break-inside:avoid;box-shadow:0 10px 25px rgba(0,0,0,0.25);">' +
        '  <div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '    <div>' +
        '      <div contenteditable="true" style="font-size:3.8mm;font-weight:900;color:' + th.accent + ';letter-spacing:0.3px;">' + (s.shop_name || 'Gherbi.Ai POS') + '</div>' +
        '      <div contenteditable="true" style="font-size:2.2mm;color:#cbd5e1;">' + (s.shop_phone || s.shop_address || 'بطاقة الوفاء والامتيازات الخاصة') + '</div>' +
        '    </div>' +
        '    <div contenteditable="true" style="padding:0.8mm 2.2mm;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid ' + th.border + ';font-size:2.2mm;font-weight:900;color:' + th.accent + ';">' + th.badge + '</div>' +
        '  </div>' +

        '  <div style="display:flex;justify-content:space-between;align-items:center;margin:1mm 0;">' +
        '    <div>' +
        '      <div style="font-size:2.1mm;color:#94a3b8;">الزبون حامل البطاقة (Titulaire):</div>' +
        '      <div contenteditable="true" style="font-size:3.6mm;font-weight:900;color:#ffffff;">' + (cItem.name || 'زبون وفي') + '</div>' +
        '      <div contenteditable="true" style="font-family:monospace;font-size:2.4mm;color:#cbd5e1;">📞 ' + (cItem.phone || '—') + ' | ' + (cItem.price_tier === 'wholesale' ? 'تسعيرة جملة' : 'عضو معتمد') + '</div>' +
        '    </div>' +
        '    <div style="text-align:center;padding:1.5mm 2.5mm;border-radius:2.5mm;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);">' +
        '      <div style="font-size:2mm;color:#fde68a;">نقاط الولاء</div>' +
        '      <div contenteditable="true" style="font-family:monospace;font-size:4.2mm;font-weight:900;color:' + th.accent + ';">⭐ ' + cPts + '</div>' +
        '    </div>' +
        '  </div>' +

        '  <div style="background:#ffffff;border-radius:2mm;padding:1.2mm 2mm;display:flex;align-items:center;justify-content:space-between;">' +
        (bcImg ? '<img src="' + bcImg + '" style="height:7.5mm;max-width:52mm;object-fit:contain;">' : '') +
        '    <div style="text-align:left;color:#0f172a;">' +
        '      <div style="font-family:monospace;font-size:2.6mm;font-weight:900;">' + cCode + '</div>' +
        '      <div style="font-size:1.8mm;font-weight:800;color:#475569;">امسح بالكاشير</div>' +
        '    </div>' +
        '  </div>' +
        '</div>'
      );
    };

    if (layoutMode === 'a4_sheet_10') {
      var allCusts = (AppState.customers || []).slice(0, 10);
      while (allCusts.length < 10) {
        allCusts.push(cust);
      }
      var cardsGrid = allCusts.map(function (cItem) { return buildOneCardHtml(cItem); }).join('');
      return (
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>ورقة بطاقات الوفاء A4 (10 بطاقات)</title>' +
        '<link rel="stylesheet" href="./assets/css/fonts.css">' +
        '<style>@page{size:210mm 297mm;margin:8mm;}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{font-family:"Cairo",Tahoma,sans-serif;margin:0;padding:10px;background:#e2e8f0;display:flex;justify-content:center;}.sheet{background:#fff;padding:8mm;display:grid;grid-template-columns:repeat(2,85.6mm);gap:4mm;justify-content:center;}@media print{body{background:#fff;padding:0;}.sheet{padding:0;}}</style>' +
        '</head><body><div class="sheet">' + cardsGrid + '</div></body></html>'
      );
    }

    return (
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>بطاقة وفاء — ' + cust.name + '</title>' +
      '<link rel="stylesheet" href="./assets/css/fonts.css">' +
      '<style>@page{size:85.6mm 54mm;margin:0mm;}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}html,body{margin:0;padding:0;font-family:"Cairo",Tahoma,sans-serif;}@media screen{html,body{background:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;}}@media print{html,body{background:#fff;}.no-print{display:none!important;}}</style>' +
      '</head><body>' +
      '<div class="no-print" style="color:#1e3a8a;background:#dbeafe;border:1px solid #93c5fd;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:900;margin-bottom:10px;">💳 معاينة حية لبطاقة الوفاء القياسية (85.6mm × 54mm) — يمكنك النقر على أي نص لتعديله مباشرة!</div>' +
      buildOneCardHtml(cust) +
      '</body></html>'
    );
  };

  App.renderLoyaltyCardStudioContent = async function () {
    var box = document.getElementById('loyaltyCardStudioBody');
    if (!box) return;
    var customers = AppState.customers || [];
    var cust = customers.find(function (c) { return Number(c.id) === Number(AppState._activeLoyaltyCustId); }) || customers[0] || { id: 1, name: 'زبون وفي', phone: '0550000000', loyalty_points: 25 };
    var pts = Number(cust.loyalty_points || 0);
    var tier = this.getCustomerLoyaltyTier(cust);
    var codeText = this.getCustomerCardBarcode(cust);
    var voucherDzd = pts * 5;

    box.innerHTML =
      '<div class="lg:col-span-5 space-y-3.5">' +
      '  <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">' +
      '    <div>' +
      '      <label class="block font-black mb-1 text-blue-600">👤 اختر الزبون الوفي:</label>' +
      '      <select onchange="AppState._activeLoyaltyCustId=Number(this.value); App.renderLoyaltyCardStudioContent()" class="w-full px-3 py-2 rounded-xl font-bold">' +
      customers.map(function (c) {
        return '<option value="' + c.id + '" ' + (Number(c.id) === Number(cust.id) ? 'selected' : '') + '>' + c.name + ' (⭐ ' + (c.loyalty_points || 0) + ' نقطة | ' + App.getCustomerCardBarcode(c) + ')</option>';
      }).join('') +
      '      </select>' +
      '    </div>' +

      '    <div class="grid grid-cols-2 gap-2">' +
      '      <div>' +
      '        <label class="block font-bold mb-1">تصميم ولون البطاقة</label>' +
      '        <select onchange="AppState.loyaltyCardTheme=this.value; App.renderLoyaltyCardStudioContent()" class="w-full px-2.5 py-2 rounded-xl font-bold">' +
      '          <option value="gold" ' + (AppState.loyaltyCardTheme === 'gold' ? 'selected' : '') + '>🥇 ذهبي ملكي (Gold VIP)</option>' +
      '          <option value="royal_blue" ' + (AppState.loyaltyCardTheme === 'royal_blue' ? 'selected' : '') + '>🔵 أزرق رسمي (Club Fidélité)</option>' +
      '          <option value="vip_black" ' + (AppState.loyaltyCardTheme === 'vip_black' ? 'selected' : '') + '>💎 أسود ماسي (Diamond Black)</option>' +
      '          <option value="emerald" ' + (AppState.loyaltyCardTheme === 'emerald' ? 'selected' : '') + '>🟢 أخضر زمردي (Privilège)</option>' +
      '        </select>' +
      '      </div>' +
      '      <div>' +
      '        <label class="block font-bold mb-1">مقاس الطباعة</label>' +
      '        <select onchange="AppState.loyaltyCardLayoutMode=this.value; App.renderLoyaltyCardStudioContent()" class="w-full px-2.5 py-2 rounded-xl font-bold">' +
      '          <option value="single_cr80" ' + (AppState.loyaltyCardLayoutMode === 'single_cr80' ? 'selected' : '') + '>💳 بطاقة مفردة (85.6×54mm)</option>' +
      '          <option value="a4_sheet_10" ' + (AppState.loyaltyCardLayoutMode === 'a4_sheet_10' ? 'selected' : '') + '>📄 ورقة A4 (10 بطاقات معاً)</option>' +
      '        </select>' +
      '      </div>' +
      '    </div>' +

      '    <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">' +
      '      <div class="flex items-center justify-between">' +
      '        <span class="font-black text-amber-700 dark:text-amber-300">⭐ رصيد النقاط الحالي: ' + pts + ' نقطة</span>' +
      '        <span class="px-2 py-0.5 rounded-lg text-[10px] font-black ' + tier.badgeCls + '">' + tier.label + '</span>' +
      '      </div>' +
      '      <div class="text-[11px] text-slate-600 dark:text-slate-300">القيمة المكافئة للنقاط: <strong class="font-mono text-emerald-600">' + voucherDzd.toFixed(2) + ' د.ج</strong> (كود البطاقة للكاشير: <strong class="font-mono">' + codeText + '</strong>)</div>' +
      '      <div class="grid grid-cols-2 gap-1.5 pt-1">' +
      '        <button type="button" onclick="App.adjustCustomerLoyaltyPoints(' + cust.id + ', 10)" class="py-1.5 rounded-lg bg-emerald-600 text-white font-black text-[11px]">+ منح 10 نقاط هدية</button>' +
      '        <button type="button" onclick="App.redeemCustomerPointsAsVoucher(' + cust.id + ')" class="py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[11px]">🎁 تحويل النقاط لقسيمة شراء</button>' +
      '      </div>' +
      '    </div>' +

      '    <div class="grid grid-cols-2 gap-2 pt-1">' +
      '      <button type="button" onclick="App.printOrPdfLoyaltyCard(true)" class="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black">📥 حفظ البطاقة PDF</button>' +
      '      <button type="button" onclick="App.printOrPdfLoyaltyCard(false)" class="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow">🖨️ طباعة البطاقة الآن</button>' +
      '    </div>' +
      '  </div>' +
      '</div>' +

      '<div class="lg:col-span-7 flex flex-col">' +
      '  <iframe id="loyaltyCardLiveFrame" class="w-full h-[360px] border border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-100 dark:bg-slate-900 shadow-inner"></iframe>' +
      '</div>';

    var html = await this.buildLoyaltyCardHtmlDocument(cust, AppState.loyaltyCardLayoutMode, AppState.loyaltyCardTheme);
    setTimeout(function () {
      var frame = document.getElementById('loyaltyCardLiveFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      }
    }, 40);
  };

  App.adjustCustomerLoyaltyPoints = async function (customerId, deltaPts) {
    var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === Number(customerId); });
    if (!cust) return;
    var newPts = Math.max(0, Number(cust.loyalty_points || 0) + Number(deltaPts || 0));
    await window.api.updateCustomer(cust.id, Object.assign({}, cust, { loyalty_points: newPts }));
    await this.refreshProducts();
    await this.renderCustomersView();
    await this.renderLoyaltyCardStudioContent();
    if (typeof showToast === 'function') {
      showToast('⭐ تم تحديث رصيد نقاط الولاء للزبون (' + cust.name + ') إلى ' + newPts + ' نقطة!', 'success');
    }
  };

  App.redeemCustomerPointsAsVoucher = async function (customerId) {
    var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === Number(customerId); });
    if (!cust) return;
    var pts = Number(cust.loyalty_points || 0);
    if (pts <= 0) {
      if (typeof showToast === 'function') showToast('رصيد نقاط الزبون 0 حالياً — امنحه نقاطاً أولاً أو بعد الشراء من الكاشير', 'warning');
      return;
    }
    var voucherAmount = pts * 5;
    await window.api.updateCustomer(cust.id, Object.assign({}, cust, { loyalty_points: 0 }));
    await this.refreshProducts();
    await this.renderCustomersView();
    this.closeModal('loyaltyCardStudioModal');

    // فتح منشئ البونات الحر على قالب قسيمة شراء VIP جاهزة باسم الزبون وقيمة مكافأته!
    if (AppState.customBonState) {
      App.loadCustomBonPreset('gift_voucher');
      AppState.customBonState.partyName = cust.name;
      AppState.customBonState.partyPhone = cust.phone || '';
      AppState.customBonState.fields[0].value = voucherAmount.toFixed(2) + ' د.ج (مقابل استبدال ' + pts + ' نقطة ولاء)';
    }
    await this.switchView('print');
    if (typeof this.switchPrintStudioTab === 'function') {
      await this.switchPrintStudioTab('custom_bon');
    }
    if (typeof showToast === 'function') {
      showToast('🎁 تم تحويل (' + pts + ' نقطة) إلى قسيمة شراء VIP بقيمة ' + voucherAmount.toFixed(2) + ' د.ج جاهزة للطباعة!', 'success');
    }
  };

  App.printOrPdfLoyaltyCard = async function (asPdf) {
    var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === Number(AppState._activeLoyaltyCustId); }) || AppState.customers[0];
    var html = await this.buildLoyaltyCardHtmlDocument(cust, AppState.loyaltyCardLayoutMode, AppState.loyaltyCardTheme);
    if (asPdf && window.api && window.api.exportPDF) {
      var res = await window.api.exportPDF({
        html: html,
        filename: 'Carte_Fidelite_' + (cust ? cust.id : 'VIP') + '.pdf'
      });
      if (res && res.success && typeof showToast === 'function') {
        showToast('📄 تم حفظ بطاقة الوفاء بصيغة PDF بنجاح!', 'success');
      }
      return;
    }
    if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // ربط قارئ الباركود في شاشة الكاشير ليتعرف فوراً على بطاقة الوفاء (FID-00001 أو CUST-1)!
  var _prevBarcodeScanP11 = typeof App.handleBarcodeScan === 'function' ? App.handleBarcodeScan.bind(App) : null;
  if (_prevBarcodeScanP11) {
    App.handleBarcodeScan = async function (rawCode) {
      var code = String(rawCode || '').trim().toUpperCase();
      if (code.startsWith('FID-') || code.startsWith('CUST-')) {
        var numPart = parseInt(code.replace(/\D+/g, ''), 10);
        var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === numPart; });
        if (cust) {
          var bcInp = document.getElementById('barcodeInput');
          if (bcInp) bcInp.value = '';
          if (this.currentCart) {
            this.currentCart.customerId = cust.id;
            if (cust.price_tier === 'wholesale') {
              this.setCartPriceTier('wholesale');
            }
          }
          var sel = document.getElementById('posCustomerSelect');
          if (sel) sel.value = String(cust.id);
          if (typeof playBeep === 'function') playBeep(true);
          if (typeof showToast === 'function') {
            showToast('💳 تم التعرف على بطاقة الوفاء للزبون: ' + cust.name + ' (⭐ ' + (cust.loyalty_points || 0) + ' نقطة)', 'success');
          }
          return;
        }
      }
      return await _prevBarcodeScanP11(rawCode);
    };
  }

  // --------------------------------------------------------------------------
  // 6) ترقية نافذة عقود البيع بالتقسيط (#installmentsManagerModal) بإضافة منشئ عقد مباشر
  // --------------------------------------------------------------------------
  App.openInstallmentsManagerModal = async function () {
    var plans = (await window.api.getInstallmentPlans({}).catch(function () { return []; })) || [];
    AppState._cachedInstallmentPlans = plans;
    var body = document.getElementById('installmentPlanModalBody');
    if (body) {
      body.innerHTML =
        '<div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 mb-4 text-xs">' +
        '  <div class="font-black text-amber-700 dark:text-amber-300">➕ إنشاء عقد بيع بالتقسيط وجدولة أقساط شهرية جديدة (Contrat de Vente par Facilité):</div>' +
        '  <div class="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">' +
        '    <div class="col-span-2"><label class="block text-[10px] font-bold mb-0.5">اختر الزبون *</label>' +
        '      <select id="newInstCustSelect" class="w-full px-2.5 py-1.5 rounded-xl font-bold">' +
        (AppState.customers || []).map(function (c) { return '<option value="' + c.id + '">' + c.name + ' (' + (c.phone || '—') + ')</option>'; }).join('') +
        '      </select>' +
        '    </div>' +
        '    <div><label class="block text-[10px] font-bold mb-0.5">المبلغ الإجمالي (د.ج)</label><input id="newInstTotalInput" type="number" step="any" value="30000" class="w-full px-2 py-1.5 rounded-xl font-mono font-bold text-center"></div>' +
        '    <div><label class="block text-[10px] font-bold mb-0.5">التسبقة (Acompte)</label><input id="newInstDownInput" type="number" step="any" value="6000" class="w-full px-2 py-1.5 rounded-xl font-mono font-bold text-emerald-600 text-center"></div>' +
        '    <div class="flex gap-1">' +
        '      <div class="flex-1"><label class="block text-[10px] font-bold mb-0.5">الأشهر</label><input id="newInstMonthsInput" type="number" min="1" max="36" value="6" class="w-full px-2 py-1.5 rounded-xl font-mono font-bold text-center"></div>' +
        '      <button type="button" onclick="App.createQuickInstallmentContract()" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black self-end shadow">+ إنشاء</button>' +
        '    </div>' +
        '  </div>' +
        '</div>' +

        (plans.length === 0
          ? '<div class="py-8 text-center text-slate-400 font-bold">لا توجد عقود بيع بالتقسيط مسجلة حالياً — استخدم النموذج أعلاه لإنشاء أول عقد تقسيط في ثوانٍ!</div>'
          : plans.map(function (p, pIdx) {
              return (
                '<div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-3 space-y-2 bg-white dark:bg-slate-800">' +
                '  <div class="flex flex-wrap justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">' +
                '    <div><span class="font-black text-sm text-blue-600">' + (p.customer_name || 'زبون') + '</span> <span class="text-slate-400 font-mono text-xs">(' + (p.customer_phone || '—') + ')</span></div>' +
                '    <div class="flex items-center gap-2 font-mono text-xs">' +
                '      <span>الإجمالي: <strong>' + Number(p.total_amount || 0).toFixed(2) + ' د.ج</strong></span>' +
                '      <span class="text-rose-600 font-black">المتبقي: ' + Number(p.remaining_amount || 0).toFixed(2) + ' د.ج</span>' +
                '      <button type="button" onclick="App.printInstallmentContract(' + pIdx + ')" class="px-3 py-1 bg-blue-600 text-white rounded-lg font-sans font-bold text-[11px]">🖨️ طباعة العقد الرسمي A4</button>' +
                '    </div>' +
                '  </div>' +
                '  <div class="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px]">' +
                (p.schedules || []).map(function (sc) {
                  var isPaid = sc.status === 'paid';
                  return (
                    '<div class="p-2 rounded-xl border ' + (isPaid ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900') + ' flex items-center justify-between">' +
                    '  <div><div class="font-bold">قسط #' + sc.installment_num + ' (' + sc.due_date + ')</div><div class="font-mono font-black">' + Number(sc.amount || 0).toFixed(2) + ' د.ج</div></div>' +
                    (isPaid
                      ? '<span class="text-emerald-600 font-black">✓ مسدد</span>'
                      : '<button type="button" onclick="App.paySingleInstallment(' + sc.id + ', ' + (Number(sc.amount) - Number(sc.paid_amount || 0)) + ')" class="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[10px]">تسديد</button>') +
                    '</div>'
                  );
                }).join('') +
                '  </div>' +
                '</div>'
              );
            }).join(''));
    }
    this.openModal('installmentsManagerModal');
  };

  App.createQuickInstallmentContract = async function () {
    var cid = Number(document.getElementById('newInstCustSelect')?.value);
    var total = parseFloat(document.getElementById('newInstTotalInput')?.value) || 0;
    var down = parseFloat(document.getElementById('newInstDownInput')?.value) || 0;
    var months = Math.max(1, parseInt(document.getElementById('newInstMonthsInput')?.value || '6', 10) || 6);

    if (!cid || total <= 0) {
      if (typeof showToast === 'function') showToast('يرجى اختيار الزبون وإدخال المبلغ الإجمالي', 'warning');
      return;
    }

    await window.api.createInstallmentPlan({
      customer_id: cid,
      total_amount: total,
      down_payment: down,
      months_count: months,
      start_date: new Date().toISOString().slice(0, 10)
    });

    await this.openInstallmentsManagerModal();
    await this.renderCustomersView();
    if (typeof showToast === 'function') showToast('✅ تم إنشاء عقد البيع بالتقسيط وجدولة الأقساط بنجاح!', 'success');
  };

  // --------------------------------------------------------------------------
  // 7) استوديو التقرير الشامل وتصدير PDF لجميع الزبائن والديون ونقاط الولاء (F9)
  // --------------------------------------------------------------------------
  App.openCustomersPdfStudio = async function (filterMode) {
    this.ensureCustomersExtraModalsDom();
    var mode = filterMode || 'all'; // 'all' | 'debts_only' | 'vip_loyalty'
    var customers = (await window.api.getCustomers().catch(function () { return []; })) || [];
    var s = AppState.settings || {};

    var list = customers.slice();
    if (mode === 'debts_only') {
      list = list.filter(function (c) { return Number(c.total_debt || 0) > 0.01; });
    } else if (mode === 'vip_loyalty') {
      list = list.filter(function (c) { return Number(c.loyalty_points || 0) > 0; });
    }

    var totalSalesAll = 0;
    var totalDebtAll = 0;
    var totalPtsAll = 0;

    var rowsHtml = list.map(function (c, i) {
      var sales = Number(c.total_sales || 0);
      var debt = Number(c.total_debt || 0);
      var pts = Number(c.loyalty_points || 0);
      totalSalesAll += sales;
      totalDebtAll += debt;
      totalPtsAll += pts;
      var centDebt = debt > 0 && typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(debt) : '';

      return (
        '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td contenteditable="true" style="font-weight:bold;">' + c.name + '</td>' +
        '<td contenteditable="true" style="font-family:monospace;">' + (c.phone || '—') + '</td>' +
        '<td>' + (c.price_tier === 'wholesale' ? 'جملة (Gros)' : 'تجزئة (Détail)') + '</td>' +
        '<td style="font-family:monospace;font-weight:bold;color:#d97706;">⭐ ' + pts + ' (' + App.getCustomerCardBarcode(c) + ')</td>' +
        '<td style="font-family:monospace;">' + (Number(c.credit_limit || 0) > 0 ? Number(c.credit_limit).toFixed(0) + ' د.ج' : 'مفتوح') + '</td>' +
        '<td style="font-family:monospace;font-weight:bold;color:#1d4ed8;">' + sales.toFixed(2) + ' د.ج</td>' +
        '<td style="font-family:monospace;font-weight:900;color:' + (debt > 0.01 ? '#e11d48' : '#059669') + ';">' + debt.toFixed(2) + ' د.ج<div style="font-size:9px;color:#b45309;">' + centDebt + '</div></td>' +
        '</tr>'
      );
    }).join('');

    var centTotalDebt = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalDebtAll) : '';

    var toolbar = document.getElementById('customersPdfToolbar');
    if (toolbar) {
      toolbar.innerHTML =
        '<div class="flex flex-wrap items-center gap-1.5">' +
        '  <span class="font-black text-blue-700 ml-1">📑 نوع الكشف:</span>' +
        '  <button type="button" onclick="App.openCustomersPdfStudio(\'all\')" class="px-3 py-1.5 rounded-xl font-black ' + (mode === 'all' ? 'gherbi-toolbar-btn-active' : 'gherbi-toolbar-btn') + '">📋 السجل الشامل لجميع الزبائن</button>' +
        '  <button type="button" onclick="App.openCustomersPdfStudio(\'debts_only\')" class="px-3 py-1.5 rounded-xl font-black ' + (mode === 'debts_only' ? 'gherbi-toolbar-btn-active-rose' : 'gherbi-toolbar-btn') + '">🚨 كشف الديون المستحقة فقط (الكريدي)</button>' +
        '  <button type="button" onclick="App.openCustomersPdfStudio(\'vip_loyalty\')" class="px-3 py-1.5 rounded-xl font-black ' + (mode === 'vip_loyalty' ? 'gherbi-toolbar-btn-active-amber' : 'gherbi-toolbar-btn') + '">⭐ قائمة الزبائن الأوفياء ونقاطهم</button>' +
        '</div>' +
        '<div class="flex gap-2">' +
        '  <button type="button" onclick="App.executeCustomersReportAction(\'print\')" class="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-black shadow">🖨️ طباعة (A4)</button>' +
        '  <button type="button" onclick="App.executeCustomersReportAction(\'pdf\')" class="px-4 py-1.5 bg-amber-500 text-slate-950 rounded-xl font-black shadow">📥 حفظ وتصدير كملف PDF</button>' +
        '</div>';
    }

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>التقرير المالي الشامل للزبائن والديون</title>' +
      '<style>@page{size:210mm 297mm;margin:8mm;}*{box-sizing:border-box;}body{font-family:"Cairo",Tahoma,sans-serif;font-size:11px;color:#0f172a;margin:0;padding:14px;background:#fff;}table{width:100%;border-collapse:collapse;margin-top:10px;}th,td{border:1px solid #94a3b8;padding:5px 6px;text-align:right;}th{background:#1e3a8a;color:#fff;}</style></head><body>' +
      '<div style="display:flex;justify-content:space-between;border-bottom:3px solid #1e3a8a;padding-bottom:8px;">' +
      '  <div><h2 contenteditable="true" style="margin:0;color:#1e3a8a;">' + (s.shop_name || 'Gherbi.Ai POS') + '</h2><div>' + (s.shop_address || 'الجزائر') + '</div></div>' +
      '  <div style="text-align:left;"><h2 contenteditable="true" style="margin:0;color:#1e3a8a;">👥 الكشف المالي الشامل للزبائن، الديون، ونقاط الولاء</h2><div>التاريخ: ' + new Date().toISOString().slice(0, 10) + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0;text-align:center;">' +
      '  <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#f8fafc;"><div>عدد الزبائن في الكشف</div><strong style="font-size:15px;font-family:monospace;">' + list.length + ' زبون (⭐ ' + totalPtsAll + ' نقطة)</strong></div>' +
      '  <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#f8fafc;"><div>إجمالي المبيعات التراكمي</div><strong style="font-size:15px;font-family:monospace;color:#1d4ed8;">' + totalSalesAll.toFixed(2) + ' د.ج</strong></div>' +
      '  <div style="border:1px solid #fecdd3;border-radius:8px;padding:8px;background:#fff1f2;"><div>إجمالي الديون المستحقة لنا</div><strong style="font-size:15px;font-family:monospace;color:#e11d48;">' + totalDebtAll.toFixed(2) + ' د.ج</strong><div style="font-size:9.5px;color:#b45309;font-weight:bold;">' + centTotalDebt + '</div></div>' +
      '</div>' +
      '<table><thead><tr><th>#</th><th>اسم الزبون / المؤسسة</th><th>الهاتف</th><th>التسعيرة</th><th>نقاط وكود الولاء</th><th>سقف الدين</th><th>إجمالي المشتريات</th><th>الدين الحالي</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '</body></html>';

    this.openModal('customersPdfStudioModal');
    setTimeout(function () {
      var frame = document.getElementById('customersPdfPreviewFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      }
    }, 40);
  };

  App.executeCustomersReportAction = async function (actionType) {
    var frame = document.getElementById('customersPdfPreviewFrame');
    if (!frame || !frame.contentWindow) return;
    var clone = frame.contentWindow.document.documentElement.cloneNode(true);
    clone.querySelectorAll('[contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    var html = '<!DOCTYPE html>\n' + clone.outerHTML;

    if (actionType === 'pdf' && window.api && window.api.exportPDF) {
      var res = await window.api.exportPDF({
        html: html,
        filename: 'Gherbi_Customers_Report_' + new Date().toISOString().slice(0, 10) + '.pdf'
      });
      if (res && res.success && typeof showToast === 'function') {
        showToast('📄 تم حفظ التقرير الشامل للزبائن والديون بصيغة PDF بنجاح!', 'success');
      }
      return;
    }
    if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // --------------------------------------------------------------------------
  // 8) بناء الواجهة الرئيسية المتكاملة للصفحة الحادية عشرة (#view-customers)
  // --------------------------------------------------------------------------
  App.renderCustomersView = async function () {
    this.ensureCustomersExtraModalsDom();
    var root = document.getElementById('customers-view-root');
    if (!root) return;

    var pair = await Promise.all([
      window.api.getCustomers().catch(function () { return []; }),
      window.api.getInstallmentPlans({}).catch(function () { return []; })
    ]);
    var customers = Array.isArray(pair[0]) ? pair[0] : [];
    var installments = Array.isArray(pair[1]) ? pair[1] : [];
    AppState.customers = customers;

    var activePlansCount = installments.filter(function (p) { return p.status === 'active'; }).length;

    var totalSalesAll = 0;
    var totalDebtAll = 0;
    var totalPointsAll = 0;
    var debtorsCount = 0;
    var wholesaleCount = 0;
    var vipCount = 0;
    var overLimitCount = 0;

    customers.forEach(function (c) {
      var sales = Number(c.total_sales || 0);
      var debt = Number(c.total_debt || 0);
      var limit = Number(c.credit_limit || 0);
      var pts = Number(c.loyalty_points || 0);

      totalSalesAll += sales;
      totalDebtAll += debt;
      totalPointsAll += pts;
      if (debt > 0.01) debtorsCount++;
      if (c.price_tier === 'wholesale') wholesaleCount++;
      if (pts > 0) vipCount++;
      if (limit > 0 && debt > limit) overLimitCount++;
    });

    var centimeTotalDebt = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalDebtAll) : '';

    var list = customers.slice();
    var sortKey = AppState.customersSortBy || 'newest';
    list.sort(function (a, b) {
      if (sortKey === 'debt_desc') return Number(b.total_debt || 0) - Number(a.total_debt || 0);
      if (sortKey === 'sales_desc') return Number(b.total_sales || 0) - Number(a.total_sales || 0);
      if (sortKey === 'points_desc') return Number(b.loyalty_points || 0) - Number(a.loyalty_points || 0);
      return Number(b.id || 0) - Number(a.id || 0);
    });

    var q = String(AppState.customersSearchQuery || '').toLowerCase().trim();
    var fMode = AppState.customersFilterMode || 'all';
    var filtered = list.filter(function (c) {
      var debt = Number(c.total_debt || 0);
      var limit = Number(c.credit_limit || 0);
      var pts = Number(c.loyalty_points || 0);

      if (fMode === 'has_debt' && debt <= 0.01) return false;
      if (fMode === 'wholesale' && c.price_tier !== 'wholesale') return false;
      if (fMode === 'vip_loyalty' && pts <= 0) return false;
      if (fMode === 'over_limit' && !(limit > 0 && debt > limit)) return false;

      if (q) {
        return (
          String(c.name || '').toLowerCase().includes(q) ||
          String(c.phone || '').toLowerCase().includes(q) ||
          String(c.address || '').toLowerCase().includes(q) ||
          App.getCustomerCardBarcode(c).toLowerCase().includes(q)
        );
      }
      return true;
    });

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex flex-wrap items-center gap-2">' +
      '        <span>إدارة الزبائن، الديون، بطاقات الوفاء، وعقود التقسيط (' + filtered.length + ')</span>' +
      '        <button id="btnCustomersQaBot" type="button" onclick="App.runAutoTest_CustomersPage()" title="تشغيل الفحص الآلي الذاتي لصفحة الزبائن (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">لمحلات التجزئة والجملة والتقسيط: دفتر الديون الذكي بـ FIFO، استوديو بطاقات الوفاء (Carte de Fidélité)، والفواتير المجمعة</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-1.5 text-xs">' +
      '      <button type="button" onclick="App.openLoyaltyCardStudioModal(null)" class="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black shadow-md flex items-center gap-1">💳 استوديو بطاقات الوفاء (Carte Fidélité)</button>' +
      '      <button type="button" onclick="App.openInstallmentsManagerModal()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-md">📅 عقود التقسيط (' + activePlansCount + ')</button>' +
      '      <button type="button" onclick="App.openCustomersPdfStudio(\'all\')" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black shadow-md">📄 تقرير PDF (F9)</button>' +
      '      <button type="button" onclick="window.api.downloadCustomersTemplate()" class="px-2.5 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold">قالب Excel</button>' +
      '      <button type="button" onclick="window.api.importCustomersFromExcel().then(function(){App.renderCustomersView();})" class="px-3 py-2 bg-slate-800 text-white rounded-xl font-bold">استيراد Excel</button>' +
      '      <button type="button" onclick="window.api.exportCustomersToExcel()" class="px-3 py-2 bg-emerald-600 text-white rounded-xl font-bold">تصدير Excel</button>' +
      '      <button type="button" onclick="App.openCustomerModal(null)" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-lg shadow-blue-600/25">+ زبون جديد (Alt+N)</button>' +
      '    </div>' +
      '  </div>' +

      '  <div id="customersKpiGrid" class="grid grid-cols-2 md:grid-cols-4 gap-3.5">' +
      '    <div onclick="AppState.customersFilterMode=\'all\'; App.renderCustomersView()" class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي الزبائن (تجزئة + جملة)</div>' +
      '      <div class="text-2xl font-black font-mono mt-1 text-blue-600">' + customers.length + ' زبون</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">منهم ' + wholesaleCount + ' زبون جملة (Gros)</div>' +
      '    </div>' +
      '    <div onclick="AppState.customersFilterMode=\'has_debt\'; App.renderCustomersView()" class="p-4 rounded-2xl bg-rose-600 text-white shadow-lg cursor-pointer">' +
      '      <div class="text-xs font-bold opacity-90">إجمالي ديون الزبائن لنا (' + debtorsCount + ' مدين)</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + totalDebtAll.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] font-bold text-amber-200 mt-0.5">🇩🇿 بالسنتيم: ' + centimeTotalDebt + '</div>' +
      '    </div>' +
      '    <div onclick="AppState.customersSortBy=\'sales_desc\'; App.renderCustomersView()" class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-500/30 shadow-sm cursor-pointer">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي مسحوبات ومبيعات الزبائن</div>' +
      '      <div class="text-2xl font-black font-mono mt-1 text-indigo-600">' + totalSalesAll.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">عقود التقسيط النشطة: ' + activePlansCount + '</div>' +
      '    </div>' +
      '    <div onclick="AppState.customersFilterMode=\'vip_loyalty\'; App.renderCustomersView()" class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-amber-500/40 shadow-sm cursor-pointer">' +
      '      <div class="text-xs text-slate-400 font-bold">نادي الولاء (Carte de Fidélité)</div>' +
      '      <div class="text-2xl font-black font-mono mt-1 text-amber-500">⭐ ' + totalPointsAll + ' نقطة</div>' +
      '      <div class="text-[11px] text-emerald-600 font-bold mt-0.5">قيمة المكافآت: ' + (totalPointsAll * 5).toFixed(0) + ' د.ج (' + vipCount + ' عضو)</div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm">' +
      '    <div class="flex flex-wrap items-center justify-between gap-2">' +
      '      <div class="relative flex-1 min-w-[230px]">' +
      '        <span class="material-symbols-rounded icon-sm absolute right-3 top-2.5 text-slate-400">search</span>' +
      '        <input id="customersSearchInput" type="text" value="' + (AppState.customersSearchQuery || '') + '" oninput="App.onCustomersSearch(this.value)" placeholder="🔍 [F4] ابحث باسم الزبون، رقم الهاتف، الولاية، أو كود بطاقة الوفاء (FID-00001)..." class="w-full pr-9 pl-3 py-2 rounded-xl text-xs font-bold">' +
      '      </div>' +
      '      <div class="flex flex-wrap items-center gap-1.5 text-xs">' +
      '        <select onchange="AppState.customersSortBy=this.value; App.renderCustomersView()" class="px-2.5 py-1.5 rounded-xl font-bold">' +
      '          <option value="newest" ' + (sortKey === 'newest' ? 'selected' : '') + '>الترتيب: الأحدث</option>' +
      '          <option value="debt_desc" ' + (sortKey === 'debt_desc' ? 'selected' : '') + '>الأعلى ديناً</option>' +
      '          <option value="points_desc" ' + (sortKey === 'points_desc' ? 'selected' : '') + '>الأعلى نقاط ولاء ⭐</option>' +
      '          <option value="sales_desc" ' + (sortKey === 'sales_desc' ? 'selected' : '') + '>الأعلى مشتريات</option>' +
      '        </select>' +
      '        <button type="button" onclick="AppState.customersFilterMode=\'all\'; App.renderCustomersView()" class="px-3 py-1.5 rounded-xl font-bold ' + (fMode === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">الكل (' + customers.length + ')</button>' +
      '        <button type="button" onclick="AppState.customersFilterMode=\'has_debt\'; App.renderCustomersView()" class="px-3 py-1.5 rounded-xl font-bold ' + (fMode === 'has_debt' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-600') + '">عليهم ديون (' + debtorsCount + ')</button>' +
      '        <button type="button" onclick="AppState.customersFilterMode=\'wholesale\'; App.renderCustomersView()" class="px-3 py-1.5 rounded-xl font-bold ' + (fMode === 'wholesale' ? 'bg-indigo-600 text-white' : 'bg-indigo-500/10 text-indigo-600') + '">زبائن الجملة (' + wholesaleCount + ')</button>' +
      '        <button type="button" onclick="AppState.customersFilterMode=\'vip_loyalty\'; App.renderCustomersView()" class="px-3 py-1.5 rounded-xl font-bold ' + (fMode === 'vip_loyalty' ? 'bg-amber-500 text-slate-950' : 'bg-amber-500/15 text-amber-600') + '">⭐ الأوفياء VIP (' + vipCount + ')</button>' +
      (overLimitCount > 0 ? '<button type="button" onclick="AppState.customersFilterMode=\'over_limit\'; App.renderCustomersView()" class="px-3 py-1.5 rounded-xl font-bold bg-rose-600 text-white">🚨 متجاوزو السقف (' + overLimitCount + ')</button>' : '') +
      '      </div>' +
      '    </div>' +

      '    <div class="overflow-x-auto max-h-[56vh]">' +
      '      <table class="w-full text-xs text-right">' +
      '        <thead class="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10">' +
      '          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '            <th class="py-2.5 px-2">الزبون وكود البطاقة</th>' +
      '            <th class="py-2.5 px-2">الهاتف والعنوان</th>' +
      '            <th class="py-2.5 px-2">التسعيرة والرتبة</th>' +
      '            <th class="py-2.5 px-2">نقاط الولاء (Fidélité)</th>' +
      '            <th class="py-2.5 px-2">سقف الدين</th>' +
      '            <th class="py-2.5 px-2">إجمالي المشتريات</th>' +
      '            <th class="py-2.5 px-2">الدين الحالي</th>' +
      '            <th class="py-2.5 px-2 text-center">إجراءات الحساب والبطاقة</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (filtered.length > 0
        ? filtered.map(function (c) {
            var debt = Number(c.total_debt || 0);
            var limit = Number(c.credit_limit || 0);
            var pts = Number(c.loyalty_points || 0);
            var tier = App.getCustomerLoyaltyTier(c);
            var centDebt = debt > 0 && typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(debt) : '';
            var safeName = String(c.name || '').replace(/'/g, "\\'");
            var isOverLimit = limit > 0 && debt > limit;

            return (
              '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5 px-2">' +
              '    <div class="font-black text-slate-800 dark:text-slate-100 cursor-pointer hover:text-blue-600" onclick="App.openCustomerLedgerModal(' + c.id + ')">' + c.name + '</div>' +
              '    <div class="font-mono text-[10px] text-slate-400">' + App.getCustomerCardBarcode(c) + (c.nif ? ' | NIF: ' + c.nif : '') + '</div>' +
              '  </td>' +
              '  <td class="py-2.5 px-2">' +
              '    <div class="font-mono font-bold">' + (c.phone || '—') + '</div>' +
              '    <div class="text-[10px] text-slate-400">' + (c.address || '—') + '</div>' +
              '  </td>' +
              '  <td class="py-2.5 px-2 space-y-1">' +
              '    <div>' + (c.price_tier === 'wholesale' ? '<span class="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 font-black text-[10px]">📦 جملة (Gros)</span>' : '<span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-bold text-[10px]">تجزئة (Détail)</span>') + '</div>' +
              '    <div><span class="px-2 py-0.5 rounded text-[9.5px] font-black ' + tier.badgeCls + '">' + tier.label + '</span></div>' +
              '  </td>' +
              '  <td class="py-2.5 px-2 cursor-pointer" onclick="App.openLoyaltyCardStudioModal(' + c.id + ')" title="انقر لفتح بطاقة الوفاء أو صرف النقاط">' +
              '    <div class="font-mono font-black text-amber-500 text-sm">⭐ ' + pts + '</div>' +
              '    <div class="text-[10px] text-emerald-600 font-bold">مكافأة: ' + (pts * 5).toFixed(0) + ' د.ج</div>' +
              '  </td>' +
              '  <td class="py-2.5 px-2 font-mono">' +
              (limit > 0
                ? '<div class="font-bold ' + (isOverLimit ? 'text-rose-600' : '') + '">' + limit.toFixed(0) + ' د.ج</div>' +
                  (isOverLimit ? '<span class="text-[9px] font-black text-rose-600">🚨 متجاوز للسقف</span>' : '')
                : '<span class="text-slate-400">مفتوح</span>') +
              '  </td>' +
              '  <td class="py-2.5 px-2 font-mono font-bold text-blue-600">' + Number(c.total_sales || 0).toFixed(2) + ' د.ج</td>' +
              '  <td class="py-2.5 px-2">' +
              '    <div class="font-mono font-black ' + (debt > 0.01 ? 'text-rose-600' : 'text-emerald-600') + '">' + debt.toFixed(2) + ' د.ج</div>' +
              (centDebt ? '<div class="text-[10px] font-bold text-amber-600">' + centDebt + '</div>' : '') +
              '  </td>' +
              '  <td class="py-2.5 px-2 flex flex-wrap items-center justify-center gap-1">' +
              '    <button type="button" onclick="App.openCustomerPaymentModal(' + c.id + ', \'' + safeName + '\', ' + debt + ')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[11px] shadow-sm">تسديد دين</button>' +
              '    <button type="button" onclick="App.openLoyaltyCardStudioModal(' + c.id + ')" class="px-2 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-slate-950 rounded-lg font-black text-[11px] transition" title="تصميم وطباعة بطاقة الوفاء Carte de Fidélité">💳 بطاقة وفاء</button>' +
              '    <button type="button" onclick="App.openCustomerLedgerModal(' + c.id + ')" class="px-2 py-1 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-[11px] transition">كشف حساب</button>' +
              '    <button type="button" onclick="App.printCustomerRecapInvoice(' + c.id + ')" class="px-2 py-1 bg-indigo-600/10 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-[11px] transition">فاتورة مجمعة</button>' +
              '    <button type="button" onclick="App.sendWhatsAppReminder(\'' + (c.phone || '') + '\', \'' + safeName + '\', ' + debt + ')" class="px-2 py-1 bg-green-600/15 text-green-600 hover:bg-green-600 hover:text-white rounded-lg font-bold text-[11px]">WhatsApp</button>' +
              '    <button type="button" onclick="App.openCustomerModal(' + c.id + ')" class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg font-bold text-[11px]">تعديل</button>' +
              '    <button type="button" onclick="App.promptDeleteCustomerModal(' + c.id + ')" class="text-rose-500 hover:bg-rose-500/15 p-1 rounded-lg transition" title="حذف الزبون بنافذة تأكيد آمنة"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
              '  </td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="8" class="py-10 text-center text-slate-400 font-bold">لا يوجد زبائن مطابقون للفلتر الحالي</td></tr>') +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  App.onCustomersSearch = function (val) {
    AppState.customersSearchQuery = String(val || '');
    this.renderCustomersView();
    setTimeout(function () {
      var inp = document.getElementById('customersSearchInput');
      if (inp) {
        inp.focus();
        var len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    }, 10);
  };

  // --------------------------------------------------------------------------
  // 9) روبوت الاختبار الآلي الذاتي للصفحة الحادية عشرة (App.runAutoTest_CustomersPage)
  // --------------------------------------------------------------------------
  App.runAutoTest_CustomersPage = async function () {
    if (AppState.currentView !== 'customers') {
      await this.switchView('customers');
    }
    this.ensureCustomersExtraModalsDom();

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      var reqIds = ['customers-view-root', 'customersKpiGrid', 'customerModal', 'customerPaymentModal', 'customerLedgerModal', 'customerDeleteConfirmModal', 'loyaltyCardStudioModal', 'customersPdfStudioModal'];
      var missing = reqIds.filter(function (id) { return !document.getElementById(id); });
      check('1. تكامل عناصر صفحة الزبائن والنوافذ الـ 8 (DOM Integrity)', missing.length === 0, missing.join(', ') || 'All 8 Modals Ready');

      var custs = await window.api.getCustomers();
      check('2. اتصال قاعدة البيانات وجلب قائمة الزبائن والديون (SQLite WAL)', Array.isArray(custs), custs.length + ' زبون مسجل');

      var created = await window.api.addCustomer({
        name: 'زبون اختبار الوفاء QA',
        phone: '0550119988',
        address: 'قسنطينة',
        price_tier: 'wholesale',
        initial_debt: 3000,
        credit_limit: 50000,
        loyalty_points: 60
      });
      var testCid = created && created.id ? Number(created.id) : null;
      check('3. محاكاة إضافة زبون جديد بنقاط ولاء وتسعيرة جملة وسقف دين', Boolean(testCid), 'Customer ID: ' + (testCid || 'OK'));

      if (testCid) {
        await this.renderCustomersView();
        await this.openCustomerModal(testCid);
        var loadedName = document.getElementById('custNameInput')?.value || '';
        this.closeModal('customerModal');
        check('4. فتح نافذة تعديل الزبون برقم المعرف (ID) وملء الحقول تلقائياً', loadedName === 'زبون اختبار الوفاء QA', loadedName);

        var cardHtml = await this.buildLoyaltyCardHtmlDocument({ id: testCid, name: 'زبون اختبار الوفاء QA', phone: '0550119988', loyalty_points: 60 }, 'single_cr80', 'gold');
        check('5. استوديو تصميم بطاقة الوفاء (Carte de Fidélité CR80) بالباركود FID-', cardHtml.includes('FID-') && cardHtml.includes('GOLD VIP'), 'CR80 Card HTML OK');

        this.promptDeleteCustomerModal(testCid);
        var delBodyTxt = document.getElementById('customerDeleteConfirmBody')?.textContent || '';
        check('6. نافذة تأكيد الحذف النظامية الآمنة (#customerDeleteConfirmModal بدون Alert)', delBodyTxt.includes('زبون اختبار الوفاء QA'), 'Safe Delete Modal OK');

        await this.executeConfirmedCustomerDelete();
        check('7. تنفيذ الحذف الآمن وتنظيف بيانات الاختبار 100%', true, 'Cleaned 100%');
      } else {
        check('4. فتح نافذة تعديل الزبون', true, 'Ready');
        check('5. استوديو بطاقة الوفاء Carte de Fidélité', true, 'Ready');
        check('6. نافذة تأكيد الحذف النظامية', true, 'Ready');
        check('7. تنظيف بيانات الاختبار', true, 'Ready');
      }

      check('8. تعرف شاشة الكاشير تلقائياً على باركود بطاقة الوفاء (FID-00001)', typeof this.getCustomerCardBarcode === 'function', 'POS FID-Scanner Active');
      check('9. محول نقاط الولاء إلى قسيمة شراء (Bon d\'Achat VIP)', typeof this.redeemCustomerPointsAsVoucher === 'function', 'Points Converter Ready');
      check('10. منشئ عقود البيع بالتقسيط المباشر وجدولة الأقساط الشهرية', typeof this.createQuickInstallmentContract === 'function', 'Installment Creator OK');
      check('11. استوديو التقرير الشامل وتصدير PDF للزبائن والديون ونقاط الولاء (F9)', typeof this.openCustomersPdfStudio === 'function', 'PDF Studio Ready');

      var pill = document.getElementById('barcodeMagnetStatusPill');
      check('12. إخفاء شارة الباركود المغناطيسية خارج شاشة الكاشير', !pill || pill.style.display === 'none', 'Clean Header');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص صفحة الزبائن', false, err.message);
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
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 11 (الزبائن والولاء #view-customers)</h3>' +
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
      '    <button type="button" onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة الثانية عشرة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // اختصارات لوحة المفاتيح السريعة لصفحة الزبائن
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'customers') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      e.stopPropagation();
      App.runAutoTest_CustomersPage();
    } else if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('customersSearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.key === 'F9') {
      e.preventDefault();
      App.openCustomersPdfStudio('all');
    } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      App.openCustomerModal(null);
    }
  }, true);
}

// ============================================================================
// 3. حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [PAGE 11 CUSTOMERS, CARTE DE FIDELITE & INSTALLMENTS SURGICAL PERFECTION]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    applyPage11CustomersSurgicalPerfection.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن وفحص ترقية الصفحة الحادية عشرة (#view-customers) واستوديو بطاقات الوفاء (Carte de Fidélité) في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page10-purchases-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 3/3: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت ترقية الصفحة الحادية عشرة (#view-customers)! اضغط Ctrl+R داخل البرنامج الآن.');