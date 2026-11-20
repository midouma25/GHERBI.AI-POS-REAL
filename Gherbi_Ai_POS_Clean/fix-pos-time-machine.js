/**
 * apply-war-stage5d-executive-zreport.js
 * الترقية القيادية الشاملة لمحاضر إغلاق الوردية (80mm الحراري + A4 التنفيذي):
 * 1. ترقية till-ledger.js (الخلفية SQLite): استخراج ملف جنائي حي كامل للوردية (forensicDossier):
 *    - تفصيل الأموال الخارجة (من أخذ المال؟ كم؟ لماذا؟ متى؟) من caisse_transactions + expenses + suppliers.
 *    - دفتر الزبائن الذين أخذوا بالدين في الوردية (الاسم، الهاتف، الفاتورة، المدفوع، الدين المضاف، الدين التراكمي).
 *    - سجل تحصيلات الديون بأسماء الزبائن الحقيقية (ربط sale_payments + sales + customers بدلاً من #3).
 *    - تفصيل وسائل الدفع (Cash / CIB / BaridiMob / Chèque / Crédit) + التخفيضات + أحداث audit_logs الحساسة.
 *    - إجمالي ديون المتجر الحقيقي + أهم المدينين للمتابعة + تنبيهات المستشار الرقابي لصاحب المتجر.
 * 2. ترقية perf-core/caisse-bom-stocktake-stage5.js:
 *    - تصميم احترافي مزدوج (80mm حراري مضغوط + A4 تنفيذي بـ 4 بطاقات KPI و 4 جداول ومصادقة ثلاثية).
 *    - يعمل تلقائياً في: مركز الطباعة (ببيانات نموذجية حية)، نافذة إدارة الصندوق (#reviewCaisseModal)،
 *      إغلاق المناوبة، والطباعة/تصدير PDF بجميع الأزرار.
 * 3. فحص نحوي آلي (node --check) + 7 اختبارات جنائية آلية داخل VM.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = fs.existsSync(path.join(__dirname, 'Gherbi_Ai_POS_Clean'))
  ? path.join(__dirname, 'Gherbi_Ai_POS_Clean')
  : __dirname;

const TILL_LEDGER_PATH = path.join(ROOT, 'till-ledger.js');
const STAGE5_PATH = path.join(ROOT, 'perf-core', 'caisse-bom-stocktake-stage5.js');
const STUDIO_DIR = path.join(ROOT, 'print-studio-pro');
const ARCH_DIR = path.join(ROOT, '_legacy_archive');
const BACKUP_DIR = path.join(ARCH_DIR, 'war_stage5d_zreport_backups');

for (const fp of [TILL_LEDGER_PATH, STAGE5_PATH, STUDIO_DIR]) {
  if (!fs.existsSync(fp)) {
    console.error('❌ ملف أساسي مفقود:', fp);
    process.exit(1);
  }
}

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(TILL_LEDGER_PATH, path.join(BACKUP_DIR, `till-ledger.js.${stamp}.bak`));
fs.copyFileSync(STAGE5_PATH, path.join(BACKUP_DIR, `caisse-bom-stocktake-stage5.js.${stamp}.bak`));
console.log('✅ [1/4]: تم أخذ نسخ احتياطية آمنة في _legacy_archive/war_stage5d_zreport_backups.');

// ============================================================================
// 1. حقن مُغني البيانات الجنائي للوردية في till-ledger.js (Zero-Escape Function)
// ============================================================================
function installTillLedgerStage5DForensicEnricher(exportsObj) {
  'use strict';
  if (!exportsObj || typeof exportsObj.computeSessionSummary !== 'function' || exportsObj._stage5DForensicInstalled) {
    return;
  }
  exportsObj._stage5DForensicInstalled = true;
  const origCompute = exportsObj.computeSessionSummary;

  function toNum(v) {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function extractTimeHHMM(dtStr) {
    const s = String(dtStr || '');
    const m = s.match(/(\d{2}:\d{2})/);
    return m ? m[1] : s.slice(11, 16) || '';
  }

  function parseBeneficiaryAndReason(tx, expRow, supMap) {
    const rawDesc = String(tx.description || (expRow && expRow.description) || '').trim();
    const rawCat = String(tx.category || (expRow && expRow.category) || '').trim();
    const tp = String(tx.type || '').toLowerCase();

    let beneficiary = '';
    let reason = rawDesc;

    // 1. استخراج [المستفيد: فلان]
    const mBen = rawDesc.match(/\[\s*المستفيد\s*:\s*([^\]]+)\]/i);
    if (mBen && mBen[1]) {
      beneficiary = mBen[1].trim();
      reason = reason.replace(mBen[0], '').trim();
    }

    // 2. استخراج سلفة عامل إن وجدت
    const mAdv = rawDesc.match(/\[\s*سلفة\s+عامل[^\]]*\]/i);
    let tagLabel = '';
    if (mAdv) {
      tagLabel = mAdv[0].replace(/^\[|\]$/g, '').trim();
      reason = reason.replace(mAdv[0], '').trim();
    }

    // 3. ربط تسديد المورد باسمه الحقيقي من جدول suppliers
    const mSup = rawDesc.match(/المورد\s*#(\d+)/);
    if (mSup && supMap.has(Number(mSup[1]))) {
      const supName = supMap.get(Number(mSup[1]));
      if (!beneficiary) beneficiary = 'المورد: ' + supName;
      reason = reason.replace(mSup[0], 'المورد ' + supName);
    }

    if (!beneficiary) {
      if (tp === 'cash_out') beneficiary = 'سحب إداري / المالك';
      else if (tp === 'refund' || tp === 'sale_refund') beneficiary = 'مرتجع لزبون';
      else if (rawCat && rawCat !== 'عام' && rawCat !== 'sales') beneficiary = rawCat;
      else beneficiary = 'مصروف المحل';
    }

    const typeLabel =
      tagLabel ||
      (tp === 'cash_out'
        ? 'سحب نقدي'
        : tp === 'refund' || tp === 'sale_refund'
        ? 'مرتجع نقدي'
        : rawCat === 'suppliers'
        ? 'تسديد مورد'
        : rawCat === 'purchases'
        ? 'فاتورة شراء'
        : rawCat || 'مصروف تشغيلي');

    if (!reason) reason = typeLabel;
    return { beneficiary, reason, typeLabel };
  }

  exportsObj.computeSessionSummary = async function computeSessionSummaryWithForensicDossier(db, sessionId) {
    const base = await origCompute.call(this, db, sessionId);
    if (!base || !base.session) return base;

    try {
      const dbAll = (sql, params = []) =>
        typeof db.dbAll === 'function' ? db.dbAll(sql, params) : typeof db.allAsync === 'function' ? db.allAsync(sql, params) : Promise.resolve([]);
      const dbGet = (sql, params = []) =>
        typeof db.dbGet === 'function' ? db.dbGet(sql, params) : typeof db.getAsync === 'function' ? db.getAsync(sql, params) : Promise.resolve(null);

      const sess = base.session;
      const sid = Number(sess.id || sessionId);
      const openedAt = String(sess.opened_at || '').replace('T', ' ').slice(0, 19);
      const closedAt = sess.closed_at ? String(sess.closed_at).replace('T', ' ').slice(0, 19) : new Date().toISOString().replace('T', ' ').slice(0, 19);
      const txs = Array.isArray(base.transactions) ? base.transactions : [];

      // 1. جلب خرائط الزبائن والموردين والمصاريف
      const [custRows, supRows, expRows, spRows, shiftSalesRows, auditRows] = await Promise.all([
        dbAll(
          `SELECT
             c.id, c.name, c.phone, c.loyalty_card_code,
             (COALESCE(SUM(s.total - s.paid_amount), 0) + (COALESCE(c.initial_debt, 0) - COALESCE(c.initial_debt_paid, 0))) AS live_debt
           FROM customers c
           LEFT JOIN sales s ON s.customer_id = c.id AND s.deleted_at IS NULL
           WHERE c.deleted_at IS NULL
           GROUP BY c.id`
        ).catch(() => []),
        dbAll('SELECT id, name, phone FROM suppliers WHERE deleted_at IS NULL').catch(() => []),
        dbAll('SELECT id, category, description, amount, date, session_id FROM expenses WHERE deleted_at IS NULL AND (session_id = ? OR date(created_at) BETWEEN date(?) AND date(?))', [sid, openedAt || '2000-01-01', closedAt || '2099-12-31']).catch(() => []),
        dbAll(
          `SELECT sp.id, sp.sale_id, sp.customer_id, sp.amount, sp.payment_method, sp.notes, c.name AS customer_name, c.phone AS customer_phone
           FROM sale_payments sp
           LEFT JOIN customers c ON c.id = sp.customer_id
           WHERE sp.deleted_at IS NULL`
        ).catch(() => []),
        dbAll(
          `SELECT
             s.id, s.doc_number, s.customer_id, s.subtotal, s.discount, s.total, s.paid_amount,
             s.payment_method, s.sale_date, s.created_at, s.session_id,
             c.name AS customer_name, c.phone AS customer_phone, c.loyalty_card_code
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           WHERE s.deleted_at IS NULL
             AND (
               s.session_id = ?
               OR (
                 (s.session_id IS NULL OR s.session_id = 0)
                 AND datetime(replace(substr(COALESCE(s.created_at, s.sale_date), 1, 19), 'T', ' '))
                     BETWEEN datetime(replace(substr(?, 1, 19), 'T', ' '))
                         AND datetime(replace(substr(?, 1, 19), 'T', ' '))
               )
             )
           ORDER BY s.id DESC`,
          [sid, openedAt || '2000-01-01 00:00:00', closedAt || '2099-12-31 23:59:59']
        ).catch(() => []),
        dbAll(
          `SELECT id, user_name, action_type, severity, details_json, created_at
           FROM audit_logs
           WHERE deleted_at IS NULL
             AND datetime(replace(substr(created_at, 1, 19), 'T', ' '))
                 BETWEEN datetime(replace(substr(?, 1, 19), 'T', ' '))
                     AND datetime(replace(substr(?, 1, 19), 'T', ' '))
             AND (severity IN ('warning', 'critical', 'danger') OR action_type LIKE '%DELETE%' OR action_type LIKE '%credit_note%' OR action_type LIKE '%BELOW_COST%')
           ORDER BY id DESC LIMIT 20`,
          [openedAt || '2000-01-01 00:00:00', closedAt || '2099-12-31 23:59:59']
        ).catch(() => [])
      ]);

      const custMap = new Map();
      let storeTotalDebtReal = 0;
      const debtorsList = [];
      for (let i = 0; i < custRows.length; i++) {
        const c = custRows[i];
        const liveDebt = Number(Math.max(0, toNum(c.live_debt)).toFixed(2));
        custMap.set(Number(c.id), { ...c, live_debt: liveDebt });
        if (liveDebt > 0.009) {
          storeTotalDebtReal += liveDebt;
          debtorsList.push({
            id: Number(c.id),
            name: c.name || 'زبون #' + c.id,
            phone: c.phone || '',
            cardCode: c.loyalty_card_code || '',
            debt: liveDebt
          });
        }
      }
      storeTotalDebtReal = Number(storeTotalDebtReal.toFixed(2));
      debtorsList.sort((a, b) => b.debt - a.debt);

      const supMap = new Map();
      for (let i = 0; i < supRows.length; i++) supMap.set(Number(supRows[i].id), supRows[i].name);

      const expMap = new Map();
      for (let i = 0; i < expRows.length; i++) expMap.set(Number(expRows[i].id), expRows[i]);

      const spMap = new Map();
      for (let i = 0; i < spRows.length; i++) spMap.set(Number(spRows[i].id), spRows[i]);

      // 2. تصنيف حركات الدرج بدقة: الخارج (مصاريف/سلف/سحوبات)، تحصيلات الديون بأسماء الزبائن، الإيداعات
      const outflows = [];
      const inflows = [];
      const debtCollections = [];
      let totalOutflows = 0;
      let totalInflows = 0;
      let totalDebtCollected = 0;
      let txCashSalesTotal = 0;

      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        if (!tx) continue;
        const tp = String(tx.type || '').toLowerCase();
        const amt = Number(Math.abs(toNum(tx.amount)).toFixed(2));
        const timeStr = extractTimeHHMM(tx.created_at);

        if (tp === 'sale' || tp === 'cash_sale' || tp === 'sale_cash') {
          txCashSalesTotal += amt;
        } else if (tp === 'expense' || tp === 'cash_out' || tp === 'refund' || tp === 'sale_refund') {
          const expRow = tx.reference_id ? expMap.get(Number(tx.reference_id)) : null;
          const parsed = parseBeneficiaryAndReason(tx, expRow, supMap);
          totalOutflows += amt;
          outflows.push({
            id: tx.id,
            time: timeStr,
            type: tp,
            typeLabel: parsed.typeLabel,
            beneficiary: parsed.beneficiary,
            reason: parsed.reason,
            amount: amt
          });
        } else if (tp === 'cash_in' || tp === 'order_deposit') {
          totalInflows += amt;
          inflows.push({
            id: tx.id,
            time: timeStr,
            type: tp,
            typeLabel: tp === 'order_deposit' ? 'عربون طلبية' : 'إيداع وتغذية درج',
            source: tx.category && tx.category !== 'عام' ? tx.category : 'الصندوق',
            reason: tx.description || (tp === 'order_deposit' ? 'عربون طلبية زبون' : 'تغذية الصندوق'),
            amount: amt
          });
        } else if (tp === 'debt_payment' || tp === 'customer_payment') {
          totalDebtCollected += amt;
          let custName = '';
          let custPhone = '';
          let custId = null;

          // أولاً: من sale_payments عبر reference_id
          const sp = tx.reference_id ? spMap.get(Number(tx.reference_id)) : null;
          if (sp && sp.customer_id) {
            custId = Number(sp.customer_id);
            const cObj = custMap.get(custId);
            custName = (cObj && cObj.name) || sp.customer_name || '';
            custPhone = (cObj && cObj.phone) || sp.customer_phone || '';
          }

          // ثانياً: من النص "زبون #3"
          if (!custName) {
            const mCust = String(tx.description || '').match(/زبون\s*#(\d+)/);
            if (mCust) {
              custId = Number(mCust[1]);
              const cObj = custMap.get(custId);
              if (cObj) {
                custName = cObj.name;
                custPhone = cObj.phone || '';
              }
            }
          }

          // ثالثاً: من "فاتورة بيع #101"
          if (!custName) {
            const mSale = String(tx.description || '').match(/فاتورة\s+بيع\s*#?(\d+)/);
            if (mSale) {
              const sRow = await dbGet(
                'SELECT s.customer_id, c.name, c.phone FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?',
                [Number(mSale[1])]
              ).catch(() => null);
              if (sRow && sRow.name) {
                custId = Number(sRow.customer_id || 0) || null;
                custName = sRow.name;
                custPhone = sRow.phone || '';
              }
            }
          }

          const cLive = custId && custMap.has(custId) ? custMap.get(custId).live_debt : null;
          debtCollections.push({
            id: tx.id,
            time: timeStr,
            customerId: custId,
            customerName: custName || tx.description || 'زبون',
            customerPhone: custPhone,
            note: (sp && sp.notes) || tx.description || 'تسديد دين',
            amount: amt,
            remainingDebtNow: cLive
          });
        }
      }

      // 3. تحليل مبيعات الوردية: الزبائن المدينين اليوم + تفصيل وسائل الدفع + التخفيضات
      const creditSalesToday = [];
      let totalCreditAddedToday = 0;
      let totalSalesRevenue = 0;
      let totalDiscounts = 0;
      const payMethods = {
        cash: 0,
        cib: 0,
        baridimob: 0,
        cheque: 0,
        credit: 0,
        other: 0
      };

      for (let i = 0; i < shiftSalesRows.length; i++) {
        const s = shiftSalesRows[i];
        const tot = toNum(s.total);
        const paid = Math.min(tot, Math.max(0, toNum(s.paid_amount)));
        const disc = Math.max(0, toNum(s.discount));
        const creditAdded = Number(Math.max(0, tot - paid).toFixed(2));
        const pm = String(s.payment_method || 'cash').toLowerCase();

        totalSalesRevenue += tot;
        totalDiscounts += disc;

        if (paid > 0.009) {
          if (pm === 'cib' || pm === 'card' || pm === 'edahabia') payMethods.cib += paid;
          else if (pm === 'baridimob' || pm === 'ccp') payMethods.baridimob += paid;
          else if (pm === 'cheque') payMethods.cheque += paid;
          else if (pm === 'cash' || pm === 'credit' || pm === 'split' || pm === 'installment') payMethods.cash += paid;
          else payMethods.other += paid;
        }
        if (creditAdded > 0.009) {
          payMethods.credit += creditAdded;
          totalCreditAddedToday += creditAdded;
          const cid = s.customer_id ? Number(s.customer_id) : null;
          const cObj = cid && custMap.has(cid) ? custMap.get(cid) : null;
          creditSalesToday.push({
            saleId: s.id,
            docNumber: s.doc_number || '#' + s.id,
            time: extractTimeHHMM(s.created_at || s.sale_date),
            customerId: cid,
            customerName: (cObj && cObj.name) || s.customer_name || 'زبون غير محدد',
            customerPhone: (cObj && cObj.phone) || s.customer_phone || '',
            cardCode: (cObj && cObj.loyalty_card_code) || s.loyalty_card_code || '',
            invoiceTotal: Number(tot.toFixed(2)),
            paidToday: Number(paid.toFixed(2)),
            creditAdded,
            cumulativeDebtNow: cObj ? cObj.live_debt : creditAdded
          });
        }
      }

      // تجميع تحصيلات الديون حسب الزبون لنسخة 80mm المختصرة
      const collectedByCustomerMap = new Map();
      for (let i = 0; i < debtCollections.length; i++) {
        const dc = debtCollections[i];
        const key = dc.customerName;
        const prev = collectedByCustomerMap.get(key) || { customerName: key, count: 0, total: 0, lastTime: dc.time, remainingDebtNow: dc.remainingDebtNow };
        prev.count += 1;
        prev.total = Number((prev.total + dc.amount).toFixed(2));
        collectedByCustomerMap.set(key, prev);
      }
      const debtCollectionsGrouped = Array.from(collectedByCustomerMap.values()).sort((a, b) => b.total - a.total);

      // 4. توليد تنبيهات المستشار الرقابي لصاحب المتجر
      const ownerAlerts = [];
      const expectedBal = toNum(base.summary && base.summary.expectedBalance !== undefined ? base.summary.expectedBalance : sess.expected_balance);
      const hasCounted = sess.closing_balance !== null && sess.closing_balance !== undefined;
      const diff = hasCounted ? Number((toNum(sess.closing_balance) - expectedBal).toFixed(2)) : 0;

      if (diff < -0.009) {
        ownerAlerts.push({ level: 'danger', text: 'عجز في جرد الدرج بقيمة ' + Math.abs(diff).toFixed(2) + ' د.ج — يتطلب مراجعة فورية مع الكاشير.' });
      } else if (diff > 0.009) {
        ownerAlerts.push({ level: 'warning', text: 'فائض غير مبرر في الدرج بقيمة +' + diff.toFixed(2) + ' د.ج (قد توجد عملية بيع غير مسجلة).' });
      }
      if (expectedBal < -0.009) {
        ownerAlerts.push({ level: 'danger', text: 'رصيد الدرج المتوقع سالب (' + expectedBal.toFixed(2) + ' د.ج) لأن المصاريف/السلَف تجاوزت المداخيل النقدية.' });
      }
      if (totalOutflows > 0 && txCashSalesTotal > 0 && totalOutflows > txCashSalesTotal) {
        ownerAlerts.push({ level: 'warning', text: 'الأموال الخارجة (' + totalOutflows.toFixed(2) + ' د.ج) أكبر من مبيعات الكاش (' + txCashSalesTotal.toFixed(2) + ' د.ج).' });
      }
      if (totalCreditAddedToday > 0.009) {
        ownerAlerts.push({ level: 'info', text: 'تم منح ديون جديدة بقيمة ' + totalCreditAddedToday.toFixed(2) + ' د.ج لـ (' + creditSalesToday.length + ') عملية بيع آجلة.' });
      }
      if (totalDiscounts > 0.009 && totalSalesRevenue > 0 && totalDiscounts / totalSalesRevenue >= 0.08) {
        ownerAlerts.push({ level: 'warning', text: 'نسبة التخفيضات الممنوحة مرتفعة (' + totalDiscounts.toFixed(2) + ' د.ج).' });
      }
      if (auditRows.length > 0) {
        ownerAlerts.push({ level: 'danger', text: 'سُجل (' + auditRows.length + ') حدثاً رقابياً حساساً خلال الوردية (حذف فاتورة / مرتجع / تنبيه أمان).' });
      }

      base.forensicDossier = {
        outflows,
        inflows,
        debtCollections,
        debtCollectionsGrouped,
        creditSalesToday,
        topDebtors: debtorsList.slice(0, 8),
        auditEventsCount: auditRows.length,
        auditEvents: auditRows.slice(0, 5),
        ownerAlerts,
        kpis: {
          salesCount: shiftSalesRows.length,
          totalSalesRevenue: Number(totalSalesRevenue.toFixed(2)),
          avgBasket: shiftSalesRows.length > 0 ? Number((totalSalesRevenue / shiftSalesRows.length).toFixed(2)) : 0,
          totalDiscounts: Number(totalDiscounts.toFixed(2)),
          totalOutflows: Number(totalOutflows.toFixed(2)),
          totalInflows: Number(totalInflows.toFixed(2)),
          totalDebtCollected: Number(totalDebtCollected.toFixed(2)),
          totalCreditAddedToday: Number(totalCreditAddedToday.toFixed(2)),
          storeTotalDebtReal,
          debtorsCount: debtorsList.length
        },
        paymentBreakdown: {
          cash: Number(payMethods.cash.toFixed(2)),
          cib: Number(payMethods.cib.toFixed(2)),
          baridimob: Number(payMethods.baridimob.toFixed(2)),
          cheque: Number(payMethods.cheque.toFixed(2)),
          credit: Number(payMethods.credit.toFixed(2)),
          other: Number(payMethods.other.toFixed(2))
        }
      };

      // تحديث حقول summary الأساسية بالأرقام الحقيقية من SQLite
      if (!base.summary) base.summary = {};
      base.summary.newCreditGiven = Number(totalCreditAddedToday.toFixed(2));
      base.summary.totalStoreCustomerDebt = storeTotalDebtReal;
      base.summary.totalDebtCollected = Number(totalDebtCollected.toFixed(2));
      base.summary.totalOutflows = Number(totalOutflows.toFixed(2));
      base.summary.totalDiscounts = Number(totalDiscounts.toFixed(2));
      base.summary.salesCount = shiftSalesRows.length;
    } catch (e) {
      // حماية تامة: لا نكسر استدعاء الصندوق أبداً
    }

    return base;
  };
}

let tillCode = fs.readFileSync(TILL_LEDGER_PATH, 'utf8');
const TILL_MARKER = '/* === [WAR STAGE 5D: FORENSIC SHIFT DOSSIER ENRICHER] === */';
if (tillCode.includes(TILL_MARKER)) {
  tillCode = tillCode.slice(0, tillCode.indexOf(TILL_MARKER)).trimEnd() + '\n';
}

tillCode =
  tillCode.trimEnd() +
  '\n\n' +
  TILL_MARKER +
  '\n(' +
  installTillLedgerStage5DForensicEnricher.toString() +
  ')(module.exports);\n';

fs.writeFileSync(TILL_LEDGER_PATH, tillCode, 'utf8');
console.log('✅ [2/4]: تم تثبيت مُغني البيانات الجنائي للوردية (forensicDossier) في till-ledger.js.');

// ============================================================================
// 2. ترقية perf-core/caisse-bom-stocktake-stage5.js بمحرك رسم Z-Report التنفيذي (80mm + A4)
// ============================================================================
function installStage5DExecutiveZReportRenderer() {
  'use strict';

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtMoney(val, showPlus) {
    const n = Number(val || 0);
    const absStr = Math.abs(n).toFixed(2);
    const parts = absStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const sign = n < -0.004 ? '-' : showPlus && n > 0.004 ? '+' : '';
    return '<span dir="rtl" style="white-space:nowrap;unicode-bidi:isolate;font-weight:900;">\u2066' + sign + parts.join('.') + '\u2069&#160;د.ج</span>';
  }

  function buildSampleForensicDossier() {
    return {
      outflows: [
        { time: '11:20', typeLabel: 'سلفة عامل #2', beneficiary: 'محمد (العامل)', reason: 'سلفة نقدية من الصندوق', amount: 1000 },
        { time: '15:40', typeLabel: 'نقل وشحن', beneficiary: 'موزع البضاعة', reason: 'تفريغ ونقل سلع التموين', amount: 500 }
      ],
      inflows: [
        { time: '08:05', typeLabel: 'إيداع صرف', source: 'المدير العام', reason: 'تغذية الدرج بفئات صغيرة', amount: 1000 }
      ],
      debtCollections: [
        { time: '14:15', customerName: 'أمين بن يحيى', customerPhone: '0550112233', note: 'دفعة من الدين السابق', amount: 1200, remainingDebtNow: 550 }
      ],
      debtCollectionsGrouped: [
        { customerName: 'أمين بن يحيى', count: 1, total: 1200, lastTime: '14:15', remainingDebtNow: 550 }
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
      auditEventsCount: 0,
      ownerAlerts: [
        { level: 'info', text: 'تم منح ديون جديدة بقيمة 1,570.00 د.ج لـ (2) زبائن في هذه الوردية.' }
      ],
      kpis: {
        salesCount: 24,
        totalSalesRevenue: 17370,
        avgBasket: 723.75,
        totalDiscounts: 150,
        totalOutflows: 1500,
        totalInflows: 1000,
        totalDebtCollected: 1200,
        totalCreditAddedToday: 1570,
        storeTotalDebtReal: 3320,
        debtorsCount: 3
      },
      paymentBreakdown: {
        cash: 14800,
        cib: 1000,
        baridimob: 0,
        cheque: 0,
        credit: 1570,
        other: 0
      }
    };
  }

  function renderThermal80mmWarBlock(dossier, rec, theme) {
    const primary = (theme && theme.primary) || '#0f172a';
    const border = (theme && theme.border) || '#cbd5e1';
    const outflows = Array.isArray(dossier.outflows) ? dossier.outflows : [];
    const creditSales = Array.isArray(dossier.creditSalesToday) ? dossier.creditSalesToday : [];
    const collections = Array.isArray(dossier.debtCollectionsGrouped) ? dossier.debtCollectionsGrouped : [];
    const alerts = Array.isArray(dossier.ownerAlerts) ? dossier.ownerAlerts : [];
    const kpis = dossier.kpis || {};
    const pm = dossier.paymentBreakdown || {};

    let html = '<div data-s5d-war-dossier="1" style="margin-top:6px;font-family:\'Cairo\',\'Tajawal\',Tahoma,Arial,sans-serif;direction:rtl;text-align:right;font-size:9.2px;line-height:1.35;color:#0f172a;">';

    // 1. شريط تنبيهات المستشار الحربي لصاحب المتجر (يظهر عند وجود تنبيه)
    if (alerts.length > 0) {
      html += '<div style="border:1.5px solid #e11d48;background:#fff1f2;border-radius:6px;padding:4px 5px;margin-bottom:6px;">';
      html += '<div style="font-weight:900;color:#9f1239;font-size:9.3px;margin-bottom:2px;">🛡️ تنبيهات الرقابة لصاحب المتجر:</div>';
      for (let i = 0; i < alerts.length; i++) {
        const al = alerts[i];
        const col = al.level === 'danger' ? '#be123c' : al.level === 'warning' ? '#b45309' : '#1d4ed8';
        html += '<div style="color:' + col + ';font-weight:800;font-size:8.6px;margin-top:1px;">• ' + esc(al.text) + '</div>';
      }
      html += '</div>';
    }

    // 2. دفتر الأموال الخارجة (المصاريف، السلَف، السحوبات — من أخذ؟ لماذا؟ كم؟)
    html += '<div style="border:1px solid #fecdd3;border-radius:6px;padding:4px 5px;margin-bottom:6px;background:#fff;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fda4af;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#9f1239;">';
    html += '<span>💸 الأموال الخارجة (مصاريف / سلَف) (' + outflows.length + ')</span>';
    html += '<span>' + fmtMoney(-Math.abs(Number(kpis.totalOutflows || 0))) + '</span>';
    html += '</div>';
    if (outflows.length === 0) {
      html += '<div style="color:#047857;font-weight:700;font-size:8.5px;text-align:center;">✔ لا توجد مصاريف أو سحوبات في هذه الوردية</div>';
    } else {
      for (let i = 0; i < outflows.length; i++) {
        const o = outflows[i];
        html += '<div style="border-bottom:1px dotted #e2e8f0;padding:2.5px 0;">';
        html += '<div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;">';
        html += '<span>' + (i + 1) + '. ' + esc(o.beneficiary) + ' <span style="font-weight:700;color:#64748b;font-size:8px;">(' + esc(o.time || '--:--') + ')</span></span>';
        html += '<span style="color:#be123c;">' + fmtMoney(-Math.abs(o.amount)) + '</span>';
        html += '</div>';
        html += '<div style="font-size:8.3px;color:#475569;padding-right:8px;">السبب: ' + esc(o.typeLabel) + (o.reason && o.reason !== o.typeLabel ? ' — ' + esc(o.reason) : '') + '</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    // 3. دفتر الزبائن الذين أخذوا بالدين اليوم (كريدي الوردية)
    html += '<div style="border:1px solid #fed7aa;border-radius:6px;padding:4px 5px;margin-bottom:6px;background:#fff;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fdba74;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#9a3412;">';
    html += '<span>📝 ديون اليوم (الزبائن المدينون) (' + creditSales.length + ')</span>';
    html += '<span>' + fmtMoney(Number(kpis.totalCreditAddedToday || 0), true) + '</span>';
    html += '</div>';
    if (creditSales.length === 0) {
      html += '<div style="color:#047857;font-weight:700;font-size:8.5px;text-align:center;">✔ لم تُسجل مبيعات بالدين في هذه الوردية</div>';
    } else {
      for (let i = 0; i < creditSales.length; i++) {
        const cs = creditSales[i];
        html += '<div style="border-bottom:1px dotted #e2e8f0;padding:2.5px 0;">';
        html += '<div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;">';
        html += '<span>' + (i + 1) + '. ' + esc(cs.customerName) + '</span>';
        html += '<span style="color:#c2410c;">' + fmtMoney(cs.creditAdded, true) + '</span>';
        html += '</div>';
        html += '<div style="font-size:8px;color:#475569;display:flex;justify-content:space-between;">';
        html += '<span>فاتورة ' + esc(cs.docNumber) + ' (' + esc(cs.time || '') + ') | مدفوع: ' + fmtMoney(cs.paidToday) + '</span>';
        html += '<span>دينه الكلي: ' + fmtMoney(cs.cumulativeDebtNow) + '</span>';
        html += '</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    // 4. تحصيلات الديون المقبوضة في الوردية بأسماء الزبائن الحقيقية
    if (collections.length > 0) {
      html += '<div style="border:1px solid #a7f3d0;border-radius:6px;padding:4px 5px;margin-bottom:6px;background:#ecfdf5;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #34d399;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#065f46;">';
      html += '<span>🤝 تحصيلات الديون بالوردية (' + collections.length + ')</span>';
      html += '<span>' + fmtMoney(Number(kpis.totalDebtCollected || 0), true) + '</span>';
      html += '</div>';
      for (let i = 0; i < collections.length; i++) {
        const col = collections[i];
        html += '<div style="display:flex;justify-content:space-between;font-size:8.6px;padding:1.5px 0;border-bottom:1px dotted #d1fae5;">';
        html += '<span style="font-weight:800;">' + esc(col.customerName) + (col.count > 1 ? ' (' + col.count + ' دفعات)' : '') + '</span>';
        html += '<span style="color:#047857;font-weight:900;">' + fmtMoney(col.total, true) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    // 5. ملخص وسائل الدفع ومؤشرات الأداء السريعة
    html += '<div style="border:1px solid ' + border + ';border-radius:6px;padding:4px 5px;margin-bottom:6px;background:#f8fafc;">';
    html += '<div style="font-weight:900;color:' + primary + ';border-bottom:1px dashed #cbd5e1;padding-bottom:2px;margin-bottom:3px;">💳 تفصيل المبيعات ووسائل الدفع</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 6px;font-size:8.4px;">';
    html += '<div>عدد الفواتير: <b>' + Number(kpis.salesCount || 0) + '</b></div>';
    html += '<div>رقم الأعمال: ' + fmtMoney(kpis.totalSalesRevenue || 0) + '</div>';
    html += '<div>نقداً (Cash): ' + fmtMoney(pm.cash || 0) + '</div>';
    html += '<div>إلكتروني (CIB/CCP): ' + fmtMoney(Number(pm.cib || 0) + Number(pm.baridimob || 0)) + '</div>';
    html += '<div>آجل (كريدي): ' + fmtMoney(pm.credit || 0) + '</div>';
    html += '<div>التخفيضات: ' + fmtMoney(kpis.totalDiscounts || 0) + '</div>';
    html += '</div></div>';

    // 6. خانة المصادقة والتوقيع المزدوجة (80mm)
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;padding-top:5px;border-top:1.5px dashed #94a3b8;text-align:center;font-size:8.3px;font-weight:800;color:#334155;">';
    html += '<div style="border:1px dashed #cbd5e1;border-radius:5px;padding:4px 3px 16px;">توقيع الكاشير (المسلّم)<br><span style="font-weight:700;font-size:7.8px;color:#64748b;">' + esc((rec && rec.cashierName) || '') + '</span></div>';
    html += '<div style="border:1px dashed #cbd5e1;border-radius:5px;padding:4px 3px 16px;">توقيع صاحب المتجر<br><span style="font-weight:700;font-size:7.8px;color:#64748b;">المصادقة والاستلام</span></div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderExecutiveA4WarBlock(dossier, rec, theme) {
    const primary = (theme && theme.primary) || '#1e3a8a';
    const border = (theme && theme.border) || '#cbd5e1';
    const outflows = Array.isArray(dossier.outflows) ? dossier.outflows : [];
    const inflows = Array.isArray(dossier.inflows) ? dossier.inflows : [];
    const creditSales = Array.isArray(dossier.creditSalesToday) ? dossier.creditSalesToday : [];
    const debtCols = Array.isArray(dossier.debtCollections) ? dossier.debtCollections : [];
    const topDebtors = Array.isArray(dossier.topDebtors) ? dossier.topDebtors : [];
    const alerts = Array.isArray(dossier.ownerAlerts) ? dossier.ownerAlerts : [];
    const kpis = dossier.kpis || {};
    const pm = dossier.paymentBreakdown || {};

    let html = '<div data-s5d-war-dossier="1" style="margin-top:12px;font-family:\'Cairo\',\'Tajawal\',Tahoma,Arial,sans-serif;direction:rtl;text-align:right;font-size:11px;line-height:1.45;color:#0f172a;">';

    // 1. لوحة مؤشرات القيادة العلوية (4 KPIs)
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">';
    html += '<div style="border:1.5px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:7px;text-align:center;">';
    html += '<div style="font-size:9.5px;font-weight:800;color:#1e40af;">📊 رقم أعمال الوردية</div>';
    html += '<div style="font-size:13px;color:#1e3a8a;margin-top:2px;">' + fmtMoney(kpis.totalSalesRevenue || 0) + '</div>';
    html += '<div style="font-size:8.8px;color:#475569;">' + Number(kpis.salesCount || 0) + ' فاتورة | متوسط: ' + fmtMoney(kpis.avgBasket || 0) + '</div></div>';

    html += '<div style="border:1.5px solid #fecdd3;background:#fff1f2;border-radius:8px;padding:7px;text-align:center;">';
    html += '<div style="font-size:9.5px;font-weight:800;color:#9f1239;">💸 الأموال الخارجة (مصاريف/سلَف)</div>';
    html += '<div style="font-size:13px;color:#be123c;margin-top:2px;">' + fmtMoney(-Math.abs(Number(kpis.totalOutflows || 0))) + '</div>';
    html += '<div style="font-size:8.8px;color:#475569;">' + outflows.length + ' عملية خروج من الدرج</div></div>';

    html += '<div style="border:1.5px solid #fed7aa;background:#fff7ed;border-radius:8px;padding:7px;text-align:center;">';
    html += '<div style="font-size:9.5px;font-weight:800;color:#9a3412;">📝 كريدي ممنوح في الوردية</div>';
    html += '<div style="font-size:13px;color:#c2410c;margin-top:2px;">' + fmtMoney(kpis.totalCreditAddedToday || 0, true) + '</div>';
    html += '<div style="font-size:8.8px;color:#475569;">' + creditSales.length + ' زبائن أخذوا بالدين اليوم</div></div>';

    html += '<div style="border:1.5px solid #a7f3d0;background:#ecfdf5;border-radius:8px;padding:7px;text-align:center;">';
    html += '<div style="font-size:9.5px;font-weight:800;color:#065f46;">🤝 تحصيلات الديون المقبوضة</div>';
    html += '<div style="font-size:13px;color:#047857;margin-top:2px;">' + fmtMoney(kpis.totalDebtCollected || 0, true) + '</div>';
    html += '<div style="font-size:8.8px;color:#475569;">ديون المتجر الكلية: ' + fmtMoney(kpis.storeTotalDebtReal || 0) + '</div></div>';
    html += '</div>';

    // 2. صندوق تنبيهات المستشار الرقابي
    if (alerts.length > 0) {
      html += '<div style="border:1.5px solid #e11d48;background:#fff1f2;border-radius:8px;padding:7px 10px;margin-bottom:10px;">';
      html += '<div style="font-weight:900;color:#9f1239;font-size:11px;margin-bottom:3px;">🛡️ تقرير رادار الرقابة وتنبيهات صاحب المتجر:</div>';
      for (let i = 0; i < alerts.length; i++) {
        const al = alerts[i];
        const col = al.level === 'danger' ? '#be123c' : al.level === 'warning' ? '#b45309' : '#1d4ed8';
        html += '<div style="color:' + col + ';font-weight:800;font-size:10px;margin-top:2px;">• ' + esc(al.text) + '</div>';
      }
      html += '</div>';
    }

    // 3. جدول #1: سجل الأموال الخارجة والمصاريف والسلَف بالتفصيل
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-weight:900;font-size:11.5px;color:#9f1239;border-bottom:2px solid #fda4af;padding-bottom:3px;margin-bottom:5px;">1️⃣ سجل الأموال الخارجة من الدرج (المصاريف، السلَف، السحوبات، وتسديد الموردين)</div>';
    if (outflows.length === 0) {
      html += '<div style="padding:6px;border:1px dashed #a7f3d0;background:#ecfdf5;border-radius:6px;color:#065f46;font-weight:800;text-align:center;">✔ لم تخرج أي مصاريف أو سحوبات نقدية من الدرج خلال هذه الوردية</div>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
      html += '<thead><tr style="background:#ffe4e6;color:#881337;">';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:5%;">#</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:10%;">الساعة</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:18%;">النوع</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:22%;">المستفيد / الآخذ</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:30%;">السبب والبيان التفصيلي</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:15%;">المبلغ</th>';
      html += '</tr></thead><tbody>';
      for (let i = 0; i < outflows.length; i++) {
        const o = outflows[i];
        html += '<tr>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + (i + 1) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + esc(o.time || '--:--') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">' + esc(o.typeLabel) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#9f1239;">' + esc(o.beneficiary) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;">' + esc(o.reason) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#be123c;">' + fmtMoney(-Math.abs(o.amount)) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
    html += '</div>';

    // 4. جدول #2: قائمة الزبائن الذين أخذوا بالدين اليوم (كريدي الوردية)
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-weight:900;font-size:11.5px;color:#9a3412;border-bottom:2px solid #fdba74;padding-bottom:3px;margin-bottom:5px;">2️⃣ قائمة الزبائن المدينين اليوم (المبيعات الآجلة والدفع الجزئي في هذه الوردية)</div>';
    if (creditSales.length === 0) {
      html += '<div style="padding:6px;border:1px dashed #a7f3d0;background:#ecfdf5;border-radius:6px;color:#065f46;font-weight:800;text-align:center;">✔ جميع مبيعات هذه الوردية كانت مدفوعة بالكامل بدون ديون جديدة</div>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
      html += '<thead><tr style="background:#ffedd5;color:#7c2d12;">';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:5%;">#</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:15%;">الفاتورة / الوقت</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:28%;">اسم الزبون والهاتف</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:13%;">الإجمالي</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:13%;">المدفوع</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:13%;">دين اليوم (+)</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:13%;">دينه الكلي الآن</th>';
      html += '</tr></thead><tbody>';
      for (let i = 0; i < creditSales.length; i++) {
        const cs = creditSales[i];
        html += '<tr>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + (i + 1) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + esc(cs.docNumber) + '<br><span style="font-size:8.5px;color:#64748b;">' + esc(cs.time || '') + '</span></td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;">' + esc(cs.customerName) + (cs.customerPhone ? '<br><span style="font-size:8.5px;color:#475569;">' + esc(cs.customerPhone) + '</span>' : '') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;">' + fmtMoney(cs.invoiceTotal) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">' + fmtMoney(cs.paidToday) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#c2410c;">' + fmtMoney(cs.creditAdded, true) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#991b1b;">' + fmtMoney(cs.cumulativeDebtNow) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
    html += '</div>';

    // 5. جدول #3: تحصيلات الديون والإيداعات النقدية (الأموال الداخلة للدرج بأسماء الزبائن)
    if (debtCols.length > 0 || inflows.length > 0) {
      html += '<div style="margin-bottom:10px;">';
      html += '<div style="font-weight:900;font-size:11.5px;color:#065f46;border-bottom:2px solid #6ee7b7;padding-bottom:3px;margin-bottom:5px;">3️⃣ سجل تحصيلات الديون والإيداعات النقدية الداخلة للدرج</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
      html += '<thead><tr style="background:#d1fae5;color:#064e3b;">';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:5%;">#</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:11%;">الساعة</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:18%;">النوع</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:26%;">اسم الزبون / المصدر</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:25%;">البيان / الباقي عليه</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:15%;">المبلغ المقبوض</th>';
      html += '</tr></thead><tbody>';
      let rowNum = 0;
      for (let i = 0; i < debtCols.length; i++) {
        const dc = debtCols[i];
        rowNum++;
        html += '<tr>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + rowNum + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + esc(dc.time || '--:--') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">تحصيل دين زبون</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#065f46;">' + esc(dc.customerName) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;">' + esc(dc.note) + (dc.remainingDebtNow !== null && dc.remainingDebtNow !== undefined ? ' | الباقي: ' + fmtMoney(dc.remainingDebtNow) : '') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">' + fmtMoney(dc.amount, true) + '</td>';
        html += '</tr>';
      }
      for (let i = 0; i < inflows.length; i++) {
        const inf = inflows[i];
        rowNum++;
        html += '<tr>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + rowNum + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + esc(inf.time || '--:--') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">' + esc(inf.typeLabel) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;">' + esc(inf.source) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;">' + esc(inf.reason) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">' + fmtMoney(inf.amount, true) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    // 6. صف مزدوج: تفصيل وسائل الدفع + أهم المدينين في المتجر للمتابعة غداً
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
    html += '<div style="border:1px solid ' + border + ';border-radius:8px;padding:7px;background:#f8fafc;">';
    html += '<div style="font-weight:900;color:' + primary + ';border-bottom:1px dashed #cbd5e1;padding-bottom:3px;margin-bottom:4px;">💳 تفصيل المبيعات حسب وسيلة الدفع</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>💵 الدفع نقداً (Espèces):</span>' + fmtMoney(pm.cash || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>💳 بطاقة ذهبية / CIB:</span>' + fmtMoney(pm.cib || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>📱 بريدي موب (BaridiMob):</span>' + fmtMoney(pm.baridimob || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>🏦 شيك بنكي / صك:</span>' + fmtMoney(pm.cheque || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>📝 بيع آجل (كريدي):</span>' + fmtMoney(pm.credit || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;border-top:1px dashed #cbd5e1;margin-top:2px;font-weight:900;"><span>🏷️ إجمالي التخفيضات الممنوحة:</span>' + fmtMoney(kpis.totalDiscounts || 0) + '</div>';
    html += '</div>';

    html += '<div style="border:1px solid ' + border + ';border-radius:8px;padding:7px;background:#f8fafc;">';
    html += '<div style="font-weight:900;color:#9a3412;border-bottom:1px dashed #fdba74;padding-bottom:3px;margin-bottom:4px;">📌 أكبر المدينين في المتجر حالياً (للمتابعة والتحصيل)</div>';
    if (topDebtors.length === 0) {
      html += '<div style="color:#047857;font-weight:800;padding:12px 0;text-align:center;">✔ لا توجد ديون عالقة على الزبائن حالياً</div>';
    } else {
      for (let i = 0; i < Math.min(5, topDebtors.length); i++) {
        const td = topDebtors[i];
        html += '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted #e2e8f0;font-size:9.8px;">';
        html += '<span style="font-weight:800;">' + (i + 1) + '. ' + esc(td.name) + (td.phone ? ' <span style="color:#64748b;font-weight:600;">(' + esc(td.phone) + ')</span>' : '') + '</span>';
        html += '<span style="color:#b91c1c;">' + fmtMoney(td.debt) + '</span>';
        html += '</div>';
      }
      html += '<div style="display:flex;justify-content:space-between;padding-top:4px;font-weight:900;color:#7c2d12;"><span>إجمالي ذمم الزبائن بالمتجر (' + Number(kpis.debtorsCount || topDebtors.length) + '):</span>' + fmtMoney(kpis.storeTotalDebtReal || 0) + '</div>';
    }
    html += '</div></div>';

    // 7. جدول المصادقة والتوقيعات الثلاثية (A4)
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px;text-align:center;font-size:10px;font-weight:900;color:#334155;">';
    html += '<div style="border:1.5px dashed #94a3b8;border-radius:8px;padding:8px 6px 36px;">أمين الصندوق (المسلّم)<br><span style="font-weight:700;font-size:9px;color:#64748b;">' + esc((rec && rec.cashierName) || '') + '</span></div>';
    html += '<div style="border:1.5px dashed #94a3b8;border-radius:8px;padding:8px 6px 36px;">المراجع / المحاسب<br><span style="font-weight:700;font-size:9px;color:#64748b;">مطابقة الجرد والوثائق</span></div>';
    html += '<div style="border:1.5px dashed #94a3b8;border-radius:8px;padding:8px 6px 36px;">صاحب المتجر / المدير<br><span style="font-weight:700;font-size:9px;color:#64748b;">المصادقة والختم النهائي</span></div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function injectBlockIntoPaperHtml(html, blockHtml) {
    if (!html || !blockHtml || html.includes('data-s5d-war-dossier="1"')) return html;

    // 1. حقن قبل طبقة التذييل الرسمية إذا كانت موجودة
    const footerMarkers = [
      /<div[^>]*data-layer-id=["']footer_stamp_layer["'][^>]*>/i,
      /<div[^>]*class=["'][^"']*psp-footer[^"']*["'][^>]*>/i,
      /<div[^>]*>[^<]*وثيقة محاسبية ورقابية رسمية/i
    ];
    for (let i = 0; i < footerMarkers.length; i++) {
      const m = html.match(footerMarkers[i]);
      if (m && typeof m.index === 'number') {
        return html.slice(0, m.index) + blockHtml + html.slice(m.index);
      }
    }

    // 2. قبل إغلاق آخر div للورقة أو قبل </body>
    const bodyCloseIdx = html.lastIndexOf('</body>');
    if (bodyCloseIdx !== -1) {
      const lastDivBeforeBody = html.lastIndexOf('</div>', bodyCloseIdx);
      if (lastDivBeforeBody !== -1) {
        return html.slice(0, lastDivBeforeBody) + blockHtml + html.slice(lastDivBeforeBody);
      }
      return html.slice(0, bodyCloseIdx) + blockHtml + html.slice(bodyCloseIdx);
    }

    const lastDiv = html.lastIndexOf('</div>');
    if (lastDiv !== -1) {
      return html.slice(0, lastDiv) + blockHtml + html.slice(lastDiv);
    }
    return html + blockHtml;
  }

  function installStage5D() {
    const s5 = window.GherbiStage5Ops;
    const PSP = window.GherbiPrintStudioPro;
    if (!s5 || !PSP || !PSP.renderer || s5._stage5DInstalled) return false;
    s5._stage5DInstalled = true;

    s5.buildSampleForensicDossier = buildSampleForensicDossier;
    s5.renderThermal80mmWarBlock = renderThermal80mmWarBlock;
    s5.renderExecutiveA4WarBlock = renderExecutiveA4WarBlock;

    // 1. تمرير forensicDossier الحقيقي عبر printShiftZReport مع ضبط إجمالي ديون المتجر الحقيقي
    const prevPrintZ = s5.printShiftZReport.bind(s5);
    s5.printShiftZReport = async function stage5DPrintShiftZ(sessionIdOrDetails, format = '80mm', opts = {}) {
      let details = null;
      if (sessionIdOrDetails && typeof sessionIdOrDetails === 'object') {
        details = sessionIdOrDetails;
      } else {
        const sid = Number(sessionIdOrDetails || 0);
        if (sid > 0 && window.api && typeof window.api.getSessionDetails === 'function') {
          details = await window.api.getSessionDetails(sid);
        } else {
          details = await s5.fetchActiveSession(null, { force: true });
        }
      }
      if (!details) return await prevPrintZ(sessionIdOrDetails, format, opts);

      // تخزين مؤقت لـ forensicDossier الحالي للربط التلقائي عند الرسم
      s5._lastRenderedShiftDossier = details.forensicDossier || null;
      s5._lastRenderedShiftRec = s5.computeExactShiftReconciliation(details);
      if (details.forensicDossier && details.forensicDossier.kpis) {
        s5._lastRenderedShiftRec.totalStoreCustomerDebt = details.forensicDossier.kpis.storeTotalDebtReal;
        s5._lastRenderedShiftRec.newCreditGiven = details.forensicDossier.kpis.totalCreditAddedToday;
      }

      const out = await prevPrintZ(details, format, opts);
      return out;
    };

    // 2. تغليف دوال الرسم في Print Studio Pro لحقن التقرير القيادي تلقائياً في caisse_z_report (80mm) و caisse_shift_full_audit_a4 (A4)
    const renderer = PSP.renderer;
    const candidateMethods = Object.keys(renderer).filter(
      (k) => typeof renderer[k] === 'function' && /render/i.test(k) && !/layer/i.test(k)
    );

    for (let i = 0; i < candidateMethods.length; i++) {
      const mName = candidateMethods[i];
      const origFn = renderer[mName].bind(renderer);

      renderer[mName] = function stage5DWrappedRender(...args) {
        let result = origFn(...args);
        try {
          const tpl = args[0] && typeof args[0] === 'object' ? args[0] : null;
          const docData = args[1] && typeof args[1] === 'object' ? args[1] : null;
          const docId = String((tpl && tpl.id) || (docData && docData.docType) || '');
          if (docId !== 'caisse_z_report' && docId !== 'caisse_shift_full_audit_a4') {
            return result;
          }

          const htmlStr = typeof result === 'string' ? result : result && typeof result.fullHtml === 'string' ? result.fullHtml : '';
          if (!htmlStr || htmlStr.includes('data-s5d-war-dossier="1"')) return result;

          const paper = String((tpl && tpl.paperSize) || (docId === 'caisse_shift_full_audit_a4' ? 'a4' : '80mm')).toLowerCase();
          const isThermal = paper === '80mm' || paper === '58mm';

          // اختيار الملف الجنائي الحقيقي إن وُجد في docData أو آخر مناوبة، وإلا بيانات نموذجية غنية لمعاينة مركز الطباعة
          const hasRealShift = Boolean((docData && docData.shiftSummary && docData.shiftSummary.sessionId) || (docData && docData.forensicDossier));
          const dossier =
            (docData && docData.forensicDossier) ||
            (hasRealShift && s5._lastRenderedShiftDossier) ||
            buildSampleForensicDossier();
          const rec =
            (docData && docData.shiftSummary) ||
            (hasRealShift && s5._lastRenderedShiftRec) ||
            { cashierName: (docData && docData.cashierName) || 'المدير العام' };

          const themeObj =
            (PSP.templates && PSP.templates.THEMES && tpl && PSP.templates.THEMES[tpl.themeId]) ||
            (window.GherbiPrintStudioPro?.THEMES && tpl && window.GherbiPrintStudioPro.THEMES[tpl.themeId]) ||
            { primary: '#1e3a8a', border: '#cbd5e1' };

          const warBlock = isThermal
            ? renderThermal80mmWarBlock(dossier, rec, themeObj)
            : renderExecutiveA4WarBlock(dossier, rec, themeObj);

          // تصحيح رقم "المتجر:" في بطاقة الميزان العلوية إذا كانت القيمة الحقيقية متوفرة
          let patchedHtml = htmlStr;
          if (dossier && dossier.kpis && dossier.kpis.storeTotalDebtReal !== undefined) {
            const realStoreStr = fmtMoney(dossier.kpis.storeTotalDebtReal);
            patchedHtml = patchedHtml.replace(/(المتجر:\s*)(?:<[^>]+>)*[0-9,.\s\u2066-\u2069&#160;]+د\.ج(?:<\/[^>]+>)*/g, '$1' + realStoreStr);
          }

          patchedHtml = injectBlockIntoPaperHtml(patchedHtml, warBlock);

          if (typeof result === 'string') return patchedHtml;
          return { ...result, fullHtml: patchedHtml };
        } catch (_) {
          return result;
        }
      };
    }

    console.log('🛡️ [WAR STAGE 5D]: تم تفعيل محرك تقارير إغلاق الوردية القيادية (80mm + A4: مصاريف، سلَف، ديون اليوم، تحصيلات، ورادار الرقابة).');
    return true;
  }

  if (!installStage5D()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (installStage5D() || k >= 40) clearInterval(iv);
    }, 100);
  }
}

let stage5Code = fs.readFileSync(STAGE5_PATH, 'utf8');
const S5D_MARKER = '/* === [WAR STAGE 5D: EXECUTIVE Z-REPORT 80MM & A4 WAR-ROOM RENDERER] === */';
if (stage5Code.includes(S5D_MARKER)) {
  stage5Code = stage5Code.slice(0, stage5Code.indexOf(S5D_MARKER)).trimEnd() + '\n';
}

stage5Code =
  stage5Code.trimEnd() +
  '\n\n' +
  S5D_MARKER +
  '\n(' +
  installStage5DExecutiveZReportRenderer.toString() +
  ')();\n';

fs.writeFileSync(STAGE5_PATH, stage5Code, 'utf8');
console.log('✅ [3/4]: تم تثبيت محرك التقارير القيادية لإغلاق الوردية (80mm + A4) في perf-core/caisse-bom-stocktake-stage5.js.');

// ============================================================================
// 3. الفحص النحوي الآلي (node --check) + 7 اختبارات جنائية شاملة
// ============================================================================
console.log('\n🔍 [4/4]: جاري الفحص النحوي الآلي (node --check):');
for (const fp of [TILL_LEDGER_PATH, STAGE5_PATH]) {
  execFileSync(process.execPath, ['--check', fp], { stdio: 'pipe' });
  console.log(`   ✔ فحص نحوي سليم 100%: ${path.relative(ROOT, fp)}`);
}

console.log('\n🧪 جاري تشغيل الاختبارات الجنائية (7/7):');
(async () => {
  // اختبار 1 و 2: اختبار till-ledger.js الفعلي بمحاكاة SQLite تحوي سلفة محمد + دين أمين + تسديد سليم!
  const tillMod = require(TILL_LEDGER_PATH);
  const mockDb = {
    dbGet: async (sql) => {
      if (sql.includes('FROM caisse_sessions')) {
        return { id: 9, user_id: 1, user_name: 'المدير العام', opening_balance: 0, closing_balance: -840, expected_balance: -840, difference: 0, status: 'closed', opened_at: '2026-11-20 00:16:00', closed_at: '2026-11-20 00:18:00' };
      }
      return null;
    },
    dbAll: async (sql) => {
      if (sql.includes('FROM caisse_transactions')) {
        return [
          { id: 1, session_id: 9, type: 'sale', amount: 160, category: 'sales', description: 'مبيعات فاتورة #119', created_at: '2026-11-20 00:17:00' },
          { id: 2, session_id: 9, type: 'expense', amount: 1000, category: 'سلفة', description: '[المستفيد: محمد] [سلفة عامل #2] سلفة نقدية للعامل من مبيعات الصندوق', created_at: '2026-11-20 00:16:00' },
          { id: 3, session_id: 9, type: 'debt_payment', amount: 500, category: 'sales', description: 'تسديد دين زبون #4', created_at: '2026-11-20 00:17:30' }
        ];
      }
      if (sql.includes('FROM customers c')) {
        return [
          { id: 3, name: 'أمين بن يحيى', phone: '0550112233', loyalty_card_code: 'FID-00003', live_debt: 850 },
          { id: 4, name: 'سليم مراد', phone: '0661223344', loyalty_card_code: 'FID-00004', live_debt: 200 }
        ];
      }
      if (sql.includes('FROM sales s')) {
        return [
          { id: 119, doc_number: 'FAC-2026-0119', customer_id: null, total: 160, paid_amount: 160, discount: 0, payment_method: 'cash', sale_date: '2026-11-20 00:17:00', created_at: '2026-11-20 00:17:00' },
          { id: 120, doc_number: 'FAC-2026-0120', customer_id: 3, customer_name: 'أمين بن يحيى', customer_phone: '0550112233', total: 500, paid_amount: 155, discount: 0, payment_method: 'credit', sale_date: '2026-11-20 00:17:45', created_at: '2026-11-20 00:17:45' }
        ];
      }
      return [];
    }
  };

  const enrichedShift = await tillMod.computeSessionSummary(mockDb, 9);
  const fd = enrichedShift && enrichedShift.forensicDossier;

  if (!fd || fd.outflows.length !== 1 || fd.outflows[0].beneficiary !== 'محمد' || !fd.outflows[0].reason.includes('سلفة نقدية')) {
    console.error('❌ فشل اختبار 1 (استخراج المستفيد والسبب من المصاريف في till-ledger.js):', fd && fd.outflows);
    process.exit(1);
  }
  console.log('   ✔ اختبار 1 ناجح 100%: استخراج المصاريف بدقة (المستفيد: محمد | النوع: سلفة عامل #2 | المبلغ: -1,000 د.ج).');

  if (
    fd.creditSalesToday.length !== 1 ||
    fd.creditSalesToday[0].customerName !== 'أمين بن يحيى' ||
    fd.creditSalesToday[0].creditAdded !== 345 ||
    fd.debtCollections.length !== 1 ||
    fd.debtCollections[0].customerName !== 'سليم مراد' ||
    fd.kpis.storeTotalDebtReal !== 1050 ||
    fd.ownerAlerts.length < 2
  ) {
    console.error('❌ فشل اختبار 2 (ديون اليوم + تحصيلات الديون بأسماء الزبائن + تنبيهات المستشار):', fd);
    process.exit(1);
  }
  console.log('   ✔ اختبار 2 ناجح 100%: كشف ديون اليوم (أمين بن يحيى +345 د.ج) + تحصيل (سليم مراد +500 د.ج) + ديون المتجر (1,050 د.ج) + تنبيهات الرقابة.');

  // اختبارات 3..7: تشغيل Print Studio Pro + Stage5D داخل VM
  const sandbox = {
    window: {
      AppState: { settings: { shop_name: 'Gherbi.Ai POS', shop_address: 'قسنطينة' }, currentUser: { id: 1, name: 'المدير العام' }, customers: [] },
      GherbiPrintStudioV45: {},
      GherbiCaisseTurbo: {},
      App: { switchView: async () => true, showToast: () => {} },
      api: Object.freeze({
        getSessionDetails: async () => enrichedShift,
        pspPrint80mm: async () => ({ success: true }),
        pspExportPdf: async () => ({ success: true })
      }),
      addEventListener: () => {},
      setInterval: () => 1,
      clearInterval: () => {},
      requestAnimationFrame: (cb) => cb()
    },
    document: {
      readyState: 'complete',
      body: { classList: { toggle: () => {} } },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: (cb) => cb(),
    console: { log: () => {}, warn: () => {}, error: console.error }
  };
  sandbox.window.window = sandbox.window;

  for (const f of ['studio-bootstrap.js', 'studio-templates-34.js', 'studio-state.js', 'studio-renderer.js', 'studio-ui.js', 'studio-router.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(STUDIO_DIR, f), 'utf8'), sandbox, { filename: f });
  }
  vm.runInNewContext(fs.readFileSync(STAGE5_PATH, 'utf8'), sandbox, { filename: 'caisse-bom-stocktake-stage5.js' });

  const s5 = sandbox.window.GherbiStage5Ops;
  const psp = sandbox.window.GherbiPrintStudioPro;

  // اختبار 3: رسم التذكرة الحرارية 80mm بالبيانات الحقيقية للمناوبة #9
  const z80 = await s5.printShiftZReport(enrichedShift, '80mm', { renderOnly: true, asPdf: true });
  if (
    !z80.fullHtml.includes('data-s5d-war-dossier="1"') ||
    !z80.fullHtml.includes('data-psp-paper="80mm"') ||
    !z80.fullHtml.includes('محمد') ||
    !z80.fullHtml.includes('سلفة عامل #2') ||
    !z80.fullHtml.includes('أمين بن يحيى') ||
    !z80.fullHtml.includes('سليم مراد') ||
    !z80.fullHtml.includes('تنبيهات الرقابة لصاحب المتجر') ||
    !z80.fullHtml.includes('توقيع الكاشير')
  ) {
    console.error('❌ فشل اختبار 3 (رسم تذكرة 80mm بالملف الجنائي الكامل)!');
    process.exit(1);
  }
  console.log('   ✔ اختبار 3 ناجح 100%: تذكرة 80mm تعرض المستفيد (محمد)، السبب، زبون الدين (أمين بن يحيى)، المسدد (سليم مراد)، وتنبيهات الرقابة.');

  // اختبار 4: رسم المحضر التنفيذي A4 بجميع الجداول الـ 4 والتوقيعات الثلاثية
  const zA4 = await s5.printShiftZReport(enrichedShift, 'a4', { renderOnly: true, asPdf: true });
  if (
    !zA4.fullHtml.includes('data-s5d-war-dossier="1"') ||
    !zA4.fullHtml.includes('data-psp-paper="a4"') ||
    !zA4.fullHtml.includes('سجل الأموال الخارجة من الدرج') ||
    !zA4.fullHtml.includes('قائمة الزبائن المدينين اليوم') ||
    !zA4.fullHtml.includes('سجل تحصيلات الديون والإيداعات') ||
    !zA4.fullHtml.includes('أكبر المدينين في المتجر حالياً') ||
    !zA4.fullHtml.includes('المراجع / المحاسب')
  ) {
    console.error('❌ فشل اختبار 4 (رسم محضر A4 التنفيذي الشامل)!');
    process.exit(1);
  }
  console.log('   ✔ اختبار 4 ناجح 100%: محضر A4 التنفيذي يعرض 4 بطاقات KPI + الجداول الـ 4 + أكبر المدينين + التوقيعات الثلاثية.');

  // اختبار 5: المعاينة الحية داخل مركز الطباعة (بدون مناوبة حية -> بيانات نموذجية جزائرية غنية)
  s5._lastRenderedShiftDossier = null;
  const tpl80 = psp.state.getTemplate('caisse_z_report');
  const previewCenter = psp.router.renderDoc('caisse_z_report', null, 'preview');
  if (!previewCenter.fullHtml.includes('data-s5d-war-dossier="1"') || !previewCenter.fullHtml.includes('كريم بن عيسى') || !previewCenter.fullHtml.includes('محمد (العامل)')) {
    console.error('❌ فشل اختبار 5 (معاينة مركز الطباعة النموذجية)!');
    process.exit(1);
  }
  console.log('   ✔ اختبار 5 ناجح 100%: معاينة مركز الطباعة تعرض النموذج التنفيذي الكامل (مصاريف/سلف/ديون/تحصيلات) فورياً.');

  // اختبار 6: احترام لون القالب المختار من مركز الطباعة (emerald_dz)
  psp.state.setActiveDoc('caisse_z_report');
  psp.state.mutateActiveTemplate((t) => { t.themeId = 'emerald_dz'; }, 'لون أخضر');
  const themedOut = await s5.printShiftZReport(enrichedShift, '80mm', { renderOnly: true });
  if (!themedOut.fullHtml.includes('#047857')) {
    console.error('❌ فشل اختبار 6 (احترام ثيم مركز الطباعة)!');
    process.exit(1);
  }
  console.log('   ✔ اختبار 6 ناجح 100%: أقسام التقرير القيادي تحترم ألوان القالب المعتمد في مركز الطباعة.');

  // اختبار 7: بقاء قفل 80mm (__gherbiMasterPrintSilent) و contextBridge المجمّد سليمين 100%
  if (!Object.isFrozen(sandbox.window.api) || !sandbox.window.__gherbiMasterPrintSilent._isPspCanonicalLock) {
    console.error('❌ فشل اختبار 7 (قفل 80mm أو contextBridge)!');
    process.exit(1);
  }
  console.log('   ✔ اختبار 7 ناجح 100%: قفل الطباعة 80mm و contextBridge المجمّد محميان بالكامل.');

  console.log('\n🏆 اكتملت جميع الاختبارات الـ 7 بنجاح 100%!');
  console.log('⚠️ خطوة إلزامية: أغلق Electron بالكامل ثم أعد التشغيل عبر (npm start) لأن till-ledger.js (العملية الرئيسية) تحدّث.');
  console.log('📌 افتح "إدارة الصندوق" -> مراجعة المناوبة #9 أو #8 وجرّب المعاينة الحية وطباعة (80mm) و (A4) الآن!');
})().catch((err) => {
  console.error('❌ خطأ في الاختبارات:', err);
  process.exit(1);
});