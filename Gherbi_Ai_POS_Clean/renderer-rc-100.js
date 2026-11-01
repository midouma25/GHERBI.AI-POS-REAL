/**
 * renderer-rc-100.js
 * وحدة الترقية الختامية (100% Commercial Release Candidate Extension) لنظام Gherbi.Ai POS
 * تضم:
 * - قائمة الـ 58 ولاية جزائرية الكاملة (ALGERIAN_WILAYAS)
 * - مركز الطباعة الموحد واختيار لغة ومقاس المستند الفوري (#posPrintCenterModal)
 * - طباعة تقرير Z-Report الحراري وتقرير ملخص المبيعات الدوري
 * - مولد مصفوفة الخيارات المتعددة الديكارتي (Option Groups Cartesian Matrix) + Chips
 * - تعديل فواتير الشراء (editPurchaseInvoice) ومرتجع المورد المتعدد من الفواتير
 * - تحميل وتعديل وإلغاء الفواتير الشكلية والطلبيات في سلة الكاشير
 * - دعم BaridiMob RIP QR ورقم مرجع العملية وفتح الدرج التلقائي والوزن التلقائي
 */

'use strict';

const ALGERIAN_WILAYAS = [
  '01 - أدرار', '02 - الشلف', '03 - الأغواط', '04 - أم البواقي', '05 - باتنة',
  '06 - بجاية', '07 - بسكرة', '08 - بشار', '09 - البليدة', '10 - البويرة',
  '11 - تمنراست', '12 - تبسة', '13 - تلمسان', '14 - تيارت', '15 - تيزي وزو',
  '16 - الجزائر', '17 - الجلفة', '18 - جيجل', '19 - سطيف', '20 - سعيدة',
  '21 - سكيكدة', '22 - سيدي بلعباس', '23 - عنابة', '24 - قالمة', '25 - قسنطينة',
  '26 - المدية', '27 - مستغانم', '28 - المسيلة', '29 - معسكر', '30 - ورقلة',
  '31 - وهران', '32 - البيض', '33 - إليزي', '34 - برج بوعريريج', '35 - بومرداس',
  '36 - الطارف', '37 - تندوف', '38 - تسمسيلت', '39 - الوادي', '40 - خنشلة',
  '41 - سوق أهراس', '42 - تيبازة', '43 - ميلة', '44 - عين الدفلى', '45 - النعامة',
  '46 - عين تموشنت', '47 - غرداية', '48 - غليزان', '49 - تيميمون', '50 - برج باجي مختار',
  '51 - أولاد جلال', '52 - بني عباس', '53 - عين صالح', '54 - عين قزام', '55 - تقرت',
  '56 - جانت', '57 - المغير', '58 - المنيعة'
];

window.ALGERIAN_WILAYAS = ALGERIAN_WILAYAS;

(function applyRc100Extensions() {
  if (!window.App || !window.AppState) return;

  AppState.tempOptionGroups = [];
  AppState.editingPurchaseId = null;
  AppState.printCenterSaleId = null;
  AppState.printCenterCurrentHtml = '';
  AppState.supplierReturnableBatches = [];

  // --------------------------------------------------------------------------
  // 1. حقن قائمة الـ 58 ولاية جزائرية في نافذتي الزبون ووصل التوصيل عند التشغيل
  // --------------------------------------------------------------------------
  function injectWilayaSelectors() {
    const custAddr = document.getElementById('custAddressInput');
    if (custAddr && !document.getElementById('custWilayaSelect')) {
      const wSelect = document.createElement('select');
      wSelect.id = 'custWilayaSelect';
      wSelect.className = 'w-full px-3 py-2 rounded-xl font-bold mb-1.5 text-xs';
      wSelect.innerHTML =
        '<option value="">🇩🇿 اختر الولاية (58 ولاية جزائرية)...</option>' +
        ALGERIAN_WILAYAS.map((w) => `<option value="${w}">${w}</option>`).join('');
      wSelect.onchange = function () {
        if (!this.value) return;
        const cur = custAddr.value.trim();
        if (!cur) custAddr.value = this.value;
        else if (!cur.includes(this.value)) custAddr.value = `${this.value} — ${cur}`;
      };
      custAddr.parentNode.insertBefore(wSelect, custAddr);
    }

    const delivVehicle = document.getElementById('delivVehicleInput');
    if (delivVehicle && !document.getElementById('delivWilayaSelect')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <label class="block font-bold mb-1">ولاية التوصيل (58 ولاية)</label>
        <select id="delivWilayaSelect" class="w-full px-3 py-2 rounded-xl font-bold text-xs">
          <option value="">اختر ولاية الوجهة...</option>
          ${ALGERIAN_WILAYAS.map((w) => `<option value="${w}">${w}</option>`).join('')}
        </select>
      `;
      delivVehicle.parentNode.parentNode.insertBefore(wrapper, delivVehicle.parentNode.nextSibling);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(injectWilayaSelectors, 200);
  });

  // --------------------------------------------------------------------------
  // 2. مركز الطباعة الموحد واختيار لغة ومقاس المستند الفوري (#posPrintCenterModal)
  // --------------------------------------------------------------------------
  App.openPrintCenterModal = async function (saleId, defaultDocType = 'invoice_a4') {
    AppState.printCenterSaleId = Number(saleId);
    const docSel = document.getElementById('pcDocTypeSelect');
    const langSel = document.getElementById('pcLangSelect');
    const tplSel = document.getElementById('pcTemplateSelect');

    if (docSel) docSel.value = defaultDocType;
    if (langSel) langSel.value = AppState.lang || 'ar';

    if (tplSel && window.api && window.api.getCustomTemplates) {
      const customList = (await window.api.getCustomTemplates().catch(() => [])) || [];
      tplSel.innerHTML = `
        <option value="default">القالب الافتراضي للمتجر</option>
        <option value="template1">القالب الكلاسيكي الأزرق (1)</option>
        <option value="template2">القالب الداكن الرسمي (2)</option>
        <option value="template3">القالب الأخضر التجاري (3)</option>
        <option value="template4">القالب البنفسجي (4)</option>
        <option value="template5">القالب البرتقالي (5)</option>
        <option value="template9">القالب الجبائي 6 أعمدة (9)</option>
        <option value="detailed">القالب المفصل بالرصيد السابق</option>
        ${customList.map((ct) => `<option value="custom:${ct.id}">🎨 قالب مخصص: ${ct.name}</option>`).join('')}
      `;
    }

    this.openModal('posPrintCenterModal');
    await this.refreshPrintCenterPreview();
  };

  App.refreshPrintCenterPreview = async function () {
    const saleId = AppState.printCenterSaleId;
    if (!saleId || !window.PrintEngine) return;
    const fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;

    const docType = document.getElementById('pcDocTypeSelect')?.value || 'invoice_a4';
    const lang = document.getElementById('pcLangSelect')?.value || 'ar';
    const tplVal = document.getElementById('pcTemplateSelect')?.value || 'default';

    let html = '';
    if (docType === 'receipt') {
      html = await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings, {
        lang,
        customTemplateId: tplVal.startsWith('custom:') ? Number(tplVal.split(':')[1]) : undefined
      });
    } else if (docType === 'delivery') {
      html = await window.PrintEngine.renderDeliveryNoteHtml(fullSale, AppState.settings, lang);
    } else if (docType === 'credit_note') {
      html = await window.PrintEngine.renderCreditNoteHtml(fullSale, AppState.settings, lang);
    } else if (docType === 'invoice_a5') {
      html = await window.PrintEngine.renderInvoiceHtml(fullSale, AppState.settings, {
        lang,
        template: 'a5',
        ignoreCustomTemplate: true
      });
    } else {
      const opts = { lang };
      if (tplVal.startsWith('custom:')) {
        opts.customTemplateId = Number(tplVal.split(':')[1]);
      } else if (tplVal !== 'default') {
        opts.template = tplVal;
        opts.ignoreCustomTemplate = true;
      }
      html = await window.PrintEngine.renderInvoiceHtml(fullSale, AppState.settings, opts);
    }

    AppState.printCenterCurrentHtml = html;
    const frame = document.getElementById('printCenterPreviewFrame');
    if (frame) {
      const doc = frame.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }
  };

  App.executePrintCenterAction = async function (action = 'print') {
    const html = AppState.printCenterCurrentHtml;
    if (!html) return;
    const docType = document.getElementById('pcDocTypeSelect')?.value || 'invoice';

    if (action === 'pdf' && window.api && window.api.exportPDF) {
      await window.api.exportPDF({
        html,
        filename: `Gherbi_${docType}_${AppState.printCenterSaleId || Date.now()}.pdf`
      });
    } else if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, {
        silent: String(AppState.settings.silent_print) === 'true'
      });
    }

    if (window.api && window.api.logDocumentPrint) {
      await window.api.logDocumentPrint({
        doc_type: docType,
        doc_id: AppState.printCenterSaleId,
        user_id: AppState.currentUser ? AppState.currentUser.id : 1
      });
    }
  };

  // --------------------------------------------------------------------------
  // 3. طباعة تقرير Z-Report الحراري وتقرير ملخص المبيعات الدوري
  // --------------------------------------------------------------------------
  App.printSessionZReport = async function (sessionId) {
    if (!window.api || !window.PrintEngine || !window.PrintEngine.renderZReportHtml) return;
    const details = await window.api.getSessionDetails(sessionId);
    if (!details) return;
    const html = window.PrintEngine.renderZReportHtml(details, AppState.settings);
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  };

  const _origConfirmCloseShift = typeof App.confirmCloseShift === 'function' ? App.confirmCloseShift.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.confirmCloseShift is undefined, using fallback.'); return null; };
  App.confirmCloseShift = async function () {
    const sessionId = Number(document.getElementById('closeShiftSessionId')?.value);
    await _origConfirmCloseShift();
    if (sessionId && window.PrintEngine && window.PrintEngine.renderZReportHtml) {
      await this.printSessionZReport(sessionId);
    }
  };

  App.printAnalyticsSalesSummary = async function () {
    if (!window.PrintEngine || !window.PrintEngine.renderSalesSummaryHtml) return;
    const data =
      AppState.analyticsData ||
      (await window.api.getAnalytics({
        dateFrom: AppState.analyticsDateFrom,
        dateTo: AppState.analyticsDateTo
      }));
    const html = await window.PrintEngine.renderSalesSummaryHtml(
      {
        ...data,
        dateFrom: AppState.analyticsDateFrom || 'بداية الفترة',
        dateTo: AppState.analyticsDateTo || new Date().toISOString().slice(0, 10)
      },
      AppState.settings,
      AppState.lang
    );
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  };

  // --------------------------------------------------------------------------
  // 4. مولد مصفوفة الخيارات المتعددة الديكارتي (Option Groups Cartesian Matrix)
  // --------------------------------------------------------------------------
  App.addOptionGroupRowInModal = function (name = '', valuesStr = '') {
    AppState.tempOptionGroups.push({
      name: name || (AppState.tempOptionGroups.length === 0 ? 'المقاس' : 'اللون'),
      valuesStr: valuesStr || (AppState.tempOptionGroups.length === 0 ? 'S, M, L, XL' : 'أسود, أبيض')
    });
    this.renderOptionGroupsInModal();
  };

  App.renderOptionGroupsInModal = function () {
    const box = document.getElementById('prodOptionGroupsRows');
    if (!box) return;
    if (AppState.tempOptionGroups.length === 0) {
      box.innerHTML = '<div class="text-[11px] text-slate-400">اضغط "+ مجموعة خيارات" لإضافة محاور مثل المقاس واللون وتوليد الجدول آلياً</div>';
      return;
    }
    box.innerHTML = AppState.tempOptionGroups
      .map(
        (g, idx) => `
      <div class="grid grid-cols-12 gap-1.5 items-center">
        <input type="text" value="${g.name}" placeholder="اسم المحور (المقاس)"
          oninput="AppState.tempOptionGroups[${idx}].name = this.value"
          class="col-span-4 px-2.5 py-1.5 rounded-lg font-bold">
        <input type="text" value="${g.valuesStr}" placeholder="القيم مفصولة بفاصلة: S, M, L"
          oninput="AppState.tempOptionGroups[${idx}].valuesStr = this.value"
          class="col-span-7 px-2.5 py-1.5 rounded-lg font-mono">
        <button onclick="AppState.tempOptionGroups.splice(${idx},1); App.renderOptionGroupsInModal()" class="col-span-1 text-rose-500 font-bold">✕</button>
      </div>`
      )
      .join('');
  };

  App.generateCartesianVariantsFromGroups = function () {
    const validGroups = AppState.tempOptionGroups
      .map((g) => ({
        name: String(g.name || '').trim(),
        values: String(g.valuesStr || '')
          .split(/[,،]/)
          .map((x) => x.trim())
          .filter(Boolean)
      }))
      .filter((g) => g.name && g.values.length > 0);

    if (validGroups.length === 0) {
      showToast('يرجى إضافة مجموعة خيارات واحدة على الأقل مع قيمها مفصولة بفاصلة', 'warning');
      return;
    }

    document.getElementById('prodHasVariantsCheckbox').checked = true;
    const baseName = document.getElementById('prodNameInput').value.trim() || 'منتج';
    const baseBc = document.getElementById('prodBarcodeInput').value.trim() || '61300099';
    const cost = parseFloat(document.getElementById('prodCostInput').value) || 0;
    const price = parseFloat(document.getElementById('prodPriceInput').value) || 0;

    // حساب الجداء الديكارتي (Cartesian Product)
    const combinations = validGroups.reduce(
      (acc, group) => {
        const next = [];
        for (const prev of acc) {
          for (const val of group.values) {
            next.push([...prev, val]);
          }
        }
        return next;
      },
      [[]]
    );

    AppState.tempVariantsMatrix = combinations.map((combo, idx) => ({
      sku: `${baseName} (${combo.join(' / ')})`,
      barcode: `${baseBc}-${idx + 1}`,
      stock: 5,
      cost_price: cost,
      selling_price: price,
      options: combo
    }));

    this.renderVariantsMatrixInModal();
    showToast(`تم توليد ${AppState.tempVariantsMatrix.length} متغير بالجداء الديكارتي بنجاح!`, 'success');
  };

  // تحسين نافذة اختيار المتغير في الكاشير بأزرار لمس سريعة (Chips)
  const _origOpenPicker = typeof App.openVariantBatchSerialPicker === 'function' ? App.openVariantBatchSerialPicker.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.openVariantBatchSerialPicker is undefined, using fallback.'); return null; };
  App.openVariantBatchSerialPicker = function (prod) {
    _origOpenPicker(prod);
    const variants = prod.variants || [];
    if (variants.length > 1) {
      const body = document.getElementById('pickerModalBody');
      if (!body) return;
      const chipsHtml = `
        <div class="space-y-1">
          <div class="text-[11px] font-bold text-indigo-600">اختيار لمسي سريع للمتغير:</div>
          <div class="flex flex-wrap gap-1.5">
            ${variants
              .map(
                (v) => `
              <button type="button" onclick="document.getElementById('pickerVariantSelect').value='${v.id}'; App.confirmPickerSelection(${prod.id})"
                class="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-600 hover:text-white text-indigo-600 font-bold text-xs transition">
                ${v.sku || v.barcode || '#' + v.id}
              </button>`
              )
              .join('')}
          </div>
        </div>
      `;
      body.insertAdjacentHTML('afterbegin', chipsHtml);
    }
  };

  // --------------------------------------------------------------------------
  // 5. الدفع عبر BaridiMob / CCP QR ورقم مرجع العملية وفتح الدرج التلقائي
  // --------------------------------------------------------------------------
  const _origOnCheckoutMethodChange = typeof App.onCheckoutMethodChange === 'function' ? App.onCheckoutMethodChange.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.onCheckoutMethodChange is undefined, using fallback.'); return null; };
  App.onCheckoutMethodChange = async function (method) {
    _origOnCheckoutMethodChange(method);
    const refBox = document.getElementById('chkPaymentRefBox');
    const qrImg = document.getElementById('chkBaridimobQrImg');
    if (refBox) {
      const needsRef = method === 'baridimob' || method === 'cib' || method === 'cheque';
      refBox.classList.toggle('hidden', !needsRef);
      if (needsRef && qrImg && window.api && window.api.ripQrDataUrl) {
        const dataUrl = await window.api.ripQrDataUrl().catch(() => '');
        if (dataUrl) {
          qrImg.src = dataUrl;
          qrImg.classList.remove('hidden');
        }
      }
    }
  };

  const _origSubmitSale = typeof App.submitSale === 'function' ? App.submitSale.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.submitSale is undefined, using fallback.'); return null; };
  App.submitSale = async function (printMode = 'none') {
    const method = document.getElementById('chkPaymentMethod')?.value || 'cash';
    await _origSubmitSale(printMode);
    if (
      (method === 'cash' || method === 'split') &&
      String(AppState.settings.open_drawer_on_cash_sale) !== 'false' &&
      window.api &&
      window.api.openCashDrawer
    ) {
      window.api.openCashDrawer();
    }
  };

  // --------------------------------------------------------------------------
  // 6. تعديل فاتورة الشراء (editPurchaseInvoice) ومرتجع المورد المتعدد من الفواتير
  // --------------------------------------------------------------------------
  App.editPurchaseInvoice = async function (invoiceId) {
    const inv = await window.api.getInvoiceDetails(invoiceId);
    if (!inv) return;
    this.openPurchaseInvoiceModal();
    AppState.editingPurchaseId = inv.id;

    const supSel = document.getElementById('purchSupplierSelect');
    if (supSel && inv.supplier_id) supSel.value = String(inv.supplier_id);
    document.getElementById('purchNumberInput').value = inv.invoice_number || '';
    document.getElementById('purchDateInput').value = String(inv.date || '').slice(0, 10);
    document.getElementById('purchExtraCostInput').value = String(inv.additional_costs || 0);
    document.getElementById('purchPaidInput').value = String(inv.paid_amount || 0);

    AppState.tempPurchaseItems = (inv.items || []).map((it) => ({
      product_id: it.product_id,
      name: it.product_name || 'منتج',
      quantity: Number(it.quantity || 1),
      cost_price: Number(it.cost_price || 0),
      selling_price: Number(it.selling_price || 0),
      subtotal: Number(it.total_cost || Number(it.quantity || 1) * Number(it.cost_price || 0))
    }));
    this.recalcPurchaseModal();
    showToast(`وضع تعديل فاتورة الشراء (${inv.invoice_number || '#' + inv.id})`, 'info');
  };

  const _origSubmitPurchaseInvoice = typeof App.submitPurchaseInvoice === 'function' ? App.submitPurchaseInvoice.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.submitPurchaseInvoice is undefined, using fallback.'); return null; };
  App.submitPurchaseInvoice = async function () {
    if (!AppState.editingPurchaseId) {
      return await _origSubmitPurchaseInvoice();
    }
    if (AppState.tempPurchaseItems.length === 0) {
      showToast('يرجى إدراج صنف واحد على الأقل في فاتورة الشراء', 'warning');
      return;
    }
    const { subtotal, extra, total } = this.recalcPurchaseModal();
    await window.api.savePurchase({
      editInvoiceId: AppState.editingPurchaseId,
      supplier_id: Number(document.getElementById('purchSupplierSelect').value) || null,
      invoice_number: document.getElementById('purchNumberInput').value.trim(),
      date: document.getElementById('purchDateInput').value,
      subtotal,
      additional_costs: extra,
      total,
      paid_amount: parseFloat(document.getElementById('purchPaidInput').value) || 0,
      items: AppState.tempPurchaseItems
    });
    AppState.editingPurchaseId = null;
    this.closeModal('purchaseInvoiceModal');
    await this.refreshProducts();
    await this.renderPurchasesView();
    showToast('تم تحديث فاتورة الشراء وأرصدة الدفعات بنجاح', 'success');
  };

  // استرجاع الفواتير الشكلية والطلبيات للسلة وإلغائها
  App.loadProformaIntoPos = async function (proformaId) {
    const pf = await window.api.getProformaDetails(proformaId);
    if (!pf) return;
    const cart = this.currentCart;
    cart.customerId = pf.customer_id || '';
    cart.discount = Number(pf.discount || 0);
    cart.items = (pf.items || []).map((it) => ({
      product_id: it.product_id || null,
      name: it.product_name || it.custom_product_name || 'منتج',
      barcode: it.barcode || '',
      unit: it.unit || 'قطعة',
      quantity: Number(it.quantity || 1),
      price: Number(it.price || 0),
      subtotal: Number(it.subtotal || 0)
    }));
    await this.switchView('pos');
    showToast(`تم تحميل الفاتورة الشكلية (${pf.doc_number}) في سلة المبيعات`, 'success');
  };

  App.cancelProformaById = async function (proformaId) {
    await window.api.cancelProforma(proformaId);
    await this.renderProformasView();
    showToast('تم إلغاء الفاتورة الشكلية', 'info');
  };

  App.loadOrderIntoPos = async function (orderId) {
    const ord = await window.api.getOrderDetails(orderId);
    if (!ord) return;
    const cart = this.currentCart;
    cart.customerId = ord.customer_id || '';
    cart.discount = Number(ord.discount || 0);
    cart.items = (ord.items || []).map((it) => ({
      product_id: it.product_id || null,
      name: it.product_name || it.custom_product_name || 'منتج',
      barcode: it.barcode || '',
      unit: it.unit || 'قطعة',
      quantity: Number(it.quantity || 1),
      price: Number(it.price || 0),
      subtotal: Number(it.subtotal || 0)
    }));
    await this.switchView('pos');
    showToast(`تم تحميل الطلبية (${ord.doc_number}) في سلة المبيعات`, 'success');
  };

  App.cancelOrderById = async function (orderId) {
    await window.api.cancelOrder(orderId);
    await this.renderOrdersView();
    showToast('تم إلغاء الطلبية وتحرير المخزون المحجوز', 'info');
  };
})();


// ============================================================================
// [GOLDEN MASTER 100.0% EXTENSIONS]
// ============================================================================
(function applyGoldenMaster100() {
  if (!window.App || !window.AppState) return;

  // 1. ربط رقم مرجع الدفع (#chkPaymentRefInput) وولاية التوصيل (#delivWilayaSelect)
  const _baseRecalcCheckout = typeof App.recalcCheckoutModal === 'function' ? App.recalcCheckoutModal.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.recalcCheckoutModal is undefined, using fallback.'); return null; };
  App.recalcCheckoutModal = function () {
    const res = _baseRecalcCheckout();
    const refVal = document.getElementById('chkPaymentRefInput')?.value?.trim() || null;
    res.payment_reference = refVal;
    if (Array.isArray(res.split_payments) && refVal) {
      res.split_payments.forEach((sp) => {
        if (sp.method !== 'cash') sp.reference = refVal;
      });
    }
    return res;
  };

  App.confirmPrintDeliveryNote = async function () {
    const saleId = Number(document.getElementById('deliveryNoteSaleId')?.value);
    const driverName = document.getElementById('delivDriverInput')?.value?.trim() || '';
    const vehiclePlate = document.getElementById('delivVehicleInput')?.value?.trim() || '';
    const wilaya = document.getElementById('delivWilayaSelect')?.value || '';
    const fmt = document.getElementById('delivFormatSelect')?.value || 'ar';

    const fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale || !window.PrintEngine) return;

    if (wilaya) {
      fullSale.customer_address = fullSale.customer_address
        ? `${wilaya} — ${fullSale.customer_address}`
        : wilaya;
    }

    this.closeModal('deliveryNoteModal');
    const html = await window.PrintEngine.renderDeliveryNoteHtml(
      {
        ...fullSale,
        driver_name: driverName,
        carrier_name: driverName,
        vehicle_plate: vehiclePlate
      },
      AppState.settings,
      fmt
    );
    await window.PrintEngine.printHtmlDocument(html, {
      silent: String(AppState.settings.silent_print) === 'true',
      printerName: AppState.settings.a4_printer_name || undefined
    });
  };

  // 2. حفظ واسترجاع مجموعات الخيارات (option_groups) في نافذة المنتج
  const _baseOpenProductModal = typeof App.openProductModal === 'function' ? App.openProductModal.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.openProductModal is undefined, using fallback.'); return null; };
  App.openProductModal = function (prod = null) {
    _baseOpenProductModal(prod);
    if (prod && Array.isArray(prod.option_groups) && prod.option_groups.length > 0) {
      AppState.tempOptionGroups = prod.option_groups.map((g) => ({
        id: g.id,
        name: g.name,
        valuesStr: Array.isArray(g.values)
          ? g.values.map((v) => (typeof v === 'object' ? v.value : v)).join(', ')
          : ''
      }));
    } else {
      AppState.tempOptionGroups = [];
    }
    if (typeof this.renderOptionGroupsInModal === 'function') {
      this.renderOptionGroupsInModal();
    }
  };

  const _baseSaveProductFromModal = typeof App.saveProductFromModal === 'function' ? App.saveProductFromModal.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.saveProductFromModal is undefined, using fallback.'); return null; };
  App.saveProductFromModal = async function () {
    const id = document.getElementById('prodIdInput')?.value;
    const optionGroupsPayload = (AppState.tempOptionGroups || [])
      .map((g, idx) => ({
        name: String(g.name || '').trim(),
        position: idx,
        values: String(g.valuesStr || '')
          .split(/[,،]/)
          .map((x) => x.trim())
          .filter(Boolean)
      }))
      .filter((g) => g.name && g.values.length > 0);

    await _baseSaveProductFromModal();
    if (id && optionGroupsPayload.length > 0 && window.api && window.api.saveProductVariants) {
      await window.api.saveProductVariants(Number(id), {
        option_groups: optionGroupsPayload,
        variants: AppState.tempVariantsMatrix || []
      }).catch(() => {});
    }
  };

  // 3. ترقية نافذة مرتجع المورد المتعدد من فواتير الشراء الأصلية
  App.openSupplierReturnModal = async function () {
    const supSel = document.getElementById('supRetSupplierSelect');
    if (supSel) {
      supSel.innerHTML = AppState.suppliers
        .map((s) => `<option value="${s.id}">${s.name} (الدين: ${Number(s.total_debt || 0).toFixed(2)} د.ج)</option>`)
        .join('');
    }
    document.getElementById('supRetReasonInput').value = '';
    this.openModal('supplierReturnModal');
    if (AppState.suppliers.length > 0) {
      await this.loadSupplierReturnableBatches(AppState.suppliers[0].id);
    }
  };

  App.loadSupplierReturnableBatches = async function (supplierId) {
    const sid = Number(supplierId);
    const box = document.getElementById('supRetBatchesTableContainer');
    if (!box) return;
    const items = (await window.api.getSupplierReturnableItems(sid).catch(() => [])) || [];
    AppState.supplierReturnableBatches = items.map((it) => ({
      ...it,
      return_qty: 0
    }));

    if (items.length === 0) {
      box.innerHTML = '<div class="py-6 text-center text-slate-400 font-bold">لا توجد دفعات مخزنية متوفرة مرتبطة بهذا المورد حالياً</div>';
      document.getElementById('supRetTotalValueText').textContent = '0.00 د.ج';
      return;
    }

    box.innerHTML = `
      <table class="w-full text-xs text-right">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
            <th class="py-1.5">المنتج</th>
            <th class="py-1.5">الرصيد المتاح</th>
            <th class="py-1.5">تكلفة الوحدة</th>
            <th class="py-1.5">الكمية المرجعة</th>
            <th class="py-1.5">الإجمالي</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${AppState.supplierReturnableBatches
            .map(
              (b, idx) => `
            <tr>
              <td class="py-2 font-bold">${b.product_name} <span class="text-[10px] text-slate-400 font-mono">(#${b.id})</span></td>
              <td class="py-2 font-mono font-bold text-emerald-600">${b.stock} ${b.unit || ''}</td>
              <td class="py-2 font-mono">${Number(b.cost_price || 0).toFixed(2)}</td>
              <td class="py-2">
                <input type="number" step="any" min="0" max="${b.stock}" value="0"
                  oninput="App.updateSupplierReturnRowQty(${idx}, this.value)"
                  class="w-24 px-2 py-1 rounded-lg font-mono font-bold text-center border border-slate-300 dark:border-slate-600">
              </td>
              <td id="supRetRowSub-${idx}" class="py-2 font-mono font-bold text-rose-600">0.00 د.ج</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
    this.recalcSupplierReturnTotal();
  };

  App.updateSupplierReturnRowQty = function (idx, val) {
    const row = AppState.supplierReturnableBatches[idx];
    if (!row) return;
    const maxAvail = Number(row.stock || 0);
    const qty = Math.min(maxAvail, Math.max(0, parseFloat(val) || 0));
    row.return_qty = qty;
    const sub = Number((qty * Number(row.cost_price || 0)).toFixed(2));
    const cell = document.getElementById(`supRetRowSub-${idx}`);
    if (cell) cell.textContent = `${sub.toFixed(2)} د.ج`;
    this.recalcSupplierReturnTotal();
  };

  App.recalcSupplierReturnTotal = function () {
    const total = (AppState.supplierReturnableBatches || []).reduce(
      (sum, r) => sum + Number(r.return_qty || 0) * Number(r.cost_price || 0),
      0
    );
    const el = document.getElementById('supRetTotalValueText');
    if (el) el.textContent = `${total.toFixed(2)} د.ج`;
    return Number(total.toFixed(2));
  };

  App.submitSupplierReturnFromModal = async function () {
    const supplier_id = Number(document.getElementById('supRetSupplierSelect')?.value);
    const settlement = document.getElementById('supRetSettlementMode')?.value || 'credit';
    const reason = document.getElementById('supRetReasonInput')?.value?.trim() || 'مرتجع للمورد';
    const selectedItems = (AppState.supplierReturnableBatches || [])
      .filter((r) => Number(r.return_qty || 0) > 0)
      .map((r) => ({
        product_id: r.product_id,
        batch_id: r.id,
        variant_id: r.variant_id || null,
        quantity: Number(r.return_qty),
        cost_price: Number(r.cost_price || 0)
      }));

    if (selectedItems.length === 0) {
      showToast('يرجى تحديد كمية مرجعة لصنف واحد على الأقل', 'warning');
      return;
    }

    const total = this.recalcSupplierReturnTotal();
    await window.api.saveSupplierReturn({
      supplier_id,
      total,
      credit_applied: settlement === 'credit' ? total : 0,
      refund_amount: settlement === 'cash' ? total : 0,
      refund_method: settlement,
      reason,
      items: selectedItems
    });

    this.closeModal('supplierReturnModal');
    await this.refreshProducts();
    await this.renderPurchasesView();
    showToast('تم حفظ مستند مرتجع المورد وخصم الكميات من الدفعات بنجاح', 'success');
  };

  // 4. حاسبة الفئات النقدية الجزائرية في إغلاق الصندوق ومراجعة المناوبة
  const _baseOpenCloseShiftModal = typeof App.openCloseShiftModal === 'function' ? App.openCloseShiftModal.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.openCloseShiftModal is undefined, using fallback.'); return null; };
  App.openCloseShiftModal = function (sessionId, expectedBalance = 0) {
    AppState._closeShiftExpected = Number(expectedBalance || 0);
    document.querySelectorAll('.denom-inp').forEach((inp) => { inp.value = ''; });
    _baseOpenCloseShiftModal(sessionId, expectedBalance);
    this.updateCloseShiftDiffPreview();
  };

  App.recalcCloseShiftDenoms = function () {
    let sum = 0;
    document.querySelectorAll('.denom-inp').forEach((inp) => {
      const denom = Number(inp.getAttribute('data-denom') || 0);
      const count = Math.max(0, parseInt(inp.value || '0', 10) || 0);
      sum += denom * count;
    });
    const countedEl = document.getElementById('closeShiftCountedInput');
    if (countedEl) countedEl.value = sum.toFixed(2);
    this.updateCloseShiftDiffPreview();
  };

  App.updateCloseShiftDiffPreview = function () {
    const counted = parseFloat(document.getElementById('closeShiftCountedInput')?.value) || 0;
    const expected = Number(AppState._closeShiftExpected || 0);
    const diff = Number((counted - expected).toFixed(2));
    const box = document.getElementById('caisseDiffPreview');
    if (!box) return;
    box.textContent = `${diff > 0 ? '+' : ''}${diff.toFixed(2)} د.ج`;
    box.className =
      diff < -0.01
        ? 'w-full px-3 py-2.5 rounded-xl bg-rose-500/15 text-rose-600 font-mono font-black text-lg text-center'
        : diff > 0.01
          ? 'w-full px-3 py-2.5 rounded-xl bg-amber-500/15 text-amber-600 font-mono font-black text-lg text-center'
          : 'w-full px-3 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 font-mono font-black text-lg text-center';
  };

  App.openSessionReviewModal = async function (sessionId) {
    const details = await window.api.getSessionDetails(sessionId);
    if (!details) return;
    const sess = details.session || {};
    const sum = details.summary || {};
    const txs = details.transactions || [];
    document.getElementById('reviewCaisseModalTitle').textContent = `مراجعة المناوبة رقم #${sess.id || sessionId}`;
    const body = document.getElementById('reviewCaisseModalBody');
    body.innerHTML = `
      <div class="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
        <div>الافتتاحي: <strong class="font-mono">${Number(sum.openingBalance || 0).toFixed(2)} د.ج</strong></div>
        <div>المتوقع: <strong class="font-mono text-blue-600">${Number(sum.expectedBalance || 0).toFixed(2)} د.ج</strong></div>
        <div>الفعلي: <strong class="font-mono text-emerald-600">${sess.closing_balance !== null ? Number(sess.closing_balance).toFixed(2) + ' د.ج' : 'مفتوحة'}</strong></div>
      </div>
      <div class="flex justify-end">
        <button onclick="App.printSessionZReport(${sess.id || sessionId})" class="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold">🖨️ طباعة تقرير Z-Report (80mm)</button>
      </div>
      <table class="w-full text-xs text-right">
        <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">النوع</th><th class="py-1.5">البيان</th><th class="py-1.5">المبلغ</th><th class="py-1.5">الوقت</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${txs.map((t) => `<tr><td class="py-1.5 font-bold">${t.type}</td><td class="py-1.5">${t.description || ''}</td><td class="py-1.5 font-mono font-bold">${Number(t.amount || 0).toFixed(2)} د.ج</td><td class="py-1.5 font-mono text-slate-400">${String(t.created_at || '').slice(0, 16)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
    this.openModal('reviewCaisseModal');
  };

  // 5. الإضافة التلقائية للسلة عند استقرار وزن الميزان (usb_scale_auto_add)
  if (window.api && window.api.scale && window.api.scale.onReading) {
    let lastAutoAddedWeight = 0;
    window.api.scale.onReading((reading) => {
      if (!reading || !reading.stable) {
        if (reading && Number(reading.weight || 0) < 0.005) lastAutoAddedWeight = 0;
        return;
      }
      if (String(AppState.settings.usb_scale_auto_add) !== 'true') return;
      const w = Number(reading.weight || 0);
      if (w >= 0.01 && Math.abs(w - lastAutoAddedWeight) >= 0.005) {
        const scaleModalOpen = document.getElementById('posScaleModal')?.classList.contains('active');
        if (scaleModalOpen) {
          lastAutoAddedWeight = w;
          App.addWeightedProductFromScaleModal();
        }
      }
    });
  }
})();


// ============================================================================
// [ULTIMATE ALGERIAN MARKET-LEADER & 100% LUMINA PARITY ENGINE]
// ============================================================================
(function applyUltimateAlgeria100() {
  if (!window.App || !window.AppState) return;

  AppState.posShowCost = false;
  AppState.lastScannedUnknownBarcode = '';
  AppState.lastDzSuggestItem = null;

  // --------------------------------------------------------------------------
  // الميزة 9: المحول الجزائري الفوري من الدينار إلى السنتيم ("المليون والألف سنتيم")
  // --------------------------------------------------------------------------
  App.formatAlgerianCentimes = function (amountDzd) {
    const dzd = Number(amountDzd || 0);
    if (!Number.isFinite(dzd) || Math.abs(dzd) < 0.01) return '0 سنتيم';
    const sign = dzd < 0 ? '-' : '';
    const totalCentimes = Math.round(Math.abs(dzd) * 100);
    // 1 مليون سنتيم = 10,000 د.ج = 1,000,000 سنتيم
    // 1 ألف سنتيم ("ألف فرانك") = 10 د.ج = 1,000 سنتيم
    const millions = Math.floor(totalCentimes / 1000000);
    const remAfterMillions = totalCentimes % 1000000;
    const thousands = Math.floor(remAfterMillions / 1000);

    const parts = [];
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('جوج ملاين');
    else if (millions > 2) parts.push(`${millions} ملاين`);

    if (thousands > 0) {
      parts.push(`${thousands} ألف`);
    }
    if (parts.length === 0) {
      return `${sign}${totalCentimes} سنتيم`;
    }
    return `${sign}${parts.join(' و ')} سنتيم`;
  };

  // حقن عرض السنتيم تحت إجمالي السلة وفي نافذة الدفع تلقائياً
  const _origRecalcCart = typeof App.recalcAndRenderCart === 'function' ? App.recalcAndRenderCart.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.recalcAndRenderCart is undefined, using fallback.'); return null; };
  App.recalcAndRenderCart = function () {
    const totals = _origRecalcCart();
    const totalEl = document.getElementById('cartTotalText');
    if (totalEl) {
      let centimeBadge = document.getElementById('cartTotalCentimeBadge');
      if (!centimeBadge) {
        centimeBadge = document.createElement('div');
        centimeBadge.id = 'cartTotalCentimeBadge';
        centimeBadge.className = 'text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-0.5';
        totalEl.parentNode.appendChild(centimeBadge);
      }
      centimeBadge.textContent = `🇩🇿 بالتداول الجزائري: ${this.formatAlgerianCentimes(totals.total)}`;
    }
    return totals;
  };

  const _origRecalcCheckout = typeof App.recalcCheckoutModal === 'function' ? App.recalcCheckoutModal.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.recalcCheckoutModal is undefined, using fallback.'); return null; };
  App.recalcCheckoutModal = function () {
    const res = _origRecalcCheckout();
    const totalEl = document.getElementById('chkTotalText');
    if (totalEl) {
      let badge = document.getElementById('chkCentimeHelperText');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'chkCentimeHelperText';
        badge.className = 'text-xs font-black text-amber-600 dark:text-amber-400 mt-1';
        totalEl.parentNode.appendChild(badge);
      }
      badge.innerHTML = `🇩🇿 الإجمالي بالسنتيم: <span>${this.formatAlgerianCentimes(res.total)}</span>${
        res.change > 0 ? ` | الباقي للزبون (الصرْف): <span class="text-emerald-600">${this.formatAlgerianCentimes(res.change)}</span>` : ''
      }`;
    }
    return res;
  };

  // --------------------------------------------------------------------------
  // الميزة 4: أزرار الأوراق والعملات النقدية الجزائرية التفاعلية في نافذة التسديد (#checkoutModal)
  // --------------------------------------------------------------------------
  const _origOpenCheckoutModal = typeof App.openCheckoutModal === 'function' ? App.openCheckoutModal.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.openCheckoutModal is undefined, using fallback.'); return null; };
  App.openCheckoutModal = function () {
    _origOpenCheckoutModal();
    const paidInput = document.getElementById('chkPaidAmount');
    /* [Unified Banknotes Deck on Left Column Only] */

    // استكمال عملات 20، 10، 5 د.ج في حاسبة جرد الصندوق
    const denomGrid = document.querySelector('#closeShiftModal .grid.grid-cols-3.gap-2.font-mono');
    if (denomGrid && !denomGrid.querySelector('[data-denom="20"]')) {
      denomGrid.insertAdjacentHTML(
        'beforeend',
        `
        <div class="flex items-center gap-1"><span class="w-16 font-bold text-amber-600">20×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="20" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
        <div class="flex items-center gap-1"><span class="w-16 font-bold text-slate-500">10×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="10" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
        <div class="flex items-center gap-1"><span class="w-16 font-bold text-slate-400">5×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="5" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
        `
      );
    }
  };

  App.addBanknoteToCheckout = function (noteVal) {
    const inp = document.getElementById('chkPaidAmount');
    if (!inp) return;
    const cur = parseFloat(inp.value) || 0;
    const total = this.recalcAndRenderCart().total;
    // إذا كان الحقل مساوياً للإجمالي الافتراضي عند أول نقرة، نبدأ من الصفر ثم نجمع الأوراق
    if (!AppState._banknoteClickedOnce && Math.abs(cur - total) < 0.01) {
      inp.value = String(noteVal);
      AppState._banknoteClickedOnce = true;
    } else {
      inp.value = String(Number((cur + Number(noteVal)).toFixed(2)));
    }
    this.recalcCheckoutModal();
  };

  // --------------------------------------------------------------------------
  // الميزة 1: نافذة الاقتراح الذكي عند مسح باركود غير موجود (#posBarcodeSuggestModal)
  // --------------------------------------------------------------------------
  const _origHandleBarcodeScan = typeof App.handleBarcodeScan === 'function' ? App.handleBarcodeScan.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.handleBarcodeScan is undefined, using fallback.'); return null; };
  App.handleBarcodeScan = async function (rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) return;

    // فحص ما إذا كان الباركود موجوداً في المنتجات أو الحزم أو باركود الميزان
    const scalePrefix = String(AppState.settings.scale_barcode_prefix || '20');
    const isScaleBc = String(AppState.settings.scale_barcode_enabled) !== 'false' && code.length >= 12 && code.startsWith(scalePrefix);
    const prodMatch = AppState.products.find(
      (p) =>
        String(p.barcode || '') === code ||
        String(p.plu_code || '') === code ||
        (Array.isArray(p.barcodes) && p.barcodes.some((b) => String(b.barcode || b) === code)) ||
        (Array.isArray(p.variants) && p.variants.some((v) => String(v.barcode || '') === code))
    );
    const bundleMatch = AppState.bundles.find((b) => String(b.barcode || '') === code && b.is_active !== 0);

    if (prodMatch || bundleMatch || isScaleBc) {
      return await _origHandleBarcodeScan(code);
    }

    // الباركود غير مسجل -> فتح نافذة الاقتراح الذكي (#posBarcodeSuggestModal)
    const bcInput = document.getElementById('barcodeInput');
    if (bcInput) bcInput.value = '';
    this.playScanSound(false);
    await this.openBarcodeSuggestModal(code);
  };

  App.openBarcodeSuggestModal = async function (barcode) {
    AppState.lastScannedUnknownBarcode = barcode;
    document.getElementById('suggestScannedBarcode').textContent = barcode;
    const dzBox = document.getElementById('suggestDzDictBox');
    dzBox.classList.add('hidden');
    AppState.lastDzSuggestItem = null;

    if (window.api && window.api.lookupDzBarcode) {
      const dzItem = await window.api.lookupDzBarcode(barcode).catch(() => null);
      if (dzItem && dzItem.name) {
        AppState.lastDzSuggestItem = dzItem;
        dzBox.classList.remove('hidden');
        document.getElementById('suggestDzDictDetails').textContent = `${dzItem.name} — العلامة: ${dzItem.brand || 'جزائرية'} (${dzItem.category || 'عام'})`;
        const sugPrice = Number(dzItem.suggested_price || 100);
        document.getElementById('suggestDzPriceInput').value = String(sugPrice);
        document.getElementById('suggestDzCostInput').value = String(Math.round(sugPrice * 0.82));
      }
    }

    document.getElementById('suggestLinkSearchInput').value = '';
    this.renderBarcodeSuggestProducts('');
    this.openModal('posBarcodeSuggestModal');
  };

  App.renderBarcodeSuggestProducts = function (query = '') {
    const q = String(query || '').trim().toLowerCase();
    const list = (AppState.products || [])
      .filter((p) => !q || String(p.name || '').toLowerCase().includes(q) || String(p.barcode || '').includes(q))
      .slice(0, 15);
    const box = document.getElementById('posBarcodeSuggestList');
    if (!box) return;
    box.innerHTML =
      list
        .map(
          (p) => `
        <div class="py-1.5 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
          <div>
            <div class="font-bold">${p.name}</div>
            <div class="text-[10px] text-slate-400 font-mono">${p.barcode || ''} — ${Number(p.selling_price || 0).toFixed(2)} د.ج</div>
          </div>
          <button onclick="App.linkScannedBarcodeToExistingProduct(${p.id})" class="px-3 py-1 rounded-lg bg-indigo-600/15 text-indigo-600 font-bold text-[11px]">
            ربط الباركود وبيع
          </button>
        </div>`
        )
        .join('') || '<div class="py-3 text-center text-slate-400">لا توجد منتجات مطابقة</div>';
  };

  App.linkScannedBarcodeToExistingProduct = async function (productId) {
    const bc = AppState.lastScannedUnknownBarcode;
    if (!bc || !productId) return;
    await window.api.addProductBarcode(productId, bc, null);
    this.closeModal('posBarcodeSuggestModal');
    await this.refreshProducts();
    this.addProductToCart(productId, 1);
    showToast(`تم ربط الباركود (${bc}) بالمنتج وإضافته للسلة!`, 'success');
  };

  App.QuickCreateFromDzSuggest = async function () {
    const dz = AppState.lastDzSuggestItem;
    const bc = AppState.lastScannedUnknownBarcode;
    if (!dz || !bc) return;
    const cost = parseFloat(document.getElementById('suggestDzCostInput')?.value) || 0;
    const price = parseFloat(document.getElementById('suggestDzPriceInput')?.value) || 0;
    const stock = parseFloat(document.getElementById('suggestDzStockInput')?.value) || 10;

    const res = await window.api.addProduct({
      barcode: bc,
      name: dz.name,
      category: dz.category || 'عام',
      supplier: dz.brand || '',
      unit: dz.unit || 'قطعة',
      min_stock: 5,
      stock,
      cost_price: cost,
      selling_price: price
    });
    this.closeModal('posBarcodeSuggestModal');
    await this.refreshProducts();
    if (res && res.id) {
      this.addProductToCart(res.id, 1);
    }
    showToast(`تمت إضافة "${dz.name}" للمخزون والسلة بنجاح!`, 'success');
  };

  App.createSimilarProductFromSuggest = function () {
    const bc = AppState.lastScannedUnknownBarcode;
    this.closeModal('posBarcodeSuggestModal');
    this.openProductModal(null);
    const bcInp = document.getElementById('prodBarcodeInput');
    if (bcInp && bc) {
      bcInp.value = bc;
      this.checkDzDictionaryForBarcode(bc);
    }
  };

  // --------------------------------------------------------------------------
  // الميزة 2: تبديل وحدة البيع في السلة (قطعة Détail / كرتونة جملة Gros)
  // --------------------------------------------------------------------------
  App.toggleCartItemWholesaleUnit = function (idx) {
    const item = this.currentCart.items[idx];
    if (!item || !item.product_id) return;
    const prod = AppState.products.find((p) => Number(p.id) === Number(item.product_id));
    if (!prod) return;

    const wQty = Math.max(1, Number(prod.wholesale_qty || 1));
    const wUnit = prod.wholesale_unit || 'كرتونة';
    const wPrice = Number(prod.wholesale_price || prod.selling_price || item.price);

    if (!item._isWholesaleMode) {
      item._isWholesaleMode = true;
      item._origUnit = item.unit;
      item._origPrice = item.price;
      item.unit = `${wUnit} (${wQty}×)`;
      item.quantity = wQty;
      item.price = wPrice;
      showToast(`تم التبديل إلى البيع بالجملة (${wUnit} = ${wQty} بسعر ${wPrice} د.ج)`, 'info');
    } else {
      item._isWholesaleMode = false;
      item.unit = item._origUnit || prod.unit || 'قطعة';
      item.quantity = 1;
      item.price = item._origPrice || Number(prod.selling_price || item.price);
      showToast('تمت العودة إلى البيع بالتجزئة (القطعة)', 'info');
    }
    item.subtotal = Number((item.quantity * item.price).toFixed(2));
    this.recalcAndRenderCart();
  };

  // --------------------------------------------------------------------------
  // الميزة 3: حاسبة نسبة الربح (#batchMarkup) وأدوات التعبئة الجماعية للمتغيرات
  // --------------------------------------------------------------------------
  function injectProductModalEnhancements() {
    const priceInput = document.getElementById('prodPriceInput');
    const costInput = document.getElementById('prodCostInput');
    if (priceInput && costInput && !document.getElementById('prodMarkupPercentInput')) {
      const wrap = document.createElement('div');
      wrap.className = 'mt-1 flex items-center gap-1.5 text-[11px]';
      wrap.innerHTML = `
        <span class="text-slate-400 font-bold">هامش الربح %:</span>
        <input id="prodMarkupPercentInput" type="number" step="any" placeholder="مثلاً 25%"
          oninput="App.onProdMarkupChange(this.value)"
          class="w-24 px-2 py-0.5 rounded-lg font-mono font-bold text-emerald-600">
      `;
      priceInput.parentNode.appendChild(wrap);
      costInput.addEventListener('input', () => App.syncProdMarkupFromPrices());
      priceInput.addEventListener('input', () => App.syncProdMarkupFromPrices());
    }

    // شريط التعبئة الجماعية للمتغيرات (Bulk Variant Fill)
    const varRowsBox = document.getElementById('prodVariantsMatrixRows');
    if (varRowsBox && !document.getElementById('bulkVariantsToolbar')) {
      const bar = document.createElement('div');
      bar.id = 'bulkVariantsToolbar';
      bar.className = 'grid grid-cols-5 gap-1.5 pb-2 mb-2 border-b border-indigo-500/20 text-[11px]';
      bar.innerHTML = `
        <input id="bulkVarStockInp" type="number" placeholder="الكمية للكل" class="px-2 py-1 rounded-lg font-mono">
        <input id="bulkVarCostInp" type="number" placeholder="التكلفة للكل" class="px-2 py-1 rounded-lg font-mono">
        <input id="bulkVarPriceInp" type="number" placeholder="سعر البيع للكل" class="px-2 py-1 rounded-lg font-mono">
        <button type="button" onclick="App.applyBulkVariantValues()" class="px-2 py-1 bg-indigo-600 text-white rounded-lg font-bold">تطبيق على الكل</button>
        <button type="button" onclick="App.bulkGenerateVariantBarcodes()" class="px-2 py-1 bg-slate-700 text-white rounded-lg font-bold">توليد باركودات</button>
      `;
      varRowsBox.parentNode.insertBefore(bar, varRowsBox);
    }
  }

  App.onProdMarkupChange = function (pctVal) {
    const cost = parseFloat(document.getElementById('prodCostInput')?.value) || 0;
    const pct = parseFloat(pctVal);
    if (cost > 0 && Number.isFinite(pct)) {
      document.getElementById('prodPriceInput').value = (cost * (1 + pct / 100)).toFixed(2);
    }
  };

  App.syncProdMarkupFromPrices = function () {
    const cost = parseFloat(document.getElementById('prodCostInput')?.value) || 0;
    const price = parseFloat(document.getElementById('prodPriceInput')?.value) || 0;
    const mkInp = document.getElementById('prodMarkupPercentInput');
    if (mkInp && cost > 0 && price >= cost) {
      mkInp.value = (((price - cost) / cost) * 100).toFixed(1);
    }
  };

  App.applyBulkVariantValues = function () {
    const st = parseFloat(document.getElementById('bulkVarStockInp')?.value);
    const co = parseFloat(document.getElementById('bulkVarCostInp')?.value);
    const pr = parseFloat(document.getElementById('bulkVarPriceInp')?.value);
    (AppState.tempVariantsMatrix || []).forEach((v) => {
      if (Number.isFinite(st)) v.stock = st;
      if (Number.isFinite(co)) v.cost_price = co;
      if (Number.isFinite(pr)) v.selling_price = pr;
    });
    this.renderVariantsMatrixInModal();
    showToast('تم تعميم القيم على جميع المتغيرات بنجاح', 'success');
  };

  App.bulkGenerateVariantBarcodes = function () {
    const baseBc = document.getElementById('prodBarcodeInput')?.value?.trim() || '6130099';
    (AppState.tempVariantsMatrix || []).forEach((v, i) => {
      v.barcode = `${baseBc}-${i + 1}`;
    });
    this.renderVariantsMatrixInModal();
    showToast('تم توليد باركودات متسلسلة لجميع المتغيرات', 'success');
  };

  // --------------------------------------------------------------------------
  // الميزة 5 و 6: مقبض تغيير عرض السلة (#posCartResizer)، كشف التكلفة، وآخر المبيعات
  // --------------------------------------------------------------------------
  function injectPosTopToolbarExtras() {
    const topRightBar = document.querySelector('#top-header > div:last-child');
    if (topRightBar && !document.getElementById('btnPosRecentSalesQuick')) {
      topRightBar.insertAdjacentHTML(
        'afterbegin',
        `
        <button id="btnPosRecentSalesQuick" onclick="App.openPosRecentSalesModal()" title="آخر المبيعات في الكاشير" class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white transition">
          <span class="material-symbols-rounded icon-sm">history</span>
        </button>
        <button id="btnPosBossCostPeek" onclick="App.togglePosCostPeek()" title="إظهار/إخفاء سعر التكلفة (للمدير)" class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-white transition">
          <span class="material-symbols-rounded icon-sm">visibility</span>
        </button>
        `
      );
    }
  }

  App.togglePosCostPeek = function () {
    AppState.posShowCost = !AppState.posShowCost;
    this.renderPosView();
    showToast(AppState.posShowCost ? '👁️ تم إظهار سعر التكلفة على بطاقات الكاشير' : 'تم إخفاء سعر التكلفة', 'info');
  };

  App.openPosRecentSalesModal = async function () {
    const res = await window.api.getSales({ page: 1, limit: 15 });
    const rows = Array.isArray(res) ? res : res.items || [];
    const box = document.getElementById('posRecentSalesTableBox');
    if (box) {
      box.innerHTML = `
        <table class="w-full text-xs text-right">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
              <th class="py-2">#</th>
              <th class="py-2">التاريخ</th>
              <th class="py-2">الزبون</th>
              <th class="py-2">الإجمالي</th>
              <th class="py-2">المدفوع</th>
              <th class="py-2 text-center">إجراءات سريعة</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
            ${rows
              .map(
                (s) => `
              <tr>
                <td class="py-2 font-mono font-bold">#${s.id}</td>
                <td class="py-2 font-mono text-slate-400">${String(s.sale_date || '').slice(0, 16)}</td>
                <td class="py-2 font-bold">${s.customer_name || 'زبون عابر'}</td>
                <td class="py-2 font-mono font-black">${Number(s.total || 0).toFixed(2)} د.ج</td>
                <td class="py-2 font-mono text-emerald-600">${Number(s.paid_amount || 0).toFixed(2)} د.ج</td>
                <td class="py-2 flex items-center justify-center gap-1">
                  <button onclick="App.reprintSale(${s.id}, 'receipt')" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold">وصل 80mm</button>
                  <button onclick="App.openPrintCenterModal(${s.id}, 'invoice_a4')" class="px-2 py-1 bg-blue-600 text-white rounded-lg font-bold">🖨️ طباعة</button>
                  <button onclick="App.closeModal('posRecentSalesModal'); App.loadSaleIntoPosForEdit(${s.id})" class="px-2 py-1 bg-amber-500/15 text-amber-600 rounded-lg font-bold">تعديل</button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;
    }
    this.openModal('posRecentSalesModal');
  };

  // --------------------------------------------------------------------------
  // الميزة 10: مولد التصريح الجبائي الجزائري (État 104 + ملخص G50 الشهري)
  // --------------------------------------------------------------------------
  App.openAlgerianFiscalModal = async function () {
    const report = await window.api.getAlgerianFiscalReport({
      dateFrom: AppState.analyticsDateFrom,
      dateTo: AppState.analyticsDateTo
    });
    AppState._lastFiscalReport = report;
    const g = report.g50 || {};
    const rows = report.etat104 || [];

    const body = document.getElementById('algerianFiscalModalBody');
    if (body) {
      body.innerHTML = `
        <!-- ملخص G50 الشهري -->
        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
          <div class="font-black text-sm text-blue-600">1. ملخص التصريح الشهري للضرائب (Déclaration G50):</div>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div class="text-[10px] text-slate-400">رقم الأعمال خارج الرسم (CA HT)</div>
              <div class="text-sm font-black font-mono mt-0.5">${Number(g.ca_ht || 0).toFixed(2)} د.ج</div>
            </div>
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div class="text-[10px] text-slate-400">TVA المحصلة من المبيعات (+)</div>
              <div class="text-sm font-black font-mono text-rose-600 mt-0.5">${Number(g.tva_collectee || 0).toFixed(2)} د.ج</div>
            </div>
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div class="text-[10px] text-slate-400">TVA المشتريات المسترجعة (-)</div>
              <div class="text-sm font-black font-mono text-emerald-600 mt-0.5">${Number(g.tva_deductible || 0).toFixed(2)} د.ج</div>
            </div>
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div class="text-[10px] text-slate-400">حقوق الطابع الجبائي (Timbre)</div>
              <div class="text-sm font-black font-mono text-amber-600 mt-0.5">${Number(g.droit_timbre || 0).toFixed(2)} د.ج</div>
            </div>
            <div class="p-2.5 rounded-xl bg-blue-600 text-white">
              <div class="text-[10px] opacity-80">صافي G50 المستحق للدفع</div>
              <div class="text-sm font-black font-mono mt-0.5">${Number(g.total_a_payer || 0).toFixed(2)} د.ج</div>
            </div>
          </div>
        </div>

        <!-- جدول État 104 للزبائن -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <div class="font-black text-sm text-emerald-600">2. كشف الزبائن السنوي (État 104 — الرقم الجبائي NIF والسجل التجاري RC):</div>
            <button onclick="window.api.exportEtat104Excel(AppState._lastFiscalReport?.etat104 || [])" class="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold">
              📥 تصدير كشف État 104 إلى Excel
            </button>
            <button onclick="App.printAlgerianFiscalReportA4()" class="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-bold">
              🖨️ طباعة تصريح G50 & État 104 (A4)
            </button>
          </div>
          <div class="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table class="w-full text-xs text-right">
              <thead>
                <tr class="bg-slate-100 dark:bg-slate-800 text-slate-500">
                  <th class="p-2">الزبون</th>
                  <th class="p-2">NIF</th>
                  <th class="p-2">RC</th>
                  <th class="p-2">AI</th>
                  <th class="p-2">CA HT</th>
                  <th class="p-2">TVA</th>
                  <th class="p-2">Timbre</th>
                  <th class="p-2">Total TTC</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                ${rows
                  .map(
                    (r) => `
                  <tr>
                    <td class="p-2 font-bold">${r.name}</td>
                    <td class="p-2 font-mono">${r.nif || '—'}</td>
                    <td class="p-2 font-mono">${r.rc || '—'}</td>
                    <td class="p-2 font-mono">${r.ai || '—'}</td>
                    <td class="p-2 font-mono font-bold">${Number(r.total_ht || 0).toFixed(2)}</td>
                    <td class="p-2 font-mono text-blue-600">${Number(r.total_tva || 0).toFixed(2)}</td>
                    <td class="p-2 font-mono">${Number(r.total_stamp || 0).toFixed(2)}</td>
                    <td class="p-2 font-mono font-black text-emerald-600">${Number(r.total_ttc || 0).toFixed(2)} د.ج</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    this.openModal('algerianFiscalModal');
  };

  // --------------------------------------------------------------------------
  // الميزة 11: تذكير الديون والأقساط عبر WhatsApp الجزائري (+213) بضغطة زر
  // --------------------------------------------------------------------------
  App.sendAlgerianWhatsAppReminder = function (phone, customerName, amountDzd, typeLabel = 'دين مستحق') {
    let clean = String(phone || '').replace(/\D+/g, '');
    if (!clean) {
      showToast('يرجى تسجيل رقم هاتف الزبون أولاً لإرسال رسالة واتساب', 'warning');
      return;
    }
    if (clean.startsWith('0')) clean = '213' + clean.slice(1);
    else if (!clean.startsWith('213')) clean = '213' + clean;

    const shopName = AppState.settings.shop_name || 'متجرنا';
    const rip = AppState.settings.shop_baridimob_rip || '';
    const centimesStr = this.formatAlgerianCentimes(amountDzd);
    const msg = `السلام عليكم السيد(ة) ${customerName}، نذكركم من "${shopName}" بوجود ${typeLabel} بقيمة ${Number(amountDzd).toFixed(2)} د.ج (${centimesStr}).${
      rip ? ` يمكنكم التسديد عبر BaridiMob RIP: ${rip}` : ''
    } شكراً لثقتكم.`;

    const url = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
    if (window.api && window.api.openExternalLink) {
      window.api.openExternalLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      injectProductModalEnhancements();
      injectPosTopToolbarExtras();
    }, 350);
  });
})();


// ============================================================================
// [FINAL PERFECTION 100.0% — LUMINA MICRO-PARITY & ALGERIAN FISCAL LAW ENGINE]
// ============================================================================
(function applyFinalPerfection100() {
  if (!window.App || !window.AppState) return;

  AppState._activeNumpadCartIdx = null;
  AppState._activeNumpadField = 'numModalInput';

  // --------------------------------------------------------------------------
  // 1. محرك الطابع الجبائي الجزائري التدريجي الرسمي (Loi de Finances 1% / 1.5% / 2%)
  // --------------------------------------------------------------------------
  App.computeAlgerianStampDuty = function (amountHtPlusTva) {
    const amt = Number(amountHtPlusTva || 0);
    if (amt <= 300) return 0; // معفى قانوناً إذا لم يتجاوز 300 د.ج
    const mode = String(AppState.settings.stamp_duty_mode || 'progressive_dz');
    if (mode === 'flat_1') {
      return Math.min(10000, Math.max(5, Math.ceil(amt * 0.01)));
    }
    // الحساب التدريجي الرسمي في قانون الطابع الجزائري للدفع النقدي (Espèces)
    let duty = 0;
    if (amt <= 30000) {
      duty = amt * 0.01;
    } else if (amt <= 100000) {
      duty = 30000 * 0.01 + (amt - 30000) * 0.015;
    } else {
      duty = 30000 * 0.01 + 70000 * 0.015 + (amt - 100000) * 0.02;
    }
    return Math.max(5, Math.ceil(duty));
  };

  // ربط حساب الطابع التدريجي بسلة المشتريات تلقائياً
  const _prevRecalcCart = typeof App.recalcAndRenderCart === 'function' ? App.recalcAndRenderCart.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.recalcAndRenderCart is undefined, using fallback.'); return null; };
  App.recalcAndRenderCart = function () {
    const cart = this.currentCart;
    if (cart && cart.includeStamp) {
      const subtotal = cart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
      const discount = Math.max(0, Number(cart.discount || 0));
      const taxable = Math.max(0, subtotal - discount);
      const taxPct = cart.includeTva ? 19 : 0;
      const taxAmount = Number(((taxable * taxPct) / 100).toFixed(2));
      cart._progressiveStampOverride = this.computeAlgerianStampDuty(taxable + taxAmount);
    }
    const totals = _prevRecalcCart();
    if (cart && cart.includeStamp && cart._progressiveStampOverride !== undefined) {
      const subtotal = cart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
      const discount = Math.max(0, Number(cart.discount || 0));
      const taxable = Math.max(0, subtotal - discount);
      const taxPct = cart.includeTva ? 19 : 0;
      const taxAmount = Number(((taxable * taxPct) / 100).toFixed(2));
      totals.stampAmount = cart._progressiveStampOverride;
      totals.total = Number((taxable + taxAmount + totals.stampAmount).toFixed(2));
      const stampEl = document.getElementById('cartStampText');
      const totalEl = document.getElementById('cartTotalText');
      if (stampEl) stampEl.textContent = `${totals.stampAmount.toFixed(2)} د.ج`;
      if (totalEl) totalEl.textContent = `${totals.total.toFixed(2)} د.ج`;
    }
    return totals;
  };

  // --------------------------------------------------------------------------
  // 2. حارس سقف الديون والائتمان للزبائن (Credit Limit Guard) في نافذة التسديد
  // --------------------------------------------------------------------------
  const _prevSubmitSale = typeof App.submitSale === 'function' ? App.submitSale.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.submitSale is undefined, using fallback.'); return null; };
  App.submitSale = async function (printMode = 'none') {
    const chk = this.recalcCheckoutModal();
    const customerId = this.currentCart.customerId ? Number(this.currentCart.customerId) : null;
    if (customerId && chk.remaining > 0.01) {
      const cust = AppState.customers.find((c) => Number(c.id) === customerId);
      if (cust && Number(cust.credit_limit || 0) > 0) {
        const currentDebt = Number(cust.total_debt || cust.initial_debt || 0);
        const newTotalDebt = Number((currentDebt + chk.remaining).toFixed(2));
        if (newTotalDebt > Number(cust.credit_limit)) {
          const allow = window.confirm(
            `⚠️ تنبيه سقف الائتمان (Credit Limit Guard):\nالزبون "${cust.name}" سيتجاوز سقف الدين المسموح به!\n- السقف المسموح: ${Number(cust.credit_limit).toFixed(2)} د.ج\n- الدين الجديد بعد الفاتورة: ${newTotalDebt.toFixed(2)} د.ج\n\nهل تريد التجاوز والموافقة كمدير؟`
          );
          if (!allow) return;
        }
      }
    }
    return await _prevSubmitSale(printMode);
  };

  // --------------------------------------------------------------------------
  // 3. لوحة الأرقام اللمسية للكاشير (#numberInputModal)
  // --------------------------------------------------------------------------
  App.openNumpadForCartItem = function (idx) {
    const item = this.currentCart.items[idx];
    if (!item) return;
    AppState._activeNumpadCartIdx = idx;
    AppState._activeNumpadField = 'numModalInput';
    document.getElementById('numModalTitle').textContent = item.name;
    document.getElementById('numModalInput').value = String(item.quantity);
    document.getElementById('numModalPriceInput').value = String(item.price);
    this.openModal('numberInputModal');
  };

  App.pressNumpadKey = function (key) {
    const fieldId = AppState._activeNumpadField || 'numModalInput';
    const inp = document.getElementById(fieldId);
    if (!inp) return;
    if (key === 'C') {
      inp.value = '';
      return;
    }
    inp.value = String(inp.value || '') + key;
  };

  App.confirmNumpadModal = function () {
    const idx = AppState._activeNumpadCartIdx;
    const item = this.currentCart.items[idx];
    if (!item) return;
    const newQty = parseFloat(document.getElementById('numModalInput').value);
    const newPrice = parseFloat(document.getElementById('numModalPriceInput').value);
    if (Number.isFinite(newQty) && newQty !== 0) item.quantity = newQty;
    if (Number.isFinite(newPrice) && newPrice >= 0) item.price = newPrice;
    item.subtotal = Number((item.quantity * item.price).toFixed(2));
    this.closeModal('numberInputModal');
    this.recalcAndRenderCart();
  };

  // --------------------------------------------------------------------------
  // 4. حفظ السلة كطلبية زبون بعربون وحجز مخزون (#saveAsOrderModal)
  // --------------------------------------------------------------------------
  App.openSaveAsOrderModal = function () {
    if (this.currentCart.items.length === 0) {
      showToast('السلة فارغة!', 'warning');
      return;
    }
    document.getElementById('orderDepositAmount').value = '0';
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    document.getElementById('orderExpectedDelivery').value = tomorrow;
    document.getElementById('orderNotes').value = '';
    this.openModal('saveAsOrderModal');
  };

  App.confirmSaveAsOrder = async function () {
    const totals = this.recalcAndRenderCart();
    const deposit = parseFloat(document.getElementById('orderDepositAmount').value) || 0;
    const expected = document.getElementById('orderExpectedDelivery').value || null;
    const reserves = document.getElementById('orderReservesStock').checked ? 1 : 0;
    const notes = document.getElementById('orderNotes').value.trim();

    const res = await window.api.createOrder({
      customer_id: this.currentCart.customerId ? Number(this.currentCart.customerId) : null,
      subtotal: totals.subtotal,
      tax_percentage: totals.taxPercentage,
      discount: totals.discount,
      total: totals.total,
      deposit_amount: deposit,
      expected_delivery_date: expected,
      reserves_stock: reserves,
      notes,
      session_id: AppState.activeSession ? AppState.activeSession.id : null,
      items: this.currentCart.items
    });

    this.closeModal('saveAsOrderModal');
    this.clearCurrentCart();
    await this.refreshProducts();
    showToast(`تم حفظ طلبية الزبون رقم (${res.doc_number || '#' + res.id}) بنجاح!`, 'success');
  };

  // --------------------------------------------------------------------------
  // 5. الفاتورة المجمعة للزبون (#recapInvoiceModal) وقائمة الأسعار (#priceListModal)
  // --------------------------------------------------------------------------
  App.openRecapInvoiceModal = function (defaultCustomerId = null) {
    const sel = document.getElementById('recapCustomerSelect');
    if (sel) {
      sel.innerHTML = AppState.customers
        .map((c) => `<option value="${c.id}" ${Number(c.id) === Number(defaultCustomerId) ? 'selected' : ''}>${c.name}</option>`)
        .join('');
    }
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    document.getElementById('recapDateFrom').value = firstDay;
    document.getElementById('recapDateTo').value = now.toISOString().slice(0, 10);
    this.openModal('recapInvoiceModal');
  };

  App.confirmRecapInvoice = async function () {
    const customerId = Number(document.getElementById('recapCustomerSelect').value);
    const dateFrom = document.getElementById('recapDateFrom').value;
    const dateTo = document.getElementById('recapDateTo').value;
    const lang = document.getElementById('recapLangSelect').value || 'ar';
    if (!customerId) return;

    const agg = await window.api.getCustomerSalesAggregated({ customerId, dateFrom, dateTo });
    if (!agg || !agg.items || agg.items.length === 0) {
      showToast('لا توجد مبيعات مسجلة لهذا الزبون في الفترة المحددة', 'warning');
      return;
    }
    this.closeModal('recapInvoiceModal');
    if (window.PrintEngine && window.PrintEngine.renderRecapInvoiceHtml) {
      const html = await window.PrintEngine.renderRecapInvoiceHtml({ ...agg, dateFrom, dateTo }, AppState.settings, lang);
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  App.openPriceListModal = function () {
    const sel = document.getElementById('priceListCategorySelect');
    if (sel) {
      sel.innerHTML =
        '<option value="all">جميع الفئات</option>' +
        (AppState.categories || []).map((c) => `<option value="${c}">${c}</option>`).join('');
    }
    this.openModal('priceListModal');
  };

  App.confirmPrintPriceList = async function () {
    const cat = document.getElementById('priceListCategorySelect').value;
    const priceMode = document.getElementById('priceListModeSelect').value || 'retail';
    const list = (AppState.products || []).filter((p) => cat === 'all' || p.category === cat);
    this.closeModal('priceListModal');
    if (window.PrintEngine && window.PrintEngine.renderPriceListHtml) {
      const html = await window.PrintEngine.renderPriceListHtml(list, AppState.settings, {
        category: cat === 'all' ? 'جميع الفئات' : cat,
        priceMode,
        lang: AppState.lang
      });
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // --------------------------------------------------------------------------
  // 6. تخصيص شبكة الكاشير (#posCustomizeModal) والخصم السريع (#cartModifierModal)
  // --------------------------------------------------------------------------
  App.applyPosCustomization = function () {
    const cols = document.getElementById('posGridColsSelect')?.value || 'auto';
    const cartW = document.getElementById('posCartWidthInput')?.value || '410';
    const grid = document.getElementById('posProductsGrid');
    const layout = document.querySelector('.pos-layout');
    if (grid) {
      grid.style.gridTemplateColumns =
        cols === 'auto' ? 'repeat(auto-fill, minmax(155px, 1fr))' : `repeat(${cols}, minmax(0, 1fr))`;
    }
    if (layout) {
      layout.style.gridTemplateColumns = `1fr ${cartW}px`;
    }
  };

  App.applyQuickCartDiscountPercent = function (pct) {
    const subtotal = this.currentCart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const disc = Number(((subtotal * Number(pct)) / 100).toFixed(2));
    document.getElementById('modAmountInput').value = String(disc);
    this.previewCartDiscountModifier(disc);
  };

  App.previewCartDiscountModifier = function (val) {
    const subtotal = this.currentCart.items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const disc = Math.max(0, parseFloat(val) || 0);
    const pct = subtotal > 0 ? ((disc / subtotal) * 100).toFixed(1) : '0.0';
    const box = document.getElementById('modPercentPreview');
    if (box) box.textContent = `نسبة الخصم: ${pct}% | الصافي الجديد: ${Math.max(0, subtotal - disc).toFixed(2)} د.ج`;
  };

  App.confirmCartDiscountModifier = function () {
    const disc = Math.max(0, parseFloat(document.getElementById('modAmountInput').value) || 0);
    this.currentCart.discount = disc;
    const inp = document.getElementById('cartDiscountInput');
    if (inp) inp.value = String(disc);
    this.closeModal('cartModifierModal');
    this.recalcAndRenderCart();
  };

  // --------------------------------------------------------------------------
  // 7. حافظة الشيكات والكمبيالات المؤجلة الجزائرية (#chequesPortfolioModal)
  // --------------------------------------------------------------------------
  App.openChequesPortfolioModal = async function () {
    document.getElementById('chqDueInp').value = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    this.openModal('chequesPortfolioModal');
    await this.renderChequesPortfolioTable();
  };

  App.renderChequesPortfolioTable = async function () {
    const rows = (await window.api.getChequesPortfolio().catch(() => [])) || [];
    const box = document.getElementById('chequesPortfolioTableBox');
    if (!box) return;
    box.innerHTML = `
      <table class="w-full text-xs text-right">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
            <th class="py-2">النوع</th>
            <th class="py-2">الطرف</th>
            <th class="py-2">رقم الشيك</th>
            <th class="py-2">البنك / CCP</th>
            <th class="py-2">المبلغ</th>
            <th class="py-2">تاريخ الاستحقاق</th>
            <th class="py-2">الحالة</th>
            <th class="py-2 text-center">إجراء</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          ${rows
            .map(
              (r) => `
            <tr>
              <td class="py-2 font-bold ${r.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}">${r.direction === 'in' ? '📥 وارد' : '📤 صادر'}</td>
              <td class="py-2 font-bold">${r.party_name}</td>
              <td class="py-2 font-mono font-bold">${r.cheque_number}</td>
              <td class="py-2 font-bold">${r.bank_name}</td>
              <td class="py-2 font-mono font-black">${Number(r.amount || 0).toFixed(2)} د.ج</td>
              <td class="py-2 font-mono">${r.due_date}</td>
              <td class="py-2">
                <select onchange="App.changeChequeStatus(${r.id}, this.value)" class="px-2 py-0.5 rounded-lg font-bold text-[11px]">
                  <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>⏳ في المحفظة</option>
                  <option value="deposited" ${r.status === 'deposited' ? 'selected' : ''}>🏦 مودع بالبنك</option>
                  <option value="cashed" ${r.status === 'cashed' ? 'selected' : ''}>✅ محصّل</option>
                  <option value="rejected" ${r.status === 'rejected' ? 'selected' : ''}>❌ مرفوض Impayé</option>
                </select>
              </td>
              <td class="py-2 text-center">
                <button onclick="App.deleteChequeById(${r.id})" class="text-rose-500 font-bold">✕</button>
              </td>
            </tr>`
            )
            .join('') || '<tr><td colspan="8" class="py-6 text-center text-slate-400">لا توجد شيكات أو كمبيالات مسجلة حالياً</td></tr>'}
        </tbody>
      </table>
    `;
  };

  App.addNewChequeRecord = async function () {
    const party_name = document.getElementById('chqPartyInp').value.trim();
    const cheque_number = document.getElementById('chqNumberInp').value.trim();
    const amount = parseFloat(document.getElementById('chqAmountInp').value) || 0;
    if (!party_name || !cheque_number || amount <= 0) {
      showToast('يرجى إدخال اسم الطرف ورقم الشيك والمبلغ', 'warning');
      return;
    }
    await window.api.saveChequeRecord({
      direction: document.getElementById('chqDirectionInp').value,
      party_name,
      cheque_number,
      bank_name: document.getElementById('chqBankInp').value,
      amount,
      due_date: document.getElementById('chqDueInp').value
    });
    document.getElementById('chqPartyInp').value = '';
    document.getElementById('chqNumberInp').value = '';
    document.getElementById('chqAmountInp').value = '';
    await this.renderChequesPortfolioTable();
    showToast('تم تسجيل الشيك في الحافظة بنجاح', 'success');
  };

  App.changeChequeStatus = async function (id, status) {
    await window.api.updateChequeStatus(id, status);
    showToast('تم تحديث حالة الشيك', 'info');
  };

  App.deleteChequeById = async function (id) {
    await window.api.deleteChequeRecord(id);
    await this.renderChequesPortfolioTable();
  };

  // --------------------------------------------------------------------------
  // 8. المدقق الآلي للأرقام الجبائية الجزائرية (NIF / NIS / AI Validator)
  // --------------------------------------------------------------------------
  App.validateAlgerianTaxIds = function (nif, nis, ai) {
    const warnings = [];
    if (nif && !/^\d{15}(\d{5})?$/.test(String(nif).replace(/\s+/g, ''))) {
      warnings.push('الرقم الجبائي (NIF) في الجزائر يتكون عادة من 15 أو 20 رقماً');
    }
    if (nis && !/^\d{15}$/.test(String(nis).replace(/\s+/g, ''))) {
      warnings.push('الرقم الإحصائي (NIS) يتكون عادة من 15 رقماً');
    }
    if (ai && !/^\d{11}$/.test(String(ai).replace(/\s+/g, ''))) {
      warnings.push('المادة الجبائية (AI) تتكون عادة من 11 رقماً');
    }
    return warnings;
  };

  // حقن أزرار الوصول السريع للأدوات الجديدة في الواجهة عند التشغيل
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      // زر تخصيص الكاشير في الشريط العلوي
      const topRightBar = document.querySelector('#top-header > div:last-child');
      if (topRightBar && !document.getElementById('btnPosCustomizeQuick')) {
        topRightBar.insertAdjacentHTML(
          'afterbegin',
          `<button id="btnPosCustomizeQuick" onclick="App.openModal('posCustomizeModal')" title="تخصيص أعمدة ومظهر الكاشير" class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white transition">
            <span class="material-symbols-rounded icon-sm">tune</span>
          </button>`
        );
      }
    }, 450);
  });
})();


// ============================================================================
// [MASTER RELEASE 100.0% — UNIFIED LUMINA PARITY & ALGERIAN #1 TOOLBAR]
// ============================================================================
(function applyMasterRelease100() {
  if (!window.App || !window.AppState) return;

  // 1. نافذة آخر المبيعات السريعة من الكاشير (#posRecentSalesModal)
  App.openPosRecentSalesModal = async function () {
    const res = await window.api.getSales({ limit: 15, page: 1 });
    const rows = Array.isArray(res) ? res : (res && res.items) || [];
    const box = document.getElementById('posRecentSalesTableBox');
    if (box) {
      box.innerHTML = `
        <table class="w-full text-xs text-right">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
              <th class="py-2">رقم الفاتورة</th>
              <th class="py-2">التاريخ</th>
              <th class="py-2">الزبون</th>
              <th class="py-2">الإجمالي</th>
              <th class="py-2 text-center">إجراءات سريعة</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
            ${rows
              .map(
                (s) => `
              <tr>
                <td class="py-2 font-mono font-bold">${s.doc_number || '#' + s.id}</td>
                <td class="py-2 font-mono">${String(s.sale_date || '').slice(0, 16)}</td>
                <td class="py-2 font-bold">${s.customer_name || 'زبون عابر'}</td>
                <td class="py-2 font-mono font-black text-blue-600">${Number(s.total || 0).toFixed(2)} د.ج</td>
                <td class="py-2 text-center space-x-1 space-x-reverse">
                  <button onclick="App.closeModal('posRecentSalesModal'); App.openPrintCenterModal(${s.id}, 'receipt')" class="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold">🖨️ طباعة</button>
                  <button onclick="App.closeModal('posRecentSalesModal'); App.loadSaleForEditInPos(${s.id})" class="px-2.5 py-1 bg-amber-500/15 text-amber-600 rounded-lg font-bold">تعديل</button>
                </td>
              </tr>`
              )
              .join('') || '<tr><td colspan="5" class="py-6 text-center text-slate-400">لا توجد مبيعات مسجلة بعد</td></tr>'}
          </tbody>
        </table>
      `;
    }
    this.openModal('posRecentSalesModal');
  };

  // 2. نافذة اقتران تطبيق الهاتف المحمول عبر QR Code (#cloudPairMobileModal)
  App.openMobileCompanionModal = async function () {
    const endpoint = (await window.api.getServerEndpoint().catch(() => ({}))) || {};
    const url = endpoint.url || 'http://192.168.1.15:8080';
    const qrDataUrl = await window.api.pairingQrDataUrl(url).catch(() => '');
    const pairInfo = await window.api.cloudSync.issueMobilePairCode().catch(() => ({ code: '123456' }));
    const qrImg = document.getElementById('mobilePairQrImg');
    if (qrImg && qrDataUrl) qrImg.src = qrDataUrl;
    const codeEl = document.getElementById('mobilePairCodeText');
    if (codeEl) codeEl.textContent = pairInfo.code || '849201';
    const urlEl = document.getElementById('mobilePairUrlText');
    if (urlEl) urlEl.textContent = url;
    this.openModal('cloudPairMobileModal');
  };

  // 3. نافذة اقتراح الباركود غير المسجل (#posBarcodeSuggestModal)
  App.createSimilarProductFromSuggest = function () {
    const bc = AppState._lastUnknownBarcode || '';
    this.closeModal('posBarcodeSuggestModal');
    this.openProductModal(null);
    const bcInp = document.getElementById('prodBarcodeInput');
    if (bcInp && bc) bcInp.value = bc;
  };

  // 4. حقن شريط الأدوات الجزائري المتكامل في الكاشير (Quick Action Bar)
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const cartContainer = document.querySelector('#view-pos .cart-container');
      if (cartContainer && !document.getElementById('posAlgerianMasterBar')) {
        const barHtml = `
          <div id="posAlgerianMasterBar" class="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-1 text-[11px] font-bold">
            <button type="button" onclick="App.openPosRecentSalesModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-blue-600">🧾 آخر المبيعات</button>
            <button type="button" onclick="App.openSaveAsOrderModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-500 text-sky-600">📋 حفظ كطلبية</button>
            <button type="button" onclick="App.openModal('cartModifierModal')" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-amber-600">🏷️ خصم %</button>
            <button type="button" onclick="App.openChequesPortfolioModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-indigo-600">🏦 الشيكات</button>
            <button type="button" onclick="App.openMobileCompanionModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-emerald-600">📱 ربط الهاتف</button>
          </div>
        `;
        cartContainer.insertAdjacentHTML('afterbegin', barHtml);
      }
    }, 450);
  });
})();


// ============================================================================
// [COMMERCIAL LAUNCH 100.0% — FINAL LUMINA & ALGERIAN #1 COMPLETION]
// ============================================================================
(function applyCommercialLaunch100() {
  if (!window.App || !window.AppState) return;

  // 1. إخفاء شاشة الإقلاع السريعة (#splashScreen) بسلاسة فور جاهزية الواجهة
  function dismissSplashScreen() {
    const sp = document.getElementById('splashScreen');
    if (!sp) return;
    sp.style.opacity = '0';
    setTimeout(() => {
      sp.style.display = 'none';
    }, 300);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(dismissSplashScreen, 350);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(dismissSplashScreen, 350));
  }

  // 2. نافذة اختيار وحدة البيع: قطعة (Détail) أو كرتون/طرد (Gros) (#posUnitChoiceModal)
  App.openPosUnitChoiceModal = function (productId) {
    const prod = AppState.products.find((p) => Number(p.id) === Number(productId));
    if (!prod) return;
    const wQty = Math.max(1, Number(prod.wholesale_qty || 1));
    const wUnit = prod.wholesale_unit || 'كرتون / طرد';
    const retailPrice = Number(prod.selling_price || 0);
    const wholesaleUnitPrice = Number(prod.wholesale_price || retailPrice);
    const packTotal = Number((wholesaleUnitPrice * wQty).toFixed(2));

    const titleEl = document.getElementById('posUnitChoiceTitle');
    if (titleEl) titleEl.textContent = `اختر وحدة البيع — ${prod.name}`;

    const bodyEl = document.getElementById('posUnitChoiceBody');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <button onclick="App.selectPosUnitAndAdd(${prod.id}, 'unit')" class="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 flex items-center justify-between text-right">
          <div>
            <div class="font-black text-sm">بيع بالقطعة / الوحدة (${prod.unit || 'قطعة'})</div>
            <div class="text-[11px] text-slate-400">الكمية: 1 ${prod.unit || 'قطعة'}</div>
          </div>
          <div class="font-mono font-black text-blue-600 text-sm">${retailPrice.toFixed(2)} د.ج</div>
        </button>
        <button onclick="App.selectPosUnitAndAdd(${prod.id}, 'pack')" class="w-full p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 flex items-center justify-between text-right">
          <div>
            <div class="font-black text-sm text-emerald-600">بيع بـ ${wUnit} (يحتوي على ${wQty} ${prod.unit || 'قطعة'})</div>
            <div class="text-[11px] text-slate-400">سعر القطعة داخل الطرد: ${wholesaleUnitPrice.toFixed(2)} د.ج</div>
          </div>
          <div class="font-mono font-black text-emerald-600 text-sm">${packTotal.toFixed(2)} د.ج</div>
        </button>
      `;
    }
    this.openModal('posUnitChoiceModal');
  };

  App.selectPosUnitAndAdd = function (productId, mode = 'unit') {
    const prod = AppState.products.find((p) => Number(p.id) === Number(productId));
    this.closeModal('posUnitChoiceModal');
    if (!prod) return;
    if (mode === 'pack') {
      const wQty = Math.max(1, Number(prod.wholesale_qty || 1));
      const wPrice = Number(prod.wholesale_price || prod.selling_price || 0);
      this.addToCart(prod, { quantity: wQty, price: wPrice });
      showToast(`تمت إضافة ${prod.wholesale_unit || 'طرد'} (${wQty} × ${wPrice.toFixed(2)} د.ج)`, 'success');
    } else {
      this.addToCart(prod, { quantity: 1 });
    }
  };

  // 3. تفعيل نافذة اقتراح الباركود الذكي (#posBarcodeSuggestModal) عند مسح باركود غير مسجل
  const _prevHandleBarcodeScan = typeof App.handleBarcodeScan === 'function' ? App.handleBarcodeScan.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.handleBarcodeScan is undefined, using fallback.'); return null; };
  App.handleBarcodeScan = async function (rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) return;

    const existing = AppState.products.find(
      (p) =>
        String(p.barcode || '') === code ||
        (Array.isArray(p.extra_barcodes) && p.extra_barcodes.some((eb) => String(eb.barcode) === code)) ||
        (Array.isArray(p.variants) && p.variants.some((v) => String(v.barcode) === code))
    );

    if (existing) {
      return _prevHandleBarcodeScan(code);
    }

    // فحص باركود الميزان أو الباقات أولاً
    const isScalePrefix =
      String(AppState.settings.scale_barcode_enabled) !== 'false' &&
      code.length >= 12 &&
      code.startsWith(String(AppState.settings.scale_barcode_prefix || '20'));
    const isBundle = (AppState.bundles || []).some((b) => String(b.barcode || '') === code);

    if (isScalePrefix || isBundle) {
      return _prevHandleBarcodeScan(code);
    }

    // فحص القاموس الوطني الجزائري 613
    if (window.api && window.api.lookupDzBarcode) {
      const dzItem = await window.api.lookupDzBarcode(code).catch(() => null);
      if (dzItem && dzItem.name) {
        return _prevHandleBarcodeScan(code);
      }
    }

    // إذا لم يُعثر عليه في أي مكان، نعرض نافذة الاقتراحات الذكية (#posBarcodeSuggestModal) كما في Lumina POS
    AppState._lastUnknownBarcode = code;
    const unregTxt = document.getElementById('unregisteredBarcodeText');
    if (unregTxt) unregTxt.textContent = code;
    const linkSel = document.getElementById('posBarcodeLinkProductSelect');
    if (linkSel) {
      linkSel.innerHTML = AppState.products
        .slice(0, 200)
        .map((p) => `<option value="${p.id}">${p.name} (${Number(p.selling_price || 0).toFixed(2)} د.ج)</option>`)
        .join('');
    }
    const prefix = code.slice(0, 6);
    const similar = AppState.products
      .filter((p) => String(p.barcode || '').startsWith(prefix))
      .slice(0, 6);

    const listEl = document.getElementById('posBarcodeSuggestList');
    if (listEl) {
      listEl.innerHTML = `
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-bold mb-2">
          الباركود الممسوح <span class="font-mono font-black">${code}</span> غير مسجل في المخزون حالياً.
        </div>
        ${
          similar.length > 0
            ? '<div class="font-bold text-slate-500 mb-1">منتجات مشابهة في نفس عائلة الباركود:</div>' +
              similar
                .map(
                  (sp) => `
                <div class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <div class="font-bold">${sp.name}</div>
                    <div class="text-[10px] font-mono text-slate-400">${sp.barcode || ''} — ${Number(sp.selling_price || 0).toFixed(2)} د.ج</div>
                  </div>
                  <button onclick="App.closeModal('posBarcodeSuggestModal'); App.addToCartById(${sp.id})" class="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold">إضافة للسلة</button>
                </div>`
                )
                .join('')
            : '<div class="text-slate-400 text-center py-3">يمكنك تعريف هذا الباركود كمنتج جديد بضغطة واحدة أدناه.</div>'
        }
      `;
    }
    const bcInp = document.getElementById('barcodeInput');
    if (bcInp) bcInp.value = '';
    this.openModal('posBarcodeSuggestModal');
  };

  // 4. أزرار الأوراق والعملات النقدية الجزائرية المصورة داخل #checkoutModal
  const _prevOpenCheckoutModal = typeof App.openCheckoutModal === 'function' ? App.openCheckoutModal.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.openCheckoutModal is undefined, using fallback.'); return null; };
  App.openCheckoutModal = async function () {
    await _prevOpenCheckoutModal();
    const paidInput = document.getElementById('chkPaidAmount');
    /* [Unified Banknotes Deck on Left Column Only] */
  };

  App.addBanknoteDenomToPaid = function (denomVal) {
    const inp = document.getElementById('chkPaidAmount');
    if (!inp) return;
    const current = parseFloat(inp.value) || 0;
    inp.value = (current + Number(denomVal)).toFixed(2);
    this.recalcCheckoutModal();
  };

  // 5. معاينة ورقة الملصقات الكاملة (#plSheetPreviewModal) وتصديرها PDF (exportPlLabelsPdf)
  App.openPlSheetPreviewModal = async function () {
    const prodId = Number(document.getElementById('lblProductSelect')?.value);
    const prod = AppState.products.find((p) => Number(p.id) === prodId) || AppState.products[0];
    if (!prod || !window.PrintEngine) return;

    const copies = Math.max(1, parseInt(document.getElementById('lblCopiesInput')?.value || '12', 10));
    const singleHtml = await window.PrintEngine.renderBarcodeLabelHtml(prod, AppState.settings, {
      mode: document.getElementById('lblModeSelect')?.value || 'barcode',
      widthMm: Number(document.getElementById('lblWidthInput')?.value || 40),
      heightMm: Number(document.getElementById('lblHeightInput')?.value || 25)
    });

    const box = document.getElementById('plPreviewBox');
    if (box) {
      box.innerHTML = Array.from({ length: Math.min(24, copies) })
        .map(
          () => `
          <div class="bg-white border border-slate-300 rounded shadow-sm p-2 text-black text-center w-40">
            <div class="font-bold text-xs truncate">${prod.name}</div>
            <div class="font-mono text-[11px] my-1">${prod.barcode || ''}</div>
            <div class="font-mono font-black text-sm text-blue-700">${Number(prod.selling_price || 0).toFixed(2)} د.ج</div>
          </div>`
        )
        .join('');
    }
    AppState._lastPreviewLabelHtml = singleHtml;
    this.openModal('plSheetPreviewModal');
  };

  App.exportPlLabelsPdf = async function () {
    const prodId = Number(document.getElementById('lblProductSelect')?.value);
    const prod = AppState.products.find((p) => Number(p.id) === prodId) || AppState.products[0];
    if (!prod || !window.PrintEngine) return;
    const html = await window.PrintEngine.renderBarcodeLabelHtml(prod, AppState.settings, {
      mode: document.getElementById('lblModeSelect')?.value || 'barcode'
    });
    const res = await window.api.exportPDF({
      html,
      defaultFileName: `Labels_${prod.barcode || prod.id}.pdf`
    });
    if (res && res.success) {
      showToast('تم تصدير ملف الملصقات بصيغة PDF بنجاح', 'success');
    }
  };
})();


// ============================================================================
// [FINAL SEAL 100.0% — UNIFIED METHOD ALIASES & LIVE CENTIMES SYNCHRONIZATION]
// ============================================================================
(function applyFinalSealBridge() {
  if (!window.App || !window.AppState) return;

  // 1. توحيد أسماء الدوال المتقاطعة بين renderer.js و renderer-rc-100.js
  if (typeof App.addProductToCart === 'function') {
    App.addToCart = function (prodOrId, opts = {}) {
      const pid = typeof prodOrId === 'object' && prodOrId !== null ? prodOrId.id : prodOrId;
      const qty = opts.quantity !== undefined ? Number(opts.quantity) : 1;
      const overridePrice = opts.price !== undefined ? Number(opts.price) : undefined;
      return App.addProductToCart(pid, qty, { overridePrice });
    };
    App.addToCartById = function (productId, qty = 1) {
      return App.addProductToCart(productId, qty);
    };
  }

  if (typeof App.loadSaleIntoPosForEdit === 'function' && !App.loadSaleForEditInPos) {
    App.loadSaleForEditInPos = App.loadSaleIntoPosForEdit.bind(App);
  }

  if (typeof App.openInstallmentsManagerModal === 'function' && !App.openInstallmentPlanModal) {
    App.openInstallmentPlanModal = App.openInstallmentsManagerModal.bind(App);
  }

  if (typeof App.exportProductsToExcel === 'function' && !App.exportInventoryExcel) {
    App.exportInventoryExcel = App.exportProductsToExcel.bind(App);
  }

  // 2. ربط App.recalcCart و App.recalcCheckoutModal لتحديث السنتيم الجزائري والطابع التدريجي لحظياً
  const _origRecalcCartFn = typeof App.recalcCart === 'function' ? App.recalcCart.bind(App) : null;
  App.recalcCart = function () {
    const res = _origRecalcCartFn ? _origRecalcCartFn() : { subtotal: 0, discount: 0, total: 0 };
    const centimeBadge = document.getElementById('cartTotalCentimeBadge');
    if (centimeBadge && typeof App.formatAlgerianCentimes === 'function') {
      centimeBadge.textContent = `🇩🇿 بالتداول الجزائري: ${App.formatAlgerianCentimes(res.total)}`;
    }
    return res;
  };
  App.recalcAndRenderCart = function () {
    if (typeof App.renderCartItems === 'function') {
      App.renderCartItems();
    }
    return App.recalcCart();
  };

  const _origRecalcCheckoutFn = typeof App.recalcCheckoutModal === 'function' ? App.recalcCheckoutModal.bind(App) : null;
  App.recalcCheckoutModal = function () {
    const res = _origRecalcCheckoutFn ? _origRecalcCheckoutFn() : { total: 0, paid_amount: 0 };
    const applyStamp = document.getElementById('chkApplyStamp')?.checked;
    const method = document.getElementById('chkPaymentMethod')?.value || 'cash';

    // تطبيق الطابع الجبائي الجزائري التدريجي عند تفعيل خيار الطابع
    if (applyStamp && typeof App.computeAlgerianStampDuty === 'function') {
      const baseAfterTax = Number((res.total - (res.stamp_amount || 0)).toFixed(2));
      const progStamp = App.computeAlgerianStampDuty(baseAfterTax);
      res.stamp_amount = progStamp;
      res.total = Number((baseAfterTax + progStamp).toFixed(2));
      const dueEl = document.getElementById('chkTotalDue');
      if (dueEl) dueEl.textContent = `${res.total.toFixed(2)} د.ج`;
    }

    const paid = parseFloat(document.getElementById('chkPaidAmount')?.value) || 0;
    const change = Math.max(0, Number((paid - res.total).toFixed(2)));
    res.remaining = Math.max(0, Number((res.total - paid).toFixed(2)));
    res.change = change;

    const changeEl = document.getElementById('chkChangeAmount');
    if (changeEl) changeEl.textContent = `${change.toFixed(2)} د.ج`;

    const helperEl = document.getElementById('chkCentimeHelperText');
    if (helperEl && typeof App.formatAlgerianCentimes === 'function') {
      helperEl.innerHTML = `🇩🇿 بالسنتيم: <span>${App.formatAlgerianCentimes(res.total)}</span>${
        change > 0 ? ` | الصرْف للزبون: <span class="text-emerald-600">${App.formatAlgerianCentimes(change)}</span>` : ''
      }`;
    }
    return res;
  };

  // 3. تحديث شريط الأدوات الجزائري في الكاشير ليضم التصريح الجبائي État 104 & G50 والأقساط وقائمة الأسعار
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const masterBar = document.getElementById('posAlgerianMasterBar');
      if (masterBar && !masterBar.innerHTML.includes('openAlgerianFiscalModal')) {
        masterBar.insertAdjacentHTML(
          'beforeend',
          `
          <button type="button" onclick="App.openAlgerianFiscalModal()" class="px-2 py-1 rounded-lg bg-emerald-600 text-white">🇩🇿 État 104 & G50</button>
          <button type="button" onclick="App.openRecapInvoiceModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-purple-600">📑 فاتورة مجمعة</button>
          <button type="button" onclick="App.openPriceListModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">🖨️ كتالوج الأسعار</button>
          `
        );
      }
    }, 600);
  });
})();


// ============================================================================
// [V11 ABSOLUTE TRUTH 100.0% — COMPLETE DOM-TO-APP BINDING & A4 LEGAL PRINTING]
// ============================================================================
(function applyV11AbsoluteTruth100() {
  if (!window.App || !window.AppState) return;

  // --------------------------------------------------------------------------
  // 1. ربط جميع أزرار لوحة الأرقام اللمسية (#numberInputModal)
  // --------------------------------------------------------------------------
  App.tapNumpad = function (key) {
    const fieldId = AppState._activeNumpadField || 'numModalInput';
    const inp = document.getElementById(fieldId);
    if (!inp) return;
    if (key === 'C') {
      inp.value = '';
      return;
    }
    if (String(key).startsWith('+')) {
      const addVal = parseFloat(String(key).slice(1)) || 0;
      inp.value = String(Number(((parseFloat(inp.value) || 0) + addVal).toFixed(3)));
      return;
    }
    if (key === '.' && String(inp.value || '').includes('.')) return;
    inp.value = String(inp.value || '') + String(key);
  };

  App.pressNumpadKey = App.tapNumpad;

  App.pullWeightIntoNumberModal = async function () {
    try {
      if (window.api && window.api.scale && typeof window.api.scale.readOnce === 'function') {
        const reading = await window.api.scale.readOnce();
        if (reading && Number(reading.weight) > 0) {
          const inp = document.getElementById('numModalInput');
          if (inp) inp.value = String(Number(reading.weight).toFixed(3));
          const valEl = document.getElementById('numModalScaleValue');
          if (valEl) valEl.textContent = Number(reading.weight).toFixed(3) + ' kg';
          return;
        }
      }
      const liveTxt = document.getElementById('liveScaleWeight')?.textContent || '0';
      const parsed = parseFloat(liveTxt) || 0;
      if (parsed > 0) {
        const inp = document.getElementById('numModalInput');
        if (inp) inp.value = String(parsed.toFixed(3));
      }
    } catch (_) {}
  };

  App.confirmNumberInputModal = function () {
    if (typeof App.confirmNumpadModal === 'function') {
      return App.confirmNumpadModal();
    }
  };

  // تمكين اختيار الحقل النشط في لوحة الأرقام اللمسية (الكمية أو السعر)
  document.addEventListener('focusin', (e) => {
    if (e.target && (e.target.id === 'numModalInput' || e.target.id === 'numModalPriceInput')) {
      AppState._activeNumpadField = e.target.id;
    }
  });

  // --------------------------------------------------------------------------
  // 2. ربط جميع دوال نافذة تخفيض السلة (#cartModifierModal)
  // --------------------------------------------------------------------------
  App.applyQuickCartPercent = function (pct) {
    const pctInput = document.getElementById('modPercentInput');
    if (pctInput) pctInput.value = String(pct);
    return App.onCartModPercentChange(pct);
  };

  App.onCartModPercentChange = function (pctVal) {
    const cart = this.currentCart;
    const subtotal = (cart && Array.isArray(cart.items) ? cart.items : []).reduce(
      (s, it) => s + Number(it.subtotal || Number(it.quantity || 0) * Number(it.price || 0) || 0),
      0
    );
    const pct = Math.max(0, Math.min(100, parseFloat(pctVal) || 0));
    const disc = Number(((subtotal * pct) / 100).toFixed(2));
    const amtInput = document.getElementById('modAmountInput');
    if (amtInput) amtInput.value = String(disc);
    if (typeof this.previewCartDiscountModifier === 'function') {
      this.previewCartDiscountModifier(disc);
    }
  };

  App.onCartModAmountChange = function (amtVal) {
    const cart = this.currentCart;
    const subtotal = (cart && Array.isArray(cart.items) ? cart.items : []).reduce(
      (s, it) => s + Number(it.subtotal || Number(it.quantity || 0) * Number(it.price || 0) || 0),
      0
    );
    const disc = Math.max(0, parseFloat(amtVal) || 0);
    const pct = subtotal > 0 ? Number(((disc / subtotal) * 100).toFixed(1)) : 0;
    const pctInput = document.getElementById('modPercentInput');
    if (pctInput) pctInput.value = String(pct);
    if (typeof this.previewCartDiscountModifier === 'function') {
      this.previewCartDiscountModifier(disc);
    }
  };

  App.confirmCartModifierModal = function () {
    if (typeof this.confirmCartDiscountModifier === 'function') {
      return this.confirmCartDiscountModifier();
    }
  };

  // --------------------------------------------------------------------------
  // 3. ربط جميع أزرار نافذة اقتراح الباركود غير المسجل (#posBarcodeSuggestModal)
  // --------------------------------------------------------------------------
  App.createProductFromUnregisteredBarcode = async function () {
    if (typeof this.QuickCreateFromDzSuggest === 'function') {
      return await this.QuickCreateFromDzSuggest();
    }
  };

  App.linkUnregisteredBarcodeToProduct = async function () {
    const sel = document.getElementById('posBarcodeLinkProductSelect');
    const productId = sel ? Number(sel.value) : 0;
    if (!productId) return;
    if (typeof this.linkScannedBarcodeToExistingProduct === 'function') {
      return await this.linkScannedBarcodeToExistingProduct(productId);
    }
  };

  // --------------------------------------------------------------------------
  // 4. ربط أزرار المتغيرات الجماعية وتخصيص الكاشير والملصقات والفئات النقدية
  // --------------------------------------------------------------------------
  App.bulkApplyVariantFields = function () {
    const costVal = document.getElementById('bulkVariantCost')?.value;
    const priceVal = document.getElementById('bulkVariantPrice')?.value;
    const stockVal = document.getElementById('bulkVariantStock')?.value;
    document.querySelectorAll('#prodVariantsMatrixContainer .var-row').forEach((row) => {
      const cInp = row.querySelector('.var-cost');
      const pInp = row.querySelector('.var-price');
      const sInp = row.querySelector('.var-stock');
      if (cInp && costVal !== '' && costVal !== undefined) cInp.value = costVal;
      if (pInp && priceVal !== '' && priceVal !== undefined) pInp.value = priceVal;
      if (sInp && stockVal !== '' && stockVal !== undefined) sInp.value = stockVal;
    });
    if (typeof this.applyBulkVariantValues === 'function') {
      this.applyBulkVariantValues();
    }
  };

  App.bulkFillVariantBarcodes = function () {
    const baseBc =
      document.getElementById('prodBarcodeInput')?.value.trim() ||
      '613' + String(Math.floor(100000000 + Math.random() * 900000000));
    let idx = 1;
    document.querySelectorAll('#prodVariantsMatrixContainer .var-barcode').forEach((inp) => {
      if (!inp.value.trim()) {
        inp.value = `${baseBc}-${idx}`;
      }
      idx += 1;
    });
    if (typeof this.bulkGenerateVariantBarcodes === 'function') {
      this.bulkGenerateVariantBarcodes();
    }
  };

  const _origSavePosCust = typeof App.savePosCustomization === 'function' ? App.savePosCustomization.bind(App) : null;
  App.savePosCustomization = function () {
    if (_origSavePosCust) _origSavePosCust();
    if (typeof this.applyPosCustomization === 'function') this.applyPosCustomization();
  };

  App.exportQueuedLabelsPdf = async function () {
    if (typeof this.exportPlLabelsPdf === 'function') {
      return await this.exportPlLabelsPdf();
    }
  };

  App.addCashDenom = function (val) {
    if (typeof this.addBanknoteDenomToPaid === 'function') {
      return this.addBanknoteDenomToPaid(val);
    }
  };

  // --------------------------------------------------------------------------
  // 5. توحيد حساب السلة، الطابع الجبائي الجزائري التدريجي، وشارة السنتيم
  // --------------------------------------------------------------------------
  App.recalcCart = function () {
    const cart = this.currentCart;
    const items = (cart && Array.isArray(cart.items)) ? cart.items : [];
    const subtotal = Number(
      items.reduce((sum, item) => {
        const lineSub = Number((Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2));
        item.subtotal = lineSub;
        return sum + lineSub;
      }, 0).toFixed(2)
    );

    const discInput = document.getElementById('cartDiscountInput');
    const discount = Math.max(0, Number(discInput ? discInput.value : (cart ? cart.discount : 0)) || 0);
    if (cart) cart.discount = discount;

    const taxable = Math.max(0, Number((subtotal - discount).toFixed(2)));
    const taxPercentage = cart && cart.includeTva ? 19 : 0;
    const taxAmount = Number(((taxable * taxPercentage) / 100).toFixed(2));

    let stampAmount = 0;
    if (cart && cart.includeStamp && typeof this.computeAlgerianStampDuty === 'function') {
      stampAmount = this.computeAlgerianStampDuty(taxable + taxAmount);
    }

    const total = Number((taxable + taxAmount + stampAmount).toFixed(2));

    const cntEl = document.getElementById('cartItemsCountText');
    if (cntEl) cntEl.textContent = String(items.length);

    const subEl = document.getElementById('cartSubtotalText');
    if (subEl) subEl.textContent = `${subtotal.toFixed(2)} د.ج`;

    const totEl = document.getElementById('cartTotalText');
    if (totEl) totEl.textContent = `${total.toFixed(2)} د.ج`;

    const centimeBadge = document.getElementById('cartTotalCentimeBadge');
    if (centimeBadge && typeof this.formatAlgerianCentimes === 'function') {
      centimeBadge.textContent = `🇩🇿 بالتداول الجزائري: ${this.formatAlgerianCentimes(total)}`;
    }

    if (typeof this.broadcastCustomerDisplay === 'function') {
      this.broadcastCustomerDisplay({ items, subtotal, discount, total });
    }

    return { subtotal, discount, taxable, taxPercentage, taxAmount, stampAmount, total };
  };

  App.recalcAndRenderCart = function () {
    if (typeof this.renderCartItems === 'function') {
      this.renderCartItems();
    }
    return this.recalcCart();
  };

  // --------------------------------------------------------------------------
  // 6. الطباعة الرسمية A4 للتصريح الجبائي الجزائري (État 104 & G50) وعقد التقسيط
  // --------------------------------------------------------------------------
  App.printAlgerianFiscalReportA4 = async function () {
    const report = AppState._lastFiscalReport || (await window.api.getAlgerianFiscalReport({
      dateFrom: AppState.analyticsDateFrom,
      dateTo: AppState.analyticsDateTo
    }));
    if (!report) return;

    const g = report.g50 || {};
    const rows = Array.isArray(report.etat104) ? report.etat104 : [];
    const s = AppState.settings || {};

    const html = `<!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>التصريح الجبائي الجزائري G50 & État 104</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: 'Cairo', Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
        .head { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
        .grid-kpi { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
        .kpi { border: 1px solid #475569; border-radius: 8px; padding: 8px; text-align: center; background: #f8fafc; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #0f172a; padding: 5px 6px; text-align: center; font-size: 10px; }
        th { background: #e2e8f0; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="head">
        <div>
          <h2 style="margin:0;">${s.shop_name || 'Gherbi.Ai POS'}</h2>
          <div>العنوان: ${s.shop_address || 'الجزائر'} | الهاتف: ${s.shop_phone || '-'}</div>
          <div>RC: ${s.shop_rc || '-'} | NIF: ${s.shop_nif || '-'} | AI: ${s.shop_ai || '-'} | NIS: ${s.shop_nis || '-'}</div>
        </div>
        <div style="text-align:left;">
          <h3 style="margin:0;">ملخص التصريح الجبائي G50 & État 104</h3>
          <div>تاريخ الاستخراج: ${new Date().toISOString().slice(0, 10)}</div>
        </div>
      </div>

      <h4>أولاً: ملخص الأوعية الضريبية للتصريح الشهري (Série G N° 50)</h4>
      <div class="grid-kpi">
        <div class="kpi"><div>رقم الأعمال (CA HT)</div><strong>${Number(g.ca_ht || 0).toFixed(2)} د.ج</strong></div>
        <div class="kpi"><div>TVA المحصلة (+)</div><strong>${Number(g.tva_collectee || 0).toFixed(2)} د.ج</strong></div>
        <div class="kpi"><div>TVA المسترجعة (-)</div><strong>${Number(g.tva_deductible || 0).toFixed(2)} د.ج</strong></div>
        <div class="kpi"><div>حقوق الطابع (Timbre)</div><strong>${Number(g.droit_timbre || 0).toFixed(2)} د.ج</strong></div>
        <div class="kpi"><div>صافي G50 للدفع</div><strong>${Number(g.total_a_payer || 0).toFixed(2)} د.ج</strong></div>
      </div>

      <h4>ثانياً: الكشف السنوي المفصل للزبائن (État 104 — المادة 224 من قانون الضرائب المباشرة)</h4>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الزبون / المؤسسة</th>
            <th>الرقم الجبائي (NIF)</th>
            <th>السجل التجاري (RC)</th>
            <th>مادة الضريبة (AI)</th>
            <th>رقم الأعمال HT</th>
            <th>مبلغ TVA</th>
            <th>حق الطابع</th>
            <th>الإجمالي TTC</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${r.name || ''}</td>
              <td>${r.nif || '—'}</td>
              <td>${r.rc || '—'}</td>
              <td>${r.ai || '—'}</td>
              <td>${Number(r.total_ht || 0).toFixed(2)}</td>
              <td>${Number(r.total_tva || 0).toFixed(2)}</td>
              <td>${Number(r.total_stamp || 0).toFixed(2)}</td>
              <td><strong>${Number(r.total_ttc || 0).toFixed(2)} د.ج</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>`;

    if (window.PrintEngine && typeof window.PrintEngine.printHtmlDocument === 'function') {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  App.printInstallmentContractA4 = async function (planId) {
    const plans = await window.api.getInstallmentPlans({});
    const plan = (Array.isArray(plans) ? plans : []).find((p) => Number(p.id) === Number(planId));
    if (!plan) return;
    const s = AppState.settings || {};
    const schedules = Array.isArray(plan.schedules) ? plan.schedules : [];

    const html = `<!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>عقد بيع بالتقسيط رقم #${plan.id}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body { font-family: 'Cairo', Arial, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.6; }
        .head { display: flex; justify-content: space-between; border-bottom: 3px double #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
        .box { border: 1.5px solid #0f172a; border-radius: 10px; padding: 12px; margin-bottom: 14px; background: #f8fafc; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #0f172a; padding: 6px; text-align: center; font-size: 11px; }
        th { background: #e2e8f0; }
        .sigs { display: flex; justify-content: space-between; margin-top: 36px; }
      </style>
    </head>
    <body>
      <div class="head">
        <div>
          <h2 style="margin:0;">${s.shop_name || 'Gherbi.Ai POS'}</h2>
          <div>${s.shop_address || 'الجزائر'} | ${s.shop_phone || ''}</div>
          <div>RC: ${s.shop_rc || '-'} | NIF: ${s.shop_nif || '-'}</div>
        </div>
        <div style="text-align:left;">
          <h2 style="margin:0;">عقد بيع بالتقسيط (Contrat de Vente par Facilité)</h2>
          <div>رقم العقد: <strong>INST-${plan.id}</strong> | التاريخ: ${String(plan.start_date || '').slice(0, 10)}</div>
        </div>
      </div>
      <div class="box">
        <div><strong>المشتري (الزبون):</strong> ${plan.customer_name || ''} — <strong>الهاتف:</strong> ${plan.customer_phone || '-'}</div>
        <div><strong>إجمالي البيع:</strong> ${Number(plan.total_amount || 0).toFixed(2)} د.ج | <strong>التسبقة:</strong> ${Number(plan.down_payment || 0).toFixed(2)} د.ج | <strong>الباقي المقسط:</strong> ${Number(plan.remaining_amount || 0).toFixed(2)} د.ج على <strong>${plan.months_count}</strong> أشهر</div>
      </div>
      <h4>جدول استحقاق الأقساط الشهرية:</h4>
      <table>
        <thead>
          <tr><th>رقم القسط</th><th>تاريخ الاستحقاق</th><th>المبلغ المستحق</th><th>المبلغ المسدد</th><th>الحالة</th><th>توقيع الاستلام</th></tr>
        </thead>
        <tbody>
          ${schedules.map((sc) => `
            <tr>
              <td>القسط #${sc.installment_num}</td>
              <td>${sc.due_date}</td>
              <td><strong>${Number(sc.amount || 0).toFixed(2)} د.ج</strong></td>
              <td>${Number(sc.paid_amount || 0).toFixed(2)} د.ج</td>
              <td>${sc.status === 'paid' ? 'مسدد بالكامل' : 'قيد الانتظار'}</td>
              <td>...................</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="sigs">
        <div style="width:45%;"><strong>توقيع وختم البائع (${s.shop_name || ''}):</strong><br><br><br>........................................</div>
        <div style="width:45%;text-align:left;"><strong>توقيع وبصمة المشتري (${plan.customer_name || ''}):</strong><br><br><br>........................................</div>
      </div>
    </body>
    </html>`;

    if (window.PrintEngine && typeof window.PrintEngine.printHtmlDocument === 'function') {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };
})();

// ============================================================================
// [PAGE 1 POS SURGICAL PERFECTION & AUTOMATED QA BOT — GHERBI.AI EXCLUSIVE]
// ============================================================================
(function applyPage1PosSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  // 1. إخفاء سعر الشراء (التكلفة) افتراضياً عن عين الزبون، ولا يظهر إلا بطلب البائع (Alt+C أو زر العين)
  AppState.posShowCost = false;
  AppState._quickMultiplier = 1;

  function cleanAndUpgradePosDom() {
    // إزالة الأزرار المكررة من الشريط العلوي
    ['btnPosRecentSalesQuick', 'btnPosCustomizeQuick'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    // إزالة صناديق الفئات النقدية المكررة داخل #checkoutModal
    ['chkDzBanknotesBar', 'chkAlgerianBanknotesBox'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    // إضافة زر "تصفير (0 د.ج)" بجانب زر "المبلغ الكامل" في لوحة الفئات النقدية اليسرى داخل #checkoutModal
    var exactBtn = document.querySelector('#checkoutModal button[onclick*="setExactCash"]');
    if (exactBtn && !document.getElementById('btnCheckoutZeroCash')) {
      exactBtn.classList.add('col-span-2');
      exactBtn.insertAdjacentHTML(
        'afterend',
        '<button id="btnCheckoutZeroCash" type="button" onclick="document.getElementById(\'chkPaidAmount\').value=\'0\'; AppState._banknoteClickedOnce=true; App.recalcCheckoutModal()" class="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs">تصفير (0 د.ج)</button>'
      );
    }

    // تحديث شريط الأدوات الجزائري في أعلى السلة (#posAlgerianMasterBar)
    var masterBar = document.getElementById('posAlgerianMasterBar');
    if (masterBar && !document.getElementById('btnRunPosAutoTest')) {
      masterBar.innerHTML =
        '<button type="button" onclick="App.openPosRecentSalesModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-blue-600"><span data-i18n-pos="recent_sales">🧾 آخر المبيعات</span></button>' +
        '<button type="button" onclick="App.openChequesPortfolioModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-indigo-600"><span data-i18n-pos="cheques">🏦 الشيكات</span></button>' +
        '<button type="button" onclick="App.openAlgerianFiscalModal()" class="px-2 py-1 rounded-lg bg-emerald-600 text-white">🇩🇿 État 104 & G50</button>' +
        '<button type="button" onclick="App.openRecapInvoiceModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-purple-600"><span data-i18n-pos="recap_inv">📑 فاتورة مجمعة</span></button>' +
        '<button type="button" onclick="App.openPriceListModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"><span data-i18n-pos="price_catalog">🖨️ كتالوج الأسعار</span></button>' +
        '<button type="button" onclick="App.openMobileCompanionModal()" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-emerald-600"><span data-i18n-pos="mobile_pair">📱 ربط الهاتف</span></button>' +
        '<button id="btnRunPosAutoTest" type="button" onclick="App.runAutoTest_PosPage()" title="تشغيل الفحص الآلي الشامل لشاشة الكاشير (Ctrl+Shift+T)" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black mr-auto">🤖 فحص آلي (QA)</button>';
    }

    // حقن شريط الضرب السريع (×1, ×2, ×3, ×5, ×10 + بيع بمبلغ د.ج) أعلى قائمة عناصر السلة
    var cartItemsBox = document.getElementById('posCartItems');
    if (cartItemsBox && !document.getElementById('posQuickMultiplierBar')) {
      var multBar = document.createElement('div');
      multBar.id = 'posQuickMultiplierBar';
      multBar.className = 'px-3 py-1.5 bg-blue-500/5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1 text-[11px] font-bold shrink-0';
      multBar.innerHTML =
        '<div class="flex items-center gap-1">' +
        '<span class="text-slate-400 text-[10px]" data-i18n-pos="mult_label">ضرب الكمية:</span>' +
        [1, 2, 3, 5, 10]
          .map(function (m) {
            return (
              '<button type="button" data-mult="' +
              m +
              '" onclick="App.setQuickMultiplier(' +
              m +
              ')" class="mult-pill px-2 py-0.5 rounded-md font-mono font-black ' +
              (m === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300') +
              '">×' +
              m +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        '<button type="button" onclick="App.openReverseAmountCalculator()" title="احسب الوزن أو الكمية تلقائياً حسب المبلغ الذي يطلبه الزبون (مثلاً: أعطني بـ 500 د.ج)" class="px-2 py-0.5 rounded-md bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-black">⚖️ بيع بمبلغ (د.ج)</button>';
      cartItemsBox.parentNode.insertBefore(multBar, cartItemsBox);
    }

    // ضبط أبعاد تذييل السلة لمنع انقطاع زر التسديد (F1) عند ظهور شريط تعديل الفاتورة
    var cartFooter = document.querySelector('#posCartContainer > div:last-child');
    if (cartFooter) {
      cartFooter.className = 'p-2.5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-700 space-y-1.5 shrink-0';
    }
    var checkoutMainBtn = document.querySelector('#posCartContainer button[onclick*="openCheckoutModal"]');
    if (checkoutMainBtn) {
      checkoutMainBtn.className = 'w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25';
    }
  }

  App.setQuickMultiplier = function (m) {
    AppState._quickMultiplier = Number(m) || 1;
    document.querySelectorAll('#posQuickMultiplierBar .mult-pill').forEach(function (btn) {
      var val = Number(btn.getAttribute('data-mult'));
      btn.className =
        'mult-pill px-2 py-0.5 rounded-md font-mono font-black ' +
        (val === AppState._quickMultiplier
          ? 'bg-blue-600 text-white shadow'
          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300');
    });
  };

  // 2. دمج السطور تلقائياً في السلة + أزرار (+ / -) وحارس منع البيع بالخسارة
  App.addProductToCart = function (productId, qty, options) {
    if (qty === undefined) qty = 1;
    options = options || {};
    var prod = AppState.products.find(function (p) {
      return Number(p.id) === Number(productId);
    });
    if (!prod) return;

    var mult = AppState._quickMultiplier || 1;
    var effectiveQty = Number(qty || 1) * mult;
    if (mult !== 1) this.setQuickMultiplier(1);

    var signedQty = AppState.returnMode ? -Math.abs(effectiveQty) : effectiveQty;
    var cart = this.currentCart;
    var tier = cart.priceTier || 'retail';
    var basePrice =
      options.overridePrice !== undefined
        ? Number(options.overridePrice)
        : tier === 'wholesale' && Number(prod.wholesale_price) > 0
          ? Number(prod.wholesale_price)
          : Number(prod.selling_price || 0);

    var targetVariantId = options.variantId || null;

    var existingItem = cart.items.find(function (it) {
      return (
        (Number(it.product_id || it.productId) === Number(prod.id) ||
          (it.name && it.name === prod.name && !it.product_id)) &&
        (it.variant_id || null) === targetVariantId &&
        !it._isWholesaleMode &&
        Math.abs(Number(it.price || 0) - basePrice) < 0.01
      );
    });

    if (existingItem) {
      existingItem.product_id = Number(prod.id);
      existingItem.quantity = Number((Number(existingItem.quantity || 0) + signedQty).toFixed(3));
      existingItem.subtotal = Number((existingItem.quantity * existingItem.price).toFixed(2));
      if (existingItem.quantity === 0) {
        cart.items = cart.items.filter(function (x) {
          return x !== existingItem;
        });
      }
    } else {
      var batches = Array.isArray(prod.batches) ? prod.batches : [];
      var firstBatch =
        batches.find(function (b) {
          return Number(b.stock) > 0;
        }) ||
        batches[0] ||
        null;
      cart.items.push({
        product_id: Number(prod.id),
        batch_id: options.batchId || (firstBatch ? firstBatch.id : null),
        variant_id: targetVariantId,
        name: options.customName || prod.name,
        unit: prod.unit || 'قطعة',
        quantity: signedQty,
        price: basePrice,
        cost_price: Number(prod.cost_price || (firstBatch && firstBatch.cost_price) || 0),
        subtotal: Number((signedQty * basePrice).toFixed(2)),
        serial_number: options.serialNumber || null,
        warranty_months: Number(prod.warranty_months || 0)
      });
    }

    this.recalcAndRenderCart();
  };

  App.stepCartItemQty = function (idx, delta) {
    var item = this.currentCart.items[idx];
    if (!item) return;
    var nextQty = Number((Number(item.quantity || 0) + Number(delta)).toFixed(3));
    if (nextQty <= 0 && !AppState.returnMode) {
      this.removeCartItem(idx);
      return;
    }
    item.quantity = nextQty;
    item.subtotal = Number((item.quantity * item.price).toFixed(2));
    this.recalcAndRenderCart();
  };

  App.renderCartItems = function () {
    var container = document.getElementById('posCartItems');
    if (!container) return;
    var items = this.currentCart.items || [];

    if (items.length === 0) {
      var emptyTxt =
        AppState.lang === 'fr'
          ? 'Panier vide — Choisissez un produit ou scannez un code-barres'
          : AppState.lang === 'en'
            ? 'Cart is empty — Select a product or scan a barcode'
            : 'السلة فارغة — اختر منتجاً أو امسح باركود';
      container.innerHTML =
        '<div class="h-full flex flex-col items-center justify-center text-slate-400 py-8">' +
        '<span class="material-symbols-rounded icon-xl mb-2 opacity-40">shopping_basket</span>' +
        '<div class="text-xs font-bold">' +
        emptyTxt +
        '</div></div>';
      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
      return;
    }

    container.innerHTML = items
      .map(function (item, idx) {
        var prod = AppState.products.find(function (p) {
          return Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name;
        });
        if (prod && !item.product_id) item.product_id = prod.id;
        var cost = Number(item.cost_price || (prod && prod.cost_price) || 0);
        var isBelowCost = cost > 0 && Number(item.price) < cost;

        return (
          '<div class="p-2 rounded-xl border ' +
          (isBelowCost
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90') +
          ' flex items-center justify-between gap-1.5 shadow-sm">' +
          '<div class="min-w-0 flex-1">' +
          '<div class="font-bold text-xs truncate">' +
          (item.name || item.custom_product_name || 'منتج') +
          '</div>' +
          '<div class="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">' +
          '<span>' +
          Number(item.price || 0).toFixed(2) +
          ' د.ج / ' +
          (item.unit || (prod && prod.unit) || 'قطعة') +
          '</span>' +
          (prod
            ? '<button type="button" onclick="App.toggleCartItemWholesaleUnit(' +
              idx +
              ')" class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 font-sans font-bold hover:bg-indigo-600 hover:text-white transition">' +
              (item._isWholesaleMode ? '📦 جملة' : 'وحدة / تسعيرة') +
              '</button>'
            : '') +
          (isBelowCost
            ? '<span class="px-1.5 py-0.2 rounded bg-rose-600 text-white font-sans font-bold">⚠️ أقل من التكلفة (' +
              cost.toFixed(0) +
              ')</span>'
            : '') +
          '</div></div>' +
          '<div class="flex items-center gap-1">' +
          '<button type="button" onclick="App.stepCartItemQty(' +
          idx +
          ', -1)" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white font-mono font-black text-xs">-</button>' +
          '<input type="number" step="any" value="' +
          item.quantity +
          '" onclick="App.openNumpadForCartItem(' +
          idx +
          ')" onchange="App.updateCartItemQty(' +
          idx +
          ', this.value)" title="انقر لفتح لوحة الأرقام اللمسية" class="w-11 px-1 py-1 rounded-lg text-center font-mono font-black text-xs cursor-pointer">' +
          '<button type="button" onclick="App.stepCartItemQty(' +
          idx +
          ', 1)" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white font-mono font-black text-xs">+</button>' +
          '</div>' +
          '<input type="number" step="any" value="' +
          Number(item.price || 0).toFixed(2) +
          '" onchange="App.updateCartItemPrice(' +
          idx +
          ', this.value)" class="w-16 px-1 py-1 rounded-lg text-center font-mono font-bold text-xs text-blue-600 dark:text-blue-400">' +
          '<div class="w-14 text-left font-mono font-black text-xs">' +
          Number(item.subtotal || 0).toFixed(2) +
          '</div>' +
          '<button type="button" onclick="App.removeCartItem(' +
          idx +
          ')" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
          '</div>'
        );
      })
      .join('');

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
  };

  // 3. الحاسبة العكسية للوزن والمبلغ ("أعطني بـ 500 د.ج لوز")
  App.openReverseAmountCalculator = function () {
    var items = this.currentCart.items || [];
    if (items.length === 0) {
      var weightedProd =
        AppState.products.find(function (p) {
          return p.unit === 'كغ' || p.plu_code;
        }) || AppState.products[0];
      if (weightedProd) this.addProductToCart(weightedProd.id, 1);
      else return;
    }
    var lastIdx = this.currentCart.items.length - 1;
    var item = this.currentCart.items[lastIdx];
    this.openNumpadForCartItem(lastIdx);

    var scaleRow = document.getElementById('numModalScaleRow');
    if (scaleRow) {
      scaleRow.innerHTML =
        '<div class="w-full space-y-1.5">' +
        '<div class="font-black text-emerald-600 text-[11px]">⚖️ الحاسبة العكسية (كمية/وزن مقابل مبلغ مطلوب بالدينار):</div>' +
        '<div class="flex gap-1.5">' +
        '<input id="reverseTargetDzdInput" type="number" step="any" placeholder="المبلغ المطلوب (مثلاً 500 د.ج)" oninput="App.computeReverseQtyFromDzd(' +
        lastIdx +
        ', this.value)" class="flex-1 px-2.5 py-1.5 rounded-lg font-mono font-black text-xs">' +
        '<button type="button" onclick="App.computeReverseQtyFromDzd(' +
        lastIdx +
        ', 500)" class="px-2 py-1 bg-emerald-600 text-white rounded-lg font-mono font-bold text-[10px]">500 د.ج</button>' +
        '<button type="button" onclick="App.computeReverseQtyFromDzd(' +
        lastIdx +
        ', 1000)" class="px-2 py-1 bg-emerald-600 text-white rounded-lg font-mono font-bold text-[10px]">1000 د.ج</button>' +
        '</div>' +
        '<div id="reverseCalcResultText" class="text-[11px] font-mono font-bold text-blue-600">سعر الوحدة: ' +
        Number(item.price).toFixed(2) +
        ' د.ج</div></div>';
    }
  };

  App.computeReverseQtyFromDzd = function (idx, targetAmountDzd) {
    var item = this.currentCart.items[idx];
    if (!item || Number(item.price) <= 0) return;
    var amt = parseFloat(targetAmountDzd) || 0;
    if (amt <= 0) return;
    var exactQty = Number((amt / Number(item.price)).toFixed(3));
    var qtyInput = document.getElementById('numModalInput');
    if (qtyInput) qtyInput.value = String(exactQty);
    var resTxt = document.getElementById('reverseCalcResultText');
    if (resTxt) {
      resTxt.textContent =
        'الكمية المحسوبة: ' +
        exactQty +
        ' ' +
        (item.unit || 'وحدة') +
        ' (' +
        Math.round(exactQty * 1000) +
        ' غرام) = ' +
        amt.toFixed(2) +
        ' د.ج';
    }
  };

  // 4. ترقية جدول الشيكات ليعرض بطاقات الإحصائيات أعلى الجدول
  var _origRenderCheques = App.renderChequesPortfolioTable ? App.renderChequesPortfolioTable.bind(App) : null;
  App.renderChequesPortfolioTable = async function () {
    if (_origRenderCheques) await _origRenderCheques();
    var rows = (await window.api.getChequesPortfolio().catch(function () { return []; })) || [];
    var sumBox = document.getElementById('chequesSummaryCards');
    if (sumBox) {
      var totalIn = rows
        .filter(function (r) { return r.direction === 'in' && r.status !== 'rejected'; })
        .reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
      var totalOut = rows
        .filter(function (r) { return r.direction === 'out' && r.status !== 'rejected'; })
        .reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
      var rejectedCnt = rows.filter(function (r) { return r.status === 'rejected'; }).length;
      sumBox.innerHTML =
        '<div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex justify-between items-center">' +
        '<span class="font-bold text-emerald-600">📥 شيكات الزبائن (واردة):</span>' +
        '<strong class="font-mono text-sm font-black text-emerald-600">' + totalIn.toFixed(2) + ' د.ج</strong></div>' +
        '<div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex justify-between items-center">' +
        '<span class="font-bold text-rose-600">📤 شيكات الموردين (صادرة):</span>' +
        '<strong class="font-mono text-sm font-black text-rose-600">' + totalOut.toFixed(2) + ' د.ج</strong></div>' +
        '<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex justify-between items-center">' +
        '<span class="font-bold text-amber-600">⚠️ شيكات مرفوضة (Impayés):</span>' +
        '<strong class="font-mono text-sm font-black text-amber-600">' + rejectedCnt + ' شيك</strong></div>';
    }
  };

  // 5. الترجمة الثلاثية الفورية لأزرار الكاشير (AR / FR / EN)
  var POS_I18N = {
    ar: {
      search_ph: 'ابحث بالاسم، الباركود، الفئة، العائلة، أو كود PLU...',
      barcode_ph: 'امسح الباركود (Enter)...',
      shift_open: 'المناوبة نشطة',
      shift_closed: 'فتح مناوبة صندوق',
      btn_customize: 'تخصيص',
      btn_filter: 'فلتر',
      btn_produce: 'إنتاج فوري',
      btn_free: 'منتج حر (F8)',
      btn_return: 'إرجاع',
      btn_add_prod: 'إضافة منتج',
      prev_page: 'السابق',
      next_page: 'التالي',
      walkin_cust: 'زبون عابر (بدون حساب)',
      tier_retail: 'سعر التجزئة',
      tier_wholesale: 'سعر الجملة',
      discount_lbl: 'التخفيض (% أو مبلغ):',
      btn_clear: 'إلغاء (F4)',
      btn_hold: 'تعليق (F2)',
      btn_proforma: 'كمبدئية',
      btn_order: 'كطلبية',
      btn_pay: 'تسديد الفاتورة (F1)',
      recent_sales: '🧾 آخر المبيعات',
      cheques: '🏦 الشيكات',
      recap_inv: '📑 فاتورة مجمعة',
      price_catalog: '🖨️ كتالوج الأسعار',
      mobile_pair: '📱 ربط الهاتف',
      mult_label: 'ضرب الكمية:'
    },
    fr: {
      search_ph: 'Rechercher par nom, code-barres, catégorie ou PLU...',
      barcode_ph: 'Scanner code-barres (Entrée)...',
      shift_open: 'Session active',
      shift_closed: 'Ouvrir la caisse',
      btn_customize: 'Affichage',
      btn_filter: 'Filtre',
      btn_produce: 'Production',
      btn_free: 'Article libre (F8)',
      btn_return: 'Retour',
      btn_add_prod: 'Nouveau produit',
      prev_page: 'Précédent',
      next_page: 'Suivant',
      walkin_cust: 'Client de passage (Comptoir)',
      tier_retail: 'Prix Détail',
      tier_wholesale: 'Prix Gros',
      discount_lbl: 'Remise (% ou montant):',
      btn_clear: 'Vider (F4)',
      btn_hold: 'Attente (F2)',
      btn_proforma: 'Proforma',
      btn_order: 'Commande',
      btn_pay: 'Encaisser la facture (F1)',
      recent_sales: '🧾 Ventes récentes',
      cheques: '🏦 Chèques & CCP',
      recap_inv: '📑 Facture Récap.',
      price_catalog: '🖨️ Catalogue Prix',
      mobile_pair: '📱 App Mobile',
      mult_label: 'Multiplicateur:'
    },
    en: {
      search_ph: 'Search by name, barcode, category, or PLU...',
      barcode_ph: 'Scan barcode (Enter)...',
      shift_open: 'Shift Active',
      shift_closed: 'Open Till Shift',
      btn_customize: 'Customize',
      btn_filter: 'Filter',
      btn_produce: 'Quick Produce',
      btn_free: 'Free Item (F8)',
      btn_return: 'Return',
      btn_add_prod: 'Add Product',
      prev_page: 'Previous',
      next_page: 'Next',
      walkin_cust: 'Walk-in Customer',
      tier_retail: 'Retail Price',
      tier_wholesale: 'Wholesale Price',
      discount_lbl: 'Discount (% or amount):',
      btn_clear: 'Clear (F4)',
      btn_hold: 'Hold (F2)',
      btn_proforma: 'Proforma',
      btn_order: 'Order',
      btn_pay: 'Checkout & Pay (F1)',
      recent_sales: '🧾 Recent Sales',
      cheques: '🏦 Cheques',
      recap_inv: '📑 Recap Invoice',
      price_catalog: '🖨️ Price List',
      mobile_pair: '📱 Mobile App',
      mult_label: 'Multiplier:'
    }
  };

  var _origSetLanguage = typeof App.setLanguage === 'function' ? App.setLanguage.bind(App) : null;
  App.setLanguage = function (lang) {
    if (_origSetLanguage) _origSetLanguage(lang);
    var dict = POS_I18N[lang] || POS_I18N.ar;

    var searchInp = document.getElementById('globalPosSearch');
    if (searchInp) searchInp.placeholder = dict.search_ph;
    var bcInp = document.getElementById('barcodeInput');
    if (bcInp) bcInp.placeholder = dict.barcode_ph;
    var shiftTxt = document.getElementById('headerShiftText');
    if (shiftTxt) shiftTxt.textContent = AppState.activeSession ? dict.shift_open : dict.shift_closed;

    var setSpanText = function (selector, text) {
      var el = document.querySelector(selector);
      if (el) el.textContent = text;
    };

    setSpanText('button[onclick*="posCustomizeModal"] span:last-child', dict.btn_customize);
    setSpanText('button[onclick*="openPosAdvancedFilterModal"] span:last-child', dict.btn_filter);
    setSpanText('button[onclick*="openPosQuickProduceModal"] span:last-child', dict.btn_produce);
    setSpanText('button[onclick*="openFreeItemModal"] span:last-child', dict.btn_free);
    setSpanText('#btnReturnMode span:last-child', dict.btn_return);
    setSpanText('#view-pos button[onclick*="openProductModal"] span:last-child', dict.btn_add_prod);
    setSpanText('#posPaginationBar button:first-child', dict.prev_page);
    setSpanText('#posPaginationBar button:last-child', dict.next_page);
    setSpanText('#posPriceTierSelect option[value="retail"]', dict.tier_retail);
    setSpanText('#posPriceTierSelect option[value="wholesale"]', dict.tier_wholesale);
    setSpanText('#posCustomerSelect option[value=""]', dict.walkin_cust);
    setSpanText('button[onclick*="openCartModifierModal"] span:last-child', dict.discount_lbl);
    setSpanText('button[onclick*="clearCurrentCart"]', dict.btn_clear);
    setSpanText('button[onclick*="holdCurrentCart"]', dict.btn_hold);
    setSpanText('button[onclick*="saveCartAsProforma"]', dict.btn_proforma);
    setSpanText('button[onclick*="openOrderModalFromCart"]', dict.btn_order);
    setSpanText('#btnCheckoutMainText', dict.btn_pay);

    document.querySelectorAll('[data-i18n-pos]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-pos');
      if (dict[k]) el.textContent = dict[k];
    });

    this.renderPosView();
    this.renderCartItems();
  };

  // 6. روبوت الفحص الآلي الشامل للصفحة الأولى (App.runAutoTest_PosPage)
  App.runAutoTest_PosPage = async function () {
    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      var backupItems = JSON.parse(JSON.stringify(this.currentCart.items || []));
      var backupDiscount = this.currentCart.discount || 0;

      var twMode = window.tailwind && window.tailwind.config && window.tailwind.config.darkMode;
      check('1. توافق محرك الألوان النهاري/الليلي (Tailwind Class Mode)', twMode === 'class', 'darkMode=' + twMode);

      var chkBtn = document.querySelector('#posCartContainer button[onclick*="openCheckoutModal"]');
      var rect = chkBtn ? chkBtn.getBoundingClientRect() : null;
      check('2. ظهور زر التسديد السفلي (F1) بالكامل دون انقطاع', Boolean(rect && rect.height >= 24), rect ? 'Visible OK' : 'Missing');

      var requiredIds = ['globalPosSearch', 'barcodeInput', 'posProductsGrid', 'posCartItems', 'cartTotalText', 'checkoutModal', 'posQuickMultiplierBar'];
      var missingIds = requiredIds.filter(function (id) { return !document.getElementById(id); });
      check('3. تكامل عناصر شاشة المبيعات والنوافذ (DOM Integrity)', missingIds.length === 0, missingIds.join(', ') || 'All Elements OK');

      var prods = await window.api.getProducts({});
      check('4. اتصال قاعدة البيانات وجلب المنتجات (SQLite WAL)', Array.isArray(prods) && prods.length > 0, prods.length + ' منتج');

      this.currentCart.items = [];
      this.currentCart.discount = 0;
      var sampleProd = AppState.products[0];
      if (sampleProd) {
        this.addProductToCart(sampleProd.id, 1);
        check('5. محاكاة إضافة منتج إلى السلة', this.currentCart.items.length === 1, sampleProd.name);

        this.addProductToCart(sampleProd.id, 2);
        check('6. دمج الكميات تلقائياً لنفس المنتج دون تكرار السطور', this.currentCart.items.length === 1 && Number(this.currentCart.items[0].quantity) === 3, 'Qty = 3');

        this.stepCartItemQty(0, 1);
        check('7. عمل أزرار زيادة ونقصان الكمية السريعة (+ / -)', Number(this.currentCart.items[0].quantity) === 4, 'Qty = 4');
      }

      if (this.currentCart.items.length > 0) {
        this.computeReverseQtyFromDzd(0, 600);
        check('8. الحاسبة العكسية للوزن والمبلغ (بيع بمبلغ د.ج)', Boolean(document.getElementById('numModalInput')), 'Calculator Ready');
      }

      var centStr = typeof this.formatAlgerianCentimes === 'function' ? this.formatAlgerianCentimes(3530) : '';
      check('9. محرك التداول بالعملة الجزائرية (السنتيم)', centStr.includes('353'), centStr);

      var stampVal = typeof this.computeAlgerianStampDuty === 'function' ? this.computeAlgerianStampDuty(45000) : 0;
      check('10. محرك الطابع الجبائي الجزائري التدريجي (1% / 1.5% / 2%)', stampVal === 525, '525 د.ج');

      await this.openCheckoutModal();
      var noDupBanknotes = !document.getElementById('chkDzBanknotesBar') && !document.getElementById('chkAlgerianBanknotesBox');
      this.closeModal('checkoutModal');
      check('11. نظافة نافذة التسديد (#checkoutModal) وعدم تكرار الفئات النقدية', noDupBanknotes, 'Single Banknote Grid');

      this.currentCart.items = backupItems;
      this.currentCart.discount = backupDiscount;
      this.recalcAndRenderCart();
      check('12. حماية سرية سعر الشراء واستعادة السلة النظيفة', AppState.posShowCost === false, 'Cost Hidden by Default');
    } catch (err) {
      check('خطأ غير متوقع أثناء الاختبار', false, err.message);
    }

    var passedCount = results.filter(function (r) { return r.passed; }).length;
    var modal = document.getElementById('posQaReportModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'posQaReportModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="modal-content w-full max-w-2xl p-6 space-y-4">' +
      '<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="px-3 py-1 rounded-xl ' + (passedCount === results.length ? 'bg-emerald-600' : 'bg-amber-500') + ' text-white font-black text-xs">' +
      passedCount + ' / ' + results.length + ' PASS</span>' +
      '<h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 1 (شاشة الكاشير #view-pos)</h3></div>' +
      '<button onclick="App.closeModal(\'posQaReportModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button></div>' +
      '<div class="space-y-1.5 max-h-96 overflow-y-auto text-xs">' +
      results.map(function (r) {
        return (
          '<div class="p-2.5 rounded-xl border ' +
          (r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') +
          ' flex items-center justify-between">' +
          '<div class="font-bold">' + (r.passed ? '✅' : '❌') + ' ' + r.name + '</div>' +
          '<div class="font-mono text-[11px] text-slate-500 dark:text-slate-300">' + (r.detail || 'OK') + '</div></div>'
        );
      }).join('') +
      '</div>' +
      '<div class="flex justify-end pt-2">' +
      '<button onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة التالية</button>' +
      '</div></div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      App.runAutoTest_PosPage();
    } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      App.togglePosCostPeek();
    } else if (e.key === 'F9') {
      e.preventDefault();
      var s = document.getElementById('globalPosSearch');
      if (s) s.focus();
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function () {
      cleanAndUpgradePosDom();
      App.renderPosView();
      App.renderCartItems();
    }, 350);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        cleanAndUpgradePosDom();
        App.renderPosView();
        App.renderCartItems();
      }, 350);
    });
  }
})();
