/**
 * print-studio-pro/studio-renderer.js
 * محرك الرسم النقي الموحد (War Stage 1: Precision BiDi/RTL + 80mm/58mm + Sacred Debt Math)
 */
'use strict';
(function buildUpgradedStudioRendererModule() {
  (function initPrintStudioProRenderer() {
    'use strict';

    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state || !PSP.utils) return;

    const { fmtDzd, fmtCentimes, normalizeDocData } = PSP.utils;

    const I18N_LABELS = {
      ar: {
        docNum: 'الرقم:',
        date: 'التاريخ:',
        partyDefault: 'الزبون:',
        walkinName: 'زبون عابر (Comptoir)',
        subtotal: 'المجموع الفرعي:',
        discount: 'التخفيض:',
        tva: 'الرسم TVA:',
        stamp: 'حق الطابع:',
        netTotal: 'الإجمالي الصافي:',
        centimes: 'بالسنتيم:',
        paid: 'المدفوع:',
        remaining: 'الباقي:',
        wordsPrefix: 'أوقفت هذه الوثيقة على مبلغ قدره:',
        received: 'المقبوض:',
        change: 'الصرف المرجع:',
        cashier: 'البائع:',
        method: 'الدفع:',
        vipCardTitle: 'وضعية الزبون الوفي — النقاط والديون',
        vipPoints: 'رصيد نقاط الوفاء',
        vipDebt: 'إجمالي الديون الحالية',
        ptsUnit: 'نقطة',
        prevDebt: 'الدين السابق',
        todayDebt: 'دين اليوم',
        newDebt: 'إجمالي الدين الجديد',
        signCustomer: 'إمضاء الزبون / المستلم',
        signShop: 'الختم والإمضاء الرسمي'
      },
      fr: {
        docNum: 'N°:',
        date: 'Date:',
        partyDefault: 'Client:',
        walkinName: 'Client Comptoir',
        subtotal: 'Sous-total:',
        discount: 'Remise:',
        tva: 'TVA:',
        stamp: 'Timbre:',
        netTotal: 'Net à Payer:',
        centimes: 'En centimes:',
        paid: 'Payé:',
        remaining: 'Reste:',
        wordsPrefix: 'Arrêté le présent document à la somme de:',
        received: 'Reçu:',
        change: 'Rendu:',
        cashier: 'Caissier:',
        method: 'Mode:',
        vipCardTitle: 'Bilan Client Fidèle (Points + Crédit)',
        vipPoints: 'Points Fidélité',
        vipDebt: 'Crédit Actuel',
        ptsUnit: 'pts',
        prevDebt: 'Ancien Solde',
        todayDebt: 'Crédit Jour',
        newDebt: 'Nouveau Solde',
        signCustomer: 'Signature Client',
        signShop: 'Cachet & Signature'
      },
      en: {
        docNum: 'No:',
        date: 'Date:',
        partyDefault: 'Customer:',
        walkinName: 'Walk-in Customer',
        subtotal: 'Subtotal:',
        discount: 'Discount:',
        tva: 'Tax:',
        stamp: 'Stamp:',
        netTotal: 'Net Total:',
        centimes: 'Centimes:',
        paid: 'Paid:',
        remaining: 'Balance:',
        wordsPrefix: 'Total in words:',
        received: 'Received:',
        change: 'Change:',
        cashier: 'Cashier:',
        method: 'Method:',
        vipCardTitle: 'VIP Customer Status (Points + Credit)',
        vipPoints: 'Loyalty Points',
        vipDebt: 'Current Balance',
        ptsUnit: 'pts',
        prevDebt: 'Prev. Debt',
        todayDebt: 'Added Debt',
        newDebt: 'Total Debt',
        signCustomer: 'Customer Signature',
        signShop: 'Authorized Stamp'
      }
    };

    function esc(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function cleanPrintText(str) {
      return String(str ?? '')
        .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
        .replace(/[👑⭐💳💵🪙👤📝📌📜🏦💸🔒🧾🛡️🛍️📊🏭🚨🚚📦📋🔄✂️🎉⚡🔗📞📍✍️]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    function bidiHtml(str) {
      let cleaned = cleanPrintText(str);
      cleaned = cleaned.replace(/\(\s*زبون\s+وفي\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
      const safe = esc(cleaned);

      // 1. عزل العبارات والأكواد اللاتينية المحاطة بأقواس (FID-00003) / (Mama) / (ULTRA JOY) / (Espèces) بـ LRI..PDI
      const pass1 = safe.replace(
        /\(\s*([#A-Za-z\u00C0-\u024F0-9][#A-Za-z\u00C0-\u024F0-9\-_/.:+\s]*)\s*\)/g,
        '<span dir="ltr" style="unicode-bidi:isolate;direction:ltr;">\u2066($1)\u2069</span>'
      );

      // 2. عزل بقية الأكواد والكلمات اللاتينية ومنع انقلاب الأقواس العربية
      const parts = pass1.split(/(<span dir="ltr"[^>]*>.*?<\/span>)/g);
      return parts
        .map((chunk) => {
          if (chunk.startsWith('<span dir="ltr"')) return chunk;
          const noBrokenArParens = chunk.replace(/\(([^()]*[\u0600-\u06FF][^()]*)\)/g, ' - $1');
          return noBrokenArParens.replace(
            /([A-Za-z\u00C0-\u024F0-9]+(?:[\-_/.:+][A-Za-z\u00C0-\u024F0-9]+|\s+[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9\-_/.:+]*)*)/g,
            '<span dir="ltr" style="unicode-bidi:isolate;direction:ltr;">\u2066$1\u2069</span>'
          );
        })
        .join('');
    }

    function formatNumPlain(val) {
      const n = Number(val || 0);
      const absFixed = (Number.isFinite(n) ? Math.abs(n) : 0).toFixed(2);
      const parts = absFixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }

    function moneyHtml(val, explicitPrefix = '') {
      const n = Number(val || 0);
      const prefix = explicitPrefix !== '' ? explicitPrefix : n < -0.004 ? '-' : '';
      const numStr = prefix + formatNumPlain(n);
      return `<span dir="rtl" style="white-space:nowrap;unicode-bidi:isolate;font-family:'Cairo','Tajawal',Tahoma,Arial,sans-serif;font-weight:900;">\u2066${numStr}\u2069&#160;د.ج</span>`;
    }

    function amountToWords(amount, lang) {
      const rounded = Math.round(Math.max(0, Number(amount || 0)));
      if (lang === 'ar' && typeof window.numberToArabicWords === 'function') {
        try { return window.numberToArabicWords(rounded); } catch (_) {}
      }
      if (lang === 'fr' && typeof window.numberToFrenchWords === 'function') {
        try { return window.numberToFrenchWords(rounded); } catch (_) {}
      }
      if (lang === 'fr') return `${rounded.toLocaleString('fr-FR')} Dinars Algériens`;
      if (lang === 'en') return `${rounded.toLocaleString('en-US')} Algerian Dinars`;
      return `${rounded.toLocaleString('en-US')} دينار جزائري`;
    }

    function interpolateVars(rawText, doc, shop) {
      if (!rawText) return '';
      const isWalkin = Boolean(doc.isWalkinCustomer);
      const pts = isWalkin ? 0 : Math.floor(Number(doc.loyaltyTotalBalance || 0));
      const totalDebt = isWalkin ? 0 : Number(doc.customerCurrentTotalDebt || 0);
      return String(rawText)
        .replace(/\{اسم_المتجر\}/g, shop.name || 'Gherbi.Ai POS')
        .replace(/\{هاتف_المتجر\}/g, shop.phone || '')
        .replace(/\{عنوان_المتجر\}/g, shop.address || '')
        .replace(/\{رقم_الفاتورة\}/g, doc.docNumber || '')
        .replace(/\{التاريخ\}/g, doc.date || '')
        .replace(/\{اسم_الزبون\}/g, doc.partyName || '')
        .replace(/\{الإجمالي_بالدينار\}/g, fmtDzd(doc.total))
        .replace(/\{الإجمالي_بالسنتيم\}/g, fmtCentimes(doc.total))
        .replace(/\{إجمالي_ديون_الزبون\}/g, fmtDzd(totalDebt))
        .replace(/\{نقاط_الوفاء\}/g, `${pts} نقطة (${pts * 2} د.ج)`);
    }

    function renderItemsTableHtml(tpl, doc, theme, isThermal) {
      const cols = tpl.columns || {};
      const lang = tpl.lang || 'ar';
      const defaultLabels = PSP.state.DEFAULT_COLUMN_LABELS[lang] || PSP.state.DEFAULT_COLUMN_LABELS.ar;
      const labels = { ...defaultLabels, ...(tpl.columnLabels || {}) };
      const items = Array.isArray(doc.items) ? doc.items : [];
      const padY = tpl.densityMode === 'compact' ? (isThermal ? '3px' : '4px') : tpl.densityMode === 'spacious' ? (isThermal ? '6px' : '8px') : (isThermal ? '4px' : '6px');
      const rowBorder = tpl.borderMode === 'dashed' ? '1px dashed #94a3b8' : '1px solid #cbd5e1';

      if (items.length === 0) {
        return `<div style="padding:7px;text-align:center;color:#64748b;font-size:10px;border:1px dashed #cbd5e1;border-radius:6px;">لا توجد بنود مدرجة</div>`;
      }

      if (isThermal) {
        const rows = items.map((it, idx) => {
          const nameHtml = bidiHtml(it.name || it.product_name || it.custom_product_name || 'صنف');
          const qty = Number(it.qty ?? it.quantity ?? 1);
          const price = Number(it.price ?? 0);
          const sub = it.subtotal !== undefined ? Number(it.subtotal) : qty * price;
          const unit = cleanPrintText(it.unit || it.product_unit || '');
          const bc = cleanPrintText(it.barcode || it.product_barcode || '');
          return `
            <tr style="border-bottom:${rowBorder};">
              <td style="padding:${padY} 2px;font-weight:800;text-align:right;word-break:break-word;line-height:1.3;">
                ${cols.index ? `<bdi dir="ltr" style="font-family:Tahoma,monospace;color:#475569;">#${idx + 1}</bdi> ` : ''}${nameHtml}
                ${(cols.unit && unit) || (cols.barcode && bc) ? `<div style="font-size:8.6px;color:#475569;font-weight:700;">${cols.unit && unit ? esc(unit) : ''}${cols.unit && unit && cols.barcode && bc ? ' | ' : ''}${cols.barcode && bc ? `<bdi dir="ltr">${esc(bc)}</bdi>` : ''}</div>` : ''}
              </td>
              ${cols.qty !== false ? `<td style="padding:${padY} 2px;text-align:center;font-family:monospace;font-weight:900;white-space:nowrap;"><bdi dir="ltr">${qty}</bdi></td>` : ''}
              ${cols.unitPrice !== false ? `<td style="padding:${padY} 2px;text-align:center;font-family:monospace;font-weight:700;white-space:nowrap;"><bdi dir="ltr">${formatNumPlain(price)}</bdi></td>` : ''}
              ${cols.subtotal !== false ? `<td style="padding:${padY} 2px;text-align:left;font-family:monospace;font-weight:900;white-space:nowrap;"><bdi dir="ltr">${sub < 0 ? '-' : ''}${formatNumPlain(sub)}</bdi></td>` : ''}
            </tr>`;
        }).join('');

        return `
          <table style="width:100%;border-collapse:collapse;font-size:10.3px;">
            <thead>
              <tr style="background:${theme.primary};color:${theme.headerText || '#ffffff'};font-weight:900;">
                <th style="padding:4px 3px;text-align:right;">${esc(labels.name)}</th>
                ${cols.qty !== false ? `<th style="padding:4px 2px;text-align:center;width:14%;">${esc(labels.qty)}</th>` : ''}
                ${cols.unitPrice !== false ? `<th style="padding:4px 2px;text-align:center;width:21%;">${esc(labels.unitPrice)}</th>` : ''}
                ${cols.subtotal !== false ? `<th style="padding:4px 3px;text-align:left;width:23%;">${esc(labels.subtotal)}</th>` : ''}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      }

      const rowsA4 = items.map((it, idx) => {
        const nameHtml = bidiHtml(it.name || it.product_name || it.custom_product_name || 'صنف');
        const qty = Number(it.qty ?? it.quantity ?? 1);
        const price = Number(it.price ?? 0);
        const disc = Number(it.discount || 0);
        const tva = Number(it.tva || 0);
        const sub = it.subtotal !== undefined ? Number(it.subtotal) : qty * price;
        const unit = esc(cleanPrintText(it.unit || it.product_unit || 'قطعة'));
        const bc = esc(cleanPrintText(it.barcode || it.product_barcode || '-'));
        const cellBorder = tpl.borderMode === 'grid' ? 'border-left:1px solid #e2e8f0;' : '';
        return `
          <tr style="border-bottom:${rowBorder};background:${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
            ${cols.index ? `<td style="padding:${padY} 5px;text-align:center;font-family:monospace;font-weight:800;${cellBorder}">${idx + 1}</td>` : ''}
            ${cols.barcode ? `<td style="padding:${padY} 5px;text-align:center;font-family:monospace;font-size:10px;${cellBorder}"><bdi dir="ltr">${bc}</bdi></td>` : ''}
            ${cols.name !== false ? `<td style="padding:${padY} 6px;text-align:right;font-weight:800;${cellBorder}">${nameHtml}</td>` : ''}
            ${cols.unit ? `<td style="padding:${padY} 5px;text-align:center;${cellBorder}">${unit}</td>` : ''}
            ${cols.qty !== false ? `<td style="padding:${padY} 5px;text-align:center;font-family:monospace;font-weight:900;${cellBorder}"><bdi dir="ltr">${qty}</bdi></td>` : ''}
            ${cols.unitPrice !== false ? `<td style="padding:${padY} 5px;text-align:center;font-family:monospace;font-weight:800;${cellBorder}"><bdi dir="ltr">${formatNumPlain(price)}</bdi></td>` : ''}
            ${cols.discount ? `<td style="padding:${padY} 5px;text-align:center;font-family:monospace;${cellBorder}">${disc > 0 ? `<bdi dir="ltr">${formatNumPlain(disc)}</bdi>` : '-'}</td>` : ''}
            ${cols.tva ? `<td style="padding:${padY} 5px;text-align:center;font-family:monospace;${cellBorder}">${tva > 0 ? `<bdi dir="ltr">${tva}%</bdi>` : '-'}</td>` : ''}
            ${cols.subtotal !== false ? `<td style="padding:${padY} 6px;text-align:left;font-weight:900;">${moneyHtml(sub)}</td>` : ''}
          </tr>`;
      }).join('');

      return `
        <table style="width:100%;border-collapse:collapse;font-size:11.2px;border:1.5px solid ${theme.primary};">
          <thead>
            <tr style="background:${theme.primary};color:${theme.headerText || '#ffffff'};font-weight:900;">
              ${cols.index ? `<th style="padding:6px 4px;text-align:center;width:36px;">${esc(labels.index)}</th>` : ''}
              ${cols.barcode ? `<th style="padding:6px 5px;text-align:center;">${esc(labels.barcode)}</th>` : ''}
              ${cols.name !== false ? `<th style="padding:6px 6px;text-align:right;">${esc(labels.name)}</th>` : ''}
              ${cols.unit ? `<th style="padding:6px 5px;text-align:center;">${esc(labels.unit)}</th>` : ''}
              ${cols.qty !== false ? `<th style="padding:6px 5px;text-align:center;">${esc(labels.qty)}</th>` : ''}
              ${cols.unitPrice !== false ? `<th style="padding:6px 5px;text-align:center;">${esc(labels.unitPrice)}</th>` : ''}
              ${cols.discount ? `<th style="padding:6px 5px;text-align:center;">${esc(labels.discount)}</th>` : ''}
              ${cols.tva ? `<th style="padding:6px 5px;text-align:center;">${esc(labels.tva)}</th>` : ''}
              ${cols.subtotal !== false ? `<th style="padding:6px 6px;text-align:left;">${esc(labels.subtotal)}</th>` : ''}
            </tr>
          </thead>
          <tbody>${rowsA4}</tbody>
        </table>`;
    }

    
    /* [PSP_NATIVE_ZREPORT_HELPERS_START] */
function formatAlgerianCentimesV2(val) {
  const n = Number(val || 0);
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return '0 سنتيم';
  const sign = n < 0 ? '-' : '';
  const totalCent = Math.round(Math.abs(n) * 100);
  const millions = Math.floor(totalCent / 1000000);
  const remAfterM = totalCent % 1000000;
  const thousands = Math.floor(remAfterM / 1000);
  const rem = remAfterM % 1000;
  const parts = [];
  if (millions > 0) {
    parts.push(millions === 1 ? 'مليون' : millions === 2 ? 'مليونين' : (millions <= 10 ? millions + ' ملايين' : millions + ' مليون'));
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'ألف' : thousands === 2 ? 'ألفين' : (thousands <= 10 ? thousands + ' آلاف' : thousands + ' ألف'));
  }
  if (rem > 0) parts.push(String(rem));
  return sign + parts.join(' و ') + ' سنتيم';
}
function getDefaultZReportSampleDossier() {
  return {
    openedAt: '2026-11-20 08:00',
    closedAt: '2026-11-20 20:00',
    durationLabel: '12 ساعة',
    outflows: [
      { time: '11:20', typeLabel: 'سلفة عامل #2', beneficiary: 'محمد (العامل)', reason: 'سلفة نقدية من الصندوق', amount: 1000 },
      { time: '15:40', typeLabel: 'نقل وشحن', beneficiary: 'موزع البضاعة', reason: 'تفريغ ونقل سلع التموين', amount: 500 }
    ],
    debtCollections: [
      { time: '14:15', customerName: 'أمين بن يحيى', note: 'دفعة من الدين السابق', amount: 1200, remainingDebtNow: 550 }
    ],
    debtCollectionsGrouped: [
      { customerName: 'أمين بن يحيى', count: 1, total: 1200, remainingDebtNow: 550 }
    ],
    creditSalesToday: [
      { docNumber: 'FAC-0124', time: '16:30', customerName: 'كريم بن عيسى', customerPhone: '0661445566', invoiceTotal: 1450, paidToday: 500, creditAdded: 950, cumulativeDebtNow: 2150 },
      { docNumber: 'FAC-0127', time: '18:10', customerName: 'سليم مرابط', customerPhone: '0770889900', invoiceTotal: 620, paidToday: 0, creditAdded: 620, cumulativeDebtNow: 620 }
    ],
    topDebtors: [
      { name: 'كريم بن عيسى', phone: '0661445566', debt: 2150 },
      { name: 'سليم مرابط', phone: '0770889900', debt: 620 },
      { name: 'أمين بن يحيى', phone: '0550112233', debt: 550 }
    ],
    ownerAlerts: [
      { level: 'info', text: 'تم منح ديون جديدة بقيمة 1,570.00 د.ج لـ (2) زبائن في هذه الوردية.' }
    ],
    kpis: {
      salesCount: 24,
      totalSalesRevenue: 17370,
      avgBasket: 723.75,
      totalDiscounts: 150,
      cashSalesDirect: 14800,
      settledViaDebtPayments: 0,
      totalOutflows: 1500,
      totalDebtCollected: 1200,
      totalCreditAddedToday: 1570,
      storeTotalDebtReal: 3320,
      debtorsCount: 3
    },
    paymentBreakdown: { cash: 14800, debtCollectedCash: 1200, settledViaDebtPayments: 0, cib: 1000, baridimob: 0, cheque: 0, credit: 1570, other: 0 }
  };
}
function renderNativeZReportSection(secId, tpl, doc, theme, isThermal, customTitle, noteBlock, h) {
  const esc = h.esc;
  const bidiHtml = h.bidiHtml;
  const moneyHtml = h.moneyHtml;
  const fd = doc.forensicDossier || getDefaultZReportSampleDossier();
  const ss = doc.shiftSummary || {};
  const sOpts = (tpl && tpl.shiftOptions) || {};
  const showEmpty = sOpts.showZeroEmptySections !== false;

  // 1. ميزان الوردية المزدوج المطوّر (مع توقيت الافتتاح والإغلاق + السنتيم الجزائري + الفارق الدقيق)
  if (secId === 'shift_cash_debt_balance') {
    const opening = Number(ss.openingBalance ?? 8000);
    const cashSales = Number(ss.cashSales ?? (fd.kpis && fd.kpis.cashSalesDirect) ?? 0);
    const debtCollected = Number(ss.debtPayments ?? (fd.kpis && fd.kpis.totalDebtCollected) ?? 0);
    const deposits = Number(ss.orderDeposits ?? 0);
    const cashIn = Number(ss.cashIn ?? 0);
    const cashOut = Number(ss.cashOut ?? 0);
    const expenses = Number(ss.expenses ?? 0);
    const expectedDrawer = ss.expectedBalance !== undefined
      ? Number(ss.expectedBalance)
      : Number((opening + cashSales + debtCollected + deposits + cashIn - cashOut - expenses).toFixed(2));
    const countedDrawer = ss.countedBalance !== undefined ? Number(ss.countedBalance) : expectedDrawer;
    const diff = Number((countedDrawer - expectedDrawer).toFixed(2));
    const newCredit = Number(ss.newCreditGiven ?? (fd.kpis && fd.kpis.totalCreditAddedToday) ?? 0);
    const storeDebt = Number(ss.totalStoreCustomerDebt ?? (fd.kpis && fd.kpis.storeTotalDebtReal) ?? newCredit);

    const openedAt = ss.openedAt || fd.openedAt || '';
    const closedAt = ss.closedAt || fd.closedAt || doc.date || '';
    const dur = ss.durationLabel || fd.durationLabel || '';
    const showTimes = sOpts.showShiftTimes !== false;
    const showCent = sOpts.showDrawerCentimes !== false;

    const diffColor = Math.abs(diff) < 0.01 ? '#047857' : diff < 0 ? '#be123c' : '#b45309';
    const diffBadge = Math.abs(diff) < 0.01 ? 'مطابق تماماً' : diff < 0 ? 'عجز بالدرج' : 'فائض بالدرج';

    const timesBar = showTimes && (openedAt || closedAt)
      ? `<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px;font-size:${isThermal ? '8px' : '9.6px'};font-weight:800;color:#334155;background:#ffffff;border:1px dashed #cbd5e1;border-radius:5px;padding:3px 6px;margin-bottom:5px;">` +
        `<span>🕒 الافتتاح: <bdi dir="ltr">${esc(openedAt || '--')}</bdi></span>` +
        `<span>🔒 الإغلاق: <bdi dir="ltr">${esc(closedAt || '--')}</bdi></span>` +
        (dur ? `<span style="color:#1d4ed8;">⏱️ المدة: ${esc(dur)}</span>` : '') +
        `</div>`
      : '';

    const centLine = showCent
      ? `<div style="font-size:${isThermal ? '8px' : '9.4px'};font-weight:800;color:#b45309;margin-top:1px;">بالسنتيم: ${esc(formatAlgerianCentimesV2(expectedDrawer))}</div>`
      : '';

    return (
      `<div style="border:2px solid ${theme.primary || '#0f172a'};border-radius:8px;padding:${isThermal ? '6px' : '8px 10px'};background:#f8fafc;color:#0f172a;font-size:${isThermal ? '9px' : '11px'};">` +
      `<div style="font-weight:900;text-align:center;background:${theme.primary || '#0f172a'};color:#ffffff;padding:3px 6px;border-radius:5px;margin-bottom:5px;">${bidiHtml(customTitle || 'ميزان الوردية المزدوج: سيولة الدرج مقابل الديون')}</div>` +
      timesBar +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;text-align:center;font-weight:900;">` +
      `<div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:7px;padding:5px;">` +
      `<div style="font-size:${isThermal ? '8.4px' : '9.8px'};color:#1d4ed8;">السيولة المتوقعة بالدرج</div>` +
      `<div style="font-size:${isThermal ? '11.5px' : '14px'};color:#1e3a8a;margin-top:1px;">${moneyHtml(expectedDrawer)}</div>` +
      centLine +
      `<div style="font-size:${isThermal ? '8px' : '9.2px'};color:#047857;margin-top:2px;">المعدود: ${moneyHtml(countedDrawer)}</div>` +
      `<div style="font-size:${isThermal ? '8px' : '9.2px'};color:${diffColor};">الفارق: ${moneyHtml(diff, diff > 0 ? '+' : '')} (${diffBadge})</div>` +
      `</div>` +
      `<div style="background:#fff1f2;border:1.5px solid #fda4af;border-radius:7px;padding:5px;">` +
      `<div style="font-size:${isThermal ? '8.4px' : '9.8px'};color:#be123c;">ديون ممنوحة بالوردية (آجلة)</div>` +
      `<div style="font-size:${isThermal ? '11.5px' : '14px'};color:#881337;margin-top:1px;">${moneyHtml(newCredit)}</div>` +
      `<div style="font-size:${isThermal ? '8px' : '9.2px'};color:#047857;margin-top:2px;">تحصيل ديون للدرج: ${moneyHtml(debtCollected, '+')}</div>` +
      `<div style="font-size:${isThermal ? '8px' : '9.2px'};color:#475569;">إجمالي ذمم المتجر: ${moneyHtml(storeDebt)}</div>` +
      `</div></div>` +
      `<div style="margin-top:4px;font-size:${isThermal ? '7.8px' : '9px'};font-weight:800;color:#475569;text-align:center;">الديون الممنوحة ذمم لدى الزبائن لا تُجمع مع كاش الدرج، بينما تحصيلات الديون مضافة فعلياً في الدرج.</div>` +
      `${noteBlock}</div>`
    );
  }

  // 2. معادلة حركة المداخيل والمصاريف النقدية بالدرج (دقيقة 100% من caisse_transactions)
  if (secId === 'shift_flows_summary') {
    const opening = Number(ss.openingBalance ?? 8000);
    const cashSales = Number(ss.cashSales ?? (fd.kpis && fd.kpis.cashSalesDirect) ?? 0);
    const debtCollected = Number(ss.debtPayments ?? (fd.kpis && fd.kpis.totalDebtCollected) ?? 0);
    const deposits = Number(ss.orderDeposits ?? 0);
    const cashIn = Number(ss.cashIn ?? 0);
    const totalIn = Number((deposits + cashIn).toFixed(2));
    const totalOut = Number((Number(ss.expenses || 0) + Number(ss.cashOut || 0)).toFixed(2));
    const expectedDrawer = ss.expectedBalance !== undefined
      ? Number(ss.expectedBalance)
      : Number((opening + cashSales + debtCollected + totalIn - totalOut).toFixed(2));

    return (
      `<div style="border:1.5px dashed #475569;border-radius:7px;padding:${isThermal ? '5px 6px' : '7px 10px'};background:#ffffff;font-size:${isThermal ? '8.8px' : '10.5px'};font-weight:800;color:#1e293b;line-height:1.55;">` +
      `<div style="font-weight:900;color:#0f172a;border-bottom:1px dashed #cbd5e1;padding-bottom:2px;margin-bottom:4px;">${bidiHtml(customTitle || 'معادلة حركة السيولة النقدية في الدرج:')}</div>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;">` +
      `<div>الرصيد الافتتاحي: <strong>${moneyHtml(opening)}</strong></div>` +
      `<div style="color:#047857;">مبيعات كاش مباشرة: <strong>${moneyHtml(cashSales, '+')}</strong></div>` +
      `<div style="color:#047857;">تحصيل ديون نقداً: <strong>${moneyHtml(debtCollected, '+')}</strong></div>` +
      `<div style="color:#0284c7;">إيداعات وعربون: <strong>${moneyHtml(totalIn, '+')}</strong></div>` +
      `<div style="color:#be123c;">مصاريف وسحوبات: <strong>${moneyHtml(-Math.abs(totalOut))}</strong></div>` +
      `<div style="color:#1e3a8a;font-weight:900;">صافي الدرج المتوقع: <strong>${moneyHtml(expectedDrawer)}</strong></div>` +
      `</div>${noteBlock}</div>`
    );
  }

  // 3. رادار تنبيهات الرقابة لصاحب المتجر
  if (secId === 'shift_owner_alerts') {
    const alerts = Array.isArray(fd.ownerAlerts) ? fd.ownerAlerts : [];
    if (alerts.length === 0) {
      if (!showEmpty) return '';
      return (
        `<div style="border:1.5px solid #6ee7b7;background:#ecfdf5;border-radius:7px;padding:${isThermal ? '4px 6px' : '7px 10px'};font-size:${isThermal ? '8.6px' : '10.2px'};font-weight:800;color:#065f46;text-align:center;">` +
        `✅ ${bidiHtml(customTitle || 'رادار الرقابة: الوردية مطابقة وسليمة 100% ولا توجد تنبيهات خطيرة')}` +
        `${noteBlock}</div>`
      );
    }
    const rows = alerts.map((al) => {
      const col = al.level === 'danger' ? '#be123c' : al.level === 'warning' ? '#b45309' : '#1d4ed8';
      return `<div style="color:${col};font-weight:800;font-size:${isThermal ? '8.4px' : '10px'};margin-top:2px;">• ${bidiHtml(al.text)}</div>`;
    }).join('');
    return (
      `<div style="border:1.5px solid #e11d48;background:#fff1f2;border-radius:7px;padding:${isThermal ? '5px 6px' : '7px 10px'};color:#0f172a;">` +
      `<div style="font-weight:900;color:#9f1239;font-size:${isThermal ? '9.1px' : '11px'};margin-bottom:2px;">🛡️ ${bidiHtml(customTitle || 'تنبيهات رادار الرقابة لصاحب المتجر:')}</div>` +
      `${rows}${noteBlock}</div>`
    );
  }

  // 4. دفتر الأموال الخارجة (المصاريف، السلَف، السحوبات — من أخذ؟ لماذا؟ متى؟ كم؟)
  if (secId === 'shift_outflows_detail') {
    const showBen = sOpts.showBeneficiary !== false;
    const showTm = sOpts.showOutflowTime !== false;
    const outflows = Array.isArray(fd.outflows) ? fd.outflows : [];
    const totalOut = outflows.reduce((a, b) => a + Math.abs(Number(b.amount || 0)), 0);

    if (outflows.length === 0) {
      if (!showEmpty) return '';
      return (
        `<div style="border:1px dashed #a7f3d0;background:#ecfdf5;border-radius:7px;padding:${isThermal ? '4px 6px' : '7px 10px'};font-size:${isThermal ? '8.6px' : '10.2px'};font-weight:800;color:#065f46;text-align:center;">` +
        `✔ ${bidiHtml(customTitle || 'دفتر الأموال الخارجة: لا توجد مصاريف أو سلَف في هذه الوردية')}` +
        `${noteBlock}</div>`
      );
    }

    if (isThermal) {
      const lines = outflows.map((o, idx) => {
        const who = showBen ? bidiHtml(o.beneficiary) : bidiHtml(o.typeLabel);
        const tm = showTm && o.time ? ` <span style="font-weight:700;color:#64748b;font-size:7.8px;">(${esc(o.time)})</span>` : '';
        const extraReason = o.reason && o.reason !== o.typeLabel ? ` — ${bidiHtml(o.reason)}` : '';
        return (
          `<div style="border-bottom:1px dotted #e2e8f0;padding:2.5px 0;">` +
          `<div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;font-size:8.9px;">` +
          `<span>${idx + 1}. ${who}${tm}</span>` +
          `<span style="color:#be123c;">${moneyHtml(-Math.abs(o.amount || 0))}</span>` +
          `</div>` +
          `<div style="font-size:8px;color:#475569;padding-right:8px;">السبب: ${bidiHtml(o.typeLabel)}${extraReason}</div>` +
          `</div>`
        );
      }).join('');
      return (
        `<div style="border:1.5px solid #fecdd3;border-radius:7px;padding:5px 6px;background:#ffffff;color:#0f172a;">` +
        `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fda4af;padding-bottom:2px;margin-bottom:3px;font-weight:900;font-size:9.1px;color:#9f1239;">` +
        `<span>💸 ${bidiHtml(customTitle || 'الأموال الخارجة (مصاريف / سلَف)')} (${outflows.length})</span>` +
        `<span>${moneyHtml(-totalOut)}</span>` +
        `</div>${lines}${noteBlock}</div>`
      );
    }

    const trs = outflows.map((o, idx) => (
      `<tr>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${idx + 1}</td>` +
      (showTm ? `<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${esc(o.time || '--:--')}</td>` : '') +
      `<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">${bidiHtml(o.typeLabel)}</td>` +
      (showBen ? `<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#9f1239;">${bidiHtml(o.beneficiary)}</td>` : '') +
      `<td style="border:1px solid #e2e8f0;padding:4px;">${bidiHtml(o.reason)}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#be123c;">${moneyHtml(-Math.abs(o.amount || 0))}</td>` +
      `</tr>`
    )).join('');
    return (
      `<div>` +
      `<div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11.5px;color:#9f1239;border-bottom:2px solid #fda4af;padding-bottom:3px;margin-bottom:5px;">` +
      `<span>💸 ${bidiHtml(customTitle || 'سجل الأموال الخارجة من الدرج (المصاريف، السلَف، السحوبات)')}</span>` +
      `<span>الإجمالي: ${moneyHtml(-totalOut)}</span>` +
      `</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:10px;">` +
      `<thead><tr style="background:#ffe4e6;color:#881337;">` +
      `<th style="border:1px solid #fecdd3;padding:4px;width:5%;">#</th>` +
      (showTm ? `<th style="border:1px solid #fecdd3;padding:4px;width:10%;">الساعة</th>` : '') +
      `<th style="border:1px solid #fecdd3;padding:4px;width:17%;">النوع</th>` +
      (showBen ? `<th style="border:1px solid #fecdd3;padding:4px;width:22%;">المستفيد / الآخذ</th>` : '') +
      `<th style="border:1px solid #fecdd3;padding:4px;">السبب والبيان التفصيلي</th>` +
      `<th style="border:1px solid #fecdd3;padding:4px;width:15%;">المبلغ</th>` +
      `</tr></thead><tbody>${trs}</tbody></table>${noteBlock}</div>`
    );
  }

  // 5. دفتر زبائن الكريدي اليوم
  if (secId === 'shift_credit_sales_today') {
    const showPhone = sOpts.showCustomerPhone !== false;
    const showCum = sOpts.showCumulativeDebt !== false;
    const list = Array.isArray(fd.creditSalesToday) ? fd.creditSalesToday : [];
    const totalCred = list.reduce((a, b) => a + Math.max(0, Number(b.creditAdded || 0)), 0);

    if (list.length === 0) {
      if (!showEmpty) return '';
      return (
        `<div style="border:1px dashed #a7f3d0;background:#ecfdf5;border-radius:7px;padding:${isThermal ? '4px 6px' : '7px 10px'};font-size:${isThermal ? '8.6px' : '10.2px'};font-weight:800;color:#065f46;text-align:center;">` +
        `✔ ${bidiHtml(customTitle || 'ديون اليوم: جميع مبيعات الوردية مدفوعة بدون ديون جديدة')}` +
        `${noteBlock}</div>`
      );
    }

    if (isThermal) {
      const lines = list.map((cs, idx) => (
        `<div style="border-bottom:1px dotted #e2e8f0;padding:2.5px 0;">` +
        `<div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;font-size:8.9px;">` +
        `<span>${idx + 1}. ${bidiHtml(cs.customerName)}${showPhone && cs.customerPhone ? ` <span style="font-weight:700;color:#64748b;font-size:7.6px;">${esc(cs.customerPhone)}</span>` : ''}</span>` +
        `<span style="color:#c2410c;">${moneyHtml(cs.creditAdded, '+')}</span>` +
        `</div>` +
        `<div style="font-size:7.9px;color:#475569;display:flex;justify-content:space-between;gap:4px;">` +
        `<span>فاتورة ${bidiHtml(cs.docNumber || '')} | مدفوع: ${moneyHtml(cs.paidToday || 0)}</span>` +
        (showCum ? `<span>دينه الكلي: ${moneyHtml(cs.cumulativeDebtNow || 0)}</span>` : '') +
        `</div></div>`
      )).join('');
      return (
        `<div style="border:1.5px solid #fed7aa;border-radius:7px;padding:5px 6px;background:#ffffff;color:#0f172a;">` +
        `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fdba74;padding-bottom:2px;margin-bottom:3px;font-weight:900;font-size:9.1px;color:#9a3412;">` +
        `<span>📝 ${bidiHtml(customTitle || 'ديون اليوم (الزبائن المدينون)')} (${list.length})</span>` +
        `<span>${moneyHtml(totalCred, '+')}</span>` +
        `</div>${lines}${noteBlock}</div>`
      );
    }

    const trs = list.map((cs, idx) => (
      `<tr>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${idx + 1}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${bidiHtml(cs.docNumber || '')}<br><span style="font-size:8.5px;color:#64748b;">${esc(cs.time || '')}</span></td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;">${bidiHtml(cs.customerName)}${showPhone && cs.customerPhone ? `<br><span style="font-size:8.5px;color:#475569;">${esc(cs.customerPhone)}</span>` : ''}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;">${moneyHtml(cs.invoiceTotal || 0)}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">${moneyHtml(cs.paidToday || 0)}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#c2410c;">${moneyHtml(cs.creditAdded || 0, '+')}</td>` +
      (showCum ? `<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#991b1b;">${moneyHtml(cs.cumulativeDebtNow || 0)}</td>` : '') +
      `</tr>`
    )).join('');
    return (
      `<div>` +
      `<div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11.5px;color:#9a3412;border-bottom:2px solid #fdba74;padding-bottom:3px;margin-bottom:5px;">` +
      `<span>📝 ${bidiHtml(customTitle || 'قائمة الزبائن المدينين اليوم (المبيعات الآجلة والدفع الجزئي)')}</span>` +
      `<span>إجمالي دين الوردية: ${moneyHtml(totalCred, '+')}</span>` +
      `</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:10px;">` +
      `<thead><tr style="background:#ffedd5;color:#7c2d12;">` +
      `<th style="border:1px solid #fed7aa;padding:4px;width:5%;">#</th>` +
      `<th style="border:1px solid #fed7aa;padding:4px;width:15%;">الفاتورة / الوقت</th>` +
      `<th style="border:1px solid #fed7aa;padding:4px;">اسم الزبون</th>` +
      `<th style="border:1px solid #fed7aa;padding:4px;width:13%;">الإجمالي</th>` +
      `<th style="border:1px solid #fed7aa;padding:4px;width:13%;">المدفوع</th>` +
      `<th style="border:1px solid #fed7aa;padding:4px;width:13%;">دين اليوم (+)</th>` +
      (showCum ? `<th style="border:1px solid #fed7aa;padding:4px;width:13%;">دينه الكلي الآن</th>` : '') +
      `</tr></thead><tbody>${trs}</tbody></table>${noteBlock}</div>`
    );
  }

  // 6. سجل تحصيلات الديون بالوردية بأسماء الزبائن
  if (secId === 'shift_debt_collections') {
    const colsGrouped = Array.isArray(fd.debtCollectionsGrouped) ? fd.debtCollectionsGrouped : [];
    const colsRaw = Array.isArray(fd.debtCollections) ? fd.debtCollections : [];
    const totalCol =
      colsRaw.reduce((a, b) => a + Math.max(0, Number(b.amount || 0)), 0) ||
      colsGrouped.reduce((a, b) => a + Math.max(0, Number(b.total || 0)), 0);

    if (colsRaw.length === 0 && colsGrouped.length === 0) {
      if (!showEmpty) return '';
      return (
        `<div style="border:1px dashed #cbd5e1;background:#f8fafc;border-radius:7px;padding:${isThermal ? '4px 6px' : '6px 10px'};font-size:${isThermal ? '8.5px' : '10px'};font-weight:700;color:#475569;text-align:center;">` +
        `${bidiHtml(customTitle || 'تحصيلات الديون بالوردية: لا توجد دفعات تحصيل ديون مسجلة')}` +
        `${noteBlock}</div>`
      );
    }

    if (isThermal) {
      const list = colsGrouped.length > 0 ? colsGrouped : colsRaw.map((x) => ({ customerName: x.customerName, count: 1, total: x.amount }));
      const rows = list.map((c) => (
        `<div style="display:flex;justify-content:space-between;font-size:8.7px;padding:1.5px 0;border-bottom:1px dotted #a7f3d0;">` +
        `<span style="font-weight:800;">${bidiHtml(c.customerName)}${c.count > 1 ? ` (${c.count} دفعات)` : ''}</span>` +
        `<span style="color:#047857;font-weight:900;">${moneyHtml(c.total, '+')}</span>` +
        `</div>`
      )).join('');
      return (
        `<div style="border:1.5px solid #a7f3d0;border-radius:7px;padding:5px 6px;background:#ecfdf5;color:#0f172a;">` +
        `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #34d399;padding-bottom:2px;margin-bottom:3px;font-weight:900;font-size:9.1px;color:#065f46;">` +
        `<span>🤝 ${bidiHtml(customTitle || 'تحصيلات الديون بالوردية')} (${list.length})</span>` +
        `<span>${moneyHtml(totalCol, '+')}</span>` +
        `</div>${rows}${noteBlock}</div>`
      );
    }

    const trs = colsRaw.map((dc, idx) => (
      `<tr>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${idx + 1}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${esc(dc.time || '--:--')}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#065f46;">${bidiHtml(dc.customerName)}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;">${bidiHtml(dc.note || 'تسديد دين')}${dc.remainingDebtNow !== null && dc.remainingDebtNow !== undefined ? ` | الباقي: ${moneyHtml(dc.remainingDebtNow)}` : ''}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">${moneyHtml(dc.amount || 0, '+')}</td>` +
      `</tr>`
    )).join('');
    return (
      `<div>` +
      `<div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11.5px;color:#065f46;border-bottom:2px solid #6ee7b7;padding-bottom:3px;margin-bottom:5px;">` +
      `<span>🤝 ${bidiHtml(customTitle || 'سجل تحصيلات الديون المقبوضة في الدرج بأسماء الزبائن')}</span>` +
      `<span>إجمالي المحصل: ${moneyHtml(totalCol, '+')}</span>` +
      `</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:10px;">` +
      `<thead><tr style="background:#d1fae5;color:#064e3b;">` +
      `<th style="border:1px solid #a7f3d0;padding:4px;width:5%;">#</th>` +
      `<th style="border:1px solid #a7f3d0;padding:4px;width:12%;">الساعة</th>` +
      `<th style="border:1px solid #a7f3d0;padding:4px;width:28%;">اسم الزبون</th>` +
      `<th style="border:1px solid #a7f3d0;padding:4px;">البيان والرصيد المتبقي</th>` +
      `<th style="border:1px solid #a7f3d0;padding:4px;width:16%;">المبلغ المقبوض</th>` +
      `</tr></thead><tbody>${trs}</tbody></table>${noteBlock}</div>`
    );
  }

  // 7. تفصيل المبيعات ووسائل الدفع ومؤشرات الأداء (بدون خلط بين الكاش المباشر وتسديدات الديون!)
  if (secId === 'shift_payment_kpis') {
    const kpis = fd.kpis || {};
    const pm = fd.paymentBreakdown || {};
    const elec = Number(pm.cib || 0) + Number(pm.baridimob || 0);
    const settledLater = Number(kpis.settledViaDebtPayments ?? pm.settledViaDebtPayments ?? 0);
    return (
      `<div style="border:1.5px solid ${theme.border};border-radius:7px;padding:${isThermal ? '5px 6px' : '8px 10px'};background:#f8fafc;color:#0f172a;font-size:${isThermal ? '8.4px' : '10.2px'};">` +
      `<div style="font-weight:900;color:${theme.primary};border-bottom:1px dashed #cbd5e1;padding-bottom:2px;margin-bottom:4px;font-size:${isThermal ? '9.1px' : '11px'};">💳 ${bidiHtml(customTitle || 'تفصيل المبيعات ووسائل الدفع ومؤشرات الأداء')}</div>` +
      `<div style="display:grid;grid-template-columns:${isThermal ? '1fr 1fr' : 'repeat(3,1fr)'};gap:${isThermal ? '3px 6px' : '5px 10px'};font-weight:800;">` +
      `<div>عدد الفواتير: <strong>${Number(kpis.salesCount || 0)}</strong></div>` +
      `<div>رقم الأعمال: <strong>${moneyHtml(kpis.totalSalesRevenue || 0)}</strong></div>` +
      `<div>متوسط السلة: <strong>${moneyHtml(kpis.avgBasket || 0)}</strong></div>` +
      `<div>💵 مبيعات كاش مباشرة: <strong>${moneyHtml(pm.cash || 0)}</strong></div>` +
      `<div>💳 إلكتروني (CIB/CCP): <strong>${moneyHtml(elec)}</strong></div>` +
      `<div>📝 ديون متبقية اليوم: <strong>${moneyHtml(pm.credit || 0)}</strong></div>` +
      (settledLater > 0.009 ? `<div style="color:#047857;">🔄 فواتير سُدّدت عبر الكريدي: <strong>${moneyHtml(settledLater)}</strong></div>` : `<div>🏦 شيك/صك: <strong>${moneyHtml(pm.cheque || 0)}</strong></div>`) +
      `<div>🏷️ التخفيضات: <strong>${moneyHtml(kpis.totalDiscounts || 0)}</strong></div>` +
      `<div>📌 إجمالي ديون المتجر: <strong>${moneyHtml(kpis.storeTotalDebtReal || 0)}</strong></div>` +
      `</div>${noteBlock}</div>`
    );
  }

  // 8. أكبر المدينين في المتجر للمتابعة غداً
  if (secId === 'shift_top_debtors') {
    const limit = Math.max(1, Number(sOpts.topDebtorsLimit || 5));
    const showPhone = sOpts.showCustomerPhone !== false;
    const topList = (Array.isArray(fd.topDebtors) ? fd.topDebtors : []).slice(0, limit);
    const totalStore = Number((fd.kpis && fd.kpis.storeTotalDebtReal) || topList.reduce((a, b) => a + Number(b.debt || 0), 0));
    if (topList.length === 0) {
      if (!showEmpty) return '';
      return (
        `<div style="border:1px dashed #a7f3d0;background:#ecfdf5;border-radius:7px;padding:6px 10px;font-size:10px;font-weight:800;color:#065f46;text-align:center;">` +
        `✔ لا توجد ديون عالقة على الزبائن حالياً${noteBlock}</div>`
      );
    }
    const rows = topList.map((td, idx) => (
      `<div style="display:flex;justify-content:space-between;padding:2.5px 0;border-bottom:1px dotted #e2e8f0;font-size:${isThermal ? '8.5px' : '10px'};">` +
      `<span style="font-weight:800;">${idx + 1}. ${bidiHtml(td.name)}${showPhone && td.phone ? ` <span style="color:#64748b;font-weight:600;">(${esc(td.phone)})</span>` : ''}</span>` +
      `<span style="color:#b91c1c;font-weight:900;">${moneyHtml(td.debt || 0)}</span>` +
      `</div>`
    )).join('');
    return (
      `<div style="border:1.5px solid #fed7aa;border-radius:7px;padding:${isThermal ? '5px 6px' : '7px 10px'};background:#fffbeb;color:#0f172a;">` +
      `<div style="display:flex;justify-content:space-between;font-weight:900;color:#9a3412;border-bottom:1px dashed #fdba74;padding-bottom:2px;margin-bottom:3px;font-size:${isThermal ? '9.1px' : '11px'};">` +
      `<span>📌 ${bidiHtml(customTitle || 'أكبر المدينين في المتجر (للمتابعة غداً)')}</span>` +
      `<span>الكل: ${moneyHtml(totalStore)}</span>` +
      `</div>${rows}${noteBlock}</div>`
    );
  }

  return '';
}
function renderNativeZReportSignatures(tpl, doc, isThermal, noteBlock, esc) {
  const sigMode = (tpl && tpl.shiftOptions && tpl.shiftOptions.signatureMode) || (isThermal ? 'dual' : 'triple');
  const cashierLbl = esc((doc && doc.shiftSummary && doc.shiftSummary.cashierName) || (doc && doc.cashierName) || 'أمين الصندوق');
  if (sigMode === 'dual' || isThermal) {
    return (
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px;text-align:center;font-size:${isThermal ? '8.4px' : '10px'};font-weight:900;color:#334155;">` +
      `<div style="border:1.5px dashed #94a3b8;border-radius:6px;padding:5px 4px ${isThermal ? '20px' : '32px'};">توقيع الكاشير (المسلّم)<br><span style="font-weight:700;font-size:8px;color:#64748b;">${cashierLbl}</span></div>` +
      `<div style="border:1.5px dashed #94a3b8;border-radius:6px;padding:5px 4px ${isThermal ? '20px' : '32px'};">توقيع صاحب المتجر<br><span style="font-weight:700;font-size:8px;color:#64748b;">المصادقة والاستلام</span></div>` +
      `</div>${noteBlock}`
    );
  }
  return (
    `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:6px;text-align:center;font-size:10px;font-weight:900;color:#334155;">` +
    `<div style="border:1.5px dashed #94a3b8;border-radius:7px;padding:7px 5px 34px;">أمين الصندوق (المسلّم)<br><span style="font-weight:700;font-size:8.8px;color:#64748b;">${cashierLbl}</span></div>` +
    `<div style="border:1.5px dashed #94a3b8;border-radius:7px;padding:7px 5px 34px;">المراجع / المحاسب<br><span style="font-weight:700;font-size:8.8px;color:#64748b;">مطابقة الجرد والوثائق</span></div>` +
    `<div style="border:1.5px dashed #94a3b8;border-radius:7px;padding:7px 5px 34px;">صاحب المتجر / المدير<br><span style="font-weight:700;font-size:8.8px;color:#64748b;">المصادقة والختم النهائي</span></div>` +
    `</div>${noteBlock}`
  );
}
/* [PSP_NATIVE_ZREPORT_HELPERS_END] */
    /* [PSP_NATIVE_EXPENSE_HELPERS_START] */
function renderNativeExpenseOrOutflowsSection(secId, tpl, doc, theme, isThermal, customTitle, noteBlock, h) {
  const esc = h.esc;
  const bidiHtml = h.bidiHtml;
  const moneyHtml = h.moneyHtml;
  const amountToWords = h.amountToWords;
  const formatCent = h.formatCent;
  const mode = h.mode || 'preview';
  const isPreviewMode = mode === 'preview';

  const eOpts = (tpl && tpl.expenseOptions) || {};
  const showSrc = eOpts.showFundingSource !== false;
  const showBen = eOpts.showBeneficiary !== false;
  const showCent = eOpts.showCentimes !== false;
  const showWords = eOpts.showAmountInWords !== false;
  const showShift = eOpts.showShiftRef !== false;

  const sampleVoucher = {
    docRef: 'EXP-DEMO-01',
    date: '2026-11-20',
    time: '14:30',
    category: 'رواتب وأجور وسلفات العمال (معاينة نموذجية)',
    beneficiary: 'اسم المستفيد (مثال)',
    description: 'سند صرف تجريبي لمعاينة التصميم في مركز الطباعة',
    amount: 1000,
    fundingSource: 'active_shift',
    fundingLabel: 'درج الوردية',
    sessionId: 11,
    cashierName: 'المدير العام'
  };

  const sampleReport = {
    periodLabel: 'معاينة نموذجية في مركز الطباعة (أرقام تجريبية)',
    totals: { grandTotal: 4000, expensesTotal: 1000, workersTotal: 1000, suppliersTotal: 2000, purchasesTotal: 0, cashOutTotal: 0, count: 3 },
    byFundingSource: { active_shift: 1000, shop_vault: 1000, bank_ccp: 2000, external_owner: 0 },
    byCategory: [
      { category: 'تسبقات وتسديد الموردين', total: 2000, count: 1, pct: 50 },
      { category: 'رواتب وسلف العمال', total: 1000, count: 1, pct: 25 },
      { category: 'مصاريف تشغيلية', total: 1000, count: 1, pct: 25 }
    ],
    items: [
      { date: '2026-11-20', time: '14:30', kindLabel: 'سلفة عامل', category: 'رواتب وسلف العمال', beneficiary: 'عامل (مثال)', description: 'سلفة نقدية (معاينة)', amount: 1000, fundingLabel: 'درج الوردية', docRef: 'EXP-001' },
      { date: '2026-11-20', time: '12:00', kindLabel: 'مصروف تشغيلي', category: 'مصاريف تشغيلية', beneficiary: 'كهرباء وغاز', description: 'فاتورة (معاينة)', amount: 1000, fundingLabel: 'الخزينة الرئيسية', docRef: 'EXP-002' },
      { date: '2026-11-20', time: '10:30', kindLabel: 'تسديد مورد', category: 'تسبقات وتسديد الموردين', beneficiary: 'مورد (مثال)', description: 'دفعة حساب مورد (معاينة)', amount: 2000, fundingLabel: 'بنك / CCP', docRef: 'REC-001' }
    ]
  };

  const emptyRealReport = {
    periodLabel: 'النطاق المحدد (لا توجد عمليات مسجلة)',
    totals: { grandTotal: 0, expensesTotal: 0, workersTotal: 0, suppliersTotal: 0, purchasesTotal: 0, cashOutTotal: 0, count: 0 },
    byFundingSource: { active_shift: 0, shop_vault: 0, bank_ccp: 0, external_owner: 0 },
    byCategory: [],
    items: []
  };

  // قاعدة حديدية: في الطباعة الحقيقية (mode !== 'preview') لا نعود أبداً للبيانات النموذجية!
  const activeReport = doc.outflowsReport || (isPreviewMode ? sampleReport : emptyRealReport);

  if (secId === 'expense_voucher_card') {
    const v = doc.expenseVoucher || (isPreviewMode ? sampleVoucher : {
      docRef: doc.docNumber || 'EXP',
      date: doc.date || '',
      category: 'مصروف تشغيلي',
      beneficiary: doc.partyName || '',
      description: '',
      amount: Number(doc.total || 0),
      fundingLabel: 'درج الوردية'
    });
    const amt = Number(v.amount ?? doc.total ?? 0);
    const centText = showCent ? formatCent(amt) : '';
    const wordsText = showWords && typeof amountToWords === 'function' ? amountToWords(amt, tpl.lang || 'ar') : '';
    const primary = (theme && theme.primary) || '#be123c';

    return (
      `<div style="border:2px solid ${primary};border-radius:8px;padding:${isThermal ? '6px' : '12px 14px'};background:#ffffff;color:#0f172a;font-size:${isThermal ? '9.2px' : '11.5px'};line-height:1.55;">` +
      `<div style="text-align:center;background:#fff1f2;border:1.5px solid #fda4af;border-radius:7px;padding:${isThermal ? '6px 4px' : '10px'};margin-bottom:8px;">` +
      `<div style="font-size:${isThermal ? '8.6px' : '10.5px'};font-weight:800;color:#9f1239;">المبلغ المصروف (Montant Décaissé)</div>` +
      `<div style="font-size:${isThermal ? '15px' : '22px'};font-weight:900;color:#be123c;margin-top:2px;">${moneyHtml(amt)}</div>` +
      (centText ? `<div style="font-size:${isThermal ? '8.4px' : '10px'};font-weight:800;color:#b45309;margin-top:2px;">بالسنتيم: ${esc(centText)}</div>` : '') +
      (wordsText ? `<div style="font-size:${isThermal ? '8.2px' : '10.2px'};font-weight:800;color:#334155;margin-top:3px;border-top:1px dashed #fda4af;padding-top:3px;">أوقف هذا السند على مبلغ: ${bidiHtml(wordsText)}</div>` : '') +
      `</div>` +
      `<div style="display:grid;grid-template-columns:${isThermal ? '1fr' : '1fr 1fr'};gap:${isThermal ? '3px' : '6px 12px'};font-weight:800;">` +
      `<div>رقم السند: <strong><bdi dir="ltr">${esc(v.docRef || doc.docNumber || 'EXP')}</bdi></strong></div>` +
      `<div>التاريخ والوقت: <strong><bdi dir="ltr">${esc((v.date || '') + (v.time ? ' ' + v.time : ''))}</bdi></strong></div>` +
      `<div>فئة المصروف: <strong style="color:${primary};">${bidiHtml(v.category || 'مصاريف عامة')}</strong></div>` +
      (showBen ? `<div>المستفيد / القابض: <strong style="color:#0f172a;">${bidiHtml(v.beneficiary || doc.partyName || 'غير محدد')}</strong></div>` : '') +
      (showSrc ? `<div style="${isThermal ? '' : 'grid-column:span 2;'}background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:3px 7px;color:#1d4ed8;">🏦 مصدر المال: <strong>${bidiHtml(v.fundingLabel || 'درج الوردية')}</strong></div>` : '') +
      (showShift ? `<div>المسؤول / الكاشير: <strong>${bidiHtml(v.cashierName || doc.cashierName || 'المدير العام')}</strong>${v.sessionId ? ` (وردية #${esc(v.sessionId)})` : ''}</div>` : '') +
      `</div>` +
      `<div style="margin-top:7px;padding:6px 8px;border:1px dashed #94a3b8;border-radius:6px;background:#f8fafc;">` +
      `<span style="font-weight:900;color:#475569;">البيان والسبب التفصيلي: </span>` +
      `<span style="font-weight:800;color:#0f172a;">${bidiHtml(v.description || 'مصروف تشغيلي')}</span>` +
      `</div>${noteBlock}</div>`
    );
  }

  if (secId === 'outflows_report_kpis') {
    const r = activeReport;
    const t = r.totals || {};
    const primary = (theme && theme.primary) || '#0f172a';
    const supAndPurch = Number(t.suppliersTotal || 0) + Number(t.purchasesTotal || 0);
    const expAndWork = Number(t.expensesTotal || 0) + Number(t.workersTotal || 0);

    return (
      `<div style="border:2px solid ${primary};border-radius:8px;padding:${isThermal ? '5px 6px' : '9px 11px'};background:#f8fafc;color:#0f172a;">` +
      `<div style="text-align:center;font-weight:900;background:${primary};color:#ffffff;padding:3px 6px;border-radius:5px;font-size:${isThermal ? '9px' : '11.5px'};margin-bottom:6px;">` +
      `${bidiHtml(customTitle || ('نطاق التقرير: ' + (r.periodLabel || 'جميع الفترات')))}` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:${isThermal ? '1fr 1fr' : 'repeat(4,1fr)'};gap:6px;text-align:center;font-weight:900;">` +
      `<div style="background:#fff1f2;border:1.5px solid #fda4af;border-radius:7px;padding:5px;">` +
      `<div style="font-size:${isThermal ? '8px' : '9.5px'};color:#9f1239;">إجمالي الأموال الخارجة (${Number(t.count || 0)})</div>` +
      `<div style="font-size:${isThermal ? '11px' : '13.5px'};color:#be123c;">${moneyHtml(t.grandTotal || 0)}</div>` +
      (showCent ? `<div style="font-size:7.8px;color:#b45309;">${esc(formatCent(t.grandTotal || 0))}</div>` : '') +
      `</div>` +
      `<div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:7px;padding:5px;">` +
      `<div style="font-size:${isThermal ? '8px' : '9.5px'};color:#1d4ed8;">مصاريف تشغيلية</div>` +
      `<div style="font-size:${isThermal ? '10.5px' : '12.5px'};color:#1e3a8a;">${moneyHtml(t.expensesTotal || 0)}</div>` +
      `</div>` +
      `<div style="background:#fef3c7;border:1.5px solid #fcd34d;border-radius:7px;padding:5px;">` +
      `<div style="font-size:${isThermal ? '8px' : '9.5px'};color:#92400e;">رواتب وسلف العمال</div>` +
      `<div style="font-size:${isThermal ? '10.5px' : '12.5px'};color:#78350f;">${moneyHtml(t.workersTotal || 0)}</div>` +
      `</div>` +
      `<div style="background:#ecfdf5;border:1.5px solid #6ee7b7;border-radius:7px;padding:5px;">` +
      `<div style="font-size:${isThermal ? '8px' : '9.5px'};color:#065f46;">موردين ومشتريات</div>` +
      `<div style="font-size:${isThermal ? '10.5px' : '12.5px'};color:#047857;">${moneyHtml(supAndPurch)}</div>` +
      `</div></div>` +
      (expAndWork > 0 && supAndPurch > 0 && !isThermal ? `<div style="margin-top:5px;text-align:center;font-size:9.3px;font-weight:800;color:#475569;">المصاريف والرواتب: ${moneyHtml(expAndWork)} | الموردين والمشتريات: ${moneyHtml(supAndPurch)} | سحوبات أخرى: ${moneyHtml(t.cashOutTotal || 0)}</div>` : '') +
      `${noteBlock}</div>`
    );
  }

  if (secId === 'outflows_by_source_box') {
    if (!showSrc) return '';
    const bfs = (activeReport && activeReport.byFundingSource) || {};
    return (
      `<div style="border:1.5px solid #bfdbfe;border-radius:7px;padding:${isThermal ? '5px 6px' : '7px 10px'};background:#f0f9ff;color:#0f172a;font-size:${isThermal ? '8.5px' : '10.5px'};font-weight:800;">` +
      `<div style="font-weight:900;color:#0369a1;border-bottom:1px dashed #7dd3fc;padding-bottom:2px;margin-bottom:4px;">🏦 ${bidiHtml(customTitle || 'التوزيع حسب مصدر المال (مصفوفة الخزائن الأربعة):')}</div>` +
      `<div style="display:grid;grid-template-columns:${isThermal ? '1fr 1fr' : 'repeat(4,1fr)'};gap:4px 8px;">` +
      `<div>💵 درج الوردية: <strong style="color:#166534;">${moneyHtml(bfs.active_shift || 0)}</strong></div>` +
      `<div>🔐 الخزينة الرئيسية: <strong style="color:#3730a3;">${moneyHtml(bfs.shop_vault || 0)}</strong></div>` +
      `<div>🏦 بنك / CCP / شيك: <strong style="color:#0369a1;">${moneyHtml(bfs.bank_ccp || 0)}</strong></div>` +
      `<div>👤 مال خارجي / المالك: <strong style="color:#92400e;">${moneyHtml(bfs.external_owner || 0)}</strong></div>` +
      `</div>${noteBlock}</div>`
    );
  }

  if (secId === 'outflows_by_category_box') {
    const cats = Array.isArray(activeReport.byCategory) ? activeReport.byCategory : [];
    if (cats.length === 0) return '';
    const rows = cats.map((c) => (
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px dotted #e2e8f0;font-size:${isThermal ? '8.4px' : '10px'};">` +
      `<span style="font-weight:800;">• ${bidiHtml(c.category)} (${Number(c.count || 0)}) — <span style="color:#be123c;">${Number(c.pct || 0)}%</span></span>` +
      `<strong style="color:#0f172a;">${moneyHtml(c.total || 0)}</strong>` +
      `</div>`
    )).join('');
    return (
      `<div style="border:1.5px solid #cbd5e1;border-radius:7px;padding:${isThermal ? '5px 6px' : '7px 10px'};background:#ffffff;color:#0f172a;">` +
      `<div style="font-weight:900;color:#0f172a;border-bottom:1px dashed #cbd5e1;padding-bottom:2px;margin-bottom:3px;font-size:${isThermal ? '9px' : '11px'};">🗂️ ${bidiHtml(customTitle || 'توزيع المصاريف والمدفوعات حسب الفئة:')}</div>` +
      `${rows}${noteBlock}</div>`
    );
  }

  if (secId === 'outflows_detail_table') {
    const list = Array.isArray(activeReport.items) ? activeReport.items : [];
    if (list.length === 0) {
      return `<div style="border:1px dashed #cbd5e1;border-radius:7px;padding:8px;text-align:center;font-weight:800;color:#64748b;">لا توجد عمليات صرف أو مدفوعات مسجلة في هذا النطاق.</div>`;
    }

    if (isThermal) {
      const lines = list.map((it, idx) => (
        `<div style="border-bottom:1px dotted #cbd5e1;padding:3px 0;font-size:8.4px;">` +
        `<div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;">` +
        `<span>${idx + 1}. ${showBen ? bidiHtml(it.beneficiary) : bidiHtml(it.category)}</span>` +
        `<span style="color:#be123c;">${moneyHtml(-Math.abs(it.amount || 0))}</span>` +
        `</div>` +
        `<div style="font-size:7.8px;color:#475569;display:flex;justify-content:space-between;gap:4px;">` +
        `<span>${bidiHtml(it.description || it.category)}</span>` +
        `<span>${esc(it.date || '')}${showSrc ? ' | ' + bidiHtml(it.fundingLabel || '') : ''}</span>` +
        `</div></div>`
      )).join('');
      return (
        `<div style="border:1.5px solid #fecdd3;border-radius:7px;padding:5px 6px;background:#ffffff;color:#0f172a;">` +
        `<div style="font-weight:900;color:#9f1239;border-bottom:1px dashed #fda4af;padding-bottom:2px;margin-bottom:3px;font-size:9px;">📋 ${bidiHtml(customTitle || 'تفصيل العمليات والسندات')} (${list.length})</div>` +
        `${lines}${noteBlock}</div>`
      );
    }

    const trs = list.map((it, idx) => (
      `<tr>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${idx + 1}</td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;"><bdi dir="ltr">${esc(it.date || '')}</bdi><br><span style="font-size:8.3px;color:#64748b;">${esc(it.docRef || '')}</span></td>` +
      `<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">${bidiHtml(it.category)}<br><span style="font-size:8.3px;color:#64748b;">${bidiHtml(it.kindLabel || '')}</span></td>` +
      (showBen ? `<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#0f172a;">${bidiHtml(it.beneficiary || '')}</td>` : '') +
      `<td style="border:1px solid #e2e8f0;padding:4px;">${bidiHtml(it.description || '')}</td>` +
      (showSrc ? `<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;color:#1d4ed8;">${bidiHtml(it.fundingLabel || '')}</td>` : '') +
      `<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#be123c;">${moneyHtml(-Math.abs(it.amount || 0))}</td>` +
      `</tr>`
    )).join('');
    return (
      `<div>` +
      `<div style="font-weight:900;font-size:11.5px;color:#9f1239;border-bottom:2px solid #fda4af;padding-bottom:3px;margin-bottom:5px;">📋 ${bidiHtml(customTitle || 'السجل التفصيلي لجميع المصاريف والمدفوعات الخارجة')} (${list.length} عملية)</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:9.8px;">` +
      `<thead><tr style="background:#ffe4e6;color:#881337;">` +
      `<th style="border:1px solid #fecdd3;padding:4px;width:4%;">#</th>` +
      `<th style="border:1px solid #fecdd3;padding:4px;width:13%;">التاريخ / السند</th>` +
      `<th style="border:1px solid #fecdd3;padding:4px;width:17%;">الفئة / النوع</th>` +
      (showBen ? `<th style="border:1px solid #fecdd3;padding:4px;width:16%;">المستفيد / المورد</th>` : '') +
      `<th style="border:1px solid #fecdd3;padding:4px;">البيان والتفاصيل</th>` +
      (showSrc ? `<th style="border:1px solid #fecdd3;padding:4px;width:14%;">مصدر المال</th>` : '') +
      `<th style="border:1px solid #fecdd3;padding:4px;width:14%;">المبلغ</th>` +
      `</tr></thead><tbody>${trs}</tbody></table>${noteBlock}</div>`
    );
  }
  return '';
}
function renderNativeExpenseSignatures(tpl, doc, isThermal, noteBlock, esc) {
  const sigMode = (tpl && tpl.expenseOptions && tpl.expenseOptions.signatureMode) || (isThermal ? 'dual' : 'triple');
  const isVoucher = tpl && (tpl.id === 'expense_voucher' || tpl.id === 'expense_voucher_a4');
  const benLbl = esc((doc && doc.expenseVoucher && doc.expenseVoucher.beneficiary) || (doc && doc.partyName) || 'القابض / المستلم');

  if (sigMode === 'dual' || isThermal) {
    return (
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:5px;text-align:center;font-size:${isThermal ? '8.4px' : '10px'};font-weight:900;color:#334155;">` +
      `<div style="border:1.5px dashed #94a3b8;border-radius:6px;padding:5px 4px ${isThermal ? '20px' : '32px'};">${isVoucher ? 'توقيع المستفيد (القابض)' : 'إعداد أمين الصندوق'}<br><span style="font-weight:700;font-size:8px;color:#64748b;">${isVoucher ? benLbl : 'المدير العام'}</span></div>` +
      `<div style="border:1.5px dashed #94a3b8;border-radius:6px;padding:5px 4px ${isThermal ? '20px' : '32px'};">مصادقة صاحب المتجر<br><span style="font-weight:700;font-size:8px;color:#64748b;">الإمضاء والختم</span></div>` +
      `</div>${noteBlock}`
    );
  }
  return (
    `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px;text-align:center;font-size:10px;font-weight:900;color:#334155;">` +
    `<div style="border:1.5px dashed #94a3b8;border-radius:7px;padding:7px 5px 34px;">${isVoucher ? 'المستفيد (القابض)' : 'أمين الصندوق'}<br><span style="font-weight:700;font-size:8.8px;color:#64748b;">${isVoucher ? benLbl : 'إعداد الكشف'}</span></div>` +
    `<div style="border:1.5px dashed #94a3b8;border-radius:7px;padding:7px 5px 34px;">المحاسب / المراقب<br><span style="font-weight:700;font-size:8.8px;color:#64748b;">مراجعة السندات والمصادر</span></div>` +
    `<div style="border:1.5px dashed #94a3b8;border-radius:7px;padding:7px 5px 34px;">صاحب المتجر / المدير<br><span style="font-weight:700;font-size:8.8px;color:#64748b;">المصادقة والاعتماد النهائي</span></div>` +
    `</div>${noteBlock}`
  );
}
/* [PSP_NATIVE_EXPENSE_HELPERS_END] */
/* [PSP_STAGE6C_SHIFT_EXT_HELPER_START] */
function renderNativeShiftExternalFundingSection(tpl, doc, theme, isThermal, customTitle, noteBlock, h) {
  const esc = h.esc;
  const bidiHtml = h.bidiHtml;
  const moneyHtml = h.moneyHtml;
  const mode = h.mode || 'preview';
  const isPreviewMode = mode === 'preview';

  const sOpts = (tpl && tpl.shiftOptions) || {};
  if (sOpts.showExternalFundingSection === false) return '';

  const dossier = (doc && (doc.forensicDossier || doc.shiftSummary)) || {};
  const hasRealArray = Array.isArray(dossier.externalFundedTx) || Array.isArray(doc && doc.externalFundedTx);

  const sampleItems = [
    { sourceType: 'shop_vault', sourceLabel: 'الخزينة الرئيسية', partyName: 'قباضة الضرائب (G12)', notes: 'تسديد قسط ضريبي من الخزينة', amount: 3000, time: '10:15' },
    { sourceType: 'bank_ccp', sourceLabel: 'بنك / CCP / شيك', partyName: 'ULTRA JOY 2026', notes: 'تسبقة مورد عبر تحويل بريدي', amount: 2000, time: '11:40' },
    { sourceType: 'external_owner', sourceLabel: 'مال خارجي: المالك', partyName: 'محمد (العامل)', notes: 'سلفة نقدية من جيب المالك', amount: 1000, time: '14:20' }
  ];
  const sampleTotals = { shop_vault: 3000, bank_ccp: 2000, external_owner: 1000, grandTotal: 6000, count: 3 };

  let items = [];
  let totals = { shop_vault: 0, bank_ccp: 0, external_owner: 0, grandTotal: 0, count: 0 };

  if (hasRealArray) {
    items = Array.isArray(dossier.externalFundedTx) ? dossier.externalFundedTx : doc.externalFundedTx;
    const rawTot = dossier.externalFundedTotals || (doc && doc.externalFundedTotals) || null;
    if (rawTot && typeof rawTot === 'object') {
      totals = Object.assign(totals, rawTot);
    } else {
      for (const it of items) {
        const st = String(it.sourceType || it.source_type || 'shop_vault');
        const amt = Number(Math.abs(Number(it.amount || 0)).toFixed(2));
        if (totals[st] !== undefined) totals[st] = Number((totals[st] + amt).toFixed(2));
        totals.grandTotal = Number((totals.grandTotal + amt).toFixed(2));
        totals.count += 1;
      }
    }
  } else if (isPreviewMode) {
    items = sampleItems;
    totals = sampleTotals;
  }

  const titleText = customTitle || 'المعاملات المموّلة من خارج درج الكاشير (الخزينة / البنك / المال الخارجي)';

  if (items.length === 0) {
    return (
      `<div style="border:1.5px dashed #93c5fd;border-radius:7px;padding:${isThermal ? '4px 6px' : '6px 10px'};background:#f0f9ff;color:#0369a1;font-size:${isThermal ? '8.2px' : '10px'};font-weight:800;text-align:center;">` +
      `🏦 ${bidiHtml(titleText)}: لا توجد مدفوعات خارج الدرج خلال هذه الوردية (${moneyHtml(0)}).${noteBlock}</div>`
    );
  }

  const headerHtml =
    `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px dashed #7dd3fc;padding-bottom:3px;margin-bottom:5px;font-weight:900;color:#0369a1;font-size:${isThermal ? '8.8px' : '11px'};">` +
    `<span>🏦 ${bidiHtml(titleText)} (${Number(totals.count || items.length)})</span>` +
    `<span style="color:#b45309;">${moneyHtml(totals.grandTotal || 0)}</span>` +
    `</div>`;

  const summaryGrid =
    `<div style="display:grid;grid-template-columns:${isThermal ? '1fr' : 'repeat(3,1fr)'};gap:${isThermal ? '2px' : '6px'};margin-bottom:5px;font-size:${isThermal ? '8.2px' : '10px'};font-weight:800;">` +
    `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:5px;padding:3px 6px;display:flex;justify-content:space-between;"><span>🔐 الخزينة الرئيسية:</span><strong style="color:#3730a3;">${moneyHtml(totals.shop_vault || 0)}</strong></div>` +
    `<div style="background:#e0f2fe;border:1px solid #bae6fd;border-radius:5px;padding:3px 6px;display:flex;justify-content:space-between;"><span>🏦 بنك / CCP / شيك:</span><strong style="color:#0369a1;">${moneyHtml(totals.bank_ccp || 0)}</strong></div>` +
    `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:5px;padding:3px 6px;display:flex;justify-content:space-between;"><span>👤 مال خارجي / المالك:</span><strong style="color:#92400e;">${moneyHtml(totals.external_owner || 0)}</strong></div>` +
    `</div>`;

  let bodyHtml = '';
  if (isThermal) {
    bodyHtml = items.map((it, idx) => (
      `<div style="border-bottom:1px dotted #bae6fd;padding:2.5px 0;font-size:8.1px;">` +
      `<div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;color:#0f172a;">` +
      `<span>${idx + 1}. ${bidiHtml(it.partyName || it.party_name || it.category || 'عملية')}</span>` +
      `<span style="color:#b45309;">${moneyHtml(it.amount || 0)}</span>` +
      `</div>` +
      `<div style="display:flex;justify-content:space-between;gap:4px;font-size:7.6px;color:#475569;">` +
      `<span>${bidiHtml(it.notes || '')}</span>` +
      `<span style="color:#0369a1;font-weight:800;">${bidiHtml(it.sourceLabel || it.sourceType || '')}</span>` +
      `</div></div>`
    )).join('');
  } else {
    const trs = items.map((it, idx) => (
      `<tr>` +
      `<td style="border:1px solid #cbd5e1;padding:3.5px;text-align:center;">${idx + 1}</td>` +
      `<td style="border:1px solid #cbd5e1;padding:3.5px;font-weight:900;color:#0369a1;">${bidiHtml(it.sourceLabel || it.sourceType || '')}</td>` +
      `<td style="border:1px solid #cbd5e1;padding:3.5px;font-weight:900;">${bidiHtml(it.partyName || it.party_name || it.category || '')}</td>` +
      `<td style="border:1px solid #cbd5e1;padding:3.5px;">${bidiHtml(it.notes || '')}</td>` +
      `<td style="border:1px solid #cbd5e1;padding:3.5px;text-align:center;"><bdi dir="ltr">${esc(it.time || '--:--')}</bdi></td>` +
      `<td style="border:1px solid #cbd5e1;padding:3.5px;text-align:left;font-weight:900;color:#b45309;">${moneyHtml(it.amount || 0)}</td>` +
      `</tr>`
    )).join('');
    bodyHtml =
      `<table style="width:100%;border-collapse:collapse;font-size:9.5px;background:#ffffff;">` +
      `<thead><tr style="background:#e0f2fe;color:#0c4a6e;">` +
      `<th style="border:1px solid #bae6fd;padding:3.5px;width:5%;">#</th>` +
      `<th style="border:1px solid #bae6fd;padding:3.5px;width:21%;">مصدر المال / الدافع</th>` +
      `<th style="border:1px solid #bae6fd;padding:3.5px;width:22%;">المستفيد / المورد</th>` +
      `<th style="border:1px solid #bae6fd;padding:3.5px;">البيان والتفاصيل</th>` +
      `<th style="border:1px solid #bae6fd;padding:3.5px;width:10%;">الوقت</th>` +
      `<th style="border:1px solid #bae6fd;padding:3.5px;width:15%;">المبلغ</th>` +
      `</tr></thead><tbody>${trs}</tbody></table>`;
  }

  const accountingGuardBanner =
    `<div style="margin-top:4px;padding:3px 6px;border-radius:5px;background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46;font-size:${isThermal ? '7.6px' : '9px'};font-weight:900;text-align:center;">` +
    `✅ ملاحظة محاسبية: هذه المبالغ خارج درج الكاشير ولم تُخصم من الرصيد الدفتري المتوقع للصندوق.` +
    `</div>`;

  return (
    `<div data-s6c-ext-funding-box="1" style="border:1.5px solid #38bdf8;border-radius:8px;padding:${isThermal ? '5px 6px' : '8px 10px'};background:#f0f9ff;color:#0f172a;">` +
    `${headerHtml}${summaryGrid}${bodyHtml}${accountingGuardBanner}${noteBlock}</div>`
  );
}
/* [PSP_STAGE6C_SHIFT_EXT_HELPER_END] */
    function renderSectionContent(sec, tpl, doc, shop, theme, isThermal, mode, t) {
      const id = sec.id;
      const isPrintOrPdf = mode === 'print' || mode === 'pdf';
      const isWalkin = Boolean(doc.isWalkinCustomer);
      const customTitle = interpolateVars(sec.title || '', doc, shop).trim();
      const customNote = interpolateVars(sec.note || '', doc, shop).trim();
      const noteBlock = customNote
        ? `<div style="margin-top:4px;padding-top:3px;border-top:1px dashed ${theme.border};font-size:${isThermal ? '9.2px' : '10.5px'};font-weight:800;color:${theme.secondary};">${bidiHtml(customNote)}</div>`
        : '';

      const pts = isWalkin ? 0 : Math.max(0, Math.floor(Number(doc.loyaltyTotalBalance || 0)));
      const earnedPts = isWalkin ? 0 : Math.max(0, Math.floor(Number(doc.loyaltyPointsEarned || 0)));
      const usedPts = isWalkin ? 0 : Math.max(0, Math.floor(Number(doc.loyaltyPointsUsed || 0)));
      const prevDebt = isWalkin ? 0 : Math.max(0, Number(doc.previousBalance || 0));
      const remToday = Math.max(0, Number(doc.remainingDebt || 0));
      const isSettlement = tpl.id === 'payment_receipt' || tpl.id === 'supplier_payment_receipt';
      const cumDebt = isWalkin
        ? remToday
        : isSettlement
        ? Math.max(0, Number(doc.customerCurrentTotalDebt ?? 0))
        : Math.max(Number((prevDebt + remToday).toFixed(2)), Math.max(0, Number(doc.customerCurrentTotalDebt || 0)));
      const totalItemsQty = (doc.items || []).reduce((s, it) => s + Number(it.qty ?? it.quantity ?? 1), 0);

      
      /* [PSP_NATIVE_EXPENSE_PRE_SWITCH_START] */
      const _pspExpSecId = sec && sec.id ? String(sec.id) : "";
      if (
        _pspExpSecId === "expense_voucher_card" ||
        _pspExpSecId === "outflows_report_kpis" ||
        _pspExpSecId === "outflows_by_source_box" ||
        _pspExpSecId === "outflows_by_category_box" ||
        _pspExpSecId === "outflows_detail_table"
      ) {
        return renderNativeExpenseOrOutflowsSection(_pspExpSecId, tpl, doc, theme, isThermal, customTitle, noteBlock, { esc, bidiHtml, moneyHtml, amountToWords, formatCent: formatAlgerianCentimesV2, mode });
      }
      if (_pspExpSecId === "dual_signatures" && (tpl.id === "expense_voucher" || tpl.id === "expense_voucher_a4" || tpl.id === "expenses_period_report_a4" || tpl.id === "expenses_period_report_80mm")) {
        return renderNativeExpenseSignatures(tpl, doc, isThermal, noteBlock, esc);
      }
/* [PSP_NATIVE_EXPENSE_PRE_SWITCH_END] */
      
      /* [PSP_STAGE6C_SHIFT_EXT_DISPATCH_START] */
      if (_pspExpSecId === "shift_external_funding_box") {
        return renderNativeShiftExternalFundingSection(tpl, doc, theme, isThermal, customTitle, noteBlock, { esc, bidiHtml, moneyHtml, formatCent: formatAlgerianCentimesV2, mode });
      }
/* [PSP_STAGE6C_SHIFT_EXT_DISPATCH_END] */
      
      /* [PSP_NATIVE_ZREPORT_PRE_SWITCH_START] */
      const _pspNativeZSecId = sec && sec.id ? String(sec.id) : "";
      if (
        _pspNativeZSecId === "shift_cash_debt_balance" ||
        _pspNativeZSecId === "shift_flows_summary" ||
        _pspNativeZSecId === "shift_owner_alerts" ||
        _pspNativeZSecId === "shift_outflows_detail" ||
        _pspNativeZSecId === "shift_credit_sales_today" ||
        _pspNativeZSecId === "shift_debt_collections" ||
        _pspNativeZSecId === "shift_payment_kpis" ||
        _pspNativeZSecId === "shift_top_debtors"
      ) {
        return renderNativeZReportSection(_pspNativeZSecId, tpl, doc, theme, isThermal, customTitle, noteBlock, { esc, bidiHtml, moneyHtml });
      }
      if (_pspNativeZSecId === "dual_signatures" && (tpl.id === "caisse_z_report" || tpl.id === "caisse_shift_full_audit_a4")) {
        return renderNativeZReportSignatures(tpl, doc, isThermal, noteBlock, esc);
      }
/* [PSP_NATIVE_ZREPORT_PRE_SWITCH_END] */
      switch (id) {
        case 'shop_header': {
          const fiscalParts = [
            shop.rc ? `RC: ${shop.rc}` : '',
            shop.nif ? `NIF: ${shop.nif}` : '',
            shop.ai ? `AI: ${shop.ai}` : '',
            shop.nis ? `NIS: ${shop.nis}` : ''
          ].filter(Boolean);
          const logoH = Number(tpl.logoSizePx || (isThermal ? 36 : 52));
          const logoJustify = tpl.logoAlign === 'right' ? 'flex-start' : tpl.logoAlign === 'left' ? 'flex-end' : 'center';
          return `
            <div style="text-align:${sec.align || 'center'};border-bottom:2px solid ${theme.primary};padding-bottom:6px;">
              ${shop.logo ? `<div style="display:flex;justify-content:${logoJustify};margin-bottom:4px;"><img src="${esc(shop.logo)}" style="max-height:${logoH}px;object-fit:contain;"></div>` : ''}
              <div style="font-size:${isThermal ? '15px' : '20px'};font-weight:900;color:${theme.primary};line-height:1.25;">${bidiHtml(customTitle || shop.name)}</div>
              ${shop.description ? `<div style="font-size:${isThermal ? '10px' : '11.5px'};font-weight:800;color:#334155;margin-top:2px;">${bidiHtml(shop.description)}</div>` : ''}
              <div style="font-size:${isThermal ? '9.6px' : '11px'};color:#475569;font-weight:700;margin-top:2px;">
                ${bidiHtml(shop.address)}${shop.phone ? ` | <bdi dir="ltr" style="font-family:monospace;">${esc(shop.phone)}</bdi>` : ''}
              </div>
              ${tpl.showFiscalIds && fiscalParts.length > 0 ? `<div style="font-family:monospace;font-size:${isThermal ? '8.5px' : '10px'};color:#475569;margin-top:3px;"><bdi dir="ltr">${esc(fiscalParts.join(' | '))}</bdi></div>` : ''}
              ${noteBlock}
            </div>`;
        }

        case 'doc_banner': {
          const docMeta = PSP.state.getDocMeta(tpl.id);
          const title = customTitle || tpl.customTitle || docMeta.cleanTitle || docMeta.name;
          return `
            <div style="border:1.5px solid ${theme.border};background:${theme.accentBg};border-radius:7px;padding:${isThermal ? '5px 7px' : '8px 12px'};text-align:center;">
              <div style="font-size:${isThermal ? '12px' : '15.5px'};font-weight:900;color:${theme.primary};">${bidiHtml(title)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-family:monospace;font-size:${isThermal ? '9.8px' : '11.5px'};font-weight:900;color:#1e293b;margin-top:3px;">
                <span>${esc(t.docNum)} <bdi dir="ltr">${esc(doc.docNumber)}</bdi></span>
                <bdi dir="ltr">${esc(doc.date)}</bdi>
              </div>
              ${noteBlock}
            </div>`;
        }

        case 'party_box': {
          const partyDisplay = isWalkin ? t.walkinName : (doc.partyName || t.walkinName);
          return `
            <div style="border-bottom:1.5px dashed #94a3b8;padding:4px 2px;font-size:${isThermal ? '10.6px' : '12px'};">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                <div style="font-weight:900;color:#0f172a;">
                  <span>${esc(cleanPrintText(customTitle || doc.partyTitle || t.partyDefault))}</span>
                  <strong style="color:${isWalkin ? '#334155' : theme.primary};"> ${bidiHtml(partyDisplay)}</strong>
                </div>
                ${!isWalkin && doc.partyPhone ? `<div style="font-family:monospace;font-weight:800;font-size:${isThermal ? '9.8px' : '11px'};"><bdi dir="ltr">${esc(doc.partyPhone)}</bdi></div>` : ''}
              </div>
              ${!isThermal && !isWalkin && (doc.partyAddress || doc.partyRc || doc.partyNif) ? `
                <div style="font-size:10.5px;color:#475569;font-weight:700;margin-top:2px;">
                  ${doc.partyAddress ? bidiHtml(doc.partyAddress) : ''}
                  ${doc.partyRc ? ` | <bdi dir="ltr">RC: ${esc(doc.partyRc)}</bdi>` : ''}
                  ${doc.partyNif ? ` | <bdi dir="ltr">NIF: ${esc(doc.partyNif)}</bdi>` : ''}
                </div>` : ''}
              ${noteBlock}
            </div>`;
        }

        case 'items_table':
          return `<div>${renderItemsTableHtml(tpl, doc, theme, isThermal)}${noteBlock}</div>`;

        case 'totals_waterfall': {
          const wordsStr = amountToWords(doc.total, tpl.lang || 'ar');
          return `
            <div style="border-top:2px solid #0f172a;padding-top:6px;font-size:${isThermal ? '10.6px' : '12px'};">
              ${doc.discount > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:800;color:#475569;margin-bottom:2px;"><span>${esc(t.subtotal)} ${moneyHtml(doc.subtotal)}</span><span style="color:#be123c;">${esc(t.discount)} ${moneyHtml(doc.discount, '-')}</span></div>` : ''}
              ${doc.tvaAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:800;color:#475569;"><span>${esc(t.tva)}</span><span>${moneyHtml(doc.tvaAmount, '+')}</span></div>` : ''}
              ${doc.stampAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:800;color:#475569;"><span>${esc(t.stamp)}</span><span>${moneyHtml(doc.stampAmount, '+')}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:900;font-size:${isThermal ? '14px' : '17px'};color:#0f172a;margin:2px 0;">
                <span>${bidiHtml(customTitle || t.netTotal)}</span>
                <span style="color:${theme.primary};">${moneyHtml(doc.total)}</span>
              </div>
              ${tpl.showCentimes ? `<div style="font-size:${isThermal ? '9.8px' : '11px'};font-weight:900;color:#334155;margin-bottom:4px;">${esc(t.centimes)} ${esc(fmtCentimes(doc.total))}</div>` : ''}
              <div style="display:flex;justify-content:space-between;border-top:1px dashed #94a3b8;padding-top:4px;font-weight:900;font-size:${isThermal ? '10.6px' : '12px'};">
                <span style="color:#047857;">${esc(t.paid)} ${moneyHtml(doc.paidAmount)}</span>
                <span style="color:${remToday > 0.05 ? '#be123c' : '#0f172a'};">${esc(t.remaining)} ${moneyHtml(remToday)}</span>
              </div>
              ${tpl.showAmountInWords ? `<div style="margin-top:5px;padding:5px 8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;font-size:${isThermal ? '9.5px' : '11px'};font-weight:800;">${esc(t.wordsPrefix)} <strong>${esc(wordsStr)}</strong></div>` : ''}
              ${noteBlock}
            </div>`;
        }

        case 'payment_change':
          return `
            <div style="border:1px dashed #94a3b8;border-radius:7px;padding:5px 8px;background:#f8fafc;font-size:${isThermal ? '9.8px' : '11px'};font-weight:800;color:#1e293b;">
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
                <span>${esc(t.received)} <strong>${moneyHtml(doc.receivedAmount)}</strong></span>
                <span>${esc(t.change)} <strong style="color:#047857;">${moneyHtml(doc.changeAmount)}</strong></span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:${isThermal ? '9.2px' : '10.5px'};color:#475569;">
                <span>${esc(t.cashier)} ${bidiHtml(doc.cashierName)}</span>
                <span>${esc(t.method)} ${bidiHtml(doc.paymentMethod === 'cash' ? 'نقداً (Espèces)' : (doc.paymentMethod || 'نقداً'))}</span>
              </div>
              ${noteBlock}
            </div>`;

        case 'f8_vip_card': {
          if (isWalkin) {
            if (isPrintOrPdf) return '';
            return `
              <div style="border:1.5px dashed #94a3b8;border-radius:8px;padding:5px 8px;background:#f8fafc;color:#475569;font-size:9.3px;text-align:center;font-weight:800;">
                زبون عابر (Comptoir): النقاط = 0 | الديون = 0.00 د.ج — تُخفى هذه البطاقة تلقائياً عند الطباعة والـ PDF
              </div>`;
          }
          return `
            <div style="border:1.5px solid #d97706;border-radius:8px;padding:6px 8px;background:#fffbeb;color:#0f172a;font-size:${isThermal ? '9.5px' : '11px'};">
              <div style="font-weight:900;text-align:center;color:#92400e;margin-bottom:4px;border-bottom:1px dashed #fcd34d;padding-bottom:2px;">
                ${bidiHtml(customTitle || t.vipCardTitle)}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;text-align:center;font-weight:900;">
                <div style="background:#ffffff;border:1px solid #fcd34d;border-radius:6px;padding:4px 3px;">
                  <div style="font-size:8.6px;color:#92400e;">${esc(t.vipPoints)}</div>
                  <div style="color:#78350f;"><bdi dir="ltr" style="font-family:Tahoma,monospace;">${pts}</bdi> ${esc(t.ptsUnit)} &mdash; ${moneyHtml(pts * 2)}</div>
                </div>
                <div style="background:#ffffff;border:1px solid #fda4af;border-radius:6px;padding:4px 3px;">
                  <div style="font-size:8.6px;color:#be123c;">${esc(t.vipDebt)}</div>
                  <div style="color:${cumDebt > 0.05 ? '#be123c' : '#047857'};">${moneyHtml(cumDebt)}</div>
                </div>
              </div>
              ${noteBlock}
            </div>`;
        }

        case 'loyalty_points': {
          if (isWalkin) {
            if (isPrintOrPdf) return '';
            return `<div style="border:1px dashed #cbd5e1;border-radius:7px;padding:4px 8px;font-size:9.3px;text-align:center;color:#64748b;font-weight:800;">بطاقة نقاط الوفاء (مخفية تلقائياً للزبون العابر)</div>`;
          }
          return `
            <div style="border:1.5px solid #d97706;border-radius:8px;padding:6px 8px;background:#fffbeb;color:#78350f;font-size:${isThermal ? '9.6px' : '11px'};font-weight:800;">
              <div style="font-weight:900;text-align:center;border-bottom:1px dashed #fcd34d;padding-bottom:2px;margin-bottom:4px;">${bidiHtml(customTitle || 'مكافآت ونقاط الوفاء')}</div>
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
                <span>المكتسبة: <bdi dir="ltr">+${earnedPts}</bdi></span>
                ${usedPts > 0 ? `<span style="color:#be123c;">المخصومة: <bdi dir="ltr">-${usedPts}</bdi></span>` : ''}
                <span>الرصيد: <bdi dir="ltr">${pts}</bdi> نقطة (${moneyHtml(pts * 2)})</span>
              </div>
              ${noteBlock}
            </div>`;
        }

        case 'alt_d_credit_box': {
          if (isWalkin && remToday <= 0.009 && isPrintOrPdf) return '';
          return `
            <div style="border:2px solid #be123c;border-radius:8px;padding:7px 8px;background:#fff1f2;color:#881337;font-size:${isThermal ? '9.6px' : '11px'};">
              <div style="font-weight:900;text-align:center;border-bottom:1.5px dashed #fda4af;padding-bottom:3px;margin-bottom:5px;color:#be123c;">
                ${bidiHtml(customTitle || 'تأكيد عملية البيع بالدين')}
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;font-weight:800;line-height:1.45;">
                <div style="display:flex;justify-content:space-between;"><span>${esc(t.prevDebt)}:</span><strong>${moneyHtml(prevDebt)}</strong></div>
                <div style="display:flex;justify-content:space-between;"><span>فاتورة اليوم:</span><strong>${moneyHtml(doc.total)}</strong></div>
                <div style="display:flex;justify-content:space-between;color:#047857;"><span>المدفوع اليوم:</span><strong>${moneyHtml(doc.paidAmount)}</strong></div>
                <div style="display:flex;justify-content:space-between;color:#be123c;"><span>${esc(t.todayDebt)}:</span><strong>${moneyHtml(remToday, '+')}</strong></div>
              </div>
              <div style="margin-top:5px;padding:5px 7px;border-radius:6px;background:#be123c;color:#ffffff;font-weight:900;display:flex;justify-content:space-between;align-items:center;">
                <span>${esc(t.newDebt)}:</span>
                <span>${moneyHtml(cumDebt)}</span>
              </div>
              ${tpl.showCentimes ? `<div style="margin-top:3px;font-size:9.3px;font-weight:900;text-align:left;color:#9f1239;">بالسنتيم: ${esc(fmtCentimes(cumDebt))}</div>` : ''}
              <div style="margin-top:8px;padding-top:4px;border-top:1px dashed #fda4af;text-align:center;font-weight:800;font-size:9.2px;color:#475569;">إمضاء الزبون بالاستلام والالتزام: ..........................</div>
              ${noteBlock}
            </div>`;
        }

        case 'alt_v_settlement_box': {
          const debtBefore = Math.max(0, Number(doc.previousBalance || 0));
          const paidNow = Math.max(0, Number(doc.paidAmount > 0 ? doc.paidAmount : doc.total));
          const debtAfter = Math.max(0, Number(doc.customerCurrentTotalDebt ?? Math.max(0, debtBefore - paidNow)));
          return `
            <div style="border:2px solid #047857;border-radius:8px;padding:7px 9px;background:#ecfdf5;color:#064e3b;font-size:${isThermal ? '10px' : '11.5px'};font-weight:800;">
              <div style="font-weight:900;text-align:center;border-bottom:1.5px dashed #6ee7b7;padding-bottom:4px;margin-bottom:6px;color:#047857;">
                ${bidiHtml(customTitle || 'تفاصيل وصل قبض وتسديد الدين')}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <div style="display:flex;justify-content:space-between;"><span>1. الدين قبل التسديد:</span><strong style="color:#be123c;">${moneyHtml(debtBefore)}</strong></div>
                <div style="display:flex;justify-content:space-between;color:#047857;"><span>2. المبلغ المقبوض اليوم:</span><strong>${moneyHtml(paidNow, '-')}</strong></div>
                <div style="display:flex;justify-content:space-between;border-top:1.5px solid #6ee7b7;margin-top:3px;padding-top:5px;font-weight:900;font-size:${isThermal ? '11.2px' : '13px'};">
                  <span>3. صافي الدين المتبقي:</span>
                  <strong style="color:${debtAfter > 0.05 ? '#be123c' : '#047857'};">${moneyHtml(debtAfter)}</strong>
                </div>
              </div>
              ${tpl.showCentimes ? `
                <div style="margin-top:5px;padding-top:4px;border-top:1px dashed #a7f3d0;font-size:9.3px;color:#065f46;line-height:1.45;">
                  <div>المقبوض بالسنتيم: <strong>${esc(fmtCentimes(paidNow))}</strong></div>
                  <div>المتبقي بالسنتيم: <strong>${esc(fmtCentimes(debtAfter))}</strong></div>
                </div>` : ''}
              <div style="display:flex;justify-content:space-between;margin-top:5px;padding-top:4px;border-top:1px dashed #a7f3d0;font-size:9.2px;color:#334155;">
                <span>${esc(t.cashier)} ${bidiHtml(doc.cashierName)}</span>
                <span>${esc(t.method)} ${bidiHtml(doc.paymentMethod === 'cash' ? 'نقداً (Espèces)' : (doc.paymentMethod || 'نقداً'))}</span>
              </div>
              <div style="margin-top:8px;text-align:center;font-size:9.2px;color:#475569;">توقيع المستلم / الختم: ..............................</div>
              ${noteBlock}
            </div>`;
        }

        case 'carnet_credit_box':
        case 'debt_ledger_box': {
          if (isWalkin && cumDebt <= 0.009 && isPrintOrPdf) return '';
          return `
            <div style="border:1.5px solid #be123c;border-radius:8px;padding:6px 8px;background:#fff1f2;color:#881337;font-size:${isThermal ? '9.6px' : '11px'};">
              <div style="font-weight:900;text-align:center;border-bottom:1px dashed #fda4af;padding-bottom:3px;margin-bottom:4px;color:#be123c;">
                ${bidiHtml(customTitle || 'وضعية الحساب والديون التراكمية')}
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;text-align:center;font-weight:800;">
                <div style="background:#ffffff;padding:4px;border-radius:5px;border:1px solid #fecdd3;">
                  <div style="font-size:8.4px;color:#64748b;">${esc(t.prevDebt)}</div>
                  <div>${moneyHtml(prevDebt)}</div>
                </div>
                <div style="background:#ffffff;padding:4px;border-radius:5px;border:1px solid #fecdd3;">
                  <div style="font-size:8.4px;color:#64748b;">${esc(t.todayDebt)}</div>
                  <div style="color:#be123c;">${moneyHtml(remToday, '+')}</div>
                </div>
                <div style="background:#be123c;color:#ffffff;padding:4px;border-radius:5px;">
                  <div style="font-size:8.4px;opacity:0.9;">${esc(t.newDebt)}</div>
                  <div style="font-weight:900;">${moneyHtml(cumDebt)}</div>
                </div>
              </div>
              ${tpl.showCentimes ? `<div style="margin-top:3px;font-size:9.2px;text-align:center;font-weight:800;color:#9f1239;">بالسنتيم: ${esc(fmtCentimes(cumDebt))}</div>` : ''}
              ${noteBlock}
            </div>`;
        }

        case 'alt_h_items_history_note':
          return `
            <div style="border:1.5px solid #4f46e5;border-radius:8px;padding:6px 9px;background:#eef2ff;color:#1e1b4b;font-size:${isThermal ? '9.5px' : '11px'};">
              <div style="font-weight:900;color:#4338ca;">${bidiHtml(customTitle || 'تفصيل السلع المأخوذة في فواتير الدين')}</div>
              <div style="font-weight:700;margin-top:2px;">توثيق تفصيلي للسلع والكميات المسحوبة على الحساب ودفعات التسديد المستلمة.</div>
              ${noteBlock}
            </div>`;

        case 'installments_box': {
          const months = Number(doc.installmentMonths || 3);
          const monthly = months > 0 ? Number((remToday / months).toFixed(2)) : remToday;
          return `
            <div style="border:1.5px solid #d97706;border-radius:8px;padding:7px 9px;background:#fffbeb;color:#78350f;font-size:${isThermal ? '9.8px' : '11px'};font-weight:800;">
              <div style="font-weight:900;color:#b45309;margin-bottom:4px;">${bidiHtml(customTitle || 'جدولة البيع بالتقسيط (Vente par Facilité)')}</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;text-align:center;">
                <div style="background:#fff;padding:4px;border-radius:5px;border:1px solid #fde68a;">التسبيق: <strong>${moneyHtml(doc.paidAmount)}</strong></div>
                <div style="background:#fff;padding:4px;border-radius:5px;border:1px solid #fde68a;">المدة: <strong>${months} أشهر</strong></div>
                <div style="background:#fff;padding:4px;border-radius:5px;border:1px solid #fde68a;">القسط الشهري: <strong style="color:#b45309;">${moneyHtml(monthly)}</strong></div>
              </div>
              ${noteBlock}
            </div>`;
        }

        /* === [PSP NATIVE Z-REPORT 6 SECTIONS CASES] === */
        case 'shift_owner_radar_alerts': {
          const fd = doc.forensicDossier || {
            ownerAlerts: [
              { level: 'info', text: 'تم منح ديون جديدة بقيمة 1,570.00 د.ج لـ (2) زبائن في هذه الوردية.' }
            ]
          };
          const alerts = Array.isArray(fd.ownerAlerts) ? fd.ownerAlerts : [];
          if (alerts.length === 0 && mode !== 'preview') return '';
          const rows = alerts.length > 0
            ? alerts.map((al) => {
                const col = al.level === 'danger' ? '#be123c' : al.level === 'warning' ? '#b45309' : '#1d4ed8';
                return `<div style="color:${col};font-weight:800;font-size:${isThermal ? '8.6px' : '10.2px'};margin-top:2px;">• ${bidiHtml(al.text)}</div>`;
              }).join('')
            : `<div style="color:#047857;font-weight:800;font-size:${isThermal ? '8.6px' : '10px'};">✔ الوردية سليمة 100% — لا توجد فوارق أو تنبيهات رقابية.</div>`;
          return `
            <div style="border:1.5px solid ${alerts.length > 0 ? '#e11d48' : '#10b981'};background:${alerts.length > 0 ? '#fff1f2' : '#ecfdf5'};border-radius:7px;padding:${isThermal ? '4px 6px' : '7px 10px'};color:#0f172a;">
              <div style="font-weight:900;color:${alerts.length > 0 ? '#9f1239' : '#065f46'};font-size:${isThermal ? '9.3px' : '11px'};margin-bottom:2px;">
                ${bidiHtml(customTitle || '🛡️ تنبيهات رادار الرقابة لصاحب المتجر')}
              </div>
              ${rows}
              ${noteBlock}
            </div>`;
        }

        case 'shift_outflows_detail': {
          const fd = doc.forensicDossier || {
            outflows: [
              { time: '11:20', typeLabel: 'سلفة عامل #2', beneficiary: 'محمد (العامل)', reason: 'سلفة نقدية من الصندوق', amount: 1000 },
              { time: '15:40', typeLabel: 'نقل وشحن', beneficiary: 'موزع البضاعة', reason: 'تفريغ ونقل سلع التموين', amount: 500 }
            ],
            kpis: { totalOutflows: 1500 }
          };
          const list = Array.isArray(fd.outflows) ? fd.outflows : [];
          const totOut = Number((fd.kpis && fd.kpis.totalOutflows) ?? list.reduce((a, x) => a + Number(x.amount || 0), 0));
          if (isThermal) {
            const rowsHtml = list.length === 0
              ? '<div style="color:#047857;font-weight:700;font-size:8.5px;text-align:center;">✔ لا توجد مصاريف أو سحوبات في هذه الوردية</div>'
              : list.map((o, idx) => `
                  <div style="border-bottom:1px dotted #e2e8f0;padding:2.5px 0;">
                    <div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;font-size:9px;">
                      <span>${idx + 1}. ${bidiHtml(o.beneficiary)} <span style="font-weight:700;color:#64748b;font-size:8px;">(${esc(o.time || '--:--')})</span></span>
                      <span style="color:#be123c;">${moneyHtml(-Math.abs(Number(o.amount || 0)))}</span>
                    </div>
                    <div style="font-size:8.2px;color:#475569;padding-right:8px;">السبب: ${bidiHtml(o.typeLabel)}${o.reason && o.reason !== o.typeLabel ? ' — ' + bidiHtml(o.reason) : ''}</div>
                  </div>`).join('');
            return `
              <div style="border:1.5px solid #fecdd3;border-radius:7px;padding:4px 6px;background:#ffffff;color:#0f172a;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fda4af;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#9f1239;font-size:9.3px;">
                  <span>${bidiHtml(customTitle || ('💸 الأموال الخارجة (مصاريف / سلَف) (' + list.length + ')'))}</span>
                  <span>${moneyHtml(-Math.abs(totOut))}</span>
                </div>
                ${rowsHtml}
                ${noteBlock}
              </div>`;
          }
          const tableRows = list.length === 0
            ? '<tr><td colspan="6" style="border:1px solid #e2e8f0;padding:6px;text-align:center;color:#047857;font-weight:800;">✔ لم تخرج أي مصاريف أو سحوبات نقدية من الدرج خلال هذه الوردية</td></tr>'
            : list.map((o, idx) => `
                <tr>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${idx + 1}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${esc(o.time || '--:--')}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">${bidiHtml(o.typeLabel)}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#9f1239;">${bidiHtml(o.beneficiary)}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;">${bidiHtml(o.reason)}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#be123c;">${moneyHtml(-Math.abs(Number(o.amount || 0)))}</td>
                </tr>`).join('');
          return `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11.2px;color:#9f1239;border-bottom:2px solid #fda4af;padding-bottom:3px;margin-bottom:5px;">
                <span>${bidiHtml(customTitle || '💸 سجل الأموال الخارجة من الدرج (المصاريف، السلَف، السحوبات، وتسديد الموردين)')}</span>
                <span>${moneyHtml(-Math.abs(totOut))}</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead><tr style="background:#ffe4e6;color:#881337;">
                  <th style="border:1px solid #fecdd3;padding:4px;width:5%;">#</th>
                  <th style="border:1px solid #fecdd3;padding:4px;width:10%;">الساعة</th>
                  <th style="border:1px solid #fecdd3;padding:4px;width:18%;">النوع</th>
                  <th style="border:1px solid #fecdd3;padding:4px;width:22%;">المستفيد / الآخذ</th>
                  <th style="border:1px solid #fecdd3;padding:4px;width:30%;">السبب والبيان التفصيلي</th>
                  <th style="border:1px solid #fecdd3;padding:4px;width:15%;">المبلغ</th>
                </tr></thead>
                <tbody>${tableRows}</tbody>
              </table>
              ${noteBlock}
            </div>`;
        }

        case 'shift_credit_sales_detail': {
          const fd = doc.forensicDossier || {
            creditSalesToday: [
              { docNumber: 'FAC-0124', time: '16:30', customerName: 'كريم بن عيسى', customerPhone: '0661445566', invoiceTotal: 1450, paidToday: 500, creditAdded: 950, cumulativeDebtNow: 2150 },
              { docNumber: 'FAC-0127', time: '18:10', customerName: 'سليم مرابط', customerPhone: '0770889900', invoiceTotal: 620, paidToday: 0, creditAdded: 620, cumulativeDebtNow: 620 }
            ],
            kpis: { totalCreditAddedToday: 1570 }
          };
          const list = Array.isArray(fd.creditSalesToday) ? fd.creditSalesToday : [];
          const totCred = Number((fd.kpis && fd.kpis.totalCreditAddedToday) ?? list.reduce((a, x) => a + Number(x.creditAdded || 0), 0));
          if (isThermal) {
            const rowsHtml = list.length === 0
              ? '<div style="color:#047857;font-weight:700;font-size:8.5px;text-align:center;">✔ لم تُسجل مبيعات بالدين في هذه الوردية</div>'
              : list.map((cs, idx) => `
                  <div style="border-bottom:1px dotted #e2e8f0;padding:2.5px 0;">
                    <div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;font-size:9px;">
                      <span>${idx + 1}. ${bidiHtml(cs.customerName)}</span>
                      <span style="color:#c2410c;">${moneyHtml(cs.creditAdded, '+')}</span>
                    </div>
                    <div style="font-size:8px;color:#475569;display:flex;justify-content:space-between;">
                      <span>${esc(cs.docNumber || '')} (${esc(cs.time || '')}) | مدفوع: ${moneyHtml(cs.paidToday || 0)}</span>
                      <span>دينه الكلي: ${moneyHtml(cs.cumulativeDebtNow || cs.creditAdded)}</span>
                    </div>
                  </div>`).join('');
            return `
              <div style="border:1.5px solid #fed7aa;border-radius:7px;padding:4px 6px;background:#ffffff;color:#0f172a;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fdba74;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#9a3412;font-size:9.3px;">
                  <span>${bidiHtml(customTitle || ('📝 ديون اليوم (الزبائن المدينون) (' + list.length + ')'))}</span>
                  <span>${moneyHtml(totCred, '+')}</span>
                </div>
                ${rowsHtml}
                ${noteBlock}
              </div>`;
          }
          const tableRows = list.length === 0
            ? '<tr><td colspan="7" style="border:1px solid #e2e8f0;padding:6px;text-align:center;color:#047857;font-weight:800;">✔ جميع مبيعات هذه الوردية كانت مدفوعة بالكامل بدون ديون جديدة</td></tr>'
            : list.map((cs, idx) => `
                <tr>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${idx + 1}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${esc(cs.docNumber || '')}<br><span style="font-size:8.5px;color:#64748b;">${esc(cs.time || '')}</span></td>
                  <td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;">${bidiHtml(cs.customerName)}${cs.customerPhone ? '<br><span style="font-size:8.5px;color:#475569;">' + esc(cs.customerPhone) + '</span>' : ''}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:left;">${moneyHtml(cs.invoiceTotal || 0)}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">${moneyHtml(cs.paidToday || 0)}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#c2410c;">${moneyHtml(cs.creditAdded || 0, '+')}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#991b1b;">${moneyHtml(cs.cumulativeDebtNow || cs.creditAdded || 0)}</td>
                </tr>`).join('');
          return `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11.2px;color:#9a3412;border-bottom:2px solid #fdba74;padding-bottom:3px;margin-bottom:5px;">
                <span>${bidiHtml(customTitle || '📝 قائمة الزبائن المدينين اليوم (المبيعات الآجلة والدفع الجزئي)')}</span>
                <span>${moneyHtml(totCred, '+')}</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead><tr style="background:#ffedd5;color:#7c2d12;">
                  <th style="border:1px solid #fed7aa;padding:4px;width:5%;">#</th>
                  <th style="border:1px solid #fed7aa;padding:4px;width:15%;">الفاتورة / الوقت</th>
                  <th style="border:1px solid #fed7aa;padding:4px;width:28%;">اسم الزبون والهاتف</th>
                  <th style="border:1px solid #fed7aa;padding:4px;width:13%;">الإجمالي</th>
                  <th style="border:1px solid #fed7aa;padding:4px;width:13%;">المدفوع</th>
                  <th style="border:1px solid #fed7aa;padding:4px;width:13%;">دين اليوم (+)</th>
                  <th style="border:1px solid #fed7aa;padding:4px;width:13%;">دينه الكلي الآن</th>
                </tr></thead>
                <tbody>${tableRows}</tbody>
              </table>
              ${noteBlock}
            </div>`;
        }

        case 'shift_debt_collections_detail': {
          const fd = doc.forensicDossier || {
            debtCollections: [
              { time: '14:15', customerName: 'أمين بن يحيى', note: 'دفعة من الدين السابق', amount: 1200, remainingDebtNow: 550 }
            ],
            debtCollectionsGrouped: [
              { customerName: 'أمين بن يحيى', count: 1, total: 1200, remainingDebtNow: 550 }
            ],
            kpis: { totalDebtCollected: 1200 }
          };
          const grouped = Array.isArray(fd.debtCollectionsGrouped) ? fd.debtCollectionsGrouped : [];
          const rawCols = Array.isArray(fd.debtCollections) ? fd.debtCollections : [];
          const totCol = Number((fd.kpis && fd.kpis.totalDebtCollected) ?? rawCols.reduce((a, x) => a + Number(x.amount || 0), 0));
          if (isThermal) {
            const rowsHtml = grouped.length === 0
              ? '<div style="color:#64748b;font-weight:700;font-size:8.5px;text-align:center;">لا توجد تحصيلات ديون في هذه الوردية</div>'
              : grouped.map((c) => `
                  <div style="display:flex;justify-content:space-between;font-size:8.8px;padding:1.5px 0;border-bottom:1px dotted #a7f3d0;">
                    <span style="font-weight:800;">${bidiHtml(c.customerName)}${c.count > 1 ? ' (' + c.count + ' دفعات)' : ''}</span>
                    <span style="color:#047857;font-weight:900;">${moneyHtml(c.total, '+')}</span>
                  </div>`).join('');
            return `
              <div style="border:1.5px solid #a7f3d0;border-radius:7px;padding:4px 6px;background:#ecfdf5;color:#0f172a;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #34d399;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#065f46;font-size:9.3px;">
                  <span>${bidiHtml(customTitle || ('🤝 تحصيلات الديون بالوردية (' + grouped.length + ')'))}</span>
                  <span>${moneyHtml(totCol, '+')}</span>
                </div>
                ${rowsHtml}
                ${noteBlock}
              </div>`;
          }
          const tableRows = rawCols.length === 0
            ? '<tr><td colspan="5" style="border:1px solid #e2e8f0;padding:6px;text-align:center;color:#64748b;font-weight:800;">لا توجد تحصيلات ديون مسجلة خلال هذه الوردية</td></tr>'
            : rawCols.map((dc, idx) => `
                <tr>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${idx + 1}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">${esc(dc.time || '--:--')}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#065f46;">${bidiHtml(dc.customerName)}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;">${bidiHtml(dc.note || 'تسديد دين')}${dc.remainingDebtNow !== null && dc.remainingDebtNow !== undefined ? ' | الباقي: ' + moneyHtml(dc.remainingDebtNow) : ''}</td>
                  <td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">${moneyHtml(dc.amount || 0, '+')}</td>
                </tr>`).join('');
          return `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11.2px;color:#065f46;border-bottom:2px solid #6ee7b7;padding-bottom:3px;margin-bottom:5px;">
                <span>${bidiHtml(customTitle || '🤝 سجل تحصيلات الديون المقبوضة في الدرج (بأسماء الزبائن)')}</span>
                <span>${moneyHtml(totCol, '+')}</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead><tr style="background:#d1fae5;color:#064e3b;">
                  <th style="border:1px solid #a7f3d0;padding:4px;width:5%;">#</th>
                  <th style="border:1px solid #a7f3d0;padding:4px;width:12%;">الساعة</th>
                  <th style="border:1px solid #a7f3d0;padding:4px;width:28%;">اسم الزبون</th>
                  <th style="border:1px solid #a7f3d0;padding:4px;width:40%;">البيان والرصيد المتبقي</th>
                  <th style="border:1px solid #a7f3d0;padding:4px;width:15%;">المبلغ المقبوض</th>
                </tr></thead>
                <tbody>${tableRows}</tbody>
              </table>
              ${noteBlock}
            </div>`;
        }

        case 'shift_payment_methods_kpis': {
          const fd = doc.forensicDossier || {
            kpis: { salesCount: 24, totalSalesRevenue: 17370, avgBasket: 723.75, totalDiscounts: 150 },
            paymentBreakdown: { cash: 14800, cib: 1000, baridimob: 0, cheque: 0, credit: 1570 }
          };
          const k = fd.kpis || {};
          const pm = fd.paymentBreakdown || {};
          return `
            <div style="border:1.5px solid ${theme.border || '#cbd5e1'};border-radius:7px;padding:${isThermal ? '4px 6px' : '7px 10px'};background:#f8fafc;color:#0f172a;font-size:${isThermal ? '8.5px' : '10.2px'};">
              <div style="font-weight:900;color:${theme.primary || '#0f172a'};border-bottom:1px dashed #cbd5e1;padding-bottom:2px;margin-bottom:4px;font-size:${isThermal ? '9.2px' : '11px'};">
                ${bidiHtml(customTitle || '💳 تفصيل المبيعات ووسائل الدفع ومؤشرات الأداء')}
              </div>
              <div style="display:grid;grid-template-columns:${isThermal ? '1fr 1fr' : 'repeat(3,1fr)'};gap:3px 8px;font-weight:800;">
                <div>عدد الفواتير: <strong>${Number(k.salesCount || 0)}</strong></div>
                <div>رقم الأعمال: ${moneyHtml(k.totalSalesRevenue || 0)}</div>
                <div>متوسط السلة: ${moneyHtml(k.avgBasket || 0)}</div>
                <div>نقداً (Cash): ${moneyHtml(pm.cash || 0)}</div>
                <div>إلكتروني (CIB/CCP): ${moneyHtml(Number(pm.cib || 0) + Number(pm.baridimob || 0))}</div>
                <div>آجل (كريدي): ${moneyHtml(pm.credit || 0)}</div>
                <div>شيكات: ${moneyHtml(pm.cheque || 0)}</div>
                <div>التخفيضات: ${moneyHtml(k.totalDiscounts || 0)}</div>
              </div>
              ${noteBlock}
            </div>`;
        }

        case 'shift_top_debtors_followup': {
          const fd = doc.forensicDossier || {
            topDebtors: [
              { name: 'كريم بن عيسى', phone: '0661445566', debt: 2150 },
              { name: 'سليم مرابط', phone: '0770889900', debt: 620 },
              { name: 'أمين بن يحيى', phone: '0550112233', debt: 550 }
            ],
            kpis: { storeTotalDebtReal: 3320, debtorsCount: 3 }
          };
          const list = Array.isArray(fd.topDebtors) ? fd.topDebtors : [];
          const rows = list.length === 0
            ? '<div style="color:#047857;font-weight:800;text-align:center;padding:4px 0;">✔ لا توجد ديون عالقة على الزبائن حالياً</div>'
            : list.slice(0, isThermal ? 5 : 8).map((td, idx) => `
                <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted #e2e8f0;font-size:${isThermal ? '8.5px' : '10px'};">
                  <span style="font-weight:800;">${idx + 1}. ${bidiHtml(td.name)}${td.phone ? ' <span style="color:#64748b;font-weight:600;">(' + esc(td.phone) + ')</span>' : ''}</span>
                  <span style="color:#b91c1c;">${moneyHtml(td.debt || 0)}</span>
                </div>`).join('');
          return `
            <div style="border:1.5px solid #fed7aa;border-radius:7px;padding:${isThermal ? '4px 6px' : '7px 10px'};background:#fff7ed;color:#0f172a;">
              <div style="display:flex;justify-content:space-between;font-weight:900;color:#9a3412;border-bottom:1px dashed #fdba74;padding-bottom:2px;margin-bottom:4px;font-size:${isThermal ? '9.2px' : '11px'};">
                <span>${bidiHtml(customTitle || '📌 أكبر المدينين في المتجر حالياً (للمتابعة والتحصيل)')}</span>
                <span>${moneyHtml((fd.kpis && fd.kpis.storeTotalDebtReal) || 0)}</span>
              </div>
              ${rows}
              ${noteBlock}
            </div>`;
        }

        case 'shift_cash_debt_balance': {
          const ss = doc.shiftSummary || {};
          const expectedDrawer = Number(ss.expectedBalance ?? doc.total ?? 0);
          const countedDrawer = Number(ss.countedBalance ?? doc.paidAmount ?? expectedDrawer);
          const diff = Number((countedDrawer - expectedDrawer).toFixed(2));
          const newCredit = Number(ss.newCreditGiven ?? doc.previousBalance ?? 0);
          const debtCollected = Number(ss.debtPayments ?? 0);
          const storeDebt = Number(ss.totalStoreCustomerDebt ?? newCredit);
          return `
            <div style="border:2px solid #0f172a;border-radius:8px;padding:7px 8px;background:#f8fafc;color:#0f172a;font-size:${isThermal ? '9.4px' : '11px'};">
              <div style="font-weight:900;text-align:center;background:#0f172a;color:#ffffff;padding:3px 6px;border-radius:5px;margin-bottom:6px;">
                ${bidiHtml(customTitle || 'ميزان الوردية المزدوج: سيولة الدرج مقابل ديون الوردية')}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;text-align:center;font-weight:900;">
                <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:7px;padding:5px;">
                  <div style="font-size:8.8px;color:#1d4ed8;">السيولة المتوقعة بالدرج</div>
                  <div style="font-size:${isThermal ? '11px' : '13px'};color:#1e3a8a;">${moneyHtml(expectedDrawer)}</div>
                  <div style="font-size:8.6px;color:#047857;">المعدود: ${moneyHtml(countedDrawer)} | الفارق: <bdi dir="ltr">${diff.toFixed(2)}</bdi></div>
                </div>
                <div style="background:#fff1f2;border:1.5px solid #fda4af;border-radius:7px;padding:5px;">
                  <div style="font-size:8.8px;color:#be123c;">ديون ممنوحة بالوردية (آجلة)</div>
                  <div style="font-size:${isThermal ? '11px' : '13px'};color:#881337;">${moneyHtml(newCredit)}</div>
                  <div style="font-size:8.6px;color:#475569;">المحصل: ${moneyHtml(debtCollected)} | المتجر: ${moneyHtml(storeDebt)}</div>
                </div>
              </div>
              <div style="margin-top:5px;font-size:8.6px;font-weight:800;color:#475569;text-align:center;">
                الديون الممنوحة ذمم لدى الزبائن ولا تُحسب مع كاش الدرج، بينما تحصيلات الديون مضافة في الدرج.
              </div>
              ${noteBlock}
            </div>`;
        }

        case 'shift_flows_summary': {
          const ss = doc.shiftSummary || {};
          return `
            <div style="border:1.5px dashed #475569;border-radius:8px;padding:6px 8px;background:#ffffff;font-size:${isThermal ? '9.4px' : '10.8px'};font-weight:800;color:#1e293b;line-height:1.55;">
              <div style="font-weight:900;color:#0f172a;margin-bottom:3px;">${bidiHtml(customTitle || 'حركة المداخيل والمصاريف النقدية في الوردية:')}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
                <span>الافتتاحي: <strong>${moneyHtml(ss.openingBalance || 0)}</strong></span>
                <span style="color:#047857;">مبيعات الكاش: <strong>${moneyHtml(ss.cashSales || 0, '+')}</strong></span>
                <span style="color:#047857;">تحصيل ديون: <strong>${moneyHtml(ss.debtPayments || 0, '+')}</strong></span>
                <span style="color:#be123c;">مصاريف وسحوبات: <strong>${moneyHtml(Number(ss.expenses || 0) + Number(ss.cashOut || 0), '-')}</strong></span>
              </div>
              ${noteBlock}
            </div>`;
        }

        
        case 'caisse_billetage': {
          const ss = doc.shiftSummary || {};
          const expected = Number(ss.expectedBalance ?? doc.total ?? 0);
          const counted = Number(ss.countedBalance ?? doc.paidAmount ?? expected);
          const diff = Number((counted - expected).toFixed(2));
          return `
            <div style="border:1.5px solid #334155;border-radius:8px;padding:6px 8px;background:#f8fafc;font-size:${isThermal ? '9.5px' : '11px'};font-weight:800;">
              <div style="font-weight:900;color:#0f172a;margin-bottom:3px;">${bidiHtml(customTitle || 'مطابقة جرد الصندوق (Billetage)')}</div>
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
                <span>المتوقع: ${moneyHtml(expected)}</span>
                <span>المعدود: ${moneyHtml(counted)}</span>
                <span style="color:${Math.abs(diff) < 0.05 ? '#047857' : '#be123c'};">الفارق: ${moneyHtml(diff)}</span>
              </div>
              ${noteBlock}
            </div>`;
        }

        case 'bank_rip_ccp':
          return `
            <div style="border:1.5px solid ${theme.border};border-radius:8px;padding:6px 9px;background:${theme.accentBg};font-size:${isThermal ? '9.4px' : '11px'};font-weight:800;">
              <div style="font-weight:900;color:${theme.primary};">${bidiHtml(customTitle || 'بيانات الدفع البريدي والبنكي (BaridiMob RIP / CCP)')}</div>
              <div style="font-family:monospace;margin-top:2px;"><bdi dir="ltr">RIP: ${esc(shop.rip || '00799999000000000000')}${shop.ccp ? ` | CCP: ${esc(shop.ccp)}` : ''}</bdi></div>
              ${noteBlock}
            </div>`;

        case 'colisage_summary':
          return `
            <div style="border:1.5px solid ${theme.border};border-radius:8px;padding:6px 9px;background:#f8fafc;font-size:${isThermal ? '9.6px' : '11px'};font-weight:800;display:flex;justify-content:space-between;">
              <span>${bidiHtml(customTitle || 'ملخص الطرود والكميات (Colisage)')}:</span>
              <span style="font-family:monospace;">الأصناف: <bdi dir="ltr">${(doc.items || []).length}</bdi> | الوحدات: <bdi dir="ltr">${totalItemsQty}</bdi></span>
            </div>`;

        case 'delivery_driver':
          return `
            <div style="border:1.5px solid #0d9488;border-radius:8px;padding:7px 9px;background:#f0fdfa;color:#115e59;font-size:${isThermal ? '9.6px' : '11px'};font-weight:800;">
              <div style="font-weight:900;margin-bottom:4px;">${bidiHtml(customTitle || 'بيانات التوصيل والنقل (Bon de Livraison)')}</div>
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
                <span>السائق: ${bidiHtml(doc.driverName || '.........................')}</span>
                <span>المركبة: <bdi dir="ltr" style="font-family:monospace;">${esc(doc.vehiclePlate || '...............')}</bdi></span>
                <span>إمضاء المستلم: ...................</span>
              </div>
              ${noteBlock}
            </div>`;

        case 'warranty_serial':
          return `
            <div style="border:1.5px solid #1d4ed8;border-radius:8px;padding:7px 9px;background:#eff6ff;color:#1e3a8a;font-size:${isThermal ? '9.6px' : '11px'};font-weight:800;">
              <div style="font-weight:900;margin-bottom:3px;">${bidiHtml(customTitle || 'شهادة الضمان الرسمي والأرقام التسلسلية (Garantie)')}</div>
              <div>يشمل الضمان عيوب التصنيع خلال المدة المحددة مع إحضار هذه الشهادة والغلاف الأصلي.</div>
              ${noteBlock}
            </div>`;

        case 'order_reservation':
          return `
            <div style="border:1.5px solid #d97706;border-radius:8px;padding:7px 9px;background:#fffbeb;color:#78350f;font-size:${isThermal ? '9.6px' : '11px'};font-weight:800;">
              <div style="font-weight:900;margin-bottom:3px;">${bidiHtml(customTitle || 'حجز الطلبية والعربون (Acompte)')}</div>
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
                <span>العربون المدفوع: <strong>${moneyHtml(doc.paidAmount)}</strong></span>
                <span>الباقي عند التسليم: <strong style="color:#be123c;">${moneyHtml(remToday)}</strong></span>
              </div>
              ${noteBlock}
            </div>`;

        case 'dual_signatures': 
          /* [PSP_NATIVE_Z_SIG_HOOK] */
          if (tpl.id === 'caisse_z_report' || tpl.id === 'caisse_shift_full_audit_a4') {
            return renderNativeZReportSignatures(tpl, doc, isThermal, noteBlock, esc);
          }return `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-top:14px;padding-bottom:6px;text-align:center;font-size:${isThermal ? '9.6px' : '11.5px'};font-weight:900;color:#334155;">
              <div>
                <div>${esc(t.signCustomer)}</div>
                <div style="margin-top:26px;border-top:1px dashed #94a3b8;width:75%;margin-left:auto;margin-right:auto;"></div>
              </div>
              <div>
                <div>${esc(t.signShop)} (${bidiHtml(shop.name)})</div>
                <div style="margin-top:26px;border-top:1px dashed #94a3b8;width:75%;margin-left:auto;margin-right:auto;"></div>
              </div>
            </div>`;

        case 'footer_terms': {
          const terms = customTitle || tpl.footerText || '';
          if (isPrintOrPdf && !terms && (!tpl.showRipFooter || !shop.rip)) return '';
          return `
            <div style="border-top:1px solid #cbd5e1;padding-top:6px;text-align:center;font-size:${isThermal ? '9px' : '10.5px'};color:#334155;">
              ${terms ? `<div style="font-weight:800;line-height:1.45;">${bidiHtml(terms)}</div>` : ''}
              ${tpl.showRipFooter && shop.rip ? `<div style="font-family:monospace;font-weight:900;margin-top:3px;font-size:9.3px;color:#0f172a;"><bdi dir="ltr">RIP: ${esc(shop.rip)}</bdi></div>` : ''}
              ${noteBlock}
            </div>`;
        }

        case 'custom_note': {
          const text = (customTitle || customNote || '').trim();
          if (isPrintOrPdf && !text) return '';
          if (!text) {
            return `<div style="border:1px dashed #cbd5e1;border-radius:7px;padding:5px 8px;text-align:center;font-size:9.3px;color:#94a3b8;font-weight:700;">[ملاحظة حرة فارغة — اكتب نصها في تبويب المكونات لتظهر عند الطباعة]</div>`;
          }
          return `
            <div style="border:1.5px dashed ${theme.border};border-radius:8px;padding:6px 8px;background:${theme.accentBg};font-size:${isThermal ? '10px' : '11px'};font-weight:800;color:#0f172a;">
              ${bidiHtml(text)}
            </div>`;
        }

        default: {
          const defaultsMap = {
            expense_approval: { title: 'اعتماد سند الصرف وتوقيع المستفيد', body: `المبلغ المصروف: ${fmtDzd(doc.total)} — توقيع المستلم: ........................` },
            tax_ifu_g12: { title: 'بيان التصريح الجبائي الجزائري (IFU G12 / G50)', body: `إجمالي الوعاء المصرح به: ${fmtDzd(doc.total)} (${fmtCentimes(doc.total)})` },
            forensic_radar: { title: 'ملخص الفحص الرقابي الجنائي (Anti-Fraude)', body: 'تم توثيق ومراجعة السطور المحذوفة وتعديلات الأسعار وفق سجل الرقابة الأمنية.' },
            supplier_reception: { title: 'مطابقة استلام البضاعة من المورد (BR)', body: `تم استلام وفحص ${(doc.items || []).length} صنفاً (${totalItemsQty} وحدة) وإدراجها في المخزون.` },
            stocktake_variance: { title: 'ملخص محضر الجرد المخزني وفوارق الكميات', body: `إجمالي القيمة المخزنية المعدودة: ${fmtDzd(doc.total)}` },
            bom_cost_box: { title: 'تكلفة التصنيع والمواد الأولية (BOM)', body: `إجمالي تكلفة المواد الأولية والتشغيل: ${fmtDzd(doc.total)}` },
            low_stock_alert: { title: 'أولوية التموين للأصناف الحرجة', body: `عدد الأصناف التي بلغت الحد الأدنى: ${(doc.items || []).length} صنفاً — الميزانية التقديرية: ${fmtDzd(doc.total)}` },
            return_policy: { title: 'شروط الإرجاع والاستبدال', body: 'يُقبل الاستبدال خلال 48 ساعة بشرط سلامة الغلاف الأصلي وإحضار الوصل.' },
            vip_coupon: { title: 'قسيمة تخفيض للزيارة القادمة (Coupon VIP)', body: 'احتفظ بهذه القسيمة واستفد من نقاط وفاء إضافية في زيارتك المقبلة!' }
          };
          const info = defaultsMap[id];
          if (!info) return '';
          return `
            <div style="border:1.5px solid ${theme.border};border-radius:8px;padding:6px 8px;background:${theme.accentBg};font-size:${isThermal ? '9.6px' : '11px'};color:#0f172a;">
              <div style="font-weight:900;color:${theme.primary};margin-bottom:2px;">${bidiHtml(customTitle || info.title)}</div>
              <div style="font-weight:700;line-height:1.45;">${bidiHtml(info.body)}</div>
              ${noteBlock}
            </div>`;
        }
      }
    }

    function renderDocument(templateConfig, rawDocData, mode = 'preview', options = {}) {
      /* [PSP_RESET_DEDUP_SET_V2] */
      /* [PSP_REAL_PAYLOAD_PRIORITY_V2] */
      const _pspOrigRawPayload = rawDocData && typeof rawDocData === "object" ? rawDocData : null;
      if (rawDocData && typeof rawDocData === 'object' && rawDocData._pspRenderedSecSet) { try { delete rawDocData._pspRenderedSecSet; } catch (_) {} }
      const tpl = templateConfig || PSP.state.getActiveTemplate();
      const doc = normalizeDocData(rawDocData || {}, tpl.id);
      const shop = PSP.state.getShopIdentity();

      const paperSize = (options.forceOverride && options.paperSize) ? options.paperSize : (tpl.paperSize || options.paperSize || '80mm');
      const isThermal = paperSize === '80mm' || paperSize === '58mm';
      const themeIdEff = (options.forceOverride && options.themeId) ? options.themeId : (tpl.themeId || options.themeId);
      const theme = PSP.state.THEMES[themeIdEff] || PSP.state.THEMES.executive_dark;
      const lang = (options.forceOverride && options.lang) ? options.lang : (tpl.lang || options.lang || 'ar');
      const dir = lang === 'ar' ? 'rtl' : 'ltr';
      const t = I18N_LABELS[lang] || I18N_LABELS.ar;
      const baseFontPx = Number(tpl.baseFontSizePx || (isThermal ? 11 : 12));

      const marginPadMap = {
        compact: isThermal ? '2mm' : '6mm',
        normal: isThermal ? '3mm' : '10mm',
        wide: isThermal ? '4.5mm' : '14mm'
      };
      const padCss = marginPadMap[tpl.marginMode || 'normal'] || (isThermal ? '3mm' : '10mm');
      const gapCss = tpl.densityMode === 'compact' ? '5px' : tpl.densityMode === 'spacious' ? '10px' : '7px';

      const enabledSections = (Array.isArray(tpl.sections) ? tpl.sections : []).filter((s) => s && s.enabled);

      const sectionsHtml = enabledSections
        .map((sec) => {
          /* [PSP_FD_RENDER_GUARD] */
          if (rawDocData && rawDocData.forensicDossier) { doc.forensicDossier = rawDocData.forensicDossier; }
          /* [PSP_EXPENSE_OPTS_RENDER_GUARD] */
          if (rawDocData && rawDocData.expenseVoucher) doc.expenseVoucher = rawDocData.expenseVoucher;
          if (_pspOrigRawPayload && _pspOrigRawPayload.expenseVoucher) doc.expenseVoucher = _pspOrigRawPayload.expenseVoucher;
          if (_pspOrigRawPayload && _pspOrigRawPayload.outflowsReport) doc.outflowsReport = _pspOrigRawPayload.outflowsReport;
          if (_pspOrigRawPayload && _pspOrigRawPayload.forensicDossier) doc.forensicDossier = _pspOrigRawPayload.forensicDossier;
          {
            const _stExpTpl = (window.GherbiPrintStudioPro && window.GherbiPrintStudioPro.state && typeof window.GherbiPrintStudioPro.state.getTemplate === "function")
              ? window.GherbiPrintStudioPro.state.getTemplate(tpl.id)
              : null;
            tpl.expenseOptions = Object.assign({}, tpl.expenseOptions || {}, (_stExpTpl && _stExpTpl.expenseOptions) || {}, (templateConfig && templateConfig.expenseOptions) || {});
          }
          /* [PSP_S6C_EXT_FUNDING_RENDER_GUARD] */
          if (rawDocData && rawDocData.externalFundedTx) doc.externalFundedTx = rawDocData.externalFundedTx;
          if (rawDocData && rawDocData.externalFundedTotals) doc.externalFundedTotals = rawDocData.externalFundedTotals;
          /* [PSP_SHIFT_OPTIONS_RENDER_GUARD] */
          {
            const _stTpl = (window.GherbiPrintStudioPro && window.GherbiPrintStudioPro.state && typeof window.GherbiPrintStudioPro.state.getTemplate === "function")
              ? window.GherbiPrintStudioPro.state.getTemplate(tpl.id)
              : null;
            tpl.shiftOptions = Object.assign({}, tpl.shiftOptions || {}, (_stTpl && _stTpl.shiftOptions) || {}, (templateConfig && templateConfig.shiftOptions) || {});
          }
          /* [PSP_RENDER_DEDUP_SECTIONS_V2] */
          if (!doc._pspRenderedSecSet) doc._pspRenderedSecSet = new Set();
          if (sec && sec.id && doc._pspRenderedSecSet.has(sec.id)) return '';
          if (sec && sec.id) doc._pspRenderedSecSet.add(sec.id);
          const inner = renderSectionContent(sec, tpl, doc, shop, theme, isThermal, mode, t);
          if (!inner || !inner.trim()) return '';

          const scalePct = Number(sec.fontScale || 100);
          const alignCss = sec.align || (dir === 'rtl' ? 'right' : 'left');
          let wrapperStyle = `margin-bottom:${gapCss};font-size:${scalePct}%;text-align:${alignCss};page-break-inside:avoid;`;

          if (sec.border === 'solid') wrapperStyle += `border:1.5px solid ${theme.primary};border-radius:8px;padding:5px;`;
          else if (sec.border === 'dashed') wrapperStyle += `border:1.5px dashed #64748b;border-radius:8px;padding:5px;`;
          if (sec.bg === 'tinted') wrapperStyle += `background:${theme.accentBg};border-radius:8px;padding:5px;`;
          else if (sec.bg === 'white') wrapperStyle += `background:#ffffff;`;

          return `<div class="psp-sec-block" data-psp-section="${esc(sec.id)}" style="${wrapperStyle}">${inner}</div>`;
        })
        .filter(Boolean)
        .join('\n');

      const zoomScale = mode === 'preview' ? Number(options.zoomPct || PSP.state.zoomPct || 100) / 100 : 1;
      const fontStack = `'${esc(tpl.fontFamily || 'Cairo')}', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif`;

      let paperHtml = '';
      if (paperSize === '2xa5') {
        paperHtml = `
          <div class="psp-paper size-2xa5" dir="${dir}" style="font-family:${fontStack};font-size:${baseFontPx}px;padding:${padCss};transform:scale(${zoomScale});display:grid;grid-template-columns:1fr 1fr;gap:8mm;">
            <div style="border-left:1.5px dashed #94a3b8;padding-left:6mm;">${sectionsHtml}</div>
            <div>${sectionsHtml}</div>
          </div>`;
      } else {
        paperHtml = `
          <div class="psp-paper size-${esc(paperSize)}" dir="${dir}" style="font-family:${fontStack};font-size:${baseFontPx}px;padding:${padCss};transform:scale(${zoomScale});">
            ${sectionsHtml}
          </div>`;
      }

      const pageRule = isThermal
        ? `@page { size: ${paperSize === '58mm' ? '58mm' : '80mm'} 200mm; margin: 0; }`
        : paperSize === '2xa5'
        ? `@page { size: A4 landscape; margin: 5mm; }`
        : paperSize === 'a5'
        ? `@page { size: A5 portrait; margin: 6mm; }`
        : `@page { size: A4 portrait; margin: 8mm; }`;

      const printWidth = paperSize === '58mm' ? '58mm' : paperSize === '80mm' ? '80mm' : '100%';
      const docMeta = PSP.state.getDocMeta(tpl.id);

      const fullHtml = `<!DOCTYPE html>
<html lang="${esc(lang)}" dir="${dir}" data-psp-rendered="1" data-psp-doc="${esc(tpl.id)}" data-psp-paper="${esc(paperSize)}" data-v62-adopted-doc="1" data-v52-studio-master="1" data-v49-adopted-master="1">
<head>
  <meta charset="UTF-8">
  <title>${esc(cleanPrintText(tpl.customTitle || docMeta.cleanTitle || docMeta.name))}</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${isThermal ? printWidth : '100%'} !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: ${fontStack} !important;
      direction: ${dir} !important;
    }
    .psp-paper {
      width: ${printWidth} !important;
      min-height: auto !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      transform: none !important;
      background: #ffffff !important;
      padding: ${isThermal ? '2.5mm' : '4mm'} !important;
    }
    table { width: 100% !important; border-collapse: collapse !important; }
    bdi { unicode-bidi: isolate !important; }
  </style>
</head>
<body>${paperHtml}</body>
</html>`;

      return {
        paperHtml,
        fullHtml,
        docData: doc,
        isWalkin: Boolean(doc.isWalkinCustomer),
        isThermal,
        paperSize
      };
    }

    PSP.renderer = {
      renderDocument,
      amountToWords,
      interpolateVars,
      bidiHtml,
      moneyHtml,
      cleanPrintText
    };
    PSP.modules.renderer = true;
    PSP.stage = Math.max(PSP.stage || 1, 2);

    if (PSP.isPrintViewActive && PSP.isPrintViewActive() && PSP.ui && PSP.state.activeView === 'studio') {
      PSP.ui.updatePaperOnly();
    }

    console.log('✅ [Print Studio Pro — War Stage 1 Renderer]: محرك BiDi/RTL و 80mm والديون الدقيقة نشط 100%.');
  })();
})();
