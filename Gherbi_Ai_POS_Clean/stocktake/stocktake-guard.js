/**
 * stocktake/stocktake-guard.js
 * محرك الجرد المخزني الفعلي (Physical Stocktake Sheet, Variance Calculation & Batch Stock Reconciliation)
 */

'use strict';

function resolveHelpers(ctx) {
  const db = ctx && ctx.db ? ctx.db : ctx;
  const dbGet = (sql, params = []) => {
    if (ctx && typeof ctx.dbGet === 'function') return ctx.dbGet(sql, params);
    if (db && typeof db.dbGet === 'function') return db.dbGet(sql, params);
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  };
  const dbAll = (sql, params = []) => {
    if (ctx && typeof ctx.dbAll === 'function') return ctx.dbAll(sql, params);
    if (db && typeof db.dbAll === 'function') return db.dbAll(sql, params);
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
  };
  const dbRun = (sql, params = []) => {
    if (ctx && typeof ctx.dbRun === 'function') return ctx.dbRun(sql, params);
    if (db && typeof db.dbRun === 'function') return db.dbRun(sql, params);
    return new Promise((resolve, reject) => {
      db.run(sql, params, function onDone(err) {
        if (err) return reject(err);
        resolve({ lastID: this ? this.lastID : null, changes: this ? this.changes : 0 });
      });
    });
  };
  const withTx = (workFn) => {
    if (db && typeof db.withTransaction === 'function') {
      return db.withTransaction((tx) => workFn(tx));
    }
    return workFn({ db, dbGet, dbAll, dbRun });
  };
  const nextNumber = async (docType = 'stocktake') => {
    if (ctx && typeof ctx.nextNumber === 'function') return ctx.nextNumber(docType);
    if (db && typeof db.nextNumber === 'function') return db.nextNumber(docType);
    return `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  };

  return { db, dbGet, dbAll, dbRun, withTx, nextNumber };
}

/**
 * 1. تحميل ورقة الجرد الحالية (Stocktake Sheet) مع التصفية حسب الفئة أو العائلة أو البحث
 */
async function loadSheet(ctx, filters = {}) {
  const { dbAll } = resolveHelpers(ctx);
  const scopeType = String(filters.scopeType || filters.scope_type || 'all').toLowerCase();
  const scopeValue = filters.scopeValue || filters.scope_value || filters.category || filters.family || '';
  const search = filters.search ? String(filters.search).trim() : '';

  const conds = ['p.deleted_at IS NULL'];
  const params = [];

  if (scopeType === 'category' && scopeValue) {
    conds.push('p.category = ?');
    params.push(String(scopeValue));
  } else if (scopeType === 'family' && scopeValue) {
    conds.push('p.family = ?');
    params.push(String(scopeValue));
  } else if (filters.category) {
    conds.push('p.category = ?');
    params.push(String(filters.category));
  } else if (filters.family) {
    conds.push('p.family = ?');
    params.push(String(filters.family));
  }

  if (search) {
    conds.push('(p.name LIKE ? OR p.barcode LIKE ? OR p.category LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const rows = await dbAll(
    `
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.barcode,
      p.category,
      p.family,
      p.unit,
      ib.id AS batch_id,
      ib.variant_id,
      ib.expiry_date,
      ib.location,
      COALESCE(ib.cost_price, 0) AS cost_price,
      COALESCE(ib.selling_price, 0) AS selling_price,
      COALESCE(ib.stock, 0) AS book_qty
    FROM products p
    LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.deleted_at IS NULL
    WHERE ${conds.join(' AND ')}
    ORDER BY p.name COLLATE NOCASE ASC, ib.id ASC
    `,
    params
  );

  return rows;
}

/**
 * 2. عرض سجل عمليات الجرد السابقة
 */
async function listStocktakes(ctx, filters = {}) {
  const { dbAll } = resolveHelpers(ctx);
  const conds = ['st.deleted_at IS NULL'];
  const params = [];

  if (filters.status) {
    conds.push('st.status = ?');
    params.push(String(filters.status));
  }
  if (filters.dateFrom || filters.date_from) {
    conds.push('date(COALESCE(st.closed_at, st.started_at, st.created_at)) >= date(?)');
    params.push(String(filters.dateFrom || filters.date_from).slice(0, 10));
  }
  if (filters.dateTo || filters.date_to) {
    conds.push('date(COALESCE(st.closed_at, st.started_at, st.created_at)) <= date(?)');
    params.push(String(filters.dateTo || filters.date_to).slice(0, 10));
  }

  return await dbAll(
    `
    SELECT
      st.*,
      u.name AS user_name,
      (SELECT COUNT(*) FROM stocktake_items sti WHERE sti.stocktake_id = st.id AND sti.deleted_at IS NULL) AS items_count,
      (
        SELECT COUNT(*) FROM stocktake_items sti2
        WHERE sti2.stocktake_id = st.id
          AND sti2.deleted_at IS NULL
          AND sti2.counted_qty IS NOT NULL
          AND ABS(COALESCE(sti2.counted_qty, 0) - COALESCE(sti2.book_qty, 0)) > 0.0001
      ) AS discrepancies_count
    FROM stocktakes st
    LEFT JOIN users u ON u.id = st.user_id
    WHERE ${conds.join(' AND ')}
    ORDER BY st.id DESC
    LIMIT 200
    `,
    params
  );
}

/**
 * 3. جلب تفاصيل عملية جرد محددة مع كافة أسطرها وفروقاتها المالية
 */
async function getStocktake(ctx, stocktakeId) {
  const { dbGet, dbAll } = resolveHelpers(ctx);
  const id = Number(
    stocktakeId && typeof stocktakeId === 'object'
      ? stocktakeId.id || stocktakeId.stocktakeId
      : stocktakeId
  );

  const stocktake = await dbGet(
    `
    SELECT st.*, u.name AS user_name
    FROM stocktakes st
    LEFT JOIN users u ON u.id = st.user_id
    WHERE st.id = ? AND st.deleted_at IS NULL
    `,
    [id]
  );
  if (!stocktake) return null;

  const items = await dbAll(
    `
    SELECT
      sti.*,
      p.name AS product_name,
      p.barcode,
      p.category,
      p.unit,
      ib.expiry_date,
      ib.location,
      COALESCE(ib.cost_price, 0) AS cost_price,
      COALESCE(ib.selling_price, 0) AS selling_price,
      (COALESCE(sti.counted_qty, sti.book_qty) - COALESCE(sti.book_qty, 0)) AS diff_qty,
      ((COALESCE(sti.counted_qty, sti.book_qty) - COALESCE(sti.book_qty, 0)) * COALESCE(ib.cost_price, 0)) AS diff_cost_value
    FROM stocktake_items sti
    LEFT JOIN products p ON p.id = sti.product_id
    LEFT JOIN inventory_batches ib ON ib.id = sti.batch_id
    WHERE sti.stocktake_id = ? AND sti.deleted_at IS NULL
    ORDER BY p.name COLLATE NOCASE ASC, sti.id ASC
    `,
    [id]
  );

  stocktake.items = items;
  return stocktake;
}

/**
 * 4. اعتماد وحفظ جلسة جرد مخزني وتعديل أرصدة الدفعات آلياً بالكميات الفعلية المعدودة
 */
async function createStocktake(ctx, payload = {}) {
  const { dbGet, withTx, nextNumber } = resolveHelpers(ctx);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    throw new Error('لا توجد عناصر في قائمة الجرد لحفظها');
  }

  const docNumber = payload.number || (await nextNumber('stocktake'));
  const scopeType = payload.scope_type || payload.scopeType || 'all';
  const scopeValue = payload.scope_value || payload.scopeValue || null;
  const userId = payload.user_id || payload.userId || null;
  const note = payload.note || null;
  const nowIso = new Date().toISOString();
  const applyAdjustments = payload.applyAdjustments !== false;

  return await withTx(async (tx) => {
    const ins = await tx.dbRun(
      `
      INSERT INTO stocktakes (
        number, status, scope_type, scope_value, user_id, note, started_at, closed_at
      ) VALUES (?, 'closed', ?, ?, ?, ?, ?, ?)
      `,
      [docNumber, scopeType, scopeValue, userId, note, payload.started_at || nowIso, nowIso]
    );
    const stocktakeId = ins.lastID;

    for (const item of items) {
      const productId = Number(item.product_id || item.productId);
      if (!productId) continue;

      let batchId = item.batch_id || item.batchId ? Number(item.batch_id || item.batchId) : null;
      const variantId = item.variant_id || item.variantId ? Number(item.variant_id || item.variantId) : null;

      let bookQty = Number(item.book_qty ?? item.bookQty ?? 0);
      const hasCounted =
        item.counted_qty !== undefined && item.counted_qty !== null && String(item.counted_qty).trim() !== '';
      const countedQty = hasCounted ? Number(item.counted_qty) : bookQty;

      // إذا لم يكن للمنتج دفعة مسجلة بعد وتم عده بكمية موجبة، ننشئ له دفعة ابتدائية
      if (!batchId) {
        const existingBatch = await dbGet(
          'SELECT id, stock FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
          [productId]
        );
        if (existingBatch) {
          batchId = existingBatch.id;
          bookQty = Number(existingBatch.stock || 0);
        } else if (applyAdjustments && countedQty > 0) {
          const newB = await tx.dbRun(
            'INSERT INTO inventory_batches (product_id, variant_id, stock, cost_price, selling_price) VALUES (?, ?, 0, 0, 0)',
            [productId, variantId]
          );
          batchId = newB.lastID;
          bookQty = 0;
        }
      }

      await tx.dbRun(
        `
        INSERT INTO stocktake_items (
          stocktake_id, product_id, variant_id, batch_id, book_qty, counted_qty
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [stocktakeId, productId, variantId, batchId, bookQty, countedQty]
      );

      // تطبيق التسوية المخزنية على الدفعة إذا تغيرت الكمية المعدودة عن الكمية الدفترية
      if (applyAdjustments && batchId && hasCounted && Math.abs(countedQty - bookQty) > 0.0001) {
        await tx.dbRun('UPDATE inventory_batches SET stock = ? WHERE id = ?', [countedQty, batchId]);
      }
    }

    return await getStocktake(ctx, stocktakeId);
  });
}

module.exports = {
  loadSheet,
  getStocktakeSheet: loadSheet,
  listStocktakes,
  getStocktakes: listStocktakes,
  getStocktake,
  createStocktake
};