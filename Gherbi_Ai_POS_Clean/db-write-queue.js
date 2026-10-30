/**
 * db-write-queue.js
 * محرك طابور الكتابة الذري المتسلسل لقاعدة بيانات SQLite3
 * يمنع أخطاء SQLITE_BUSY ويدعم المعاملات المتداخلة عبر SAVEPOINT
 */

'use strict';

const WRITE_SQL_PATTERN = /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|PRAGMA\s+(?!table_info|foreign_key_list|index_list)|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/i;

class DbWriteQueue {
  constructor(db, options = {}) {
    this.db = db;
    this.maxRetries = Number(options.maxRetries ?? 6);
    this.baseRetryDelayMs = Number(options.baseRetryDelayMs ?? 35);
    this._chain = Promise.resolve();
    this._txDepth = 0;
    this._stats = {
      enqueued: 0,
      completed: 0,
      retries: 0,
      errors: 0,
      transactions: 0
    };
  }

  isWriteQuery(sql) {
    return typeof sql === 'string' && WRITE_SQL_PATTERN.test(sql);
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async _runWithRetry(fn) {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        const msg = String((err && err.message) || err || '');
        const isLocked =
          (err && (err.code === 'SQLITE_BUSY' || err.code === 'SQLITE_LOCKED')) ||
          /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(msg);

        if (isLocked && attempt < this.maxRetries) {
          attempt += 1;
          this._stats.retries += 1;
          const jitter = Math.floor(Math.random() * 25);
          const delay = Math.round(this.baseRetryDelayMs * Math.pow(1.6, attempt - 1)) + jitter;
          await this._sleep(delay);
          continue;
        }
        this._stats.errors += 1;
        throw err;
      }
    }
  }

  enqueue(taskFn) {
    this._stats.enqueued += 1;
    const nextPromise = this._chain.then(async () => {
      const res = await this._runWithRetry(taskFn);
      this._stats.completed += 1;
      return res;
    });
    this._chain = nextPromise.catch(() => {});
    return nextPromise;
  }

  runAsync(sql, params = []) {
    const runner = this.db._rawRun ? this.db._rawRun.bind(this.db) : this.db.run.bind(this.db);
    return new Promise((resolve, reject) => {
      runner(sql, params, function onRunComplete(err) {
        if (err) return reject(err);
        resolve({
          lastID: this ? this.lastID : undefined,
          changes: this ? this.changes : 0
        });
      });
    });
  }

  getAsync(sql, params = []) {
    const getter = this.db._rawGet ? this.db._rawGet.bind(this.db) : this.db.get.bind(this.db);
    return new Promise((resolve, reject) => {
      getter(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  }

  allAsync(sql, params = []) {
    const aller = this.db._rawAll ? this.db._rawAll.bind(this.db) : this.db.all.bind(this.db);
    return new Promise((resolve, reject) => {
      aller(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
  }

  execAsync(sql) {
    const execer = this.db._rawExec ? this.db._rawExec.bind(this.db) : this.db.exec.bind(this.db);
    return new Promise((resolve, reject) => {
      execer(sql, (err) => (err ? reject(err) : resolve(true)));
    });
  }

  withTransaction(workFn) {
    const executeTx = async () => {
      this._stats.transactions += 1;
      const isNested = this._txDepth > 0;
      const spName = `sp_gherbi_${this._txDepth}_${Date.now()}`;
      this._txDepth += 1;

      try {
        if (isNested) {
          await this.runAsync(`SAVEPOINT ${spName}`);
        } else {
          await this.runAsync('BEGIN IMMEDIATE TRANSACTION');
        }

        const txContext = {
          db: this.db,
          run: (sql, params = []) => this.runAsync(sql, params),
          get: (sql, params = []) => this.getAsync(sql, params),
          all: (sql, params = []) => this.allAsync(sql, params),
          exec: (sql) => this.execAsync(sql),
          dbRun: (sql, params = []) => this.runAsync(sql, params),
          dbGet: (sql, params = []) => this.getAsync(sql, params),
          dbAll: (sql, params = []) => this.allAsync(sql, params),
          dbExec: (sql) => this.execAsync(sql)
        };

        const output = await workFn(txContext);

        if (isNested) {
          await this.runAsync(`RELEASE SAVEPOINT ${spName}`);
        } else {
          await this.runAsync('COMMIT');
        }

        return output;
      } catch (err) {
        try {
          if (isNested) {
            await this.runAsync(`ROLLBACK TO SAVEPOINT ${spName}`);
            await this.runAsync(`RELEASE SAVEPOINT ${spName}`);
          } else {
            await this.runAsync('ROLLBACK');
          }
        } catch (_) {}
        throw err;
      } finally {
        this._txDepth = Math.max(0, this._txDepth - 1);
      }
    };

    if (this._txDepth > 0) {
      return executeTx();
    }
    return this.enqueue(executeTx);
  }

  getStats() {
    return {
      ...this._stats,
      inTransaction: this._txDepth > 0,
      activeTxDepth: this._txDepth
    };
  }
}

function attachWriteQueue(db, options = {}) {
  if (!db) throw new Error('Valid sqlite3 instance required');
  if (db._writeQueue) return db._writeQueue;

  if (!db._rawRun) db._rawRun = db.run.bind(db);
  if (!db._rawGet) db._rawGet = db.get.bind(db);
  if (!db._rawAll) db._rawAll = db.all.bind(db);
  if (!db._rawExec) db._rawExec = db.exec.bind(db);
  if (!db._rawPrepare) db._rawPrepare = db.prepare.bind(db);

  const queue = new DbWriteQueue(db, options);
  db._writeQueue = queue;
  db.db = db;

  db.enqueueWrite = (fn) => queue.enqueue(fn);
  db.withTransaction = (fn) => queue.withTransaction(fn);
  db.runAsync = (sql, params = []) => queue.runAsync(sql, params);
  db.getAsync = (sql, params = []) => queue.getAsync(sql, params);
  db.allAsync = (sql, params = []) => queue.allAsync(sql, params);
  db.execAsync = (sql) => queue.execAsync(sql);

  db.dbRun = db.runAsync;
  db.dbGet = db.getAsync;
  db.dbAll = db.allAsync;
  db.dbExec = db.execAsync;

  db.getSetting = async (key, fallback = '') => {
    const row = await queue.getAsync('SELECT value FROM settings WHERE key = ?', [String(key)]);
    return row && row.value !== undefined && row.value !== null ? row.value : fallback;
  };

  db.allowExpired = async () => {
    const val = await db.getSetting('manufacturing_allow_expired', 'false');
    return String(val).toLowerCase() === 'true' || val === '1';
  };

  db.nextNumber = async (docType = 'invoice') => {
    const year = new Date().getFullYear();
    const defaultFormats = {
      invoice: 'FAC-{YYYY}-{0000}',
      proforma: 'PRO-{YYYY}-{0000}',
      order: 'BC-{YYYY}-{0000}',
      delivery: 'BL-{YYYY}-{0000}',
      payment_receipt: 'REC-{YYYY}-{0000}',
      avoir: 'AV-{YYYY}-{0000}',
      recap: 'FR-{YYYY}-{0000}',
      sales_summary: 'RM-{YYYY}-{0000}',
      supplier_return: 'RF-{YYYY}-{0000}',
      production: 'PRD-{YYYY}-{0000}',
      stocktake: 'INV-{YYYY}-{0000}'
    };
    const prefixFormat = defaultFormats[docType] || `${String(docType).toUpperCase()}-{YYYY}-{0000}`;

    await queue.runAsync(
      `INSERT INTO document_counters (doc_type, year, last_number, prefix_format)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(doc_type, year) DO UPDATE SET last_number = last_number + 1`,
      [docType, year, prefixFormat]
    );

    const row = await queue.getAsync(
      'SELECT last_number, prefix_format FROM document_counters WHERE doc_type = ? AND year = ?',
      [docType, year]
    );
    const seq = Number((row && row.last_number) || 1);
    const fmt = (row && row.prefix_format) || prefixFormat;

    return fmt
      .replace(/\{YYYY\}/g, String(year))
      .replace(/\{YY\}/g, String(year).slice(-2))
      .replace(/\{(0+)\}/g, (_m, zeros) => String(seq).padStart(zeros.length, '0'));
  };

  db.nextDocNumber = db.nextNumber;

  return queue;
}

module.exports = {
  DbWriteQueue,
  attachWriteQueue,
  createWriteQueue: attachWriteQueue
};