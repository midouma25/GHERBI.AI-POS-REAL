/**
 * api-client.js
 * عميل الشبكة المحلية (LAN Client) لتحويل استدعاءات أجهزة الكاشير الفرعية إلى الخادم الرئيسي عبر HTTP REST
 */

'use strict';

const axios = require('axios');

class LanApiClient {
  constructor(options = {}) {
    this.serverIp = options.serverIp || '192.168.1.15';
    this.serverPort = options.serverPort || 8080;
    this.timeout = options.timeout || 25000;
    this.deviceId = options.deviceId || 'lan-client';
    this._rebuild();
  }

  _rebuild() {
    this.baseURL = `http://${this.serverIp}:${this.serverPort}`;
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': this.deviceId,
        'X-Client-Type': 'gherbi-lan-client'
      }
    });
  }

  setTarget(serverIp, serverPort = 8080, deviceId = null) {
    if (serverIp) this.serverIp = String(serverIp).trim();
    if (serverPort) this.serverPort = Number(serverPort) || 8080;
    if (deviceId) this.deviceId = String(deviceId).trim();
    this._rebuild();
  }

  async _req(method, url, data = undefined, params = undefined) {
    try {
      const res = await this.http.request({ method, url, data, params });
      return res.data;
    } catch (err) {
      if (err.response && err.response.data) {
        const d = err.response.data;
        throw new Error(typeof d === 'object' ? d.error || d.message || JSON.stringify(d) : String(d));
      }
      throw new Error(`LAN_ERROR: ${err.message}`);
    }
  }

  ping() { return this._req('GET', '/api/ping'); }
  getDataRevision() { return this._req('GET', '/api/data-revision'); }

  // المنتجات والمخزون
  getCategories() { return this._req('GET', '/api/categories'); }
  getFamilies() { return this._req('GET', '/api/families'); }
  getProductSuppliers() { return this._req('GET', '/api/product-suppliers'); }
  getProducts(filters = {}) { return this._req('GET', '/api/products', undefined, filters); }
  getPosStock() { return this._req('GET', '/api/pos-stock'); }
  getProductFull(id) { return this._req('GET', `/api/products/${id}/full`); }
  getProductAnalytics(id) { return this._req('GET', `/api/products/${id}/analytics`); }
  addProduct(data) { return this._req('POST', '/api/products', data); }
  updateProduct(id, data) { return this._req('PUT', `/api/products/${id}`, data); }
  deleteProduct(id) { return this._req('DELETE', `/api/products/${id}`); }
  addBatch(productId, data) { return this._req('POST', `/api/batches/${productId}`, data); }
  updateBatch(batchId, data) { return this._req('PUT', `/api/batches/${batchId}`, data); }
  deleteBatch(batchId) { return this._req('DELETE', `/api/batches/${batchId}`); }
  saveProductVariants(id, data) { return this._req('PUT', `/api/products/${id}/variants`, data); }
  getVariantTemplates() { return this._req('GET', '/api/variant-templates'); }
  addProductBarcode(id, barcode, priceLabel = null) {
    return this._req('POST', `/api/products/${id}/barcodes`, { barcode, price_label: priceLabel });
  }
  addVariantQuick(payload) {
    const pid = payload && (payload.productId || payload.product_id);
    return this._req('POST', `/api/products/${pid}/variants-quick`, payload);
  }
  toggleFeatured(id) { return this._req('POST', `/api/products/${id}/toggle-featured`); }

  // المبيعات والزبائن
  processSale(data) {
    if (data && data.editSaleId) return this._req('PUT', `/api/sales/${data.editSaleId}`, data);
    return this._req('POST', '/api/sales', data);
  }
  getSales(filters = {}) { return this._req('GET', '/api/sales', undefined, filters); }
  getSaleDetails(id) { return this._req('GET', `/api/sales/${id}`); }
  addSalePayment(id, amount, date, meta = {}) {
    return this._req('POST', `/api/sales/${id}/payment`, { amount, date, ...meta });
  }
  deleteSale(id, opts = {}) { return this._req('DELETE', `/api/sales/${id}`, opts); }
  getCustomers(filters = {}) { return this._req('GET', '/api/customers', undefined, filters); }
  getCustomersDebt() { return this._req('GET', '/api/customers/debts'); }
  addCustomer(data) { return this._req('POST', '/api/customers', data); }
  updateCustomer(id, data) { return this._req('PUT', `/api/customers/${id}`, data); }
  deleteCustomer(id) { return this._req('DELETE', `/api/customers/${id}`); }
  getCustomerCreditSummary(id, excludeSaleId = null) {
    return this._req('GET', `/api/customers/${id}/credit-summary`, undefined, { excludeSaleId });
  }
  getCustomerSales(id) { return this._req('GET', `/api/customers/${id}/sales`); }
  addCustomerPayment(id, amount, date, meta = {}) {
    return this._req('POST', `/api/customers/${id}/payment`, { amount, date, ...meta });
  }
  getCustomerSalesAggregated(payload = {}) {
    const cid = payload.customerId || payload.customer_id;
    return this._req('GET', `/api/customers/${cid}/sales-aggregated`, undefined, payload);
  }
  getSalesSummary(payload = {}) { return this._req('GET', '/api/sales-summary', undefined, payload); }
  getPaymentDetails(id, type = 'sale') { return this._req('GET', `/api/payments/${id}`, undefined, { type }); }
  issueCreditNote(payload = {}) {
    const sid = payload.saleId || payload.sale_id;
    return this._req('POST', `/api/sales/${sid}/credit-note`, payload);
  }
  nextDocNumber(docType) { return this._req('POST', '/api/doc-number', { docType }); }
  logDocumentPrint(payload) { return this._req('POST', '/api/document-print-log', payload); }

  // الموردون والمشتريات
  getSuppliers(filters = {}) { return this._req('GET', '/api/suppliers', undefined, filters); }
  addSupplier(data) { return this._req('POST', '/api/suppliers', data); }
  updateSupplier(id, data) { return this._req('PUT', `/api/suppliers/${id}`, data); }
  deleteSupplier(id) { return this._req('DELETE', `/api/suppliers/${id}`); }
  getSupplierPurchases(id) { return this._req('GET', `/api/suppliers/${id}/purchases`); }
  addSupplierPayment(id, amount, date, meta = {}) {
    return this._req('POST', `/api/suppliers/${id}/payment`, { amount, date, ...meta });
  }
  getSupplierReturnableItems(id) { return this._req('GET', `/api/suppliers/${id}/returnable-items`); }
  saveSupplierReturn(data) { return this._req('POST', '/api/supplier-returns', data); }
  getSupplierReturns(filters = {}) { return this._req('GET', '/api/supplier-returns', undefined, filters); }
  getSupplierReturnDetails(id) { return this._req('GET', `/api/supplier-returns/${id}`); }
  deleteSupplierReturn(id) { return this._req('DELETE', `/api/supplier-returns/${id}`); }
  getPurchases(filters = {}) { return this._req('GET', '/api/purchases', undefined, filters); }
  savePurchase(data) { return this._req('POST', '/api/purchases', data); }
  getInvoiceDetails(id) { return this._req('GET', `/api/purchases/${id}`); }
  addInvoicePayment(id, amount, date, meta = {}) {
    return this._req('POST', `/api/purchases/${id}/payment`, { amount, date, ...meta });
  }
  deletePurchase(id) { return this._req('DELETE', `/api/purchases/${id}`); }

  // الفواتير الشكلية والطلبيات
  createProforma(data) { return this._req('POST', '/api/proformas', data); }
  getProformas(filters = {}) { return this._req('GET', '/api/proformas', undefined, filters); }
  getProformaDetails(id) { return this._req('GET', `/api/proformas/${id}`); }
  updateProforma(id, data) { return this._req('PUT', `/api/proformas/${id}`, data); }
  deleteProforma(id) { return this._req('DELETE', `/api/proformas/${id}`); }
  cancelProforma(id) { return this._req('POST', `/api/proformas/${id}/cancel`); }
  proformaToSalePayload(id) { return this._req('GET', `/api/proformas/${id}/sale-payload`); }
  markProformaConverted(id, saleId) { return this._req('POST', `/api/proformas/${id}/mark-converted`, { saleId }); }
  createOrder(data) { return this._req('POST', '/api/orders', data); }
  getOrders(filters = {}) { return this._req('GET', '/api/orders', undefined, filters); }
  getOrderDetails(id) { return this._req('GET', `/api/orders/${id}`); }
  updateOrder(id, data) { return this._req('PUT', `/api/orders/${id}`, data); }
  deleteOrder(id) { return this._req('DELETE', `/api/orders/${id}`); }
  cancelOrder(id) { return this._req('POST', `/api/orders/${id}/cancel`); }
  orderToSalePayload(id) { return this._req('GET', `/api/orders/${id}/sale-payload`); }
  markOrderDelivered(id, saleId) { return this._req('POST', `/api/orders/${id}/mark-delivered`, { saleId }); }

  // الخزينة، المصاريف، رأس المال، الباقات، العروض، التصنيع، والجرد
  openCaisseSession(data) { return this._req('POST', '/api/caisse/open', data); }
  closeCaisseSession(data) { return this._req('POST', '/api/caisse/close', data); }
  getActiveSession(userId) {
    const uid = typeof userId === 'object' && userId !== null ? userId.userId : userId;
    return this._req('GET', `/api/caisse/active/${uid || 0}`, undefined, { deviceId: this.deviceId });
  }
  getCaisseSessions(filters = {}) { return this._req('GET', '/api/caisse/sessions', undefined, filters); }
  getSessionDetails(id) { return this._req('GET', `/api/caisse/session/${id}`); }
  addCaisseTransaction(data) { return this._req('POST', '/api/caisse/transaction', data); }
  getCaisseSummary(filters = {}) { return this._req('GET', '/api/caisse/summary', undefined, filters); }
  getCaisseTransactionsLog(filters = {}) { return this._req('GET', '/api/caisse/transactions-log', undefined, filters); }
  getExpenses(filters = {}) { return this._req('GET', '/api/expenses', undefined, filters); }
  addExpense(data) { return this._req('POST', '/api/expenses', data); }
  deleteExpense(id) { return this._req('DELETE', `/api/expenses/${id}`); }
  getCapital(filters = {}) { return this._req('GET', '/api/capital', undefined, filters); }
  addCapital(data) { return this._req('POST', '/api/capital', data); }
  deleteCapital(id) { return this._req('DELETE', `/api/capital/${id}`); }
  getBundles() { return this._req('GET', '/api/bundles'); }
  getBundleDetails(id) { return this._req('GET', `/api/bundles/${id}`); }
  saveBundle(data) { return this._req('POST', '/api/bundles', data); }
  deleteBundle(id) { return this._req('DELETE', `/api/bundles/${id}`); }
  setBundleActive(id, isActive) { return this._req('PUT', `/api/bundles/${id}/active`, { is_active: isActive }); }
  getPromotions() { return this._req('GET', '/api/promotions'); }
  savePromotion(data) { return this._req('POST', '/api/promotions', data); }
  deletePromotion(id) { return this._req('DELETE', `/api/promotions/${id}`); }
  getBomRecipes(filters = {}) { return this._req('GET', '/api/bom-recipes', undefined, filters); }
  getBomRecipe(id) { return this._req('GET', `/api/bom-recipes/${id}`); }
  saveBomRecipe(data) { return this._req('POST', '/api/bom-recipes', data); }
  deleteBomRecipe(id) { return this._req('DELETE', `/api/bom-recipes/${id}`); }
  getRecipeAvailability(data) { return this._req('POST', '/api/recipe-availability', data); }
  getProductionOrders(filters = {}) { return this._req('GET', '/api/production-orders', undefined, filters); }
  getProductionOrder(id) { return this._req('GET', `/api/production-orders/${id}`); }
  createProductionOrder(data) { return this._req('POST', '/api/production-orders', data); }
  confirmProductionOrder(data) { return this._req('POST', '/api/production-orders/confirm', data); }
  reverseProductionOrder(data) { return this._req('POST', '/api/production-orders/reverse', data); }
  getManufacturableCapacity(data) { return this._req('POST', '/api/manufacturable-capacity', data); }
  setMaterialRole(data) { return this._req('POST', '/api/products/material-role', data); }
  getStocktakeSheet(filters = {}) { return this._req('GET', '/api/stocktake-sheet', undefined, filters); }
  getStocktakes(filters = {}) { return this._req('GET', '/api/stocktakes', undefined, filters); }
  getStocktake(id) { return this._req('GET', `/api/stocktakes/${id}`); }
  createStocktake(data) { return this._req('POST', '/api/stocktakes', data); }

  // الإحصائيات، المستخدمون، والإعدادات
  getAnalytics(params = {}) { return this._req('GET', '/api/analytics', undefined, params); }
  getSegmentAnalytics(params = {}) { return this._req('POST', '/api/analytics/segment', params); }
  getSegmentProducts(params = {}) { return this._req('POST', '/api/analytics/segment-products', params); }
  getNotifications() { return this._req('GET', '/api/notifications'); }
  getStockDebt() { return this._req('GET', '/api/stock-debt'); }
  getStockDebtSummary() { return this._req('GET', '/api/stock-debt/summary'); }
  checkFirstRun() { return this._req('GET', '/api/first-run'); }
  setupFirstAdmin(data) { return this._req('POST', '/api/first-run/setup', data); }
  loginUser(username, password) { return this._req('POST', '/api/login', { username, password }); }
  getUsers() { return this._req('GET', '/api/users'); }
  addUser(data) { return this._req('POST', '/api/users', data); }
  updateUser(id, data) { return this._req('PUT', `/api/users/${id}`, data); }
  deleteUser(id) { return this._req('DELETE', `/api/users/${id}`); }
  updateAccount(userId, username, currentPassword, newPassword) {
    return this._req('PUT', '/api/account', { userId, username, currentPassword, newPassword });
  }
  getCustomTemplates(docType = null) {
    return this._req('GET', '/api/custom-templates', undefined, docType ? { doc_type: docType } : {});
  }
  getCustomTemplate(id) { return this._req('GET', `/api/custom-templates/${id}`); }
  saveCustomTemplate(data) { return this._req('POST', '/api/custom-templates', data); }
  deleteCustomTemplate(id) { return this._req('DELETE', `/api/custom-templates/${id}`); }

  lookupDzBarcode(barcode) {
    return this._req('GET', `/api/dz-barcode/${encodeURIComponent(barcode)}`);
  }
  getDzDictionaryStats() {
    return this._req('GET', '/api/dz-dictionary/stats');
  }
  lookupWarrantySerial(serial) {
    return this._req('GET', `/api/warranty/${encodeURIComponent(serial)}`);
  }
  getSupplierLedger(supplierId) {
    return this._req('GET', `/api/suppliers/${supplierId}/ledger`);
  }
  getInstallmentPlans(filters = {}) {
    return this._req('GET', '/api/installments', undefined, filters);
  }
  createInstallmentPlan(payload) {
    return this._req('POST', '/api/installments', payload);
  }
  payInstallmentSchedule(scheduleId, amount) {
    return this._req('POST', `/api/installments/${scheduleId}/pay`, { amount });
  }
  getAuditLogs(filters = {}) {
    return this._req('GET', '/api/audit-logs', undefined, filters);
  }
  addAuditLog(payload) {
    return this._req('POST', '/api/audit-logs', payload);
  }
  getDocCounters() {
    return this._req('GET', '/api/doc-counters');
  }
  updateDocCounter(payload) {
    return this._req('PUT', '/api/doc-counters', payload);
  }
  getAiCopilotInsights() {
    return this._req('GET', '/api/copilot-insights');
  }
  getProductSerials(productId) {
    return this._req('GET', `/api/products/${productId}/serials`);
  }
  addProductSerial(payload) {
    return this._req('POST', `/api/products/${payload.product_id || payload.productId}/serials`, payload);
  }

  getChequesPortfolio(filters = {}) {
    return this._req('GET', '/api/cheques', undefined, filters);
  }
  saveChequeRecord(payload) {
    return this._req('POST', '/api/cheques', payload);
  }
  updateChequeStatus(id, status) {
    return this._req('PUT', `/api/cheques/${id}/status`, { status });
  }
  deleteChequeRecord(id) {
    return this._req('DELETE', `/api/cheques/${id}`);
  }
  getAlgerianFiscalReport(params = {}) {
    return this._req('GET', '/api/fiscal-report', undefined, params);
  }
  importDzMasterCsv() {
    return this._req('POST', '/api/dz-dictionary/import-csv');
  }


  // === التوسعات المؤسسية الـ 6 عبر الشبكة المحلية (LAN Enterprise V14) ===
  getInstallmentContracts(filters = {}) { return this._req('GET', '/api/enterprise/installment-contracts', undefined, filters); }
  createInstallmentContract(payload) { return this._req('POST', '/api/enterprise/installment-contracts', payload); }
  payInstallmentSchedule(payload) { return this._req('POST', '/api/enterprise/installment-schedules/pay', payload); }
  reconcileCcpStatement(payload) { return this._req('POST', '/api/enterprise/ccp-reconcile', payload); }
  getCcpReconciliationLogs(filters = {}) { return this._req('GET', '/api/enterprise/ccp-reconciliation-logs', undefined, filters); }
  getEtat104(year) { return this._req('GET', '/api/enterprise/etat-104', undefined, { year }); }
  getWarehouses() { return this._req('GET', '/api/enterprise/warehouses'); }
  saveWarehouse(payload) { return this._req('POST', '/api/enterprise/warehouses', payload); }
  deleteWarehouse(id) { return this._req('DELETE', `/api/enterprise/warehouses/${id}`); }
  getStockTransfers() { return this._req('GET', '/api/enterprise/stock-transfers'); }
  createStockTransfer(payload) { return this._req('POST', '/api/enterprise/stock-transfers', payload); }
  updateBatchShelfLocation(payload) { return this._req('PUT', '/api/enterprise/batches-shelf', payload); }
  getDrivers() { return this._req('GET', '/api/enterprise/drivers'); }
  saveDriver(payload) { return this._req('POST', '/api/enterprise/drivers', payload); }
  deleteDriver(id) { return this._req('DELETE', `/api/enterprise/drivers/${id}`); }
  getDeliveryShipments(filters = {}) { return this._req('GET', '/api/enterprise/delivery-shipments', undefined, filters); }
  saveDeliveryShipment(payload) { return this._req('POST', '/api/enterprise/delivery-shipments', payload); }
  settleShipmentCod(payload) { return this._req('POST', '/api/enterprise/delivery-shipments/settle-cod', payload); }
  getDiscountCoupons() { return this._req('GET', '/api/enterprise/coupons'); }
  saveDiscountCoupon(payload) { return this._req('POST', '/api/enterprise/coupons', payload); }
  deleteDiscountCoupon(id) { return this._req('DELETE', `/api/enterprise/coupons/${id}`); }
  validateDiscountCoupon(payload) { return this._req('POST', '/api/enterprise/coupons/validate', payload); }
  getSystemAuditLogs(filters = {}) { return this._req('GET', '/api/enterprise/system-audit-logs', undefined, filters); }
  logSystemAudit(payload) { return this._req('POST', '/api/enterprise/system-audit-logs', payload); }
  getEmployees() { return this._req('GET', '/api/enterprise/employees'); }
  saveEmployee(payload) { return this._req('POST', '/api/enterprise/employees', payload); }
  deleteEmployee(id) { return this._req('DELETE', `/api/enterprise/employees/${id}`); }
  getPayrollPayments() { return this._req('GET', '/api/enterprise/payroll'); }
  payEmployeeSalary(payload) { return this._req('POST', '/api/enterprise/payroll', payload); }
  getServiceTickets(filters = {}) { return this._req('GET', '/api/enterprise/service-tickets', undefined, filters); }
  saveServiceTicket(payload) { return this._req('POST', '/api/enterprise/service-tickets', payload); }
  convertServiceTicketToSale(payload) { return this._req('POST', '/api/enterprise/service-tickets/convert', payload); }

  getSettings() { return this._req('GET', '/api/settings'); }
  updateSettings(data) { return this._req('PUT', '/api/settings', data); }
}

module.exports = new LanApiClient();
module.exports.LanApiClient = LanApiClient;