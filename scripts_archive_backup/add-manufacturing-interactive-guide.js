/**
 * add-manufacturing-interactive-guide.js
 * إضافة زر ونافذة الدليل الاستشاري والتفاعلي الشامل (Interactive Manufacturing & BOM Master Guide)
 * داخل الصفحة السادسة (#view-manufacturing) لشرح فائدة الصفحة وطريقة استعمالها بالتفصيل الممل مع محاكي تطبيقي حي.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿📘 جاري حقن زر ونافذة الدليل التفاعلي الشامل لقسم التصنيع والإنتاج (#view-manufacturing)...\n');

function installManufacturingInteractiveGuide() {
  if (!window.App || !window.AppState) return;

  AppState.mfgGuideCurrentTab = 'why'; // 'why' | 'cases' | 'steps' | 'faq'

  // --------------------------------------------------------------------------
  // 1) بناء نافذة الدليل التفاعلي الشامل (#mfgInteractiveGuideModal)
  // --------------------------------------------------------------------------
  App.openManufacturingGuideModal = function (tabKey) {
    if (tabKey) AppState.mfgGuideCurrentTab = tabKey;

    var modal = document.getElementById('mfgInteractiveGuideModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mfgInteractiveGuideModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    var activeTab = AppState.mfgGuideCurrentTab || 'why';

    var tabButtonsHtml =
      '<div class="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">' +
      '  <button type="button" onclick="App.openManufacturingGuideModal(\'why\')" class="flex-1 py-2 px-3 rounded-xl font-black transition ' + (activeTab === 'why' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60') + '">💡 1. ما هي فائدة هذه الصفحة؟</button>' +
      '  <button type="button" onclick="App.openManufacturingGuideModal(\'cases\')" class="flex-1 py-2 px-3 rounded-xl font-black transition ' + (activeTab === 'cases' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60') + '">🇩🇿 2. أمثلة للتاجر الجزائري</button>' +
      '  <button type="button" onclick="App.openManufacturingGuideModal(\'steps\')" class="flex-1 py-2 px-3 rounded-xl font-black transition ' + (activeTab === 'steps' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60') + '">🛠️ 3. كيف أستعملها خطوة بخطوة؟</button>' +
      '  <button type="button" onclick="App.openManufacturingGuideModal(\'faq\')" class="flex-1 py-2 px-3 rounded-xl font-black transition ' + (activeTab === 'faq' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60') + '">⚡ 4. الفرق بين اليدوي والتلقائي</button>' +
      '</div>';

    var contentHtml = '';

    if (activeTab === 'why') {
      contentHtml =
        '<div class="space-y-4 text-xs leading-relaxed">' +
        '  <div class="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/30 space-y-2">' +
        '    <div class="text-sm font-black text-blue-600 dark:text-blue-400">🎯 الفكرة الأساسية باختصار شديد:</div>' +
        '    <p class="font-bold text-slate-700 dark:text-slate-200">' +
        '      صفحة <strong>التصنيع والإنتاج (BOM)</strong> هي المكان الذي تخبر فيه البرنامج: <em>«أنا أشتري مواد أولية أو شوالات بالجملة، وأقوم بتحويلها أو تعبئتها أو خلطها لأصنع منها منتجاً نهائياً أبيعه للزبون»</em>.' +
        '    </p>' +
        '    <p class="text-slate-600 dark:text-slate-300">' +
        '      بدلاً من أن تضيع حساباتك بين ما اشتريته بالجملة وما بعته بالتجزئة، يقوم هذا القسم <strong>بخصم المواد الأولية تلقائياً من المخزون</strong>، وحساب <strong>نسبة الضياع أو الهدر</strong>، وإضافة <strong>مصاريف الأكياس والغاز واليد العاملة</strong>، ليخرج لك <strong>التكلفة الحقيقية الدقيقة للقطعة الواحدة</strong> ويضيفها في مخزونك جاهزة للبيع!' +
        '    </p>' +
        '  </div>' +

        '  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
        '    <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">' +
        '      <div class="font-black text-emerald-600 text-sm">💰 1. معرفة التكلفة الحقيقية والربح</div>' +
        '      <p class="text-slate-600 dark:text-slate-300">يحسب لك تكلفة كل مكون بطريقة (FIFO) + تكلفة التغليف والغاز + نسبة الهدر، فلا تبيع أبداً بأقل من تكلفتك الحقيقية.</p>' +
        '    </div>' +
        '    <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">' +
        '      <div class="font-black text-amber-600 text-sm">📦 2. ضبط مخزون المواد الأولية آلياً</div>' +
        '      <p class="text-slate-600 dark:text-slate-300">بمجرد إنتاج أو بيع المنتج النهائي، يخصم البرنامج المقادير المستهلكة بالغرام أو اللتر أو القطعة من مخزون المواد الأولية وينبهك قبل نفادها.</p>' +
        '    </div>' +
        '    <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-1.5">' +
        '      <div class="font-black text-indigo-600 text-sm">⚡ 3. توفير الوقت بالتصنيع التلقائي</div>' +
        '      <p class="text-slate-600 dark:text-slate-300">إذا فعّلت خيار (التصنيع التلقائي عند البيع)، فإن الكاشير يبيع المنتج في شاشة المبيعات والبرنامج يصنّعه ويخصم مكوناته في الخلفية تلقائياً!</p>' +
        '    </div>' +
        '  </div>' +

        '  <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">' +
        '    <div class="font-bold">🚀 هل تريد رؤية كيف تعمل الصفحة عملياً أمام عينك الآن؟</div>' +
        '    <button type="button" onclick="App.closeModal(\'mfgInteractiveGuideModal\'); window.ManufacturingUI.openRecipeModal(null).then(function(){window.ManufacturingUI.applySmartBomPreset(\'repack\');})" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow">🎯 جرّب الآن: تحميل مثال حي في نافذة الوصفة</button>' +
        '  </div>' +
        '</div>';
    } else if (activeTab === 'cases') {
      contentHtml =
        '<div class="space-y-3 text-xs">' +
        '  <div class="font-black text-sm text-slate-700 dark:text-slate-200">🇩🇿 5 أمثلة حقيقية لتجار جزائريين يستعملون هذه الصفحة يومياً لزيادة أرباحهم:</div>' +
        '  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        '    <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1">' +
        '      <div class="font-black text-blue-600">📦 1. سوبرماركت ومواد غذائية (تفريغ وتعبئة الشوالات)</div>' +
        '      <p>تشتري شوال سكر أو أرز أو عدس أو فرينة (25 كغ) وتفرغه في أكياس صغيرة (1 كغ). تنشئ وصفة تسحب 1 شوال + 50 د.ج ثمن الأكياس + 1% هدر ميزان، وتنتج لك 25 كيساً جاهزاً للبيع بالباركود.</p>' +
        '    </div>' +
        '    <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1">' +
        '      <div class="font-black text-amber-600">☕ 2. محمصة قهوة، توابل، ومكسرات (الخلطات والتحميص)</div>' +
        '      <p>تخلط 3 كغ قهوة روبوستا + 2 كغ أرابيكا (أو 7 بهارات لتكوين رأس الحانوت). أثناء التحميص ينقص الوزن بنسبة 5% (نسبة الهدر). الوصفة تحسب لك تكلفة كل كيس 250غ بعد الهدر والغاز بدقة تامة!</p>' +
        '    </div>' +
        '    <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1">' +
        '      <div class="font-black text-emerald-600">🥐 3. مخبزة وحلويات تقليدية (باتيسري)</div>' +
        '      <p>صينية البقلاوة أو الكرواسون تستهلك فرينة، زبدة، سكر، ولوز. تسجل المقادير في الوصفة، وعند إنتاج 5 صواني صباحاً يخصم البرنامج كل المقادير من المخزون ويخبرك كم بقي لديك من اللوز والفرينة.</p>' +
        '    </div>' +
        '    <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1">' +
        '      <div class="font-black text-rose-600">🥪 4. محلات الأكل السريع، المقاهي، والعصائر</div>' +
        '      <p>تضع وصفة لـ «طاكوس» أو «عصير طبيعي» مع تفعيل (التصنيع التلقائي عند البيع). الكاشير يبيع في شاشة المبيعات بشكل عادي، والبرنامج يخصم الخبز واللحم والجبن في الخلفية مع كل فاتورة!</p>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    } else if (activeTab === 'steps') {
      contentHtml =
        '<div class="space-y-3 text-xs leading-relaxed">' +
        '  <div class="font-black text-sm text-blue-600">🛠️ دليل الاستعمال العملي خطوة بخطوة (في 3 دقائق فقط):</div>' +
        '  <div class="space-y-2.5">' +
        '    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-r-4 border-blue-600">' +
        '      <div class="font-black text-slate-800 dark:text-white">الخطوة 1️⃣: إنشاء وصفة التصنيع (تُعمل مرة واحدة فقط لكل منتج)</div>' +
        '      <div class="text-slate-600 dark:text-slate-300 mt-1">' +
        '        اضغط على الزر الأزرق <strong>(+ وصفة تصنيع جديدة Alt+R)</strong> ⬅️ اختر <strong>المنتج النهائي الناتج</strong> (أو أنشئه فوراً من زر <em>+ إنشاء منتج نهائي جديد</em> داخل نفس النافذة) ⬅️ حدد <strong>كمية الخرج للدفعة</strong> (كم قطعة تنتجها هذه الخلطة) ⬅️ اختر المواد الأولية واضغط <strong>(+ إدراج مكون)</strong> ⬅️ اضغط <strong>(💾 حفظ الوصفة)</strong>.' +
        '      </div>' +
        '    </div>' +
        '    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-r-4 border-emerald-600">' +
        '      <div class="font-black text-slate-800 dark:text-white">الخطوة 2️⃣: تنفيذ أمر إنتاج فوري (عندما تحضّر بضاعة جديدة في المحل أو الورشة)</div>' +
        '      <div class="text-slate-600 dark:text-slate-300 mt-1">' +
        '        اضغط على الزر الأخضر <strong>(⚙️ أمر إنتاج فوري Alt+P)</strong> أو زر <strong>(⚙️ إنتاج)</strong> أمام الوصفة في الجدول ⬅️ أدخل الكمية التي تريد إنتاجها اليوم ⬅️ سيظهر لك جدول المحاكاة الأخضر ليؤكد لك أن المواد الأولية متوفرة ويحسب لك تكلفة الوحدة ⬅️ اضغط <strong>(⚡ تأكيد الإنتاج الفوري)</strong> ليتم خصم المواد الأولية وإضافة المنتج النهائي في مخزون الكاشير فوراً!' +
        '      </div>' +
        '    </div>' +
        '    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-r-4 border-amber-500">' +
        '      <div class="font-black text-slate-800 dark:text-white">الخطوة 3️⃣: الطباعة، الباركود، أو التراجع عن أمر إنتاج (عكس العملية)</div>' +
        '      <div class="text-slate-600 dark:text-slate-300 mt-1">' +
        '        في جدول <strong>(سجل أوامر الإنتاج)</strong> جهة اليسار، يمكنك الضغط على زر <strong>(📋 بطاقة)</strong> لطباعة ورقة التشغيل للعامل أو طباعة ملصقات الباركود للمنتج المصنع، أو الضغط على زر <strong>(↩️ عكس)</strong> إذا أردت إلغاء العملية وإرجاع المواد الأولية إلى المخزون كما كانت!' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    } else {
      contentHtml =
        '<div class="space-y-3 text-xs leading-relaxed">' +
        '  <div class="font-black text-sm text-indigo-600">⚡ متى أختار «الإنتاج اليدوي» ومتى أختار «التصنيع التلقائي عند البيع بالكاشير»؟</div>' +
        '  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        '    <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">' +
        '      <div class="font-black text-sm text-emerald-700 dark:text-emerald-300">⚡ التصنيع التلقائي عند البيع (Auto on Sale)</div>' +
        '      <p><strong>متى تستعمله؟</strong> للأشياء التي تُحضّر لحظة طلب الزبون (مثل: سندويتش، بيتزا، قهوة، عصير، أو خلطة سريعة) ولا توجد منها كمية مخزنة مسبقاً على الرف.</p>' +
        '      <p><strong>كيف يعمل؟</strong> عندما يكون رصيد المنتج النهائي <code>0</code> ويقوم الكاشير ببيعه في شاشة المبيعات، يقوم البرنامج أوتوماتيكياً بتصنيع الكمية المباعة وخصم مكوناتها دون أي نقرة إضافية!</p>' +
        '    </div>' +
        '    <div class="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-2">' +
        '      <div class="font-black text-sm text-blue-700 dark:text-blue-300">🏭 أمر الإنتاج اليدوي المسبق (Batch Production)</div>' +
        '      <p><strong>متى تستعمله؟</strong> عندما تقوم صباحاً بتحضير أو تعبئة كمية كبيرة لترتيبها على الرفوف (مثلاً: تعبئة 50 كيس سكر 1 كغ، أو خبز 30 قطعة باتيسري، أو تحميص 20 علبة قهوة).</p>' +
        '      <p><strong>كيف يعمل؟</strong> تضغط على <strong>(⚙️ أمر إنتاج فوري)</strong> وتدخل الكمية <code>50</code>، فيصبح لديك رصيد فعلي <code>50 قطعة</code> في المخزون وتطبع لها ملصقات باركود لتلصقها على الأكياس.</p>' +
        '    </div>' +
        '  </div>' +
        '  <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 font-bold text-amber-700 dark:text-amber-300">' +
        '    💡 <strong>معلومة ذهبية حول (نسبة الهدر %):</strong> إذا كنت تحمص 10 كغ قهوة خضراء وتفقد 5% من وزنها بسبب تبخر الرطوبة، ضع <code>5%</code> في خانة الهدر، وسيقوم البرنامج بسحب <code>10.5 كغ</code> وحساب التكلفة الحقيقية بدقة متناهية!' +
        '  </div>' +
        '</div>';
    }

    modal.innerHTML =
      '<div class="modal-content w-full max-w-4xl p-6 space-y-4 overflow-y-auto">' +
      '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
      '    <div class="flex items-center gap-2.5">' +
      '      <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow">' +
      '        <span class="material-symbols-rounded">menu_book</span>' +
      '      </div>' +
      '      <div>' +
      '        <h3 class="text-lg font-black text-slate-800 dark:text-white">📘 الدليل الشامل لقسم التصنيع والإنتاج والتعبئة (BOM Master Guide)</h3>' +
      '        <p class="text-[11px] text-slate-400 font-bold">شرح مبسط ومفصل لفائدة هذا القسم وكيف تستثمره لزيادة أرباح متجرك وضبط مخزونك</p>' +
      '      </div>' +
      '    </div>' +
      '    <button type="button" onclick="App.closeModal(\'mfgInteractiveGuideModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
      '  </div>' +
      tabButtonsHtml +
      contentHtml +
      '  <div class="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">' +
      '    <span class="text-slate-400 font-bold">⌨️ اختصارات الصفحة: [F1] فتح هذا الدليل | [Alt+R] وصفة جديدة | [Alt+P] أمر إنتاج فوري | [F4] بحث</span>' +
      '    <button type="button" onclick="App.closeModal(\'mfgInteractiveGuideModal\')" class="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black">إغلاق الدليل</button>' +
      '  </div>' +
      '</div>';

    modal.classList.add('active');
    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(modal);
  };

  // --------------------------------------------------------------------------
  // 2) حقن زر (📘 ما فائدة هذه الصفحة؟ وكيف أستعملها؟ F1) أعلى شاشة التصنيع تلقائياً
  // --------------------------------------------------------------------------
  function injectGuideButtonIntoManufacturingHeader() {
    var root = document.getElementById('manufacturing-view-root');
    if (!root) return;

    var qaBtn = document.getElementById('btnMfgPageQaBot');
    if (qaBtn && !document.getElementById('btnMfgInteractiveGuide')) {
      qaBtn.insertAdjacentHTML(
        'afterend',
        '<button id="btnMfgInteractiveGuide" type="button" onclick="App.openManufacturingGuideModal(\'why\')" title="اضغط هنا لشرح فائدة صفحة التصنيع وكيفية استعمالها بالتفصيل الممل (F1)" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md flex items-center gap-1">' +
        '  <span>📘 ما فائدة هذه الصفحة؟ وكيف أستعملها؟ (F1)</span>' +
        '</button>'
      );
    }
  }

  if (window.ManufacturingUI && typeof window.ManufacturingUI.renderManufacturingView === 'function') {
    var _origRenderMfg = window.ManufacturingUI.renderManufacturingView.bind(window.ManufacturingUI);
    window.ManufacturingUI.renderManufacturingView = async function () {
      var res = await _origRenderMfg();
      injectGuideButtonIntoManufacturingHeader();
      return res;
    };
  }

  // تفعيل اختصار F1 داخل صفحة التصنيع لفتح الدليل التفاعلي فوراً
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'manufacturing') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.key === 'F1') {
      e.preventDefault();
      e.stopPropagation();
      App.openManufacturingGuideModal('why');
    }
  }, true);

  setTimeout(injectGuideButtonIntoManufacturingHeader, 250);
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [MANUFACTURING INTERACTIVE USER GUIDE MODAL]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installManufacturingInteractiveGuide.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 1/2: تم حقن زر ونافذة الدليل الشامل للتصنيع والإنتاج في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page6-manufacturing-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 2/2: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت الإضافة! اضغط Ctrl+R داخل البرنامج الآن وافتح قسم (التصنيع والإنتاج) لتجربة زر الدليل الجديد (F1).');