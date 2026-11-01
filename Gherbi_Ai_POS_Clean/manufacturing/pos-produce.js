/**
 * manufacturing/pos-produce.js
 * محرك التصنيع الآلي الفوري عند البيع في شاشة الكاشير (يعمل في Node.js وفي المتصفح معاً)
 */

'use strict';

(function (root) {
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const productionGuard = isNode ? require('./production-guard') : null;

  async function autoProduceShortfallsForSale(db, saleItems = [], options = {}) {
    if (!isNode || !productionGuard || !db) return [];
    const globalAutoSetting = await db.getSetting('manufacturing_auto_on_sale', 'false');
    const isGlobalAutoEnabled =
      String(globalAutoSetting).toLowerCase() === 'true' || globalAutoSetting === '1';

    const producedOrders = [];

    for (const item of Array.isArray(saleItems) ? saleItems : []) {
      const productId = Number(item.product_id || item.productId);
      const requestedQty = Number(item.quantity || 0);
      if (!productId || requestedQty <= 0) continue;

      const stockRow = await db.dbGet(
        'SELECT COALESCE(SUM(stock), 0) AS current_stock FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL',
        [productId]
      );
      const currentStock = Number((stockRow && stockRow.current_stock) || 0);
      const shortfall = Number((requestedQty - currentStock).toFixed(6));

      if (shortfall <= 0.0001) continue;

      const recipe = await db.dbGet(
        `SELECT * FROM bom_recipes
         WHERE product_id = ? AND is_active = 1 AND deleted_at IS NULL
         ORDER BY is_default DESC, id DESC
         LIMIT 1`,
        [productId]
      );

      if (!recipe) continue;
      if (!isGlobalAutoEnabled && !Number(recipe.auto_on_sale)) continue;

      let qtyToProduce = shortfall;
      if (recipe.auto_round === 'batch' && Number(recipe.output_qty) > 0) {
        const batchesNeeded = Math.ceil(shortfall / Number(recipe.output_qty));
        qtyToProduce = batchesNeeded * Number(recipe.output_qty);
      }

      try {
        const avail = await productionGuard.computeRecipeAvailability(db, {
          recipeId: recipe.id,
          plannedQty: qtyToProduce
        });

        if (avail && avail.can_produce) {
          const order = await productionGuard.createProductionOrder(db, {
            recipe_id: recipe.id,
            planned_qty: qtyToProduce,
            produced_qty: qtyToProduce,
            trigger_source: 'auto_pos_sale',
            sale_id: options.saleId || null,
            user_id: options.userId || null,
            confirmImmediately: true,
            note: 'إنتاج تلقائي لتغطية بيع الكاشير'
          });
          producedOrders.push(order);
        }
      } catch (err) {
        console.warn('[Auto-Produce POS] Skipped product #' + productId + ':', err.message);
      }
    }

    return producedOrders;
  }

  if (isNode) {
    module.exports = { autoProduceShortfallsForSale };
  } else if (root) {
    root.PosProduce = {
      openQuickProduceModal: function () {
        if (root.App && typeof root.App.openPosQuickProduceModal === 'function') {
          root.App.openPosQuickProduceModal();
        }
      }
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
