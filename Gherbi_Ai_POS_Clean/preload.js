/**
 * preload.js
 * جسر الربط الآمن الشامل 100% (ContextBridge) بين العملية الرئيسية والواجهة الأمامية
 * يضم كافة دوال Lumina POS + الميزات الجزائرية الـ 6 + فاحص الضمان + استيراد قاموس 613 + عدادات الفواتير
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

function createEventSubscriber(channel) {
  return (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

const api = {
  // 1. المراجعات، الإعدادات، ومعلومات التطبيق
  getDataRevision: () => invoke('get-data-revision'),
  getAppVersion: () => invoke('get-app-version'),
  checkUpdate: () => invoke('check-update'),
  openExternalLink: (url) => invoke('open-external-link', url),
  openYoutubeVideo: (url) => invoke('open-youtube-video', url),
  relaunchApp: () => invoke('app-relaunch'),
  getSettings: () => invoke('get-settings'),
  updateSettings: (settingsObj) => invoke('update-settings', settingsObj),
  resetSystem: () => invoke('reset-system'),
  seedDemoData: () => invoke('seed-demo-data'),
  getChequesPortfolio: (filters) => invoke('get-cheques-portfolio', filters),
  saveChequeRecord: (payload) => invoke('save-cheque-record', payload),
  updateChequeStatus: (id, status) => invoke('update-cheque-status', id, status),
  deleteChequeRecord: (id) => invoke('delete-cheque-record', id),
  getAlgerianFiscalReport: (params) => invoke('get-algerian-fiscal-report', params),
  exportEtat104Excel: (rows) => invoke('export-etat104-excel', rows),
  getPerformanceMetrics: () => invoke('get-performance-metrics'),
  getDocCounters: () => invoke('get-doc-counters'),
  updateDocCounter: (payload) => invoke('update-doc-counter', payload),

  // 2. المستخدمون والحسابات
  checkFirstRun: () => invoke('check-first-run'),
  setupFirstAdmin: (...args) => invoke('setup-first-admin', ...args),
  loginUser: (...args) => invoke('login-user', ...args),
  getUsers: () => invoke('get-users'),
  addUser: (userData) => invoke('add-user', userData),
  updateUser: (...args) => invoke('update-user', ...args),
  deleteUser: (id) => invoke('delete-user', id),
  updateAccount: (...args) => invoke('update-account', ...args),

  // 3. المنتجات، الدفعات، الباركودات، المتغيرات، والأرقام التسلسلية
  getCategories: () => invoke('get-categories'),
  getFamilies: () => invoke('get-families'),
  getProductSuppliers: () => invoke('get-product-suppliers'),
  getProducts: (filters) => invoke('get-products', filters),
  getPosStock: () => invoke('get-pos-stock'),
  getProductFull: (productId) => invoke('get-product-full', productId),
  getProductAnalytics: (productId) => invoke('get-product-analytics', productId),
  addProduct: (productData) => invoke('add-product', productData),
  updateProduct: (...args) => invoke('update-product', ...args),
  deleteProduct: (productId) => invoke('delete-product', productId),
  addBatch: (...args) => invoke('add-batch', ...args),
  updateBatch: (...args) => invoke('update-batch', ...args),
  deleteBatch: (batchId) => invoke('delete-batch', batchId),
  saveProductVariants: (productId, variantData) =>
    invoke('save-product-variants', productId, variantData),
  getVariantTemplates: () => invoke('get-variant-templates'),
  addProductBarcode: (productId, barcode, priceLabel) =>
    invoke('add-product-barcode', productId, barcode, priceLabel),
  addVariantQuick: (payload) => invoke('add-variant-quick', payload),
  toggleFeatured: (productId) => invoke('toggle-featured', productId),
  getProductSerials: (productId) => invoke('get-product-serials', productId),
  addProductSerial: (payload) => invoke('add-product-serial', payload),
  lookupWarrantySerial: (serial) => invoke('lookup-warranty-serial', serial),

  // 4. المبيعات، الزبائن، والائتمان
  processSale: (saleData) => invoke('process-sale', saleData),
  getSales: (filters) => invoke('get-sales', filters),
  getSaleDetails: (saleId) => invoke('get-sale-details', saleId),
  addSalePayment: (saleId, amount, date, meta) =>
    invoke('add-sale-payment', saleId, amount, date, meta),
  deleteSale: (saleId, opts) => invoke('delete-sale', saleId, opts),
  getCustomers: (filters) => invoke('get-customers', filters),
  getCustomersDebt: () => invoke('get-customers-debt'),
  addCustomer: (customerData) => invoke('add-customer', customerData),
  updateCustomer: (...args) => invoke('update-customer', ...args),
  deleteCustomer: (customerId) => invoke('delete-customer', customerId),
  getCustomerCreditSummary: (customerId, excludeSaleId) =>
    invoke('get-customer-credit-summary', customerId, excludeSaleId),
  getCustomerSales: (customerId) => invoke('get-customer-sales', customerId),
  addCustomerPayment: (customerId, amount, date, meta) =>
    invoke('add-customer-payment', customerId, amount, date, meta),
  getCustomerSalesAggregated: (payload) => invoke('get-customer-sales-aggregated', payload),
  getSalesSummary: (payload) => invoke('get-sales-summary', payload),
  getPaymentDetails: (paymentId, type) => invoke('get-payment-details', paymentId, type),
  issueCreditNote: (payload) => invoke('issue-credit-note', payload),
  nextDocNumber: (docType) => invoke('next-doc-number', docType),
  logDocumentPrint: (payload) => invoke('log-document-print', payload),

  // 5. الموردون، المشتريات، ومرتجعات الموردين
  getSuppliers: (filters) => invoke('get-suppliers', filters),
  addSupplier: (supplierData) => invoke('add-supplier', supplierData),
  updateSupplier: (...args) => invoke('update-supplier', ...args),
  deleteSupplier: (supplierId) => invoke('delete-supplier', supplierId),
  getSupplierPurchases: (supplierId) => invoke('get-supplier-purchases', supplierId),
  getSupplierLedger: (supplierId) => invoke('get-supplier-ledger', supplierId),
  addSupplierPayment: (supplierId, amount, date, meta) =>
    invoke('add-supplier-payment', supplierId, amount, date, meta),
  getSupplierReturnableItems: (supplierId) =>
    invoke('get-supplier-returnable-items', supplierId),
  saveSupplierReturn: (returnData) => invoke('save-supplier-return', returnData),
  getSupplierReturns: (filters) => invoke('get-supplier-returns', filters),
  getSupplierReturnDetails: (returnId) => invoke('get-supplier-return-details', returnId),
  deleteSupplierReturn: (returnId) => invoke('delete-supplier-return', returnId),
  getPurchases: (filters) => invoke('get-purchases', filters),
  savePurchase: (purchaseData) => invoke('save-purchase', purchaseData),
  getInvoiceDetails: (invoiceId) => invoke('get-invoice-details', invoiceId),
  addInvoicePayment: (invoiceId, amount, date, meta) =>
    invoke('add-invoice-payment', invoiceId, amount, date, meta),
  deletePurchase: (invoiceId) => invoke('delete-purchase', invoiceId),

  // 6. الفواتير الشكلية والطلبيات
  createProforma: (data) => invoke('create-proforma', data),
  getProformas: (filters) => invoke('get-proformas', filters),
  getProformaDetails: (id) => invoke('get-proforma-details', id),
  updateProforma: (id, data) => invoke('update-proforma', id, data),
  deleteProforma: (id) => invoke('delete-proforma', id),
  cancelProforma: (id) => invoke('cancel-proforma', id),
  proformaToSalePayload: (id) => invoke('proforma-to-sale-payload', id),
  markProformaConverted: (id, saleId) => invoke('mark-proforma-converted', id, saleId),
  checkProformaStock: (id) => invoke('check-proforma-stock', id),
  convertProformaToSale: (id, payload) => invoke('convert-proforma-to-sale', id, payload),
  createOrder: (data) => invoke('create-order', data),
  getOrders: (filters) => invoke('get-orders', filters),
  getOrderDetails: (id) => invoke('get-order-details', id),
  updateOrder: (id, data) => invoke('update-order', id, data),
  deleteOrder: (id) => invoke('delete-order', id),
  cancelOrder: (id) => invoke('cancel-order', id),
  orderToSalePayload: (id) => invoke('order-to-sale-payload', id),
  markOrderDelivered: (id, saleId) => invoke('mark-order-delivered', id, saleId),

  // 7. الخزينة، المصاريف، رأس المال، الباقات، والعروض
  openCaisseSession: (payload) => invoke('open-caisse-session', payload),
  closeCaisseSession: (payload) => invoke('close-caisse-session', payload),
  getActiveSession: (userId) => invoke('get-active-session', userId),
  getCaisseSessions: (filters) => invoke('get-caisse-sessions', filters),
  getSessionDetails: (sessionId) => invoke('get-session-details', sessionId),
  addCaisseTransaction: (txData) => invoke('add-caisse-transaction', txData),
  getCaisseSummary: (filters) => invoke('get-caisse-summary', filters),
  getCaisseTransactionsLog: (filters) => invoke('get-caisse-transactions-log', filters),
  getExpenses: (filters) => invoke('get-expenses', filters),
  addExpense: (data) => invoke('add-expense', data),
  deleteExpense: (id) => invoke('delete-expense', id),
  getCapital: (filters) => invoke('get-capital', filters),
  addCapital: (data) => invoke('add-capital', data),
  deleteCapital: (id) => invoke('delete-capital', id),
  getBundles: () => invoke('get-bundles'),
  getBundleDetails: (id) => invoke('get-bundle-details', id),
  saveBundle: (data) => invoke('save-bundle', data),
  deleteBundle: (id) => invoke('delete-bundle', id),
  setBundleActive: (id, isActive) => invoke('set-bundle-active', id, isActive),
  getPromotions: () => invoke('get-promotions'),
  savePromotion: (data) => invoke('save-promotion', data),
  deletePromotion: (id) => invoke('delete-promotion', id),

  // 8. التصنيع (BOM) والجرد (Stocktake)
  getBomRecipes: (filters) => invoke('get-bom-recipes', filters),
  getBomRecipe: (id) => invoke('get-bom-recipe', id),
  saveBomRecipe: (data) => invoke('save-bom-recipe', data),
  deleteBomRecipe: (id) => invoke('delete-bom-recipe', id),
  getRecipeAvailability: (payload) => invoke('get-recipe-availability', payload),
  getProductionOrders: (filters) => invoke('get-production-orders', filters),
  getProductionOrder: (id) => invoke('get-production-order', id),
  createProductionOrder: (payload) => invoke('create-production-order', payload),
  confirmProductionOrder: (payload) => invoke('confirm-production-order', payload),
  reverseProductionOrder: (payload) => invoke('reverse-production-order', payload),
  getManufacturableCapacity: (payload) => invoke('get-manufacturable-capacity', payload),
  setMaterialRole: (payload) => invoke('set-material-role', payload),
  getStocktakeSheet: (filters) => invoke('get-stocktake-sheet', filters),
  getStocktakes: (filters) => invoke('get-stocktakes', filters),
  getStocktake: (id) => invoke('get-stocktake', id),
  createStocktake: (payload) => invoke('create-stocktake', payload),

  // 9. الإحصائيات، المساعد الذكي، التنبيهات، والقوالب المخصصة
  getAnalytics: (params) => invoke('get-analytics', params),
  getSegmentAnalytics: (params) => invoke('get-segment-analytics', params),
  getSegmentProducts: (params) => invoke('get-segment-products', params),
  getAiCopilotInsights: () => invoke('get-ai-copilot-insights'),
  getNotifications: () => invoke('get-notifications'),
  getStockDebt: () => invoke('get-stock-debt'),
  getStockDebtSummary: () => invoke('get-stock-debt-summary'),
  getCustomTemplates: (docType) => invoke('get-custom-templates', docType),
  getCustomTemplate: (id) => invoke('get-custom-template', id),
  saveCustomTemplate: (data) => invoke('save-custom-template', data),
  deleteCustomTemplate: (id) => invoke('delete-custom-template', id),

  // 10. الميزات الحصرية للسوق الجزائري (القاموس 613 الضخم، الأقساط، الرقابة، شاشة الزبون، والضمان)
  lookupDzBarcode: (barcode) => invoke('lookup-dz-barcode', barcode),
  importDzDictionaryCsv: () => invoke('import-dz-dictionary-csv'),
  getDzDictionaryStats: () => invoke('get-dz-dictionary-stats'),
  getAuditLogs: (filters) => invoke('get-audit-logs', filters),
  addAuditLog: (payload) => invoke('add-audit-log', payload),
  getInstallmentPlans: (filters) => invoke('get-installment-plans', filters),
  createInstallmentPlan: (payload) => invoke('create-installment-plan', payload),
  payInstallmentSchedule: (scheduleId, amount) =>
    invoke('pay-installment-schedule', scheduleId, amount),
  openCustomerDisplay: () => invoke('open-customer-display'),
  updateCustomerDisplay: (cartState) => invoke('update-customer-display', cartState),

  // 11. الطباعة، الباركود، النسخ الاحتياطي، والإكسل
  getPrinters: () => invoke('get-printers'),
  printSilent: (options) => invoke('print-silent', options),
  exportPDF: (options) => invoke('export-pdf', options),
  openCashDrawer: () => invoke('open-cash-drawer'),
  generateBarcodeImage: (text, opts) => invoke('generate-barcode-image', text, opts),
  pairingQrDataUrl: () => invoke('pairing-qr-dataurl'),
  ripQrDataUrl: (txt) => invoke('rip-qr-dataurl', txt),
  exportDatabaseBackup: () => invoke('export-db-backup'),
  importDatabaseBackup: () => invoke('import-db-backup'),
  exportProductsToExcel: () => invoke('export-products-excel'),
  importProductsFromExcel: () => invoke('import-products-excel'),
  downloadInventoryTemplate: () => invoke('download-inventory-template'),
  exportSalesToExcel: () => invoke('export-sales-excel'),
  exportCustomersToExcel: () => invoke('export-customers-excel'),
  exportSuppliersToExcel: () => invoke('export-suppliers-excel'),
  importCustomersFromExcel: () => invoke('import-customers-excel'),
  importSuppliersFromExcel: () => invoke('import-suppliers-excel'),
  downloadCustomersTemplate: () => invoke('download-customers-template'),
  downloadSuppliersTemplate: () => invoke('download-suppliers-template'),

  // 12. الشبكة، الميزان، السحابة، والتراخيص
  getLocalIp: () => invoke('get-local-ip'),
  getLocalIps: () => invoke('get-local-ips'),
  getConnectedClients: () => invoke('get-connected-clients'),
  discoverLanServers: () => invoke('discover-lan-servers'),
  getServerEndpoint: () => invoke('get-server-endpoint'),
  getNetworkTarget: () => invoke('get-network-target'),
  getRelayStatus: () => invoke('get-relay-status'),
  reconnectRelay: () => invoke('reconnect-relay'),
  listComPorts: () => invoke('list-com-ports'),

  scale: {
    start: (cfg) => invoke('scale:start', cfg),
    stop: () => invoke('scale:stop'),
    status: () => invoke('scale:status'),
    readOnce: () => invoke('scale:read-once'),
    tare: () => invoke('scale:tare'),
    zero: () => invoke('scale:zero'),
    send: (cmd) => invoke('scale:send', cmd),
    sniff: (opts) => invoke('scale:sniff', opts),
    probe: (opts) => invoke('scale:probe', opts),
    listPorts: () => invoke('scale:list-ports'),
    onReading: createEventSubscriber('scale:reading'),
    onStatus: createEventSubscriber('scale:status'),
    onRaw: createEventSubscriber('scale:raw')
  },

  cloudSync: {
    status: () => invoke('cloud-sync:status'),
    trigger: () => invoke('cloud-sync:trigger'),
    setMode: (mode) => invoke('cloud-sync:set-mode', mode),
    snapshot: () => invoke('cloud-sync:snapshot'),
    wipe: () => invoke('cloud-sync:wipe'),
    joinWithCode: (code) => invoke('cloud-sync:join-with-code', code),
    getJoinInfo: () => invoke('cloud-sync:get-join-info'),
    leaveCloud: () => invoke('cloud-sync:leave-cloud'),
    issueMobilePairCode: () => invoke('cloud-sync:issue-mobile-pair-code'),
    backfillFromOwner: () => invoke('cloud-sync:backfill-from-owner'),
    resetAndResync: () => invoke('cloud-sync:reset-and-resync'),
    freshBootstrap: () => invoke('cloud-sync:fresh-bootstrap'),
    recomputeStock: () => invoke('cloud-sync:recompute-stock'),
    repairLedger: () => invoke('cloud-sync:repair-ledger'),
    inspectLedger: () => invoke('cloud-sync:inspect-ledger'),
    deepDiagnose: () => invoke('cloud-sync:deep-diagnose'),
    sendDiagnostics: (payload) => invoke('cloud-sync:send-diagnostics', payload),
    onStatus: createEventSubscriber('cloud-sync:status'),
    onDataChanged: createEventSubscriber('cloud-sync:data-changed')
  },

  getLicenseStatus: () => invoke('get-license-status'),
  activateSoftware: (code) => invoke('activate-software', code),
  activateSoftwareOffline: () => invoke('activate-software-offline'),
  deactivateSoftware: () => invoke('deactivate-software'),
  getTrialStatus: () => invoke('get-trial-status'),
  getPromoStatus: () => invoke('get-promo-status'),
  sendPurchaseRequest: (data) => invoke('send-purchase-request', data),
  sendSupportMessage: (data) => invoke('send-support-message', data)
};

contextBridge.exposeInMainWorld('api', api);