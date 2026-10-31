/**
 * upgrade-final-backend.js
 * يحقن معالجات الـ 18% الختامية في main.js:
 * 1. lookup-warranty-serial (فحص الضمان برقم IMEI / Serial)
 * 2. import-dz-dictionary-csv & get-dz-dictionary-stats (استيراد قاعدة المنتجات الجزائرية الضخمة 613)
 * 3. get-supplier-ledger (كشف حساب المورد الشامل: مشتريات + دفعات + مرتجعات)
 * 4. get-doc-counters & update-doc-counter (تخصيص بادئات ترقيم الفواتير والمستندات)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'main.js');
if (!fs.existsSync(mainPath)) {
  console.error('❌ لم يتم العثور على main.js في المسار الحالي');
  process.exit(1);
}

let code = fs.readFileSync(mainPath, 'utf8');

const finalHandlersBlock = `
  // ============================================================================
  // [FINAL 100% UPGRADE HANDLERS]: Warranty IMEI, DZ 613 CSV, Supplier Ledger, Doc Counters
  // ============================================================================
  ipcMain.handle('lookup-warranty-serial', async (_e, rawSerial) => {
    const serial = String(rawSerial || '').trim();
    if (!serial) return null;

    const item = await dbGet(
      \`SELECT
         si.*,
         COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
         p.barcode AS product_barcode,
         p.warranty_months AS default_warranty_months,
         s.doc_number,
         s.sale_date,
         s.total AS sale_total,
         c.name AS customer_name,
         c.phone AS customer_phone
       FROM sale_items si
       INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE si.serial_number = ? COLLATE NOCASE AND si.deleted_at IS NULL
       ORDER BY si.id DESC LIMIT 1\`,
      [serial]
    );

    if (!item) return { found: false, serial };

    const months = Number(item.warranty_months || item.default_warranty_months || 12);
    const startDate = new Date(item.sale_date || Date.now());
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86400000);

    return {
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
    };
  });

  ipcMain.handle('get-dz-dictionary-stats', async () => {
    const row = await dbGet('SELECT COUNT(*) AS count FROM dz_product_dictionary');
    return { count: Number((row && row.count) || 0) };
  });

  ipcMain.handle('import-dz-dictionary-csv', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'استيراد قاموس المنتجات الجزائرية (CSV / Excel)',
      properties: ['openFile'],
      filters: [{ name: 'CSV / Excel', extensions: ['csv', 'xlsx', 'xls'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const wb = XLSX.readFile(filePaths[0], { raw: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let imported = 0;

    await db.withTransaction(async () => {
      const stmt = db._rawPrepare(
        'INSERT OR REPLACE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const r of rows) {
        const bc = String(r.barcode || r.code || r['الباركود'] || '').trim();
        const name = String(r.name || r.product_name || r['الاسم'] || '').trim();
        if (!bc || !name) continue;
        const cat = String(r.category || r['الفئة'] || 'مواد غذائية').trim().slice(0, 50);
        const brand = String(r.supplier || r.brand || r['الماركة'] || '').trim().slice(0, 50);
        const unit = String(r.unit || r['الوحدة'] || 'قطعة').trim();
        const price = Number(r.selling_price || r.suggested_price || 0) || 0;
        stmt.run(bc, name.slice(0, 120), cat, brand, unit, price);
        imported += 1;
      }
      stmt.finalize();
    });

    return { success: true, imported };
  });

  ipcMain.handle('get-supplier-ledger', async (_e, supplierId) => {
    const sid = Number(supplierId);
    const supplier = await dbGet('SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL', [sid]);
    const purchases = await dbAll(
      'SELECT * FROM purchase_invoices WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [sid]
    );
    const payments = await dbAll(
      \`SELECT ip.*, pi.invoice_number
       FROM invoice_payments ip
       LEFT JOIN purchase_invoices pi ON pi.id = ip.invoice_id
       WHERE (ip.supplier_id = ? OR pi.supplier_id = ?) AND ip.deleted_at IS NULL
       ORDER BY ip.id DESC\`,
      [sid, sid]
    );
    const returns = await dbAll(
      'SELECT * FROM supplier_returns WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [sid]
    );
    return { supplier, purchases, payments, returns };
  });

  ipcMain.handle('get-doc-counters', async () => {
    return await dbAll('SELECT * FROM document_counters ORDER BY doc_type ASC');
  });

  ipcMain.handle('update-doc-counter', async (_e, payload = {}) => {
    const docType = String(payload.doc_type || 'invoice').trim();
    const year = Number(payload.year || new Date().getFullYear());
    const lastNum = Math.max(0, parseInt(payload.last_number ?? 0, 10) || 0);
    const prefixFmt = String(payload.prefix_format || 'FAC-{YYYY}-{0000}').trim();

    await dbRun(
      \`INSERT INTO document_counters (doc_type, year, last_number, prefix_format)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(doc_type, year) DO UPDATE SET last_number = excluded.last_number, prefix_format = excluded.prefix_format\`,
      [docType, year, lastNum, prefixFmt]
    );
    return { success: true };
  });
`;

if (!code.includes("ipcMain.handle('lookup-warranty-serial'")) {
  code = code.replace(
    "ipcMain.handle('lookup-dz-barcode'",
    finalHandlersBlock + "\n  ipcMain.handle('lookup-dz-barcode'"
  );
  fs.writeFileSync(mainPath, code, 'utf8');
  console.log('✅ تم ترقية main.js بجميع معالجات الدفعة الختامية بنجاح!');
} else {
  console.log('ℹ️ معالجات الدفعة الختامية موجودة مسبقاً في main.js');
}