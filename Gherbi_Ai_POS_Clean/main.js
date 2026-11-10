/**
 * main.js
 * العملية الرئيسية الشاملة (Electron Main Process) لنظام Gherbi.Ai POS
 * تدير النوافذ، شاشة عرض الزبون الثانية، قاعدة البيانات، الطباعة الصامتة،
 * استيراد وتصدير Excel الكامل، النسخ الاحتياطي، القاموس الجزائري 613، الأقساط، وسجل الرقابة الأمنية
 */

'use strict';

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
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
const enterpriseBridge = require('./gherbi-enterprise-ipc-and-lan');
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
const cloudDbSyncMod = require('./cloud-db-sync');
const cloudDiagnostics = require('./cloud-diagnostics');
const {
  startLocalServer,
  generateNextDocNumber,
  enrichProductsFull,
  getProductFullDetails,
  getPaymentDetailsFull,
  executeSaleTransaction,
  recordAuditLog,
  createInstallmentPlanRecord,
  buildProductsQueryOrder
} = require('./server');

const productWriter = productWriterMod.createProductWriter(db);

let mainWindow = null;
let customerDisplayWindow = null;
let localServerHandle = null;
let cloudDbSync = null;
let activeServerPort = 8080;

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
    if (shopRow.description && !obj.shop_description) obj.shop_description = shopRow.description;
    if (shopRow.address && !obj.shop_address) obj.shop_address = shopRow.address;
    if (shopRow.phone && !obj.shop_phone) obj.shop_phone = shopRow.phone;
    if (shopRow.fax && !obj.shop_fax) obj.shop_fax = shopRow.fax;
    if (shopRow.email && !obj.shop_email) obj.shop_email = shopRow.email;
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
// إنشاء النافذة الرئيسية وشاشة عرض الزبون الثانية (Customer Facing Display)
// ============================================================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 890,
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
    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
      customerDisplayWindow.close();
    }
  });
}

async function openCustomerFacingWindow() {
  if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow.focus();
    return { success: true, alreadyOpen: true };
  }

  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0);

  const winOpts = {
    width: 900,
    height: 620,
    title: 'شاشة الزبون — Gherbi.Ai POS',
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  };

  if (externalDisplay) {
    winOpts.x = externalDisplay.bounds.x + 40;
    winOpts.y = externalDisplay.bounds.y + 40;
  }

  customerDisplayWindow = new BrowserWindow(winOpts);

  const shopName = await getSetting('shop_name', 'Gherbi.Ai POS');
  const rip = await getSetting('shop_baridimob_rip', '00799999000000000000');
  const ripQrImg = rip ? await QRCode.toDataURL(String(rip), { margin: 1, width: 130 }).catch(() => '') : '';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>شاشة الزبون</title>
  <style>
    body { margin:0; padding:24px; font-family:'Cairo','Segoe UI',sans-serif; background:#020617; color:#f8fafc; display:flex; flex-direction:column; height:100vh; box-sizing:border-box; }
    .hdr { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e293b; padding-bottom:14px; }
    .brand { font-size:26px; font-weight:900; color:#38bdf8; }
    .main { flex:1; display:grid; grid-template-columns:1fr 320px; gap:20px; margin-top:18px; min-height:0; }
    .items-box { background:#0f172a; border:1px solid #1e293b; border-radius:16px; padding:16px; overflow-y:auto; }
    .item-row { display:flex; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #1e293b; font-size:18px; font-weight:700; }
    .total-card { background:linear-gradient(135deg,#1d4ed8,#0284c7); border-radius:20px; padding:24px; display:flex; flex-direction:column; justify-content:space-between; text-align:center; }
    .total-val { font-size:44px; font-weight:900; font-family:monospace; color:#ffffff; margin:12px 0; }
    .rip-box { background:rgba(255,255,255,0.12); padding:12px; border-radius:12px; font-size:13px; }
  </style>
</head>
<body>
  <div class="hdr">
    <div class="brand">${shopName} — مرحباً بكم</div>
    <div id="clock" style="font-family:monospace;font-size:18px;color:#94a3b8;"></div>
  </div>
  <div class="main">
    <div class="items-box" id="itemsList">
      <div style="text-align:center;color:#64748b;margin-top:120px;font-size:22px;font-weight:700;">مرحباً بكم في متجرنا</div>
    </div>
    <div class="total-card">
      <div>
        <div style="font-size:18px;opacity:0.9;font-weight:700;">الإجمالي المطلوب للدفع</div>
        <div id="grandTotal" class="total-val">0.00 د.ج</div>
        <div id="discountLine" style="font-size:15px;color:#fde047;font-weight:700;"></div>
      </div>
      <div class="rip-box">
        <div style="font-weight:800;margin-bottom:4px;">الدفع الإلكتروني BaridiMob / CCP</div>
        <div style="font-family:monospace;font-size:12px;word-break:break-all;">${rip}</div>
        ${ripQrImg ? `<img src="${ripQrImg}" style="width:110px;height:110px;margin:8px auto 0;border-radius:10px;background:#fff;padding:4px;display:block;">` : ''}
      </div>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('ar-DZ'); }, 1000);
    ipcRenderer.on('customer-display:update', (_e, state) => {
      const items = (state && state.items) || [];
      const list = document.getElementById('itemsList');
      if (items.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#64748b;margin-top:120px;font-size:22px;font-weight:700;">شكراً لزيارتكم — مرحباً بكم</div>';
      } else {
        list.innerHTML = items.map((it) => \`
          <div class="item-row">
            <span>\${it.name} × \${it.quantity}</span>
            <span style="font-family:monospace;color:#38bdf8;">\${Number(it.subtotal || 0).toFixed(2)} د.ج</span>
          </div>\`).join('');
      }
      document.getElementById('grandTotal').textContent = Number((state && state.total) || 0).toFixed(2) + ' د.ج';
      const disc = Number((state && state.discount) || 0);
      document.getElementById('discountLine').textContent = disc > 0 ? ('التخفيض: -' + disc.toFixed(2) + ' د.ج') : '';
    });
  </script>
</body>
</html>`;

  customerDisplayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  customerDisplayWindow.on('closed', () => {
    customerDisplayWindow = null;
  });

  return { success: true };
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

  // 2. المستخدمون والمصادقة
  ipcMain.handle('check-first-run', async () => {
    if (await isLanClientMode()) return lanClient.checkFirstRun();
    await dbRun(
      "UPDATE users SET username = username || '~del~' || id WHERE deleted_at IS NOT NULL AND username NOT LIKE '%~del~%'"
    );
    const row = await dbGet('SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL');
    return Number((row && row.count) || 0) === 0;
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
      'SELECT id, name, username, password, role, permissions_json, status FROM users WHERE username = ? COLLATE NOCASE AND deleted_at IS NULL LIMIT 1',
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

    if (!valid) {
      await recordAuditLog({
        user_name: username,
        action_type: 'login_failed',
        severity: 'warning',
        details: { attempted_username: username }
      });
      return { success: false, error: 'invalid_creds' };
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role || 'Admin',
      permissions_json: user.permissions_json || null,
      status: user.status || 'Active'
    };
    return { success: true, ok: true, ...safeUser, user: safeUser };
  });

  ipcMain.handle('get-users', async () => {
    if (await isLanClientMode()) return lanClient.getUsers();
    return await dbAll(
      'SELECT id, name, username, role, permissions_json, status, created_at FROM users WHERE deleted_at IS NULL ORDER BY id ASC'
    );
  });

  ipcMain.handle('add-user', async (_e, u = {}) => {
    if (await isLanClientMode()) return lanClient.addUser(u);
    const name = String(u.name || u.username || '').trim();
    const username = String(u.username || '').trim();
    const hashed = bcrypt.hashSync(String(u.password || '1234'), 10);
    const role = u.role || 'Cashier';
    const perms = u.permissions_json
      ? typeof u.permissions_json === 'string'
        ? u.permissions_json
        : JSON.stringify(u.permissions_json)
      : null;
    const status = u.status || 'Active';

    await dbRun(
      "UPDATE users SET username = username || '~del~' || id WHERE deleted_at IS NOT NULL AND username NOT LIKE '%~del~%'"
    );
    const existing = await dbGet(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE AND deleted_at IS NULL',
      [username]
    );
    if (existing) {
      await dbRun(
        'UPDATE users SET name = ?, password = ?, role = ?, permissions_json = ?, status = ? WHERE id = ?',
        [name, hashed, role, perms, status, existing.id]
      );
      return { success: true, id: existing.id };
    }
    const ins = await dbRun(
      'INSERT INTO users (name, username, password, role, permissions_json, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, username, hashed, role, perms, status]
    );
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('update-user', async (_e, arg1, arg2) => {
    const id = Number(typeof arg1 === 'object' ? arg1.id : arg1);
    const u = typeof arg1 === 'object' ? arg1 : arg2 || {};
    if (await isLanClientMode()) return lanClient.updateUser(id, u);

    const perms =
      u.permissions_json !== undefined
        ? typeof u.permissions_json === 'string'
          ? u.permissions_json
          : JSON.stringify(u.permissions_json)
        : null;

    if (u.password && String(u.password).trim() !== '') {
      const hashed = bcrypt.hashSync(String(u.password), 10);
      await dbRun(
        'UPDATE users SET name = ?, username = ?, password = ?, role = ?, permissions_json = COALESCE(?, permissions_json), status = ? WHERE id = ?',
        [u.name, u.username, hashed, u.role || 'Cashier', perms, u.status || 'Active', id]
      );
    } else {
      await dbRun(
        'UPDATE users SET name = ?, username = ?, role = ?, permissions_json = COALESCE(?, permissions_json), status = ? WHERE id = ?',
        [u.name, u.username, u.role || 'Cashier', perms, u.status || 'Active', id]
      );
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

  // 3. المنتجات، الفئات، الدفعات، المتغيرات، والأرقام التسلسلية
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

    const { stockJoinSql, orderBySql } = buildProductsQueryOrder(filters && filters.sort);
    const rows = await dbAll(
      `SELECT p.* FROM products p ${stockJoinSql} WHERE ${conds.join(' AND ')} ${orderBySql}`,
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
          plu_code, has_variants, is_featured, material_role, track_serial, warranty_months, hide_from_pos,
          semi_wholesale_price, super_wholesale_price, area_m2_per_box, linear_meters_per_roll,
          weight_kg_per_unit, oem_reference, compatible_models, bogo_buy_qty, bogo_free_qty, series_pack_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          Number(p.warranty_months ?? 0),
          p.hide_from_pos ? 1 : 0,
          Number(p.semi_wholesale_price ?? 0),
          Number(p.super_wholesale_price ?? 0),
          Number(p.area_m2_per_box ?? 0),
          Number(p.linear_meters_per_roll ?? 0),
          Number(p.weight_kg_per_unit ?? 0),
          p.oem_reference || '',
          p.compatible_models || '',
          Number(p.bogo_buy_qty ?? 0),
          Number(p.bogo_free_qty ?? 0),
          p.series_pack_json || ''
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
             material_role = COALESCE(?, material_role), track_serial = COALESCE(?, track_serial),
             warranty_months = COALESCE(?, warranty_months), hide_from_pos = COALESCE(?, hide_from_pos),
             semi_wholesale_price = COALESCE(?, semi_wholesale_price),
             super_wholesale_price = COALESCE(?, super_wholesale_price),
             area_m2_per_box = COALESCE(?, area_m2_per_box),
             linear_meters_per_roll = COALESCE(?, linear_meters_per_roll),
             weight_kg_per_unit = COALESCE(?, weight_kg_per_unit),
             oem_reference = COALESCE(?, oem_reference),
             compatible_models = COALESCE(?, compatible_models),
             bogo_buy_qty = COALESCE(?, bogo_buy_qty),
             bogo_free_qty = COALESCE(?, bogo_free_qty),
             series_pack_json = COALESCE(?, series_pack_json)
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
          p.track_serial !== undefined ? (p.track_serial ? 1 : 0) : null,
          p.warranty_months !== undefined ? Number(p.warranty_months) : null,
          p.hide_from_pos !== undefined ? (p.hide_from_pos ? 1 : 0) : null,
          p.semi_wholesale_price !== undefined ? Number(p.semi_wholesale_price) : null,
          p.super_wholesale_price !== undefined ? Number(p.super_wholesale_price) : null,
          p.area_m2_per_box !== undefined ? Number(p.area_m2_per_box) : null,
          p.linear_meters_per_roll !== undefined ? Number(p.linear_meters_per_roll) : null,
          p.weight_kg_per_unit !== undefined ? Number(p.weight_kg_per_unit) : null,
          p.oem_reference !== undefined ? String(p.oem_reference) : null,
          p.compatible_models !== undefined ? String(p.compatible_models) : null,
          p.bogo_buy_qty !== undefined ? Number(p.bogo_buy_qty) : null,
          p.bogo_free_qty !== undefined ? Number(p.bogo_free_qty) : null,
          p.series_pack_json !== undefined ? String(p.series_pack_json) : null,
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

  ipcMain.handle('get-product-serials', async (_e, productId) => {
    return await dbAll(
      'SELECT * FROM product_serials WHERE product_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [Number(productId)]
    );
  });

  ipcMain.handle('add-product-serial', async (_e, payload = {}) => {
    const ins = await dbRun(
      `INSERT INTO product_serials (product_id, variant_id, batch_id, serial_number, status, warranty_months, notes)
       VALUES (?, ?, ?, ?, 'in_stock', ?, ?)`,
      [
        Number(payload.product_id || payload.productId),
        payload.variant_id || null,
        payload.batch_id || null,
        String(payload.serial_number || '').trim(),
        Number(payload.warranty_months ?? 12),
        payload.notes || null
      ]
    );
    return { success: true, id: ins.lastID };
  });

  // 4. المبيعات، الزبائن، والائتمان
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
    const oldSale = await dbGet('SELECT * FROM sales WHERE id = ?', [sid]);
    const items = await dbAll(
      'SELECT * FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL',
      [sid]
    );
    if (oldSale && db.enterprise && db.enterprise.logForensicAudit) {
      await db.enterprise.logForensicAudit({
        userId: oldSale.user_id || 1,
        userName: 'Admin / Cashier',
        actionCode: 'DELETE_SALE_FORENSIC',
        entityTable: 'sales',
        entityId: sid,
        beforeObj: { sale: oldSale, items_count: items.length, total: oldSale.total },
        afterObj: { deleted: true, deleted_at: new Date().toISOString() },
        details: `حذف فاتورة مبيعات رقم (${oldSale.doc_number || '#' + sid}) بقيمة ${Number(oldSale.total || 0).toFixed(2)} د.ج`
      }).catch(() => {});
    }

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
    return await dbAll(
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
      `INSERT INTO customers (name, phone, address, nif, rc, ai, nis, initial_debt, credit_limit, price_tier, loyalty_points, ccp_account, ccp_key, bank_rip, wilaya, commune)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        Number(c.loyalty_points ?? 0),
        c.ccp_account || '',
        c.ccp_key || '',
        c.bank_rip || '',
        c.wilaya || '',
        c.commune || ''
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
           initial_debt = ?, credit_limit = ?, price_tier = ?,
           loyalty_points = COALESCE(?, loyalty_points),
           ccp_account = COALESCE(?, ccp_account),
           ccp_key = COALESCE(?, ccp_key),
           bank_rip = COALESCE(?, bank_rip),
           wilaya = COALESCE(?, wilaya),
           commune = COALESCE(?, commune)
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
        c.loyalty_points !== undefined ? Number(c.loyalty_points) : null,
        c.ccp_account !== undefined ? String(c.ccp_account) : null,
        c.ccp_key !== undefined ? String(c.ccp_key) : null,
        c.bank_rip !== undefined ? String(c.bank_rip) : null,
        c.wilaya !== undefined ? String(c.wilaya) : null,
        c.commune !== undefined ? String(c.commune) : null,
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
    return await getPaymentDetailsFull(paymentId, type);
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
    const dateFrom = payload.dateFrom || payload.date_from || null;
    const dateTo = payload.dateTo || payload.date_to || null;

    const conds = ['s.customer_id = ?', 's.deleted_at IS NULL'];
    const params = [cid];
    if (dateFrom) { conds.push('date(s.sale_date) >= date(?)'); params.push(String(dateFrom).slice(0, 10)); }
    if (dateTo) { conds.push('date(s.sale_date) <= date(?)'); params.push(String(dateTo).slice(0, 10)); }

    const sales = await dbAll(
      `SELECT * FROM sales s WHERE ${conds.join(' AND ')} ORDER BY s.sale_date ASC`,
      params
    );
    const items = await dbAll(
      `SELECT
         COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
         p.barcode AS product_barcode,
         p.unit,
         SUM(si.quantity) AS total_qty,
         AVG(si.price) AS avg_price,
         SUM(si.subtotal) AS total_subtotal
       FROM sale_items si
       INNER JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE ${conds.join(' AND ')} AND si.deleted_at IS NULL
       GROUP BY COALESCE(si.product_id, si.custom_product_name)`,
      params
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

  
  ipcMain.handle('parse-supplier-pdf-base64', async (_e, base64Data) => {
    const zlib = require('zlib');
    const buf = Buffer.from(String(base64Data || ''), 'base64');
    const rawStr = buf.toString('latin1');
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    let combined = '';
    while ((match = streamRegex.exec(rawStr)) !== null) {
      const bodyStr = match[1];
      if (bodyStr.length < 2) continue;
      const b0 = bodyStr.charCodeAt(0) & 0xff;
      const b1 = bodyStr.charCodeAt(1) & 0xff;
      if ((b0 & 0x0f) === 8 && (b0 * 256 + b1) % 31 === 0) {
        try {
          const dec = zlib.inflateSync(Buffer.from(bodyStr, 'latin1')).toString('latin1');
          if (dec.includes('BT') || dec.includes('Tj') || dec.includes('Tm')) {
            combined += dec + '\n';
          }
        } catch (_) {}
      }
    }
    return { ok: true, contentStream: combined };
  });

  
  ipcMain.handle('parse-universal-invoice-file', async (_e, payload = {}) => {
    const zlib = require('zlib');
    const fileName = String(payload.fileName || '').toLowerCase();
    const buf = Buffer.from(String(payload.base64Data || ''), 'base64');

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
      return { ok: true, fileType: 'excel', rows };
    }

    const rawStr = buf.toString('latin1');
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    let combined = '';
    while ((match = streamRegex.exec(rawStr)) !== null) {
      const bodyStr = match[1];
      if (!bodyStr || bodyStr.length < 2) continue;
      const b0 = bodyStr.charCodeAt(0) & 0xff;
      const b1 = bodyStr.charCodeAt(1) & 0xff;
      if ((b0 & 0x0f) === 8 && (b0 * 256 + b1) % 31 === 0) {
        try {
          const dec = zlib.inflateSync(Buffer.from(bodyStr, 'latin1')).toString('latin1');
          if (dec.includes('BT') || dec.includes('Tj') || dec.includes('TJ') || dec.includes('Tm') || dec.includes('Td')) {
            combined += dec + '\n';
          }
        } catch (_) {}
      } else if (bodyStr.includes('BT') && (bodyStr.includes('Tj') || bodyStr.includes('TJ'))) {
        combined += bodyStr + '\n';
      }
    }
    return { ok: true, fileType: 'pdf', contentStream: combined };
  });

  ipcMain.handle('save-purchase', async (_e, data = {}) => {
    if (data.editInvoiceId || data.edit_invoice_id) {
      const oldId = Number(data.editInvoiceId || data.edit_invoice_id);
      const oldItems = await dbAll('SELECT batch_id FROM purchase_items WHERE invoice_id = ? AND deleted_at IS NULL', [oldId]);
      const oldBatchIds = oldItems.map((x) => x.batch_id).filter(Boolean);
      if (oldBatchIds.length > 0) await batchAlloc.voidBatches(db, oldBatchIds);
      await dbRun('DELETE FROM invoice_payments WHERE invoice_id = ?', [oldId]);
      await dbRun('DELETE FROM purchase_items WHERE invoice_id = ?', [oldId]);
      await dbRun('DELETE FROM purchase_invoices WHERE id = ?', [oldId]);
    }
    if (await isLanClientMode()) return lanClient.savePurchase(data);
    const items = Array.isArray(data.items) ? data.items : [];
    const supplierId = data.supplier_id || data.supplierId ? Number(data.supplier_id || data.supplierId) : null;
    const subtotal = Number(data.subtotal ?? 0);
    const taxPercentage = Number(data.tax_percentage ?? 0);
    const additionalCosts = Number(data.additional_costs ?? 0);
    const total = Number(data.total ?? 0);
    const paidAmount = Number(data.paid_amount ?? 0);
    const paymentMethod = String(data.payment_method || 'cash').trim();
    const unifySellingPrice = data.unify_selling_price !== false;
    const invDate = data.date || new Date().toISOString().slice(0, 10);
    const invNumber = data.invoice_number || `ACH-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    const totalUnits = items.reduce(
      (sum, it) => sum + Math.max(0, Number(it.quantity || 0) + Number(it.bonus_qty || 0)),
      0
    );
    const extraCostPerUnit = totalUnits > 0 ? additionalCosts / totalUnits : 0;

    return await db.withTransaction(async () => {
      const freightCost = Number(data.freight_cost ?? 0);
      const customsCost = Number(data.customs_cost ?? 0);
      const handlingCost = Number(data.handling_cost ?? 0);
      const ins = await dbRun(
        `INSERT INTO purchase_invoices (
          invoice_number, supplier_id, subtotal, tax_percentage, additional_costs, freight_cost, customs_cost, handling_cost, total, paid_amount, due_date, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invNumber, supplierId, subtotal, taxPercentage, additionalCosts, freightCost, customsCost, handlingCost, total, paidAmount, data.due_date || null, invDate]
      );
      const invoiceId = ins.lastID;

      if (paidAmount > 0) {
        const recNum = await generateNextDocNumber('payment_receipt');
        await dbRun(
          'INSERT INTO invoice_payments (invoice_id, supplier_id, amount, date, payment_method, receipt_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [invoiceId, supplierId, paidAmount, invDate, paymentMethod, recNum, data.notes || null]
        );
      }

      const supRow = supplierId ? await dbGet('SELECT name FROM suppliers WHERE id = ?', [supplierId]) : null;

      for (const it of items) {
        const pid = Number(it.product_id || it.productId);
        const paidQty = Math.max(0, Number(it.quantity ?? 1));
        const bonusQty = Math.max(0, Number(it.bonus_qty ?? 0));
        const totalStockReceived = Number((paidQty + bonusQty).toFixed(4));
        if (totalStockReceived <= 0) continue;

        const baseCost = Number(it.cost_price ?? 0);
        const lineChargedTotal = paidQty * baseCost;
        const effectiveBaseUnitCost = totalStockReceived > 0 ? lineChargedTotal / totalStockReceived : baseCost;
        const effectiveCostPrice = Number(
          (it.effective_cost_price !== undefined
            ? Number(it.effective_cost_price)
            : effectiveBaseUnitCost + extraCostPerUnit
          ).toFixed(2)
        );
        const sellPrice = Number(it.selling_price ?? 0);
        const wholesalePrice = it.wholesale_price && Number(it.wholesale_price) > 0 ? Number(it.wholesale_price) : null;

        const prevStockRow = await dbGet(
          `SELECT
             COALESCE(SUM(CASE WHEN stock > 0 THEN stock ELSE 0 END), 0) AS old_stk,
             COALESCE(SUM(CASE WHEN stock > 0 THEN stock * COALESCE(NULLIF(wac_cost, 0), cost_price) ELSE 0 END), 0) AS old_val
           FROM inventory_batches
           WHERE product_id = ? AND deleted_at IS NULL`,
          [pid]
        );
        const oldStk = Number((prevStockRow && prevStockRow.old_stk) || 0);
        const oldVal = Number((prevStockRow && prevStockRow.old_val) || 0);
        const newWacCost = (oldStk + totalStockReceived) > 0
          ? Number(((oldVal + (totalStockReceived * effectiveCostPrice)) / (oldStk + totalStockReceived)).toFixed(2))
          : effectiveCostPrice;

        const batchIns = await dbRun(
          `INSERT INTO inventory_batches (
            product_id, variant_id, stock, cost_price, wac_cost, selling_price, wholesale_price, expiry_date, location, supplier_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pid,
            it.variant_id || null,
            totalStockReceived,
            effectiveCostPrice,
            newWacCost,
            sellPrice,
            wholesalePrice,
            it.expiry_date || null,
            it.location || null,
            supplierId
          ]
        );
        await dbRun('UPDATE inventory_batches SET wac_cost = ? WHERE product_id = ? AND deleted_at IS NULL', [newWacCost, pid]);

        if (unifySellingPrice && sellPrice > 0) {
          await dbRun(
            `UPDATE inventory_batches
             SET selling_price = ?,
                 wholesale_price = COALESCE(?, wholesale_price)
             WHERE product_id = ? AND deleted_at IS NULL AND COALESCE(stock, 0) > 0`,
            [sellPrice, wholesalePrice, pid]
          );
        }

        if (supRow && supRow.name) {
          await dbRun(
            "UPDATE products SET supplier = ? WHERE id = ? AND (supplier IS NULL OR TRIM(supplier) = '')",
            [supRow.name, pid]
          );
        }

        await dbRun(
          `INSERT INTO purchase_items (
            invoice_id, product_id, batch_id, variant_id, quantity, cost_price, selling_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            pid,
            batchIns.lastID,
            it.variant_id || null,
            totalStockReceived,
            effectiveCostPrice,
            sellPrice,
            Number((paidQty * baseCost + totalStockReceived * extraCostPerUnit).toFixed(2))
          ]
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
      `SELECT pi.*, sup.name AS supplier_name, sup.phone AS supplier_phone, sup.address AS supplier_address,
              sup.rc AS supplier_rc, sup.nif AS supplier_nif, sup.ai AS supplier_ai, sup.nis AS supplier_nis
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
    const head = await dbGet(
      `SELECT sr.*, sup.name AS supplier_name, sup.phone AS supplier_phone
       FROM supplier_returns sr
       LEFT JOIN suppliers sup ON sup.id = sr.supplier_id
       WHERE sr.id = ? AND sr.deleted_at IS NULL`,
      [id]
    );
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
              c.rc AS customer_rc, c.nif AS customer_nif, c.ai AS customer_ai, c.nis AS customer_nis
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

  ipcMain.handle('check-proforma-stock', async (_e, proformaId) => {
    const pid = Number(proformaId);
    const items = await dbAll(
      `SELECT pi.product_id, pi.variant_id, pi.quantity, pi.custom_product_name, p.name AS product_name
       FROM proforma_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.proforma_id = ? AND pi.deleted_at IS NULL`,
      [pid]
    );
    const shortages = [];
    for (const it of items) {
      if (!it.product_id) continue;
      const row = await dbGet(
        'SELECT COALESCE(SUM(stock), 0) AS available FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL',
        [it.product_id]
      );
      const avail = Number((row && row.available) || 0);
      if (avail < Number(it.quantity || 0)) {
        shortages.push({
          product_id: it.product_id,
          product_name: it.product_name || it.custom_product_name || 'منتج',
          requested: Number(it.quantity || 0),
          available: avail,
          shortage: Number((Number(it.quantity || 0) - avail).toFixed(3))
        });
      }
    }
    return { ok: shortages.length === 0, shortages };
  });

  ipcMain.handle('convert-proforma-to-sale', async (_e, proformaId, extra = {}) => {
    const pid = Number(proformaId);
    const head = await dbGet('SELECT * FROM proforma_invoices WHERE id = ? AND deleted_at IS NULL', [pid]);
    if (!head) throw new Error('الفاتورة الشكلية غير موجودة');
    const items = await dbAll('SELECT * FROM proforma_items WHERE proforma_id = ? AND deleted_at IS NULL', [pid]);
    const saleOut = await executeSaleTransaction({
      customer_id: head.customer_id,
      subtotal: head.subtotal,
      tax_percentage: head.tax_percentage,
      discount: head.discount,
      total: head.total,
      paid_amount: extra.paid_amount !== undefined ? Number(extra.paid_amount) : head.total,
      payment_method: extra.payment_method || 'cash',
      items
    });
    await dbRun(
      "UPDATE proforma_invoices SET status = 'converted', converted_to_sale_id = ? WHERE id = ?",
      [saleOut.saleId, pid]
    );
    return { success: true, saleId: saleOut.saleId, docNumber: saleOut.docNumber };
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
        if (d.reserves_stock !== false && it.product_id) {
          await dbRun(
            'INSERT INTO inventory_reservations (order_id, batch_id, product_id, quantity) VALUES (?, ?, ?, ?)',
            [oid, it.batch_id || null, Number(it.product_id), Number(it.quantity ?? 1)]
          );
        }
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
      `SELECT co.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
              c.rc AS customer_rc, c.nif AS customer_nif
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
    const oid = Number(id);
    await dbRun('UPDATE inventory_reservations SET released = 1, released_at = CURRENT_TIMESTAMP WHERE order_id = ?', [oid]);
    await dbRun('DELETE FROM customer_order_items WHERE order_id = ?', [oid]);
    await dbRun('DELETE FROM customer_orders WHERE id = ?', [oid]);
    return { success: true };
  });

  ipcMain.handle('cancel-order', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.cancelOrder(id);
    const oid = Number(id);
    await dbRun('UPDATE inventory_reservations SET released = 1, released_at = CURRENT_TIMESTAMP WHERE order_id = ?', [oid]);
    await dbRun("UPDATE customer_orders SET status = 'cancelled' WHERE id = ?", [oid]);
    return { success: true };
  });

  ipcMain.handle('order-to-sale-payload', async (_e, id) => {
    if (await isLanClientMode()) return lanClient.orderToSalePayload(id);
    return await dbGet('SELECT * FROM customer_orders WHERE id = ?', [Number(id)]);
  });

  ipcMain.handle('mark-order-delivered', async (_e, id, saleId) => {
    if (await isLanClientMode()) return lanClient.markOrderDelivered(id, saleId);
    const oid = Number(id);
    await dbRun('UPDATE inventory_reservations SET released = 1, released_at = CURRENT_TIMESTAMP WHERE order_id = ?', [oid]);
    await dbRun("UPDATE customer_orders SET status = 'delivered', converted_to_sale_id = ? WHERE id = ?", [
      Number(saleId),
      oid
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

  
  ipcMain.handle('update-expense', async (_e, id, exp = {}) => {
    const eid = Number(id);
    const amt = Number(exp.amount || 0);
    await dbRun(
      'UPDATE expenses SET category = ?, description = ?, amount = ?, date = COALESCE(?, date) WHERE id = ?',
      [exp.category || 'عام', exp.description || null, amt, exp.date || null, eid]
    );
    await dbRun(
      "UPDATE caisse_transactions SET amount = ?, category = ?, description = ? WHERE reference_id = ? AND type = 'expense'",
      [amt, exp.category || 'عام', exp.description || 'مصروف', eid]
    );
    return { success: true, id: eid };
  });

  ipcMain.handle('update-capital', async (_e, id, cap = {}) => {
    const cid = Number(id);
    const amt = Number(cap.amount || 0);
    await dbRun(
      'UPDATE capital_injections SET category = ?, description = ?, amount = ?, date = COALESCE(?, date) WHERE id = ?',
      [cap.category || 'إيداع رأس مال', cap.description || null, amt, cap.date || null, cid]
    );
    return { success: true, id: cid };
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
  
  ipcMain.handle('merge-duplicate-products', async (_e, payload = {}) => {
    const keepId = Number(payload.keepProductId || payload.keep_id || 0);
    const removeId = Number(payload.removeProductId || payload.remove_id || 0);
    if (!keepId || !removeId || keepId === removeId) {
      throw new Error('معرفات المنتجات غير صالحة للدمج');
    }

    return await db.withTransaction(async () => {
      await dbRun('UPDATE inventory_batches SET product_id = ? WHERE product_id = ?', [keepId, removeId]);
      await dbRun('UPDATE sale_items SET product_id = ? WHERE product_id = ?', [keepId, removeId]);
      await dbRun('UPDATE purchase_items SET product_id = ? WHERE product_id = ?', [keepId, removeId]);
      await dbRun('UPDATE proforma_items SET product_id = ? WHERE product_id = ?', [keepId, removeId]);
      await dbRun('UPDATE customer_order_items SET product_id = ? WHERE product_id = ?', [keepId, removeId]);
      await dbRun('UPDATE bundle_items SET product_id = ? WHERE product_id = ?', [keepId, removeId]);
      await dbRun('UPDATE product_barcodes SET product_id = ? WHERE product_id = ?', [keepId, removeId]);
      await dbRun('DELETE FROM products WHERE id = ?', [removeId]);
      return { success: true, keepId, removeId };
    });
  });

  ipcMain.handle('ask-copilot-cloud-ai', async (_e, payload = {}) => {
    const axios = require('axios');
    const apiKey = String(payload.apiKey || (await db.getSetting('gemini_api_key', '')) || '').trim();
    if (!apiKey) {
      return { ok: false, reason: 'no_api_key' };
    }
    const promptText = String(payload.prompt || '');
    const contextText = String(payload.contextSummary || '');

    try {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
      const res = await axios.post(
        url,
        {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    'أنت الوكيل الذكي التنفيذي (Gherbi.Ai ERP Agent) لمتجر في الجزائر. أجب باحترافية وإيجاز وخطوات عملية واضحة بالدينار الجزائري والسنتيم بناءً على بيانات المتجر الحية التالية:\n' +
                    contextText +
                    '\n\nسؤال التاجر أو البائع: ' +
                    promptText
                }
              ]
            }
          ]
        },
        { timeout: 15000 }
      );
      const reply =
        res.data &&
        res.data.candidates &&
        res.data.candidates[0] &&
        res.data.candidates[0].content &&
        res.data.candidates[0].content.parts &&
        res.data.candidates[0].content.parts[0]
          ? res.data.candidates[0].content.parts[0].text
          : '';
      return { ok: Boolean(reply), reply };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('get-ai-copilot-insights', async () => {
    if (await isLanClientMode()) return lanClient.getAiCopilotInsights();
    return await analyticsQueries.getAiCopilotInsights(db);
  });

  ipcMain.handle('get-notifications', async () => {
    if (await isLanClientMode()) return lanClient.getNotifications();
    const lowStock = await dbAll(
      `SELECT p.id, p.name, p.min_stock, p.unit, COALESCE(SUM(ib.stock), 0) AS stock
       FROM products p
       LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.deleted_at IS NULL
       WHERE p.deleted_at IS NULL
       GROUP BY p.id
       HAVING stock <= COALESCE(p.min_stock, 5)
       LIMIT 50`
    );
    const expiring = await dbAll(
      `SELECT ib.id, p.id AS product_id, p.name, ib.stock, ib.expiry_date
       FROM inventory_batches ib
       INNER JOIN products p ON p.id = ib.product_id AND p.deleted_at IS NULL
       WHERE ib.deleted_at IS NULL AND ib.stock > 0
         AND ib.expiry_date IS NOT NULL AND TRIM(ib.expiry_date) <> ''
         AND date(ib.expiry_date) <= date('now', '+30 days')
       ORDER BY date(ib.expiry_date) ASC LIMIT 50`
    );
    const dueInstallments = await dbAll(
      `SELECT s.*, p.customer_id, c.name AS customer_name, c.phone AS customer_phone
       FROM installment_schedules s
       INNER JOIN installment_plans p ON p.id = s.plan_id AND p.deleted_at IS NULL
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE s.deleted_at IS NULL AND s.status <> 'paid'
         AND date(s.due_date) <= date('now', '+7 days')
       ORDER BY date(s.due_date) ASC LIMIT 50`
    );
    return { lowStock, expiring, dueInstallments };
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

  // 10. الميزات الـ 6 الحصرية للسوق الجزائري (القاموس 613، الأقساط، الرقابة، شاشة الزبون)
  
  // ============================================================================
  // [FINAL 100% UPGRADE HANDLERS]: Warranty IMEI, DZ 613 CSV, Supplier Ledger, Doc Counters
  // ============================================================================
  ipcMain.handle('lookup-warranty-serial', async (_e, rawSerial) => {
    if (await isLanClientMode()) return lanClient.lookupWarrantySerial(rawSerial);
    const serial = String(rawSerial || '').trim();
    if (!serial) return null;

    const item = await dbGet(
      `SELECT
         si.*,
         COALESCE(p.name, si.custom_product_name, 'منتج') AS product_name,
         p.barcode AS product_barcode,
         p.warranty_months AS default_warranty_months,
         s.doc_number,
         s.sale_date,
         s.total AS sale_total,
         c.name AS customer_name,
         c.phone AS customer_phone
       FROM sale_items si
       INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE si.serial_number = ? COLLATE NOCASE AND si.deleted_at IS NULL
       ORDER BY si.id DESC LIMIT 1`,
      [serial]
    );

    if (!item) return { found: false, serial };

    const months = Number(item.warranty_months || item.default_warranty_months || 12);
    const startDate = new Date(item.sale_date || Date.now());
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86400000);

    return {
      found: true,
      serial,
      sale_id: item.sale_id,
      doc_number: item.doc_number || ('#' + item.sale_id),
      sale_date: String(item.sale_date || '').slice(0, 10),
      product_name: item.product_name,
      product_barcode: item.product_barcode || '',
      price: item.price,
      customer_name: item.customer_name || 'زبون عابر',
      customer_phone: item.customer_phone || '',
      warranty_months: months,
      warranty_end_date: endDate.toISOString().slice(0, 10),
      days_remaining: daysLeft,
      is_valid: daysLeft >= 0
    };
  });

  ipcMain.handle('get-dz-dictionary-stats', async () => {
    if (await isLanClientMode()) return lanClient.getDzDictionaryStats();
    const row = await dbGet('SELECT COUNT(*) AS count FROM dz_product_dictionary');
    return { count: Number((row && row.count) || 0) };
  });

  ipcMain.handle('import-dz-dictionary-csv', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'استيراد قاموس المنتجات الجزائرية (CSV / Excel)',
      properties: ['openFile'],
      filters: [{ name: 'CSV / Excel', extensions: ['csv', 'xlsx', 'xls'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const wb = XLSX.readFile(filePaths[0], { raw: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let imported = 0;

    await db.withTransaction(async () => {
      const stmt = db._rawPrepare(
        'INSERT OR REPLACE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const r of rows) {
        const bc = String(r.barcode || r.code || r['الباركود'] || '').trim();
        const name = String(r.name || r.product_name || r['الاسم'] || '').trim();
        if (!bc || !name) continue;
        const cat = String(r.category || r['الفئة'] || 'مواد غذائية').trim().slice(0, 50);
        const brand = String(r.supplier || r.brand || r['الماركة'] || '').trim().slice(0, 50);
        const unit = String(r.unit || r['الوحدة'] || 'قطعة').trim();
        const price = Number(r.selling_price || r.suggested_price || 0) || 0;
        stmt.run(bc, name.slice(0, 120), cat, brand, unit, price);
        imported += 1;
      }
      stmt.finalize();
    });

    return { success: true, imported };
  });

  ipcMain.handle('get-supplier-ledger', async (_e, supplierId) => {
    if (await isLanClientMode()) return lanClient.getSupplierLedger(supplierId);
    const sid = Number(supplierId);
    const supplier = await dbGet('SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL', [sid]);
    const purchases = await dbAll(
      'SELECT * FROM purchase_invoices WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [sid]
    );
    const payments = await dbAll(
      `SELECT ip.*, pi.invoice_number
       FROM invoice_payments ip
       LEFT JOIN purchase_invoices pi ON pi.id = ip.invoice_id
       WHERE (ip.supplier_id = ? OR pi.supplier_id = ?) AND ip.deleted_at IS NULL
       ORDER BY ip.id DESC`,
      [sid, sid]
    );
    const returns = await dbAll(
      'SELECT * FROM supplier_returns WHERE supplier_id = ? AND deleted_at IS NULL ORDER BY id DESC',
      [sid]
    );
    return { supplier, purchases, payments, returns };
  });

  ipcMain.handle('get-doc-counters', async () => {
    if (await isLanClientMode()) return lanClient.getDocCounters();
    return await dbAll('SELECT * FROM document_counters ORDER BY doc_type ASC');
  });

  ipcMain.handle('update-doc-counter', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.updateDocCounter(payload);
    const docType = String(payload.doc_type || 'invoice').trim();
    const year = Number(payload.year || new Date().getFullYear());
    const lastNum = Math.max(0, parseInt(payload.last_number ?? 0, 10) || 0);
    const prefixFmt = String(payload.prefix_format || 'FAC-{YYYY}-{0000}').trim();

    await dbRun(
      `INSERT INTO document_counters (doc_type, year, last_number, prefix_format)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(doc_type, year) DO UPDATE SET last_number = excluded.last_number, prefix_format = excluded.prefix_format`,
      [docType, year, lastNum, prefixFmt]
    );
    return { success: true };
  });

  ipcMain.handle('lookup-dz-barcode', async (_e, barcode) => {
    if (await isLanClientMode()) return lanClient.lookupDzBarcode(barcode);
    const clean = String(barcode || '').trim();
    if (!clean) return null;
    return await dbGet('SELECT * FROM dz_product_dictionary WHERE barcode = ? LIMIT 1', [clean]);
  });

  ipcMain.handle('get-audit-logs', async () => {
    if (await isLanClientMode()) return lanClient.getAuditLogs();
    return await dbAll('SELECT * FROM audit_logs WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 300');
  });

  ipcMain.handle('add-audit-log', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.addAuditLog(payload);
    return await recordAuditLog(payload);
  });

  ipcMain.handle('get-installment-plans', async (_e, filters = {}) => {
    if (await isLanClientMode()) return lanClient.getInstallmentPlans(filters);
    const conds = ['ip.deleted_at IS NULL'];
    const params = [];
    if (filters && (filters.customerId || filters.customer_id)) {
      conds.push('ip.customer_id = ?');
      params.push(Number(filters.customerId || filters.customer_id));
    }
    const plans = await dbAll(
      `SELECT ip.*, c.name AS customer_name, c.phone AS customer_phone
       FROM installment_plans ip
       LEFT JOIN customers c ON c.id = ip.customer_id
       WHERE ${conds.join(' AND ')}
       ORDER BY ip.id DESC`,
      params
    );
    for (const p of plans) {
      p.schedules = await dbAll(
        'SELECT * FROM installment_schedules WHERE plan_id = ? AND deleted_at IS NULL ORDER BY installment_num ASC',
        [p.id]
      );
    }
    return plans;
  });

  ipcMain.handle('create-installment-plan', async (_e, payload = {}) => {
    if (await isLanClientMode()) return lanClient.createInstallmentPlan(payload);
    return await createInstallmentPlanRecord(payload);
  });

  ipcMain.handle('pay-installment-schedule', async (_e, scheduleId, amount) => {
    if (await isLanClientMode()) return lanClient.payInstallmentSchedule(scheduleId, amount);
    const sid = Number(scheduleId);
    const sched = await dbGet('SELECT * FROM installment_schedules WHERE id = ?', [sid]);
    if (!sched) throw new Error('القسط المطلوب غير موجود');
    const payAmt = amount !== undefined ? Number(amount) : Number(sched.amount) - Number(sched.paid_amount || 0);
    const newPaid = Number((Number(sched.paid_amount || 0) + payAmt).toFixed(2));
    const newStatus = newPaid >= Number(sched.amount) - 0.01 ? 'paid' : 'partial';
    const nowIso = new Date().toISOString();

    return await db.withTransaction(async () => {
      await dbRun(
        'UPDATE installment_schedules SET paid_amount = ?, status = ?, paid_at = ? WHERE id = ?',
        [newPaid, newStatus, nowIso, sid]
      );
      await dbRun(
        'UPDATE installment_plans SET remaining_amount = MAX(0, COALESCE(remaining_amount, 0) - ?) WHERE id = ?',
        [payAmt, sched.plan_id]
      );
      const pendingRow = await dbGet(
        "SELECT COUNT(*) AS c FROM installment_schedules WHERE plan_id = ? AND status <> 'paid' AND deleted_at IS NULL",
        [sched.plan_id]
      );
      if (Number((pendingRow && pendingRow.c) || 0) === 0) {
        await dbRun("UPDATE installment_plans SET status = 'completed' WHERE id = ?", [sched.plan_id]);
      }
      return { success: true, scheduleId: sid, status: newStatus };
    });
  });

  ipcMain.handle('open-customer-display', async () => {
    return await openCustomerFacingWindow();
  });

  ipcMain.handle('update-customer-display', (_e, cartState = {}) => {
    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
      customerDisplayWindow.webContents.send('customer-display:update', cartState);
    }
    return { ok: true };
  });

  // 11. الطباعة الصامتة، PDF، الباركود، QR، النسخ الاحتياطي، وملفات Excel الكاملة
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

    const isSilent = Boolean(options.silent ?? true);
    const printWin = new BrowserWindow({
      width: 820,
      height: 720,
      show: !isSilent,
      autoHideMenuBar: true,
      title: 'طباعة المستند — Gherbi.Ai POS',
      webPreferences: { contextIsolation: true }
    });

    try {
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      await new Promise((r) => setTimeout(r, 400));

      return await new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: isSilent,
            printBackground: true,
            deviceName: options.printerName || options.deviceName || undefined
          },
          (success, failureReason) => {
            if (!printWin.isDestroyed()) printWin.close();
            resolve({ success, error: failureReason || null });
          }
        );
      });
    } catch (err) {
      if (!printWin.isDestroyed()) printWin.close();
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
      const pdfBuf = await pdfWin.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: 'none' }
      });
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
    } catch (_) {
      return null;
    }
  });

  
  ipcMain.handle('rip-qr-dataurl', async (_e, customText) => {
    const rip = customText || (await getSetting('shop_baridimob_rip', '')) || (await getSetting('shop_ccp', '')) || '00799999000000000000';
    if (!rip) return '';
    return await QRCode.toDataURL(String(rip), { margin: 1, width: 180 });
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
      title: 'اختر ملف المنتجات (Excel .xlsx / .xls أو .csv)',
      properties: ['openFile'],
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const chosenPath = filePaths[0];
    let wb;
    if (chosenPath.toLowerCase().endsWith('.csv')) {
      const csvText = fs.readFileSync(chosenPath, 'utf8');
      wb = XLSX.read(csvText, { type: 'string', raw: false });
    } else {
      wb = XLSX.readFile(chosenPath, { codepage: 65001, raw: false });
    }

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    await dbRun('UPDATE products SET barcode = NULL WHERE deleted_at IS NOT NULL AND barcode IS NOT NULL');
    const existingRows = await dbAll('SELECT id, barcode FROM products WHERE deleted_at IS NULL AND barcode IS NOT NULL');
    const barcodeToIdMap = new Map();
    for (const er of existingRows) {
      if (er.barcode) barcodeToIdMap.set(String(er.barcode).trim(), Number(er.id));
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    await stockLedger.withSkipStockLedger(db, async () => {
      await db.withTransaction(async () => {
        const dzStmt = db._rawPrepare(
          'INSERT OR IGNORE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const prodStmt = db._rawPrepare(
          'INSERT OR IGNORE INTO products (barcode, name, category, family, supplier, unit, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        const batchStmt = db._rawPrepare(
          'INSERT INTO inventory_batches (product_id, stock, cost_price, selling_price, wholesale_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?)'
        );

        for (const r of rows) {
          const name = String(r.name || r.Name || r.product_name || r['الاسم'] || r['اسم المنتج'] || r.Designation || '').trim();
          if (!name) {
            skipped++;
            continue;
          }

          const rawBc = String(r.barcode || r.Barcode || r.code || r['الباركود'] || '').replace(/^"|"$/g, '').trim();
          const barcode = rawBc.length > 0 ? rawBc : null;
          const category = String(r.category || r.Category || r['الفئة'] || 'عام').trim() || 'عام';
          const family = String(r.family || r.Family || r['العائلة'] || '').trim() || null;
          const supplier = String(r.supplier || r.Supplier || r.brand || r['المورد'] || '').trim() || null;
          const unit = String(r.unit || r.Unit || r['الوحدة'] || 'قطعة').trim() || 'قطعة';
          const minStock = Math.max(0, Number(r.min_stock ?? r['الحد الأدنى'] ?? 5) || 5);
          const stockQty = Math.max(0, Number(r.stock ?? r.Stock ?? r['الكمية'] ?? 0) || 0);
          const cost = Math.max(0, Number(r.cost_price ?? r.Cost ?? r['سعر الشراء'] ?? 0) || 0);
          const sell = Math.max(0, Number(r.selling_price ?? r.Price ?? r['سعر البيع'] ?? 0) || 0);
          const wsPrice = r.wholesale_price !== undefined && r.wholesale_price !== '' ? Number(r.wholesale_price) : null;
          const expiry = r.expiry_date ? String(r.expiry_date).trim() : null;

          if (barcode && barcode.length >= 6) {
            dzStmt.run(barcode, name.slice(0, 120), category.slice(0, 60), supplier || '', unit, sell);
          }

          // إذا كان الملف هو القاموس الضخم (أكثر من 2000 سطر وأسعاره وكمياته 0) نكتفي بشحنه في القاموس الذكي + أول 500 منتج للمعاينة حتى لا يثقل جدول الكاشير بـ 31 ألف منتج صفري
          if (rows.length > 2000 && sell === 0 && cost === 0 && stockQty === 0 && imported >= 500) {
            skipped++;
            continue;
          }

          const existingId = barcode ? barcodeToIdMap.get(barcode) : null;
          if (existingId) {
            if (stockQty > 0 || cost > 0 || sell > 0) {
              batchStmt.run(existingId, stockQty, cost, sell, wsPrice, expiry);
              updated++;
            } else {
              skipped++;
            }
          } else {
            await new Promise((resolve) => {
              prodStmt.run([barcode, name, category, family, supplier, unit, minStock], function (err) {
                const newId = !err && this && this.lastID ? Number(this.lastID) : 0;
                if (newId > 0) {
                  if (barcode) barcodeToIdMap.set(barcode, newId);
                  batchStmt.run(newId, stockQty, cost, sell, wsPrice, expiry);
                  imported++;
                } else {
                  skipped++;
                }
                resolve();
              });
            });
          }
        }

        dzStmt.finalize();
        prodStmt.finalize();
        batchStmt.finalize();
      });
    });

    return { success: true, imported, updated, skipped, totalRows: rows.length };
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
        barcode: '6130001000012',
        name: 'زيت مائدة إيليو 5 لتر',
        category: 'مواد غذائية',
        family: 'زيوت',
        supplier: 'Cevital',
        cost_price: 590,
        selling_price: 650,
        wholesale_price: 630,
        stock: 48,
        min_stock: 10,
        unit: 'قارورة',
        expiry_date: '2027-12-31'
      }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('export-sales-excel', async () => {
    const rows = await dbAll(
      `SELECT s.id, s.doc_number, s.sale_date, COALESCE(c.name, 'زبون عابر') AS customer_name,
              s.subtotal, s.discount, s.tax_percentage, s.stamp_amount, s.total, s.paid_amount, s.payment_method
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.deleted_at IS NULL ORDER BY s.id DESC`
    );
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
    const rows = await dbAll(
      'SELECT name, phone, address, rc, nif, ai, nis, initial_debt, credit_limit, loyalty_points, price_tier FROM customers WHERE deleted_at IS NULL ORDER BY id DESC'
    );
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

  ipcMain.handle('import-customers-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const wb = XLSX.readFile(filePaths[0]);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let imported = 0;

    await db.withTransaction(async () => {
      for (const r of rows) {
        const name = String(r.name || r['الاسم'] || r['اسم الزبون'] || r.Nom || '').trim();
        if (!name) continue;
        await dbRun(
          `INSERT INTO customers (name, phone, address, rc, nif, ai, nis, initial_debt, credit_limit, price_tier)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            String(r.phone || r['الهاتف'] || '').trim() || null,
            String(r.address || r['العنوان'] || '').trim() || null,
            String(r.rc || '').trim() || null,
            String(r.nif || '').trim() || null,
            String(r.ai || '').trim() || null,
            String(r.nis || '').trim() || null,
            Number(r.initial_debt ?? r['الدين الأولي'] ?? 0),
            Number(r.credit_limit ?? r['سقف الدين'] ?? 0),
            String(r.price_tier || '').trim() || null
          ]
        );
        imported += 1;
      }
    });
    return { success: true, imported };
  });

  ipcMain.handle('download-customers-template', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'Gherbi_Customers_Template.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        name: 'مؤسسة الأمل للتجارة',
        phone: '0550123456',
        address: 'الجزائر العاصمة',
        rc: '16/00-1234567B19',
        nif: '001916123456789',
        ai: '16001234567',
        nis: '0999160012345',
        initial_debt: 0,
        credit_limit: 50000,
        price_tier: 'wholesale'
      }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'CustomersTemplate');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('export-suppliers-excel', async () => {
    const rows = await dbAll(
      'SELECT name, phone, address, rc, nif, ai, nis, initial_debt FROM suppliers WHERE deleted_at IS NULL ORDER BY id DESC'
    );
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

  ipcMain.handle('import-suppliers-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const wb = XLSX.readFile(filePaths[0]);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let imported = 0;

    await db.withTransaction(async () => {
      for (const r of rows) {
        const name = String(r.name || r['الاسم'] || r['اسم المورد'] || r.Nom || '').trim();
        if (!name) continue;
        await dbRun(
          `INSERT INTO suppliers (name, phone, address, rc, nif, ai, nis, initial_debt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            String(r.phone || r['الهاتف'] || '').trim() || null,
            String(r.address || r['العنوان'] || '').trim() || null,
            String(r.rc || '').trim() || null,
            String(r.nif || '').trim() || null,
            String(r.ai || '').trim() || null,
            String(r.nis || '').trim() || null,
            Number(r.initial_debt ?? r['الدين الأولي'] ?? 0)
          ]
        );
        imported += 1;
      }
    });
    return { success: true, imported };
  });

  ipcMain.handle('download-suppliers-template', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'Gherbi_Suppliers_Template.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        name: 'مجمع التوزيع الغذائي',
        phone: '0560987654',
        address: 'المنطقة الصناعية رويبة',
        rc: '16/00-9876543B18',
        nif: '001816987654321',
        ai: '16009876543',
        nis: '0998160098765',
        initial_debt: 0
      }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'SuppliersTemplate');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  ipcMain.handle('seed-demo-data', async () => {
    const sampleProducts = [
      { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (Elio)', category: 'مواد غذائية', supplier: 'مجمع سيفيتال', unit: 'قارورة', cost_price: 590, selling_price: 650, wholesale_price: 630, stock: 45, min_stock: 8 },
      { barcode: '6130002000035', name: 'حليب مجفف لويا 500غ (Loya)', category: 'أجبان وألبان', supplier: 'مؤسسة التوزيع الغذائي', unit: 'علبة', cost_price: 430, selling_price: 510, wholesale_price: 485, stock: 60, min_stock: 10 },
      { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (Bonal)', category: 'مشروبات وقهوة', supplier: 'مؤسسة التوزيع الغذائي', unit: 'علبة', cost_price: 260, selling_price: 320, wholesale_price: 300, stock: 80, min_stock: 15 },
      { barcode: '6130001000043', name: 'سكر أبيض سيفيتال 1 كغ (Scor)', category: 'مواد غذائية', supplier: 'مجمع سيفيتال', unit: 'كيس', cost_price: 85, selling_price: 105, wholesale_price: 98, stock: 120, min_stock: 20 },
      { barcode: '6130005000032', name: 'عصير رويبة ممتاز 1 لتر (Rouiba)', category: 'مشروبات وقهوة', supplier: 'مؤسسة المشروبات', unit: 'علبة', cost_price: 115, selling_price: 160, wholesale_price: 145, stock: 75, min_stock: 12 },
      { barcode: '6130008000022', name: 'كسكس ماما رقيق 1 كغ (Mama)', category: 'مواد غذائية', supplier: 'مطاحن الشرق', unit: 'كيس', cost_price: 125, selling_price: 160, wholesale_price: 148, stock: 90, min_stock: 15 },
      { barcode: '6130003000034', name: 'جبن طري شيدر الصومام 16 قطعة', category: 'أجبان وألبان', supplier: 'مؤسسة الألبان', unit: 'علبة', cost_price: 170, selling_price: 210, wholesale_price: 195, stock: 65, min_stock: 10 },
      { barcode: '6130005000018', name: 'ماء معدني إيفري 1.5 لتر (Ifri)', category: 'مشروبات وقهوة', supplier: 'مؤسسة المشروبات', unit: 'قارورة', cost_price: 30, selling_price: 45, wholesale_price: 38, stock: 200, min_stock: 24 },
      { barcode: '00105', plu_code: '00105', name: 'لوز مقشر ممتاز (ميزان)', category: 'مكسرات وحلويات', supplier: 'مؤسسة التوزيع الغذائي', unit: 'كغ', cost_price: 1900, selling_price: 2400, wholesale_price: 2200, stock: 25, min_stock: 5 }
    ];

    await db.withTransaction(async () => {
      for (const p of sampleProducts) {
        const ex = await dbGet('SELECT id FROM products WHERE barcode = ? AND deleted_at IS NULL', [p.barcode]);
        if (ex) continue;
        await ensureSupplierByName(p.supplier);
        const ins = await dbRun(
          'INSERT INTO products (barcode, name, category, supplier, unit, min_stock, plu_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [p.barcode, p.name, p.category, p.supplier, p.unit, p.min_stock, p.plu_code || null]
        );
        await dbRun(
          'INSERT INTO inventory_batches (product_id, stock, cost_price, selling_price, wholesale_price) VALUES (?, ?, ?, ?, ?)',
          [ins.lastID, p.stock, p.cost_price, p.selling_price, p.wholesale_price]
        );
      }

      const custCount = await dbGet('SELECT COUNT(*) AS c FROM customers WHERE deleted_at IS NULL');
      if (Number(custCount.c || 0) === 0) {
        await dbRun(
          'INSERT INTO customers (name, phone, address, initial_debt, credit_limit, loyalty_points, price_tier) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['أمين بن يحيى (زبون وفي VIP)', '0550112233', 'قسنطينة', 4500, 50000, 45, 'wholesale']
        );
        await dbRun(
          'INSERT INTO customers (name, phone, address, initial_debt, credit_limit, loyalty_points, price_tier) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['محمد أمين بن علي', '0661223344', 'الجزائر الوسطى', 0, 20000, 12, 'retail']
        );
      }
    });
    return { success: true };
  });

  
  
  ipcMain.handle('assign-sale-customer', async (_e, payload = {}) => {
    const saleId = Number(payload.saleId || payload.sale_id || 0);
    const customerId = payload.customerId || payload.customer_id ? Number(payload.customerId || payload.customer_id) : null;
    if (!saleId) throw new Error('رقم الفاتورة غير صالح');

    return await db.withTransaction(async () => {
      const sale = await dbGet('SELECT id, total, customer_id FROM sales WHERE id = ? AND deleted_at IS NULL', [saleId]);
      if (!sale) throw new Error('الفاتورة غير موجودة');

      await dbRun('UPDATE sales SET customer_id = ? WHERE id = ?', [customerId, saleId]);
      await dbRun('UPDATE sale_payments SET customer_id = ? WHERE sale_id = ?', [customerId, saleId]);

      if (customerId && Number(sale.total || 0) > 0 && Number(sale.customer_id || 0) !== customerId) {
        const ptsRate = Number(await db.getSetting('loyalty_points_per_100_dzd', '1')) || 1;
        const earnedPts = Math.floor((Number(sale.total || 0) / 100) * ptsRate);
        if (earnedPts > 0) {
          await dbRun('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?', [earnedPts, customerId]);
        }
      }
      return { success: true, saleId, customerId };
    });
  });

  ipcMain.handle('bulk-assign-walkin-sales-to-customer', async (_e, payload = {}) => {
    const customerId = Number(payload.customerId || payload.customer_id || 0);
    if (!customerId) throw new Error('يرجى اختيار الزبون');

    return await db.withTransaction(async () => {
      const walkinSales = await dbAll('SELECT id, total FROM sales WHERE customer_id IS NULL AND deleted_at IS NULL');
      const totalAmt = walkinSales.reduce((s, r) => s + Math.max(0, Number(r.total || 0)), 0);
      await dbRun('UPDATE sales SET customer_id = ? WHERE customer_id IS NULL AND deleted_at IS NULL', [customerId]);
      await dbRun('UPDATE sale_payments SET customer_id = ? WHERE customer_id IS NULL AND deleted_at IS NULL', [customerId]);

      const ptsRate = Number(await db.getSetting('loyalty_points_per_100_dzd', '1')) || 1;
      const earnedPts = Math.floor((totalAmt / 100) * ptsRate);
      if (earnedPts > 0) {
        await dbRun('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?', [earnedPts, customerId]);
      }
      return { success: true, updatedCount: walkinSales.length, earnedPts };
    });
  });

  ipcMain.handle('redeem-customer-loyalty-points', async (_e, payload = {}) => {
    const customerId = Number(payload.customerId || payload.customer_id || 0);
    const pointsToRedeem = Math.max(0, Number(payload.points || 0));
    const saleId = payload.saleId ? Number(payload.saleId) : null;
    if (!customerId || pointsToRedeem <= 0) return { success: false };

    return await db.withTransaction(async () => {
      await dbRun(
        'UPDATE customers SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?) WHERE id = ?',
        [pointsToRedeem, customerId]
      );
      await dbRun(
        'INSERT INTO loyalty_transactions (customer_id, sale_id, points_delta, reason) VALUES (?, ?, ?, ?)',
        [customerId, saleId, -pointsToRedeem, payload.reason || 'اختزال نقاط ولاء في فاتورة بيع']
      );
      return { success: true };
    });
  });

  ipcMain.handle('get-algerian-fiscal-report', async (_e, params = {}) => {
    const dateFrom = params.dateFrom ? String(params.dateFrom).slice(0, 10) : null;
    const dateTo = params.dateTo ? String(params.dateTo).slice(0, 10) : null;

    const sConds = ['s.deleted_at IS NULL', 's.total > 0'];
    const sParams = [];
    if (dateFrom) { sConds.push('date(s.sale_date) >= date(?)'); sParams.push(dateFrom); }
    if (dateTo) { sConds.push('date(s.sale_date) <= date(?)'); sParams.push(dateTo); }

    const etat104Rows = await dbAll(
      `SELECT
        c.id,
        c.name,
        c.phone,
        c.address,
        COALESCE(c.rc, '') AS rc,
        COALESCE(c.nif, '') AS nif,
        COALESCE(c.ai, '') AS ai,
        COALESCE(c.nis, '') AS nis,
        COUNT(s.id) AS invoices_count,
        ROUND(COALESCE(SUM(s.total - s.stamp_amount - CASE WHEN s.tax_percentage > 0 THEN (s.total * s.tax_percentage / (100.0 + s.tax_percentage)) ELSE 0 END), 0), 2) AS total_ht,
        ROUND(COALESCE(SUM(CASE WHEN s.tax_percentage > 0 THEN (s.total * s.tax_percentage / (100.0 + s.tax_percentage)) ELSE 0 END), 0), 2) AS total_tva,
        ROUND(COALESCE(SUM(s.stamp_amount), 0), 2) AS total_stamp,
        ROUND(COALESCE(SUM(s.total), 0), 2) AS total_ttc
      FROM customers c
      INNER JOIN sales s ON s.customer_id = c.id AND ${sConds.join(' AND ')}
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY total_ttc DESC`,
      sParams
    );

    const g50Sales = (await dbGet(
      `SELECT
        ROUND(COALESCE(SUM(s.total - s.stamp_amount - CASE WHEN s.tax_percentage > 0 THEN (s.total * s.tax_percentage / (100.0 + s.tax_percentage)) ELSE 0 END), 0), 2) AS ca_ht,
        ROUND(COALESCE(SUM(CASE WHEN s.tax_percentage > 0 THEN (s.total * s.tax_percentage / (100.0 + s.tax_percentage)) ELSE 0 END), 0), 2) AS tva_collectee,
        ROUND(COALESCE(SUM(s.stamp_amount), 0), 2) AS droit_timbre,
        ROUND(COALESCE(SUM(s.total), 0), 2) AS ca_ttc
      FROM sales s
      WHERE ${sConds.join(' AND ')}`,
      sParams
    )) || {};

    const pConds = ['pi.deleted_at IS NULL'];
    const pParams = [];
    if (dateFrom) { pConds.push('date(pi.date) >= date(?)'); pParams.push(dateFrom); }
    if (dateTo) { pConds.push('date(pi.date) <= date(?)'); pParams.push(dateTo); }

    const g50Purchases = (await dbGet(
      `SELECT
        ROUND(COALESCE(SUM(pi.subtotal), 0), 2) AS achats_ht,
        ROUND(COALESCE(SUM(pi.subtotal * pi.tax_percentage / 100.0), 0), 2) AS tva_deductible,
        ROUND(COALESCE(SUM(pi.total), 0), 2) AS achats_ttc
      FROM purchase_invoices pi
      WHERE ${pConds.join(' AND ')}`,
      pParams
    )) || {};

    const tvaCollectee = Number(g50Sales.tva_collectee || 0);
    const tvaDeductible = Number(g50Purchases.tva_deductible || 0);
    const timbre = Number(g50Sales.droit_timbre || 0);
    const tapRate = 0; // TAP ألغيت في قانون المالية الجزائري الحديث، وتبقى TVA + الطابع
    const tvaAPayer = Math.max(0, Number((tvaCollectee - tvaDeductible).toFixed(2)));
    const totalG50 = Number((tvaAPayer + timbre).toFixed(2));

    return {
      etat104: etat104Rows,
      g50: {
        ca_ht: Number(g50Sales.ca_ht || 0),
        ca_ttc: Number(g50Sales.ca_ttc || 0),
        tva_collectee: tvaCollectee,
        achats_ht: Number(g50Purchases.achats_ht || 0),
        tva_deductible: tvaDeductible,
        tva_a_payer: tvaAPayer,
        droit_timbre: timbre,
        tap_rate: tapRate,
        total_a_payer: totalG50
      }
    };
  });

  ipcMain.handle('export-etat104-excel', async (_e, rows = []) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'تصدير كشف الزبائن الجبائي (État 104)',
      defaultPath: `Etat_104_Algérie_${new Date().getFullYear()}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { canceled: true };

    const formatted = (rows || []).map((r, i) => ({
      'N°': i + 1,
      'الزبون / المؤسسة (Raison Sociale)': r.name,
      'العنوان (Adresse)': r.address || '',
      'رقم التعريف الجبائي (NIF)': r.nif || '',
      'السجل التجاري (RC)': r.rc || '',
      'المادة الجبائية (AI)': r.ai || '',
      'الرقم الإحصائي (NIS)': r.nis || '',
      'رقم الأعمال خارج الرسم (CA HT)': r.total_ht,
      'مبلغ الضريبة (TVA 19%)': r.total_tva,
      'حقوق الطابع (Timbre)': r.total_stamp,
      'الإجمالي بكل الرسوم (Total TTC)': r.total_ttc
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formatted);
    XLSX.utils.book_append_sheet(wb, ws, 'Etat_104_Clients');
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  });

  
  ipcMain.handle('get-cheques-portfolio', async (_e, filters = {}) => {
    const conds = ['deleted_at IS NULL'];
    const params = [];
    if (filters.status) { conds.push('status = ?'); params.push(filters.status); }
    if (filters.direction) { conds.push('direction = ?'); params.push(filters.direction); }
    return await dbAll(`SELECT * FROM cheques_portfolio WHERE ${conds.join(' AND ')} ORDER BY due_date ASC, id DESC`, params);
  });

  ipcMain.handle('save-cheque-record', async (_e, payload = {}) => {
    if (payload.id) {
      await dbRun(
        'UPDATE cheques_portfolio SET direction=?, party_name=?, cheque_number=?, bank_name=?, amount=?, due_date=?, status=?, notes=? WHERE id=?',
        [
          payload.direction || 'in',
          payload.party_name || '',
          payload.cheque_number || '',
          payload.bank_name || 'BNA',
          Number(payload.amount || 0),
          payload.due_date || new Date().toISOString().slice(0, 10),
          payload.status || 'pending',
          payload.notes || '',
          Number(payload.id)
        ]
      );
      return { success: true, id: Number(payload.id) };
    }
    const ins = await dbRun(
      'INSERT INTO cheques_portfolio (direction, party_name, cheque_number, bank_name, amount, issue_date, due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        payload.direction || 'in',
        payload.party_name || '',
        payload.cheque_number || '',
        payload.bank_name || 'BNA',
        Number(payload.amount || 0),
        new Date().toISOString().slice(0, 10),
        payload.due_date || new Date().toISOString().slice(0, 10),
        payload.status || 'pending',
        payload.notes || ''
      ]
    );
    return { success: true, id: ins.lastID };
  });

  ipcMain.handle('update-cheque-status', async (_e, id, status) => {
    await dbRun('UPDATE cheques_portfolio SET status = ? WHERE id = ?', [String(status), Number(id)]);
    return { success: true };
  });

  ipcMain.handle('delete-cheque-record', async (_e, id) => {
    await dbRun('DELETE FROM cheques_portfolio WHERE id = ?', [Number(id)]);
    return { success: true };
  });

  
  // مستورد تدفقي فائق السرعة لملفات المنتجات الجزائرية الضخمة (Lumina_DZ_Products.csv / Lumina_Ultimate_Products.csv)
  ipcMain.removeHandler('import-dz-master-csv');
  ipcMain.handle('import-dz-master-csv', async (_e, autoPath = null) => {
    let targetFile = autoPath;
    if (!targetFile || !fs.existsSync(targetFile)) {
      // البحث التلقائي عن ملفات CSV الجزائرية في المجلدات المجاورة أولاً
      const autoCandidates = [
        path.join(__dirname, 'Lumina_DZ_Products.csv'),
        path.join(__dirname, 'Lumina_Ultimate_Products.csv'),
        path.join(__dirname, '..', 'Lumina_DZ_Products.csv'),
        path.join(__dirname, '..', 'Lumina_Ultimate_Products.csv'),
        path.join(__dirname, '..', '..', 'codebreaker', 'Lumina_DZ_Products.csv'),
        path.join(__dirname, '..', '..', 'codebreaker', 'Lumina_Ultimate_Products.csv')
      ];
      const foundAuto = autoCandidates.find((p) => fs.existsSync(p));
      if (foundAuto && autoPath === 'auto') {
        targetFile = foundAuto;
      } else {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'استيراد قاعدة البيانات الوطنية للمنتجات الجزائرية (CSV / Excel)',
          defaultPath: foundAuto ? path.dirname(foundAuto) : undefined,
          filters: [{ name: 'CSV / Excel', extensions: ['csv', 'xlsx', 'xls'] }],
          properties: ['openFile']
        });
        if (canceled || !filePaths || !filePaths[0]) return { canceled: true };
        targetFile = filePaths[0];
      }
    }

    const readline = require('readline');
    const ext = path.extname(targetFile).toLowerCase();
    let imported = 0;

    if (ext === '.csv') {
      const fileStream = fs.createReadStream(targetFile, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      let headers = null;
      let batchRows = [];

      const flushBatch = async (rowsToFlush) => {
        if (rowsToFlush.length === 0) return;
        await db.withTransaction(async (tx) => {
          for (const item of rowsToFlush) {
            await tx.run(
              'INSERT OR REPLACE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)',
              item
            );
          }
        });
      };

      for await (const line of rl) {
        if (!line || !line.trim()) continue;
        const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (!headers) {
          headers = cols.map((h) => h.toLowerCase());
          continue;
        }
        const bcIdx = headers.indexOf('barcode') !== -1 ? headers.indexOf('barcode') : 0;
        const nameIdx = headers.indexOf('name') !== -1 ? headers.indexOf('name') : 1;
        const catIdx = headers.indexOf('category') !== -1 ? headers.indexOf('category') : 2;
        const supIdx = headers.indexOf('supplier') !== -1 ? headers.indexOf('supplier') : 3;
        const prcIdx = headers.indexOf('selling_price') !== -1 ? headers.indexOf('selling_price') : 4;

        const bc = String(cols[bcIdx] || '').trim();
        const name = String(cols[nameIdx] || '').trim();
        if (!bc || !name || bc.length < 6) continue;

        batchRows.push([
          bc,
          name.slice(0, 120),
          String(cols[catIdx] || 'عام').slice(0, 60),
          String(cols[supIdx] || '').slice(0, 60),
          'قطعة',
          Number(cols[prcIdx] || 0) || 0
        ]);
        imported++;

        if (batchRows.length >= 1500) {
          await flushBatch(batchRows);
          batchRows = [];
        }
      }
      if (batchRows.length > 0) {
        await flushBatch(batchRows);
      }
    } else {
      const wb = XLSX.readFile(targetFile);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      await db.withTransaction(async (tx) => {
        for (const r of rows) {
          const bc = String(r.barcode || r.Barcode || r['الباركود'] || r.code || '').trim();
          const name = String(r.name || r.Name || r['الاسم'] || r.product_name || '').trim();
          if (!bc || !name) continue;
          const cat = String(r.category || r.Category || r['الفئة'] || 'عام').trim();
          const brand = String(r.supplier || r.brand || r.Brand || r['العلامة'] || '').trim();
          const price = Number(r.selling_price || r.price || r['السعر'] || 0);
          await tx.run(
            'INSERT OR REPLACE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)',
            [bc, name, cat, brand, 'قطعة', price]
          );
          imported++;
        }
      });
    }

    return { success: true, imported, filePath: targetFile };
  });

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

  // 12. الميزان، الشبكة، المزامنة السحابية، والتراخيص
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
  enterpriseBridge.registerEnterpriseIpcHandlers(ipcMain, db, isLanClientMode, lanClient);
}


async function autoSeedDzCsvIfFound() {
  try {
    const countRow = await dbGet('SELECT COUNT(*) AS c FROM dz_product_dictionary');
    if (Number((countRow && countRow.c) || 0) > 500) return;

    const candidatePaths = [
      path.join(__dirname, 'Lumina_DZ_Products.csv'),
      path.join(__dirname, 'Lumina_Ultimate_Products.csv'),
      path.join(__dirname, 'Inventory_products.xlsx'),
      path.join(__dirname, '..', 'Lumina_DZ_Products.csv'),
      path.join(__dirname, '..', 'Lumina_Ultimate_Products.csv'),
      path.join(__dirname, '..', 'Inventory_products.xlsx'),
      path.join(__dirname, '..', 'GHERBI.AI POS', 'Inventory_products.xlsx'),
      path.join(__dirname, '..', '..', 'codebreaker', 'Lumina_DZ_Products.csv'),
      path.join(__dirname, '..', '..', 'codebreaker', 'Lumina_Ultimate_Products.csv'),
      path.join(__dirname, '..', '..', 'Lumina_DZ_Products.csv'),
      path.join(__dirname, '..', '..', 'Lumina_Ultimate_Products.csv')
    ];

    const foundCsv = candidatePaths.find((p) => fs.existsSync(p));
    if (!foundCsv) return;

    console.log('[DZ Dictionary] Auto-importing Algerian products from:', foundCsv);
    const wb = XLSX.readFile(foundCsv, { raw: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    await db.withTransaction(async () => {
      const stmt = db._rawPrepare(
        'INSERT OR IGNORE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)'
      );
      let count = 0;
      for (const r of rows) {
        const bc = String(r.barcode || r.code || '').trim();
        const name = String(r.name || r.product_name || '').trim();
        if (!bc || !name) continue;
        stmt.run(
          bc,
          name.slice(0, 120),
          String(r.category || 'مواد غذائية').trim().slice(0, 50),
          String(r.supplier || r.brand || '').trim().slice(0, 50),
          'قطعة',
          Number(r.selling_price || 0) || 0
        );
        count++;
        if (count >= 25000) break;
      }
      stmt.finalize();
      console.log(`[DZ Dictionary] Successfully seeded ${count} products!`);
    });
  } catch (err) {
    console.warn('[DZ Dictionary] Auto-seed skipped:', err.message);
  }
}

app.whenReady().then(async () => {
  await autoSeedDzCsvIfFound();
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