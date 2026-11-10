/**
 * gherbi-enterprise-foundation.js
 * الترقية المعمارية النظيفة (100% Clean-Room Enterprise Modules) لنظام Gherbi.Ai POS
 * تضيف: التقسيط ومطابقة CCP، تقرير État 104، التكلفة المحملة (Landed Cost & WAC)،
 * تعدد المخازن والتحويلات، التوصيل والمندوبين (COD)، الكوبونات، الموارد البشرية (HR Payroll)،
 * تذاكر الصيانة (Atelier / SAV)، والرقابة الجنائية (Forensic Audit Log).
 */

'use strict';

const NEW_ENTERPRISE_SYNC_TABLES = [
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
  'system_audit_logs'
];

function ensureSyncTriggerForTable(db, table) {
  db._rawRun(`DROP TRIGGER IF EXISTS trg_${table}_sync_insert`);
  db._rawRun(`DROP TRIGGER IF EXISTS trg_${table}_sync_update`);

  db._rawRun(`
    CREATE TRIGGER IF NOT EXISTS trg_${table}_sync_insert
    AFTER INSERT ON ${table}
    WHEN NEW.uuid IS NULL OR NEW.uuid = '' OR NEW.updated_at IS NULL OR NEW.updated_at = ''
    BEGIN
      UPDATE ${table}
      SET
        uuid = COALESCE(NULLIF(${table}.uuid, ''), lower(hex(randomblob(16)))),
        updated_at = COALESCE(NULLIF(${table}.updated_at, ''), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        origin_device = COALESCE(NULLIF(${table}.origin_device, ''), (SELECT value FROM settings WHERE key='instance_id')),
        dirty = COALESCE(${table}.dirty, 1)
      WHERE rowid = NEW.rowid;
    END;
  `);

  db._rawRun(`
    CREATE TRIGGER IF NOT EXISTS trg_${table}_sync_update
    AFTER UPDATE ON ${table}
    WHEN NEW.updated_at IS OLD.updated_at AND NEW.server_rev IS OLD.server_rev
    BEGIN
      UPDATE ${table}
      SET
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        origin_device = COALESCE((SELECT value FROM settings WHERE key='instance_id'), ${table}.origin_device),
        dirty = 1
      WHERE rowid = NEW.rowid;
    END;
  `);
}

function initEnterpriseFoundation(db) {
  if (!db) throw new Error('Valid SQLite db instance required for initEnterpriseFoundation');

  // إضافة الجداول الـ 13 إلى مصفوفة المزامنة في database.js
  if (Array.isArray(db.SYNCED_TABLES)) {
    for (const t of NEW_ENTERPRISE_SYNC_TABLES) {
      if (!db.SYNCED_TABLES.includes(t)) {
        db.SYNCED_TABLES.push(t);
      }
    }
  }

  db.serialize(() => {
    // 1. توسيع الجداول الحالية في Gherbi.Ai POS بأمان تام عبر safeAddColumn
    db.safeAddColumn('customers', "ccp_account TEXT DEFAULT ''");
    db.safeAddColumn('customers', "ccp_key TEXT DEFAULT ''");
    db.safeAddColumn('customers', "bank_rip TEXT DEFAULT ''");
    db.safeAddColumn('customers', "wilaya TEXT DEFAULT ''");
    db.safeAddColumn('customers', "commune TEXT DEFAULT ''");

    db.safeAddColumn('product_prices', 'min_qty REAL DEFAULT 1');
    db.safeAddColumn('product_barcodes', 'unit_multiplier REAL DEFAULT 1');
    db.safeAddColumn('product_barcodes', "pack_name TEXT DEFAULT ''");

    db.safeAddColumn('inventory_batches', 'warehouse_id INTEGER DEFAULT 1');
    db.safeAddColumn('inventory_batches', "shelf_etage TEXT DEFAULT ''");
    db.safeAddColumn('inventory_batches', "shelf_place TEXT DEFAULT ''");
    db.safeAddColumn('inventory_batches', 'wac_cost REAL DEFAULT 0');

    db.safeAddColumn('purchase_invoices', 'freight_cost REAL DEFAULT 0');
    db.safeAddColumn('purchase_invoices', 'customs_cost REAL DEFAULT 0');
    db.safeAddColumn('purchase_invoices', 'handling_cost REAL DEFAULT 0');

    db.safeAddColumn('sales', "coupon_code TEXT DEFAULT ''");
    db.safeAddColumn('sales', 'coupon_discount REAL DEFAULT 0');
    db.safeAddColumn('sales', 'warehouse_id INTEGER DEFAULT 1');
    db.safeAddColumn('sale_items', "bonus_qty REAL DEFAULT 0");
    db.safeAddColumn('sale_items', "pack_count REAL DEFAULT 0");
    db.safeAddColumn('sale_items', "pack_multiplier REAL DEFAULT 1");
    db.safeAddColumn('sale_items', "sold_m2 REAL DEFAULT 0");
    db.safeAddColumn('sale_items', "warranty_months INTEGER DEFAULT 0");
    db.safeAddColumn('products', "warranty_months INTEGER DEFAULT 0");
    db.safeAddColumn('products', "semi_wholesale_price REAL DEFAULT 0");
    db.safeAddColumn('products', "super_wholesale_price REAL DEFAULT 0");
    db.safeAddColumn('products', "area_m2_per_box REAL DEFAULT 0");
    db.safeAddColumn('products', "linear_meters_per_roll REAL DEFAULT 0");
    db.safeAddColumn('products', "weight_kg_per_unit REAL DEFAULT 0");
    db.safeAddColumn('products', "oem_reference TEXT DEFAULT ''");
    db.safeAddColumn('products', "compatible_models TEXT DEFAULT ''");
    db.safeAddColumn('products', "bogo_buy_qty INTEGER DEFAULT 0");
    db.safeAddColumn('products', "bogo_free_qty INTEGER DEFAULT 0");
    db.safeAddColumn('products', "series_pack_json TEXT DEFAULT ''");
    db.safeAddColumn('customers', "ccp_account TEXT DEFAULT ''");
    db.safeAddColumn('customers', "ccp_key TEXT DEFAULT ''");
    db.safeAddColumn('customers', "bank_rip TEXT DEFAULT ''");
    db.safeAddColumn('customers', "wilaya TEXT DEFAULT ''");
    db.safeAddColumn('customers', "commune TEXT DEFAULT ''");
    db.safeAddColumn('product_prices', "min_qty REAL DEFAULT 1");
    db.safeAddColumn('product_barcodes', "unit_multiplier REAL DEFAULT 1");
    db.safeAddColumn('product_barcodes', "pack_name TEXT DEFAULT ''");
    db.safeAddColumn('inventory_batches', "warehouse_id INTEGER DEFAULT 1");
    db.safeAddColumn('inventory_batches', "shelf_etage TEXT DEFAULT ''");
    db.safeAddColumn('inventory_batches', "shelf_place TEXT DEFAULT ''");
    db.safeAddColumn('inventory_batches', "wac_cost REAL DEFAULT 0");
    db.safeAddColumn('purchase_invoices', "freight_cost REAL DEFAULT 0");
    db.safeAddColumn('purchase_invoices', "customs_cost REAL DEFAULT 0");
    db.safeAddColumn('purchase_invoices', "handling_cost REAL DEFAULT 0");
    db.safeAddColumn('sales', "coupon_code TEXT DEFAULT ''");
    db.safeAddColumn('sales', "coupon_discount REAL DEFAULT 0");
    db.safeAddColumn('sales', "warehouse_id INTEGER DEFAULT 1");
    db.safeAddColumn('sales', "split_payments_json TEXT");

    // 2. جدول المستودعات والتحويلات المخزنية
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        location TEXT DEFAULT '',
        type TEXT DEFAULT 'main', -- main, branch, van
        driver_id INTEGER,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      INSERT OR IGNORE INTO warehouses (id, name, location, type, is_default)
      VALUES (1, 'المخزن الرئيسي للمؤسسة', 'الجزائر', 'main', 1)
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS stock_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_number TEXT,
        from_warehouse_id INTEGER NOT NULL,
        to_warehouse_id INTEGER NOT NULL,
        driver_id INTEGER,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        transfer_date TEXT NOT NULL,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        batch_id INTEGER,
        quantity REAL NOT NULL,
        cost_price REAL DEFAULT 0,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE
      )
    `);

    // 3. عقود التقسيط، الأقساط الشهرية، ومطابقة بريد الجزائر (CCP)
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS installment_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_number TEXT,
        customer_id INTEGER NOT NULL,
        sale_id INTEGER,
        total_amount REAL NOT NULL DEFAULT 0,
        down_payment REAL NOT NULL DEFAULT 0,
        financed_amount REAL NOT NULL DEFAULT 0,
        months_count INTEGER NOT NULL DEFAULT 1,
        monthly_amount REAL NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        payment_method TEXT DEFAULT 'CCP',
        ccp_account TEXT,
        ccp_key TEXT,
        bank_rip TEXT,
        guarantee_cheque_no TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS installment_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER DEFAULT 0,
        contract_id INTEGER,
        customer_id INTEGER,
        sale_id INTEGER,
        installment_num INTEGER DEFAULT 1,
        installment_no INTEGER DEFAULT 1,
        due_date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'pending', -- pending, partial, paid, overdue
        paid_at TEXT,
        payment_id INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    // ضمان توافق جدول installment_schedules في حال كان منشأً مسبقاً
    db.safeAddColumn('installment_schedules', 'contract_id INTEGER');
    db.safeAddColumn('installment_schedules', 'customer_id INTEGER');
    db.safeAddColumn('installment_schedules', 'sale_id INTEGER');
    db.safeAddColumn('installment_schedules', 'installment_no INTEGER DEFAULT 1');
    db.safeAddColumn('installment_schedules', 'payment_id INTEGER');
    db.safeAddColumn('installment_schedules', 'notes TEXT');

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS ccp_reconciliation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_file_name TEXT,
        transaction_date TEXT,
        ccp_account TEXT,
        amount REAL NOT NULL,
        transaction_ref TEXT,
        match_status TEXT DEFAULT 'UNMATCHED', -- MATCHED, UNMATCHED, DUPLICATE
        schedule_id INTEGER,
        customer_id INTEGER,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    // 4. السائقون، المندوبون، وشحنات التوصيل (Van Sales & COD Delivery)
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        vehicle_name TEXT,
        vehicle_plate TEXT,
        pin_code TEXT,
        warehouse_id INTEGER,
        commission_rate REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS delivery_shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_number TEXT,
        sale_id INTEGER,
        order_id INTEGER,
        customer_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_address TEXT,
        wilaya TEXT,
        commune TEXT,
        driver_id INTEGER,
        carrier_name TEXT,
        tracking_code TEXT,
        shipping_fee REAL DEFAULT 0,
        cod_amount REAL DEFAULT 0,
        collected_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'preparing', -- preparing, in_transit, delivered, returned
        delivery_date TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    // 5. كوبونات الخصم، الموظفون والرواتب، تذاكر الصيانة، والرقابة الجنائية
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS discount_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        discount_type TEXT DEFAULT 'percent', -- percent, fixed
        discount_value REAL NOT NULL,
        min_invoice_total REAL DEFAULT 0,
        max_uses INTEGER DEFAULT 100,
        used_count INTEGER DEFAULT 0,
        expiry_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role_title TEXT DEFAULT 'بائع',
        phone TEXT,
        base_salary REAL DEFAULT 0,
        commission_percent REAL DEFAULT 0,
        hire_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS payroll_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        period_month TEXT NOT NULL, -- YYYY-MM
        base_amount REAL DEFAULT 0,
        bonus_amount REAL DEFAULT 0,
        deduction_amount REAL DEFAULT 0,
        net_paid REAL NOT NULL,
        payment_date TEXT NOT NULL,
        expense_id INTEGER,
        session_id INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS service_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT,
        customer_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        item_model TEXT NOT NULL,
        serial_or_plate TEXT,
        problem_desc TEXT,
        diagnosis_notes TEXT,
        estimated_cost REAL DEFAULT 0,
        deposit_paid REAL DEFAULT 0,
        final_total REAL DEFAULT 0,
        status TEXT DEFAULT 'received', -- received, diagnosing, in_progress, ready, delivered
        technician_name TEXT,
        promised_date TEXT,
        sale_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS system_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        action_code TEXT NOT NULL,
        entity_table TEXT,
        entity_id TEXT,
        before_json TEXT,
        after_json TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    // 6. الفهارس ومشغلات المزامنة للجداول الـ 13 الجديدة
    for (const tbl of NEW_ENTERPRISE_SYNC_TABLES) {
      db._rawRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tbl}_uuid ON ${tbl}(uuid)`);
      db._rawRun(`CREATE INDEX IF NOT EXISTS idx_${tbl}_dirty ON ${tbl}(dirty) WHERE dirty = 1`);
      db._rawRun(`CREATE INDEX IF NOT EXISTS idx_${tbl}_updated ON ${tbl}(updated_at)`);
      ensureSyncTriggerForTable(db, tbl);
    }

    db._rawRun('CREATE INDEX IF NOT EXISTS idx_inst_sched_contract ON installment_schedules(contract_id, status)');
    db._rawRun('CREATE INDEX IF NOT EXISTS idx_inst_sched_cust ON installment_schedules(customer_id, due_date)');
    db._rawRun('CREATE INDEX IF NOT EXISTS idx_ccp_logs_ref ON ccp_reconciliation_logs(transaction_ref)');
    db._rawRun('CREATE INDEX IF NOT EXISTS idx_shipments_status ON delivery_shipments(status, driver_id)');
    db._rawRun('CREATE INDEX IF NOT EXISTS idx_coupons_code ON discount_coupons(code, is_active)');
    db._rawRun('CREATE INDEX IF NOT EXISTS idx_audit_action ON system_audit_logs(action_code, created_at)');
  });

  // =========================================================================
  // الدوال المحاسبية والتشغيلية للوحدات الـ 6 (Clean-Room Business Logic)
  // =========================================================================
  const api = {
    /**
     * 1. استخراج الكشف الضريبي السنوي الجزائري (État 104)
     */
    async getEtat104Report(year) {
      const targetYear = String(year || new Date().getFullYear());
      const dateFrom = `${targetYear}-01-01`;
      const dateTo = `${targetYear}-12-31`;

      return await db.dbAll(
        `
        SELECT
          c.id AS customer_id,
          c.name AS customer_name,
          COALESCE(NULLIF(TRIM(c.nif), ''), '---') AS nif,
          COALESCE(NULLIF(TRIM(c.rc), ''), '---') AS rc,
          COALESCE(NULLIF(TRIM(c.ai), ''), '---') AS ai,
          COALESCE(NULLIF(TRIM(c.nis), ''), '---') AS nis,
          COALESCE(c.address, '') AS address,
          COUNT(s.id) AS invoices_count,
          ROUND(SUM(
            CASE
              WHEN COALESCE(s.tax_percentage, 0) > 0
              THEN (s.total - COALESCE(s.stamp_amount, 0)) / (1.0 + (s.tax_percentage / 100.0))
              ELSE (s.total - COALESCE(s.stamp_amount, 0))
            END
          ), 2) AS total_ht,
          ROUND(SUM(
            CASE
              WHEN COALESCE(s.tax_percentage, 0) > 0
              THEN (s.total - COALESCE(s.stamp_amount, 0)) - ((s.total - COALESCE(s.stamp_amount, 0)) / (1.0 + (s.tax_percentage / 100.0)))
              ELSE 0
            END
          ), 2) AS total_tva,
          ROUND(SUM(COALESCE(s.stamp_amount, 0)), 2) AS total_stamp,
          ROUND(SUM(s.total), 2) AS total_ttc
        FROM customers c
        INNER JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
          AND s.total > 0
          AND date(s.sale_date) BETWEEN date(?) AND date(?)
        GROUP BY c.id
        ORDER BY total_ttc DESC
        `,
        [dateFrom, dateTo]
      );
    },

    /**
     * 2. إنشاء عقد بيع بالتقسيط مع توليد جدول الأقساط الشهرية آلياً
     */
    async createInstallmentContract(payload = {}) {
      return await db.withTransaction(async (tx) => {
        const customerId = Number(payload.customer_id || payload.customerId);
        if (!customerId) throw new Error('يرجى تحديد الزبون لإنشاء عقد التقسيط');

        const total = Number(payload.total_amount ?? payload.total ?? 0);
        const down = Number(payload.down_payment ?? payload.downPayment ?? 0);
        const financed = Math.max(0, Number((total - down).toFixed(2)));
        const months = Math.max(1, parseInt(payload.months_count ?? payload.monthsCount ?? 6, 10));
        const monthly = Number((financed / months).toFixed(2));
        const startDate = payload.start_date || new Date().toISOString().slice(0, 10);
        const contractNo = payload.contract_number || `CNT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

        // تحديث بيانات CCP/RIP في بطاقة الزبون تلقائياً إن تم تزويدها
        if (payload.ccp_account || payload.bank_rip) {
          await tx.dbRun(
            `UPDATE customers
             SET ccp_account = COALESCE(NULLIF(?, ''), ccp_account),
                 ccp_key = COALESCE(NULLIF(?, ''), ccp_key),
                 bank_rip = COALESCE(NULLIF(?, ''), bank_rip)
             WHERE id = ?`,
            [payload.ccp_account || '', payload.ccp_key || '', payload.bank_rip || '', customerId]
          );
        }

        const ins = await tx.dbRun(
          `INSERT INTO installment_contracts (
            contract_number, customer_id, sale_id, total_amount, down_payment,
            financed_amount, months_count, monthly_amount, start_date,
            payment_method, ccp_account, ccp_key, bank_rip, guarantee_cheque_no, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
          [
            contractNo,
            customerId,
            payload.sale_id || null,
            total,
            down,
            financed,
            months,
            monthly,
            startDate,
            payload.payment_method || 'CCP',
            payload.ccp_account || '',
            payload.ccp_key || '',
            payload.bank_rip || '',
            payload.guarantee_cheque_no || '',
            payload.notes || ''
          ]
        );

        const contractId = ins.lastID;
        const baseDate = new Date(startDate);
        let allocated = 0;

        for (let i = 1; i <= months; i++) {
          const due = new Date(baseDate);
          due.setMonth(due.getMonth() + i);
          const dueStr = due.toISOString().slice(0, 10);
          const instAmt = i === months ? Number((financed - allocated).toFixed(2)) : monthly;
          allocated = Number((allocated + instAmt).toFixed(2));

          await tx.dbRun(
            `INSERT INTO installment_schedules (
              plan_id, contract_id, customer_id, sale_id,
              installment_num, installment_no, due_date, amount, paid_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
            [contractId, contractId, customerId, payload.sale_id || null, i, i, dueStr, instAmt]
          );
        }

        return { id: contractId, contract_number: contractNo, monthly_amount: monthly, financed_amount: financed };
      });
    },

    /**
     * 3. جلب عقود التقسيط وجدول الأقساط
     */
    async getInstallmentContracts(filters = {}) {
      const conds = ['ic.deleted_at IS NULL'];
      const params = [];
      if (filters.customer_id) {
        conds.push('ic.customer_id = ?');
        params.push(Number(filters.customer_id));
      }
      if (filters.status && filters.status !== 'all') {
        conds.push('ic.status = ?');
        params.push(String(filters.status));
      }

      const contracts = await db.dbAll(
        `
        SELECT
          ic.*,
          c.name AS customer_name,
          c.phone AS customer_phone,
          COALESCE(NULLIF(ic.ccp_account, ''), c.ccp_account, '') AS effective_ccp,
          COALESCE(NULLIF(ic.ccp_key, ''), c.ccp_key, '') AS effective_ccp_key
        FROM installment_contracts ic
        LEFT JOIN customers c ON c.id = ic.customer_id
        WHERE ${conds.join(' AND ')}
        ORDER BY ic.id DESC
        `,
        params
      );

      const schedules = await db.dbAll(
        `
        SELECT
          s.*,
          COALESCE(s.contract_id, s.plan_id) AS resolved_contract_id,
          COALESCE(s.installment_no, s.installment_num, 1) AS resolved_no,
          c.name AS customer_name,
          c.phone AS customer_phone,
          ic.contract_number,
          COALESCE(NULLIF(ic.ccp_account, ''), c.ccp_account, '') AS ccp_account
        FROM installment_schedules s
        LEFT JOIN installment_contracts ic ON ic.id = COALESCE(s.contract_id, s.plan_id)
        LEFT JOIN customers c ON c.id = COALESCE(s.customer_id, ic.customer_id)
        WHERE s.deleted_at IS NULL
        ORDER BY date(s.due_date) ASC, s.id ASC
        `
      );

      return { contracts, schedules };
    },

    /**
     * 4. تسديد قسط شهري يدوياً أو جزئياً
     */
    async payInstallmentSchedule(payload = {}) {
      return await db.withTransaction(async (tx) => {
        const scheduleId = Number(payload.schedule_id || payload.id);
        const payAmount = Number(payload.amount || 0);
        const payDate = payload.date || new Date().toISOString().slice(0, 10);
        if (!scheduleId || payAmount <= 0) throw new Error('مبلغ تسديد القسط غير صالح');

        const sched = await tx.dbGet(
          `SELECT s.*, COALESCE(s.contract_id, s.plan_id) AS cid, ic.customer_id AS ic_cust, ic.sale_id AS ic_sale
           FROM installment_schedules s
           LEFT JOIN installment_contracts ic ON ic.id = COALESCE(s.contract_id, s.plan_id)
           WHERE s.id = ? AND s.deleted_at IS NULL`,
          [scheduleId]
        );
        if (!sched) throw new Error('القسط المطلوب غير موجود');

        const custId = sched.customer_id || sched.ic_cust;
        const saleId = sched.sale_id || sched.ic_sale || null;
        const newPaid = Number((Number(sched.paid_amount || 0) + payAmount).toFixed(2));
        const newStatus = newPaid >= Number(sched.amount) - 0.01 ? 'paid' : 'partial';
        const receiptNo = await db.nextNumber('payment_receipt');

        const payIns = await tx.dbRun(
          `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method, reference, receipt_number, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            custId,
            payAmount,
            payDate,
            payload.payment_method || 'ccp',
            payload.reference || '',
            receiptNo,
            payload.notes || `تسديد القسط رقم #${sched.installment_no || sched.installment_num || 1}`
          ]
        );

        if (saleId) {
          await tx.dbRun(
            'UPDATE sales SET paid_amount = MIN(total, COALESCE(paid_amount, 0) + ?) WHERE id = ?',
            [payAmount, saleId]
          );
        }

        await tx.dbRun(
          `UPDATE installment_schedules
           SET paid_amount = ?, status = ?, paid_at = ?, payment_id = ?
           WHERE id = ?`,
          [newPaid, newStatus, new Date().toISOString(), payIns.lastID, scheduleId]
        );

        // إذا اكتملت جميع أقساط العقد، نغير حالة العقد إلى completed
        if (sched.cid) {
          const openRow = await tx.dbGet(
            `SELECT COUNT(*) AS cnt FROM installment_schedules
             WHERE COALESCE(contract_id, plan_id) = ? AND status <> 'paid' AND deleted_at IS NULL`,
            [sched.cid]
          );
          if (openRow && Number(openRow.cnt) === 0) {
            await tx.dbRun("UPDATE installment_contracts SET status = 'completed' WHERE id = ?", [sched.cid]);
          }
        }

        return { success: true, payment_id: payIns.lastID, receipt_number: receiptNo, status: newStatus };
      });
    },

    /**
     * 5. محرك المطابقة الآلية لكشوفات الحساب البريدي (CCP Statement Reconciliation)
     */
    async reconcileCcpEntries(entries = [], fileName = 'ccp_statement.csv') {
      return await db.withTransaction(async (tx) => {
        let matched = 0;
        let unmatched = 0;
        let duplicate = 0;

        for (const row of entries) {
          const acc = String(row.ccp_account || '').replace(/\D/g, '');
          const amt = Number(row.amount || 0);
          const ref = String(row.transaction_ref || '').trim();
          const dt = row.transaction_date || new Date().toISOString().slice(0, 10);

          if (!acc || amt <= 0) continue;

          if (ref) {
            const dup = await tx.dbGet(
              'SELECT id FROM ccp_reconciliation_logs WHERE transaction_ref = ? AND deleted_at IS NULL',
              [ref]
            );
            if (dup) {
              duplicate++;
              continue;
            }
          }

          const targetInst = await tx.dbGet(
            `
            SELECT s.id, COALESCE(s.contract_id, s.plan_id) AS contract_id, COALESCE(s.customer_id, c.customer_id) AS customer_id,
                   COALESCE(s.sale_id, c.sale_id) AS sale_id, s.amount, s.paid_amount
            FROM installment_schedules s
            LEFT JOIN installment_contracts c ON c.id = COALESCE(s.contract_id, s.plan_id) AND c.deleted_at IS NULL
            LEFT JOIN customers cu ON cu.id = COALESCE(s.customer_id, c.customer_id) AND cu.deleted_at IS NULL
            WHERE s.deleted_at IS NULL
              AND s.status IN ('pending', 'overdue', 'partial')
              AND (REPLACE(COALESCE(c.ccp_account, ''), ' ', '') = ? OR REPLACE(COALESCE(cu.ccp_account, ''), ' ', '') = ?)
            ORDER BY date(s.due_date) ASC, COALESCE(s.installment_no, s.installment_num) ASC
            LIMIT 1
            `,
            [acc, acc]
          );

          if (targetInst) {
            const newPaid = Number((Number(targetInst.paid_amount || 0) + amt).toFixed(2));
            const newStatus = newPaid >= Number(targetInst.amount) - 0.01 ? 'paid' : 'partial';
            const receiptNo = await db.nextNumber('payment_receipt');

            const payIns = await tx.dbRun(
              `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method, reference, receipt_number, notes)
               VALUES (?, ?, ?, ?, 'ccp', ?, ?, ?)`,
              [
                targetInst.sale_id || null,
                targetInst.customer_id,
                amt,
                dt,
                ref,
                receiptNo,
                `تسديد قسط تلقائي عبر مطابقة CCP (${fileName})`
              ]
            );

            if (targetInst.sale_id) {
              await tx.dbRun(
                'UPDATE sales SET paid_amount = MIN(total, COALESCE(paid_amount, 0) + ?) WHERE id = ?',
                [amt, targetInst.sale_id]
              );
            }

            await tx.dbRun(
              `UPDATE installment_schedules
               SET paid_amount = ?, status = ?, paid_at = ?, payment_id = ?
               WHERE id = ?`,
              [newPaid, newStatus, new Date().toISOString(), payIns.lastID, targetInst.id]
            );

            await tx.dbRun(
              `INSERT INTO ccp_reconciliation_logs (
                batch_file_name, transaction_date, ccp_account, amount,
                transaction_ref, match_status, schedule_id, customer_id, details
              ) VALUES (?, ?, ?, ?, ?, 'MATCHED', ?, ?, 'تمت المطابقة وتسديد القسط آلياً')`,
              [fileName, dt, acc, amt, ref, targetInst.id, targetInst.customer_id]
            );
            matched++;
          } else {
            await tx.dbRun(
              `INSERT INTO ccp_reconciliation_logs (
                batch_file_name, transaction_date, ccp_account, amount,
                transaction_ref, match_status, details
              ) VALUES (?, ?, ?, ?, ?, 'UNMATCHED', 'لم يتم العثور على قسط مفتوح لهذا الحساب')`,
              [fileName, dt, acc, amt, ref]
            );
            unmatched++;
          }
        }

        return { matched, unmatched, duplicate };
      });
    },

    /**
     * 6. تحويل مخزني ذري بين مستودعين أو شاحنة توزيع (Stock Transfer)
     */
    async createStockTransfer(payload = {}) {
      return await db.withTransaction(async (tx) => {
        const fromWh = Number(payload.from_warehouse_id || 1);
        const toWh = Number(payload.to_warehouse_id);
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!toWh || fromWh === toWh) throw new Error('يرجى اختيار مخزن وجهة مختلف عن المخزن المصدر');
        if (items.length === 0) throw new Error('قائمة المواد المحولة فارغة');

        const trfNo = `TRF-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const trfDate = payload.transfer_date || new Date().toISOString().slice(0, 10);

        const ins = await tx.dbRun(
          `INSERT INTO stock_transfers (transfer_number, from_warehouse_id, to_warehouse_id, driver_id, status, notes, transfer_date, user_id)
           VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`,
          [trfNo, fromWh, toWh, payload.driver_id || null, payload.notes || '', trfDate, payload.user_id || null]
        );
        const transferId = ins.lastID;

        for (const it of items) {
          const pid = Number(it.product_id);
          const qty = Number(it.quantity || 0);
          if (!pid || qty <= 0) continue;

          const srcBatches = await tx.dbAll(
            `SELECT * FROM inventory_batches
             WHERE product_id = ? AND COALESCE(warehouse_id, 1) = ? AND stock > 0 AND deleted_at IS NULL
             ORDER BY id ASC`,
            [pid, fromWh]
          );

          let rem = qty;
          let refBatch = srcBatches[0] || null;
          if (!refBatch) {
            refBatch = await tx.dbGet(
              'SELECT * FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
              [pid]
            );
          }

          for (const b of srcBatches) {
            if (rem <= 0) break;
            const take = Math.min(Number(b.stock || 0), rem);
            await tx.dbRun('UPDATE inventory_batches SET stock = stock - ? WHERE id = ?', [take, b.id]);
            rem = Number((rem - take).toFixed(4));
          }

          // إضافة الكمية في المخزن الوجهة
          const destBatch = await tx.dbGet(
            `SELECT id FROM inventory_batches
             WHERE product_id = ? AND COALESCE(warehouse_id, 1) = ? AND deleted_at IS NULL
             ORDER BY id DESC LIMIT 1`,
            [pid, toWh]
          );

          const costPrice = Number((refBatch && refBatch.cost_price) || it.cost_price || 0);
          const sellPrice = Number((refBatch && refBatch.selling_price) || it.selling_price || 0);
          const wholesalePrice = refBatch ? refBatch.wholesale_price : null;

          if (destBatch) {
            await tx.dbRun('UPDATE inventory_batches SET stock = COALESCE(stock, 0) + ? WHERE id = ?', [qty, destBatch.id]);
          } else {
            await tx.dbRun(
              `INSERT INTO inventory_batches (product_id, warehouse_id, stock, cost_price, selling_price, wholesale_price, location, shelf_etage, shelf_place)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [pid, toWh, qty, costPrice, sellPrice, wholesalePrice, it.location || '', it.shelf_etage || '', it.shelf_place || '']
            );
          }

          await tx.dbRun(
            `INSERT INTO stock_transfer_items (transfer_id, product_id, batch_id, quantity, cost_price)
             VALUES (?, ?, ?, ?, ?)`,
            [transferId, pid, refBatch ? refBatch.id : null, qty, costPrice]
          );
        }

        return { id: transferId, transfer_number: trfNo };
      });
    },

    /**
     * 7. تسجيل حدث في السجل الجنائي (Forensic Audit Log)
     */
    async logForensicAudit({ userId, userName, actionCode, entityTable, entityId, beforeObj, afterObj, details }) {
      return await db.dbRun(
        `INSERT INTO system_audit_logs (
          user_id, user_name, action_code, entity_table, entity_id, before_json, after_json, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId || null,
          userName || 'System',
          actionCode,
          entityTable || '',
          entityId ? String(entityId) : '',
          beforeObj ? JSON.stringify(beforeObj) : null,
          afterObj ? JSON.stringify(afterObj) : null,
          details || ''
        ]
      );
    }
  };

  db.enterprise = api;
  return api;
}

module.exports = {
  NEW_ENTERPRISE_SYNC_TABLES,
  initEnterpriseFoundation
};
