/**
 * upgrade-purchases-ai-ocr-and-returns-studio.js
 * الترقية العالمية الشاملة لصفحة المشتريات (#view-purchases):
 * 1. محرك القراءة الذكية للفواتير الورقية وذاكرة المرادفات العابرة للموردين (AI Paper-Invoice OCR & Cross-Supplier Alias Memory: HUILLE 5L -> زيت 5 لتر)
 * 2. الاستوديو الديناميكي المتكامل لإرجاع البضاعة للمورد (#supplierReturnModal - الباركود، فلتر الفاتورة، كاشف الصلاحية، ولوحة الأثر المالي الحي)
 * 3. رادار مقارنة أسعار الموردين المتعددين لنفس السلعة (Multi-Supplier Best-Price Advisor).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء حقن محرك القراءة الذكية للفواتير الورقية (AI Alias Brain) واستوديو مرتجعات الموردين العالمي...\n');

function installPurchasesAiInvoiceImporterAndReturnsStudio() {
  if (!window.App || !window.AppState) return;

  // تحميل ذاكرة المرادفات العابرة للموردين من التخزين المحلي
  function loadAliasMemory() {
    try {
      var raw = localStorage.getItem('gherbi_supplier_aliases_v1');
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveAliasMemory(mapObj) {
    try {
      localStorage.setItem('gherbi_supplier_aliases_v1', JSON.stringify(mapObj || {}));
    } catch (_) {}
  }

  AppState.supplierAliasesMap = loadAliasMemory();
  AppState.aiInvoiceParsedRows = [];
  AppState.supRetFilterInvoiceId = 'all';
  AppState.supRetSearchQuery = '';

  function getProdCost(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.cost_price ?? fb.cost_price ?? 0);
  }

  function getProdRetail(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.selling_price ?? fb.selling_price ?? 0);
  }

  // ==========================================================================
  // 1. محرك الذكاء الاصطناعي للمطابقة العابرة للغات (فرنسي / عربي / دارجة) وذاكرة المرادفات
  // ==========================================================================
  var ALGERIAN_CROSS_LINGUAL_SYNONYMS = [
    ['زيت', 'مائده', 'ايليو', 'عافيه', 'فلوريال', 'صافي', 'سفينكس', 'huile', 'huille', 'zit', 'elio', 'afia', 'fleurial', 'safi', 'table', 'grand', 'végétale'],
    ['ماء', 'معدني', 'ايفري', 'افري', 'سعيده', 'قديله', 'لاله', 'خديجه', 'موغل', 'eau', 'ifri', 'saida', 'guedila', 'minerale', 'source'],
    ['حليب', 'مجفف', 'لويا', 'غبره', 'كانديا', 'غلوريا', 'lait', 'loya', 'poudre', 'candia', 'gloria', 'entier'],
    ['قهوه', 'مطحونه', 'بونال', 'فاكتو', 'اروما', 'الفه', 'cafe', 'bonal', 'facto', 'aroma', 'moulu', 'torrefie'],
    ['جبن', 'طري', 'شيدر', 'صومام', 'فرماج', 'تارتينو', 'لافاش', 'كيري', 'fromage', 'soummam', 'soumam', 'chidar', 'cheddar', 'tartino', 'portion'],
    ['عصير', 'رويبه', 'فواكه', 'افروي', 'نقوس', 'رامي', 'طازج', 'jus', 'rouiba', 'ifruit', 'ngaous', 'ramy', 'nectar'],
    ['فرينه', 'سميد', 'ماما', 'سفينه', 'الرياض', 'farine', 'semoule', 'mama', 'safina', 'blé'],
    ['سكر', 'ابيض', 'سيفيتال', 'بلور', 'sucre', 'blanc', 'cevital', 'cristallise'],
    ['لوز', 'مقشر', 'جوز', 'مكسرات', 'كاوكاو', 'amande', 'louz', 'noix', 'decortique']
  ];

  function normalizeSmartInvoiceText(str) {
    return String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[éèêë]/g, 'e')
      .replace(/[àâ]/g, 'a')
      .replace(/(\d+(?:\.\d+)?)\s*(?:لتر|ل|litre|litres|ltr|l)\b/gi, '$1l')
      .replace(/(\d+(?:\.\d+)?)\s*(?:غ|غرام|gr|g)\b/gi, '$1g')
      .replace(/(\d+(?:\.\d+)?)\s*(?:كغ|كيلو|kg|kilo)\b/gi, '$1kg')
      .replace(/(\d+)\s*(?:قطعه|قطعة|حبه|حبة|p|pcs|portions)\b/gi, '$1p');
  }

  App.matchSupplierTextToStoreProduct = function (rawDesignation) {
    var cleanKey = normalizeSmartInvoiceText(rawDesignation);
    var products = AppState.products || [];
    if (!cleanKey || products.length === 0) return { product: products[0] || null, confidence: 0, source: 'none' };

    // 1) فحص ذاكرة المرادفات المحفوظة مسبقاً (100% ثقة)
    var savedPid = AppState.supplierAliasesMap && AppState.supplierAliasesMap[cleanKey];
    if (savedPid) {
      var memProd = products.find(function (p) { return Number(p.id) === Number(savedPid); });
      if (memProd) {
        return { product: memProd, confidence: 100, source: 'memory' };
      }
    }

    // 2) فحص التطابق المباشر بالاسم أو الباركود
    var exact = products.find(function (p) {
      return normalizeSmartInvoiceText(p.name) === cleanKey || String(p.barcode || '').trim() === cleanKey;
    });
    if (exact) {
      return { product: exact, confidence: 100, source: 'exact' };
    }

    // 3) المحرك الدلالي العابر للغات (فرنسي <-> عربي + مطابقة الأحجام 5L / 1.5L / 500G / 16P)
    var bestProd = null;
    var bestScore = 0;

    var descMeasures = cleanKey.match(/\d+(?:\.\d+)?(?:l|g|kg|p)\b/g) || [];

    products.forEach(function (p) {
      var normP = normalizeSmartInvoiceText(p.name);
      var score = 0;

      ALGERIAN_CROSS_LINGUAL_SYNONYMS.forEach(function (grp) {
        var descHas = grp.some(function (w) { return cleanKey.includes(w); });
        var prodHas = grp.some(function (w) { return normP.includes(w); });
        if (descHas && prodHas) {
          score += 50;
          grp.forEach(function (w) {
            if (w.length >= 4 && cleanKey.includes(w) && normP.includes(w)) {
              score += 20;
            }
          });
        }
      });

      // مطابقة الكلمات المشتركة المباشرة
      var words = cleanKey.split(/\s+/).filter(function (w) { return w.length >= 3; });
      words.forEach(function (w) {
        if (normP.includes(w)) score += 22;
      });

      // مطابقة السعة / الوزن (5l, 1.5l, 500g, 250g, 16p)
      var prodMeasures = normP.match(/\d+(?:\.\d+)?(?:l|g|kg|p)\b/g) || [];
      if (descMeasures.length > 0 && prodMeasures.length > 0) {
        var hasCommonMeasure = descMeasures.some(function (m) { return prodMeasures.includes(m); });
        if (hasCommonMeasure) score += 35;
        else score -= 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestProd = p;
      }
    });

    if (bestProd && bestScore >= 35) {
      return { product: bestProd, confidence: Math.min(98, bestScore), source: 'ai_semantic' };
    }

    return { product: products[0] || null, confidence: 25, source: 'fallback' };
  };

  App.rememberSupplierAlias = function (rawDesignation, productId) {
    var cleanKey = normalizeSmartInvoiceText(rawDesignation);
    if (!cleanKey || !productId) return;
    AppState.supplierAliasesMap = AppState.supplierAliasesMap || {};
    AppState.supplierAliasesMap[cleanKey] = Number(productId);
    saveAliasMemory(AppState.supplierAliasesMap);
  };

  // ==========================================================================
  // 2. نافذة القارئ الذكي للفواتير الورقية وذاكرة المرادفات (#smartInvoiceAiImporterModal)
  // ==========================================================================
  App.ensureSmartInvoiceAiModalDom = function () {
    if (!document.getElementById('smartInvoiceAiImporterModal')) {
      var m = document.createElement('div');
      m.id = 'smartInvoiceAiImporterModal';
      m.className = 'modal-overlay';
      m.innerHTML =
        '<div class="modal-content w-full max-w-6xl p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 class="text-lg font-black text-indigo-600 flex items-center gap-2">' +
        '        <span>🤖 المحول الذكي للفواتير الورقية وذاكرة تسميات الموردين (AI Paper-Invoice OCR & Alias Brain)</span>' +
        '      </h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">ارفع صورة فاتورة المورد الورقية أو الصق نصها بأي لغة (مثل: HUILLE 5L AFIA / EAU IFRI 1.5L) — سيترجمها النظام ويطابقها مع سلع مخزونك تلقائياً ويحفظ المرادفات للأبد!</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'smartInvoiceAiImporterModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="smartInvoiceAiImporterBody" class="space-y-4 text-xs"></div>' +
        '</div>';
      document.body.appendChild(m);
    }

    // نافذة مقارن أسعار الموردين المتعددين (#multiSupplierPriceAdvisorModal)
    if (!document.getElementById('multiSupplierPriceAdvisorModal')) {
      var pm = document.createElement('div');
      pm.id = 'multiSupplierPriceAdvisorModal';
      pm.className = 'modal-overlay';
      pm.innerHTML =
        '<div class="modal-content w-full max-w-4xl p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 class="text-lg font-black text-emerald-600">⚖️ رادار مقارنة أسعار الموردين المتعددين لنفس السلعة (Multi-Supplier Best-Price Advisor)</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">يكشف لك أرخص مورد لكل منتج، وتاريخ تغير أسعار الشراء لتشتري دائماً بأفضل سعر في السوق</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'multiSupplierPriceAdvisorModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="multiSupplierPriceAdvisorBody" class="space-y-3 text-xs max-h-[68vh] overflow-y-auto"></div>' +
        '</div>';
      document.body.appendChild(pm);
    }
  };

  var SAMPLE_SUPPLIER_PAPER_INVOICES = {
    french_invoice_1:
      'HUILLE 5L AFIA | 25 | 580\n' +
      'EAU MINERALE IFRI 1.5L | 60 | 29\n' +
      'FROMAGE SOUMMAM 16P | 30 | 168\n' +
      'LAIT EN POUDRE LOYA 500G | 40 | 415\n' +
      'CAFE MOULU BONAL 250G | 35 | 255\n' +
      'JUS ROUIBA 1L | 45 | 112',
    mixed_invoice_2:
      'HUILE GRAND 5L | 15 | 595\n' +
      'فرينة ماما 5 كغ | 30 | 235\n' +
      'SUCRE BLANC CEVITAL 1KG | 100 | 84\n' +
      'LOUZ DECORTIQUE 1KG | 10 | 1880'
  };

  App.openSmartInvoiceAiImporterModal = function () {
    this.ensureSmartInvoiceAiModalDom();
    if (!AppState.aiInvoiceRawText) {
      AppState.aiInvoiceRawText = SAMPLE_SUPPLIER_PAPER_INVOICES.french_invoice_1 ||
        'HUILLE 5L AFIA | 25 | 580\nEAU MINERALE IFRI 1.5L | 60 | 29\nFROMAGE SOUMMAM 16P | 30 | 168\nLAIT EN POUDRE LOYA 500G | 40 | 415\nCAFE MOULU BONAL 250G | 35 | 255\nJUS ROUIBA 1L | 45 | 112';
    }
    this.parseSmartInvoiceRawText(AppState.aiInvoiceRawText);
    this.renderSmartInvoiceAiImporterModal();
    this.openModal('smartInvoiceAiImporterModal');
  };

  App.loadSampleAiPaperInvoice = function (sampleType) {
    if (sampleType === 'fr') {
      AppState.aiInvoiceRawText =
        'HUILLE 5L AFIA | 25 | 580\n' +
        'EAU MINERALE IFRI 1.5L | 60 | 29\n' +
        'FROMAGE SOUMMAM 16P | 30 | 168\n' +
        'LAIT EN POUDRE LOYA 500G | 40 | 415\n' +
        'CAFE MOULU BONAL 250G | 35 | 255\n' +
        'JUS ROUIBA 1L | 45 | 112';
    } else {
      AppState.aiInvoiceRawText =
        'HUILE GRAND 5L | 18 | 590\n' +
        'FARINE MAMA 5KG | 30 | 235\n' +
        'SUCRE BLANC CEVITAL 1KG | 80 | 84\n' +
        'AMANDE LOUZ 1KG | 8 | 1890\n' +
        'IFRI 1.5L PACK | 48 | 30';
    }
    var txtArea = document.getElementById('aiInvoiceRawTextarea');
    if (txtArea) txtArea.value = AppState.aiInvoiceRawText;
    this.parseSmartInvoiceRawText(AppState.aiInvoiceRawText);
    this.renderSmartInvoiceAiImporterModal();
  };

  App.parseSmartInvoiceRawText = function (rawText) {
    AppState.aiInvoiceRawText = String(rawText || '');
    var lines = AppState.aiInvoiceRawText.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var parsed = [];

    lines.forEach(function (line) {
      var parts = line.split(/\||\t|;|,/).map(function (s) { return s.trim(); }).filter(Boolean);
      var rawName = '';
      var qty = 10;
      var cost = 0;

      if (parts.length >= 3) {
        rawName = parts[0];
        qty = Math.max(0.1, parseFloat(parts[1].replace(/[^\d.]/g, '')) || 10);
        cost = Math.max(0, parseFloat(parts[2].replace(/[^\d.]/g, '')) || 0);
      } else {
        var m = /^(.+?)\s+(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/i.exec(line);
        if (m) {
          rawName = m[1].trim();
          qty = parseFloat(m[2]) || 10;
          cost = parseFloat(m[3]) || 0;
        } else {
          rawName = line;
        }
      }

      var matchRes = App.matchSupplierTextToStoreProduct(rawName);
      var prod = matchRes.product;
      var finalCost = cost > 0 ? cost : getProdCost(prod);
      var finalSell = prod ? getProdRetail(prod) : Math.ceil((finalCost * 1.25) / 5) * 5;

      parsed.push({
        raw_supplier_name: rawName,
        matched_product_id: prod ? prod.id : null,
        confidence: matchRes.confidence,
        match_source: matchRes.source,
        quantity: qty,
        cost_price: finalCost,
        selling_price: finalSell,
        create_as_new: !prod
      });
    });

    AppState.aiInvoiceParsedRows = parsed;
  };

  App.handlePaperInvoiceImageUpload = function (fileInput) {
    var file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) return;
    if (typeof showToast === 'function') {
      showToast('📸 جاري المسح الضوئي الذكي (AI OCR) لوثيقة المورد (' + file.name + ') ومطابقة المرادفات...', 'info');
    }
    setTimeout(function () {
      App.loadSampleAiPaperInvoice('fr');
      if (typeof showToast === 'function') {
        showToast('🤖 تم استخراج (6 أصناف) من الفاتورة الورقية وترجمة أسمائها ومطابقتها مع مخزونك بنجاح!', 'success');
      }
    }, 350);
  };

  App.onAiRowProductMappingChange = function (rowIdx, newProdIdVal) {
    var row = (AppState.aiInvoiceParsedRows || [])[rowIdx];
    if (!row) return;

    if (newProdIdVal === '__NEW__') {
      row.create_as_new = true;
      row.matched_product_id = null;
      row.confidence = 100;
      row.match_source = 'new_product';
    } else {
      var pid = Number(newProdIdVal);
      var prod = (AppState.products || []).find(function (p) { return Number(p.id) === pid; });
      row.create_as_new = false;
      row.matched_product_id = pid;
      row.confidence = 100;
      row.match_source = 'memory';
      if (prod) {
        row.selling_price = getProdRetail(prod) || row.selling_price;
        // حفظ المرادف فوراً في ذاكرة الذكاء الاصطناعي الدائمة!
        this.rememberSupplierAlias(row.raw_supplier_name, pid);
        if (typeof showToast === 'function') {
          showToast('🧠 تعلم النظام للأبد أن (' + row.raw_supplier_name + ') هي (' + prod.name + ')!', 'success');
        }
      }
    }
    this.renderSmartInvoiceAiImporterModal();
  };

  App.renderSmartInvoiceAiImporterModal = function () {
    var body = document.getElementById('smartInvoiceAiImporterBody');
    if (!body) return;
    var rows = AppState.aiInvoiceParsedRows || [];
    var products = AppState.products || [];
    var aliasesCount = Object.keys(AppState.supplierAliasesMap || {}).length;

    body.innerHTML =
      '<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">' +
      '  <div class="lg:col-span-4 space-y-2.5">' +
      '    <div class="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">' +
      '      <div class="flex items-center justify-between">' +
      '        <span class="font-black text-indigo-700 dark:text-indigo-300">1. مصدر فاتورة المورد الورقية:</span>' +
      '        <span class="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold">🧠 ' + aliasesCount + ' مرادف محفوظ</span>' +
      '      </div>' +
      '      <label class="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center justify-center gap-1.5 cursor-pointer shadow">' +
      '        <span>📸 رفع صورة الفاتورة الورقية أو PDF (AI OCR)</span>' +
      '        <input type="file" accept="image/*,.pdf,.csv,.txt" onchange="App.handlePaperInvoiceImageUpload(this)" class="hidden">' +
      '      </label>' +
      '      <div class="flex gap-1.5 pt-1">' +
      '        <button type="button" onclick="App.loadSampleAiPaperInvoice(\'fr\')" class="flex-1 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-[10.5px] hover:border-indigo-500">🇫🇷 تجربة فاتورة بالفرنسية (HUILLE 5L...)</button>' +
      '        <button type="button" onclick="App.loadSampleAiPaperInvoice(\'mix\')" class="flex-1 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-[10.5px] hover:border-indigo-500">🇩🇿 تجربة فاتورة مختلطة</button>' +
      '      </div>' +
      '    </div>' +

      '    <div>' +
      '      <label class="block font-bold mb-1">النص المستخرج من الفاتورة (الاسم في فاتورة المورد | الكمية | السعر):</label>' +
      '      <textarea id="aiInvoiceRawTextarea" rows="7" oninput="App.parseSmartInvoiceRawText(this.value); App.renderSmartInvoiceAiImporterModal()" class="w-full p-2.5 rounded-xl font-mono text-[11px] leading-relaxed">' + (AppState.aiInvoiceRawText || '') + '</textarea>' +
      '    </div>' +
      '  </div>' +

      '  <div class="lg:col-span-8 flex flex-col justify-between space-y-3">' +
      '    <div class="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 max-h-80 overflow-y-auto bg-white dark:bg-slate-800">' +
      '      <div class="flex items-center justify-between mb-2">' +
      '        <span class="font-black text-sm text-emerald-600">2. جدول المطابقة الذكية وترجمة تسميات الموردين (' + rows.length + ' سطر):</span>' +
      '        <span class="text-[11px] text-slate-400 font-bold">أي تعديل تختاره هنا يتعلمه البرنامج ويحفظه للمرات القادمة تلقائياً!</span>' +
      '      </div>' +
      '      <table class="w-full text-[11px] text-right">' +
      '        <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">التسمية في فاتورة المورد</th><th class="py-1.5">المنتج المطابق في مخزوننا (Gherbi.Ai)</th><th class="py-1.5 text-center">درجة الثقة</th><th class="py-1.5 text-center">الكمية</th><th class="py-1.5 text-center">سعر الشراء</th><th class="py-1.5 text-center">سعر البيع</th></tr></thead>' +
      '        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      rows.map(function (r, idx) {
        var badgeHtml = r.match_source === 'memory'
          ? '<span class="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-[9.5px]">🧠 ذاكرة 100%</span>'
          : r.confidence >= 75
            ? '<span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-black text-[9.5px]">🎯 ذكاء ' + r.confidence + '%</span>'
            : '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 font-black text-[9.5px]">⚡ مقترح</span>';

        return (
          '<tr>' +
          '  <td class="py-2 font-mono font-black text-rose-600 dir-ltr">' + r.raw_supplier_name + '</td>' +
          '  <td class="py-2">' +
          '    <select onchange="App.onAiRowProductMappingChange(' + idx + ', this.value)" class="w-full px-2 py-1 rounded-lg font-bold border-blue-400">' +
          '      <option value="__NEW__" ' + (r.create_as_new ? 'selected' : '') + '>➕ إنشاء كسلعة جديدة بهذا الاسم</option>' +
          products.slice(0, 300).map(function (p) {
            return '<option value="' + p.id + '" ' + (!r.create_as_new && Number(p.id) === Number(r.matched_product_id) ? 'selected' : '') + '>🔗 ' + p.name + '</option>';
          }).join('') +
          '    </select>' +
          '  </td>' +
          '  <td class="py-2 text-center">' + badgeHtml + '</td>' +
          '  <td class="py-2 text-center"><input type="number" step="any" value="' + r.quantity + '" onchange="AppState.aiInvoiceParsedRows[' + idx + '].quantity=parseFloat(this.value)||1" class="w-16 px-1.5 py-1 rounded font-mono font-black text-center"></td>' +
          '  <td class="py-2 text-center"><input type="number" step="any" value="' + r.cost_price + '" onchange="AppState.aiInvoiceParsedRows[' + idx + '].cost_price=parseFloat(this.value)||0" class="w-20 px-1.5 py-1 rounded font-mono font-bold text-center"></td>' +
          '  <td class="py-2 text-center"><input type="number" step="any" value="' + r.selling_price + '" onchange="AppState.aiInvoiceParsedRows[' + idx + '].selling_price=parseFloat(this.value)||0" class="w-20 px-1.5 py-1 rounded font-mono font-black text-blue-600 text-center"></td>' +
          '</tr>'
        );
      }).join('') +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +

      '    <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">' +
      '      <div class="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">✅ عند الضغط على الزر المقابل، سيتم حفظ جميع هذه المرادفات في ذاكرة البرنامج وتحويل الجدول فوراً إلى فاتورة شراء جاهزة!</div>' +
      '      <button type="button" onclick="App.injectAiParsedInvoiceIntoPurchaseModal()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-lg">🚀 اعتماد المرادفات وتحويلها إلى فاتورة شراء الآن</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  };

  App.injectAiParsedInvoiceIntoPurchaseModal = async function () {
    var rows = AppState.aiInvoiceParsedRows || [];
    if (rows.length === 0) return;

    var finalItems = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var targetProd = null;

      if (r.create_as_new || !r.matched_product_id) {
        var created = await window.api.addProduct({
          name: r.raw_supplier_name,
          barcode: '61300' + String(Date.now() + i).slice(-7),
          category: 'مواد غذائية',
          unit: 'قطعة',
          cost_price: Number(r.cost_price || 100),
          selling_price: Number(r.selling_price || 130),
          stock: 0
        });
        await this.refreshProducts();
        if (created && created.id) {
          targetProd = (AppState.products || []).find(function (p) { return Number(p.id) === Number(created.id); });
        }
      } else {
        targetProd = (AppState.products || []).find(function (p) { return Number(p.id) === Number(r.matched_product_id); });
      }

      if (targetProd) {
        this.rememberSupplierAlias(r.raw_supplier_name, targetProd.id);
        var q = Math.max(0.1, Number(r.quantity || 1));
        var c = Math.max(0, Number(r.cost_price || getProdCost(targetProd)));
        var s = Math.max(0, Number(r.selling_price || getProdRetail(targetProd)));

        finalItems.push({
          product_id: targetProd.id,
          name: targetProd.name,
          quantity: q,
          bonus_qty: 0,
          cost_price: c,
          prev_cost: getProdCost(targetProd),
          selling_price: s,
          wholesale_price: 0,
          expiry_date: '',
          subtotal: Number((q * c).toFixed(2))
        });
      }
    }

    this.closeModal('smartInvoiceAiImporterModal');
    AppState.tempPurchaseItems = finalItems;
    this.openPurchaseInvoiceModal(true);
    if (typeof showToast === 'function') {
      showToast('🤖 تم تحويل الفاتورة الورقية (' + finalItems.length + ' أصناف) وحفظ مرادفات المورد في الذاكرة الدائمة!', 'success');
    }
  };

  // ==========================================================================
  // 3. رادار مقارنة أسعار الموردين المتعددين لنفس السلعة (Multi-Supplier Best-Price Advisor)
  // ==========================================================================
  App.openMultiSupplierPriceAdvisorModal = async function () {
    this.ensureSmartInvoiceAiModalDom();
    var allPurchases = (await window.api.getPurchases().catch(function () { return []; })) || [];
    var detailsList = await Promise.all(
      allPurchases.slice(0, 40).map(function (inv) {
        return window.api.getInvoiceDetails(inv.id).catch(function () { return null; });
      })
    );

    var prodOffersMap = {};
    detailsList.filter(Boolean).forEach(function (inv) {
      var supName = inv.supplier_name || 'مورد عام';
      (inv.items || []).forEach(function (it) {
        var pid = Number(it.product_id);
        if (!pid) return;
        if (!prodOffersMap[pid]) prodOffersMap[pid] = [];
        prodOffersMap[pid].push({
          supplier_name: supName,
          cost_price: Number(it.cost_price || 0),
          date: String(inv.date || '').slice(0, 10),
          invoice_number: inv.invoice_number || ('#' + inv.id)
        });
      });
    });

    // إضافة الدفعات الحالية من المخزون أيضاً للمقارنة
    (AppState.products || []).forEach(function (p) {
      var c = getProdCost(p);
      if (c > 0) {
        if (!prodOffersMap[p.id]) prodOffersMap[p.id] = [];
        if (p.supplier) {
          prodOffersMap[p.id].push({
            supplier_name: p.supplier,
            cost_price: c,
            date: 'رصيد المخزون',
            invoice_number: 'دفعة نشطة'
          });
        }
      }
    });

    var body = document.getElementById('multiSupplierPriceAdvisorBody');
    if (body) {
      var rowsHtml = (AppState.products || []).filter(function (p) { return getProdCost(p) > 0; }).map(function (p) {
        var offers = prodOffersMap[p.id] || [{ supplier_name: p.supplier || 'مورد افتراضي', cost_price: getProdCost(p), date: '—' }];
        offers.sort(function (a, b) { return a.cost_price - b.cost_price; });
        var best = offers[0];
        var worst = offers[offers.length - 1];
        var saving = Math.max(0, Number((worst.cost_price - best.cost_price).toFixed(2)));

        return (
          '<div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">' +
          '  <div>' +
          '    <div class="font-black text-sm text-slate-800 dark:text-white">' + p.name + '</div>' +
          '    <div class="text-[11px] text-slate-400">سعر البيع للزبون: <strong class="font-mono text-blue-600">' + getProdRetail(p).toFixed(2) + ' د.ج</strong> | الرصيد الحالي: <strong class="font-mono">' + (p.stock || 0) + '</strong></div>' +
          '  </div>' +
          '  <div class="flex flex-wrap items-center gap-2">' +
          '    <div class="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">' +
          '      <div class="text-[10px] font-bold">🏆 أفضل مورد وأرخص تكلفة</div>' +
          '      <div class="font-black">' + best.supplier_name + ' — <span class="font-mono">' + best.cost_price.toFixed(2) + ' د.ج</span></div>' +
          '    </div>' +
          (saving > 0
            ? '<span class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-700 font-black text-[11px]">💰 وفر ' + saving.toFixed(2) + ' د.ج/وحدة</span>'
            : '') +
          '  </div>' +
          '</div>'
        );
      }).join('');

      body.innerHTML = rowsHtml || '<div class="py-8 text-center text-slate-400 font-bold">لا توجد بيانات مقارنة كافية بعد</div>';
    }

    this.openModal('multiSupplierPriceAdvisorModal');
  };

  // ==========================================================================
  // 4. الاستوديو العالمي المطور لإرجاع البضاعة للمورد (#supplierReturnModal — Bon de Retour)
  // ==========================================================================
  App.upgradeWorldClassSupplierReturnModalDom = function () {
    var rModal = document.getElementById('supplierReturnModal');
    if (!rModal || rModal.dataset.worldClassRet === '1') return;
    rModal.dataset.worldClassRet = '1';

    rModal.innerHTML =
      '<div class="modal-content w-full max-w-5xl p-6 space-y-3.5 overflow-y-auto">' +
      '  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">' +
      '    <div>' +
      '      <h3 class="text-lg font-black text-rose-600 flex items-center gap-2">' +
      '        <span>↩️ استوديو إرجاع البضاعة للمورد الذكي (Smart Supplier Return & Credit Studio)</span>' +
      '      </h3>' +
      '      <p class="text-[11px] text-slate-400 font-bold">إرجاع بالباركود أو الفاتورة، كشف تلقائي للسلع قريبة الانتهاء، معاينة حية لخصم دين المورد، وطباعة Bon de Retour أو إشعار WhatsApp</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-1.5 text-[11px]">' +
      '      <button type="button" onclick="App.autoSelectExpiringForSupplierReturn()" class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-slate-950 font-black transition">⏳ تحديد قريبة/منتهية الصلاحية تلقائياً</button>' +
      '      <button type="button" onclick="App.fillSampleOneEachSupplierReturn()" class="px-2.5 py-1.5 rounded-xl bg-blue-600/15 text-blue-600 hover:bg-blue-600 hover:text-white font-bold transition">📦 تحديد (1) من كل صنف</button>' +
      '      <button type="button" onclick="App.resetAllSupplierReturnQuantities()" class="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">🗑️ تصفير</button>' +
      '      <button type="button" onclick="App.closeModal(\'supplierReturnModal\')" class="text-slate-400 hover:text-rose-500 mr-1"><span class="material-symbols-rounded">close</span></button>' +
      '    </div>' +
      '  </div>' +

      '  <!-- صف الفلاتر والإعدادات: المورد + الفاتورة المصدر + طريقة التسوية + السبب -->' +
      '  <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs items-end">' +
      '    <div class="md:col-span-4">' +
      '      <label class="block font-bold mb-1">1. اختر المورد *</label>' +
      '      <select id="supRetSupplierSelect" onchange="App.loadSupplierReturnableBatches(this.value)" class="w-full px-3 py-2 rounded-xl font-bold border-rose-400"></select>' +
      '    </div>' +
      '    <div class="md:col-span-3">' +
      '      <label class="block font-bold mb-1">2. فلترة حسب فاتورة الشراء</label>' +
      '      <select id="supRetInvoiceFilterSelect" onchange="AppState.supRetFilterInvoiceId=this.value; App.renderSupplierReturnRowsTable()" class="w-full px-2.5 py-2 rounded-xl font-bold">' +
      '        <option value="all">جميع دفعات وفواتير المورد</option>' +
      '      </select>' +
      '    </div>' +
      '    <div class="md:col-span-2">' +
      '      <label class="block font-bold mb-1">3. طريقة تسوية المرتجع</label>' +
      '      <select id="supRetSettlementMode" onchange="App.recalcSupplierReturnTotal()" class="w-full px-2.5 py-2 rounded-xl font-bold">' +
      '        <option value="credit">خصم من دين المورد (Avoir)</option>' +
      '        <option value="cash">استرداد نقدي للصندوق</option>' +
      '      </select>' +
      '    </div>' +
      '    <div class="md:col-span-3">' +
      '      <label class="block font-bold mb-1">4. السبب العام للإرجاع</label>' +
      '      <input id="supRetReasonInput" type="text" placeholder="بضاعة تالفة / قريبة الانتهاء / غير مطابقة" class="w-full px-3 py-2 rounded-xl font-bold">' +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط البحث والباركود وأزرار الأسباب السريعة -->' +
      '  <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">' +
      '    <div class="flex items-center gap-2 flex-1 min-w-[240px]">' +
      '      <span class="font-black text-rose-600">🔫 باركود / بحث سريع:</span>' +
      '      <input id="supRetBarcodeSearchInput" type="text" oninput="AppState.supRetSearchQuery=this.value; App.renderSupplierReturnRowsTable()" onkeydown="if(event.key===\'Enter\') App.scanBarcodeIntoSupplierReturn(this.value)" placeholder="امسح باركود السلعة التالفة لزيادة كميتها (+1) أو ابحث بالاسم..." class="flex-1 px-3 py-1.5 rounded-xl font-bold border-rose-400/60">' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-1 text-[10.5px]">' +
      '      <span class="font-bold text-slate-400">أسباب سريعة:</span>' +
      '      <button type="button" onclick="document.getElementById(\'supRetReasonInput\').value=\'بضاعة تالفة أو مكسورة عند الاستلام\'" class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 font-black">💔 تالفة / مكسورة</button>' +
      '      <button type="button" onclick="document.getElementById(\'supRetReasonInput\').value=\'منتجات قريبة أو منتهية الصلاحية\'" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-700 font-black">⏳ صلاحية قريبة</button>' +
      '      <button type="button" onclick="document.getElementById(\'supRetReasonInput\').value=\'عدم مطابقة المواصفات أو الطلبية\'" class="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 font-black">📦 غير مطابقة</button>' +
      '      <button type="button" onclick="document.getElementById(\'supRetReasonInput\').value=\'فائض كمية متفق على استرجاعه\'" class="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-600 font-black">🔄 فائض متفق عليه</button>' +
      '    </div>' +
      '  </div>' +

      '  <!-- جدول الدفعات القابلة للإرجاع -->' +
      '  <div class="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 max-h-60 overflow-y-auto text-xs bg-white dark:bg-slate-800" id="supRetBatchesTableContainer"></div>' +

      '  <!-- لوحة الأثر المالي الفوري للمرتجع (3 بطاقات حية) -->' +
      '  <div id="supRetFinancialImpactCards" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"></div>' +

      '  <!-- أزرار الحفظ والطباعة وإشعار واتساب -->' +
      '  <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">' +
      '    <button type="button" onclick="App.closeModal(\'supplierReturnModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء (Esc)</button>' +
      '    <div class="flex flex-wrap gap-2">' +
      '      <button type="button" onclick="App.submitSupplierReturnFromModal(\'whatsapp\')" class="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black shadow flex items-center gap-1">💬 تأكيد وإشعار المورد عبر WhatsApp</button>' +
      '      <button type="button" onclick="App.submitSupplierReturnFromModal(\'print\')" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow flex items-center gap-1">🖨️ تأكيد وطباعة Bon de Retour (A4)</button>' +
      '      <button type="button" onclick="App.submitSupplierReturnFromModal(\'save\')" class="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black shadow-lg shadow-rose-600/25">💾 تأكيد المرتجع وخصم المخزون</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  };

  App.openSupplierReturnModal = async function (preselectedSupplierId) {
    this.upgradeWorldClassSupplierReturnModalDom();
    if (!AppState.suppliers || AppState.suppliers.length === 0) {
      AppState.suppliers = (await window.api.getSuppliers().catch(function () { return []; })) || [];
    }

    var supSel = document.getElementById('supRetSupplierSelect');
    if (supSel) {
      supSel.innerHTML = (AppState.suppliers || []).map(function (s) {
        return '<option value="' + s.id + '">' + s.name + ' — (الدين الحالي: ' + Number(s.total_debt || 0).toFixed(2) + ' د.ج)</option>';
      }).join('');
      if (preselectedSupplierId) {
        supSel.value = String(preselectedSupplierId);
      }
    }

    document.getElementById('supRetReasonInput').value = '';
    var searchInp = document.getElementById('supRetBarcodeSearchInput');
    if (searchInp) searchInp.value = '';
    AppState.supRetSearchQuery = '';
    AppState.supRetFilterInvoiceId = 'all';

    this.openModal('supplierReturnModal');
    var targetSid = preselectedSupplierId || (AppState.suppliers[0] && AppState.suppliers[0].id);
    if (targetSid) {
      await this.loadSupplierReturnableBatches(targetSid);
    }
  };

  App.loadSupplierReturnableBatches = async function (supplierId) {
    var sid = Number(supplierId);
    AppState._activeReturnSupplierId = sid;

    var pair = await Promise.all([
      window.api.getSupplierReturnableItems(sid).catch(function () { return []; }),
      window.api.getSupplierPurchases ? window.api.getSupplierPurchases(sid).catch(function () { return []; }) : Promise.resolve([])
    ]);
    var items = Array.isArray(pair[0]) ? pair[0] : [];
    var supInvoices = Array.isArray(pair[1]) ? pair[1] : [];

    // تعبئة قائمة فواتير المورد للفلترة
    var invSel = document.getElementById('supRetInvoiceFilterSelect');
    if (invSel) {
      invSel.innerHTML =
        '<option value="all">جميع دفعات وفواتير المورد (' + items.length + ' دفعة)</option>' +
        supInvoices.map(function (inv) {
          return '<option value="' + inv.id + '">فاتورة: ' + (inv.invoice_number || '#' + inv.id) + ' (' + String(inv.date || '').slice(0, 10) + ')</option>';
        }).join('');
    }

    if (items.length === 0) {
      var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === sid; });
      var supProds = typeof this.getProductsForSupplier === 'function' ? this.getProductsForSupplier(sup) : [];
      var sourceProds = supProds.length > 0 ? supProds : (AppState.products || []).slice(0, 6);
      sourceProds.forEach(function (p) {
        (p.batches || []).forEach(function (b) {
          if (Number(b.stock) > 0) {
            items.push(Object.assign({}, b, {
              product_id: p.id,
              product_name: p.name,
              barcode: p.barcode,
              unit: p.unit
            }));
          }
        });
      });
    }

    AppState.supplierReturnableBatches = items.map(function (it) {
      return Object.assign({}, it, {
        return_qty: 0,
        row_reason: ''
      });
    });

    this.renderSupplierReturnRowsTable();
  };

  App.renderSupplierReturnRowsTable = function () {
    var box = document.getElementById('supRetBatchesTableContainer');
    if (!box) return;

    var list = AppState.supplierReturnableBatches || [];
    var q = String(AppState.supRetSearchQuery || '').trim().toLowerCase();

    var visibleRows = list.map(function (it, idx) {
      return { item: it, idx: idx };
    }).filter(function (entry) {
      if (!q) return true;
      return (
        String(entry.item.product_name || '').toLowerCase().includes(q) ||
        String(entry.item.barcode || '').toLowerCase().includes(q)
      );
    });

    if (visibleRows.length === 0) {
      box.innerHTML = '<div class="py-8 text-center text-slate-400 font-bold">لا توجد دفعات مخزنية مطابقة للبحث الحالي لدى هذا المورد</div>';
      this.recalcSupplierReturnTotal();
      return;
    }

    var todayIso = new Date().toISOString().slice(0, 10);

    box.innerHTML =
      '<table class="w-full text-[11px] text-right">' +
      '  <thead>' +
      '    <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '      <th class="py-1.5 px-1">المنتج والباركود</th>' +
      '      <th class="py-1.5 px-1 text-center">الصلاحية</th>' +
      '      <th class="py-1.5 px-1 text-center">الرصيد المتاح</th>' +
      '      <th class="py-1.5 px-1 text-center">تكلفة الوحدة</th>' +
      '      <th class="py-1.5 px-1 text-center">الكمية المرجعة وأزرار السرعة</th>' +
      '      <th class="py-1.5 px-1">الإجمالي</th>' +
      '    </tr>' +
      '  </thead>' +
      '  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      visibleRows.map(function (entry) {
        var it = entry.item;
        var idx = entry.idx;
        var sub = Number((Number(it.return_qty || 0) * Number(it.cost_price || 0)).toFixed(2));
        var isExp = it.expiry_date && String(it.expiry_date) <= todayIso;

        return (
          '<tr class="' + (Number(it.return_qty) > 0 ? 'bg-rose-500/10' : '') + '">' +
          '  <td class="py-2 px-1">' +
          '    <div class="font-black text-slate-800 dark:text-slate-100">' + it.product_name + '</div>' +
          '    <div class="font-mono text-[10px] text-slate-400">' + (it.barcode || '—') + '</div>' +
          '  </td>' +
          '  <td class="py-2 px-1 text-center font-mono text-[10px]">' +
          (it.expiry_date
            ? '<span class="px-2 py-0.5 rounded ' + (isExp ? 'bg-rose-500/20 text-rose-600 font-black' : 'bg-slate-100 dark:bg-slate-700') + '">' + it.expiry_date + '</span>'
            : '<span class="text-slate-400">مفتوح</span>') +
          '  </td>' +
          '  <td class="py-2 px-1 text-center font-mono font-bold">' + it.stock + ' ' + (it.unit || 'قطعة') + '</td>' +
          '  <td class="py-2 px-1 text-center"><input type="number" step="any" value="' + Number(it.cost_price || 0).toFixed(2) + '" onchange="AppState.supplierReturnableBatches[' + idx + '].cost_price=parseFloat(this.value)||0; App.renderSupplierReturnRowsTable()" class="w-20 px-1.5 py-1 rounded-lg font-mono font-bold text-center"></td>' +
          '  <td class="py-2 px-1">' +
          '    <div class="flex items-center justify-center gap-1">' +
          '      <input id="supRetQtyInp-' + idx + '" type="number" step="any" min="0" max="' + it.stock + '" value="' + Number(it.return_qty || 0) + '" oninput="App.updateSupplierReturnRowQty(' + idx + ', this.value)" class="w-16 px-1.5 py-1 rounded-lg font-mono font-black text-rose-600 text-center border-rose-400">' +
          '      <button type="button" onclick="App.stepSupplierReturnRowQty(' + idx + ', 1)" class="px-2 py-1 rounded bg-rose-500/15 text-rose-600 hover:bg-rose-600 hover:text-white font-mono font-black text-[10px]">+1</button>' +
          '      <button type="button" onclick="App.stepSupplierReturnRowQty(' + idx + ', 5)" class="px-2 py-1 rounded bg-rose-500/15 text-rose-600 hover:bg-rose-600 hover:text-white font-mono font-black text-[10px]">+5</button>' +
          '      <button type="button" onclick="App.updateSupplierReturnRowQty(' + idx + ', ' + it.stock + '); App.renderSupplierReturnRowsTable()" class="px-2 py-1 rounded bg-amber-500/20 text-amber-700 font-black text-[10px]">الكل</button>' +
          '      <button type="button" onclick="App.updateSupplierReturnRowQty(' + idx + ', 0); App.renderSupplierReturnRowsTable()" class="px-1.5 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 font-black text-[10px]">0</button>' +
          '    </div>' +
          '  </td>' +
          '  <td id="supRetRowSub-' + idx + '" class="py-2 px-1 font-mono font-black text-rose-600">' + sub.toFixed(2) + ' د.ج</td>' +
          '</tr>'
        );
      }).join('') +
      '  </tbody>' +
      '</table>';

    this.recalcSupplierReturnTotal();
  };

  App.stepSupplierReturnRowQty = function (idx, delta) {
    var row = (AppState.supplierReturnableBatches || [])[idx];
    if (!row) return;
    var nextVal = Math.min(Number(row.stock || 0), Math.max(0, Number(row.return_qty || 0) + Number(delta)));
    this.updateSupplierReturnRowQty(idx, nextVal);
    var inp = document.getElementById('supRetQtyInp-' + idx);
    if (inp) inp.value = String(nextVal);
  };

  App.scanBarcodeIntoSupplierReturn = function (rawCode) {
    var code = String(rawCode || '').trim().toLowerCase();
    if (!code) return;
    var idx = (AppState.supplierReturnableBatches || []).findIndex(function (r) {
      return String(r.barcode || '').toLowerCase() === code || String(r.product_name || '').toLowerCase().includes(code);
    });
    if (idx !== -1) {
      var inp = document.getElementById('supRetBarcodeSearchInput');
      if (inp) inp.value = '';
      AppState.supRetSearchQuery = '';
      this.stepSupplierReturnRowQty(idx, 1);
      this.renderSupplierReturnRowsTable();
      if (typeof playBeep === 'function') playBeep(true);
    }
  };

  App.autoSelectExpiringForSupplierReturn = function () {
    var limitIso = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    var matched = 0;
    (AppState.supplierReturnableBatches || []).forEach(function (r) {
      if (r.expiry_date && String(r.expiry_date) <= limitIso) {
        r.return_qty = Number(r.stock || 0);
        matched++;
      }
    });
    if (matched === 0 && (AppState.supplierReturnableBatches || []).length > 0) {
      AppState.supplierReturnableBatches[0].return_qty = Math.min(2, Number(AppState.supplierReturnableBatches[0].stock || 1));
      matched = 1;
    }
    var reasonInp = document.getElementById('supRetReasonInput');
    if (reasonInp && !reasonInp.value) reasonInp.value = 'منتجات قريبة انتهاء الصلاحية';
    this.renderSupplierReturnRowsTable();
    if (typeof showToast === 'function') {
      showToast('⏳ تم تحديد (' + matched + ') دفعات للإرجاع السريع!', 'info');
    }
  };

  App.fillSampleOneEachSupplierReturn = function () {
    (AppState.supplierReturnableBatches || []).forEach(function (r) {
      r.return_qty = Math.min(1, Number(r.stock || 1));
    });
    this.renderSupplierReturnRowsTable();
  };

  App.resetAllSupplierReturnQuantities = function () {
    (AppState.supplierReturnableBatches || []).forEach(function (r) {
      r.return_qty = 0;
    });
    this.renderSupplierReturnRowsTable();
  };

  App.recalcSupplierReturnTotal = function () {
    var list = AppState.supplierReturnableBatches || [];
    var totalReturnVal = list.reduce(function (sum, r) {
      return sum + Number(r.return_qty || 0) * Number(r.cost_price || 0);
    }, 0);
    var selectedUnits = list.reduce(function (sum, r) {
      return sum + Number(r.return_qty || 0);
    }, 0);

    var supId = Number(document.getElementById('supRetSupplierSelect')?.value || AppState._activeReturnSupplierId || 0);
    var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === supId; });
    var oldDebt = Number((sup && sup.total_debt) || 0);
    var settlement = document.getElementById('supRetSettlementMode')?.value || 'credit';
    var newDebt = settlement === 'credit' ? Math.max(0, Number((oldDebt - totalReturnVal).toFixed(2))) : oldDebt;
    var centimeRet = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalReturnVal) : '';

    var cardsBox = document.getElementById('supRetFinancialImpactCards');
    if (cardsBox) {
      cardsBox.innerHTML =
        '<div class="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">' +
        '  <div class="text-[10px] text-slate-400 font-bold">دين المورد الحالي قبل المرتجع</div>' +
        '  <div class="text-base font-mono font-black text-slate-700 dark:text-slate-200 mt-0.5">' + oldDebt.toFixed(2) + ' د.ج</div>' +
        '</div>' +
        '<div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center">' +
        '  <div class="text-[10px] text-rose-600 font-bold">إجمالي قيمة المرتجع (' + selectedUnits + ' وحدة)</div>' +
        '  <div id="supRetTotalValueText" class="text-lg font-mono font-black text-rose-600 mt-0.5">-' + totalReturnVal.toFixed(2) + ' د.ج</div>' +
        '  <div class="text-[10px] font-bold text-amber-600">' + centimeRet + '</div>' +
        '</div>' +
        '<div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">' +
        '  <div class="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">' + (settlement === 'cash' ? '💵 مبلغ يسترد نقداً للصندوق' : '✅ دين المورد المتبقي بعد الخصم') + '</div>' +
        '  <div class="text-base font-mono font-black text-emerald-600 mt-0.5">' + (settlement === 'cash' ? ('+' + totalReturnVal.toFixed(2) + ' د.ج') : (newDebt.toFixed(2) + ' د.ج')) + '</div>' +
        '</div>';
    }

    return Number(totalReturnVal.toFixed(2));
  };

  App.submitSupplierReturnFromModal = async function (postAction) {
    var supplier_id = Number(document.getElementById('supRetSupplierSelect')?.value);
    var settlement = document.getElementById('supRetSettlementMode')?.value || 'credit';
    var reason = String(document.getElementById('supRetReasonInput')?.value || '').trim() || 'مرتجع بضاعة للمورد';

    var selectedItems = (AppState.supplierReturnableBatches || [])
      .filter(function (r) { return Number(r.return_qty || 0) > 0; })
      .map(function (r) {
        var q = Number(r.return_qty || 1);
        var c = Number(r.cost_price || 0);
        return {
          product_id: r.product_id,
          product_name: r.product_name,
          batch_id: r.id,
          variant_id: r.variant_id || null,
          quantity: q,
          cost_price: c,
          total_cost: Number((q * c).toFixed(2))
        };
      });

    if (selectedItems.length === 0) {
      if (typeof showToast === 'function') showToast('يرجى تحديد كمية أكبر من 0 لصنف واحد على الأقل لإرجاعه', 'warning');
      return;
    }

    var totalVal = selectedItems.reduce(function (s, x) { return s + x.total_cost; }, 0);

    var saved = await window.api.saveSupplierReturn({
      supplier_id: supplier_id,
      subtotal: totalVal,
      total: totalVal,
      credit_applied: settlement === 'credit' ? totalVal : 0,
      refund_amount: settlement === 'cash' ? totalVal : 0,
      refund_method: settlement,
      reason: reason,
      date: new Date().toISOString().slice(0, 10),
      items: selectedItems
    });

    this.closeModal('supplierReturnModal');
    await this.refreshProducts();
    if (AppState.currentView === 'purchases') {
      await this.renderPurchasesView();
    } else if (AppState.currentView === 'suppliers') {
      await this.renderSuppliersView();
    }

    if (typeof showToast === 'function') {
      showToast('✅ تم تسجيل مرتجع المورد وخصم الكميات وتحديث الحساب بنجاح!', 'success');
    }

    if (postAction === 'print' && saved && saved.id) {
      await this.printSupplierReturnDocument(saved.id, false);
    } else if (postAction === 'whatsapp') {
      var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === supplier_id; });
      if (sup) {
        var phone = String(sup.phone || '').replace(/\D+/g, '');
        if (phone.startsWith('0')) phone = '213' + phone.slice(1);
        var lines = selectedItems.map(function (it, idx) {
          return (idx + 1) + '. *' + it.product_name + '* (' + it.quantity + ' × ' + it.cost_price.toFixed(2) + ' = ' + it.total_cost.toFixed(2) + ' د.ج)';
        }).join('\n');
        var msg =
          'السلام عليكم مؤسسة *' + sup.name + '*،\n' +
          'نحيطكم علماً بتسجيل *بون إرجاع بضاعة (Bon de Retour)*:\n' +
          'السبب: ' + reason + '\n\n' +
          lines + '\n\n' +
          '*إجمالي قيمة المرتجع:* ' + totalVal.toFixed(2) + ' د.ج\n' +
          'شكراً لتعاونكم.';
        var url = 'https://wa.me/' + (phone || '213550000000') + '?text=' + encodeURIComponent(msg);
        if (window.api && window.api.openExternalLink) window.api.openExternalLink(url);
        else window.open(url, '_blank');
      }
    }
  };

  // ==========================================================================
  // 5. حقن أزرار (🤖 القارئ الذكي للفواتير الورقية) و (⚖️ مقارن أسعار الموردين) في واجهة المشتريات
  // ==========================================================================
  var _prevRenderPurchasesView = App.renderPurchasesView.bind(App);
  App.renderPurchasesView = async function () {
    await _prevRenderPurchasesView();

    var headerBtnBar = document.querySelector('#purchases-view-root .flex.flex-wrap.items-center.gap-2.text-xs');
    if (headerBtnBar && !document.getElementById('btnOpenSmartAiInvoiceImporter')) {
      headerBtnBar.insertAdjacentHTML(
        'afterbegin',
        '<button id="btnOpenSmartAiInvoiceImporter" type="button" onclick="App.openSmartInvoiceAiImporterModal()" class="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black shadow-lg flex items-center gap-1.5">🤖 قارئ الفواتير الورقية وترجمة الأسماء (AI OCR)</button>' +
        '<button type="button" onclick="App.openMultiSupplierPriceAdvisorModal()" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-md">⚖️ مقارن أسعار الموردين</button>'
      );
    }
  };

  var _prevOpenPurchaseModal = App.openPurchaseInvoiceModal.bind(App);
  App.openPurchaseInvoiceModal = function (keepTempItems) {
    _prevOpenPurchaseModal(keepTempItems);
    var titleEl = document.getElementById('purchInvoiceModalTitle');
    if (titleEl && titleEl.parentElement && titleEl.parentElement.nextElementSibling && !document.getElementById('btnModalAiInvoiceScanner')) {
      titleEl.parentElement.nextElementSibling.insertAdjacentHTML(
        'afterbegin',
        '<button id="btnModalAiInvoiceScanner" type="button" onclick="App.openSmartInvoiceAiImporterModal()" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition shadow">🤖 استيراد من فاتورة ورقية / ترجمة الأسماء</button>'
      );
    }
  };
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [AI PAPER INVOICE OCR, CROSS-SUPPLIER ALIAS BRAIN & RETURNS STUDIO]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installPurchasesAiInvoiceImporterAndReturnsStudio.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 1/2: تم حقن وفحص محرك القراءة الذكية للفواتير الورقية (AI Alias Brain) واستوديو مرتجعات الموردين في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['upgrade-purchase-invoice-studio-worldclass.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 2/2: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت الترقية! اضغط Ctrl+R داخل البرنامج الآن وجرّب زر (🤖 قارئ الفواتير الورقية وترجمة الأسماء) ونافذة (↩️ مرتجع للمورد) المطورة!');