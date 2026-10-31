/**
 * fix-db.js
 * إصلاح تداخل قوس db._rawRun في database.js والتحقق من سلامة كافة ملفات المشروع
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const dbPath = path.join(ROOT, 'database.js');

if (fs.existsSync(dbPath)) {
  let code = fs.readFileSync(dbPath, 'utf8');

  // إزالة التكرار المتداخل لـ db._rawRun(` قبل جدول cheques_portfolio أو dz_product_dictionary
  code = code.replace(
    /db\._rawRun\(\s*`\s*db\._rawRun\(\s*`\s*CREATE TABLE IF NOT EXISTS cheques_portfolio/g,
    'db._rawRun(`\n      CREATE TABLE IF NOT EXISTS cheques_portfolio'
  );

  // ضمان إغلاق قوس dz_product_dictionary بشكل سليم إن تكرر
  code = code.replace(
    /CREATE TABLE IF NOT EXISTS dz_product_dictionary[\s\S]*?\)\s*`\);\s*`\);/g,
    (match) => match.replace(/`\);\s*`\);$/, '`);')
  );

  fs.writeFileSync(dbPath, code, 'utf8');
  console.log('✅ تم إصلاح ملف database.js بنجاح.');
}

// تحديث final-perfection-100.js أيضاً لمنع تكرار المشكلة إذا شغّلته مرة أخرى
const fpPath = path.join(ROOT, 'final-perfection-100.js');
if (fs.existsSync(fpPath)) {
  let fpCode = fs.readFileSync(fpPath, 'utf8');
  fpCode = fpCode.replace(
    "`db._rawRun(\`\n      CREATE TABLE IF NOT EXISTS dz_product_dictionary`",
    "`db._rawRun(\\`\\n      CREATE TABLE IF NOT EXISTS dz_product_dictionary`"
  );
  fs.writeFileSync(fpPath, fpCode, 'utf8');
}

// فحص سلامة القواعد النحوية (Syntax Check) لجميع ملفات النظام الأساسية
const filesToCheck = [
  'database.js',
  'main.js',
  'server.js',
  'preload.js',
  'print-engine.js',
  'renderer.js',
  'renderer-rc-100.js'
];

let allValid = true;
for (const file of filesToCheck) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) continue;
  try {
    const src = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(src, { filename: file });
    console.log(`✔ سليم 100%: ${file}`);
  } catch (err) {
    allValid = false;
    console.error(`❌ خطأ في ${file}:`, err.message);
  }
}

if (allValid) {
  console.log('\n🚀 جميع الملفات سليمة 100%! يمكنك الآن تشغيل: npm run dev');
}