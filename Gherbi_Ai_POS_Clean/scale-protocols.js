/**
 * scale-protocols.js
 * محرك بروتوكولات الموازين الإلكترونية (CAS, Toledo, Dibal, Avery, Digi, Epelsa, Auto)
 * ومحرك تفكيك باركود الميزان المدمج (EAN-13 Weight/Price Prefix 20..29)
 */

'use strict';

const PROTOCOLS = {
  /**
   * الكشف التلقائي الموحد لمعظم الموازين التجارية القياسية
   */
  auto(rawFrame) {
    const str = String(rawFrame || '').trim();
    if (!str) return null;

    // رصد حالة عدم الاستقرار أو الوزن السالب/الفارغ
    const isUnstable = /\b(US|UNSTABLE|MOTION)\b/i.test(str);
    const isOverload = /\b(OL|OVER|ERR)\b/i.test(str);
    if (isOverload) return { weight: null, stable: false, overload: true, raw: str };

    // استخراج الرقم العشري مع الإشارة والوحدة إن وجدت
    const match = /([+-]?\d+(?:[.,]\d+)?)\s*(kg|g|lb)?/i.exec(str);
    if (!match) return null;

    let value = parseFloat(match[1].replace(',', '.'));
    if (!Number.isFinite(value)) return null;

    const unit = (match[2] || 'kg').toLowerCase();
    if (unit === 'g') {
      value = value / 1000;
    }

    return {
      weight: Number(value.toFixed(4)),
      unit: 'kg',
      stable: !isUnstable,
      raw: str
    };
  },

  /**
   * بروتوكول CAS القياسي (مثل: ST,GS,+  1.250kg)
   */
  cas(rawFrame) {
    const str = String(rawFrame || '').trim();
    const stable = !str.startsWith('US');
    const match = /([+-]?\s*\d+(?:\.\d+)?)\s*(kg|g)?/i.exec(str);
    if (!match) return null;
    let w = parseFloat(match[1].replace(/\s+/g, ''));
    if ((match[2] || '').toLowerCase() === 'g') w /= 1000;
    return { weight: Number(w.toFixed(4)), unit: 'kg', stable, raw: str };
  },

  /**
   * بروتوكول Mettler Toledo / Dibal / Digi / Avery / Epelsa
   */
  toledo(rawFrame) {
    return PROTOCOLS.auto(rawFrame);
  },
  dibal(rawFrame) {
    return PROTOCOLS.auto(rawFrame);
  },
  digi(rawFrame) {
    return PROTOCOLS.auto(rawFrame);
  },
  avery(rawFrame) {
    return PROTOCOLS.auto(rawFrame);
  },
  epelsa(rawFrame) {
    return PROTOCOLS.auto(rawFrame);
  }
};

/**
 * تحليل إطار قادم من المنفذ التسلسلي للميزان وفق البروتوكول المحدد أو Regex مخصص
 */
function parseScaleFrame(rawBufferOrString, options = {}) {
  const rawStr = Buffer.isBuffer(rawBufferOrString)
    ? rawBufferOrString.toString('ascii')
    : String(rawBufferOrString || '');

  const cleaned = rawStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  if (!cleaned) return null;

  const protocolName = String(options.protocol || 'auto').toLowerCase();
  const divisor = Math.max(0.0001, Number(options.divisor || 1));
  const targetUnit = String(options.unit || 'kg').toLowerCase();

  let parsed = null;

  if (protocolName === 'custom' && options.customRegex) {
    try {
      const rx = new RegExp(options.customRegex, 'i');
      const m = rx.exec(cleaned);
      if (m && m[1] !== undefined) {
        const val = parseFloat(String(m[1]).replace(',', '.'));
        if (Number.isFinite(val)) {
          parsed = { weight: val, unit: targetUnit, stable: true, raw: cleaned };
        }
      }
    } catch (_) {}
  } else {
    const parserFn = PROTOCOLS[protocolName] || PROTOCOLS.auto;
    parsed = parserFn(cleaned);
  }

  if (!parsed || !Number.isFinite(parsed.weight)) return null;

  let finalWeight = parsed.weight / divisor;
  if (targetUnit === 'g' && parsed.unit === 'kg') {
    finalWeight = finalWeight * 1000;
  }

  return {
    ...parsed,
    weight: Number(finalWeight.toFixed(4)),
    unit: targetUnit
  };
}

/**
 * تفكيك باركود الميزان المطبوع على الملصقات (EAN-13 يبدأ بـ 20 إلى 29)
 * الصيغة القياسية: [Prefix 2 digits][PLU 5 digits][Weight/Price 5 digits][Checksum 1 digit]
 */
function parseScaleBarcode(barcode, settings = {}) {
  const code = String(barcode || '').trim();
  if (!/^\d{12,14}$/.test(code)) return null;

  const enabled = String(settings.scale_barcode_enabled ?? 'true').toLowerCase() === 'true';
  if (!enabled) return null;

  const configuredPrefixes = String(settings.scale_barcode_prefix || '20,21,22,23,24,25,26,27,28,29')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const matchedPrefix = configuredPrefixes.find((pref) => code.startsWith(pref));
  if (!matchedPrefix) return null;

  const pluLength = Math.max(1, parseInt(settings.scale_barcode_plu_length ?? 5, 10) || 5);
  const valLength = Math.max(1, parseInt(settings.scale_barcode_value_length ?? 5, 10) || 5);
  const valueType = String(settings.scale_barcode_value_type || 'weight').toLowerCase();
  const decimals = Math.max(0, parseInt(settings.scale_barcode_value_decimals ?? 3, 10) || 3);

  const pluStart = matchedPrefix.length;
  const pluEnd = pluStart + pluLength;
  const valEnd = pluEnd + valLength;

  if (code.length < valEnd) return null;

  const pluCode = code.slice(pluStart, pluEnd);
  const rawValueStr = code.slice(pluEnd, valEnd);
  const rawInt = parseInt(rawValueStr, 10);
  if (!Number.isFinite(rawInt)) return null;

  const numericValue = Number((rawInt / Math.pow(10, decimals)).toFixed(decimals));

  return {
    isScaleBarcode: true,
    prefix: matchedPrefix,
    pluCode,
    pluCodeNumeric: String(parseInt(pluCode, 10)),
    valueType, // 'weight' أو 'price'
    value: numericValue,
    weight: valueType === 'weight' ? numericValue : null,
    totalPrice: valueType === 'price' ? numericValue : null,
    originalBarcode: code
  };
}

module.exports = {
  PROTOCOLS,
  parseScaleFrame,
  parseScaleBarcode
};