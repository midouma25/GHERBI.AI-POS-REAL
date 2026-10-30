/**
 * manufacturing/production-guard.js
 * المحرك الشامل للتصنيع والإنتاج (BOM Recipes, Capacity Calculation, FIFO Component Deduction, Order Lifecycle)
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
  const nextNumber = async (docType = 'production') => {
    if (ctx && typeof ctx.nextNumber === 'function') return ctx.nextNumber(docType);
    if (db && typeof db.nextNumber === 'function') return db.nextNumber(docType);
    return `PRD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  };
  const allowExpired = async () => {
    if (ctx && typeof ctx.allowExpired === 'function') return ctx.allowExpired();
    if (db && typeof db.allowExpired === 'function') return db.allowExpired();
    const r = await dbGet("SELECT value FROM settings WHERE key = 'manufacturing_allow_expired'");
    return r && (String(r.value).toLowerCase() === 'true' || r.value === '1');
  };

  return { db, dbGet, dbAll, dbRun, withTx, nextNumber, allowExpired };
}

/**
 * 1. جلب قائمة وصفات التصنيع (BOM Recipes)
 */
async function listRecipes(ctx, filters = {}) {
  const { dbAll } = resolveHelpers(ctx);
  const conds = ['r.deleted_at IS NULL'];
  const params = [];

  if (filters.productId || filters.product_id) {
    conds.push('r.product_id = ?');
    params.push(Number(filters.productId || filters.product_id));
  }
  if (filters.activeOnly || filters.is_active) {
    conds.push('r.is_active = 1');
  }
  if (filters.search) {
    conds.push('(r.name LIKE ? OR p.name LIKE ? OR p.barcode LIKE ?)');
    const q = `%${String(filters.search).trim()}%`;
    params.push(q, q, q);
  }

  const recipes = await dbAll(
    `
    SELECT
      r.*,
      p.name AS product_name,
      p.barcode AS product_barcode,
      p.unit AS product_unit,
      p.image AS product_image,
      (SELECT COUNT(*) FROM bom_components bc WHERE bc.recipe_id = r.id AND bc.deleted_at IS NULL) AS components_count
    FROM bom_recipes r
    LEFT JOIN products p ON p.id = r.product_id
    WHERE ${conds.join(' AND ')}
    ORDER BY r.is_default DESC, r.id DESC
    `,
    params
  );

  for (const rec of recipes) {
    rec.components = await dbAll(
      `
      SELECT
        bc.*,
        cp.name AS component_name,
        cp.barcode AS component_barcode,
        cp.unit AS component_unit,
        COALESCE((
          SELECT SUM(ib.stock) FROM inventory_batches ib
          WHERE ib.product_id = bc.component_product_id
            AND (bc.component_variant_id IS NULL OR ib.variant_id = bc.component_variant_id)
            AND ib.deleted_at IS NULL
        ), 0) AS available_stock
      FROM bom_components bc
      LEFT JOIN products cp ON cp.id = bc.component_product_id
      WHERE bc.recipe_id = ? AND bc.deleted_at IS NULL
      ORDER BY bc.position ASC, bc.id ASC
      `,
      [rec.id]
    );
  }

  return recipes;
}

/**
 * 2. جلب وصفة واحدة مع كامل مكوناتها
 */
async function loadRecipeWithComponents(ctx, recipeId) {
  const { dbGet, dbAll } = resolveHelpers(ctx);
  const recipe = await dbGet(
    `
    SELECT
      r.*,
      p.name AS product_name,
      p.barcode AS product_barcode,
      p.unit AS product_unit,
      p.image AS product_image
    FROM bom_recipes r
    LEFT JOIN products p ON p.id = r.product_id
    WHERE r.id = ? AND r.deleted_at IS NULL
    `,
    [Number(recipeId)]
  );
  if (!recipe) return null;

  recipe.components = await dbAll(
    `
    SELECT
      bc.*,
      cp.name AS component_name,
      cp.barcode AS component_barcode,
      cp.unit AS component_unit,
      cp.wholesale_unit AS component_wholesale_unit,
      cp.wholesale_qty AS component_wholesale_qty,
      COALESCE((
        SELECT SUM(ib.stock) FROM inventory_batches ib
        WHERE ib.product_id = bc.component_product_id
          AND (bc.component_variant_id IS NULL OR ib.variant_id = bc.component_variant_id)
          AND ib.deleted_at IS NULL
      ), 0) AS available_stock,
      COALESCE((
        SELECT AVG(ib2.cost_price) FROM inventory_batches ib2
        WHERE ib2.product_id = bc.component_product_id
          AND ib2.deleted_at IS NULL AND ib2.stock > 0
      ), 0) AS est_unit_cost
    FROM bom_components bc
    LEFT JOIN products cp ON cp.id = bc.component_product_id
    WHERE bc.recipe_id = ? AND bc.deleted_at IS NULL
    ORDER BY bc.position ASC, bc.id ASC
    `,
    [recipe.id]
  );

  return recipe;
}

/**
 * 3. حفظ أو تحديث وصفة تصنيع (BOM Recipe) مع منع الحلقات الدائرية (Circular Dependency Check)
 */
async function saveRecipe(ctx, payload = {}) {
  const { dbGet, dbRun, withTx } = resolveHelpers(ctx);
  const productId = Number(payload.product_id || payload.productId);
  const variantId = payload.variant_id || payload.variantId ? Number(payload.variant_id || payload.variantId) : null;
  const name = String(payload.name || 'وصفة قياسية').trim();
  const outputQty = Math.max(0.0001, Number(payload.output_qty ?? payload.outputQty ?? 1));
  const extraCost = Math.max(0, Number(payload.extra_cost ?? payload.extraCost ?? 0));
  const extraCostType = payload.extra_cost_type || payload.extraCostType || 'per_batch';
  const isDefault = payload.is_default ?? payload.isDefault ? 1 : 0;
  const isActive = payload.is_active !== undefined ? (payload.is_active ? 1 : 0) : 1;
  const autoOnSale = payload.auto_on_sale ?? payload.autoOnSale ? 1 : 0;
  const autoRound = payload.auto_round || payload.autoRound || 'exact';
  const autoTarget = payload.auto_target || payload.autoTarget || 'shortfall';
  const sellPrice =
    payload.sell_price !== undefined && payload.sell_price !== null && payload.sell_price !== ''
      ? Number(payload.sell_price)
      : null;

  const components = Array.isArray(payload.components) ? payload.components : [];
  if (!productId) throw new Error('يرجى اختيار المنتج النهائي للوصفة');
  if (components.length === 0) throw new Error('يجب أن تحتوي الوصفة على مكون أولي واحد على الأقل');

  for (const comp of components) {
    const compProdId = Number(comp.component_product_id || comp.product_id || comp.productId);
    if (compProdId === productId) {
      throw new Error('لا يمكن أن يكون المنتج النهائي مكوناً داخل وصفته نفسها');
    }
  }

  return await withTx(async (tx) => {
    let recipeId = payload.id ? Number(payload.id) : null;

    if (isDefault) {
      await tx.dbRun(
        'UPDATE bom_recipes SET is_default = 0 WHERE product_id = ? AND COALESCE(variant_id, -1) = COALESCE(?, -1)',
        [productId, variantId]
      );
    }

    if (recipeId) {
      await tx.dbRun(
        `
        UPDATE bom_recipes
        SET product_id = ?, variant_id = ?, name = ?, output_qty = ?,
            extra_cost = ?, extra_cost_type = ?, is_default = ?, is_active = ?,
            auto_on_sale = ?, auto_round = ?, auto_target = ?, sell_price = ?
        WHERE id = ?
        `,
        [
          productId,
          variantId,
          name,
          outputQty,
          extraCost,
          extraCostType,
          isDefault,
          isActive,
          autoOnSale,
          autoRound,
          autoTarget,
          sellPrice,
          recipeId
        ]
      );
      await tx.dbRun('DELETE FROM bom_components WHERE recipe_id = ?', [recipeId]);
    } else {
      const existingDefault = await dbGet(
        'SELECT id FROM bom_recipes WHERE product_id = ? AND is_default = 1 AND deleted_at IS NULL LIMIT 1',
        [productId]
      );
      const effectiveDefault = isDefault || !existingDefault ? 1 : 0;

      const ins = await tx.dbRun(
        `
        INSERT INTO bom_recipes (
          product_id, variant_id, name, output_qty, extra_cost, extra_cost_type,
          is_default, is_active, auto_on_sale, auto_round, auto_target, sell_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          productId,
          variantId,
          name,
          outputQty,
          extraCost,
          extraCostType,
          effectiveDefault,
          isActive,
          autoOnSale,
          autoRound,
          autoTarget,
          sellPrice
        ]
      );
      recipeId = ins.lastID;
    }

    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      const compProdId = Number(c.component_product_id || c.product_id || c.productId);
      const compVarId = c.component_variant_id || c.variant_id ? Number(c.component_variant_id || c.variant_id) : null;
      const qty = Math.max(0.000001, Number(c.quantity ?? 1));
      const waste = Math.max(0, Number(c.waste_percent ?? c.wastePercent ?? 0));
      const unitLabel = c.unit_label || c.unitLabel || null;
      const unitQty = c.unit_qty !== undefined && c.unit_qty !== null ? Number(c.unit_qty) : qty;

      await tx.dbRun(
        `
        INSERT INTO bom_components (
          recipe_id, component_product_id, component_variant_id,
          quantity, unit_label, unit_qty, waste_percent, position
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [recipeId, compProdId, compVarId, qty, unitLabel, unitQty, waste, i]
      );
    }

    return await loadRecipeWithComponents(ctx, recipeId);
  });
}

/**
 * 4. حذف وصفة تصنيع
 */
async function deleteRecipe(ctx, recipeId) {
  const { dbRun } = resolveHelpers(ctx);
  const id = Number(recipeId && typeof recipeId === 'object' ? recipeId.id || recipeId.recipeId : recipeId);
  await dbRun('DELETE FROM bom_components WHERE recipe_id = ?', [id]);
  await dbRun('DELETE FROM bom_recipes WHERE id = ?', [id]);
  return { success: true, id };
}

/**
 * 5. حساب توفر المكونات وأقصى كمية قابلة للتصنيع والتكلفة التقديرية (FIFO Simulation)
 */
async function computeRecipeAvailability(ctx, payload = {}) {
  const { dbAll, allowExpired } = resolveHelpers(ctx);
  const recipeId = Number(payload.recipeId || payload.recipe_id || payload.id);
  const requestedOutputQty = Math.max(
    0.0001,
    Number(payload.plannedQty ?? payload.planned_qty ?? payload.quantity ?? 0) || 0
  );

  const recipe = await loadRecipeWithComponents(ctx, recipeId);
  if (!recipe) throw new Error('وصفة التصنيع غير موجودة');

  const canUseExpired = await allowExpired();
  const todayIso = new Date().toISOString().slice(0, 10);
  const effectivePlannedQty = requestedOutputQty > 0 ? requestedOutputQty : Number(recipe.output_qty || 1);
  const scaleFactor = effectivePlannedQty / Math.max(0.0001, Number(recipe.output_qty || 1));

  let maxBatchesPossible = Infinity;
  let totalComponentsCost = 0;
  const componentBreakdown = [];
  const shortages = [];

  for (const comp of recipe.components || []) {
    const wasteMultiplier = 1 + Math.max(0, Number(comp.waste_percent || 0)) / 100.0;
    const reqPerRecipeBatch = Number(comp.quantity || 0) * wasteMultiplier;
    const requiredTotalQty = Number((reqPerRecipeBatch * scaleFactor).toFixed(6));

    const batchConds = ['product_id = ?', 'deleted_at IS NULL', 'COALESCE(stock, 0) > 0'];
    const batchParams = [Number(comp.component_product_id)];

    if (comp.component_variant_id) {
      batchConds.push('variant_id = ?');
      batchParams.push(Number(comp.component_variant_id));
    }
    if (!canUseExpired) {
      batchConds.push("(expiry_date IS NULL OR TRIM(expiry_date) = '' OR date(expiry_date) >= date(?))");
      batchParams.push(todayIso);
    }

    const batches = await dbAll(
      `
      SELECT id, stock, cost_price, expiry_date
      FROM inventory_batches
      WHERE ${batchConds.join(' AND ')}
      ORDER BY (expiry_date IS NULL), expiry_date ASC, created_at ASC, id ASC
      `,
      batchParams
    );

    const totalAvail = batches.reduce((acc, b) => acc + Number(b.stock || 0), 0);
    const possibleRecipeBatches = reqPerRecipeBatch > 0 ? totalAvail / reqPerRecipeBatch : Infinity;
    if (possibleRecipeBatches < maxBatchesPossible) {
      maxBatchesPossible = possibleRecipeBatches;
    }

    // محاكاة السحب بطريقة FIFO لحساب التكلفة الدقيقة
    let remToCost = requiredTotalQty;
    let compCost = 0;
    let lastKnownCost = batches.length > 0 ? Number(batches[0].cost_price || 0) : Number(comp.est_unit_cost || 0);

    for (const b of batches) {
      if (remToCost <= 0) break;
      const take = Math.min(Number(b.stock || 0), remToCost);
      compCost += take * Number(b.cost_price || 0);
      lastKnownCost = Number(b.cost_price || lastKnownCost);
      remToCost -= take;
    }
    if (remToCost > 0) {
      compCost += remToCost * lastKnownCost;
    }

    totalComponentsCost += compCost;
    const shortage = Math.max(0, Number((requiredTotalQty - totalAvail).toFixed(6)));
    if (shortage > 0.0001) {
      shortages.push({
        component_product_id: comp.component_product_id,
        component_name: comp.component_name,
        required: requiredTotalQty,
        available: totalAvail,
        shortage
      });
    }

    componentBreakdown.push({
      component_product_id: comp.component_product_id,
      component_variant_id: comp.component_variant_id,
      component_name: comp.component_name,
      component_unit: comp.component_unit,
      required_qty: requiredTotalQty,
      available_qty: totalAvail,
      shortage_qty: shortage,
      estimated_cost: Number(compCost.toFixed(2)),
      sufficient: shortage <= 0.0001
    });
  }

  const maxOutputQty = Number.isFinite(maxBatchesPossible)
    ? Number((Math.max(0, maxBatchesPossible) * Number(recipe.output_qty || 1)).toFixed(4))
    : 0;

  const extraCostTotal =
    recipe.extra_cost_type === 'per_unit'
      ? Number(recipe.extra_cost || 0) * effectivePlannedQty
      : Number(recipe.extra_cost || 0) * scaleFactor;

  const totalCost = Number((totalComponentsCost + extraCostTotal).toFixed(2));
  const unitCost = Number((totalCost / Math.max(0.0001, effectivePlannedQty)).toFixed(2));

  return {
    recipe_id: recipe.id,
    product_id: recipe.product_id,
    product_name: recipe.product_name,
    planned_qty: effectivePlannedQty,
    max_manufacturable_qty: maxOutputQty,
    can_produce: shortages.length === 0,
    components_cost: Number(totalComponentsCost.toFixed(2)),
    extra_cost: Number(extraCostTotal.toFixed(2)),
    total_cost: totalCost,
    unit_cost: unitCost,
    components: componentBreakdown,
    shortages
  };
}

/**
 * 6. حساب القدرة الإنتاجية الفورية لمجموعة منتجات (في شاشة الكاشير POS)
 */
async function autoCapacityForProducts(ctx, productIds = []) {
  const { dbAll } = resolveHelpers(ctx);
  const ids = Array.isArray(productIds)
    ? productIds.map(Number).filter(Boolean)
    : productIds && Array.isArray(productIds.productIds)
      ? productIds.productIds.map(Number).filter(Boolean)
      : [];

  let recipesQuery = 'SELECT id, product_id, variant_id, auto_on_sale FROM bom_recipes WHERE is_active = 1 AND deleted_at IS NULL';
  const params = [];
  if (ids.length > 0) {
    recipesQuery += ` AND product_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }

  const recipes = await dbAll(recipesQuery, params);
  const result = {};

  for (const r of recipes) {
    try {
      const avail = await computeRecipeAvailability(ctx, { recipeId: r.id, plannedQty: 1 });
      result[r.product_id] = {
        recipeId: r.id,
        maxManufacturableQty: avail.max_manufacturable_qty,
        unitCost: avail.unit_cost,
        autoOnSale: Boolean(r.auto_on_sale)
      };
    } catch (_) {}
  }

  return result;
}

/**
 * 7. إنشاء مسودة أمر إنتاج (createDraft)
 */
async function createDraft(ctx, payload = {}) {
  const { dbRun, nextNumber } = resolveHelpers(ctx);
  const recipeId = Number(payload.recipe_id || payload.recipeId);
  const recipe = await loadRecipeWithComponents(ctx, recipeId);
  if (!recipe) throw new Error('وصفة التصنيع غير موجودة');

  const plannedQty = Math.max(0.0001, Number(payload.planned_qty ?? payload.plannedQty ?? recipe.output_qty ?? 1));
  const avail = await computeRecipeAvailability(ctx, { recipeId, plannedQty });
  const docNum = payload.number || (await nextNumber('production'));
  const orderDate = payload.order_date || payload.orderDate || new Date().toISOString().slice(0, 10);

  const ins = await dbRun(
    `
    INSERT INTO production_orders (
      number, recipe_id, product_id, variant_id, planned_qty, status,
      components_cost, extra_cost, unit_cost, output_expiry_date,
      output_selling_price, output_wholesale_price, trigger_source,
      sale_id, user_id, note, order_date
    ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      docNum,
      recipe.id,
      recipe.product_id,
      recipe.variant_id || null,
      plannedQty,
      avail.components_cost,
      avail.extra_cost,
      avail.unit_cost,
      payload.output_expiry_date || payload.outputExpiryDate || null,
      payload.output_selling_price ?? payload.outputSellingPrice ?? recipe.sell_price ?? null,
      payload.output_wholesale_price ?? payload.outputWholesalePrice ?? null,
      payload.trigger_source || payload.triggerSource || 'manual',
      payload.sale_id || payload.saleId || null,
      payload.user_id || payload.userId || null,
      payload.note || null,
      orderDate
    ]
  );

  return await getOrder(ctx, ins.lastID);
}

/**
 * 8. تأكيد أمر الإنتاج (خصم المكونات الأولية بـ FIFO وإنشاء دفعة المنتج النهائي)
 */
async function confirmOrder(ctx, payload = {}) {
  const { dbGet, dbAll, withTx, allowExpired } = resolveHelpers(ctx);
  const orderId = Number(payload.orderId || payload.order_id || payload.id);
  const order = await dbGet('SELECT * FROM production_orders WHERE id = ? AND deleted_at IS NULL', [orderId]);
  if (!order) throw new Error('أمر الإنتاج غير موجود');
  if (order.status === 'confirmed') return await getOrder(ctx, orderId);

  const recipe = await loadRecipeWithComponents(ctx, order.recipe_id);
  if (!recipe) throw new Error('الوصفة المرتبطة بأمر الإنتاج غير موجودة');

  const producedQty = Math.max(
    0.0001,
    Number(payload.produced_qty ?? payload.producedQty ?? order.planned_qty ?? recipe.output_qty ?? 1)
  );
  const scaleFactor = producedQty / Math.max(0.0001, Number(recipe.output_qty || 1));
  const canUseExpired = await allowExpired();
  const todayIso = new Date().toISOString().slice(0, 10);

  return await withTx(async (tx) => {
    let actualComponentsCost = 0;

    for (const comp of recipe.components || []) {
      const wasteMultiplier = 1 + Math.max(0, Number(comp.waste_percent || 0)) / 100.0;
      let remainingNeed = Number((Number(comp.quantity || 0) * wasteMultiplier * scaleFactor).toFixed(6));

      const batchConds = ['product_id = ?', 'deleted_at IS NULL', 'COALESCE(stock, 0) > 0'];
      const batchParams = [Number(comp.component_product_id)];
      if (comp.component_variant_id) {
        batchConds.push('variant_id = ?');
        batchParams.push(Number(comp.component_variant_id));
      }
      if (!canUseExpired) {
        batchConds.push("(expiry_date IS NULL OR TRIM(expiry_date) = '' OR date(expiry_date) >= date(?))");
        batchParams.push(todayIso);
      }

      const batches = await dbAll(
        `
        SELECT id, stock, cost_price
        FROM inventory_batches
        WHERE ${batchConds.join(' AND ')}
        ORDER BY (expiry_date IS NULL), expiry_date ASC, created_at ASC, id ASC
        `,
        batchParams
      );

      for (const b of batches) {
        if (remainingNeed <= 0.000001) break;
        const avail = Math.max(0, Number(b.stock || 0));
        if (avail <= 0) continue;

        const take = Math.min(avail, remainingNeed);
        const unitCost = Number(b.cost_price || 0);
        const lineSub = Number((take * unitCost).toFixed(4));

        await tx.dbRun('UPDATE inventory_batches SET stock = stock - ? WHERE id = ?', [take, b.id]);
        await tx.dbRun(
          `
          INSERT INTO production_order_items (
            order_id, component_product_id, component_variant_id,
            batch_id, quantity, unit_cost, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [orderId, comp.component_product_id, comp.component_variant_id || null, b.id, take, unitCost, lineSub]
        );

        actualComponentsCost += lineSub;
        remainingNeed = Number((remainingNeed - take).toFixed(6));
      }

      if (remainingNeed > 0.0001) {
        throw new Error(`رصيد المكون "${comp.component_name}" غير كافٍ لإتمام الإنتاج (العجز: ${remainingNeed})`);
      }
    }

    const extraCostTotal =
      recipe.extra_cost_type === 'per_unit'
        ? Number(recipe.extra_cost || 0) * producedQty
        : Number(recipe.extra_cost || 0) * scaleFactor;

    const totalCost = Number((actualComponentsCost + extraCostTotal).toFixed(2));
    const unitCost = Number((totalCost / producedQty).toFixed(2));

    // تحديد سعر البيع للدفعة الناتجة
    let sellingPrice = order.output_selling_price ?? payload.output_selling_price ?? recipe.sell_price;
    if (sellingPrice === null || sellingPrice === undefined || sellingPrice === '') {
      const lastBatch = await dbGet(
        'SELECT selling_price FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
        [order.product_id]
      );
      sellingPrice = lastBatch && Number(lastBatch.selling_price) > 0 ? Number(lastBatch.selling_price) : unitCost;
    }

    const batchIns = await tx.dbRun(
      `
      INSERT INTO inventory_batches (
        product_id, variant_id, stock, cost_price, selling_price,
        wholesale_price, expiry_date, display_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        order.product_id,
        order.variant_id || null,
        producedQty,
        unitCost,
        Number(sellingPrice || 0),
        order.output_wholesale_price || null,
        order.output_expiry_date || payload.output_expiry_date || null,
        order.number
      ]
    );

    const outputBatchId = batchIns.lastID;
    const nowIso = new Date().toISOString();

    await tx.dbRun(
      `
      UPDATE production_orders
      SET status = 'confirmed',
          produced_qty = ?,
          components_cost = ?,
          extra_cost = ?,
          unit_cost = ?,
          output_batch_id = ?,
          output_selling_price = ?,
          confirmed_at = ?
      WHERE id = ?
      `,
      [
        producedQty,
        Number(actualComponentsCost.toFixed(2)),
        Number(extraCostTotal.toFixed(2)),
        unitCost,
        outputBatchId,
        Number(sellingPrice || 0),
        nowIso,
        orderId
      ]
    );

    return await getOrder(ctx, orderId);
  });
}

/**
 * 9. عكس/إلغاء أمر إنتاج مؤكد (إرجاع المكونات الأولية للدفعات وسحب دفعة المنتج النهائي)
 */
async function reverseOrder(ctx, payload = {}) {
  const { dbGet, dbAll, withTx } = resolveHelpers(ctx);
  const orderId = Number(payload && typeof payload === 'object' ? payload.orderId || payload.order_id || payload.id : payload);
  const order = await dbGet('SELECT * FROM production_orders WHERE id = ? AND deleted_at IS NULL', [orderId]);
  if (!order) throw new Error('أمر الإنتاج غير موجود');
  if (order.status === 'reversed') return await getOrder(ctx, orderId);

  const items = await dbAll(
    'SELECT * FROM production_order_items WHERE order_id = ? AND deleted_at IS NULL',
    [orderId]
  );

  return await withTx(async (tx) => {
    for (const item of items) {
      await tx.dbRun('UPDATE inventory_batches SET stock = COALESCE(stock, 0) + ? WHERE id = ?', [
        Number(item.quantity || 0),
        item.batch_id
      ]);
    }

    if (order.output_batch_id) {
      const deductQty = Number(order.produced_qty || order.planned_qty || 0);
      await tx.dbRun(
        'UPDATE inventory_batches SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id = ?',
        [deductQty, order.output_batch_id]
      );
    }

    await tx.dbRun("UPDATE production_orders SET status = 'reversed' WHERE id = ?", [orderId]);
    return await getOrder(ctx, orderId);
  });
}

/**
 * 10. جلب قائمة أوامر الإنتاج أو تفاصيل أمر إنتاج واحد
 */
async function listOrders(ctx, filters = {}) {
  const { dbAll } = resolveHelpers(ctx);
  const conds = ['po.deleted_at IS NULL'];
  const params = [];

  if (filters.status) {
    conds.push('po.status = ?');
    params.push(String(filters.status));
  }
  if (filters.productId || filters.product_id) {
    conds.push('po.product_id = ?');
    params.push(Number(filters.productId || filters.product_id));
  }
  if (filters.dateFrom || filters.date_from) {
    conds.push('date(po.order_date) >= date(?)');
    params.push(String(filters.dateFrom || filters.date_from).slice(0, 10));
  }
  if (filters.dateTo || filters.date_to) {
    conds.push('date(po.order_date) <= date(?)');
    params.push(String(filters.dateTo || filters.date_to).slice(0, 10));
  }

  return await dbAll(
    `
    SELECT
      po.*,
      p.name AS product_name,
      p.barcode AS product_barcode,
      p.unit AS product_unit,
      r.name AS recipe_name,
      u.name AS user_name
    FROM production_orders po
    LEFT JOIN products p ON p.id = po.product_id
    LEFT JOIN bom_recipes r ON r.id = po.recipe_id
    LEFT JOIN users u ON u.id = po.user_id
    WHERE ${conds.join(' AND ')}
    ORDER BY po.id DESC
    LIMIT 250
    `,
    params
  );
}

async function getOrder(ctx, orderId) {
  const { dbGet, dbAll } = resolveHelpers(ctx);
  const id = Number(orderId && typeof orderId === 'object' ? orderId.id || orderId.orderId : orderId);
  const order = await dbGet(
    `
    SELECT
      po.*,
      p.name AS product_name,
      p.barcode AS product_barcode,
      p.unit AS product_unit,
      r.name AS recipe_name,
      u.name AS user_name
    FROM production_orders po
    LEFT JOIN products p ON p.id = po.product_id
    LEFT JOIN bom_recipes r ON r.id = po.recipe_id
    LEFT JOIN users u ON u.id = po.user_id
    WHERE po.id = ? AND po.deleted_at IS NULL
    `,
    [id]
  );
  if (!order) return null;

  order.items = await dbAll(
    `
    SELECT
      poi.*,
      cp.name AS component_name,
      cp.barcode AS component_barcode,
      cp.unit AS component_unit
    FROM production_order_items poi
    LEFT JOIN products cp ON cp.id = poi.component_product_id
    WHERE poi.order_id = ? AND poi.deleted_at IS NULL
    ORDER BY poi.id ASC
    `,
    [id]
  );

  return order;
}

/**
 * 11. تعيين دور المادة للمنتج (raw_material / semi_finished / finished_good)
 */
async function setMaterialRole(ctx, payload = {}) {
  const { dbRun } = resolveHelpers(ctx);
  const productId = Number(payload.productId || payload.product_id || payload.id);
  const role = payload.materialRole ?? payload.material_role ?? null;
  const hideFromPos =
    payload.hideFromPos !== undefined
      ? payload.hideFromPos
        ? 1
        : 0
      : role === 'raw_material'
        ? 1
        : 0;

  await dbRun('UPDATE products SET material_role = ?, hide_from_pos = ? WHERE id = ?', [
    role,
    hideFromPos,
    productId
  ]);
  return { success: true, product_id: productId, material_role: role, hide_from_pos: hideFromPos };
}

/**
 * إنشاء أمر إنتاج مع خيار التأكيد الفوري المباشر
 */
async function createProductionOrder(ctx, payload = {}) {
  const draft = await createDraft(ctx, payload);
  if (payload && (payload.confirmImmediately || payload.confirm || payload.status === 'confirmed')) {
    return await confirmOrder(ctx, { orderId: draft.id, ...payload });
  }
  return draft;
}

module.exports = {
  listRecipes,
  getBomRecipes: listRecipes,
  loadRecipeWithComponents,
  getRecipe: loadRecipeWithComponents,
  getBomRecipe: loadRecipeWithComponents,
  saveRecipe,
  saveBomRecipe: saveRecipe,
  deleteRecipe,
  deleteBomRecipe: deleteRecipe,
  computeRecipeAvailability,
  getRecipeAvailability: computeRecipeAvailability,
  autoCapacityForProducts,
  getManufacturableCapacity: (ctx, payload = {}) =>
    autoCapacityForProducts(
      ctx,
      Array.isArray(payload) ? payload : payload.productIds || payload.product_ids || []
    ),
  createDraft,
  createProductionOrder,
  confirmOrder,
  confirmProductionOrder: confirmOrder,
  reverseOrder,
  reverseProductionOrder: reverseOrder,
  listOrders,
  getProductionOrders: listOrders,
  getOrder,
  getProductionOrder: getOrder,
  setMaterialRole
};