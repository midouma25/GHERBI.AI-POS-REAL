/**
 * batch-alloc.js
 * محرك تخصيص دفعات المخزون بطريقة الوارد أولاً يصرف أولاً (FIFO / FEFO)
 * وإدارة البيع بالسالب وتسوية ديون المخزون تلقائياً
 */

'use strict';

const RESTORE_STOCK_SQL = `
  UPDATE inventory_batches
  SET stock = stock + ?
  WHERE id = COALESCE(
    (SELECT id FROM inventory_batches WHERE id = ? AND deleted_at IS NULL),
    (
      SELECT b2.id FROM inventory_batches b2
      WHERE b2.product_id = (SELECT product_id FROM inventory_batches WHERE id = ?)
        AND b2.deleted_at IS NULL
      ORDER BY (b2.expiry_date IS NULL), b2.expiry_date ASC, b2.created_at ASC, b2.id ASC
      LIMIT 1
    )
  )
`;

function fetchFifoBatches(db, { productId, variantId = null, onlyPositive = false }, callback) {
  const params = [Number(productId)];
  let variantCond = '';

  if (variantId !== null && variantId !== undefined && variantId !== '') {
    variantCond = 'AND variant_id = ?';
    params.push(Number(variantId));
  }

  const positiveCond = onlyPositive ? 'AND COALESCE(stock, 0) > 0' : '';

  const sql = `
    SELECT
      id,
      uuid,
      product_id,
      variant_id,
      COALESCE(stock, 0) AS stock,
      COALESCE(cost_price, 0) AS cost_price,
      COALESCE(selling_price, 0) AS selling_price,
      wholesale_price,
      expiry_date,
      location,
      display_code,
      supplier_id,
      created_at
    FROM inventory_batches
    WHERE product_id = ?
      AND deleted_at IS NULL
      ${variantCond}
      ${positiveCond}
    ORDER BY (expiry_date IS NULL), expiry_date ASC, created_at ASC, id ASC
  `;

  if (typeof callback === 'function') {
    return db.all(sql, params, callback);
  }
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function deductFromBatch(db, options = {}, callback) {
  const work = async () => {
    const productId = Number(options.productId || options.product_id);
    const variantId = options.variantId !== undefined ? options.variantId : options.variant_id ?? null;
    const preferredBatchId = options.batchId !== undefined ? options.batchId : options.batch_id ?? null;
    const requestedQty = Number(options.quantity ?? 0);

    if (!productId || !Number.isFinite(requestedQty) || requestedQty === 0) {
      return {
        allocations: [],
        deductedQty: 0,
        shortfallQty: 0,
        soldWithoutStock: 0,
        primaryBatchId: preferredBatchId || null,
        costPrice: null
      };
    }

    // حالة إرجاع المبيعات (كمية سالبة)
    if (requestedQty < 0) {
      const returnQty = Math.abs(requestedQty);
      const batches = await fetchFifoBatches(db, { productId, variantId, onlyPositive: false });
      const targetBatch =
        (preferredBatchId && batches.find((b) => Number(b.id) === Number(preferredBatchId))) ||
        batches[0] ||
        null;

      if (targetBatch) {
        await db.dbRun('UPDATE inventory_batches SET stock = COALESCE(stock, 0) + ? WHERE id = ?', [
          returnQty,
          targetBatch.id
        ]);
      }

      return {
        allocations: [
          {
            batchId: targetBatch ? targetBatch.id : preferredBatchId,
            quantity: -returnQty,
            costPrice: targetBatch ? targetBatch.cost_price : null,
            soldWithoutStock: 0
          }
        ],
        deductedQty: -returnQty,
        shortfallQty: 0,
        soldWithoutStock: 0,
        primaryBatchId: targetBatch ? targetBatch.id : preferredBatchId,
        costPrice: targetBatch ? targetBatch.cost_price : null
      };
    }

    // حالة البيع القياسية (كمية موجبة)
    const batches = await fetchFifoBatches(db, { productId, variantId, onlyPositive: false });
    const ordered = batches.slice();

    if (preferredBatchId) {
      const idx = ordered.findIndex((b) => Number(b.id) === Number(preferredBatchId));
      if (idx > 0) {
        const [picked] = ordered.splice(idx, 1);
        ordered.unshift(picked);
      }
    }

    let remaining = requestedQty;
    const allocations = [];

    for (const batch of ordered) {
      if (remaining <= 0) break;
      const avail = Math.max(0, Number(batch.stock || 0));
      if (avail <= 0) continue;

      const take = Math.min(avail, remaining);
      await db.dbRun('UPDATE inventory_batches SET stock = COALESCE(stock, 0) - ? WHERE id = ?', [
        take,
        batch.id
      ]);

      allocations.push({
        batchId: batch.id,
        variantId: batch.variant_id ?? variantId ?? null,
        quantity: take,
        costPrice: batch.cost_price,
        sellingPrice: batch.selling_price,
        soldWithoutStock: 0
      });

      remaining = Number((remaining - take).toFixed(6));
    }

    let shortfallQty = 0;
    if (remaining > 0.000001) {
      shortfallQty = remaining;
      const fallback =
        (preferredBatchId && ordered.find((b) => Number(b.id) === Number(preferredBatchId))) ||
        ordered[0] ||
        null;

      allocations.push({
        batchId: fallback ? fallback.id : preferredBatchId || null,
        variantId: fallback ? fallback.variant_id : variantId || null,
        quantity: shortfallQty,
        costPrice: fallback ? fallback.cost_price : null,
        sellingPrice: fallback ? fallback.selling_price : null,
        soldWithoutStock: 1
      });
    }

    const primaryBatchId =
      allocations.length > 0
        ? allocations[0].batchId
        : preferredBatchId || (ordered[0] && ordered[0].id) || null;

    const primaryCost =
      allocations.length > 0 && allocations[0].costPrice !== null
        ? allocations[0].costPrice
        : ordered[0]
          ? ordered[0].cost_price
          : null;

    return {
      allocations,
      deductedQty: Number((requestedQty - shortfallQty).toFixed(6)),
      shortfallQty,
      soldWithoutStock: shortfallQty > 0 ? 1 : 0,
      primaryBatchId,
      costPrice: primaryCost
    };
  };

  if (typeof callback === 'function') {
    work().then((r) => callback(null, r)).catch((e) => callback(e));
    return;
  }
  return work();
}

async function restoreBatch(db, { batchId, quantity, soldWithoutStock = 0 }, callback) {
  const work = async () => {
    const qty = Number(quantity || 0);
    if (!batchId || !Number.isFinite(qty) || qty === 0 || Number(soldWithoutStock) === 1) {
      return { restored: 0 };
    }
    const res = await db.dbRun(RESTORE_STOCK_SQL, [qty, batchId, batchId]);
    return { restored: qty, changes: res.changes };
  };

  if (typeof callback === 'function') {
    work().then((r) => callback(null, r)).catch((e) => callback(e));
    return;
  }
  return work();
}

async function reconcileStockDebt(db, productId, targetBatchId = null, callback) {
  const work = async () => {
    if (!productId) return { reconciled: 0 };

    const openDebts = await db.dbAll(
      `SELECT id, quantity, batch_id, variant_id, sale_id
       FROM stock_debt
       WHERE product_id = ? AND resolved = 0 AND deleted_at IS NULL
       ORDER BY created_at ASC, id ASC`,
      [Number(productId)]
    );

    if (openDebts.length === 0) return { reconciled: 0 };

    const batchParams = [Number(productId)];
    let batchCond = '';
    if (targetBatchId) {
      batchCond = 'AND id = ?';
      batchParams.push(Number(targetBatchId));
    }

    const batches = await db.dbAll(
      `SELECT id, stock, variant_id
       FROM inventory_batches
       WHERE product_id = ? AND deleted_at IS NULL AND COALESCE(stock, 0) > 0
       ${batchCond}
       ORDER BY (expiry_date IS NULL), expiry_date ASC, created_at ASC, id ASC`,
      batchParams
    );

    if (batches.length === 0) return { reconciled: 0 };

    let totalReconciled = 0;
    const nowIso = new Date().toISOString();

    for (const batch of batches) {
      let avail = Number(batch.stock || 0);
      if (avail <= 0) continue;

      for (const debt of openDebts) {
        if (avail <= 0) break;
        if (debt._done) continue;
        if (batch.variant_id && debt.variant_id && Number(batch.variant_id) !== Number(debt.variant_id)) {
          continue;
        }

        const debtQty = Number(debt.quantity || 0);
        if (debtQty <= 0) continue;

        if (avail >= debtQty) {
          await db.dbRun('UPDATE inventory_batches SET stock = stock - ? WHERE id = ?', [debtQty, batch.id]);
          await db.dbRun('UPDATE stock_debt SET resolved = 1, resolved_at = ? WHERE id = ?', [nowIso, debt.id]);
          avail = Number((avail - debtQty).toFixed(6));
          debt._done = true;
          totalReconciled = Number((totalReconciled + debtQty).toFixed(6));
        } else {
          const partial = avail;
          const rem = Number((debtQty - partial).toFixed(6));
          await db.dbRun('UPDATE inventory_batches SET stock = stock - ? WHERE id = ?', [partial, batch.id]);
          await db.dbRun('UPDATE stock_debt SET quantity = ?, resolved = 1, resolved_at = ? WHERE id = ?', [
            partial,
            nowIso,
            debt.id
          ]);
          await db.dbRun(
            'INSERT INTO stock_debt (product_id, variant_id, batch_id, sale_id, quantity) VALUES (?, ?, ?, ?, ?)',
            [Number(productId), debt.variant_id || null, debt.batch_id || batch.id, debt.sale_id || null, rem]
          );
          debt.quantity = rem;
          avail = 0;
          totalReconciled = Number((totalReconciled + partial).toFixed(6));
        }
      }
    }

    return { reconciled: totalReconciled };
  };

  if (typeof callback === 'function') {
    work().then((r) => callback(null, r)).catch((e) => callback(e));
    return;
  }
  return work();
}

async function voidBatches(db, batchIds = [], options = {}, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  const work = async () => {
    const cleanIds = Array.from(
      new Set((Array.isArray(batchIds) ? batchIds : [batchIds]).map(Number).filter(Boolean))
    );
    if (cleanIds.length === 0) {
      return { blocked: false, voidedIds: [], deletedIds: [], soldBatchIds: [] };
    }

    const placeholders = cleanIds.map(() => '?').join(',');
    const soldRows = await db.dbAll(
      `SELECT DISTINCT batch_id FROM sale_items WHERE batch_id IN (${placeholders}) AND deleted_at IS NULL`,
      cleanIds
    );
    const soldBatchIds = soldRows.map((r) => Number(r.batch_id)).filter(Boolean);

    if (options.refuseIfSold && soldBatchIds.length > 0) {
      return { blocked: true, soldBatchIds, voidedIds: [], deletedIds: [] };
    }

    await db.dbRun(
      `UPDATE inventory_batches SET stock = 0 WHERE id IN (${placeholders}) AND deleted_at IS NULL AND COALESCE(stock, 0) <> 0`,
      cleanIds
    );

    const deletableIds = options.keepSoldRowsActive
      ? cleanIds.filter((id) => !soldBatchIds.includes(id))
      : cleanIds;

    if (deletableIds.length > 0) {
      await db.dbRun(
        `DELETE FROM inventory_batches WHERE id IN (${deletableIds.map(() => '?').join(',')})`,
        deletableIds
      );
    }

    return { blocked: false, soldBatchIds, voidedIds: cleanIds, deletedIds: deletableIds };
  };

  if (typeof callback === 'function') {
    work().then((r) => callback(null, r)).catch((e) => callback(e));
    return;
  }
  return work();
}

module.exports = {
  RESTORE_STOCK_SQL,
  fetchFifoBatches,
  deductFromBatch,
  restoreBatch,
  reconcileStockDebt,
  voidBatches
};