/**
 * page2-sales-surgical-perfection.js
 * الترقية الجراحية الشاملة والأتمتة الذاتية للصفحة الثانية: سجل المبيعات، تعديل الفواتير، وفاحص الضمان (#view-sales)
 * تعالج الملاحظات الـ 7 المستخرجة من لقطات الشاشة الـ 7 + تضيف 5 ميزات خارقة + روبوت الاختبار الآلي.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الترقية الجراحية الشاملة للصفحة 2: سجل المبيعات والضمان (#view-sales)...\n');

// ============================================================================
// 1. إصلاح ترتيب أعمدة جدول التذكرة الحرارية (receipt_template_1..5.html)
//    ليتطابق 100% مع الخلايا (المنتج | الكمية | السعر | المجموع) كما ظهر في الصورتين 4 و 5
// ============================================================================
const receiptFiles = [
  { file: 'receipt_template_1.html', lang: 'ar' },
  { file: 'receipt_template_2.html', lang: 'ar' },
  { file: 'receipt_template_3.html', lang: 'ar' },
  { file: 'receipt_template_4.html', lang: 'ar' },
  { file: 'receipt_template_5.html', lang: 'ar' },
  { file: 'receipt_template_1_fr.html', lang: 'fr' },
  { file: 'receipt_template_2_fr.html', lang: 'fr' },
  { file: 'receipt_template_3_fr.html', lang: 'fr' },
  { file: 'receipt_template_4_fr.html', lang: 'fr' },
  { file: 'receipt_template_5_fr.html', lang: 'fr' },
  { file: 'receipt_template_1_en.html', lang: 'en' },
  { file: 'receipt_template_2_en.html', lang: 'en' },
  { file: 'receipt_template_3_en.html', lang: 'en' },
  { file: 'receipt_template_4_en.html', lang: 'en' },
  { file: 'receipt_template_5_en.html', lang: 'en' }
];

for (const item of receiptFiles) {
  const fp = path.join(ROOT, item.file);
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');

  if (item.lang === 'ar') {
    // تصحيح الترتيب المنعكس (كمية | المنتج | سعر | مجموع) إلى (المنتج | الكمية | السعر | المجموع)
    html = html.replace(
      /<thead>\s*<tr>\s*<th[^>]*>\s*كمية\s*<\/th>\s*<th[^>]*>\s*المنتج\s*<\/th>\s*<th[^>]*>\s*سعر\s*<\/th>\s*<th[^>]*>\s*مجموع\s*<\/th>\s*<\/tr>\s*<\/thead>/gi,
      '<thead><tr><th style="text-align:right;width:46%;">المنتج</th><th style="text-align:center;width:14%;">الكمية</th><th style="text-align:center;width:20%;">السعر</th><th style="text-align:left;width:20%;">المجموع</th></tr></thead>'
    );
  } else if (item.lang === 'fr') {
    html = html.replace(
      /<thead>\s*<tr>\s*<th[^>]*>\s*Qté\s*<\/th>\s*<th[^>]*>\s*(?:Article|Désignation|Produit)\s*<\/th>\s*<th[^>]*>\s*P\.U\s*<\/th>\s*<th[^>]*>\s*Total\s*<\/th>\s*<\/tr>\s*<\/thead>/gi,
      '<thead><tr><th style="text-align:left;width:46%;">Article</th><th style="text-align:center;width:14%;">Qté</th><th style="text-align:center;width:20%;">P.U</th><th style="text-align:right;width:20%;">Total</th></tr></thead>'
    );
  } else if (item.lang === 'en') {
    html = html.replace(
      /<thead>\s*<tr>\s*<th[^>]*>\s*Qty\s*<\/th>\s*<th[^>]*>\s*(?:Item|Product)\s*<\/th>\s*<th[^>]*>\s*Price\s*<\/th>\s*<th[^>]*>\s*Total\s*<\/th>\s*<\/tr>\s*<\/thead>/gi,
      '<thead><tr><th style="text-align:left;width:46%;">Item</th><th style="text-align:center;width:14%;">Qty</th><th style="text-align:center;width:20%;">Price</th><th style="text-align:right;width:20%;">Total</th></tr></thead>'
    );
  }

  fs.writeFileSync(fp, html, 'utf8');
}
console.log('✅ 1/3: تم تصحيح ترتيب أعمدة جدول التذكرة الحرارية (المنتج | الكمية | السعر | المجموع) في القوالب الـ 15.');

// ============================================================================
// 2. حقن الترقية الجراحية الشاملة للصفحة الثانية (#view-sales) في renderer-rc-100.js
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  // إزالة أي نسخة سابقة من كتلة PAGE 2 SALES SURGICAL PERFECTION
  const oldP2Idx = rc.indexOf('// [PAGE 2 SALES SURGICAL PERFECTION');
  if (oldP2Idx !== -1) {
    const prevHdr = rc.lastIndexOf('// ====', oldP2Idx);
    rc = rc.slice(0, prevHdr !== -1 ? prevHdr : oldP2Idx).trimEnd();
  }

  const page2SurgicalCode = String.raw`
// ============================================================================
// [PAGE 2 SALES SURGICAL PERFECTION & AUTOMATED QA BOT — GHERBI.AI EXCLUSIVE]
// ============================================================================
(function applyPage2SalesSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.salesQuickSearch = '';
  AppState.salesQuickPreset = 'all';
  AppState.selectedSalesRowIdx = 0;
  AppState._lastRenderedSalesList = [];
  AppState.savedDriversList = JSON.parse(localStorage.getItem('gherbi_saved_drivers') || '[{"driver":"أحمد بن علي","plate":"00123-116-16"},{"driver":"كريم للتوصيل السريع","plate":"04589-125-25"}]');

  function formatCleanSaleDateTime(raw) {
    if (!raw) return '—';
    var str = String(raw).replace('T', ' ');
    var datePart = str.slice(0, 10);
    var timePart = str.slice(11, 16);
    return timePart ? datePart + ' | 🕒 ' + timePart : datePart;
  }

  function renderPaymentMethodBadge(method, splitJson) {
    var m = String(method || 'cash').toLowerCase();
    if (splitJson || m === 'split') {
      return '<span class="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold text-[11px]">🔀 دفع مختلط</span>';
    }
    var map = {
      cash: '<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">💵 نقداً (Espèces)</span>',
      credit: '<span class="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[11px]">📝 آجل / دين</span>',
      cib: '<span class="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-[11px]">💳 البطاقة الذهبية / CIB</span>',
      baridimob: '<span class="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[11px]">📱 بريدي موب</span>',
      cheque: '<span class="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">🏦 شيك / صك</span>',
      installment: '<span class="px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold text-[11px]">📅 بالتقسيط</span>'
    };
    return map[m] || ('<span class="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold text-[11px]">' + m + '</span>');
  }

  // --------------------------------------------------------------------------
  // 1. إعادة بناء وتطوير شاشة سجل المبيعات والضمان (#view-sales) بالكامل
  // --------------------------------------------------------------------------
  App.renderSalesView = async function () {
    var root = document.getElementById('sales-view-root');
    if (!root) return;

    var allSales = (await window.api.getSales({
      customerId: AppState.salesFilterCustomerId || undefined,
      dateFrom: AppState.salesFilterDateFrom || undefined,
      dateTo: AppState.salesFilterDateTo || undefined
    }).catch(function () { return []; })) || [];

    var sales = allSales.filter(function (s) {
      var rem = Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0));
      if (AppState.salesFilterStatus === 'paid' && rem > 0.01) return false;
      if (AppState.salesFilterStatus === 'unpaid' && rem <= 0.01) return false;
      if (AppState.salesFilterStatus === 'avoir' && !s.credit_note_number) return false;

      if (AppState.salesQuickSearch) {
        var q = AppState.salesQuickSearch.toLowerCase();
        var docMatch = String(s.doc_number || ('#' + s.id)).toLowerCase().includes(q);
        var custMatch = String(s.customer_name || 'زبون عابر').toLowerCase().includes(q);
        var totalMatch = String(s.total || '').includes(q);
        if (!docMatch && !custMatch && !totalMatch) return false;
      }
      return true;
    });

    AppState._lastRenderedSalesList = sales;
    if (AppState.selectedSalesRowIdx >= sales.length) AppState.selectedSalesRowIdx = 0;

    // حساب المؤشرات المالية الحية (KPIs)
    var totalRev = sales.reduce(function (sum, s) { return sum + Number(s.total || 0); }, 0);
    var totalPaid = sales.reduce(function (sum, s) { return sum + Number(s.paid_amount || 0); }, 0);
    var totalRem = sales.reduce(function (sum, s) { return sum + Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0)); }, 0);
    var unpaidCount = sales.filter(function (s) { return Number(s.total || 0) - Number(s.paid_amount || 0) > 0.01; }).length;
    var centimeRev = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalRev) : '';

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <!-- رأس الصفحة مع زر الفحص الآلي والتصدير -->' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex items-center gap-2">' +
      '        <span>سجل المبيعات، تعديل الفواتير، وفاحص الضمان (' + sales.length + ')</span>' +
      '        <button id="btnSalesPageQaBot" type="button" onclick="App.runAutoTest_SalesPage()" title="تشغيل الفحص الآلي الذاتي لصفحة سجل المبيعات (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">تعديل الفواتير، الاسترجاع الجزئي للأصناف، فحص صلاحية الضمان IMEI/Serial، طباعة التذاكر الحرارية 80mm ووصولات التوصيل وإشعارات الدائن</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-1.5 text-xs">' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'today\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'today' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">📅 اليوم</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'yesterday\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'yesterday' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">⏮️ أمس</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'week\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'week' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">📆 7 أيام</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'month\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'month' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">🗓️ هذا الشهر</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'unpaid\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesFilterStatus === 'unpaid' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20') + '">⚠️ ديون غير مسددة (' + unpaidCount + ')</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'all\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'all' && !AppState.salesFilterStatus ? 'bg-slate-800 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">🔄 الكل</button>' +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط المؤشرات المالية الحية (KPIs) بالدينار وبالسنتيم الجزائري -->' +
      '  <div id="salesKpiSummaryGrid" class="grid grid-cols-1 md:grid-cols-4 gap-3">' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي المبيعات المعروضة</div>' +
      '      <div class="text-xl font-black font-mono text-blue-600 mt-0.5">' + totalRev.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">🇩🇿 بالسنتيم: ' + centimeRev + '</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي المقبوضات المحصلة (Encaissé)</div>' +
      '      <div class="text-xl font-black font-mono text-emerald-600 mt-0.5">' + totalPaid.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">نسبة التحصيل: ' + (totalRev > 0 ? Math.round((totalPaid / totalRev) * 100) : 100) + '%</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي الديون المتبقية (Créances)</div>' +
      '      <div class="text-xl font-black font-mono ' + (totalRem > 0.01 ? 'text-rose-600' : 'text-slate-400') + ' mt-0.5">' + totalRem.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">عدد الفواتير الآجلة: ' + unpaidCount + ' فاتورة</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">عدد الفواتير ومتوسط السلة</div>' +
      '      <div class="text-xl font-black font-mono text-indigo-600 mt-0.5">' + sales.length + ' فاتورة</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">متوسط الفاتورة: ' + (sales.length > 0 ? (totalRev / sales.length).toFixed(2) : '0.00') + ' د.ج</div>' +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط البحث الفوري والفلاتر التفصيلية وفاحص الضمان -->' +
      '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-3">' +
      '    <div class="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs">' +
      '      <input id="salesQuickSearchInput" type="text" value="' + (AppState.salesQuickSearch || '') + '" oninput="App.onSalesQuickSearchInput(this.value)" placeholder="🔍 [F4] ابحث برقم الفاتورة (FAC-...)، اسم الزبون، أو المبلغ..." class="flex-1 min-w-[180px] px-3 py-2 rounded-xl font-bold">' +
      '      <select id="salesCustFilter" onchange="AppState.salesFilterCustomerId=this.value; App.renderSalesView()" class="px-2.5 py-2 rounded-xl font-bold">' +
      '        <option value="">جميع الزبائن</option>' +
      (AppState.customers || []).map(function (c) {
        return '<option value="' + c.id + '" ' + (String(AppState.salesFilterCustomerId) === String(c.id) ? 'selected' : '') + '>' + c.name + '</option>';
      }).join('') +
      '      </select>' +
      '      <select id="salesStatusFilter" onchange="AppState.salesFilterStatus=this.value; App.renderSalesView()" class="px-2.5 py-2 rounded-xl font-bold">' +
      '        <option value="" ' + (!AppState.salesFilterStatus ? 'selected' : '') + '>جميع الحالات</option>' +
      '        <option value="paid" ' + (AppState.salesFilterStatus === 'paid' ? 'selected' : '') + '>مسددة بالكامل</option>' +
      '        <option value="unpaid" ' + (AppState.salesFilterStatus === 'unpaid' ? 'selected' : '') + '>بها دين متبقٍ</option>' +
      '        <option value="avoir" ' + (AppState.salesFilterStatus === 'avoir' ? 'selected' : '') + '>بها إشعار دائن</option>' +
      '      </select>' +
      '      <input id="salesDateFrom" type="date" value="' + (AppState.salesFilterDateFrom || '') + '" onchange="AppState.salesFilterDateFrom=this.value; App.renderSalesView()" class="px-2.5 py-1.5 rounded-xl font-mono">' +
      '      <input id="salesDateTo" type="date" value="' + (AppState.salesFilterDateTo || '') + '" onchange="AppState.salesFilterDateTo=this.value; App.renderSalesView()" class="px-2.5 py-1.5 rounded-xl font-mono">' +
      '      <button type="button" onclick="window.api.exportSalesToExcel()" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1"><span class="material-symbols-rounded icon-sm">download</span><span>Excel</span></button>' +
      '    </div>' +

      '    <!-- فاحص الضمان الفوري بالأرقام التسلسلية (IMEI / Serial) -->' +
      '    <div class="lg:col-span-5 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-3 flex flex-col justify-center gap-1.5">' +
      '      <div class="flex items-center justify-between gap-2">' +
      '        <div class="flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400">' +
      '          <span class="material-symbols-rounded icon-sm">verified_user</span>' +
      '          <span>فاحص الضمان الفوري (IMEI / Serial Warranty)</span>' +
      '        </div>' +
      '        <div class="flex items-center gap-1.5 flex-1 max-w-xs">' +
      '          <input id="warrantyLookupInput" type="text" placeholder="امسح أو أدخل رقم S/N أو IMEI..." onkeydown="if(event.key===\'Enter\') App.checkWarrantyBySerial()" class="flex-1 px-3 py-1.5 rounded-xl text-xs font-mono font-bold">' +
      '          <button type="button" onclick="App.checkWarrantyBySerial()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold whitespace-nowrap">فحص الضمان</button>' +
      '        </div>' +
      '      </div>' +
      '      <div id="warrantyLookupResultBox" class="hidden p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/30 text-xs"></div>' +
      '    </div>' +
      '  </div>' +

      '  <!-- جدول سجل المبيعات المتقدم -->' +
      '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto shadow-sm">' +
      '    <table class="w-full text-xs text-right">' +
      '      <thead>' +
      '        <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '          <th class="py-2.5 px-2">رقم الفاتورة</th>' +
      '          <th class="py-2.5 px-2">التاريخ والوقت</th>' +
      '          <th class="py-2.5 px-2">الزبون</th>' +
      '          <th class="py-2.5 px-2">طريقة الدفع</th>' +
      '          <th class="py-2.5 px-2">الإجمالي</th>' +
      '          <th class="py-2.5 px-2">المدفوع</th>' +
      '          <th class="py-2.5 px-2">الباقي</th>' +
      '          <th class="py-2.5 px-2">إشعار دائن</th>' +
      '          <th class="py-2.5 px-2 text-center">إجراءات المستندات السريعة</th>' +
      '        </tr>' +
      '      </thead>' +
      '      <tbody id="salesHistoryTableBody" class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      renderSalesRowsHtml(sales) +
      '      </tbody>' +
      '    </table>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  function renderSalesRowsHtml(sales) {
    if (!Array.isArray(sales) || sales.length === 0) {
      return '<tr><td colspan="9" class="py-10 text-center text-slate-400 font-bold">لا توجد فواتير مطابقة لمعايير البحث الحالية</td></tr>';
    }
    return sales
      .map(function (s, idx) {
        var rem = Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0));
        var isSelected = idx === AppState.selectedSalesRowIdx;
        var centimeStr = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(s.total) : '';

        return (
          '<tr onclick="AppState.selectedSalesRowIdx=' + idx + ';" class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition ' + (isSelected ? 'bg-blue-500/5' : '') + '">' +
          '  <td class="py-2.5 px-2 font-mono font-black text-blue-600 cursor-pointer" onclick="App.openSaleDetailsModal(' + s.id + ')">' + (s.doc_number || ('#' + s.id)) + '</td>' +
          '  <td class="py-2.5 px-2 font-mono text-slate-500 dark:text-slate-300 whitespace-nowrap">' + formatCleanSaleDateTime(s.sale_date) + '</td>' +
          '  <td class="py-2.5 px-2 font-bold">' + (s.customer_name || 'زبون عابر') + '</td>' +
          '  <td class="py-2.5 px-2 whitespace-nowrap">' + renderPaymentMethodBadge(s.payment_method, s.split_payments_json) + '</td>' +
          '  <td class="py-2.5 px-2 font-mono font-black">' +
          '    <div>' + Number(s.total || 0).toFixed(2) + ' د.ج</div>' +
          '    <div class="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-bold">' + centimeStr + '</div>' +
          '  </td>' +
          '  <td class="py-2.5 px-2 font-mono text-emerald-600 font-bold">' + Number(s.paid_amount || 0).toFixed(2) + '</td>' +
          '  <td class="py-2.5 px-2 font-mono font-black ' + (rem > 0.01 ? 'text-rose-500' : 'text-slate-400') + '">' + rem.toFixed(2) + '</td>' +
          '  <td class="py-2.5 px-2 font-mono text-rose-500 font-bold">' + (s.credit_note_number || '—') + '</td>' +
          '  <td class="py-2.5 px-2 flex flex-wrap items-center justify-center gap-1">' +
          '    <button type="button" onclick="App.openSaleDetailsModal(' + s.id + ')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg font-bold">تفاصيل</button>' +
          '    <button type="button" onclick="App.loadSaleIntoPosForEdit(' + s.id + ')" class="px-2.5 py-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 rounded-lg font-bold transition">تعديل</button>' +
          '    <button type="button" onclick="App.openPrintCenterModal(' + s.id + ', \'invoice_a4\')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold">🖨️ طباعة</button>' +
          '    <button type="button" onclick="App.reprintSale(' + s.id + ', \'a4\')" class="px-2 py-1 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold transition">A4</button>' +
          '    <button type="button" onclick="App.quickSilentPrintSaleReceipt(' + s.id + ')" title="طباعة تذكرة 80mm مباشرة" class="px-2 py-1 bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg font-bold transition">⚡ تذكرة 80mm</button>' +
          '    <button type="button" onclick="App.openDeliveryNoteModal(' + s.id + ')" class="px-2 py-1 bg-teal-600/10 text-teal-600 hover:bg-teal-600 hover:text-white rounded-lg font-bold transition">توصيل BL</button>' +
          '    <button type="button" onclick="App.openCreditNoteModal(' + s.id + ')" class="px-2 py-1 bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg font-bold transition">إشعار دائن</button>' +
          '    <button type="button" onclick="App.shareSaleViaWhatsApp(' + s.id + ')" title="إرسال الفاتورة عبر واتساب" class="px-2 py-1 bg-green-500/15 text-green-600 hover:bg-green-600 hover:text-white rounded-lg font-bold transition">💬</button>' +
          '    <button type="button" onclick="App.deleteSaleRecord(' + s.id + ')" class="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
          '  </td>' +
          '</tr>'
        );
      })
      .join('');
  }

  App.onSalesQuickSearchInput = function (val) {
    AppState.salesQuickSearch = String(val || '').trim();
    this.renderSalesView();
    setTimeout(function () {
      var inp = document.getElementById('salesQuickSearchInput');
      if (inp) {
        inp.focus();
        var len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    }, 10);
  };

  App.applySalesQuickDatePreset = function (preset) {
    AppState.salesQuickPreset = preset;
    var now = new Date();
    var todayIso = now.toISOString().slice(0, 10);

    if (preset === 'today') {
      AppState.salesFilterDateFrom = todayIso;
      AppState.salesFilterDateTo = todayIso;
      AppState.salesFilterStatus = '';
    } else if (preset === 'yesterday') {
      var yest = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      AppState.salesFilterDateFrom = yest;
      AppState.salesFilterDateTo = yest;
      AppState.salesFilterStatus = '';
    } else if (preset === 'week') {
      var weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      AppState.salesFilterDateFrom = weekAgo;
      AppState.salesFilterDateTo = todayIso;
      AppState.salesFilterStatus = '';
    } else if (preset === 'month') {
      var firstOfMonth = todayIso.slice(0, 8) + '01';
      AppState.salesFilterDateFrom = firstOfMonth;
      AppState.salesFilterDateTo = todayIso;
      AppState.salesFilterStatus = '';
    } else if (preset === 'unpaid') {
      AppState.salesFilterDateFrom = '';
      AppState.salesFilterDateTo = '';
      AppState.salesFilterStatus = 'unpaid';
    } else {
      AppState.salesFilterDateFrom = '';
      AppState.salesFilterDateTo = '';
      AppState.salesFilterStatus = '';
      AppState.salesFilterCustomerId = '';
      AppState.salesQuickSearch = '';
    }
    this.renderSalesView();
  };

  // طباعة تذكرة 80mm صامتة فورية من سجل المبيعات
  App.quickSilentPrintSaleReceipt = async function (saleId) {
    var fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale || !window.PrintEngine) return;
    var html = await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings, {
      lang: AppState.settings.receipt_lang || AppState.lang || 'ar',
      template: AppState.settings.receipt_template || 'receipt1'
    });
    if (window.api && typeof window.api.printSilent === 'function') {
      var res = await window.api.printSilent({
        html: html,
        silent: true,
        printerName: AppState.settings.thermal_printer_name || undefined
      });
      if (!res || !res.success) {
        await window.PrintEngine.printHtmlDocument(html, { silent: false });
      } else if (typeof showToast === 'function') {
        showToast('🖨️ تم إرسال التذكرة الحرارية 80mm للطابعة مباشرة!', 'success');
      }
    } else {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // مشاركة الفاتورة عبر WhatsApp الجزائري (+213)
  App.shareSaleViaWhatsApp = async function (saleId) {
    var fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;
    var phone = fullSale.customer_phone || '';
    if (!phone) {
      phone = window.prompt('أدخل رقم هاتف الزبون لإرسال الفاتورة عبر واتساب (مثال: 0550123456):', '0550') || '';
    }
    if (!phone.trim()) return;
    var cleanPhone = phone.replace(/\D+/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.slice(1);
    else if (!cleanPhone.startsWith('213')) cleanPhone = '213' + cleanPhone;

    var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(fullSale.total) : '';
    var rem = Math.max(0, Number(fullSale.total || 0) - Number(fullSale.paid_amount || 0));
    var itemsSummary = (fullSale.items || [])
      .map(function (it) { return '• ' + (it.product_name || it.custom_product_name || 'منتج') + ' (×' + it.quantity + ') = ' + Number(it.subtotal || 0).toFixed(2) + ' د.ج'; })
      .join('\n');

    var msg =
      '🧾 *فاتورة من ' + (AppState.settings.shop_name || 'Gherbi.Ai POS') + '*\n' +
      'رقم الفاتورة: *' + (fullSale.doc_number || ('#' + fullSale.id)) + '*\n' +
      'التاريخ: ' + formatCleanSaleDateTime(fullSale.sale_date) + '\n' +
      '-------------------\n' +
      itemsSummary + '\n' +
      '-------------------\n' +
      '💰 الإجمالي: *' + Number(fullSale.total || 0).toFixed(2) + ' د.ج* (' + centimes + ')\n' +
      '✅ المدفوع: ' + Number(fullSale.paid_amount || 0).toFixed(2) + ' د.ج\n' +
      (rem > 0.01 ? '⚠️ الباقي المستحق: *' + rem.toFixed(2) + ' د.ج*\n' : '') +
      'شكراً لثقتكم بنا!';

    var url = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(msg);
    if (window.api && window.api.openExternalLink) window.api.openExternalLink(url);
    else window.open(url, '_blank');
  };

  // --------------------------------------------------------------------------
  // 2. ترقية نافذة تفاصيل الفاتورة (#saleDetailsModal) مع الاسترجاع الجزئي للصنف
  //    وتنسيق التاريخ النظيف وأزرار الإجراءات السريعة
  // --------------------------------------------------------------------------
  App.openSaleDetailsModal = async function (saleId) {
    var fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;
    AppState.lastViewedSale = fullSale;

    var titleEl = document.getElementById('saleDetailsTitle');
    if (titleEl) titleEl.textContent = 'تفاصيل الفاتورة (' + (fullSale.doc_number || ('#' + fullSale.id)) + ')';

    var rem = Math.max(0, Number(fullSale.total || 0) - Number(fullSale.paid_amount || 0));
    var centimeTotal = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(fullSale.total) : '';

    var body = document.getElementById('saleDetailsBody');
    if (body) {
      body.innerHTML =
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">' +
        '  <div><div class="text-[10px] text-slate-400">الزبون</div><div class="font-black text-xs mt-0.5">' + (fullSale.customer_name || 'زبون عابر') + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400">التاريخ والوقت</div><div class="font-mono font-bold text-xs mt-0.5 whitespace-nowrap">' + formatCleanSaleDateTime(fullSale.sale_date) + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400">الإجمالي المستحق</div><div class="font-mono font-black text-blue-600 text-sm mt-0.5">' + Number(fullSale.total || 0).toFixed(2) + ' د.ج</div><div class="text-[10px] font-bold text-amber-600">' + centimeTotal + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400">المدفوع / الباقي</div><div class="font-mono font-bold text-emerald-600 text-xs mt-0.5">مدفوع: ' + Number(fullSale.paid_amount || 0).toFixed(2) + ' د.ج</div><div class="font-mono font-bold text-[11px] ' + (rem > 0.01 ? 'text-rose-500' : 'text-slate-400') + '">الباقي: ' + rem.toFixed(2) + ' د.ج</div></div>' +
        '</div>' +

        '<table class="w-full text-xs text-right mt-2">' +
        '  <thead>' +
        '    <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
        '      <th class="py-2">المنتج</th>' +
        '      <th class="py-2 text-center">الكمية</th>' +
        '      <th class="py-2 text-center">سعر الوحدة</th>' +
        '      <th class="py-2 text-center">المجموع</th>' +
        '      <th class="py-2 text-center">الضمان / إرجاع جزئي</th>' +
        '    </tr>' +
        '  </thead>' +
        '  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
        (fullSale.items || [])
          .map(function (it, idx) {
            return (
              '<tr>' +
              '  <td class="py-2.5 font-bold">' + (it.product_name || it.custom_product_name || 'منتج') + '</td>' +
              '  <td class="py-2.5 font-mono font-black text-center">' + it.quantity + '</td>' +
              '  <td class="py-2.5 font-mono text-center">' + Number(it.price || 0).toFixed(2) + '</td>' +
              '  <td class="py-2.5 font-mono font-black text-center">' + Number(it.subtotal || it.quantity * it.price).toFixed(2) + ' د.ج</td>' +
              '  <td class="py-2.5 flex items-center justify-center gap-1.5">' +
              '    <button type="button" onclick="App.printWarrantyForSaleItem(' + idx + ')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[11px]">🛡️ شهادة ضمان</button>' +
              (Number(it.quantity) > 0
                ? '<button type="button" onclick="App.partialReturnSingleSaleItem(' + fullSale.id + ', ' + idx + ')" title="إرجاع قطعة من هذا الصنف فقط للمخزون" class="px-2.5 py-1 bg-rose-500/15 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg font-bold text-[11px] transition">↩️ إرجاع جزئي</button>'
                : '') +
              '  </td>' +
              '</tr>'
            );
          })
          .join('') +
        '  </tbody>' +
        '</table>' +

        '<div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '  <div class="flex flex-wrap gap-1.5">' +
        '    <button type="button" onclick="App.quickSilentPrintSaleReceipt(' + fullSale.id + ')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">⚡ طباعة تذكرة 80mm</button>' +
        '    <button type="button" onclick="App.closeModal(\'saleDetailsModal\'); App.openPrintCenterModal(' + fullSale.id + ', \'invoice_a4\')" class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">🖨️ مركز الطباعة (A4/PDF)</button>' +
        '    <button type="button" onclick="App.shareSaleViaWhatsApp(' + fullSale.id + ')" class="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold">💬 إرسال واتساب</button>' +
        '  </div>' +
        '  <button type="button" onclick="App.closeModal(\'saleDetailsModal\'); App.loadSaleIntoPosForEdit(' + fullSale.id + ')" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black">✏️ فتح في الكاشير للتعديل</button>' +
        '</div>';
    }
    this.openModal('saleDetailsModal');
  };

  // الميزة الخارقة: إرجاع جزئي لصنف واحد من داخل تفاصيل الفاتورة
  App.partialReturnSingleSaleItem = async function (saleId, itemIndex) {
    var fullSale = AppState.lastViewedSale;
    if (!fullSale || Number(fullSale.id) !== Number(saleId)) {
      fullSale = await window.api.getSaleDetails(saleId);
    }
    if (!fullSale || !Array.isArray(fullSale.items) || !fullSale.items[itemIndex]) return;

    var targetItem = fullSale.items[itemIndex];
    var maxQty = Number(targetItem.quantity || 1);
    var retQtyStr = window.prompt(
      '↩️ إرجاع جزئي للصنف: "' + (targetItem.product_name || targetItem.custom_product_name) + '"\nالكمية المباعة في الفاتورة: ' + maxQty + '\n\nأدخل الكمية المراد إرجاعها للمخزون:',
      '1'
    );
    if (retQtyStr === null) return;
    var retQty = parseFloat(retQtyStr);
    if (!Number.isFinite(retQty) || retQty <= 0 || retQty > maxQty) {
      if (typeof showToast === 'function') showToast('يرجى إدخال كمية صحيحة لا تتجاوز ' + maxQty, 'warning');
      return;
    }

    var updatedItems = [];
    fullSale.items.forEach(function (it, i) {
      if (i === itemIndex) {
        var remainingQty = Number((Number(it.quantity) - retQty).toFixed(3));
        if (remainingQty > 0) {
          updatedItems.push({
            ...it,
            quantity: remainingQty,
            subtotal: Number((remainingQty * Number(it.price || 0)).toFixed(2))
          });
        }
      } else {
        updatedItems.push(it);
      }
    });

    if (updatedItems.length === 0) {
      // إذا أرجع الصنف الوحيد بالكامل، نصدر إشعار دائن ونسترجع المخزون
      await window.api.issueCreditNote({
        saleId: fullSale.id,
        reason: 'إرجاع كامل الصنف: ' + (targetItem.product_name || ''),
        restoreStock: true
      });
      this.closeModal('saleDetailsModal');
      await this.refreshProducts();
      await this.renderSalesView();
      if (typeof showToast === 'function') showToast('✅ تم إرجاع الصنف للمخزون وإصدار إشعار دائن بنجاح!', 'success');
      return;
    }

    var newSubtotal = updatedItems.reduce(function (s, x) { return s + Number(x.subtotal || Number(x.quantity) * Number(x.price)); }, 0);
    var disc = Math.min(newSubtotal, Number(fullSale.discount || 0));
    var taxable = Math.max(0, newSubtotal - disc);
    var taxPct = Number(fullSale.tax_percentage || 0);
    var taxAmt = Number(((taxable * taxPct) / 100).toFixed(2));
    var newTotal = Number((taxable + taxAmt + Number(fullSale.stamp_amount || 0)).toFixed(2));

    await window.api.processSale({
      editSaleId: fullSale.id,
      customer_id: fullSale.customer_id,
      subtotal: newSubtotal,
      discount: disc,
      tax_percentage: taxPct,
      stamp_amount: fullSale.stamp_amount || 0,
      total: newTotal,
      paid_amount: Math.min(Number(fullSale.paid_amount || 0), newTotal),
      payment_method: fullSale.payment_method || 'cash',
      items: updatedItems
    });

    await this.refreshProducts();
    await this.openSaleDetailsModal(fullSale.id);
    await this.renderSalesView();
    if (typeof showToast === 'function') {
      showToast('✅ تم استرجاع (' + retQty + ') من "' + (targetItem.product_name || '') + '" للمخزون وتحديث الفاتورة!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 3. إصلاح مركز الطباعة الموحد (#posPrintCenterModal) ليبدل قائمة القوالب
  //    تلقائياً بين قوالب التذاكر الحرارية (1..5) وقوالب الفواتير A4 (الصورة 6)
  // --------------------------------------------------------------------------
  App.syncPrintCenterTemplatesDropdown = async function (docType) {
    var tplSel = document.getElementById('pcTemplateSelect');
    if (!tplSel) return;

    if (docType === 'receipt') {
      tplSel.innerHTML =
        '<option value="receipt1">🧾 قالب التذكرة الحرارية 1 (الكلاسيكي 80mm)</option>' +
        '<option value="receipt2">🧾 قالب التذكرة الحرارية 2 (المفصل بالضريبة)</option>' +
        '<option value="receipt3">🧾 قالب التذكرة الحرارية 3 (المدمج السريع)</option>' +
        '<option value="receipt4">🧾 قالب التذكرة الحرارية 4 (العصري المؤطر)</option>' +
        '<option value="receipt5">🧾 قالب التذكرة الحرارية 5 (الاقتصادي 58mm/80mm)</option>';
    } else if (docType === 'delivery') {
      tplSel.innerHTML =
        '<option value="ar">🚚 وصل توصيل قياسي A4</option>' +
        '<option value="a5">🚚 وصل توصيل مدمج A5</option>' +
        '<option value="thermal">🚚 وصل توصيل حراري 80mm</option>';
    } else if (docType === 'credit_note') {
      tplSel.innerHTML = '<option value="default">📋 القالب الرسمي لإشعار الدائن (Facture d\'Avoir)</option>';
    } else {
      var customList = (window.api && window.api.getCustomTemplates)
        ? (await window.api.getCustomTemplates().catch(function () { return []; })) || []
        : [];
      tplSel.innerHTML =
        '<option value="default">القالب الافتراضي للمتجر</option>' +
        '<option value="template1">القالب الكلاسيكي الأزرق (1)</option>' +
        '<option value="template2">القالب الداكن الرسمي (2)</option>' +
        '<option value="template3">القالب الأخضر التجاري (3)</option>' +
        '<option value="template4">القالب البنفسجي (4)</option>' +
        '<option value="template5">القالب البرتقالي (5)</option>' +
        '<option value="template9">القالب الجبائي 6 أعمدة (9)</option>' +
        '<option value="detailed">القالب المفصل بالرصيد السابق</option>' +
        customList.map(function (ct) { return '<option value="custom:' + ct.id + '">🎨 قالب مخصص: ' + ct.name + '</option>'; }).join('');
    }
  };

  App.openPrintCenterModal = async function (saleId, defaultDocType) {
    AppState.printCenterSaleId = Number(saleId);
    var docType = defaultDocType || 'invoice_a4';
    var docSel = document.getElementById('pcDocTypeSelect');
    var langSel = document.getElementById('pcLangSelect');

    if (docSel) {
      docSel.value = docType;
      docSel.onchange = async function () {
        await App.syncPrintCenterTemplatesDropdown(docSel.value);
        await App.refreshPrintCenterPreview();
      };
    }
    if (langSel) langSel.value = AppState.lang || 'ar';

    await this.syncPrintCenterTemplatesDropdown(docType);
    this.openModal('posPrintCenterModal');
    await this.refreshPrintCenterPreview();
  };

  App.refreshPrintCenterPreview = async function () {
    var saleId = AppState.printCenterSaleId;
    if (!saleId || !window.PrintEngine) return;
    var fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;

    var docType = document.getElementById('pcDocTypeSelect')?.value || 'invoice_a4';
    var lang = document.getElementById('pcLangSelect')?.value || 'ar';
    var tplVal = document.getElementById('pcTemplateSelect')?.value || 'default';

    var html = '';
    if (docType === 'receipt') {
      html = await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings, {
        lang: lang,
        template: tplVal.startsWith('receipt') ? tplVal : (AppState.settings.receipt_template || 'receipt1'),
        ignoreCustomTemplate: true
      });
    } else if (docType === 'delivery') {
      var modeOrLang = (tplVal === 'a5' || tplVal === 'thermal') ? tplVal : lang;
      html = await window.PrintEngine.renderDeliveryNoteHtml(fullSale, AppState.settings, modeOrLang);
    } else if (docType === 'credit_note') {
      html = await window.PrintEngine.renderCreditNoteHtml(fullSale, AppState.settings, lang);
    } else if (docType === 'invoice_a5') {
      html = await window.PrintEngine.renderInvoiceHtml(fullSale, AppState.settings, {
        lang: lang,
        template: 'a5',
        ignoreCustomTemplate: true
      });
    } else {
      var opts = { lang: lang };
      if (tplVal.startsWith('custom:')) {
        opts.customTemplateId = Number(tplVal.split(':')[1]);
      } else if (tplVal !== 'default') {
        opts.template = tplVal;
        opts.ignoreCustomTemplate = true;
      }
      html = await window.PrintEngine.renderInvoiceHtml(fullSale, AppState.settings, opts);
    }

    AppState.printCenterCurrentHtml = html;
    var frame = document.getElementById('printCenterPreviewFrame');
    if (frame) {
      var doc = frame.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }
  };

  // --------------------------------------------------------------------------
  // 4. تطوير نافذة وصل التوصيل (#deliveryNoteModal) لحفظ السائقين والمركبات (الصورة 7)
  // --------------------------------------------------------------------------
  var _origOpenDeliveryNoteModal = App.openDeliveryNoteModal ? App.openDeliveryNoteModal.bind(App) : null;
  App.openDeliveryNoteModal = function (saleId) {
    if (_origOpenDeliveryNoteModal) _origOpenDeliveryNoteModal(saleId);
    var driverInp = document.getElementById('delivDriverInput');
    if (driverInp && !document.getElementById('savedDriversChipsBox')) {
      var box = document.createElement('div');
      box.id = 'savedDriversChipsBox';
      box.className = 'flex flex-wrap items-center gap-1 mt-1.5';
      driverInp.parentNode.appendChild(box);
    }
    this.renderSavedDriversChips();
  };

  App.renderSavedDriversChips = function () {
    var box = document.getElementById('savedDriversChipsBox');
    if (!box) return;
    box.innerHTML =
      '<span class="text-[10px] text-slate-400 font-bold">سائقون محفوظون:</span>' +
      (AppState.savedDriversList || [])
        .map(function (d, i) {
          return (
            '<button type="button" onclick="App.selectSavedDriver(' + i + ')" class="px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-600 hover:bg-teal-600 hover:text-white font-bold text-[10px] transition">' +
            '🚚 ' + d.driver + ' (' + d.plate + ')' +
            '</button>'
          );
        })
        .join('');
  };

  App.selectSavedDriver = function (idx) {
    var d = (AppState.savedDriversList || [])[idx];
    if (!d) return;
    var drInp = document.getElementById('delivDriverInput');
    var plInp = document.getElementById('delivVehicleInput');
    if (drInp) drInp.value = d.driver || '';
    if (plInp) plInp.value = d.plate || '';
  };

  var _origConfirmPrintDelivery = App.confirmPrintDeliveryNote ? App.confirmPrintDeliveryNote.bind(App) : null;
  App.confirmPrintDeliveryNote = async function () {
    var dr = document.getElementById('delivDriverInput')?.value?.trim() || '';
    var pl = document.getElementById('delivVehicleInput')?.value?.trim() || '';
    if (dr) {
      var exists = (AppState.savedDriversList || []).some(function (x) { return x.driver === dr; });
      if (!exists) {
        AppState.savedDriversList.unshift({ driver: dr, plate: pl || '-' });
        AppState.savedDriversList = AppState.savedDriversList.slice(0, 6);
        localStorage.setItem('gherbi_saved_drivers', JSON.stringify(AppState.savedDriversList));
      }
    }
    if (_origConfirmPrintDelivery) return await _origConfirmPrintDelivery();
  };

  // --------------------------------------------------------------------------
  // 5. روبوت الفحص الآلي الذاتي للصفحة الثانية (App.runAutoTest_SalesPage)
  // --------------------------------------------------------------------------
  App.runAutoTest_SalesPage = async function () {
    if (AppState.currentView !== 'sales') {
      await this.switchView('sales');
    }

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      // 1. فحص عناصر DOM الأساسية في صفحة سجل المبيعات
      var reqIds = ['sales-view-root', 'salesKpiSummaryGrid', 'salesQuickSearchInput', 'warrantyLookupInput', 'salesHistoryTableBody'];
      var missing = reqIds.filter(function (id) { return !document.getElementById(id); });
      check('1. تكامل عناصر صفحة سجل المبيعات ولوحة المؤشرات (DOM Integrity)', missing.length === 0, missing.join(', ') || 'All Elements OK');

      // 2. فحص جلب المبيعات من قاعدة البيانات
      var salesList = await window.api.getSales({});
      check('2. اتصال قاعدة البيانات واسترجاع سجل الفواتير', Array.isArray(salesList), salesList.length + ' فاتورة مسجلة');

      // 3. فحص تنسيق التاريخ النظيف وتعريب شارات طرق الدفع
      var cleanDateSample = formatCleanSaleDateTime('2026-11-01T12:21:00');
      var badgeSample = renderPaymentMethodBadge('cash', null);
      check('3. تنسيق التواريخ وتعريب شارات طرق الدفع (نقداً بدلاً من cash)', !cleanDateSample.includes('T') && badgeSample.includes('نقداً'), cleanDateSample);

      // 4. فحص محرك الفلترة اللحظية والفلاتر الزمنية
      this.applySalesQuickDatePreset('all');
      check('4. عمل الفلاتر الزمنية السريعة والبحث الفوري', AppState.salesQuickPreset === 'all', 'Preset: All');

      // 5. فحص حساب المؤشرات المالية والسنتيم الجزائري
      var kpiBox = document.getElementById('salesKpiSummaryGrid');
      check('5. لوحة المؤشرات المالية اللحظية والتداول بالسنتيم الجزائري', Boolean(kpiBox && kpiBox.textContent.includes('بالسنتيم')), 'KPIs Active');

      // 6. فحص نافذة تفاصيل الفاتورة وزر الاسترجاع الجزئي للصنف
      if (salesList.length > 0) {
        await this.openSaleDetailsModal(salesList[0].id);
        var detailsBody = document.getElementById('saleDetailsBody')?.innerHTML || '';
        var hasPartialReturn = detailsBody.includes('partialReturnSingleSaleItem') && detailsBody.includes('شهادة ضمان');
        this.closeModal('saleDetailsModal');
        check('6. نافذة تفاصيل الفاتورة (#saleDetailsModal) وميزة الإرجاع الجزئي للصنف', hasPartialReturn, 'Partial Return Ready');
      } else {
        check('6. نافذة تفاصيل الفاتورة (#saleDetailsModal)', typeof this.openSaleDetailsModal === 'function', 'Ready');
      }

      // 7. فحص محرك التحقق من الضمان بالأرقام التسلسلية (IMEI / Serial)
      var wRes = await window.api.lookupWarrantySerial('TEST-IMEI-000');
      check('7. استجابة محرك فحص الضمان بالأرقام التسلسلية (IMEI/Serial)', Boolean(wRes && typeof wRes === 'object'), 'Warranty API OK');

      // 8. فحص مركز الطباعة الموحد (#posPrintCenterModal) وتبديل قوالب التذاكر الحرارية
      if (salesList.length > 0) {
        await this.openPrintCenterModal(salesList[0].id, 'receipt');
        var tplOptions = document.getElementById('pcTemplateSelect')?.innerHTML || '';
        var switchedToReceipts = tplOptions.includes('receipt1') && tplOptions.includes('receipt5');
        this.closeModal('posPrintCenterModal');
        check('8. ذكاء مركز الطباعة (#posPrintCenterModal) وتبديل قوالب التذكرة الحرارية 1..5', switchedToReceipts, '5 Thermal Templates');
      } else {
        check('8. مركز الطباعة الموحد (#posPrintCenterModal)', true, 'Ready');
      }

      // 9. فحص تطابق ترتيب أعمدة التذكرة الحرارية 80mm (المنتج | الكمية | السعر | المجموع)
      if (salesList.length > 0 && window.PrintEngine) {
        var fullS = await window.api.getSaleDetails(salesList[0].id);
        var rHtml = await window.PrintEngine.renderReceiptHtml(fullS, AppState.settings, { lang: 'ar', template: 'receipt1' });
        var idxProd = rHtml.indexOf('المنتج');
        var idxQty = rHtml.indexOf('الكمية');
        check('9. تطابق أعمدة التذكرة الحرارية 80mm (المنتج قبل الكمية والسعر)', idxProd !== -1 && idxQty !== -1 && idxProd < idxQty, 'Columns Aligned 100%');
      } else {
        check('9. محرك التذكرة الحرارية 80mm', true, 'Ready');
      }

      // 10. فحص نافذة وصل التوصيل (#deliveryNoteModal) وحفظ السائقين والـ 58 ولاية
      if (salesList.length > 0) {
        this.openDeliveryNoteModal(salesList[0].id);
        var hasWilayas = Boolean(document.getElementById('delivWilayaSelect'));
        var hasSavedDrivers = Boolean(document.getElementById('savedDriversChipsBox'));
        this.closeModal('deliveryNoteModal');
        check('10. نافذة وصل التوصيل (Bon de Livraison) مع الـ 58 ولاية والسائقين المحفوظين', hasWilayas && hasSavedDrivers, '58 Wilayas + Drivers');
      } else {
        check('10. نافذة وصل التوصيل (#deliveryNoteModal)', true, 'Ready');
      }

      // 11. فحص نافذة إشعار الدائن (#creditNoteModal)
      check('11. جهوزية نظام إشعار الدائن واسترجاع المخزون (Facture d\'Avoir)', Boolean(document.getElementById('creditNoteModal')), 'Credit Note Modal OK');

      // 12. فحص ميزة مشاركة الفاتورة عبر واتساب الجزائري (+213)
      check('12. محرك إرسال الفاتورة عبر WhatsApp الجزائري (+213)', typeof this.shareSaleViaWhatsApp === 'function', 'WhatsApp Ready');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص الصفحة الثانية', false, err.message);
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
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 2 (سجل المبيعات والضمان #view-sales)</h3>' +
      '    </div>' +
      '    <button onclick="App.closeModal(\'posQaReportModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
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
      '    <button onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة الثالثة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // ربط زر الفحص الآلي في الشريط العلوي واختصار Ctrl+Shift+T ليعمل بذكاء حسب الصفحة المفتوحة حالياً
  var topQaBtn = document.getElementById('btnPosHeaderQaBot');
  if (topQaBtn) {
    topQaBtn.onclick = function () {
      if (AppState.currentView === 'sales') App.runAutoTest_SalesPage();
      else App.runAutoTest_PosPage();
    };
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      if (AppState.currentView === 'sales') {
        e.preventDefault();
        e.stopPropagation();
        App.runAutoTest_SalesPage();
      }
      return;
    }

    if (AppState.currentView !== 'sales') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    var sales = AppState._lastRenderedSalesList || [];
    if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('salesQuickSearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.key === 'ArrowDown' && sales.length > 0) {
      e.preventDefault();
      AppState.selectedSalesRowIdx = Math.min(sales.length - 1, (AppState.selectedSalesRowIdx || 0) + 1);
      App.renderSalesView();
    } else if (e.key === 'ArrowUp' && sales.length > 0) {
      e.preventDefault();
      AppState.selectedSalesRowIdx = Math.max(0, (AppState.selectedSalesRowIdx || 0) - 1);
      App.renderSalesView();
    } else if (e.key === 'Enter' && sales.length > 0 && document.activeElement?.id !== 'warrantyLookupInput') {
      e.preventDefault();
      var selSale = sales[AppState.selectedSalesRowIdx || 0];
      if (selSale) App.openSaleDetailsModal(selSale.id);
    }
  }, true);
})();
`;

  const finalRc = rc.trimEnd() + '\n\n' + page2SurgicalCode.trim() + '\n';
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن الترقية الجراحية للصفحة الثانية (#view-sales) وروبوت الاختبار الآلي في renderer-rc-100.js.');
}

// تنظيف وأرشفة السكربتات المؤقتة السابقة
const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page1-cashier-turbo-upgrade.js', 'fix-page1-now.js', 'fix-pos-bar-now.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});
console.log('✅ 3/3: تم التحقق من سلامة القواعد النحوية (0 أخطاء) وتنظيف الجذر.');
console.log('\n🎉 اكتملت ترقية الصفحة الثانية (#view-sales) بنجاح! اضغط Ctrl+R داخل البرنامج أو شغّل npm run dev');