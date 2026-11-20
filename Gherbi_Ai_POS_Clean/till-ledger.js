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

/* === [WAR STAGE 5D: FORENSIC SHIFT DOSSIER ENRICHER] === */
(function installTillLedgerStage5DForensicEnricher(exportsObj) {
  'use strict';
  if (!exportsObj || typeof exportsObj.computeSessionSummary !== 'function' || exportsObj._stage5DForensicInstalled) {
    return;
  }
  exportsObj._stage5DForensicInstalled = true;
  const origCompute = exportsObj.computeSessionSummary;

  function toNum(v) {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function extractTimeHHMM(dtStr) {
    const s = String(dtStr || '');
    const m = s.match(/(\d{2}:\d{2})/);
    return m ? m[1] : s.slice(11, 16) || '';
  }

  function parseBeneficiaryAndReason(tx, expRow, supMap) {
    const rawDesc = String(tx.description || (expRow && expRow.description) || '').trim();
    const rawCat = String(tx.category || (expRow && expRow.category) || '').trim();
    const tp = String(tx.type || '').toLowerCase();

    let beneficiary = '';
    let reason = rawDesc;

    // 1. استخراج [المستفيد: فلان]
    const mBen = rawDesc.match(/\[\s*المستفيد\s*:\s*([^\]]+)\]/i);
    if (mBen && mBen[1]) {
      beneficiary = mBen[1].trim();
      reason = reason.replace(mBen[0], '').trim();
    }

    // 2. استخراج سلفة عامل إن وجدت
    const mAdv = rawDesc.match(/\[\s*سلفة\s+عامل[^\]]*\]/i);
    let tagLabel = '';
    if (mAdv) {
      tagLabel = mAdv[0].replace(/^\[|\]$/g, '').trim();
      reason = reason.replace(mAdv[0], '').trim();
    }

    // 3. ربط تسديد المورد باسمه الحقيقي من جدول suppliers
    const mSup = rawDesc.match(/المورد\s*#(\d+)/);
    if (mSup && supMap.has(Number(mSup[1]))) {
      const supName = supMap.get(Number(mSup[1]));
      if (!beneficiary) beneficiary = 'المورد: ' + supName;
      reason = reason.replace(mSup[0], 'المورد ' + supName);
    }

    if (!beneficiary) {
      if (tp === 'cash_out') beneficiary = 'سحب إداري / المالك';
      else if (tp === 'refund' || tp === 'sale_refund') beneficiary = 'مرتجع لزبون';
      else if (rawCat && rawCat !== 'عام' && rawCat !== 'sales') beneficiary = rawCat;
      else beneficiary = 'مصروف المحل';
    }

    const typeLabel =
      tagLabel ||
      (tp === 'cash_out'
        ? 'سحب نقدي'
        : tp === 'refund' || tp === 'sale_refund'
        ? 'مرتجع نقدي'
        : rawCat === 'suppliers'
        ? 'تسديد مورد'
        : rawCat === 'purchases'
        ? 'فاتورة شراء'
        : rawCat || 'مصروف تشغيلي');

    if (!reason) reason = typeLabel;
    return { beneficiary, reason, typeLabel };
  }

  exportsObj.computeSessionSummary = async function computeSessionSummaryWithForensicDossier(db, sessionId) {
    const base = await origCompute.call(this, db, sessionId);
    if (!base || !base.session) return base;

    try {
      const dbAll = (sql, params = []) =>
        typeof db.dbAll === 'function' ? db.dbAll(sql, params) : typeof db.allAsync === 'function' ? db.allAsync(sql, params) : Promise.resolve([]);
      const dbGet = (sql, params = []) =>
        typeof db.dbGet === 'function' ? db.dbGet(sql, params) : typeof db.getAsync === 'function' ? db.getAsync(sql, params) : Promise.resolve(null);

      const sess = base.session;
      const sid = Number(sess.id || sessionId);
      const openedAt = String(sess.opened_at || '').replace('T', ' ').slice(0, 19);
      const closedAt = sess.closed_at ? String(sess.closed_at).replace('T', ' ').slice(0, 19) : new Date().toISOString().replace('T', ' ').slice(0, 19);
      const txs = Array.isArray(base.transactions) ? base.transactions : [];

      // 1. جلب خرائط الزبائن والموردين والمصاريف
      const [custRows, supRows, expRows, spRows, shiftSalesRows, auditRows] = await Promise.all([
        dbAll(
          `SELECT
             c.id, c.name, c.phone, c.loyalty_card_code,
             (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS live_debt
           FROM customers c
           LEFT JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
           WHERE c.deleted_at IS NULL
           GROUP BY c.id`
        ).catch(() => []),
        dbAll('SELECT id, name, phone FROM suppliers WHERE deleted_at IS NULL').catch(() => []),
        dbAll('SELECT id, category, description, amount, date, session_id FROM expenses WHERE deleted_at IS NULL AND (session_id = ? OR date(created_at) BETWEEN date(?) AND date(?))', [sid, openedAt || '2000-01-01', closedAt || '2099-12-31']).catch(() => []),
        dbAll(
          `SELECT sp.id, sp.sale_id, sp.customer_id, sp.amount, sp.payment_method, sp.notes, c.name AS customer_name, c.phone AS customer_phone
           FROM sale_payments sp
           LEFT JOIN customers c ON c.id = sp.customer_id
           WHERE sp.deleted_at IS NULL`
        ).catch(() => []),
        dbAll(
          `SELECT
             s.id, s.doc_number, s.customer_id, s.subtotal, s.discount, s.total, s.paid_amount,
             s.payment_method, s.sale_date, s.created_at, s.session_id,
             c.name AS customer_name, c.phone AS customer_phone, c.loyalty_card_code
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           WHERE s.deleted_at IS NULL
             AND (
               s.session_id = ?
               OR (
                 (s.session_id IS NULL OR s.session_id = 0)
                 AND datetime(replace(substr(COALESCE(s.created_at, s.sale_date), 1, 19), 'T', ' '))
                     BETWEEN datetime(replace(substr(?, 1, 19), 'T', ' '))
                         AND datetime(replace(substr(?, 1, 19), 'T', ' '))
               )
             )
           ORDER BY s.id DESC`,
          [sid, openedAt || '2000-01-01 00:00:00', closedAt || '2099-12-31 23:59:59']
        ).catch(() => []),
        dbAll(
          `SELECT id, user_name, action_type, severity, details_json, created_at
           FROM audit_logs
           WHERE deleted_at IS NULL
             AND datetime(replace(substr(created_at, 1, 19), 'T', ' '))
                 BETWEEN datetime(replace(substr(?, 1, 19), 'T', ' '))
                     AND datetime(replace(substr(?, 1, 19), 'T', ' '))
             AND (severity IN ('warning', 'critical', 'danger') OR action_type LIKE '%DELETE%' OR action_type LIKE '%credit_note%' OR action_type LIKE '%BELOW_COST%')
           ORDER BY id DESC LIMIT 20`,
          [openedAt || '2000-01-01 00:00:00', closedAt || '2099-12-31 23:59:59']
        ).catch(() => [])
      ]);

      const custMap = new Map();
      let storeTotalDebtReal = 0;
      const debtorsList = [];
      for (let i = 0; i < custRows.length; i++) {
        const c = custRows[i];
        const liveDebt = Number(Math.max(0, toNum(c.live_debt)).toFixed(2));
        custMap.set(Number(c.id), { ...c, live_debt: liveDebt });
        if (liveDebt > 0.009) {
          storeTotalDebtReal += liveDebt;
          debtorsList.push({
            id: Number(c.id),
            name: c.name || 'زبون #' + c.id,
            phone: c.phone || '',
            cardCode: c.loyalty_card_code || '',
            debt: liveDebt
          });
        }
      }
      storeTotalDebtReal = Number(storeTotalDebtReal.toFixed(2));
      debtorsList.sort((a, b) => b.debt - a.debt);

      const supMap = new Map();
      for (let i = 0; i < supRows.length; i++) supMap.set(Number(supRows[i].id), supRows[i].name);

      const expMap = new Map();
      for (let i = 0; i < expRows.length; i++) expMap.set(Number(expRows[i].id), expRows[i]);

      const spMap = new Map();
      for (let i = 0; i < spRows.length; i++) spMap.set(Number(spRows[i].id), spRows[i]);

      // 2. تصنيف حركات الدرج بدقة: الخارج (مصاريف/سلف/سحوبات)، تحصيلات الديون بأسماء الزبائن، الإيداعات
      const outflows = [];
      const inflows = [];
      const debtCollections = [];
      let totalOutflows = 0;
      let totalInflows = 0;
      let totalDebtCollected = 0;
      let txCashSalesTotal = 0;

      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        if (!tx) continue;
        const tp = String(tx.type || '').toLowerCase();
        const amt = Number(Math.abs(toNum(tx.amount)).toFixed(2));
        const timeStr = extractTimeHHMM(tx.created_at);

        if (tp === 'sale' || tp === 'cash_sale' || tp === 'sale_cash') {
          txCashSalesTotal += amt;
        } else if (tp === 'expense' || tp === 'cash_out' || tp === 'refund' || tp === 'sale_refund') {
          const expRow = tx.reference_id ? expMap.get(Number(tx.reference_id)) : null;
          const parsed = parseBeneficiaryAndReason(tx, expRow, supMap);
          totalOutflows += amt;
          outflows.push({
            id: tx.id,
            time: timeStr,
            type: tp,
            typeLabel: parsed.typeLabel,
            beneficiary: parsed.beneficiary,
            reason: parsed.reason,
            amount: amt
          });
        } else if (tp === 'cash_in' || tp === 'order_deposit') {
          totalInflows += amt;
          inflows.push({
            id: tx.id,
            time: timeStr,
            type: tp,
            typeLabel: tp === 'order_deposit' ? 'عربون طلبية' : 'إيداع وتغذية درج',
            source: tx.category && tx.category !== 'عام' ? tx.category : 'الصندوق',
            reason: tx.description || (tp === 'order_deposit' ? 'عربون طلبية زبون' : 'تغذية الصندوق'),
            amount: amt
          });
        } else if (tp === 'debt_payment' || tp === 'customer_payment') {
          totalDebtCollected += amt;
          let custName = '';
          let custPhone = '';
          let custId = null;

          // أولاً: من sale_payments عبر reference_id
          const sp = tx.reference_id ? spMap.get(Number(tx.reference_id)) : null;
          if (sp && sp.customer_id) {
            custId = Number(sp.customer_id);
            const cObj = custMap.get(custId);
            custName = (cObj && cObj.name) || sp.customer_name || '';
            custPhone = (cObj && cObj.phone) || sp.customer_phone || '';
          }

          // ثانياً: من النص "زبون #3"
          if (!custName) {
            const mCust = String(tx.description || '').match(/زبون\s*#(\d+)/);
            if (mCust) {
              custId = Number(mCust[1]);
              const cObj = custMap.get(custId);
              if (cObj) {
                custName = cObj.name;
                custPhone = cObj.phone || '';
              }
            }
          }

          // ثالثاً: من "فاتورة بيع #101"
          if (!custName) {
            const mSale = String(tx.description || '').match(/فاتورة\s+بيع\s*#?(\d+)/);
            if (mSale) {
              const sRow = await dbGet(
                'SELECT s.customer_id, c.name, c.phone FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?',
                [Number(mSale[1])]
              ).catch(() => null);
              if (sRow && sRow.name) {
                custId = Number(sRow.customer_id || 0) || null;
                custName = sRow.name;
                custPhone = sRow.phone || '';
              }
            }
          }

          const cLive = custId && custMap.has(custId) ? custMap.get(custId).live_debt : null;
          debtCollections.push({
            id: tx.id,
            time: timeStr,
            customerId: custId,
            customerName: custName || tx.description || 'زبون',
            customerPhone: custPhone,
            note: (sp && sp.notes) || tx.description || 'تسديد دين',
            amount: amt,
            remainingDebtNow: cLive
          });
        }
      }

      // 3. تحليل مبيعات الوردية: الزبائن المدينين اليوم + تفصيل وسائل الدفع + التخفيضات
      const creditSalesToday = [];
      let totalCreditAddedToday = 0;
      let totalSalesRevenue = 0;
      let totalDiscounts = 0;
      const payMethods = {
        cash: 0,
        cib: 0,
        baridimob: 0,
        cheque: 0,
        credit: 0,
        other: 0
      };

      for (let i = 0; i < shiftSalesRows.length; i++) {
        const s = shiftSalesRows[i];
        const tot = toNum(s.total);
        const paid = Math.min(tot, Math.max(0, toNum(s.paid_amount)));
        const disc = Math.max(0, toNum(s.discount));
        const creditAdded = Number(Math.max(0, tot - paid).toFixed(2));
        const pm = String(s.payment_method || 'cash').toLowerCase();

        totalSalesRevenue += tot;
        totalDiscounts += disc;

        if (paid > 0.009) {
          if (pm === 'cib' || pm === 'card' || pm === 'edahabia') payMethods.cib += paid;
          else if (pm === 'baridimob' || pm === 'ccp') payMethods.baridimob += paid;
          else if (pm === 'cheque') payMethods.cheque += paid;
          else if (pm === 'cash' || pm === 'credit' || pm === 'split' || pm === 'installment') payMethods.cash += paid;
          else payMethods.other += paid;
        }
        if (creditAdded > 0.009) {
          payMethods.credit += creditAdded;
          totalCreditAddedToday += creditAdded;
          const cid = s.customer_id ? Number(s.customer_id) : null;
          const cObj = cid && custMap.has(cid) ? custMap.get(cid) : null;
          creditSalesToday.push({
            saleId: s.id,
            docNumber: s.doc_number || '#' + s.id,
            time: extractTimeHHMM(s.created_at || s.sale_date),
            customerId: cid,
            customerName: (cObj && cObj.name) || s.customer_name || 'زبون غير محدد',
            customerPhone: (cObj && cObj.phone) || s.customer_phone || '',
            cardCode: (cObj && cObj.loyalty_card_code) || s.loyalty_card_code || '',
            invoiceTotal: Number(tot.toFixed(2)),
            paidToday: Number(paid.toFixed(2)),
            creditAdded,
            cumulativeDebtNow: cObj ? cObj.live_debt : creditAdded
          });
        }
      }

      // تجميع تحصيلات الديون حسب الزبون لنسخة 80mm المختصرة
      const collectedByCustomerMap = new Map();
      for (let i = 0; i < debtCollections.length; i++) {
        const dc = debtCollections[i];
        const key = dc.customerName;
        const prev = collectedByCustomerMap.get(key) || { customerName: key, count: 0, total: 0, lastTime: dc.time, remainingDebtNow: dc.remainingDebtNow };
        prev.count += 1;
        prev.total = Number((prev.total + dc.amount).toFixed(2));
        collectedByCustomerMap.set(key, prev);
      }
      const debtCollectionsGrouped = Array.from(collectedByCustomerMap.values()).sort((a, b) => b.total - a.total);

      // 4. توليد تنبيهات المستشار الرقابي لصاحب المتجر
      const ownerAlerts = [];
      const expectedBal = toNum(base.summary && base.summary.expectedBalance !== undefined ? base.summary.expectedBalance : sess.expected_balance);
      const hasCounted = sess.closing_balance !== null && sess.closing_balance !== undefined;
      const diff = hasCounted ? Number((toNum(sess.closing_balance) - expectedBal).toFixed(2)) : 0;

      if (diff < -0.009) {
        ownerAlerts.push({ level: 'danger', text: 'عجز في جرد الدرج بقيمة ' + Math.abs(diff).toFixed(2) + ' د.ج — يتطلب مراجعة فورية مع الكاشير.' });
      } else if (diff > 0.009) {
        ownerAlerts.push({ level: 'warning', text: 'فائض غير مبرر في الدرج بقيمة +' + diff.toFixed(2) + ' د.ج (قد توجد عملية بيع غير مسجلة).' });
      }
      if (expectedBal < -0.009) {
        ownerAlerts.push({ level: 'danger', text: 'رصيد الدرج المتوقع سالب (' + expectedBal.toFixed(2) + ' د.ج) لأن المصاريف/السلَف تجاوزت المداخيل النقدية.' });
      }
      if (totalOutflows > 0 && txCashSalesTotal > 0 && totalOutflows > txCashSalesTotal) {
        ownerAlerts.push({ level: 'warning', text: 'الأموال الخارجة (' + totalOutflows.toFixed(2) + ' د.ج) أكبر من مبيعات الكاش (' + txCashSalesTotal.toFixed(2) + ' د.ج).' });
      }
      if (totalCreditAddedToday > 0.009) {
        ownerAlerts.push({ level: 'info', text: 'تم منح ديون جديدة بقيمة ' + totalCreditAddedToday.toFixed(2) + ' د.ج لـ (' + creditSalesToday.length + ') عملية بيع آجلة.' });
      }
      if (totalDiscounts > 0.009 && totalSalesRevenue > 0 && totalDiscounts / totalSalesRevenue >= 0.08) {
        ownerAlerts.push({ level: 'warning', text: 'نسبة التخفيضات الممنوحة مرتفعة (' + totalDiscounts.toFixed(2) + ' د.ج).' });
      }
      if (auditRows.length > 0) {
        ownerAlerts.push({ level: 'danger', text: 'سُجل (' + auditRows.length + ') حدثاً رقابياً حساساً خلال الوردية (حذف فاتورة / مرتجع / تنبيه أمان).' });
      }

      base.forensicDossier = {
        outflows,
        inflows,
        debtCollections,
        debtCollectionsGrouped,
        creditSalesToday,
        topDebtors: debtorsList.slice(0, 8),
        auditEventsCount: auditRows.length,
        auditEvents: auditRows.slice(0, 5),
        ownerAlerts,
        kpis: {
          salesCount: shiftSalesRows.length,
          totalSalesRevenue: Number(totalSalesRevenue.toFixed(2)),
          avgBasket: shiftSalesRows.length > 0 ? Number((totalSalesRevenue / shiftSalesRows.length).toFixed(2)) : 0,
          totalDiscounts: Number(totalDiscounts.toFixed(2)),
          totalOutflows: Number(totalOutflows.toFixed(2)),
          totalInflows: Number(totalInflows.toFixed(2)),
          totalDebtCollected: Number(totalDebtCollected.toFixed(2)),
          totalCreditAddedToday: Number(totalCreditAddedToday.toFixed(2)),
          storeTotalDebtReal,
          debtorsCount: debtorsList.length
        },
        paymentBreakdown: {
          cash: Number(payMethods.cash.toFixed(2)),
          cib: Number(payMethods.cib.toFixed(2)),
          baridimob: Number(payMethods.baridimob.toFixed(2)),
          cheque: Number(payMethods.cheque.toFixed(2)),
          credit: Number(payMethods.credit.toFixed(2)),
          other: Number(payMethods.other.toFixed(2))
        }
      };

      // تحديث حقول summary الأساسية بالأرقام الحقيقية من SQLite
      if (!base.summary) base.summary = {};
      base.summary.newCreditGiven = Number(totalCreditAddedToday.toFixed(2));
      base.summary.totalStoreCustomerDebt = storeTotalDebtReal;
      base.summary.totalDebtCollected = Number(totalDebtCollected.toFixed(2));
      base.summary.totalOutflows = Number(totalOutflows.toFixed(2));
      base.summary.totalDiscounts = Number(totalDiscounts.toFixed(2));
      base.summary.salesCount = shiftSalesRows.length;
    } catch (e) {
      // حماية تامة: لا نكسر استدعاء الصندوق أبداً
    }

    return base;
  };
})(module.exports);
