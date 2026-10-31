/**
 * generate-print-templates.js
 * المولد الهندسي الشامل لمنظومة قوالب الطباعة (53 قالب HTML أصلي ونظيف 100%)
 * لنظام Gherbi.Ai POS — يدعم العربية (RTL) والفرنسية/الإنجليزية (LTR) والبيانات الجبائية الجزائرية
 */

'use strict';

const fs = require('fs');
const path = require('path');

// تحديد مجلد المشروع تلقائياً (يدعم التشغيل من داخل Gherbi_Ai_POS_Clean أو من خارجه)
const TARGET_DIR = fs.existsSync(path.join(__dirname, 'Gherbi_Ai_POS_Clean'))
  ? path.join(__dirname, 'Gherbi_Ai_POS_Clean')
  : __dirname;

function writeTemplate(fileName, htmlContent) {
  const fullPath = path.join(TARGET_DIR, fileName);
  fs.writeFileSync(fullPath, htmlContent.trim() + '\n', 'utf8');
}

// ============================================================================
// 1. مولد قوالب الفواتير الرسمية A4 / A5 / Detailed (invoice_template_1..9, a5, detailed)
// ============================================================================
function buildStandardInvoiceTemplate({
  themeColor = '#1d4ed8',
  secondaryBg = '#f8fafc',
  borderStyle = 'solid',
  headerLayout = 'split',
  paperSize = 'A4',
  isSixColumn = false,
  isDetailed = false
}) {
  const pageRule = paperSize === 'A5' ? '@page { size: A5 portrait; margin: 8mm; }' : '@page { size: A4 portrait; margin: 10mm; }';
  const baseFont = paperSize === 'A5' ? '11px' : '12px';

  const tableHeadHtml = isSixColumn
    ? `
      <tr>
        <th style="width:14%;">{{LBL_REF}}</th>
        <th style="width:40%;">{{LBL_DESIGNATION}}</th>
        <th style="width:10%;">{{LBL_TVA}}</th>
        <th style="width:10%;">{{LBL_QTY}}</th>
        <th style="width:13%;">{{LBL_UNIT_PRICE}}</th>
        <th style="width:13%;">{{LBL_TOTAL_HT}}</th>
      </tr>`
    : `
      <tr>
        <th style="width:6%;">{{LBL_N_INDEX}}</th>
        <th style="width:13%;">{{LBL_REF}}</th>
        <th style="width:35%;">{{LBL_DESIGNATION}}</th>
        <th style="width:9%;">{{LBL_QTY}}</th>
        <th style="width:9%;">{{LBL_UNIT}}</th>
        <th style="width:11%;">{{LBL_UNIT_PRICE}}</th>
        <th style="width:7%;">{{LBL_TVA}}</th>
        <th style="width:10%;">{{LBL_TOTAL_HT}}</th>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>{{LBL_INVOICE_TITLE}} - {{INVOICE_NUMBER}}</title>
  <link rel="stylesheet" href="./assets/css/fonts.css">
  <style>
    ${pageRule}
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
      font-size: ${baseFont};
      color: #0f172a;
      margin: 0;
      padding: ${paperSize === 'A5' ? '10px' : '18px'};
      background: #ffffff;
    }
    .doc-container {
      max-width: ${paperSize === 'A5' ? '148mm' : '210mm'};
      margin: 0 auto;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 14px;
      margin-bottom: 14px;
      border-bottom: 3px ${borderStyle} ${themeColor};
      ${headerLayout === 'banner' ? `background: ${secondaryBg}; padding: 14px; border-radius: 10px;` : ''}
    }
    .company-block { flex: 1; }
    .company-name {
      font-size: ${paperSize === 'A5' ? '18px' : '22px'};
      font-weight: 900;
      color: ${themeColor};
      margin: 0 0 4px 0;
    }
    .company-desc { font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 6px; }
    .company-meta { font-size: 10.5px; color: #334155; line-height: 1.5; }
    .fiscal-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
      font-size: 10px;
      font-family: 'Segoe UI', Tahoma, monospace;
      color: #1e293b;
    }
    .fiscal-pills span {
      background: ${secondaryBg};
      border: 1px solid #cbd5e1;
      padding: 2px 7px;
      border-radius: 5px;
      font-weight: 700;
    }
    .doc-badge {
      text-align: left;
      min-width: 190px;
      background: ${secondaryBg};
      border: 1px solid #cbd5e1;
      border-top: 4px solid ${themeColor};
      border-radius: 10px;
      padding: 10px 14px;
    }
    .doc-type {
      font-size: 16px;
      font-weight: 900;
      color: ${themeColor};
      text-transform: uppercase;
    }
    .doc-num {
      font-family: 'Segoe UI', Tahoma, monospace;
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 4px;
    }
    .doc-date {
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
    }
    .party-card {
      background: ${secondaryBg};
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .party-title {
      font-size: 11px;
      font-weight: 800;
      color: ${themeColor};
      margin-bottom: 3px;
    }
    .party-name { font-size: 14px; font-weight: 900; color: #0f172a; }
    .party-details { font-size: 10.5px; color: #334155; margin-top: 3px; }
    .party-fiscal {
      font-size: 10px;
      font-family: 'Segoe UI', Tahoma, monospace;
      color: #334155;
      text-align: left;
      line-height: 1.6;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    table.items-table th {
      background: ${themeColor};
      color: #ffffff;
      font-weight: 800;
      font-size: 11px;
      padding: 7px 6px;
      border: 1px solid ${themeColor};
      text-align: center;
    }
    table.items-table td {
      padding: 6px 6px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
      text-align: center;
    }
    table.items-table td.text-left,
    table.items-table td.desig {
      text-align: right;
      font-weight: 700;
    }
    table.items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-top: 8px;
    }
    .words-and-payment { flex: 1; }
    .words-box {
      background: ${secondaryBg};
      border: 1px solid #cbd5e1;
      border-right: 4px solid ${themeColor};
      border-radius: 8px;
      padding: 9px 12px;
      margin-bottom: 10px;
    }
    .words-prefix { font-size: 10.5px; color: #475569; font-weight: 700; }
    .words-text { font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 3px; }
    .payment-meta {
      font-size: 11px;
      color: #334155;
      font-weight: 700;
    }
    .totals-box {
      width: 270px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 12px;
      font-size: 11px;
      border-bottom: 1px solid #e2e8f0;
    }
    .totals-row .val {
      font-family: 'Segoe UI', Tahoma, monospace;
      font-weight: 800;
    }
    .totals-row.net-row {
      background: ${themeColor};
      color: #ffffff;
      font-size: 13px;
      font-weight: 900;
      padding: 8px 12px;
    }
    .footer-sign {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #475569;
    }
    .sign-box {
      min-width: 160px;
      text-align: center;
      font-weight: 800;
      color: #0f172a;
      padding-bottom: 36px;
    }
  </style>
</head>
<body>
  <div class="doc-container">
    <div class="header-bar">
      <div class="company-block">
        {{#if COMPANY_LOGO}}
        <img src="{{COMPANY_LOGO}}" alt="Logo" style="max-height:52px;margin-bottom:6px;object-fit:contain;">
        {{/if}}
        <h1 class="company-name">{{COMPANY_NAME}}</h1>
        {{#if COMPANY_DESCRIPTION}}<div class="company-desc">{{COMPANY_DESCRIPTION}}</div>{{/if}}
        <div class="company-meta">
          {{#if COMPANY_ADDRESS}}<div>{{LBL_ADDRESS}} {{COMPANY_ADDRESS}}</div>{{/if}}
          <div>
            {{#if COMPANY_PHONE}}<span>{{LBL_TEL}}: {{COMPANY_PHONE}}</span>{{/if}}
            {{#if COMPANY_FAX}}<span> | {{LBL_FAX}}: {{COMPANY_FAX}}</span>{{/if}}
            {{#if COMPANY_EMAIL}}<span> | {{LBL_EMAIL}}: {{COMPANY_EMAIL}}</span>{{/if}}
          </div>
        </div>
        <div class="fiscal-pills">
          <span>RC: {{COMPANY_RC}}</span>
          <span>NIF: {{COMPANY_NIF}}</span>
          <span>AI: {{COMPANY_AI}}</span>
          <span>NIS: {{COMPANY_NIS}}</span>
        </div>
      </div>

      <div class="doc-badge">
        <div class="doc-type">{{INVOICE_TYPE_LABEL}}</div>
        <div class="doc-num">N°: {{INVOICE_NUMBER}}</div>
        <div class="doc-date">{{LBL_DATE}} {{DATE}}</div>
      </div>
    </div>

    <div class="party-card">
      <div>
        <div class="party-title">{{CLIENT_ROLE_LABEL}}</div>
        <div class="party-name">{{PARTY_NAME}}</div>
        <div class="party-details">
          {{#if PARTY_ADDRESS}}<span>{{PARTY_ADDRESS}}</span>{{/if}}
          {{#if PARTY_PHONE}}<span> | {{LBL_TEL}}: {{PARTY_PHONE}}</span>{{/if}}
        </div>
      </div>
      <div class="party-fiscal">
        <div><strong>RC:</strong> {{PARTY_RC}} | <strong>NIF:</strong> {{PARTY_NIF}}</div>
        <div><strong>AI:</strong> {{PARTY_AI}} | <strong>NIS:</strong> {{PARTY_NIS}}</div>
      </div>
    </div>

    <table class="items-table">
      <thead>${tableHeadHtml}</thead>
      <tbody>
        {{ITEMS_ROWS}}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="words-and-payment">
        <div class="words-box">
          <div class="words-prefix">{{LBL_TOTAL_IN_WORDS_PREFIX}}</div>
          <div class="words-text">{{TOTAL_IN_WORDS}}</div>
        </div>
        <div class="payment-meta">
          {{LBL_MODE_PAIEMENT}} <span>{{PAYMENT_MODE}}</span>
        </div>
      </div>

      <div class="totals-box">
        <div class="totals-row">
          <span>{{LBL_SUBTOTAL}}</span>
          <span class="val">{{SUBTOTAL}}</span>
        </div>
        {{#if DISCOUNT}}
        <div class="totals-row">
          <span>{{LBL_DISCOUNT}}</span>
          <span class="val">-{{DISCOUNT}}</span>
        </div>
        {{/if}}
        {{#if TAX_TOTAL}}
        <div class="totals-row">
          <span>{{LBL_TAX_TOTAL}}</span>
          <span class="val">{{TAX_TOTAL}}</span>
        </div>
        {{/if}}
        {{#if STAMP_AMOUNT}}
        <div class="totals-row">
          <span>{{LBL_STAMP}}</span>
          <span class="val">{{STAMP_AMOUNT}}</span>
        </div>
        {{/if}}
        <div class="totals-row net-row">
          <span>{{LBL_NET_PAY}}</span>
          <span class="val">{{NET_TO_PAY}}</span>
        </div>
        ${
          isDetailed
            ? `
        <div class="totals-row">
          <span>{{LBL_OLD_BALANCE}}</span>
          <span class="val">{{OLD_BALANCE}}</span>
        </div>`
            : ''
        }
        {{#if REMAINING_DEBT}}
        <div class="totals-row">
          <span>{{LBL_REMAINING_PAY}}</span>
          <span class="val">{{REMAINING_DEBT}}</span>
        </div>
        {{/if}}
        {{#if TOTAL_DEBT}}
        <div class="totals-row">
          <span>{{LBL_TOTAL_DEBT}}</span>
          <span class="val">{{TOTAL_DEBT}}</span>
        </div>
        {{/if}}
      </div>
    </div>

    <div class="footer-sign">
      <div>Gherbi.Ai POS — نظام نقاط البيع والمحاسبة المتكامل</div>
      <div class="sign-box">{{LBL_SIGNATURE}}</div>
    </div>
  </div>
</body>
</html>`;
}

// توليد قوالب الفواتير الـ 9 + A5 + Detailed
const invoiceThemes = [
  { file: 'invoice_template_1.html', themeColor: '#1d4ed8', secondaryBg: '#eff6ff', headerLayout: 'split' },
  { file: 'invoice_template_2.html', themeColor: '#0f172a', secondaryBg: '#f8fafc', headerLayout: 'banner' },
  { file: 'invoice_template_3.html', themeColor: '#047857', secondaryBg: '#ecfdf5', headerLayout: 'split' },
  { file: 'invoice_template_4.html', themeColor: '#4338ca', secondaryBg: '#eef2ff', headerLayout: 'banner' },
  { file: 'invoice_template_5.html', themeColor: '#b45309', secondaryBg: '#fffbeb', headerLayout: 'split' },
  { file: 'invoice_template_6.html', themeColor: '#be123c', secondaryBg: '#fff1f2', headerLayout: 'split' },
  { file: 'invoice_template_7.html', themeColor: '#0f766e', secondaryBg: '#f0fdfa', headerLayout: 'banner' },
  { file: 'invoice_template_8.html', themeColor: '#111827', secondaryBg: '#f3f4f6', borderStyle: 'double' },
  { file: 'invoice_template_9.html', themeColor: '#1e3a8a', secondaryBg: '#f8fafc', isSixColumn: true },
  { file: 'invoice_template_a5.html', themeColor: '#1d4ed8', secondaryBg: '#f8fafc', paperSize: 'A5' },
  { file: 'invoice_template_detailed.html', themeColor: '#0f172a', secondaryBg: '#f1f5f9', isDetailed: true }
];

for (const cfg of invoiceThemes) {
  writeTemplate(cfg.file, buildStandardInvoiceTemplate(cfg));
}

// ============================================================================
// 2. قالب الفاتورة الحرارية 80mm (invoice_thermal_80.html)
// ============================================================================
writeTemplate(
  'invoice_thermal_80.html',
  `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>{{INVOICE_TYPE_LABEL}} - {{INVOICE_NUMBER}}</title>
  <link rel="stylesheet" href="./assets/css/fonts.css">
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      width: 76mm;
      margin: 0 auto;
      padding: 4px;
      font-size: 11px;
      color: #000;
    }
    .center { text-align: center; }
    .shop-title { font-size: 15px; font-weight: 900; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .t-item { padding: 4px 0; border-bottom: 1px dotted #ccc; }
    .t-name { font-weight: 800; font-size: 11px; }
    .t-line { display: flex; justify-content: space-between; font-family: monospace; font-size: 11px; }
    .b { font-weight: 900; }
    .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .grand { font-size: 14px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="center">
    <div class="shop-title">{{COMPANY_NAME}}</div>
    <div>{{COMPANY_ADDRESS}}</div>
    <div>{{COMPANY_PHONE}}</div>
    <div style="font-size:9.5px;">RC: {{COMPANY_RC}} | NIF: {{COMPANY_NIF}}</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span><strong>{{INVOICE_TYPE_LABEL}}:</strong> {{INVOICE_NUMBER}}</span><span>{{DATE}}</span></div>
  <div class="row"><span><strong>{{CLIENT_ROLE_LABEL}}:</strong> {{PARTY_NAME}}</span><span>{{PARTY_PHONE}}</span></div>
  <div class="divider"></div>
  <div>{{ITEMS_ROWS}}</div>
  <div class="divider"></div>
  <div class="row"><span>{{LBL_SUBTOTAL}}</span><span>{{SUBTOTAL}}</span></div>
  {{#if DISCOUNT}}<div class="row"><span>{{LBL_DISCOUNT}}</span><span>-{{DISCOUNT}}</span></div>{{/if}}
  {{#if TAX_TOTAL}}<div class="row"><span>{{LBL_TAX_TOTAL}}</span><span>{{TAX_TOTAL}}</span></div>{{/if}}
  {{#if STAMP_AMOUNT}}<div class="row"><span>{{LBL_STAMP}}</span><span>{{STAMP_AMOUNT}}</span></div>{{/if}}
  <div class="row grand"><span>{{LBL_NET_PAY}}</span><span>{{NET_TO_PAY}}</span></div>
  {{#if REMAINING_DEBT}}<div class="row"><span>{{LBL_REMAINING_PAY}}</span><span>{{REMAINING_DEBT}}</span></div>{{/if}}
  <div style="font-size:10px;margin-top:6px;">{{TOTAL_IN_WORDS}}</div>
</body>
</html>`
);

// ============================================================================
// 3. مولد قوالب الوصولات الحرارية الـ 15 (receipt_template_1..5 باللغات الثلاث)
// ============================================================================
function buildReceiptTemplate(styleNum = 1, lang = 'ar') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const i18n = {
    ar: {
      receipt: 'وصل بيع رقم',
      date: 'التاريخ',
      client: 'الزبون',
      seller: 'البائع',
      item: 'المنتج',
      qty: 'الكمية',
      price: 'السعر',
      total: 'المجموع',
      subtotal: 'المجموع الفرعي:',
      discount: 'التخفيض:',
      net: 'الإجمالي:',
      paid: 'المدفوع:',
      change: 'الباقي للزبون:',
      rest: 'الباقي (دين):',
      thanks: 'شكراً لزيارتكم — مرحباً بكم دائماً'
    },
    fr: {
      receipt: 'Ticket N°',
      date: 'Date',
      client: 'Client',
      seller: 'Caissier',
      item: 'Article',
      qty: 'Qté',
      price: 'P.U',
      total: 'Total',
      subtotal: 'Sous-total :',
      discount: 'Remise :',
      net: 'NET À PAYER :',
      paid: 'Reçu :',
      change: 'Rendu :',
      rest: 'Reste (Crédit) :',
      thanks: 'Merci de votre visite — À bientôt !'
    },
    en: {
      receipt: 'Receipt #',
      date: 'Date',
      client: 'Customer',
      seller: 'Cashier',
      item: 'Item',
      qty: 'Qty',
      price: 'Price',
      total: 'Total',
      subtotal: 'Subtotal:',
      discount: 'Discount:',
      net: 'TOTAL DUE:',
      paid: 'Paid:',
      change: 'Change:',
      rest: 'Balance Due:',
      thanks: 'Thank you for shopping with us!'
    }
  }[lang];

  const headerBorder = styleNum === 2 ? '2px solid #000' : styleNum === 3 ? '3px double #000' : '1px dashed #000';
  const headerBg = styleNum === 4 ? 'background:#000;color:#fff;padding:6px;border-radius:4px;' : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${i18n.receipt} {{RECEIPT_NUMBER}}</title>
  <link rel="stylesheet" href="./assets/css/fonts.css">
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
      width: 74mm;
      margin: 0 auto;
      padding: 4px;
      font-size: 11px;
      color: #000;
      background: #fff;
    }
    .header { text-align: center; padding-bottom: 6px; border-bottom: ${headerBorder}; ${headerBg} }
    .shop-name { font-size: 16px; font-weight: 900; }
    .meta { padding: 5px 0; font-size: 10.5px; border-bottom: 1px dashed #000; }
    .meta-row { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; margin: 5px 0; }
    th { border-bottom: 1px solid #000; padding: 3px 2px; font-size: 10px; text-align: center; }
    td { padding: 4px 2px; border-bottom: 1px dotted #cbd5e1; font-size: 10.5px; text-align: center; }
    td:first-child { text-align: ${dir === 'rtl' ? 'right' : 'left'}; font-weight: 700; }
    .totals { border-top: 1px dashed #000; padding-top: 5px; }
    .t-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
    .t-net { font-size: 14px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin: 4px 0; }
    .footer { text-align: center; margin-top: 8px; font-size: 10px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="header">
    {{#if COMPANY_LOGO}}
    <img src="{{COMPANY_LOGO}}" alt="Logo" style="max-height:38px;margin-bottom:3px;">
    {{/if}}
    <div class="shop-name">{{COMPANY_NAME}}</div>
    {{#if COMPANY_ADDRESS}}<div style="font-size:10px;">{{COMPANY_ADDRESS}}</div>{{/if}}
    {{#if COMPANY_PHONE}}<div style="font-size:10px;">{{COMPANY_PHONE}}</div>{{/if}}
  </div>

  <div class="meta">
    <div class="meta-row"><span><strong>${i18n.receipt}:</strong> {{RECEIPT_NUMBER}}</span><span>{{DATE}} {{TIME}}</span></div>
    <div class="meta-row"><span><strong>${i18n.client}:</strong> {{CLIENT_NAME}}</span><span><strong>${i18n.seller}:</strong> {{SELLER_NAME}}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:${dir === 'rtl' ? 'right' : 'left'};">${i18n.item}</th>
        <th>${i18n.qty}</th>
        <th>${i18n.price}</th>
        <th>${i18n.total}</th>
      </tr>
    </thead>
    <tbody>
      {{ITEMS_ROWS}}
    </tbody>
  </table>

  <div class="totals">
    <div class="t-row"><span>${i18n.subtotal}</span><span>{{SUBTOTAL}}</span></div>
    {{#if DISCOUNT}}<div class="t-row"><span>${i18n.discount}</span><span>-{{DISCOUNT}}</span></div>{{/if}}
    <div class="t-row t-net"><span>${i18n.net}</span><span>{{TOTAL}}</span></div>
    <div class="t-row"><span>${i18n.paid}</span><span>{{PAID}}</span></div>
    {{#if CHANGE}}<div class="t-row"><span>${i18n.change}</span><span>{{CHANGE}}</span></div>{{/if}}
    {{#if RECEIPT_REST}}<div class="t-row"><span>${i18n.rest}</span><span>{{RECEIPT_REST}}</span></div>{{/if}}
  </div>

  ${styleNum === 5 ? '<div style="font-size:9.5px;margin-top:4px;text-align:center;">{{TOTAL_IN_WORDS}}</div>' : ''}
  <div class="footer">${i18n.thanks}</div>
</body>
</html>`;
}

for (let n = 1; n <= 5; n++) {
  writeTemplate(`receipt_template_${n}.html`, buildReceiptTemplate(n, 'ar'));
  writeTemplate(`receipt_template_${n}_fr.html`, buildReceiptTemplate(n, 'fr'));
  writeTemplate(`receipt_template_${n}_en.html`, buildReceiptTemplate(n, 'en'));
}

// ============================================================================
// 4. قوالب إشعار الدائن (credit_note_ar/fr/en.html)
// ============================================================================
function buildCreditNoteTemplate(lang = 'ar') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const title =
    lang === 'fr' ? "FACTURE D'AVOIR" : lang === 'en' ? 'CREDIT NOTE' : 'إشعار دائن (فاتورة إلغاء / استرجاع)';
  return buildStandardInvoiceTemplate({
    themeColor: '#be123c',
    secondaryBg: '#fff1f2',
    headerLayout: 'banner'
  })
    .replace('<html lang="ar" dir="rtl">', `<html lang="${lang}" dir="${dir}">`)
    .replace('{{INVOICE_TYPE_LABEL}}', title);
}

writeTemplate('credit_note_ar.html', buildCreditNoteTemplate('ar'));
writeTemplate('credit_note_fr.html', buildCreditNoteTemplate('fr'));
writeTemplate('credit_note_en.html', buildCreditNoteTemplate('en'));

// ============================================================================
// 5. قوالب وصولات التوصيل (delivery_note_ar/fr/en/a5/thermal.html)
// ============================================================================
function buildDeliveryNoteTemplate(lang = 'ar', mode = 'a4') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const titles = {
    ar: { doc: 'وصل تسليم وتوصيل بضاعة', client: 'الزبون المستلم', driver: 'السائق / الموزع', vehicle: 'ترقيم المركبة', sigClient: 'إمضاء وختم المستلم', sigSeller: 'إمضاء المسلّم' },
    fr: { doc: 'BON DE LIVRAISON', client: 'Client Destinataire', driver: 'Chauffeur / Livreur', vehicle: 'Matricule Véhicule', sigClient: 'Signature Client', sigSeller: 'Cachet Fournisseur' },
    en: { doc: 'DELIVERY NOTE', client: 'Recipient Customer', driver: 'Driver Name', vehicle: 'Vehicle Plate', sigClient: 'Receiver Signature', sigSeller: 'Sender Stamp' }
  }[lang];

  if (mode === 'thermal') {
    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${titles.doc}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    body { font-family: 'Cairo', sans-serif; width: 74mm; margin: 0 auto; font-size: 11px; }
    .hdr { text-align: center; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #000; padding: 4px; font-size: 10.5px; text-align: center; }
  </style>
</head>
<body>
  <div class="hdr">
    <div style="font-size:15px;">{{COMPANY_NAME}}</div>
    <div>${titles.doc} — {{DOC_NUMBER}}</div>
    <div>{{DATE}}</div>
  </div>
  <div style="margin:6px 0;">
    <div><strong>${titles.client}:</strong> {{PARTY_NAME}}</div>
    <div><strong>${titles.driver}:</strong> {{DRIVER_NAME}} | <strong>${titles.vehicle}:</strong> {{VEHICLE_PLATE}}</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>{{LBL_DESIGNATION}}</th><th>{{LBL_QTY}}</th></tr></thead>
    <tbody>{{ITEMS_ROWS}}</tbody>
  </table>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${titles.doc} - {{DOC_NUMBER}}</title>
  <link rel="stylesheet" href="./assets/css/fonts.css">
  <style>
    @page { size: ${mode === 'a5' ? 'A5' : 'A4'} portrait; margin: 10mm; }
    body { font-family: 'Cairo', sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 16px; }
    .hdr { display: flex; justify-content: space-between; border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 14px; }
    .title { font-size: 20px; font-weight: 900; color: #0f766e; }
    .info-grid { display: flex; justify-content: space-between; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #0f766e; color: #fff; padding: 8px; border: 1px solid #0f766e; }
    td { padding: 7px; border: 1px solid #cbd5e1; text-align: center; }
    .signs { display: flex; justify-content: space-between; margin-top: 32px; font-weight: 800; }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="title">{{COMPANY_NAME}}</div>
      <div>{{COMPANY_ADDRESS}} | {{COMPANY_PHONE}}</div>
    </div>
    <div style="text-align:left;">
      <div class="title">${titles.doc}</div>
      <div>N°: {{DOC_NUMBER}} | {{DATE}}</div>
    </div>
  </div>
  <div class="info-grid">
    <div><strong>${titles.client}:</strong> {{PARTY_NAME}} ({{PARTY_PHONE}})</div>
    <div><strong>${titles.driver}:</strong> {{DRIVER_NAME}} | <strong>${titles.vehicle}:</strong> {{VEHICLE_PLATE}}</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>{{LBL_REF}}</th><th>{{LBL_DESIGNATION}}</th><th>{{LBL_QTY}}</th><th>{{LBL_UNIT}}</th></tr></thead>
    <tbody>{{ITEMS_ROWS}}</tbody>
  </table>
  <div class="signs">
    <div>${titles.sigSeller}</div>
    <div>${titles.sigClient}</div>
  </div>
</body>
</html>`;
}

writeTemplate('delivery_note_ar.html', buildDeliveryNoteTemplate('ar', 'a4'));
writeTemplate('delivery_note_fr.html', buildDeliveryNoteTemplate('fr', 'a4'));
writeTemplate('delivery_note_en.html', buildDeliveryNoteTemplate('en', 'a4'));
writeTemplate('delivery_note_a5.html', buildDeliveryNoteTemplate('ar', 'a5'));
writeTemplate('delivery_note_thermal.html', buildDeliveryNoteTemplate('ar', 'thermal'));

// ============================================================================
// 6. الفواتير الشكلية (proforma_invoice_ar/fr.html) وسندات الطلب (order_receipt_ar/fr.html)
//    ووصولات الاستلام (reception_note_ar/fr/en.html) والفواتير المجمعة (recap_invoice_ar/fr/en.html)
// ============================================================================
writeTemplate(
  'proforma_invoice_ar.html',
  buildStandardInvoiceTemplate({ themeColor: '#4f46e5', secondaryBg: '#eef2ff' }).replace(
    '{{INVOICE_TYPE_LABEL}}',
    'فاتورة شكلية / مبدئية (PROFORMA)'
  )
);
writeTemplate(
  'proforma_invoice_fr.html',
  buildStandardInvoiceTemplate({ themeColor: '#4f46e5', secondaryBg: '#eef2ff' })
    .replace('<html lang="ar" dir="rtl">', '<html lang="fr" dir="ltr">')
    .replace('{{INVOICE_TYPE_LABEL}}', 'FACTURE PROFORMA')
);

writeTemplate(
  'order_receipt_ar.html',
  buildStandardInvoiceTemplate({ themeColor: '#0284c7', secondaryBg: '#f0f9ff' }).replace(
    '{{INVOICE_TYPE_LABEL}}',
    'سند طلبية زبون (BON DE COMMANDE)'
  )
);
writeTemplate(
  'order_receipt_fr.html',
  buildStandardInvoiceTemplate({ themeColor: '#0284c7', secondaryBg: '#f0f9ff' })
    .replace('<html lang="ar" dir="rtl">', '<html lang="fr" dir="ltr">')
    .replace('{{INVOICE_TYPE_LABEL}}', 'BON DE COMMANDE')
);

writeTemplate(
  'reception_note_ar.html',
  buildStandardInvoiceTemplate({ themeColor: '#059669', secondaryBg: '#ecfdf5' }).replace(
    '{{INVOICE_TYPE_LABEL}}',
    'وصل استلام بضاعة (BON DE RÉCEPTION)'
  )
);
writeTemplate(
  'reception_note_fr.html',
  buildStandardInvoiceTemplate({ themeColor: '#059669', secondaryBg: '#ecfdf5' })
    .replace('<html lang="ar" dir="rtl">', '<html lang="fr" dir="ltr">')
    .replace('{{INVOICE_TYPE_LABEL}}', 'BON DE RÉCEPTION')
);
writeTemplate(
  'reception_note_en.html',
  buildStandardInvoiceTemplate({ themeColor: '#059669', secondaryBg: '#ecfdf5' })
    .replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">')
    .replace('{{INVOICE_TYPE_LABEL}}', 'GOODS RECEPTION NOTE')
);

writeTemplate(
  'recap_invoice_ar.html',
  buildStandardInvoiceTemplate({ themeColor: '#1e293b', secondaryBg: '#f8fafc', isDetailed: true }).replace(
    '{{INVOICE_TYPE_LABEL}}',
    'فاتورة مجمعة للفترة (FACTURE RÉCAPITULATIVE)'
  )
);
writeTemplate(
  'recap_invoice_fr.html',
  buildStandardInvoiceTemplate({ themeColor: '#1e293b', secondaryBg: '#f8fafc', isDetailed: true })
    .replace('<html lang="ar" dir="rtl">', '<html lang="fr" dir="ltr">')
    .replace('{{INVOICE_TYPE_LABEL}}', 'FACTURE RÉCAPITULATIVE')
);
writeTemplate(
  'recap_invoice_en.html',
  buildStandardInvoiceTemplate({ themeColor: '#1e293b', secondaryBg: '#f8fafc', isDetailed: true })
    .replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">')
    .replace('{{INVOICE_TYPE_LABEL}}', 'SUMMARY INVOICE')
);

// ============================================================================
// 7. وصولات تسديد الديون (payment_receipt_ar.html & payment_receipt_fr.html)
// ============================================================================
function buildPaymentReceiptTemplate(lang = 'ar') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const lbl =
    lang === 'fr'
      ? {
          title: 'REÇU DE PAIEMENT / VERSEMENT',
          num: 'Reçu N°:',
          date: 'Date:',
          party: 'Reçu de:',
          debtBefore: 'Ancien Solde (Dette):',
          paid: 'Montant Versé:',
          debtAfter: 'Nouveau Solde Restant:',
          words: 'Arrêté le présent reçu à la somme de:',
          sig: 'Cachet & Signature'
        }
      : {
          title: 'وصل تسديد دفعة حساب',
          num: 'رقم الوصل:',
          date: 'التاريخ:',
          party: 'استلمنا من السيد / المؤسسة:',
          debtBefore: 'الرصيد / الدين السابق:',
          paid: 'المبلغ المدفوع حالياً:',
          debtAfter: 'الرصيد / الدين المتبقي:',
          words: 'المبلغ بالحروف:',
          sig: 'الختم والإمضاء'
        };

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${lbl.title} - {{RECEIPT_NUMBER}}</title>
  <link rel="stylesheet" href="./assets/css/fonts.css">
  <style>
    @page { size: A5 landscape; margin: 10mm; }
    body { font-family: 'Cairo', sans-serif; font-size: 13px; color: #0f172a; padding: 16px; }
    .card { border: 2px solid #1d4ed8; border-radius: 12px; padding: 18px; background: #fff; }
    .hdr { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px; }
    .title { font-size: 20px; font-weight: 900; color: #1d4ed8; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 14px 0; }
    .stat { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center; }
    .stat.highlight { background: #ecfdf5; border-color: #10b981; color: #047857; }
    .val { font-size: 18px; font-weight: 900; font-family: monospace; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <div>
        <div class="title">{{COMPANY_NAME}}</div>
        <div>{{COMPANY_ADDRESS}} | {{COMPANY_PHONE}}</div>
      </div>
      <div style="text-align:left;">
        <div class="title">${lbl.title}</div>
        <div><strong>${lbl.num}</strong> {{RECEIPT_NUMBER}} | <strong>${lbl.date}</strong> {{DATE}}</div>
      </div>
    </div>
    <div><strong>${lbl.party}</strong> {{PARTY_NAME}} ({{PARTY_PHONE}})</div>
    <div class="grid">
      <div class="stat"><div>${lbl.debtBefore}</div><div class="val">{{DEBT_BEFORE}}</div></div>
      <div class="stat highlight"><div>${lbl.paid}</div><div class="val">{{PAID_AMOUNT}}</div></div>
      <div class="stat"><div>${lbl.debtAfter}</div><div class="val">{{DEBT_AFTER}}</div></div>
    </div>
    <div style="background:#eff6ff;padding:8px 12px;border-radius:8px;font-weight:700;">
      ${lbl.words} {{TOTAL_IN_WORDS}}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:24px;font-weight:800;">
      <div>{{PAYMENT_MODE}}</div>
      <div>${lbl.sig}</div>
    </div>
  </div>
</body>
</html>`;
}

writeTemplate('payment_receipt_ar.html', buildPaymentReceiptTemplate('ar'));
writeTemplate('payment_receipt_fr.html', buildPaymentReceiptTemplate('fr'));

// ============================================================================
// 8. تقارير ملخص المبيعات (sales_summary_ar/fr/en.html) وقائمة الأسعار (price_list.html)
// ============================================================================
function buildSalesSummaryTemplate(lang = 'ar') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const title =
    lang === 'fr' ? 'RAPPORT RÉCAPITULATIF DES VENTES' : lang === 'en' ? 'SALES SUMMARY REPORT' : 'تقرير ملخص المبيعات والخزينة';
  return buildStandardInvoiceTemplate({ themeColor: '#0f172a', secondaryBg: '#f1f5f9' })
    .replace('<html lang="ar" dir="rtl">', `<html lang="${lang}" dir="${dir}">`)
    .replace('{{INVOICE_TYPE_LABEL}}', title);
}

writeTemplate('sales_summary_ar.html', buildSalesSummaryTemplate('ar'));
writeTemplate('sales_summary_fr.html', buildSalesSummaryTemplate('fr'));
writeTemplate('sales_summary_en.html', buildSalesSummaryTemplate('en'));

writeTemplate(
  'price_list.html',
  buildStandardInvoiceTemplate({ themeColor: '#1d4ed8', secondaryBg: '#eff6ff' }).replace(
    '{{INVOICE_TYPE_LABEL}}',
    'قائمة أسعار المنتجات (CATALOGUE DES PRIX)'
  )
);

// ============================================================================
// 9. قالب ملصقات الباركود وأسعار الرفوف وبطاقات الزبائن (barcode_label_template_1.html)
// ============================================================================
writeTemplate(
  'barcode_label_template_1.html',
  `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Barcode Label — Gherbi.Ai POS</title>
  <link rel="stylesheet" href="./assets/css/fonts.css">
  <style>
    @page {
      size: {{LABEL_W}}mm {{LABEL_H}}mm;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: {{LABEL_W}}mm;
      height: {{LABEL_H}}mm;
      overflow: hidden;
      font-family: 'Cairo', Arial, sans-serif;
      background: #ffffff;
      color: #000000;
    }
    .label-box {
      width: {{LABEL_W}}mm;
      height: {{LABEL_H}}mm;
      padding: 1.2mm 1.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
    }
    .hidden { display: none !important; }
    .shop-name {
      font-size: 2.3mm;
      font-weight: 800;
      line-height: 1.1;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .prod-name {
      font-size: 2.7mm;
      font-weight: 900;
      line-height: 1.15;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .barcode-img {
      width: 92%;
      height: {{BARCODE_H}}mm;
      object-fit: contain;
    }
    .barcode-txt {
      font-family: 'Segoe UI', Tahoma, monospace;
      font-size: 2.4mm;
      font-weight: 800;
      letter-spacing: 0.4px;
    }
    .price-row {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 1mm;
    }
    .price-val {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      font-size: 3.6mm;
      font-weight: 900;
    }
    .mode-price .price-val {
      font-size: {{PRICE_SIZE}}mm;
      border: 0.4mm solid #000;
      padding: 0.6mm 2mm;
      border-radius: 1mm;
    }
    .meta-line {
      font-size: 2.1mm;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="label-box {{MODE_CLASS}}">
    <div class="shop-name {{HIDE_SHOP}}">{{SHOP_NAME}}</div>
    <div class="prod-name {{HIDE_NAME}}">{{PRODUCT_NAME}}</div>
    <div class="meta-line {{HIDE_VARIANTS}}">{{VARIANTS_TEXT}}</div>
    <img src="{{BARCODE_IMAGE}}" class="barcode-img {{HIDE_BARCODE}}" alt="Barcode">
    <div class="barcode-txt {{HIDE_BCTEXT}}">{{BARCODE_TEXT}}</div>
    <div class="price-row {{HIDE_PRICE}}">
      <span class="price-val">{{PRICE_TEXT}}</span>
      <span class="meta-line {{HIDE_PRICETYPE}}">{{PRICE_TYPE}}</span>
    </div>
    <div class="meta-line {{HIDE_DISCOUNT}}">{{DISCOUNT_TEXT}}</div>
    <div class="meta-line {{HIDE_PLU}}">PLU: {{PLU_TEXT}}</div>
    <div class="meta-line {{HIDE_CUSTPHONE}}">{{CUST_PHONE}}</div>
    <div class="meta-line {{HIDE_CUSTDEBT}}">{{CUST_DEBT}}</div>
    <div class="meta-line {{HIDE_CUSTDATE}}">{{CUST_DATE}}</div>
  </div>
</body>
</html>`
);

console.log('✅ تم توليد جميع قوالب الطباعة الـ 53 بنجاح داخل:', TARGET_DIR);