/**
 * licenseManager.js
 * نظام إدارة التراخيص والبصمة المادية للجهاز (HWID) لنظام Gherbi.Ai POS
 * مفعّل بالكامل مدى الحياة للمالك (PRO_LIFETIME) دون أي قيود تجريبية
 */

'use strict';

const crypto = require('crypto');
const os = require('os');

let machineIdSync = null;
try {
  machineIdSync = require('node-machine-id').machineIdSync;
} catch (_) {}

function getHWID() {
  try {
    if (typeof machineIdSync === 'function') {
      const rawId = machineIdSync(true);
      return crypto
        .createHash('sha256')
        .update(`${rawId}:GHERBI_AI_POS_MASTER`)
        .digest('hex')
        .slice(0, 24)
        .toUpperCase();
    }
  } catch (_) {}

  const fallbackSeed = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'cpu'}`;
  return crypto
    .createHash('sha256')
    .update(fallbackSeed)
    .digest('hex')
    .slice(0, 24)
    .toUpperCase();
}

function getPermanentProStatus() {
  const hwid = getHWID();
  return {
    valid: true,
    isActivated: true,
    activated: true,
    isTrial: false,
    hwid,
    code: 'GHERBI-AI-PRO-LIFETIME',
    licenseKey: 'GHERBI-AI-PRO-LIFETIME',
    plan: 'PRO_LIFETIME',
    activatedAt: '2026-01-01T00:00:00.000Z',
    trialLimit: 999999999,
    limit: 999999999,
    maxSales: 999999999,
    trialUsage: 0,
    usage: 0,
    salesCount: 0,
    trialRemaining: 999999999,
    remaining: 999999999,
    salesLeft: 999999999
  };
}

function verifyLicense() {
  return getPermanentProStatus();
}

function verifyMobileLicense() {
  return true;
}

function getLicenseCode() {
  return 'GHERBI-AI-PRO-LIFETIME';
}

async function getLicenseStatus() {
  return getPermanentProStatus();
}

async function getTrialStatus() {
  return getPermanentProStatus();
}

async function activateApp(_code) {
  return {
    success: true,
    isActivated: true,
    info: getPermanentProStatus()
  };
}

async function installOfflineLicense() {
  return {
    success: true,
    isActivated: true,
    info: getPermanentProStatus()
  };
}

async function deactivateApp() {
  return {
    success: true,
    isActivated: true
  };
}

async function checkTrialBeforeSale() {
  return { blocked: false, isActivated: true };
}

async function incrementTrialUsage() {
  return true;
}

async function getPromoStatus() {
  return {
    isPromoActive: false,
    enabled: false,
    installDate: '2025-01-01T00:00:00.000Z',
    promoEndDate: '2025-01-02T00:00:00.000Z'
  };
}

module.exports = {
  getHWID,
  getHwid: getHWID,
  verifyLicense,
  verifyMobileLicense,
  getLicenseCode,
  getLicenseStatus,
  activateApp,
  installOfflineLicense,
  deactivateApp,
  getTrialStatus,
  checkTrialBeforeSale,
  incrementTrialUsage,
  getPromoStatus,
  isPromoActive: getPromoStatus
};