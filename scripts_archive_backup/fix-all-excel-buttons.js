/**
 * fix-all-excel-buttons.js
 * الإصلاح الجذري الشامل لجميع أزرار الاستيراد والتصدير والقوالب (Excel / CSV / DZ 613)
 * في كلٍ من preload.js و main.js و renderer-rc-100.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🔧 بدء إصلاح وربط جميع محركات وأزرار Excel و CSV في النظام...\n');

// ============================================================================
// 1. ترقية preload.js لتوفير جميع الأسماء والمرادفات (Aliases) لقنوات Excel و CSV
// ============================================================================
const preloadPath = path.join(ROOT, 'preload.js');
if (fs.existsSync(preloadPath)) {
  let pre = fs.readFileSync(preloadPath, 'utf8');

  if (!pre.includes('importDzMasterCsv:')) {
    pre = pre.replace(
      "exportProductsToExcel: () => invoke('export-products-excel'),",
      "exportProductsToExcel: () => invoke('export-products-excel'),\n" +
      "  exportInventoryExcel: () => invoke('export-products-excel'),\n" +
      "  exportProductsExcel: () => invoke('export-products-excel'),\n" +
      "  importProductsExcel: () => invoke('import-products-excel'),\n" +
      "  importDzMasterCsv: (autoPath) => invoke('import-dz-master-csv', autoPath),\n" +
      "  importDzDictionaryCsv: () => invoke('import-dz-dictionary-csv'),"
    );
    new vm.Script(pre, { filename: 'preload.js' });
    fs.writeFileSync(preloadPath, pre, 'utf8');
    console.log('✅ 1/3: تم ربط جميع دوال Excel و CSV في preload.js بنجاح.');
  } else {
    console.log('✅ 1/3: ملف preload.js مربوط مسبقاً.');
  }
}

// ============================================================================
// 2. ترقية main.js لقراءة CSV/Excel بترميز UTF-8 الصحيح وبسرعة فائقة عبر Prepared Statements
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  const startIdx = mainCode.indexOf("ipcMain.handle('import-products-excel'");
  const endIdx = mainCode.indexOf("ipcMain.handle('download-inventory-template'");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const fastUtf8ExcelImport = `ipcMain.handle('import-products-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر ملف المنتجات (Excel .xlsx / .xls أو .csv)',
      properties: ['openFile'],
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const chosenPath = filePaths[0];
    let wb;
    if (chosenPath.toLowerCase().endsWith('.csv')) {
      const csvText = fs.readFileSync(chosenPath, 'utf8');
      wb = XLSX.read(csvText, { type: 'string', raw: false });
    } else {
      wb = XLSX.readFile(chosenPath, { codepage: 65001, raw: false });
    }

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    await dbRun('UPDATE products SET barcode = NULL WHERE deleted_at IS NOT NULL AND barcode IS NOT NULL');
    const existingRows = await dbAll('SELECT id, barcode FROM products WHERE deleted_at IS NULL AND barcode IS NOT NULL');
    const barcodeToIdMap = new Map();
    for (const er of existingRows) {
      if (er.barcode) barcodeToIdMap.set(String(er.barcode).trim(), Number(er.id));
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    await stockLedger.withSkipStockLedger(db, async () => {
      await db.withTransaction(async () => {
        const dzStmt = db._rawPrepare(
          'INSERT OR IGNORE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const prodStmt = db._rawPrepare(
          'INSERT OR IGNORE INTO products (barcode, name, category, family, supplier, unit, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        const batchStmt = db._rawPrepare(
          'INSERT INTO inventory_batches (product_id, stock, cost_price, selling_price, wholesale_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?)'
        );

        for (const r of rows) {
          const name = String(r.name || r.Name || r.product_name || r['الاسم'] || r['اسم المنتج'] || r.Designation || '').trim();
          if (!name) {
            skipped++;
            continue;
          }

          const rawBc = String(r.barcode || r.Barcode || r.code || r['الباركود'] || '').replace(/^"|"$/g, '').trim();
          const barcode = rawBc.length > 0 ? rawBc : null;
          const category = String(r.category || r.Category || r['الفئة'] || 'عام').trim() || 'عام';
          const family = String(r.family || r.Family || r['العائلة'] || '').trim() || null;
          const supplier = String(r.supplier || r.Supplier || r.brand || r['المورد'] || '').trim() || null;
          const unit = String(r.unit || r.Unit || r['الوحدة'] || 'قطعة').trim() || 'قطعة';
          const minStock = Math.max(0, Number(r.min_stock ?? r['الحد الأدنى'] ?? 5) || 5);
          const stockQty = Math.max(0, Number(r.stock ?? r.Stock ?? r['الكمية'] ?? 0) || 0);
          const cost = Math.max(0, Number(r.cost_price ?? r.Cost ?? r['سعر الشراء'] ?? 0) || 0);
          const sell = Math.max(0, Number(r.selling_price ?? r.Price ?? r['سعر البيع'] ?? 0) || 0);
          const wsPrice = r.wholesale_price !== undefined && r.wholesale_price !== '' ? Number(r.wholesale_price) : null;
          const expiry = r.expiry_date ? String(r.expiry_date).trim() : null;

          if (barcode && barcode.length >= 6) {
            dzStmt.run(barcode, name.slice(0, 120), category.slice(0, 60), supplier || '', unit, sell);
          }

          // إذا كان الملف هو القاموس الضخم (أكثر من 2000 سطر وأسعاره وكمياته 0) نكتفي بشحنه في القاموس الذكي + أول 500 منتج للمعاينة حتى لا يثقل جدول الكاشير بـ 31 ألف منتج صفري
          if (rows.length > 2000 && sell === 0 && cost === 0 && stockQty === 0 && imported >= 500) {
            skipped++;
            continue;
          }

          const existingId = barcode ? barcodeToIdMap.get(barcode) : null;
          if (existingId) {
            if (stockQty > 0 || cost > 0 || sell > 0) {
              batchStmt.run(existingId, stockQty, cost, sell, wsPrice, expiry);
              updated++;
            } else {
              skipped++;
            }
          } else {
            await new Promise((resolve) => {
              prodStmt.run([barcode, name, category, family, supplier, unit, minStock], function (err) {
                const newId = !err && this && this.lastID ? Number(this.lastID) : 0;
                if (newId > 0) {
                  if (barcode) barcodeToIdMap.set(barcode, newId);
                  batchStmt.run(newId, stockQty, cost, sell, wsPrice, expiry);
                  imported++;
                } else {
                  skipped++;
                }
                resolve();
              });
            });
          }
        }

        dzStmt.finalize();
        prodStmt.finalize();
        batchStmt.finalize();
      });
    });

    return { success: true, imported, updated, skipped, totalRows: rows.length };
  });`;

    mainCode = mainCode.slice(0, startIdx) + fastUtf8ExcelImport + '\n\n  ' + mainCode.slice(endIdx);
    new vm.Script(mainCode, { filename: 'main.js' });
    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('✅ 2/3: تم ترقية محرك import-products-excel في main.js لدعم UTF-8 والملفات الضخمة بسرعة فائقة.');
  }
}

// ============================================================================
// 3. حقن دوال أزرار الإكسيل الأربعة الموحدة في renderer-rc-100.js
// ============================================================================
function installUnifiedInventoryExcelHandlers() {
  if (!window.App || !window.AppState) return;

  // 1) زر استيراد Excel / CSV للمخزون
  App.importProductsExcel = async function () {
    var fn =
      (window.api && window.api.importProductsFromExcel) ||
      (window.api && window.api.importProductsExcel);
    if (typeof fn !== 'function') {
      if (typeof showToast === 'function') showToast('قناة استيراد Excel غير متاحة، أعد تشغيل التطبيق', 'error');
      return;
    }
    try {
      if (typeof showToast === 'function') showToast('⏳ جاري قراءة واستيراد ملف Excel / CSV...', 'info');
      var res = await fn();
      if (!res || res.canceled) return;
      if (res.success) {
        await this.refreshProducts();
        await this.renderInventoryView();
        var msg =
          '✅ اكتمل الاستيراد بنجاح: (' +
          (res.imported || 0) +
          ' منتج جديد | ' +
          (res.updated || 0) +
          ' دفعة محدثة | ' +
          (res.skipped || 0) +
          ' مكرر/قاموس)';
        if (typeof showToast === 'function') showToast(msg, 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('خطأ أثناء الاستيراد: ' + (err.message || err), 'error');
    }
  };
  App.importProductsFromExcel = App.importProductsExcel;

  // 2) زر تصدير المخزون إلى Excel
  App.exportInventoryExcel = async function () {
    var fn =
      (window.api && window.api.exportProductsToExcel) ||
      (window.api && window.api.exportInventoryExcel) ||
      (window.api && window.api.exportProductsExcel);
    if (typeof fn !== 'function') {
      if (typeof showToast === 'function') showToast('قناة تصدير Excel غير متاحة', 'error');
      return;
    }
    try {
      var res = await fn();
      if (!res || res.canceled) return;
      if (res.success && typeof showToast === 'function') {
        showToast('📥 تم تصدير جدول المخزون إلى ملف Excel بنجاح!', 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('خطأ أثناء التصدير: ' + (err.message || err), 'error');
    }
  };
  App.exportProductsToExcel = App.exportInventoryExcel;

  // 3) زر تحميل قالب Excel النموذجي
  App.downloadInventoryTemplate = async function () {
    var fn = window.api && window.api.downloadInventoryTemplate;
    if (typeof fn !== 'function') return;
    try {
      var res = await fn();
      if (res && res.success && typeof showToast === 'function') {
        showToast('📄 تم حفظ قالب Excel النموذجي للمخزون بنجاح!', 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('تعذر حفظ القالب: ' + (err.message || err), 'error');
    }
  };

  // 4) زر استيراد القاموس الجزائري 613 (CSV)
  App.importDzMasterCsv = async function () {
    var fn =
      (window.api && window.api.importDzMasterCsv) ||
      (window.api && window.api.importDzDictionaryCsv);
    if (typeof fn !== 'function') {
      if (typeof showToast === 'function') showToast('يرجى إعادة تشغيل npm run dev لتفعيل جسر القاموس', 'warning');
      return;
    }
    try {
      if (typeof showToast === 'function') showToast('🇩🇿 جاري شحن القاموس الجزائري (613)...', 'info');
      var res = await fn();
      if (!res || res.canceled) return;
      if (res.success && typeof showToast === 'function') {
        showToast('🇩🇿 تم استيراد ' + (res.imported || 0) + ' منتج إلى القاموس الجزائري الذكي بنجاح!', 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('تعذر استيراد القاموس: ' + (err.message || err), 'error');
    }
  };

  if (window.api && !window.api.importDzMasterCsv && window.api.importDzDictionaryCsv) {
    try {
      window.api.importDzMasterCsv = window.api.importDzDictionaryCsv;
    } catch (_) {}
  }
}

const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  // استبدال استدعاءات الأزرار في renderInventoryView لتستدعي دوال App الموحدة
  rc = rc.replace(/onclick="window\.api\.importDzMasterCsv\(\)"/g, 'onclick="App.importDzMasterCsv()"');
  rc = rc.replace(/onclick="window\.api\.downloadInventoryTemplate\(\)"/g, 'onclick="App.downloadInventoryTemplate()"');

  const oldMarker = '// [UNIFIED EXCEL & CSV BUTTONS FIX]';
  const oldIdx = rc.indexOf(oldMarker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n// [UNIFIED EXCEL & CSV BUTTONS FIX]\n(' +
    installUnifiedInventoryExcelHandlers.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 3/3: تم حقن وفحص دوال أزرار Excel الأربعة في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page4-inventory-hotfix.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 اكتمل إصلاح أزرار Excel و CSV! أعد تشغيل npm run dev الآن لتفعيل تحديث preload.js و main.js.');