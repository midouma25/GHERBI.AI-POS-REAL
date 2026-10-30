/**
 * analytics-queries.js
 * محرك التحليلات المالية، حساب تكلفة البضاعة المباعة (COGS)، التدفقات النقدية،
 * أعمار الديون، تقييم المخزون، تحليلات الشرائح، حاسبة الزكاة، وتوصيات Gherbi.Ai Copilot
 */

'use strict';

function normalizeDateRange(params = {}) {
  const rawFrom = params.dateFrom || params.date_from || null;
  const rawTo = params.dateTo || params.date_to || null;
  return {
    dateFrom: rawFrom ? String(rawFrom).trim().slice(0, 10) : null,
    dateTo: rawTo ? String(rawTo).trim().slice(0, 10) : null
  };
}

function queryGet(db, sql, params = []) {
  if (typeof db.dbGet === 'function') return db.dbGet(sql, params);
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || {})));
  });
}

function queryAll(db, sql, params = []) {
  if (typeof db.dbAll === 'function') return db.dbAll(sql, params);
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

/**
 * دمج خصائص الكائن داخل مصفوفة هجينة بحيث تعمل دوال المصفوفات (.forEach / .map)
 * والوصول المباشر للخصائص (obj.bucket_0_30) في آنٍ واحد دون أي تعارض
 */
function createHybridArrayObject(propsObj = {}, arrayItems = []) {
  const arr = Array.isArray(arrayItems) ? arrayItems.slice() : [];
  return Object.assign(arr, propsObj);
}

/**
 * المحرك الرئيسي للوحة القيادة والإحصائيات الشاملة
 */
async function getAnalytics(db, params = {}, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = {};
  }

  const runAnalysis = async () => {
    const { dateFrom, dateTo } = normalizeDateRange(params);
    const custDebtPage = Math.max(0, parseInt(params.custDebtPage ?? 0, 10) || 0);
    const supDebtPage = Math.max(0, parseInt(params.supDebtPage ?? 0, 10) || 0);
    const debtPageSize = Math.max(1, parseInt(params.debtPageSize ?? 10, 10) || 10);

    const salesConds = ['s.deleted_at IS NULL'];
    const salesParams = [];
    if (dateFrom) {
      salesConds.push('date(s.sale_date) >= date(?)');
      salesParams.push(dateFrom);
    }
    if (dateTo) {
      salesConds.push('date(s.sale_date) <= date(?)');
      salesParams.push(dateTo);
    }
    const salesWhere = salesConds.join(' AND ');

    const purchConds = ['pi.deleted_at IS NULL'];
    const purchParams = [];
    if (dateFrom) {
      purchConds.push('date(pi.date) >= date(?)');
      purchParams.push(dateFrom);
    }
    if (dateTo) {
      purchConds.push('date(pi.date) <= date(?)');
      purchParams.push(dateTo);
    }
    const purchWhere = purchConds.join(' AND ');

    // 1. مؤشرات المبيعات والمرتجعات والضرائب والطابع الجبائي
    const salesSummary = (await queryGet(
      db,
      `
      SELECT
        COALESCE(SUM(CASE WHEN s.total >= 0 THEN s.total ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN s.total < 0 THEN ABS(s.total) ELSE 0 END), 0) AS returns_value,
        COALESCE(SUM(s.total), 0) AS net_revenue,
        COALESCE(SUM(s.discount), 0) AS total_discounts,
        COALESCE(SUM(CASE WHEN s.tax_percentage > 0 THEN (s.total * s.tax_percentage / (100.0 + s.tax_percentage)) ELSE 0 END), 0) AS sales_tax_collected,
        COALESCE(SUM(s.stamp_amount), 0) AS total_stamp_duty,
        COUNT(*) AS total_sales_count,
        COUNT(CASE WHEN s.total < 0 THEN 1 END) AS returns_count,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.payment_method, 'cash')) = 'cash' THEN s.paid_amount ELSE 0 END), 0) AS cash_sales_paid,
        COALESCE(SUM(CASE WHEN s.total > s.paid_amount THEN (s.total - s.paid_amount) ELSE 0 END), 0) AS credit_sales_unpaid
      FROM sales s
      WHERE ${salesWhere}
      `,
      salesParams
    )) || {};

    // 2. تكلفة البضاعة المباعة (COGS)
    const cogsRow = (await queryGet(
      db,
      `
      SELECT
        COALESCE(SUM(si.quantity * COALESCE(si.cost_price, ib.cost_price, si.custom_cost_price, 0)), 0) AS cogs
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
      LEFT JOIN inventory_batches ib ON ib.id = si.batch_id
      WHERE si.deleted_at IS NULL AND ${salesWhere}
      `,
      salesParams
    )) || {};

    // 3. ملخص المشتريات
    const purchasesSummary = (await queryGet(
      db,
      `
      SELECT
        COALESCE(SUM(pi.total), 0) AS total_purchases,
        COALESCE(SUM(pi.additional_costs), 0) AS additional_costs,
        COALESCE(SUM(pi.subtotal * pi.tax_percentage / 100.0), 0) AS purchase_tax_paid,
        COUNT(*) AS total_purchases_count
      FROM purchase_invoices pi
      WHERE ${purchWhere}
      `,
      purchParams
    )) || {};

    // 4. التدفق النقدي الداخل والخارج
    const spConds = ['sp.deleted_at IS NULL'];
    const spParams = [];
    if (dateFrom) { spConds.push('date(sp.date) >= date(?)'); spParams.push(dateFrom); }
    if (dateTo) { spConds.push('date(sp.date) <= date(?)'); spParams.push(dateTo); }

    const ctConds = ['ct.deleted_at IS NULL'];
    const ctParams = [];
    if (dateFrom) { ctConds.push('date(COALESCE(ct.updated_at, ct.created_at)) >= date(?)'); ctParams.push(dateFrom); }
    if (dateTo) { ctConds.push('date(COALESCE(ct.updated_at, ct.created_at)) <= date(?)'); ctParams.push(dateTo); }

    const srConds = ['sr.deleted_at IS NULL'];
    const srParams = [];
    if (dateFrom) { srConds.push('date(sr.date) >= date(?)'); srParams.push(dateFrom); }
    if (dateTo) { srConds.push('date(sr.date) <= date(?)'); srParams.push(dateTo); }

    const cashInRow = (await queryGet(
      db,
      `
      SELECT COALESCE(SUM(cash_in), 0) AS cash_in FROM (
        SELECT SUM(sp.amount) AS cash_in FROM sale_payments sp WHERE ${spConds.join(' AND ')}
        UNION ALL
        SELECT SUM(ct.amount) AS cash_in FROM caisse_transactions ct
        WHERE ct.type IN ('cash_in', 'order_deposit') AND ${ctConds.join(' AND ')}
        UNION ALL
        SELECT SUM(sr.refund_amount) AS cash_in FROM supplier_returns sr WHERE ${srConds.join(' AND ')}
      )
      `,
      [...spParams, ...ctParams, ...srParams]
    )) || {};

    const ipConds = ['ip.deleted_at IS NULL'];
    const ipParams = [];
    if (dateFrom) { ipConds.push('date(ip.date) >= date(?)'); ipParams.push(dateFrom); }
    if (dateTo) { ipConds.push('date(ip.date) <= date(?)'); ipParams.push(dateTo); }

    const expConds = ['e.deleted_at IS NULL'];
    const expParams = [];
    if (dateFrom) { expConds.push('date(e.date) >= date(?)'); expParams.push(dateFrom); }
    if (dateTo) { expConds.push('date(e.date) <= date(?)'); expParams.push(dateTo); }

    const cashOutRow = (await queryGet(
      db,
      `
      SELECT COALESCE(SUM(cash_out), 0) AS cash_out FROM (
        SELECT SUM(ip.amount) AS cash_out FROM invoice_payments ip WHERE ${ipConds.join(' AND ')}
        UNION ALL
        SELECT SUM(ct.amount) AS cash_out FROM caisse_transactions ct
        WHERE ct.type IN ('cash_out', 'sale_refund') AND ${ctConds.join(' AND ')}
        UNION ALL
        SELECT SUM(e.amount) AS cash_out FROM expenses e WHERE ${expConds.join(' AND ')}
        UNION ALL
        SELECT SUM(ct.amount) AS cash_out FROM caisse_transactions ct
        WHERE ct.type = 'expense' AND ct.reference_id IS NULL AND ct.reference_uuid IS NULL AND ${ctConds.join(' AND ')}
      )
      `,
      [...ipParams, ...ctParams, ...expParams, ...ctParams]
    )) || {};

    // 5. المصاريف حسب الفئة ورأس المال
    const expensesByCategory = await queryAll(
      db,
      `
      SELECT category, COALESCE(SUM(amount), 0) AS total
      FROM (
        SELECT e.category AS category, e.amount AS amount
        FROM expenses e
        WHERE ${expConds.join(' AND ')}
        UNION ALL
        SELECT COALESCE(ct.category, 'عام') AS category, ct.amount AS amount
        FROM caisse_transactions ct
        WHERE ct.type = 'expense'
          AND ct.reference_id IS NULL
          AND ct.reference_uuid IS NULL
          AND ${ctConds.join(' AND ')}
      )
      GROUP BY category
      ORDER BY total DESC
      `,
      [...expParams, ...ctParams]
    );

    const totalExpenses = expensesByCategory.reduce((sum, r) => sum + Number(r.total || 0), 0);

    const capConds = ['c.deleted_at IS NULL'];
    const capParams = [];
    if (dateFrom) { capConds.push('date(c.date) >= date(?)'); capParams.push(dateFrom); }
    if (dateTo) { capConds.push('date(c.date) <= date(?)'); capParams.push(dateTo); }

    const capitalRow = (await queryGet(
      db,
      `SELECT COALESCE(SUM(c.amount), 0) AS total FROM capital_injections c WHERE ${capConds.join(' AND ')}`,
      capParams
    )) || {};

    // 6. ديون الزبائن وديون الموردين وأعمار الديون (Debt Aging)
    const totalCustomerDebtRow = (await queryGet(
      db,
      `
      SELECT COALESCE(SUM(debt), 0) AS total, COUNT(*) AS cnt
      FROM (
        SELECT
          c.id,
          (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS debt
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id AND s.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
        GROUP BY c.id
        HAVING debt > 0.009
      )
      `
    )) || {};

    const customerDebts = await queryAll(
      db,
      `
      SELECT
        c.id,
        c.name,
        c.phone,
        COALESCE(SUM(s.total), 0) AS total_sales,
        COALESCE(SUM(s.paid_amount), 0) AS total_paid,
        (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS debt,
        COUNT(CASE WHEN (s.total - s.paid_amount) > 0.009 THEN 1 END) AS open_invoices,
        MIN(CASE WHEN (s.total - s.paid_amount) > 0.009 THEN s.sale_date END) AS oldest_unpaid
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      HAVING debt > 0.009
      ORDER BY debt DESC, c.id ASC
      LIMIT ? OFFSET ?
      `,
      [debtPageSize, custDebtPage * debtPageSize]
    );

    const totalSupplierDebtRow = (await queryGet(
      db,
      `
      SELECT COALESCE(SUM(debt), 0) AS total, COUNT(*) AS cnt
      FROM (
        SELECT
          sup.id,
          (
            COALESCE(SUM(pi.total - pi.paid_amount), 0) +
            (COALESCE(sup.initial_debt, 0) - COALESCE(sup.initial_debt_paid, 0)) -
            COALESCE((SELECT SUM(sr.credit_applied) FROM supplier_returns sr WHERE sr.supplier_id = sup.id AND sr.deleted_at IS NULL), 0)
          ) AS debt
        FROM suppliers sup
        LEFT JOIN purchase_invoices pi ON sup.id = pi.supplier_id AND pi.deleted_at IS NULL
        WHERE sup.deleted_at IS NULL
        GROUP BY sup.id
        HAVING debt > 0.009
      )
      `
    )) || {};

    const supplierDebts = await queryAll(
      db,
      `
      SELECT
        sup.id,
        sup.name,
        sup.phone,
        COALESCE(SUM(pi.total), 0) AS total_purchases,
        COALESCE(SUM(pi.paid_amount), 0) AS total_paid,
        (
          COALESCE(SUM(pi.total - pi.paid_amount), 0) +
          (COALESCE(sup.initial_debt, 0) - COALESCE(sup.initial_debt_paid, 0)) -
          COALESCE((SELECT SUM(sr.credit_applied) FROM supplier_returns sr WHERE sr.supplier_id = sup.id AND sr.deleted_at IS NULL), 0)
        ) AS debt,
        COUNT(CASE WHEN (pi.total - pi.paid_amount) > 0.009 THEN 1 END) AS open_invoices,
        MIN(CASE WHEN (pi.total - pi.paid_amount) > 0.009 THEN pi.date END) AS oldest_unpaid
      FROM suppliers sup
      LEFT JOIN purchase_invoices pi ON sup.id = pi.supplier_id AND pi.deleted_at IS NULL
      WHERE sup.deleted_at IS NULL
      GROUP BY sup.id
      HAVING debt > 0.009
      ORDER BY debt DESC, sup.id ASC
      LIMIT ? OFFSET ?
      `,
      [debtPageSize, supDebtPage * debtPageSize]
    );

    const allCustomerDebtsForAging = await queryAll(
      db,
      `
      SELECT
        c.id,
        c.name,
        (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS debt,
        COALESCE(MIN(CASE WHEN (s.total - s.paid_amount) > 0.009 THEN s.sale_date END), c.created_at) AS oldest_date
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      HAVING debt > 0.009
      `
    );

    const debtAgingProps = {
      bucket_0_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_90_plus: 0,
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0
    };
    const nowMs = Date.now();
    for (const r of allCustomerDebtsForAging) {
      const amt = Number(r.debt || 0);
      const dt = r.oldest_date ? new Date(r.oldest_date).getTime() : nowMs;
      const days = Number.isFinite(dt) ? Math.max(0, Math.floor((nowMs - dt) / 86400000)) : 0;
      if (days <= 30) {
        debtAgingProps.bucket_0_30 += amt;
        debtAgingProps.current += amt;
      } else if (days <= 60) {
        debtAgingProps.bucket_31_60 += amt;
        debtAgingProps.days30 += amt;
      } else if (days <= 90) {
        debtAgingProps.bucket_61_90 += amt;
        debtAgingProps.days60 += amt;
      } else {
        debtAgingProps.bucket_90_plus += amt;
        debtAgingProps.days90 += amt;
      }
    }

    const debtAgingHybrid = createHybridArrayObject(debtAgingProps, [
      { label: '0-30', bucket: '0-30', amount: debtAgingProps.bucket_0_30, total: debtAgingProps.bucket_0_30 },
      { label: '31-60', bucket: '31-60', amount: debtAgingProps.bucket_31_60, total: debtAgingProps.bucket_31_60 },
      { label: '61-90', bucket: '61-90', amount: debtAgingProps.bucket_61_90, total: debtAgingProps.bucket_61_90 },
      { label: '90+', bucket: '90+', amount: debtAgingProps.bucket_90_plus, total: debtAgingProps.bucket_90_plus }
    ]);

    // 7. تقييم المخزون والتنبيهات
    const invValuation = (await queryGet(
      db,
      `
      SELECT
        COALESCE(SUM(CASE WHEN ib.stock > 0 THEN ib.stock * ib.cost_price ELSE 0 END), 0) AS cost_value,
        COALESCE(SUM(CASE WHEN ib.stock > 0 THEN ib.stock * ib.selling_price ELSE 0 END), 0) AS sell_value,
        COALESCE(SUM(CASE WHEN ib.stock > 0 THEN ib.stock ELSE 0 END), 0) AS total_units,
        COUNT(*) AS batches_count
      FROM inventory_batches ib
      INNER JOIN products p ON p.id = ib.product_id AND p.deleted_at IS NULL
      WHERE ib.deleted_at IS NULL
      `
    )) || {};

    const prodCountRow = (await queryGet(
      db,
      'SELECT COUNT(*) AS c FROM products WHERE deleted_at IS NULL'
    )) || {};

    const lowStockProducts = await queryAll(
      db,
      `
      SELECT
        p.id,
        p.name,
        p.min_stock,
        p.unit,
        COALESCE(SUM(ib.stock), 0) AS current_stock
      FROM products p
      LEFT JOIN inventory_batches ib ON p.id = ib.product_id AND ib.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      HAVING current_stock <= COALESCE(p.min_stock, 5)
      ORDER BY current_stock ASC, p.id ASC
      LIMIT 100
      `
    );

    const expiringBatches = await queryAll(
      db,
      `
      SELECT
        ib.id AS batch_id,
        p.id AS product_id,
        p.name,
        ib.stock,
        ib.expiry_date,
        ib.selling_price,
        ib.cost_price
      FROM inventory_batches ib
      INNER JOIN products p ON p.id = ib.product_id AND p.deleted_at IS NULL
      WHERE ib.deleted_at IS NULL
        AND ib.stock > 0
        AND ib.expiry_date IS NOT NULL
        AND TRIM(ib.expiry_date) <> ''
        AND date(ib.expiry_date) <= date('now', '+30 days')
      ORDER BY date(ib.expiry_date) ASC
      LIMIT 100
      `
    );

    // 8. الترتيب والرسوم البيانية
    const topProducts = await queryAll(
      db,
      `
      SELECT
        p.id,
        COALESCE(p.name, si.custom_product_name, 'منتج مخصص') AS name,
        COALESCE(p.category, 'عام') AS category,
        COALESCE(SUM(si.quantity), 0) AS qty_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity * COALESCE(si.cost_price, ib.cost_price, si.custom_cost_price, 0)), 0) AS cost,
        COALESCE(SUM(si.subtotal) - SUM(si.quantity * COALESCE(si.cost_price, ib.cost_price, si.custom_cost_price, 0)), 0) AS profit
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
      LEFT JOIN products p ON p.id = si.product_id
      LEFT JOIN inventory_batches ib ON ib.id = si.batch_id
      WHERE si.deleted_at IS NULL AND ${salesWhere}
      GROUP BY COALESCE(si.product_id, si.custom_product_name)
      ORDER BY revenue DESC
      LIMIT 20
      `,
      salesParams
    );

    const topCustomers = await queryAll(
      db,
      `
      SELECT
        c.id,
        c.name,
        c.phone,
        COALESCE(SUM(CASE WHEN s.total > 0 THEN s.total ELSE 0 END), 0) AS total_revenue,
        COUNT(s.id) AS purchase_count
      FROM customers c
      INNER JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
      WHERE c.deleted_at IS NULL AND ${salesWhere}
      GROUP BY c.id
      ORDER BY total_revenue DESC
      LIMIT 20
      `,
      salesParams
    );

    const salesByCategory = await queryAll(
      db,
      `
      SELECT
        COALESCE(NULLIF(TRIM(p.category), ''), 'غير مصنف') AS category,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity), 0) AS qty_sold
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
      LEFT JOIN products p ON p.id = si.product_id
      WHERE si.deleted_at IS NULL AND ${salesWhere}
      GROUP BY COALESCE(NULLIF(TRIM(p.category), ''), 'غير مصنف')
      ORDER BY revenue DESC
      `,
      salesParams
    );

    const dailySalesTrend = await queryAll(
      db,
      `
      SELECT
        date(s.sale_date) AS date,
        COALESCE(SUM(s.total), 0) AS revenue,
        COUNT(*) AS count
      FROM sales s
      WHERE ${salesWhere}
      GROUP BY date(s.sale_date)
      ORDER BY date(s.sale_date) ASC
      `,
      salesParams
    );

    const hourlySales = await queryAll(
      db,
      `
      SELECT
        strftime('%H', s.sale_date) AS hour,
        COUNT(*) AS sales_count,
        COALESCE(SUM(s.total), 0) AS revenue
      FROM sales s
      WHERE ${salesWhere}
      GROUP BY strftime('%H', s.sale_date)
      ORDER BY hour ASC
      `,
      salesParams
    );

    const netRevenue = Number(salesSummary.net_revenue || 0);
    const cogs = Number(cogsRow.cogs || 0);
    const grossProfit = Number((netRevenue - cogs).toFixed(2));
    const netProfit = Number((grossProfit - totalExpenses).toFixed(2));

    const cashIn = Number(cashInRow.cash_in || 0);
    const cashOut = Number(cashOutRow.cash_out || 0);
    const netCashFlow = Number((cashIn - cashOut).toFixed(2));

    const totalCustomerDebt = Number(totalCustomerDebtRow.total || 0);
    const totalSupplierDebt = Number(totalSupplierDebtRow.total || 0);

    const costValue = Number(invValuation.cost_value || 0);
    const sellValue = Number(invValuation.sell_value || 0);
    const zakatPool = Math.max(
      0,
      Number((Math.max(0, netCashFlow) + costValue + totalCustomerDebt - totalSupplierDebt).toFixed(2))
    );
    const zakatAmount = Number((zakatPool * 0.025).toFixed(2));

    const inventoryHybrid = createHybridArrayObject({
      cost_value: costValue,
      sell_value: sellValue,
      total_units: Number(invValuation.total_units || 0),
      batches_count: Number(invValuation.batches_count || 0),
      expected_profit: Number((sellValue - costValue).toFixed(2))
    });

    return {
      sales: createHybridArrayObject({
        revenue: Number(salesSummary.revenue || 0),
        returns_value: Number(salesSummary.returns_value || 0),
        net_revenue: netRevenue,
        total_discounts: Number(salesSummary.total_discounts || 0),
        sales_tax_collected: Number(salesSummary.sales_tax_collected || 0),
        total_sales_count: Number(salesSummary.total_sales_count || 0),
        returns_count: Number(salesSummary.returns_count || 0),
        cash_sales_paid: Number(salesSummary.cash_sales_paid || 0),
        credit_sales_unpaid: Number(salesSummary.credit_sales_unpaid || 0)
      }),
      purchases: createHybridArrayObject({
        total_purchases: Number(purchasesSummary.total_purchases || 0),
        additional_costs: Number(purchasesSummary.additional_costs || 0),
        purchase_tax_paid: Number(purchasesSummary.purchase_tax_paid || 0),
        total_purchases_count: Number(purchasesSummary.total_purchases_count || 0)
      }),
      revenue: Number(salesSummary.revenue || 0),
      returns_value: Number(salesSummary.returns_value || 0),
      net_revenue: netRevenue,
      total_discounts: Number(salesSummary.total_discounts || 0),
      sales_tax_collected: Number(salesSummary.sales_tax_collected || 0),
      total_stamp_duty: Number(salesSummary.total_stamp_duty || 0),
      total_sales_count: Number(salesSummary.total_sales_count || 0),
      returns_count: Number(salesSummary.returns_count || 0),
      cogs,
      gross_profit: grossProfit,
      net_profit: netProfit,
      total_purchases: Number(purchasesSummary.total_purchases || 0),
      additional_costs: Number(purchasesSummary.additional_costs || 0),
      purchase_tax_paid: Number(purchasesSummary.purchase_tax_paid || 0),
      total_purchases_count: Number(purchasesSummary.total_purchases_count || 0),
      totalExpenses,
      expensesByCategory,
      expenses: expensesByCategory,
      totalCapital: Number(capitalRow.total || 0),
      cash_in: cashIn,
      cash_out: cashOut,
      net_cash_flow: netCashFlow,
      totalCustomerDebt,
      totalCustomerDebtsCount: Number(totalCustomerDebtRow.cnt || 0),
      customerDebts,
      totalSupplierDebt,
      totalSupplierDebtsCount: Number(totalSupplierDebtRow.cnt || 0),
      supplierDebts,
      debtAging: debtAgingHybrid,
      inventory: inventoryHybrid,
      inventoryValuation: inventoryHybrid,
      productsCount: Number(prodCountRow.c || 0),
      lowStock: lowStockProducts,
      lowStockProducts,
      expiring: expiringBatches,
      expiringBatches,
      topProducts,
      topCustomers,
      salesByCategory,
      dailySalesTrend,
      hourlySales,
      zakat: createHybridArrayObject({
        pool: zakatPool,
        amount: zakatAmount,
        rate: 0.025
      })
    };
  };

  if (typeof callback === 'function') {
    runAnalysis().then((res) => callback(null, res)).catch((err) => callback(err));
    return;
  }
  return runAnalysis();
}

function buildSegmentFilterSql(params = {}) {
  const scopeType = String(params.scopeType || params.scope_type || 'all').toLowerCase();
  const category = params.category ? String(params.category).trim() : null;
  const family = params.family ? String(params.family).trim() : null;
  const productIds = Array.isArray(params.productIds)
    ? params.productIds.map(Number).filter(Boolean)
    : [];

  const conds = ['1=1'];
  const sqlParams = [];

  if (scopeType === 'category' && category) {
    conds.push('p.category = ?');
    sqlParams.push(category);
  } else if (scopeType === 'family' && family) {
    conds.push('p.family = ?');
    sqlParams.push(family);
  } else if (scopeType === 'products' && productIds.length > 0) {
    conds.push(`p.id IN (${productIds.map(() => '?').join(',')})`);
    sqlParams.push(...productIds);
  } else {
    if (category) {
      conds.push('p.category = ?');
      sqlParams.push(category);
    }
    if (family) {
      conds.push('p.family = ?');
      sqlParams.push(family);
    }
    if (productIds.length > 0) {
      conds.push(`p.id IN (${productIds.map(() => '?').join(',')})`);
      sqlParams.push(...productIds);
    }
  }

  return { whereExpr: conds.join(' AND '), sqlParams };
}

/**
 * تحليلات الشرائح المتقدمة (Segment Analytics)
 */
async function getSegmentAnalytics(db, params = {}, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = {};
  }

  const work = async () => {
    const { dateFrom, dateTo } = normalizeDateRange(params);
    const { whereExpr, sqlParams } = buildSegmentFilterSql(params);

    const dateConds = ['s.deleted_at IS NULL', 'si.deleted_at IS NULL', whereExpr];
    const queryParams = [...sqlParams];

    if (dateFrom) {
      dateConds.push('date(s.sale_date) >= date(?)');
      queryParams.push(dateFrom);
    }
    if (dateTo) {
      dateConds.push('date(s.sale_date) <= date(?)');
      queryParams.push(dateTo);
    }
    const fullWhere = dateConds.join(' AND ');

    const summary = (await queryGet(
      db,
      `
      SELECT
        COALESCE(SUM(CASE WHEN si.quantity > 0 THEN si.quantity ELSE 0 END), 0) AS gross_qty,
        COALESCE(SUM(CASE WHEN si.quantity < 0 THEN -si.quantity ELSE 0 END), 0) AS returned_qty,
        COALESCE(SUM(si.quantity), 0) AS net_qty,
        COALESCE(SUM(CASE WHEN si.subtotal > 0 THEN si.subtotal ELSE 0 END), 0) AS gross_revenue,
        COALESCE(SUM(CASE WHEN si.subtotal < 0 THEN -si.subtotal ELSE 0 END), 0) AS returns_value,
        COALESCE(SUM(si.subtotal), 0) AS net_revenue,
        COALESCE(SUM(si.quantity * COALESCE(si.cost_price, ib.cost_price, si.custom_cost_price, 0)), 0) AS cogs,
        COUNT(DISTINCT s.id) AS invoices_count
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      LEFT JOIN inventory_batches ib ON ib.id = si.batch_id
      WHERE ${fullWhere}
      `,
      queryParams
    )) || {};

    const dailyTrend = await queryAll(
      db,
      `
      SELECT
        date(s.sale_date) AS date,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity), 0) AS qty
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE ${fullWhere}
      GROUP BY date(s.sale_date)
      ORDER BY date(s.sale_date) ASC
      `,
      queryParams
    );

    const topCustomers = await queryAll(
      db,
      `
      SELECT
        c.id,
        c.name,
        c.phone,
        COALESCE(SUM(CASE WHEN si.subtotal > 0 THEN si.subtotal ELSE 0 END), 0) AS total_revenue,
        COUNT(DISTINCT s.id) AS purchase_count
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN customers c ON c.id = s.customer_id AND c.deleted_at IS NULL
      LEFT JOIN products p ON p.id = si.product_id
      WHERE ${fullWhere}
      GROUP BY c.id
      ORDER BY total_revenue DESC
      LIMIT 15
      `,
      queryParams
    );

    const inventoryStats = (await queryGet(
      db,
      `
      SELECT
        COALESCE(SUM(CASE WHEN ib.stock > 0 THEN ib.stock * ib.cost_price ELSE 0 END), 0) AS cost_value,
        COALESCE(SUM(CASE WHEN ib.stock > 0 THEN ib.stock * ib.selling_price ELSE 0 END), 0) AS sell_value,
        COALESCE(SUM(CASE WHEN ib.stock > 0 THEN ib.stock ELSE 0 END), 0) AS units,
        COUNT(ib.id) AS batches_count
      FROM products p
      LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND ${whereExpr}
      `,
      sqlParams
    )) || {};

    const productBreakdownData = await getSegmentProducts(db, {
      ...params,
      productPage: params.productPage ?? 0,
      productPageSize: params.productPageSize ?? 25
    });

    const netRev = Number(summary.net_revenue || 0);
    const cogs = Number(summary.cogs || 0);

    return {
      summary: {
        ...summary,
        profit: Number((netRev - cogs).toFixed(2))
      },
      dailySalesTrend: dailyTrend,
      topCustomers,
      inventory: inventoryStats,
      productBreakdown: productBreakdownData.items,
      productTotal: productBreakdownData.total
    };
  };

  if (typeof callback === 'function') {
    work().then((res) => callback(null, res)).catch((err) => callback(err));
    return;
  }
  return work();
}

/**
 * تفصيل المنتجات داخل شريحة محددة مع الترقيم (Pagination)
 */
async function getSegmentProducts(db, params = {}, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = {};
  }

  const work = async () => {
    const { dateFrom, dateTo } = normalizeDateRange(params);
    const { whereExpr, sqlParams } = buildSegmentFilterSql(params);
    const page = Math.max(0, parseInt(params.productPage ?? params.page ?? 0, 10) || 0);
    const pageSize = Math.max(1, parseInt(params.productPageSize ?? params.pageSize ?? 25, 10) || 25);

    const dateConds = ['s.deleted_at IS NULL', 'si.deleted_at IS NULL', whereExpr];
    const queryParams = [...sqlParams];

    if (dateFrom) {
      dateConds.push('date(s.sale_date) >= date(?)');
      queryParams.push(dateFrom);
    }
    if (dateTo) {
      dateConds.push('date(s.sale_date) <= date(?)');
      queryParams.push(dateTo);
    }
    const fullWhere = dateConds.join(' AND ');

    const countRow = (await queryGet(
      db,
      `
      SELECT COUNT(*) AS c FROM (
        SELECT p.id
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        INNER JOIN products p ON p.id = si.product_id
        WHERE ${fullWhere}
        GROUP BY p.id
      )
      `,
      queryParams
    )) || {};

    const items = await queryAll(
      db,
      `
      SELECT
        p.id,
        p.name,
        p.category,
        p.family,
        p.unit,
        COALESCE(SUM(si.quantity), 0) AS qty_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity * COALESCE(si.cost_price, ib.cost_price, si.custom_cost_price, 0)), 0) AS cost,
        COALESCE(SUM(si.subtotal) - SUM(si.quantity * COALESCE(si.cost_price, ib.cost_price, si.custom_cost_price, 0)), 0) AS profit
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN products p ON p.id = si.product_id
      LEFT JOIN inventory_batches ib ON ib.id = si.batch_id
      WHERE ${fullWhere}
      GROUP BY p.id
      ORDER BY revenue DESC, p.id ASC
      LIMIT ? OFFSET ?
      `,
      [...queryParams, pageSize, page * pageSize]
    );

    return {
      items,
      total: Number(countRow.c || 0),
      page,
      pageSize
    };
  };

  if (typeof callback === 'function') {
    work().then((res) => callback(null, res)).catch((err) => callback(err));
    return;
  }
  return work();
}

/**
 * محرك توصيات Gherbi.Ai Copilot المحلي (تحليل البضاعة الراكدة، سرعة الدوران، وتوقعات إعادة الطلب)
 */
async function getAiCopilotInsights(db) {
  // 1. المنتجات سريعة النفاد التي تحتاج إعادة طلب عاجلة بناءً على معدل السحب في آخر 14 يوماً
  const reorderSuggestions = await queryAll(
    db,
    `
    SELECT
      p.id,
      p.name,
      p.category,
      p.supplier,
      COALESCE(st.current_stock, 0) AS current_stock,
      COALESCE(vel.sold_14d, 0) AS sold_14d,
      ROUND(COALESCE(vel.sold_14d, 0) / 14.0, 2) AS daily_velocity,
      CASE
        WHEN COALESCE(vel.sold_14d, 0) > 0
        THEN ROUND(COALESCE(st.current_stock, 0) / (vel.sold_14d / 14.0), 1)
        ELSE 999
      END AS days_of_supply
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(stock) AS current_stock
      FROM inventory_batches
      WHERE deleted_at IS NULL
      GROUP BY product_id
    ) st ON st.product_id = p.id
    LEFT JOIN (
      SELECT si.product_id, SUM(si.quantity) AS sold_14d
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
      WHERE si.deleted_at IS NULL AND date(s.sale_date) >= date('now', '-14 days')
      GROUP BY si.product_id
    ) vel ON vel.product_id = p.id
    WHERE p.deleted_at IS NULL
      AND COALESCE(vel.sold_14d, 0) > 0
      AND (COALESCE(st.current_stock, 0) / (vel.sold_14d / 14.0)) <= 7
    ORDER BY days_of_supply ASC
    LIMIT 25
    `
  );

  // 2. البضاعة الراكدة (Dead Stock) التي لم تُبع منذ 30 يوماً ولها رصيد مجمد
  const deadStock = await queryAll(
    db,
    `
    SELECT
      p.id,
      p.name,
      p.category,
      COALESCE(SUM(ib.stock), 0) AS stock_qty,
      COALESCE(SUM(ib.stock * ib.cost_price), 0) AS tied_capital
    FROM products p
    INNER JOIN inventory_batches ib ON ib.product_id = p.id AND ib.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
      AND ib.stock > 0
      AND NOT EXISTS (
        SELECT 1 FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
        WHERE si.product_id = p.id AND si.deleted_at IS NULL AND date(s.sale_date) >= date('now', '-30 days')
      )
    GROUP BY p.id
    HAVING stock_qty > 0
    ORDER BY tied_capital DESC
    LIMIT 25
    `
  );

  return {
    generatedAt: new Date().toISOString(),
    reorderSuggestions,
    deadStock
  };
}

module.exports = {
  getAnalytics,
  computeAnalytics: getAnalytics,
  getSegmentAnalytics,
  computeSegmentAnalytics: getSegmentAnalytics,
  getSegmentProducts,
  computeSegmentProducts: getSegmentProducts,
  getAiCopilotInsights
};