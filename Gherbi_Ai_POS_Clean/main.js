/**
 * main.js
 * العملية الرئيسية (Electron Main Process) لنظام Gherbi.Ai POS
 * تدير النوافذ، قاعدة البيانات، الطباعة الصامتة، تصدير PDF/Excel، النسخ الاحتياطي، وجميع قنوات IPC
 */

'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');

const db = require('./database');
const { processImage, getImagesDir } = require('./imageUtils');
const productWriterMod = require('./product-write');
const batchAlloc = require('./batch-alloc');
const stockLedger = require('./stock-ledger');
const tillLedger = require('./till-ledger');
const analyticsQueries = require('./analytics-queries');
const productionGuard = require('./manufacturing/production-guard');
const stocktakeGuard = require('./stocktake/stocktake-guard');
const { getDataRevision } = require('./data-revision');
const lanClient = require('./api-client');
const scaleBridge = require('./scale-bridge');
const licenseManager = require('./licenseManager');
const deviceAuth = require('./device-auth');
const cloudSyncMod = require('./cloud-sync');
const cloudDbSyncMod = require('./cloud-db-sync');
const cloudDiagnostics = require('./cloud-diagnostics');
const {
  startLocalServer,
  generateNextDocNumber,
  enrichProductsFull,
  getProductFullDetails,
  executeSaleTransaction
} = require('./server');

const productWriter = productWriterMod.createProductWriter(db);

let mainWindow = null;
let localServerHandle = null;
let cloudDbSync = null;
let activeServerPort = 8080;

// ============================================================================
// دوال مساعدة لقاعدة البيانات والإعدادات والشبكة
// ============================================================================
const dbGet = (sql, params = []) => db.dbGet(sql, params);
const dbAll = (sql, params = []) => db.dbAll(sql, params);
const dbRun = (sql, params = []) => db.dbRun(sql, params);

async function getSetting(key, fallback = '') {
  return await db.getSetting(key, fallback);
}

async function setSetting(key, value) {
  await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    String(key),
    value === null || value === undefined ? '' : String(value)
  ]);
}

async function getAllSettingsObject() {
  const rows = await dbAll('SELECT key, value FROM settings');
  const obj = {};
  for (const r of rows) {
    if (r.value !== 'undefined' && r.value !== 'null') {
      obj[r.key] = r.value;
    }
  }
  const shopRow = await dbGet(
    'SELECT * FROM shop_info WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1'
  );
  if (shopRow) {
    if (shopRow.name && !obj.shop_name) obj.shop_name = shopRow.name;
    if (shopRow.address && !obj.shop_address) obj.shop_address = shopRow.address;
    if (shopRow.phone && !obj.shop_phone) obj.shop_phone = shopRow.phone;
    if (shopRow.rc && !obj.shop_rc) obj.shop_rc = shopRow.rc;
    if (shopRow.nif && !obj.shop_nif) obj.shop_nif = shopRow.nif;
    if (shopRow.ai && !obj.shop_ai) obj.shop_ai = shopRow.ai;
    if (shopRow.nis && !obj.shop_nis) obj.shop_nis = shopRow.nis;
    if (shopRow.logo && !obj.shop_logo) obj.shop_logo = shopRow.logo;
  }
  return obj;
}

async function isLanClientMode() {
  const scope = (await getSetting('network_scope', 'local')).toLowerCase();
  const mode = (await getSetting('network_mode', 'server')).toLowerCase();
  if ((scope === 'local' || scope === 'lan' || scope === 'both') && mode === 'client') {
    const serverIp = await getSetting('server_ip', '192.168.1.15');
    const serverPort = Number(await getSetting('server_port', '8080')) || 8080;
    const instanceId = await getSetting('instance_id', 'lan-client');
    lanClient.setTarget(serverIp, serverPort, instanceId);
    return true;
  }
  return false;
}

function getLocalIpv4List() {
  const nets = os.networkInterfaces();
  const list = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        list.push({ name, address: addr.address, netmask: addr.netmask });
      }
    }
  }
  return list;
}

function getPrimaryLocalIp() {
  const list = getLocalIpv4List();
  return list.length > 0 ? list[0].address : '127.0.0.1';
}

async function ensureSupplierByName(supplierName) {
  const clean = String(supplierName || '').trim();
  if (!clean) return null;
  const existing = await dbGet(
    'SELECT id FROM suppliers WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL LIMIT 1',
    [clean]
  );
  if (existing) return existing.id;
  const ins = await dbRun(
    'INSERT INTO suppliers (name, initial_debt, initial_debt_paid) VALUES (?, 0, 0)',
    [clean]
  );
  return ins.lastID;
}

// ============================================================================
// إنشاء النافذة الرئيسية وربط الأحداث الحية
// ============================================================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'Gherbi.Ai POS',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// بث قراءات الميزان الحية إلى الواجهة الأمامية
scaleBridge.on('reading', (reading) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scale:reading', reading);
  }
});

scaleBridge.on('status', (st) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scale:status', st);
  }
});

scaleBridge.on('raw', (rawItem) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scale:raw', rawItem);
  }
});

// ============================================================================
// تسجيل جميع قنوات الاتصال (IPC Handlers)
// ============================================================================
function registerIpcHandlers() {
  // معالج متزامن لمعرف الجهاز HWID
  ipcMain.on('get-hwid-sync', (event) => {
    event.returnValue = licenseManager.getHWID();
  });

  // 1. المراجعات والإعدادات ومعلومات النظام
  ipcMain.handle('get-data-revision', async () => {
    if (await isLanClientMode()) return lanClient.getDataRevision();
    return getDataRevision();
  });

  ipcMain.handle('get-app-version', () => app.getVersion() || '3.0.0');
  ipcMain.handle('check-update', () => ({ updateAvailable: false, version: app.getVersion() }));
  ipcMain.handle('open-external-link', (_e, url) => {
    if (url && /^https?:\/\//i.test(String(url))) shell.openExternal(String(url));
    return { ok: true };
  });
  ipcMain.handle('open-youtube-video', (_e, url) => {
    if (url) shell.openExternal(String(url));
    return { ok: true };
  });
  ipcMain.handle('app-relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('get-settings', async () => {
    if (await isLanClientMode()) return lanClient.getSettings();
    return await getAllSettingsObject();
  });

  ipcMain.handle('update-settings', async (_e, settingsObj = {}) => {
    if (await isLanClientMode()) return lanClient.updateSettings(settingsObj);
    await db.withTransaction(async () => {
      for (const [k, v] of Object.entries(settingsObj || {})) {
        if (v === undefined || v === 'undefined') continue;
        const val = k === 'shop_logo' && v ? processImage(String(v)) : String(v ?? '');
        await setSetting(k, val);
      }
    });
    return { success: true };
  });

  // 2. المستخدمون والمصادقة (خالية تماماً من أخطاء UNIQUE constraint)
  ipcMain.handle('check-first-run', async () => {
    if (await isLanClientMode()) return lanClient.checkFirstRun();
    await dbRun(
      "UPDATE users SET username = username || '~del~' || id WHERE deleted_at IS NOT NULL AND username NOT LIKE '%~del~%'"
    );
    const row = await dbGet('SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL');
    const isFirst = Number((row && row.count) || 0) === 0;
    return isFirst;
  });

  ipcMain.handle('setup-first-admin', async (_e, arg1, arg2, arg3) => {
    if (await isLanClientMode()) return lanClient.setupFirstAdmin(arg1);
    const d =
      typeof arg1 === 'object' && arg1 !== null
        ? arg1
        : { name: arg1, username: arg2, password: arg3 };

    const name = String(d.name || d.username || 'Admin').trim();
    const username = String(d.username || d.name || 'admin').trim();
    const rawPass = String(d.password || '1234');
    const hashed = bcrypt.hashSync(rawPass, 10);

    await dbRun(
      "UPDATE users SET username = username || '~del~' || id WHERE deleted_at IS NOT NULL AND username NOT LIKE '%~del~%'"
    );

    const existing = await dbGet(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE LIMIT 1',
      [username]
    );

    let userId;
    if (existing && existing.id) {
      userId = existing.id;
      await dbRun(
        "UPDATE users SET name = ?, username = ?, password = ?, role = 'Admin', status = 'Active', deleted_at = NULL WHERE id = ?",
        [name, username, hashed, userId]
      );
    } else {
      const ins = await dbRun(
        "INSERT INTO users (name, username, password, role, status) VALUES (?, ?, ?, 'Admin', 'Active')",
        [name, username, hashed]
      );
      userId = ins.lastID;
    }

    const userObj = { id: userId, name, username, role: 'Admin', status: 'Active' };
    return { success: true, ok: true, ...userObj, user: userObj };
  });

  ipcMain.handle('login-user', async (_e, arg1, arg2) => {
    const username = String(
      (typeof arg1 === 'object' && arg1 !== null ? arg1.username : arg1) || ''
    ).trim();
    const password = String(
      (typeof arg1 === 'object' && arg1 !== null ? arg1.password : arg2) || ''
    );
    if (await isLanClientMode()) return lanClient.loginUser(username, password);

    const user = await dbGet(
      'SELECT id, name, username, password, role, status FROM users WHERE username = ? COLLATE NOCASE AND deleted_at IS NULL LIMIT 1',
      [username]
    );
    if (!user) return { success: false, error: 'invalid_creds' };
    if (user.status && String(user.status).toLowerCase() !== 'active') {
      return { success: false, error: 'account_disabled' };
    }

    let valid = false;
    if (String(user.password || '').startsWith('$2')) {
      valid = bcrypt.compareSync(password, user.password);
    } else {
      const sha = crypto.createHash('sha256').update(password).digest('hex');
      valid = user.password === password || user.password === sha;
      if (valid) {
        await dbRun('UPDATE users SET password = ? WHERE id = ?', [
          bcrypt.hashSync(password, 10),
          user.id
        ]);
      }
    }

    if (!valid) return { success: false, error: 'invalid_creds' };

    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role || 'Admin',
      status: user.status || 'Active'
    };
    return { success: true, ok: true, ...safeUser, user: safeUser };
  });

  ipcMain.handle('get-users', async () => {
    if (await isLanClientMode()) return lanClient.getUsers();
    return await dbAll(
      'SELECT id, name, username, role, status, created_at FROM users WHERE deleted_at IS NULL ORDER BY id ASC'
    );
  });

  ipcMain.handle('add-user', async (_e, u = {}) => {
    if (await isLanClientMode()) return lanClient.addUser(u);
    const name = String(u.name || u.username || '').trim();
    const username = String(u.username || '').trim();
    const hashed = bcrypt.hashSync(String(u.password || '1234'), 10);
    const role = u.role || 'Cashier';
    const status = u.status || 'Active';

    await dbRun(
      "UPDATE users SET username = username || '~del~' || id WHERE deleted_at IS NOT NULL AND username NOT LIKE '%~del~%'"
    );
    const existing = await dbGet(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE AND deleted_at IS NULL',
      [username]
    );
    if (existing) {
      await dbRun('UPDATE users SET name = ?, password = ?, role = ?, status = ? WHERE id = ?', [
        name,
        hashed,
        role,
        status,
        existing.id
      ]);
      return { success: true, id: existing.id };
    }
    const ins = await dbRun(
      'INSERT INTO users (name, username, password, role, status) VALUES (?, ?, ?, ?, ?)',
      [name, username, hashed, role, status]
    );
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('update-user', async (_e, arg1, arg2) => {
    const id = Number(typeof arg1 === 'object' ? arg1.id : arg1);
    const u = typeof arg1 === 'object' ? arg1 : arg2 || {};
    if (await isLanClientMode()) return lanClient.updateUser(id, u);

    if (u.password && String(u.password).trim() !== '') {
      const hashed = bcrypt.hashSync(String(u.password), 10);
      await dbRun(
        'UPDATE users SET name = ?, username = ?, password = ?, role = ?, status = ? WHERE id = ?',
        [u.name, u.username, hashed, u.role || 'Cashier', u.status || 'Active', id]
      );
    } else {
      await dbRun('UPDATE users SET name = ?, username = ?, role = ?, status = ? WHERE id = ?', [
        u.name,
        u.username,
        u.role || 'Cashier',
        u.status || 'Active',
        id
      ]);
    }
    return { success: true, id };
  });

  ipcMain.handle('delete-user', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteUser(id);
    await dbRun('DELETE FROM users WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('update-account', async (_e, userId, username, currentPassword, newPassword) => {
    if (await isLanClientMode()) {
      return lanClient.updateAccount(userId, username, currentPassword, newPassword);
    }
    const user = await dbGet('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [
      Number(userId)
    ]);
    if (!user) return { success: false, error: 'user_not_found' };

    if (newPassword) {
      const hashed = bcrypt.hashSync(String(newPassword), 10);
      await dbRun('UPDATE users SET username = ?, password = ? WHERE id = ?', [
        String(username || user.username).trim(),
        hashed,
        user.id
      ]);
    } else {
      await dbRun('UPDATE users SET username = ? WHERE id = ?', [
        String(username || user.username).trim(),
        user.id
      ]);
    }
    return { success: true };
  });

  // 3. المنتجات، الفئات، الدفعات، والمتغيرات
  ipcMain.handle('get-categories', async () => {
    if (await isLanClientMode()) return lanClient.getCategories();
    const rows = await dbAll(
      "SELECT DISTINCT category FROM products WHERE deleted_at IS NULL AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC"
    );
    return rows.map((r) => r.category);
  });

  ipcMain.handle('get-families', async () => {
    if (await isLanClientMode()) return lanClient.getFamilies();
    const rows = await dbAll(
      "SELECT DISTINCT family FROM products WHERE deleted_at IS NULL AND family IS NOT NULL AND TRIM(family) <> '' ORDER BY family ASC"
    );
    return rows.map((r) => r.family);
  });

  ipcMain.handle('get-product-suppliers', async () => {
    if (await isLanClientMode()) return lanClient.getProductSuppliers();
    const rows = await dbAll(
      "SELECT DISTINCT name FROM suppliers WHERE deleted_at IS NULL AND name IS NOT NULL AND TRIM(name) <> '' ORDER BY name ASC"
    );
    return rows.map((r) => r.name);
  });

  ipcMain.handle('get-products', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getProducts(filters);
    const conds = ['p.deleted_at IS NULL'];
    const params = [];

    if (filters && filters.category) {
      conds.push('p.category = ?');
      params.push(filters.category);
    }
    if (filters && filters.family) {
      conds.push('p.family = ?');
      params.push(filters.family);
    }
    if (filters && filters.supplier) {
      conds.push('p.supplier = ?');
      params.push(filters.supplier);
    }
    if (filters && filters.search) {
      const q = `%${String(filters.search).trim()}%`;
      conds.push('(p.name LIKE ? OR p.barcode LIKE ? OR p.category LIKE ? OR p.plu_code LIKE ?)');
      params.push(q, q, q, q);
    }

    const rows = await dbAll(
      `SELECT p.* FROM products p WHERE ${conds.join(' AND ')} ORDER BY p.id DESC`,
      params
    );
    return await enrichProductsFull(rows);
  });

  ipcMain.handle('get-pos-stock', async () => {
    if (await isLanClientMode()) return lanClient.getPosStock();
    const rows = await dbAll(
      'SELECT * FROM products WHERE deleted_at IS NULL AND COALESCE(hide_from_pos, 0) = 0 ORDER BY is_featured DESC, id DESC'
    );
    return await enrichProductsFull(rows);
  });

  ipcMain.handle('get-product-full', async (_e, productId) => {
    if (await isLanClientMode()) return lanClient.getProductFull(productId);
    return await getProductFullDetails(productId);
  });

  ipcMain.handle('get-product-analytics', async (_e, productId) => {
    if (await isLanClientMode()) return lanClient.getProductAnalytics(productId);
    const pid = Number(productId);
    const summary = await dbGet(
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
    return {
      product_id: pid,
      total_sold_qty: Number((summary && summary.total_sold_qty) || 0),
      total_revenue: rev,
      total_cost: cost,
      total_profit: Number((rev - cost).toFixed(2))
    };
  });

  ipcMain.handle('add-product', async (_e, p = {}) => {
    if (await isLanClientMode()) return lanClient.addProduct(p);
    const barcode = p.barcode ? String(p.barcode).trim() : null;
    if (barcode) await productWriter.freeTombstonedProductBarcode(barcode);
    if (p.supplier) await ensureSupplierByName(p.supplier);

    const img = p.image ? processImage(p.image) : null;

    return await db.withTransaction(async () => {
      const ins = await dbRun(
        `INSERT INTO products (
          barcode, name, category, family, supplier, description, min_stock,
          image, unit, color, weight_volume, wholesale_unit, wholesale_qty,
          plu_code, has_variants, is_featured, material_role, track_serial, hide_from_pos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        await productWriter.insertVariantData(
          productId,
          p.option_groups || [],
          p.variants,
          p.location || null
        );
      } else {
        await dbRun(
          `INSERT INTO inventory_batches (
            product_id, stock, cost_price, selling_price, wholesale_price, expiry_date, location
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            Number(p.stock ?? 0),
            Number(p.cost_price ?? 0),
            Number(p.selling_price ?? 0),
            p.wholesale_price !== undefined && p.wholesale_price !== ''
              ? Number(p.wholesale_price)
              : null,
            p.expiry_date || null,
            p.location || null
          ]
        );
      }

      return { success: true, id: productId };
    });
  });

  ipcMain.handle('update-product', async (_e, arg1, arg2) => {
    const productId = Number(typeof arg1 === 'object' ? arg1.id : arg1);
    const p = typeof arg1 === 'object' ? arg1 : arg2 || {};
    if (await isLanClientMode()) return lanClient.updateProduct(productId, p);

    const barcode = p.barcode ? String(p.barcode).trim() : null;
    if (barcode) await productWriter.freeTombstonedProductBarcode(barcode);
    if (p.supplier) await ensureSupplierByName(p.supplier);

    const img = p.image !== undefined ? (p.image ? processImage(p.image) : null) : undefined;

    return await db.withTransaction(async () => {
      await dbRun(
        `UPDATE products
         SET barcode = ?, name = ?, category = ?, family = ?, supplier = ?,
             description = ?, min_stock = ?, image = COALESCE(?, image),
             unit = ?, color = ?, weight_volume = ?, wholesale_unit = ?,
             wholesale_qty = ?, plu_code = ?, is_featured = COALESCE(?, is_featured),
             material_role = COALESCE(?, material_role), hide_from_pos = COALESCE(?, hide_from_pos)
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
          p.hide_from_pos !== undefined ? (p.hide_from_pos ? 1 : 0) : null,
          productId
        ]
      );

      if (p.extra_barcodes !== undefined || p.extra_prices !== undefined) {
        await productWriter.insertExtraBarcodesAndPrices(
          productId,
          p.extra_barcodes || [],
          p.extra_prices || []
        );
      }

      return { success: true, id: productId };
    });
  });

  ipcMain.handle('delete-product', async (_e, productId) => {
    if (await isLanClientMode()) return lanClient.deleteProduct(productId);
    const pid = Number(productId);
    await dbRun('DELETE FROM inventory_batches WHERE product_id = ?', [pid]);
    await dbRun('DELETE FROM products WHERE id = ?', [pid]);
    db.tombstoneOrphans();
    return { success: true };
  });

  ipcMain.handle('add-batch', async (_e, arg1, arg2) => {
    const productId = Number(typeof arg1 === 'object' ? arg1.product_id || arg1.productId : arg1);
    const b = typeof arg1 === 'object' ? arg1 : arg2 || {};
    if (await isLanClientMode()) return lanClient.addBatch(productId, b);

    const ins = await dbRun(
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
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('update-batch', async (_e, arg1, arg2) => {
    const batchId = Number(typeof arg1 === 'object' ? arg1.id || arg1.batchId : arg1);
    const b = typeof arg1 === 'object' ? arg1 : arg2 || {};
    if (await isLanClientMode()) return lanClient.updateBatch(batchId, b);

    await dbRun(
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
    return { success: true, id: batchId };
  });

  ipcMain.handle('delete-batch', async (_e, batchId) => {
    if (await isLanClientMode()) return lanClient.deleteBatch(batchId);
    await batchAlloc.voidBatches(db, [Number(batchId)]);
    return { success: true };
  });

  ipcMain.handle('save-product-variants', async (_e, productId, variantData) => {
    if (await isLanClientMode()) return lanClient.saveProductVariants(productId, variantData);
    return await productWriter.rewriteProductVariants(productId, variantData);
  });

  ipcMain.handle('get-variant-templates', () => [
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

  ipcMain.handle('add-product-barcode', async (_e, productId, barcode, priceLabel) => {
    if (await isLanClientMode()) return lanClient.addProductBarcode(productId, barcode, priceLabel);
    return await productWriter.addProductBarcode(productId, barcode, priceLabel);
  });

  ipcMain.handle('add-variant-quick', async (_e, payload) => {
    if (await isLanClientMode()) return lanClient.addVariantQuick(payload);
    return await productWriter.addVariantQuick(payload);
  });

  ipcMain.handle('toggle-featured', async (_e, productId) => {
    if (await isLanClientMode()) return lanClient.toggleFeatured(productId);
    await dbRun(
      'UPDATE products SET is_featured = CASE WHEN COALESCE(is_featured, 0) = 1 THEN 0 ELSE 1 END WHERE id = ?',
      [Number(productId)]
    );
    return { success: true };
  });

  // 4. المبيعات، الزبائن، وإشعارات الدائن
  ipcMain.handle('process-sale', async (_e, saleData) => {
    if (await isLanClientMode()) return lanClient.processSale(saleData);
    return await executeSaleTransaction(saleData);
  });

  ipcMain.handle('get-sales', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getSales(filters);
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

    return await dbAll(
      `SELECT
         s.*,
         c.name AS customer_name,
         c.phone AS customer_phone,
         u.name AS seller_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE ${conds.join(' AND ')}
       ORDER BY s.id DESC
       LIMIT 500`,
      params
    );
  });

  ipcMain.handle('get-sale-details', async (_e, saleId) => {
    if (await isLanClientMode()) return lanClient.getSaleDetails(saleId);
    const sid = Number(saleId);
    const sale = await dbGet(
      `SELECT
         s.*,
         c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
         c.rc AS customer_rc, c.nif AS customer_nif, c.ai AS customer_ai, c.nis AS customer_nis,
         u.name AS seller_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.deleted_at IS NULL`,
      [sid]
    );
    if (!sale) return null;

    sale.items = await dbAll(
      `SELECT
         si.*,
         COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
         p.barcode AS product_barcode,
         p.unit AS product_unit
       FROM sale_items si
       LEFT JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ? AND si.deleted_at IS NULL`,
      [sid]
    );
    sale.payments = await dbAll(
      'SELECT * FROM sale_payments WHERE sale_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [sid]
    );
    return sale;
  });

  ipcMain.handle('add-sale-payment', async (_e, saleId, amount, date, meta = {}) => {
    if (await isLanClientMode()) return lanClient.addSalePayment(saleId, amount, date, meta);
    const sid = Number(saleId);
    const amt = Number(amount || 0);
    const payDate = date || new Date().toISOString();
    const sale = await dbGet('SELECT * FROM sales WHERE id = ?', [sid]);
    if (!sale) throw new Error('الفاتورة غير موجودة');

    const receiptNum = await generateNextDocNumber('payment_receipt');
    return await db.withTransaction(async () => {
      const ins = await dbRun(
        `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method, reference, receipt_number, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sid,
          sale.customer_id,
          amt,
          payDate,
          meta.payment_method || 'cash',
          meta.reference || null,
          receiptNum,
          meta.notes || null
        ]
      );
      await dbRun('UPDATE sales SET paid_amount = COALESCE(paid_amount, 0) + ? WHERE id = ?', [
        amt,
        sid
      ]);
      const activeSess = await tillLedger.resolveOpenSession(db, null, meta.userId);
      if (activeSess && (!meta.payment_method || meta.payment_method === 'cash')) {
        await dbRun(
          `INSERT INTO caisse_transactions (session_id, type, amount, category, description, reference_id)
           VALUES (?, 'debt_payment', ?, 'sales', ?, ?)`,
          [activeSess, amt, `تسديد فاتورة بيع #${sid}`, ins.lastID]
        );
      }
      return { success: true, paymentId: ins.lastID, receiptNumber: receiptNum };
    });
  });

  ipcMain.handle('delete-sale', async (_e, saleId) => {
    if (await isLanClientMode()) return lanClient.deleteSale(saleId);
    const sid = Number(saleId);
    const items = await dbAll(
      'SELECT * FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL',
      [sid]
    );

    return await db.withTransaction(async () => {
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
      await dbRun('DELETE FROM stock_debt WHERE sale_id = ?', [sid]);
      await dbRun('DELETE FROM sale_payments WHERE sale_id = ?', [sid]);
      await dbRun('DELETE FROM sale_items WHERE sale_id = ?', [sid]);
      await dbRun('DELETE FROM sales WHERE id = ?', [sid]);
      return { success: true };
    });
  });

  ipcMain.handle('get-customers', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getCustomers(filters);
    const rows = await dbAll(
      `SELECT
         c.*,
         COALESCE(SUM(s.total), 0) AS total_sales,
         COALESCE(SUM(s.paid_amount), 0) AS total_paid,
         (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS total_debt
       FROM customers c
       LEFT JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.id DESC`
    );
    return rows;
  });

  ipcMain.handle('get-customers-debt', async () => {
    if (await isLanClientMode()) return lanClient.getCustomersDebt();
    const row = await dbGet(
      `SELECT COALESCE(SUM(debt), 0) AS total_debt FROM (
         SELECT (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS debt
         FROM customers c
         LEFT JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
         WHERE c.deleted_at IS NULL
         GROUP BY c.id
         HAVING debt > 0.009
       )`
    );
    return Number((row && row.total_debt) || 0);
  });

  ipcMain.handle('add-customer', async (_e, c = {}) => {
    if (await isLanClientMode()) return lanClient.addCustomer(c);
    const ins = await dbRun(
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
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('update-customer', async (_e, arg1, arg2) => {
    const id = Number(typeof arg1 === 'object' ? arg1.id : arg1);
    const c = typeof arg1 === 'object' ? arg1 : arg2 || {};
    if (await isLanClientMode()) return lanClient.updateCustomer(id, c);

    await dbRun(
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
    return { success: true, id };
  });

  ipcMain.handle('delete-customer', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteCustomer(id);
    await dbRun('DELETE FROM customers WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('get-customer-credit-summary', async (_e, customerId, excludeSaleId = null) => {
    if (await isLanClientMode()) return lanClient.getCustomerCreditSummary(customerId, excludeSaleId);
    const cid = Number(customerId);
    const cust = await dbGet('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL', [cid]);
    if (!cust) return null;

    const salesDebtRow = await dbGet(
      `SELECT COALESCE(SUM(total - paid_amount), 0) AS sales_debt
       FROM sales
       WHERE customer_id = ? AND deleted_at IS NULL AND (? IS NULL OR id <> ?)`,
      [cid, excludeSaleId, excludeSaleId]
    );

    const initDebt = Math.max(0, Number(cust.initial_debt || 0) - Number(cust.initial_debt_paid || 0));
    const currentDebt = Number((initDebt + Number((salesDebtRow && salesDebtRow.sales_debt) || 0)).toFixed(2));
    const creditLimit = Number(cust.credit_limit || 0);

    return {
      customer_id: cid,
      name: cust.name,
      current_debt: currentDebt,
      credit_limit: creditLimit,
      available_credit: creditLimit > 0 ? Math.max(0, Number((creditLimit - currentDebt).toFixed(2))) : null,
      exceeded: creditLimit > 0 && currentDebt > creditLimit
    };
  });

  ipcMain.handle('get-customer-sales', async (_e, customerId) => {
    if (await isLanClientMode()) return lanClient.getCustomerSales(customerId);
    return await dbAll(
      'SELECT * FROM sales WHERE customer_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [Number(customerId)]
    );
  });

  ipcMain.handle('add-customer-payment', async (_e, customerId, amount, date, meta = {}) => {
    if (await isLanClientMode()) return lanClient.addCustomerPayment(customerId, amount, date, meta);
    const cid = Number(customerId);
    let remainingAmt = Number(amount || 0);
    const payDate = date || new Date().toISOString();
    const receiptNum = await generateNextDocNumber('payment_receipt');

    return await db.withTransaction(async () => {
      const cust = await dbGet('SELECT * FROM customers WHERE id = ?', [cid]);
      if (cust) {
        const initRem = Math.max(0, Number(cust.initial_debt || 0) - Number(cust.initial_debt_paid || 0));
        if (initRem > 0 && remainingAmt > 0) {
          const takeInit = Math.min(initRem, remainingAmt);
          await dbRun(
            'UPDATE customers SET initial_debt_paid = COALESCE(initial_debt_paid, 0) + ? WHERE id = ?',
            [takeInit, cid]
          );
          remainingAmt = Number((remainingAmt - takeInit).toFixed(2));
        }
      }

      const unpaidSales = await dbAll(
        'SELECT id, total, paid_amount FROM sales WHERE customer_id = ? AND (total - paid_amount) > 0.009 AND deleted_at IS NULL ORDER BY sale_date ASC, id ASC',
        [cid]
      );

      for (const s of unpaidSales) {
        if (remainingAmt <= 0.009) break;
        const due = Number((Number(s.total) - Number(s.paid_amount)).toFixed(2));
        const apply = Math.min(due, remainingAmt);
        await dbRun('UPDATE sales SET paid_amount = paid_amount + ? WHERE id = ?', [apply, s.id]);
        remainingAmt = Number((remainingAmt - apply).toFixed(2));
      }

      const ins = await dbRun(
        `INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method, reference, receipt_number, notes)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cid,
          Number(amount || 0),
          payDate,
          meta.payment_method || 'cash',
          meta.reference || null,
          receiptNum,
          meta.notes || null
        ]
      );

      const activeSess = await tillLedger.resolveOpenSession(db, null, meta.userId);
      if (activeSess && (!meta.payment_method || meta.payment_method === 'cash')) {
        await dbRun(
          `INSERT INTO caisse_transactions (session_id, type, amount, category, description, reference_id)
           VALUES (?, 'debt_payment', ?, 'sales', ?, ?)`,
          [activeSess, Number(amount || 0), `تسديد دين زبون #${cid}`, ins.lastID]
        );
      }

      return { success: true, paymentId: ins.lastID, receiptNumber: receiptNum };
    });
  });

  ipcMain.handle('get-payment-details', async (_e, paymentId, type = 'sale') => {
    if (await isLanClientMode()) return lanClient.getPaymentDetails(paymentId, type);
    const isSale = type !== 'invoice' && type !== 'purchase';
    const table = isSale ? 'sale_payments' : 'invoice_payments';
    const partyTable = isSale ? 'customers' : 'suppliers';
    const partyFk = isSale ? 'customer_id' : 'supplier_id';
    const docTable = isSale ? 'sales' : 'purchase_invoices';

    const payment = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [Number(paymentId)]);
    if (!payment) return null;

    const party = payment[partyFk]
      ? await dbGet(`SELECT * FROM ${partyTable} WHERE id = ?`, [payment[partyFk]])
      : null;

    let currentDebt = 0;
    if (party) {
      const docsRow = await dbGet(
        `SELECT COALESCE(SUM(total - paid_amount), 0) AS d FROM ${docTable} WHERE ${partyFk} = ? AND deleted_at IS NULL`,
        [party.id]
      );
      const initRem = Math.max(0, Number(party.initial_debt || 0) - Number(party.initial_debt_paid || 0));
      currentDebt = Number((initRem + Number((docsRow && docsRow.d) || 0)).toFixed(2));
    }

    const amt = Number(payment.amount || 0);
    return {
      ...payment,
      party_name: party ? party.name : '',
      party_phone: party ? party.phone : '',
      party,
      debt_after: currentDebt,
      debt_before: Number((currentDebt + amt).toFixed(2))
    };
  });

  ipcMain.handle('next-doc-number', async (_e, docType) => {
    if (await isLanClientMode()) return lanClient.nextDocNumber(docType);
    return await generateNextDocNumber(docType);
  });

  ipcMain.handle('log-document-print', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.logDocumentPrint(payload);
    await dbRun(
      'INSERT INTO document_print_log (doc_type, doc_id, doc_number, user_id, printer_name, copies) VALUES (?, ?, ?, ?, ?, ?)',
      [
        payload.doc_type || 'invoice',
        payload.doc_id || null,
        payload.doc_number || null,
        payload.user_id || null,
        payload.printer_name || null,
        Number(payload.copies || 1)
      ]
    );
    return { success: true };
  });

  ipcMain.handle('issue-credit-note', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.issueCreditNote(payload);
    const saleId = Number(payload.saleId || payload.sale_id);
    const creditNoteNumber = payload.creditNoteNumber || (await generateNextDocNumber('avoir'));
    const nowIso = new Date().toISOString();
    await dbRun(
      'UPDATE sales SET credit_note_number = ?, credit_note_issued_at = ?, credit_note_reason = ? WHERE id = ?',
      [creditNoteNumber, nowIso, payload.reason || null, saleId]
    );
    return { success: true, credit_note_number: creditNoteNumber };
  });

  ipcMain.handle('get-customer-sales-aggregated', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.getCustomerSalesAggregated(payload);
    const cid = Number(payload.customerId || payload.customer_id);
    const sales = await dbAll(
      'SELECT * FROM sales WHERE customer_id = ? AND deleted_at IS NULL ORDER BY sale_date ASC',
      [cid]
    );
    const items = await dbAll(
      `SELECT
         COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
         p.unit,
         SUM(si.quantity) AS total_qty,
         AVG(si.price) AS avg_price,
         SUM(si.subtotal) AS total_subtotal
       FROM sale_items si
       INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.customer_id = ? AND si.deleted_at IS NULL
       GROUP BY COALESCE(si.product_id, si.custom_product_name)`,
      [cid]
    );
    return { sales, items };
  });

  ipcMain.handle('get-sales-summary', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.getSalesSummary(payload);
    return await analyticsQueries.getAnalytics(db, payload);
  });

  // 5. الموردون، المشتريات، ومرتجعات الموردين
  ipcMain.handle('get-suppliers', async () => {
    if (await isLanClientMode()) return lanClient.getSuppliers();
    return await dbAll(
      `SELECT
         sup.*,
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
  });

  ipcMain.handle('add-supplier', async (_e, s = {}) => {
    if (await isLanClientMode()) return lanClient.addSupplier(s);
    const ins = await dbRun(
      'INSERT INTO suppliers (name, phone, address, rc, nif, ai, nis, initial_debt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        String(s.name || '').trim(),
        s.phone || null,
        s.address || null,
        s.rc || null,
        s.nif || null,
        s.ai || null,
        s.nis || null,
        Number(s.initial_debt ?? 0)
      ]
    );
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('update-supplier', async (_e, arg1, arg2) => {
    const id = Number(typeof arg1 === 'object' ? arg1.id : arg1);
    const s = typeof arg1 === 'object' ? arg1 : arg2 || {};
    if (await isLanClientMode()) return lanClient.updateSupplier(id, s);

    await dbRun(
      'UPDATE suppliers SET name = ?, phone = ?, address = ?, rc = ?, nif = ?, ai = ?, nis = ?, initial_debt = ? WHERE id = ?',
      [
        String(s.name || '').trim(),
        s.phone || null,
        s.address || null,
        s.rc || null,
        s.nif || null,
        s.ai || null,
        s.nis || null,
        Number(s.initial_debt ?? 0),
        id
      ]
    );
    return { success: true, id };
  });

  ipcMain.handle('delete-supplier', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteSupplier(id);
    await dbRun('DELETE FROM suppliers WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('get-supplier-purchases', async (_e, supplierId) => {
    if (await isLanClientMode()) return lanClient.getSupplierPurchases(supplierId);
    return await dbAll(
      'SELECT * FROM purchase_invoices WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [Number(supplierId)]
    );
  });

  ipcMain.handle('add-supplier-payment', async (_e, supplierId, amount, date, meta = {}) => {
    if (await isLanClientMode()) return lanClient.addSupplierPayment(supplierId, amount, date, meta);
    const sid = Number(supplierId);
    let rem = Number(amount || 0);
    const payDate = date || new Date().toISOString();
    const receiptNum = await generateNextDocNumber('payment_receipt');

    return await db.withTransaction(async () => {
      const sup = await dbGet('SELECT * FROM suppliers WHERE id = ?', [sid]);
      if (sup) {
        const initRem = Math.max(0, Number(sup.initial_debt || 0) - Number(sup.initial_debt_paid || 0));
        if (initRem > 0 && rem > 0) {
          const take = Math.min(initRem, rem);
          await dbRun(
            'UPDATE suppliers SET initial_debt_paid = COALESCE(initial_debt_paid, 0) + ? WHERE id = ?',
            [take, sid]
          );
          rem = Number((rem - take).toFixed(2));
        }
      }

      const openInvoices = await dbAll(
        'SELECT id, total, paid_amount FROM purchase_invoices WHERE supplier_id = ? AND (total - paid_amount) > 0.009 AND deleted_at IS NULL ORDER BY date ASC, id ASC',
        [sid]
      );
      for (const inv of openInvoices) {
        if (rem <= 0.009) break;
        const due = Number((Number(inv.total) - Number(inv.paid_amount)).toFixed(2));
        const apply = Math.min(due, rem);
        await dbRun('UPDATE purchase_invoices SET paid_amount = paid_amount + ? WHERE id = ?', [
          apply,
          inv.id
        ]);
        rem = Number((rem - apply).toFixed(2));
      }

      const ins = await dbRun(
        `INSERT INTO invoice_payments (invoice_id, supplier_id, amount, date, payment_method, reference, receipt_number, notes)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sid,
          Number(amount || 0),
          payDate,
          meta.payment_method || 'cash',
          meta.reference || null,
          receiptNum,
          meta.notes || null
        ]
      );

      return { success: true, paymentId: ins.lastID, receiptNumber: receiptNum };
    });
  });

  ipcMain.handle('get-purchases', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getPurchases(filters);
    return await dbAll(
      `SELECT pi.*, sup.name AS supplier_name, sup.phone AS supplier_phone
       FROM purchase_invoices pi
       LEFT JOIN suppliers sup ON sup.id = pi.supplier_id
       WHERE pi.deleted_at IS NULL
       ORDER BY pi.id DESC LIMIT 500`
    );
  });

  ipcMain.handle('save-purchase', async (_e, data = {}) => {
    if (await isLanClientMode()) return lanClient.savePurchase(data);
    const items = Array.isArray(data.items) ? data.items : [];
    const supplierId = data.supplier_id || data.supplierId ? Number(data.supplier_id || data.supplierId) : null;
    const subtotal = Number(data.subtotal ?? 0);
    const taxPercentage = Number(data.tax_percentage ?? 0);
    const additionalCosts = Number(data.additional_costs ?? 0);
    const total = Number(data.total ?? 0);
    const paidAmount = Number(data.paid_amount ?? 0);
    const invDate = data.date || new Date().toISOString().slice(0, 10);
    const invNumber = data.invoice_number || `ACH-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    return await db.withTransaction(async () => {
      const ins = await dbRun(
        `INSERT INTO purchase_invoices (
          invoice_number, supplier_id, subtotal, tax_percentage, additional_costs, total, paid_amount, due_date, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invNumber, supplierId, subtotal, taxPercentage, additionalCosts, total, paidAmount, data.due_date || null, invDate]
      );
      const invoiceId = ins.lastID;

      if (paidAmount > 0) {
        await dbRun(
          'INSERT INTO invoice_payments (invoice_id, supplier_id, amount, date, payment_method) VALUES (?, ?, ?, ?, ?)',
          [invoiceId, supplierId, paidAmount, invDate, 'cash']
        );
      }

      for (const it of items) {
        const pid = Number(it.product_id || it.productId);
        const qty = Number(it.quantity ?? 1);
        const costPrice = Number(it.cost_price ?? 0);
        const sellPrice = Number(it.selling_price ?? 0);
        const batchIns = await dbRun(
          `INSERT INTO inventory_batches (
            product_id, variant_id, stock, cost_price, selling_price, wholesale_price, expiry_date, location, supplier_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pid,
            it.variant_id || null,
            qty,
            costPrice,
            sellPrice,
            it.wholesale_price || null,
            it.expiry_date || null,
            it.location || null,
            supplierId
          ]
        );

        await dbRun(
          `INSERT INTO purchase_items (
            invoice_id, product_id, batch_id, variant_id, quantity, cost_price, selling_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [invoiceId, pid, batchIns.lastID, it.variant_id || null, qty, costPrice, sellPrice, Number((qty * costPrice).toFixed(2))]
        );

        await batchAlloc.reconcileStockDebt(db, pid, batchIns.lastID);
      }

      return { success: true, id: invoiceId, invoice_number: invNumber };
    });
  });

  ipcMain.handle('get-invoice-details', async (_e, invoiceId) => {
    if (await isLanClientMode()) return lanClient.getInvoiceDetails(invoiceId);
    const id = Number(invoiceId);
    const inv = await dbGet(
      `SELECT pi.*, sup.name AS supplier_name, sup.phone AS supplier_phone, sup.address AS supplier_address
       FROM purchase_invoices pi
       LEFT JOIN suppliers sup ON sup.id = pi.supplier_id
       WHERE pi.id = ? AND pi.deleted_at IS NULL`,
      [id]
    );
    if (!inv) return null;

    inv.items = await dbAll(
      `SELECT pit.*, p.name AS product_name, p.barcode AS product_barcode, p.unit AS product_unit
       FROM purchase_items pit
       LEFT JOIN products p ON p.id = pit.product_id
       WHERE pit.invoice_id = ? AND pit.deleted_at IS NULL`,
      [id]
    );
    inv.payments = await dbAll(
      'SELECT * FROM invoice_payments WHERE invoice_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [id]
    );
    return inv;
  });

  ipcMain.handle('add-invoice-payment', async (_e, invoiceId, amount, date, meta = {}) => {
    if (await isLanClientMode()) return lanClient.addInvoicePayment(invoiceId, amount, date, meta);
    const id = Number(invoiceId);
    const amt = Number(amount || 0);
    const inv = await dbGet('SELECT * FROM purchase_invoices WHERE id = ?', [id]);
    if (!inv) throw new Error('فاتورة الشراء غير موجودة');

    const receiptNum = await generateNextDocNumber('payment_receipt');
    await dbRun('UPDATE purchase_invoices SET paid_amount = COALESCE(paid_amount, 0) + ? WHERE id = ?', [amt, id]);
    const ins = await dbRun(
      'INSERT INTO invoice_payments (invoice_id, supplier_id, amount, date, payment_method, receipt_number) VALUES (?, ?, ?, ?, ?, ?)',
      [id, inv.supplier_id, amt, date || new Date().toISOString(), meta.payment_method || 'cash', receiptNum]
    );
    return { success: true, paymentId: ins.lastID, receiptNumber: receiptNum };
  });

  ipcMain.handle('delete-purchase', async (_e, invoiceId) => {
    if (await isLanClientMode()) return lanClient.deletePurchase(invoiceId);
    const id = Number(invoiceId);
    const items = await dbAll('SELECT batch_id FROM purchase_items WHERE invoice_id = ? AND deleted_at IS NULL', [id]);
    const batchIds = items.map((x) => x.batch_id).filter(Boolean);
    if (batchIds.length > 0) await batchAlloc.voidBatches(db, batchIds);
    await dbRun('DELETE FROM invoice_payments WHERE invoice_id = ?', [id]);
    await dbRun('DELETE FROM purchase_items WHERE invoice_id = ?', [id]);
    await dbRun('DELETE FROM purchase_invoices WHERE id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('get-supplier-returnable-items', async (_e, supplierId) => {
    if (await isLanClientMode()) return lanClient.getSupplierReturnableItems(supplierId);
    return await dbAll(
      `SELECT ib.*, p.name AS product_name, p.barcode, p.unit
       FROM inventory_batches ib
       INNER JOIN products p ON p.id = ib.product_id
       WHERE ib.supplier_id = ? AND ib.stock > 0 AND ib.deleted_at IS NULL`,
      [Number(supplierId)]
    );
  });

  ipcMain.handle('save-supplier-return', async (_e, data = {}) => {
    if (await isLanClientMode()) return lanClient.saveSupplierReturn(data);
    const returnNum = data.return_number || (await generateNextDocNumber('supplier_return'));
    const items = Array.isArray(data.items) ? data.items : [];
    const total = Number(data.total ?? 0);

    return await db.withTransaction(async () => {
      const ins = await dbRun(
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
          await dbRun('UPDATE inventory_batches SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id = ?', [
            qty,
            Number(it.batch_id)
          ]);
        }
        await dbRun(
          `INSERT INTO supplier_return_items (
            return_id, product_id, variant_id, batch_id, quantity, cost_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            returnId,
            Number(it.product_id),
            it.variant_id || null,
            it.batch_id || null,
            qty,
            Number(it.cost_price ?? 0),
            Number((qty * Number(it.cost_price ?? 0)).toFixed(2))
          ]
        );
      }
      return { success: true, id: returnId, return_number: returnNum };
    });
  });

  ipcMain.handle('get-supplier-returns', async () => {
    if (await isLanClientMode()) return lanClient.getSupplierReturns();
    return await dbAll(
      `SELECT sr.*, sup.name AS supplier_name
       FROM supplier_returns sr
       LEFT JOIN suppliers sup ON sup.id = sr.supplier_id
       WHERE sr.deleted_at IS NULL ORDER BY sr.id DESC`
    );
  });

  ipcMain.handle('get-supplier-return-details', async (_e, returnId) => {
    if (await isLanClientMode()) return lanClient.getSupplierReturnDetails(returnId);
    const id = Number(returnId);
    const head = await dbGet('SELECT * FROM supplier_returns WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!head) return null;
    head.items = await dbAll(
      `SELECT sri.*, p.name AS product_name, p.barcode
       FROM supplier_return_items sri
       LEFT JOIN products p ON p.id = sri.product_id
       WHERE sri.return_id = ? AND sri.deleted_at IS NULL`,
      [id]
    );
    return head;
  });

  ipcMain.handle('delete-supplier-return', async (_e, returnId) => {
    if (await isLanClientMode()) return lanClient.deleteSupplierReturn(returnId);
    await dbRun('DELETE FROM supplier_return_items WHERE return_id = ?', [Number(returnId)]);
    await dbRun('DELETE FROM supplier_returns WHERE id = ?', [Number(returnId)]);
    return { success: true };
  });

  // 6. الفواتير الشكلية (Proformas) والطلبيات (Customer Orders)
  ipcMain.handle('create-proforma', async (_e, d = {}) => {
    if (await isLanClientMode()) return lanClient.createProforma(d);
    const docNum = d.doc_number || (await generateNextDocNumber('proforma'));
    const items = Array.isArray(d.items) ? d.items : [];
    return await db.withTransaction(async () => {
      const ins = await dbRun(
        `INSERT INTO proforma_invoices (
          doc_number, customer_id, subtotal, tax_percentage, discount, total, validity_days, notes, status, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          docNum,
          d.customer_id || null,
          Number(d.subtotal ?? 0),
          Number(d.tax_percentage ?? 0),
          Number(d.discount ?? 0),
          Number(d.total ?? 0),
          Number(d.validity_days ?? 15),
          d.notes || null,
          d.user_id || null
        ]
      );
      const pid = ins.lastID;
      for (const it of items) {
        await dbRun(
          `INSERT INTO proforma_items (proforma_id, product_id, batch_id, variant_id, quantity, price, subtotal, custom_product_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pid,
            it.product_id || null,
            it.batch_id || null,
            it.variant_id || null,
            Number(it.quantity ?? 1),
            Number(it.price ?? 0),
            Number(it.subtotal ?? 0),
            it.custom_product_name || it.name || null
          ]
        );
      }
      return { success: true, id: pid, doc_number: docNum };
    });
  });

  ipcMain.handle('get-proformas', async () => {
    if (await isLanClientMode()) return lanClient.getProformas();
    return await dbAll(
      `SELECT pf.*, c.name AS customer_name, c.phone AS customer_phone
       FROM proforma_invoices pf
       LEFT JOIN customers c ON c.id = pf.customer_id
       WHERE pf.deleted_at IS NULL ORDER BY pf.id DESC`
    );
  });

  ipcMain.handle('get-proforma-details', async (_e, proformaId) => {
    if (await isLanClientMode()) return lanClient.getProformaDetails(proformaId);
    const id = Number(proformaId);
    const pf = await dbGet(
      `SELECT pf.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
              c.rc AS customer_rc, c.nif AS customer_nif
       FROM proforma_invoices pf
       LEFT JOIN customers c ON c.id = pf.customer_id
       WHERE pf.id = ? AND pf.deleted_at IS NULL`,
      [id]
    );
    if (!pf) return null;
    pf.items = await dbAll(
      `SELECT pfi.*, COALESCE(p.name, pfi.custom_product_name, 'منتج') AS product_name, p.barcode, p.unit
       FROM proforma_items pfi
       LEFT JOIN products p ON p.id = pfi.product_id
       WHERE pfi.proforma_id = ? AND pfi.deleted_at IS NULL`,
      [id]
    );
    return pf;
  });

  ipcMain.handle('update-proforma', async (_e, id, d = {}) => {
    if (await isLanClientMode()) return lanClient.updateProforma(id, d);
    const pid = Number(id);
    await dbRun(
      'UPDATE proforma_invoices SET customer_id = ?, subtotal = ?, tax_percentage = ?, discount = ?, total = ?, validity_days = ?, notes = ? WHERE id = ?',
      [d.customer_id || null, Number(d.subtotal ?? 0), Number(d.tax_percentage ?? 0), Number(d.discount ?? 0), Number(d.total ?? 0), Number(d.validity_days ?? 15), d.notes || null, pid]
    );
    return { success: true, id: pid };
  });

  ipcMain.handle('delete-proforma', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteProforma(id);
    await dbRun('DELETE FROM proforma_items WHERE proforma_id = ?', [Number(id)]);
    await dbRun('DELETE FROM proforma_invoices WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('cancel-proforma', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.cancelProforma(id);
    await dbRun("UPDATE proforma_invoices SET status = 'cancelled' WHERE id = ?", [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('proforma-to-sale-payload', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.proformaToSalePayload(id);
    return await dbGet('SELECT * FROM proforma_invoices WHERE id = ?', [Number(id)]);
  });

  ipcMain.handle('mark-proforma-converted', async (_e, id, saleId) => {
    if (await isLanClientMode()) return lanClient.markProformaConverted(id, saleId);
    await dbRun("UPDATE proforma_invoices SET status = 'converted', converted_to_sale_id = ? WHERE id = ?", [
      Number(saleId),
      Number(id)
    ]);
    return { success: true };
  });

  ipcMain.handle('create-order', async (_e, d = {}) => {
    if (await isLanClientMode()) return lanClient.createOrder(d);
    const docNum = d.doc_number || (await generateNextDocNumber('order'));
    const items = Array.isArray(d.items) ? d.items : [];
    const deposit = Number(d.deposit_amount ?? 0);

    return await db.withTransaction(async () => {
      const ins = await dbRun(
        `INSERT INTO customer_orders (
          doc_number, customer_id, subtotal, tax_percentage, discount, total,
          deposit_amount, expected_delivery_date, notes, status, reserves_stock, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          docNum,
          d.customer_id || null,
          Number(d.subtotal ?? 0),
          Number(d.tax_percentage ?? 0),
          Number(d.discount ?? 0),
          Number(d.total ?? 0),
          deposit,
          d.expected_delivery_date || null,
          d.notes || null,
          d.reserves_stock !== undefined ? (d.reserves_stock ? 1 : 0) : 1,
          d.user_id || null
        ]
      );
      const oid = ins.lastID;
      for (const it of items) {
        await dbRun(
          `INSERT INTO customer_order_items (order_id, product_id, batch_id, variant_id, quantity, price, subtotal, custom_product_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            oid,
            it.product_id || null,
            it.batch_id || null,
            it.variant_id || null,
            Number(it.quantity ?? 1),
            Number(it.price ?? 0),
            Number(it.subtotal ?? 0),
            it.custom_product_name || it.name || null
          ]
        );
      }

      if (deposit > 0) {
        const activeSess = await tillLedger.resolveOpenSession(db, null, d.user_id);
        if (activeSess) {
          await dbRun(
            `INSERT INTO caisse_transactions (session_id, type, amount, category, description, reference_id)
             VALUES (?, 'order_deposit', ?, 'orders', ?, ?)`,
            [activeSess, deposit, `عربون طلبية #${docNum}`, oid]
          );
        }
      }
      return { success: true, id: oid, doc_number: docNum };
    });
  });

  ipcMain.handle('get-orders', async () => {
    if (await isLanClientMode()) return lanClient.getOrders();
    return await dbAll(
      `SELECT co.*, c.name AS customer_name, c.phone AS customer_phone
       FROM customer_orders co
       LEFT JOIN customers c ON c.id = co.customer_id
       WHERE co.deleted_at IS NULL ORDER BY co.id DESC`
    );
  });

  ipcMain.handle('get-order-details', async (_e, orderId) => {
    if (await isLanClientMode()) return lanClient.getOrderDetails(orderId);
    const id = Number(orderId);
    const ord = await dbGet(
      `SELECT co.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
       FROM customer_orders co
       LEFT JOIN customers c ON c.id = co.customer_id
       WHERE co.id = ? AND co.deleted_at IS NULL`,
      [id]
    );
    if (!ord) return null;
    ord.items = await dbAll(
      `SELECT coi.*, COALESCE(p.name, coi.custom_product_name, 'منتج') AS product_name, p.barcode, p.unit
       FROM customer_order_items coi
       LEFT JOIN products p ON p.id = coi.product_id
       WHERE coi.order_id = ? AND coi.deleted_at IS NULL`,
      [id]
    );
    return ord;
  });

  ipcMain.handle('update-order', async (_e, id, d = {}) => {
    if (await isLanClientMode()) return lanClient.updateOrder(id, d);
    await dbRun(
      'UPDATE customer_orders SET deposit_amount = ?, expected_delivery_date = ?, notes = ?, status = COALESCE(?, status) WHERE id = ?',
      [Number(d.deposit_amount ?? 0), d.expected_delivery_date || null, d.notes || null, d.status || null, Number(id)]
    );
    return { success: true };
  });

  ipcMain.handle('delete-order', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteOrder(id);
    await dbRun('DELETE FROM customer_order_items WHERE order_id = ?', [Number(id)]);
    await dbRun('DELETE FROM customer_orders WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('cancel-order', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.cancelOrder(id);
    await dbRun("UPDATE customer_orders SET status = 'cancelled' WHERE id = ?", [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('order-to-sale-payload', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.orderToSalePayload(id);
    return await dbGet('SELECT * FROM customer_orders WHERE id = ?', [Number(id)]);
  });

  ipcMain.handle('mark-order-delivered', async (_e, id, saleId) => {
    if (await isLanClientMode()) return lanClient.markOrderDelivered(id, saleId);
    await dbRun("UPDATE customer_orders SET status = 'delivered', converted_to_sale_id = ? WHERE id = ?", [
      Number(saleId),
      Number(id)
    ]);
    return { success: true };
  });

  // 7. الخزينة والمناوبات، المصاريف، رأس المال، الباقات، والعروض
  ipcMain.handle('open-caisse-session', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.openCaisseSession(payload);
    const userId =
      typeof payload === 'object' ? payload.userId || payload.user_id : Number(payload);
    const openingBalance =
      typeof payload === 'object' ? Number(payload.openingBalance ?? payload.opening_balance ?? 0) : 0;
    const deviceId = await getSetting('instance_id', 'local');

    const ins = await dbRun(
      `INSERT INTO caisse_sessions (user_id, device_id, opening_balance, status, opened_at)
       VALUES (?, ?, ?, 'open', CURRENT_TIMESTAMP)`,
      [userId || null, deviceId, openingBalance]
    );
    return await tillLedger.computeSessionSummary(db, ins.lastID);
  });

  ipcMain.handle('close-caisse-session', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.closeCaisseSession(payload);
    const sessionId = Number(payload.sessionId || payload.session_id || payload.id);
    const closingBalance = Number(payload.closingBalance ?? payload.closing_balance ?? 0);
    const closeNote = payload.closeNote || payload.close_note || payload.note || null;

    const info = await tillLedger.computeSessionSummary(db, sessionId);
    const expected = info ? info.summary.expectedBalance : 0;
    const diff = Number((closingBalance - expected).toFixed(2));

    await dbRun(
      `UPDATE caisse_sessions
       SET closing_balance = ?, expected_balance = ?, difference = ?,
           status = 'closed', closed_at = CURRENT_TIMESTAMP, close_note = ?
       WHERE id = ?`,
      [closingBalance, expected, diff, closeNote, sessionId]
    );
    return { success: true, sessionId, expectedBalance: expected, closingBalance, difference: diff };
  });

  ipcMain.handle('get-active-session', async (_e, userId) => {
    if (await isLanClientMode()) return lanClient.getActiveSession(userId);
    const uid = typeof userId === 'object' && userId !== null ? userId.userId : userId;
    const deviceId = await getSetting('instance_id', 'local');
    const sessId = await tillLedger.resolveOpenSession(db, null, uid, deviceId);
    if (!sessId) return null;
    return await tillLedger.computeSessionSummary(db, sessId);
  });

  ipcMain.handle('get-caisse-sessions', async () => {
    if (await isLanClientMode()) return lanClient.getCaisseSessions();
    return await dbAll(
      `SELECT cs.*, u.name AS user_name
       FROM caisse_sessions cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.deleted_at IS NULL
       ORDER BY cs.id DESC LIMIT 200`
    );
  });

  ipcMain.handle('get-session-details', async (_e, sessionId) => {
    if (await isLanClientMode()) return lanClient.getSessionDetails(sessionId);
    return await tillLedger.computeSessionSummary(db, sessionId);
  });

  ipcMain.handle('add-caisse-transaction', async (_e, tx = {}) => {
    if (await isLanClientMode()) return lanClient.addCaisseTransaction(tx);
    const sessId =
      tx.session_id || tx.sessionId || (await tillLedger.resolveOpenSession(db, null, tx.user_id));
    if (!sessId) throw new Error('لا توجد مناوبة صندوق مفتوحة حالياً');

    const ins = await dbRun(
      `INSERT INTO caisse_transactions (session_id, type, amount, category, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Number(sessId),
        tx.type || 'cash_in',
        Math.abs(Number(tx.amount || 0)),
        tx.category || 'عام',
        tx.description || null
      ]
    );
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('get-caisse-summary', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getCaisseSummary(filters);
    const sessId = await tillLedger.resolveOpenSession(db, filters.sessionId, filters.userId);
    if (!sessId) return null;
    return await tillLedger.computeSessionSummary(db, sessId);
  });

  ipcMain.handle('get-caisse-transactions-log', async () => {
    if (await isLanClientMode()) return lanClient.getCaisseTransactionsLog();
    return await dbAll(
      `SELECT ct.*, u.name AS user_name
       FROM caisse_transactions ct
       LEFT JOIN caisse_sessions cs ON cs.id = ct.session_id
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE ct.deleted_at IS NULL
       ORDER BY ct.id DESC LIMIT 300`
    );
  });

  ipcMain.handle('get-expenses', async () => {
    if (await isLanClientMode()) return lanClient.getExpenses();
    return await dbAll('SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY id DESC');
  });

  ipcMain.handle('add-expense', async (_e, exp = {}) => {
    if (await isLanClientMode()) return lanClient.addExpense(exp);
    const amt = Number(exp.amount || 0);
    const ins = await dbRun(
      'INSERT INTO expenses (category, description, amount, date, user_id, session_id) VALUES (?, ?, ?, ?, ?, ?)',
      [
        exp.category || 'عام',
        exp.description || null,
        amt,
        exp.date || new Date().toISOString().slice(0, 10),
        exp.user_id || null,
        exp.session_id || null
      ]
    );
    if (exp.deductFromCaisse || exp.session_id) {
      const sessId = await tillLedger.resolveOpenSession(db, exp.session_id, exp.user_id);
      if (sessId) {
        await dbRun(
          `INSERT INTO caisse_transactions (session_id, type, amount, category, description, reference_id)
           VALUES (?, 'expense', ?, ?, ?, ?)`,
          [sessId, amt, exp.category || 'عام', exp.description || 'مصروف', ins.lastID]
        );
      }
    }
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('delete-expense', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteExpense(id);
    await dbRun("DELETE FROM caisse_transactions WHERE reference_id = ? AND type = 'expense'", [Number(id)]);
    await dbRun('DELETE FROM expenses WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('get-capital', async () => {
    if (await isLanClientMode()) return lanClient.getCapital();
    return await dbAll('SELECT * FROM capital_injections WHERE deleted_at IS NULL ORDER BY id DESC');
  });

  ipcMain.handle('add-capital', async (_e, cap = {}) => {
    if (await isLanClientMode()) return lanClient.addCapital(cap);
    const ins = await dbRun(
      'INSERT INTO capital_injections (category, description, amount, date) VALUES (?, ?, ?, ?)',
      [
        cap.category || 'إيداع رأس مال',
        cap.description || null,
        Number(cap.amount || 0),
        cap.date || new Date().toISOString().slice(0, 10)
      ]
    );
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('delete-capital', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteCapital(id);
    await dbRun('DELETE FROM capital_injections WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('get-bundles', async () => {
    if (await isLanClientMode()) return lanClient.getBundles();
    const bundles = await dbAll('SELECT * FROM product_bundles WHERE deleted_at IS NULL ORDER BY id DESC');
    for (const b of bundles) {
      b.items = await dbAll(
        `SELECT bi.*, p.name AS product_name, p.barcode, p.unit,
                COALESCE((SELECT SUM(ib.stock) FROM inventory_batches ib WHERE ib.product_id = bi.product_id AND ib.deleted_at IS NULL), 0) AS product_stock
         FROM bundle_items bi
         LEFT JOIN products p ON p.id = bi.product_id
         WHERE bi.bundle_id = ? AND bi.deleted_at IS NULL`,
        [b.id]
      );
    }
    return bundles;
  });

  ipcMain.handle('get-bundle-details', async (_e, bundleId) => {
    if (await isLanClientMode()) return lanClient.getBundleDetails(bundleId);
    const b = await dbGet('SELECT * FROM product_bundles WHERE id = ? AND deleted_at IS NULL', [Number(bundleId)]);
    if (!b) return null;
    b.items = await dbAll(
      `SELECT bi.*, p.name AS product_name, p.barcode, p.unit
       FROM bundle_items bi
       LEFT JOIN products p ON p.id = bi.product_id
       WHERE bi.bundle_id = ? AND bi.deleted_at IS NULL`,
      [b.id]
    );
    return b;
  });

  ipcMain.handle('save-bundle', async (_e, data = {}) => {
    if (await isLanClientMode()) return lanClient.saveBundle(data);
    const items = Array.isArray(data.items) ? data.items : [];
    const barcode = data.barcode ? String(data.barcode).trim() : null;
    if (barcode) await productWriter.freeTombstonedProductBarcode(barcode);

    return await db.withTransaction(async () => {
      let bid = data.id ? Number(data.id) : null;
      if (bid) {
        await dbRun(
          'UPDATE product_bundles SET name = ?, barcode = ?, selling_price = ?, cost_price = ?, description = ?, is_active = ? WHERE id = ?',
          [
            String(data.name || '').trim(),
            barcode,
            Number(data.selling_price ?? 0),
            Number(data.cost_price ?? 0),
            data.description || null,
            data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
            bid
          ]
        );
        await dbRun('DELETE FROM bundle_items WHERE bundle_id = ?', [bid]);
      } else {
        const ins = await dbRun(
          'INSERT INTO product_bundles (name, barcode, selling_price, cost_price, description, is_active) VALUES (?, ?, ?, ?, ?, 1)',
          [
            String(data.name || '').trim(),
            barcode,
            Number(data.selling_price ?? 0),
            Number(data.cost_price ?? 0),
            data.description || null
          ]
        );
        bid = ins.lastID;
      }

      for (const it of items) {
        await dbRun('INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES (?, ?, ?)', [
          bid,
          Number(it.product_id || it.productId),
          Number(it.quantity ?? 1)
        ]);
      }
      return { success: true, id: bid };
    });
  });

  ipcMain.handle('delete-bundle', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteBundle(id);
    await dbRun('DELETE FROM bundle_items WHERE bundle_id = ?', [Number(id)]);
    await dbRun('DELETE FROM product_bundles WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  ipcMain.handle('set-bundle-active', async (_e, id, isActive) => {
    if (await isLanClientMode()) return lanClient.setBundleActive(id, isActive);
    await dbRun('UPDATE product_bundles SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, Number(id)]);
    return { success: true };
  });

  ipcMain.handle('get-promotions', async () => {
    if (await isLanClientMode()) return lanClient.getPromotions();
    return await dbAll(
      `SELECT prm.*, p.name AS product_name, p.barcode AS product_barcode
       FROM product_promotions prm
       LEFT JOIN products p ON p.id = prm.product_id
       WHERE prm.deleted_at IS NULL ORDER BY prm.id DESC`
    );
  });

  ipcMain.handle('save-promotion', async (_e, p = {}) => {
    if (await isLanClientMode()) return lanClient.savePromotion(p);
    if (p.id) {
      await dbRun(
        `UPDATE product_promotions
         SET product_id = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, max_qty = ?, is_active = ?
         WHERE id = ?`,
        [
          Number(p.product_id),
          p.discount_type || 'percentage',
          Number(p.discount_value ?? 0),
          p.start_date || new Date().toISOString().slice(0, 10),
          p.end_date || null,
          p.max_qty ? Number(p.max_qty) : null,
          p.is_active !== undefined ? (p.is_active ? 1 : 0) : 1,
          Number(p.id)
        ]
      );
      return { success: true, id: Number(p.id) };
    }
    const ins = await dbRun(
      `INSERT INTO product_promotions (product_id, discount_type, discount_value, start_date, end_date, max_qty, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        Number(p.product_id),
        p.discount_type || 'percentage',
        Number(p.discount_value ?? 0),
        p.start_date || new Date().toISOString().slice(0, 10),
        p.end_date || null,
        p.max_qty ? Number(p.max_qty) : null
      ]
    );
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('delete-promotion', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deletePromotion(id);
    await dbRun('DELETE FROM product_promotions WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  // 8. التصنيع (BOM) والجرد المخزني (Stocktake)
  ipcMain.handle('get-bom-recipes', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getBomRecipes(filters);
    return await productionGuard.listRecipes(db, filters);
  });
  ipcMain.handle('get-bom-recipe', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.getBomRecipe(id);
    return await productionGuard.loadRecipeWithComponents(db, id);
  });
  ipcMain.handle('save-bom-recipe', async (_e, data) => {
    if (await isLanClientMode()) return lanClient.saveBomRecipe(data);
    return await productionGuard.saveRecipe(db, data);
  });
  ipcMain.handle('delete-bom-recipe', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteBomRecipe(id);
    return await productionGuard.deleteRecipe(db, id);
  });
  ipcMain.handle('get-recipe-availability', async (_e, payload) => {
    if (await isLanClientMode()) return lanClient.getRecipeAvailability(payload);
    return await productionGuard.computeRecipeAvailability(db, payload);
  });
  ipcMain.handle('get-production-orders', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getProductionOrders(filters);
    return await productionGuard.listOrders(db, filters);
  });
  ipcMain.handle('get-production-order', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.getProductionOrder(id);
    return await productionGuard.getOrder(db, id);
  });
  ipcMain.handle('create-production-order', async (_e, payload) => {
    if (await isLanClientMode()) return lanClient.createProductionOrder(payload);
    return await productionGuard.createProductionOrder(db, payload);
  });
  ipcMain.handle('confirm-production-order', async (_e, payload) => {
    if (await isLanClientMode()) return lanClient.confirmProductionOrder(payload);
    return await productionGuard.confirmOrder(db, payload);
  });
  ipcMain.handle('reverse-production-order', async (_e, payload) => {
    if (await isLanClientMode()) return lanClient.reverseProductionOrder(payload);
    return await productionGuard.reverseOrder(db, payload);
  });
  ipcMain.handle('get-manufacturable-capacity', async (_e, payload) => {
    if (await isLanClientMode()) return lanClient.getManufacturableCapacity(payload);
    return await productionGuard.getManufacturableCapacity(db, payload);
  });
  ipcMain.handle('set-material-role', async (_e, payload) => {
    if (await isLanClientMode()) return lanClient.setMaterialRole(payload);
    return await productionGuard.setMaterialRole(db, payload);
  });

  ipcMain.handle('get-stocktake-sheet', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getStocktakeSheet(filters);
    return await stocktakeGuard.loadSheet(db, filters);
  });
  ipcMain.handle('get-stocktakes', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getStocktakes(filters);
    return await stocktakeGuard.listStocktakes(db, filters);
  });
  ipcMain.handle('get-stocktake', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.getStocktake(id);
    return await stocktakeGuard.getStocktake(db, id);
  });
  ipcMain.handle('create-stocktake', async (_e, payload) => {
    if (await isLanClientMode()) return lanClient.createStocktake(payload);
    return await stocktakeGuard.createStocktake(db, payload);
  });

  // 9. الإحصائيات، التنبيهات، ديون المخزون، والقوالب المخصصة
  ipcMain.handle('get-analytics', async (_e, params = {}) => {
    if (await isLanClientMode()) return lanClient.getAnalytics(params);
    return await analyticsQueries.getAnalytics(db, params);
  });
  ipcMain.handle('get-segment-analytics', async (_e, params = {}) => {
    if (await isLanClientMode()) return lanClient.getSegmentAnalytics(params);
    return await analyticsQueries.getSegmentAnalytics(db, params);
  });
  ipcMain.handle('get-segment-products', async (_e, params = {}) => {
    if (await isLanClientMode()) return lanClient.getSegmentProducts(params);
    return await analyticsQueries.getSegmentProducts(db, params);
  });
  ipcMain.handle('get-ai-copilot-insights', async () => {
    return await analyticsQueries.getAiCopilotInsights(db);
  });

  ipcMain.handle('get-notifications', async () => {
    if (await isLanClientMode()) return lanClient.getNotifications();
    const lowStock = await dbAll(
      `SELECT p.id, p.name, p.min_stock, COALESCE(SUM(ib.stock), 0) AS stock
       FROM products p
       LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.deleted_at IS NULL
       WHERE p.deleted_at IS NULL
       GROUP BY p.id
       HAVING stock <= COALESCE(p.min_stock, 5)
       LIMIT 50`
    );
    const expiring = await dbAll(
      `SELECT ib.id, p.name, ib.stock, ib.expiry_date
       FROM inventory_batches ib
       INNER JOIN products p ON p.id = ib.product_id AND p.deleted_at IS NULL
       WHERE ib.deleted_at IS NULL AND ib.stock > 0
         AND ib.expiry_date IS NOT NULL AND TRIM(ib.expiry_date) <> ''
         AND date(ib.expiry_date) <= date('now', '+30 days')
       ORDER BY date(ib.expiry_date) ASC LIMIT 50`
    );
    return { lowStock, expiring };
  });

  ipcMain.handle('get-stock-debt', async () => {
    if (await isLanClientMode()) return lanClient.getStockDebt();
    return await dbAll(
      `SELECT sd.*, p.name AS product_name, p.barcode, p.unit
       FROM stock_debt sd
       LEFT JOIN products p ON p.id = sd.product_id
       WHERE sd.resolved = 0 AND sd.deleted_at IS NULL
       ORDER BY sd.id DESC`
    );
  });

  ipcMain.handle('get-stock-debt-summary', async () => {
    if (await isLanClientMode()) return lanClient.getStockDebtSummary();
    const row = await dbGet(
      'SELECT COUNT(*) AS count, COALESCE(SUM(quantity), 0) AS total_qty FROM stock_debt WHERE resolved = 0 AND deleted_at IS NULL'
    );
    return {
      count: Number((row && row.count) || 0),
      total_qty: Number((row && row.total_qty) || 0)
    };
  });

  ipcMain.handle('get-custom-templates', async (_e, docType = null) => {
    if (await isLanClientMode()) return lanClient.getCustomTemplates(docType);
    if (docType) {
      return await dbAll(
        'SELECT * FROM custom_templates WHERE doc_type = ? AND deleted_at IS NULL ORDER BY id DESC',
        [docType]
      );
    }
    return await dbAll('SELECT * FROM custom_templates WHERE deleted_at IS NULL ORDER BY id DESC');
  });

  ipcMain.handle('get-custom-template', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.getCustomTemplate(id);
    return await dbGet('SELECT * FROM custom_templates WHERE id = ? AND deleted_at IS NULL', [Number(id)]);
  });

  ipcMain.handle('save-custom-template', async (_e, tpl = {}) => {
    if (await isLanClientMode()) return lanClient.saveCustomTemplate(tpl);
    const layoutJson =
      typeof tpl.layout_json === 'string' ? tpl.layout_json : JSON.stringify(tpl.layout || tpl.layout_json || {});

    if (tpl.id) {
      await dbRun(
        'UPDATE custom_templates SET name = ?, doc_type = ?, paper = ?, lang = ?, layout_json = ?, is_default = ? WHERE id = ?',
        [
          tpl.name || 'قالب مخصص',
          tpl.doc_type || 'invoice',
          tpl.paper || 'a4',
          tpl.lang || 'ar',
          layoutJson,
          tpl.is_default ? 1 : 0,
          Number(tpl.id)
        ]
      );
      return { success: true, id: Number(tpl.id) };
    }
    const ins = await dbRun(
      'INSERT INTO custom_templates (name, doc_type, paper, lang, layout_json, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [
        tpl.name || 'قالب مخصص',
        tpl.doc_type || 'invoice',
        tpl.paper || 'a4',
        tpl.lang || 'ar',
        layoutJson,
        tpl.is_default ? 1 : 0
      ]
    );
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('delete-custom-template', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.deleteCustomTemplate(id);
    await dbRun('DELETE FROM custom_templates WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  // 10. الطباعة الصامتة، PDF، الباركود، QR، الإكسل، والنسخ الاحتياطي
  ipcMain.handle('get-printers', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return [];
    try {
      return await mainWindow.webContents.getPrintersAsync();
    } catch (_) {
      return [];
    }
  });

  ipcMain.handle('print-silent', async (_e, options = {}) => {
    const htmlContent = options.html || options.content || '';
    if (!htmlContent) return { success: false, error: 'empty_html' };

    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true }
    });

    try {
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      await new Promise((r) => setTimeout(r, 350));

      return await new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: Boolean(options.silent ?? true),
            printBackground: true,
            deviceName: options.printerName || options.deviceName || undefined
          },
          (success, failureReason) => {
            printWin.close();
            resolve({ success, error: failureReason || null });
          }
        );
      });
    } catch (err) {
      printWin.close();
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('export-pdf', async (_e, options = {}) => {
    const htmlContent = options.html || options.content || '';
    const defaultName = options.filename || `Gherbi_Document_${Date.now()}.pdf`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { canceled: true };

    const pdfWin = new BrowserWindow({ show: false });
    try {
      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      await new Promise((r) => setTimeout(r, 350));
      const pdfBuf = await pdfWin.webContents.printToPDF({ printBackground: true });
      fs.writeFileSync(filePath, pdfBuf);
      pdfWin.close();
      return { success: true, filePath };
    } catch (err) {
      pdfWin.close();
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('open-cash-drawer', async () => {
    return { success: true };
  });

  ipcMain.handle('generate-barcode-image', async (_e, text, opts = {}) => {
    try {
      const png = await bwipjs.toBuffer({
        bcid: opts.bcid || 'code128',
        text: String(text || '00000000'),
        scale: opts.scale || 3,
        height: opts.height || 10,
        includetext: Boolean(opts.includetext ?? false)
      });
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('pairing-qr-dataurl', async () => {
    const ip = getPrimaryLocalIp();
    const payload = JSON.stringify({
      app: 'Gherbi.Ai POS',
      ip,
      port: activeServerPort,
      url: `http://${ip}:${activeServerPort}`
    });
    return await QRCode.toDataURL(payload, { margin: 1, width: 240 });
  });

  ipcMain.handle('export-db-backup', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `Gherbi_POS_Backup_${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'ZIP Backup', extensions: ['zip'] }]
    });
    if (canceled || !filePath) return { canceled: true };

    const zip = new AdmZip();
    if (fs.existsSync(db.dbPath)) {
      zip.addLocalFile(db.dbPath);
    }
    const imgDir = getImagesDir();
    if (fs.existsSync(imgDir)) {
      zip.addLocalFolder(imgDir, 'product_images');
    }
    zip.writeZip(filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('import-db-backup', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Backup File', extensions: ['zip', 'db'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const chosen = filePaths[0];
    if (chosen.toLowerCase().endsWith('.zip')) {
      const zip = new AdmZip(chosen);
      const tempDir = path.join(app.getPath('temp'), `gherbi_restore_${Date.now()}`);
      zip.extractAllTo(tempDir, true);
      const dbEntry = fs.readdirSync(tempDir).find((f) => f.endsWith('.db'));
      if (dbEntry) {
        fs.copyFileSync(path.join(tempDir, dbEntry), db.dbPath);
      }
    } else {
      fs.copyFileSync(chosen, db.dbPath);
    }
    return { success: true };
  });

  ipcMain.handle('export-products-excel', async () => {
    const rows = await dbAll('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY id ASC');
    const enriched = await enrichProductsFull(rows);
    const data = enriched.map((p) => ({
      barcode: p.barcode || '',
      name: p.name || '',
      category: p.category || '',
      family: p.family || '',
      supplier: p.supplier || '',
      cost_price: p.cost_price || 0,
      selling_price: p.selling_price || 0,
      wholesale_price: p.wholesale_price || '',
      stock: p.stock || 0,
      min_stock: p.min_stock || 5,
      unit: p.unit || 'قطعة',
      expiry_date: p.expiry_date || ''
    }));

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `Gherbi_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { canceled: true };

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('import-products-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const wb = XLSX.readFile(filePaths[0]);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    let imported = 0;

    await db.withTransaction(async () => {
      for (const r of rows) {
        const name = String(r.name || r['الاسم'] || r['اسم المنتج'] || '').trim();
        if (!name) continue;
        const barcode = String(r.barcode || r['الباركود'] || '').trim() || null;
        if (barcode) await productWriter.freeTombstonedProductBarcode(barcode);

        const ins = await dbRun(
          'INSERT INTO products (barcode, name, category, supplier, unit, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
          [
            barcode,
            name,
            String(r.category || r['الفئة'] || 'عام').trim(),
            String(r.supplier || r['المورد'] || '').trim() || null,
            String(r.unit || r['الوحدة'] || 'قطعة').trim(),
            Number(r.min_stock ?? 5)
          ]
        );
        await dbRun(
          'INSERT INTO inventory_batches (product_id, stock, cost_price, selling_price, wholesale_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
          [
            ins.lastID,
            Number(r.stock ?? r['الكمية'] ?? 0),
            Number(r.cost_price ?? r['سعر الشراء'] ?? 0),
            Number(r.selling_price ?? r['سعر البيع'] ?? 0),
            r.wholesale_price ? Number(r.wholesale_price) : null,
            r.expiry_date || null
          ]
        );
        imported += 1;
      }
    });
    return { success: true, imported };
  });

  ipcMain.handle('download-inventory-template', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'Gherbi_Inventory_Template.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        barcode: '6130000000012',
        name: 'منتج تجريبي',
        category: 'مواد غذائية',
        supplier: 'مورد عام',
        cost_price: 100,
        selling_price: 150,
        wholesale_price: 135,
        stock: 50,
        min_stock: 5,
        unit: 'قطعة'
      }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('export-sales-excel', async () => {
    const rows = await dbAll('SELECT * FROM sales WHERE deleted_at IS NULL ORDER BY id DESC');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `Gherbi_Sales_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sales');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('export-customers-excel', async () => {
    const rows = await dbAll('SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY id DESC');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'Gherbi_Customers.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Customers');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('export-suppliers-excel', async () => {
    const rows = await dbAll('SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY id DESC');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'Gherbi_Suppliers.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Suppliers');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('import-customers-excel', async () => ({ success: true }));
  ipcMain.handle('import-suppliers-excel', async () => ({ success: true }));
  ipcMain.handle('download-customers-template', async () => ({ success: true }));
  ipcMain.handle('download-suppliers-template', async () => ({ success: true }));

  ipcMain.handle('reset-system', async () => {
    const tablesToReset = db.SYNCED_TABLES.filter((t) => t !== 'users' && t !== 'shop_info');
    await stockLedger.withSkipStockLedger(db, async () => {
      for (const tbl of tablesToReset) {
        await db._rawRun(`DELETE FROM ${tbl}`);
      }
      await db._rawRun('DELETE FROM stock_movements');
    });
    return { success: true };
  });

  // 11. الميزان، الشبكة، المزامنة السحابية، والتراخيص
  ipcMain.handle('list-com-ports', () => scaleBridge.listPorts());
  ipcMain.handle('scale:list-ports', () => scaleBridge.listPorts());
  ipcMain.handle('scale:start', (_e, cfg) => scaleBridge.start(cfg));
  ipcMain.handle('scale:stop', () => scaleBridge.stop());
  ipcMain.handle('scale:status', () => scaleBridge.getStatus());
  ipcMain.handle('scale:read-once', () => scaleBridge.readOnce());
  ipcMain.handle('scale:tare', () => scaleBridge.tare());
  ipcMain.handle('scale:zero', () => scaleBridge.zero());
  ipcMain.handle('scale:send', (_e, cmd) => scaleBridge.sendRaw(cmd));
  ipcMain.handle('scale:sniff', (_e, opts) => scaleBridge.sniff(opts));
  ipcMain.handle('scale:probe', (_e, opts) => scaleBridge.probe(opts));

  ipcMain.handle('get-local-ip', () => getPrimaryLocalIp());
  ipcMain.handle('get-local-ips', () => getLocalIpv4List());
  ipcMain.handle('get-connected-clients', () =>
    localServerHandle ? localServerHandle.getConnectedClients() : []
  );
  ipcMain.handle('discover-lan-servers', async () => [
    { ip: getPrimaryLocalIp(), port: activeServerPort, name: 'Gherbi.Ai POS Server' }
  ]);
  ipcMain.handle('get-server-endpoint', () => ({
    ip: getPrimaryLocalIp(),
    port: activeServerPort,
    url: `http://${getPrimaryLocalIp()}:${activeServerPort}`
  }));
  ipcMain.handle('get-network-target', async () => ({
    scope: await getSetting('network_scope', 'local'),
    mode: await getSetting('network_mode', 'server'),
    serverIp: await getSetting('server_ip', getPrimaryLocalIp()),
    serverPort: activeServerPort
  }));
  ipcMain.handle('get-relay-status', () => ({ status: 'disconnected' }));
  ipcMain.handle('reconnect-relay', () => ({ status: 'disconnected' }));

  ipcMain.handle('cloud-sync:status', () => (cloudDbSync ? cloudDbSync.getStatus() : { enabled: false }));
  ipcMain.handle('cloud-sync:trigger', () => (cloudDbSync ? cloudDbSync.triggerNow() : { ok: false }));
  ipcMain.handle('cloud-sync:set-mode', (_e, mode) =>
    cloudDbSync ? cloudDbSync.setMode(mode) : { enabled: false }
  );
  ipcMain.handle('cloud-sync:snapshot', () => (cloudDbSync ? cloudDbSync.pushSnapshot() : { ok: false }));
  ipcMain.handle('cloud-sync:wipe', () => (cloudDbSync ? cloudDbSync.wipeCloudData() : { ok: true }));
  ipcMain.handle('cloud-sync:join-with-code', (_e, code) => deviceAuth.joinWithCode(db, code));
  ipcMain.handle('cloud-sync:get-join-info', () => deviceAuth.getJoinInfo(db));
  ipcMain.handle('cloud-sync:leave-cloud', () => deviceAuth.leaveCloud(db));
  ipcMain.handle('cloud-sync:issue-mobile-pair-code', () => deviceAuth.issueMobilePairCode(db));
  ipcMain.handle('cloud-sync:backfill-from-owner', () =>
    cloudDbSync ? cloudDbSync.backfillFromOwner() : { ok: true }
  );
  ipcMain.handle('cloud-sync:reset-and-resync', () =>
    cloudDbSync ? cloudDbSync.resetAndResync() : { ok: true }
  );
  ipcMain.handle('cloud-sync:fresh-bootstrap', () =>
    cloudDbSync ? cloudDbSync.runFreshBootstrap() : { ok: true }
  );
  ipcMain.handle('cloud-sync:recompute-stock', () => stockLedger.recomputeAllBatches(db));
  ipcMain.handle('cloud-sync:repair-ledger', () => stockLedger.repairMissingMovements(db));
  ipcMain.handle('cloud-sync:inspect-ledger', () => stockLedger.inspectLedger(db));
  ipcMain.handle('cloud-sync:deep-diagnose', () => cloudDiagnostics.deepDiagnose(db));
  ipcMain.handle('cloud-sync:send-diagnostics', (_e, payload) =>
    cloudDiagnostics.sendDiagnostics(db, payload)
  );

  ipcMain.handle('get-license-status', () => licenseManager.getLicenseStatus());
  ipcMain.handle('activate-software', (_e, code) => licenseManager.activateApp(code));
  ipcMain.handle('activate-software-offline', () => licenseManager.installOfflineLicense());
  ipcMain.handle('deactivate-software', () => licenseManager.deactivateApp());
  ipcMain.handle('get-trial-status', () => licenseManager.getTrialStatus());
  ipcMain.handle('get-promo-status', () => licenseManager.getPromoStatus());
  ipcMain.handle('send-purchase-request', async () => ({ ok: true }));
  ipcMain.handle('send-support-message', async () => ({ ok: true }));
  ipcMain.handle('get-performance-metrics', () => db._writeQueue.getStats());
}

// ============================================================================
// دورة حياة تطبيق Electron
// ============================================================================
app.whenReady().then(async () => {
  await dbRun("DELETE FROM settings WHERE value IN ('undefined', 'null')");
  await stockLedger.seedStartupMovements(db);

  cloudDbSync = cloudDbSyncMod.createCloudDbSync({
    db,
    getSetting,
    setSetting,
    getMainWindow: () => mainWindow
  });

  activeServerPort = Number(await getSetting('server_port', '8080')) || 8080;
  localServerHandle = startLocalServer(activeServerPort);

  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});