/**
 * template-designer/template-renderer.js
 * محرك تحويل مخطط القالب المخصص (JSON Layout) إلى مستند HTML جاهز للطباعة
 */

'use strict';

(function () {
  function renderCustomTemplateHtml(layout = {}, docData = {}, settings = {}) {
    const lang = layout.lang || 'ar';
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const accent = layout.accentColor || '#1d4ed8';
    const cols = layout.columns || {};
    const items = Array.isArray(docData.items) ? docData.items : [];

    const subtotal = Number(docData.subtotal ?? docData.total ?? 0);
    const discount = Number(docData.discount || 0);
    const total = Number(docData.total ?? (subtotal - discount));
    const paid = Number(docData.paid_amount ?? total);
    const rest = Math.max(0, Number((total - paid).toFixed(2)));
    const oldDebt = Number(docData.old_balance || 0);

    const words =
      window.NumberToWords && typeof window.NumberToWords.toWords === 'function'
        ? window.NumberToWords.toWords(total, lang)
        : `${total.toFixed(2)} DZD`;

    const headersHtml = `
      ${cols.index !== false ? '<th>#</th>' : ''}
      ${cols.barcode ? '<th>المرجع</th>' : ''}
      <th>البيان / المنتج</th>
      ${cols.qty !== false ? '<th>الكمية</th>' : ''}
      ${cols.unit ? '<th>الوحدة</th>' : ''}
      ${cols.unitPrice !== false ? '<th>سعر الوحدة</th>' : ''}
      ${cols.tva ? '<th>TVA</th>' : ''}
      <th>المجموع</th>
    `;

    const rowsHtml = items
      .map(
        (it, i) => `
      <tr>
        ${cols.index !== false ? `<td style="text-align:center;">${i + 1}</td>` : ''}
        ${cols.barcode ? `<td>${it.barcode || it.product_barcode || '-'}</td>` : ''}
        <td style="font-weight:700;">${it.product_name || it.custom_product_name || it.name || 'منتج'}</td>
        ${cols.qty !== false ? `<td style="text-align:center;">${it.quantity || 1}</td>` : ''}
        ${cols.unit ? `<td style="text-align:center;">${it.unit || 'قطعة'}</td>` : ''}
        ${cols.unitPrice !== false ? `<td style="text-align:center;">${Number(it.price || 0).toFixed(2)}</td>` : ''}
        ${cols.tva ? `<td style="text-align:center;">${Number(docData.tax_percentage || 0)}%</td>` : ''}
        <td style="text-align:center;font-weight:700;">${Number(it.subtotal || (it.quantity || 1) * (it.price || 0)).toFixed(2)}</td>
      </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Cairo', 'Tajawal', sans-serif; font-size: ${layout.fontSize || 12}px; color: #0f172a; margin: 0; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${accent}; padding-bottom: 14px; margin-bottom: 16px; }
    .shop-title { font-size: 20px; font-weight: 900; color: ${accent}; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: ${accent}; color: #fff; padding: 8px; border: 1px solid ${accent}; }
    td { padding: 7px 8px; border: 1px solid #cbd5e1; }
    .totals { width: 280px; margin-right: auto; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
    .totals-row.grand { background: ${accent}; color: #fff; font-weight: 900; font-size: 14px; }
    .words-box { margin-top: 12px; padding: 8px 12px; background: #f1f5f9; border-right: 4px solid ${accent}; font-weight: 700; }
    .footer { margin-top: 28px; display: flex; justify-content: space-between; font-size: 11px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="shop-title">${settings.shop_name || 'Gherbi.Ai POS'}</div>
      <div>${settings.shop_description || ''}</div>
      <div>${settings.shop_address || ''} ${settings.shop_phone ? ' | ' + settings.shop_phone : ''}</div>
      ${
        layout.showFiscal
          ? `<div style="font-size:10px;color:#475569;margin-top:4px;">RC: ${settings.shop_rc || '-'} | NIF: ${settings.shop_nif || '-'} | AI: ${settings.shop_ai || '-'} | NIS: ${settings.shop_nis || '-'}</div>`
          : ''
      }
    </div>
    <div style="text-align:left;">
      <div style="font-size:18px;font-weight:900;color:${accent};">فاتورة رقم: ${docData.doc_number || 'FAC-2026-0001'}</div>
      <div>التاريخ: ${String(docData.sale_date || new Date().toISOString()).slice(0, 10)}</div>
    </div>
  </div>

  <div class="meta-box">
    <div>
      <strong>الزبون:</strong> ${docData.customer_name || 'زبون عابر'}
      ${docData.customer_phone ? ` | <strong>الهاتف:</strong> ${docData.customer_phone}` : ''}
    </div>
    <div><strong>طريقة الدفع:</strong> ${docData.payment_method || 'نقداً'}</div>
  </div>

  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>المجموع الفرعي:</span><span>${subtotal.toFixed(2)} د.ج</span></div>
    ${discount > 0 ? `<div class="totals-row"><span>التخفيض:</span><span>${discount.toFixed(2)} د.ج</span></div>` : ''}
    <div class="totals-row grand"><span>الصافي للدفع:</span><span>${total.toFixed(2)} د.ج</span></div>
    <div class="totals-row"><span>المدفوع:</span><span>${paid.toFixed(2)} د.ج</span></div>
    ${rest > 0 ? `<div class="totals-row"><span>الباقي من الفاتورة:</span><span>${rest.toFixed(2)} د.ج</span></div>` : ''}
    ${layout.showOldDebt && oldDebt > 0 ? `<div class="totals-row"><span>الدين السابق:</span><span>${oldDebt.toFixed(2)} د.ج</span></div>` : ''}
  </div>

  ${layout.showAmountInWords ? `<div class="words-box">أوقفت هذه الفاتورة على مبلغ: ${words}</div>` : ''}

  <div class="footer">
    <div>${layout.footerNote || ''}</div>
    ${layout.showSignature ? '<div style="font-weight:700;">الختم والإمضاء</div>' : ''}
  </div>
</body>
</html>`;
  }

  window.TemplateRenderer = {
    renderCustomTemplateHtml
  };
})();