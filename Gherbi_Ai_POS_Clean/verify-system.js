/**
 * verify-system.js
 * منظومة الفحص الهندسي والاختبار الآلي الشامل لنظام Gherbi.Ai POS
 * تتحقق من سلامة الملفات، القواعد النحوية (Syntax)، وقواعد البيانات والمحركات الحسابية
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

const REQUIRED_CORE_FILES = [
  'package.json',
  'main.js',
  'preload.js',
  'preload-activation.js',
  'renderer.js',
  'server.js',
  'database.js',
  'db-write-queue.js',
  'soft-delete.js',
  'data-revision.js',
  'stock-ledger.js',
  'till-ledger.js',
  'batch-alloc.js',
  'product-write.js',
  'imageUtils.js',
  'analytics-queries.js',
  'api-client.js',
  'cloud-db-sync.js',
  'cloud-diagnostics.js',
  'cloud-sync.js',
  'device-auth.js',
  'licenseManager.js',
  'scale-bridge.js',
  'scale-protocols.js',
  'print-engine.js',
  'index.html',
  'activation.html',
  'styles.css',
  'manufacturing/production-guard.js',
  'manufacturing/pos-produce.js',
  'manufacturing/manufacturing.js',
  'manufacturing/manufacturing-ui.js',
  'stocktake/stocktake-guard.js',
  'stocktake/stocktake-ui.js',
  'template-designer/template-i18n.js',
  'template-designer/template-presets.js',
  'template-designer/template-renderer.js',
  'template-designer/template-builder.js',
  'assets/js/numberToWords.js',
  'assets/js/translations.js',
  'assets/css/fonts.css',
  'assets/css/material-symbols.css'
];

async function runFullVerification() {
  console.log('==============================================================');
  console.log('🔍 بدء الفحص الهندسي الشامل لنظام Gherbi.Ai POS');
  console.log('==============================================================\n');

  let passed = 0;
  let failed = 0;

  function recordResult(label, ok, detail = '') {
    if (ok) {
      passed += 1;
      console.log(`✅ [PASS] ${label}`);
    } else {
      failed += 1;
      console.error(`❌ [FAIL] ${label} ${detail ? '--> ' + detail : ''}`);
    }
  }

  // 1. فحص وجود الملفات الأساسية وعدم كونها فارغة
  console.log('--- 1. فحص الملفات الأساسية والوحدات البرمجية ---');
  for (const relPath of REQUIRED_CORE_FILES) {
    const fullPath = path.join(ROOT, relPath);
    const exists = fs.existsSync(fullPath);
    const size = exists ? fs.statSync(fullPath).size : 0;
    recordResult(`الملف ${relPath}`, exists && size > 10, !exists ? 'غير موجود' : size <= 10 ? 'ملف فارغ' : '');
  }

  // 2. فحص القواعد النحوية (JavaScript Syntax Validation) لجميع ملفات .js
  console.log('\n--- 2. فحص سلامة الكود البرمجي (JS Syntax Check) ---');
  const jsFiles = REQUIRED_CORE_FILES.filter((f) => f.endsWith('.js'));
  for (const jsFile of jsFiles) {
    const fullPath = path.join(ROOT, jsFile);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const code = fs.readFileSync(fullPath, 'utf8');
      new vm.Script(code, { filename: jsFile });
      recordResult(`سلامة القواعد النحوية في ${jsFile}`, true);
    } catch (err) {
      recordResult(`سلامة القواعد النحوية في ${jsFile}`, false, err.message);
    }
  }

  // 3. فحص قوالب الطباعة
  console.log('\n--- 3. فحص منظومة قوالب الطباعة HTML ---');
  const allRootFiles = fs.readdirSync(ROOT);
  const htmlTemplates = allRootFiles.filter(
    (f) => f.endsWith('.html') && f !== 'index.html' && f !== 'activation.html'
  );
  recordResult(
    `عدد قوالب الطباعة المولدة (${htmlTemplates.length} قالب)`,
    htmlTemplates.length >= 40,
    htmlTemplates.length < 40 ? 'يرجى تشغيل node generate-print-templates.js أولاً' : ''
  );

  // 4. اختبار المحركات البرمجية والمنطقية (Integration Tests)
  console.log('\n--- 4. اختبار المحركات الحسابية وقاعدة البيانات ---');
  try {
    // أ) اختبار محرك التفقيط باللغات الثلاث
    const tafqeet = require('./assets/js/numberToWords');
    const arWords = tafqeet.toWords(15420.5, 'ar');
    const frWords = tafqeet.toWords(15420.5, 'fr');
    const enWords = tafqeet.toWords(15420.5, 'en');
    recordResult('محرك التفقيط المالي (العربية / الفرنسية / الإنجليزية)', Boolean(arWords && frWords && enWords));

    // ب) اختبار محرك الترجمة الثلاثي
    const { getTranslation } = require('./assets/js/translations');
    recordResult(
      'محرك الترجمة المركزي (RTL / LTR)',
      getTranslation('ar', 'nav_pos') === 'شاشة المبيعات' &&
        getTranslation('fr', 'nav_pos') === 'Point de Vente (POS)'
    );

    // ج) اختبار محرك التراخيص المفتوح للمالك
    const licenseManager = require('./licenseManager');
    const licStatus = await licenseManager.getLicenseStatus();
    recordResult(
      'محرك الترخيص الدائم (PRO Lifetime)',
      Boolean(licStatus && licStatus.isActivated === true && licStatus.isTrial === false && licStatus.hwid)
    );

    // د) اختبار محرك تفكيك باركود الميزان
    const { parseScaleBarcode } = require('./scale-protocols');
    const scaleParsed = parseScaleBarcode('2000105012504', { scale_barcode_enabled: 'true' });
    recordResult(
      'محرك تفكيك باركود الميزان الإلكتروني (PLU & Weight)',
      Boolean(scaleParsed && scaleParsed.pluCode === '00105' && scaleParsed.weight === 1.25)
    );

    // هـ) اختبار قاعدة البيانات والمحركات الذرية (في حال تثبيت sqlite3)
    const db = require('./database');
    await new Promise((r) => setTimeout(r, 400));

    const tables = await db.dbAll("SELECT name FROM sqlite_master WHERE type='table'");
    recordResult(`مخطط قاعدة البيانات SQLite WAL (${tables.length} جدولاً)`, tables.length >= 40);

    // اختبار الإحصائيات وحاسبة الزكاة والمساعد الذكي
    const analyticsQueries = require('./analytics-queries');
    const stats = await analyticsQueries.getAnalytics(db, {});
    const copilot = await analyticsQueries.getAiCopilotInsights(db);
    recordResult(
      'محرك الإحصائيات وحاسبة الزكاة و Gherbi.Ai Copilot',
      Boolean(stats && Array.isArray(stats.debtAging) && stats.zakat && copilot)
    );
  } catch (err) {
    recordResult('اختبار المحركات الخلفية', false, err.message);
  }

  console.log('\n==============================================================');
  console.log(`📊 النتيجة النهائية: نجح (${passed}) اختبار | فشل (${failed}) اختبار`);
  console.log('==============================================================');

  if (failed === 0) {
    console.log('🚀 النظام جاهز تماماً للتشغيل عبر: npm run dev');
  } else {
    console.log('⚠️ يرجى مراجعة الملاحظات أعلاه قبل التشغيل.');
  }
}

runFullVerification();