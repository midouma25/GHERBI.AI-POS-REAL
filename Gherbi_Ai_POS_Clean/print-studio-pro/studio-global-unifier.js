/**
 * print-studio-pro/studio-global-unifier.js
 * موحّد الطباعة الشامل: يربط window.PrintEngine و App وكافة الصفحات الـ 18 بقوالب مركز الطباعة المحفوظة
 */
'use strict';
(function buildStudioGlobalUnifierModule() {
  (function initPrintStudioProGlobalUnifier() {
    'use strict';

    if (window.GherbiPrintGlobalUnifier && window.GherbiPrintGlobalUnifier._installed) {
      return;
    }

    const PRINT_ENGINE_DOC_MAP = {
      printReceipt: 'receipt_thermal',
      printThermalReceipt: 'receipt_thermal',
      printPosReceipt: 'receipt_thermal',
      printInvoice: 'invoice_a4',
      printInvoiceA4: 'invoice_a4',
      printInvoiceA5: 'invoice_a5',
      printInvoice2xA5: 'invoice_2xa5',
      printDeliveryNote: 'delivery_note',
      printProforma: 'proforma',
      printOrder: 'customer_order',
      printOrderReceipt: 'customer_order',
      printCreditNote: 'credit_note',
      printAvoir: 'credit_note',
      printWarranty: 'warranty_cert',
      printPaymentReceipt: 'payment_receipt',
      printCustomerPaymentReceipt: 'payment_receipt',
      printSupplierPaymentReceipt: 'supplier_payment_receipt',
      printReceptionNote: 'purchase_invoice',
      printPurchaseInvoice: 'purchase_invoice',
      printSupplierReturn: 'supplier_return_note',
      printRecapInvoice: 'recap_invoice_a4',
      printPriceList: 'price_catalog_a4',
      printCatalog: 'price_catalog_a4',
      printSalesSummary: 'caisse_shift_full_audit_a4',
      printZReport: 'caisse_z_report',
      printCaisseZReport: 'caisse_z_report',
      printStocktake: 'stocktake_sheet_a4',
      printProductionOrder: 'production_order_sheet',
      printExpenseVoucher: 'expense_voucher'
    };

    const Unifier = {
      _installed: true,
      version: '1.0.0-global-adoption',
      hookedPrintEngineMethods: [],
      hookedAppMethods: [],
      metrics: {
        interceptedPrintEngineCalls: 0,
        interceptedAppPrintCalls: 0,
        interceptedRawHtmlPrints: 0
      },

      // استنتاج نوع القالب بدقة من الخيارات أو البيانات عند الطباعة من أي صفحة
      inferDocType(baseDocType, dataOrId, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        if (o.docType) return window.GherbiPrintStudioPro.router.resolveCanonicalDocType(o.docType);

        if (baseDocType === 'invoice_a4') {
          const fmt = String(o.format || o.paper || o.paperSize || '').toLowerCase();
          if (fmt === 'a5') return 'invoice_a5';
          if (fmt === '2xa5') return 'invoice_2xa5';
          if (fmt === '80mm' || fmt === '58mm' || fmt === 'thermal' || fmt === 'receipt') return 'receipt_thermal';
        }
        if (baseDocType === 'payment_receipt' && (o.type === 'purchase' || o.type === 'supplier' || (dataOrId && dataOrId.supplier_id))) {
          return 'supplier_payment_receipt';
        }
        if (baseDocType === 'receipt_thermal' && dataOrId && typeof dataOrId === 'object') {
          const total = Number(dataOrId.total ?? 0);
          const paid = Number(dataOrId.paidAmount ?? dataOrId.paid_amount ?? total);
          const rem = Math.max(0, Number((total - paid).toFixed(2)));
          if (rem > 0.009) {
            return paid <= 0.009 ? 'debt_confirm_ticket_80mm' : 'pos_partial_credit_80mm';
          }
        }
        return baseDocType;
      },

      async routeUnifiedPrint(baseDocType, arg1, arg2) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false };

        const opts = typeof arg2 === 'object' && arg2 ? { ...arg2 } : {};
        if (typeof arg2 === 'string') {
          const s = arg2.toLowerCase();
          if (['80mm', '58mm', 'a4', 'a5', '2xa5', 'thermal', 'receipt'].includes(s)) opts.format = s;
          else if (['ar', 'fr', 'en'].includes(s)) opts.lang = s;
          else if (s === 'pdf') opts.asPdf = true;
        }

        const docType = this.inferDocType(baseDocType, arg1, opts);
        // لا نمرر forceOverride هنا لكي تُحترَم 100% جميع التعديلات التي حفظها المستخدم في مركز الطباعة!
        const cleanOpts = {
          asPdf: Boolean(opts.asPdf || opts.pdf),
          silent: opts.silent,
          copies: opts.copies,
          printerName: opts.printerName,
          forceOverride: false
        };

        return await PSP.router.printDocumentByType(docType, arg1, cleanOpts);
      },

      hookPrintEngine() {
        const pe = window.PrintEngine;
        if (!pe || typeof pe !== 'object' || pe._pspGlobalUnified) return false;
        pe._pspGlobalUnified = true;
        const self = this;

        for (const [methodName, docType] of Object.entries(PRINT_ENGINE_DOC_MAP)) {
          if (typeof pe[methodName] !== 'function') continue;
          const origFn = pe[methodName].bind(pe);
          pe[methodName] = async function unifiedPrintEngineMethod(arg1, arg2, ...rest) {
            try {
              self.metrics.interceptedPrintEngineCalls++;
              return await self.routeUnifiedPrint(docType, arg1, arg2);
            } catch (e) {
              console.warn('[PSP Unifier Fallback for PrintEngine.' + methodName + ']:', e && e.message);
              return await origFn(arg1, arg2, ...rest);
            }
          };
          this.hookedPrintEngineMethods.push(methodName);
        }

        // توحيد PrintEngine.printHtml و PrintEngine.exportPdf ليمرّا عبر محرك main.js الدقيق
        if (typeof pe.printHtml === 'function') {
          pe.printHtml = async function unifiedPePrintHtml(html, opts = {}) {
            self.metrics.interceptedRawHtmlPrints++;
            const o = typeof opts === 'object' && opts ? opts : {};
            const paperMatch = String(html || '').match(/data-psp-paper=["']([^"']+)["']/i);
            const paperSize = o.paperSize || (paperMatch && paperMatch[1]) || '80mm';
            return await window.GherbiPrintStudioPro.router.executePrintHtml({
              html,
              paperSize,
              asPdf: Boolean(o.asPdf),
              silent: o.silent,
              copies: o.copies,
              printerName: o.printerName
            });
          };
        }

        if (typeof pe.exportPdf === 'function') {
          pe.exportPdf = async function unifiedPeExportPdf(html, opts = {}) {
            self.metrics.interceptedRawHtmlPrints++;
            const o = typeof opts === 'string' ? { filename: opts } : (opts || {});
            const paperMatch = String(html || '').match(/data-psp-paper=["']([^"']+)["']/i);
            const paperSize = o.paperSize || (paperMatch && paperMatch[1]) || '80mm';
            return await window.GherbiPrintStudioPro.router.executePrintHtml({
              html,
              paperSize,
              asPdf: true,
              docId: o.filename ? String(o.filename).replace(/\.pdf$/i, '') : 'document'
            });
          };
        }

        return true;
      },

      hookAppPrintMethods() {
        const app = window.App;
        if (!app || app._pspGlobalAppPrintUnified) return false;
        app._pspGlobalAppPrintUnified = true;
        const self = this;

        const APP_METHOD_MAP = {
          printSaleReceipt: 'receipt_thermal',
          printReceipt: 'receipt_thermal',
          printSaleInvoice: 'invoice_a4',
          printInvoice: 'invoice_a4',
          printSaleA5: 'invoice_a5',
          printProforma: 'proforma',
          printOrder: 'customer_order',
          printPurchaseInvoice: 'purchase_invoice',
          printPurchase: 'purchase_invoice',
          printSupplierReturn: 'supplier_return_note',
          printPaymentReceipt: 'payment_receipt',
          printSupplierPaymentReceipt: 'supplier_payment_receipt',
          printStocktake: 'stocktake_sheet_a4',
          printProductionOrder: 'production_order_sheet',
          printExpense: 'expense_voucher',
          printExpenseVoucher: 'expense_voucher',
          printZReport: 'caisse_z_report'
        };

        for (const [mName, docType] of Object.entries(APP_METHOD_MAP)) {
          if (typeof app[mName] !== 'function') continue;
          const orig = app[mName].bind(app);
          app[mName] = async function unifiedAppPrint(arg1, arg2, ...rest) {
            try {
              self.metrics.interceptedAppPrintCalls++;
              return await self.routeUnifiedPrint(docType, arg1, arg2);
            } catch (e) {
              console.warn('[PSP Unifier Fallback for App.' + mName + ']:', e && e.message);
              return await orig(arg1, arg2, ...rest);
            }
          };
          this.hookedAppMethods.push(mName);
        }

        // تحديث نافذة المعاينة #posPrintCenterModal لتستخدم forceOverride فقط عندما يغيّر المستخدم القائمة صراحةً
        if (typeof app.refreshPrintCenterPreview === 'function') {
          app.refreshPrintCenterPreview = async function unifiedPcRefresh() {
            const PSP = window.GherbiPrintStudioPro;
            const frame = document.getElementById('printCenterPreviewFrame');
            if (!frame || !PSP || !PSP.router) return;
            const docType = PSP.router.resolveCanonicalDocType(
              document.getElementById('pcDocTypeSelect')?.value || PSP.router._pcModalCtx?.docType || 'invoice_a4'
            );
            const langSel = document.getElementById('pcLangSelect')?.value || '';
            const themeSel = document.getElementById('pcTemplateSelect')?.value || 'default';
            const ctx = PSP.router._pcModalCtx || {};
            const rawData = await PSP.router.fetchDocDataByEntityId(docType, ctx.entityId, ctx.rawData);
            const freshData = await PSP.router.hydrateFreshCustomerOntoDoc(docType, rawData);

            const overrideOpts = themeSel && themeSel !== 'default'
              ? { forceOverride: true, themeId: themeSel, lang: langSel || undefined }
              : { forceOverride: false };
            const out = PSP.router.renderDoc(docType, freshData, 'print', overrideOpts);
            PSP.router._pcLastRendered = out;
            frame.srcdoc = out.fullHtml;
          };
        }

        return true;
      },

      boot() {
        this.hookPrintEngine();
        this.hookAppPrintMethods();

        let tries = 0;
        const timer = setInterval(() => {
          tries++;
          const ok1 = this.hookPrintEngine();
          const ok2 = this.hookAppPrintMethods();
          if ((ok1 && ok2) || tries >= 40) {
            clearInterval(timer);
          }
        }, 120);

        console.log('🌐 [Print Studio Pro — Global Unifier]: كافة صفحات البرنامج و PrintEngine مربوطة بمركز الطباعة 100%.');
      }
    };

    window.GherbiPrintGlobalUnifier = Unifier;
    Unifier.boot();
  })();
})();

/* === [PSP IFRAME & WINDOW.OPEN 80MM PRINT INTERCEPTOR] === */
(function installPspIframeAndPopupPrintInterceptor() {
  'use strict';
  if (window.__PSP_IFRAME_PRINT_INTERCEPTOR_ACTIVE) return;
  window.__PSP_IFRAME_PRINT_INTERCEPTOR_ACTIVE = true;

  function routeCapturedHtml(html, fallbackFn) {
    const src = String(html || '');
    const isPspOrThermal =
      src.includes('data-psp-rendered="1"') ||
      src.includes('psp-paper') ||
      src.includes('size-80mm') ||
      src.includes('size-58mm') ||
      src.includes('paper-80mm') ||
      src.includes('paper-58mm');

    const PSP = window.GherbiPrintStudioPro;
    if (isPspOrThermal && PSP && PSP.router && window.api && typeof window.api.pspPrint80mm === 'function') {
      const mPaper = src.match(/data-psp-paper=["']([^"']+)["']/i);
      const paperSize = (mPaper && mPaper[1]) || (/58mm/i.test(src) ? '58mm' : /80mm/i.test(src) ? '80mm' : 'a4');
      const mDoc = src.match(/data-psp-doc=["']([^"']+)["']/i);
      const docId = (mDoc && mDoc[1]) || 'ticket';

      PSP.router.executePrintHtml({
        html: src,
        paperSize,
        asPdf: false,
        docId,
        docType: docId
      });
      return true;
    }
    if (typeof fallbackFn === 'function') fallbackFn();
    return false;
  }

  function wrapIframeNode(node) {
    if (!node || node.tagName !== 'IFRAME') return;
    if (node.getAttribute('data-psp-allow-native-print') === '1') return;
    if (node._pspPrintHooked) return;
    node._pspPrintHooked = true;

    let capturedHtml = '';
    const tryAttachDocHooks = () => {
      try {
        const doc = node.contentDocument;
        const win = node.contentWindow;
        if (!doc || !win || win._pspPrintIntercepted) return;
        win._pspPrintIntercepted = true;

        const origWrite = doc.write.bind(doc);
        doc.write = function (chunk) {
          capturedHtml += String(chunk || '');
          return origWrite(chunk);
        };

        const origPrint = win.print.bind(win);
        win.print = function interceptedIframePrint() {
          const fullSrc = capturedHtml || (doc.documentElement ? doc.documentElement.outerHTML : '') || node.srcdoc || '';
          const handled = routeCapturedHtml(fullSrc, origPrint);
          if (handled) return;
        };
      } catch (_) {}
    };

    tryAttachDocHooks();
    node.addEventListener('load', tryAttachDocHooks);
  }

  // اعتراض إضافة أي iframe جديد للطباعة في الصفحة
  if (typeof Node !== 'undefined' && Node.prototype && typeof Node.prototype.appendChild === 'function') {
    const origAppend = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
      const res = origAppend.call(this, child);
      if (child && child.tagName === 'IFRAME') {
        wrapIframeNode(child);
      }
      return res;
    };
  }

  // اعتراض window.open('', '_blank') المستعمل في بعض نوافذ الطباعة القديمة
  if (typeof window.open === 'function') {
    const origOpen = window.open.bind(window);
    window.open = function interceptedWindowOpen(url, target, features) {
      const popup = origOpen(url, target, features);
      if (!popup || (url && url !== 'about:blank')) return popup;
      try {
        let popupHtml = '';
        const pDoc = popup.document;
        if (pDoc && typeof pDoc.write === 'function') {
          const origWrite = pDoc.write.bind(pDoc);
          pDoc.write = function (chunk) {
            popupHtml += String(chunk || '');
            return origWrite(chunk);
          };
        }
        if (typeof popup.print === 'function') {
          const origPopPrint = popup.print.bind(popup);
          popup.print = function () {
            const fullSrc = popupHtml || (popup.document && popup.document.documentElement ? popup.document.documentElement.outerHTML : '');
            const handled = routeCapturedHtml(fullSrc, origPopPrint);
            if (handled) {
              try { popup.close(); } catch (_) {}
            }
          };
        }
      } catch (_) {}
      return popup;
    };
  }
})();

/* === [PSP ABSOLUTE GLOBAL LEGACY HTML -> ADOPTED TEMPLATE UPGRADER] === */
(function installPspAbsoluteGlobalAdoptionUpgrader() {
  'use strict';

  function installUpgrader() {
    const Unifier = window.GherbiPrintGlobalUnifier;
    const PSP = window.GherbiPrintStudioPro;
    if (!Unifier || !PSP || !PSP.router || Unifier._absoluteAdoptionReady) return false;
    Unifier._absoluteAdoptionReady = true;

    const LABEL_SKIP_RE = /barcode[-_]?label|pl-label|label-grid|data-is-barcode-label|طابور الملصقات|ملصق باركود/i;

    function detectLegacyDocInfo(rawHtml, opts = {}) {
      const html = String(rawHtml || '');
      const plain = html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');

      const isA4Hint =
        String(opts.paperSize || opts.paper || '').toLowerCase() === 'a4' ||
        /تقرير مفصل|210mm|A4\s+portrait/i.test(html);
      const isA5Hint =
        String(opts.paperSize || opts.paper || '').toLowerCase() === 'a5' ||
        /148mm|A5\s+portrait/i.test(html);
      const is2xA5Hint =
        String(opts.paperSize || opts.paper || '').toLowerCase() === '2xa5' ||
        /297mm|2xA5/i.test(html);
      const isThermalHint =
        ['80mm', '58mm', 'thermal'].includes(String(opts.paperSize || opts.paper || '').toLowerCase()) ||
        (Number(opts.widthMm || 0) > 0 && Number(opts.widthMm || 0) <= 85) ||
        /80mm|58mm/i.test(html);

      if (/تقرير إغلاق الوردية|إغلاق المناوبة|Z-REPORT|Z-Report|X-Report|رقم المناوبة/i.test(plain)) {
        const mSess = plain.match(/(?:رقم المناوبة|المناوبة)\s*:?\s*#?\s*(\d+)/i);
        return {
          docType: isA4Hint && !isThermalHint ? 'caisse_shift_full_audit_a4' : 'caisse_z_report',
          format: isA4Hint && !isThermalHint ? 'a4' : '80mm',
          entityId: mSess ? Number(mSess[1]) : Number(window.GherbiStage5Ops?._activeReviewSessionId || 0),
          kind: 'caisse_shift'
        };
      }

      if (/سند إيداع|تغذية الصندوق|ENT-\d+/i.test(plain)) {
        return { docType: 'caisse_cash_in_voucher_80mm', entityId: null, kind: 'voucher', txType: 'cash_in', plain };
      }
      if (/سند صرف|مصروف تشغيلي|Bon de Dépense|EXP-\d+/i.test(plain)) {
        return { docType: 'expense_voucher', entityId: null, kind: 'voucher', txType: 'expense', plain };
      }

      if (/أمر تصنيع|أمر تشغيل|Ordre de Fabrication|PRD-\d+/i.test(plain)) {
        const mOrd = plain.match(/PRD-(?:\d{4}-)?0*(\d+)/i) || plain.match(/#(\d+)/);
        return { docType: 'production_order_sheet', entityId: mOrd ? Number(mOrd[1]) : null, kind: 'bom' };
      }
      if (/محضر الجرد|جرد مخزني|Inventaire|INV-\d+/i.test(plain)) {
        const mSt = plain.match(/INV-(?:\d{4}-)?0*(\d+)/i) || plain.match(/#(\d+)/);
        return { docType: 'stocktake_sheet_a4', entityId: mSt ? Number(mSt[1]) : null, kind: 'stocktake' };
      }

      if (/وصل استلام دفعة|Reçu de Paiement|Reçu de Règlement|وصل تسديد|REC-\d+/i.test(plain)) {
        const isSup = /مورد|Fournisseur/i.test(plain);
        return { docType: isSup ? 'supplier_payment_receipt' : 'payment_receipt', entityId: null, kind: 'generic', plain };
      }

      if (/فاتورة شكلية|Proforma|Devis|PRO-\d+/i.test(plain)) {
        const m = plain.match(/PRO-(?:\d{4}-)?0*(\d+)/i);
        return { docType: 'proforma', entityId: m ? Number(m[1]) : null, kind: 'generic' };
      }
      if (/طلبية زبون|Bon de Commande|BC-\d+/i.test(plain)) {
        const m = plain.match(/BC-(?:\d{4}-)?0*(\d+)/i);
        return { docType: 'customer_order', entityId: m ? Number(m[1]) : null, kind: 'generic' };
      }
      if (/وصل التوصيل|وصل تسليم|Bon de Livraison|BL-\d+/i.test(plain)) {
        const m = plain.match(/(?:BL|FAC)-(?:\d{4}-)?0*(\d+)/i);
        return { docType: 'delivery_note', entityId: m ? Number(m[1]) : null, kind: 'generic' };
      }
      if (/إشعار دائن|Facture d'Avoir|AV-\d+/i.test(plain)) {
        const m = plain.match(/(?:AV|FAC)-(?:\d{4}-)?0*(\d+)/i);
        return { docType: 'credit_note', entityId: m ? Number(m[1]) : null, kind: 'generic' };
      }
      if (/شهادة ضمان|Certificat de Garantie|GAR-\d+/i.test(plain)) {
        const m = plain.match(/(?:GAR|FAC)-(?:\d{4}-)?0*(\d+)/i);
        return { docType: 'warranty_cert', entityId: m ? Number(m[1]) : null, kind: 'generic' };
      }
      if (/فاتورة مجمعة|Facture Récapitulative|FR-\d+/i.test(plain)) {
        return { docType: 'recap_invoice_a4', entityId: null, kind: 'generic' };
      }
      if (/قائمة الأسعار|Catalogue des Prix/i.test(plain)) {
        return { docType: 'price_catalog_a4', entityId: null, kind: 'generic' };
      }

      if (/مرتجع مورد|Bon de Retour Fournisseur|RF-\d+/i.test(plain)) {
        const m = plain.match(/RF-(?:\d{4}-)?0*(\d+)/i);
        return { docType: 'supplier_return_note', entityId: m ? Number(m[1]) : null, kind: 'generic' };
      }
      if (/فاتورة شراء|وصل استلام بضاعة|Bon de Réception|ACH-\d+|BR-\d+/i.test(plain)) {
        const m = plain.match(/(?:ACH|BR)-(?:\d{4}-)?0*(\d+)/i);
        return { docType: 'purchase_invoice', entityId: m ? Number(m[1]) : null, kind: 'generic' };
      }
      if (/كشف حساب المورد|Relevé Fournisseur/i.test(plain)) {
        return { docType: 'supplier_ledger_a4', entityId: null, kind: 'generic' };
      }
      if (/كشف حساب الزبون|كرني الديون|Relevé Client|Carnet de Crédit/i.test(plain)) {
        return { docType: isThermalHint ? 'customer_carnet_80mm' : 'customer_ledger_a4', entityId: null, kind: 'generic' };
      }
      if (/التصريح الجبائي|استمارة حساب الضريبة|IFU|G12|G50/i.test(plain)) {
        return { docType: 'fiscal_g12_statement', entityId: null, kind: 'generic' };
      }
      if (/التقرير الجنائي|رادار الرقابة|Anti-Fraude/i.test(plain)) {
        return { docType: 'forensic_audit_report', entityId: null, kind: 'generic' };
      }

      if (/فاتورة|Facture|FAC-\d+|وصل بيع|تذكرة|Ticket/i.test(plain)) {
        const m = plain.match(/FAC-(?:\d{4}-)?0*(\d+)/i) || plain.match(/(?:رقم|N°)\s*:?\s*#?(\d+)/i);
        const docType = isThermalHint
          ? 'receipt_thermal'
          : is2xA5Hint
          ? 'invoice_2xa5'
          : isA5Hint
          ? 'invoice_a5'
          : 'invoice_a4';
        return { docType, entityId: m ? Number(m[1]) : null, kind: 'generic' };
      }

      return null;
    }

    Unifier.upgradeLegacyHtmlToAdoptedPsp = async function upgradeLegacyHtml(channelOrMode, rawArg) {
      const payload = typeof rawArg === 'string'
        ? { html: rawArg }
        : (rawArg && typeof rawArg === 'object' ? { ...rawArg } : {});

      const html = String(payload.html || '');
      if (!html) return null;

      if (LABEL_SKIP_RE.test(html)) return null;

      const asPdf = channelOrMode === 'export-pdf' || Boolean(payload.asPdf);

      if (html.includes('data-psp-rendered="1"')) {
        const mPaper = html.match(/data-psp-paper=["']([^"']+)["']/i);
        const mDoc = html.match(/data-psp-doc=["']([^"']+)["']/i);
        const paperSize = (mPaper && mPaper[1]) || payload.paperSize || '80mm';
        const docId = (mDoc && mDoc[1]) || payload.docId || 'document';
        return {
          html,
          paperSize,
          asPdf,
          silent: Boolean(payload.silent),
          copies: Math.max(1, Number(payload.copies || 1)),
          printerName: String(payload.printerName || payload.deviceName || ''),
          filename: String(payload.filename || (docId + '_' + paperSize + '.pdf'))
        };
      }

      const info = detectLegacyDocInfo(html, payload);
      if (!info || !info.docType) return null;

      try {
        let rendered = null;

        if (info.kind === 'caisse_shift' && window.GherbiStage5Ops) {
          rendered = await window.GherbiStage5Ops.printShiftZReport(
            info.entityId || null,
            info.format || '80mm',
            { renderOnly: true, asPdf }
          );
        } else if (info.kind === 'bom' && window.GherbiStage5Ops && info.entityId) {
          rendered = await window.GherbiStage5Ops.printProductionOrder(info.entityId, { renderOnly: true, asPdf });
        } else if (info.kind === 'stocktake' && window.GherbiStage5Ops && info.entityId) {
          rendered = await window.GherbiStage5Ops.printStocktakeSheet(info.entityId, { renderOnly: true, asPdf });
        } else if (info.kind === 'voucher' && window.GherbiStage5Ops) {
          const mAmt = String(info.plain || '').match(/([0-9]+(?:[.,][0-9]+)?)\s*د\.ج/);
          const amt = mAmt ? parseFloat(mAmt[1].replace(',', '.')) || 0 : 0;
          rendered = await window.GherbiStage5Ops.printCashOrExpenseVoucher(
            { type: info.txType || 'expense', amount: amt, description: info.txType === 'cash_in' ? 'إيداع نقدي' : 'مصروف تشغيلي' },
            { renderOnly: true, asPdf }
          );
        } else {
          const rawData = await PSP.router.fetchDocDataByEntityId(info.docType, info.entityId || null);
          const freshData = typeof PSP.router.hydrateFreshCustomerOntoDoc === 'function'
            ? await PSP.router.hydrateFreshCustomerOntoDoc(info.docType, rawData)
            : rawData;
          rendered = PSP.router.renderDoc(info.docType, freshData, asPdf ? 'pdf' : 'print', {
            forceOverride: false
          });
        }

        if (rendered && rendered.fullHtml) {
          const adoptedPaper = rendered.paperSize || PSP.state.getTemplate(info.docType).paperSize || '80mm';
          Unifier.metrics.interceptedRawHtmlPrints = (Unifier.metrics.interceptedRawHtmlPrints || 0) + 1;
          return {
            html: rendered.fullHtml,
            paperSize: adoptedPaper,
            asPdf,
            silent: Boolean(payload.silent),
            copies: Math.max(1, Number(payload.copies || 1)),
            printerName: String(payload.printerName || payload.deviceName || ''),
            filename: String(payload.filename || (info.docType + '_' + adoptedPaper + '.pdf'))
          };
        }
      } catch (upErr) {
        console.warn('[PSP Absolute Legacy Upgrade Warning]:', upErr && upErr.message);
      }
      return null;
    };

    if (window.api && typeof window.api.registerPspAbsolutePrintHook === 'function') {
      window.api.registerPspAbsolutePrintHook((channel, arg) => Unifier.upgradeLegacyHtmlToAdoptedPsp(channel, arg));
      console.log('🛡️ [PSP ABSOLUTE ADOPTION]: تم ربط خطاف الاعتماد المطلق بـ preload.js (print-silent + export-pdf) لكافة الصفحات الـ 18!');
    }

    return true;
  }

  if (!installUpgrader()) {
    let n = 0;
    const iv = setInterval(() => {
      n++;
      if (installUpgrader() || n >= 40) clearInterval(iv);
    }, 100);
  }
})();
