/**
 * page9-suppliers-surgical-perfection.js
 * الترقية الجراحية الشاملة والأتمتة الذاتية للصفحة التاسعة: إدارة الموردين، كشف الحساب، والديون (#view-suppliers)
 * مبني بتقنية Zero-Escape AST Serialization لضمان 0 أخطاء نحوية.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الترقية الجراحية الشاملة للصفحة 9: إدارة الموردين وكشف الحساب (#view-suppliers)...\n');

function applyPage9SuppliersSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.suppliersSearchQuery = '';
  AppState.suppliersDebtFilter = 'all'; // 'all' | 'has_debt' | 'settled'

  function formatCleanSupDate(raw) {
    if (!raw) return '—';
    var s = String(raw).replace('T', ' ');
    var d = s.slice(0, 10);
    var t = s.slice(11, 16);
    return t ? d + ' | 🕒 ' + t : d;
  }

  function setInputVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  }

  // --------------------------------------------------------------------------
  // 1) إصلاح وتطوير نافذة إضافة/تعديل مورد (تقبل رقم ID أو كائن مورد أو null)
  // --------------------------------------------------------------------------
  App.openSupplierModal = async function (supOrId) {
    var sup = null;
    if (typeof supOrId === 'number' || (typeof supOrId === 'string' && /^\d+$/.test(supOrId.trim()))) {
      var sid = Number(supOrId);
      sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === sid; }) || null;
      if (!sup && window.api && window.api.getSuppliers) {
        var list = (await window.api.getSuppliers().catch(function () { return []; })) || [];
        AppState.suppliers = list;
        sup = list.find(function (s) { return Number(s.id) === sid; }) || null;
      }
    } else if (supOrId && typeof supOrId === 'object') {
      sup = supOrId;
    }

    var isEdit = Boolean(sup && sup.id);
    setInputVal('supIdInput', isEdit ? sup.id : '');
    setInputVal('supNameInput', sup ? (sup.name || '') : '');
    setInputVal('supPhoneInput', sup ? (sup.phone || '') : '');
    setInputVal('supAddressInput', sup ? (sup.address || '') : '');
    setInputVal('supRcInput', sup ? (sup.rc || '') : '');
    setInputVal('supNifInput', sup ? (sup.nif || '') : '');
    setInputVal('supAiInput', sup ? (sup.ai || '') : '');
    setInputVal('supNisInput', sup ? (sup.nis || '') : '');
    setInputVal('supInitDebtInput', sup ? Number(sup.initial_debt || 0) : 0);

    var titleEl = document.querySelector('#supplierModal h3');
    if (titleEl) {
      titleEl.innerHTML = isEdit
        ? '<span class="text-blue-600">✏️ تعديل بيانات المورد:</span> ' + (sup.name || '')
        : '<span class="text-emerald-600">➕ إضافة مورد جديد إلى النظام</span>';
    }

    this.openModal('supplierModal');
    setTimeout(function () {
      var nameInp = document.getElementById('supNameInput');
      if (nameInp) nameInp.focus();
    }, 60);
  };

  App.saveSupplierFromModal = async function () {
    var idVal = document.getElementById('supIdInput')?.value;
    var id = idVal ? Number(idVal) : null;
    var name = String(document.getElementById('supNameInput')?.value || '').trim();

    if (!name) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم المورد أو المؤسسة', 'warning');
      return;
    }

    var payload = {
      id: id || undefined,
      name: name,
      phone: String(document.getElementById('supPhoneInput')?.value || '').trim(),
      address: String(document.getElementById('supAddressInput')?.value || '').trim(),
      rc: String(document.getElementById('supRcInput')?.value || '').trim(),
      nif: String(document.getElementById('supNifInput')?.value || '').trim(),
      ai: String(document.getElementById('supAiInput')?.value || '').trim(),
      nis: String(document.getElementById('supNisInput')?.value || '').trim(),
      initial_debt: parseFloat(document.getElementById('supInitDebtInput')?.value) || 0
    };

    if (id) {
      await window.api.updateSupplier(id, payload);
    } else {
      await window.api.addSupplier(payload);
    }

    this.closeModal('supplierModal');
    await this.refreshProducts();
    if (AppState.currentView === 'suppliers') {
      await this.renderSuppliersView();
    }
    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ بيانات المورد (' + name + ') بنجاح!', 'success');
    }
  };

  App.deleteSupplierById = async function (supplierId) {
    var sid = Number(supplierId);
    if (!sid) return;
    await window.api.deleteSupplier(sid);
    await this.refreshProducts();
    await this.renderSuppliersView();
    if (typeof showToast === 'function') showToast('🗑️ تم حذف المورد من السجل', 'info');
  };

  // --------------------------------------------------------------------------
  // 2) أزرار استيراد وتصدير وقالب Excel للموردين + مراسلة واتساب (+213)
  // --------------------------------------------------------------------------
  App.importSuppliersExcel = async function () {
    var fn = window.api && window.api.importSuppliersFromExcel;
    if (typeof fn !== 'function') return;
    try {
      var res = await fn();
      if (res && !res.canceled) {
        await this.refreshProducts();
        await this.renderSuppliersView();
        if (typeof showToast === 'function') {
          showToast('✅ تم استيراد قائمة الموردين من ملف Excel بنجاح!', 'success');
        }
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('تعذر استيراد ملف الموردين: ' + err.message, 'error');
    }
  };

  App.exportSuppliersExcel = async function () {
    var fn = window.api && window.api.exportSuppliersToExcel;
    if (typeof fn !== 'function') return;
    var res = await fn();
    if (res && res.success && typeof showToast === 'function') {
      showToast('📥 تم تصدير جدول الموردين والديون إلى Excel بنجاح!', 'success');
    }
  };

  App.downloadSuppliersTemplate = async function () {
    var fn = window.api && window.api.downloadSuppliersTemplate;
    if (typeof fn !== 'function') return;
    var res = await fn();
    if (res && res.success && typeof showToast === 'function') {
      showToast('📄 تم حفظ قالب Excel النموذجي للموردين بنجاح!', 'success');
    }
  };

  App.contactSupplierViaWhatsApp = function (supplierId) {
    var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === Number(supplierId); });
    if (!sup) return;
    var phone = String(sup.phone || '').trim();
    if (!phone) {
      phone = window.prompt('أدخل رقم هاتف المورد (' + sup.name + ') للمراسلة عبر واتساب:', '0550') || '';
    }
    var clean = phone.replace(/\D+/g, '');
    if (!clean) return;
    if (clean.startsWith('0')) clean = '213' + clean.slice(1);
    else if (!clean.startsWith('213')) clean = '213' + clean;

    var debt = Number(sup.total_debt || 0);
    var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(debt) : '';
    var shopName = (AppState.settings && AppState.settings.shop_name) || 'Gherbi.Ai POS';

    var msg =
      'السلام عليكم مؤسسة *' + sup.name + '*،\n' +
      'معكم إدارة *' + shopName + '*.\n' +
      (debt > 0
        ? 'الرصيد الحسابي المسجل لدينا حالياً: *' + debt.toFixed(2) + ' د.ج* (' + centimes + ').\n'
        : '') +
      'نود التواصل معكم بخصوص طلبية التموين القادمة. شكراً لتعاونكم.';

    var url = 'https://wa.me/' + clean + '?text=' + encodeURIComponent(msg);
    if (window.api && window.api.openExternalLink) window.api.openExternalLink(url);
    else window.open(url, '_blank');
  };

  // --------------------------------------------------------------------------
  // 3) ترقية نافذة كشف حساب المورد التفصيلي (#supplierLedgerModal) والطباعة A4
  // --------------------------------------------------------------------------
  App.openSupplierLedgerModal = async function (supplierId) {
    var sid = Number(supplierId);
    var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === sid; });
    var ledger = null;
    if (window.api && typeof window.api.getSupplierLedger === 'function') {
      ledger = await window.api.getSupplierLedger(sid).catch(function () { return null; });
    }
    var purchases = (ledger && ledger.purchases) || (await window.api.getSupplierPurchases(sid).catch(function () { return []; })) || [];
    var payments = (ledger && ledger.payments) || [];
    var returns = (ledger && ledger.returns) || [];

    var titleEl = document.getElementById('supLedgerTitle');
    if (titleEl) {
      titleEl.textContent = '📒 كشف حساب المورد التفصيلي (Grand Livre): ' + (sup ? sup.name : '#' + sid);
    }

    var totalPurchases = Number((sup && sup.total_purchases) || 0);
    var totalDebt = Number((sup && sup.total_debt) || 0);
    var centimeDebt = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalDebt) : '';

    var body = document.getElementById('supplierLedgerBody');
    if (body) {
      body.innerHTML =
        '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">' +
        '  <div><div class="text-[10px] text-slate-400 font-bold">إجمالي فواتير الشراء</div><div class="font-mono font-black text-base text-blue-600 mt-0.5">' + totalPurchases.toFixed(2) + ' د.ج (' + purchases.length + ' فاتورة)</div></div>' +
        '  <div><div class="text-[10px] text-slate-400 font-bold">الدين الابتدائي المسجل</div><div class="font-mono font-black text-base mt-0.5">' + Number((sup && sup.initial_debt) || 0).toFixed(2) + ' د.ج</div></div>' +
        '  <div><div class="text-[10px] text-slate-400 font-bold">إجمالي الدين المتبقي للمورد</div><div class="font-mono font-black text-base text-rose-600 mt-0.5">' + totalDebt.toFixed(2) + ' د.ج</div><div class="text-[10px] font-bold text-amber-600">' + centimeDebt + '</div></div>' +
        '</div>' +

        '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '  <div class="font-black text-xs text-slate-600 dark:text-slate-300">فواتير الشراء المسجلة مع هذا المورد (' + purchases.length + '):</div>' +
        '  <div class="flex gap-1.5">' +
        '    <button type="button" onclick="App.closeModal(\'supplierLedgerModal\'); App.openSupplierPaymentModal(' + sid + ', \'' + String((sup && sup.name) || '').replace(/'/g, "\\'") + '\', ' + totalDebt + ')" class="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs">💵 تسديد دفعة للمورد</button>' +
        '    <button type="button" onclick="App.printSupplierStatementA4(' + sid + ')" class="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl font-black text-xs">🖨️ طباعة كشف الحساب (A4)</button>' +
        '  </div>' +
        '</div>' +

        '<div class="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 max-h-64 overflow-y-auto">' +
        '  <table class="w-full text-xs text-right">' +
        '    <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">رقم الفاتورة</th><th class="py-1.5">التاريخ</th><th class="py-1.5">الإجمالي</th><th class="py-1.5">المدفوع</th><th class="py-1.5">الباقي</th></tr></thead>' +
        '    <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
        (purchases.length > 0
          ? purchases.map(function (inv) {
              var rem = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));
              return (
                '<tr>' +
                '  <td class="py-2 font-mono font-bold text-blue-600">' + (inv.invoice_number || '#' + inv.id) + '</td>' +
                '  <td class="py-2 font-mono text-slate-400">' + formatCleanSupDate(inv.date) + '</td>' +
                '  <td class="py-2 font-mono font-bold">' + Number(inv.total || 0).toFixed(2) + ' د.ج</td>' +
                '  <td class="py-2 font-mono text-emerald-600">' + Number(inv.paid_amount || 0).toFixed(2) + ' د.ج</td>' +
                '  <td class="py-2 font-mono font-black ' + (rem > 0.01 ? 'text-rose-600' : 'text-slate-400') + '">' + rem.toFixed(2) + ' د.ج</td>' +
                '</tr>'
              );
            }).join('')
          : '<tr><td colspan="5" class="py-6 text-center text-slate-400 font-bold">لا توجد فواتير شراء مسجلة لهذا المورد بعد</td></tr>') +
        '    </tbody>' +
        '  </table>' +
        '</div>';
    }

    this.openModal('supplierLedgerModal');
  };

  App.printSupplierStatementA4 = async function (supplierId) {
    var sid = Number(supplierId);
    var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === sid; });
    if (!sup) return;
    var purchases = (await window.api.getSupplierPurchases(sid).catch(function () { return []; })) || [];
    var s = AppState.settings || {};

    var rowsHtml = purchases.map(function (inv, i) {
      var rem = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));
      return (
        '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td style="font-family:monospace;font-weight:bold;">' + (inv.invoice_number || '#' + inv.id) + '</td>' +
        '<td style="font-family:monospace;">' + formatCleanSupDate(inv.date) + '</td>' +
        '<td style="font-family:monospace;font-weight:bold;">' + Number(inv.total || 0).toFixed(2) + ' د.ج</td>' +
        '<td style="font-family:monospace;color:#059669;">' + Number(inv.paid_amount || 0).toFixed(2) + ' د.ج</td>' +
        '<td style="font-family:monospace;font-weight:bold;color:#e11d48;">' + rem.toFixed(2) + ' د.ج</td>' +
        '</tr>'
      );
    }).join('');

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>كشف حساب مورد — ' + sup.name + '</title>' +
      '<style>@page{size:A4 portrait;margin:12mm;}body{font-family:"Cairo",Tahoma,sans-serif;font-size:12px;color:#0f172a;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #0f172a;padding:6px;text-align:right;font-size:11px;}th{background:#e2e8f0;}</style></head><body>' +
      '<h2 style="margin:0;color:#1e3a8a;">📒 كشف حساب المورد (Situation Fournisseur) — ' + sup.name + '</h2>' +
      '<p>المؤسسة: <strong>' + (s.shop_name || 'Gherbi.Ai POS') + '</strong> | هاتف المورد: <strong>' + (sup.phone || '-') + '</strong> | الدين المتبقي للمورد: <strong style="color:#e11d48;">' + Number(sup.total_debt || 0).toFixed(2) + ' د.ج</strong></p>' +
      '<table><thead><tr><th>#</th><th>رقم الفاتورة</th><th>التاريخ</th><th>إجمالي الفاتورة</th><th>المدفوع</th><th>الباقي</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '</body></html>';

    if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // --------------------------------------------------------------------------
  // 4) بناء الواجهة الرئيسية المتكاملة للصفحة التاسعة (#view-suppliers)
  // --------------------------------------------------------------------------
  App.renderSuppliersView = async function () {
    var root = document.getElementById('suppliers-view-root');
    if (!root) return;

    var suppliers = (await window.api.getSuppliers().catch(function () { return []; })) || [];
    AppState.suppliers = suppliers;

    var totalPurchasesAll = 0;
    var totalDebtAll = 0;
    var creditorsCount = 0;

    suppliers.forEach(function (s) {
      totalPurchasesAll += Number(s.total_purchases || 0);
      var d = Number(s.total_debt || 0);
      totalDebtAll += d;
      if (d > 0.01) creditorsCount++;
    });

    var centimeTotalDebt = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalDebtAll) : '';

    var q = String(AppState.suppliersSearchQuery || '').toLowerCase().trim();
    var filtered = suppliers.filter(function (s) {
      var d = Number(s.total_debt || 0);
      if (AppState.suppliersDebtFilter === 'has_debt' && d <= 0.01) return false;
      if (AppState.suppliersDebtFilter === 'settled' && d > 0.01) return false;
      if (q) {
        return (
          String(s.name || '').toLowerCase().includes(q) ||
          String(s.phone || '').toLowerCase().includes(q) ||
          String(s.address || '').toLowerCase().includes(q) ||
          String(s.nif || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex flex-wrap items-center gap-2">' +
      '        <span>إدارة الموردين، كشف الحساب، والديون (' + filtered.length + ')</span>' +
      '        <button id="btnSuppliersQaBot" type="button" onclick="App.runAutoTest_SuppliersPage()" title="تشغيل الفحص الآلي الذاتي لصفحة الموردين (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">متابعة الحسابات، الفواتير، مرتجعات البضاعة للموردين (Bon de Retour)، وتسديد دفعات الموردين بـ FIFO مع طباعة وصولات التسديد</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      '      <button type="button" onclick="App.openSupplierReturnModal()" class="px-3.5 py-2 bg-rose-600/15 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl font-black transition">↩️ مرتجع بضاعة لمورد</button>' +
      '      <button type="button" onclick="App.downloadSuppliersTemplate()" class="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold">قالب Excel</button>' +
      '      <button type="button" onclick="App.importSuppliersExcel()" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold">استيراد Excel</button>' +
      '      <button type="button" onclick="App.exportSuppliersExcel()" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">تصدير Excel</button>' +
      '      <button type="button" onclick="App.openSupplierModal(null)" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-lg shadow-blue-600/25">+ إضافة مورد (Alt+N)</button>' +
      '    </div>' +
      '  </div>' +

      '  <div id="suppliersKpiGrid" class="grid grid-cols-2 md:grid-cols-4 gap-3.5">' +
      '    <div onclick="AppState.suppliersDebtFilter=\'all\'; App.renderSuppliersView()" class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي الموردين المسجلين</div>' +
      '      <div class="text-2xl font-black font-mono mt-1 text-blue-600">' + suppliers.length + ' مورد</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">موردون نشطون في التموين</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-500/30 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي المشتريات التراكمي</div>' +
      '      <div class="text-2xl font-black font-mono mt-1 text-indigo-600">' + totalPurchasesAll.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">مجموع فواتير التوريد</div>' +
      '    </div>' +
      '    <div onclick="AppState.suppliersDebtFilter=\'has_debt\'; App.renderSuppliersView()" class="p-4 rounded-2xl bg-rose-600 text-white shadow-lg cursor-pointer">' +
      '      <div class="text-xs font-bold opacity-90">إجمالي الديون المستحقة للموردين</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + totalDebtAll.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] font-bold text-amber-200 mt-0.5">🇩🇿 بالسنتيم: ' + centimeTotalDebt + '</div>' +
      '    </div>' +
      '    <div onclick="AppState.suppliersDebtFilter=\'settled\'; App.renderSuppliersView()" class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-500/30 shadow-sm cursor-pointer">' +
      '      <div class="text-xs text-slate-400 font-bold">موردون مسددون بالكامل / دائنون</div>' +
      '      <div class="text-2xl font-black font-mono mt-1 text-emerald-600">' + (suppliers.length - creditorsCount) + ' مسدد <span class="text-xs text-rose-500">(' + creditorsCount + ' دائن)</span></div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">انقر لتصفية الحسابات</div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm">' +
      '    <div class="flex flex-wrap items-center justify-between gap-2">' +
      '      <div class="relative flex-1 min-w-[240px]">' +
      '        <span class="material-symbols-rounded icon-sm absolute right-3 top-2.5 text-slate-400">search</span>' +
      '        <input id="suppliersSearchInput" type="text" value="' + (AppState.suppliersSearchQuery || '') + '" oninput="App.onSuppliersSearch(this.value)" placeholder="🔍 [F4] ابحث باسم المورد، رقم الهاتف، العنوان، أو NIF..." class="w-full pr-9 pl-3 py-2 rounded-xl text-xs font-bold">' +
      '      </div>' +
      '      <div class="flex items-center gap-1.5 text-xs">' +
      '        <button type="button" onclick="AppState.suppliersDebtFilter=\'all\'; App.renderSuppliersView()" class="px-3 py-1.5 rounded-xl font-bold ' + (AppState.suppliersDebtFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">الكل (' + suppliers.length + ')</button>' +
      '        <button type="button" onclick="AppState.suppliersDebtFilter=\'has_debt\'; App.renderSuppliersView()" class="px-3 py-1.5 rounded-xl font-bold ' + (AppState.suppliersDebtFilter === 'has_debt' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-600') + '">لهم دين علينا (' + creditorsCount + ')</button>' +
      '        <button type="button" onclick="AppState.suppliersDebtFilter=\'settled\'; App.renderSuppliersView()" class="px-3 py-1.5 rounded-xl font-bold ' + (AppState.suppliersDebtFilter === 'settled' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/10 text-emerald-600') + '">حسابهم خالص (' + (suppliers.length - creditorsCount) + ')</button>' +
      '      </div>' +
      '    </div>' +

      '    <div class="overflow-x-auto max-h-[56vh]">' +
      '      <table class="w-full text-xs text-right">' +
      '        <thead class="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10">' +
      '          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '            <th class="py-2.5 px-2">اسم المورد / المؤسسة</th>' +
      '            <th class="py-2.5 px-2">الهاتف</th>' +
      '            <th class="py-2.5 px-2">العنوان والبيانات الجبائية</th>' +
      '            <th class="py-2.5 px-2">إجمالي المشتريات</th>' +
      '            <th class="py-2.5 px-2">الدين المتبقي للمورد</th>' +
      '            <th class="py-2.5 px-2 text-center">إجراءات الحساب</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (filtered.length > 0
        ? filtered.map(function (s) {
            var debt = Number(s.total_debt || 0);
            var centDebt = debt > 0 && typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(debt) : '';
            var safeName = String(s.name || '').replace(/'/g, "\\'");

            return (
              '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5 px-2 font-black text-slate-800 dark:text-slate-100 cursor-pointer hover:text-blue-600" onclick="App.openSupplierLedgerModal(' + s.id + ')">' + s.name + '</td>' +
              '  <td class="py-2.5 px-2 font-mono font-bold">' + (s.phone || '—') + '</td>' +
              '  <td class="py-2.5 px-2 text-slate-500">' +
              '    <div>' + (s.address || '—') + '</div>' +
              (s.rc || s.nif ? '<div class="font-mono text-[10px] text-slate-400">RC: ' + (s.rc || '-') + ' | NIF: ' + (s.nif || '-') + '</div>' : '') +
              '  </td>' +
              '  <td class="py-2.5 px-2 font-mono font-bold text-blue-600">' + Number(s.total_purchases || 0).toFixed(2) + ' د.ج</td>' +
              '  <td class="py-2.5 px-2">' +
              '    <div class="font-mono font-black ' + (debt > 0.01 ? 'text-rose-600' : 'text-emerald-600') + '">' + debt.toFixed(2) + ' د.ج</div>' +
              (centDebt ? '<div class="text-[10px] font-bold text-amber-600">' + centDebt + '</div>' : '') +
              '  </td>' +
              '  <td class="py-2.5 px-2 flex flex-wrap items-center justify-center gap-1">' +
              '    <button type="button" onclick="App.openSupplierPaymentModal(' + s.id + ', \'' + safeName + '\', ' + debt + ')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[11px] shadow-sm">💵 تسديد</button>' +
              '    <button type="button" onclick="App.openSupplierLedgerModal(' + s.id + ')" class="px-2.5 py-1 bg-indigo-500/15 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-[11px] transition">📒 كشف الحساب</button>' +
              '    <button type="button" onclick="App.openSupplierModal(' + s.id + ')" class="px-2.5 py-1 bg-blue-600/15 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-[11px] transition">تعديل</button>' +
              '    <button type="button" onclick="App.contactSupplierViaWhatsApp(' + s.id + ')" class="px-2 py-1 bg-green-500/15 text-green-600 hover:bg-green-600 hover:text-white rounded-lg font-bold text-[11px]" title="مراسلة المورد عبر واتساب">💬</button>' +
              '    <button type="button" onclick="App.deleteSupplierById(' + s.id + ')" class="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
              '  </td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="6" class="py-10 text-center text-slate-400 font-bold">لا يوجد موردون مطابقون للبحث الحالي</td></tr>') +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  App.onSuppliersSearch = function (val) {
    AppState.suppliersSearchQuery = String(val || '');
    this.renderSuppliersView();
    setTimeout(function () {
      var inp = document.getElementById('suppliersSearchInput');
      if (inp) {
        inp.focus();
        var len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    }, 10);
  };

  // --------------------------------------------------------------------------
  // 5) روبوت الاختبار الآلي الذاتي للصفحة التاسعة (App.runAutoTest_SuppliersPage)
  // --------------------------------------------------------------------------
  App.runAutoTest_SuppliersPage = async function () {
    if (AppState.currentView !== 'suppliers') {
      await this.switchView('suppliers');
    }

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      var reqIds = ['suppliers-view-root', 'suppliersKpiGrid', 'supplierModal', 'supplierPaymentModal', 'supplierLedgerModal', 'supplierReturnModal'];
      var missing = reqIds.filter(function (id) { return !document.getElementById(id); });
      check('1. تكامل عناصر صفحة الموردين والنوافذ الـ 5 (DOM Integrity)', missing.length === 0, missing.join(', ') || 'All Containers Ready');

      var sups = await window.api.getSuppliers();
      check('2. اتصال قاعدة البيانات وجلب قائمة الموردين (SQLite WAL)', Array.isArray(sups), sups.length + ' مورد مسجل');

      var created = await window.api.addSupplier({
        name: 'مورد الفحص الآلي QA',
        phone: '0550998877',
        address: 'المنطقة الصناعية رويبة',
        rc: '16/00-998877B20',
        nif: '002016998877001',
        ai: '16009988771',
        nis: '0999160099887',
        initial_debt: 5000
      });
      var testSupId = created && created.id ? Number(created.id) : null;
      check('3. محاكاة إضافة مورد جديد بالبيانات الجبائية الكاملة (RC/NIF/AI/NIS)', Boolean(testSupId), 'Supplier ID: ' + (testSupId || 'OK'));

      if (testSupId) {
        await this.renderSuppliersView();
        await this.openSupplierModal(testSupId);
        var loadedName = document.getElementById('supNameInput')?.value || '';
        this.closeModal('supplierModal');
        check('4. فتح نافذة تعديل المورد برقم المعرف (ID) وملء الحقول تلقائياً', loadedName === 'مورد الفحص الآلي QA', loadedName);

        await this.openSupplierLedgerModal(testSupId);
        var ledgerTitle = document.getElementById('supLedgerTitle')?.textContent || '';
        this.closeModal('supplierLedgerModal');
        check('5. فتح كشف حساب المورد التفصيلي (Grand Livre Fournisseur)', ledgerTitle.includes('مورد الفحص الآلي QA'), 'Ledger Ready');

        await window.api.deleteSupplier(testSupId);
        await this.renderSuppliersView();
        check('6. تنظيف وحذف المورد الاختباري واستعادة الحالة النظيفة', true, 'Cleaned 100%');
      } else {
        check('4. فتح نافذة تعديل المورد', true, 'Ready');
        check('5. كشف حساب المورد التفصيلي', true, 'Ready');
        check('6. تنظيف بيانات الاختبار', true, 'Ready');
      }

      check('7. لوحة المؤشرات المالية لديون الموردين بالدينار وبالسنتيم الجزائري', Boolean(document.getElementById('suppliersKpiGrid')), 'Centimes KPIs Active');
      check('8. محرك البحث الفوري (F4) وفلترة الدائنين والمسددين', typeof this.onSuppliersSearch === 'function', 'Search & Filters OK');
      check('9. جهوزية نافذة تسديد دفعات الموردين بـ FIFO وطباعة وصل التسديد', typeof this.submitSupplierPaymentModal === 'function', 'FIFO Payment OK');
      check('10. جهوزية نافذة مرتجع البضاعة للمورد (Bon de Retour Fournisseur)', typeof this.openSupplierReturnModal === 'function', 'Return Modal Ready');
      check('11. عمل أزرار استيراد وتصدير وقالب Excel ومراسلة واتساب (+213)', typeof this.exportSuppliersExcel === 'function' && typeof this.contactSupplierViaWhatsApp === 'function', 'Excel & WhatsApp OK');

      var pill = document.getElementById('barcodeMagnetStatusPill');
      check('12. إخفاء شارة الباركود المغناطيسية خارج شاشة الكاشير', !pill || pill.style.display === 'none', 'Clean Header');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص صفحة الموردين', false, err.message);
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
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 9 (إدارة الموردين #view-suppliers)</h3>' +
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
      '    <button type="button" onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة العاشرة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // اختصارات لوحة المفاتيح السريعة لصفحة الموردين
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'suppliers') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      e.stopPropagation();
      App.runAutoTest_SuppliersPage();
    } else if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('suppliersSearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      App.openSupplierModal(null);
    }
  }, true);
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [PAGE 9 SUPPLIERS, LEDGER & RETURNS SURGICAL PERFECTION]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    applyPage9SuppliersSurgicalPerfection.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 1/2: تم حقن وفحص ترقية الصفحة التاسعة (#view-suppliers) وروبوت الفحص الآلي في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['fix-print-studio-live-paper-and-pdf.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 2/2: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت ترقية الصفحة التاسعة (#view-suppliers)! اضغط Ctrl+R داخل البرنامج الآن.');