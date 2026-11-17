/**
 * gherbi-core-loyalty-audit.js
 * الحزمة المعمارية الثانية (V13 Core Loyalty, Walk-in, Crash Vault & Security Audit):
 * تضم محرك فارق النقاط (Delta Loyalty)، نافذة كود المدير السري (PIN)، نافذة حذف السلة الاحترافية، الزبون العابر (Alt+W)، وخزنة الطوارئ (Alt+R).
 */
'use strict';


/* ==================== [MODULE: gherbi-v4-stage1-2-enforcer.js] ==================== */
/**
 * gherbi-v4-stage1-2-enforcer.js (World-Class UI/UX & Exact Delta Loyalty Edition)
 */

'use strict';

(function initGherbiStage12Enforcer() {
  const Enforcer = {
    activeF7Tab: 'all',
    f7TapMultiplier: 1,
    keepF7OpenOnTap: true,
    warehouseDrawerOpen: false,
    editSnapshot: null, // يحفظ بصمة الفاتورة الأصلية ورصيد الزبون لحظة الضغط على "تعديل"

    presets: {
      supermarket: [
        { icon: '🥖', name: 'خبز عادي (Baguette)', price: 15, category: 'مخبزة ويوميات', pinned: true, noLoyalty: true },
        { icon: '🥖', name: 'خبز كومبلي / شعير', price: 30, category: 'مخبزة ويوميات', pinned: true, noLoyalty: false },
        { icon: '🥛', name: 'حليب شكارة (مقنن)', price: 25, category: 'ألبان', pinned: true, noLoyalty: true },
        { icon: '🥚', name: 'بيض (بالحبة)', price: 25, category: 'مواد غذائية', pinned: true, noLoyalty: false },
        { icon: '🥚', name: 'بلاطو بيض (30 حبة)', price: 650, category: 'مواد غذائية', pinned: true, noLoyalty: false },
        { icon: '🛍️', name: 'كيس بلاستيكي / قفة', price: 10, category: 'أكياس', pinned: true, noLoyalty: true },
        { icon: '💧', name: 'ماء معدني صغير 0.5ل', price: 30, category: 'مشروبات', pinned: true, noLoyalty: false },
        { icon: '🥛', name: 'لبن / رايب كيس 1ل', price: 90, category: 'ألبان', pinned: true, noLoyalty: false }
      ],
      produce: [
        { icon: '🥔', name: 'بطاطا (1 كغ)', price: 90, category: 'خضر وفواكه', pinned: true, noLoyalty: false },
        { icon: '🍅', name: 'طماطم (1 كغ)', price: 120, category: 'خضر وفواكه', pinned: true, noLoyalty: false },
        { icon: '🧅', name: 'بصل (1 كغ)', price: 80, category: 'خضر وفواكه', pinned: true, noLoyalty: false },
        { icon: '🌶️', name: 'فلفل حلو / حار (1 كغ)', price: 140, category: 'خضر وفواكه', pinned: false, noLoyalty: false },
        { icon: '🍎', name: 'تفاح (1 كغ)', price: 350, category: 'خضر وفواكه', pinned: false, noLoyalty: false },
        { icon: '🍌', name: 'موز (1 كغ)', price: 420, category: 'خضر وفواكه', pinned: false, noLoyalty: false }
      ],
      bakery: [
        { icon: '🥐', name: 'كرواسون / بتي بان', price: 35, category: 'مخبزة ومرطبات', pinned: true, noLoyalty: false },
        { icon: '🫓', name: 'خبز الدار / مطلوع', price: 50, category: 'مخبزة ومرطبات', pinned: true, noLoyalty: false },
        { icon: '🍰', name: 'قطعة باتيسري', price: 120, category: 'مخبزة ومرطبات', pinned: false, noLoyalty: false },
        { icon: '🍕', name: 'بيتزا كاري / سوفلي', price: 100, category: 'مخبزة ومرطبات', pinned: true, noLoyalty: false }
      ],
      library: [
        { icon: '📄', name: 'نسخ ورق (Photocopie N/B)', price: 5, category: 'مكتبة ونسخ', pinned: true, noLoyalty: false },
        { icon: '🌈', name: 'نسخ بالألوان (Couleur)', price: 20, category: 'مكتبة ونسخ', pinned: true, noLoyalty: false },
        { icon: '🖨️', name: 'طباعة صفحة (Impression)', price: 15, category: 'مكتبة ونسخ', pinned: true, noLoyalty: false },
        { icon: '📘', name: 'تغليف حلزوني (Reliure)', price: 100, category: 'مكتبة ونسخ', pinned: false, noLoyalty: false }
      ],
      perfume: [
        { icon: '🌸', name: 'تعبئة عطر 10 مل', price: 300, category: 'عطور وهدايا', pinned: true, noLoyalty: false },
        { icon: '🌺', name: 'تعبئة عطر 30 مل', price: 800, category: 'عطور وهدايا', pinned: true, noLoyalty: false },
        { icon: '👑', name: 'تعبئة عطر مركز 50 مل', price: 1300, category: 'عطور وهدايا', pinned: true, noLoyalty: false },
        { icon: '🎁', name: 'تغليف هدية', price: 200, category: 'عطور وهدايا', pinned: false, noLoyalty: false }
      ]
    },

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.buildAllModals();
        this.setupStage1PinAndDeduplicateAudit();
        this.setupStage1UnifiedStripAndLiveChange();
        this.setupStage2WarehouseF7Center();
        this.setupExactDeltaLoyaltyEngine();

        setTimeout(() => this.enforceDomState(), 500);
        setTimeout(() => this.enforceDomState(), 1100);
        setInterval(() => this.enforceDomState(), 800);
      }, 200);
    },

    enforceDomState() {
      this.hideDuplicateLegacyF7Strips();
      this.ensureSinglePinnedDock();
      this.deduplicateAuditTableRows();
      this.overrideOpeningLegacyF7Modal();
      this.updateLiveEditDeltaBanner();
    },

    // ========================================================================
    // بناء النوافذ المخصصة (تغيير كود المدير + تعديل زر سريع + مركز اللمس السريع العالمي F7)
    // ========================================================================
    buildAllModals() {
      // 1. نافذة تغيير كود المدير السري (PIN)
      if (!document.getElementById('changeManagerPinModal')) {
        const pinModal = document.createElement('div');
        pinModal.id = 'changeManagerPinModal';
        pinModal.className = 'modal-overlay';
        pinModal.innerHTML = `
          <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border-2 border-amber-500 shadow-2xl text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">🔑</span>
                <div>
                  <h3 class="text-sm font-black text-amber-600 dark:text-amber-400">تغيير كود المدير السري (Manager PIN)</h3>
                  <p class="text-[10.5px] text-slate-400">يُستخدم هذا الكود لتصريح تعديل رصيد نقاط الولاء والعمليات الحساسة</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="text-slate-400 hover:text-rose-500 font-black text-base">✕</button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">1. الكود السري الحالي (الافتراضي: 1234) * :</label>
                <input id="enfPinCurrent" type="password" placeholder="أدخل الكود الحالي..."
                  onkeydown="if(event.key==='Enter') document.getElementById('enfPinNew')?.focus()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>
              <div>
                <label class="block font-black text-emerald-600 dark:text-emerald-400 mb-1">2. الكود السري الجديد (3 أرقام أو أكثر) * :</label>
                <input id="enfPinNew" type="password" placeholder="أدخل الكود الجديد..."
                  onkeydown="if(event.key==='Enter') document.getElementById('enfPinConfirm')?.focus()"
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-base tracking-widest">
              </div>
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">3. تأكيد الكود السري الجديد * :</label>
                <input id="enfPinConfirm" type="password" placeholder="أعد إدخال الكود الجديد..."
                  onkeydown="if(event.key==='Enter') GherbiStage12Enforcer.saveNewPin()"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-black text-center text-base tracking-widest">
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('changeManagerPinModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="GherbiStage12Enforcer.saveNewPin()"
                class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg">
                ✔ حفظ الكود السري الجديد
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(pinModal);
      }

      // 2. نافذة تعديل زر لمس سريع
      if (!document.getElementById('quickBtnEditModal')) {
        const editModal = document.createElement('div');
        editModal.id = 'quickBtnEditModal';
        editModal.className = 'modal-overlay';
        editModal.innerHTML = `
          <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <h3 class="text-sm font-black text-emerald-600">✏️ تعديل خصائص زر اللمس السريع</h3>
              <button type="button" onclick="App.closeModal('quickBtnEditModal')" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
            </div>
            <input type="hidden" id="enfQbIdx">
            <div class="grid grid-cols-12 gap-2.5">
              <div class="col-span-3">
                <label class="block font-bold mb-1">الأيقونة</label>
                <input id="enfQbIcon" type="text" class="w-full px-2 py-2 rounded-xl border text-center text-base">
              </div>
              <div class="col-span-9">
                <label class="block font-bold mb-1">اسم السلعة أو الخدمة *</label>
                <input id="enfQbName" type="text" class="w-full px-3 py-2 rounded-xl border font-black">
              </div>
              <div class="col-span-6">
                <label class="block font-black text-emerald-600 mb-1">السعر (د.ج) *</label>
                <input id="enfQbPrice" type="number" step="any" class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-sm">
              </div>
              <div class="col-span-6">
                <label class="block font-bold mb-1">القسم</label>
                <input id="enfQbCat" type="text" class="w-full px-3 py-2 rounded-xl border font-bold">
              </div>
              <div class="col-span-12 flex items-center justify-between pt-2">
                <label class="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input id="enfQbPinned" type="checkbox" class="rounded text-emerald-600">
                  <span>📌 تثبيت في شاشة المبيعات الرئيسية</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer font-bold text-amber-600">
                  <input id="enfQbNoLoyalty" type="checkbox" class="rounded text-amber-500">
                  <span>🚫 استثناء من نقاط الوفاء</span>
                </label>
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('quickBtnEditModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
              <button type="button" onclick="GherbiStage12Enforcer.saveEditedQuickButton()" class="px-5 py-2 rounded-xl bg-emerald-600 text-white font-black">✔ حفظ التعديلات</button>
            </div>
          </div>
        `;
        document.body.appendChild(editModal);
      }

      // 3. مركز اللمس السريع الاحترافي المطور (#gherbiV4QuickTouchModal)
      const oldF7 = document.getElementById('gherbiV4QuickTouchModal');
      if (oldF7) oldF7.remove();

      const f7Modal = document.createElement('div');
      f7Modal.id = 'gherbiV4QuickTouchModal';
      f7Modal.className = 'modal-overlay';
      f7Modal.innerHTML = `
        <div class="modal-content bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          
          <!-- 1. الهيدر الذكي: العنوان + شريط السلة الحي + مضاعف اللمس (×1..×12) + وضع النقر المتعدد -->
          <div class="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-black">⚡</div>
              <div>
                <h3 class="text-sm font-black text-white flex items-center gap-2">
                  <span>مركز اللمس السريع للسلع اليومية ومنتجات المخزن (F7)</span>
                </h3>
                <p class="text-[10.5px] text-slate-400">انقر على البطاقات لإدراجها فوراً — تظهر الكمية المضافة للسلة مباشرة على كل بطاقة</p>
              </div>
            </div>

            <!-- مضاعف الكمية السريع داخل نافذة F7 -->
            <div class="flex items-center gap-1 bg-slate-800/90 px-2.5 py-1 rounded-xl border border-slate-700">
              <span class="text-[10px] text-amber-400 font-black ml-1">مضاعف النقرة:</span>
              <button type="button" onclick="GherbiStage12Enforcer.setF7Multiplier(1)" data-f7m="1" class="f7-mult-btn active">×1</button>
              <button type="button" onclick="GherbiStage12Enforcer.setF7Multiplier(2)" data-f7m="2" class="f7-mult-btn">×2</button>
              <button type="button" onclick="GherbiStage12Enforcer.setF7Multiplier(5)" data-f7m="5" class="f7-mult-btn">×5</button>
              <button type="button" onclick="GherbiStage12Enforcer.setF7Multiplier(10)" data-f7m="10" class="f7-mult-btn">×10</button>
              <button type="button" onclick="GherbiStage12Enforcer.setF7Multiplier(12)" data-f7m="12" class="f7-mult-btn">×12</button>
            </div>

            <!-- ملخص السلة الحي + إبقاء النافذة مفتوحة -->
            <div class="flex items-center gap-2.5">
              <div class="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2">
                <span>🛒 السلة: <strong id="f7HeaderCartCount" class="font-mono text-emerald-400">0</strong></span>
                <span class="text-slate-600">|</span>
                <strong id="f7HeaderCartTotal" class="font-mono text-sm text-emerald-300">0.00 د.ج</strong>
              </div>

              <label class="flex items-center gap-1.5 cursor-pointer bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 font-bold text-[11px]">
                <input id="f7KeepOpenToggle" type="checkbox" checked onchange="GherbiStage12Enforcer.keepF7OpenOnTap = this.checked" class="rounded text-emerald-500">
                <span>إضافة متعددة</span>
              </label>

              <button type="button" onclick="App.closeModal('gherbiV4QuickTouchModal'); App.focusBarcodeMagnet?.(false);"
                class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black">
                ✔ تم (Enter)
              </button>
            </div>
          </div>

          <!-- 2. شريط القوالب الجاهزة + فتح متصفح المخزن البصري + إضافة زر جديد -->
          <div class="px-5 py-2.5 bg-white dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-black text-slate-500 text-[11px] ml-1">🎯 القوالب:</span>
              <button type="button" onclick="GherbiStage12Enforcer.loadPreset('supermarket')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px]">🛒 سوبرماركت ويوميات</button>
              <button type="button" onclick="GherbiStage12Enforcer.loadPreset('produce')" class="px-2.5 py-1 rounded-lg bg-lime-600 hover:bg-lime-500 text-white font-black text-[11px]">🍎 خضر وفواكه</button>
              <button type="button" onclick="GherbiStage12Enforcer.loadPreset('bakery')" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px]">🥖 مخبزة ومرطبات</button>
              <button type="button" onclick="GherbiStage12Enforcer.loadPreset('library')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px]">📚 مكتبة ونسخ</button>
              <button type="button" onclick="GherbiStage12Enforcer.loadPreset('perfume')" class="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-black text-[11px]">✨ عطور وهدايا</button>
            </div>

            <div class="flex items-center gap-1.5">
              <button type="button" onclick="GherbiStage12Enforcer.toggleWarehouseBrowserDrawer()"
                class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1 shadow-sm">
                <span>📦</span>
                <span>ربط منتجات من المخزن</span>
              </button>
              <button type="button" onclick="GherbiStage12Enforcer.importTopWarehouseProducts()"
                class="px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white font-black text-xs transition">
                🔥 استيراد المفضلة تلقائياً
              </button>
            </div>
          </div>

          <!-- 3. درج متصفح المخزن البصري السريع (يظهر عند الضغط على "📦 ربط منتجات من المخزن") -->
          <div id="f7WarehouseDrawer" class="hidden px-5 py-3 bg-blue-50/90 dark:bg-slate-800 border-b-2 border-blue-500/40 space-y-2.5 shrink-0">
            <div class="flex items-center justify-between gap-2">
              <div class="font-black text-blue-700 dark:text-blue-300 text-xs flex items-center gap-1.5">
                <span>📦 اختر من منتجات مخزنك لإضافتها كأزرار لمس سريعة (تخصم من المخزون الحقيقي عند البيع):</span>
              </div>
              <div class="flex items-center gap-2">
                <input id="f7WarehouseSearchInp" type="text" oninput="GherbiStage12Enforcer.renderWarehouseVisualList(this.value)"
                  placeholder="🔍 ابحث في منتجات المخزن بالاسم أو الباركود..."
                  class="w-64 px-3 py-1 rounded-xl border-2 border-blue-500 font-bold text-xs bg-white dark:bg-slate-900">
                <button type="button" onclick="GherbiStage12Enforcer.toggleWarehouseBrowserDrawer()" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold">إخفاء ▲</button>
              </div>
            </div>
            <div id="f7WarehouseVisualGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1"></div>
          </div>

          <!-- 4. شريط تبويبات الأقسام والبحث الفوري -->
          <div class="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <div id="enfF7CategoryPills" class="flex items-center gap-1 overflow-x-auto no-scrollbar"></div>
            <div class="relative w-64">
              <input id="enfF7SearchInput" type="text" oninput="GherbiStage12Enforcer.renderF7Cards()"
                placeholder="🔍 ابحث داخل أزرار اللمس السريع..."
                class="w-full px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-800">
            </div>
          </div>

          <!-- 5. شبكة البطاقات التفاعلية الواسعة -->
          <div id="enfF7CardsGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto flex-1 p-5"></div>

          <!-- 6. الشريط السفلي النظيف والمتناسق لإنشاء زر سلعة يومية أو خدمة جديدة بدون أي تداخل -->
          <div class="px-5 py-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div class="flex items-center gap-1.5">
              <span class="font-black text-emerald-600 dark:text-emerald-400">⚡ إنشاء زر سريع جديد:</span>
              <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-1.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button type="button" onclick="(document.getElementById('enfNewIconInp') || {}).value ='🥖'" class="hover:scale-125 transition">🥖</button>
                <button type="button" onclick="(document.getElementById('enfNewIconInp') || {}).value ='🥛'" class="hover:scale-125 transition">🥛</button>
                <button type="button" onclick="(document.getElementById('enfNewIconInp') || {}).value ='🥚'" class="hover:scale-125 transition">🥚</button>
                <button type="button" onclick="(document.getElementById('enfNewIconInp') || {}).value ='🛍️'" class="hover:scale-125 transition">🛍️</button>
                <button type="button" onclick="(document.getElementById('enfNewIconInp') || {}).value ='💧'" class="hover:scale-125 transition">💧</button>
                <button type="button" onclick="(document.getElementById('enfNewIconInp') || {}).value ='☕'" class="hover:scale-125 transition">☕</button>
                <button type="button" onclick="(document.getElementById('enfNewIconInp') || {}).value ='📄'" class="hover:scale-125 transition">📄</button>
                <button type="button" onclick="(document.getElementById('enfNewIconInp') || {}).value ='🎁'" class="hover:scale-125 transition">🎁</button>
                <input id="enfNewIconInp" type="text" value="🥖" class="w-9 text-center font-bold bg-white dark:bg-slate-800 rounded-lg py-0.5 border">
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
              <input id="enfNewNameInp" type="text" placeholder="اسم السلعة أو الخدمة (مثال: خبز / حليب / نسخ)..."
                class="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 font-bold bg-white dark:bg-slate-900">
              <input id="enfNewPriceInp" type="number" step="any" placeholder="السعر (د.ج)"
                onkeydown="if(event.key==='Enter') GherbiStage12Enforcer.createCustomQuickButton()"
                class="w-28 px-3 py-1.5 rounded-xl border-2 border-emerald-500 font-mono font-black text-center bg-white dark:bg-slate-900">
              <input id="enfNewCatInp" type="text" placeholder="القسم (يوميات)"
                class="w-28 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 font-bold bg-white dark:bg-slate-900">
              <button type="button" onclick="GherbiStage12Enforcer.createCustomQuickButton()"
                class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm shrink-0">
                + إضافة الزر
              </button>
            </div>
          </div>

        </div>
      `;
      document.body.appendChild(f7Modal);
    },

    // ========================================================================
    // الشطر 1: كود المدير السري (PIN) + توحيد الشريط + الصرف اللحظي
    // ========================================================================
    setupStage1PinAndDeduplicateAudit() {
      document.addEventListener(
        'click',
        (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const txt = (btn.textContent || '').trim();
          const onclickStr = btn.getAttribute('onclick') || '';
          if (txt.includes('تغيير كود المدير السري') || onclickStr.includes('changeManagerLoyaltyPinPrompt')) {
            e.preventDefault();
            e.stopPropagation();
            this.openPinChangeModal();
          }
        },
        true
      );
      if (window.RetailV3) {
        window.RetailV3.changeManagerLoyaltyPinPrompt = () => this.openPinChangeModal();
      }
    },

    getStoredPin() {
      return String(
        window.AppState?.settings?.manager_loyalty_pin ||
        localStorage.getItem('gherbi_manager_loyalty_pin') ||
        '1234'
      ).trim();
    },

    openPinChangeModal() {
      if (typeof this.ensurePinModalInjected === 'function') this.ensurePinModalInjected(); if (typeof this.ensureModals === 'function') this.ensureModals(); if (typeof this.injectPinModal === 'function') this.injectPinModal();
      this.buildAllModals();
      (document.getElementById('enfPinCurrent') || {}).value = '';
      (document.getElementById('enfPinNew') || {}).value = '';
      (document.getElementById('enfPinConfirm') || {}).value = '';
      window.App.openModal('changeManagerPinModal');
      setTimeout(() => document.getElementById('enfPinCurrent')?.focus(), 60);
    },

    saveNewPin() {
      const curPin = this.getStoredPin();
      const oldVal = String(document.getElementById('enfPinCurrent')?.value || '').trim();
      const newVal = String(document.getElementById('enfPinNew')?.value || '').trim();
      const confVal = String(document.getElementById('enfPinConfirm')?.value || '').trim();

      if (oldVal !== curPin) {
        if (window.showToast) window.showToast('❌ الكود السري الحالي غير صحيح!', 'error');
        document.getElementById('enfPinCurrent')?.focus();
        return;
      }
      if (newVal.length < 3) {
        if (window.showToast) window.showToast('⚠️ يجب أن يتكون الكود الجديد من 3 خانات على الأقل', 'warning');
        document.getElementById('enfPinNew')?.focus();
        return;
      }
      if (newVal !== confVal) {
        if (window.showToast) window.showToast('⚠️ الكود الجديد وتأكيده غير متطابقين!', 'warning');
        document.getElementById('enfPinConfirm')?.focus();
        return;
      }

      localStorage.setItem('gherbi_manager_loyalty_pin', newVal);
      if (window.AppState?.settings) window.AppState.settings.manager_loyalty_pin = newVal;
      if (window.api?.updateSettings) {
        window.api.updateSettings({ manager_loyalty_pin: newVal }).catch(() => {});
      }

      window.App.closeModal('changeManagerPinModal');
      if (window.showToast) window.showToast('✅ تم تغيير كود المدير السري (PIN) وحفظه بنجاح!', 'success');
    },

    deduplicateAuditTableRows() {
      const card = document.getElementById('ownerLoyaltyPointsAuditCard');
      if (!card) return;
      const tbody = card.querySelector('tbody');
      if (!tbody) return;
      const seen = new Set();
      let count = 0;
      Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
        const sig = cells.slice(1).join('||');
        if (seen.has(sig)) {
          tr.remove();
        } else {
          seen.add(sig);
          count++;
        }
      });
      const titleEl = card.querySelector('h3');
      if (titleEl) {
        titleEl.textContent = `سجل رقابة المدير: تعديلات رصيد نقاط الوفاء (${count})`;
      }
    },

    hideDuplicateLegacyF7Strips() {
      document.getElementById('posQuickTouchStrip')?.remove();
      const posView = document.getElementById('view-pos');
      if (!posView) return;
      Array.from(posView.querySelectorAll('button, span')).forEach((el) => {
        const txt = (el.textContent || '').trim();
        if (txt.includes('لمس سريع (F7)')) {
          const parentStrip = el.closest('div');
          if (parentStrip && parentStrip.id !== 'gherbiPinnedQuickDock' && !parentStrip.contains(document.getElementById('posProductsGrid'))) {
            parentStrip.classList.add('gherbi-legacy-f7-hidden');
            parentStrip.style.display = 'none';
          }
        }
      });
    },

    ensureSinglePinnedDock() {
      const productsGrid = document.getElementById('posProductsGrid');
      if (!productsGrid || !productsGrid.parentElement) return;
      let dock = document.getElementById('gherbiPinnedQuickDock');
      if (!dock) {
        dock = document.createElement('div');
        dock.id = 'gherbiPinnedQuickDock';
        dock.className = 'gherbi-pinned-f7-dock';
        productsGrid.parentElement.insertBefore(dock, productsGrid);
        this.renderPinnedDock();
      }
    },

    getCartTotalDirectly(forcedTotal) {
      if (forcedTotal !== undefined && forcedTotal !== null && !isNaN(Number(forcedTotal))) {
        return Number(forcedTotal);
      }
      try {
        const cart = window.App?.currentCart;
        if (cart && Array.isArray(cart.items)) {
          const sub = cart.items.reduce((acc, it) => {
            const q = Number(it.quantity ?? 1);
            const p = Number(it.price ?? 0);
            const line = it.subtotal !== undefined ? Number(it.subtotal) : (q * p);
            return acc + (isNaN(line) ? 0 : line);
          }, 0);
          const disc = Number(cart.discount ?? document.getElementById('cartDiscountInput')?.value ?? 0);
          const cpDisc = Number(cart.couponDiscount || 0);
          return Math.max(0, Number((sub - disc - cpDisc).toFixed(2)));
        }
      } catch (_) {}
      const txt = document.getElementById('cartTotalText')?.textContent || '0';
      const m = String(txt).match(/-?\d+(?:\.\d+)?/);
      return m ? parseFloat(m[0]) : 0;
    },

    updateChangeInstant(forcedTotal) {
      if (this._calcBusy) return;
      this._calcBusy = true;
      try {
        const inp = document.getElementById('gherbiReceivedCashInput');
        const resEl = document.getElementById('gherbiInlineChangeResult');
        const centEl = document.getElementById('gherbiInlineChangeCentimes');
        if (!inp || !resEl) return;

        const totalDue = this.getCartTotalDirectly(forcedTotal);
        const raw = String(inp.value || '').trim();
        const received = parseFloat(raw);

        if (!raw || !Number.isFinite(received) || received <= 0) {
          resEl.textContent = '0.00 د.ج';
          resEl.className = 'font-mono font-black text-sm text-slate-500';
          if (centEl) centEl.classList.add('hidden');
          return;
        }

        const diff = Number((received - totalDue).toFixed(2));
        if (diff >= 0) {
          resEl.textContent = `${diff.toFixed(2)} د.ج`;
          resEl.className = 'font-mono font-black text-base text-emerald-600 dark:text-emerald-400';
          if (centEl) {
            const centStr = window.App?.formatAlgerianCentimes
              ? window.App.formatAlgerianCentimes(diff)
              : `${Math.round(diff * 100).toLocaleString('fr-DZ')} سنتيم`;
            centEl.textContent = `🇩🇿 الصرف بالتداول الجزائري: ${centStr}`;
            centEl.classList.remove('hidden');
          }
        } else {
          const missing = Math.abs(diff);
          resEl.textContent = `ناقص: ${missing.toFixed(2)} د.ج`;
          resEl.className = 'font-mono font-black text-sm text-rose-600';
          if (centEl) {
            centEl.textContent = `⚠️ المبلغ المستلم أقل من الإجمالي المستحق بـ ${missing.toFixed(2)} د.ج`;
            centEl.classList.remove('hidden');
          }
        }
      } finally {
        this._calcBusy = false;
      }
    },

    setupStage1UnifiedStripAndLiveChange() {
      if (window.RetailV2) {
        window.RetailV2.recalcInlineChange = (t) => this.updateChangeInstant(t);
      }

      ['keydown', 'keyup', 'input', 'change', 'paste'].forEach((evtName) => {
        window.addEventListener(
          evtName,
          (e) => {
            if (e.target && e.target.id === 'gherbiReceivedCashInput') {
              if (evtName === 'keydown' && e.key !== 'Enter' && e.key !== 'Escape' && !e.altKey && !e.ctrlKey) {
                e.stopPropagation();
              }
              this.updateChangeInstant();
              requestAnimationFrame(() => this.updateChangeInstant());
              setTimeout(() => this.updateChangeInstant(), 10);
            }
          },
          true
        );
      });

      const totalEl = document.getElementById('cartTotalText');
      if (totalEl) {
        const obs = new MutationObserver(() => this.updateChangeInstant());
        obs.observe(totalEl, { childList: true, characterData: true, subtree: true });
      }
    },

    // ========================================================================
    // الشطر 2 (أ): مركز اللمس السريع الاحترافي (F7)
    // ========================================================================
    setupStage2WarehouseF7Center() {
      this.ensureSinglePinnedDock();
      this.renderPinnedDock();

      window.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'F7') {
            e.preventDefault();
            e.stopPropagation();
            this.openOurF7Modal();
          }
        },
        true
      );

      document.addEventListener(
        'click',
        (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const txt = (btn.textContent || '').trim();
          const onclickAttr = btn.getAttribute('onclick') || '';
          if (
            txt.includes('لوحة اللمس (F7)') ||
            txt.includes('لمس سريع (F7)') ||
            onclickAttr.includes('openQuickTouchModal') ||
            onclickAttr.includes('quickTouchPadModal')
          ) {
            e.preventDefault();
            e.stopPropagation();
            this.openOurF7Modal();
          }
        },
        true
      );
    },

    overrideOpeningLegacyF7Modal() {
      if (window.App) {
        window.App.openQuickTouchModal = () => this.openOurF7Modal();
        window.App.openPosQuickTouchModal = () => this.openOurF7Modal();
      }
      Array.from(document.querySelectorAll('.modal-overlay.active')).forEach((m) => {
        if (m.id !== 'gherbiV4QuickTouchModal' && (m.textContent || '').includes('لوحة الأزرار السريعة للسلع اليومية')) {
          m.classList.remove('active');
          this.openOurF7Modal();
        }
      });
    },

    setF7Multiplier(m) {
      this.f7TapMultiplier = Math.max(1, Number(m) || 1);
      document.querySelectorAll('[data-f7m]').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.f7m) === this.f7TapMultiplier);
      });
    },

    toggleWarehouseBrowserDrawer() {
      const dr = document.getElementById('f7WarehouseDrawer');
      if (!dr) return;
      this.warehouseDrawerOpen = dr.classList.contains('hidden');
      dr.classList.toggle('hidden', !this.warehouseDrawerOpen);
      if (this.warehouseDrawerOpen) {
        this.renderWarehouseVisualList('');
        setTimeout(() => document.getElementById('f7WarehouseSearchInp')?.focus(), 50);
      }
    },

    renderWarehouseVisualList(query = '') {
      const grid = document.getElementById('f7WarehouseVisualGrid');
      if (!grid) return;
      const q = String(query || '').trim().toLowerCase();
      const existingIds = new Set(this.getF7List().filter((b) => b.productId).map((b) => Number(b.productId)));

      const prods = (window.AppState.products || []).filter((p) => {
        if (p.hide_from_pos) return false;
        if (!q) return true;
        return String(p.name || '').toLowerCase().includes(q) || String(p.barcode || '').toLowerCase().includes(q);
      });

      if (!prods.length) {
        grid.innerHTML = '<div class="col-span-full py-4 text-center text-slate-400 font-bold">لا توجد منتجات مطابقة في المخزن</div>';
        return;
      }

      grid.innerHTML = prods.slice(0, 40).map((p) => {
        const isLinked = existingIds.has(Number(p.id));
        const stock = Number(p.total_stock ?? p.stock ?? 0);
        return `
          <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border ${isLinked ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-200 dark:border-slate-700'} flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-black text-[11px] truncate">${p.name}</div>
              <div class="text-[10px] font-mono text-slate-400">${Number(p.selling_price || 0).toFixed(2)} د.ج | مخزون: ${stock}</div>
            </div>
            <button type="button" onclick="GherbiStage12Enforcer.quickLinkWarehouseId(${p.id})"
              class="px-2.5 py-1 rounded-lg font-black text-[10.5px] shrink-0 ${isLinked ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}">
              ${isLinked ? '✔ مضاف' : '+ ربط'}
            </button>
          </div>
        `;
      }).join('');
    },

    quickLinkWarehouseId(productId) {
      const pid = Number(productId);
      const prod = (window.AppState.products || []).find((p) => Number(p.id) === pid);
      if (!prod) return;

      const list = this.getF7List();
      const existingIdx = list.findIndex((b) => Number(b.productId) === pid);
      if (existingIdx !== -1) {
        list.splice(existingIdx, 1);
        this.saveF7List(list);
        this.renderWarehouseVisualList(document.getElementById('f7WarehouseSearchInp')?.value || '');
        if (window.showToast) window.showToast(`تم إلغاء ربط "${prod.name}" من لوحة اللمس`, 'info');
        return;
      }

      list.unshift({
        productId: prod.id,
        icon: '📦',
        name: prod.name,
        price: Number(prod.selling_price || 0),
        category: prod.category || 'منتجات المخزن',
        pinned: true,
        noLoyalty: false
      });

      this.saveF7List(list);
      this.renderWarehouseVisualList(document.getElementById('f7WarehouseSearchInp')?.value || '');
      if (window.showToast) window.showToast(`✅ تمت إضافة "${prod.name}" إلى لوحة اللمس وتثبيته في الكاشير`, 'success');
    },

    openOurF7Modal() {
      if (!document.getElementById('gherbiV4QuickTouchModal')) {
        this.buildAllModals();
      }
      this.setF7Multiplier(1);
      this.renderF7Cards();
      this.syncF7HeaderCartStats();
      window.App.openModal('gherbiV4QuickTouchModal');
    },

    syncF7HeaderCartStats() {
      const items = window.App?.currentCart?.items || [];
      const countEl = document.getElementById('f7HeaderCartCount');
      const totalEl = document.getElementById('f7HeaderCartTotal');
      if (countEl) countEl.textContent = `${items.length} أصناف`;
      if (totalEl) totalEl.textContent = `${this.getCartTotalDirectly().toFixed(2)} د.ج`;
    },

    getF7List() {
      try {
        const raw = localStorage.getItem('gherbi_quick_touch_buttons');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) return parsed;
        }
      } catch (_) {}
      return JSON.parse(JSON.stringify(this.presets.supermarket));
    },

    saveF7List(list) {
      localStorage.setItem('gherbi_quick_touch_buttons', JSON.stringify(list));
      if (window.AppState) window.AppState.quickTouchButtons = list;
      this.renderF7Cards();
      this.renderPinnedDock();
    },

    loadPreset(key) {
      const preset = this.presets[key];
      if (!preset) return;
      const warehouseLinked = this.getF7List().filter((b) => b.productId);
      this.saveF7List([...warehouseLinked, ...JSON.parse(JSON.stringify(preset))]);
      if (window.showToast) window.showToast('✅ تم تحميل القالب مع الاحتفاظ بمنتجات المخزن المربوطة', 'success');
    },

    importTopWarehouseProducts() {
      const prods = (window.AppState.products || []).filter((p) => !p.hide_from_pos);
      if (!prods.length) {
        if (window.showToast) window.showToast('لا توجد منتجات في المخزن حالياً', 'warning');
        return;
      }
      const list = this.getF7List();
      let added = 0;
      const picks = prods.filter((p) => p.is_featured).concat(prods).slice(0, 8);
      picks.forEach((p) => {
        if (!list.some((b) => Number(b.productId) === Number(p.id))) {
          list.unshift({
            productId: p.id,
            icon: '📦',
            name: p.name,
            price: Number(p.selling_price || 0),
            category: 'منتجات المخزن',
            pinned: true,
            noLoyalty: false
          });
          added++;
        }
      });
      this.saveF7List(list);
      if (window.showToast) window.showToast(`📦 تم استيراد ${added} منتجات من المخزن إلى لوحة اللمس السريع`, 'success');
    },

    createCustomQuickButton() {
      const icon = document.getElementById('enfNewIconInp')?.value?.trim() || '⚡';
      const name = document.getElementById('enfNewNameInp')?.value?.trim() || '';
      const price = parseFloat(document.getElementById('enfNewPriceInp')?.value || '0');
      const cat = document.getElementById('enfNewCatInp')?.value?.trim() || 'خدمات ويوميات';
      if (!name || !Number.isFinite(price) || price < 0) {
        if (window.showToast) window.showToast('يرجى إدخال اسم السلعة والسعر بشكل صحيح', 'warning');
        document.getElementById('enfNewNameInp')?.focus();
        return;
      }
      const list = this.getF7List();
      list.push({ icon, name, price, category: cat, pinned: true, noLoyalty: false });
      (document.getElementById('enfNewNameInp') || {}).value = '';
      (document.getElementById('enfNewPriceInp') || {}).value = '';
      this.saveF7List(list);
      if (window.showToast) window.showToast(`✅ تمت إضافة الزر السريع "${name}"`, 'success');
    },

    getCartQtyForQuickButton(item) {
      const cartItems = window.App?.currentCart?.items || [];
      if (item.productId) {
        const match = cartItems.find((x) => Number(x.product_id || x.productId) === Number(item.productId));
        return match ? Number(match.quantity || 0) : 0;
      }
      const match = cartItems.find((x) => !x.product_id && x.name === item.name);
      return match ? Number(match.quantity || 0) : 0;
    },

    renderF7Cards() {
      const grid = document.getElementById('enfF7CardsGrid');
      const pillsBox = document.getElementById('enfF7CategoryPills');
      if (!grid) return;

      const list = this.getF7List();
      const q = String(document.getElementById('enfF7SearchInput')?.value || '').trim().toLowerCase();

      const cats = ['all', 'pinned', 'inventory', ...new Set(list.map((b) => b.category || 'عام'))];
      if (pillsBox) {
        const names = { all: 'الكل', pinned: '📌 المثبتة في الكاشير', inventory: '📦 منتجات المخزن' };
        pillsBox.innerHTML = cats.map((c) => `
          <button type="button" onclick="GherbiStage12Enforcer.activeF7Tab='${c}'; GherbiStage12Enforcer.renderF7Cards();"
            class="px-3 py-1 rounded-xl font-black text-[11px] whitespace-nowrap transition ${
              this.activeF7Tab === c ? 'bg-emerald-600 text-white shadow' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }">
            ${names[c] || c}
          </button>
        `).join('');
      }

      const filtered = list
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
          if (this.activeF7Tab === 'pinned' && item.pinned === false) return false;
          if (this.activeF7Tab === 'inventory' && !item.productId) return false;
          if (!['all', 'pinned', 'inventory'].includes(this.activeF7Tab) && (item.category || 'عام') !== this.activeF7Tab) {
            return false;
          }
          if (!q) return true;
          return String(item.name || '').toLowerCase().includes(q) || String(item.category || '').toLowerCase().includes(q);
        });

      if (!filtered.length) {
        grid.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400 font-bold">لا توجد أزرار مطابقة للبحث</div>';
        return;
      }

      grid.innerHTML = filtered.map(({ item, idx }) => {
        const prod = item.productId ? (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId)) : null;
        const price = prod ? Number(prod.selling_price || item.price || 0) : Number(item.price || 0);
        const stockBadge = prod ? `📦 مخزون: ${Number(prod.total_stock ?? prod.stock ?? 0)}` : '⚡ يومي سريع';
        const isPinned = item.pinned !== false;
        const inCartQty = this.getCartQtyForQuickButton(item);

        return `
          <div onclick="GherbiStage12Enforcer.executeQuickButton(${idx}, true)"
               class="f7-pro-card ${prod ? 'warehouse-linked' : ''} ${inCartQty > 0 ? 'in-cart-active' : ''}">
            <div class="flex items-center justify-between gap-1">
              <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">${stockBadge}</span>
              <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                ${
                  inCartQty > 0
                    ? `<span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono font-black text-[10.5px]">🛒 ×${inCartQty}</span>`
                    : ''
                }
                <button type="button" onclick="GherbiStage12Enforcer.togglePin(${idx})" title="تثبيت أو إخفاء من الشاشة الرئيسية"
                  class="w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center ${isPinned ? 'bg-amber-500/20 text-amber-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}">📌</button>
                <button type="button" onclick="GherbiStage12Enforcer.openEditQuickButton(${idx})" title="تعديل السعر أو الاسم"
                  class="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-600 text-[10px] flex items-center justify-center">✏️</button>
                <button type="button" onclick="GherbiStage12Enforcer.deleteQuickButton(${idx})" title="حذف الزر"
                  class="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-600 text-[10px] flex items-center justify-center">✕</button>
              </div>
            </div>

            <div class="font-black text-sm text-slate-800 dark:text-slate-100 my-1 flex items-center gap-1.5">
              <span class="text-lg">${item.icon || '⚡'}</span>
              <span class="line-clamp-2">${prod ? prod.name : item.name}</span>
            </div>

            <div class="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span class="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">${price.toFixed(2)} د.ج</span>
              ${item.noLoyalty ? '<span class="text-[10px] font-bold text-rose-500">🚫 بدون نقاط</span>' : '<span class="text-[10px] font-bold text-amber-500">👑 مؤهل للنقاط</span>'}
            </div>
          </div>
        `;
      }).join('');
      this.syncF7HeaderCartStats();
    },

    renderPinnedDock() {
      this.hideDuplicateLegacyF7Strips();
      const dock = document.getElementById('gherbiPinnedQuickDock');
      if (!dock) return;
      const list = this.getF7List();
      const pinned = list.map((b, idx) => ({ b, idx })).filter(({ b }) => b.pinned !== false);

      dock.innerHTML = `
        <button type="button" onclick="GherbiStage12Enforcer.openOurF7Modal()"
          class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shrink-0 flex items-center gap-1 shadow-sm">
          <span>⚡</span>
          <span>لوحة اللمس (F7)</span>
        </button>
        ${pinned.map(({ b, idx }) => {
          const prod = b.productId ? (window.AppState.products || []).find((p) => Number(p.id) === Number(b.productId)) : null;
          const price = prod ? Number(prod.selling_price || b.price || 0) : Number(b.price || 0);
          const name = prod ? prod.name : b.name;
          return `
            <div onclick="GherbiStage12Enforcer.executeQuickButton(${idx}, false)"
                 oncontextmenu="event.preventDefault(); GherbiStage12Enforcer.openEditQuickButton(${idx});"
                 class="gherbi-pinned-f7-chip" title="انقر للإضافة للسلة فوراً | نقرة يمين لتعديل السعر أو الخصائص">
              <span>${b.icon || '⚡'}</span>
              <span>${name}</span>
              <span class="font-mono font-black text-emerald-600 dark:text-emerald-400">${price.toFixed(0)} د.ج</span>
            </div>
          `;
        }).join('')}
      `;
    },

    executeQuickButton(idx, fromInsideModal = false) {
      const list = this.getF7List();
      const item = list[idx];
      if (!item || !window.App) return;

      const tapMult = fromInsideModal ? Math.max(1, Number(this.f7TapMultiplier || 1)) : Math.max(1, Number(window.AppState._quickMultiplier || 1));

      if (item.productId) {
        const prod = (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId));
        if (prod) {
          if (typeof window.App.addProductToCart === 'function') {
            window.App.addProductToCart(prod.id, tapMult);
          } else if (typeof window.App.addToCart === 'function') {
            for (let i = 0; i < tapMult; i++) window.App.addToCart(prod.id);
          }
          this.setF7Multiplier(1);
          this.renderF7Cards();
          if (fromInsideModal && !this.keepF7OpenOnTap) {
            window.App.closeModal('gherbiV4QuickTouchModal');
          }
          return;
        }
      }

      const sign = (window.AppState.isReturnMode || window.AppState.returnMode) ? -1 : 1;
      const qty = tapMult * sign;
      const price = Number(item.price || 0);

      const cartItems = window.App.currentCart?.items || [];
      const existing = cartItems.find((x) => !x.product_id && x.name === item.name && Number(x.price) === price);

      if (existing) {
        existing.quantity = Number((Number(existing.quantity || 0) + qty).toFixed(3));
        existing.subtotal = Number((existing.quantity * price).toFixed(2));
      } else {
        cartItems.push({
          product_id: null,
          custom_product_name: item.name,
          name: item.name,
          price,
          cost_price: 0,
          quantity: qty,
          unit: 'وحدة',
          subtotal: Number((qty * price).toFixed(2)),
          _noLoyalty: Boolean(item.noLoyalty)
        });
      }

      this.setF7Multiplier(1);
      window.App.setQuickMultiplier?.(1);
      window.App.recalcAndRenderCart?.();
      this.renderF7Cards();

      if (fromInsideModal && !this.keepF7OpenOnTap) {
        window.App.closeModal('gherbiV4QuickTouchModal');
      }
    },

    togglePin(idx) {
      const list = this.getF7List();
      if (!list[idx]) return;
      list[idx].pinned = list[idx].pinned === false ? true : false;
      this.saveF7List(list);
    },

    deleteQuickButton(idx) {
      const list = this.getF7List();
      if (!list[idx]) return;
      list.splice(idx, 1);
      this.saveF7List(list);
    },

    openEditQuickButton(idx) {
      const list = this.getF7List();
      const item = list[idx];
      if (!item) return;

      (document.getElementById('enfQbIdx') || {}).value = String(idx);
      (document.getElementById('enfQbIcon') || {}).value = item.icon || '⚡';
      (document.getElementById('enfQbName') || {}).value = item.name || '';
      (document.getElementById('enfQbPrice') || {}).value = Number(item.price || 0);
      (document.getElementById('enfQbCat') || {}).value = item.category || 'خدمات سريعة';
      document.getElementById('enfQbPinned').checked = item.pinned !== false;
      document.getElementById('enfQbNoLoyalty').checked = Boolean(item.noLoyalty);

      window.App.openModal('quickBtnEditModal');
    },

    saveEditedQuickButton() {
      const idx = parseInt(document.getElementById('enfQbIdx')?.value || '-1', 10);
      const list = this.getF7List();
      if (!list[idx]) return;

      list[idx].icon = document.getElementById('enfQbIcon')?.value?.trim() || '⚡';
      list[idx].name = document.getElementById('enfQbName')?.value?.trim() || list[idx].name;
      list[idx].price = Math.max(0, parseFloat(document.getElementById('enfQbPrice')?.value || '0') || 0);
      list[idx].category = document.getElementById('enfQbCat')?.value?.trim() || 'خدمات سريعة';
      list[idx].pinned = Boolean(document.getElementById('enfQbPinned')?.checked);
      list[idx].noLoyalty = Boolean(document.getElementById('enfQbNoLoyalty')?.checked);

      this.saveF7List(list);
      window.App.closeModal('quickBtnEditModal');
      if (window.showToast) window.showToast('✅ تم حفظ تعديلات زر اللمس السريع', 'success');
    },

    // ========================================================================
    // الشطر 2 (ب): المحرك الجذري لفارق النقاط الصافي (Exact Delta Loyalty Engine)
    // ========================================================================
    calcEligiblePoints(items = [], discount = 0) {
      let eligibleTotal = 0;
      const policies = JSON.parse(localStorage.getItem('gherbi_product_loyalty_policies') || '{}');
      items.forEach((it) => {
        const sub = Number(it.subtotal ?? (Number(it.quantity || 1) * Number(it.price || 0)));
        if (it._noLoyalty) return;
        const pid = it.product_id || it.productId;
        const mult = pid && policies[pid] !== undefined ? Number(policies[pid]) : 1;
        eligibleTotal += sub * mult;
      });
      const net = Math.max(0, eligibleTotal - Number(discount || 0));
      return Math.floor(net / 100);
    },

    captureEditedSaleSnapshotNow(hintSaleId = null) {
      setTimeout(() => {
        const cart = window.App?.currentCart;
        if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return;

        const cid = Number(cart.customerId || document.getElementById('posCustomerSelect')?.value || 0);
        const cust = cid ? (window.AppState.customers || []).find((c) => Number(c.id) === cid) : null;
        const currentCustomerPoints = cust ? Number(cust.loyalty_points || 0) : 0;
        const oldSalePoints = this.calcEligiblePoints(cart.items, cart.discount || 0);

        this.editSnapshot = {
          active: true,
          saleId: hintSaleId || cart.editingSaleId || window.AppState?.editingSaleId || 'EDIT',
          customerId: cid,
          customerBalanceBeforeEdit: currentCustomerPoints,
          oldSaleEarnedPoints: oldSalePoints,
          capturedAt: Date.now()
        };

        cart._isGherbiEditedSale = true;
        cart._oldSaleEarnedPoints = oldSalePoints;
        cart._customerBalanceBeforeEdit = currentCustomerPoints;
        this.updateLiveEditDeltaBanner();
      }, 180);
    },

    updateLiveEditDeltaBanner() {
      const cart = window.App?.currentCart;
      const topDeck = document.getElementById('gherbiCartTopDeck');
      if (!topDeck) return;

      let banner = document.getElementById('gherbiLiveDeltaLoyaltyBanner');
      const isEditing = Boolean(
        (this.editSnapshot && this.editSnapshot.active) ||
        cart?._isGherbiEditedSale ||
        cart?.editingSaleId ||
        window.AppState?.editingSaleId ||
        Boolean(document.getElementById('posEditSaleBanner') && !document.getElementById('posEditSaleBanner').classList.contains('hidden'))
      );

      if (!isEditing || !cart || !cart.items || cart.items.length === 0) {
        if (banner) banner.classList.add('hidden');
        return;
      }

      // إذا ظهر #posEditSaleBanner ولم نلتقط البصمة بعد، نلتقطها فوراً
      if (!this.editSnapshot || !this.editSnapshot.active) {
        this.captureEditedSaleSnapshotNow();
        return;
      }

      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'gherbiLiveDeltaLoyaltyBanner';
        banner.className = 'gherbi-delta-loyalty-banner';
        topDeck.insertBefore(banner, topDeck.firstChild);
      }

      const oldPts = Number(this.editSnapshot.oldSaleEarnedPoints || 0);
      const newPts = this.calcEligiblePoints(cart.items, cart.discount || 0);
      const delta = newPts - oldPts;
      const deltaStr = delta > 0 ? `+${delta} نقطة إضافية` : delta < 0 ? `${delta} نقطة (خصم ما حُذف)` : '0 نقطة (بدون تغيير)';
      const badgeColor = delta > 0 ? 'bg-emerald-500 text-slate-950' : delta < 0 ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-200';

      banner.classList.remove('hidden');
      banner.innerHTML = `
        <div class="flex items-center gap-1.5">
          <span>👑 تعديل فاتورة سابقة:</span>
          <span>نقاطها السابقة (<strong class="font-mono text-amber-300">${oldPts}</strong>)</span>
          <span>⬅</span>
          <span>الآن (<strong class="font-mono text-emerald-300">${newPts}</strong>)</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="px-2 py-0.5 rounded font-mono font-black ${badgeColor}">الصافي: ${deltaStr}</span>
          <button type="button" onclick="GherbiStage12Enforcer.clearEditSnapshot()" title="إلغاء وضع التعديل" class="text-slate-300 hover:text-rose-400 px-1">✕</button>
        </div>
      `;
    },

    clearEditSnapshot() {
      this.editSnapshot = null;
      if (window.App?.currentCart) {
        delete window.App.currentCart._isGherbiEditedSale;
        delete window.App.currentCart._oldSaleEarnedPoints;
      }
      document.getElementById('gherbiLiveDeltaLoyaltyBanner')?.classList.add('hidden');
    },

    setupExactDeltaLoyaltyEngine() {
      // 1. اعتراض أي نقرة على زر "تعديل" في سجل المبيعات (#view-sales) أو نافذة آخر المبيعات (#posRecentSalesModal / #recentSalesModal)
      document.addEventListener(
        'click',
        (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const txt = (btn.textContent || '').trim();
          const onclickStr = btn.getAttribute('onclick') || '';
          const inSalesHistory = btn.closest('#view-sales, #posRecentSalesModal, #recentSalesModal');

          if (
            inSalesHistory &&
            (txt.includes('تعديل') || onclickStr.includes('edit') || onclickStr.includes('Edit'))
          ) {
            this.captureEditedSaleSnapshotNow();
          }
        },
        true
      );

      // 2. اعتراض كافة دوال تحميل فاتورة للتعديل في window.App
      Object.keys(window.App).forEach((fnKey) => {
        if (typeof window.App[fnKey] === 'function' && /edit.*sale|load.*sale.*edit/i.test(fnKey)) {
          const orig = window.App[fnKey].bind(window.App);
          window.App[fnKey] = async function (...args) {
            const res = await orig(...args);
            Enforcer.captureEditedSaleSnapshotNow(args[0]);
            return res;
          };
        }
      });

      // 3. فرض المعادلة المحاسبية الدقيقة عند إتمام البيع أو إعادة تأكيد الفاتورة المعدلة
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (!origFn || window.App['_exactDeltaHook_' + fnName]) return;

        window.App[fnName] = async function (...args) {
          const cart = window.App.currentCart;
          const itemsSnapshot = cart && Array.isArray(cart.items) ? JSON.parse(JSON.stringify(cart.items)) : [];
          const discountSnapshot = Number(cart?.discount || 0);
          const redeemedPts = Number(cart?._redeemedPoints || 0);
          const cid = Number(cart?.customerId || document.getElementById('posCustomerSelect')?.value || 0);

          const isEditing = Boolean(
            (Enforcer.editSnapshot && Enforcer.editSnapshot.active) ||
            cart?._isGherbiEditedSale ||
            cart?.editingSaleId ||
            window.AppState?.editingSaleId
          );

          const custBefore = cid ? (window.AppState.customers || []).find((c) => Number(c.id) === cid) : null;
          const balanceBeforeSubmit = isEditing && Enforcer.editSnapshot && Enforcer.editSnapshot.customerId === cid
            ? Number(Enforcer.editSnapshot.customerBalanceBeforeEdit)
            : (custBefore ? Number(custBefore.loyalty_points || 0) : 0);

          const oldSalePts = isEditing
            ? Number(Enforcer.editSnapshot?.oldSaleEarnedPoints ?? cart?._oldSaleEarnedPoints ?? 0)
            : 0;
          const newSalePts = Enforcer.calcEligiblePoints(itemsSnapshot, discountSnapshot);

          const result = await origFn(...args);

          if (cid && itemsSnapshot.length > 0) {
            // حساب الرصيد النهائي الدقيق:
            // في التعديل: الرصيد قبل التعديل - النقاط المختزلة + (النقاط الجديدة - النقاط القديمة)
            // في البيع الجديد: الرصيد قبل البيع - النقاط المختزلة + النقاط الجديدة المؤهلة
            const netDeltaPts = isEditing ? (newSalePts - oldSalePts) : newSalePts;
            const exactTargetBalance = Math.max(0, balanceBeforeSubmit - redeemedPts + netDeltaPts);

            const applyExactPointsToDbAndState = async () => {
              if (window.api?.updateCustomer) {
                const latestCust = (window.AppState.customers || []).find((c) => Number(c.id) === cid) || custBefore || { id: cid };
                await window.api.updateCustomer(cid, {
                  ...latestCust,
                  id: cid,
                  loyalty_points: exactTargetBalance
                }).catch(() => {});
              }
              if (Array.isArray(window.AppState.customers)) {
                const idx = window.AppState.customers.findIndex((c) => Number(c.id) === cid);
                if (idx !== -1) {
                  window.AppState.customers[idx].loyalty_points = exactTargetBalance;
                }
              }
              window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
            };

            // نطبق التثبيت فوراً وبعد 250ms و 600ms لضمان التفوق على أي استعلام خلفي في database.js أو renderer-rc-100.js
            await applyExactPointsToDbAndState();
            setTimeout(applyExactPointsToDbAndState, 250);
            setTimeout(applyExactPointsToDbAndState, 650);

            if (isEditing && window.showToast) {
              const sign = netDeltaPts > 0 ? '+' + netDeltaPts : String(netDeltaPts);
              window.showToast(
                `👑 تسوية نقاط التعديل: السابقة (${oldSalePts}) ⬅ الجديدة (${newSalePts}) | الصافي المضاف للزبون: (${sign} نقطة) | الرصيد الآن: ${exactTargetBalance}`,
                'success'
              );
            }
          }

          Enforcer.clearEditSnapshot();
          return result;
        };
        window.App['_exactDeltaHook_' + fnName] = true;
      });
    }
  };

  window.GherbiStage12Enforcer = Enforcer;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Enforcer.init());
  } else {
    Enforcer.init();
  }
})();


/* ==================== [MODULE: gherbi-v5-stage1-walkin-and-edit.js] ==================== */
/**
 * gherbi-v5-stage1-walkin-and-edit.js
 * المحرك التنفيذي للشطر الأول (الإصدار 5):
 * - منع ظهور شريط "تعديل فاتورة سابقة" في المبيعات العادية، وحصره في التعديل الحقيقي من السجل فقط
 * - إرجاع الزبون تلقائياً إلى "زبون عابر" بعد كل عملية بيع وتصفير النقاط المختزلة
 */

'use strict';

(function initGherbiV5Stage1() {
  const V5Stage1 = {
    lastSoldCustomerId: null,
    lastSoldCustomerName: '',
    quickRelinkTimer: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.fixStrictEditBannerLogic();
        this.setupAutoResetToWalkInAfterSale();
        console.log('🚀 [Gherbi V5 - Stage 1]: تم تفعيل ضبط شريط التعديل والإرجاع التلقائي للزبون العابر.');
      }, 180);
    },

    // ========================================================================
    // 1. حصر شريط "تعديل فاتورة سابقة" في حالة التعديل الفعلي فقط
    // ========================================================================
    isStrictlyEditingPreviousSale() {
      const cart = window.App?.currentCart;
      if (!cart) return false;

      const explicitSaleId = Number(cart.editingSaleId || window.AppState?.editingSaleId || 0);
      const editBannerEl = document.getElementById('posEditSaleBanner');
      const isOrigBannerVisible = Boolean(
        editBannerEl &&
        !editBannerEl.classList.contains('hidden') &&
        editBannerEl.offsetParent !== null
      );

      return explicitSaleId > 0 || isOrigBannerVisible || Boolean(cart._strictHistoryEditActive);
    },

    fixStrictEditBannerLogic() {
      // مسح أي حالة تعديل وهمية عالقة من الجلسة السابقة عند الإقلاع
      if (window.GherbiStage12Enforcer) {
        window.GherbiStage12Enforcer.editSnapshot = null;
      }
      if (window.App?.currentCart && !window.App.currentCart.editingSaleId && !window.AppState?.editingSaleId) {
        delete window.App.currentCart._isGherbiEditedSale;
        delete window.App.currentCart._oldSaleEarnedPoints;
        delete window.App.currentCart._strictHistoryEditActive;
      }
      document.getElementById('gherbiLiveDeltaLoyaltyBanner')?.classList.add('hidden');

      if (window.GherbiStage12Enforcer) {
        // استبدال دالة تحديث الشريط لتفحص التعديل الحقيقي فقط
        window.GherbiStage12Enforcer.updateLiveEditDeltaBanner = () => {
          const banner = document.getElementById('gherbiLiveDeltaLoyaltyBanner');
          const cart = window.App?.currentCart;

          if (!this.isStrictlyEditingPreviousSale() || !cart || !Array.isArray(cart.items) || cart.items.length === 0) {
            if (banner) banner.classList.add('hidden');
            return;
          }

          const snap = window.GherbiStage12Enforcer.editSnapshot;
          if (!snap || !snap.active) return;

          const topDeck = document.getElementById('gherbiCartTopDeck');
          if (!topDeck) return;

          let activeBanner = banner;
          if (!activeBanner) {
            activeBanner = document.createElement('div');
            activeBanner.id = 'gherbiLiveDeltaLoyaltyBanner';
            activeBanner.className = 'gherbi-delta-loyalty-banner';
            topDeck.insertBefore(activeBanner, topDeck.firstChild);
          }

          const oldPts = Number(snap.oldSaleEarnedPoints || 0);
          const newPts = window.GherbiStage12Enforcer.calcEligiblePoints(cart.items, cart.discount || 0);
          const delta = newPts - oldPts;
          const deltaStr = delta > 0 ? `+${delta} نقطة إضافية` : delta < 0 ? `${delta} نقطة (خصم ما حُذف)` : '0 نقطة (بدون تغيير)';
          const badgeColor = delta > 0 ? 'bg-emerald-500 text-slate-950' : delta < 0 ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-200';

          activeBanner.classList.remove('hidden');
          activeBanner.innerHTML = `
            <div class="flex items-center gap-1.5">
              <span>👑 تعديل فاتورة سابقة (#${snap.saleId || ''}):</span>
              <span>نقاطها السابقة (<strong class="font-mono text-amber-300">${oldPts}</strong>)</span>
              <span>⬅</span>
              <span>الآن (<strong class="font-mono text-emerald-300">${newPts}</strong>)</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="px-2 py-0.5 rounded font-mono font-black ${badgeColor}">الصافي: ${deltaStr}</span>
              <button type="button" onclick="GherbiV5Stage1.cancelEditModeBanner()" title="إلغاء وضع التعديل" class="text-slate-300 hover:text-rose-400 px-1 font-black">✕</button>
            </div>
          `;
        };

        window.GherbiStage12Enforcer.captureEditedSaleSnapshotNow = (saleIdHint = null) => {
          setTimeout(() => {
            const cart = window.App?.currentCart;
            if (!cart) return;
            const realSaleId = saleIdHint || cart.editingSaleId || window.AppState?.editingSaleId;
            if (!realSaleId && !cart._strictHistoryEditActive) return;

            const cid = Number(cart.customerId || document.getElementById('posCustomerSelect')?.value || 0);
            const cust = cid ? (window.AppState.customers || []).find((c) => Number(c.id) === cid) : null;
            const curPts = cust ? Number(cust.loyalty_points || 0) : 0;
            const oldPts = window.GherbiStage12Enforcer.calcEligiblePoints(cart.items || [], cart.discount || 0);

            window.GherbiStage12Enforcer.editSnapshot = {
              active: true,
              saleId: realSaleId || 'تعديل',
              customerId: cid,
              customerBalanceBeforeEdit: curPts,
              oldSaleEarnedPoints: oldPts,
              capturedAt: Date.now()
            };
            cart._isGherbiEditedSale = true;
            cart._oldSaleEarnedPoints = oldPts;
            window.GherbiStage12Enforcer.updateLiveEditDeltaBanner();
          }, 180);
        };
      }

      // تفعيل علامة _strictHistoryEditActive فقط عند النقر على زر "تعديل" داخل سجل المبيعات
      document.addEventListener(
        'click',
        (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const txt = (btn.textContent || '').trim();
          const onclickStr = btn.getAttribute('onclick') || '';
          const inHistory = btn.closest('#view-sales, #posRecentSalesModal, #recentSalesModal');
          if (inHistory && (txt.includes('تعديل') || /edit/i.test(onclickStr))) {
            setTimeout(() => {
              if (window.App?.currentCart) {
                window.App.currentCart._strictHistoryEditActive = true;
                window.GherbiStage12Enforcer?.captureEditedSaleSnapshotNow();
              }
            }, 120);
          }
        },
        true
      );
    },

    cancelEditModeBanner() {
      if (window.GherbiStage12Enforcer) {
        window.GherbiStage12Enforcer.editSnapshot = null;
      }
      if (window.App?.currentCart) {
        delete window.App.currentCart._isGherbiEditedSale;
        delete window.App.currentCart._oldSaleEarnedPoints;
        delete window.App.currentCart._strictHistoryEditActive;
        delete window.App.currentCart.editingSaleId;
      }
      if (window.AppState) {
        window.AppState.editingSaleId = null;
      }
      document.getElementById('gherbiLiveDeltaLoyaltyBanner')?.classList.add('hidden');
      document.getElementById('posEditSaleBanner')?.classList.add('hidden');
    },

    // ========================================================================
    // 2. الإرجاع التلقائي للزبون العابر بعد كل عملية بيع أو إلغاء أو تعليق
    // ========================================================================
    resetActiveCartToWalkInCustomer(previousCustId = null) {
      const cart = window.App?.currentCart;
      if (previousCustId) {
        const prevCust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(previousCustId));
        if (prevCust) {
          this.lastSoldCustomerId = prevCust.id;
          this.lastSoldCustomerName = prevCust.name;
          this.showQuickRelinkCustomerChip();
        }
      }

      if (cart) {
        cart.customerId = '';
        cart.discount = 0;
        cart._redeemedPoints = 0;
        cart.couponCode = '';
        cart.couponDiscount = 0;
        delete cart._isGherbiEditedSale;
        delete cart._oldSaleEarnedPoints;
        delete cart._strictHistoryEditActive;
        delete cart.editingSaleId;
      }

      if (window.AppState) {
        window.AppState.editingSaleId = null;
      }

      const custSelect = document.getElementById('posCustomerSelect');
      if (custSelect) {
        custSelect.value = '';
        custSelect.dispatchEvent(new Event('change'));
      }

      const discInp = document.getElementById('cartDiscountInput');
      if (discInp) discInp.value = '0';

      const redeemInp = document.getElementById('smartRedeemPointsInput');
      if (redeemInp) redeemInp.value = '0';

      const cashInp = document.getElementById('gherbiReceivedCashInput');
      if (cashInp) cashInp.value = '';

      this.cancelEditModeBanner();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      window.GherbiV4Stage1?.computeChangeInstant?.(0);
      window.GherbiStage12Enforcer?.updateChangeInstant(0);
      window.App?.recalcAndRenderCart?.();
    },

    showQuickRelinkCustomerChip() {
      if (!this.lastSoldCustomerId) return;
      const topDeck = document.getElementById('gherbiCartTopDeck');
      if (!topDeck) return;

      let chip = document.getElementById('gherbiQuickRelinkPrevCustBtn');
      if (!chip) {
        chip = document.createElement('button');
        chip.id = 'gherbiQuickRelinkPrevCustBtn';
        chip.type = 'button';
        chip.className = 'w-full py-1 px-2.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-500/30 text-[10.5px] font-black flex items-center justify-between transition';
        topDeck.appendChild(chip);
      }

      chip.classList.remove('hidden');
      chip.innerHTML = `
        <span>👤 عادت السلة إلى (زبون عابر) تلقائياً</span>
        <span class="underline">↩️ إعادة اختيار (${this.lastSoldCustomerName})؟</span>
      `;
      chip.onclick = () => {
        if (window.RetailMaster && this.lastSoldCustomerId) {
          window.RetailMaster.pickCustomerInSmartModal(this.lastSoldCustomerId);
          chip.classList.add('hidden');
          if (window.showToast) window.showToast(`👑 تمت إعادة ربط السلة بالزبون: ${this.lastSoldCustomerName}`, 'info');
        }
      };

      if (this.quickRelinkTimer) clearTimeout(this.quickRelinkTimer);
      this.quickRelinkTimer = setTimeout(() => {
        chip?.classList.add('hidden');
      }, 15000);
    },

    setupAutoResetToWalkInAfterSale() {
      // اعتراض إتمام البيع (سواء بنافذة التسديد F1 أو التذكرة الفورية Echap أو الحفظ بدون طباعة)
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (!origFn || window.App['_v5WalkInReset_' + fnName]) return;

        window.App[fnName] = async function (...args) {
          const prevCid = window.App.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value || null;
          const res = await origFn(...args);

          // إذا تمت البيعة بنجاح وأصبحت السلة فارغة، نرجع الزبون فوراً إلى "زبون عابر"
          setTimeout(() => {
            const remainingItems = window.App.currentCart?.items || [];
            if (remainingItems.length === 0) {
              V5Stage1.resetActiveCartToWalkInCustomer(prevCid);
            }
          }, 120);

          return res;
        };
        window.App['_v5WalkInReset_' + fnName] = true;
      });

      // اعتراض إلغاء السلة (F4) وتعليق المسودة (F2) لإرجاع الزبون العابر أيضاً
      ['clearCurrentCart', 'holdCurrentCart'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (!origFn || window.App['_v5WalkInClear_' + fnName]) return;

        window.App[fnName] = function (...args) {
          const res = origFn(...args);
          setTimeout(() => {
            V5Stage1.resetActiveCartToWalkInCustomer(null);
          }, 60);
          return res;
        };
        window.App['_v5WalkInClear_' + fnName] = true;
      });
    }
  };

  window.GherbiV5Stage1 = V5Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V5Stage1.init());
  } else {
    V5Stage1.init();
  }
})();


/* ==================== [MODULE: gherbi-v6-stage1-confirm-and-walkin.js] ==================== */
/**
 * gherbi-v6-stage1-confirm-and-walkin.js (Clean & Syntax-Verified V8 Edition)
 * - نافذة احترافية غير حاجزة عند حذف السلة تضم:
 *   1) زر "⏸️ إضافتها إلى المسودات (F2)"
 *   2) زر "🗑️ تأكيد الحذف النهائي (Enter)"
 *   3) زر "إلغاء (Esc)"
 * - منع ظهور نافذة window.confirm الأصلية نهائياً وعدم تجميد الكيبورد
 * - الحفاظ على السلة النشطة عند التنقل بين الصفحات، والبدء بسلة جديدة على الزبون العابر عند تشغيل البرنامج فقط
 */

'use strict';

(function initGherbiV6Stage1Clean() {
  const V6Stage1 = {
    pendingDeleteCartIdx: null,
    lastDeletedCartBackup: null,
    undoToastTimer: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.buildProCartConfirmModal();
        this.interceptAllCartCloseActions();
        this.setupBootWalkInWithoutClearingOnTabSwitch();
        this.bindAltNumberCartSwitching();
        console.log('✅ [Gherbi V6 Stage 1 Fixed]: نافذة حذف السلة الاحترافية (نقل للمسودات / حذف نهائي) نشطة 100%.');
      }, 160);
    },

    // ========================================================================
    // 1. بناء نافذة حذف السلة الاحترافية (إضافتها للمسودات | تأكيد الحذف النهائي)
    // ========================================================================
    buildProCartConfirmModal() {
      const existing = document.getElementById('gherbiProCartConfirmModal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'gherbiProCartConfirmModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content w-full max-w-lg p-0 overflow-hidden rounded-2xl border-2 border-rose-500/60 shadow-2xl bg-white dark:bg-slate-900 text-xs">
          <!-- الهيدر -->
          <div class="px-5 py-3.5 bg-gradient-to-l from-slate-900 via-rose-950 to-slate-900 text-white flex items-center justify-between border-b border-rose-500/30">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
                <span class="material-symbols-rounded icon-sm">shopping_cart_off</span>
              </div>
              <div>
                <h3 id="proCartConfirmTitle" class="text-sm font-black text-white">إغلاق أو حذف السلة</h3>
                <p class="text-[10.5px] text-rose-300 font-bold">اختر إضافتها إلى المسودات للرجوع إليها لاحقاً أو تأكيد حذفها النهائي</p>
              </div>
            </div>
            <button type="button" onclick="GherbiV6Stage1.closeProCartConfirm()"
              class="w-7 h-7 rounded-full bg-white/10 hover:bg-rose-600 text-white font-black flex items-center justify-center transition">✕</button>
          </div>

          <div class="p-5 space-y-4">
            <!-- تفاصيل السلة -->
            <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <span class="text-2xl leading-none">🛒</span>
              <div class="space-y-1 flex-1">
                <div id="proCartConfirmMessage" class="font-black text-sm text-slate-800 dark:text-slate-100">
                  هذه السلة تحتوي على أصناف. ماذا تريد أن تفعل بها؟
                </div>
                <div id="proCartConfirmSubDetails" class="text-[11px] font-bold text-slate-500 dark:text-slate-400"></div>
              </div>
            </div>

            <!-- الأزرار الثلاثة الواضحة: إلغاء | إضافتها إلى المسودات (F2) | تأكيد الحذف النهائي (Enter) -->
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="GherbiV6Stage1.closeProCartConfirm()"
                class="sm:col-span-3 py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-black text-xs transition">
                إلغاء (Esc)
              </button>

              <button type="button" onclick="GherbiV6Stage1.moveCartToDraftsInstead()"
                class="sm:col-span-4 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition">
                <span>⏸️</span>
                <span>إضافتها للمسودات (F2)</span>
              </button>

              <button type="button" id="proCartConfirmYesBtn" onclick="GherbiV6Stage1.executeConfirmedCartDelete()"
                class="sm:col-span-5 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition">
                <span class="material-symbols-rounded icon-sm">delete_forever</span>
                <span>تأكيد الحذف النهائي (Enter)</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // اختصارات الكيبورد داخل النافذة الاحترافية (Enter = حذف نهائي | F2 = إضافة للمسودات | Esc = إلغاء)
      window.addEventListener(
        'keydown',
        (e) => {
          const m = document.getElementById('gherbiProCartConfirmModal');
          if (!m || !m.classList.contains('active')) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            this.executeConfirmedCartDelete();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.closeProCartConfirm();
          } else if (e.key === 'F2') {
            e.preventDefault();
            e.stopPropagation();
            this.moveCartToDraftsInstead();
          }
        },
        true
      );
    },

    restorePosKeyboardFocus() {
      setTimeout(() => {
        window.focus();
        if (typeof window.App?.focusBarcodeMagnet === 'function') {
          window.App.focusBarcodeMagnet(true);
        } else {
          document.getElementById('barcodeInput')?.focus();
        }
      }, 40);
    },

    openProCartConfirm(idx) {
      if (!document.getElementById('gherbiProCartConfirmModal')) {
        this.buildProCartConfirmModal();
      }
      const carts = window.AppState?.carts || [];
      const targetIdx = idx !== undefined && idx !== null ? Number(idx) : Number(window.AppState?.activeCartIndex || 0);
      const target = carts[targetIdx];
      if (!target) return;

      this.pendingDeleteCartIdx = targetIdx;
      const items = target.items || [];
      const totalDzd = items.reduce(
        (s, it) => s + Number(it.subtotal ?? Number(it.quantity || 1) * Number(it.price || 0)),
        0
      );
      const previewNames = items
        .slice(0, 3)
        .map((it) => it.name || it.custom_product_name || 'صنف')
        .join(' ، ');

      const cartLabel = target.label || `سلة #${targetIdx + 1}`;
      const titleEl = document.getElementById('proCartConfirmTitle');
      const msgEl = document.getElementById('proCartConfirmMessage');
      const subEl = document.getElementById('proCartConfirmSubDetails');

      if (titleEl) titleEl.textContent = `إغلاق أو حذف (${cartLabel})`;
      if (msgEl) {
        msgEl.textContent = `السلة (${cartLabel}) تحتوي على ${items.length} أصناف بإجمالي ${totalDzd.toFixed(2)} د.ج. هل تريد إضافتها للمسودات أم حذفها نهائياً؟`;
      }
      if (subEl) {
        subEl.textContent = `🛒 الأصناف: ${previewNames}${items.length > 3 ? ' ...' : ''}`;
      }

      window.App.openModal('gherbiProCartConfirmModal');
      setTimeout(() => document.getElementById('proCartConfirmYesBtn')?.focus(), 50);
    },

    closeProCartConfirm() {
      this.pendingDeleteCartIdx = null;
      window.App.closeModal('gherbiProCartConfirmModal');
      this.restorePosKeyboardFocus();
    },

    // الخيار 1: إضافة السلة إلى المسودات (F2) وإغلاق/تفريغ التبويب
    moveCartToDraftsInstead() {
      const idx = this.pendingDeleteCartIdx;
      this.closeProCartConfirm();
      if (idx === null || idx === undefined) return;

      const carts = window.AppState?.carts || [];
      const target = carts[idx];
      if (!target || !Array.isArray(target.items) || target.items.length === 0) return;

      // التبديل إلى السلة المراد تعليقها واستدعاء holdCurrentCart الرسمي
      window.AppState.activeCartIndex = idx;
      if (typeof window.App?.holdCurrentCart === 'function') {
        window.App.holdCurrentCart();
      } else {
        if (!Array.isArray(window.AppState.draftCarts)) window.AppState.draftCarts = [];
        window.AppState.draftCarts.unshift({
          ...JSON.parse(JSON.stringify(target)),
          savedAt: new Date().toLocaleTimeString('ar-DZ')
        });
      }

      // إذا كان هناك أكثر من سلة مفتوحة، نغلق التبويب الذي أصبح فارغاً بعد نقله للمسودات
      if (carts.length > 1 && (!carts[idx]?.items || carts[idx].items.length === 0)) {
        carts.splice(idx, 1);
        carts.forEach((c, i) => {
          c.label = `سلة #${i + 1}`;
        });
        window.AppState.activeCartIndex = Math.max(0, Math.min(window.AppState.activeCartIndex || 0, carts.length - 1));
      }

      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      if (window.showToast) {
        window.showToast('⏸️ تمت إضافة السلة إلى المسودات (F3) بنجاح!', 'success');
      }
      this.restorePosKeyboardFocus();
    },

    // الخيار 2: تأكيد الحذف النهائي للسلة
    executeConfirmedCartDelete() {
      const idx = this.pendingDeleteCartIdx;
      this.closeProCartConfirm();
      if (idx === null || idx === undefined) return;
      this.performSilentCartDelete(idx);
    },

    performSilentCartDelete(idx) {
      const carts = window.AppState?.carts || [];
      const target = carts[idx];
      if (!target) return;

      if (Array.isArray(target.items) && target.items.length > 0) {
        this.lastDeletedCartBackup = JSON.parse(JSON.stringify(target));
        this.showUndoDeletedCartBanner(target.label || `سلة #${idx + 1}`, target.items.length);
      }

      if (carts.length <= 1) {
        carts[0] = {
          id: 'cart_' + Date.now(),
          label: 'سلة #1',
          items: [],
          customerId: '',
          priceTier: 'retail',
          discount: 0,
          _redeemedPoints: 0
        };
        window.AppState.activeCartIndex = 0;
      } else {
        carts.splice(idx, 1);
        carts.forEach((c, i) => {
          c.label = `سلة #${i + 1}`;
        });
        if (window.AppState.activeCartIndex >= carts.length) {
          window.AppState.activeCartIndex = Math.max(0, carts.length - 1);
        }
      }

      const activeCart = carts[window.AppState.activeCartIndex || 0];
      if (activeCart && (!activeCart.items || activeCart.items.length === 0)) {
        activeCart.customerId = '';
        activeCart.discount = 0;
        activeCart._redeemedPoints = 0;
        const sel = document.getElementById('posCustomerSelect');
        if (sel) sel.value = '';
      }

      localStorage.removeItem('gherbi_crash_recovery_carts');
      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      this.restorePosKeyboardFocus();
    },

    showUndoDeletedCartBanner(label, count) {
      let toast = document.getElementById('gherbiUndoCartToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'gherbiUndoCartToast';
        toast.className = 'gherbi-undo-cart-toast';
        document.body.appendChild(toast);
      }
      toast.classList.remove('hidden');
      toast.innerHTML = `
        <span>🗑️ تم الحذف النهائي لـ (${label}) وبها ${count} أصناف</span>
        <button type="button" onclick="GherbiV6Stage1.restoreLastDeletedCart()"
          class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">
          ↩️ تراجع واسترجاع السلة
        </button>
        <button type="button" onclick="document.getElementById('gherbiUndoCartToast').classList.add('hidden')" class="text-slate-400 hover:text-white">✕</button>
      `;

      if (this.undoToastTimer) clearTimeout(this.undoToastTimer);
      this.undoToastTimer = setTimeout(() => {
        toast?.classList.add('hidden');
      }, 8000);
    },

    restoreLastDeletedCart() {
      if (!this.lastDeletedCartBackup) return;
      const carts = window.AppState?.carts || [];
      const restored = JSON.parse(JSON.stringify(this.lastDeletedCartBackup));
      this.lastDeletedCartBackup = null;
      document.getElementById('gherbiUndoCartToast')?.classList.add('hidden');

      const cur = window.App.currentCart;
      if (cur && (!cur.items || cur.items.length === 0)) {
        carts[window.AppState.activeCartIndex || 0] = restored;
      } else {
        carts.push(restored);
        window.AppState.activeCartIndex = carts.length - 1;
      }
      carts.forEach((c, i) => {
        c.label = `سلة #${i + 1}`;
      });

      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      if (window.showToast) window.showToast('✅ تمت استعادة السلة المحذوفة بكامل أصنافها!', 'success');
      this.restorePosKeyboardFocus();
    },

    // ========================================================================
    // 2. اعتراض ثلاثي الطبقات لمنع ظهور نافذة window.confirm الأصلية نهائياً
    // ========================================================================
    interceptAllCartCloseActions() {
      const handleCloseCartIndex = (idx, event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        const carts = window.AppState?.carts || [];
        const target = carts[idx];
        if (!target) return;

        if (Array.isArray(target.items) && target.items.length > 0) {
          this.openProCartConfirm(idx);
        } else {
          this.performSilentCartDelete(idx);
        }
      };

      // الطبقة 1: اعتراض النقر على أي زر ✕ داخل تبويبات السلات في مرحلة Capture قبل وصوله لأي كود قديم
      document.addEventListener(
        'click',
        (e) => {
          const closeEl = e.target.closest(
            '[onclick*="closeCartTab"], [onclick*="deleteOrClearCartTab"], [onclick*="removeOrClearCartTab"], .gherbi-cart-tab-close'
          );
          if (!closeEl) return;
          const onclickStr = closeEl.getAttribute('onclick') || '';
          const match = onclickStr.match(/(?:closeCartTab|deleteOrClearCartTab|removeOrClearCartTab)\s*\(\s*(\d+)/);
          if (match && match[1] !== undefined) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            handleCloseCartIndex(parseInt(match[1], 10), e);
          }
        },
        true
      );

      // الطبقة 2: استبدال الدوال البرمجية مباشرة
      const enforceMethodOverrides = () => {
        if (window.App) {
          window.App.closeCartTab = handleCloseCartIndex;
        }
        if (window.GherbiMasterUpgrade) {
          window.GherbiMasterUpgrade.deleteOrClearCartTab = handleCloseCartIndex;
        }
        if (window.GherbiMasterUpgrades) {
          window.GherbiMasterUpgrades.removeOrClearCartTab = handleCloseCartIndex;
        }
      };
      enforceMethodOverrides();
      setInterval(enforceMethodOverrides, 500);

      // الطبقة 3: درع حماية على window.confirm لمنع نافذة "هل تريد حذفها وإغلاقها؟" حتى لو استُدعيت من داخل دالة مغلقة
      if (!window._gherbiConfirmShielded) {
        const nativeConfirm = window.confirm.bind(window);
        window.confirm = function (message) {
          const msgStr = String(message || '');
          if (msgStr.includes('حذفها وإغلاقها') || (msgStr.includes('السلة') && msgStr.includes('أصناف'))) {
            const matchIdx = msgStr.match(/#(\d+)/);
            const targetIdx = matchIdx && matchIdx[1] ? parseInt(matchIdx[1], 10) - 1 : (window.AppState?.activeCartIndex || 0);
            setTimeout(() => V6Stage1.openProCartConfirm(targetIdx), 10);
            return false;
          }
          return nativeConfirm(message);
        };
        window._gherbiConfirmShielded = true;
      }

      // ضمان أن إنشاء سلة جديدة (+ سلة / Ctrl+N) يبدأ دائماً بالزبون العابر
      window.App.newCartTab = () => {
        const carts = window.AppState?.carts || [];
        carts.push({
          id: 'cart_' + Date.now(),
          label: `سلة #${carts.length + 1}`,
          items: [],
          customerId: '',
          priceTier: 'retail',
          discount: 0,
          _redeemedPoints: 0
        });
        window.AppState.activeCartIndex = carts.length - 1;
        const sel = document.getElementById('posCustomerSelect');
        if (sel) sel.value = '';
        window.App.renderPosView?.();
        window.App.renderCartTabs?.();
        window.App.renderCartItems?.();
        window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
        this.restorePosKeyboardFocus();
      };
    },

    // ========================================================================
    // 3. البدء بسلة نظيفة وزبون عابر عند إقلاع البرنامج فقط، مع الحفاظ على السلة عند التنقل
    // ========================================================================
    forceWalkInOnCart(cartObj) {
      if (!cartObj) return;
      cartObj.customerId = '';
      cartObj.discount = 0;
      cartObj._redeemedPoints = 0;
      delete cartObj._isGherbiEditedSale;
      delete cartObj._oldSaleEarnedPoints;
      delete cartObj._strictHistoryEditActive;
      delete cartObj.editingSaleId;

      const sel = document.getElementById('posCustomerSelect');
      if (sel) sel.value = '';
      const discInp = document.getElementById('cartDiscountInput');
      if (discInp) discInp.value = '0';
      const cashInp = document.getElementById('gherbiReceivedCashInput');
      if (cashInp) cashInp.value = '';

      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
    },

    openFreshWalkInCartOnPosEntry(isInitialBoot = false) {
      if (!isInitialBoot) {
        // عند التنقل بين الصفحات والعودة لشاشة المبيعات: لا نفتح سلة جديدة بل نحافظ على السلة الحالية كما هي!
        this.restorePosKeyboardFocus();
        return;
      }

      localStorage.removeItem('gherbi_crash_recovery_carts');
      window.AppState.carts = [
        {
          id: 'cart_' + Date.now(),
          label: 'سلة #1',
          items: [],
          customerId: '',
          priceTier: 'retail',
          discount: 0,
          _redeemedPoints: 0
        }
      ];
      window.AppState.activeCartIndex = 0;
      this.forceWalkInOnCart(window.AppState.carts[0]);

      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      this.restorePosKeyboardFocus();
    },

    setupBootWalkInWithoutClearingOnTabSwitch() {
      setTimeout(() => {
        this.openFreshWalkInCartOnPosEntry(true);
      }, 320);
    },

    bindAltNumberCartSwitching() {
      window.addEventListener('keydown', (e) => {
        const posSec = document.getElementById('view-pos');
        if (!posSec || !posSec.classList.contains('active')) return;
        if (e.altKey && /^[1-9]$/.test(e.key)) {
          const targetIdx = parseInt(e.key, 10) - 1;
          const carts = window.AppState?.carts || [];
          if (carts[targetIdx]) {
            e.preventDefault();
            window.App.switchCartTab?.(targetIdx);
          }
        }
      });
    }
  };

  window.GherbiV6Stage1 = V6Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V6Stage1.init());
  } else {
    V6Stage1.init();
  }
})();


/* ==================== [MODULE: gherbi-v7-stage1-vault-and-walkin.js] ==================== */
/**
 * gherbi-v7-stage1-vault-and-walkin.js
 * المحرك التنفيذي للشطر الأول (الإصدار 7):
 * 1. الحفاظ على السلة النشطة عند التنقل بين الأقسام دون فتح سلة جديدة، مع بدء البرنامج فقط على سلة نظيفة وزبون عابر.
 * 2. خزنة طوارئ الكهرباء والفواتير غير المسجلة (Black-Box Unsaved Invoices Vault) لحماية المشتريات من الانقطاع المفاجئ.
 * 3. زر "👤 عابر (Alt+W)" داخل شريط الزبون + اختصار لوحة المفاتيح (Alt+W) وإضافته لدليل الاختصارات.
 */

'use strict';

(function initGherbiV7Stage1() {
  const VAULT_STORAGE_KEY = 'gherbi_blackbox_unsaved_vault_v7';
  const PREV_SESSION_KEY = 'gherbi_previous_session_live_carts_v7';

  const V7Stage1 = {
    init() {
      this.archiveInterruptedSessionBeforeBootReset();

      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.preserveActiveCartOnViewSwitch();
        this.buildCrashRecoveryVaultModal();
        this.injectVaultAndWalkInButtons();
        this.setupRealTimeBlackBoxRecorder();
        this.bindWalkInShortcutAndRegisterInHub();
        console.log('🚀 [Gherbi V7 - Stage 1]: ثبات السلة + خزنة طوارئ الكهرباء + زر واختصار الزبون العابر (Alt+W) جاهزة.');
      }, 180);
    },

    // ========================================================================
    // 1. أرشفة أي فاتورة غير مسجلة من الجلسة السابقة (في حال انقطاع الكهرباء أو الإغلاق المفاجئ)
    // ========================================================================
    archiveInterruptedSessionBeforeBootReset() {
      try {
        const rawLive = localStorage.getItem(PREV_SESSION_KEY);
        if (!rawLive) return;
        const liveCarts = JSON.parse(rawLive);
        if (!Array.isArray(liveCarts)) return;

        const nonEmptyCarts = liveCarts.filter((c) => Array.isArray(c.items) && c.items.length > 0);
        if (nonEmptyCarts.length > 0) {
          const vault = this.getVaultRecords();
          nonEmptyCarts.forEach((cart) => {
            const total = cart.items.reduce(
              (s, it) => s + Number(it.subtotal ?? Number(it.quantity || 1) * Number(it.price || 0)),
              0
            );
            const sig = cart.items.map((i) => `${i.name}:${i.quantity}:${i.price}`).join('|') + '|' + (cart.customerId || '');
            // عدم تكرار نفس السلة في الخزنة إذا كانت محفوظة مسبقاً بنفس البصمة
            if (!vault.some((v) => v.signature === sig)) {
              vault.unshift({
                id: 'vault_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                savedAt: cart._lastModifiedAt || new Date().toLocaleString('ar-DZ'),
                reason: '⚡ فاتورة غير مسجلة (إغلاق مفاجئ / انقطاع تيار)',
                customerId: cart.customerId || '',
                customerName: cart.customerName || 'زبون عابر',
                discount: Number(cart.discount || 0),
                items: cart.items,
                totalDzd: Number(Math.max(0, total - Number(cart.discount || 0)).toFixed(2)),
                signature: sig
              });
            }
          });
          localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault.slice(0, 35)));
        }
        localStorage.removeItem(PREV_SESSION_KEY);
      } catch (_) {}
    },

    getVaultRecords() {
      try {
        const raw = localStorage.getItem(VAULT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    },

    saveVaultRecords(list) {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify((list || []).slice(0, 35)));
      this.updateVaultButtonBadge();
    },

    // ========================================================================
    // 2. منع فتح سلة جديدة عند الخروج المؤقت من شاشة المبيعات والعودة إليها
    // ========================================================================
    preserveActiveCartOnViewSwitch() {
      if (window.GherbiV6Stage1) {
        // تعديل دالة openFreshWalkInCartOnPosEntry لتعمل فقط عند إقلاع البرنامج الأول (isInitialBoot === true)
        const origOpenFresh = window.GherbiV6Stage1.openFreshWalkInCartOnPosEntry?.bind(window.GherbiV6Stage1);
        window.GherbiV6Stage1.openFreshWalkInCartOnPosEntry = function (isInitialBoot = false) {
          if (!isInitialBoot) {
            // عند العودة من صفحة أخرى (كالمخزون أو السجل)، نحافظ على السلة الحالية كما هي 100%!
            this.restorePosKeyboardFocus?.();
            return;
          }
          if (origOpenFresh) return origOpenFresh(true);
        };
      }
    },

    // ========================================================================
    // 3. المسجل اللحظي للصندوق الأسود (Real-Time Black-Box Recorder ضد انقطاع الكهرباء)
    // ========================================================================
    setupRealTimeBlackBoxRecorder() {
      const recordCurrentCartsToBlackBox = () => {
        try {
          const carts = window.AppState?.carts || [];
          const hasAnyItems = carts.some((c) => Array.isArray(c.items) && c.items.length > 0);
          if (!hasAnyItems) {
            localStorage.removeItem(PREV_SESSION_KEY);
            return;
          }

          const customers = window.AppState?.customers || [];
          const enriched = carts
            .filter((c) => Array.isArray(c.items) && c.items.length > 0)
            .map((c) => {
              const cust = customers.find((x) => String(x.id) === String(c.customerId || ''));
              return {
                ...c,
                customerName: cust ? cust.name : 'زبون عابر',
                _lastModifiedAt: new Date().toLocaleString('ar-DZ')
              };
            });

          localStorage.setItem(PREV_SESSION_KEY, JSON.stringify(enriched));
        } catch (_) {}
      };

      // التسجيل الفوري مع كل تعديل في السلة
      if (!window.App._v7BlackBoxHooked && typeof window.App.recalcAndRenderCart === 'function') {
        const origRecalc = window.App.recalcAndRenderCart.bind(window.App);
        window.App.recalcAndRenderCart = function (...args) {
          const res = origRecalc(...args);
          recordCurrentCartsToBlackBox();
          V7Stage1.syncWalkInQuickButtonState();
          return res;
        };
        window.App._v7BlackBoxHooked = true;
      }

      // عند إتمام البيع بنجاح، نمسح السلة المباعة من ذاكرة الطوارئ الحية حتى لا تُسترجع كأنها غير مسجلة
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fn) => {
        const orig = window.App[fn]?.bind(window.App);
        if (orig && !window.App['_v7CleanLive_' + fn]) {
          window.App[fn] = async function (...args) {
            const res = await orig(...args);
            setTimeout(recordCurrentCartsToBlackBox, 150);
            return res;
          };
          window.App['_v7CleanLive_' + fn] = true;
        }
      });

      setInterval(recordCurrentCartsToBlackBox, 2000);
    },

    // حفظ السلة الحالية يدوياً في خزنة الفواتير غير المسجلة بضغطة زر
    snapshotCurrentCartToVaultManually() {
      const cart = window.App?.currentCart;
      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        if (window.showToast) window.showToast('⚠️ السلة الحالية فارغة لا تحتوي على أصناف لحفظها', 'warning');
        return;
      }
      const cust = (window.AppState.customers || []).find((c) => String(c.id) === String(cart.customerId || ''));
      const total = cart.items.reduce(
        (s, it) => s + Number(it.subtotal ?? Number(it.quantity || 1) * Number(it.price || 0)),
        0
      );
      const vault = this.getVaultRecords();
      vault.unshift({
        id: 'vault_' + Date.now(),
        savedAt: new Date().toLocaleString('ar-DZ'),
        reason: '📌 محفوظة يدوياً في خزنة الفواتير غير المسجلة',
        customerId: cart.customerId || '',
        customerName: cust ? cust.name : 'زبون عابر',
        discount: Number(cart.discount || 0),
        items: JSON.parse(JSON.stringify(cart.items)),
        totalDzd: Number(Math.max(0, total - Number(cart.discount || 0)).toFixed(2)),
        signature: Date.now().toString()
      });
      this.saveVaultRecords(vault);
      this.renderVaultItemsList();
      if (window.showToast) window.showToast('✅ تم حفظ نسخة من السلة الحالية في خزنة الطوارئ', 'success');
    },

    // ========================================================================
    // 4. نافذة خزنة الفواتير غير المسجلة وطوارئ الكهرباء (#gherbiCrashVaultModal)
    // ========================================================================
    buildCrashRecoveryVaultModal() {
      if (document.getElementById('gherbiCrashVaultModal')) return;

      const modal = document.createElement('div');
      modal.id = 'gherbiCrashVaultModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content w-full max-w-3xl p-0 overflow-hidden rounded-2xl border-2 border-amber-500/60 shadow-2xl bg-white dark:bg-slate-900 text-xs max-h-[88vh] flex flex-col">
          <!-- الهيدر -->
          <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl font-black">⚡</div>
              <div>
                <h3 class="text-sm font-black text-amber-400">خزنة الفواتير غير المسجلة وطوارئ انقطاع الكهرباء (Black-Box Vault)</h3>
                <p class="text-[11px] text-slate-400">تُحفظ هنا تلقائياً كل سلة لم تُسجل بعد أو انقطعت الكهرباء أثناء بيعها لتسترجعها بضغطة زر</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('gherbiCrashVaultModal')" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black">✕</button>
          </div>

          <!-- شريط الأدوات العلوي داخل النافذة -->
          <div class="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="font-bold text-[11px] text-amber-800 dark:text-amber-300">
              🛡️ الحماية الذاتية نشطة: يتم تسجيل كل حركة في السلة لحظياً في الصندوق الأسود.
            </div>
            <div class="flex items-center gap-2">
              <button type="button" onclick="GherbiV7Stage1.snapshotCurrentCartToVaultManually()"
                class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] shadow-sm">
                📌 + حفظ السلة الحالية في الخزنة
              </button>
              <button type="button" onclick="GherbiV7Stage1.clearAllVaultRecords()"
                class="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 hover:text-white font-black text-[11px] transition">
                🗑️ تفريغ الخزنة
              </button>
            </div>
          </div>

          <!-- قائمة الفواتير المحفوظة -->
          <div id="gherbiVaultListContainer" class="p-4 overflow-y-auto space-y-2.5 flex-1"></div>

          <!-- التذييل -->
          <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            <span class="text-[11px] text-slate-500 font-bold">💡 عند استرجاع أي فاتورة، تُفتح لك في سلة الكاشير بكامل أصنافها وزبونها</span>
            <button type="button" onclick="App.closeModal('gherbiCrashVaultModal')" class="px-5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-black">إغلاق</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    openCrashVaultModal() {
      this.buildCrashRecoveryVaultModal();
      this.renderVaultItemsList();
      window.App.openModal('gherbiCrashVaultModal');
    },

    renderVaultItemsList() {
      const box = document.getElementById('gherbiVaultListContainer');
      if (!box) return;
      const list = this.getVaultRecords();

      // فحص إن كانت هناك سلات مفتوحة حالياً في الجلسة لعرضها أيضاً كـ "نشطة الآن"
      const currentActiveCarts = (window.AppState?.carts || []).filter((c) => Array.isArray(c.items) && c.items.length > 0);

      if (list.length === 0 && currentActiveCarts.length === 0) {
        box.innerHTML = `
          <div class="py-12 text-center space-y-2">
            <div class="text-3xl">✅</div>
            <div class="font-black text-sm text-slate-700 dark:text-slate-200">لا توجد فواتير مفقودة أو غير مسجلة من انقطاع سابق</div>
            <div class="text-[11px] text-slate-400 font-bold">في حال انقطاع الكهرباء أثناء أي عملية بيع، ستجد الفاتورة محفوظة هنا تلقائياً فور تشغيل البرنامج.</div>
          </div>
        `;
        return;
      }

      box.innerHTML = list.map((rec, idx) => {
        const itemsPreview = (rec.items || [])
          .map((it) => `${it.name || it.custom_product_name || 'صنف'} (×${it.quantity || 1})`)
          .join(' ، ');
        return `
          <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-amber-500/40 flex flex-wrap items-center justify-between gap-3 hover:border-amber-500 transition">
            <div class="space-y-1 flex-1 min-w-[240px]">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10.5px]">${rec.reason || '⚡ طوارئ'}</span>
                <span class="font-mono text-[11px] font-bold text-slate-500">🕒 ${rec.savedAt || ''}</span>
                <span class="px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 font-black text-[11px]">👤 ${rec.customerName || 'زبون عابر'}</span>
              </div>
              <div class="font-bold text-xs text-slate-800 dark:text-slate-100 line-clamp-2">
                🛒 الأصناف (${(rec.items || []).length}): <span class="text-slate-600 dark:text-slate-300">${itemsPreview}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <div class="text-left ml-2">
                <div class="text-[10px] text-slate-400 font-bold">الإجمالي</div>
                <div class="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">${Number(rec.totalDzd || 0).toFixed(2)} د.ج</div>
              </div>
              <button type="button" onclick="GherbiV7Stage1.restoreVaultRecordToPos(${idx})"
                class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow flex items-center gap-1">
                <span>🔄 استرجاع للكاشير</span>
              </button>
              <button type="button" onclick="GherbiV7Stage1.deleteVaultRecord(${idx})"
                class="px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 hover:text-white font-black text-xs transition" title="حذف من الخزنة">
                ✕
              </button>
            </div>
          </div>
        `;
      }).join('');
    },

    restoreVaultRecordToPos(idx) {
      const vault = this.getVaultRecords();
      const rec = vault[idx];
      if (!rec) return;

      const carts = window.AppState?.carts || [];
      const curCart = window.App.currentCart;

      const restoredCartObj = {
        id: 'cart_' + Date.now(),
        label: `سلة #${carts.length + 1}`,
        items: JSON.parse(JSON.stringify(rec.items || [])),
        customerId: rec.customerId || '',
        priceTier: 'retail',
        discount: Number(rec.discount || 0),
        _redeemedPoints: 0
      };

      // إذا كانت السلة الحالية فارغة نضعها فيها مباشرة، وإلا نفتحها في تبويب سلة جديد
      if (curCart && (!curCart.items || curCart.items.length === 0)) {
        restoredCartObj.label = curCart.label || 'سلة #1';
        carts[window.AppState.activeCartIndex || 0] = restoredCartObj;
      } else {
        carts.push(restoredCartObj);
        window.AppState.activeCartIndex = carts.length - 1;
      }

      // حذفها من الخزنة بعد استرجاعها بنجاح
      vault.splice(idx, 1);
      this.saveVaultRecords(vault);

      const sel = document.getElementById('posCustomerSelect');
      if (sel) sel.value = String(restoredCartObj.customerId || '');

      window.App.closeModal('gherbiCrashVaultModal');
      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      this.syncWalkInQuickButtonState();

      if (window.showToast) {
        window.showToast(`✅ تم استرجاع الفاتورة غير المسجلة (${restoredCartObj.items.length} أصناف) إلى الكاشير بنجاح!`, 'success');
      }
    },

    deleteVaultRecord(idx) {
      const vault = this.getVaultRecords();
      vault.splice(idx, 1);
      this.saveVaultRecords(vault);
      this.renderVaultItemsList();
    },

    clearAllVaultRecords() {
      this.saveVaultRecords([]);
      this.renderVaultItemsList();
      if (window.showToast) window.showToast('🗑️ تم تفريغ خزنة الطوارئ بنجاح', 'info');
    },

    updateVaultButtonBadge() {
      const btn = document.getElementById('gherbiPosCrashVaultBtn');
      const badge = document.getElementById('gherbiPosCrashVaultCount');
      if (!btn || !badge) return;
      const count = this.getVaultRecords().length;
      badge.textContent = String(count);
      btn.classList.toggle('gherbi-vault-btn-alert', count > 0);
    },

    // ========================================================================
    // 5. زر التحويل الفوري للزبون العابر داخل شريط الزبون + اختصار (Alt + W)
    // ========================================================================
    switchImmediatelyToWalkInCustomer() {
      const cart = window.App?.currentCart;
      const hadCustomer = Boolean(cart?.customerId || document.getElementById('posCustomerSelect')?.value);

      if (cart) {
        cart.customerId = '';
        if (Number(cart._redeemedPoints || 0) > 0) {
          cart.discount = 0;
          cart._redeemedPoints = 0;
          const discInp = document.getElementById('cartDiscountInput');
          if (discInp) discInp.value = '0';
        }
      }

      const sel = document.getElementById('posCustomerSelect');
      if (sel) {
        sel.value = '';
        sel.dispatchEvent(new Event('change'));
      }

      const redeemInp = document.getElementById('smartRedeemPointsInput');
      if (redeemInp) redeemInp.value = '0';

      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      window.GherbiMasterUpgrade?.updateCustomerTriggerBar?.();
      window.GherbiMasterUpgrades?.syncSmartCustomerBar?.();
      window.App?.recalcAndRenderCart?.();
      this.syncWalkInQuickButtonState();

      if (window.showToast) {
        window.showToast(
          hadCustomer
            ? '👤 تم التحويل فوراً إلى (زبون عابر — بدون بطاقة وفاء) [Alt+W]'
            : '👤 السلة مضبوطة بالفعل على (زبون عابر) [Alt+W]',
          'info'
        );
      }
      window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
    },

    syncWalkInQuickButtonState() {
      const btn = document.getElementById('gherbiInstantWalkInBtn');
      if (!btn) return;
      const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value || '';
      const isLoyalSelected = Boolean(cid && String(cid).trim() !== '');

      if (isLoyalSelected) {
        btn.className = 'gherbi-walkin-quick-pill is-loyal-selected';
        btn.innerHTML = '<span>👤 تحويل لزبون عابر</span><kbd class="text-[9px] bg-black/25 px-1 rounded font-mono" dir="ltr">Alt+W</kbd>';
        btn.title = 'انقر هنا أو اضغط Alt+W للعودة فوراً إلى الزبون العابر وإلغاء بطاقة الوفاء من هذه الفاتورة';
      } else {
        btn.className = 'gherbi-walkin-quick-pill is-walkin-active';
        btn.innerHTML = '<span>👤 عابر</span><kbd class="text-[9px] opacity-75 font-mono" dir="ltr">Alt+W</kbd>';
        btn.title = 'السلة حالياً على الزبون العابر (اختصار العودة السريعة للزبون العابر: Alt+W)';
      }
    },

    injectVaultAndWalkInButtons() {
      const ensureButtons = () => {
        // أ. حقن زر "⚡ غير مسجلة (طوارئ)" في شريط السلة العلوي بجانب (سجل) و (⌨️ الاختصارات)
        const topDeckActions = document.querySelector('#gherbiCartTopDeck > div:nth-child(2) > div:last-child');
        if (topDeckActions && !document.getElementById('gherbiPosCrashVaultBtn')) {
          const vBtn = document.createElement('button');
          vBtn.id = 'gherbiPosCrashVaultBtn';
          vBtn.type = 'button';
          vBtn.onclick = () => this.openCrashVaultModal();
          vBtn.title = 'خزنة الفواتير غير المسجلة وطوارئ انقطاع الكهرباء';
          vBtn.className = 'px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-200 text-[11px] font-black transition flex items-center gap-1';
          vBtn.innerHTML = '<span>⚡ غير مسجلة (<span id="gherbiPosCrashVaultCount">0</span>)</span>';
          topDeckActions.appendChild(vBtn);
          this.updateVaultButtonBadge();
        }

        // ب. حقن زر "👤 عابر (Alt+W)" داخل شريط الزبون مباشرة بجانب أزرار F8 و F9 (الصورتان 1 و 2)
        const smartCustBtn = document.getElementById('btnOpenSmartLoyaltyModal') || document.getElementById('gherbiSmartCustomerTrigger');
        if (smartCustBtn && !document.getElementById('gherbiInstantWalkInBtn')) {
          const badgesContainer = smartCustBtn.querySelector('div:last-child') || smartCustBtn;
          const walkInBtn = document.createElement('button');
          walkInBtn.id = 'gherbiInstantWalkInBtn';
          walkInBtn.type = 'button';
          walkInBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.switchImmediatelyToWalkInCustomer();
          };
          badgesContainer.insertBefore(walkInBtn, badgesContainer.firstChild);
          this.syncWalkInQuickButtonState();
        }
      };

      ensureButtons();
      setInterval(() => {
        ensureButtons();
        this.syncWalkInQuickButtonState();
        this.updateVaultButtonBadge();
      }, 600);
    },

    bindWalkInShortcutAndRegisterInHub() {
      // 1. اختصار لوحة المفاتيح Alt + W للعودة الفورية للزبون العابر
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;
          if (e.altKey && (e.key === 'w' || e.key === 'W' || e.code === 'KeyW')) {
            e.preventDefault();
            e.stopPropagation();
            this.switchImmediatelyToWalkInCustomer();
          }
        },
        true
      );

      // 2. تسجيل اختصار Alt + W واختصار خزنة الطوارئ تلقائياً في نافذة (⌨️ الاختصارات)
      const registerInShortcutsHub = () => {
        const catalog = window.GherbiV6Stage2?.shortcutsCatalog;
        if (!Array.isArray(catalog)) return;

        if (!catalog.some((s) => s.key === 'Alt + W')) {
          catalog.splice(6, 0, {
            group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
            key: 'Alt + W',
            title: 'العودة الفورية إلى الزبون العابر',
            desc: 'إلغاء ربط الزبون الوفي من السلة الحالية والعودة فوراً إلى (زبون عابر — بدون بطاقة وفاء)',
            action: () => V7Stage1.switchImmediatelyToWalkInCustomer()
          });
        }
        if (!catalog.some((s) => s.key === 'Alt + R')) {
          catalog.push({
            group: '🛡️ 4. التحكم في السلة، الوردية، والإدارة',
            key: 'Alt + R',
            title: 'فتح خزنة الفواتير غير المسجلة وطوارئ الكهرباء',
            desc: 'استعراض واسترجاع الفواتير التي لم تُسجل أو انقطعت الكهرباء أثناء بيعها',
            action: () => V7Stage1.openCrashVaultModal()
          });
        }
      };

      registerInShortcutsHub();
      setTimeout(registerInShortcutsHub, 800);

      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;
          if (e.altKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
            e.preventDefault();
            e.stopPropagation();
            this.openCrashVaultModal();
          }
        },
        true
      );
    }
  };

  window.GherbiV7Stage1 = V7Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V7Stage1.init());
  } else {
    V7Stage1.init();
  }
})();


/* ==================== [V13 SQLITE PERSISTENCE BRIDGE] ==================== */
(function initV13SqlitePersistenceBridge() {
  const SYNC_PAIRS = [
    { localKey: 'gherbi_product_pack_configs_v8', settingKey: 'v13_product_pack_configs_json' },
    { localKey: 'gherbi_product_loyalty_policies', settingKey: 'v13_product_loyalty_policies_json' },
    { localKey: 'gherbi_quick_touch_buttons', settingKey: 'v13_quick_touch_buttons_json' },
    { localKey: 'gherbi_owner_price_radar_v9', settingKey: 'v13_owner_price_radar_json' },
    { localKey: 'gherbi_product_multi_barcodes_map', settingKey: 'v13_product_multi_barcodes_json' },
    { localKey: 'gherbi_subtotal_edit_mode_v10', settingKey: 'v13_subtotal_edit_mode' }
  ];

  const SqliteBridge = {
    lastHashes: {},
    syncTimer: null,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState || !window.api) return;
        clearInterval(wait);
        this.hydrateFromSqliteOnBoot();
        this.interceptLocalStorageWrites();
        this.syncProductColumnsWithPackAndLoyalty();
        console.log('🚀 [V13 Stage 2 — SQLite Bridge]: المزامنة الدائمة بين الواجهة وقاعدة البيانات SQLite نشطة 100%.');
      }, 220);
    },

    async hydrateFromSqliteOnBoot() {
      try {
        const dbSettings = window.AppState.settings || (await window.api.getSettings?.()) || {};
        let restoredAny = false;

        for (const { localKey, settingKey } of SYNC_PAIRS) {
          const dbVal = dbSettings[settingKey];
          const localVal = localStorage.getItem(localKey);

          if (dbVal && dbVal !== 'undefined' && dbVal !== 'null') {
            // إذا كان المفتاح غير موجود محلياً (مثلاً بعد استعادة نسخة احتياطية أو فتح جهاز جديد)، نسترجعه من SQLite!
            if (!localVal || localVal === '{}' || localVal === '[]') {
              localStorage.setItem(localKey, dbVal);
              restoredAny = true;
            }
            this.lastHashes[localKey] = dbVal;
          } else if (localVal && localVal !== '{}' && localVal !== '[]') {
            // إذا كان موجوداً محلياً وغير محفوظ في SQLite بعد، نرفعه فوراً إلى SQLite
            this.pushSingleKeyToSqlite(localKey, settingKey, localVal);
          }
        }

        // استخلاص إعدادات الكرتونة والولاء من جدول المنتجات في SQLite أيضاً
        const prods = window.AppState.products || [];
        const packMap = JSON.parse(localStorage.getItem('gherbi_product_pack_configs_v8') || '{}');
        const loyaltyMap = JSON.parse(localStorage.getItem('gherbi_product_loyalty_policies') || '{}');

        prods.forEach((p) => {
          const pid = Number(p.id);
          if (pid && packMap['ID_' + pid]) {
            const cfg = packMap['ID_' + pid];
            p.wholesale_price = cfg.packPrice;
            p.wholesale_qty = cfg.packQty;
            p.wholesale_unit = cfg.packUnit;
          } else if (pid && (Number(p.wholesale_qty || 0) > 1 || Number(p.wholesale_price || 0) > 0)) {
            packMap['ID_' + pid] = {
              packPrice: Number(p.wholesale_price || 0),
              packQty: Number(p.wholesale_qty || 6),
              packUnit: p.wholesale_unit || 'كرتونة'
            };
          }

          if (pid && loyaltyMap[pid] !== undefined) {
            p.loyalty_multiplier = Number(loyaltyMap[pid]);
          } else if (pid && p.loyalty_multiplier !== undefined && p.loyalty_multiplier !== null) {
            loyaltyMap[pid] = Number(p.loyalty_multiplier);
          }
        });

        localStorage.setItem('gherbi_product_pack_configs_v8', JSON.stringify(packMap));
        localStorage.setItem('gherbi_product_loyalty_policies', JSON.stringify(loyaltyMap));

        if (restoredAny) {
          window.GherbiStage12Enforcer?.renderPinnedDock?.();
          window.App.renderPosView?.();
        }
      } catch (err) {
        console.warn('[SQLite Bridge Hydrate Warning]:', err.message);
      }
    },

    pushSingleKeyToSqlite(localKey, settingKey, valStr) {
      if (!window.api?.updateSettings) return;
      if (this.lastHashes[localKey] === valStr) return;
      this.lastHashes[localKey] = valStr;

      if (window.AppState?.settings) {
        window.AppState.settings[settingKey] = valStr;
      }
      window.api.updateSettings({ [settingKey]: valStr }).catch(() => {});
    },

    flushAllToSqlite() {
      const payload = {};
      let hasChanges = false;

      for (const { localKey, settingKey } of SYNC_PAIRS) {
        const curVal = localStorage.getItem(localKey);
        if (curVal && curVal !== this.lastHashes[localKey]) {
          this.lastHashes[localKey] = curVal;
          payload[settingKey] = curVal;
          if (window.AppState?.settings) {
            window.AppState.settings[settingKey] = curVal;
          }
          hasChanges = true;
        }
      }

      if (hasChanges && window.api?.updateSettings) {
        window.api.updateSettings(payload).catch(() => {});
      }
    },

    interceptLocalStorageWrites() {
      const origSetItem = Storage.prototype.setItem;
      const watchedKeys = new Set(SYNC_PAIRS.map((p) => p.localKey));

      Storage.prototype.setItem = function (key, value) {
        origSetItem.call(this, key, value);
        if (watchedKeys.has(key)) {
          if (SqliteBridge.syncTimer) clearTimeout(SqliteBridge.syncTimer);
          SqliteBridge.syncTimer = setTimeout(() => SqliteBridge.flushAllToSqlite(), 350);
        }
      };

      setInterval(() => this.flushAllToSqlite(), 5000);
    },

    syncProductColumnsWithPackAndLoyalty() {
      // عند حفظ أي منتج، نرسل أيضاً إعدادات الكرتونة ومعامل الولاء إلى جدول products في SQLite
      ['updateProduct', 'addProduct'].forEach((apiFn) => {
        if (!window.api || typeof window.api[apiFn] !== 'function' || window.api['_v13Hook_' + apiFn]) return;
        const origFn = window.api[apiFn].bind(window.api);
        try {
          window.api[apiFn] = async function (arg1, arg2) {
            const res = await origFn(arg1, arg2);
            setTimeout(() => SqliteBridge.flushAllToSqlite(), 200);
            return res;
          };
          window.api['_v13Hook_' + apiFn] = true;
        } catch (_) {
          // في حال كان كائن window.api مجمداً عبر contextBridge، يتكفل interceptLocalStorageWrites بالمزامنة الكاملة
        }
      });
    }
  };

  window.GherbiSqliteBridge = SqliteBridge;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SqliteBridge.init());
  } else {
    SqliteBridge.init();
  }
})();


/* ==================== [V30 ALGERIAN RETAIL FISCAL STUDIO (TAB 13: IFU G12 / G12 BIS & G50)] ==================== */
(function initV33UltimateAlgerianRetailFiscalStudio() {
  const STORAGE_KEY = 'gherbi_v30_retail_fiscal_config_v1';
  const REGULATED_MAP_KEY = 'gherbi_v32_regulated_products_map_v1';

  const DZ_REGULATED_KEYWORDS = [
    'حليب', 'لبن', 'شكارة حليب', 'candia', 'soummam', 'hodna', 'giplait', 'lait',
    'خبز', 'سميد', 'فرينة', 'دقيق', 'semoule', 'farine', 'mama', 'sim', 'safina',
    'زيت', 'إيليو', 'ايليو', 'عافية', 'فلوريال', 'صافي', 'زيت المائدة', 'elio', 'afia', 'fleurial', 'huile',
    'سكر', 'سيفيتال', 'sucre', 'cevital',
    'ماء سعيدة', 'إيفري', 'ايفري', 'ifri', 'saida',
    'قارورة غاز', 'غاز بوتان', 'طابع', 'جرائد'
  ];

  const RetailFiscalStudio = {
    isTab13Active: false,
    inactiveBtnClass: '',
    activeBtnClass: '',
    regulatedMap: {},
    state: {
      year: new Date().getFullYear(),
      calcMode: 'auto_invoices', // 'auto_invoices' | 'manual_ratio'
      enforceLegalMinimum: true, // تطبيق الحد الأدنى القانوني (10,000 د.ج) أو عرض الضريبة النسبية 5% فقط
      ifuCeilingDzd: 8000000,
      ifuRateGoods: 5,
      ifuRateServices: 12,
      regulatedExemptRatio: 15,
      serviceRevenueDzd: 0,
      minIfuTaxDzd: 10000
    },

    loadConfig() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
      } catch (_) {}
      try {
        const rawMap = localStorage.getItem(REGULATED_MAP_KEY);
        if (rawMap) this.regulatedMap = JSON.parse(rawMap) || {};
      } catch (_) {}
    },

    saveConfig() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (_) {}
    },

    saveRegulatedMap() {
      try {
        localStorage.setItem(REGULATED_MAP_KEY, JSON.stringify(this.regulatedMap));
      } catch (_) {}
    },

    isProductRegulated(prod) {
      if (!prod) return false;
      const pid = String(prod.id || '');
      if (pid && this.regulatedMap[pid] !== undefined) {
        return Boolean(this.regulatedMap[pid]);
      }
      const text = (String(prod.name || '') + ' ' + String(prod.category || '') + ' ' + String(prod.family || '')).toLowerCase();
      for (const kw of DZ_REGULATED_KEYWORDS) {
        if (text.includes(kw.toLowerCase())) return true;
      }
      return false;
    },

    setProductRegulated(productId, isReg) {
      if (!productId) return;
      this.regulatedMap[String(productId)] = Boolean(isReg);
      this.saveRegulatedMap();
    },

    init() {
      this.loadConfig();
      const wait = setInterval(() => {
        if (!window.App) return;
        clearInterval(wait);
        this.hookGlobalNavigation();
        this.hookProductModalCheckbox();
        this.startTab13InjectorLoop();
        this.startAiCopilotButtonFixer();
        console.log('🇩🇿 [Gherbi V33 Ultimate Retail Fiscal Studio]: الواجهة التفصيلية الشاملة للتبويب 13 نشطة 100%.');
      }, 200);
    },

    hookProductModalCheckbox() {
      if (window.App && typeof window.App.openProductModal === 'function' && !window.App._v33RegModalHooked) {
        const origOpen = window.App.openProductModal.bind(window.App);
        window.App._v33RegModalHooked = true;
        window.App.openProductModal = (...args) => {
          const res = origOpen(...args);
          setTimeout(() => {
            const prod = args[0] && typeof args[0] === 'object' ? args[0] : null;
            const chk = document.getElementById('prodIsRegulatedInput');
            if (chk) chk.checked = prod ? this.isProductRegulated(prod) : false;
          }, 60);
          return res;
        };
      }

      if (window.App && typeof window.App.saveProduct === 'function' && !window.App._v33RegSaveHooked) {
        const origSave = window.App.saveProduct.bind(window.App);
        window.App._v33RegSaveHooked = true;
        window.App.saveProduct = async (...args) => {
          const chk = document.getElementById('prodIsRegulatedInput');
          const isChecked = chk ? chk.checked : false;
          const editId = window.App.editingProductId || document.getElementById('prodIdInput')?.value;
          const res = await origSave(...args);
          setTimeout(() => {
            const targetId = editId || (res && res.id) || (window.AppState?.products?.slice(-1)[0]?.id);
            if (targetId) this.setProductRegulated(targetId, isChecked);
          }, 150);
          return res;
        };
      }
    },

    async openStudio() {
      try {
        const oldModal = document.getElementById('algerianFiscalModal');
        if (oldModal) oldModal.classList.add('hidden');
        this.isTab13Active = true;

        if (window.App && typeof window.App.switchView === 'function') {
          const hasAnalytics = document.getElementById('view-analytics');
          await window.App.switchView(hasAnalytics ? 'analytics' : 'reports');
        }
        setTimeout(() => {
          this.ensureTab13ButtonExists();
          this.activateTab13();
        }, 120);
        setTimeout(() => {
          this.ensureTab13ButtonExists();
          this.activateTab13();
        }, 320);
      } catch (e) {
        console.error('openStudio error:', e);
      }
    },

    async openZakatTab12() {
      this.isTab13Active = false;
      if (window.App && typeof window.App.switchView === 'function') {
        const hasAnalytics = document.getElementById('view-analytics');
        await window.App.switchView(hasAnalytics ? 'analytics' : 'reports');
      }
      setTimeout(() => {
        const tab12Btn = this.findTab12ZakatButton();
        if (tab12Btn) tab12Btn.click();
      }, 180);
    },

    hookGlobalNavigation() {
      window.openAlgerianRetailFiscalStudio = () => this.openStudio();
      if (window.App) {
        window.App.openAlgerianFiscalModal = () => this.openStudio();
        if (typeof window.App.switchAnalyticsTab === 'function' && !window.App._v33FiscalHooked) {
          const origSwitchTab = window.App.switchAnalyticsTab.bind(window.App);
          window.App._v33FiscalHooked = true;
          window.App.switchAnalyticsTab = async (...args) => {
            const tabArg = String(args[0] || '');
            if (tabArg === '13' || tabArg === 'fiscal') {
              this.isTab13Active = true;
              this.ensureTab13ButtonExists();
              await this.activateTab13();
              return;
            }
            this.isTab13Active = false;
            this.hideFiscalStageAndRestoreOriginal();
            const res = await origSwitchTab(...args);
            setTimeout(() => this.ensureTab13ButtonExists(), 60);
            return res;
          };
        }
      }
      if (window.ReportsCommandCenter) {
        window.ReportsCommandCenter.openFiscalStudio = () => this.openStudio();
      }
    },

    findTab12ZakatButton() {
      const allBtns = Array.from(document.querySelectorAll('button'));
      return allBtns.find((b) => {
        const t = (b.textContent || '').trim();
        return (t.includes('12.') && t.includes('الزكاة')) || t.includes('حاسبة وأرشيف الزكاة');
      });
    },

    startTab13InjectorLoop() {
      setInterval(() => {
        const tab12Btn = this.findTab12ZakatButton();
        if (!tab12Btn) return;
        this.ensureTab13ButtonExists(tab12Btn);
        if (this.isTab13Active) {
          const pane = document.getElementById('v30RetailFiscalStudioContainer');
          if (!pane || pane.classList.contains('hidden')) {
            this.activateTab13();
          }
        }
      }, 300);
    },

    ensureTab13ButtonExists(passedTab12) {
      const tab12Btn = passedTab12 || this.findTab12ZakatButton();
      if (!tab12Btn || !tab12Btn.parentElement) return null;

      const tabBar = tab12Btn.parentElement;
      const siblingBtns = Array.from(tabBar.querySelectorAll('button')).filter(
        (b) => b.id !== 'v30RccTab13FiscalBtn'
      );

      for (const sb of siblingBtns) {
        const cls = sb.className || '';
        if (cls.includes('bg-blue-600') || cls.includes('bg-indigo-600') || cls.includes('text-white')) {
          if (!this.activeBtnClass) this.activeBtnClass = cls;
        } else if (cls.length > 10) {
          if (!this.inactiveBtnClass) this.inactiveBtnClass = cls;
        }
      }

      let tab13Btn = document.getElementById('v30RccTab13FiscalBtn');
      if (!tab13Btn) {
        tab13Btn = document.createElement('button');
        tab13Btn.id = 'v30RccTab13FiscalBtn';
        tab13Btn.type = 'button';
        tab13Btn.className =
          this.inactiveBtnClass ||
          'px-4 py-2 rounded-full font-black text-xs transition flex items-center gap-1.5 bg-white text-slate-800 border border-slate-200 shadow-sm hover:border-blue-500';
        tab13Btn.innerHTML = '13. 🇩🇿 استوديو الجباية والضرائب (IFU G12 / G50)';
        tab13Btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.isTab13Active = true;
          this.activateTab13();
        });
        tab12Btn.insertAdjacentElement('afterend', tab13Btn);
      }

      for (const sb of siblingBtns) {
        if (sb.dataset.v33FiscalSiblingHooked === '1') continue;
        sb.dataset.v33FiscalSiblingHooked = '1';
        sb.addEventListener('click', () => {
          this.isTab13Active = false;
          this.hideFiscalStageAndRestoreOriginal();
        });
      }

      return tab13Btn;
    },

    findTabBarWrapper(tab12Btn) {
      if (!tab12Btn) return null;
      let curr = tab12Btn.parentElement;
      while (curr && curr.parentElement) {
        if (curr.querySelectorAll('button').length >= 10) return curr;
        curr = curr.parentElement;
      }
      return tab12Btn.parentElement;
    },

    hideFiscalStageAndRestoreOriginal() {
      const tab13Btn = document.getElementById('v30RccTab13FiscalBtn');
      if (tab13Btn && this.inactiveBtnClass) tab13Btn.className = this.inactiveBtnClass;
      const fiscalPane = document.getElementById('v30RetailFiscalStudioContainer');
      if (fiscalPane) fiscalPane.classList.add('hidden');

      const hiddenEls = document.querySelectorAll('[data-v31-hidden-by-fiscal="1"]');
      for (const el of hiddenEls) {
        el.classList.remove('hidden');
        delete el.dataset.v31HiddenByFiscal;
      }
    },

    async activateTab13() {
      const tab12Btn = this.findTab12ZakatButton();
      const tab13Btn = this.ensureTab13ButtonExists(tab12Btn);
      if (!tab13Btn || !tab12Btn) return;

      const tabBarWrapper = this.findTabBarWrapper(tab12Btn);
      if (tabBarWrapper) {
        for (const b of Array.from(tabBarWrapper.querySelectorAll('button'))) {
          if (b.id === 'v30RccTab13FiscalBtn') {
            b.className =
              this.activeBtnClass ||
              'px-4 py-2 rounded-full font-black text-xs transition flex items-center gap-1.5 bg-blue-600 text-white shadow-md border border-blue-500';
          } else if (this.inactiveBtnClass) {
            b.className = this.inactiveBtnClass;
          }
        }
      }

      const parentContainer = tabBarWrapper ? tabBarWrapper.parentElement : tab12Btn.parentElement.parentElement;
      if (!parentContainer) return;

      let fiscalPane = document.getElementById('v30RetailFiscalStudioContainer');
      if (!fiscalPane) {
        fiscalPane = document.createElement('div');
        fiscalPane.id = 'v30RetailFiscalStudioContainer';
        fiscalPane.className = 'mt-4 space-y-5';
        if (tabBarWrapper && tabBarWrapper.nextSibling) {
          parentContainer.insertBefore(fiscalPane, tabBarWrapper.nextSibling);
        } else {
          parentContainer.appendChild(fiscalPane);
        }
      }

      let sibling = tabBarWrapper ? tabBarWrapper.nextElementSibling : null;
      while (sibling) {
        if (sibling.id !== 'v30RetailFiscalStudioContainer' && !sibling.classList.contains('hidden')) {
          sibling.classList.add('hidden');
          sibling.dataset.v31HiddenByFiscal = '1';
        }
        sibling = sibling.nextElementSibling;
      }

      fiscalPane.classList.remove('hidden');
      await this.renderFiscalStudioContent(fiscalPane);
    },

    startAiCopilotButtonFixer() {
      setInterval(() => {
        const buttons = document.querySelectorAll('button, a');
        for (const btn of buttons) {
          if (btn.id === 'v30RccTab13FiscalBtn') continue;
          const txt = (btn.textContent || '').trim();
          if (txt.includes('فتح استوديو الجباية') && btn.dataset.v33FiscalHooked !== '1') {
            btn.dataset.v33FiscalHooked = '1';
            btn.removeAttribute('onclick');
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.openStudio();
            }, true);
          } else if (txt.includes('فتح حاسبة الزكاة') && btn.dataset.v33FiscalHooked !== '1') {
            btn.dataset.v33FiscalHooked = '1';
            btn.removeAttribute('onclick');
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.openZakatTab12();
            }, true);
          }
        }
      }, 350);
    },

    // ========================================================================
    // المحرك التحليلي الشامل لكل تفاصيل الفواتير والضرائب والمصاريف
    // ========================================================================
    async computeFiscalData() {
      const yr = Number(this.state.year || new Date().getFullYear());
      let sales = window.AppState?.sales || [];
      let products = window.AppState?.products || [];
      let purchases = window.AppState?.purchases || [];
      let expenses = window.AppState?.expenses || [];

      try {
        if ((!sales || !sales.length) && window.api?.getSales) sales = await window.api.getSales();
        if ((!products || !products.length) && window.api?.getProducts) products = await window.api.getProducts();
        if ((!purchases || !purchases.length) && window.api?.getPurchases) purchases = await window.api.getPurchases();
        if ((!expenses || !expenses.length) && window.api?.getExpenses) expenses = await window.api.getExpenses();
      } catch (_) {}

      const prodById = new Map();
      const prodByName = new Map();
      let regulatedProductsCount = 0;

      for (const p of products || []) {
        prodById.set(Number(p.id), p);
        if (p.name) prodByName.set(String(p.name).trim().toLowerCase(), p);
        if (this.isProductRegulated(p)) regulatedProductsCount++;
      }

      const yearSales = (sales || []).filter(
        (s) => String(s.sale_date || s.date || '').startsWith(String(yr)) && !s.deleted_at
      );
      const yearPurchases = (purchases || []).filter(
        (p) => String(p.date || p.created_at || '').startsWith(String(yr)) && !p.deleted_at
      );
      const yearExpenses = (expenses || []).filter(
        (e) => String(e.date || e.created_at || '').startsWith(String(yr)) && !e.deleted_at
      );

      const qTurnover = [0, 0, 0, 0];
      const qSalesCount = [0, 0, 0, 0];
      let annualTurnoverDzd = 0;
      let totalTvaCollected = 0;
      let totalTimbreCollected = 0;
      let totalCashSalesDzd = 0;
      let totalCreditSalesDzd = 0;

      let realRegulatedSalesDzd = 0;
      let realRegulatedCostExemptDzd = 0;
      let realRegulatedMarginDzd = 0;
      let realRegulatedUnitsSold = 0;
      const regulatedBreakdownMap = new Map();

      // جلب تفاصيل السطور للفواتير إن لم تكن محملة مسبقاً
      if (yearSales.length > 0 && window.api?.getSaleDetails) {
        const missingItemsSales = yearSales.filter((s) => !Array.isArray(s.items) || s.items.length === 0).slice(0, 150);
        for (const s of missingItemsSales) {
          try {
            const det = await window.api.getSaleDetails(s.id);
            s.items = (det && det.items) || (Array.isArray(det) ? det : []);
          } catch (_) {}
        }
      }

      for (const s of yearSales) {
        const tot = Math.max(0, Number(s.total || 0));
        const paid = Math.max(0, Number(s.paid_amount ?? tot));
        annualTurnoverDzd += tot;
        totalCashSalesDzd += Math.min(tot, paid);
        totalCreditSalesDzd += Math.max(0, tot - paid);
        totalTvaCollected += Math.max(0, Number(s.tva_amount || 0));
        totalTimbreCollected += Math.max(0, Number(s.stamp_amount || 0));

        const dt = new Date(s.sale_date || s.date || Date.now());
        const qIdx = Math.min(3, Math.floor(dt.getMonth() / 3));
        qTurnover[qIdx] += tot;
        qSalesCount[qIdx] += 1;

        const items = Array.isArray(s.items) ? s.items : [];
        for (const it of items) {
          const prod =
            prodById.get(Number(it.product_id)) ||
            prodByName.get(String(it.product_name || it.name || '').trim().toLowerCase());
          const itemName = String(it.product_name || it.name || (prod && prod.name) || '');
          const isReg = prod
            ? this.isProductRegulated(prod)
            : this.isProductRegulated({ name: itemName });

          if (isReg) {
            const qty = Math.max(0, Number(it.quantity || 0));
            const sub = Math.max(0, Number(it.subtotal ?? Number(it.price || 0) * qty));
            const unitCost = Math.max(0, Number(it.cost_price ?? (prod && prod.cost_price) ?? Number(it.price || 0) * 0.92));
            const costTotal = Math.min(sub, Number((unitCost * qty).toFixed(2)));
            const margin = Math.max(0, Number((sub - costTotal).toFixed(2)));

            realRegulatedSalesDzd += sub;
            realRegulatedCostExemptDzd += costTotal;
            realRegulatedMarginDzd += margin;
            realRegulatedUnitsSold += qty;

            const key = itemName || 'سلعة مقننة';
            const prev = regulatedBreakdownMap.get(key) || { name: key, qty: 0, sales: 0, costExempt: 0, margin: 0 };
            prev.qty += qty;
            prev.sales += sub;
            prev.costExempt += costTotal;
            prev.margin += margin;
            regulatedBreakdownMap.set(key, prev);
          }
        }
      }

      let totalPurchasesDzd = 0;
      let totalPurchasesTva = 0;
      for (const p of yearPurchases) {
        totalPurchasesDzd += Math.max(0, Number(p.total || 0));
        totalPurchasesTva += Math.max(0, Number(p.tva_amount || 0));
      }

      let paidTaxExpensesDzd = 0;
      const taxExpensesList = [];
      let isTranche1Paid = false;
      let isTranche2Paid = false;
      let isTranche3Paid = false;

      for (const ex of yearExpenses) {
        const amt = Math.max(0, Number(ex.amount || 0));
        const desc = String(ex.description || '');
        const cat = String(ex.category || '') + ' ' + desc;
        if (cat.includes('ضرائب') || cat.includes('جباية') || cat.includes('IFU') || cat.includes('G12') || cat.includes('G50')) {
          paidTaxExpensesDzd += amt;
          taxExpensesList.push(ex);
          if (desc.includes('القسط الأول') || desc.includes('جوان')) isTranche1Paid = true;
          if (desc.includes('القسط الثاني') || desc.includes('سبتمبر')) isTranche2Paid = true;
          if (desc.includes('الرصيد الختامي') || desc.includes('ديسمبر')) isTranche3Paid = true;
        }
      }

      const isAutoMode = this.state.calcMode !== 'manual_ratio';
      const regulatedDeduction = isAutoMode
        ? Number(realRegulatedCostExemptDzd.toFixed(2))
        : Number(((annualTurnoverDzd * Number(this.state.regulatedExemptRatio || 0)) / 100).toFixed(2));

      const effectiveExemptPct =
        annualTurnoverDzd > 0 ? Number(((regulatedDeduction / annualTurnoverDzd) * 100).toFixed(1)) : 0;

      // السلع العادية غير المقننة
      const regularGoodsTurnover = Math.max(0, Number((annualTurnoverDzd - realRegulatedSalesDzd).toFixed(2)));
      // الوعاء الصافي الخاضع لـ 5% = (مبيعات السلع العادية + هامش ربح السلع المقننة فقط) = (إجمالي رقم الأعمال - رأسمال السلع المقننة المعفى)
      const taxableGoodsTurnover = Math.max(0, Number((annualTurnoverDzd - regulatedDeduction).toFixed(2)));
      const serviceRev = Math.max(0, Number(this.state.serviceRevenueDzd || 0));

      const rateG = Number(this.state.ifuRateGoods || 5);
      const rateS = Number(this.state.ifuRateServices || 12);

      const rawIfuGoodsTax = Number(((taxableGoodsTurnover * rateG) / 100).toFixed(2));
      const rawIfuServiceTax = Number(((serviceRev * rateS) / 100).toFixed(2));
      const exactProportionalTax = Number((rawIfuGoodsTax + rawIfuServiceTax).toFixed(2));

      const minLegalTax = Math.max(10000, Number(this.state.minIfuTaxDzd || 10000));
      const isMinimumApplied = Boolean(this.state.enforceLegalMinimum) && exactProportionalTax < minLegalTax;
      const finalIfuTaxDue = this.state.enforceLegalMinimum
        ? Math.max(minLegalTax, exactProportionalTax)
        : exactProportionalTax;

      // نقطة التعادل التي تتجاوز فيها ضريبة الـ 5% الحد الأدنى (10,000 / 5% = 200,000 د.ج)
      const breakEvenTurnoverForMin = rateG > 0 ? Number(((minLegalTax / (rateG / 100))).toFixed(2)) : 200000;

      const tranche1_June = Number((finalIfuTaxDue * 0.30).toFixed(2));
      const tranche2_Sept = Number((finalIfuTaxDue * 0.30).toFixed(2));
      const tranche3_Dec = Number((finalIfuTaxDue - tranche1_June - tranche2_Sept).toFixed(2));

      const ceiling = Math.max(1000000, Number(this.state.ifuCeilingDzd || 8000000));
      const ceilingUsagePct = Math.min(100, Number(((annualTurnoverDzd / ceiling) * 100).toFixed(1)));

      return {
        year: yr,
        isAutoMode,
        rateG,
        rateS,
        salesCount: yearSales.length,
        purchasesCount: yearPurchases.length,
        totalProductsCount: (products || []).length,
        regulatedProductsCount,
        regularGoodsTurnover,
        realRegulatedSalesDzd: Number(realRegulatedSalesDzd.toFixed(2)),
        realRegulatedCostExemptDzd: Number(realRegulatedCostExemptDzd.toFixed(2)),
        realRegulatedMarginDzd: Number(realRegulatedMarginDzd.toFixed(2)),
        realRegulatedUnitsSold: Number(realRegulatedUnitsSold.toFixed(2)),
        regulatedBreakdown: Array.from(regulatedBreakdownMap.values()).sort((a, b) => b.sales - a.sales),
        annualTurnoverDzd: Number(annualTurnoverDzd.toFixed(2)),
        totalCashSalesDzd: Number(totalCashSalesDzd.toFixed(2)),
        totalCreditSalesDzd: Number(totalCreditSalesDzd.toFixed(2)),
        regulatedDeduction,
        effectiveExemptPct,
        taxableGoodsTurnover,
        serviceRev,
        rawIfuGoodsTax,
        rawIfuServiceTax,
        exactProportionalTax,
        minLegalTax,
        isMinimumApplied,
        breakEvenTurnoverForMin,
        finalIfuTaxDue,
        tranche1_June,
        tranche2_Sept,
        tranche3_Dec,
        isTranche1Paid,
        isTranche2Paid,
        isTranche3Paid,
        qTurnover,
        qSalesCount,
        totalPurchasesDzd: Number(totalPurchasesDzd.toFixed(2)),
        totalTvaCollected: Number(totalTvaCollected.toFixed(2)),
        totalTimbreCollected: Number(totalTimbreCollected.toFixed(2)),
        totalPurchasesTva: Number(totalPurchasesTva.toFixed(2)),
        paidTaxExpensesDzd: Number(paidTaxExpensesDzd.toFixed(2)),
        taxExpensesList,
        ceiling,
        ceilingUsagePct
      };
    },

    fmtDzd(val) {
      return Number(val || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    },

    fmtCentimes(val) {
      const c = Math.round(Number(val || 0) * 100);
      return c >= 1000000 ? (c / 1000000).toFixed(2) + ' مليون سنتيم' : (c / 1000).toFixed(1) + ' ألف سنتيم';
    },

    // ========================================================================
    // الواجهة الشاملة والمفصلة لاستوديو الجباية والضرائب للتجزئة (V33 Ultimate UX)
    // ========================================================================
    async renderFiscalStudioContent(container) {
      if (!container) return;
      const d = await this.computeFiscalData();
      const remainingToPay = Math.max(0, Number((d.finalIfuTaxDue - d.paidTaxExpensesDzd).toFixed(2)));

      const statusBadge =
        d.ceilingUsagePct < 75
          ? '<span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black">🟢 ضمن السقف القانوني للنظام الجزافي (IFU آمن)</span>'
          : d.ceilingUsagePct < 95
          ? '<span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">🟡 اقترب من سقف الـ IFU</span>'
          : '<span class="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black">🔴 تجاوز سقف الـ IFU (نظام حقيقي G50)</span>';

      // بناء صفوف جدول تفصيل السلع المقننة المباعة فعلياً داخل الصفحة
      const inlineRegulatedRows =
        d.regulatedBreakdown.length > 0
          ? d.regulatedBreakdown
              .map((it, idx) => {
                const taxOnMarginOnly = Number(((it.margin * d.rateG) / 100).toFixed(2));
                const taxSavedByExemption = Number(((it.costExempt * d.rateG) / 100).toFixed(2));
                return `
                  <tr class="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td class="py-2.5 px-3 font-mono text-slate-400">#${idx + 1}</td>
                    <td class="py-2.5 px-3 font-black text-slate-900 dark:text-white">${it.name}</td>
                    <td class="py-2.5 px-3 font-mono font-bold">${it.qty} وحدة</td>
                    <td class="py-2.5 px-3 font-mono font-bold">${this.fmtDzd(it.sales)}</td>
                    <td class="py-2.5 px-3 font-mono font-black text-emerald-600 dark:text-emerald-400">- ${this.fmtDzd(it.costExempt)}</td>
                    <td class="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">${this.fmtDzd(it.margin)}</td>
                    <td class="py-2.5 px-3 font-mono font-bold text-amber-600">${this.fmtDzd(taxOnMarginOnly)} <span class="text-[10px] text-emerald-600 block">(وفّرت ${this.fmtDzd(taxSavedByExemption)})</span></td>
                  </tr>
                `;
              })
              .join('')
          : `<tr><td colspan="7" class="py-5 text-center text-slate-400 font-bold">لم يتم بيع سلع مقننة في الفواتير بعد — اضغط على (🍞 تحديد السلع المقننة) لاختيار الحليب أو السميد أو الزيت أو السكر في متجرك.</td></tr>`;

      // بناء سجل المصاريف الجبائية المسددة فعلياً
      const paidTaxHistoryHtml =
        d.taxExpensesList.length > 0
          ? d.taxExpensesList
              .map(
                (ex) => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <div>
                    <span class="font-black text-emerald-900 dark:text-emerald-200">✅ ${ex.description || ex.category}</span>
                    <span class="text-[11px] text-slate-500 font-mono mr-2">📅 ${String(ex.date || '').slice(0, 10)}</span>
                  </div>
                  <span class="font-mono font-black text-emerald-700 dark:text-emerald-300">${this.fmtDzd(ex.amount)}</span>
                </div>`
              )
              .join('')
          : '<div class="text-xs text-slate-400 font-bold py-2 text-center">لم يتم قيد أي دفعة ضريبية في سجل المصاريف لهذه السنة حتى الآن.</div>';

      container.innerHTML = `
        <!-- ==================== [1] الترويسة التنفيذية + شريط المفسر الجبائي الذكي ==================== -->
        <div class="rounded-2xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white p-5 shadow-xl border border-indigo-500/30 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2.5 flex-wrap">
                <span class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs">13. 🇩🇿 استوديو الجباية والضرائب للتجزئة</span>
                <h2 class="text-xl font-black">مركز الضريبة الجزافية الوحيدة (IFU — G12 / G12 Bis) وملخص G50</h2>
                ${statusBadge}
              </div>
              <p class="text-xs text-slate-300 mt-1">
                نظام محاسبي وجبائي شفاف 100%: يفصل تلقائياً بين السلع العادية والسلع المقننة، ويشرح لك الفرق بين ضريبتك النسبية الفعلية (5%) والحد الأدنى القانوني.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <select id="v33FiscalYearSelect" class="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-600 text-white font-black text-xs">
                <option value="${d.year}" selected>📅 السنة الجبائية: ${d.year}</option>
                <option value="${d.year - 1}">📅 السنة الجبائية: ${d.year - 1}</option>
                <option value="${d.year + 1}">📅 السنة الجبائية: ${d.year + 1}</option>
              </select>
              <button type="button" onclick="window.GherbiRetailFiscalStudio.openRegulatedProductsManagerModal()" class="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow">
                🍞 تحديد وجرد السلع المقننة (${d.regulatedProductsCount} صنف)
              </button>
              <button type="button" onclick="window.GherbiRetailFiscalStudio.openZakatTab12()" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition">
                🕌 حاسبة الزكاة (تبويب 12)
              </button>
              <button type="button" onclick="window.GherbiRetailFiscalStudio.askAiAboutTaxes()" class="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs transition">
                🤖 استشارة الوكيل الذكي
              </button>
              <button type="button" onclick="window.GherbiRetailFiscalStudio.printOfficialG12Statement()" class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs transition">
                🖨️ طباعة استمارة G12 الرسمية
              </button>
              <button type="button" onclick="window.GherbiRetailFiscalStudio.exportFiscalCsv()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-emerald-400 font-black text-xs transition">
                📊 تصدير Excel
              </button>
            </div>
          </div>

          <!-- صندوق المفسر الجبائي الذكي بلغة التاجر المبسطة -->
          <div class="rounded-xl bg-white/10 border border-indigo-400/30 p-3.5 text-xs leading-relaxed">
            <div class="font-black text-amber-300 mb-1 flex items-center justify-between">
              <span>💡 كيف تقرأ وضعيتك الجبائية الحالية في 3 نقاط واضحة؟</span>
              <span class="text-[11px] text-indigo-200 font-mono">عتبة تجاوز الحد الأدنى (10,000 د.ج) هي: ${this.fmtDzd(d.breakEvenTurnoverForMin)}</span>
            </div>
            <ul class="space-y-1 text-slate-100 list-disc list-inside">
              <li>
                <strong>1. مبيعاتك وإعفاء المواد المقننة:</strong> حقق متجرك إجمالي مبيعات قدره <strong class="text-white font-mono">${this.fmtDzd(d.annualTurnoverDzd)}</strong> عبر <strong>${d.salesCount} فاتورة</strong>، منها <strong>${d.realRegulatedUnitsSold} وحدة</strong> من المواد المقننة (حليب/سميد/زيت/سكر...) بإجمالي بيع <strong class="font-mono">${this.fmtDzd(d.realRegulatedSalesDzd)}</strong>؛ وقد أعفى النظام رأسمال شرائها البالغ <strong class="text-emerald-300 font-mono">${this.fmtDzd(d.regulatedDeduction)} (${d.effectiveExemptPct}%)</strong> ليبقى ربحها الصافي فقط (<strong class="font-mono">${this.fmtDzd(d.realRegulatedMarginDzd)}</strong>) داخل الوعاء.
              </li>
              <li>
                <strong>2. ضريبتك النسبية الفعلية (${d.rateG}%):</strong> بعد طرح رأسمال المواد المقننة، يصبح وعاؤك الصافي الخاضع للضريبة هو <strong class="text-white font-mono">${this.fmtDzd(d.taxableGoodsTurnover)}</strong>، وضريبته الحقيقية بنسبة ${d.rateG}% هي <strong class="text-amber-300 font-mono">${this.fmtDzd(d.exactProportionalTax)} (${this.fmtCentimes(d.exactProportionalTax)})</strong> فقط.
              </li>
              <li>
                <strong>3. لماذا يظهر المبلغ النهائي ${this.fmtDzd(d.finalIfuTaxDue)}؟</strong>
                ${
                  d.isMinimumApplied
                    ? `لأن قانون الضرائب الجزائري يفرض <strong>حداً أدنى قانونياً سنوياً قدره ${this.fmtDzd(d.minLegalTax)} (مليون سنتيم)</strong> في تصريح G12 طالما أن مبيعاتك الخاضعة لم تتجاوز <strong class="font-mono">${this.fmtDzd(d.breakEvenTurnoverForMin)}</strong>. (يمكنك إيقاف خيار الحد الأدنى من لوحة الإعدادات بالأسفل إذا أردت رؤية الأقساط محسوبة على أساس ${this.fmtDzd(d.exactProportionalTax)} فقط).`
                    : `تم اعتماد الضريبة المحسوبة مباشرة بقيمة <strong class="text-emerald-300 font-mono">${this.fmtDzd(d.finalIfuTaxDue)}</strong>.`
                }
              </li>
            </ul>
          </div>

          <!-- شريط استهلاك السقف القانوني للنظام الجزافي -->
          <div class="pt-1">
            <div class="flex items-center justify-between text-xs font-bold mb-1">
              <span>📊 استهلاك السقف السنوي للنظام الجزافي (IFU): <strong class="text-amber-300 font-mono">${this.fmtDzd(d.annualTurnoverDzd)}</strong> من أصل <strong class="text-white font-mono">${this.fmtDzd(d.ceiling)} (800 مليون سنتيم)</strong></span>
              <span class="font-mono text-sm font-black text-emerald-400">${d.ceilingUsagePct}%</span>
            </div>
            <div class="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700">
              <div class="h-full rounded-full bg-emerald-500 transition-all duration-500" style="width: ${Math.max(2, d.ceilingUsagePct)}%"></div>
            </div>
          </div>
        </div>

        <!-- ==================== [2] شلال المعادلة الجبائية البصري (5 بطاقات متسلسلة تشرح الحساب خطوة بخطوة) ==================== -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
          <!-- خطوة 1: إجمالي المبيعات -->
          <div class="rounded-2xl p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm relative">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[10px]">الخطوة [1] — المبيعات (A)</span>
              <span class="text-xs font-bold text-slate-400">${d.salesCount} فاتورة</span>
            </div>
            <div class="text-xs font-bold text-slate-500 mt-1.5">إجمالي رقم الأعمال السنوي</div>
            <div class="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">${this.fmtDzd(d.annualTurnoverDzd)}</div>
            <div class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">🇩🇿 ${this.fmtCentimes(d.annualTurnoverDzd)}</div>
            <div class="text-[10px] text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-700 pt-1">
              نقداً: ${this.fmtDzd(d.totalCashSalesDzd)} | آجل: ${this.fmtDzd(d.totalCreditSalesDzd)}
            </div>
          </div>

          <!-- خطوة 2: يطرح إعفاء المواد المقننة -->
          <div class="rounded-2xl p-4 bg-white dark:bg-slate-800 border-2 border-emerald-500/40 shadow-sm relative">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black text-[10px]">الخطوة [2] — يُطرح الإعفاء (- B)</span>
              <button type="button" onclick="window.GherbiRetailFiscalStudio.openRegulatedProductsManagerModal()" class="text-[10px] font-black text-indigo-600 hover:underline">تعديل السلع 🔍</button>
            </div>
            <div class="text-xs font-bold text-slate-500 mt-1.5">رأسمال المواد المقننة المعفى (${d.effectiveExemptPct}%)</div>
            <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">- ${this.fmtDzd(d.regulatedDeduction)}</div>
            <div class="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              ${d.isAutoMode ? `🤖 من الفواتير (${d.realRegulatedUnitsSold} وحدة مقننة)` : `📐 نسبة تقديرية (${this.state.regulatedExemptRatio}%)`}
            </div>
            <div class="text-[10px] text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-700 pt-1">
              مبيعاتها: ${this.fmtDzd(d.realRegulatedSalesDzd)} | ربحها الخاضع: ${this.fmtDzd(d.realRegulatedMarginDzd)}
            </div>
          </div>

          <!-- خطوة 3: يساوي الوعاء الصافي الخاضع -->
          <div class="rounded-2xl p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm relative">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-black text-[10px]">الخطوة [3] — الوعاء (= C)</span>
              <span class="text-[10px] font-mono font-bold text-slate-400">A - B</span>
            </div>
            <div class="text-xs font-bold text-slate-500 mt-1.5">الوعاء الصافي الخاضع لـ ${d.rateG}%</div>
            <div class="text-xl font-black text-blue-600 dark:text-blue-400 font-mono mt-1">${this.fmtDzd(d.taxableGoodsTurnover)}</div>
            <div class="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1">🇩🇿 ${this.fmtCentimes(d.taxableGoodsTurnover)}</div>
            <div class="text-[10px] text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-700 pt-1">
              سلع عادية (${this.fmtDzd(d.regularGoodsTurnover)}) + ربح المقنن (${this.fmtDzd(d.realRegulatedMarginDzd)})
            </div>
          </div>

          <!-- خطوة 4: الضريبة النسبية الفعلية 5% -->
          <div class="rounded-2xl p-4 bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-400/50 shadow-sm relative">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">الخطوة [4] — ضريبة ${d.rateG}% الفعلية (D)</span>
              <span class="text-[10px] font-mono font-bold text-amber-700">C × ${d.rateG}%</span>
            </div>
            <div class="text-xs font-bold text-amber-900 dark:text-amber-200 mt-1.5">الضريبة النسبية المحسوبة فعلياً</div>
            <div class="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">${this.fmtDzd(d.exactProportionalTax)}</div>
            <div class="text-[11px] font-bold text-amber-800 dark:text-amber-300 mt-1">🇩🇿 ${this.fmtCentimes(d.exactProportionalTax)}</div>
            <div class="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1 border-t border-amber-200 dark:border-amber-800 pt-1">
              تمثل ${d.rateG}% بالضبط من وعائك الصافي
            </div>
          </div>

          <!-- خطوة 5: الضريبة النهائية الواجبة الأداء والمتبقي -->
          <div class="rounded-2xl p-4 bg-indigo-600 text-white shadow-lg relative">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded bg-white/20 text-white font-black text-[10px]">الخطوة [5] — الواجب دفعه (E)</span>
              <span class="text-[10px] font-bold text-amber-300">${d.isMinimumApplied ? '⚖️ الحد الأدنى' : '✔ نسبة 5%'}</span>
            </div>
            <div class="text-xs font-bold text-indigo-100 mt-1.5">الضريبة النهائية المستحقة (G12)</div>
            <div class="text-xl font-black font-mono mt-1">${this.fmtDzd(d.finalIfuTaxDue)}</div>
            <div class="text-[11px] font-bold text-amber-300 mt-1">🇩🇿 ${this.fmtCentimes(d.finalIfuTaxDue)}</div>
            <div class="text-[10px] text-indigo-100 mt-1 border-t border-indigo-400/40 pt-1 flex items-center justify-between font-bold">
              <span>المسدد: ${this.fmtDzd(d.paidTaxExpensesDzd)}</span>
              <span class="text-amber-300">المتبقي: ${this.fmtDzd(remainingToPay)}</span>
            </div>
          </div>
        </div>

        <!-- ==================== [3] محاكي استمارة G12 الرسمية + رزنامة الأقساط الثلاثة ==================== -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- يمين: محاكي استمارة التصريح الرسمي لقباضة الضرائب (Série G N°12) -->
          <div class="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div>
                <h3 class="font-black text-sm text-slate-900 dark:text-white">📋 محاكي استمارة التصريح الجبائي الرسمي (Série G N°12 / G12 Bis)</h3>
                <p class="text-[11px] text-slate-500">الأرقام الجاهزة لملء خانات وثيقة الضرائب الرسمية بدون أي خطأ حسابي</p>
              </div>
              <button type="button" onclick="window.GherbiRetailFiscalStudio.copyG12SummaryToClipboard()" class="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white font-black text-xs transition border border-indigo-200 dark:border-indigo-800">
                📋 نسخ أرقام G12
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-xs text-right border-collapse">
                <thead>
                  <tr class="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th class="py-2 px-2.5">خانة استمارة G12 (طبيعة النشاط)</th>
                    <th class="py-2 px-2.5">رقم الأعمال الخاضع</th>
                    <th class="py-2 px-2.5">المعدل</th>
                    <th class="py-2 px-2.5">الضريبة المحسوبة</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-700 font-bold">
                  <tr>
                    <td class="py-2 px-2.5">1. مبيعات السلع العادية بالتجزئة (خاضعة كلياً)</td>
                    <td class="py-2 px-2.5 font-mono">${this.fmtDzd(d.regularGoodsTurnover)}</td>
                    <td class="py-2 px-2.5 font-mono text-indigo-600">${d.rateG}%</td>
                    <td class="py-2 px-2.5 font-mono">${this.fmtDzd((d.regularGoodsTurnover * d.rateG) / 100)}</td>
                  </tr>
                  <tr class="bg-emerald-50/40 dark:bg-emerald-950/15">
                    <td class="py-2 px-2.5">
                      2. المواد المقننة واسعة الاستهلاك (الهامش الصافي فقط)
                      <span class="block text-[10px] text-emerald-600">إجمالي بيعها: ${this.fmtDzd(d.realRegulatedSalesDzd)} | رأسمالها المعفى: ${this.fmtDzd(d.regulatedDeduction)}</span>
                    </td>
                    <td class="py-2 px-2.5 font-mono text-emerald-700 dark:text-emerald-400">${this.fmtDzd(d.realRegulatedMarginDzd)}</td>
                    <td class="py-2 px-2.5 font-mono text-indigo-600">${d.rateG}%</td>
                    <td class="py-2 px-2.5 font-mono text-emerald-700 dark:text-emerald-400">${this.fmtDzd((d.realRegulatedMarginDzd * d.rateG) / 100)}</td>
                  </tr>
                  <tr>
                    <td class="py-2 px-2.5">3. إيرادات الخدمات والأنشطة الأخرى</td>
                    <td class="py-2 px-2.5 font-mono">${this.fmtDzd(d.serviceRev)}</td>
                    <td class="py-2 px-2.5 font-mono text-indigo-600">${d.rateS}%</td>
                    <td class="py-2 px-2.5 font-mono">${this.fmtDzd(d.rawIfuServiceTax)}</td>
                  </tr>
                  <tr class="bg-amber-50/60 dark:bg-amber-950/20 font-black">
                    <td class="py-2.5 px-2.5">المجموع النسبي الفعلي (قبل الحد الأدنى)</td>
                    <td class="py-2.5 px-2.5 font-mono">${this.fmtDzd(d.taxableGoodsTurnover + d.serviceRev)}</td>
                    <td class="py-2.5 px-2.5 font-mono">—</td>
                    <td class="py-2.5 px-2.5 font-mono text-amber-600">${this.fmtDzd(d.exactProportionalTax)}</td>
                  </tr>
                  <tr class="bg-indigo-600/10 dark:bg-indigo-500/20 font-black text-indigo-950 dark:text-white">
                    <td class="py-2.5 px-2.5" colspan="3">
                      🏛️ الضريبة الجزافية الوحيدة النهائية الواجبة الأداء في قباضة الضرائب
                      <span class="block text-[10px] font-normal text-slate-500 dark:text-slate-300">${d.isMinimumApplied ? 'تم تطبيق الحد الأدنى القانوني (المادة 282 مكرر 6 من قانون الضرائب المباشرة)' : 'محسوبة بنسبة 5% المباشرة'}</span>
                    </td>
                    <td class="py-2.5 px-2.5 font-mono text-sm text-indigo-600 dark:text-indigo-300">${this.fmtDzd(d.finalIfuTaxDue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- يسار: رزنامة تسديد الأقساط الفصلية الثلاثة (30% / 30% / 40%) وسجل الدفعات -->
          <div class="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div>
                <h3 class="font-black text-sm text-slate-900 dark:text-white">🗓️ رزنامة الأقساط القانونية الثلاثة (G12) وحالة التسديد</h3>
                <p class="text-[11px] text-slate-500">اضغط (💸 قيد كمصروف) عند تسديد أي قسط ليُخصم تلقائياً من المتبقي</p>
              </div>
              <button type="button" onclick="window.GherbiRetailFiscalStudio.goToExpensesView()" class="text-xs font-black text-indigo-600 hover:underline">
                💸 سجل المصاريف ⬅
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-xs text-right">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th class="py-2 px-2">القسط الجبائي</th>
                    <th class="py-2 px-2">موعد الاستحقاق</th>
                    <th class="py-2 px-2">النسبة</th>
                    <th class="py-2 px-2">المبلغ الواجب</th>
                    <th class="py-2 px-2">الحالة</th>
                    <th class="py-2 px-2 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-700 font-bold">
                  <tr>
                    <td class="py-2.5 px-2">القسط الأول (Tranche 1)</td>
                    <td class="py-2.5 px-2 font-mono">15 - 30 جوان ${d.year}</td>
                    <td class="py-2.5 px-2 font-mono text-indigo-600">30%</td>
                    <td class="py-2.5 px-2 font-mono">${this.fmtDzd(d.tranche1_June)}</td>
                    <td class="py-2.5 px-2">
                      ${d.isTranche1Paid ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">✅ مسدد</span>' : '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black">⏳ قيد الانتظار</span>'}
                    </td>
                    <td class="py-2.5 px-2 text-center">
                      <button type="button" onclick="window.GherbiRetailFiscalStudio.recordTaxAsExpense(${d.tranche1_June}, 'تسديد القسط الأول G12 (30% - جوان ${d.year})')" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 hover:text-white font-black text-[11px] transition">
                        💸 قيد كمصروف
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-2.5 px-2">القسط الثاني (Tranche 2)</td>
                    <td class="py-2.5 px-2 font-mono">15 - 30 سبتمبر ${d.year}</td>
                    <td class="py-2.5 px-2 font-mono text-indigo-600">30%</td>
                    <td class="py-2.5 px-2 font-mono">${this.fmtDzd(d.tranche2_Sept)}</td>
                    <td class="py-2.5 px-2">
                      ${d.isTranche2Paid ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">✅ مسدد</span>' : '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black">⏳ قيد الانتظار</span>'}
                    </td>
                    <td class="py-2.5 px-2 text-center">
                      <button type="button" onclick="window.GherbiRetailFiscalStudio.recordTaxAsExpense(${d.tranche2_Sept}, 'تسديد القسط الثاني G12 (30% - سبتمبر ${d.year})')" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 hover:text-white font-black text-[11px] transition">
                        💸 قيد كمصروف
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-2.5 px-2">الرصيد الختامي (G12 Bis)</td>
                    <td class="py-2.5 px-2 font-mono">15 - 30 ديسمبر ${d.year}</td>
                    <td class="py-2.5 px-2 font-mono text-indigo-600">40%</td>
                    <td class="py-2.5 px-2 font-mono">${this.fmtDzd(d.tranche3_Dec)}</td>
                    <td class="py-2.5 px-2">
                      ${d.isTranche3Paid ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">✅ مسدد</span>' : '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black">⏳ قيد الانتظار</span>'}
                    </td>
                    <td class="py-2.5 px-2 text-center">
                      <button type="button" onclick="window.GherbiRetailFiscalStudio.recordTaxAsExpense(${d.tranche3_Dec}, 'تسديد الرصيد الختامي G12 Bis (40% - ديسمبر ${d.year})')" class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 hover:text-white font-black text-[11px] transition">
                        💸 قيد كمصروف
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- أرشيف الدفعات المسددة -->
            <div class="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
              <div class="text-[11px] font-black text-slate-600 dark:text-slate-300">🧾 سجل الدفعات الجبائية المقيدة في المصاريف (${d.year}):</div>
              ${paidTaxHistoryHtml}
            </div>
          </div>
        </div>

        <!-- ==================== [4] جدول الجرد التفصيلي المباشر للسلع المقننة المباعة في الفواتير ==================== -->
        <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
            <div>
              <h3 class="font-black text-sm text-slate-900 dark:text-white">🍞 تفصيل المبيعات الفعلية للمواد المقننة والمدعمة من داخل فواتيرك (${d.regulatedBreakdown.length} صنف مباع / ${d.realRegulatedUnitsSold} وحدة)</h3>
              <p class="text-[11px] text-slate-500">يوضح هذا الجدول كيف حُسب مبلغ الإعفاء (- ${this.fmtDzd(d.regulatedDeduction)}) سطراً بسطر من الفواتير، وكيف وُفرت الضريبة عن رأسمال هذه السلع</p>
            </div>
            <button type="button" onclick="window.GherbiRetailFiscalStudio.openRegulatedProductsManagerModal()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow">
              ➕ إضافة / تعديل قائمة السلع المقننة في المخزن (${d.regulatedProductsCount} محدد)
            </button>
          </div>

          <div class="overflow-x-auto max-h-64">
            <table class="w-full text-xs text-right">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th class="py-2 px-3">#</th>
                  <th class="py-2 px-3">اسم السلعة المقننة المباعة</th>
                  <th class="py-2 px-3">الكمية المباعة</th>
                  <th class="py-2 px-3">إجمالي سعر البيع</th>
                  <th class="py-2 px-3 text-emerald-600">رأسمال الشراء المعفى (يُطرح من الوعاء)</th>
                  <th class="py-2 px-3 text-indigo-600">هامش الربح الصافي الخاضع</th>
                  <th class="py-2 px-3 text-amber-600">ضريبة 5% على الربح فقط (ومقدار الوفر)</th>
                </tr>
              </thead>
              <tbody>
                ${inlineRegulatedRows}
              </tbody>
            </table>
          </div>
        </div>

        <!-- ==================== [5] إعدادات المعايرة الجبائية + توزيع الثلاثيات الأربعة وملخص G50 ==================== -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- يمين: إعدادات المعايرة وخيار تفعيل/إيقاف الحد الأدنى القانوني -->
          <div class="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-sm">
            <h3 class="font-black text-sm text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">⚙️ إعدادات ومعايرة الحاسبة الجبائية</h3>

            <div class="space-y-2 text-xs">
              <label class="block font-bold text-slate-600 dark:text-slate-300">مصدر حساب إعفاء المواد المقننة:</label>
              <select id="v32CalcModeSelect" onchange="window.GherbiRetailFiscalStudio.onModeChange(this.value)" class="w-full px-3 py-2 rounded-xl border border-indigo-400 bg-indigo-50/50 dark:bg-slate-900 font-black text-xs">
                <option value="auto_invoices" ${d.isAutoMode ? 'selected' : ''}>🤖 حساب حقيقي آلي من السلع المباعة في الفواتير (يعفي رأسمال السلع المقننة)</option>
                <option value="manual_ratio" ${!d.isAutoMode ? 'selected' : ''}>📐 نسبة تقديرية يدوية من إجمالي المبيعات (%)</option>
              </select>
            </div>

            <!-- خيار تطبيق الحد الأدنى القانوني (10,000 د.ج) أو عرض نسبة 5% الصافية -->
            <label class="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 cursor-pointer text-xs">
              <div class="flex items-center gap-2">
                <input id="v33EnforceMinCheckbox" type="checkbox" ${this.state.enforceLegalMinimum ? 'checked' : ''} onchange="window.GherbiRetailFiscalStudio.toggleLegalMinimum(this.checked)" class="w-4 h-4 rounded accent-amber-600">
                <span class="font-black text-amber-950 dark:text-amber-200">تطبيق الحد الأدنى القانوني للضريبة (10,000 د.ج)</span>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950">قانون المالية</span>
            </label>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">معدل ضريبة بيع السلع (IFU %)</label>
                <input id="v30IfuRateGoods" type="number" step="0.5" value="${this.state.ifuRateGoods}" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono font-bold">
              </div>
              <div class="${d.isAutoMode ? 'opacity-50' : ''}">
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">النسبة اليدوية (في الوضع التقديري %)</label>
                <input id="v30RegulatedRatio" type="number" step="1" min="0" max="95" value="${this.state.regulatedExemptRatio}" ${d.isAutoMode ? 'disabled' : ''} class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono font-bold">
              </div>
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">إيرادات خدمات إضافية (12% د.ج)</label>
                <input id="v30ServiceRev" type="number" step="100" value="${this.state.serviceRevenueDzd}" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono font-bold">
              </div>
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">السقف السنوي للـ IFU (د.ج)</label>
                <input id="v30IfuCeiling" type="number" step="100000" value="${this.state.ifuCeilingDzd}" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono font-bold">
              </div>
            </div>

            <button type="button" onclick="window.GherbiRetailFiscalStudio.saveFormSettings()" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow">
              💾 حفظ الإعدادات وإعادة حساب الضريبة فوراً
            </button>
          </div>

          <!-- يسار: تفصيل الثلاثيات الأربعة + ملخص G50 والمشتريات -->
          <div class="lg:col-span-7 space-y-4">
            <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <h4 class="font-black text-xs text-slate-700 dark:text-slate-200 mb-3">📈 تفصيل مبيعات التجزئة حسب الثلاثيات الأربعة (${d.year})</h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-center">
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div class="text-[11px] text-slate-500 font-bold">الثلاثي الأول (جانفي - مارس)</div>
                  <div class="font-mono font-black text-xs mt-1">${this.fmtDzd(d.qTurnover[0])}</div>
                  <div class="text-[10px] text-indigo-600 font-bold mt-0.5">${d.qSalesCount[0]} فاتورة</div>
                </div>
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div class="text-[11px] text-slate-500 font-bold">الثلاثي الثاني (أفريل - جوان)</div>
                  <div class="font-mono font-black text-xs mt-1">${this.fmtDzd(d.qTurnover[1])}</div>
                  <div class="text-[10px] text-indigo-600 font-bold mt-0.5">${d.qSalesCount[1]} فاتورة</div>
                </div>
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div class="text-[11px] text-slate-500 font-bold">الثلاثي الثالث (جويلية - سبتمبر)</div>
                  <div class="font-mono font-black text-xs mt-1">${this.fmtDzd(d.qTurnover[2])}</div>
                  <div class="text-[10px] text-indigo-600 font-bold mt-0.5">${d.qSalesCount[2]} فاتورة</div>
                </div>
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div class="text-[11px] text-slate-500 font-bold">الثلاثي الرابع (أكتوبر - ديسمبر)</div>
                  <div class="font-mono font-black text-xs mt-1">${this.fmtDzd(d.qTurnover[3])}</div>
                  <div class="text-[10px] text-indigo-600 font-bold mt-0.5">${d.qSalesCount[3]} فاتورة</div>
                </div>
              </div>
            </div>

            <div class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-black text-xs text-slate-700 dark:text-slate-200">🏛️ ملخص المشتريات والرسوم المجمعة (TVA & Droit de Timbre — G50)</h4>
                <button type="button" onclick="window.GherbiRetailFiscalStudio.goToPurchasesView()" class="text-xs font-black text-indigo-600 hover:underline">🛍️ مراجعة فواتير الشراء (${d.purchasesCount}) ⬅</button>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-center">
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div class="text-[11px] text-slate-500 font-bold">إجمالي فواتير الشراء</div>
                  <div class="font-mono font-black text-xs text-slate-900 dark:text-white mt-1">${this.fmtDzd(d.totalPurchasesDzd)}</div>
                </div>
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div class="text-[11px] text-slate-500 font-bold">TVA المبيعات المحصلة</div>
                  <div class="font-mono font-black text-xs text-indigo-600 mt-1">${this.fmtDzd(d.totalTvaCollected)}</div>
                </div>
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div class="text-[11px] text-slate-500 font-bold">TVA المشتريات المسترجعة</div>
                  <div class="font-mono font-black text-xs text-emerald-600 mt-1">${this.fmtDzd(d.totalPurchasesTva)}</div>
                </div>
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div class="text-[11px] text-slate-500 font-bold">حقوق الطابع الجبائي (Timbre)</div>
                  <div class="font-mono font-black text-xs text-amber-600 mt-1">${this.fmtDzd(d.totalTimbreCollected)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const yrSelect = document.getElementById('v33FiscalYearSelect');
      if (yrSelect) {
        yrSelect.addEventListener('change', (e) => {
          this.state.year = Number(e.target.value);
          this.saveConfig();
          this.renderFiscalStudioContent(container);
        });
      }
    },

    toggleLegalMinimum(isChecked) {
      this.state.enforceLegalMinimum = Boolean(isChecked);
      this.saveConfig();
      this.refreshStudioUI();
      if (window.showToast) {
        window.showToast(
          isChecked
            ? '⚖️ تم تفعيل الحد الأدنى القانوني (10,000 د.ج) وفق قانون الضرائب الجزائري'
            : '📐 تم التبديل لعرض الضريبة النسبية الفعلية (5%) فقط على الأقساط',
          'info'
        );
      }
    },

    async copyG12SummaryToClipboard() {
      const d = await this.computeFiscalData();
      const text = [
        `=== كشف التصريح الجبائي للضريبة الجزافية الوحيدة (G12 / G12 Bis - ${d.year}) ===`,
        `1. إجمالي رقم الأعمال السنوي: ${this.fmtDzd(d.annualTurnoverDzd)} (${this.fmtCentimes(d.annualTurnoverDzd)})`,
        `2. مبيعات السلع العادية (خاضعة لـ ${d.rateG}%): ${this.fmtDzd(d.regularGoodsTurnover)}`,
        `3. مبيعات المواد المقننة: ${this.fmtDzd(d.realRegulatedSalesDzd)} | رأسمالها المعفى: ${this.fmtDzd(d.regulatedDeduction)} | ربحها الخاضع: ${this.fmtDzd(d.realRegulatedMarginDzd)}`,
        `4. الوعاء الجبائي الصافي الخاضع لـ ${d.rateG}%: ${this.fmtDzd(d.taxableGoodsTurnover)}`,
        `5. الضريبة النسبية الفعلية (${d.rateG}%): ${this.fmtDzd(d.exactProportionalTax)}`,
        `6. الضريبة النهائية الواجبة الأداء: ${this.fmtDzd(d.finalIfuTaxDue)}`,
        `   - القسط الأول (30% جوان): ${this.fmtDzd(d.tranche1_June)}`,
        `   - القسط الثاني (30% سبتمبر): ${this.fmtDzd(d.tranche2_Sept)}`,
        `   - الرصيد الختامي (40% ديسمبر): ${this.fmtDzd(d.tranche3_Dec)}`
      ].join('\n');
      try {
        await navigator.clipboard.writeText(text);
        if (window.showToast) window.showToast('📋 تم نسخ جميع أرقام استمارة G12 إلى الحافظة بنجاح!', 'success');
      } catch (_) {}
    },

    async openRegulatedProductsManagerModal() {
      let products = window.AppState?.products || [];
      if ((!products || !products.length) && window.api?.getProducts) {
        products = await window.api.getProducts();
      }
      const d = await this.computeFiscalData();

      let modal = document.getElementById('v32RegulatedProductsModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'v32RegulatedProductsModal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4';
        document.body.appendChild(modal);
      }

      const productRows = (products || [])
        .map((p) => {
          const isReg = this.isProductRegulated(p);
          return `
            <label class="flex items-center justify-between p-2.5 rounded-xl border ${
              isReg
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            } cursor-pointer hover:border-indigo-500 transition text-xs">
              <div class="flex items-center gap-2.5">
                <input type="checkbox" data-reg-prod-id="${p.id}" ${isReg ? 'checked' : ''} onchange="window.GherbiRetailFiscalStudio.toggleProductRegulatedFromModal(${p.id}, this.checked)" class="w-4 h-4 rounded accent-emerald-600">
                <div>
                  <div class="font-black text-slate-900 dark:text-white">${p.name || 'بدون اسم'}</div>
                  <div class="text-[11px] text-slate-500">الشراء: ${this.fmtDzd(p.cost_price)} | البيع: ${this.fmtDzd(p.selling_price)}</div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-black ${
                isReg ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }">${isReg ? '🇩🇿 سلعة مقننة (معفاة الرأسمال)' : 'سلعة عادية (5%)'}</span>
            </label>
          `;
        })
        .join('');

      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden" dir="rtl">
          <div class="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h3 class="text-base font-black">🍞 تحديد السلع المقننة والمدعمة في متجرك (إعفاء G12 IFU)</h3>
              <p class="text-xs text-slate-300 mt-0.5">ضع علامة ✔ أمام أي سلعة مقننة (حليب، سميد، فرينة، زيت، سكر، خبز...) ليقوم البرنامج بإعفاء رأسمال شرائها من ضريبة الـ 5% تلقائياً.</p>
            </div>
            <button type="button" onclick="document.getElementById('v32RegulatedProductsModal').classList.add('hidden')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-white font-black text-xs">✕ إغلاق</button>
          </div>

          <div class="p-4 overflow-y-auto space-y-3 flex-1">
            <div class="flex items-center justify-between">
              <span class="font-black text-xs text-slate-700 dark:text-slate-200">قائمة منتجات المتجر (${d.totalProductsCount} منتج):</span>
              <span class="text-xs font-black text-emerald-600">السلع المصنفة كمقننة حالياً: ${d.regulatedProductsCount} صنف</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              ${productRows}
            </div>
          </div>

          <div class="p-3 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
            <button type="button" onclick="document.getElementById('v32RegulatedProductsModal').classList.add('hidden'); window.GherbiRetailFiscalStudio.refreshStudioUI();" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow">
              ✔ حفظ التحديد وإعادة حساب الجباية الآن
            </button>
          </div>
        </div>
      `;

      modal.classList.remove('hidden');
    },

    toggleProductRegulatedFromModal(productId, isChecked) {
      this.setProductRegulated(productId, isChecked);
    },

    async refreshStudioUI() {
      const pane = document.getElementById('v30RetailFiscalStudioContainer');
      if (pane) await this.renderFiscalStudioContent(pane);
    },

    onModeChange(val) {
      this.state.calcMode = val === 'manual_ratio' ? 'manual_ratio' : 'auto_invoices';
      this.saveConfig();
      this.refreshStudioUI();
    },

    saveFormSettings() {
      const modeSel = document.getElementById('v32CalcModeSelect');
      if (modeSel) this.state.calcMode = modeSel.value;
      const minChk = document.getElementById('v33EnforceMinCheckbox');
      if (minChk) this.state.enforceLegalMinimum = Boolean(minChk.checked);
      this.state.ifuRateGoods = Math.max(0, Number(document.getElementById('v30IfuRateGoods')?.value ?? 5));
      this.state.regulatedExemptRatio = Math.max(0, Math.min(95, Number(document.getElementById('v30RegulatedRatio')?.value ?? 15)));
      this.state.serviceRevenueDzd = Math.max(0, Number(document.getElementById('v30ServiceRev')?.value ?? 0));
      this.state.ifuCeilingDzd = Math.max(100000, Number(document.getElementById('v30IfuCeiling')?.value ?? 8000000));
      this.saveConfig();
      this.refreshStudioUI();
      if (window.showToast) window.showToast('✅ تم تحديث معايير الجباية وإعادة احتساب تصريح G12 بنجاح!', 'success');
    },

    async recordTaxAsExpense(amount, description) {
      try {
        const amt = Number(amount || 0);
        if (amt <= 0) return;
        await window.api.addExpense({
          category: 'ضرائب وجباية (IFU G12)',
          description,
          amount: amt,
          date: new Date().toISOString().slice(0, 10),
          deductFromCaisse: false
        });
        if (window.AppState && window.api?.getExpenses) {
          window.AppState.expenses = await window.api.getExpenses();
        }
        await this.refreshStudioUI();
        if (window.showToast) window.showToast(`💸 تم قيد (${this.fmtDzd(amt)}) في سجل المصاريف الجبائية بنجاح!`, 'success');
      } catch (e) {
        if (window.showToast) window.showToast('⚠️ تعذر تسجيل المصروف: ' + e.message, 'error');
      }
    },

    goToExpensesView() {
      if (window.App && typeof window.App.switchView === 'function') window.App.switchView('expenses');
    },

    goToPurchasesView() {
      if (window.App && typeof window.App.switchView === 'function') window.App.switchView('purchases');
    },

    async askAiAboutTaxes() {
      const d = await this.computeFiscalData();
      if (window.App && typeof window.App.switchView === 'function') await window.App.switchView('ai-assistant');
      setTimeout(() => {
        const input = document.querySelector('#view-ai-assistant input[type="text"], #view-ai-assistant textarea');
        if (input) {
          input.value = `احسب لي الزكاة والضريبة الجزافية IFU (رقم أعمالي السنوي ${d.annualTurnoverDzd} د.ج، وإعفاء المواد المقننة الفعلي ${d.regulatedDeduction} د.ج، والضريبة النسبية ${d.exactProportionalTax} د.ج، والضريبة النهائية ${d.finalIfuTaxDue} د.ج)`;
          input.focus();
        }
      }, 150);
    },

    async exportFiscalCsv() {
      const d = await this.computeFiscalData();
      const rows = [
        ['البند الجبائي', 'القيمة بالدينار (د.ج)', 'القيمة بالسنتيم'],
        ['السنة الجبائية', d.year, ''],
        ['1. إجمالي رقم الأعمال السنوي للتجزئة (A)', d.annualTurnoverDzd.toFixed(2), this.fmtCentimes(d.annualTurnoverDzd)],
        ['2. مبيعات السلع العادية (خاضعة كلياً لـ 5%)', d.regularGoodsTurnover.toFixed(2), this.fmtCentimes(d.regularGoodsTurnover)],
        ['3. مبيعات المواد المقننة الكلية', d.realRegulatedSalesDzd.toFixed(2), this.fmtCentimes(d.realRegulatedSalesDzd)],
        ['4. رأسمال المواد المقننة المعفى من الضريبة (- B)', d.regulatedDeduction.toFixed(2), this.fmtCentimes(d.regulatedDeduction)],
        ['5. هامش ربح المواد المقننة الصافي الخاضع', d.realRegulatedMarginDzd.toFixed(2), this.fmtCentimes(d.realRegulatedMarginDzd)],
        ['6. الوعاء الصافي الخاضع للضريبة الجزافية (= C)', d.taxableGoodsTurnover.toFixed(2), this.fmtCentimes(d.taxableGoodsTurnover)],
        ['7. الضريبة النسبية الفعلية (5%) (= D)', d.exactProportionalTax.toFixed(2), this.fmtCentimes(d.exactProportionalTax)],
        ['8. الضريبة النهائية الواجبة الأداء (G12) (= E)', d.finalIfuTaxDue.toFixed(2), this.fmtCentimes(d.finalIfuTaxDue)],
        ['القسط الأول (30% - جوان)', d.tranche1_June.toFixed(2), this.fmtCentimes(d.tranche1_June)],
        ['القسط الثاني (30% - سبتمبر)', d.tranche2_Sept.toFixed(2), this.fmtCentimes(d.tranche2_Sept)],
        ['الرصيد الختامي (40% - ديسمبر)', d.tranche3_Dec.toFixed(2), this.fmtCentimes(d.tranche3_Dec)]
      ];
      const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gherbi_Retail_IFU_G12_${d.year}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('📊 تم تصدير الكشف الجبائي التفصيلي إلى ملف Excel بنجاح!', 'success');
    },

    async printOfficialG12Statement() {
      const d = await this.computeFiscalData();
      const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>
        body { font-family: 'Cairo', Tahoma, sans-serif; padding: 12mm; color: #0f172a; }
        h2 { text-align: center; margin: 0 0 4px 0; }
        .sub { text-align: center; font-size: 12px; color: #475569; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: right; }
        th { background: #f1f5f9; font-weight: 900; }
      </style></head><body>
        <h2>🇩🇿 استمارة حساب الضريبة الجزافية الوحيدة للتجزئة (Série G N°12 / G12 Bis)</h2>
        <div class="sub">السنة الجبائية: ${d.year} | تاريخ الطباعة: ${new Date().toLocaleString('fr-DZ')}</div>
        <table>
          <tbody>
            <tr><th>1. إجمالي رقم الأعمال السنوي (Chiffre d'Affaires Global)</th><td>${this.fmtDzd(d.annualTurnoverDzd)} (${this.fmtCentimes(d.annualTurnoverDzd)})</td></tr>
            <tr><th>2. مبيعات السلع العادية بالتجزئة (خاضعة لـ ${d.rateG}%)</th><td>${this.fmtDzd(d.regularGoodsTurnover)}</td></tr>
            <tr><th>3. مبيعات المواد المقننة (إجمالي البيع: ${this.fmtDzd(d.realRegulatedSalesDzd)}) — الرأسمال المعفى</th><td>- ${this.fmtDzd(d.regulatedDeduction)} (${d.effectiveExemptPct}%)</td></tr>
            <tr><th>4. هامش الربح الصافي للمواد المقننة الخاضع للضريبة</th><td>${this.fmtDzd(d.realRegulatedMarginDzd)}</td></tr>
            <tr><th>5. الوعاء الصافي الإجمالي الخاضع لـ ${d.rateG}%</th><td><strong>${this.fmtDzd(d.taxableGoodsTurnover)}</strong></td></tr>
            <tr><th>6. الضريبة النسبية المحسوبة (${d.rateG}%)</th><td>${this.fmtDzd(d.exactProportionalTax)}</td></tr>
            <tr><th>7. الضريبة النهائية الواجبة الأداء (G12)</th><td><strong>${this.fmtDzd(d.finalIfuTaxDue)} (${this.fmtCentimes(d.finalIfuTaxDue)})</strong></td></tr>
            <tr><th>القسط الفصلي الأول (30% — جوان ${d.year})</th><td>${this.fmtDzd(d.tranche1_June)}</td></tr>
            <tr><th>القسط الفصلي الثاني (30% — سبتمبر ${d.year})</th><td>${this.fmtDzd(d.tranche2_Sept)}</td></tr>
            <tr><th>الرصيد الختامي (40% — ديسمبر ${d.year})</th><td>${this.fmtDzd(d.tranche3_Dec)}</td></tr>
          </tbody>
        </table>
      </body></html>`;
      window.__gherbiMasterPrintSilent({ html, silent: false });
    }
  };

  window.GherbiRetailFiscalStudio = RetailFiscalStudio;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailFiscalStudio.init());
  } else {
    RetailFiscalStudio.init();
  }
})();


/* ==================== [V42 OMNISCIENT 360 FORENSIC STUDIO + A4/80MM TIME & LOCATION PRINT ENGINE] ==================== */
(function initV42OmniscientForensicAndPrintStudio() {
  const DEPT_META = {
    ALL: { label: '🌐 كل الصفحات والأقسام', badgeCls: 'bg-slate-800 text-white' },
    POS: { label: '🛒 الكاشير والمبيعات', badgeCls: 'bg-rose-100 text-rose-800 border border-rose-300' },
    INVENTORY: { label: '📦 المخزون والمنتجات والدفعات', badgeCls: 'bg-indigo-100 text-indigo-800 border border-indigo-300' },
    CAISSE: { label: '🏦 الصندوق والمناوبات والمصاريف', badgeCls: 'bg-amber-100 text-amber-900 border border-amber-300' },
    PURCHASES: { label: '🛍️ المشتريات والموردين', badgeCls: 'bg-teal-100 text-teal-800 border border-teal-300' },
    PARTIES: { label: '👥 الزبائن والديون والوفاء', badgeCls: 'bg-purple-100 text-purple-800 border border-purple-300' },
    SECURITY: { label: '🔐 المستخدمون والإعدادات', badgeCls: 'bg-slate-200 text-slate-900 border border-slate-400' }
  };

  const WHERE_PRINT_OPTIONS = [
    { id: 'ALL', label: '🌐 كل الصفحات والأقسام (شامل لكل الحركات)' },
    { id: 'TYPE:BELOW_COST', label: '🚨 البيع بأقل من سعر الشراء أو بالتكلفة فقط' },
    { id: 'TYPE:DELETED_LINE', label: '🗑️ السطور المحذوفة بعد المسح بالباركود فقط' },
    { id: 'TYPE:CART_CLEAR', label: '🧹 عمليات تفريغ وإلغاء السلة (F4) فقط' },
    { id: 'TYPE:DISCOUNT', label: '📉 التخفيضات السعرية اليدوية (F12 / Alt+P) فقط' },
    { id: 'TYPE:PARTIAL_QTY', label: '⚖️ مبيعات الكميات الجزئية بالمبلغ فقط' },
    { id: 'DEPT:POS', label: '🛒 قسم الكاشير والمبيعات (كل حركات الكاشير)' },
    { id: 'DEPT:INVENTORY', label: '📦 قسم المخزون والمنتجات والدفعات والجرد' },
    { id: 'DEPT:CAISSE', label: '🏦 قسم الصندوق والمناوبات والمصاريف ورأس المال' },
    { id: 'DEPT:PURCHASES', label: '🛍️ قسم المشتريات وفواتير الموردين' },
    { id: 'DEPT:PARTIES', label: '👥 قسم الزبائن والديون ونقاط الوفاء' },
    { id: 'DEPT:SECURITY', label: '🔐 قسم المستخدمين والإعدادات والأمان' },
    { id: 'SPECIAL:LATE_NIGHT', label: '🌙 الحركات الليلية المتأخرة فقط (من 22:00 إلى 06:00)' }
  ];

  const ForensicCenter = {
    isTab14Active: false,
    activeLens: 'all_pages_stream', // 'all_pages_stream' | 'below_cost_radar' | 'hot_products' | 'cashier_scorecard'
    activeDeptFilter: 'ALL',
    posSubFilter: 'ALL',
    dateRangeFilter: 'ALL', // 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
    customFromDateTime: '',
    customToDateTime: '',
    cashierFilter: 'ALL',
    searchQuery: '',
    backendLogs: [],
    scrappedDomLogs: [],
    loggedCartBelowCostSignatures: new Set(),
    lastBadgeTotal: -1,
    isRenderingModal: false,

    // إعدادات نافذة الطباعة المخصصة والكلية (A4 / 80mm)
    printConfig: {
      format: 'a4',          // 'a4' | '80mm'
      whereScope: 'ALL',     // من قائمة WHERE_PRINT_OPTIONS
      cashier: 'ALL',
      datePreset: 'ALL',     // 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
      fromDateTime: '',
      toDateTime: ''
    },

    init() {
      const wait = setInterval(() => {
        if (!window.App) return;
        clearInterval(wait);
        this.installLiveCartBelowCostDetector();
        this.installFrontendActionHooks();
        this.hookGlobalNavigationAndTopShield();
        this.startTab14ButtonAndCleanupLoop();
        console.log('🖨️ [Gherbi V42 Forensic Print & Filter Studio]: طباعة A4 و 80mm بالتوقيت (من-إلى) والمكان (أين) والطباعة الكلية جاهزة 100%.');
      }, 150);
    },

    fmtDzd(val) {
      return Number(val || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    },

    fmtCentimes(val) {
      const c = Math.round(Math.abs(Number(val || 0)) * 100);
      if (c === 0) return '0 سنتيم';
      return c >= 1000000 ? (c / 1000000).toFixed(2) + ' مليون سنتيم' : (c / 1000).toFixed(1) + ' ألف سنتيم';
    },

    getCurrentUserName() {
      const domName = document.getElementById('currentUserName')?.textContent?.trim();
      return window.AppState?.currentUser?.name || domName || 'المدير العام';
    },

    // ========================================================================
    // 1. الراصد اللحظي في سلة الكاشير لكشف أي بيع بأقل من سعر الشراء أو بالتكلفة
    // ========================================================================
    resolveTrueProductCostAndCatalogPrice(cartItem) {
      if (!cartItem) return { costPrice: 0, catalogPrice: 0, stock: 0, name: 'صنف' };
      const pid = Number(cartItem.product_id || cartItem.productId || cartItem.id || 0);
      const bid = Number(cartItem.batch_id || cartItem.batchId || 0);
      let costPrice = Number(cartItem.cost_price ?? cartItem.costPrice ?? 0);
      let catalogPrice = Number(cartItem.original_price ?? cartItem.basePrice ?? cartItem.selling_price ?? 0);
      let stock = Number(cartItem.stock ?? cartItem.available_stock ?? 0);
      let name = String(cartItem.name || cartItem.product_name || cartItem.custom_product_name || 'صنف').trim();

      const products = window.AppState?.products || [];
      const prod = products.find((p) => Number(p.id) === pid || (p.name && String(p.name).trim() === name));

      if (prod) {
        if (!name || name === 'صنف') name = prod.name;
        if (Array.isArray(prod.batches) && prod.batches.length > 0) {
          const targetBatch = bid ? prod.batches.find((b) => Number(b.id) === bid) || prod.batches[0] : prod.batches[0];
          if (targetBatch) {
            if (!costPrice || costPrice <= 0) costPrice = Number(targetBatch.cost_price || 0);
            if (!catalogPrice || catalogPrice <= 0) catalogPrice = Number(targetBatch.selling_price || 0);
          }
          const totalStk = prod.batches.reduce((s, b) => s + Number(b.stock || 0), 0);
          if (totalStk > 0 || stock === 0) stock = totalStk;
        }
        if (!costPrice || costPrice <= 0) costPrice = Number(prod.cost_price || 0);
        if (!catalogPrice || catalogPrice <= 0) catalogPrice = Number(prod.selling_price || 0);
      }

      return { costPrice, catalogPrice, stock, name };
    },

    recordLocalBelowCostEvent(entry) {
      try {
        const key = 'gherbi_v8_below_cost_audit_log_v1';
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        const list = Array.isArray(arr) ? arr : [];
        list.unshift(entry);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 300)));

        const radarKey = 'gherbi_v9_owner_price_radar_log_v1';
        const rArr = JSON.parse(localStorage.getItem(radarKey) || '[]');
        const rList = Array.isArray(rArr) ? rArr : [];
        rList.unshift({
          time: entry.time,
          cashier: entry.cashier,
          customer: entry.customer || 'زبون عابر',
          productName: entry.productName,
          mode: 'below_cost',
          isBelowOrAtCost: true,
          costPrice: entry.costPrice,
          oldPrice: entry.oldPrice || entry.costPrice,
          newPrice: entry.soldPrice,
          newQty: entry.qty,
          remainingStock: entry.remainingStock,
          lineTotal: Number((entry.soldPrice * entry.qty).toFixed(2)),
          netProfit: Number(((entry.soldPrice - entry.costPrice) * entry.qty).toFixed(2)),
          priceDelta: Number(((entry.soldPrice - (entry.oldPrice || entry.costPrice)) * entry.qty).toFixed(2)),
          reason: entry.reason
        });
        localStorage.setItem(radarKey, JSON.stringify(rList.slice(0, 400)));
      } catch (_) {}
    },

    scanCurrentCartForBelowCost(triggerSource = 'cart_edit') {
      try {
        const cart =
          typeof window.App?.getCurrentCart === 'function'
            ? window.App.getCurrentCart()
            : window.AppState?.carts?.[window.AppState?.activeCartIndex || 0];
        if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return;

        const subTotal = cart.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 1), 0);
        const globalDisc = Math.max(0, Number(document.getElementById('cartDiscountInput')?.value || cart.discount || 0));
        const discFactor = subTotal > 0 && globalDisc > 0 ? Math.max(0, (subTotal - globalDisc) / subTotal) : 1;

        for (const item of cart.items) {
          const qty = Math.abs(Number(item.quantity ?? item.qty ?? 1)) || 1;
          const unitPrice = Number(item.price ?? 0);
          if (unitPrice <= 0) continue;

          const effectiveSoldPrice = Number((unitPrice * discFactor).toFixed(2));
          const { costPrice, catalogPrice, stock, name } = this.resolveTrueProductCostAndCatalogPrice(item);

          if (costPrice > 0 && effectiveSoldPrice <= costPrice) {
            const sig = `${name}|${effectiveSoldPrice}|${qty}`;
            if (this.loggedCartBelowCostSignatures.has(sig) && triggerSource !== 'submit_sale') continue;
            this.loggedCartBelowCostSignatures.add(sig);

            const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
            const cashier = this.getCurrentUserName();
            const unitLoss = Number((costPrice - effectiveSoldPrice).toFixed(2));
            const totalLoss = Number((unitLoss * qty).toFixed(2));

            this.recordLocalBelowCostEvent({
              time: nowStr,
              cashier,
              productName: name,
              costPrice,
              oldPrice: catalogPrice || costPrice,
              soldPrice: effectiveSoldPrice,
              qty,
              diff: -unitLoss,
              remainingStock: Number((stock - qty).toFixed(2)),
              reason:
                effectiveSoldPrice < costPrice
                  ? `🚨 بيع بأقل من سعر الشراء: الكلفة ${costPrice.toFixed(2)} د.ج والبيع ${effectiveSoldPrice.toFixed(2)} د.ج (خسارة -${totalLoss.toFixed(2)} د.ج)`
                  : `⚠️ بيع بسعر التكلفة (ربح 0 د.ج): الكلفة ${costPrice.toFixed(2)} د.ج والبيع ${effectiveSoldPrice.toFixed(2)} د.ج`
            });
          }
        }
      } catch (_) {}
    },

    installLiveCartBelowCostDetector() {
      const self = this;
      for (const fnName of ['recalcCart', 'confirmNumberInputModal', 'openCheckoutModal', 'submitSale']) {
        if (typeof window.App[fnName] === 'function' && !window.App['_v42Hook_' + fnName]) {
          const orig = window.App[fnName].bind(window.App);
          window.App['_v42Hook_' + fnName] = true;
          window.App[fnName] = function (...args) {
            self.scanCurrentCartForBelowCost(fnName);
            const res = orig(...args);
            setTimeout(() => self.scanCurrentCartForBelowCost(fnName), 60);
            return res;
          };
        }
      }
    },

    installFrontendActionHooks() {
      const self = this;
      const methods = [
        'saveProductFromModal',
        'submitNewBatchFromModal',
        'submitPurchaseInvoice',
        'submitSupplierReturnFromModal',
        'confirmSaveExpense',
        'confirmSaveCapital',
        'confirmOpenShift',
        'confirmCloseShift',
        'confirmCaisseTx',
        'submitCustomerPaymentModal',
        'submitSupplierPaymentModal'
      ];
      for (const fn of methods) {
        if (typeof window.App[fn] === 'function' && !window.App['_v42Track_' + fn]) {
          const orig = window.App[fn].bind(window.App);
          window.App['_v42Track_' + fn] = true;
          window.App[fn] = async function (...args) {
            const res = await orig(...args);
            setTimeout(() => self.fetchBackendLogsAndRefresh(), 200);
            return res;
          };
        }
      }
    },

    // ========================================================================
    // 2. فحص التوقيت الدقيق (من تاريخ وساعة -> إلى تاريخ وساعة)
    // ========================================================================
    checkEventMatchesTimeFilter(rawTimeStr, presetMode, fromStr, toStr) {
      if (!rawTimeStr) return true;
      const normalized = String(rawTimeStr).trim().replace('T', ' ');
      const datePart = normalized.slice(0, 10);
      if (!/^d{4}-d{2}-d{2}$/.test(datePart)) return true;

      const timePart = normalized.length >= 16 ? normalized.slice(11, 16) : '00:00';
      const eventIsoMinute = `${datePart}T${timePart}`;

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      if (presetMode === 'TODAY') {
        return datePart === todayStr;
      }
      if (presetMode === 'YESTERDAY') {
        const yest = new Date(now.getTime() - 86400000);
        const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
        return datePart === yestStr;
      }
      if (presetMode === 'WEEK') {
        const diff = (now.getTime() - new Date(datePart + 'T00:00:00').getTime()) / 86400000;
        return diff <= 7.5;
      }
      if (presetMode === 'MONTH') {
        const diff = (now.getTime() - new Date(datePart + 'T00:00:00').getTime()) / 86400000;
        return diff <= 31.5;
      }

      // إذا كان هناك تحديد "من" أو "إلى" (سواء في الوضع المخصص أو مع أي وضع)
      if (fromStr && String(fromStr).trim()) {
        const cleanFrom = String(fromStr).trim().replace(' ', 'T');
        const fromCompare = cleanFrom.length === 10 ? cleanFrom + 'T00:00' : cleanFrom.slice(0, 16);
        if (eventIsoMinute < fromCompare) return false;
      }
      if (toStr && String(toStr).trim()) {
        const cleanTo = String(toStr).trim().replace(' ', 'T');
        const toCompare = cleanTo.length === 10 ? cleanTo + 'T23:59' : cleanTo.slice(0, 16);
        if (eventIsoMinute > toCompare) return false;
      }

      return true;
    },

    isDateWithinRange(rawTimeStr) {
      return this.checkEventMatchesTimeFilter(
        rawTimeStr,
        this.dateRangeFilter,
        this.customFromDateTime,
        this.customToDateTime
      );
    },

    // ========================================================================
    // 3. تجميع وتوحيد كافة السجلات الرقابية من جميع الصفحات
    // ========================================================================
    async fetchBackendLogsAndRefresh() {
      try {
        if (window.api && typeof window.api.getAuditLogs === 'function') {
          const rows = await window.api.getAuditLogs({ limit: 450 });
          if (Array.isArray(rows)) {
            this.backendLogs = rows;
          }
        }
      } catch (_) {}
      this.refreshActiveViews();
    },

    readLocalArrays() {
      const safeParse = (k) => {
        try {
          const r = localStorage.getItem(k);
          const p = r ? JSON.parse(r) : [];
          return Array.isArray(p) ? p : [];
        } catch (_) {
          return [];
        }
      };
      return {
        priceRadarLogs: safeParse('gherbi_v9_owner_price_radar_log_v1'),
        belowCostLogs: safeParse('gherbi_v8_below_cost_audit_log_v1'),
        loyaltyLogs: safeParse('gherbi_v10_loyalty_audit_log_v1').concat(safeParse('gherbi_loyalty_audit_log_v1'))
      };
    },

    compileAllMasterEventsUnfiltered() {
      const { priceRadarLogs, belowCostLogs } = this.readLocalArrays();
      const products = window.AppState?.products || [];

      const catalogMap = new Map();
      for (const p of products) {
        if (p.name) {
          const bCost = Array.isArray(p.batches) && p.batches.length > 0 ? Number(p.batches[0].cost_price || 0) : 0;
          catalogMap.set(String(p.name).trim(), {
            id: p.id,
            barcode: p.barcode || '-',
            costPrice: Number(p.cost_price || bCost || 0),
            sellingPrice: Number(p.selling_price || 0),
            stock: Number(p.stock ?? p.quantity ?? 0)
          });
        }
      }

      const masterEvents = [];
      const dedupSet = new Set();

      const pushMasterEvent = (ev) => {
        const sig = `${String(ev.time).slice(0, 16)}|${ev.eventType}|${ev.productName}|${Number(ev.impactDzd || 0).toFixed(0)}`;
        if (dedupSet.has(sig)) return;
        dedupSet.add(sig);
        masterEvents.push(ev);
      };

      for (const b of belowCostLogs) {
        const rawTime = String(b.time || b.date || '').replace('T', ' ').trim().slice(0, 19);
        const pName = String(b.productName || b.name || 'صنف').trim();
        const cat = catalogMap.get(pName) || {};
        const costP = Number(b.costPrice ?? b.cost_price ?? cat.costPrice ?? 0);
        const soldP = Number(b.soldPrice ?? b.selling_price ?? b.price ?? 0);
        const qty = Math.max(1, Number(b.qty ?? b.quantity ?? 1));
        const unitLoss = Math.max(0, Number((costP - soldP).toFixed(2)));
        const totalLoss = Number((unitLoss * qty).toFixed(2));
        const hour = Number((rawTime.split(' ')[1] || '12:00').split(':')[0]);

        pushMasterEvent({
          time: rawTime.slice(0, 16),
          rawTime,
          dept: 'POS',
          eventType: 'BELOW_COST',
          severity: 'critical',
          cashier: String(b.cashier || b.user_name || 'المدير العام').trim(),
          customer: b.customer || 'زبون عابر',
          docNumber: b.doc_number || 'الكاشير',
          productName: pName,
          reasonText: b.reason || `🚨 بيع بأقل من سعر الشراء: الشراء ${costP.toFixed(2)} د.ج والبيع ${soldP.toFixed(2)} د.ج (خسارة -${totalLoss.toFixed(2)} د.ج)`,
          qty,
          remStock: b.remainingStock !== undefined ? b.remainingStock : (cat.stock ?? '-'),
          costP,
          oldP: Number(b.oldPrice || cat.sellingPrice || costP),
          newP: soldP,
          lineTotal: Number((soldP * qty).toFixed(2)),
          netProfit: -totalLoss,
          impactDzd: totalLoss,
          badgeHtml: '<span class="px-3 py-1 rounded-full bg-rose-600 text-white font-black text-[11px]">🚨 بيع بخسارة / بالتكلفة</span>',
          isLateNight: hour >= 22 || hour < 6
        });
      }

      for (const r of priceRadarLogs) {
        const rawTime = String(r.time || r.date || '').replace('T', ' ').trim().slice(0, 19);
        const cashier = String(r.cashier || r.user_name || 'المدير العام').trim();
        const customer = String(r.customer || 'زبون عابر').trim();
        const pName = String(r.productName || r.name || 'صنف بالكاشير').trim();
        const cat = catalogMap.get(pName) || {};
        const mode = String(r.mode || r.type || '');
        const reason = String(r.reason || '');
        const oldP = Number(r.oldPrice ?? r.original_price ?? cat.sellingPrice ?? 0);
        const newP = Number(r.newPrice ?? r.price ?? 0);
        const costP = Number(r.costPrice ?? r.cost_price ?? cat.costPrice ?? 0);
        const qty = Math.abs(Number(r.newQty ?? r.qty ?? r.quantity ?? 1)) || 1;
        const remStock = r.remainingStock !== undefined ? r.remainingStock : (cat.stock ?? '-');
        const lineTotal = Number(r.lineTotal ?? newP * qty ?? 0);
        const netProfit = Number(r.netProfit ?? (newP > 0 ? (newP - costP) * qty : 0));
        const delta = Number(r.priceDelta ?? (newP - oldP) * qty);
        const hour = Number((rawTime.split(' ')[1] || '12:00').split(':')[0]);

        let eventType = 'OTHER';
        let severity = 'info';
        let impactDzd = 0;
        let cleanReason = reason;
        let badgeHtml = '';

        if (mode === 'deleted_line' || reason.includes('حذف سطر') || (newP === 0 && oldP > 0)) {
          eventType = 'DELETED_LINE';
          severity = 'critical';
          impactDzd = Number(((oldP || cat.sellingPrice || 0) * qty).toFixed(2));
          cleanReason = '🗑️ حذف سطر من السلة بعد قراءة الباركود (إلغاء قبل التسديد)';
          badgeHtml = '<span class="px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-300 font-black text-[11px]">🗑️ محذوف بعد المسح</span>';
        } else if (r.isBelowOrAtCost || (newP > 0 && costP > 0 && newP <= costP)) {
          eventType = 'BELOW_COST';
          severity = 'critical';
          impactDzd = Math.max(0, Number(((costP - newP) * qty).toFixed(2)));
          cleanReason = `🚨 تعديل سعر البيع إلى أو تحت سعر الشراء (الكلفة ${costP.toFixed(2)} د.ج ⬅ البيع ${newP.toFixed(2)} د.ج)`;
          badgeHtml = '<span class="px-3 py-1 rounded-full bg-rose-600 text-white font-black text-[11px]">🚨 بيع بخسارة / بالتكلفة</span>';
        } else if (mode === 'amount_scale' || reason.includes('بيع بالمبلغ') || reason.includes('كمية جزئية')) {
          eventType = 'PARTIAL_QTY';
          severity = 'info';
          impactDzd = lineTotal;
          cleanReason = cleanReason || '⚖️ بيع بالمبلغ (كمية جزئية مع ثبات السعر)';
          badgeHtml = '<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[11px]">⚖️ كمية بالمبلغ</span>';
        } else if (delta < -0.009 || (newP > 0 && oldP > 0 && newP < oldP)) {
          eventType = 'DISCOUNT';
          severity = 'warning';
          impactDzd = Math.abs(delta < -0.009 ? delta : (oldP - newP) * qty);
          cleanReason = cleanReason || '📉 تخفيض يدوي لسعر الوحدة في السلة';
          badgeHtml = '<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black text-[11px]">📉 تخفيض السعر</span>';
        } else if (delta > 0.009 || (newP > oldP && oldP > 0)) {
          eventType = 'INCREASE';
          severity = 'info';
          impactDzd = Math.abs(delta > 0.009 ? delta : (newP - oldP) * qty);
          cleanReason = cleanReason || '📈 زيادة يدوية لسعر الوحدة في السلة';
          badgeHtml = '<span class="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 font-black text-[11px]">📈 زيادة السعر</span>';
        }

        pushMasterEvent({
          time: rawTime.slice(0, 16),
          rawTime,
          dept: 'POS',
          eventType,
          severity,
          cashier,
          customer,
          docNumber: 'الكاشير',
          productName: pName,
          reasonText: cleanReason,
          qty,
          remStock,
          costP,
          oldP,
          newP,
          lineTotal,
          netProfit,
          impactDzd,
          badgeHtml,
          isLateNight: hour >= 22 || hour < 6
        });
      }

      const rawSource = this.backendLogs.length > 0 ? this.backendLogs : this.scrappedDomLogs;
      for (const item of rawSource) {
        const rawTime = String(item.created_at || item.timestamp || item.date || '')
          .replace('T', ' ')
          .replace(/s+/g, ' ')
          .trim()
          .slice(0, 19);
        const cashier = String(item.user_name || item.user || 'المدير العام').trim() || 'المدير العام';
        const code = String(item.action_type || item.action || '').trim();
        const rawPayload = item.details_json ?? item.details ?? '';
        let d = {};

        if (typeof rawPayload === 'object' && rawPayload !== null) {
          d = rawPayload;
        } else if (typeof rawPayload === 'string') {
          const str = rawPayload.trim();
          try {
            d = JSON.parse(str);
          } catch (_) {
            const prodM = str.match(/"(?:product|productName|name)"s*:s*"([^"]+)"/);
            const subM = str.match(/"(?:subtotal|total|amount|ImpactDzd)"s*:s*([0-9.]+)/);
            const qtyM = str.match(/"(?:qty|quantity|newQty)"s*:s*([0-9.]+)/);
            const cntM = str.match(/items_count"?s*:s*"?([0-9]+)/);
            d = {
              product: prodM ? prodM[1] : undefined,
              subtotal: subM ? Number(subM[1]) : undefined,
              qty: qtyM ? Number(qtyM[1]) : undefined,
              items_count: cntM ? Number(cntM[1]) : undefined,
              _raw: str
            };
          }
        }

        const pName = String(d.product || d.productName || d.name || '').trim();
        const cat = catalogMap.get(pName) || {};
        const hour = Number((rawTime.split(' ')[1] || '12:00').split(':')[0]);
        const isLateNight = hour >= 22 || hour < 6;

        let dept = d.dept || item.target_type || 'POS';
        if (!DEPT_META[dept]) dept = 'POS';

        if (code === 'sale_below_cost' || d.category === 'below_cost') {
          const qty = Math.abs(Number(d.qty || 1)) || 1;
          const costP = Number(d.costPrice || cat.costPrice || 0);
          const soldP = Number(d.soldPrice ?? d.newPrice ?? 0);
          const totalLoss = Number(d.totalLoss ?? Math.max(0, (costP - soldP) * qty));

          pushMasterEvent({
            time: rawTime.slice(0, 16),
            rawTime,
            dept: 'POS',
            eventType: 'BELOW_COST',
            severity: 'critical',
            cashier,
            customer: d.customer || 'زبون عابر',
            docNumber: d.doc_number || '#' + (item.target_id || ''),
            productName: pName || 'سلعة مباعة بأقل من الكلفة',
            reasonText: d.reason || `🚨 بيع بأقل من سعر الشراء: الكلفة ${costP.toFixed(2)} د.ج والبيع ${soldP.toFixed(2)} د.ج`,
            qty,
            remStock: d.remainingStock !== undefined ? d.remainingStock : (cat.stock ?? '-'),
            costP,
            oldP: Number(d.oldPrice || cat.sellingPrice || costP),
            newP: soldP,
            lineTotal: Number((soldP * qty).toFixed(2)),
            netProfit: -totalLoss,
            impactDzd: totalLoss,
            badgeHtml: '<span class="px-3 py-1 rounded-full bg-rose-600 text-white font-black text-[11px]">🚨 بيع بخسارة / بالتكلفة</span>',
            isLateNight
          });
        } else if (code === 'pos_price_discount' || d.category === 'discount') {
          const qty = Math.abs(Number(d.qty || 1)) || 1;
          const costP = Number(d.costPrice || cat.costPrice || 0);
          const oldP = Number(d.oldPrice || cat.sellingPrice || 0);
          const newP = Number(d.newPrice || 0);
          const discLoss = Number(d.discountLoss ?? Math.max(0, (oldP - newP) * qty));

          pushMasterEvent({
            time: rawTime.slice(0, 16),
            rawTime,
            dept: 'POS',
            eventType: 'DISCOUNT',
            severity: 'warning',
            cashier,
            customer: d.customer || 'زبون عابر',
            docNumber: d.doc_number || 'الكاشير',
            productName: pName || 'سلعة مخفضة',
            reasonText: d.reason || `📉 تخفيض سعر من ${oldP.toFixed(2)} إلى ${newP.toFixed(2)} د.ج`,
            qty,
            remStock: d.remainingStock !== undefined ? d.remainingStock : (cat.stock ?? '-'),
            costP,
            oldP,
            newP,
            lineTotal: Number((newP * qty).toFixed(2)),
            netProfit: costP > 0 ? Number(((newP - costP) * qty).toFixed(2)) : 0,
            impactDzd: discLoss,
            badgeHtml: '<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black text-[11px]">📉 تخفيض السعر</span>',
            isLateNight
          });
        } else if (code === 'pos_partial_qty' || d.category === 'partial_qty') {
          const qty = Number(d.qty || 1);
          const costP = Number(d.costPrice || cat.costPrice || 0);
          const newP = Number(d.newPrice || cat.sellingPrice || 0);
          const lTot = Number(d.lineTotal || newP * qty || 0);

          pushMasterEvent({
            time: rawTime.slice(0, 16),
            rawTime,
            dept: 'POS',
            eventType: 'PARTIAL_QTY',
            severity: 'info',
            cashier,
            customer: d.customer || 'زبون عابر',
            docNumber: d.doc_number || 'الكاشير',
            productName: pName || 'سلعة موزونة',
            reasonText: d.reason || `⚖️ بيع بكمية جزئية (${qty} وحدة)`,
            qty,
            remStock: d.remainingStock !== undefined ? d.remainingStock : (cat.stock ?? '-'),
            costP,
            oldP: newP,
            newP,
            lineTotal: lTot,
            netProfit: costP > 0 ? Number(((newP - costP) * qty).toFixed(2)) : 0,
            impactDzd: lTot,
            badgeHtml: '<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[11px]">⚖️ كمية بالمبلغ</span>',
            isLateNight
          });
        } else if (code === 'cart_cleared') {
          const cnt = Math.max(1, Number(d.items_count || d.qty || 1));
          pushMasterEvent({
            time: rawTime.slice(0, 16),
            rawTime,
            dept: 'POS',
            eventType: 'CART_CLEAR',
            severity: 'warning',
            cashier,
            customer: 'زبون عابر',
            docNumber: 'السلة',
            productName: `تفريغ وإلغاء السلة بالكامل (${cnt} أصناف ممسوحة)`,
            reasonText: '🧹 ضغط البائع على زر إفراغ السلة (F4) بعد مسح السلع وقبل التسديد',
            qty: cnt,
            remStock: '-',
            costP: 0,
            oldP: 0,
            newP: 0,
            lineTotal: 0,
            netProfit: 0,
            impactDzd: 0,
            badgeHtml: '<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black text-[11px]">🧹 تفريغ السلة</span>',
            isLateNight
          });
        } else if (
          code === 'cart_line_deleted' ||
          code === 'POS_LINE_OR_CART_VOIDED' ||
          d.category === 'voided_line' ||
          String(d.saleMode || '').includes('حذف سطر')
        ) {
          const cleanProd = pName || 'سلعة ممسوحة في الكاشير';
          const qty = Math.abs(Number(d.qty ?? d.quantity ?? d.newQty ?? 1)) || 1;
          const unitP = Number(d.price ?? d.oldPrice ?? cat.sellingPrice ?? 0);
          const sub = Number(d.subtotal ?? (unitP * qty) ?? 0);

          pushMasterEvent({
            time: rawTime.slice(0, 16),
            rawTime,
            dept: 'POS',
            eventType: 'DELETED_LINE',
            severity: 'critical',
            cashier,
            customer: 'زبون عابر',
            docNumber: 'السلة',
            productName: cleanProd,
            reasonText: '🗑️ حذف سطر من السلة بعد المسح بالباركود (إلغاء قبل التسديد)',
            qty,
            remStock: d.remainingStock !== undefined ? d.remainingStock : (cat.stock ?? '-'),
            costP: Number(d.costPrice ?? cat.costPrice ?? 0),
            oldP: unitP || sub,
            newP: 0,
            lineTotal: 0,
            netProfit: 0,
            impactDzd: Number(sub.toFixed(2)),
            badgeHtml: '<span class="px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-300 font-black text-[11px]">🗑️ محذوف بعد المسح</span>',
            isLateNight
          });
        } else {
          let mappedDept = dept;
          if (code.includes('product') || code.includes('batch') || code.includes('stocktake') || code.includes('bundle') || code.includes('promo')) mappedDept = 'INVENTORY';
          else if (code.includes('expense') || code.includes('caisse') || code.includes('shift') || code.includes('capital')) mappedDept = 'CAISSE';
          else if (code.includes('purchase') || code.includes('supplier_return')) mappedDept = 'PURCHASES';
          else if (code.includes('customer') || code.includes('supplier') || code.includes('loyalty') || code.includes('payment')) mappedDept = 'PARTIES';
          else if (code.includes('user') || code.includes('login') || code.includes('setting')) mappedDept = 'SECURITY';

          const amt = Number(d.amount ?? d.total ?? d.subtotal ?? 0);
          const deptInfo = DEPT_META[mappedDept] || DEPT_META.POS;

          pushMasterEvent({
            time: rawTime.slice(0, 16),
            rawTime,
            dept: mappedDept,
            eventType: 'CROSS_PAGE_EVENT',
            severity: item.severity || 'info',
            cashier,
            customer: d.customer || '-',
            docNumber: '#' + (item.target_id || '-'),
            productName: pName || d.titleAr || `عملية في (${deptInfo.label})`,
            reasonText: d.reason || d.details || d.titleAr || `حركة مسجلة (${code})`,
            qty: Number(d.qty || 1),
            remStock: d.remainingStock !== undefined ? d.remainingStock : '-',
            costP: Number(d.costPrice || 0),
            oldP: Number(d.oldPrice || 0),
            newP: Number(d.newPrice || amt || 0),
            lineTotal: amt,
            netProfit: 0,
            impactDzd: amt,
            badgeHtml: `<span class="px-2.5 py-1 rounded-full font-black text-[10px] ${deptInfo.badgeCls}">${deptInfo.label}</span>`,
            isLateNight
          });
        }
      }

      masterEvents.sort((a, b) => String(b.rawTime || b.time).localeCompare(String(a.rawTime || a.time)));
      return { masterEvents, catalogMap };
    },

    compileOmniscient360Data() {
      const { masterEvents, catalogMap } = this.compileAllMasterEventsUnfiltered();
      const products = window.AppState?.products || [];

      const allCashiersSet = new Set(['المدير العام']);
      for (const ev of masterEvents) allCashiersSet.add(ev.cashier);

      const dateAndCashierFiltered = masterEvents.filter((ev) => {
        if (!this.isDateWithinRange(ev.rawTime || ev.time)) return false;
        if (this.cashierFilter !== 'ALL' && ev.cashier !== this.cashierFilter) return false;
        return true;
      });

      const deptCounts = { ALL: dateAndCashierFiltered.length, POS: 0, INVENTORY: 0, CAISSE: 0, PURCHASES: 0, PARTIES: 0, SECURITY: 0 };
      let belowCostCount = 0;
      let belowCostLossDzd = 0;
      let deletedLinesCount = 0;
      let deletedLinesValDzd = 0;
      let cartClearedCount = 0;
      let cartClearedItemsCount = 0;
      let discountCount = 0;
      let discountLossDzd = 0;
      let increaseCount = 0;
      let increaseGainDzd = 0;
      let partialQtyCount = 0;
      let partialQtyValDzd = 0;

      const hotProductsMap = new Map();
      const cashierStatsMap = new Map();

      const ensureCashier = (name) => {
        const clean = String(name || 'المدير العام').trim() || 'المدير العام';
        if (!cashierStatsMap.has(clean)) {
          cashierStatsMap.set(clean, {
            name: clean,
            belowCost: 0,
            belowCostVal: 0,
            deletedLines: 0,
            deletedVal: 0,
            cartClears: 0,
            discounts: 0,
            discountVal: 0,
            otherPageActions: 0,
            lateNightCount: 0,
            totalEvents: 0
          });
        }
        return cashierStatsMap.get(clean);
      };

      for (const ev of dateAndCashierFiltered) {
        deptCounts[ev.dept] = (deptCounts[ev.dept] || 0) + 1;
        const cStat = ensureCashier(ev.cashier);
        cStat.totalEvents++;
        if (ev.isLateNight) cStat.lateNightCount++;

        if (ev.eventType === 'BELOW_COST') {
          belowCostCount++;
          belowCostLossDzd += ev.impactDzd;
          cStat.belowCost++;
          cStat.belowCostVal += ev.impactDzd;
        } else if (ev.eventType === 'DELETED_LINE') {
          deletedLinesCount++;
          deletedLinesValDzd += ev.impactDzd;
          cStat.deletedLines++;
          cStat.deletedVal += ev.impactDzd;
        } else if (ev.eventType === 'CART_CLEAR') {
          cartClearedCount++;
          cartClearedItemsCount += ev.qty;
          cStat.cartClears++;
        } else if (ev.eventType === 'DISCOUNT') {
          discountCount++;
          discountLossDzd += ev.impactDzd;
          cStat.discounts++;
          cStat.discountVal += ev.impactDzd;
        } else if (ev.eventType === 'INCREASE') {
          increaseCount++;
          increaseGainDzd += ev.impactDzd;
        } else if (ev.eventType === 'PARTIAL_QTY') {
          partialQtyCount++;
          partialQtyValDzd += ev.lineTotal;
        } else {
          cStat.otherPageActions++;
        }

        if (['BELOW_COST', 'DELETED_LINE', 'DISCOUNT'].includes(ev.eventType) && ev.productName && !ev.productName.includes('تفريغ')) {
          const cleanP = ev.productName;
          const cat = catalogMap.get(cleanP) || {};
          if (!hotProductsMap.has(cleanP)) {
            hotProductsMap.set(cleanP, {
              name: cleanP,
              belowCostTimes: 0,
              deletedTimes: 0,
              deletedVal: 0,
              discountTimes: 0,
              discountVal: 0,
              costPrice: ev.costP || cat.costPrice || 0,
              sellingPrice: ev.oldP || cat.sellingPrice || 0,
              stock: ev.remStock !== '-' ? ev.remStock : (cat.stock ?? 0),
              lastCashier: ev.cashier,
              lastTime: ev.time
            });
          }
          const hp = hotProductsMap.get(cleanP);
          if (ev.eventType === 'BELOW_COST') hp.belowCostTimes++;
          if (ev.eventType === 'DELETED_LINE') { hp.deletedTimes++; hp.deletedVal += ev.impactDzd; }
          if (ev.eventType === 'DISCOUNT') { hp.discountTimes++; hp.discountVal += ev.impactDzd; }
        }
      }

      const riskyInventoryProducts = [];
      for (const p of products) {
        if (p.deleted_at) continue;
        const bCost = Array.isArray(p.batches) && p.batches.length > 0 ? Number(p.batches[0].cost_price || 0) : 0;
        const cost = Number(p.cost_price || bCost || 0);
        const sell = Number(p.selling_price || 0);
        const stk = Number(p.stock ?? p.quantity ?? 0);
        if (cost > 0 && sell > 0 && (sell <= cost || ((sell - cost) / cost) * 100 < 3)) {
          riskyInventoryProducts.push({
            name: p.name,
            barcode: p.barcode || '-',
            costPrice: cost,
            sellingPrice: sell,
            marginDzd: Number((sell - cost).toFixed(2)),
            stock: stk
          });
        }
      }

      const cashierScorecards = Array.from(cashierStatsMap.values()).map((c) => {
        const penalty = c.belowCost * 12 + c.deletedLines * 4 + c.cartClears * 3 + c.discounts * 2;
        const trustScore = Math.max(25, Math.min(100, 100 - penalty));
        return { ...c, trustScore };
      });

      const storeIntegrityScore =
        cashierScorecards.length > 0
          ? Math.round(cashierScorecards.reduce((a, b) => a + b.trustScore, 0) / cashierScorecards.length)
          : 100;

      return {
        allUnfilteredEvents: masterEvents,
        allCashiers: Array.from(allCashiersSet),
        events: dateAndCashierFiltered,
        deptCounts,
        belowCostEvents: dateAndCashierFiltered.filter((x) => x.eventType === 'BELOW_COST'),
        hotProducts: Array.from(hotProductsMap.values()).sort(
          (a, b) => b.belowCostTimes * 500 + b.deletedVal + b.discountVal - (a.belowCostTimes * 500 + a.deletedVal + a.discountVal)
        ),
        riskyInventoryProducts,
        cashierScorecards,
        belowCostCount,
        belowCostLossDzd: Number(belowCostLossDzd.toFixed(2)),
        deletedLinesCount,
        deletedLinesValDzd: Number(deletedLinesValDzd.toFixed(2)),
        cartClearedCount,
        cartClearedItemsCount,
        discountCount,
        discountLossDzd: Number(discountLossDzd.toFixed(2)),
        increaseCount,
        increaseGainDzd: Number(increaseGainDzd.toFixed(2)),
        partialQtyCount,
        partialQtyValDzd: Number(partialQtyValDzd.toFixed(2)),
        storeIntegrityScore
      };
    },

    // ========================================================================
    // 4. نافذة استوديو إعداد وفرز الطباعة الجنائية (A4 و 80mm — بالتوقيت والمكان أو طباعة كلية)
    // ========================================================================
    filterEventsForPrintStudio(allEvents, cfg) {
      return (allEvents || []).filter((ev) => {
        // 1) فلتر التوقيت (من — إلى)
        if (!this.checkEventMatchesTimeFilter(ev.rawTime || ev.time, cfg.datePreset, cfg.fromDateTime, cfg.toDateTime)) {
          return false;
        }
        // 2) فلتر المستخدم / البائع
        if (cfg.cashier && cfg.cashier !== 'ALL' && ev.cashier !== cfg.cashier) {
          return false;
        }
        // 3) فلتر المكان / القسم أو نوع الحركة (أين)
        const scope = cfg.whereScope || 'ALL';
        if (scope === 'ALL') return true;
        if (scope.startsWith('TYPE:')) {
          const reqType = scope.replace('TYPE:', '');
          return ev.eventType === reqType;
        }
        if (scope.startsWith('DEPT:')) {
          const reqDept = scope.replace('DEPT:', '');
          return ev.dept === reqDept;
        }
        if (scope === 'SPECIAL:LATE_NIGHT') {
          return Boolean(ev.isLateNight);
        }
        return true;
      });
    },

    openForensicPrintModal(defaultFormat = 'a4') {
      // مزامنة الإعدادات المبدئية لنافذة الطباعة مع الفلاتر الحالية على الشاشة
      this.printConfig.format = defaultFormat === '80mm' ? '80mm' : 'a4';
      this.printConfig.cashier = this.cashierFilter || 'ALL';
      this.printConfig.datePreset = this.dateRangeFilter || 'ALL';
      this.printConfig.fromDateTime = this.customFromDateTime || '';
      this.printConfig.toDateTime = this.customToDateTime || '';

      if (this.activeLens === 'below_cost_radar') {
        this.printConfig.whereScope = 'TYPE:BELOW_COST';
      } else if (this.posSubFilter !== 'ALL') {
        this.printConfig.whereScope = 'TYPE:' + this.posSubFilter;
      } else if (this.activeDeptFilter !== 'ALL') {
        this.printConfig.whereScope = 'DEPT:' + this.activeDeptFilter;
      } else {
        this.printConfig.whereScope = 'ALL';
      }

      let printModal = document.getElementById('v42ForensicPrintStudioModal');
      if (!printModal) {
        printModal = document.createElement('div');
        printModal.id = 'v42ForensicPrintStudioModal';
        printModal.style.zIndex = '29000';
        printModal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4';
        document.body.appendChild(printModal);
      }

      this.renderForensicPrintModalContent();
      printModal.classList.remove('hidden');
    },

    renderForensicPrintModalContent() {
      const printModal = document.getElementById('v42ForensicPrintStudioModal');
      if (!printModal) return;

      const d = this.compileOmniscient360Data();
      const matchedEvents = this.filterEventsForPrintStudio(d.allUnfilteredEvents, this.printConfig);
      const matchedImpactDzd = matchedEvents.reduce((s, e) => s + Number(e.impactDzd || 0), 0);

      const whereOptionsHtml = WHERE_PRINT_OPTIONS.map(
        (opt) => `<option value="${opt.id}" ${this.printConfig.whereScope === opt.id ? 'selected' : ''}>${opt.label}</option>`
      ).join('');

      const cashierOptionsHtml = [
        `<option value="ALL" ${this.printConfig.cashier === 'ALL' ? 'selected' : ''}>👤 كل المستخدمين والبائعين</option>`,
        ...d.allCashiers.map((c) => `<option value="${c}" ${this.printConfig.cashier === c ? 'selected' : ''}>👤 المستخدم: ${c}</option>`)
      ].join('');

      const selectedWhereLabel =
        (WHERE_PRINT_OPTIONS.find((x) => x.id === this.printConfig.whereScope) || WHERE_PRINT_OPTIONS[0]).label;

      printModal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-right" dir="rtl">
          <!-- رأس نافذة الطباعة -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black shadow">🖨️</div>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">
                  استوديو طباعة وفرز السجل الرقابي الجنائي (A4 & 80mm)
                </h3>
                <p class="text-xs text-slate-500">
                  اختر الطباعة الكلية الشاملة بضغطة واحدة، أو حدد التوقيت (من — إلى) والمكان (أين) لطباعة ما تريد بدقة
                </p>
              </div>
            </div>
            <button type="button" onclick="document.getElementById('v42ForensicPrintStudioModal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 font-black">✕</button>
          </div>

          <!-- 1. اختيار مقاس الورق (A4 بجانب 80mm) -->
          <div class="grid grid-cols-2 gap-3">
            <button type="button" onclick="window.GherbiForensicCenterV40.setPrintFormat('a4')" class="p-3.5 rounded-2xl border-2 text-right transition flex items-center justify-between cursor-pointer ${this.printConfig.format === 'a4' ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-900 dark:text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">
              <div>
                <div class="font-black text-sm">📄 تقرير رسمي مفصل (A4)</div>
                <div class="text-[11px] opacity-80 mt-0.5">جدول كامل الأعمدة مع الترويسة والملخص والتوقيع</div>
              </div>
              <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${this.printConfig.format === 'a4' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400'}">✓</span>
            </button>

            <button type="button" onclick="window.GherbiForensicCenterV40.setPrintFormat('80mm')" class="p-3.5 rounded-2xl border-2 text-right transition flex items-center justify-between cursor-pointer ${this.printConfig.format === '80mm' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">
              <div>
                <div class="font-black text-sm">🖨️ تذكرة حرارية سريعة (80mm)</div>
                <div class="text-[11px] opacity-80 mt-0.5">مقاس طابعة الكاشير الحرارية مع الخلاصة</div>
              </div>
              <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${this.printConfig.format === '80mm' ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-400'}">✓</span>
            </button>
          </div>

          <!-- 2. فرز المكان (أين) والمستخدم (من) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <label class="block font-black text-slate-700 dark:text-slate-200 mb-1.5">📍 أين؟ (القسم أو نوع المخالفة المطلوب طباعتها):</label>
              <select onchange="window.GherbiForensicCenterV40.updatePrintCfg('whereScope', this.value)" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-xs">
                ${whereOptionsHtml}
              </select>
            </div>

            <div>
              <label class="block font-black text-slate-700 dark:text-slate-200 mb-1.5">👤 المستخدم / البائع:</label>
              <select onchange="window.GherbiForensicCenterV40.updatePrintCfg('cashier', this.value)" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-xs">
                ${cashierOptionsHtml}
              </select>
            </div>
          </div>

          <!-- 3. فرز التوقيت الدقيق (من تاريخ وساعة -> إلى تاريخ وساعة) -->
          <div class="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-black text-slate-700 dark:text-slate-200">⏰ الفترة والتوقيت (من — إلى):</span>
              <div class="flex flex-wrap items-center gap-1">
                <button type="button" onclick="window.GherbiForensicCenterV40.setPrintTimePreset('ALL')" class="px-2.5 py-1 rounded-lg font-black text-[11px] ${this.printConfig.datePreset === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">كل الأوقات</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPrintTimePreset('TODAY')" class="px-2.5 py-1 rounded-lg font-black text-[11px] ${this.printConfig.datePreset === 'TODAY' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">اليوم فقط</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPrintTimePreset('YESTERDAY')" class="px-2.5 py-1 rounded-lg font-black text-[11px] ${this.printConfig.datePreset === 'YESTERDAY' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">أمس</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPrintTimePreset('WEEK')" class="px-2.5 py-1 rounded-lg font-black text-[11px] ${this.printConfig.datePreset === 'WEEK' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">آخر 7 أيام</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPrintTimePreset('MONTH')" class="px-2.5 py-1 rounded-lg font-black text-[11px] ${this.printConfig.datePreset === 'MONTH' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}">هذا الشهر</button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">🕒 من تاريخ وتوقيت (From):</label>
                <input type="datetime-local" value="${this.printConfig.fromDateTime}" onchange="window.GherbiForensicCenterV40.updatePrintCfg('fromDateTime', this.value)" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono font-bold text-xs">
              </div>
              <div>
                <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">🕒 إلى تاريخ وتوقيت (To):</label>
                <input type="datetime-local" value="${this.printConfig.toDateTime}" onchange="window.GherbiForensicCenterV40.updatePrintCfg('toDateTime', this.value)" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono font-bold text-xs">
              </div>
            </div>
          </div>

          <!-- 4. شريط المعاينة الحية لنتيجة الفرز قبل الطباعة -->
          <div class="p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <div class="font-black text-indigo-950 dark:text-indigo-200">
                📊 الحركات المطابقة لفرزك الحالي: <span class="text-base font-mono text-rose-600">${matchedEvents.length} حركة</span> (من إجمالي ${d.allUnfilteredEvents.length})
              </div>
              <div class="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                المكان: ${selectedWhereLabel} | إجمالي الأثر المالي المفرز: <strong class="font-mono text-rose-600">${this.fmtDzd(matchedImpactDzd)}</strong>
              </div>
            </div>
            <button type="button" onclick="window.GherbiForensicCenterV40.applyPrintFiltersToMainScreen()" class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300 text-indigo-700 dark:text-indigo-300 font-black text-[11px] hover:bg-indigo-100">
              👁️ تطبيق هذا الفرز على الشاشة أيضاً
            </button>
          </div>

          <!-- 5. أزرار الطباعة النهائية: (طباعة حسب الفرز المحدد) أو (طباعة كلية شاملة للكل) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onclick="window.GherbiForensicCenterV40.executeForensicPrint(false)" class="py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer transition">
              <span>🎯 طباعة التقرير المفرز (${this.printConfig.format.toUpperCase()}) — (${matchedEvents.length} حركة)</span>
            </button>

            <button type="button" onclick="window.GherbiForensicCenterV40.executeForensicPrint(true)" class="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 font-black text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer transition">
              <span>🌐 طباعة كلية شاملة لكل السجل (${this.printConfig.format.toUpperCase()} — ${d.allUnfilteredEvents.length} حركة)</span>
            </button>
          </div>
        </div>
      `;
    },

    setPrintFormat(fmt) {
      this.printConfig.format = fmt === '80mm' ? '80mm' : 'a4';
      this.renderForensicPrintModalContent();
    },

    updatePrintCfg(key, val) {
      this.printConfig[key] = val;
      if (key === 'fromDateTime' || key === 'toDateTime') {
        this.printConfig.datePreset = 'CUSTOM';
      }
      this.renderForensicPrintModalContent();
    },

    setPrintTimePreset(preset) {
      this.printConfig.datePreset = preset;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      if (preset === 'ALL') {
        this.printConfig.fromDateTime = '';
        this.printConfig.toDateTime = '';
      } else if (preset === 'TODAY') {
        this.printConfig.fromDateTime = `${todayIso}T00:00`;
        this.printConfig.toDateTime = `${todayIso}T23:59`;
      } else if (preset === 'YESTERDAY') {
        const y = new Date(now.getTime() - 86400000);
        const yIso = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
        this.printConfig.fromDateTime = `${yIso}T00:00`;
        this.printConfig.toDateTime = `${yIso}T23:59`;
      } else if (preset === 'WEEK') {
        const w = new Date(now.getTime() - 7 * 86400000);
        const wIso = `${w.getFullYear()}-${pad(w.getMonth() + 1)}-${pad(w.getDate())}`;
        this.printConfig.fromDateTime = `${wIso}T00:00`;
        this.printConfig.toDateTime = `${todayIso}T23:59`;
      } else if (preset === 'MONTH') {
        const mIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
        this.printConfig.fromDateTime = `${mIso}T00:00`;
        this.printConfig.toDateTime = `${todayIso}T23:59`;
      }
      this.renderForensicPrintModalContent();
    },

    applyPrintFiltersToMainScreen() {
      this.dateRangeFilter = this.printConfig.datePreset;
      this.customFromDateTime = this.printConfig.fromDateTime;
      this.customToDateTime = this.printConfig.toDateTime;
      this.cashierFilter = this.printConfig.cashier;

      const ws = this.printConfig.whereScope || 'ALL';
      if (ws === 'TYPE:BELOW_COST') {
        this.activeLens = 'below_cost_radar';
      } else if (ws.startsWith('TYPE:')) {
        this.activeLens = 'all_pages_stream';
        this.activeDeptFilter = 'POS';
        this.posSubFilter = ws.replace('TYPE:', '');
      } else if (ws.startsWith('DEPT:')) {
        this.activeLens = 'all_pages_stream';
        this.activeDeptFilter = ws.replace('DEPT:', '');
        this.posSubFilter = 'ALL';
      } else {
        this.activeLens = 'all_pages_stream';
        this.activeDeptFilter = 'ALL';
        this.posSubFilter = 'ALL';
      }

      document.getElementById('v42ForensicPrintStudioModal')?.classList.add('hidden');
      this.refreshActiveViews();
      if (window.showToast) window.showToast('✅ تم تطبيق فرز التوقيت والقسم على الجدول المعروض!', 'success');
    },

    executeForensicPrint(isFullComprehensivePrint = false) {
      const d = this.compileOmniscient360Data();
      const effectiveCfg = isFullComprehensivePrint
        ? { format: this.printConfig.format, whereScope: 'ALL', cashier: 'ALL', datePreset: 'ALL', fromDateTime: '', toDateTime: '' }
        : this.printConfig;

      const list = isFullComprehensivePrint
        ? d.allUnfilteredEvents
        : this.filterEventsForPrintStudio(d.allUnfilteredEvents, effectiveCfg);

      const whereLabel = isFullComprehensivePrint
        ? '🌐 طباعة كلية شاملة لكل الصفحات والأقسام'
        : (WHERE_PRINT_OPTIONS.find((x) => x.id === effectiveCfg.whereScope) || WHERE_PRINT_OPTIONS[0]).label;

      const timeRangeLabel = isFullComprehensivePrint
        ? 'كل الأوقات (السجل الكامل)'
        : effectiveCfg.fromDateTime || effectiveCfg.toDateTime
        ? `من (${(effectiveCfg.fromDateTime || 'البداية').replace('T', ' ')}) إلى (${(effectiveCfg.toDateTime || 'الآن').replace('T', ' ')})`
        : effectiveCfg.datePreset === 'TODAY'
        ? 'اليوم فقط'
        : effectiveCfg.datePreset === 'YESTERDAY'
        ? 'أمس'
        : effectiveCfg.datePreset === 'WEEK'
        ? 'آخر 7 أيام'
        : effectiveCfg.datePreset === 'MONTH'
        ? 'هذا الشهر'
        : 'كل الأوقات';

      const userLabel = effectiveCfg.cashier === 'ALL' ? 'جميع المستخدمين والبائعين' : effectiveCfg.cashier;

      const belowCostItems = list.filter((e) => e.eventType === 'BELOW_COST');
      const belowCostSum = belowCostItems.reduce((s, e) => s + Number(e.impactDzd || 0), 0);
      const deletedItems = list.filter((e) => e.eventType === 'DELETED_LINE');
      const deletedSum = deletedItems.reduce((s, e) => s + Number(e.impactDzd || 0), 0);
      const clearItems = list.filter((e) => e.eventType === 'CART_CLEAR');
      const discountItems = list.filter((e) => e.eventType === 'DISCOUNT');
      const discountSum = discountItems.reduce((s, e) => s + Number(e.impactDzd || 0), 0);

      document.getElementById('v42ForensicPrintStudioModal')?.classList.add('hidden');

      if (effectiveCfg.format === '80mm') {
        const rows80 = list
          .slice(0, 80)
          .map(
            (r) => `
            <tr>
              <td style="padding:4px 2px;border-bottom:1px dashed #cbd5e1;font-size:10px;">
                <div><strong>${r.productName}</strong></div>
                <div style="color:#475569;">${r.time} | ${r.cashier} | ${r.reasonText}</div>
              </td>
              <td style="padding:4px 2px;border-bottom:1px dashed #cbd5e1;text-align:left;font-family:monospace;font-weight:900;font-size:10.5px;">
                ${r.impactDzd > 0 ? r.impactDzd.toFixed(2) : '×' + r.qty}
              </td>
            </tr>`
          )
          .join('');

        const html80 = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>
          @page { size: 80mm auto; margin: 2mm; }
          body { font-family: 'Cairo', Tahoma, sans-serif; width: 74mm; margin: 0 auto; color: #0f172a; font-size: 10.5px; }
          .hdr { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 6px; }
          .meta { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 5px; padding: 5px; margin-bottom: 6px; font-size: 9.5px; font-weight: 800; }
          .box { border: 1.5px solid #0f172a; border-radius: 6px; padding: 5px; margin-bottom: 6px; }
          .stat { display: flex; justify-content: space-between; margin: 2px 0; font-weight: 800; }
          table { width: 100%; border-collapse: collapse; }
        </style></head><body>
          <div class="hdr">
            <h3 style="margin:0;font-size:13px;">🚨 تقرير رادار الرقابة (80mm)</h3>
            <div style="font-size:9.5px;">تاريخ الطباعة: ${new Date().toLocaleString('fr-DZ')}</div>
          </div>
          <div class="meta">
            <div>📍 أين (النطاق): ${whereLabel}</div>
            <div>⏰ التوقيت: ${timeRangeLabel}</div>
            <div>👤 المستخدم: ${userLabel}</div>
            <div>📊 عدد الحركات المطبوعة: ${list.length} حركة</div>
          </div>
          <div class="box">
            <div class="stat"><span>🚨 بيع بأقل من الشراء:</span><span>${belowCostItems.length} (-${this.fmtDzd(belowCostSum)})</span></div>
            <div class="stat"><span>🗑️ محذوف بعد المسح:</span><span>${deletedItems.length} (${this.fmtDzd(deletedSum)})</span></div>
            <div class="stat"><span>🧹 تفريغ السلة:</span><span>${clearItems.length} مرة</span></div>
            <div class="stat"><span>📉 تخفيضات السعر:</span><span>${discountItems.length} (-${this.fmtDzd(discountSum)})</span></div>
          </div>
          <table><tbody>${rows80}</tbody></table>
        </body></html>`;

        window.__gherbiMasterPrintSilent({ html: html80, silent: false });
        if (window.showToast) window.showToast('🖨️ جاري فتح معاينة الطباعة الحرارية (80mm)...', 'info');
      } else {
        // طباعة التقرير الرسمي المفصل (A4)
        const rowsA4 = list
          .slice(0, 250)
          .map((r, idx) => {
            const deptInfo = DEPT_META[r.dept] || DEPT_META.POS;
            return `
              <tr>
                <td style="text-align:center;font-family:monospace;">${idx + 1}</td>
                <td style="font-family:monospace;white-space:nowrap;">${r.time}</td>
                <td><strong>${deptInfo.label}</strong><br><small>👤 ${r.cashier}</small></td>
                <td><strong>${r.productName}</strong><br><small style="color:#475569;">${r.reasonText}</small></td>
                <td style="font-family:monospace;text-align:center;">${r.qty}<br><small>سطوك: ${r.remStock}</small></td>
                <td style="font-family:monospace;">${r.costP > 0 ? r.costP.toFixed(2) + ' د.ج' : '—'}</td>
                <td style="font-family:monospace;">${r.oldP > 0 && r.oldP !== r.newP ? r.oldP.toFixed(2) + ' ⬅ ' : ''}${r.newP > 0 ? r.newP.toFixed(2) + ' د.ج' : '0.00 د.ج'}</td>
                <td style="font-family:monospace;font-weight:900;color:#be123c;">${r.impactDzd > 0 ? this.fmtDzd(r.impactDzd) : '—'}</td>
              </tr>`;
          })
          .join('');

        const htmlA4 = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: 'Cairo', Tahoma, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
          .header-box { border-bottom: 2.5px solid #be123c; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
          .header-box h2 { margin: 0; font-size: 17px; color: #be123c; }
          .filter-bar { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 11px; font-weight: 800; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; text-align: center; }
          .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px; background: #fff1f2; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; vertical-align: top; }
          th { background: #ffe4e6; font-weight: 900; color: #881337; }
        </style></head><body>
          <div class="header-box">
            <div>
              <h2>📄 التقرير الجنائي الرسمي لرقابة الكاشير وحماية الأرباح (A4)</h2>
              <div style="font-size:11px;color:#475569;margin-top:2px;">نظام Gherbi.Ai POS — رادار الصندوق الأسود الشامل 360°</div>
            </div>
            <div style="text-align:left;font-size:10.5px;font-weight:800;">
              <div>تاريخ الطباعة: ${new Date().toLocaleString('fr-DZ')}</div>
              <div>مؤشر أمان المتجر: ${d.storeIntegrityScore}/100</div>
            </div>
          </div>

          <div class="filter-bar">
            <div>📍 أين (نطاق التقرير): <span style="color:#be123c;">${whereLabel}</span></div>
            <div>⏰ الفترة الزمنية (من — إلى): <span style="color:#1d4ed8;">${timeRangeLabel}</span></div>
            <div>👤 المستخدم / البائع: <span>${userLabel}</span></div>
            <div>📊 إجمالي الحركات في التقرير: <span>${list.length} حركة موثقة</span></div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card"><div>🚨 بيع بأقل من الشراء</div><strong style="font-size:13px;color:#be123c;">${belowCostItems.length} حالة (-${this.fmtDzd(belowCostSum)})</strong></div>
            <div class="kpi-card"><div>🗑️ سطور محذوفة بعد المسح</div><strong style="font-size:13px;color:#be123c;">${deletedItems.length} سطر (${this.fmtDzd(deletedSum)})</strong></div>
            <div class="kpi-card"><div>🧹 مرات تفريغ السلة</div><strong style="font-size:13px;color:#b45309;">${clearItems.length} مرة</strong></div>
            <div class="kpi-card"><div>📉 تخفيضات السعر اليدوية</div><strong style="font-size:13px;color:#b45309;">${discountItems.length} عملية (-${this.fmtDzd(discountSum)})</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:28px;text-align:center;">#</th>
                <th>التوقيت</th>
                <th>القسم والمستخدم</th>
                <th>الصنف / البيان والتفاصيل</th>
                <th style="text-align:center;">الكمية والسطوك</th>
                <th>سعر الشراء</th>
                <th>سعر البيع</th>
                <th>الأثر المالي</th>
              </tr>
            </thead>
            <tbody>${rowsA4}</tbody>
          </table>
        </body></html>`;

        window.__gherbiMasterPrintSilent({ html: htmlA4, silent: false });
        if (window.showToast) window.showToast('📄 جاري فتح معاينة التقرير الجنائي الرسمي (A4)...', 'info');
      }
    },

    // ========================================================================
    // 5. بناء الواجهة الشاملة (مع زر 📄 طباعة A4 بجانب 🖨️ طباعة 80mm وفلاتر من-إلى)
    // ========================================================================
    buildOmniscient360Html(isModalView = false) {
      const d = this.compileOmniscient360Data();
      const q = this.searchQuery.trim().toLowerCase();

      const cashierOptionsHtml = [
        `<option value="ALL" ${this.cashierFilter === 'ALL' ? 'selected' : ''}>👤 كل المستخدمين (${d.allCashiers.length})</option>`,
        ...d.allCashiers.map((c) => `<option value="${c}" ${this.cashierFilter === c ? 'selected' : ''}>👤 ${c}</option>`)
      ].join('');

      let activeTableSectionHtml = '';

      if (this.activeLens === 'below_cost_radar') {
        const bcList = d.belowCostEvents.filter(
          (r) => !q || `${r.productName} ${r.cashier} ${r.docNumber} ${r.reasonText}`.toLowerCase().includes(q)
        );
        const bcRows =
          bcList.length > 0
            ? bcList
                .map((r) => {
                  const unitDiff = Number((r.newP - r.costP).toFixed(2));
                  return `
                    <tr class="border-b border-rose-100 dark:border-slate-800 hover:bg-rose-50/50 dark:hover:bg-slate-800/60 text-xs">
                      <td class="py-3 px-3 font-mono font-bold">${r.time}</td>
                      <td class="py-3 px-3 font-black">👤 ${r.cashier}<div class="text-[10px] text-slate-400">${r.customer}</div></td>
                      <td class="py-3 px-3 font-mono font-black text-indigo-600">${r.docNumber}</td>
                      <td class="py-3 px-3">
                        <div class="font-black text-rose-700 dark:text-rose-400">${r.productName}</div>
                        <div class="text-[11px] font-bold text-slate-500">${r.reasonText}</div>
                      </td>
                      <td class="py-3 px-3 font-mono font-black">${r.qty} وحدة<div class="text-[10px] text-slate-400">بقي بالسطوك: ${r.remStock}</div></td>
                      <td class="py-3 px-3 font-mono font-black text-slate-800 dark:text-slate-200">${this.fmtDzd(r.costP)}</td>
                      <td class="py-3 px-3 font-mono font-black text-rose-600">${this.fmtDzd(r.newP)}</td>
                      <td class="py-3 px-3 font-mono font-black text-rose-600">${unitDiff.toFixed(2)} د.ج</td>
                      <td class="py-3 px-3 font-mono font-black text-rose-700 bg-rose-50/70 dark:bg-rose-950/30">-${this.fmtDzd(r.impactDzd)}</td>
                    </tr>
                  `;
                })
                .join('')
            : `<tr><td colspan="9" class="py-10 text-center text-emerald-600 font-black text-sm">✔ لا توجد أي مبيعات مسجلة بأقل من سعر الشراء أو بسعر التكلفة في هذه الفترة.</td></tr>`;

        activeTableSectionHtml = `
          <div class="space-y-2.5">
            <div class="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-200">
              <span>🚨 يعرض هذا الجدول كل سلعة بيعت بسعر يساوي أو يقل عن سعر شرائها (سواء تم تعديل سعرها في السلة أو بيعت مباشرة في الفاتورة).</span>
              <span class="font-mono font-black text-rose-600">إجمالي الخسارة المرصودة: -${this.fmtDzd(d.belowCostLossDzd)}</span>
            </div>
            <div class="overflow-x-auto rounded-2xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-sm max-h-[450px]">
              <table data-v40-clean-table="1" class="w-full text-right border-collapse">
                <thead class="sticky top-0 z-10 bg-rose-100/80 dark:bg-slate-800 text-rose-950 dark:text-rose-200 text-xs font-black border-b border-rose-200">
                  <tr>
                    <th class="py-3 px-3">التوقيت</th>
                    <th class="py-3 px-3">البائع / الزبون</th>
                    <th class="py-3 px-3">رقم الفاتورة</th>
                    <th class="py-3 px-3">الصنف وتشخيص الخسارة</th>
                    <th class="py-3 px-3">الكمية والسطوك</th>
                    <th class="py-3 px-3">سعر الشراء (الكلفة)</th>
                    <th class="py-3 px-3">السعر المباع به</th>
                    <th class="py-3 px-3">فارق الوحدة</th>
                    <th class="py-3 px-3">إجمالي الخسارة</th>
                  </tr>
                </thead>
                <tbody>${bcRows}</tbody>
              </table>
            </div>
          </div>
        `;
      } else if (this.activeLens === 'hot_products') {
        const hotRows =
          d.hotProducts.length > 0
            ? d.hotProducts
                .map(
                  (p, idx) => `
                  <tr class="border-b border-slate-100 dark:border-slate-800 text-xs hover:bg-amber-50/30">
                    <td class="py-3 px-3 font-mono font-bold text-slate-400">#${idx + 1}</td>
                    <td class="py-3 px-3 font-black text-slate-900 dark:text-white">${p.name}<div class="text-[10px] text-slate-400">آخر تعامل: ${p.lastCashier} (${p.lastTime})</div></td>
                    <td class="py-3 px-3 font-mono font-black text-rose-600">🚨 ${p.belowCostTimes} مرة</td>
                    <td class="py-3 px-3 font-mono font-black text-rose-600">🗑️ ${p.deletedTimes} مرة (${this.fmtDzd(p.deletedVal)})</td>
                    <td class="py-3 px-3 font-mono font-black text-amber-600">📉 ${p.discountTimes} مرة (-${this.fmtDzd(p.discountVal)})</td>
                    <td class="py-3 px-3 font-mono font-bold">الشراء: ${this.fmtDzd(p.costPrice)} | البيع: ${this.fmtDzd(p.sellingPrice)}</td>
                    <td class="py-3 px-3 font-mono font-black text-emerald-600">بقي بالسطوك: ${p.stock}</td>
                  </tr>`
                )
                .join('')
            : `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-bold">لا توجد سلع مستهدفة.</td></tr>`;

        activeTableSectionHtml = `
          <div class="overflow-x-auto rounded-2xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 shadow-sm max-h-[450px]">
            <table data-v40-clean-table="1" class="w-full text-right border-collapse">
              <thead class="sticky top-0 z-10 bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 text-xs font-black border-b border-amber-200">
                <tr>
                  <th class="py-3 px-3">#</th>
                  <th class="py-3 px-3">الصنف المستهدف</th>
                  <th class="py-3 px-3">🚨 مرات البيع بخسارة</th>
                  <th class="py-3 px-3">🗑️ مرات الحذف بعد المسح</th>
                  <th class="py-3 px-3">📉 مرات تخفيض السعر</th>
                  <th class="py-3 px-3">سعر الشراء والبيع</th>
                  <th class="py-3 px-3">الرصيد الفعلي بالسطوك</th>
                </tr>
              </thead>
              <tbody>${hotRows}</tbody>
            </table>
          </div>
        `;
      } else if (this.activeLens === 'cashier_scorecard') {
        const cRows =
          d.cashierScorecards.length > 0
            ? d.cashierScorecards
                .map(
                  (c) => `
                  <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
                    <td class="py-3 px-3 font-black text-slate-900 dark:text-white">👤 ${c.name}</td>
                    <td class="py-3 px-3 font-mono font-black text-rose-600">${c.belowCost} حالة (-${this.fmtDzd(c.belowCostVal)})</td>
                    <td class="py-3 px-3 font-mono font-black text-rose-600">${c.deletedLines} سطر (${this.fmtDzd(c.deletedVal)})</td>
                    <td class="py-3 px-3 font-mono font-black text-amber-600">${c.cartClears} مرة</td>
                    <td class="py-3 px-3 font-mono font-black text-orange-600">${c.discounts} عملية (-${this.fmtDzd(c.discountVal)})</td>
                    <td class="py-3 px-3 font-mono font-bold text-indigo-600">${c.otherPageActions} عملية</td>
                    <td class="py-3 px-3 font-mono font-black text-emerald-600">${c.trustScore}%</td>
                    <td class="py-3 px-3 text-center">
                      <button type="button" onclick="window.GherbiForensicCenterV40.filterByUserAndOpenStream('${c.name.replace(/'/g, "\\'")}')" class="px-3 py-1 rounded-xl bg-slate-900 text-white font-black text-[11px]">
                        🔎 عرض كل حركاته (${c.totalEvents})
                      </button>
                    </td>
                  </tr>`
                )
                .join('')
            : '';

        activeTableSectionHtml = `
          <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <table data-v40-clean-table="1" class="w-full text-right border-collapse">
              <thead class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black border-b border-slate-200">
                <tr>
                  <th class="py-3 px-3">المستخدم / البائع</th>
                  <th class="py-3 px-3">🚨 بيع بأقل من الشراء</th>
                  <th class="py-3 px-3">🗑️ حذف بعد المسح</th>
                  <th class="py-3 px-3">🧹 تفريغ السلة</th>
                  <th class="py-3 px-3">📉 تخفيضات سعرية</th>
                  <th class="py-3 px-3">🌐 عمليات الأقسام الأخرى</th>
                  <th class="py-3 px-3">مؤشر الانضباط</th>
                  <th class="py-3 px-3 text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody>${cRows}</tbody>
            </table>
          </div>
        `;
      } else {
        const streamFiltered = d.events.filter((ev) => {
          if (this.activeDeptFilter !== 'ALL' && ev.dept !== this.activeDeptFilter) return false;
          if (this.posSubFilter !== 'ALL' && ev.eventType !== this.posSubFilter) return false;
          if (!q) return true;
          return `${ev.productName} ${ev.cashier} ${ev.reasonText} ${ev.docNumber} ${ev.time}`.toLowerCase().includes(q);
        });

        const streamRowsHtml =
          streamFiltered.length > 0
            ? streamFiltered
                .map((r) => {
                  const deptInfo = DEPT_META[r.dept] || DEPT_META.POS;
                  const nightTag = r.isLateNight
                    ? '<span class="inline-block px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 font-black text-[10px] mt-0.5">🌙 ليلي</span>'
                    : '';

                  const unitPriceHtml =
                    r.eventType === 'DELETED_LINE' && r.oldP > 0
                      ? `<span class="line-through text-slate-400 text-[11px]">${r.oldP.toFixed(2)}</span> ⬅ <strong class="text-rose-600">0.00 د.ج</strong>`
                      : r.oldP !== r.newP && r.oldP > 0 && r.newP > 0
                      ? `<span class="line-through text-slate-400 text-[11px]">${r.oldP.toFixed(2)}</span> ⬅ <strong class="${r.eventType === 'BELOW_COST' ? 'text-rose-600' : 'text-slate-900 dark:text-white'}">${r.newP.toFixed(2)} د.ج</strong>`
                      : r.newP > 0
                      ? `<strong>${r.newP.toFixed(2)} د.ج</strong>`
                      : '<span class="text-slate-400">—</span>';

                  return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-rose-50/30 dark:hover:bg-slate-800/50 transition text-xs">
                      <td class="py-2.5 px-3 font-mono font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div>${r.time}</div>
                        ${nightTag}
                      </td>
                      <td class="py-2.5 px-3 whitespace-nowrap">
                        <span class="px-2.5 py-0.5 rounded-full font-black text-[10px] ${deptInfo.badgeCls}">${deptInfo.label}</span>
                        <div class="font-black text-slate-900 dark:text-white mt-1">👤 ${r.cashier}</div>
                      </td>
                      <td class="py-2.5 px-3">
                        <div class="font-black text-slate-900 dark:text-white">${r.productName}</div>
                        <div class="text-[11px] font-bold ${r.eventType === 'BELOW_COST' ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'} mt-0.5">${r.reasonText}</div>
                      </td>
                      <td class="py-2.5 px-3 font-mono whitespace-nowrap">
                        <div class="font-black text-emerald-600">${r.qty} ${r.eventType === 'CART_CLEAR' ? 'أصناف' : 'وحدة'}</div>
                        ${r.remStock !== '-' ? `<div class="text-[10px] text-slate-500">بقي بالسطوك: ${r.remStock}</div>` : ''}
                      </td>
                      <td class="py-2.5 px-3 font-mono font-bold whitespace-nowrap">${r.costP > 0 ? r.costP.toFixed(2) + ' د.ج' : '—'}</td>
                      <td class="py-2.5 px-3 font-mono whitespace-nowrap">${unitPriceHtml}</td>
                      <td class="py-2.5 px-3 font-mono font-black whitespace-nowrap ${r.eventType === 'BELOW_COST' || r.eventType === 'DELETED_LINE' ? 'text-rose-600' : 'text-blue-600'}">
                        ${r.impactDzd > 0 ? this.fmtDzd(r.impactDzd) : '—'}
                      </td>
                      <td class="py-2.5 px-3 text-center whitespace-nowrap">${r.badgeHtml}</td>
                    </tr>
                  `;
                })
                .join('')
            : `<tr><td colspan="8" class="py-10 text-center text-slate-400 font-bold text-sm">لا توجد حركات مطابقة للفلتر المختار حالياً.</td></tr>`;

        activeTableSectionHtml = `
          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiForensicCenterV40.setPosSubFilter('ALL')" class="px-3 py-1 rounded-full font-black text-[11px] transition ${this.posSubFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">كل الحركات (${d.events.length})</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPosSubFilter('BELOW_COST')" class="px-3 py-1 rounded-full font-black text-[11px] transition ${this.posSubFilter === 'BELOW_COST' ? 'bg-rose-600 text-white shadow' : 'bg-rose-50 text-rose-700 border border-rose-200'}">🚨 بيع بأقل من الشراء / بالتكلفة (${d.belowCostCount})</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPosSubFilter('DELETED_LINE')" class="px-3 py-1 rounded-full font-black text-[11px] transition ${this.posSubFilter === 'DELETED_LINE' ? 'bg-rose-700 text-white shadow' : 'bg-rose-50 text-rose-700 border border-rose-200'}">🗑️ محذوف بعد المسح (${d.deletedLinesCount})</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPosSubFilter('CART_CLEAR')" class="px-3 py-1 rounded-full font-black text-[11px] transition ${this.posSubFilter === 'CART_CLEAR' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-amber-50 text-amber-800 border border-amber-200'}">🧹 تفريغ السلة (${d.cartClearedCount})</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPosSubFilter('DISCOUNT')" class="px-3 py-1 rounded-full font-black text-[11px] transition ${this.posSubFilter === 'DISCOUNT' ? 'bg-orange-600 text-white shadow' : 'bg-orange-50 text-orange-800 border border-orange-200'}">📉 تخفيض سعر (${d.discountCount})</button>
                <button type="button" onclick="window.GherbiForensicCenterV40.setPosSubFilter('PARTIAL_QTY')" class="px-3 py-1 rounded-full font-black text-[11px] transition ${this.posSubFilter === 'PARTIAL_QTY' ? 'bg-emerald-600 text-white shadow' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}">⚖️ كمية بالمبلغ (${d.partialQtyCount})</button>
              </div>
              <span class="text-[11px] font-bold text-slate-500">النتائج المعروضة: ${streamFiltered.length} سجل</span>
            </div>

            <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm max-h-[450px]">
              <table data-v40-clean-table="1" class="w-full text-right border-collapse">
                <thead class="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black">
                  <tr>
                    <th class="py-3 px-3">التوقيت</th>
                    <th class="py-3 px-3">أين (القسم) والمستخدم</th>
                    <th class="py-3 px-3">البيان والتفاصيل الدقيقة للحركة</th>
                    <th class="py-3 px-3">الكمية والسطوك</th>
                    <th class="py-3 px-3">سعر الشراء</th>
                    <th class="py-3 px-3">سعر البيع / الوحدة</th>
                    <th class="py-3 px-3">الأثر المالي / القيمة</th>
                    <th class="py-3 px-3 text-center">التصنيف</th>
                  </tr>
                </thead>
                <tbody>${streamRowsHtml}</tbody>
              </table>
            </div>
          </div>
        `;
      }

      return `
        <div class="space-y-4 text-right" dir="rtl">
          <div class="rounded-3xl bg-white dark:bg-slate-800 border-2 border-rose-200 dark:border-rose-900/60 p-5 shadow-md space-y-4">
            <!-- الترويسة والأزرار التنفيذية (مع زر 📄 طباعة A4 بجانب 🖨️ طباعة 80mm مباشرةً) -->
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3.5">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-rose-600 text-white flex flex-col items-center justify-center font-black shadow-md">
                  <span class="text-[9px] opacity-85">الأمان</span>
                  <span class="text-sm font-mono">${d.storeIntegrityScore}%</span>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px] border border-emerald-300">
                      🟢 رادار الصندوق الأسود الشامل 360° نشط
                    </span>
                    <h2 class="text-base md:text-lg font-black text-slate-900 dark:text-white">
                      مركز الرقابة الجنائية الشامل لكل صفحات البرنامج: كشف البيع بأقل من الشراء، الحذف، المخزون، والصندوق
                    </h2>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    يراقب لحظياً وبأثر رجعي جميع الفواتير والصفحات الـ 18 — أي بيعة بأقل من سعر الشراء أو حذف سطر أو حركة صندوق تظهر هنا فوراً
                  </p>
                </div>
              </div>

              <!-- الأزرار التنفيذية العلوية: (طباعة 80mm + طباعة A4 بجانبها + Excel + PIN + فحص) -->
              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="window.GherbiForensicCenterV40.fetchBackendLogsAndRefresh()" class="px-3.5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow cursor-pointer">
                  🔄 فحص وتحديث الآن
                </button>
                ${
                  isModalView
                    ? `<button type="button" onclick="window.GherbiForensicCenterV40.jumpFromModalToTab14()" class="px-3.5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition shadow cursor-pointer">
                        🚨 فتح في الصفحة 14 الكاملة ⬅
                      </button>`
                    : ''
                }
                <button type="button" onclick="window.GherbiForensicCenterV40.openManagerPinModal()" class="px-3.5 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-sm cursor-pointer">
                  🔑 كود المدير (PIN)
                </button>
                <button type="button" onclick="window.GherbiForensicCenterV40.openForensicPrintModal('80mm')" class="px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition shadow-sm cursor-pointer">
                  🖨️ طباعة (80mm)
                </button>
                <button type="button" onclick="window.GherbiForensicCenterV40.openForensicPrintModal('a4')" class="px-3.5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition shadow-sm cursor-pointer">
                  📄 طباعة (A4)
                </button>
                <button type="button" onclick="window.GherbiForensicCenterV40.exportFullExcelCsv()" class="px-3.5 py-2 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 font-black text-xs transition cursor-pointer">
                  📊 تصدير Excel
                </button>
              </div>
            </div>

            <!-- البطاقات الـ 6 الباستيل التفاعلية -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
              <div onclick="window.GherbiForensicCenterV40.setLens('below_cost_radar')" class="cursor-pointer rounded-2xl p-3.5 bg-rose-50 dark:bg-rose-950/40 border-2 ${this.activeLens === 'below_cost_radar' ? 'border-rose-600 shadow-md' : 'border-rose-200 dark:border-rose-800'} hover:border-rose-500 transition">
                <div class="text-[11px] font-black text-rose-800 dark:text-rose-300">🚨 بيع بأقل من سعر الشراء</div>
                <div class="text-2xl font-black text-rose-600 font-mono mt-1">${d.belowCostCount} حالة</div>
                <div class="text-[11px] font-bold text-rose-700 font-mono mt-0.5">خسارة: -${this.fmtDzd(d.belowCostLossDzd)}</div>
                <div class="text-[10px] text-rose-600/80 mt-0.5">فحص حي للسلة والفواتير</div>
              </div>

              <div onclick="window.GherbiForensicCenterV40.selectDeptAndSub('POS', 'DELETED_LINE')" class="cursor-pointer rounded-2xl p-3.5 bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800 hover:border-rose-500 transition">
                <div class="text-[11px] font-black text-rose-800 dark:text-rose-300">🗑️ سطور محذوفة بعد المسح</div>
                <div class="text-2xl font-black text-rose-600 font-mono mt-1">${d.deletedLinesCount} سطر</div>
                <div class="text-[11px] font-bold text-rose-700 font-mono mt-0.5">بقيمة: ${this.fmtDzd(d.deletedLinesValDzd)}</div>
                <div class="text-[10px] text-rose-600/80 mt-0.5">🧹 تفريغ السلة: ${d.cartClearedCount} مرة</div>
              </div>

              <div onclick="window.GherbiForensicCenterV40.selectDeptAndSub('POS', 'DISCOUNT')" class="cursor-pointer rounded-2xl p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 hover:border-amber-500 transition">
                <div class="text-[11px] font-black text-amber-900 dark:text-amber-300">📉 تخفيضات السعر والكميات</div>
                <div class="text-2xl font-black text-amber-600 font-mono mt-1">-${this.fmtDzd(d.discountLossDzd)}</div>
                <div class="text-[11px] font-bold text-amber-800 mt-0.5">في (${d.discountCount}) عملية تخفيض</div>
                <div class="text-[10px] text-emerald-700 font-bold mt-0.5">⚖️ بيع بالمبلغ: ${d.partialQtyCount} عملية</div>
              </div>

              <div onclick="window.GherbiForensicCenterV40.selectDeptAndSub('INVENTORY', 'ALL')" class="cursor-pointer rounded-2xl p-3.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 transition">
                <div class="text-[11px] font-black text-indigo-900 dark:text-indigo-300">📦 المخزون والمشتريات</div>
                <div class="text-2xl font-black text-indigo-600 font-mono mt-1">${(d.deptCounts.INVENTORY || 0) + (d.deptCounts.PURCHASES || 0)} حركة</div>
                <div class="text-[11px] font-bold text-indigo-700 mt-0.5">تعديل منتجات ودفعات وشراء</div>
                <div class="text-[10px] text-rose-600 font-bold mt-0.5">⚠️ مسعر بخطر: ${d.riskyInventoryProducts.length} صنف</div>
              </div>

              <div onclick="window.GherbiForensicCenterV40.selectDeptAndSub('CAISSE', 'ALL')" class="cursor-pointer rounded-2xl p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-500 transition">
                <div class="text-[11px] font-black text-emerald-900 dark:text-emerald-300">🏦 الصندوق والمصاريف</div>
                <div class="text-2xl font-black text-emerald-600 font-mono mt-1">${d.deptCounts.CAISSE || 0} حركة</div>
                <div class="text-[11px] font-bold text-emerald-700 mt-0.5">مناوبات، سحوبات، ومصاريف</div>
                <div class="text-[10px] text-emerald-600/80 mt-0.5">مراقبة السيولة النقدية</div>
              </div>

              <div onclick="window.GherbiForensicCenterV40.selectDeptAndSub('PARTIES', 'ALL')" class="cursor-pointer rounded-2xl p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 hover:border-purple-500 transition">
                <div class="text-[11px] font-black text-purple-900 dark:text-purple-300">👥 الديون والوفاء والأمان</div>
                <div class="text-2xl font-black text-purple-600 font-mono mt-1">${(d.deptCounts.PARTIES || 0) + (d.deptCounts.SECURITY || 0)} حركة</div>
                <div class="text-[11px] font-bold text-purple-700 mt-0.5">دفعات ديون ونقاط وفاء</div>
                <div class="text-[10px] text-purple-600/80 mt-0.5">مراقبة حسابات الزبائن</div>
              </div>
            </div>

            <!-- شريط أقسام البرنامج (أين) + فلتر التوقيت (من — إلى) + المستخدم + البحث -->
            <div class="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-1.5">
                  <button type="button" onclick="window.GherbiForensicCenterV40.selectDeptAndSub('ALL', 'ALL')" class="px-3.5 py-2 rounded-xl font-black text-xs transition ${this.activeLens === 'all_pages_stream' && this.activeDeptFilter === 'ALL' ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                    🌐 1. السجل الشامل لكل الصفحات (${d.events.length})
                  </button>
                  <button type="button" onclick="window.GherbiForensicCenterV40.setLens('below_cost_radar')" class="px-3.5 py-2 rounded-xl font-black text-xs transition ${this.activeLens === 'below_cost_radar' ? 'bg-rose-600 text-white shadow' : 'bg-rose-50 dark:bg-slate-700 text-rose-700 dark:text-rose-300'}">
                    🚨 2. البيع بأقل من الشراء (${d.belowCostCount})
                  </button>
                  <button type="button" onclick="window.GherbiForensicCenterV40.selectDeptAndSub('POS', 'ALL')" class="px-3.5 py-2 rounded-xl font-black text-xs transition ${this.activeLens === 'all_pages_stream' && this.activeDeptFilter === 'POS' ? 'bg-rose-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                    🛒 3. الكاشير والمبيعات (${d.deptCounts.POS || 0})
                  </button>
                  <button type="button" onclick="window.GherbiForensicCenterV40.selectDeptAndSub('INVENTORY', 'ALL')" class="px-3.5 py-2 rounded-xl font-black text-xs transition ${this.activeLens === 'all_pages_stream' && this.activeDeptFilter === 'INVENTORY' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                    📦 4. المخزون والمنتجات (${d.deptCounts.INVENTORY || 0})
                  </button>
                  <button type="button" onclick="window.GherbiForensicCenterV40.selectDeptAndSub('CAISSE', 'ALL')" class="px-3.5 py-2 rounded-xl font-black text-xs transition ${this.activeLens === 'all_pages_stream' && this.activeDeptFilter === 'CAISSE' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                    🏦 5. الصندوق والمصاريف (${d.deptCounts.CAISSE || 0})
                  </button>
                  <button type="button" onclick="window.GherbiForensicCenterV40.setLens('hot_products')" class="px-3.5 py-2 rounded-xl font-black text-xs transition ${this.activeLens === 'hot_products' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                    🔥 6. السلع المستهدفة (${d.hotProducts.length})
                  </button>
                  <button type="button" onclick="window.GherbiForensicCenterV40.setLens('cashier_scorecard')" class="px-3.5 py-2 rounded-xl font-black text-xs transition ${this.activeLens === 'cashier_scorecard' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}">
                    🕵️‍♂️ 7. تقييم المستخدمين (${d.cashierScorecards.length})
                  </button>
                </div>
              </div>

              <!-- شريط الفرز الزمني المباشر (من تاريخ وساعة -> إلى تاريخ وساعة) + المستخدم + البحث -->
              <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/70 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                <div class="flex flex-wrap items-center gap-2">
                  <select onchange="window.GherbiForensicCenterV40.setDateRange(this.value)" class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-black text-xs">
                    <option value="ALL" ${this.dateRangeFilter === 'ALL' ? 'selected' : ''}>📅 الفترة: كل الأوقات</option>
                    <option value="TODAY" ${this.dateRangeFilter === 'TODAY' ? 'selected' : ''}>📅 اليوم فقط</option>
                    <option value="YESTERDAY" ${this.dateRangeFilter === 'YESTERDAY' ? 'selected' : ''}>📅 أمس</option>
                    <option value="WEEK" ${this.dateRangeFilter === 'WEEK' ? 'selected' : ''}>📅 آخر 7 أيام</option>
                    <option value="MONTH" ${this.dateRangeFilter === 'MONTH' ? 'selected' : ''}>📅 هذا الشهر</option>
                    <option value="CUSTOM" ${this.dateRangeFilter === 'CUSTOM' ? 'selected' : ''}>🕒 فترة مخصصة (من — إلى)</option>
                  </select>

                  <div class="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-600">
                    <span class="font-black text-slate-500 text-[11px]">من:</span>
                    <input type="datetime-local" value="${this.customFromDateTime}" onchange="window.GherbiForensicCenterV40.setCustomFromDateTime(this.value)" class="bg-transparent font-mono font-bold text-[11px] outline-none">
                  </div>

                  <div class="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-600">
                    <span class="font-black text-slate-500 text-[11px]">إلى:</span>
                    <input type="datetime-local" value="${this.customToDateTime}" onchange="window.GherbiForensicCenterV40.setCustomToDateTime(this.value)" class="bg-transparent font-mono font-bold text-[11px] outline-none">
                  </div>

                  <select onchange="window.GherbiForensicCenterV40.setCashierFilter(this.value)" class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-black text-xs">
                    ${cashierOptionsHtml}
                  </select>
                </div>

                <div class="flex items-center gap-1.5 flex-1 min-w-[220px] max-w-sm">
                  <input type="text" value="${this.searchQuery}" oninput="window.GherbiForensicCenterV40.onSearchInput(this.value)" placeholder="🔎 ابحث باسم السلعة أو المستخدم أو الفاتورة..." class="w-full px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold outline-none focus:border-rose-500">
                </div>
              </div>
            </div>

            <!-- منطقة عرض الجدول المنظم -->
            <div class="pt-1">${activeTableSectionHtml}</div>
          </div>
        </div>
      `;
    },

    // ========================================================================
    // 6. إدارة التبويب 14 ونافذة الدرع العلوي (#auditLogModal)
    // ========================================================================
    findAnchorTabButton() {
      const tab13 = document.getElementById('v30RccTab13FiscalBtn');
      if (tab13) return tab13;
      const allBtns = Array.from(document.querySelectorAll('button'));
      return allBtns.find((b) => {
        const t = (b.textContent || '').trim();
        return (t.includes('12.') && t.includes('الزكاة')) || t.includes('حاسبة وأرشيف الزكاة');
      });
    },

    startTab14ButtonAndCleanupLoop() {
      this.fetchBackendLogsAndRefresh();
      setInterval(() => {
        const anchorBtn = this.findAnchorTabButton();
        if (!anchorBtn) return;
        this.ensureTab14ButtonExists(anchorBtn);
      }, 400);
    },

    ensureTab14ButtonExists(passedAnchor) {
      const anchorBtn = passedAnchor || this.findAnchorTabButton();
      if (!anchorBtn || !anchorBtn.parentElement) return null;

      const tabBar = anchorBtn.parentElement;
      const stats = this.compileOmniscient360Data();

      let tab14Btn = document.getElementById('v40RccTab14Btn');
      if (!tab14Btn) {
        tab14Btn = document.createElement('button');
        tab14Btn.id = 'v40RccTab14Btn';
        tab14Btn.type = 'button';
        tab14Btn.className =
          'v40-tab14-inactive px-4 py-2 rounded-full font-black text-xs transition flex items-center gap-2 cursor-pointer';
        tab14Btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openTab14();
        });
        anchorBtn.insertAdjacentElement('afterend', tab14Btn);
      }

      if (this.lastBadgeTotal !== stats.events.length) {
        this.lastBadgeTotal = stats.events.length;
        tab14Btn.innerHTML = `
          <span>14. 🚨 رادار الرقابة الجنائية وحماية الأرباح</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-sm">
            ${stats.events.length} رصد
          </span>
        `;
      }

      const siblingBtns = Array.from(tabBar.querySelectorAll('button')).filter(
        (b) => b.id !== 'v40RccTab14Btn'
      );
      for (const sb of siblingBtns) {
        if (sb.dataset.v42SiblingHooked === '1') continue;
        sb.dataset.v42SiblingHooked = '1';
        sb.addEventListener('click', () => {
          if (this.isTab14Active) {
            this.isTab14Active = false;
            this.deactivateTab14();
          }
        });
      }

      return tab14Btn;
    },

    findTabBarWrapper(anchorBtn) {
      if (!anchorBtn) return null;
      let curr = anchorBtn.parentElement;
      while (curr && curr.parentElement) {
        if (curr.querySelectorAll('button').length >= 10) return curr;
        curr = curr.parentElement;
      }
      return anchorBtn.parentElement;
    },

    deactivateTab14() {
      const tab14Btn = document.getElementById('v40RccTab14Btn');
      if (tab14Btn) {
        tab14Btn.classList.remove('v40-tab14-active');
        tab14Btn.classList.add('v40-tab14-inactive');
      }
      const pane = document.getElementById('v40Tab14MasterContainer');
      if (pane) pane.classList.add('hidden');

      if (!window.GherbiRetailFiscalStudio || !window.GherbiRetailFiscalStudio.isTab13Active) {
        const hiddenEls = document.querySelectorAll('[data-v40-hidden-by-tab14="1"]');
        for (const el of hiddenEls) {
          el.classList.remove('hidden');
          delete el.dataset.v40HiddenByTab14;
        }
      }
    },

    async openTab14() {
      try {
        this.isTab14Active = true;
        if (window.GherbiRetailFiscalStudio) {
          window.GherbiRetailFiscalStudio.isTab13Active = false;
          document.getElementById('v30RetailFiscalStudioContainer')?.classList.add('hidden');
        }

        if (window.App && typeof window.App.switchView === 'function') {
          const hasAnalytics = document.getElementById('view-analytics');
          const currentView = document.getElementById(hasAnalytics ? 'view-analytics' : 'view-reports');
          if (currentView && currentView.classList.contains('hidden')) {
            await window.App.switchView(hasAnalytics ? 'analytics' : 'reports');
          }
        }

        await this.fetchBackendLogsAndRefresh();
        this.activateAndRenderTab14();
      } catch (err) {
        console.error('openTab14 error:', err);
      }
    },

    activateAndRenderTab14() {
      const anchorBtn = this.findAnchorTabButton();
      const tab14Btn = this.ensureTab14ButtonExists(anchorBtn);
      if (!tab14Btn || !anchorBtn) return;

      const tabBarWrapper = this.findTabBarWrapper(anchorBtn);
      if (tabBarWrapper) {
        const inactiveCls =
          (window.GherbiRetailFiscalStudio && window.GherbiRetailFiscalStudio.inactiveBtnClass) ||
          'px-4 py-2 rounded-full font-black text-xs transition flex items-center gap-1.5 bg-white text-slate-800 border border-slate-200 shadow-sm';
        for (const b of Array.from(tabBarWrapper.querySelectorAll('button'))) {
          if (b.id === 'v40RccTab14Btn') {
            b.classList.remove('v40-tab14-inactive');
            b.classList.add('v40-tab14-active');
          } else {
            b.className = inactiveCls;
          }
        }
      }

      const parentContainer = tabBarWrapper ? tabBarWrapper.parentElement : anchorBtn.parentElement.parentElement;
      if (!parentContainer) return;

      let pane = document.getElementById('v40Tab14MasterContainer');
      if (!pane) {
        pane = document.createElement('div');
        pane.id = 'v40Tab14MasterContainer';
        pane.className = 'mt-4';
        if (tabBarWrapper && tabBarWrapper.nextSibling) {
          parentContainer.insertBefore(pane, tabBarWrapper.nextSibling);
        } else {
          parentContainer.appendChild(pane);
        }
      }

      let sibling = tabBarWrapper ? tabBarWrapper.nextElementSibling : null;
      while (sibling) {
        if (sibling.id !== 'v40Tab14MasterContainer' && !sibling.classList.contains('hidden')) {
          sibling.classList.add('hidden');
          sibling.dataset.v40HiddenByTab14 = '1';
        }
        sibling = sibling.nextElementSibling;
      }

      pane.classList.remove('hidden');
      pane.innerHTML = this.buildOmniscient360Html(false);
    },

    hookGlobalNavigationAndTopShield() {
      const self = this;
      window.openGherbiForensicRadarTab14 = () => this.openTab14();
      window.GherbiForensicRadarHub = { openTab14: () => this.openTab14() };
      window.GherbiDirectAuditStudio = this;
      window.GherbiForensicCenterV40 = this;

      if (window.App && typeof window.App.switchAnalyticsTab === 'function' && !window.App._v42AnalyticsTabHooked) {
        const origSwitch = window.App.switchAnalyticsTab.bind(window.App);
        window.App._v42AnalyticsTabHooked = true;
        window.App.switchAnalyticsTab = async (...args) => {
          const arg = String(args[0] || '');
          if (arg === '14' || arg === 'forensic') {
            await self.openTab14();
            return;
          }
          self.isTab14Active = false;
          self.deactivateTab14();
          return await origSwitch(...args);
        };
      }

      const origOpenAudit =
        typeof window.App.openAuditLogsModal === 'function'
          ? window.App.openAuditLogsModal.bind(window.App)
          : null;

      window.App.openAuditLogsModal = async function (...args) {
        try {
          if (origOpenAudit) await origOpenAudit(...args);
        } catch (_) {}
        await self.openAndRenderTopShieldModal();
      };
    },

    async openAndRenderTopShieldModal() {
      const modal = document.getElementById('auditLogModal');
      const bodyEl = document.getElementById('auditLogModalBody');
      if (!modal || !bodyEl) return;

      await this.fetchBackendLogsAndRefresh();
      modal.classList.add('active');
      modal.classList.remove('hidden');
      this.renderTopShieldModalBody();
    },

    renderTopShieldModalBody() {
      const bodyEl = document.getElementById('auditLogModalBody');
      if (!bodyEl) return;
      this.isRenderingModal = true;
      try {
        bodyEl.innerHTML = this.buildOmniscient360Html(true);
      } finally {
        setTimeout(() => {
          this.isRenderingModal = false;
        }, 25);
      }
    },

    refreshActiveViews() {
      const tab14Pane = document.getElementById('v40Tab14MasterContainer');
      if (tab14Pane && !tab14Pane.classList.contains('hidden')) {
        tab14Pane.innerHTML = this.buildOmniscient360Html(false);
      }
      const modal = document.getElementById('auditLogModal');
      if (modal && modal.classList.contains('active')) {
        this.renderTopShieldModalBody();
      }
    },

    setLens(lensName) {
      this.activeLens = lensName || 'all_pages_stream';
      this.refreshActiveViews();
    },

    selectDeptAndSub(dept, subFilter) {
      this.activeLens = 'all_pages_stream';
      this.activeDeptFilter = dept || 'ALL';
      this.posSubFilter = subFilter || 'ALL';
      this.refreshActiveViews();
    },

    setPosSubFilter(sub) {
      this.activeLens = 'all_pages_stream';
      this.posSubFilter = sub || 'ALL';
      this.refreshActiveViews();
    },

    setDateRange(val) {
      this.dateRangeFilter = val || 'ALL';
      if (val === 'ALL') {
        this.customFromDateTime = '';
        this.customToDateTime = '';
      }
      this.refreshActiveViews();
    },

    setCustomFromDateTime(val) {
      this.customFromDateTime = val || '';
      this.dateRangeFilter = 'CUSTOM';
      this.refreshActiveViews();
    },

    setCustomToDateTime(val) {
      this.customToDateTime = val || '';
      this.dateRangeFilter = 'CUSTOM';
      this.refreshActiveViews();
    },

    setCashierFilter(val) {
      this.cashierFilter = val || 'ALL';
      this.refreshActiveViews();
    },

    filterByUserAndOpenStream(cName) {
      this.cashierFilter = cName || 'ALL';
      this.activeLens = 'all_pages_stream';
      this.activeDeptFilter = 'ALL';
      this.posSubFilter = 'ALL';
      this.refreshActiveViews();
    },

    onSearchInput(val) {
      this.searchQuery = String(val || '');
      this.refreshActiveViews();
      setTimeout(() => {
        const inputs = document.querySelectorAll('input[placeholder*="ابحث باسم السلعة"]');
        for (const inp of inputs) {
          if (inp.offsetParent !== null) {
            inp.focus();
            const len = inp.value.length;
            inp.setSelectionRange(len, len);
            break;
          }
        }
      }, 10);
    },

    jumpFromModalToTab14() {
      if (window.App && typeof window.App.closeModal === 'function') {
        window.App.closeModal('auditLogModal');
      } else {
        document.getElementById('auditLogModal')?.classList.remove('active');
      }
      this.openTab14();
    },

    getSavedManagerPin() {
      for (const k of ['gherbi_v10_manager_pin', 'gherbi_manager_pin_v1', 'gherbi_owner_pin']) {
        const v = localStorage.getItem(k);
        if (v && String(v).trim()) return String(v).trim();
      }
      return '1234';
    },

    openManagerPinModal() {
      let pinModal = document.getElementById('v40ManagerPinModal');
      if (!pinModal) {
        pinModal = document.createElement('div');
        pinModal.id = 'v40ManagerPinModal';
        pinModal.style.zIndex = '28000';
        pinModal.className = 'fixed inset-0 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4';
        document.body.appendChild(pinModal);
      }

      pinModal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right" dir="rtl">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <h3 class="text-base font-black text-slate-900 dark:text-white">🔑 تغيير كود المدير السري (Manager PIN)</h3>
            <button type="button" onclick="document.getElementById('v40ManagerPinModal').classList.add('hidden')" class="text-slate-400 hover:text-rose-500 font-black text-lg">✕</button>
          </div>
          <div class="space-y-3 text-xs">
            <div><label class="block font-black mb-1">الكود السري الحالي (الافتراضي: 1234)</label><input id="v40CurrPinInp" type="password" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-mono font-black text-center text-base"></div>
            <div><label class="block font-black mb-1">الكود السري الجديد</label><input id="v40NewPinInp" type="password" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-mono font-black text-center text-base"></div>
            <div><label class="block font-black mb-1">تأكيد الكود السري الجديد</label><input id="v40ConfPinInp" type="password" onkeydown="if(event.key==='Enter') window.GherbiForensicCenterV40.saveManagerPin()" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-mono font-black text-center text-base"></div>
            <div id="v40PinErrBox" class="hidden p-2.5 rounded-xl bg-rose-100 text-rose-700 font-black text-center"></div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="document.getElementById('v40ManagerPinModal').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-xs">إلغاء</button>
            <button type="button" onclick="window.GherbiForensicCenterV40.saveManagerPin()" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">💾 حفظ الكود الجديد</button>
          </div>
        </div>
      `;
      pinModal.classList.remove('hidden');
      setTimeout(() => document.getElementById('v40CurrPinInp')?.focus(), 50);
    },

    saveManagerPin() {
      const curr = String(document.getElementById('v40CurrPinInp')?.value || '').trim();
      const nw = String(document.getElementById('v40NewPinInp')?.value || '').trim();
      const cf = String(document.getElementById('v40ConfPinInp')?.value || '').trim();
      const errBox = document.getElementById('v40PinErrBox');
      const showErr = (m) => { if (errBox) { errBox.textContent = m; errBox.classList.remove('hidden'); } };

      if (curr !== this.getSavedManagerPin()) return showErr('❌ الكود السري الحالي غير صحيح!');
      if (nw.length < 4) return showErr('⚠️ الكود الجديد يجب أن يتكون من 4 أرقام على الأقل.');
      if (nw !== cf) return showErr('⚠️ الكود الجديد وتأكيده غير متطابقين!');

      localStorage.setItem('gherbi_v10_manager_pin', nw);
      localStorage.setItem('gherbi_manager_pin_v1', nw);
      localStorage.setItem('gherbi_owner_pin', nw);
      document.getElementById('v40ManagerPinModal')?.classList.add('hidden');
      if (window.showToast) window.showToast('🔑 تم حفظ كود المدير السري (PIN) بنجاح!', 'success');
    },

    exportFullExcelCsv() {
      const d = this.compileOmniscient360Data();
      const rows = [
        ['التوقيت', 'أين (القسم)', 'المستخدم', 'نوع الحركة', 'الصنف / البيان', 'التفاصيل', 'الكمية', 'سعر الشراء', 'سعر البيع', 'الأثر المالي (د.ج)']
      ];
      for (const r of d.events) {
        rows.push([
          r.rawTime || r.time,
          (DEPT_META[r.dept] && DEPT_META[r.dept].label) || r.dept,
          r.cashier,
          r.eventType,
          r.productName,
          r.reasonText,
          r.qty,
          r.costP.toFixed(2),
          r.newP.toFixed(2),
          r.impactDzd.toFixed(2)
        ]);
      }
      const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gherbi_360_Forensic_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (window.showToast) window.showToast('📊 تم تصدير السجل الرقابي المفرز إلى ملف Excel بنجاح!', 'success');
    }
  };

  window.GherbiForensicCenterV40 = ForensicCenter;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ForensicCenter.init());
  } else {
    ForensicCenter.init();
  }
})();

/* [POS_TIME_MACHINE_STAGE_1] */
(function(){ if(stageNum < 2) { document.querySelectorAll('[id*="v65"], [id*="V65"]').forEach(el => el.remove()); } });
/* [POS_TIME_MACHINE_SAFE_CHANGE_SHIM] */
if (typeof window !== 'undefined') {
  window.GherbiV4Stage1 = window.GherbiV4Stage1 || {};
  if (typeof window.GherbiV4Stage1.computeChangeInstant !== 'function') {
    window.GherbiV4Stage1.computeChangeInstant = function () { return 0; };
  }
}
