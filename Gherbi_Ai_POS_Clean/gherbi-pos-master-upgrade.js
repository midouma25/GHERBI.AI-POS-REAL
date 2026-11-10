/**
 * gherbi-pos-master-upgrade.js
 * المحرك الشامل للتعديلات الـ 12 على واجهة Gherbi.Ai POS الأصلية:
 * 1. فاصل السحب الديناميكي لتكبير/تصغير نصف الشاشة الأيسر (Smooth Split Resizer)
 * 2. شريط السلات المدمج مع زر الحذف (✕) واختصار Ctrl+N
 * 3. الزر الشريطي الذكي للزبون والوفاء + نافذة (F8 / F9) الفورية مع حساب الدينار والسنتيم
 * 4. تعظيم مساحة مستطيل المشتريات (#posCartItems) + طيّ الخصم والكوبون
 * 5. إصلاح تحديث السعر بـ (F12) + تحذير وتقرير "البيع بسعر التكلفة أو أقل" لصاحب المحل
 * 6. إصلاح مضاعفات الكمية (1x, 2x, 3x, 5x, 10x + Ctrl+X)
 * 7. نافذة زبون مخصصة للتجزئة (Retail-First Customer Modal)
 * 8. تبديل موضع القائمة الرئيسية (جانبية Sidebar ⇄ علوية أفقية Top Navbar)
 * 9. فاحص السعر بـ (F6) وإغلاق الوردية بـ (F10)
 * 10. إصلاح شامل لزر ووضع الإرجاع (Return Mode)
 * 11. عرض المخزون الحالي والمتبقي بعد البيع (المخزون: X ← سيبقى: Y) داخل كل سطر في السلة
 * 12. شريط حاسبة الصرف السريعة (Quick Cash Change Calculator)
 */

'use strict';

window.GherbiMasterUpgrade = {
  activeMultiplier: 1,
  selectedCartRowIdx: 0,
  returnModeActive: false,
  loyaltyPtsRateDzd: 2, // كل 1 نقطة = 2.00 د.ج (يُقرأ أيضاً من إعدادات المحل إن وجد)

  init() {
    this.setupResizableSplitPane();
    this.restructureLeftCartPanel();
    this.buildSmartLoyaltyAndPriceModals();
    this.setupRetailCustomerModalAccordion();
    this.setupNavPositionToggle();
    this.fixPriceCheckerAndShiftShortcuts();
    this.hookIntoAppEngine();
    this.bindGlobalKeyboardShortcuts();
    this.injectCostPriceAlertsIntoReports();

    setTimeout(() => {
      this.refreshAllUpgrades();
    }, 500);
  },

  // ==========================================================================
  // 1. فاصل السحب الديناميكي لتكبير وتصغير النصف الأيسر (Smooth Split Resizer)
  // ==========================================================================
  setupResizableSplitPane() {
    const posLayout = document.querySelector('#view-pos .pos-layout');
    const cartContainer = document.querySelector('#view-pos .cart-container');
    if (!posLayout || !cartContainer) return;

    // استرجاع العرض المحفوظ
    const savedWidth = localStorage.getItem('gherbi_pos_cart_width');
    if (savedWidth) {
      document.documentElement.style.setProperty('--gherbi-cart-width', savedWidth + 'px');
    }

    if (document.getElementById('posSplitResizer')) return;

    const resizer = document.createElement('div');
    resizer.id = 'posSplitResizer';
    resizer.className = 'gherbi-split-resizer';
    resizer.title = 'اسحب يميناً أو يساراً لتكبير أو تصغير شاشة السلة (انقر مرتين للحجم الافتراضي)';

    // إدراج الفاصل بين قسم المنتجات وقسم السلة
    posLayout.insertBefore(resizer, cartContainer);

    let isDragging = false;

    const onMove = (clientX) => {
      if (!isDragging) return;
      const rect = posLayout.getBoundingClientRect();
      const isRtl = getComputedStyle(posLayout).direction === 'rtl';
      // في واجهة RTL، السلة في اليسار أي أن عرضها يساوي المسافة من يسار الشاشة إلى موقع المؤشر
      let newWidth = isRtl ? (clientX - rect.left) : (rect.right - clientX);
      const minW = 340;
      const maxW = Math.floor(window.innerWidth * 0.66);
      newWidth = Math.max(minW, Math.min(maxW, newWidth));

      requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--gherbi-cart-width', newWidth + 'px');
      });
      localStorage.setItem('gherbi_pos_cart_width', String(Math.round(newWidth)));
    };

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      resizer.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) onMove(e.clientX);
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      resizer.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });

    // دعم شاشات اللمس
    resizer.addEventListener('touchstart', () => {
      isDragging = true;
      resizer.classList.add('is-dragging');
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches[0]) onMove(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isDragging = false;
      resizer.classList.remove('is-dragging');
    });

    // النقر المزدوج لإعادة العرض القياسي المتوازن
    resizer.addEventListener('dblclick', () => {
      const defW = 460;
      document.documentElement.style.setProperty('--gherbi-cart-width', defW + 'px');
      localStorage.setItem('gherbi_pos_cart_width', String(defW));
    });
  },

  // ==========================================================================
  // 2 & 3 & 4 & 12. إعادة هندسة لوحة السلة لتعظيم مساحة المشتريات وإضافة الشريط الذكي
  // ==========================================================================
  restructureLeftCartPanel() {
    const cartContainer = document.querySelector('#view-pos .cart-container');
    if (!cartContainer || cartContainer.dataset.gherbiUpgraded === '1') return;
    cartContainer.dataset.gherbiUpgraded = '1';

    // إخفاء الصناديق القديمة الكبيرة الخاصة ببطاقة الوفاء المفتوحة لتوفير المساحة الرأسية
    Array.from(cartContainer.querySelectorAll('div, p, span')).forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (
        (txt.includes('البيع الحالي:') && txt.includes('بطاقة الوفاء') && el.children.length <= 4) ||
        (txt.includes('وصل تبديل هدية') && el.tagName === 'BUTTON')
      ) {
        const box = el.closest('.p-3, .p-2, .rounded-xl');
        if (box && !box.contains(document.getElementById('posCartItems'))) {
          // سنقوم بتنظيمها داخل الشريط العلوي المدمج
        }
      }
    });

    // أ. إنشاء الشريط العلوي المدمج للسلات المتعددة (+ سلة Ctrl+N | سجل | آخر المبيعات)
    const multiCartTabs = document.getElementById('multiCartTabs');
    const posCustomerSelect = document.getElementById('posCustomerSelect');
    const posPriceTierSelect = document.getElementById('posPriceTierSelect');
    const posCartItems = document.getElementById('posCartItems');

    const topBlock = document.createElement('div');
    topBlock.id = 'gherbiCompactTopDeck';
    topBlock.innerHTML = `
      <!-- 1. شريط التبويبات العلوي المدمج للسلات المتعددة + زر سجل + زر + سلة (Ctrl+N) -->
      <div class="gherbi-compact-carts-header">
        <div class="flex items-center gap-1 overflow-x-auto flex-1" id="gherbiEnhancedCartTabs"></div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" onclick="GherbiMasterUpgrade.createNewCartWithShortcut()"
            class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black flex items-center gap-1 shadow-sm"
            title="فتح سلة جديدة (Ctrl+N)">
            <span>+ سلة</span>
            <kbd class="text-[9px] bg-blue-800/80 px-1 rounded font-mono">Ctrl+N</kbd>
          </button>
          <button type="button" onclick="App.openDraftsModal ? App.openDraftsModal() : App.switchView('sales')"
            class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1"
            title="سجل الفواتير والمسودات">
            <span>🕒 سجل</span>
          </button>
        </div>
      </div>

      <!-- 2. الزر الشريطي الذكي للزبون والوفاء (يفتح نافذة F8 / F9 الفورية) -->
      <div class="gherbi-smart-customer-bar">
        <button type="button" id="gherbiSmartCustomerTrigger" onclick="GherbiMasterUpgrade.openSmartLoyaltyModal('scan')"
          class="gherbi-loyalty-trigger-btn" title="اضغط هنا أو اضغط F8 لاختيار الزبون ومسح بطاقة الوفاء، أو F9 لاختزال النقاط">
          <div class="flex items-center gap-1.5 truncate">
            <span id="gherbiTriggerCustIcon" class="text-base">👤</span>
            <span id="gherbiTriggerCustName" class="truncate font-black">زبون عابر (بدون بطاقة وفاء)</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span id="gherbiTriggerPointsBadge" class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-black text-[10.5px]">
              👑 الأوفياء (F8/F9)
            </span>
          </div>
        </button>

        <button type="button" onclick="App.openCustomerModal()"
          class="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 hover:bg-emerald-600 hover:text-white transition shrink-0"
          title="إضافة زبون جديد للمحل">
          <span class="material-symbols-rounded icon-sm">person_add</span>
        </button>

        <div id="gherbiPriceTierSlot" class="shrink-0"></div>
      </div>

      <!-- 3. شريط مضاعفات الكمية الفعال (1x | 2x | 3x | 5x | 10x) + بيع بمبلغ -->
      <div class="gherbi-multiplier-strip">
        <div class="flex items-center gap-1">
          <span class="text-[10.5px] font-extrabold text-slate-500 ml-1">ضرب الكمية:</span>
          <button type="button" onclick="GherbiMasterUpgrade.setMultiplier(1)" data-gmult="1" class="gherbi-mult-pill active">1x</button>
          <button type="button" onclick="GherbiMasterUpgrade.setMultiplier(2)" data-gmult="2" class="gherbi-mult-pill">2x</button>
          <button type="button" onclick="GherbiMasterUpgrade.setMultiplier(3)" data-gmult="3" class="gherbi-mult-pill">3x</button>
          <button type="button" onclick="GherbiMasterUpgrade.setMultiplier(5)" data-gmult="5" class="gherbi-mult-pill">5x</button>
          <button type="button" onclick="GherbiMasterUpgrade.setMultiplier(10)" data-gmult="10" class="gherbi-mult-pill">10x</button>
        </div>
        <button type="button" onclick="GherbiMasterUpgrade.sellByTargetAmount()"
          class="px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10.5px] font-black flex items-center gap-1 hover:bg-emerald-600 hover:text-white transition">
          <span>⚖️ بيع بمبلغ (د.ج)</span>
        </button>
      </div>
    `;

    // إخفاء الترويسة القديمة المزدحمة أعلى السلة مع الإبقاء على عناصر الـ DOM الأصلية داخل جسر مخفي
    const oldTopHeader = posCustomerSelect ? posCustomerSelect.closest('.border-b') : cartContainer.firstElementChild;
    if (oldTopHeader && oldTopHeader !== posCartItems) {
      oldTopHeader.classList.add('hidden');
    }

    cartContainer.insertBefore(topBlock, cartContainer.firstChild);

    if (posPriceTierSelect) {
      const slot = document.getElementById('gherbiPriceTierSlot');
      if (slot) {
        posPriceTierSelect.className = 'px-2 py-1 rounded-lg text-[11px] font-black bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700';
        slot.appendChild(posPriceTierSelect);
      }
    }

    // ب. ضغط منطقة الكوبون والتخفيض أسفل السلة وإضافة حاسبة الصرف السريعة
    const cartSubtotalText = document.getElementById('cartSubtotalText');
    const cartDiscountInput = document.getElementById('cartDiscountInput');
    const footerBox = cartSubtotalText ? cartSubtotalText.closest('.border-t') : cartContainer.lastElementChild;

    if (footerBox) {
      footerBox.classList.add('gherbi-compact-footer');

      // طي سطور الكوبون والتخفيض القديمة في درج مدمج يفتح بزر "+ خصم / كوبون"
      if (cartDiscountInput) {
        const discRow = cartDiscountInput.closest('.flex');
        if (discRow) {
          discRow.id = 'gherbiCollapsibleDiscountRow';
          discRow.classList.add('hidden');
        }
      }

      // البحث عن أي سطر خاص بكوبون الخصم وطيّه أيضاً
      Array.from(footerBox.querySelectorAll('div')).forEach((d) => {
        if ((d.textContent || '').includes('كوبون خصم') && d !== footerBox && !d.querySelector('#cartTotalText')) {
          d.id = 'gherbiCollapsibleCouponRow';
          d.classList.add('hidden');
        }
      });

      // إضافة زر "+ خصم / كوبون" بجانب المجموع الفرعي
      if (cartSubtotalText && !document.getElementById('gherbiToggleDiscountDrawerBtn')) {
        const subRow = cartSubtotalText.closest('.flex');
        if (subRow) {
          const toggleBtn = document.createElement('button');
          toggleBtn.id = 'gherbiToggleDiscountDrawerBtn';
          toggleBtn.type = 'button';
          toggleBtn.className = 'px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 text-[10.5px] font-black hover:bg-indigo-600 hover:text-white transition';
          toggleBtn.innerHTML = '🏷️ + تخفيض / كوبون';
          toggleBtn.onclick = () => {
            document.getElementById('gherbiCollapsibleDiscountRow')?.classList.toggle('hidden');
            document.getElementById('gherbiCollapsibleCouponRow')?.classList.toggle('hidden');
            cartDiscountInput?.focus();
          };
          subRow.insertBefore(toggleBtn, subRow.firstChild);
        }
      }

      // إضافة شريط حاسبة الصرف السريعة (Quick Cash Change Calculator)
      if (!document.getElementById('gherbiQuickChangeBar')) {
        const changeBar = document.createElement('div');
        changeBar.id = 'gherbiQuickChangeBar';
        changeBar.className = 'gherbi-quick-change-bar';
        changeBar.innerHTML = `
          <div class="flex items-center gap-1 flex-wrap">
            <span class="font-extrabold text-slate-500">المستلم:</span>
            <input id="gherbiQuickCashReceived" type="number" step="any" placeholder="المبلغ..."
              oninput="GherbiMasterUpgrade.updateQuickChange()"
              class="w-20 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono font-black text-xs text-center bg-white dark:bg-slate-800">
            <button type="button" onclick="GherbiMasterUpgrade.setQuickCash(200)" class="gherbi-banknote-btn">200</button>
            <button type="button" onclick="GherbiMasterUpgrade.setQuickCash(500)" class="gherbi-banknote-btn">500</button>
            <button type="button" onclick="GherbiMasterUpgrade.setQuickCash(1000)" class="gherbi-banknote-btn">1000</button>
            <button type="button" onclick="GherbiMasterUpgrade.setQuickCash(2000)" class="gherbi-banknote-btn">2000</button>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span class="font-bold text-slate-500">الباقي:</span>
            <span id="gherbiQuickChangeResult" class="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">0.00 د.ج</span>
          </div>
        `;
        const totalRow = document.getElementById('cartTotalText')?.closest('.flex');
        if (totalRow && totalRow.parentNode === footerBox) {
          footerBox.insertBefore(changeBar, totalRow.nextSibling);
        } else {
          footerBox.insertBefore(changeBar, footerBox.firstChild);
        }
      }
    }
  },

  // ==========================================================================
  // 3 & 9. بناء نافذة الزبون والوفاء الفورية (F8 / F9) + نافذة فاحص السعر (F6)
  // ==========================================================================
  buildSmartLoyaltyAndPriceModals() {
    if (document.getElementById('gherbiSmartLoyaltyModal')) return;

    const modalsWrapper = document.createElement('div');
    modalsWrapper.innerHTML = `
      <!-- نافذة الزبون والوفاء الذكية الفورية (F8 / F9) -->
      <div id="gherbiSmartLoyaltyModal" class="modal-overlay">
        <div class="modal-content w-full max-w-2xl p-0 overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl">
          <!-- رأس النافذة -->
          <div class="flex items-center justify-between px-5 py-3.5 bg-gradient-to-l from-amber-500 to-amber-600 text-slate-950">
            <div class="flex items-center gap-2 font-black text-sm">
              <span class="text-xl">👑</span>
              <span>بطاقة الوفاء واختيار الزبون واختزال النقاط (F8 / F9)</span>
            </div>
            <button type="button" onclick="GherbiMasterUpgrade.closeSmartLoyaltyModal()" class="w-7 h-7 rounded-full bg-black/15 hover:bg-black/25 font-black flex items-center justify-center">✕</button>
          </div>

          <div class="p-5 bg-white dark:bg-slate-900 space-y-4 text-xs">
            
            <!-- 1. خانة مسح الباركود (F8) أو البحث الفوري بالاسم / الهاتف -->
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-2 border-blue-500/60 space-y-2.5">
              <div class="flex items-center justify-between">
                <label for="smartLoyaltyScanInput" class="font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5 text-xs">
                  <span>🏷️ خانة المسح والبحث الفوري (F8):</span>
                  <span class="text-[10px] font-bold text-slate-500">(مرر بطاقة FID-... أو اكتب اسم/هاتف الزبون)</span>
                </label>
                <div class="flex items-center gap-1.5">
                  <button type="button" onclick="GherbiMasterUpgrade.toggleAllCustomersTable()"
                    class="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-[11px] hover:bg-blue-500">
                    📋 عرض كل الزبائن
                  </button>
                  <button type="button" onclick="GherbiMasterUpgrade.selectWalkInCustomer()"
                    class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold text-[11px]">
                    👤 زبون عابر
                  </button>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <input id="smartLoyaltyScanInput" type="text"
                  oninput="GherbiMasterUpgrade.onSmartCustomerSearch(this.value)"
                  onkeydown="GherbiMasterUpgrade.onSmartScanKeydown(event)"
                  placeholder="امسح باركود البطاقة (FID-0001) أو اكتب اسم الزبون أو رقم هاتفه ثم اضغط Enter..."
                  class="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-blue-500 font-bold text-sm bg-white dark:bg-slate-950 focus:ring-4 focus:ring-blue-500/20">
              </div>

              <!-- جدول نتائج البحث / قائمة كل الزبائن -->
              <div id="smartCustomersListContainer" class="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <table class="w-full text-xs border-collapse">
                  <thead>
                    <tr class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                      <th class="py-2 px-3 text-right">اسم الزبون</th>
                      <th class="py-2 px-2 text-center">الكود / الهاتف</th>
                      <th class="py-2 px-2 text-center">نقاط الولاء</th>
                      <th class="py-2 px-2 text-center">قيمة النقاط</th>
                      <th class="py-2 px-2 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody id="smartCustomersTbody"></tbody>
                </table>
              </div>
            </div>

            <!-- 2. بطاقة الزبون المختار وخانة اختزال النقاط الفورية (F9) -->
            <div id="smartSelectedCustomerCard" class="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 space-y-3">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 font-mono font-black text-xs" id="smartModalCustCode">FID-0000</span>
                  <span class="text-base font-black text-slate-900 dark:text-white" id="smartModalCustName">زبون عابر (بدون بطاقة)</span>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-left">
                    <div class="text-[10px] font-bold text-slate-500">رصيد النقاط المتاح:</div>
                    <div class="text-sm font-black text-amber-600 dark:text-amber-400 font-mono" id="smartModalCustPoints">0 نقطة</div>
                  </div>
                  <div class="text-left border-r border-amber-500/30 pr-3">
                    <div class="text-[10px] font-bold text-slate-500">تساوي بالدينار:</div>
                    <div class="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono" id="smartModalCustMaxDzd">0.00 د.ج</div>
                  </div>
                </div>
              </div>

              <!-- خانة اختزال النقاط المباشرة (F9) + كم تساوي بالدينار والسنتيم لحظياً -->
              <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/40 space-y-2.5">
                <div class="flex items-center justify-between">
                  <label for="smartPointsRedeemInput" class="font-black text-amber-700 dark:text-amber-300 text-xs">
                    🎁 خانة اختزال النقاط (F9): اكتب عدد النقاط المراد خصمها أو اختر اختزال الكل
                  </label>
                  <button type="button" onclick="GherbiMasterUpgrade.redeemAllAvailablePoints()"
                    class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm">
                    🎁 اختزال كل النقاط المتاحة
                  </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <div class="flex items-center gap-2">
                    <input id="smartPointsRedeemInput" type="number" min="0" step="1" value="0"
                      oninput="GherbiMasterUpgrade.updateRedeemPreview()"
                      onkeydown="if(event.key==='Enter'){ event.preventDefault(); GherbiMasterUpgrade.confirmSmartLoyaltyModal(); }"
                      placeholder="عدد النقاط..."
                      class="w-full px-3 py-2 rounded-xl border-2 border-amber-500 font-mono font-black text-base text-center bg-amber-50/40 dark:bg-slate-800">
                  </div>

                  <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <div class="text-[10px] font-bold text-slate-500">قيمة الخصم المباشر على الفاتورة:</div>
                    <div id="smartRedeemDzdPreview" class="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400">0.00 د.ج</div>
                    <div id="smartRedeemCentimesPreview" class="text-[10.5px] font-bold text-amber-600 dark:text-amber-400">0 سنتيم جزائري</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- أزرار التأكيد OK والإغلاق -->
            <div class="flex items-center justify-between pt-2">
              <button type="button" onclick="GherbiMasterUpgrade.closeSmartLoyaltyModal(); App.openCustomerModal();"
                class="px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center gap-1">
                <span>➕ إضافة زبون جديد للمحل</span>
              </button>

              <div class="flex items-center gap-2">
                <button type="button" onclick="GherbiMasterUpgrade.confirmSmartLoyaltyModal()"
                  class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-600/25 flex items-center gap-1.5">
                  <span>✔ OK (تأكيد وتطبيق)</span>
                </button>
                <button type="button" onclick="GherbiMasterUpgrade.closeSmartLoyaltyModal()"
                  class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 font-black text-xs">
                  إلغاء
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- نافذة فاحص السعر والمخزون السريع (F6) -->
      <div id="gherbiPriceCheckerModal" class="modal-overlay">
        <div class="modal-content w-full max-w-lg p-0 overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl">
          <div class="flex items-center justify-between px-5 py-3.5 bg-indigo-600 text-white">
            <div class="flex items-center gap-2 font-black text-sm">
              <span class="material-symbols-rounded">manage_search</span>
              <span>فاحص السعر والمخزون الفوري (F6)</span>
            </div>
            <button type="button" onclick="document.getElementById('gherbiPriceCheckerModal').classList.remove('active')" class="font-black">✕</button>
          </div>
          <div class="p-5 bg-white dark:bg-slate-900 space-y-4">
            <input id="gherbiPriceCheckerInput" type="text"
              oninput="GherbiMasterUpgrade.lookupProductPrice(this.value)"
              placeholder="امسح الباركود أو اكتب اسم السلعة لفحص سعرها ومخزونها..."
              class="w-full px-4 py-3 rounded-xl border-2 border-indigo-500 font-bold text-sm">
            <div id="gherbiPriceCheckerResult" class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <p class="text-xs font-bold text-slate-400">بانتظار مسح الباركود أو كتابة الاسم...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalsWrapper);
  },

  // ==========================================================================
  // إدارة نافذة الزبون والوفاء الذكية (F8 / F9)
  // ==========================================================================
  openSmartLoyaltyModal(focusTarget = 'scan') {
    const modal = document.getElementById('gherbiSmartLoyaltyModal');
    if (!modal) return;
    modal.classList.add('active');

    this.renderSmartCustomersRows('');
    this.syncSmartModalWithCurrentCustomer();

    setTimeout(() => {
      if (focusTarget === 'redeem') {
        const redInput = document.getElementById('smartPointsRedeemInput');
        if (redInput) { redInput.focus(); redInput.select(); }
      } else {
        const scanInput = document.getElementById('smartLoyaltyScanInput');
        if (scanInput) { scanInput.value = ''; scanInput.focus(); }
      }
    }, 60);
  },

  closeSmartLoyaltyModal() {
    document.getElementById('gherbiSmartLoyaltyModal')?.classList.remove('active');
  },

  getCustomersList() {
    return (window.App && Array.isArray(window.App.customers)) ? window.App.customers : [];
  },

  onSmartCustomerSearch(query) {
    const q = String(query || '').trim();
    this.renderSmartCustomersRows(q);

    // إذا كان الكود الممسوح يطابق باركود وفاء FID-... تماماً، نختاره تلقائياً
    const exactMatch = this.getCustomersList().find((c) => {
      const code = String(c.loyalty_card_code || ('FID-' + String(c.id).padStart(5, '0'))).toLowerCase();
      return code === q.toLowerCase() || String(c.phone || '') === q;
    });
    if (exactMatch) {
      this.setSmartModalCustomer(exactMatch.id);
    }
  },

  onSmartScanKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        this.confirmSmartLoyaltyModal();
        return;
      }
      const list = this.getCustomersList();
      const match = list.find((c) => {
        const fid = ('fid-' + String(c.id).padStart(5, '0'));
        return (
          String(c.loyalty_card_code || '').toLowerCase() === q ||
          fid === q ||
          String(c.phone || '').toLowerCase().includes(q) ||
          String(c.name || '').toLowerCase().includes(q)
        );
      });
      if (match) {
        this.setSmartModalCustomer(match.id);
        document.getElementById('smartPointsRedeemInput')?.focus();
        document.getElementById('smartPointsRedeemInput')?.select();
      }
    }
  },

  toggleAllCustomersTable() {
    const inp = document.getElementById('smartLoyaltyScanInput');
    if (inp) inp.value = '';
    this.renderSmartCustomersRows('');
  },

  renderSmartCustomersRows(query = '') {
    const tbody = document.getElementById('smartCustomersTbody');
    if (!tbody) return;
    const q = String(query || '').trim().toLowerCase();
    const list = this.getCustomersList();

    const filtered = list.filter((c) => {
      if (!q) return true;
      const fid = 'fid-' + String(c.id).padStart(5, '0');
      return (
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.phone || '').toLowerCase().includes(q) ||
        String(c.loyalty_card_code || '').toLowerCase().includes(q) ||
        fid.includes(q)
      );
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400 font-bold">لا يوجد زبون مطابق — اضغط "إضافة زبون جديد" بالأسفل</td></tr>';
      return;
    }

    const rate = this.getLoyaltyPointRate();
    tbody.innerHTML = filtered.slice(0, 60).map((c) => {
      const pts = Number(c.loyalty_points || 0);
      const valDzd = (pts * rate).toFixed(2);
      const fidCode = c.loyalty_card_code || ('FID-' + String(c.id).padStart(5, '0'));
      return `
        <tr onclick="GherbiMasterUpgrade.setSmartModalCustomer(${c.id})"
            class="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-500/10 cursor-pointer font-bold">
          <td class="py-2 px-3">${c.name || ''}</td>
          <td class="py-2 px-2 text-center font-mono text-[11px] text-slate-500">${c.phone || fidCode}</td>
          <td class="py-2 px-2 text-center font-mono font-black text-amber-600">⭐ ${pts}</td>
          <td class="py-2 px-2 text-center font-mono font-black text-emerald-600">${valDzd} د.ج</td>
          <td class="py-2 px-2 text-center">
            <button type="button" onclick="event.stopPropagation(); GherbiMasterUpgrade.setSmartModalCustomer(${c.id}); GherbiMasterUpgrade.confirmSmartLoyaltyModal();"
              class="px-2.5 py-0.5 rounded bg-blue-600 text-white text-[10.5px] font-black">اختيار</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  getLoyaltyPointRate() {
    if (window.App && window.App.settings && Number(window.App.settings.loyalty_point_value_dzd) > 0) {
      return Number(window.App.settings.loyalty_point_value_dzd);
    }
    return this.loyaltyPtsRateDzd;
  },

  setSmartModalCustomer(customerId) {
    const sel = document.getElementById('posCustomerSelect');
    if (sel) {
      sel.value = String(customerId || '');
      sel.dispatchEvent(new Event('change'));
    }
    if (window.App && typeof window.App.onPosCustomerChange === 'function') {
      window.App.onPosCustomerChange(customerId);
    }
    this.syncSmartModalWithCurrentCustomer();
    this.updateCustomerTriggerBar();
  },

  selectWalkInCustomer() {
    this.setSmartModalCustomer('');
    const redInput = document.getElementById('smartPointsRedeemInput');
    if (redInput) redInput.value = '0';
    this.updateRedeemPreview();
  },

  syncSmartModalWithCurrentCustomer() {
    const sel = document.getElementById('posCustomerSelect');
    const cid = sel ? sel.value : '';
    const cust = this.getCustomersList().find((c) => String(c.id) === String(cid));
    const rate = this.getLoyaltyPointRate();

    const codeEl = document.getElementById('smartModalCustCode');
    const nameEl = document.getElementById('smartModalCustName');
    const ptsEl = document.getElementById('smartModalCustPoints');
    const maxDzdEl = document.getElementById('smartModalCustMaxDzd');
    const redInput = document.getElementById('smartPointsRedeemInput');

    if (cust) {
      const pts = Number(cust.loyalty_points || 0);
      if (codeEl) codeEl.textContent = cust.loyalty_card_code || ('FID-' + String(cust.id).padStart(5, '0'));
      if (nameEl) nameEl.textContent = cust.name;
      if (ptsEl) ptsEl.textContent = pts + ' نقطة';
      if (maxDzdEl) maxDzdEl.textContent = (pts * rate).toFixed(2) + ' د.ج';
      if (redInput) redInput.max = String(pts);
    } else {
      if (codeEl) codeEl.textContent = 'WALK-IN';
      if (nameEl) nameEl.textContent = 'زبون عابر (بدون بطاقة وفاء)';
      if (ptsEl) ptsEl.textContent = '0 نقطة';
      if (maxDzdEl) maxDzdEl.textContent = '0.00 د.ج';
      if (redInput) { redInput.value = '0'; redInput.max = '0'; }
    }
    this.updateRedeemPreview();
  },

  updateRedeemPreview() {
    const redInput = document.getElementById('smartPointsRedeemInput');
    const dzdEl = document.getElementById('smartRedeemDzdPreview');
    const centEl = document.getElementById('smartRedeemCentimesPreview');

    const sel = document.getElementById('posCustomerSelect');
    const cust = this.getCustomersList().find((c) => String(c.id) === String(sel?.value || ''));
    const maxPts = cust ? Number(cust.loyalty_points || 0) : 0;

    let pts = Math.max(0, parseInt(redInput?.value || '0', 10) || 0);
    if (pts > maxPts) {
      pts = maxPts;
      if (redInput) redInput.value = String(maxPts);
    }

    const rate = this.getLoyaltyPointRate();
    const dzd = pts * rate;
    const centimes = Math.round(dzd * 100);

    if (dzdEl) dzdEl.textContent = dzd.toFixed(2) + ' د.ج';
    if (centEl) centEl.textContent = centimes.toLocaleString('fr-DZ') + ' سنتيم جزائري';
  },

  redeemAllAvailablePoints() {
    const sel = document.getElementById('posCustomerSelect');
    const cust = this.getCustomersList().find((c) => String(c.id) === String(sel?.value || ''));
    const maxPts = cust ? Number(cust.loyalty_points || 0) : 0;
    const redInput = document.getElementById('smartPointsRedeemInput');
    if (redInput) {
      redInput.value = String(maxPts);
      this.updateRedeemPreview();
    }
  },

  confirmSmartLoyaltyModal() {
    const redInput = document.getElementById('smartPointsRedeemInput');
    const pts = Math.max(0, parseInt(redInput?.value || '0', 10) || 0);
    const rate = this.getLoyaltyPointRate();
    const discountDzd = pts * rate;

    if (pts > 0) {
      const discInput = document.getElementById('cartDiscountInput');
      if (discInput) {
        discInput.value = discountDzd.toFixed(2);
        discInput.dispatchEvent(new Event('input'));
      }
      if (window.App && typeof window.App.recalcCart === 'function') {
        window.App.recalcCart();
      }
    }

    this.updateCustomerTriggerBar();
    this.closeSmartLoyaltyModal();
  },

  updateCustomerTriggerBar() {
    const sel = document.getElementById('posCustomerSelect');
    const cust = this.getCustomersList().find((c) => String(c.id) === String(sel?.value || ''));
    const iconEl = document.getElementById('gherbiTriggerCustIcon');
    const nameEl = document.getElementById('gherbiTriggerCustName');
    const badgeEl = document.getElementById('gherbiTriggerPointsBadge');
    const rate = this.getLoyaltyPointRate();

    if (cust) {
      const pts = Number(cust.loyalty_points || 0);
      const dzd = (pts * rate).toFixed(2);
      if (iconEl) iconEl.textContent = '👑';
      if (nameEl) nameEl.textContent = cust.name;
      if (badgeEl) badgeEl.textContent = `⭐ ${pts} نقطة (${dzd} د.ج)`;
    } else {
      if (iconEl) iconEl.textContent = '👤';
      if (nameEl) nameEl.textContent = 'زبون عابر (بدون بطاقة وفاء)';
      if (badgeEl) badgeEl.textContent = '👑 الأوفياء (F8/F9)';
    }
  },

  // ==========================================================================
  // 2. إدارة شريط السلات المتعددة مع زر الحذف (✕) واختصار Ctrl+N
  // ==========================================================================
  renderEnhancedCartTabs() {
    const container = document.getElementById('gherbiEnhancedCartTabs');
    if (!container || !window.App) return;

    const carts = Array.isArray(window.App.carts) ? window.App.carts : [{ items: this.getActiveCartItems() }];
    const activeIdx = Number(window.App.activeCartIndex || 0);

    container.innerHTML = carts.map((c, idx) => {
      const itemsArr = Array.isArray(c.items) ? c.items : (Array.isArray(c) ? c : []);
      const count = itemsArr.length;
      const isAct = idx === activeIdx;
      return `
        <div onclick="GherbiMasterUpgrade.switchCartTab(${idx})"
             class="gherbi-cart-tab-pill ${isAct ? 'active' : ''}">
          <span>سلة #${idx + 1} (${count})</span>
          <span onclick="event.stopPropagation(); GherbiMasterUpgrade.deleteOrClearCartTab(${idx})"
                class="gherbi-cart-tab-close" title="إغلاق وحذف هذه السلة">✕</span>
        </div>
      `;
    }).join('');
  },

  switchCartTab(idx) {
    if (!window.App) return;
    if (typeof window.App.switchCartTab === 'function') {
      window.App.switchCartTab(idx);
    } else {
      window.App.activeCartIndex = idx;
    }
    this.refreshAllUpgrades();
  },

  createNewCartWithShortcut() {
    if (!window.App) return;
    if (typeof window.App.newCartTab === 'function') {
      window.App.newCartTab();
    } else if (Array.isArray(window.App.carts)) {
      window.App.carts.push({ items: [], customerId: null, discount: 0 });
      window.App.activeCartIndex = window.App.carts.length - 1;
    }
    this.refreshAllUpgrades();
  },

  deleteOrClearCartTab(idx) {
    if (!window.App) return;
    const carts = Array.isArray(window.App.carts) ? window.App.carts : [];
    if (carts.length <= 1) {
      if (typeof window.App.clearCurrentCart === 'function') window.App.clearCurrentCart();
      this.refreshAllUpgrades();
      return;
    }
    const targetCart = carts[idx];
    const items = Array.isArray(targetCart?.items) ? targetCart.items : [];
    if (items.length > 0 && !confirm(`السلة #${idx + 1} تحتوي على (${items.length}) أصناف. هل تريد حذفها؟`)) {
      return;
    }
    if (typeof window.App.closeCartTab === 'function') {
      window.App.closeCartTab(idx);
    } else {
      carts.splice(idx, 1);
      window.App.activeCartIndex = Math.max(0, Math.min(window.App.activeCartIndex || 0, carts.length - 1));
      if (typeof window.App.renderPosView === 'function') window.App.renderPosView();
    }
    this.refreshAllUpgrades();
  },

  // ==========================================================================
  // 5 & 11. تحديث السعر بـ (F12) + تحذير البيع بالتكلفة أو أقل + شارة المخزون المتبقي
  // ==========================================================================
  getActiveCartItems() {
    if (!window.App) return [];
    if (Array.isArray(window.App.cart)) return window.App.cart;
    if (Array.isArray(window.App.carts) && window.App.carts[window.App.activeCartIndex || 0]) {
      const c = window.App.carts[window.App.activeCartIndex || 0];
      return Array.isArray(c.items) ? c.items : [];
    }
    return [];
  },

  enhanceCartRowsAndStockForecast() {
    const cartContainer = document.getElementById('posCartItems');
    if (!cartContainer || !window.App) return;

    const items = this.getActiveCartItems();
    const products = Array.isArray(window.App.products) ? window.App.products : [];
    const rows = Array.from(cartContainer.children).filter((el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة'));

    rows.forEach((row, idx) => {
      const item = items[idx];
      if (!item) return;

      row.classList.toggle('gherbi-row-selected', idx === this.selectedCartRowIdx);
      row.onclick = () => {
        this.selectedCartRowIdx = idx;
        rows.forEach((r, i) => r.classList.toggle('gherbi-row-selected', i === idx));
      };

      const prod = products.find((p) => Number(p.id) === Number(item.product_id || item.id));
      const currentStock = prod ? Number(prod.total_stock ?? prod.stock ?? 0) : null;
      const costPrice = prod ? Number(prod.cost_price ?? 0) : Number(item.cost_price ?? 0);
      const qtyInCart = Number(item.quantity || 1);
      const unitPrice = Number(item.price || 0);

      // 11. إضافة شارة الكمية المتوفرة والكمية التي ستبقى بعد البيع
      if (currentStock !== null) {
        const remainingStock = Number((currentStock - qtyInCart).toFixed(2));
        const minStock = Number(prod?.min_stock || 5);
        const statusClass = remainingStock <= 0
          ? 'stock-critical'
          : remainingStock <= minStock
            ? 'stock-low'
            : 'stock-safe';

        let badge = row.querySelector('.gherbi-stock-forecast-badge');
        if (!badge) {
          badge = document.createElement('div');
          badge.className = `gherbi-stock-forecast-badge ${statusClass}`;
          const titleEl = row.querySelector('.font-bold, h4, span');
          if (titleEl && titleEl.parentElement) {
            titleEl.parentElement.appendChild(badge);
          } else {
            row.appendChild(badge);
          }
        } else {
          badge.className = `gherbi-stock-forecast-badge ${statusClass}`;
        }
        badge.innerHTML = `<span>📦 المخزون: <strong>${currentStock}</strong></span> <span>← سيبقى: <strong>${remainingStock}</strong></span>`;
      }

      // 5. تفعيل تحديث السعر الفوري وفحص البيع بسعر التكلفة أو أقل
      const inputs = Array.from(row.querySelectorAll('input[type="number"], input[type="text"]'));
      // عادةً حقل السعر هو الحقل الذي يحمل قيمة السعر، وحقل الكمية يحمل الكمية
      inputs.forEach((inp) => {
        const val = parseFloat(inp.value);
        const isPriceInput = Math.abs(val - unitPrice) < 0.01 && Math.abs(unitPrice - qtyInCart) > 0.01
          ? true
          : (inp.getAttribute('onchange') || '').toLowerCase().includes('price') || inputs.indexOf(inp) === 0;

        if (isPriceInput && !inp.dataset.gherbiPriceBound) {
          inp.dataset.gherbiPriceBound = '1';
          inp.classList.add('gherbi-unit-price-input');
          inp.title = 'اضغط F12 لتعديل السعر ثم اضغط Enter للتأكيد';

          const commitPriceUpdate = () => {
            const newPrice = parseFloat(inp.value);
            if (!Number.isFinite(newPrice) || newPrice < 0) return;
            item.price = newPrice;
            item.subtotal = Number((Number(item.quantity || 1) * newPrice).toFixed(2));

            if (costPrice > 0 && newPrice <= costPrice) {
              this.triggerCostPriceWarning(item, newPrice, costPrice);
            }

            if (typeof window.App.updateCartItemPrice === 'function') {
              window.App.updateCartItemPrice(idx, newPrice);
            } else if (typeof window.App.recalcCart === 'function') {
              window.App.recalcCart();
            }
            if (typeof window.App.renderCart === 'function') {
              window.App.renderCart();
            } else if (typeof window.App.renderPosView === 'function') {
              window.App.renderPosView();
            }
            this.refreshAllUpgrades();
          };

          inp.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              commitPriceUpdate();
              inp.blur();
            }
          });
          inp.addEventListener('change', commitPriceUpdate);
        }
      });

      // تمييز السطر إذا كان سعر البيع يساوي أو أقل من التكلفة
      if (costPrice > 0 && unitPrice <= costPrice) {
        row.classList.add('gherbi-cost-warning-row');
        if (!row.querySelector('.gherbi-cost-alert-tag')) {
          const warnTag = document.createElement('div');
          warnTag.className = 'gherbi-cost-alert-tag text-[10px] font-black text-rose-600 dark:text-rose-400 mt-0.5';
          warnTag.textContent = `⚠️ تحذير: السعر (${unitPrice} د.ج) يساوي أو أقل من التكلفة (${costPrice} د.ج)!`;
          row.appendChild(warnTag);
        }
      } else {
        row.classList.remove('gherbi-cost-warning-row');
      }
    });
  },

  focusLastItemPriceWithF12() {
    const items = this.getActiveCartItems();
    if (!items.length) return;
    const priceInputs = Array.from(document.querySelectorAll('#posCartItems .gherbi-unit-price-input'));
    const targetInput = priceInputs[this.selectedCartRowIdx] || priceInputs[priceInputs.length - 1];
    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    } else {
      // نافذة تعديل فورية احتياطية إذا لم يكن الحقل قابلاً للتحرير المباشر
      const idx = Math.min(Math.max(0, this.selectedCartRowIdx), items.length - 1);
      const it = items[idx];
      const prod = (window.App?.products || []).find((p) => Number(p.id) === Number(it.product_id || it.id));
      const costPrice = prod ? Number(prod.cost_price || 0) : 0;
      const input = prompt(`تعديل سعر البيع (F12) للصنف [${it.name}] (سعر التكلفة: ${costPrice} د.ج):`, it.price);
      if (input !== null) {
        const newPrice = parseFloat(input);
        if (Number.isFinite(newPrice) && newPrice >= 0) {
          it.price = newPrice;
          it.subtotal = Number((Number(it.quantity || 1) * newPrice).toFixed(2));
          if (costPrice > 0 && newPrice <= costPrice) {
            this.triggerCostPriceWarning(it, newPrice, costPrice);
          }
          if (window.App?.recalcCart) window.App.recalcCart();
          if (window.App?.renderPosView) window.App.renderPosView();
          this.refreshAllUpgrades();
        }
      }
    }
  },

  triggerCostPriceWarning(item, sellPrice, costPrice) {
    const seller = document.getElementById('currentUserName')?.textContent?.trim() || 'البائع';
    const diff = Number((sellPrice - costPrice).toFixed(2));

    // حفظ التنبيه في سجل الرقابة لصاحب المحل
    const logs = JSON.parse(localStorage.getItem('gherbi_cost_price_alerts') || '[]');
    logs.unshift({
      id: Date.now(),
      date: new Date().toLocaleString('fr-DZ'),
      seller,
      productName: item.name || item.custom_product_name || 'منتج',
      quantity: Number(item.quantity || 1),
      costPrice,
      sellPrice,
      diff
    });
    localStorage.setItem('gherbi_cost_price_alerts', JSON.stringify(logs.slice(0, 200)));

    alert(`⚠️ تحذير رقابي هام!\n\nسعر البيع المدخل (${sellPrice.toFixed(2)} د.ج) للصنف [${item.name}] يساوي أو أقل من سعر التكلفة/الشراء (${costPrice.toFixed(2)} د.ج)!\n\nسيتم تسجيل هذه العملية في تقرير رقابة الأسعار الخاص بصاحب المحل.`);
    this.renderCostPriceAlertsTable();
  },

  injectCostPriceAlertsIntoReports() {
    ['view-analytics', 'view-sales'].forEach((viewId) => {
      const sec = document.getElementById(viewId);
      if (!sec || sec.querySelector('.gherbi-owner-audit-panel')) return;

      const panel = document.createElement('div');
      panel.className = 'gherbi-owner-audit-panel p-4 mb-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/35 space-y-2';
      panel.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 font-black text-sm text-rose-700 dark:text-rose-300">
            <span>🚨</span>
            <span>تنبيهات البيع بسعر التكلفة أو بأقل (رقابة الأسعار لصاحب المحل)</span>
          </div>
          <button type="button" onclick="GherbiMasterUpgrade.clearCostPriceAlerts()"
            class="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-700 dark:text-rose-300 text-[11px] font-bold hover:bg-rose-600 hover:text-white">
            مسح السجل
          </button>
        </div>
        <div class="max-h-48 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-rose-500/25">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-rose-500/15 text-rose-900 dark:text-rose-200 font-black">
                <th class="py-2 px-3 text-right">التاريخ والوقت</th>
                <th class="py-2 px-3 text-right">البائع</th>
                <th class="py-2 px-3 text-right">السلعة</th>
                <th class="py-2 px-3 text-center">الكمية</th>
                <th class="py-2 px-3 text-center">سعر التكلفة</th>
                <th class="py-2 px-3 text-center">سعر البيع</th>
                <th class="py-2 px-3 text-center">الفرق / الخسارة</th>
              </tr>
            </thead>
            <tbody class="gherbi-cost-alerts-tbody"></tbody>
          </table>
        </div>
      `;
      sec.insertBefore(panel, sec.firstChild);
    });
    this.renderCostPriceAlertsTable();
  },

  renderCostPriceAlertsTable() {
    const logs = JSON.parse(localStorage.getItem('gherbi_cost_price_alerts') || '[]');
    document.querySelectorAll('.gherbi-cost-alerts-tbody').forEach((tbody) => {
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-emerald-600 font-bold">✅ لا توجد أي مبيعات بسعر التكلفة أو بأقل حتى الآن</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map((l) => `
        <tr class="border-b border-slate-100 dark:border-slate-800 font-bold">
          <td class="py-1.5 px-3 font-mono text-[11px]">${l.date}</td>
          <td class="py-1.5 px-3">${l.seller}</td>
          <td class="py-1.5 px-3 font-black">${l.productName}</td>
          <td class="py-1.5 px-3 text-center font-mono">${l.quantity}</td>
          <td class="py-1.5 px-3 text-center font-mono">${Number(l.costPrice).toFixed(2)} د.ج</td>
          <td class="py-1.5 px-3 text-center font-mono text-rose-600 font-black">${Number(l.sellPrice).toFixed(2)} د.ج</td>
          <td class="py-1.5 px-3 text-center font-mono text-rose-700 font-black">${Number(l.diff).toFixed(2)} د.ج</td>
        </tr>
      `).join('');
    });
  },

  clearCostPriceAlerts() {
    if (!confirm('هل تريد مسح سجل تنبيهات البيع بسعر التكلفة؟')) return;
    localStorage.removeItem('gherbi_cost_price_alerts');
    this.renderCostPriceAlertsTable();
  },

  // ==========================================================================
  // 6. إصلاح أزرار مضاعفات الكمية (1x | 2x | 3x | 5x | 10x + Ctrl+X)
  // ==========================================================================
  setMultiplier(mult) {
    this.activeMultiplier = Math.max(1, parseInt(mult, 10) || 1);
    if (window.App) {
      window.App.posQtyMultiplier = this.activeMultiplier;
      window.App.qtyMultiplier = this.activeMultiplier;
    }
    document.querySelectorAll('[data-gmult]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.gmult) === this.activeMultiplier);
    });
  },

  sellByTargetAmount() {
    const items = this.getActiveCartItems();
    if (!items.length) {
      alert('اختر الصنف أولاً في السلة ثم اضغط "بيع بمبلغ (د.ج)" لحساب كميته تلقائياً.');
      return;
    }
    const idx = Math.min(Math.max(0, this.selectedCartRowIdx), items.length - 1);
    const it = items[idx];
    const unitPrice = Number(it.price || 0);
    if (unitPrice <= 0) return;

    const amt = prompt(`أدخل المبلغ بالدينار الجزائري لحساب الكمية تلقائياً من [${it.name}] (سعر الوحدة: ${unitPrice} د.ج):`, unitPrice);
    if (amt === null) return;
    const val = parseFloat(amt);
    if (Number.isFinite(val) && val > 0) {
      it.quantity = Number((val / unitPrice).toFixed(3));
      it.subtotal = Number(val.toFixed(2));
      if (window.App?.recalcCart) window.App.recalcCart();
      if (window.App?.renderPosView) window.App.renderPosView();
      this.refreshAllUpgrades();
    }
  },

  // ==========================================================================
  // 7. تنظيف نافذة إضافة / تعديل الزبون لتناسب التجزئة (Retail-First Customer Modal)
  // ==========================================================================
  setupRetailCustomerModalAccordion() {
    const custModal = document.getElementById('customerModal');
    if (!custModal || custModal.dataset.retailUpgraded === '1') return;
    custModal.dataset.retailUpgraded = '1';

    // طي الحقول الجبائية والبنكية الخاصة بالجملة داخل قسم اختياري مطوي
    const wholesaleKeywords = ['السجل التجاري', 'الرقم الجبائي', 'الرقم الإحصائي', 'مادة الضريبة', 'حساب CCP', 'BaridiMob', 'فئة التسعير'];
    const formContainer = custModal.querySelector('form') || custModal.querySelector('.modal-content');
    if (!formContainer) return;

    const accordion = document.createElement('details');
    accordion.className = 'mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 p-2.5 text-xs';
    accordion.innerHTML = `
      <summary class="cursor-pointer font-black text-slate-600 dark:text-slate-300 select-none">
        🏢 بيانات جبائية وبنكية إضافية (اختياري — للجملة والتقسيط فقط)
      </summary>
      <div class="pt-3 space-y-2.5" id="gherbiWholesaleFieldsWrap"></div>
    `;

    const wrap = accordion.querySelector('#gherbiWholesaleFieldsWrap');
    Array.from(formContainer.querySelectorAll('label, h4, div')).forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (wholesaleKeywords.some((kw) => txt.includes(kw))) {
        const fieldGroup = el.closest('.grid, .p-3, .rounded-xl') || el.parentElement;
        if (fieldGroup && fieldGroup !== formContainer && !fieldGroup.querySelector('input[required]')) {
          wrap.appendChild(fieldGroup);
        }
      }
    });

    if (wrap.children.length > 0) {
      const saveBtnRow = formContainer.querySelector('button[type="submit"]')?.parentElement || formContainer.lastElementChild;
      formContainer.insertBefore(accordion, saveBtnRow);
    }
  },

  // ==========================================================================
  // 8. خيار تبديل موضع القائمة الرئيسية (بين القائمة الجانبية والقائمة العلوية الأفقية)
  // ==========================================================================
  setupNavPositionToggle() {
    const savedMode = localStorage.getItem('gherbi_nav_layout_mode') || 'sidebar';
    document.body.classList.toggle('gherbi-top-nav-mode', savedMode === 'topnav');

    const topHeader = document.getElementById('top-header') || document.querySelector('header');
    if (topHeader && !document.getElementById('gherbiNavModeToggleBtn')) {
      const btn = document.createElement('button');
      btn.id = 'gherbiNavModeToggleBtn';
      btn.type = 'button';
      btn.className = 'px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-black flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition';
      btn.title = 'تبديل مكان القائمة الرئيسية (بين اليمين/اليسار أو في الأعلى لتوسيع الشاشة)';
      const updateBtnLabel = () => {
        const isTop = document.body.classList.contains('gherbi-top-nav-mode');
        btn.innerHTML = isTop
          ? '<span class="material-symbols-rounded icon-sm">view_sidebar</span><span>القائمة بالجانب</span>'
          : '<span class="material-symbols-rounded icon-sm">dock_to_bottom</span><span>القائمة بالأعلى</span>';
      };
      updateBtnLabel();

      btn.onclick = () => {
        const nextTop = !document.body.classList.contains('gherbi-top-nav-mode');
        document.body.classList.toggle('gherbi-top-nav-mode', nextTop);
        localStorage.setItem('gherbi_nav_layout_mode', nextTop ? 'topnav' : 'sidebar');
        updateBtnLabel();
      };

      topHeader.appendChild(btn);
    }
  },

  // ==========================================================================
  // 9 & 10. تعديل فاحص السعر إلى (F6) وإغلاق الوردية (F10) + تفعيل زر الإرجاع 100%
  // ==========================================================================
  fixPriceCheckerAndShiftShortcuts() {
    // تحديث نص زر فاحص السعر ليحمل F6 بدلاً من F10
    Array.from(document.querySelectorAll('button')).forEach((btn) => {
      const txt = (btn.textContent || '').trim();
      if (txt.includes('فاحص السعر')) {
        btn.innerHTML = '<span class="material-symbols-rounded icon-sm">manage_search</span><span>فاحص السعر (F6)</span>';
        btn.onclick = (e) => {
          e.preventDefault();
          this.openPriceCheckerModal();
        };
      }
    });

    // تفعيل زر الإرجاع (#btnReturnMode)
    const btnReturn = document.getElementById('btnReturnMode');
    if (btnReturn && !btnReturn.dataset.gherbiReturnFixed) {
      btnReturn.dataset.gherbiReturnFixed = '1';
      btnReturn.onclick = (e) => {
        e.preventDefault();
        this.toggleReturnMode();
      };
    }
  },

  openPriceCheckerModal() {
    const modal = document.getElementById('gherbiPriceCheckerModal');
    if (!modal) return;
    modal.classList.add('active');
    const inp = document.getElementById('gherbiPriceCheckerInput');
    if (inp) {
      inp.value = '';
      setTimeout(() => inp.focus(), 50);
    }
  },

  lookupProductPrice(query) {
    const resBox = document.getElementById('gherbiPriceCheckerResult');
    if (!resBox || !window.App) return;
    const q = String(query || '').trim().toLowerCase();
    if (!q) {
      resBox.innerHTML = '<p class="text-xs font-bold text-slate-400">بانتظار مسح الباركود أو كتابة الاسم...</p>';
      return;
    }
    const products = Array.isArray(window.App.products) ? window.App.products : [];
    const found = products.find(
      (p) => String(p.barcode || '').toLowerCase() === q || String(p.name || '').toLowerCase().includes(q)
    );
    if (!found) {
      resBox.innerHTML = '<p class="text-sm font-black text-rose-500">❌ لم يتم العثور على سلعة مطابقة</p>';
      return;
    }
    const price = Number(found.selling_price ?? found.price ?? 0).toFixed(2);
    const stock = Number(found.total_stock ?? found.stock ?? 0);
    resBox.innerHTML = `
      <div class="space-y-2">
        <div class="text-base font-black text-slate-900 dark:text-white">${found.name}</div>
        <div class="text-3xl font-mono font-black text-blue-600 dark:text-blue-400">${price} د.ج</div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
          <span>📦 المخزون المتوفر: ${stock}</span>
          <span>|</span>
          <span>الباركود: ${found.barcode || '—'}</span>
        </div>
      </div>
    `;
  },

  toggleReturnMode() {
    this.returnModeActive = !this.returnModeActive;
    if (window.App) {
      window.App.isReturnMode = this.returnModeActive;
      window.App.returnMode = this.returnModeActive;
    }
    const btn = document.getElementById('btnReturnMode');
    if (btn) {
      btn.classList.toggle('return-mode-active', this.returnModeActive);
      btn.innerHTML = this.returnModeActive
        ? '<span class="material-symbols-rounded icon-sm">assignment_return</span><span>وضع الإرجاع نشط (إلغاء)</span>'
        : '<span class="material-symbols-rounded icon-sm">keyboard_return</span><span>إرجاع</span>';
    }
  },

  // ==========================================================================
  // 12. حاسبة الصرف السريعة (Quick Cash Change)
  // ==========================================================================
  setQuickCash(amount) {
    const inp = document.getElementById('gherbiQuickCashReceived');
    if (inp) {
      inp.value = String(amount);
      this.updateQuickChange();
    }
  },

  updateQuickChange() {
    const inp = document.getElementById('gherbiQuickCashReceived');
    const resEl = document.getElementById('gherbiQuickChangeResult');
    const totalEl = document.getElementById('cartTotalText');
    if (!inp || !resEl || !totalEl) return;

    const received = parseFloat(inp.value) || 0;
    const total = parseFloat(String(totalEl.textContent || '0').replace(/[^0-9.-]/g, '')) || 0;
    const change = received - total;

    if (received <= 0) {
      resEl.textContent = '0.00 د.ج';
      resEl.className = 'font-mono font-black text-xs text-slate-400';
    } else if (change < 0) {
      resEl.textContent = `متبقي: ${Math.abs(change).toFixed(2)} د.ج`;
      resEl.className = 'font-mono font-black text-xs text-rose-500';
    } else {
      resEl.textContent = `${change.toFixed(2)} د.ج`;
      resEl.className = 'font-mono font-black text-xs text-emerald-600 dark:text-emerald-400';
    }
  },

  // ==========================================================================
  // ربط المحرك مع دوال window.App الأصلية (Two-Way Hook)
  // ==========================================================================
  hookIntoAppEngine() {
    const waitApp = setInterval(() => {
      if (!window.App) return;
      clearInterval(waitApp);

      // 1. اعتراض addToCart لتطبيق مضاعف الكمية (1x..10x) ووضع الإرجاع تلقائياً
      if (typeof window.App.addToCart === 'function' && !window.App._gherbiHookedAddToCart) {
        const origAdd = window.App.addToCart.bind(window.App);
        window.App.addToCart = (productId, customQty, ...rest) => {
          const mult = this.activeMultiplier || 1;
          const res = origAdd(productId, customQty, ...rest);

          if (mult > 1 && !customQty) {
            const items = this.getActiveCartItems();
            const target = items.find((i) => Number(i.product_id || i.id) === Number(productId));
            if (target) {
              target.quantity = Number((Number(target.quantity || 1) + (mult - 1)).toFixed(3));
              target.subtotal = Number((target.quantity * Number(target.price || 0)).toFixed(2));
            }
            this.setMultiplier(1);
            if (window.App.recalcCart) window.App.recalcCart();
            if (window.App.renderPosView) window.App.renderPosView();
          }

          if (this.returnModeActive) {
            const items = this.getActiveCartItems();
            const target = items.find((i) => Number(i.product_id || i.id) === Number(productId));
            if (target && target.quantity > 0) {
              target.quantity = -Math.abs(target.quantity);
              target.is_return = true;
              target.subtotal = Number((target.quantity * Number(target.price || 0)).toFixed(2));
              if (window.App.recalcCart) window.App.recalcCart();
              if (window.App.renderPosView) window.App.renderPosView();
            }
          }

          this.refreshAllUpgrades();
          // تمرير تلقائي لآخر عنصر في السلة
          const cartBox = document.getElementById('posCartItems');
          if (cartBox) cartBox.scrollTop = cartBox.scrollHeight;
          return res;
        };
        window.App._gherbiHookedAddToCart = true;
      }

      // 2. اعتراض دوال التحديث لإعادة رسم التبويبات وشارات المخزون
      ['recalcCart', 'renderPosView', 'renderCart', 'switchView'].forEach((fn) => {
        if (typeof window.App[fn] === 'function' && !window.App['_gherbiHooked_' + fn]) {
          const origFn = window.App[fn].bind(window.App);
          window.App[fn] = (...args) => {
            const out = origFn(...args);
            this.refreshAllUpgrades();
            return out;
          };
          window.App['_gherbiHooked_' + fn] = true;
        }
      });

      this.refreshAllUpgrades();
    }, 200);

    // مراقب DOM احتياطي للسلة
    const obs = new MutationObserver(() => {
      this.enhanceCartRowsAndStockForecast();
      this.updateQuickChange();
    });
    const cartEl = document.getElementById('posCartItems');
    if (cartEl) obs.observe(cartEl, { childList: true });
  },

  refreshAllUpgrades() {
    this.renderEnhancedCartTabs();
    this.updateCustomerTriggerBar();
    this.enhanceCartRowsAndStockForecast();
    this.updateQuickChange();
    this.injectCostPriceAlertsIntoReports();
  },

  // ==========================================================================
  // الاختصارات العالمية (F6, F8, F9, F10, F12, Ctrl+N, Ctrl+X)
  // ==========================================================================
  bindGlobalKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const posSec = document.getElementById('view-pos');
      const isPosActive = posSec && posSec.classList.contains('active');
      if (!isPosActive) return;

      // F6: فاحص السعر الفوري
      if (e.key === 'F6') {
        e.preventDefault();
        this.openPriceCheckerModal();
        return;
      }

      // F8: فتح نافذة الزبون والوفاء والتركيز على خانة مسح البطاقة / البحث
      if (e.key === 'F8') {
        e.preventDefault();
        this.openSmartLoyaltyModal('scan');
        return;
      }

      // F9: فتح نافذة الزبون والوفاء والتركيز مباشرة على خانة اختزال النقاط
      if (e.key === 'F9') {
        e.preventDefault();
        this.openSmartLoyaltyModal('redeem');
        return;
      }

      // F10: إغلاق الوردية / إدارة الصندوق
      if (e.key === 'F10') {
        e.preventDefault();
        if (window.App && typeof window.App.openCloseShiftModal === 'function') {
          window.App.openCloseShiftModal();
        } else if (window.App && typeof window.App.switchView === 'function') {
          window.App.switchView('caisse');
        }
        return;
      }

      // F12: التركيز الفوري على سعر الوحدة لتعديله
      if (e.key === 'F12') {
        e.preventDefault();
        this.focusLastItemPriceWithF12();
        return;
      }

      // Ctrl + N: فتح سلة جديدة فوراً
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.createNewCartWithShortcut();
        return;
      }

      // Ctrl + X: تبديل مضاعف الكمية
      if (e.ctrlKey && e.key.toLowerCase() === 'x') {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          const steps = [1, 2, 3, 5, 10];
          const next = steps[(steps.indexOf(this.activeMultiplier) + 1) % steps.length];
          this.setMultiplier(next);
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.GherbiMasterUpgrade.init();
});
