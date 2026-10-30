/**
 * server.js
 * خادم الشبكة المحلية (Express REST API + WebSocket Real-Time Sync)
 * يدير المعاملات الذرية للمبيعات، إثراء المنتجات بالدفعات والمتغيرات، ومزامنة الأجهزة الفرعية
 */

'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const bcrypt = require('bcryptjs');

const db = require('./database');
const { processImage } = require('./imageUtils');
const productWriterMod = require('./product-write');
const batchAlloc = require('./batch-alloc');
const tillLedger = require('./till-ledger');
const analyticsQueries = require('./analytics-queries');
const productionGuard = require('./manufacturing/production-guard');
const posProduce = require('./manufacturing/pos-produce');
const stocktakeGuard = require('./stocktake/stocktake-guard');
const { getDataRevision, tracker: revisionTracker } = require('./data-revision');

const productWriter = productWriterMod.createProductWriter(db);

/**
 * توليد رقم المستند التسلسلي التالي حسب النوع والسنة
 */
async function generateNextDocNumber(docType = 'invoice') {
  return await db.nextNumber(docType);
}

/**
 * إثراء قائمة المنتجات بالدفعات، الرصيد الصالح/المنتهي، الأسعار المتعددة، الباركودات، والمتغيرات
 */
async function enrichProductsFull(products = []) {
  if (!Array.isArray(products) || products.length === 0) return [];
  const productIds = products.map((p) => Number(p.id)).filter(Boolean);
  if (productIds.length === 0) return products;

  const ph = productIds.map(() => '?').join(',');
  const todayIso = new Date().toISOString().slice(0, 10);

  const [allBatches, allBarcodes, allPrices, allVariants, allPromos] = await Promise.all([
    db.dbAll(
      `SELECT * FROM inventory_batches
       WHERE product_id IN (${ph}) AND deleted_at IS NULL
       ORDER BY (expiry_date IS NULL), expiry_date ASC, created_at ASC, id ASC`,
      productIds
    ),
    db.dbAll(
      `SELECT * FROM product_barcodes WHERE product_id IN (${ph}) AND deleted_at IS NULL`,
      productIds
    ),
    db.dbAll(
      `SELECT * FROM product_prices WHERE product_id IN (${ph}) AND deleted_at IS NULL`,
      productIds
    ),
    db.dbAll(
      `SELECT * FROM product_variants WHERE product_id IN (${ph}) AND deleted_at IS NULL`,
      productIds
    ),
    db.dbAll(
      `SELECT * FROM product_promotions
       WHERE product_id IN (${ph}) AND is_active = 1 AND deleted_at IS NULL`,
      productIds
    )
  ]);

  const batchesMap = new Map();
  for (const b of allBatches) {
    if (!batchesMap.has(b.product_id)) batchesMap.set(b.product_id, []);
    batchesMap.get(b.product_id).push(b);
  }

  const barcodesMap = new Map();
  for (const bc of allBarcodes) {
    if (!barcodesMap.has(bc.product_id)) barcodesMap.set(bc.product_id, []);
    barcodesMap.get(bc.product_id).push(bc);
  }

  const pricesMap = new Map();
  for (const pr of allPrices) {
    if (!pricesMap.has(pr.product_id)) pricesMap.set(pr.product_id, []);
    pricesMap.get(pr.product_id).push(pr);
  }

  const variantsMap = new Map();
  for (const v of allVariants) {
    if (!variantsMap.has(v.product_id)) variantsMap.set(v.product_id, []);
    variantsMap.get(v.product_id).push(v);
  }

  const promosMap = new Map();
  for (const prm of allPromos) {
    promosMap.set(prm.product_id, prm);
  }

  return products.map((prod) => {
    const batches = batchesMap.get(prod.id) || [];
    let totalStock = 0;
    let validStock = 0;
    let expiredStock = 0;
    let nextExpiry = null;

    for (const b of batches) {
      const st = Number(b.stock || 0);
      totalStock += st;
      const isExpired = b.expiry_date && String(b.expiry_date).trim() !== '' && String(b.expiry_date) < todayIso;
      if (isExpired) {
        if (st > 0) expiredStock += st;
      } else {
        validStock += st;
        if (st > 0 && b.expiry_date && (!nextExpiry || String(b.expiry_date) < nextExpiry)) {
          nextExpiry = b.expiry_date;
        }
      }
    }

    const activeBatch =
      batches.find((b) => Number(b.stock) > 0 && (!b.expiry_date || String(b.expiry_date) >= todayIso)) ||
      batches.find((b) => Number(b.stock) > 0) ||
      batches[0] ||
      {};

    const extraBarcodes = barcodesMap.get(prod.id) || [];
    const extraPrices = pricesMap.get(prod.id) || [];
    const variants = variantsMap.get(prod.id) || [];
    const promo = promosMap.get(prod.id) || null;

    return {
      ...prod,
      stock: Number(totalStock.toFixed(4)),
      total_stock: Number(totalStock.toFixed(4)),
      valid_stock: Number(validStock.toFixed(4)),
      expired_qty: Number(expiredStock.toFixed(4)),
      next_expiry: nextExpiry,
      cost_price: Number(activeBatch.cost_price ?? prod.cost_price ?? 0),
      selling_price: Number(activeBatch.selling_price ?? prod.selling_price ?? 0),
      wholesale_price:
        activeBatch.wholesale_price !== undefined && activeBatch.wholesale_price !== null
          ? Number(activeBatch.wholesale_price)
          : null,
      expiry_date: activeBatch.expiry_date || null,
      location: activeBatch.location || null,
      batches,
      extra_barcodes: extraBarcodes,
      barcodes: extraBarcodes.map((x) => x.barcode),
      extra_prices: extraPrices,
      variants,
      active_promotion: promo
    };
  });
}

/**
 * جلب بيانات منتج واحد بالكامل مع مجموعات الخيارات والمتغيرات
 */
async function getProductFullDetails(productId) {
  const pid = Number(productId);
  const prod = await db.dbGet('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL', [pid]);
  if (!prod) return null;

  const [enriched] = await enrichProductsFull([prod]);
  const optionGroups = await db.dbAll(
    'SELECT * FROM product_option_groups WHERE product_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
    [pid]
  );

  for (const g of optionGroups) {
    g.values = await db.dbAll(
      'SELECT * FROM product_option_values WHERE option_group_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
      [g.id]
    );
  }

  enriched.option_groups = optionGroups;
  return enriched;
}

/**
 * المعاملة الذرية الشاملة لإتمام أو تعديل فاتورة بيع (executeSaleTransaction)
 * تدعم: التصنيع الفوري التلقائي، سحب FIFO، تسجيل ديون المخزون، تحديث العروض، نقاط الولاء، والخزينة
 */
async function executeSaleTransaction(saleData = {}) {
  const items = Array.isArray(saleData.items) ? saleData.items : [];
  if (items.length === 0) {
    throw new Error('لا يمكن حفظ فاتورة بيع فارغة بدون منتجات');
  }

  const editSaleId = saleData.editSaleId || saleData.edit_sale_id ? Number(saleData.editSaleId || saleData.edit_sale_id) : null;
  const customerId = saleData.customer_id || saleData.customerId ? Number(saleData.customer_id || saleData.customerId) : null;
  const userId = saleData.user_id || saleData.userId ? Number(saleData.user_id || saleData.userId) : null;
  const sessionId = saleData.session_id || saleData.sessionId ? Number(saleData.session_id || saleData.sessionId) : null;
  const subtotal = Number(saleData.subtotal ?? 0);
  const taxPercentage = Number(saleData.tax_percentage ?? saleData.taxPercentage ?? 0);
  const discount = Number(saleData.discount ?? 0);
  const stampAmount = Number(saleData.stamp_amount ?? saleData.stampAmount ?? 0);
  const total = Number(saleData.total ?? 0);
  const paidAmount = Number(saleData.paid_amount ?? saleData.paidAmount ?? total);
  const paymentMethod = String(saleData.payment_method || saleData.paymentMethod || 'cash').toLowerCase();
  const dueDate = saleData.due_date || saleData.dueDate || null;
  const saleDate = saleData.sale_date || saleData.saleDate || new Date().toISOString();

  // 1. تشغيل التصنيع التلقائي الفوري (إن كان مفعلاً) لتغطية أي نقص قبل السحب
  try {
    await posProduce.autoProduceShortfallsForSale(db, items, { userId });
  } catch (_) {}

  return await db.withTransaction(async () => {
    let saleId = editSaleId;
    let docNumber = saleData.doc_number || saleData.docNumber || null;

    // في حالة تعديل فاتورة قائمة: نسترجع المخزون القديم ونمسح الأسطر القديمة أولاً
    if (editSaleId) {
      const oldItems = await db.dbAll(
        'SELECT * FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL',
        [editSaleId]
      );
      for (const oldIt of oldItems) {
        if (oldIt.batch_id && Number(oldIt.sold_without_stock || 0) === 0) {
          await batchAlloc.restoreBatch(db, {
            batchId: oldIt.batch_id,
            quantity: oldIt.quantity,
            soldWithoutStock: oldIt.sold_without_stock
          });
        }
      }
      await db.dbRun('DELETE FROM stock_debt WHERE sale_id = ?', [editSaleId]);
      await db.dbRun('DELETE FROM sale_items WHERE sale_id = ?', [editSaleId]);

      await db.dbRun(
        `UPDATE sales
         SET customer_id = ?, subtotal = ?, tax_percentage = ?, discount = ?,
             total = ?, paid_amount = ?, due_date = ?, sale_date = ?,
             user_id = COALESCE(?, user_id), session_id = COALESCE(?, session_id),
             stamp_amount = ?, payment_method = ?
         WHERE id = ?`,
        [
          customerId,
          subtotal,
          taxPercentage,
          discount,
          total,
          paidAmount,
          dueDate,
          saleDate,
          userId,
          sessionId,
          stampAmount,
          paymentMethod,
          editSaleId
        ]
      );
    } else {
      if (!docNumber) {
        docNumber = await generateNextDocNumber('invoice');
      }
      const activeSessId = await tillLedger.resolveOpenSession(db, sessionId, userId);

      const ins = await db.dbRun(
        `INSERT INTO sales (
          doc_number, customer_id, subtotal, tax_percentage, discount,
          total, paid_amount, due_date, sale_date, user_id, session_id,
          stamp_amount, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          docNumber,
          customerId,
          subtotal,
          taxPercentage,
          discount,
          total,
          paidAmount,
          dueDate,
          saleDate,
          userId,
          activeSessId,
          stampAmount,
          paymentMethod
        ]
      );
      saleId = ins.lastID;

      // تسجيل الدفعة الأولية في جدول sale_payments إذا كان هناك مبلغ مدفوع
      if (Math.abs(paidAmount) > 0.009) {
        await db.dbRun(
          `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method)
           VALUES (?, ?, ?, ?, ?)`,
          [saleId, customerId, paidAmount, saleDate, paymentMethod]
        );
      }
    }

    // 2. معالجة كل سطر في الفاتورة (منتج عادي، حزمة، أو منتج حر مخصص)
    for (const item of items) {
      const isBundle = Boolean(item.bundle_id || item.bundleId || item.is_bundle);
      const productId = item.product_id || item.productId ? Number(item.product_id || item.productId) : null;
      const variantId = item.variant_id || item.variantId ? Number(item.variant_id || item.variantId) : null;
      const preferredBatchId = item.batch_id || item.batchId ? Number(item.batch_id || item.batchId) : null;
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.price ?? item.selling_price ?? 0);
      const lineSubtotal = Number(item.subtotal ?? (qty * price));
      const promoId = item.applied_promotion_id || item.promotion_id || null;

      if (isBundle) {
        const bundleId = Number(item.bundle_id || item.bundleId);
        const bundleComponents = await db.dbAll(
          'SELECT product_id, quantity FROM bundle_items WHERE bundle_id = ? AND deleted_at IS NULL',
          [bundleId]
        );
        let bundleTotalCost = 0;

        for (const bc of bundleComponents) {
          const compNeed = Number((Number(bc.quantity || 1) * qty).toFixed(6));
          const alloc = await batchAlloc.deductFromBatch(db, {
            productId: bc.product_id,
            quantity: compNeed
          });
          bundleTotalCost += Number(alloc.costPrice || 0) * Number(bc.quantity || 1);

          if (alloc.shortfallQty > 0) {
            await db.dbRun(
              'INSERT INTO stock_debt (product_id, batch_id, sale_id, quantity) VALUES (?, ?, ?, ?)',
              [bc.product_id, alloc.primaryBatchId, saleId, alloc.shortfallQty]
            );
          }
        }

        await db.dbRun(
          `INSERT INTO sale_items (
            sale_id, product_id, quantity, price, subtotal, cost_price, custom_product_name
          ) VALUES (?, NULL, ?, ?, ?, ?, ?)`,
          [
            saleId,
            qty,
            price,
            lineSubtotal,
            Number(bundleTotalCost.toFixed(2)),
            item.custom_product_name || item.name || 'حزمة منتجات'
          ]
        );
        continue;
      }

      // منتج حر غير مسجل في المخزون
      if (!productId) {
        await db.dbRun(
          `INSERT INTO sale_items (
            sale_id, product_id, quantity, price, subtotal, cost_price,
            custom_product_name, custom_cost_price, sold_without_stock
          ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0)`,
          [
            saleId,
            qty,
            price,
            lineSubtotal,
            Number(item.custom_cost_price ?? item.cost_price ?? 0),
            item.custom_product_name || item.name || 'منتج حر',
            Number(item.custom_cost_price ?? item.cost_price ?? 0)
          ]
        );
        continue;
      }

      // منتج مخزني قياسي: نخصم عبر FIFO
      const alloc = await batchAlloc.deductFromBatch(db, {
        productId,
        variantId,
        batchId: preferredBatchId,
        quantity: qty
      });

      if (alloc.allocations && alloc.allocations.length > 0) {
        for (const slice of alloc.allocations) {
          const sliceSub = Number((slice.quantity * price).toFixed(2));
          await db.dbRun(
            `INSERT INTO sale_items (
              sale_id, product_id, batch_id, variant_id, quantity, price,
              subtotal, cost_price, applied_promotion_id, serial_number, sold_without_stock
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleId,
              productId,
              slice.batchId || null,
              slice.variantId || variantId || null,
              slice.quantity,
              price,
              sliceSub,
              slice.costPrice !== null && slice.costPrice !== undefined
                ? Number(slice.costPrice)
                : Number(item.cost_price || 0),
              promoId,
              item.serial_number || null,
              slice.soldWithoutStock ? 1 : 0
            ]
          );

          if (slice.soldWithoutStock && slice.quantity > 0) {
            await db.dbRun(
              'INSERT INTO stock_debt (product_id, variant_id, batch_id, sale_id, quantity) VALUES (?, ?, ?, ?, ?)',
              [productId, slice.variantId || variantId || null, slice.batchId || null, saleId, slice.quantity]
            );
          }
        }
      } else {
        await db.dbRun(
          `INSERT INTO sale_items (
            sale_id, product_id, batch_id, variant_id, quantity, price, subtotal, cost_price, sold_without_stock
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            saleId,
            productId,
            preferredBatchId,
            variantId,
            qty,
            price,
            lineSubtotal,
            Number(item.cost_price || 0)
          ]
        );
      }

      if (promoId && qty > 0) {
        await db.dbRun(
          'UPDATE product_promotions SET used_qty = COALESCE(used_qty, 0) + ? WHERE id = ?',
          [qty, Number(promoId)]
        );
      }
    }

    // 3. تحديث الخزينة (Caisse)
    await tillLedger.applySaleTillDelta(db, {
      saleId,
      sessionId,
      userId,
      paidAmount,
      totalAmount: total,
      paymentMethod
    });

    // 4. إضافة نقاط الولاء للزبون إن كان مسجلاً
    if (customerId && total > 0 && !editSaleId) {
      const loyaltyEnabled = (await db.getSetting('loyalty_enabled', 'true')) === 'true';
      if (loyaltyEnabled) {
        const ptsPer100 = Number(await db.getSetting('loyalty_points_per_100_dzd', '1')) || 1;
        const earnedPoints = Math.floor((total / 100) * ptsPer100);
        if (earnedPoints > 0) {
          await db.dbRun(
            'UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?',
            [earnedPoints, customerId]
          );
          await db.dbRun(
            'INSERT INTO loyalty_transactions (customer_id, sale_id, points_delta, reason) VALUES (?, ?, ?, ?)',
            [customerId, saleId, earnedPoints, `مكافأة فاتورة #${docNumber || saleId}`]
          );
        }
      }
    }

    return {
      success: true,
      id: saleId,
      saleId,
      docNumber
    };
  });
}

/**
 * تشغيل خادم الشبكة المحلية (Express + WebSockets)
 */
function startLocalServer(port = 8080, onStartedCallback = null) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const connectedClients = new Map();

  app.use((req, _res, next) => {
    const devId = req.headers['x-device-id'] || req.ip || 'lan-client';
    connectedClients.set(devId, {
      deviceId: devId,
      ip: req.ip,
      clientType: req.headers['x-client-type'] || 'http',
      lastSeenAt: new Date().toISOString()
    });
    next();
  });

  app.get('/api/ping', async (_req, res) => {
    const shopName = await db.getSetting('shop_name', 'Gherbi.Ai POS');
    res.json({ ok: true, app: 'Gherbi.Ai POS', shopName, ts: Date.now() });
  });

  app.get('/api/data-revision', (_req, res) => {
    res.json(getDataRevision());
  });

  app.get('/api/categories', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        "SELECT DISTINCT category FROM products WHERE deleted_at IS NULL AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC"
      );
      res.json(rows.map((r) => r.category));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/families', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        "SELECT DISTINCT family FROM products WHERE deleted_at IS NULL AND family IS NOT NULL AND TRIM(family) <> '' ORDER BY family ASC"
      );
      res.json(rows.map((r) => r.family));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const rows = await db.dbAll('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY id DESC');
      const enriched = await enrichProductsFull(rows);
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products/:id/full', async (req, res) => {
    try {
      const full = await getProductFullDetails(req.params.id);
      res.json(full);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sales', async (req, res) => {
    try {
      const out = await executeSaleTransaction(req.body || {});
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/sales/:id', async (req, res) => {
    try {
      const out = await executeSaleTransaction({ ...(req.body || {}), editSaleId: Number(req.params.id) });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/analytics', async (req, res) => {
    try {
      const data = await analyticsQueries.getAnalytics(db, req.query || {});
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/settings', async (_req, res) => {
    try {
      const rows = await db.dbAll('SELECT key, value FROM settings');
      const obj = {};
      for (const r of rows) obj[r.key] = r.value;
      res.json(obj);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || 'ws-client';
    connectedClients.set(clientIp, {
      deviceId: clientIp,
      ip: clientIp,
      clientType: 'websocket',
      lastSeenAt: new Date().toISOString()
    });
    ws.send(JSON.stringify({ type: 'revision', data: getDataRevision() }));
  });

  revisionTracker.on('changed', (snap) => {
    const msg = JSON.stringify({ type: 'revision', data: snap });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Gherbi.Ai POS Server] Listening on http://0.0.0.0:${port}`);
    if (typeof onStartedCallback === 'function') {
      onStartedCallback(null, { server, wss, port, getConnectedClients: () => Array.from(connectedClients.values()) });
    }
  });

  server.on('error', (err) => {
    console.warn(`[Gherbi.Ai POS Server] Port ${port} warning:`, err.message);
  });

  return {
    app,
    server,
    wss,
    getConnectedClients: () => Array.from(connectedClients.values())
  };
}

module.exports = {
  startLocalServer,
  generateNextDocNumber,
  enrichProductsFull,
  getProductFullDetails,
  executeSaleTransaction
};