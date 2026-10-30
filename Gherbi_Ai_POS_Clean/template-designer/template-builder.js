/**
 * template-designer/template-builder.js
 * واجهة بناء وتخصيص القوالب المرئية ومعاينتها الحية وحفظها في قاعدة البيانات
 */

'use strict';

(function () {
  let currentLayout = window.TemplatePresets
    ? window.TemplatePresets.getPreset('modern_a4')
    : { name: 'قالب مخصص', paper: 'a4', accentColor: '#1d4ed8', columns: {} };
  let savedTemplates = [];

  const sampleDocData = {
    doc_number: 'FAC-2026-0105',
    sale_date: new Date().toISOString().slice(0, 10),
    customer_name: 'مؤسسة الأمل للتجارة',
    customer_phone: '0550123456',
    payment_method: 'نقداً',
    subtotal: 14500,
    discount: 500,
    total: 14000,
    paid_amount: 14000,
    old_balance: 2000,
    items: [
      { barcode: '6130001', product_name: 'زيت مائدة 5 لتر', quantity: 4, unit: 'قارورة', price: 650, subtotal: 2600 },
      { barcode: '6130002', product_name: 'قهوة مطحونة ممتازة 250غ', quantity: 20, unit: 'علبة', price: 320, subtotal: 6400 },
      { barcode: '6130003', product_name: 'حليب مجفف 500غ', quantity: 11, unit: 'علبة', price: 500, subtotal: 5500 }
    ]
  };

  async function initTemplateBuilder(containerId = 'template-designer-root') {
    const root = document.getElementById(containerId);
    if (!root) return;

    if (window.api && window.api.getCustomTemplates) {
      savedTemplates = (await window.api.getCustomTemplates().catch(() => [])) || [];
    }

    root.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- لوحة الخصائص -->
        <div class="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-black text-base">خصائص القالب المخصص</h3>
            <button onclick="window.TemplateBuilder.saveCurrent()"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1">
              <span class="material-symbols-rounded icon-sm">save</span>
              <span>حفظ القالب</span>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label class="block font-bold mb-1">اسم القالب</label>
              <input id="td-name" type="text" value="${currentLayout.name || 'قالب مخصص'}"
                oninput="window.TemplateBuilder.updateProp('name', this.value)"
                class="w-full px-3 py-2 rounded-xl">
            </div>
            <div>
              <label class="block font-bold mb-1">مقاس الورق</label>
              <select id="td-paper" onchange="window.TemplateBuilder.updateProp('paper', this.value)"
                class="w-full px-3 py-2 rounded-xl">
                <option value="a4" ${currentLayout.paper === 'a4' ? 'selected' : ''}>A4 قياسي</option>
                <option value="a5" ${currentLayout.paper === 'a5' ? 'selected' : ''}>A5 نصفي</option>
                <option value="thermal80" ${currentLayout.paper === 'thermal80' ? 'selected' : ''}>حراري 80mm</option>
              </select>
            </div>
            <div>
              <label class="block font-bold mb-1">اللون الرئيسي</label>
              <input id="td-color" type="color" value="${currentLayout.accentColor || '#1d4ed8'}"
                oninput="window.TemplateBuilder.updateProp('accentColor', this.value)"
                class="w-full h-9 rounded-xl cursor-pointer">
            </div>
            <div>
              <label class="block font-bold mb-1">حجم الخط (px)</label>
              <input id="td-fontsize" type="number" min="9" max="18" value="${currentLayout.fontSize || 12}"
                oninput="window.TemplateBuilder.updateProp('fontSize', Number(this.value))"
                class="w-full px-3 py-2 rounded-xl font-mono">
            </div>
          </div>

          <div class="space-y-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" ${currentLayout.showFiscal ? 'checked' : ''}
                onchange="window.TemplateBuilder.updateProp('showFiscal', this.checked)">
              <span>إظهار البيانات الجبائية للمتجر (RC / NIF / AI / NIS)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" ${currentLayout.showOldDebt ? 'checked' : ''}
                onchange="window.TemplateBuilder.updateProp('showOldDebt', this.checked)">
              <span>إظهار الرصيد السابق للزبون</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" ${currentLayout.showAmountInWords ? 'checked' : ''}
                onchange="window.TemplateBuilder.updateProp('showAmountInWords', this.checked)">
              <span>إظهار المبلغ بالحروف (التفقيط)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" ${currentLayout.showSignature ? 'checked' : ''}
                onchange="window.TemplateBuilder.updateProp('showSignature', this.checked)">
              <span>إظهار خانة الختم والإمضاء</span>
            </label>
          </div>

          <div>
            <label class="block text-xs font-bold mb-1">ملاحظة أسفل الفاتورة</label>
            <input type="text" value="${currentLayout.footerNote || ''}"
              oninput="window.TemplateBuilder.updateProp('footerNote', this.value)"
              class="w-full px-3 py-2 rounded-xl text-xs">
          </div>

          <div class="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div class="text-xs font-bold mb-2">القوالب المحفوظة (${savedTemplates.length})</div>
            <div class="flex flex-wrap gap-2">
              ${savedTemplates
                .map(
                  (t) => `
                <button onclick="window.TemplateBuilder.loadSaved(${t.id})"
                  class="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-bold hover:bg-blue-50">
                  ${t.name}
                </button>`
                )
                .join('')}
            </div>
          </div>
        </div>

        <!-- المعاينة الحية -->
        <div class="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <div class="text-xs font-bold text-slate-400 mb-2">معاينة حية ومباشرة للقالب</div>
          <iframe id="td-preview-frame" class="w-full h-[520px] border border-slate-200 rounded-xl bg-white"></iframe>
        </div>
      </div>
    `;

    refreshPreview();
  }

  function updateProp(key, val) {
    currentLayout[key] = val;
    refreshPreview();
  }

  function refreshPreview() {
    const frame = document.getElementById('td-preview-frame');
    if (!frame || !window.TemplateRenderer) return;
    const settings = (window.AppState && window.AppState.settings) || {};
    const html = window.TemplateRenderer.renderCustomTemplateHtml(currentLayout, sampleDocData, settings);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  }

  async function saveCurrent() {
    if (!window.api || !window.api.saveCustomTemplate) return;
    await window.api.saveCustomTemplate({
      id: currentLayout.id || undefined,
      name: currentLayout.name || 'قالب مخصص',
      doc_type: currentLayout.doc_type || 'invoice',
      paper: currentLayout.paper || 'a4',
      lang: currentLayout.lang || 'ar',
      layout_json: JSON.stringify(currentLayout),
      is_default: 1
    });
    if (window.showToast) window.showToast('تم حفظ القالب المخصص بنجاح', 'success');
    await initTemplateBuilder();
  }

  async function loadSaved(id) {
    const found = savedTemplates.find((x) => Number(x.id) === Number(id));
    if (!found) return;
    try {
      currentLayout = { ...JSON.parse(found.layout_json || '{}'), id: found.id, name: found.name };
      await initTemplateBuilder();
    } catch (_) {}
  }

  window.TemplateBuilder = {
    initTemplateBuilder,
    updateProp,
    refreshPreview,
    saveCurrent,
    loadSaved
  };
})();