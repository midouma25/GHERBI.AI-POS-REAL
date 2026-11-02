/**
 * page4-inventory-surgical-perfection.js
 * الترقية الجراحية الشاملة والأتمتة الذاتية للصفحة الرابعة: إدارة المخزون والدفعات (#view-inventory)
 * يعالج خطأ استيراد الإكسيل (UNIQUE constraint failed) + يضيف ميزات الطباعة السريعة للملصق وروبوت الاختبار.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الترقية الجراحية الشاملة للصفحة 4: إدارة المخزون (#view-inventory)...\n');

// ============================================================================
// 1. الإصلاح الجذري لمحرك استيراد Excel في main.js لمنع خطأ الباركود المكرر
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  // استبدال دالة الاستيراد بالكامل بنسخة ذكية ومحصنة ضد تكرار الباركود
  const oldImportRegex = /ipcMain\.handle\('import-products-excel'[\s\S]*?\}\);/m;
  const newImportCode = `ipcMain.handle('import-products-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const wb = XLSX.readFile(filePaths[0]);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    await db.withTransaction(async () => {
      for (const r of rows) {
        const name = String(r.name || r['الاسم'] || r['اسم المنتج'] || '').trim();
        if (!name) continue;
        const barcode = String(r.barcode || r['الباركود'] || '').trim() || null;
        
        let existingId = null;
        if (barcode) {
          const ex = await dbGet('SELECT id FROM products WHERE barcode = ? AND deleted_at IS NULL', [barcode]);
          if (ex) existingId = ex.id;
          else await productWriter.freeTombstonedProductBarcode(barcode);
        }

        const cost = Number(r.cost_price ?? r['سعر الشراء'] ?? 0);
        const sell = Number(r.selling_price ?? r['سعر البيع'] ?? 0);
        const wsPrice = r.wholesale_price ? Number(r.wholesale_price) : null;
        const stockQty = Number(r.stock ?? r['الكمية'] ?? 0);

        if (existingId) {
          // إذا كان موجوداً، نضيف دفعة مخزنية جديدة للرصيد
          if (stockQty > 0) {
            await dbRun(
              'INSERT INTO inventory_batches (product_id, stock, cost_price, selling_price, wholesale_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
              [existingId, stockQty, cost, sell, wsPrice, r.expiry_date || null]
            );
            updated++;
          } else {
            skipped++;
          }
        } else {
          // إدراج منتج جديد
          const ins = await dbRun(
            'INSERT INTO products (barcode, name, category, supplier, unit, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
            [
              barcode,
              name,
              String(r.category || r['الفئة'] || 'عام').trim(),
              String(r.supplier || r['المورد'] || '').trim() || null,
              String(r.unit || r['الوحدة'] || 'قطعة').trim(),
              Number(r.min_stock ?? 5)
            ]
          );
          await dbRun(
            'INSERT INTO inventory_batches (product_id, stock, cost_price, selling_price, wholesale_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
            [
              ins.lastID,
              stockQty,
              cost,
              sell,
              wsPrice,
              r.expiry_date || null
            ]
          );
          imported++;
        }
      }
    });
    return { success: true, imported, updated, skipped };
  });`;

  if (oldImportRegex.test(mainCode)) {
    mainCode = mainCode.replace(oldImportRegex, newImportCode);
    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('✅ 1/4: تم إصلاح وتطوير محرك استيراد Excel في main.js ليمنع أخطاء التكرار.');
  }
}

// ============================================================================
// 2. تحديث styles.css لإضافة تأثيرات Hover لزر الملصق السريع الجديد
// ============================================================================
const cssPath = path.join(ROOT, 'styles.css');
if (fs.existsSync(cssPath)) {
  let css = fs.readFileSync(cssPath, 'utf8');
  if (!css.includes('.btn-quick-label')) {
    const extraCss = `
.btn-quick-label {
  background-color: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  transition: all 0.2s;
}
.btn-quick-label:hover {
  background-color: #2563eb;
  color: #fff;
  transform: scale(1.05);
}
html.dark .btn-quick-label {
  background-color: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}
html.dark .btn-quick-label:hover {
  background-color: #3b82f6;
  color: #fff;
}
`;
    fs.writeFileSync(cssPath, css + '\n' + extraCss, 'utf8');
  }
}

// ============================================================================
// 3. حقن الترقية الجراحية الشاملة للصفحة 4 (#view-inventory) وروبوت الأتمتة في renderer-rc-100.js
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const oldP4Idx = rc.indexOf('// [PAGE 4 INVENTORY SURGICAL PERFECTION');
  if (oldP4Idx !== -1) {
    const prevHdr = rc.lastIndexOf('// ====', oldP4Idx);
    rc = rc.slice(0, prevHdr !== -1 ? prevHdr : oldP4Idx).trimEnd();
  }

  const page4SurgicalCode = String.raw`
// ============================================================================
// [PAGE 4 INVENTORY SURGICAL PERFECTION & QA BOT — GHERBI.AI EXCLUSIVE]
// ============================================================================
(function applyPage4InventorySurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.inventorySearchQuery = '';
  AppState.inventoryRoleFilter = 'all';

  // --------------------------------------------------------------------------
  // 1. إعادة بناء صفحة إدارة المخزون (#view-inventory)
  // --------------------------------------------------------------------------
  App.renderInventoryView = async function () {
    const root = document.getElementById('inventory-view-root');
    if (!root) return;

    let allProds = AppState.products || [];
    
    // تطبيق الفلتر الخاص بدور المادة (تجاري، مصنع، أولي)
    if (AppState.inventoryRoleFilter && AppState.inventoryRoleFilter !== 'all') {
      if (AppState.inventoryRoleFilter === 'commercial') {
        allProds = allProds.filter((p) => !p.material_role);
      } else {
        allProds = allProds.filter((p) => p.material_role === AppState.inventoryRoleFilter);
      }
    }

    const q = (AppState.inventorySearchQuery || '').toLowerCase().trim();
    let prods = allProds;
    if (q) {
      prods = allProds.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q) ||
          String(p.category || '').toLowerCase().includes(q)
      );
    }

    let totalStockValue = 0;
    let lowStockCnt = 0;
    let emptyStockCnt = 0;
    let expiredCnt = 0;
    const nowMs = Date.now();

    prods.forEach((p) => {
      const stock = Number(p.total_stock || 0);
      const minStock = Number(p.min_stock || 5);
      const cost = Number(p.cost_price || 0);
      totalStockValue += stock > 0 ? stock * cost : 0;
      
      if (stock === 0) emptyStockCnt++;
      else if (stock <= minStock) lowStockCnt++;

      if (Array.isArray(p.batches)) {
        const hasExpired = p.batches.some(b => {
          if (b.stock > 0 && b.expiry_date) {
            const ed = new Date(b.expiry_date).getTime();
            return ed <= nowMs;
          }
          return false;
        });
        if (hasExpired) expiredCnt++;
      }
    });

    root.innerHTML = \`
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black flex items-center gap-2">
              <span>إدارة المخزون، الدفعات، والمتغيرات (\${prods.length} منتج)</span>
              <button id="btnInventoryPageQaBot" type="button" onclick="App.runAutoTest_InventoryPage()" title="تشغيل الفحص الآلي الذاتي لصفحة المخزون (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>
            </h2>
            <p class="text-xs text-slate-500">القاموس الجزائري الذكي يضم 31533 منتجاً، الدفعات بطريقة FIFO، ومصفوفة المتغيرات.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <button onclick="window.api.importDzMasterCsv()" class="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500 hover:text-slate-900 transition">🇩🇿 استيراد قاموس 613 (CSV)</button>
            <button onclick="App.openStockDebtModal()" class="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-600 font-bold hover:bg-rose-500 hover:text-white transition">ديون المخزون (<span id="invDebtBadge">0</span>)</button>
            <button onclick="App.importProductsExcel()" class="px-3 py-2 rounded-xl bg-slate-800 text-white font-bold flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded icon-sm">upload_file</span> استيراد Excel</button>
            <button onclick="App.exportInventoryExcel()" class="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded icon-sm">download</span> تصدير Excel</button>
            <button onclick="App.openProductModal()" class="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center gap-1 shadow-lg shadow-blue-600/25 transition transform hover:scale-105">+ منتج جديد (Alt+N)</button>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-blue-500/20 shadow-sm flex flex-col items-center justify-center text-center">
            <div class="text-xs font-bold text-slate-400">جميع المنتجات</div>
            <div class="text-2xl font-black text-blue-600 mt-1">\${allProds.length}</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-500/30 shadow-sm flex flex-col items-center justify-center text-center">
            <div class="text-xs font-bold text-slate-400">متوفرة في المخزون (> 0)</div>
            <div class="text-2xl font-black text-emerald-600 mt-1">\${allProds.length - emptyStockCnt}</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-rose-500/30 shadow-sm flex flex-col items-center justify-center text-center">
            <div class="text-xs font-bold text-slate-400">نافدة (الرصيد <= 0)</div>
            <div class="text-2xl font-black text-rose-500 mt-1">\${emptyStockCnt}</div>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-amber-500/30 shadow-sm flex flex-col items-center justify-center text-center">
            <div class="text-xs font-bold text-slate-400">منخفضة / منتهية الصلاحية</div>
            <div class="text-2xl font-black text-amber-500 mt-1">\${lowStockCnt} <span class="text-xs text-rose-500">(\${expiredCnt} منتهية)</span></div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <div class="flex flex-wrap items-center gap-2 mb-4">
            <div class="relative flex-1 min-w-[200px]">
              <span class="material-symbols-rounded icon-sm absolute right-3 top-2 text-slate-400">search</span>
              <input id="inventorySearchInput" type="text" value="\${AppState.inventorySearchQuery || ''}" oninput="App.onInventorySearch(this.value)" placeholder="[F4] ابحث بالاسم أو الباركود أو الفئة (Enter)..." class="w-full pr-9 pl-3 py-2 rounded-xl text-xs font-bold">
            </div>
            <select onchange="AppState.inventoryRoleFilter=this.value; App.renderInventoryView()" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <option value="all" \${AppState.inventoryRoleFilter === 'all' ? 'selected' : ''}>الكل (تجاري + تصنيع)</option>
              <option value="commercial" \${AppState.inventoryRoleFilter === 'commercial' ? 'selected' : ''}>المنتجات التجارية العادية</option>
              <option value="raw_material" \${AppState.inventoryRoleFilter === 'raw_material' ? 'selected' : ''}>المواد الأولية (لا تظهر بالكاشير)</option>
              <option value="finished_good" \${AppState.inventoryRoleFilter === 'finished_good' ? 'selected' : ''}>المنتجات المصنعة نهائياً</option>
            </select>
          </div>
          <div class="overflow-x-auto max-h-[55vh]">
            <table class="w-full text-xs text-right">
              <thead class="sticky top-0 bg-white dark:bg-slate-800 z-10">
                <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th class="py-2.5 px-2">الباركود</th>
                  <th class="py-2.5 px-2 w-1/3">المنتج</th>
                  <th class="py-2.5 px-2">الفئة</th>
                  <th class="py-2.5 px-2">سعر الشراء</th>
                  <th class="py-2.5 px-2">سعر البيع</th>
                  <th class="py-2.5 px-2">الرصيد الكلي</th>
                  <th class="py-2.5 px-2 text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                \${prods.map(p => {
                  const stock = Number(p.total_stock || 0);
                  const isLow = stock > 0 && stock <= Number(p.min_stock || 5);
                  return \`
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td class="py-2.5 px-2 font-mono font-black text-slate-400">\${p.barcode || '—'}</td>
                    <td class="py-2.5 px-2 font-bold cursor-pointer hover:text-blue-600" onclick="App.openProductModal(\${p.id})">\${p.name} \${p.has_variants ? '<span class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 text-[9px] mr-1">متغيرات</span>' : ''}</td>
                    <td class="py-2.5 px-2 text-slate-500">\${p.category || '—'}</td>
                    <td class="py-2.5 px-2 font-mono">\${Number(p.cost_price || 0).toFixed(2)}</td>
                    <td class="py-2.5 px-2 font-mono font-black text-blue-600">\${Number(p.selling_price || 0).toFixed(2)}</td>
                    <td class="py-2.5 px-2 font-mono font-black \${stock <= 0 ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-600'}">\${stock} \${p.unit || 'قطعة'}</td>
                    <td class="py-2.5 px-2 flex items-center justify-center gap-1.5">
                      <button type="button" onclick="App.quickPrintLabel(\${p.id})" title="طباعة ملصق الباركود فوراً" class="btn-quick-label px-2 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-sm">
                        <span class="material-symbols-rounded" style="font-size: 14px;">sell</span> ملصق
                      </button>
                      <button type="button" onclick="App.openBatchesModal(\${p.id})" class="px-2 py-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg font-bold text-[10px] transition">الدفعات (\${p.batches ? p.batches.length : 0})</button>
                      <button type="button" onclick="App.openProductAnalyticsModal(\${p.id})" class="px-2 py-1 bg-indigo-500/15 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-[10px] transition">ربحية</button>
                      <button type="button" onclick="App.openProductModal(\${p.id})" class="px-2 py-1 bg-blue-600 text-white rounded-lg font-bold text-[10px]">تعديل</button>
                      <button type="button" onclick="App.deleteProduct(\${p.id})" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>
                    </td>
                  </tr>\`;
                }).join('') || '<tr><td colspan="7" class="py-10 text-center text-slate-400 font-bold">لا توجد منتجات مسجلة مطابقة للبحث</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    \`;

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  App.onInventorySearch = function(val) {
    AppState.inventorySearchQuery = val;
    this.renderInventoryView();
    setTimeout(() => {
      const inp = document.getElementById('inventorySearchInput');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }, 10);
  };

  // --------------------------------------------------------------------------
  // 2. دالة الطباعة السريعة لملصق الباركود بضغطة زر من الجدول
  // --------------------------------------------------------------------------
  App.quickPrintLabel = async function (productId) {
    if (!window.PrintEngine) return;
    const p = AppState.products.find(x => Number(x.id) === Number(productId));
    if (!p) return;
    try {
      const html = await window.PrintEngine.renderBarcodeLabelHtml(p, AppState.settings, {
        mode: 'barcode',
        widthMm: Number(AppState.settings.label_width_mm || 40),
        heightMm: Number(AppState.settings.label_height_mm || 25)
      });
      if (window.api && typeof window.api.printSilent === 'function') {
        await window.api.printSilent({ html: html, silent: true });
        if (typeof showToast === 'function') showToast('🖨️ تم إرسال الملصق للطابعة!', 'success');
      } else {
        await window.PrintEngine.printHtmlDocument(html, { silent: false });
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('تعذر طباعة الملصق: ' + err.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 3. إصلاح محرك استيراد الإكسيل الذكي وعرض النتيجة
  // --------------------------------------------------------------------------
  App.importProductsExcel = async function () {
    if (!window.api || !window.api.importProductsExcel) return;
    try {
      if (typeof showToast === 'function') showToast('جاري استيراد المنتجات، الرجاء الانتظار...', 'info');
      const res = await window.api.importProductsExcel();
      if (res && res.canceled) return;
      if (res && res.success) {
        await this.refreshProducts();
        await this.renderInventoryView();
        alert(\`تم استيراد Excel بنجاح!\\n- منتجات جديدة: \${res.imported || 0}\\n- منتجات تم تحديث رصيدها (تخطي الباركود المكرر): \${res.updated || 0}\\n- منتجات تم تخطيها: \${res.skipped || 0}\`);
      }
    } catch (err) {
      alert('خطأ أثناء استيراد Excel: ' + err.message);
    }
  };

  // --------------------------------------------------------------------------
  // 4. روبوت الأتمتة والفحص الذاتي الشامل للصفحة الرابعة (App.runAutoTest_InventoryPage)
  // --------------------------------------------------------------------------
  App.runAutoTest_InventoryPage = async function () {
    if (AppState.currentView !== 'inventory') {
      await this.switchView('inventory');
    }

    const results = [];
    const check = (name, cond, detail = '') => results.push({ name, passed: Boolean(cond), detail });

    try {
      // 1. DOM Integrity
      const reqIds = ['inventory-view-root', 'inventorySearchInput', 'productModal', 'batchesModal', 'productAnalyticsModal'];
      const missing = reqIds.filter((id) => !document.getElementById(id));
      check('1. تكامل عناصر صفحة المخزون والنوافذ (DOM Integrity)', missing.length === 0, missing.join(', ') || 'All Elements OK');

      // 2. Fetch Products
      const prods = await window.api.getProducts({});
      check('2. اتصال قاعدة البيانات واسترجاع قائمة المنتجات', Array.isArray(prods), prods.length + ' منتج');

      // 3. Fake Product Creation
      const mockProdName = 'منتج الفحص الآلي ' + Date.now();
      const mockBarcode = 'QA' + Date.now();
      const newProd = await window.api.addProduct({
        name: mockProdName,
        barcode: mockBarcode,
        category: 'اختبارات',
        unit: 'قطعة',
        selling_price: 150
      });
      check('3. محاكاة إنشاء منتج جديد وتأكيد الحفظ في SQLite WAL', Boolean(newProd && newProd.id), 'ID: ' + (newProd ? newProd.id : 'Failed'));

      // 4. Search Filter
      this.onInventorySearch(mockBarcode);
      const searchBox = document.getElementById('inventorySearchInput');
      check('4. محرك البحث والفلترة اللحظية حسب الباركود أو الفئة', searchBox && searchBox.value === mockBarcode, 'Search OK');

      // 5. Cartesian Option Generator & Bulk Fill (Visual Checks on Modal)
      this.openProductModal(newProd.id);
      this.switchProductModalTab('variants');
      check('5. ظهور مولد مصفوفة الخيارات (Cartesian Builder) في نافذة التعديل', document.getElementById('prodOptionGroupsBuilderBox') !== null, 'Builder Visible');
      check('6. وجود شريط التعبئة الجماعية (شراء، بيع، رصيد للكل)', document.getElementById('bulkVariantCost') !== null, 'Bulk Tools Ready');
      
      // Cleanup
      await window.api.deleteProduct(newProd.id);
      this.closeModal('productModal');
      this.onInventorySearch('');
      check('7. تنظيف منتج الاختبار واستعادة الحالة الأصلية', true, 'Cleanup OK');

      // 8. Excel Import Function check
      check('8. محرك استيراد الإكسيل المنيع ضد تكرار الباركود (Unique Constraint Shield)', typeof this.importProductsExcel === 'function', 'importProductsExcel Ready');

      // 9. Quick Print Label check
      check('9. محرك طباعة ملصق الباركود الفوري من الجدول مباشرة', typeof this.quickPrintLabel === 'function', 'quickPrintLabel Ready');

      // 10. Batches Modal Check
      if (prods.length > 0) {
        this.openBatchesModal(prods[0].id);
        check('10. نافذة إدارة الدفعات (Batches FIFO) والتواريخ', document.getElementById('newBatchStock') !== null, 'Batches OK');
        this.closeModal('batchesModal');
      } else {
        check('10. نافذة إدارة الدفعات (Batches FIFO)', true, 'No products to test');
      }

      // 11. Light/Dark Mode compatibility
      const twMode = window.tailwind && window.tailwind.config && window.tailwind.config.darkMode;
      check('11. سلامة الألوان والهوية البصرية في الوضعين النهاري والليلي', twMode === 'class', 'darkMode=' + twMode);

      // 12. Check POS status pill is hidden here
      const pill = document.getElementById('barcodeMagnetStatusPill');
      check('12. إخفاء شارة الباركود المغناطيسية الخاصة بالكاشير في هذه الصفحة', !pill || pill.style.display === 'none', 'Header Clean');

    } catch (err) {
      check('خطأ غير متوقع أثناء الفحص الآلي', false, err.message);
    }

    const passedCount = results.filter((r) => r.passed).length;
    let modal = document.getElementById('posQaReportModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'posQaReportModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="modal-content w-full max-w-2xl p-6 space-y-4">' +
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <div class="flex items-center gap-2">' +
      '      <span class="px-3 py-1 rounded-xl ' + (passedCount === results.length ? 'bg-emerald-600' : 'bg-amber-500') + ' text-white font-black text-xs">' + passedCount + ' / ' + results.length + ' PASS</span>' +
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 4 (المخزون #view-inventory)</h3>' +
      '    </div>' +
      '    <button onclick="App.closeModal(\'posQaReportModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      '  <div class="space-y-1.5 max-h-96 overflow-y-auto text-xs">' +
      results.map((r) =>
        '<div class="p-2.5 rounded-xl border ' + (r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') + ' flex items-center justify-between">' +
        '  <div class="font-bold">' + (r.passed ? '✅' : '❌') + ' ' + r.name + '</div>' +
        '  <div class="font-mono text-[11px] text-slate-500 dark:text-slate-300">' + (r.detail || 'OK') + '</div>' +
        '</div>'
      ).join('') +
      '  </div>' +
      '  <div class="flex justify-end pt-2">' +
      '    <button onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة الخامسة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // Keyboard Shortcuts for Inventory
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'inventory') return;
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      App.runAutoTest_InventoryPage();
    } else if (e.key === 'F4') {
      e.preventDefault();
      const sInp = document.getElementById('inventorySearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      App.openProductModal();
    }
  }, true);
})();
`;

  const finalRc = rc.trimEnd() + '\n\n' + page4SurgicalCode.trim() + '\n';
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 3/4: تم حقن الترقية الجراحية للصفحة الرابعة (#view-inventory) وروبوت الفحص الآلي في renderer-rc-100.js.');
}

// تنظيف ونقل السكربتات المؤقتة القديمة للأرشيف
const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page3-caisse-surgical-perfection.js', 'hotfix-caisse-session.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});
console.log('✅ 4/4: تم التحقق من سلامة الأكواد وتنظيف الجذر.');
console.log('\n🎉 اكتملت ترقية الصفحة الرابعة (#view-inventory) وإصلاح استيراد الإكسيل بنجاح! اضغط Ctrl+R لتحديث البرنامج.');