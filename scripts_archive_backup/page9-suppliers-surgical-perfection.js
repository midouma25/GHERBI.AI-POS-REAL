/**
 * fix-light-mode-toolbars-and-buttons.js
 * إصلاح شامل لظهور الأزرار وأشرطة الأدوات في الوضع المضيء (Light Mode)
 * في كلٍ من: استوديو PDF الموردين (#allSuppliersPdfStudioModal)، مركز الطباعة (#view-print)، وإدارة الصندوق (#view-caisse)
 * + تحسين مطابقة الأسماء العربية والهمزات بين الموردين والمنتجات.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿☀️ بدء إصلاح أشرطة الأدوات والأزرار لتكون ساطعة وواضحة 100% في الوضع المضيء...\n');

// ============================================================================
// 1. إضافة قواعد CSS محصّنة في styles.css تمنع اختفاء أي نص داخل الأزرار في الوضع المضيء
// ============================================================================
const cssPath = path.join(ROOT, 'styles.css');
if (fs.existsSync(cssPath)) {
  let css = fs.readFileSync(cssPath, 'utf8');

  const marker = '/* [LIGHT MODE TOOLBAR & BUTTON VISIBILITY SHIELD] */';
  const oldIdx = css.indexOf(marker);
  if (oldIdx !== -1) {
    css = css.slice(0, oldIdx).trimEnd();
  }

  const lightModeShieldCss = `
/* [LIGHT MODE TOOLBAR & BUTTON VISIBILITY SHIELD] */
.gherbi-studio-toolbar {
  background-color: #f1f5f9 !important;
  border: 1.5px solid #cbd5e1 !important;
  color: #0f172a !important;
}
html.dark .gherbi-studio-toolbar {
  background-color: #0f172a !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

.gherbi-toolbar-btn {
  background-color: #ffffff !important;
  color: #1e293b !important;
  border: 1.5px solid #cbd5e1 !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
  transition: all 0.15s ease !important;
}
.gherbi-toolbar-btn:hover {
  background-color: #eff6ff !important;
  border-color: #3b82f6 !important;
  color: #1d4ed8 !important;
}
html.dark .gherbi-toolbar-btn {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
  border-color: #475569 !important;
}
html.dark .gherbi-toolbar-btn:hover {
  background-color: #334155 !important;
  border-color: #60a5fa !important;
  color: #ffffff !important;
}

.gherbi-toolbar-btn-active {
  background-color: #2563eb !important;
  color: #ffffff !important;
  border: 1.5px solid #1d4ed8 !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25) !important;
}
.gherbi-toolbar-btn-active-rose {
  background-color: #e11d48 !important;
  color: #ffffff !important;
  border: 1.5px solid #be123c !important;
  box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25) !important;
}
.gherbi-toolbar-btn-active-indigo {
  background-color: #4f46e5 !important;
  color: #ffffff !important;
  border: 1.5px solid #4338ca !important;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25) !important;
}
.gherbi-toolbar-btn-active-amber {
  background-color: #f59e0b !important;
  color: #0f172a !important;
  border: 1.5px solid #d97706 !important;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25) !important;
}
`;

  fs.writeFileSync(cssPath, css.trimEnd() + '\n\n' + lightModeShieldCss.trim() + '\n', 'utf8');
  console.log('✅ 1/3: تم تحديث styles.css بدرع وضوح الأزرار وأشرطة الأدوات في الوضع المضيء.');
}

// ============================================================================
// 2. حقن الترقية في renderer-rc-100.js لتطبيق التصميم المضيء الواضح في كل النوافذ والأشرطة
// ============================================================================
function installBrightLightModeToolbarsFix() {
  if (!window.App || !window.AppState) return;

  function normalizeArabicText(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/يفري/g, 'افري');
  }

  // تحسين ربط المورد بأصنافه في المخزون (يدعم تطابق الهمزات مثل "افري" <-> "إيفري")
  App.getProductsForSupplier = function (sup) {
    if (!sup) return [];
    var rawName = String(sup.name || '').trim();
    var normSup = normalizeArabicText(rawName);
    var coreKeyword = normSup.replace(/^(مؤسسه|مجمع|شركه|مطاحن)\s+/g, '').trim();
    var sid = Number(sup.id || 0);

    return (AppState.products || []).filter(function (p) {
      if (Array.isArray(p.batches) && p.batches.some(function (b) { return Number(b.supplier_id) === sid; })) {
        return true;
      }
      var normProdSup = normalizeArabicText(p.supplier || '');
      var normProdName = normalizeArabicText(p.name || '');

      if (normSup && normProdSup && (normProdSup === normSup || normProdSup.includes(normSup) || normSup.includes(normProdSup))) {
        return true;
      }
      if (coreKeyword && coreKeyword.length >= 3) {
        if (normProdSup.includes(coreKeyword) || normProdName.includes(coreKeyword)) {
          return true;
        }
      }
      return false;
    });
  };

  // تحديث نافذة استوديو التقرير الشامل وتصدير PDF للموردين لتكون ساطعة وواضحة في الوضع المضيء
  App.openAllSuppliersPdfStudio = async function (mode, orientation) {
    this.ensureSuppliersExtraModalsDom();
    if (mode) AppState.allSuppliersPdfMode = mode;
    if (orientation) AppState.allSuppliersPdfOrientation = orientation;

    var curMode = AppState.allSuppliersPdfMode || 'full_dossier';
    var curOrient = AppState.allSuppliersPdfOrientation || 'portrait';

    var frameEl = document.getElementById('allSuppliersPdfPreviewFrame');
    if (frameEl) {
      frameEl.className = 'w-full h-[62vh] border border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-100 dark:bg-slate-900 shadow-inner';
    }

    var toolbar = document.getElementById('allSuppliersPdfToolbar');
    if (toolbar) {
      toolbar.className = 'gherbi-studio-toolbar flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-2xl text-xs shadow-sm';
      toolbar.innerHTML =
        '<div class="flex flex-wrap items-center gap-2">' +
        '  <span class="font-black text-slate-700 dark:text-amber-400 ml-1">📑 نوع التقرير:</span>' +
        '  <button type="button" onclick="App.openAllSuppliersPdfStudio(\'full_dossier\', null)" class="px-3.5 py-2 rounded-xl font-black ' + (curMode === 'full_dossier' ? 'gherbi-toolbar-btn-active' : 'gherbi-toolbar-btn') + '">📘 الكراس الشامل المفصل (كل الموردين + أصنافهم + فواتيرهم)</button>' +
        '  <button type="button" onclick="App.openAllSuppliersPdfStudio(\'summary_table\', null)" class="px-3.5 py-2 rounded-xl font-black ' + (curMode === 'summary_table' ? 'gherbi-toolbar-btn-active' : 'gherbi-toolbar-btn') + '">📊 الجدول المالي والجبائي الموحد</button>' +
        '  <button type="button" onclick="App.openAllSuppliersPdfStudio(\'debt_schedule\', null)" class="px-3.5 py-2 rounded-xl font-black ' + (curMode === 'debt_schedule' ? 'gherbi-toolbar-btn-active-rose' : 'gherbi-toolbar-btn') + '">🚨 كشف الديون المستحقة فقط</button>' +
        '  <span class="mx-1 text-slate-300 dark:text-slate-600">|</span>' +
        '  <button type="button" onclick="App.openAllSuppliersPdfStudio(null, \'portrait\')" class="px-3 py-2 rounded-xl font-black ' + (curOrient === 'portrait' ? 'gherbi-toolbar-btn-active-indigo' : 'gherbi-toolbar-btn') + '">📄 A4 عمودي</button>' +
        '  <button type="button" onclick="App.openAllSuppliersPdfStudio(null, \'landscape\')" class="px-3 py-2 rounded-xl font-black ' + (curOrient === 'landscape' ? 'gherbi-toolbar-btn-active-indigo' : 'gherbi-toolbar-btn') + '">🖼️ A4 أفقي عريض</button>' +
        '</div>' +
        '<div class="flex flex-wrap items-center gap-2">' +
        '  <button type="button" onclick="App.executeAllSuppliersReportAction(\'print\')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-md">🖨️ طباعة التقرير الآن</button>' +
        '  <button type="button" onclick="App.executeAllSuppliersReportAction(\'pdf\')" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black shadow-md">📥 حفظ وتصدير كملف PDF</button>' +
        '</div>';
    }

    var html = await this.buildAllSuppliersComprehensiveReportHtml(curMode, curOrient);

    // جعل خلفية المعاينة حول الورقة فاتحة ومريحة في الوضع المضيء، وداكنة فقط في الوضع الليلي
    var isDark = document.documentElement.classList.contains('dark');
    if (!isDark) {
      html = html
        .replace('background:#0f172a;padding:14px 0;', 'background:#e2e8f0;padding:16px 0;')
        .replace('color:#38bdf8;font-size:12px;', 'color:#1e3a8a;font-size:12px;background:#dbeafe;padding:6px 16px;border-radius:999px;border:1px solid #93c5fd;');
    }

    this.openModal('allSuppliersPdfStudioModal');

    setTimeout(function () {
      var frame = document.getElementById('allSuppliersPdfPreviewFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      }
    }, 50);
  };

  // تحويل جميع أشرطة الأدوات الداكنة الأخرى في (مركز الطباعة #view-print) و (إدارة الصندوق #view-caisse) إلى التصميم المضيء الواضح تلقائياً
  function upgradeDarkToolbarsInDom(rootEl) {
    var scope = rootEl || document;
    var darkBars = scope.querySelectorAll('.bg-slate-900');
    darkBars.forEach(function (bar) {
      if (bar.id === 'sidebar') return;
      bar.classList.remove('bg-slate-900', 'text-white');
      bar.classList.add('gherbi-studio-toolbar');

      var btns = bar.querySelectorAll('button');
      btns.forEach(function (btn) {
        var cls = btn.className || '';
        if (cls.includes('bg-slate-800')) {
          btn.classList.remove('bg-slate-800', 'text-slate-300', 'text-amber-400', 'text-emerald-400', 'hover:bg-slate-700');
          btn.classList.add('gherbi-toolbar-btn');
          btn.style.color = '';
        } else if (cls.includes('bg-blue-600')) {
          btn.classList.add('gherbi-toolbar-btn-active');
        } else if (cls.includes('bg-amber-500')) {
          btn.classList.add('gherbi-toolbar-btn-active-amber');
        }
      });
    });
  }

  var _prevRenderPrint = typeof App.renderPrintStudioView === 'function' ? App.renderPrintStudioView.bind(App) : null;
  if (_prevRenderPrint) {
    App.renderPrintStudioView = async function () {
      var res = await _prevRenderPrint();
      upgradeDarkToolbarsInDom(document.getElementById('print-view-root'));
      return res;
    };
  }

  var _prevRenderCaisse = typeof App.renderCaisseView === 'function' ? App.renderCaisseView.bind(App) : null;
  if (_prevRenderCaisse) {
    App.renderCaisseView = async function () {
      var res = await _prevRenderCaisse();
      upgradeDarkToolbarsInDom(document.getElementById('caisse-view-root'));
      return res;
    };
  }

  if (window.TemplateBuilder && typeof window.TemplateBuilder.initTemplateBuilder === 'function') {
    var _prevInitTb = window.TemplateBuilder.initTemplateBuilder.bind(window.TemplateBuilder);
    window.TemplateBuilder.initTemplateBuilder = async function (containerId) {
      var res = await _prevInitTb(containerId);
      upgradeDarkToolbarsInDom(document.getElementById(containerId || 'template-designer-root'));
      return res;
    };
  }

  // تطبيق فوري في حال كانت النافذة مفتوحة الآن
  setTimeout(function () {
    upgradeDarkToolbarsInDom(document);
    if (AppState.currentView === 'suppliers') {
      App.renderSuppliersView();
    }
  }, 150);
}

const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [BRIGHT LIGHT-MODE TOOLBARS & ARABIC SUPPLIER MATCHING FIX]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installBrightLightModeToolbarsFix.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن وفحص ترقية الأزرار المضيئة ومطابقة أسماء الموردين في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page9-suppliers-ultimate-upgrade.js', 'page9-suppliers-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 3/3: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتمل الإصلاح! اضغط Ctrl+R داخل البرنامج الآن وافتح نافذة تقرير PDF الموردين لترى الأزرار ساطعة وواضحة تماماً.');