/**
 * gherbi-v9-dual-price-and-owner-radar.js (V12 Master Edition)
 * - F12: يركز ويظلل "الإجمالي في الشريحة" (الرقم الأيسر المشار إليه في الصورة 1).
 * - Alt+P أو F11: يركز ويظلل "السعر الأوسط" (سعر الوحدة في وسط السطر).
 * - Alt+Q: يركز ويظلل خانة "الكمية".
 * - شريط أزرار ثلاثي مباشر لاختيار وضع التغيير: [⚖️ ينقص الكمية] | [🏷️ يخفض السعر] | [🧠 ذكي] + اختصار (Alt+S) و (Alt+T).
 * - خالٍ تماماً من الارتعاش (Zero-Flicker) مع حفظ اسم المنتج وتفاصيله.
 */

'use strict';

(function initGherbiV12MasterEngine() {
  const RADAR_STORAGE_KEY = 'gherbi_owner_price_radar_v9';
  const SUBTOTAL_MODE_KEY = 'gherbi_subtotal_edit_mode_v10'; // 'qty' | 'price' | 'smart'

  const V9Engine = {
    activeRadarFilter: 'all',
    subtotalEditMode: localStorage.getItem(SUBTOTAL_MODE_KEY) || 'qty',
    selectedRowIdx: 0,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);

        this.disableConflictingLegacyCartRowTimers();
        this.injectModeControlToolbarInPos();
        this.hookCartLifecycleMethods();
        this.bindMasterRowKeyboardShortcuts();
        this.hookAnalyticsViewForOwnerRadar();

        if (typeof window.App.renderCartItems === 'function') {
          window.App.renderCartItems();
        }
        this.decorateAllCartRowsOnce();

        setInterval(() => {
          this.injectModeControlToolbarInPos();
          this.decorateAllCartRowsOnce();
          this.ensureOwnerRadarRenderedInAnalytics();
        }, 350);

        console.log('🚀 [Gherbi V12 Ready]: F12 للإجمالي + Alt+P/F11 للسعر الأوسط + أزرار التحكم في الكمية/السعر نشطة 100%.');
      }, 180);
    },

    disableConflictingLegacyCartRowTimers() {
      if (window.GherbiMasterUpgrade) {
        window.GherbiMasterUpgrade.enhanceCartRowsAndStockForecast = function () {};
        window.GherbiMasterUpgrade.focusLastItemPriceWithF12 = () => this.focusLineSubtotalWithF12();
      }
      if (window.GherbiMasterUpgrades) {
        window.GherbiMasterUpgrades.enhanceCartItemsRows = function () {};
        window.GherbiMasterUpgrades.triggerF12PriceEdit = () => this.focusLineSubtotalWithF12();
      }
      if (window.RetailMaster) {
        window.RetailMaster.upgradeCartItemsWithLiveStockAndCostGuard = function () {};
      }
    },

    // ========================================================================
    // 1. دوال التركيز المباشر على الخانات الثلاث في الشريحة (F12 | Alt+P / F11 | Alt+Q)
    // ========================================================================
    getValidSelectedRowIndex() {
      const items = window.App?.currentCart?.items || [];
      if (!items.length) return -1;
      if (this.selectedRowIdx >= 0 && this.selectedRowIdx < items.length) {
        return this.selectedRowIdx;
      }
      this.selectedRowIdx = items.length - 1;
      return this.selectedRowIdx;
    },

    selectCartRow(idx) {
      const items = window.App?.currentCart?.items || [];
      if (!items.length) return;
      this.selectedRowIdx = Math.max(0, Math.min(idx, items.length - 1));
      if (window.AppState) window.AppState.selectedCartRowIdx = this.selectedRowIdx;

      const cartBox = document.getElementById('posCartItems');
      if (!cartBox) return;
      const rows = Array.from(cartBox.children).filter(
        (el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة')
      );
      rows.forEach((r, i) => r.classList.toggle('gherbi-active-cart-row', i === this.selectedRowIdx));
    },

    // F12 -> يركز ويظلل "الإجمالي في الشريحة" (الرقم الأيسر المشار إليه بالدائرة الزرقاء في الصورة 1)
    focusLineSubtotalWithF12(targetIdx = null) {
      this.decorateAllCartRowsOnce();
      const idx = targetIdx !== null ? targetIdx : this.getValidSelectedRowIndex();
      if (idx < 0) {
        if (window.showToast) window.showToast('⚠️ السلة فارغة — أضف سلعة أولاً لتعديل إجمالي الشريحة (F12)', 'warning');
        return;
      }
      this.selectCartRow(idx);
      const subInputs = Array.from(document.querySelectorAll('#posCartItems .gherbi-line-subtotal-input'));
      const targetInp = subInputs[idx] || subInputs[subInputs.length - 1];
      if (targetInp) {
        targetInp.focus();
        targetInp.select();
      }
    },

    // Alt+P أو F11 -> يركز ويظلل "السعر الأوسط" (سعر الوحدة في وسط الشريحة)
    focusMiddleUnitPriceInput(targetIdx = null) {
      this.decorateAllCartRowsOnce();
      const idx = targetIdx !== null ? targetIdx : this.getValidSelectedRowIndex();
      if (idx < 0) {
        if (window.showToast) window.showToast('⚠️ السلة فارغة — أضف سلعة أولاً لتعديل السعر الأوسط (Alt+P)', 'warning');
        return;
      }
      this.selectCartRow(idx);
      const priceInputs = Array.from(document.querySelectorAll('#posCartItems .gherbi-middle-unit-price-input'));
      const targetInp = priceInputs[idx] || priceInputs[priceInputs.length - 1];
      if (targetInp) {
        targetInp.focus();
        targetInp.select();
      }
    },

    // Alt+Q -> يركز ويظلل خانة "الكمية" في الشريحة
    focusQuantityInput(targetIdx = null) {
      this.decorateAllCartRowsOnce();
      const idx = targetIdx !== null ? targetIdx : this.getValidSelectedRowIndex();
      if (idx < 0) {
        if (window.showToast) window.showToast('⚠️ السلة فارغة — أضف سلعة أولاً لتعديل الكمية (Alt+Q)', 'warning');
        return;
      }
      this.selectCartRow(idx);
      const qtyInputs = Array.from(document.querySelectorAll('#posCartItems .gherbi-cart-qty-input-wide'));
      const targetInp = qtyInputs[idx] || qtyInputs[qtyInputs.length - 1];
      if (targetInp) {
        targetInp.focus();
        targetInp.select();
      }
    },

    // ========================================================================
    // 2. شريط الأزرار الثلاثي للتحكم في تغيير الكمية (0.8) أو تخفيض السعر
    // ========================================================================
    setSubtotalEditMode(mode) {
      const validModes = ['qty', 'price', 'smart'];
      if (!validModes.includes(mode)) return;
      this.subtotalEditMode = mode;
      localStorage.setItem(SUBTOTAL_MODE_KEY, mode);
      this.refreshModeControlButtonsUI();

      if (window.showToast) {
        const messages = {
          qty: '⚖️ تم تفعيل وضع: إنقاص/تغيير الكمية تلقائياً (1 ⬅ 0.8) عند تعديل الإجمالي (F12)',
          price: '🏷️ تم تفعيل وضع: تخفيض/تغيير السعر عند تعديل الإجمالي (F12) مع بقاء الكمية ثابتة',
          smart: '🧠 تم تفعيل الوضع الذكي: يغير الكمية (0.8) بالحبة/الميزان، ويغير السعر في الكرتونة'
        };
        window.showToast(messages[mode], 'info');
      }
    },

    cycleSubtotalEditMode() {
      const order = ['qty', 'price', 'smart'];
      const next = order[(order.indexOf(this.subtotalEditMode) + 1) % order.length];
      this.setSubtotalEditMode(next);
    },

    refreshModeControlButtonsUI() {
      const m = this.subtotalEditMode;
      const btnQty = document.getElementById('v12ModeBtnQty');
      const btnPrice = document.getElementById('v12ModeBtnPrice');
      const btnSmart = document.getElementById('v12ModeBtnSmart');

      if (btnQty) btnQty.className = 'gherbi-v12-mode-btn ' + (m === 'qty' ? 'active-qty' : '');
      if (btnPrice) btnPrice.className = 'gherbi-v12-mode-btn ' + (m === 'price' ? 'active-price' : '');
      if (btnSmart) btnSmart.className = 'gherbi-v12-mode-btn ' + (m === 'smart' ? 'active-smart' : '');
    },

    injectModeControlToolbarInPos() {
      // إزالة الزر الفردي القديم إن وجد واستبداله بشريط أزرار التحكم المتكامل
      document.getElementById('gherbiSubtotalModeSwitchBtn')?.remove();

      const multStrip = document.querySelector('.gherbi-multiplier-strip') || document.getElementById('posQuickMultiplierBar');
      if (!multStrip || document.getElementById('gherbiV12ModeControlBar')) return;

      const bar = document.createElement('div');
      bar.id = 'gherbiV12ModeControlBar';
      bar.className = 'flex items-center gap-1.5 flex-wrap';
      bar.innerHTML = `
        <div class="gherbi-v12-mode-segmented-bar" title="اختر ماذا يتغير عندما تعدل خانة الإجمالي (F12) — اختصار التبديل: Alt+S">
          <span class="text-[9.5px] font-black text-slate-500 px-1.5">الإجمالي (F12) يغير:</span>
          <button type="button" id="v12ModeBtnQty" onclick="GherbiV9Engine.setSubtotalEditMode('qty')" class="gherbi-v12-mode-btn">
            ⚖️ الكمية (0.8)
          </button>
          <button type="button" id="v12ModeBtnPrice" onclick="GherbiV9Engine.setSubtotalEditMode('price')" class="gherbi-v12-mode-btn">
            🏷️ السعر
          </button>
          <button type="button" id="v12ModeBtnSmart" onclick="GherbiV9Engine.setSubtotalEditMode('smart')" class="gherbi-v12-mode-btn">
            🧠 ذكي
          </button>
        </div>

        <button type="button" onclick="GherbiV9Engine.focusMiddleUnitPriceInput()"
          class="px-2 py-0.5 rounded-md bg-sky-500/15 hover:bg-sky-600 text-sky-700 dark:text-sky-300 hover:text-white border border-sky-500/30 text-[10px] font-black transition flex items-center gap-1"
          title="القفز مباشرة لتعديل السعر الأوسط للسلعة (اختصار: Alt+P أو F11)">
          <span>🏷️ السعر الأوسط</span>
          <kbd class="font-mono text-[9px] bg-black/15 px-1 rounded" dir="ltr">Alt+P</kbd>
        </button>
      `;

      multStrip.appendChild(bar);
      this.refreshModeControlButtonsUI();
    },

    // ========================================================================
    // 3. الاختصارات الشاملة للتحكم في الشريحة (F12 | Alt+P / F11 | Alt+Q | Alt+S | Alt+T | ↑ / ↓)
    // ========================================================================
    bindMasterRowKeyboardShortcuts() {
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;

          // عدم مقاطعة النوافذ المنبثقة المفتوحة
          const openModal = document.querySelector('.modal-overlay.active, #gherbiAisleKioskOverlay.active');
          if (openModal) return;

          // 1. F12 -> التركيز الفوري على "الإجمالي في الشريحة" (الرقم الأيسر المشار إليه في الصورة 1)
          if (e.key === 'F12') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusLineSubtotalWithF12();
            return;
          }

          // 2. Alt + P أو F11 -> التركيز الفوري على "السعر الأوسط" (سعر الوحدة)
          if (e.key === 'F11' || (e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusMiddleUnitPriceInput();
            return;
          }

          // 3. Alt + Q -> التركيز الفوري على خانة "الكمية"
          if (e.altKey && (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusQuantityInput();
            return;
          }

          // 4. Alt + S -> تبديل وضع عمل الإجمالي (كمية 0.8 ⇄ سعر ⇄ ذكي)
          if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
            e.preventDefault();
            e.stopPropagation();
            this.cycleSubtotalEditMode();
            return;
          }

          // 5. Alt + T -> قلب السطر المحدد فوراً بين (كمية جزئية 1.04 = 1040غ ⇄ تخفيض سعر بكمية 1)
          if (e.altKey && (e.key === 't' || e.key === 'T' || e.code === 'KeyT')) {
            e.preventDefault();
            e.stopPropagation();
            const idx = this.getValidSelectedRowIndex();
            if (idx >= 0) {
              this.convertRowBetweenFractionalQtyAndPriceDiscount(idx);
            }
            return;
          }

          // 6. Alt + G -> فتح محطة الميزان الإلكتروني المباشر
          if (e.altKey && (e.key === 'g' || e.key === 'G' || e.code === 'KeyG')) {
            e.preventDefault();
            e.stopPropagation();
            window.App.openPosScaleModal?.();
            return;
          }

          // 7. Alt + B -> فتح شاشة فاحص الأسعار الذاتي للزبائن (Borne de Prix)
          if (e.altKey && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) {
            e.preventDefault();
            e.stopPropagation();
            window.GherbiV7Stage2?.openKioskMode?.();
            return;
          }

          // 8. Alt + H -> فتح دليل ومركز الاختصارات الشامل
          if (e.altKey && (e.key === 'h' || e.key === 'H' || e.code === 'KeyH')) {
            e.preventDefault();
            e.stopPropagation();
            window.GherbiV6Stage2?.openShortcutsHub?.();
            return;
          }

          // 9. الأسهم (↑ / ↓) للتنقل بين سطور السلة عندما لا يكون المؤشر داخل قائمة بحث
          const activeTag = (document.activeElement?.tagName || '').toLowerCase();
          if (activeTag !== 'select' && activeTag !== 'textarea' && document.activeElement?.id !== 'globalPosSearch') {
            const items = window.App?.currentCart?.items || [];
            if (items.length > 1 && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.ctrlKey && !e.altKey) {
              const inCartInput = document.activeElement?.closest('#posCartItems');
              if (!inCartInput || e.target.id === 'barcodeInput') {
                e.preventDefault();
                const cur = this.getValidSelectedRowIndex();
                const next = e.key === 'ArrowUp' ? Math.max(0, cur - 1) : Math.min(items.length - 1, cur + 1);
                this.selectCartRow(next);
              }
            }
          }
        },
        true
      );
    },

    // ========================================================================
    // 4. التبديل الفوري داخل السطر بين (كمية جزئية 1.04 = 1040غ ⇄ تخفيض/تعديل سعر كمية 1)
    // ========================================================================
    convertRowBetweenFractionalQtyAndPriceDiscount(idx) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );
      const baseRetailPrice = Number(item._savedUnitPrice || prod?.selling_price || prod?.price || 125);
      const currentSubtotal = Number(item.subtotal ?? (Number(item.quantity || 1) * Number(item.price || 0)));
      const currentQty = Math.abs(Number(item.quantity || 1));
      const sign = Number(item.quantity || 1) < 0 ? -1 : 1;
      const isCurrentlyFractional = Math.abs(currentQty - Math.round(currentQty)) > 0.001;

      if (isCurrentlyFractional) {
        const targetWholeQty = Math.max(1, Math.round(currentQty) || 1);
        const newDiscountedPrice = Number((currentSubtotal / targetWholeQty).toFixed(2));

        item.quantity = targetWholeQty * sign;
        item.price = newDiscountedPrice;
        item.custom_price = newDiscountedPrice;
        item.subtotal = Number((currentSubtotal * sign).toFixed(2));
        item._editedFromSubtotalBox = true;
        item._manualLineSubtotal = item.subtotal;
        item._lastSubtotalEditType = 'price_discount';

        this.recordPriceModificationEvent(item, prod, baseRetailPrice, newDiscountedPrice, 'تحويل إلى تعديل سعر');
        window.App.recalcAndRenderCart?.();
        if (window.showToast) {
          window.showToast(`🏷️ تم التحويل إلى تعديل السعر الأوسط: الكمية (${targetWholeQty} قطعة) بسعر ${newDiscountedPrice.toFixed(2)} د.ج`, 'success');
        }
      } else if (baseRetailPrice > 0) {
        const newFracQty = Number((currentSubtotal / baseRetailPrice).toFixed(3));
        item._savedUnitPrice = baseRetailPrice;
        item.price = baseRetailPrice;
        delete item.custom_price;
        item.quantity = newFracQty * sign;
        item.subtotal = Number((currentSubtotal * sign).toFixed(2));
        item._editedFromSubtotalBox = true;
        item._manualLineSubtotal = item.subtotal;
        item._lastSubtotalEditType = 'fractional_qty';

        this.recordFractionalQuantityEvent(item, prod, currentQty, newFracQty, currentSubtotal);
        window.App.recalcAndRenderCart?.();
        if (window.showToast) {
          const grams = Math.round(newFracQty * 1000);
          window.showToast(`⚖️ تم التحويل إلى كمية جزئية بالمبلغ: (${newFracQty} = ${grams} غرام) بسعر الوحدة الأصلي ${baseRetailPrice.toFixed(2)} د.ج`, 'success');
        }
      }
    },

    applyUnitPriceChangeToRow(idx, newUnitPriceVal) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const parsedPrice = parseFloat(newUnitPriceVal);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );

      if (!item._savedUnitPrice) {
        item._savedUnitPrice = Number(prod?.selling_price ?? prod?.price ?? item.price ?? parsedPrice);
      }

      const oldPrice = Number(item.price || 0);
      const qty = Math.max(0.001, Math.abs(Number(item.quantity || 1)));
      const sign = Number(item.quantity || 1) < 0 ? -1 : 1;

      item._editedFromSubtotalBox = false;
      delete item._manualLineSubtotal;
      item._lastSubtotalEditType = 'unit_price';

      item.price = Number(parsedPrice.toFixed(2));
      item.custom_price = item.price;
      item.subtotal = Number((qty * sign * item.price).toFixed(2));

      if (item._isCartonPackMode) {
        const factor = Number(item._packQtyFactor || qty || 1);
        item._singlePackTotalDzd = Number((item.price * factor).toFixed(2));
      }

      this.recordPriceModificationEvent(item, prod, oldPrice, item.price, 'تعديل السعر الأوسط (Alt+P)');
      window.App.recalcAndRenderCart?.();
    },

    applyLineSubtotalChangeToRow(idx, newSubtotalVal, shiftKeyPressed = false) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const parsedTotal = parseFloat(newSubtotalVal);
      if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );

      const baseUnitPrice = Number(item._savedUnitPrice || prod?.selling_price || item.price || 1);
      if (!item._savedUnitPrice) item._savedUnitPrice = baseUnitPrice;

      const oldQty = Math.abs(Number(item.quantity || 1));
      const sign = Number(item.quantity || 1) < 0 ? -1 : 1;

      let shouldAdjustQuantity = false;
      if (this.subtotalEditMode === 'qty') {
        shouldAdjustQuantity = !shiftKeyPressed;
      } else if (this.subtotalEditMode === 'price') {
        shouldAdjustQuantity = shiftKeyPressed;
      } else {
        shouldAdjustQuantity = item._isCartonPackMode ? shiftKeyPressed : !shiftKeyPressed;
      }

      if (shouldAdjustQuantity && baseUnitPrice > 0) {
        const cleanQty = Number((parsedTotal / baseUnitPrice).toFixed(3));
        item.price = baseUnitPrice;
        item.quantity = cleanQty * sign;
        item.subtotal = Number((parsedTotal * sign).toFixed(2));
        item._editedFromSubtotalBox = true;
        item._manualLineSubtotal = item.subtotal;
        item._lastSubtotalEditType = 'fractional_qty';

        this.recordFractionalQuantityEvent(item, prod, oldQty, cleanQty, parsedTotal);
        window.App.recalcAndRenderCart?.();
        return;
      }

      const newUnitPrice = Number((parsedTotal / oldQty).toFixed(4));
      item._editedFromSubtotalBox = true;
      item._manualLineSubtotal = Number((parsedTotal * sign).toFixed(2));
      item.subtotal = item._manualLineSubtotal;
      item.price = newUnitPrice;
      item.custom_price = newUnitPrice;
      item._lastSubtotalEditType = 'price_discount';

      if (item._isCartonPackMode) {
        const packsCount = Math.max(1, Number(item._packsCount || 1));
        item._singlePackTotalDzd = Number((parsedTotal / packsCount).toFixed(2));
      }

      this.recordPriceModificationEvent(item, prod, baseUnitPrice, newUnitPrice, 'تعديل إجمالي الشريحة (F12)');
      window.App.recalcAndRenderCart?.();
    },

    hookCartLifecycleMethods() {
      if (typeof window.App.updateCartItemPrice === 'function' && !window.App._v12UpdatePriceHooked) {
        window.App.updateCartItemPrice = (idx, val) => {
          this.applyUnitPriceChangeToRow(idx, val);
        };
        window.App._v12UpdatePriceHooked = true;
      }

      if (typeof window.App.updateCartItemQty === 'function' && !window.App._v12UpdateQtyHooked) {
        const origUpdateQty = window.App.updateCartItemQty.bind(window.App);
        window.App.updateCartItemQty = (idx, val) => {
          const item = window.App?.currentCart?.items?.[idx];
          if (item) {
            item._editedFromSubtotalBox = false;
            delete item._manualLineSubtotal;
          }
          return origUpdateQty(idx, val);
        };
        window.App._v12UpdateQtyHooked = true;
      }

      ['renderCartItems', 'recalcAndRenderCart', 'renderPosView'].forEach((fnName) => {
        const orig = window.App[fnName]?.bind(window.App);
        if (orig && !window.App['_v12Hook_' + fnName]) {
          window.App[fnName] = function (...args) {
            const res = orig(...args);
            V9Engine.decorateAllCartRowsOnce();
            return res;
          };
          window.App['_v12Hook_' + fnName] = true;
        }
      });
    },

    formatCleanQtyString(q) {
      const num = Number(Number(q || 0).toFixed(3));
      return String(num);
    },

    // ========================================================================
    // 5. تزيين سطور السلة مع شارات الاختصارات (F12 | Alt+P | Alt+Q) بدون ارتعاش
    // ========================================================================
    decorateAllCartRowsOnce() {
      const cartBox = document.getElementById('posCartItems');
      if (!cartBox) return;

      const items = window.App?.currentCart?.items || [];
      const rows = Array.from(cartBox.children).filter(
        (el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة')
      );

      if (this.selectedRowIdx >= items.length) {
        this.selectedRowIdx = Math.max(0, items.length - 1);
      }

      rows.forEach((row, idx) => {
        const item = items[idx];
        if (!item) return;

        row.classList.toggle('gherbi-active-cart-row', idx === this.selectedRowIdx);
        if (!row.dataset.v12RowClickBound) {
          row.dataset.v12RowClickBound = '1';
          row.addEventListener('mousedown', () => {
            this.selectedRowIdx = idx;
            rows.forEach((r, i) => r.classList.toggle('gherbi-active-cart-row', i === idx));
          });
        }

        const prod = (window.AppState?.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );

        const qty = Math.abs(Number(item.quantity || 1));
        const unitPrice = Number(item.price || 0);
        const baseRetailPrice = Number(item._savedUnitPrice || prod?.selling_price || prod?.price || unitPrice);
        const lineSubtotal = Number(item.subtotal !== undefined ? item.subtotal : (qty * unitPrice));
        const availableStock = prod ? Number(prod.total_stock ?? prod.stock ?? 0) : null;
        const remainingStock = availableStock !== null ? Number((availableStock - qty).toFixed(2)) : null;

        const rowSignature = `v12_${idx}_${item.name}_${qty}_${unitPrice.toFixed(2)}_${lineSubtotal.toFixed(2)}_${Boolean(item._isCartonPackMode)}_${remainingStock}`;

        // 1. حماية اسم المنتج وتحديث شارة المخزون الورقية فقط
        const rightInfoCol = row.firstElementChild;
        if (rightInfoCol && !(rightInfoCol.textContent || '').includes(item.name || prod?.name || '')) {
          const pTitle = item.name || prod?.name || 'سلعة';
          const uName = prod?.unit || item.unit || 'قطعة';
          rightInfoCol.innerHTML = `
            <div class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${pTitle}</div>
            <div class="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
              <span>${unitPrice.toFixed(2)} د.ج / ${uName}</span>
              ${
                availableStock !== null
                  ? `<span class="gherbi-leaf-stock-badge px-2 py-0.5 rounded-md font-bold text-[10.5px] ${
                      remainingStock <= 0 ? 'bg-rose-500/15 text-rose-600' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    }">📦 متوفر: ${availableStock} ⬅ يبقى: ${remainingStock} ${uName}</span>`
                  : ''
              }
            </div>
          `;
        } else if (rightInfoCol && availableStock !== null) {
          const leafBadges = Array.from(rightInfoCol.querySelectorAll('span')).filter(
            (sp) => sp.children.length === 0 && (sp.textContent || '').includes('متوفر:')
          );
          leafBadges.forEach((sp) => {
            const newStockTxt = `📦 متوفر: ${availableStock} ⬅ يبقى: ${remainingStock} ${prod?.unit || 'قطعة'}`;
            if (sp.textContent !== newStockTxt) sp.textContent = newStockTxt;
          });
        }

        // 2. تنسيق حقل الكمية (Alt+Q) وحقل السعر الأوسط (Alt+P / F11)
        const allInputs = Array.from(row.querySelectorAll('input')).filter(
          (inp) => !inp.classList.contains('gherbi-line-subtotal-input')
        );
        const qtyInp = allInputs.length >= 1 ? allInputs[0] : null;
        const unitPriceInp = allInputs.length >= 2 ? allInputs[allInputs.length - 1] : null;

        if (qtyInp) {
          qtyInp.type = 'text';
          qtyInp.inputMode = 'decimal';
          qtyInp.classList.add('gherbi-cart-qty-input-wide');
          qtyInp.title = 'الكمية (اختصار: Alt+Q)';
          const formattedQty = this.formatCleanQtyString(qty);
          if (document.activeElement !== qtyInp && qtyInp.value !== formattedQty) {
            qtyInp.value = formattedQty;
          }
          if (!qtyInp.parentElement.classList.contains('gherbi-field-kbd-box')) {
            const qWrap = document.createElement('div');
            qWrap.className = 'gherbi-field-kbd-box';
            qtyInp.parentNode.insertBefore(qWrap, qtyInp);
            qWrap.appendChild(qtyInp);
            const qTag = document.createElement('span');
            qTag.className = 'gherbi-mini-kbd-tag tag-altq';
            qTag.dir = 'ltr';
            qTag.textContent = 'Alt+Q';
            qWrap.appendChild(qTag);
          }
        }

        if (unitPriceInp) {
          unitPriceInp.classList.add('gherbi-middle-unit-price-input');
          unitPriceInp.title = 'السعر الأوسط للوحدة (اختصار: Alt+P أو F11)';
          if (document.activeElement !== unitPriceInp) {
            if (unitPriceInp.value !== unitPrice.toFixed(2)) {
              unitPriceInp.value = unitPrice.toFixed(2);
            }
          }
          if (!unitPriceInp.parentElement.classList.contains('gherbi-field-kbd-box')) {
            const pWrap = document.createElement('div');
            pWrap.className = 'gherbi-field-kbd-box';
            unitPriceInp.parentNode.insertBefore(pWrap, unitPriceInp);
            pWrap.appendChild(unitPriceInp);
            const pTag = document.createElement('span');
            pTag.className = 'gherbi-mini-kbd-tag tag-altp';
            pTag.dir = 'ltr';
            pTag.textContent = 'Alt+P';
            pWrap.appendChild(pTag);
          }
          if (!unitPriceInp.dataset.v12PriceBound) {
            unitPriceInp.dataset.v12PriceBound = '1';
            unitPriceInp.removeAttribute('onchange');
            unitPriceInp.removeAttribute('oninput');

            const commitPrice = () => {
              const val = parseFloat(unitPriceInp.value);
              if (Number.isFinite(val) && Math.abs(val - Number(item.price || 0)) > 0.005) {
                this.applyUnitPriceChangeToRow(idx, val);
              }
            };
            unitPriceInp.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                commitPrice();
                unitPriceInp.blur();
                window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
              }
            });
            unitPriceInp.addEventListener('change', commitPrice);
          }
        }

        // 3. تحويل إجمالي الشريحة الأيسر (المشار إليه في الصورة 1) إلى حقل مرتبط بـ (F12)
        let subInput = row.querySelector('.gherbi-line-subtotal-input');
        if (!subInput) {
          const trashBtn = row.querySelector('button[onclick*="removeFromCart"], button[onclick*="removeCartItem"], .text-rose-500');
          let targetPriceTextEl = null;

          if (trashBtn && trashBtn.parentElement) {
            targetPriceTextEl = Array.from(trashBtn.parentElement.children).find(
              (el) =>
                el !== trashBtn &&
                el.tagName !== 'INPUT' &&
                !el.querySelector('input') &&
                /^-?[0-9]+(\.[0-9]+)?(\s*د\.ج)?$/.test((el.textContent || '').trim())
            );
          }

          if (!targetPriceTextEl) {
            targetPriceTextEl = Array.from(row.querySelectorAll('span, div')).find(
              (el) => el.children.length === 0 && /^-?[0-9]+\.[0-9]{2}$/.test((el.textContent || '').trim())
            );
          }

          if (targetPriceTextEl) {
            const sWrap = document.createElement('div');
            sWrap.className = 'gherbi-field-kbd-box';

            subInput = document.createElement('input');
            subInput.type = 'number';
            subInput.step = 'any';
            subInput.className = 'gherbi-line-subtotal-input';
            subInput.title = 'إجمالي الشريحة (اختصار: F12) — اكتب المبلغ واضغط Enter';

            const f12Tag = document.createElement('span');
            f12Tag.className = 'gherbi-mini-kbd-tag tag-f12';
            f12Tag.dir = 'ltr';
            f12Tag.textContent = 'F12';

            sWrap.appendChild(subInput);
            sWrap.appendChild(f12Tag);
            targetPriceTextEl.replaceWith(sWrap);
          }
        } else if (!subInput.parentElement.classList.contains('gherbi-field-kbd-box')) {
          const sWrap = document.createElement('div');
          sWrap.className = 'gherbi-field-kbd-box';
          subInput.parentNode.insertBefore(sWrap, subInput);
          sWrap.appendChild(subInput);
          const f12Tag = document.createElement('span');
          f12Tag.className = 'gherbi-mini-kbd-tag tag-f12';
          f12Tag.dir = 'ltr';
          f12Tag.textContent = 'F12';
          sWrap.appendChild(f12Tag);
        }

        if (subInput) {
          if (document.activeElement !== subInput && subInput.value !== lineSubtotal.toFixed(2)) {
            subInput.value = lineSubtotal.toFixed(2);
          }
          if (!subInput.dataset.v12SubBound) {
            subInput.dataset.v12SubBound = '1';
            subInput.addEventListener('click', (e) => {
              e.stopPropagation();
              subInput.select();
            });
            subInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.applyLineSubtotalChangeToRow(idx, subInput.value, e.shiftKey);
                subInput.blur();
                window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
              }
            });
            subInput.addEventListener('change', () => {
              const val = parseFloat(subInput.value);
              if (Number.isFinite(val) && Math.abs(val - lineSubtotal) > 0.01) {
                this.applyLineSubtotalChangeToRow(idx, val, false);
              }
            });
          }
        }

        if (row.dataset.v12Sig === rowSignature && row.querySelector('.gherbi-v11-row-tools')) {
          return;
        }
        row.dataset.v12Sig = rowSignature;

        if (rightInfoCol) {
          Array.from(rightInfoCol.querySelectorAll('button, .gherbi-v8-pack-bar')).forEach((oldEl) => {
            if (!oldEl.closest('.gherbi-v11-row-tools')) {
              oldEl.style.display = 'none';
            }
          });
        }

        let toolsBar = row.querySelector('.gherbi-v11-row-tools');
        if (!toolsBar && rightInfoCol) {
          toolsBar = document.createElement('div');
          toolsBar.className = 'gherbi-v11-row-tools';
          rightInfoCol.appendChild(toolsBar);
        }
        if (!toolsBar) return;

        const cfg = window.GherbiV8PackEngine
          ? window.GherbiV8PackEngine.resolvePackConfig(prod, item)
          : { isConfigured: false, packQty: 6, packUnitName: 'باكي', totalPackPriceDzd: unitPrice * 6, savingsPerPack: 0 };

        const isFractional = Math.abs(qty - Math.round(qty)) > 0.001;
        const isDiscountedUnit = !isFractional && !item._isCartonPackMode && Math.abs(unitPrice - baseRetailPrice) > 0.01;

        let htmlParts = [];

        if (item._isCartonPackMode) {
          const pCount = Number(item._packsCount || 1);
          const uLabel = cfg.isConfigured ? cfg.packUnitName : 'باكي (×6)';
          htmlParts.push(`
            <button type="button" onclick="GherbiV8PackEngine.revertRowToSingleUnit(${idx})"
              class="gherbi-v8-pack-toggle-btn is-pack-mode" title="اختصار التبديل: Alt+K">
              <span>📦 ${pCount} ${uLabel} (${qty} قطع = ${lineSubtotal.toFixed(0)} د.ج)</span>
              <span class="underline text-[9.5px] mr-1">⇄ بالحبة</span>
            </button>
            <button type="button" onclick="GherbiV8PackEngine.stepPacksOnRow(${idx}, 1)" class="gherbi-v8-pack-step-btn">+ ${uLabel}</button>
            <button type="button" onclick="GherbiV8PackEngine.stepPacksOnRow(${idx}, -1)" class="gherbi-v8-pack-step-btn">-</button>
          `);
        } else {
          const packBtnLabel = cfg.isConfigured
            ? `📦 ${cfg.packUnitName} (${cfg.packQty} قطع = ${cfg.totalPackPriceDzd.toFixed(0)} د.ج)`
            : `📦 باكي ×6 (${cfg.totalPackPriceDzd.toFixed(0)} د.ج)`;
          htmlParts.push(`
            <button type="button" onclick="GherbiV8PackEngine.applyPackModeToRow(${idx}, 1)"
              class="gherbi-v8-pack-toggle-btn is-unit-mode" title="تحويل إلى الكرتونة/الباكي (اختصار: Alt+K)">
              <span>${packBtnLabel}</span>
            </button>
          `);
        }

        if (isFractional) {
          const grams = Math.round(qty * 1000);
          htmlParts.push(`
            <button type="button" onclick="GherbiV9Engine.convertRowBetweenFractionalQtyAndPriceDiscount(${idx})"
              class="gherbi-v11-mode-convert-pill" title="اختصار التبديل المباشر: Alt+T">
              <span>⚖️ كمية جزئية (${this.formatCleanQtyString(qty)} = ${grams}غ)</span>
              <span class="underline">⇄ اجعلها تخفيض سعر (كمية 1) [Alt+T]</span>
            </button>
          `);
        } else if (isDiscountedUnit) {
          const diffDzd = Number((unitPrice - baseRetailPrice).toFixed(2));
          const fracEquiv = baseRetailPrice > 0 ? Number((lineSubtotal / baseRetailPrice).toFixed(2)) : 1;
          const gramsEquiv = Math.round(fracEquiv * 1000);
          htmlParts.push(`
            <button type="button" onclick="GherbiV9Engine.convertRowBetweenFractionalQtyAndPriceDiscount(${idx})"
              class="gherbi-v11-mode-convert-pill" title="اختصار التبديل المباشر: Alt+T">
              <span>🏷️ سعر معدل (${diffDzd > 0 ? '+' + diffDzd : diffDzd} د.ج)</span>
              <span class="underline">⇄ اجعلها كمية جزئية (${fracEquiv} = ${gramsEquiv}غ) [Alt+T]</span>
            </button>
          `);
        }

        if (remainingStock !== null && remainingStock < 0 && availableStock > 0) {
          htmlParts.push(`
            <button type="button" onclick="GherbiV9Engine.adjustPackToAvailableStock(${idx}, ${availableStock})"
              class="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] shadow-sm">
              ⚠️ بيع المتوفر فقط (${availableStock} قطعة)
            </button>
          `);
        }

        toolsBar.innerHTML = htmlParts.join('');
      });
    },

    adjustPackToAvailableStock(idx, availableStock) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item || availableStock <= 0) return;

      item._editedFromSubtotalBox = false;
      delete item._manualLineSubtotal;
      item.quantity = Number(availableStock);
      item.subtotal = Number((availableStock * Number(item.price || 0)).toFixed(2));
      window.App.recalcAndRenderCart?.();
    },

    // ========================================================================
    // 6. سجل ورادار صاحب المحل في صفحة الإحصائيات
    // ========================================================================
    getRadarLogs() {
      try {
        const raw = localStorage.getItem(RADAR_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (_) {
        return [];
      }
    },

    saveRadarLogs(list) {
      localStorage.setItem(RADAR_STORAGE_KEY, JSON.stringify((list || []).slice(0, 400)));
    },

    recordFractionalQuantityEvent(item, prod, oldQty, newQty, enteredTotalDzd) {
      const unitPrice = Number(item?.price || prod?.selling_price || 0);
      const costPrice = Number(prod?.cost_price ?? item?.cost_price ?? 0);
      const currentStock = Number(prod?.total_stock ?? prod?.stock ?? 0);
      const remainingStock = Number((currentStock - Math.abs(newQty)).toFixed(2));
      const netProfitOnLine = costPrice > 0 ? Number(((unitPrice - costPrice) * Math.abs(newQty)).toFixed(2)) : 0;

      const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value;
      const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;
      const seller = document.getElementById('currentUserName')?.textContent?.trim() || window.AppState?.currentUser?.name || 'المدير العام';
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const entry = {
        id: 'rad_qty_' + Date.now(),
        timestamp: new Date().toISOString(),
        dateFormatted: nowStr,
        seller,
        customerName: cust ? cust.name : 'زبون عابر',
        productId: prod?.id || item?.product_id || null,
        productName: item?.name || prod?.name || 'سلعة',
        saleMode: `⚖️ بيع بالمبلغ (الكمية: ${oldQty} ⬅ ${newQty})`,
        editSource: 'تعديل إجمالي الشريحة (F12)',
        quantity: Math.abs(newQty),
        stockBefore: currentStock,
        stockAfter: remainingStock,
        costPrice,
        originalUnitPrice: unitPrice,
        newUnitPrice: unitPrice,
        originalLineTotal: Number((oldQty * unitPrice).toFixed(2)),
        newLineTotal: Number(enteredTotalDzd.toFixed(2)),
        unitPriceDiff: 0,
        profitImpactDzd: 0,
        netProfitOnLine,
        category: 'fractional_qty'
      };

      const logs = this.getRadarLogs();
      const existingIdx = logs.findIndex(
        (l) => l.productName === entry.productName && String(l.dateFormatted).slice(0, 15) === nowStr.slice(0, 15)
      );
      if (existingIdx !== -1) logs[existingIdx] = entry;
      else logs.unshift(entry);
      this.saveRadarLogs(logs);
    },

    recordPriceModificationEvent(item, prod, oldUnitPrice, newUnitPrice, editSource = 'تعديل السعر الأوسط') {
      const costPrice = Number(prod?.cost_price ?? item?.cost_price ?? 0);
      const officialRetailPrice = Number(prod?.selling_price ?? prod?.price ?? item?._savedUnitPrice ?? oldUnitPrice ?? 0);
      const refOriginalPrice = officialRetailPrice > 0 ? officialRetailPrice : Number(oldUnitPrice || 0);
      const qty = Math.abs(Number(item?.quantity || 1));

      if (Math.abs(newUnitPrice - refOriginalPrice) < 0.01 && Math.abs(newUnitPrice - oldUnitPrice) < 0.01) {
        return;
      }

      const currentStock = Number(prod?.total_stock ?? prod?.stock ?? 0);
      const remainingStock = Number((currentStock - qty).toFixed(2));
      const newLineTotal = Number((item?.subtotal !== undefined ? item.subtotal : (qty * newUnitPrice)).toFixed(2));
      const originalLineTotal = Number((qty * refOriginalPrice).toFixed(2));

      const profitImpactDzd = Number((newLineTotal - originalLineTotal).toFixed(2));
      const netProfitOnLine = costPrice > 0 ? Number((newLineTotal - (qty * costPrice)).toFixed(2)) : 0;

      let category = 'discount';
      if (costPrice > 0 && newUnitPrice < costPrice - 0.01) category = 'below_cost';
      else if (costPrice > 0 && Math.abs(newUnitPrice - costPrice) <= 0.01) category = 'at_cost';
      else if (newUnitPrice > refOriginalPrice + 0.01) category = 'increase';

      const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value;
      const cust = cid ? (window.AppState?.customers || []).find((c) => Number(c.id) === Number(cid)) : null;
      const seller = document.getElementById('currentUserName')?.textContent?.trim() || window.AppState?.currentUser?.name || 'المدير العام';
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

      const entry = {
        id: 'rad_' + Date.now(),
        timestamp: new Date().toISOString(),
        dateFormatted: nowStr,
        seller,
        customerName: cust ? cust.name : 'زبون عابر',
        productId: prod?.id || item?.product_id || null,
        productName: item?.name || prod?.name || 'سلعة',
        saleMode: item?._isCartonPackMode ? `📦 ${item._packUnitLabel || 'كرتونة'} (×${item._packQtyFactor || qty})` : '🏷️ بالحبة',
        editSource,
        quantity: qty,
        stockBefore: currentStock,
        stockAfter: remainingStock,
        costPrice,
        originalUnitPrice: refOriginalPrice,
        newUnitPrice: Number(newUnitPrice.toFixed(2)),
        originalLineTotal,
        newLineTotal,
        unitPriceDiff: Number((newUnitPrice - refOriginalPrice).toFixed(2)),
        profitImpactDzd,
        netProfitOnLine,
        category
      };

      const logs = this.getRadarLogs();
      const existingIdx = logs.findIndex(
        (l) => l.productName === entry.productName && String(l.dateFormatted).slice(0, 15) === nowStr.slice(0, 15)
      );
      if (existingIdx !== -1) logs[existingIdx] = entry;
      else logs.unshift(entry);
      this.saveRadarLogs(logs);
    },

    hookAnalyticsViewForOwnerRadar() {
      const origRenderAnalytics = window.App.renderAnalyticsView?.bind(window.App);
      if (origRenderAnalytics && !window.App._v12OwnerRadarHooked) {
        window.App.renderAnalyticsView = async function (...args) {
          const res = await origRenderAnalytics(...args);
          V9Engine.renderOwnerPriceRadarCard(true);
          return res;
        };
        window.App._v12OwnerRadarHooked = true;
      }
    },

    ensureOwnerRadarRenderedInAnalytics() {
      const analyticsSec = document.getElementById('view-analytics');
      if (!analyticsSec || !analyticsSec.classList.contains('active')) return;
      if (!document.getElementById('v9OwnerPriceSurveillanceRadar')) {
        this.renderOwnerPriceRadarCard(false);
      }
    },

    setRadarFilter(filterKey) {
      this.activeRadarFilter = filterKey;
      this.renderOwnerPriceRadarCard(true);
    },

    clearRadarLogs() {
      localStorage.removeItem(RADAR_STORAGE_KEY);
      localStorage.removeItem('gherbi_cost_price_alerts');
      this.renderOwnerPriceRadarCard(true);
      if (window.showToast) window.showToast('🗑️ تم تصفير سجل رقابة الأسعار والكميات بنجاح', 'info');
    },

    renderOwnerPriceRadarCard(forceRebuild = false) {
      const root = document.getElementById('analytics-view-root') || document.getElementById('view-analytics');
      if (!root) return;

      document.getElementById('ownerPriceViolationReportCard')?.remove();

      let radarEl = document.getElementById('v9OwnerPriceSurveillanceRadar');
      if (radarEl && !forceRebuild) return;

      if (!radarEl) {
        radarEl = document.createElement('div');
        radarEl.id = 'v9OwnerPriceSurveillanceRadar';
        radarEl.className = 'v9-owner-radar-card space-y-4 text-xs';
        const loyaltyCard = document.getElementById('ownerLoyaltyPointsAuditCard');
        if (loyaltyCard && loyaltyCard.parentNode === root) {
          root.insertBefore(radarEl, loyaltyCard);
        } else {
          root.appendChild(radarEl);
        }
      }

      const allLogs = this.getRadarLogs();
      const belowOrAtCostLogs = allLogs.filter((l) => l.category === 'below_cost' || l.category === 'at_cost');
      const discountLogs = allLogs.filter((l) => l.category === 'discount');
      const fractionalLogs = allLogs.filter((l) => l.category === 'fractional_qty');
      const increaseLogs = allLogs.filter((l) => l.category === 'increase');

      const totalDiscountGivenDzd = allLogs
        .filter((l) => Number(l.profitImpactDzd || 0) < 0)
        .reduce((s, l) => s + Math.abs(Number(l.profitImpactDzd || 0)), 0);

      const totalExtraGainedDzd = allLogs
        .filter((l) => Number(l.profitImpactDzd || 0) > 0)
        .reduce((s, l) => s + Number(l.profitImpactDzd || 0), 0);

      const netProfitImpact = Number((totalExtraGainedDzd - totalDiscountGivenDzd).toFixed(2));

      const filtered = allLogs.filter((l) => {
        if (this.activeRadarFilter === 'danger') return l.category === 'below_cost' || l.category === 'at_cost';
        if (this.activeRadarFilter === 'discount') return l.category === 'discount';
        if (this.activeRadarFilter === 'fractional') return l.category === 'fractional_qty';
        if (this.activeRadarFilter === 'increase') return l.category === 'increase';
        return true;
      });

      radarEl.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center text-xl font-black">🛡️</div>
            <div>
              <h3 class="text-sm font-black text-rose-600 dark:text-rose-400">
                رادار رقابة صاحب المحل الشامل: تعديلات الإجمالي (F12)، السعر الأوسط (Alt+P)، والكميات (${allLogs.length})
              </h3>
              <p class="text-[11px] text-slate-500 font-bold">
                يوثق لصاحب المحل كل عملية بيع بالمبلغ (كمية جزئية) أو تعديل في سعر الوحدة أو الكرتونة مع الرصيد المتبقي في السطوك
              </p>
            </div>
          </div>

          <button type="button" onclick="GherbiV9Engine.clearRadarLogs()"
            class="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 hover:text-white font-black text-xs transition">
            🗑️ تصفير السجل الرقابي
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <div class="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">⚖️ عمليات البيع بالمبلغ (كمية جزئية)</div>
            <div class="text-xl font-mono font-black text-emerald-600 mt-0.5">${fractionalLogs.length} عملية</div>
            <div class="text-[10px] text-emerald-600/80 font-bold">تعديل الكمية تلقائياً مع ثبات السعر</div>
          </div>

          <div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30">
            <div class="text-[11px] text-rose-700 dark:text-rose-300 font-bold">🚨 بيع بالتكلفة أو بخسارة في السطوك</div>
            <div class="text-xl font-mono font-black text-rose-600 mt-0.5">${belowOrAtCostLogs.length} حالات</div>
            <div class="text-[10px] text-rose-500 font-bold">تعديلات سعر نزلت لتكلفة الشراء أو تحتها</div>
          </div>

          <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div class="text-[11px] text-amber-800 dark:text-amber-300 font-bold">📉 إجمالي التخفيضات السعرية الممنوحة</div>
            <div class="text-xl font-mono font-black text-amber-600 mt-0.5">-${totalDiscountGivenDzd.toFixed(2)} د.ج</div>
            <div class="text-[10px] text-amber-600/80 font-bold">في (${discountLogs.length + belowOrAtCostLogs.length}) عملية تخفيض سعر</div>
          </div>

          <div class="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
            <div class="text-[11px] font-bold text-slate-600 dark:text-slate-300">📊 صافي أثر تعديلات السعر على الربح</div>
            <div class="text-xl font-mono font-black ${netProfitImpact >= 0 ? 'text-emerald-600' : 'text-indigo-600 dark:text-indigo-400'} mt-0.5">
              ${netProfitImpact >= 0 ? '+' : ''}${netProfitImpact.toFixed(2)} د.ج
            </div>
            <div class="text-[10px] text-slate-500 font-bold">زيادات السعر: +${totalExtraGainedDzd.toFixed(2)} د.ج (${increaseLogs.length})</div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('all')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'all' ? 'active' : ''}">
            الكل (${allLogs.length})
          </button>
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('fractional')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'fractional' ? 'active' : ''}">
            ⚖️ كمية جزئية بالمبلغ (${fractionalLogs.length})
          </button>
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('danger')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'danger' ? 'active' : ''}">
            🚨 بالتكلفة أو بخسارة (${belowOrAtCostLogs.length})
          </button>
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('discount')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'discount' ? 'active' : ''}">
            📉 تخفيض السعر (${discountLogs.length})
          </button>
          <button type="button" onclick="GherbiV9Engine.setRadarFilter('increase')" class="v9-radar-filter-pill ${this.activeRadarFilter === 'increase' ? 'active' : ''}">
            📈 زيادة السعر (${increaseLogs.length})
          </button>
        </div>

        ${
          filtered.length === 0
            ? '<div class="py-8 text-center text-emerald-600 font-black text-xs bg-emerald-500/5 rounded-2xl border border-emerald-500/20">✅ لا توجد عمليات مسجلة في هذا التصنيف حالياً</div>'
            : `<div class="overflow-x-auto max-h-80 rounded-xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                      <th class="py-2.5 px-3">التوقيت</th>
                      <th class="py-2.5 px-2">البائع / الزبون</th>
                      <th class="py-2.5 px-3">الصنف وطريقة التعديل</th>
                      <th class="py-2.5 px-2 text-center">الكمية والسطوك</th>
                      <th class="py-2.5 px-2 text-center">سعر الشراء</th>
                      <th class="py-2.5 px-2 text-center">سعر الوحدة</th>
                      <th class="py-2.5 px-2 text-center">إجمالي السطر</th>
                      <th class="py-2.5 px-3 text-center">صافي ربح السطر</th>
                      <th class="py-2.5 px-2 text-center">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    ${filtered.map((l) => {
                      const netProfit = Number(l.netProfitOnLine || 0);
                      let statusBadge = '';
                      let rowBg = '';

                      if (l.category === 'fractional_qty') {
                        rowBg = 'hover:bg-emerald-500/5';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">⚖️ كمية بالمبلغ</span>';
                      } else if (l.category === 'below_cost') {
                        rowBg = 'bg-rose-500/10';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">🚨 بيع بخسارة!</span>';
                      } else if (l.category === 'at_cost') {
                        rowBg = 'bg-amber-500/10';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">⚠️ بسعر التكلفة</span>';
                      } else if (l.category === 'increase') {
                        rowBg = 'hover:bg-emerald-500/5';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">📈 رفع السعر</span>';
                      } else {
                        rowBg = 'hover:bg-amber-500/5';
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black">📉 تخفيض سعر</span>';
                      }

                      return `
                        <tr class="${rowBg}">
                          <td class="py-2 px-3 font-mono text-[11px] whitespace-nowrap">${l.dateFormatted || ''}</td>
                          <td class="py-2 px-2">
                            <div>${l.seller || 'البائع'}</div>
                            <div class="text-[10px] text-slate-400">${l.customerName || 'زبون عابر'}</div>
                          </td>
                          <td class="py-2 px-3">
                            <div class="font-black text-slate-900 dark:text-white">${l.productName}</div>
                            <div class="text-[10px] text-indigo-600 dark:text-indigo-400">${l.saleMode || ''} (${l.editSource || ''})</div>
                          </td>
                          <td class="py-2 px-2 text-center font-mono">
                            <div class="font-black text-emerald-600">-${l.quantity} وحدة</div>
                            <div class="text-[10px] text-slate-400">بقي بالسطوك: ${l.stockAfter ?? '—'}</div>
                          </td>
                          <td class="py-2 px-2 text-center font-mono text-slate-500">${Number(l.costPrice || 0).toFixed(2)} د.ج</td>
                          <td class="py-2 px-2 text-center font-mono">
                            ${
                              l.category === 'fractional_qty'
                                ? `<strong class="text-slate-700 dark:text-slate-200">${Number(l.newUnitPrice || 0).toFixed(2)} د.ج (ثابت)</strong>`
                                : `<span class="line-through text-slate-400 text-[10.5px]">${Number(l.originalUnitPrice || 0).toFixed(2)}</span> ⬅ <strong>${Number(l.newUnitPrice || 0).toFixed(2)} د.ج</strong>`
                            }
                          </td>
                          <td class="py-2 px-2 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                            ${Number(l.newLineTotal || 0).toFixed(2)} د.ج
                          </td>
                          <td class="py-2 px-3 text-center font-mono">
                            <div class="font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                              ${netProfit >= 0 ? '+' + netProfit.toFixed(2) : netProfit.toFixed(2)} د.ج
                            </div>
                          </td>
                          <td class="py-2 px-2 text-center whitespace-nowrap">${statusBadge}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>`
        }
      `;
    }
  };

  window.GherbiV9Engine = V9Engine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V9Engine.init());
  } else {
    V9Engine.init();
  }
})();
