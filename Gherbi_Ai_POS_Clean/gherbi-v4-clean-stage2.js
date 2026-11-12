/**
 * gherbi-v4-clean-stage2.js
 * الشطر الثاني (المحوران 4 + 5)
 */

'use strict';

(function initGherbiV4CleanStage2() {
  const Stage2 = {
    activeF7Cat: 'all',

    init() {
      const timer = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(timer);
        this.buildQuickBtnEditModal();
        this.upgradeF7ModalWithWarehouseProducts();
        this.setupDeltaLoyaltyForEditedSales();
        console.log('🚀 [Stage 2 Active]: F7 Inventory Link + Delta Loyalty Engine Ready.');
      }, 220);
    },

    // ========================================================================
    // المحور 4: تطوير مركز اللمس السريع (F7) وربطه بمنتجات المخزن الحقيقية
    // ========================================================================
    buildQuickBtnEditModal() {
      if (document.getElementById('quickBtnEditModal')) return;
      const modal = document.createElement('div');
      modal.id = 'quickBtnEditModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <h3 class="text-sm font-black text-emerald-600">✏️ تعديل زر اللمس السريع</h3>
            <button type="button" onclick="App.closeModal('quickBtnEditModal')" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
          </div>
          <input type="hidden" id="v4QbEditIdx">
          <div class="grid grid-cols-12 gap-2.5">
            <div class="col-span-3">
              <label class="block font-bold mb-1">الأيقونة</label>
              <input id="v4QbEditIcon" type="text" class="w-full px-2 py-2 rounded-xl border text-center text-base">
            </div>
            <div class="col-span-9">
              <label class="block font-bold mb-1">اسم السلعة أو الخدمة *</label>
              <input id="v4QbEditName" type="text" class="w-full px-3 py-2 rounded-xl border font-black">
            </div>
            <div class="col-span-6">
              <label class="block font-black text-emerald-600 mb-1">السعر (د.ج) *</label>
              <input id="v4QbEditPrice" type="number" step="any" class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-sm">
            </div>
            <div class="col-span-6">
              <label class="block font-bold mb-1">الفئة / القسم</label>
              <input id="v4QbEditCat" type="text" class="w-full px-3 py-2 rounded-xl border font-bold">
            </div>
            <div class="col-span-12 flex items-center justify-between pt-2">
              <label class="flex items-center gap-1.5 cursor-pointer font-bold">
                <input id="v4QbEditPinned" type="checkbox" class="rounded text-emerald-600">
                <span>📌 تثبيت في شاشة المبيعات الرئيسية</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer font-bold text-amber-600">
                <input id="v4QbEditNoLoyalty" type="checkbox" class="rounded text-amber-500">
                <span>🚫 استثناء من نقاط الوفاء</span>
              </label>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onclick="App.closeModal('quickBtnEditModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
            <button type="button" onclick="GherbiV4Stage2.saveEditedQuickBtn()" class="px-5 py-2 rounded-xl bg-emerald-600 text-white font-black">✔ حفظ التعديلات</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    upgradeF7ModalWithWarehouseProducts() {
      let modal = document.getElementById('quickTouchPadModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quickTouchPadModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="modal-content w-full max-w-5xl p-5 space-y-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden">
          <!-- الهيدر -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5 shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-2xl">⚡</span>
              <div>
                <h3 class="text-base font-black text-emerald-600 dark:text-emerald-400">مركز اللمس السريع للسلع اليومية ومنتجات المخزن (F7)</h3>
                <p class="text-[11px] text-slate-400">اضغط على أي زر لإدراجه في السلة فوراً — يمكنك ربط منتجات المخزن أو تثبيت الأزرار 📌 في الشاشة الرئيسية</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('quickTouchPadModal'); App.focusBarcodeMagnet?.(false);" class="text-slate-400 hover:text-rose-500 font-black text-base">✕</button>
          </div>

          <!-- شريط المجموعات الجاهزة + استيراد الأكثر مبيعاً من المخزن -->
          <div class="p-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-black text-amber-400 ml-1">🎯 مجموعات جاهزة:</span>
              <button type="button" onclick="GherbiV4Stage2.loadPreset('supermarket')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-black">🛒 سوبرماركت ويوميات</button>
              <button type="button" onclick="GherbiV4Stage2.loadPreset('produce')" class="px-2.5 py-1 rounded-lg bg-lime-600 hover:bg-lime-500 font-black">🍎 خضر وفواكه</button>
              <button type="button" onclick="GherbiV4Stage2.loadPreset('bakery')" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 font-black">🥖 مخبزة ومرطبات</button>
              <button type="button" onclick="GherbiV4Stage2.loadPreset('library')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 font-black">📚 مكتبة ونسخ</button>
              <button type="button" onclick="GherbiV4Stage2.loadPreset('perfume')" class="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 font-black">✨ عطور وهدايا</button>
            </div>
            <button type="button" onclick="GherbiV4Stage2.importTopWarehouseProducts()"
              class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center gap-1 shadow">
              <span>🔥</span>
              <span>+ استيراد منتجات المخزن تلقائياً</span>
            </button>
          </div>

          <!-- فلترة حسب الأقسام وبحث فوري داخل لوحة اللمس -->
          <div class="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div id="v4F7CategoryTabs" class="flex items-center gap-1 overflow-x-auto"></div>
            <input id="v4F7SearchInput" type="text" oninput="GherbiV4Stage2.renderF7Grid()"
              placeholder="🔍 ابحث في أزرار اللمس السريع..."
              class="w-60 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold">
          </div>

          <!-- شبكة البطاقات -->
          <div id="quickTouchButtonsGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 overflow-y-auto flex-1 p-1"></div>

          <!-- الشريط السفلي المزدوج: 1) إضافة منتج من المخزن | 2) إضافة زر حر سريع -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 shrink-0">
            
            <!-- 1. قسم ربط منتجات المخزن -->
            <div class="md:col-span-5 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-1.5">
              <label class="block font-black text-blue-600 dark:text-blue-400">📦 1. إضافة منتج من المخزون للمس السريع:</label>
              <div class="flex gap-1.5">
                <input id="v4WarehouseFilterInp" type="text" oninput="GherbiV4Stage2.populateWarehouseSelect(this.value)"
                  placeholder="ابحث في المخزن..." class="w-28 px-2 py-1.5 rounded-xl border text-xs font-bold">
                <select id="v4WarehouseProductSelect" class="flex-1 px-2 py-1.5 rounded-xl border border-blue-500/50 font-bold"></select>
                <button type="button" onclick="GherbiV4Stage2.addWarehouseProductToF7()"
                  class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shrink-0">
                  + ربط
                </button>
              </div>
            </div>

            <!-- 2. قسم إضافة سلعة يومية أو خدمة بدون باركود -->
            <div class="md:col-span-7 space-y-1.5">
              <label class="block font-black text-emerald-600 dark:text-emerald-400">⚡ 2. أو إنشاء زر سريع لسلعة يومية / خدمة بدون باركود:</label>
              <div class="grid grid-cols-12 gap-1.5 items-center">
                <input id="qtIconInput" type="text" value="🥖" placeholder="أيقونة" class="col-span-2 px-2 py-1.5 rounded-xl border text-center font-bold">
                <input id="qtNameInput" type="text" placeholder="اسم السلعة (خبز / حليب / نسخ)..." class="col-span-5 px-2.5 py-1.5 rounded-xl border font-bold">
                <input id="qtPriceInput" type="number" step="any" placeholder="السعر د.ج" class="col-span-2 px-2 py-1.5 rounded-xl border font-mono font-black text-center">
                <button type="button" onclick="GherbiV4Stage2.addCustomQuickBtn()"
                  class="col-span-3 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black">
                  + إضافة زر
                </button>
              </div>
            </div>

          </div>
        </div>
      `;

      window.App.openQuickTouchModal = () => {
        this.populateWarehouseSelect('');
        this.renderF7Grid();
        window.App.openModal('quickTouchPadModal');
      };
      window.App.renderQuickTouchPad = () => this.renderF7Grid();

      if (window.RetailV3) {
        window.RetailV3.renderPinnedQuickDock = () => this.renderPinnedDock();
        window.RetailV3.quickEditQuickButtonPrice = (idx) => this.openEditQuickBtnModal(idx);
      }

      this.renderPinnedDock();
    },

    getButtons() {
      return window.RetailV3 ? window.RetailV3.getQuickTouchButtons() : [];
    },

    saveButtons(list) {
      localStorage.setItem('gherbi_quick_touch_buttons', JSON.stringify(list));
      if (window.AppState) window.AppState.quickTouchButtons = list;
      this.renderF7Grid();
      this.renderPinnedDock();
    },

    loadPreset(key) {
      if (!window.RetailV3 || !window.RetailV3.retailQuickPresets[key]) return;
      const preset = JSON.parse(JSON.stringify(window.RetailV3.retailQuickPresets[key]));
      const warehouseItems = this.getButtons().filter((b) => b.productId);
      this.saveButtons([...warehouseItems, ...preset]);
      if (window.showToast) window.showToast('✅ تم تحميل المجموعة مع الاحتفاظ بمنتجات المخزن المربوطة', 'success');
    },

    populateWarehouseSelect(query = '') {
      const sel = document.getElementById('v4WarehouseProductSelect');
      if (!sel) return;
      const q = String(query || '').trim().toLowerCase();
      const prods = (window.AppState.products || []).filter((p) => {
        if (p.hide_from_pos) return false;
        if (!q) return true;
        return String(p.name || '').toLowerCase().includes(q) || String(p.barcode || '').toLowerCase().includes(q);
      });

      sel.innerHTML =
        '<option value="">اختر منتجاً من المخزن...</option>' +
        prods.slice(0, 120).map((p) => `<option value="${p.id}">${p.name} — (${Number(p.selling_price || 0).toFixed(2)} د.ج | مخزون: ${Number(p.total_stock ?? p.stock ?? 0)})</option>`).join('');
    },

    addWarehouseProductToF7() {
      const pid = Number(document.getElementById('v4WarehouseProductSelect')?.value || 0);
      if (!pid) {
        if (window.showToast) window.showToast('يرجى اختيار منتج من قائمة المخزن أولاً', 'warning');
        return;
      }
      const prod = (window.AppState.products || []).find((p) => Number(p.id) === pid);
      if (!prod) return;

      const list = this.getButtons();
      if (list.some((b) => Number(b.productId) === pid)) {
        if (window.showToast) window.showToast('هذا المنتج مضاف مسبقاً في لوحة اللمس السريع', 'info');
        return;
      }

      list.unshift({
        productId: prod.id,
        icon: '📦',
        name: prod.name,
        price: Number(prod.selling_price || 0),
        category: prod.category || 'منتجات المخزن',
        pinned: true,
        noLoyalty: window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(prod.id) === 0 : false
      });

      this.saveButtons(list);
      if (window.showToast) window.showToast(`✅ تمت إضافة "${prod.name}" إلى لوحة اللمس وتثبيته في الكاشير`, 'success');
    },

    importTopWarehouseProducts() {
      const prods = (window.AppState.products || []).filter((p) => !p.hide_from_pos);
      if (!prods.length) {
        if (window.showToast) window.showToast('لا توجد منتجات مسجلة في المخزن حالياً', 'warning');
        return;
      }
      const list = this.getButtons();
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
            noLoyalty: window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(p.id) === 0 : false
          });
          added++;
        }
      });
      this.saveButtons(list);
      if (window.showToast) window.showToast(`📦 تم استيراد ${added} منتجات من المخزن إلى لوحة اللمس السريع`, 'success');
    },

    addCustomQuickBtn() {
      const icon = document.getElementById('qtIconInput')?.value?.trim() || '⚡';
      const name = document.getElementById('qtNameInput')?.value?.trim() || '';
      const price = parseFloat(document.getElementById('qtPriceInput')?.value || '0');
      if (!name || !Number.isFinite(price) || price < 0) {
        if (window.showToast) window.showToast('يرجى إدخال اسم السلعة والسعر بشكل صحيح', 'warning');
        return;
      }
      const list = this.getButtons();
      list.push({ icon, name, price, category: 'خدمات ويوميات', pinned: true, noLoyalty: false });
      document.getElementById('qtNameInput').value = '';
      document.getElementById('qtPriceInput').value = '';
      this.saveButtons(list);
      if (window.showToast) window.showToast(`✅ تمت إضافة الزر السريع "${name}"`, 'success');
    },

    renderF7Grid() {
      const grid = document.getElementById('quickTouchButtonsGrid');
      const tabsBox = document.getElementById('v4F7CategoryTabs');
      if (!grid) return;

      const list = this.getButtons();
      const q = String(document.getElementById('v4F7SearchInput')?.value || '').trim().toLowerCase();

      const cats = ['all', 'pinned', 'inventory', ...new Set(list.map((b) => b.category || 'عام'))];
      if (tabsBox) {
        const titles = { all: 'الكل', pinned: '📌 المثبتة في الكاشير', inventory: '📦 منتجات المخزن' };
        tabsBox.innerHTML = cats.map((c) => `
          <button type="button" onclick="GherbiV4Stage2.activeF7Cat='${c}'; GherbiV4Stage2.renderF7Grid();"
            class="px-2.5 py-1 rounded-lg font-black text-[11px] whitespace-nowrap transition ${
              this.activeF7Cat === c ? 'bg-emerald-600 text-white shadow' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }">
            ${titles[c] || c}
          </button>
        `).join('');
      }

      const filtered = list
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
          if (this.activeF7Cat === 'pinned' && item.pinned === false) return false;
          if (this.activeF7Cat === 'inventory' && !item.productId) return false;
          if (!['all', 'pinned', 'inventory'].includes(this.activeF7Cat) && (item.category || 'عام') !== this.activeF7Cat) {
            return false;
          }
          if (!q) return true;
          return String(item.name || '').toLowerCase().includes(q) || String(item.category || '').toLowerCase().includes(q);
        });

      if (!filtered.length) {
        grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 font-bold">لا توجد أزرار مطابقة للبحث</div>';
        return;
      }

      grid.innerHTML = filtered.map(({ item, idx }) => {
        const prod = item.productId ? (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId)) : null;
        const price = prod ? Number(prod.selling_price || item.price || 0) : Number(item.price || 0);
        const stockTag = prod ? `📦 مخزون: ${Number(prod.total_stock ?? prod.stock ?? 0)}` : '⚡ سريع';
        const isPinned = item.pinned !== false;

        return `
          <div onclick="GherbiV4Stage2.triggerQuickBtn(${idx}, true)" class="v4-s2-f7-card ${prod ? 'card-from-inventory' : ''}">
            <div class="flex items-center justify-between gap-1">
              <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">${stockTag}</span>
              <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                <button type="button" onclick="GherbiV4Stage2.togglePin(${idx})" title="تثبيت أو إخفاء من الشاشة الرئيسية"
                  class="px-1.5 py-0.5 rounded text-[10px] font-black ${isPinned ? 'bg-amber-500/20 text-amber-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}">📌</button>
                <button type="button" onclick="GherbiV4Stage2.openEditQuickBtnModal(${idx})" title="تعديل السعر أو الاسم"
                  class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 text-[10px]">✏️</button>
                <button type="button" onclick="GherbiV4Stage2.deleteQuickBtn(${idx})" title="حذف الزر"
                  class="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 text-[10px]">✕</button>
              </div>
            </div>

            <div class="font-black text-xs text-slate-800 dark:text-slate-100 my-1 line-clamp-2">
              <span>${item.icon || '⚡'}</span>
              <span>${prod ? prod.name : item.name}</span>
            </div>

            <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <span class="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">${price.toFixed(2)} د.ج</span>
              ${item.noLoyalty ? '<span class="text-[9.5px] font-bold text-rose-500">🚫 بدون نقاط</span>' : '<span class="text-[9.5px] font-bold text-amber-500">👑 مؤهل للنقاط</span>'}
            </div>
          </div>
        `;
      }).join('');
    },

    renderPinnedDock() {
      document.getElementById('posQuickTouchStrip')?.remove();
      const dock = document.getElementById('gherbiPinnedQuickDock');
      if (!dock) return;
      const list = this.getButtons();
      const pinned = list.map((b, idx) => ({ b, idx })).filter(({ b }) => b.pinned !== false);

      dock.innerHTML = `
        <button type="button" onclick="App.openQuickTouchModal()"
          class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shrink-0 flex items-center gap-1 shadow-sm">
          <span>⚡</span>
          <span>لوحة اللمس (F7)</span>
        </button>
        ${pinned.map(({ b, idx }) => {
          const prod = b.productId ? (window.AppState.products || []).find((p) => Number(p.id) === Number(b.productId)) : null;
          const price = prod ? Number(prod.selling_price || b.price || 0) : Number(b.price || 0);
          const name = prod ? prod.name : b.name;
          return `
            <div onclick="GherbiV4Stage2.triggerQuickBtn(${idx}, false)"
                 oncontextmenu="event.preventDefault(); GherbiV4Stage2.openEditQuickBtnModal(${idx});"
                 class="gherbi-pinned-f7-chip" title="انقر للإضافة للسلة فوراً | نقرة يمين لتعديل السعر أو الخصائص">
              <span>${b.icon || '⚡'}</span>
              <span>${name}</span>
              <span class="font-mono font-black text-emerald-600 dark:text-emerald-400">${price.toFixed(0)} د.ج</span>
            </div>
          `;
        }).join('')}
      `;
    },

    triggerQuickBtn(idx, closeModal = false) {
      const list = this.getButtons();
      const item = list[idx];
      if (!item || !window.App) return;

      if (item.productId) {
        const prod = (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId));
        if (prod) {
          if (typeof window.App.addProductToCart === 'function') {
            window.App.addProductToCart(prod.id, 1);
          } else if (typeof window.App.addToCart === 'function') {
            window.App.addToCart(prod.id);
          }
          if (closeModal) window.App.closeModal('quickTouchPadModal');
          if (window.App.focusBarcodeMagnet) window.App.focusBarcodeMagnet(false);
          return;
        }
      }

      if (window.RetailV3) {
        window.RetailV3.triggerQuickTouchItem(idx);
      }
      if (closeModal) window.App.closeModal('quickTouchPadModal');
    },

    togglePin(idx) {
      const list = this.getButtons();
      if (!list[idx]) return;
      list[idx].pinned = list[idx].pinned === false ? true : false;
      this.saveButtons(list);
    },

    deleteQuickBtn(idx) {
      const list = this.getButtons();
      if (!list[idx]) return;
      list.splice(idx, 1);
      this.saveButtons(list);
    },

    openEditQuickBtnModal(idx) {
      const list = this.getButtons();
      const item = list[idx];
      if (!item) return;
      this.buildQuickBtnEditModal();

      document.getElementById('v4QbEditIdx').value = String(idx);
      document.getElementById('v4QbEditIcon').value = item.icon || '⚡';
      document.getElementById('v4QbEditName').value = item.name || '';
      document.getElementById('v4QbEditPrice').value = Number(item.price || 0);
      document.getElementById('v4QbEditCat').value = item.category || 'خدمات سريعة';
      document.getElementById('v4QbEditPinned').checked = item.pinned !== false;
      document.getElementById('v4QbEditNoLoyalty').checked = Boolean(item.noLoyalty);

      window.App.openModal('quickBtnEditModal');
    },

    saveEditedQuickBtn() {
      const idx = parseInt(document.getElementById('v4QbEditIdx')?.value || '-1', 10);
      const list = this.getButtons();
      if (!list[idx]) return;

      list[idx].icon = document.getElementById('v4QbEditIcon')?.value?.trim() || '⚡';
      list[idx].name = document.getElementById('v4QbEditName')?.value?.trim() || list[idx].name;
      list[idx].price = Math.max(0, parseFloat(document.getElementById('v4QbEditPrice')?.value || '0') || 0);
      list[idx].category = document.getElementById('v4QbEditCat')?.value?.trim() || 'خدمات سريعة';
      list[idx].pinned = Boolean(document.getElementById('v4QbEditPinned')?.checked);
      list[idx].noLoyalty = Boolean(document.getElementById('v4QbEditNoLoyalty')?.checked);

      this.saveButtons(list);
      window.App.closeModal('quickBtnEditModal');
      if (window.showToast) window.showToast('✅ تم حفظ تعديلات زر اللمس السريع', 'success');
    },

    // ========================================================================
    // المحور 5: محرك "فارق النقاط الذكي (Delta Loyalty Engine)" عند تعديل فاتورة سابقة
    // ========================================================================
    calcEligiblePoints(items = [], discount = 0) {
      let eligibleTotal = 0;
      items.forEach((it) => {
        const sub = Number(it.subtotal ?? (Number(it.quantity || 1) * Number(it.price || 0)));
        if (it._noLoyalty) return;
        const pid = it.product_id || it.productId;
        const mult = pid && window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(pid) : 1;
        eligibleTotal += sub * mult;
      });
      const net = Math.max(0, eligibleTotal - Number(discount || 0));
      return Math.floor(net / 100);
    },

    setupDeltaLoyaltyForEditedSales() {
      // التقاط النقاط الأصلية للفاتورة بمجرد تحميلها في الكاشير للتعديل
      const watchEditMode = () => {
        const cart = window.App?.currentCart;
        if (!cart) return;
        const editSaleId = cart.editingSaleId || window.AppState?.editingSaleId;
        if (editSaleId && cart._trackedEditSaleId !== editSaleId) {
          cart._trackedEditSaleId = editSaleId;
          cart._originalSaleEarnedPoints = this.calcEligiblePoints(cart.items || [], cart.discount || 0);
          cart._originalSaleCustomerId = Number(cart.customerId || 0);
        } else if (!editSaleId && cart._trackedEditSaleId) {
          delete cart._trackedEditSaleId;
          delete cart._originalSaleEarnedPoints;
          delete cart._originalSaleCustomerId;
        }
      };
      setInterval(watchEditMode, 300);

      // اعتراض حفظ الفاتورة لتطبيق الفارق فقط (NewPoints - OldPoints)
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (!origFn || window.App['_v4Stage2Delta_' + fnName]) return;

        window.App[fnName] = async function (...args) {
          const cart = window.App.currentCart;
          const isEditing = Boolean(cart?.editingSaleId || window.AppState?.editingSaleId || cart?._trackedEditSaleId);
          const cid = Number(cart?.customerId || 0);
          const oldPts = Number(cart?._originalSaleEarnedPoints ?? 0);
          const newPts = Stage2.calcEligiblePoints(cart?.items || [], cart?.discount || 0);

          const cust = cid ? (window.AppState.customers || []).find((c) => Number(c.id) === cid) : null;
          const balanceBefore = cust ? Number(cust.loyalty_points || 0) : 0;

          const result = await origFn(...args);

          if (cid && cust) {
            let correctedBalance = balanceBefore;

            if (isEditing) {
              const delta = newPts - oldPts;
              correctedBalance = Math.max(0, balanceBefore + delta);
              if (window.showToast) {
                const sign = delta >= 0 ? '+' + delta : String(delta);
                window.showToast(
                  `👑 تسوية نقاط الفاتورة المعدلة: السابق (${oldPts}) ⬅ الجديد (${newPts}) | تم احتساب الفارق فقط (${sign} نقطة)`,
                  'info'
                );
              }
            } else {
              correctedBalance = Math.max(0, balanceBefore + newPts);
            }

            cust.loyalty_points = correctedBalance;
            if (window.api?.updateCustomer) {
              await window.api.updateCustomer(cid, { ...cust, loyalty_points: correctedBalance }).catch(() => {});
            }
            window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
          }

          return result;
        };
        window.App['_v4Stage2Delta_' + fnName] = true;
      });
    }
  };

  window.GherbiV4Stage2 = Stage2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Stage2.init());
  } else {
    Stage2.init();
  }
})();
