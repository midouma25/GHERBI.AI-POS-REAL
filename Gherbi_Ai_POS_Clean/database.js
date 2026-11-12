/**
 * database.js
 * المخطط الشامل لقاعدة بيانات Gherbi.Ai POS (46 جدولاً، فهارس الأداء، مشغلات المزامنة والمخزون،
 * القاموس الجزائري لباركود 613، نظام البيع بالتقسيط، وسجل الرقابة الأمنية للكاشير)
 */

'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { attachWriteQueue } = require('./db-write-queue');
const { installSoftDeleteShim } = require('./soft-delete');
const { installDataRevisionHook, tracker: dataRevisionTracker } = require('./data-revision');

function resolveDatabaseFilePath() {
  try {
    const electron = require('electron');
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && typeof app.getPath === 'function') {
      const dir = app.getPath('userData');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, 'gherbi_ai_pos.db');
    }
  } catch (_) {}

  const fallbackDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  return path.join(fallbackDir, 'gherbi_ai_pos.db');
}

const dbPath = resolveDatabaseFilePath();
const db = new sqlite3.Database(dbPath);

attachWriteQueue(db);
installSoftDeleteShim(db);
installDataRevisionHook(db);

const SYNCED_TABLES = [
  'products',
  'product_barcodes',
  'product_prices',
  'product_option_groups',
  'product_option_values',
  'product_variants',
  'variant_option_values',
  'product_bundles',
  'bundle_items',
  'product_promotions',
  'product_serials',
  'inventory_batches',
  'stock_debt',
  'suppliers',
  'purchase_invoices',
  'purchase_items',
  'invoice_payments',
  'supplier_returns',
  'supplier_return_items',
  'customers',
  'loyalty_transactions',
  'sales',
  'sale_items',
  'sale_payments',
  'proforma_invoices',
  'proforma_items',
  'customer_orders',
  'customer_order_items',
  'inventory_reservations',
  'caisse_sessions',
  'caisse_transactions',
  'expenses',
  'capital_injections',
  'bom_recipes',
  'bom_components',
  'production_orders',
  'production_order_items',
  'stocktakes',
  'stocktake_items',
  'users',
  'shop_info',
  'custom_templates',
  'installment_plans',
  'installment_schedules',
  'cheques_portfolio',
  'audit_logs'
];

const DEFAULT_SETTINGS = {
  shop_name: 'Gherbi.Ai POS',
  shop_description: 'تجارة عامة وتوزيع',
  shop_address: 'الجزائر',
  shop_phone: '',
  shop_fax: '',
  shop_email: '',
  shop_rc: '',
  shop_nif: '',
  shop_ai: '',
  shop_nis: '',
  shop_logo: '',
  shop_ccp: '',
  shop_baridimob_rip: '',
  app_lang: 'ar',
  receipt_lang: 'ar',
  invoice_template: 'template1',
  receipt_template: 'receipt1',
  receipt_paper_width_mm: '80',
  silent_print: 'false',
  show_receipt_barcode: 'true',
  pos_card_size: 'medium',
  pos_show_images: 'true',
  pos_page_size: '24',
  network_scope: 'local',
  network_mode: 'server',
  server_ip: '192.168.1.15',
  client_ip: '',
  server_port: '8080',
  auto_discovery: 'true',
  enable_cloud_relay: 'false',
  instance_id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
  cloud_url: 'https://cloud.gherbi.ai',
  cloud_token: '',
  last_cloud_sync_at: '',
  sync_mode: 'local',
  cloud_pull_interval_ms: '15000',
  cloud_push_interval_ms: '8000',
  cloud_realtime_enabled: 'true',
  cloud_snapshot_done: '0',
  cloud_role: 'owner',
  sale_edit_window_days: '30',
  caisse_require_session: 'false',
  allow_negative_stock: 'true',
  negative_stock_requires_confirm: 'false',
  pricing_method: 'fifo',
  manufacturing_enabled: 'true',
  manufacturing_margin_default: '0',
  manufacturing_allow_expired: 'false',
  manufacturing_auto_on_sale: 'false',
  manufacturing_auto_daily_cap: '0',
  label_width_mm: '40',
  label_height_mm: '25',
  label_barcode_height_mm: '12',
  label_show_shop_name: 'false',
  label_show_product_name: 'true',
  label_show_price: 'false',
  label_show_price_type: 'false',
  label_show_barcode_text: 'true',
  label_show_variants: 'false',
  label_show_discount: 'false',
  label_default_content_v2: '1',
  scan_alert_sounds: 'true',
  scan_alert_volume: '0.8',
  scale_barcode_enabled: 'true',
  scale_barcode_prefix: '20',
  scale_barcode_plu_length: '5',
  scale_barcode_value_length: '5',
  scale_barcode_value_type: 'weight',
  scale_barcode_value_decimals: '3',
  usb_scale_enabled: 'false',
  usb_scale_port: '',
  usb_scale_baud: '9600',
  usb_scale_databits: '8',
  usb_scale_parity: 'None',
  usb_scale_stopbits: '1',
  usb_scale_mode: 'stream',
  usb_scale_poll_cmd: 'W\\r\\n',
  usb_scale_poll_ms: '250',
  usb_scale_protocol: 'auto',
  usb_scale_custom_regex: '',
  usb_scale_unit: 'kg',
  usb_scale_divisor: '1',
  usb_scale_min_weight: '0.005',
  usb_scale_stable_frames: '3',
  usb_scale_auto_add: 'false',
  usb_scale_tare_cmd: 'T\\r\\n',
  usb_scale_zero_cmd: 'Z\\r\\n',
  loyalty_enabled: 'true',
  stamp_duty_mode: 'progressive_dz',
  loyalty_points_per_100_dzd: '1',
  zakat_gold_price_per_gram: '14500',
  ai_copilot_enabled: 'true',
  gemini_api_key: ''
};

const DEFAULT_DOCUMENT_COUNTERS = [
  { doc_type: 'invoice', prefix_format: 'FAC-{YYYY}-{0000}' },
  { doc_type: 'proforma', prefix_format: 'PRO-{YYYY}-{0000}' },
  { doc_type: 'order', prefix_format: 'BC-{YYYY}-{0000}' },
  { doc_type: 'delivery', prefix_format: 'BL-{YYYY}-{0000}' },
  { doc_type: 'reception', prefix_format: 'BR-{YYYY}-{0000}' },
  { doc_type: 'payment_receipt', prefix_format: 'REC-{YYYY}-{0000}' },
  { doc_type: 'avoir', prefix_format: 'AV-{YYYY}-{0000}' },
  { doc_type: 'recap', prefix_format: 'FR-{YYYY}-{0000}' },
  { doc_type: 'sales_summary', prefix_format: 'RM-{YYYY}-{0000}' },
  { doc_type: 'supplier_return', prefix_format: 'RF-{YYYY}-{0000}' },
  { doc_type: 'production', prefix_format: 'PRD-{YYYY}-{0000}' },
  { doc_type: 'stocktake', prefix_format: 'INV-{YYYY}-{0000}' },
  { doc_type: 'warranty', prefix_format: 'GAR-{YYYY}-{0000}' }
];

/**
 * القاموس الجزائري المدمج للمنتجات كثيرة الدوران (بادئة 613) للتعرف الفوري بدون إنترنت
 */
const DEFAULT_DZ_DICTIONARY = [
  { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (Elio)', category: 'مواد غذائية', brand: 'Cevital', unit: 'قارورة', suggested_price: 650 },
  { barcode: '6130001000029', name: 'زيت مائدة إيليو 2 لتر (Elio)', category: 'مواد غذائية', brand: 'Cevital', unit: 'قارورة', suggested_price: 270 },
  { barcode: '6130001000036', name: 'زيت مائدة فلوريال 1 لتر (Fleurial)', category: 'مواد غذائية', brand: 'Cevital', unit: 'قارورة', suggested_price: 140 },
  { barcode: '6130001000043', name: 'سكر أبيض سيفيتال 1 كغ (Scor)', category: 'مواد غذائية', brand: 'Cevital', unit: 'كيس', suggested_price: 105 },
  { barcode: '6130001000050', name: 'سمن نباتي مدينة 500غ (Medina)', category: 'مواد غذائية', brand: 'Cevital', unit: 'علبة', suggested_price: 240 },
  { barcode: '6130001000067', name: 'مارغارين فلوريال 250غ', category: 'مواد غذائية', brand: 'Cevital', unit: 'علبة', suggested_price: 120 },
  { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (Candia)', category: 'أجبان وألبان', brand: 'Tchin-Lait', unit: 'علبة', suggested_price: 150 },
  { barcode: '6130002000028', name: 'حليب بالشوكولاتة كاندي شوكو 200 مل', category: 'أجبان وألبان', brand: 'Tchin-Lait', unit: 'علبة', suggested_price: 55 },
  { barcode: '6130002000035', name: 'حليب مجفف لويا 500غ (Loya)', category: 'أجبان وألبان', brand: 'Loya', unit: 'علبة', suggested_price: 510 },
  { barcode: '6130003000010', name: 'ياغورت الصومام أكتيفيا 110غ', category: 'أجبان وألبان', brand: 'Soummam', unit: 'علبة', suggested_price: 35 },
  { barcode: '6130003000027', name: 'ياغورت الصومام فواكه ممزوج 90غ', category: 'أجبان وألبان', brand: 'Soummam', unit: 'علبة', suggested_price: 25 },
  { barcode: '6130003000034', name: 'جبن طري شيدر الصومام 16 قطعة', category: 'أجبان وألبان', brand: 'Soummam', unit: 'علبة', suggested_price: 210 },
  { barcode: '6130004000019', name: 'مشروب غازي حمود بوعلام أبيض 1 لتر (Selecto/la Blanche)', category: 'مشروبات وقهوة', brand: 'Hamoud Boualem', unit: 'قارورة', suggested_price: 110 },
  { barcode: '6130004000026', name: 'مشروب غازي سيليكتو 2 لتر (Selecto)', category: 'مشروبات وقهوة', brand: 'Hamoud Boualem', unit: 'قارورة', suggested_price: 170 },
  { barcode: '6130004000033', name: 'مشروب غازي كراش برتقال 1 لتر (Crush)', category: 'مشروبات وقهوة', brand: 'Hamoud Boualem', unit: 'قارورة', suggested_price: 110 },
  { barcode: '6130005000018', name: 'ماء معدني إيفري 1.5 لتر (Ifri)', category: 'مشروبات وقهوة', brand: 'Ifri', unit: 'قارورة', suggested_price: 45 },
  { barcode: '6130005000025', name: 'ماء معدني سعيدة 1.5 لتر (Saida)', category: 'مشروبات وقهوة', brand: 'Saida', unit: 'قارورة', suggested_price: 45 },
  { barcode: '6130005000032', name: 'عصير رويبة ممتاز 1 لتر (Rouiba)', category: 'مشروبات وقهوة', brand: 'Rouiba', unit: 'علبة', suggested_price: 160 },
  { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (Bonal)', category: 'مشروبات وقهوة', brand: 'Bonal', unit: 'علبة', suggested_price: 320 },
  { barcode: '6130006000024', name: 'قهوة مطحونة فاكتو 250غ (Facto)', category: 'مشروبات وقهوة', brand: 'Facto', unit: 'علبة', suggested_price: 310 },
  { barcode: '6130007000016', name: 'بسكويت بيمو 250غ (Bimo Galette)', category: 'بسكويت وحلويات', brand: 'Bimo', unit: 'علبة', suggested_price: 120 },
  { barcode: '6130007000023', name: 'بسكويت ماكسون محشو شوكولاتة (Maxon)', category: 'بسكويت وحلويات', brand: 'Palmary', unit: 'علبة', suggested_price: 90 },
  { barcode: '6130007000030', name: 'شوكولاتة الطلاء ماكسون 350غ', category: 'بسكويت وحلويات', brand: 'Palmary', unit: 'علبة', suggested_price: 350 },
  { barcode: '6130008000015', name: 'عجائن سباغيتي سيم 500غ (Sim)', category: 'مواد غذائية', brand: 'Sim', unit: 'كيس', suggested_price: 85 },
  { barcode: '6130008000022', name: 'كسكس ماما رقيق 1 كغ (Mama)', category: 'مواد غذائية', brand: 'Mama', unit: 'كيس', suggested_price: 160 },
  { barcode: '6130008000039', name: 'فرينة ممتازة ماما 1 كغ', category: 'مواد غذائية', brand: 'Mama', unit: 'كيس', suggested_price: 75 },
  { barcode: '6130009000014', name: 'طماطم مصبرة عمر بن عمر 800غ (CAB)', category: 'مصبرات وتوابل', brand: 'Benamor', unit: 'علبة', suggested_price: 290 },
  { barcode: '6130009000021', name: 'هريسة عمر بن عمر 135غ', category: 'مصبرات وتوابل', brand: 'Benamor', unit: 'علبة', suggested_price: 75 },
  { barcode: '6130009000038', name: 'تونة بالزيت ريكامار 80غ', category: 'مصبرات وتوابل', brand: 'Ricamar', unit: 'علبة', suggested_price: 145 },
  { barcode: '6130010000010', name: 'مسحوق غسيل إيزيس 750غ (Isis)', category: 'مواد تنظيف', brand: 'Henkel DZ', unit: 'علبة', suggested_price: 260 },
  { barcode: '6130010000027', name: 'سائل غسيل الأواني إيزيس 750 مل', category: 'مواد تنظيف', brand: 'Henkel DZ', unit: 'قارورة', suggested_price: 155 }
];

function safeAddColumn(table, columnDef) {
  db._rawRun(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`, () => {});
}

function createSyncTriggersForTable(table) {
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

function createStockLedgerTriggers() {
  db._rawRun('DROP TRIGGER IF EXISTS trg_inventory_batches_ledger_insert');
  db._rawRun('DROP TRIGGER IF EXISTS trg_inventory_batches_ledger_update');

  db._rawRun(`
    CREATE TRIGGER IF NOT EXISTS trg_inventory_batches_ledger_insert
    AFTER INSERT ON inventory_batches
    WHEN COALESCE((SELECT value FROM settings WHERE key = '_skip_stock_ledger'), '0') <> '1'
      AND COALESCE(NEW.stock, 0) <> 0
    BEGIN
      UPDATE inventory_batches
      SET uuid = COALESCE(NULLIF(uuid, ''), lower(hex(randomblob(16))))
      WHERE id = NEW.id;

      INSERT INTO stock_movements (
        uuid, batch_uuid, product_uuid, variant_uuid, delta, reason,
        origin_device, occurred_at, updated_at, dirty
      )
      SELECT
        lower(hex(randomblob(16))),
        ib.uuid,
        p.uuid,
        pv.uuid,
        COALESCE(NEW.stock, 0),
        'init',
        COALESCE((SELECT value FROM settings WHERE key = 'instance_id'), 'local'),
        strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        1
      FROM inventory_batches ib
      LEFT JOIN products p ON p.id = ib.product_id
      LEFT JOIN product_variants pv ON pv.id = ib.variant_id
      WHERE ib.id = NEW.id AND ib.uuid IS NOT NULL AND ib.uuid <> '';
    END;
  `);

  db._rawRun(`
    CREATE TRIGGER IF NOT EXISTS trg_inventory_batches_ledger_update
    AFTER UPDATE OF stock ON inventory_batches
    WHEN COALESCE((SELECT value FROM settings WHERE key = '_skip_stock_ledger'), '0') <> '1'
      AND ABS(COALESCE(NEW.stock, 0) - COALESCE(OLD.stock, 0)) > 0.000001
    BEGIN
      UPDATE inventory_batches
      SET uuid = COALESCE(NULLIF(uuid, ''), lower(hex(randomblob(16))))
      WHERE id = NEW.id AND (uuid IS NULL OR uuid = '');

      INSERT INTO stock_movements (
        uuid, batch_uuid, product_uuid, variant_uuid, delta, reason,
        origin_device, occurred_at, updated_at, dirty
      )
      SELECT
        lower(hex(randomblob(16))),
        COALESCE(NULLIF(NEW.uuid, ''), (SELECT uuid FROM inventory_batches WHERE id = NEW.id)),
        (SELECT uuid FROM products WHERE id = NEW.product_id),
        (SELECT uuid FROM product_variants WHERE id = NEW.variant_id),
        COALESCE(OLD.stock, 0),
        'init',
        COALESCE((SELECT value FROM settings WHERE key = 'instance_id'), 'local'),
        strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        1
      WHERE COALESCE(OLD.stock, 0) <> 0
        AND NOT EXISTS (
          SELECT 1 FROM stock_movements sm
          WHERE sm.batch_uuid = COALESCE(NULLIF(NEW.uuid, ''), (SELECT uuid FROM inventory_batches WHERE id = NEW.id))
        );

      INSERT INTO stock_movements (
        uuid, batch_uuid, product_uuid, variant_uuid, delta, reason,
        origin_device, occurred_at, updated_at, dirty
      )
      VALUES (
        lower(hex(randomblob(16))),
        COALESCE(NULLIF(NEW.uuid, ''), (SELECT uuid FROM inventory_batches WHERE id = NEW.id)),
        (SELECT uuid FROM products WHERE id = NEW.product_id),
        (SELECT uuid FROM product_variants WHERE id = NEW.variant_id),
        COALESCE(NEW.stock, 0) - COALESCE(OLD.stock, 0),
        'auto',
        COALESCE((SELECT value FROM settings WHERE key = 'instance_id'), 'local'),
        strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        1
      );
    END;
  `);
}

function tombstoneOrphans() {
  const nowStr = new Date().toISOString();
  const childTables = [
    'inventory_batches',
    'product_barcodes',
    'product_prices',
    'product_promotions',
    'product_option_groups',
    'product_variants',
    'bom_recipes'
  ];

  for (const tbl of childTables) {
    db._rawRun(
      `UPDATE ${tbl}
       SET deleted_at = ?, updated_at = ?, dirty = 1
       WHERE deleted_at IS NULL AND product_id IN (SELECT id FROM products WHERE deleted_at IS NOT NULL)`,
      [nowStr, nowStr]
    );
  }
}

function initializeDatabase() {
  db.serialize(() => {
    db._rawRun('PRAGMA journal_mode = WAL');
    db._rawRun('PRAGMA synchronous = NORMAL');
    db._rawRun('PRAGMA foreign_keys = ON');
    db._rawRun('PRAGMA busy_timeout = 10000');
    db._rawRun('PRAGMA temp_store = MEMORY');
    db._rawRun('PRAGMA cache_size = -32000');

    // 1. الإعدادات، معلومات المتجر، والمستخدمين
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT DEFAULT ''
      )
    `);

    const setStmt = db._rawPrepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      setStmt.run(k, String(v));
    }
    setStmt.finalize();

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS shop_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT,
        name TEXT,
        description TEXT,
        address TEXT,
        phone TEXT,
        fax TEXT,
        email TEXT,
        rc TEXT,
        nif TEXT,
        ai TEXT,
        nis TEXT,
        logo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'Cashier',
        permissions_json TEXT,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    // 2. المنتجات، الباركودات، مستويات الأسعار، المتغيرات، والأرقام التسلسلية
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        category TEXT,
        family TEXT,
        supplier TEXT,
        description TEXT,
        min_stock INTEGER DEFAULT 5,
        image TEXT,
        unit TEXT DEFAULT 'قطعة',
        color TEXT,
        weight_volume TEXT,
        wholesale_unit TEXT,
        wholesale_qty INTEGER,
        plu_code TEXT,
        has_variants INTEGER DEFAULT 0,
        is_featured INTEGER DEFAULT 0,
        material_role TEXT,
        track_serial INTEGER DEFAULT 0,
        warranty_months INTEGER DEFAULT 0,
        hide_from_pos INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);
    safeAddColumn('products', 'warranty_months INTEGER DEFAULT 0');

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS product_barcodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        barcode TEXT NOT NULL UNIQUE,
        price_label TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS product_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS product_option_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS product_option_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        option_group_id INTEGER NOT NULL,
        value TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (option_group_id) REFERENCES product_option_groups(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        barcode TEXT UNIQUE,
        sku TEXT,
        image TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS variant_option_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        variant_id INTEGER NOT NULL,
        option_value_id INTEGER NOT NULL,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
        FOREIGN KEY (option_value_id) REFERENCES product_option_values(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS product_serials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        batch_id INTEGER,
        serial_number TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'in_stock',
        sale_id INTEGER,
        warranty_months INTEGER DEFAULT 12,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // 3. الدفعات المخزنية، حركات المخزون، ديون المخزون، الحزم، والعروض
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS inventory_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        stock REAL NOT NULL DEFAULT 0,
        cost_price REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        wholesale_price REAL,
        expiry_date TEXT,
        location TEXT,
        display_code TEXT,
        supplier_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL,
        batch_uuid TEXT,
        product_uuid TEXT,
        variant_uuid TEXT,
        delta REAL NOT NULL,
        reason TEXT NOT NULL,
        ref_type TEXT,
        ref_uuid TEXT,
        origin_device TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        updated_at TEXT,
        deleted_at TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS stock_debt (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        batch_id INTEGER,
        sale_id INTEGER,
        quantity REAL NOT NULL DEFAULT 0,
        resolved INTEGER NOT NULL DEFAULT 0,
        resolved_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS product_bundles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT UNIQUE,
        selling_price REAL NOT NULL DEFAULT 0,
        cost_price REAL NOT NULL DEFAULT 0,
        description TEXT,
        image TEXT,
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
      CREATE TABLE IF NOT EXISTS bundle_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bundle_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (bundle_id) REFERENCES product_bundles(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS product_promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        discount_type TEXT NOT NULL,
        discount_value REAL NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        max_qty INTEGER,
        used_qty INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // 4. الموردون، المشتريات، دفعات الفواتير، ومرتجعات الموردين
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        rc TEXT,
        nif TEXT,
        ai TEXT,
        nis TEXT,
        initial_debt REAL DEFAULT 0,
        initial_debt_paid REAL DEFAULT 0,
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
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT,
        supplier_id INTEGER,
        subtotal REAL DEFAULT 0,
        tax_percentage REAL DEFAULT 0,
        additional_costs REAL DEFAULT 0,
        total REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        due_date TEXT,
        date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        product_id INTEGER,
        batch_id INTEGER,
        variant_id INTEGER,
        quantity REAL DEFAULT 1,
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        supplier_id INTEGER,
        amount REAL,
        date TEXT,
        payment_method TEXT,
        reference TEXT,
        receipt_number TEXT,
        notes TEXT,
        printed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS supplier_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT,
        supplier_id INTEGER,
        subtotal REAL DEFAULT 0,
        total REAL DEFAULT 0,
        credit_applied REAL DEFAULT 0,
        refund_amount REAL DEFAULT 0,
        refund_method TEXT,
        reason TEXT,
        notes TEXT,
        date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS supplier_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER,
        product_id INTEGER,
        variant_id INTEGER,
        batch_id INTEGER,
        source_invoice_id INTEGER,
        quantity REAL DEFAULT 1,
        cost_price REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (return_id) REFERENCES supplier_returns(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
      )
    `);

    // 5. الزبائن، نقاط الولاء، المبيعات، الفواتير الشكلية، والطلبيات
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        nif TEXT,
        rc TEXT,
        ai TEXT,
        nis TEXT,
        initial_debt REAL DEFAULT 0,
        initial_debt_paid REAL DEFAULT 0,
        credit_limit REAL DEFAULT 0,
        loyalty_points REAL DEFAULT 0,
        price_tier TEXT,
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
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        sale_id INTEGER,
        points_delta REAL NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_number TEXT,
        customer_id INTEGER,
        subtotal REAL DEFAULT 0,
        tax_percentage REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        due_date TEXT,
        sale_date TEXT,
        user_id INTEGER,
        session_id INTEGER,
        stamp_amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        split_payments_json TEXT,
        credit_note_number TEXT,
        credit_note_issued_at TEXT,
        original_sale_id INTEGER,
        original_invoice_number TEXT,
        original_invoice_date TEXT,
        credit_note_reason TEXT,
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
    safeAddColumn('sales', 'split_payments_json TEXT');

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        batch_id INTEGER,
        variant_id INTEGER,
        quantity REAL DEFAULT 1,
        price REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        cost_price REAL,
        applied_promotion_id INTEGER,
        custom_product_name TEXT,
        custom_cost_price REAL,
        serial_number TEXT,
        warranty_months INTEGER DEFAULT 0,
        sold_without_stock INTEGER DEFAULT 0,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
      )
    `);
    safeAddColumn('sale_items', 'warranty_months INTEGER DEFAULT 0');

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        customer_id INTEGER,
        amount REAL,
        date TEXT,
        payment_method TEXT,
        reference TEXT,
        receipt_number TEXT,
        notes TEXT,
        printed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS proforma_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_number TEXT,
        customer_id INTEGER,
        subtotal REAL DEFAULT 0,
        tax_percentage REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        validity_days INTEGER DEFAULT 15,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        converted_to_sale_id INTEGER,
        user_id INTEGER,
        session_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (converted_to_sale_id) REFERENCES sales(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS proforma_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proforma_id INTEGER,
        product_id INTEGER,
        batch_id INTEGER,
        variant_id INTEGER,
        quantity REAL DEFAULT 1,
        price REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        custom_product_name TEXT,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (proforma_id) REFERENCES proforma_invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS customer_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_number TEXT,
        customer_id INTEGER,
        subtotal REAL DEFAULT 0,
        tax_percentage REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        deposit_amount REAL DEFAULT 0,
        expected_delivery_date TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        reserves_stock INTEGER DEFAULT 1,
        converted_to_sale_id INTEGER,
        user_id INTEGER,
        session_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (converted_to_sale_id) REFERENCES sales(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS customer_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        batch_id INTEGER,
        variant_id INTEGER,
        quantity REAL DEFAULT 1,
        delivered_qty REAL DEFAULT 0,
        price REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        custom_product_name TEXT,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (order_id) REFERENCES customer_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS inventory_reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        batch_id INTEGER,
        product_id INTEGER,
        quantity REAL NOT NULL,
        released INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        released_at DATETIME,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (order_id) REFERENCES customer_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
      )
    `);

    // 6. الخزينة والمناوبات، المصاريف، ورأس المال
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS caisse_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        device_id TEXT,
        opening_balance REAL DEFAULT 0,
        closing_balance REAL,
        expected_balance REAL,
        difference REAL,
        status TEXT DEFAULT 'open',
        opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        close_note TEXT,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS caisse_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT,
        description TEXT,
        reference_id INTEGER,
        reference_uuid TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (session_id) REFERENCES caisse_sessions(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        user_id INTEGER,
        session_id INTEGER,
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
      CREATE TABLE IF NOT EXISTS capital_injections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    // 7. التصنيع (BOM) والجرد المخزني (Stocktake)
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS bom_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        name TEXT NOT NULL,
        output_qty REAL NOT NULL DEFAULT 1,
        extra_cost REAL DEFAULT 0,
        extra_cost_type TEXT DEFAULT 'per_batch',
        is_default INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        auto_on_sale INTEGER DEFAULT 0,
        auto_round TEXT DEFAULT 'exact',
        auto_target TEXT DEFAULT 'shortfall',
        sell_price REAL,
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
      CREATE TABLE IF NOT EXISTS bom_components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        component_product_id INTEGER NOT NULL,
        component_variant_id INTEGER,
        quantity REAL NOT NULL,
        unit_label TEXT,
        unit_qty REAL,
        waste_percent REAL DEFAULT 0,
        position INTEGER DEFAULT 0,
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
      CREATE TABLE IF NOT EXISTS production_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT,
        recipe_id INTEGER,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        planned_qty REAL NOT NULL,
        produced_qty REAL,
        status TEXT DEFAULT 'draft',
        components_cost REAL DEFAULT 0,
        extra_cost REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        output_batch_id INTEGER,
        output_expiry_date TEXT,
        output_selling_price REAL,
        output_wholesale_price REAL,
        trigger_source TEXT DEFAULT 'manual',
        sale_id INTEGER,
        user_id INTEGER,
        note TEXT,
        order_date TEXT NOT NULL,
        confirmed_at TEXT,
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
      CREATE TABLE IF NOT EXISTS production_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        component_product_id INTEGER NOT NULL,
        component_variant_id INTEGER,
        batch_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_cost REAL NOT NULL,
        subtotal REAL NOT NULL,
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
      CREATE TABLE IF NOT EXISTS stocktakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT,
        status TEXT DEFAULT 'closed',
        scope_type TEXT,
        scope_value TEXT,
        user_id INTEGER,
        note TEXT,
        started_at TEXT,
        closed_at TEXT,
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
      CREATE TABLE IF NOT EXISTS stocktake_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stocktake_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        batch_id INTEGER,
        book_qty REAL NOT NULL,
        counted_qty REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    // 8. الجداول الحصرية للسوق الجزائري (الأقساط، سجل الرقابة، والقاموس الوطني 613)
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS installment_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        customer_id INTEGER NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0,
        down_payment REAL NOT NULL DEFAULT 0,
        remaining_amount REAL NOT NULL DEFAULT 0,
        months_count INTEGER NOT NULL DEFAULT 3,
        monthly_amount REAL NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS installment_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        installment_num INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        paid_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        FOREIGN KEY (plan_id) REFERENCES installment_plans(id) ON DELETE CASCADE
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        action_type TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        details_json TEXT,
        severity TEXT DEFAULT 'info',
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
      CREATE TABLE IF NOT EXISTS cheques_portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        direction TEXT NOT NULL DEFAULT 'in', -- 'in' (من زبون) | 'out' (لمورد)
        party_id INTEGER,
        party_name TEXT,
        cheque_number TEXT NOT NULL,
        bank_name TEXT DEFAULT 'BNA',
        amount REAL NOT NULL DEFAULT 0,
        issue_date TEXT,
        due_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending', -- pending | deposited | cashed | rejected
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

    db._rawRun(`CREATE TABLE IF NOT EXISTS dz_product_dictionary (
        barcode TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'عام',
        brand TEXT,
        unit TEXT DEFAULT 'قطعة',
        suggested_price REAL DEFAULT 0
      )
    `);

    const dzStmt = db._rawPrepare(
      'INSERT OR IGNORE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const item of DEFAULT_DZ_DICTIONARY) {
      dzStmt.run(item.barcode, item.name, item.category, item.brand, item.unit, item.suggested_price);
    }
    dzStmt.finalize();

    // 9. القوالب المخصصة، عدادات المستندات، سجلات الطباعة، والمزامنة
    db._rawRun(`
      CREATE TABLE IF NOT EXISTS custom_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT,
        name TEXT NOT NULL,
        doc_type TEXT NOT NULL DEFAULT 'invoice',
        paper TEXT NOT NULL DEFAULT 'a4',
        lang TEXT DEFAULT 'ar',
        layout_json TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS document_counters (
        doc_type TEXT NOT NULL,
        year INTEGER NOT NULL,
        last_number INTEGER NOT NULL DEFAULT 0,
        prefix_format TEXT,
        uuid TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        origin_device TEXT,
        server_rev INTEGER,
        dirty INTEGER DEFAULT 1,
        PRIMARY KEY (doc_type, year)
      )
    `);

    const curYear = new Date().getFullYear();
    const ctrStmt = db._rawPrepare(
      'INSERT OR IGNORE INTO document_counters (doc_type, year, last_number, prefix_format) VALUES (?, ?, 0, ?)'
    );
    for (const c of DEFAULT_DOCUMENT_COUNTERS) {
      ctrStmt.run(c.doc_type, curYear, c.prefix_format);
    }
    ctrStmt.finalize();

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS document_print_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_type TEXT NOT NULL,
        doc_id INTEGER,
        doc_number TEXT,
        user_id INTEGER,
        printer_name TEXT,
        copies INTEGER DEFAULT 1,
        printed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS document_edit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_type TEXT NOT NULL,
        doc_id INTEGER,
        user_id INTEGER,
        changes_json TEXT,
        edited_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS sync_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS sync_cursors (
        table_name TEXT PRIMARY KEY,
        last_rev INTEGER NOT NULL DEFAULT 0,
        last_pulled_at TEXT
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS sync_row_errors (
        table_name TEXT NOT NULL,
        uuid TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_retry_ms INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (table_name, uuid)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS pull_row_errors (
        table_name TEXT NOT NULL,
        uuid TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_retry_ms INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (table_name, uuid)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS pending_fk_fixups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tbl TEXT NOT NULL,
        row_uuid TEXT NOT NULL,
        fk_col TEXT NOT NULL,
        parent_table TEXT NOT NULL,
        parent_uuid TEXT NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE (tbl, row_uuid, fk_col)
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS device_registry (
        instance_id TEXT PRIMARY KEY,
        label TEXT,
        hwid TEXT,
        is_self INTEGER DEFAULT 0,
        is_owner INTEGER DEFAULT 0,
        last_seen_at TEXT
      )
    `);

    db._rawRun(`
      CREATE TABLE IF NOT EXISTS fresh_bootstrap_images (
        tbl TEXT NOT NULL,
        uuid TEXT NOT NULL,
        image TEXT,
        post_updated_at TEXT,
        post_dirty INTEGER,
        post_origin TEXT,
        PRIMARY KEY (tbl, uuid)
      )
    `);

    // 10. إنشاء الفهارس الشاملة
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
      'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
      'CREATE INDEX IF NOT EXISTS idx_products_family ON products(family)',
      'CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier)',
      'CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = 1',
      'CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON product_barcodes(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode)',
      'CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_opt_groups_product ON product_option_groups(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_opt_values_group ON product_option_values(option_group_id)',
      'CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_variant_opt_values_variant ON variant_option_values(variant_id)',
      'CREATE INDEX IF NOT EXISTS idx_batches_product ON inventory_batches(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_batches_variant ON inventory_batches(variant_id)',
      'CREATE INDEX IF NOT EXISTS idx_batches_expiry ON inventory_batches(expiry_date)',
      'CREATE INDEX IF NOT EXISTS idx_batches_stock ON inventory_batches(product_id, stock)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_uuid ON stock_movements(uuid)',
      'CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements(batch_uuid)',
      'CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_uuid)',
      'CREATE INDEX IF NOT EXISTS idx_stock_movements_dirty ON stock_movements(dirty) WHERE dirty = 1',
      'CREATE INDEX IF NOT EXISTS idx_stock_debt_product ON stock_debt(product_id, resolved)',
      'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)',
      'CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)',
      'CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_sale_payments_date ON sale_payments(date)',
      'CREATE INDEX IF NOT EXISTS idx_caisse_sessions_status ON caisse_sessions(status)',
      'CREATE INDEX IF NOT EXISTS idx_caisse_transactions_session ON caisse_transactions(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_installment_plans_cust ON installment_plans(customer_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_installment_sched_due ON installment_schedules(due_date, status)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)'
    ];

    for (const sql of indexes) {
      db._rawRun(sql);
    }

    for (const tbl of SYNCED_TABLES) {
      db._rawRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tbl}_uuid ON ${tbl}(uuid)`);
      db._rawRun(`CREATE INDEX IF NOT EXISTS idx_${tbl}_dirty ON ${tbl}(dirty) WHERE dirty = 1`);
      db._rawRun(`CREATE INDEX IF NOT EXISTS idx_${tbl}_updated ON ${tbl}(updated_at)`);
      createSyncTriggersForTable(tbl);
    }

    createStockLedgerTriggers();
    tombstoneOrphans();
  });
}

initializeDatabase();

db.dbPath = dbPath;
db.SYNCED_TABLES = SYNCED_TABLES;
db.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
db.DEFAULT_DOCUMENT_COUNTERS = DEFAULT_DOCUMENT_COUNTERS;
db.DEFAULT_DZ_DICTIONARY = DEFAULT_DZ_DICTIONARY;
db.tombstoneOrphans = tombstoneOrphans;
db.safeAddColumn = safeAddColumn;
db.dataRevisionTracker = dataRevisionTracker;


/**
 * شحن تلقائي كامل لملف Lumina_DZ_Products.csv (31,533 منتجاً) في جدول dz_product_dictionary
 */
function autoSeedFullAlgerianCsvDictionary() {
  db._rawGet('SELECT COUNT(*) AS cnt FROM dz_product_dictionary', [], (err, row) => {
    if (err || (row && Number(row.cnt) >= 1000)) return;
    const candidates = [
      path.join(__dirname, 'Lumina_DZ_Products.csv'),
      path.join(__dirname, '..', 'Lumina_DZ_Products.csv')
    ];
    const csvPath = candidates.find((p) => fs.existsSync(p));
    if (!csvPath) return;

    try {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split(/\r?\n/);
      if (lines.length <= 1) return;

      db.serialize(() => {
        db._rawRun('BEGIN IMMEDIATE TRANSACTION');
        const stmt = db._rawPrepare(
          'INSERT OR IGNORE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line || !line.trim()) continue;
          const parts = line.split(',');
          const barcode = String(parts[0] || '').replace(/^"|"$/g, '').trim();
          const name = String(parts[1] || '').replace(/^"|"$/g, '').trim();
          if (!barcode || !name || barcode.length < 6) continue;
          const category = String(parts[2] || 'عام').replace(/^"|"$/g, '').trim() || 'عام';
          const brand = String(parts[3] || '').replace(/^"|"$/g, '').trim();
          const price = parseFloat(parts[4]) || 0;
          stmt.run(barcode, name.slice(0, 120), category.slice(0, 60), brand.slice(0, 60), 'قطعة', price);
        }
        stmt.finalize();
        db._rawRun('COMMIT');
      });
    } catch (e) {
      console.warn('[DZ Dictionary Auto-Seed] Warning:', e.message);
    }
  });
}
autoSeedFullAlgerianCsvDictionary();


// الترقية المؤسسية النظيفة (6 Clean-Room Enterprise Modules)
try {
  const { initEnterpriseFoundation } = require('./gherbi-enterprise-foundation');
  initEnterpriseFoundation(db);
} catch (entErr) {
  console.warn('[Enterprise Foundation Init] Warning:', entErr.message);
}

module.exports = db;

/* [RETAIL_LOYALTY_SAVE_PATCH] */
(function patchCustomerLoyaltySave() {
  try {
    const origUpdateCustomer = module.exports.updateCustomer;
    if (typeof origUpdateCustomer === 'function') {
      module.exports.updateCustomer = function (idOrObj, maybeData, callback) {
        let id = idOrObj;
        let data = maybeData || {};
        if (typeof idOrObj === 'object' && idOrObj !== null) {
          id = idOrObj.id;
          data = idOrObj;
          callback = maybeData;
        }
        const res = origUpdateCustomer.apply(this, arguments);
        if (id && data && data.loyalty_points !== undefined && data.loyalty_points !== null) {
          const pts = Math.max(0, parseInt(data.loyalty_points, 10) || 0);
          if (typeof db !== 'undefined' && db && typeof db.run === 'function') {
            db.run('UPDATE customers SET loyalty_points = ? WHERE id = ?', [pts, Number(id)], () => {});
          }
        }
        return res;
      };
    }

    const origAddCustomer = module.exports.addCustomer;
    if (typeof origAddCustomer === 'function') {
      module.exports.addCustomer = function (data, callback) {
        const res = origAddCustomer.apply(this, arguments);
        if (res && typeof res.then === 'function' && data && data.loyalty_points !== undefined) {
          res.then((created) => {
            const newId = created && (created.id || created.lastID);
            if (newId && typeof db !== 'undefined' && db && typeof db.run === 'function') {
              const pts = Math.max(0, parseInt(data.loyalty_points, 10) || 0);
              db.run('UPDATE customers SET loyalty_points = ? WHERE id = ?', [pts, Number(newId)], () => {});
            }
          }).catch(() => {});
        }
        return res;
      };
    }
  } catch (_) {}
})();

/* [RETAIL_PACK_DB_SYNC_PATCH] */
(function ensureProductPackColumnsSaved() {
  try {
    if (typeof db !== 'undefined' && db && typeof db.safeAddColumn === 'function') {
      db.safeAddColumn('products', 'wholesale_price REAL DEFAULT 0');
      db.safeAddColumn('products', 'wholesale_qty REAL DEFAULT 0');
      db.safeAddColumn('products', "wholesale_unit TEXT DEFAULT 'كرتونة'");
    }
    const origUpdateProduct = module.exports.updateProduct;
    if (typeof origUpdateProduct === 'function') {
      module.exports.updateProduct = function (idOrObj, maybeData) {
        const res = origUpdateProduct.apply(this, arguments);
        try {
          const data = typeof idOrObj === 'object' && idOrObj !== null ? idOrObj : (maybeData || {});
          const pid = Number(data.id || idOrObj);
          const wPrice = parseFloat(data.wholesale_price ?? data.pack_price ?? 0) || 0;
          const wQty = parseFloat(data.wholesale_qty ?? data.pack_qty ?? data.wholesale_min_qty ?? 0) || 0;
          const wUnit = String(data.wholesale_unit ?? data.pack_unit ?? 'كرتونة').trim();
          if (pid > 0 && typeof db !== 'undefined' && db) {
            db.run(
              'UPDATE products SET wholesale_price = ?, wholesale_qty = ?, wholesale_unit = ? WHERE id = ?',
              [wPrice, wQty, wUnit, pid],
              () => {}
            );
            db.run(
              'UPDATE inventory_batches SET wholesale_price = ? WHERE product_id = ? AND deleted_at IS NULL',
              [wPrice, pid],
              () => {}
            );
          }
        } catch (_) {}
        return res;
      };
    }
  } catch (_) {}
})();

