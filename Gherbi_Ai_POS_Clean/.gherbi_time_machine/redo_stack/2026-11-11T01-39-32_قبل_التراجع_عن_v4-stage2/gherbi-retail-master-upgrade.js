/**
 * gherbi-retail-master-upgrade.js
 * المحرك الشامل للتعديلات الـ 12 لبيئة بيع التجزئة في نظام Gherbi.Ai POS
 */

'use strict';

(function initGherbiRetailMasterUpgrade() {
  const RetailMaster = {
    lastCompletedSale: JSON.parse(localStorage.getItem('gherbi_last_completed_sale') || 'null'),
    navLayoutMode: localStorage.getItem('gherbi_nav_layout_mode') || 'side', // 'side' | 'top'

    init() {
      const waitApp = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(waitApp);
        this.applyAllUpgrades();
      }, 180);
    },

    applyAllUpgrades() {
      this.applyNavLayoutMode(this.navLayoutMode);
      this.injectTopHeaderControls();
      this.buildSmartModalsDom();
      this.upgradeCustomerModalForRetail();
      this.upgradeSplitResizer();
      this.compactCartStructureAndLoyaltyBar();
      this.fixMultipliersAndReverseAmount();
      this.upgradeCartItemsWithLiveStockAndCostGuard();
      this.fixReturnModeEngine();
      this.hookCheckoutForLastSaleMemoryAndLoyalty();
      this.upgradeSalesHistoryAndOwnerCostReport();
      this.bindMasterKeyboardShortcuts();

      // إعادة الرندر لتطبيق التحسينات فوراً
      setTimeout(() => {
        if (window.App && typeof window.App.renderPosView === 'function') {
          window.App.renderPosView();
          window.App.renderCartTabs();
          window.App.renderCartItems();
        }
      }, 300);
    },

    // ========================================================================
    // 1. التحجيم الحر والديناميكي لشاشة المبيعات (Smooth Drag-to-Resize Split Pane)
    // ========================================================================
    upgradeSplitResizer() {
      const posLayout = document.querySelector('#view-pos .pos-layout') || document.getElementById('posMainGridContainer');
      if (!posLayout) return;
      posLayout.id = 'posMainGridContainer';

      let resizer = document.getElementById('posCartResizer');
      const children = Array.from(posLayout.children);
      const cartContainer = posLayout.querySelector('.cart-container') || document.getElementById('posCartContainer');

      if (!resizer && cartContainer) {
        resizer = document.createElement('div');
        resizer.id = 'posCartResizer';
        resizer.className = 'gherbi-splitter-handle';
        resizer.title = 'اسحب يميناً أو يساراً لتكبير وتصغير شاشة السلة (نقر مزدوج لإرجاع القياس المتوازن)';
        posLayout.insertBefore(resizer, cartContainer);
      } else if (resizer) {
        resizer.className = 'gherbi-splitter-handle';
        resizer.title = 'اسحب يميناً أو يساراً لتكبير وتصغير شاشة السلة (نقر مزدوج لإرجاع القياس المتوازن)';
      }

      // تجاوز الدالة المقيدة في renderer.js للسماح بتكبير النصف الأيسر حتى 68% من الشاشة
      window.App.applyCartWidthLayout = function (widthPx) {
        const grid = document.getElementById('posMainGridContainer') || document.querySelector('#view-pos .pos-layout');
        if (!grid) return;
        const rect = grid.getBoundingClientRect();
        const totalW = rect.width > 600 ? rect.width : (window.innerWidth - 80);
        const maxAllowedW = Math.max(480, Math.floor(totalW * 0.68));
        const minAllowedW = 340;
        const clampedW = Math.min(maxAllowedW, Math.max(minAllowedW, Math.round(Number(widthPx) || 470)));

        window.AppState.posCartWidth = clampedW;
        document.documentElement.style.setProperty('--gherbi-cart-width', clampedW + 'px');
        grid.style.gridTemplateColumns = `minmax(300px, 1fr) 10px ${clampedW}px`;
      };

      const savedWidth = parseInt(localStorage.getItem('gherbi_pos_cart_width') || window.AppState.posCartWidth || '470', 10);
      window.App.applyCartWidthLayout(savedWidth);

      if (resizer && resizer.dataset.masterResizerBound !== '1') {
        resizer.dataset.masterResizerBound = '1';
        let isDragging = false;
        let rafId = null;

        resizer.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          isDragging = true;
          document.body.classList.add('gherbi-resizing-active');
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        });

        resizer.addEventListener('dblclick', () => {
          window.App.applyCartWidthLayout(470);
          localStorage.setItem('gherbi_pos_cart_width', '470');
          if (window.api?.updateSettings) window.api.updateSettings({ pos_cart_width: '470' });
          if (window.showToast) window.showToast('تمت استعادة القياس القياسي المتوازن للسلة', 'info');
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            const grid = document.getElementById('posMainGridContainer') || document.querySelector('#view-pos .pos-layout');
            if (!grid) return;
            const rect = grid.getBoundingClientRect();
            const isRtl = document.documentElement.dir !== 'ltr';
            const desiredWidth = isRtl ? (e.clientX - rect.left) : (rect.right - e.clientX);
            window.App.applyCartWidthLayout(desiredWidth);
          });
        });

        window.addEventListener('mouseup', () => {
          if (!isDragging) return;
          isDragging = false;
          document.body.classList.remove('gherbi-resizing-active');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          const finalW = String(window.AppState.posCartWidth || 470);
          localStorage.setItem('gherbi_pos_cart_width', finalW);
          if (window.api?.updateSettings) window.api.updateSettings({ pos_cart_width: finalW });
        });
      }
    },

    // ========================================================================
    // 2 & 3 & 4. إعادة هندسة قمة السلة، شريط السلات (✕ و Ctrl+N)، الزر الذكي للوفاء (F8/F9)، وتعظيم مساحة المشتريات
    // ========================================================================
    compactCartStructureAndLoyaltyBar() {
      const cartContainer = document.getElementById('posCartContainer') || document.querySelector('#view-pos .cart-container');
      if (!cartContainer) return;
      cartContainer.id = 'posCartContainer';

      // إخفاء الصناديق القديمة المتفرقة الخاصة بالوفاء والسلات لتوفير مساحة رأسية كبيرة
      Array.from(cartContainer.children).forEach((child) => {
        if (
          child.id !== 'posCartItems' &&
          child.id !== 'posEditSaleBanner' &&
          child.id !== 'posQuickMultiplierBar' &&
          !child.querySelector('#cartTotalText')
        ) {
          // إذا كان يحتوي على posCustomerSelect أو multiCartTabs نخفيه بصرياً مع إبقائه في DOM لسلامة الكود الخلفي
          if (child.querySelector('#posCustomerSelect') || child.querySelector('#multiCartTabs') || child.id === 'posAlgerianMasterBar') {
            child.classList.add('gherbi-legacy-loyalty-hidden');
          }
        }
      });

      // إنشاء القمة المدمجة الجديدة للسلة (gherbiCartTopDeck)
      if (!document.getElementById('gherbiCartTopDeck')) {
        const topDeck = document.createElement('div');
        topDeck.id = 'gherbiCartTopDeck';
        topDeck.className = 'gherbi-cart-top-deck';
        topDeck.innerHTML = `
          <!-- شريط تنبيه وضع الإرجاع النشط (مخفي افتراضياً) -->
          <div id="gherbiReturnActiveBanner" class="gherbi-return-mode-banner rounded-lg hidden">
            <div class="flex items-center gap-1.5">
              <span>🔄 وضع إرجاع السلع للمخزون نشط</span>
              <button type="button" onclick="RetailMaster.openReturnFromInvoicePicker()" class="px-2 py-0.5 rounded bg-white text-rose-700 text-[10px] font-black">إرجاع من فاتورة سابقة</button>
            </div>
            <button type="button" onclick="App.toggleReturnMode()" class="px-2 py-0.5 rounded bg-black/25 hover:bg-black/40 text-white text-[10px]">إيقاف الإرجاع ✕</button>
          </div>

          <!-- السطر 1: تبويبات السلات (مع علامة ✕) + زر (+ سلة Ctrl+N) + زر (سجل) + أزرار الأدوات -->
          <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1" id="gherbiModernCartTabs"></div>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" onclick="App.newCartTab()" title="إنشاء سلة جديدة (اختصار: Ctrl + N)"
                class="px-2 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600 text-blue-600 hover:text-white text-[11px] font-black transition flex items-center gap-0.5">
                <span>+ سلة</span>
                <kbd class="text-[9px] font-mono opacity-75">Ctrl+N</kbd>
              </button>
              <button type="button" onclick="App.openPosRecentSalesModal()" title="سجل آخر المبيعات وتعديل الفواتير"
                class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-[11px] font-bold transition flex items-center gap-0.5">
                <span>🕒 سجل</span>
              </button>
              <button type="button" onclick="App.openMobileCompanionModal()" title="ربط الهاتف المحمول"
                class="px-1.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[11px] font-bold transition">
                📱
              </button>
            </div>
          </div>

          <!-- السطر 2: الزر الشريطي الذكي الموحد للزبون وبطاقة الوفاء وخصم النقاط (F8 / F9) -->
          <div class="flex items-center gap-1">
            <div id="gherbiSmartLoyaltyBtn" onclick="RetailMaster.openSmartLoyaltyModal('scan')" class="gherbi-smart-loyalty-trigger flex-1" title="اضغط أو F8 لمسح بطاقة الوفاء أو اختيار الزبون | اضغط F9 لاختزال النقاط">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-base leading-none">👑</span>
                <span id="gherbiSmartCustName" class="truncate font-black text-slate-800 dark:text-slate-100">زبون عابر (بدون بطاقة)</span>
                <span id="gherbiSmartCustPointsBadge" class="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono text-[10px] font-black hidden">0 نقطة</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[9.5px] font-black">F8 البطاقة/الزبون</span>
                <span onclick="event.stopPropagation(); RetailMaster.openSmartLoyaltyModal('redeem')" class="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[9.5px] font-black hover:bg-emerald-500">F9 خصم نقاط</span>
              </div>
            </div>
            <button type="button" onclick="App.openCustomerModal(null)" title="إضافة زبون جديد للمحل"
              class="p-1.5 rounded-lg bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600 hover:text-white transition shrink-0">
              <span class="material-symbols-rounded icon-sm">person_add</span>
            </button>
          </div>
        `;

        // شريط ذاكرة آخر فاتورة والباقي للزبون
        const memBar = document.createElement('div');
        memBar.id = 'gherbiLastSaleMemoryBar';
        memBar.className = 'gherbi-last-sale-memory-bar hidden';

        cartContainer.insertBefore(memBar, cartContainer.firstChild);
        cartContainer.insertBefore(topDeck, memBar);
      }

      this.renderLastSaleMemoryBar();

      // ترقية دالة renderCartTabs لدعم زر الحذف (✕) وتحديث الزر الذكي للزبون
      window.App.renderCartTabs = function () {
        const modernBox = document.getElementById('gherbiModernCartTabs');
        const legacyBox = document.getElementById('multiCartTabs');
        const carts = window.AppState.carts || [];
        const activeIdx = window.AppState.activeCartIndex || 0;

        if (modernBox) {
          modernBox.innerHTML = carts.map((c, idx) => {
            const isActive = idx === activeIdx;
            const count = (c.items || []).length;
            return `
              <div onclick="App.switchCartTab(${idx})" class="gherbi-cart-tab-pill ${isActive ? 'active' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">
                <span>${c.label} (${count})</span>
                <span onclick="App.closeCartTab(${idx}, event)" class="gherbi-cart-tab-close" title="إغلاق وحذف هذه السلة">✕</span>
              </div>
            `;
          }).join('');
        }

        if (legacyBox) {
          legacyBox.innerHTML = carts.map((c, idx) => `<button onclick="App.switchCartTab(${idx})">${c.label}</button>`).join('');
        }

        const badge = document.getElementById('draftsCountBadge');
        if (badge) badge.textContent = (window.AppState.draftCarts || []).length;

        RetailMaster.syncSmartLoyaltyButtonDisplay();
      };

      window.App.closeCartTab = function (idx, event) {
        if (event) event.stopPropagation();
        const carts = window.AppState.carts || [];
        const target = carts[idx];
        if (!target) return;

        if (target.items && target.items.length > 0) {
          if (!confirm(`السلة (${target.label}) تحتوي على ${target.items.length} أصناف. هل تريد حذفها وإغلاقها؟`)) {
            return;
          }
        }

        if (carts.length <= 1) {
          window.App.clearCurrentCart();
          return;
        }

        carts.splice(idx, 1);
        carts.forEach((c, i) => {
          c.label = `سلة #${i + 1}`;
        });
        if (window.AppState.activeCartIndex >= carts.length) {
          window.AppState.activeCartIndex = carts.length - 1;
        }
        window.App.renderPosView();
      };

      // ضغط تذييل السلة (المجموع الفرعي + الكوبون + التخفيض) لتوفير أقصى مساحة لمستطيل المشتريات
      const footer = document.querySelector('#posCartContainer > div:last-child');
      if (footer && !footer.dataset.compactedRetail) {
        footer.dataset.compactedRetail = '1';
        footer.style.padding = '0.45rem 0.65rem';
        footer.classList.remove('space-y-3', 'space-y-2.5');
        footer.classList.add('space-y-1');
      }
    },

    syncSmartLoyaltyButtonDisplay() {
      const cart = window.App?.currentCart;
      const nameEl = document.getElementById('gherbiSmartCustName');
      const ptsBadge = document.getElementById('gherbiSmartCustPointsBadge');
      if (!nameEl || !ptsBadge) return;

      const cid = cart ? cart.customerId : '';
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));

      if (cust) {
        const pts = Number(cust.loyalty_points || 0);
        const dzdVal = (pts * 2).toFixed(0); // أو حسب معامل النقاط
        nameEl.textContent = `${cust.name} (FID-${String(cust.id).padStart(5, '0')})`;
        ptsBadge.textContent = `⭐ ${pts} نقطة (${dzdVal} د.ج)`;
        ptsBadge.classList.remove('hidden');
      } else {
        nameEl.textContent = 'زبون عابر (اضغط أو F8 لبطاقة الوفاء)';
        ptsBadge.classList.add('hidden');
      }
    },

    // ========================================================================
    // 3 (تتمة). نافذة الزبون والوفاء الذكية (F8 المسح والبحث / F9 اختزال النقاط) + نافذة فاحص السعر (F6)
    // ========================================================================
    buildSmartModalsDom() {
      if (!document.getElementById('smartLoyaltyCustomerModal')) {
        const modal = document.createElement('div');
        modal.id = 'smartLoyaltyCustomerModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="modal-content w-full max-w-2xl p-5 space-y-4 overflow-y-auto text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">👑</span>
                <div>
                  <h3 class="text-base font-black">بطاقة الوفاء، اختيار الزبون، واختزال النقاط (F8 / F9)</h3>
                  <p class="text-[11px] text-slate-400">مرر بطاقة الوفاء مباشرة (F8) أو ابحث بالاسم/الهاتف، واضغط (F9) لخصم النقاط بالدينار</p>
                </div>
              </div>
              <button type="button" onclick="App.closeModal('smartLoyaltyCustomerModal'); App.focusBarcodeMagnet?.(false);" class="text-slate-400 hover:text-rose-500">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>

            <!-- 1. خانة مسح باركود بطاقة الوفاء المباشر (F8 Auto-Focus) -->
            <div class="p-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-2">
              <div class="flex items-center justify-between">
                <label class="font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-[10px]">F8</span>
                  <span>1. مسح باركود بطاقة الوفاء (FID-...) أو البحث الفوري:</span>
                </label>
                <div class="flex items-center gap-1.5">
                  <button type="button" onclick="RetailMaster.selectWalkInCustomer()" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold hover:bg-slate-300">👤 زبون عابر</button>
                  <button type="button" onclick="App.closeModal('smartLoyaltyCustomerModal'); App.openCustomerModal(null);" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold">+ زبون جديد</button>
                </div>
              </div>

              <div class="flex gap-2">
                <input id="smartLoyaltyScanOrSearchInput" type="text"
                  oninput="RetailMaster.onSmartLoyaltySearch(this.value)"
                  onkeydown="RetailMaster.onSmartLoyaltyInputKeydown(event)"
                  placeholder="مرر قارئ الباركود على بطاقة الوفاء (FID-...) أو اكتب اسم/هاتف الزبون..."
                  class="flex-1 px-3 py-2 rounded-xl font-bold text-sm border-2 border-amber-500">
                <button type="button" onclick="RetailMaster.toggleAllCustomersList()" class="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-black whitespace-nowrap">
                  📋 كل الزبائن
                </button>
              </div>

              <!-- قائمة الزبائن المطابقة -->
              <div id="smartLoyaltyCustomersListBox" class="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800"></div>
            </div>

            <!-- 2. بطاقة الزبون المحدد واختزال النقاط الفوري (F9) -->
            <div id="smartSelectedCustCard" class="p-3.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/35 space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                <div>
                  <span class="text-slate-400 font-bold">الزبون المحدد:</span>
                  <strong id="smartModalCustTitle" class="text-sm font-black mr-1">زبون عابر</strong>
                  <span id="smartModalCustCode" class="font-mono text-[11px] text-amber-600 font-bold"></span>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-left">
                    <span class="text-slate-400">رصيد النقاط:</span>
                    <strong id="smartModalAvailablePoints" class="font-mono text-base font-black text-amber-500 mr-1">0 نقطة</strong>
                  </div>
                  <div class="text-left">
                    <span class="text-slate-400">قيمتها المالية:</span>
                    <strong id="smartModalTotalPointsDzd" class="font-mono text-base font-black text-emerald-600 mr-1">0.00 د.ج</strong>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                <div class="md:col-span-5">
                  <label class="block font-black text-emerald-700 dark:text-emerald-300 mb-1">
                    <span class="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] ml-1">F9</span>
                    <span>عدد النقاط المراد اختزالها:</span>
                  </label>
                  <input id="smartRedeemPointsInput" type="number" step="1" min="0" value="0"
                    oninput="RetailMaster.updateRedeemPreview()"
                    onkeydown="if(event.key==='Enter'){ event.preventDefault(); RetailMaster.confirmSmartLoyaltyModal(); }"
                    class="w-full px-3 py-2 rounded-xl font-mono font-black text-base text-center border-2 border-emerald-500">
                </div>

                <div class="md:col-span-4 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 text-center">
                  <div class="text-[10px] text-slate-400 font-bold">قيمة الخصم المباشر بالدينار:</div>
                  <div id="smartRedeemDzdEquivalent" class="font-mono font-black text-lg text-emerald-600">0.00 د.ج</div>
                  <div id="smartRedeemCentimesEquivalent" class="text-[10px] font-bold text-amber-600">0 سنتيم</div>
                </div>

                <div class="md:col-span-3 flex flex-col gap-1.5">
                  <button type="button" onclick="RetailMaster.setRedeemAllPoints()"
                    class="w-full py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm">
                    🎁 اختزال كل النقاط
                  </button>
                  <button type="button" onclick="RetailMaster.setRedeemHalfPoints()"
                    class="w-full py-1.5 px-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-[11px]">
                    نصف النقاط (50%)
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <span class="text-[11px] text-slate-400 font-bold">💡 اضغط Enter أو زر (OK تأكيد) لحفظ الزبون وتطبيق خصم النقاط فوراً</span>
              <div class="flex items-center gap-2">
                <button type="button" onclick="App.closeModal('smartLoyaltyCustomerModal'); App.focusBarcodeMagnet?.(false);" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
                <button type="button" onclick="RetailMaster.confirmSmartLoyaltyModal()" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow-lg shadow-blue-600/25">
                  ✔ OK — تأكيد وتطبيق (Enter)
                </button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      // نافذة فاحص السعر الفوري (F6)
      if (!document.getElementById('posPriceCheckerModal')) {
        const pcModal = document.createElement('div');
        pcModal.id = 'posPriceCheckerModal';
        pcModal.className = 'modal-overlay';
        pcModal.innerHTML = `
          <div class="modal-content w-full max-w-lg p-5 space-y-4 text-xs">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <h3 class="text-base font-black text-indigo-600 flex items-center gap-1.5">
                <span class="material-symbols-rounded">manage_search</span>
                <span>فاحص السعر والمخزون الفوري (F6)</span>
              </h3>
              <button type="button" onclick="App.closeModal('posPriceCheckerModal'); App.focusBarcodeMagnet?.(false);" class="text-slate-400 hover:text-rose-500">✕</button>
            </div>
            <input id="priceCheckerScanInput" type="text"
              oninput="RetailMaster.onPriceCheckerInput(this.value)"
              onkeydown="if(event.key==='Enter') RetailMaster.onPriceCheckerInput(this.value, true)"
              placeholder="امسح الباركود أو اكتب اسم السلعة لفحص سعرها..."
              class="w-full px-3.5 py-2.5 rounded-xl font-bold text-sm border-2 border-indigo-500">
            <div id="priceCheckerResultCard" class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center space-y-2">
              <div class="text-slate-400 font-bold py-6">امسح باركود أي سلعة لعرض سعرها بالدينار والسنتيم والكمية المتوفرة</div>
            </div>
          </div>
        `;
        document.body.appendChild(pcModal);
      }
    },

    getPointDzdValue() {
      // افتراضياً كل 1 نقطة = 2 د.ج (أو حسب إعدادات المتجر)
      const customRate = parseFloat(window.AppState?.settings?.loyalty_point_value_dzd || '2');
      return Number.isFinite(customRate) && customRate > 0 ? customRate : 2;
    },

    openSmartLoyaltyModal(focusMode = 'scan') {
      this.buildSmartModalsDom();
      window.App.openModal('smartLoyaltyCustomerModal');
      const scanInp = document.getElementById('smartLoyaltyScanOrSearchInput');
      if (scanInp) scanInp.value = '';
      this.renderSmartLoyaltyCustomersList('');
      this.refreshSmartModalSelectedCustomer();

      setTimeout(() => {
        if (focusMode === 'redeem') {
          const redInp = document.getElementById('smartRedeemPointsInput');
          if (redInp) {
            redInp.focus();
            redInp.select();
          }
        } else if (scanInp) {
          scanInp.focus();
          scanInp.select();
        }
      }, 60);
    },

    onSmartLoyaltySearch(val) {
      const clean = String(val || '').trim();
      // إذا مسح بطاقة وفاء بصيغة FID-00003 أو كود مباشر
      const fidMatch = clean.match(/^FID-0*(d+)$/i);
      if (fidMatch) {
        const cid = Number(fidMatch[1]);
        const found = (window.AppState.customers || []).find((c) => Number(c.id) === cid);
        if (found) {
          this.pickCustomerInSmartModal(found.id);
        }
      }
      this.renderSmartLoyaltyCustomersList(clean);
    },

    onSmartLoyaltyInputKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        const val = String(event.target.value || '').trim();
        const fidMatch = val.match(/^FID-0*(d+)$/i);
        let found = null;
        if (fidMatch) {
          found = (window.AppState.customers || []).find((c) => Number(c.id) === Number(fidMatch[1]));
        } else if (val) {
          const q = val.toLowerCase();
          found = (window.AppState.customers || []).find(
            (c) =>
              String(c.phone || '').includes(q) ||
              String(c.barcode || '').toLowerCase() === q ||
              String(c.name || '').toLowerCase().includes(q)
          );
        }
        if (found) {
          this.pickCustomerInSmartModal(found.id);
          if (window.showToast) window.showToast(`👑 تم اختيار الزبون: ${found.name}`, 'success');
          // إذا لم يكن يريد اختزال نقاط، نغلق النافذة مباشرة أو ننقل المؤشر لخانة الاختزال
          const redInp = document.getElementById('smartRedeemPointsInput');
          if (redInp && Number(found.loyalty_points || 0) > 0) {
            redInp.focus();
            redInp.select();
          } else {
            this.confirmSmartLoyaltyModal();
          }
        }
      } else if (event.key === 'F9') {
        event.preventDefault();
        const redInp = document.getElementById('smartRedeemPointsInput');
        if (redInp) {
          redInp.focus();
          redInp.select();
        }
      }
    },

    toggleAllCustomersList() {
      const inp = document.getElementById('smartLoyaltyScanOrSearchInput');
      if (inp) inp.value = '';
      this.renderSmartLoyaltyCustomersList('');
    },

    renderSmartLoyaltyCustomersList(query = '') {
      const box = document.getElementById('smartLoyaltyCustomersListBox');
      if (!box) return;
      const q = String(query || '').trim().toLowerCase();
      const customers = window.AppState.customers || [];
      const curCid = Number(window.App?.currentCart?.customerId || 0);

      const filtered = customers.filter((c) => {
        if (!q) return true;
        const fid = 'fid-' + String(c.id).padStart(5, '0');
        return (
          String(c.name || '').toLowerCase().includes(q) ||
          String(c.phone || '').toLowerCase().includes(q) ||
          fid.includes(q) ||
          String(c.id) === q
        );
      });

      if (filtered.length === 0) {
        box.innerHTML = '<div class="py-4 text-center text-slate-400 font-bold">لا يوجد زبون مطابق — اضغط (+ زبون جديد) لإضافته</div>';
        return;
      }

      box.innerHTML = filtered.slice(0, 60).map((c) => {
        const isSelected = Number(c.id) === curCid;
        const pts = Number(c.loyalty_points || 0);
        const fidCode = 'FID-' + String(c.id).padStart(5, '0');
        return `
          <div onclick="RetailMaster.pickCustomerInSmartModal(${c.id})"
            class="p-2.5 flex items-center justify-between cursor-pointer hover:bg-blue-600/10 transition ${isSelected ? 'bg-blue-600/15 font-black' : ''}">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono text-[10px] font-bold">${fidCode}</span>
              <span class="font-bold">${c.name}</span>
              ${c.phone ? `<span class="text-slate-400 font-mono text-[11px]">(${c.phone})</span>` : ''}
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-mono font-bold text-[11px]">⭐ ${pts} نقطة</span>
              ${Number(c.total_debt || 0) > 0 ? `<span class="text-rose-500 font-mono text-[11px]">دين: ${Number(c.total_debt).toFixed(0)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
    },

    pickCustomerInSmartModal(customerId) {
      if (!window.App) return;
      const cid = customerId ? Number(customerId) : '';
      window.App.currentCart.customerId = cid;
      const sel = document.getElementById('posCustomerSelect');
      if (sel) {
        sel.value = String(cid);
        sel.dispatchEvent(new Event('change'));
      }
      this.refreshSmartModalSelectedCustomer();
      this.renderSmartLoyaltyCustomersList(document.getElementById('smartLoyaltyScanOrSearchInput')?.value || '');
      this.syncSmartLoyaltyButtonDisplay();
    },

    selectWalkInCustomer() {
      this.pickCustomerInSmartModal('');
      document.getElementById('smartRedeemPointsInput').value = '0';
      this.updateRedeemPreview();
    },

    refreshSmartModalSelectedCustomer() {
      const cid = window.App?.currentCart?.customerId;
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));
      const rate = this.getPointDzdValue();

      const titleEl = document.getElementById('smartModalCustTitle');
      const codeEl = document.getElementById('smartModalCustCode');
      const ptsEl = document.getElementById('smartModalAvailablePoints');
      const dzdEl = document.getElementById('smartModalTotalPointsDzd');
      const redInp = document.getElementById('smartRedeemPointsInput');

      if (cust) {
        const pts = Math.max(0, Number(cust.loyalty_points || 0));
        const dzd = Number((pts * rate).toFixed(2));
        if (titleEl) titleEl.textContent = cust.name;
        if (codeEl) codeEl.textContent = `(FID-${String(cust.id).padStart(5, '0')})`;
        if (ptsEl) ptsEl.textContent = `${pts} نقطة`;
        if (dzdEl) dzdEl.textContent = `${dzd.toFixed(2)} د.ج`;
        if (redInp) {
          redInp.max = String(pts);
          redInp.value = String(window.App.currentCart._redeemedPoints || 0);
        }
      } else {
        if (titleEl) titleEl.textContent = 'زبون عابر (بدون بطاقة وفاء)';
        if (codeEl) codeEl.textContent = '';
        if (ptsEl) ptsEl.textContent = '0 نقطة';
        if (dzdEl) dzdEl.textContent = '0.00 د.ج';
        if (redInp) {
          redInp.max = '0';
          redInp.value = '0';
        }
      }
      this.updateRedeemPreview();
    },

    updateRedeemPreview() {
      const cid = window.App?.currentCart?.customerId;
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));
      const maxPts = cust ? Math.max(0, Number(cust.loyalty_points || 0)) : 0;
      const rate = this.getPointDzdValue();

      const redInp = document.getElementById('smartRedeemPointsInput');
      let pts = Math.max(0, parseFloat(redInp?.value || '0') || 0);
      if (pts > maxPts) {
        pts = maxPts;
        if (redInp) redInp.value = String(pts);
      }

      const dzdDiscount = Number((pts * rate).toFixed(2));
      const eqEl = document.getElementById('smartRedeemDzdEquivalent');
      const centEl = document.getElementById('smartRedeemCentimesEquivalent');
      if (eqEl) eqEl.textContent = `${dzdDiscount.toFixed(2)} د.ج`;
      if (centEl && window.App?.formatAlgerianCentimes) {
        centEl.textContent = window.App.formatAlgerianCentimes(dzdDiscount);
      }
    },

    setRedeemAllPoints() {
      const cid = window.App?.currentCart?.customerId;
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));
      if (!cust) return;
      const pts = Math.max(0, Number(cust.loyalty_points || 0));
      const redInp = document.getElementById('smartRedeemPointsInput');
      if (redInp) redInp.value = String(pts);
      this.updateRedeemPreview();
    },

    setRedeemHalfPoints() {
      const cid = window.App?.currentCart?.customerId;
      const cust = (window.AppState.customers || []).find((c) => Number(c.id) === Number(cid));
      if (!cust) return;
      const pts = Math.floor(Math.max(0, Number(cust.loyalty_points || 0)) / 2);
      const redInp = document.getElementById('smartRedeemPointsInput');
      if (redInp) redInp.value = String(pts);
      this.updateRedeemPreview();
    },

    confirmSmartLoyaltyModal() {
      const cart = window.App?.currentCart;
      if (!cart) return;
      const pts = Math.max(0, parseFloat(document.getElementById('smartRedeemPointsInput')?.value || '0') || 0);
      const rate = this.getPointDzdValue();
      const dzdDiscount = Number((pts * rate).toFixed(2));

      cart._redeemedPoints = pts;
      if (pts > 0) {
        cart.discount = dzdDiscount;
        const discInput = document.getElementById('cartDiscountInput');
        if (discInput) discInput.value = String(dzdDiscount);
        if (window.showToast) {
          window.showToast(`🎁 تم تطبيق خصم نقاط الوفاء: -${dzdDiscount.toFixed(2)} د.ج (${pts} نقطة)`, 'success');
        }
      }

      window.App.closeModal('smartLoyaltyCustomerModal');
      window.App.recalcAndRenderCart();
      this.syncSmartLoyaltyButtonDisplay();
      if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
    },

    // ========================================================================
    // 5 & 7. إصلاح تعديل السعر (F12 + Enter/OK) + درع الحماية من البيع بالتكلفة أو بخسارة + عداد المخزون الحي والكمية المتبقية
    // ========================================================================
    upgradeCartItemsWithLiveStockAndCostGuard() {
      // تعريف دوال تحديث السعر والكمية المفقودة في renderer.js مع درع حماية رأس المال
      window.App.updateCartItemQty = function (idx, rawVal) {
        const items = window.App.currentCart?.items || [];
        const item = items[idx];
        if (!item) return;
        const newQty = parseFloat(rawVal);
        if (!Number.isFinite(newQty) || (newQty === 0 && !window.AppState.isReturnMode)) {
          window.App.renderCartItems();
          return;
        }
        item.quantity = Number(newQty.toFixed(3));
        item.subtotal = Number((item.quantity * Number(item.price || 0)).toFixed(2));
        window.App.recalcAndRenderCart();
      };

      window.App.updateCartItemPrice = async function (idx, rawVal) {
        const items = window.App.currentCart?.items || [];
        const item = items[idx];
        if (!item) return;
        const newPrice = parseFloat(rawVal);
        if (!Number.isFinite(newPrice) || newPrice < 0) {
          window.App.renderCartItems();
          return;
        }

        const prod = (window.AppState.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );
        const costPrice = Number(item.cost_price || (prod && prod.cost_price) || 0);

        item.price = Number(newPrice.toFixed(2));
        item.subtotal = Number((Number(item.quantity || 1) * item.price).toFixed(2));

        // فحص إذا كان السعر المدخل يساوي أو يقل عن سعر الشراء (Cost-Price Guardrail)
        if (costPrice > 0 && item.price <= costPrice) {
          const isEqual = Math.abs(item.price - costPrice) < 0.01;
          const warnMsg = isEqual
            ? `⚠️ تحذير: السعر المدخل (${item.price.toFixed(2)} د.ج) يساوي سعر الشراء للمحل (${costPrice.toFixed(2)} د.ج) — الربح 0!`
            : `🚨 تحذير خسارة: السعر المدخل (${item.price.toFixed(2)} د.ج) أقل من سعر الشراء (${costPrice.toFixed(2)} د.ج)!`;

          if (window.showToast) window.showToast(warnMsg, 'error');

          // تسجيل فوري في سجل الرقابة ليراه صاحب المحل في التقارير
          if (window.api?.addAuditLog) {
            await window.api.addAuditLog({
              user_id: window.AppState.currentUser?.id || 1,
              user_name: window.AppState.currentUser?.name || 'Cashier',
              action_type: 'SALE_AT_OR_BELOW_COST',
              target_type: 'product',
              target_id: item.product_id || null,
              severity: 'danger',
              details: {
                product_name: item.name,
                cost_price: costPrice,
                sold_price: item.price,
                loss_per_unit: Number((costPrice - item.price).toFixed(2)),
                quantity: item.quantity,
                timestamp: new Date().toISOString()
              }
            }).catch(() => {});
          }
        }

        window.App.recalcAndRenderCart();
      };

      // ربط زر OK في نافذة الأرقام اللمسية (#numberInputModal) ليمر عبر updateCartItemPrice ويفحص التكلفة
      window.App.confirmNumpadModal = async function () {
        const idx = window.AppState._activeNumpadCartIdx ?? Number(document.getElementById('numModalCartIndex')?.value || 0);
        const item = window.App.currentCart?.items?.[idx];
        if (!item) {
          window.App.closeModal('numberInputModal');
          return;
        }
        const newQty = parseFloat(document.getElementById('numModalInput')?.value);
        const newPrice = parseFloat(document.getElementById('numModalPriceInput')?.value);
        window.App.closeModal('numberInputModal');

        if (Number.isFinite(newQty) && newQty !== 0) {
          window.App.updateCartItemQty(idx, newQty);
        }
        if (Number.isFinite(newPrice) && newPrice >= 0) {
          await window.App.updateCartItemPrice(idx, newPrice);
        }
        if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
      };
      window.App.confirmNumberInputModal = window.App.confirmNumpadModal;

      // ترقية رسم عناصر السلة (renderCartItems) لإظهار:
      // 1) الكمية المتوفرة حالياً + كم سيبقى بعد البيع (المخزون: X ⬅ يبقى: Y)
      // 2) تحذير البيع بسعر التكلفة أو أقل
      window.App.renderCartItems = function () {
        const container = document.getElementById('posCartItems');
        if (!container) return;
        const items = (window.App.currentCart && window.App.currentCart.items) || [];

        const countEl = document.getElementById('cartItemsCountText');
        if (countEl) countEl.textContent = String(items.length);

        if (items.length === 0) {
          window.AppState.selectedCartRowIdx = 0;
          container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-slate-400 py-8">
              <span class="material-symbols-rounded icon-xl mb-1 opacity-40">shopping_basket</span>
              <div class="text-xs font-bold">السلة فارغة — امسح الباركود (F5) أو ابحث بالاسم (F4)</div>
              <div class="text-[10px] text-slate-400 mt-1 font-mono text-center">
                [F5] باركود | [F4] بحث | [F8] بطاقة وفاء | [F9] خصم نقاط | [F12] السعر | [Échap] تذكرة 80mm
              </div>
            </div>`;
          if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
          return;
        }

        if (window.AppState.selectedCartRowIdx >= items.length || window.AppState.selectedCartRowIdx < 0) {
          window.AppState.selectedCartRowIdx = items.length - 1;
        }

        container.innerHTML = items.map((item, idx) => {
          const prod = (window.AppState.products || []).find(
            (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
          );
          if (prod && !item.product_id) item.product_id = prod.id;

          const cost = Number(item.cost_price || (prod && prod.cost_price) || 0);
          const isAtOrBelowCost = cost > 0 && Number(item.price) <= cost;
          const isSelected = idx === window.AppState.selectedCartRowIdx;

          // حساب المخزون المتوفر حالياً والكمية المتبقية بعد هذه البيعة
          let stockBadgeHtml = '';
          if (prod) {
            const currentStock = Number(prod.total_stock ?? prod.stock ?? 0);
            const remainingAfterSale = Number((currentStock - Number(item.quantity || 0)).toFixed(2));
            const minStk = Number(prod.min_stock ?? 5);
            const unitLbl = item.unit || prod.unit || 'قطعة';

            const badgeColor =
              remainingAfterSale <= 0
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                : remainingAfterSale <= minStk
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

            stockBadgeHtml = `
              <span class="px-1.5 py-0.5 rounded border font-mono font-black text-[10px] ${badgeColor}" title="الكمية في المخزن حالياً والكمية التي ستبقى بعد بيع هذا السطر">
                📦 متوفر: ${currentStock} ⬅ يبقى: ${remainingAfterSale} ${unitLbl}
              </span>
            `;
          }

          return `
            <div onclick="AppState.selectedCartRowIdx=${idx};"
              class="p-2 rounded-xl border ${isAtOrBelowCost ? 'cart-row-below-cost' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90'} ${isSelected ? 'cart-row-selected' : ''} flex items-center justify-between gap-1.5 shadow-sm transition">
              
              <div class="min-w-0 flex-1">
                <div class="font-bold text-xs truncate">${item.name || item.custom_product_name || 'منتج'}</div>
                <div class="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>${Number(item.price || 0).toFixed(2)} د.ج / ${item.unit || (prod && prod.unit) || 'قطعة'}</span>
                  ${stockBadgeHtml}
                  ${
                    prod
                      ? `<button type="button" onclick="App.toggleCartItemWholesaleUnit(${idx}); App.focusBarcodeMagnet?.(false);" class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 font-sans font-bold hover:bg-indigo-600 hover:text-white transition">${item._isWholesaleMode ? '📦 جملة' : 'وحدة / تسعيرة'}</button>`
                      : ''
                  }
                  ${
                    isAtOrBelowCost
                      ? `<span class="px-1.5 py-0.5 rounded bg-rose-600 text-white font-sans font-black text-[9.5px] animate-pulse">⚠️ ${Math.abs(item.price - cost) < 0.01 ? 'بسعر التكلفة' : 'أقل من التكلفة'} (الشراء: ${cost.toFixed(2)})</span>`
                      : ''
                  }
                </div>
              </div>

              <div class="flex items-center gap-1">
                <button type="button" title="إنقاص الكمية (-)"
                  onclick="AppState.selectedCartRowIdx=${idx}; App.stepCartItemQty(${idx}, -1); App.focusBarcodeMagnet?.(false);"
                  class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white font-mono font-black text-xs">-</button>
                <input id="cartItemQtyInput-${idx}" type="number" step="any" value="${item.quantity}"
                  onkeydown="App.onCartQtyInputKeydown(event, ${idx}, this)"
                  onchange="App.updateCartItemQty(${idx}, this.value); App.focusBarcodeMagnet?.(false);"
                  class="w-11 px-1 py-1 rounded-lg text-center font-mono font-black text-xs">
                <button type="button" title="زيادة الكمية (+)"
                  onclick="AppState.selectedCartRowIdx=${idx}; App.stepCartItemQty(${idx}, 1); App.focusBarcodeMagnet?.(false);"
                  class="w-6 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white font-mono font-black text-xs">+</button>
              </div>

              <input id="cartItemPriceInput-${idx}" type="number" step="any" value="${Number(item.price || 0).toFixed(2)}"
                onkeydown="App.onCartPriceInputKeydown(event, ${idx}, this)"
                onchange="App.updateCartItemPrice(${idx}, this.value); App.focusBarcodeMagnet?.(false);"
                title="سعر الوحدة (اضغط F12 للتعديل ثم Enter للتأكيد)"
                class="cart-price-input w-16 px-1 py-1 rounded-lg text-center font-mono font-bold text-xs text-blue-600 dark:text-blue-400">

              <div class="w-14 text-left font-mono font-black text-xs">${Number(item.subtotal || 0).toFixed(2)}</div>

              <button type="button" title="حذف الصنف (Delete)"
                onclick="App.removeCartItem(${idx}); App.focusBarcodeMagnet?.(false);"
                class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg">
                <span class="material-symbols-rounded icon-sm">delete</span>
              </button>
            </div>
          `;
        }).join('');

        if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(container);
      };
    },

    // ========================================================================
    // 6. إصلاح أزرار مضاعف الكمية (1x, 2x, 3x, 5x, 10x) والبيع بمبلغ (د.ج)
    // ========================================================================
    fixMultipliersAndReverseAmount() {
      window.App.setQuickMultiplier = function (m) {
        const multVal = Math.max(1, Number(m) || 1);
        window.AppState._quickMultiplier = multVal;

        // تحديث مظهر الأزرار في جميع أشرطة المضاعفات
        document.querySelectorAll('[data-mult], .mult-pill').forEach((btn) => {
          const val = Number(btn.getAttribute('data-mult') || btn.textContent.replace(/[^d]/g, ''));
          const isAct = val === multVal;
          btn.className = `mult-pill px-2.5 py-0.5 rounded-md font-mono font-black text-xs transition ${
            isAct ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`;
        });

        if (multVal > 1 && window.showToast) {
          window.showToast(`✖️ تم تفعيل مضاعف الكمية (×${multVal}) للصنف القادم أو اضغط مرتين لتطبيقه على السطر الحالي`, 'info');
        }
        if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
      };

      // ربط النقر المزدوج على زر المضاعف ليضرب كمية السطر المحدد حالياً في السلة فوراً!
      document.addEventListener('dblclick', (e) => {
        const btn = e.target.closest('[data-mult], .mult-pill');
        if (!btn) return;
        const multVal = Math.max(1, Number(btn.getAttribute('data-mult') || btn.textContent.replace(/[^d]/g, '')) || 1);
        const items = window.App?.currentCart?.items || [];
        if (items.length > 0) {
          const idx = window.AppState.selectedCartRowIdx ?? (items.length - 1);
          if (items[idx]) {
            items[idx].quantity = multVal;
            items[idx].subtotal = Number((multVal * Number(items[idx].price || 0)).toFixed(2));
            window.App.setQuickMultiplier(1);
            window.App.recalcAndRenderCart();
            if (window.showToast) window.showToast(`✅ تم ضبط كمية "${items[idx].name}" إلى ×${multVal}`, 'success');
          }
        }
      });
    },

    // ========================================================================
    // 8. تبسيط وتخصيص نافذة الزبون لتناسب "بيع التجزئة" (Retail Customer Modal)
    // ========================================================================
    upgradeCustomerModalForRetail() {
      const custModal = document.getElementById('customerModal');
      if (!custModal || custModal.dataset.retailUpgraded === '1') return;
      custModal.dataset.retailUpgraded = '1';

      // إضافة خانة باركود بطاقة الوفاء (FID) وطي حقول الجملة (RC / NIF / AI / NIS / CCP) في قسم اختياري
      const rcInput = document.getElementById('custRcInput');
      if (rcInput) {
        const wholesaleSection = document.createElement('details');
        wholesaleSection.className = 'col-span-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50/60 dark:bg-slate-900/50 text-xs mt-1';
        wholesaleSection.innerHTML = `
          <summary class="font-black text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            🏢 + بيانات المؤسسات والجملة والحساب البريدي (RC / NIF / NIS / CCP) — اختياري
          </summary>
          <div id="retailCollapsedWholesaleFields" class="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 mt-2 border-t border-slate-200 dark:border-slate-700"></div>
        `;

        const containerGrid = rcInput.closest('.grid') || rcInput.parentElement.parentElement;
        if (containerGrid) {
          containerGrid.appendChild(wholesaleSection);
          const targetBox = wholesaleSection.querySelector('#retailCollapsedWholesaleFields');
          ['custRcInput', 'custNifInput', 'custAiInput', 'custNisInput'].forEach((id) => {
            const el = document.getElementById(id);
            if (el && el.parentElement) {
              targetBox.appendChild(el.parentElement);
            }
          });
        }
      }
    },

    // ========================================================================
    // 9 & 10. تحويل القائمة الجانبية إلى شريط علوي + تخصيص F10 لإغلاق الوردية و F6 لفاحص السعر
    // ========================================================================
    injectTopHeaderControls() {
      const headerRight = document.querySelector('#top-header > div:last-child');
      if (headerRight && !document.getElementById('btnToggleNavLayoutMode')) {
        const btn = document.createElement('button');
        btn.id = 'btnToggleNavLayoutMode';
        btn.type = 'button';
        btn.className = 'px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-black flex items-center gap-1 transition';
        btn.title = 'تبديل موضع القائمة الرئيسية (قائمة جانبية يمين الشاشة / شريط علوي أفقي)';
        btn.onclick = () => this.toggleNavLayoutMode();
        this.updateNavLayoutButtonLabel(btn);
        headerRight.insertBefore(btn, headerRight.firstChild);
      }

      // تحديث زر فاحص السعر ليحمل الاختصار F6 وإضافة زر إغلاق الوردية (F10)
      document.querySelectorAll('button').forEach((b) => {
        if (b.textContent.includes('فاحص السعر')) {
          b.innerHTML = '<span class="material-symbols-rounded icon-sm">manage_search</span><span>فاحص السعر (F6)</span>';
          b.onclick = () => this.openPriceCheckerModal();
        }
      });
    },

    applyNavLayoutMode(mode) {
      this.navLayoutMode = mode === 'top' ? 'top' : 'side';
      localStorage.setItem('gherbi_nav_layout_mode', this.navLayoutMode);
      document.body.classList.toggle('gherbi-top-nav-mode', this.navLayoutMode === 'top');
      const btn = document.getElementById('btnToggleNavLayoutMode');
      if (btn) this.updateNavLayoutButtonLabel(btn);
      setTimeout(() => {
        if (window.App?.applyCartWidthLayout) {
          window.App.applyCartWidthLayout(window.AppState.posCartWidth || 470);
        }
      }, 100);
    },

    toggleNavLayoutMode() {
      this.applyNavLayoutMode(this.navLayoutMode === 'top' ? 'side' : 'top');
      if (window.showToast) {
        window.showToast(
          this.navLayoutMode === 'top'
            ? '⬆️ تم تحويل القائمة الرئيسية إلى الشريط العلوي لتوسيع شاشة البيع 100%'
            : '➡️ تمت إعادة القائمة الرئيسية إلى الجانب الأيمن',
          'info'
        );
      }
    },

    updateNavLayoutButtonLabel(btn) {
      btn.innerHTML = this.navLayoutMode === 'top'
        ? '<span class="material-symbols-rounded icon-sm">dock_to_right</span><span class="hidden md:inline">قائمة جانبية</span>'
        : '<span class="material-symbols-rounded icon-sm">dock_to_bottom</span><span class="hidden md:inline">قائمة علوية</span>';
    },

    openPriceCheckerModal() {
      this.buildSmartModalsDom();
      window.App.openModal('posPriceCheckerModal');
      const inp = document.getElementById('priceCheckerScanInput');
      if (inp) {
        inp.value = '';
        setTimeout(() => inp.focus(), 50);
      }
    },

    onPriceCheckerInput(val, isEnter = false) {
      const q = String(val || '').trim().toLowerCase();
      const box = document.getElementById('priceCheckerResultCard');
      if (!box) return;
      if (!q) {
        box.innerHTML = '<div class="text-slate-400 font-bold py-6">امسح باركود أي سلعة لعرض سعرها بالدينار والسنتيم والكمية المتوفرة</div>';
        return;
      }

      const found = (window.AppState.products || []).find(
        (p) =>
          String(p.barcode || '').toLowerCase() === q ||
          String(p.plu_code || '').toLowerCase() === q ||
          String(p.name || '').toLowerCase().includes(q)
      );

      if (!found) {
        box.innerHTML = `<div class="py-6 text-rose-500 font-black">❌ لم يتم العثور على سلعة مطابقة لـ "${val}"</div>`;
        return;
      }

      const price = Number(found.selling_price || 0);
      const stock = Number(found.total_stock ?? found.stock ?? 0);
      const centimes = window.App?.formatAlgerianCentimes ? window.App.formatAlgerianCentimes(price) : '';

      box.innerHTML = `
        <div class="text-base font-black text-slate-800 dark:text-white">${found.name}</div>
        <div class="text-xs font-mono text-slate-400">الباركود: ${found.barcode || '—'} | الفئة: ${found.category || 'عام'}</div>
        <div class="text-4xl font-black font-mono text-blue-600 dark:text-blue-400 my-2">${price.toFixed(2)} د.ج</div>
        <div class="text-sm font-black text-amber-600">🇩🇿 بالتداول الجزائري: ${centimes}</div>
        <div class="flex items-center justify-center gap-3 pt-2">
          <span class="px-3 py-1 rounded-full font-mono font-bold ${stock > 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}">
            📦 المخزون المتوفر: ${stock} ${found.unit || 'قطعة'}
          </span>
          <button type="button" onclick="App.addProductToCart(${found.id}, 1); App.closeModal('posPriceCheckerModal');"
            class="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black">
            + إضافة للسلة
          </button>
        </div>
      `;

      if (isEnter) {
        const inp = document.getElementById('priceCheckerScanInput');
        if (inp) inp.select();
      }
    },

    async triggerShiftCloseShortcutF10() {
      if (!window.App) return;
      await window.App.refreshActiveSession?.();
      const active = window.AppState.activeSession;
      if (active) {
        const sessId = active.session ? active.session.id : active.id;
        const sum = await window.api.getCaisseSummary({ sessionId: sessId }).catch(() => null);
        const expected = sum && sum.summary ? Number(sum.summary.expectedBalance || 0) : 0;
        window.App.openCloseShiftModal(sessId, expected);
      } else {
        window.App.openNewShiftModal?.();
      }
    },

    // ========================================================================
    // 11. إصلاح شامل لزر ونظام الإرجاع (Return Mode)
    // ========================================================================
    fixReturnModeEngine() {
      window.App.toggleReturnMode = function () {
        const nextState = !Boolean(window.AppState.isReturnMode || window.AppState.returnMode);
        window.AppState.isReturnMode = nextState;
        window.AppState.returnMode = nextState;

        const btn = document.getElementById('btnReturnMode');
        if (btn) {
          btn.className = nextState
            ? 'px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-1 shadow-lg shadow-rose-600/30 animate-pulse'
            : 'px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold flex items-center gap-1';
        }

        const banner = document.getElementById('gherbiReturnActiveBanner');
        if (banner) {
          banner.classList.toggle('hidden', !nextState);
        }

        // عكس إشارة العناصر الموجودة في السلة الحالية إذا تم تفعيل وضع الإرجاع
        const items = window.App.currentCart?.items || [];
        if (items.length > 0) {
          items.forEach((it) => {
            it.quantity = nextState ? -Math.abs(Number(it.quantity || 1)) : Math.abs(Number(it.quantity || 1));
            it.subtotal = Number((it.quantity * Number(it.price || 0)).toFixed(2));
          });
          window.App.recalcAndRenderCart();
        }

        if (window.showToast) {
          window.showToast(
            nextState
              ? '🔄 تم تفعيل وضع إرجاع السلع — أي سلعة تمسحها أو تضيفها ستُرجع للمخزون'
              : '✅ تم العودة إلى وضع البيع العادي',
            nextState ? 'warning' : 'info'
          );
        }
        if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
      };
    },

    openReturnFromInvoicePicker() {
      if (window.App?.openPosRecentSalesModal) {
        window.App.openPosRecentSalesModal();
      }
    },

    // ========================================================================
    // 12. شريط ذاكرة آخر فاتورة والباقي للزبون + خصم نقاط الولاء عند التسديد
    // ========================================================================
    hookCheckoutForLastSaleMemoryAndLoyalty() {
      const saveLastSaleInfo = (total, paid, change, docNum) => {
        this.lastCompletedSale = {
          total: Number(total || 0),
          paid: Number(paid || 0),
          change: Math.max(0, Number(change || 0)),
          docNum: docNum || '',
          time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
        };
        localStorage.setItem('gherbi_last_completed_sale', JSON.stringify(this.lastCompletedSale));
        this.renderLastSaleMemoryBar();
      };

      const origSubmitSale = window.App.submitSale?.bind(window.App);
      if (origSubmitSale) {
        window.App.submitSale = async function (printMode = 'none') {
          const calc = window.App.recalcCheckoutModal();
          const paidInputVal = parseFloat(document.getElementById('chkPaidAmount')?.value) || calc.total;
          const changeAmt = Math.max(0, Number((paidInputVal - calc.total).toFixed(2)));
          const cart = window.App.currentCart;
          const redeemedPts = Number(cart?._redeemedPoints || 0);
          const cid = cart?.customerId;

          await origSubmitSale(printMode);

          if (cid && redeemedPts > 0 && window.api?.redeemCustomerLoyaltyPoints) {
            await window.api.redeemCustomerLoyaltyPoints({
              customerId: cid,
              points: redeemedPts,
              reason: 'اختزال نقاط ولاء في الكاشير'
            }).catch(() => {});
            if (cart) cart._redeemedPoints = 0;
          }

          if (window.AppState.isReturnMode || window.AppState.returnMode) {
            window.App.toggleReturnMode();
          }

          saveLastSaleInfo(calc.total, paidInputVal, changeAmt, '');
          RetailMaster.syncSmartLoyaltyButtonDisplay();
        };
      }

      const origInstant = window.App.instantConfirmAndCheckout?.bind(window.App);
      if (origInstant) {
        window.App.instantConfirmAndCheckout = async function (mode) {
          const totals = window.App.recalcCart();
          const cart = window.App.currentCart;
          const redeemedPts = Number(cart?._redeemedPoints || 0);
          const cid = cart?.customerId;

          await origInstant(mode);

          if (cid && redeemedPts > 0 && window.api?.redeemCustomerLoyaltyPoints) {
            await window.api.redeemCustomerLoyaltyPoints({
              customerId: cid,
              points: redeemedPts,
              reason: 'اختزال نقاط ولاء في تذكرة فورية'
            }).catch(() => {});
            if (cart) cart._redeemedPoints = 0;
          }

          if (window.AppState.isReturnMode || window.AppState.returnMode) {
            window.App.toggleReturnMode();
          }

          saveLastSaleInfo(totals.total, totals.total, 0, '');
          RetailMaster.syncSmartLoyaltyButtonDisplay();
        };
      }
    },

    renderLastSaleMemoryBar() {
      const bar = document.getElementById('gherbiLastSaleMemoryBar');
      if (!bar) return;
      const info = this.lastCompletedSale;
      if (!info || !info.total) {
        bar.classList.add('hidden');
        return;
      }
      bar.classList.remove('hidden');
      bar.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-emerald-700 dark:text-emerald-300">🧾 آخر عملية (${info.time || ''}):</span>
          <strong class="font-mono">${Number(info.total).toFixed(2)} د.ج</strong>
        </div>
        <div class="flex items-center gap-2">
          <span>المدفوع: <strong class="font-mono">${Number(info.paid).toFixed(2)}</strong></span>
          <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
            الباقي للزبون: ${Number(info.change).toFixed(2)} د.ج
          </span>
        </div>
      `;
    },

    // ========================================================================
    // 5 (تتمة). إضافة تبويب تقارير المدير "تنبيهات البيع بسعر التكلفة أو بخسارة"
    // ========================================================================
    upgradeSalesHistoryAndOwnerCostReport() {
      const origRenderAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (origRenderAnalytics) {
        window.App.renderAnalyticsView = async function () {
          await origRenderAnalytics();
          const root = document.getElementById('analytics-view-root');
          if (!root || document.getElementById('ownerBelowCostReportCard')) return;

          const logs = (await window.api?.getAuditLogs?.().catch(() => [])) || [];
          const costAlerts = logs.filter((l) => l.action_type === 'SALE_AT_OR_BELOW_COST');

          const card = document.createElement('div');
          card.id = 'ownerBelowCostReportCard';
          card.className = 'bg-white dark:bg-slate-800 border-2 border-rose-500/40 rounded-2xl p-5 mt-5 space-y-3';
          card.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xl">🚨</span>
                <div>
                  <h3 class="font-black text-sm text-rose-600">سجل رقابة المدير: تنبيهات البيع بسعر التكلفة أو بخسارة (${costAlerts.length})</h3>
                  <p class="text-[11px] text-slate-400">يرصد تلقائياً أي عملية قام فيها البائع بتعديل سعر السلعة (F12) إلى سعر الشراء أو أقل منه</p>
                </div>
              </div>
            </div>
            ${
              costAlerts.length === 0
                ? '<div class="py-6 text-center text-emerald-600 font-bold text-xs">✅ سجل سليم 100% — لم يتم تسجيل أي عملية بيع بسعر التكلفة أو بخسارة</div>'
                : `<div class="overflow-x-auto max-h-64">
                    <table class="w-full text-xs text-right">
                      <thead>
                        <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                          <th class="py-2">التوقيت</th>
                          <th class="py-2">البائع</th>
                          <th class="py-2">الصنف</th>
                          <th class="py-2">سعر الشراء</th>
                          <th class="py-2">السعر المباع به</th>
                          <th class="py-2">الكمية</th>
                          <th class="py-2">الفارق للوحدة</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                        ${costAlerts.map((a) => {
                          let d = {};
                          try { d = JSON.parse(a.details_json || '{}'); } catch (_) {}
                          return `
                            <tr class="hover:bg-rose-500/5">
                              <td class="py-2 font-mono text-[11px]">${String(a.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                              <td class="py-2 font-bold">${a.user_name || 'Cashier'}</td>
                              <td class="py-2 font-black text-rose-600">${d.product_name || 'منتج'}</td>
                              <td class="py-2 font-mono font-bold">${Number(d.cost_price || 0).toFixed(2)} د.ج</td>
                              <td class="py-2 font-mono font-black text-rose-600">${Number(d.sold_price || 0).toFixed(2)} د.ج</td>
                              <td class="py-2 font-mono">${d.quantity || 1}</td>
                              <td class="py-2 font-mono font-bold text-rose-500">-${Number(d.loss_per_unit || 0).toFixed(2)} د.ج</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>`
            }
          `;
          root.appendChild(card);
        };
      }
    },

    // ========================================================================
    // اختصارات الكيبورد الشاملة (Ctrl+N, F6, F8, F9, F10, F12, Ctrl+X, Delete)
    // ========================================================================
    bindMasterKeyboardShortcuts() {
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          const isPosActive = Boolean(posSec && posSec.classList.contains('active'));
          if (!isPosActive) return;

          // Ctrl + N -> فتح سلة جديدة فوراً
          if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
            e.preventDefault();
            e.stopPropagation();
            window.App.newCartTab();
            if (window.showToast) window.showToast('🛒 تم فتح سلة جديدة (Ctrl+N)', 'info');
            return;
          }

          // Ctrl + X -> تبديل مضاعف الكمية السريع (1x -> 2x -> 3x -> 5x -> 10x)
          if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
            const activeTag = (document.activeElement?.tagName || '').toUpperCase();
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
              e.preventDefault();
              const seq = [1, 2, 3, 5, 10];
              const cur = window.AppState._quickMultiplier || 1;
              const next = seq[(seq.indexOf(cur) + 1) % seq.length];
              window.App.setQuickMultiplier(next);
              return;
            }
          }

          // F6 -> فاحص السعر الفوري
          if (e.key === 'F6') {
            e.preventDefault();
            e.stopPropagation();
            this.openPriceCheckerModal();
            return;
          }

          // F8 -> فتح نافذة بطاقة الوفاء واختيار الزبون مع التركيز المباشر على حقل مسح البطاقة
          if (e.key === 'F8') {
            e.preventDefault();
            e.stopPropagation();
            this.openSmartLoyaltyModal('scan');
            return;
          }

          // F9 -> فتح نافذة الزبون والوفاء مع التركيز المباشر على خانة اختزال النقاط
          if (e.key === 'F9') {
            e.preventDefault();
            e.stopPropagation();
            this.openSmartLoyaltyModal('redeem');
            return;
          }

          // F10 -> إغلاق الوردية (Z-Report)
          if (e.key === 'F10') {
            e.preventDefault();
            e.stopPropagation();
            this.triggerShiftCloseShortcutF10();
            return;
          }

          // Delete -> حذف السطر المحدد في السلة عندما لا يكون المؤشر داخل نص
          if (e.key === 'Delete') {
            const activeEl = document.activeElement;
            const isBarcodeEmpty = activeEl && activeEl.id === 'barcodeInput' && !activeEl.value;
            const notTyping = !activeEl || activeEl === document.body || isBarcodeEmpty;
            if (notTyping && !document.querySelector('.modal-overlay.active')) {
              const items = window.App.currentCart?.items || [];
              if (items.length > 0) {
                e.preventDefault();
                const idx = window.AppState.selectedCartRowIdx ?? (items.length - 1);
                window.App.removeCartItem(idx);
              }
            }
          }
        },
        true
      );
    }
  };

  window.RetailMaster = RetailMaster;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailMaster.init());
  } else {
    RetailMaster.init();
  }
})();
