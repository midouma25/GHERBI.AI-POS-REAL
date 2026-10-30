/**
 * build-structure.js
 * سكربت البناء الآلي لهيكلة مشروع Gherbi.Ai POS (Clean-Room Edition)
 */

const fs = require('fs');
const path = require('path');

// اسم المجلد الجذري للمشروع الجديد
const PROJECT_ROOT = path.join(__dirname, 'Gherbi_Ai_POS_Clean');

// 1. قائمة المجلدات التي يجب إنشاؤها
const folders = [
  '', // المجلد الجذري
  'assets',
  'assets/css',
  'assets/fonts',
  'assets/img',
  'assets/js',
  'manufacturing',
  'stocktake',
  'template-designer'
];

// 2. قائمة الملفات التي يجب إنشاؤها (مقسمة حسب الأقسام)
const files = [
  // ملفات النظام والنواة (Root)
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
  
  // ملفات الواجهة الأساسية (Root HTML & CSS)
  'index.html',
  'activation.html',
  'styles.css',

  // قوالب الطباعة (Root HTML Templates)
  'barcode_label_template_1.html',
  'credit_note_ar.html', 'credit_note_en.html', 'credit_note_fr.html',
  'delivery_note_a5.html', 'delivery_note_ar.html', 'delivery_note_en.html', 'delivery_note_fr.html', 'delivery_note_thermal.html',
  'invoice_template_1.html', 'invoice_template_2.html', 'invoice_template_3.html', 'invoice_template_4.html', 'invoice_template_5.html',
  'invoice_template_6.html', 'invoice_template_7.html', 'invoice_template_8.html', 'invoice_template_9.html',
  'invoice_template_a5.html', 'invoice_template_detailed.html', 'invoice_thermal_80.html',
  'order_receipt_ar.html', 'order_receipt_fr.html',
  'payment_receipt_ar.html', 'payment_receipt_fr.html',
  'price_list.html',
  'proforma_invoice_ar.html', 'proforma_invoice_fr.html',
  'recap_invoice_ar.html', 'recap_invoice_en.html', 'recap_invoice_fr.html',
  'receipt_template_1.html', 'receipt_template_1_en.html', 'receipt_template_1_fr.html',
  'receipt_template_2.html', 'receipt_template_2_en.html', 'receipt_template_2_fr.html',
  'receipt_template_3.html', 'receipt_template_3_en.html', 'receipt_template_3_fr.html',
  'receipt_template_4.html', 'receipt_template_4_en.html', 'receipt_template_4_fr.html',
  'receipt_template_5.html', 'receipt_template_5_en.html', 'receipt_template_5_fr.html',
  'reception_note_ar.html', 'reception_note_en.html', 'reception_note_fr.html',
  'sales_summary_ar.html', 'sales_summary_en.html', 'sales_summary_fr.html',

  // ملفات قسم التصنيع (manufacturing)
  'manufacturing/manufacturing-ui.js',
  'manufacturing/manufacturing.js',
  'manufacturing/pos-produce.js',
  'manufacturing/production-guard.js',

  // ملفات قسم الجرد (stocktake)
  'stocktake/stocktake-guard.js',
  'stocktake/stocktake-ui.js',

  // ملفات مصمم القوالب (template-designer)
  'template-designer/template-builder.js',
  'template-designer/template-i18n.js',
  'template-designer/template-presets.js',
  'template-designer/template-renderer.js',

  // ملفات الأصول (assets)
  'assets/css/fonts.css',
  'assets/css/material-symbols.css',
  'assets/js/chart.umd.min.js',
  'assets/js/numberToWords.js',
  'assets/js/tailwind.min.js',
  'assets/js/translations.js'
];

// دالة التنفيذ
function buildProjectStructure() {
  console.log('🚀 بدء بناء هيكلة مشروع Gherbi.Ai POS...\n');

  // 1. إنشاء المجلدات
  folders.forEach(folder => {
    const folderPath = path.join(PROJECT_ROOT, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`📁 تم إنشاء المجلد: ${folder || 'Gherbi_Ai_POS_Clean (الجذر)'}`);
    }
  });

  console.log('\n----------------------------------------\n');

  // 2. إنشاء الملفات فارغة
  let filesCreated = 0;
  files.forEach(file => {
    const filePath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(filePath)) {
      // كتابة ملف فارغ
      fs.writeFileSync(filePath, '', 'utf8');
      filesCreated++;
    }
  });

  console.log(`📄 تم إنشاء ${filesCreated} ملف برمجي فارغ جاهز للعمل.`);
  console.log('\n🎉 اكتمل بناء الهيكلة بنجاح!');
  console.log(`📂 مسار المشروع الخاص بك هو: ${PROJECT_ROOT}`);
}

buildProjectStructure();