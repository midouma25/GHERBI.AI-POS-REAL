/**
 * gherbi-enterprise-ipc-and-lan.js
 * المحرك الخلفي الموحد (IPC Handlers + Express REST Routes) للوحدات المؤسسية الـ 6 في Gherbi.Ai POS:
 * 1. عقود البيع بالتقسيط ومطابقة كشف CCP البريدي الآلية.
 * 2. الكشف الضريبي السنوي (État 104) وتوزيع التكلفة الاستيرادية (Landed Cost & WAC).
 * 3. المستودعات المتعددة، مواقع الرفوف، والتحويلات المخزنية الذرية.
 * 4. السائقون (Van Sales)، شحنات التوصيل، وتسوية التحصيل عند الاستلام (COD).
 * 5. كوبونات الخصم الترويجية والسجل الرقابي الجنائي (Forensic Audit Log).
 * 6. الموظفون ومسيّر الرواتب (HR Payroll) وتذاكر ورشة الصيانة (Atelier / SAV).
 */

'use strict';

const analyticsQueries = require('./analytics-queries');

function createEnterpriseOperations(db) {
  const ent = db.enterprise || {};

  // --- 1. التقسيط ومطابقة CCP ---
  async function getInstallmentContracts(filters = {}) {
    if (ent.getInstallmentContracts) return await ent.getInstallmentContracts(filters);
    return { contracts: [], schedules: [] };
  }

  async function createInstallmentContract(payload = {}) {
    if (ent.createInstallmentContract) return await ent.createInstallmentContract(payload);
    throw new Error('Enterprise foundation not initialized');
  }

  async function payInstallmentSchedule(payload = {}) {
    if (ent.payInstallmentSchedule) return await ent.payInstallmentSchedule(payload);
    throw new Error('Enterprise foundation not initialized');
  }

  async function reconcileCcpStatement(payload = {}) {
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const fileName = payload.fileName || payload.batch_file_name || 'ccp_statement.csv';
    if (ent.reconcileCcpEntries) return await ent.reconcileCcpEntries(entries, fileName);
    return { matched: 0, unmatched: 0, duplicate: 0 };
  }

  async function getCcpReconciliationLogs(filters = {}) {
    const limit = Math.max(10, Number(filters.limit || 200));
    return await db.dbAll(
      `SELECT l.*, c.name AS customer_name
       FROM ccp_reconciliation_logs l
       LEFT JOIN customers c ON c.id = l.customer_id
       WHERE l.deleted_at IS NULL
       ORDER BY l.id DESC LIMIT ?`,
      [limit]
    );
  }

  // --- 2. الكشف الضريبي السنوي État 104 + تحديث Landed Cost & WAC ---
  async function getEtat104(params = {}) {
    const year = typeof params === 'object' ? params.year : params;
    return await analyticsQueries.getEtat104Report(db, { year });
  }

  async function applyLandedCostAndWacToPurchase(invoiceId, data = {}) {
    const invId = Number(invoiceId);
    if (!invId) return;
    const freight = Number(data.freight_cost || 0);
    const customs = Number(data.customs_cost || 0);
    const handling = Number(data.handling_cost || 0);
    const totalLandedExtra = Number((freight + customs + handling).toFixed(2));

    await db.dbRun(
      `UPDATE purchase_invoices
       SET freight_cost = ?, customs_cost = ?, handling_cost = ?,
           additional_costs = COALESCE(additional_costs, 0) + ?
       WHERE id = ?`,
      [freight, customs, handling, totalLandedExtra > 0 && !data.additional_costs ? totalLandedExtra : 0, invId]
    );

    const pItems = await db.dbAll(
      'SELECT * FROM purchase_items WHERE invoice_id = ? AND deleted_at IS NULL',
      [invId]
    );

    const totalQty = pItems.reduce((s, it) => s + Math.max(0, Number(it.quantity || 0)), 0);
    const landedPerUnit = totalQty > 0 && totalLandedExtra > 0 && !data.additional_costs
      ? totalLandedExtra / totalQty
      : 0;

    for (const it of pItems) {
      if (!it.product_id) continue;
      if (landedPerUnit > 0 && it.batch_id) {
        await db.dbRun(
          'UPDATE inventory_batches SET cost_price = ROUND(cost_price + ?, 2) WHERE id = ?',
          [landedPerUnit, it.batch_id]
        );
      }

      // حساب وتحديث التكلفة المتوسطة المرجحة (WAC) لجميع دفعات المنتج النشطة
      const wacRow = await db.dbGet(
        `SELECT
           SUM(CASE WHEN stock > 0 THEN stock * cost_price ELSE 0 END) AS total_val,
           SUM(CASE WHEN stock > 0 THEN stock ELSE 0 END) AS total_stk
         FROM inventory_batches
         WHERE product_id = ? AND deleted_at IS NULL`,
        [it.product_id]
      );
      const wac = wacRow && Number(wacRow.total_stk) > 0
        ? Number((Number(wacRow.total_val) / Number(wacRow.total_stk)).toFixed(2))
        : Number(it.cost_price || 0);

      await db.dbRun(
        'UPDATE inventory_batches SET wac_cost = ? WHERE product_id = ? AND deleted_at IS NULL',
        [wac, it.product_id]
      );
    }
  }

  // --- 3. المستودعات، الرفوف، والتحويلات المخزنية ---
  async function getWarehouses() {
    const list = await db.dbAll(
      `SELECT w.*, d.name AS driver_name,
              (SELECT COALESCE(SUM(ib.stock), 0) FROM inventory_batches ib WHERE COALESCE(ib.warehouse_id, 1) = w.id AND ib.deleted_at IS NULL) AS total_stock_units,
              (SELECT COALESCE(SUM(CASE WHEN ib.stock > 0 THEN ib.stock * ib.cost_price ELSE 0 END), 0) FROM inventory_batches ib WHERE COALESCE(ib.warehouse_id, 1) = w.id AND ib.deleted_at IS NULL) AS total_stock_value
       FROM warehouses w
       LEFT JOIN drivers d ON d.id = w.driver_id
       WHERE w.deleted_at IS NULL
       ORDER BY w.is_default DESC, w.id ASC`
    );
    return list;
  }

  async function saveWarehouse(payload = {}) {
    const id = payload.id ? Number(payload.id) : null;
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('يرجى إدخال اسم المستودع / الشاحنة');

    if (id) {
      await db.dbRun(
        'UPDATE warehouses SET name = ?, location = ?, type = ?, driver_id = ? WHERE id = ?',
        [name, payload.location || '', payload.type || 'main', payload.driver_id || null, id]
      );
      return { id, success: true };
    }
    const ins = await db.dbRun(
      'INSERT INTO warehouses (name, location, type, driver_id, is_default) VALUES (?, ?, ?, ?, 0)',
      [name, payload.location || '', payload.type || 'branch', payload.driver_id || null]
    );
    return { id: ins.lastID, success: true };
  }

  async function deleteWarehouse(id) {
    const wid = Number(id);
    if (wid === 1) throw new Error('لا يمكن حذف المخزن الرئيسي الافتراضي');
    await db.dbRun('DELETE FROM warehouses WHERE id = ?', [wid]);
    return { success: true };
  }

  async function getStockTransfers() {
    const transfers = await db.dbAll(
      `SELECT st.*, w1.name AS from_warehouse_name, w2.name AS to_warehouse_name, d.name AS driver_name,
              (SELECT COUNT(*) FROM stock_transfer_items sti WHERE sti.transfer_id = st.id AND sti.deleted_at IS NULL) AS items_count,
              (SELECT COALESCE(SUM(sti.quantity), 0) FROM stock_transfer_items sti WHERE sti.transfer_id = st.id AND sti.deleted_at IS NULL) AS total_qty
       FROM stock_transfers st
       LEFT JOIN warehouses w1 ON w1.id = st.from_warehouse_id
       LEFT JOIN warehouses w2 ON w2.id = st.to_warehouse_id
       LEFT JOIN drivers d ON d.id = st.driver_id
       WHERE st.deleted_at IS NULL
       ORDER BY st.id DESC LIMIT 200`
    );
    return transfers;
  }

  async function createStockTransfer(payload = {}) {
    if (ent.createStockTransfer) return await ent.createStockTransfer(payload);
    throw new Error('Transfer engine not ready');
  }

  async function updateBatchShelfLocation(payload = {}) {
    const productId = Number(payload.product_id || payload.productId);
    const batchId = payload.batch_id ? Number(payload.batch_id) : null;
    const whId = Number(payload.warehouse_id || 1);
    const etage = String(payload.shelf_etage || '').trim();
    const place = String(payload.shelf_place || '').trim();
    const loc = [etage ? 'طابق: ' + etage : '', place ? 'رف: ' + place : ''].filter(Boolean).join(' | ');

    if (batchId) {
      await db.dbRun(
        'UPDATE inventory_batches SET warehouse_id = ?, shelf_etage = ?, shelf_place = ?, location = COALESCE(NULLIF(?, ""), location) WHERE id = ?',
        [whId, etage, place, loc, batchId]
      );
    } else if (productId) {
      await db.dbRun(
        'UPDATE inventory_batches SET warehouse_id = ?, shelf_etage = ?, shelf_place = ?, location = COALESCE(NULLIF(?, ""), location) WHERE product_id = ? AND deleted_at IS NULL',
        [whId, etage, place, loc, productId]
      );
    }
    return { success: true };
  }

  // --- 4. السائقون (Van Sales) وشحنات التوصيل وتحصيل COD ---
  async function getDrivers() {
    return await db.dbAll(
      `SELECT d.*, w.name AS warehouse_name
       FROM drivers d
       LEFT JOIN warehouses w ON w.id = d.warehouse_id
       WHERE d.deleted_at IS NULL
       ORDER BY d.id DESC`
    );
  }

  async function saveDriver(payload = {}) {
    const id = payload.id ? Number(payload.id) : null;
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('يرجى إدخال اسم السائق / الموزع');

    if (id) {
      await db.dbRun(
        `UPDATE drivers
         SET name = ?, phone = ?, vehicle_name = ?, vehicle_plate = ?,
             warehouse_id = ?, commission_rate = ?, is_active = ?
         WHERE id = ?`,
        [
          name,
          payload.phone || '',
          payload.vehicle_name || '',
          payload.vehicle_plate || '',
          payload.warehouse_id || null,
          Number(payload.commission_rate || 0),
          payload.is_active !== false ? 1 : 0,
          id
        ]
      );
      return { id, success: true };
    }
    const ins = await db.dbRun(
      `INSERT INTO drivers (name, phone, vehicle_name, vehicle_plate, warehouse_id, commission_rate, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        name,
        payload.phone || '',
        payload.vehicle_name || '',
        payload.vehicle_plate || '',
        payload.warehouse_id || null,
        Number(payload.commission_rate || 0)
      ]
    );
    return { id: ins.lastID, success: true };
  }

  async function deleteDriver(id) {
    await db.dbRun('DELETE FROM drivers WHERE id = ?', [Number(id)]);
    return { success: true };
  }

  async function getDeliveryShipments(filters = {}) {
    const conds = ['ds.deleted_at IS NULL'];
    const params = [];
    if (filters.status && filters.status !== 'all') {
      conds.push('ds.status = ?');
      params.push(String(filters.status));
    }
    if (filters.driver_id) {
      conds.push('ds.driver_id = ?');
      params.push(Number(filters.driver_id));
    }
    return await db.dbAll(
      `SELECT ds.*, d.name AS driver_name, d.phone AS driver_phone, d.vehicle_plate
       FROM delivery_shipments ds
       LEFT JOIN drivers d ON d.id = ds.driver_id
       WHERE ${conds.join(' AND ')}
       ORDER BY ds.id DESC LIMIT 300`,
      params
    );
  }

  async function saveDeliveryShipment(payload = {}) {
    const id = payload.id ? Number(payload.id) : null;
    const docNo = payload.doc_number || (await db.nextNumber('delivery'));

    if (id) {
      await db.dbRun(
        `UPDATE delivery_shipments
         SET customer_name = ?, customer_phone = ?, customer_address = ?, wilaya = ?, commune = ?,
             driver_id = ?, carrier_name = ?, tracking_code = ?, shipping_fee = ?, cod_amount = ?,
             status = ?, delivery_date = ?, notes = ?
         WHERE id = ?`,
        [
          payload.customer_name || 'زبون',
          payload.customer_phone || '',
          payload.customer_address || '',
          payload.wilaya || '',
          payload.commune || '',
          payload.driver_id || null,
          payload.carrier_name || '',
          payload.tracking_code || '',
          Number(payload.shipping_fee || 0),
          Number(payload.cod_amount || 0),
          payload.status || 'preparing',
          payload.delivery_date || new Date().toISOString().slice(0, 10),
          payload.notes || '',
          id
        ]
      );
      return { id, doc_number: docNo, success: true };
    }

    const ins = await db.dbRun(
      `INSERT INTO delivery_shipments (
        doc_number, sale_id, order_id, customer_id, customer_name, customer_phone, customer_address,
        wilaya, commune, driver_id, carrier_name, tracking_code, shipping_fee, cod_amount,
        collected_amount, status, delivery_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        docNo,
        payload.sale_id || null,
        payload.order_id || null,
        payload.customer_id || null,
        payload.customer_name || 'زبون',
        payload.customer_phone || '',
        payload.customer_address || '',
        payload.wilaya || '',
        payload.commune || '',
        payload.driver_id || null,
        payload.carrier_name || '',
        payload.tracking_code || '',
        Number(payload.shipping_fee || 0),
        Number(payload.cod_amount || 0),
        payload.status || 'preparing',
        payload.delivery_date || new Date().toISOString().slice(0, 10),
        payload.notes || ''
      ]
    );
    return { id: ins.lastID, doc_number: docNo, success: true };
  }

  async function settleShipmentCod(payload = {}) {
    return await db.withTransaction(async (tx) => {
      const shipmentId = Number(payload.shipment_id || payload.id);
      const status = payload.status || 'delivered';
      const sh = await tx.dbGet('SELECT * FROM delivery_shipments WHERE id = ? AND deleted_at IS NULL', [shipmentId]);
      if (!sh) throw new Error('شحنة التوصيل غير موجودة');

      const collected = payload.collected_amount !== undefined ? Number(payload.collected_amount) : Number(sh.cod_amount || 0);
      await tx.dbRun(
        'UPDATE delivery_shipments SET status = ?, collected_amount = ?, delivery_date = ? WHERE id = ?',
        [status, status === 'delivered' ? collected : 0, new Date().toISOString().slice(0, 10), shipmentId]
      );

      if (status === 'delivered' && collected > 0) {
        if (sh.sale_id) {
          await tx.dbRun(
            'UPDATE sales SET paid_amount = MIN(total, COALESCE(paid_amount, 0) + ?) WHERE id = ?',
            [collected, sh.sale_id]
          );
        }
        if (sh.order_id) {
          await tx.dbRun("UPDATE customer_orders SET status = 'delivered' WHERE id = ?", [sh.order_id]);
        }

        const openSess = await tx.dbGet(
          "SELECT id FROM caisse_sessions WHERE status = 'open' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1"
        );
        if (openSess && openSess.id) {
          await tx.dbRun(
            `INSERT INTO caisse_transactions (session_id, type, amount, category, description, reference_id)
             VALUES (?, 'cash_in', ?, 'تحصيل توصيل COD', ?, ?)`,
            [openSess.id, collected, `تحصيل شحنة توصيل (${sh.doc_number || '#' + sh.id}) — ${sh.customer_name}`, sh.id]
          );
        }
      }

      return { success: true, status, collected_amount: collected };
    });
  }

  // --- 5. كوبونات الخصم والسجل الرقابي الجنائي ---
  async function getDiscountCoupons() {
    return await db.dbAll('SELECT * FROM discount_coupons WHERE deleted_at IS NULL ORDER BY id DESC');
  }

  async function saveDiscountCoupon(payload = {}) {
    const id = payload.id ? Number(payload.id) : null;
    const code = String(payload.code || '').trim().toUpperCase();
    if (!code) throw new Error('يرجى إدخال كود الكوبون');

    if (id) {
      await db.dbRun(
        `UPDATE discount_coupons
         SET code = ?, discount_type = ?, discount_value = ?, min_invoice_total = ?, max_uses = ?, expiry_date = ?, is_active = ?
         WHERE id = ?`,
        [
          code,
          payload.discount_type || 'percent',
          Number(payload.discount_value || 0),
          Number(payload.min_invoice_total || 0),
          Number(payload.max_uses || 100),
          payload.expiry_date || null,
          payload.is_active !== false ? 1 : 0,
          id
        ]
      );
      return { id, code, success: true };
    }

    const ins = await db.dbRun(
      `INSERT INTO discount_coupons (code, discount_type, discount_value, min_invoice_total, max_uses, used_count, expiry_date, is_active)
       VALUES (?, ?, ?, ?, ?, 0, ?, 1)`,
      [
        code,
        payload.discount_type || 'percent',
        Number(payload.discount_value || 0),
        Number(payload.min_invoice_total || 0),
        Number(payload.max_uses || 100),
        payload.expiry_date || null
      ]
    );
    return { id: ins.lastID, code, success: true };
  }

  async function deleteDiscountCoupon(id) {
    await db.dbRun('DELETE FROM discount_coupons WHERE id = ?', [Number(id)]);
    return { success: true };
  }

  async function validateDiscountCoupon(payload = {}) {
    const code = String(payload.code || '').trim().toUpperCase();
    const subtotal = Number(payload.subtotal || payload.invoiceTotal || 0);
    if (!code) throw new Error('أدخل كود الكوبون أولاً');

    const cp = await db.dbGet(
      'SELECT * FROM discount_coupons WHERE UPPER(code) = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
      [code]
    );
    if (!cp) throw new Error('كود الكوبون غير صحيح أو غير مفعل');

    const today = new Date().toISOString().slice(0, 10);
    if (cp.expiry_date && String(cp.expiry_date).slice(0, 10) < today) {
      throw new Error('انتهت صلاحية هذا الكوبون بتاريخ ' + cp.expiry_date);
    }
    if (cp.max_uses && Number(cp.used_count || 0) >= Number(cp.max_uses)) {
      throw new Error('تم استنفاد الحد الأقصى لاستخدامات هذا الكوبون');
    }
    if (cp.min_invoice_total && subtotal < Number(cp.min_invoice_total)) {
      throw new Error(`الحد الأدنى للفاتورة لتطبيق هذا الكوبون هو ${Number(cp.min_invoice_total).toFixed(2)} د.ج`);
    }

    const discountAmount = cp.discount_type === 'percent'
      ? Number(((subtotal * Number(cp.discount_value || 0)) / 100).toFixed(2))
      : Math.min(subtotal, Number(cp.discount_value || 0));

    return {
      valid: true,
      coupon: cp,
      discount_amount: discountAmount
    };
  }

  async function consumeDiscountCoupon(payload = {}) {
    const code = String(payload.code || '').trim().toUpperCase();
    const saleId = payload.sale_id ? Number(payload.sale_id) : null;
    const discAmt = Number(payload.discount_amount || 0);
    if (!code) return { ok: false };
    await db.dbRun(
      'UPDATE discount_coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE UPPER(code) = ? AND deleted_at IS NULL',
      [code]
    );
    if (saleId) {
      await db.dbRun(
        'UPDATE sales SET coupon_code = ?, coupon_discount = ? WHERE id = ?',
        [code, discAmt, saleId]
      );
    }
    return { ok: true, code };
  }

  async function getSystemAuditLogs(filters = {}) {
    const limit = Math.max(20, Number(filters.limit || 250));
    return await db.dbAll(
      `SELECT * FROM system_audit_logs
       WHERE deleted_at IS NULL
       ORDER BY id DESC LIMIT ?`,
      [limit]
    );
  }

  async function logSystemAudit(payload = {}) {
    if (ent.logForensicAudit) return await ent.logForensicAudit(payload);
    return { ok: true };
  }

  // --- 6. الموظفون ومسيّر الرواتب (HR Payroll) وتذاكر الصيانة (Atelier / SAV) ---
  async function getEmployees() {
    return await db.dbAll('SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY id DESC');
  }

  async function saveEmployee(payload = {}) {
    const id = payload.id ? Number(payload.id) : null;
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('يرجى إدخال اسم الموظف');

    if (id) {
      await db.dbRun(
        `UPDATE employees
         SET name = ?, role_title = ?, phone = ?, base_salary = ?, commission_percent = ?, hire_date = ?, is_active = ?
         WHERE id = ?`,
        [
          name,
          payload.role_title || 'بائع',
          payload.phone || '',
          Number(payload.base_salary || 0),
          Number(payload.commission_percent || 0),
          payload.hire_date || null,
          payload.is_active !== false ? 1 : 0,
          id
        ]
      );
      return { id, success: true };
    }
    const ins = await db.dbRun(
      `INSERT INTO employees (name, role_title, phone, base_salary, commission_percent, hire_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        name,
        payload.role_title || 'بائع',
        payload.phone || '',
        Number(payload.base_salary || 0),
        Number(payload.commission_percent || 0),
        payload.hire_date || new Date().toISOString().slice(0, 10)
      ]
    );
    return { id: ins.lastID, success: true };
  }

  async function deleteEmployee(id) {
    await db.dbRun('DELETE FROM employees WHERE id = ?', [Number(id)]);
    return { success: true };
  }

  async function getPayrollPayments() {
    return await db.dbAll(
      `SELECT pp.*, e.name AS employee_name, e.role_title
       FROM payroll_payments pp
       LEFT JOIN employees e ON e.id = pp.employee_id
       WHERE pp.deleted_at IS NULL
       ORDER BY pp.id DESC LIMIT 250`
    );
  }

  async function payEmployeeSalary(payload = {}) {
    return await db.withTransaction(async (tx) => {
      const empId = Number(payload.employee_id);
      const emp = await tx.dbGet('SELECT * FROM employees WHERE id = ?', [empId]);
      if (!emp) throw new Error('الموظف غير موجود');

      const baseAmt = Number(payload.base_amount ?? emp.base_salary ?? 0);
      const bonusAmt = Number(payload.bonus_amount || 0);
      const deductAmt = Number(payload.deduction_amount || 0);
      const netPaid = Math.max(0, Number((baseAmt + bonusAmt - deductAmt).toFixed(2)));
      const payDate = payload.payment_date || new Date().toISOString().slice(0, 10);
      const periodMonth = payload.period_month || payDate.slice(0, 7);

      const openSess = await tx.dbGet(
        "SELECT id FROM caisse_sessions WHERE status = 'open' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1"
      );
      const sessId = openSess ? openSess.id : null;

      // 1) تسجيل الراتب تلقائياً في جدول المصاريف (expenses)
      const expDesc = `صرف راتب الموظف: ${emp.name} — شهر (${periodMonth})`;
      const expIns = await tx.dbRun(
        'INSERT INTO expenses (category, description, amount, date, session_id) VALUES (?, ?, ?, ?, ?)',
        ['رواتب', expDesc, netPaid, payDate, sessId]
      );

      // 2) تسجيل حركة سحب في الصندوق المفتوح (caisse_transactions)
      if (sessId) {
        await tx.dbRun(
          `INSERT INTO caisse_transactions (session_id, type, amount, category, description, reference_id)
           VALUES (?, 'expense', ?, 'رواتب', ?, ?)`,
          [sessId, netPaid, expDesc, expIns.lastID]
        );
      }

      // 3) حفظ مسير الراتب في payroll_payments
      const payIns = await tx.dbRun(
        `INSERT INTO payroll_payments (
          employee_id, period_month, base_amount, bonus_amount, deduction_amount,
          net_paid, payment_date, expense_id, session_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empId, periodMonth, baseAmt, bonusAmt, deductAmt, netPaid, payDate, expIns.lastID, sessId, payload.notes || '']
      );

      return { id: payIns.lastID, expense_id: expIns.lastID, net_paid: netPaid, success: true };
    });
  }

  async function getServiceTickets(filters = {}) {
    const conds = ['st.deleted_at IS NULL'];
    const params = [];
    if (filters.status && filters.status !== 'all') {
      conds.push('st.status = ?');
      params.push(String(filters.status));
    }
    return await db.dbAll(
      `SELECT st.* FROM service_tickets st
       WHERE ${conds.join(' AND ')}
       ORDER BY st.id DESC LIMIT 250`,
      params
    );
  }

  async function saveServiceTicket(payload = {}) {
    const id = payload.id ? Number(payload.id) : null;
    const ticketNo = payload.ticket_number || `SAV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    if (id) {
      await db.dbRun(
        `UPDATE service_tickets
         SET customer_id = ?, customer_name = ?, customer_phone = ?, item_model = ?, serial_or_plate = ?,
             problem_desc = ?, diagnosis_notes = ?, estimated_cost = ?, deposit_paid = ?, final_total = ?,
             status = ?, technician_name = ?, promised_date = ?
         WHERE id = ?`,
        [
          payload.customer_id || null,
          payload.customer_name || 'زبون صيانة',
          payload.customer_phone || '',
          payload.item_model || '',
          payload.serial_or_plate || '',
          payload.problem_desc || '',
          payload.diagnosis_notes || '',
          Number(payload.estimated_cost || 0),
          Number(payload.deposit_paid || 0),
          Number(payload.final_total ?? payload.estimated_cost ?? 0),
          payload.status || 'received',
          payload.technician_name || '',
          payload.promised_date || null,
          id
        ]
      );
      return { id, ticket_number: ticketNo, success: true };
    }

    const ins = await db.dbRun(
      `INSERT INTO service_tickets (
        ticket_number, customer_id, customer_name, customer_phone, item_model, serial_or_plate,
        problem_desc, diagnosis_notes, estimated_cost, deposit_paid, final_total,
        status, technician_name, promised_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketNo,
        payload.customer_id || null,
        payload.customer_name || 'زبون صيانة',
        payload.customer_phone || '',
        payload.item_model || 'جهاز صيانة',
        payload.serial_or_plate || '',
        payload.problem_desc || '',
        payload.diagnosis_notes || '',
        Number(payload.estimated_cost || 0),
        Number(payload.deposit_paid || 0),
        Number(payload.final_total ?? payload.estimated_cost ?? 0),
        payload.status || 'received',
        payload.technician_name || '',
        payload.promised_date || null
      ]
    );
    return { id: ins.lastID, ticket_number: ticketNo, success: true };
  }

  async function convertServiceTicketToSale(payload = {}) {
    return await db.withTransaction(async (tx) => {
      const ticketId = Number(payload.ticket_id || payload.id);
      const tk = await tx.dbGet('SELECT * FROM service_tickets WHERE id = ? AND deleted_at IS NULL', [ticketId]);
      if (!tk) throw new Error('تذكرة الصيانة غير موجودة');

      const totalAmt = Number(payload.final_total ?? tk.final_total ?? tk.estimated_cost ?? 0);
      const paidAmt = Number(payload.paid_amount ?? totalAmt);
      const docNo = await db.nextNumber('invoice');
      const nowIso = new Date().toISOString();

      const openSess = await tx.dbGet(
        "SELECT id FROM caisse_sessions WHERE status = 'open' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1"
      );

      const saleIns = await tx.dbRun(
        `INSERT INTO sales (doc_number, customer_id, subtotal, total, paid_amount, sale_date, session_id, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'cash')`,
        [docNo, tk.customer_id || null, totalAmt, totalAmt, paidAmt, nowIso, openSess ? openSess.id : null]
      );
      const saleId = saleIns.lastID;

      await tx.dbRun(
        `INSERT INTO sale_items (sale_id, quantity, price, subtotal, custom_product_name, serial_number)
         VALUES (?, 1, ?, ?, ?, ?)`,
        [saleId, totalAmt, totalAmt, `خدمة صيانة وإصلاح (${tk.ticket_number}): ${tk.item_model}`, tk.serial_or_plate || '']
      );

      if (paidAmt > 0) {
        await tx.dbRun(
          'INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method) VALUES (?, ?, ?, ?, "cash")',
          [saleId, tk.customer_id || null, paidAmt, nowIso.slice(0, 10)]
        );
      }

      await tx.dbRun(
        "UPDATE service_tickets SET status = 'delivered', final_total = ?, sale_id = ? WHERE id = ?",
        [totalAmt, saleId, ticketId]
      );

      return { success: true, sale_id: saleId, doc_number: docNo };
    });
  }

  return {
    getInstallmentContracts,
    createInstallmentContract,
    payInstallmentSchedule,
    reconcileCcpStatement,
    getCcpReconciliationLogs,
    getEtat104,
    applyLandedCostAndWacToPurchase,
    getWarehouses,
    saveWarehouse,
    deleteWarehouse,
    getStockTransfers,
    createStockTransfer,
    updateBatchShelfLocation,
    getDrivers,
    saveDriver,
    deleteDriver,
    getDeliveryShipments,
    saveDeliveryShipment,
    settleShipmentCod,
    getDiscountCoupons,
    saveDiscountCoupon,
    deleteDiscountCoupon,
    validateDiscountCoupon,
    consumeDiscountCoupon,
    getSystemAuditLogs,
    logSystemAudit,
    getEmployees,
    saveEmployee,
    deleteEmployee,
    getPayrollPayments,
    payEmployeeSalary,
    getServiceTickets,
    saveServiceTicket,
    convertServiceTicketToSale
  };
}

function registerEnterpriseIpcHandlers(ipcMain, db, isLanClientMode, lanClient) {
  const ops = createEnterpriseOperations(db);

  const channels = [
    ['get-installment-contracts', (f) => ops.getInstallmentContracts(f), (f) => lanClient.getInstallmentContracts(f)],
    ['create-installment-contract', (p) => ops.createInstallmentContract(p), (p) => lanClient.createInstallmentContract(p)],
    ['pay-installment-schedule', (p) => ops.payInstallmentSchedule(p), (p) => lanClient.payInstallmentSchedule(p)],
    ['reconcile-ccp-statement', (p) => ops.reconcileCcpStatement(p), (p) => lanClient.reconcileCcpStatement(p)],
    ['get-ccp-reconciliation-logs', (f) => ops.getCcpReconciliationLogs(f), (f) => lanClient.getCcpReconciliationLogs(f)],
    ['get-etat-104', (y) => ops.getEtat104(y), (y) => lanClient.getEtat104(y)],
    ['apply-landed-cost-purchase', (p) => ops.applyLandedCostAndWacToPurchase(p.invoiceId, p), () => ({ ok: true })],
    ['get-warehouses', () => ops.getWarehouses(), () => lanClient.getWarehouses()],
    ['save-warehouse', (p) => ops.saveWarehouse(p), (p) => lanClient.saveWarehouse(p)],
    ['delete-warehouse', (id) => ops.deleteWarehouse(id), (id) => lanClient.deleteWarehouse(id)],
    ['get-stock-transfers', () => ops.getStockTransfers(), () => lanClient.getStockTransfers()],
    ['create-stock-transfer', (p) => ops.createStockTransfer(p), (p) => lanClient.createStockTransfer(p)],
    ['update-batch-shelf', (p) => ops.updateBatchShelfLocation(p), (p) => lanClient.updateBatchShelfLocation(p)],
    ['get-drivers', () => ops.getDrivers(), () => lanClient.getDrivers()],
    ['save-driver', (p) => ops.saveDriver(p), (p) => lanClient.saveDriver(p)],
    ['delete-driver', (id) => ops.deleteDriver(id), (id) => lanClient.deleteDriver(id)],
    ['get-delivery-shipments', (f) => ops.getDeliveryShipments(f), (f) => lanClient.getDeliveryShipments(f)],
    ['save-delivery-shipment', (p) => ops.saveDeliveryShipment(p), (p) => lanClient.saveDeliveryShipment(p)],
    ['settle-shipment-cod', (p) => ops.settleShipmentCod(p), (p) => lanClient.settleShipmentCod(p)],
    ['get-discount-coupons', () => ops.getDiscountCoupons(), () => lanClient.getDiscountCoupons()],
    ['save-discount-coupon', (p) => ops.saveDiscountCoupon(p), (p) => lanClient.saveDiscountCoupon(p)],
    ['delete-discount-coupon', (id) => ops.deleteDiscountCoupon(id), (id) => lanClient.deleteDiscountCoupon(id)],
    ['validate-discount-coupon', (p) => ops.validateDiscountCoupon(p), (p) => lanClient.validateDiscountCoupon(p)],
    ['consume-discount-coupon', (p) => ops.consumeDiscountCoupon(p), () => ({ ok: true })],
    ['get-system-audit-logs', (f) => ops.getSystemAuditLogs(f), (f) => lanClient.getSystemAuditLogs(f)],
    ['log-system-audit', (p) => ops.logSystemAudit(p), (p) => lanClient.logSystemAudit(p)],
    ['get-employees', () => ops.getEmployees(), () => lanClient.getEmployees()],
    ['save-employee', (p) => ops.saveEmployee(p), (p) => lanClient.saveEmployee(p)],
    ['delete-employee', (id) => ops.deleteEmployee(id), (id) => lanClient.deleteEmployee(id)],
    ['get-payroll-payments', () => ops.getPayrollPayments(), () => lanClient.getPayrollPayments()],
    ['pay-employee-salary', (p) => ops.payEmployeeSalary(p), (p) => lanClient.payEmployeeSalary(p)],
    ['get-service-tickets', (f) => ops.getServiceTickets(f), (f) => lanClient.getServiceTickets(f)],
    ['save-service-ticket', (p) => ops.saveServiceTicket(p), (p) => lanClient.saveServiceTicket(p)],
    ['convert-service-ticket-to-sale', (p) => ops.convertServiceTicketToSale(p), (p) => lanClient.convertServiceTicketToSale(p)]
  ];

  for (const [ch, localFn, lanFn] of channels) {
    ipcMain.removeHandler(ch);
    ipcMain.handle(ch, async (_e, arg1) => {
      if (typeof isLanClientMode === 'function' && (await isLanClientMode())) {
        return await lanFn(arg1);
      }
      return await localFn(arg1);
    });
  }

  return ops;
}

function registerEnterpriseExpressRoutes(app, db) {
  if (!app || app._enterpriseRoutesRegistered) return;
  app._enterpriseRoutesRegistered = true;
  const ops = createEnterpriseOperations(db);

  const wrap = (fn) => async (req, res) => {
    try {
      const result = await fn(req);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  app.get('/api/enterprise/installment-contracts', wrap((req) => ops.getInstallmentContracts(req.query)));
  app.post('/api/enterprise/installment-contracts', wrap((req) => ops.createInstallmentContract(req.body)));
  app.post('/api/enterprise/installment-schedules/pay', wrap((req) => ops.payInstallmentSchedule(req.body)));
  app.post('/api/enterprise/ccp-reconcile', wrap((req) => ops.reconcileCcpStatement(req.body)));
  app.get('/api/enterprise/ccp-reconciliation-logs', wrap((req) => ops.getCcpReconciliationLogs(req.query)));
  app.get('/api/enterprise/etat-104', wrap((req) => ops.getEtat104(req.query)));
  app.get('/api/enterprise/warehouses', wrap(() => ops.getWarehouses()));
  app.post('/api/enterprise/warehouses', wrap((req) => ops.saveWarehouse(req.body)));
  app.delete('/api/enterprise/warehouses/:id', wrap((req) => ops.deleteWarehouse(req.params.id)));
  app.get('/api/enterprise/stock-transfers', wrap(() => ops.getStockTransfers()));
  app.post('/api/enterprise/stock-transfers', wrap((req) => ops.createStockTransfer(req.body)));
  app.put('/api/enterprise/batches-shelf', wrap((req) => ops.updateBatchShelfLocation(req.body)));
  app.get('/api/enterprise/drivers', wrap(() => ops.getDrivers()));
  app.post('/api/enterprise/drivers', wrap((req) => ops.saveDriver(req.body)));
  app.delete('/api/enterprise/drivers/:id', wrap((req) => ops.deleteDriver(req.params.id)));
  app.get('/api/enterprise/delivery-shipments', wrap((req) => ops.getDeliveryShipments(req.query)));
  app.post('/api/enterprise/delivery-shipments', wrap((req) => ops.saveDeliveryShipment(req.body)));
  app.post('/api/enterprise/delivery-shipments/settle-cod', wrap((req) => ops.settleShipmentCod(req.body)));
  app.get('/api/enterprise/coupons', wrap(() => ops.getDiscountCoupons()));
  app.post('/api/enterprise/coupons', wrap((req) => ops.saveDiscountCoupon(req.body)));
  app.delete('/api/enterprise/coupons/:id', wrap((req) => ops.deleteDiscountCoupon(req.params.id)));
  app.post('/api/enterprise/coupons/validate', wrap((req) => ops.validateDiscountCoupon(req.body)));
  app.get('/api/enterprise/system-audit-logs', wrap((req) => ops.getSystemAuditLogs(req.query)));
  app.post('/api/enterprise/system-audit-logs', wrap((req) => ops.logSystemAudit(req.body)));
  app.get('/api/enterprise/employees', wrap(() => ops.getEmployees()));
  app.post('/api/enterprise/employees', wrap((req) => ops.saveEmployee(req.body)));
  app.delete('/api/enterprise/employees/:id', wrap((req) => ops.deleteEmployee(req.params.id)));
  app.get('/api/enterprise/payroll', wrap(() => ops.getPayrollPayments()));
  app.post('/api/enterprise/payroll', wrap((req) => ops.payEmployeeSalary(req.body)));
  app.get('/api/enterprise/service-tickets', wrap((req) => ops.getServiceTickets(req.query)));
  app.post('/api/enterprise/service-tickets', wrap((req) => ops.saveServiceTicket(req.body)));
  app.post('/api/enterprise/service-tickets/convert', wrap((req) => ops.convertServiceTicketToSale(req.body)));
}

module.exports = {
  createEnterpriseOperations,
  registerEnterpriseIpcHandlers,
  registerEnterpriseExpressRoutes
};
