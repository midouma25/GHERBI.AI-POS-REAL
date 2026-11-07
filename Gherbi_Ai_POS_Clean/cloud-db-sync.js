/**
 * cloud-db-sync.js
 * محرك المزامنة السحابية الثنائية الكامل لقاعدة البيانات (100% Bi-Directional LWW Cloud DB Sync)
 * يدعم: sale_replay، recomputeBatchSet، resolvePendingFkFixups، sync_row_errors، pull_row_errors، و Fresh Bootstrap
 */

'use strict';

const { signedRequest } = require('./device-auth');
const stockLedger = require('./stock-ledger');

const SYNC_TABLES_ORDER = [
  'shop_info',
  'users',
  'custom_templates',
  'suppliers',
  'customers',
  'loyalty_transactions',
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
  'inventory_batches',
  'product_serials',
  'stock_movements',
  'stock_debt',
  'bom_recipes',
  'bom_components',
  'production_orders',
  'production_order_items',
  'stocktakes',
  'stocktake_items',
  'caisse_sessions',
  'sales',
  'sale_items',
  'sale_payments',
  'proforma_invoices',
  'proforma_items',
  'customer_orders',
  'customer_order_items',
  'inventory_reservations',
  'purchase_invoices',
  'purchase_items',
  'invoice_payments',
  'supplier_returns',
  'supplier_return_items',
  'expenses',
  'capital_injections',
  'caisse_transactions',
  'warehouses',
  'stock_transfers',
  'stock_transfer_items',
  'installment_contracts',
  'installment_schedules',
  'ccp_reconciliation_logs',
  'drivers',
  'delivery_shipments',
  'discount_coupons',
  'employees',
  'payroll_payments',
  'service_tickets',
  'system_audit_logs',
  'installment_plans',
  'installment_schedules',
  'cheques_portfolio',
  'audit_logs'
];

const IMAGE_TABLES = ['products', 'product_variants', 'product_bundles'];

function createCloudDbSync({ db, getSetting, setSetting, getMainWindow }) {
  let pushTimer = null;
  let pullTimer = null;
  let isSyncing = false;
  let lastStatus = {
    enabled: false,
    syncing: false,
    lastPushAt: null,
    lastPullAt: null,
    lastError: null,
    dirtyCount: 0
  };

  function rawGet(sql, params = []) {
    const fn = db._rawGet ? db._rawGet.bind(db) : db.get.bind(db);
    return new Promise((resolve, reject) => {
      fn(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  }

  function rawAll(sql, params = []) {
    const fn = db._rawAll ? db._rawAll.bind(db) : db.all.bind(db);
    return new Promise((resolve, reject) => {
      fn(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
  }

  function rawRun(sql, params = []) {
    const fn = db._rawRun ? db._rawRun.bind(db) : db.run.bind(db);
    return new Promise((resolve, reject) => {
      fn(sql, params, function onDone(err) {
        if (err) return reject(err);
        resolve({ lastID: this ? this.lastID : null, changes: this ? this.changes : 0 });
      });
    });
  }

  function emitStatus() {
    const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('cloud-sync:status', lastStatus);
    }
  }

  function emitDataChanged(changedTables = []) {
    const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('cloud-sync:data-changed', { tables: changedTables });
    }
  }

  async function countTotalDirty() {
    let total = 0;
    for (const tbl of SYNC_TABLES_ORDER) {
      try {
        const r = await rawGet(`SELECT COUNT(*) AS n FROM ${tbl} WHERE dirty = 1`);
        total += Number((r && r.n) || 0);
      } catch (_) {}
    }
    lastStatus.dirtyCount = total;
    return total;
  }

  async function gatherTableBatch(tableName, limit = 150) {
    const nowMs = Date.now();
    return await rawAll(
      `
      SELECT t.*
      FROM ${tableName} t
      LEFT JOIN sync_row_errors qe ON qe.table_name = ? AND qe.uuid = t.uuid
      WHERE t.dirty = 1
        AND t.uuid IS NOT NULL AND t.uuid <> ''
        AND (qe.next_retry_ms IS NULL OR qe.next_retry_ms <= ?)
      ORDER BY t.id ASC
      LIMIT ?
      `,
      [tableName, nowMs, limit]
    );
  }

  async function ensureStockMovementForSaleItem(saleItemRow) {
    if (!saleItemRow || !saleItemRow.uuid) return null;
    if (Number(saleItemRow.sold_without_stock || 0) === 1) return null;

    const existing = await rawGet(
      "SELECT id FROM stock_movements WHERE ref_type = 'sale_item' AND ref_uuid = ? LIMIT 1",
      [saleItemRow.uuid]
    );
    if (existing) return null;

    if (!saleItemRow.batch_id) return null;
    const batchRow = await rawGet(
      'SELECT uuid, product_id, variant_id FROM inventory_batches WHERE id = ?',
      [saleItemRow.batch_id]
    );
    if (!batchRow || !batchRow.uuid) return null;

    const prodRow = batchRow.product_id
      ? await rawGet('SELECT uuid FROM products WHERE id = ?', [batchRow.product_id])
      : null;
    const varRow = batchRow.variant_id
      ? await rawGet('SELECT uuid FROM product_variants WHERE id = ?', [batchRow.variant_id])
      : null;

    const delta = -Math.abs(Number(saleItemRow.quantity || 0));
    if (Math.abs(delta) < 0.000001) return null;

    const nowStr = new Date().toISOString();
    await rawRun(
      `
      INSERT INTO stock_movements (
        uuid, batch_uuid, product_uuid, variant_uuid, delta, reason,
        ref_type, ref_uuid, origin_device, occurred_at, updated_at, dirty
      ) VALUES (
        lower(hex(randomblob(16))), ?, ?, ?, ?, 'sale_replay',
        'sale_item', ?, ?, ?, ?, 0
      )
      `,
      [
        batchRow.uuid,
        prodRow ? prodRow.uuid : null,
        varRow ? varRow.uuid : null,
        delta,
        saleItemRow.uuid,
        saleItemRow.origin_device || 'cloud-replay',
        saleItemRow.updated_at || nowStr,
        nowStr
      ]
    );

    return batchRow.uuid;
  }

  async function recomputeBatchSet(batchUuids = []) {
    const unique = Array.from(new Set((batchUuids || []).filter(Boolean)));
    if (unique.length === 0) return;

    await stockLedger.withSkipStockLedger(db, async () => {
      for (const bUuid of unique) {
        await rawRun(
          `
          UPDATE inventory_batches
          SET stock = COALESCE((
            SELECT SUM(delta) FROM stock_movements
            WHERE batch_uuid = ? AND deleted_at IS NULL
          ), 0)
          WHERE uuid = ?
          `,
          [bUuid, bUuid]
        );
      }
    });
  }

  async function resolvePendingFkFixups() {
    const fixups = await rawAll('SELECT * FROM pending_fk_fixups ORDER BY id ASC LIMIT 500');
    for (const fx of fixups) {
      try {
        const parentRow = await rawGet(`SELECT id FROM ${fx.parent_table} WHERE uuid = ?`, [
          fx.parent_uuid
        ]);
        if (parentRow && parentRow.id) {
          await rawRun(`UPDATE ${fx.tbl} SET ${fx.fk_col} = ? WHERE uuid = ?`, [
            parentRow.id,
            fx.row_uuid
          ]);
          await rawRun('DELETE FROM pending_fk_fixups WHERE id = ?', [fx.id]);
        }
      } catch (_) {}
    }
  }

  async function applyPulledRow(tableName, rowData) {
    if (!rowData || !rowData.uuid) return false;
    const colInfo = await rawAll(`PRAGMA table_info(${tableName})`);
    const validCols = new Set(colInfo.map((c) => c.name));

    const cols = [];
    const vals = [];
    for (const [k, v] of Object.entries(rowData)) {
      if (k === 'id') continue;
      if (validCols.has(k)) {
        cols.push(k);
        vals.push(v);
      }
    }

    if (validCols.has('dirty')) {
      const idx = cols.indexOf('dirty');
      if (idx === -1) {
        cols.push('dirty');
        vals.push(0);
      } else {
        vals[idx] = 0;
      }
    }

    const placeholders = cols.map(() => '?').join(', ');
    const updates = cols
      .filter((c) => c !== 'uuid')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');

    await rawRun(
      `
      INSERT INTO ${tableName} (${cols.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(uuid) DO UPDATE SET
        ${updates}
      WHERE ${tableName}.updated_at IS NULL
         OR excluded.updated_at IS NULL
         OR datetime(excluded.updated_at) >= datetime(${tableName}.updated_at)
      `,
      vals
    );
    return true;
  }

  async function pushDirtyRows() {
    const payloadTables = {};
    let totalGathered = 0;

    for (const tbl of SYNC_TABLES_ORDER) {
      const rows = await gatherTableBatch(tbl, 150);
      if (rows.length > 0) {
        payloadTables[tbl] = rows;
        totalGathered += rows.length;
      }
      if (totalGathered >= 400) break;
    }

    if (totalGathered === 0) return { pushed: 0 };

    const res = await signedRequest(db, {
      method: 'POST',
      path: '/api/cloud/sync/push',
      data: { tables: payloadTables }
    });

    const accepted = (res && res.accepted) || {};
    const rejected = (res && res.rejected) || {};

    for (const [tbl, uuids] of Object.entries(accepted)) {
      if (Array.isArray(uuids) && uuids.length > 0) {
        const ph = uuids.map(() => '?').join(',');
        await rawRun(`UPDATE ${tbl} SET dirty = 0 WHERE uuid IN (${ph})`, uuids);
        await rawRun(`DELETE FROM sync_row_errors WHERE table_name = ? AND uuid IN (${ph})`, [
          tbl,
          ...uuids
        ]);
      }
    }

    for (const [tbl, errItems] of Object.entries(rejected)) {
      for (const item of Array.isArray(errItems) ? errItems : []) {
        const nextRetry = Date.now() + 60000;
        await rawRun(
          `
          INSERT INTO sync_row_errors (table_name, uuid, attempts, last_error, next_retry_ms)
          VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(table_name, uuid) DO UPDATE SET
            attempts = sync_row_errors.attempts + 1,
            last_error = excluded.last_error,
            next_retry_ms = excluded.next_retry_ms
          `,
          [tbl, item.uuid || 'unknown', String(item.error || 'rejected'), nextRetry]
        );
      }
    }

    lastStatus.lastPushAt = new Date().toISOString();
    return { pushed: totalGathered };
  }

  async function pullRemoteChanges() {
    const cursorRows = await rawAll('SELECT table_name, last_rev FROM sync_cursors');
    const cursors = {};
    for (const r of cursorRows) cursors[r.table_name] = Number(r.last_rev || 0);

    const encoded = encodeURIComponent(JSON.stringify(cursors));
    const res = await signedRequest(db, {
      method: 'GET',
      path: `/api/cloud/sync/pull?cursors=${encoded}&include_self=1`
    });
    if (!res) return { pulled: 0 };

    const localEpoch = await getSetting('cloud_sync_epoch', '');
    if (res.epoch && localEpoch && String(res.epoch) !== String(localEpoch)) {
      await rawRun('DELETE FROM sync_cursors');
      await rawRun('DELETE FROM pending_fk_fixups');
      await rawRun('DELETE FROM pull_row_errors');
    }
    if (res.epoch && typeof setSetting === 'function') {
      await setSetting('cloud_sync_epoch', String(res.epoch));
    }

    const serverTables = (res && res.tables) || {};
    const touchedBatchUuids = [];
    const changedTables = [];
    let totalPulled = 0;

    await stockLedger.withSkipStockLedger(db, async () => {
      for (const tbl of SYNC_TABLES_ORDER) {
        const tData = serverTables[tbl];
        if (!tData || !Array.isArray(tData.rows) || tData.rows.length === 0) continue;

        changedTables.push(tbl);
        let maxRev = cursors[tbl] || 0;

        for (const row of tData.rows) {
          try {
            await applyPulledRow(tbl, row);
            totalPulled += 1;

            if (tbl === 'stock_movements' && row.batch_uuid) {
              touchedBatchUuids.push(row.batch_uuid);
            } else if (tbl === 'sale_items') {
              const replayBatchUuid = await ensureStockMovementForSaleItem(row);
              if (replayBatchUuid) touchedBatchUuids.push(replayBatchUuid);
            }

            if (row.server_rev && Number(row.server_rev) > maxRev) {
              maxRev = Number(row.server_rev);
            }
          } catch (err) {
            await rawRun(
              `
              INSERT INTO pull_row_errors (table_name, uuid, payload, attempts, last_error, next_retry_ms)
              VALUES (?, ?, ?, 1, ?, ?)
              ON CONFLICT(table_name, uuid) DO UPDATE SET
                payload = excluded.payload,
                attempts = pull_row_errors.attempts + 1,
                last_error = excluded.last_error,
                next_retry_ms = excluded.next_retry_ms
              `,
              [tbl, row.uuid || 'unknown', JSON.stringify(row), err.message, Date.now() + 30000]
            );
          }
        }

        await rawRun(
          `INSERT INTO sync_cursors (table_name, last_rev, last_pulled_at)
           VALUES (?, ?, ?)
           ON CONFLICT(table_name) DO UPDATE SET last_rev = excluded.last_rev, last_pulled_at = excluded.last_pulled_at`,
          [tbl, maxRev, new Date().toISOString()]
        );
      }
    });

    await resolvePendingFkFixups();

    if (touchedBatchUuids.length > 0) {
      await recomputeBatchSet(touchedBatchUuids);
    }

    if (changedTables.length > 0) {
      emitDataChanged(changedTables);
    }
    lastStatus.lastPullAt = new Date().toISOString();
    return { pulled: totalPulled, changedTables };
  }

  async function triggerNow() {
    const token = await getSetting('cloud_token', '');
    if (!token) {
      lastStatus.enabled = false;
      emitStatus();
      return { ok: false, reason: 'no_cloud_token' };
    }
    if (isSyncing) return { ok: true, busy: true };

    isSyncing = true;
    lastStatus.enabled = true;
    lastStatus.syncing = true;
    emitStatus();

    try {
      const pushRes = await pushDirtyRows();
      const pullRes = await pullRemoteChanges();
      await countTotalDirty();
      lastStatus.lastError = null;
      return { ok: true, ...pushRes, ...pullRes };
    } catch (err) {
      lastStatus.lastError = err.message;
      return { ok: false, error: err.message };
    } finally {
      isSyncing = false;
      lastStatus.syncing = false;
      emitStatus();
    }
  }

  async function runFreshBootstrap() {
    await rawRun('DELETE FROM fresh_bootstrap_images');
    for (const tbl of IMAGE_TABLES) {
      await rawRun(
        `INSERT OR REPLACE INTO fresh_bootstrap_images (tbl, uuid, image)
         SELECT ?, uuid, image FROM ${tbl}
         WHERE image IS NOT NULL AND image != '' AND uuid IS NOT NULL AND uuid != ''`,
        [tbl]
      );
    }

    const tablesToWipe = [...SYNC_TABLES_ORDER].reverse().filter((t) => t !== 'users');
    await stockLedger.withSkipStockLedger(db, async () => {
      for (const tbl of tablesToWipe) {
        await rawRun(`DELETE FROM ${tbl}`);
      }
      await rawRun('DELETE FROM sync_cursors');
      await rawRun('DELETE FROM sync_row_errors');
      await rawRun('DELETE FROM pull_row_errors');
      await rawRun('DELETE FROM pending_fk_fixups');
      await rawRun("DELETE FROM settings WHERE key = 'cloud_sync_epoch'");
    });

    let pages = 0;
    while (pages < 50) {
      const pullRes = await pullRemoteChanges();
      pages += 1;
      if (!pullRes || pullRes.pulled === 0) break;
    }

    for (const tbl of IMAGE_TABLES) {
      await rawRun(
        `UPDATE fresh_bootstrap_images
         SET
           post_updated_at = (SELECT r.updated_at FROM ${tbl} r WHERE r.uuid = fresh_bootstrap_images.uuid),
           post_dirty = (SELECT r.dirty FROM ${tbl} r WHERE r.uuid = fresh_bootstrap_images.uuid),
           post_origin = (SELECT r.origin_device FROM ${tbl} r WHERE r.uuid = fresh_bootstrap_images.uuid)
         WHERE tbl = ?`,
        [tbl]
      );

      await rawRun(
        `UPDATE ${tbl}
         SET image = (SELECT b.image FROM fresh_bootstrap_images b WHERE b.tbl = ? AND b.uuid = ${tbl}.uuid)
         WHERE (image IS NULL OR image = '') AND uuid IN (SELECT uuid FROM fresh_bootstrap_images WHERE tbl = ?)`,
        [tbl, tbl]
      );

      await rawRun(
        `UPDATE ${tbl}
         SET
           updated_at = COALESCE((SELECT b.post_updated_at FROM fresh_bootstrap_images b WHERE b.tbl = ? AND b.uuid = ${tbl}.uuid), updated_at),
           dirty = COALESCE((SELECT b.post_dirty FROM fresh_bootstrap_images b WHERE b.tbl = ? AND b.uuid = ${tbl}.uuid), 0)
         WHERE uuid IN (SELECT uuid FROM fresh_bootstrap_images WHERE tbl = ?)`,
        [tbl, tbl, tbl]
      );
    }

    await rawRun('DELETE FROM fresh_bootstrap_images');
    await stockLedger.recomputeAllBatches(db);
    return { ok: true, pagesPulled: pages };
  }

  function start() {
    stop();
    lastStatus.enabled = true;
    pushTimer = setInterval(() => triggerNow(), 8000);
    pullTimer = setInterval(() => triggerNow(), 15000);
    setTimeout(() => triggerNow(), 1500);
  }

  function stop() {
    if (pushTimer) clearInterval(pushTimer);
    if (pullTimer) clearInterval(pullTimer);
    pushTimer = null;
    pullTimer = null;
    lastStatus.enabled = false;
    emitStatus();
  }

  return {
    start,
    stop,
    triggerNow,
    getStatus: async () => {
      await countTotalDirty();
      return lastStatus;
    },
    setMode: async (mode) => {
      if (mode === 'cloud' || mode === 'both') start();
      else stop();
      return lastStatus;
    },
    pushSnapshot: async () => {
      for (const tbl of SYNC_TABLES_ORDER) {
        await rawRun(`UPDATE ${tbl} SET dirty = 1 WHERE deleted_at IS NULL`);
      }
      return await triggerNow();
    },
    wipeCloudData: async () => {
      const res = await signedRequest(db, { method: 'POST', path: '/api/cloud/sync/wipe', data: {} });
      await rawRun('DELETE FROM sync_cursors');
      return res || { ok: true };
    },
    runFreshBootstrap,
    backfillFromOwner: async () => {
      await stockLedger.repairMissingMovements(db);
      return await triggerNow();
    },
    resetAndResync: async () => {
      await rawRun('DELETE FROM sync_cursors');
      return await triggerNow();
    }
  };
}

module.exports = {
  SYNC_TABLES_ORDER,
  createCloudDbSync
};
