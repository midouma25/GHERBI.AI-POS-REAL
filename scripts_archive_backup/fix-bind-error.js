/**
 * fix-bind-error.js
 * سكربت حماية دفاعي (Defensive Patch) لمنع انهيار النظام بسبب دوال bind المفقودة
 */

'use strict';

const fs = require('fs');
const path = require('path');

const rcPath = path.join(__dirname, 'renderer-rc-100.js');

if (fs.existsSync(rcPath)) {
  let code = fs.readFileSync(rcPath, 'utf8');

  // البحث عن أي دالة تحاول عمل bind(App) وتغليفها بشرط أمان (typeof === 'function')
  // يبحث عن نمط: const _baseFunc = App.someFunc.bind(App);
  const bindRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*App\.([a-zA-Z0-9_]+)\.bind\(App\);/g;

  let replacedCount = 0;
  code = code.replace(bindRegex, (match, varName, funcName) => {
    replacedCount++;
    return `const ${varName} = typeof App.${funcName} === 'function' ? App.${funcName}.bind(App) : function() { console.warn('[Gherbi.Ai Guard] App.${funcName} is undefined, using fallback.'); return null; };`;
  });

  if (replacedCount > 0) {
    fs.writeFileSync(rcPath, code, 'utf8');
    console.log(`✅ تم إصلاح وحماية ${replacedCount} دوال .bind() في ملف renderer-rc-100.js بنجاح.`);
  } else {
    console.log('⚠️ لم يتم العثور على دوال .bind() غير محمية.');
  }

} else {
  console.log('❌ ملف renderer-rc-100.js غير موجود!');
}