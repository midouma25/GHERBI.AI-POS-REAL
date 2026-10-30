/**
 * manufacturing/manufacturing-ui.js
 * محرك عرض وتفاعل واجهة التصنيع والإنتاج (BOM Recipes & Production Orders UI)
 */

'use strict';

(function () {
  let tempRecipeComponents = [];

  async function renderManufacturingView() {
    const container = document.getElementById('manufacturing-view-root');
    if (!container || !window.ManufacturingManager) return;

    await window.ManufacturingManager.fetchAllData();
    const { recipes, orders, productsList } = window.ManufacturingManager;

    const confirmedCount = orders.filter((o) => o.status === 'confirmed').length;
    const autoRecipesCount = recipes.filter((r) => Number(r.auto_on_sale) === 1).length;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- الشريط العلوي والإحصائيات -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black">التصنيع والإنتاج (BOM)</h2>
            <p class="text-xs text-slate-500">إدارة وصفات التصنيع، خصم المواد الأولية بـ FIFO، وأوامر الإنتاج الآلية</p>
          </div>
          <div class="flex gap-2">
            <button onclick="window.ManufacturingUI.openRecipeModal()"
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow">
              <span class="material-symbols-rounded icon-sm">add_circle</span>
              <span>وصفة تصنيع جديدة</span>
            </button>
            <button onclick="window.ManufacturingUI.openQuickProduceModal()"
              class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow">
              <span class="material-symbols-rounded icon-sm">precision_manufacturing</span>
              <span>أمر إنتاج فوري</span>
            </button>
          </div>
        </div>

        <!-- بطاقات الملخص -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-500 font-bold">إجمالي وصفات التصنيع</div>
              <div class="text-2xl font-black mt-1">${recipes.length}</div>
            </div>
            <span class="material-symbols-rounded icon-lg text-blue-500">menu_book</span>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-500 font-bold">أوامر الإنتاج المنفذة</div>
              <div class="text-2xl font-black mt-1 text-emerald-600">${confirmedCount}</div>
            </div>
            <span class="material-symbols-rounded icon-lg text-emerald-500">task_alt</span>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-500 font-bold">وصفات التصنيع التلقائي عند البيع</div>
              <div class="text-2xl font-black mt-1 text-amber-500">${autoRecipesCount}</div>
            </div>
            <span class="material-symbols-rounded icon-lg text-amber-500">bolt</span>
          </div>
        </div>

        <!-- جدول الوصفات وجدول أوامر الإنتاج -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- قائمة وصفات التصنيع -->
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
            <h3 class="font-black text-base flex items-center gap-2">
              <span class="material-symbols-rounded text-blue-500">receipt_long</span>
              <span>وصفات التصنيع المعتمدة (BOM Recipes)</span>
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-right">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th class="py-2.5 px-2">الوصفة / المنتج النهائي</th>
                    <th class="py-2.5 px-2">كمية الخرج</th>
                    <th class="py-2.5 px-2">المكونات</th>
                    <th class="py-2.5 px-2">تلقائي؟</th>
                    <th class="py-2.5 px-2">إجراءات</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                  ${
                    recipes.length === 0
                      ? '<tr><td colspan="5" class="py-8 text-center text-slate-400">لا توجد وصفات تصنيع مسجلة بعد</td></tr>'
                      : recipes
                          .map(
                            (r) => `
                        <tr>
                          <td class="py-2.5 px-2">
                            <div class="font-bold text-slate-800 dark:text-slate-100">${r.name}</div>
                            <div class="text-[11px] text-slate-400">${r.product_name || ''}</div>
                          </td>
                          <td class="py-2.5 px-2 font-mono font-bold">${r.output_qty} ${r.product_unit || ''}</td>
                          <td class="py-2.5 px-2">${(r.components || []).length} مكونات</td>
                          <td class="py-2.5 px-2">
                            ${
                              Number(r.auto_on_sale) === 1
                                ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">نعم</span>'
                                : '<span class="text-slate-400">يدوي</span>'
                            }
                          </td>
                          <td class="py-2.5 px-2 flex items-center gap-1">
                            <button onclick="window.ManufacturingUI.produceFromRecipe(${r.id})"
                              class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold">إنتاج</button>
                            <button onclick="window.ManufacturingUI.deleteRecipe(${r.id})"
                              class="p-1 text-rose-500 hover:bg-rose-50 rounded-lg">
                              <span class="material-symbols-rounded icon-sm">delete</span>
                            </button>
                          </td>
                        </tr>`
                          )
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- سجل أوامر الإنتاج -->
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
            <h3 class="font-black text-base flex items-center gap-2">
              <span class="material-symbols-rounded text-emerald-500">factory</span>
              <span>سجل أوامر الإنتاج (Production Orders)</span>
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-right">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th class="py-2.5 px-2">الرقم</th>
                    <th class="py-2.5 px-2">المنتج</th>
                    <th class="py-2.5 px-2">الكمية</th>
                    <th class="py-2.5 px-2">تكلفة الوحدة</th>
                    <th class="py-2.5 px-2">الحالة</th>
                    <th class="py-2.5 px-2">إجراء</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                  ${
                    orders.length === 0
                      ? '<tr><td colspan="6" class="py-8 text-center text-slate-400">لا توجد أوامر إنتاج مسجلة</td></tr>'
                      : orders
                          .map(
                            (o) => `
                        <tr>
                          <td class="py-2.5 px-2 font-mono font-bold">${o.number || '#' + o.id}</td>
                          <td class="py-2.5 px-2 font-bold">${o.product_name || ''}</td>
                          <td class="py-2.5 px-2 font-mono">${o.produced_qty || o.planned_qty}</td>
                          <td class="py-2.5 px-2 font-mono">${Number(o.unit_cost || 0).toFixed(2)} د.ج</td>
                          <td class="py-2.5 px-2">
                            ${
                              o.status === 'confirmed'
                                ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">مؤكد</span>'
                                : o.status === 'reversed'
                                  ? '<span class="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-bold">ملغى</span>'
                                  : '<span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold">مسودة</span>'
                            }
                          </td>
                          <td class="py-2.5 px-2">
                            ${
                              o.status === 'confirmed'
                                ? `<button onclick="window.ManufacturingUI.reverseOrder(${o.id})" class="text-rose-500 hover:underline font-bold">عكس</button>`
                                : o.status === 'draft'
                                  ? `<button onclick="window.ManufacturingUI.confirmDraft(${o.id})" class="text-emerald-600 hover:underline font-bold">تأكيد</button>`
                                  : '-'
                            }
                          </td>
                        </tr>`
                          )
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function produceFromRecipe(recipeId) {
    const qtyStr = prompt('أدخل الكمية المراد إنتاجها الآن:', '1');
    const qty = parseFloat(qtyStr);
    if (!qty || qty <= 0) return;

    try {
      await window.ManufacturingManager.createAndConfirmOrder({
        recipe_id: Number(recipeId),
        planned_qty: qty,
        produced_qty: qty,
        confirmImmediately: true
      });
      await renderManufacturingView();
      if (window.showToast) window.showToast('تم تنفيذ أمر الإنتاج وإضافة الدفعة للمخزون بنجاح', 'success');
    } catch (err) {
      alert(err.message || 'تعذر تنفيذ أمر الإنتاج');
    }
  }

  async function deleteRecipe(recipeId) {
    if (!confirm('هل أنت متأكد من حذف هذه الوصفة؟')) return;
    await window.ManufacturingManager.removeRecipe(recipeId);
    await renderManufacturingView();
  }

  async function reverseOrder(orderId) {
    if (!confirm('هل تريد عكس أمر الإنتاج وإرجاع المواد الأولية للمخزون؟')) return;
    try {
      await window.ManufacturingManager.reverseOrder(orderId);
      await renderManufacturingView();
    } catch (err) {
      alert(err.message);
    }
  }

  async function confirmDraft(orderId) {
    try {
      await window.ManufacturingManager.confirmDraftOrder(orderId);
      await renderManufacturingView();
    } catch (err) {
      alert(err.message);
    }
  }

  function openRecipeModal() {
    const modal = document.getElementById('bom-recipe-modal');
    if (modal) {
      tempRecipeComponents = [];
      modal.classList.add('active');
    }
  }

  function openQuickProduceModal() {
    const recipes = (window.ManufacturingManager && window.ManufacturingManager.recipes) || [];
    if (recipes.length === 0) {
      alert('يرجى إنشاء وصفة تصنيع أولاً');
      return;
    }
    produceFromRecipe(recipes[0].id);
  }

  window.ManufacturingUI = {
    renderManufacturingView,
    produceFromRecipe,
    deleteRecipe,
    reverseOrder,
    confirmDraft,
    openRecipeModal,
    openQuickProduceModal
  };
})();