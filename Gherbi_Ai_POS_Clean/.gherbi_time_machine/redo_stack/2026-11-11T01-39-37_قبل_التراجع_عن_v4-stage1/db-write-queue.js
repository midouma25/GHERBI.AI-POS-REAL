'use strict';

let activeQueueInstance = null;

function isBenignTxError(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return (
    msg.includes('no such savepoint') ||
    msg.includes('cannot start a transaction within a transaction') ||
    msg.includes('cannot commit - no transaction is active') ||
    msg.includes('cannot rollback - no transaction is active')
  );
}

function normalizeArgs(params, callback) {
  if (typeof params === 'function') {
    return { params: [], callback: params };
  }
  return {
    params: params === undefined || params === null ? [] : params,
    callback: typeof callback === 'function' ? callback : null
  };
}

class DbWriteQueue {
  constructor(dbGetter) {
    this.getDb = typeof dbGetter === 'function' ? dbGetter : () => dbGetter;
    this.chain = Promise.resolve();
    this.txDepth = 0;
    this.spCounter = 0;
  }

  get db() {
    return this.getDb();
  }

  enqueue(taskFn) {
    if (this.txDepth > 0) {
      return Promise.resolve().then(() => taskFn());
    }
    const next = this.chain.then(() => taskFn());
    this.chain = next.catch(() => {});
    return next;
  }

  runAsync(sql, params = [], callback = null) {
    const norm = normalizeArgs(params, callback);
    return new Promise((resolve, reject) => {
      const database = this.db;
      if (!database) return reject(new Error('Database instance is not initialized'));
      const runner = database._rawRun || database.run.bind(database);

      runner(sql, norm.params, function onRunComplete(err) {
        if (err && !isBenignTxError(err)) {
          if (norm.callback) norm.callback.call(this, err);
          return reject(err);
        }
        const resObj = {
          lastID: this && this.lastID !== undefined ? this.lastID : 0,
          changes: this && this.changes !== undefined ? this.changes : 0
        };
        if (norm.callback) norm.callback.call(resObj, null, resObj);
        resolve(resObj);
      });
    });
  }

  getAsync(sql, params = [], callback = null) {
    const norm = normalizeArgs(params, callback);
    return new Promise((resolve, reject) => {
      const database = this.db;
      if (!database) return reject(new Error('Database instance is not initialized'));
      const getter = database._rawGet || database.get.bind(database);

      getter(sql, norm.params, (err, row) => {
        if (err) {
          if (norm.callback) norm.callback(err);
          return reject(err);
        }
        if (norm.callback) norm.callback(null, row);
        resolve(row);
      });
    });
  }

  allAsync(sql, params = [], callback = null) {
    const norm = normalizeArgs(params, callback);
    return new Promise((resolve, reject) => {
      const database = this.db;
      if (!database) return reject(new Error('Database instance is not initialized'));
      const aller = database._rawAll || database.all.bind(database);

      aller(sql, norm.params, (err, rows) => {
        if (err) {
          if (norm.callback) norm.callback(err);
          return reject(err);
        }
        const safeRows = rows || [];
        if (norm.callback) norm.callback(null, safeRows);
        resolve(safeRows);
      });
    });
  }

  execAsync(sql, callback = null) {
    return new Promise((resolve, reject) => {
      const database = this.db;
      if (!database) return reject(new Error('Database instance is not initialized'));
      const execer = database._rawExec || database.exec.bind(database);

      execer(sql, (err) => {
        if (err && !isBenignTxError(err)) {
          if (typeof callback === 'function') callback(err);
          return reject(err);
        }
        if (typeof callback === 'function') callback(null);
        resolve();
      });
    });
  }

  dbRun(sql, params = [], callback = null) {
    return this.runAsync(sql, params, callback);
  }

  dbGet(sql, params = [], callback = null) {
    return this.getAsync(sql, params, callback);
  }

  dbAll(sql, params = [], callback = null) {
    return this.allAsync(sql, params, callback);
  }

  dbExec(sql, callback = null) {
    return this.execAsync(sql, callback);
  }

  async executeTx(workFn) {
    const runTx = async () => {
      const spName = `sp_gherbi_${++this.spCounter}_${Date.now()}`;
      this.txDepth++;
      try {
        await this.runAsync(`SAVEPOINT ${spName}`);
        const result = await workFn(this);
        await this.runAsync(`RELEASE SAVEPOINT ${spName}`).catch((err) => {
          if (!isBenignTxError(err)) throw err;
        });
        return result;
      } catch (err) {
        await this.runAsync(`ROLLBACK TO SAVEPOINT ${spName}`).catch(() => {});
        await this.runAsync(`RELEASE SAVEPOINT ${spName}`).catch(() => {});
        throw err;
      } finally {
        this.txDepth = Math.max(0, this.txDepth - 1);
      }
    };

    if (this.txDepth > 0) {
      return runTx();
    }
    return this.enqueue(runTx);
  }

  async transaction(workFn) {
    return this.executeTx(workFn);
  }
}

function attachWriteQueue(db) {
  if (!db) return db;
  if (db._rawRun && db.dbRun && db.getSetting && db.setSetting) {
    return db;
  }

  const origRun = db._rawRun || db.run.bind(db);
  const origGet = db._rawGet || db.get.bind(db);
  const origAll = db._rawAll || db.all.bind(db);
  const origExec = db._rawExec || db.exec.bind(db);
  const origPrepare = typeof db.prepare === 'function' ? db.prepare.bind(db) : null;
  const origSerialize = typeof db.serialize === 'function' ? db.serialize.bind(db) : null;

  db._rawRun = function rawRunWrapper(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    return origRun(sql, params, function onRawComplete(err) {
      if (err && isBenignTxError(err)) {
        if (typeof callback === 'function') return callback.call(this, null);
        return;
      }
      if (typeof callback === 'function') {
        return callback.call(this, err);
      }
    });
  };

  db._rawGet = origGet;
  db._rawAll = origAll;
  db._rawExec = function rawExecWrapper(sql, callback) {
    return origExec(sql, function onExecComplete(err) {
      if (err && isBenignTxError(err)) {
        if (typeof callback === 'function') return callback.call(this, null);
        return;
      }
      if (typeof callback === 'function') {
        return callback.call(this, err);
      }
    });
  };
  if (origPrepare) db._rawPrepare = origPrepare;
  if (origSerialize) db._rawSerialize = origSerialize;

  db.run = db._rawRun;

  const queue = new DbWriteQueue(() => db);
  activeQueueInstance = queue;

  db._writeQueue = queue;
  db.writeQueue = queue;

  db.dbRun = queue.dbRun.bind(queue);
  db.dbGet = queue.dbGet.bind(queue);
  db.dbAll = queue.dbAll.bind(queue);
  db.dbExec = queue.dbExec.bind(queue);

  db.runAsync = queue.runAsync.bind(queue);
  db.getAsync = queue.getAsync.bind(queue);
  db.allAsync = queue.allAsync.bind(queue);
  db.execAsync = queue.execAsync.bind(queue);

  db.executeTx = queue.executeTx.bind(queue);
  db.transaction = queue.transaction.bind(queue);
  db.withTransaction = queue.executeTx.bind(queue);
  db.enqueueWrite = queue.enqueue.bind(queue);
  db.enqueue = queue.enqueue.bind(queue);

  if (typeof db.getSetting !== 'function') {
    db.getSetting = function getSetting(key, defaultValue = null, callback = null) {
      if (typeof defaultValue === 'function') {
        callback = defaultValue;
        defaultValue = null;
      }
      const p = queue
        .getAsync('SELECT value FROM settings WHERE key = ?', [String(key)])
        .then((row) => (row && row.value !== undefined && row.value !== null ? row.value : defaultValue))
        .catch(() => defaultValue);

      if (typeof callback === 'function') {
        p.then((val) => callback(null, val));
      }
      return p;
    };
  }

  if (typeof db.setSetting !== 'function') {
    db.setSetting = function setSetting(key, value, callback = null) {
      const strKey = String(key);
      const strVal = value === undefined || value === null ? '' : String(value);
      const p = queue
        .runAsync(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [strKey, strVal]
        )
        .catch(() =>
          queue.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [strKey, strVal])
        );

      if (typeof callback === 'function') {
        p.then((res) => callback(null, res)).catch((err) => callback(err));
      }
      return p;
    };
  }

  return db;
}

async function executeTx(workFn) {
  if (activeQueueInstance) {
    return activeQueueInstance.executeTx(workFn);
  }
  return workFn();
}

function getWriteQueue() {
  return activeQueueInstance;
}

module.exports = attachWriteQueue;
module.exports.attachWriteQueue = attachWriteQueue;
module.exports.DbWriteQueue = DbWriteQueue;
module.exports.executeTx = executeTx;
module.exports.getWriteQueue = getWriteQueue;
