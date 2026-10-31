/**
 * cloud-diagnostics.js
 * أداة الفحص الهندسي العميق لسلامة الجداول، المشغلات (Triggers Probe)، ودفتر حركات المخزون
 */

'use strict';

const { signedRequest } = require('./device-auth');

function rawGet(db, sql, params = []) {
  const fn = db._rawGet ? db._rawGet.bind(db) : db.get.bind(db);
  return new Promise((resolve, reject) => {
    fn(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function rawAll(db, sql, params = []) {
  const fn = db._rawAll ? db._rawAll.bind(db) : db.all.bind(db);
  return new Promise((resolve, reject) => {
    fn(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function rawRun(db, sql, params = []) {
  const fn = db._rawRun ? db._rawRun.bind(db) : db.run.bind(db);
  return new Promise((resolve, reject) => {
    fn(sql, params, function onDone(err) {
      if (err) return reject(err);
      resolve({ lastID: this ? this.lastID : null, changes: this ? this.changes : 0 });
    });
  });
}

async function deepDiagnose(db) {
  const triggers = await rawAll(
    db,
    "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name ASC"
  );

  const counts = await rawGet(
    db,
    `
    SELECT
      (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) AS total_products,
      (SELECT COUNT(*) FROM products WHERE uuid IS NULL OR uuid = '') AS products_missing_uuid,
      (SELECT COUNT(*) FROM inventory_batches WHERE deleted_at IS NULL) AS total_batches,
      (SELECT COUNT(*) FROM inventory_batches WHERE COALESCE(stock, 0) <> 0 AND deleted_at IS NULL) AS batches_with_stock,
      (SELECT COUNT(*) FROM inventory_batches WHERE uuid IS NULL OR uuid = '') AS batches_missing_uuid,
      (SELECT COUNT(*) FROM inventory_batches WHERE dirty = 1) AS dirty_batches,
      (SELECT COUNT(*) FROM stock_movements WHERE deleted_at IS NULL) AS total_movements,
      (SELECT COUNT(*) FROM stock_movements WHERE dirty = 1) AS dirty_movements,
      (SELECT COUNT(*) FROM sales WHERE deleted_at IS NULL) AS total_sales
    `
  );

  let nullInsertOk = false;
  let nullInsertError = null;
  let triggerFired = false;

  try {
    await rawRun(db, 'SAVEPOINT probe_insert');
    await rawRun(
      db,
      `
      INSERT INTO stock_movements (
        uuid, batch_uuid, product_uuid, variant_uuid, delta, reason,
        origin_device, occurred_at, updated_at, dirty
      ) VALUES (
        'probe_' || lower(hex(randomblob(8))), NULL, NULL, NULL, 0, 'probe',
        'diagnostic', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0
      )
      `
    );
    nullInsertOk = true;
  } catch (err) {
    nullInsertError = err.message;
  } finally {
    try {
      await rawRun(db, 'ROLLBACK TO probe_insert');
      await rawRun(db, 'RELEASE probe_insert');
    } catch (_) {}
  }

  try {
    const sampleBatch = await rawGet(
      db,
      "SELECT id, uuid FROM inventory_batches WHERE uuid IS NOT NULL AND uuid <> '' ORDER BY id DESC LIMIT 1"
    );
    if (sampleBatch && sampleBatch.id) {
      await rawRun(db, 'SAVEPOINT probe_update');
      const beforeRow = await rawGet(
        db,
        'SELECT COUNT(*) AS n FROM stock_movements WHERE batch_uuid = ?',
        [sampleBatch.uuid]
      );
      await rawRun(
        db,
        'UPDATE inventory_batches SET stock = COALESCE(stock, 0) + 1 WHERE id = ?',
        [sampleBatch.id]
      );
      const afterRow = await rawGet(
        db,
        'SELECT COUNT(*) AS n FROM stock_movements WHERE batch_uuid = ?',
        [sampleBatch.uuid]
      );
      triggerFired = Number((afterRow && afterRow.n) || 0) > Number((beforeRow && beforeRow.n) || 0);
      await rawRun(db, 'ROLLBACK TO probe_update');
      await rawRun(db, 'RELEASE probe_update');
    }
  } catch (_) {
    try {
      await rawRun(db, 'ROLLBACK TO probe_update');
      await rawRun(db, 'RELEASE probe_update');
    } catch (_) {}
  }

  const recentMovements = await rawAll(
    db,
    `SELECT id, uuid, batch_uuid, product_uuid, delta, reason, origin_device, dirty, server_rev, occurred_at
     FROM stock_movements
     ORDER BY id DESC LIMIT 25`
  );

  const syncErrors = await rawAll(db, 'SELECT * FROM sync_row_errors LIMIT 50');
  const pullErrors = await rawAll(db, 'SELECT * FROM pull_row_errors LIMIT 50');

  return {
    timestamp: new Date().toISOString(),
    counts,
    probes: {
      nullInsertOk,
      nullInsertError,
      triggerFired
    },
    triggersCount: triggers.length,
    triggers: triggers.map((t) => ({ name: t.name, table: t.tbl_name })),
    recentMovements,
    syncErrors,
    pullErrors
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
