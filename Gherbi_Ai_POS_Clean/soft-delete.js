
/**
 * soft-delete.js
 * محرك الحذف الناعم (Soft Delete) وتحرير الحقول الفريدة (Unique Tombstone Release)
 * لضمان عمل المزامنة السحابية ومنع تعارض الباركودات أو أسماء المستخدمين المحذوفة
 */

'use strict';

const SOFT_DELETE_TABLES = new Set([
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
  'product_serials',
  'inventory_batches',
  'stock_debt',
  'suppliers',
  'purchase_invoices',
  'purchase_items',
  'invoice_payments',
  'supplier_returns',
  'supplier_return_items',
  'customers',
  'sales',
  'sale_items',
  'sale_payments',
  'proforma_invoices',
  'proforma_items',
  'customer_orders',
  'customer_order_items',
  'inventory_reservations',
  'caisse_sessions',
  'caisse_transactions',
  'expenses',
  'capital_injections',
  'bom_recipes',
  'bom_components',
  'production_orders',
  'production_order_items',
  'stocktakes',
  'stocktake_items',
  'users',
  'shop_info',
  'custom_templates'
]);

const UNIQUE_TOMBSTONE_COLUMNS = {
  products: 'barcode',
  product_barcodes: 'barcode',
  product_variants: 'barcode',
  product_bundles: 'barcode',
  users: 'username'
};

/**
 * تحويل جملة DELETE قياسية إلى جملة UPDATE ناعمة مع تحرير العمود الفريد إن وجد
 */
function rewriteDeleteToSoftDelete(sql) {
  if (typeof sql !== 'string') return null;
  const trimmed = sql.trim();

  const match = /^DELETE\s+FROM\s+["`[]?([a-zA-Z_][a-zA-Z0-9_]*)["`\]]?(?:\s+WHERE\s+([\s\S]+))?$/i.exec(
    trimmed
  );
  if (!match) return null;

  const table = match[1].toLowerCase();
  const whereClause = match[2] ? match[2].trim() : '';

  // إذا لم يكن هناك شرط WHERE (مثل مسح كامل الجدول أثناء استعادة نسخة)، نتركه حذفاً فعلياً
  if (!whereClause || !SOFT_DELETE_TABLES.has(table)) {
    return null;
  }

  const nowExpr = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  const deviceExpr = "COALESCE((SELECT value FROM settings WHERE key='instance_id'), origin_device)";
  const uniqueCol = UNIQUE_TOMBSTONE_COLUMNS[table];

  let uniqueReleaseAssignment = '';
  if (uniqueCol) {
    uniqueReleaseAssignment = `, ${uniqueCol} = CASE WHEN ${uniqueCol} IS NOT NULL AND ${uniqueCol} NOT LIKE '%~del~%' THEN ${uniqueCol} || '~del~' || id ELSE ${uniqueCol} END`;
  }

  return `UPDATE ${table} SET deleted_at = ${nowExpr}, updated_at = ${nowExpr}, origin_device = ${deviceExpr}, dirty = 1${uniqueReleaseAssignment} WHERE (${whereClause}) AND deleted_at IS NULL`;
}

/**
 * ربط محرك الحذف الناعم بدوال قاعدة البيانات
 */
function installSoftDeleteShim(db) {
  if (!db || db._softDeleteInstalled) return db;

  const origRun = db.run.bind(db);

  db.run = function patchedSoftDeleteRun(sql, ...args) {
    const rewritten = rewriteDeleteToSoftDelete(sql);
    if (rewritten) {
      return origRun(rewritten, ...args);
    }
    return origRun(sql, ...args);
  };

  db._softDeleteInstalled = true;
  return db;
}

module.exports = {
  SOFT_DELETE_TABLES,
  rewriteDeleteToSoftDelete,
  installSoftDeleteShim
};