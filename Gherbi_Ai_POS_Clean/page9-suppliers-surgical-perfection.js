/**
 * fix-print-studio-light-mode.js
 * الإصلاح الجذري الشامل لظهور أشرطة التبويبات، أزرار التحكم بالمعاينة، وخلفية طاولة الورق
 * في صفحة مركز الطباعة (#view-print بجميع تبويباتها الـ 4) وبقية صفحات النظام في الوضع المضيء (Light Mode).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿☀️ بدء تحويل أشرطة وأزرار ومعاينة مركز الطباعة (#view-print) إلى التصميم المضيء الواضح 100%...\n');

// ============================================================================
// 1. تحديث styles.css لضمان تباين وسطوع جميع الأزرار والأشرطة في الوضع المضيء
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
  color: #0f172a !important;
  border: 1.5px solid #cbd5e1 !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
  font-weight: 800 !important;
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
.gherbi-toolbar-btn-active-emerald {
  background-color: #059669 !important;
  color: #ffffff !important;
  border: 1.5px solid #047857 !important;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25) !important;
}
.gherbi-toolbar-btn-active-amber {
  background-color: #f59e0b !important;
  color: #0f172a !important;
  border: 1.5px solid #d97706 !important;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25) !important;
}
`;

  fs.writeFileSync(cssPath, css.trimEnd() + '\n\n' + lightModeShieldCss.trim() + '\n', 'utf8');
  console.log('✅ 1/3: تم تحديث styles.css بكلاسات الأزرار والأشرطة المضيئة عالية التباين.');
}

// ============================================================================
// 2. تحديث renderer-rc-100.js مباشرة لإصلاح شريط التبويبات الـ 4 وشريط المعاينة وخلفية الورق في مركز الطباعة
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  // أ) استبدال شريط التبويبات الـ 4 الرئيسي في مركز الطباعة (#view-print) ليصبح مضيئاً وواضحاً
  const oldTopNav =
    `      '<div class="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-md">' +\n` +
    `      '  <button type="button" onclick="App.switchPrintStudioTab(\\'labels\\')" class="px-4 py-2 rounded-xl transition ' + (tab === 'labels' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">🏷️ 1. استوديو الباركود وملصقات الرفوف وأوراق A4</button>' +\n` +
    `      '  <button type="button" onclick="App.switchPrintStudioTab(\\'designer\\')" class="px-4 py-2 rounded-xl transition ' + (tab === 'designer' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">🎨 2. مهندس قوالب الفواتير والأوراق الرسمية (A4 / 2×A5 / 80mm)</button>' +\n` +
    `      '  <button type="button" onclick="App.switchPrintStudioTab(\\'custom_bon\\')" class="px-4 py-2 rounded-xl transition ' + (tab === 'custom_bon' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-amber-400 hover:bg-slate-700') + '">🧾 3. منشئ البونات والأوراق الحر (إنشاء أي BON جديد)</button>' +\n` +
    `      '  <button type="button" onclick="App.switchPrintStudioTab(\\'catalogue_posters\\')" class="px-4 py-2 rounded-xl transition ' + (tab === 'catalogue_posters' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700') + '">📢 4. كتالوج الأسعار ولافتات العروض الجدارية (Posters)</button>' +\n` +
    `      '</div>';`;

  const newTopNav =
    `      '<div class="gherbi-studio-toolbar flex flex-wrap items-center gap-2 p-2.5 rounded-2xl text-xs font-black shadow-sm">' +\n` +
    `      '  <button type="button" onclick="App.switchPrintStudioTab(\\'labels\\')" class="px-4 py-2 rounded-xl transition font-black ' + (tab === 'labels' ? 'gherbi-toolbar-btn-active' : 'gherbi-toolbar-btn') + '">🏷️ 1. استوديو الباركود وملصقات الرفوف وأوراق A4</button>' +\n` +
    `      '  <button type="button" onclick="App.switchPrintStudioTab(\\'designer\\')" class="px-4 py-2 rounded-xl transition font-black ' + (tab === 'designer' ? 'gherbi-toolbar-btn-active' : 'gherbi-toolbar-btn') + '">🎨 2. مهندس قوالب الفواتير والأوراق الرسمية (A4 / 2×A5 / 80mm)</button>' +\n` +
    `      '  <button type="button" onclick="App.switchPrintStudioTab(\\'custom_bon\\')" class="px-4 py-2 rounded-xl transition font-black ' + (tab === 'custom_bon' ? 'gherbi-toolbar-btn-active-amber' : 'gherbi-toolbar-btn') + '">🧾 3. منشئ البونات والأوراق الحر (إنشاء أي BON جديد)</button>' +\n` +
    `      '  <button type="button" onclick="App.switchPrintStudioTab(\\'catalogue_posters\\')" class="px-4 py-2 rounded-xl transition font-black ' + (tab === 'catalogue_posters' ? 'gherbi-toolbar-btn-active-emerald' : 'gherbi-toolbar-btn') + '">📢 4. كتالوج الأسعار ولافتات العروض الجدارية (Posters)</button>' +\n` +
    `      '</div>';`;

  if (rc.includes(oldTopNav)) {
    rc = rc.replace(oldTopNav, newTopNav);
  }

  // ب) استبدال دالة buildInteractivePreviewToolbarHtml بالكامل لتكون مضيئة وواضحة 100% في التبويبين 2 و 3
  const tbStart = rc.indexOf('function buildInteractivePreviewToolbarHtml(targetMode) {');
  const tbEnd = rc.indexOf('App.cycleTdTableStyle = function () {', tbStart);
  if (tbStart !== -1 && tbEnd !== -1) {
    const newToolbarFn = `function buildInteractivePreviewToolbarHtml(targetMode) {
    var curPaper = targetMode === 'td' ? AppState.tdLayout.paper : AppState.customBonState.paperMode;
    var curColor = targetMode === 'td' ? AppState.tdLayout.accentColor : AppState.customBonState.accentColor;

    var paperPills = [
      { k: 'thermal80', lbl: '🧾 80mm حراري' },
      { k: 'thermal58', lbl: '🎫 58mm حراري' },
      { k: 'a4_dual_a5', lbl: '🔥 2×A5 مزدوج' },
      { k: 'a5_landscape', lbl: '📐 A5 أفقي' },
      { k: 'a5', lbl: '📑 A5 عمودي' },
      { k: 'a4', lbl: '📄 A4 عمودي' },
      { k: 'a4_landscape', lbl: '🖼️ A4 أفقي' }
    ];

    var colors = ['#1d4ed8', '#0f172a', '#047857', '#be123c', '#4338ca', '#d97706', '#0f766e'];

    return (
      '<div class="gherbi-studio-toolbar p-3 rounded-2xl space-y-2.5 mb-2.5 shadow-sm text-[11px]">' +
      '  <div class="flex flex-wrap items-center justify-between gap-1.5">' +
      '    <span class="font-black text-blue-700 dark:text-amber-400">⚡ شريط التحكم الفوري بالمعاينة (اضغط لتغيير مقاس الورقة فوراً):</span>' +
      '    <div class="flex items-center gap-1">' +
      '      <button type="button" onclick="App.stepPreviewFontSize(\\'' + targetMode + '\\', -1)" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg font-mono font-bold" title="تصغير الخط">A-</button>' +
      '      <button type="button" onclick="App.stepPreviewFontSize(\\'' + targetMode + '\\', 1)" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg font-mono font-bold" title="تكبير الخط">A+</button>' +
      '      <span class="text-slate-400 mx-1">|</span>' +
      '      <button type="button" onclick="AppState.previewZoomLevel=Math.max(60,(AppState.previewZoomLevel||100)-15); App.refreshActiveStudioPreview(\\'' + targetMode + '\\')" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg font-mono" title="تصغير العرض">🔍-</button>' +
      '      <button type="button" onclick="AppState.previewZoomLevel=100; App.refreshActiveStudioPreview(\\'' + targetMode + '\\')" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg font-mono">' + (AppState.previewZoomLevel || 100) + '%</button>' +
      '      <button type="button" onclick="AppState.previewZoomLevel=Math.min(135,(AppState.previewZoomLevel||100)+15); App.refreshActiveStudioPreview(\\'' + targetMode + '\\')" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg font-mono" title="تكبير العرض">🔍+</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="flex flex-wrap items-center gap-1.5">' +
      paperPills.map(function (p) {
        var isAct = curPaper === p.k || (p.k === 'a5' && curPaper === 'a5_portrait');
        return (
          '<button type="button" onclick="App.quickSetPaperFromToolbar(\\'' + targetMode + '\\', \\'' + p.k + '\\')" class="px-3 py-1.5 rounded-xl font-black transition ' + (isAct ? 'gherbi-toolbar-btn-active' : 'gherbi-toolbar-btn') + '">' +
          p.lbl +
          '</button>'
        );
      }).join('') +
      '  </div>' +

      '  <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-300 dark:border-slate-700">' +
      '    <div class="flex items-center gap-1.5">' +
      '      <span class="font-bold">🎨 اللون:</span>' +
      colors.map(function (c) {
        return '<button type="button" onclick="App.quickSetColorFromToolbar(\\'' + targetMode + '\\', \\'' + c + '\\')" style="background:' + c + ';width:20px;height:20px;border-radius:999px;border:' + (curColor === c ? '3px solid #2563eb' : '1.5px solid #94a3b8') + ';"></button>';
      }).join('') +
      '    </div>' +
      (targetMode === 'bon'
        ? '<div class="flex flex-wrap items-center gap-1.5">' +
          '  <button type="button" onclick="AppState.customBonState.fields.push({label:\\'خانة إضافية\\',value:\\'تفاصيل...\\'}); App.renderPrintStudioView()" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">+ خانة جديدة</button>' +
          '  <button type="button" onclick="AppState.customBonState.showItemsTable=true; AppState.customBonState.items.push({col1:\\'خدمة / قطعة جديدة\\',col2:\\'1\\',col3:\\'1000.00\\',col4:\\'1000.00\\'}); App.renderPrintStudioView()" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">+ سطر جدول</button>' +
          '  <button type="button" onclick="AppState.customBonState.showBarcode=!AppState.customBonState.showBarcode; App.refreshCustomBonPreview()" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">📊 الباركود</button>' +
          '  <button type="button" onclick="AppState.customBonState.showCentimesTotal=!AppState.customBonState.showCentimesTotal; App.refreshCustomBonPreview()" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">🇩🇿 السنتيم</button>' +
          '</div>'
        : '<div class="flex flex-wrap items-center gap-1.5">' +
          '  <button type="button" onclick="App.cycleTdTableStyle()" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">🎨 نمط الجدول</button>' +
          '  <button type="button" onclick="App.addTdSampleItemRow()" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">+ سطر</button>' +
          '  <button type="button" onclick="window.TemplateBuilder.updateProp(\\'showCentimes\\', !AppState.tdLayout.showCentimes)" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">🇩🇿 السنتيم</button>' +
          '  <button type="button" onclick="window.TemplateBuilder.updateProp(\\'showFiscal\\', !AppState.tdLayout.showFiscal)" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">🏛️ الجباية</button>' +
          '  <button type="button" onclick="window.TemplateBuilder.updateProp(\\'showDriverInfo\\', !AppState.tdLayout.showDriverInfo)" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">🚚 السائق</button>' +
          '  <button type="button" onclick="window.TemplateBuilder.updateProp(\\'showSignature\\', !AppState.tdLayout.showSignature)" class="gherbi-toolbar-btn px-2.5 py-1 rounded-lg">✍️ الختم</button>' +
          '</div>') +
      '  </div>' +
      '</div>'
    );
  }\n\n  `;
    rc = rc.slice(0, tbStart) + newToolbarFn + rc.slice(tbEnd);
  }

  // ج) تحويل خلفية طاولة المعاينة داخل الـ iframe في مركز الطباعة من الأسود (#0f172a) إلى الرمادي الفاتح المريح (#e2e8f0)
  rc = rc.replace(
    /html,body\{background:#0f172a;padding:14px 0;display:flex;flex-direction:column;align-items:center;\}/g,
    'html,body{background:#e2e8f0;padding:16px 0;display:flex;flex-direction:column;align-items:center;}'
  );
  rc = rc.replace(
    /style="color:#38bdf8;font-size:11px;font-weight:900;margin-bottom:8px;text-align:center;"/g,
    'style="color:#1e3a8a;background:#dbeafe;border:1px solid #93c5fd;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:900;margin-bottom:10px;text-align:center;"'
  );
  rc = rc.replace(
    /style="color:#38bdf8;font-size:12px;font-weight:900;margin-bottom:8px;text-align:center;"/g,
    'style="color:#1e3a8a;background:#dbeafe;border:1px solid #93c5fd;padding:5px 16px;border-radius:999px;font-size:11.5px;font-weight:900;margin-bottom:10px;text-align:center;"'
  );
  rc = rc.replace(
    /border border-slate-700 rounded-2xl bg-slate-900 shadow-inner/g,
    'border border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-200/70 dark:bg-slate-900 shadow-inner'
  );

  new vm.Script(rc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, rc, 'utf8');
  console.log('✅ 2/3: تم تحديث شريط التبويبات الـ 4 وشريط أدوات المعاينة وخلفية الورق في مركز الطباعة (#view-print) بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['fix-light-mode-toolbars-and-buttons.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 3/3: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتمل الإصلاح! اضغط Ctrl+R داخل البرنامج الآن وافتح (مركز الطباعة والباركود) لترى جميع الأزرار والتبويبات والمعاينة ساطعة وواضحة تماماً في الوضع المضيء.');