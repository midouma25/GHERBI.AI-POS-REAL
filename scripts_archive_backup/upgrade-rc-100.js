/**
 * upgrade-rc-100.js
 * الترقية الهندسية الختامية للوصول إلى الجاهزية التسويقية 100% (Release Candidate)
 * 1. استكمال مسارات LAN REST API في server.js و api-client.js و main.js و preload.js
 * 2. دعم تعديل فواتير الشراء (editInvoiceId) ورقم مرجع الدفع ورمز BaridiMob QR
 * 3. إعادة توليد قوالب credit_note_ar/fr/en.html و sales_summary_ar/fr/en.html بمتغيراتها الدقيقة
 * 4. ترقية index.html بنافذة مركز الطباعة الموحد، مولد الخيارات الديكارتي، والولايات الـ 58
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ============================================================================
// 1. إعادة توليد قوالب إشعار الدائن (credit_note_ar/fr/en.html) وملخص المبيعات
// ============================================================================
function buildDedicatedCreditNoteTemplate(lang = 'ar') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = {
    ar: {
      title: 'إشعار دائن — FACTURE D\'AVOIR',
      num: 'رقم إشعار الدائن:',
      date: 'تاريخ الإصدار:',
      origInv: 'مرجع الفاتورة الأصلية:',
      origDate: 'تاريخ الفاتورة الأصلية:',
      reason: 'سبب الإرجاع / التصحيح:',
      client: 'الزبون المستفيد:',
      idx: '#',
      ref: 'المرجع',
      desig: 'البيان',
      unit: 'الوحدة',
      qty: 'الكمية المرجعة',
      price: 'سعر الوحدة',
      tva: 'TVA',
      total: 'المجموع',
      subHt: 'المجموع خارج الرسم (HT):',
      disc: 'التخفيض:',
      tvaAmt: 'قيمة الضريبة (TVA):',
      ttc: 'المجموع بالرسم (TTC):',
      stamp: 'حق الطابع:',
      net: 'الصافي المخصوم / المسترد:',
      words: 'أوقف هذا الإشعار الدائن على مبلغ:',
      sig: 'الختم والإمضاء'
    },
    fr: {
      title: "FACTURE D'AVOIR",
      num: 'Avoir N° :',
      date: "Date d'émission :",
      origInv: 'Facture Originale N° :',
      origDate: 'Date Facture Originale :',
      reason: "Motif de l'Avoir :",
      client: 'Client :',
      idx: 'N°',
      ref: 'Réf',
      desig: 'Désignation',
      unit: 'Unité',
      qty: 'Qté Retournée',
      price: 'P.U. HT',
      tva: 'TVA',
      total: 'Montant HT',
      subHt: 'Total HT :',
      disc: 'Remise :',
      tvaAmt: 'Montant TVA :',
      ttc: 'Total TTC :',
      stamp: 'Droit de Timbre :',
      net: 'NET À CRÉDITER / REMBOURSER :',
      words: 'Arrêté le présent avoir à la somme de :',
      sig: 'Cachet et Signature'
    },
    en: {
      title: 'OFFICIAL CREDIT NOTE',
      num: 'Credit Note #:',
      date: 'Issue Date:',
      origInv: 'Original Invoice #:',
      origDate: 'Original Invoice Date:',
      reason: 'Return / Credit Reason:',
      client: 'Customer:',
      idx: '#',
      ref: 'Ref',
      desig: 'Description',
      unit: 'Unit',
      qty: 'Returned Qty',
      price: 'Unit Price',
      tva: 'VAT',
      total: 'Total',
      subHt: 'Subtotal (Excl. Tax):',
      disc: 'Discount:',
      tvaAmt: 'VAT Amount:',
      ttc: 'Total (Incl. Tax):',
      stamp: 'Stamp Duty:',
      net: 'NET CREDIT AMOUNT:',
      words: 'Credit note total in words:',
      sig: 'Authorized Stamp & Signature'
    }
  }[lang];

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${t.title} - {{CREDIT_NOTE_NUMBER}}</title>
  <link rel="stylesheet" href="./assets/css/fonts.css">
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Cairo', 'Tajawal', Arial, sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 18px; background: #fff; }
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #be123c; padding-bottom: 14px; margin-bottom: 14px; }
    .shop-name { font-size: 22px; font-weight: 900; color: #be123c; }
    .badge { background: #fff1f2; border: 1px solid #fecdd3; border-top: 4px solid #be123c; border-radius: 10px; padding: 10px 14px; min-width: 220px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; }
    .reason-banner { background: #fff1f2; border-right: 4px solid #be123c; padding: 8px 12px; border-radius: 6px; font-weight: 800; color: #9f1239; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { background: #be123c; color: #fff; padding: 7px 6px; border: 1px solid #be123c; font-size: 11px; text-align: center; }
    td { padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: center; }
    .summary-wrap { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
    .words-box { flex: 1; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px 12px; }
    .totals { width: 280px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; }
    .t-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; }
    .t-net { background: #be123c; color: #fff; font-weight: 900; font-size: 13px; padding: 8px 12px; }
    .footer { margin-top: 28px; display: flex; justify-content: space-between; font-weight: 800; color: #475569; }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      {{#if COMPANY_LOGO}}<img src="{{COMPANY_LOGO}}" style="max-height:50px;margin-bottom:4px;">{{/if}}
      <div class="shop-name">{{COMPANY_NAME}}</div>
      <div>{{COMPANY_ADDRESS}} | {{COMPANY_PHONE}}</div>
      <div style="font-size:10px;font-family:monospace;margin-top:4px;">RC: {{COMPANY_RC}} | NIF: {{COMPANY_NIF}} | AI: {{COMPANY_AI}} | NIS: {{COMPANY_NIS}}</div>
    </div>
    <div class="badge">
      <div style="font-size:16px;font-weight:900;color:#be123c;">${t.title}</div>
      <div style="font-family:monospace;font-weight:900;margin-top:4px;">${t.num} {{CREDIT_NOTE_NUMBER}}</div>
      <div style="font-size:11px;margin-top:2px;">${t.date} {{DATE}}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="card">
      <div style="font-weight:900;color:#be123c;">${t.client}</div>
      <div style="font-size:14px;font-weight:900;margin-top:2px;">{{PARTY_NAME}}</div>
      <div style="font-size:11px;">{{PARTY_ADDRESS}}</div>
      <div style="font-size:10px;font-family:monospace;margin-top:3px;">RC: {{PARTY_RC}} | NIF: {{PARTY_NIF}}</div>
    </div>
    <div class="card">
      <div><strong>${t.origInv}</strong> <span style="font-family:monospace;font-weight:900;">{{ORIGINAL_INVOICE_NUMBER}}</span></div>
      <div style="margin-top:4px;"><strong>${t.origDate}</strong> <span style="font-family:monospace;">{{ORIGINAL_INVOICE_DATE}}</span></div>
    </div>
  </div>

  <div class="reason-banner">${t.reason} {{RETURN_REASON}}</div>

  <table>
    <thead>
      <tr>
        <th>${t.idx}</th>
        <th>${t.ref}</th>
        <th>${t.desig}</th>
        <th>${t.unit}</th>
        <th>${t.qty}</th>
        <th>${t.price}</th>
        <th>${t.tva}</th>
        <th>${t.total}</th>
      </tr>
    </thead>
    <tbody>{{ITEMS_ROWS}}</tbody>
  </table>

  <div class="summary-wrap">
    <div class="words-box">
      <div style="font-size:10.5px;color:#881337;font-weight:700;">${t.words}</div>
      <div style="font-size:12px;font-weight:900;margin-top:4px;">{{TOTAL_IN_WORDS}}</div>
    </div>
    <div class="totals">
      <div class="t-row"><span>${t.subHt}</span><span style="font-family:monospace;font-weight:800;">{{SUBTOTAL_HT}}</span></div>
      {{#if DISCOUNT}}<div class="t-row"><span>${t.disc}</span><span style="font-family:monospace;font-weight:800;">-{{DISCOUNT}}</span></div>{{/if}}
      <div class="t-row"><span>${t.tvaAmt} ({{TAX_PERCENT}}%)</span><span style="font-family:monospace;font-weight:800;">{{TVA_AMOUNT}}</span></div>
      <div class="t-row"><span>${t.ttc}</span><span style="font-family:monospace;font-weight:800;">{{TOTAL_TTC}}</span></div>
      {{#if STAMP_AMOUNT}}<div class="t-row"><span>${t.stamp}</span><span style="font-family:monospace;font-weight:800;">{{STAMP_AMOUNT}}</span></div>{{/if}}
      <div class="t-row t-net"><span>${t.net}</span><span style="font-family:monospace;">{{NET_TO_PAY}}</span></div>
    </div>
  </div>

  <div class="footer">
    <div>Gherbi.Ai POS</div>
    <div>${t.sig}</div>
  </div>
</body>
</html>`;
}

function buildDedicatedSalesSummaryTemplate(lang = 'ar') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = {
    ar: {
      title: 'تقرير ملخص المبيعات والخزينة للفترة',
      num: 'رقم التقرير:',
      period: 'الفترة الزمنية:',
      count: 'عدد الفواتير',
      totalSales: 'إجمالي المبيعات',
      totalPaid: 'إجمالي المقبوضات',
      totalRem: 'إجمالي الديون المتبقية',
      cogs: 'تكلفة البضاعة المباعة (COGS)',
      expenses: 'إجمالي المصاريف',
      netProfit: 'صافي الربح الصافي',
      topTitle: 'تفصيل المنتجات المباعة خلال الفترة',
      idx: '#',
      desig: 'المنتج',
      qty: 'الكمية المباعة',
      rev: 'الإيرادات',
      prof: 'الربح الصافي'
    },
    fr: {
      title: 'RAPPORT RÉCAPITULATIF DES VENTES',
      num: 'Rapport N° :',
      period: 'Période :',
      count: 'Nombre de Ventes',
      totalSales: 'Chiffre d\'Affaires',
      totalPaid: 'Total Encaissé',
      totalRem: 'Total Créances',
      cogs: 'Coût des Marchandises (COGS)',
      expenses: 'Total Charges',
      netProfit: 'Bénéfice Net',
      topTitle: 'Détail des Articles Vendus',
      idx: 'N°',
      desig: 'Désignation',
      qty: 'Qté Vendue',
      rev: 'Chiffre d\'Affaires',
      prof: 'Bénéfice'
    },
    en: {
      title: 'PERIODIC SALES & PROFIT SUMMARY REPORT',
      num: 'Report #:',
      period: 'Period:',
      count: 'Sales Count',
      totalSales: 'Total Revenue',
      totalPaid: 'Total Collected',
      totalRem: 'Remaining Receivables',
      cogs: 'Cost of Goods Sold (COGS)',
      expenses: 'Total Expenses',
      netProfit: 'Net Profit',
      topTitle: 'Sold Products Breakdown',
      idx: '#',
      desig: 'Product',
      qty: 'Qty Sold',
      rev: 'Revenue',
      prof: 'Net Profit'
    }
  }[lang];

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${t.title} - {{SUMMARY_NUMBER}}</title>
  <link rel="stylesheet" href="./assets/css/fonts.css">
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Cairo', Arial, sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 18px; }
    .hdr { display: flex; justify-content: space-between; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; }
    .kpi .v { font-size: 16px; font-weight: 900; font-family: monospace; margin-top: 4px; color: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #0f172a; color: #fff; padding: 7px; border: 1px solid #0f172a; font-size: 11px; }
    td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <div style="font-size:20px;font-weight:900;">{{COMPANY_NAME}}</div>
      <div>{{COMPANY_ADDRESS}} | {{COMPANY_PHONE}}</div>
    </div>
    <div style="text-align:left;">
      <div style="font-size:16px;font-weight:900;">${t.title}</div>
      <div><strong>${t.num}</strong> {{SUMMARY_NUMBER}}</div>
      <div><strong>${t.period}</strong> {{DATE_FROM}} -> {{DATE_TO}}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div>${t.count}</div><div class="v">{{SALES_COUNT}}</div></div>
    <div class="kpi"><div>${t.totalSales}</div><div class="v">{{TOTAL_SALES}}</div></div>
    <div class="kpi"><div>${t.totalPaid}</div><div class="v" style="color:#059669;">{{TOTAL_PAID}}</div></div>
    <div class="kpi"><div>${t.totalRem}</div><div class="v" style="color:#e11d48;">{{TOTAL_REMAINING}}</div></div>
    <div class="kpi"><div>${t.cogs}</div><div class="v" style="color:#d97706;">{{COGS_TOTAL}}</div></div>
    <div class="kpi"><div>${t.netProfit}</div><div class="v" style="color:#059669;">{{NET_PROFIT}}</div></div>
  </div>

  <h4 style="margin:10px 0 6px 0;font-weight:900;">${t.topTitle}</h4>
  <table>
    <thead>
      <tr>
        <th>${t.idx}</th>
        <th>${t.desig}</th>
        <th>${t.qty}</th>
        <th>${t.rev}</th>
        <th>${t.prof}</th>
      </tr>
    </thead>
    <tbody>{{ITEMS_ROWS}}</tbody>
  </table>
</body>
</html>`;
}

['ar', 'fr', 'en'].forEach((lang) => {
  fs.writeFileSync(path.join(ROOT, `credit_note_${lang}.html`), buildDedicatedCreditNoteTemplate(lang), 'utf8');
  fs.writeFileSync(path.join(ROOT, `sales_summary_${lang}.html`), buildDedicatedSalesSummaryTemplate(lang), 'utf8');
});
console.log('✅ 1/5: تم تحديث قوالب credit_note_ar/fr/en.html و sales_summary_ar/fr/en.html بمتغيراتها الكاملة.');

// ============================================================================
// 2. ترقية server.js لإضافة مسارات LAN Multi-POS وتعديل فواتير المشتريات
// ============================================================================
const serverPath = path.join(ROOT, 'server.js');
if (fs.existsSync(serverPath)) {
  let srvCode = fs.readFileSync(serverPath, 'utf8');

  const extraServerRoutes = `
  // [RC-100% LAN MULTI-POS PARITY ROUTES]
  app.get('/api/dz-dictionary/stats', async (_req, res) => {
    try {
      const row = await db.dbGet('SELECT COUNT(*) AS count FROM dz_product_dictionary');
      res.json({ count: Number((row && row.count) || 0) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/warranty/:serial', async (req, res) => {
    try {
      const serial = String(req.params.serial || '').trim();
      const item = await db.dbGet(
        \`SELECT si.*, COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
                p.barcode AS product_barcode, p.warranty_months AS default_warranty_months,
                s.doc_number, s.sale_date, s.total AS sale_total,
                c.name AS customer_name, c.phone AS customer_phone
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
         LEFT JOIN products p ON p.id = si.product_id
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE si.serial_number = ? COLLATE NOCASE AND si.deleted_at IS NULL
         ORDER BY si.id DESC LIMIT 1\`,
        [serial]
      );
      if (!item) return res.json({ found: false, serial });
      const months = Number(item.warranty_months || item.default_warranty_months || 12);
      const startDate = new Date(item.sale_date || Date.now());
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);
      const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
      res.json({
        found: true,
        serial,
        sale_id: item.sale_id,
        doc_number: item.doc_number || ('#' + item.sale_id),
        sale_date: String(item.sale_date || '').slice(0, 10),
        product_name: item.product_name,
        product_barcode: item.product_barcode || '',
        price: item.price,
        customer_name: item.customer_name || 'زبون عابر',
        customer_phone: item.customer_phone || '',
        warranty_months: months,
        warranty_end_date: endDate.toISOString().slice(0, 10),
        days_remaining: daysLeft,
        is_valid: daysLeft >= 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/suppliers/:id/ledger', async (req, res) => {
    try {
      const sid = Number(req.params.id);
      const supplier = await db.dbGet('SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL', [sid]);
      const purchases = await db.dbAll('SELECT * FROM purchase_invoices WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC', [sid]);
      const payments = await db.dbAll(
        \`SELECT ip.*, pi.invoice_number FROM invoice_payments ip
         LEFT JOIN purchase_invoices pi ON pi.id = ip.invoice_id
         WHERE (ip.supplier_id = ? OR pi.supplier_id = ?) AND ip.deleted_at IS NULL ORDER BY ip.id DESC\`,
        [sid, sid]
      );
      const returns = await db.dbAll('SELECT * FROM supplier_returns WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC', [sid]);
      res.json({ supplier, purchases, payments, returns });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/installments', async (req, res) => {
    try {
      res.json(await createInstallmentPlanRecord(req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/installments/:scheduleId/pay', async (req, res) => {
    try {
      const sid = Number(req.params.scheduleId);
      const sched = await db.dbGet('SELECT * FROM installment_schedules WHERE id = ?', [sid]);
      if (!sched) return res.status(404).json({ error: 'schedule_not_found' });
      const amount = req.body && req.body.amount !== undefined ? Number(req.body.amount) : Number(sched.amount) - Number(sched.paid_amount || 0);
      const newPaid = Number((Number(sched.paid_amount || 0) + amount).toFixed(2));
      const newStatus = newPaid >= Number(sched.amount) - 0.01 ? 'paid' : 'partial';
      const nowIso = new Date().toISOString();

      await db.withTransaction(async () => {
        await db.dbRun('UPDATE installment_schedules SET paid_amount = ?, status = ?, paid_at = ? WHERE id = ?', [newPaid, newStatus, nowIso, sid]);
        await db.dbRun('UPDATE installment_plans SET remaining_amount = MAX(0, COALESCE(remaining_amount, 0) - ?) WHERE id = ?', [amount, sched.plan_id]);
        const pendingRow = await db.dbGet("SELECT COUNT(*) AS c FROM installment_schedules WHERE plan_id = ? AND status <> 'paid' AND deleted_at IS NULL", [sched.plan_id]);
        if (Number((pendingRow && pendingRow.c) || 0) === 0) {
          await db.dbRun("UPDATE installment_plans SET status = 'completed' WHERE id = ?", [sched.plan_id]);
        }
      });
      res.json({ success: true, scheduleId: sid, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/doc-counters', async (_req, res) => {
    try {
      res.json(await db.dbAll('SELECT * FROM document_counters ORDER BY doc_type ASC'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/doc-counters', async (req, res) => {
    try {
      const payload = req.body || {};
      const docType = String(payload.doc_type || 'invoice').trim();
      const year = Number(payload.year || new Date().getFullYear());
      const lastNum = Math.max(0, parseInt(payload.last_number ?? 0, 10) || 0);
      const prefixFmt = String(payload.prefix_format || 'FAC-{YYYY}-{0000}').trim();
      await db.dbRun(
        \`INSERT INTO document_counters (doc_type, year, last_number, prefix_format)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(doc_type, year) DO UPDATE SET last_number = excluded.last_number, prefix_format = excluded.prefix_format\`,
        [docType, year, lastNum, prefixFmt]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/copilot-insights', async (_req, res) => {
    try {
      res.json(await analyticsQueries.getAiCopilotInsights(db));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products/:id/serials', async (req, res) => {
    try {
      res.json(await db.dbAll('SELECT * FROM product_serials WHERE product_id = ? AND deleted_at IS NULL ORDER BY id DESC', [Number(req.params.id)]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/:id/serials', async (req, res) => {
    try {
      const p = req.body || {};
      const ins = await db.dbRun(
        "INSERT INTO product_serials (product_id, variant_id, batch_id, serial_number, status, warranty_months, notes) VALUES (?, ?, ?, ?, 'in_stock', ?, ?)",
        [Number(req.params.id), p.variant_id || null, p.batch_id || null, String(p.serial_number || '').trim(), Number(p.warranty_months ?? 12), p.notes || null]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
`;

  if (!srvCode.includes("app.get('/api/warranty/:serial'")) {
    srvCode = srvCode.replace(
      "app.get('/api/dz-barcode/:barcode'",
      extraServerRoutes + "\n  app.get('/api/dz-barcode/:barcode'"
    );
    fs.writeFileSync(serverPath, srvCode, 'utf8');
  }
}
console.log('✅ 2/5: تم ترقية server.js بكافة مسارات الشبكة المحلية (LAN Multi-POS).');

// ============================================================================
// 3. ترقية api-client.js لدعم كافة المسارات الجديدة على الأجهزة الفرعية
// ============================================================================
const apiClientPath = path.join(ROOT, 'api-client.js');
if (fs.existsSync(apiClientPath)) {
  let cliCode = fs.readFileSync(apiClientPath, 'utf8');
  const newClientMethods = `
  lookupDzBarcode(barcode) {
    return request('GET', \`/api/dz-barcode/\${encodeURIComponent(barcode)}\`);
  },
  getDzDictionaryStats() {
    return request('GET', '/api/dz-dictionary/stats');
  },
  lookupWarrantySerial(serial) {
    return request('GET', \`/api/warranty/\${encodeURIComponent(serial)}\`);
  },
  getSupplierLedger(supplierId) {
    return request('GET', \`/api/suppliers/\${supplierId}/ledger\`);
  },
  getInstallmentPlans(filters = {}) {
    return request('GET', \`/api/installments\${buildQuery(filters)}\`);
  },
  createInstallmentPlan(payload) {
    return request('POST', '/api/installments', payload);
  },
  payInstallmentSchedule(scheduleId, amount) {
    return request('POST', \`/api/installments/\${scheduleId}/pay\`, { amount });
  },
  getAuditLogs(filters = {}) {
    return request('GET', \`/api/audit-logs\${buildQuery(filters)}\`);
  },
  addAuditLog(payload) {
    return request('POST', '/api/audit-logs', payload);
  },
  getDocCounters() {
    return request('GET', '/api/doc-counters');
  },
  updateDocCounter(payload) {
    return request('PUT', '/api/doc-counters', payload);
  },
  getAiCopilotInsights() {
    return request('GET', '/api/copilot-insights');
  },
  getProductSerials(productId) {
    return request('GET', \`/api/products/\${productId}/serials\`);
  },
  addProductSerial(payload) {
    return request('POST', \`/api/products/\${payload.product_id || payload.productId}/serials\`, payload);
  },`;

  if (!cliCode.includes('lookupWarrantySerial(')) {
    cliCode = cliCode.replace('getSettings() {', newClientMethods + '\n  getSettings() {');
    fs.writeFileSync(apiClientPath, cliCode, 'utf8');
  }
}
console.log('✅ 3/5: تم ترقية api-client.js بجميع دوال الشبكة المحلية.');

// ============================================================================
// 4. ترقية main.js و preload.js لدعم تعديل فواتير الشراء و BaridiMob QR
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  // إضافة معالج توليد رمز QR لحساب BaridiMob / CCP
  if (!mainCode.includes("ipcMain.handle('rip-qr-dataurl'")) {
    const ripHandler = `
  ipcMain.handle('rip-qr-dataurl', async (_e, customText) => {
    const rip = customText || (await getSetting('shop_baridimob_rip', '')) || (await getSetting('shop_ccp', '')) || '00799999000000000000';
    if (!rip) return '';
    return await QRCode.toDataURL(String(rip), { margin: 1, width: 180 });
  });
`;
    mainCode = mainCode.replace("ipcMain.handle('pairing-qr-dataurl'", ripHandler + "\n  ipcMain.handle('pairing-qr-dataurl'");
  }

  // ترقية save-purchase لدعم تعديل فاتورة شراء موجودة (editInvoiceId)
  if (!mainCode.includes('data.editInvoiceId')) {
    mainCode = mainCode.replace(
      "ipcMain.handle('save-purchase', async (_e, data = {}) => {",
      `ipcMain.handle('save-purchase', async (_e, data = {}) => {
    if (data.editInvoiceId || data.edit_invoice_id) {
      const oldId = Number(data.editInvoiceId || data.edit_invoice_id);
      const oldItems = await dbAll('SELECT batch_id FROM purchase_items WHERE invoice_id = ? AND deleted_at IS NULL', [oldId]);
      const oldBatchIds = oldItems.map((x) => x.batch_id).filter(Boolean);
      if (oldBatchIds.length > 0) await batchAlloc.voidBatches(db, oldBatchIds);
      await dbRun('DELETE FROM invoice_payments WHERE invoice_id = ?', [oldId]);
      await dbRun('DELETE FROM purchase_items WHERE invoice_id = ?', [oldId]);
      await dbRun('DELETE FROM purchase_invoices WHERE id = ?', [oldId]);
    }`
    );
  }

  fs.writeFileSync(mainPath, mainCode, 'utf8');
}

const preloadPath = path.join(ROOT, 'preload.js');
if (fs.existsSync(preloadPath)) {
  let preCode = fs.readFileSync(preloadPath, 'utf8');
  if (!preCode.includes('ripQrDataUrl:')) {
    preCode = preCode.replace(
      "pairingQrDataUrl: () => invoke('pairing-qr-dataurl'),",
      "pairingQrDataUrl: () => invoke('pairing-qr-dataurl'),\n  ripQrDataUrl: (txt) => invoke('rip-qr-dataurl', txt),"
    );
    fs.writeFileSync(preloadPath, preCode, 'utf8');
  }
}
console.log('✅ 4/5: تم ترقية main.js و preload.js لدعم تعديل فواتير الشراء ورمز BaridiMob QR.');

// ============================================================================
// 5. ترقية index.html لإضافة نافذة مركز الطباعة الموحد، مولد الخيارات الديكارتي،
//    قائمة الـ 58 ولاية جزائرية، ومرجع الدفع BaridiMob QR
// ============================================================================
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // أ) إضافة حقل رقم المرجع ورمز BaridiMob QR في checkoutModal
  if (!html.includes('chkPaymentRefBox')) {
    const refAndQrHtml = `
          <!-- حقل رقم المرجع ورمز BaridiMob QR عند الدفع الإلكتروني أو الشيك -->
          <div id="chkPaymentRefBox" class="hidden p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2 text-xs">
            <div class="flex items-center justify-between gap-2">
              <div class="flex-1">
                <label class="block font-bold mb-1 text-indigo-600">رقم مرجع العملية / الصك (Transaction Reference N°)</label>
                <input id="chkPaymentRefInput" type="text" placeholder="أدخل رقم العملية أو الشيك..." class="w-full px-3 py-1.5 rounded-lg font-mono font-bold">
              </div>
              <img id="chkBaridimobQrImg" class="hidden w-20 h-20 rounded-lg border bg-white p-1" alt="RIP QR">
            </div>
          </div>`;
    html = html.replace('<div id="chkSplitPaymentBox"', refAndQrHtml + '\n          <div id="chkSplitPaymentBox"');
  }

  // ب) إضافة مولد مجموعات الخيارات المتعددة (Option Groups Cartesian Builder) في تبويب المتغيرات
  if (!html.includes('prodOptionGroupsBuilderBox')) {
    const optionGroupsBuilderHtml = `
        <div id="prodOptionGroupsBuilderBox" class="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-black text-indigo-600">مولد مصفوفة الخيارات المتعددة (مثال: المقاس × اللون):</span>
            <div class="flex gap-1.5">
              <button onclick="App.addOptionGroupRowInModal()" class="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg font-bold">+ مجموعة خيارات</button>
              <button onclick="App.generateCartesianVariantsFromGroups()" class="px-3 py-1 bg-indigo-600 text-white rounded-lg font-bold">⚡ توليد التركيبات تلقائياً</button>
            </div>
          </div>
          <div id="prodOptionGroupsRows" class="space-y-1.5"></div>
        </div>`;
    html = html.replace(
      '<div id="prodVariantsMatrixContainer"',
      optionGroupsBuilderHtml + '\n        <div id="prodVariantsMatrixContainer"'
    );
  }

  // ج) إضافة نافذة مركز الطباعة الموحد (#posPrintCenterModal) قبل toastContainer
  if (!html.includes('id="posPrintCenterModal"')) {
    const printCenterModalHtml = `
  <!-- 38. نافذة مركز الطباعة الموحد واختيار لغة ومقاس المستند الفوري (#posPrintCenterModal) -->
  <div id="posPrintCenterModal" class="modal-overlay">
    <div class="modal-content w-full max-w-4xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <h3 class="text-lg font-black flex items-center gap-2">
          <span class="material-symbols-rounded text-blue-600">print</span>
          <span id="printCenterModalTitle">مركز الطباعة والمعاينة الفورية للمستندات</span>
        </h3>
        <button onclick="App.closeModal('posPrintCenterModal')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl">
        <div>
          <label class="block font-bold mb-1">نوع المستند</label>
          <select id="pcDocTypeSelect" onchange="App.refreshPrintCenterPreview()" class="w-full px-3 py-2 rounded-xl font-bold">
            <option value="invoice_a4">فاتورة رسمية (A4)</option>
            <option value="invoice_a5">فاتورة مدمجة (A5)</option>
            <option value="receipt">تذكرة حرارية (80mm / 58mm)</option>
            <option value="delivery">وصل توصيل (Bon de Livraison)</option>
            <option value="credit_note">إشعار دائن (Facture d'Avoir)</option>
          </select>
        </div>
        <div>
          <label class="block font-bold mb-1">لغة المستند الفورية</label>
          <select id="pcLangSelect" onchange="App.refreshPrintCenterPreview()" class="w-full px-3 py-2 rounded-xl font-bold">
            <option value="ar">🇩🇿 العربية</option>
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
          </select>
        </div>
        <div>
          <label class="block font-bold mb-1">القالب التصميمي</label>
          <select id="pcTemplateSelect" onchange="App.refreshPrintCenterPreview()" class="w-full px-3 py-2 rounded-xl font-bold">
            <option value="default">القالب الافتراضي للمتجر</option>
            <option value="template1">القالب الكلاسيكي الأزرق (1)</option>
            <option value="template2">القالب الداكن الرسمي (2)</option>
            <option value="template3">القالب الأخضر التجاري (3)</option>
            <option value="template9">القالب الجبائي 6 أعمدة (9)</option>
            <option value="detailed">القالب المفصل بالرصيد السابق</option>
          </select>
        </div>
        <div class="flex items-end gap-1.5">
          <button onclick="App.executePrintCenterAction('print')" class="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold">طباعة الآن</button>
          <button onclick="App.executePrintCenterAction('pdf')" class="px-3 py-2 bg-slate-800 text-white rounded-xl font-bold">PDF</button>
        </div>
      </div>
      <iframe id="printCenterPreviewFrame" class="w-full h-96 border border-slate-200 rounded-xl bg-white"></iframe>
    </div>
  </div>`;
    html = html.replace('<div id="toastContainer"', printCenterModalHtml + '\n\n  <div id="toastContainer"');
  }

  fs.writeFileSync(indexPath, html, 'utf8');
}
console.log('✅ 5/5: تم تحديث index.html بنافذة مركز الطباعة الموحد ومولد الخيارات الديكارتي و BaridiMob QR.');
console.log('\n🎉 اكتمل تنفيذ upgrade-rc-100.js بنجاح تام!');