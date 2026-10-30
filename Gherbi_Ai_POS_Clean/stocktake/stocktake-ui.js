/**
 * stocktake/stocktake-ui.js
 * محرك واجهة الجرد المخزني الفعلي (Physical Stocktake & Variance Reconciliation UI)
 */

'use strict';

(function () {
  let currentSheetRows = [];
  let historyList = [];

  async function renderStocktakeView(filters = {}) {
    const container = document.getElementById('stocktake-view-root');
    if (!container || !window.api) return;

    const [sheet, stocktakes] = await Promise.all([
      window.api.getStocktakeSheet(filters).catch(() => []),
      window.api.getStocktakes({}).catch(() => [])
    ]);

    currentSheetRows = (Array.isArray(sheet) ? sheet : []).map((row) => ({
      ...row,
      counted_qty: row.book_qty
    }));
    historyList = Array.isArray(stocktakes) ? stocktakes : [];

    drawStocktakeInterface(container);
  }

  function drawStocktakeInterface(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black">الجرد المخزني الفعلي (Physical Stocktake)</h2>
            <p class="text-xs text-slate-500">مقارنة الرصيد الدفتري بالرصيد الفعلي المعدود وتسوية الفروقات آلياً</p>
          </div>
          <div class="flex gap-2">
            <button onclick="window.StocktakeUI.printBlankSheet()"
              class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
              <span class="material-symbols-rounded icon-sm">print</span>
              <span>طباعة ورقة الجرد</span>
            </button>
            <button onclick="window.StocktakeUI.commitStocktake()"
              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20">
              <span class="material-symbols-rounded icon-sm">Fact_Check</span>
              <span>اعتماد الجرد وتسوية الأرصدة</span>
            </button>
          </div>
        </div>

        <!-- جدول إدخال الجرد الحي -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="font-black text-base">ورقة العد المباشر (${currentSheetRows.length} دفعة/منتج)</h3>
            <input id="stocktakeNoteInput" type="text" placeholder="ملاحظة على جلسة الجرد (اختياري)..."
              class="w-72 px-3 py-2 rounded-xl text-xs">
          </div>

          <div class="overflow-x-auto max-h-[460px]">
            <table class="w-full text-xs text-right">
              <thead class="sticky top-0 bg-slate-100 dark:bg-slate-900">
                <tr class="text-slate-500">
                  <th class="py-2.5 px-3">المنتج</th>
                  <th class="py-2.5 px-3">الباركود</th>
                  <th class="py-2.5 px-3">الفئة</th>
                  <th class="py-2.5 px-3">الرصيد الدفتري</th>
                  <th class="py-2.5 px-3">الكمية المعدودة فعلياً</th>
                  <th class="py-2.5 px-3">الفارق</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                ${
                  currentSheetRows.length === 0
                    ? '<tr><td colspan="6" class="py-8 text-center text-slate-400">لا توجد منتجات للجرد</td></tr>'
                    : currentSheetRows
                        .map((r, idx) => {
                          const diff = Number((Number(r.counted_qty ?? r.book_qty) - Number(r.book_qty || 0)).toFixed(3));
                          const diffClass =
                            diff > 0 ? 'text-emerald-600 font-bold' : diff < 0 ? 'text-rose-500 font-bold' : 'text-slate-400';
                          return `
                            <tr>
                              <td class="py-2 px-3 font-bold">${r.product_name}</td>
                              <td class="py-2 px-3 font-mono text-slate-500">${r.barcode || '-'}</td>
                              <td class="py-2 px-3">${r.category || 'عام'}</td>
                              <td class="py-2 px-3 font-mono font-bold">${r.book_qty} ${r.unit || ''}</td>
                              <td class="py-2 px-3">
                                <input type="number" step="any" value="${r.counted_qty}"
                                  oninput="window.StocktakeUI.updateCountedQty(${idx}, this.value)"
                                  class="w-28 px-2.5 py-1.5 rounded-lg font-mono text-center font-bold">
                              </td>
                              <td id="stk-diff-${idx}" class="py-2 px-3 font-mono ${diffClass}">
                                ${diff > 0 ? '+' + diff : diff}
                              </td>
                            </tr>`;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- سجل عمليات الجرد السابقة -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3">
          <h3 class="font-black text-sm">سجل عمليات الجرد السابقة (${historyList.length})</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-right">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th class="py-2 px-2">رقم الجرد</th>
                  <th class="py-2 px-2">التاريخ</th>
                  <th class="py-2 px-2">عدد العناصر</th>
                  <th class="py-2 px-2">الفروقات المسجلة</th>
                  <th class="py-2 px-2">ملاحظة</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                ${historyList
                  .map(
                    (st) => `
                  <tr>
                    <td class="py-2 px-2 font-mono font-bold">${st.number || '#' + st.id}</td>
                    <td class="py-2 px-2 font-mono">${String(st.closed_at || st.created_at || '').slice(0, 16)}</td>
                    <td class="py-2 px-2">${st.items_count || 0}</td>
                    <td class="py-2 px-2 font-bold text-amber-500">${st.discrepancies_count || 0}</td>
                    <td class="py-2 px-2 text-slate-500">${st.note || '-'}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function updateCountedQty(index, rawValue) {
    if (!currentSheetRows[index]) return;
    const val = parseFloat(rawValue);
    currentSheetRows[index].counted_qty = Number.isFinite(val) ? val : currentSheetRows[index].book_qty;
    const diff = Number(
      (Number(currentSheetRows[index].counted_qty) - Number(currentSheetRows[index].book_qty || 0)).toFixed(3)
    );
    const cell = document.getElementById(`stk-diff-${index}`);
    if (cell) {
      cell.textContent = diff > 0 ? `+${diff}` : String(diff);
      cell.className = `py-2 px-3 font-mono ${
        diff > 0 ? 'text-emerald-600 font-bold' : diff < 0 ? 'text-rose-500 font-bold' : 'text-slate-400'
      }`;
    }
  }

  async function commitStocktake() {
    if (currentSheetRows.length === 0) return;
    if (!confirm('سيتم اعتماد الكميات المعدودة وتحديث أرصدة المخزون فعلياً. هل أنت متأكد؟')) return;

    const noteEl = document.getElementById('stocktakeNoteInput');
    const note = noteEl ? noteEl.value.trim() : '';

    try {
      await window.api.createStocktake({
        scope_type: 'all',
        note,
        applyAdjustments: true,
        items: currentSheetRows
      });
      await renderStocktakeView();
      if (window.showToast) window.showToast('تم اعتماد الجرد وتحديث الأرصدة بنجاح', 'success');
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء حفظ الجرد');
    }
  }

  function printBlankSheet() {
    const rowsHtml = currentSheetRows
      .map(
        (r, i) => `
        <tr>
          <td style="border:1px solid #000;padding:5px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid #000;padding:5px;">${r.product_name}</td>
          <td style="border:1px solid #000;padding:5px;text-align:center;">${r.barcode || ''}</td>
          <td style="border:1px solid #000;padding:5px;text-align:center;">${r.book_qty}</td>
          <td style="border:1px solid #000;padding:5px;"></td>
        </tr>`
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head><meta charset="utf-8"><title>ورقة جرد المخزون</title></head>
      <body style="font-family:Cairo,Arial,sans-serif;padding:20px;">
        <h2 style="text-align:center;">ورقة الجرد المخزني — Gherbi.Ai POS</h2>
        <p style="text-align:center;font-size:12px;">التاريخ: ${new Date().toISOString().slice(0, 10)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #000;padding:6px;">#</th>
              <th style="border:1px solid #000;padding:6px;">المنتج</th>
              <th style="border:1px solid #000;padding:6px;">الباركود</th>
              <th style="border:1px solid #000;padding:6px;">الرصيد الدفتري</th>
              <th style="border:1px solid #000;padding:6px;width:120px;">الكمية المعدودة</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>`;

    if (window.PrintEngine) {
      window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  }

  window.StocktakeUI = {
    renderStocktakeView,
    updateCountedQty,
    commitStocktake,
    printBlankSheet
  };
})();