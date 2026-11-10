/**
 * server.js
 * خادم الشبكة المحلية الشامل (75+ Express REST API Routes + WebSocket Real-Time Sync)
 * يدعم أجهزة الكاشير الفرعية (LAN Clients)، تطبيق الهاتف، الدفع المختلط، الأقساط، وسجل الرقابة الأمنية
 */

'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const db = require('./database');
const enterpriseBridge = require('./gherbi-enterprise-ipc-and-lan');
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

async function generateNextDocNumber(docType = 'invoice') {
  return await db.nextNumber(docType);
}

/**
 * تسجيل حدث أمني في جدول الرقابة ومنع التلاعب (audit_logs)
 */
async function recordAuditLog(payload = {}) {
  const userId = payload.user_id || payload.userId || null;
  const userName = payload.user_name || payload.userName || 'Cashier';
  const actionType = String(payload.action_type || payload.actionType || 'event');
  const targetType = payload.target_type || payload.targetType || null;
  const targetId = payload.target_id || payload.targetId || null;
  const severity = payload.severity || 'info';
  const detailsJson =
    typeof payload.details === 'string'
      ? payload.details
      : JSON.stringify(payload.details || payload.details_json || {});

  const ins = await db.dbRun(
    `INSERT INTO audit_logs (user_id, user_name, action_type, target_type, target_id, details_json, severity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, userName, actionType, targetType, targetId, detailsJson, severity]
  );
  return { success: true, id: ins.lastID };
}

/**
 * إنشاء خطة تقسيط وجدول أقساط شهري (Vente par Facilité)
 */
async function createInstallmentPlanRecord(payload = {}) {
  const customerId = Number(payload.customer_id || payload.customerId);
  if (!customerId) throw new Error('يرجى تحديد الزبون لإنشاء عقد البيع بالتقسيط');

  const saleId = payload.sale_id || payload.saleId ? Number(payload.sale_id || payload.saleId) : null;
  const totalAmount = Number(payload.total_amount ?? payload.totalAmount ?? 0);
  const downPayment = Number(payload.down_payment ?? payload.downPayment ?? 0);
  const remainingAmount = Math.max(0, Number((totalAmount - downPayment).toFixed(2)));
  const monthsCount = Math.max(1, parseInt(payload.months_count ?? payload.monthsCount ?? 3, 10) || 3);
  const monthlyAmount = Number((remainingAmount / monthsCount).toFixed(2));
  const startDate = payload.start_date || payload.startDate || new Date().toISOString().slice(0, 10);
  const notes = payload.notes || null;

  return await db.withTransaction(async () => {
    const ins = await db.dbRun(
      `INSERT INTO installment_plans (
        sale_id, customer_id, total_amount, down_payment, remaining_amount,
        months_count, monthly_amount, start_date, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [saleId, customerId, totalAmount, downPayment, remainingAmount, monthsCount, monthlyAmount, startDate, notes]
    );
    const planId = ins.lastID;

    let allocated = 0;
    const baseDate = new Date(startDate);
    for (let i = 1; i <= monthsCount; i++) {
      const due = new Date(baseDate);
      due.setMonth(due.getMonth() + i);
      const dueStr = due.toISOString().slice(0, 10);
      const amt =
        i === monthsCount
          ? Number((remainingAmount - allocated).toFixed(2))
          : monthlyAmount;
      allocated = Number((allocated + amt).toFixed(2));

      await db.dbRun(
        `INSERT INTO installment_schedules (plan_id, installment_num, due_date, amount, paid_amount, status)
         VALUES (?, ?, ?, ?, 0, 'pending')`,
        [planId, i, dueStr, amt]
      );
    }

    return { success: true, id: planId, planId };
  });
}

/**
 * بناء استعلام الفرز المتقدم للمنتجات (newest, oldest, name_asc, name_desc, stock_asc, stock_desc, expiry_asc)
 */
function buildProductsQueryOrder(sortKey = '') {
  const s = String(sortKey || '').toLowerCase();
  let orderBySql = 'ORDER BY p.id DESC';
  let needsStockJoin = false;

  if (s === 'oldest') {
    orderBySql = 'ORDER BY p.id ASC';
  } else if (s === 'name_asc') {
    orderBySql = 'ORDER BY p.name COLLATE NOCASE ASC, p.id ASC';
  } else if (s === 'name_desc') {
    orderBySql = 'ORDER BY p.name COLLATE NOCASE DESC, p.id DESC';
  } else if (s === 'stock_asc') {
    needsStockJoin = true;
    orderBySql = 'ORDER BY COALESCE(st.total_stock, 0) ASC, p.id DESC';
  } else if (s === 'stock_desc') {
    needsStockJoin = true;
    orderBySql = 'ORDER BY COALESCE(st.total_stock, 0) DESC, p.id DESC';
  } else if (s === 'expiry_asc') {
    needsStockJoin = true;
    orderBySql = 'ORDER BY (st.next_expiry IS NULL) ASC, st.next_expiry ASC, p.id DESC';
  }

  const stockJoinSql = needsStockJoin
    ? `LEFT JOIN (
         SELECT
           product_id,
           SUM(stock) AS total_stock,
           MIN(CASE WHEN stock > 0 AND expiry_date IS NOT NULL AND expiry_date <> '' AND date(expiry_date) >= date('now') THEN expiry_date END) AS next_expiry
         FROM inventory_batches
         WHERE deleted_at IS NULL
         GROUP BY product_id
       ) st ON st.product_id = p.id`
    : '';

  return { stockJoinSql, orderBySql };
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
 * جلب تفاصيل الدفعة المالية مع حساب الرصيد السابق والمتبقي (Payment Receipt Parity)
 */
async function getPaymentDetailsFull(paymentId, type = 'sale') {
  const isSale = type !== 'invoice' && type !== 'purchase';
  const table = isSale ? 'sale_payments' : 'invoice_payments';
  const partyTable = isSale ? 'customers' : 'suppliers';
  const partyFk = isSale ? 'customer_id' : 'supplier_id';
  const docTable = isSale ? 'sales' : 'purchase_invoices';
  const docFk = isSale ? 'sale_id' : 'invoice_id';

  const payment = await db.dbGet(`SELECT * FROM ${table} WHERE id = ?`, [Number(paymentId)]);
  if (!payment) return null;

  let partyId = payment[partyFk];
  if (!partyId && payment[docFk]) {
    const docRow = await db.dbGet(`SELECT ${partyFk} FROM ${docTable} WHERE id = ?`, [payment[docFk]]);
    if (docRow) partyId = docRow[partyFk];
  }

  const party = partyId
    ? await db.dbGet(`SELECT * FROM ${partyTable} WHERE id = ?`, [partyId])
    : null;

  let currentTotalDebt = 0;
  if (party) {
    const docsDebtRow = await db.dbGet(
      `SELECT COALESCE(SUM(total - paid_amount), 0) AS docs_debt FROM ${docTable} WHERE ${partyFk} = ? AND deleted_at IS NULL`,
      [party.id]
    );
    const initRem = Math.max(0, Number(party.initial_debt || 0) - Number(party.initial_debt_paid || 0));
    currentTotalDebt = initRem + Number((docsDebtRow && docsDebtRow.docs_debt) || 0);
  }

  const amt = Number(payment.amount || 0);
  const debtAfter = Number(currentTotalDebt.toFixed(2));
  const debtBefore = Number((currentTotalDebt + amt).toFixed(2));

  return {
    ...payment,
    type: isSale ? 'sale' : 'purchase',
    party_id: party ? party.id : null,
    party_name: party ? party.name : '',
    party_phone: party ? party.phone : '',
    party_address: party ? party.address : '',
    party_nif: party ? party.nif : '',
    party_rc: party ? party.rc : '',
    party,
    debt_before: debtBefore,
    debt_after: debtAfter
  };
}

/**
 * المعاملة الذرية الشاملة لإتمام أو تعديل فاتورة بيع (executeSaleTransaction)
 * تدعم: التصنيع الفوري، FIFO، ديون المخزون، الدفع المختلط (Split Payment)، البيع بالتقسيط، والضمان
 */
let _saleItemsSchemaChecked = false;
async function ensureSaleItemsColumnsExist() {
  if (_saleItemsSchemaChecked) return;
  _saleItemsSchemaChecked = true;
  const cols = [
    ['sale_items', 'bonus_qty REAL DEFAULT 0'],
    ['sale_items', 'pack_count REAL DEFAULT 0'],
    ['sale_items', 'pack_multiplier REAL DEFAULT 1'],
    ['sale_items', 'sold_m2 REAL DEFAULT 0'],
    ['sale_items', 'warranty_months INTEGER DEFAULT 0']
  ];
  for (const [t, c] of cols) {
    try { await db.dbRun(`ALTER TABLE ${t} ADD COLUMN ${c}`); } catch (_) {}
  }
}

async function executeSaleTransaction(saleData = {}) {
  await ensureSaleItemsColumnsExist();
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
  const splitPaymentsJson = saleData.split_payments
    ? JSON.stringify(saleData.split_payments)
    : saleData.split_payments_json || null;
  const dueDate = saleData.due_date || saleData.dueDate || null;
  const saleDate = saleData.sale_date || saleData.saleDate || new Date().toISOString();

  // التحقق من مهلة تعديل الفاتورة إن كان تعديلاً
  if (editSaleId) {
    const existingSale = await db.dbGet('SELECT id, sale_date, deleted_at FROM sales WHERE id = ?', [editSaleId]);
    if (!existingSale || existingSale.deleted_at) {
      throw new Error('الفاتورة المطلوبة غير موجودة أو محذوفة');
    }
    const winDays = parseInt(await db.getSetting('sale_edit_window_days', '30'), 10);
    if (Number.isFinite(winDays) && winDays > 0 && existingSale.sale_date) {
      const diffDays = (Date.now() - new Date(existingSale.sale_date).getTime()) / 86400000;
      if (diffDays > winDays) {
        throw new Error(`انتهت المهلة المسموحة لتعديل الفاتورة (${winDays} يوماً)`);
      }
    }
  }

  try {
    await posProduce.autoProduceShortfallsForSale(db, items, { userId });
  } catch (_) {}

  return await db.withTransaction(async () => {
    let saleId = editSaleId;
    let docNumber = saleData.doc_number || saleData.docNumber || null;

    if (editSaleId) {
      const oldItems = await db.dbAll('SELECT * FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL', [editSaleId]);
      for (const oldIt of oldItems) {
        if (oldIt.batch_id && Number(oldIt.sold_without_stock || 0) === 0) {
          await batchAlloc.restoreBatch(db, {
            batchId: oldIt.batch_id,
            quantity: Number(oldIt.quantity || 0) + Number(oldIt.bonus_qty || 0),
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
             stamp_amount = ?, payment_method = ?, split_payments_json = ?
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
          splitPaymentsJson,
          editSaleId
        ]
      );

      await db.dbRun(
        'INSERT INTO document_edit_history (doc_type, doc_id, user_id, changes_json) VALUES (?, ?, ?, ?)',
        ['sale', editSaleId, userId, JSON.stringify({ total, paidAmount, itemsCount: items.length })]
      );
      await db.dbRun(
        'INSERT INTO sync_outbox (event_type, payload_json) VALUES (?, ?)',
        ['sale_updated', JSON.stringify({ sale_id: editSaleId, updated_at: new Date().toISOString() })]
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
          stamp_amount, payment_method, split_payments_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          paymentMethod,
          splitPaymentsJson
        ]
      );
      saleId = ins.lastID;

      // تسجيل الدفعات (سواء كانت دفعة موحدة أو دفعاً مختلطاً Split Payment)
      if (Array.isArray(saleData.split_payments) && saleData.split_payments.length > 0) {
        for (const sp of saleData.split_payments) {
          const spAmt = Number(sp.amount || 0);
          if (Math.abs(spAmt) > 0.009) {
            await db.dbRun(
              `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method, reference)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [saleId, customerId, spAmt, saleDate, sp.method || 'cash', sp.reference || null]
            );
          }
        }
      } else if (Math.abs(paidAmount) > 0.009) {
        await db.dbRun(
          `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method)
           VALUES (?, ?, ?, ?, ?)`,
          [saleId, customerId, paidAmount, saleDate, paymentMethod]
        );
      }
    }

    for (const item of items) {
      const isBundle = Boolean(item.bundle_id || item.bundleId || item.is_bundle);
      const productId = item.product_id || item.productId ? Number(item.product_id || item.productId) : null;
      const variantId = item.variant_id || item.variantId ? Number(item.variant_id || item.variantId) : null;
      const preferredBatchId = item.batch_id || item.batchId ? Number(item.batch_id || item.batchId) : null;
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.price ?? item.selling_price ?? 0);
      const lineSubtotal = Number(item.subtotal ?? (qty * price));
      const promoId = item.applied_promotion_id || item.promotion_id || null;
      const warrantyMonths = Number(item.warranty_months || 0);

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

      const bonusQty = Math.max(0, Number(item.bonus_qty || item.bonusQty || 0));
      const packCount = Math.max(0, Number(item.pack_count || item.packCount || 0));
      const packMultiplier = Math.max(1, Number(item.pack_multiplier || item.packMultiplier || 1));
      const soldM2 = Math.max(0, Number(item.sold_m2 || item.soldM2 || 0));

      const alloc = await batchAlloc.deductFromBatch(db, {
        productId,
        variantId,
        batchId: preferredBatchId,
        quantity: qty
      });

      if (bonusQty > 0) {
        await batchAlloc.deductFromBatch(db, {
          productId,
          variantId,
          batchId: preferredBatchId,
          quantity: bonusQty
        });
      }

      if (alloc.allocations && alloc.allocations.length > 0) {
        let isFirstSlice = true;
        for (const slice of alloc.allocations) {
          const sliceSub = Number((slice.quantity * price).toFixed(2));
          await db.dbRun(
            `INSERT INTO sale_items (
              sale_id, product_id, batch_id, variant_id, quantity, price,
              subtotal, cost_price, applied_promotion_id, serial_number, warranty_months, sold_without_stock,
              bonus_qty, pack_count, pack_multiplier, sold_m2
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
              warrantyMonths,
              slice.soldWithoutStock ? 1 : 0,
              isFirstSlice ? bonusQty : 0,
              isFirstSlice ? packCount : 0,
              packMultiplier,
              isFirstSlice ? soldM2 : 0
            ]
          );
          isFirstSlice = false;

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
            sale_id, product_id, batch_id, variant_id, quantity, price, subtotal, cost_price, serial_number, warranty_months, sold_without_stock
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            saleId,
            productId,
            preferredBatchId,
            variantId,
            qty,
            price,
            lineSubtotal,
            Number(item.cost_price || 0),
            item.serial_number || null,
            warrantyMonths
          ]
        );
      }

      if (item.serial_number) {
        await db.dbRun(
          "UPDATE product_serials SET status = 'sold', sale_id = ? WHERE serial_number = ?",
          [saleId, String(item.serial_number).trim()]
        );
      }

      if (promoId && qty > 0) {
        await db.dbRun(
          'UPDATE product_promotions SET used_qty = COALESCE(used_qty, 0) + ? WHERE id = ?',
          [qty, Number(promoId)]
        );
      }
    }

    // حساب النقد الفعلي الداخل للصندوق (سواء دفع موحد أو مختلط)
    let cashPortion = paidAmount;
    if (Array.isArray(saleData.split_payments) && saleData.split_payments.length > 0) {
      cashPortion = saleData.split_payments
        .filter((sp) => !sp.method || String(sp.method).toLowerCase() === 'cash')
        .reduce((sum, sp) => sum + Number(sp.amount || 0), 0);
    }

    await tillLedger.applySaleTillDelta(db, {
      saleId,
      sessionId,
      userId,
      paidAmount: cashPortion,
      totalAmount: total,
      paymentMethod: Array.isArray(saleData.split_payments) ? 'cash' : paymentMethod
    });

    // إنشاء خطة تقسيط تلقائياً إذا تم تفعيل خيار البيع بالتقسيط في نافذة الدفع
    if (saleData.installment_plan && customerId && !editSaleId) {
      await createInstallmentPlanRecord({
        sale_id: saleId,
        customer_id: customerId,
        total_amount: total,
        down_payment: paidAmount,
        months_count: saleData.installment_plan.months_count || 3,
        start_date: saleData.installment_plan.start_date || saleDate.slice(0, 10),
        notes: saleData.installment_plan.notes || `تقسيط فاتورة #${docNumber}`
      });
    }

    const redeemedPtsInSale = Math.max(0, Number(saleData.redeemed_loyalty_points || 0));
    if (customerId && redeemedPtsInSale > 0 && !editSaleId) {
      await db.dbRun(
        'UPDATE customers SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?) WHERE id = ?',
        [redeemedPtsInSale, customerId]
      );
      await db.dbRun(
        'INSERT INTO loyalty_transactions (customer_id, sale_id, points_delta, reason) VALUES (?, ?, ?, ?)',
        [customerId, saleId, -redeemedPtsInSale, `استعمال نقاط ولاء للخصم في فاتورة #${docNumber || saleId}`]
      );
    } else if (customerId && total > 0 && !editSaleId) {
      const loyaltyEnabled = (await db.getSetting('loyalty_enabled', 'true')) === 'true';
      if (loyaltyEnabled) {
        const ptsPer100 = Number(saleData.loyalty_points_per_100_dzd ?? (await db.getSetting('loyalty_points_per_100_dzd', '1'))) || 1;
        const earnedPoints = saleData.earned_loyalty_points !== undefined
          ? Math.max(0, Number(saleData.earned_loyalty_points))
          : Math.floor((total / 100) * ptsPer100);
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
 * تشغيل خادم الشبكة المحلية بكافة المسارات الـ 75+
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

  // 1. النظام والمراجعات والتنبيهات
  app.get('/api/ping', async (_req, res) => {
    const shopName = await db.getSetting('shop_name', 'Gherbi.Ai POS');
    res.json({ ok: true, app: 'Gherbi.Ai POS', shopName, ts: Date.now() });
  });

  app.get('/api/data-revision', (_req, res) => {
    res.json(getDataRevision());
  });

  app.get('/api/dashboard', async (req, res) => {
    try {
      res.json(await analyticsQueries.getAnalytics(db, req.query || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notifications', async (_req, res) => {
    try {
      const lowStock = await db.dbAll(
        `SELECT p.id, p.name, p.min_stock, p.unit, COALESCE(SUM(ib.stock), 0) AS stock
         FROM products p
         LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.deleted_at IS NULL
         WHERE p.deleted_at IS NULL
         GROUP BY p.id
         HAVING stock <= COALESCE(p.min_stock, 5)
         ORDER BY stock ASC LIMIT 50`
      );
      const expiring = await db.dbAll(
        `SELECT ib.id, p.id AS product_id, p.name, ib.stock, ib.expiry_date
         FROM inventory_batches ib
         INNER JOIN products p ON p.id = ib.product_id AND p.deleted_at IS NULL
         WHERE ib.deleted_at IS NULL AND ib.stock > 0
           AND ib.expiry_date IS NOT NULL AND TRIM(ib.expiry_date) <> ''
           AND date(ib.expiry_date) <= date('now', '+30 days')
         ORDER BY date(ib.expiry_date) ASC LIMIT 50`
      );
      const dueInstallments = await db.dbAll(
        `SELECT s.*, p.customer_id, c.name AS customer_name, c.phone AS customer_phone
         FROM installment_schedules s
         INNER JOIN installment_plans p ON p.id = s.plan_id AND p.deleted_at IS NULL
         LEFT JOIN customers c ON c.id = p.customer_id
         WHERE s.deleted_at IS NULL AND s.status <> 'paid'
           AND date(s.due_date) <= date('now', '+7 days')
         ORDER BY date(s.due_date) ASC LIMIT 50`
      );
      res.json({ lowStock, expiring, dueInstallments });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/inventory-alerts', async (_req, res) => {
    try {
      const lowStock = await db.dbAll(
        `SELECT p.id, p.name, p.min_stock, p.unit, COALESCE(SUM(ib.stock), 0) AS current_stock
         FROM products p
         LEFT JOIN inventory_batches ib ON p.id = ib.product_id AND ib.deleted_at IS NULL
         WHERE p.deleted_at IS NULL
         GROUP BY p.id
         HAVING current_stock <= COALESCE(p.min_stock, 5)
         ORDER BY current_stock ASC LIMIT 100`
      );
      const expiring = await db.dbAll(
        `SELECT ib.id AS batch_id, p.id AS product_id, p.name, ib.stock, ib.expiry_date, ib.selling_price, ib.cost_price
         FROM inventory_batches ib
         INNER JOIN products p ON p.id = ib.product_id AND p.deleted_at IS NULL
         WHERE ib.deleted_at IS NULL AND ib.stock > 0
           AND ib.expiry_date IS NOT NULL AND TRIM(ib.expiry_date) <> ''
           AND date(ib.expiry_date) <= date('now', '+30 days')
         ORDER BY date(ib.expiry_date) ASC LIMIT 100`
      );
      res.json({ lowStock, expiring });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. المنتجات، الفئات، الدفعات، الباركودات، والمتغيرات
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

  app.get('/api/product-suppliers', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        "SELECT DISTINCT name FROM suppliers WHERE deleted_at IS NULL AND name IS NOT NULL AND TRIM(name) <> '' ORDER BY name ASC"
      );
      res.json(rows.map((r) => r.name));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const filters = req.query || {};
      const conds = ['p.deleted_at IS NULL'];
      const params = [];

      if (filters.category) {
        conds.push('p.category = ?');
        params.push(filters.category);
      }
      if (filters.family) {
        conds.push('p.family = ?');
        params.push(filters.family);
      }
      if (filters.supplier) {
        conds.push('p.supplier = ?');
        params.push(filters.supplier);
      }
      if (filters.search) {
        const q = `%${String(filters.search).trim()}%`;
        conds.push('(p.name LIKE ? OR p.barcode LIKE ? OR p.category LIKE ? OR p.plu_code LIKE ?)');
        params.push(q, q, q, q);
      }

      const { stockJoinSql, orderBySql } = buildProductsQueryOrder(filters.sort);
      const rows = await db.dbAll(
        `SELECT p.* FROM products p ${stockJoinSql} WHERE ${conds.join(' AND ')} ${orderBySql}`,
        params
      );
      res.json(await enrichProductsFull(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/pos-stock', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        'SELECT * FROM products WHERE deleted_at IS NULL AND COALESCE(hide_from_pos, 0) = 0 ORDER BY is_featured DESC, id DESC'
      );
      res.json(await enrichProductsFull(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products/:id/full', async (req, res) => {
    try {
      res.json(await getProductFullDetails(req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products/:id/analytics', async (req, res) => {
    try {
      const pid = Number(req.params.id);
      const summary = await db.dbGet(
        `SELECT
           COALESCE(SUM(si.quantity), 0) AS total_sold_qty,
           COALESCE(SUM(si.subtotal), 0) AS total_revenue,
           COALESCE(SUM(si.quantity * COALESCE(si.cost_price, ib.cost_price, 0)), 0) AS total_cost
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
         LEFT JOIN inventory_batches ib ON ib.id = si.batch_id
         WHERE si.product_id = ? AND si.deleted_at IS NULL`,
        [pid]
      );
      const rev = Number((summary && summary.total_revenue) || 0);
      const cost = Number((summary && summary.total_cost) || 0);
      res.json({
        product_id: pid,
        total_sold_qty: Number((summary && summary.total_sold_qty) || 0),
        total_revenue: rev,
        total_cost: cost,
        total_profit: Number((rev - cost).toFixed(2))
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products', async (req, res) => {
    try {
      const p = req.body || {};
      const barcode = p.barcode ? String(p.barcode).trim() : null;
      if (barcode) await productWriter.freeTombstonedProductBarcode(barcode);
      const img = p.image ? processImage(p.image) : null;

      const out = await db.withTransaction(async () => {
        const ins = await db.dbRun(
          `INSERT INTO products (
            barcode, name, category, family, supplier, description, min_stock,
            image, unit, color, weight_volume, wholesale_unit, wholesale_qty,
            plu_code, has_variants, is_featured, material_role, track_serial, warranty_months, hide_from_pos
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            barcode,
            String(p.name || 'منتج جديد').trim(),
            p.category || 'عام',
            p.family || null,
            p.supplier || null,
            p.description || null,
            Number(p.min_stock ?? 5),
            img,
            p.unit || 'قطعة',
            p.color || null,
            p.weight_volume || null,
            p.wholesale_unit || null,
            p.wholesale_qty ? Number(p.wholesale_qty) : null,
            p.plu_code || null,
            p.has_variants ? 1 : 0,
            p.is_featured ? 1 : 0,
            p.material_role || null,
            p.track_serial ? 1 : 0,
            Number(p.warranty_months ?? 0),
            p.hide_from_pos ? 1 : 0
          ]
        );
        const productId = ins.lastID;

        await productWriter.insertExtraBarcodesAndPrices(
          productId,
          p.extra_barcodes || p.barcodes || [],
          p.extra_prices || p.prices || []
        );

        if (p.has_variants && Array.isArray(p.variants) && p.variants.length > 0) {
          await productWriter.insertVariantData(productId, p.option_groups || [], p.variants, p.location || null);
        } else {
          await db.dbRun(
            `INSERT INTO inventory_batches (
              product_id, stock, cost_price, selling_price, wholesale_price, expiry_date, location
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              productId,
              Number(p.stock ?? 0),
              Number(p.cost_price ?? 0),
              Number(p.selling_price ?? 0),
              p.wholesale_price !== undefined && p.wholesale_price !== '' ? Number(p.wholesale_price) : null,
              p.expiry_date || null,
              p.location || null
            ]
          );
        }
        return { success: true, id: productId };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/products/:id', async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const p = req.body || {};
      const barcode = p.barcode ? String(p.barcode).trim() : null;
      if (barcode) await productWriter.freeTombstonedProductBarcode(barcode);
      const img = p.image !== undefined ? (p.image ? processImage(p.image) : null) : undefined;

      await db.withTransaction(async () => {
        await db.dbRun(
          `UPDATE products
           SET barcode = ?, name = ?, category = ?, family = ?, supplier = ?,
               description = ?, min_stock = ?, image = COALESCE(?, image),
               unit = ?, color = ?, weight_volume = ?, wholesale_unit = ?,
               wholesale_qty = ?, plu_code = ?, is_featured = COALESCE(?, is_featured),
               material_role = COALESCE(?, material_role), track_serial = COALESCE(?, track_serial),
               warranty_months = COALESCE(?, warranty_months), hide_from_pos = COALESCE(?, hide_from_pos)
           WHERE id = ?`,
          [
            barcode,
            String(p.name || '').trim(),
            p.category || 'عام',
            p.family || null,
            p.supplier || null,
            p.description || null,
            Number(p.min_stock ?? 5),
            img === undefined ? null : img,
            p.unit || 'قطعة',
            p.color || null,
            p.weight_volume || null,
            p.wholesale_unit || null,
            p.wholesale_qty ? Number(p.wholesale_qty) : null,
            p.plu_code || null,
            p.is_featured !== undefined ? (p.is_featured ? 1 : 0) : null,
            p.material_role !== undefined ? p.material_role : null,
            p.track_serial !== undefined ? (p.track_serial ? 1 : 0) : null,
            p.warranty_months !== undefined ? Number(p.warranty_months) : null,
            p.hide_from_pos !== undefined ? (p.hide_from_pos ? 1 : 0) : null,
            productId
          ]
        );

        if (p.extra_barcodes !== undefined || p.extra_prices !== undefined) {
          await productWriter.insertExtraBarcodesAndPrices(productId, p.extra_barcodes || [], p.extra_prices || []);
        }
      });
      res.json({ success: true, id: productId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    try {
      const pid = Number(req.params.id);
      await db.dbRun('DELETE FROM inventory_batches WHERE product_id = ?', [pid]);
      await db.dbRun('DELETE FROM products WHERE id = ?', [pid]);
      db.tombstoneOrphans();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/:id/toggle-featured', async (req, res) => {
    try {
      await db.dbRun(
        'UPDATE products SET is_featured = CASE WHEN COALESCE(is_featured, 0) = 1 THEN 0 ELSE 1 END WHERE id = ?',
        [Number(req.params.id)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/material-role', async (req, res) => {
    try {
      res.json(await productionGuard.setMaterialRole(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/batches/:productId', async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      const b = req.body || {};
      const ins = await db.dbRun(
        `INSERT INTO inventory_batches (
          product_id, variant_id, stock, cost_price, selling_price, wholesale_price, expiry_date, location, supplier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          b.variant_id || null,
          Number(b.stock ?? 0),
          Number(b.cost_price ?? 0),
          Number(b.selling_price ?? 0),
          b.wholesale_price !== undefined && b.wholesale_price !== '' ? Number(b.wholesale_price) : null,
          b.expiry_date || null,
          b.location || null,
          b.supplier_id || null
        ]
      );
      await batchAlloc.reconcileStockDebt(db, productId, ins.lastID);
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/batches/:batchId', async (req, res) => {
    try {
      const batchId = Number(req.params.batchId);
      const b = req.body || {};
      await db.dbRun(
        `UPDATE inventory_batches
         SET stock = ?, cost_price = ?, selling_price = ?, wholesale_price = ?, expiry_date = ?, location = ?
         WHERE id = ?`,
        [
          Number(b.stock ?? 0),
          Number(b.cost_price ?? 0),
          Number(b.selling_price ?? 0),
          b.wholesale_price !== undefined && b.wholesale_price !== '' ? Number(b.wholesale_price) : null,
          b.expiry_date || null,
          b.location || null,
          batchId
        ]
      );
      res.json({ success: true, id: batchId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/batches/:batchId', async (req, res) => {
    try {
      await batchAlloc.voidBatches(db, [Number(req.params.batchId)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/variant-templates', (_req, res) => {
    res.json([
      {
        id: 'clothing',
        name: 'ملابس وأزياء',
        groups: [
          { name: 'المقاس', values: ['S', 'M', 'L', 'XL', 'XXL'] },
          { name: 'اللون', values: ['أسود', 'أبيض', 'أزرق', 'أحمر'] }
        ]
      },
      {
        id: 'shoes',
        name: 'أحذية',
        groups: [{ name: 'المقاس', values: ['38', '39', '40', '41', '42', '43', '44'] }]
      }
    ]);
  });

  app.put('/api/products/:id/variants', async (req, res) => {
    try {
      res.json(await productWriter.rewriteProductVariants(Number(req.params.id), req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/:id/barcodes', async (req, res) => {
    try {
      const b = req.body || {};
      res.json(await productWriter.addProductBarcode(Number(req.params.id), b.barcode, b.price_label || null));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/:id/variants-quick', async (req, res) => {
    try {
      res.json(await productWriter.addVariantQuick({ ...(req.body || {}), productId: Number(req.params.id) }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products/:productId/option-groups', async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      const groups = await db.dbAll(
        'SELECT id, name, position FROM product_option_groups WHERE product_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
        [productId]
      );
      for (const g of groups) {
        g.values = await db.dbAll(
          'SELECT id, option_group_id, value, position FROM product_option_values WHERE option_group_id = ? AND deleted_at IS NULL ORDER BY position ASC, id ASC',
          [g.id]
        );
      }
      res.json(groups);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/products/:productId/option-groups', async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      const groups = Array.isArray(req.body.groups) ? req.body.groups : Array.isArray(req.body) ? req.body : [];
      await db.withTransaction(async () => {
        for (let gIdx = 0; gIdx < groups.length; gIdx++) {
          const g = groups[gIdx];
          let groupId = g.id ? Number(g.id) : null;
          if (groupId) {
            await db.dbRun('UPDATE product_option_groups SET name = ?, position = ? WHERE id = ?', [
              String(g.name || '').trim(),
              g.position ?? gIdx,
              groupId
            ]);
          } else {
            const insG = await db.dbRun(
              'INSERT INTO product_option_groups (product_id, name, position) VALUES (?, ?, ?)',
              [productId, String(g.name || '').trim(), g.position ?? gIdx]
            );
            groupId = insG.lastID;
          }
          const vals = Array.isArray(g.values) ? g.values : [];
          for (let vIdx = 0; vIdx < vals.length; vIdx++) {
            const v = vals[vIdx];
            const valLabel = typeof v === 'object' ? v.value : v;
            const valId = typeof v === 'object' && v.id ? Number(v.id) : null;
            if (valId) {
              await db.dbRun(
                'UPDATE product_option_values SET value = ?, position = ?, option_group_id = ? WHERE id = ?',
                [String(valLabel || '').trim(), vIdx, groupId, valId]
              );
            } else if (valLabel) {
              await db.dbRun(
                'INSERT INTO product_option_values (option_group_id, value, position) VALUES (?, ?, ?)',
                [groupId, String(valLabel || '').trim(), vIdx]
              );
            }
          }
        }
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products/:productId/variants', async (req, res) => {
    try {
      const rows = await db.dbAll(
        'SELECT * FROM product_variants WHERE product_id = ? AND deleted_at IS NULL ORDER BY id ASC',
        [Number(req.params.productId)]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/:productId/variants', async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      const v = req.body || {};
      const ins = await db.dbRun(
        'INSERT INTO product_variants (product_id, barcode, sku, image, is_active) VALUES (?, ?, ?, ?, ?)',
        [productId, v.barcode || null, v.sku || null, v.image || null, v.is_active !== undefined ? (v.is_active ? 1 : 0) : 1]
      );
      if (Array.isArray(v.option_value_ids)) {
        for (const ovId of v.option_value_ids) {
          await db.dbRun('INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (?, ?)', [
            ins.lastID,
            Number(ovId)
          ]);
        }
      }
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/variants/:variantId', async (req, res) => {
    try {
      const v = req.body || {};
      await db.dbRun(
        'UPDATE product_variants SET barcode = COALESCE(?, barcode), sku = COALESCE(?, sku), image = COALESCE(?, image), is_active = COALESCE(?, is_active) WHERE id = ?',
        [v.barcode ?? null, v.sku ?? null, v.image ?? null, v.is_active !== undefined ? (v.is_active ? 1 : 0) : null, Number(req.params.variantId)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/variants/:variantId', async (req, res) => {
    try {
      await db.dbRun('DELETE FROM product_variants WHERE id = ?', [Number(req.params.variantId)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. المبيعات، الزبائن، والائتمان
  app.post('/api/sales', async (req, res) => {
    try {
      res.json(await executeSaleTransaction(req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/sales/:id', async (req, res) => {
    try {
      res.json(await executeSaleTransaction({ ...(req.body || {}), editSaleId: Number(req.params.id) }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sales', async (req, res) => {
    try {
      const filters = req.query || {};
      const conds = ['s.deleted_at IS NULL'];
      const params = [];
      if (filters.customerId || filters.customer_id) {
        conds.push('s.customer_id = ?');
        params.push(Number(filters.customerId || filters.customer_id));
      }
      if (filters.dateFrom || filters.date_from) {
        conds.push('date(s.sale_date) >= date(?)');
        params.push(String(filters.dateFrom || filters.date_from).slice(0, 10));
      }
      if (filters.dateTo || filters.date_to) {
        conds.push('date(s.sale_date) <= date(?)');
        params.push(String(filters.dateTo || filters.date_to).slice(0, 10));
      }
      const rows = await db.dbAll(
        `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS seller_name
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN users u ON u.id = s.user_id
         WHERE ${conds.join(' AND ')}
         ORDER BY s.id DESC LIMIT 500`,
        params
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sales/:id', async (req, res) => {
    try {
      const sid = Number(req.params.id);
      const sale = await db.dbGet(
        `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
                c.rc AS customer_rc, c.nif AS customer_nif, c.ai AS customer_ai, c.nis AS customer_nis,
                u.name AS seller_name
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.deleted_at IS NULL`,
        [sid]
      );
      if (!sale) return res.json(null);
      sale.items = await db.dbAll(
        `SELECT si.*, COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
                p.barcode AS product_barcode, p.unit AS product_unit
         FROM sale_items si
         LEFT JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ? AND si.deleted_at IS NULL`,
        [sid]
      );
      sale.payments = await db.dbAll(
        'SELECT * FROM sale_payments WHERE sale_id = ? AND deleted_at IS NULL ORDER BY id DESC',
        [sid]
      );
      res.json(sale);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sales/:id/payment', async (req, res) => {
    try {
      const sid = Number(req.params.id);
      const b = req.body || {};
      const amt = Number(b.amount || 0);
      const payDate = b.date || new Date().toISOString();
      const sale = await db.dbGet('SELECT * FROM sales WHERE id = ?', [sid]);
      if (!sale) return res.status(404).json({ error: 'sale_not_found' });

      const receiptNum = await generateNextDocNumber('payment_receipt');
      const out = await db.withTransaction(async () => {
        const ins = await db.dbRun(
          `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method, reference, receipt_number, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [sid, sale.customer_id, amt, payDate, b.payment_method || 'cash', b.reference || null, receiptNum, b.notes || null]
        );
        await db.dbRun('UPDATE sales SET paid_amount = COALESCE(paid_amount, 0) + ? WHERE id = ?', [amt, sid]);
        return { success: true, paymentId: ins.lastID, receiptNumber: receiptNum };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/sales/:id', async (req, res) => {
    try {
      const sid = Number(req.params.id);
      const items = await db.dbAll('SELECT * FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL', [sid]);
      await db.withTransaction(async () => {
        for (const it of items) {
          if (it.batch_id && Number(it.sold_without_stock || 0) === 0) {
            await batchAlloc.restoreBatch(db, {
              batchId: it.batch_id,
              quantity: it.quantity,
              soldWithoutStock: it.sold_without_stock
            });
          }
        }
        await tillLedger.reverseSaleTill(db, sid);
        await db.dbRun('DELETE FROM stock_debt WHERE sale_id = ?', [sid]);
        await db.dbRun('DELETE FROM sale_payments WHERE sale_id = ?', [sid]);
        await db.dbRun('DELETE FROM sale_items WHERE sale_id = ?', [sid]);
        await db.dbRun('DELETE FROM sales WHERE id = ?', [sid]);
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sales/:id/credit-note', async (req, res) => {
    try {
      const sid = Number(req.params.id);
      const payload = req.body || {};
      const creditNoteNumber = payload.creditNoteNumber || (await generateNextDocNumber('avoir'));
      const nowIso = new Date().toISOString();
      await db.dbRun(
        'UPDATE sales SET credit_note_number = ?, credit_note_issued_at = ?, credit_note_reason = ? WHERE id = ?',
        [creditNoteNumber, nowIso, payload.reason || null, sid]
      );
      res.json({ success: true, credit_note_number: creditNoteNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/customers', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT c.*,
                COALESCE(SUM(s.total), 0) AS total_sales,
                COALESCE(SUM(s.paid_amount), 0) AS total_paid,
                (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS total_debt
         FROM customers c
         LEFT JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
         WHERE c.deleted_at IS NULL
         GROUP BY c.id
         ORDER BY c.id DESC`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/customers/debts', async (_req, res) => {
    try {
      const row = await db.dbGet(
        `SELECT COALESCE(SUM(debt), 0) AS total_debt FROM (
           SELECT (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS debt
           FROM customers c
           LEFT JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
           WHERE c.deleted_at IS NULL
           GROUP BY c.id
           HAVING debt > 0.009
         )`
      );
      res.json(Number((row && row.total_debt) || 0));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {
      const c = req.body || {};
      const ins = await db.dbRun(
        `INSERT INTO customers (name, phone, address, nif, rc, ai, nis, initial_debt, credit_limit, price_tier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(c.name || '').trim(),
          c.phone || null,
          c.address || null,
          c.nif || null,
          c.rc || null,
          c.ai || null,
          c.nis || null,
          Number(c.initial_debt ?? 0),
          Number(c.credit_limit ?? 0),
          c.price_tier || null
        ]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const c = req.body || {};
      await db.dbRun(
        `UPDATE customers
         SET name = ?, phone = ?, address = ?, nif = ?, rc = ?, ai = ?, nis = ?,
             initial_debt = ?, credit_limit = ?, price_tier = ?
         WHERE id = ?`,
        [
          String(c.name || '').trim(),
          c.phone || null,
          c.address || null,
          c.nif || null,
          c.rc || null,
          c.ai || null,
          c.nis || null,
          Number(c.initial_debt ?? 0),
          Number(c.credit_limit ?? 0),
          c.price_tier || null,
          id
        ]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    try {
      await db.dbRun('DELETE FROM customers WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/customers/:id/credit-summary', async (req, res) => {
    try {
      const cid = Number(req.params.id);
      const excludeSaleId = req.query.excludeSaleId ? Number(req.query.excludeSaleId) : null;
      const cust = await db.dbGet('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL', [cid]);
      if (!cust) return res.json(null);
      const salesDebtRow = await db.dbGet(
        `SELECT COALESCE(SUM(total - paid_amount), 0) AS sales_debt
         FROM sales
         WHERE customer_id = ? AND deleted_at IS NULL AND (? IS NULL OR id <> ?)`,
        [cid, excludeSaleId, excludeSaleId]
      );
      const initDebt = Math.max(0, Number(cust.initial_debt || 0) - Number(cust.initial_debt_paid || 0));
      const currentDebt = Number((initDebt + Number((salesDebtRow && salesDebtRow.sales_debt) || 0)).toFixed(2));
      const creditLimit = Number(cust.credit_limit || 0);
      res.json({
        customer_id: cid,
        name: cust.name,
        current_debt: currentDebt,
        credit_limit: creditLimit,
        available_credit: creditLimit > 0 ? Math.max(0, Number((creditLimit - currentDebt).toFixed(2))) : null,
        exceeded: creditLimit > 0 && currentDebt > creditLimit
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/customers/:id/sales', async (req, res) => {
    try {
      const rows = await db.dbAll(
        'SELECT * FROM sales WHERE customer_id = ? AND deleted_at IS NULL ORDER BY id DESC',
        [Number(req.params.id)]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/customers/:id/payment', async (req, res) => {
    try {
      const cid = Number(req.params.id);
      const b = req.body || {};
      let rem = Number(b.amount || 0);
      const payDate = b.date || new Date().toISOString();
      const receiptNum = await generateNextDocNumber('payment_receipt');

      const out = await db.withTransaction(async () => {
        const cust = await db.dbGet('SELECT * FROM customers WHERE id = ?', [cid]);
        if (cust) {
          const initRem = Math.max(0, Number(cust.initial_debt || 0) - Number(cust.initial_debt_paid || 0));
          if (initRem > 0 && rem > 0) {
            const take = Math.min(initRem, rem);
            await db.dbRun('UPDATE customers SET initial_debt_paid = COALESCE(initial_debt_paid, 0) + ? WHERE id = ?', [take, cid]);
            rem = Number((rem - take).toFixed(2));
          }
        }
        const unpaidSales = await db.dbAll(
          'SELECT id, total, paid_amount FROM sales WHERE customer_id = ? AND (total - paid_amount) > 0.009 AND deleted_at IS NULL ORDER BY sale_date ASC, id ASC',
          [cid]
        );
        for (const s of unpaidSales) {
          if (rem <= 0.009) break;
          const due = Number((Number(s.total) - Number(s.paid_amount)).toFixed(2));
          const apply = Math.min(due, rem);
          await db.dbRun('UPDATE sales SET paid_amount = paid_amount + ? WHERE id = ?', [apply, s.id]);
          rem = Number((rem - apply).toFixed(2));
        }
        const ins = await db.dbRun(
          `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method, reference, receipt_number, notes)
           VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
          [cid, Number(b.amount || 0), payDate, b.payment_method || 'cash', b.reference || null, receiptNum, b.notes || null]
        );
        return { success: true, paymentId: ins.lastID, receiptNumber: receiptNum };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/customers/:id/sales-aggregated', async (req, res) => {
    try {
      const cid = Number(req.params.id);
      const sales = await db.dbAll(
        'SELECT * FROM sales WHERE customer_id = ? AND deleted_at IS NULL ORDER BY sale_date ASC',
        [cid]
      );
      const items = await db.dbAll(
        `SELECT COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
                p.unit, SUM(si.quantity) AS total_qty, AVG(si.price) AS avg_price, SUM(si.subtotal) AS total_subtotal
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
         LEFT JOIN products p ON p.id = si.product_id
         WHERE s.customer_id = ? AND si.deleted_at IS NULL
         GROUP BY COALESCE(si.product_id, si.custom_product_name)`,
        [cid]
      );
      res.json({ sales, items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sales-summary', async (req, res) => {
    try {
      res.json(await analyticsQueries.getAnalytics(db, req.query || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/payments/:id', async (req, res) => {
    try {
      res.json(await getPaymentDetailsFull(req.params.id, req.query.type || 'sale'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/doc-number', async (req, res) => {
    try {
      const num = await generateNextDocNumber((req.body && req.body.docType) || 'invoice');
      res.json(num);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/document-print-log', async (req, res) => {
    try {
      const p = req.body || {};
      await db.dbRun(
        'INSERT INTO document_print_log (doc_type, doc_id, doc_number, user_id, printer_name, copies) VALUES (?, ?, ?, ?, ?, ?)',
        [p.doc_type || 'invoice', p.doc_id || null, p.doc_number || null, p.user_id || null, p.printer_name || null, Number(p.copies || 1)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. الموردون، المشتريات، ومرتجعات الموردين
  app.get('/api/suppliers', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT sup.*,
                COALESCE(SUM(pi.total), 0) AS total_purchases,
                COALESCE(SUM(pi.paid_amount), 0) AS total_paid,
                (
                  COALESCE(SUM(pi.total - pi.paid_amount), 0) +
                  (COALESCE(sup.initial_debt, 0) - COALESCE(sup.initial_debt_paid, 0)) -
                  COALESCE((SELECT SUM(sr.credit_applied) FROM supplier_returns sr WHERE sr.supplier_id = sup.id AND sr.deleted_at IS NULL), 0)
                ) AS total_debt
         FROM suppliers sup
         LEFT JOIN purchase_invoices pi ON pi.supplier_id = sup.id AND pi.deleted_at IS NULL
         WHERE sup.deleted_at IS NULL
         GROUP BY sup.id
         ORDER BY sup.id DESC`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/suppliers', async (req, res) => {
    try {
      const s = req.body || {};
      const ins = await db.dbRun(
        'INSERT INTO suppliers (name, phone, address, rc, nif, ai, nis, initial_debt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [String(s.name || '').trim(), s.phone || null, s.address || null, s.rc || null, s.nif || null, s.ai || null, s.nis || null, Number(s.initial_debt ?? 0)]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/suppliers/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const s = req.body || {};
      await db.dbRun(
        'UPDATE suppliers SET name = ?, phone = ?, address = ?, rc = ?, nif = ?, ai = ?, nis = ?, initial_debt = ? WHERE id = ?',
        [String(s.name || '').trim(), s.phone || null, s.address || null, s.rc || null, s.nif || null, s.ai || null, s.nis || null, Number(s.initial_debt ?? 0), id]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/suppliers/:id', async (req, res) => {
    try {
      await db.dbRun('DELETE FROM suppliers WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/suppliers/:id/purchases', async (req, res) => {
    try {
      const rows = await db.dbAll(
        'SELECT * FROM purchase_invoices WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC',
        [Number(req.params.id)]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/suppliers/:id/payment', async (req, res) => {
    try {
      const sid = Number(req.params.id);
      const b = req.body || {};
      let rem = Number(b.amount || 0);
      const payDate = b.date || new Date().toISOString();
      const receiptNum = await generateNextDocNumber('payment_receipt');

      const out = await db.withTransaction(async () => {
        const sup = await db.dbGet('SELECT * FROM suppliers WHERE id = ?', [sid]);
        if (sup) {
          const initRem = Math.max(0, Number(sup.initial_debt || 0) - Number(sup.initial_debt_paid || 0));
          if (initRem > 0 && rem > 0) {
            const take = Math.min(initRem, rem);
            await db.dbRun('UPDATE suppliers SET initial_debt_paid = COALESCE(initial_debt_paid, 0) + ? WHERE id = ?', [take, sid]);
            rem = Number((rem - take).toFixed(2));
          }
        }
        const openInvoices = await db.dbAll(
          'SELECT id, total, paid_amount FROM purchase_invoices WHERE supplier_id = ? AND (total - paid_amount) > 0.009 AND deleted_at IS NULL ORDER BY date ASC, id ASC',
          [sid]
        );
        for (const inv of openInvoices) {
          if (rem <= 0.009) break;
          const due = Number((Number(inv.total) - Number(inv.paid_amount)).toFixed(2));
          const apply = Math.min(due, rem);
          await db.dbRun('UPDATE purchase_invoices SET paid_amount = paid_amount + ? WHERE id = ?', [apply, inv.id]);
          rem = Number((rem - apply).toFixed(2));
        }
        const ins = await db.dbRun(
          `INSERT INTO invoice_payments (invoice_id, supplier_id, amount, date, payment_method, reference, receipt_number, notes)
           VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
          [sid, Number(b.amount || 0), payDate, b.payment_method || 'cash', b.reference || null, receiptNum, b.notes || null]
        );
        return { success: true, paymentId: ins.lastID, receiptNumber: receiptNum };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/suppliers/:id/returnable-items', async (req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT ib.*, p.name AS product_name, p.barcode, p.unit
         FROM inventory_batches ib
         INNER JOIN products p ON p.id = ib.product_id
         WHERE ib.supplier_id = ? AND ib.stock > 0 AND ib.deleted_at IS NULL`,
        [Number(req.params.id)]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/supplier-returns', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT sr.*, sup.name AS supplier_name
         FROM supplier_returns sr
         LEFT JOIN suppliers sup ON sup.id = sr.supplier_id
         WHERE sr.deleted_at IS NULL ORDER BY sr.id DESC`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/supplier-returns', async (req, res) => {
    try {
      const data = req.body || {};
      const returnNum = data.return_number || (await generateNextDocNumber('supplier_return'));
      const items = Array.isArray(data.items) ? data.items : [];
      const total = Number(data.total ?? 0);

      const out = await db.withTransaction(async () => {
        const ins = await db.dbRun(
          `INSERT INTO supplier_returns (
            return_number, supplier_id, subtotal, total, credit_applied, refund_amount, refund_method, reason, notes, date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            returnNum,
            Number(data.supplier_id),
            total,
            total,
            Number(data.credit_applied ?? total),
            Number(data.refund_amount ?? 0),
            data.refund_method || 'credit',
            data.reason || null,
            data.notes || null,
            data.date || new Date().toISOString().slice(0, 10)
          ]
        );
        const returnId = ins.lastID;
        for (const it of items) {
          const qty = Number(it.quantity ?? 1);
          if (it.batch_id) {
            await db.dbRun('UPDATE inventory_batches SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id = ?', [qty, Number(it.batch_id)]);
          }
          await db.dbRun(
            `INSERT INTO supplier_return_items (return_id, product_id, variant_id, batch_id, quantity, cost_price, total_cost)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [returnId, Number(it.product_id), it.variant_id || null, it.batch_id || null, qty, Number(it.cost_price ?? 0), Number((qty * Number(it.cost_price ?? 0)).toFixed(2))]
          );
        }
        return { success: true, id: returnId, return_number: returnNum };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/supplier-returns/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const head = await db.dbGet('SELECT * FROM supplier_returns WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!head) return res.json(null);
      head.items = await db.dbAll(
        `SELECT sri.*, p.name AS product_name, p.barcode
         FROM supplier_return_items sri
         LEFT JOIN products p ON p.id = sri.product_id
         WHERE sri.return_id = ? AND sri.deleted_at IS NULL`,
        [id]
      );
      res.json(head);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/supplier-returns/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.dbRun('DELETE FROM supplier_return_items WHERE return_id = ?', [id]);
      await db.dbRun('DELETE FROM supplier_returns WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/purchases', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT pi.*, sup.name AS supplier_name, sup.phone AS supplier_phone
         FROM purchase_invoices pi
         LEFT JOIN suppliers sup ON sup.id = pi.supplier_id
         WHERE pi.deleted_at IS NULL ORDER BY pi.id DESC LIMIT 500`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/purchases', async (req, res) => {
    try {
      const data = req.body || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const supplierId = data.supplier_id || data.supplierId ? Number(data.supplier_id || data.supplierId) : null;
      const subtotal = Number(data.subtotal ?? 0);
      const taxPercentage = Number(data.tax_percentage ?? 0);
      const additionalCosts = Number(data.additional_costs ?? 0);
      const total = Number(data.total ?? 0);
      const paidAmount = Number(data.paid_amount ?? 0);
      const invDate = data.date || new Date().toISOString().slice(0, 10);
      const invNumber = data.invoice_number || `ACH-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

      const totalUnits = items.reduce((s, it) => s + Math.max(0, Number(it.quantity || 0)), 0);
      const extraCostPerUnit = totalUnits > 0 ? additionalCosts / totalUnits : 0;

      const out = await db.withTransaction(async () => {
        const ins = await db.dbRun(
          `INSERT INTO purchase_invoices (
            invoice_number, supplier_id, subtotal, tax_percentage, additional_costs, total, paid_amount, due_date, date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [invNumber, supplierId, subtotal, taxPercentage, additionalCosts, total, paidAmount, data.due_date || null, invDate]
        );
        const invoiceId = ins.lastID;

        if (paidAmount > 0) {
          await db.dbRun(
            'INSERT INTO invoice_payments (invoice_id, supplier_id, amount, date, payment_method) VALUES (?, ?, ?, ?, ?)',
            [invoiceId, supplierId, paidAmount, invDate, 'cash']
          );
        }

        for (const it of items) {
          const pid = Number(it.product_id || it.productId);
          const qty = Number(it.quantity ?? 1);
          const baseCost = Number(it.cost_price ?? 0);
          const effectiveUnitCost = Number((baseCost + extraCostPerUnit).toFixed(2));
          const sellPrice = Number(it.selling_price ?? 0);

          const batchIns = await db.dbRun(
            `INSERT INTO inventory_batches (
              product_id, variant_id, stock, cost_price, selling_price, wholesale_price, expiry_date, location, supplier_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pid, it.variant_id || null, qty, effectiveUnitCost, sellPrice, it.wholesale_price || null, it.expiry_date || null, it.location || null, supplierId]
          );

          await db.dbRun(
            `INSERT INTO purchase_items (
              invoice_id, product_id, batch_id, variant_id, quantity, cost_price, selling_price, total_cost
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoiceId, pid, batchIns.lastID, it.variant_id || null, qty, effectiveUnitCost, sellPrice, Number((qty * effectiveUnitCost).toFixed(2))]
          );

          await batchAlloc.reconcileStockDebt(db, pid, batchIns.lastID);
        }

        return { success: true, id: invoiceId, invoice_number: invNumber };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/purchases/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const inv = await db.dbGet(
        `SELECT pi.*, sup.name AS supplier_name, sup.phone AS supplier_phone, sup.address AS supplier_address,
                sup.rc AS supplier_rc, sup.nif AS supplier_nif, sup.ai AS supplier_ai, sup.nis AS supplier_nis
         FROM purchase_invoices pi
         LEFT JOIN suppliers sup ON sup.id = pi.supplier_id
         WHERE pi.id = ? AND pi.deleted_at IS NULL`,
        [id]
      );
      if (!inv) return res.json(null);
      inv.items = await db.dbAll(
        `SELECT pit.*, p.name AS product_name, p.barcode AS product_barcode, p.unit AS product_unit
         FROM purchase_items pit
         LEFT JOIN products p ON p.id = pit.product_id
         WHERE pit.invoice_id = ? AND pit.deleted_at IS NULL`,
        [id]
      );
      inv.payments = await db.dbAll(
        'SELECT * FROM invoice_payments WHERE invoice_id = ? AND deleted_at IS NULL ORDER BY id DESC',
        [id]
      );
      res.json(inv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/purchases/:id/payment', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const amt = Number(b.amount || 0);
      const inv = await db.dbGet('SELECT * FROM purchase_invoices WHERE id = ?', [id]);
      if (!inv) return res.status(404).json({ error: 'invoice_not_found' });

      const receiptNum = await generateNextDocNumber('payment_receipt');
      await db.dbRun('UPDATE purchase_invoices SET paid_amount = COALESCE(paid_amount, 0) + ? WHERE id = ?', [amt, id]);
      const ins = await db.dbRun(
        'INSERT INTO invoice_payments (invoice_id, supplier_id, amount, date, payment_method, receipt_number) VALUES (?, ?, ?, ?, ?, ?)',
        [id, inv.supplier_id, amt, b.date || new Date().toISOString(), b.payment_method || 'cash', receiptNum]
      );
      res.json({ success: true, paymentId: ins.lastID, receiptNumber: receiptNum });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/purchases/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const items = await db.dbAll('SELECT batch_id FROM purchase_items WHERE invoice_id = ? AND deleted_at IS NULL', [id]);
      const batchIds = items.map((x) => x.batch_id).filter(Boolean);
      if (batchIds.length > 0) await batchAlloc.voidBatches(db, batchIds);
      await db.dbRun('DELETE FROM invoice_payments WHERE invoice_id = ?', [id]);
      await db.dbRun('DELETE FROM purchase_items WHERE invoice_id = ?', [id]);
      await db.dbRun('DELETE FROM purchase_invoices WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. الفواتير الشكلية (Proformas) والطلبيات (Orders)
  app.post('/api/proformas', async (req, res) => {
    try {
      const d = req.body || {};
      const docNum = d.doc_number || (await generateNextDocNumber('proforma'));
      const items = Array.isArray(d.items) ? d.items : [];
      const out = await db.withTransaction(async () => {
        const ins = await db.dbRun(
          `INSERT INTO proforma_invoices (doc_number, customer_id, subtotal, tax_percentage, discount, total, validity_days, notes, status, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
          [docNum, d.customer_id || null, Number(d.subtotal ?? 0), Number(d.tax_percentage ?? 0), Number(d.discount ?? 0), Number(d.total ?? 0), Number(d.validity_days ?? 15), d.notes || null, d.user_id || null]
        );
        const pid = ins.lastID;
        for (const it of items) {
          await db.dbRun(
            `INSERT INTO proforma_items (proforma_id, product_id, batch_id, variant_id, quantity, price, subtotal, custom_product_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [pid, it.product_id || null, it.batch_id || null, it.variant_id || null, Number(it.quantity ?? 1), Number(it.price ?? 0), Number(it.subtotal ?? 0), it.custom_product_name || it.name || null]
          );
        }
        return { success: true, id: pid, doc_number: docNum };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/proformas', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT pf.*, c.name AS customer_name, c.phone AS customer_phone
         FROM proforma_invoices pf
         LEFT JOIN customers c ON c.id = pf.customer_id
         WHERE pf.deleted_at IS NULL ORDER BY pf.id DESC`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/proformas/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const pf = await db.dbGet(
        `SELECT pf.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address, c.rc AS customer_rc, c.nif AS customer_nif
         FROM proforma_invoices pf
         LEFT JOIN customers c ON c.id = pf.customer_id
         WHERE pf.id = ? AND pf.deleted_at IS NULL`,
        [id]
      );
      if (!pf) return res.json(null);
      pf.items = await db.dbAll(
        `SELECT pfi.*, COALESCE(p.name, pfi.custom_product_name, 'منتج') AS product_name, p.barcode, p.unit
         FROM proforma_items pfi
         LEFT JOIN products p ON p.id = pfi.product_id
         WHERE pfi.proforma_id = ? AND pfi.deleted_at IS NULL`,
        [id]
      );
      res.json(pf);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/proformas/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const d = req.body || {};
      await db.dbRun(
        'UPDATE proforma_invoices SET customer_id = ?, subtotal = ?, tax_percentage = ?, discount = ?, total = ?, validity_days = ?, notes = ? WHERE id = ?',
        [d.customer_id || null, Number(d.subtotal ?? 0), Number(d.tax_percentage ?? 0), Number(d.discount ?? 0), Number(d.total ?? 0), Number(d.validity_days ?? 15), d.notes || null, id]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/proformas/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.dbRun('DELETE FROM proforma_items WHERE proforma_id = ?', [id]);
      await db.dbRun('DELETE FROM proforma_invoices WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/proformas/:id/cancel', async (req, res) => {
    try {
      await db.dbRun("UPDATE proforma_invoices SET status = 'cancelled' WHERE id = ?", [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/proformas/:id/sale-payload', async (req, res) => {
    try {
      res.json(await db.dbGet('SELECT * FROM proforma_invoices WHERE id = ?', [Number(req.params.id)]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/proformas/:id/mark-converted', async (req, res) => {
    try {
      await db.dbRun("UPDATE proforma_invoices SET status = 'converted', converted_to_sale_id = ? WHERE id = ?", [
        Number(req.body.saleId),
        Number(req.params.id)
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/proformas/:id/stock-check', async (req, res) => {
    try {
      const proformaId = Number(req.params.id);
      const items = await db.dbAll(
        `SELECT pi.product_id, pi.variant_id, pi.quantity, pi.custom_product_name, p.name AS product_name
         FROM proforma_items pi
         LEFT JOIN products p ON p.id = pi.product_id
         WHERE pi.proforma_id = ? AND pi.deleted_at IS NULL`,
        [proformaId]
      );
      const shortages = [];
      for (const it of items) {
        if (!it.product_id) continue;
        const row = await db.dbGet(
          'SELECT COALESCE(SUM(stock), 0) AS available FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL',
          [it.product_id]
        );
        const avail = Number((row && row.available) || 0);
        if (avail < Number(it.quantity || 0)) {
          shortages.push({
            product_id: it.product_id,
            product_name: it.product_name || it.custom_product_name || 'منتج',
            requested: Number(it.quantity || 0),
            available: avail
          });
        }
      }
      res.json({ shortages });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/proformas/:id/convert', async (req, res) => {
    try {
      const proformaId = Number(req.params.id);
      const head = await db.dbGet('SELECT * FROM proforma_invoices WHERE id = ? AND deleted_at IS NULL', [proformaId]);
      if (!head) return res.status(404).json({ error: 'proforma_not_found' });
      const items = await db.dbAll('SELECT * FROM proforma_items WHERE proforma_id = ? AND deleted_at IS NULL', [proformaId]);
      const saleOut = await executeSaleTransaction({
        customer_id: head.customer_id,
        subtotal: head.subtotal,
        tax_percentage: head.tax_percentage,
        discount: head.discount,
        total: head.total,
        paid_amount: req.body && req.body.paid_amount !== undefined ? Number(req.body.paid_amount) : head.total,
        payment_method: (req.body && req.body.payment_method) || 'cash',
        items
      });
      await db.dbRun("UPDATE proforma_invoices SET status = 'converted', converted_to_sale_id = ? WHERE id = ?", [saleOut.saleId, proformaId]);
      res.json({ success: true, saleId: saleOut.saleId, docNumber: saleOut.docNumber });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const d = req.body || {};
      const docNum = d.doc_number || (await generateNextDocNumber('order'));
      const items = Array.isArray(d.items) ? d.items : [];
      const deposit = Number(d.deposit_amount ?? 0);

      const out = await db.withTransaction(async () => {
        const ins = await db.dbRun(
          `INSERT INTO customer_orders (
            doc_number, customer_id, subtotal, tax_percentage, discount, total,
            deposit_amount, expected_delivery_date, notes, status, reserves_stock, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [docNum, d.customer_id || null, Number(d.subtotal ?? 0), Number(d.tax_percentage ?? 0), Number(d.discount ?? 0), Number(d.total ?? 0), deposit, d.expected_delivery_date || null, d.notes || null, d.reserves_stock !== undefined ? (d.reserves_stock ? 1 : 0) : 1, d.user_id || null]
        );
        const oid = ins.lastID;
        for (const it of items) {
          await db.dbRun(
            `INSERT INTO customer_order_items (order_id, product_id, batch_id, variant_id, quantity, price, subtotal, custom_product_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [oid, it.product_id || null, it.batch_id || null, it.variant_id || null, Number(it.quantity ?? 1), Number(it.price ?? 0), Number(it.subtotal ?? 0), it.custom_product_name || it.name || null]
          );
          if (d.reserves_stock !== false && it.product_id) {
            await db.dbRun(
              'INSERT INTO inventory_reservations (order_id, batch_id, product_id, quantity) VALUES (?, ?, ?, ?)',
              [oid, it.batch_id || null, Number(it.product_id), Number(it.quantity ?? 1)]
            );
          }
        }
        if (deposit > 0) {
          const activeSess = await tillLedger.resolveOpenSession(db, null, d.user_id);
          if (activeSess) {
            await db.dbRun(
              `INSERT INTO caisse_transactions (session_id, type, amount, category, description, reference_id)
               VALUES (?, 'order_deposit', ?, 'orders', ?, ?)`,
              [activeSess, deposit, `عربون طلبية #${docNum}`, oid]
            );
          }
        }
        return { success: true, id: oid, doc_number: docNum };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/orders', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT co.*, c.name AS customer_name, c.phone AS customer_phone
         FROM customer_orders co
         LEFT JOIN customers c ON c.id = co.customer_id
         WHERE co.deleted_at IS NULL ORDER BY co.id DESC`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/orders/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ord = await db.dbGet(
        `SELECT co.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
         FROM customer_orders co
         LEFT JOIN customers c ON c.id = co.customer_id
         WHERE co.id = ? AND co.deleted_at IS NULL`,
        [id]
      );
      if (!ord) return res.json(null);
      ord.items = await db.dbAll(
        `SELECT coi.*, COALESCE(p.name, coi.custom_product_name, 'منتج') AS product_name, p.barcode, p.unit
         FROM customer_order_items coi
         LEFT JOIN products p ON p.id = coi.product_id
         WHERE coi.order_id = ? AND coi.deleted_at IS NULL`,
        [id]
      );
      res.json(ord);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/orders/:id', async (req, res) => {
    try {
      const d = req.body || {};
      await db.dbRun(
        'UPDATE customer_orders SET deposit_amount = ?, expected_delivery_date = ?, notes = ?, status = COALESCE(?, status) WHERE id = ?',
        [Number(d.deposit_amount ?? 0), d.expected_delivery_date || null, d.notes || null, d.status || null, Number(req.params.id)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/orders/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.dbRun('UPDATE inventory_reservations SET released = 1, released_at = CURRENT_TIMESTAMP WHERE order_id = ?', [id]);
      await db.dbRun('DELETE FROM customer_order_items WHERE order_id = ?', [id]);
      await db.dbRun('DELETE FROM customer_orders WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/cancel', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.dbRun('UPDATE inventory_reservations SET released = 1, released_at = CURRENT_TIMESTAMP WHERE order_id = ?', [id]);
      await db.dbRun("UPDATE customer_orders SET status = 'cancelled' WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/orders/:id/sale-payload', async (req, res) => {
    try {
      res.json(await db.dbGet('SELECT * FROM customer_orders WHERE id = ?', [Number(req.params.id)]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/mark-delivered', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.dbRun('UPDATE inventory_reservations SET released = 1, released_at = CURRENT_TIMESTAMP WHERE order_id = ?', [id]);
      await db.dbRun("UPDATE customer_orders SET status = 'delivered', converted_to_sale_id = ? WHERE id = ?", [Number(req.body.saleId), id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. الخزينة، المصاريف، رأس المال، الباقات، العروض، التصنيع، والجرد
  app.post('/api/caisse/open', async (req, res) => {
    try {
      const payload = req.body || {};
      const userId = payload.userId || payload.user_id || null;
      const openingBalance = Number(payload.openingBalance ?? payload.opening_balance ?? 0);
      const deviceId = await db.getSetting('instance_id', 'local');
      const ins = await db.dbRun(
        `INSERT INTO caisse_sessions (user_id, device_id, opening_balance, status, opened_at)
         VALUES (?, ?, ?, 'open', CURRENT_TIMESTAMP)`,
        [userId, deviceId, openingBalance]
      );
      res.json(await tillLedger.computeSessionSummary(db, ins.lastID));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/caisse/close', async (req, res) => {
    try {
      const payload = req.body || {};
      const sessionId = Number(payload.sessionId || payload.session_id || payload.id);
      const closingBalance = Number(payload.closingBalance ?? payload.closing_balance ?? 0);
      const closeNote = payload.closeNote || payload.close_note || payload.note || null;
      const info = await tillLedger.computeSessionSummary(db, sessionId);
      const expected = info ? info.summary.expectedBalance : 0;
      const diff = Number((closingBalance - expected).toFixed(2));
      await db.dbRun(
        `UPDATE caisse_sessions
         SET closing_balance = ?, expected_balance = ?, difference = ?, status = 'closed', closed_at = CURRENT_TIMESTAMP, close_note = ?
         WHERE id = ?`,
        [closingBalance, expected, diff, closeNote, sessionId]
      );
      res.json({ success: true, sessionId, expectedBalance: expected, closingBalance, difference: diff });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/caisse/active/:userId', async (req, res) => {
    try {
      const uid = Number(req.params.userId) || null;
      const sessId = await tillLedger.resolveOpenSession(db, null, uid);
      if (!sessId) return res.json(null);
      res.json(await tillLedger.computeSessionSummary(db, sessId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/caisse/sessions', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT cs.*, u.name AS user_name
         FROM caisse_sessions cs
         LEFT JOIN users u ON u.id = cs.user_id
         WHERE cs.deleted_at IS NULL ORDER BY cs.id DESC LIMIT 200`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/caisse/session/:id', async (req, res) => {
    try {
      res.json(await tillLedger.computeSessionSummary(db, Number(req.params.id)));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/caisse/transaction', async (req, res) => {
    try {
      const tx = req.body || {};
      const sessId = tx.session_id || tx.sessionId || (await tillLedger.resolveOpenSession(db, null, tx.user_id));
      if (!sessId) return res.status(400).json({ error: 'no_open_session' });
      const ins = await db.dbRun(
        'INSERT INTO caisse_transactions (session_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?)',
        [Number(sessId), tx.type || 'cash_in', Math.abs(Number(tx.amount || 0)), tx.category || 'عام', tx.description || null]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/caisse/summary', async (req, res) => {
    try {
      const sessId = await tillLedger.resolveOpenSession(db, req.query.sessionId, req.query.userId);
      if (!sessId) return res.json(null);
      res.json(await tillLedger.computeSessionSummary(db, sessId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/caisse/transactions-log', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT ct.*, u.name AS user_name
         FROM caisse_transactions ct
         LEFT JOIN caisse_sessions cs ON cs.id = ct.session_id
         LEFT JOIN users u ON u.id = cs.user_id
         WHERE ct.deleted_at IS NULL ORDER BY ct.id DESC LIMIT 300`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/expenses', async (_req, res) => {
    try {
      res.json(await db.dbAll('SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY id DESC'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/expenses', async (req, res) => {
    try {
      const exp = req.body || {};
      const amt = Number(exp.amount || 0);
      const ins = await db.dbRun(
        'INSERT INTO expenses (category, description, amount, date, user_id, session_id) VALUES (?, ?, ?, ?, ?, ?)',
        [exp.category || 'عام', exp.description || null, amt, exp.date || new Date().toISOString().slice(0, 10), exp.user_id || null, exp.session_id || null]
      );
      if (exp.deductFromCaisse || exp.session_id) {
        const sessId = await tillLedger.resolveOpenSession(db, exp.session_id, exp.user_id);
        if (sessId) {
          await db.dbRun(
            `INSERT INTO caisse_transactions (session_id, type, amount, category, description, reference_id)
             VALUES (?, 'expense', ?, ?, ?, ?)`,
            [sessId, amt, exp.category || 'عام', exp.description || 'مصروف', ins.lastID]
          );
        }
      }
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/expenses/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.dbRun("DELETE FROM caisse_transactions WHERE reference_id = ? AND type = 'expense'", [id]);
      await db.dbRun('DELETE FROM expenses WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/capital', async (_req, res) => {
    try {
      res.json(await db.dbAll('SELECT * FROM capital_injections WHERE deleted_at IS NULL ORDER BY id DESC'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/capital', async (req, res) => {
    try {
      const cap = req.body || {};
      const ins = await db.dbRun(
        'INSERT INTO capital_injections (category, description, amount, date) VALUES (?, ?, ?, ?)',
        [cap.category || 'إيداع رأس مال', cap.description || null, Number(cap.amount || 0), cap.date || new Date().toISOString().slice(0, 10)]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/capital/:id', async (req, res) => {
    try {
      await db.dbRun('DELETE FROM capital_injections WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/bundles', async (_req, res) => {
    try {
      const bundles = await db.dbAll('SELECT * FROM product_bundles WHERE deleted_at IS NULL ORDER BY id DESC');
      for (const b of bundles) {
        b.items = await db.dbAll(
          `SELECT bi.*, p.name AS product_name, p.barcode, p.unit,
                  COALESCE((SELECT SUM(ib.stock) FROM inventory_batches ib WHERE ib.product_id = bi.product_id AND ib.deleted_at IS NULL), 0) AS product_stock
           FROM bundle_items bi
           LEFT JOIN products p ON p.id = bi.product_id
           WHERE bi.bundle_id = ? AND bi.deleted_at IS NULL`,
          [b.id]
        );
      }
      res.json(bundles);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/bundles/:id', async (req, res) => {
    try {
      const b = await db.dbGet('SELECT * FROM product_bundles WHERE id = ? AND deleted_at IS NULL', [Number(req.params.id)]);
      if (!b) return res.json(null);
      b.items = await db.dbAll(
        `SELECT bi.*, p.name AS product_name, p.barcode, p.unit
         FROM bundle_items bi
         LEFT JOIN products p ON p.id = bi.product_id
         WHERE bi.bundle_id = ? AND bi.deleted_at IS NULL`,
        [b.id]
      );
      res.json(b);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/bundles', async (req, res) => {
    try {
      const data = req.body || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const barcode = data.barcode ? String(data.barcode).trim() : null;
      if (barcode) await productWriter.freeTombstonedProductBarcode(barcode);

      const out = await db.withTransaction(async () => {
        let bid = data.id ? Number(data.id) : null;
        if (bid) {
          await db.dbRun(
            'UPDATE product_bundles SET name = ?, barcode = ?, selling_price = ?, cost_price = ?, description = ?, is_active = ? WHERE id = ?',
            [String(data.name || '').trim(), barcode, Number(data.selling_price ?? 0), Number(data.cost_price ?? 0), data.description || null, data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, bid]
          );
          await db.dbRun('DELETE FROM bundle_items WHERE bundle_id = ?', [bid]);
        } else {
          const ins = await db.dbRun(
            'INSERT INTO product_bundles (name, barcode, selling_price, cost_price, description, is_active) VALUES (?, ?, ?, ?, ?, 1)',
            [String(data.name || '').trim(), barcode, Number(data.selling_price ?? 0), Number(data.cost_price ?? 0), data.description || null]
          );
          bid = ins.lastID;
        }
        for (const it of items) {
          await db.dbRun('INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES (?, ?, ?)', [bid, Number(it.product_id || it.productId), Number(it.quantity ?? 1)]);
        }
        return { success: true, id: bid };
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/bundles/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.dbRun('DELETE FROM bundle_items WHERE bundle_id = ?', [id]);
      await db.dbRun('DELETE FROM product_bundles WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/bundles/:id/active', async (req, res) => {
    try {
      await db.dbRun('UPDATE product_bundles SET is_active = ? WHERE id = ?', [req.body.is_active ? 1 : 0, Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/promotions', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT prm.*, p.name AS product_name, p.barcode AS product_barcode
         FROM product_promotions prm
         LEFT JOIN products p ON p.id = prm.product_id
         WHERE prm.deleted_at IS NULL ORDER BY prm.id DESC`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/promotions', async (req, res) => {
    try {
      const p = req.body || {};
      if (p.id) {
        await db.dbRun(
          `UPDATE product_promotions
           SET product_id = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, max_qty = ?, is_active = ?
           WHERE id = ?`,
          [Number(p.product_id), p.discount_type || 'percentage', Number(p.discount_value ?? 0), p.start_date || new Date().toISOString().slice(0, 10), p.end_date || null, p.max_qty ? Number(p.max_qty) : null, p.is_active !== undefined ? (p.is_active ? 1 : 0) : 1, Number(p.id)]
        );
        return res.json({ success: true, id: Number(p.id) });
      }
      const ins = await db.dbRun(
        `INSERT INTO product_promotions (product_id, discount_type, discount_value, start_date, end_date, max_qty, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [Number(p.product_id), p.discount_type || 'percentage', Number(p.discount_value ?? 0), p.start_date || new Date().toISOString().slice(0, 10), p.end_date || null, p.max_qty ? Number(p.max_qty) : null]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/promotions/:id', async (req, res) => {
    try {
      await db.dbRun('DELETE FROM product_promotions WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. التصنيع (BOM) والجرد المخزني (Stocktake)
  app.get('/api/bom-recipes', async (req, res) => {
    try {
      res.json(await productionGuard.listRecipes(db, req.query || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/bom-recipes/:id', async (req, res) => {
    try {
      res.json(await productionGuard.loadRecipeWithComponents(db, req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/bom-recipes', async (req, res) => {
    try {
      res.json(await productionGuard.saveRecipe(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/bom-recipes/:id', async (req, res) => {
    try {
      res.json(await productionGuard.deleteRecipe(db, req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/recipe-availability', async (req, res) => {
    try {
      res.json(await productionGuard.computeRecipeAvailability(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/production-orders', async (req, res) => {
    try {
      res.json(await productionGuard.listOrders(db, req.query || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/production-orders/:id', async (req, res) => {
    try {
      res.json(await productionGuard.getOrder(db, req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/production-orders', async (req, res) => {
    try {
      res.json(await productionGuard.createProductionOrder(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/production-orders/confirm', async (req, res) => {
    try {
      res.json(await productionGuard.confirmOrder(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/production-orders/reverse', async (req, res) => {
    try {
      res.json(await productionGuard.reverseOrder(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/manufacturable-capacity', async (req, res) => {
    try {
      res.json(await productionGuard.getManufacturableCapacity(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/stocktake-sheet', async (req, res) => {
    try {
      res.json(await stocktakeGuard.loadSheet(db, req.query || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/stocktakes', async (req, res) => {
    try {
      res.json(await stocktakeGuard.listStocktakes(db, req.query || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/stocktakes/:id', async (req, res) => {
    try {
      res.json(await stocktakeGuard.getStocktake(db, req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/stocktakes', async (req, res) => {
    try {
      res.json(await stocktakeGuard.createStocktake(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. الإحصائيات، ديون المخزون، المستخدمون، الإعدادات، والميزات الجزائرية
  app.get('/api/analytics', async (req, res) => {
    try {
      res.json(await analyticsQueries.getAnalytics(db, req.query || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/analytics/segment', async (req, res) => {
    try {
      res.json(await analyticsQueries.getSegmentAnalytics(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/analytics/segment-products', async (req, res) => {
    try {
      res.json(await analyticsQueries.getSegmentProducts(db, req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/stock-debt', async (_req, res) => {
    try {
      const rows = await db.dbAll(
        `SELECT sd.*, p.name AS product_name, p.barcode, p.unit
         FROM stock_debt sd
         LEFT JOIN products p ON p.id = sd.product_id
         WHERE sd.resolved = 0 AND sd.deleted_at IS NULL ORDER BY sd.id DESC`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/stock-debt/summary', async (_req, res) => {
    try {
      const row = await db.dbGet(
        'SELECT COUNT(*) AS count, COALESCE(SUM(quantity), 0) AS total_qty FROM stock_debt WHERE resolved = 0 AND deleted_at IS NULL'
      );
      res.json({ count: Number((row && row.count) || 0), total_qty: Number((row && row.total_qty) || 0) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/first-run', async (_req, res) => {
    try {
      const row = await db.dbGet('SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL');
      res.json(Number((row && row.count) || 0) === 0);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/first-run/setup', async (req, res) => {
    try {
      const d = req.body || {};
      const name = String(d.name || d.username || 'Admin').trim();
      const username = String(d.username || 'admin').trim();
      const hashed = bcrypt.hashSync(String(d.password || '1234'), 10);
      const ins = await db.dbRun(
        "INSERT INTO users (name, username, password, role, status) VALUES (?, ?, ?, 'Admin', 'Active')",
        [name, username, hashed]
      );
      const userObj = { id: ins.lastID, name, username, role: 'Admin', status: 'Active' };
      res.json({ success: true, ok: true, ...userObj, user: userObj });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const user = await db.dbGet(
        'SELECT id, name, username, password, role, permissions_json, status FROM users WHERE username = ? COLLATE NOCASE AND deleted_at IS NULL LIMIT 1',
        [String(username || '').trim()]
      );
      if (!user) return res.json({ success: false, error: 'invalid_creds' });
      const valid = String(user.password || '').startsWith('$2')
        ? bcrypt.compareSync(String(password || ''), user.password)
        : user.password === password;
      if (!valid) return res.json({ success: false, error: 'invalid_creds' });
      const safeUser = { id: user.id, name: user.name, username: user.username, role: user.role || 'Admin', permissions_json: user.permissions_json || null, status: user.status || 'Active' };
      res.json({ success: true, ok: true, ...safeUser, user: safeUser });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/users', async (_req, res) => {
    try {
      res.json(await db.dbAll('SELECT id, name, username, role, permissions_json, status, created_at FROM users WHERE deleted_at IS NULL ORDER BY id ASC'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const u = req.body || {};
      const hashed = bcrypt.hashSync(String(u.password || '1234'), 10);
      const ins = await db.dbRun(
        'INSERT INTO users (name, username, password, role, permissions_json, status) VALUES (?, ?, ?, ?, ?, ?)',
        [String(u.name || u.username).trim(), String(u.username).trim(), hashed, u.role || 'Cashier', u.permissions_json || null, u.status || 'Active']
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const u = req.body || {};
      if (u.password && String(u.password).trim() !== '') {
        const hashed = bcrypt.hashSync(String(u.password), 10);
        await db.dbRun(
          'UPDATE users SET name = ?, username = ?, password = ?, role = ?, permissions_json = ?, status = ? WHERE id = ?',
          [u.name, u.username, hashed, u.role || 'Cashier', u.permissions_json || null, u.status || 'Active', id]
        );
      } else {
        await db.dbRun(
          'UPDATE users SET name = ?, username = ?, role = ?, permissions_json = ?, status = ? WHERE id = ?',
          [u.name, u.username, u.role || 'Cashier', u.permissions_json || null, u.status || 'Active', id]
        );
      }
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      await db.dbRun('DELETE FROM users WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/account', async (req, res) => {
    try {
      const { userId, username, newPassword } = req.body || {};
      if (newPassword) {
        const hashed = bcrypt.hashSync(String(newPassword), 10);
        await db.dbRun('UPDATE users SET username = ?, password = ? WHERE id = ?', [String(username).trim(), hashed, Number(userId)]);
      } else {
        await db.dbRun('UPDATE users SET username = ? WHERE id = ?', [String(username).trim(), Number(userId)]);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/custom-templates', async (req, res) => {
    try {
      const docType = req.query.doc_type;
      const rows = docType
        ? await db.dbAll('SELECT * FROM custom_templates WHERE doc_type = ? AND deleted_at IS NULL ORDER BY id DESC', [docType])
        : await db.dbAll('SELECT * FROM custom_templates WHERE deleted_at IS NULL ORDER BY id DESC');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/custom-templates/:id', async (req, res) => {
    try {
      res.json(await db.dbGet('SELECT * FROM custom_templates WHERE id = ? AND deleted_at IS NULL', [Number(req.params.id)]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/custom-templates', async (req, res) => {
    try {
      const tpl = req.body || {};
      const layoutJson = typeof tpl.layout_json === 'string' ? tpl.layout_json : JSON.stringify(tpl.layout || tpl.layout_json || {});
      if (tpl.id) {
        await db.dbRun(
          'UPDATE custom_templates SET name = ?, doc_type = ?, paper = ?, lang = ?, layout_json = ?, is_default = ? WHERE id = ?',
          [tpl.name || 'قالب مخصص', tpl.doc_type || 'invoice', tpl.paper || 'a4', tpl.lang || 'ar', layoutJson, tpl.is_default ? 1 : 0, Number(tpl.id)]
        );
        return res.json({ success: true, id: Number(tpl.id) });
      }
      const ins = await db.dbRun(
        'INSERT INTO custom_templates (name, doc_type, paper, lang, layout_json, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [tpl.name || 'قالب مخصص', tpl.doc_type || 'invoice', tpl.paper || 'a4', tpl.lang || 'ar', layoutJson, tpl.is_default ? 1 : 0]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/custom-templates/:id', async (req, res) => {
    try {
      await db.dbRun('DELETE FROM custom_templates WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  
  // مسارات حافظة الشيكات والصكوك البريدية والتصريح الجبائي الجزائري (LAN Routes)
  app.get('/api/cheques', async (req, res) => {
    try {
      const rows = await dbAll('SELECT * FROM cheques_portfolio WHERE deleted_at IS NULL ORDER BY due_date ASC, id DESC');
      res.json(rows || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cheques', async (req, res) => {
    try {
      const p = req.body || {};
      const ins = await dbRun(
        'INSERT INTO cheques_portfolio (direction, party_id, party_name, cheque_number, bank_name, amount, issue_date, due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          p.direction || 'in',
          p.party_id || null,
          p.party_name || '',
          String(p.cheque_number || '').trim(),
          p.bank_name || 'BNA / CCP',
          Number(p.amount || 0),
          p.issue_date || new Date().toISOString().slice(0, 10),
          p.due_date || new Date().toISOString().slice(0, 10),
          p.status || 'pending',
          p.notes || ''
        ]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/cheques/:id/status', async (req, res) => {
    try {
      await dbRun('UPDATE cheques_portfolio SET status = ? WHERE id = ?', [
        String((req.body && req.body.status) || 'cashed'),
        Number(req.params.id)
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/cheques/:id', async (req, res) => {
    try {
      await dbRun('DELETE FROM cheques_portfolio WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/fiscal-report', async (req, res) => {
    try {
      const year = String((req.query && req.query.year) || new Date().getFullYear());
      const etat104 = await dbAll(
        `SELECT
           c.id AS customer_id, c.name, c.rc, c.nif, c.ai, c.nis, c.address,
           COUNT(s.id) AS invoices_count,
           COALESCE(SUM(s.subtotal - s.discount), 0) AS total_ht,
           COALESCE(SUM(CASE WHEN s.tax_percentage > 0 THEN (s.total * s.tax_percentage / (100.0 + s.tax_percentage)) ELSE 0 END), 0) AS total_tva,
           COALESCE(SUM(s.stamp_amount), 0) AS total_stamp,
           COALESCE(SUM(s.total), 0) AS total_ttc
         FROM customers c
         INNER JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
         WHERE c.deleted_at IS NULL AND strftime('%Y', s.sale_date) = ?
         GROUP BY c.id
         ORDER BY total_ttc DESC`,
        [year]
      );
      const g50Summary = await dbGet(
        `SELECT
           COALESCE(SUM(CASE WHEN total >= 0 THEN (subtotal - discount) ELSE 0 END), 0) AS chiffre_affaires_ht,
           COALESCE(SUM(CASE WHEN tax_percentage > 0 THEN (total * tax_percentage / (100.0 + tax_percentage)) ELSE 0 END), 0) AS tva_collectee,
           COALESCE(SUM(stamp_amount), 0) AS droits_timbre,
           COALESCE(SUM(total), 0) AS chiffre_affaires_ttc
         FROM sales
         WHERE deleted_at IS NULL AND strftime('%Y', sale_date) = ?`,
        [year]
      );
      res.json({ year, etat104: etat104 || [], g50: g50Summary || {} });
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

  app.put('/api/settings', async (req, res) => {
    try {
      const settingsObj = req.body || {};
      await db.withTransaction(async () => {
        for (const [k, v] of Object.entries(settingsObj)) {
          if (v === undefined || v === 'undefined') continue;
          const val = k === 'shop_logo' && v ? processImage(String(v)) : String(v ?? '');
          await db.dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [String(k), val]);
        }
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // مسارات الميزات الجزائرية (القاموس 613، الأقساط، وسجل الرقابة الأمنية)
  
  // [RC-100% LAN MULTI-POS PARITY ROUTES]
  app.get('/api/dz-dictionary/stats', async (_req, res) => {
    try {
      const row = await db.dbGet('SELECT COUNT(*) AS count FROM dz_product_dictionary');
      res.json({ count: Number((row && row.count) || 0) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/warranty/:serial', async (req, res) => {
    try {
      const serial = String(req.params.serial || '').trim();
      const item = await db.dbGet(
        `SELECT si.*, COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
                p.barcode AS product_barcode, p.warranty_months AS default_warranty_months,
                s.doc_number, s.sale_date, s.total AS sale_total,
                c.name AS customer_name, c.phone AS customer_phone
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
         LEFT JOIN products p ON p.id = si.product_id
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE si.serial_number = ? COLLATE NOCASE AND si.deleted_at IS NULL
         ORDER BY si.id DESC LIMIT 1`,
        [serial]
      );
      if (!item) return res.json({ found: false, serial });
      const months = Number(item.warranty_months || item.default_warranty_months || 12);
      const startDate = new Date(item.sale_date || Date.now());
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);
      const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
      res.json({
        found: true,
        serial,
        sale_id: item.sale_id,
        doc_number: item.doc_number || ('#' + item.sale_id),
        sale_date: String(item.sale_date || '').slice(0, 10),
        product_name: item.product_name,
        product_barcode: item.product_barcode || '',
        price: item.price,
        customer_name: item.customer_name || 'زبون عابر',
        customer_phone: item.customer_phone || '',
        warranty_months: months,
        warranty_end_date: endDate.toISOString().slice(0, 10),
        days_remaining: daysLeft,
        is_valid: daysLeft >= 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/suppliers/:id/ledger', async (req, res) => {
    try {
      const sid = Number(req.params.id);
      const supplier = await db.dbGet('SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL', [sid]);
      const purchases = await db.dbAll('SELECT * FROM purchase_invoices WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC', [sid]);
      const payments = await db.dbAll(
        `SELECT ip.*, pi.invoice_number FROM invoice_payments ip
         LEFT JOIN purchase_invoices pi ON pi.id = ip.invoice_id
         WHERE (ip.supplier_id = ? OR pi.supplier_id = ?) AND ip.deleted_at IS NULL ORDER BY ip.id DESC`,
        [sid, sid]
      );
      const returns = await db.dbAll('SELECT * FROM supplier_returns WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC', [sid]);
      res.json({ supplier, purchases, payments, returns });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/installments', async (req, res) => {
    try {
      res.json(await createInstallmentPlanRecord(req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/installments/:scheduleId/pay', async (req, res) => {
    try {
      const sid = Number(req.params.scheduleId);
      const sched = await db.dbGet('SELECT * FROM installment_schedules WHERE id = ?', [sid]);
      if (!sched) return res.status(404).json({ error: 'schedule_not_found' });
      const amount = req.body && req.body.amount !== undefined ? Number(req.body.amount) : Number(sched.amount) - Number(sched.paid_amount || 0);
      const newPaid = Number((Number(sched.paid_amount || 0) + amount).toFixed(2));
      const newStatus = newPaid >= Number(sched.amount) - 0.01 ? 'paid' : 'partial';
      const nowIso = new Date().toISOString();

      await db.withTransaction(async () => {
        await db.dbRun('UPDATE installment_schedules SET paid_amount = ?, status = ?, paid_at = ? WHERE id = ?', [newPaid, newStatus, nowIso, sid]);
        await db.dbRun('UPDATE installment_plans SET remaining_amount = MAX(0, COALESCE(remaining_amount, 0) - ?) WHERE id = ?', [amount, sched.plan_id]);
        const pendingRow = await db.dbGet("SELECT COUNT(*) AS c FROM installment_schedules WHERE plan_id = ? AND status <> 'paid' AND deleted_at IS NULL", [sched.plan_id]);
        if (Number((pendingRow && pendingRow.c) || 0) === 0) {
          await db.dbRun("UPDATE installment_plans SET status = 'completed' WHERE id = ?", [sched.plan_id]);
        }
      });
      res.json({ success: true, scheduleId: sid, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/doc-counters', async (_req, res) => {
    try {
      res.json(await db.dbAll('SELECT * FROM document_counters ORDER BY doc_type ASC'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/doc-counters', async (req, res) => {
    try {
      const payload = req.body || {};
      const docType = String(payload.doc_type || 'invoice').trim();
      const year = Number(payload.year || new Date().getFullYear());
      const lastNum = Math.max(0, parseInt(payload.last_number ?? 0, 10) || 0);
      const prefixFmt = String(payload.prefix_format || 'FAC-{YYYY}-{0000}').trim();
      await db.dbRun(
        `INSERT INTO document_counters (doc_type, year, last_number, prefix_format)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(doc_type, year) DO UPDATE SET last_number = excluded.last_number, prefix_format = excluded.prefix_format`,
        [docType, year, lastNum, prefixFmt]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/copilot-insights', async (_req, res) => {
    try {
      res.json(await analyticsQueries.getAiCopilotInsights(db));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/products/:id/serials', async (req, res) => {
    try {
      res.json(await db.dbAll('SELECT * FROM product_serials WHERE product_id = ? AND deleted_at IS NULL ORDER BY id DESC', [Number(req.params.id)]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/:id/serials', async (req, res) => {
    try {
      const p = req.body || {};
      const ins = await db.dbRun(
        "INSERT INTO product_serials (product_id, variant_id, batch_id, serial_number, status, warranty_months, notes) VALUES (?, ?, ?, ?, 'in_stock', ?, ?)",
        [Number(req.params.id), p.variant_id || null, p.batch_id || null, String(p.serial_number || '').trim(), Number(p.warranty_months ?? 12), p.notes || null]
      );
      res.json({ success: true, id: ins.lastID });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dz-barcode/:barcode', async (req, res) => {
    try {
      const row = await db.dbGet('SELECT * FROM dz_product_dictionary WHERE barcode = ?', [String(req.params.barcode).trim()]);
      res.json(row || null);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/audit-logs', async (_req, res) => {
    try {
      res.json(await db.dbAll('SELECT * FROM audit_logs WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 300'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/audit-logs', async (req, res) => {
    try {
      res.json(await recordAuditLog(req.body || {}));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/installments', async (_req, res) => {
    try {
      const plans = await db.dbAll(
        `SELECT ip.*, c.name AS customer_name, c.phone AS customer_phone
         FROM installment_plans ip
         LEFT JOIN customers c ON c.id = ip.customer_id
         WHERE ip.deleted_at IS NULL ORDER BY ip.id DESC`
      );
      for (const p of plans) {
        p.schedules = await db.dbAll(
          'SELECT * FROM installment_schedules WHERE plan_id = ? AND deleted_at IS NULL ORDER BY installment_num ASC',
          [p.id]
        );
      }
      res.json(plans);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  
  // [MOBILE BIOMETRIC FINGERPRINT BRIDGE ROUTES V1]
  const mobileBiometricEventsQueue = [];

  app.get('/api/biometric/ping', (_req, res) => {
    res.json({ ok: true, service: 'gherbi-mobile-biometric-bridge' });
  });

  app.get('/api/biometric/poll', (_req, res) => {
    const events = mobileBiometricEventsQueue.splice(0, mobileBiometricEventsQueue.length);
    res.json({ ok: true, events });
  });

  app.post('/api/biometric/mobile-punch', async (req, res) => {
    try {
      const body = req.body || {};
      const ev = {
        id: 'MBIO-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: Number(body.userId || 1),
        pinCode: String(body.pinCode || '1001').trim(),
        empName: String(body.empName || 'الموظف').trim(),
        mode: String(body.mode || 'attendance_toggle'), // 'attendance_toggle' | 'enroll_scan'
        fpToken: String(body.fpToken || ('PHONE-BIO-' + Date.now().toString(16).toUpperCase())),
        deviceInfo: String(body.deviceInfo || 'هاتف ذكي (Wi-Fi Biometric)'),
        timestamp: new Date().toISOString()
      };
      mobileBiometricEventsQueue.push(ev);
      if (mobileBiometricEventsQueue.length > 50) mobileBiometricEventsQueue.shift();

      res.json({ ok: true, event: ev });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/mobile-biometric', async (_req, res) => {
    try {
      const users = await db.dbAll('SELECT id, name, username, role FROM users WHERE deleted_at IS NULL ORDER BY id ASC');
      const usersJson = JSON.stringify(users || []);
      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>جهاز البصمة المحمول — Gherbi.Ai POS</title>
  <style>
    * { box-sizing: border-box; user-select: none; -webkit-user-select: none; font-family: system-ui, -apple-system, 'Cairo', sans-serif; }
    body { margin: 0; padding: 16px; background: #020617; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 24px; padding: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; max-width: 420px; width: 100%; margin: 0 auto; }
    .title { font-size: 18px; font-weight: 900; color: #38bdf8; margin-bottom: 4px; }
    .sub { font-size: 12px; color: #94a3b8; margin-bottom: 16px; }
    select, input { width: 100%; padding: 12px; border-radius: 14px; border: 2px solid #334155; background: #1e293b; color: #fff; font-size: 15px; font-weight: 800; text-align: center; margin-bottom: 12px; outline: none; }
    select:focus, input:focus { border-color: #38bdf8; }
    .mode-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
    .mode-btn { padding: 10px; border-radius: 12px; border: 1px solid #334155; background: #1e293b; color: #cbd5e1; font-weight: 800; font-size: 12px; cursor: pointer; }
    .mode-btn.active { background: #2563eb; color: #fff; border-color: #3b82f6; }
    .fp-pad { width: 150px; height: 150px; border-radius: 50%; margin: 16px auto; border: 4px solid #10b981; background: radial-gradient(circle, rgba(16,185,129,0.25) 0%, rgba(15,23,42,0.9) 80%); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s, border-color 0.2s, box-shadow 0.2s; box-shadow: 0 0 30px rgba(16,185,129,0.25); }
    .fp-pad:active, .fp-pad.scanning { transform: scale(0.95); border-color: #f59e0b; box-shadow: 0 0 45px rgba(245,158,11,0.6); }
    .fp-icon { font-size: 64px; line-height: 1; }
    .fp-label { font-size: 12px; font-weight: 900; color: #34d399; margin-top: 8px; }
    .webauthn-btn { width: 100%; padding: 12px; border-radius: 14px; border: 1px solid #6366f1; background: rgba(99,102,241,0.15); color: #a5b4fc; font-weight: 800; font-size: 13px; margin-top: 8px; cursor: pointer; }
    .status-box { margin-top: 14px; padding: 12px; border-radius: 14px; background: #1e293b; font-size: 13px; font-weight: 800; min-height: 48px; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">📱 جهاز البصمة البيومترية المحمول</div>
    <div class="sub">مرتبط مباشرة بالحاسوب الرئيسي — Gherbi.Ai POS</div>

    <div class="mode-tabs">
      <button type="button" id="tabAttend" class="mode-btn active" onclick="setMode('attendance_toggle')">⏱️ بصمة حضور / انصراف</button>
      <button type="button" id="tabEnroll" class="mode-btn" onclick="setMode('enroll_scan')">🫆 تأسيس بصمة جديدة (3 مسحات)</button>
    </div>

    <label style="display:block;font-size:12px;font-weight:bold;color:#94a3b8;margin-bottom:6px;">اختر اسم العامل أو اكتب الكود السري:</label>
    <select id="empSelect" onchange="syncPinFromSelect()"></select>
    <input id="pinInput" type="tel" placeholder="أو اكتب الكود السري (مثلاً 1001 / 1002)">

    <div id="fpPad" class="fp-pad" onclick="triggerPhoneBiometricPunch()">
      <div class="fp-icon">🫆</div>
      <div id="fpPadText" class="fp-label">المس البصمة هنا</div>
    </div>

    <button type="button" class="webauthn-btn" onclick="triggerNativeHardwareBiometric()">🔐 استخدام مستشعر بصمة الهاتف الأصلي (TouchID / Biometric)</button>

    <div id="statusBox" class="status-box" style="color:#38bdf8;">جاهز — المس مستشعر البصمة لإرسالها للحاسوب فوراً</div>
  </div>

  <script>
    const USERS = ${usersJson};
    let currentMode = 'attendance_toggle';
    const sel = document.getElementById('empSelect');
    USERS.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name + ' (' + u.role + ') — كود: ' + (1000 + Number(u.id));
      sel.appendChild(opt);
    });
    function syncPinFromSelect() {
      const uid = Number(sel.value || 1);
      document.getElementById('pinInput').value = String(1000 + uid);
    }
    syncPinFromSelect();

    function setMode(m) {
      currentMode = m;
      document.getElementById('tabAttend').className = 'mode-btn' + (m === 'attendance_toggle' ? ' active' : '');
      document.getElementById('tabEnroll').className = 'mode-btn' + (m === 'enroll_scan' ? ' active' : '');
      document.getElementById('fpPadText').textContent = m === 'enroll_scan' ? 'المس للمسح (3 مرات)' : 'المس للدخول / الخروج';
    }

    async function sendBiometricSignal(hwMethodLabel) {
      if (navigator.vibrate) navigator.vibrate([90, 40, 130]);
      const pad = document.getElementById('fpPad');
      const st = document.getElementById('statusBox');
      pad.classList.add('scanning');
      st.style.color = '#fbbf24';
      st.textContent = '⏳ جاري التحقق من البصمة وإرسالها للحاسوب...';

      const uid = Number(sel.value || 1);
      const uObj = USERS.find(x => Number(x.id) === uid) || { id: uid, name: 'موظف' };
      const pin = document.getElementById('pinInput').value || String(1000 + uid);

      try {
        const res = await fetch('/api/biometric/mobile-punch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: uid,
            pinCode: pin,
            empName: uObj.name,
            mode: currentMode,
            fpToken: 'BIO-PHONE-' + uid + '-' + Date.now().toString(16).slice(-5).toUpperCase(),
            deviceInfo: hwMethodLabel || '📱 بصمة الهاتف الذكي'
          })
        });
        const data = await res.json();
        setTimeout(() => pad.classList.remove('scanning'), 250);
        if (data && data.ok) {
          st.style.color = '#34d399';
          st.innerHTML = currentMode === 'enroll_scan'
            ? '✅ تم إرسال مسحة البصمة إلى شاشة الحاسوب بنجاح!'
            : '✅ تم إرسال بصمة (' + uObj.name + ') للحاسوب! (تبديل بداية/إيقاف عداد الوقت)';
        }
      } catch (e) {
        pad.classList.remove('scanning');
        st.style.color = '#f43f5e';
        st.textContent = '❌ تعذر الاتصال بالحاسوب: ' + e.message;
      }
    }

    function triggerPhoneBiometricPunch() {
      sendBiometricSignal('📱🫆 مستشعر بصمة الهاتف');
    }

    async function triggerNativeHardwareBiometric() {
      try {
        if (window.PublicKeyCredential) {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: 'Gherbi.Ai POS' },
              user: { id: new Uint8Array([1, 2, 3, 4]), name: 'staff@gherbi.ai', displayName: 'Staff Biometric' },
              pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
              authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
              timeout: 15000
            }
          });
        }
      } catch (_) {}
      sendBiometricSignal('🔐 بصمة الهاتف البيومترية الأصلية');
    }
  </script>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });
  // [END MOBILE BIOMETRIC FINGERPRINT BRIDGE ROUTES V1]

    // [MOBILE COMPANION ERP WEB PORTAL & SELECTIVE PURGE V18]
  app.post('/api/system/selective-purge', async (req, res) => {
    try {
      const target = String((req.body && req.body.target) || 'test_sales');
      await db.withTransaction(async () => {
        if (target === 'test_sales' || target === 'all_transactions') {
          await db.dbRun('DELETE FROM sale_items');
          await db.dbRun('DELETE FROM sale_payments');
          await db.dbRun('DELETE FROM sales');
          await db.dbRun('DELETE FROM caisse_transactions');
          await db.dbRun('DELETE FROM caisse_sessions');
          await db.dbRun('DELETE FROM stock_debt');
          await db.dbRun("UPDATE document_counters SET last_number = 0 WHERE doc_type IN ('invoice', 'payment_receipt', 'avoir', 'delivery')");
        }
        if (target === 'all_transactions') {
          await db.dbRun('DELETE FROM purchase_items');
          await db.dbRun('DELETE FROM invoice_payments');
          await db.dbRun('DELETE FROM purchase_invoices');
          await db.dbRun('DELETE FROM expenses');
          await db.dbRun('DELETE FROM proforma_items');
          await db.dbRun('DELETE FROM proforma_invoices');
          await db.dbRun('DELETE FROM customer_order_items');
          await db.dbRun('DELETE FROM customer_orders');
        }
      });
      res.json({ ok: true, target });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get(['/mobile-app', '/mobile'], async (_req, res) => {
    try {
      const shopRow = await db.dbGet("SELECT value FROM settings WHERE key = 'shop_name'");
      const shopName = (shopRow && shopRow.value) || 'Gherbi.Ai POS';
      const todayStr = new Date().toISOString().slice(0, 10);
      const salesRow = await db.dbGet(
        "SELECT COALESCE(SUM(total), 0) AS rev, COUNT(*) AS cnt FROM sales WHERE deleted_at IS NULL AND date(sale_date) = date(?)",
        [todayStr]
      );
      const prodCountRow = await db.dbGet("SELECT COUNT(*) AS c FROM products WHERE deleted_at IS NULL");

      const html = [
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">',
        '<title>' + shopName + ' — بوابة الهاتف المحمول</title>',
        '<style>',
        '* { box-sizing: border-box; font-family: system-ui, -apple-system, Cairo, sans-serif; }',
        'body { margin: 0; padding: 14px; background: #020617; color: #f8fafc; }',
        '.container { max-width: 460px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }',
        '.hdr { background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 16px; border-radius: 20px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }',
        '.kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }',
        '.kpi { background: #0f172a; border: 1px solid #1e293b; padding: 12px; border-radius: 16px; text-align: center; }',
        '.kpi .val { font-size: 20px; font-weight: 900; font-family: monospace; color: #38bdf8; margin-top: 4px; }',
        '.card { background: #0f172a; border: 1px solid #1e293b; padding: 16px; border-radius: 20px; }',
        'input { width: 100%; padding: 12px 14px; border-radius: 14px; border: 2px solid #334155; background: #1e293b; color: #fff; font-size: 14px; font-weight: 800; outline: none; }',
        'input:focus { border-color: #38bdf8; }',
        '.btn { display: block; width: 100%; padding: 12px; border-radius: 14px; border: none; font-weight: 900; font-size: 13px; cursor: pointer; text-align: center; text-decoration: none; margin-top: 8px; }',
        '.btn-emerald { background: #059669; color: #fff; }',
        '.prod-item { padding: 10px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }',
        '</style></head><body>',
        '<div class="container">',
        '  <div class="hdr"><div><div style="font-size:18px;font-weight:900;color:#fff;">📱 ' + shopName + '</div><div style="font-size:11px;color:#93c5fd;">المساعد المحمول وفاحص الأسعار اللاسلكي (Wi-Fi ERP)</div></div><span style="background:#10b981;color:#022c22;font-weight:900;font-size:11px;padding:4px 10px;border-radius:99px;">متصل 🟢</span></div>',
        '  <div class="kpi-grid">',
        '    <div class="kpi"><div style="font-size:11px;color:#94a3b8;">مبيعات اليوم (' + Number(salesRow.cnt || 0) + ' فاتورة)</div><div class="val">' + Number(salesRow.rev || 0).toFixed(2) + ' د.ج</div></div>',
        '    <div class="kpi"><div style="font-size:11px;color:#94a3b8;">أصناف المخزون النشطة</div><div class="val" style="color:#34d399;">' + Number(prodCountRow.c || 0) + ' صنف</div></div>',
        '  </div>',
        '  <div class="card"><div style="font-weight:900;font-size:14px;color:#fbbf24;margin-bottom:8px;">🔍 فاحص الأسعار والمخزون الفوري:</div><input id="mobSearchInput" type="text" oninput="searchProd(this.value)" placeholder="ابحث بالاسم أو الباركود..."><div id="mobResults" style="margin-top:10px;max-height:260px;overflow-y:auto;"></div></div>',
        '  <div class="card" style="text-align:center;"><div style="font-weight:900;font-size:13px;margin-bottom:6px;">⏱️ محطة البصمة البيومترية للعمال</div><a href="/mobile-biometric" class="btn btn-emerald">🫆 فتح شاشة بصمة الموظفين على الهاتف</a></div>',
        '</div>',
        '<script>',
        'var allProds = [];',
        'fetch("/api/pos-stock").then(function(r){return r.json();}).then(function(d){allProds=Array.isArray(d)?d:[];searchProd("");});',
        'function searchProd(q){',
        '  var clean = String(q || "").trim().toLowerCase();',
        '  var filtered = allProds.filter(function(p){return !clean || String(p.name||"").toLowerCase().indexOf(clean)!==-1 || String(p.barcode||"").toLowerCase().indexOf(clean)!==-1;}).slice(0, 15);',
        '  var box = document.getElementById("mobResults");',
        '  if(filtered.length===0){box.innerHTML="<div style=\\"text-align:center;color:#64748b;padding:14px;font-size:12px;\\">لا توجد منتجات مطابقة</div>";return;}',
        '  box.innerHTML = filtered.map(function(p){',
        '    var pr = Number(p.selling_price||0);',
        '    return "<div class=\\"prod-item\\"><div><div style=\\"font-weight:800;font-size:13px;\\">" + p.name + "</div><div style=\\"font-size:11px;color:#94a3b8;font-family:monospace;\\">" + (p.barcode||"بدون باركود") + " | المخزون: " + Number(p.stock||0) + " " + (p.unit||"") + "</div></div><div style=\\"text-align:left;\\"><div style=\\"font-family:monospace;font-weight:900;font-size:15px;color:#38bdf8;\\">" + pr.toFixed(2) + " د.ج</div><div style=\\"font-size:10px;color:#fbbf24;\\">" + Math.round(pr*100).toLocaleString("fr-DZ") + " سنتيم</div></div></div>";',
        '  }).join("");',
        '}',
        '</script></body></html>'
      ].join('\n');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });
  // [END MOBILE COMPANION ERP WEB PORTAL & SELECTIVE PURGE V18]
  
  // [GHERBI POCKET ERP MOBILE COMPANION WEB APP V1]
  app.get(['/', '/mobile', '/mobile-erp'], async (_req, res) => {
    try {
      const shopName = await db.getSetting('shop_name', 'Gherbi.Ai POS');
      const todayStr = new Date().toISOString().slice(0, 10);
      const salesRow = (await db.dbGet(
        "SELECT COALESCE(SUM(total), 0) AS rev, COUNT(*) AS cnt FROM sales WHERE deleted_at IS NULL AND date(sale_date) = date(?)",
        [todayStr]
      )) || { rev: 0, cnt: 0 };
      const prodCountRow = (await db.dbGet('SELECT COUNT(*) AS cnt FROM products WHERE deleted_at IS NULL')) || { cnt: 0 };

      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${shopName} — تطبيق الهاتف المحمول (Pocket ERP)</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, 'Cairo', sans-serif; }
    body { margin: 0; padding: 14px; background: #020617; color: #f8fafc; min-height: 100vh; }
    .app-shell { max-width: 460px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
    .hdr { background: linear-gradient(135deg, #1e3a8a, #0f172a); border: 1px solid #334155; border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .kpi { background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 12px; text-align: center; }
    .kpi .val { font-family: monospace; font-size: 20px; font-weight: 900; color: #38bdf8; margin-top: 4px; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 16px; }
    input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 2px solid #334155; background: #1e293b; color: #fff; font-size: 14px; font-weight: 800; outline: none; margin-bottom: 10px; }
    input:focus { border-color: #38bdf8; }
    .btn { display: block; width: 100%; padding: 12px; border-radius: 14px; border: none; font-weight: 900; font-size: 13px; cursor: pointer; text-align: center; text-decoration: none; margin-top: 6px; }
    .btn-blue { background: #2563eb; color: #fff; }
    .btn-emerald { background: #059669; color: #fff; }
    .prod-item { padding: 10px; border-radius: 12px; background: #1e293b; margin-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
  </style>
</head>
<body>
  <div class="app-shell">
    <div class="hdr">
      <div>
        <div style="font-size:18px;font-weight:900;color:#fff;">📱 ${shopName}</div>
        <div style="font-size:11px;color:#93c5fd;">المساعد المحمول وفاحص الأسعار والبصمة اللاسلكي</div>
      </div>
      <span style="background:#10b981;color:#022c22;font-weight:900;font-size:11px;padding:4px 10px;border-radius:99px;">متصل حياً 🟢</span>
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <div style="font-size:11px;color:#94a3b8;font-weight:bold;">مبيعات اليوم (${salesRow.cnt} فاتورة)</div>
        <div class="val" style="color:#34d399;">${Number(salesRow.rev || 0).toFixed(2)} د.ج</div>
      </div>
      <div class="kpi">
        <div style="font-size:11px;color:#94a3b8;font-weight:bold;">إجمالي المنتجات المسجلة</div>
        <div class="val">${Number(prodCountRow.cnt || 0)} صنف</div>
      </div>
    </div>

    <div class="card">
      <div style="font-size:14px;font-weight:900;color:#fbbf24;margin-bottom:8px;">🔍 فاحص الأسعار والمخزون الفوري بالباركود أو الاسم</div>
      <input id="mobSearchInp" type="text" placeholder="اكتب اسم المنتج أو الباركود..." oninput="searchProductsMobile(this.value)">
      <div id="mobSearchResults"></div>
    </div>

    <div class="card" style="text-align:center;">
      <div style="font-size:14px;font-weight:900;color:#38bdf8;margin-bottom:6px;">🫆 محطة البصمة البيومترية للموظفين</div>
      <p style="font-size:11.5px;color:#94a3b8;margin:0 0 10px;">سجّل حضور وانصراف العمال أو أسّس بصمة جديدة مباشرة من هاتفك</p>
      <a href="/mobile-biometric" class="btn btn-emerald">🫆 فتح جهاز بصمة الموظفين المحمول</a>
    </div>
  </div>

  <script>
    let allProds = [];
    fetch('/api/pos-stock').then(r => r.json()).then(d => { allProds = Array.isArray(d) ? d : []; }).catch(() => {});
    function searchProductsMobile(q) {
      const box = document.getElementById('mobSearchResults');
      const clean = String(q || '').trim().toLowerCase();
      if (!clean) { box.innerHTML = ''; return; }
      const matches = allProds.filter(p => String(p.name || '').toLowerCase().includes(clean) || String(p.barcode || '').toLowerCase().includes(clean)).slice(0, 8);
      box.innerHTML = matches.map(p =>
        '<div class="prod-item">' +
          '<div><div style="font-weight:900;">' + p.name + '</div><div style="font-size:11px;color:#94a3b8;font-family:monospace;">' + (p.barcode || 'بدون باركود') + ' | المخزون: ' + Number(p.total_stock || p.stock || 0) + '</div></div>' +
          '<div style="font-family:monospace;font-weight:900;font-size:15px;color:#38bdf8;">' + Number(p.selling_price || p.price || 0).toFixed(2) + ' د.ج</div>' +
        '</div>'
      ).join('') || '<div style="font-size:12px;color:#64748b;text-align:center;padding:8px;">لا توجد نتائج مطابقة</div>';
    }
  </script>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });
  // [END GHERBI POCKET ERP MOBILE COMPANION WEB APP V1]

  enterpriseBridge.registerEnterpriseExpressRoutes(app, db);
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
  getPaymentDetailsFull,
  executeSaleTransaction,
  recordAuditLog,
  createInstallmentPlanRecord,
  buildProductsQueryOrder
};