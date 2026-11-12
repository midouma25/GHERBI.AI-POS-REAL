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
                <button type="button" onclick="document.getElementById('enfNewIconInp').value='🥖'" class="hover:scale-125 transition">🥖</button>
                <button type="button" onclick="document.getElementById('enfNewIconInp').value='🥛'" class="hover:scale-125 transition">🥛</button>
                <button type="button" onclick="document.getElementById('enfNewIconInp').value='🥚'" class="hover:scale-125 transition">🥚</button>
                <button type="button" onclick="document.getElementById('enfNewIconInp').value='🛍️'" class="hover:scale-125 transition">🛍️</button>
                <button type="button" onclick="document.getElementById('enfNewIconInp').value='💧'" class="hover:scale-125 transition">💧</button>
                <button type="button" onclick="document.getElementById('enfNewIconInp').value='☕'" class="hover:scale-125 transition">☕</button>
                <button type="button" onclick="document.getElementById('enfNewIconInp').value='📄'" class="hover:scale-125 transition">📄</button>
                <button type="button" onclick="document.getElementById('enfNewIconInp').value='🎁'" class="hover:scale-125 transition">🎁</button>
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
      this.buildAllModals();
      document.getElementById('enfPinCurrent').value = '';
      document.getElementById('enfPinNew').value = '';
      document.getElementById('enfPinConfirm').value = '';
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
      document.getElementById('enfNewNameInp').value = '';
      document.getElementById('enfNewPriceInp').value = '';
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

      document.getElementById('enfQbIdx').value = String(idx);
      document.getElementById('enfQbIcon').value = item.icon || '⚡';
      document.getElementById('enfQbName').value = item.name || '';
      document.getElementById('enfQbPrice').value = Number(item.price || 0);
      document.getElementById('enfQbCat').value = item.category || 'خدمات سريعة';
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
      window.GherbiV4Stage1?.computeChangeInstant(0);
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
