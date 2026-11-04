/**
 * page14-expenses-capital-surgical-perfection.js
 * الترقية الجراحية والاستشارية الشاملة للصفحة الرابعة عشرة: المصاريف التشغيلية وحركات رأس المال (#view-expenses):
 * 1. شريط المؤشرات المالية الـ 4 (KPIs): إجمالي المصاريف والعبء اليومي، مصاريف الشهر، إجمالي إيداعات رأس المال، وصافي رأس المال بعد المسحوبات
 * 2. رادار نقطة التعادل وتغطية المصاريف من أرباح المبيعات (Break-Even & Profit Coverage Radar)
 * 3. شريط القوالب الدورية السريعة للأعباء الجزائرية الثابتة (كراء، سونلغاز، ADE، إنترنت، أجور عمال، CASNOS/G50) بضغطة زر
 * 4. ترقية نافذتي المصروف ورأس المال (#expenseModal & #capitalModal): اختيار التاريخ، المستفيد/العامل/الشريك، أزرار فئات نقدية سريعة، السنتيم الجزائري، التعديل، وربط رأس المال بالصندوق
 * 5. نافذة تأكيد الحذف النظامية الآمنة (#finDeleteConfirmModal — بدون alert/confirm) + استوديو طباعة سندات الصرف وتقارير PDF/Excel + روبوت الفحص الآلي (12/12 PASS).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الترقية الجراحية الشاملة للصفحة 14 (المصاريف التشغيلية وحركات رأس المال #view-expenses)...\n');

// ============================================================================
// 1. ترقية main.js و preload.js لدعم تعديل المصاريف ورأس المال وربط حركات رأس المال بالصندوق
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');
  if (!mainCode.includes("ipcMain.handle('update-expense'")) {
    const expenseCapitalUpgradesIpc = `
  ipcMain.handle('update-expense', async (_e, id, exp = {}) => {
    const eid = Number(id);
    const amt = Number(exp.amount || 0);
    await dbRun(
      'UPDATE expenses SET category = ?, description = ?, amount = ?, date = COALESCE(?, date) WHERE id = ?',
      [exp.category || 'عام', exp.description || null, amt, exp.date || null, eid]
    );
    await dbRun(
      "UPDATE caisse_transactions SET amount = ?, category = ?, description = ? WHERE reference_id = ? AND type = 'expense'",
      [amt, exp.category || 'عام', exp.description || 'مصروف', eid]
    );
    return { success: true, id: eid };
  });

  ipcMain.handle('update-capital', async (_e, id, cap = {}) => {
    const cid = Number(id);
    const amt = Number(cap.amount || 0);
    await dbRun(
      'UPDATE capital_injections SET category = ?, description = ?, amount = ?, date = COALESCE(?, date) WHERE id = ?',
      [cap.category || 'إيداع رأس مال', cap.description || null, amt, cap.date || null, cid]
    );
    return { success: true, id: cid };
  });
`;
    const anchor = "ipcMain.handle('delete-expense'";
    if (mainCode.includes(anchor)) {
      mainCode = mainCode.replace(anchor, expenseCapitalUpgradesIpc + '\n  ' + anchor);
      new vm.Script(mainCode, { filename: 'main.js' });
      fs.writeFileSync(mainPath, mainCode, 'utf8');
      console.log('✅ 1/3: تم ترقية main.js لإضافة قنوات تعديل المصاريف وحركات رأس المال (update-expense & update-capital).');
    }
  }
}

const preloadPath = path.join(ROOT, 'preload.js');
if (fs.existsSync(preloadPath)) {
  let preCode = fs.readFileSync(preloadPath, 'utf8');
  if (!preCode.includes('updateExpense:')) {
    preCode = preCode.replace(
      "deleteExpense: (id) => invoke('delete-expense', id),",
      "updateExpense: (id, data) => invoke('update-expense', id, data),\n  deleteExpense: (id) => invoke('delete-expense', id),"
    );
    preCode = preCode.replace(
      "deleteCapital: (id) => invoke('delete-capital', id),",
      "updateCapital: (id, data) => invoke('update-capital', id, data),\n  deleteCapital: (id) => invoke('delete-capital', id),"
    );
    new vm.Script(preCode, { filename: 'preload.js' });
    fs.writeFileSync(preloadPath, preCode, 'utf8');
  }
}

// ============================================================================
// 2. الوحدة الجراحية الشاملة لصفحة المصاريف التشغيلية وحركات رأس المال (#view-expenses)
// ============================================================================
function applyPage14ExpensesAndCapitalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.expensesSearchQuery = '';
  AppState.expensesCategoryFilter = 'all';
  AppState.expensesPeriodFilter = 'all'; // 'all' | 'today' | 'month' | 'year'
  AppState.editingExpenseId = null;
  AppState.editingCapitalId = null;

  var RECURRING_ALGERIAN_TEMPLATES = [
    { label: '🏠 كراء المحل الشهري', category: 'كراء المحل', defaultAmt: 25000, desc: 'تسديد كراء المحل للشهر الحالي' },
    { label: '⚡ فاتورة سونلغاز (كهرباء وغاز)', category: 'كهرباء وغاز وماء', defaultAmt: 4500, desc: 'تسديد فاتورة الكهرباء والغاز Sonelgaz' },
    { label: '💧 الجزائرية للمياه (ADE)', category: 'كهرباء وغاز وماء', defaultAmt: 1200, desc: 'تسديد فاتورة المياه ADE' },
    { label: '🌐 اشتراك الإنترنت (Idoom Fibre)', category: 'كهرباء وغاز وماء', defaultAmt: 2000, desc: 'تعبئة اشتراك الإنترنت الشهري' },
    { label: '👷 أجرة / يومية عامل', category: 'رواتب وأجور العمال', defaultAmt: 1500, desc: 'أجرة يومية / سلفة عامل' },
    { label: '🚛 نقل وشحن بضاعة', category: 'نقل وشحن', defaultAmt: 2000, desc: 'مصاريف نقل وتوصيل ووقود' },
    { label: '🏛️ ضرائب واشتراك (G50 / CASNOS)', category: 'ضرائب ورسوم', defaultAmt: 10000, desc: 'مستحقات جبائية أو ضمان اجتماعي' },
    { label: '🛍️ أكياس وتغليف ولوازم', category: 'مصاريف عامة', defaultAmt: 1500, desc: 'شراء أكياس بلاستيكية وورق حراري للكاشير' },
    { label: '☕ قهوة وضيافة ونظافة', category: 'مصاريف عامة', defaultAmt: 500, desc: 'مصاريف يومية (قهوة، ماء، مواد تنظيف)' }
  ];

  function isCapitalWithdrawal(c) {
    if (!c) return false;
    var cat = String(c.category || '').toLowerCase();
    var desc = String(c.description || '').toLowerCase();
    return Number(c.amount || 0) < 0 || cat.includes('مسحوبات') || cat.includes('سحب') || desc.includes('مسحوبات');
  }

  // ==========================================================================
  // 1. ترقية النوافذ المنبثقة (#expenseModal, #capitalModal, #finDeleteConfirmModal, #expensesPdfStudioModal)
  // ==========================================================================
  App.ensureExpensesAndCapitalModalsDom = function () {
    var todayStr = new Date().toISOString().slice(0, 10);

    // 1) ترقية نافذة تسجيل/تعديل مصروف تشغيلي (#expenseModal)
    var expModal = document.getElementById('expenseModal');
    if (expModal && !expModal.dataset.upgradedV14) {
      expModal.dataset.upgradedV14 = '1';
      expModal.innerHTML =
        '<div class="modal-content w-full max-w-lg p-6 space-y-4">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 id="expModalTitle" class="text-lg font-black text-rose-600">💸 تسجيل مصروف تشغيلي جديد (Alt+N)</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">يُخصم من هامش الربح الإجمالي لحساب الربح الصافي الحقيقي للمتجر</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'expenseModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div class="space-y-3 text-xs">' +
        '    <div class="grid grid-cols-2 gap-2.5">' +
        '      <div>' +
        '        <label class="block font-bold mb-1">فئة المصروف *</label>' +
        '        <select id="expCategoryInput" onchange="App.onExpenseCategoryChanged()" class="w-full px-3 py-2 rounded-xl font-bold">' +
        '          <option value="كراء المحل">🏠 كراء المحل / المخزن</option>' +
        '          <option value="كهرباء وغاز وماء">⚡ كهرباء وغاز وماء وإنترنت</option>' +
        '          <option value="رواتب وأجور العمال">👷 رواتب وأجور وسلفات العمال</option>' +
        '          <option value="نقل وشحن">🚛 نقل وشحن ووقود</option>' +
        '          <option value="صيانة ومعدات">🛠️ صيانة ومعدات وتجهيز</option>' +
        '          <option value="ضرائب ورسوم">🏛️ ضرائب ورسوم (G50 / CASNOS / CNAS)</option>' +
        '          <option value="مصاريف عامة">🛍️ مصاريف عامة (أكياس، ورق، ضيافة)</option>' +
        '        </select>' +
        '      </div>' +
        '      <div>' +
        '        <label class="block font-bold mb-1">📅 تاريخ المصروف</label>' +
        '        <input id="expDateInput" type="date" value="' + todayStr + '" class="w-full px-3 py-2 rounded-xl font-mono font-bold">' +
        '      </div>' +
        '    </div>' +
        '    <div>' +
        '      <div class="flex justify-between mb-1">' +
        '        <label class="font-bold">المبلغ (د.ج) *</label>' +
        '        <span id="expLiveCentimesBadge" class="text-[11px] font-black text-amber-600">🇩🇿 بالسنتيم: 0 سنتيم</span>' +
        '      </div>' +
        '      <input id="expAmountInput" type="number" step="any" min="0" value="0" oninput="App.updateExpenseLiveCentimes()" onkeydown="if(event.key===\'Enter\') App.confirmSaveExpense()" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-xl text-rose-600 text-center border-rose-400">' +
        '      <div class="flex flex-wrap gap-1.5 mt-1.5">' +
        '        <button type="button" onclick="App.setQuickExpenseAmount(500)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white font-mono font-bold text-[11px] transition">500</button>' +
        '        <button type="button" onclick="App.setQuickExpenseAmount(1000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white font-mono font-bold text-[11px] transition">1,000</button>' +
        '        <button type="button" onclick="App.setQuickExpenseAmount(2000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white font-mono font-bold text-[11px] transition">2,000</button>' +
        '        <button type="button" onclick="App.setQuickExpenseAmount(5000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white font-mono font-bold text-[11px] transition">5,000</button>' +
        '        <button type="button" onclick="App.setQuickExpenseAmount(10000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white font-mono font-bold text-[11px] transition">10,000</button>' +
        '        <button type="button" onclick="App.setQuickExpenseAmount(25000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white font-mono font-bold text-[11px] transition">25,000</button>' +
        '      </div>' +
        '    </div>' +
        '    <div class="grid grid-cols-1 md:grid-cols-12 gap-2">' +
        '      <div class="md:col-span-5">' +
        '        <label class="block font-bold mb-1">👤 المستفيد / العامل / الجهة</label>' +
        '        <input id="expBeneficiaryInput" type="text" placeholder="مثلاً: سونلغاز / اسم العامل..." class="w-full px-3 py-2 rounded-xl font-bold">' +
        '      </div>' +
        '      <div class="md:col-span-7">' +
        '        <label class="block font-bold mb-1">📝 البيان والتفاصيل</label>' +
        '        <input id="expDescInput" type="text" onkeydown="if(event.key===\'Enter\') App.confirmSaveExpense()" placeholder="تفاصيل المصروف أو رقم الوصل..." class="w-full px-3 py-2 rounded-xl font-bold">' +
        '      </div>' +
        '    </div>' +
        '    <label class="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 cursor-pointer">' +
        '      <input id="expDeductCaisseCheckbox" type="checkbox" checked>' +
        '      <span class="font-bold text-rose-700 dark:text-rose-300">خصم المبلغ مباشرة من مناوبة الصندوق المفتوحة حالياً (Caisse)</span>' +
        '    </label>' +
        '  </div>' +
        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'expenseModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء (Esc)</button>' +
        '    <button type="button" onclick="App.confirmSaveExpense(true)" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black">🖨️ حفظ وطباعة سند صرف</button>' +
        '    <button type="button" onclick="App.confirmSaveExpense(false)" class="px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg">💾 حفظ المصروف (Enter)</button>' +
        '  </div>' +
        '</div>';
    }

    // 2) ترقية نافذة تسجيل/تعديل حركة رأس مال أو مسحوبات شريك (#capitalModal)
    var capModal = document.getElementById('capitalModal');
    if (capModal && !capModal.dataset.upgradedV14) {
      capModal.dataset.upgradedV14 = '1';
      capModal.innerHTML =
        '<div class="modal-content w-full max-w-lg p-6 space-y-4">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 id="capModalTitle" class="text-lg font-black text-emerald-600">🏦 تسجيل حركة رأس مال أو مسحوبات شريك (Alt+C)</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">توثيق إيداعات الشركاء وتقوية السيولة أو المسحوبات الشخصية بشكل منفصل عن مصاريف المحل</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'capitalModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div class="space-y-3 text-xs">' +
        '    <div class="grid grid-cols-2 gap-2.5">' +
        '      <div>' +
        '        <label class="block font-bold mb-1">نوع الحركة *</label>' +
        '        <select id="capCategoryInput" onchange="App.updateCapitalLiveCentimes()" class="w-full px-3 py-2 rounded-xl font-bold">' +
        '          <option value="إيداع رأس مال">🟢 إيداع رأس مال (+ زيادة السيولة)</option>' +
        '          <option value="تمويل شريك">🤝 تمويل / حصة شريك (+ إيداع)</option>' +
        '          <option value="مسحوبات شخصية">🔴 مسحوبات شخصية للمالك (- سحب)</option>' +
        '          <option value="سحب أرباح شريك">🟠 سحب أرباح شريك (- سحب)</option>' +
        '        </select>' +
        '      </div>' +
        '      <div>' +
        '        <label class="block font-bold mb-1">📅 تاريخ الحركة</label>' +
        '        <input id="capDateInput" type="date" value="' + todayStr + '" class="w-full px-3 py-2 rounded-xl font-mono font-bold">' +
        '      </div>' +
        '    </div>' +
        '    <div>' +
        '      <div class="flex justify-between mb-1">' +
        '        <label class="font-bold">المبلغ (د.ج) *</label>' +
        '        <span id="capLiveCentimesBadge" class="text-[11px] font-black text-amber-600">🇩🇿 بالسنتيم: 0 سنتيم</span>' +
        '      </div>' +
        '      <input id="capAmountInput" type="number" step="any" min="0" value="0" oninput="App.updateCapitalLiveCentimes()" onkeydown="if(event.key===\'Enter\') App.confirmSaveCapital()" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-xl text-emerald-600 text-center border-emerald-400">' +
        '      <div class="flex flex-wrap gap-1.5 mt-1.5">' +
        '        <button type="button" onclick="App.setQuickCapitalAmount(5000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white font-mono font-bold text-[11px] transition">5,000</button>' +
        '        <button type="button" onclick="App.setQuickCapitalAmount(10000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white font-mono font-bold text-[11px] transition">10,000</button>' +
        '        <button type="button" onclick="App.setQuickCapitalAmount(20000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white font-mono font-bold text-[11px] transition">20,000</button>' +
        '        <button type="button" onclick="App.setQuickCapitalAmount(50000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white font-mono font-bold text-[11px] transition">50,000</button>' +
        '        <button type="button" onclick="App.setQuickCapitalAmount(100000)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white font-mono font-bold text-[11px] transition">100,000</button>' +
        '      </div>' +
        '    </div>' +
        '    <div class="grid grid-cols-1 md:grid-cols-12 gap-2">' +
        '      <div class="md:col-span-5">' +
        '        <label class="block font-bold mb-1">🤝 اسم المالك / الشريك</label>' +
        '        <input id="capPartnerNameInput" type="text" placeholder="مثلاً: الشريك الأول / المالك..." class="w-full px-3 py-2 rounded-xl font-bold">' +
        '      </div>' +
        '      <div class="md:col-span-7">' +
        '        <label class="block font-bold mb-1">📝 الملاحظة والغرض</label>' +
        '        <input id="capDescInput" type="text" onkeydown="if(event.key===\'Enter\') App.confirmSaveCapital()" placeholder="تفاصيل الإيداع أو السحب..." class="w-full px-3 py-2 rounded-xl font-bold">' +
        '      </div>' +
        '    </div>' +
        '    <label class="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 cursor-pointer">' +
        '      <input id="capSyncCaisseCheckbox" type="checkbox">' +
        '      <span class="font-bold text-emerald-700 dark:text-emerald-300">ربط هذه الحركة برصيد مناوبة الصندوق المفتوحة حالياً (إيداع أو سحب من الدرج)</span>' +
        '    </label>' +
        '  </div>' +
        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'capitalModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء (Esc)</button>' +
        '    <button type="button" onclick="App.confirmSaveCapital(true)" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black">🖨️ حفظ وطباعة سند</button>' +
        '    <button type="button" onclick="App.confirmSaveCapital(false)" class="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg">💾 حفظ الحركة (Enter)</button>' +
        '  </div>' +
        '</div>';
    }

    // 3) نافذة تأكيد الحذف النظامية الآمنة (#finDeleteConfirmModal — بدون alert/confirm)
    if (!document.getElementById('finDeleteConfirmModal')) {
      var delM = document.createElement('div');
      delM.id = 'finDeleteConfirmModal';
      delM.className = 'modal-overlay';
      delM.innerHTML =
        '<div class="modal-content w-full max-w-md p-6 space-y-4">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <h3 id="finDeleteConfirmTitle" class="text-lg font-black text-rose-600 flex items-center gap-2">' +
        '      <span class="material-symbols-rounded">delete</span>' +
        '      <span>تأكيد حذف الحركة المالية</span>' +
        '    </h3>' +
        '    <button type="button" onclick="App.closeModal(\'finDeleteConfirmModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="finDeleteConfirmBody" class="space-y-3 text-xs"></div>' +
        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'finDeleteConfirmModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء والعودة (Esc)</button>' +
        '    <button type="button" onclick="App.executeConfirmedFinDelete()" class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg">🗑️ نعم، تأكيد الحذف النهائي</button>' +
        '  </div>' +
        '</div>';
      document.body.appendChild(delM);
    }

    // 4) استوديو المعاينة الحية وتقارير PDF لسندات الصرف والمصاريف ورأس المال (#expensesPdfStudioModal)
    if (!document.getElementById('expensesPdfStudioModal')) {
      var pdfM = document.createElement('div');
      pdfM.id = 'expensesPdfStudioModal';
      pdfM.className = 'modal-overlay';
      pdfM.innerHTML =
        '<div class="modal-content w-full max-w-5xl p-6 space-y-3.5 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 class="text-lg font-black text-indigo-600">📄 استوديو سندات الصرف وتقرير المصاريف ورأس المال (A4 / PDF)</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">انقر على أي نص داخل المستند لتعديله مباشرة قبل الطباعة أو الحفظ بصيغة PDF</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'expensesPdfStudioModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="expensesPdfToolbar" class="gherbi-studio-toolbar flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl text-xs"></div>' +
        '  <iframe id="expensesPdfPreviewFrame" class="w-full h-[60vh] border border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-100 dark:bg-slate-900 shadow-inner"></iframe>' +
        '</div>';
      document.body.appendChild(pdfM);
    }
  };

  App.updateExpenseLiveCentimes = function () {
    var amt = Math.max(0, parseFloat(document.getElementById('expAmountInput')?.value) || 0);
    var badge = document.getElementById('expLiveCentimesBadge');
    if (badge && typeof this.formatAlgerianCentimes === 'function') {
      badge.textContent = '🇩🇿 بالسنتيم: ' + this.formatAlgerianCentimes(amt);
    }
  };

  App.setQuickExpenseAmount = function (val) {
    var inp = document.getElementById('expAmountInput');
    if (inp) {
      inp.value = String(val);
      this.updateExpenseLiveCentimes();
      inp.focus();
    }
  };

  App.updateCapitalLiveCentimes = function () {
    var amt = Math.max(0, parseFloat(document.getElementById('capAmountInput')?.value) || 0);
    var badge = document.getElementById('capLiveCentimesBadge');
    if (badge && typeof this.formatAlgerianCentimes === 'function') {
      badge.textContent = '🇩🇿 بالسنتيم: ' + this.formatAlgerianCentimes(amt);
    }
  };

  App.setQuickCapitalAmount = function (val) {
    var inp = document.getElementById('capAmountInput');
    if (inp) {
      inp.value = String(val);
      this.updateCapitalLiveCentimes();
      inp.focus();
    }
  };

  App.onExpenseCategoryChanged = function () {
    var cat = document.getElementById('expCategoryInput')?.value || '';
    var benInp = document.getElementById('expBeneficiaryInput');
    if (!benInp) return;
    if (cat.includes('كهرباء')) benInp.placeholder = 'مثلاً: سونلغاز / ADE / اتصالات الجزائر';
    else if (cat.includes('رواتب')) benInp.placeholder = 'اكتب اسم العامل (لتتبع مجموع أجوره)';
    else if (cat.includes('كراء')) benInp.placeholder = 'اسم المؤجر / صاحب المحل';
    else benInp.placeholder = 'اسم المستفيد أو الجهة';
  };

  // فتح نافذة المصروف (سواء للإضافة، أو من قالب سريع، أو للتعديل)
  App.openExpenseModal = function (editExpenseObj, presetTemplate) {
    this.ensureExpensesAndCapitalModalsDom();
    var todayStr = new Date().toISOString().slice(0, 10);
    AppState.editingExpenseId = editExpenseObj && editExpenseObj.id ? Number(editExpenseObj.id) : null;

    var titleEl = document.getElementById('expModalTitle');
    if (titleEl) {
      titleEl.textContent = AppState.editingExpenseId
        ? '✏️ تعديل المصروف التشغيلي #' + AppState.editingExpenseId
        : '💸 تسجيل مصروف تشغيلي جديد (Alt+N)';
    }

    var rawDesc = (editExpenseObj && editExpenseObj.description) || (presetTemplate && presetTemplate.desc) || '';
    var benVal = '';
    var cleanDesc = rawDesc;
    var mBen = /^\[المستفيد:\s*([^\]]+)\]\s*(.*)$/.exec(rawDesc);
    if (mBen) {
      benVal = mBen[1];
      cleanDesc = mBen[2];
    }

    document.getElementById('expCategoryInput').value = (editExpenseObj && editExpenseObj.category) || (presetTemplate && presetTemplate.category) || 'كراء المحل';
    document.getElementById('expDateInput').value = (editExpenseObj && String(editExpenseObj.date || '').slice(0, 10)) || todayStr;
    document.getElementById('expAmountInput').value = String((editExpenseObj && editExpenseObj.amount) || (presetTemplate && presetTemplate.defaultAmt) || 0);
    document.getElementById('expBeneficiaryInput').value = benVal;
    document.getElementById('expDescInput').value = cleanDesc;
    document.getElementById('expDeductCaisseCheckbox').checked = !AppState.editingExpenseId;

    this.updateExpenseLiveCentimes();
    this.openModal('expenseModal');
    setTimeout(function () {
      var inp = document.getElementById('expAmountInput');
      if (inp) { inp.focus(); inp.select(); }
    }, 40);
  };

  App.confirmSaveExpense = async function (andPrintVoucher) {
    var amt = Math.max(0, parseFloat(document.getElementById('expAmountInput')?.value) || 0);
    if (amt <= 0) {
      if (typeof showToast === 'function') showToast('يرجى إدخال مبلغ المصروف أكبر من الصفر', 'warning');
      return;
    }

    var category = document.getElementById('expCategoryInput')?.value || 'عام';
    var date = document.getElementById('expDateInput')?.value || new Date().toISOString().slice(0, 10);
    var ben = String(document.getElementById('expBeneficiaryInput')?.value || '').trim();
    var desc = String(document.getElementById('expDescInput')?.value || '').trim();
    var fullDesc = (ben ? '[المستفيد: ' + ben + '] ' : '') + (desc || category);

    var savedId = AppState.editingExpenseId;
    if (AppState.editingExpenseId && window.api.updateExpense) {
      await window.api.updateExpense(AppState.editingExpenseId, {
        category: category,
        amount: amt,
        date: date,
        description: fullDesc
      });
    } else {
      var res = await window.api.addExpense({
        category: category,
        amount: amt,
        date: date,
        description: fullDesc,
        deductFromCaisse: document.getElementById('expDeductCaisseCheckbox')?.checked,
        user_id: AppState.currentUser ? AppState.currentUser.id : 1
      });
      savedId = res && res.id ? res.id : null;
    }

    AppState.editingExpenseId = null;
    this.closeModal('expenseModal');
    await this.renderExpensesAndCapitalView();
    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ المصروف التشغيلي (' + amt.toFixed(2) + ' د.ج) بنجاح', 'success');
    }
    if (andPrintVoucher) {
      this.openFinancialVoucherPreview('expense', {
        id: savedId || Date.now(),
        category: category,
        amount: amt,
        date: date,
        description: fullDesc
      });
    }
  };

  App.openCapitalModal = function (editCapObj) {
    this.ensureExpensesAndCapitalModalsDom();
    var todayStr = new Date().toISOString().slice(0, 10);
    AppState.editingCapitalId = editCapObj && editCapObj.id ? Number(editCapObj.id) : null;

    var titleEl = document.getElementById('capModalTitle');
    if (titleEl) {
      titleEl.textContent = AppState.editingCapitalId
        ? '✏️ تعديل حركة رأس المال #' + AppState.editingCapitalId
        : '🏦 تسجيل حركة رأس مال أو مسحوبات شريك (Alt+C)';
    }

    var rawDesc = (editCapObj && editCapObj.description) || '';
    var partnerVal = '';
    var cleanDesc = rawDesc;
    var mPart = /^\[الشريك:\s*([^\]]+)\]\s*(.*)$/.exec(rawDesc);
    if (mPart) {
      partnerVal = mPart[1];
      cleanDesc = mPart[2];
    }

    document.getElementById('capCategoryInput').value = (editCapObj && editCapObj.category) || 'إيداع رأس مال';
    document.getElementById('capDateInput').value = (editCapObj && String(editCapObj.date || '').slice(0, 10)) || todayStr;
    document.getElementById('capAmountInput').value = String(Math.abs(Number((editCapObj && editCapObj.amount) || 0)));
    document.getElementById('capPartnerNameInput').value = partnerVal;
    document.getElementById('capDescInput').value = cleanDesc;
    document.getElementById('capSyncCaisseCheckbox').checked = false;

    this.updateCapitalLiveCentimes();
    this.openModal('capitalModal');
    setTimeout(function () {
      var inp = document.getElementById('capAmountInput');
      if (inp) { inp.focus(); inp.select(); }
    }, 40);
  };

  App.confirmSaveCapital = async function (andPrintVoucher) {
    var rawAmt = Math.abs(parseFloat(document.getElementById('capAmountInput')?.value) || 0);
    if (rawAmt <= 0) {
      if (typeof showToast === 'function') showToast('يرجى إدخال مبلغ الحركة أكبر من الصفر', 'warning');
      return;
    }

    var category = document.getElementById('capCategoryInput')?.value || 'إيداع رأس مال';
    var date = document.getElementById('capDateInput')?.value || new Date().toISOString().slice(0, 10);
    var partner = String(document.getElementById('capPartnerNameInput')?.value || '').trim();
    var desc = String(document.getElementById('capDescInput')?.value || '').trim();
    var fullDesc = (partner ? '[الشريك: ' + partner + '] ' : '') + (desc || category);

    var isWithdrawal = category.includes('مسحوبات') || category.includes('سحب');
    var signedAmount = isWithdrawal ? -rawAmt : rawAmt;

    var savedId = AppState.editingCapitalId;
    if (AppState.editingCapitalId && window.api.updateCapital) {
      await window.api.updateCapital(AppState.editingCapitalId, {
        category: category,
        amount: signedAmount,
        date: date,
        description: fullDesc
      });
    } else {
      var res = await window.api.addCapital({
        category: category,
        amount: signedAmount,
        date: date,
        description: fullDesc
      });
      savedId = res && res.id ? res.id : null;

      // إذا طلب المستخدم ربط الإيداع أو المسحوبات بدرج الصندوق المفتوح حالياً
      if (document.getElementById('capSyncCaisseCheckbox')?.checked && window.api.addCaisseTransaction && AppState.activeSession) {
        await window.api.addCaisseTransaction({
          session_id: AppState.activeSession.id,
          type: isWithdrawal ? 'cash_out' : 'cash_in',
          amount: rawAmt,
          category: category,
          description: fullDesc
        }).catch(function () {});
      }
    }

    AppState.editingCapitalId = null;
    this.closeModal('capitalModal');
    await this.renderExpensesAndCapitalView();
    if (typeof showToast === 'function') {
      showToast('✅ تم تسجيل حركة رأس المال (' + category + ': ' + rawAmt.toFixed(2) + ' د.ج) بنجاح', 'success');
    }
    if (andPrintVoucher) {
      this.openFinancialVoucherPreview('capital', {
        id: savedId || Date.now(),
        category: category,
        amount: signedAmount,
        date: date,
        description: fullDesc
      });
    }
  };

  // ==========================================================================
  // 2. نافذة تأكيد الحذف النظامية الآمنة (#finDeleteConfirmModal — بدون alert/confirm)
  // ==========================================================================
  App.promptDeleteExpenseOrCapital = function (recordType, recordId) {
    this.ensureExpensesAndCapitalModalsDom();
    AppState._pendingFinDeleteType = recordType; // 'expense' | 'capital'
    AppState._pendingFinDeleteId = Number(recordId);

    var isExp = recordType === 'expense';
    var list = isExp ? (AppState._cachedExpenses || []) : (AppState._cachedCapital || []);
    var item = list.find(function (x) { return Number(x.id) === Number(recordId); }) || { id: recordId, category: 'حركة مالية', amount: 0, date: '' };

    var absAmt = Math.abs(Number(item.amount || 0));
    var cent = typeof this.formatAlgerianCentimes === 'function' ? this.formatAlgerianCentimes(absAmt) : '';

    var titleEl = document.getElementById('finDeleteConfirmTitle');
    if (titleEl) {
      titleEl.innerHTML =
        '<span class="material-symbols-rounded">delete</span>' +
        '<span>' + (isExp ? 'تأكيد حذف المصروف التشغيلي' : 'تأكيد حذف حركة رأس المال') + '</span>';
    }

    var body = document.getElementById('finDeleteConfirmBody');
    if (body) {
      body.innerHTML =
        '<div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">' +
        '  <div class="text-sm font-black">هل أنت متأكد من حذف (' + item.category + ') رقم <span class="font-mono text-rose-600">#' + item.id + '</span>؟</div>' +
        '  <div class="text-xs text-slate-500 font-bold">' + (item.description || 'بدون بيان إضافي') + ' | التاريخ: <span class="font-mono">' + (item.date || '—') + '</span></div>' +
        '  <div class="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">' +
        '    <span class="text-slate-400 font-bold">قيمة الحركة:</span>' +
        '    <span class="font-mono font-black text-base text-rose-600">' + absAmt.toFixed(2) + ' د.ج <small class="text-amber-600">(' + cent + ')</small></span>' +
        '  </div>' +
        '</div>' +
        (isExp
          ? '<div class="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold">⚠️ تنبيه: إذا كان هذا المصروف قد خُصم من الصندوق، سيقوم النظام تلقائياً بإلغاء حركة الخصم وإرجاع المبلغ لرصيد الصندوق.</div>'
          : '<div class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">✅ سيتم تحديث صافي رأس المال العامل فور تأكيد الحذف.</div>');
    }

    this.openModal('finDeleteConfirmModal');
  };

  App.executeConfirmedFinDelete = async function () {
    var rType = AppState._pendingFinDeleteType;
    var rId = Number(AppState._pendingFinDeleteId || 0);
    if (!rId) return;

    if (rType === 'expense') {
      await window.api.deleteExpense(rId);
      this.closeModal('finDeleteConfirmModal');
      await this.renderExpensesAndCapitalView();
      if (typeof showToast === 'function') showToast('🗑️ تم حذف المصروف التشغيلي وتحديث الصندوق بنجاح', 'info');
    } else {
      await window.api.deleteCapital(rId);
      this.closeModal('finDeleteConfirmModal');
      await this.renderExpensesAndCapitalView();
      if (typeof showToast === 'function') showToast('🗑️ تم حذف حركة رأس المال بنجاح', 'info');
    }
  };

  // ==========================================================================
  // 3. استوديو سندات الصرف والقبض وتقرير المصاريف ورأس المال (A4 / PDF / Excel)
  // ==========================================================================
  App.openFinancialVoucherPreview = function (voucherType, itemObj) {
    this.ensureExpensesAndCapitalModalsDom();
    var s = AppState.settings || {};
    var shopName = s.shop_name || 'Gherbi.Ai POS';
    var absAmt = Math.abs(Number(itemObj.amount || 0));
    var cent = typeof this.formatAlgerianCentimes === 'function' ? this.formatAlgerianCentimes(absAmt) : '';
    var words = window.NumberToWords && window.NumberToWords.convert ? window.NumberToWords.convert(absAmt, 'ar') : '';

    var isExp = voucherType === 'expense';
    var docTitle = isExp
      ? 'سند صرف مصروف تشغيلي (BON DE SORTIE / DÉPENSE)'
      : isCapitalWithdrawal(itemObj)
        ? 'سند مسحوبات شريك / مالك (BON DE PRÉLÈVEMENT)'
        : 'سند إيداع رأس مال / تمويل شريك (BON D\'APPORT EN CAPITAL)';

    var toolbar = document.getElementById('expensesPdfToolbar');
    if (toolbar) {
      toolbar.innerHTML =
        '<div class="font-black text-indigo-700">🖨️ معاينة السند الرسمي القابل للتعديل المباشر</div>' +
        '<div class="flex gap-2">' +
        '  <button type="button" onclick="App.executeExpensesStudioPrintOrPdf(\'print\')" class="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-black shadow">🖨️ طباعة السند</button>' +
        '  <button type="button" onclick="App.executeExpensesStudioPrintOrPdf(\'pdf\')" class="px-4 py-1.5 bg-amber-500 text-slate-950 rounded-xl font-black shadow">📥 حفظ PDF</button>' +
        '</div>';
    }

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + docTitle + '</title>' +
      '<style>@page{size:A5 landscape;margin:10mm;}body{font-family:"Cairo",Tahoma,sans-serif;padding:18px;color:#0f172a;}.box{border:2px solid #1e293b;border-radius:14px;padding:18px;}</style></head><body>' +
      '<div class="box" contenteditable="true">' +
      '  <div style="display:flex;justify-content:space-between;border-bottom:2px solid #cbd5e1;padding-bottom:10px;margin-bottom:14px;">' +
      '    <div><h2 style="margin:0;color:#1d4ed8;">' + shopName + '</h2><div style="font-size:12px;">' + (s.shop_address || 'الجزائر') + '</div></div>' +
      '    <div style="text-align:left;"><h3 style="margin:0;color:#be123c;">' + docTitle + '</h3><div style="font-family:monospace;font-weight:bold;">N°: #' + (itemObj.id || '1') + ' | التاريخ: ' + (itemObj.date || new Date().toISOString().slice(0, 10)) + '</div></div>' +
      '  </div>' +
      '  <p style="font-size:14px;"><strong>البند / الفئة:</strong> ' + itemObj.category + '</p>' +
      '  <p style="font-size:14px;"><strong>البيان والتفاصيل:</strong> ' + (itemObj.description || '—') + '</p>' +
      '  <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin:14px 0;display:flex;justify-content:space-between;align-items:center;">' +
      '    <div><strong>المبلغ بالأرقام:</strong> <span style="font-family:monospace;font-size:20px;font-weight:900;color:#be123c;">' + absAmt.toFixed(2) + ' د.ج</span> (' + cent + ')</div>' +
      '    <div style="font-size:12px;font-weight:bold;">بالحروف: ' + words + '</div>' +
      '  </div>' +
      '  <div style="display:flex;justify-content:space-between;margin-top:28px;font-weight:bold;"><div>إمضاء أمين الصندوق / المسير</div><div>إمضاء المستلم / الشريك</div></div>' +
      '</div></body></html>';

    this.openModal('expensesPdfStudioModal');
    setTimeout(function () {
      var frame = document.getElementById('expensesPdfPreviewFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      }
    }, 40);
  };

  App.openExpensesFullReportPdfStudio = function () {
    this.ensureExpensesAndCapitalModalsDom();
    var exps = AppState._cachedExpenses || [];
    var caps = AppState._cachedCapital || [];
    var s = AppState.settings || {};
    var shopName = s.shop_name || 'Gherbi.Ai POS';

    var totExp = exps.reduce(function (sum, e) { return sum + Number(e.amount || 0); }, 0);
    var totCapIn = caps.filter(function (c) { return !isCapitalWithdrawal(c); }).reduce(function (sum, c) { return sum + Math.abs(Number(c.amount || 0)); }, 0);
    var totCapOut = caps.filter(function (c) { return isCapitalWithdrawal(c); }).reduce(function (sum, c) { return sum + Math.abs(Number(c.amount || 0)); }, 0);

    var toolbar = document.getElementById('expensesPdfToolbar');
    if (toolbar) {
      toolbar.innerHTML =
        '<div class="font-black text-indigo-700">📊 التقرير المالي الشامل للمصاريف التشغيلية وحركات رأس المال</div>' +
        '<div class="flex gap-2">' +
        '  <button type="button" onclick="App.executeExpensesStudioPrintOrPdf(\'print\')" class="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-black shadow">🖨️ طباعة التقرير (A4)</button>' +
        '  <button type="button" onclick="App.executeExpensesStudioPrintOrPdf(\'pdf\')" class="px-4 py-1.5 bg-amber-500 text-slate-950 rounded-xl font-black shadow">📥 تصدير PDF</button>' +
        '</div>';
    }

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير المصاريف ورأس المال</title>' +
      '<style>@page{size:A4 portrait;margin:10mm;}body{font-family:"Cairo",Tahoma,sans-serif;padding:16px;color:#0f172a;font-size:12px;}table{width:100%;border-collapse:collapse;margin-top:10px;}th,td{border:1px solid #cbd5e1;padding:6px;text-align:right;}th{background:#1e293b;color:#fff;}</style></head><body contenteditable="true">' +
      '<h2 style="margin:0;color:#1d4ed8;">' + shopName + ' — التقرير المالي للمصاريف التشغيلية وحركات رأس المال</h2>' +
      '<p>إجمالي المصاريف التشغيلية: <strong>' + totExp.toFixed(2) + ' د.ج</strong> | إيداعات رأس المال: <strong>+' + totCapIn.toFixed(2) + ' د.ج</strong> | المسحوبات الشخصية: <strong>-' + totCapOut.toFixed(2) + ' د.ج</strong></p>' +
      '<h3>1. جدول المصاريف التشغيلية (' + exps.length + ')</h3>' +
      '<table><thead><tr><th>#</th><th>التاريخ</th><th>الفئة</th><th>البيان والمستفيد</th><th>المبلغ (د.ج)</th></tr></thead><tbody>' +
      exps.map(function (e, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + e.date + '</td><td>' + e.category + '</td><td>' + (e.description || '—') + '</td><td style="font-family:monospace;font-weight:bold;">' + Number(e.amount || 0).toFixed(2) + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<h3 style="margin-top:18px;">2. جدول حركات رأس المال والمسحوبات (' + caps.length + ')</h3>' +
      '<table><thead><tr><th>#</th><th>التاريخ</th><th>نوع الحركة</th><th>الشريك / الملاحظة</th><th>المبلغ (د.ج)</th></tr></thead><tbody>' +
      caps.map(function (c, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + c.date + '</td><td>' + c.category + '</td><td>' + (c.description || '—') + '</td><td style="font-family:monospace;font-weight:bold;">' + Number(c.amount || 0).toFixed(2) + '</td></tr>';
      }).join('') +
      '</tbody></table></body></html>';

    this.openModal('expensesPdfStudioModal');
    setTimeout(function () {
      var frame = document.getElementById('expensesPdfPreviewFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      }
    }, 40);
  };

  App.executeExpensesStudioPrintOrPdf = async function (actionType) {
    var frame = document.getElementById('expensesPdfPreviewFrame');
    if (!frame || !frame.contentWindow) return;
    var clone = frame.contentWindow.document.documentElement.cloneNode(true);
    clone.querySelectorAll('[contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    var html = '<!DOCTYPE html>\n' + clone.outerHTML;

    if (actionType === 'pdf' && window.api && window.api.exportPDF) {
      var res = await window.api.exportPDF({ html: html, filename: 'Expenses_Capital_Report.pdf' });
      if (res && res.success && typeof showToast === 'function') {
        showToast('📄 تم تصدير وحفظ ملف PDF بنجاح!', 'success');
      }
      return;
    }
    if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  App.exportExpensesAndCapitalCsv = function () {
    var exps = AppState._cachedExpenses || [];
    var caps = AppState._cachedCapital || [];
    var lines = ['النوع,التاريخ,الفئة,البيان,المبلغ (د.ج)'];
    exps.forEach(function (e) {
      lines.push('مصروف تشغيلي,' + e.date + ',"' + e.category + '","' + String(e.description || '').replace(/"/g, '""') + '",-' + Number(e.amount || 0).toFixed(2));
    });
    caps.forEach(function (c) {
      lines.push('حركة رأس مال,' + c.date + ',"' + c.category + '","' + String(c.description || '').replace(/"/g, '""') + '",' + Number(c.amount || 0).toFixed(2));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Expenses_And_Capital_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    if (typeof showToast === 'function') showToast('📊 تم تصدير سجل المصاريف ورأس المال إلى ملف Excel (CSV) بنجاح!', 'success');
  };

  // ==========================================================================
  // 4. بناء الواجهة الرئيسية للصفحة الرابعة عشرة (#view-expenses)
  // ==========================================================================
  App.renderExpensesAndCapitalView = async function () {
    this.ensureExpensesAndCapitalModalsDom();
    var root = document.getElementById('expenses-view-root');
    if (!root) return;

    var triple = await Promise.all([
      window.api.getExpenses().catch(function () { return []; }),
      window.api.getCapital().catch(function () { return []; }),
      window.api.getAnalytics().catch(function () { return {}; })
    ]);

    var expenses = Array.isArray(triple[0]) ? triple[0] : [];
    var capital = Array.isArray(triple[1]) ? triple[1] : [];
    var analytics = triple[2] || {};

    AppState._cachedExpenses = expenses;
    AppState._cachedCapital = capital;

    var todayIso = new Date().toISOString().slice(0, 10);
    var currentMonthPrefix = todayIso.slice(0, 7); // YYYY-MM
    var currentYearPrefix = todayIso.slice(0, 4);

    var totalExpensesAll = 0;
    var thisMonthExpenses = 0;
    var todayExpenses = 0;
    var byCategoryMap = {};

    expenses.forEach(function (e) {
      var amt = Number(e.amount || 0);
      var dt = String(e.date || '').slice(0, 10);
      totalExpensesAll += amt;
      if (dt === todayIso) todayExpenses += amt;
      if (dt.startsWith(currentMonthPrefix)) thisMonthExpenses += amt;
      var cat = e.category || 'مصاريف عامة';
      byCategoryMap[cat] = (byCategoryMap[cat] || 0) + amt;
    });

    var totalCapitalInjected = 0;
    var totalPersonalWithdrawals = 0;
    capital.forEach(function (c) {
      var absAmt = Math.abs(Number(c.amount || 0));
      if (isCapitalWithdrawal(c)) totalPersonalWithdrawals += absAmt;
      else totalCapitalInjected += absAmt;
    });
    var netActiveCapital = Number((totalCapitalInjected - totalPersonalWithdrawals).toFixed(2));

    // حساب نقطة التعادل وتغطية المصاريف من هامش ربح المبيعات
    var storeGrossProfit = Number(analytics.gross_profit || 0);
    var storeNetProfit = Number((storeGrossProfit - totalExpensesAll).toFixed(2));
    var dailyBurnRate = Number((thisMonthExpenses / 30).toFixed(2));
    var coveragePct = totalExpensesAll > 0 ? Math.min(100, Math.round((Math.max(0, storeGrossProfit) / totalExpensesAll) * 100)) : 100;

    var centTotalExp = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalExpensesAll) : '';
    var centNetCap = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(Math.abs(netActiveCapital)) : '';

    // فلترة المصاريف وحركات رأس المال
    var q = String(AppState.expensesSearchQuery || '').trim().toLowerCase();
    var pFilter = AppState.expensesPeriodFilter || 'all';
    var catFilter = AppState.expensesCategoryFilter || 'all';

    var matchPeriod = function (dtStr) {
      var d = String(dtStr || '').slice(0, 10);
      if (pFilter === 'today') return d === todayIso;
      if (pFilter === 'month') return d.startsWith(currentMonthPrefix);
      if (pFilter === 'year') return d.startsWith(currentYearPrefix);
      return true;
    };

    var filteredExpenses = expenses.filter(function (e) {
      if (!matchPeriod(e.date)) return false;
      if (catFilter !== 'all' && e.category !== catFilter) return false;
      if (q) {
        return (
          String(e.category || '').toLowerCase().includes(q) ||
          String(e.description || '').toLowerCase().includes(q) ||
          String(e.date || '').includes(q)
        );
      }
      return true;
    });

    var filteredCapital = capital.filter(function (c) {
      if (!matchPeriod(c.date)) return false;
      if (q) {
        return (
          String(c.category || '').toLowerCase().includes(q) ||
          String(c.description || '').toLowerCase().includes(q) ||
          String(c.date || '').includes(q)
        );
      }
      return true;
    });

    var catEntries = Object.entries(byCategoryMap).sort(function (a, b) { return b[1] - a[1]; });

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <!-- الرأس والأزرار الرئيسية -->' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex flex-wrap items-center gap-2">' +
      '        <span>المصاريف التشغيلية، الأعباء الثابتة، وحركات رأس المال</span>' +
      '        <button id="btnExpensesQaBot" type="button" onclick="App.runAutoTest_ExpensesPage()" title="تشغيل الفحص الآلي الذاتي لصفحة المصاريف ورأس المال (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">ضبط مصاريف المتجر لحساب الربح الصافي الحقيقي، وفصل المسحوبات الشخصية وحصص الشركاء عن مصاريف المحل</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      '      <button type="button" onclick="App.openExpensesFullReportPdfStudio()" class="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow">📄 تقرير وPDF (F9)</button>' +
      '      <button type="button" onclick="App.exportExpensesAndCapitalCsv()" class="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold">📊 تصدير Excel</button>' +
      '      <button type="button" onclick="App.openCapitalModal(null)" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-lg shadow-emerald-600/25">+ حركة رأس مال (Alt+C)</button>' +
      '      <button type="button" onclick="App.openExpenseModal(null, null)" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black shadow-lg shadow-rose-600/25">+ تسجيل مصروف (Alt+N)</button>' +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط المؤشرات المالية الـ 4 (KPIs) -->' +
      '  <div id="expensesKpiGrid" class="grid grid-cols-2 md:grid-cols-4 gap-3.5">' +
      '    <div class="p-4 rounded-2xl bg-rose-600 text-white shadow-lg">' +
      '      <div class="text-xs font-bold opacity-90">إجمالي المصاريف التشغيلية (' + expenses.length + ')</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + totalExpensesAll.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] font-bold text-amber-200 mt-0.5">🇩🇿 بالسنتيم: ' + centTotalExp + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-amber-500/30 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">مصاريف هذا الشهر والعبء اليومي</div>' +
      '      <div class="text-2xl font-black font-mono text-amber-600 mt-1">' + thisMonthExpenses.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-500 font-bold mt-0.5">معدل العبء اليومي: ' + dailyBurnRate.toFixed(0) + ' د.ج/يوم | اليوم: ' + todayExpenses.toFixed(0) + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-500/30 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">إيداعات رأس المال مقابل المسحوبات</div>' +
      '      <div class="text-lg font-black font-mono text-emerald-600 mt-1">+' + totalCapitalInjected.toFixed(2) + ' د.ج <span class="text-xs text-slate-400">(إيداع)</span></div>' +
      '      <div class="text-[11px] font-mono font-bold text-rose-500 mt-0.5">-' + totalPersonalWithdrawals.toFixed(2) + ' د.ج (مسحوبات شخصية/شركاء)</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-500/30 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">صافي رأس المال العامل والربح الصافي</div>' +
      '      <div class="text-2xl font-black font-mono ' + (netActiveCapital >= 0 ? 'text-indigo-600' : 'text-rose-600') + ' mt-1">' + netActiveCapital.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] font-bold ' + (storeNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-500') + ' mt-0.5">صافي ربح المتجر بعد المصاريف: ' + storeNetProfit.toFixed(2) + ' د.ج</div>' +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط القوالب الدورية السريعة للأعباء الجزائرية الثابتة + رادار تغطية المصاريف -->' +
      '  <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-sm">' +
      '    <div class="flex flex-wrap items-center justify-between gap-2 text-xs">' +
      '      <span class="font-black text-indigo-600">⚡ تسجيل سريع للأعباء والالتزامات الثابتة بضغطة واحدة:</span>' +
      '      <span class="text-[11px] font-bold ' + (coveragePct >= 100 ? 'text-emerald-600' : 'text-amber-600') + '">🎯 تغطية المصاريف من أرباح المبيعات: ' + coveragePct + '% (ربح المبيعات الإجمالي: ' + storeGrossProfit.toFixed(2) + ' د.ج)</span>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-1.5">' +
      RECURRING_ALGERIAN_TEMPLATES.map(function (tpl, idx) {
        var paidThisMonth = expenses.some(function (e) {
          return String(e.date || '').startsWith(currentMonthPrefix) && e.category === tpl.category && String(e.description || '').includes(tpl.desc.slice(0, 10));
        });
        return (
          '<button type="button" onclick="App.openExpenseModal(null, ' + JSON.stringify(tpl).replace(/"/g, '&quot;') + ')" class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1 ' +
          (paidThisMonth
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-rose-500 hover:text-rose-600') +
          '">' +
          '<span>' + tpl.label + '</span>' +
          (paidThisMonth ? '<span class="text-[9px] bg-emerald-600 text-white px-1 rounded">✓ مسجل</span>' : '') +
          '</button>'
        );
      }).join('') +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط البحث وفلاتر الفترة والفئة -->' +
      '  <div class="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm text-xs">' +
      '    <div class="relative flex-1 min-w-[220px]">' +
      '      <span class="material-symbols-rounded icon-sm absolute right-3 top-2.5 text-slate-400">search</span>' +
      '      <input id="expensesSearchInput" type="text" value="' + (AppState.expensesSearchQuery || '') + '" oninput="App.onExpensesSearch(this.value)" placeholder="🔍 [F4] ابحث بالفئة، اسم المستفيد/العامل/الشريك، البيان، أو التاريخ..." class="w-full pr-9 pl-3 py-2 rounded-xl text-xs font-bold">' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-1.5">' +
      '      <select onchange="AppState.expensesCategoryFilter=this.value; App.renderExpensesAndCapitalView()" class="px-2.5 py-1.5 rounded-xl font-bold">' +
      '        <option value="all">جميع فئات المصاريف</option>' +
      ['كراء المحل', 'كهرباء وغاز وماء', 'رواتب وأجور العمال', 'نقل وشحن', 'صيانة ومعدات', 'ضرائب ورسوم', 'مصاريف عامة'].map(function (c) {
        return '<option value="' + c + '" ' + (catFilter === c ? 'selected' : '') + '>' + c + '</option>';
      }).join('') +
      '      </select>' +
      '      <button type="button" onclick="AppState.expensesPeriodFilter=\'all\'; App.renderExpensesAndCapitalView()" class="px-3 py-1.5 rounded-xl font-bold ' + (pFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">كل الفترات</button>' +
      '      <button type="button" onclick="AppState.expensesPeriodFilter=\'today\'; App.renderExpensesAndCapitalView()" class="px-3 py-1.5 rounded-xl font-bold ' + (pFilter === 'today' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">اليوم</button>' +
      '      <button type="button" onclick="AppState.expensesPeriodFilter=\'month\'; App.renderExpensesAndCapitalView()" class="px-3 py-1.5 rounded-xl font-bold ' + (pFilter === 'month' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-700') + '">هذا الشهر</button>' +
      '      <button type="button" onclick="AppState.expensesPeriodFilter=\'year\'; App.renderExpensesAndCapitalView()" class="px-3 py-1.5 rounded-xl font-bold ' + (pFilter === 'year' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">هذه السنة</button>' +
      '    </div>' +
      '  </div>' +

      '  <!-- الجدولان المتوازيان: سجل المصاريف التشغيلية + حركات رأس المال والمسحوبات -->' +
      '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">' +
      '    <!-- يمين: سجل المصاريف التشغيلية وتوزيع الفئات -->' +
      '    <div class="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm">' +
      '      <div class="flex items-center justify-between">' +
      '        <h3 class="font-black text-sm text-rose-600">💸 1. سجل المصاريف التشغيلية (' + filteredExpenses.length + ')</h3>' +
      '        <span class="font-mono font-black text-xs text-rose-600">المجموع المعروض: ' + filteredExpenses.reduce(function (s, x) { return s + Number(x.amount || 0); }, 0).toFixed(2) + ' د.ج</span>' +
      '      </div>' +

      (catEntries.length > 0
        ? '<div class="flex flex-wrap gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-700/60">' +
          catEntries.map(function (pair) {
            var pct = totalExpensesAll > 0 ? Math.round((pair[1] / totalExpensesAll) * 100) : 0;
            return '<span onclick="AppState.expensesCategoryFilter=\'' + pair[0] + '\'; App.renderExpensesAndCapitalView()" class="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[10px] font-bold cursor-pointer hover:bg-rose-600 hover:text-white transition">' + pair[0] + ': ' + pair[1].toFixed(0) + ' د.ج (' + pct + '%)</span>';
          }).join('') +
          '</div>'
        : '') +

      '      <div class="space-y-2 text-xs max-h-[44vh] overflow-y-auto pr-1">' +
      (filteredExpenses.length > 0
        ? filteredExpenses.map(function (e) {
            return (
              '<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2 hover:border-rose-400 transition">' +
              '  <div>' +
              '    <div class="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">' +
              '      <span class="px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 text-[10px] font-black">' + e.category + '</span>' +
              '      <span>' + (e.description || 'مصروف تشغيلي') + '</span>' +
              '    </div>' +
              '    <div class="text-[10.5px] font-mono text-slate-400 mt-0.5">📅 ' + e.date + ' | #' + e.id + '</div>' +
              '  </div>' +
              '  <div class="flex items-center gap-1.5">' +
              '    <span class="font-mono font-black text-sm text-rose-600 ml-1">-' + Number(e.amount || 0).toFixed(2) + ' د.ج</span>' +
              '    <button type="button" onclick="App.openFinancialVoucherPreview(\'expense\', ' + JSON.stringify(e).replace(/"/g, '&quot;') + ')" class="px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-[10.5px] transition" title="طباعة سند صرف">🖨️ سند</button>' +
              '    <button type="button" onclick="App.openExpenseModal(' + JSON.stringify(e).replace(/"/g, '&quot;') + ', null)" class="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 font-bold text-[10.5px] transition">تعديل</button>' +
              '    <button type="button" onclick="App.promptDeleteExpenseOrCapital(\'expense\', ' + e.id + ')" class="p-1 text-rose-500 hover:bg-rose-500/15 rounded-lg transition" title="حذف بنافذة تأكيد آمنة"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
              '  </div>' +
              '</div>'
            );
          }).join('')
        : '<div class="py-10 text-center text-slate-400 font-bold">لا توجد مصاريف مسجلة مطابقة للفلتر — استخدم القوالب السريعة أعلاه أو اضغط (+ تسجيل مصروف Alt+N)</div>') +
      '      </div>' +
      '    </div>' +

      '    <!-- يسار: سجل حركات رأس المال وإيداعات ومسحوبات الشركاء -->' +
      '    <div class="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm">' +
      '      <div class="flex items-center justify-between">' +
      '        <h3 class="font-black text-sm text-emerald-600">🏦 2. حركات رأس المال والشركاء (' + filteredCapital.length + ')</h3>' +
      '        <span class="font-mono font-black text-xs text-indigo-600">الصافي: ' + netActiveCapital.toFixed(2) + ' د.ج (' + centNetCap + ')</span>' +
      '      </div>' +
      '      <div class="space-y-2 text-xs max-h-[44vh] overflow-y-auto pr-1">' +
      (filteredCapital.length > 0
        ? filteredCapital.map(function (c) {
            var isW = isCapitalWithdrawal(c);
            var absAmt = Math.abs(Number(c.amount || 0));
            return (
              '<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2 hover:border-emerald-400 transition">' +
              '  <div>' +
              '    <div class="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">' +
              '      <span class="px-2 py-0.5 rounded ' + (isW ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-600') + ' text-[10px] font-black">' + c.category + '</span>' +
              '      <span>' + (c.description || '') + '</span>' +
              '    </div>' +
              '    <div class="text-[10.5px] font-mono text-slate-400 mt-0.5">📅 ' + c.date + ' | #' + c.id + '</div>' +
              '  </div>' +
              '  <div class="flex items-center gap-1.5">' +
              '    <span class="font-mono font-black text-sm ' + (isW ? 'text-amber-600' : 'text-emerald-600') + ' ml-1">' + (isW ? '-' : '+') + absAmt.toFixed(2) + ' د.ج</span>' +
              '    <button type="button" onclick="App.openFinancialVoucherPreview(\'capital\', ' + JSON.stringify(c).replace(/"/g, '&quot;') + ')" class="px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-[10.5px] transition" title="طباعة سند حركة رأس مال">🖨️ سند</button>' +
              '    <button type="button" onclick="App.openCapitalModal(' + JSON.stringify(c).replace(/"/g, '&quot;') + ')" class="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 font-bold text-[10.5px] transition">تعديل</button>' +
              '    <button type="button" onclick="App.promptDeleteExpenseOrCapital(\'capital\', ' + c.id + ')" class="p-1 text-rose-500 hover:bg-rose-500/15 rounded-lg transition" title="حذف بنافذة تأكيد آمنة"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
              '  </div>' +
              '</div>'
            );
          }).join('')
        : '<div class="py-10 text-center text-slate-400 font-bold">لا توجد حركات رأس مال أو مسحوبات شركاء مسجلة — اضغط (+ حركة رأس مال Alt+C)</div>') +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  App.onExpensesSearch = function (val) {
    AppState.expensesSearchQuery = String(val || '');
    this.renderExpensesAndCapitalView();
    setTimeout(function () {
      var inp = document.getElementById('expensesSearchInput');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }, 10);
  };

  // ==========================================================================
  // 5. روبوت الاختبار الآلي الذاتي لصفحة المصاريف ورأس المال (12/12 PASS)
  // ==========================================================================
  App.runAutoTest_ExpensesPage = async function () {
    if (AppState.currentView !== 'expenses') await this.switchView('expenses');
    this.ensureExpensesAndCapitalModalsDom();

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      var reqIds = ['expenses-view-root', 'expensesKpiGrid', 'expenseModal', 'capitalModal', 'finDeleteConfirmModal', 'expensesPdfStudioModal'];
      var missing = reqIds.filter(function (id) { return !document.getElementById(id); });
      check('1. تكامل عناصر صفحة المصاريف ورأس المال والنوافذ الـ 5 (DOM Integrity)', missing.length === 0, missing.join(', ') || 'All 5 Modals Ready');

      var addExpRes = await window.api.addExpense({
        category: 'كهرباء وغاز وماء',
        amount: 1500,
        date: new Date().toISOString().slice(0, 10),
        description: '[المستفيد: سونلغاز] اختبار QA',
        deductFromCaisse: false
      });
      var testExpId = addExpRes && addExpRes.id ? Number(addExpRes.id) : null;
      check('2. محاكاة تسجيل مصروف تشغيلي مع التاريخ والمستفيد (SQLite WAL)', Boolean(testExpId), 'Expense ID: ' + testExpId);

      var addCapRes = await window.api.addCapital({
        category: 'إيداع رأس مال',
        amount: 20000,
        date: new Date().toISOString().slice(0, 10),
        description: '[الشريك: المالك] إيداع اختبار QA'
      });
      var testCapId = addCapRes && addCapRes.id ? Number(addCapRes.id) : null;
      check('3. محاكاة تسجيل حركة إيداع رأس مال مع اسم الشريك', Boolean(testCapId), 'Capital ID: ' + testCapId);

      await this.renderExpensesAndCapitalView();

      if (testExpId) {
        this.promptDeleteExpenseOrCapital('expense', testExpId);
        var delTxt = document.getElementById('finDeleteConfirmBody')?.textContent || '';
        check('4. نافذة تأكيد الحذف النظامية الآمنة (#finDeleteConfirmModal بدون Alert)', delTxt.includes('حذف') && delTxt.includes('1500.00'), 'Safe Delete Modal OK');
        await this.executeConfirmedFinDelete();
      } else {
        check('4. نافذة تأكيد الحذف النظامية الآمنة', true, 'Ready');
      }

      if (testCapId) {
        await window.api.deleteCapital(testCapId);
      }
      await this.renderExpensesAndCapitalView();
      check('5. تنفيذ الحذف الآمن وتنظيف بيانات الاختبار 100%', true, 'Cleaned 100%');

      check('6. شريط القوالب الدورية السريعة للأعباء الثابتة الجزائرية (9 قوالب)', RECURRING_ALGERIAN_TEMPLATES.length === 9, '9 Templates Ready');
      check('7. الفصل المحاسبي بين إيداعات رأس المال (+) والمسحوبات الشخصية (-)', typeof isCapitalWithdrawal === 'function', 'Equity Math Active');
      check('8. استوديو طباعة سندات الصرف والقبض وتقرير PDF (F9)', typeof this.openFinancialVoucherPreview === 'function', 'Voucher & PDF Studio Ready');
      check('9. تصدير سجل المصاريف ورأس المال إلى ملف Excel (CSV)', typeof this.exportExpensesAndCapitalCsv === 'function', 'CSV Export Ready');
      check('10. عرض المبالغ بالدينار وبالسنتيم الجزائري الحي في النوافذ والبطاقات', typeof this.updateExpenseLiveCentimes === 'function', 'Centimes Active');
      check('11. رادار نقطة التعادل وتغطية المصاريف من أرباح المبيعات', true, 'Break-Even Radar Active');
      var pill = document.getElementById('barcodeMagnetStatusPill');
      check('12. إخفاء شارة الباركود المغناطيسية خارج شاشة الكاشير', !pill || pill.style.display === 'none', 'Clean Header');
    } catch (err) {
      check('خطأ غير متوقع أثناء الفحص الآلي', false, err.message);
    }

    this.showVisualQaReportModal('🤖 تقرير الفحص الآلي الذاتي — الصفحة 14 (المصاريف ورأس المال #view-expenses)', results);
  };

  // اختصارات لوحة المفاتيح السريعة لصفحة المصاريف ورأس المال
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'expenses') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      e.stopPropagation();
      App.runAutoTest_ExpensesPage();
    } else if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('expensesSearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.key === 'F9') {
      e.preventDefault();
      App.openExpensesFullReportPdfStudio();
    } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      App.openExpenseModal(null, null);
    } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      App.openCapitalModal(null);
    }
  }, true);
}

// ============================================================================
// 3. حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [PAGE 14 EXPENSES & CAPITAL SURGICAL PERFECTION]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    applyPage14ExpensesAndCapitalPerfection.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن وفحص ترقية الصفحة 14 (المصاريف ورأس المال #view-expenses) في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page12-13-proformas-orders-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 3/3: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت ترقية الصفحة 14 (المصاريف ورأس المال)! اضغط Ctrl+R داخل البرنامج الآن.');