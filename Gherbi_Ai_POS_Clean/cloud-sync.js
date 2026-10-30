/**
 * cloud-sync.js
 * محرك مزامنة طابور الأحداث الصادرة (sync_outbox) مع الخادم السحابي
 */

'use strict';

const axios = require('axios');

async function postSyncEvent(cloudUrl, cloudToken, instanceId, eventType, payload) {
  const cleanUrl = String(cloudUrl || 'https://cloud.gherbi.ai').replace(/\/+$/, '');
  const res = await axios.post(
    `${cleanUrl}/api/pos/sync/event`,
    {
      instance_id: instanceId,
      event_type: eventType,
      payload
    },
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cloudToken}`
      }
    }
  );
  return res.data;
}

async function runCloudSync(db, options = {}) {
  const maxBatch = Math.max(1, Number(options.maxBatch || 50));
  const cloudUrl = await db.getSetting('cloud_url', 'https://cloud.gherbi.ai');
  const cloudToken = await db.getSetting('cloud_token', '');
  const instanceId = await db.getSetting('instance_id', '');

  if (!cloudToken) {
    return { synced: 0, skipped: true, reason: 'missing_cloud_token' };
  }

  const pending = await db.dbAll(
    'SELECT id, event_type, payload_json FROM sync_outbox WHERE sent_at IS NULL ORDER BY id ASC LIMIT ?',
    [maxBatch]
  );

  let synced = 0;
  for (const row of pending) {
    try {
      let payload = {};
      try {
        payload = JSON.parse(row.payload_json || '{}');
      } catch (_) {}

      await postSyncEvent(cloudUrl, cloudToken, instanceId, row.event_type, payload);
      await db.dbRun('UPDATE sync_outbox SET sent_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
      synced += 1;
    } catch (err) {
      return { synced, error: 'send_failed', message: err.message };
    }
  }

  const nowIso = new Date().toISOString();
  await db.dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_cloud_sync_at', ?)", [
    nowIso
  ]);

  return { synced, lastSyncAt: nowIso };
}

module.exports = {
  postSyncEvent,
  runCloudSync
};