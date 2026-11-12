/**
 * gherbi-v7-stage1-vault-and-walkin.js
 * المحرك التنفيذي للشطر الأول (الإصدار 7):
 * 1. الحفاظ على السلة النشطة عند التنقل بين الأقسام دون فتح سلة جديدة، مع بدء البرنامج فقط على سلة نظيفة وزبون عابر.
 * 2. خزنة طوارئ الكهرباء والفواتير غير المسجلة (Black-Box Unsaved Invoices Vault) لحماية المشتريات من الانقطاع المفاجئ.
 * 3. زر "👤 عابر (Alt+W)" داخل شريط الزبون + اختصار لوحة المفاتيح (Alt+W) وإضافته لدليل الاختصارات.
 */

'use strict';

(function initGherbiV7Stage1() {
  const VAULT_STORAGE_KEY = 'gherbi_blackbox_unsaved_vault_v7';
  const PREV_SESSION_KEY = 'gherbi_previous_session_live_carts_v7';

  const V7Stage1 = {
    init() {
      this.archiveInterruptedSessionBeforeBootReset();

      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.preserveActiveCartOnViewSwitch();
        this.buildCrashRecoveryVaultModal();
        this.injectVaultAndWalkInButtons();
        this.setupRealTimeBlackBoxRecorder();
        this.bindWalkInShortcutAndRegisterInHub();
        console.log('🚀 [Gherbi V7 - Stage 1]: ثبات السلة + خزنة طوارئ الكهرباء + زر واختصار الزبون العابر (Alt+W) جاهزة.');
      }, 180);
    },

    // ========================================================================
    // 1. أرشفة أي فاتورة غير مسجلة من الجلسة السابقة (في حال انقطاع الكهرباء أو الإغلاق المفاجئ)
    // ========================================================================
    archiveInterruptedSessionBeforeBootReset() {
      try {
        const rawLive = localStorage.getItem(PREV_SESSION_KEY);
        if (!rawLive) return;
        const liveCarts = JSON.parse(rawLive);
        if (!Array.isArray(liveCarts)) return;

        const nonEmptyCarts = liveCarts.filter((c) => Array.isArray(c.items) && c.items.length > 0);
        if (nonEmptyCarts.length > 0) {
          const vault = this.getVaultRecords();
          nonEmptyCarts.forEach((cart) => {
            const total = cart.items.reduce(
              (s, it) => s + Number(it.subtotal ?? Number(it.quantity || 1) * Number(it.price || 0)),
              0
            );
            const sig = cart.items.map((i) => `${i.name}:${i.quantity}:${i.price}`).join('|') + '|' + (cart.customerId || '');
            // عدم تكرار نفس السلة في الخزنة إذا كانت محفوظة مسبقاً بنفس البصمة
            if (!vault.some((v) => v.signature === sig)) {
              vault.unshift({
                id: 'vault_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                savedAt: cart._lastModifiedAt || new Date().toLocaleString('ar-DZ'),
                reason: '⚡ فاتورة غير مسجلة (إغلاق مفاجئ / انقطاع تيار)',
                customerId: cart.customerId || '',
                customerName: cart.customerName || 'زبون عابر',
                discount: Number(cart.discount || 0),
                items: cart.items,
                totalDzd: Number(Math.max(0, total - Number(cart.discount || 0)).toFixed(2)),
                signature: sig
              });
            }
          });
          localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault.slice(0, 35)));
        }
        localStorage.removeItem(PREV_SESSION_KEY);
      } catch (_) {}
    },

    getVaultRecords() {
      try {
        const raw = localStorage.getItem(VAULT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    },

    saveVaultRecords(list) {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify((list || []).slice(0, 35)));
      this.updateVaultButtonBadge();
    },

    // ========================================================================
    // 2. منع فتح سلة جديدة عند الخروج المؤقت من شاشة المبيعات والعودة إليها
    // ========================================================================
    preserveActiveCartOnViewSwitch() {
      if (window.GherbiV6Stage1) {
        // تعديل دالة openFreshWalkInCartOnPosEntry لتعمل فقط عند إقلاع البرنامج الأول (isInitialBoot === true)
        const origOpenFresh = window.GherbiV6Stage1.openFreshWalkInCartOnPosEntry?.bind(window.GherbiV6Stage1);
        window.GherbiV6Stage1.openFreshWalkInCartOnPosEntry = function (isInitialBoot = false) {
          if (!isInitialBoot) {
            // عند العودة من صفحة أخرى (كالمخزون أو السجل)، نحافظ على السلة الحالية كما هي 100%!
            this.restorePosKeyboardFocus?.();
            return;
          }
          if (origOpenFresh) return origOpenFresh(true);
        };
      }
    },

    // ========================================================================
    // 3. المسجل اللحظي للصندوق الأسود (Real-Time Black-Box Recorder ضد انقطاع الكهرباء)
    // ========================================================================
    setupRealTimeBlackBoxRecorder() {
      const recordCurrentCartsToBlackBox = () => {
        try {
          const carts = window.AppState?.carts || [];
          const hasAnyItems = carts.some((c) => Array.isArray(c.items) && c.items.length > 0);
          if (!hasAnyItems) {
            localStorage.removeItem(PREV_SESSION_KEY);
            return;
          }

          const customers = window.AppState?.customers || [];
          const enriched = carts
            .filter((c) => Array.isArray(c.items) && c.items.length > 0)
            .map((c) => {
              const cust = customers.find((x) => String(x.id) === String(c.customerId || ''));
              return {
                ...c,
                customerName: cust ? cust.name : 'زبون عابر',
                _lastModifiedAt: new Date().toLocaleString('ar-DZ')
              };
            });

          localStorage.setItem(PREV_SESSION_KEY, JSON.stringify(enriched));
        } catch (_) {}
      };

      // التسجيل الفوري مع كل تعديل في السلة
      if (!window.App._v7BlackBoxHooked && typeof window.App.recalcAndRenderCart === 'function') {
        const origRecalc = window.App.recalcAndRenderCart.bind(window.App);
        window.App.recalcAndRenderCart = function (...args) {
          const res = origRecalc(...args);
          recordCurrentCartsToBlackBox();
          V7Stage1.syncWalkInQuickButtonState();
          return res;
        };
        window.App._v7BlackBoxHooked = true;
      }

      // عند إتمام البيع بنجاح، نمسح السلة المباعة من ذاكرة الطوارئ الحية حتى لا تُسترجع كأنها غير مسجلة
      ['submitSale', 'instantConfirmAndCheckout'].forEach((fn) => {
        const orig = window.App[fn]?.bind(window.App);
        if (orig && !window.App['_v7CleanLive_' + fn]) {
          window.App[fn] = async function (...args) {
            const res = await orig(...args);
            setTimeout(recordCurrentCartsToBlackBox, 150);
            return res;
          };
          window.App['_v7CleanLive_' + fn] = true;
        }
      });

      setInterval(recordCurrentCartsToBlackBox, 2000);
    },

    // حفظ السلة الحالية يدوياً في خزنة الفواتير غير المسجلة بضغطة زر
    snapshotCurrentCartToVaultManually() {
      const cart = window.App?.currentCart;
      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        if (window.showToast) window.showToast('⚠️ السلة الحالية فارغة لا تحتوي على أصناف لحفظها', 'warning');
        return;
      }
      const cust = (window.AppState.customers || []).find((c) => String(c.id) === String(cart.customerId || ''));
      const total = cart.items.reduce(
        (s, it) => s + Number(it.subtotal ?? Number(it.quantity || 1) * Number(it.price || 0)),
        0
      );
      const vault = this.getVaultRecords();
      vault.unshift({
        id: 'vault_' + Date.now(),
        savedAt: new Date().toLocaleString('ar-DZ'),
        reason: '📌 محفوظة يدوياً في خزنة الفواتير غير المسجلة',
        customerId: cart.customerId || '',
        customerName: cust ? cust.name : 'زبون عابر',
        discount: Number(cart.discount || 0),
        items: JSON.parse(JSON.stringify(cart.items)),
        totalDzd: Number(Math.max(0, total - Number(cart.discount || 0)).toFixed(2)),
        signature: Date.now().toString()
      });
      this.saveVaultRecords(vault);
      this.renderVaultItemsList();
      if (window.showToast) window.showToast('✅ تم حفظ نسخة من السلة الحالية في خزنة الطوارئ', 'success');
    },

    // ========================================================================
    // 4. نافذة خزنة الفواتير غير المسجلة وطوارئ الكهرباء (#gherbiCrashVaultModal)
    // ========================================================================
    buildCrashRecoveryVaultModal() {
      if (document.getElementById('gherbiCrashVaultModal')) return;

      const modal = document.createElement('div');
      modal.id = 'gherbiCrashVaultModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content w-full max-w-3xl p-0 overflow-hidden rounded-2xl border-2 border-amber-500/60 shadow-2xl bg-white dark:bg-slate-900 text-xs max-h-[88vh] flex flex-col">
          <!-- الهيدر -->
          <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl font-black">⚡</div>
              <div>
                <h3 class="text-sm font-black text-amber-400">خزنة الفواتير غير المسجلة وطوارئ انقطاع الكهرباء (Black-Box Vault)</h3>
                <p class="text-[11px] text-slate-400">تُحفظ هنا تلقائياً كل سلة لم تُسجل بعد أو انقطعت الكهرباء أثناء بيعها لتسترجعها بضغطة زر</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('gherbiCrashVaultModal')" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black">✕</button>
          </div>

          <!-- شريط الأدوات العلوي داخل النافذة -->
          <div class="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="font-bold text-[11px] text-amber-800 dark:text-amber-300">
              🛡️ الحماية الذاتية نشطة: يتم تسجيل كل حركة في السلة لحظياً في الصندوق الأسود.
            </div>
            <div class="flex items-center gap-2">
              <button type="button" onclick="GherbiV7Stage1.snapshotCurrentCartToVaultManually()"
                class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] shadow-sm">
                📌 + حفظ السلة الحالية في الخزنة
              </button>
              <button type="button" onclick="GherbiV7Stage1.clearAllVaultRecords()"
                class="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 hover:text-white font-black text-[11px] transition">
                🗑️ تفريغ الخزنة
              </button>
            </div>
          </div>

          <!-- قائمة الفواتير المحفوظة -->
          <div id="gherbiVaultListContainer" class="p-4 overflow-y-auto space-y-2.5 flex-1"></div>

          <!-- التذييل -->
          <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            <span class="text-[11px] text-slate-500 font-bold">💡 عند استرجاع أي فاتورة، تُفتح لك في سلة الكاشير بكامل أصنافها وزبونها</span>
            <button type="button" onclick="App.closeModal('gherbiCrashVaultModal')" class="px-5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-black">إغلاق</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    openCrashVaultModal() {
      this.buildCrashRecoveryVaultModal();
      this.renderVaultItemsList();
      window.App.openModal('gherbiCrashVaultModal');
    },

    renderVaultItemsList() {
      const box = document.getElementById('gherbiVaultListContainer');
      if (!box) return;
      const list = this.getVaultRecords();

      // فحص إن كانت هناك سلات مفتوحة حالياً في الجلسة لعرضها أيضاً كـ "نشطة الآن"
      const currentActiveCarts = (window.AppState?.carts || []).filter((c) => Array.isArray(c.items) && c.items.length > 0);

      if (list.length === 0 && currentActiveCarts.length === 0) {
        box.innerHTML = `
          <div class="py-12 text-center space-y-2">
            <div class="text-3xl">✅</div>
            <div class="font-black text-sm text-slate-700 dark:text-slate-200">لا توجد فواتير مفقودة أو غير مسجلة من انقطاع سابق</div>
            <div class="text-[11px] text-slate-400 font-bold">في حال انقطاع الكهرباء أثناء أي عملية بيع، ستجد الفاتورة محفوظة هنا تلقائياً فور تشغيل البرنامج.</div>
          </div>
        `;
        return;
      }

      box.innerHTML = list.map((rec, idx) => {
        const itemsPreview = (rec.items || [])
          .map((it) => `${it.name || it.custom_product_name || 'صنف'} (×${it.quantity || 1})`)
          .join(' ، ');
        return `
          <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-amber-500/40 flex flex-wrap items-center justify-between gap-3 hover:border-amber-500 transition">
            <div class="space-y-1 flex-1 min-w-[240px]">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10.5px]">${rec.reason || '⚡ طوارئ'}</span>
                <span class="font-mono text-[11px] font-bold text-slate-500">🕒 ${rec.savedAt || ''}</span>
                <span class="px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 font-black text-[11px]">👤 ${rec.customerName || 'زبون عابر'}</span>
              </div>
              <div class="font-bold text-xs text-slate-800 dark:text-slate-100 line-clamp-2">
                🛒 الأصناف (${(rec.items || []).length}): <span class="text-slate-600 dark:text-slate-300">${itemsPreview}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <div class="text-left ml-2">
                <div class="text-[10px] text-slate-400 font-bold">الإجمالي</div>
                <div class="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">${Number(rec.totalDzd || 0).toFixed(2)} د.ج</div>
              </div>
              <button type="button" onclick="GherbiV7Stage1.restoreVaultRecordToPos(${idx})"
                class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow flex items-center gap-1">
                <span>🔄 استرجاع للكاشير</span>
              </button>
              <button type="button" onclick="GherbiV7Stage1.deleteVaultRecord(${idx})"
                class="px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 hover:text-white font-black text-xs transition" title="حذف من الخزنة">
                ✕
              </button>
            </div>
          </div>
        `;
      }).join('');
    },

    restoreVaultRecordToPos(idx) {
      const vault = this.getVaultRecords();
      const rec = vault[idx];
      if (!rec) return;

      const carts = window.AppState?.carts || [];
      const curCart = window.App.currentCart;

      const restoredCartObj = {
        id: 'cart_' + Date.now(),
        label: `سلة #${carts.length + 1}`,
        items: JSON.parse(JSON.stringify(rec.items || [])),
        customerId: rec.customerId || '',
        priceTier: 'retail',
        discount: Number(rec.discount || 0),
        _redeemedPoints: 0
      };

      // إذا كانت السلة الحالية فارغة نضعها فيها مباشرة، وإلا نفتحها في تبويب سلة جديد
      if (curCart && (!curCart.items || curCart.items.length === 0)) {
        restoredCartObj.label = curCart.label || 'سلة #1';
        carts[window.AppState.activeCartIndex || 0] = restoredCartObj;
      } else {
        carts.push(restoredCartObj);
        window.AppState.activeCartIndex = carts.length - 1;
      }

      // حذفها من الخزنة بعد استرجاعها بنجاح
      vault.splice(idx, 1);
      this.saveVaultRecords(vault);

      const sel = document.getElementById('posCustomerSelect');
      if (sel) sel.value = String(restoredCartObj.customerId || '');

      window.App.closeModal('gherbiCrashVaultModal');
      window.App.renderPosView?.();
      window.App.renderCartTabs?.();
      window.App.renderCartItems?.();
      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      this.syncWalkInQuickButtonState();

      if (window.showToast) {
        window.showToast(`✅ تم استرجاع الفاتورة غير المسجلة (${restoredCartObj.items.length} أصناف) إلى الكاشير بنجاح!`, 'success');
      }
    },

    deleteVaultRecord(idx) {
      const vault = this.getVaultRecords();
      vault.splice(idx, 1);
      this.saveVaultRecords(vault);
      this.renderVaultItemsList();
    },

    clearAllVaultRecords() {
      this.saveVaultRecords([]);
      this.renderVaultItemsList();
      if (window.showToast) window.showToast('🗑️ تم تفريغ خزنة الطوارئ بنجاح', 'info');
    },

    updateVaultButtonBadge() {
      const btn = document.getElementById('gherbiPosCrashVaultBtn');
      const badge = document.getElementById('gherbiPosCrashVaultCount');
      if (!btn || !badge) return;
      const count = this.getVaultRecords().length;
      badge.textContent = String(count);
      btn.classList.toggle('gherbi-vault-btn-alert', count > 0);
    },

    // ========================================================================
    // 5. زر التحويل الفوري للزبون العابر داخل شريط الزبون + اختصار (Alt + W)
    // ========================================================================
    switchImmediatelyToWalkInCustomer() {
      const cart = window.App?.currentCart;
      const hadCustomer = Boolean(cart?.customerId || document.getElementById('posCustomerSelect')?.value);

      if (cart) {
        cart.customerId = '';
        if (Number(cart._redeemedPoints || 0) > 0) {
          cart.discount = 0;
          cart._redeemedPoints = 0;
          const discInp = document.getElementById('cartDiscountInput');
          if (discInp) discInp.value = '0';
        }
      }

      const sel = document.getElementById('posCustomerSelect');
      if (sel) {
        sel.value = '';
        sel.dispatchEvent(new Event('change'));
      }

      const redeemInp = document.getElementById('smartRedeemPointsInput');
      if (redeemInp) redeemInp.value = '0';

      window.RetailMaster?.syncSmartLoyaltyButtonDisplay();
      window.GherbiMasterUpgrade?.updateCustomerTriggerBar?.();
      window.GherbiMasterUpgrades?.syncSmartCustomerBar?.();
      window.App?.recalcAndRenderCart?.();
      this.syncWalkInQuickButtonState();

      if (window.showToast) {
        window.showToast(
          hadCustomer
            ? '👤 تم التحويل فوراً إلى (زبون عابر — بدون بطاقة وفاء) [Alt+W]'
            : '👤 السلة مضبوطة بالفعل على (زبون عابر) [Alt+W]',
          'info'
        );
      }
      window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
    },

    syncWalkInQuickButtonState() {
      const btn = document.getElementById('gherbiInstantWalkInBtn');
      if (!btn) return;
      const cid = window.App?.currentCart?.customerId || document.getElementById('posCustomerSelect')?.value || '';
      const isLoyalSelected = Boolean(cid && String(cid).trim() !== '');

      if (isLoyalSelected) {
        btn.className = 'gherbi-walkin-quick-pill is-loyal-selected';
        btn.innerHTML = '<span>👤 تحويل لزبون عابر</span><kbd class="text-[9px] bg-black/25 px-1 rounded font-mono" dir="ltr">Alt+W</kbd>';
        btn.title = 'انقر هنا أو اضغط Alt+W للعودة فوراً إلى الزبون العابر وإلغاء بطاقة الوفاء من هذه الفاتورة';
      } else {
        btn.className = 'gherbi-walkin-quick-pill is-walkin-active';
        btn.innerHTML = '<span>👤 عابر</span><kbd class="text-[9px] opacity-75 font-mono" dir="ltr">Alt+W</kbd>';
        btn.title = 'السلة حالياً على الزبون العابر (اختصار العودة السريعة للزبون العابر: Alt+W)';
      }
    },

    injectVaultAndWalkInButtons() {
      const ensureButtons = () => {
        // أ. حقن زر "⚡ غير مسجلة (طوارئ)" في شريط السلة العلوي بجانب (سجل) و (⌨️ الاختصارات)
        const topDeckActions = document.querySelector('#gherbiCartTopDeck > div:nth-child(2) > div:last-child');
        if (topDeckActions && !document.getElementById('gherbiPosCrashVaultBtn')) {
          const vBtn = document.createElement('button');
          vBtn.id = 'gherbiPosCrashVaultBtn';
          vBtn.type = 'button';
          vBtn.onclick = () => this.openCrashVaultModal();
          vBtn.title = 'خزنة الفواتير غير المسجلة وطوارئ انقطاع الكهرباء';
          vBtn.className = 'px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-200 text-[11px] font-black transition flex items-center gap-1';
          vBtn.innerHTML = '<span>⚡ غير مسجلة (<span id="gherbiPosCrashVaultCount">0</span>)</span>';
          topDeckActions.appendChild(vBtn);
          this.updateVaultButtonBadge();
        }

        // ب. حقن زر "👤 عابر (Alt+W)" داخل شريط الزبون مباشرة بجانب أزرار F8 و F9 (الصورتان 1 و 2)
        const smartCustBtn = document.getElementById('btnOpenSmartLoyaltyModal') || document.getElementById('gherbiSmartCustomerTrigger');
        if (smartCustBtn && !document.getElementById('gherbiInstantWalkInBtn')) {
          const badgesContainer = smartCustBtn.querySelector('div:last-child') || smartCustBtn;
          const walkInBtn = document.createElement('button');
          walkInBtn.id = 'gherbiInstantWalkInBtn';
          walkInBtn.type = 'button';
          walkInBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.switchImmediatelyToWalkInCustomer();
          };
          badgesContainer.insertBefore(walkInBtn, badgesContainer.firstChild);
          this.syncWalkInQuickButtonState();
        }
      };

      ensureButtons();
      setInterval(() => {
        ensureButtons();
        this.syncWalkInQuickButtonState();
        this.updateVaultButtonBadge();
      }, 600);
    },

    bindWalkInShortcutAndRegisterInHub() {
      // 1. اختصار لوحة المفاتيح Alt + W للعودة الفورية للزبون العابر
      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;
          if (e.altKey && (e.key === 'w' || e.key === 'W' || e.code === 'KeyW')) {
            e.preventDefault();
            e.stopPropagation();
            this.switchImmediatelyToWalkInCustomer();
          }
        },
        true
      );

      // 2. تسجيل اختصار Alt + W واختصار خزنة الطوارئ تلقائياً في نافذة (⌨️ الاختصارات)
      const registerInShortcutsHub = () => {
        const catalog = window.GherbiV6Stage2?.shortcutsCatalog;
        if (!Array.isArray(catalog)) return;

        if (!catalog.some((s) => s.key === 'Alt + W')) {
          catalog.splice(6, 0, {
            group: '👑 2. بطاقة الوفاء، الزبائن، والسلات',
            key: 'Alt + W',
            title: 'العودة الفورية إلى الزبون العابر',
            desc: 'إلغاء ربط الزبون الوفي من السلة الحالية والعودة فوراً إلى (زبون عابر — بدون بطاقة وفاء)',
            action: () => V7Stage1.switchImmediatelyToWalkInCustomer()
          });
        }
        if (!catalog.some((s) => s.key === 'Alt + R')) {
          catalog.push({
            group: '🛡️ 4. التحكم في السلة، الوردية، والإدارة',
            key: 'Alt + R',
            title: 'فتح خزنة الفواتير غير المسجلة وطوارئ الكهرباء',
            desc: 'استعراض واسترجاع الفواتير التي لم تُسجل أو انقطعت الكهرباء أثناء بيعها',
            action: () => V7Stage1.openCrashVaultModal()
          });
        }
      };

      registerInShortcutsHub();
      setTimeout(registerInShortcutsHub, 800);

      window.addEventListener(
        'keydown',
        (e) => {
          const posSec = document.getElementById('view-pos');
          if (!posSec || !posSec.classList.contains('active')) return;
          if (e.altKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
            e.preventDefault();
            e.stopPropagation();
            this.openCrashVaultModal();
          }
        },
        true
      );
    }
  };

  window.GherbiV7Stage1 = V7Stage1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V7Stage1.init());
  } else {
    V7Stage1.init();
  }
})();
