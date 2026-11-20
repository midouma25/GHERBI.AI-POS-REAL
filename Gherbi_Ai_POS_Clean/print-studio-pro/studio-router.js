/**
 * print-studio-pro/studio-router.js
 * المرحلة 5: الموجه المركزي للطباعة والـ PDF والربط الشامل مع الصفحات الـ 18
 */
'use strict';
(function buildStudioRouterModule() {
  (function initPrintStudioProRouter() {
    'use strict';

    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state || !PSP.renderer) return;

    const { fmtDzd, fmtCentimes } = PSP.utils;

    // خريطة توحيد جميع المسميات القديمة والاختصارات إلى المعرفات الدقيقة للـ 34 مستنداً
    const DOC_TYPE_ALIASES = {
      receipt: 'receipt_thermal',
      ticket: 'receipt_thermal',
      thermal: 'receipt_thermal',
      pos_receipt: 'receipt_thermal',
      invoice: 'invoice_a4',
      facture: 'invoice_a4',
      a4: 'invoice_a4',
      a5: 'invoice_a5',
      '2xa5': 'invoice_2xa5',
      delivery: 'delivery_note',
      bl: 'delivery_note',
      proforma_invoice: 'proforma',
      order: 'customer_order',
      bc: 'customer_order',
      avoir: 'credit_note',
      warranty: 'warranty_cert',
      credit_confirm: 'debt_confirm_ticket_80mm',
      partial_credit: 'pos_partial_credit_80mm',
      payment: 'payment_receipt',
      reçu: 'payment_receipt',
      carnet: 'customer_carnet_80mm',
      carnet_80mm: 'customer_carnet_80mm',
      ledger: 'customer_ledger_a4',
      customer_ledger: 'customer_ledger_a4',
      debt_history: 'customer_debt_history_a4',
      global_debtors: 'global_debtors_register_a4',
      vip_card: 'f8_vip_loyalty_debt_card_80mm',
      loyalty_card: 'loyalty_vip_card_80mm',
      recap: 'recap_invoice_a4',
      installment: 'installment_contract',
      reception: 'purchase_invoice',
      br: 'purchase_invoice',
      supplier_payment: 'supplier_payment_receipt',
      supplier_return: 'supplier_return_note',
      supplier_ledger: 'supplier_ledger_a4',
      stocktake: 'stocktake_sheet_a4',
      catalog: 'price_catalog_a4',
      price_list: 'price_catalog_a4',
      production: 'production_order_sheet',
      low_stock: 'low_stock_order_a4',
      z_report: 'caisse_z_report',
      caisse_z: 'caisse_z_report',
      z_report_a4: 'caisse_shift_full_audit_a4',
      cash_in: 'caisse_cash_in_voucher_80mm',
      expense: 'expense_voucher',
      g12: 'fiscal_g12_statement',
      g50: 'fiscal_g12_statement',
      audit: 'forensic_audit_report'
    };

    function resolveCanonicalDocType(rawType) {
      const clean = String(rawType || 'receipt_thermal').trim();
      const mapped = DOC_TYPE_ALIASES[clean.toLowerCase()] || clean;
      const exists = PSP.state.getTemplatesRegistry().some((d) => d.id === mapped);
      return exists ? mapped : 'receipt_thermal';
    }

    function esc(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function notify(msg, type = 'success') {
      if (typeof window.showToast === 'function') return window.showToast(msg, type);
      if (window.App && typeof window.App.showToast === 'function') return window.App.showToast(msg, type);
      if (window.App && typeof window.App.toast === 'function') return window.App.toast(msg, type);
    }

    // تحويل سجل خام من SQLite (فاتورة بيع، شراء، طلبية، وردية...) إلى كائن docData موحد ونقي
    function mapRawRecordToDocData(docType, rec) {
      if (!rec || typeof rec !== 'object') return {};

      // إذا كان الكائن جاهزاً مسبقاً (يحتوي partyName و docNumber)
      if (rec.partyName !== undefined && rec.docNumber !== undefined && Array.isArray(rec.items)) {
        return rec;
      }

      // حالة الوردية والصندوق (Z-Report 80mm / A4)
      if (rec.session && rec.summary) {
        return buildShiftDocDataFromSummary(rec, docType);
      }

      const items = Array.isArray(rec.items)
        ? rec.items.map((it) => ({
            barcode: it.product_barcode || it.barcode || '-',
            name: it.product_name || it.custom_product_name || it.name || 'صنف',
            unit: it.product_unit || it.unit || 'قطعة',
            qty: Number(it.quantity ?? it.qty ?? 1),
            price: Number(it.price ?? it.cost_price ?? 0),
            discount: Number(it.discount || 0),
            tva: Number(it.tva || 0),
            subtotal: Number(it.subtotal ?? it.total_cost ?? (Number(it.quantity ?? it.qty ?? 1) * Number(it.price ?? it.cost_price ?? 0)))
          }))
        : [];

      const isSupplierDoc = docType.startsWith('purchase_') || docType.startsWith('supplier_');
      const cid = Number(rec.customer_id || rec.customerId || 0);
      const sid = Number(rec.supplier_id || rec.supplierId || 0);
      const total = Number(rec.total ?? 0);
      const paid = Number(rec.paid_amount ?? rec.paidAmount ?? (docType === 'proforma' ? 0 : total));
      const remDebt = Math.max(0, Number((total - paid).toFixed(2)));

      const partyName = isSupplierDoc
        ? (rec.supplier_name || rec.partyName || (sid ? `مورد #${sid}` : 'مورد'))
        : cid > 0
        ? (rec.customer_name || rec.partyName || `زبون #${cid}`)
        : (rec.partyName || 'زبون عابر (Comptoir)');

      return {
        docNumber: rec.doc_number || rec.invoice_number || rec.return_number || rec.number || rec.receipt_number || rec.docNumber || String(rec.id || '101'),
        date: String(rec.sale_date || rec.date || rec.order_date || rec.created_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
        customerId: isSupplierDoc ? (sid || 1) : (cid > 0 ? cid : null),
        isWalkinCustomer: !isSupplierDoc && cid <= 0 && !String(partyName).includes('FID-') && !String(partyName).includes('👑'),
        partyTitle: isSupplierDoc ? 'المورد:' : 'الزبون:',
        partyName,
        partyPhone: rec.customer_phone || rec.supplier_phone || rec.partyPhone || '',
        partyAddress: rec.customer_address || rec.supplier_address || rec.partyAddress || '',
        partyRc: rec.customer_rc || rec.supplier_rc || rec.partyRc || '',
        partyNif: rec.customer_nif || rec.supplier_nif || rec.partyNif || '',
        paymentMethod: rec.payment_method || rec.paymentMethod || 'نقداً (Espèces)',
        previousBalance: rec.previous_debt ?? rec.previousBalance,
        loyaltyTotalBalance: rec.loyaltyTotalBalance ?? rec.loyalty_points ?? rec.customer_loyalty_points,
        loyaltyPointsEarned: rec.loyaltyPointsEarned ?? rec.loyalty_points_earned,
        loyaltyPointsUsed: rec.loyaltyPointsUsed ?? rec.loyalty_points_used,
        customerCurrentTotalDebt: rec.customerCurrentTotalDebt ?? rec.customer_total_debt,
        shiftSummary: rec.shiftSummary,
        installmentMonths: rec.installmentMonths ?? rec.months_count,
        _previewMode: rec._previewMode,
        _docType: docType,
        _docKind: (docType === 'payment_receipt' || docType === 'supplier_payment_receipt') ? 'settlement' : rec._docKind,
        cashierName: rec.seller_name || rec.user_name || rec.cashierName || (window.AppState?.currentUser?.name || 'المدير العام'),
        driverName: rec.driver_name || rec.driverName || '',
        vehiclePlate: rec.vehicle_plate || rec.vehiclePlate || '',
        items,
        subtotal: Number(rec.subtotal ?? total),
        discount: Number(rec.discount || 0),
        tvaAmount: Number(rec.tvaAmount ?? 0),
        stampAmount: Number(rec.stamp_amount ?? rec.stampAmount ?? 0),
        total,
        paidAmount: paid,
        receivedAmount: Number(rec.received_amount ?? rec.receivedAmount ?? paid),
        remainingDebt: remDebt
      };
    }

    // بناء بيانات محضر الوردية (Z-Report 80mm / A4) بفصل دقيق بين السيولة والديون والمصاريف
    function buildShiftDocDataFromSummary(details, docType = 'caisse_z_report') {
      const sess = (details && details.session) || {};
      const sum = (details && details.summary) || {};
      const txs = Array.isArray(details && details.transactions) ? details.transactions : [];
      const creditSales = Array.isArray(details && details.creditSales) ? details.creditSales : [];

      const opening = Number(sess.opening_balance ?? sum.openingBalance ?? 0);
      const cashSales = Number(sum.cashSales || 0);
      const debtPayments = Number(sum.debtPayments || 0);
      const orderDeposits = Number(sum.orderDeposits || 0);
      const cashIn = Number(sum.cashIn || 0);
      const cashOut = Number(sum.cashOut || 0);
      const expenses = Number(sum.expenses || 0);
      const expectedDrawer = Number(
        sess.expected_balance ??
          sum.expectedBalance ??
          (opening + cashSales + debtPayments + orderDeposits + cashIn - cashOut - expenses)
      );
      const countedDrawer =
        sess.closing_balance !== null && sess.closing_balance !== undefined
          ? Number(sess.closing_balance)
          : expectedDrawer;
      const diff = Number((countedDrawer - expectedDrawer).toFixed(2));
      const newCreditGiven = Number(sum.newCreditGiven || 0);
      const creditCount = Number(sum.creditInvoicesCount || creditSales.length || 0);
      const totalGrossSales = Number(sum.totalSalesGross || (cashSales + newCreditGiven));
      const totalStoreDebt = Number(sum.totalStoreCustomerDebt || 0);

      const openedStr = String(sess.opened_at || '').replace('T', ' ').slice(0, 16);
      const closedStr = sess.closed_at ? String(sess.closed_at).replace('T', ' ').slice(0, 16) : 'مفتوحة الآن';

      const items = [
        { barcode: '1-OPEN', name: '1. الرصيد الافتتاحي في الدرج (Fond de Caisse)', unit: 'سيولة درج', qty: 1, price: opening, subtotal: opening },
        { barcode: '2-CASH', name: '2. المبيعات النقدية المحصلة + المدفوع جزئياً (+)', unit: 'سيولة درج', qty: 1, price: cashSales, subtotal: cashSales },
        { barcode: '3-DEBT-IN', name: `3. تحصيلات ديون الزبائن نقداً Alt+V (${sum.debtPaymentsCount || 0}) (+)`, unit: 'تحصيل دين', qty: 1, price: debtPayments, subtotal: debtPayments },
        { barcode: '4-IN', name: '4. إيداعات نقدية وعربون طلبيات (+)', unit: 'إيداع', qty: 1, price: cashIn + orderDeposits, subtotal: cashIn + orderDeposits },
        { barcode: '5-OUT', name: '5. المصاريف والمسحوبات النقدية من الدرج (-)', unit: 'خصم درج', qty: 1, price: -(cashOut + expenses), subtotal: -(cashOut + expenses) },
        { barcode: '6-CREDIT', name: `6. [ذمم آجلة]: ديون جديدة ممنوحة في الوردية Alt+D (${creditCount} فاتورة — لا تدخل في كاش الدرج)`, unit: 'آجل', qty: creditCount || 1, price: newCreditGiven, subtotal: 0 },
        { barcode: '7-GROSS', name: `7. رقم أعمال الوردية الكلي (نقد + دين): ${fmtDzd(totalGrossSales)} | إجمالي ديون المتجر: ${fmtDzd(totalStoreDebt)}`, unit: 'خلاصة', qty: 1, price: totalGrossSales, subtotal: 0 }
      ];

      if (docType === 'caisse_shift_full_audit_a4') {
        for (const cs of creditSales.slice(0, 20)) {
          items.push({
            barcode: cs.doc_number || ('#' + cs.id),
            name: `📝 فاتورة دين: ${cs.customer_name || 'زبون'} (الإجمالي: ${Number(cs.total || 0).toFixed(2)} | المدفوع: ${Number(cs.paid_amount || 0).toFixed(2)} | الدين: ${Number(cs.remaining_debt || 0).toFixed(2)} د.ج)`,
            unit: 'فاتورة دين',
            qty: 1,
            price: Number(cs.remaining_debt || 0),
            subtotal: 0
          });
        }
        for (const tx of txs.slice(0, 25)) {
          const isOut = tx.type === 'cash_out' || tx.type === 'expense';
          const amt = isOut ? -Math.abs(Number(tx.amount || 0)) : Math.abs(Number(tx.amount || 0));
          items.push({
            barcode: String(tx.created_at || '').replace('T', ' ').slice(11, 16) || ('#' + tx.id),
            name: `حركة صندوق: ${tx.description || tx.category || tx.type}`,
            unit: tx.type === 'debt_payment' ? 'قبض دين' : isOut ? 'مصروف/سحب' : 'إيداع',
            qty: 1,
            price: amt,
            subtotal: 0
          });
        }
      }

      return {
        docNumber: `Z-SHIFT-#${sess.id || 1}`,
        date: closedStr !== 'مفتوحة الآن' ? closedStr : openedStr,
        customerId: 1,
        isWalkinCustomer: false,
        partyTitle: 'الوردية / أمين الصندوق:',
        partyName: `الوردية #${sess.id || 1} — الكاشير: ${sess.user_name || 'المدير العام'}`,
        partyPhone: `افتتاح: ${openedStr} | إغلاق: ${closedStr}`,
        paymentMethod: Math.abs(diff) < 0.05 ? 'الدرج مطابق 100% ✔' : `فارق السيولة: ${diff.toFixed(2)} د.ج`,
        previousBalance: newCreditGiven,
        shiftSummary: {
          openingBalance: opening,
          cashSales,
          debtPayments,
          expenses,
          cashOut,
          expectedBalance: expectedDrawer,
          countedBalance: countedDrawer,
          newCreditGiven,
          totalStoreCustomerDebt: totalStoreDebt
        },
        items,
        subtotal: expectedDrawer,
        discount: 0,
        total: expectedDrawer,
        paidAmount: countedDrawer,
        receivedAmount: countedDrawer,
        remainingDebt: Math.abs(diff)
      };
    }

    // جلب بيانات سجل حي بالمعرف عند الطباعة من أي صفحة
    async function fetchDocDataByEntityId(docType, entityId, fallbackRecord = null) {
      if (fallbackRecord && typeof fallbackRecord === 'object' && (Array.isArray(fallbackRecord.items) || fallbackRecord.session)) {
        return mapRawRecordToDocData(docType, fallbackRecord);
      }

      const id = Number(entityId || 0);
      if (id > 0 && window.api) {
        try {
          if (['receipt_thermal', 'invoice_a4', 'invoice_a5', 'invoice_2xa5', 'delivery_note', 'credit_note', 'warranty_cert', 'debt_confirm_ticket_80mm', 'pos_partial_credit_80mm'].includes(docType) && typeof window.api.getSaleDetails === 'function') {
            const det = await window.api.getSaleDetails(id);
            if (det) return mapRawRecordToDocData(docType, det);
          }
          if (docType === 'proforma' && typeof window.api.getProformaDetails === 'function') {
            const pf = await window.api.getProformaDetails(id);
            if (pf) return mapRawRecordToDocData(docType, pf);
          }
          if (docType === 'customer_order' && typeof window.api.getOrderDetails === 'function') {
            const ord = await window.api.getOrderDetails(id);
            if (ord) return mapRawRecordToDocData(docType, ord);
          }
          if (docType === 'purchase_invoice' && typeof window.api.getInvoiceDetails === 'function') {
            const inv = await window.api.getInvoiceDetails(id);
            if (inv) return mapRawRecordToDocData(docType, inv);
          }
          if (docType === 'supplier_return_note' && typeof window.api.getSupplierReturnDetails === 'function') {
            const sr = await window.api.getSupplierReturnDetails(id);
            if (sr) return mapRawRecordToDocData(docType, sr);
          }
          if ((docType === 'caisse_z_report' || docType === 'caisse_shift_full_audit_a4') && typeof window.api.getSessionDetails === 'function') {
            const sess = await window.api.getSessionDetails(id);
            if (sess) return buildShiftDocDataFromSummary(sess, docType);
          }
          if (docType === 'payment_receipt' && typeof window.api.getPaymentDetails === 'function') {
            const pay = await window.api.getPaymentDetails(id, 'sale');
            if (pay) return mapRawRecordToDocData(docType, pay);
          }
          if (docType === 'supplier_payment_receipt' && typeof window.api.getPaymentDetails === 'function') {
            const pay = await window.api.getPaymentDetails(id, 'purchase');
            if (pay) return mapRawRecordToDocData(docType, pay);
          }
          if (docType === 'stocktake_sheet_a4' && typeof window.api.getStocktake === 'function') {
            const st = await window.api.getStocktake(id);
            if (st) return mapRawRecordToDocData(docType, st);
          }
          if (docType === 'production_order_sheet' && typeof window.api.getProductionOrder === 'function') {
            const po = await window.api.getProductionOrder(id);
            if (po) return mapRawRecordToDocData(docType, po);
          }
        } catch (e) {
          console.warn('[PSP Router Fetch Warning]:', e.message);
        }
      }

      if (fallbackRecord && typeof fallbackRecord === 'object') {
        return mapRawRecordToDocData(docType, fallbackRecord);
      }
      const meta = PSP.state.getDocMeta(docType);
      return PSP.utils.deepClone(meta.sampleData || {});
    }

    // ========================================================================
    // الموجه المركزي الموحد للطباعة والـ PDF (PSP.router)
    // ========================================================================
    const Router = {
      resolveCanonicalDocType,
      mapRawRecordToDocData,
      buildShiftDocDataFromSummary,
      fetchDocDataByEntityId,

      smartResolveAltDDocType(canonicalType, mappedData) {
        if (canonicalType === 'pos_partial_credit_80mm' || canonicalType === 'debt_confirm_ticket_80mm') {
          const paid = Number(mappedData && (mappedData.paidAmount ?? mappedData.paid_amount ?? 0));
          const total = Number(mappedData && (mappedData.total ?? 0));
          const rem = Math.max(0, Number((total - paid).toFixed(2)));
          if (paid <= 0.009 && total > 0.009) return 'debt_confirm_ticket_80mm';
          if (paid > 0.009 && rem > 0.009) return 'pos_partial_credit_80mm';
        }
        return canonicalType;
      },

      renderDoc(rawDocType, rawDocData, mode = 'print', extraOpts = {}) {
        const baseType = resolveCanonicalDocType(rawDocType);
        const mappedData = mapRawRecordToDocData(baseType, rawDocData || {});
        const docType = this.smartResolveAltDDocType(baseType, mappedData);
        const tpl = PSP.state.getTemplate(docType);
        return {
          docType,
          template: tpl,
          ...PSP.renderer.renderDocument(tpl, mappedData, mode, extraOpts)
        };
      },

      async logPrintQuietly(docType, docId, docNumber, copies = 1, printerName = '') {
        try {
          if (window.api && typeof window.api.logDocumentPrint === 'function') {
            await window.api.logDocumentPrint({
              doc_type: docType || 'invoice_a4',
              doc_id: docId || null,
              doc_number: docNumber || null,
              user_id: window.AppState?.currentUser?.id || 1,
              printer_name: printerName || null,
              copies: Number(copies || 1)
            });
          }
        } catch (_) {}
      },

      async executePrintHtml(opts = {}) {
        const html = String(opts.html || '');
        if (!html) return { ok: false };
        const paperSize = opts.paperSize || '80mm';
        const asPdf = Boolean(opts.asPdf);
        const docId = opts.docId || 'document';
        const docType = opts.docType || docId;
        const copies = Math.max(1, Number(opts.copies || 1));
        const printerName = opts.printerName || '';

        let res = null;
        try {
          if (asPdf) {
            if (window.api && typeof window.api.exportHtmlToPdf === 'function') {
              res = await window.api.exportHtmlToPdf({ html, filename: `${docId}.pdf`, paperSize });
            } else if (window.api && typeof window.api.printToPdf === 'function') {
              res = await window.api.printToPdf({ html, filename: `${docId}.pdf`, paperSize });
            } else if (typeof window.__gherbiMasterPrintSilent === 'function') {
              res = await window.__gherbiMasterPrintSilent({ html, paperSize, silent: false, asPdf: true });
            }
          } else {
            const silentPref = String(window.AppState?.settings?.silent_print || 'false') === 'true';
            const silent = opts.silent !== undefined ? Boolean(opts.silent) : silentPref;
            if (typeof window.__gherbiMasterPrintSilent === 'function') {
              res = await window.__gherbiMasterPrintSilent({ html, paperSize, silent, copies, printerName });
            } else if (window.api && typeof window.api.printHtml === 'function') {
              res = await window.api.printHtml({ html, paperSize, silent, copies, printerName });
            }
          }
        } catch (e) {
          console.warn('[PSP Router Print Dispatch Warning]:', e.message);
        }

        if (!res) {
          const iframe = document.createElement('iframe');
          iframe.setAttribute('data-psp-allow-native-print', '1');
        iframe.style.cssText = 'position:fixed;right:-9999px;bottom:-9999px;width:0;height:0;border:0;';
          document.body.appendChild(iframe);
          iframe.contentDocument.open();
          iframe.contentDocument.write(html);
          iframe.contentDocument.close();
          setTimeout(() => {
            try {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            } catch (_) {}
            setTimeout(() => iframe.remove(), 1500);
          }, 220);
        }

        this.logPrintQuietly(docType, opts.entityId, opts.docNumber, copies, printerName);
        return { ok: true, result: res };
      },

      async printDocumentByType(rawDocType, entityIdOrData, opts = {}) {
        const docType = resolveCanonicalDocType(rawDocType);
        const tpl = PSP.state.getTemplate(docType);
        const isObj = entityIdOrData && typeof entityIdOrData === 'object';
        const docData = isObj
          ? mapRawRecordToDocData(docType, entityIdOrData)
          : await fetchDocDataByEntityId(docType, entityIdOrData);

        const mode = opts.asPdf ? 'pdf' : 'print';
        const rendered = PSP.renderer.renderDocument(tpl, docData, mode, opts);

        return await this.executePrintHtml({
          html: rendered.fullHtml,
          paperSize: rendered.paperSize,
          asPdf: Boolean(opts.asPdf),
          docId: docType,
          docType,
          entityId: isObj ? (entityIdOrData.id || null) : entityIdOrData,
          docNumber: rendered.docData.docNumber,
          copies: opts.copies || tpl.copies || 1,
          printerName: opts.printerName || tpl.printerName || '',
          silent: opts.silent
        });
      },

      // نافذة معاينة سريعة ونظيفة (تُستخدم لكرني 80mm / كشف A4 من هيستوريك الديون Alt+H وبطاقة F8)
      openQuickPreviewModal(rawDocType, rawDocData, opts = {}) {
        const docType = resolveCanonicalDocType(rawDocType);
        this._quickCtx = {
          docType,
          docData: mapRawRecordToDocData(docType, rawDocData || {}),
          paperOverride: opts.paperSize || null,
          altDocType: opts.altDocType || null
        };

        let modal = document.getElementById('pspQuickPreviewModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'pspQuickPreviewModal';
          modal.style.cssText = 'position:fixed;inset:0;z-index:32500;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,0.82);backdrop-filter:blur(4px);padding:16px;';
          document.body.appendChild(modal);
        }

        const renderBody = () => {
          const ctx = this._quickCtx;
          const tpl = PSP.state.getTemplate(ctx.docType);
          const meta = PSP.state.getDocMeta(ctx.docType);
          const paperSize = ctx.paperOverride || tpl.paperSize;
          const rendered = PSP.renderer.renderDocument(tpl, ctx.docData, 'preview', {
            paperSize,
            zoomPct: paperSize === 'a4' ? 86 : 100
          });

          const isKarnetPair = ctx.docType === 'customer_carnet_80mm' || ctx.docType === 'customer_ledger_a4' || ctx.docType === 'customer_debt_history_a4';

          modal.innerHTML = `
            <div style="background:var(--bg-surface,#fff);color:var(--text-main,#0f172a);border:2px solid #2563eb;border-radius:18px;width:min(980px,95vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.45);direction:rtl;text-align:right;font-family:'Cairo',Tahoma,sans-serif;">
              <div style="background:#0f172a;color:#fff;padding:12px 16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="padding:2px 8px;border-radius:6px;background:#2563eb;font-family:monospace;font-weight:900;font-size:11px;">${esc(paperSize.toUpperCase())}</span>
                    <strong style="font-size:14px;">${esc(meta.name)}</strong>
                  </div>
                  <div style="font-size:11px;color:#cbd5e1;margin-top:2px;">${esc(ctx.docData.partyName || '')} — ${esc(ctx.docData.docNumber || '')}</div>
                </div>
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
                  ${isKarnetPair ? `
                    <button type="button" id="pspQpBtn80" style="height:32px;padding:0 10px;border-radius:8px;border:none;font-weight:800;font-size:11.5px;cursor:pointer;background:${ctx.docType === 'customer_carnet_80mm' ? '#f59e0b' : '#1e293b'};color:${ctx.docType === 'customer_carnet_80mm' ? '#0f172a' : '#e2e8f0'};">🧾 كرني 80mm</button>
                    <button type="button" id="pspQpBtnA4" style="height:32px;padding:0 10px;border-radius:8px;border:none;font-weight:800;font-size:11.5px;cursor:pointer;background:${ctx.docType === 'customer_ledger_a4' ? '#f59e0b' : '#1e293b'};color:${ctx.docType === 'customer_ledger_a4' ? '#0f172a' : '#e2e8f0'};">📄 كشف A4</button>
                    <button type="button" id="pspQpBtnHist" style="height:32px;padding:0 10px;border-radius:8px;border:none;font-weight:800;font-size:11.5px;cursor:pointer;background:${ctx.docType === 'customer_debt_history_a4' ? '#f59e0b' : '#1e293b'};color:${ctx.docType === 'customer_debt_history_a4' ? '#0f172a' : '#e2e8f0'};">📜 هيستوريك السلع</button>
                  ` : ''}
                  <button type="button" id="pspQpPrintBtn" style="height:32px;padding:0 12px;border-radius:8px;border:none;background:#059669;color:#fff;font-weight:900;font-size:11.5px;cursor:pointer;">🖨️ طباعة الآن</button>
                  <button type="button" id="pspQpPdfBtn" style="height:32px;padding:0 10px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-weight:900;font-size:11.5px;cursor:pointer;">📄 PDF</button>
                  <button type="button" id="pspQpCustomizeBtn" style="height:32px;padding:0 10px;border-radius:8px;border:none;background:#4f46e5;color:#fff;font-weight:800;font-size:11.5px;cursor:pointer;">🎨 تخصيص القالب</button>
                  <button type="button" id="pspQpCloseBtn" style="height:32px;padding:0 10px;border-radius:8px;border:none;background:#dc2626;color:#fff;font-weight:900;font-size:11.5px;cursor:pointer;">✕</button>
                </div>
              </div>
              <div class="psp-desk-scroll" style="background:#cbd5e1;flex:1;min-height:0;">
                ${rendered.paperHtml}
              </div>
            </div>
          `;

          const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
          bind('pspQpCloseBtn', () => { modal.style.display = 'none'; });
          bind('pspQpBtn80', () => { ctx.docType = 'customer_carnet_80mm'; ctx.paperOverride = '80mm'; renderBody(); });
          bind('pspQpBtnA4', () => { ctx.docType = 'customer_ledger_a4'; ctx.paperOverride = 'a4'; renderBody(); });
          bind('pspQpBtnHist', () => { ctx.docType = 'customer_debt_history_a4'; ctx.paperOverride = 'a4'; renderBody(); });
          bind('pspQpPrintBtn', async () => {
            const out = PSP.renderer.renderDocument(tpl, ctx.docData, 'print', { paperSize });
            await this.executePrintHtml({ html: out.fullHtml, paperSize: out.paperSize, asPdf: false, docId: ctx.docType, docType: ctx.docType, docNumber: out.docData.docNumber, copies: tpl.copies, printerName: tpl.printerName });
          });
          bind('pspQpPdfBtn', async () => {
            const out = PSP.renderer.renderDocument(tpl, ctx.docData, 'pdf', { paperSize });
            await this.executePrintHtml({ html: out.fullHtml, paperSize: out.paperSize, asPdf: true, docId: ctx.docType, docType: ctx.docType, docNumber: out.docData.docNumber });
          });
          bind('pspQpCustomizeBtn', () => {
            modal.style.display = 'none';
            document.getElementById('v68HistoryMasterModal')?.classList.add('hidden');
            if (PSP.ui) PSP.ui.openDocInStudio(ctx.docType);
          });
        };

        modal.style.display = 'flex';
        renderBody();
      },

      // بناء بيانات كرني/كشف ديون زبون وفي من SQLite (لزري كرني 80mm و A4 في Alt+H وبطاقة F8)
      async buildCustomerDebtStatementData(customerId) {
        const cid = Number(customerId || 0);
        if (!cid) return null;

        let cust = null;
        if (window.GherbiDebtV68) {
          await window.GherbiDebtV68.syncFromSqlite(true);
          cust = window.GherbiDebtV68.customersById.get(cid);
        }
        if (!cust && window.api && typeof window.api.getCustomers === 'function') {
          const allC = await window.api.getCustomers({});
          cust = (allC || []).find((c) => Number(c.id) === cid);
        }
        if (!cust) return null;

        const custSales = window.api && typeof window.api.getCustomerSales === 'function'
          ? await window.api.getCustomerSales(cid)
          : [];

        const totalSalesVal = Number(cust.total_sales || 0);
        const totalPaidVal = Number(cust.total_paid || 0);
        const netDebtVal = Math.max(0, Number(cust.total_debt || 0));
        const initDebtVal = Math.max(0, Number(cust.initial_debt || 0) - Number(cust.initial_debt_paid || 0));
        const pts = Math.max(0, Math.floor(Number(cust.loyalty_points || 0)));
        const fid = cust.loyalty_card_code || ('FID-' + String(cust.id).padStart(5, '0'));

        const items = [];
        if (initDebtVal > 0.009) {
          items.push({
            barcode: 'INIT',
            name: 'رصيد دين أولي سابق مسجل على الحساب',
            unit: 'رصيد',
            qty: 1,
            price: initDebtVal,
            subtotal: initDebtVal
          });
        }

        for (const s of (Array.isArray(custSales) ? custSales.slice(0, 30) : [])) {
          const tot = Number(s.total || 0);
          const paid = Number(s.paid_amount ?? tot);
          const rem = Math.max(0, Number((tot - paid).toFixed(2)));
          const dt = String(s.sale_date || s.created_at || '').replace('T', ' ').slice(0, 16);
          let itemsNote = '';
          if (rem > 0.009 && window.api && typeof window.api.getSaleDetails === 'function') {
            try {
              const det = await window.api.getSaleDetails(Number(s.id));
              if (det && Array.isArray(det.items) && det.items.length > 0) {
                itemsNote = ' — [' + det.items.map((x) => `${x.product_name || x.custom_product_name || 'صنف'}×${x.quantity}`).join(' + ') + ']';
              }
            } catch (_) {}
          }
          items.push({
            barcode: s.doc_number || ('#' + s.id),
            name: `فاتورة (${dt}) — الإجمالي: ${tot.toFixed(2)} | المدفوع: ${paid.toFixed(2)} | الباقي: ${rem.toFixed(2)} د.ج${itemsNote}`,
            unit: rem > 0.009 ? 'دين قائم' : 'مسددة ✔',
            qty: 1,
            price: tot,
            subtotal: rem > 0.009 ? rem : tot
          });
        }

        if (items.length === 0) {
          items.push({
            barcode: fid,
            name: `وضعية حساب الزبون الوفي (${cust.name}) — صافي الدين الحالي: ${netDebtVal.toFixed(2)} د.ج`,
            unit: 'حساب',
            qty: 1,
            price: netDebtVal,
            subtotal: netDebtVal
          });
        }

        return {
          docNumber: `CARNET-${fid}-${new Date().toISOString().slice(0, 10)}`,
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          customerId: cid,
          isWalkinCustomer: false,
          partyTitle: 'الزبون الوفي:',
          partyName: `👑 ${cust.name} (${fid})`,
          partyPhone: cust.phone || '',
          partyAddress: `${cust.address || 'الجزائر'} | ⭐ النقاط: ${pts} (${pts * 2} د.ج)`,
          partyRc: cust.rc || '',
          partyNif: cust.nif || '',
          paymentMethod: `المشتريات: ${fmtDzd(totalSalesVal)} | المسدد: ${fmtDzd(totalPaidVal)}`,
          previousBalance: initDebtVal,
          loyaltyTotalBalance: pts,
          customerCurrentTotalDebt: netDebtVal,
          items,
          subtotal: totalSalesVal,
          discount: 0,
          total: totalSalesVal,
          paidAmount: totalPaidVal,
          receivedAmount: totalPaidVal,
          remainingDebt: netDebtVal
        };
      },

      async printCustomerStatement(customerId, format = '80mm', directPrint = false) {
        const docData = await this.buildCustomerDebtStatementData(customerId);
        if (!docData) {
          notify('⚠️ لم يتم العثور على بيانات الزبون.', 'warning');
          return;
        }
        const docType = format === 'a4' ? 'customer_ledger_a4' : 'customer_carnet_80mm';
        if (directPrint) {
          return await this.printDocumentByType(docType, docData, { paperSize: format === 'a4' ? 'a4' : '80mm' });
        }
        this.openQuickPreviewModal(docType, docData, { paperSize: format === 'a4' ? 'a4' : '80mm' });
      },

      async printF8VipCard(customerId) {
        const docData = await this.buildCustomerDebtStatementData(customerId);
        if (!docData) return;
        this.openQuickPreviewModal('f8_vip_loyalty_debt_card_80mm', docData, { paperSize: '80mm' });
      }
    };

    // ========================================================================
    // تثبيت جسر التوافق الشامل مع كافة صفحات البرنامج الـ 18 و #posPrintCenterModal
    // ========================================================================
    function installCrossPageBridges() {
      // 1. جسر التوافق العكسي لـ window.GherbiPrintStudioV45 (يغطي POS و Sales و Purchases و Orders و Proformas و Debt V68)
      const legacy = window.GherbiPrintStudioV45;
      if (legacy && !legacy._pspStage5Bridged) {
        legacy._pspStage5Bridged = true;

        legacy.getActiveDocMeta = (docId) => PSP.state.getDocMeta(resolveCanonicalDocType(docId));
        legacy.enrichDocumentDataWithLoyaltyAndDebt = (rawDoc, docTypeHint) => PSP.utils.normalizeDocData(rawDoc, docTypeHint);

        legacy.renderAdoptedMasterDocumentHtml = async (rawDocType, rawDocData, extraOpts = {}) => {
          const out = Router.renderDoc(rawDocType, rawDocData, 'print', extraOpts);
          return out.fullHtml;
        };

        legacy.generateAdoptedHtmlForDocument = async (rawDocType, entityId, rawRecord = null) => {
          const docType = resolveCanonicalDocType(rawDocType);
          const docData = await fetchDocDataByEntityId(docType, entityId, rawRecord);
          const out = Router.renderDoc(docType, docData, 'print');
          return out.fullHtml;
        };

        const bridgePaperFn = (rawDocData, forPrintOutput = false, customOverrides = null) => {
          const docType = resolveCanonicalDocType(customOverrides?.activeDocType || PSP.state.activeDocId);
          const mode = forPrintOutput ? 'print' : 'preview';
          const out = Router.renderDoc(docType, rawDocData, mode, {
            paperSize: customOverrides?.paperSize,
            themeId: customOverrides?.themeId,
            lang: customOverrides?.lang,
            zoomPct: customOverrides?.zoomPct
          });
          return out.paperHtml;
        };

        try {
          Object.defineProperty(legacy, 'buildLiveDocumentPaperHtml', {
            get() { return bridgePaperFn; },
            set() {},
            configurable: true
          });
        } catch (_) {
          try { legacy.buildLiveDocumentPaperHtml = bridgePaperFn; } catch (__) {}
        }

        legacy.customizeCardInStudioNow = (docId) => {
          if (PSP.ui) PSP.ui.openDocInStudio(resolveCanonicalDocType(docId));
        };
      }

      // 2. ربط زري كرني 80mm و كشف A4 في هيستوريك الديون (Alt+H) و GherbiCustomersTurbo
      if (window.GherbiDebtV68 && !window.GherbiDebtV68._pspStage5Bridged) {
        window.GherbiDebtV68._pspStage5Bridged = true;
        window.GherbiDebtV68.printCustomerStatementNow = (cid, fmt = '80mm', direct = false) =>
          Router.printCustomerStatement(cid, fmt, direct);
      }
      window.GherbiCustomersTurbo = window.GherbiCustomersTurbo || {};
      window.GherbiCustomersTurbo.printCustomerStatement = (cid, fmt = '80mm') =>
        Router.printCustomerStatement(cid, fmt, false);

      // 3. ربط تقارير إغلاق الوردية (Z-Report 80mm و A4) في إدارة الصندوق
      if (window.GherbiCaisseTurbo && !window.GherbiCaisseTurbo._pspStage5Bridged) {
        window.GherbiCaisseTurbo._pspStage5Bridged = true;

        window.GherbiCaisseTurbo.buildStudioAdoptedZReportHtml = async (details, paperOverride = null, forPreviewBox = false) => {
          const effectivePaper = paperOverride || PSP.state.getTemplate('caisse_z_report').paperSize || '80mm';
          const docType = effectivePaper === 'a4' ? 'caisse_shift_full_audit_a4' : 'caisse_z_report';
          const docData = buildShiftDocDataFromSummary(details, docType);
          const out = Router.renderDoc(docType, docData, forPreviewBox ? 'preview' : 'print', {
            paperSize: effectivePaper,
            zoomPct: forPreviewBox ? (effectivePaper === 'a4' ? 68 : 95) : 100
          });
          return forPreviewBox ? `<div style="display:flex;justify-content:center;">${out.paperHtml}</div>` : out.fullHtml;
        };

        window.GherbiCaisseTurbo.buildClassicCaisseZReportHtml = (details, forPrint = false) => {
          const docData = buildShiftDocDataFromSummary(details, 'caisse_z_report');
          const out = Router.renderDoc('caisse_z_report', docData, forPrint ? 'print' : 'preview', {
            paperSize: '80mm',
            zoomPct: forPrint ? 100 : 95
          });
          return forPrint ? out.fullHtml : out.paperHtml;
        };
      }

      // 4. ربط نافذة المعاينة الموحدة في index.html (#posPrintCenterModal) بجميع الـ 34 مستنداً والمحرك النقي
      const pcSelect = document.getElementById('pcDocTypeSelect');
      if (pcSelect && !pcSelect._pspPopulated34) {
        pcSelect._pspPopulated34 = true;
        const docs = PSP.state.getTemplatesRegistry();
        const cats = (PSP.categories || []).filter((c) => c.id !== 'ALL');
        pcSelect.innerHTML = cats.map((c) => {
          const opts = docs.filter((d) => d.cat === c.id)
            .map((d) => `<option value="${esc(d.id)}">#${d.num} — ${esc(d.name)}</option>`)
            .join('');
          return `<optgroup label="${esc(c.label)}">${opts}</optgroup>`;
        }).join('');
      }

      if (window.App && !window.App._pspPrintCenterBridged) {
        window.App._pspPrintCenterBridged = true;

        const origOpenPc = typeof window.App.openPrintCenterModal === 'function'
          ? window.App.openPrintCenterModal.bind(window.App)
          : null;

        window.App.openPrintCenterModal = async function (docType, entityId, rawData) {
          Router._pcModalCtx = {
            docType: resolveCanonicalDocType(docType || 'invoice_a4'),
            entityId: entityId || null,
            rawData: rawData || null
          };
          const sel = document.getElementById('pcDocTypeSelect');
          if (sel) sel.value = Router._pcModalCtx.docType;

          if (origOpenPc) {
            try { window.App.openModal('posPrintCenterModal'); } catch (_) {}
          } else {
            document.getElementById('posPrintCenterModal')?.classList.add('active');
          }
          await window.App.refreshPrintCenterPreview();
        };

        window.App.refreshPrintCenterPreview = async function () {
          const frame = document.getElementById('printCenterPreviewFrame');
          if (!frame) return;
          const docType = resolveCanonicalDocType(document.getElementById('pcDocTypeSelect')?.value || Router._pcModalCtx?.docType || 'invoice_a4');
          const lang = document.getElementById('pcLangSelect')?.value || undefined;
          const themeSel = document.getElementById('pcTemplateSelect')?.value || 'default';
          const themeId = themeSel && themeSel !== 'default' ? themeSel : undefined;

          const ctx = Router._pcModalCtx || {};
          const docData = await fetchDocDataByEntityId(docType, ctx.entityId, ctx.rawData);
          const out = Router.renderDoc(docType, docData, 'print', { lang, themeId });
          Router._pcLastRendered = out;
          frame.srcdoc = out.fullHtml;
        };

        window.App.executePrintCenterAction = async function (action) {
          if (!Router._pcLastRendered) {
            await window.App.refreshPrintCenterPreview();
          }
          const out = Router._pcLastRendered;
          if (!out) return;
          await Router.executePrintHtml({
            html: out.fullHtml,
            paperSize: out.paperSize,
            asPdf: action === 'pdf',
            docId: out.docType,
            docType: out.docType,
            docNumber: out.docData?.docNumber,
            copies: out.template?.copies || 1,
            printerName: out.template?.printerName || ''
          });
        };
      }
    }

    PSP.router = Router;
    PSP.modules.router = true;
    PSP.stage = 5;

    installCrossPageBridges();
    let bridgeTries = 0;
    const bridgeTimer = setInterval(() => {
      bridgeTries++;
      installCrossPageBridges();
      if (
        bridgeTries >= 35 ||
        (window.GherbiPrintStudioV45?._pspStage5Bridged &&
          window.GherbiDebtV68?._pspStage5Bridged &&
          window.GherbiCaisseTurbo?._pspStage5Bridged &&
          window.App?._pspPrintCenterBridged)
      ) {
        clearInterval(bridgeTimer);
      }
    }, 150);

    console.log('🏆 [Print Studio Pro — Stage 5/Router]: اكتمل الربط الشامل لجميع الصفحات الـ 18 والـ 34 مستنداً بنجاح 100%!');
  })();
})();

/* [WAR_STAGE123_ROUTER_HARDENING] */
(function installWarStage123RouterHardening() {
  'use strict';

  const PDF_API_METHODS = ['pspExportPdf', 'exportPdf', 'exportHtmlToPdf', 'printToPdf', 'saveHtmlToPdf'];
  const PRINT_API_METHODS = ['pspPrint80mm', 'printHtml', 'printSilent', 'printDocument', 'printReceipt'];

  function applyHardening() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.router || PSP.router._war123Hardened) return false;
    PSP.router._war123Hardened = true;

    const router = PSP.router;

    // 1. دالة مزامنة حية ومباشرة من SQLite (تتجاوز أي Cache قديم) قبل رسم أي تذكرة لزبون وفي
    router.hydrateFreshCustomerOntoDoc = async function (docType, rawDocData) {
      const data = rawDocData && typeof rawDocData === 'object' ? { ...rawDocData } : {};
      if (data._previewMode) return data;

      const cid = Number(data.customerId || data.customer_id || 0);
      if (cid <= 0) return data;

      const rawApi = window.api; // القراءة المباشرة من SQLite بدون أي كاش
      if (!rawApi) return data;

      let freshCust = null;
      let creditSum = null;

      try {
        const tasks = [];
        if (typeof rawApi.getCustomerCreditSummary === 'function') {
          tasks.push(rawApi.getCustomerCreditSummary(cid).then((r) => { creditSum = r; }).catch(() => {}));
        }
        if (typeof rawApi.getCustomers === 'function') {
          tasks.push(rawApi.getCustomers({}).then((rows) => {
            if (Array.isArray(rows)) {
              freshCust = rows.find((c) => Number(c.id) === cid) || null;
              if (window.AppState) window.AppState.customers = rows;
              if (window.GherbiDebtV68 && window.GherbiDebtV68.customersById) {
                window.GherbiDebtV68.customers = rows;
                window.GherbiDebtV68.customersById.clear();
                rows.forEach((c) => window.GherbiDebtV68.customersById.set(Number(c.id), c));
              }
            }
          }).catch(() => {}));
        }
        await Promise.all(tasks);
      } catch (_) {}

      if (!freshCust && !creditSum) return data;

      const dbDebt = Math.max(
        0,
        Number(
          creditSum && creditSum.current_debt !== undefined
            ? creditSum.current_debt
            : (freshCust && freshCust.total_debt) || 0
        )
      );
      const fid = (freshCust && freshCust.loyalty_card_code) || ('FID-' + String(cid).padStart(5, '0'));
      const cleanName = String((freshCust && freshCust.name) || (creditSum && creditSum.name) || '')
        .replace(/\(\s*زبون\s+وفي\s*\)/g, '')
        .trim();

      data.customerId = cid;
      data.isWalkinCustomer = false;
      if (cleanName) data.partyName = cleanName + ' (' + fid + ')';
      if (freshCust) {
        data.partyPhone = freshCust.phone || data.partyPhone || '';
        data.partyAddress = freshCust.address || data.partyAddress || '';
        data.partyRc = freshCust.rc || data.partyRc || '';
        data.partyNif = freshCust.nif || data.partyNif || '';
        data.loyaltyTotalBalance = Math.max(0, Math.floor(Number(freshCust.loyalty_points || 0)));
      }

      const isSettlement =
        docType === 'payment_receipt' ||
        docType === 'supplier_payment_receipt' ||
        data._docKind === 'settlement';

      if (isSettlement) {
        const paidNow = Math.max(0, Number(data.paidAmount ?? data.paid_amount ?? data.amount ?? data.total ?? 0));
        data._docKind = 'settlement';
        data.paidAmount = paidNow;
        data.customerCurrentTotalDebt = Number(dbDebt.toFixed(2));
        data.remainingDebt = data.customerCurrentTotalDebt;
        data.previousBalance = Number((dbDebt + paidNow).toFixed(2));
      } else {
        const total = Math.max(0, Number(data.total ?? 0));
        const paid = Math.max(0, Number(data.paidAmount ?? data.paid_amount ?? total));
        const addedToday = Math.max(0, Number((total - paid).toFixed(2)));
        data._freshDbDebtVerified = true;
        data._freshDbDebt = Number(dbDebt.toFixed(2));
        if (addedToday > 0.009) {
          if (dbDebt >= addedToday - 0.01) {
            data.customerCurrentTotalDebt = Number(dbDebt.toFixed(2));
            data.previousBalance = Math.max(0, Number((dbDebt - addedToday).toFixed(2)));
          } else {
            const p = Math.max(0, Number(data.previousBalance || 0));
            data.customerCurrentTotalDebt = Number((p + addedToday).toFixed(2));
          }
        } else {
          data.customerCurrentTotalDebt = Number(dbDebt.toFixed(2));
          data.previousBalance = Number(dbDebt.toFixed(2));
        }
      }

      return data;
    };

    // 2. ترقية executePrintHtml لاستدعاء دوال window.api الحقيقية (بما فيها exportPdf) أولاً لمنع العودة لـ A4
    router.executePrintHtml = async function war123ExecutePrintHtml(opts = {}) {
      const html = String(opts.html || '');
      if (!html) return { ok: false };
      const paperSize = opts.paperSize || '80mm';
      const asPdf = Boolean(opts.asPdf);
      const docId = opts.docId || 'document';
      const docType = opts.docType || docId;
      const copies = Math.max(1, Number(opts.copies || 1));
      const printerName = opts.printerName || '';

      let res = null;
      const apiObj = window.api || {};

      try {
        if (asPdf) {
          const pdfMethod = PDF_API_METHODS.find((m) => typeof apiObj[m] === 'function');
          if (pdfMethod) {
            res = await apiObj[pdfMethod]({
              html,
              filename: docId + '_' + paperSize + '.pdf',
              paperSize
            });
          }
        } else {
          const silentPref = String(window.AppState?.settings?.silent_print || 'false') === 'true';
          const silent = opts.silent !== undefined ? Boolean(opts.silent) : silentPref;
          const printMethod = PRINT_API_METHODS.find((m) => typeof apiObj[m] === 'function');
          if (printMethod) {
            res = await apiObj[printMethod]({
              html,
              paperSize,
              silent,
              copies,
              printerName
            });
          } else if (typeof window.__gherbiMasterPrintSilent === 'function' && !window.__gherbiMasterPrintSilent._isWar123Proxy) {
            res = await window.__gherbiMasterPrintSilent({ html, paperSize, silent, copies, printerName });
          }
        }
      } catch (e) {
        console.warn('[PSP War123 Print Dispatch Warning]:', e && e.message);
      }

      if (!res) {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:-9999px;bottom:-9999px;width:0;height:0;border:0;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (_) {}
          setTimeout(() => iframe.remove(), 1500);
        }, 220);
      }

      if (typeof router.logPrintQuietly === 'function') {
        router.logPrintQuietly(docType, opts.entityId, opts.docNumber, copies, printerName);
      }
      return { ok: true, result: res };
    };

    // 3. ترقية printDocumentByType لتمر بالمزامنة الحية من SQLite دائماً
    const origPrintByType = router.printDocumentByType.bind(router);
    router.printDocumentByType = async function (rawDocType, entityIdOrData, opts = {}) {
      const baseType = router.resolveCanonicalDocType(rawDocType);
      const isObj = entityIdOrData && typeof entityIdOrData === 'object';
      const mapped = isObj
        ? router.mapRawRecordToDocData(baseType, entityIdOrData)
        : await router.fetchDocDataByEntityId(baseType, entityIdOrData);
      const freshData = await router.hydrateFreshCustomerOntoDoc(baseType, mapped);
      return await origPrintByType(baseType, freshData, opts);
    };

    // 4. ترقية جسر GherbiPrintStudioV45.renderAdoptedMasterDocumentHtml (المستدعى من Alt+D و Alt+V في gherbi-core-devices-hub.js!)
    const bindLegacyV45Bridge = () => {
      const legacy = window.GherbiPrintStudioV45;
      if (!legacy || legacy._war123FreshSynced) return;
      legacy._war123FreshSynced = true;

      legacy.renderAdoptedMasterDocumentHtml = async (rawDocType, rawDocData, extraOpts = {}) => {
        const baseType = router.resolveCanonicalDocType(rawDocType);
        const mapped = router.mapRawRecordToDocData(baseType, rawDocData || {});
        const freshData = await router.hydrateFreshCustomerOntoDoc(baseType, mapped);
        const out = router.renderDoc(baseType, freshData, 'print', extraOpts);
        return out.fullHtml;
      };
    };
    bindLegacyV45Bridge();

    // 5. اعتراض window.__gherbiMasterPrintSilent لضمان مرور التذاكر الحرارية 80mm/58mm عبر محرك main.js الدقيق
    const bindMasterPrintProxy = () => {
      const origMaster = window.__gherbiMasterPrintSilent;
      if (typeof origMaster !== 'function' || origMaster._isWar123Proxy) return;

      const wrapped = async function war123MasterPrintProxy(arg1, arg2) {
        const payload = typeof arg1 === 'string'
          ? { ...(typeof arg2 === 'object' && arg2 ? arg2 : {}), html: arg1 }
          : (arg1 && typeof arg1 === 'object' ? { ...arg1 } : {});

        const html = String(payload.html || '');
        if (html.includes('data-psp-rendered="1"')) {
          const paperMatch = html.match(/data-psp-paper=["']([^"']+)["']/i);
          const paperSize = payload.paperSize || (paperMatch && paperMatch[1]) || '80mm';
          const docMatch = html.match(/data-psp-doc=["']([^"']+)["']/i);
          const docId = (docMatch && docMatch[1]) || 'receipt_thermal';
          const res = await router.executePrintHtml({
            html,
            paperSize,
            asPdf: Boolean(payload.asPdf),
            silent: payload.silent,
            copies: payload.copies,
            printerName: payload.printerName,
            docId,
            docType: docId
          });
          return res && res.result ? res.result : res;
        }
        return await origMaster(arg1, arg2);
      };
      wrapped._isWar123Proxy = true;
      window.__gherbiMasterPrintSilent = wrapped;
    };
    bindMasterPrintProxy();

    let retries = 0;
    const t = setInterval(() => {
      retries++;
      bindLegacyV45Bridge();
      bindMasterPrintProxy();
      if (retries >= 30) clearInterval(t);
    }, 150);

    return true;
  }

  if (!applyHardening()) {
    let n = 0;
    const poll = setInterval(() => {
      n++;
      if (applyHardening() || n >= 40) clearInterval(poll);
    }, 100);
  }
})();

/* === [PSP STAGE2 IMMUTABLE __gherbiMasterPrintSilent LOCK] === */
(function installImmutableMasterPrintLock() {
  'use strict';

  function extractPaperFromHtml(html) {
    const src = String(html || '');
    const m = src.match(/data-psp-paper=["']([^"']+)["']/i);
    if (m && m[1]) return m[1].trim().toLowerCase();
    if (/size-58mm|paper-58mm/i.test(src)) return '58mm';
    if (/size-80mm|paper-80mm/i.test(src)) return '80mm';
    if (/size-2xa5|paper-2xa5/i.test(src)) return '2xa5';
    if (/size-a5|paper-a5/i.test(src)) return 'a5';
    return '';
  }

  function showMediaBoxToast(res, paperSize) {
    try {
      if (!res || res.canceled) return;
      const mb = res.actualMediaBoxMm || (res.result && res.result.actualMediaBoxMm) || '';
      if (mb && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🖨️ تم التجهيز بمقاس (' + paperSize.toUpperCase() + ' — فعلياً ' + mb + ')', 'success');
      }
    } catch (_) {}
  }

  async function canonicalMasterPrintSilent(arg1, arg2) {
    const payload = typeof arg1 === 'string'
      ? { ...(typeof arg2 === 'object' && arg2 ? arg2 : {}), html: arg1 }
      : (arg1 && typeof arg1 === 'object' ? { ...arg1 } : {});

    let html = String(payload.html || '');
    if (!html) return { ok: false, success: false, error: 'empty_html' };

    /* [PSP_CANONICAL_UPGRADE_LEGACY_HTML] */
    if (!html.includes('data-psp-rendered="1"') && window.GherbiPrintGlobalUnifier && typeof window.GherbiPrintGlobalUnifier.upgradeLegacyHtmlToAdoptedPsp === 'function') {
      try {
        const up = await window.GherbiPrintGlobalUnifier.upgradeLegacyHtmlToAdoptedPsp(payload.asPdf ? 'export-pdf' : 'print-silent', payload);
        if (up && up.html) {
          html = up.html;
          payload.html = up.html;
          payload.paperSize = up.paperSize || payload.paperSize;
          if (up.filename) payload.filename = up.filename;
        }
      } catch (_) {}
    }

    // الأولوية #1: المقاس الحقيقي المكتوب داخل الـ HTML (يمنع أي a4 مزيفة من غلاف قديم!)
    const htmlPaper = extractPaperFromHtml(html);
    const paperSize = htmlPaper || String(payload.paperSize || payload.paper || '80mm').toLowerCase();
    const docMatch = html.match(/data-psp-doc=["']([^"']+)["']/i);
    const docId = (docMatch && docMatch[1]) || payload.docId || 'ticket';
    const asPdf = Boolean(payload.asPdf);
    const copies = Math.max(1, Number(payload.copies || 1));
    const printerName = payload.printerName || payload.deviceName || '';
    const silentPref = String(window.AppState?.settings?.silent_print || 'false') === 'true';
    const silent = payload.silent !== undefined ? Boolean(payload.silent) : silentPref;

    const apiObj = window.api || {};
    let res = null;

    try {
      if (asPdf && typeof apiObj.pspExportPdf === 'function') {
        res = await apiObj.pspExportPdf({ html, filename: docId + '_' + paperSize + '.pdf', paperSize });
      } else if (!asPdf && typeof apiObj.pspPrint80mm === 'function') {
        res = await apiObj.pspPrint80mm({ html, paperSize, silent, copies, printerName, filename: docId + '_' + paperSize + '.pdf' });
      } else if (window.GherbiPrintStudioPro && window.GherbiPrintStudioPro.router) {
        res = await window.GherbiPrintStudioPro.router.executePrintHtml({
          html, paperSize, asPdf, silent, copies, printerName, docId, docType: docId
        });
      }
    } catch (e) {
      console.warn('[PSP Canonical Master Print Error]:', e && e.message);
    }

    if (res) {
      showMediaBoxToast(res, paperSize);
      return res;
    }

    // ملاذ أخير فقط خارج Electron
    if (window.GherbiPrintStudioPro && window.GherbiPrintStudioPro.router) {
      return await window.GherbiPrintStudioPro.router.executePrintHtml({
        html, paperSize, asPdf, silent, copies, printerName, docId, docType: docId
      });
    }
    return { ok: false };
  }
  canonicalMasterPrintSilent._isPspCanonicalLock = true;

  // قفل الخاصية على window لمنع gherbi-core-devices-hub.js (السطور 4809 و 11726) من استبدالها نهائياً!
  try {
    const desc = Object.getOwnPropertyDescriptor(window, '__gherbiMasterPrintSilent');
    if (!desc || desc.configurable) {
      Object.defineProperty(window, '__gherbiMasterPrintSilent', {
        get() { return canonicalMasterPrintSilent; },
        set() { /* محمي ومغلق لصالح محرك Print Studio Pro 80mm */ },
        configurable: true
      });
    } else {
      window.__gherbiMasterPrintSilent = canonicalMasterPrintSilent;
    }
  } catch (_) {
    try { window.__gherbiMasterPrintSilent = canonicalMasterPrintSilent; } catch (__) {}
  }

  // إجبار studio-router.js.executePrintHtml أيضاً على احترام data-psp-paper أولاً
  const patchRouter = () => {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.router || PSP.router._stage2PaperLock) return false;
    PSP.router._stage2PaperLock = true;
    const origExec = PSP.router.executePrintHtml.bind(PSP.router);
    PSP.router.executePrintHtml = async function (opts = {}) {
      const htmlPaper = extractPaperFromHtml(opts.html);
      const effectivePaper = htmlPaper || opts.paperSize || '80mm';
      const res = await origExec({ ...opts, paperSize: effectivePaper });
      showMediaBoxToast(res && res.result ? res.result : res, effectivePaper);
      return res;
    };
    return true;
  };

  if (!patchRouter()) {
    let k = 0;
    const t = setInterval(() => {
      k++;
      if (patchRouter() || k >= 30) clearInterval(t);
    }, 100);
  }
})();
