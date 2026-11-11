/**
 * gherbi-retail-v2-enhancements.js
 * يعالج:
 * 1. حاسبة الصرف الفورية (المبلغ المستلم ⬅ الباقي للزبون) + زر القفز السريع (Alt+C)
 * 2. نافذة الزبون الخاصة بالتجزئة (Principales + Complémentaires) + زر تعديل الزبون داخل نافذة F8
 * 3. تغيير اختصار المنتج الحر إلى (Alt+F) وفصله تماماً عن F8
 * 4. شريط التنقل العلوي الاحترافي (Enterprise Top Ribbon) وإصلاح التمرير في كل الصفحات
 */

'use strict';

(function initGherbiRetailV2() {
  const RetailV2 = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.setupEnterpriseTopRibbon();
        this.fixFreeItemShortcutConflict();
        this.injectInlineChangeCalculatorAndQuickJump();
        this.redesignCustomerModalForRetail();
        this.enhanceF8ModalWithEditButtons();
        this.bindV2Shortcuts();
      }, 220);
    },

    // ========================================================================
    // 1. شريط التنقل العلوي الاحترافي الواضح (Enterprise Top Ribbon) + إصلاح التمرير
    // ========================================================================
    setupEnterpriseTopRibbon() {
      const mainContent = document.getElementById('main-content');
      const topHeader = document.getElementById('top-header');
      if (!mainContent || !topHeader) return;

      let topNav = document.getElementById('gherbiEnterpriseTopNav');
      if (!topNav) {
        topNav = document.createElement('nav');
        topNav.id = 'gherbiEnterpriseTopNav';
        topHeader.insertAdjacentElement('afterend', topNav);
      }

      this.renderEnterpriseTopRibbon();

      // مزامنة التبويب النشط عند تغيير الصفحة
      if (!window.App._v2SwitchViewHooked && typeof window.App.switchView === 'function') {
        const origSwitch = window.App.switchView.bind(window.App);
        window.App.switchView = function (viewId) {
          const res = origSwitch(viewId);
          RetailV2.highlightActiveTopRibbon(viewId);
          // إعادة التمرير لأعلى الصفحة عند فتح أي قسم غير الكاشير
          const targetSec = document.getElementById('view-' + viewId);
          if (targetSec && viewId !== 'pos') {
            targetSec.scrollTop = 0;
          }
          return res;
        };
        window.App._v2SwitchViewHooked = true;
      }
    },

    renderEnterpriseTopRibbon() {
      const topNav = document.getElementById('gherbiEnterpriseTopNav');
      if (!topNav) return;

      const navButtons = Array.from(document.querySelectorAll('#sidebar-nav .nav-btn'));
      if (!navButtons.length) return;

      topNav.innerHTML = navButtons.map((btn) => {
        const viewId = btn.id.replace('nav-', '');
        const iconEl = btn.querySelector('.material-symbols-rounded, svg');
        const labelEl = btn.querySelector('.sidebar-label') || btn.querySelector('span:last-child');
        const labelText = labelEl ? labelEl.textContent.trim() : btn.textContent.trim();
        const isActive = btn.classList.contains('active');

        return `
          <button type="button" data-topview="${viewId}" onclick="App.switchView('${viewId}')"
            class="gherbi-topnav-item ${isActive ? 'active' : ''}">
            ${iconEl ? iconEl.outerHTML : ''}
            <span>${labelText}</span>
          </button>
        `;
      }).join('');
    },

    highlightActiveTopRibbon(viewId) {
      document.querySelectorAll('#gherbiEnterpriseTopNav .gherbi-topnav-item').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.topview === viewId);
      });
    },

    // ========================================================================
    // 2. تغيير اختصار زر (منتج حر) إلى (Alt+F) وإلغاء تعارضه مع F8
    // ========================================================================
    fixFreeItemShortcutConflict() {
      // تحديث جميع أزرار المنتج الحر في الواجهة
      document.querySelectorAll('button').forEach((btn) => {
        if (btn.textContent.includes('منتج حر')) {
          btn.innerHTML = `
            <span class="material-symbols-rounded icon-sm">add_shopping_cart</span>
            <span>منتج حر (Alt+F)</span>
          `;
          btn.title = 'إضافة منتج حر غير مسجل (اختصار: Alt + F)';
        }
      });

      // تحديث النص الإرشادي داخل السلة الفارغة
      const updateEmptyHint = () => {
        const cartBox = document.getElementById('posCartItems');
        if (cartBox && cartBox.innerHTML.includes('منتج حر')) {
          cartBox.innerHTML = cartBox.innerHTML.replace(/\[F8\]\s*منتج حر/g, '[F8] بطاقة وفاء');
        }
      };
      updateEmptyHint();
    },

    // ========================================================================
    // 3. حاسبة الصرف الفورية (المبلغ المستلم ⬅ الباقي للزبون) + زر القفز السريع (Alt+C)
    // ========================================================================
    injectInlineChangeCalculatorAndQuickJump() {
      // أ. إضافة زر القفز السريع "💵 حساب الصرف (Alt+C)" بجانب زر "بيع بمبلغ (د.ج)" في الشريط العلوي للسلة
      const multBar = document.getElementById('posQuickMultiplierBar');
      if (multBar && !document.getElementById('btnQuickJumpChangeCalc')) {
        const jumpBtn = document.createElement('button');
        jumpBtn.id = 'btnQuickJumpChangeCalc';
        jumpBtn.type = 'button';
        jumpBtn.onclick = () => this.focusInlineReceivedCash();
        jumpBtn.className = 'px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-black hover:bg-blue-600 hover:text-white transition flex items-center gap-1 text-[11px]';
        jumpBtn.title = 'الانتقال المباشر لخانة المبلغ الذي أعطاه الزبون لحساب الصرف فوراً (اختصار: Alt + C)';
        jumpBtn.innerHTML = '<span>💵 حساب الصرف (Alt+C)</span>';
        multBar.appendChild(jumpBtn);
      }

      // ب. حقن حاسبة الصرف الفورية في تذييل السلة فوق "الإجمالي المستحق" مباشرة
      const totalEl = document.getElementById('cartTotalText');
      const totalRow = totalEl ? totalEl.closest('.flex.items-center.justify-between') : null;

      if (totalRow && !document.getElementById('gherbiInlineChangeCalc')) {
        const calcBox = document.createElement('div');
        calcBox.id = 'gherbiInlineChangeCalc';
        calcBox.className = 'gherbi-inline-change-box';
        calcBox.innerHTML = `
          <div class="flex items-center justify-between gap-1.5">
            <label for="gherbiReceivedCashInput" class="text-[11px] font-black text-slate-700 dark:text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer">
              <span>💵 المبلغ المستلم:</span>
              <kbd class="px-1 py-0.2 rounded bg-blue-600 text-white font-mono text-[9px]">Alt+C</kbd>
            </label>

            <div class="flex items-center gap-1 flex-1 max-w-[180px]">
              <input id="gherbiReceivedCashInput" type="number" step="any" min="0" placeholder="أدخل ما أعطاك الزبون..."
                oninput="RetailV2.recalcInlineChange()"
                onkeydown="RetailV2.onInlineCashKeydown(event)"
                class="w-full px-2 py-1 rounded-lg text-center font-mono font-black text-xs bg-white dark:bg-slate-900 border-2 border-emerald-500 focus:ring-2 focus:ring-emerald-400">
              <button type="button" onclick="RetailV2.setInlineCashValue(0)" title="مسح المبلغ"
                class="px-1.5 py-1 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-black hover:bg-rose-500 hover:text-white">✕</button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-1 flex-wrap">
            <!-- أزرار الأوراق النقدية السريعة -->
            <div class="flex items-center gap-1">
              <button type="button" onclick="RetailV2.addInlineCashNote(200)" class="gherbi-banknote-pill">+200</button>
              <button type="button" onclick="RetailV2.addInlineCashNote(500)" class="gherbi-banknote-pill">+500</button>
              <button type="button" onclick="RetailV2.addInlineCashNote(1000)" class="gherbi-banknote-pill">+1000</button>
              <button type="button" onclick="RetailV2.addInlineCashNote(2000)" class="gherbi-banknote-pill">+2000</button>
            </div>

            <!-- الناتج الفوري: الباقي للزبون (الصرف) -->
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">الباقي للزبون:</span>
              <span id="gherbiInlineChangeResult" class="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">0.00 د.ج</span>
            </div>
          </div>
          <div id="gherbiInlineChangeCentimes" class="text-left text-[10px] font-extrabold text-amber-600 dark:text-amber-400 hidden"></div>
        `;

        totalRow.parentElement.insertBefore(calcBox, totalRow);
      }

      // ربط إعادة حساب السلة بتحديث حاسبة الصرف تلقائياً
      if (!window.App._v2RecalcHooked && typeof window.App.recalcCart === 'function') {
        const origRecalc = window.App.recalcCart.bind(window.App);
        window.App.recalcCart = function (...args) {
          const res = origRecalc(...args);
          RetailV2.recalcInlineChange(res?.total);
          return res;
        };
        window.App._v2RecalcHooked = true;
      }

      // تصفير حاسبة الصرف تلقائياً عند تفريغ السلة أو إتمام البيعة
      if (!window.App._v2ClearCartHooked && typeof window.App.clearCurrentCart === 'function') {
        const origClear = window.App.clearCurrentCart.bind(window.App);
        window.App.clearCurrentCart = function (...args) {
          const r = origClear(...args);
          RetailV2.setInlineCashValue(0);
          return r;
        };
        window.App._v2ClearCartHooked = true;
      }
    },

    focusInlineReceivedCash() {
      const inp = document.getElementById('gherbiReceivedCashInput');
      if (inp) {
        inp.focus();
        inp.select();
      }
    },

    setInlineCashValue(val) {
      const inp = document.getElementById('gherbiReceivedCashInput');
      if (!inp) return;
      inp.value = val > 0 ? String(val) : '';
      this.recalcInlineChange();
    },

    addInlineCashNote(noteVal) {
      const inp = document.getElementById('gherbiReceivedCashInput');
      if (!inp) return;
      const cur = parseFloat(inp.value) || 0;
      inp.value = String(cur + Number(noteVal));
      this.recalcInlineChange();
      inp.focus();
    },

    getCurrentTotalDue() {
      const txt = document.getElementById('cartTotalText')?.textContent || '0';
      return parseFloat(txt.replace(/[^d.-]/g, '')) || 0;
    },

    recalcInlineChange(forcedTotal) {
      const inp = document.getElementById('gherbiReceivedCashInput');
      const resEl = document.getElementById('gherbiInlineChangeResult');
      const centEl = document.getElementById('gherbiInlineChangeCentimes');
      if (!inp || !resEl) return;

      const totalDue = forcedTotal !== undefined ? Number(forcedTotal) : this.getCurrentTotalDue();
      const received = parseFloat(inp.value);

      if (!Number.isFinite(received) || received <= 0) {
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
          const centStr = window.App?.formatAlgerianCentimes ? window.App.formatAlgerianCentimes(diff) : `${Math.round(diff * 100)} سنتيم`;
          centEl.textContent = `🇩🇿 الصرف بالتداول الجزائري: ${centStr}`;
          centEl.classList.remove('hidden');
        }
      } else {
        const missing = Math.abs(diff);
        resEl.textContent = `ناقص: ${missing.toFixed(2)} د.ج`;
        resEl.className = 'font-mono font-black text-sm text-rose-600';
        if (centEl) {
          centEl.textContent = `⚠️ المبلغ المستلم أقل من الإجمالي بـ ${missing.toFixed(2)} د.ج`;
          centEl.classList.remove('hidden');
        }
      }
    },

    onInlineCashKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        const received = parseFloat(event.target.value) || 0;
        // تمرير المبلغ المدفوع مباشرة لنافذة التسديد ليربح البائع الوقت
        window.App.openCheckoutModal();
        setTimeout(() => {
          const chkPaid = document.getElementById('chkPaidAmount');
          if (chkPaid && received > 0) {
            chkPaid.value = received.toFixed(2);
            window.App.recalcCheckoutModal?.();
          }
        }, 60);
      }
    },

    // ========================================================================
    // 4. إعادة تصميم نافذة (إضافة/تعديل زبون) لتناسب التجزئة على معيار الصورة 3 (Principales + Complémentaires)
    // ========================================================================
    redesignCustomerModalForRetail() {
      const modal = document.getElementById('customerModal');
      if (!modal || modal.dataset.v2RetailDesigned === '1') return;
      modal.dataset.v2RetailDesigned = '1';

      modal.innerHTML = `
        <div class="modal-content w-full max-w-2xl p-0 overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          <!-- شريط العنوان -->
          <div class="flex items-center justify-between px-5 py-3 bg-slate-900 text-white">
            <div class="flex items-center gap-2">
              <span class="text-lg">👤</span>
              <h3 class="text-sm font-black">بطاقة زبون التجزئة (Client Détail &amp; Fidélité)</h3>
            </div>
            <button type="button" onclick="App.closeModal('customerModal')" class="text-slate-400 hover:text-rose-400 font-black text-base">✕</button>
          </div>

          <div class="p-4 space-y-3.5 bg-slate-50 dark:bg-slate-900 max-h-[82vh] overflow-y-auto">
            <input type="hidden" id="custEditId">

            <!-- الإطار الأول: البيانات الأساسية (Principales - مستوحى من الصورة 3) -->
            <fieldset class="sds-retail-fieldset">
              <legend class="sds-retail-legend">Principales — البيانات الأساسية للزبون</legend>
              <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1">
                
                <div class="md:col-span-5">
                  <label class="block font-bold text-slate-500 mb-1">كود البطاقة / المرجع (Code FID) :</label>
                  <div class="flex gap-1">
                    <input id="custFidCodePreview" type="text" readonly placeholder="يُولّد تلقائياً (FID-...)"
                      class="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-amber-600">
                  </div>
                </div>

                <div class="md:col-span-7">
                  <label class="block font-black text-slate-700 dark:text-slate-200 mb-1">الاسم الكامل للزبون (Nom &amp; Prénom) * :</label>
                  <input id="custNameInput" type="text" placeholder="مثال: أمين بن يحيى..."
                    class="w-full px-3 py-1.5 rounded-lg border-2 border-blue-500/60 font-black text-sm">
                </div>

                <div class="md:col-span-5">
                  <label class="block font-bold text-slate-500 mb-1">نوع التسعيرة / التصنيف (Famille) :</label>
                  <select id="custPriceTierInput" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold">
                    <option value="retail">زبون تجزئة عادي (Détail)</option>
                    <option value="wholesale">زبون مميز / تسعيرة خاصة (VIP)</option>
                  </select>
                </div>

                <div class="md:col-span-7 flex items-center gap-5 pt-4 pr-2">
                  <label class="flex items-center gap-1.5 cursor-pointer font-black text-amber-600">
                    <input id="custVipCheckbox" type="checkbox" checked class="rounded text-amber-500">
                    <span>👑 عضو نادي الأوفياء (Fidélité VIP)</span>
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer font-bold text-rose-600">
                    <input id="custBlockedCheckbox" type="checkbox" class="rounded text-rose-500">
                    <span>🚫 تجميد الكريدي (Bloqué)</span>
                  </label>
                </div>

              </div>
            </fieldset>

            <!-- الإطار الثاني: البيانات التكميلية (Complémentaires - مبوبة ومنظمة للتجزئة) -->
            <fieldset class="sds-retail-fieldset">
              <legend class="sds-retail-legend">Complémentaires — تفاصيل الاتصال والوفاء والدين</legend>

              <!-- شريط التبويبات -->
              <div class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 mb-3 pt-1">
                <button type="button" onclick="RetailV2.switchClientTab('coord')" data-ctab="coord" class="sds-retail-tab-btn active">
                  📞 الهاتف والعنوان (Coordonnées)
                </button>
                <button type="button" onclick="RetailV2.switchClientTab('fidelite')" data-ctab="fidelite" class="sds-retail-tab-btn">
                  ⭐ نقاط الولاء (Fidélité)
                </button>
                <button type="button" onclick="RetailV2.switchClientTab('credit')" data-ctab="credit" class="sds-retail-tab-btn">
                  💳 الديون وسقف الكريدي (Crédit)
                </button>
              </div>

              <!-- تبويب 1: الهاتف والعنوان -->
              <div id="retailClientTabCoord" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">رقم الهاتف (Tel / WhatsApp) :</label>
                  <input id="custPhoneInput" type="text" placeholder="0550..."
                    class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-mono font-bold text-sm">
                </div>
                <div>
                  <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">الولاية (Wilaya) :</label>
                  <select id="custWilayaSelect" onchange="App.onCustomerWilayaChange && App.onCustomerWilayaChange(this.value)"
                    class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold">
                    <option value="">اختر الولاية...</option>
                    <option value="25 - قسنطينة">25 - قسنطينة</option>
                    <option value="16 - الجزائر">16 - الجزائر</option>
                    <option value="43 - ميلة">43 - ميلة</option>
                    <option value="19 - سطيف">19 - سطيف</option>
                    <option value="31 - وهران">31 - وهران</option>
                    <option value="23 - عنابة">23 - عنابة</option>
                    <option value="09 - البليدة">09 - البليدة</option>
                    <option value="05 - باتنة">05 - باتنة</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">العنوان / الحي / ملاحظات (Adresse &amp; Notes) :</label>
                  <input id="custAddressInput" type="text" placeholder="الحي، الشارع، أو ملاحظة خاصة بالزبون..."
                    class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold">
                </div>
              </div>

              <!-- تبويب 2: نقاط الولاء -->
              <div id="retailClientTabFidelite" class="hidden grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                <div>
                  <label class="block font-black text-amber-600 dark:text-amber-400 mb-1">⭐ رصيد نقاط الولاء الحالي (Points de Fidélité) :</label>
                  <input id="custLoyaltyPointsInput" type="number" step="1" value="0"
                    class="w-full px-3 py-2 rounded-lg border-2 border-amber-500/60 font-mono font-black text-base text-center text-amber-500">
                </div>
                <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] leading-relaxed">
                  <div class="font-black text-amber-700 dark:text-amber-300 mb-0.5">💡 كيف تعمل بطاقة الوفاء؟</div>
                  <div>تُجمع النقاط تلقائياً مع كل عملية شراء، ويمكن للبائع مسح بطاقة الزبون أو ضغط <kbd class="px-1 rounded bg-slate-800 text-white font-mono">F8</kbd> ثم <kbd class="px-1 rounded bg-emerald-600 text-white font-mono">F9</kbd> لتحويل النقاط إلى تخفيض مالي فوري.</div>
                </div>
              </div>

              <!-- تبويب 3: الديون وسقف الكريدي -->
              <div id="retailClientTabCredit" class="hidden grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-600 dark:text-slate-300 mb-1">الدين الأولي السابق (Solde initial د.ج) :</label>
                  <input id="custInitDebtInput" type="number" step="any" value="0"
                    class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-mono font-bold text-center">
                </div>
                <div>
                  <label class="block font-bold text-rose-600 dark:text-rose-400 mb-1">سقف الدين المسموح (Plafond Crédit د.ج) :</label>
                  <input id="custCreditLimitInput" type="number" step="any" value="0"
                    class="w-full px-3 py-1.5 rounded-lg border border-rose-500/40 font-mono font-bold text-center">
                </div>
              </div>

              <!-- حقول مخفية للحفاظ على التوافق التام 100% مع دوال الحفظ الخلفية في renderer.js -->
              <div class="hidden" aria-hidden="true">
                <input id="custRcInput" type="text">
                <input id="custNifInput" type="text">
                <input id="custAiInput" type="text">
                <input id="custNisInput" type="text">
                <input id="custCcpNumberInput" type="text">
                <input id="custCcpKeyInput" type="text">
                <input id="custRipInput" type="text">
                <input id="custCommuneInput" type="text">
              </div>
            </fieldset>

            <!-- أزرار الحفظ والإغلاق (Enregistrer | Fermer) -->
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onclick="App.closeModal('customerModal')"
                class="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-500 hover:text-white font-black transition">
                ✕ إغلاق (Fermer)
              </button>
              <button type="button" onclick="RetailV2.saveRetailCustomerAndSync()"
                class="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 transition">
                <span>✔</span>
                <span>حفظ بيانات الزبون (Enregistrer)</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // اعتراض فتح نافذة الزبون لتحديث حقل كود FID وإعادة التبويب الأول
      if (!window.App._v2OpenCustHooked && typeof window.App.openCustomerModal === 'function') {
        const origOpenCust = window.App.openCustomerModal.bind(window.App);
        window.App.openCustomerModal = function (id = null) {
          const res = origOpenCust(id);
          RetailV2.switchClientTab('coord');
          const fidPreview = document.getElementById('custFidCodePreview');
          if (fidPreview) {
            fidPreview.value = id ? ('FID-' + String(id).padStart(5, '0')) : 'يُولّد تلقائياً عند الحفظ';
          }
          setTimeout(() => document.getElementById('custNameInput')?.focus(), 60);
          return res;
        };
        window.App._v2OpenCustHooked = true;
      }
    },

    switchClientTab(tabKey) {
      document.querySelectorAll('[data-ctab]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.ctab === tabKey);
      });
      document.getElementById('retailClientTabCoord')?.classList.toggle('hidden', tabKey !== 'coord');
      document.getElementById('retailClientTabFidelite')?.classList.toggle('hidden', tabKey !== 'fidelite');
      document.getElementById('retailClientTabCredit')?.classList.toggle('hidden', tabKey !== 'credit');
    },

    async saveRetailCustomerAndSync() {
      if (window.App && typeof window.App.saveCustomer === 'function') {
        await window.App.saveCustomer();
        // تحديث نافذة F8 وزر الوفاء الذكي بعد حفظ التعديلات مباشرة
        if (window.RetailMaster) {
          window.RetailMaster.renderSmartLoyaltyCustomersList(
            document.getElementById('smartLoyaltyScanOrSearchInput')?.value || ''
          );
          window.RetailMaster.refreshSmartModalSelectedCustomer();
          window.RetailMaster.syncSmartLoyaltyButtonDisplay();
        }
      }
    },

    // ========================================================================
    // 5. إضافة زر (✏️ تعديل بيانات الزبون) داخل نافذة F8 الذكية
    // ========================================================================
    enhanceF8ModalWithEditButtons() {
      if (!window.RetailMaster) return;

      // إضافة زر "✏️ تعديل بيانات الزبون" في بطاقة الزبون المحدد داخل نافذة F8
      const selectedCardHeader = document.querySelector('#smartSelectedCustCard > div:first-child > div:first-child');
      if (selectedCardHeader && !document.getElementById('btnEditSelectedCustInF8')) {
        const editBtn = document.createElement('button');
        editBtn.id = 'btnEditSelectedCustInF8';
        editBtn.type = 'button';
        editBtn.onclick = () => this.editCurrentCustomerFromF8();
        editBtn.className = 'mr-2 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-slate-950 font-black text-[11px] transition inline-flex items-center gap-1';
        editBtn.innerHTML = '<span>✏️ تعديل بيانات الزبون</span>';
        selectedCardHeader.appendChild(editBtn);
      }

      // ترقية قائمة الزبائن داخل نافذة F8 لإظهار زر (✏️ تعديل) أمام كل زبون
      window.RetailMaster.renderSmartLoyaltyCustomersList = function (query = '') {
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
              class="p-2 flex items-center justify-between cursor-pointer hover:bg-blue-600/10 transition ${isSelected ? 'bg-blue-600/15 font-black' : ''}">
              <div class="flex items-center gap-2 min-w-0">
                <span class="px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono text-[10px] font-bold">${fidCode}</span>
                <span class="font-bold truncate">${c.name}</span>
                ${c.phone ? `<span class="text-slate-400 font-mono text-[11px]">(${c.phone})</span>` : ''}
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-mono font-bold text-[10.5px]">⭐ ${pts} نقطة</span>
                <button type="button" onclick="event.stopPropagation(); RetailV2.openEditCustomerFromF8Row(${c.id})"
                  class="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 font-bold text-[10.5px] transition"
                  title="تعديل اسم أو هاتف أو نقاط هذا الزبون">
                  ✏️ تعديل
                </button>
              </div>
            </div>
          `;
        }).join('');
      };
    },

    editCurrentCustomerFromF8() {
      const cid = window.App?.currentCart?.customerId;
      if (!cid) {
        if (window.showToast) window.showToast('يرجى اختيار زبون أولاً لتعديل بياناته، أو اضغط (+ زبون جديد)', 'warning');
        return;
      }
      window.App.openCustomerModal(Number(cid));
    },

    openEditCustomerFromF8Row(customerId) {
      if (!customerId) return;
      if (window.RetailMaster) {
        window.RetailMaster.pickCustomerInSmartModal(customerId);
      }
      window.App.openCustomerModal(Number(customerId));
    },

    // ========================================================================
    // 6. اختصارات الكيبورد الجديدة (Alt+C لحاسبة الصرف | Alt+F للمنتج الحر | حماية F8)
    // ========================================================================
    bindV2Shortcuts() {
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          const isPosActive = Boolean(posSec && posSec.classList.contains('active'));
          if (!isPosActive) return;

          // Alt + C -> القفز الفوري لخانة المبلغ المستلم من الزبون لحساب الصرف
          if (e.altKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
            e.preventDefault();
            e.stopPropagation();
            this.focusInlineReceivedCash();
            return;
          }

          // Alt + F -> فتح نافذة إضافة منتج حر (بدلاً من F8 المتعارض)
          if (e.altKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
            e.preventDefault();
            e.stopPropagation();
            window.App.openFreeItemModal?.();
            return;
          }

          // ضمان أن F8 يفتح فقط نافذة الزبون والوفاء ويغلق نافذة المنتج الحر إن فتحت بالخطأ
          if (e.key === 'F8') {
            e.preventDefault();
            e.stopPropagation();
            window.App.closeModal?.('freeItemModal');
            window.RetailMaster?.openSmartLoyaltyModal('scan');
            return;
          }
        },
        true
      );
    }
  };

  window.RetailV2 = RetailV2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RetailV2.init());
  } else {
    RetailV2.init();
  }
})();
