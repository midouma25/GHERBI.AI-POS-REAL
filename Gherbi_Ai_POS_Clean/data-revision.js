/**
 * data-revision.js
 * متتبع مراجعات البيانات اللحظي لتحديث واجهة الكاشير وعملاء الشبكة المحلية فور حدوث أي تغيير
 */

'use strict';

const EventEmitter = require('events');

const IGNORED_TABLES = new Set([
  'sync_cursors',
  'sync_outbox',
  'sync_row_errors',
  'pull_row_errors',
  'pending_fk_fixups',
  'device_registry',
  'fresh_bootstrap_images',
  'document_print_log',
  'sqlite_sequence'
]);

const IGNORED_SETTING_KEYS = new Set([
  'last_cloud_sync_at',
  '_skip_stock_ledger',
  'cloud_sync_epoch',
  'cloud_snapshot_done'
]);

const PRODUCT_TABLES = new Set([
  'products',
  'product_barcodes',
  'product_prices',
  'product_option_groups',
  'product_option_values',
  'product_variants',
  'variant_option_values',
  'product_bundles',
  'bundle_items',
  'product_promotions',
  'bom_recipes',
  'bom_components'
]);

const STOCK_TABLES = new Set([
  'inventory_batches',
  'stock_movements',
  'stock_debt',
  'product_serials',
  'inventory_reservations',
  'production_orders',
  'production_order_items',
  'stocktakes',
  'stocktake_items'
]);

const SALES_TABLES = new Set([
  'sales',
  'sale_items',
  'sale_payments',
  'proforma_invoices',
  'proforma_items',
  'customer_orders',
  'customer_order_items',
  'caisse_sessions',
  'caisse_transactions'
]);

const PARTY_TABLES = new Set([
  'customers',
  'loyalty_transactions',
  'suppliers',
  'purchase_invoices',
  'purchase_items',
  'invoice_payments',
  'supplier_returns',
  'supplier_return_items'
]);

class DataRevisionTracker extends EventEmitter {
  constructor() {
    super();
    this.revision = 1;
    this.productsRev = 1;
    this.stockRev = 1;
    this.salesRev = 1;
    this.partiesRev = 1;
    this.settingsRev = 1;
    this.lastTable = 'init';
    this.lastUpdatedAt = new Date().toISOString();
    this.tableRevisions = Object.create(null);
  }

  extractTargetTable(sql) {
    if (typeof sql !== 'string') return null;
    const s = sql.trim();

    let m = /^(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO)\s+["`[]?([a-zA-Z_][a-zA-Z0-9_]*)["`\]]?/i.exec(s);
    if (m) return m[1].toLowerCase();

    m = /^UPDATE(?:\s+OR\s+\w+)?\s+["`[]?([a-zA-Z_][a-zA-Z0-9_]*)["`\]]?/i.exec(s);
    if (m) return m[1].toLowerCase();

    m = /^DELETE\s+FROM\s+["`[]?([a-zA-Z_][a-zA-Z0-9_]*)["`\]]?/i.exec(s);
    if (m) return m[1].toLowerCase();

    return null;
  }

  isInternalBookkeeping(sql, table, params = []) {
    if (!table || IGNORED_TABLES.has(table)) return true;

    if (table === 'settings') {
      const str = String(sql || '');
      for (const k of IGNORED_SETTING_KEYS) {
        if (str.includes(`'${k}'`) || (Array.isArray(params) && params[0] === k)) {
          return true;
        }
      }
    }

    if (/^UPDATE\b/i.test(String(sql || '').trim())) {
      const setMatch = /\bSET\s+([\s\S]+?)(?:\bWHERE\b|$)/i.exec(sql);
      if (setMatch) {
        const cols = setMatch[1]
          .split(',')
          .map((c) => c.split('=')[0].trim().toLowerCase())
          .filter(Boolean);
        if (cols.length > 0 && cols.every((c) => c === 'dirty' || c === 'server_rev')) {
          return true;
        }
      }
    }

    return false;
  }

  bump(table = 'general') {
    const tbl = String(table || 'general').toLowerCase();
    if (IGNORED_TABLES.has(tbl)) return this.getSnapshot();

    this.revision += 1;
    this.lastTable = tbl;
    this.lastUpdatedAt = new Date().toISOString();
    this.tableRevisions[tbl] = (this.tableRevisions[tbl] || 0) + 1;

    if (PRODUCT_TABLES.has(tbl)) this.productsRev += 1;
    if (STOCK_TABLES.has(tbl)) {
      this.stockRev += 1;
      this.productsRev += 1;
    }
    if (SALES_TABLES.has(tbl)) this.salesRev += 1;
    if (PARTY_TABLES.has(tbl)) this.partiesRev += 1;
    if (tbl === 'settings' || tbl === 'shop_info' || tbl === 'custom_templates') {
      this.settingsRev += 1;
    }

    const snapshot = this.getSnapshot();
    this.emit('changed', snapshot);
    return snapshot;
  }

  getSnapshot() {
    return {
      revision: this.revision,
      products: this.productsRev,
      stock: this.stockRev,
      sales: this.salesRev,
      parties: this.partiesRev,
      settings: this.settingsRev,
      lastTable: this.lastTable,
      updatedAt: this.lastUpdatedAt,
      tables: { ...this.tableRevisions }
    };
  }
}

const defaultTracker = new DataRevisionTracker();

function installDataRevisionHook(db, tracker = defaultTracker) {
  if (!db || db._dataRevisionInstalled) return tracker;

  const prevRun = db.run.bind(db);

  db.run = function hookedRevisionRun(sql, ...args) {
    const table = tracker.extractTargetTable(sql);
    const params = Array.isArray(args[0]) ? args[0] : [];
    const shouldBump = table && !tracker.isInternalBookkeeping(sql, table, params);

    if (!shouldBump) {
      return prevRun(sql, ...args);
    }

    const lastIdx = args.length - 1;
    if (lastIdx >= 0 && typeof args[lastIdx] === 'function') {
      const origCb = args[lastIdx];
      args[lastIdx] = function wrappedCallback(err, ...cbArgs) {
        if (!err) tracker.bump(table);
        return origCb.call(this, err, ...cbArgs);
      };
      return prevRun(sql, ...args);
    }

    return prevRun(sql, ...args, function autoCallback(err) {
      if (!err) tracker.bump(table);
    });
  };

  db._dataRevisionTracker = tracker;
  db._dataRevisionInstalled = true;
  return tracker;
}

module.exports = {
  DataRevisionTracker,
  tracker: defaultTracker,
  getDataRevision: () => defaultTracker.getSnapshot(),
  bumpRevision: (tbl) => defaultTracker.bump(tbl),
  installDataRevisionHook
};