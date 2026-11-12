/**
 * prepare-v4-files.js
 * يجمع السكربتات المربوطة في index.html والسطور المهمة من المشروع في ملف واحد صغير
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const out = [];

function addSection(title, content) {
  out.push(`\n==================== ${title} ====================\n${content}\n`);
}

// 1. قراءة index.html بالكامل
if (fs.existsSync(path.join(ROOT, 'index.html'))) {
  addSection('FILE: index.html', fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
}

// 2. قراءة آخر 350 سطراً من styles.css (حيث توجد تعديلاتنا)
if (fs.existsSync(path.join(ROOT, 'styles.css'))) {
  const cssLines = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8').split(/\r?\n/);
  addSection('FILE: styles.css (Last 350 lines)', cssLines.slice(-350).join('\n'));
}

// 3. قراءة db-write-queue.js والملفات الإضافية النشطة
const extraFiles = fs.readdirSync(ROOT).filter(f =>
  f === 'db-write-queue.js' ||
  (f.endsWith('.js') && (f.startsWith('gherbi-') || f.startsWith('pos-') || f.startsWith('sds-')))
);

for (const file of extraFiles) {
  addSection(`FILE: ${file}`, fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

// 4. استخراج دوال السلة والمنتج والباركود من renderer-rc-100.js دون نسخ 45 ألف سطر
if (fs.existsSync(path.join(ROOT, 'renderer-rc-100.js'))) {
  const rc = fs.readFileSync(path.join(ROOT, 'renderer-rc-100.js'), 'utf8');
  const targets = [
    'recalcCart', 'renderQuickTouchStrip', 'openQuickTouchModal',
    'openProductModal', 'saveProduct', 'addMultiBarcodeRow',
    'handleBarcodeScan', 'submitSale', 'instantConfirmAndCheckout', 'loadSaleIntoPosForEdit'
  ];
  const snippets = targets.map(fn => {
    const idx = rc.indexOf(fn);
    return idx !== -1 ? `--- [${fn}] ---\n` + rc.slice(Math.max(0, idx - 100), idx + 1400) : `--- [${fn}: NOT FOUND] ---`;
  }).join('\n\n');
  addSection('EXTRACTED FUNCTIONS FROM renderer-rc-100.js', snippets);
}

fs.writeFileSync(path.join(ROOT, 'v4-ready-context.txt'), out.join('\n'), 'utf8');
console.log('✅ تم تجهيز الملف الموحد بنجاح: v4-ready-context.txt — أرفقه أو انسخه في المحادثة الآن!');