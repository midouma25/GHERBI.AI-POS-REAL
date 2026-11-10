/**
 * product-write.js
 * محرك كتابة وتحديث المنتجات، الباركودات الإضافية، مستويات الأسعار، ومصفوفة المتغيرات (Variants)
 */

'use strict';

const { processImage } = require('./imageUtils');

function createProductWriter(db) {
  function rawGet(sql, params = []) {
    const fn = db._rawGet ? db._rawGet.bind(db) : db.get.bind(db);
    return new Promise((resolve, reject) => {
      fn(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  }

  function rawRun(sql, params = []) {
    const fn = db._rawRun ? db._rawRun.bind(db) : db.run.bind(db);
    return new Promise((resolve, reject) => {
      fn(sql, params, function onDone(err) {
        if (err) return reject(err);
        resolve({ lastID: this ? this.lastID : null, changes: this ? this.changes : 0 });
      });
    });
  }

  async function freeTombstonedProductBarcode(barcode) {
    const clean = String(barcode || '').trim();
    if (!clean) return;

    const prod = await rawGet('SELECT id, deleted_at FROM products WHERE barcode = ?', [clean]);
    if (prod && prod.deleted_at) {
      await rawRun(
        "UPDATE products SET barcode = barcode || '~del~' || id, dirty = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        [prod.id]
      );
    }

    const pb = await rawGet('SELECT id, deleted_at FROM product_barcodes WHERE barcode = ?', [clean]);
    if (pb && pb.deleted_at) {
      await rawRun(
        "UPDATE product_barcodes SET barcode = barcode || '~del~' || id, dirty = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        [pb.id]
      );
    }

    const pv = await rawGet('SELECT id, deleted_at FROM product_variants WHERE barcode = ?', [clean]);
    if (pv && pv.deleted_at) {
      await rawRun(
        "UPDATE product_variants SET barcode = barcode || '~del~' || id, dirty = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        [pv.id]
      );
    }
  }

  async function insertExtraBarcodesAndPrices(productId, extraBarcodes = [], extraPrices = []) {
    const pid = Number(productId);
    await db.dbRun('DELETE FROM product_barcodes WHERE product_id = ?', [pid]);
    await db.dbRun('DELETE FROM product_prices WHERE product_id = ?', [pid]);

    for (const item of Array.isArray(extraBarcodes) ? extraBarcodes : []) {
      const bc = String((typeof item === 'object' ? item.barcode : item) || '').trim();
      const priceLabel = typeof item === 'object' && item.price_label ? String(item.price_label).trim() : null;
      const unitMult = typeof item === 'object' && Number(item.unit_multiplier) > 0 ? Number(item.unit_multiplier) : 1;
      const packName = typeof item === 'object' && item.pack_name ? String(item.pack_name).trim() : '';
      if (!bc) continue;

      await freeTombstonedProductBarcode(bc);
      const existing = await rawGet('SELECT id FROM product_barcodes WHERE barcode = ?', [bc]);
      if (existing) {
        await rawRun(
          "UPDATE product_barcodes SET product_id = ?, price_label = ?, unit_multiplier = ?, pack_name = ?, deleted_at = NULL, dirty = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
          [pid, priceLabel, unitMult, packName, existing.id]
        );
      } else {
        await db.dbRun(
          'INSERT INTO product_barcodes (product_id, barcode, price_label, unit_multiplier, pack_name) VALUES (?, ?, ?, ?, ?)',
          [pid, bc, priceLabel, unitMult, packName]
        );
      }
    }

    for (const pr of Array.isArray(extraPrices) ? extraPrices : []) {
      if (!pr || typeof pr !== 'object') continue;
      const label = String(pr.label || '').trim();
      const price = Number(pr.price);
      if (!label || !Number.isFinite(price)) continue;

      const minQty = Number(pr.min_qty) > 0 ? Number(pr.min_qty) : 1;
      await db.dbRun('INSERT INTO product_prices (product_id, label, price, min_qty) VALUES (?, ?, ?, ?)', [
        pid,
        label,
        price,
        minQty
      ]);
    }
  }

  async function insertVariantData(productId, optionGroups = [], variants = [], defaultLocation = null) {
    const pid = Number(productId);
    const groupValueMap = new Map();

    for (let gIdx = 0; gIdx < optionGroups.length; gIdx++) {
      const g = optionGroups[gIdx];
      const gName = String(g.name || '').trim();
      if (!gName) continue;

      const gIns = await db.dbRun(
        'INSERT INTO product_option_groups (product_id, name, position) VALUES (?, ?, ?)',
        [pid, gName, gIdx]
      );
      const groupId = gIns.lastID;
      const valMap = new Map();

      const values = Array.isArray(g.values) ? g.values : [];
      for (let vIdx = 0; vIdx < values.length; vIdx++) {
        const rawVal = typeof values[vIdx] === 'object' ? values[vIdx].value : values[vIdx];
        const vLabel = String(rawVal || '').trim();
        if (!vLabel) continue;

        const vIns = await db.dbRun(
          'INSERT INTO product_option_values (option_group_id, value, position) VALUES (?, ?, ?)',
          [groupId, vLabel, vIdx]
        );
        valMap.set(vLabel.toLowerCase(), vIns.lastID);
      }
      groupValueMap.set(gName.toLowerCase(), valMap);
    }

    for (const v of Array.isArray(variants) ? variants : []) {
      const vBarcode = v.barcode ? String(v.barcode).trim() : null;
      if (vBarcode) await freeTombstonedProductBarcode(vBarcode);

      const vImg = v.image ? processImage(v.image) : null;
      const isActive = v.is_active !== undefined ? (v.is_active ? 1 : 0) : 1;

      const vIns = await db.dbRun(
        'INSERT INTO product_variants (product_id, barcode, sku, image, is_active) VALUES (?, ?, ?, ?, ?)',
        [pid, vBarcode, v.sku || null, vImg, isActive]
      );
      const variantId = vIns.lastID;

      const optVals = v.option_values || v.options || {};
      if (Array.isArray(optVals)) {
        for (const item of optVals) {
          const gKey = String(item.group_name || item.group || '').trim().toLowerCase();
          const vKey = String(item.value || '').trim().toLowerCase();
          const vMap = groupValueMap.get(gKey);
          const optValId = vMap ? vMap.get(vKey) : null;
          if (optValId) {
            await db.dbRun(
              'INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (?, ?)',
              [variantId, optValId]
            );
          }
        }
      } else if (typeof optVals === 'object' && optVals !== null) {
        for (const [gName, valLabel] of Object.entries(optVals)) {
          const vMap = groupValueMap.get(String(gName).trim().toLowerCase());
          const optValId = vMap ? vMap.get(String(valLabel).trim().toLowerCase()) : null;
          if (optValId) {
            await db.dbRun(
              'INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (?, ?)',
              [variantId, optValId]
            );
          }
        }
      }

      await db.dbRun(
        `INSERT INTO inventory_batches (
          product_id, variant_id, stock, cost_price, selling_price, wholesale_price, expiry_date, location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pid,
          variantId,
          Number(v.stock ?? 0),
          Number(v.cost_price ?? 0),
          Number(v.selling_price ?? 0),
          v.wholesale_price !== undefined && v.wholesale_price !== '' ? Number(v.wholesale_price) : null,
          v.expiry_date || null,
          v.location || defaultLocation || null
        ]
      );
    }
  }

  async function rewriteProductVariants(productId, variantData = {}) {
    const pid = Number(productId);
    const optionGroups = variantData.option_groups || variantData.optionGroups || [];
    const variants = variantData.variants || [];
    const hasVariants = variants.length > 0 ? 1 : 0;

    return await db.withTransaction(async () => {
      await db.dbRun(
        'DELETE FROM variant_option_values WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)',
        [pid]
      );
      await db.dbRun(
        'DELETE FROM product_option_values WHERE option_group_id IN (SELECT id FROM product_option_groups WHERE product_id = ?)',
        [pid]
      );
      await db.dbRun('DELETE FROM product_variants WHERE product_id = ?', [pid]);
      await db.dbRun('DELETE FROM product_option_groups WHERE product_id = ?', [pid]);
      await db.dbRun(
        'DELETE FROM inventory_batches WHERE product_id = ? AND variant_id IS NOT NULL AND id NOT IN (SELECT DISTINCT batch_id FROM sale_items WHERE batch_id IS NOT NULL)',
        [pid]
      );

      await db.dbRun('UPDATE products SET has_variants = ? WHERE id = ?', [hasVariants, pid]);

      if (hasVariants) {
        await insertVariantData(pid, optionGroups, variants, variantData.batch_location || null);
      }

      return { success: true, product_id: pid, has_variants: hasVariants };
    });
  }

  async function addProductBarcode(productId, barcode, priceLabel = null) {
    const pid = Number(productId);
    const clean = String(barcode || '').trim();
    if (!clean) throw new Error('barcode_required');

    await freeTombstonedProductBarcode(clean);
    await db.dbRun(
      'INSERT INTO product_barcodes (product_id, barcode, price_label) VALUES (?, ?, ?)',
      [pid, clean, priceLabel || null]
    );
    return { success: true, barcode: clean };
  }

  async function addVariantQuick(payload = {}) {
    const pid = Number(payload.productId || payload.product_id);
    const barcode = payload.barcode ? String(payload.barcode).trim() : null;
    if (barcode) await freeTombstonedProductBarcode(barcode);

    return await db.withTransaction(async () => {
      const ins = await db.dbRun(
        'INSERT INTO product_variants (product_id, barcode, sku, is_active) VALUES (?, ?, ?, 1)',
        [pid, barcode, payload.sku || null]
      );
      const variantId = ins.lastID;

      await db.dbRun(
        'INSERT INTO inventory_batches (product_id, variant_id, stock, cost_price, selling_price) VALUES (?, ?, ?, ?, ?)',
        [
          pid,
          variantId,
          Number(payload.stock ?? 0),
          Number(payload.cost_price ?? 0),
          Number(payload.selling_price ?? 0)
        ]
      );

      await db.dbRun('UPDATE products SET has_variants = 1 WHERE id = ?', [pid]);
      return { success: true, variant_id: variantId };
    });
  }

  return {
    freeTombstonedProductBarcode,
    insertExtraBarcodesAndPrices,
    insertVariantData,
    rewriteProductVariants,
    addProductBarcode,
    addVariantQuick
  };
}

module.exports = {
  createProductWriter
};