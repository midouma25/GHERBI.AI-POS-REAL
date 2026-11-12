/**
 * gherbi-v5-stage2-total-and-f3.js
 * المحرك التنفيذي للشطر الثاني (الإصدار 5):
 * - تكبير الإجمالي المستحق وعرض شارة "كم تم الاختزال" والنقاط المستعملة والمبلغ قبل الخصم أمامه مباشرة
 * - تحديث زر المسودات ليحمل اختصار (F3) دائماً: "مسودات (0) (F3)" مع تنبيه بصري عند وجود مسودات
 */

'use strict';

(function initGherbiV5Stage2() {
  const V5Stage2 = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.setupGiantTotalAndSavingsBadge();
        this.setupDraftsButtonWithF3Label();
        console.log('🚀 [Gherbi V5 - Stage 2]: تم تفعيل الإجمالي العملاق وشارة الاختزال وزر المسودات (F3).');
      }, 200);
    },

    // ========================================================================
    // 3. تكبير الإجمالي المستحق + إظهار شارة المبلغ المختزل والنقاط أمامه للزبون
    // ========================================================================
    setupGiantTotalAndSavingsBadge() {
      const totalEl = document.getElementById('cartTotalText');
      if (!totalEl) return;

      const totalRow = totalEl.closest('.flex.items-center.justify-between') || totalEl.parentElement;
      if (totalRow && !document.getElementById('gherbiLiveRedeemedBadge')) {
        // إنشاء حاوية تجمع شارة الاختزال بجانب الإجمالي العملاق
        const rightTitle = totalRow.firstElementChild;
        if (rightTitle) {
          rightTitle.className = 'font-black text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-0.5';
        }

        const badge = document.createElement('div');
        badge.id = 'gherbiLiveRedeemedBadge';
        badge.className = 'gherbi-live-redeemed-badge hidden';
        totalRow.insertBefore(badge, totalEl);
      }

      const updateSavingsDisplay = () => {
        const badge = document.getElementById('gherbiLiveRedeemedBadge');
        if (!badge) return;

        const cart = window.App?.currentCart;
        const items = cart?.items || [];
        const subtotal = items.reduce((acc, it) => {
          const q = Number(it.quantity ?? 1);
          const p = Number(it.price ?? 0);
          const line = it.subtotal !== undefined ? Number(it.subtotal) : (q * p);
          return acc + (isNaN(line) ? 0 : line);
        }, 0);

        const rawDisc = Number(cart?.discount ?? document.getElementById('cartDiscountInput')?.value ?? 0);
        const couponDisc = Number(cart?.couponDiscount || 0);
        const totalSavedDzd = Number((rawDisc + couponDisc).toFixed(2));
        const redeemedPts = Number(cart?._redeemedPoints || 0);

        if (totalSavedDzd <= 0 || subtotal <= 0) {
          badge.classList.add('hidden');
          return;
        }

        badge.classList.remove('hidden');
        const ptsText = redeemedPts > 0 ? ` (${redeemedPts} نقطة وفاء)` : '';
        badge.innerHTML = `
          <div class="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
            كان قبل الخصم: <span class="line-through font-mono font-black text-rose-500">${subtotal.toFixed(2)} د.ج</span>
          </div>
          <div class="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono">
            🎁 تم اختزال: -${totalSavedDzd.toFixed(2)} د.ج${ptsText}
          </div>
        `;
      };

      updateSavingsDisplay();

      // مراقبة أي تغير في الإجمالي أو حقل الخصم لتحديث الشارة فوراً
      const obs = new MutationObserver(() => updateSavingsDisplay());
      obs.observe(totalEl, { childList: true, characterData: true, subtree: true });

      const discInp = document.getElementById('cartDiscountInput');
      if (discInp) {
        discInp.addEventListener('input', updateSavingsDisplay);
        discInp.addEventListener('change', updateSavingsDisplay);
      }

      setInterval(updateSavingsDisplay, 500);
    },

    // ========================================================================
    // 4. إضافة (F3) أمام زر المسودات "مسودات (0) (F3)" وتفعيله بصرياً
    // ========================================================================
    setupDraftsButtonWithF3Label() {
      const enforceDraftsButtonFormat = () => {
        const draftsBtns = Array.from(document.querySelectorAll('#view-pos button')).filter((b) => {
          const onclickStr = b.getAttribute('onclick') || '';
          const txt = b.textContent || '';
          return onclickStr.includes('openDraftsModal') || txt.includes('مسودات');
        });

        const draftsCount = Array.isArray(window.AppState?.draftCarts) ? window.AppState.draftCarts.length : 0;

        draftsBtns.forEach((btn) => {
          // الحفاظ على <span id="draftsCountBadge"> داخله مع إضافة (F3)
          if (!btn.textContent.includes('(F3)')) {
            btn.innerHTML = `مسودات (<span id="draftsCountBadge">${draftsCount}</span>) (F3)`;
          } else {
            const badgeEl = btn.querySelector('#draftsCountBadge');
            if (badgeEl && badgeEl.textContent !== String(draftsCount)) {
              badgeEl.textContent = String(draftsCount);
            }
          }
          btn.title = 'فتح نافذة الفواتير المعلقة والمسودات (اختصار: F3)';
          btn.classList.toggle('gherbi-drafts-btn-has-items', draftsCount > 0);
        });
      };

      enforceDraftsButtonFormat();
      setInterval(enforceDraftsButtonFormat, 500);

      // ضمان فتح نافذة المسودات عند الضغط على مفتاح F3 في شاشة المبيعات
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;
          if (e.key === 'F3') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.App?.openDraftsModal === 'function') {
              window.App.openDraftsModal();
            } else {
              window.App?.openModal?.('draftsModal');
            }
          }
        },
        true
      );
    }
  };

  window.GherbiV5Stage2 = V5Stage2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V5Stage2.init());
  } else {
    V5Stage2.init();
  }
})();
