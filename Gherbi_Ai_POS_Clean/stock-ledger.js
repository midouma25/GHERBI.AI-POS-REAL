/**
 * stock-ledger.js
 * محرك دفتر الأستاذ الذري للمخزون (Immutable Stock Movement Ledger)
 * يضمن تطابق أرصدة الدفعات مع مجموع الحركات المسجلة عبر الأجهزة
 */

'use strict';

const crypto = require('crypto');

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

/**
 * تنفيذ عملية على inventory_batches مع تعطيل مشغلات دفتر المخزون مؤقتاً
 */
async function withSkipStockLedger(db, workFn) {
  await rawRun(db, "INSERT OR REPLACE INTO settings (key, value) VALUES ('_skip_stock_ledger', '1')");
  try {
    return await workFn();
  } finally {
    await rawRun(db, "DELETE FROM settings WHERE key = '_skip_stock_ledger'");
  }
}

/**
 * بذر حركات الابتداء (init) للدفعات التي لها رصيد وليس لها حركات مسجلة
 */
async function seedStartupMovements(db) {
  await rawRun(
    db,
    "UPDATE inventory_batches SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL OR uuid = ''"
  );

  const res = await rawRun(
    db,
    `
    INSERT INTO stock_movements (
      uuid, batch_uuid, product_uuid, variant_uuid, delta, reason,
      origin_device, occurred_at, updated_at, dirty
    )
    SELECT
      lower(hex(randomblob(16))),
      ib.uuid,
      p.uuid,
      pv.uuid,
      COALESCE(ib.stock, 0),
      'init',
      COALESCE((SELECT value FROM settings WHERE key = 'instance_id'), 'local'),
      strftime('%Y-%m-%dT%H:%M:%fZ','now'),
      strftime('%Y-%m-%dT%H:%M:%fZ','now'),
      1
    FROM inventory_batches ib
    LEFT JOIN products p ON p.id = ib.product_id
    LEFT JOIN product_variants pv ON pv.id = ib.variant_id
    WHERE ib.deleted_at IS NULL
      AND COALESCE(ib.stock, 0) <> 0
      AND NOT EXISTS (
        SELECT 1 FROM stock_movements sm WHERE sm.batch_uuid = ib.uuid
      )
    `
  );
  return { seeded: res.changes };
}

/**
 * إضافة حركة مخزون صريحة
 */
async function appendMovement(db, {
  batchUuid,
  productUuid = null,
  variantUuid = null,
  delta,
  reason = 'manual',
  refType = null,
  refUuid = null
}) {
  const numDelta = Number(delta || 0);
  if (!batchUuid || Math.abs(numDelta) < 0.000001) return null;

  const instRow = await rawGet(db, "SELECT value FROM settings WHERE key = 'instance_id'");
  const originDevice = (instRow && instRow.value) || 'local';
  const nowIso = new Date().toISOString();
  const moveUuid = crypto.randomBytes(16).toString('hex');

  await rawRun(
    db,
    `
    INSERT INTO stock_movements (
      uuid, batch_uuid, product_uuid, variant_uuid, delta, reason,
      ref_type, ref_uuid, origin_device, occurred_at, updated_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [
      moveUuid,
      batchUuid,
      productUuid,
      variantUuid,
      numDelta,
      reason,
      refType,
      refUuid,
      originDevice,
      nowIso,
      nowIso
    ]
  );

  return moveUuid;
}

/**
 * مطابقة رصيد دفعة واحدة مع مجموع حركاتها في الدفتر
 */
async function reconcileBatchLedger(db, batchId, reason = 'reconcile', refType = null, refUuid = null) {
  if (!batchId) return;
  await rawRun(
    db,
    "UPDATE inventory_batches SET uuid = lower(hex(randomblob(16))) WHERE id = ? AND (uuid IS NULL OR uuid = '')",
    [batchId]
  );

  const row = await rawGet(
    db,
    `
    SELECT
      ib.uuid AS batch_uuid,
      p.uuid AS product_uuid,
      pv.uuid AS variant_uuid,
      COALESCE(ib.stock, 0) - COALESCE((
        SELECT SUM(sm.delta) FROM stock_movements sm
        WHERE sm.batch_uuid = ib.uuid AND sm.deleted_at IS NULL
      ), 0) AS gap
    FROM inventory_batches ib
    LEFT JOIN products p ON p.id = ib.product_id
    LEFT JOIN product_variants pv ON pv.id = ib.variant_id
    WHERE ib.id = ?
    `,
    [batchId]
  );

  if (row && Math.abs(Number(row.gap || 0)) > 0.0001) {
    await appendMovement(db, {
      batchUuid: row.batch_uuid,
      productUuid: row.product_uuid,
      variantUuid: row.variant_uuid,
      delta: Number(row.gap),
      reason,
      refType,
      refUuid
    });
  }
}

/**
 * إعادة حساب رصيد جميع الدفعات من واقع حركات stock_movements
 */
async function recomputeAllBatches(db) {
  return await withSkipStockLedger(db, async () => {
    const res = await rawRun(
      db,
      `
      UPDATE inventory_batches
      SET stock = COALESCE((
        SELECT SUM(sm.delta) FROM stock_movements sm
        WHERE sm.batch_uuid = inventory_batches.uuid AND sm.deleted_at IS NULL
      ), 0)
      WHERE uuid IS NOT NULL AND uuid <> ''
        AND EXISTS (SELECT 1 FROM stock_movements sm2 WHERE sm2.batch_uuid = inventory_batches.uuid)
      `
    );
    return { recomputedBatches: res.changes };
  });
}

/**
 * إصلاح الفروقات بين الرصيد المخزن والدفتر (cloud-sync:repair-ledger)
 */
async function repairMissingMovements(db) {
  await seedStartupMovements(db);

  const gaps = await rawAll(
    db,
    `
    SELECT
      ib.id,
      ib.uuid AS batch_uuid,
      p.uuid AS product_uuid,
      pv.uuid AS variant_uuid,
      COALESCE(ib.stock, 0) - COALESCE((
        SELECT SUM(sm.delta) FROM stock_movements sm
        WHERE sm.batch_uuid = ib.uuid AND sm.deleted_at IS NULL
      ), 0) AS gap
    FROM inventory_batches ib
    LEFT JOIN products p ON p.id = ib.product_id
    LEFT JOIN product_variants pv ON pv.id = ib.variant_id
    WHERE ib.deleted_at IS NULL
      AND ib.uuid IS NOT NULL AND ib.uuid <> ''
      AND ABS(COALESCE(ib.stock, 0) - COALESCE((
        SELECT SUM(sm.delta) FROM stock_movements sm
        WHERE sm.batch_uuid = ib.uuid AND sm.deleted_at IS NULL
      ), 0)) > 0.0001
    `
  );

  for (const g of gaps) {
    await appendMovement(db, {
      batchUuid: g.batch_uuid,
      productUuid: g.product_uuid,
      variantUuid: g.variant_uuid,
      delta: g.gap,
      reason: 'repair'
    });
  }

  return { repaired: gaps.length };
}

/**
 * فحص حالة الدفتر (cloud-sync:inspect-ledger)
 */
async function inspectLedger(db) {
  const byReason = await rawAll(
    db,
    'SELECT reason, COUNT(*) AS n FROM stock_movements WHERE deleted_at IS NULL GROUP BY reason ORDER BY n DESC'
  );
  const items = await rawAll(
    db,
    `
    SELECT
      ib.id,
      p.name AS product,
      p.unit AS unit,
      COALESCE(ib.stock, 0) AS cached,
      COALESCE((SELECT SUM(sm.delta) FROM stock_movements sm WHERE sm.batch_uuid = ib.uuid AND sm.deleted_at IS NULL), 0) AS ledger,
      COALESCE(ib.stock, 0) - COALESCE((SELECT SUM(sm.delta) FROM stock_movements sm WHERE sm.batch_uuid = ib.uuid AND sm.deleted_at IS NULL), 0) AS gap
    FROM inventory_batches ib
    LEFT JOIN products p ON p.id = ib.product_id
    WHERE ib.deleted_at IS NULL
    ORDER BY ABS(gap) DESC, ib.id DESC
    LIMIT 100
    `
  );

  return { byReason, items };
}

module.exports = {
  withSkipStockLedger,
  seedStartupMovements,
  appendMovement,
  reconcileBatchLedger,
  recomputeAllBatches,
  repairMissingMovements,
  inspectLedger
};