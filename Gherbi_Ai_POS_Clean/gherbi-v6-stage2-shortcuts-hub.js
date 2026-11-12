/**
 * gherbi-v6-stage2-shortcuts-hub.js (V12 Complete Catalog Edition)
 * يضم كافة اختصارات النظام الجديدة والسابقة مع شرحها الدقيق وتنفيذها المباشر بالنقر
 */

'use strict';

(function initGherbiV6Stage2() {
  const V6Stage2 = {
    shortcutsCatalog: [
      // المجموعة 1: التسديد وإتمام الفاتورة
      {
        group: '💳 1. التسديد وإتمام الفاتورة',
        key: 'F1',
        title: 'فتح نافذة التسديد الشاملة',
        desc: 'فتح شاشة الدفع بالتجزئة (نقداً، كريدي/دين، بطاقة ذهبية CIB، أو بريدي موب) مع ملخص القفة والنقاط',
        action: () => window.App?.openCheckoutModal?.()
      },
      {
        group: '💳 1. التسديد وإتمام الفاتورة',
        key: 'Échap (Esc)',
        title: 'تذكرة 80mm فورية بضغطة واحدة',
        desc: 'تأكيد البيع نقداً وطباعة وصل حراري 80mm فوراً دون فتح نوافذ إضافية',
        action: () => window.App?.instantConfirmAndCheckout?.('receipt')
      },
      {
        group: '💳 1. التسديد وإتمام الفاتورة',
        key: 'Ctrl + Space',
        title: 'حفظ الفاتورة فوراً بدون طباعة',
        desc: 'تسجيل البيعة نقداً في الصندوق والمخزون وإفراغ السلة للزبون التالي بدون طباعة ورق',
        action: () => window.App?.instantConfirmAndCheckout?.('none')
      },
      {
        group: '💳 1. التسديد وإتمام الفاتورة',
        key: 'Alt + C',
        title: 'القفز لخانة المبلغ المستلم (حاسبة الصرف)',
        desc: 'وضع المؤشر مباشرة في خانة ما أعطاك الزبون لحساب الباقي بالدينار والسنتيم لحظياً',
        action: () => window.RetailV2?.focusInlineReceivedCash?.()
      },

      // المجموعة 2: بطاقة الوفاء، الزبائن، والسلات
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F8',
        title: 'نافذة بطاقة الوفاء واختيار الزبون',
        desc: 'فتح نافذة الزبائن مع وضع المؤشر تلقائياً لمسح باركود بطاقة الوفاء (FID-...) أو البحث بالاسم',
        action: () => window.RetailMaster?.openSmartLoyaltyModal?.('scan')
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F9',
        title: 'اختزال وخصم نقاط الوفاء بالدينار',
        desc: 'الذهاب مباشرة لخانة خصم نقاط الزبون الوفي وتحويلها إلى تخفيض مالي بالدينار والسنتيم',
        action: () => window.RetailMaster?.openSmartLoyaltyModal?.('redeem')
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'Alt + W',
        title: 'العودة الفورية إلى الزبون العابر',
        desc: 'إلغاء ربط الزبون الوفي من السلة الحالية والعودة فوراً إلى (زبون عابر — بدون بطاقة وفاء)',
        action: () => window.GherbiV7Stage1?.switchImmediatelyToWalkInCustomer?.()
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'Ctrl + N',
        title: 'فتح سلة مبيعات جديدة (+ سلة)',
        desc: 'إنشاء سلة جديدة فارغة على الزبون العابر لخدمة زبون آخر بالتوازي',
        action: () => window.App?.newCartTab?.()
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F2',
        title: 'تعليق الفاتورة في المسودات',
        desc: 'حفظ السلة الحالية مؤقتاً في المسودات ريثما يكمل الزبون تسوقه',
        action: () => window.App?.holdCurrentCart?.()
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F3',
        title: 'فتح نافذة المسودات المعلقة',
        desc: 'عرض واسترجاع الفواتير التي تم تعليقها مسبقاً بضغطة زر',
        action: () => window.App?.openDraftsModal ? window.App.openDraftsModal() : window.App?.openModal?.('draftsModal')
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'F4',
        title: 'إلغاء وتفريغ السلة الحالية / البحث',
        desc: 'تفريغ السلة الحالية أو الانتقال لحقل البحث عن منتج بالاسم',
        action: () => document.getElementById('globalPosSearch')?.focus()
      },
      {
        group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
        key: 'Alt + 1..9',
        title: 'التنقل السريع بين السلات المفتوحة',
        desc: 'اضغط Alt+1 للسلة الأولى، Alt+2 للسلة الثانية... للتنقل الفوري بالكيبورد',
        action: () => window.App?.switchCartTab?.(0)
      },

      // المجموعة 3: الإجمالي في الشريحة (F12)، السعر الأوسط (Alt+P)، الكمية، والباركود
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'F12',
        title: 'تعديل الإجمالي في الشريحة (السعر الأيسر)',
        desc: 'القفز مباشرة لتعديل إجمالي السطر في أقصى اليسار (ينقص الكمية 0.8 أو يخفض السعر حسب الوضع المختار)',
        action: () => window.GherbiV9Engine?.focusLineSubtotalWithF12?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + P / F11',
        title: 'تعديل السعر الأوسط (سعر الوحدة المباشر)',
        desc: 'القفز مباشرة إلى خانة السعر الأوسط (سعر الحبة) في الشريحة لتعديله مع حماية سعر التكلفة',
        action: () => window.GherbiV9Engine?.focusMiddleUnitPriceInput?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + Q',
        title: 'تعديل خانة الكمية في الشريحة مباشرة',
        desc: 'القفز مباشرة إلى مربع الكمية في الشريحة لكتابة العدد أو الوزن يدوياً',
        action: () => window.GherbiV9Engine?.focusQuantityInput?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + S',
        title: 'تبديل نظام عمل الإجمالي (كمية 0.8 ⇄ سعر ⇄ ذكي)',
        desc: 'التحكم في وظيفة خانة الإجمالي (F12) بين إنقاص الكمية تلقائياً (0.8) أو تخفيض السعر أو الوضع الذكي',
        action: () => window.GherbiV9Engine?.cycleSubtotalEditMode?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + T',
        title: 'قلب السطر بين (كمية جزئية بالغرام ⇄ تخفيض سعر)',
        desc: 'تحويل السطر المحدد بضغطة واحدة بين كمية جزئية بالمبلغ (0.96 = 960غ) وتخفيض سعر بكمية 1',
        action: () => {
          const idx = window.GherbiV9Engine?.getValidSelectedRowIndex?.() ?? 0;
          window.GherbiV9Engine?.convertRowBetweenFractionalQtyAndPriceDiscount?.(idx);
        }
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + K',
        title: 'التبديل بين (البيع بالحبة ⇄ الكرتونة / الباكي)',
        desc: 'تحويل السلعة المحددة في السلة إلى كرتونة/باكي حسب إعداداتها (مثل 8 قطع بـ 950 د.ج) أو ×6 افتراضياً',
        action: () => {
          const idx = window.GherbiV9Engine?.getValidSelectedRowIndex?.() ?? 0;
          window.GherbiV8PackEngine?.togglePackOnRow?.(idx);
        }
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'F5',
        title: 'التركيز الفوري على قارئ الباركود',
        desc: 'إعادة المؤشر فوراً إلى خانة مسح الباركود في أي وقت',
        action: () => document.getElementById('barcodeInput')?.focus()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'F6',
        title: 'نافذة فاحص السعر والمخزون الفوري',
        desc: 'فحص سعر أي سلعة بالدينار والسنتيم ومعرفة كميتها في المخزن دون إضافتها للسلة',
        action: () => window.RetailMaster?.openPriceCheckerModal?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'F7',
        title: 'مركز اللمس السريع والسلع اليومية ومنتجات المخزن',
        desc: 'فتح لوحة الأزرار السريعة (خبز، حليب، بيض، خدمات، ومنتجات المخزن المربوطة)',
        action: () => window.GherbiStage12Enforcer ? window.GherbiStage12Enforcer.openOurF7Modal() : window.App?.openQuickTouchModal?.()
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Ctrl + X',
        title: 'تبديل مضاعف الكمية السريع (1x..10x)',
        desc: 'تغيير مضاعف الكمية (1x ⬅ 2x ⬅ 3x ⬅ 5x ⬅ 10x) قبل مسح السلعة',
        action: () => {
          const seq = [1, 2, 3, 5, 10];
          const cur = window.AppState?._quickMultiplier || 1;
          window.App?.setQuickMultiplier?.(seq[(seq.indexOf(cur) + 1) % seq.length]);
        }
      },
      {
        group: '🏷️ 3. تعديل الإجمالي (F12)، السعر الأوسط، الكمية، والباركود',
        key: 'Alt + F',
        title: 'إضافة منتج حر غير مسجل',
        desc: 'فتح نافذة إدخال سلعة أو خدمة سريعة غير مسجلة في المخزن',
        action: () => window.App?.openFreeItemModal?.()
      },

      // المجموعة 4: التحكم في السلة، الميزان، شاشة الأسعار، والإدارة
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: '↑ / ↓',
        title: 'التنقل بين سطور السلة للأعلى والأسفل',
        desc: 'اختيار السلعة داخل السلة بالكيبورد لتعديل إجماليها بـ F12 أو سعرها الأوسط بـ Alt+P',
        action: () => {}
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: '+ / - / Delete',
        title: 'زيادة أو إنقاص الكمية أو حذف السطر',
        desc: 'استخدم (+) و (-) لتغيير كمية السطر المحدد، و (Delete) لحذفه من السلة',
        action: () => {}
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + G',
        title: 'فتح محطة الميزان الإلكتروني المباشر',
        desc: 'فتح نافذة الميزان الإلكتروني وحاسبة الأوزان السريعة (100غ، 250غ، 500غ رطل، 1كغ) والبيع بالمبلغ',
        action: () => window.App?.openPosScaleModal?.()
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + B',
        title: 'تشغيل شاشة فاحص الأسعار للزبائن (Borne de Prix)',
        desc: 'فتح شاشة الأسعار الذاتية المخصصة للزبائن (والمحمية بكود المدير السري عند الخروج)',
        action: () => window.GherbiV7Stage2?.openKioskMode?.()
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'F10',
        title: 'إغلاق الوردية وجرد الصندوق (Z-Report)',
        desc: 'فتح نافذة إغلاق المناوبة وعدّ الفئات النقدية وطباعة تقرير Z-Report',
        action: () => window.RetailMaster?.triggerShiftCloseShortcutF10?.()
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + R',
        title: 'فتح خزنة الفواتير غير المسجلة وطوارئ الكهرباء',
        desc: 'استعراض واسترجاع الفواتير التي لم تُسجل أو انقطعت الكهرباء أثناء بيعها',
        action: () => window.GherbiV7Stage1?.openCrashVaultModal?.()
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + M',
        title: 'كاشف صافي ربح الفاتورة السري للمدير',
        desc: 'عرض إشعار سري يوضح صافي ربح المحل في السلة الحالية والمبلغ المؤهل للنقاط',
        action: () => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', altKey: true }));
        }
      },
      {
        group: '🛡️ 4. التحكم في السلة، الميزان، شاشة الأسعار، والإدارة',
        key: 'Alt + H',
        title: 'فتح دليل ومركز اختصارات لوحة المفاتيح الشامل',
        desc: 'فتح هذه النافذة في أي وقت للاطلاع على جميع الاختصارات أو البحث فيها',
        action: () => window.GherbiV6Stage2?.openShortcutsHub?.()
      }
    ],

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.injectShortcutsButtonInPos();
        this.buildInteractiveShortcutsModal();
        console.log('🚀 [Gherbi V12 Shortcuts Hub]: تم تحديث مركز الاختصارات بكامل الأزرار الجديدة والسابقة.');
      }, 200);
    },

    injectShortcutsButtonInPos() {
      const ensureBtn = () => {
        const topDeckRow = document.querySelector('#gherbiCartTopDeck > div:nth-child(2) > div:last-child');
        if (topDeckRow && !document.getElementById('gherbiPosShortcutsTriggerBtn')) {
          const btn = document.createElement('button');
          btn.id = 'gherbiPosShortcutsTriggerBtn';
          btn.type = 'button';
          btn.onclick = () => this.openShortcutsHub();
          btn.title = 'دليل كل اختصارات لوحة المفاتيح مع الشرح والتنفيذ المباشر (Alt+H)';
          btn.className = 'px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-slate-950 border border-amber-500/30 text-[11px] font-black transition flex items-center gap-1';
          btn.innerHTML = '<span>⌨️ الاختصارات</span>';
          topDeckRow.appendChild(btn);
        }

        const helpBtn = document.querySelector('button[onclick*="shortcutsHelpModal"]');
        if (helpBtn && !helpBtn.dataset.v12Upgraded) {
          helpBtn.dataset.v12Upgraded = '1';
          helpBtn.className = 'px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-black flex items-center gap-1 transition border border-slate-200 dark:border-slate-700';
          helpBtn.innerHTML = '<span class="material-symbols-rounded icon-sm text-blue-600 dark:text-blue-400">keyboard_command_key</span><span class="hidden xl:inline">دليل الاختصارات</span>';
          helpBtn.onclick = (e) => {
            e.preventDefault();
            this.openShortcutsHub();
          };
        }
      };

      ensureBtn();
      setInterval(ensureBtn, 800);
    },

    buildInteractiveShortcutsModal() {
      const modal = document.getElementById('shortcutsHelpModal');
      if (!modal) return;

      modal.innerHTML = `
        <div class="modal-content bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          <div class="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <span class="material-symbols-rounded">keyboard</span>
              </div>
              <div>
                <h3 class="text-sm font-black">دليل ومركز اختصارات لوحة المفاتيح الشامل (Keyboard Shortcuts Hub)</h3>
                <p class="text-[11px] text-slate-400">جميع الاختصارات المعتمدة في الكاشير (${this.shortcutsCatalog.length} اختصاراً) — 💡 انقر على أي اختصار لتنفيذه مباشرة!</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <input id="v6ShortcutsSearchInput" type="text" oninput="GherbiV6Stage2.renderShortcutsGrid(this.value)"
                placeholder="🔍 ابحث عن اختصار أو وظيفة (مثال: F12، السعر الأوسط، كمية)..."
                class="w-64 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs">
              <button type="button" onclick="App.closeModal('shortcutsHelpModal'); window.GherbiV6Stage1?.restorePosKeyboardFocus();"
                class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black flex items-center justify-center">✕</button>
            </div>
          </div>

          <div id="v6ShortcutsModalBody" class="p-5 overflow-y-auto space-y-5 flex-1"></div>

          <div class="px-5 py-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            <span class="text-[11px] font-bold text-slate-500">🟢 جميع الاختصارات تعمل تلقائياً داخل شاشة المبيعات لتسريع عمل البائع 100%</span>
            <button type="button" onclick="App.closeModal('shortcutsHelpModal'); window.GherbiV6Stage1?.restorePosKeyboardFocus();"
              class="px-5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black">
              إغلاق الدليل (Esc)
            </button>
          </div>
        </div>
      `;

      this.renderShortcutsGrid('');
    },

    openShortcutsHub() {
      this.buildInteractiveShortcutsModal();
      window.App.openModal('shortcutsHelpModal');
      setTimeout(() => document.getElementById('v6ShortcutsSearchInput')?.focus(), 50);
    },

    renderShortcutsGrid(query = '') {
      const body = document.getElementById('v6ShortcutsModalBody');
      if (!body) return;
      const q = String(query || '').trim().toLowerCase();

      const filtered = this.shortcutsCatalog
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
          if (!q) return true;
          return (
            item.key.toLowerCase().includes(q) ||
            item.title.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            item.group.toLowerCase().includes(q)
          );
        });

      if (!filtered.length) {
        body.innerHTML = '<div class="py-12 text-center text-slate-400 font-bold">لا يوجد اختصار مطابق للبحث</div>';
        return;
      }

      const groups = [...new Set(filtered.map((x) => x.item.group))];
      body.innerHTML = groups.map((grp) => {
        const itemsInGroup = filtered.filter((x) => x.item.group === grp);
        return `
          <div class="space-y-2">
            <div class="font-black text-xs text-blue-600 dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1">
              ${grp}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              ${itemsInGroup.map(({ item, idx }) => `
                <div onclick="GherbiV6Stage2.triggerShortcutFromHub(${idx})"
                     class="gherbi-shortcut-card" title="انقر لتجربة أو تنفيذ هذا الاختصار الآن">
                  <div class="space-y-0.5 min-w-0 flex-1">
                    <div class="font-black text-xs text-slate-800 dark:text-slate-100">${item.title}</div>
                    <div class="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">${item.desc}</div>
                  </div>
                  <kbd class="gherbi-kbd-badge" dir="ltr">${item.key}</kbd>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');
    },

    triggerShortcutFromHub(idx) {
      const item = this.shortcutsCatalog[idx];
      window.App.closeModal('shortcutsHelpModal');
      setTimeout(() => {
        if (item && typeof item.action === 'function') {
          item.action();
        }
      }, 60);
    }
  };

  window.GherbiV6Stage2 = V6Stage2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V6Stage2.init());
  } else {
    V6Stage2.init();
  }
})();
