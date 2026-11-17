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
/* ==================== [V69 SHIFT DEBT & FULL FINANCIAL AUDIT ENRICHMENT] ==================== */
(function wrapComputeSessionSummaryWithDebtAccounting() {
  const origCompute = module.exports.computeSessionSummary;
  if (typeof origCompute !== 'function') return;

  module.exports.computeSessionSummary = async function (db, sessionId) {
    const baseResult = await origCompute(db, sessionId);
    if (!baseResult || !baseResult.session) return baseResult;

    const sess = baseResult.session;
    const sum = baseResult.summary || {};
    const txs = Array.isArray(baseResult.transactions) ? baseResult.transactions : [];
    const sid = Number(sess.id);

    const dbAll = (sql, params = []) =>
      typeof db.dbAll === 'function'
        ? db.dbAll(sql, params)
        : new Promise((resolve) => db.all(sql, params, (_e, r) => resolve(r || [])));

    const dbGet = (sql, params = []) =>
      typeof db.dbGet === 'function'
        ? db.dbGet(sql, params)
        : new Promise((resolve) => db.get(sql, params, (_e, r) => resolve(r || null)));

    try {
      // 1. جلب جميع فواتير المبيعات (النقدية والآجلة والجزئية) التي تمت خلال هذه الوردية
      const openedAt = sess.opened_at || '1970-01-01';
      const closedAt = sess.closed_at || null;

      const shiftSales = await dbAll(
        `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.deleted_at IS NULL
           AND (
             s.session_id = ?
             OR (
               s.session_id IS NULL
               AND datetime(COALESCE(s.sale_date, s.created_at)) >= datetime(?)
               AND (? IS NULL OR datetime(COALESCE(s.sale_date, s.created_at)) <= datetime(?))
             )
           )
         ORDER BY s.id DESC`,
        [sid, openedAt, closedAt, closedAt]
      );

      let totalSalesGross = 0;
      let totalPaidInSales = 0;
      let newCreditGiven = 0;
      let creditInvoicesCount = 0;
      let cashInvoicesCount = 0;
      const creditSalesDetails = [];

      for (const s of shiftSales) {
        const tot = Math.max(0, Number(s.total || 0));
        const paid = Math.max(0, Math.min(tot, Number(s.paid_amount ?? tot)));
        const remDebt = Math.max(0, Number((tot - paid).toFixed(2)));

        totalSalesGross = Number((totalSalesGross + tot).toFixed(2));
        totalPaidInSales = Number((totalPaidInSales + paid).toFixed(2));

        if (remDebt > 0.009 || s.payment_method === 'credit') {
          newCreditGiven = Number((newCreditGiven + remDebt).toFixed(2));
          creditInvoicesCount++;
          creditSalesDetails.push({
            id: s.id,
            doc_number: s.doc_number || ('#' + s.id),
            customer_id: s.customer_id,
            customer_name: s.customer_name || 'زبون',
            total: tot,
            paid_amount: paid,
            remaining_debt: remDebt,
            sale_date: s.sale_date || s.created_at,
            payment_method: s.payment_method
          });
        } else {
          cashInvoicesCount++;
        }
      }

      // 2. حساب تسديدات الديون المقبوضة في هذه الوردية (Alt+V) والمصاريف بالتفصيل
      const debtPaymentTxs = txs.filter((t) => t.type === 'debt_payment');
      const expenseTxs = txs.filter((t) => t.type === 'expense');
      const cashInTxs = txs.filter((t) => t.type === 'cash_in');
      const cashOutTxs = txs.filter((t) => t.type === 'cash_out');

      const debtPaymentsTotal = Number(
        debtPaymentTxs.reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0).toFixed(2)
      );
      const expensesTotal = Number(
        expenseTxs.reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0).toFixed(2)
      );
      const cashInTotal = Number(
        cashInTxs.reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0).toFixed(2)
      );
      const cashOutTotal = Number(
        cashOutTxs.reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0).toFixed(2)
      );

      // 3. إجمالي الديون الكلي المتراكم على جميع زبائن المتجر حالياً
      const storeDebtRow = await dbGet(
        `SELECT COALESCE(SUM(debt), 0) AS total_store_debt, COUNT(*) AS debtors_count FROM (
           SELECT (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS debt
           FROM customers c
           LEFT JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
           WHERE c.deleted_at IS NULL
           GROUP BY c.id
           HAVING debt > 0.009
         )`
      );

      const openingBalance = Number(sess.opening_balance ?? sum.openingBalance ?? 0);
      const cashSalesVal = Number(sum.cashSales ?? totalPaidInSales ?? 0);
      const orderDepositsVal = Number(sum.orderDeposits || 0);

      // المعادلة النقدية الصافية للدرج (لا تخلط الديون غير المدفوعة مع الكاش أبداً!)
      const exactExpectedDrawerCash = Number(
        (
          openingBalance +
          cashSalesVal +
          debtPaymentsTotal +
          orderDepositsVal +
          cashInTotal -
          cashOutTotal -
          expensesTotal
        ).toFixed(2)
      );

      baseResult.summary = {
        ...sum,
        openingBalance,
        cashSales: cashSalesVal,
        debtPayments: debtPaymentsTotal,
        debtPaymentsCount: debtPaymentTxs.length,
        orderDeposits: orderDepositsVal,
        cashIn: cashInTotal,
        cashInCount: cashInTxs.length,
        cashOut: cashOutTotal,
        cashOutCount: cashOutTxs.length,
        expenses: expensesTotal,
        expensesCount: expenseTxs.length,
        expectedBalance: sum.expectedBalance !== undefined ? Number(sum.expectedBalance) : exactExpectedDrawerCash,
        exactExpectedDrawerCash,
        // بيانات الديون والائتمان الخاصة بالوردية
        newCreditGiven,
        creditInvoicesCount,
        cashInvoicesCount,
        totalShiftInvoicesCount: shiftSales.length,
        totalSalesGross: Math.max(totalSalesGross, Number((cashSalesVal + newCreditGiven).toFixed(2))),
        netDebtChangeInShift: Number((newCreditGiven - debtPaymentsTotal).toFixed(2)),
        totalStoreCustomerDebt: Number((storeDebtRow && storeDebtRow.total_store_debt) || 0),
        totalStoreDebtorsCount: Number((storeDebtRow && storeDebtRow.debtors_count) || 0)
      };

      baseResult.creditSales = creditSalesDetails;
      baseResult.debtPaymentTxs = debtPaymentTxs;
      baseResult.expenseTxs = expenseTxs;
    } catch (e) {
      console.warn('[V69 Till Debt Enrichment Warning]:', e.message);
    }

    return baseResult;
  };
})();
