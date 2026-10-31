/**
 * print-engine.js
 * محرك الطباعة وتوليد المستندات الشامل لنظام Gherbi.Ai POS (11 نوع مستند + 53 قالب HTML + شهادة الضمان)
 * يغطي:
 * 1. الفواتير الرسمية (renderInvoiceHtml: قوالب 1..9, A5, Detailed, Thermal 80mm)
 * 2. الوصولات الحرارية (renderReceiptHtml: قوالب 1..5 بجميع اللغات مع باركود الفاتورة)
 * 3. إشعار الدائن (renderCreditNoteHtml: Facture d'Avoir بالعربية والفرنسية والإنجليزية)
 * 4. وصل التوصيل (renderDeliveryNoteHtml: Bon de Livraison A4/A5/Thermal بدون أسعار مع السائق والمركبة)
 * 5. وصل الاستلام المخزني (renderReceptionNoteHtml: Bon de Réception)
 * 6. الفاتورة الشكلية (renderProformaHtml: Facture Proforma مع تاريخ انتهاء الصلاحية)
 * 7. سند الطلبية (renderOrderReceiptHtml: Bon de Commande مع العربون والباقي)
 * 8. وصل تسديد الديون (renderPaymentReceiptHtml: Reçu de Paiement مع الدين السابق والمدفوع والباقي)
 * 9. الفاتورة المجمعة للفترة (renderRecapInvoiceHtml: Facture Récapitulative)
 * 10. تقرير ملخص المبيعات وقائمة الأسعار (renderSalesSummaryHtml & renderPriceListHtml)
 * 11. ملصقات الباركود وأسعار الرفوف وشهادة الضمان (renderBarcodeLabelHtml & renderWarrantyCertificateHtml)
 */

'use strict';

if (typeof window === 'undefined') {
  module.exports = {};
} else {
  const PrintEngine = (function () {
    const templateCache = new Map();

    const TEMPLATE_FILES = {
      template1: 'invoice_template_1.html',
      template2: 'invoice_template_2.html',
      template3: 'invoice_template_3.html',
      template4: 'invoice_template_4.html',
      template5: 'invoice_template_5.html',
      template6: 'invoice_template_6.html',
      template7: 'invoice_template_7.html',
      template8: 'invoice_template_8.html',
      template9: 'invoice_template_9.html',
      a5: 'invoice_template_a5.html',
      detailed: 'invoice_template_detailed.html',
      thermal80: 'invoice_thermal_80.html',
      receipt1_ar: 'receipt_template_1.html',
      receipt1_fr: 'receipt_template_1_fr.html',
      receipt1_en: 'receipt_template_1_en.html',
      receipt2_ar: 'receipt_template_2.html',
      receipt2_fr: 'receipt_template_2_fr.html',
      receipt2_en: 'receipt_template_2_en.html',
      receipt3_ar: 'receipt_template_3.html',
      receipt3_fr: 'receipt_template_3_fr.html',
      receipt3_en: 'receipt_template_3_en.html',
      receipt4_ar: 'receipt_template_4.html',
      receipt4_fr: 'receipt_template_4_fr.html',
      receipt4_en: 'receipt_template_4_en.html',
      receipt5_ar: 'receipt_template_5.html',
      receipt5_fr: 'receipt_template_5_fr.html',
      receipt5_en: 'receipt_template_5_en.html',
      credit_note_ar: 'credit_note_ar.html',
      credit_note_fr: 'credit_note_fr.html',
      credit_note_en: 'credit_note_en.html',
      delivery_ar: 'delivery_note_ar.html',
      delivery_fr: 'delivery_note_fr.html',
      delivery_en: 'delivery_note_en.html',
      delivery_a5: 'delivery_note_a5.html',
      delivery_thermal: 'delivery_note_thermal.html',
      order_ar: 'order_receipt_ar.html',
      order_fr: 'order_receipt_fr.html',
      proforma_ar: 'proforma_invoice_ar.html',
      proforma_fr: 'proforma_invoice_fr.html',
      payment_ar: 'payment_receipt_ar.html',
      payment_fr: 'payment_receipt_fr.html',
      recap_ar: 'recap_invoice_ar.html',
      recap_fr: 'recap_invoice_fr.html',
      recap_en: 'recap_invoice_en.html',
      reception_ar: 'reception_note_ar.html',
      reception_fr: 'reception_note_fr.html',
      reception_en: 'reception_note_en.html',
      sales_summary_ar: 'sales_summary_ar.html',
      sales_summary_fr: 'sales_summary_fr.html',
      sales_summary_en: 'sales_summary_en.html',
      price_list: 'price_list.html',
      barcode_label: 'barcode_label_template_1.html'
    };

    function formatMoney(value, decimals = 2) {
      const num = Number(value || 0);
      if (!Number.isFinite(num)) return '0.00';
      return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function escapeHtml(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function toWords(amount, lang = 'ar') {
      if (window.NumberToWords && typeof window.NumberToWords.toWords === 'function') {
        return window.NumberToWords.toWords(Number(amount || 0), lang);
      }
      return `${formatMoney(amount)} DZD`;
    }

    async function loadTemplateHtml(fileNameOrKey) {
      const fileName = TEMPLATE_FILES[fileNameOrKey] || fileNameOrKey;
      if (templateCache.has(fileName)) {
        return templateCache.get(fileName);
      }
      try {
        const res = await fetch(`./${fileName}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        templateCache.set(fileName, text);
        return text;
      } catch (err) {
        console.warn(`[PrintEngine] Could not load template ${fileName}:`, err.message);
        return '';
      }
    }

    function compileTemplate(rawHtml, data = {}) {
      if (!rawHtml) return '';
      let out = String(rawHtml);

      out = out.replace(/\{\{#if\s+([A-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, inner) => {
        const val = data[key];
        const isTruthy =
          val !== undefined &&
          val !== null &&
          val !== false &&
          val !== '' &&
          val !== '0' &&
          val !== '0.00';
        return isTruthy ? inner : '';
      });

      out = out.replace(
        /\{\{#unless\s+([A-Z0-9_]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
        (_match, key, inner) => {
          const val = data[key];
          const isTruthy =
            val !== undefined &&
            val !== null &&
            val !== false &&
            val !== '' &&
            val !== '0' &&
            val !== '0.00';
          return !isTruthy ? inner : '';
        }
      );

      out = out.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_match, key) => {
        const val = data[key];
        return val !== undefined && val !== null ? String(val) : '';
      });

      return out;
    }

    function buildCompanyVars(settings = {}) {
      return {
        COMPANY_NAME: settings.shop_name || 'Gherbi.Ai POS',
        COMPANY_DESCRIPTION: settings.shop_description || '',
        COMPANY_ADDRESS: settings.shop_address || '',
        COMPANY_PHONE: settings.shop_phone || '',
        COMPANY_FAX: settings.shop_fax || '',
        COMPANY_EMAIL: settings.shop_email || '',
        COMPANY_RC: settings.shop_rc || '-',
        COMPANY_NIF: settings.shop_nif || '-',
        COMPANY_AI: settings.shop_ai || '-',
        COMPANY_NIS: settings.shop_nis || '-',
        COMPANY_LOGO: settings.shop_logo || ''
      };
    }

    function getInvoiceLabels(lang = 'ar', isPurchase = false, taxPercent = 0) {
      const dicts = {
        ar: {
          LBL_INVOICE_TITLE: 'فاتورة',
          INVOICE_TYPE_LABEL: isPurchase ? 'فاتورة شراء' : 'فاتورة بيع',
          CLIENT_ROLE_LABEL: isPurchase ? 'المورد' : 'الزبون',
          LBL_N_INDEX: 'الرقم',
          LBL_REF: 'المرجع',
          LBL_DESIGNATION: 'البيان',
          LBL_QTY: 'الكمية',
          LBL_UNIT: 'الوحدة',
          LBL_UNIT_PRICE: 'سعر الوحدة',
          LBL_TVA: 'TVA',
          LBL_TOTAL_HT: 'المجموع',
          LBL_SUBTOTAL: 'المجموع الفرعي :',
          LBL_DISCOUNT: 'التخفيض :',
          LBL_TAX_TOTAL: `الضريبة (${taxPercent}%) :`,
          LBL_STAMP: 'حق الطابع :',
          LBL_NET_PAY: 'الصافي للدفع :',
          LBL_OLD_BALANCE: 'الدين السابق :',
          LBL_CURRENT_DEBT: 'إجمالي الدين :',
          LBL_REMAINING_PAY: 'الباقي من الفاتورة :',
          LBL_TOTAL_DEBT: 'إجمالي الدين الحالي :',
          LBL_MODE_PAIEMENT: 'طريقة الدفع :',
          LBL_SETTLEMENT_MODE: 'طريقة التسديد',
          LBL_INVOICE_NO: 'رقم الفاتورة',
          LBL_YOUR_ORDER: 'طلبيتكم',
          LBL_DELIVERY: 'التسليم',
          LBL_PAGE: 'الصفحة',
          LBL_SIGNATURE: 'الإمضاء والختم',
          LBL_DATE: 'التاريخ :',
          LBL_TEL: 'الهاتف',
          LBL_FAX: 'الفاكس',
          LBL_EMAIL: 'البريد',
          LBL_ADDRESS: 'العنوان :',
          LBL_TOTAL_IN_WORDS_PREFIX: 'أوقفت هذه الفاتورة على مبلغ :'
        },
        fr: {
          LBL_INVOICE_TITLE: 'FACTURE',
          INVOICE_TYPE_LABEL: isPurchase ? "FACTURE D'ACHAT" : 'FACTURE',
          CLIENT_ROLE_LABEL: isPurchase ? 'Fournisseur' : 'Client',
          LBL_N_INDEX: 'N°',
          LBL_REF: 'Réf',
          LBL_DESIGNATION: 'Désignation',
          LBL_QTY: 'Qté',
          LBL_UNIT: 'Unité',
          LBL_UNIT_PRICE: 'P.U. HT',
          LBL_TVA: 'TVA',
          LBL_TOTAL_HT: 'Montant HT',
          LBL_SUBTOTAL: 'Total HT :',
          LBL_DISCOUNT: 'Remise :',
          LBL_TAX_TOTAL: `TVA (${taxPercent}%) :`,
          LBL_STAMP: 'Timbre :',
          LBL_NET_PAY: 'Net à Payer TTC :',
          LBL_OLD_BALANCE: 'Ancien Solde :',
          LBL_CURRENT_DEBT: 'Solde Actuel :',
          LBL_REMAINING_PAY: 'Reste sur Facture :',
          LBL_TOTAL_DEBT: 'Nouveau Solde :',
          LBL_MODE_PAIEMENT: 'Mode de Règlement :',
          LBL_SETTLEMENT_MODE: 'Mode Règlement',
          LBL_INVOICE_NO: 'N° Facture',
          LBL_YOUR_ORDER: 'Votre Commande',
          LBL_DELIVERY: 'Livraison',
          LBL_PAGE: 'Page',
          LBL_SIGNATURE: 'Cachet et Signature',
          LBL_DATE: 'Date :',
          LBL_TEL: 'Tél',
          LBL_FAX: 'Fax',
          LBL_EMAIL: 'Email',
          LBL_ADDRESS: 'Adresse :',
          LBL_TOTAL_IN_WORDS_PREFIX: 'Arrêtée la présente facture à la somme de :'
        },
        en: {
          LBL_INVOICE_TITLE: 'INVOICE',
          INVOICE_TYPE_LABEL: isPurchase ? 'PURCHASE INVOICE' : 'SALES INVOICE',
          CLIENT_ROLE_LABEL: isPurchase ? 'Supplier' : 'Customer',
          LBL_N_INDEX: '#',
          LBL_REF: 'Ref',
          LBL_DESIGNATION: 'Description',
          LBL_QTY: 'Qty',
          LBL_UNIT: 'Unit',
          LBL_UNIT_PRICE: 'Unit Price',
          LBL_TVA: 'VAT',
          LBL_TOTAL_HT: 'Total',
          LBL_SUBTOTAL: 'Subtotal :',
          LBL_DISCOUNT: 'Discount :',
          LBL_TAX_TOTAL: `VAT (${taxPercent}%) :`,
          LBL_STAMP: 'Stamp Duty :',
          LBL_NET_PAY: 'Net to Pay :',
          LBL_OLD_BALANCE: 'Previous Balance :',
          LBL_CURRENT_DEBT: 'Current Debt :',
          LBL_REMAINING_PAY: 'Remaining Due :',
          LBL_TOTAL_DEBT: 'Total Balance Due :',
          LBL_MODE_PAIEMENT: 'Payment Method :',
          LBL_SETTLEMENT_MODE: 'Payment Mode',
          LBL_INVOICE_NO: 'Invoice No.',
          LBL_YOUR_ORDER: 'Your Order',
          LBL_DELIVERY: 'Delivery',
          LBL_PAGE: 'Page',
          LBL_SIGNATURE: 'Stamp & Signature',
          LBL_DATE: 'Date :',
          LBL_TEL: 'Phone',
          LBL_FAX: 'Fax',
          LBL_EMAIL: 'Email',
          LBL_ADDRESS: 'Address :',
          LBL_TOTAL_IN_WORDS_PREFIX: 'Invoice total in words :'
        }
      };
      return dicts[lang] || dicts.ar;
    }

    /**
     * 1. توليد فاتورة بيع أو شراء (A4 1..9 / A5 / Detailed / Thermal 80mm)
     */
    async function renderInvoiceHtml(invoiceData = {}, settings = {}, options = {}) {
      const lang = options.lang || settings.receipt_lang || settings.app_lang || 'ar';
      const templateKey = options.template || settings.invoice_template || 'template1';
      const fileName = TEMPLATE_FILES[templateKey] || 'invoice_template_1.html';
      const rawTpl = await loadTemplateHtml(fileName);

      const items = Array.isArray(invoiceData.items) ? invoiceData.items : [];
      const taxPercent = Number(invoiceData.tax_percentage || 0);
      const subtotal = Number(invoiceData.subtotal ?? invoiceData.total ?? 0);
      const discount = Number(invoiceData.discount || 0);
      const stampAmount = Number(invoiceData.stamp_amount || 0);
      const taxTotal = Number(((subtotal - discount) * (taxPercent / 100)).toFixed(2));
      const netToPay = Number(invoiceData.total ?? (subtotal - discount + taxTotal + stampAmount));
      const paidAmount = Number(invoiceData.paid_amount ?? netToPay);
      const remainingDebt = Math.max(0, Number((netToPay - paidAmount).toFixed(2)));
      const oldBalance = Number(invoiceData.old_balance || 0);
      const totalDebt = Number((oldBalance + remainingDebt).toFixed(2));

      const isThermal = fileName.includes('thermal');
      const isTemplate9 = fileName.includes('template_9');
      const isTemplate3 = fileName.includes('template_3') && !rawTpl.includes('LBL_REF');

      let itemsRowsHtml = '';
      items.forEach((it, idx) => {
        const name = escapeHtml(it.product_name || it.custom_product_name || it.name || 'منتج');
        const serialBadge = it.serial_number ? ` <small style="font-family:monospace;">[S/N: ${escapeHtml(it.serial_number)}]</small>` : '';
        const ref = escapeHtml(it.product_barcode || it.barcode || it.id || idx + 1);
        const unit = escapeHtml(it.product_unit || it.unit || 'قطعة');
        const qty = Number(it.quantity || 1);
        const price = Number(it.price ?? it.cost_price ?? it.selling_price ?? 0);
        const lineTotal = Number(it.subtotal ?? it.total_cost ?? (qty * price));

        if (isThermal) {
          itemsRowsHtml += `
            <div class="t-item">
              <div class="t-name">${idx + 1}. ${name}${serialBadge}</div>
              <div class="t-line">
                <span class="muted2">${qty} × ${formatMoney(price)}</span>
                <span class="b">${formatMoney(lineTotal)}</span>
              </div>
            </div>`;
        } else if (isTemplate9) {
          itemsRowsHtml += `
            <tr>
              <td>${ref}</td>
              <td class="desig">${name}${serialBadge}</td>
              <td>${taxPercent > 0 ? taxPercent + '%' : '-'}</td>
              <td>${qty}</td>
              <td>${formatMoney(price)}</td>
              <td>${formatMoney(lineTotal)}</td>
            </tr>`;
        } else if (isTemplate3) {
          itemsRowsHtml += `
            <tr>
              <td>${idx + 1}</td>
              <td>${name}${serialBadge}</td>
              <td>${qty}</td>
              <td>${formatMoney(price)}</td>
              <td>${formatMoney(lineTotal)}</td>
            </tr>`;
        } else {
          itemsRowsHtml += `
            <tr>
              <td>${idx + 1}</td>
              <td>${ref}</td>
              <td class="text-left">${name}${serialBadge}</td>
              <td>${qty}</td>
              <td>${unit}</td>
              <td>${formatMoney(price)}</td>
              <td>${taxPercent > 0 ? taxPercent + '%' : '0%'}</td>
              <td>${formatMoney(lineTotal)}</td>
            </tr>`;
        }
      });

      const lbl = getInvoiceLabels(lang, Boolean(invoiceData.is_purchase), taxPercent);
      const dateStr = String(invoiceData.sale_date || invoiceData.date || new Date().toISOString()).slice(0, 10);

      const vars = {
        ...buildCompanyVars(settings),
        ...lbl,
        INVOICE_NUMBER: invoiceData.doc_number || invoiceData.invoice_number || invoiceData.id || '0001',
        DOC_NUMBER: invoiceData.doc_number || invoiceData.invoice_number || invoiceData.id || '0001',
        DATE: dateStr,
        PARTY_NAME: invoiceData.customer_name || invoiceData.supplier_name || invoiceData.party_name || 'زبون عابر',
        PARTY_PHONE: invoiceData.customer_phone || invoiceData.supplier_phone || '',
        PARTY_ADDRESS: invoiceData.customer_address || invoiceData.supplier_address || '',
        PARTY_RC: invoiceData.customer_rc || invoiceData.supplier_rc || '-',
        PARTY_NIF: invoiceData.customer_nif || invoiceData.supplier_nif || '-',
        PARTY_AI: invoiceData.customer_ai || invoiceData.supplier_ai || '-',
        PARTY_NIS: invoiceData.customer_nis || invoiceData.supplier_nis || '-',
        ITEMS_ROWS: itemsRowsHtml,
        SUBTOTAL: discount > 0 ? formatMoney(subtotal) : formatMoney(subtotal),
        DISCOUNT: discount > 0 ? formatMoney(discount) : '',
        TAX_TOTAL: taxTotal > 0 ? formatMoney(taxTotal) : '',
        STAMP_AMOUNT: stampAmount > 0 ? formatMoney(stampAmount) : '',
        NET_TO_PAY: formatMoney(netToPay),
        PAID_AMOUNT: formatMoney(paidAmount),
        OLD_BALANCE: oldBalance > 0 ? formatMoney(oldBalance) : '',
        CLIENT_OLD_DEBT: formatMoney(oldBalance),
        REMAINING_DEBT: remainingDebt > 0 ? formatMoney(remainingDebt) : '',
        TOTAL_DEBT: totalDebt > 0 ? formatMoney(totalDebt) : '',
        CLIENT_TOTAL_DEBT: formatMoney(totalDebt),
        PAYMENT_MODE: invoiceData.payment_method_label || invoiceData.payment_method || 'نقداً',
        TOTAL_IN_WORDS: toWords(netToPay, lang)
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * 2. توليد وصل البيع الحراري السريع (Thermal Receipt 1..5 مع باركود الفاتورة)
     */
    async function renderReceiptHtml(saleData = {}, settings = {}, options = {}) {
      const lang = options.lang || settings.receipt_lang || 'ar';
      const baseNum = String(options.template || settings.receipt_template || 'receipt1').replace(/\D/g, '') || '1';
      const suffix = lang === 'fr' ? '_fr' : lang === 'en' ? '_en' : '';
      const fileName = `receipt_template_${baseNum}${suffix}.html`;
      const rawTpl = await loadTemplateHtml(fileName);

      const items = Array.isArray(saleData.items) ? saleData.items : [];
      const subtotal = Number(saleData.subtotal ?? saleData.total ?? 0);
      const discount = Number(saleData.discount || 0);
      const total = Number(saleData.total ?? (subtotal - discount));
      const paid = Number(saleData.paid_amount ?? total);
      const rest = Math.max(0, Number((total - paid).toFixed(2)));
      const change = Math.max(0, Number((paid - total).toFixed(2)));
      const oldBalance = Number(saleData.old_balance || 0);

      let itemsRowsHtml = '';
      items.forEach((it) => {
        const name = escapeHtml(it.product_name || it.custom_product_name || it.name || 'منتج');
        const qty = Number(it.quantity || 1);
        const price = Number(it.price ?? it.selling_price ?? 0);
        const lineSub = Number(it.subtotal ?? (qty * price));
        itemsRowsHtml += `
          <tr>
            <td>${name}</td>
            <td>${qty}</td>
            <td>${formatMoney(price)}</td>
            <td>${formatMoney(lineSub)}</td>
          </tr>`;
      });

      const now = new Date(saleData.sale_date || Date.now());
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5);
      const receiptNum = String(saleData.doc_number || saleData.id || '0001');

      const vars = {
        ...buildCompanyVars(settings),
        RECEIPT_NUMBER: receiptNum,
        DATE: dateStr,
        TIME: timeStr,
        CLIENT_NAME: saleData.customer_name || 'زبون عابر',
        CLIENT_CODE: saleData.customer_id || '-',
        SELLER_NAME: saleData.seller_name || 'البائع',
        ITEMS_COUNT: items.length,
        ITEMS_ROWS: itemsRowsHtml,
        SUBTOTAL: formatMoney(subtotal),
        DISCOUNT: discount > 0 ? formatMoney(discount) : '',
        TOTAL: formatMoney(total),
        PAID: formatMoney(paid),
        RECEIPT_REST: rest > 0 ? formatMoney(rest) : '',
        REST: formatMoney(oldBalance + rest),
        OLD_BALANCE: formatMoney(oldBalance),
        CHANGE: change > 0 ? formatMoney(change) : '',
        PAYMENT_MODE: saleData.payment_method || 'نقداً',
        TOTAL_IN_WORDS: toWords(total, lang)
      };

      let compiled = compileTemplate(rawTpl, vars);

      // إضافة باركود الفاتورة أسفل التذكرة الحرارية إذا كان الخيار مفعلاً
      if (String(settings.show_receipt_barcode) !== 'false' && window.api && window.api.generateBarcodeImage) {
        try {
          const bcDataUrl = await window.api.generateBarcodeImage(receiptNum, {
            bcid: 'code128',
            height: 8,
            scale: 2
          });
          if (bcDataUrl) {
            compiled = compiled.replace(
              '</body>',
              `<div style="text-align:center;margin-top:8px;"><img src="${bcDataUrl}" style="max-width:62mm;height:11mm;object-fit:contain;"><div style="font-family:monospace;font-size:9px;">${receiptNum}</div></div></body>`
            );
          }
        } catch (_) {}
      }

      return compiled;
    }

    /**
     * 3. توليد إشعار الدائن الرسمي (Facture d'Avoir - credit_note_ar/fr/en.html)
     */
    async function renderCreditNoteHtml(saleData = {}, settings = {}, lang = 'ar') {
      const fileKey = `credit_note_${lang}`;
      const rawTpl = await loadTemplateHtml(TEMPLATE_FILES[fileKey] || 'credit_note_ar.html');
      const items = Array.isArray(saleData.items) ? saleData.items : [];
      const taxPercent = Number(saleData.tax_percentage || 0);
      const subtotalHt = Number(saleData.subtotal ?? saleData.total ?? 0);
      const discount = Number(saleData.discount || 0);
      const tvaAmount = Number(((subtotalHt - discount) * (taxPercent / 100)).toFixed(2));
      const totalTtc = Number((subtotalHt - discount + tvaAmount).toFixed(2));
      const stampAmount = Number(saleData.stamp_amount || 0);
      const netToPay = Number((totalTtc + stampAmount).toFixed(2));

      const rowsHtml = items
        .map((it, idx) => {
          const name = escapeHtml(it.product_name || it.custom_product_name || it.name || 'منتج');
          const ref = escapeHtml(it.product_barcode || it.barcode || idx + 1);
          const unit = escapeHtml(it.product_unit || it.unit || 'قطعة');
          const qty = Math.abs(Number(it.quantity || 1));
          const price = Number(it.price || 0);
          const sub = Number((qty * price).toFixed(2));
          return `<tr><td>${idx + 1}</td><td>${ref}</td><td>${name}</td><td>${unit}</td><td>${qty}</td><td>${formatMoney(price)}</td><td>${taxPercent}%</td><td>${formatMoney(sub)}</td></tr>`;
        })
        .join('');

      const lbl = getInvoiceLabels(lang, false, taxPercent);
      const vars = {
        ...buildCompanyVars(settings),
        ...lbl,
        CREDIT_NOTE_NUMBER: saleData.credit_note_number || `AV-${new Date().getFullYear()}-${saleData.id || '001'}`,
        INVOICE_NUMBER: saleData.credit_note_number || saleData.doc_number || saleData.id || '001',
        ORIGINAL_INVOICE_NUMBER: saleData.original_invoice_number || saleData.doc_number || `#${saleData.id}`,
        ORIGINAL_INVOICE_DATE: String(saleData.original_invoice_date || saleData.sale_date || new Date().toISOString()).slice(0, 10),
        RETURN_REASON: saleData.credit_note_reason || saleData.reason || 'إرجاع بضاعة / تصحيح فاتورة',
        DATE: String(saleData.credit_note_issued_at || new Date().toISOString()).slice(0, 10),
        PARTY_NAME: saleData.customer_name || 'زبون عابر',
        PARTY_ADDRESS: saleData.customer_address || '',
        PARTY_RC: saleData.customer_rc || '-',
        PARTY_NIF: saleData.customer_nif || '-',
        PARTY_AI: saleData.customer_ai || '-',
        PARTY_NIS: saleData.customer_nis || '-',
        ITEMS_ROWS: rowsHtml,
        SUBTOTAL_HT: formatMoney(subtotalHt),
        SUBTOTAL: formatMoney(subtotalHt),
        DISCOUNT: formatMoney(discount),
        TAX_PERCENT: taxPercent,
        TVA_AMOUNT: formatMoney(tvaAmount),
        TAX_TOTAL: formatMoney(tvaAmount),
        TOTAL_TTC: formatMoney(totalTtc),
        STAMP_AMOUNT: formatMoney(stampAmount),
        NET_TO_PAY: formatMoney(netToPay),
        TOTAL_IN_WORDS: toWords(netToPay, lang)
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * 4. توليد وصل التوصيل (Bon de Livraison - delivery_note_ar/fr/en/a5/thermal.html)
     */
    async function renderDeliveryNoteHtml(deliveryData = {}, settings = {}, modeOrLang = 'ar') {
      const keyMap = {
        ar: 'delivery_ar',
        fr: 'delivery_fr',
        en: 'delivery_en',
        a5: 'delivery_a5',
        thermal: 'delivery_thermal'
      };
      const fileName = TEMPLATE_FILES[keyMap[modeOrLang] || 'delivery_ar'];
      const rawTpl = await loadTemplateHtml(fileName);
      const isThermal = modeOrLang === 'thermal';
      const items = Array.isArray(deliveryData.items) ? deliveryData.items : [];

      let rowsHtml = '';
      items.forEach((it, idx) => {
        const name = escapeHtml(it.product_name || it.custom_product_name || it.name || 'منتج');
        const ref = escapeHtml(it.product_barcode || it.barcode || idx + 1);
        const unit = escapeHtml(it.product_unit || it.unit || 'قطعة');
        const qty = Number(it.quantity || 1);
        if (isThermal) {
          rowsHtml += `<div class="t-item"><div class="t-name">${idx + 1}. ${name}</div><div class="t-line"><span>الكمية:</span><span class="b">${qty} ${unit}</span></div></div>`;
        } else {
          rowsHtml += `<tr><td>${idx + 1}</td><td>${ref}</td><td>${name}</td><td>${unit}</td><td>${qty}</td><td>${escapeHtml(it.notes || '')}</td></tr>`;
        }
      });

      const lbl = getInvoiceLabels(modeOrLang === 'fr' ? 'fr' : modeOrLang === 'en' ? 'en' : 'ar');
      const vars = {
        ...buildCompanyVars(settings),
        ...lbl,
        LBL_DELIVERY_TITLE: modeOrLang === 'fr' ? 'BON DE LIVRAISON' : modeOrLang === 'en' ? 'DELIVERY NOTE' : 'وصل تسليم وتوصيل',
        LBL_ORDER_NUMBER: modeOrLang === 'fr' ? 'Commande N°:' : 'رقم الطلبية:',
        LBL_CLIENT: modeOrLang === 'fr' ? 'Client' : 'الزبون',
        LBL_CARRIER: modeOrLang === 'fr' ? 'Chauffeur / Livreur' : 'السائق / الناقل',
        LBL_VEHICLE: modeOrLang === 'fr' ? 'Matricule' : 'ترقيم المركبة',
        LBL_NOTES: modeOrLang === 'fr' ? 'Observations' : 'ملاحظات',
        LBL_SIGNATURE_SENDER: modeOrLang === 'fr' ? 'Signature Expéditeur' : 'إمضاء المسلّم',
        LBL_SIGNATURE_CLIENT: modeOrLang === 'fr' ? 'Signature Client' : 'إمضاء المستلم',
        DELIVERY_NUMBER: deliveryData.delivery_number || deliveryData.doc_number || `BL-${new Date().getFullYear()}-${deliveryData.id || '001'}`,
        DOC_NUMBER: deliveryData.delivery_number || deliveryData.doc_number || `BL-${new Date().getFullYear()}-${deliveryData.id || '001'}`,
        ORDER_NUMBER: deliveryData.order_number || deliveryData.doc_number || '-',
        DATE: String(deliveryData.sale_date || deliveryData.date || new Date().toISOString()).slice(0, 10),
        PARTY_NAME: deliveryData.customer_name || deliveryData.party_name || 'زبون',
        PARTY_PHONE: deliveryData.customer_phone || '',
        PARTY_ADDRESS: deliveryData.customer_address || '',
        PARTY_RC: deliveryData.customer_rc || '-',
        PARTY_NIF: deliveryData.customer_nif || '-',
        PARTY_AI: deliveryData.customer_ai || '-',
        PARTY_NIS: deliveryData.customer_nis || '-',
        CARRIER_NAME: deliveryData.carrier_name || deliveryData.driver_name || '-',
        DRIVER_NAME: deliveryData.driver_name || deliveryData.carrier_name || '-',
        VEHICLE_PLATE: deliveryData.vehicle_plate || '-',
        ITEMS_ROWS: rowsHtml
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * 5. توليد وصل الاستلام المخزني (Bon de Réception - reception_note_ar/fr/en.html)
     */
    async function renderReceptionNoteHtml(purchaseData = {}, settings = {}, lang = 'ar') {
      const fileName = TEMPLATE_FILES[`reception_${lang}`] || 'reception_note_ar.html';
      const rawTpl = await loadTemplateHtml(fileName);
      const items = Array.isArray(purchaseData.items) ? purchaseData.items : [];
      const rowsHtml = items
        .map((it, idx) => {
          const name = escapeHtml(it.product_name || it.name || 'منتج');
          const ref = escapeHtml(it.product_barcode || it.barcode || idx + 1);
          const unit = escapeHtml(it.product_unit || it.unit || 'قطعة');
          const qty = Number(it.quantity || 1);
          const cost = Number(it.cost_price || 0);
          const total = Number(it.total_cost || qty * cost);
          return `<tr><td>${idx + 1}</td><td>${ref}</td><td>${name}</td><td>${qty}</td><td>${unit}</td><td>${formatMoney(cost)}</td><td>0%</td><td>${formatMoney(total)}</td></tr>`;
        })
        .join('');

      const lbl = getInvoiceLabels(lang, true, 0);
      const vars = {
        ...buildCompanyVars(settings),
        ...lbl,
        RECEPTION_NUMBER: `BR-${new Date().getFullYear()}-${purchaseData.id || '001'}`,
        INVOICE_NUMBER: purchaseData.invoice_number || `#${purchaseData.id || '001'}`,
        DATE: String(purchaseData.date || new Date().toISOString()).slice(0, 10),
        PARTY_NAME: purchaseData.supplier_name || 'مورد',
        PARTY_ADDRESS: purchaseData.supplier_address || '',
        PARTY_RC: purchaseData.supplier_rc || '-',
        PARTY_NIF: purchaseData.supplier_nif || '-',
        PARTY_AI: purchaseData.supplier_ai || '-',
        PARTY_NIS: purchaseData.supplier_nis || '-',
        ITEMS_ROWS: rowsHtml,
        SUBTOTAL: formatMoney(purchaseData.subtotal || purchaseData.total || 0),
        NET_TO_PAY: formatMoney(purchaseData.total || 0),
        TOTAL_IN_WORDS: toWords(purchaseData.total || 0, lang)
      };
      return compileTemplate(rawTpl, vars);
    }

    /**
     * 6. توليد الفاتورة الشكلية (Facture Proforma - proforma_invoice_ar/fr.html)
     */
    async function renderProformaHtml(proformaData = {}, settings = {}, lang = 'ar') {
      const fileName = lang === 'fr' ? 'proforma_invoice_fr.html' : 'proforma_invoice_ar.html';
      const rawTpl = await loadTemplateHtml(fileName);
      const items = Array.isArray(proformaData.items) ? proformaData.items : [];
      const taxPercent = Number(proformaData.tax_percentage || 0);
      const subtotal = Number(proformaData.subtotal ?? proformaData.total ?? 0);
      const discount = Number(proformaData.discount || 0);
      const taxTotal = Number(((subtotal - discount) * (taxPercent / 100)).toFixed(2));
      const total = Number(proformaData.total ?? (subtotal - discount + taxTotal));
      const validityDays = Number(proformaData.validity_days || 15);
      const createdDate = new Date(proformaData.created_at || Date.now());
      const validUntilDate = new Date(createdDate.getTime() + validityDays * 86400000).toISOString().slice(0, 10);

      const rowsHtml = items
        .map((it, idx) => {
          const name = escapeHtml(it.product_name || it.custom_product_name || it.name || 'منتج');
          const ref = escapeHtml(it.barcode || idx + 1);
          const unit = escapeHtml(it.unit || 'قطعة');
          const qty = Number(it.quantity || 1);
          const price = Number(it.price || 0);
          const sub = Number(it.subtotal ?? (qty * price));
          return `<tr><td>${idx + 1}</td><td>${ref}</td><td>${name}</td><td>${qty}</td><td>${unit}</td><td>${formatMoney(price)}</td><td>${taxPercent}%</td><td>${formatMoney(sub)}</td></tr>`;
        })
        .join('');

      const lbl = getInvoiceLabels(lang, false, taxPercent);
      const vars = {
        ...buildCompanyVars(settings),
        ...lbl,
        DOC_NUMBER: proformaData.doc_number || `PRO-${proformaData.id || '001'}`,
        INVOICE_NUMBER: proformaData.doc_number || `PRO-${proformaData.id || '001'}`,
        DATE: createdDate.toISOString().slice(0, 10),
        VALIDITY_DAYS: validityDays,
        VALID_UNTIL: validUntilDate,
        HAS_TAX: taxTotal > 0 ? '1' : '',
        NOTES: proformaData.notes || '',
        PARTY_NAME: proformaData.customer_name || 'زبون',
        PARTY_ADDRESS: proformaData.customer_address || '',
        PARTY_RC: proformaData.customer_rc || '-',
        PARTY_NIF: proformaData.customer_nif || '-',
        PARTY_AI: proformaData.customer_ai || '-',
        PARTY_NIS: proformaData.customer_nis || '-',
        ITEMS_ROWS: rowsHtml,
        SUBTOTAL: formatMoney(subtotal),
        DISCOUNT: formatMoney(discount),
        TAX_TOTAL: formatMoney(taxTotal),
        TOTAL: formatMoney(total),
        NET_TO_PAY: formatMoney(total),
        TOTAL_IN_WORDS: toWords(total, lang)
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * 7. توليد سند الطلبية (Bon de Commande - order_receipt_ar/fr.html)
     */
    async function renderOrderReceiptHtml(orderData = {}, settings = {}, lang = 'ar') {
      const fileName = lang === 'fr' ? 'order_receipt_fr.html' : 'order_receipt_ar.html';
      const rawTpl = await loadTemplateHtml(fileName);
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const subtotal = Number(orderData.subtotal ?? orderData.total ?? 0);
      const discount = Number(orderData.discount || 0);
      const taxPercent = Number(orderData.tax_percentage || 0);
      const taxTotal = Number(((subtotal - discount) * (taxPercent / 100)).toFixed(2));
      const total = Number(orderData.total ?? (subtotal - discount + taxTotal));
      const deposit = Number(orderData.deposit_amount || 0);
      const remaining = Math.max(0, Number((total - deposit).toFixed(2)));

      const rowsHtml = items
        .map((it, idx) => {
          const name = escapeHtml(it.product_name || it.custom_product_name || it.name || 'منتج');
          const ref = escapeHtml(it.barcode || idx + 1);
          const unit = escapeHtml(it.unit || 'قطعة');
          const qty = Number(it.quantity || 1);
          const price = Number(it.price || 0);
          const sub = Number(it.subtotal ?? (qty * price));
          return `<tr><td>${idx + 1}</td><td>${ref}</td><td>${name}</td><td>${unit}</td><td>${qty}</td><td>${formatMoney(price)}</td><td>${formatMoney(sub)}</td><td>${orderData.status || 'قيد التجهيز'}</td></tr>`;
        })
        .join('');

      const lbl = getInvoiceLabels(lang, false, taxPercent);
      const vars = {
        ...buildCompanyVars(settings),
        ...lbl,
        DOC_NUMBER: orderData.doc_number || `BC-${orderData.id || '001'}`,
        INVOICE_NUMBER: orderData.doc_number || `BC-${orderData.id || '001'}`,
        DATE: String(orderData.created_at || new Date().toISOString()).slice(0, 10),
        EXPECTED_DELIVERY: orderData.expected_delivery_date || '',
        STATUS_LABEL: orderData.status === 'delivered' ? 'مسلّمة' : 'قيد التحضير',
        PARTY_NAME: orderData.customer_name || 'زبون',
        PARTY_PHONE: orderData.customer_phone || '',
        PARTY_ADDRESS: orderData.customer_address || '',
        PARTY_RC: orderData.customer_rc || '-',
        PARTY_NIF: orderData.customer_nif || '-',
        ITEMS_ROWS: rowsHtml,
        SUBTOTAL: formatMoney(subtotal),
        DISCOUNT: formatMoney(discount),
        HAS_TAX: taxTotal > 0 ? '1' : '',
        TAX_TOTAL: formatMoney(taxTotal),
        TOTAL: formatMoney(total),
        NET_TO_PAY: formatMoney(total),
        DEPOSIT: formatMoney(deposit),
        REMAINING: formatMoney(remaining),
        NOTES: orderData.notes || '',
        TOTAL_IN_WORDS: toWords(total, lang)
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * 8. توليد وصل تسديد الديون (Reçu de Paiement - payment_receipt_ar/fr.html)
     */
    async function renderPaymentReceiptHtml(paymentDetails = {}, settings = {}, lang = 'ar') {
      const fileName = lang === 'fr' ? 'payment_receipt_fr.html' : 'payment_receipt_ar.html';
      const rawTpl = await loadTemplateHtml(fileName);
      const amount = Number(paymentDetails.amount || 0);
      const debtBefore = Number(paymentDetails.debt_before ?? amount);
      const debtAfter = Number(paymentDetails.debt_after ?? Math.max(0, debtBefore - amount));
      const now = new Date(paymentDetails.date || Date.now());

      const vars = {
        ...buildCompanyVars(settings),
        RECEIPT_NUMBER: paymentDetails.receipt_number || `REC-${paymentDetails.id || '001'}`,
        DATE: now.toISOString().slice(0, 10),
        TIME: now.toTimeString().slice(0, 5),
        PARTY_NAME: paymentDetails.party_name || paymentDetails.client_name || 'الزبون / المورد',
        PARTY_PHONE: paymentDetails.party_phone || '',
        CLIENT_NAME: paymentDetails.party_name || paymentDetails.client_name || 'الزبون',
        CLIENT_PHONE: paymentDetails.party_phone || '',
        DEBT_BEFORE: `${formatMoney(debtBefore)} د.ج`,
        AMOUNT: `${formatMoney(amount)} د.ج`,
        PAID_AMOUNT: `${formatMoney(amount)} د.ج`,
        DEBT_AFTER: `${formatMoney(debtAfter)} د.ج`,
        PAYMENT_METHOD_LABEL: paymentDetails.payment_method || 'نقداً',
        PAYMENT_MODE: paymentDetails.payment_method || 'نقداً',
        REFERENCE: paymentDetails.reference || '-',
        RELATED_INVOICE: paymentDetails.sale_id || paymentDetails.invoice_id || 'حساب عام',
        SELLER_NAME: paymentDetails.seller_name || 'المدير',
        NOTES: paymentDetails.notes || '',
        AMOUNT_IN_WORDS: toWords(amount, lang),
        TOTAL_IN_WORDS: toWords(amount, lang)
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * 9. توليد الفاتورة المجمعة للزبون عن فترة (Facture Récapitulative - recap_invoice_ar/fr/en.html)
     */
    async function renderRecapInvoiceHtml(recapData = {}, settings = {}, lang = 'ar') {
      const fileName = TEMPLATE_FILES[`recap_${lang}`] || 'recap_invoice_ar.html';
      const rawTpl = await loadTemplateHtml(fileName);
      const items = Array.isArray(recapData.items) ? recapData.items : [];
      const sales = Array.isArray(recapData.sales) ? recapData.sales : [];

      const totalTtc = sales.reduce((s, r) => s + Number(r.total || 0), 0);
      const paidAmount = sales.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
      const remDebt = Math.max(0, Number((totalTtc - paidAmount).toFixed(2)));

      const rowsHtml = items
        .map((it, idx) => {
          const name = escapeHtml(it.product_name || 'منتج');
          const ref = escapeHtml(it.product_barcode || idx + 1);
          const unit = escapeHtml(it.unit || 'قطعة');
          const qty = Number(it.total_qty || 1);
          const avgPrice = Number(it.avg_price || 0);
          const sub = Number(it.total_subtotal || qty * avgPrice);
          return `<tr><td>${idx + 1}</td><td>${ref}</td><td>${name}</td><td>${qty}</td><td>${unit}</td><td>${formatMoney(avgPrice)}</td><td>0%</td><td>${formatMoney(sub)}</td></tr>`;
        })
        .join('');

      const lbl = getInvoiceLabels(lang, false, 0);
      const vars = {
        ...buildCompanyVars(settings),
        ...lbl,
        RECAP_NUMBER: recapData.recap_number || `FR-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`,
        INVOICE_NUMBER: recapData.recap_number || `FR-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`,
        DATE: new Date().toISOString().slice(0, 10),
        DATE_FROM: recapData.dateFrom || '-',
        DATE_TO: recapData.dateTo || '-',
        SALES_COUNT: sales.length,
        PARTY_NAME: recapData.customer?.name || 'زبون',
        PARTY_PHONE: recapData.customer?.phone || '',
        PARTY_ADDRESS: recapData.customer?.address || '',
        PARTY_RC: recapData.customer?.rc || '-',
        PARTY_NIF: recapData.customer?.nif || '-',
        PARTY_AI: recapData.customer?.ai || '-',
        PARTY_NIS: recapData.customer?.nis || '-',
        ITEMS_ROWS: rowsHtml,
        SUBTOTAL_HT: formatMoney(totalTtc),
        SUBTOTAL: formatMoney(totalTtc),
        DISCOUNT: '0.00',
        TAX_PERCENT: 0,
        TVA_AMOUNT: '0.00',
        TOTAL_TTC: formatMoney(totalTtc),
        STAMP_AMOUNT: '0.00',
        NET_TO_PAY: formatMoney(totalTtc),
        PAID_AMOUNT: formatMoney(paidAmount),
        REMAINING_DEBT: formatMoney(remDebt),
        TOTAL_IN_WORDS: toWords(totalTtc, lang)
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * 10. توليد تقرير ملخص المبيعات وقائمة الأسعار (sales_summary & price_list)
     */
    async function renderPriceListHtml(products = [], settings = {}, scopeLabel = 'جميع المنتجات') {
      const rawTpl = await loadTemplateHtml('price_list.html');
      const rowsHtml = (Array.isArray(products) ? products : [])
        .map(
          (p, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(p.barcode || '-')}</td>
            <td class="text-left">${escapeHtml(p.name || '')}</td>
            <td>${Number(p.stock || 0)}</td>
            <td>${escapeHtml(p.unit || 'قطعة')}</td>
            <td>${formatMoney(p.selling_price || 0)}</td>
            <td>${p.wholesale_price ? formatMoney(p.wholesale_price) : '-'}</td>
            <td>${escapeHtml(p.category || 'عام')}</td>
          </tr>`
        )
        .join('');

      const lbl = getInvoiceLabels('ar');
      const vars = {
        ...buildCompanyVars(settings),
        ...lbl,
        LBL_TITLE: 'قائمة أسعار المنتجات (Catalogue des Prix)',
        SCOPE_LABEL: scopeLabel,
        ITEMS_COUNT: products.length,
        INVOICE_NUMBER: `CAT-${new Date().getFullYear()}`,
        DATE: new Date().toISOString().slice(0, 10),
        PARTY_NAME: scopeLabel,
        ITEMS_ROWS: rowsHtml,
        SUBTOTAL: `${products.length} منتج`,
        NET_TO_PAY: `${products.length} منتج`
      };
      return compileTemplate(rawTpl, vars);
    }

    /**
     * 11. توليد ملصق الباركود أو ملصق سعر الرفوف أو شهادة الضمان (Warranty Certificate)
     */
    async function renderBarcodeLabelHtml(labelData = {}, settings = {}) {
      const rawTpl = await loadTemplateHtml('barcode_label_template_1.html');
      const labelW = Number(labelData.widthMm || settings.label_width_mm || 40);
      const labelH = Number(labelData.heightMm || settings.label_height_mm || 25);
      const barcodeH = Number(labelData.barcodeHeightMm || settings.label_barcode_height_mm || 11);
      const isPriceMode = Boolean(labelData.priceOnlyMode);

      let barcodeImg = labelData.barcodeImage || '';
      if (!barcodeImg && !isPriceMode && labelData.barcode && window.api && window.api.generateBarcodeImage) {
        barcodeImg = await window.api.generateBarcodeImage(labelData.barcode, {
          bcid: 'code128',
          height: barcodeH,
          scale: 3
        });
      }

      const priceStr = labelData.price !== undefined && labelData.price !== '' ? `${formatMoney(labelData.price)} د.ج` : '';
      const computedPriceSize = Math.max(4.5, Math.min(11, (labelW / Math.max(6, priceStr.length)) * 1.45)).toFixed(1);

      const vars = {
        LABEL_W: labelW,
        LABEL_H: labelH,
        BARCODE_H: barcodeH,
        PRICE_SIZE: computedPriceSize,
        MODE_CLASS: isPriceMode ? 'mode-price' : '',
        SHOP_NAME: escapeHtml(settings.shop_name || 'Gherbi.Ai POS'),
        PRODUCT_NAME: escapeHtml(labelData.name || ''),
        BARCODE_IMAGE: barcodeImg || '',
        BARCODE_TEXT: escapeHtml(labelData.barcode || ''),
        PRICE_TEXT: priceStr,
        PRICE_TYPE: escapeHtml(labelData.priceType || ''),
        DISCOUNT_TEXT: escapeHtml(labelData.discountText || ''),
        VARIANTS_TEXT: escapeHtml(labelData.variantsText || ''),
        PLU_TEXT: escapeHtml(labelData.plu || ''),
        CUST_PHONE: escapeHtml(labelData.custPhone || ''),
        CUST_DEBT: escapeHtml(labelData.custDebt || ''),
        CUST_DATE: escapeHtml(labelData.custDate || ''),
        HIDE_SHOP: labelData.showShop ? '' : 'hidden',
        HIDE_NAME: labelData.showName === false ? 'hidden' : '',
        HIDE_BARCODE: isPriceMode || !barcodeImg ? 'hidden' : '',
        HIDE_BCTEXT: isPriceMode || labelData.showBarcodeText === false ? 'hidden' : '',
        HIDE_PRICE: labelData.showPrice ? '' : 'hidden',
        HIDE_PRICETYPE: labelData.showPriceType && labelData.priceType ? '' : 'hidden',
        HIDE_DISCOUNT: labelData.showDiscount && labelData.discountText ? '' : 'hidden',
        HIDE_VARIANTS: labelData.showVariants && labelData.variantsText ? '' : 'hidden',
        HIDE_PLU: labelData.showPlu && labelData.plu ? '' : 'hidden',
        HIDE_CUSTPHONE: labelData.custPhone ? '' : 'hidden',
        HIDE_CUSTDEBT: labelData.custDebt ? '' : 'hidden',
        HIDE_CUSTDATE: labelData.custDate ? '' : 'hidden'
      };

      return compileTemplate(rawTpl, vars);
    }

    function renderWarrantyCertificateHtml(saleItem = {}, sale = {}, settings = {}) {
      const months = Number(saleItem.warranty_months || 12);
      const startDate = new Date(sale.sale_date || Date.now());
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);

      return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>شهادة ضمان — Certificat de Garantie</title>
  <style>
    @page { size: A5 landscape; margin: 10mm; }
    body { font-family: 'Cairo', Arial, sans-serif; color: #0f172a; padding: 14px; }
    .cert { border: 4px double #1d4ed8; border-radius: 16px; padding: 20px; background: #ffffff; }
    .hdr { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px; }
    .title { font-size: 22px; font-weight: 900; color: #1d4ed8; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; font-size: 13px; }
    .terms { font-size: 10.5px; color: #475569; margin-top: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="cert">
    <div class="hdr">
      <div>
        <div class="title">${escapeHtml(settings.shop_name || 'Gherbi.Ai POS')}</div>
        <div style="font-size:12px;">${escapeHtml(settings.shop_address || '')} | ${escapeHtml(settings.shop_phone || '')}</div>
      </div>
      <div style="text-align:left;">
        <div class="title">شهادة ضمان — CERTIFICAT DE GARANTIE</div>
        <div style="font-size:12px;font-weight:700;">فاتورة رقم: ${escapeHtml(sale.doc_number || '#' + sale.id)}</div>
      </div>
    </div>
    <div class="grid">
      <div><strong>المنتج / الجهاز:</strong> ${escapeHtml(saleItem.product_name || saleItem.name || '')}</div>
      <div><strong>الرقم التسلسلي (IMEI / S/N):</strong> <span style="font-family:monospace;font-weight:900;">${escapeHtml(saleItem.serial_number || 'غير محدد')}</span></div>
      <div><strong>المشتري:</strong> ${escapeHtml(sale.customer_name || 'زبون عابر')}</div>
      <div><strong>مدة الضمان:</strong> ${months} شهراً</div>
      <div><strong>تاريخ بداية الضمان:</strong> ${startDate.toISOString().slice(0, 10)}</div>
      <div><strong>تاريخ انتهاء الضمان:</strong> ${endDate.toISOString().slice(0, 10)}</div>
    </div>
    <div class="terms">
      <strong>شروط الضمان:</strong> يغطي هذا الضمان عيوب التصنيع فقط خلال المدة المحددة أعلاه. لا يشمل الضمان الكسر، السقوط، تسرب السوائل، سوء الاستخدام، أو الأضرار الناتجة عن التيار الكهربائي أو فتح الجهاز خارج ورشتنا المعتمدة.
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:24px;font-weight:800;font-size:12px;">
      <div>إمضاء الزبون</div>
      <div>ختم وإمضاء المتجر</div>
    </div>
  </div>
</body>
</html>`;
    }

    async function printHtmlDocument(htmlContent, options = {}) {
      if (!htmlContent) return { success: false, error: 'empty_html' };
      const silent = Boolean(options.silent);

      if (silent && window.api && typeof window.api.printSilent === 'function') {
        return await window.api.printSilent({
          html: htmlContent,
          silent: true,
          printerName: options.printerName || undefined
        });
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(htmlContent);
      doc.close();

      await new Promise((r) => setTimeout(r, 400));
      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2000);

      return { success: true };
    }

    return {
      TEMPLATE_FILES,
      formatMoney,
      loadTemplateHtml,
      compileTemplate,
      renderInvoiceHtml,
      renderReceiptHtml,
      renderCreditNoteHtml,
      renderDeliveryNoteHtml,
      renderReceptionNoteHtml,
      renderProformaHtml,
      renderOrderReceiptHtml,
      renderPaymentReceiptHtml,
      renderRecapInvoiceHtml,
      renderPriceListHtml,
      renderBarcodeLabelHtml,
      renderWarrantyCertificateHtml,
      printHtmlDocument
    };
  })();

  window.PrintEngine = PrintEngine;
}