/**
 * gherbi-v10-subtotal-qty-price-switch.js
 * المحرك المزدوج لخانة إجمالي السطر (125.00 ⬅ الكمية 0.8 أو تعديل السعر):
 * - يتيح التبديل بين وضع (⚖️ تغيير الكمية تلقائياً 1 ⬅ 0.8) ووضع (💰 تغيير السعر / تخفيض).
 * - يضيف زر قلب فوري (⇄) داخل كل سطر تم تعديل إجماليه لعكس الطريقة بضغطة واحدة.
 * - يوثق عمليات البيع بالكمية الجزئية (0.8) وتخفيضات السعر في رادار صاحب المحل بصفحة الإحصائيات.
 */

'use strict';

(function initGherbiV10SubtotalModeEngine() {
  const MODE_STORAGE_KEY = 'gherbi_subtotal_edit_mode_v10'; // 'qty' | 'price'

  const V10SubtotalEngine = {
    // الوضع الافتراضي هو 'qty' (تغيير الكمية تلقائياً 1 -> 0.8 كما أشار المستخدم بالسهم الأزرق)
    currentMode: localStorage.getItem(MODE_STORAGE_KEY) || 'qty',

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState || !window.GherbiV9Engine) return;
        clearInterval(wait);
        this.injectModeSwitcherInPosBar();
        this.overrideV9SubtotalHandler();
        setInterval(() => {
          this.injectModeSwitcherInPosBar();
          this.renderRowFlipChipsAndFractionHints();
        }, 300);
        console.log('🚀 [Gherbi V10 Ready]: محرك تعديل الإجمالي (تغيير الكمية 1 ⬅ 0.8 أو تغيير السعر) جاهز 100%.');
      }, 200);
    },

    getMode() {
      return this.currentMode === 'price' ? 'price' : 'qty';
    },

    setMode(newMode) {
      this.currentMode = newMode === 'price' ? 'price' : 'qty';
      localStorage.setItem(MODE_STORAGE_KEY, this.currentMode);
      this.updateModeSwitcherButtonUI();

      if (window.showToast) {
        if (this.currentMode === 'qty') {
          window.showToast(
            '⚖️ الوضع النشط الآن: عند تعديل إجمالي السطر (125.00) تتغير الكمية تلقائياً (مثلاً 1 ⬅ 0.8)',
            'success'
          );
        } else {
          window.showToast(
            '💰 الوضع النشط الآن: عند تعديل إجمالي السطر (125.00) يتغير السعر (تخفيض) وتبقى الكمية ثابتة (1)',
            'info'
          );
        }
      }
    },

    toggleGlobalMode() {
      this.setMode(this.getMode() === 'qty' ? 'price' : 'qty');
    },

    // ========================================================================
    // 1. إضافة زر التبديل بين الوضعين في شريط مضاعفات الكمية أعلى السلة
    // ========================================================================
    injectModeSwitcherInPosBar() {
      const multStrip = document.getElementById('posQuickMultiplierBar') ||
        document.querySelector('.gherbi-multiplier-strip') ||
        Array.from(document.querySelectorAll('#view-pos div')).find((d) => (d.textContent || '').includes('ضرب الكمية:'));

      if (!multStrip) return;

      let btn = document.getElementById('gherbiV10SubtotalModeBtn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'gherbiV10SubtotalModeBtn';
        btn.type = 'button';
        btn.onclick = () => this.toggleGlobalMode();
        multStrip.appendChild(btn);
        this.updateModeSwitcherButtonUI();
      }
    },

    updateModeSwitcherButtonUI() {
      const btn = document.getElementById('gherbiV10SubtotalModeBtn');
      if (!btn) return;
      const isQty = this.getMode() === 'qty';

      if (isQty) {
        btn.className = 'gherbi-v10-mode-switcher mode-qty';
        btn.innerHTML = '<span>⚖️ تعديل الإجمالي: يغير الكمية (0.8)</span><span class="underline text-[9px] mr-1">⇄ تبديل</span>';
        btn.title = 'الوضع الحالي: كتابة مبلغ أقل في خانة الإجمالي (125.00) ينقص الكمية تلقائياً (مثلاً 1 تصبح 0.8). انقر للتبديل إلى وضع تغيير السعر.';
      } else {
        btn.className = 'gherbi-v10-mode-switcher mode-price';
        btn.innerHTML = '<span>💰 تعديل الإجمالي: يغير السعر (تخفيض)</span><span class="underline text-[9px] mr-1">⇄ تبديل</span>';
        btn.title = 'الوضع الحالي: كتابة مبلغ أقل في خانة الإجمالي (125.00) يخفض سعر الوحدة ويبقي الكمية (1) ثابتة. انقر للتبديل إلى وضع تغيير الكمية (0.8).';
      }
    },

    // ========================================================================
    // 2. ترقية دالة تعديل خانة الإجمالي الفرعي للسطر (الدائرة الزرقاء 125.00)
    // ========================================================================
    overrideV9SubtotalHandler() {
      const v9 = window.GherbiV9Engine;
      if (!v9) return;

      // استبدال دالة applyLineSubtotalChangeToRow في المحرك التاسع لتعمل حسب الوضع المختار (الكمية 0.8 أو السعر)
      v9.applyLineSubtotalChangeToRow = (idx, newSubtotalVal, forceFlipMode = null) => {
        const items = window.App?.currentCart?.items || [];
        const item = items[idx];
        if (!item) return;

        const parsedTotal = parseFloat(newSubtotalVal);
        if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) return;

        const prod = (window.AppState?.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );

        const sign = Number(item.quantity || 1) < 0 ? -1 : 1;

        // حفظ القيم المرجعية الأصلية قبل التعديل لأول مرة حتى نتمكن من القلب بين الوضعين (0.8 كمية ⇄ تخفيض سعر) في أي لحظة!
        if (!item._baseReferenceUnitPrice) {
          item._baseReferenceUnitPrice = Number(prod?.selling_price ?? prod?.price ?? item.price ?? 0);
        }
        if (!item._baseReferenceQty) {
          item._baseReferenceQty = Math.max(0.001, Math.abs(Number(item.quantity || 1)));
        }

        const effectiveMode = forceFlipMode || this.getMode();
        item._lastSubtotalAppliedMode = effectiveMode;
        item._targetLineSubtotalDzd = Number(parsedTotal.toFixed(2));

        if (effectiveMode === 'qty') {
          // ==================================================================
          // الوضع أ: تعديل الإجمالي يغير الكمية تلقائياً (مثلاً 100 / 125 = 0.8)
          // ==================================================================
          // إذا كان السطر في وضع الكرتونة (مثلاً 8 قطع بـ 950 د.ج)، نحسب سعر الحبة المرجعي أو نرجع لسعر الحبة الرسمي
          const refUnitPrice = item._isCartonPackMode && item._singlePackTotalDzd && item._packQtyFactor
            ? Number((item._singlePackTotalDzd / item._packQtyFactor).toFixed(4))
            : Number(item._baseReferenceUnitPrice || item.price || 1);

          const computedQty = Number((parsedTotal / Math.max(0.01, refUnitPrice)).toFixed(3));

          item.price = Number(refUnitPrice.toFixed(2));
          item.quantity = computedQty * sign;
          item.subtotal = Number((parsedTotal * sign).toFixed(2));
          item._editedFromSubtotalBox = true;
          item._manualLineSubtotal = item.subtotal;

          // تسجيل عملية البيع بكمية جزئية (0.8) في رادار صاحب المحل بصفحة الإحصائيات
          this.logFractionalQtySaleInOwnerRadar(item, prod, item._baseReferenceQty, computedQty, parsedTotal);

          window.App.recalcAndRenderCart?.();
          v9.enhanceCartRowsWithEditableSubtotalAndStockGuard?.();
          this.renderRowFlipChipsAndFractionHints();

          if (window.showToast) {
            const pct = Math.round(computedQty * 100);
            window.showToast(
              `⚖️ تم تعديل الكمية تلقائياً إلى (${computedQty}) مقابل مبلغ (${parsedTotal.toFixed(2)} د.ج) — يخصم ${computedQty} من السطوك`,
              'success'
            );
          }
        } else {
          // ==================================================================
          // الوضع ب: تعديل الإجمالي يغير السعر (تخفيض مالي) مع بقاء الكمية ثابتة (1)
          // ==================================================================
          const fixedQty = Math.max(0.001, Number(item._baseReferenceQty || Math.abs(Number(item.quantity || 1))));
          const oldUnitPrice = Number(item._baseReferenceUnitPrice || item.price || 0);
          const newUnitPrice = Number((parsedTotal / fixedQty).toFixed(4));

          item.quantity = fixedQty * sign;
          item.price = newUnitPrice;
          item.custom_price = newUnitPrice;
          item.subtotal = Number((parsedTotal * sign).toFixed(2));
          item._editedFromSubtotalBox = true;
          item._manualLineSubtotal = item.subtotal;

          if (item._isCartonPackMode) {
            const packsCount = Math.max(1, Number(item._packsCount || 1));
            item._singlePackTotalDzd = Number((parsedTotal / packsCount).toFixed(2));
          }

          v9.recordPriceModificationEvent(item, prod, oldUnitPrice, newUnitPrice, 'تخفيض من خانة الإجمالي (مع ثبات الكمية)');
          window.App.recalcAndRenderCart?.();
          v9.enhanceCartRowsWithEditableSubtotalAndStockGuard?.();
          this.renderRowFlipChipsAndFractionHints();
        }
      };
    },

    // قلب طريقة حساب السطر الحالي بضغطة واحدة (بين 0.8 كمية ⇄ تخفيض سعر)
    flipRowSubtotalMethod(idx) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item || !item._targetLineSubtotalDzd) return;

      const nextMode = item._lastSubtotalAppliedMode === 'qty' ? 'price' : 'qty';
      window.GherbiV9Engine?.applyLineSubtotalChangeToRow(idx, item._targetLineSubtotalDzd, nextMode);
    },

    // توثيق البيع بكمية جزئية (مثل 0.8 أو 0.9) في رادار صاحب المحل بصفحة الإحصائيات
    logFractionalQtySaleInOwnerRadar(item, prod, oldQty, newQty, lineTotalDzd) {
      const v9 = window.GherbiV9Engine;
      if (!v9 || Math.abs(newQty - oldQty) < 0.001) return;

      const costPrice = Number(prod?.cost_price ?? item?.cost_price ?? 0);
      const unitPrice = Number(item?.price || 0);
      const currentStock = Number(prod?.total_stock ?? prod?.stock ?? 0);
      const remainingStock = Number((currentStock - newQty).toFixed(3));
      const netProfitOnLine = costPrice > 0 ? Number((lineTotalDzd - (newQty * costPrice)).toFixed(2)) : 0;

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
        saleMode: `⚖️ بيع بمبلغ (تعديل الكمية: ${oldQty} ⬅ ${newQty})`,
        editSource: 'تحويل الإجمالي إلى كمية جزئية',
        quantity: newQty,
        stockBefore: currentStock,
        stockAfter: remainingStock,
        costPrice,
        originalUnitPrice: unitPrice,
        newUnitPrice: unitPrice,
        originalLineTotal: Number((oldQty * unitPrice).toFixed(2)),
        newLineTotal: Number(lineTotalDzd.toFixed(2)),
        unitPriceDiff: 0,
        profitImpactDzd: 0,
        netProfitOnLine,
        category: 'fractional_qty'
      };

      const logs = v9.getRadarLogs();
      const existingIdx = logs.findIndex(
        (l) => l.productName === entry.productName && String(l.dateFormatted).slice(0, 15) === nowStr.slice(0, 15)
      );
      if (existingIdx !== -1) {
        logs[existingIdx] = entry;
      } else {
        logs.unshift(entry);
      }
      v9.saveRadarLogs(logs);
    },

    // ========================================================================
    // 3. عرض شارة الكمية الجزئية (0.8) وزر القلب السريع (⇄) داخل سطر السلة
    // ========================================================================
    renderRowFlipChipsAndFractionHints() {
      const cartBox = document.getElementById('posCartItems');
      if (!cartBox) return;

      const items = window.App?.currentCart?.items || [];
      const rows = Array.from(cartBox.children).filter(
        (el) => el.tagName === 'DIV' && !el.textContent.includes('السلة فارغة')
      );

      rows.forEach((row, idx) => {
        const item = items[idx];
        if (!item) return;

        // تحديث قيمة حقل الكمية الظاهر في السطر ليطابق 0.8 أو 0.9 فوراً
        const numberInputs = Array.from(row.querySelectorAll('input[type="number"], input[type="text"]')).filter(
          (inp) => !inp.classList.contains('gherbi-line-subtotal-input')
        );
        const qtyInp = numberInputs[0] || null;
        if (qtyInp && document.activeElement !== qtyInp) {
          const cleanQty = Number(Number(item.quantity || 1).toFixed(3));
          if (parseFloat(qtyInp.value) !== cleanQty) {
            qtyInp.value = String(cleanQty);
          }
        }

        // تحديث شارة المخزون المتبقي لتعرض الكسور بدقة (مثلاً: متوفر: 6 ⬅ يبقى: 5.2 قطعة)
        const prod = (window.AppState?.products || []).find(
          (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
        );
        if (prod) {
          const avail = Number(prod.total_stock ?? prod.stock ?? 0);
          const rem = Number((avail - Math.abs(Number(item.quantity || 1))).toFixed(2));
          Array.from(row.querySelectorAll('span, div')).forEach((el) => {
            const t = (el.textContent || '').trim();
            if (t.includes('متوفر:') && t.includes('يبقى:') && el.children.length <= 2) {
              el.innerHTML = `📦 متوفر: ${avail} ⬅ يبقى: ${rem} ${prod.unit || 'قطعة'}`;
            }
          });
        }

        // إظهار زر القلب السريع (⇄) عندما يكون السطر قد عُدّل من خانة الإجمالي (125.00)
        const packBar = row.querySelector('.gherbi-v8-pack-bar') || row.querySelector('div');
        if (!packBar) return;

        let flipChip = row.querySelector('.gherbi-v10-flip-chip');
        if (item._editedFromSubtotalBox && item._targetLineSubtotalDzd) {
          if (!flipChip) {
            flipChip = document.createElement('button');
            flipChip.type = 'button';
            flipChip.className = 'gherbi-v10-flip-chip';
            packBar.appendChild(flipChip);
          }
          const isCurrentlyQty = item._lastSubtotalAppliedMode === 'qty';
          const qVal = Number(Math.abs(Number(item.quantity || 1)).toFixed(3));
          if (isCurrentlyQty) {
            const gramsOrPct = Math.round(qVal * 1000);
            flipChip.innerHTML = `<span>⚖️ كمية جزئية (${qVal} = ${gramsOrPct}غ)</span><span class="underline mr-1">⇄ اجعلها تخفيض سعر (كمية ${item._baseReferenceQty || 1})</span>`;
            flipChip.title = 'انقر هنا إذا أخذ الزبون الحبة كاملة (1) بسعر مخفض بدلاً من إنقاص الكمية إلى ' + qVal;
          } else {
            const calcQ = Number((item._targetLineSubtotalDzd / Math.max(0.01, Number(item._baseReferenceUnitPrice || 125))).toFixed(2));
            flipChip.innerHTML = `<span>💰 تخفيض سعر (الكمية ${qVal})</span><span class="underline mr-1">⇄ أو أنقص الكمية إلى (${calcQ})</span>`;
            flipChip.title = 'انقر هنا إذا كنت تريد إنقاص الكمية إلى (' + calcQ + ') وإبقاء سعر الوحدة ثابتاً';
          }
          flipChip.onclick = (e) => {
            e.stopPropagation();
            this.flipRowSubtotalMethod(idx);
          };
        } else if (flipChip) {
          flipChip.remove();
        }
      });
    }
  };

  window.GherbiV10SubtotalEngine = V10SubtotalEngine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V10SubtotalEngine.init());
  } else {
    V10SubtotalEngine.init();
  }
})();
