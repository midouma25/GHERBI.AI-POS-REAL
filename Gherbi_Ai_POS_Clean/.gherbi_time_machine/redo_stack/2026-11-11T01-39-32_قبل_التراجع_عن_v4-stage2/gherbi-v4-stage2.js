/**
 * gherbi-v4-stage2.js
 * المحرك التنفيذي للشطر الثاني:
 * - تطوير مركز اللمس السريع (F7) وربطه بمنتجات المخزن الحقيقية
 * - محرك فارق النقاط الذكي (Delta Loyalty Points Engine) عند تعديل فاتورة سابقة من السجل
 */

'use strict';

(function initGherbiV4Stage2() {
  const Stage2 = {
    activeF7Tab: 'all',

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.buildQuickButtonEditModal();
        this.upgradeQuickTouchPadModalWithInventory();
        this.setupDeltaLoyaltyForEditedSales();
        console.log('✅ [Gherbi V4 - Stage 2]: تم تفعيل الشطر الثاني بنجاح.');
      }, 200);
    },

    // ========================================================================
    // 4. تطوير لوحة اللمس السريع (F7) وربطها بمنتجات المخزن الحقيقية
    // ========================================================================
    buildQuickButtonEditModal() {
      if (document.getElementById('quickBtnEditModal')) return;
      const m = document.createElement('div');
      m.id = 'quickBtnEditModal';
      m.className = 'modal-overlay';
      m.innerHTML = `
        <div class="modal-content w-full max-w-md p-5 space-y-4 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <h3 class="text-sm font-black text-emerald-600">✏️ تعديل خصائص زر اللمس السريع</h3>
            <button type="button" onclick="App.closeModal('quickBtnEditModal')" class="text-slate-400 hover:text-rose-500 font-black">✕</button>
          </div>
          <input type="hidden" id="s2QbEditIdx">
          <div class="grid grid-cols-12 gap-2.5">
            <div class="col-span-3">
              <label class="block font-bold mb-1">الأيقونة</label>
              <input id="s2QbEditIcon" type="text" class="w-full px-2 py-2 rounded-xl border text-center text-base">
            </div>
            <div class="col-span-9">
              <label class="block font-bold mb-1">اسم السلعة أو الخدمة *</label>
              <input id="s2QbEditName" type="text" class="w-full px-3 py-2 rounded-xl border font-black">
            </div>
            <div class="col-span-6">
              <label class="block font-black text-emerald-600 mb-1">السعر (د.ج) *</label>
              <input id="s2QbEditPrice" type="number" step="any" class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-center text-sm">
            </div>
            <div class="col-span-6">
              <label class="block font-bold mb-1">القسم / الفئة</label>
              <input id="s2QbEditCat" type="text" class="w-full px-3 py-2 rounded-xl border font-bold">
            </div>
            <div class="col-span-12 flex items-center justify-between pt-2">
              <label class="flex items-center gap-1.5 cursor-pointer font-bold">
                <input id="s2QbEditPinned" type="checkbox" class="rounded text-emerald-600">
                <span>📌 تثبيت في شريط الكاشير الرئيسي</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer font-bold text-amber-600">
                <input id="s2QbEditNoLoyalty" type="checkbox" class="rounded text-amber-500">
                <span>🚫 استثناء من نقاط الوفاء</span>
              </label>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onclick="App.closeModal('quickBtnEditModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
            <button type="button" onclick="GherbiStage2.saveQuickButtonEdit()" class="px-5 py-2 rounded-xl bg-emerald-600 text-white font-black">✔ حفظ التعديلات</button>
          </div>
        </div>
      `;
      document.body.appendChild(m);
    },

    upgradeQuickTouchPadModalWithInventory() {
      const modal = document.getElementById('quickTouchPadModal');
      if (!modal) return;

      modal.innerHTML = `
        <div class="modal-content w-full max-w-5xl p-5 space-y-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden">
          <!-- ترويسة النافذة -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5 shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-2xl">⚡</span>
              <div>
                <h3 class="text-base font-black text-emerald-600 dark:text-emerald-400">مركز اللمس السريع للسلع اليومية ومنتجات المخزن (F7)</h3>
                <p class="text-[11px] text-slate-400">اضغط على أي بطاقة لإدراجها في السلة فوراً — يمكنك ربط منتجات من المخزن أو تثبيت الأزرار 📌 في الشاشة الرئيسية</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('quickTouchPadModal'); App.focusBarcodeMagnet?.(false);" class="text-slate-400 hover:text-rose-500 font-black text-base">✕</button>
          </div>

          <!-- شريط القوالب الجاهزة + استيراد منتجات المخزن -->
          <div class="p-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-black text-amber-400 ml-1">🎯 مجموعات جاهزة:</span>
              <button type="button" onclick="GherbiStage2.applyPreset('supermarket')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-black">🛒 سوبرماركت ويوميات</button>
              <button type="button" onclick="GherbiStage2.applyPreset('produce')" class="px-2.5 py-1 rounded-lg bg-lime-600 hover:bg-lime-500 font-black">🍎 خضر وفواكه</button>
              <button type="button" onclick="GherbiStage2.applyPreset('bakery')" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 font-black">🥖 مخبزة ومرطبات</button>
              <button type="button" onclick="GherbiStage2.applyPreset('library')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 font-black">📚 مكتبة ونسخ</button>
              <button type="button" onclick="GherbiStage2.applyPreset('perfume')" class="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 font-black">✨ عطور وهدايا</button>
            </div>
            <button type="button" onclick="GherbiStage2.importInventoryToF7()"
              class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center gap-1 shadow">
              <span>📦</span>
              <span>+ استيراد منتجات من المخزن تلقائياً</span>
            </button>
          </div>

          <!-- شريط الفلترة والبحث داخل F7 -->
          <div class="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div id="s2F7CategoryTabs" class="flex items-center gap-1 overflow-x-auto"></div>
            <input id="s2F7SearchInput" type="text" oninput="GherbiStage2.renderF7Cards()"
              placeholder="🔍 ابحث داخل أزرار اللمس السريع..."
              class="w-60 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold">
          </div>

          <!-- شبكة البطاقات -->
          <div id="quickTouchButtonsGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 overflow-y-auto flex-1 p-1"></div>

          <!-- اللوحة السفلية المزدوجة: 1) اختيار منتج من المخزن | 2) إضافة زر حر سريع -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 shrink-0">
            <div class="md:col-span-5 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-1.5">
              <label class="block font-black text-blue-600 dark:text-blue-400">📦 1. اختر منتجاً من المخزن لإضافته للوحة اللمس:</label>
              <div class="flex gap-1.5">
                <select id="s2InventoryProductPicker" class="flex-1 px-2.5 py-1.5 rounded-xl border border-blue-500/50 font-bold"></select>
                <button type="button" onclick="GherbiStage2.linkSelectedInventoryProduct()"
                  class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shrink-0">
                  + إدارج من المخزن
                </button>
              </div>
            </div>

            <div class="md:col-span-7 space-y-1.5">
              <label class="block font-black text-emerald-600 dark:text-emerald-400">⚡ 2. أو أنشئ زر سلعة يومية / خدمة سريعة بدون باركود:</label>
              <div class="grid grid-cols-12 gap-1.5 items-center">
                <input id="qtIconInput" type="text" value="🥖" placeholder="أيقونة" class="col-span-2 px-2 py-1.5 rounded-xl border text-center font-bold">
                <input id="qtNameInput" type="text" placeholder="اسم السلعة (مثال: خبز / حليب / نسخ)..." class="col-span-5 px-2.5 py-1.5 rounded-xl border font-bold">
                <input id="qtPriceInput" type="number" step="any" placeholder="السعر د.ج" class="col-span-2 px-2 py-1.5 rounded-xl border font-mono font-black text-center">
                <button type="button" onclick="GherbiStage2.createCustomQuickButton()"
                  class="col-span-3 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black">
                  + إضافة زر
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      window.App.openQuickTouchModal = () => {
        this.populateInventoryPicker();
        this.renderF7Cards();
        window.App.openModal('quickTouchPadModal');
      };
      window.App.renderQuickTouchPad = () => this.renderF7Cards();

      if (window.RetailV3) {
        window.RetailV3.renderPinnedQuickDock = () => this.renderPinnedDockBar();
        window.RetailV3.quickEditQuickButtonPrice = (idx) => this.openEditQuickButton(idx);
      }

      this.renderPinnedDockBar();
    },

    getButtons() {
      return window.RetailV3 ? window.RetailV3.getQuickTouchButtons() : [];
    },

    saveButtons(list) {
      localStorage.setItem('gherbi_quick_touch_buttons', JSON.stringify(list));
      if (window.AppState) window.AppState.quickTouchButtons = list;
      this.renderF7Cards();
      this.renderPinnedDockBar();
    },

    applyPreset(key) {
      if (!window.RetailV3 || !window.RetailV3.retailQuickPresets[key]) return;
      const preset = JSON.parse(JSON.stringify(window.RetailV3.retailQuickPresets[key]));
      const stockLinked = this.getButtons().filter((b) => b.productId);
      this.saveButtons([...stockLinked, ...preset]);
      if (window.showToast) window.showToast('✅ تم تحميل المجموعة مع الاحتفاظ بمنتجات المخزن المربوطة', 'success');
    },

    populateInventoryPicker() {
      const sel = document.getElementById('s2InventoryProductPicker');
      if (!sel) return;
      const prods = (window.AppState.products || []).filter((p) => !p.hide_from_pos);
      sel.innerHTML =
        '<option value="">اختر منتجاً من المخزن...</option>' +
        prods.map((p) => `<option value="${p.id}">${p.name} — (${Number(p.selling_price || 0).toFixed(2)} د.ج | مخزون: ${Number(p.total_stock ?? p.stock ?? 0)})</option>`).join('');
    },

    linkSelectedInventoryProduct() {
      const pid = Number(document.getElementById('s2InventoryProductPicker')?.value || 0);
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
      if (window.showToast) window.showToast(`✅ تم ربط المنتج "${prod.name}" وتثبيته في شريط الكاشير`, 'success');
    },

    importInventoryToF7() {
      const prods = (window.AppState.products || []).filter((p) => !p.hide_from_pos);
      if (!prods.length) {
        if (window.showToast) window.showToast('لا توجد منتجات في المخزن حالياً', 'warning');
        return;
      }
      const list = this.getButtons();
      let added = 0;
      const topList = prods.filter((p) => p.is_featured).concat(prods).slice(0, 8);
      topList.forEach((p) => {
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

    createCustomQuickButton() {
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

    renderF7Cards() {
      const grid = document.getElementById('quickTouchButtonsGrid');
      const tabsBox = document.getElementById('s2F7CategoryTabs');
      if (!grid) return;

      const list = this.getButtons();
      const q = String(document.getElementById('s2F7SearchInput')?.value || '').trim().toLowerCase();

      const cats = ['all', 'pinned', 'inventory', ...new Set(list.map((b) => b.category || 'عام'))];
      if (tabsBox) {
        const names = { all: 'الكل', pinned: '📌 المثبتة في الكاشير', inventory: '📦 منتجات المخزن' };
        tabsBox.innerHTML = cats.map((c) => `
          <button type="button" onclick="GherbiStage2.activeF7Tab='${c}'; GherbiStage2.renderF7Cards();"
            class="px-2.5 py-1 rounded-lg font-black text-[11px] whitespace-nowrap transition ${
              this.activeF7Tab === c ? 'bg-emerald-600 text-white shadow' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
        grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 font-bold">لا توجد أزرار مطابقة للبحث</div>';
        return;
      }

      grid.innerHTML = filtered.map(({ item, idx }) => {
        const prod = item.productId ? (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId)) : null;
        const price = prod ? Number(prod.selling_price || item.price || 0) : Number(item.price || 0);
        const stockBadge = prod ? `📦 مخزون: ${Number(prod.total_stock ?? prod.stock ?? 0)}` : '⚡ سريع';
        const isPinned = item.pinned !== false;

        return `
          <div onclick="GherbiStage2.fireQuickButton(${idx}, true)" class="s2-f7-card ${prod ? 'is-stock-linked' : ''}">
            <div class="flex items-center justify-between gap-1">
              <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">${stockBadge}</span>
              <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                <button type="button" onclick="GherbiStage2.togglePin(${idx})" title="تثبيت أو إخفاء من الشريط الرئيسي"
                  class="px-1.5 py-0.5 rounded text-[10px] font-black ${isPinned ? 'bg-amber-500/20 text-amber-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}">📌</button>
                <button type="button" onclick="GherbiStage2.openEditQuickButton(${idx})" title="تعديل السعر أو الاسم"
                  class="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 text-[10px]">✏️</button>
                <button type="button" onclick="GherbiStage2.removeQuickButton(${idx})" title="حذف الزر"
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

    renderPinnedDockBar() {
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
          const titleName = prod ? prod.name : b.name;
          return `
            <div onclick="GherbiStage2.fireQuickButton(${idx}, false)"
                 oncontextmenu="event.preventDefault(); GherbiStage2.openEditQuickButton(${idx});"
                 class="gherbi-pinned-f7-chip" title="انقر للإضافة للسلة فوراً | نقرة يمين لتعديل السعر أو الخصائص">
              <span>${b.icon || '⚡'}</span>
              <span>${titleName}</span>
              <span class="font-mono font-black text-emerald-600 dark:text-emerald-400">${price.toFixed(0)} د.ج</span>
            </div>
          `;
        }).join('')}
      `;
    },

    fireQuickButton(idx, closeModal = false) {
      const list = this.getButtons();
      const item = list[idx];
      if (!item || !window.App) return;

      if (item.productId) {
        const prod = (window.AppState.products || []).find((p) => Number(p.id) === Number(item.productId));
        if (prod && typeof window.App.addProductToCart === 'function') {
          window.App.addProductToCart(prod.id, 1);
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

    removeQuickButton(idx) {
      const list = this.getButtons();
      if (!list[idx]) return;
      list.splice(idx, 1);
      this.saveButtons(list);
    },

    openEditQuickButton(idx) {
      const list = this.getButtons();
      const item = list[idx];
      if (!item) return;
      this.buildQuickButtonEditModal();

      document.getElementById('s2QbEditIdx').value = String(idx);
      document.getElementById('s2QbEditIcon').value = item.icon || '⚡';
      document.getElementById('s2QbEditName').value = item.name || '';
      document.getElementById('s2QbEditPrice').value = Number(item.price || 0);
      document.getElementById('s2QbEditCat').value = item.category || 'خدمات سريعة';
      document.getElementById('s2QbEditPinned').checked = item.pinned !== false;
      document.getElementById('s2QbEditNoLoyalty').checked = Boolean(item.noLoyalty);

      window.App.openModal('quickBtnEditModal');
    },

    saveQuickButtonEdit() {
      const idx = parseInt(document.getElementById('s2QbEditIdx')?.value || '-1', 10);
      const list = this.getButtons();
      if (!list[idx]) return;

      list[idx].icon = document.getElementById('s2QbEditIcon')?.value?.trim() || '⚡';
      list[idx].name = document.getElementById('s2QbEditName')?.value?.trim() || list[idx].name;
      list[idx].price = Math.max(0, parseFloat(document.getElementById('s2QbEditPrice')?.value || '0') || 0);
      list[idx].category = document.getElementById('s2QbEditCat')?.value?.trim() || 'خدمات سريعة';
      list[idx].pinned = Boolean(document.getElementById('s2QbEditPinned')?.checked);
      list[idx].noLoyalty = Boolean(document.getElementById('s2QbEditNoLoyalty')?.checked);

      this.saveButtons(list);
      window.App.closeModal('quickBtnEditModal');
      if (window.showToast) window.showToast('✅ تم حفظ تعديلات زر اللمس السريع', 'success');
    },

    // ========================================================================
    // 5. محرك "فارق النقاط الذكي (Delta Loyalty Engine)" عند تعديل مبيعة سابقة من السجل
    // ========================================================================
    calcEligiblePointsForCart(items = [], discount = 0) {
      let eligibleAmount = 0;
      items.forEach((it) => {
        const sub = Number(it.subtotal ?? (Number(it.quantity || 1) * Number(it.price || 0)));
        if (it._noLoyalty) return;
        const pid = it.product_id || it.productId;
        const mult = pid && window.RetailV3 ? window.RetailV3.getProductLoyaltyMultiplier(pid) : 1;
        eligibleAmount += sub * mult;
      });
      const netAmount = Math.max(0, eligibleAmount - Number(discount || 0));
      return Math.floor(netAmount / 100);
    },

    setupDeltaLoyaltyForEditedSales() {
      // التقاط النقاط الأصلية للفاتورة بمجرد دخول السلة في وضع تعديل فاتورة سابقة
      const captureOriginalSaleSnapshot = () => {
        const cart = window.App?.currentCart;
        if (!cart) return;
        const activeEditId = cart.editingSaleId || window.AppState?.editingSaleId;
        if (activeEditId && cart._snapshotEditSaleId !== activeEditId) {
          cart._snapshotEditSaleId = activeEditId;
          cart._snapshotOriginalPoints = this.calcEligiblePointsForCart(cart.items || [], cart.discount || 0);
          cart._snapshotOriginalCustomerId = Number(cart.customerId || 0);
        } else if (!activeEditId && cart._snapshotEditSaleId) {
          delete cart._snapshotEditSaleId;
          delete cart._snapshotOriginalPoints;
          delete cart._snapshotOriginalCustomerId;
        }
      };
      setInterval(captureOriginalSaleSnapshot, 300);

      // اعتراض تأكيد الفاتورة لضبط نقاط الزبون الوفي على الفارق فقط (NewPoints - OldPoints)
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fnName) => {
        const origFn = window.App[fnName]?.bind(window.App);
        if (!origFn || window.App['_s2DeltaLoyalty_' + fnName]) return;

        window.App[fnName] = async function (...args) {
          const cart = window.App.currentCart;
          const isEditingSale = Boolean(cart?.editingSaleId || window.AppState?.editingSaleId || cart?._snapshotEditSaleId);
          const cid = Number(cart?.customerId || 0);
          const oldEarnedPts = Number(cart?._snapshotOriginalPoints ?? 0);
          const newEarnedPts = Stage2.calcEligiblePointsForCart(cart?.items || [], cart?.discount || 0);

          const cust = cid ? (window.AppState.customers || []).find((c) => Number(c.id) === cid) : null;
          const pointsBeforeSave = cust ? Number(cust.loyalty_points || 0) : 0;

          const res = await origFn(...args);

          if (cid && cust) {
            let finalCorrectPoints = pointsBeforeSave;

            if (isEditingSale) {
              // إضافة الفارق فقط (إذا أضاف سلعة جديدة يزيد الفارق، وإذا لم يضف شيئاً يبقى الفارق 0)
              const deltaPts = newEarnedPts - oldEarnedPts;
              finalCorrectPoints = Math.max(0, pointsBeforeSave + deltaPts);

              if (window.showToast) {
                const sign = deltaPts >= 0 ? '+' + deltaPts : String(deltaPts);
                window.showToast(
                  `👑 تحديث الفاتورة المعدلة: النقاط السابقة (${oldEarnedPts}) ⬅ الجديدة (${newEarnedPts}) | تم احتساب الفارق فقط (${sign} نقطة)`,
                  'info'
                );
              }
            } else {
              // فاتورة جديدة: نضيف فقط النقاط المؤهلة (مع احترام المنتجات المستثناة من الولاء)
              finalCorrectPoints = Math.max(0, pointsBeforeSave + newEarnedPts);
            }

            cust.loyalty_points = finalCorrectPoints;
            if (window.api?.updateCustomer) {
              await window.api.updateCustomer(cid, { ...cust, loyalty_points: finalCorrectPoints }).catch(() => {});
            }
            window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
          }

          return res;
        };
        window.App['_s2DeltaLoyalty_' + fnName] = true;
      });
    }
  };

  window.GherbiStage2 = Stage2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Stage2.init());
  } else {
    Stage2.init();
  }
})();
