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
          return `
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
