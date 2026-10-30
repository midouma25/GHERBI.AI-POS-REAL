/**
 * cloud-db-sync.js
 * محرك المزامنة السحابية الثنائية للجداول (Bi-Directional LWW Cloud DB Sync)
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
  'caisse_transactions'
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
        const r = await db.dbGet(`SELECT COUNT(*) AS n FROM ${tbl} WHERE dirty = 1`);
        total += Number((r && r.n) || 0);
      } catch (_) {}
    }
    lastStatus.dirtyCount = total;
    return total;
  }

  async function gatherTableBatch(tableName, limit = 150) {
    const nowMs = Date.now();
    return await db.dbAll(
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

  async function applyPulledRow(tableName, rowData) {
    if (!rowData || !rowData.uuid) return false;
    const colInfo = await db.dbAll(`PRAGMA table_info(${tableName})`);
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

    await db.dbRun(
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
    for (const [tbl, uuids] of Object.entries(accepted)) {
      if (Array.isArray(uuids) && uuids.length > 0) {
        const ph = uuids.map(() => '?').join(',');
        await db.dbRun(`UPDATE ${tbl} SET dirty = 0 WHERE uuid IN (${ph})`, uuids);
        await db.dbRun(`DELETE FROM sync_row_errors WHERE table_name = ? AND uuid IN (${ph})`, [tbl, ...uuids]);
      }
    }

    lastStatus.lastPushAt = new Date().toISOString();
    return { pushed: totalGathered };
  }

  async function pullRemoteChanges() {
    const cursorRows = await db.dbAll('SELECT table_name, last_rev FROM sync_cursors');
    const cursors = {};
    for (const r of cursorRows) cursors[r.table_name] = Number(r.last_rev || 0);

    const encoded = encodeURIComponent(JSON.stringify(cursors));
    const res = await signedRequest(db, {
      method: 'GET',
      path: `/api/cloud/sync/pull?cursors=${encoded}&include_self=1`
    });
    if (!res) return { pulled: 0 };

    const serverTables = (res && res.tables) || {};
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
            if (row.server_rev && Number(row.server_rev) > maxRev) {
              maxRev = Number(row.server_rev);
            }
          } catch (_) {}
        }

        await db.dbRun(
          `INSERT INTO sync_cursors (table_name, last_rev, last_pulled_at)
           VALUES (?, ?, ?)
           ON CONFLICT(table_name) DO UPDATE SET last_rev = excluded.last_rev, last_pulled_at = excluded.last_pulled_at`,
          [tbl, maxRev, new Date().toISOString()]
        );
      }
    });

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
    await db.dbRun('DELETE FROM fresh_bootstrap_images');
    for (const tbl of IMAGE_TABLES) {
      await db.dbRun(
        `INSERT OR REPLACE INTO fresh_bootstrap_images (tbl, uuid, image)
         SELECT ?, uuid, image FROM ${tbl}
         WHERE image IS NOT NULL AND image != '' AND uuid IS NOT NULL AND uuid != ''`,
        [tbl]
      );
    }

    const tablesToWipe = [...SYNC_TABLES_ORDER].reverse().filter((t) => t !== 'users');
    await stockLedger.withSkipStockLedger(db, async () => {
      for (const tbl of tablesToWipe) {
        await db.dbRun(`DELETE FROM ${tbl}`);
      }
      await db.dbRun('DELETE FROM sync_cursors');
    });

    let pages = 0;
    while (pages < 50) {
      const pullRes = await pullRemoteChanges();
      pages += 1;
      if (!pullRes || pullRes.pulled === 0) break;
    }

    for (const tbl of IMAGE_TABLES) {
      await db.dbRun(
        `UPDATE ${tbl}
         SET image = (SELECT b.image FROM fresh_bootstrap_images b WHERE b.tbl = ? AND b.uuid = ${tbl}.uuid)
         WHERE (image IS NULL OR image = '') AND uuid IN (SELECT uuid FROM fresh_bootstrap_images WHERE tbl = ?)`,
        [tbl, tbl]
      );
    }

    await db.dbRun('DELETE FROM fresh_bootstrap_images');
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
        await db.dbRun(`UPDATE ${tbl} SET dirty = 1 WHERE deleted_at IS NULL`);
      }
      return await triggerNow();
    },
    wipeCloudData: async () => {
      const res = await signedRequest(db, { method: 'POST', path: '/api/cloud/sync/wipe', data: {} });
      await db.dbRun('DELETE FROM sync_cursors');
      return res || { ok: true };
    },
    runFreshBootstrap,
    backfillFromOwner: async () => {
      await stockLedger.repairMissingMovements(db);
      return await triggerNow();
    },
    resetAndResync: async () => {
      await db.dbRun('DELETE FROM sync_cursors');
      return await triggerNow();
    }
  };
}

module.exports = {
  SYNC_TABLES_ORDER,
  createCloudDbSync
};