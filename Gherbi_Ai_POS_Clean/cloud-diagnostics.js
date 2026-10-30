/**
 * cloud-diagnostics.js
 * أداة الفحص الهندسي العميق لسلامة الجداول، المشغلات (Triggers)، ودفتر حركات المخزون
 */

'use strict';

const { signedRequest } = require('./device-auth');

async function deepDiagnose(db) {
  const triggers = await db.dbAll(
    "SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger' ORDER BY name ASC"
  );

  const counts = await db.dbGet(`
    SELECT
      (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) AS total_products,
      (SELECT COUNT(*) FROM inventory_batches WHERE deleted_at IS NULL) AS total_batches,
      (SELECT COUNT(*) FROM inventory_batches WHERE COALESCE(stock, 0) <> 0 AND deleted_at IS NULL) AS batches_with_stock,
      (SELECT COUNT(*) FROM stock_movements WHERE deleted_at IS NULL) AS total_movements,
      (SELECT COUNT(*) FROM sales WHERE deleted_at IS NULL) AS total_sales
  `);

  const recentMovements = await db.dbAll(
    `SELECT id, uuid, batch_uuid, product_uuid, delta, reason, origin_device, occurred_at
     FROM stock_movements
     ORDER BY id DESC LIMIT 25`
  );

  const syncErrors = await db.dbAll('SELECT * FROM sync_row_errors LIMIT 50');

  return {
    timestamp: new Date().toISOString(),
    counts,
    triggersCount: triggers.length,
    triggers,
    recentMovements,
    syncErrors
  };
}

async function sendDiagnostics(db, extraPayload = {}) {
  const report = await deepDiagnose(db);
  try {
    const res = await signedRequest(db, {
      method: 'POST',
      path: '/api/cloud/diagnostics',
      data: { ...extraPayload, report }
    });
    return { ok: true, serverResponse: res, report };
  } catch (err) {
    return { ok: false, error: err.message, report };
  }
}

module.exports = {
  deepDiagnose,
  sendDiagnostics
};