/**
 * print-engine.js
 * محرك الطباعة وتوليد المستندات الشامل لنظام Gherbi.Ai POS
 * يدعم:
 * - تحميل قوالب HTML الـ 40+ ومعالجة الشروط {{#if}} / {{#unless}} والمتغيرات {{KEY}}
 * - تفقيط المبالغ المالية باللغات الثلاث (العربية، الفرنسية، الإنجليزية) عبر NumberToWords
 * - توليد صور الباركود لملصقات المنتجات، بطاقات الزبائن، والوصولات الحرارية
 * - حساب حجم السعر التلقائي في وضع «ملصق السعر للرفوف» (computePriceSize)
 * - المعاينة الحية، الطباعة الصامتة المباشرة، وتصدير PDF
 */

'use strict';

if (typeof window === 'undefined') {
  module.exports = {};
} else {
  const PrintEngine = (function () {
    const templateCache = new Map();

    // خريطة أسماء ملفات القوالب القياسية
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

    /**
     * تحميل محتوى قالب HTML من الملف المحلي مع التخزين المؤقت
     */
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

    /**
     * تقييم الشروط {{#if KEY}}...{{/if}} و {{#unless KEY}}...{{/unless}} واستبدال {{KEY}}
     */
    function compileTemplate(rawHtml, data = {}) {
      if (!rawHtml) return '';
      let out = String(rawHtml);

      // معالجة {{#if KEY}} ... {{/if}}
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

      // معالجة {{#unless KEY}} ... {{/unless}}
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

      // استبدال المتغيرات {{KEY}}
      out = out.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_match, key) => {
        const val = data[key];
        return val !== undefined && val !== null ? String(val) : '';
      });

      return out;
    }

    /**
     * بناء البيانات المشتركة للمتجر (Company Header Data) من الإعدادات
     */
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

    /**
     * توليد HTML فاتورة بيع أو شراء (A4 / A5 / Detailed / Thermal 80mm)
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

      let itemsRowsHtml = '';
      items.forEach((it, idx) => {
        const name = escapeHtml(it.product_name || it.custom_product_name || it.name || 'منتج');
        const ref = escapeHtml(it.product_barcode || it.barcode || it.id || idx + 1);
        const unit = escapeHtml(it.product_unit || it.unit || 'قطعة');
        const qty = Number(it.quantity || 1);
        const price = Number(it.price ?? it.selling_price ?? 0);
        const lineTotal = Number(it.subtotal ?? (qty * price));

        if (isThermal) {
          itemsRowsHtml += `
            <div class="t-item">
              <div class="t-name">${idx + 1}. ${name}</div>
              <div class="t-line">
                <span class="muted2">${qty} × ${formatMoney(price)}</span>
                <span class="b">${formatMoney(lineTotal)}</span>
              </div>
            </div>`;
        } else if (isTemplate9) {
          itemsRowsHtml += `
            <tr>
              <td>${ref}</td>
              <td class="desig">${name}</td>
              <td>${taxPercent > 0 ? taxPercent + '%' : '-'}</td>
              <td>${qty}</td>
              <td>${formatMoney(price)}</td>
              <td>${formatMoney(lineTotal)}</td>
            </tr>`;
        } else {
          itemsRowsHtml += `
            <tr>
              <td>${idx + 1}</td>
              <td>${ref}</td>
              <td class="text-left">${name}</td>
              <td>${qty}</td>
              <td>${unit}</td>
              <td>${formatMoney(price)}</td>
              <td>${taxPercent > 0 ? taxPercent + '%' : '0%'}</td>
              <td>${formatMoney(lineTotal)}</td>
            </tr>`;
        }
      });

      const totalInWords =
        window.NumberToWords && typeof window.NumberToWords.toWords === 'function'
          ? window.NumberToWords.toWords(netToPay, lang)
          : `${formatMoney(netToPay)} DZD`;

      const labelsByLang = {
        ar: {
          LBL_INVOICE_TITLE: 'فاتورة',
          INVOICE_TYPE_LABEL: invoiceData.is_purchase ? 'فاتورة شراء' : 'فاتورة بيع',
          CLIENT_ROLE_LABEL: invoiceData.is_purchase ? 'المورد' : 'الزبون',
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
          LBL_REMAINING_PAY: 'الباقي من الفاتورة :',
          LBL_TOTAL_DEBT: 'إجمالي الدين الحالي :',
          LBL_MODE_PAIEMENT: 'طريقة الدفع :',
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
          INVOICE_TYPE_LABEL: invoiceData.is_purchase ? "FACTURE D'ACHAT" : 'FACTURE',
          CLIENT_ROLE_LABEL: invoiceData.is_purchase ? 'Fournisseur' : 'Client',
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
          LBL_REMAINING_PAY: 'Reste sur Facture :',
          LBL_TOTAL_DEBT: 'Nouveau Solde :',
          LBL_MODE_PAIEMENT: 'Mode de Règlement :',
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
          INVOICE_TYPE_LABEL: invoiceData.is_purchase ? 'PURCHASE INVOICE' : 'SALES INVOICE',
          CLIENT_ROLE_LABEL: invoiceData.is_purchase ? 'Supplier' : 'Customer',
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
          LBL_REMAINING_PAY: 'Remaining Due :',
          LBL_TOTAL_DEBT: 'Total Balance Due :',
          LBL_MODE_PAIEMENT: 'Payment Method :',
          LBL_SIGNATURE: 'Stamp & Signature',
          LBL_DATE: 'Date :',
          LBL_TEL: 'Phone',
          LBL_FAX: 'Fax',
          LBL_EMAIL: 'Email',
          LBL_ADDRESS: 'Address :',
          LBL_TOTAL_IN_WORDS_PREFIX: 'Invoice total in words :'
        }
      };

      const lbl = labelsByLang[lang] || labelsByLang.ar;
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
        SUBTOTAL: formatMoney(subtotal),
        DISCOUNT: formatMoney(discount),
        TAX_TOTAL: formatMoney(taxTotal),
        STAMP_AMOUNT: formatMoney(stampAmount),
        NET_TO_PAY: formatMoney(netToPay),
        PAID_AMOUNT: formatMoney(paidAmount),
        OLD_BALANCE: formatMoney(oldBalance),
        CLIENT_OLD_DEBT: formatMoney(oldBalance),
        REMAINING_DEBT: formatMoney(remainingDebt),
        TOTAL_DEBT: formatMoney(totalDebt),
        CLIENT_TOTAL_DEBT: formatMoney(totalDebt),
        PAYMENT_MODE: invoiceData.payment_method_label || invoiceData.payment_method || 'نقداً',
        TOTAL_IN_WORDS: totalInWords
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * توليد وصل البيع الحراري السريع (Thermal Receipt 80mm / 58mm)
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

      const vars = {
        ...buildCompanyVars(settings),
        RECEIPT_NUMBER: saleData.doc_number || saleData.id || '0001',
        DATE: dateStr,
        TIME: timeStr,
        CLIENT_NAME: saleData.customer_name || 'زبون عابر',
        CLIENT_CODE: saleData.customer_id || '-',
        SELLER_NAME: saleData.seller_name || 'البائع',
        ITEMS_COUNT: items.length,
        ITEMS_ROWS: itemsRowsHtml,
        SUBTOTAL: formatMoney(subtotal),
        DISCOUNT: formatMoney(discount),
        TOTAL: formatMoney(total),
        PAID: formatMoney(paid),
        RECEIPT_REST: formatMoney(rest),
        REST: formatMoney( oldBalance + rest),
        OLD_BALANCE: formatMoney(oldBalance),
        CHANGE: formatMoney(change),
        PAYMENT_MODE: saleData.payment_method || 'نقداً',
        TOTAL_IN_WORDS:
          window.NumberToWords && typeof window.NumberToWords.toWords === 'function'
            ? window.NumberToWords.toWords(total, lang)
            : ''
      };

      return compileTemplate(rawTpl, vars);
    }

    /**
     * توليد ملصق الباركود أو ملصق سعر الرفوف (barcode_label_template_1.html)
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

      const priceStr = labelData.price !== undefined ? `${formatMoney(labelData.price)} د.ج` : '';
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

    /**
     * طباعة أي محتوى HTML (إما صامتاً عبر Electron أو عبر نافذة معاينة)
     */
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

      // فتح في نافذة معاينة/طباعة منبثقة
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
      renderBarcodeLabelHtml,
      printHtmlDocument
    };
  })();

  window.PrintEngine = PrintEngine;
}