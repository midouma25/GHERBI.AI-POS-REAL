/**
 * restore-original-pos.js
 * سكربت استعادة شاشة المبيعات الأصلية لنظام Gherbi.Ai POS
 * يقوم باسترجاع النسخة الاحتياطية الأصلية لملفي index.html و styles.css وحذف ملفات تعديل SDS
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'Gherbi_Ai_POS_Clean'))
  ? path.join(__dirname, 'Gherbi_Ai_POS_Clean')
  : __dirname;

const INDEX_PATH = path.join(ROOT, 'index.html');
const STYLES_PATH = path.join(ROOT, 'styles.css');

const BAK_INDEX_1 = INDEX_PATH + '.bak_before_sds_fusion';
const BAK_INDEX_2 = INDEX_PATH + '.bak_sds_modern';

const BAK_STYLES_1 = STYLES_PATH + '.bak_before_sds_fusion';
const BAK_STYLES_2 = STYLES_PATH + '.bak_sds_modern';

// القسم الأصلي لشاشة المبيعات في Gherbi.Ai POS (في حال عدم وجود ملف النسخة الاحتياطية)
const ORIGINAL_POS_SECTION = `      <section id="view-pos" class="view-section active">
        <div class="pos-layout">
          <!-- يمين: الفئات وشبكة المنتجات -->
          <div class="flex flex-col gap-3 min-h-0">
            <!-- شريط الأزرار السريعة والفئات -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div id="posCategoryPills" class="flex flex-wrap items-center gap-1.5"></div>
              <div class="flex items-center gap-1.5">
                <button onclick="App.openFreeItemModal()" class="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1">
                  <span class="material-symbols-rounded icon-sm">add_shopping_cart</span>
                  <span>منتج حر (F8)</span>
                </button>
                <button onclick="App.toggleReturnMode()" id="btnReturnMode" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold flex items-center gap-1">
                  <span class="material-symbols-rounded icon-sm">keyboard_return</span>
                  <span>إرجاع</span>
                </button>
                <button onclick="App.openProductModal()" class="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1">
                  <span class="material-symbols-rounded icon-sm">add</span>
                  <span>إضافة منتج</span>
                </button>
              </div>
            </div>

            <!-- شبكة بطاقات المنتجات -->
            <div id="posProductsGrid" class="products-grid flex-1 overflow-y-auto pr-1"></div>
          </div>

          <!-- يسار: سلة المشتريات والحسابات -->
          <div class="cart-container">
            <!-- تبويبات تعدد السلات واختيار الزبون ونوع السعر -->
            <div class="p-3 border-b border-slate-200 dark:border-slate-700 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <div id="multiCartTabs" class="flex items-center gap-1 overflow-x-auto"></div>
                <button onclick="App.newCartTab()" class="px-2 py-1 rounded-lg bg-blue-600/10 text-blue-600 text-xs font-bold">+ سلة</button>
              </div>

              <div class="flex gap-2">
                <select id="posCustomerSelect" class="flex-1 px-3 py-2 rounded-xl text-xs font-bold"></select>
                <button onclick="App.openCustomerModal()" class="p-2 rounded-xl bg-emerald-600/15 text-emerald-600" title="زبون جديد">
                  <span class="material-symbols-rounded icon-sm">person_add</span>
                </button>
                <select id="posPriceTierSelect" onchange="App.setCartPriceTier(this.value)" class="w-28 px-2 py-2 rounded-xl text-xs font-bold">
                  <option value="retail">سعر التجزئة</option>
                  <option value="wholesale">سعر الجملة</option>
                </select>
              </div>
            </div>

            <!-- قائمة عناصر السلة -->
            <div id="posCartItems" class="cart-items p-3 space-y-2"></div>

            <!-- ملخص المجموع وأزرار الدفع -->
            <div class="p-3.5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-700 space-y-3">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500 font-bold">المجموع الفرعي:</span>
                <span id="cartSubtotalText" class="font-mono font-bold">0.00 د.ج</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500 font-bold">التخفيض:</span>
                <input id="cartDiscountInput" type="number" step="any" value="0"
                  oninput="App.recalcCart()"
                  class="w-28 px-2 py-1 rounded-lg text-center font-mono font-bold">
              </div>
              <div class="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                <span class="font-black text-sm">الإجمالي المستحق:</span>
                <span id="cartTotalText" class="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">0.00 د.ج</span>
              </div>

              <!-- أزرار التحكم السريعة في السلة -->
              <div class="grid grid-cols-4 gap-1.5 text-[11px] font-bold">
                <button onclick="App.clearCurrentCart()" class="py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20">إلغاء (F4)</button>
                <button onclick="App.holdCurrentCart()" class="py-2 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">تعليق (F2)</button>
                <button onclick="App.openDraftsModal()" class="py-2 rounded-xl bg-slate-200 dark:bg-slate-800">مسودات (<span id="draftsCountBadge">0</span>)</button>
                <button onclick="App.saveCartAsProforma()" class="py-2 rounded-xl bg-indigo-500/10 text-indigo-600">كمبدئية</button>
              </div>

              <button onclick="App.openCheckoutModal()"
                class="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25">
                <span class="material-symbols-rounded">payments</span>
                <span>تسديد الفاتورة (F1)</span>
              </button>
            </div>
          </div>
        </div>
      </section>`;

function restoreIndexHtml() {
  // 1. إذا كانت النسخة الاحتياطية الأولى موجودة، نستعيدها فوراً لأنها تطابق شاشتك الأولى 100%
  if (fs.existsSync(BAK_INDEX_1)) {
    fs.copyFileSync(BAK_INDEX_1, INDEX_PATH);
    console.log('✅ تم استرجاع index.html الأصلي من النسخة الاحتياطية الأولى (.bak_before_sds_fusion).');
    return;
  }

  // 2. إذا كانت النسخة الاحتياطية الثانية موجودة ولا تحتوي على تعديلات SDS، نستعيدها
  if (fs.existsSync(BAK_INDEX_2)) {
    const bak2Content = fs.readFileSync(BAK_INDEX_2, 'utf8');
    if (!bak2Content.includes('pos-sds-fusion-section') && !bak2Content.includes('sds-pos-master-view')) {
      fs.copyFileSync(BAK_INDEX_2, INDEX_PATH);
      console.log('✅ تم استرجاع index.html الأصلي من النسخة الاحتياطية (.bak_sds_modern).');
      return;
    }
  }

  // 3. استعادة جراحية نظيفة في حال عدم وجود ملفات النسخ الاحتياطي
  if (fs.existsSync(INDEX_PATH)) {
    let html = fs.readFileSync(INDEX_PATH, 'utf8');

    // إزالة النوافذ المضافة الخاصة بـ SDS
    html = html.replace(/<!-- =================================================================\s*نافذة بطاقة الزبون الشاملة[\s\S]*?(?=<section id="view-sales")/g, '');

    // إرجاع قسم #view-pos الأصلي
    html = html.replace(/<section id="view-pos"[\s\S]*?<\/section>/, ORIGINAL_POS_SECTION);

    // إزالة السكربتات المضافة
    html = html.replace(/\s*<script src="\.\/pos-sds-pro-fusion\.js"><\/script>/g, '');
    html = html.replace(/\s*<script src="\.\/sds-modern-pos-engine\.js"><\/script>/g, '');

    fs.writeFileSync(INDEX_PATH, html, 'utf8');
    console.log('✅ تم تنظيف وإرجاع هيكل index.html الأصلي بنجاح.');
  }
}

function restoreStylesCss() {
  if (fs.existsSync(BAK_STYLES_1)) {
    fs.copyFileSync(BAK_STYLES_1, STYLES_PATH);
    console.log('✅ تم استرجاع styles.css الأصلي من النسخة الاحتياطية الأولى (.bak_before_sds_fusion).');
    return;
  }

  if (fs.existsSync(BAK_STYLES_2)) {
    const bak2Css = fs.readFileSync(BAK_STYLES_2, 'utf8');
    if (!bak2Css.includes('GHERBI.AI POS + SDS ERGONOMIC FUSION')) {
      fs.copyFileSync(BAK_STYLES_2, STYLES_PATH);
      console.log('✅ تم استرجاع styles.css الأصلي من النسخة الاحتياطية (.bak_sds_modern).');
      return;
    }
  }

  if (fs.existsSync(STYLES_PATH)) {
    let css = fs.readFileSync(STYLES_PATH, 'utf8');

    // حذف بلوكات CSS التي أضيفت في التعديلين الأول والثاني
    const idx1 = css.indexOf('/* ==========================================================================\n   GHERBI.AI POS + SDS ERGONOMIC FUSION');
    if (idx1 !== -1) css = css.slice(0, idx1).trim() + '\n';

    const idx2 = css.indexOf('/* ==========================================================================\n   SDS COM 1:1 REPLICA');
    if (idx2 !== -1) css = css.slice(0, idx2).trim() + '\n';

    fs.writeFileSync(STYLES_PATH, css, 'utf8');
    console.log('✅ تم تنظيف وإرجاع ملف styles.css الأصلي بنجاح.');
  }
}

function removeAddedFiles() {
  const extraFiles = [
    path.join(ROOT, 'pos-sds-pro-fusion.js'),
    path.join(ROOT, 'sds-modern-pos-engine.js'),
    BAK_INDEX_1,
    BAK_INDEX_2,
    BAK_STYLES_1,
    BAK_STYLES_2
  ];

  for (const file of extraFiles) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log('🗑️ تم حذف الملف المؤقت:', path.basename(file));
      } catch (_) {}
    }
  }
}

restoreIndexHtml();
restoreStylesCss();
removeAddedFiles();

console.log('\n🎉 عادت شاشة المبيعات والنظام إلى حالتهما الأصلية تماماً! شغّل البرنامج الآن عبر: npm run dev');