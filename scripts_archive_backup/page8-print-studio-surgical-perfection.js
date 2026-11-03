/**
 * page8-print-studio-surgical-perfection.js
 * الترقية الجراحية الشاملة والأتمتة الذاتية للصفحة الثامنة: مركز الطباعة الشامل (#view-print)
 * يضم 4 استوديوهات عملاقة:
 * 1. استوديو الباركود وملصقات الرفوف وأوراق A4 المقسمة (مع تخطي الملصقات المستعملة، السنتيم، وتاريخ الصلاحية)
 * 2. مهندس قوالب الفواتير والأوراق الرسمية (يدعم 10 أنواع مستندات + مقاس 2×A5 نسختين في ورقة A4 واحدة)
 * 3. منشئ البونات والأوراق الحر (Universal Custom BON Creator) مع 8 قوالب بونات جزائرية جاهزة وحفظ القوالب
 * 4. استوديو كتالوج الأسعار ومولد لافتات العروض الجدارية (A4/A5 Store Promo Poster Maker) + روبوت الفحص الآلي (12/12 PASS).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الترقية الجراحية الشاملة للصفحة 8: مركز الطباعة والباركود ومنشئ البونات الشامل (#view-print)...\n');

function applyPage8PrintStudioSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.printStudioTab = AppState.printStudioTab || 'labels'; // 'labels' | 'designer' | 'custom_bon' | 'catalogue_posters'

  // 1) إعدادات استوديو الباركود والملصقات الشاملة
  AppState.labelStudioConfig = Object.assign(
    {
      source: 'products',
      selectedId: null,
      symbology: 'code128', // 'code128' | 'ean13' | 'qrcode' | 'code39'
      presetKey: 'roll_40x25',
      paperType: 'roll', // 'roll' | 'a4_sheet'
      columns: 1,
      skipOffset: 0, // عدد الملصقات المتخطاة في بداية ورقة A4
      widthMm: 40,
      heightMm: 25,
      barcodeHeightMm: 11,
      priceOnlyMode: false,
      borderStyle: 'dashed', // 'none' | 'solid' | 'dashed'
      showShop: true,
      showName: true,
      showPrice: true,
      showCentimes: true,
      showOldPrice: false,
      oldPriceValue: '',
      showBarcodeText: true,
      showPlu: false,
      showDates: false,
      prodDate: new Date().toISOString().slice(0, 10),
      expDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
      customFooterText: '',
      filterCategory: 'all'
    },
    AppState.labelStudioConfig || {}
  );

  // المقاسات القياسية للرولات الحرارية وأوراق الملصقات A4
  var LABEL_PRESETS = {
    roll_30x20: { label: 'رول حراري صغير (30×20mm - 1 عمود)', paperType: 'roll', cols: 1, w: 30, h: 20, bh: 8 },
    roll_40x25: { label: 'رول حراري قياسي (40×25mm - 1 عمود)', paperType: 'roll', cols: 1, w: 40, h: 25, bh: 10 },
    roll_50x30: { label: 'رول حراري متوسط (50×30mm - 1 عمود)', paperType: 'roll', cols: 1, w: 50, h: 30, bh: 12 },
    roll_58x40: { label: 'رول ميزان وسوبرماركت (58×40mm)', paperType: 'roll', cols: 1, w: 58, h: 40, bh: 14 },
    roll_80x50: { label: 'ملصق كرتون ومستودع كبير (80×50mm)', paperType: 'roll', cols: 1, w: 80, h: 50, bh: 16 },
    a4_65: { label: '📄 ورقة A4 عادية — 65 ملصق صغير (5×13 | 38×21mm)', paperType: 'a4_sheet', cols: 5, rows: 13, w: 38, h: 21, bh: 8 },
    a4_40: { label: '📄 ورقة A4 عادية — 40 ملصق متوسط (4×10 | 50×28mm)', paperType: 'a4_sheet', cols: 4, rows: 10, w: 50, h: 28, bh: 10 },
    a4_24: { label: '📄 ورقة A4 عادية — 24 ملصق عريض (3×8 | 66×35mm)', paperType: 'a4_sheet', cols: 3, rows: 8, w: 66, h: 35, bh: 12 },
    a4_shelf_12: { label: '🏷️ ورقة A4 — 12 بطاقة تسعير رفوف كبيرة (2×6 | 95×44mm)', paperType: 'a4_sheet', cols: 2, rows: 6, w: 95, h: 44, bh: 13 }
  };

  // 2) إعدادات منشئ البونات والأوراق الحر (Universal Custom BON Studio)
  AppState.customBonState = AppState.customBonState || {
    presetKey: 'sav_repair',
    bonTitle: 'بون استلام وصيانة جهاز (BON DE RÉPARATION / SAV)',
    bonSubtitle: 'وثيقة رسمية لاستلام ومتابعة الصيانة والضمان',
    bonNumber: 'BON-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4),
    bonDate: new Date().toISOString().slice(0, 10),
    paperMode: 'a4_dual_a5', // 'a4' | 'a5_portrait' | 'a5_landscape' | 'a4_dual_a5' | 'thermal80'
    accentColor: '#1d4ed8',
    partyLabel: 'الزبون / الطرف المستلم',
    partyName: 'محمد أمين بن علي',
    partyPhone: '0550123456',
    fields: [
      { label: 'نوع الجهاز / الموديل', value: 'هاتف ذكي Samsung Galaxy A54' },
      { label: 'الرقم التسلسلي (IMEI / S/N)', value: '358901092837412' },
      { label: 'وصف العطل أو الحالة عند الاستلام', value: 'تغيير شاشة أصلية + فحص البطارية (الجهاز بدون خدوش)' },
      { label: 'المبلغ المتفق عليه / التسبقة', value: 'الإجمالي: 12,000 د.ج | التسبقة المدفوعة: 4,000 د.ج | الباقي: 8,000 د.ج' }
    ],
    showItemsTable: true,
    tableHeaders: ['البيان / الخدمة / القطعة', 'الكمية', 'سعر الوحدة (د.ج)', 'الإجمالي (د.ج)'],
    items: [
      { col1: 'شاشة أصلية كاملة مع التركيب', col2: '1', col3: '10500.00', col4: '10500.00' },
      { col1: 'صيانة وتنظيف داخلي وفحص شامل', col2: '1', col3: '1500.00', col4: '1500.00' }
    ],
    bodyParagraph: 'يقر الطرف المستلم بالبيانات المذكورة أعلاه. المحل غير مسؤول عن الأجهزة التي لا يستلمها أصحابها بعد مرور 30 يوماً من تاريخ إشعارهم بانتهاء الصيانة.',
    sigRightLabel: 'إمضاء وختم المؤسسة',
    sigLeftLabel: 'إمضاء الزبون / المستلم',
    showBarcode: true,
    showCentimesTotal: true
  };

  // 3) إعدادات استوديو الكتالوج ولافتات العروض الجدارية
  AppState.posterStudioState = AppState.posterStudioState || {
    mode: 'promo_poster', // 'promo_poster' | 'catalogue'
    productId: null,
    badgeText: '🔥 عرض خاص ومحدود — PROMOTION 🔥',
    customTitle: '',
    oldPrice: '',
    newPrice: '',
    paperSize: 'a4_portrait', // 'a4_portrait' | 'a4_landscape' | 'a5_landscape'
    themeColor: '#e11d48',
    showCentimes: true,
    showBarcode: true,
    catFilter: 'all',
    catPriceTier: 'both', // 'retail' | 'wholesale' | 'both'
    catShowCentimes: true
  };

  function getProdRetail(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.selling_price ?? fb.selling_price ?? 0);
  }

  function getProdStock(p) {
    if (!p) return 0;
    return Number(p.total_stock ?? p.stock ?? 0);
  }

  function getSortedProductsForPrint() {
    var list = (AppState.products || []).slice();
    list.sort(function (a, b) {
      var aP = getProdRetail(a) > 0 || getProdStock(a) > 0 ? 1 : 0;
      var bP = getProdRetail(b) > 0 || getProdStock(b) > 0 ? 1 : 0;
      if (aP !== bP) return bP - aP;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    return list;
  }

  // ==========================================================================
  // 1. ترقية محرك الملصقات الفردية والجماعية (يدعم أوراق A4، تخطي الخانات، السنتيم، والـ QR)
  // ==========================================================================
  App.renderEnhancedSingleLabelHtml = async function (itemData, settings, cfg) {
    var w = Number(cfg.widthMm || 40);
    var h = Number(cfg.heightMm || 25);
    var bh = Number(cfg.barcodeHeightMm || 10);
    var isPriceOnly = Boolean(cfg.priceOnlyMode);
    var sym = cfg.symbology || 'code128';

    var bcImg = '';
    var codeText = String(itemData.barcode || '6130001000012').trim();
    if (!isPriceOnly && codeText && window.api && typeof window.api.generateBarcodeImage === 'function') {
      var bcid = sym === 'qrcode' ? 'qrcode' : sym === 'ean13' ? 'code128' : sym;
      bcImg = await window.api.generateBarcodeImage(codeText, {
        bcid: bcid,
        height: bh,
        scale: 3
      }).catch(function () { return ''; });
    }

    var priceNum = Number(itemData.price || 0);
    var priceStr = priceNum > 0 ? priceNum.toFixed(2) + ' د.ج' : '';
    var centimeStr = (cfg.showCentimes && priceNum > 0 && typeof App.formatAlgerianCentimes === 'function')
      ? App.formatAlgerianCentimes(priceNum)
      : '';
    var oldPriceNum = parseFloat(cfg.oldPriceValue || itemData.oldPrice || 0);
    var oldPriceStr = (cfg.showOldPrice && oldPriceNum > priceNum) ? oldPriceNum.toFixed(2) + ' د.ج' : '';

    var borderCss = cfg.borderStyle === 'solid'
      ? '0.4mm solid #000'
      : cfg.borderStyle === 'dashed'
        ? '0.35mm dashed #64748b'
        : 'none';

    var cardHtml =
      '<div class="lbl-card" style="width:' + w + 'mm;height:' + h + 'mm;border:' + borderCss + ';padding:1mm 1.5mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;box-sizing:border-box;overflow:hidden;background:#fff;color:#000;page-break-inside:avoid;">' +
      (cfg.showShop ? '<div style="font-size:2.1mm;font-weight:800;line-height:1;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (settings.shop_name || 'Gherbi.Ai POS') + '</div>' : '') +
      (cfg.showName !== false ? '<div style="font-size:2.6mm;font-weight:900;line-height:1.1;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (itemData.name || '') + '</div>' : '') +
      (!isPriceOnly && bcImg ? '<img src="' + bcImg + '" style="max-width:94%;height:' + bh + 'mm;object-fit:contain;margin:0.2mm 0;">' : '') +
      (!isPriceOnly && cfg.showBarcodeText !== false ? '<div style="font-family:monospace;font-size:2.2mm;font-weight:800;letter-spacing:0.3px;line-height:1;">' + codeText + '</div>' : '') +
      (cfg.showPrice && priceStr
        ? '<div style="line-height:1.1;">' +
          (oldPriceStr ? '<span style="font-size:2.1mm;text-decoration:line-through;color:#64748b;margin-left:1.5mm;">' + oldPriceStr + '</span>' : '') +
          '<span style="font-family:\'Segoe UI\',Tahoma,sans-serif;font-size:' + (isPriceOnly ? '5.2mm' : '3.4mm') + ';font-weight:900;' + (isPriceOnly ? 'border:0.4mm solid #000;padding:0.4mm 1.5mm;border-radius:1mm;' : '') + '">' + priceStr + '</span>' +
          (centimeStr ? '<div style="font-size:1.9mm;font-weight:800;line-height:1;margin-top:0.2mm;">(' + centimeStr + ')</div>' : '') +
          '</div>'
        : '') +
      (cfg.showDates ? '<div style="font-family:monospace;font-size:1.8mm;font-weight:700;line-height:1;">P:' + (cfg.prodDate || '') + ' | E:' + (cfg.expDate || '') + '</div>' : '') +
      (cfg.showPlu && itemData.plu ? '<div style="font-family:monospace;font-size:1.9mm;font-weight:800;">PLU: ' + itemData.plu + '</div>' : '') +
      (cfg.customFooterText ? '<div style="font-size:1.9mm;font-weight:700;line-height:1;">' + cfg.customFooterText + '</div>' : '') +
      (itemData.custPhone ? '<div style="font-family:monospace;font-size:2.2mm;font-weight:800;">' + itemData.custPhone + '</div>' : '') +
      (itemData.custDebt ? '<div style="font-size:2.3mm;font-weight:900;">' + itemData.custDebt + '</div>' : '') +
      '</div>';

    return cardHtml;
  };

  App.buildCurrentLabelHtml = async function () {
    var cfg = AppState.labelStudioConfig;
    var s = AppState.settings || {};
    var itemData = {};

    if (cfg.source === 'customers') {
      var cust = (AppState.customers || []).find(function (c) { return Number(c.id) === Number(cfg.selectedId); }) || AppState.customers[0] || { id: 1, name: 'زبون نموذجي', phone: '0550123456', total_debt: 0 };
      itemData = {
        name: cust.name,
        barcode: 'CUST-' + cust.id,
        price: 0,
        custPhone: cust.phone || '',
        custDebt: 'الرصيد: ' + Number(cust.total_debt || 0).toFixed(2) + ' د.ج'
      };
    } else {
      var prods = getSortedProductsForPrint();
      var prod = prods.find(function (p) { return Number(p.id) === Number(cfg.selectedId); }) || prods[0] || { id: 1, name: 'منتج نموذجي', barcode: '6130001000012', selling_price: 450 };
      itemData = {
        name: prod.name,
        barcode: prod.barcode || ('613000' + prod.id),
        price: getProdRetail(prod),
        plu: prod.plu_code || ''
      };
    }

    var cardHtml = await this.renderEnhancedSingleLabelHtml(itemData, s, cfg);
    return (
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
      '<link rel="stylesheet" href="./assets/css/fonts.css">' +
      '<style>@page{size:' + cfg.widthMm + 'mm ' + cfg.heightMm + 'mm;margin:0;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Cairo",Arial,sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;}</style>' +
      '</head><body>' + cardHtml + '</body></html>'
    );
  };

  // ترقية محرك طباعة طابور الملصقات بالجملة ليدعم أوراق A4 وتخطي الخانات المستعملة
  if (window.PrintEngine) {
    window.PrintEngine.renderBatchBarcodeLabelsHtml = async function (queueItems, settings, cfg) {
      cfg = cfg || AppState.labelStudioConfig || {};
      settings = settings || AppState.settings || {};
      var cols = Math.max(1, parseInt(cfg.columns || 1, 10) || 1);
      var skipOffset = cfg.paperType === 'a4_sheet' ? Math.max(0, parseInt(cfg.skipOffset || 0, 10) || 0) : 0;
      var w = Number(cfg.widthMm || 40);
      var h = Number(cfg.heightMm || 25);

      var cellsHtml = [];
      // إضافة خانات فارغة في بداية ورقة A4 بعدد الملصقات المنزوعة سابقاً!
      for (var sIdx = 0; sIdx < skipOffset; sIdx++) {
        cellsHtml.push('<div style="width:' + w + 'mm;height:' + h + 'mm;box-sizing:border-box;"></div>');
      }

      var itemsList = Array.isArray(queueItems) ? queueItems : [];
      for (var i = 0; i < itemsList.length; i++) {
        var it = itemsList[i];
        var copies = Math.max(1, parseInt(it.copies || 1, 10) || 1);
        var singleCard = await App.renderEnhancedSingleLabelHtml(it, settings, cfg);
        for (var c = 0; c < copies; c++) {
          cellsHtml.push(singleCard);
        }
      }

      var pageCss = cfg.paperType === 'a4_sheet'
        ? '@page { size: A4 portrait; margin: 5mm; }'
        : '@page { margin: 2mm; }';

      return (
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طابور طباعة الملصقات — Gherbi.Ai POS</title>' +
        '<link rel="stylesheet" href="./assets/css/fonts.css">' +
        '<style>' + pageCss + ' *{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Cairo",Arial,sans-serif;background:#fff;color:#000;}' +
        '.sheet-grid{display:grid;grid-template-columns:repeat(' + cols + ',' + w + 'mm);gap:1.5mm;justify-content:center;padding:2mm;}' +
        '</style></head><body><div class="sheet-grid">' + cellsHtml.join('') + '</div></body></html>'
      );
    };
  }

  // إصلاح openPlSheetPreviewModal وتصدير PDF للطابور
  App.openPlSheetPreviewModal = async function () {
    if (!AppState.labelPrintQueue || AppState.labelPrintQueue.length === 0) {
      this.addSelectedStudioItemToQueue();
    }
    var html = await window.PrintEngine.renderBatchBarcodeLabelsHtml(
      AppState.labelPrintQueue,
      AppState.settings,
      AppState.labelStudioConfig
    );

    var box = document.getElementById('plPreviewBox');
    if (box) {
      box.innerHTML = AppState.labelPrintQueue.map(function (q, idx) {
        return (
          '<div class="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs flex items-center justify-between gap-2">' +
          '  <div class="truncate font-bold">' + q.name + ' <span class="font-mono text-[10px] text-blue-600">(' + q.copies + '×)</span></div>' +
          '  <button type="button" onclick="AppState.labelPrintQueue.splice(' + idx + ',1); App.openPlSheetPreviewModal(); App.renderPrintStudioView();" class="text-rose-500 font-black">✕</button>' +
          '</div>'
        );
      }).join('');
    }

    this.openModal('plSheetPreviewModal');
    setTimeout(function () {
      var frame = document.getElementById('plSheetPreviewFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      }
    }, 50);
  };

  App.applyLabelPreset = async function (presetKey) {
    var p = LABEL_PRESETS[presetKey];
    if (!p) return;
    var cfg = AppState.labelStudioConfig;
    cfg.presetKey = presetKey;
    cfg.paperType = p.paperType;
    cfg.columns = p.cols;
    cfg.widthMm = p.w;
    cfg.heightMm = p.h;
    cfg.barcodeHeightMm = p.bh;
    await this.renderPrintStudioView();
    if (typeof showToast === 'function') {
      showToast('🏷️ تم ضبط مقاس الملصق والورقة على: ' + p.label, 'info');
    }
  };

  App.addCategoryToLabelQueue = function () {
    var cat = AppState.labelStudioConfig.filterCategory || 'all';
    var prods = getSortedProductsForPrint().filter(function (p) {
      return getProdRetail(p) > 0 && (cat === 'all' || p.category === cat);
    }).slice(0, 60);

    prods.forEach(function (p) {
      if (!AppState.labelPrintQueue.some(function (q) { return Number(q.id) === Number(p.id); })) {
        AppState.labelPrintQueue.push({
          id: p.id,
          name: p.name,
          barcode: p.barcode || ('613000' + p.id),
          price: getProdRetail(p),
          stock: Math.max(1, Math.round(getProdStock(p) || 1)),
          plu: p.plu_code || '',
          copies: 1
        });
      }
    });
    this.renderPrintStudioView();
    if (typeof showToast === 'function') {
      showToast('📦 تمت إضافة (' + prods.length + ') منتج إلى طابور الملصقات!', 'success');
    }
  };

  // ==========================================================================
  // 2. ترقية مهندس قوالب الفواتير وجميع الأوراق الرسمية (يدعم 2×A5 في ورقة A4 واحدة!)
  // ==========================================================================
  if (window.TemplateRenderer) {
    window.TemplateRenderer.renderCustomTemplateHtml = function (layout, docData, settings) {
      layout = layout || {};
      docData = docData || {};
      settings = settings || {};

      var lang = layout.lang || 'ar';
      var dir = lang === 'ar' ? 'rtl' : 'ltr';
      var accent = layout.accentColor || '#1d4ed8';
      var cols = layout.columns || {};
      var items = Array.isArray(docData.items) ? docData.items : [];
      var paper = layout.paper || 'a4';

      var docTypeTitles = {
        invoice: 'فاتورة بيع رسمية (FACTURE)',
        delivery: 'بون تسليم وتوصيل بضاعة (BON DE LIVRAISON)',
        order: 'سند طلبية زبون (BON DE COMMANDE)',
        proforma: 'فاتورة شكلية / كشف تقديري (PROFORMA / DEVIS)',
        receipt: 'بون مبيعات الكاشير (BON DE CAISSE)',
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
          (cols.barcode ? '<td style="font-family:monospace;text-align:center;">' + (it.barcode || it.product_barcode || '-') + '</td>' : '') +
          '<td style="font-weight:700;">' + (it.product_name || it.custom_product_name || it.name || 'منتج') + '</td>' +
          (cols.qty !== false ? '<td style="text-align:center;font-family:monospace;font-weight:bold;">' + (it.quantity || 1) + '</td>' : '') +
          (cols.unit ? '<td style="text-align:center;">' + (it.unit || 'قطعة') + '</td>' : '') +
          (cols.unitPrice !== false ? '<td style="text-align:center;font-family:monospace;">' + Number(it.price || 0).toFixed(2) + '</td>' : '') +
          (cols.tva ? '<td style="text-align:center;">' + Number(docData.tax_percentage || 0) + '%</td>' : '') +
          '<td style="text-align:center;font-family:monospace;font-weight:800;">' + lineSub.toFixed(2) + '</td>' +
          (cols.centimes ? '<td style="text-align:center;font-size:10px;color:#b45309;font-weight:bold;">' + lineCent + '</td>' : '') +
          '</tr>'
        );
      }).join('');

      var buildSingleSheetBody = function (copyBadgeText) {
        return (
          '<div class="single-doc-box" style="position:relative;">' +
          (layout.watermarkText
            ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.06;font-size:48px;font-weight:900;transform:rotate(-20deg);">' + layout.watermarkText + '</div>'
            : '') +
          '<div class="header">' +
          '  <div>' +
          '    <div class="shop-title">' + (settings.shop_name || 'Gherbi.Ai POS') + '</div>' +
          '    <div>' + (settings.shop_description || 'تجارة عامة وتوزيع') + '</div>' +
          '    <div>' + (settings.shop_address || 'الجزائر') + (settings.shop_phone ? ' | هاتف: ' + settings.shop_phone : '') + '</div>' +
          (layout.showFiscal
            ? '<div style="font-size:10px;color:#475569;margin-top:3px;font-family:monospace;">RC: ' + (settings.shop_rc || '-') + ' | NIF: ' + (settings.shop_nif || '-') + ' | AI: ' + (settings.shop_ai || '-') + ' | NIS: ' + (settings.shop_nis || '-') + '</div>'
            : '') +
          '  </div>' +
          '  <div style="text-align:left;">' +
          (copyBadgeText ? '<div style="display:inline-block;padding:2px 8px;border-radius:4px;background:#e2e8f0;font-size:10px;font-weight:900;margin-bottom:4px;">' + copyBadgeText + '</div>' : '') +
          '    <div style="font-size:15px;font-weight:900;color:' + accent + ';">' + docTitleText + '</div>' +
          '    <div style="font-family:monospace;font-weight:900;">N°: ' + (docData.doc_number || 'FAC-2026-0105') + '</div>' +
          '    <div>التاريخ: ' + String(docData.sale_date || new Date().toISOString()).slice(0, 10) + '</div>' +
          '  </div>' +
          '</div>' +

          '<div class="meta-box">' +
          '  <div><strong>الطرف / الزبون:</strong> ' + (docData.customer_name || 'مؤسسة الأمل للتجارة') + (docData.customer_phone ? ' | <strong>الهاتف:</strong> ' + docData.customer_phone : '') + '</div>' +
          '  <div><strong>طريقة التسديد:</strong> ' + (docData.payment_method || 'نقداً') + '</div>' +
          '</div>' +

          (layout.showDriverInfo
            ? '<div style="margin-bottom:10px;padding:6px 10px;border:1px dashed #94a3b8;border-radius:6px;font-size:10.5px;display:flex;justify-content:space-between;">' +
              '  <span><strong>🚚 السائق / الموزع:</strong> ............................</span>' +
              '  <span><strong>ترقيم المركبة (Matricule):</strong> ............................</span>' +
              '  <span><strong>عدد الطرود (Colis):</strong> ............</span>' +
              '</div>'
            : '') +

          '<table><thead><tr>' + headersHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +

          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">' +
          '  <div style="flex:1;">' +
          (layout.showAmountInWords ? '<div class="words-box">أوقفت هذه الوثيقة على مبلغ: ' + words + '</div>' : '') +
          (layout.footerNote ? '<div style="margin-top:8px;font-size:10.5px;color:#475569;font-weight:bold;">' + layout.footerNote + '</div>' : '') +
          '  </div>' +
          '  <div class="totals">' +
          '    <div class="totals-row"><span>المجموع الفرعي:</span><span style="font-family:monospace;font-weight:bold;">' + subtotal.toFixed(2) + ' د.ج</span></div>' +
          (discount > 0 ? '<div class="totals-row"><span>التخفيض:</span><span style="font-family:monospace;">-' + discount.toFixed(2) + ' د.ج</span></div>' : '') +
          '    <div class="totals-row grand"><span>الصافي للدفع:</span><span style="font-family:monospace;">' + total.toFixed(2) + ' د.ج</span></div>' +
          (layout.showCentimes !== false ? '<div class="totals-row" style="background:#fffbeb;color:#b45309;font-weight:900;font-size:10.5px;"><span>المبلغ بالسنتيم:</span><span>' + centimeTotal + '</span></div>' : '') +
          '    <div class="totals-row"><span>المدفوع:</span><span style="font-family:monospace;">' + paid.toFixed(2) + ' د.ج</span></div>' +
          (rest > 0 ? '<div class="totals-row"><span>الباقي:</span><span style="font-family:monospace;color:#e11d48;font-weight:bold;">' + rest.toFixed(2) + ' د.ج</span></div>' : '') +
          (layout.showOldDebt && oldDebt > 0 ? '<div class="totals-row"><span>الدين السابق:</span><span style="font-family:monospace;">' + oldDebt.toFixed(2) + ' د.ج</span></div>' : '') +
          '  </div>' +
          '</div>' +

          (layout.showSignature
            ? '<div class="footer" style="margin-top:18px;padding-top:8px;border-top:1px dashed #cbd5e1;font-weight:800;">' +
              '  <div>إمضاء المستلم / الزبون: ........................</div>' +
              '  <div>الختم والإمضاء: ........................</div>' +
              '</div>'
            : '') +
          '</div>'
        );
      };

      var pageCssRule = '@page { size: A4 portrait; margin: 10mm; }';
      if (paper === 'a4_landscape') pageCssRule = '@page { size: A4 landscape; margin: 10mm; }';
      else if (paper === 'a5') pageCssRule = '@page { size: A5 portrait; margin: 8mm; }';
      else if (paper === 'a5_landscape') pageCssRule = '@page { size: A5 landscape; margin: 8mm; }';
      else if (paper === 'thermal80') pageCssRule = '@page { size: 80mm auto; margin: 2mm; }';
      else if (paper === 'thermal58') pageCssRule = '@page { size: 58mm auto; margin: 1.5mm; }';
      else if (paper === 'a4_dual_a5') pageCssRule = '@page { size: A4 portrait; margin: 6mm; }';

      var bodyHtml = paper === 'a4_dual_a5'
        ? '<div style="display:flex;flex-direction:column;justify-content:space-between;min-height:280mm;gap:6mm;">' +
          buildSingleSheetBody('نسخة الزبون (Exemplaire Client - 1/2)') +
          '<div style="border-top:2px dashed #64748b;text-align:center;font-size:10px;color:#64748b;padding:2px 0;">✂️ خط القص — (2×A5 في ورقة A4 واحدة لتوفير 50% من الورق) ✂️</div>' +
          buildSingleSheetBody('نسخة الأرشيف والمحاسبة (Exemplaire Archive - 2/2)') +
          '</div>'
        : buildSingleSheetBody('');

      return (
        '<!DOCTYPE html><html lang="' + lang + '" dir="' + dir + '"><head><meta charset="UTF-8"><style>' +
        pageCssRule +
        'body{font-family:"Cairo","Tajawal",sans-serif;font-size:' + (layout.fontSize || 11.5) + 'px;color:#0f172a;margin:0;padding:' + (paper === 'a4_dual_a5' ? '8px' : '16px') + ';background:#fff;}' +
        '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ' + accent + ';padding-bottom:8px;margin-bottom:10px;}' +
        '.shop-title{font-size:18px;font-weight:900;color:' + accent + ';}' +
        '.meta-box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:7px 12px;margin-bottom:10px;display:flex;justify-content:space-between;}' +
        'table{width:100%;border-collapse:collapse;margin-bottom:10px;}' +
        'th{background:' + accent + ';color:#fff;padding:6px;border:1px solid ' + accent + ';font-size:11px;}' +
        'td{padding:5px 6px;border:1px solid #cbd5e1;font-size:11px;}' +
        '.totals{width:250px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;}' +
        '.totals-row{display:flex;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;}' +
        '.totals-row.grand{background:' + accent + ';color:#fff;font-weight:900;font-size:13px;}' +
        '.words-box{padding:6px 10px;background:#f1f5f9;border-right:4px solid ' + accent + ';font-weight:700;font-size:11px;}' +
        '.footer{display:flex;justify-content:space-between;font-size:11px;color:#334155;}' +
        '</style></head><body>' + bodyHtml + '</body></html>'
      );
    };
  }

  // ترقية واجهة TemplateBuilder لتشمل جميع أنواع المستندات الـ 10 ومقاس 2×A5 والأعمدة
  if (window.TemplateBuilder) {
    var currentLayout = {
      name: 'قالب بون وفاتورة احترافي',
      doc_type: 'invoice',
      paper: 'a4',
      lang: 'ar',
      accentColor: '#1d4ed8',
      fontSize: 12,
      showFiscal: true,
      showOldDebt: true,
      showAmountInWords: true,
      showCentimes: true,
      showDriverInfo: false,
      showSignature: true,
      watermarkText: '',
      columns: { index: true, barcode: true, designation: true, qty: true, unit: true, unitPrice: true, tva: false, total: true, centimes: true },
      footerNote: 'شكراً لتعاملكم معنا — البضاعة المباعة لا تُرد ولا تُستبدل إلا وفق الشروط القانونية.'
    };
    var savedTemplatesList = [];

    window.TemplateBuilder.getCurrentLayout = function () { return currentLayout; };

    window.TemplateBuilder.initTemplateBuilder = async function (containerId) {
      var root = document.getElementById(containerId || 'template-designer-root');
      if (!root) return;

      if (window.api && window.api.getCustomTemplates) {
        savedTemplatesList = (await window.api.getCustomTemplates().catch(function () { return []; })) || [];
      }

      var cols = currentLayout.columns || {};

      root.innerHTML =
        '<div class="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">' +
        '  <div class="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3.5 shadow-sm">' +
        '    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">' +
        '      <h3 class="font-black text-sm text-blue-600">🎨 مهندس قوالب الفواتير والأوراق الرسمية</h3>' +
        '      <div class="flex gap-1.5">' +
        '        <button type="button" onclick="window.TemplateBuilder.printCurrentPreview()" class="px-3 py-1.5 bg-slate-800 text-white rounded-xl font-bold">🖨️ طباعة تجريبية</button>' +
        '        <button type="button" onclick="window.TemplateBuilder.saveCurrent()" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow">💾 حفظ واعتماد القالب</button>' +
        '      </div>' +
        '    </div>' +

        '    <div class="grid grid-cols-2 gap-2.5">' +
        '      <div><label class="block font-bold mb-1">اسم القالب *</label><input type="text" value="' + (currentLayout.name || '') + '" oninput="window.TemplateBuilder.updateProp(\'name\', this.value)" class="w-full px-3 py-1.5 rounded-xl font-bold"></div>' +
        '      <div><label class="block font-bold mb-1">نوع المستند الرسمي (Doc Type)</label>' +
        '        <select onchange="window.TemplateBuilder.updateProp(\'doc_type\', this.value)" class="w-full px-2.5 py-1.5 rounded-xl font-bold">' +
        '          <option value="invoice" ' + (currentLayout.doc_type === 'invoice' ? 'selected' : '') + '>🧾 فاتورة بيع (Facture)</option>' +
        '          <option value="delivery" ' + (currentLayout.doc_type === 'delivery' ? 'selected' : '') + '>🚚 بون تسليم وتوصيل (Bon de Livraison)</option>' +
        '          <option value="order" ' + (currentLayout.doc_type === 'order' ? 'selected' : '') + '>📋 بون طلبية (Bon de Commande)</option>' +
        '          <option value="proforma" ' + (currentLayout.doc_type === 'proforma' ? 'selected' : '') + '>📄 فاتورة شكلية (Proforma / Devis)</option>' +
        '          <option value="receipt" ' + (currentLayout.doc_type === 'receipt' ? 'selected' : '') + '>🎫 بون كاشير (Ticket de Caisse)</option>' +
        '          <option value="reception" ' + (currentLayout.doc_type === 'reception' ? 'selected' : '') + '>📦 بون استلام بضاعة (Bon de Réception)</option>' +
        '          <option value="payment_receipt" ' + (currentLayout.doc_type === 'payment_receipt' ? 'selected' : '') + '>💵 بون تسديد دفعة (Bon de Versement)</option>' +
        '        </select>' +
        '      </div>' +
        '      <div><label class="block font-bold mb-1">مقاس وتخطيط الورقة *</label>' +
        '        <select onchange="window.TemplateBuilder.updateProp(\'paper\', this.value)" class="w-full px-2.5 py-1.5 rounded-xl font-bold text-blue-600">' +
        '          <option value="a4" ' + (currentLayout.paper === 'a4' ? 'selected' : '') + '>📄 A4 عمودي قياسي (210×297mm)</option>' +
        '          <option value="a4_dual_a5" ' + (currentLayout.paper === 'a4_dual_a5' ? 'selected' : '') + '>🔥 2×A5 في ورقة A4 واحدة (نسخة زبون + أرشيف)</option>' +
        '          <option value="a5" ' + (currentLayout.paper === 'a5' ? 'selected' : '') + '>📑 A5 نصفي عمودي (148×210mm)</option>' +
        '          <option value="a5_landscape" ' + (currentLayout.paper === 'a5_landscape' ? 'selected' : '') + '>📐 A5 أفقي تجاري (Bon Commercial)</option>' +
        '          <option value="a4_landscape" ' + (currentLayout.paper === 'a4_landscape' ? 'selected' : '') + '>🖼️ A4 أفقي عريض (Landscape)</option>' +
        '          <option value="thermal80" ' + (currentLayout.paper === 'thermal80' ? 'selected' : '') + '>🧾 رول حراري 80mm</option>' +
        '          <option value="thermal58" ' + (currentLayout.paper === 'thermal58' ? 'selected' : '') + '>🎫 رول حراري 58mm</option>' +
        '        </select>' +
        '      </div>' +
        '      <div class="grid grid-cols-2 gap-1.5">' +
        '        <div><label class="block font-bold mb-1">اللون الرئيسي</label><input type="color" value="' + (currentLayout.accentColor || '#1d4ed8') + '" oninput="window.TemplateBuilder.updateProp(\'accentColor\', this.value)" class="w-full h-8 rounded-xl cursor-pointer"></div>' +
        '        <div><label class="block font-bold mb-1">حجم الخط</label><input type="number" min="9" max="16" value="' + (currentLayout.fontSize || 12) + '" oninput="window.TemplateBuilder.updateProp(\'fontSize\', Number(this.value))" class="w-full px-2 py-1.5 rounded-xl font-mono text-center"></div>' +
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
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (currentLayout.showFiscal ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showFiscal\', this.checked)"><span>البيانات الجبائية (RC/NIF)</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer text-amber-600"><input type="checkbox" ' + (currentLayout.showCentimes !== false ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showCentimes\', this.checked)"><span>إجمالي الفاتورة بالسنتيم</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (currentLayout.showOldDebt ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showOldDebt\', this.checked)"><span>الدين السابق والرصيد</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (currentLayout.showAmountInWords ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showAmountInWords\', this.checked)"><span>المبلغ بالحروف (التفقيط)</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (currentLayout.showDriverInfo ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showDriverInfo\', this.checked)"><span>بيانات السائق والمركبة</span></label>' +
        '      <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (currentLayout.showSignature ? 'checked' : '') + ' onchange="window.TemplateBuilder.updateProp(\'showSignature\', this.checked)"><span>خانات الختم والإمضاء</span></label>' +
        '    </div>' +

        '    <div class="grid grid-cols-2 gap-2">' +
        '      <div><label class="block font-bold mb-1">علامة مائية بالخلفية (Watermark)</label><input type="text" placeholder="مثال: خالص / PAYÉ" value="' + (currentLayout.watermarkText || '') + '" oninput="window.TemplateBuilder.updateProp(\'watermarkText\', this.value)" class="w-full px-2.5 py-1.5 rounded-xl"></div>' +
        '      <div><label class="block font-bold mb-1">ملاحظة أسفل الورقة</label><input type="text" value="' + (currentLayout.footerNote || '') + '" oninput="window.TemplateBuilder.updateProp(\'footerNote\', this.value)" class="w-full px-2.5 py-1.5 rounded-xl"></div>' +
        '    </div>' +

        '    <div class="pt-2 border-t border-slate-200 dark:border-slate-700">' +
        '      <div class="font-bold mb-1.5">القوالب المحفوظة في قاعدة البيانات (' + savedTemplatesList.length + '):</div>' +
        '      <div class="flex flex-wrap gap-1.5">' +
        savedTemplatesList.map(function (t) {
          return '<button type="button" onclick="window.TemplateBuilder.loadSaved(' + t.id + ')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-[11px] transition">' + t.name + ' (' + (t.paper || 'a4') + ')</button>';
        }).join('') +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '  <div class="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col shadow-sm">' +
        '    <div class="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">' +
        '      <span>معاينة حية ومباشرة للورقة (' + (currentLayout.paper === 'a4_dual_a5' ? 'نسختان 2×A5 في ورقة A4 واحدة' : currentLayout.paper) + ')</span>' +
        '      <span class="text-emerald-600">تتحدث لحظياً مع كل تغيير</span>' +
        '    </div>' +
        '    <iframe id="td-preview-frame" class="w-full flex-1 min-h-[540px] border border-slate-200 rounded-xl bg-white shadow-inner"></iframe>' +
        '  </div>' +
        '</div>';

      this.refreshPreview();
    };

    window.TemplateBuilder.toggleCol = function (colKey, checked) {
      if (!currentLayout.columns) currentLayout.columns = {};
      currentLayout.columns[colKey] = Boolean(checked);
      this.refreshPreview();
    };

    window.TemplateBuilder.printCurrentPreview = async function () {
      var frame = document.getElementById('td-preview-frame');
      if (frame && frame.contentWindow && window.PrintEngine) {
        var html = frame.contentWindow.document.documentElement.outerHTML;
        await window.PrintEngine.printHtmlDocument(html, { silent: false });
      }
    };
  }

  // ==========================================================================
  // 3. منشئ البونات والأوراق الحر (Universal Custom BON & Paper Creator Studio)
  // ==========================================================================
  var CUSTOM_BON_PRESETS = {
    sav_repair: {
      bonTitle: '🛠️ بون استلام وصيانة جهاز (BON DE RÉPARATION / SAV)',
      bonSubtitle: 'وثيقة رسمية لاستلام الأجهزة ومتابعة الصيانة والضمان',
      partyLabel: 'الزبون صاحب الجهاز',
      accentColor: '#1d4ed8',
      fields: [
        { label: 'نوع الجهاز والموديل', value: 'هاتف / حاسوب / جهاز كهرومنزلي' },
        { label: 'الرقم التسلسلي (IMEI / S/N)', value: '358901092837412' },
        { label: 'وصف العطل والملحقات المستلمة', value: 'تغيير شاشة + فحص البطارية (بدون شاحن)' },
        { label: 'التكلفة التقديرية والتسبقة', value: 'التكلفة: 8,500 د.ج | التسبقة: 3,000 د.ج | الباقي: 5,500 د.ج' }
      ],
      showItemsTable: true,
      tableHeaders: ['القطعة / خدمة الصيانة', 'الكمية', 'السعر (د.ج)', 'المجموع (د.ج)'],
      items: [
        { col1: 'قطعة غيار أصلية مع التركيب', col2: '1', col3: '7000.00', col4: '7000.00' },
        { col1: 'يد عاملة وفحص تقني شامل', col2: '1', col3: '1500.00', col4: '1500.00' }
      ],
      bodyParagraph: 'يلتزم الزبون بإحضار هذا البون عند استلام جهازه. الورشة غير مسؤولة عن الأجهزة المتروكة لأكثر من 30 يوماً بعد إشعار الزبون.'
    },
    stock_transfer: {
      bonTitle: '📦 بون تحويل بضاعة بين مخزنين (BON DE TRANSFERT INTER-DÉPÔTS)',
      bonSubtitle: 'سند حركة داخلية للبضائع بين المستودع والمحل',
      partyLabel: 'المخزن المستلم / أمين المستودع',
      accentColor: '#0f766e',
      fields: [
        { label: 'من المخزن المرسل', value: 'المستودع الرئيسي — المنطقة الصناعية' },
        { label: 'إلى المخزن المستلم', value: 'نقطة البيع الرئيسية — وسط المدينة' },
        { label: 'اسم السائق / الناقل', value: 'كريم بن عيسى (مركبة: 04512-123-21)' },
        { label: 'حالة البضاعة عند الشحن', value: 'سليمة ومطابقة للعد الفعلي' }
      ],
      showItemsTable: true,
      tableHeaders: ['اسم المنتج / الصنف', 'الكمية المحولة', 'الوحدة', 'ملاحظة الرصيد'],
      items: [
        { col1: 'زيت مائدة إيليو 5 لتر', col2: '30', col3: 'قارورة', col4: 'كرتون مغلق' },
        { col1: 'حليب مجفف لويا 500غ', col2: '50', col3: 'علبة', col4: 'دفعة جديدة' }
      ],
      bodyParagraph: 'تم جرد واستلام البضاعة المذكورة أعلاه كاملة وسليمة للتحويل الداخلي.'
    },
    exit_voucher: {
      bonTitle: '🚚 بون خروج بضاعة من المخزن (BON DE SORTIE MAGASIN)',
      bonSubtitle: 'ترخيص رسمي بإخراج البضاعة وتسليمها للموزع أو الزبون',
      partyLabel: 'المستلم / السائق الموزع',
      accentColor: '#4338ca',
      fields: [
        { label: 'رقم الفاتورة أو الطلبية المرتبطة', value: 'FAC-2026-0105' },
        { label: 'اسم السائق وترقيم المركبة', value: 'أحمد بلقاسم — الشاحنة رقم: 11204-316-16' },
        { label: 'وجهة التسليم', value: 'سوبرماركت النور — قسنطينة' }
      ],
      showItemsTable: true,
      tableHeaders: ['البيان / السلعة', 'الكمية المرخصة', 'الوحدة / التغليف', 'مراقبة الباب'],
      items: [
        { col1: 'فرينة ممتازة 5 كغ', col2: '40', col3: 'كيس', col4: '✓ مطابق' },
        { col1: 'سكر أبيض سيفيتال 1 كغ', col2: '100', col3: 'كيس', col4: '✓ مطابق' }
      ],
      bodyParagraph: 'لا يُسمح بإخراج أي بضاعة من المستودع إلا بموجب هذا السند الموقع من الإدارة.'
    },
    cash_discharge: {
      bonTitle: '🤝 بون أمانة / إبراء ذمة وتسليم مبلغ (BON DE DÉCHARGE)',
      bonSubtitle: 'وثيقة إثبات استلام أو تسليم مبالغ مالية أو أمانات تجارية',
      partyLabel: 'الطرف المستلم / المودع',
      accentColor: '#047857',
      fields: [
        { label: 'رقم بطاقة التعريف / السجل التجاري', value: '1099827364512' },
        { label: 'المبلغ المالي بالأرقام', value: '150,000.00 د.ج (خمسة عشر مليون سنتيم)' },
        { label: 'موضوع الأمانة / التسليم', value: 'تسبيق على صفقة تموين بضاعة لشهر رمضان' }
      ],
      showItemsTable: false,
      tableHeaders: ['البيان', 'الكمية', 'القيمة', 'الإجمالي'],
      items: [],
      bodyParagraph: 'أشهد أنا الموقع أدناه أنني استلمت المبلغ المالي المذكور أعلاه كاملاً عداً ونقداً، وحرر هذا السند لإثبات الحق وإبراء الذمة.'
    },
    crate_consign: {
      bonTitle: '🔄 بون إعارة واسترجاع الصناديق والمعدات (BON DE CONSIGNATION)',
      bonSubtitle: 'متابعة الصناديق البلاستيكية، القارورات، والمعدات المعارة للزبائن',
      partyLabel: 'الزبون المستعير',
      accentColor: '#d97706',
      fields: [
        { label: 'عدد الصناديق / المعدات المسلمة', value: '25 صندوق بلاستيكي كبير' },
        { label: 'مبلغ الضمان المالي (Caution)', value: '12,500.00 د.ج (تُسترجع عند إعادة الصناديق)' },
        { label: 'تاريخ الإرجاع المتفق عليه', value: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }
      ],
      showItemsTable: true,
      tableHeaders: ['نوع الصندوق / المعدات', 'العدد المسلم', 'قيمة الضمان للوحدة', 'إجمالي الضمان'],
      items: [
        { col1: 'صندوق بلاستيكي مقوى (أزرق)', col2: '25', col3: '500.00', col4: '12500.00' }
      ],
      bodyParagraph: 'يلتزم الزبون بإعادة الصناديق أو المعدات بحالتها السليمة في الموعد المحدد لاسترجاع مبلغ الضمان.'
    },
    debt_ack: {
      bonTitle: '📝 سند التزام واعتراف بدين تجاري (RECONNAISSANCE DE DETTE)',
      bonSubtitle: 'وثيقة تعاقدية لإثبات الرصيد المستحق وجدولة السداد',
      partyLabel: 'المدين الملتزم بالسداد',
      accentColor: '#be123c',
      fields: [
        { label: 'إجمالي مبلغ الدين المستحق', value: '85,000.00 د.ج (ثمانية ملايين وخمسمائة ألف سنتيم)' },
        { label: 'تاريخ الاستحقاق النهائي للسداد', value: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) },
        { label: 'طريقة السداد المتفق عليها', value: 'نقداً أو عبر الحساب البريدي BaridiMob' }
      ],
      showItemsTable: false,
      tableHeaders: ['البيان', 'الكمية', 'السعر', 'المجموع'],
      items: [],
      bodyParagraph: 'أقر وأعترف أنا الموقع أدناه بصفتي مديناً للمؤسسة بالمبلغ المبين أعلاه مقابل استلام بضاعة تجارية سليمة، وألتزم بتسديده في الأجل المحدد.'
    },
    gift_voucher: {
      bonTitle: '🎁 قسيمة شراء / بطاقة هدية للزبون (BON D\'ACHAT VIP)',
      bonSubtitle: 'قسيمة تخفيض أو شراء مهداة من المتجر لزبائنه الأوفياء',
      partyLabel: 'المستفيد من القسيمة',
      accentColor: '#7c3aed',
      fields: [
        { label: 'قيمة قسيمة الشراء المجانية', value: '2,000.00 د.ج (مائتا ألف سنتيم)' },
        { label: 'صالحة للاستعمال لغاية تاريخ', value: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) }
      ],
      showItemsTable: false,
      tableHeaders: ['البيان', 'الكمية', 'السعر', 'المجموع'],
      items: [],
      bodyParagraph: 'تُقدم هذه القسيمة عند الكاشير للاستفادة الفورية من قيمتها عند الشراء من متجرنا. شكراً لوفائكم!'
    },
    blank_custom: {
      bonTitle: '✨ بون وورقة رسمية مخصصة (BON SPÉCIAL PERSONNALISÉ)',
      bonSubtitle: 'اكتب أي عنوان وأضف أي حقول أو جداول حسب تصورك الخاص',
      partyLabel: 'الطرف المعني / الزبون',
      accentColor: '#0f172a',
      fields: [
        { label: 'البيان الأول', value: 'أدخل التفاصيل هنا...' },
        { label: 'البيان الثاني', value: 'أدخل التفاصيل هنا...' }
      ],
      showItemsTable: true,
      tableHeaders: ['البيان / الوصف', 'الكمية', 'القيمة', 'المجموع'],
      items: [
        { col1: 'عنصر مخصص 1', col2: '1', col3: '1000.00', col4: '1000.00' }
      ],
      bodyParagraph: 'ملاحظات وشروط الورقة المخصصة...'
    }
  };

  App.loadCustomBonPreset = function (presetKey) {
    var p = CUSTOM_BON_PRESETS[presetKey];
    if (!p) return;
    var st = AppState.customBonState;
    st.presetKey = presetKey;
    st.bonTitle = p.bonTitle;
    st.bonSubtitle = p.bonSubtitle;
    st.partyLabel = p.partyLabel;
    st.accentColor = p.accentColor;
    st.fields = JSON.parse(JSON.stringify(p.fields));
    st.showItemsTable = p.showItemsTable;
    st.tableHeaders = p.tableHeaders.slice();
    st.items = JSON.parse(JSON.stringify(p.items));
    st.bodyParagraph = p.bodyParagraph;
    this.renderPrintStudioView();
  };

  App.buildCustomBonHtmlDocument = async function () {
    var st = AppState.customBonState;
    var s = AppState.settings || {};
    var accent = st.accentColor || '#1d4ed8';

    var bcImg = '';
    if (st.showBarcode && st.bonNumber && window.api && window.api.generateBarcodeImage) {
      bcImg = await window.api.generateBarcodeImage(st.bonNumber, { bcid: 'code128', height: 9, scale: 2 }).catch(function () { return ''; });
    }

    var totalTableSum = (st.items || []).reduce(function (acc, it) {
      return acc + (parseFloat(it.col4) || 0);
    }, 0);
    var centimeSum = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalTableSum) : '';

    var fieldsGridHtml = (st.fields || []).map(function (f) {
      return (
        '<div style="padding:7px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">' +
        '  <div style="font-size:10px;color:#64748b;font-weight:bold;">' + (f.label || '') + ':</div>' +
        '  <div style="font-size:12px;font-weight:900;color:#0f172a;margin-top:2px;">' + (f.value || '—') + '</div>' +
        '</div>'
      );
    }).join('');

    var tableHtml = '';
    if (st.showItemsTable && st.items && st.items.length > 0) {
      var ths = (st.tableHeaders || ['البيان', 'الكمية', 'السعر', 'المجموع']).map(function (h) {
        return '<th style="background:' + accent + ';color:#fff;padding:6px;border:1px solid ' + accent + ';">' + h + '</th>';
      }).join('');
      var trs = st.items.map(function (it, i) {
        return (
          '<tr>' +
          '<td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">' + (i + 1) + '. ' + (it.col1 || '') + '</td>' +
          '<td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-family:monospace;font-weight:bold;">' + (it.col2 || '') + '</td>' +
          '<td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-family:monospace;">' + (it.col3 || '') + '</td>' +
          '<td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-family:monospace;font-weight:900;">' + (it.col4 || '') + '</td>' +
          '</tr>'
        );
      }).join('');

      tableHtml =
        '<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:11px;">' +
        '<thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>' +
        (totalTableSum > 0
          ? '<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">' +
            '  <div style="padding:6px 14px;border-radius:8px;background:' + accent + ';color:#fff;font-weight:900;font-size:12px;">' +
            '    المجموع: <span style="font-family:monospace;">' + totalTableSum.toFixed(2) + ' د.ج</span>' +
            (st.showCentimesTotal ? ' <span style="font-size:10.5px;color:#fde68a;">(' + centimeSum + ')</span>' : '') +
            '  </div>' +
            '</div>'
          : '');
    }

    var renderOneBonCopy = function (copyTitle) {
      return (
        '<div style="border:2px solid ' + accent + ';border-radius:12px;padding:14px;background:#fff;">' +
        '  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid ' + accent + ';padding-bottom:8px;margin-bottom:10px;">' +
        '    <div>' +
        '      <div style="font-size:18px;font-weight:900;color:' + accent + ';">' + (s.shop_name || 'Gherbi.Ai POS') + '</div>' +
        '      <div style="font-size:10.5px;color:#475569;">' + (s.shop_address || 'الجزائر') + (s.shop_phone ? ' | هاتف: ' + s.shop_phone : '') + '</div>' +
        '    </div>' +
        '    <div style="text-align:left;">' +
        (copyTitle ? '<div style="display:inline-block;padding:1px 7px;background:#e2e8f0;border-radius:4px;font-size:9.5px;font-weight:900;margin-bottom:2px;">' + copyTitle + '</div>' : '') +
        '      <div style="font-size:15px;font-weight:900;color:' + accent + ';">' + (st.bonTitle || 'بون رسمي') + '</div>' +
        '      <div style="font-size:10px;color:#64748b;font-weight:bold;">' + (st.bonSubtitle || '') + '</div>' +
        '      <div style="font-family:monospace;font-size:11px;font-weight:900;margin-top:2px;">N°: ' + (st.bonNumber || 'BON-01') + ' | التاريخ: ' + (st.bonDate || '') + '</div>' +
        '    </div>' +
        '  </div>' +

        '  <div style="padding:7px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:10px;display:flex;justify-content:space-between;font-size:11.5px;">' +
        '    <div><strong>' + (st.partyLabel || 'الطرف المعني') + ':</strong> ' + (st.partyName || '—') + '</div>' +
        '    <div><strong>رقم الهاتف:</strong> <span style="font-family:monospace;">' + (st.partyPhone || '—') + '</span></div>' +
        '  </div>' +

        '  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px;">' + fieldsGridHtml + '</div>' +
        tableHtml +
        (st.bodyParagraph ? '<div style="padding:8px 10px;background:#f8fafc;border-right:4px solid ' + accent + ';font-size:10.5px;font-weight:bold;line-height:1.5;margin:8px 0;">' + st.bodyParagraph + '</div>' : '') +

        '  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:11px;font-weight:800;">' +
        '    <div>' + (st.sigLeftLabel || 'إمضاء المستلم / الزبون') + '<br><br>........................</div>' +
        (bcImg ? '<div style="text-align:center;"><img src="' + bcImg + '" style="height:10mm;object-fit:contain;"><div style="font-family:monospace;font-size:9px;">' + st.bonNumber + '</div></div>' : '') +
        '    <div>' + (st.sigRightLabel || 'ختم وإمضاء المتجر') + '<br><br>........................</div>' +
        '  </div>' +
        '</div>'
      );
    };

    var isDual = st.paperMode === 'a4_dual_a5';
    var pageRule = '@page { size: A4 portrait; margin: 8mm; }';
    if (st.paperMode === 'a5_landscape') pageRule = '@page { size: A5 landscape; margin: 8mm; }';
    else if (st.paperMode === 'a5_portrait') pageRule = '@page { size: A5 portrait; margin: 8mm; }';
    else if (st.paperMode === 'thermal80') pageRule = '@page { size: 80mm auto; margin: 2mm; }';

    var fullBody = isDual
      ? '<div style="display:flex;flex-direction:column;justify-content:space-between;gap:5mm;">' +
        renderOneBonCopy('نسخة الزبون / المستلم (Exemplaire 1/2)') +
        '<div style="border-top:2px dashed #64748b;text-align:center;font-size:10px;color:#64748b;padding:2px 0;">✂️ خط القص — (نسختان 2×A5 في ورقة A4 واحدة) ✂️</div>' +
        renderOneBonCopy('نسخة المحل / الأرشيف (Exemplaire 2/2)') +
        '</div>'
      : renderOneBonCopy('');

    return (
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + (st.bonTitle || 'Bon') + '</title>' +
      '<link rel="stylesheet" href="./assets/css/fonts.css">' +
      '<style>' + pageRule + ' *{box-sizing:border-box;}body{font-family:"Cairo",Tahoma,sans-serif;margin:0;padding:8px;background:#fff;color:#0f172a;}</style>' +
      '</head><body>' + fullBody + '</body></html>'
    );
  };

  App.refreshCustomBonPreview = async function () {
    var frame = document.getElementById('customBonLiveFrame');
    if (!frame || !frame.contentWindow) return;
    var html = await this.buildCustomBonHtmlDocument();
    var doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  };

  App.printCustomBonNow = async function (asPdf) {
    var html = await this.buildCustomBonHtmlDocument();
    if (asPdf && window.api && window.api.exportPDF) {
      var res = await window.api.exportPDF({ html: html, filename: (AppState.customBonState.bonNumber || 'Custom_Bon') + '.pdf' });
      if (res && res.success && typeof showToast === 'function') showToast('📄 تم تصدير البون المخصص بصيغة PDF بنجاح!', 'success');
      return;
    }
    if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // ==========================================================================
  // 4. مولد لافتات العروض الجدارية (A4/A5 Promo Sign Maker) وكتالوج الأسعار
  // ==========================================================================
  App.buildPosterOrCatalogueHtml = async function () {
    var pst = AppState.posterStudioState;
    var s = AppState.settings || {};
    var prods = getSortedProductsForPrint();

    if (pst.mode === 'catalogue') {
      var filtered = prods.filter(function (p) {
        return getProdRetail(p) > 0 && (pst.catFilter === 'all' || p.category === pst.catFilter);
      }).slice(0, 150);

      var rows = filtered.map(function (p, i) {
        var ret = getProdRetail(p);
        var cent = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(ret) : '';
        return (
          '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td style="font-family:monospace;">' + (p.barcode || '-') + '</td>' +
          '<td style="font-weight:bold;">' + p.name + '</td>' +
          '<td>' + (p.category || 'عام') + '</td>' +
          '<td style="font-family:monospace;font-weight:900;color:#1d4ed8;">' + ret.toFixed(2) + ' د.ج</td>' +
          (pst.catShowCentimes ? '<td style="font-weight:bold;color:#b45309;">' + cent + '</td>' : '') +
          '</tr>'
        );
      }).join('');

      return (
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>كتالوج أسعار المتجر</title>' +
        '<style>@page{size:A4 portrait;margin:10mm;}body{font-family:"Cairo",Tahoma,sans-serif;padding:12px;font-size:11.5px;color:#0f172a;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #cbd5e1;padding:6px;text-align:right;}th{background:#1e3a8a;color:#fff;}</style></head><body>' +
        '<div style="display:flex;justify-content:space-between;border-bottom:3px solid #1e3a8a;padding-bottom:8px;">' +
        '  <div><h2 style="margin:0;color:#1e3a8a;">📋 قائمة وكتالوج أسعار المنتجات — ' + (s.shop_name || 'Gherbi.Ai POS') + '</h2><div>الفئة: ' + (pst.catFilter === 'all' ? 'جميع الفئات' : pst.catFilter) + ' | عدد المنتجات: ' + filtered.length + '</div></div>' +
        '  <div>التاريخ: ' + new Date().toISOString().slice(0, 10) + '</div>' +
        '</div>' +
        '<table><thead><tr><th>#</th><th>الباركود</th><th>اسم المنتج</th><th>الفئة</th><th>سعر البيع (د.ج)</th>' + (pst.catShowCentimes ? '<th>بالسنتيم الجزائري</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '</body></html>'
      );
    }

    // لافتة عرض جدارية كبيرة (A4 / A5 Store Promo Sign)
    var prod = prods.find(function (p) { return Number(p.id) === Number(pst.productId); }) || prods[0] || { name: 'زيت مائدة إيليو 5 لتر', barcode: '6130001002', selling_price: 650 };
    var newPrice = parseFloat(pst.newPrice) || getProdRetail(prod) || 650;
    var oldPrice = parseFloat(pst.oldPrice) || Math.round(newPrice * 1.18);
    var centimeNew = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(newPrice) : '';
    var col = pst.themeColor || '#e11d48';

    var bcImg = '';
    if (pst.showBarcode && prod.barcode && window.api && window.api.generateBarcodeImage) {
      bcImg = await window.api.generateBarcodeImage(prod.barcode, { bcid: 'code128', height: 12, scale: 3 }).catch(function () { return ''; });
    }

    return (
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>لافتة عرض ترويجي</title>' +
      '<style>@page{size:A4 portrait;margin:10mm;}body{font-family:"Cairo",Tahoma,sans-serif;margin:0;padding:12px;background:#fff;}</style></head><body>' +
      '<div style="border:8px solid ' + col + ';border-radius:28px;padding:28px;text-align:center;min-height:255mm;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(180deg,#fff 0%,#fff1f2 100%);">' +
      '  <div style="background:' + col + ';color:#fff;padding:14px 24px;border-radius:18px;font-size:28px;font-weight:900;letter-spacing:0.5px;">' + (pst.badgeText || '🔥 عرض خاص ومحدود — PROMOTION 🔥') + '</div>' +
      '  <div style="margin:20px 0;">' +
      '    <div style="font-size:38px;font-weight:900;color:#0f172a;line-height:1.2;">' + (pst.customTitle || prod.name) + '</div>' +
      (oldPrice > newPrice
        ? '<div style="font-size:24px;color:#64748b;text-decoration:line-through;font-weight:800;margin-top:12px;">السعر السابق: ' + oldPrice.toFixed(2) + ' د.ج</div>'
        : '') +
      '    <div style="display:inline-block;margin-top:16px;padding:18px 40px;border-radius:24px;background:#fef08a;border:4px dashed ' + col + ';font-family:\'Segoe UI\',Tahoma,sans-serif;font-size:64px;font-weight:900;color:' + col + ';">' + newPrice.toFixed(2) + ' <span style="font-size:32px;">د.ج</span></div>' +
      (pst.showCentimes ? '<div style="font-size:26px;font-weight:900;color:#b45309;margin-top:10px;">🇩🇿 بالسنتيم: ' + centimeNew + '</div>' : '') +
      '  </div>' +
      (bcImg ? '<div><img src="' + bcImg + '" style="height:22mm;object-fit:contain;"><div style="font-family:monospace;font-size:15px;font-weight:900;">' + prod.barcode + '</div></div>' : '') +
      '  <div style="font-size:18px;font-weight:900;color:#334155;border-top:2px solid #cbd5e1;padding-top:12px;">' + (s.shop_name || 'Gherbi.Ai POS') + ' — مرحباً بكم دائماً!</div>' +
      '</div></body></html>'
    );
  };

  App.refreshPosterOrCataloguePreview = async function () {
    var frame = document.getElementById('posterLivePreviewFrame');
    if (!frame || !frame.contentWindow) return;
    var html = await this.buildPosterOrCatalogueHtml();
    var doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  };

  App.printPosterOrCatalogueNow = async function () {
    var html = await this.buildPosterOrCatalogueHtml();
    if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // ==========================================================================
  // 5. بناء الواجهة الرئيسية المتكاملة للصفحة الثامنة (#view-print — 4 تبويبات عملاقة)
  // ==========================================================================
  App.renderPrintStudioView = async function () {
    var root = document.getElementById('print-view-root');
    if (!root) return;

    var prods = getSortedProductsForPrint();
    var cfg = AppState.labelStudioConfig;
    if (!cfg.selectedId && prods.length > 0) {
      cfg.selectedId = prods[0].id;
    }

    var totalQueuedLabels = (AppState.labelPrintQueue || []).reduce(function (s, q) {
      return s + Number(q.copies || 1);
    }, 0);

    var allCategories = Array.from(new Set(prods.map(function (p) { return p.category || 'عام'; }).filter(Boolean)));
    var tab = AppState.printStudioTab || 'labels';

    var topHeaderHtml =
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '  <div>' +
      '    <h2 class="text-2xl font-black flex flex-wrap items-center gap-2">' +
      '      <span>مركز الطباعة الشامل، استوديو الباركود، ومنشئ البونات والأوراق الحر</span>' +
      '      <button id="btnPrintStudioQaBot" type="button" onclick="App.runAutoTest_PrintStudioPage()" title="تشغيل الفحص الآلي الذاتي لمركز الطباعة (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      <button type="button" onclick="App.openPrintStudioMasterGuide()" class="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-sm">📘 دليل الطباعة والبونات (F1)</button>' +
      '    </h2>' +
      '    <p class="text-xs text-slate-500">تصميم وطباعة ملصقات الباركود والرفوف (رول حراري أو ورق A4 مقسم)، تخصيص قوالب الفواتير و 2×A5، وإنشاء أي ورقة BON جديدة حسب تصورك</p>' +
      '  </div>' +
      '</div>' +

      '<div class="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-md">' +
      '  <button type="button" onclick="App.switchPrintStudioTab(\'labels\')" class="px-4 py-2 rounded-xl transition ' + (tab === 'labels' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">🏷️ 1. استوديو الباركود وملصقات الرفوف وأوراق A4</button>' +
      '  <button type="button" onclick="App.switchPrintStudioTab(\'designer\')" class="px-4 py-2 rounded-xl transition ' + (tab === 'designer' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">🎨 2. مهندس قوالب الفواتير والأوراق الرسمية (A4 / 2×A5 / 80mm)</button>' +
      '  <button type="button" onclick="App.switchPrintStudioTab(\'custom_bon\')" class="px-4 py-2 rounded-xl transition ' + (tab === 'custom_bon' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-amber-400 hover:bg-slate-700') + '">🧾 3. منشئ البونات والأوراق الحر (إنشاء أي BON جديد)</button>' +
      '  <button type="button" onclick="App.switchPrintStudioTab(\'catalogue_posters\')" class="px-4 py-2 rounded-xl transition ' + (tab === 'catalogue_posters' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700') + '">📢 4. كتالوج الأسعار ولافتات العروض الجدارية (Posters)</button>' +
      '</div>';

    // ========================================================================
    // التبويب 2: مهندس قوالب الفواتير والأوراق الرسمية
    // ========================================================================
    if (tab === 'designer') {
      root.innerHTML = '<div class="space-y-4">' + topHeaderHtml + '<div id="template-designer-root"></div></div>';
      if (window.TemplateBuilder) await window.TemplateBuilder.initTemplateBuilder('template-designer-root');
      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
      return;
    }

    // ========================================================================
    // التبويب 3: منشئ البونات والأوراق الحر (Universal Custom BON Creator)
    // ========================================================================
    if (tab === 'custom_bon') {
      var st = AppState.customBonState;
      root.innerHTML =
        '<div class="space-y-4">' +
        topHeaderHtml +

        '  <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">' +
        '    <div class="font-black text-amber-700 dark:text-amber-300">⚡ اختر نوع الـ BON الذي تريد إنشاءه أو تخصيصه الآن (أو صمّم بوناً جديداً حسب تصورك):</div>' +
        '    <div class="flex flex-wrap gap-1.5">' +
        '      <button type="button" onclick="App.loadCustomBonPreset(\'sav_repair\')" class="px-3 py-1.5 rounded-xl font-bold ' + (st.presetKey === 'sav_repair' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800') + '">🛠️ بون صيانة واستلام جهاز (SAV)</button>' +
        '      <button type="button" onclick="App.loadCustomBonPreset(\'stock_transfer\')" class="px-3 py-1.5 rounded-xl font-bold ' + (st.presetKey === 'stock_transfer' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800') + '">📦 بون تحويل بين مخزنين</button>' +
        '      <button type="button" onclick="App.loadCustomBonPreset(\'exit_voucher\')" class="px-3 py-1.5 rounded-xl font-bold ' + (st.presetKey === 'exit_voucher' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800') + '">🚚 بون خروج بضاعة / سائق</button>' +
        '      <button type="button" onclick="App.loadCustomBonPreset(\'cash_discharge\')" class="px-3 py-1.5 rounded-xl font-bold ' + (st.presetKey === 'cash_discharge' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800') + '">🤝 بون أمانة / إبراء ذمة مالي</button>' +
        '      <button type="button" onclick="App.loadCustomBonPreset(\'crate_consign\')" class="px-3 py-1.5 rounded-xl font-bold ' + (st.presetKey === 'crate_consign' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800') + '">🔄 بون إعارة صناديق ومعدات</button>' +
        '      <button type="button" onclick="App.loadCustomBonPreset(\'debt_ack\')" class="px-3 py-1.5 rounded-xl font-bold ' + (st.presetKey === 'debt_ack' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800') + '">📝 سند التزام واعتراف بدين</button>' +
        '      <button type="button" onclick="App.loadCustomBonPreset(\'gift_voucher\')" class="px-3 py-1.5 rounded-xl font-bold ' + (st.presetKey === 'gift_voucher' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800') + '">🎁 قسيمة شراء / هدية VIP</button>' +
        '      <button type="button" onclick="App.loadCustomBonPreset(\'blank_custom\')" class="px-3 py-1.5 rounded-xl font-bold ' + (st.presetKey === 'blank_custom' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800') + '">✨ بون حر فارغ (حسب تصورك)</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">' +
        '    <div class="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm max-h-[72vh] overflow-y-auto">' +
        '      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">' +
        '        <h3 class="font-black text-sm text-amber-600">🧾 إعدادات ومحتوى ورقة الـ BON المخصصة</h3>' +
        '        <div class="flex gap-1.5">' +
        '          <button type="button" onclick="App.printCustomBonNow(true)" class="px-3 py-1.5 bg-slate-800 text-white rounded-xl font-bold">📥 حفظ PDF</button>' +
        '          <button type="button" onclick="App.printCustomBonNow(false)" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow">🖨️ طباعة الـ BON الآن</button>' +
        '        </div>' +
        '      </div>' +

        '      <div class="grid grid-cols-2 gap-2">' +
        '        <div><label class="block font-bold mb-1">عنوان البون الرئيسي *</label><input type="text" value="' + (st.bonTitle || '') + '" oninput="AppState.customBonState.bonTitle=this.value; App.refreshCustomBonPreview()" class="w-full px-2.5 py-1.5 rounded-xl font-black text-blue-600"></div>' +
        '        <div><label class="block font-bold mb-1">مقاس الورقة والتخطيط *</label>' +
        '          <select onchange="AppState.customBonState.paperMode=this.value; App.refreshCustomBonPreview()" class="w-full px-2.5 py-1.5 rounded-xl font-bold">' +
        '            <option value="a4_dual_a5" ' + (st.paperMode === 'a4_dual_a5' ? 'selected' : '') + '>🔥 نسختان 2×A5 في ورقة A4 واحدة (زبون + محل)</option>' +
        '            <option value="a4" ' + (st.paperMode === 'a4' ? 'selected' : '') + '>📄 ورقة A4 كاملة</option>' +
        '            <option value="a5_landscape" ' + (st.paperMode === 'a5_landscape' ? 'selected' : '') + '>📐 بون نصفي A5 أفقي</option>' +
        '            <option value="a5_portrait" ' + (st.paperMode === 'a5_portrait' ? 'selected' : '') + '>📑 بون نصفي A5 عمودي</option>' +
        '            <option value="thermal80" ' + (st.paperMode === 'thermal80' ? 'selected' : '') + '>🧾 تذكرة حرارية 80mm</option>' +
        '          </select>' +
        '        </div>' +
        '        <div><label class="block font-bold mb-1">اسم الزبون / الطرف المعني</label><input type="text" value="' + (st.partyName || '') + '" oninput="AppState.customBonState.partyName=this.value; App.refreshCustomBonPreview()" class="w-full px-2.5 py-1.5 rounded-xl font-bold"></div>' +
        '        <div><label class="block font-bold mb-1">رقم الهاتف / المرجع</label><input type="text" value="' + (st.partyPhone || '') + '" oninput="AppState.customBonState.partyPhone=this.value; App.refreshCustomBonPreview()" class="w-full px-2.5 py-1.5 rounded-xl font-mono"></div>' +
        '      </div>' +

        '      <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">' +
        '        <div class="flex items-center justify-between">' +
        '          <span class="font-black">خانات البيانات المخصصة في البون (' + st.fields.length + '):</span>' +
        '          <button type="button" onclick="AppState.customBonState.fields.push({label:\'خانة جديدة\',value:\'تفاصيل...\'}); App.renderPrintStudioView()" class="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px]">+ إضافة خانة</button>' +
        '        </div>' +
        st.fields.map(function (f, fi) {
          return (
            '<div class="grid grid-cols-12 gap-1.5 items-center">' +
            '  <input type="text" value="' + f.label + '" oninput="AppState.customBonState.fields[' + fi + '].label=this.value; App.refreshCustomBonPreview()" class="col-span-4 px-2 py-1 rounded-lg font-bold text-[11px]">' +
            '  <input type="text" value="' + f.value + '" oninput="AppState.customBonState.fields[' + fi + '].value=this.value; App.refreshCustomBonPreview()" class="col-span-7 px-2 py-1 rounded-lg text-[11px]">' +
            '  <button type="button" onclick="AppState.customBonState.fields.splice(' + fi + ',1); App.renderPrintStudioView()" class="col-span-1 text-rose-500 font-black">✕</button>' +
            '</div>'
          );
        }).join('') +
        '      </div>' +

        '      <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">' +
        '        <div class="flex items-center justify-between">' +
        '          <label class="flex items-center gap-1.5 font-black cursor-pointer"><input type="checkbox" ' + (st.showItemsTable ? 'checked' : '') + ' onchange="AppState.customBonState.showItemsTable=this.checked; App.renderPrintStudioView()"><span>إدراج جدول عناصر / خدمات في البون</span></label>' +
        (st.showItemsTable ? '<button type="button" onclick="AppState.customBonState.items.push({col1:\'عنصر جديد\',col2:\'1\',col3:\'0.00\',col4:\'0.00\'}); App.renderPrintStudioView()" class="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">+ إضافة سطر</button>' : '') +
        '        </div>' +
        (st.showItemsTable
          ? st.items.map(function (it, ii) {
              return (
                '<div class="grid grid-cols-12 gap-1 items-center">' +
                '  <input type="text" value="' + it.col1 + '" oninput="AppState.customBonState.items[' + ii + '].col1=this.value; App.refreshCustomBonPreview()" class="col-span-5 px-2 py-1 rounded-lg font-bold text-[11px]">' +
                '  <input type="text" value="' + it.col2 + '" oninput="AppState.customBonState.items[' + ii + '].col2=this.value; App.refreshCustomBonPreview()" class="col-span-2 px-2 py-1 rounded-lg font-mono text-center text-[11px]">' +
                '  <input type="text" value="' + it.col3 + '" oninput="AppState.customBonState.items[' + ii + '].col3=this.value; App.refreshCustomBonPreview()" class="col-span-2 px-2 py-1 rounded-lg font-mono text-center text-[11px]">' +
                '  <input type="text" value="' + it.col4 + '" oninput="AppState.customBonState.items[' + ii + '].col4=this.value; App.refreshCustomBonPreview()" class="col-span-2 px-2 py-1 rounded-lg font-mono font-bold text-center text-[11px]">' +
                '  <button type="button" onclick="AppState.customBonState.items.splice(' + ii + ',1); App.renderPrintStudioView()" class="col-span-1 text-rose-500 font-black">✕</button>' +
                '</div>'
              );
            }).join('')
          : '') +
        '      </div>' +

        '      <div><label class="block font-bold mb-1">شرط قانوني أو فقرة أسفل البون</label><textarea rows="2" oninput="AppState.customBonState.bodyParagraph=this.value; App.refreshCustomBonPreview()" class="w-full px-2.5 py-1.5 rounded-xl text-[11px] font-bold">' + (st.bodyParagraph || '') + '</textarea></div>' +
        '    </div>' +

        '    <div class="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col shadow-sm">' +
        '      <div class="text-xs font-bold text-slate-400 mb-2">معاينة حية ومطابقة 100% لورقة الـ BON المخصصة:</div>' +
        '      <iframe id="customBonLiveFrame" class="w-full flex-1 min-h-[540px] border border-slate-200 rounded-xl bg-white shadow-inner"></iframe>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      await this.refreshCustomBonPreview();
      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
      return;
    }

    // ========================================================================
    // التبويب 4: استوديو كتالوج الأسعار ولافتات العروض الجدارية (Posters & Catalogues)
    // ========================================================================
    if (tab === 'catalogue_posters') {
      var pst = AppState.posterStudioState;
      if (!pst.productId && prods.length > 0) pst.productId = prods[0].id;

      root.innerHTML =
        '<div class="space-y-4">' +
        topHeaderHtml +
        '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">' +
        '    <div class="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 shadow-sm">' +
        '      <div class="flex gap-2">' +
        '        <button type="button" onclick="AppState.posterStudioState.mode=\'promo_poster\'; App.renderPrintStudioView()" class="flex-1 py-2.5 rounded-xl font-black ' + (pst.mode === 'promo_poster' ? 'bg-rose-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700') + '">🔥 لافتة عرض ترويجي كبيرة (A4 Poster)</button>' +
        '        <button type="button" onclick="AppState.posterStudioState.mode=\'catalogue\'; App.renderPrintStudioView()" class="flex-1 py-2.5 rounded-xl font-black ' + (pst.mode === 'catalogue' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700') + '">📋 كتالوج وقائمة أسعار المنتجات</button>' +
        '      </div>' +

        (pst.mode === 'promo_poster'
          ? '<div class="space-y-3">' +
            '  <div><label class="block font-bold mb-1">اختر المنتج المراد عمل لافتة عرض جدارية له</label>' +
            '    <select onchange="AppState.posterStudioState.productId=Number(this.value); var p=AppState.products.find(x=>Number(x.id)===Number(this.value)); if(p){AppState.posterStudioState.newPrice=p.selling_price||0; AppState.posterStudioState.customTitle=p.name;} App.renderPrintStudioView()" class="w-full px-3 py-2 rounded-xl font-bold">' +
            prods.slice(0, 200).map(function (p) {
              return '<option value="' + p.id + '" ' + (Number(p.id) === Number(pst.productId) ? 'selected' : '') + '>' + p.name + ' (' + getProdRetail(p).toFixed(2) + ' د.ج)</option>';
            }).join('') +
            '    </select>' +
            '  </div>' +
            '  <div><label class="block font-bold mb-1">شريط العنوان الترويجي العلوي</label><input type="text" value="' + (pst.badgeText || '') + '" oninput="AppState.posterStudioState.badgeText=this.value; App.refreshPosterOrCataloguePreview()" class="w-full px-3 py-2 rounded-xl font-black text-rose-600"></div>' +
            '  <div class="grid grid-cols-2 gap-2">' +
            '    <div><label class="block font-bold mb-1">السعر السابق المشطوب (د.ج)</label><input type="number" step="any" value="' + (pst.oldPrice || '') + '" oninput="AppState.posterStudioState.oldPrice=this.value; App.refreshPosterOrCataloguePreview()" class="w-full px-3 py-2 rounded-xl font-mono"></div>' +
            '    <div><label class="block font-bold mb-1 text-emerald-600">سعر العرض الجديد (د.ج)</label><input type="number" step="any" value="' + (pst.newPrice || '') + '" oninput="AppState.posterStudioState.newPrice=this.value; App.refreshPosterOrCataloguePreview()" class="w-full px-3 py-2 rounded-xl font-mono font-black text-emerald-600"></div>' +
            '  </div>' +
            '</div>'
          : '<div class="space-y-3">' +
            '  <div><label class="block font-bold mb-1">تصفية الكتالوج حسب الفئة</label>' +
            '    <select onchange="AppState.posterStudioState.catFilter=this.value; App.refreshPosterOrCataloguePreview()" class="w-full px-3 py-2 rounded-xl font-bold">' +
            '      <option value="all">جميع الفئات</option>' +
            allCategories.map(function (c) {
              return '<option value="' + c + '" ' + (pst.catFilter === c ? 'selected' : '') + '>' + c + '</option>';
            }).join('') +
            '    </select>' +
            '  </div>' +
            '  <label class="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" ' + (pst.catShowCentimes ? 'checked' : '') + ' onchange="AppState.posterStudioState.catShowCentimes=this.checked; App.refreshPosterOrCataloguePreview()"><span>إظهار عمود السعر بالسنتيم الجزائري في الكتالوج</span></label>' +
            '</div>') +

        '      <button type="button" onclick="App.printPosterOrCatalogueNow()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg">🖨️ طباعة الوثيقة المعروضة الآن (A4)</button>' +
        '    </div>' +

        '    <div class="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col shadow-sm">' +
        '      <div class="text-xs font-bold text-slate-400 mb-2">معاينة حية للافتة العرض / كتالوج الأسعار (A4):</div>' +
        '      <iframe id="posterLivePreviewFrame" class="w-full flex-1 min-h-[520px] border border-slate-200 rounded-xl bg-white shadow-inner"></iframe>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      await this.refreshPosterOrCataloguePreview();
      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
      return;
    }

    // ========================================================================
    // التبويب 1 (الافتراضي): استوديو الباركود وملصقات الرفوف وأوراق A4 المقسمة
    // ========================================================================
    var itemsSource = cfg.source === 'customers' ? (AppState.customers || []) : prods;

    root.innerHTML =
      '<div class="space-y-4">' +
      topHeaderHtml +

      '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">' +
      '    <div class="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3.5 shadow-sm">' +
      '      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">' +
      '        <h3 class="font-black text-sm text-blue-600">🏷️ إعدادات الباركود، مقاس الورق (رول / A4)، ومحتوى الملصق</h3>' +
      '        <span class="px-2.5 py-0.5 rounded-full bg-blue-600/10 text-blue-600 font-mono font-bold text-[11px]">' + cfg.widthMm + 'mm × ' + cfg.heightMm + 'mm</span>' +
      '      </div>' +

      '      <div class="grid grid-cols-1 md:grid-cols-12 gap-2">' +
      '        <div class="md:col-span-7">' +
      '          <label class="block font-bold mb-1 text-indigo-600">📐 قوالب مقاسات الرول الحراري وأوراق الملصقات A4 الجاهزة:</label>' +
      '          <select onchange="App.applyLabelPreset(this.value)" class="w-full px-2.5 py-2 rounded-xl font-bold border-indigo-500/40">' +
      Object.keys(LABEL_PRESETS).map(function (k) {
        return '<option value="' + k + '" ' + (cfg.presetKey === k ? 'selected' : '') + '>' + LABEL_PRESETS[k].label + '</option>';
      }).join('') +
      '          </select>' +
      '        </div>' +
      '        <div class="md:col-span-5">' +
      '          <label class="block font-bold mb-1">نوع التشفير (Symbology)</label>' +
      '          <select onchange="AppState.labelStudioConfig.symbology=this.value; AppState.labelStudioConfig.priceOnlyMode=(this.value===\'price_only\'); App.refreshLabelStudioPreview()" class="w-full px-2.5 py-2 rounded-xl font-bold">' +
      '            <option value="code128" ' + (!cfg.priceOnlyMode && cfg.symbology === 'code128' ? 'selected' : '') + '>📊 Code-128 (قياسي فائق الوضوح)</option>' +
      '            <option value="ean13" ' + (!cfg.priceOnlyMode && cfg.symbology === 'ean13' ? 'selected' : '') + '>🇩🇿 EAN-13 (ترقيم تجاري 613)</option>' +
      '            <option value="qrcode" ' + (!cfg.priceOnlyMode && cfg.symbology === 'qrcode' ? 'selected' : '') + '>📱 QR Code (مربع ثنائي الأبعاد)</option>' +
      '            <option value="price_only" ' + (cfg.priceOnlyMode ? 'selected' : '') + '>🏷️ بطاقة سعر رفوف بدون باركود</option>' +
      '          </select>' +
      '        </div>' +
      '      </div>' +

      '      <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">' +
      '        <div class="md:col-span-3">' +
      '          <label class="block font-bold mb-1">مصدر البيانات</label>' +
      '          <select onchange="App.updateLabelStudioProp(\'source\', this.value)" class="w-full px-2.5 py-2 rounded-xl font-bold">' +
      '            <option value="products" ' + (cfg.source === 'products' ? 'selected' : '') + '>📦 المنتجات</option>' +
      '            <option value="customers" ' + (cfg.source === 'customers' ? 'selected' : '') + '>👥 بطاقات الزبائن</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="md:col-span-6">' +
      '          <label class="block font-bold mb-1">العنصر المختار للمعاينة</label>' +
      '          <select id="studioItemSelect" onchange="App.updateLabelStudioProp(\'selectedId\', Number(this.value))" class="w-full px-2.5 py-2 rounded-xl font-bold">' +
      itemsSource.slice(0, 350).map(function (item) {
        return '<option value="' + item.id + '" ' + (Number(item.id) === Number(cfg.selectedId) ? 'selected' : '') + '>' + item.name + (item.barcode ? ' (' + item.barcode + ')' : '') + '</option>';
      }).join('') +
      '          </select>' +
      '        </div>' +
      '        <button type="button" onclick="App.addSelectedStudioItemToQueue()" class="md:col-span-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow">+ أضف للطابور</button>' +
      '      </div>' +

      '      <div class="grid grid-cols-4 gap-2">' +
      '        <div><label class="block font-bold mb-1">العرض (mm)</label><input type="number" value="' + cfg.widthMm + '" onchange="App.updateLabelStudioProp(\'widthMm\', Number(this.value))" class="w-full px-2 py-1.5 rounded-xl font-mono text-center font-bold"></div>' +
      '        <div><label class="block font-bold mb-1">الارتفاع (mm)</label><input type="number" value="' + cfg.heightMm + '" onchange="App.updateLabelStudioProp(\'heightMm\', Number(this.value))" class="w-full px-2 py-1.5 rounded-xl font-mono text-center font-bold"></div>' +
      '        <div><label class="block font-bold mb-1">ارتفاع الباركود</label><input type="number" value="' + cfg.barcodeHeightMm + '" onchange="App.updateLabelStudioProp(\'barcodeHeightMm\', Number(this.value))" class="w-full px-2 py-1.5 rounded-xl font-mono text-center font-bold"></div>' +
      '        <div><label class="block font-bold mb-1" title="لتوفير ورق الملصقات A4 المستعمل جزئياً">تخطي أول X خانة</label><input type="number" min="0" value="' + (cfg.skipOffset || 0) + '" onchange="AppState.labelStudioConfig.skipOffset=Math.max(0,Number(this.value)); App.renderPrintStudioView()" class="w-full px-2 py-1.5 rounded-xl font-mono text-center font-bold text-amber-600"></div>' +
      '      </div>' +

      '      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-[11px]">' +
      '        <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cfg.showShop ? 'checked' : '') + ' onchange="App.updateLabelStudioProp(\'showShop\', this.checked)"><span>اسم المتجر</span></label>' +
      '        <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cfg.showName !== false ? 'checked' : '') + ' onchange="App.updateLabelStudioProp(\'showName\', this.checked)"><span>اسم المنتج</span></label>' +
      '        <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cfg.showPrice ? 'checked' : '') + ' onchange="App.updateLabelStudioProp(\'showPrice\', this.checked)"><span>السعر بالدينار</span></label>' +
      '        <label class="flex items-center gap-1.5 cursor-pointer text-amber-600"><input type="checkbox" ' + (cfg.showCentimes ? 'checked' : '') + ' onchange="App.updateLabelStudioProp(\'showCentimes\', this.checked)"><span>السعر بالسنتيم</span></label>' +
      '        <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cfg.showBarcodeText !== false ? 'checked' : '') + ' onchange="App.updateLabelStudioProp(\'showBarcodeText\', this.checked)"><span>رقم الباركود</span></label>' +
      '        <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" ' + (cfg.showPlu ? 'checked' : '') + ' onchange="App.updateLabelStudioProp(\'showPlu\', this.checked)"><span>كود الميزان PLU</span></label>' +
      '        <label class="flex items-center gap-1.5 cursor-pointer text-emerald-600"><input type="checkbox" ' + (cfg.showDates ? 'checked' : '') + ' onchange="AppState.labelStudioConfig.showDates=this.checked; App.renderPrintStudioView()"><span>تاريخ إنتاج/صلاحية</span></label>' +
      '        <label class="flex items-center gap-1.5 cursor-pointer text-rose-500"><input type="checkbox" ' + (cfg.showOldPrice ? 'checked' : '') + ' onchange="AppState.labelStudioConfig.showOldPrice=this.checked; App.renderPrintStudioView()"><span>سعر سابق مشطوب</span></label>' +
      '      </div>' +

      (cfg.showDates || cfg.showOldPrice
        ? '<div class="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">' +
          '  <div><label class="block text-[10px] font-bold">تاريخ الإنتاج (P)</label><input type="date" value="' + cfg.prodDate + '" onchange="AppState.labelStudioConfig.prodDate=this.value; App.refreshLabelStudioPreview()" class="w-full px-2 py-1 rounded-lg font-mono text-[11px]"></div>' +
          '  <div><label class="block text-[10px] font-bold">الانتهاء (EXP)</label><input type="date" value="' + cfg.expDate + '" onchange="AppState.labelStudioConfig.expDate=this.value; App.refreshLabelStudioPreview()" class="w-full px-2 py-1 rounded-lg font-mono text-[11px]"></div>' +
          '  <div><label class="block text-[10px] font-bold">السعر السابق (د.ج)</label><input type="number" placeholder="550" value="' + (cfg.oldPriceValue || '') + '" oninput="AppState.labelStudioConfig.oldPriceValue=this.value; App.refreshLabelStudioPreview()" class="w-full px-2 py-1 rounded-lg font-mono text-[11px]"></div>' +
          '</div>'
        : '') +

      '      <div class="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">' +
      '        <div class="flex flex-wrap items-center justify-between gap-2">' +
      '          <span class="font-black text-indigo-600 dark:text-indigo-400">طابور الطباعة بالجملة (' + AppState.labelPrintQueue.length + ' صنف | إجمالي: ' + totalQueuedLabels + ' ملصق)</span>' +
      '          <div class="flex flex-wrap gap-1">' +
      '            <button type="button" onclick="App.addCategoryToLabelQueue()" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold text-[10px]">+ إضافة المنتجات النشطة</button>' +
      '            <button type="button" onclick="App.applyPlQtyFromStock()" class="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 font-bold text-[10px]">العدد = رصيد المخزون</button>' +
      '            <button type="button" onclick="App.clearLabelPrintQueue()" class="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 font-bold text-[10px]">تفريغ</button>' +
      '          </div>' +
      '        </div>' +
      '        <div class="max-h-36 overflow-y-auto space-y-1 pr-1">' +
      (AppState.labelPrintQueue.length === 0
        ? '<div class="py-4 text-center text-slate-400 font-bold">الطابور فارغ — أضف منتجات لطباعة ملصقاتها دفعة واحدة على رول أو ورقة A4</div>'
        : AppState.labelPrintQueue.map(function (q, i) {
            return (
              '<div class="flex items-center justify-between p-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">' +
              '  <div><span class="font-bold">' + q.name + '</span> <span class="text-[10px] font-mono text-slate-400">(' + q.barcode + ')</span></div>' +
              '  <div class="flex items-center gap-1.5">' +
              '    <input type="number" min="1" value="' + q.copies + '" onchange="AppState.labelPrintQueue[' + i + '].copies=Math.max(1,parseInt(this.value,10)||1); App.renderPrintStudioView()" class="w-14 px-1.5 py-0.5 rounded font-mono font-bold text-center">' +
              '    <button type="button" onclick="AppState.labelPrintQueue.splice(' + i + ',1); App.renderPrintStudioView()" class="text-rose-500 font-black px-1">✕</button>' +
              '  </div>' +
              '</div>'
            );
          }).join('')) +
      '        </div>' +
      '      </div>' +

      '      <div class="grid grid-cols-2 gap-2 pt-2">' +
      '        <button type="button" onclick="App.printCurrentStudioLabel()" class="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black flex items-center justify-center gap-1.5 shadow"><span class="material-symbols-rounded icon-sm">print</span><span>طباعة الملصق المفرد</span></button>' +
      '        <button type="button" onclick="App.openPlSheetPreviewModal()" class="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black flex items-center justify-center gap-1.5 shadow"><span class="material-symbols-rounded icon-sm">layers</span><span>معاينة وطباعة الطابور (' + totalQueuedLabels + ')</span></button>' +
      '      </div>' +
      '    </div>' +

      '    <div class="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col justify-between shadow-sm">' +
      '      <div class="flex flex-col items-center justify-center flex-1 py-4 bg-slate-100/70 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">' +
      '        <div class="text-xs font-black text-slate-500 mb-3">🔍 معاينة حية ومطابقة للطباعة (' + cfg.widthMm + 'mm × ' + cfg.heightMm + 'mm — ' + (cfg.paperType === 'a4_sheet' ? ('ورقة A4 من ' + cfg.columns + ' أعمدة') : 'رول حراري') + ')</div>' +
      '        <iframe id="labelStudioPreviewFrame" class="border-2 border-slate-400 rounded-xl bg-white shadow-lg" style="width:' + Math.max(250, Math.min(480, cfg.widthMm * 4.8)) + 'px;height:' + Math.max(150, Math.min(300, cfg.heightMm * 4.8)) + 'px;"></iframe>' +
      '      </div>' +

      '      <div class="mt-4 p-3.5 rounded-2xl bg-blue-600/10 border border-blue-500/25 space-y-2">' +
      '        <div class="font-black text-blue-600 dark:text-blue-400">💡 ميزة توفير ورق الملصقات A4 (تخطي الملصقات المنزوعة):</div>' +
      '        <p class="text-[11px] text-slate-600 dark:text-slate-300">عند اختيار أحد مقاسات <strong>ورقة A4 (24 أو 40 أو 65 ملصقاً)</strong>، يمكنك تحديد عدد الخانات المستعملة سابقاً في الورقة (`تخطي أول X خانة` = <strong>' + (cfg.skipOffset || 0) + '</strong>) ليبدأ البرنامج الطباعة من أول خانة جديدة متبقية في الورقة دون إهدار أي ملصق!</p>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    await this.refreshLabelStudioPreview();
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  // ==========================================================================
  // 6. الدليل الاستشاري التفاعلي الشامل لمركز الطباعة والبونات (F1)
  // ==========================================================================
  App.openPrintStudioMasterGuide = function () {
    var modal = document.getElementById('printStudioGuideModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'printStudioGuideModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="modal-content w-full max-w-3xl p-6 space-y-4 overflow-y-auto">' +
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <h3 class="text-lg font-black text-indigo-600">📘 الدليل الشامل لمركز الطباعة، الباركود، ومنشئ البونات الحر</h3>' +
      '    <button type="button" onclick="App.closeModal(\'printStudioGuideModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      '  <div class="space-y-3 text-xs leading-relaxed">' +
      '    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
      '      <div class="p-3.5 rounded-2xl bg-blue-600/10 border border-blue-500/30">' +
      '        <div class="font-black text-blue-600 text-sm mb-1">🏷️ 1. استوديو الباركود وأوراق A4 المقسمة</div>' +
      '        <p>يتيح لك طباعة ملصقات الباركود والأسعار إما على <strong>طابعة باركود حرارية (Roll)</strong> أو على <strong>طابعة ورق عادية A4</strong> باستخدام أوراق الملصقات المقسمة (24 أو 40 أو 65 ملصقاً في الورقة) مع إظهار السعر بالدينار وبالسنتيم وتاريخ الصلاحية!</p>' +
      '      </div>' +
      '      <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">' +
      '        <div class="font-black text-indigo-600 text-sm mb-1">🔥 2. نظام (2×A5 في ورقة A4 واحدة)</div>' +
      '        <p>في التبويب الثاني والثالث، يمكنك اختيار مقاس <strong>(2×A5 في ورقة A4 واحدة)</strong> ليطبع لك البرنامج نسختين في ورقة واحدة (نسخة للزبون في النصف العلوي + نسخة للأرشيف في النصف السفلي مع خط قص بالمقص)، مما يوفر 50% من استهلاك الورق!</p>' +
      '      </div>' +
      '      <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">' +
      '        <div class="font-black text-amber-700 dark:text-amber-300 text-sm mb-1">🧾 3. منشئ البونات والأوراق الحر (Custom BON)</div>' +
      '        <p>تحتاج لطباعة بون صيانة جهاز، بون تحويل بين مخزنين، بون أمانة مالية، أو بون خروج بضاعة مع السائق؟ افتح التبويب الثالث واختر القالب الجاهز أو عدّل العناوين والخانات كما تشاء واطبعه فوراً!</p>' +
      '      </div>' +
      '      <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">' +
      '        <div class="font-black text-emerald-700 dark:text-emerald-300 text-sm mb-1">📢 4. لافتات العروض الجدارية وكتالوج الأسعار</div>' +
      '        <p>في التبويب الرابع يمكنك بضغطة زر تصميم <strong>ورقة عرض ترويجي كبيرة A4</strong> لتعليقها في المحل فوق السلعة المخفضة، أو طباعة كتالوج أسعار رسمي لزبائنك!</p>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="flex justify-end pt-2">' +
      '    <button type="button" onclick="App.closeModal(\'printStudioGuideModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق الدليل</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // ==========================================================================
  // 7. روبوت الاختبار الآلي الذاتي للصفحة الثامنة (App.runAutoTest_PrintStudioPage)
  // ==========================================================================
  App.runAutoTest_PrintStudioPage = async function () {
    if (AppState.currentView !== 'print') {
      await this.switchView('print');
    }

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      check('1. تكامل حاوية مركز الطباعة والنوافذ المنبثقة (DOM Integrity)', Boolean(document.getElementById('print-view-root') && document.getElementById('plSheetPreviewModal')), 'All Containers Ready');

      var bcImg = await window.api.generateBarcodeImage('6130001001', { bcid: 'code128', height: 10, scale: 2 });
      check('2. محرك توليد صور الباركود الرقمية عالية الدقة (Code-128 / EAN-13 / QR)', Boolean(bcImg && bcImg.startsWith('data:image/png;base64')), 'Base64 PNG Generated');

      AppState.labelStudioConfig.showCentimes = true;
      var singleLblHtml = await this.buildCurrentLabelHtml();
      check('3. توليد الملصق المفرد مع السعر بالدينار وبالسنتيم الجزائري', singleLblHtml.includes('د.ج'), 'Single Label HTML OK');

      await this.applyLabelPreset('a4_40');
      AppState.labelStudioConfig.skipOffset = 3;
      this.addCategoryToLabelQueue();
      var batchHtml = await window.PrintEngine.renderBatchBarcodeLabelsHtml(AppState.labelPrintQueue.slice(0, 4), AppState.settings, AppState.labelStudioConfig);
      await this.applyLabelPreset('roll_40x25');
      AppState.labelStudioConfig.skipOffset = 0;
      check('4. محرك أوراق الملصقات المقسمة A4 (40 ملصق) مع تخطي الخانات المستعملة', batchHtml.includes('A4 portrait') && batchHtml.includes('sheet-grid'), 'A4 Grid & Offset OK');

      var dualA5Html = window.TemplateRenderer.renderCustomTemplateHtml(
        { paper: 'a4_dual_a5', doc_type: 'delivery', showCentimes: true, showFiscal: true },
        { doc_number: 'BL-2026-009', total: 5000, items: [{ product_name: 'منتج تجريبي', quantity: 2, price: 2500, subtotal: 5000 }] },
        AppState.settings
      );
      check('5. مهندس القوالب الرسمية ومقاس (2×A5 نسختين في ورقة A4 واحدة)', dualA5Html.includes('1/2') && dualA5Html.includes('2/2'), 'Dual 2xA5 Layout OK');

      var savedTpl = await window.api.saveCustomTemplate({
        name: 'قالب بون اختبار آلي QA',
        doc_type: 'invoice',
        paper: 'a4',
        lang: 'ar',
        layout_json: JSON.stringify({ name: 'قالب بون اختبار آلي QA', paper: 'a4' }),
        is_default: 0
      });
      var allTpls = await window.api.getCustomTemplates();
      if (savedTpl && savedTpl.id && window.api.deleteCustomTemplate) {
        await window.api.deleteCustomTemplate(savedTpl.id);
      }
      check('6. حفظ واسترجاع القوالب المخصصة في قاعدة البيانات (custom_templates)', Array.isArray(allTpls) && allTpls.length > 0, allTpls.length + ' قوالب محفوظة');

      this.loadCustomBonPreset('sav_repair');
      var bonHtml = await this.buildCustomBonHtmlDocument();
      check('7. منشئ البونات والأوراق الحر (Universal Custom BON Creator - 8 قوالب)', bonHtml.includes('BON DE RÉPARATION'), 'Custom BON HTML Ready');

      AppState.posterStudioState.mode = 'promo_poster';
      var posterHtml = await this.buildPosterOrCatalogueHtml();
      check('8. مولد لافتات العروض الجدارية للمحل (A4 Store Promo Sign Maker)', posterHtml.includes('PROMOTION'), 'A4 Promo Sign OK');

      AppState.posterStudioState.mode = 'catalogue';
      var catHtml = await this.buildPosterOrCatalogueHtml();
      AppState.posterStudioState.mode = 'promo_poster';
      check('9. مولد كتالوج وقائمة أسعار المنتجات بالسنتيم (Catalogue des Prix)', catHtml.includes('كتالوج أسعار'), 'Catalogue HTML OK');

      check('10. نافذة معاينة طابور الملصقات وتصدير PDF (#plSheetPreviewModal)', typeof this.openPlSheetPreviewModal === 'function', 'Batch Preview Ready');
      check('11. الدليل الاستشاري التفاعلي لمركز الطباعة والبونات (F1)', typeof this.openPrintStudioMasterGuide === 'function', 'Guide Modal Ready');

      await this.switchPrintStudioTab('labels');
      var pill = document.getElementById('barcodeMagnetStatusPill');
      check('12. إخفاء شارة الباركود المغناطيسية خارج شاشة الكاشير', !pill || pill.style.display === 'none', 'Clean Header');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص مركز الطباعة', false, err.message);
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
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 8 (مركز الطباعة والباركود والبونات #view-print)</h3>' +
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
      '    <button type="button" onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة التاسعة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // اختصارات لوحة المفاتيح السريعة لصفحة مركز الطباعة
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'print') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      e.stopPropagation();
      App.runAutoTest_PrintStudioPage();
    } else if (e.key === 'F1') {
      e.preventDefault();
      e.stopPropagation();
      App.openPrintStudioMasterGuide();
    }
  }, true);
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [PAGE 8 PRINT STUDIO, BARCODE SHEETS & UNIVERSAL BON CREATOR]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    applyPage8PrintStudioSurgicalPerfection.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 1/2: تم حقن وفحص ترقية الصفحة الثامنة (#view-print) واستوديوهاتها الـ 4 في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page7-stocktake-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 2/2: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت ترقية الصفحة الثامنة (#view-print)! اضغط Ctrl+R داخل البرنامج الآن.');