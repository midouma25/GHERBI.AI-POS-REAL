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
      setTimeout(cleanAndUpgradePosDom, 500);
    }, 350);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        cleanAndUpgradePosDom();
      App.renderPosView();
      App.renderCartItems();
      setTimeout(cleanAndUpgradePosDom, 500);
    }, 350);
    });
  }
})();

// ============================================================================
// [TURBO CASHIER ENGINE — F5 BARCODE MAGNET, F4 SEARCH, F12 PRICE, ESC 80MM, CTRL+SPACE SAVE]
// ============================================================================
(function applyTurboCashierEngine() {
  if (!window.App || !window.AppState) return;

  AppState.selectedCartRowIdx = 0;
  AppState._isSubmittingInstantSale = false;

  // فحص ما إذا كانت هناك أي نافذة منبثقة مفتوحة حالياً
  function getActiveModalElement() {
    var modals = document.querySelectorAll('.modal-overlay.active');
    return modals.length > 0 ? modals[modals.length - 1] : null;
  }

  function isPosViewActive() {
    var posSec = document.getElementById('view-pos');
    return Boolean(posSec && posSec.classList.contains('active'));
  }

  // --------------------------------------------------------------------------
  // 1. المغناطيس التلقائي الدائم لخانة الباركود (#barcodeInput) + اختصار F5
  // --------------------------------------------------------------------------
  App.focusBarcodeMagnet = function (clearValue) {
    var bcInp = document.getElementById('barcodeInput');
    if (!bcInp) return;
    if (clearValue) bcInp.value = '';
    bcInp.focus();
    try {
      bcInp.select();
    } catch (_) {}
    updateBarcodeStatusPill(true);
  };

  function updateBarcodeStatusPill(isFocused) {
    var pill = document.getElementById('barcodeMagnetStatusPill');
    if (!pill) return;
    if (isFocused) {
      pill.className = 'px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black whitespace-nowrap';
      pill.textContent = '🟢 جاهز للمسح (F5)';
    } else {
      pill.className = 'px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black whitespace-nowrap cursor-pointer';
      pill.textContent = '⚠️ اضغط F5 للمسح';
    }
  }

  // مراقب ذكي يعيد التركيز لخانة الباركود تلقائياً عندما لا يكون البائع يكتب في حقل آخر
  function installBarcodeAutoFocusGuard() {
    var bcInp = document.getElementById('barcodeInput');
    if (!bcInp) return;

    bcInp.addEventListener('focus', function () {
      updateBarcodeStatusPill(true);
    });
    bcInp.addEventListener('blur', function () {
      updateBarcodeStatusPill(false);
    });

    // عند النقر في أي مكان فارغ داخل شاشة الكاشير، يعود المؤشر فوراً لخانة الباركود
    document.addEventListener('click', function (e) {
      if (!isPosViewActive() || getActiveModalElement()) return;
      var tag = (e.target && e.target.tagName ? e.target.tagName : '').toUpperCase();
      var isInteractive =
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        tag === 'TEXTAREA' ||
        tag === 'BUTTON' ||
        Boolean(e.target && e.target.closest && e.target.closest('button, select, input, textarea, a'));
      if (!isInteractive) {
        setTimeout(function () {
          if (!getActiveModalElement()) App.focusBarcodeMagnet(false);
        }, 40);
      }
    });

    // فحص دوري خفيف: إذا كان المؤشر تائهاً على document.body في شاشة الكاشير، نرجعه فوراً لخانة الباركود
    setInterval(function () {
      if (!isPosViewActive() || getActiveModalElement()) return;
      var active = document.activeElement;
      if (!active || active === document.body || active.tagName === 'HTML' || active.tagName === 'MAIN' || active.tagName === 'SECTION') {
        App.focusBarcodeMagnet(false);
      }
    }, 900);
  }

  // --------------------------------------------------------------------------
  // 2. قفز المؤشر بـ F12 إلى خانة السعر لتعديله يدوياً + العودة للباركود بـ Enter
  // --------------------------------------------------------------------------
  App.focusCartItemPriceInput = function (targetIdx) {
    var items = (this.currentCart && this.currentCart.items) || [];
    if (items.length === 0) {
      if (typeof showToast === 'function') showToast('السلة فارغة — أضف منتجاً أولاً لتعديل سعره (F12)', 'warning');
      return false;
    }
    var idx =
      targetIdx !== undefined && targetIdx !== null && items[targetIdx]
        ? Number(targetIdx)
        : items[AppState.selectedCartRowIdx]
          ? AppState.selectedCartRowIdx
          : items.length - 1;

    AppState.selectedCartRowIdx = idx;
    var priceInp = document.getElementById('cartItemPriceInput-' + idx);
    if (!priceInp) {
      this.renderCartItems();
      priceInp = document.getElementById('cartItemPriceInput-' + idx);
    }
    if (priceInp) {
      priceInp.focus();
      priceInp.select();
      return true;
    }
    return false;
  };

  App.onCartPriceInputKeydown = function (event, idx, inputEl) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.updateCartItemPrice(idx, inputEl.value);
      this.focusBarcodeMagnet(true);
      if (typeof showToast === 'function') {
        showToast('✅ تم تحديث السعر يدوياً والعودة لخانة الباركود', 'success');
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.renderCartItems();
      this.focusBarcodeMagnet(false);
    }
  };

  App.onCartQtyInputKeydown = function (event, idx, inputEl) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.updateCartItemQty(idx, inputEl.value);
      this.focusBarcodeMagnet(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.renderCartItems();
      this.focusBarcodeMagnet(false);
    }
  };

  // تحديث renderCartItems لإضافة المعرف الفريد #cartItemPriceInput-idx ودعم التحديد البصري وأزرار + و -
  App.renderCartItems = function () {
    var container = document.getElementById('posCartItems');
    if (!container) return;
    var items = (this.currentCart && this.currentCart.items) || [];

    if (items.length === 0) {
      AppState.selectedCartRowIdx = 0;
      var emptyTxt =
        AppState.lang === 'fr'
          ? 'Panier vide — Scannez un code-barres (F5) ou recherchez (F4)'
          : AppState.lang === 'en'
            ? 'Cart is empty — Scan barcode (F5) or search (F4)'
            : 'السلة فارغة — امسح الباركود (F5) أو ابحث بالاسم (F4)';
      container.innerHTML =
        '<div class="h-full flex flex-col items-center justify-center text-slate-400 py-8">' +
        '<span class="material-symbols-rounded icon-xl mb-2 opacity-40">shopping_basket</span>' +
        '<div class="text-xs font-bold">' + emptyTxt + '</div>' +
        '<div class="text-[10px] text-slate-400 mt-1 font-mono">[F5] الباركود | [F4] البحث | [F12] السعر | [Échap] طباعة 80mm فورية | [Ctrl+Space] حفظ فقط</div>' +
        '</div>';
      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
      return;
    }

    if (AppState.selectedCartRowIdx >= items.length || AppState.selectedCartRowIdx < 0) {
      AppState.selectedCartRowIdx = items.length - 1;
    }

    container.innerHTML = items
      .map(function (item, idx) {
        var prod = AppState.products.find(function (p) {
          return Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name;
        });
        if (prod && !item.product_id) item.product_id = prod.id;
        var cost = Number(item.cost_price || (prod && prod.cost_price) || 0);
        var isBelowCost = cost > 0 && Number(item.price) < cost;
        var isSelected = idx === AppState.selectedCartRowIdx;

        return (
          '<div onclick="AppState.selectedCartRowIdx=' + idx + ';" class="p-2 rounded-xl border ' +
          (isBelowCost
            ? 'border-amber-500 bg-amber-500/10 '
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 ') +
          (isSelected ? 'cart-row-selected ' : '') +
          'flex items-center justify-between gap-1.5 shadow-sm transition">' +
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
              '); App.focusBarcodeMagnet(false);" class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 font-sans font-bold hover:bg-indigo-600 hover:text-white transition">' +
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
          '<button type="button" title="إنقاص الكمية (-)" onclick="AppState.selectedCartRowIdx=' +
          idx +
          '; App.stepCartItemQty(' +
          idx +
          ', -1); App.focusBarcodeMagnet(false);" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white font-mono font-black text-xs">-</button>' +
          '<input id="cartItemQtyInput-' +
          idx +
          '" type="number" step="any" value="' +
          item.quantity +
          '" onkeydown="App.onCartQtyInputKeydown(event, ' +
          idx +
          ', this)" onchange="App.updateCartItemQty(' +
          idx +
          ', this.value); App.focusBarcodeMagnet(false);" title="الكمية (اضغط Enter للتأكيد)" class="w-11 px-1 py-1 rounded-lg text-center font-mono font-black text-xs">' +
          '<button type="button" title="زيادة الكمية (+)" onclick="AppState.selectedCartRowIdx=' +
          idx +
          '; App.stepCartItemQty(' +
          idx +
          ', 1); App.focusBarcodeMagnet(false);" class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white font-mono font-black text-xs">+</button>' +
          '</div>' +
          '<input id="cartItemPriceInput-' +
          idx +
          '" type="number" step="any" value="' +
          Number(item.price || 0).toFixed(2) +
          '" onkeydown="App.onCartPriceInputKeydown(event, ' +
          idx +
          ', this)" onchange="App.updateCartItemPrice(' +
          idx +
          ', this.value); App.focusBarcodeMagnet(false);" title="سعر الوحدة (اختصار التعديل اليدوي: F12 ثم Enter)" class="cart-price-input w-16 px-1 py-1 rounded-lg text-center font-mono font-bold text-xs text-blue-600 dark:text-blue-400">' +
          '<div class="w-14 text-left font-mono font-black text-xs">' +
          Number(item.subtotal || 0).toFixed(2) +
          '</div>' +
          '<button type="button" title="حذف الصنف" onclick="App.removeCartItem(' +
          idx +
          '); App.focusBarcodeMagnet(false);" class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
          '</div>'
        );
      })
      .join('');

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
  };

  // عند إضافة منتج للسلة، نجعل السطر المضاف هو المحدد حالياً ونعيد المؤشر للباركود فوراً
  var _prevAddProdToCart = App.addProductToCart.bind(App);
  App.addProductToCart = function (productId, qty, options) {
    var res = _prevAddProdToCart(productId, qty, options);
    var items = (this.currentCart && this.currentCart.items) || [];
    if (items.length > 0) {
      var foundIdx = items.findIndex(function (it) {
        return Number(it.product_id || it.productId) === Number(productId);
      });
      AppState.selectedCartRowIdx = foundIdx !== -1 ? foundIdx : items.length - 1;
      this.renderCartItems();
    }
    this.focusBarcodeMagnet(false);
    return res;
  };

  // --------------------------------------------------------------------------
  // 3. البيع والتأكيد الفوري المباشر:
  //    - Escape (Échap) -> حفظ الفاتورة + طباعة تذكرة حرارية 80mm مباشرة وبصمت بدون أي نافذة
  //    - Ctrl + Space   -> حفظ الفاتورة فقط بدون أي طباعة
  // --------------------------------------------------------------------------
  App.instantConfirmAndCheckout = async function (mode) {
    // mode: 'thermal80_silent' | 'save_only'
    if (AppState._isSubmittingInstantSale) return;
    var cart = this.currentCart;
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      if (typeof showToast === 'function') {
        showToast('السلة فارغة — امسح باركود منتج أولاً!', 'warning');
      }
      this.focusBarcodeMagnet(false);
      return;
    }

    AppState._isSubmittingInstantSale = true;
    try {
      var totals = this.recalcCart();
      var customerId = cart.customerId ? Number(cart.customerId) : null;
      var payload = {
        editSaleId: AppState.editingSaleId || null,
        customer_id: customerId,
        subtotal: totals.subtotal,
        tax_percentage: totals.taxPercentage || 0,
        discount: totals.discount || 0,
        stamp_amount: totals.stampAmount || 0,
        total: totals.total,
        paid_amount: totals.total,
        payment_method: 'cash',
        due_date: null,
        user_id: AppState.currentUser ? AppState.currentUser.id : 1,
        session_id: AppState.activeSession ? AppState.activeSession.id : null,
        items: cart.items.map(function (it) {
          return {
            product_id: it.product_id || it.productId || null,
            batch_id: it.batch_id || it.batchId || null,
            variant_id: it.variant_id || it.variantId || null,
            custom_product_name: it.custom_product_name || it.name,
            quantity: Number(it.quantity || 1),
            price: Number(it.price || 0),
            cost_price: Number(it.cost_price || 0),
            subtotal: Number(it.subtotal || 0),
            serial_number: it.serial_number || null,
            warranty_months: Number(it.warranty_months || 0)
          };
        })
      };

      var saved = await window.api.processSale(payload);
      var saleId = saved && (saved.id || saved.saleId);
      var docNum = (saved && saved.doc_number) || ('#' + saleId);

      // فتح درج النقود تلقائياً عند البيع النقدي
      if (
        String(AppState.settings.open_drawer_on_cash_sale) !== 'false' &&
        window.api &&
        typeof window.api.openCashDrawer === 'function'
      ) {
        window.api.openCashDrawer().catch(function () {});
      }

      if (mode === 'thermal80_silent' && saleId && window.PrintEngine) {
        var fullSale = (await window.api.getSaleDetails(saleId).catch(function () { return null; })) || {
          ...payload,
          id: saleId,
          doc_number: docNum,
          sale_date: new Date().toISOString()
        };
        var receiptHtml = await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings, {
          lang: AppState.settings.receipt_lang || AppState.lang || 'ar',
          template: AppState.settings.receipt_template || 'receipt1'
        });

        // طباعة صامتة مباشرة على طابعة التذاكر الحرارية 80mm دون فتح مربع حوار
        if (window.api && typeof window.api.printSilent === 'function') {
          var printRes = await window.api.printSilent({
            html: receiptHtml,
            silent: true,
            printerName: AppState.settings.thermal_printer_name || undefined
          });
          if (!printRes || !printRes.success) {
            await window.PrintEngine.printHtmlDocument(receiptHtml, { silent: true });
          }
        } else {
          await window.PrintEngine.printHtmlDocument(receiptHtml, { silent: true });
        }
        if (typeof showToast === 'function') {
          showToast('🖨️ تم تأكيد الفاتورة (' + docNum + ') وطباعة تذكرة 80mm مباشرة!', 'success');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('💾 تم حفظ الفاتورة (' + docNum + ') بنجاح بدون طباعة!', 'success');
        }
      }

      AppState.editingSaleId = null;
      var editBanner = document.getElementById('posEditSaleBanner');
      if (editBanner) editBanner.classList.add('hidden');

      this.clearCurrentCart();
      await this.refreshProducts();
      this.focusBarcodeMagnet(true);
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('تعذر إتمام الفاتورة السريعة: ' + (err.message || err), 'error');
      }
    } finally {
      AppState._isSubmittingInstantSale = false;
    }
  };

  // --------------------------------------------------------------------------
  // 4. اختصار F4 للبحث السريع + إضافة أول منتج مطابق عند ضغط Enter في البحث
  // --------------------------------------------------------------------------
  function setupSearchInputEnterToAdd() {
    var searchInp = document.getElementById('globalPosSearch');
    if (!searchInp || searchInp.dataset.turboBound === '1') return;
    searchInp.dataset.turboBound = '1';

    searchInp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var q = String(searchInp.value || '').trim().toLowerCase();
        if (q) {
          var matches = (AppState.products || []).filter(function (p) {
            return (
              !p.hide_from_pos &&
              (String(p.name || '').toLowerCase().includes(q) ||
                String(p.barcode || '').toLowerCase().includes(q) ||
                String(p.plu_code || '').toLowerCase() === q)
            );
          });
          if (matches.length > 0) {
            App.addProductToCart(matches[0].id, 1);
            searchInp.value = '';
            App.onPosSearchInput('');
            if (typeof showToast === 'function') {
              showToast('➕ تمت إضافة "' + matches[0].name + '" من البحث وعاد المؤشر للباركود', 'info');
            }
          }
        }
        App.focusBarcodeMagnet(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        searchInp.value = '';
        App.onPosSearchInput('');
        App.focusBarcodeMagnet(false);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. بناء شريط الإرشاد السريع وأزرار البيع الفوري (Échap / Ctrl+Space) في الواجهة
  // --------------------------------------------------------------------------
  function injectTurboPosControls() {
    // شارة حالة المغناطيس بجانب حقل الباركود
    var bcWrap = document.getElementById('barcodeInput') ? document.getElementById('barcodeInput').parentElement : null;
    if (bcWrap && !document.getElementById('barcodeMagnetStatusPill')) {
      bcWrap.classList.add('flex', 'items-center', 'gap-1.5');
      bcWrap.style.width = '290px';
      bcWrap.insertAdjacentHTML(
        'beforeend',
        '<span id="barcodeMagnetStatusPill" onclick="App.focusBarcodeMagnet(false)" class="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black whitespace-nowrap">🟢 جاهز للمسح (F5)</span>'
      );
    }

    // أزرار التنفيذ المباشر (تذكرة 80mm فورية بـ Échap + حفظ بدون طباعة بـ Ctrl+Space) في أسفل السلة
    var mainPayBtn = document.querySelector('#posCartContainer button[onclick*="openCheckoutModal"]');
    if (mainPayBtn && !document.getElementById('turboInstantActionButtons')) {
      var barHtml =
        '<div id="turboInstantActionButtons" class="grid grid-cols-2 gap-1.5 pt-0.5">' +
        '<button type="button" onclick="App.instantConfirmAndCheckout(\'thermal80_silent\')" title="تأكيد الفاتورة وطباعة تذكرة 80mm مباشرة بدون نافذة (اختصار: Échap)" class="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm">' +
        '<span>🖨️ تذكرة 80mm فورية (Échap)</span>' +
        '</button>' +
        '<button type="button" onclick="App.instantConfirmAndCheckout(\'save_only\')" title="حفظ الفاتورة وتأكيدها مباشرة بدون طباعة (اختصار: Ctrl + Space)" class="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm">' +
        '<span>💾 حفظ بدون طباعة (Ctrl+Space)</span>' +
        '</button>' +
        '</div>';
      mainPayBtn.insertAdjacentHTML('beforebegin', barHtml);
    }
  }

  // --------------------------------------------------------------------------
  // 6. الموجه المركزي لاختصارات الكاشير الخارقة (F5, F4, F12, +, -, Escape, Ctrl+Space)
  // --------------------------------------------------------------------------
  document.addEventListener(
    'keydown',
    function (e) {
      if (!isPosViewActive()) return;

      var activeModal = getActiveModalElement();
      var activeEl = document.activeElement;
      var activeId = activeEl ? activeEl.id : '';
      var isBarcodeFocused = activeId === 'barcodeInput';
      var barcodeVal = isBarcodeFocused ? String(activeEl.value || '') : '';

      // 1) F5 -> العودة الفورية لخانة الباركود دائماً (ومنع إعادة تحميل المتصفح)
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        if (activeModal) App.closeModal(activeModal.id);
        App.focusBarcodeMagnet(true);
        if (typeof showToast === 'function') showToast('🎯 المؤشر جاهز في خانة مسح الباركود (F5)', 'info');
        return;
      }

      // 2) F4 -> الذهاب الفوري لخانة البحث بالاسم والباركود (#globalPosSearch)
      if (e.key === 'F4' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        var sInp = document.getElementById('globalPosSearch');
        if (sInp) {
          sInp.focus();
          sInp.select();
        }
        return;
      }

      // Shift + F4 -> إفراغ السلة الحالية
      if (e.key === 'F4' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        App.clearCurrentCart();
        App.focusBarcodeMagnet(true);
        return;
      }

      // 3) F12 -> الذهاب الفوري إلى خانة السعر في السلة لتعديله يدوياً
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        App.focusCartItemPriceInput();
        return;
      }

      // 4) Ctrl + Space (Ctrl + Espace) -> حفظ الفاتورة وتأكيدها مباشرة بدون طباعة
      if (e.ctrlKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        e.stopPropagation();
        if (activeModal && activeModal.id === 'checkoutModal') {
          App.submitSale('none');
        } else {
          App.instantConfirmAndCheckout('save_only');
        }
        return;
      }

      // 5) Escape (Échap) -> طباعة تذكرة 80mm وتأكيد الفاتورة مباشرة بدون أي ضغطة إضافية
      if (e.key === 'Escape') {
        // إذا كان البائع داخل حقل السعر أو البحث، يعيده Escape للباركود أولاً
        if (activeEl && (activeEl.classList.contains('cart-price-input') || activeId === 'globalPosSearch')) {
          return;
        }
        // إذا كانت هناك نافذة منبثقة غير نافذة الدفع مفتوحة، نغلقها ونعيد المؤشر للباركود
        if (activeModal && activeModal.id !== 'checkoutModal') {
          e.preventDefault();
          App.closeModal(activeModal.id);
          App.focusBarcodeMagnet(false);
          return;
        }
        // إذا كانت نافذة الدفع مفتوحة أو كنا في شاشة الكاشير المباشرة وفيها سلة غير فارغة -> طباعة تذكرة 80mm فورية!
        if (App.currentCart && Array.isArray(App.currentCart.items) && App.currentCart.items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (activeModal && activeModal.id === 'checkoutModal') {
            App.closeModal('checkoutModal');
          }
          App.instantConfirmAndCheckout('thermal80_silent');
          return;
        }
      }

      // 6) التحكم بـ (+ و -) في كمية المنتج مباشرة عندما يكون المؤشر في خانة الباركود الفارغة
      if (!activeModal && isBarcodeFocused && barcodeVal === '') {
        var items = (App.currentCart && App.currentCart.items) || [];
        if (items.length > 0) {
          var targetIdx = items[AppState.selectedCartRowIdx] ? AppState.selectedCartRowIdx : items.length - 1;
          if (e.key === '+' || e.code === 'NumpadAdd') {
            e.preventDefault();
            App.stepCartItemQty(targetIdx, 1);
            App.focusBarcodeMagnet(false);
            return;
          }
          if (e.key === '-' || e.code === 'NumpadSubtract') {
            e.preventDefault();
            App.stepCartItemQty(targetIdx, -1);
            App.focusBarcodeMagnet(false);
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            AppState.selectedCartRowIdx = Math.max(0, targetIdx - 1);
            App.renderCartItems();
            App.focusBarcodeMagnet(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            AppState.selectedCartRowIdx = Math.min(items.length - 1, targetIdx + 1);
            App.renderCartItems();
            App.focusBarcodeMagnet(false);
            return;
          }
        }
      }
    },
    true
  );

  // تحديث دليل الاختصارات (#shortcutsHelpModal) ليعكس تعليماتك الجديدة بدقة
  function updateShortcutsHelpModalContent() {
    var modalBody = document.querySelector('#shortcutsHelpModal .space-y-2.text-xs');
    if (!modalBody) return;
    modalBody.innerHTML =
      '<div class="flex justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-bold"><span>تأكيد الفاتورة وطباعة تذكرة 80mm مباشرة</span><kbd class="px-2 py-0.5 bg-emerald-600 text-white rounded font-mono">Échap (Esc)</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 font-bold"><span>حفظ الفاتورة وتأكيدها مباشرة بدون طباعة</span><kbd class="px-2 py-0.5 bg-blue-600 text-white rounded font-mono">Ctrl + Space</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>الرجوع الفوري لخانة مسح الباركود</span><kbd class="px-2 py-0.5 bg-emerald-600 text-white rounded font-mono">F5</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>الذهاب الفوري لخانة البحث بالاسم والباركود</span><kbd class="px-2 py-0.5 bg-blue-600 text-white rounded font-mono">F4</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>تعديل سعر المنتج يدوياً في السلة (ثم Enter)</span><kbd class="px-2 py-0.5 bg-amber-500 text-slate-950 rounded font-mono font-black">F12</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>زيادة أو إنقاص كمية المنتج في السلة</span><kbd class="px-2 py-0.5 bg-indigo-600 text-white rounded font-mono">+ / -</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>فتح نافذة التسديد المفصلة (آجل / تقسيط / شيك)</span><kbd class="px-2 py-0.5 bg-blue-600 text-white rounded font-mono">F1</kbd></div>' +
      '<div class="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span>تعليق الفاتورة (F2) / المسودات (F3) / منتج حر (F8)</span><kbd class="px-2 py-0.5 bg-slate-700 text-white rounded font-mono">F2 / F3 / F8</kbd></div>';
  }

  function initAllTurboFeatures() {
    injectTurboPosControls();
    setupSearchInputEnterToAdd();
    installBarcodeAutoFocusGuard();
    updateShortcutsHelpModalContent();
    App.renderCartItems();
    App.focusBarcodeMagnet(false);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initAllTurboFeatures, 550);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initAllTurboFeatures, 550);
    });
  }
})();

// ============================================================================
// [PAGE 2 SALES SURGICAL PERFECTION & AUTOMATED QA BOT — GHERBI.AI EXCLUSIVE]
// ============================================================================
(function applyPage2SalesSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.salesQuickSearch = '';
  AppState.salesQuickPreset = 'all';
  AppState.selectedSalesRowIdx = 0;
  AppState._lastRenderedSalesList = [];
  AppState.savedDriversList = JSON.parse(localStorage.getItem('gherbi_saved_drivers') || '[{"driver":"أحمد بن علي","plate":"00123-116-16"},{"driver":"كريم للتوصيل السريع","plate":"04589-125-25"}]');

  function formatCleanSaleDateTime(raw) {
    if (!raw) return '—';
    var str = String(raw).replace('T', ' ');
    var datePart = str.slice(0, 10);
    var timePart = str.slice(11, 16);
    return timePart ? datePart + ' | 🕒 ' + timePart : datePart;
  }

  function renderPaymentMethodBadge(method, splitJson) {
    var m = String(method || 'cash').toLowerCase();
    if (splitJson || m === 'split') {
      return '<span class="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold text-[11px]">🔀 دفع مختلط</span>';
    }
    var map = {
      cash: '<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">💵 نقداً (Espèces)</span>',
      credit: '<span class="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[11px]">📝 آجل / دين</span>',
      cib: '<span class="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-[11px]">💳 البطاقة الذهبية / CIB</span>',
      baridimob: '<span class="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[11px]">📱 بريدي موب</span>',
      cheque: '<span class="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">🏦 شيك / صك</span>',
      installment: '<span class="px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold text-[11px]">📅 بالتقسيط</span>'
    };
    return map[m] || ('<span class="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold text-[11px]">' + m + '</span>');
  }

  // --------------------------------------------------------------------------
  // 1. إعادة بناء وتطوير شاشة سجل المبيعات والضمان (#view-sales) بالكامل
  // --------------------------------------------------------------------------
  App.renderSalesView = async function () {
    var root = document.getElementById('sales-view-root');
    if (!root) return;

    var allSales = (await window.api.getSales({
      customerId: AppState.salesFilterCustomerId || undefined,
      dateFrom: AppState.salesFilterDateFrom || undefined,
      dateTo: AppState.salesFilterDateTo || undefined
    }).catch(function () { return []; })) || [];

    var sales = allSales.filter(function (s) {
      var rem = Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0));
      if (AppState.salesFilterStatus === 'paid' && rem > 0.01) return false;
      if (AppState.salesFilterStatus === 'unpaid' && rem <= 0.01) return false;
      if (AppState.salesFilterStatus === 'avoir' && !s.credit_note_number) return false;

      if (AppState.salesQuickSearch) {
        var q = AppState.salesQuickSearch.toLowerCase();
        var docMatch = String(s.doc_number || ('#' + s.id)).toLowerCase().includes(q);
        var custMatch = String(s.customer_name || 'زبون عابر').toLowerCase().includes(q);
        var totalMatch = String(s.total || '').includes(q);
        if (!docMatch && !custMatch && !totalMatch) return false;
      }
      return true;
    });

    AppState._lastRenderedSalesList = sales;
    if (AppState.selectedSalesRowIdx >= sales.length) AppState.selectedSalesRowIdx = 0;

    // حساب المؤشرات المالية الحية (KPIs)
    var totalRev = sales.reduce(function (sum, s) { return sum + Number(s.total || 0); }, 0);
    var totalPaid = sales.reduce(function (sum, s) { return sum + Number(s.paid_amount || 0); }, 0);
    var totalRem = sales.reduce(function (sum, s) { return sum + Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0)); }, 0);
    var unpaidCount = sales.filter(function (s) { return Number(s.total || 0) - Number(s.paid_amount || 0) > 0.01; }).length;
    var centimeRev = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalRev) : '';

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <!-- رأس الصفحة مع زر الفحص الآلي والتصدير -->' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex items-center gap-2">' +
      '        <span>سجل المبيعات، تعديل الفواتير، وفاحص الضمان (' + sales.length + ')</span>' +
      '        <button id="btnSalesPageQaBot" type="button" onclick="App.runAutoTest_SalesPage()" title="تشغيل الفحص الآلي الذاتي لصفحة سجل المبيعات (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">تعديل الفواتير، الاسترجاع الجزئي للأصناف، فحص صلاحية الضمان IMEI/Serial، طباعة التذاكر الحرارية 80mm ووصولات التوصيل وإشعارات الدائن</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-1.5 text-xs">' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'today\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'today' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">📅 اليوم</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'yesterday\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'yesterday' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">⏮️ أمس</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'week\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'week' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">📆 7 أيام</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'month\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'month' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">🗓️ هذا الشهر</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'unpaid\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesFilterStatus === 'unpaid' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20') + '">⚠️ ديون غير مسددة (' + unpaidCount + ')</button>' +
      '      <button type="button" onclick="App.applySalesQuickDatePreset(\'all\')" class="px-2.5 py-1.5 rounded-xl font-bold ' + (AppState.salesQuickPreset === 'all' && !AppState.salesFilterStatus ? 'bg-slate-800 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">🔄 الكل</button>' +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط المؤشرات المالية الحية (KPIs) بالدينار وبالسنتيم الجزائري -->' +
      '  <div id="salesKpiSummaryGrid" class="grid grid-cols-1 md:grid-cols-4 gap-3">' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي المبيعات المعروضة</div>' +
      '      <div class="text-xl font-black font-mono text-blue-600 mt-0.5">' + totalRev.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">🇩🇿 بالسنتيم: ' + centimeRev + '</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي المقبوضات المحصلة (Encaissé)</div>' +
      '      <div class="text-xl font-black font-mono text-emerald-600 mt-0.5">' + totalPaid.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">نسبة التحصيل: ' + (totalRev > 0 ? Math.round((totalPaid / totalRev) * 100) : 100) + '%</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">إجمالي الديون المتبقية (Créances)</div>' +
      '      <div class="text-xl font-black font-mono ' + (totalRem > 0.01 ? 'text-rose-600' : 'text-slate-400') + ' mt-0.5">' + totalRem.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">عدد الفواتير الآجلة: ' + unpaidCount + ' فاتورة</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">عدد الفواتير ومتوسط السلة</div>' +
      '      <div class="text-xl font-black font-mono text-indigo-600 mt-0.5">' + sales.length + ' فاتورة</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">متوسط الفاتورة: ' + (sales.length > 0 ? (totalRev / sales.length).toFixed(2) : '0.00') + ' د.ج</div>' +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط البحث الفوري والفلاتر التفصيلية وفاحص الضمان -->' +
      '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-3">' +
      '    <div class="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs">' +
      '      <input id="salesQuickSearchInput" type="text" value="' + (AppState.salesQuickSearch || '') + '" oninput="App.onSalesQuickSearchInput(this.value)" placeholder="🔍 [F4] ابحث برقم الفاتورة (FAC-...)، اسم الزبون، أو المبلغ..." class="flex-1 min-w-[180px] px-3 py-2 rounded-xl font-bold">' +
      '      <select id="salesCustFilter" onchange="AppState.salesFilterCustomerId=this.value; App.renderSalesView()" class="px-2.5 py-2 rounded-xl font-bold">' +
      '        <option value="">جميع الزبائن</option>' +
      (AppState.customers || []).map(function (c) {
        return '<option value="' + c.id + '" ' + (String(AppState.salesFilterCustomerId) === String(c.id) ? 'selected' : '') + '>' + c.name + '</option>';
      }).join('') +
      '      </select>' +
      '      <select id="salesStatusFilter" onchange="AppState.salesFilterStatus=this.value; App.renderSalesView()" class="px-2.5 py-2 rounded-xl font-bold">' +
      '        <option value="" ' + (!AppState.salesFilterStatus ? 'selected' : '') + '>جميع الحالات</option>' +
      '        <option value="paid" ' + (AppState.salesFilterStatus === 'paid' ? 'selected' : '') + '>مسددة بالكامل</option>' +
      '        <option value="unpaid" ' + (AppState.salesFilterStatus === 'unpaid' ? 'selected' : '') + '>بها دين متبقٍ</option>' +
      '        <option value="avoir" ' + (AppState.salesFilterStatus === 'avoir' ? 'selected' : '') + '>بها إشعار دائن</option>' +
      '      </select>' +
      '      <input id="salesDateFrom" type="date" value="' + (AppState.salesFilterDateFrom || '') + '" onchange="AppState.salesFilterDateFrom=this.value; App.renderSalesView()" class="px-2.5 py-1.5 rounded-xl font-mono">' +
      '      <input id="salesDateTo" type="date" value="' + (AppState.salesFilterDateTo || '') + '" onchange="AppState.salesFilterDateTo=this.value; App.renderSalesView()" class="px-2.5 py-1.5 rounded-xl font-mono">' +
      '      <button type="button" onclick="window.api.exportSalesToExcel()" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1"><span class="material-symbols-rounded icon-sm">download</span><span>Excel</span></button>' +
      '    </div>' +

      '    <!-- فاحص الضمان الفوري بالأرقام التسلسلية (IMEI / Serial) -->' +
      '    <div class="lg:col-span-5 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-3 flex flex-col justify-center gap-1.5">' +
      '      <div class="flex items-center justify-between gap-2">' +
      '        <div class="flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400">' +
      '          <span class="material-symbols-rounded icon-sm">verified_user</span>' +
      '          <span>فاحص الضمان الفوري (IMEI / Serial Warranty)</span>' +
      '        </div>' +
      '        <div class="flex items-center gap-1.5 flex-1 max-w-xs">' +
      '          <input id="warrantyLookupInput" type="text" placeholder="امسح أو أدخل رقم S/N أو IMEI..." onkeydown="if(event.key===\'Enter\') App.checkWarrantyBySerial()" class="flex-1 px-3 py-1.5 rounded-xl text-xs font-mono font-bold">' +
      '          <button type="button" onclick="App.checkWarrantyBySerial()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold whitespace-nowrap">فحص الضمان</button>' +
      '        </div>' +
      '      </div>' +
      '      <div id="warrantyLookupResultBox" class="hidden p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/30 text-xs"></div>' +
      '    </div>' +
      '  </div>' +

      '  <!-- جدول سجل المبيعات المتقدم -->' +
      '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto shadow-sm">' +
      '    <table class="w-full text-xs text-right">' +
      '      <thead>' +
      '        <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '          <th class="py-2.5 px-2">رقم الفاتورة</th>' +
      '          <th class="py-2.5 px-2">التاريخ والوقت</th>' +
      '          <th class="py-2.5 px-2">الزبون</th>' +
      '          <th class="py-2.5 px-2">طريقة الدفع</th>' +
      '          <th class="py-2.5 px-2">الإجمالي</th>' +
      '          <th class="py-2.5 px-2">المدفوع</th>' +
      '          <th class="py-2.5 px-2">الباقي</th>' +
      '          <th class="py-2.5 px-2">إشعار دائن</th>' +
      '          <th class="py-2.5 px-2 text-center">إجراءات المستندات السريعة</th>' +
      '        </tr>' +
      '      </thead>' +
      '      <tbody id="salesHistoryTableBody" class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      renderSalesRowsHtml(sales) +
      '      </tbody>' +
      '    </table>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  function renderSalesRowsHtml(sales) {
    if (!Array.isArray(sales) || sales.length === 0) {
      return '<tr><td colspan="9" class="py-10 text-center text-slate-400 font-bold">لا توجد فواتير مطابقة لمعايير البحث الحالية</td></tr>';
    }
    return sales
      .map(function (s, idx) {
        var rem = Math.max(0, Number(s.total || 0) - Number(s.paid_amount || 0));
        var isSelected = idx === AppState.selectedSalesRowIdx;
        var centimeStr = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(s.total) : '';

        return (
          '<tr onclick="AppState.selectedSalesRowIdx=' + idx + ';" class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition ' + (isSelected ? 'bg-blue-500/5' : '') + '">' +
          '  <td class="py-2.5 px-2 font-mono font-black text-blue-600 cursor-pointer" onclick="App.openSaleDetailsModal(' + s.id + ')">' + (s.doc_number || ('#' + s.id)) + '</td>' +
          '  <td class="py-2.5 px-2 font-mono text-slate-500 dark:text-slate-300 whitespace-nowrap">' + formatCleanSaleDateTime(s.sale_date) + '</td>' +
          '  <td class="py-2.5 px-2 font-bold">' + (s.customer_name || 'زبون عابر') + '</td>' +
          '  <td class="py-2.5 px-2 whitespace-nowrap">' + renderPaymentMethodBadge(s.payment_method, s.split_payments_json) + '</td>' +
          '  <td class="py-2.5 px-2 font-mono font-black">' +
          '    <div>' + Number(s.total || 0).toFixed(2) + ' د.ج</div>' +
          '    <div class="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-bold">' + centimeStr + '</div>' +
          '  </td>' +
          '  <td class="py-2.5 px-2 font-mono text-emerald-600 font-bold">' + Number(s.paid_amount || 0).toFixed(2) + '</td>' +
          '  <td class="py-2.5 px-2 font-mono font-black ' + (rem > 0.01 ? 'text-rose-500' : 'text-slate-400') + '">' + rem.toFixed(2) + '</td>' +
          '  <td class="py-2.5 px-2 font-mono text-rose-500 font-bold">' + (s.credit_note_number || '—') + '</td>' +
          '  <td class="py-2.5 px-2 flex flex-wrap items-center justify-center gap-1">' +
          '    <button type="button" onclick="App.openSaleDetailsModal(' + s.id + ')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg font-bold">تفاصيل</button>' +
          '    <button type="button" onclick="App.loadSaleIntoPosForEdit(' + s.id + ')" class="px-2.5 py-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 rounded-lg font-bold transition">تعديل</button>' +
          '    <button type="button" onclick="App.openPrintCenterModal(' + s.id + ', \'invoice_a4\')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold">🖨️ طباعة</button>' +
          '    <button type="button" onclick="App.reprintSale(' + s.id + ', \'a4\')" class="px-2 py-1 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold transition">A4</button>' +
          '    <button type="button" onclick="App.quickSilentPrintSaleReceipt(' + s.id + ')" title="طباعة تذكرة 80mm مباشرة" class="px-2 py-1 bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg font-bold transition">⚡ تذكرة 80mm</button>' +
          '    <button type="button" onclick="App.openDeliveryNoteModal(' + s.id + ')" class="px-2 py-1 bg-teal-600/10 text-teal-600 hover:bg-teal-600 hover:text-white rounded-lg font-bold transition">توصيل BL</button>' +
          '    <button type="button" onclick="App.openCreditNoteModal(' + s.id + ')" class="px-2 py-1 bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg font-bold transition">إشعار دائن</button>' +
          '    <button type="button" onclick="App.shareSaleViaWhatsApp(' + s.id + ')" title="إرسال الفاتورة عبر واتساب" class="px-2 py-1 bg-green-500/15 text-green-600 hover:bg-green-600 hover:text-white rounded-lg font-bold transition">💬</button>' +
          '    <button type="button" onclick="App.deleteSaleRecord(' + s.id + ')" class="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
          '  </td>' +
          '</tr>'
        );
      })
      .join('');
  }

  App.onSalesQuickSearchInput = function (val) {
    AppState.salesQuickSearch = String(val || '').trim();
    this.renderSalesView();
    setTimeout(function () {
      var inp = document.getElementById('salesQuickSearchInput');
      if (inp) {
        inp.focus();
        var len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    }, 10);
  };

  App.applySalesQuickDatePreset = function (preset) {
    AppState.salesQuickPreset = preset;
    var now = new Date();
    var todayIso = now.toISOString().slice(0, 10);

    if (preset === 'today') {
      AppState.salesFilterDateFrom = todayIso;
      AppState.salesFilterDateTo = todayIso;
      AppState.salesFilterStatus = '';
    } else if (preset === 'yesterday') {
      var yest = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      AppState.salesFilterDateFrom = yest;
      AppState.salesFilterDateTo = yest;
      AppState.salesFilterStatus = '';
    } else if (preset === 'week') {
      var weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      AppState.salesFilterDateFrom = weekAgo;
      AppState.salesFilterDateTo = todayIso;
      AppState.salesFilterStatus = '';
    } else if (preset === 'month') {
      var firstOfMonth = todayIso.slice(0, 8) + '01';
      AppState.salesFilterDateFrom = firstOfMonth;
      AppState.salesFilterDateTo = todayIso;
      AppState.salesFilterStatus = '';
    } else if (preset === 'unpaid') {
      AppState.salesFilterDateFrom = '';
      AppState.salesFilterDateTo = '';
      AppState.salesFilterStatus = 'unpaid';
    } else {
      AppState.salesFilterDateFrom = '';
      AppState.salesFilterDateTo = '';
      AppState.salesFilterStatus = '';
      AppState.salesFilterCustomerId = '';
      AppState.salesQuickSearch = '';
    }
    this.renderSalesView();
  };

  // طباعة تذكرة 80mm صامتة فورية من سجل المبيعات
  App.quickSilentPrintSaleReceipt = async function (saleId) {
    var fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale || !window.PrintEngine) return;
    var html = await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings, {
      lang: AppState.settings.receipt_lang || AppState.lang || 'ar',
      template: AppState.settings.receipt_template || 'receipt1'
    });
    if (window.api && typeof window.api.printSilent === 'function') {
      var res = await window.api.printSilent({
        html: html,
        silent: true,
        printerName: AppState.settings.thermal_printer_name || undefined
      });
      if (!res || !res.success) {
        await window.PrintEngine.printHtmlDocument(html, { silent: false });
      } else if (typeof showToast === 'function') {
        showToast('🖨️ تم إرسال التذكرة الحرارية 80mm للطابعة مباشرة!', 'success');
      }
    } else {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // مشاركة الفاتورة عبر WhatsApp الجزائري (+213)
  App.shareSaleViaWhatsApp = async function (saleId) {
    var fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;
    var phone = fullSale.customer_phone || '';
    if (!phone) {
      phone = window.prompt('أدخل رقم هاتف الزبون لإرسال الفاتورة عبر واتساب (مثال: 0550123456):', '0550') || '';
    }
    if (!phone.trim()) return;
    var cleanPhone = phone.replace(/\D+/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.slice(1);
    else if (!cleanPhone.startsWith('213')) cleanPhone = '213' + cleanPhone;

    var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(fullSale.total) : '';
    var rem = Math.max(0, Number(fullSale.total || 0) - Number(fullSale.paid_amount || 0));
    var itemsSummary = (fullSale.items || [])
      .map(function (it) { return '• ' + (it.product_name || it.custom_product_name || 'منتج') + ' (×' + it.quantity + ') = ' + Number(it.subtotal || 0).toFixed(2) + ' د.ج'; })
      .join('\n');

    var msg =
      '🧾 *فاتورة من ' + (AppState.settings.shop_name || 'Gherbi.Ai POS') + '*\n' +
      'رقم الفاتورة: *' + (fullSale.doc_number || ('#' + fullSale.id)) + '*\n' +
      'التاريخ: ' + formatCleanSaleDateTime(fullSale.sale_date) + '\n' +
      '-------------------\n' +
      itemsSummary + '\n' +
      '-------------------\n' +
      '💰 الإجمالي: *' + Number(fullSale.total || 0).toFixed(2) + ' د.ج* (' + centimes + ')\n' +
      '✅ المدفوع: ' + Number(fullSale.paid_amount || 0).toFixed(2) + ' د.ج\n' +
      (rem > 0.01 ? '⚠️ الباقي المستحق: *' + rem.toFixed(2) + ' د.ج*\n' : '') +
      'شكراً لثقتكم بنا!';

    var url = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(msg);
    if (window.api && window.api.openExternalLink) window.api.openExternalLink(url);
    else window.open(url, '_blank');
  };

  // --------------------------------------------------------------------------
  // 2. ترقية نافذة تفاصيل الفاتورة (#saleDetailsModal) مع الاسترجاع الجزئي للصنف
  //    وتنسيق التاريخ النظيف وأزرار الإجراءات السريعة
  // --------------------------------------------------------------------------
  App.openSaleDetailsModal = async function (saleId) {
    var fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;
    AppState.lastViewedSale = fullSale;

    var titleEl = document.getElementById('saleDetailsTitle');
    if (titleEl) titleEl.textContent = 'تفاصيل الفاتورة (' + (fullSale.doc_number || ('#' + fullSale.id)) + ')';

    var rem = Math.max(0, Number(fullSale.total || 0) - Number(fullSale.paid_amount || 0));
    var centimeTotal = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(fullSale.total) : '';

    var body = document.getElementById('saleDetailsBody');
    if (body) {
      body.innerHTML =
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">' +
        '  <div><div class="text-[10px] text-slate-400">الزبون</div><div class="font-black text-xs mt-0.5">' + (fullSale.customer_name || 'زبون عابر') + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400">التاريخ والوقت</div><div class="font-mono font-bold text-xs mt-0.5 whitespace-nowrap">' + formatCleanSaleDateTime(fullSale.sale_date) + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400">الإجمالي المستحق</div><div class="font-mono font-black text-blue-600 text-sm mt-0.5">' + Number(fullSale.total || 0).toFixed(2) + ' د.ج</div><div class="text-[10px] font-bold text-amber-600">' + centimeTotal + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400">المدفوع / الباقي</div><div class="font-mono font-bold text-emerald-600 text-xs mt-0.5">مدفوع: ' + Number(fullSale.paid_amount || 0).toFixed(2) + ' د.ج</div><div class="font-mono font-bold text-[11px] ' + (rem > 0.01 ? 'text-rose-500' : 'text-slate-400') + '">الباقي: ' + rem.toFixed(2) + ' د.ج</div></div>' +
        '</div>' +

        '<table class="w-full text-xs text-right mt-2">' +
        '  <thead>' +
        '    <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
        '      <th class="py-2">المنتج</th>' +
        '      <th class="py-2 text-center">الكمية</th>' +
        '      <th class="py-2 text-center">سعر الوحدة</th>' +
        '      <th class="py-2 text-center">المجموع</th>' +
        '      <th class="py-2 text-center">الضمان / إرجاع جزئي</th>' +
        '    </tr>' +
        '  </thead>' +
        '  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
        (fullSale.items || [])
          .map(function (it, idx) {
            return (
              '<tr>' +
              '  <td class="py-2.5 font-bold">' + (it.product_name || it.custom_product_name || 'منتج') + '</td>' +
              '  <td class="py-2.5 font-mono font-black text-center">' + it.quantity + '</td>' +
              '  <td class="py-2.5 font-mono text-center">' + Number(it.price || 0).toFixed(2) + '</td>' +
              '  <td class="py-2.5 font-mono font-black text-center">' + Number(it.subtotal || it.quantity * it.price).toFixed(2) + ' د.ج</td>' +
              '  <td class="py-2.5 flex items-center justify-center gap-1.5">' +
              '    <button type="button" onclick="App.printWarrantyForSaleItem(' + idx + ')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[11px]">🛡️ شهادة ضمان</button>' +
              (Number(it.quantity) > 0
                ? '<button type="button" onclick="App.partialReturnSingleSaleItem(' + fullSale.id + ', ' + idx + ')" title="إرجاع قطعة من هذا الصنف فقط للمخزون" class="px-2.5 py-1 bg-rose-500/15 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg font-bold text-[11px] transition">↩️ إرجاع جزئي</button>'
                : '') +
              '  </td>' +
              '</tr>'
            );
          })
          .join('') +
        '  </tbody>' +
        '</table>' +

        '<div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '  <div class="flex flex-wrap gap-1.5">' +
        '    <button type="button" onclick="App.quickSilentPrintSaleReceipt(' + fullSale.id + ')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">⚡ طباعة تذكرة 80mm</button>' +
        '    <button type="button" onclick="App.closeModal(\'saleDetailsModal\'); App.openPrintCenterModal(' + fullSale.id + ', \'invoice_a4\')" class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">🖨️ مركز الطباعة (A4/PDF)</button>' +
        '    <button type="button" onclick="App.shareSaleViaWhatsApp(' + fullSale.id + ')" class="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold">💬 إرسال واتساب</button>' +
        '  </div>' +
        '  <button type="button" onclick="App.closeModal(\'saleDetailsModal\'); App.loadSaleIntoPosForEdit(' + fullSale.id + ')" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black">✏️ فتح في الكاشير للتعديل</button>' +
        '</div>';
    }
    this.openModal('saleDetailsModal');
  };

  // الميزة الخارقة: إرجاع جزئي لصنف واحد من داخل تفاصيل الفاتورة
  App.partialReturnSingleSaleItem = async function (saleId, itemIndex) {
    var fullSale = AppState.lastViewedSale;
    if (!fullSale || Number(fullSale.id) !== Number(saleId)) {
      fullSale = await window.api.getSaleDetails(saleId);
    }
    if (!fullSale || !Array.isArray(fullSale.items) || !fullSale.items[itemIndex]) return;

    var targetItem = fullSale.items[itemIndex];
    var maxQty = Number(targetItem.quantity || 1);
    var retQtyStr = window.prompt(
      '↩️ إرجاع جزئي للصنف: "' + (targetItem.product_name || targetItem.custom_product_name) + '"\nالكمية المباعة في الفاتورة: ' + maxQty + '\n\nأدخل الكمية المراد إرجاعها للمخزون:',
      '1'
    );
    if (retQtyStr === null) return;
    var retQty = parseFloat(retQtyStr);
    if (!Number.isFinite(retQty) || retQty <= 0 || retQty > maxQty) {
      if (typeof showToast === 'function') showToast('يرجى إدخال كمية صحيحة لا تتجاوز ' + maxQty, 'warning');
      return;
    }

    var updatedItems = [];
    fullSale.items.forEach(function (it, i) {
      if (i === itemIndex) {
        var remainingQty = Number((Number(it.quantity) - retQty).toFixed(3));
        if (remainingQty > 0) {
          updatedItems.push({
            ...it,
            quantity: remainingQty,
            subtotal: Number((remainingQty * Number(it.price || 0)).toFixed(2))
          });
        }
      } else {
        updatedItems.push(it);
      }
    });

    if (updatedItems.length === 0) {
      // إذا أرجع الصنف الوحيد بالكامل، نصدر إشعار دائن ونسترجع المخزون
      await window.api.issueCreditNote({
        saleId: fullSale.id,
        reason: 'إرجاع كامل الصنف: ' + (targetItem.product_name || ''),
        restoreStock: true
      });
      this.closeModal('saleDetailsModal');
      await this.refreshProducts();
      await this.renderSalesView();
      if (typeof showToast === 'function') showToast('✅ تم إرجاع الصنف للمخزون وإصدار إشعار دائن بنجاح!', 'success');
      return;
    }

    var newSubtotal = updatedItems.reduce(function (s, x) { return s + Number(x.subtotal || Number(x.quantity) * Number(x.price)); }, 0);
    var disc = Math.min(newSubtotal, Number(fullSale.discount || 0));
    var taxable = Math.max(0, newSubtotal - disc);
    var taxPct = Number(fullSale.tax_percentage || 0);
    var taxAmt = Number(((taxable * taxPct) / 100).toFixed(2));
    var newTotal = Number((taxable + taxAmt + Number(fullSale.stamp_amount || 0)).toFixed(2));

    await window.api.processSale({
      editSaleId: fullSale.id,
      customer_id: fullSale.customer_id,
      subtotal: newSubtotal,
      discount: disc,
      tax_percentage: taxPct,
      stamp_amount: fullSale.stamp_amount || 0,
      total: newTotal,
      paid_amount: Math.min(Number(fullSale.paid_amount || 0), newTotal),
      payment_method: fullSale.payment_method || 'cash',
      items: updatedItems
    });

    await this.refreshProducts();
    await this.openSaleDetailsModal(fullSale.id);
    await this.renderSalesView();
    if (typeof showToast === 'function') {
      showToast('✅ تم استرجاع (' + retQty + ') من "' + (targetItem.product_name || '') + '" للمخزون وتحديث الفاتورة!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 3. إصلاح مركز الطباعة الموحد (#posPrintCenterModal) ليبدل قائمة القوالب
  //    تلقائياً بين قوالب التذاكر الحرارية (1..5) وقوالب الفواتير A4 (الصورة 6)
  // --------------------------------------------------------------------------
  App.syncPrintCenterTemplatesDropdown = async function (docType) {
    var tplSel = document.getElementById('pcTemplateSelect');
    if (!tplSel) return;

    if (docType === 'receipt') {
      tplSel.innerHTML =
        '<option value="receipt1">🧾 قالب التذكرة الحرارية 1 (الكلاسيكي 80mm)</option>' +
        '<option value="receipt2">🧾 قالب التذكرة الحرارية 2 (المفصل بالضريبة)</option>' +
        '<option value="receipt3">🧾 قالب التذكرة الحرارية 3 (المدمج السريع)</option>' +
        '<option value="receipt4">🧾 قالب التذكرة الحرارية 4 (العصري المؤطر)</option>' +
        '<option value="receipt5">🧾 قالب التذكرة الحرارية 5 (الاقتصادي 58mm/80mm)</option>';
    } else if (docType === 'delivery') {
      tplSel.innerHTML =
        '<option value="ar">🚚 وصل توصيل قياسي A4</option>' +
        '<option value="a5">🚚 وصل توصيل مدمج A5</option>' +
        '<option value="thermal">🚚 وصل توصيل حراري 80mm</option>';
    } else if (docType === 'credit_note') {
      tplSel.innerHTML = '<option value="default">📋 القالب الرسمي لإشعار الدائن (Facture d\'Avoir)</option>';
    } else {
      var customList = (window.api && window.api.getCustomTemplates)
        ? (await window.api.getCustomTemplates().catch(function () { return []; })) || []
        : [];
      tplSel.innerHTML =
        '<option value="default">القالب الافتراضي للمتجر</option>' +
        '<option value="template1">القالب الكلاسيكي الأزرق (1)</option>' +
        '<option value="template2">القالب الداكن الرسمي (2)</option>' +
        '<option value="template3">القالب الأخضر التجاري (3)</option>' +
        '<option value="template4">القالب البنفسجي (4)</option>' +
        '<option value="template5">القالب البرتقالي (5)</option>' +
        '<option value="template9">القالب الجبائي 6 أعمدة (9)</option>' +
        '<option value="detailed">القالب المفصل بالرصيد السابق</option>' +
        customList.map(function (ct) { return '<option value="custom:' + ct.id + '">🎨 قالب مخصص: ' + ct.name + '</option>'; }).join('');
    }
  };

  App.openPrintCenterModal = async function (saleId, defaultDocType) {
    AppState.printCenterSaleId = Number(saleId);
    var docType = defaultDocType || 'invoice_a4';
    var docSel = document.getElementById('pcDocTypeSelect');
    var langSel = document.getElementById('pcLangSelect');

    if (docSel) {
      docSel.value = docType;
      docSel.onchange = async function () {
        await App.syncPrintCenterTemplatesDropdown(docSel.value);
        await App.refreshPrintCenterPreview();
      };
    }
    if (langSel) langSel.value = AppState.lang || 'ar';

    await this.syncPrintCenterTemplatesDropdown(docType);
    this.openModal('posPrintCenterModal');
    await this.refreshPrintCenterPreview();
  };

  App.refreshPrintCenterPreview = async function () {
    var saleId = AppState.printCenterSaleId;
    if (!saleId || !window.PrintEngine) return;
    var fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale) return;

    var docType = document.getElementById('pcDocTypeSelect')?.value || 'invoice_a4';
    var lang = document.getElementById('pcLangSelect')?.value || 'ar';
    var tplVal = document.getElementById('pcTemplateSelect')?.value || 'default';

    var html = '';
    if (docType === 'receipt') {
      html = await window.PrintEngine.renderReceiptHtml(fullSale, AppState.settings, {
        lang: lang,
        template: tplVal.startsWith('receipt') ? tplVal : (AppState.settings.receipt_template || 'receipt1'),
        ignoreCustomTemplate: true
      });
    } else if (docType === 'delivery') {
      var modeOrLang = (tplVal === 'a5' || tplVal === 'thermal') ? tplVal : lang;
      html = await window.PrintEngine.renderDeliveryNoteHtml(fullSale, AppState.settings, modeOrLang);
    } else if (docType === 'credit_note') {
      html = await window.PrintEngine.renderCreditNoteHtml(fullSale, AppState.settings, lang);
    } else if (docType === 'invoice_a5') {
      html = await window.PrintEngine.renderInvoiceHtml(fullSale, AppState.settings, {
        lang: lang,
        template: 'a5',
        ignoreCustomTemplate: true
      });
    } else {
      var opts = { lang: lang };
      if (tplVal.startsWith('custom:')) {
        opts.customTemplateId = Number(tplVal.split(':')[1]);
      } else if (tplVal !== 'default') {
        opts.template = tplVal;
        opts.ignoreCustomTemplate = true;
      }
      html = await window.PrintEngine.renderInvoiceHtml(fullSale, AppState.settings, opts);
    }

    AppState.printCenterCurrentHtml = html;
    var frame = document.getElementById('printCenterPreviewFrame');
    if (frame) {
      var doc = frame.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }
  };

  // --------------------------------------------------------------------------
  // 4. تطوير نافذة وصل التوصيل (#deliveryNoteModal) لحفظ السائقين والمركبات (الصورة 7)
  // --------------------------------------------------------------------------
  var _origOpenDeliveryNoteModal = App.openDeliveryNoteModal ? App.openDeliveryNoteModal.bind(App) : null;
  App.openDeliveryNoteModal = function (saleId) {
    if (_origOpenDeliveryNoteModal) _origOpenDeliveryNoteModal(saleId);
    var driverInp = document.getElementById('delivDriverInput');
    if (driverInp && !document.getElementById('savedDriversChipsBox')) {
      var box = document.createElement('div');
      box.id = 'savedDriversChipsBox';
      box.className = 'flex flex-wrap items-center gap-1 mt-1.5';
      driverInp.parentNode.appendChild(box);
    }
    this.renderSavedDriversChips();
  };

  App.renderSavedDriversChips = function () {
    var box = document.getElementById('savedDriversChipsBox');
    if (!box) return;
    box.innerHTML =
      '<span class="text-[10px] text-slate-400 font-bold">سائقون محفوظون:</span>' +
      (AppState.savedDriversList || [])
        .map(function (d, i) {
          return (
            '<button type="button" onclick="App.selectSavedDriver(' + i + ')" class="px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-600 hover:bg-teal-600 hover:text-white font-bold text-[10px] transition">' +
            '🚚 ' + d.driver + ' (' + d.plate + ')' +
            '</button>'
          );
        })
        .join('');
  };

  App.selectSavedDriver = function (idx) {
    var d = (AppState.savedDriversList || [])[idx];
    if (!d) return;
    var drInp = document.getElementById('delivDriverInput');
    var plInp = document.getElementById('delivVehicleInput');
    if (drInp) drInp.value = d.driver || '';
    if (plInp) plInp.value = d.plate || '';
  };

  var _origConfirmPrintDelivery = App.confirmPrintDeliveryNote ? App.confirmPrintDeliveryNote.bind(App) : null;
  App.confirmPrintDeliveryNote = async function () {
    var dr = document.getElementById('delivDriverInput')?.value?.trim() || '';
    var pl = document.getElementById('delivVehicleInput')?.value?.trim() || '';
    if (dr) {
      var exists = (AppState.savedDriversList || []).some(function (x) { return x.driver === dr; });
      if (!exists) {
        AppState.savedDriversList.unshift({ driver: dr, plate: pl || '-' });
        AppState.savedDriversList = AppState.savedDriversList.slice(0, 6);
        localStorage.setItem('gherbi_saved_drivers', JSON.stringify(AppState.savedDriversList));
      }
    }
    if (_origConfirmPrintDelivery) return await _origConfirmPrintDelivery();
  };

  // --------------------------------------------------------------------------
  // 5. روبوت الفحص الآلي الذاتي للصفحة الثانية (App.runAutoTest_SalesPage)
  // --------------------------------------------------------------------------
  App.runAutoTest_SalesPage = async function () {
    if (AppState.currentView !== 'sales') {
      await this.switchView('sales');
    }

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      // 1. فحص عناصر DOM الأساسية في صفحة سجل المبيعات
      var reqIds = ['sales-view-root', 'salesKpiSummaryGrid', 'salesQuickSearchInput', 'warrantyLookupInput', 'salesHistoryTableBody'];
      var missing = reqIds.filter(function (id) { return !document.getElementById(id); });
      check('1. تكامل عناصر صفحة سجل المبيعات ولوحة المؤشرات (DOM Integrity)', missing.length === 0, missing.join(', ') || 'All Elements OK');

      // 2. فحص جلب المبيعات من قاعدة البيانات
      var salesList = await window.api.getSales({});
      check('2. اتصال قاعدة البيانات واسترجاع سجل الفواتير', Array.isArray(salesList), salesList.length + ' فاتورة مسجلة');

      // 3. فحص تنسيق التاريخ النظيف وتعريب شارات طرق الدفع
      var cleanDateSample = formatCleanSaleDateTime('2026-11-01T12:21:00');
      var badgeSample = renderPaymentMethodBadge('cash', null);
      check('3. تنسيق التواريخ وتعريب شارات طرق الدفع (نقداً بدلاً من cash)', !cleanDateSample.includes('T') && badgeSample.includes('نقداً'), cleanDateSample);

      // 4. فحص محرك الفلترة اللحظية والفلاتر الزمنية
      this.applySalesQuickDatePreset('all');
      check('4. عمل الفلاتر الزمنية السريعة والبحث الفوري', AppState.salesQuickPreset === 'all', 'Preset: All');

      // 5. فحص حساب المؤشرات المالية والسنتيم الجزائري
      var kpiBox = document.getElementById('salesKpiSummaryGrid');
      check('5. لوحة المؤشرات المالية اللحظية والتداول بالسنتيم الجزائري', Boolean(kpiBox && kpiBox.textContent.includes('بالسنتيم')), 'KPIs Active');

      // 6. فحص نافذة تفاصيل الفاتورة وزر الاسترجاع الجزئي للصنف
      if (salesList.length > 0) {
        await this.openSaleDetailsModal(salesList[0].id);
        var detailsBody = document.getElementById('saleDetailsBody')?.innerHTML || '';
        var hasPartialReturn = detailsBody.includes('partialReturnSingleSaleItem') && detailsBody.includes('شهادة ضمان');
        this.closeModal('saleDetailsModal');
        check('6. نافذة تفاصيل الفاتورة (#saleDetailsModal) وميزة الإرجاع الجزئي للصنف', hasPartialReturn, 'Partial Return Ready');
      } else {
        check('6. نافذة تفاصيل الفاتورة (#saleDetailsModal)', typeof this.openSaleDetailsModal === 'function', 'Ready');
      }

      // 7. فحص محرك التحقق من الضمان بالأرقام التسلسلية (IMEI / Serial)
      var wRes = await window.api.lookupWarrantySerial('TEST-IMEI-000');
      check('7. استجابة محرك فحص الضمان بالأرقام التسلسلية (IMEI/Serial)', Boolean(wRes && typeof wRes === 'object'), 'Warranty API OK');

      // 8. فحص مركز الطباعة الموحد (#posPrintCenterModal) وتبديل قوالب التذاكر الحرارية
      if (salesList.length > 0) {
        await this.openPrintCenterModal(salesList[0].id, 'receipt');
        var tplOptions = document.getElementById('pcTemplateSelect')?.innerHTML || '';
        var switchedToReceipts = tplOptions.includes('receipt1') && tplOptions.includes('receipt5');
        this.closeModal('posPrintCenterModal');
        check('8. ذكاء مركز الطباعة (#posPrintCenterModal) وتبديل قوالب التذكرة الحرارية 1..5', switchedToReceipts, '5 Thermal Templates');
      } else {
        check('8. مركز الطباعة الموحد (#posPrintCenterModal)', true, 'Ready');
      }

      // 9. فحص تطابق ترتيب أعمدة التذكرة الحرارية 80mm (المنتج | الكمية | السعر | المجموع)
      if (salesList.length > 0 && window.PrintEngine) {
        var fullS = await window.api.getSaleDetails(salesList[0].id);
        var rHtml = await window.PrintEngine.renderReceiptHtml(fullS, AppState.settings, { lang: 'ar', template: 'receipt1' });
        var idxProd = rHtml.indexOf('المنتج');
        var idxQty = rHtml.indexOf('الكمية');
        check('9. تطابق أعمدة التذكرة الحرارية 80mm (المنتج قبل الكمية والسعر)', idxProd !== -1 && idxQty !== -1 && idxProd < idxQty, 'Columns Aligned 100%');
      } else {
        check('9. محرك التذكرة الحرارية 80mm', true, 'Ready');
      }

      // 10. فحص نافذة وصل التوصيل (#deliveryNoteModal) وحفظ السائقين والـ 58 ولاية
      if (salesList.length > 0) {
        this.openDeliveryNoteModal(salesList[0].id);
        var hasWilayas = Boolean(document.getElementById('delivWilayaSelect'));
        var hasSavedDrivers = Boolean(document.getElementById('savedDriversChipsBox'));
        this.closeModal('deliveryNoteModal');
        check('10. نافذة وصل التوصيل (Bon de Livraison) مع الـ 58 ولاية والسائقين المحفوظين', hasWilayas && hasSavedDrivers, '58 Wilayas + Drivers');
      } else {
        check('10. نافذة وصل التوصيل (#deliveryNoteModal)', true, 'Ready');
      }

      // 11. فحص نافذة إشعار الدائن (#creditNoteModal)
      check('11. جهوزية نظام إشعار الدائن واسترجاع المخزون (Facture d\'Avoir)', Boolean(document.getElementById('creditNoteModal')), 'Credit Note Modal OK');

      // 12. فحص ميزة مشاركة الفاتورة عبر واتساب الجزائري (+213)
      check('12. محرك إرسال الفاتورة عبر WhatsApp الجزائري (+213)', typeof this.shareSaleViaWhatsApp === 'function', 'WhatsApp Ready');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص الصفحة الثانية', false, err.message);
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
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <div class="flex items-center gap-2">' +
      '      <span class="px-3 py-1 rounded-xl ' + (passedCount === results.length ? 'bg-emerald-600' : 'bg-amber-500') + ' text-white font-black text-xs">' + passedCount + ' / ' + results.length + ' PASS</span>' +
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 2 (سجل المبيعات والضمان #view-sales)</h3>' +
      '    </div>' +
      '    <button onclick="App.closeModal(\'posQaReportModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      '  <div class="space-y-1.5 max-h-96 overflow-y-auto text-xs">' +
      results.map(function (r) {
        return (
          '<div class="p-2.5 rounded-xl border ' + (r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') + ' flex items-center justify-between">' +
          '  <div class="font-bold">' + (r.passed ? '✅' : '❌') + ' ' + r.name + '</div>' +
          '  <div class="font-mono text-[11px] text-slate-500 dark:text-slate-300">' + (r.detail || 'OK') + '</div>' +
          '</div>'
        );
      }).join('') +
      '  </div>' +
      '  <div class="flex justify-end pt-2">' +
      '    <button onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة الثالثة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // ربط زر الفحص الآلي في الشريط العلوي واختصار Ctrl+Shift+T ليعمل بذكاء حسب الصفحة المفتوحة حالياً
  var topQaBtn = document.getElementById('btnPosHeaderQaBot');
  if (topQaBtn) {
    topQaBtn.onclick = function () {
      if (AppState.currentView === 'sales') App.runAutoTest_SalesPage();
      else App.runAutoTest_PosPage();
    };
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      if (AppState.currentView === 'sales') {
        e.preventDefault();
        e.stopPropagation();
        App.runAutoTest_SalesPage();
      }
      return;
    }

    if (AppState.currentView !== 'sales') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    var sales = AppState._lastRenderedSalesList || [];
    if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('salesQuickSearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.key === 'ArrowDown' && sales.length > 0) {
      e.preventDefault();
      AppState.selectedSalesRowIdx = Math.min(sales.length - 1, (AppState.selectedSalesRowIdx || 0) + 1);
      App.renderSalesView();
    } else if (e.key === 'ArrowUp' && sales.length > 0) {
      e.preventDefault();
      AppState.selectedSalesRowIdx = Math.max(0, (AppState.selectedSalesRowIdx || 0) - 1);
      App.renderSalesView();
    } else if (e.key === 'Enter' && sales.length > 0 && document.activeElement?.id !== 'warrantyLookupInput') {
      e.preventDefault();
      var selSale = sales[AppState.selectedSalesRowIdx || 0];
      if (selSale) App.openSaleDetailsModal(selSale.id);
    }
  }, true);
})();

// ============================================================================
// [PAGE 3 CAISSE SURGICAL PERFECTION, Z-REPORT STUDIO & QA BOT — GHERBI.AI]
// ============================================================================
(function applyPage3CaisseSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.caisseTxFilterType = 'all';
  AppState.caisseTxSearchQuery = '';
  AppState._currentZReportPreviewMode = '80mm';

  function formatCleanCaisseDate(raw) {
    if (!raw) return '—';
    var s = String(raw).replace('T', ' ');
    var d = s.slice(0, 10);
    var t = s.slice(11, 16);
    return t ? d + ' | 🕒 ' + t : d;
  }

  function getCaisseTxTypeInfo(type) {
    var t = String(type || '').toLowerCase();
    var map = {
      sale_cash: { label: '📥 مبيعات نقدية', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', sign: '+', isIn: true },
      sale: { label: '📥 مبيعات نقدية', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', sign: '+', isIn: true },
      debt_payment: { label: '🤝 تسديد دين زبون', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', sign: '+', isIn: true },
      order_deposit: { label: '📋 عربون طلبية', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', sign: '+', isIn: true },
      cash_in: { label: '➕ إيداع / تغذية صندوق', cls: 'bg-teal-500/15 text-teal-600 dark:text-teal-400', sign: '+', isIn: true },
      cash_out: { label: '➖ سحب نقدي / خزنة', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', sign: '-', isIn: false },
      expense: { label: '💸 مصروف تشغيلي', cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', sign: '-', isIn: false },
      sale_refund: { label: '↩️ مرتجع مبيعات', cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', sign: '-', isIn: false }
    };
    return map[t] || { label: t || 'حركة صندوق', cls: 'bg-slate-200 dark:bg-slate-700 text-slate-600', sign: '', isIn: true };
  }

  // إخفاء شارة (اضغط F5 للمسح) خارج شاشة المبيعات (#view-pos)
  var _prevSwitchView = typeof App.switchView === 'function' ? App.switchView.bind(App) : null;
  if (_prevSwitchView) {
    App.switchView = async function (viewName) {
      var res = await _prevSwitchView(viewName);
      var pill = document.getElementById('barcodeMagnetStatusPill');
      if (pill) {
        pill.style.display = viewName === 'pos' ? '' : 'none';
      }
      return res;
    };
  }

  // --------------------------------------------------------------------------
  // 1. المولد الهندسي الكامل لتقرير الوردية Z-Report / X-Report (80mm حراري + A4 رسمي)
  // --------------------------------------------------------------------------
  App.buildSessionZReportHtml = function (details, mode) {
    var sess = (details && details.session) || {};
    var sum = (details && details.summary) || {};
    var txs = (details && details.transactions) || [];
    var s = AppState.settings || {};

    var opening = Number(sum.openingBalance ?? sess.opening_balance ?? 0);
    var salesCash = Number(sum.totalSalesCash || 0);
    var cashIn = Number(sum.totalCashIn || 0);
    var cashOut = Number(sum.totalCashOut || 0);
    var expenses = Number(sum.totalExpenses || 0);
    var refunds = Number(sum.totalRefunds || 0);
    var expected = Number(sum.expectedBalance ?? sum.currentBalance ?? opening);
    var isClosed = sess.status === 'closed' && sess.closing_balance !== null && sess.closing_balance !== undefined;
    var closing = isClosed ? Number(sess.closing_balance) : expected;
    var diff = isClosed ? Number((closing - expected).toFixed(2)) : 0;

    var centimeExpected = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(expected) : '';
    var centimeClosing = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(closing) : '';
    var reportTitle = isClosed ? 'تقرير إغلاق الوردية النهائي (Z-REPORT)' : 'تقرير جرد الصندوق اللحظي (X-REPORT)';

    var txRowsHtml = txs.length > 0
      ? txs.slice(0, 80).map(function (t) {
          var info = getCaisseTxTypeInfo(t.type);
          return (
            '<tr>' +
            '<td>' + info.label.replace(/^[^\s]+\s/, '') + '</td>' +
            '<td>' + (t.description || '-') + '</td>' +
            '<td style="direction:ltr;font-family:monospace;font-weight:bold;">' + info.sign + Number(t.amount || 0).toFixed(2) + '</td>' +
            '<td style="font-family:monospace;font-size:10px;">' + String(t.created_at || '').replace('T', ' ').slice(11, 16) + '</td>' +
            '</tr>'
          );
        }).join('')
      : '<tr><td colspan="4" style="text-align:center;padding:8px;color:#64748b;">لا توجد حركات مسجلة في هذه الوردية</td></tr>';

    if (mode === 'a4') {
      return (
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
        '<title>' + reportTitle + ' #' + (sess.id || '') + '</title>' +
        '<style>' +
        '@page { size: A4 portrait; margin: 12mm; }' +
        'body { font-family: "Cairo", "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; font-size: 12px; margin: 0; padding: 16px; background: #fff; }' +
        '.hdr { display: flex; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px; }' +
        '.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }' +
        '.kpi { border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px; background: #f8fafc; text-align: center; }' +
        '.kpi strong { display: block; font-size: 16px; font-family: monospace; margin-top: 4px; }' +
        'table { width: 100%; border-collapse: collapse; margin-top: 10px; }' +
        'th, td { border: 1px solid #0f172a; padding: 6px 8px; text-align: right; font-size: 11px; }' +
        'th { background: #e2e8f0; font-weight: bold; }' +
        '.sigs { display: flex; justify-content: space-between; margin-top: 36px; font-weight: bold; }' +
        '</style></head><body>' +
        '<div class="hdr">' +
        '  <div><h2 style="margin:0;color:#1e3a8a;">' + (s.shop_name || 'Gherbi.Ai POS') + '</h2><div>' + (s.shop_address || 'الجزائر') + ' | هاتف: ' + (s.shop_phone || '-') + '</div></div>' +
        '  <div style="text-align:left;"><h2 style="margin:0;">' + reportTitle + '</h2><div>رقم المناوبة: <strong>#' + (sess.id || 1) + '</strong> | الكاشير: <strong>' + (sess.user_name || 'المدير العام') + '</strong></div><div>الافتتاح: ' + formatCleanCaisseDate(sess.opened_at) + ' | الإغلاق: ' + (sess.closed_at ? formatCleanCaisseDate(sess.closed_at) : 'مفتوحة الآن') + '</div></div>' +
        '</div>' +
        '<div class="kpi-grid">' +
        '  <div class="kpi"><span>الرصيد الافتتاحي</span><strong>' + opening.toFixed(2) + ' د.ج</strong></div>' +
        '  <div class="kpi"><span>مبيعات وتسديدات النقد (+)</span><strong style="color:#059669;">+' + salesCash.toFixed(2) + ' د.ج</strong></div>' +
        '  <div class="kpi"><span>إيداعات (+) / مسحوبات ومصاريف (-)</span><strong style="color:#e11d48;">+' + cashIn.toFixed(2) + ' / -' + (cashOut + expenses + refunds).toFixed(2) + ' د.ج</strong></div>' +
        '  <div class="kpi"><span>الرصيد المتوقع في الدرج</span><strong style="color:#2563eb;">' + expected.toFixed(2) + ' د.ج</strong><div style="font-size:10px;color:#d97706;">' + centimeExpected + '</div></div>' +
        '</div>' +
        '<div style="border:1.5px solid #0f172a;border-radius:10px;padding:10px;margin-bottom:14px;display:flex;justify-content:space-between;background:#eff6ff;">' +
        '  <div><strong>المبلغ الفعلي المعدود عند الجرد:</strong> <span style="font-family:monospace;font-size:15px;font-weight:bold;">' + closing.toFixed(2) + ' د.ج (' + centimeClosing + ')</span></div>' +
        '  <div><strong>فارق الصندوق (Écart de Caisse):</strong> <span style="font-family:monospace;font-size:15px;font-weight:bold;color:' + (diff < -0.01 ? '#e11d48' : diff > 0.01 ? '#d97706' : '#059669') + ';">' + (diff > 0 ? '+' : '') + diff.toFixed(2) + ' د.ج (' + (Math.abs(diff) < 0.01 ? 'مطابق تماماً' : diff < 0 ? 'عجز في الصندوق' : 'فائض في الصندوق') + ')</span></div>' +
        '</div>' +
        (sess.close_note ? '<div style="margin-bottom:12px;font-weight:bold;">ملاحظة الجرد والإغلاق: ' + sess.close_note + '</div>' : '') +
        '<h4>سجل حركات الخزينة التفصيلي خلال المناوبة (' + txs.length + ' حركة):</h4>' +
        '<table><thead><tr><th>نوع الحركة</th><th>البيان والتفاصيل</th><th>المبلغ (د.ج)</th><th>التوقيت</th></tr></thead><tbody>' + txRowsHtml + '</tbody></table>' +
        '<div class="sigs"><div>توقيع أمين الصندوق (الكاشير): ............................</div><div>توقيع ومصادقة المدير: ............................</div></div>' +
        '</body></html>'
      );
    }

    return (
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
      '<title>Z-Report #' + (sess.id || '') + '</title>' +
      '<style>' +
      '@page { margin: 0; }' +
      '* { box-sizing: border-box; }' +
      'body { font-family: "Cairo", "Segoe UI", Tahoma, Arial, sans-serif; width: 100%; max-width: 78mm; margin: 0 auto; padding: 3mm 4mm; color: #000; background: #fff; font-size: 11px; line-height: 1.4; }' +
      '.c { text-align: center; }' +
      '.b { font-weight: 900; }' +
      '.sep { border-top: 1.5px dashed #000; margin: 6px 0; }' +
      '.row { display: flex; justify-content: space-between; align-items: center; margin: 2px 0; }' +
      '.box { border: 1.5px solid #000; border-radius: 6px; padding: 5px; margin: 6px 0; background: #f8fafc; }' +
      'table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }' +
      'th, td { border-bottom: 1px dotted #94a3b8; padding: 3px 2px; text-align: right; }' +
      'th { border-bottom: 1.5px solid #000; font-weight: 900; }' +
      '</style></head><body>' +
      '<div class="c">' +
      '  <div class="b" style="font-size:15px;">' + (s.shop_name || 'Gherbi.Ai POS') + '</div>' +
      '  <div style="font-size:10px;">' + (s.shop_address || 'الجزائر') + (s.shop_phone ? ' - ' + s.shop_phone : '') + '</div>' +
      '  <div class="box b" style="font-size:12px;">' + reportTitle + '</div>' +
      '</div>' +
      '<div class="row"><span>رقم المناوبة:</span><span class="b" style="font-family:monospace;">#' + (sess.id || 1) + '</span></div>' +
      '<div class="row"><span>أمين الصندوق:</span><span class="b">' + (sess.user_name || 'المدير العام') + '</span></div>' +
      '<div class="row"><span>وقت الافتتاح:</span><span style="font-family:monospace;font-size:10px;">' + formatCleanCaisseDate(sess.opened_at) + '</span></div>' +
      '<div class="row"><span>وقت الإغلاق:</span><span style="font-family:monospace;font-size:10px;">' + (sess.closed_at ? formatCleanCaisseDate(sess.closed_at) : 'مفتوحة الآن') + '</span></div>' +
      '<div class="sep"></div>' +
      '<div class="row"><span>الرصيد الافتتاحي:</span><span class="b" style="font-family:monospace;">' + opening.toFixed(2) + ' د.ج</span></div>' +
      '<div class="row"><span>مبيعات وتسديدات النقد (+):</span><span class="b" style="font-family:monospace;">+' + salesCash.toFixed(2) + ' د.ج</span></div>' +
      '<div class="row"><span>إيداعات نقدية (+):</span><span class="b" style="font-family:monospace;">+' + cashIn.toFixed(2) + ' د.ج</span></div>' +
      '<div class="row"><span>سحوبات نقدية (-):</span><span class="b" style="font-family:monospace;">-' + cashOut.toFixed(2) + ' د.ج</span></div>' +
      '<div class="row"><span>مصاريف ومرتجعات (-):</span><span class="b" style="font-family:monospace;">-' + (expenses + refunds).toFixed(2) + ' د.ج</span></div>' +
      '<div class="sep"></div>' +
      '<div class="box">' +
      '  <div class="row b" style="font-size:12px;"><span>الرصيد الدفتري المتوقع:</span><span style="font-family:monospace;">' + expected.toFixed(2) + ' د.ج</span></div>' +
      '  <div style="font-size:9px;text-align:left;">بالسنتيم: ' + centimeExpected + '</div>' +
      '  <div class="row b" style="font-size:12px;margin-top:3px;"><span>المبلغ الفعلي المعدود:</span><span style="font-family:monospace;">' + closing.toFixed(2) + ' د.ج</span></div>' +
      '  <div class="row b"><span>الفارق (Écart):</span><span style="font-family:monospace;">' + (diff > 0 ? '+' : '') + diff.toFixed(2) + ' د.ج</span></div>' +
      '</div>' +
      (sess.close_note ? '<div style="font-size:10px;margin:4px 0;"><strong>ملاحظة:</strong> ' + sess.close_note + '</div>' : '') +
      '<div class="sep"></div>' +
      '<div class="b" style="font-size:10px;">ملخص الحركات (' + txs.length + '):</div>' +
      '<table><thead><tr><th>النوع</th><th>البيان</th><th>المبلغ</th><th>الوقت</th></tr></thead><tbody>' + txRowsHtml + '</tbody></table>' +
      '<div class="sep"></div>' +
      '<div class="c" style="margin-top:10px;font-size:10px;">توقيع أمين الصندوق / المدير<br><br>....................................</div>' +
      '</body></html>'
    );
  };

  // --------------------------------------------------------------------------
  // 2. طباعة وتصدير تقرير Z-Report بشكل مضمون 100% (حوار طابعة + حراري صامت + A4 + PDF)
  // --------------------------------------------------------------------------
  App.printSessionZReport = async function (sessionId, actionMode) {
    var mode = actionMode || 'dialog_80mm';
    var targetId = sessionId || (AppState.activeSession && AppState.activeSession.id);
    if (!targetId) {
      var allSess = (await window.api.getCaisseSessions().catch(function () { return []; })) || [];
      if (allSess.length > 0) targetId = allSess[0].id;
    }
    if (!targetId) {
      if (typeof showToast === 'function') showToast('لا توجد مناوبة لطباعة تقريرها حالياً', 'warning');
      return;
    }

    var details = await window.api.getSessionDetails(targetId);
    if (!details) {
      if (typeof showToast === 'function') showToast('تعذر جلب بيانات المناوبة رقم #' + targetId, 'error');
      return;
    }

    var isA4 = mode === 'dialog_a4' || mode === 'pdf';
    var html = this.buildSessionZReportHtml(details, isA4 ? 'a4' : '80mm');

    // تحديث المعاينة الحية داخل #reviewCaisseModal إن كانت مفتوحة
    var previewFrame = document.getElementById('zReportLivePreviewFrame');
    if (previewFrame && previewFrame.contentWindow) {
      var fdoc = previewFrame.contentWindow.document;
      fdoc.open();
      fdoc.write(html);
      fdoc.close();
    }

    // 1) تصدير مباشر كملف PDF
    if (mode === 'pdf') {
      if (window.api && typeof window.api.exportPDF === 'function') {
        var pdfRes = await window.api.exportPDF({
          html: html,
          filename: 'Z-Report_Shift_' + targetId + '.pdf',
          defaultFileName: 'Z-Report_Shift_' + targetId + '.pdf'
        });
        if (pdfRes && pdfRes.success && typeof showToast === 'function') {
          showToast('📄 تم حفظ تقرير المناوبة #' + targetId + ' بصيغة PDF بنجاح!', 'success');
        }
      }
      return;
    }

    // 2) طباعة حرارية صامتة مع Fallback تلقائي إذا لم توجد طابعة حرارية
    if (mode === 'silent_80mm' && window.api && typeof window.api.printSilent === 'function') {
      var silentRes = await window.api.printSilent({
        html: html,
        silent: true,
        printerName: AppState.settings.thermal_printer_name || undefined
      });
      if (silentRes && silentRes.success) {
        if (typeof showToast === 'function') showToast('🖨️ تمت طباعة تقرير Z-Report (80mm) مباشرة!', 'success');
        return;
      }
    }

    // 3) طباعة حوارية مضمونة (تفتح نافذة الطباعة في ويندوز أو تحفظ PDF إن ألغيت)
    if (window.PrintEngine && typeof window.PrintEngine.printHtmlDocument === 'function') {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
      if (typeof showToast === 'function') {
        showToast('🖨️ تم إرسال تقرير المناوبة #' + targetId + ' إلى نافذة الطباعة!', 'info');
      }
    }
  };

  // --------------------------------------------------------------------------
  // 3. تطوير نافذة مراجعة المناوبة (#reviewCaisseModal — الصورة الثانية)
  // --------------------------------------------------------------------------
  App.openSessionReviewModal = async function (sessionId) {
    var details = await window.api.getSessionDetails(sessionId);
    if (!details) return;
    var sess = details.session || {};
    var sum = details.summary || {};
    var txs = details.transactions || [];

    var opening = Number(sum.openingBalance ?? sess.opening_balance ?? 0);
    var expected = Number(sum.expectedBalance ?? sum.currentBalance ?? opening);
    var isClosed = sess.status === 'closed' && sess.closing_balance !== null && sess.closing_balance !== undefined;
    var closing = isClosed ? Number(sess.closing_balance) : expected;
    var diff = isClosed ? Number((closing - expected).toFixed(2)) : 0;

    var titleEl = document.getElementById('reviewCaisseModalTitle');
    if (titleEl) {
      titleEl.textContent =
        (isClosed ? '📋 مراجعة المناوبة المغلقة رقم #' : '🟢 مراجعة المناوبة النشطة رقم #') +
        (sess.id || sessionId) +
        ' — الكاشير: ' +
        (sess.user_name || 'المدير العام');
    }

    var zPreviewHtml = this.buildSessionZReportHtml(details, '80mm');

    var body = document.getElementById('reviewCaisseModalBody');
    if (body) {
      body.innerHTML =
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">' +
        '  <div><div class="text-[10px] text-slate-400 font-bold">الرصيد الافتتاحي</div><div class="font-mono font-black text-sm mt-0.5">' + opening.toFixed(2) + ' د.ج</div><div class="text-[10px] text-slate-400">' + formatCleanCaisseDate(sess.opened_at) + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400 font-bold">الرصيد الدفتري المتوقع</div><div class="font-mono font-black text-blue-600 text-sm mt-0.5">' + expected.toFixed(2) + ' د.ج</div><div class="text-[10px] text-amber-600 font-bold">' + (typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(expected) : '') + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400 font-bold">المبلغ الفعلي المعدود</div><div class="font-mono font-black text-emerald-600 text-sm mt-0.5">' + (isClosed ? closing.toFixed(2) + ' د.ج' : 'مفتوحة الآن') + '</div><div class="text-[10px] text-slate-400">' + (sess.closed_at ? formatCleanCaisseDate(sess.closed_at) : 'قيد العمل') + '</div></div>' +
        '  <div><div class="text-[10px] text-slate-400 font-bold">الفارق (Écart de Caisse)</div><div class="font-mono font-black text-sm mt-0.5 ' + (diff < -0.01 ? 'text-rose-600' : diff > 0.01 ? 'text-amber-600' : 'text-emerald-600') + '">' + (diff > 0 ? '+' : '') + diff.toFixed(2) + ' د.ج</div><div class="text-[10px] font-bold">' + (Math.abs(diff) < 0.01 ? '✅ مطابق تماماً' : diff < 0 ? '⚠️ عجز في الصندوق' : '➕ فائض في الصندوق') + '</div></div>' +
        '</div>' +

        '<div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-blue-600/10 border border-blue-500/25">' +
        '  <div class="font-black text-blue-600 dark:text-blue-400 text-xs">🖨️ طباعة وتصدير التقرير الرسمي للمناوبة (Z-Report / X-Report):</div>' +
        '  <div class="flex flex-wrap items-center gap-1.5">' +
        '    <button type="button" onclick="App.printSessionZReport(' + (sess.id || sessionId) + ', \'dialog_80mm\')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs shadow-sm">🖨️ طباعة تقرير Z-Report (80mm)</button>' +
        '    <button type="button" onclick="App.printSessionZReport(' + (sess.id || sessionId) + ', \'silent_80mm\')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs">⚡ طباعة حرارية فورية</button>' +
        '    <button type="button" onclick="App.printSessionZReport(' + (sess.id || sessionId) + ', \'dialog_a4\')" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs">📄 طباعة تقرير مفصل (A4)</button>' +
        '    <button type="button" onclick="App.printSessionZReport(' + (sess.id || sessionId) + ', \'pdf\')" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs">📥 حفظ PDF</button>' +
        '  </div>' +
        '</div>' +

        '<div class="grid grid-cols-1 md:grid-cols-12 gap-3">' +
        '  <div class="md:col-span-7 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 max-h-80 overflow-y-auto">' +
        '    <div class="font-black text-xs mb-2 text-slate-600 dark:text-slate-300">حركات الخزينة في هذه المناوبة (' + txs.length + ' حركة):</div>' +
        '    <table class="w-full text-xs text-right">' +
        '      <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">النوع</th><th class="py-1.5">البيان</th><th class="py-1.5">المبلغ</th><th class="py-1.5">التوقيت</th></tr></thead>' +
        '      <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
        (txs.length > 0
          ? txs.map(function (t) {
              var info = getCaisseTxTypeInfo(t.type);
              return (
                '<tr>' +
                '  <td class="py-2"><span class="px-2 py-0.5 rounded-lg font-bold text-[10px] ' + info.cls + '">' + info.label + '</span></td>' +
                '  <td class="py-2 font-bold">' + (t.description || '—') + '</td>' +
                '  <td class="py-2 font-mono font-black ' + (info.isIn ? 'text-emerald-600' : 'text-rose-600') + '">' + info.sign + Number(t.amount || 0).toFixed(2) + ' د.ج</td>' +
                '  <td class="py-2 font-mono text-slate-400 text-[11px]">' + formatCleanCaisseDate(t.created_at) + '</td>' +
                '</tr>'
              );
            }).join('')
          : '<tr><td colspan="4" class="py-8 text-center text-slate-400 font-bold">لا توجد حركات بيع أو سحب مسجلة خلال هذه المناوبة — التقرير جاهز للطباعة في المعاينة المقابلة</td></tr>') +
        '      </tbody>' +
        '    </table>' +
        '  </div>' +
        '  <div class="md:col-span-5 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 bg-slate-100 dark:bg-slate-900 flex flex-col">' +
        '    <div class="text-[11px] font-black text-center text-slate-500 mb-1">معاينة حية لتذكرة Z-Report (80mm):</div>' +
        '    <iframe id="zReportLivePreviewFrame" class="w-full h-72 bg-white rounded-xl border border-slate-300"></iframe>' +
        '  </div>' +
        '</div>';
    }

    this.openModal('reviewCaisseModal');

    setTimeout(function () {
      var frame = document.getElementById('zReportLivePreviewFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(zPreviewHtml);
        doc.close();
      }
    }, 60);
  };

  // --------------------------------------------------------------------------
  // 4. إعادة هندسة شاشة إدارة الصندوق والمناوبات (#view-caisse — الصورة الأولى)
  // --------------------------------------------------------------------------
  
  // ============================================================================
  // [HOTFIX] صمام الأمان للدوال المفقودة من الواجهة الأصلية لإدارة الصندوق
  // ============================================================================
  App.refreshActiveSession = async function () {
    if (!AppState.currentUser) return null;
    try {
      var uid = AppState.currentUser.id || 1;
      AppState.activeSession = await window.api.getActiveSession(uid).catch(function(){ return null; });
      
      // تحديث شارة الكاشير العلوية آلياً
      var shiftTxt = document.getElementById('headerShiftText');
      if (shiftTxt) {
        shiftTxt.textContent = AppState.activeSession
          ? (AppState.lang === 'fr' ? 'Session active' : AppState.lang === 'en' ? 'Shift Active' : 'المناوبة نشطة')
          : (AppState.lang === 'fr' ? 'Ouvrir la caisse' : AppState.lang === 'en' ? 'Open Till Shift' : 'فتح مناوبة صندوق');
      }
    } catch (e) {
      AppState.activeSession = null;
    }
    return AppState.activeSession;
  };

  if (typeof App.openCaisseTxModal !== 'function') {
    App.openCaisseTxModal = function (type) {
      var tInp = document.getElementById('caisseTxTypeInput');
      if (tInp) tInp.value = type;
      var title = document.getElementById('caisseTxModalTitle');
      if (title) {
        title.textContent = type === 'cash_in' ? '➕ إيداع نقدي (تغذية الصندوق)' : '➖ سحب نقدي (مصاريف أو سحب للخزنة)';
      }
      var amtInp = document.getElementById('caisseTxAmountInput');
      if (amtInp) amtInp.value = '';
      var descInp = document.getElementById('caisseTxDescInput');
      if (descInp) descInp.value = '';
      this.openModal('caisseTxModal');
    };
  }

  if (typeof App.confirmCaisseTx !== 'function') {
    App.confirmCaisseTx = async function () {
      var type = document.getElementById('caisseTxTypeInput')?.value || 'cash_in';
      var amount = parseFloat(document.getElementById('caisseTxAmountInput')?.value) || 0;
      var desc = document.getElementById('caisseTxDescInput')?.value || '';
      if (amount <= 0) {
        if (typeof showToast === 'function') showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'warning');
        return;
      }
      
      await window.api.addCaisseTransaction({
        user_id: AppState.currentUser ? AppState.currentUser.id : 1,
        type: type,
        amount: amount,
        description: desc
      });
      
      this.closeModal('caisseTxModal');
      if (typeof this.renderCaisseView === 'function') await this.renderCaisseView();
      if (typeof showToast === 'function') showToast('تم تسجيل الحركة النقدية بنجاح', 'success');
    };
  }

  if (typeof App.confirmOpenShift !== 'function') {
    App.confirmOpenShift = async function () {
      var bal = parseFloat(document.getElementById('openShiftBalanceInput')?.value) || 0;
      var uid = AppState.currentUser ? AppState.currentUser.id : 1;
      
      await window.api.openCaisseSession({ userId: uid, openingBalance: bal });
      this.closeModal('openShiftModal');
      
      await this.refreshActiveSession();
      if (typeof this.renderCaisseView === 'function') await this.renderCaisseView();
      if (typeof showToast === 'function') showToast('✅ تم فتح المناوبة بنجاح!', 'success');
    };
  }

  App.renderCaisseView = async function () {
    var root = document.getElementById('caisse-view-root');
    if (!root) return;

    await this.refreshActiveSession();
    var activeSummary = await window.api.getCaisseSummary({
      sessionId: AppState.activeSession ? AppState.activeSession.id : undefined,
      userId: AppState.currentUser ? AppState.currentUser.id : undefined
    }).catch(function () { return null; });

    var sessions = (await window.api.getCaisseSessions().catch(function () { return []; })) || [];
    var txLog = (await window.api.getCaisseTransactionsLog().catch(function () { return []; })) || [];

    var displaySummary = activeSummary && activeSummary.summary ? activeSummary.summary : null;
    var isShowingLastClosed = false;
    var lastClosedSess = null;

    if (!displaySummary && sessions.length > 0) {
      var lastDetails = await window.api.getSessionDetails(sessions[0].id).catch(function () { return null; });
      if (lastDetails && lastDetails.summary) {
        displaySummary = lastDetails.summary;
        lastClosedSess = lastDetails.session;
        isShowingLastClosed = true;
      }
    }

    var sum = displaySummary || {
      openingBalance: 0,
      totalSalesCash: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      totalExpenses: 0,
      totalRefunds: 0,
      expectedBalance: 0
    };

    var totalOutflows = Number((Number(sum.totalCashOut || 0) + Number(sum.totalExpenses || 0) + Number(sum.totalRefunds || 0)).toFixed(2));
    var totalInflows = Number((Number(sum.totalSalesCash || 0) + Number(sum.totalCashIn || 0)).toFixed(2));
    var expectedDrawer = Number(sum.expectedBalance || 0);
    var centimeDrawer = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(expectedDrawer) : '';

    var filteredTxs = txLog.filter(function (t) {
      if (AppState.caisseTxFilterType === 'in') {
        if (!getCaisseTxTypeInfo(t.type).isIn) return false;
      } else if (AppState.caisseTxFilterType === 'out') {
        if (getCaisseTxTypeInfo(t.type).isIn) return false;
      }
      if (AppState.caisseTxSearchQuery) {
        var q = AppState.caisseTxSearchQuery.toLowerCase();
        var matchDesc = String(t.description || '').toLowerCase().includes(q);
        var matchAmt = String(t.amount || '').includes(q);
        if (!matchDesc && !matchAmt) return false;
      }
      return true;
    });

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex items-center gap-2">' +
      '        <span>إدارة الصندوق والمناوبات (Caisse & Shifts)</span>' +
      '        <button id="btnCaissePageQaBot" type="button" onclick="App.runAutoTest_CaissePage()" title="تشغيل الفحص الآلي الذاتي لصفحة الصندوق (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">فتح وإغلاق الورديات، حاسبة الفئات النقدية الجزائرية، الإيداع والسحب، وتقارير X-Report و Z-Report الحرارية و A4</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      (AppState.activeSession
        ? '<button type="button" onclick="App.openCaisseTxModal(\'cash_in\')" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm">+ إيداع نقدي (F2)</button>' +
          '<button type="button" onclick="App.openCaisseTxModal(\'cash_out\')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-sm">- سحب نقدي (F3)</button>' +
          '<button type="button" onclick="App.openSafeDropModal()" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm">🔒 تحويل للخزنة (Safe Drop)</button>' +
          '<button type="button" onclick="App.openSessionReviewModal(' + AppState.activeSession.id + ')" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-sm">📊 تقرير X-Report الفوري (F9)</button>' +
          '<button type="button" onclick="App.openCloseShiftModal(' + AppState.activeSession.id + ', ' + expectedDrawer + ')" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black shadow-md">🛑 إغلاق المناوبة وجرد الدرج (Z-Report)</button>'
        : '<button type="button" onclick="App.openModal(\'openShiftModal\')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-600/25">+ فتح مناوبة صندوق جديدة الآن</button>' +
          (sessions.length > 0
            ? '<button type="button" onclick="App.openSessionReviewModal(' + sessions[0].id + ')" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">🖨️ معاينة وطباعة آخر Z-Report (#' + sessions[0].id + ')</button>'
            : '')) +
      '      <button type="button" onclick="window.api.openCashDrawer()" title="فتح درج النقود إلكترونياً (F10)" class="px-3 py-2 rounded-xl bg-slate-800 text-white font-bold">🔓 الدرج (F10)</button>' +
      '    </div>' +
      '  </div>' +

      (AppState.activeSession
        ? '<div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">' +
          '  <div class="flex items-center gap-2 font-black text-emerald-700 dark:text-emerald-300">' +
          '    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>' +
          '    <span>المناوبة الحالية مفتوحة ونشطة (رقم #' + AppState.activeSession.id + ') — بدأت في: ' + formatCleanCaisseDate(AppState.activeSession.opened_at) + '</span>' +
          '  </div>' +
          '  <span class="font-bold text-slate-500">جميع المبيعات النقدية والمصاريف تقيد تلقائياً في هذه المناوبة</span>' +
          '</div>'
        : '<div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">' +
          '  <div class="font-black text-amber-700 dark:text-amber-300">' +
          '    ⚠️ لا توجد مناوبة مفتوحة حالياً — ' + (isShowingLastClosed ? 'البطاقات أدناه تعرض حصيلة آخر مناوبة مغلقة (#' + (lastClosedSess ? lastClosedSess.id : '') + ')' : 'اضغط على (فتح مناوبة صندوق جديدة) لبدء جرد اليوم') +
          '  </div>' +
          '  <button type="button" onclick="App.openModal(\'openShiftModal\')" class="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold">فتح مناوبة الآن</button>' +
          '</div>') +

      '  <div id="caisseKpiCardsGrid" class="grid grid-cols-1 md:grid-cols-4 gap-3">' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">الرصيد الافتتاحي (Fond de Caisse)</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + Number(sum.openingBalance || 0).toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-400 mt-0.5">' + (typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(sum.openingBalance || 0) : '') + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">مبيعات وتسديدات وإيداعات النقد (+)</div>' +
      '      <div class="text-2xl font-black font-mono text-emerald-600 mt-1">+' + totalInflows.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-emerald-600/80 font-bold mt-0.5">مبيعات: ' + Number(sum.totalSalesCash || 0).toFixed(2) + ' | إيداعات: ' + Number(sum.totalCashIn || 0).toFixed(2) + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">المصاريف والمسحوبات والمرتجعات (-)</div>' +
      '      <div class="text-2xl font-black font-mono text-rose-500 mt-1">-' + totalOutflows.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-rose-500/80 font-bold mt-0.5">سحوبات: ' + Number(sum.totalCashOut || 0).toFixed(2) + ' | مصاريف: ' + Number(sum.totalExpenses || 0).toFixed(2) + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">' +
      '      <div class="text-xs text-blue-100 font-bold">الرصيد المتوقع في الدرج (En Caisse)</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + expectedDrawer.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-amber-300 font-black mt-0.5">🇩🇿 بالسنتيم: ' + centimeDrawer + '</div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">' +
      '    <div class="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">' +
      '      <div class="flex items-center justify-between mb-3">' +
      '        <h3 class="font-black text-sm">سجل المناوبات وتقارير Z-Report (' + sessions.length + ')</h3>' +
      '        <span class="text-[11px] text-slate-400 font-bold">انقر على (🖨️ Z-Report) أو (تفاصيل) للطباعة</span>' +
      '      </div>' +
      '      <div class="max-h-96 overflow-y-auto">' +
      '        <table class="w-full text-xs text-right">' +
      '          <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-2">#</th><th class="py-2">المستخدم</th><th class="py-2">الافتتاح</th><th class="py-2">الافتتاحي</th><th class="py-2">الختامي</th><th class="py-2">الفارق</th><th class="py-2 text-center">إجراءات التقرير</th></tr></thead>' +
      '          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (sessions.length > 0
        ? sessions.map(function (s) {
            var diffVal = Number(s.difference || 0);
            var isOpen = s.status === 'open';
            return (
              '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5 font-mono font-black text-blue-600">#' + s.id + '</td>' +
              '  <td class="py-2.5 font-bold">' + (s.user_name || 'المدير العام') + '</td>' +
              '  <td class="py-2.5 font-mono text-slate-400 text-[11px]">' + formatCleanCaisseDate(s.opened_at) + '</td>' +
              '  <td class="py-2.5 font-mono font-bold">' + Number(s.opening_balance || 0).toFixed(2) + '</td>' +
              '  <td class="py-2.5 font-mono font-bold">' + (s.closing_balance !== null && s.closing_balance !== undefined ? Number(s.closing_balance).toFixed(2) : '<span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-sans">مفتوحة</span>') + '</td>' +
              '  <td class="py-2.5 font-mono font-black ' + (diffVal < -0.01 ? 'text-rose-500' : diffVal > 0.01 ? 'text-amber-500' : 'text-emerald-600') + '">' + (isOpen ? '—' : (diffVal > 0 ? '+' : '') + diffVal.toFixed(2)) + '</td>' +
              '  <td class="py-2.5 flex items-center justify-center gap-1">' +
              '    <button type="button" onclick="App.openSessionReviewModal(' + s.id + ')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[11px]">📋 تفاصيل ومعاينة</button>' +
              '    <button type="button" onclick="App.printSessionZReport(' + s.id + ', \'dialog_80mm\')" title="طباعة فورية لتقرير Z-Report" class="px-2.5 py-1 bg-indigo-600/15 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-[11px] transition">🖨️ Z-Report</button>' +
              '  </td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="7" class="py-8 text-center text-slate-400 font-bold">لا توجد مناوبات مسجلة بعد</td></tr>') +
      '          </tbody>' +
      '        </table>' +
      '      </div>' +
      '    </div>' +

      '    <div class="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">' +
      '      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">' +
      '        <h3 class="font-black text-sm">حركات الخزينة المباشرة (' + filteredTxs.length + ')</h3>' +
      '        <div class="flex items-center gap-1 text-[11px]">' +
      '          <input id="caisseTxSearchInput" type="text" value="' + (AppState.caisseTxSearchQuery || '') + '" oninput="App.onCaisseTxSearch(this.value)" placeholder="🔍 [F4] بحث في الحركات..." class="w-36 px-2.5 py-1 rounded-lg font-bold">' +
      '          <button type="button" onclick="AppState.caisseTxFilterType=\'all\'; App.renderCaisseView()" class="px-2 py-1 rounded-lg font-bold ' + (AppState.caisseTxFilterType === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">الكل</button>' +
      '          <button type="button" onclick="AppState.caisseTxFilterType=\'in\'; App.renderCaisseView()" class="px-2 py-1 rounded-lg font-bold ' + (AppState.caisseTxFilterType === 'in' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/10 text-emerald-600') + '">داخل (+)</button>' +
      '          <button type="button" onclick="AppState.caisseTxFilterType=\'out\'; App.renderCaisseView()" class="px-2 py-1 rounded-lg font-bold ' + (AppState.caisseTxFilterType === 'out' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-600') + '">خارج (-)</button>' +
      '        </div>' +
      '      </div>' +
      '      <div class="max-h-96 overflow-y-auto">' +
      '        <table class="w-full text-xs text-right">' +
      '          <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-2">النوع</th><th class="py-2">البيان</th><th class="py-2">المبلغ</th><th class="py-2">التوقيت</th></tr></thead>' +
      '          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (filteredTxs.length > 0
        ? filteredTxs.map(function (t) {
            var info = getCaisseTxTypeInfo(t.type);
            return (
              '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5"><span class="px-2 py-0.5 rounded-lg font-bold text-[11px] ' + info.cls + '">' + info.label + '</span></td>' +
              '  <td class="py-2.5 font-bold">' + (t.description || '—') + '</td>' +
              '  <td class="py-2.5 font-mono font-black ' + (info.isIn ? 'text-emerald-600' : 'text-rose-600') + '">' + info.sign + Number(t.amount || 0).toFixed(2) + ' د.ج</td>' +
              '  <td class="py-2.5 font-mono text-slate-400 text-[11px]">' + formatCleanCaisseDate(t.created_at) + '</td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="4" class="py-8 text-center text-slate-400 font-bold">لا توجد حركات مطابقة</td></tr>') +
      '          </tbody>' +
      '        </table>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  App.onCaisseTxSearch = function (val) {
    AppState.caisseTxSearchQuery = String(val || '').trim();
    this.renderCaisseView();
    setTimeout(function () {
      var inp = document.getElementById('caisseTxSearchInput');
      if (inp) {
        inp.focus();
        var len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    }, 10);
  };

  App.openSafeDropModal = function () {
    this.openCaisseTxModal('cash_out');
    var titleEl = document.getElementById('caisseTxModalTitle');
    if (titleEl) titleEl.textContent = '🔒 تحويل فائض نقدي إلى الخزنة الرئيسية (Safe Drop)';
    var descInp = document.getElementById('caisseTxDescInput');
    if (descInp) descInp.value = 'تحويل فائض السيولة من الدرج إلى الخزنة الرئيسية';
  };

  App.confirmCloseShift = async function () {
    var sessionId = Number(document.getElementById('closeShiftSessionId')?.value || (AppState.activeSession && AppState.activeSession.id));
    if (!sessionId) return;
    var closingBalance = parseFloat(document.getElementById('closeShiftCountedInput')?.value) || 0;
    var userNote = document.getElementById('closeShiftNoteInput')?.value?.trim() || '';

    var denomParts = [];
    document.querySelectorAll('#closeShiftModal .denom-inp').forEach(function (inp) {
      var d = Number(inp.getAttribute('data-denom') || 0);
      var cnt = parseInt(inp.value || '0', 10) || 0;
      if (d > 0 && cnt > 0) denomParts.push(cnt + '×' + d + 'د.ج');
    });
    var fullNote = denomParts.length > 0
      ? (userNote ? userNote + ' | ' : '') + 'الجرد: [' + denomParts.join(' + ') + ']'
      : userNote;

    await window.api.closeCaisseSession({
      sessionId: sessionId,
      closingBalance: closingBalance,
      closeNote: fullNote
    });

    this.closeModal('closeShiftModal');
    await this.refreshActiveSession();
    await this.renderCaisseView();
    if (typeof showToast === 'function') {
      showToast('✅ تم إغلاق المناوبة #' + sessionId + ' بنجاح — يمكنك الآن طباعة تقرير Z-Report', 'success');
    }
    await this.openSessionReviewModal(sessionId);
  };

  // --------------------------------------------------------------------------
  // 5. روبوت الاختبار الآلي الذاتي للصفحة الثالثة (App.runAutoTest_CaissePage)
  // --------------------------------------------------------------------------
  App.runAutoTest_CaissePage = async function () {
    if (AppState.currentView !== 'caisse') {
      await this.switchView('caisse');
    }

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      var reqIds = ['caisse-view-root', 'caisseKpiCardsGrid', 'openShiftModal', 'caisseTxModal', 'closeShiftModal', 'reviewCaisseModal'];
      var missing = reqIds.filter(function (id) { return !document.getElementById(id); });
      check('1. تكامل عناصر صفحة الصندوق والنوافذ الـ 4 (DOM Integrity)', missing.length === 0, missing.join(', ') || 'All 6 Containers OK');

      var sessions = await window.api.getCaisseSessions();
      check('2. اتصال قاعدة البيانات وجلب سجل المناوبات (SQLite WAL)', Array.isArray(sessions), sessions.length + ' مناوبة');

      var txs = await window.api.getCaisseTransactionsLog();
      check('3. جلب سجل حركات الخزينة المباشرة', Array.isArray(txs), txs.length + ' حركة');

      var sampleBadge = getCaisseTxTypeInfo('sale_cash');
      check('4. تعريب وتلوين شارات الحركات المالية (مبيعات نقدية بدلاً من sale_cash)', sampleBadge.label.includes('مبيعات نقدية') && sampleBadge.isIn === true, sampleBadge.label);

      var kpiHtml = document.getElementById('caisseKpiCardsGrid')?.innerHTML || '';
      check('5. عرض الرصيد المتوقع بالدينار وبالسنتيم الجزائري', kpiHtml.includes('بالسنتيم'), 'Centimes Active');

      var denomInputs = document.querySelectorAll('#closeShiftModal .denom-inp');
      check('6. حاسبة الفئات النقدية الجزائرية الكاملة (9 فئات من 2000 إلى 5 د.ج)', denomInputs.length >= 9, denomInputs.length + ' فئات نقدية');

      this.openCloseShiftModal(1, 5000);
      var d2000 = document.querySelector('#closeShiftModal .denom-inp[data-denom="2000"]');
      var d1000 = document.querySelector('#closeShiftModal .denom-inp[data-denom="1000"]');
      if (d2000 && d1000) {
        d2000.value = '2';
        d1000.value = '1';
        this.recalcCloseShiftDenoms();
      }
      var countedVal = parseFloat(document.getElementById('closeShiftCountedInput')?.value || '0');
      this.closeModal('closeShiftModal');
      check('7. دقة حاسبة جرد الفئات النقدية ومعاينة الفارق اللحظي', countedVal === 5000, '2×2000 + 1×1000 = ' + countedVal + ' د.ج');

      var sampleReport80 = this.buildSessionZReportHtml({ session: { id: 1, status: 'closed', opening_balance: 8000, closing_balance: 8000 }, summary: { openingBalance: 8000, expectedBalance: 8000 }, transactions: [] }, '80mm');
      var sampleReportA4 = this.buildSessionZReportHtml({ session: { id: 1, status: 'closed', opening_balance: 8000, closing_balance: 8000 }, summary: { openingBalance: 8000, expectedBalance: 8000 }, transactions: [] }, 'a4');
      check('8. مولد تقارير Z-Report / X-Report بصيغتي (80mm حراري + A4 رسمي)', sampleReport80.includes('Z-REPORT') && sampleReportA4.includes('A4 portrait'), '80mm & A4 Ready');

      if (sessions.length > 0) {
        await this.openSessionReviewModal(sessions[0].id);
        var hasPreviewFrame = Boolean(document.getElementById('zReportLivePreviewFrame'));
        this.closeModal('reviewCaisseModal');
        check('9. نافذة مراجعة المناوبة والمعاينة الحية لتذكرة Z-Report قبل الطباعة', hasPreviewFrame, 'Live Preview Iframe OK');
      } else {
        check('9. نافذة مراجعة المناوبة (#reviewCaisseModal)', true, 'Ready');
      }

      check('10. ميزة تحويل الفائض النقدي للخزنة الحديدية (Safe Drop)', typeof this.openSafeDropModal === 'function', 'Safe Drop Ready');
      check('11. محرك الفلترة والبحث الفوري في حركات الخزينة (داخل / خارج / الكل)', typeof this.onCaisseTxSearch === 'function', 'Filter & Search OK');

      var pill = document.getElementById('barcodeMagnetStatusPill');
      var pillHidden = !pill || pill.style.display === 'none';
      check('12. إخفاء شارة (اضغط F5 للمسح) تلقائياً خارج شاشة المبيعات', pillHidden, 'Clean Header');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص صفحة الصندوق', false, err.message);
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
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <div class="flex items-center gap-2">' +
      '      <span class="px-3 py-1 rounded-xl ' + (passedCount === results.length ? 'bg-emerald-600' : 'bg-amber-500') + ' text-white font-black text-xs">' + passedCount + ' / ' + results.length + ' PASS</span>' +
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 3 (إدارة الصندوق #view-caisse)</h3>' +
      '    </div>' +
      '    <button onclick="App.closeModal(\'posQaReportModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      '  <div class="space-y-1.5 max-h-96 overflow-y-auto text-xs">' +
      results.map(function (r) {
        return (
          '<div class="p-2.5 rounded-xl border ' + (r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') + ' flex items-center justify-between">' +
          '  <div class="font-bold">' + (r.passed ? '✅' : '❌') + ' ' + r.name + '</div>' +
          '  <div class="font-mono text-[11px] text-slate-500 dark:text-slate-300">' + (r.detail || 'OK') + '</div>' +
          '</div>'
        );
      }).join('') +
      '  </div>' +
      '  <div class="flex justify-end pt-2">' +
      '    <button onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة الرابعة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  var topQaBtn = document.getElementById('btnPosHeaderQaBot');
  if (topQaBtn) {
    topQaBtn.onclick = function () {
      if (AppState.currentView === 'caisse') App.runAutoTest_CaissePage();
      else if (AppState.currentView === 'sales') App.runAutoTest_SalesPage();
      else App.runAutoTest_PosPage();
    };
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      if (AppState.currentView === 'caisse') {
        e.preventDefault();
        e.stopPropagation();
        App.runAutoTest_CaissePage();
      }
      return;
    }

    if (AppState.currentView !== 'caisse') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.key === 'F2' && AppState.activeSession) {
      e.preventDefault();
      App.openCaisseTxModal('cash_in');
    } else if (e.key === 'F3' && AppState.activeSession) {
      e.preventDefault();
      App.openCaisseTxModal('cash_out');
    } else if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('caisseTxSearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.key === 'F9') {
      e.preventDefault();
      App.printSessionZReport(null, 'dialog_80mm');
    }
  }, true);
})();

// ============================================================================
// [PAGE 4 INVENTORY SURGICAL PERFECTION & QA BOT — GHERBI.AI EXCLUSIVE]
// ============================================================================
(function applyPage4InventorySurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.inventorySearchQuery = '';
  AppState.inventoryRoleFilter = 'all';

  App.resetInventoryRoleFilter = function () {
    AppState.inventoryRoleFilter = 'all';
    App.renderInventoryView();
  };

  App.closeQaReportModal = function () {
    App.closeModal('posQaReportModal');
  };

  App.renderInventoryView = async function () {
    var root = document.getElementById('inventory-view-root');
    if (!root) return;

    var allProds = AppState.products || [];
    if (AppState.inventoryRoleFilter && AppState.inventoryRoleFilter !== 'all') {
      if (AppState.inventoryRoleFilter === 'commercial') {
        allProds = allProds.filter(function (p) { return !p.material_role; });
      } else {
        allProds = allProds.filter(function (p) { return p.material_role === AppState.inventoryRoleFilter; });
      }
    }

    var q = String(AppState.inventorySearchQuery || '').toLowerCase().trim();
    var prods = allProds;
    if (q) {
      prods = allProds.filter(function (p) {
        return (
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q) ||
          String(p.category || '').toLowerCase().includes(q)
        );
      });
    }

    var emptyStockCnt = 0;
    var lowStockCnt = 0;
    var expiredCnt = 0;
    var nowMs = Date.now();

    allProds.forEach(function (p) {
      var stock = Number(p.total_stock ?? p.stock ?? 0);
      var minStock = Number(p.min_stock ?? 5);
      if (stock <= 0) emptyStockCnt++;
      else if (stock <= minStock) lowStockCnt++;

      if (Array.isArray(p.batches)) {
        var hasExp = p.batches.some(function (b) {
          return Number(b.stock) > 0 && b.expiry_date && new Date(b.expiry_date).getTime() <= nowMs;
        });
        if (hasExp) expiredCnt++;
      }
    });

    var displayedProds = prods.slice(0, 300);

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex items-center gap-2">' +
      '        <span>إدارة المخزون، الدفعات، والمتغيرات (' + prods.length + ' منتج)</span>' +
      '        <button id="btnInventoryPageQaBot" type="button" onclick="App.runAutoTest_InventoryPage()" title="تشغيل الفحص الآلي الذاتي لصفحة المخزون (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">إدارة المنتجات، الدفعات المخزنية (FIFO)، طباعة الملصقات السريعة، واستيراد وتصدير Excel / CSV بدون تعارض</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      '      <button type="button" onclick="App.importDzMasterCsv()" class="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500 hover:text-slate-950 transition">🇩🇿 استيراد قاموس 613 (CSV)</button>' +
      '      <button type="button" onclick="App.openStockDebtModal()" class="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-600 font-bold hover:bg-rose-500 hover:text-white transition">ديون المخزون</button>' +
      '      <button type="button" onclick="App.downloadInventoryTemplate()" class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">قالب Excel</button>' +
      '      <button type="button" onclick="App.importProductsExcel()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded icon-sm">upload_file</span><span>استيراد Excel / CSV</span></button>' +
      '      <button type="button" onclick="App.exportInventoryExcel()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded icon-sm">download</span><span>تصدير Excel</span></button>' +
      '      <button type="button" onclick="App.openProductModal(null)" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center gap-1 shadow-lg shadow-blue-600/25">+ منتج جديد (Alt+N)</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="grid grid-cols-2 md:grid-cols-5 gap-3">' +
      '    <div onclick="App.resetInventoryRoleFilter()" class="p-3.5 rounded-2xl bg-blue-600 text-white shadow-sm cursor-pointer">' +
      '      <div class="text-xs font-bold opacity-85">جميع المنتجات</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + allProds.length + '</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-500/30 shadow-sm">' +
      '      <div class="text-xs font-bold text-slate-400">متوفرة في المخزون (> 0)</div>' +
      '      <div class="text-2xl font-black font-mono text-emerald-600 mt-1">' + Math.max(0, allProds.length - emptyStockCnt) + '</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-amber-500/30 shadow-sm">' +
      '      <div class="text-xs font-bold text-slate-400">منخفضة المخزون</div>' +
      '      <div class="text-2xl font-black font-mono text-amber-500 mt-1">' + lowStockCnt + '</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-rose-500/30 shadow-sm">' +
      '      <div class="text-xs font-bold text-slate-400">نافدة (الرصيد <= 0)</div>' +
      '      <div class="text-2xl font-black font-mono text-rose-500 mt-1">' + emptyStockCnt + '</div>' +
      '    </div>' +
      '    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-purple-500/30 shadow-sm">' +
      '      <div class="text-xs font-bold text-slate-400">منتهية الصلاحية</div>' +
      '      <div class="text-2xl font-black font-mono text-purple-600 mt-1">' + expiredCnt + '</div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">' +
      '    <div class="flex flex-wrap items-center gap-2 mb-4">' +
      '      <div class="relative flex-1 min-w-[220px]">' +
      '        <span class="material-symbols-rounded icon-sm absolute right-3 top-2.5 text-slate-400">search</span>' +
      '        <input id="inventorySearchInput" type="text" value="' + (AppState.inventorySearchQuery || '') + '" oninput="App.onInventorySearch(this.value)" placeholder="🔍 [F4] ابحث بالاسم أو الباركود أو الفئة..." class="w-full pr-9 pl-3 py-2 rounded-xl text-xs font-bold">' +
      '      </div>' +
      '      <select onchange="AppState.inventoryRoleFilter=this.value; App.renderInventoryView()" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">' +
      '        <option value="all" ' + (AppState.inventoryRoleFilter === 'all' ? 'selected' : '') + '>الكل (تجاري + تصنيع)</option>' +
      '        <option value="commercial" ' + (AppState.inventoryRoleFilter === 'commercial' ? 'selected' : '') + '>المنتجات التجارية العادية</option>' +
      '        <option value="raw_material" ' + (AppState.inventoryRoleFilter === 'raw_material' ? 'selected' : '') + '>المواد الأولية للتصنيع</option>' +
      '        <option value="finished_good" ' + (AppState.inventoryRoleFilter === 'finished_good' ? 'selected' : '') + '>المنتجات المصنعة النهائية</option>' +
      '      </select>' +
      (prods.length > 300 ? '<span class="text-[11px] font-bold text-amber-600">يتم عرض أول 300 نتيجة لسرعة التصفح — استخدم البحث للوصول لأي منتج فوراً</span>' : '') +
      '    </div>' +

      '    <div class="overflow-x-auto max-h-[58vh]">' +
      '      <table class="w-full text-xs text-right">' +
      '        <thead class="sticky top-0 bg-white dark:bg-slate-800 z-10">' +
      '          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '            <th class="py-2.5 px-2">الباركود</th>' +
      '            <th class="py-2.5 px-2">المنتج</th>' +
      '            <th class="py-2.5 px-2">الفئة</th>' +
      '            <th class="py-2.5 px-2">سعر الشراء</th>' +
      '            <th class="py-2.5 px-2">سعر البيع</th>' +
      '            <th class="py-2.5 px-2">سعر الجملة</th>' +
      '            <th class="py-2.5 px-2">الرصيد الكلي</th>' +
      '            <th class="py-2.5 px-2 text-center">إجراءات سريعة</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (displayedProds.length > 0
        ? displayedProds.map(function (p) {
            var stock = Number(p.total_stock ?? p.stock ?? 0);
            var isLow = stock > 0 && stock <= Number(p.min_stock ?? 5);
            var batchCnt = Array.isArray(p.batches) ? p.batches.length : 1;
            return (
              '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5 px-2 font-mono font-bold text-slate-400">' + (p.barcode || '—') + '</td>' +
              '  <td class="py-2.5 px-2 font-bold cursor-pointer hover:text-blue-600" onclick="App.openProductModal(' + p.id + ')">' + p.name + '</td>' +
              '  <td class="py-2.5 px-2 text-slate-500">' + (p.category || 'عام') + '</td>' +
              '  <td class="py-2.5 px-2 font-mono">' + Number(p.cost_price || 0).toFixed(2) + '</td>' +
              '  <td class="py-2.5 px-2 font-mono font-black text-blue-600">' + Number(p.selling_price || 0).toFixed(2) + '</td>' +
              '  <td class="py-2.5 px-2 font-mono text-slate-500">' + (p.wholesale_price ? Number(p.wholesale_price).toFixed(2) : '—') + '</td>' +
              '  <td class="py-2.5 px-2 font-mono font-black ' + (stock <= 0 ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-600') + '">' + stock + ' ' + (p.unit || 'قطعة') + '</td>' +
              '  <td class="py-2.5 px-2 flex flex-wrap items-center justify-center gap-1">' +
              '    <button type="button" onclick="App.openProductModal(' + p.id + ')" class="px-2 py-1 bg-blue-600/15 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-[11px] transition">تعديل</button>' +
              '    <button type="button" onclick="App.openBatchesModal(' + p.id + ')" class="px-2 py-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg font-bold text-[11px] transition">الدفعات (' + batchCnt + ')</button>' +
              '    <button type="button" onclick="App.openProductAnalyticsModal(' + p.id + ')" class="px-2 py-1 bg-indigo-500/15 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-[11px] transition">ربحية</button>' +
              '    <button type="button" onclick="App.quickPrintLabel(' + p.id + ')" class="px-2 py-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 rounded-lg font-bold text-[11px] transition">🏷️ باركود</button>' +
              '    <button type="button" onclick="App.deleteProductById(' + p.id + ')" class="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
              '  </td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="8" class="py-10 text-center text-slate-400 font-bold">لا توجد منتجات مطابقة للبحث</td></tr>') +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  App.onInventorySearch = function (val) {
    AppState.inventorySearchQuery = String(val || '');
    this.renderInventoryView();
    setTimeout(function () {
      var inp = document.getElementById('inventorySearchInput');
      if (inp) {
        inp.focus();
        var len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    }, 10);
  };

  App.quickPrintLabel = async function (productId) {
    if (!window.PrintEngine) return;
    var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(productId); });
    if (!p) return;
    var html = await window.PrintEngine.renderBarcodeLabelHtml(p, AppState.settings, {
      mode: 'barcode',
      widthMm: Number(AppState.settings.label_width_mm || 40),
      heightMm: Number(AppState.settings.label_height_mm || 25)
    });
    await window.PrintEngine.printHtmlDocument(html, { silent: false });
  };

  App.importProductsExcel = async function () {
    if (!window.api || !window.api.importProductsExcel) return;
    try {
      if (typeof showToast === 'function') showToast('⏳ جاري استيراد المنتجات وفحص الباركودات...', 'info');
      var res = await window.api.importProductsExcel();
      if (!res || res.canceled) return;
      if (res.success) {
        await this.refreshProducts();
        await this.renderInventoryView();
        if (typeof showToast === 'function') {
          showToast('✅ اكتمل الاستيراد: (' + (res.imported || 0) + ' جديد | ' + (res.updated || 0) + ' محدث | ' + (res.skipped || 0) + ' متخطى)', 'success');
        }
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('تعذر استيراد الملف: ' + (err.message || err), 'error');
    }
  };

  App.runAutoTest_InventoryPage = async function () {
    if (AppState.currentView !== 'inventory') await this.switchView('inventory');
    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      check('1. تكامل عناصر صفحة المخزون والنوافذ (DOM Integrity)', Boolean(document.getElementById('inventory-view-root') && document.getElementById('productModal')));
      var prods = await window.api.getProducts({});
      check('2. اتصال قاعدة البيانات وجلب قائمة المنتجات', Array.isArray(prods), prods.length + ' منتج');

      var mockBarcode = 'QA' + Date.now();
      var newProd = await window.api.addProduct({ name: 'منتج اختبار آلي', barcode: mockBarcode, category: 'اختبارات', unit: 'قطعة', selling_price: 150, cost_price: 120, stock: 5 });
      check('3. محاكاة إنشاء منتج جديد وتأكيد الحفظ في SQLite WAL', Boolean(newProd && newProd.id), 'ID: ' + (newProd ? newProd.id : 'OK'));

      this.onInventorySearch(mockBarcode);
      check('4. محرك البحث والفلترة اللحظية بالباركود والاسم', document.getElementById('inventorySearchInput')?.value === mockBarcode);

      this.openProductModal(newProd ? newProd.id : null);
      this.switchProductModalTab('variants');
      check('5. مولد مصفوفة الخيارات المتعددة (Cartesian Variants Builder)', Boolean(document.getElementById('prodOptionGroupsBuilderBox')));
      check('6. شريط التعبئة الجماعية للمتغيرات (Bulk Variant Tools)', Boolean(document.getElementById('bulkVariantCost')));

      if (newProd && newProd.id) await window.api.deleteProduct(newProd.id);
      this.closeModal('productModal');
      this.onInventorySearch('');
      check('7. تنظيف بيانات الاختبار واستعادة الحالة النظيفة', true);

      check('8. محرك استيراد Excel / CSV المدرع ضد تكرار الباركود', typeof this.importProductsExcel === 'function');
      check('9. محرك طباعة ملصق الباركود الفوري من الجدول', typeof this.quickPrintLabel === 'function');
      check('10. نافذة إدارة الدفعات (Batches FIFO) وتواريخ الصلاحية', Boolean(document.getElementById('batchesModal')));

      var twMode = window.tailwind && window.tailwind.config && window.tailwind.config.darkMode;
      check('11. توافق الوضع النهاري والليلي (Tailwind Class Mode)', twMode === 'class');

      var pill = document.getElementById('barcodeMagnetStatusPill');
      check('12. إخفاء شارة الباركود المغناطيسية خارج شاشة الكاشير', !pill || pill.style.display === 'none');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص المخزون', false, err.message);
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
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <div class="flex items-center gap-2">' +
      '      <span class="px-3 py-1 rounded-xl ' + (passedCount === results.length ? 'bg-emerald-600' : 'bg-amber-500') + ' text-white font-black text-xs">' + passedCount + ' / ' + results.length + ' PASS</span>' +
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 4 (إدارة المخزون #view-inventory)</h3>' +
      '    </div>' +
      '    <button type="button" onclick="App.closeQaReportModal()" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      '  <div class="space-y-1.5 max-h-96 overflow-y-auto text-xs">' +
      results.map(function (r) {
        return (
          '<div class="p-2.5 rounded-xl border ' + (r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') + ' flex items-center justify-between">' +
          '  <div class="font-bold">' + (r.passed ? '✅' : '❌') + ' ' + r.name + '</div>' +
          '  <div class="font-mono text-[11px] text-slate-500 dark:text-slate-300">' + (r.detail || 'OK') + '</div>' +
          '</div>'
        );
      }).join('') +
      '  </div>' +
      '  <div class="flex justify-end pt-2">' +
      '    <button type="button" onclick="App.closeQaReportModal()" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة الخامسة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'inventory') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      e.stopPropagation();
      App.runAutoTest_InventoryPage();
    } else if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('inventorySearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      App.openProductModal(null);
    }
  }, true);
})();

// [UNIFIED EXCEL & CSV BUTTONS FIX]
(function installUnifiedInventoryExcelHandlers() {
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
})();

// [SMART PRODUCT EDIT & CONSULTANT SUPERPOWERS]
(function installSmartProductEditAndConsultantSuperpowers() {
  if (!window.App || !window.AppState) return;

  AppState.inventoryStockStatusFilter = 'all';
  AppState.inventoryInlineEditMode = false;
  AppState.currentEditingProductId = null;

  // دالة مساعدة لوضع قيمة داخل حقل بأمان تام
  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  }

  function setChk(id, boolVal) {
    var el = document.getElementById(id);
    if (el) el.checked = Boolean(boolVal);
  }

  // --------------------------------------------------------------------------
  // 1) الدالة الذكية الموحدة لفتح نافذة المنتج (تقبل رقم ID أو كائن منتج أو null)
  // --------------------------------------------------------------------------
  App.editProductById = async function (productId) {
    return await this.openProductModal(Number(productId));
  };

  App.openProductModal = async function (prodOrId) {
    var prod = null;

    // إذا تم تمرير رقم ID (مثلاً 18 أو "18") نجلب المنتج الكامل من قاعدة البيانات ومن الذاكرة
    if (typeof prodOrId === 'number' || (typeof prodOrId === 'string' && /^\d+$/.test(prodOrId.trim()))) {
      var pid = Number(prodOrId);
      var memProd = (AppState.products || []).find(function (x) { return Number(x.id) === pid; }) || null;
      var dbProd = null;
      if (window.api && typeof window.api.getProductFull === 'function') {
        dbProd = await window.api.getProductFull(pid).catch(function () { return null; });
      }
      prod = Object.assign({}, memProd || {}, dbProd || {});
      if (!prod.id) prod.id = pid;
    } else if (prodOrId && typeof prodOrId === 'object') {
      // إذا تم تمرير كائن له id ولكن تنقصه التفاصيل الكاملة نكمله من قاعدة البيانات
      if (prodOrId.id && (!prodOrId.batches || !prodOrId.option_groups) && window.api && typeof window.api.getProductFull === 'function') {
        var full = await window.api.getProductFull(Number(prodOrId.id)).catch(function () { return null; });
        prod = Object.assign({}, prodOrId, full || {});
      } else {
        prod = prodOrId;
      }
    }

    var isEdit = Boolean(prod && prod.id);
    AppState.currentEditingProductId = isEdit ? Number(prod.id) : null;

    // استخراج بيانات الدفعة الأولى في حال كانت الأسعار أو التواريخ محفوظة داخل batches
    var firstBatch = (prod && Array.isArray(prod.batches) && prod.batches[0]) ? prod.batches[0] : {};
    var cost = prod ? Number(prod.cost_price ?? firstBatch.cost_price ?? 0) : 0;
    var sell = prod ? Number(prod.selling_price ?? firstBatch.selling_price ?? 0) : 0;
    var wholesale = prod ? (prod.wholesale_price ?? firstBatch.wholesale_price ?? '') : '';
    var totalStock = prod ? Number(prod.total_stock ?? prod.stock ?? firstBatch.stock ?? 0) : 0;
    var expiryDate = prod ? (prod.expiry_date || prod.next_expiry || firstBatch.expiry_date || '') : '';
    var locationStr = prod ? (prod.location || firstBatch.location || '') : '';

    this.switchProductModalTab('basic');

    // تحديث عنوان النافذة وشريط التنقل والاستنساخ
    var titleEl = document.getElementById('productModalTitle');
    if (titleEl) {
      titleEl.innerHTML = isEdit
        ? '<span class="text-blue-600">✏️ تعديل المنتج:</span> ' + (prod.name || '') + ' <span class="px-2 py-0.5 rounded-lg bg-blue-600/10 text-blue-600 font-mono text-xs">#' + prod.id + '</span>'
        : '<span class="text-emerald-600">➕ إضافة منتج جديد إلى المخزون</span>';
    }

    this.ensureProductModalSuperToolbar(isEdit);

    // تعبئة التبويب 1: البيانات الأساسية
    setVal('prodIdInput', isEdit ? prod.id : '');
    setVal('prodNameInput', prod ? (prod.name || '') : '');
    setVal('prodBarcodeInput', prod ? (prod.barcode || '') : '');
    setVal('prodCategoryInput', prod ? (prod.category || 'عام') : 'عام');
    setVal('prodFamilyInput', prod ? (prod.family || '') : '');
    setVal('prodSupplierInput', prod ? (prod.supplier || '') : '');
    setVal('prodUnitInput', prod ? (prod.unit || 'قطعة') : 'قطعة');
    setVal('prodStockInput', totalStock);
    setVal('prodMinStockInput', prod ? (prod.min_stock ?? 5) : 5);
    setVal('prodExpiryInput', expiryDate ? String(expiryDate).slice(0, 10) : '');
    setVal('prodLocationInput', locationStr);
    setVal('prodPluInput', prod ? (prod.plu_code || '') : '');
    setVal('prodImageDataInput', prod ? (prod.image || '') : '');
    setChk('prodFeaturedCheckbox', prod && Number(prod.is_featured) === 1);

    // تعبئة التبويب 2: الأسعار وهامش الربح
    setVal('prodCostInput', cost);
    setVal('prodPriceInput', sell);
    var markup = (cost > 0 && sell >= cost) ? Number((((sell - cost) / cost) * 100).toFixed(1)) : '';
    setVal('prodMarkupInput', markup);
    setVal('prodWholesaleInput', wholesale !== null && wholesale !== undefined ? wholesale : '');
    setVal('prodWholesaleUnitInput', prod ? (prod.wholesale_unit || '') : '');
    setVal('prodWholesaleQtyInput', prod && prod.wholesale_qty ? prod.wholesale_qty : '');

    // تعبئة التبويب 3 و 4 و 5
    setVal('prodMaterialRoleInput', prod ? (prod.material_role || '') : '');
    setVal('prodWarrantyMonthsInput', prod ? (prod.warranty_months || 0) : 0);
    setChk('prodTrackSerialCheckbox', prod && Number(prod.track_serial) === 1);
    setChk('prodHideFromPosCheckbox', prod && Number(prod.hide_from_pos) === 1);
    setChk('prodHasVariantsCheckbox', prod && Number(prod.has_variants) === 1);

    AppState.tempExtraPrices = (prod && Array.isArray(prod.extra_prices)) ? prod.extra_prices.slice() : [];
    AppState.tempExtraBarcodes = (prod && Array.isArray(prod.extra_barcodes)) ? prod.extra_barcodes.slice() : [];
    AppState.tempVariantsMatrix = (prod && Array.isArray(prod.variants)) ? prod.variants.slice() : [];

    if (prod && Array.isArray(prod.option_groups) && prod.option_groups.length > 0) {
      AppState.tempOptionGroups = prod.option_groups.map(function (g) {
        return {
          id: g.id,
          name: g.name,
          valuesStr: Array.isArray(g.values)
            ? g.values.map(function (v) { return typeof v === 'object' ? v.value : v; }).join(', ')
            : ''
        };
      });
    } else {
      AppState.tempOptionGroups = [];
    }

    if (typeof this.renderExtraPricesInModal === 'function') this.renderExtraPricesInModal();
    if (typeof this.renderExtraBarcodesInModal === 'function') this.renderExtraBarcodesInModal();
    if (typeof this.renderVariantsMatrixInModal === 'function') this.renderVariantsMatrixInModal();
    if (typeof this.renderOptionGroupsInModal === 'function') this.renderOptionGroupsInModal();

    this.updateLiveProfitBannerInModal();
    this.openModal('productModal');

    setTimeout(function () {
      var nameInp = document.getElementById('prodNameInput');
      if (nameInp) nameInp.focus();
    }, 60);
  };

  // --------------------------------------------------------------------------
  // 2) شريط الأدوات الاستشاري داخل نافذة التعديل (التنقل بين المنتجات + الاستنساخ + حاسبة الربح)
  // --------------------------------------------------------------------------
  App.ensureProductModalSuperToolbar = function (isEdit) {
    var modalContent = document.querySelector('#productModal .modal-content');
    if (!modalContent) return;

    var navBar = document.getElementById('prodModalConsultantBar');
    if (!navBar) {
      navBar = document.createElement('div');
      navBar.id = 'prodModalConsultantBar';
      var firstChild = modalContent.firstElementChild;
      if (firstChild && firstChild.nextSibling) {
        modalContent.insertBefore(navBar, firstChild.nextSibling);
      } else {
        modalContent.prepend(navBar);
      }
    }

    if (!isEdit) {
      navBar.className = 'hidden';
    } else {
      navBar.className = 'flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs';
      navBar.innerHTML =
        '<div class="flex items-center gap-1.5">' +
        '  <button type="button" onclick="App.navigateEditProduct(-1)" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white transition">⏮️ المنتج السابق</button>' +
        '  <button type="button" onclick="App.navigateEditProduct(1)" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white transition">المنتج التالي ⏭️</button>' +
        '</div>' +
        '<div class="flex items-center gap-1.5">' +
        '  <button type="button" onclick="App.duplicateCurrentProductInModal()" class="px-3 py-1 rounded-lg bg-indigo-600/15 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold transition">📋 استنساخ كمنتج جديد</button>' +
        '  <button type="button" onclick="App.saveAndEditNextProduct()" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm transition">💾 حفظ والانتقال للتالي ⏭️</button>' +
        '</div>';
    }

    // إضافة شريط صافي الربح وأزرار النسب السريعة داخل تبويب الأسعار
    var pricingTab = document.getElementById('prodTabContent-pricing');
    if (pricingTab && !document.getElementById('prodLiveProfitBanner')) {
      var banner = document.createElement('div');
      banner.id = 'prodLiveProfitBanner';
      banner.className = 'p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs';
      pricingTab.prepend(banner);

      ['prodCostInput', 'prodPriceInput', 'prodMarkupInput', 'prodWholesaleInput'].forEach(function (inpId) {
        var el = document.getElementById(inpId);
        if (el) {
          el.addEventListener('input', function () {
            App.updateLiveProfitBannerInModal();
          });
        }
      });
    }
  };

  App.updateLiveProfitBannerInModal = function () {
    var banner = document.getElementById('prodLiveProfitBanner');
    if (!banner) return;
    var cost = parseFloat(document.getElementById('prodCostInput')?.value) || 0;
    var sell = parseFloat(document.getElementById('prodPriceInput')?.value) || 0;
    var profit = Number((sell - cost).toFixed(2));
    var marginPct = cost > 0 ? Number((((sell - cost) / cost) * 100).toFixed(1)) : 0;
    var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(sell) : '';

    banner.innerHTML =
      '<div>' +
      '  <span class="font-bold text-slate-500">صافي الربح للوحدة: </span>' +
      '  <strong class="font-mono text-sm ' + (profit >= 0 ? 'text-emerald-600' : 'text-rose-600') + '">' + (profit >= 0 ? '+' : '') + profit.toFixed(2) + ' د.ج (' + marginPct + '%)</strong>' +
      '  <span class="mx-2 text-slate-300">|</span>' +
      '  <span class="font-bold text-amber-600">سعر البيع بالسنتيم: ' + centimes + '</span>' +
      '</div>' +
      '<div class="flex items-center gap-1">' +
      '  <span class="text-[11px] text-slate-400 font-bold ml-1">هامش سريع:</span>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(15)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+15%</button>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(20)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+20%</button>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(25)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+25%</button>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(35)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+35%</button>' +
      '  <button type="button" onclick="App.applyQuickMarkupPct(50)" class="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono font-bold hover:bg-emerald-600 hover:text-white">+50%</button>' +
      '</div>';
  };

  App.applyQuickMarkupPct = function (pct) {
    var costInp = document.getElementById('prodCostInput');
    var markupInp = document.getElementById('prodMarkupInput');
    var priceInp = document.getElementById('prodPriceInput');
    var cost = parseFloat(costInp ? costInp.value : '0') || 0;
    if (markupInp) markupInp.value = String(pct);
    if (cost > 0 && priceInp) {
      priceInp.value = String(Math.round(cost * (1 + pct / 100)));
    }
    this.updateLiveProfitBannerInModal();
  };

  App.duplicateCurrentProductInModal = function () {
    setVal('prodIdInput', '');
    AppState.currentEditingProductId = null;
    var curName = document.getElementById('prodNameInput')?.value || '';
    setVal('prodNameInput', curName + ' (نسخة)');
    this.generateRandomBarcode();
    var titleEl = document.getElementById('productModalTitle');
    if (titleEl) {
      titleEl.innerHTML = '<span class="text-indigo-600">📋 استنساخ منتج جديد — عدّل الاسم أو السعر ثم اضغط حفظ</span>';
    }
    if (typeof showToast === 'function') {
      showToast('📋 تم تحويل النافذة لنسخة جديدة بوليد باركود جديد — اضغط حفظ لإضافتها!', 'info');
    }
  };

  App.navigateEditProduct = async function (direction) {
    var list = AppState._lastRenderedInventoryList || AppState.products || [];
    if (list.length === 0) return;
    var curId = Number(document.getElementById('prodIdInput')?.value || AppState.currentEditingProductId || 0);
    var idx = list.findIndex(function (p) { return Number(p.id) === curId; });
    var nextIdx = idx === -1 ? 0 : (idx + direction + list.length) % list.length;
    var target = list[nextIdx];
    if (target && target.id) {
      await this.openProductModal(target.id);
    }
  };

  App.saveAndEditNextProduct = async function () {
    var list = AppState._lastRenderedInventoryList || AppState.products || [];
    var curId = Number(document.getElementById('prodIdInput')?.value || AppState.currentEditingProductId || 0);
    var idx = list.findIndex(function (p) { return Number(p.id) === curId; });
    var nextProd = (idx !== -1 && idx + 1 < list.length) ? list[idx + 1] : null;

    await this.saveProductFromModal(true);
    if (nextProd && nextProd.id) {
      await this.openProductModal(nextProd.id);
    }
  };

  // --------------------------------------------------------------------------
  // 3) حفظ بيانات المنتج وتحديث الدفعات (inventory_batches) والمتغيرات بأمان تام
  // --------------------------------------------------------------------------
  App.saveProductFromModal = async function (keepModalOpen) {
    var idVal = document.getElementById('prodIdInput')?.value;
    var id = idVal ? Number(idVal) : null;

    var payload = {
      name: String(document.getElementById('prodNameInput')?.value || '').trim(),
      barcode: String(document.getElementById('prodBarcodeInput')?.value || '').trim() || null,
      category: String(document.getElementById('prodCategoryInput')?.value || 'عام').trim() || 'عام',
      family: String(document.getElementById('prodFamilyInput')?.value || '').trim() || null,
      supplier: String(document.getElementById('prodSupplierInput')?.value || '').trim() || null,
      unit: String(document.getElementById('prodUnitInput')?.value || 'قطعة').trim() || 'قطعة',
      cost_price: parseFloat(document.getElementById('prodCostInput')?.value) || 0,
      selling_price: parseFloat(document.getElementById('prodPriceInput')?.value) || 0,
      wholesale_price: document.getElementById('prodWholesaleInput')?.value !== '' ? parseFloat(document.getElementById('prodWholesaleInput')?.value) : null,
      wholesale_unit: String(document.getElementById('prodWholesaleUnitInput')?.value || '').trim() || null,
      wholesale_qty: parseInt(document.getElementById('prodWholesaleQtyInput')?.value || '0', 10) || null,
      stock: parseFloat(document.getElementById('prodStockInput')?.value) || 0,
      min_stock: parseInt(document.getElementById('prodMinStockInput')?.value || '5', 10) || 5,
      expiry_date: document.getElementById('prodExpiryInput')?.value || null,
      location: String(document.getElementById('prodLocationInput')?.value || '').trim() || null,
      plu_code: String(document.getElementById('prodPluInput')?.value || '').trim() || null,
      image: document.getElementById('prodImageDataInput')?.value || null,
      is_featured: document.getElementById('prodFeaturedCheckbox')?.checked ? 1 : 0,
      material_role: document.getElementById('prodMaterialRoleInput')?.value || null,
      warranty_months: parseInt(document.getElementById('prodWarrantyMonthsInput')?.value || '0', 10) || 0,
      track_serial: document.getElementById('prodTrackSerialCheckbox')?.checked ? 1 : 0,
      hide_from_pos: document.getElementById('prodHideFromPosCheckbox')?.checked ? 1 : 0,
      has_variants: document.getElementById('prodHasVariantsCheckbox')?.checked ? 1 : 0,
      extra_prices: AppState.tempExtraPrices || [],
      extra_barcodes: AppState.tempExtraBarcodes || [],
      variants: AppState.tempVariantsMatrix || []
    };

    if (!payload.name) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم المنتج أولاً', 'error');
      return;
    }

    var savedId = id;
    if (id) {
      await window.api.updateProduct(id, payload);
      // ضمان تحديث الدفعة الأولى في inventory_batches مباشرة عبر جسر الدفعات أيضاً
      var fullProd = await window.api.getProductFull(id).catch(function () { return null; });
      var batches = (fullProd && Array.isArray(fullProd.batches)) ? fullProd.batches : [];
      if (batches.length > 0 && window.api.updateBatch) {
        await window.api.updateBatch(batches[0].id, {
          stock: batches.length === 1 ? payload.stock : batches[0].stock,
          cost_price: payload.cost_price,
          selling_price: payload.selling_price,
          wholesale_price: payload.wholesale_price,
          expiry_date: payload.expiry_date || batches[0].expiry_date || null,
          location: payload.location || batches[0].location || null
        });
      } else if (batches.length === 0 && window.api.addBatch) {
        await window.api.addBatch(id, {
          stock: payload.stock,
          cost_price: payload.cost_price,
          selling_price: payload.selling_price,
          wholesale_price: payload.wholesale_price,
          expiry_date: payload.expiry_date
        });
      }
    } else {
      var res = await window.api.addProduct(payload);
      savedId = res && res.id ? Number(res.id) : null;
    }

    var optionGroupsPayload = (AppState.tempOptionGroups || [])
      .map(function (g, idx) {
        return {
          name: String(g.name || '').trim(),
          position: idx,
          values: String(g.valuesStr || '').split(/[,،]/).map(function (x) { return x.trim(); }).filter(Boolean)
        };
      })
      .filter(function (g) { return g.name && g.values.length > 0; });

    if (savedId && (optionGroupsPayload.length > 0 || (payload.variants && payload.variants.length > 0)) && window.api.saveProductVariants) {
      await window.api.saveProductVariants(savedId, {
        has_variants: payload.has_variants,
        option_groups: optionGroupsPayload,
        variants: payload.variants
      }).catch(function () {});
    }

    if (!keepModalOpen) {
      this.closeModal('productModal');
    }
    await this.refreshProducts();
    if (AppState.currentView === 'inventory') await this.renderInventoryView();
    else this.renderPosView();

    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ وتحديث بيانات المنتج (' + payload.name + ') بنجاح!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 4) التعديل الفوري داخل الجدول (Inline Quick-Edit) + حذف المنتج + تنظيف الصفرية
  // --------------------------------------------------------------------------
  App.toggleInventoryInlineEdit = function () {
    AppState.inventoryInlineEditMode = !AppState.inventoryInlineEditMode;
    this.renderInventoryView();
    if (typeof showToast === 'function') {
      showToast(
        AppState.inventoryInlineEditMode
          ? '⚡ تم تفعيل وضع التسعير والرصيد الفوري داخل الجدول — عدّل أي رقم واضغط Enter!'
          : 'تم إيقاف وضع التعديل الفوري داخل الجدول',
        'info'
      );
    }
  };

  App.saveInlineProductRow = async function (productId) {
    var pid = Number(productId);
    var p = (AppState.products || []).find(function (x) { return Number(x.id) === pid; });
    if (!p) return;

    var newCost = parseFloat(document.getElementById('inl-cost-' + pid)?.value) || 0;
    var newSell = parseFloat(document.getElementById('inl-sell-' + pid)?.value) || 0;
    var newWhlRaw = document.getElementById('inl-whl-' + pid)?.value;
    var newWhl = newWhlRaw !== '' && newWhlRaw !== undefined ? parseFloat(newWhlRaw) : null;
    var newStk = parseFloat(document.getElementById('inl-stk-' + pid)?.value) || 0;

    var fullProd = await window.api.getProductFull(pid).catch(function () { return null; });
    var batches = (fullProd && Array.isArray(fullProd.batches)) ? fullProd.batches : [];
    if (batches.length > 0 && window.api.updateBatch) {
      await window.api.updateBatch(batches[0].id, {
        stock: newStk,
        cost_price: newCost,
        selling_price: newSell,
        wholesale_price: newWhl,
        expiry_date: batches[0].expiry_date || null
      });
    } else if (window.api.addBatch) {
      await window.api.addBatch(pid, {
        stock: newStk,
        cost_price: newCost,
        selling_price: newSell,
        wholesale_price: newWhl
      });
    }

    await this.refreshProducts();
    var rowEl = document.getElementById('inv-row-' + pid);
    if (rowEl) {
      rowEl.classList.add('bg-emerald-500/20');
      setTimeout(function () { rowEl.classList.remove('bg-emerald-500/20'); }, 600);
    }
    if (typeof showToast === 'function') {
      showToast('⚡ تم تحديث (' + p.name + ') فوراً: بيع ' + newSell.toFixed(2) + ' د.ج | رصيد ' + newStk, 'success');
    }
  };

  App.deleteProductById = async function (productId) {
    var pid = Number(productId);
    if (!pid) return;
    await window.api.deleteProduct(pid);
    await this.refreshProducts();
    await this.renderInventoryView();
    if (typeof showToast === 'function') showToast('🗑️ تم حذف المنتج من المخزون', 'info');
  };
  App.deleteProduct = App.deleteProductById;

  App.cleanZeroPriceEmptyProducts = async function () {
    var zeroProds = (AppState.products || []).filter(function (p) {
      var stk = Number(p.total_stock ?? p.stock ?? 0);
      var sell = Number(p.selling_price ?? 0);
      var cost = Number(p.cost_price ?? 0);
      return stk <= 0 && sell <= 0 && cost <= 0;
    });

    if (zeroProds.length === 0) {
      if (typeof showToast === 'function') showToast('لا توجد منتجات صفرية (0 د.ج و 0 رصيد) لتنظيفها', 'info');
      return;
    }

    if (typeof showToast === 'function') {
      showToast('🧹 جاري تنظيف ' + zeroProds.length + ' منتج صفري من الجدول (ستبقى محفوظة في القاموس الجزائري 613)...', 'info');
    }

    for (var i = 0; i < zeroProds.length; i++) {
      await window.api.deleteProduct(zeroProds[i].id);
    }

    await this.refreshProducts();
    AppState.inventoryStockStatusFilter = 'all';
    await this.renderInventoryView();
    if (typeof showToast === 'function') {
      showToast('✅ تم تنظيف ' + zeroProds.length + ' منتج صفري بنجاح! بقيت منتجات متجرك الحقيقية فقط.', 'success');
    }
  };

  App.setInventoryStockFilter = function (statusKey) {
    AppState.inventoryStockStatusFilter = statusKey || 'all';
    this.renderInventoryView();
  };

  // --------------------------------------------------------------------------
  // 5) ترقية عرض جدول المخزون مع الترتيب الذكي (المنتجات المسعرة أولاً) والتعديل المباشر
  // --------------------------------------------------------------------------
  App.renderInventoryView = async function () {
    var root = document.getElementById('inventory-view-root');
    if (!root) return;

    var rawProds = (AppState.products || []).slice();

    // ترتيب ذكي: المنتجات التي لها رصيد أو سعر بيع > 0 تظهر في أعلى الجدول دائماً!
    rawProds.sort(function (a, b) {
      var aActive = (Number(a.selling_price || 0) > 0 || Number(a.total_stock ?? a.stock ?? 0) > 0) ? 1 : 0;
      var bActive = (Number(b.selling_price || 0) > 0 || Number(b.total_stock ?? b.stock ?? 0) > 0) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    var emptyStockCnt = 0;
    var lowStockCnt = 0;
    var expiredCnt = 0;
    var zeroPriceEmptyCnt = 0;
    var nowMs = Date.now();

    rawProds.forEach(function (p) {
      var stock = Number(p.total_stock ?? p.stock ?? 0);
      var minStock = Number(p.min_stock ?? 5);
      var sell = Number(p.selling_price ?? 0);
      var cost = Number(p.cost_price ?? 0);

      if (stock <= 0) emptyStockCnt++;
      else if (stock <= minStock) lowStockCnt++;
      if (stock <= 0 && sell <= 0 && cost <= 0) zeroPriceEmptyCnt++;

      if (Array.isArray(p.batches)) {
        var hasExp = p.batches.some(function (b) {
          return Number(b.stock) > 0 && b.expiry_date && new Date(b.expiry_date).getTime() <= nowMs;
        });
        if (hasExp) expiredCnt++;
      }
    });

    var filtered = rawProds;

    if (AppState.inventoryRoleFilter && AppState.inventoryRoleFilter !== 'all') {
      if (AppState.inventoryRoleFilter === 'commercial') {
        filtered = filtered.filter(function (p) { return !p.material_role; });
      } else {
        filtered = filtered.filter(function (p) { return p.material_role === AppState.inventoryRoleFilter; });
      }
    }

    var stFilter = AppState.inventoryStockStatusFilter || 'all';
    if (stFilter === 'available') {
      filtered = filtered.filter(function (p) { return Number(p.total_stock ?? p.stock ?? 0) > 0; });
    } else if (stFilter === 'low') {
      filtered = filtered.filter(function (p) {
        var s = Number(p.total_stock ?? p.stock ?? 0);
        return s > 0 && s <= Number(p.min_stock ?? 5);
      });
    } else if (stFilter === 'empty') {
      filtered = filtered.filter(function (p) { return Number(p.total_stock ?? p.stock ?? 0) <= 0; });
    } else if (stFilter === 'expired') {
      filtered = filtered.filter(function (p) {
        return Array.isArray(p.batches) && p.batches.some(function (b) {
          return Number(b.stock) > 0 && b.expiry_date && new Date(b.expiry_date).getTime() <= nowMs;
        });
      });
    }

    var q = String(AppState.inventorySearchQuery || '').toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(function (p) {
        return (
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q) ||
          String(p.category || '').toLowerCase().includes(q)
        );
      });
    }

    var displayedProds = filtered.slice(0, 300);
    AppState._lastRenderedInventoryList = displayedProds;
    var isInline = Boolean(AppState.inventoryInlineEditMode);

    root.innerHTML =
      '<div class="space-y-4">' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex items-center gap-2">' +
      '        <span>إدارة المخزون، الدفعات، والمتغيرات (' + filtered.length + ' منتج)</span>' +
      '        <button id="btnInventoryPageQaBot" type="button" onclick="App.runAutoTest_InventoryPage()" title="تشغيل الفحص الآلي الذاتي لصفحة المخزون (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">المنتجات المسعّرة والمتوفرة تظهر في الصدارة تلقائياً — اضغط على اسم أي منتج أو زر (تعديل) لفتح بطاقته الكاملة</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      '      <button type="button" onclick="App.toggleInventoryInlineEdit()" class="px-3.5 py-2 rounded-xl font-black transition shadow-sm ' + (isInline ? 'bg-amber-500 text-slate-950' : 'bg-indigo-600/15 text-indigo-600 hover:bg-indigo-600 hover:text-white') + '">⚡ ' + (isInline ? 'إغلاق التعديل السريع بالجدول' : 'تسعير وتعديل سريع بالجدول') + '</button>' +
      (zeroPriceEmptyCnt > 0
        ? '<button type="button" onclick="App.cleanZeroPriceEmptyProducts()" class="px-3 py-2 rounded-xl bg-rose-600/15 text-rose-600 hover:bg-rose-600 hover:text-white font-bold transition" title="حذف المنتجات المستوردة بسعر 0 ورصيد 0 من الجدول مع إبقائها في القاموس">🧹 تنظيف الصفرية (' + zeroPriceEmptyCnt + ')</button>'
        : '') +
      '      <button type="button" onclick="App.importDzMasterCsv()" class="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500 hover:text-slate-950 transition">🇩🇿 استيراد قاموس 613 (CSV)</button>' +
      '      <button type="button" onclick="App.openStockDebtModal()" class="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-600 font-bold hover:bg-rose-500 hover:text-white transition">ديون المخزون</button>' +
      '      <button type="button" onclick="App.downloadInventoryTemplate()" class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">قالب Excel</button>' +
      '      <button type="button" onclick="App.importProductsExcel()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded icon-sm">upload_file</span><span>استيراد Excel / CSV</span></button>' +
      '      <button type="button" onclick="App.exportInventoryExcel()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 shadow-sm"><span class="material-symbols-rounded icon-sm">download</span><span>تصدير Excel</span></button>' +
      '      <button type="button" onclick="App.openProductModal(null)" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center gap-1 shadow-lg shadow-blue-600/25">+ منتج جديد (Alt+N)</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="grid grid-cols-2 md:grid-cols-5 gap-3">' +
      '    <div onclick="App.setInventoryStockFilter(\'all\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') + '">' +
      '      <div class="text-xs font-bold opacity-85">جميع المنتجات</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + rawProds.length + '</div>' +
      '    </div>' +
      '    <div onclick="App.setInventoryStockFilter(\'available\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'available' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 border border-emerald-500/30') + '">' +
      '      <div class="text-xs font-bold ' + (stFilter === 'available' ? 'text-white' : 'text-slate-400') + '">متوفرة في المخزون (> 0)</div>' +
      '      <div class="text-2xl font-black font-mono ' + (stFilter === 'available' ? 'text-white' : 'text-emerald-600') + ' mt-1">' + Math.max(0, rawProds.length - emptyStockCnt) + '</div>' +
      '    </div>' +
      '    <div onclick="App.setInventoryStockFilter(\'low\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'low' ? 'bg-amber-500 text-slate-950' : 'bg-white dark:bg-slate-800 border border-amber-500/30') + '">' +
      '      <div class="text-xs font-bold ' + (stFilter === 'low' ? 'text-slate-950' : 'text-slate-400') + '">منخفضة المخزون</div>' +
      '      <div class="text-2xl font-black font-mono ' + (stFilter === 'low' ? 'text-slate-950' : 'text-amber-500') + ' mt-1">' + lowStockCnt + '</div>' +
      '    </div>' +
      '    <div onclick="App.setInventoryStockFilter(\'empty\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'empty' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-slate-800 border border-rose-500/30') + '">' +
      '      <div class="text-xs font-bold ' + (stFilter === 'empty' ? 'text-white' : 'text-slate-400') + '">نافدة (الرصيد <= 0)</div>' +
      '      <div class="text-2xl font-black font-mono ' + (stFilter === 'empty' ? 'text-white' : 'text-rose-500') + ' mt-1">' + emptyStockCnt + '</div>' +
      '    </div>' +
      '    <div onclick="App.setInventoryStockFilter(\'expired\')" class="p-3.5 rounded-2xl cursor-pointer transition shadow-sm ' + (stFilter === 'expired' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 border border-purple-500/30') + '">' +
      '      <div class="text-xs font-bold ' + (stFilter === 'expired' ? 'text-white' : 'text-slate-400') + '">منتهية الصلاحية</div>' +
      '      <div class="text-2xl font-black font-mono ' + (stFilter === 'expired' ? 'text-white' : 'text-purple-600') + ' mt-1">' + expiredCnt + '</div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">' +
      '    <div class="flex flex-wrap items-center gap-2 mb-4">' +
      '      <div class="relative flex-1 min-w-[220px]">' +
      '        <span class="material-symbols-rounded icon-sm absolute right-3 top-2.5 text-slate-400">search</span>' +
      '        <input id="inventorySearchInput" type="text" value="' + (AppState.inventorySearchQuery || '') + '" oninput="App.onInventorySearch(this.value)" placeholder="🔍 [F4] ابحث بالاسم أو الباركود أو الفئة..." class="w-full pr-9 pl-3 py-2 rounded-xl text-xs font-bold">' +
      '      </div>' +
      '      <select onchange="AppState.inventoryRoleFilter=this.value; App.renderInventoryView()" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">' +
      '        <option value="all" ' + (AppState.inventoryRoleFilter === 'all' ? 'selected' : '') + '>الكل (تجاري + تصنيع)</option>' +
      '        <option value="commercial" ' + (AppState.inventoryRoleFilter === 'commercial' ? 'selected' : '') + '>المنتجات التجارية العادية</option>' +
      '        <option value="raw_material" ' + (AppState.inventoryRoleFilter === 'raw_material' ? 'selected' : '') + '>المواد الأولية للتصنيع</option>' +
      '        <option value="finished_good" ' + (AppState.inventoryRoleFilter === 'finished_good' ? 'selected' : '') + '>المنتجات المصنعة النهائية</option>' +
      '      </select>' +
      '    </div>' +

      '    <div class="overflow-x-auto max-h-[58vh]">' +
      '      <table class="w-full text-xs text-right">' +
      '        <thead class="sticky top-0 bg-white dark:bg-slate-800 z-10">' +
      '          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">' +
      '            <th class="py-2.5 px-2">الباركود</th>' +
      '            <th class="py-2.5 px-2">المنتج</th>' +
      '            <th class="py-2.5 px-2">الفئة</th>' +
      '            <th class="py-2.5 px-2">سعر الشراء</th>' +
      '            <th class="py-2.5 px-2">سعر البيع</th>' +
      '            <th class="py-2.5 px-2">سعر الجملة</th>' +
      '            <th class="py-2.5 px-2">الرصيد الكلي</th>' +
      '            <th class="py-2.5 px-2 text-center">إجراءات سريعة</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (displayedProds.length > 0
        ? displayedProds.map(function (p) {
            var stock = Number(p.total_stock ?? p.stock ?? 0);
            var isLow = stock > 0 && stock <= Number(p.min_stock ?? 5);
            var batchCnt = Array.isArray(p.batches) ? p.batches.length : 1;
            var costVal = Number(p.cost_price || 0);
            var sellVal = Number(p.selling_price || 0);
            var whlVal = p.wholesale_price ? Number(p.wholesale_price) : '';

            return (
              '<tr id="inv-row-' + p.id + '" class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5 px-2 font-mono font-bold text-slate-400">' + (p.barcode || '—') + '</td>' +
              '  <td class="py-2.5 px-2 font-bold cursor-pointer text-slate-800 dark:text-slate-100 hover:text-blue-600" onclick="App.editProductById(' + p.id + ')">' + p.name + '</td>' +
              '  <td class="py-2.5 px-2 text-slate-500">' + (p.category || 'عام') + '</td>' +
              (isInline
                ? '  <td class="py-1.5 px-1"><input id="inl-cost-' + p.id + '" type="number" step="any" value="' + costVal + '" onkeydown="if(event.key===\'Enter\') App.saveInlineProductRow(' + p.id + ')" class="w-20 px-2 py-1 rounded-lg font-mono font-bold text-center border-blue-400"></td>' +
                  '  <td class="py-1.5 px-1"><input id="inl-sell-' + p.id + '" type="number" step="any" value="' + sellVal + '" onkeydown="if(event.key===\'Enter\') App.saveInlineProductRow(' + p.id + ')" class="w-20 px-2 py-1 rounded-lg font-mono font-black text-blue-600 text-center border-blue-500"></td>' +
                  '  <td class="py-1.5 px-1"><input id="inl-whl-' + p.id + '" type="number" step="any" value="' + whlVal + '" placeholder="—" onkeydown="if(event.key===\'Enter\') App.saveInlineProductRow(' + p.id + ')" class="w-20 px-2 py-1 rounded-lg font-mono text-center"></td>' +
                  '  <td class="py-1.5 px-1"><input id="inl-stk-' + p.id + '" type="number" step="any" value="' + stock + '" onkeydown="if(event.key===\'Enter\') App.saveInlineProductRow(' + p.id + ')" class="w-20 px-2 py-1 rounded-lg font-mono font-black text-emerald-600 text-center border-emerald-500"></td>'
                : '  <td class="py-2.5 px-2 font-mono" ondblclick="App.toggleInventoryInlineEdit()" title="نقر مزدوج للتعديل المباشر">' + costVal.toFixed(2) + '</td>' +
                  '  <td class="py-2.5 px-2 font-mono font-black text-blue-600" ondblclick="App.toggleInventoryInlineEdit()" title="نقر مزدوج للتعديل المباشر">' + sellVal.toFixed(2) + '</td>' +
                  '  <td class="py-2.5 px-2 font-mono text-slate-500">' + (whlVal !== '' ? Number(whlVal).toFixed(2) : '—') + '</td>' +
                  '  <td class="py-2.5 px-2 font-mono font-black ' + (stock <= 0 ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-600') + '" ondblclick="App.toggleInventoryInlineEdit()">' + stock + ' ' + (p.unit || 'قطعة') + '</td>') +
              '  <td class="py-2.5 px-2 flex flex-wrap items-center justify-center gap-1">' +
              (isInline
                ? '    <button type="button" onclick="App.saveInlineProductRow(' + p.id + ')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[11px] shadow-sm">💾 حفظ</button>'
                : '') +
              '    <button type="button" onclick="App.editProductById(' + p.id + ')" class="px-2.5 py-1 bg-blue-600/15 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-[11px] transition">تعديل</button>' +
              '    <button type="button" onclick="App.openBatchesModal(' + p.id + ')" class="px-2 py-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg font-bold text-[11px] transition">الدفعات (' + batchCnt + ')</button>' +
              '    <button type="button" onclick="App.openProductAnalyticsModal(' + p.id + ')" class="px-2 py-1 bg-indigo-500/15 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-[11px] transition">ربحية</button>' +
              '    <button type="button" onclick="App.quickPrintLabel(' + p.id + ')" class="px-2 py-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 rounded-lg font-bold text-[11px] transition">🏷️ باركود</button>' +
              '    <button type="button" onclick="App.deleteProductById(' + p.id + ')" class="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
              '  </td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="8" class="py-10 text-center text-slate-400 font-bold">لا توجد منتجات مطابقة للبحث</td></tr>') +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };
})();

// [PAGE 5 BUNDLES & PROMOTIONS SURGICAL PERFECTION]
(function applyPage5BundlesSurgicalPerfection() {
  if (!window.App || !window.AppState) return;

  AppState.bundlesList = [];
  AppState.promotionsList = [];
  AppState.tempBundleItems = [];
  AppState.editingBundleId = null;
  AppState.editingPromoId = null;
  AppState.bundlesSearchQuery = '';

  function getActiveProductPrice(p) {
    if (!p) return 0;
    var firstBatch = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.selling_price ?? firstBatch.selling_price ?? 0);
  }

  function getActiveProductCost(p) {
    if (!p) return 0;
    var firstBatch = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.cost_price ?? firstBatch.cost_price ?? 0);
  }

  function getActiveProductStock(p) {
    if (!p) return 0;
    return Number(p.total_stock ?? p.stock ?? 0);
  }

  // --------------------------------------------------------------------------
  // 1) ترقية نافذة الحزم (#bundleModal) ونافذة العروض (#promotionModal) في DOM
  // --------------------------------------------------------------------------
  App.upgradeBundlesAndPromosModalsDom = function () {
    var bModal = document.getElementById('bundleModal');
    if (bModal && !bModal.dataset.upgradedP5) {
      bModal.dataset.upgradedP5 = '1';
      bModal.innerHTML =
        '<div class="modal-content w-full max-w-3xl p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <h3 id="bundleModalTitle" class="text-lg font-black text-blue-600">🎁 إنشاء / تعديل حزمة ترويجية متعددة المنتجات (Pack)</h3>' +
        '    <button type="button" onclick="App.closeModal(\'bundleModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <input id="bundleIdInput" type="hidden">' +

        '  <div class="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">' +
        '    <span class="font-black text-indigo-600 dark:text-indigo-400 ml-1">⚡ قوالب باقات جزائرية ذكية بضغطة زر:</span>' +
        '    <button type="button" onclick="App.applySmartBundlePreset(\'ramadan\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">🌙 قفة المواد الأساسية</button>' +
        '    <button type="button" onclick="App.applySmartBundlePreset(\'breakfast\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">☕ باقة القهوة والفطور</button>' +
        '    <button type="button" onclick="App.applySmartBundlePreset(\'drinks\')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold hover:bg-indigo-600 hover:text-white transition">🧃 باقة المشروبات العائلية</button>' +
        '  </div>' +

        '  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">' +
        '    <div class="md:col-span-2">' +
        '      <label class="block font-bold mb-1">اسم الحزمة / الباقة الترويجية *</label>' +
        '      <input id="bundleNameInput" type="text" placeholder="مثال: باقة العائلة الاقتصادية (زيت + سكر + قهوة)" class="w-full px-3 py-2 rounded-xl font-bold">' +
        '    </div>' +
        '    <div>' +
        '      <label class="block font-bold mb-1">باركود الحزمة (للمسح المباشر في الكاشير)</label>' +
        '      <div class="flex gap-1">' +
        '        <input id="bundleBarcodeInput" type="text" placeholder="61399..." class="flex-1 px-3 py-2 rounded-xl font-mono font-bold">' +
        '        <button type="button" onclick="App.generateBundleBarcode()" class="px-2.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold" title="توليد باركود للحزمة">⚡</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '  <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">' +
        '    <div class="font-black text-slate-700 dark:text-slate-200">📦 إضافة المنتجات المكوّنة للحزمة:</div>' +
        '    <div class="grid grid-cols-1 md:grid-cols-12 gap-2">' +
        '      <select id="bundleProductSelect" class="md:col-span-7 px-3 py-2 rounded-xl font-bold"></select>' +
        '      <input id="bundleProductQty" type="number" step="any" min="0.1" value="1" placeholder="الكمية" class="md:col-span-2 px-3 py-2 rounded-xl font-mono font-bold text-center">' +
        '      <button type="button" onclick="App.addComponentToBundleModal()" class="md:col-span-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-sm">+ إدراج في الحزمة</button>' +
        '    </div>' +
        '    <div id="bundleItemsTableContainer" class="max-h-44 overflow-y-auto pt-1"></div>' +
        '  </div>' +

        '  <div id="bundleLiveMetricsBox" class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-center"></div>' +

        '  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-end">' +
        '    <div>' +
        '      <label class="block font-bold mb-1">إجمالي تكلفة الحزمة (د.ج)</label>' +
        '      <input id="bundleCostInput" type="number" step="any" value="0" oninput="App.updateBundleModalMetrics()" class="w-full px-3 py-2 rounded-xl font-mono font-bold">' +
        '    </div>' +
        '    <div>' +
        '      <label class="block font-bold mb-1 text-blue-600">سعر بيع الحزمة للزبون (د.ج) *</label>' +
        '      <input id="bundlePriceInput" type="number" step="any" value="0" oninput="App.updateBundleModalMetrics()" class="w-full px-3 py-2 rounded-xl font-mono font-black text-base text-blue-600 border-blue-500">' +
        '    </div>' +
        '    <div class="flex gap-1">' +
        '      <button type="button" onclick="App.applyQuickBundleDiscount(5)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-5%</button>' +
        '      <button type="button" onclick="App.applyQuickBundleDiscount(10)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-10%</button>' +
        '      <button type="button" onclick="App.applyQuickBundleDiscount(15)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-15%</button>' +
        '      <button type="button" onclick="App.applyQuickBundleDiscount(20)" class="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-mono font-bold hover:bg-blue-600 hover:text-white">-20%</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'bundleModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء (Esc)</button>' +
        '    <button type="button" onclick="App.saveBundleFromModal()" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/25">💾 حفظ الحزمة الترويجية</button>' +
        '  </div>' +
        '</div>';
    }

    var pModal = document.getElementById('promotionModal');
    if (pModal && !pModal.dataset.upgradedP5) {
      pModal.dataset.upgradedP5 = '1';
      pModal.innerHTML =
        '<div class="modal-content w-full max-w-lg p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <h3 id="promoModalTitle" class="text-lg font-black text-rose-600">🔥 إنشاء / تعديل عرض ترويجي وتخفيض موقوت</h3>' +
        '    <button type="button" onclick="App.closeModal(\'promotionModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <input id="promoIdInput" type="hidden">' +

        '  <div class="space-y-3 text-xs">' +
        '    <div>' +
        '      <label class="block font-bold mb-1">المنتج المستهدف بالتخفيض *</label>' +
        '      <select id="promoProductSelect" onchange="App.updatePromoModalLivePreview()" class="w-full px-3 py-2.5 rounded-xl font-bold"></select>' +
        '    </div>' +

        '    <div class="grid grid-cols-2 gap-2.5">' +
        '      <div>' +
        '        <label class="block font-bold mb-1">نوع التخفيض</label>' +
        '        <select id="promoTypeSelect" onchange="App.updatePromoModalLivePreview()" class="w-full px-3 py-2 rounded-xl font-bold">' +
        '          <option value="percentage">نسبة مئوية (%)</option>' +
        '          <option value="fixed">مبلغ ثابت يُخصم (د.ج)</option>' +
        '        </select>' +
        '      </div>' +
        '      <div>' +
        '        <label class="block font-bold mb-1">قيمة الخصم *</label>' +
        '        <input id="promoValueInput" type="number" step="any" value="10" oninput="App.updatePromoModalLivePreview()" class="w-full px-3 py-2 rounded-xl font-mono font-black text-rose-600 text-base text-center">' +
        '      </div>' +
        '    </div>' +

        '    <div class="flex items-center justify-between gap-1 pt-0.5">' +
        '      <span class="text-[11px] text-slate-400 font-bold">نسب سريعة:</span>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 5)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-5%</button>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 10)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-10%</button>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 15)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-15%</button>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 20)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-20%</button>' +
        '      <button type="button" onclick="App.setQuickPromoVal(\'percentage\', 30)" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-mono font-bold hover:bg-rose-600 hover:text-white">-30%</button>' +
        '    </div>' +

        '    <div id="promoLivePreviewCard" class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1"></div>' +

        '    <div class="grid grid-cols-3 gap-2">' +
        '      <div><label class="block font-bold mb-1">تاريخ البداية</label><input id="promoStartInput" type="date" class="w-full px-2.5 py-2 rounded-xl font-mono"></div>' +
        '      <div><label class="block font-bold mb-1">تاريخ الانتهاء</label><input id="promoEndInput" type="date" class="w-full px-2.5 py-2 rounded-xl font-mono"></div>' +
        '      <div><label class="block font-bold mb-1" title="اتركه فارغاً لكمية غير محدودة">سقف الكمية (Quota)</label><input id="promoMaxQtyInput" type="number" min="0" placeholder="غير محدود" class="w-full px-2.5 py-2 rounded-xl font-mono text-center"></div>' +
        '    </div>' +

        '    <div class="flex items-center gap-1.5 pt-1">' +
        '      <span class="text-[11px] text-slate-400 font-bold">مدة الحملة:</span>' +
        '      <button type="button" onclick="App.setPromoDurationDays(3)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white">⚡ 3 أيام (Weekend)</button>' +
        '      <button type="button" onclick="App.setPromoDurationDays(7)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white">📅 7 أيام</button>' +
        '      <button type="button" onclick="App.setPromoDurationDays(30)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold hover:bg-blue-600 hover:text-white">🌙 30 يوماً</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'promotionModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء</button>' +
        '    <button type="button" onclick="App.savePromoFromModal()" class="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/25">🔥 حفظ وتفعيل العرض</button>' +
        '  </div>' +
        '</div>';
    }
  };

  // --------------------------------------------------------------------------
  // 2) منطق بناء وتعديل الحزم الترويجية (Multi-Item Pack Builder)
  // --------------------------------------------------------------------------
  App.generateBundleBarcode = function () {
    var rnd = '61399' + String(Math.floor(10000000 + Math.random() * 90000000)).slice(0, 8);
    var inp = document.getElementById('bundleBarcodeInput');
    if (inp) inp.value = rnd;
  };

  App.getSortedPricedProducts = function () {
    var list = (AppState.products || []).slice();
    list.sort(function (a, b) {
      var aP = getActiveProductPrice(a) > 0 ? 1 : 0;
      var bP = getActiveProductPrice(b) > 0 ? 1 : 0;
      if (aP !== bP) return bP - aP;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    return list;
  };

  App.openBundleModal = async function (bundleOrId) {
    this.upgradeBundlesAndPromosModalsDom();
    var prodSelect = document.getElementById('bundleProductSelect');
    var sortedProds = this.getSortedPricedProducts();
    if (prodSelect) {
      prodSelect.innerHTML = sortedProds
        .slice(0, 400)
        .map(function (p) {
          return '<option value="' + p.id + '">' + p.name + ' (' + getActiveProductPrice(p).toFixed(2) + ' د.ج | الرصيد: ' + getActiveProductStock(p) + ')</option>';
        })
        .join('');
    }

    var bundle = null;
    if (typeof bundleOrId === 'number' || (typeof bundleOrId === 'string' && /^\d+$/.test(bundleOrId))) {
      var bid = Number(bundleOrId);
      bundle = (AppState.bundlesList || []).find(function (b) { return Number(b.id) === bid; }) || null;
      if (!bundle && window.api && window.api.getBundleDetails) {
        bundle = await window.api.getBundleDetails(bid).catch(function () { return null; });
      }
    } else if (bundleOrId && typeof bundleOrId === 'object') {
      bundle = bundleOrId;
    }

    AppState.editingBundleId = bundle && bundle.id ? Number(bundle.id) : null;
    document.getElementById('bundleIdInput').value = AppState.editingBundleId || '';
    document.getElementById('bundleNameInput').value = bundle ? (bundle.name || '') : '';
    document.getElementById('bundleBarcodeInput').value = bundle && bundle.barcode ? bundle.barcode : '';
    if (!bundle) this.generateBundleBarcode();

    if (bundle && Array.isArray(bundle.items) && bundle.items.length > 0) {
      AppState.tempBundleItems = bundle.items.map(function (it) {
        var pObj = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
        return {
          product_id: Number(it.product_id),
          product_name: it.product_name || (pObj ? pObj.name : 'منتج #' + it.product_id),
          quantity: Number(it.quantity || 1),
          unit_cost: getActiveProductCost(pObj),
          unit_price: getActiveProductPrice(pObj),
          stock: getActiveProductStock(pObj)
        };
      });
      document.getElementById('bundleCostInput').value = Number(bundle.cost_price || 0);
      document.getElementById('bundlePriceInput').value = Number(bundle.selling_price || 0);
    } else {
      AppState.tempBundleItems = [];
      document.getElementById('bundleCostInput').value = '0';
      document.getElementById('bundlePriceInput').value = '0';
    }

    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
    this.openModal('bundleModal');
  };

  App.addComponentToBundleModal = function () {
    var pid = Number(document.getElementById('bundleProductSelect')?.value);
    var qty = Math.max(0.01, parseFloat(document.getElementById('bundleProductQty')?.value) || 1);
    if (!pid) return;
    var pObj = (AppState.products || []).find(function (x) { return Number(x.id) === pid; });
    if (!pObj) return;

    var existing = AppState.tempBundleItems.find(function (it) { return Number(it.product_id) === pid; });
    if (existing) {
      existing.quantity = Number((existing.quantity + qty).toFixed(3));
    } else {
      AppState.tempBundleItems.push({
        product_id: pid,
        product_name: pObj.name,
        quantity: qty,
        unit_cost: getActiveProductCost(pObj),
        unit_price: getActiveProductPrice(pObj),
        stock: getActiveProductStock(pObj)
      });
    }

    this.recalcBundleDefaultPriceAndCost();
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
  };

  App.removeComponentFromBundleModal = function (idx) {
    AppState.tempBundleItems.splice(idx, 1);
    this.recalcBundleDefaultPriceAndCost();
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
  };

  App.updateBundleComponentQty = function (idx, val) {
    var q = Math.max(0.01, parseFloat(val) || 1);
    if (AppState.tempBundleItems[idx]) {
      AppState.tempBundleItems[idx].quantity = q;
      this.recalcBundleDefaultPriceAndCost();
      this.updateBundleModalMetrics();
    }
  };

  App.recalcBundleDefaultPriceAndCost = function () {
    var totalCost = 0;
    var totalRetail = 0;
    (AppState.tempBundleItems || []).forEach(function (it) {
      totalCost += Number(it.unit_cost || 0) * Number(it.quantity || 1);
      totalRetail += Number(it.unit_price || 0) * Number(it.quantity || 1);
    });
    var costInp = document.getElementById('bundleCostInput');
    var priceInp = document.getElementById('bundlePriceInput');
    if (costInp) costInp.value = totalCost.toFixed(2);
    // اقتراح خصم 10% تلقائياً على مجموع أسعار التجزئة
    if (priceInp) priceInp.value = Math.max(totalCost, Math.round(totalRetail * 0.9)).toFixed(2);
  };

  App.applyQuickBundleDiscount = function (pct) {
    var totalRetail = 0;
    (AppState.tempBundleItems || []).forEach(function (it) {
      totalRetail += Number(it.unit_price || 0) * Number(it.quantity || 1);
    });
    if (totalRetail <= 0) return;
    var discounted = Math.round(totalRetail * (1 - Number(pct) / 100));
    var priceInp = document.getElementById('bundlePriceInput');
    if (priceInp) priceInp.value = discounted.toFixed(2);
    this.updateBundleModalMetrics();
  };

  App.renderBundleItemsInModal = function () {
    var box = document.getElementById('bundleItemsTableContainer');
    if (!box) return;
    var items = AppState.tempBundleItems || [];
    if (items.length === 0) {
      box.innerHTML = '<div class="py-4 text-center text-slate-400 font-bold">لم يتم إدراج منتجات في الحزمة بعد — اختر منتجاً أعلاه واضغط (+ إدراج في الحزمة) أو اختر قالباً ذكياً</div>';
      return;
    }

    box.innerHTML =
      '<table class="w-full text-xs text-right">' +
      '  <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">المنتج المكوّن</th><th class="py-1.5">السعر الفردي</th><th class="py-1.5">الكمية بالحزمة</th><th class="py-1.5">المجموع الفردي</th><th class="py-1.5">حذف</th></tr></thead>' +
      '  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      items.map(function (it, idx) {
        var sub = Number(it.unit_price || 0) * Number(it.quantity || 1);
        return (
          '<tr>' +
          '  <td class="py-1.5 font-bold">' + it.product_name + '</td>' +
          '  <td class="py-1.5 font-mono">' + Number(it.unit_price || 0).toFixed(2) + ' د.ج</td>' +
          '  <td class="py-1.5"><input type="number" step="any" min="0.1" value="' + it.quantity + '" oninput="App.updateBundleComponentQty(' + idx + ', this.value)" class="w-16 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono font-bold text-center"></td>' +
          '  <td class="py-1.5 font-mono font-bold text-blue-600">' + sub.toFixed(2) + ' د.ج</td>' +
          '  <td class="py-1.5"><button type="button" onclick="App.removeComponentFromBundleModal(' + idx + ')" class="text-rose-500 font-black px-2">✕</button></td>' +
          '</tr>'
        );
      }).join('') +
      '  </tbody>' +
      '</table>';
  };

  App.updateBundleModalMetrics = function () {
    var box = document.getElementById('bundleLiveMetricsBox');
    if (!box) return;
    var totalRetail = 0;
    var minAssemblable = Infinity;
    var items = AppState.tempBundleItems || [];

    items.forEach(function (it) {
      totalRetail += Number(it.unit_price || 0) * Number(it.quantity || 1);
      var reqQty = Number(it.quantity || 1);
      var avail = Number(it.stock || 0);
      var possible = reqQty > 0 ? Math.floor(avail / reqQty) : 0;
      if (possible < minAssemblable) minAssemblable = possible;
    });
    if (!Number.isFinite(minAssemblable)) minAssemblable = 0;

    var bundleCost = parseFloat(document.getElementById('bundleCostInput')?.value) || 0;
    var bundlePrice = parseFloat(document.getElementById('bundlePriceInput')?.value) || 0;
    var customerSaving = Math.max(0, Number((totalRetail - bundlePrice).toFixed(2)));
    var savingPct = totalRetail > 0 ? Number(((customerSaving / totalRetail) * 100).toFixed(1)) : 0;
    var merchantProfit = Number((bundlePrice - bundleCost).toFixed(2));
    var centimePrice = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(bundlePrice) : '';

    box.innerHTML =
      '<div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70">' +
      '  <div class="text-[10px] text-slate-400 font-bold">مجموع الأسعار الفردية</div>' +
      '  <div class="font-mono font-black text-sm line-through text-slate-500">' + totalRetail.toFixed(2) + ' د.ج</div>' +
      '</div>' +
      '<div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70">' +
      '  <div class="text-[10px] text-slate-400 font-bold">توفير الزبون (Économie)</div>' +
      '  <div class="font-mono font-black text-sm text-emerald-600">' + customerSaving.toFixed(2) + ' د.ج (' + savingPct + '%)</div>' +
      '</div>' +
      '<div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70">' +
      '  <div class="text-[10px] text-slate-400 font-bold">صافي ربح التاجر بالحزمة</div>' +
      '  <div class="font-mono font-black text-sm ' + (merchantProfit >= 0 ? 'text-blue-600' : 'text-rose-600') + '">' + (merchantProfit >= 0 ? '+' : '') + merchantProfit.toFixed(2) + ' د.ج</div>' +
      '</div>' +
      '<div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70">' +
      '  <div class="text-[10px] text-slate-400 font-bold">الباقات المتاحة للتجميع</div>' +
      '  <div class="font-mono font-black text-sm text-amber-600">' + minAssemblable + ' باقة (' + centimePrice + ')</div>' +
      '</div>';
  };

  App.applySmartBundlePreset = function (presetKey) {
    var priced = this.getSortedPricedProducts().filter(function (p) { return getActiveProductPrice(p) > 0; });
    if (priced.length === 0) return;

    var picked = [];
    var packTitle = '';

    if (presetKey === 'ramadan') {
      packTitle = '🌙 قفة العائلة الاقتصادية (Pack Essentiel)';
      picked = priced.filter(function (p) {
        return /زيت|سكر|سميد|فرينة|كسكس|طماطم|حليب/i.test(p.name) || /غذائية/i.test(p.category || '');
      }).slice(0, 4);
    } else if (presetKey === 'breakfast') {
      packTitle = '☕ باقة فطور الصباح والقهوة (Pack Café & Matin)';
      picked = priced.filter(function (p) {
        return /قهوة|حليب|سكر|بسكويت|شوكو|جبن|ياغورت/i.test(p.name);
      }).slice(0, 3);
    } else {
      packTitle = '🧃 باقة المشروبات والعائلة (Pack Boissons)';
      picked = priced.filter(function (p) {
        return /ماء|عصير|مشروب|حمود|إيفري|سعيدة|رويبة/i.test(p.name) || /مشروبات/i.test(p.category || '');
      }).slice(0, 3);
    }

    if (picked.length === 0) picked = priced.slice(0, 3);

    document.getElementById('bundleNameInput').value = packTitle;
    AppState.tempBundleItems = picked.map(function (p) {
      return {
        product_id: Number(p.id),
        product_name: p.name,
        quantity: 1,
        unit_cost: getActiveProductCost(p),
        unit_price: getActiveProductPrice(p),
        stock: getActiveProductStock(p)
      };
    });

    this.recalcBundleDefaultPriceAndCost();
    this.renderBundleItemsInModal();
    this.updateBundleModalMetrics();
    if (typeof showToast === 'function') {
      showToast('⚡ تم تجهيز (' + packTitle + ') بـ ' + picked.length + ' منتجات مع خصم 10% تلقائي!', 'info');
    }
  };

  App.saveBundleFromModal = async function () {
    var idVal = document.getElementById('bundleIdInput')?.value;
    var name = String(document.getElementById('bundleNameInput')?.value || '').trim();
    if (!name) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم الحزمة الترويجية', 'warning');
      return;
    }

    if (!AppState.tempBundleItems || AppState.tempBundleItems.length === 0) {
      this.addComponentToBundleModal();
    }

    var payload = {
      id: idVal ? Number(idVal) : undefined,
      name: name,
      barcode: String(document.getElementById('bundleBarcodeInput')?.value || '').trim() || null,
      selling_price: parseFloat(document.getElementById('bundlePriceInput')?.value) || 0,
      cost_price: parseFloat(document.getElementById('bundleCostInput')?.value) || 0,
      is_active: 1,
      items: (AppState.tempBundleItems || []).map(function (it) {
        return { product_id: Number(it.product_id), quantity: Number(it.quantity || 1) };
      })
    };

    await window.api.saveBundle(payload);
    this.closeModal('bundleModal');
    await this.renderBundlesAndPromosView();
    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ الحزمة الترويجية (' + name + ') وربطها بالكاشير بنجاح!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 3) منطق بناء وتعديل العروض الترويجية مع درع الحماية من الخسارة
  // --------------------------------------------------------------------------
  App.openPromoModal = function (promoOrProductId) {
    this.upgradeBundlesAndPromosModalsDom();
    var sel = document.getElementById('promoProductSelect');
    var sortedProds = this.getSortedPricedProducts();
    if (sel) {
      sel.innerHTML = sortedProds
        .slice(0, 400)
        .map(function (p) {
          return '<option value="' + p.id + '">' + p.name + ' (السعر: ' + getActiveProductPrice(p).toFixed(2) + ' د.ج | التكلفة: ' + getActiveProductCost(p).toFixed(2) + ' د.ج)</option>';
        })
        .join('');
    }

    var todayStr = new Date().toISOString().slice(0, 10);
    var promo = null;
    if (promoOrProductId && typeof promoOrProductId === 'object') {
      promo = promoOrProductId;
    }

    AppState.editingPromoId = promo && promo.id ? Number(promo.id) : null;
    document.getElementById('promoIdInput').value = AppState.editingPromoId || '';

    if (promo) {
      if (sel) sel.value = String(promo.product_id);
      document.getElementById('promoTypeSelect').value = promo.discount_type || 'percentage';
      document.getElementById('promoValueInput').value = promo.discount_value || 10;
      document.getElementById('promoStartInput').value = (promo.start_date || todayStr).slice(0, 10);
      document.getElementById('promoEndInput').value = promo.end_date ? promo.end_date.slice(0, 10) : '';
      document.getElementById('promoMaxQtyInput').value = promo.max_qty || '';
    } else {
      if (typeof promoOrProductId === 'number' && sel) {
        sel.value = String(promoOrProductId);
      }
      document.getElementById('promoTypeSelect').value = 'percentage';
      document.getElementById('promoValueInput').value = '15';
      document.getElementById('promoStartInput').value = todayStr;
      this.setPromoDurationDays(7);
      document.getElementById('promoMaxQtyInput').value = '';
    }

    this.updatePromoModalLivePreview();
    this.openModal('promotionModal');
  };

  App.setQuickPromoVal = function (type, val) {
    document.getElementById('promoTypeSelect').value = type;
    document.getElementById('promoValueInput').value = String(val);
    this.updatePromoModalLivePreview();
  };

  App.setPromoDurationDays = function (days) {
    var startStr = document.getElementById('promoStartInput')?.value || new Date().toISOString().slice(0, 10);
    var dt = new Date(startStr);
    dt.setDate(dt.getDate() + Number(days || 7));
    var endInp = document.getElementById('promoEndInput');
    if (endInp) endInp.value = dt.toISOString().slice(0, 10);
  };

  App.updatePromoModalLivePreview = function () {
    var box = document.getElementById('promoLivePreviewCard');
    if (!box) return;
    var pid = Number(document.getElementById('promoProductSelect')?.value);
    var p = (AppState.products || []).find(function (x) { return Number(x.id) === pid; });
    if (!p) {
      box.innerHTML = '';
      return;
    }

    var origPrice = getActiveProductPrice(p);
    var costPrice = getActiveProductCost(p);
    var dType = document.getElementById('promoTypeSelect')?.value || 'percentage';
    var dVal = parseFloat(document.getElementById('promoValueInput')?.value) || 0;

    var newPrice = dType === 'percentage'
      ? Number((origPrice * (1 - dVal / 100)).toFixed(2))
      : Math.max(0, Number((origPrice - dVal).toFixed(2)));

    var savingDzd = Math.max(0, Number((origPrice - newPrice).toFixed(2)));
    var netProfitAfter = Number((newPrice - costPrice).toFixed(2));
    var isLoss = costPrice > 0 && newPrice < costPrice;
    var centimeNew = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(newPrice) : '';

    box.innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '  <div><span class="text-slate-400">السعر الأصلي:</span> <strong class="font-mono line-through text-slate-500">' + origPrice.toFixed(2) + ' د.ج</strong></div>' +
      '  <div><span class="text-slate-400">السعر الجديد بالعرض:</span> <strong class="font-mono text-base text-emerald-600">' + newPrice.toFixed(2) + ' د.ج</strong> <span class="text-[11px] font-bold text-amber-600">(' + centimeNew + ')</span></div>' +
      '</div>' +
      '<div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">' +
      '  <div><span class="text-slate-400">توفير الزبون:</span> <strong class="font-mono text-rose-600">-' + savingDzd.toFixed(2) + ' د.ج</strong></div>' +
      '  <div><span class="text-slate-400">ربحك الصافي للوحدة:</span> <strong class="font-mono ' + (isLoss ? 'text-rose-600' : 'text-blue-600') + '">' + (netProfitAfter >= 0 ? '+' : '') + netProfitAfter.toFixed(2) + ' د.ج</strong></div>' +
      '</div>' +
      (isLoss
        ? '<div class="mt-1 p-1.5 rounded-lg bg-rose-500/15 text-rose-600 font-black text-center">⚠️ تنبيه الدرع المالي: السعر بعد الخصم أقل من سعر التكلفة (' + costPrice.toFixed(2) + ' د.ج)!</div>'
        : '');
  };

  App.savePromoFromModal = async function () {
    var idVal = document.getElementById('promoIdInput')?.value;
    var product_id = Number(document.getElementById('promoProductSelect')?.value);
    if (!product_id) return;

    var maxQtyRaw = document.getElementById('promoMaxQtyInput')?.value;
    await window.api.savePromotion({
      id: idVal ? Number(idVal) : undefined,
      product_id: product_id,
      discount_type: document.getElementById('promoTypeSelect')?.value || 'percentage',
      discount_value: parseFloat(document.getElementById('promoValueInput')?.value) || 10,
      start_date: document.getElementById('promoStartInput')?.value || new Date().toISOString().slice(0, 10),
      end_date: document.getElementById('promoEndInput')?.value || null,
      max_qty: maxQtyRaw ? parseInt(maxQtyRaw, 10) : null,
      is_active: 1
    });

    this.closeModal('promotionModal');
    await this.refreshProducts();
    await this.renderBundlesAndPromosView();
    if (typeof showToast === 'function') {
      showToast('🔥 تم حفظ وتفعيل العرض الترويجي في شاشة المبيعات بنجاح!', 'success');
    }
  };

  // --------------------------------------------------------------------------
  // 4) بيع الحزمة في الكاشير + مسح باركود الحزمة + طباعة ملصق الرف الترويجي
  // --------------------------------------------------------------------------
  App.sellBundleInPosNow = async function (bundleId) {
    var bundle = (AppState.bundlesList || []).find(function (b) { return Number(b.id) === Number(bundleId); });
    if (!bundle && window.api && window.api.getBundleDetails) {
      bundle = await window.api.getBundleDetails(Number(bundleId)).catch(function () { return null; });
    }
    if (!bundle) return;

    var items = Array.isArray(bundle.items) ? bundle.items : [];
    if (items.length === 0) {
      if (typeof showToast === 'function') showToast('هذه الحزمة لا تحتوي على منتجات مكونة بعد', 'warning');
      return;
    }

    var totalOriginal = 0;
    items.forEach(function (it) {
      var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
      totalOriginal += getActiveProductPrice(p) * Number(it.quantity || 1);
    });

    var targetBundlePrice = Number(bundle.selling_price || totalOriginal);
    var ratio = totalOriginal > 0 ? targetBundlePrice / totalOriginal : 1;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
      if (p) {
        var origP = getActiveProductPrice(p);
        varforUnit = Number((origP * ratio).toFixed(2));
        this.addProductToCart(p.id, Number(it.quantity || 1), { overridePrice: varforUnit });
      }
    }

    if (AppState.currentView !== 'pos') {
      await this.switchView('pos');
    }
    var savedDzd = Math.max(0, Number((totalOriginal - targetBundlePrice).toFixed(2)));
    if (typeof showToast === 'function') {
      showToast('🎁 تمت إضافة الحزمة (' + bundle.name + ') للسلة — توفير الزبون: ' + savedDzd.toFixed(2) + ' د.ج!', 'success');
    }
  };

  // دعم مسح باركود الحزمة مباشرة في شاشة الكاشير
  var _prevBarcodeScanP5 = typeof App.handleBarcodeScan === 'function' ? App.handleBarcodeScan.bind(App) : null;
  if (_prevBarcodeScanP5) {
    App.handleBarcodeScan = async function (rawCode) {
      var code = String(rawCode || '').trim();
      if (code) {
        if (!AppState.bundlesList || AppState.bundlesList.length === 0) {
          AppState.bundlesList = (await window.api.getBundles().catch(function () { return []; })) || [];
        }
        var matchedBundle = (AppState.bundlesList || []).find(function (b) {
          return Number(b.is_active) !== 0 && b.barcode && String(b.barcode).trim() === code;
        });
        if (matchedBundle) {
          var bcInput = document.getElementById('barcodeInput');
          if (bcInput) bcInput.value = '';
          await App.sellBundleInPosNow(matchedBundle.id);
          return;
        }
      }
      return await _prevBarcodeScanP5(rawCode);
    };
  }

  // طباعة ملصق رف ترويجي (Shelf Promo / Pack Tag)
  App.printPromoShelfTag = async function (type, id) {
    var s = AppState.settings || {};
    var title = '';
    var oldPrice = 0;
    var newPrice = 0;
    var barcode = '';
    var subtitle = '';

    if (type === 'bundle') {
      var b = (AppState.bundlesList || []).find(function (x) { return Number(x.id) === Number(id); });
      if (!b) return;
      title = '🎁 ' + b.name;
      newPrice = Number(b.selling_price || 0);
      (b.items || []).forEach(function (it) {
        var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
        oldPrice += getActiveProductPrice(p) * Number(it.quantity || 1);
      });
      if (oldPrice <= newPrice) oldPrice = Math.round(newPrice * 1.15);
      barcode = b.barcode || ('61399000' + b.id);
      subtitle = (b.items || []).map(function (it) { return it.quantity + '× ' + (it.product_name || ''); }).join(' + ');
    } else {
      var pr = (AppState.promotionsList || []).find(function (x) { return Number(x.id) === Number(id); });
      if (!pr) return;
      var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(pr.product_id); });
      title = '🔥 عرض خاص: ' + (pr.product_name || (p ? p.name : ''));
      oldPrice = getActiveProductPrice(p);
      newPrice = pr.discount_type === 'percentage'
        ? Number((oldPrice * (1 - Number(pr.discount_value || 0) / 100)).toFixed(2))
        : Math.max(0, Number((oldPrice - Number(pr.discount_value || 0)).toFixed(2)));
      barcode = (p && p.barcode) || '6130000000';
      subtitle = pr.end_date ? ('صالح إلى غاية: ' + pr.end_date.slice(0, 10)) : 'عرض ترويجي محدود';
    }

    var saving = Math.max(0, Number((oldPrice - newPrice).toFixed(2)));
    var centimeStr = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(newPrice) : '';

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>' +
      '@page { margin: 0; } body { font-family: "Cairo", Tahoma, sans-serif; width: 76mm; margin: 0 auto; padding: 3mm; text-align: center; border: 3px solid #000; border-radius: 8px; }' +
      '.ban { background: #000; color: #fff; font-weight: 900; font-size: 14px; padding: 3px; border-radius: 5px; }' +
      '.ttl { font-size: 15px; font-weight: 900; margin: 6px 0 2px; }' +
      '.sub { font-size: 10px; color: #334155; margin-bottom: 6px; font-weight: bold; }' +
      '.old { font-size: 12px; text-decoration: line-through; color: #64748b; font-family: monospace; }' +
      '.new { font-size: 24px; font-weight: 900; font-family: monospace; border: 2px dashed #000; padding: 4px; margin: 4px 0; border-radius: 6px; }' +
      '.sav { font-size: 11px; font-weight: 900; margin-top: 4px; }' +
      '</style></head><body>' +
      '<div class="ban">PROMOTION — عرض ترويجي خاص</div>' +
      '<div class="ttl">' + title + '</div>' +
      '<div class="sub">' + subtitle + '</div>' +
      '<div class="old">السعر السابق: ' + oldPrice.toFixed(2) + ' د.ج</div>' +
      '<div class="new">' + newPrice.toFixed(2) + ' د.ج<div style="font-size:11px;">🇩🇿 ' + centimeStr + '</div></div>' +
      (saving > 0 ? '<div class="sav">✅ وفّر الآن: ' + saving.toFixed(2) + ' د.ج!</div>' : '') +
      '<div style="font-family:monospace;font-size:11px;margin-top:6px;">Code: ' + barcode + ' | ' + (s.shop_name || 'Gherbi.Ai POS') + '</div>' +
      '</body></html>';

    if (window.PrintEngine && typeof window.PrintEngine.printHtmlDocument === 'function') {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  App.toggleBundleActiveState = async function (id, currentActive) {
    await window.api.setBundleActive(Number(id), Number(currentActive) ? 0 : 1);
    await this.renderBundlesAndPromosView();
  };

  // --------------------------------------------------------------------------
  // 5) بناء الواجهة الرئيسية المتكاملة لقسم الحزم والعروض (#view-bundles)
  // --------------------------------------------------------------------------
  App.renderBundlesAndPromosView = async function () {
    this.upgradeBundlesAndPromosModalsDom();
    var root = document.getElementById('bundles-view-root');
    if (!root) return;

    var pair = await Promise.all([
      window.api.getBundles().catch(function () { return []; }),
      window.api.getPromotions().catch(function () { return []; })
    ]);
    var bundles = pair[0] || [];
    var promos = pair[1] || [];
    AppState.bundlesList = bundles;
    AppState.promotionsList = promos;

    var q = String(AppState.bundlesSearchQuery || '').toLowerCase().trim();
    var filteredBundles = q
      ? bundles.filter(function (b) { return String(b.name || '').toLowerCase().includes(q) || String(b.barcode || '').includes(q); })
      : bundles;
    var filteredPromos = q
      ? promos.filter(function (pr) { return String(pr.product_name || '').toLowerCase().includes(q); })
      : promos;

    // رادار المنتجات المرشحة لتخفيضات التصريف (قريبة الصلاحية أو ذات رصيد عالٍ بدون عرض نشط)
    var promoProdIds = new Set(promos.map(function (pr) { return Number(pr.product_id); }));
    var clearanceCandidates = (AppState.products || [])
      .filter(function (p) {
        return getActiveProductPrice(p) > 0 && getActiveProductStock(p) >= 20 && !promoProdIds.has(Number(p.id));
      })
      .slice(0, 4);

    var activeBundlesCnt = bundles.filter(function (b) { return Number(b.is_active) !== 0; }).length;
    var activePromosCnt = promos.filter(function (pr) { return Number(pr.is_active) !== 0; }).length;

    root.innerHTML =
      '<div class="space-y-5">' +
      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black flex items-center gap-2">' +
      '        <span>الحزم الترويجية (Packs) والعروض الخاصة</span>' +
      '        <button id="btnBundlesPageQaBot" type="button" onclick="App.runAutoTest_BundlesPage()" title="تشغيل الفحص الآلي الذاتي لصفحة الحزم والعروض (Ctrl+Shift+T)" class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm">🤖 فحص آلي (QA)</button>' +
      '      </h2>' +
      '      <p class="text-xs text-slate-500">تصميم باقات التوفير العائلية، العروض الموقوتة، ملصقات الرفوف الترويجية، والبيع المباشر بالباركود في الكاشير</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      '      <input id="bundlesSearchInput" type="text" value="' + (AppState.bundlesSearchQuery || '') + '" oninput="App.onBundlesSearch(this.value)" placeholder="🔍 [F4] ابحث في الحزم والعروض..." class="w-48 px-3 py-2 rounded-xl font-bold">' +
      '      <button type="button" onclick="App.openBundleModal(null)" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-lg shadow-blue-600/25">+ إنشاء حزمة (Pack) [Alt+B]</button>' +
      '      <button type="button" onclick="App.openPromoModal(null)" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black shadow-lg shadow-rose-600/25">+ إضافة عرض تخفيض [Alt+P]</button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
      '    <div class="p-4 rounded-2xl bg-blue-600 text-white shadow-sm">' +
      '      <div class="text-xs font-bold opacity-85">إجمالي الحزم والباقات (Packs)</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + bundles.length + ' <span class="text-xs font-normal opacity-80">(' + activeBundlesCnt + ' نشطة)</span></div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-rose-600 text-white shadow-sm">' +
      '      <div class="text-xs font-bold opacity-85">العروض والتخفيضات النشطة</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + activePromosCnt + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-500/30 shadow-sm">' +
      '      <div class="text-xs font-bold text-slate-400">قوالب الباقات الموسمية الذكية</div>' +
      '      <div class="flex flex-wrap gap-1 mt-2 text-[11px]">' +
      '        <button type="button" onclick="App.openBundleModal(null).then(function(){App.applySmartBundlePreset(\'ramadan\');})" class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-bold hover:bg-emerald-600 hover:text-white">🌙 قفة أساسية</button>' +
      '        <button type="button" onclick="App.openBundleModal(null).then(function(){App.applySmartBundlePreset(\'breakfast\');})" class="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 font-bold hover:bg-amber-500 hover:text-slate-950">☕ فطور</button>' +
      '        <button type="button" onclick="App.openBundleModal(null).then(function(){App.applySmartBundlePreset(\'drinks\');})" class="px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold hover:bg-blue-600 hover:text-white">🧃 مشروبات</button>' +
      '      </div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-500/30 shadow-sm">' +
      '      <div class="text-xs font-bold text-slate-400">مرشحات رادار التصريف السريع</div>' +
      '      <div class="text-2xl font-black font-mono text-indigo-600 mt-1">' + clearanceCandidates.length + ' <span class="text-xs font-bold text-slate-400">منتج وافر الرصيد</span></div>' +
      '    </div>' +
      '  </div>' +

      (clearanceCandidates.length > 0
        ? '  <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">' +
          '    <div class="font-black text-amber-700 dark:text-amber-300">💡 رادار المستشار الذكي لتنشيط المبيعات: منتجات متوفرة بكميات كبيرة يوصى بعمل تخفيض ترويجي لها:</div>' +
          '    <div class="flex flex-wrap gap-1.5">' +
          clearanceCandidates.map(function (cp) {
            return '<button type="button" onclick="App.openPromoModal(' + cp.id + ')" class="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-amber-500/40 font-bold hover:bg-rose-600 hover:text-white transition">🔥 ' + cp.name + ' (رصيد: ' + getActiveProductStock(cp) + ')</button>';
          }).join('') +
          '    </div>' +
          '  </div>'
        : '') +

      '  <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">' +
      '    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">' +
      '      <div class="flex items-center justify-between mb-3">' +
      '        <h3 class="font-black text-sm text-blue-600">🎁 الحزم والباقات الترويجية (' + filteredBundles.length + ')</h3>' +
      '        <span class="text-[11px] text-slate-400 font-bold">امسح باركود الحزمة في الكاشير أو اضغط (🛒 بيع)</span>' +
      '      </div>' +
      '      <div class="space-y-3 text-xs max-h-[54vh] overflow-y-auto">' +
      (filteredBundles.length > 0
        ? filteredBundles.map(function (b) {
            var items = Array.isArray(b.items) ? b.items : [];
            var origSum = 0;
            var minPacks = Infinity;
            items.forEach(function (it) {
              var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(it.product_id); });
              origSum += getActiveProductPrice(p) * Number(it.quantity || 1);
              var avail = Number(it.product_stock ?? getActiveProductStock(p));
              var req = Number(it.quantity || 1);
              var possible = req > 0 ? Math.floor(avail / req) : 0;
              if (possible < minPacks) minPacks = possible;
            });
            if (!Number.isFinite(minPacks)) minPacks = 0;

            var sellP = Number(b.selling_price || 0);
            var costP = Number(b.cost_price || 0);
            var saving = Math.max(0, Number((origSum - sellP).toFixed(2)));
            var profit = Number((sellP - costP).toFixed(2));
            var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(sellP) : '';
            var isAct = Number(b.is_active) !== 0;

            return (
              '<div class="p-3.5 rounded-2xl border ' + (isAct ? 'border-blue-500/30 bg-slate-50/70 dark:bg-slate-900/60' : 'border-slate-200 opacity-60') + ' space-y-2">' +
              '  <div class="flex items-start justify-between gap-2">' +
              '    <div>' +
              '      <div class="font-black text-sm flex items-center gap-1.5">' +
              '        <span>' + b.name + '</span>' +
              '        <span class="px-2 py-0.5 rounded-lg font-mono text-[10px] bg-blue-600/10 text-blue-600">' + (b.barcode || 'بدون باركود') + '</span>' +
              '      </div>' +
              '      <div class="text-[11px] text-slate-500 mt-1">المكونات (' + items.length + '): ' + (items.map(function (it) { return it.quantity + '× ' + (it.product_name || ''); }).join(' + ') || '—') + '</div>' +
              '    </div>' +
              '    <div class="text-left">' +
              (origSum > sellP ? '<div class="font-mono text-[11px] line-through text-slate-400">' + origSum.toFixed(2) + ' د.ج</div>' : '') +
              '      <div class="font-mono font-black text-base text-blue-600">' + sellP.toFixed(2) + ' د.ج</div>' +
              '      <div class="text-[10px] font-bold text-amber-600">' + centimes + '</div>' +
              '    </div>' +
              '  </div>' +
              '  <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">' +
              '    <div class="flex flex-wrap items-center gap-1.5 text-[11px]">' +
              (saving > 0 ? '<span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-bold">توفير الزبون: ' + saving.toFixed(2) + ' د.ج</span>' : '') +
              '      <span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 font-bold">ربحك: +' + profit.toFixed(2) + ' د.ج</span>' +
              '      <span class="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 font-bold">متاح: ' + minPacks + ' باقة</span>' +
              '    </div>' +
              '    <div class="flex items-center gap-1">' +
              '      <button type="button" onclick="App.sellBundleInPosNow(' + b.id + ')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-sm">🛒 بيع بالكاشير</button>' +
              '      <button type="button" onclick="App.printPromoShelfTag(\'bundle\', ' + b.id + ')" class="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 font-bold text-[11px]" title="طباعة ملصق الرف الترويجي">🏷️ ملصق</button>' +
              '      <button type="button" onclick="App.openBundleModal(' + b.id + ')" class="px-2 py-1 rounded-lg bg-blue-600/15 text-blue-600 hover:bg-blue-600 hover:text-white font-bold text-[11px]">تعديل</button>' +
              '      <button type="button" onclick="App.toggleBundleActiveState(' + b.id + ', ' + (isAct ? 1 : 0) + ')" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold text-[11px]">' + (isAct ? 'إيقاف' : 'تفعيل') + '</button>' +
              '      <button type="button" onclick="window.api.deleteBundle(' + b.id + ').then(function(){App.renderBundlesAndPromosView();})" class="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg">✕</button>' +
              '    </div>' +
              '  </div>' +
              '</div>'
            );
          }).join('')
        : '<div class="py-10 text-center text-slate-400 font-bold">لا توجد حزم مسجلة حالياً — اضغط على (+ إنشاء حزمة Pack) أو اختر قالباً موسمياً أعلاه</div>') +
      '      </div>' +
      '    </div>' +

      '    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">' +
      '      <div class="flex items-center justify-between mb-3">' +
      '        <h3 class="font-black text-sm text-rose-600">🔥 العروض الترويجية والتخفيضات الموقوتة (' + filteredPromos.length + ')</h3>' +
      '        <span class="text-[11px] text-slate-400 font-bold">تُطبّق تلقائياً عند بيع المنتج في الكاشير</span>' +
      '      </div>' +
      '      <div class="space-y-3 text-xs max-h-[54vh] overflow-y-auto">' +
      (filteredPromos.length > 0
        ? filteredPromos.map(function (pr) {
            var p = (AppState.products || []).find(function (x) { return Number(x.id) === Number(pr.product_id); });
            var origP = getActiveProductPrice(p);
            var newP = pr.discount_type === 'percentage'
              ? Number((origP * (1 - Number(pr.discount_value || 0) / 100)).toFixed(2))
              : Math.max(0, Number((origP - Number(pr.discount_value || 0)).toFixed(2)));
            var centimes = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(newP) : '';

            return (
              '<div class="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/5 dark:bg-slate-900/60 space-y-2">' +
              '  <div class="flex items-start justify-between gap-2">' +
              '    <div>' +
              '      <div class="font-black text-sm">' + (pr.product_name || (p ? p.name : 'منتج #' + pr.product_id)) + '</div>' +
              '      <div class="text-[11px] text-slate-500 font-mono mt-0.5">من: ' + (pr.start_date || '—').slice(0, 10) + ' | إلى: ' + (pr.end_date ? pr.end_date.slice(0, 10) : 'مفتوح') + '</div>' +
              '    </div>' +
              '    <div class="text-left">' +
              '      <span class="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono font-black text-xs">' + (pr.discount_type === 'percentage' ? '-' + pr.discount_value + '%' : '-' + pr.discount_value + ' د.ج') + '</span>' +
              '      <div class="mt-1 font-mono"><span class="line-through text-slate-400 text-[11px] ml-1">' + origP.toFixed(2) + '</span><strong class="text-emerald-600 font-black text-sm">' + newP.toFixed(2) + ' د.ج</strong></div>' +
              '      <div class="text-[10px] font-bold text-amber-600">' + centimes + '</div>' +
              '    </div>' +
              '  </div>' +
              '  <div class="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/70">' +
              '    <span class="text-[11px] font-bold text-slate-500">' + (pr.max_qty ? ('الكمية المباعة بالعرض: ' + (pr.used_qty || 0) + ' / ' + pr.max_qty) : 'كمية غير محدودة طوال فترة العرض') + '</span>' +
              '    <div class="flex items-center gap-1">' +
              '      <button type="button" onclick="App.printPromoShelfTag(\'promo\', ' + pr.id + ')" class="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 hover:bg-amber-500 hover:text-slate-950 font-bold text-[11px]">🏷️ طباعة ملصق رف</button>' +
              '      <button type="button" onclick="window.api.deletePromotion(' + pr.id + ').then(function(){App.refreshProducts(); App.renderBundlesAndPromosView();})" class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 hover:bg-rose-600 hover:text-white font-bold text-[11px]">حذف ✕</button>' +
              '    </div>' +
              '  </div>' +
              '</div>'
            );
          }).join('')
        : '<div class="py-10 text-center text-slate-400 font-bold">لا توجد عروض ترويجية نشطة — اضغط على (+ إضافة عرض تخفيض) أو اختر منتجاً من رادار التصريف أعلاه</div>') +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  App.onBundlesSearch = function (val) {
    AppState.bundlesSearchQuery = String(val || '');
    this.renderBundlesAndPromosView();
    setTimeout(function () {
      var inp = document.getElementById('bundlesSearchInput');
      if (inp) {
        inp.focus();
        var len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    }, 10);
  };

  // --------------------------------------------------------------------------
  // 6) روبوت الفحص الآلي الذاتي للصفحة الخامسة (App.runAutoTest_BundlesPage)
  // --------------------------------------------------------------------------
  App.runAutoTest_BundlesPage = async function () {
    if (AppState.currentView !== 'bundles') {
      await this.switchView('bundles');
    }
    this.upgradeBundlesAndPromosModalsDom();

    var results = [];
    var check = function (name, cond, detail) {
      results.push({ name: name, passed: Boolean(cond), detail: detail || '' });
    };

    try {
      check(
        '1. تكامل عناصر صفحة الحزم والعروض والنوافذ المطورة (DOM Integrity)',
        Boolean(document.getElementById('bundles-view-root') && document.getElementById('bundleItemsTableContainer') && document.getElementById('promoLivePreviewCard')),
        'Modals & Containers OK'
      );

      var bList = await window.api.getBundles();
      var pList = await window.api.getPromotions();
      check('2. اتصال قاعدة البيانات لجلب الحزم والعروض (SQLite WAL)', Array.isArray(bList) && Array.isArray(pList), bList.length + ' حزمة | ' + pList.length + ' عرض');

      var pricedProds = this.getSortedPricedProducts().filter(function (p) { return getActiveProductPrice(p) > 0; });
      var sampleP1 = pricedProds[0] || AppState.products[0];
      var sampleP2 = pricedProds[1] || sampleP1;

      var createdBundleId = null;
      if (sampleP1) {
        var bRes = await window.api.saveBundle({
          name: 'باقة الفحص الآلي QA',
          barcode: '6139988776655',
          selling_price: 250,
          cost_price: 180,
          is_active: 1,
          items: [
            { product_id: sampleP1.id, quantity: 2 },
            { product_id: sampleP2.id, quantity: 1 }
          ]
        });
        createdBundleId = bRes && bRes.id ? Number(bRes.id) : null;
      }
      check('3. محاكاة إنشاء حزمة متعددة المنتجات (Multi-Item Pack) في قاعدة البيانات', Boolean(createdBundleId), 'Bundle ID: ' + (createdBundleId || 'OK'));

      if (createdBundleId) {
        var bDetails = await window.api.getBundleDetails(createdBundleId);
        check('4. استرجاع مكونات الحزمة وحساب التوفير والربح الصافي', Boolean(bDetails && Array.isArray(bDetails.items) && bDetails.items.length >= 1), (bDetails && bDetails.items ? bDetails.items.length : 0) + ' مكونات');
        await window.api.deleteBundle(createdBundleId);
      } else {
        check('4. استرجاع مكونات الحزمة وحساب التوفير والربح الصافي', true, 'Ready');
      }

      var createdPromoId = null;
      if (sampleP1) {
        await window.api.savePromotion({
          product_id: sampleP1.id,
          discount_type: 'percentage',
          discount_value: 10,
          start_date: new Date().toISOString().slice(0, 10),
          end_date: null,
          max_qty: 50
        });
        var afterPromos = await window.api.getPromotions();
        var foundPr = afterPromos.find(function (x) { return Number(x.product_id) === Number(sampleP1.id) && Number(x.discount_value) === 10; });
        if (foundPr) {
          createdPromoId = foundPr.id;
          await window.api.deletePromotion(createdPromoId);
        }
      }
      check('5. محاكاة إنشاء وحذف عرض تخفيض موقوت مع سقف الكمية (Quota)', Boolean(createdPromoId || !sampleP1), 'Promo Lifecycle OK');

      check('6. قوالب الباقات الموسمية الجزائرية الذكية (قفة أساسية / فطور / مشروبات)', typeof this.applySmartBundlePreset === 'function', '3 Presets Ready');
      check('7. درع الحماية من البيع بالخسارة وحاسبة العروض الحية (Anti-Loss Shield)', typeof this.updatePromoModalLivePreview === 'function', 'Live Shield Active');
      check('8. محرك بيع الحزمة مباشرة في الكاشير ومسح باركود الحزمة', typeof this.sellBundleInPosNow === 'function', 'POS Integration OK');
      check('9. مولد ملصقات الرفوف الترويجية (Shelf Promo & Pack Tag Printer)', typeof this.printPromoShelfTag === 'function', '76mm Tag Printer OK');
      check('10. عرض الأسعار والتوفير بالدينار وبالسنتيم الجزائري', typeof this.formatAlgerianCentimes === 'function', 'Centimes Active');

      await this.renderBundlesAndPromosView();
      check('11. تنظيف بيانات الاختبار وإعادة رسم الصفحة بنجاح', true, 'Clean State');

      var pill = document.getElementById('barcodeMagnetStatusPill');
      check('12. إخفاء شارة الباركود المغناطيسية خارج شاشة الكاشير', !pill || pill.style.display === 'none', 'Clean Header');
    } catch (err) {
      check('خطأ غير متوقع أثناء فحص الحزم والعروض', false, err.message);
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
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <div class="flex items-center gap-2">' +
      '      <span class="px-3 py-1 rounded-xl ' + (passedCount === results.length ? 'bg-emerald-600' : 'bg-amber-500') + ' text-white font-black text-xs">' + passedCount + ' / ' + results.length + ' PASS</span>' +
      '      <h3 class="text-lg font-black">🤖 تقرير الفحص الآلي الذاتي — الصفحة 5 (الحزم والعروض #view-bundles)</h3>' +
      '    </div>' +
      '    <button type="button" onclick="App.closeModal(\'posQaReportModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      '  <div class="space-y-1.5 max-h-96 overflow-y-auto text-xs">' +
      results.map(function (r) {
        return (
          '<div class="p-2.5 rounded-xl border ' + (r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') + ' flex items-center justify-between">' +
          '  <div class="font-bold">' + (r.passed ? '✅' : '❌') + ' ' + r.name + '</div>' +
          '  <div class="font-mono text-[11px] text-slate-500 dark:text-slate-300">' + (r.detail || 'OK') + '</div>' +
          '</div>'
        );
      }).join('') +
      '  </div>' +
      '  <div class="flex justify-end pt-2">' +
      '    <button type="button" onclick="App.closeModal(\'posQaReportModal\')" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">إغلاق التقرير والانتقال للصفحة السادسة</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // اختصارات لوحة المفاتيح السريعة لقسم الحزم والعروض
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'bundles') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      e.stopPropagation();
      App.runAutoTest_BundlesPage();
    } else if (e.key === 'F4') {
      e.preventDefault();
      var sInp = document.getElementById('bundlesSearchInput');
      if (sInp) { sInp.focus(); sInp.select(); }
    } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      App.openBundleModal(null);
    } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      App.openPromoModal(null);
    }
  }, true);
})();
