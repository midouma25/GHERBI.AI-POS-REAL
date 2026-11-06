/**
 * till-ledger.js
 * محرك إدارة جلسات الخزينة (Caisse Sessions) وحساب الأرصدة ومزامنة المبيعات النقدية
 */

'use strict';

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onDone(err) {
      if (err) return reject(err);
      resolve({ lastID: this ? this.lastID : null, changes: this ? this.changes : 0 });
    });
  });
}

/**
 * إيجاد الجلسة المفتوحة حالياً للمستخدم أو للجهاز الحالي
 */
async function resolveOpenSession(db, preferredSessionId = null, userId = null, deviceId = null) {
  if (preferredSessionId && Number(preferredSessionId) > 0) {
    const row = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE id = ? AND status = 'open' AND deleted_at IS NULL",
      [Number(preferredSessionId)]
    );
    if (row && row.id) return row.id;
  }

  // عزل صارم لكل حساب مستخدم: إذا تم تمرير userId نبحث عن المناوبة المفتوحة الخاصة بهذا الحساب تحديداً
  if (userId && Number(userId) > 0) {
    const userRow = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE user_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1",
      [Number(userId)]
    );
    if (userRow && userRow.id) return userRow.id;

    // في حال وجود مناوبة مفتوحة قديمة بدون user_id على نفس الجهاز نربطها به
    const unownedRow = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE user_id IS NULL AND status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1"
    );
    if (unownedRow && unownedRow.id) return unownedRow.id;
    const fallbackOpen = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1"
    );
    return fallbackOpen ? fallbackOpen.id : null;
  }

  if (deviceId) {
    const devRow = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE device_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1",
      [String(deviceId)]
    );
    if (devRow && devRow.id) return devRow.id;
  }

  const anyOpen = await dbGet(
    db,
    "SELECT id FROM caisse_sessions WHERE status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1"
  );
  return anyOpen ? anyOpen.id : null;
}

/**
 * حساب ملخص جلسة خزينة محددة والرصيد المتوقع في الدرج
 */
async function computeSessionSummary(db, sessionId) {
  const session = await dbGet(
    db,
    `
    SELECT cs.*, u.name AS user_name, u.role AS user_role
    FROM caisse_sessions cs
    LEFT JOIN users u ON u.id = cs.user_id
    WHERE cs.id = ? AND cs.deleted_at IS NULL
    `,
    [Number(sessionId)]
  );
  if (!session) return null;

  const txs = await dbAll(
    db,
    `
    SELECT *, COALESCE(updated_at, created_at) AS created_at
    FROM caisse_transactions
    WHERE session_id = ? AND deleted_at IS NULL
    ORDER BY id DESC
    `,
    [Number(sessionId)]
  );

  let totalSalesCash = 0;
  let totalDebtPayments = 0;
  let totalOrderDeposits = 0;
  let totalCashIn = 0;
  let totalCashOut = 0;
  let totalExpenses = 0;
  let totalRefunds = 0;

  for (const tx of txs) {
    const amt = Math.abs(Number(tx.amount || 0));
    switch (tx.type) {
      case 'sale_cash':
      case 'sale':
        totalSalesCash += amt;
        break;
      case 'debt_payment':
        totalDebtPayments += amt;
        break;
      case 'order_deposit':
        totalOrderDeposits += amt;
        break;
      case 'cash_in':
        totalCashIn += amt;
        break;
      case 'cash_out':
        totalCashOut += amt;
        break;
      case 'expense':
        totalExpenses += amt;
        break;
      case 'sale_refund':
        totalRefunds += amt;
        break;
      default:
        if (Number(tx.amount) >= 0) totalCashIn += amt;
        else totalCashOut += amt;
        break;
    }
  }

  const openingBalance = Number(session.opening_balance || 0);
  const currentBalance = Number(
    (
      openingBalance +
      totalSalesCash +
      totalDebtPayments +
      totalOrderDeposits +
      totalCashIn -
      totalCashOut -
      totalExpenses -
      totalRefunds
    ).toFixed(2)
  );

  return {
    session,
    transactions: txs,
    summary: {
      openingBalance,
      totalSalesCash: Number((totalSalesCash + totalDebtPayments + totalOrderDeposits).toFixed(2)),
      totalDebtPayments: Number(totalDebtPayments.toFixed(2)),
      totalOrderDeposits: Number(totalOrderDeposits.toFixed(2)),
      totalCashIn: Number(totalCashIn.toFixed(2)),
      totalCashOut: Number(totalCashOut.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      totalRefunds: Number(totalRefunds.toFixed(2)),
      currentBalance,
      expectedBalance: currentBalance
    }
  };
}

/**
 * قيد أو تحديث الأثر النقدي لفاتورة بيع في جلسة الخزينة المفتوحة
 */
async function applySaleTillDelta(db, {
  saleId,
  sessionId = null,
  userId = null,
  paidAmount = 0,
  totalAmount = 0,
  paymentMethod = 'cash'
}) {
  if (!saleId) return null;

  // لا نقيد في درج النقدية إلا المدفوعات النقدية
  if (paymentMethod && String(paymentMethod).toLowerCase() !== 'cash') {
    await reverseSaleTill(db, saleId);
    return null;
  }

  const activeSessionId = await resolveOpenSession(db, sessionId, userId);
  if (!activeSessionId) return null;

  const isReturnSale = Number(totalAmount || 0) < 0 || Number(paidAmount || 0) < 0;
  const absPaid = Math.abs(Number(paidAmount || 0));

  const existingTx = await dbGet(
    db,
    `
    SELECT id FROM caisse_transactions
    WHERE reference_id = ? AND type IN ('sale_cash', 'sale_refund') AND deleted_at IS NULL
    LIMIT 1
    `,
    [Number(saleId)]
  );

  if (absPaid < 0.009) {
    if (existingTx) {
      await dbRun(db, 'DELETE FROM caisse_transactions WHERE id = ?', [existingTx.id]);
    }
    return activeSessionId;
  }

  const txType = isReturnSale ? 'sale_refund' : 'sale_cash';
  const desc = isReturnSale ? `مرتجع فاتورة بيع #${saleId}` : `مبيعات فاتورة #${saleId}`;

  if (existingTx) {
    await dbRun(
      db,
      'UPDATE caisse_transactions SET session_id = ?, type = ?, amount = ?, description = ? WHERE id = ?',
      [activeSessionId, txType, absPaid, desc, existingTx.id]
    );
  } else {
    await dbRun(
      db,
      `
      INSERT INTO caisse_transactions (
        session_id, type, amount, category, description, reference_id, reference_uuid
      ) VALUES (?, ?, ?, 'sales', ?, ?, (SELECT uuid FROM sales WHERE id = ?))
      `,
      [activeSessionId, txType, absPaid, desc, Number(saleId), Number(saleId)]
    );
  }

  return activeSessionId;
}

/**
 * إلغاء الأثر النقدي لفاتورة بيع عند حذفها
 */
async function reverseSaleTill(db, saleId) {
  if (!saleId) return;
  await dbRun(
    db,
    `
    DELETE FROM caisse_transactions
    WHERE (reference_id = ? OR reference_uuid = (SELECT uuid FROM sales WHERE id = ?))
      AND type IN ('sale_cash', 'sale_refund')
    `,
    [Number(saleId), Number(saleId)]
  );
}

module.exports = {
  resolveOpenSession,
  computeSessionSummary,
  applySaleTillDelta,
  reverseSaleTill
};