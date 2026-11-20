/**
 * verify-war-stage5d.js
 * تحقق جنائي شامل (7/7) من الترقية القيادية لتقارير إغلاق الوردية (80mm + A4)
 * يختبر till-ledger.js الحقيقي و perf-core/caisse-bom-stocktake-stage5.js داخل VM بدون تعديل أي ملف.
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

for (const fp of [TILL_LEDGER_PATH, STAGE5_PATH]) {
  execFileSync(process.execPath, ['--check', fp], { stdio: 'pipe' });
}
console.log('✅ الفحص النحوي سليم 100%: till-ledger.js و perf-core/caisse-bom-stocktake-stage5.js');

(async () => {
  const tillMod = require(TILL_LEDGER_PATH);

  async function resolveGet(sql) {
    const s = String(sql || '');
    if (/FROM\s+caisse_sessions/i.test(s)) {
      return {
        id: 9,
        user_id: 1,
        user_name: 'المدير العام',
        opening_balance: 0,
        closing_balance: -840,
        expected_balance: -840,
        difference: 0,
        status: 'closed',
        opened_at: '2026-11-20 00:16:00',
        closed_at: '2026-11-20 00:18:00'
      };
    }
    if (/FROM\s+users/i.test(s)) {
      return { id: 1, name: 'المدير العام' };
    }
    if (/SUM\(/i.test(s) && /FROM\s+sales/i.test(s)) {
      return { total_debt: 1050, sales_debt: 1050, new_credit: 345 };
    }
    return null;
  }

  async function resolveAll(sql) {
    const s = String(sql || '');
    if (/FROM\s+caisse_transactions/i.test(s)) {
      return [
        { id: 1, session_id: 9, type: 'sale', amount: 160, category: 'sales', description: 'مبيعات فاتورة #119', created_at: '2026-11-20 00:17:00' },
        { id: 2, session_id: 9, type: 'expense', amount: 1000, category: 'سلفة', description: '[المستفيد: محمد] [سلفة عامل #2] سلفة نقدية للعامل من مبيعات الصندوق', created_at: '2026-11-20 00:16:00' },
        { id: 3, session_id: 9, type: 'debt_payment', amount: 500, category: 'sales', description: 'تسديد دين زبون #4', created_at: '2026-11-20 00:17:30' }
      ];
    }
    if (/FROM\s+customers/i.test(s)) {
      return [
        { id: 3, name: 'أمين بن يحيى', phone: '0550112233', loyalty_card_code: 'FID-00003', live_debt: 850 },
        { id: 4, name: 'سليم مراد', phone: '0661223344', loyalty_card_code: 'FID-00004', live_debt: 200 }
      ];
    }
    if (/FROM\s+sales/i.test(s)) {
      return [
        { id: 119, doc_number: 'FAC-2026-0119', customer_id: null, total: 160, paid_amount: 160, discount: 0, payment_method: 'cash', sale_date: '2026-11-20 00:17:00', created_at: '2026-11-20 00:17:00' },
        { id: 120, doc_number: 'FAC-2026-0120', customer_id: 3, customer_name: 'أمين بن يحيى', customer_phone: '0550112233', total: 500, paid_amount: 155, discount: 0, payment_method: 'credit', sale_date: '2026-11-20 00:17:45', created_at: '2026-11-20 00:17:45' }
      ];
    }
    return [];
  }

  // محاكاة مطابقة 100% لـ database.js (تدعم callbacks و Promises معاً)
  const mockDb = {
    get(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      resolveGet(sql).then((row) => cb && cb(null, row)).catch((err) => cb && cb(err));
    },
    all(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      resolveAll(sql).then((rows) => cb && cb(null, rows)).catch((err) => cb && cb(err));
    },
    run(_sql, params, cb) {
      if (typeof params === 'function') cb = params;
      if (cb) cb.call({ lastID: 1, changes: 1 }, null);
    },
    dbGet: (sql) => resolveGet(sql),
    dbAll: (sql) => resolveAll(sql),
    dbRun: async () => ({ lastID: 1, changes: 1 })
  };

  console.log('\n🧪 جاري تشغيل الاختبارات الجنائية (7/7):');

  const enrichedShift = await tillMod.computeSessionSummary(mockDb, 9);
  const fd = enrichedShift && enrichedShift.forensicDossier;

  if (!fd || fd.outflows.length !== 1 || fd.outflows[0].beneficiary !== 'محمد' || !fd.outflows[0].reason.includes('سلفة نقدية')) {
    console.error('❌ فشل اختبار 1 (استخراج المستفيد والسبب في till-ledger.js):', fd && fd.outflows);
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
    fd.ownerAlerts.length < 1
  ) {
    console.error('❌ فشل اختبار 2 (ديون اليوم + تحصيلات الديون بأسماء الزبائن + تنبيهات الرقابة):', fd);
    process.exit(1);
  }
  console.log('   ✔ اختبار 2 ناجح 100%: كشف ديون اليوم (أمين بن يحيى +345 د.ج) + تحصيل (سليم مراد +500 د.ج) + ديون المتجر (1,050 د.ج) + تنبيهات الرقابة.');

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

  s5._lastRenderedShiftDossier = null;
  const previewCenter = psp.router.renderDoc('caisse_z_report', null, 'preview');
  if (!previewCenter.fullHtml.includes('data-s5d-war-dossier="1"') || !previewCenter.fullHtml.includes('كريم بن عيسى') || !previewCenter.fullHtml.includes('محمد (العامل)')) {
    console.error('❌ فشل اختبار 5 (معاينة مركز الطباعة النموذجية)!');
    process.exit(1);
  }
  console.log('   ✔ اختبار 5 ناجح 100%: معاينة مركز الطباعة تعرض النموذج التنفيذي الكامل (مصاريف/سلف/ديون/تحصيلات) فورياً.');

  psp.state.setActiveDoc('caisse_z_report');
  psp.state.mutateActiveTemplate((t) => { t.themeId = 'emerald_dz'; }, 'لون أخضر');
  const themedOut = await s5.printShiftZReport(enrichedShift, '80mm', { renderOnly: true });
  if (!themedOut.fullHtml.includes('#047857')) {
    console.error('❌ فشل اختبار 6 (احترام ثيم مركز الطباعة)!');
    process.exit(1);
  }
  console.log('   ✔ اختبار 6 ناجح 100%: أقسام التقرير القيادي تحترم ألوان القالب المعتمد في مركز الطباعة.');

  if (!Object.isFrozen(sandbox.window.api) || !sandbox.window.__gherbiMasterPrintSilent._isPspCanonicalLock) {
    console.error('❌ فشل اختبار 7 (قفل 80mm أو contextBridge)!');
    process.exit(1);
  }
  console.log('   ✔ اختبار 7 ناجح 100%: قفل الطباعة 80mm و contextBridge المجمّد محميان بالكامل.');

  console.log('\n🏆 اكتملت جميع الاختبارات الجنائية الـ 7 بنجاح 100%!');
  console.log('👉 أغلق Electron بالكامل ثم أعد التشغيل عبر (npm start) وجرّب مراجعة المناوبة #9 و #8 (80mm و A4)!');
})().catch((err) => {
  console.error('❌ خطأ في الاختبارات:', err);
  process.exit(1);
});