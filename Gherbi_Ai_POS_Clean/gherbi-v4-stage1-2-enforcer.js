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
