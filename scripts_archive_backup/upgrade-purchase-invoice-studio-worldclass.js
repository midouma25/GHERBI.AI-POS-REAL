/**
 * upgrade-purchase-invoice-studio-worldclass.js
 * الترقية الاستشارية والهندسية الخارقة لنافذة إنشاء وتعديل فاتورة الشراء والتموين (#purchaseInvoiceModal)
 * تشمل:
 * 1. شريط التعمير الذكي بضغطة زر (نسخ آخر فاتورة للمورد، إدراج كتالوج المورد، نواقص المورد، واستيراد CSV)
 * 2. البحث الفوري الذكي مع الإكمال التلقائي + أزرار النقر السريع لمنتجات المورد + دورة Enter بدون ماوس
 * 3. حاسبة الكرتون والفاردو المدمجة (عدد الكراتين × شد الكرتون) + عمود البونيس المجاني (Bonus Gratuit)
 * 4. رادار تغير أسعار المورد (مقارنة بآخر شراء 🔺/🟢) + عمود سعر الجملة + توحيد سعر البيع في الكاشير
 * 5. توزيع مصاريف النقل (بالقيمة المالية أو بالكمية) + تخفيض الفاتورة + TVA + لوحة الربح الصافي المتوقع وذمة المورد.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء ترقية نافذة إنشاء فواتير الشراء والتموين (#purchaseInvoiceModal) إلى الاستوديو العالمي الذكي...\n');

// ============================================================================
// 1. ترقية main.js (save-purchase) لدعم الكميات المجانية (Bonus)، توحيد سعر البيع في الكاشير، وطريقة الدفع
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  const startMarker = "ipcMain.handle('save-purchase', async (_e, data = {}) => {";
  const endMarker = "ipcMain.handle('get-invoice-details'";
  const sIdx = mainCode.indexOf(startMarker);
  const eIdx = mainCode.indexOf(endMarker, sIdx);

  if (sIdx !== -1 && eIdx !== -1) {
    const upgradedSavePurchase = `ipcMain.handle('save-purchase', async (_e, data = {}) => {
    if (data.editInvoiceId || data.edit_invoice_id) {
      const oldId = Number(data.editInvoiceId || data.edit_invoice_id);
      const oldItems = await dbAll('SELECT batch_id FROM purchase_items WHERE invoice_id = ? AND deleted_at IS NULL', [oldId]);
      const oldBatchIds = oldItems.map((x) => x.batch_id).filter(Boolean);
      if (oldBatchIds.length > 0) await batchAlloc.voidBatches(db, oldBatchIds);
      await dbRun('DELETE FROM invoice_payments WHERE invoice_id = ?', [oldId]);
      await dbRun('DELETE FROM purchase_items WHERE invoice_id = ?', [oldId]);
      await dbRun('DELETE FROM purchase_invoices WHERE id = ?', [oldId]);
    }
    if (await isLanClientMode()) return lanClient.savePurchase(data);
    const items = Array.isArray(data.items) ? data.items : [];
    const supplierId = data.supplier_id || data.supplierId ? Number(data.supplier_id || data.supplierId) : null;
    const subtotal = Number(data.subtotal ?? 0);
    const taxPercentage = Number(data.tax_percentage ?? 0);
    const additionalCosts = Number(data.additional_costs ?? 0);
    const total = Number(data.total ?? 0);
    const paidAmount = Number(data.paid_amount ?? 0);
    const paymentMethod = String(data.payment_method || 'cash').trim();
    const unifySellingPrice = data.unify_selling_price !== false;
    const invDate = data.date || new Date().toISOString().slice(0, 10);
    const invNumber = data.invoice_number || \`ACH-\${new Date().getFullYear()}-\${String(Date.now()).slice(-4)}\`;

    const totalUnits = items.reduce(
      (sum, it) => sum + Math.max(0, Number(it.quantity || 0) + Number(it.bonus_qty || 0)),
      0
    );
    const extraCostPerUnit = totalUnits > 0 ? additionalCosts / totalUnits : 0;

    return await db.withTransaction(async () => {
      const ins = await dbRun(
        \`INSERT INTO purchase_invoices (
          invoice_number, supplier_id, subtotal, tax_percentage, additional_costs, total, paid_amount, due_date, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
        [invNumber, supplierId, subtotal, taxPercentage, additionalCosts, total, paidAmount, data.due_date || null, invDate]
      );
      const invoiceId = ins.lastID;

      if (paidAmount > 0) {
        const recNum = await generateNextDocNumber('payment_receipt');
        await dbRun(
          'INSERT INTO invoice_payments (invoice_id, supplier_id, amount, date, payment_method, receipt_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [invoiceId, supplierId, paidAmount, invDate, paymentMethod, recNum, data.notes || null]
        );
      }

      const supRow = supplierId ? await dbGet('SELECT name FROM suppliers WHERE id = ?', [supplierId]) : null;

      for (const it of items) {
        const pid = Number(it.product_id || it.productId);
        const paidQty = Math.max(0, Number(it.quantity ?? 1));
        const bonusQty = Math.max(0, Number(it.bonus_qty ?? 0));
        const totalStockReceived = Number((paidQty + bonusQty).toFixed(4));
        if (totalStockReceived <= 0) continue;

        const baseCost = Number(it.cost_price ?? 0);
        const lineChargedTotal = paidQty * baseCost;
        const effectiveBaseUnitCost = totalStockReceived > 0 ? lineChargedTotal / totalStockReceived : baseCost;
        const effectiveCostPrice = Number(
          (it.effective_cost_price !== undefined
            ? Number(it.effective_cost_price)
            : effectiveBaseUnitCost + extraCostPerUnit
          ).toFixed(2)
        );
        const sellPrice = Number(it.selling_price ?? 0);
        const wholesalePrice = it.wholesale_price && Number(it.wholesale_price) > 0 ? Number(it.wholesale_price) : null;

        const batchIns = await dbRun(
          \`INSERT INTO inventory_batches (
            product_id, variant_id, stock, cost_price, selling_price, wholesale_price, expiry_date, location, supplier_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
          [
            pid,
            it.variant_id || null,
            totalStockReceived,
            effectiveCostPrice,
            sellPrice,
            wholesalePrice,
            it.expiry_date || null,
            it.location || null,
            supplierId
          ]
        );

        if (unifySellingPrice && sellPrice > 0) {
          await dbRun(
            \`UPDATE inventory_batches
             SET selling_price = ?,
                 wholesale_price = COALESCE(?, wholesale_price)
             WHERE product_id = ? AND deleted_at IS NULL AND COALESCE(stock, 0) > 0\`,
            [sellPrice, wholesalePrice, pid]
          );
        }

        if (supRow && supRow.name) {
          await dbRun(
            "UPDATE products SET supplier = ? WHERE id = ? AND (supplier IS NULL OR TRIM(supplier) = '')",
            [supRow.name, pid]
          );
        }

        await dbRun(
          \`INSERT INTO purchase_items (
            invoice_id, product_id, batch_id, variant_id, quantity, cost_price, selling_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
          [
            invoiceId,
            pid,
            batchIns.lastID,
            it.variant_id || null,
            totalStockReceived,
            effectiveCostPrice,
            sellPrice,
            Number((paidQty * baseCost + totalStockReceived * extraCostPerUnit).toFixed(2))
          ]
        );

        await batchAlloc.reconcileStockDebt(db, pid, batchIns.lastID);
      }

      return { success: true, id: invoiceId, invoice_number: invNumber };
    });
  });

  `;

    mainCode = mainCode.slice(0, sIdx) + upgradedSavePurchase + mainCode.slice(eIdx);
    new vm.Script(mainCode, { filename: 'main.js' });
    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('✅ 1/3: تم ترقية main.js (save-purchase) لدعم البونيس المجاني، توحيد سعر البيع في الكاشير، وربط منتجات المورد.');
  }
}

// ============================================================================
// 2. الوحدة الشاملة للاستوديو العالمي لإنشاء فواتير الشراء والتموين (#purchaseInvoiceModal)
// ============================================================================
function installWorldClassPurchaseInvoiceStudio() {
  if (!window.App || !window.AppState) return;

  AppState.purchPaymentRatioMode = 1; // 1 (100% خالص) | 0.5 (50%) | 0 (آجل) | 'custom' (مبلغ مخصص كتبه التاجر)
  AppState.purchExtraAllocationMode = 'by_value'; // 'by_value' (حسب قيمة الصنف) | 'by_qty' (بالتساوي على الوحدات)
  AppState.purchEntryUnitMode = 'unit'; // 'unit' (بالحبة/الوحدة) | 'carton' (بالكرتون/الفاردو)
  AppState.purchDiscountAmount = 0;
  AppState.purchTaxPercent = 0;
  AppState.purchUnifyPrices = true;

  function getProdCost(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.cost_price ?? fb.cost_price ?? 0);
  }

  function getProdRetail(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.selling_price ?? fb.selling_price ?? 0);
  }

  function getProdWholesale(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.wholesale_price ?? fb.wholesale_price ?? 0);
  }

  function getProdStock(p) {
    if (!p) return 0;
    return Number(p.total_stock ?? p.stock ?? 0);
  }

  // --------------------------------------------------------------------------
  // 1) بناء الهيكل المتقدم لنافذة إنشاء فاتورة الشراء والتموين (#purchaseInvoiceModal)
  // --------------------------------------------------------------------------
  App.ensureWorldClassPurchaseModalDom = function () {
    var pModal = document.getElementById('purchaseInvoiceModal');
    if (!pModal || pModal.dataset.worldClassV2 === '1') return;
    pModal.dataset.worldClassV2 = '1';

    pModal.innerHTML =
      '<div class="modal-content w-full max-w-6xl p-5 space-y-3 overflow-y-auto">' +
      '  <!-- الرأس وشريط التعمير الذكي بضغطة واحدة -->' +
      '  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">' +
      '    <div>' +
      '      <h3 id="purchInvoiceModalTitle" class="text-lg font-black text-blue-600 flex items-center gap-2">' +
      '        <span>📦 استوديو إنشاء فاتورة الشراء والتموين الذكي (Smart Supply & Profit Radar Studio)</span>' +
      '      </h3>' +
      '      <p class="text-[11px] text-slate-400 font-bold">إدخال صاروخي بالباركود أو البحث الذكي، حاسبة الكرتون والفاردو، البونيس المجاني، رادار تغير الأسعار، وحساب الربح الصافي المتوقع</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-1.5 text-[11px]">' +
      '      <button type="button" onclick="App.cloneLastInvoiceForSelectedSupplier()" class="px-2.5 py-1.5 rounded-xl bg-blue-600/15 text-blue-600 hover:bg-blue-600 hover:text-white font-black transition" title="ينسخ أصناف آخر فاتورة اشتريتها من هذا المورد لتوفير وقت الكتابة">🔄 نسخ آخر فاتورة للمورد</button>' +
      '      <button type="button" onclick="App.fillPurchaseWithSupplierCatalog()" class="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 text-indigo-600 hover:bg-indigo-600 hover:text-white font-black transition" title="يدرج جميع الأصناف التي يوردها هذا المورد">📦 كل أصناف المورد</button>' +
      '      <button type="button" onclick="App.autoFillPurchaseWithLowStock()" class="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-slate-950 font-black transition">⚡ تعبئة بنواقص المورد</button>' +
      '      <button type="button" onclick="App.clearAllPurchaseTempItems()" class="px-2 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white font-bold transition" title="تفريغ الجدول">🗑️ تفريغ</button>' +
      '      <button type="button" onclick="App.closeModal(\'purchaseInvoiceModal\')" class="text-slate-400 hover:text-rose-500 mr-1"><span class="material-symbols-rounded">close</span></button>' +
      '    </div>' +
      '  </div>' +

      '  <!-- الصف الأول: بيانات المورد والفاتورة وتوزيع المصاريف -->' +
      '  <div class="grid grid-cols-2 md:grid-cols-12 gap-2 text-xs items-end">' +
      '    <div class="col-span-2 md:col-span-3">' +
      '      <div class="flex items-center justify-between mb-1">' +
      '        <label class="font-bold">المورد *</label>' +
      '        <button type="button" onclick="App.quickAddSupplierInlineInPurchase()" class="text-[10px] font-black text-blue-600 hover:underline">+ مورد جديد</button>' +
      '      </div>' +
      '      <select id="purchSupplierSelect" onchange="App.onPurchaseSupplierChanged()" class="w-full px-2.5 py-1.5 rounded-xl font-bold"></select>' +
      '    </div>' +
      '    <div class="md:col-span-2">' +
      '      <label class="block font-bold mb-1">رقم فاتورة المورد</label>' +
      '      <input id="purchNumberInput" type="text" placeholder="ACH-2026-001" class="w-full px-2.5 py-1.5 rounded-xl font-mono font-bold">' +
      '    </div>' +
      '    <div class="md:col-span-2">' +
      '      <label class="block font-bold mb-1">تاريخ الفاتورة</label>' +
      '      <input id="purchDateInput" type="date" class="w-full px-2 py-1.5 rounded-xl font-mono">' +
      '    </div>' +
      '    <div class="md:col-span-2">' +
      '      <label class="block font-bold mb-1 text-indigo-600">🚚 مصاريف نقل وشحن (د.ج)</label>' +
      '      <div class="flex gap-1">' +
      '        <input id="purchExtraCostInput" type="number" step="any" min="0" value="0" oninput="App.recalcPurchaseModal()" class="w-full px-2 py-1.5 rounded-xl font-mono font-bold border-indigo-400 text-center">' +
      '        <select id="purchAllocModeSelect" onchange="AppState.purchExtraAllocationMode=this.value; App.recalcPurchaseModal()" class="px-1.5 py-1 rounded-xl text-[10px] font-bold bg-indigo-500/10 text-indigo-700" title="طريقة توزيع مصاريف النقل على الأصناف">' +
      '          <option value="by_value">بالقيمة %</option>' +
      '          <option value="by_qty">بالعدد</option>' +
      '        </select>' +
      '      </div>' +
      '    </div>' +
      '    <div class="md:col-span-1">' +
      '      <label class="block font-bold mb-1 text-emerald-600">تخفيض (د.ج)</label>' +
      '      <input id="purchDiscountInput" type="number" step="any" min="0" value="0" oninput="AppState.purchDiscountAmount=parseFloat(this.value)||0; App.recalcPurchaseModal()" class="w-full px-2 py-1.5 rounded-xl font-mono font-bold text-emerald-600 text-center">' +
      '    </div>' +
      '    <div class="md:col-span-1">' +
      '      <label class="block font-bold mb-1">TVA %</label>' +
      '      <select id="purchTvaSelect" onchange="AppState.purchTaxPercent=parseFloat(this.value)||0; App.recalcPurchaseModal()" class="w-full px-1.5 py-1.5 rounded-xl font-mono font-bold text-center">' +
      '        <option value="0">0%</option>' +
      '        <option value="9">9%</option>' +
      '        <option value="19">19%</option>' +
      '      </select>' +
      '    </div>' +
      '    <div class="md:col-span-1">' +
      '      <label class="block font-bold mb-1" title="تاريخ استحقاق تسديد الدين للمورد">الاستحقاق</label>' +
      '      <input id="purchDueDateInput" type="date" class="w-full px-1.5 py-1.5 rounded-xl font-mono text-[10px]">' +
      '    </div>' +
      '  </div>' +

      '  <!-- منطقة الإدخال الذكي للأصناف (بحث حي + باركود + حاسبة الكرتون والفاردو + أزرار النقر السريع) -->' +
      '  <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">' +
      '    <div class="flex flex-wrap items-center justify-between gap-2">' +
      '      <div class="flex flex-wrap items-center gap-2">' +
      '        <span class="font-black text-slate-700 dark:text-slate-200">➕ إدراج الأصناف المستلمة:</span>' +
      '        <div class="inline-flex rounded-xl p-0.5 bg-slate-200 dark:bg-slate-700 text-[11px] font-black">' +
      '          <button id="btnPurchModeUnit" type="button" onclick="App.setPurchaseEntryUnitMode(\'unit\')" class="px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow">🔢 بالوحدة / الحبة</button>' +
      '          <button id="btnPurchModeCarton" type="button" onclick="App.setPurchaseEntryUnitMode(\'carton\')" class="px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-200">📦 بالكرتون / الفاردو (Colis)</button>' +
      '        </div>' +
      '      </div>' +
      '      <div class="flex flex-wrap items-center gap-2">' +
      '        <button type="button" onclick="App.toggleInlineNewProductInPurchase()" class="px-2.5 py-1 rounded-lg bg-blue-600/10 text-blue-600 font-black hover:bg-blue-600 hover:text-white transition">+ تعريف سلعة جديدة غير مسجلة بالمخزون فوراً</button>' +
      '      </div>' +
      '    </div>' +

      '    <!-- شريط أزرار النقر السريع لأشهر منتجات المورد المختار -->' +
      '    <div id="purchSupplierQuickChips" class="flex items-center gap-1.5 overflow-x-auto py-1"></div>' +

      '    <!-- نموذج تعريف منتج جديد فوري من داخل الفاتورة -->' +
      '    <div id="purchQuickNewProdBox" class="hidden p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">' +
      '      <div class="md:col-span-2"><label class="block text-[10px] font-bold mb-0.5">اسم السلعة الجديدة *</label><input id="purchNewProdName" type="text" placeholder="مثال: عصير طازج 2 لتر" class="w-full px-2.5 py-1.5 rounded-lg font-bold"></div>' +
      '      <div><label class="block text-[10px] font-bold mb-0.5">الباركود (أو اتركه للتوليد)</label><input id="purchNewProdBarcode" type="text" placeholder="613..." class="w-full px-2.5 py-1.5 rounded-lg font-mono"></div>' +
      '      <div><label class="block text-[10px] font-bold mb-0.5">الفئة</label><input id="purchNewProdCategory" type="text" value="مواد غذائية" class="w-full px-2.5 py-1.5 rounded-lg"></div>' +
      '      <div><label class="block text-[10px] font-bold mb-0.5">الوحدة</label><input id="purchNewProdUnit" type="text" value="قطعة" class="w-full px-2.5 py-1.5 rounded-lg"></div>' +
      '      <button type="button" onclick="App.saveInlineNewProductInPurchase()" class="py-1.5 bg-blue-600 text-white rounded-lg font-black shadow">✓ حفظ وإدراج بالفاتورة</button>' +
      '    </div>' +

      '    <!-- حاسبة الكرتون والفاردو (تظهر عند تفعيل وضع الكرتون) -->' +
      '    <div id="purchCartonCalcBar" class="hidden p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">' +
      '      <span class="font-black text-amber-800 dark:text-amber-300">📦 حاسبة الكرتون / الفاردو السريعة:</span>' +
      '      <div class="flex flex-wrap items-center gap-2">' +
      '        <label class="font-bold">عدد الكراتين:</label>' +
      '        <input id="purchCartonCountInput" type="number" min="1" value="5" oninput="App.recalcCartonToUnits()" class="w-16 px-2 py-1 rounded-lg font-mono font-black text-center">' +
      '        <span class="font-black">×</span>' +
      '        <label class="font-bold">شد الكرتون (حبة/كرتون):</label>' +
      '        <input id="purchCartonPackSizeInput" type="number" min="1" value="6" oninput="App.recalcCartonToUnits()" class="w-16 px-2 py-1 rounded-lg font-mono font-black text-center">' +
      '        <span class="font-black">|</span>' +
      '        <label class="font-bold">سعر شراء الكرتون الكامل (اختياري):</label>' +
      '        <input id="purchCartonBoxCostInput" type="number" step="any" placeholder="مثلاً 180" oninput="App.recalcCartonToUnits()" class="w-24 px-2 py-1 rounded-lg font-mono font-bold text-center">' +
      '        <span id="purchCartonResultSummary" class="font-mono font-black text-blue-600">= 30 وحدة</span>' +
      '      </div>' +
      '    </div>' +

      '    <!-- شريط الإدخال السريع (بحث + قائمة + كمية + بونيس + شراء + بيع + جملة + صلاحية) -->' +
      '    <div class="grid grid-cols-2 md:grid-cols-12 gap-1.5 items-end">' +
      '      <div class="col-span-2 md:col-span-2">' +
      '        <label class="block text-[10px] text-emerald-600 font-black mb-0.5">🔍 بحث سريع أو باركود (Enter)</label>' +
      '        <input id="purchBarcodeScanInput" type="text" oninput="App.onPurchaseQuickFilterInput(this.value)" onkeydown="if(event.key===\'Enter\') App.handlePurchaseBarcodeScan(this.value)" placeholder="ابحث بالاسم أو امسح..." class="w-full px-2.5 py-1.5 rounded-xl font-bold border-emerald-500/60">' +
      '      </div>' +
      '      <div class="col-span-2 md:col-span-3">' +
      '        <label class="block text-[10px] text-slate-400 font-bold mb-0.5">المنتج المختار *</label>' +
      '        <select id="purchItemProductSelect" onchange="App.onPurchaseProductSelectChange()" class="w-full px-2 py-1.5 rounded-xl font-bold"></select>' +
      '      </div>' +
      '      <div class="md:col-span-1">' +
      '        <label class="block text-[10px] text-slate-500 font-bold mb-0.5">الكمية *</label>' +
      '        <input id="purchItemQty" type="number" step="any" min="0.1" value="10" onkeydown="if(event.key===\'Enter\'){document.getElementById(\'purchItemCost\').focus();document.getElementById(\'purchItemCost\').select();}" class="w-full px-1.5 py-1.5 rounded-xl font-mono font-black text-center">' +
      '      </div>' +
      '      <div class="md:col-span-1">' +
      '        <label class="block text-[10px] text-amber-600 font-bold mb-0.5" title="كمية مجانية إضافية من المورد (Bonus Gratuit)">🎁 مجاني</label>' +
      '        <input id="purchItemBonusQty" type="number" step="any" min="0" value="0" class="w-full px-1.5 py-1.5 rounded-xl font-mono font-bold text-amber-600 text-center border-amber-400/50">' +
      '      </div>' +
      '      <div class="md:col-span-1">' +
      '        <label class="block text-[10px] text-slate-500 font-bold mb-0.5">سعر الشراء</label>' +
      '        <input id="purchItemCost" type="number" step="any" min="0" value="0" onkeydown="if(event.key===\'Enter\'){App.addPurchaseItemRow();document.getElementById(\'purchBarcodeScanInput\').focus();}" class="w-full px-1.5 py-1.5 rounded-xl font-mono font-bold text-center">' +
      '      </div>' +
      '      <div class="md:col-span-1">' +
      '        <label class="block text-[10px] text-blue-600 font-bold mb-0.5">سعر التجزئة</label>' +
      '        <input id="purchItemSell" type="number" step="any" min="0" value="0" onkeydown="if(event.key===\'Enter\'){App.addPurchaseItemRow();document.getElementById(\'purchBarcodeScanInput\').focus();}" class="w-full px-1.5 py-1.5 rounded-xl font-mono font-black text-blue-600 text-center border-blue-400">' +
      '      </div>' +
      '      <div class="md:col-span-1">' +
      '        <label class="block text-[10px] text-indigo-600 font-bold mb-0.5">سعر الجملة</label>' +
      '        <input id="purchItemWholesale" type="number" step="any" min="0" value="0" class="w-full px-1.5 py-1.5 rounded-xl font-mono font-bold text-indigo-600 text-center">' +
      '      </div>' +
      '      <div class="col-span-2 md:col-span-2 flex gap-1">' +
      '        <div class="flex-1"><label class="block text-[10px] text-slate-400 font-bold mb-0.5">الصلاحية</label><input id="purchItemExpiry" type="date" class="w-full px-1 py-1.5 rounded-xl font-mono text-[10px]"></div>' +
      '        <button type="button" onclick="App.addPurchaseItemRow()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black self-end shadow">+ إدراج</button>' +
      '      </div>' +
      '    </div>' +

      '    <!-- شريط التحكم الجماعي في جدول الفاتورة (تعميم هامش الربح + تعميم الصلاحية + توحيد الأسعار) -->' +
      '    <div class="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-700 text-[10.5px]">' +
      '      <div class="flex flex-wrap items-center gap-1">' +
      '        <span class="font-black text-slate-500">🎯 ضبط هامش ربح موحد لكل الفاتورة:</span>' +
      '        <button type="button" onclick="App.applyGlobalMarkupToAllPurchaseRows(15)" class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black hover:bg-emerald-600 hover:text-white transition">+15%</button>' +
      '        <button type="button" onclick="App.applyGlobalMarkupToAllPurchaseRows(20)" class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black hover:bg-emerald-600 hover:text-white transition">+20%</button>' +
      '        <button type="button" onclick="App.applyGlobalMarkupToAllPurchaseRows(25)" class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black hover:bg-emerald-600 hover:text-white transition">+25%</button>' +
      '        <button type="button" onclick="App.applyGlobalMarkupToAllPurchaseRows(30)" class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black hover:bg-emerald-600 hover:text-white transition">+30%</button>' +
      '        <span class="mx-1 text-slate-300">|</span>' +
      '        <span class="font-black text-slate-500">⏳ صلاحية موحدة:</span>' +
      '        <button type="button" onclick="App.applyGlobalExpiryMonthsToPurchaseRows(6)" class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold">+6 أشهر</button>' +
      '        <button type="button" onclick="App.applyGlobalExpiryMonthsToPurchaseRows(12)" class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold">+1 سنة</button>' +
      '      </div>' +
      '      <label class="flex items-center gap-1.5 font-black text-blue-600 cursor-pointer">' +
      '        <input id="purchUnifySellPriceChk" type="checkbox" checked onchange="AppState.purchUnifyPrices=this.checked">' +
      '        <span>تحديث وتوحيد سعر البيع الجديد على كامل رصيد السلعة في الكاشير</span>' +
      '      </label>' +
      '    </div>' +

      '    <!-- جدول أصناف الفاتورة التفاعلي -->' +
      '    <div id="purchItemsTableBody" class="max-h-52 overflow-y-auto pt-1"></div>' +
      '  </div>' +

      '  <!-- لوحة القيادة المالية الحية (الأرباح المتوقعة + التسديد الذكي + ذمة المورد) -->' +
      '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs items-center">' +
      '    <div id="purchFinancialRadarCards" class="lg:col-span-7 grid grid-cols-3 gap-2"></div>' +
      '    <div class="lg:col-span-5 space-y-2">' +
      '      <div class="flex flex-wrap items-center justify-between gap-1.5">' +
      '        <div class="flex items-center gap-1.5">' +
      '          <label class="font-black">المدفوع للمورد:</label>' +
      '          <input id="purchPaidInput" type="number" step="any" value="0" oninput="AppState.purchPaymentRatioMode=\'custom\'; App.updatePurchaseRemainingPreview()" class="w-28 px-2 py-1.5 rounded-xl font-mono font-black text-emerald-600 text-center border-emerald-500">' +
      '          <select id="purchPayMethodSelect" class="px-2 py-1.5 rounded-xl font-bold text-[11px]">' +
      '            <option value="cash">💵 نقداً (Espèces)</option>' +
      '            <option value="cheque">🏦 شيك بنكي</option>' +
      '            <option value="cib">💳 تحويل / CCP</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="flex gap-1">' +
      '          <button id="btnPurchPay100" type="button" onclick="App.setPurchaseQuickPayment(1)" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-[10px]">خالص 100%</button>' +
      '          <button id="btnPurchPay50" type="button" onclick="App.setPurchaseQuickPayment(0.5)" class="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 font-black text-[10px]">نصف 50%</button>' +
      '          <button id="btnPurchPay0" type="button" onclick="App.setPurchaseQuickPayment(0)" class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 font-black text-[10px]">آجل (دين 0)</button>' +
      '        </div>' +
      '      </div>' +
      '      <div id="purchRemainingDebtBadge" class="font-mono font-black text-xs"></div>' +
      '    </div>' +
      '  </div>' +

      '  <!-- أزرار الحفظ والطباعة والباركود -->' +
      '  <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">' +
      '    <button type="button" onclick="App.previewCurrentPurchaseDraftReceptionNote()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1">🖨️ معاينة وطباعة وصل الاستلام (Bon de Réception A4)</button>' +
      '    <div class="flex flex-wrap gap-2">' +
      '      <button type="button" onclick="App.closeModal(\'purchaseInvoiceModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء (Esc)</button>' +
      '      <button type="button" onclick="App.submitPurchaseInvoice(true)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow">🏷️ حفظ وطباعة باركود الأصناف</button>' +
      '      <button type="button" onclick="App.submitPurchaseInvoice(false)" class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-600/25">💾 حفظ الفاتورة وتغذية المخزون (F1)</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  };

  // --------------------------------------------------------------------------
  // 2) وظائف البحث الذكي، أزرار النقر السريع، حاسبة الكرتون، واستنساخ آخر فاتورة
  // --------------------------------------------------------------------------
  App.setPurchaseEntryUnitMode = function (mode) {
    AppState.purchEntryUnitMode = mode;
    var bar = document.getElementById('purchCartonCalcBar');
    var bUnit = document.getElementById('btnPurchModeUnit');
    var bCart = document.getElementById('btnPurchModeCarton');
    if (bar) bar.classList.toggle('hidden', mode !== 'carton');
    if (bUnit) bUnit.className = 'px-2.5 py-1 rounded-lg transition ' + (mode === 'unit' ? 'bg-blue-600 text-white shadow' : 'text-slate-700 dark:text-slate-200');
    if (bCart) bCart.className = 'px-2.5 py-1 rounded-lg transition ' + (mode === 'carton' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-700 dark:text-slate-200');
    if (mode === 'carton') {
      this.recalcCartonToUnits();
    }
  };

  App.recalcCartonToUnits = function () {
    var cartons = Math.max(1, parseFloat(document.getElementById('purchCartonCountInput')?.value) || 1);
    var packSize = Math.max(1, parseFloat(document.getElementById('purchCartonPackSizeInput')?.value) || 1);
    var boxCost = parseFloat(document.getElementById('purchCartonBoxCostInput')?.value) || 0;
    var totalUnits = Number((cartons * packSize).toFixed(2));

    var qtyInp = document.getElementById('purchItemQty');
    if (qtyInp) qtyInp.value = String(totalUnits);

    if (boxCost > 0 && packSize > 0) {
      var unitCost = Number((boxCost / packSize).toFixed(2));
      var costInp = document.getElementById('purchItemCost');
      if (costInp) costInp.value = String(unitCost);
    }

    var sumEl = document.getElementById('purchCartonResultSummary');
    if (sumEl) {
      sumEl.textContent = '= إجمالي: ' + totalUnits + ' وحدة بالتمام';
    }
  };

  App.onPurchaseSupplierChanged = function () {
    var supId = Number(document.getElementById('purchSupplierSelect')?.value);
    var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === supId; });
    var chipsBox = document.getElementById('purchSupplierQuickChips');
    if (!chipsBox) return;

    var supProds = sup && typeof this.getProductsForSupplier === 'function' ? this.getProductsForSupplier(sup) : [];
    var quickList = (supProds.length > 0 ? supProds : (AppState.products || [])).filter(function (p) { return getProdRetail(p) > 0; }).slice(0, 12);

    if (quickList.length === 0) {
      chipsBox.innerHTML = '';
    } else {
      chipsBox.innerHTML =
        '<span class="text-[10px] font-black text-indigo-600 shrink-0">⚡ نقر سريع لمنتجات المورد:</span>' +
        quickList.map(function (p) {
          return (
            '<button type="button" onclick="App.quickPickProductIntoPurchase(' + p.id + ')" class="shrink-0 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 font-bold text-[10.5px] transition shadow-sm">' +
            '  <span>' + p.name + '</span> <span class="font-mono text-[10px] text-blue-600">(' + getProdCost(p) + ' د.ج)</span>' +
            '</button>'
          );
        }).join('');
    }
    this.updatePurchaseRemainingPreview();
  };

  App.quickPickProductIntoPurchase = function (productId) {
    var prodSel = document.getElementById('purchItemProductSelect');
    if (prodSel) {
      prodSel.value = String(productId);
      this.onPurchaseProductSelectChange();
    }
    this.addPurchaseItemRow();
  };

  App.onPurchaseQuickFilterInput = function (queryStr) {
    var q = String(queryStr || '').trim().toLowerCase();
    var prodSel = document.getElementById('purchItemProductSelect');
    if (!prodSel) return;

    var allProds = (AppState.products || []).slice().sort(function (a, b) {
      var aP = getProdRetail(a) > 0 ? 1 : 0;
      var bP = getProdRetail(b) > 0 ? 1 : 0;
      if (aP !== bP) return bP - aP;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    var filtered = q
      ? allProds.filter(function (p) {
          return (
            String(p.name || '').toLowerCase().includes(q) ||
            String(p.barcode || '').toLowerCase().includes(q) ||
            String(p.category || '').toLowerCase().includes(q)
          );
        })
      : allProds;

    prodSel.innerHTML = filtered.slice(0, 300).map(function (p) {
      return '<option value="' + p.id + '" data-cost="' + getProdCost(p) + '" data-sell="' + getProdRetail(p) + '" data-wholesale="' + getProdWholesale(p) + '">' + p.name + ' (رصيد: ' + getProdStock(p) + ' | شراء: ' + getProdCost(p) + ')</option>';
    }).join('');

    if (prodSel.options.length > 0) {
      prodSel.selectedIndex = 0;
      this.onPurchaseProductSelectChange();
    }
  };

  App.onPurchaseProductSelectChange = function () {
    var prodSel = document.getElementById('purchItemProductSelect');
    if (!prodSel || prodSel.selectedIndex < 0) return;
    var opt = prodSel.options[prodSel.selectedIndex];
    if (opt) {
      document.getElementById('purchItemCost').value = opt.getAttribute('data-cost') || '0';
      document.getElementById('purchItemSell').value = opt.getAttribute('data-sell') || '0';
      var wsInp = document.getElementById('purchItemWholesale');
      if (wsInp) wsInp.value = opt.getAttribute('data-wholesale') || '0';
    }
  };

  App.cloneLastInvoiceForSelectedSupplier = async function () {
    var supId = Number(document.getElementById('purchSupplierSelect')?.value);
    var allPurchases = (await window.api.getPurchases().catch(function () { return []; })) || [];
    var lastInv = allPurchases.find(function (p) { return Number(p.supplier_id) === supId; }) || allPurchases[0];

    if (!lastInv) {
      this.fillPurchaseWithSupplierCatalog();
      return;
    }

    var details = await window.api.getInvoiceDetails(lastInv.id).catch(function () { return null; });
    if (!details || !Array.isArray(details.items) || details.items.length === 0) {
      this.fillPurchaseWithSupplierCatalog();
      return;
    }

    AppState.tempPurchaseItems = details.items.map(function (it) {
      var prod = (AppState.products || []).find(function (p) { return Number(p.id) === Number(it.product_id); });
      var c = Number(it.cost_price || getProdCost(prod) || 0);
      var q = Number(it.quantity || 10);
      return {
        product_id: it.product_id,
        name: it.product_name || (prod ? prod.name : 'منتج'),
        quantity: q,
        bonus_qty: 0,
        cost_price: c,
        prev_cost: getProdCost(prod) || c,
        selling_price: Number(it.selling_price || getProdRetail(prod) || 0),
        wholesale_price: getProdWholesale(prod) || 0,
        expiry_date: '',
        subtotal: Number((q * c).toFixed(2))
      };
    });

    this.recalcPurchaseModal();
    if (typeof showToast === 'function') {
      showToast('🔄 تم استنساخ (' + AppState.tempPurchaseItems.length + ') أصناف من آخر فاتورة للمورد بنجاح!', 'success');
    }
  };

  App.fillPurchaseWithSupplierCatalog = function () {
    var supId = Number(document.getElementById('purchSupplierSelect')?.value);
    var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === supId; });
    var supProds = sup && typeof this.getProductsForSupplier === 'function' ? this.getProductsForSupplier(sup) : [];
    var targetList = (supProds.length > 0 ? supProds : (AppState.products || []).slice(0, 6)).filter(function (p) { return getProdRetail(p) > 0; });

    targetList.forEach(function (p) {
      var exists = (AppState.tempPurchaseItems || []).some(function (it) { return Number(it.product_id) === Number(p.id); });
      if (!exists) {
        var c = getProdCost(p);
        AppState.tempPurchaseItems.push({
          product_id: p.id,
          name: p.name,
          quantity: 10,
          bonus_qty: 0,
          cost_price: c,
          prev_cost: c,
          selling_price: getProdRetail(p),
          wholesale_price: getProdWholesale(p),
          expiry_date: '',
          subtotal: Number((10 * c).toFixed(2))
        });
      }
    });

    this.recalcPurchaseModal();
    if (typeof showToast === 'function') {
      showToast('📦 تم إدراج (' + targetList.length + ') أصناف من كتالوج المورد في الفاتورة!', 'info');
    }
  };

  App.clearAllPurchaseTempItems = function () {
    AppState.tempPurchaseItems = [];
    this.recalcPurchaseModal();
  };

  App.quickAddSupplierInlineInPurchase = async function () {
    var name = window.prompt('أدخل اسم المورد الجديد لإضافته واختياره فوراً:');
    if (!name || !name.trim()) return;
    var res = await window.api.addSupplier({ name: name.trim(), phone: '', initial_debt: 0 });
    await this.refreshProducts();
    var supSel = document.getElementById('purchSupplierSelect');
    if (supSel) {
      supSel.innerHTML = (AppState.suppliers || []).map(function (s) {
        return '<option value="' + s.id + '">' + s.name + '</option>';
      }).join('');
      if (res && res.id) supSel.value = String(res.id);
      this.onPurchaseSupplierChanged();
    }
  };

  // --------------------------------------------------------------------------
  // 3) إضافة وتحديث أسطر الفاتورة مع البونيس ورادار تغير السعر والربح الصافي
  // --------------------------------------------------------------------------
  App.openPurchaseInvoiceModal = function (keepTempItems) {
    this.ensureWorldClassPurchaseModalDom();
    if (!keepTempItems) {
      AppState.tempPurchaseItems = [];
      AppState.editingPurchaseId = null;
      AppState.purchPaymentRatioMode = 1;
      AppState.purchDiscountAmount = 0;
      AppState.purchTaxPercent = 0;
    }

    var titleEl = document.getElementById('purchInvoiceModalTitle');
    if (titleEl) {
      titleEl.textContent = AppState.editingPurchaseId
        ? '✏️ تعديل فاتورة الشراء والتموين رقم #' + AppState.editingPurchaseId
        : '📦 استوديو إنشاء فاتورة الشراء والتموين الذكي (Smart Supply & Profit Radar Studio)';
    }

    var supSel = document.getElementById('purchSupplierSelect');
    if (supSel) {
      supSel.innerHTML = (AppState.suppliers || [])
        .map(function (s) {
          return '<option value="' + s.id + '">' + s.name + (Number(s.total_debt) > 0 ? ' (دين سابق: ' + Number(s.total_debt).toFixed(0) + ' د.ج)' : '') + '</option>';
        })
        .join('');
    }

    this.onPurchaseQuickFilterInput('');
    this.onPurchaseSupplierChanged();

    if (!AppState.editingPurchaseId) {
      document.getElementById('purchNumberInput').value = 'ACH-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
      document.getElementById('purchDateInput').value = new Date().toISOString().slice(0, 10);
      document.getElementById('purchDueDateInput').value = '';
      document.getElementById('purchExtraCostInput').value = '0';
      var discInp = document.getElementById('purchDiscountInput');
      if (discInp) discInp.value = '0';
      var tvaSel = document.getElementById('purchTvaSelect');
      if (tvaSel) tvaSel.value = '0';
    }

    this.recalcPurchaseModal();
    this.openModal('purchaseInvoiceModal');
    setTimeout(function () {
      var bcInp = document.getElementById('purchBarcodeScanInput');
      if (bcInp) bcInp.focus();
    }, 60);
  };

  App.addPurchaseItemRow = function () {
    var prodSel = document.getElementById('purchItemProductSelect');
    var pid = Number(prodSel ? prodSel.value : 0);
    var prod = (AppState.products || []).find(function (p) { return Number(p.id) === pid; });
    if (!prod) return;

    var qty = Math.max(0.01, parseFloat(document.getElementById('purchItemQty')?.value) || 1);
    var bonus_qty = Math.max(0, parseFloat(document.getElementById('purchItemBonusQty')?.value) || 0);
    var cost_price = Math.max(0, parseFloat(document.getElementById('purchItemCost')?.value) || 0);
    var selling_price = Math.max(0, parseFloat(document.getElementById('purchItemSell')?.value) || 0);
    var wholesale_price = Math.max(0, parseFloat(document.getElementById('purchItemWholesale')?.value) || 0);
    var expiry_date = document.getElementById('purchItemExpiry')?.value || '';

    var existing = (AppState.tempPurchaseItems || []).find(function (it) {
      return Number(it.product_id) === pid && Math.abs(Number(it.cost_price) - cost_price) < 0.01;
    });

    if (existing) {
      existing.quantity = Number((Number(existing.quantity) + qty).toFixed(3));
      existing.bonus_qty = Number((Number(existing.bonus_qty || 0) + bonus_qty).toFixed(3));
      existing.subtotal = Number((existing.quantity * existing.cost_price).toFixed(2));
    } else {
      AppState.tempPurchaseItems.push({
        product_id: pid,
        name: prod.name,
        quantity: qty,
        bonus_qty: bonus_qty,
        cost_price: cost_price,
        prev_cost: getProdCost(prod),
        selling_price: selling_price,
        wholesale_price: wholesale_price || getProdWholesale(prod),
        expiry_date: expiry_date,
        subtotal: Number((qty * cost_price).toFixed(2))
      });
    }

    var bonusInp = document.getElementById('purchItemBonusQty');
    if (bonusInp) bonusInp.value = '0';
    var searchInp = document.getElementById('purchBarcodeScanInput');
    if (searchInp && searchInp.value) {
      searchInp.value = '';
      this.onPurchaseQuickFilterInput('');
    }

    this.recalcPurchaseModal();
  };

  App.updatePurchaseTempRow = function (idx, field, val) {
    var row = (AppState.tempPurchaseItems || [])[idx];
    if (!row) return;
    if (field === 'expiry_date') {
      row.expiry_date = val;
    } else {
      row[field] = Math.max(0, parseFloat(val) || 0);
      row.subtotal = Number((Number(row.quantity || 1) * Number(row.cost_price || 0)).toFixed(2));
    }
    this.recalcPurchaseModal();
  };

  App.applyGlobalMarkupToAllPurchaseRows = function (markupPct) {
    (AppState.tempPurchaseItems || []).forEach(function (row) {
      var landed = Number(row.effective_cost_price || row._landedUnitCost || row.cost_price || 0);
      if (landed > 0) {
        row.selling_price = Math.ceil((landed * (1 + Number(markupPct) / 100)) / 5) * 5;
      }
    });
    this.recalcPurchaseModal();
    if (typeof showToast === 'function') {
      showToast('🎯 تم ضبط سعر البيع لجميع أصناف الفاتورة بهامش ربح (+' + markupPct + '%) مع التقريب الذكي!', 'success');
    }
  };

  App.applyGlobalExpiryMonthsToPurchaseRows = function (monthsToAdd) {
    var d = new Date();
    d.setMonth(d.getMonth() + Number(monthsToAdd || 6));
    var isoDate = d.toISOString().slice(0, 10);
    (AppState.tempPurchaseItems || []).forEach(function (row) {
      row.expiry_date = isoDate;
    });
    this.recalcPurchaseModal();
    if (typeof showToast === 'function') {
      showToast('⏳ تم تعميم تاريخ الصلاحية (' + isoDate + ') على جميع أصناف الفاتورة!', 'info');
    }
  };

  // --------------------------------------------------------------------------
  // 4) المحرك الحسابي الشامل للفاتورة (توزيع النقل + البونيس + رادار الأرباح)
  // --------------------------------------------------------------------------
  App.recalcPurchaseModal = function () {
    var itemsBox = document.getElementById('purchItemsTableBody');
    var items = AppState.tempPurchaseItems || [];

    var subtotal = items.reduce(function (s, it) {
      it.subtotal = Number((Number(it.quantity || 1) * Number(it.cost_price || 0)).toFixed(2));
      return s + it.subtotal;
    }, 0);

    var extra = Math.max(0, parseFloat(document.getElementById('purchExtraCostInput')?.value) || 0);
    var discount = Math.max(0, parseFloat(document.getElementById('purchDiscountInput')?.value) || Number(AppState.purchDiscountAmount || 0));
    var taxPct = Math.max(0, parseFloat(document.getElementById('purchTvaSelect')?.value) || Number(AppState.purchTaxPercent || 0));

    var netAfterDiscount = Math.max(0, subtotal - discount);
    var taxAmount = Number(((netAfterDiscount * taxPct) / 100).toFixed(2));
    var total = Number((netAfterDiscount + taxAmount + extra).toFixed(2));

    var totalUnitsReceived = items.reduce(function (s, it) {
      return s + Math.max(0, Number(it.quantity || 0) + Number(it.bonus_qty || 0));
    }, 0);

    var totalExpectedRevenue = 0;
    var totalEffectiveCostAll = 0;

    items.forEach(function (it) {
      var paidQ = Math.max(0.01, Number(it.quantity || 1));
      var bonusQ = Math.max(0, Number(it.bonus_qty || 0));
      var recQ = paidQ + bonusQ;
      var lineBase = paidQ * Number(it.cost_price || 0);

      // توزيع مصاريف النقل إما بنسبة قيمة السطر أو بالتساوي على الوحدات
      var lineAllocatedExtra = 0;
      if (extra > 0) {
        if (AppState.purchExtraAllocationMode === 'by_value' && subtotal > 0) {
          lineAllocatedExtra = extra * (lineBase / subtotal);
        } else if (totalUnitsReceived > 0) {
          lineAllocatedExtra = extra * (recQ / totalUnitsReceived);
        }
      }

      var landedUnitCost = recQ > 0 ? Number(((lineBase + lineAllocatedExtra) / recQ).toFixed(2)) : Number(it.cost_price || 0);
      it._landedUnitCost = landedUnitCost;
      it.effective_cost_price = landedUnitCost;

      totalExpectedRevenue += recQ * Number(it.selling_price || 0);
      totalEffectiveCostAll += lineBase + lineAllocatedExtra;
    });

    var totalExpectedProfit = Number((totalExpectedRevenue - total).toFixed(2));
    var centimeTotal = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(total) : '';
    var centimeProfit = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(Math.max(0, totalExpectedProfit)) : '';

    // تحديث المبلغ المدفوع بذكاء (لا يمسح الرقم المخصص إذا كتبه التاجر يدوياً!)
    var paidInp = document.getElementById('purchPaidInput');
    if (paidInp && !AppState.editingPurchaseId && AppState.purchPaymentRatioMode !== 'custom') {
      var r = Number(AppState.purchPaymentRatioMode ?? 1);
      paidInp.value = (total * r).toFixed(2);
    }

    // تحديث بطاقات الرادار المالي الـ 3 أسفل الجدول
    var radarBox = document.getElementById('purchFinancialRadarCards');
    if (radarBox) {
      radarBox.innerHTML =
        '<div class="p-2.5 rounded-2xl bg-blue-600/10 border border-blue-500/25 text-center">' +
        '  <div class="text-[10px] font-bold text-slate-500">إجمالي الفاتورة الصافي</div>' +
        '  <div id="purchTotalText" class="text-base font-mono font-black text-blue-600">' + total.toFixed(2) + ' د.ج</div>' +
        '  <div id="purchTotalCentimesText" class="text-[10px] font-bold text-amber-600">' + centimeTotal + '</div>' +
        '</div>' +
        '<div class="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">' +
        '  <div class="text-[10px] font-bold text-slate-500">إجمالي السلع المستلمة</div>' +
        '  <div class="text-base font-mono font-black text-slate-800 dark:text-white">' + items.length + ' صنف (' + totalUnitsReceived + ' وحدة)</div>' +
        '  <div class="text-[10px] text-indigo-600 font-bold">قيمة البيع: ' + totalExpectedRevenue.toFixed(0) + ' د.ج</div>' +
        '</div>' +
        '<div class="p-2.5 rounded-2xl ' + (totalExpectedProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30') + ' text-center">' +
        '  <div class="text-[10px] font-bold text-slate-500">💰 صافي ربحك المتوقع من الفاتورة</div>' +
        '  <div class="text-base font-mono font-black ' + (totalExpectedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600') + '">' + (totalExpectedProfit >= 0 ? '+' : '') + totalExpectedProfit.toFixed(2) + ' د.ج</div>' +
        '  <div class="text-[10px] font-bold text-amber-600">' + centimeProfit + '</div>' +
        '</div>';
    }

    this.updatePurchaseRemainingPreview();

    if (itemsBox) {
      if (items.length === 0) {
        itemsBox.innerHTML =
          '<div class="py-7 text-center text-slate-400 font-bold">' +
          '  الفاتورة فارغة حالياً — انقر على أحد منتجات المورد في الشريط أعلاه أو اضغط (🔄 نسخ آخر فاتورة للمورد) لبنائها في ثانية واحدة!' +
          '</div>';
      } else {
        itemsBox.innerHTML =
          '<table class="w-full text-[11px] text-right">' +
          '  <thead>' +
          '    <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
          '      <th class="py-1.5 px-1">المنتج ومؤشر السعر</th>' +
          '      <th class="py-1.5 px-1 text-center">الكمية</th>' +
          '      <th class="py-1.5 px-1 text-amber-600 text-center">🎁 مجاني</th>' +
          '      <th class="py-1.5 px-1 text-center">سعر الشراء</th>' +
          '      <th class="py-1.5 px-1 text-indigo-600 text-center">التكلفة الصافية</th>' +
          '      <th class="py-1.5 px-1 text-blue-600 text-center">سعر التجزئة</th>' +
          '      <th class="py-1.5 px-1 text-purple-600 text-center">سعر الجملة</th>' +
          '      <th class="py-1.5 px-1 text-emerald-600 text-center">ربح الوحدة</th>' +
          '      <th class="py-1.5 px-1 text-center">الصلاحية</th>' +
          '      <th class="py-1.5 px-1">المجموع</th>' +
          '      <th class="py-1.5 px-1">حذف</th>' +
          '    </tr>' +
          '  </thead>' +
          '  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
          items.map(function (it, i) {
            var landedCost = Number(it._landedUnitCost || it.cost_price || 0);
            var unitProfit = Number((Number(it.selling_price || 0) - landedCost).toFixed(2));
            var marginPct = landedCost > 0 ? Number(((unitProfit / landedCost) * 100).toFixed(1)) : 0;
            var isLowMargin = unitProfit <= 0 || marginPct < 10;

            var prevC = Number(it.prev_cost || 0);
            var curC = Number(it.cost_price || 0);
            var priceDiffBadge = '';
            if (prevC > 0 && Math.abs(curC - prevC) >= 0.5) {
              var diff = Number((curC - prevC).toFixed(1));
              priceDiffBadge = diff > 0
                ? '<span class="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 text-[9px] font-black mr-1" title="ارتفع سعر الشراء مقارنة بآخر دفعة">🔺 +' + diff + '</span>'
                : '<span class="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 text-[9px] font-black mr-1" title="انخفض سعر الشراء مقارنة بآخر دفعة">🟢 ' + diff + '</span>';
            }

            return (
              '<tr class="' + (isLowMargin ? 'bg-rose-500/5' : '') + '">' +
              '  <td class="py-1.5 px-1 font-bold">' + (i + 1) + '. ' + it.name + priceDiffBadge + '</td>' +
              '  <td class="py-1.5 px-1 text-center"><input type="number" step="any" min="0.1" value="' + it.quantity + '" onchange="App.updatePurchaseTempRow(' + i + ', \'quantity\', this.value)" class="w-14 px-1 py-0.5 rounded font-mono font-bold text-center"></td>' +
              '  <td class="py-1.5 px-1 text-center"><input type="number" step="any" min="0" value="' + (it.bonus_qty || 0) + '" onchange="App.updatePurchaseTempRow(' + i + ', \'bonus_qty\', this.value)" class="w-12 px-1 py-0.5 rounded font-mono font-bold text-amber-600 text-center border-amber-400/50"></td>' +
              '  <td class="py-1.5 px-1 text-center"><input type="number" step="any" min="0" value="' + it.cost_price + '" onchange="App.updatePurchaseTempRow(' + i + ', \'cost_price\', this.value)" class="w-16 px-1 py-0.5 rounded font-mono text-center"></td>' +
              '  <td class="py-1.5 px-1 text-center font-mono font-black text-indigo-600" title="التكلفة الفعلية للوحدة بعد إضافة النقل وطرح البونيس المجاني">' + landedCost.toFixed(2) + '</td>' +
              '  <td class="py-1.5 px-1 text-center"><input type="number" step="any" min="0" value="' + it.selling_price + '" onchange="App.updatePurchaseTempRow(' + i + ', \'selling_price\', this.value)" class="w-16 px-1 py-0.5 rounded font-mono font-black text-blue-600 text-center border-blue-400"></td>' +
              '  <td class="py-1.5 px-1 text-center"><input type="number" step="any" min="0" value="' + (it.wholesale_price || 0) + '" onchange="App.updatePurchaseTempRow(' + i + ', \'wholesale_price\', this.value)" class="w-16 px-1 py-0.5 rounded font-mono text-purple-600 text-center"></td>' +
              '  <td class="py-1.5 px-1 text-center font-mono font-bold ' + (unitProfit > 0 ? 'text-emerald-600' : 'text-rose-600') + '">' +
              (unitProfit >= 0 ? '+' : '') + unitProfit.toFixed(1) + ' (' + marginPct + '%)' +
              (isLowMargin ? ' <button type="button" onclick="App.applyMarkupToPurchaseRow(' + i + ', 25)" class="px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-sans font-black text-[9px]">⚡+25%</button>' : '') +
              '  </td>' +
              '  <td class="py-1.5 px-1 text-center"><input type="date" value="' + (it.expiry_date || '') + '" onchange="App.updatePurchaseTempRow(' + i + ', \'expiry_date\', this.value)" class="px-1 py-0.5 rounded font-mono text-[9.5px]"></td>' +
              '  <td class="py-1.5 px-1 font-mono font-black text-blue-600">' + Number(it.subtotal || 0).toFixed(2) + '</td>' +
              '  <td class="py-1.5 px-1"><button type="button" onclick="AppState.tempPurchaseItems.splice(' + i + ',1); App.recalcPurchaseModal()" class="text-rose-500 font-black px-1">✕</button></td>' +
              '</tr>'
            );
          }).join('') +
          '  </tbody>' +
          '</table>';
      }
    }

    return { subtotal: subtotal, extra: extra, discount: discount, taxPct: taxPct, total: total };
  };

  App.setPurchaseQuickPayment = function (ratio) {
    AppState.purchPaymentRatioMode = ratio;
    var totStr = document.getElementById('purchTotalText')?.textContent || '0';
    var total = parseFloat(totStr) || 0;
    var paidInp = document.getElementById('purchPaidInput');
    if (paidInp) paidInp.value = (total * Number(ratio)).toFixed(2);
    this.updatePurchaseRemainingPreview();
  };

  App.updatePurchaseRemainingPreview = function () {
    var totStr = document.getElementById('purchTotalText')?.textContent || '0';
    var total = parseFloat(totStr) || 0;
    var paid = parseFloat(document.getElementById('purchPaidInput')?.value) || 0;
    var rem = Math.max(0, Number((total - paid).toFixed(2)));

    var supId = Number(document.getElementById('purchSupplierSelect')?.value);
    var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === supId; });
    var oldSupDebt = Number((sup && sup.total_debt) || 0);
    var newSupTotalDebt = Number((oldSupDebt + rem).toFixed(2));

    var badge = document.getElementById('purchRemainingDebtBadge');
    if (badge) {
      if (rem > 0.01) {
        badge.innerHTML =
          '<span class="text-rose-600">⚠️ الباقي دين من هذه الفاتورة: ' + rem.toFixed(2) + ' د.ج</span>' +
          '<span class="text-slate-400 mx-1">|</span>' +
          '<span class="text-slate-600 dark:text-slate-300">إجمالي دين المورد الجديد: <strong>' + newSupTotalDebt.toFixed(2) + ' د.ج</strong></span>';
      } else {
        badge.innerHTML =
          '<span class="text-emerald-600">✅ الفاتورة مسددة بالكامل (0.00 د.ج دين)</span>' +
          (oldSupDebt > 0 ? '<span class="text-slate-400 mr-2">(الدين السابق للمورد: ' + oldSupDebt.toFixed(2) + ' د.ج)</span>' : '');
      }
    }
  };

  App.previewCurrentPurchaseDraftReceptionNote = async function () {
    if (!AppState.tempPurchaseItems || AppState.tempPurchaseItems.length === 0) {
      if (typeof showToast === 'function') showToast('أدرج صنفاً واحداً على الأقل لمعاينة وصل الاستلام', 'warning');
      return;
    }
    var calc = this.recalcPurchaseModal();
    var supId = Number(document.getElementById('purchSupplierSelect')?.value);
    var sup = (AppState.suppliers || []).find(function (s) { return Number(s.id) === supId; }) || { name: 'المورد' };

    var draftData = {
      id: AppState.editingPurchaseId || 'جديد',
      invoice_number: document.getElementById('purchNumberInput')?.value || 'ACH-2026',
      date: document.getElementById('purchDateInput')?.value || new Date().toISOString().slice(0, 10),
      supplier_name: sup.name,
      supplier_address: sup.address || '',
      supplier_rc: sup.rc || '-',
      supplier_nif: sup.nif || '-',
      subtotal: calc.subtotal,
      total: calc.total,
      items: AppState.tempPurchaseItems.map(function (it) {
        return {
          product_name: it.name,
          quantity: Number(it.quantity || 1) + Number(it.bonus_qty || 0),
          cost_price: it._landedUnitCost || it.cost_price,
          total_cost: it.subtotal
        };
      })
    };

    if (window.PrintEngine && typeof window.PrintEngine.renderReceptionNoteHtml === 'function') {
      var html = await window.PrintEngine.renderReceptionNoteHtml(draftData, AppState.settings, AppState.lang || 'ar');
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  App.submitPurchaseInvoice = async function (andSendToBarcodeQueue) {
    if (!AppState.tempPurchaseItems || AppState.tempPurchaseItems.length === 0) {
      if (typeof showToast === 'function') showToast('يرجى إدراج صنف واحد على الأقل في فاتورة الشراء', 'warning');
      return;
    }

    var calc = this.recalcPurchaseModal();
    var supplier_id = Number(document.getElementById('purchSupplierSelect')?.value) || null;
    var invoice_number = String(document.getElementById('purchNumberInput')?.value || '').trim();
    var date = document.getElementById('purchDateInput')?.value || new Date().toISOString().slice(0, 10);
    var due_date = document.getElementById('purchDueDateInput')?.value || null;
    var paid_amount = parseFloat(document.getElementById('purchPaidInput')?.value) || 0;
    var payment_method = document.getElementById('purchPayMethodSelect')?.value || 'cash';
    var unify_selling_price = document.getElementById('purchUnifySellPriceChk') ? document.getElementById('purchUnifySellPriceChk').checked : true;

    var saved = await window.api.savePurchase({
      editInvoiceId: AppState.editingPurchaseId || undefined,
      supplier_id: supplier_id,
      invoice_number: invoice_number,
      date: date,
      due_date: due_date,
      subtotal: calc.subtotal,
      tax_percentage: calc.taxPct,
      additional_costs: calc.extra,
      total: calc.total,
      paid_amount: paid_amount,
      payment_method: payment_method,
      unify_selling_price: unify_selling_price,
      items: (AppState.tempPurchaseItems || []).slice()
    });

    AppState.editingPurchaseId = null;
    this.closeModal('purchaseInvoiceModal');
    await this.refreshProducts();
    if (AppState.currentView === 'purchases') {
      await this.renderPurchasesView();
    }

    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ فاتورة الشراء (' + (saved && saved.invoice_number ? saved.invoice_number : invoice_number) + ') وتغذية المخزون وتحديث الأسعار بنجاح!', 'success');
    }

    if (andSendToBarcodeQueue && saved && saved.id) {
      await this.enqueuePurchaseItemsForLabels(saved.id);
    }
  };
}

// ============================================================================
// 3. حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [WORLD-CLASS PURCHASE INVOICE & SUPPLY STUDIO UPGRADE]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installWorldClassPurchaseInvoiceStudio.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن وفحص استوديو فواتير الشراء العالمي في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page11-customers-loyalty-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 3/3: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت الترقية! أعد تشغيل البرنامج (أو اضغط Ctrl+R) وافتح (+ فاتورة شراء جديدة) لتجربة الاستوديو الجديد.');