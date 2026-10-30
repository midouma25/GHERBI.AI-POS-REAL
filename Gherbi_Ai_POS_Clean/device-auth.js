/**
 * device-auth.js
 * وحدة توثيق الأجهزة، التوقيع الرقمي للطلبات (HMAC-SHA256)، وإصدار رموز اقتران الهاتف
 */

'use strict';

const axios = require('axios');
const crypto = require('crypto');
const os = require('os');
const licenseManager = require('./licenseManager');

async function getSetting(db, key, fallback = '') {
  if (typeof db.getSetting === 'function') return db.getSetting(key, fallback);
  const row = await db.dbGet('SELECT value FROM settings WHERE key = ?', [String(key)]);
  return row && row.value !== undefined && row.value !== null ? row.value : fallback;
}

async function setSetting(db, key, value) {
  await db.dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    String(key),
    value === null || value === undefined ? '' : String(value)
  ]);
}

async function signedRequest(db, { method = 'GET', path: urlPath, data = null, params = null, timeout = 25000 }) {
  const cloudUrl = (await getSetting(db, 'cloud_url', 'https://cloud.gherbi.ai')).replace(/\/+$/, '');
  const cloudToken = await getSetting(db, 'cloud_token', '');
  const instanceId = await getSetting(db, 'instance_id', '');
  const hwid = licenseManager.getHWID();
  const licenseCode = licenseManager.getLicenseCode();
  const timestamp = String(Date.now());

  const bodyHash = data
    ? crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
    : '';
  const payloadToSign = `${method.toUpperCase()}:${urlPath}:${instanceId}:${hwid}:${timestamp}:${bodyHash}`;
  const signature = crypto
    .createHmac('sha256', cloudToken || licenseCode || 'GHERBI_POS_SECRET')
    .update(payloadToSign)
    .digest('hex');

  const response = await axios.request({
    method,
    url: `${cloudUrl}${urlPath}`,
    data,
    params,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      Authorization: cloudToken ? `Bearer ${cloudToken}` : undefined,
      'X-Instance-Id': instanceId,
      'X-Device-Hwid': hwid,
      'X-License-Code': licenseCode,
      'X-Timestamp': timestamp,
      'X-Signature': signature
    }
  });

  return response.data;
}

async function joinWithCode(db, joinCode) {
  const cleanCode = String(joinCode || '').trim();
  if (!cleanCode) throw new Error('يرجى إدخال كود الربط السحابي');

  let instanceId = await getSetting(db, 'instance_id', '');
  if (!instanceId) {
    instanceId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    await setSetting(db, 'instance_id', instanceId);
  }

  const hwid = licenseManager.getHWID();
  const label = os.hostname() || 'Gherbi POS Terminal';

  const res = await signedRequest(db, {
    method: 'POST',
    path: '/api/devices/join-cloud',
    data: { join_code: cleanCode, instance_id: instanceId, hwid, label }
  });

  const token = (res && (res.token || res.cloud_token)) || '';
  const role = (res && res.role) || 'follower';

  await setSetting(db, 'cloud_token', token);
  await setSetting(db, 'cloud_role', role);
  await setSetting(db, 'network_scope', 'cloud');
  await setSetting(db, 'sync_mode', 'cloud');

  await db.dbRun(
    `INSERT OR REPLACE INTO device_registry (instance_id, label, hwid, is_self, is_owner, last_seen_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
    [instanceId, label, hwid, role === 'owner' ? 1 : 0, new Date().toISOString()]
  );

  return { ok: true, role, instanceId };
}

async function getJoinInfo(db) {
  const instanceId = await getSetting(db, 'instance_id', '');
  const cloudRole = await getSetting(db, 'cloud_role', 'owner');
  const cloudToken = await getSetting(db, 'cloud_token', '');
  const networkScope = await getSetting(db, 'network_scope', 'local');
  const devices = await db.dbAll('SELECT * FROM device_registry ORDER BY is_owner DESC, last_seen_at DESC');

  return {
    connected: Boolean(cloudToken),
    instanceId,
    role: cloudRole,
    networkScope,
    devices
  };
}

async function leaveCloud(db) {
  await setSetting(db, 'cloud_token', '');
  await setSetting(db, 'network_scope', 'local');
  await setSetting(db, 'sync_mode', 'local');
  return { ok: true };
}

async function issueMobilePairCode(db) {
  try {
    const cloudToken = await getSetting(db, 'cloud_token', '');
    if (cloudToken) {
      const res = await signedRequest(db, {
        method: 'POST',
        path: '/api/pos/pair/issue',
        data: {
          instance_id: await getSetting(db, 'instance_id', ''),
          hwid: licenseManager.getHWID()
        }
      });
      if (res && res.code) return res;
    }
  } catch (_) {}

  const localCode = String(Math.floor(100000 + Math.random() * 900000));
  return {
    ok: true,
    code: localCode,
    expiresInSeconds: 300
  };
}

async function getRelayTicket(db) {
  return await signedRequest(db, {
    method: 'POST',
    path: '/api/devices/relay-ticket',
    data: {
      instance_id: await getSetting(db, 'instance_id', ''),
      hwid: licenseManager.getHWID()
    }
  });
}

module.exports = {
  signedRequest,
  joinWithCode,
  getJoinInfo,
  leaveCloud,
  issueMobilePairCode,
  getRelayTicket,
  getLicenseCode: licenseManager.getLicenseCode
};