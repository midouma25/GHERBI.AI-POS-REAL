/**
 * show-qa-btn.js
 * إظهار زر (🤖 فحص آلي QA) بشكل دائم ومباشر في index.html وفي شريط السلة
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// 1. زرع زر الفحص الآلي مباشرة في index.html بجانب زر (+ إضافة منتج) وفي الشريط العلوي
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  if (!html.includes('id="btnPosHeaderQaBot"')) {
    html = html.replace(
      '<button onclick="App.openProductModal()" class="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1 shadow">',
      `<button id="btnPosHeaderQaBot" onclick="App.runAutoTest_PosPage()" title="تشغيل الفحص الآلي الشامل للصفحة (Ctrl+Shift+T)" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md">
                  <span>🤖 فحص آلي (QA)</span>
                </button>
                <button onclick="App.openProductModal()" class="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1 shadow">`
    );
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('✅ 1/2: تم تثبيت زر (🤖 فحص آلي QA) مباشرة في index.html بجانب زر (+ إضافة منتج).');
  }
}

// 2. تحديث التوقيت في renderer-rc-100.js ليظهر أيضاً في شريط السلة بعد 750ms
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');
  rc = rc.replace(
    /cleanAndUpgradePosDom\(\);\s*App\.renderPosView\(\);\s*App\.renderCartItems\(\);\s*\}, 350\);/g,
    `cleanAndUpgradePosDom();
      App.renderPosView();
      App.renderCartItems();
      setTimeout(cleanAndUpgradePosDom, 500);
    }, 350);`
  );
  fs.writeFileSync(rcPath, rc, 'utf8');
  console.log('✅ 2/2: تم تحديث توقيت شريط السلة في renderer-rc-100.js بنجاح.');
}

// نقل السكربتات المؤقتة للأرشيف
const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page1-pos-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 شغّل البرنامج الآن عبر npm run dev أو اضغط Ctrl+R داخل نافذة البرنامج لترى زر (🤖 فحص آلي QA) أمامك مباشرة!');