/**
 * fix-print-studio-live-paper-and-pdf.js
 * الإصلاح الجذري لمقاسات الورق الحقيقية (80mm / 58mm / A5 / 2xA5 / A4) في المعاينة الحية والطباعة وتصدير PDF
 * + إضافة شريط الأدوات التفاعلي المباشر فوق المعاينة الحية + ميزة التعديل المباشر بالضغط داخل الورقة (Direct Click-to-Edit).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء إصلاح مقاسات الورق الحقيقية (80mm / A5 / 2xA5 / A4) وتفعيل التعديل المباشر من المعاينة الحية...\n');

// ============================================================================
// 1. ترقية main.js لتفعيل preferCSSPageSize: true في export-pdf حتى يخرج PDF بمقاس 80mm / A5 / الملصق بدقة!
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  const oldPdfCall = 'const pdfBuf = await pdfWin.webContents.printToPDF({ printBackground: true });';
  const newPdfCall = `const pdfBuf = await pdfWin.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: 'none' }
      });`;

  if (mainCode.includes(oldPdfCall)) {
    mainCode = mainCode.replace(oldPdfCall, newPdfCall);
    new vm.Script(mainCode, { filename: 'main.js' });
    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('✅ 1/3: تم تحديث main.js (export-pdf) لتفعيل preferCSSPageSize: true واعتماد مقاس 80mm / A5 / الملصق بدقة المليمتر.');
  } else if (mainCode.includes('preferCSSPageSize: true')) {
    console.log('✅ 1/3: main.js يدعم بالفعل preferCSSPageSize: true.');
  }
}

// ============================================================================
// 2. الوحدة الشاملة للمعاينة الفيزيائية الحقيقية للورق وأدوات التعديل المباشر من المعاينة
// ============================================================================
function installLivePaperCanvasAndInteractivePreview() {
  if (!window.App || !window.AppState) return;

  AppState.previewZoomLevel = AppState.previewZoomLevel || 100;

  // إعدادات القالب الموحدة في التبويب الثاني (مهندس القوالب)
  AppState.tdLayout = AppState.tdLayout || {
    id: null,
    name: 'قالب بون وفاتورة احترافي',
    doc_type: 'invoice',
    paper: 'a4', // 'a4' | 'a4_landscape' | 'a4_dual_a5' | 'a5' | 'a5_landscape' | 'thermal80' | 'thermal58'
    lang: 'ar',
    accentColor: '#1d4ed8',
    fontSize: 12,
    showFiscal: true,
    showOldDebt: true,
    showAmountInWords: true,
    showCentimes: true,
    showDriverInfo: false,
    showSignature: true,
    showBarcode: true,
    watermarkText: '',
    customDocTitle: '',
    columns: {
      index: true,
      barcode: true,
      designation: true,
      qty: true,
      unit: true,
      unitPrice: true,
      tva: false,
      total: true,
      centimes: true
    },
    footerNote: 'شكراً لتعاملكم معنا — البضاعة المباعة لا تُرد ولا تُستبدل إلا وفق الشروط القانونية.'
  };

  AppState.tdSampleData = AppState.tdSampleData || {
    doc_number: 'FAC-2026-0105',
    sale_date: new Date().toISOString().slice(0, 10),
    customer_name: 'مؤسسة الأمل للتجارة',
    customer_phone: '0550123456',
    payment_method: 'نقداً',
    subtotal: 14500,
    discount: 500,
    total: 14000,
    paid_amount: 14000,
    old_balance: 2000,
    items: [
      { barcode: '6130001', product_name: 'زيت مائدة إيليو 5 لتر', quantity: 4, unit: 'قارورة', price: 650, subtotal: 2600 },
      { barcode: '6130002', product_name: 'قهوة مطحونة بونال 250غ', quantity: 20, unit: 'علبة', price: 320, subtotal: 6400 },
      { barcode: '6130003', product_name: 'حليب مجفف لويا 500غ', quantity: 11, unit: 'علبة', price: 500, subtotal: 5500 }
    ]
  };

  function getProdRetail(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.selling_price ?? fb.selling_price ?? 0);
  }

  // مواصفات كل مقاس ورق (للمعاينة الحية وللطباعة/PDF)
  function getPaperSpecs(paperKey) {
    var key = String(paperKey || 'a4').toLowerCase();
    var map = {
      thermal80: {
        key: 'thermal80',
        label: '🧾 تذكرة حرارية 80mm (عرض 80mm)',
        isThermal: true,
        widthMm: 78,
        pageCss: '@page { size: 80mm 215mm; margin: 0mm; }',
        screenWidthPx: 305,
        screenMinHeightPx: 480,
        screenZoom: 1
      },
      thermal58: {
        key: 'thermal58',
        label: '🎫 تذكرة حرارية 58mm (عرض 58mm)',
        isThermal: true,
        widthMm: 56,
        pageCss: '@page { size: 58mm 185mm; margin: 0mm; }',
        screenWidthPx: 225,
        screenMinHeightPx: 420,
        screenZoom: 1
      },
      a5: {
        key: 'a5',
        label: '📑 ورقة A5 عمودية (148×210mm)',
        isThermal: false,
        widthMm: 148,
        pageCss: '@page { size: 148mm 210mm; margin: 0mm; }',
        screenWidthPx: 540,
        screenMinHeightPx: 760,
        screenZoom: 0.88
      },
      a5_portrait: {
        key: 'a5_portrait',
        label: '📑 ورقة A5 عمودية (148×210mm)',
        isThermal: false,
        widthMm: 148,
        pageCss: '@page { size: 148mm 210mm; margin: 0mm; }',
        screenWidthPx: 540,
        screenMinHeightPx: 760,
        screenZoom: 0.88
      },
      a5_landscape: {
        key: 'a5_landscape',
        label: '📐 بون تجاري A5 أفقي (210×148mm)',
        isThermal: false,
        widthMm: 210,
        pageCss: '@page { size: 210mm 148mm; margin: 0mm; }',
        screenWidthPx: 760,
        screenMinHeightPx: 535,
        screenZoom: 0.74
      },
      a4_dual_a5: {
        key: 'a4_dual_a5',
        label: '🔥 نسختان 2×A5 في ورقة A4 واحدة (زبون + أرشيف)',
        isThermal: false,
        isDualA5: true,
        widthMm: 210,
        pageCss: '@page { size: 210mm 297mm; margin: 0mm; }',
        screenWidthPx: 760,
        screenMinHeightPx: 1070,
        screenZoom: 0.72
      },
      a4_landscape: {
        key: 'a4_landscape',
        label: '🖼️ ورقة A4 أفقية عريضة (297×210mm)',
        isThermal: false,
        widthMm: 297,
        pageCss: '@page { size: 297mm 210mm; margin: 0mm; }',
        screenWidthPx: 1060,
        screenMinHeightPx: 750,
        screenZoom: 0.56
      },
      a4: {
        key: 'a4',
        label: '📄 ورقة A4 عمودية قياسية (210×297mm)',
        isThermal: false,
        widthMm: 210,
        pageCss: '@page { size: 210mm 297mm; margin: 0mm; }',
        screenWidthPx: 760,
        screenMinHeightPx: 1070,
        screenZoom: 0.72
      }
    };
    return map[key] || map.a4;
  }

  // استخراج HTML نظيف للطباعة أو PDF من داخل iframe المعاينة الحية (لحفظ أي تعديل مباشر قام به المستخدم على الورقة!)
  function extractPrintableHtmlFromIframe(iframeId, fallbackHtml) {
    var frame = document.getElementById(iframeId);
    if (!frame || !frame.contentWindow || !frame.contentWindow.document) {
      return fallbackHtml;
    }
    var docClone = frame.contentWindow.document.documentElement.cloneNode(true);
    docClone.querySelectorAll('.no-print-ui').forEach(function (el) { el.remove(); });
    docClone.querySelectorAll('[contenteditable]').forEach(function (el) {
      el.removeAttribute('contenteditable');
    });
    return '<!DOCTYPE html>\n' + docClone.outerHTML;
  }

  // ==========================================================================
  // أ) المحرك الهندسي للقوالب الرسمية (TemplateRenderer) — يدعم 80mm/58mm الحقيقي و A5 و 2×A5 و A4
  // ==========================================================================
  if (window.TemplateRenderer) {
    window.TemplateRenderer.renderCustomTemplateHtml = function (layout, docData, settings) {
      layout = layout || AppState.tdLayout || {};
      docData = docData || AppState.tdSampleData || {};
      settings = settings || AppState.settings || {};

      var lang = layout.lang || 'ar';
      var dir = lang === 'ar' ? 'rtl' : 'ltr';
      var accent = layout.accentColor || '#1d4ed8';
      var cols = layout.columns || {};
      var items = Array.isArray(docData.items) ? docData.items : [];
      var spec = getPaperSpecs(layout.paper || 'a4');
      var userZoom = (Number(AppState.previewZoomLevel || 100) / 100) * spec.screenZoom;

      var docTypeTitles = {
        invoice: 'فاتورة بيع رسمية (FACTURE)',
        delivery: 'بون تسليم وتوصيل بضاعة (BON DE LIVRAISON)',
        order: 'سند طلبية زبون (BON DE COMMANDE)',
        proforma: 'فاتورة شكلية / كشف تقديري (PROFORMA)',
        receipt: 'بون مبيعات الكاشير (TICKET DE CAISSE)',
        reception: 'بون استلام بضاعة (BON DE RÉCEPTION)',
        payment_receipt: 'بون تسديد دفعة حساب (BON DE VERSEMENT)',
        avoir: 'إشعار دائن / فاتورة إرجاع (FACTURE D\'AVOIR)'
      };
      var docTitleText = layout.customDocTitle || docTypeTitles[layout.doc_type || 'invoice'] || 'فاتورة (FACTURE)';

      var subtotal = Number(docData.subtotal ?? docData.total ?? 0);
      var discount = Number(docData.discount || 0);
      var total = Number(docData.total ?? (subtotal - discount));
      var paid = Number(docData.paid_amount ?? total);
      var rest = Math.max(0, Number((total - paid).toFixed(2)));
      var oldDebt = Number(docData.old_balance || 0);
      var centimeTotal = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(total) : '';

      var words = window.NumberToWords && typeof window.NumberToWords.toWords === 'function'
        ? window.NumberToWords.toWords(total, lang)
        : total.toFixed(2) + ' DZD';

      // ----------------------------------------------------------------------
      // 1) تخطيط التذكرة الحرارية الحقيقية (80mm أو 58mm)
      // ----------------------------------------------------------------------
      if (spec.isThermal) {
        var thermalRows = items.map(function (it, idx) {
          var lineSub = Number(it.subtotal || (it.quantity || 1) * (it.price || 0));
          return (
            '<tr>' +
            '<td contenteditable="true" style="font-weight:800;padding:3px 2px;">' + (idx + 1) + '. ' + (it.product_name || it.name || 'منتج') + '</td>' +
            '<td contenteditable="true" style="text-align:center;font-family:monospace;font-weight:bold;">' + (it.quantity || 1) + '</td>' +
            '<td contenteditable="true" style="text-align:center;font-family:monospace;">' + Number(it.price || 0).toFixed(0) + '</td>' +
            '<td contenteditable="true" style="text-align:left;font-family:monospace;font-weight:900;">' + lineSub.toFixed(2) + '</td>' +
            '</tr>'
          );
        }).join('');

        return (
          '<!DOCTYPE html><html lang="' + lang + '" dir="' + dir + '"><head><meta charset="UTF-8">' +
          '<link rel="stylesheet" href="./assets/css/fonts.css">' +
          '<style>' +
          spec.pageCss +
          '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
          'html,body{margin:0;padding:0;font-family:"Cairo","Tajawal",sans-serif;font-size:' + (layout.fontSize || 11) + 'px;color:#000;}' +
          '@media screen {' +
          '  html,body{background:#0f172a;padding:14px 0;display:flex;flex-direction:column;align-items:center;}' +
          '  .paper-sheet{width:' + spec.widthMm + 'mm;max-width:' + spec.widthMm + 'mm;background:#fff;padding:4mm 3.5mm;box-shadow:0 20px 45px rgba(0,0,0,0.55);border-top:5px dashed #cbd5e1;border-bottom:5px dashed #cbd5e1;zoom:' + Number(AppState.previewZoomLevel || 100) / 100 + ';}' +
          '  [contenteditable="true"]:hover{outline:1.5px dashed #3b82f6;background:#eff6ff;cursor:text;}' +
          '  [contenteditable="true"]:focus{outline:2px solid #2563eb;background:#fefce8;}' +
          '}' +
          '@media print {' +
          '  html,body{background:#fff !important;width:' + spec.widthMm + 'mm !important;margin:0 !important;padding:0 !important;}' +
          '  .paper-sheet{width:' + spec.widthMm + 'mm !important;max-width:' + spec.widthMm + 'mm !important;padding:2.5mm !important;margin:0 !important;box-shadow:none !important;border:none !important;zoom:1 !important;}' +
          '  .no-print-ui{display:none !important;}' +
          '}' +
          '.sep{border-top:1.5px dashed #000;margin:5px 0;}' +
          '.row{display:flex;justify-content:space-between;align-items:center;margin:2px 0;}' +
          'table{width:100%;border-collapse:collapse;margin:4px 0;font-size:10.5px;}' +
          'th{border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:3px 2px;font-weight:900;background:' + accent + ';color:#fff;}' +
          'td{border-bottom:1px dotted #94a3b8;padding:3px 2px;}' +
          '</style></head><body>' +
          '<div class="no-print-ui" style="color:#38bdf8;font-size:11px;font-weight:900;margin-bottom:8px;text-align:center;">📏 معاينة حقيقية بمقاس ' + spec.label + ' — انقر على أي نص داخل التذكرة لتعديله مباشرة!</div>' +
          '<div class="paper-sheet">' +
          '  <div style="text-align:center;">' +
          '    <div contenteditable="true" style="font-size:15px;font-weight:900;color:' + accent + ';">' + (settings.shop_name || 'Gherbi.Ai POS') + '</div>' +
          '    <div contenteditable="true" style="font-size:10px;">' + (settings.shop_address || 'الجزائر') + (settings.shop_phone ? ' - ' + settings.shop_phone : '') + '</div>' +
          (layout.showFiscal ? '<div contenteditable="true" style="font-size:9px;font-family:monospace;">RC:' + (settings.shop_rc || '-') + ' | NIF:' + (settings.shop_nif || '-') + '</div>' : '') +
          '    <div contenteditable="true" style="margin-top:4px;padding:3px 6px;border:1.5px solid ' + accent + ';border-radius:5px;font-weight:900;font-size:11.5px;color:' + accent + ';">' + docTitleText + '</div>' +
          '  </div>' +
          '  <div class="sep"></div>' +
          '  <div class="row"><span>رقم السند:</span><strong contenteditable="true" style="font-family:monospace;">' + (docData.doc_number || 'FAC-2026-0105') + '</strong></div>' +
          '  <div class="row"><span>التاريخ:</span><span contenteditable="true" style="font-family:monospace;">' + String(docData.sale_date || new Date().toISOString()).slice(0, 10) + '</span></div>' +
          '  <div class="row"><span>الزبون:</span><strong contenteditable="true">' + (docData.customer_name || 'زبون عابر') + '</strong></div>' +
          '  <div class="row"><span>الدفع:</span><strong contenteditable="true">' + (docData.payment_method || 'نقداً') + '</strong></div>' +
          '  <div class="sep"></div>' +
          '  <table><thead><tr><th>المنتج</th><th>ك</th><th>السعر</th><th>المجموع</th></tr></thead><tbody>' + thermalRows + '</tbody></table>' +
          '  <div class="sep"></div>' +
          '  <div class="row"><span>المجموع الفرعي:</span><strong style="font-family:monospace;">' + subtotal.toFixed(2) + ' د.ج</strong></div>' +
          (discount > 0 ? '<div class="row"><span>التخفيض:</span><strong style="font-family:monospace;">-' + discount.toFixed(2) + ' د.ج</strong></div>' : '') +
          '  <div style="padding:5px;border:1.5px solid #000;border-radius:6px;background:#f8fafc;margin:4px 0;">' +
          '    <div class="row" style="font-size:13px;font-weight:900;color:' + accent + ';"><span>الصافي للدفع:</span><span contenteditable="true" style="font-family:monospace;">' + total.toFixed(2) + ' د.ج</span></div>' +
          (layout.showCentimes !== false ? '<div contenteditable="true" style="font-size:10px;font-weight:900;color:#b45309;text-align:left;">بالسنتيم: ' + centimeTotal + '</div>' : '') +
          '  </div>' +
          '  <div class="row"><span>المدفوع:</span><span contenteditable="true" style="font-family:monospace;">' + paid.toFixed(2) + ' د.ج</span></div>' +
          (layout.showOldDebt && oldDebt > 0 ? '<div class="row"><span>الدين السابق:</span><span contenteditable="true" style="font-family:monospace;">' + oldDebt.toFixed(2) + ' د.ج</span></div>' : '') +
          (layout.showAmountInWords ? '<div contenteditable="true" style="font-size:9.5px;margin-top:4px;font-weight:bold;">' + words + '</div>' : '') +
          '  <div class="sep"></div>' +
          '  <div contenteditable="true" style="text-align:center;font-size:9.5px;font-weight:bold;">' + (layout.footerNote || 'شكراً لزيارتكم!') + '</div>' +
          (layout.showSignature ? '<div contenteditable="true" style="text-align:center;margin-top:8px;font-size:9.5px;font-weight:bold;">الختم والإمضاء: ....................</div>' : '') +
          '</div></body></html>'
        );
      }

      // ----------------------------------------------------------------------
      // 2) تخطيط الأوراق القياسية والنصفية (A4 / A5 / A5 Landscape / 2×A5 Dual)
      // ----------------------------------------------------------------------
      var headersHtml =
        (cols.index !== false ? '<th>#</th>' : '') +
        (cols.barcode ? '<th>المرجع</th>' : '') +
        '<th>البيان / المنتج</th>' +
        (cols.qty !== false ? '<th>الكمية</th>' : '') +
        (cols.unit ? '<th>الوحدة</th>' : '') +
        (cols.unitPrice !== false ? '<th>سعر الوحدة</th>' : '') +
        (cols.tva ? '<th>TVA</th>' : '') +
        '<th>المجموع</th>' +
        (cols.centimes ? '<th>بالسنتيم</th>' : '');

      var rowsHtml = items.map(function (it, i) {
        var lineSub = Number(it.subtotal || (it.quantity || 1) * (it.price || 0));
        var lineCent = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(lineSub) : '';
        return (
          '<tr>' +
          (cols.index !== false ? '<td style="text-align:center;">' + (i + 1) + '</td>' : '') +
          (cols.barcode ? '<td contenteditable="true" style="font-family:monospace;text-align:center;">' + (it.barcode || it.product_barcode || '-') + '</td>' : '') +
          '<td contenteditable="true" style="font-weight:700;">' + (it.product_name || it.custom_product_name || it.name || 'منتج') + '</td>' +
          (cols.qty !== false ? '<td contenteditable="true" style="text-align:center;font-family:monospace;font-weight:bold;">' + (it.quantity || 1) + '</td>' : '') +
          (cols.unit ? '<td contenteditable="true" style="text-align:center;">' + (it.unit || 'قطعة') + '</td>' : '') +
          (cols.unitPrice !== false ? '<td contenteditable="true" style="text-align:center;font-family:monospace;">' + Number(it.price || 0).toFixed(2) + '</td>' : '') +
          (cols.tva ? '<td contenteditable="true" style="text-align:center;">' + Number(docData.tax_percentage || 0) + '%</td>' : '') +
          '<td contenteditable="true" style="text-align:center;font-family:monospace;font-weight:800;">' + lineSub.toFixed(2) + '</td>' +
          (cols.centimes ? '<td contenteditable="true" style="text-align:center;font-size:10px;color:#b45309;font-weight:bold;">' + lineCent + '</td>' : '') +
          '</tr>'
        );
      }).join('');

      var buildStandardBlock = function (copyBadgeText) {
        return (
          '<div class="single-doc-box" style="position:relative;">' +
          (layout.watermarkText
            ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.07;font-size:46px;font-weight:900;transform:rotate(-18deg);">' + layout.watermarkText + '</div>'
            : '') +
          '<div class="header">' +
          '  <div>' +
          '    <div contenteditable="true" class="shop-title">' + (settings.shop_name || 'Gherbi.Ai POS') + '</div>' +
          '    <div contenteditable="true">' + (settings.shop_description || 'تجارة عامة وتوزيع') + '</div>' +
          '    <div contenteditable="true">' + (settings.shop_address || 'الجزائر') + (settings.shop_phone ? ' | هاتف: ' + settings.shop_phone : '') + '</div>' +
          (layout.showFiscal
            ? '<div contenteditable="true" style="font-size:10px;color:#475569;margin-top:3px;font-family:monospace;">RC: ' + (settings.shop_rc || '-') + ' | NIF: ' + (settings.shop_nif || '-') + ' | AI: ' + (settings.shop_ai || '-') + ' | NIS: ' + (settings.shop_nis || '-') + '</div>'
            : '') +
          '  </div>' +
          '  <div style="text-align:left;">' +
          (copyBadgeText ? '<div style="display:inline-block;padding:2px 8px;border-radius:4px;background:#e2e8f0;font-size:10px;font-weight:900;margin-bottom:3px;">' + copyBadgeText + '</div>' : '') +
          '    <div contenteditable="true" style="font-size:15px;font-weight:900;color:' + accent + ';">' + docTitleText + '</div>' +
          '    <div contenteditable="true" style="font-family:monospace;font-weight:900;">N°: ' + (docData.doc_number || 'FAC-2026-0105') + '</div>' +
          '    <div contenteditable="true">التاريخ: ' + String(docData.sale_date || new Date().toISOString()).slice(0, 10) + '</div>' +
          '  </div>' +
          '</div>' +

          '<div class="meta-box">' +
          '  <div contenteditable="true"><strong>الطرف / الزبون:</strong> ' + (docData.customer_name || 'مؤسسة الأمل للتجارة') + (docData.customer_phone ? ' | <strong>الهاتف:</strong> ' + docData.customer_phone : '') + '</div>' +
          '  <div contenteditable="true"><strong>طريقة التسديد:</strong> ' + (docData.payment_method || 'نقداً') + '</div>' +
          '</div>' +

          (layout.showDriverInfo
            ? '<div contenteditable="true" style="margin-bottom:8px;padding:6px 10px;border:1px dashed #94a3b8;border-radius:6px;font-size:10.5px;display:flex;justify-content:space-between;">' +
              '  <span><strong>🚚 السائق / الموزع:</strong> ............................</span>' +
              '  <span><strong>ترقيم المركبة (Matricule):</strong> ............................</span>' +
              '  <span><strong>عدد الطرود (Colis):</strong> ............</span>' +
              '</div>'
            : '') +

          '<table><thead><tr>' + headersHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +

          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
          '  <div style="flex:1;">' +
          (layout.showAmountInWords ? '<div contenteditable="true" class="words-box">أوقفت هذه الوثيقة على مبلغ: ' + words + '</div>' : '') +
          (layout.footerNote ? '<div contenteditable="true" style="margin-top:6px;font-size:10.5px;color:#475569;font-weight:bold;">' + layout.footerNote + '</div>' : '') +
          '  </div>' +
          '  <div class="totals">' +
          '    <div class="totals-row"><span>المجموع الفرعي:</span><span contenteditable="true" style="font-family:monospace;font-weight:bold;">' + subtotal.toFixed(2) + ' د.ج</span></div>' +
          (discount > 0 ? '<div class="totals-row"><span>التخفيض:</span><span contenteditable="true" style="font-family:monospace;">-' + discount.toFixed(2) + ' د.ج</span></div>' : '') +
          '    <div class="totals-row grand"><span>الصافي للدفع:</span><span contenteditable="true" style="font-family:monospace;">' + total.toFixed(2) + ' د.ج</span></div>' +
          (layout.showCentimes !== false ? '<div class="totals-row" style="background:#fffbeb;color:#b45309;font-weight:900;font-size:10.5px;"><span>المبلغ بالسنتيم:</span><span contenteditable="true">' + centimeTotal + '</span></div>' : '') +
          '    <div class="totals-row"><span>المدفوع:</span><span contenteditable="true" style="font-family:monospace;">' + paid.toFixed(2) + ' د.ج</span></div>' +
          (layout.showOldDebt && oldDebt > 0 ? '<div class="totals-row"><span>الدين السابق:</span><span contenteditable="true" style="font-family:monospace;">' + oldDebt.toFixed(2) + ' د.ج</span></div>' : '') +
          '  </div>' +
          '</div>' +

          (layout.showSignature
            ? '<div class="footer" style="margin-top:14px;padding-top:6px;border-top:1px dashed #cbd5e1;font-weight:800;">' +
              '  <div contenteditable="true">إمضاء المستلم / الزبون: ........................</div>' +
              '  <div contenteditable="true">الختم والإمضاء: ........................</div>' +
              '</div>'
            : '') +
          '</div>'
        );
      };

      var innerBody = spec.isDualA5
        ? '<div style="display:flex;flex-direction:column;justify-content:space-between;min-height:275mm;gap:4mm;">' +
          buildStandardBlock('نسخة الزبون (Exemplaire Client - 1/2)') +
          '<div style="border-top:2px dashed #64748b;text-align:center;font-size:10px;color:#64748b;padding:2px 0;">✂️ خط القص — (نسختان 2×A5 في ورقة A4 واحدة لتوفير 50% من الورق) ✂️</div>' +
          buildStandardBlock('نسخة الأرشيف والمحاسبة (Exemplaire Archive - 2/2)') +
          '</div>'
        : buildStandardBlock('');

      return (
        '<!DOCTYPE html><html lang="' + lang + '" dir="' + dir + '"><head><meta charset="UTF-8">' +
        '<link rel="stylesheet" href="./assets/css/fonts.css">' +
        '<style>' +
        spec.pageCss +
        '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
        'html,body{margin:0;padding:0;font-family:"Cairo","Tajawal",sans-serif;font-size:' + (layout.fontSize || 11.5) + 'px;color:#0f172a;}' +
        '@media screen {' +
        '  html,body{background:#0f172a;padding:14px 0;display:flex;flex-direction:column;align-items:center;}' +
        '  .paper-sheet{width:' + spec.screenWidthPx + 'px;min-height:' + spec.screenMinHeightPx + 'px;background:#fff;padding:18px;border-radius:6px;box-shadow:0 20px 50px rgba(0,0,0,0.55);zoom:' + userZoom.toFixed(2) + ';}' +
        '  [contenteditable="true"]:hover{outline:1.5px dashed #3b82f6;background:#eff6ff;cursor:text;border-radius:3px;}' +
        '  [contenteditable="true"]:focus{outline:2px solid #2563eb;background:#fefce8;border-radius:3px;}' +
        '}' +
        '@media print {' +
        '  html,body{background:#fff !important;margin:0 !important;padding:0 !important;}' +
        '  .paper-sheet{width:100% !important;padding:8mm !important;margin:0 !important;box-shadow:none !important;zoom:1 !important;}' +
        '  .no-print-ui{display:none !important;}' +
        '}' +
        '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ' + accent + ';padding-bottom:8px;margin-bottom:10px;}' +
        '.shop-title{font-size:18px;font-weight:900;color:' + accent + ';}' +
        '.meta-box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:7px 12px;margin-bottom:10px;display:flex;justify-content:space-between;}' +
        'table{width:100%;border-collapse:collapse;margin-bottom:10px;}' +
        'th{background:' + accent + ';color:#fff;padding:6px;border:1px solid ' + accent + ';font-size:11px;}' +
        'td{padding:5px 6px;border:1px solid #cbd5e1;font-size:11px;}' +
        '.totals{width:245px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;}' +
        '.totals-row{display:flex;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;}' +
        '.totals-row.grand{background:' + accent + ';color:#fff;font-weight:900;font-size:13px;}' +
        '.words-box{padding:6px 10px;background:#f1f5f9;border-right:4px solid ' + accent + ';font-weight:700;font-size:11px;}' +
        '.footer{display:flex;justify-content:space-between;font-size:11px;color:#334155;}' +
        '</style></head><body>' +
        '<div class="no-print-ui" style="color:#38bdf8;font-size:12px;font-weight:900;margin-bottom:8px;text-align:center;">📏 معاينة حقيقية بمقاس: ' + spec.label + ' — ✏️ انقر على أي نص داخل الورقة لتعديله مباشرة!</div>' +
        '<div class="paper-sheet">' + innerBody + '</div></body></html>'
      );
    };
  }

  // ==========================================================================
  // ب) توحيد جميع دوال TemplateBuilder وشريط التحكم المباشر فوق المعاينة
  // ==========================================================================
  var savedCustomTemplatesCache = [];

  function buildInteractivePreviewToolbarHtml(targetMode) {
    // targetMode: 'td' (TemplateBuilder) | 'bon' (Custom BON)
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
      '<div class="p-2.5 rounded-2xl bg-slate-900 text-white space-y-2 mb-2.5 shadow-md text-[11px]">' +
      '  <div class="flex flex-wrap items-center justify-between gap-1.5">' +
      '    <span class="font-black text-amber-400">⚡ شريط التحكم الفوري بالمعاينة (اضغط لتغيير مقاس الورقة فوراً):</span>' +
      '    <div class="flex items-center gap-1">' +
      '      <button type="button" onclick="App.stepPreviewFontSize(\'' + targetMode + '\', -1)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-mono font-bold" title="تصغير الخط">A-</button>' +
      '      <button type="button" onclick="App.stepPreviewFontSize(\'' + targetMode + '\', 1)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-mono font-bold" title="تكبير الخط">A+</button>' +
      '      <span class="text-slate-500 mx-1">|</span>' +
      '      <button type="button" onclick="AppState.previewZoomLevel=Math.max(60,(AppState.previewZoomLevel||100)-15); App.refreshActiveStudioPreview(\'' + targetMode + '\')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-mono" title="تصغير العرض">🔍-</button>' +
      '      <button type="button" onclick="AppState.previewZoomLevel=100; App.refreshActiveStudioPreview(\'' + targetMode + '\')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-mono">' + (AppState.previewZoomLevel || 100) + '%</button>' +
      '      <button type="button" onclick="AppState.previewZoomLevel=Math.min(135,(AppState.previewZoomLevel||100)+15); App.refreshActiveStudioPreview(\'' + targetMode + '\')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-mono" title="تكبير العرض">🔍+</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="flex flex-wrap items-center gap-1">' +
      paperPills.map(function (p) {
        var isAct = curPaper === p.k || (p.k === 'a5' && curPaper === 'a5_portrait');
        return (
          '<button type="button" onclick="App.quickSetPaperFromToolbar(\'' + targetMode + '\', \'' + p.k + '\')" class="px-2.5 py-1 rounded-lg font-black transition ' + (isAct ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">' +
          p.lbl +
          '</button>'
        );
      }).join('') +
      '  </div>' +

      '  <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">' +
      '    <div class="flex items-center gap-1.5">' +
      '      <span class="text-slate-400 font-bold">🎨 اللون:</span>' +
      colors.map(function (c) {
        return '<button type="button" onclick="App.quickSetColorFromToolbar(\'' + targetMode + '\', \'' + c + '\')" style="background:' + c + ';width:18px;height:18px;border-radius:999px;border:' + (curColor === c ? '2.5px solid #fff' : '1px solid #475569') + ';"></button>';
      }).join('') +
      '    </div>' +
      (targetMode === 'bon'
        ? '<div class="flex items-center gap-1">' +
          '  <button type="button" onclick="AppState.customBonState.fields.push({label:\'خانة إضافية\',value:\'تفاصيل...\'}); App.renderPrintStudioView()" class="px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 hover:bg-blue-600 hover:text-white font-bold">+ خانة جديدة</button>' +
          '  <button type="button" onclick="AppState.customBonState.showItemsTable=true; AppState.customBonState.items.push({col1:\'خدمة / قطعة جديدة\',col2:\'1\',col3:\'1000.00\',col4:\'1000.00\'}); App.renderPrintStudioView()" class="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-white font-bold">+ سطر جدول</button>' +
          '  <button type="button" onclick="AppState.customBonState.showBarcode=!AppState.customBonState.showBarcode; App.refreshCustomBonPreview()" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold">📊 الباركود</button>' +
          '  <button type="button" onclick="AppState.customBonState.showCentimesTotal=!AppState.customBonState.showCentimesTotal; App.refreshCustomBonPreview()" class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">🇩🇿 السنتيم</button>' +
          '</div>'
        : '<div class="flex items-center gap-1">' +
          '  <button type="button" onclick="window.TemplateBuilder.updateProp(\'showCentimes\', !AppState.tdLayout.showCentimes)" class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">🇩🇿 السنتيم</button>' +
          '  <button type="button" onclick="window.TemplateBuilder.updateProp(\'showFiscal\', !AppState.tdLayout.showFiscal)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold">🏛️ الجباية</button>' +
          '  <button type="button" onclick="window.TemplateBuilder.updateProp(\'showDriverInfo\', !AppState.tdLayout.showDriverInfo)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold">🚚 السائق</button>' +
          '  <button type="button" onclick="window.TemplateBuilder.updateProp(\'showSignature\', !AppState.tdLayout.showSignature)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold">✍️ الختم</button>' +
          '</div>') +
      '  </div>' +
      '</div>'
    );
  }

  App.quickSetPaperFromToolbar = function (targetMode, paperKey) {
    if (targetMode === 'td') {
      AppState.tdLayout.paper = paperKey;
      window.TemplateBuilder.initTemplateBuilder('template-designer-root');
    } else {
      AppState.customBonState.paperMode = paperKey;
      this.renderPrintStudioView();
    }
    if (typeof showToast === 'function') {
      showToast('📏 تم تحويل مقاس الورقة والتخطيط فوراً إلى: ' + getPaperSpecs(paperKey).label, 'info');
    }
  };

  App.quickSetColorFromToolbar = function (targetMode, colorHex) {
    if (targetMode === 'td') {
      AppState.tdLayout.accentColor = colorHex;
      window.TemplateBuilder.initTemplateBuilder('template-designer-root');
    } else {
      AppState.customBonState.accentColor = colorHex;
      this.refreshCustomBonPreview();
    }
  };

  App.stepPreviewFontSize = function (targetMode, delta) {
    if (targetMode === 'td') {
      AppState.tdLayout.fontSize = Math.max(9, Math.min(18, Number(AppState.tdLayout.fontSize || 12) + delta));
      window.TemplateBuilder.refreshPreview();
    } else {
      AppState.customBonState.fontSize = Math.max(9, Math.min(18, Number(AppState.customBonState.fontSize || 11.5) + delta));
      this.refreshCustomBonPreview();
    }
  };

  App.refreshActiveStudioPreview = function (targetMode) {
    if (targetMode === 'td' && window.TemplateBuilder) {
      window.TemplateBuilder.initTemplateBuilder('template-designer-root');
    } else {
      this.renderPrintStudioView();
    }
  };

  // إعادة بناء window.TemplateBuilder بالكامل ليعمل بتناغم 100%
  window.TemplateBuilder = {
    getCurrentLayout: function () {
      return AppState.tdLayout;
    },

    initTemplateBuilder: async function (containerId) {
      var root = document.getElementById(containerId || 'template-designer-root');
      if (!root) return;

      if (window.api && window.api.getCustomTemplates) {
        savedCustomTemplatesCache = (await window.api.getCustomTemplates().catch(function () { return []; })) || [];
      }

      var cur = AppState.tdLayout;
      var cols = cur.columns || {};

      root.innerHTML =
        '<div class="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">' +
        '  <div class="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3.5 shadow-sm">' +
        '    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">' +
        '      <h3 class="font-black text-sm text-blue-600">🎨 مهندس قوالب الفواتير والأوراق الرسمية</h3>' +
        '      <div class="flex flex-wrap gap-1.5">' +
        '        <button type="button" onclick="window.TemplateBuilder.exportCurrentPdf()" class="px-2.5 py-1.5 bg-slate-800 text-white rounded-xl font-bold">📥 حفظ PDF</button>' +
        '        <button type="button" onclick="window.TemplateBuilder.printCurrentPreview()" class="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-black">🖨️ طباعة</button>' +
        '        <button type="button" onclick="window.TemplateBuilder.saveCurrent()" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow">💾 حفظ القالب</button>' +
        '      </div>' +
        '    </div>' +

        '    <div class="grid grid-cols-2 gap-2.5">' +
        '      <div><label class="block font-bold mb-1">اسم القالب *</label><input type="text" value="' + (cur.name || '') + '" oninput="window.TemplateBuilder.updateProp(\'name\', this.value)" class="w-full px-3 py-1.5 rounded-xl font-bold"></div>' +
        '      <div><label class="block font-bold mb-1">نوع المستند الرسمي (Doc Type)</label>' +
        '        <select onchange="window.TemplateBuilder.onDocTypeChange(this.value)" class="w-full px-2.5 py-1.5 rounded-xl font-bold">' +
        '          <option value="invoice" ' + (cur.doc_type === 'invoice' ? 'selected' : '') + '>🧾 فاتورة بيع (Facture)</option>' +
        '          <option value="receipt" ' + (cur.doc_type === 'receipt' ? 'selected' : '') + '>🎫 بون كاشير حراري (Ticket 80mm)</option>' +
        '          <option value="delivery" ' + (cur.doc_type === 'delivery' ? 'selected' : '') + '>🚚 بون تسليم وتوصيل (Bon de Livraison)</option>' +
        '          <option value="order" ' + (cur.doc_type === 'order' ? 'selected' : '') + '>📋 بون طلبية (Bon de Commande)</option>' +
        '          <option value="proforma" ' + (cur.doc_type === 'proforma' ? 'selected' : '') + '>📄 فاتورة شكلية (Proforma / Devis)</option>' +
        '          <option value="reception" ' + (cur.doc_type === 'reception' ? 'selected' : '') + '>📦 بون استلام بضاعة (Bon de Réception)</option>' +
        '          <option value="payment_receipt" ' + (cur.doc_type === 'payment_receipt' ? 'selected' : '') + '>💵 بون تسديد دفعة (Bon de Versement)</option>' +
        '        </select>' +
        '      </div>' +
        '      <div><label class="block font-bold mb-1 text-blue-600">مقاس وتخطيط الورقة *</label>' +
        '        <select id="tdPaperSelect" onchange="window.TemplateBuilder.updateProp(\'paper\', this.value, true)" class="w-full px-2.5 py-1.5 rounded-xl font-black text-blue-600 border-blue-500">' +
        '          <option value="a4" ' + (cur.paper === 'a4' ? 'selected' : '') + '>📄 A4 عمودي قياسي (210×297mm)</option>' +
        '          <option value="thermal80" ' + (cur.paper === 'thermal80' ? 'selected' : '') + '>🧾 تذكرة حرارية 80mm (عرض 80mm)</option>' +
        '          <option value="thermal58" ' + (cur.paper === 'thermal58' ? 'selected' : '') + '>🎫 تذكرة حرارية 58mm (عرض 58mm)</option>' +
        '          <option value="a4_dual_a5" ' + (cur.paper === 'a4_dual_a5' ? 'selected' : '') + '>🔥 2×A5 في ورقة A4 واحدة (نسخة زبون + أرشيف)</option>' +
        '          <option value="a5" ' + (cur.paper === 'a5' ? 'selected' : '') + '>📑 A5 نصفي عمودي (148×210mm)</option>' +
        '          <option value="a5_landscape" ' + (cur.paper === 'a5_landscape' ? 'selected' : '') + '>📐 A5 أفقي تجاري (Bon Commercial)</option>' +
        '          <option value="a4_landscape" ' + (cur.paper === 'a4_landscape' ? 'selected' : '') + '>🖼️ A4 أفقي عريض (Landscape)</option>' +
        '        </select>' +
        '      </div>' +
        '      <div class="grid grid-cols-2 gap-1.5">' +
        '        <div><label class="block font-bold mb-1">اللون الرئيسي</label><input type="color" value="' + (cur.accentColor || '#1d4ed8') + '" oninput="window.TemplateBuilder.updateProp(\'accentColor\', this.value)" class="w-full h-8 rounded-xl cursor-pointer"></div>' +
        '        <div><label class="block font-bold mb-1">حجم الخط</label><input type="number" min="9" max="18" value="' + (cur.fontSize || 12) + '" oninput="window.TemplateBuilder.updateProp(\'fontSize\', Number(this.value))" class="w-full px-2 py-1.5 rounded-xl font-mono text-center"></div>' +
        '      </div>' +
        '    </div>' +

        '    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1.5">' +
        '      <div class="font-black text-slate-600 dark:text-slate-300">أعمدة الجدول الظاهرة في الورقة:</div>' +
        '      <div class="grid grid-cols-4 gap-1.5 text-[11px] font-bold">' +
        '        <label class="flex items-center gap-1"><input type="checkbox" ' + (cols.index !== false ? 'checked' : '') + ' onchange="window.TemplateBuilder.toggleCol(\'index\', this.checked)"><span># الرقم</span></label>' +
        '        <label class="flex items-center gap-1"><input type="checkbox" ' + (cols.barcode ? 'checked' : '') + ' onchange="window.TemplateBuilder.toggleCol(\'barcode\', this.checked)"><span>الباركود</span></label>' +
        '        <label class="flex items-center gap-1"><input type="checkbox" ' + (cols.qty !== false ? 'checked' : '') + ' onchange="window.TemplateBuilder.toggleCol(\'qty\', this.checked)"><span>الكمية</span></label>' +
        '        <label class="flex items-center gap-1"><input type="checkbox" ' + (cols.unit ? 'checked' : '') + ' onchange="window.TemplateBuilder.toggleCol(\'unit\', this.checked)"><span>الوحدة</span></label>' +
        '        <label class="flex items-center gap-1"><input type="checkbox" ' + (cols.unitPrice !== false ? 'checked' : '') + ' onchange="window.TemplateBuilder.toggleCol(\'unitPrice\', this.checked)"><span>السعر</span></label>' +
        '        <label class="flex items-center gap-1"><input type="checkbox" ' + (cols.tva ? 'checked' : '') + ' onchange="window.TemplateBuilder.toggleCol(\'tva\', this.checked)"><span>TVA %</span></label>' +
        '        <label class="flex items-center gap-1 text-amber-600"><input type="checkbox" ' + (cols.centimes ? 'checked' : '') + ' onchange="window.TemplateBuilder.toggleCol(\'centimes\', this.checked)"><span>بالسنتيم</span></label>' +
        '      </div>' +
        '    </div>' +

        '    <div class="grid grid-cols-2 gap-1.5 text-[11px] font-bold pt-1">' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cur.showFiscal ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showFiscal\', this.checked)"><span>البيانات الجبائية (RC/NIF)</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer text-amber-600"><input type="checkbox" ' + (cur.showCentimes !== false ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showCentimes\', this.checked)"><span>إجمالي الفاتورة بالسنتيم</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cur.showOldDebt ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showOldDebt\', this.checked)"><span>الدين السابق والرصيد</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cur.showAmountInWords ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showAmountInWords\', this.checked)"><span>المبلغ بالحروف (التفقيط)</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cur.showDriverInfo ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showDriverInfo\', this.checked)"><span>بيانات السائق والمركبة</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cur.showSignature ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showSignature\', this.checked)"><span>خانات الختم والإمضاء</span></label>' +
        '    </div>' +

        '    <div class="grid grid-cols-2 gap-2">' +
        '      <div><label class="block font-bold mb-1">علامة مائية بالخلفية (Watermark)</label><input type="text" placeholder="مثال: خالص / PAYÉ" value="' + (cur.watermarkText || '') + '" oninput="window.TemplateBuilder.updateProp(\'watermarkText\', this.value)" class="w-full px-2.5 py-1.5 rounded-xl"></div>' +
        '      <div><label class="block font-bold mb-1">ملاحظة أسفل الورقة</label><input type="text" value="' + (cur.footerNote || '') + '" oninput="window.TemplateBuilder.updateProp(\'footerNote\', this.value)" class="w-full px-2.5 py-1.5 rounded-xl"></div>' +
        '    </div>' +

        '    <div class="pt-2 border-t border-slate-200 dark:border-slate-700">' +
        '      <div class="font-bold mb-1.5">القوالب المحفوظة في قاعدة البيانات (' + savedCustomTemplatesCache.length + ') — اضغط للتحميل الفوري:</div>' +
        '      <div class="flex flex-wrap gap-1.5">' +
        savedCustomTemplatesCache.map(function (t) {
          return (
            '<div class="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-300 dark:border-slate-600">' +
            '  <button type="button" onclick="window.TemplateBuilder.loadSaved(' + t.id + ')" class="px-2.5 py-1 hover:bg-blue-600 hover:text-white font-bold text-[11px] transition">' + t.name + ' <span class="font-mono text-[10px] text-blue-500">(' + (t.paper || 'a4') + ')</span></button>' +
            '  <button type="button" onclick="window.TemplateBuilder.deleteSaved(' + t.id + ')" class="px-1.5 py-1 text-rose-500 hover:bg-rose-500 hover:text-white font-black text-[10px]">✕</button>' +
            '</div>'
          );
        }).join('') +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '  <div class="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col shadow-sm">' +
        buildInteractivePreviewToolbarHtml('td') +
        '    <iframe id="td-preview-frame" class="w-full flex-1 min-h-[540px] border border-slate-700 rounded-2xl bg-slate-900 shadow-inner"></iframe>' +
        '  </div>' +
        '</div>';

      this.refreshPreview();
    },

    onDocTypeChange: function (newDocType) {
      AppState.tdLayout.doc_type = newDocType;
      // ذكاء تلقائي: إذا اختار بون كاشير (receipt) يتحول المقاس تلقائياً إلى تذكرة حرارية 80mm!
      if (newDocType === 'receipt') {
        AppState.tdLayout.paper = 'thermal80';
      } else if (newDocType === 'delivery') {
        AppState.tdLayout.showDriverInfo = true;
      } else if (AppState.tdLayout.paper === 'thermal80' || AppState.tdLayout.paper === 'thermal58') {
        AppState.tdLayout.paper = 'a4';
      }
      this.initTemplateBuilder('template-designer-root');
    },

    updateProp: function (key, val, redrawFull) {
      AppState.tdLayout[key] = val;
      if (redrawFull || key === 'paper') {
        this.initTemplateBuilder('template-designer-root');
      } else {
        this.refreshPreview();
      }
    },

    toggleCol: function (colKey, checked) {
      if (!AppState.tdLayout.columns) AppState.tdLayout.columns = {};
      AppState.tdLayout.columns[colKey] = Boolean(checked);
      this.refreshPreview();
    },

    refreshPreview: function () {
      var frame = document.getElementById('td-preview-frame');
      if (!frame || !window.TemplateRenderer) return;
      var html = window.TemplateRenderer.renderCustomTemplateHtml(
        AppState.tdLayout,
        AppState.tdSampleData,
        AppState.settings || {}
      );
      var doc = frame.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    },

    saveCurrent: async function () {
      if (!window.api || !window.api.saveCustomTemplate) return;
      var cur = AppState.tdLayout;
      await window.api.saveCustomTemplate({
        id: cur.id || undefined,
        name: cur.name || 'قالب مخصص',
        doc_type: cur.doc_type || 'invoice',
        paper: cur.paper || 'a4',
        lang: cur.lang || 'ar',
        layout_json: JSON.stringify(cur),
        is_default: 1
      });
      if (typeof showToast === 'function') {
        showToast('✅ تم حفظ القالب (' + cur.name + ') بمقاس (' + cur.paper + ') بنجاح!', 'success');
      }
      await this.initTemplateBuilder('template-designer-root');
    },

    loadSaved: async function (id) {
      var found = savedCustomTemplatesCache.find(function (x) { return Number(x.id) === Number(id); });
      if (!found) return;
      try {
        var parsed = JSON.parse(found.layout_json || '{}');
        AppState.tdLayout = Object.assign({}, AppState.tdLayout, parsed, {
          id: found.id,
          name: found.name,
          paper: found.paper || parsed.paper || 'a4',
          doc_type: found.doc_type || parsed.doc_type || 'invoice'
        });
        await this.initTemplateBuilder('template-designer-root');
        if (typeof showToast === 'function') {
          showToast('📂 تم تحميل القالب (' + found.name + ') بمقاس (' + AppState.tdLayout.paper + ')', 'info');
        }
      } catch (_) {}
    },

    deleteSaved: async function (id) {
      if (window.api && window.api.deleteCustomTemplate) {
        await window.api.deleteCustomTemplate(Number(id));
        await this.initTemplateBuilder('template-designer-root');
        if (typeof showToast === 'function') showToast('🗑️ تم حذف القالب المحفوظ', 'info');
      }
    },

    printCurrentPreview: async function () {
      var fallback = window.TemplateRenderer.renderCustomTemplateHtml(AppState.tdLayout, AppState.tdSampleData, AppState.settings || {});
      var html = extractPrintableHtmlFromIframe('td-preview-frame', fallback);
      if (window.PrintEngine) {
        await window.PrintEngine.printHtmlDocument(html, { silent: false });
      }
    },

    exportCurrentPdf: async function () {
      var fallback = window.TemplateRenderer.renderCustomTemplateHtml(AppState.tdLayout, AppState.tdSampleData, AppState.settings || {});
      var html = extractPrintableHtmlFromIframe('td-preview-frame', fallback);
      if (window.api && window.api.exportPDF) {
        var res = await window.api.exportPDF({
          html: html,
          filename: (AppState.tdLayout.name || 'Template') + '_' + (AppState.tdLayout.paper || 'a4') + '.pdf'
        });
        if (res && res.success && typeof showToast === 'function') {
          showToast('📄 تم حفظ ملف PDF بمقاس (' + AppState.tdLayout.paper + ') بنجاح!', 'success');
        }
      }
    }
  };

  // ==========================================================================
  // ج) ترقية منشئ البونات والأوراق الحر (buildCustomBonHtmlDocument) ليدعم 80mm/58mm الحقيقي والتعديل المباشر
  // ==========================================================================
  App.buildCustomBonHtmlDocument = async function () {
    var st = AppState.customBonState;
    var s = AppState.settings || {};
    var accent = st.accentColor || '#1d4ed8';
    var spec = getPaperSpecs(st.paperMode || 'a4_dual_a5');
    var userZoom = (Number(AppState.previewZoomLevel || 100) / 100) * spec.screenZoom;
    var fontSize = Number(st.fontSize || (spec.isThermal ? 11 : 11.5));

    var bcImg = '';
    if (st.showBarcode && st.bonNumber && window.api && window.api.generateBarcodeImage) {
      bcImg = await window.api.generateBarcodeImage(st.bonNumber, { bcid: 'code128', height: 9, scale: 2 }).catch(function () { return ''; });
    }

    var totalTableSum = (st.items || []).reduce(function (acc, it) {
      return acc + (parseFloat(it.col4) || 0);
    }, 0);
    var centimeSum = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalTableSum) : '';

    // ------------------------------------------------------------------------
    // 1) إذا اختار المستخدم (تذكرة حرارية 80mm أو 58mm) في منشئ البونات الحر!
    // ------------------------------------------------------------------------
    if (spec.isThermal) {
      var thermalFieldsHtml = (st.fields || []).map(function (f) {
        return (
          '<div style="padding:3px 0;border-bottom:1px dotted #cbd5e1;">' +
          '  <div contenteditable="true" style="font-size:9.5px;color:#475569;font-weight:bold;">' + (f.label || '') + ':</div>' +
          '  <div contenteditable="true" style="font-size:11px;font-weight:900;color:#000;">' + (f.value || '—') + '</div>' +
          '</div>'
        );
      }).join('');

      var thermalTableHtml = '';
      if (st.showItemsTable && st.items && st.items.length > 0) {
        var tRows = st.items.map(function (it, i) {
          return (
            '<tr>' +
            '<td contenteditable="true" style="font-weight:800;padding:3px 2px;">' + (i + 1) + '. ' + (it.col1 || '') + '</td>' +
            '<td contenteditable="true" style="text-align:center;font-family:monospace;font-weight:bold;">' + (it.col2 || '') + '</td>' +
            '<td contenteditable="true" style="text-align:center;font-family:monospace;">' + (it.col3 || '') + '</td>' +
            '<td contenteditable="true" style="text-align:left;font-family:monospace;font-weight:900;">' + (it.col4 || '') + '</td>' +
            '</tr>'
          );
        }).join('');

        thermalTableHtml =
          '<table style="width:100%;border-collapse:collapse;margin:5px 0;font-size:10px;">' +
          '<thead><tr style="background:' + accent + ';color:#fff;"><th style="padding:3px;">البيان</th><th style="padding:3px;">ك</th><th style="padding:3px;">السعر</th><th style="padding:3px;">المجموع</th></tr></thead>' +
          '<tbody>' + tRows + '</tbody></table>' +
          (totalTableSum > 0
            ? '<div style="padding:5px;border:1.5px solid #000;border-radius:6px;background:#f8fafc;margin:4px 0;text-align:center;">' +
              '  <div contenteditable="true" style="font-size:12.5px;font-weight:900;color:' + accent + ';">المجموع: <span style="font-family:monospace;">' + totalTableSum.toFixed(2) + ' د.ج</span></div>' +
              (st.showCentimesTotal ? '<div contenteditable="true" style="font-size:10px;font-weight:900;color:#b45309;">(' + centimeSum + ')</div>' : '') +
              '</div>'
            : '');
      }

      return (
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + (st.bonTitle || 'Bon Thermal') + '</title>' +
        '<link rel="stylesheet" href="./assets/css/fonts.css">' +
        '<style>' +
        spec.pageCss +
        '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
        'html,body{margin:0;padding:0;font-family:"Cairo",Tahoma,sans-serif;font-size:' + fontSize + 'px;color:#000;}' +
        '@media screen {' +
        '  html,body{background:#0f172a;padding:14px 0;display:flex;flex-direction:column;align-items:center;}' +
        '  .paper-sheet{width:' + spec.widthMm + 'mm;max-width:' + spec.widthMm + 'mm;background:#fff;padding:4mm 3.5mm;box-shadow:0 20px 45px rgba(0,0,0,0.55);border-top:5px dashed #cbd5e1;border-bottom:5px dashed #cbd5e1;zoom:' + Number(AppState.previewZoomLevel || 100) / 100 + ';}' +
        '  [contenteditable="true"]:hover{outline:1.5px dashed #3b82f6;background:#eff6ff;cursor:text;}' +
        '  [contenteditable="true"]:focus{outline:2px solid #2563eb;background:#fefce8;}' +
        '}' +
        '@media print {' +
        '  html,body{background:#fff !important;width:' + spec.widthMm + 'mm !important;margin:0 !important;padding:0 !important;}' +
        '  .paper-sheet{width:' + spec.widthMm + 'mm !important;max-width:' + spec.widthMm + 'mm !important;padding:2.5mm !important;margin:0 !important;box-shadow:none !important;border:none !important;zoom:1 !important;}' +
        '  .no-print-ui{display:none !important;}' +
        '}' +
        '.sep{border-top:1.5px dashed #000;margin:5px 0;}' +
        '</style></head><body>' +
        '<div class="no-print-ui" style="color:#38bdf8;font-size:11px;font-weight:900;margin-bottom:8px;text-align:center;">📏 معاينة حقيقية بمقاس ' + spec.label + ' — ✏️ انقر على أي نص داخل التذكرة لتعديله مباشرة!</div>' +
        '<div class="paper-sheet">' +
        '  <div style="text-align:center;">' +
        '    <div contenteditable="true" style="font-size:15px;font-weight:900;color:' + accent + ';">' + (s.shop_name || 'Gherbi.Ai POS') + '</div>' +
        '    <div contenteditable="true" style="font-size:10px;">' + (s.shop_address || 'الجزائر') + (s.shop_phone ? ' | ' + s.shop_phone : '') + '</div>' +
        '    <div contenteditable="true" style="margin-top:4px;padding:4px 6px;border:1.5px solid ' + accent + ';border-radius:6px;font-weight:900;font-size:11.5px;color:' + accent + ';">' + (st.bonTitle || 'بون رسمي') + '</div>' +
        '    <div contenteditable="true" style="font-size:9.5px;color:#475569;margin-top:2px;">' + (st.bonSubtitle || '') + '</div>' +
        '    <div contenteditable="true" style="font-family:monospace;font-size:10.5px;font-weight:900;margin-top:2px;">N°: ' + (st.bonNumber || 'BON-01') + ' | ' + (st.bonDate || '') + '</div>' +
        '  </div>' +
        '  <div class="sep"></div>' +
        '  <div style="padding:4px 6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:10.5px;">' +
        '    <div contenteditable="true"><strong>' + (st.partyLabel || 'الطرف المعني') + ':</strong> ' + (st.partyName || '—') + '</div>' +
        '    <div contenteditable="true"><strong>الهاتف:</strong> <span style="font-family:monospace;">' + (st.partyPhone || '—') + '</span></div>' +
        '  </div>' +
        '  <div style="margin:4px 0;">' + thermalFieldsHtml + '</div>' +
        thermalTableHtml +
        (st.bodyParagraph ? '<div contenteditable="true" style="padding:5px 7px;background:#f8fafc;border-right:3px solid ' + accent + ';font-size:9.5px;font-weight:bold;line-height:1.4;margin:5px 0;">' + st.bodyParagraph + '</div>' : '') +
        '  <div class="sep"></div>' +
        (bcImg ? '<div style="text-align:center;margin:4px 0;"><img src="' + bcImg + '" style="max-width:90%;height:9mm;object-fit:contain;"><div style="font-family:monospace;font-size:9px;">' + st.bonNumber + '</div></div>' : '') +
        '  <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:9.5px;font-weight:800;">' +
        '    <div contenteditable="true">' + (st.sigLeftLabel || 'إمضاء الزبون') + '<br>................</div>' +
        '    <div contenteditable="true">' + (st.sigRightLabel || 'ختم المتجر') + '<br>................</div>' +
        '  </div>' +
        '</div></body></html>'
      );
    }

    // ------------------------------------------------------------------------
    // 2) إذا اختار المستخدم (A4 أو A5 أو A5 Landscape أو 2×A5 في ورقة A4 واحدة)
    // ------------------------------------------------------------------------
    var fieldsGridHtml = (st.fields || []).map(function (f) {
      return (
        '<div style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">' +
        '  <div contenteditable="true" style="font-size:10px;color:#64748b;font-weight:bold;">' + (f.label || '') + ':</div>' +
        '  <div contenteditable="true" style="font-size:11.5px;font-weight:900;color:#0f172a;margin-top:2px;">' + (f.value || '—') + '</div>' +
        '</div>'
      );
    }).join('');

    var tableHtml = '';
    if (st.showItemsTable && st.items && st.items.length > 0) {
      var ths = (st.tableHeaders || ['البيان', 'الكمية', 'السعر', 'المجموع']).map(function (h) {
        return '<th contenteditable="true" style="background:' + accent + ';color:#fff;padding:6px;border:1px solid ' + accent + ';">' + h + '</th>';
      }).join('');
      var trs = st.items.map(function (it, i) {
        return (
          '<tr>' +
          '<td contenteditable="true" style="border:1px solid #cbd5e1;padding:5px 6px;font-weight:bold;">' + (i + 1) + '. ' + (it.col1 || '') + '</td>' +
          '<td contenteditable="true" style="border:1px solid #cbd5e1;padding:5px 6px;text-align:center;font-family:monospace;font-weight:bold;">' + (it.col2 || '') + '</td>' +
          '<td contenteditable="true" style="border:1px solid #cbd5e1;padding:5px 6px;text-align:center;font-family:monospace;">' + (it.col3 || '') + '</td>' +
          '<td contenteditable="true" style="border:1px solid #cbd5e1;padding:5px 6px;text-align:center;font-family:monospace;font-weight:900;">' + (it.col4 || '') + '</td>' +
          '</tr>'
        );
      }).join('');

      tableHtml =
        '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:11px;">' +
        '<thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>' +
        (totalTableSum > 0
          ? '<div style="display:flex;justify-content:flex-end;margin-bottom:6px;">' +
            '  <div contenteditable="true" style="padding:5px 12px;border-radius:8px;background:' + accent + ';color:#fff;font-weight:900;font-size:12px;">' +
            '    المجموع: <span style="font-family:monospace;">' + totalTableSum.toFixed(2) + ' د.ج</span>' +
            (st.showCentimesTotal ? ' <span style="font-size:10.5px;color:#fde68a;">(' + centimeSum + ')</span>' : '') +
            '  </div>' +
            '</div>'
          : '');
    }

    var renderOneBonCopy = function (copyTitle) {
      return (
        '<div style="border:2px solid ' + accent + ';border-radius:12px;padding:12px;background:#fff;">' +
        '  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid ' + accent + ';padding-bottom:6px;margin-bottom:8px;">' +
        '    <div>' +
        '      <div contenteditable="true" style="font-size:17px;font-weight:900;color:' + accent + ';">' + (s.shop_name || 'Gherbi.Ai POS') + '</div>' +
        '      <div contenteditable="true" style="font-size:10.5px;color:#475569;">' + (s.shop_address || 'الجزائر') + (s.shop_phone ? ' | هاتف: ' + s.shop_phone : '') + '</div>' +
        '    </div>' +
        '    <div style="text-align:left;">' +
        (copyTitle ? '<div style="display:inline-block;padding:1px 7px;background:#e2e8f0;border-radius:4px;font-size:9.5px;font-weight:900;margin-bottom:2px;">' + copyTitle + '</div>' : '') +
        '      <div contenteditable="true" style="font-size:14.5px;font-weight:900;color:' + accent + ';">' + (st.bonTitle || 'بون رسمي') + '</div>' +
        '      <div contenteditable="true" style="font-size:10px;color:#64748b;font-weight:bold;">' + (st.bonSubtitle || '') + '</div>' +
        '      <div contenteditable="true" style="font-family:monospace;font-size:10.5px;font-weight:900;margin-top:2px;">N°: ' + (st.bonNumber || 'BON-01') + ' | التاريخ: ' + (st.bonDate || '') + '</div>' +
        '    </div>' +
        '  </div>' +

        '  <div style="padding:6px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;font-size:11px;">' +
        '    <div contenteditable="true"><strong>' + (st.partyLabel || 'الطرف المعني') + ':</strong> ' + (st.partyName || '—') + '</div>' +
        '    <div contenteditable="true"><strong>رقم الهاتف:</strong> <span style="font-family:monospace;">' + (st.partyPhone || '—') + '</span></div>' +
        '  </div>' +

        '  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px;">' + fieldsGridHtml + '</div>' +
        tableHtml +
        (st.bodyParagraph ? '<div contenteditable="true" style="padding:6px 10px;background:#f8fafc;border-right:4px solid ' + accent + ';font-size:10px;font-weight:bold;line-height:1.45;margin:6px 0;">' + st.bodyParagraph + '</div>' : '') +

        '  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px;padding-top:6px;border-top:1px dashed #cbd5e1;font-size:10.5px;font-weight:800;">' +
        '    <div contenteditable="true">' + (st.sigLeftLabel || 'إمضاء المستلم / الزبون') + '<br><br>........................</div>' +
        (bcImg ? '<div style="text-align:center;"><img src="' + bcImg + '" style="height:9mm;object-fit:contain;"><div style="font-family:monospace;font-size:8.5px;">' + st.bonNumber + '</div></div>' : '') +
        '    <div contenteditable="true">' + (st.sigRightLabel || 'ختم وإمضاء المتجر') + '<br><br>........................</div>' +
        '  </div>' +
        '</div>'
      );
    };

    var fullBody = spec.isDualA5
      ? '<div style="display:flex;flex-direction:column;justify-content:space-between;gap:4mm;">' +
        renderOneBonCopy('نسخة الزبون / المستلم (Exemplaire 1/2)') +
        '<div style="border-top:2px dashed #64748b;text-align:center;font-size:10px;color:#64748b;padding:2px 0;">✂️ خط القص — (نسختان 2×A5 في ورقة A4 واحدة) ✂️</div>' +
        renderOneBonCopy('نسخة المحل / الأرشيف (Exemplaire 2/2)') +
        '</div>'
      : renderOneBonCopy('');

    return (
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + (st.bonTitle || 'Bon') + '</title>' +
      '<link rel="stylesheet" href="./assets/css/fonts.css">' +
      '<style>' +
      spec.pageCss +
      '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
      'html,body{margin:0;padding:0;font-family:"Cairo",Tahoma,sans-serif;font-size:' + fontSize + 'px;color:#0f172a;}' +
      '@media screen {' +
      '  html,body{background:#0f172a;padding:14px 0;display:flex;flex-direction:column;align-items:center;}' +
      '  .paper-sheet{width:' + spec.screenWidthPx + 'px;min-height:' + spec.screenMinHeightPx + 'px;background:#fff;padding:14px;border-radius:6px;box-shadow:0 20px 50px rgba(0,0,0,0.55);zoom:' + userZoom.toFixed(2) + ';}' +
      '  [contenteditable="true"]:hover{outline:1.5px dashed #3b82f6;background:#eff6ff;cursor:text;border-radius:3px;}' +
      '  [contenteditable="true"]:focus{outline:2px solid #2563eb;background:#fefce8;border-radius:3px;}' +
      '}' +
      '@media print {' +
      '  html,body{background:#fff !important;margin:0 !important;padding:0 !important;}' +
      '  .paper-sheet{width:100% !important;padding:6mm !important;margin:0 !important;box-shadow:none !important;zoom:1 !important;}' +
      '  .no-print-ui{display:none !important;}' +
      '}' +
      '</style></head><body>' +
      '<div class="no-print-ui" style="color:#38bdf8;font-size:12px;font-weight:900;margin-bottom:8px;text-align:center;">📏 معاينة حقيقية بمقاس: ' + spec.label + ' — ✏️ انقر على أي نص داخل الورقة لتعديله مباشرة!</div>' +
      '<div class="paper-sheet">' + fullBody + '</div></body></html>'
    );
  };

  // تحديث دالة طباعة وحفظ البون الحر لتأخذ أي تعديل مباشر قام به المستخدم داخل المعاينة الحية!
  App.printCustomBonNow = async function (asPdf) {
    var fallback = await this.buildCustomBonHtmlDocument();
    var html = extractPrintableHtmlFromIframe('customBonLiveFrame', fallback);

    if (asPdf && window.api && window.api.exportPDF) {
      var res = await window.api.exportPDF({
        html: html,
        filename: (AppState.customBonState.bonNumber || 'Custom_Bon') + '_' + (AppState.customBonState.paperMode || '80mm') + '.pdf'
      });
      if (res && res.success && typeof showToast === 'function') {
        showToast('📄 تم تصدير البون المخصص بصيغة PDF وبالمقاس المحدد بنجاح!', 'success');
      }
      return;
    }
    if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // حقن شريط الأدوات التفاعلي فوق معاينة البون الحر وتصحيح لون التبويب الأول
  var _prevRenderPrintStudio = App.renderPrintStudioView.bind(App);
  App.renderPrintStudioView = async function () {
    await _prevRenderPrintStudio();

    // ضمان وضوح أزرار التبويبات الـ 4 في الوضع النهاري والليلي
    var navBtns = document.querySelectorAll('#print-view-root .bg-slate-900 button');
    navBtns.forEach(function (btn) {
      if (btn.className.includes('text-slate-300')) {
        btn.style.color = '#38bdf8';
      }
    });

    // إضافة شريط التحكم المباشر فوق معاينة البون الحر في التبويب الثالث
    if (AppState.printStudioTab === 'custom_bon') {
      var bonFrame = document.getElementById('customBonLiveFrame');
      if (bonFrame && bonFrame.parentElement && !bonFrame.parentElement.querySelector('.bon-live-toolbar')) {
        var tbWrapper = document.createElement('div');
        tbWrapper.className = 'bon-live-toolbar';
        tbWrapper.innerHTML = buildInteractivePreviewToolbarHtml('bon');
        bonFrame.parentElement.insertBefore(tbWrapper, bonFrame);
        bonFrame.className = 'w-full flex-1 min-h-[540px] border border-slate-700 rounded-2xl bg-slate-900 shadow-inner';
      }
    }
  };
}

// ============================================================================
// 3. حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [LIVE PAPER CANVAS, TRUE 80MM PDF & INTERACTIVE PREVIEW STUDIO]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installLivePaperCanvasAndInteractivePreview.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن محرك مقاسات الورق الحقيقية (80mm / 58mm / A5 / 2xA5 / A4) والتعديل المباشر من المعاينة في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page8-print-studio-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 3/3: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتمل الإصلاح! أعد تشغيل البرنامج (أو اضغط Ctrl+R) وجرّب اختيار (تذكرة حرارية 80mm) والضغط مباشرة فوق نصوص الورقة في المعاينة الحية!');